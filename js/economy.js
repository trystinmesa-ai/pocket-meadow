// Money in and money out: selling, auto-sell, purchases, upgrades, land,
// hiring and orders. UI code calls these; each returns '' on success or a reason.
import { ACHIEVEMENTS, achReward, HATS, DEFS, ITEMS, CROPS, UPGRADES, upgradeCost, hireCost, xpForLevel, levelReward, MAX_LEVEL, parcelCost, parcelLevel, MAP } from './data.js';
import { PW, PH, newWorker, initObject, sellPrice, storeCap, effects } from './world.js';
import { cancelJobsFor, endJob, dropPile, PANTRY } from './sim.js';
import { seasonAt, festivalOn } from './seasons.js';
import { PETS, MAX_PETS, petCost, PET_NAMES, SEASONS, BUNDLE_ROOMS, BUNDLES, ALL_BUNDLES_REWARD, matsFor, upgMatsFor, buildTime, needsBuilding,
  QZONES, SHED_MAX, shedCost, QUARRY } from './data.js';
import { newQuarry, addZone } from './quarry.js';
import { VILLAGERS, HEARTS, heartsOf, PROJECTS, PERKS, GOLD_MULT } from './data.js';
import { merchantHere, stockOf, soldOut } from './merchant.js';

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
  const got = world.takeAll(item, qty);
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
  const mats = matsFor(type, world.count(type));
  if (d.ribbons && world.state.ribbons < d.ribbons) return 'Not enough ribbons';
  if (mats && !world.hasMats(mats)) return `Needs ${matsText(mats, world)}`;
  if (!spend(world, cost)) return 'Not enough coins';
  if (d.ribbons) world.state.ribbons -= d.ribbons;
  if (mats) world.takeMats(mats);
  const s = world.state;
  if (d.merchant) { const v = merchantHere(world); if (v) markBought(s, v, `decor:${type}`); }
  const o = initObject({ id: s.nextId++, type, x, y, ...extra });
  // bigger things take a while to put up (tests and the bot can skip that)
  const t = world.instantBuild ? 0 : buildTime(type, cost);
  if (t > 0) { o.build = t; o.buildT = t; o.paid = { coins: cost, mats }; }
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
// pendingCoins, so planting can use those too. A broke farm still gets wheat
// seeds for whatever it has left, so it can never get stuck.
const funds = (s) => Math.max(0, s.coins) + Math.max(0, s.pendingCoins);
export const canAffordSeeds = (world, crop) => crop === 'wheat' || funds(world.state) >= CROPS[crop].seed;
export function paySeeds(world, crop) {
  const s = world.state;
  if (!canAffordSeeds(world, crop)) return false;
  const n = Math.min(CROPS[crop].seed, funds(s));
  const fromCoins = Math.min(n, s.coins);
  s.coins -= fromCoins;
  s.pendingCoins -= n - fromCoins;
  s.stats.seeds = (s.stats.seeds || 0) + n;
  return true;
}

/** Short text for missing or needed materials, e.g. '12 Wood, 3 more Stone'. */
/** Needed materials as text; with a world, only what's still missing ('3 more Wood'). */
export function matsText(m, world) {
  const list = Object.entries(m).map(([k, n]) => [k, world ? n - world.mat(k) : n]).filter(([, n]) => n > 0);
  return list.map(([k, n]) => `${world ? `${n} more` : n} ${ITEMS[k].name}`).join(', ');
}

export function refundOf(world, o) {
  const d = DEFS[o.type];
  if (o.build > 0 && o.paid) return o.paid.coins; // not finished yet: everything back
  if (d.fixed || d.ribbons) return 0;
  const n = world.count(o.type) - 1;
  const base = typeof d.cost === 'function' ? d.cost(Math.max(0, n)) : d.cost;
  return Math.floor(base * 0.5);
}

export function remove(world, o) {
  const d = DEFS[o.type];
  if (d.fixed) return 'This one stays';
  const done = !(o.build > 0);
  if (done && d.store && world.storages.length <= 1) return 'You need at least one storage building';
  if (done && d.store && world.used() > world.capacity - storeCap(o)) return 'Storage is too full to remove this';
  if (done && d.houses && world.state.workers.length > world.housing - d.houses) return 'Your farmhands live here';
  const s = world.state;
  cancelJobsFor(world, o.id);
  if (!done && o.paid?.mats) world.refundMats(o.paid.mats);
  if (d.gives) for (const k in d.gives) world.addMat(k, d.gives[k]); // clearing debris by hand
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
  if (o.build > 0) return 'Still being built';
  const mats = upgMatsFor(o);
  if (mats && !world.hasMats(mats)) return `Needs ${matsText(mats, world)}`;
  if (!spend(world, bUpgradeCost(o))) return 'Not enough coins';
  if (mats) world.takeMats(mats);
  o.lvl++;
  world.rebuild();
  return '';
}

// ---------- workshop pantries ----------
export const pantryCost = (o) => Math.round(DEFS[o.type].upg * 0.6 * Math.pow(2, (o.pl || 1) - 1));
export function upgradePantry(world, o) {
  if (!DEFS[o.type].recipes) return 'Only workshops have a pantry';
  if ((o.pl || 1) >= PANTRY.length) return 'Pantry is as big as it gets';
  if (!spend(world, pantryCost(o))) return 'Not enough coins';
  o.pl = (o.pl || 1) + 1;
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
  if (role === 'miner' && !s.quarry) return 'Find the quarry trail first';
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
  if (w.carry && w.role === 'miner') world.refundMats({ [w.carry.item]: w.carry.qty });
  else if (w.carry) dropPile(world, w, Math.floor(w.x), Math.floor(w.y));
  if (w._q?.node) delete w._q.node._c;
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

// ---------- quarry & material shed ----------
/** Edge parcels lead to the quarry trail. */
export const trailParcels = (world) => {
  const out = [];
  for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
    if (!world.state.map.owned[py * PW + px]) continue;
    if (px === 0) out.push({ px, py, side: 'w' });
    if (px === PW - 1) out.push({ px, py, side: 'e' });
    if (py === 0) out.push({ px, py, side: 'n' });
    if (py === PH - 1) out.push({ px, py, side: 's' });
  }
  return out;
};
export function discoverQuarry(world) {
  const s = world.state;
  if (s.quarry) return '';
  if (!trailParcels(world).length) return 'Buy land at the edge of the map to find the trail';
  s.quarry = newQuarry(s.seed);
  world.events.push({ t: 'quarry' });
  return '';
}
export function zoneBlock(world, i) {
  const s = world.state, z = QZONES[i];
  if (!s.quarry) return 'Find the quarry first';
  if (i < s.quarry.zones) return 'Already open';
  if (i > s.quarry.zones) return `Open ${QZONES[i - 1].name} first`;
  if (s.level < z.level) return `Reach farm level ${z.level}`;
  return '';
}
export function openZone(world, i) {
  const why = zoneBlock(world, i);
  if (why) return why;
  const z = QZONES[i];
  if (z.mats && !world.hasMats(z.mats)) return `Needs ${matsText(z.mats, world)}`;
  if (!spend(world, z.cost)) return 'Not enough coins';
  if (z.mats) world.takeMats(z.mats);
  addZone(world.state.quarry, i, world.state.seed);
  world.events.push({ t: 'zone', i });
  return '';
}
export function upgradeShed(world) {
  const s = world.state;
  if ((s.shed || 1) >= SHED_MAX) return 'The shed is as big as it gets';
  const c = shedCost(s.shed || 1);
  if (!world.hasMats(c.mats)) return `Needs ${matsText(c.mats, world)}`;
  if (!spend(world, c.coins)) return 'Not enough coins';
  world.takeMats(c.mats);
  s.shed = (s.shed || 1) + 1;
  return '';
}
/** Sell materials you don't need (they sell for their base value). */
export function sellMat(world, k, n) {
  const got = Math.min(n, world.mat(k));
  if (got <= 0) return 0;
  world.takeMats({ [k]: got });
  const coins = got * ITEMS[k].value;
  earn(world, coins);
  return coins;
}

// ---------- neighbours ----------
/** The gift for reaching heart h (1-5) with a villager. Five hearts also adds their lasting favour. */
export function heartGift(v, h) {
  return [{ coins: 500 }, { ribbons: 3 }, v.gift, { coins: 10000 }, { perk: true }][h - 1];
}
/** Points an order earns with its villager: 2, plus 1 for each of their favourite things in it (up to 3). */
export const friendPoints = (order) => {
  const v = VILLAGERS.find((x) => x.id === order.who);
  return v ? 2 + Math.min(3, order.items.filter((x) => v.likes.includes(x.item)).length) : 0;
};
function befriend(world, order) {
  const s = world.state, v = VILLAGERS.find((x) => x.id === order.who);
  if (!v) return;
  const before = heartsOf(s.friends[v.id]);
  s.friends[v.id] = Math.min(HEARTS[HEARTS.length - 1], (s.friends[v.id] || 0) + friendPoints(order));
  const after = heartsOf(s.friends[v.id]);
  for (let h = before + 1; h <= after; h++) {
    const g = heartGift(v, h);
    if (g.coins) earn(world, g.coins, 0);
    if (g.ribbons) s.ribbons += g.ribbons;
    if (g.hat) s.hats[g.hat] = true;
    world.events.push({ t: 'heart', who: v.id, h, gift: g });
  }
  if (after > before) world.rebuild();
}

// ---------- village restoration ----------
export function projectState(world, id) {
  const s = world.state, p = PROJECTS.find((x) => x.id === id), given = s.village.give[id] || {};
  const slots = Object.entries(p.needs).map(([k, need]) => {
    const got = Math.min(need, given[k] || 0);
    const have = k === 'coins' ? Math.max(0, Math.floor(s.coins)) : ITEMS[k].mat ? world.mat(k) : world.haveAll(k);
    return { k, need, got, left: need - got, have };
  });
  const done = !!s.village.done[id], open = s.level >= p.level;
  return { p, slots, done, open,
    canGive: open && !done && slots.some((x) => x.k !== 'coins' && x.left && x.have),
    canPay: open && !done && slots.some((x) => x.k === 'coins' && x.left && x.have) };
}
/** Give the goods and materials you have toward a project (or, with coins, pay toward it). Finishing it applies its reward. */
export function giveProject(world, id, coins = false) {
  const s = world.state, st = projectState(world, id);
  if (!st.open) return `Opens at farm level ${st.p.level}`;
  if (st.done) return 'Already restored';
  const given = (s.village.give[id] ||= {});
  let n = 0;
  for (const x of st.slots) {
    if ((x.k === 'coins') !== coins) continue;
    const q = Math.min(x.left, x.have);
    if (q <= 0) continue;
    if (x.k === 'coins') s.coins -= q;
    else if (ITEMS[x.k].mat) world.takeMats({ [x.k]: q });
    else world.takeAll(x.k, q);
    given[x.k] = (given[x.k] || 0) + q;
    n += q;
  }
  if (!n) return coins ? 'No coins to spare' : 'Nothing to give yet';
  if (Object.entries(st.p.needs).every(([k, q]) => (given[k] || 0) >= q)) {
    s.village.done[id] = true;
    delete s.village.give[id];
    world.rebuild();
    world.events.push({ t: 'project', id });
  }
  return '';
}

// ---------- gold-star produce ----------
export const goldPrice = (world, crop) => sellPrice(world, crop) * GOLD_MULT;
export function sellGold(world, crop, n) {
  const s = world.state, got = Math.min(n, s.gold[crop] || 0);
  if (got <= 0) return 0;
  s.gold[crop] -= got; if (!s.gold[crop]) delete s.gold[crop];
  s.stats.goldSold = (s.stats.goldSold || 0) + got;
  const coins = goldPrice(world, crop) * got;
  s.stats.soldCoins += coins;
  earn(world, coins);
  return coins;
}

// ---------- travelling merchant ----------
export function buyOffer(world, key, now = Date.now()) {
  const s = world.state, v = merchantHere(world, now);
  if (!v) return 'The merchant isn’t here right now';
  const offer = stockOf(v.k).find((o) => o.key === key);
  if (!offer) return 'Not for sale this visit';
  if (soldOut(s, v, key)) return 'Sold out';
  const [kind, id, n] = key.split(':');
  if (kind === 'decor') return 'Pick a spot for it on the farm';
  if (kind === 'mat' && world.mat(id) + +n > world.shedCap) return 'Not enough room in the material shed';
  if (!spend(world, offer.price)) return 'Not enough coins';
  if (kind === 'mat') world.addMat(id, +n);
  if (kind === 'hat') s.hats[id] = true;
  if (kind === 'perk') { s.perks[id] = true; world.rebuild(); }
  markBought(s, v, key);
  return '';
}
function markBought(s, v, key) {
  if (!s.merchant || s.merchant.k !== v.k) s.merchant = { k: v.k, bought: [] };
  s.merchant.bought.push(key);
}

// ---------- orders ----------
export function canFill(world, order) {
  return order.items.every((x) => world.haveAll(x.item) >= x.qty);
}
export function fillOrder(world, order) {
  const s = world.state;
  if (!canFill(world, order)) return 'Not enough on the farm';
  for (const x of order.items) world.takeAll(x.item, x.qty);
  s.orders.splice(s.orders.indexOf(order), 1);
  s.stats.orders++;
  befriend(world, order);
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
  if (h.bundle) return bundleDone(s, h.bundle);
  if (h.ach) { const [aid, tier] = h.ach.split(':'); return (s.ach[aid] || 0) > +tier; }
  return false;
}
export function buyHat(world, id) {
  const h = HATS[id];
  if (!h || !(h.cost || h.ribbons)) return 'This hat is earned, not bought';
  if (h.merchant) return buyOffer(world, `hat:${id}`);
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

// ---------- bundles ----------
// key: a bundle id, 'room:<shelf id>' or 'all'
export const bundleDone = (s, key) => !!s.bundles?.done[key];
export function bundleLabel(key) {
  if (key === 'all') return 'whole pantry';
  if (key.startsWith('room:')) return BUNDLE_ROOMS.find((r) => r.id === key.slice(5)).name;
  return `${BUNDLES[key].name} bundle`;
}
/** What's been given and what's still needed. */
export function bundleState(world, id) {
  const s = world.state, b = BUNDLES[id], given = s.bundles.give[id] || {};
  const slots = Object.entries(b.items).map(([item, need]) => {
    const got = Math.min(need, given[item] || 0);
    return { item, need, got, left: need - got, have: world.haveAll(item) };
  });
  const done = bundleDone(s, id), open = s.level >= b.level;
  return { b, slots, done, open, canGive: open && !done && slots.some((x) => x.left && x.have), ready: open && !done && slots.every((x) => x.have >= x.left) };
}
/** Bundles that could be finished right now with what's in storage. */
export const bundlesReady = (world) => Object.keys(BUNDLES).filter((id) => bundleState(world, id).ready).length;

function grant(world, r) {
  const s = world.state;
  if (r.coins) { s.coins += r.coins; s.stats.earned += r.coins; }
  if (r.ribbons) s.ribbons += r.ribbons;
  if (r.hat) s.hats[r.hat] = true;
}
/** Give goods from storage to a bundle (one item, or everything it can). */
export function giveBundle(world, id, only) {
  const s = world.state, st = bundleState(world, id);
  if (!st.open) return `Opens at farm level ${st.b.level}`;
  if (st.done) return 'Already complete';
  const given = (s.bundles.give[id] ||= {});
  let n = 0;
  for (const x of st.slots) {
    if (only && x.item !== only) continue;
    const q = world.takeAll(x.item, Math.min(x.left, x.have));
    given[x.item] = (given[x.item] || 0) + q;
    n += q;
  }
  if (!n) return 'Nothing on the farm to give';
  const ev = { t: 'bundle', id, n, done: [] };
  if (Object.entries(st.b.items).every(([k, q]) => (given[k] || 0) >= q)) {
    s.bundles.done[id] = true; grant(world, st.b.reward); ev.done.push(id);
    const room = BUNDLE_ROOMS.find((r) => r.id === st.b.room);
    if (room.bundles.every((b) => s.bundles.done[b.id])) { s.bundles.done[`room:${room.id}`] = true; grant(world, room.reward); ev.done.push(`room:${room.id}`); }
    if (BUNDLE_ROOMS.every((r) => s.bundles.done[`room:${r.id}`]) && !s.bundles.done.all) { s.bundles.done.all = true; grant(world, ALL_BUNDLES_REWARD); ev.done.push('all'); }
    world.fx = effects(s, world);
  }
  world.events.push(ev);
  return '';
}

// ---------- seasons & festivals ----------
/** Why a seasonal or festival item can't be bought right now ('' if it can). */
export function seasonalBlock(world, d, now = Date.now()) {
  const season = seasonAt(now);
  if (d.bundle && !bundleDone(world.state, d.bundle)) return `Reward from the ${bundleLabel(d.bundle)}`;
  if (d.merchant) {
    const v = merchantHere(world, now), key = `${HATS[d.id] === d ? 'hat' : 'decor'}:${d.id}`;
    if (!v || !stockOf(v.k).some((o) => o.key === key) || soldOut(world.state, v, key)) return 'Only from the travelling merchant';
  }
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
  if (!canFill(world, order)) return 'Not enough on the farm';
  for (const x of order.items) world.takeAll(x.item, x.qty);
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
