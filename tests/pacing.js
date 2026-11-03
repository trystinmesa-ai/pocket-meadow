// Pacing check: a bot that plays like someone who never puts the game down.
// It sells, fills orders and bundles, and buys the cheapest useful thing the
// moment it can afford it. The report shows when each milestone was reached.
import { World, newGame } from '../js/world.js';
import { step } from '../js/sim.js';
import * as E from '../js/economy.js';
import { DEFS, CROPS, ITEMS, UPGRADES, MAP, BUNDLES, parcelCost, upgradeCost, QZONES, PROJECTS, MATS, PERKS } from '../js/data.js';
import { merchantHere, stockOf, soldOut } from '../js/merchant.js';
import { canPlantNow, seasonAt } from '../js/seasons.js';

const q = new URLSearchParams(location.search);
const HOURS = +(q.get('h') || 72);
const T0 = Date.UTC(2026, 2, 2, 9); // a Monday in spring
const s0 = newGame(T0); s0.simTime = T0;
const w = new World(s0), s = w.state;
const out = document.getElementById('out');
const log = [];
const note = (t, text) => { log.push([t, text]); };
const hrs = (t) => `${(t / 3600).toFixed(1)}h`;

const MAJOR = Object.keys(DEFS).filter((k) => ['craft', 'animal'].includes(DEFS[k].cat));
const roleWant = { farmer: 0.36, hauler: 0.22, artisan: 0.18, rancher: 0.12, miner: 0.12 };
const clear = (x0, y0, cw, ch) => { for (let y = y0; y < y0 + ch; y++) for (let x = x0; x < x0 + cw; x++) { const o = w.objAt(x, y); if (o && o.type !== 'plot' && !DEFS[o.type].cat.startsWith('path')) return false; } return true; };
const free = (type) => {
  const d = DEFS[type];
  for (let y = 0; y < MAP.h; y++) for (let x = 0; x < MAP.w; x++) if (w.canPlace(type, x, y) === '') {
    // leave a one-tile walkway around buildings so doors stay reachable
    if (d.cat !== 'field' && !clear(x - 1, y - 1, d.w + 2, d.h + 2)) continue;
    return [x, y];
  }
  return null;
};
const value = (c) => (ITEMS[c].value * CROPS[c].yield) / CROPS[c].time;
const bestCrops = (t) => Object.keys(s.seeds).filter((c) => canPlantNow(c, seasonAt(t))).sort((a, b) => value(b) - value(a)).slice(0, 4);

function candidates(now) {
  const list = [];
  const add = (cost, what, fn) => list.push({ cost, what, fn });
  const roles = Object.keys(roleWant);
  if (s.workers.length < w.housing) {
    const n = s.workers.length + 1;
    const ok = roles.filter((r) => r !== 'miner' || s.quarry);
    const role = ok.sort((a, b) => (s.workers.filter((x) => x.role === a).length - roleWant[a] * n) - (s.workers.filter((x) => x.role === b).length - roleWant[b] * n))[0];
    const r = s.workers.some((x) => x.role === 'farmer') ? role : 'farmer';
    add(E.nextHireCost(w), `hire ${r}`, () => E.hire(w, r));
  } else if (E.unlocked(w, 'cottage')) add(E.costOf(w, 'cottage'), 'cottage', () => placeAny('cottage'));
  for (const c in CROPS) if (!s.seeds[c] && s.level >= CROPS[c].level) add(CROPS[c].cost, `seed ${c}`, () => E.buySeed(w, c));
  const farmers = s.workers.filter((x) => x.role === 'farmer').length;
  if (w.plots.length < farmers * 9) {
    const crops = bestCrops(now);
    add(E.costOf(w, 'plot'), 'plot', () => placeAny('plot', { crop: crops[w.plots.length % crops.length] }));
  }
  for (const t of MAJOR) if (E.unlocked(w, t) && !w.count(t)) add(E.costOf(w, t), t, () => placeAny(t));
  for (const u of UPGRADES) { const l = s.upgrades[u.id] || 0; if (l < u.max && s.level >= u.level) add(upgradeCost(u, l), `upgrade ${u.id}`, () => E.buyUpgrade(w, u.id)); }
  if (w.used() > w.capacity * 0.8) for (const b of w.storages) if (b.lvl < DEFS[b.type].maxLvl) { add(E.bUpgradeCost(b), `upgrade ${b.type}`, () => E.upgradeBuilding(w, b)); break; }
  for (const b of w.bldgs.concat(w.animals)) if (b.lvl < DEFS[b.type].maxLvl && b.lvl < 3) add(E.bUpgradeCost(b) * 1.5, `upgrade ${b.type}`, () => E.upgradeBuilding(w, b));
  const k = E.parcelsBought(s);
  const spots = [];
  const PW = MAP.w / MAP.parcel, PH = MAP.h / MAP.parcel, edge = ([x, y]) => Math.min(x, PW - 1 - x, y, PH - 1 - y);
  for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) if (E.parcelBuyable(w, px, py)) spots.push([px, py]);
  if (!s.quarry) spots.sort((a, b) => edge(a) - edge(b)); // head for the quarry trail first
  if (spots.length) { const [px, py] = spots[0]; add(parcelCost(k), 'land', () => E.buyParcel(w, px, py)); }
  if (s.quarry) {
    for (let i = s.quarry.zones; i < QZONES.length; i++) if (!E.zoneBlock(w, i)) { add(QZONES[i].cost, `zone ${QZONES[i].name}`, () => E.openZone(w, i)); break; }
    if (MATS.some((k) => w.mat(k) >= w.shedCap * 0.9) && (s.shed || 1) < 8) add(400 * Math.pow(2.1, (s.shed || 1) - 1), 'shed', () => E.upgradeShed(w));
  }
  const v = merchantHere(w, now);
  if (v) for (const o of stockOf(v.k)) if (o.key.startsWith('perk:') && !soldOut(s, v, o.key)) add(o.price, o.key, () => E.buyOffer(w, o.key, now));
  return list.sort((a, b) => a.cost - b.cost);
}
let noRoom = 0;
const fails = {};
function placeAny(type, extra) {
  const at = free(type);
  if (!at) { noRoom++; return 'no room'; }
  return E.place(w, type, at[0], at[1], extra);
}

function act(t, now) {
  for (const k in s.inv) if (s.inv[k] > 12) E.sell(w, k, s.inv[k] - 12); // an all-day player sells as they go
  for (const o of [...s.orders]) if (E.canFill(w, o)) E.fillOrder(w, o);
  for (const id in BUNDLES) if (E.bundleState(w, id).canGive) E.giveBundle(w, id);
  if (!s.quarry) E.discoverQuarry(w);
  for (const d of [...w.debris]) if (Math.random() < 0.3) E.remove(w, d); // tapping debris now and then
  // keep a reserve of coins and materials for buildings, give the rest to the village
  for (const p of PROJECTS) if (!s.village.done[p.id] && (E.projectState(w, p.id).canGive || E.projectState(w, p.id).canPay) && s.coins > 20000 + (p.needs.coins || 0) * 0.3) { const c = s.coins; s.coins = Math.max(0, c - 20000); E.giveProject(w, p.id); E.giveProject(w, p.id, true); s.coins += Math.min(c, 20000); }
  s.coins += s.pendingCoins; s.pendingCoins = 0;
  const failed = new Set();
  for (let i = 0; i < 12; i++) {
    const c = candidates(now).find((x) => x.cost <= s.coins && !failed.has(x.what));
    if (!c) break;
    const lvl = s.level;
    const why = c.fn();
    if (why !== '') { failed.add(c.what); if (!fails[c.what + why]) { fails[c.what + why] = 1; note(t, `✗ ${c.what}: ${why}`); } continue; }
    if (c.what in DEFS || c.what.startsWith('seed') || c.what === 'land' || c.what.startsWith('zone') || c.what.startsWith('perk')) note(t, `${c.what} (${Math.round(c.cost)})`);
    if (s.level !== lvl) break;
  }
}

const milestones = {};
const mark = (k, t) => { if (!(k in milestones)) { milestones[k] = t; note(t, `★ ${k}`); } };
const t0 = performance.now();
let t = 0, lastLvl = 0;
const END = HOURS * 3600;
async function run() {
  while (t < END) {
    for (let i = 0; i < 300; i++, t += 2) {
      const now = T0 + t * 1000;
      step(w, 2, true, now);
      if (t % 20 === 0) act(t, now);
      w.events.length = 0;
    }
    if (s.level !== lastLvl) { lastLvl = s.level; if (s.level % 5 === 0 || [3, 17].includes(s.level)) mark(`level ${s.level}`, t); }
    if (MAJOR.every((k) => w.count(k))) mark('every building', t);
    if (Object.keys(CROPS).every((c) => s.seeds[c])) mark('every crop', t);
    if (s.map.owned.every(Boolean)) mark('all land', t);
    if (UPGRADES.every((u) => (s.upgrades[u.id] || 0) >= u.max)) mark('every upgrade maxed', t);
    if (s.quarry) mark('quarry found', t);
    for (const p of PROJECTS) if (s.village.done[p.id]) mark(`restored ${p.name}`, t);
    if (s.quarry && s.quarry.zones === QZONES.length) mark('all quarry zones', t);
    if (t % 3600 < 600) report();
    await new Promise((r) => setTimeout(r));
  }
  report(true);
}
function report(done) {
  const ms = Object.entries(milestones).map(([k, v]) => `<b>${k}</b>: ${hrs(v)}`).join('<br>');
  out.innerHTML = `<h2>${done ? 'Done' : 'Running'} ${hrs(t)} of ${HOURS}h · ${Math.round((performance.now() - t0) / 1000)}s</h2>
    <p>Level ${s.level}, coins ${Math.round(s.coins)}, mats ${JSON.stringify(s.mats)}, earned ${Math.round(s.stats.earned)}, ${s.workers.length} farmhands, ${w.plots.length} plots, ${s.objects.length} objects, ${s.map.owned.filter(Boolean).length} parcels, no room ${noRoom}</p>
    <h3>Milestones</h3><p>${ms}</p><h3>Log</h3><pre>${log.map(([a, b]) => `${hrs(a).padStart(6)}  ${b}`).join('\n')}</pre>`;
  window.__pacing = { done, milestones, level: s.level, t, log };
}
run();
