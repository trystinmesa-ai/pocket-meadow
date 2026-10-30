// Local saving (localStorage) and the offline catch-up that runs the farm
// forward for the time you were away.
import { migrate } from './world.js';
import { step, resetPaths } from './sim.js';

// Each account keeps its own local copy, so people sharing a device never mix
// farms. Signed out, the device has its own "guest" farm.
const KEY = 'meadow.save.v1';
let owner = null;
export const setOwner = (uid) => { owner = uid || null; };
const keyFor = (uid) => (uid ? `${KEY}.u.${uid}` : KEY);
const backupKey = () => `${keyFor(owner)}.backup`;

// Runtime-only fields start with "_" (claims, busy flags) or are job objects.
export const serialize = (state) => JSON.stringify(state, (k, v) => (k[0] === '_' || k === 'job' ? undefined : v));
export const clone = (state) => JSON.parse(serialize(state));

export function saveLocal(state) {
  state.savedAt = Date.now();
  try {
    localStorage.setItem(keyFor(owner), serialize(state));
    return true;
  } catch { return false; }
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(keyFor(owner));
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function backupLocal() {
  try { const raw = localStorage.getItem(keyFor(owner)); if (raw) localStorage.setItem(backupKey(), raw); } catch {}
}
export function wipeLocal(uid = owner) {
  try { localStorage.removeItem(keyFor(uid)); } catch {}
}

/** A save file a person can download and restore later. */
export function exportSave(state) {
  return new Blob([serialize(state)], { type: 'application/json' });
}
export function parseSave(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.objects) || !Array.isArray(data.workers) || !data.map) throw new Error('That file isn’t a Pocket Meadow save.');
  return migrate(data);
}

// ---------- offline progress ----------
function snap(s) {
  return {
    coins: s.coins + s.pendingCoins, level: s.level, earned: s.stats.earned,
    harvest: { ...s.stats.harvest }, craft: { ...s.stats.craft }, sold: { ...s.stats.sold }, orders: s.orders.length,
  };
}
const diff = (a, b) => {
  const out = {};
  for (const k in b) { const d = (b[k] || 0) - (a[k] || 0); if (d > 0) out[k] = d; }
  return out;
};

/**
 * Simulate `ms` of farm time quickly. Farmhands keep working (walking is
 * timed instead of animated). Capped at the offline limit (Night Shift raises it).
 * Returns a summary of what happened.
 */
export async function catchUp(world, ms, onProgress) {
  const s = world.state;
  const cap = world.fx.offlineH * 3600 * 1000;
  const total = Math.max(0, Math.min(ms, cap));
  const before = snap(s);
  const events = [];
  world.offline = true;
  const dt = total > 4 * 3600 * 1000 ? 2 : 1;
  let t = s.simTime;
  const end = t + total;
  let n = 0, last = performance.now();
  while (t < end) {
    const d = Math.min(dt, (end - t) / 1000);
    t += d * 1000;
    step(world, d, true, t);
    if (world.events.length) { events.push(...world.events.filter((e) => e.t === 'level' || e.t === 'wlevel')); world.events.length = 0; }
    if (++n % 400 === 0 && performance.now() - last > 30) {
      onProgress?.(1 - (end - t) / Math.max(1, total));
      await new Promise((r) => setTimeout(r, 0));
      last = performance.now();
    }
  }
  world.offline = false;
  s.simTime = Date.now();
  resetPaths(world);
  const after = snap(s);
  return {
    ms: total, capped: ms > cap, capH: world.fx.offlineH,
    coins: Math.max(0, after.coins - before.coins),
    harvest: diff(before.harvest, after.harvest), craft: diff(before.craft, after.craft), sold: diff(before.sold, after.sold),
    levels: after.level - before.level, newOrders: Math.max(0, after.orders - before.orders), events,
  };
}
