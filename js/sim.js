// The farm simulation: crops, trees, animals, workshops, orders and the
// farmhands' job system. The same code runs live (with walking along real
// paths) and in fast mode for offline catch-up (walking becomes a timer).
import { DEFS, ITEMS, CROPS, ROLES, ALL_TASKS, ORDER_SLOTS, ORDER_EVERY, ORDER_NAMES, RAIN_BLOCK, RAIN_CHANCE,
  MAX_WORKER_LEVEL, workerXpNeeded } from './data.js';
import { idx, doorTile, hash2, cropUnlocked } from './world.js';
import { findPath } from './path.js';
import { seasonAt, festivalOn, festivalId, seasonGrowth, canPlantNow } from './seasons.js';
import { FESTIVAL_ORDER_EVERY, FESTIVAL_SLOTS } from './data.js';
import { earn, autoSellItem, autoSellAll, sellDirect, canAffordSeeds, paySeeds } from './economy.js';

const R = Math.random;
const WALK = 2.3; // tiles per second

// ---------- small helpers ----------
export function isRaining(world, tMs) {
  const block = Math.floor(tMs / 1000 / RAIN_BLOCK);
  return hash2(block, 7, world.state.seed % 9973) < RAIN_CHANCE;
}

export const animalCount = (a) => DEFS[a.type].animal.count + (a.lvl - 1);
export const animalCap = (a) => 6 + 4 * a.lvl;
export const feedCap = (a) => 8 + 6 * a.lvl;
export const hiveCap = (h) => DEFS[h.type].hive.cap + 2 * (h.lvl - 1);
export const hiveRate = (h) => (h.type === 'beehive' ? 1 + Math.min(1, 0.1 * (h._flowers || 0)) : 1) * (1 + 0.25 * (h.lvl - 1));
export const outCap = (b) => 4 + 3 * b.lvl;
export const outTotal = (b) => { let n = 0; for (const k in b.out) n += b.out[k]; return n; };

export function recipesFor(state, b) {
  return DEFS[b.type].recipes.filter((r) => (r.level || DEFS[b.type].level) <= state.level);
}
const recipeValueGain = (r) => {
  let v = 0; for (const k in r.in) v += ITEMS[k].value * r.in[k];
  return (ITEMS[r.out].value - v) / r.time;
};
function feasible(world, b, r) {
  for (const k in r.in) if ((b.inp[k] || 0) + world.have(k) < r.in[k]) return false;
  return true;
}
const hasInputs = (b, r) => { for (const k in r.in) if ((b.inp[k] || 0) < r.in[k]) return false; return true; };

// Switch a workshop to a recipe; inputs it no longer needs go back to storage.
function switchRecipe(world, b, r) {
  b.cur = r ? r.out : null;
  for (const k of Object.keys(b.inp)) {
    if (r && r.in[k]) continue;
    const back = world.addItem(k, b.inp[k]);
    b.inp[k] -= back;
    if (!b.inp[k]) delete b.inp[k];
  }
}

/** The recipe a workshop is currently making (choosing one when on auto). */
export function curRecipe(world, b) {
  const list = recipesFor(world.state, b);
  if (b.prog > 0 && b.batch) return list.find((r) => r.out === b.batch) || DEFS[b.type].recipes.find((r) => r.out === b.batch);
  if (b.recipe !== 'auto') {
    const r = list.find((x) => x.out === b.recipe) || null;
    if (b.cur !== (r && r.out)) switchRecipe(world, b, r);
    return r;
  }
  const cur = list.find((r) => r.out === b.cur);
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
  const rain = isRaining(world, now);
  world.season = seasonAt(now);
  world.festival = festivalOn(now);
  world.raining = rain;

  let ripe = 0, empty = 0, dry = 0;
  for (const p of world.plots) {
    if (p.st === 'grow') {
      if (!p.wet && (rain || world.sprinkled.has(idx(p.x, p.y)))) p.wet = true;
      p.p += (dt / CROPS[p.crop].time) * fx.grow * (p.wet ? fx.water : 1) * seasonGrowth(p.crop, world.season);
      if (p.p >= 1) { p.p = 1; p.st = 'ripe'; }
      else if (!p.wet && p.p < 0.75) dry++;
    }
    if (p.st === 'ripe') ripe++;
    else if (p.st === 'empty') empty++;
  }
  let ripeTrees = 0;
  for (const t of world.trees) {
    if (t.p < 1) t.p = Math.min(1, t.p + (dt / DEFS[t.type].time) * fx.grow);
    else ripeTrees++;
  }
  let feedNeed = 0, animalOut = 0;
  for (const a of world.animals) {
    const A = DEFS[a.type].animal, cap = animalCap(a);
    if (a.feed > 0 && a.out < cap) {
      a.prog += (dt * animalCount(a) * fx.animal) / A.time;
      while (a.prog >= 1 && a.feed > 0 && a.out < cap) {
        a.prog -= 1; a.feed--; a.out++;
        s.stats.harvest[A.item] = (s.stats.harvest[A.item] || 0) + 1;
      }
      if (a.feed <= 0 || a.out >= cap) a.prog = Math.min(a.prog, 0.99);
    }
    if (a.feed < feedCap(a) - 2) feedNeed++;
    if (a.out > 0) animalOut++;
  }
  for (const h of world.hives) {
    if (h.out < hiveCap(h)) {
      const H = DEFS[h.type].hive;
      h.prog += (dt * fx.animal * hiveRate(h)) / H.time;
      if (h.prog >= 1) { h.prog -= 1; h.out++; s.stats.harvest[H.item] = (s.stats.harvest[H.item] || 0) + 1; }
    }
    if (h.out > 0) animalOut++;
  }
  let pileQty = 0;
  for (const p of s.piles) pileQty += p.qty;
  world.pileQty = pileQty;
  world.avail = { ripe, empty, dry, ripeTrees, feedNeed, animalOut, piles: s.piles.length };

  ordersTick(world, now);
  festivalTick(world, now);
  world.hauler = s.workers.some((w) => w.role === 'hauler');
  world.artisan = s.workers.some((w) => w.role === 'artisan');
  for (const w of s.workers) updateWorker(world, w, dt, fast);

  world._autoT = (world._autoT || 0) + dt;
  if (world._autoT >= 4) { world._autoT = 0; autoSellAll(world); }
  s.simTime = now;
}

// ---------- orders ----------
function ordersTick(world, now) {
  const s = world.state;
  if (s.orders.length >= ORDER_SLOTS) { if (now > s.nextOrderAt) s.nextOrderAt = now + 60 * 1000; return; }
  let guard = 0;
  while (s.orders.length < ORDER_SLOTS && now >= s.nextOrderAt && guard++ < 5) {
    const o = makeOrder(world);
    if (!o) { s.nextOrderAt = now + 60 * 1000; return; }
    s.orders.push(o);
    s.nextOrderAt += ORDER_EVERY * 1000;
    if (s.nextOrderAt < now - ORDER_EVERY * 1000 * ORDER_SLOTS) s.nextOrderAt = now;
  }
}

/** Items this farm can currently make, used for orders. */
export function producible(world) {
  const s = world.state, out = new Set();
  for (const c in CROPS) if (cropUnlocked(s, c) && (!CROPS[c].season || CROPS[c].season === world.season?.id)) out.add(c);
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
    o.ribbons = 3 + Math.floor(R() * 3) + o.items.length;
    o.festival = true;
    s.fest.orders.push(o);
    s.fest.next = s.fest.orders.length < FESTIVAL_SLOTS ? now : now + FESTIVAL_ORDER_EVERY * 1000;
  }
  if (s.fest.orders.length >= FESTIVAL_SLOTS) s.fest.next = Math.max(s.fest.next, now);
}

export function makeOrder(world, scale = 1) {
  const s = world.state;
  const pool = producible(world);
  if (!pool.length) return null;
  const n = Math.min(pool.length, 1 + Math.floor(R() * Math.min(3, 1 + s.level / 3)));
  const picks = [];
  const shuffled = pool.slice().sort(() => R() - 0.5);
  for (const it of shuffled) { if (picks.length >= n) break; picks.push(it); }
  const budget = 30 * Math.pow(1.5, s.level) * scale;
  const items = picks.map((it) => ({ item: it, qty: Math.max(1, Math.min(60, Math.round((budget / picks.length) / ITEMS[it].value * (0.7 + R() * 0.6)))) }));
  const value = items.reduce((v, x) => v + ITEMS[x.item].value * x.qty, 0);
  return {
    id: s.nextId++, from: ORDER_NAMES[Math.floor(R() * ORDER_NAMES.length)], items,
    reward: Math.round(value * (1.6 + R() * 0.5)), xp: Math.round(value * 0.6),
  };
}

// ---------- farmhands ----------
const wSpeed = (world, w, tile) => WALK * world.fx.walk * (1 + 0.04 * (w.lvl - 1)) * tile;
const wDur = (world, w, base) => base / (world.fx.work * (1 + 0.05 * (w.lvl - 1)));
const wx = (w) => Math.floor(w.x), wy = (w) => Math.floor(w.y);
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
// Goods set to auto-sell can always be delivered (they sell on arrival).
const sells = (world, item) => world.state.autoSell[item] !== undefined;

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

function addXp(world, w, n) {
  if (w.lvl >= MAX_WORKER_LEVEL) return;
  w.xp += n;
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
  const st = nearestStorage(world, w);
  if (!st) {
    job.steps.splice(job.i, 0, { t: 'do', anim: 'drop', dur: 0.4, fx: () => dropPile(world, w, wx(w), wy(w)) });
    return;
  }
  const [x, y] = doorTile(st);
  job.steps.splice(job.i, 0, { t: 'go', x, y, ref: st.id }, {
    t: 'do', anim: 'deposit', dur: 0.5, fx: () => {
      const c = w.carry; if (!c) return;
      let put = world.addItem(c.item, c.qty);
      c.qty -= put;
      if (put) autoSellItem(world, c.item);
      // auto-sold goods free their own space, so the rest fits too
      if (c.qty > 0 && world.state.autoSell[c.item] !== undefined) {
        const more = world.addItem(c.item, c.qty);
        c.qty -= more; put += more;
        autoSellItem(world, c.item);
        // storage is full of other things: sell straight from the basket
        if (c.qty > 0) { sellDirect(world, c.item, c.qty); put += c.qty; c.qty = 0; }
      }
      if (put) float(world, x, y - 1, `+${put}`, c.item);
      if (c.qty <= 0) w.carry = null;
      else { dropPile(world, w, x, y); world.events.push({ t: 'full' }); }
    },
  });
}

// ---------- job finders ----------
const FIND = {
  harvest(world, w) {
    if (!world.avail.ripe) return null;
    const room = world.free() > 0 || (world.hauler && world.pileQty <= 30);
    const p = nearest(world.plots, w, (o) => o.st === 'ripe' && !o._c && !bad(world, o) && (room || sells(world, o.crop)));
    if (!p) return null;
    const job = new Job(w, 'harvest', `Harvesting ${ITEMS[p.crop].name}`);
    harvestSteps(world, w, job, p);
    return job;
  },
  plant(world, w) {
    if (!world.avail.empty) return null;
    const s = world.state;
    const p = nearest(world.plots, w, (o) => o.st === 'empty' && !o._c && !bad(world, o) && cropUnlocked(s, o.crop) && canPlantNow(o.crop, world.season) && canAffordSeeds(world, o.crop));
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
    const room = world.free() > 0 || (world.hauler && world.pileQty <= 30);
    const t = nearest(world.trees, w, (o) => o.p >= 1 && !o._c && !bad(world, o) && (room || sells(world, DEFS[o.type].fruit)));
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
    const room = world.free() > 0;
    const p = nearest(world.state.piles, w, (o) => !o._c && !bad(world, o) && (room || sells(world, o.item)));
    if (!p) return null;
    const job = new Job(w, 'haulPile', `Carrying ${ITEMS[p.item].name}`).claim(p, '_c');
    pickupPileSteps(world, w, job, p);
    return deliver(job, false);
  },
  collect(world, w) {
    if (world.free() <= 0) return null;
    const cap = world.fx.carry;
    const b = nearest(world.bldgs, w, (o) => {
      if (o._cc || bad(world, o)) return false;
      const n = outTotal(o);
      return n >= Math.min(cap, 2) || (n > 0 && (o.prog <= 0 || n >= outCap(o)));
    });
    if (!b) return null;
    const [x, y] = doorTile(b);
    const job = new Job(w, 'collect', `Collecting from the ${DEFS[b.type].name}`).claim(b, '_cc');
    job.go(x, y, b.id).do('load', wDur(world, w, 0.6), () => {
      let item = null;
      for (const k in b.out) if (!item || b.out[k] > b.out[item]) item = k;
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
      if (b._cs || bad(world, b)) continue;
      const r = curRecipe(world, b);
      if (!r) continue;
      let need = null, deficit = 0;
      for (const k in r.in) {
        const want = r.in[k] * 2 - (b.inp[k] || 0);
        if (want > deficit && world.have(k) > 0) { deficit = want; need = k; }
      }
      if (need) cand.push({ b, item: need, deficit, x: b.x, y: b.y });
    }
    const c = nearest(cand, w, () => true);
    if (!c) return null;
    return supplyJob(world, w, c.b, c.item, c.deficit, '_cs', `Bringing ${ITEMS[c.item].name} to the ${DEFS[c.b.type].name}`,
      (q) => { c.b.inp[c.item] = (c.b.inp[c.item] || 0) + q; });
  },
  feed(world, w) {
    if (!world.avail.feedNeed) return null;
    const a = nearest(world.animals, w, (o) => !o._cs && !bad(world, o) && o.feed < feedCap(o) - 2 && world.have(DEFS[o.type].animal.feed) > 0);
    if (!a) return null;
    const A = DEFS[a.type].animal;
    return supplyJob(world, w, a, A.feed, feedCap(a) - a.feed, '_cs', `Feeding the ${A.kind}s`, (q) => { a.feed += q; });
  },
  collectAnimal(world, w) {
    if (!world.avail.animalOut || world.free() <= 0) return null;
    const cap = world.fx.carry;
    const list = world.animals.concat(world.hives);
    const a = nearest(list, w, (o) => {
      if (o._cc || bad(world, o)) return false;
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
  operate(world, w) {
    const b = nearest(world.bldgs, w, (o) => {
      if (o._co || bad(world, o)) return false;
      if (outTotal(o) >= outCap(o)) return false;
      const r = curRecipe(world, o);
      return r && (o.prog > 0 || hasInputs(o, r));
    });
    if (!b) return null;
    const [x, y] = doorTile(b);
    const job = new Job(w, 'operate', `Working in the ${DEFS[b.type].name}`).claim(b, '_co');
    job.go(x, y, b.id);
    job.steps.push({ t: 'craft', b, max: w.role === 'artisan' ? 1e9 : 2, done: 0 });
    return job;
  },
};

function harvestSteps(world, w, job, p) {
  job.claim(p, '_c');
  job.go(p.x, p.y, p.id).do('harvest', wDur(world, w, 1.1), () => {
    if (p.st !== 'ripe') return;
    const c = CROPS[p.crop];
    const n = c.yield + (R() < world.fx.bumper ? 1 : 0);
    const item = p.crop;
    world.state.stats.harvest[item] = (world.state.stats.harvest[item] || 0) + n;
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

function assignJob(world, w, fast) {
  if (w.carry) {
    const job = new Job(w, 'deliver', `Carrying ${ITEMS[w.carry.item].name}`);
    w.job = deliver(job, false);
    return;
  }
  const own = ROLES[w.role].tasks;
  let job = null;
  for (const t of own) if ((job = FIND[t](world, w))) break;
  if (!job && world.state.settings.helpers) {
    for (const t of ALL_TASKS) {
      if (own.includes(t)) continue;
      if ((job = FIND[t](world, w))) break;
    }
  }
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
  const stop = !r || s.done >= s.max || (b.prog <= 0 && (!hasInputs(b, r) || outTotal(b) >= outCap(b)));
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

/** Called once after loading or catching up so live farmhands re-plan walks. */
export function resetPaths(world) {
  for (const w of world.state.workers) {
    const s = w.job && w.job.steps[w.job.i];
    if (s && s.t === 'go') { s.path = null; s.left = undefined; }
  }
}

export { earn };
