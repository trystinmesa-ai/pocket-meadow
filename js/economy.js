// Money in and money out: selling, auto-sell, purchases, upgrades, land,
// hiring and orders. UI code calls these; each returns '' on success or a reason.
import { ACHIEVEMENTS, achReward, HATS, DEFS, ITEMS, CROPS, UPGRADES, upgradeCost, hireCost, xpForLevel, levelReward, MAX_LEVEL, parcelCost, parcelLevel, MAP } from './data.js';
import { PW, PH, newWorker, initObject, sellPrice, storeCap } from './world.js';
import { cancelJobsFor, endJob, dropPile } from './sim.js';
import { seasonAt, festivalOn } from './seasons.js';
import { PETS, MAX_PETS, petCost, PET_NAMES, SEASONS } from './data.js';

/** Add earned coins (offline earnings wait in pendingCoins to be collected). */
export function earn(world, coins, xp = coins) {
  const s = world.state;
  if (world.offline) s.pendingCoins += coins; else s.coins += coins;
  s.stats.earned += coins;
  addFarmXp(world, xp);
}

export function addFarmXp(world, xp) {
  const s = world.state;
  s.xp += xp;
  while (s.level < MAX_LEVEL && s.xp >= xpForLevel(s.level + 1)) {
    s.level++;
    const r = levelReward(s.level);
    if (world.offline) s.pendingCoins += r; else s.coins += r;
    world.events.push({ t: 'level', level: s.level, reward: r });
  }
}

export function sell(world, item, qty) {
  const got = world.takeItem(item, qty);
  if (!got) return 0;
  const coins = sellPrice(world, item) * got;
  const st = world.state.stats;
  st.sold[item] = (st.sold[item] || 0) + got;
  st.soldCoins += coins;
  earn(world, coins);
  return coins;
}

/** Sell goods that never reached storage (a farmhand's basket). */
export function sellDirect(world, item, qty) {
  const coins = sellPrice(world, item) * qty;
  const st = world.state.stats;
  st.sold[item] = (st.sold[item] || 0) + qty;
  st.soldCoins += coins;
  earn(world, coins);
  return coins;
}

export function autoSellItem(world, item) {
  const res = world.state.autoSell[item];
  if (res === undefined) return 0;
  const extra = world.have(item) - res;
  return extra > 0 ? sell(world, item, extra) : 0;
}
export function autoSellAll(world) {
  let n = 0;
  for (const item in world.state.autoSell) n += autoSellItem(world, item);
  return n;
}

// ---------- costs ----------
export function costOf(world, type) {
  const d = DEFS[type];
  if (typeof d.cost === 'function') return d.cost(world.count(type));
  return d.cost;
}
export const unlocked = (world, type) => world.state.level >= DEFS[type].level;

function spend(world, n) {
  if (world.state.coins < n) return false;
  world.state.coins -= n;
  return true;
}

/** Place a new object. extra = per-type fields (e.g. { crop }). */
export function place(world, type, x, y, extra = {}) {
  const d = DEFS[type];
  if (!unlocked(world, type)) return `Unlocks at farm level ${d.level}`;
  if (d.unique && world.count(type)) return 'You already have one';
  const why0 = seasonalBlock(world, d);
  if (why0) return why0;
  const why = world.canPlace(type, x, y);
  if (why) return why;
  const cost = costOf(world, type);
  if (d.ribbons && world.state.ribbons < d.ribbons) return 'Not enough ribbons';
  if (!spend(world, cost)) return 'Not enough coins';
  if (d.ribbons) world.state.ribbons -= d.ribbons;
  const s = world.state;
  const o = initObject({ id: s.nextId++, type, x, y, ...extra });
  s.objects.push(o);
  world.rebuild();
  world.events.push({ t: 'placed', o, cost });
  return '';
}

/**
 * Choose a plot's crop. An empty plot switches straight away. A planted one
 * keeps growing what it has; after that harvest the new crop is planted and
 * grows from the start. Picking the current crop again cancels the switch.
 */
export function setCrop(world, plot, crop) {
  if (!world.state.seeds[crop]) return 'Unlock this seed first';
  if (plot.st === 'empty') {
    cancelJobsFor(world, plot.id);
    plot.crop = crop;
    delete plot.next;
    world.rebuild();
  } else if (crop === plot.crop) delete plot.next;
  else plot.next = crop;
  return '';
}

// ---------- seeds per planting ----------
// Farmers pay for seeds as they plant. Away from the game, earnings wait in
// pendingCoins, so planting can use those too.
export const canAffordSeeds = (world, crop) => world.state.coins + world.state.pendingCoins >= CROPS[crop].seed;
export function paySeeds(world, crop) {
  const s = world.state, n = CROPS[crop].seed;
  if (!canAffordSeeds(world, crop)) return false;
  const fromCoins = Math.min(n, s.coins);
  s.coins -= fromCoins;
  s.pendingCoins -= n - fromCoins;
  s.stats.seeds = (s.stats.seeds || 0) + n;
  return true;
}

export function refundOf(world, o) {
  const d = DEFS[o.type];
  if (d.fixed || d.ribbons) return 0;
  const n = world.count(o.type) - 1;
  const base = typeof d.cost === 'function' ? d.cost(Math.max(0, n)) : d.cost;
  return Math.floor(base * 0.5);
}

export function remove(world, o) {
  const d = DEFS[o.type];
  if (d.fixed) return 'This one stays';
  if (d.store && world.storages.length <= 1) return 'You need at least one storage building';
  if (d.store && world.used() > world.capacity - storeCap(o)) return 'Storage is too full to remove this';
  if (d.houses && world.state.workers.length > world.housing - d.houses) return 'Your farmhands live here';
  const s = world.state;
  cancelJobsFor(world, o.id);
  // return stocked goods
  if (o.inp) for (const k in o.inp) world.addItem(k, o.inp[k]);
  if (o.out && typeof o.out === 'object') for (const k in o.out) world.addItem(k, o.out[k]);
  else if (o.out) world.addItem(DEFS[o.type].hive ? DEFS[o.type].hive.item : DEFS[o.type].animal.item, o.out);
  if (o.feed) world.addItem(DEFS[o.type].animal.feed, o.feed);
  s.coins += refundOf(world, o);
  s.objects.splice(s.objects.indexOf(o), 1);
  world.rebuild();
  return '';
}

export function move(world, o, x, y) {
  const why = world.canPlace(o.type, x, y, o.id);
  if (why) return why;
  cancelJobsFor(world, o.id);
  o.x = x; o.y = y;
  world.rebuild();
  return '';
}

// ---------- building upgrades ----------
export function bUpgradeCost(o) {
  const d = DEFS[o.type];
  return Math.round(d.upg * Math.pow(2.1, (o.lvl || 1) - 1));
}
export function upgradeBuilding(world, o) {
  const d = DEFS[o.type];
  if (!d.upg) return 'Can’t upgrade this';
  if (o.lvl >= d.maxLvl) return 'Already at max level';
  if (!spend(world, bUpgradeCost(o))) return 'Not enough coins';
  o.lvl++;
  world.rebuild();
  return '';
}

// ---------- global upgrades ----------
export function buyUpgrade(world, id) {
  const u = UPGRADES.find((x) => x.id === id);
  const s = world.state;
  const l = s.upgrades[id] || 0;
  if (s.level < u.level) return `Unlocks at farm level ${u.level}`;
  if (l >= u.max) return 'Maxed out';
  if (!spend(world, upgradeCost(u, l))) return 'Not enough coins';
  s.upgrades[id] = l + 1;
  world.rebuild();
  return '';
}

// ---------- seeds ----------
export function buySeed(world, crop) {
  const c = CROPS[crop], s = world.state;
  if (s.seeds[crop]) return '';
  if (s.level < c.level) return `Unlocks at farm level ${c.level}`;
  if (!spend(world, c.cost)) return 'Not enough coins';
  s.seeds[crop] = true;
  return '';
}

// ---------- farmhands ----------
export const nextHireCost = (world) => hireCost(world.state.workers.length);
export function hire(world, role) {
  const s = world.state;
  if (s.workers.length >= world.housing) return 'Build a cottage for more room';
  if (!spend(world, nextHireCost(world))) return 'Not enough coins';
  const w = newWorker(s, role);
  world.events.push({ t: 'hired', w });
  return '';
}
/**
 * Let a farmhand go. Jobs are fixed once hired, so changing jobs means letting
 * someone go and hiring a new farmhand (who starts at level 1). You get half
 * of what the last hire cost back.
 */
export const fireRefund = (world) => Math.floor(hireCost(Math.max(0, world.state.workers.length - 1)) / 2);
export function fire(world, w) {
  const s = world.state;
  const i = s.workers.indexOf(w);
  if (i < 0) return '';
  endJob(world, w);
  if (w.carry) dropPile(world, w, Math.floor(w.x), Math.floor(w.y));
  s.coins += fireRefund(world);
  s.workers.splice(i, 1);
  world.events.push({ t: 'fired', w });
  return '';
}

// ---------- land ----------
export const parcelsBought = (s) => s.map.owned.filter(Boolean).length - 2;
export function parcelBuyable(world, px, py) {
  const own = world.state.map.owned;
  if (px < 0 || py < 0 || px >= PW || py >= PH || own[py * PW + px]) return false;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const x = px + dx, y = py + dy;
    return x >= 0 && y >= 0 && x < PW && y < PH && own[y * PW + x];
  });
}
export function buyParcel(world, px, py) {
  const s = world.state;
  if (!parcelBuyable(world, px, py)) return 'Buy land next to your farm';
  const k = parcelsBought(s);
  if (s.level < parcelLevel(k)) return `Reach farm level ${parcelLevel(k)} first`;
  if (!spend(world, parcelCost(k))) return 'Not enough coins';
  s.map.owned[py * PW + px] = true;
  world.rebuild();
  world.events.push({ t: 'land', px, py });
  return '';
}

// ---------- orders ----------
export function canFill(world, order) {
  return order.items.every((x) => world.have(x.item) >= x.qty);
}
export function fillOrder(world, order) {
  const s = world.state;
  if (!canFill(world, order)) return 'Not enough in storage';
  for (const x of order.items) world.takeItem(x.item, x.qty);
  s.orders.splice(s.orders.indexOf(order), 1);
  s.stats.orders++;
  earn(world, order.reward, order.reward + order.xp);
  if (s.orders.length < 3) s.nextOrderAt = Math.min(s.nextOrderAt, Date.now() + 2 * 60 * 1000);
  return '';
}
export function skipOrder(world, order) {
  const s = world.state;
  s.orders.splice(s.orders.indexOf(order), 1);
  s.nextOrderAt = Math.max(s.nextOrderAt, Date.now() + 4 * 60 * 1000);
  return '';
}

export function collectPending(world) {
  const s = world.state;
  const n = s.pendingCoins;
  s.coins += n;
  s.pendingCoins = 0;
  return n;
}

export { MAP };

// ---------- achievements & hats ----------
/** Tiers already claimed, and whether the next one is ready. */
export function achState(world, a) {
  const s = world.state;
  const claimed = s.ach[a.id] || 0;
  const value = a.value(s, world);
  const next = a.tiers[claimed];
  return { claimed, value, next, ready: next !== undefined && value >= next, done: claimed >= a.tiers.length };
}
export function claimAch(world, id) {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  const st = achState(world, a);
  if (!st.ready) return 'Not yet';
  world.state.ach[id] = st.claimed + 1;
  world.state.coins += achReward(a, st.claimed);
  return '';
}
export function claimableAch(world) {
  return ACHIEVEMENTS.filter((a) => achState(world, a).ready).length;
}
export function hatUnlocked(s, id) {
  const h = HATS[id];
  if (!h) return true;
  if (s.hats[id]) return true;
  if (h.ach) { const [aid, tier] = h.ach.split(':'); return (s.ach[aid] || 0) > +tier; }
  return false;
}
export function buyHat(world, id) {
  const h = HATS[id];
  if (!h || !(h.cost || h.ribbons)) return 'This hat is earned, not bought';
  if (world.state.hats[id]) return '';
  if (h.ribbons) {
    const why = seasonalBlock(world, h);
    if (why) return why;
    if (world.state.ribbons < h.ribbons) return 'Not enough ribbons';
    world.state.ribbons -= h.ribbons;
  } else if (!spend(world, h.cost)) return 'Not enough coins';
  world.state.hats[id] = true;
  return '';
}

// ---------- seasons & festivals ----------
/** Why a seasonal or festival item can't be bought right now ('' if it can). */
export function seasonalBlock(world, d, now = Date.now()) {
  const season = seasonAt(now);
  if (d.season && d.season !== season.id) return `Only sold in ${SEASONS.find((x) => x.id === d.season).name}`;
  if (d.festival) {
    if (!festivalOn(now)) return 'Only sold during a festival weekend';
    if (d.festival !== 'any' && d.festival !== season.id) return `Only at the ${SEASONS.find((x) => x.id === d.festival).festival}`;
  }
  return '';
}
export function fillFestOrder(world, order, now = Date.now()) {
  const s = world.state;
  if (!s.fest || !festivalOn(now)) return 'The festival is over';
  if (!canFill(world, order)) return 'Not enough in storage';
  for (const x of order.items) world.takeItem(x.item, x.qty);
  s.fest.orders.splice(s.fest.orders.indexOf(order), 1);
  s.ribbons += order.ribbons;
  s.stats.festOrders = (s.stats.festOrders || 0) + 1;
  earn(world, order.reward, order.reward + order.xp);
  return '';
}

// ---------- pets ----------
export const nextPetCost = (world) => petCost(world.state.pets.length);
export function adoptPet(world, kind, color) {
  const s = world.state;
  if (!PETS[kind]) return 'Unknown pet';
  if (s.pets.length >= MAX_PETS) return `You can have up to ${MAX_PETS} pets`;
  if (!spend(world, nextPetCost(world))) return 'Not enough coins';
  const used = new Set(s.pets.map((p) => p.name));
  const name = PET_NAMES.find((n) => !used.has(n)) || `${PETS[kind].name} ${s.pets.length + 1}`;
  const pet = { id: s.nextId++, kind, color: color ?? 0, name };
  s.pets.push(pet);
  world.rebuild();
  world.events.push({ t: 'pet', pet });
  return '';
}
export function patPet(world) {
  world.state.stats.pats = (world.state.stats.pats || 0) + 1;
}
