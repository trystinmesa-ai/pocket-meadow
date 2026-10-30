// Optional account + cloud save with Supabase (plain fetch, no SDK).
// The farm always runs from this device's copy. When signed in, it uploads
// the save every minute and whenever you leave, and on opening it takes the
// newest copy, so your phone and laptop share one farm.

const SUPABASE_URL = 'https://wyadiallryxhdpucndve.supabase.co';
// Publishable key: meant to ship in browser code. Row Level Security limits
// every account to its own row, and signed-out requests get nothing.
const SUPABASE_KEY = 'sb_publishable_9h8nhpmzskqiDjT2v-dZQw_dUsfnR5T';
const TABLE = 'meadow_saves';

const SESSION_KEY = 'meadow.session';
const syncKey = () => `meadow.sync.${user()?.id || 'none'}`; // { rev, dirty } for the signed-in account

const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

export class Offline extends Error { constructor() { super('Can’t reach the server.'); } }
class SignedOut extends Error { constructor() { super('Signed out'); } }

// ---------- status ----------
/** state: off | syncing | ok | offline | error */
export const status = { state: 'off', last: null, error: '' };
const subs = new Set();
export const onStatus = (fn) => { subs.add(fn); return () => subs.delete(fn); };
function setStatus(p) { Object.assign(status, p); for (const f of subs) f(status); }

// for tests: swap in a fake fetch
let doFetch = (...a) => fetch(...a);
export function _setFetch(f) { doFetch = f; }

const session = () => ls.get(SESSION_KEY);
export const user = () => session()?.user ?? null;
export const syncMeta = () => ls.get(syncKey()) || { rev: 0, dirty: true };
const setMeta = (p) => ls.set(syncKey(), { ...syncMeta(), ...p });
export const markDirty = () => { if (user()) setMeta({ dirty: true }); };

function saveSession(j) {
  ls.set(SESSION_KEY, {
    access_token: j.access_token, refresh_token: j.refresh_token,
    expires_at: j.expires_at ?? Math.floor(Date.now() / 1000) + j.expires_in,
    user: { id: j.user.id, email: j.user.email },
  });
}

async function call(url, { method = 'GET', body, token, prefer, keepalive } = {}) {
  let res;
  try {
    res = await doFetch(url, {
      method, keepalive,
      headers: {
        apikey: SUPABASE_KEY, 'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch { throw new Offline(); }
  const text = await res.text();
  let j = null;
  try { j = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    throw Object.assign(new Error(j?.msg || j?.error_description || j?.message || `Server error ${res.status}`),
      { status: res.status, code: j?.error_code || j?.code || j?.error });
  }
  return j;
}
const auth = (path, opts) => call(`${SUPABASE_URL}/auth/v1/${path}`, opts);

let refreshing = null;
async function token() {
  const s = session();
  if (!s) throw new SignedOut();
  if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
  refreshing ??= auth('token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } })
    .then(saveSession, (e) => {
      if (e.status >= 400 && e.status < 500) { ls.set(SESSION_KEY, null); setStatus({ state: 'off' }); throw new SignedOut(); }
      throw e;
    })
    .finally(() => { refreshing = null; });
  await refreshing;
  return session().access_token;
}
const rest = async (path, opts = {}) => call(`${SUPABASE_URL}/rest/v1/${path}`, { ...opts, token: await token() });

// ---------- account ----------
export async function signIn(email, password) {
  const j = await auth('token?grant_type=password', { method: 'POST', body: { email, password } });
  saveSession(j);
  setStatus({ state: 'ok', error: '' });
  return j.user;
}

/**
 * Create an account. Returns { user } when signed straight in, or
 * { confirm: true } when Supabase wants the email confirmed first.
 */
export async function signUp(email, password) {
  let j;
  try {
    j = await auth('signup', { method: 'POST', body: { email, password } });
  } catch (e) {
    if (e.code === 'signup_disabled' || /signups? not allowed/i.test(e.message)) {
      throw new Error('New accounts are switched off for this game. Ask the farm owner to add you.');
    }
    if (e.code === 'user_already_exists' || /already registered/i.test(e.message)) throw new Error('That email already has an account. Sign in instead.');
    if (e.code === 'weak_password' || /password/i.test(e.message)) throw new Error('Pick a longer password (at least 6 characters).');
    throw e;
  }
  if (j && j.access_token) { saveSession(j); setStatus({ state: 'ok', error: '' }); return { user: j.user }; }
  return { confirm: true };
}
export async function signOut() {
  const s = session();
  ls.set(SESSION_KEY, null);
  setStatus({ state: 'off' });
  if (s) try { await call(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', token: s.access_token }); } catch {}
}

// ---------- save rows ----------
/** The account's cloud save, or null. */
export async function pull() {
  if (!user()) return null;
  setStatus({ state: 'syncing' });
  try {
    const rows = await rest(`${TABLE}?select=data,rev,saved_at&user_id=eq.${user().id}`);
    setStatus({ state: 'ok', last: Date.now(), error: '' });
    return rows && rows[0] ? rows[0] : null;
  } catch (e) { fail(e); throw e; }
}

/**
 * Upload. Only succeeds if nobody else saved since our last sync (rev check).
 * Returns { ok: true } or { conflict: row } with the newer cloud save.
 */
export async function push(state, { keepalive = false } = {}) {
  const u = user();
  if (!u) return { ok: false };
  const m = syncMeta();
  const data = JSON.parse(state);
  const rev = m.rev + 1;
  setStatus({ state: 'syncing' });
  try {
    let rows;
    if (!m.rev) {
      // first upload from this device: insert, or fail if a save already exists
      try {
        rows = await rest(`${TABLE}`, { method: 'POST', prefer: 'return=representation', keepalive,
          body: { user_id: u.id, data, rev, saved_at: new Date(data.savedAt).toISOString() } });
      } catch (e) {
        if (e.status === 409 || e.code === '23505') { const row = await pull(); return { conflict: row }; }
        throw e;
      }
    } else {
      rows = await rest(`${TABLE}?user_id=eq.${u.id}&rev=eq.${m.rev}`, { method: 'PATCH', prefer: 'return=representation', keepalive,
        body: { data, rev, saved_at: new Date(data.savedAt).toISOString() } });
      if (!rows || !rows.length) { const row = await pull(); return { conflict: row }; }
    }
    setMeta({ rev, dirty: false });
    setStatus({ state: 'ok', last: Date.now(), error: '' });
    return { ok: true };
  } catch (e) { fail(e); throw e; }
}

/** Remember that this device now holds cloud revision `rev`. */
export function adopted(rev) { setMeta({ rev, dirty: false }); }

function fail(e) {
  if (e instanceof SignedOut) return;
  if (e instanceof Offline) setStatus({ state: 'offline', error: e.message });
  else setStatus({ state: 'error', error: e.message });
}

if (user()) setStatus({ state: 'ok' });
