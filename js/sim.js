// The farm simulation: crops, trees, animals, workshops, orders and the
// farmhands' job system. The same code runs live (with walking along real
// paths) and in fast mode for offline catch-up (walking becomes a timer).
import { DEFS, ITEMS, CROPS, ROLES, ALL_TASKS, ORDER_SLOTS, ORDER_EVERY, ORDER_NAMES, RAIN_BLOCK, RAIN_CHANCE,
  MAX_WORKER_LEVEL, workerXpNeeded, DEBRIS_EVERY, debrisMax, MAP, VILLAGERS, GIANT_CROPS, GIANT_CHANCE, GOLD_MULT,
  FISH, SPECIES_CHANCE, ANIMAL_TREASURE } from './data.js';
import { stepQuarry } from './quarry.js';
import { idx, doorTile, hash2, cropUnlocked, producingNow } from './world.js';
import { findPath } from './path.js';
import { seasonAt, festivalOn, festivalId, seasonGrowth, canPlantNow } from './seasons.js';
import { FESTIVAL_ORDER_EVERY, FESTIVAL_SLOTS, FINDS } from './data.js';
import { earn, canAffordSeeds, paySeeds } from './economy.js';

const R = Math.random;
const WALK = 2.3; // tiles per second

// ---------- small helpers ----------
// Weather comes in 20-minute blocks worked out from the time and the farm's seed.
export function weatherAt(world, tMs) {
  const block = Math.floor(tMs / 1000 / RAIN_BLOCK), seed = world.state.seed % 9973;
  const h = hash2(block, 7, seed);
  if (h < RAIN_CHANCE) return hash2(block, 13, seed) < 0.25 ? 'storm' : 'rain';
  if (seasonAt(tMs).id === 'summer' && h < RAIN_CHANCE + 0.1) return 'heat';
  if (hash2(block - 1, 7, seed) < RAIN_CHANCE && hash2(block, 17, seed) < 0.4) return 'rainbow';
  return 'clear';
}
export function isRaining(world, tMs) { const w = weatherAt(world, tMs); return w === 'rain' || w === 'storm'; }
/** Can this field plot grow its crop right now? (seasonal crops only in their season; greenhouse beds grow anything) */
export const plantable = (world, p, crop = p.crop) => canPlantNow(crop, world.season);

export const animalCount = (a) => DEFS[a.type].animal.count + (a.lvl - 1);
export const animalCap = (a) => 6 + 4 * a.lvl;
export const feedCap = (a) => 8 + 6 * a.lvl;
export const hiveCap = (h) => DEFS[h.type].hive.cap + 2 * (h.lvl - 1);
export const hiveRate = (h) => (h.type === 'beehive' ? 1 + Math.min(1, 0.1 * (h._flowers || 0)) : 1) * (1 + 0.25 * (h.lvl - 1));
export const outCap = (b) => 4 + 3 * b.lvl;
// each product has its own space in the output tray, so a pile of flour waiting
// for pickup never stops the mill making sugar
export const outFull = (b, item) => (b.out[item] || 0) >= outCap(b);
export const outTotal = (b) => { let n = 0; for (const k in b.out) n += b.out[k]; return n; };

export function recipesFor(state, b) {
  return DEFS[b.type].recipes.filter((r) => (r.level || DEFS[b.type].level) <= state.level);
}

// ---------- workshop pantries ----------
// Each workshop keeps its own ingredients, so they don't crowd the barn.
// Haulers keep a share of every ingredient its recipes use; the recipe being
// made gets at least two batches' worth. Upgrading the pantry holds more.
export const PANTRY = [12, 24, 40, 60, 90];
export const pantryCap = (b) => PANTRY[(b.pl || 1) - 1];
export const pantryUsed = (b) => { let n = 0; for (const k in b.inp) n += b.inp[k]; return n; };
export function pantryItems(state, b) {
  if (b._pi && b._piL === state.level) return b._pi;
  const set = new Set();
  for (const r of recipesFor(state, b)) for (const k in r.in) set.add(k);
  b._piL = state.level;
  return (b._pi = [...set]);
}
/** How many more of an item a workshop's pantry wants right now. */
export function pantryWant(world, b, k, r = curRecipe(world, b)) {
  if (b.off) return 0;
  const items = pantryItems(world.state, b);
  if (!items.includes(k)) return 0;
  const cap = pantryCap(b), have = b.inp[k] || 0;
  const cur = r && r.in[k] ? r.in[k] : 0;
  // room is shared between the ingredients the farm has or is growing, even before the first one arrives
  const stocked = items.filter((x) => b.inp[x] || onFarm(world, x) > 0 || world.producing?.has(x)).length || 1;
  const share = Math.floor(cap / stocked);
  const want = Math.max(share, cur * 2) - have;
  if (want <= 0) return 0;
  // stock over its own share doesn't crowd others out (it gets used up first)
  let used = 0;
  for (const x in b.inp) used += x === k ? b.inp[x] : Math.min(b.inp[x], Math.max(share, r && r.in[x] ? r.in[x] * 2 : 0));
  // one batch of the current recipe always fits, so a full pantry can't stall it
  return Math.max(Math.max(0, cur - have), Math.min(want, cap - used));
}
const recipeValueGain = (r) => {
  let v = 0; for (const k in r.in) v += ITEMS[k].value * r.in[k];
  return (ITEMS[r.out].value - v) / r.time;
};
// Goods waiting to be picked up: in a workshop, coop or hive, or in a pile on the ground.
function waiting(world, o, k) {
  if (o.item) return o.item === k ? o.qty : 0;
  if (DEFS[o.type].recipes) return o.out[k] || 0;
  const d = DEFS[o.type], item = d.hive ? d.hive.item : d.animal ? d.animal.item : null;
  return item === k ? o.out : 0;
}
function takeWaiting(world, o, k, n) {
  if (o.item) {
    const piles = world.state.piles;
    if (!piles.includes(o) || o.item !== k) return 0;
    const t = Math.min(n, o.qty);
    o.qty -= t;
    if (o.qty <= 0) piles.splice(piles.indexOf(o), 1);
    return t;
  }
  if (typeof o.out === 'number') { const t = Math.min(n, o.out); o.out -= t; return t; }
  const t = Math.min(n, o.out[k] || 0);
  o.out[k] -= t; if (!o.out[k]) delete o.out[k];
  return t;
}
const sourcesOf = (world, k) => world.bldgs.concat(world.animals, world.hives).filter((o) => !o._cc && waiting(world, o, k) > 0)
  .concat(world.state.piles.filter((p) => !p._c && p.item === k));
// Pantry stock another building can spare: everything in a switched-off workshop,
// and (when it's for a recipe being made) whatever a workshop isn't using right now.
const usesNow = (b, k) => { const r = DEFS[b.type].recipes.find((x) => x.out === b.cur); return !!(r && r.in[k]); };
const spareIn = (b, k, forCur) => (b._cp || !b.inp[k] ? 0 : b.off ? b.inp[k] : forCur && !usesNow(b, k) ? b.inp[k] : 0);
const pantrySources = (world, k, target, forCur) => world.bldgs.filter((b) => b !== target && spareIn(b, k, forCur) > 0);
/** Everything on the farm a workshop could use: storage plus goods waiting elsewhere. */
// Counted once per tick: it's only a guide, the real take checks actual amounts.
function waitingAll(world) {
  if (world._wait && world._waitT === world.time) return world._wait;
  const m = {};
  for (const o of world.bldgs) {
    if (!o._cc) for (const k in o.out) m[k] = (m[k] || 0) + o.out[k];
    if (o.off && !o._cp) for (const k in o.inp) m[k] = (m[k] || 0) + o.inp[k];
  }
  for (const o of world.animals.concat(world.hives)) {
    if (o._cc || !o.out) continue;
    const d = DEFS[o.type], k = d.hive ? d.hive.item : d.animal.item;
    m[k] = (m[k] || 0) + o.out;
  }
  for (const p of world.state.piles) if (!p._c) m[p.item] = (m[p.item] || 0) + p.qty;
  world._waitT = world.time; world._wait = m;
  return m;
}
function onFarm(world, k, except) {
  return world.have(k) + (waitingAll(world)[k] || 0) - (except && !except._cc ? waiting(world, except, k) : 0);
}
/**
 * The ingredient this recipe would take from a prioritized order, if any.
 * It's fine when the order needs what the recipe makes (wheat into wanted flour).
 */
export function savedForOrder(world, r) {
  const o = world.priorityOrder();
  if (!o || world.orderShort(r.out) > 0) return null;
  for (const k in r.in) { const n = world.orderNeed(k); if (n && world.haveAll(k) - r.in[k] < n) return k; }
  return null;
}
/** Is there somewhere to put this item right now: the barn's fair share, or a workshop pantry that wants it? */
export function canStore(world, item) {
  if (world._csT !== world.time) { world._csT = world.time; world._cs = new Map(); }
  if (world._cs.has(item)) return world._cs.get(item);
  const ok = world.roomFor(item) > 0 || world.bldgs.some((b) => !b._cs && pantryWant(world, b, item) > 0);
  world._cs.set(item, ok);
  return ok;
}
function feasible(world, b, r) {
  for (const k in r.in) if ((b.inp[k] || 0) + onFarm(world, k, b) < r.in[k]) return false;
  return true;
}
const hasInputs = (b, r) => { for (const k in r.in) if ((b.inp[k] || 0) < r.in[k]) return false; return true; };

// Switch a workshop to a recipe; inputs it no longer needs go back to storage.
function switchRecipe(world, b, r) {
  b.cur = r ? r.out : null;
  const keep = pantryItems(world.state, b);
  for (const k of Object.keys(b.inp)) {
    if ((r && r.in[k]) || keep.includes(k)) continue;
    const back = world.addItem(k, b.inp[k]);
    b.inp[k] -= back;
    if (!b.inp[k]) delete b.inp[k];
  }
}

/** The recipe a workshop is currently making (choosing one when on auto). */
export function curRecipe(world, b) {
  const list = recipesFor(world.state, b);
  if (b.prog > 0 && b.batch) return list.find((r) => r.out === b.batch) || DEFS[b.type].recipes.find((r) => r.out === b.batch);
  // a prioritized order comes first: make what it needs (even over a chosen recipe), then go back
  const pw = world.priorityWanted();
  if (pw && pw.size) {
    const pr = list.find((r) => pw.has(r.out) && (hasInputs(b, r) || feasible(world, b, r)));
    if (pr) { if (b.cur !== pr.out) switchRecipe(world, b, pr); return pr; }
  }
  if (b.recipe !== 'auto') {
    const r = list.find((x) => x.out === b.recipe) || null;
    if (b.cur !== (r && r.out)) switchRecipe(world, b, r);
    return r;
  }
  const cur = list.find((r) => r.out === b.cur);
  if (pantryUsed(b) > pantryCap(b)) {
    // over-full (one ingredient has more than its share): make something that uses it up
    const top = Object.keys(b.inp).sort((a, c) => b.inp[c] - b.inp[a])[0];
    const drain = list.find((r) => r.in[top] && hasInputs(b, r));
    if (drain) { if (drain !== cur) switchRecipe(world, b, drain); return drain; }
  }
  // saving an ingredient for a prioritized order: make something else in the meantime
  if (cur && savedForOrder(world, cur)) {
    const alt = list.find((r) => hasInputs(b, r) && !savedForOrder(world, r));
    if (alt) { switchRecipe(world, b, alt); return alt; }
  }
  if (cur && (hasInputs(b, cur) || feasible(world, b, cur))) return cur;
  let best = null;
  for (const r of list) if (feasible(world, b, r) && (!best || recipeValueGain(r) > recipeValueGain(best))) best = r;
  if (best && best !== cur) switchRecipe(world, b, best);
  return best || cur || null;
}

export function craftTime(world, b, r, w) {
  return r.time / ((1 + 0.2 * (b.lvl - 1)) * world.fx.craft * (w ? 1 + 0.05 * (w.lvl - 1) : 1));
}

// ---------- main step ----------
export function step(world, dt, fast, now) {
  const s = world.state;
  const fx = world.fx;
  world.time = (world.time || 0) + dt;
  world.now = now;
  world.fast = fast;
  world.weather = weatherAt(world, now);
  const rain = world.weather === 'rain' || world.weather === 'storm';
  world.season = seasonAt(now);
  world.festival = festivalOn(now);
  world.raining = rain;
  const heat = world.weather === 'heat';
  world.producing = producingNow(world);

  let ripe = 0, empty = 0, dry = 0;
  for (const p of world.plots) {
    if (p.st === 'grow') {
      if (!p.wet && (rain || world.sprinkled.has(idx(p.x, p.y)))) p.wet = true;
      // heat waves slow crops that aren't watered
      p.p += (dt / CROPS[p.crop].time) * fx.grow * (p.wet ? fx.water : heat ? 0.75 : 1) * seasonGrowth(p.crop, world.season);
      if (p.p >= 1) { p.p = 1; p.st = 'ripe'; if (GIANT_CROPS.has(p.crop)) tryGiant(world, p); }
      else if (!p.wet && p.p < 0.75) dry++;
    }
    if (p.st === 'ripe') ripe++;
    else if (p.st === 'empty') empty++;
  }
  // greenhouse beds: any season, always watered, no weather
  let ghWork = 0;
  for (const g of world.greenhouses) {
    for (const b of g.beds) if (b.st === 'grow') { b.p += (dt / CROPS[b.crop].time) * fx.grow * fx.water; if (b.p >= 1) { b.p = 1; b.st = 'ripe'; } }
    if (!g._cg && ghTasks(world, g).length) ghWork++;
  }
  let ripeTrees = 0;
  for (const t of world.trees) {
    if (t.p < 1) t.p = Math.min(1, t.p + (dt / DEFS[t.type].time) * fx.grow);
    else ripeTrees++;
  }
  let feedNeed = 0, animalOut = 0;
  for (const a of world.animals) {
    const A = DEFS[a.type].animal, cap = animalCap(a);
    if (a.off) { if (a.out > 0) animalOut++; continue; }
    // fed animals slowly grow happier (to 60 on their own; pats take them higher), hungry ones less so
    a.joy = Math.max(0, Math.min(100, (a.joy ?? 30) + (a.feed > 0 ? (a.joy < 60 ? dt / 120 : 0) : -dt / 60)));
    if (a.feed > 0 && a.out < cap) {
      a.prog += (dt * animalCount(a) * fx.animal * (1 + 0.25 * a.joy / 100)) / A.time;
      while (a.prog >= 1 && a.feed > 0 && a.out < cap) {
        a.prog -= 1; a.feed--; a.out++;
        s.stats.harvest[A.item] = (s.stats.harvest[A.item] || 0) + 1;
        // a very happy animal now and then gives a treasure, straight to storage
        const tr = ANIMAL_TREASURE[a.type];
        if (tr && R() < 0.04 * (a.joy / 100) ** 2 && world.addItem(tr, 1)) { s.stats.harvest[tr] = (s.stats.harvest[tr] || 0) + 1; world.events.push({ t: 'treasure', item: tr, x: a.x, y: a.y }); }
      }
      if (a.feed <= 0 || a.out >= cap) a.prog = Math.min(a.prog, 0.99);
    }
    if (a.feed < feedCap(a) - 2) feedNeed++;
    if (a.out > 0) animalOut++;
  }
  for (const h of world.hives) {
    if (!h.off && h.out < hiveCap(h)) {
      const H = DEFS[h.type].hive;
      h.prog += (dt * fx.animal * hiveRate(h)) / H.time;
      if (h.prog >= 1) {
        h.prog -= 1;
        // docks sometimes land a special fish, which goes straight to storage
        const sp = H.item === 'fish' && R() < SPECIES_CHANCE ? pickFish(world, world.now) : null;
        if (sp && world.addItem(sp, 1)) { s.stats.harvest[sp] = (s.stats.harvest[sp] || 0) + 1; world.events.push({ t: 'catch', item: sp, x: h.x, y: h.y }); }
        else { h.out++; s.stats.harvest[H.item] = (s.stats.harvest[H.item] || 0) + 1; }
      }
    }
    if (h.out > 0) animalOut++;
  }
  let pileQty = 0;
  for (const p of s.piles) pileQty += p.qty;
  world.pileQty = pileQty;
  world.avail = { ripe, empty, dry, ripeTrees, feedNeed, animalOut, piles: s.piles.length, gh: ghWork };

  ordersTick(world, now);
  festivalTick(world, now);
  world.hauler = s.workers.some((w) => w.role === 'hauler');
  world.artisan = s.workers.some((w) => w.role === 'artisan');
  buildTick(world, dt);
  debrisTick(world, dt);
  world.avail.sites = world.sites.length;
  world.avail.debris = world.debris.length;
  for (const w of s.workers) if (w.role !== 'miner') updateWorker(world, w, dt, fast);
  stepQuarry(world, dt);

  s.simTime = now;
}

/** Which special fish bites now: depends on season, weather and the hour. */
export function pickFish(world, now) {
  const hr = new Date(now || Date.now()).getHours(), night = hr >= 20 || hr < 5;
  const ok = FISH.filter((f) => (!f.seasons || f.seasons.includes(world.season.id)) && (!f.night || night) && (!f.weather || f.weather.includes(world.weather)));
  let r = R() * ok.reduce((a, f) => a + f.w, 0);
  for (const f of ok) { if ((r -= f.w) < 0) return f.id; }
  return ok[0]?.id || null;
}

// ---------- construction & debris ----------
function buildTick(world, dt) {
  let done = false;
  for (const o of world.sites) {
    o.build -= dt;
    if (o.build <= 0) { delete o.build; delete o.buildT; delete o.paid; done = true; world.events.push({ t: 'built', o }); }
  }
  if (done) world.rebuild();
}
// Now and then a branch or rock turns up on open land (never next to an entrance).
function debrisTick(world, dt) {
  const s = world.state;
  const storm = world.weather === 'storm';
  s.debrisT = (s.debrisT || 0) + dt;
  if (s.debrisT < (storm ? DEBRIS_EVERY / 4 : DEBRIS_EVERY)) return;
  s.debrisT = 0;
  const parcels = s.map.owned.filter(Boolean).length;
  if (world.debris.length >= debrisMax(parcels) + (storm ? 3 : 0)) return;
  const roll = R();
  const type = roll < 0.5 ? 'rubble_log' : roll < 0.88 || s.level < DEFS.rubble_ore.level ? 'rubble_rock' : 'rubble_ore';
  const own = [];
  s.map.owned.forEach((v, i) => { if (v) own.push(i); });
  const PWn = MAP.w / MAP.parcel;
  for (let tries = 0; tries < 40; tries++) {
    const p = own[Math.floor(R() * own.length)];
    const x = (p % PWn) * MAP.parcel + Math.floor(R() * MAP.parcel), y = Math.floor(p / PWn) * MAP.parcel + Math.floor(R() * MAP.parcel);
    if (world.canPlace(type, x, y)) continue;
    let ok = true;
    for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) {
      const o = world.objAt(x + dx, y + dy);
      if (world.doors.has(idx(x + dx, y + dy)) || (o && DEFS[o.type].cat === 'debris')) { ok = false; break; }
    }
    if (!ok) continue;
    s.objects.push({ id: s.nextId++, type, x, y });
    world.rebuild();
    world.events.push({ t: 'debris', type });
    return;
  }
}

// ---------- orders ----------
function ordersTick(world, now) {
  const s = world.state;
  const slots = world.fx.orderSlots;
  if (s.orders.length >= slots) { if (now > s.nextOrderAt) s.nextOrderAt = now + 60 * 1000; return; }
  let guard = 0;
  while (s.orders.length < slots && now >= s.nextOrderAt && guard++ < 5) {
    const o = makeOrder(world);
    if (!o) { s.nextOrderAt = now + 60 * 1000; return; }
    s.orders.push(o);
    s.nextOrderAt += ORDER_EVERY * 1000;
    if (s.nextOrderAt < now - ORDER_EVERY * 1000 * slots) s.nextOrderAt = now;
  }
}

/** Items this farm can currently make, used for orders. */
export function producible(world) {
  const s = world.state, out = new Set();
  for (const c in CROPS) if (cropUnlocked(s, c) && (!CROPS[c].season || CROPS[c].season === world.season?.id)) out.add(c);
  for (const g of world.greenhouses) for (const b of g.beds) if (b.crop) out.add(b.crop);
  for (const t of world.trees) out.add(DEFS[t.type].fruit);
  for (const a of world.animals) out.add(DEFS[a.type].animal.item);
  for (const h of world.hives) out.add(DEFS[h.type].hive.item);
  for (const b of world.bldgs) for (const r of recipesFor(s, b)) out.add(r.out);
  return [...out];
}

// ---------- festivals ----------
function festivalTick(world, now) {
  const s = world.state;
  if (!world.festival) return;
  const id = festivalId(now);
  if (!s.fest || s.fest.id !== id) s.fest = { id, orders: [], next: now };
  let guard = 0;
  while (s.fest.orders.length < FESTIVAL_SLOTS && now >= s.fest.next && guard++ < 4) {
    const o = makeOrder(world, 2.2);
    if (!o) break;
    o.ribbons = Math.round((3 + Math.floor(R() * 3) + o.items.length) * world.fx.ribbons);
    o.festival = true;
    s.fest.orders.push(o);
    s.fest.next = s.fest.orders.length < FESTIVAL_SLOTS ? now : now + FESTIVAL_ORDER_EVERY * 1000;
  }
  if (s.fest.orders.length >= FESTIVAL_SLOTS) s.fest.next = Math.max(s.fest.next, now);
}

export const FIND_ORDER_CHANCE = 0.2;
function findForOrder(world) {
  const s = world.state;
  if (!s.quarry || R() >= FIND_ORDER_CHANCE) return null;
  const owned = Object.keys(s.finds || {}).filter((k) => s.finds[k] > 0);
  const dig = FINDS.slice(0, s.quarry.zones || 1).flat();
  const pool = owned.length && R() < 0.75 ? owned : dig;
  if (!pool.length) return null;
  const k = pool[Math.floor(R() * pool.length)];
  return { item: k, qty: Math.max(1, Math.min(2, s.finds[k] || 1)) };
}
export function makeOrder(world, scale = 1) {
  const s = world.state;
  const pool = producible(world);
  if (!pool.length) return null;
  const n = Math.min(pool.length, 1 + Math.floor(R() * Math.min(3, 1 + s.level / 3)));
  const picks = [];
  // most orders come from a neighbour asking for something they love
  const who = VILLAGERS[Math.floor(R() * VILLAGERS.length)];
  const loved = who.likes.filter((k) => pool.includes(k)).sort(() => R() - 0.5);
  const shuffled = (R() < 0.6 ? loved.slice(0, Math.max(1, n - 1)) : []).concat(pool.slice().sort(() => R() - 0.5));
  for (const it of shuffled) { if (picks.length >= n) break; if (!picks.includes(it)) picks.push(it); }
  const budget = 30 * Math.pow(1.5, s.level) * scale;
  const items = picks.map((it) => ({ item: it, qty: Math.max(1, Math.min(60, Math.round((budget / picks.length) / ITEMS[it].value * (0.7 + R() * 0.6)))) }));
  // now and then a neighbour also asks for something dug up in the quarry:
  // one you already have, or one your open quarry zones can turn up
  const f = findForOrder(world);
  if (f) items.push(f);
  const value = items.reduce((v, x) => v + ITEMS[x.item].value * x.qty, 0);
  return {
    id: s.nextId++, from: who.name, who: who.id, items,
    reward: Math.round(value * (1.6 + R() * 0.5) * world.fx.orderPay), xp: Math.round(value * 0.6),
  };
}

// ---------- farmhands ----------
const wSpeed = (world, w, tile) => WALK * world.fx.walk * (1 + 0.04 * (w.lvl - 1)) * tile;
const wDur = (world, w, base) => base / (world.fx.work * (1 + 0.05 * (w.lvl - 1)));
const wx = (w) => Math.floor(w.x), wy = (w) => Math.floor(w.y);
export const minerSpeed = (world, w) => wSpeed(world, w, 1);
export const minerDur = (world, w, base) => wDur(world, w, base) / world.fx.mine;
const manhattan = (w, x, y) => Math.abs(w.x - 0.5 - x) + Math.abs(w.y - 0.5 - y);

function nearest(list, w, ok) {
  let best = null, bd = Infinity;
  for (const o of list) {
    if (!ok(o)) continue;
    const d = manhattan(w, o.x, o.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
const bad = (world, o) => o._bad && o._bad > world.time;

// The tile beside an object where a farmhand stands to use it.
export function accessTile(world, o) {
  const d = DEFS[o.type];
  if (d.walk) return [o.x, o.y];
  if (d.door) return doorTile(o);
  const cands = [[o.x, o.y + d.h], [o.x - 1, o.y], [o.x + d.w, o.y], [o.x, o.y - 1]];
  for (const c of cands) if (world.walkable(c[0], c[1])) return c;
  return cands[0];
}

function nearestStorage(world, w) {
  let best = null, bd = Infinity;
  for (const st of world.storages) {
    if (bad(world, st)) continue;
    const [x, y] = doorTile(st);
    const d = manhattan(w, x, y);
    if (d < bd) { bd = d; best = st; }
  }
  return best;
}

class Job {
  constructor(w, kind, act) { this.w = w; this.kind = kind; this.act = act; this.steps = []; this.i = 0; this.claims = []; this.refs = new Set(); }
  claim(o, key) { o[key] = this.w.id; this.claims.push([o, key]); this.refs.add(o.id); return this; }
  go(x, y, ref) { this.steps.push({ t: 'go', x, y, ref }); return this; }
  do(anim, dur, fx, tool) { this.steps.push({ t: 'do', anim, dur, fx, tool }); return this; }
  release() { for (const [o, k] of this.claims) if (o[k] === this.w.id) delete o[k]; this.claims = []; }
}

export function addXp(world, w, n) {
  if (w.lvl >= MAX_WORKER_LEVEL) return;
  w.xp += n * world.fx.xp;
  while (w.lvl < MAX_WORKER_LEVEL && w.xp >= workerXpNeeded(w.lvl)) {
    w.xp -= workerXpNeeded(w.lvl); w.lvl++;
    world.events.push({ t: 'wlevel', w });
  }
}

function setCarry(w, item, qty) {
  if (qty <= 0) return;
  if (w.carry && w.carry.item === item) w.carry.qty += qty;
  else w.carry = { item, qty };
}

export function dropPile(world, w, x, y) {
  if (!w.carry) return;
  const s = world.state;
  const p = s.piles.find((q) => q.x === x && q.y === y && q.item === w.carry.item);
  if (p) p.qty += w.carry.qty;
  else s.piles.push({ id: s.nextId++, x, y, item: w.carry.item, qty: w.carry.qty });
  w.carry = null;
}

function float(world, x, y, text, item) {
  if (!world.fast) world.events.push({ t: 'float', x, y, text, item });
}

// Steps that take whatever the farmhand carries to storage (resolved when reached).
function deliver(job, allowPile) {
  job.steps.push({ t: 'deliver', allowPile });
  return job;
}

function resolveDeliver(world, w, job, s) {
  job.steps.splice(job.i, 1);
  if (!w.carry) return;
  if (s.allowPile && world.hauler && w.role !== 'hauler') {
    job.steps.splice(job.i, 0, { t: 'do', anim: 'drop', dur: 0.4, fx: () => dropPile(world, w, wx(w), wy(w)) });
    return;
  }
  const pb = nearest(world.bldgs, w, (o) => !o._cs && !bad(world, o) && pantryWant(world, o, w.carry.item) > 0);
  if (pb) {
    const [px, py] = doorTile(pb);
    job.steps.splice(job.i, 0, { t: 'go', x: px, y: py, ref: pb.id }, {
      t: 'do', anim: 'deposit', dur: 0.5, fx: () => {
        const c = w.carry; if (!c) return;
        const q = Math.min(c.qty, pantryWant(world, pb, c.item));
        if (q > 0) { pb.inp[c.item] = (pb.inp[c.item] || 0) + q; c.qty -= q; float(world, px, py - 1, `+${q}`, c.item); }
        if (c.qty <= 0) w.carry = null;
        else job.steps.splice(job.i, 0, { t: 'deliver', allowPile: false }); // the rest goes on to storage
      },
    });
    return;
  }
  const st = nearestStorage(world, w);
  if (!st) {
    job.steps.splice(job.i, 0, { t: 'do', anim: 'drop', dur: 0.4, fx: () => dropPile(world, w, wx(w), wy(w)) });
    return;
  }
  const [x, y] = doorTile(st);
  job.steps.splice(job.i, 0, { t: 'go', x, y, ref: st.id }, {
    t: 'do', anim: 'deposit', dur: 0.5, fx: () => {
      const c = w.carry; if (!c) return;
      const put = world.addItem(c.item, Math.min(c.qty, world.roomFor(c.item)));
      c.qty -= put;
      if (put) float(world, x, y - 1, `+${put}`, c.item);
      if (c.qty <= 0) w.carry = null;
      else { dropPile(world, w, x, y); world.events.push({ t: 'full', item: c.item }); }
    },
  });
}

// ---------- job finders ----------
// During the priority pass (see assignJob) world._want holds what a prioritized
// order needs, and the gathering jobs below only take those items.
const wanted = (world, item) => !world._want || world._want.has(item);
const FIND = {
  harvest(world, w) {
    if (!world.avail.ripe) return null;
    // a crop with no room waits ripe in its field, so slower crops still get their space
    const ready = (o) => o.st === 'ripe' && !o._c && !bad(world, o) && wanted(world, o.crop) && canStore(world, o.crop);
    // crops a prioritized order still needs (or that go into what it needs) come first
    const pw = world.priorityWanted();
    const p = (pw && nearest(world.plots, w, (o) => ready(o) && pw.has(o.crop))) || nearest(world.plots, w, ready);
    if (!p) return null;
    const job = new Job(w, 'harvest', `Harvesting ${ITEMS[p.crop].name}`);
    harvestSteps(world, w, job, p);
    return job;
  },
  plant(world, w) {
    if (!world.avail.empty) return null;
    const s = world.state;
    const p = nearest(world.plots, w, (o) => o.st === 'empty' && o.crop && !o._c && !bad(world, o) && cropUnlocked(s, o.crop) && plantable(world, o) && canAffordSeeds(world, o.crop));
    if (!p) return null;
    const job = new Job(w, 'plant', `Planting ${ITEMS[p.crop].name}`).claim(p, '_c');
    job.go(p.x, p.y, p.id).do('hoe', wDur(world, w, 1.0), () => {
      if (p.st !== 'empty' || !paySeeds(world, p.crop)) return;
      p.st = 'grow'; p.p = 0; p.wet = world.raining || world.sprinkled.has(idx(p.x, p.y));
      addXp(world, w, 1);
    }, 'hoe');
    return job;
  },
  water(world, w) {
    if (!world.avail.dry || !world.wells.length) return null;
    const well = nearest(world.wells, w, (o) => !bad(world, o));
    if (!well) return null;
    const [wxT, wyT] = doorTile(well);
    const job = new Job(w, 'water', 'Watering crops');
    const targets = [];
    let px = wxT, py = wyT;
    const can = 4 + Math.floor(world.fx.carry / 2);
    for (let k = 0; k < can; k++) {
      let best = null, bd = 12;
      for (const p of world.plots) {
        if (p.st !== 'grow' || p.wet || p._w || p.p > 0.75 || targets.includes(p)) continue;
        const d = Math.abs(p.x - px) + Math.abs(p.y - py);
        if (d < bd) { bd = d; best = p; }
      }
      if (!best) break;
      targets.push(best); px = best.x; py = best.y;
    }
    if (!targets.length) return null;
    for (const p of targets) job.claim(p, '_w');
    job.go(wxT, wyT, well.id).do('fill', wDur(world, w, 1.0), null, 'can');
    for (const p of targets) {
      job.go(p.x, p.y, p.id).do('water', wDur(world, w, 0.7), () => {
        if (p.st === 'grow') { p.wet = true; addXp(world, w, 1); if (!world.fast) world.events.push({ t: 'splash', x: p.x, y: p.y }); }
      }, 'can');
    }
    return job;
  },
  pickTree(world, w) {
    if (!world.avail.ripeTrees) return null;
    const t = nearest(world.trees, w, (o) => o.p >= 1 && !o._c && !bad(world, o) && wanted(world, DEFS[o.type].fruit) && canStore(world, DEFS[o.type].fruit));
    if (!t) return null;
    const [ax, ay] = accessTile(world, t);
    const d = DEFS[t.type];
    const job = new Job(w, 'pickTree', `Picking ${ITEMS[d.fruit].name}s`).claim(t, '_c');
    job.go(ax, ay, t.id).do('pick', wDur(world, w, 1.6), () => {
      if (t.p < 1) return;
      t.p = 0;
      let n = d.yield + (R() < world.fx.bumper ? 1 : 0);
      world.state.stats.harvest[d.fruit] = (world.state.stats.harvest[d.fruit] || 0) + n;
      float(world, t.x, t.y - 1, `+${n}`, d.fruit);
      const take = Math.min(n, world.fx.carry);
      setCarry(w, d.fruit, take);
      if (n > take) { const keep = w.carry; w.carry = { item: d.fruit, qty: n - take }; dropPile(world, w, ax, ay); w.carry = keep; }
      addXp(world, w, 2);
    }, 'basket');
    return deliver(job, true);
  },
  haulPile(world, w) {
    if (!world.avail.piles) return null;
    const p = nearest(world.state.piles, w, (o) => !o._c && !bad(world, o) && wanted(world, o.item) && canStore(world, o.item));
    if (!p) return null;
    const job = new Job(w, 'haulPile', `Carrying ${ITEMS[p.item].name}`).claim(p, '_c');
    pickupPileSteps(world, w, job, p);
    return deliver(job, false);
  },
  collect(world, w) {
    if (world.free() <= 0 && !world.bldgs.length) return null;
    const cap = world.fx.carry;
    const b = nearest(world.bldgs, w, (o) => {
      if (o._cc || bad(world, o)) return false;
      if (!Object.keys(o.out).some((k) => wanted(world, k) && canStore(world, k))) return false;
      if (world._want) return true; // a prioritized item: fetch it right away
      const n = outTotal(o);
      return n >= Math.min(cap, 2) || (n > 0 && (o.prog <= 0 || n >= outCap(o)));
    });
    if (!b) return null;
    const [x, y] = doorTile(b);
    const job = new Job(w, 'collect', `Collecting from the ${DEFS[b.type].name}`).claim(b, '_cc');
    job.go(x, y, b.id).do('load', wDur(world, w, 0.6), () => {
      let item = null;
      const pw = world.priorityWanted();
      for (const k in b.out) if (canStore(world, k) && (!item || (pw && pw.has(k)) > (pw && pw.has(item)) || ((pw && pw.has(k)) === (pw && pw.has(item)) && b.out[k] > b.out[item]))) item = k;
      if (!item) return;
      const take = Math.min(world.fx.carry, b.out[item]);
      b.out[item] -= take; if (!b.out[item]) delete b.out[item];
      setCarry(w, item, take);
      addXp(world, w, 1);
    }, 'basket');
    return deliver(job, false);
  },
  supply(world, w) {
    const cand = [];
    for (const b of world.bldgs) {
      if (b.off || b._cs || bad(world, b)) continue;
      const r = curRecipe(world, b);
      let need = null, deficit = 0, best = 0;
      for (const k of pantryItems(world.state, b)) {
        const want = pantryWant(world, b, k, r);
        const score = want + (r && r.in[k] ? 1000 : 0); // the recipe being made comes first
        if (want > 0 && score > best && (onFarm(world, k, b) > 0 || (r && r.in[k] && pantrySources(world, k, b, true).length))) { best = score; deficit = want; need = k; }
      }
      if (need) cand.push({ b, item: need, deficit, cur: !!(r && r.in[need]), x: b.x, y: b.y });
    }
    const c = nearest(cand, w, () => true);
    if (!c) return null;
    // nothing in storage: carry it straight from where it was made (works with a full barn)
    // (or from another workshop's pantry that can spare it)
    if (!world.have(c.item)) {
      const pan = pantrySources(world, c.item, c.b, c.cur);
      const src = nearest(sourcesOf(world, c.item).filter((o) => o !== c.b).concat(pan), w, () => true);
      if (!src) return null;
      return directJob(world, w, src, c.b, c.item, c.deficit, `Bringing ${ITEMS[c.item].name} to the ${DEFS[c.b.type].name}`,
        (q) => { c.b.inp[c.item] = (c.b.inp[c.item] || 0) + q; }, pan.includes(src));
    }
    return supplyJob(world, w, c.b, c.item, c.deficit, '_cs', `Bringing ${ITEMS[c.item].name} to the ${DEFS[c.b.type].name}`,
      (q) => { c.b.inp[c.item] = (c.b.inp[c.item] || 0) + q; });
  },
  feed(world, w) {
    if (!world.avail.feedNeed) return null;
    const a = nearest(world.animals, w, (o) => !o.off && !o._cs && !bad(world, o) && o.feed < feedCap(o) - 2 && onFarm(world, DEFS[o.type].animal.feed) > 0
      && !savedForOrder(world, { in: { [DEFS[o.type].animal.feed]: 1 }, out: DEFS[o.type].animal.item }));
    if (!a) return null;
    const A = DEFS[a.type].animal;
    if (!world.have(A.feed)) {
      const pan = pantrySources(world, A.feed, null, false);
      const src = nearest(sourcesOf(world, A.feed).concat(pan), w, () => true);
      return src ? directJob(world, w, src, a, A.feed, feedCap(a) - a.feed, `Feeding the ${A.kind}s`, (q) => { a.feed += q; }, pan.includes(src)) : null;
    }
    return supplyJob(world, w, a, A.feed, feedCap(a) - a.feed, '_cs', `Feeding the ${A.kind}s`, (q) => { a.feed += q; });
  },
  collectAnimal(world, w) {
    if (!world.avail.animalOut) return null;
    const cap = world.fx.carry;
    const list = world.animals.concat(world.hives);
    const a = nearest(list, w, (o) => {
      if (o._cc || bad(world, o)) return false;
      const it = DEFS[o.type].hive ? DEFS[o.type].hive.item : DEFS[o.type].animal.item;
      if (!wanted(world, it) || !canStore(world, it)) return false;
      if (world._want && o.out > 0) return true;
      const full = DEFS[o.type].hive ? hiveCap(o) : animalCap(o);
      return o.out >= Math.min(cap, full) || o.out >= full;
    });
    if (!a) return null;
    const item = DEFS[a.type].hive ? DEFS[a.type].hive.item : DEFS[a.type].animal.item;
    const [x, y] = doorTile(a);
    const job = new Job(w, 'collectAnimal', `Gathering ${ITEMS[item].name.toLowerCase()}`).claim(a, '_cc');
    job.go(x, y, a.id).do('pick', wDur(world, w, 0.9), () => {
      const take = Math.min(world.fx.carry, a.out);
      a.out -= take;
      setCarry(w, item, take);
      float(world, x, y - 1, `+${take}`, item);
      addXp(world, w, 2);
    }, 'basket');
    return deliver(job, false);
  },
  greenhouse(world, w) {
    if (!world.avail.gh) return null;
    const g = nearest(world.greenhouses, w, (o) => !o._cg && !bad(world, o) && ghTasks(world, o).length
      && (!world._want || o.beds.some((b) => b.st === 'ripe' && world._want.has(b.crop))));
    if (!g) return null;
    const [x, y] = accessTile(world, g);
    const job = new Job(w, 'greenhouse', 'Tending the Greenhouse').claim(g, '_cg');
    job.go(x, y, g.id);
    job.steps.push({ t: 'gh', g });
    return deliver(job, true);
  },
  // lend a hand on a building that's going up (each swing takes time off the wait)
  build(world, w) {
    if (!world.avail.sites) return null;
    const o = nearest(world.sites, w, (b) => !b._cb && !bad(world, b));
    if (!o) return null;
    const [x, y] = accessTile(world, o);
    const job = new Job(w, 'build', `Building the ${DEFS[o.type].name}`).claim(o, '_cb');
    job.go(x, y, o.id);
    for (let i = 0; i < 4; i++) job.do('work', wDur(world, w, 3), () => { if (o.build > 0) { o.build -= 3; addXp(world, w, 1); } }, 'hammer');
    return job;
  },
  clear(world, w) {
    if (!world.avail.debris) return null;
    const o = nearest(world.debris, w, (b) => !b._c && !bad(world, b) && Object.keys(DEFS[b.type].gives).some((k) => world.mat(k) < world.shedCap));
    if (!o) return null;
    const d = DEFS[o.type];
    const [x, y] = accessTile(world, o);
    const job = new Job(w, 'clear', `Clearing a ${d.name.toLowerCase()}`).claim(o, '_c');
    job.go(x, y, o.id).do('work', wDur(world, w, 2.5), () => {
      const s = world.state;
      if (!s.objects.includes(o)) return;
      for (const k in d.gives) { const n = world.addMat(k, d.gives[k]); if (n) float(world, o.x, o.y - 1, `+${n}`, k); }
      s.objects.splice(s.objects.indexOf(o), 1);
      world.rebuild();
      addXp(world, w, 2);
    }, o.type === 'rubble_log' ? 'axe' : 'pick');
    return job;
  },
  operate(world, w) {
    const b = nearest(world.bldgs, w, (o) => {
      if (o.off || o._co || bad(world, o)) return false;
      const r = curRecipe(world, o);
      return r && (o.prog > 0 || (!outFull(o, r.out) && hasInputs(o, r) && !savedForOrder(world, r)));
    });
    if (!b) return null;
    const [x, y] = doorTile(b);
    const job = new Job(w, 'operate', `Working in the ${DEFS[b.type].name}`).claim(b, '_co');
    job.go(x, y, b.id);
    job.steps.push({ t: 'craft', b, max: w.role === 'artisan' ? 1e9 : 2, done: 0 });
    return job;
  },
};

// When a plot ripens, a full 3x3 block of the same ripe crop around it may
// merge into a giant crop (marked on all nine plots by the corner plot's id).
export function tryGiant(world, p, chance = GIANT_CHANCE) {
  if (p.giant) return;
  for (let oy = -2; oy <= 0; oy++) for (let ox = -2; ox <= 0; ox++) {
    const block = [];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const q = world.objAt(p.x + ox + x, p.y + oy + y);
      if (q && q.type === 'plot' && q.crop === p.crop && q.st === 'ripe' && !q.giant && !q.next) block.push(q);
    }
    if (block.length < 9) continue;
    if (R() >= chance) return;
    for (const q of block) q.giant = block[0].id;
    world.events.push({ t: 'giantgrew', x: block[4].x, y: block[4].y, crop: p.crop });
    return;
  }
}

function harvestSteps(world, w, job, p) {
  job.claim(p, '_c');
  job.go(p.x, p.y, p.id).do('harvest', wDur(world, w, 1.1), () => {
    if (p.st !== 'ripe') return;
    const c = CROPS[p.crop];
    const item = p.crop;
    // a giant crop is harvested all at once and gives twice as much
    const block = p.giant ? world.plots.filter((q) => q.giant === p.giant) : [p];
    if (p.giant) { world.state.stats.giants = (world.state.stats.giants || 0) + 1; world.events.push({ t: 'giant', x: p.x, y: p.y, crop: item }); }
    let n = 0;
    for (const q of block) n += (c.yield + (R() < world.fx.bumper ? 1 : 0)) * (p.giant ? 2 : 1);
    world.state.stats.harvest[item] = (world.state.stats.harvest[item] || 0) + n;
    // now and then a gold-star one: kept on the prize shelf, worth more
    const goldP = world.fx.gold + 0.005 * (w.lvl - 1) + (p.wet ? 0.02 : 0) + (world.weather === 'rainbow' ? 0.05 : 0);
    let stars = 0;
    for (let i = 0; i < n; i++) if (R() < goldP) stars++;
    if (stars) { n -= stars; const g = world.state.gold; g[item] = (g[item] || 0) + stars; float(world, p.x, p.y - 1, `★${stars}`, item); }
    for (const q of block) if (q !== p) { delete q.giant; if (q.next) { q.crop = q.next; delete q.next; q.st = 'empty'; q.p = 0; } else if (c.regrow) { q.st = 'grow'; q.p = c.regrow; } else { q.st = 'empty'; q.p = 0; } }
    delete p.giant;
    if (n <= 0) { // every one of them came in gold-star
      if (p.next) { p.crop = p.next; delete p.next; p.st = 'empty'; p.p = 0; world.rebuild(); } else if (c.regrow) { p.st = 'grow'; p.p = c.regrow; } else { p.st = 'empty'; p.p = 0; }
      addXp(world, w, 2); return;
    }
    if (p.next) { p.crop = p.next; delete p.next; p.st = 'empty'; p.p = 0; world.rebuild(); } // switch crops after this harvest
    else if (c.regrow) { p.st = 'grow'; p.p = c.regrow; } else { p.st = 'empty'; p.p = 0; }
    p.wet = world.sprinkled.has(idx(p.x, p.y)) || world.raining;
    float(world, p.x, p.y, `+${n}`, item);
    addXp(world, w, 2);
    if (w.carry && w.carry.item !== item) {
      // shouldn't happen, but never lose items
      const keep = { item, qty: n }; dropPile(world, w, p.x, p.y); w.carry = keep;
    } else setCarry(w, item, n);
    // keep harvesting nearby ripe plots of the same crop while the basket has room
    if (w.carry.qty < world.fx.carry) {
      let next = null, bd = 4.5;
      for (const q of world.plots) {
        if (q === p || q.st !== 'ripe' || q.crop !== item || q._c) continue;
        const d = Math.abs(q.x - p.x) + Math.abs(q.y - p.y);
        if (d < bd) { bd = d; next = q; }
      }
      if (next) {
        const tail = job.steps.splice(job.i);
        harvestSteps(world, w, job, next);
        job.steps.push(...tail);
        return;
      }
    }
    if (w.carry.qty > world.fx.carry) {
      const extra = w.carry.qty - world.fx.carry;
      w.carry.qty = world.fx.carry;
      const keep = w.carry; w.carry = { item, qty: extra }; dropPile(world, w, p.x, p.y); w.carry = keep;
    }
  }, 'sickle');
  if (job.steps.length === 2) deliver(job, true);
}

function pickupPileSteps(world, w, job, p) {
  job.go(p.x, p.y, p.id).do('pick', wDur(world, w, 0.5), () => {
    const s = world.state;
    if (!s.piles.includes(p)) return;
    const room = world.fx.carry - (w.carry ? w.carry.qty : 0);
    if (w.carry && w.carry.item !== p.item) return;
    const take = Math.min(room, p.qty);
    p.qty -= take;
    setCarry(w, p.item, take);
    if (p.qty <= 0) s.piles.splice(s.piles.indexOf(p), 1);
    else delete p._c;
    addXp(world, w, 1);
    if (w.carry && w.carry.qty < world.fx.carry) {
      const next = nearest(s.piles, { x: p.x + 0.5, y: p.y + 0.5 }, (q) => q !== p && !q._c && q.item === p.item && Math.abs(q.x - p.x) + Math.abs(q.y - p.y) <= 5);
      if (next) {
        job.claim(next, '_c');
        const tail = job.steps.splice(job.i);
        pickupPileSteps(world, w, job, next);
        job.steps.push(...tail);
      }
    }
  }, 'basket');
}

function supplyJob(world, w, target, item, want, key, act, put) {
  const st = nearestStorage(world, w);
  if (!st) return null;
  const [sx, sy] = doorTile(st);
  const [tx, ty] = doorTile(target);
  const job = new Job(w, 'supply', act).claim(target, key);
  job.refs.add(target.id);
  job.go(sx, sy, st.id).do('load', wDur(world, w, 0.6), () => {
    const got = world.takeItem(item, Math.min(world.fx.carry, Math.max(1, want)));
    if (!got) { job.steps.length = job.i; return; }
    setCarry(w, item, got);
  }, 'basket');
  job.go(tx, ty, target.id).do('deposit', wDur(world, w, 0.5), () => {
    if (!w.carry || w.carry.item !== item) return;
    put(w.carry.qty);
    w.carry = null;
    addXp(world, w, 1);
  });
  return job;
}

function directJob(world, w, src, target, item, want, act, put, pantry) {
  const pile = !!src.item;
  const [sx, sy] = pile ? [src.x, src.y] : doorTile(src);
  const [tx, ty] = doorTile(target);
  const job = new Job(w, 'supply', act).claim(target, '_cs').claim(src, pile ? '_c' : pantry ? '_cp' : '_cc');
  job.refs.add(target.id);
  job.go(sx, sy, src.id).do('load', wDur(world, w, 0.6), () => {
    const n = Math.min(world.fx.carry, Math.max(1, want));
    let got;
    if (pantry) { got = Math.min(n, src.inp[item] || 0); src.inp[item] -= got; if (!src.inp[item]) delete src.inp[item]; }
    else got = takeWaiting(world, src, item, n);
    if (!got) { job.steps.length = job.i; return; }
    setCarry(w, item, got);
  }, 'basket');
  job.go(tx, ty, target.id).do('deposit', wDur(world, w, 0.5), () => {
    if (!w.carry || w.carry.item !== item) return;
    put(w.carry.qty);
    w.carry = null;
    addXp(world, w, 1);
  });
  return job;
}

function wanderJob(world, w, fast) {
  const job = new Job(w, 'idle', 'Taking a breather');
  if (fast) return job.do('idle', 4 + R() * 4);
  for (let k = 0; k < 8; k++) {
    const x = wx(w) + Math.floor(R() * 9) - 4, y = wy(w) + Math.floor(R() * 7) - 3;
    if (world.walkable(x, y)) { job.go(x, y); break; }
  }
  const pose = R() < 0.3 ? 'sit' : 'idle';
  return job.do(pose, 2.5 + R() * 4);
}

const GATHER = ['harvest', 'greenhouse', 'pickTree', 'collectAnimal', 'haulPile', 'collect'];
function assignJob(world, w, fast) {
  if (w.carry) {
    const job = new Job(w, 'deliver', `Carrying ${ITEMS[w.carry.item].name}`);
    w.job = deliver(job, false);
    return;
  }
  const own = ROLES[w.role].tasks;
  let job = null;
  // a prioritized order comes first: gather what it needs (crops, fruit, eggs,
  // workshop goods) before any other work
  const pw = world.priorityWanted();
  if (pw && pw.size) {
    world._want = pw;
    try {
      const tasks = own.concat(world.state.settings.helpers ? ALL_TASKS.filter((t) => !own.includes(t)) : []);
      for (const t of tasks) if (GATHER.includes(t) && (job = FIND[t](world, w))) break;
    } finally { world._want = null; }
  }
  if (!job) for (const t of own) if ((job = FIND[t](world, w))) break;
  if (!job && world.state.settings.helpers) {
    for (const t of ALL_TASKS) {
      if (own.includes(t)) continue;
      if ((job = FIND[t](world, w))) break;
    }
  }
  // building and clearing debris happen even with helping turned off
  if (!job) job = FIND.build(world, w) || FIND.clear(world, w);
  w.job = job || wanderJob(world, w, fast);
}

function failJob(world, w, ref) {
  const job = w.job;
  if (job) job.release();
  if (ref) { const o = world.byId.get(ref) || world.state.piles.find((p) => p.id === ref); if (o) o._bad = world.time + 15; }
  w.job = null;
  w._idleT = 0.5;
}

export function endJob(world, w) {
  if (w.job) w.job.release();
  w.job = null;
  w._hidden = false;
  delete w._in;
}

/** Stop any farmhand whose job involves this object (it was moved or removed). */
export function cancelJobsFor(world, id) {
  for (const w of world.state.workers) {
    if (w.job && w.job.refs.has(id)) endJob(world, w);
  }
}

export function updateWorker(world, w, dt, fast) {
  let guard = 0;
  while (dt > 1e-6 && guard++ < 40) {
    if (!w.job) {
      if (w._idleT > 0) { const u = Math.min(dt, w._idleT); w._idleT -= u; dt -= u; w._anim = 'idle'; continue; }
      assignJob(world, w, fast);
      continue;
    }
    const job = w.job;
    const s = job.steps[job.i];
    w._act = job.act;
    if (!s) { endJob(world, w); continue; }
    if (s.t === 'deliver') { resolveDeliver(world, w, job, s); continue; }
    if (s.t === 'go') {
      w._tool = null;
      dt = doGo(world, w, s, dt, fast);
      continue;
    }
    if (s.t === 'do') {
      if (s.left === undefined) s.left = s.dur;
      w._anim = s.anim; w._tool = s.tool || null;
      const u = Math.min(dt, s.left);
      s.left -= u; dt -= u;
      if (s.left <= 1e-6) { job.i++; if (s.fx) s.fx(); }
      continue;
    }
    if (s.t === 'craft') { dt = doCraft(world, w, s, dt); continue; }
    if (s.t === 'gh') { dt = doGreenhouse(world, w, s, dt); continue; }
    job.i++;
  }
}

function doGo(world, w, s, dt, fast) {
  w._anim = 'walk';
  if (fast) {
    if (s.left === undefined) {
      const d = Math.abs(w.x - (s.x + 0.5)) + Math.abs(w.y - (s.y + 0.5));
      s.left = (d * 1.1) / wSpeed(world, w, 1.15);
    }
    const u = Math.min(dt, s.left);
    s.left -= u; dt -= u;
    if (s.left <= 1e-6) { w.x = s.x + 0.5; w.y = s.y + 0.5; w.job.i++; }
    return dt;
  }
  if (!s.path) {
    s.path = findPath(world, wx(w), wy(w), s.x, s.y);
    s.pi = 0;
    if (!s.path) { failJob(world, w, s.ref); return dt; }
  }
  while (dt > 1e-6) {
    const tile = s.path[s.pi];
    if (!tile) {
      // settle onto the tile centre
      const tx = s.x + 0.5, ty = s.y + 0.5, d = Math.hypot(tx - w.x, ty - w.y);
      const sp = wSpeed(world, w, 1);
      if (d <= sp * dt) { w.x = tx; w.y = ty; dt -= d / sp; w.job.i++; return dt; }
      w.x += ((tx - w.x) / d) * sp * dt; w.y += ((ty - w.y) / d) * sp * dt;
      return 0;
    }
    const tx = tile[0] + 0.5, ty = tile[1] + 0.5;
    const dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy);
    if (d < 1e-5) { s.pi++; continue; }
    const sp = wSpeed(world, w, world.tileSpeed(wx(w), wy(w)));
    if (Math.abs(dx) > Math.abs(dy)) w._dir = dx > 0 ? 'r' : 'l'; else w._dir = dy > 0 ? 'd' : 'u';
    const stepLen = sp * dt;
    if (stepLen >= d) { w.x = tx; w.y = ty; dt -= d / sp; s.pi++; }
    else { w.x += (dx / d) * stepLen; w.y += (dy / d) * stepLen; dt = 0; }
  }
  return dt;
}

function doCraft(world, w, s, dt) {
  const b = s.b;
  const r = world.byId.has(b.id) ? curRecipe(world, b) : null;
  const stop = !r || s.done >= s.max || (b.prog <= 0 && (b.off || !hasInputs(b, r) || outFull(b, r.out) || savedForOrder(world, r)));
  if (stop) { w._hidden = false; b._busy = false; w.job.i++; return dt; }
  if (b.prog <= 0) {
    for (const k in r.in) { b.inp[k] -= r.in[k]; if (!b.inp[k]) delete b.inp[k]; }
    b.prog = 1e-6; b.batch = r.out;
  }
  w._hidden = true; w._anim = 'craft'; w._dir = 'u';
  b._busy = true;
  const rate = 1 / craftTime(world, b, r, w);
  const need = (1 - b.prog) / rate;
  const u = Math.min(dt, need);
  b.prog += u * rate; dt -= u;
  if (b.prog >= 1 - 1e-9) {
    b.prog = 0;
    b.out[b.batch] = (b.out[b.batch] || 0) + 1;
    const st = world.state.stats.craft;
    st[b.batch] = (st[b.batch] || 0) + 1;
    const [x, y] = doorTile(b);
    float(world, x, y - 2, '+1', b.batch);
    b.batch = null;
    s.done++;
    addXp(world, w, 3);
  }
  return dt;
}

// ---------- greenhouse ----------
/**
 * What a farmer would do in this greenhouse now: ripe beds of one crop (as
 * many as a basket holds) and empty beds waiting to be planted.
 */
export function ghTasks(world, g) {
  const s = world.state, out = [];
  let crop = null, room = world.fx.carry;
  g.beds.forEach((b, i) => {
    if (b.st === 'ripe' && room > 0 && (!crop || b.crop === crop)) { crop = b.crop; room -= CROPS[b.crop].yield; out.push(i); }
    else if (b.st === 'empty' && b.crop && cropUnlocked(s, b.crop) && canAffordSeeds(world, b.crop)) out.push(i);
  });
  return out;
}
// The farmer goes inside (hidden on the farm, shown in the greenhouse), then
// harvests and plants everything on the list at the end.
function doGreenhouse(world, w, s, dt) {
  const g = s.g;
  if (!world.byId.has(g.id)) { w._hidden = false; delete w._in; w.job.i++; return dt; }
  if (s.left === undefined) {
    s.tasks = ghTasks(world, g);
    if (!s.tasks.length) { w.job.i++; return dt; }
    s.left = wDur(world, w, 0.9) * s.tasks.length;
  }
  w._hidden = true; w._in = g.id; w._anim = 'work'; w._tool = 'hoe';
  const u = Math.min(dt, s.left);
  s.left -= u; dt -= u;
  if (s.left > 1e-6) return dt;
  const st = world.state;
  for (const i of s.tasks) {
    const b = g.beds[i];
    if (!b) continue;
    if (b.st === 'ripe') {
      const c = CROPS[b.crop], item = b.crop;
      if (w.carry && w.carry.item !== item) continue;
      let n = c.yield + (R() < world.fx.bumper ? 1 : 0);
      st.stats.harvest[item] = (st.stats.harvest[item] || 0) + n;
      const goldP = world.fx.gold + 0.005 * (w.lvl - 1) + 0.02;
      let stars = 0; for (let k = 0; k < n; k++) if (R() < goldP) stars++;
      if (stars) { n -= stars; st.gold[item] = (st.gold[item] || 0) + stars; }
      if (n > 0) setCarry(w, item, n);
      if (b.next) { b.crop = b.next; delete b.next; b.st = 'empty'; b.p = 0; } else if (c.regrow) { b.st = 'grow'; b.p = c.regrow; } else { b.st = 'empty'; b.p = 0; }
      addXp(world, w, 2);
    } else if (b.st === 'empty' && b.crop && cropUnlocked(st, b.crop) && paySeeds(world, b.crop)) {
      b.st = 'grow'; b.p = 0; addXp(world, w, 1);
    }
  }
  // anything past a full basket waits in a basket by the door
  if (w.carry && w.carry.qty > world.fx.carry) {
    const extra = w.carry.qty - world.fx.carry, keep = { ...w.carry, qty: world.fx.carry };
    w.carry = { item: keep.item, qty: extra };
    const [x, y] = accessTile(world, g); dropPile(world, w, x, y); w.carry = keep;
  }
  w._hidden = false; delete w._in;
  w.job.i++;
  return dt;
}

/** Called once after loading or catching up so live farmhands re-plan walks. */
export function resetPaths(world) {
  for (const w of world.state.workers) {
    const s = w.job && w.job.steps[w.job.i];
    if (s && s.t === 'go') { s.path = null; s.left = undefined; }
  }
}

export { earn };
