// In-browser test suite. Open tests/index.html on the dev server.
import { World, newGame, newWorker, migrate, sellPrice, doorTile, initObject, effects } from '../js/world.js';
import { step, curRecipe, makeOrder } from '../js/sim.js';
import * as E from '../js/economy.js';
import { serialize, catchUp } from '../js/save.js';
import * as Cloud from '../js/cloud.js';
import { DEFS, CROPS, ITEMS, MAP } from '../js/data.js';

const results = [];
const T0 = Date.UTC(2026, 0, 1, 12);
function ok(cond, name, info = '') { results.push({ pass: !!cond, name, info }); }
const run = (w, secs, fast = true, dt = fast ? 1 : 0.05) => { for (let t = 0; t < secs; t += dt) step(w, dt, fast, (w._t = (w._t || T0) + dt * 1000)); };
// New farms start empty; most tests use a little working farm instead:
// six wheat plots, a farmer and a hauler.
// Tests build instantly and without stray debris, unless a test asks otherwise.
const empty = () => {
  const s = newGame(T0); s.simTime = T0;
  s.objects = s.objects.filter((o) => DEFS[o.type].cat !== 'debris'); s.debrisT = -1e12;
  const w = new World(s); w.state.nextOrderAt = T0 + 1e12; w.instantBuild = true; return w;
};
const fresh = () => {
  const w = empty(), s = w.state;
  for (const [x, y] of [[19, 21], [20, 21], [21, 21], [19, 22], [20, 22], [21, 22]]) s.objects.push(initObject({ id: s.nextId++, type: 'plot', x, y, crop: 'wheat' }));
  newWorker(s, 'farmer', 'Pip'); newWorker(s, 'hauler', 'Bea');
  s.workers[0].x = 20.5; s.workers[0].y = 20.5; s.workers[1].x = 23.5; s.workers[1].y = 19.5;
  w.rebuild();
  return w;
};
const rich = (w, level = 12, coins = 1e7) => { w.state.level = level; w.state.coins = coins; for (const c in CROPS) w.state.seeds[c] = true; w.state.mats = { wood: 1e6, stone: 1e6, copper: 1e6, iron: 1e6, gold: 1e6 }; w.rebuild(); };

// 1. crop growth rate
{
  const w = fresh();
  const p = w.plots[0];
  p.st = 'grow'; p.p = 0; p.wet = false;
  for (const x of w.state.workers) x.role = 'hauler';
  w.state.settings.helpers = false;
  const before = w.raining;
  run(w, CROPS.wheat.time / 2, true);
  ok(w.raining || Math.abs(p.p - 0.5) < 0.02 || p.p > 0.5, 'Wheat grows half way in half its grow time (unwatered)', `p=${p.p.toFixed(3)} rain=${w.raining || before}`);
  p.p = 0.99; run(w, 2, true);
  ok(p.st === 'ripe', 'Crop becomes ripe at 100%');
}

// 2. starting farm produces on its own (fast mode)
{
  const w = fresh();
  run(w, 600, true);
  const h = w.state.stats.harvest.wheat || 0;
  ok(h >= 40, 'Starting farm harvests wheat in 10 minutes (fast sim)', `harvested ${h}, stored ${w.have('wheat')}, piles ${w.state.piles.length}`);
  ok(w.used() <= w.capacity, 'Storage never exceeds capacity', `${w.used()}/${w.capacity}`);
}

// 3. live mode with real pathfinding
{
  const w = fresh();
  run(w, 150, false);
  const h = w.state.stats.harvest.wheat || 0;
  ok(h >= 8, 'Live farmhands walk, harvest and deliver (2.5 min)', `harvested ${h}, stored ${w.have('wheat')}`);
  ok(w.state.workers.every((x) => w.walkable(Math.floor(x.x), Math.floor(x.y))), 'Farmhands stay on walkable ground');
}

// 4. economy: sell & auto-sell with a reserve
{
  const w = fresh();
  w.state.inv = { wheat: 30 };
  const coins = w.state.coins;
  const got = E.sell(w, 'wheat', 10);
  ok(got === sellPrice(w, 'wheat') * 10 && w.state.coins === coins + got, 'Selling adds coins at the listed price', `+${got}`);
  ok(w.state.stats.earned === got && w.state.xp === got, 'Earnings give the same XP');
  ok(E.sell(w, 'wheat', 999) === sellPrice(w, 'wheat') * 20 && w.have('wheat') === 0, 'Selling more than you have sells the whole stack');
  ok(typeof E.autoSellAll === 'undefined', 'There is no auto-sell any more');
  w.state.xp = 0; w.state.level = 1; E.earn(w, 70);
  ok(w.state.level === 2, 'Earning XP levels up the farm', `level ${w.state.level}`);
}

// 5. placement rules
{
  const w = fresh();
  w.state.coins = 1e6;
  ok(E.place(w, 'plot', 0, 0, { crop: 'wheat' }) === 'Not your land yet', 'Cannot build on land you do not own');
  ok(E.place(w, 'plot', 19, 21, { crop: 'wheat' }) === 'Something is already here', 'Cannot stack objects');
  const [dx, dy] = doorTile(w.objects.find((o) => o.type === 'board'));
  w.state.level = 5; w.rebuild();
  const why = E.place(w, 'bush', dx, dy);
  ok(why.includes('entrance'), 'Cannot block a building entrance', why);
  ok(E.place(w, 'plot', 24, 22, { crop: 'carrot' }) === '', 'Placing a plot works on owned land');
  const c0 = E.costOf(w, 'plot');
  E.place(w, 'plot', 25, 22, { crop: 'carrot' });
  ok(E.costOf(w, 'plot') > c0, 'Each extra plot costs a little more');
  ok(E.remove(w, w.objects.find((o) => o.type === 'barn')).includes('storage'), 'Cannot remove the only storage');
}

// 6. land
{
  const w = fresh();
  w.state.coins = 1e6;
  ok(E.buyParcel(w, 0, 0) !== '', 'Cannot buy land that is not next to the farm');
  ok(E.buyParcel(w, 2, 1) === '' && w.ownedTile(16, 8), 'Buying an adjacent parcel works');
  ok(E.buyParcel(w, 2, 0) === '', 'A second parcel is allowed at level 1');
  const why = E.buyParcel(w, 3, 1);
  ok(why === 'Reach farm level 2 first', 'Later parcels need a higher farm level', why);
}

// 7. production chain: wheat -> flour, coop eggs, bakery bread
{
  const w = fresh();
  rich(w, 6);
  const s = w.state;
  E.buyParcel(w, 2, 1); E.buyParcel(w, 3, 1);
  const put = (type, x, y) => { const why = E.place(w, type, x, y); ok(why === '', `${DEFS[type].name} placed`, why); };
  put('mill', 17, 9); put('coop', 20, 9); put('bakery', 23, 9); put('silo', 27, 9); put('cottage', 30, 9);
  for (let x = 16; x < 32; x++) for (const y of [13, 14, 21, 22, 23]) if (!w.objAt(x, y)) E.place(w, 'plot', x, y, { crop: 'wheat' });
  for (const r of ['artisan', 'rancher', 'hauler']) ok(E.hire(w, r) === '', `Hired ${r}`);
  run(w, 1800, true);
  const st = s.stats;
  ok((st.craft.flour || 0) > 5, 'Mill makes flour', `flour ${st.craft.flour || 0}`);
  ok((st.harvest.egg || 0) > 5, 'Hens lay eggs when fed', `eggs ${st.harvest.egg || 0}`);
  ok((st.craft.bread || 0) > 0, 'Bakery bakes bread from flour + eggs', `bread ${st.craft.bread || 0}`);
  ok(s.workers.some((x) => x.lvl > 1), 'Farmhands gain levels by working', s.workers.map((x) => x.lvl).join(','));
  run(w, 240, false);
  ok(true, 'Production farm runs live without errors', `bread ${st.craft.bread || 0}`);
}

// 8. orders
{
  const w = fresh();
  rich(w, 3);
  const o = makeOrder(w);
  ok(o && o.items.length >= 1 && o.reward > 0, 'Orders are generated', JSON.stringify(o?.items));
  w.state.orders = [o];
  for (const x of o.items) w.state.inv[x.item] = x.qty;
  w.capacity = 1e6;
  const c = w.state.coins;
  ok(E.fillOrder(w, o) === '' && w.state.coins === c + o.reward, 'Filling an order pays the reward');
}

// 9. save / load roundtrip
{
  const w = fresh();
  run(w, 300, false);
  const json = serialize(w.state);
  ok(!/"_c"|"_busy"|"job"/.test(json), 'Runtime fields are not saved');
  const s2 = migrate(JSON.parse(json));
  const w2 = new World(s2);
  ok(w2.objects.length === w.objects.length && w2.state.workers.length === w.state.workers.length && w2.used() === w.used(), 'Save loads back identically');
  run(w2, 60, false);
  ok(true, 'Loaded farm keeps running');
}

// 10. offline catch-up and cap
{
  const w = fresh();
  const c0 = w.state.coins;
  const sum = await catchUp(w, 2 * 3600 * 1000);
  ok(sum.harvest.wheat > 50 && w.have('wheat') > 0, 'Two hours away: farm keeps harvesting into storage', `wheat ${sum.harvest.wheat}`);
  ok(!w.state.pendingCoins && w.state.coins <= c0, 'Nothing gets sold while you are away', `coins ${c0} -> ${w.state.coins}`);
  const w2 = fresh();
  const t = performance.now();
  const s2 = await catchUp(w2, 30 * 3600 * 1000);
  ok(s2.capped && s2.ms === 8 * 3600 * 1000, 'Offline time is capped at 8h by default');
  ok(performance.now() - t < 8000, 'Catch-up is fast', `${Math.round(performance.now() - t)}ms for 8h`);
}

// 11. big farm performance (offline 8h)
{
  const w = fresh();
  rich(w, 14);
  for (const [px, py] of [[2, 1], [3, 1], [1, 2], [4, 2], [2, 3], [3, 3]]) E.buyParcel(w, px, py);
  let n = 0;
  for (let y = 8; y < 32; y++) for (let x = 8; x < 40; x++) if ((x + y) % 5 && n < 220 && E.place(w, 'plot', x, y, { crop: ['wheat', 'corn', 'tomato', 'grapes'][n % 4] }) === '') n++;
  E.place(w, 'cottage', 8, 8); E.place(w, 'cottage', 10, 8); E.place(w, 'cottage', 12, 8); E.place(w, 'cottage', 36, 8); E.place(w, 'cottage', 38, 8);
  while (E.hire(w, 'farmer') === '');
  const t = performance.now();
  await catchUp(w, 8 * 3600 * 1000);
  const ms = performance.now() - t;
  ok(ms < 15000, 'Large farm (220 plots, 13 farmhands) simulates 8h quickly', `${Math.round(ms)}ms, harvested ${Object.values(w.state.stats.harvest).reduce((a, b) => a + b, 0)}`);
}

// 12. cloud sync against a fake Supabase
{
  const db = { row: null };
  const fake = async (url, opts) => {
    const u = new URL(url);
    const body = opts.body ? JSON.parse(opts.body) : null;
    const reply = (j, status = 200) => ({ ok: status < 300, status, text: async () => JSON.stringify(j) });
    if (u.pathname.endsWith('/token')) return reply({ access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: 'u1', email: 't@x' } });
    if (u.pathname.endsWith('/meadow_saves')) {
      if (opts.method === 'POST') { if (db.row) return reply({ code: '23505' }, 409); db.row = { ...body }; return reply([db.row], 201); }
      if (opts.method === 'PATCH') {
        const rev = +u.searchParams.get('rev').slice(3);
        if (!db.row || db.row.rev !== rev) return reply([]);
        Object.assign(db.row, body); return reply([db.row]);
      }
      return reply(db.row ? [db.row] : []);
    }
    return reply({});
  };
  Cloud._setFetch(fake);
  localStorage.removeItem('meadow.session'); localStorage.removeItem('meadow.sync.u1');
  await Cloud.signIn('t@x', 'pw');
  const w = fresh();
  let r = await Cloud.push(serialize(w.state));
  ok(r.ok && db.row.rev === 1, 'First upload creates the cloud save');
  w.state.coins = 999;
  r = await Cloud.push(serialize(w.state));
  ok(r.ok && db.row.rev === 2 && db.row.data.coins === 999, 'Later uploads update it');
  db.row.rev = 3; db.row.data.coins = 4242; // another device saved
  r = await Cloud.push(serialize(w.state));
  ok(r.conflict && r.conflict.data.coins === 4242, 'A newer save from another device is detected, not overwritten');
  const pulled = await Cloud.pull();
  ok(pulled.rev === 3, 'Pull returns the newest save');
  // sign-up: disabled projects give a clear message; enabled ones sign straight in
  const realFetch = fake;
  Cloud._setFetch(async (url, opts) => (new URL(url).pathname.endsWith('/signup')
    ? { ok: false, status: 422, text: async () => JSON.stringify({ code: 'signup_disabled', msg: 'Signups not allowed for this instance' }) }
    : realFetch(url, opts)));
  let msg = ''; try { await Cloud.signUp('new@x', 'secret1'); } catch (e) { msg = e.message; }
  ok(/switched off/.test(msg), 'Create account explains when sign-ups are off', msg);
  Cloud._setFetch(fake);
  await Cloud.signOut();
  localStorage.removeItem('meadow.sync.u1');
  Cloud._setFetch((...a) => fetch(...a));
}

// 13. every recipe is reachable and adds value
{
  let bad = [];
  for (const d of Object.values(DEFS)) for (const r of d.recipes || []) {
    let v = 0; for (const k in r.in) { if (!ITEMS[k]) bad.push(`${r.out}: missing ${k}`); v += ITEMS[k].value * r.in[k]; }
    if (ITEMS[r.out].value <= v) bad.push(`${r.out} worth ${ITEMS[r.out].value} <= inputs ${v}`);
  }
  ok(!bad.length, 'Every recipe is worth more than its ingredients', bad.join('; '));
}

// 14. every sprite draws
{
  const { buildingSprite } = await import('../js/art/buildings.js');
  const { decorSprite, fenceSprite } = await import('../js/art/decor.js');
  const { cropSprite } = await import('../js/art/plants.js');
  const { itemIcon } = await import('../js/art/items.js');
  let errs = [];
  for (const [k, d] of Object.entries(DEFS)) {
    try {
      if (d.cat === 'decor') decorSprite(k); else if (d.cat === 'fence') for (let m = 0; m < 16; m++) fenceSprite(k, m);
      else if (!['field', 'tree', 'path'].includes(d.cat)) buildingSprite(k);
    } catch (e) { errs.push(`${k}: ${e.message}`); }
  }
  for (const c in CROPS) for (let st = 0; st < 4; st++) try { cropSprite(c, st); } catch (e) { errs.push(`${c}${st}: ${e.message}`); }
  for (const i in ITEMS) try { itemIcon(i); } catch (e) { errs.push(`${i}: ${e.message}`); }
  ok(!errs.length, 'All sprites draw without errors', errs.join('; '));
}

// 15. full storage: harvests stop instead of piling up forever
{
  const w = fresh();
  run(w, 3 * 3600, true, 2);
  const piled = w.state.piles.reduce((a, p) => a + p.qty, 0);
  ok(w.used() === w.capacity && piled <= 45, 'Full storage pauses harvesting (ground piles stay small)', `stored ${w.used()}/${w.capacity}, piled ${piled}`);
  // selling makes room and the harvest starts again
  E.sell(w, 'wheat', w.have('wheat'));
  const h0 = w.state.stats.harvest.wheat;
  run(w, 600, true);
  ok(w.state.stats.harvest.wheat > h0 && w.used() > 0, 'Selling frees space and harvesting picks up again', `+${w.state.stats.harvest.wheat - h0}`);
}

// 16. expansion content
{
  const w = fresh();
  rich(w, 20);
  ok(E.place(w, 'dock', 16, 21) === 'Build it right next to water', 'Fishing dock must be built beside water');
  // buy land toward the east stream and find a spot touching water
  for (const [px, py] of [[4, 2], [5, 2]]) E.buyParcel(w, px, py);
  let placed = '';
  for (let x = 38; x < 46 && !placed; x++) for (let y = 16; y < 22 && !placed; y++) if (E.place(w, 'dock', x, y) === '') placed = `${x},${y}`;
  ok(placed, 'Fishing dock can be built at the stream', placed);
  E.place(w, 'cottage', 16, 21);
  E.hire(w, 'rancher');
  for (let i = 0; i < 12; i++) { run(w, 100, true); E.sell(w, 'wheat', w.have('wheat')); }
  ok(w.have('fish') > 0, 'Docks catch fish that ranchers bring in', `fish ${w.state.stats.harvest.fish || 0}, stored ${w.have('fish')}`);
  // achievements & hats
  w.state.stats.harvest.wheat = 20000;
  const { ACHIEVEMENTS, HATS } = await import('../js/data.js');
  ok(E.claimableAch(w) > 0, 'Achievements become claimable');
  let n = 0; while (E.claimAch(w, 'harvest') === '') n++;
  ok(n === 3 && E.hatUnlocked(w.state, 'flowercrown'), 'Claiming Green Thumb III unlocks the Flower Crown', `claimed ${n}`);
  ok(!E.hatUnlocked(w.state, 'beanie') && E.buyHat(w, 'beanie') === '' && E.hatUnlocked(w.state, 'beanie'), 'Hats can be bought');
  ok(Object.values(HATS).every((h) => !h.ach || ACHIEVEMENTS.some((a) => h.ach.startsWith(a.id + ':') && +h.ach.split(':')[1] < a.tiers.length)), 'Every earned hat points to a real achievement tier');
  // every crop and recipe is reachable within the level cap and every input is producible
  const { DEFS: D, CROPS: CR, ITEMS: IT } = await import('../js/data.js');
  const sources = new Set(Object.keys(CR));
  for (const d of Object.values(D)) { if (d.fruit) sources.add(d.fruit); if (d.animal) sources.add(d.animal.item); if (d.hive) sources.add(d.hive.item); for (const r of d.recipes || []) sources.add(r.out); for (const k in d.gives || {}) sources.add(k); }
  const { QNODES } = await import('../js/data.js');
  for (const n of Object.values(QNODES)) { sources.add(n.item); if (n.gem) sources.add('gem'); }
  const DD = await import('../js/data.js');
  for (const f of DD.FISH) sources.add(f.id); for (const k of Object.values(DD.ANIMAL_TREASURE)) sources.add(k); for (const k of DD.FINDS.flat()) sources.add(k);
  const orphans = Object.keys(IT).filter((k) => !sources.has(k));
  ok(!orphans.length, 'Every item can actually be obtained', orphans.join(', '));
}

// 17. seasons, festivals and pets
{
  const SE = await import('../js/seasons.js');
  const D = await import('../js/data.js');
  const DAY = 86400000;
  const mon = Date.UTC(2026, 10, 2, 12); // a Monday
  const seen = new Set([0, 7, 14, 21].map((k) => SE.seasonAt(mon + k * DAY).id));
  ok(seen.size === 4, 'Four seasons rotate week by week', [...seen].join(','));
  ok(SE.seasonAt(mon).id === SE.seasonAt(mon + 6 * DAY).id, 'A season lasts the whole week');
  const sat = new Date(2026, 10, 7, 12).getTime(), wed = new Date(2026, 10, 4, 12).getTime();
  ok(SE.festivalOn(sat) && !SE.festivalOn(wed), 'Festivals run on weekends only');
  const spring = D.SEASONS[0], winter = D.SEASONS[3];
  ok(SE.seasonGrowth('strawberry', spring) === D.SEASON_BONUS && SE.seasonGrowth('wheat', winter) === D.WINTER_SLOW, 'In-season crops grow faster, others slower in winter');
  ok(!SE.canPlantNow('asparagus', winter) && SE.canPlantNow('asparagus', spring), 'Seasonal crops can only be planted in their season');
  // festival orders appear on a weekend and pay ribbons
  const w = fresh();
  rich(w, 8);
  w.state.inv = {}; w.capacity = 1e6;
  step(w, 1, true, sat);
  const fo = w.state.fest && w.state.fest.orders;
  ok(fo && fo.length === 3, 'A festival weekend posts festival orders', fo && fo.length);
  for (const x of fo[0].items) w.state.inv[x.item] = x.qty;
  const r0 = w.state.ribbons, gain = fo[0].ribbons;
  ok(E.fillFestOrder(w, fo[0], sat) === '' && w.state.ribbons === r0 + gain, 'Festival orders pay ribbons', `+${gain}`);
  ok(E.fillFestOrder(w, w.state.fest.orders[0], wed) === 'The festival is over', 'Festival orders close after the weekend');
  // pets
  const c0 = w.charm;
  ok(E.adoptPet(w, 'cat', 1) === '' && w.state.pets.length === 1 && w.charm === c0 + 5, 'Adopting a pet works and adds charm');
  E.patPet(w); E.patPet(w);
  ok(w.state.stats.pats === 2, 'Pats are counted');
  for (let k = 0; k < 3; k++) E.adoptPet(w, 'dog', 0);
  ok(E.adoptPet(w, 'fox', 0).includes('up to'), 'Pet count is limited');
}

// 18. a new farm starts empty, with enough coins to get going
{
  const w = empty();
  ok(w.state.workers.length === 0 && w.plots.length === 0 && !w.have('wheat'), 'A new farm has no farmhands, fields or crops');
  const c = w.state.coins;
  ok(E.hire(w, 'farmer') === '', 'You can hire your first farmer');
  let cost = c - w.state.coins, n = 0;
  for (const [x, y] of [[19, 21], [20, 21], [21, 21], [19, 22]]) if (E.place(w, 'plot', x, y, { crop: 'wheat' }) === '') n++;
  ok(n === 4 && w.state.coins >= 0, 'Starting coins cover a farmer and four plots', `hire ${cost}, left ${w.state.coins}`);
  run(w, 300, true);
  ok((w.state.stats.harvest.wheat || 0) > 0, 'That farmer plants and harvests on their own', `harvested ${w.state.stats.harvest.wheat || 0}`);
}

// 19. crop balance: pricier crops cost more to plant and take longer
{
  const D = await import('../js/data.js');
  const harvest = (c) => ITEMS[c].value * CROPS[c].yield;
  const uses = (c) => (D.USES[c] || []).length;
  const plain = Object.keys(CROPS).filter((c) => !CROPS[c].regrow && !CROPS[c].season);
  const bad = [];
  for (const a of plain) for (const b of plain) {
    // more uses may make a crop slower, never faster
    if (harvest(a) > harvest(b) && uses(a) >= uses(b) && (CROPS[a].seed < CROPS[b].seed || CROPS[a].time < CROPS[b].time)) bad.push(`${a}>${b}`);
  }
  ok(!bad.length, 'A crop that sells for more never has cheaper seeds or a shorter grow time', bad.slice(0, 4).join(' '));
  ok(CROPS.carrot.seed > CROPS.wheat.seed && CROPS.carrot.time > CROPS.wheat.time && harvest('carrot') > harvest('wheat'), 'Carrots cost more and take longer than wheat, and sell for more');
  const rate = (c) => (harvest(c) - CROPS[c].seed) / CROPS[c].time;
  ok(rate('pumpkin') > rate('carrot') && rate('carrot') > rate('wheat') * 0.9, 'Bigger crops still earn a bit more per second', `${rate('wheat').toFixed(3)} ${rate('carrot').toFixed(3)} ${rate('pumpkin').toFixed(3)}`);
  const sig = Object.keys(CROPS).map((c) => [CROPS[c].seed, CROPS[c].time, harvest(c), CROPS[c].season || '', CROPS[c].regrow || 0].join('/'));
  ok(new Set(sig).size === sig.length, 'No two crops have the same cost, sale and grow time');
}

// 20. seeds are paid when planting, and crops can't be swapped once planted
{
  const w = fresh();
  rich(w, 12, 1000);
  const p = w.plots[0];
  for (const q of w.plots) if (q !== p) { q.st = 'grow'; q.p = 0; }
  E.setCrop(w, p, 'pumpkin');
  ok(p.crop === 'pumpkin' && !p.next, 'An empty plot switches crops straight away');
  const c0 = w.state.coins;
  run(w, 20, true);
  ok(p.st === 'grow' && w.state.coins === c0 - CROPS.pumpkin.seed, 'Farmers pay for seeds when they plant', `paid ${c0 - w.state.coins}`);
  w.state.coins = 0; w.state.pendingCoins = 0;
  const q = w.plots[1]; q.st = 'empty'; E.setCrop(w, q, 'pumpkin');
  run(w, 20, true);
  ok(q.st === 'empty', 'Nothing gets planted without coins for the seeds');
  ok(CROPS.wheat.seed === 1, 'Wheat seeds are cheap but not free', `${CROPS.wheat.seed}`);
  E.setCrop(w, q, 'wheat');
  run(w, 20, true);
  ok(q.st === 'grow' && w.state.coins === 0, 'A broke farm can still plant wheat, so it never gets stuck');
  // plots are bought bare, then given a seed
  {
  const w = fresh();
  w.state.coins = 1000;
  const c1 = E.costOf(w, 'plot');
  ok(E.place(w, 'plot', 23, 21) === '', 'A bare plot can be bought');
  const b = w.objAt(23, 21);
  ok(b.crop === null && E.costOf(w, 'plot') > c1, 'It starts with no seed, and the next plot costs more', `${c1} -> ${E.costOf(w, 'plot')}`);
  ok(DEFS.plot.cost(100) > DEFS.plot.cost(50) * 2, 'Plot prices climb faster as the farm grows', `${DEFS.plot.cost(50)} / ${DEFS.plot.cost(100)}`);
  for (const q of w.plots) if (q !== b) { q.crop = 'pumpkin'; q.st = 'grow'; q.p = 0; }
  run(w, 20, true);
  ok(b.st === 'empty', 'Farmers leave a bare plot alone');
  E.setCrop(w, b, 'carrot');
  const c0 = w.state.coins;
  run(w, 20, true);
  ok(b.crop === 'carrot' && b.st === 'grow' && c0 - w.state.coins === CROPS.carrot.seed, 'Picking a seed gets it planted, paying only the seed price', `paid ${c0 - w.state.coins}`);
  }
  // switching a ripe plot doesn't change what's growing
  p.st = 'ripe'; p.p = 1;
  E.setCrop(w, p, 'carrot');
  ok(p.crop === 'pumpkin' && p.next === 'carrot', 'A planted crop stays; the new one is queued');
  w.state.coins = 1000;
  for (let i = 0; i < 30 && !(w.state.stats.harvest.pumpkin >= 1); i++) run(w, 1, true);
  ok((w.state.stats.harvest.pumpkin || 0) >= 1 && p.crop === 'carrot' && !p.next, 'After the harvest the plot switches to the new crop', `${p.crop} ${p.st} ${p.p.toFixed(2)}`);
  ok(p.st === 'empty' || p.p < 0.5, 'The new crop starts growing from scratch', `${p.st} ${p.p.toFixed(2)}`);
  E.setCrop(w, w.plots[2], 'carrot'); E.setCrop(w, w.plots[2], 'wheat');
  ok(!w.plots[2].next, 'Picking the current crop again cancels the switch');
}

// 21. farmhands keep their job; letting one go refunds half
{
  const w = fresh();
  ok(typeof E.setRole !== 'function', 'There is no way to change a farmhand’s job');
  const wk = w.state.workers[1];
  wk.carry = { item: 'wheat', qty: 3 };
  const c0 = w.state.coins, refund = E.fireRefund(w);
  E.fire(w, wk);
  ok(w.state.workers.length === 1 && w.state.coins === c0 + refund, 'Letting a farmhand go removes them and refunds coins', `+${refund}`);
  ok(w.state.piles.some((p) => p.item === 'wheat' && p.qty === 3), 'Whatever they were carrying is left on the ground');
  ok(refund * 2 === E.nextHireCost(w), 'The refund is half the price of hiring again');
  w.state.coins = 1e6; E.hire(w, 'artisan');
  ok(w.state.workers.at(-1).lvl === 1, 'New hires start at level 1');
}

// 22. every item knows what it is for
{
  const D = await import('../js/data.js');
  ok(D.USES.wheat.some((u) => u.out === 'flour') && D.USES.wheat.some((u) => u.feeds === 'chicken') && D.USES.wheat.some((u) => u.out === 'beer'), 'Wheat lists flour, ale and chicken feed');
  const missing = Object.keys(ITEMS).filter((k) => !ITEMS[k].mat && !ITEMS[k].find && !(D.SOURCES[k] || []).length);
  ok(!missing.length, 'Every item says where it comes from', missing.join(','));
}

// 23. a full barn doesn't stop one workshop from feeding another
{
  const w = empty(), s = w.state;
  rich(w, 6, 1e6);
  const put = (type) => { for (let y = 10; y < 34; y++) for (let x = 8; x < 40; x++) if (E.place(w, type, x, y) === '') return w.objAt(x, y); };
  const mill = put('mill'), bakery = put('bakery');
  newWorker(s, 'hauler', 'Bea'); newWorker(s, 'artisan', 'Cy');
  for (const k of s.workers) { k.x = 20.5; k.y = 20.5; }
  w.rebuild();
  w.addItem('carrot', 1e4);
  mill.out.flour = 6; bakery.recipe = 'potatobread'; bakery.inp.potato = 4;
  ok(w.free() <= 0, 'Storage is full', `free ${w.free()}`);
  let t = 0;
  for (; t < 300 && !(bakery.inp.flour > 0) && !(bakery.out.potatobread > 0); t++) run(w, 1, true);
  ok(bakery.inp.flour > 0 || bakery.out.potatobread > 0, 'Flour goes straight from the mill to the bakery', `after ${t}s`);
}

// 24. bundles
{
  const D = await import('../js/data.js');
  const w = empty(), s = w.state;
  rich(w, 20, 1000);
  ok(E.giveBundle(w, 'starter') === 'Nothing on the farm to give', 'An empty barn has nothing to give');
  w.addItem('wheat', 25); w.addItem('carrot', 5);
  E.giveBundle(w, 'starter');
  ok(s.bundles.give.starter.wheat === 20 && w.have('wheat') === 5 && s.bundles.give.starter.carrot === 5, 'Giving takes only what the bundle still needs');
  w.addItem('carrot', 10); w.addItem('corn', 10);
  const c0 = s.coins;
  E.giveBundle(w, 'starter', 'carrot');
  ok(!E.bundleDone(s, 'starter') && !w.have('carrot') && w.have('corn') === 10, 'Giving one item leaves the rest in storage');
  E.giveBundle(w, 'starter');
  ok(E.bundleDone(s, 'starter') && s.coins === c0 + D.BUNDLES.starter.reward.coins, 'A full bundle pays its reward', `+${s.coins - c0}`);
  ok(E.giveBundle(w, 'starter') === 'Already complete', 'A finished bundle takes nothing more');
  ok(E.seasonalBlock(w, DEFS.veggiecart) !== '' && !E.hatUnlocked(s, 'sproutcap'), 'Reward decorations and hats stay locked until earned');
  const g0 = w.fx.grow;
  for (const b of D.BUNDLE_ROOMS[0].bundles) { if (E.bundleDone(s, b.id)) continue; for (const [k, q] of Object.entries(b.items)) w.addItem(k, q); E.giveBundle(w, b.id); }
  ok(E.bundleDone(s, 'room:fields') && Math.abs(w.fx.grow - g0 - 0.05) < 1e-9, 'Filling a shelf gives its lasting bonus', `${g0} -> ${w.fx.grow}`);
  ok(E.seasonalBlock(w, DEFS.veggiecart) === '' && E.hatUnlocked(s, 'sproutcap') && E.place(w, 'veggiecart', 30, 30) !== 'Not enough coins', 'Rewards unlock once earned');
  const w2 = empty(); w2.state.level = 1;
  ok(E.giveBundle(w2, 'supper').startsWith('Opens at'), 'Bundles open with farm level');
  const missing = Object.values(D.BUNDLES).flatMap((b) => Object.keys(b.items)).filter((k) => !ITEMS[k]);
  ok(!missing.length, 'Every bundle asks for real items', missing.join(','));
  const sea = D.BUNDLE_ROOMS.find((r) => r.id === 'seasons').bundles;
  ok(sea.every((b) => Object.keys(b.items).some((k) => CROPS[k] && CROPS[k].season === b.season)), 'Each seasonal bundle needs a crop from its own season');
  const m = migrate(JSON.parse(JSON.stringify({ ...s, bundles: undefined })));
  ok(m.bundles && m.bundles.done && m.bundles.give, 'Old saves get an empty pantry');
}

// 25. workshop pantries hold their own ingredients
{
  const S = await import('../js/sim.js');
  const w = empty(), s = w.state;
  rich(w, 20, 1e6);
  const put = (type) => { for (let y = 10; y < 34; y++) for (let x = 8; x < 40; x++) if (E.place(w, type, x, y) === '') return w.objAt(x, y); };
  const bakery = put('bakery');
  newWorker(s, 'hauler', 'Bea');
  s.workers[0].x = 20.5; s.workers[0].y = 20.5;
  w.rebuild();
  for (const k of ['flour', 'egg', 'sugar', 'butter', 'potato', 'apple', 'cornmeal']) w.addItem(k, 8);
  const before = w.used();
  run(w, 240, true);
  const kinds = Object.keys(bakery.inp).length, used = S.pantryUsed(bakery);
  ok(kinds >= 4, 'Haulers stock the bakery with many different ingredients', JSON.stringify(bakery.inp));
  ok(used <= S.pantryCap(bakery) + 6 && w.used() < before, 'The pantry stays within its size and the barn empties', `${used}/${S.pantryCap(bakery)}, barn ${before} -> ${w.used()}`);
  const cap0 = S.pantryCap(bakery), c0 = s.coins, cost = E.pantryCost(bakery);
  ok(E.upgradePantry(w, bakery) === '' && S.pantryCap(bakery) > cap0 && s.coins === c0 - cost, 'Upgrading the pantry holds more', `${cap0} -> ${S.pantryCap(bakery)} for ${cost}`);
  bakery.recipe = 'cornbread'; S.curRecipe(w, bakery);
  ok(Object.keys(bakery.inp).length >= kinds - 1, 'Switching recipes keeps ingredients in the pantry', JSON.stringify(bakery.inp));
  // harvests go straight into a pantry that wants them
  const w2 = fresh(); rich(w2, 20, 1e6);
  let mill; for (let y = 10; y < 34 && !mill; y++) for (let x = 8; x < 40 && !mill; x++) if (E.place(w2, 'mill', x, y) === '') mill = w2.objAt(x, y);
  w2.state.settings.helpers = false;
  run(w2, 400, true);
  ok((mill.inp.wheat || 0) + (mill.out.flour || 0) + (w2.state.stats.craft.flour || 0) > 0 && (mill.inp.wheat || 0) <= S.pantryCap(mill), 'Wheat goes into the mill’s pantry', JSON.stringify(mill.inp));
}

// 26. switching buildings off, and pantry stock usable anywhere
{
  const S = await import('../js/sim.js');
  const w = empty(), s = w.state;
  rich(w, 20, 1e6);
  const put = (type) => { for (let y = 10; y < 34; y++) for (let x = 8; x < 40; x++) if (E.place(w, type, x, y) === '') return w.objAt(x, y); };
  const a = put('bakery'), b = put('bakery'), coop = put('coop');
  newWorker(s, 'hauler', 'Bea'); newWorker(s, 'artisan', 'Art');
  for (const wk of s.workers) { wk.x = 20.5; wk.y = 20.5; }
  w.rebuild();
  a.off = true; a.inp = { flour: 10, egg: 4 };
  coop.off = true; coop.feed = 3;
  b.recipe = 'bread';
  ok(S.pantryWant(w, a, 'flour') === 0, 'A switched-off workshop wants no ingredients');
  ok(w.haveAll('flour') === 10 && w.have('flour') === 0, 'Pantry stock counts as yours', `${w.haveAll('flour')}`);
  run(w, 300, true);
  ok((s.stats.craft.bread || 0) > 0 && (a.inp.flour || 0) < 10, 'Haulers carry flour from a switched-off bakery to one that needs it', `bread ${s.stats.craft.bread}, left ${JSON.stringify(a.inp)}`);
  ok(coop.feed === 3 && coop.out === 0, 'A switched-off coop rests and doesn’t eat', `feed ${coop.feed} out ${coop.out}`);
  // a workshop not using an ingredient right now shares it with one that is
  const w2 = empty(); rich(w2, 20, 1e6);
  const put2 = (type) => { for (let y = 10; y < 34; y++) for (let x = 8; x < 40; x++) if (E.place(w2, type, x, y) === '') return w2.objAt(x, y); };
  const c = put2('bakery'), d = put2('bakery');
  newWorker(w2.state, 'hauler', 'Bea'); w2.state.workers[0].x = 20.5; w2.state.workers[0].y = 20.5; w2.rebuild();
  c.recipe = 'cornbread'; c.inp = { flour: 6 }; d.recipe = 'bread'; d.inp = { egg: 2 };
  run(w2, 120, true);
  ok((d.inp.flour || 0) > 0, 'Spare flour moves to the bakery making bread', JSON.stringify(d.inp));
  // orders, selling and bundles reach into pantries
  const w3 = empty(); rich(w3, 20, 1e6);
  let mill; for (let y = 10; y < 34 && !mill; y++) for (let x = 8; x < 40 && !mill; x++) if (E.place(w3, 'mill', x, y) === '') mill = w3.objAt(x, y);
  w3.rebuild(); mill.off = true; mill.inp = { wheat: 30 }; w3.addItem('wheat', 2);
  const order = { id: 999, from: 'Test', items: [{ item: 'wheat', qty: 10 }], reward: 50, xp: 5 };
  w3.state.orders.push(order);
  ok(E.canFill(w3, order) && E.fillOrder(w3, order) === '' && w3.have('wheat') === 0 && mill.inp.wheat === 22, 'Orders use storage first, then the mill’s pantry', JSON.stringify(mill.inp));
  const c0 = w3.state.coins;
  ok(E.sell(w3, 'wheat', 5) > 0 && mill.inp.wheat === 17 && w3.state.coins > c0, 'Selling reaches into a pantry', JSON.stringify(mill.inp));
}

// 27. building materials, construction, debris and the quarry
{
  const D = await import('../js/data.js');
  const Q = await import('../js/quarry.js');
  const w = empty(), s = w.state;
  s.level = 12; s.coins = 1e6; s.mats = {};
  const spot = (type) => { for (let y = 16; y < 24; y++) for (let x = 16; x < 32; x++) if (w.canPlace(type, x, y) === '') return [x, y]; };
  const [mx, my] = spot('mill');
  const c0 = s.coins;
  ok(/Needs/.test(E.place(w, 'mill', mx, my)) && s.coins === c0, 'Without wood and stone a building can’t be bought (and costs nothing)');
  const need = D.matsFor('mill', 0);
  s.mats = { ...need };
  w.instantBuild = false;
  ok(E.place(w, 'mill', mx, my) === '' && !w.mat('wood') && !w.mat('stone'), 'Buying it uses up the materials', JSON.stringify(s.mats));
  const mill = w.objAt(mx, my);
  ok(mill.build > 0 && !w.bldgs.includes(mill) && w.sites.includes(mill), 'A new building starts as a construction site that does nothing yet', `${mill.build}s`);
  const coins1 = s.coins;
  ok(E.remove(w, mill) === '' && s.coins === coins1 + mill.paid.coins && w.mat('wood') === need.wood, 'Removing an unfinished building gives everything back');
  s.mats = { ...need }; E.place(w, 'mill', mx, my);
  const m2 = w.objAt(mx, my), T = m2.build;
  run(w, T + 2, true);
  ok(!m2.build && w.bldgs.includes(m2), 'It starts working once the time is up', `took ${T}s`);
  // a farmhand helping makes it go up faster
  const w2 = fresh(); rich(w2, 12); w2.instantBuild = false;
  for (const x of w2.state.workers) x.role = 'hauler';
  w2.state.settings.helpers = true;
  let at; for (let y = 16; y < 24 && !at; y++) for (let x = 22; x < 32 && !at; x++) if (w2.canPlace('bakery', x, y) === '') at = [x, y];
  E.place(w2, 'bakery', at[0], at[1]);
  const b = w2.objAt(at[0], at[1]), BT = b.build;
  run(w2, BT * 0.75, true);
  ok(!b.build, 'Farmhands lend a hand so it finishes sooner', `${BT}s job, ${b.build ? Math.round(b.build) + 's left' : 'done'} after ${Math.round(BT * 0.75)}s`);
  // upgrades need materials too
  s.mats = {};
  ok(/Needs/.test(E.upgradeBuilding(w, m2)) && m2.lvl === 1, 'Upgrades need materials as well');
  s.mats = D.upgMatsFor(m2);
  ok(E.upgradeBuilding(w, m2) === '' && m2.lvl === 2, 'With them, the upgrade goes through');
  // debris turns up and gets cleared
  const w3 = fresh(); w3.state.debrisT = D.DEBRIS_EVERY - 1; w3.state.mats = {};
  run(w3, 3, true);
  ok(w3.debris.length === 1, 'Debris turns up on open land now and then');
  const deb = w3.debris[0];
  ok(deb && ![...w3.doors].some((i) => Math.abs((i % D.MAP.w) - deb.x) <= 1 && Math.abs(Math.floor(i / D.MAP.w) - deb.y) <= 1), 'It never lands next to an entrance');
  w3.state.debrisT = -1e12;
  run(w3, 120, true);
  ok(!w3.debris.length && Object.values(w3.state.mats).some((v) => v > 0), 'Farmhands clear it for materials', JSON.stringify(w3.state.mats));
  for (let i = 0; i < 40; i++) { w3.state.debrisT = D.DEBRIS_EVERY; for (const x of w3.state.workers) x.role = 'artisan'; run(w3, 1, true); }
  ok(w3.debris.length <= D.debrisMax(w3.state.map.owned.filter(Boolean).length) + 3, 'Only a few pieces at a time (a few more in storms)', `${w3.debris.length}`);
  // clearing by hand
  const one = w3.debris[0], m0 = { ...w3.state.mats };
  if (one) { E.remove(w3, one); ok(Object.keys(D.DEFS[one.type].gives).every((k) => (w3.state.mats[k] || 0) > (m0[k] || 0)), 'Clearing it yourself gives the materials too'); }
  // the quarry
  const w4 = fresh(); rich(w4, 12); w4.state.mats = {};
  ok(/edge/.test(E.discoverQuarry(w4)), 'The quarry trail needs land at the edge of the map');
  ok(E.hire(w4, 'miner') !== '', 'Miners can’t be hired before the quarry is found');
  E.buyParcel(w4, 1, 2); E.buyParcel(w4, 0, 2);
  ok(E.discoverQuarry(w4) === '' && w4.state.quarry.nodes.length > 0, 'Owning an edge parcel reveals the quarry', `${w4.state.quarry.nodes.length} nodes`);
  ok(E.hire(w4, 'miner') === '', 'Then miners can be hired');
  run(w4, 400, true);
  ok(w4.mat('wood') + w4.mat('stone') > 5, 'Miners bring wood and stone back to the shed', JSON.stringify(w4.state.mats));
  ok(w4.state.quarry.nodes.filter((n) => n.z > 0).length === 0, 'Deeper zones stay shut until opened');
  w4.state.level = 5;
  ok(/level/.test(E.openZone(w4, 1)), 'Copper Hollow needs farm level 6');
  w4.state.level = 6; w4.state.mats = { wood: 999, stone: 999 };
  ok(E.openZone(w4, 1) === '' && w4.state.quarry.zones === 2 && w4.state.quarry.nodes.some((n) => n.k === 'copper'), 'Opening a zone adds its ore veins');
  // the shed has a limit and miners wait when it's full
  w4.state.mats = { wood: w4.shedCap, stone: w4.shedCap, copper: w4.shedCap };
  run(w4, 60, true);
  ok(w4.mat('wood') === w4.shedCap && w4.mat('stone') === w4.shedCap, 'The material shed never goes over its limit');
  const miner = w4.state.workers.find((x) => x.role === 'miner');
  ok(/full/.test(miner._act || ''), 'Miners wait when the shed is full', miner._act);
  const cap0 = w4.shedCap; w4.state.mats = { wood: 999, stone: 999 }; w4.state.coins = 1e6; w4.state.mats.wood = 999;
  // a bigger shed holds more (limit applies to adding, so set materials directly)
  ok(E.upgradeShed(w4) === '' && w4.shedCap > cap0, 'A bigger shed holds more', `${cap0} -> ${w4.shedCap}`);
  // letting a miner go keeps what they carried
  miner.carry = { item: 'stone', qty: 3 }; const st0 = w4.mat('stone');
  E.fire(w4, miner);
  ok(w4.mat('stone') === st0 + 3 && !w4.state.piles.some((p) => p.item === 'stone'), 'A miner who leaves drops their basket in the shed, not on the farm');
  // nothing transient sneaks into the save
  const saved = JSON.parse(serialize(w4.state));
  ok(saved.quarry && saved.quarry.nodes.every((n) => !('_c' in n)) && saved.mats, 'The quarry and shed are saved, claims are not');
  // offline: miners keep working
  const w5 = fresh(); rich(w5, 12); w5.state.mats = {}; E.buyParcel(w5, 1, 2); E.buyParcel(w5, 0, 2); E.discoverQuarry(w5); E.hire(w5, 'miner');
  await catchUp(w5, 3600 * 1000);
  ok(w5.mat('wood') + w5.mat('stone') > 20, 'Miners keep digging while you’re away', JSON.stringify(w5.state.mats));
  // old saves get a starting stock and every field the new systems need
  const old = JSON.parse(serialize(fresh().state)); delete old.mats; delete old.shed; delete old.quarry;
  old.objects.push(initObject({ id: 999, type: 'mill', x: 8, y: 8 }));
  const mg = migrate(old);
  ok(mg.mats.wood > 0 && mg.shed === 1 && mg.quarry === null, 'Older farms get a head start of wood and stone', JSON.stringify(mg.mats));
}

// 28. neighbours, village projects, gold-star and giant crops, the merchant
{
  const D = await import('../js/data.js');
  const M = await import('../js/merchant.js');
  const w = fresh(), s = w.state; rich(w, 12, 1e6);
  // orders come from villagers and make friends
  w.state.nextOrderAt = 0; run(w, 2, true);
  ok(s.orders.length > 0 && s.orders.every((o) => D.VILLAGERS.some((v) => v.id === o.who)), 'Orders come from named neighbours');
  const v = D.VILLAGERS[0];
  const order = { id: 9001, from: v.name, who: v.id, items: [{ item: v.likes[0], qty: 1 }], reward: 10, xp: 1 };
  w.addItem(v.likes[0], 1); s.orders.push(order);
  ok(E.fillOrder(w, order) === '' && s.friends[v.id] === 3, 'Filling their order earns friendship (extra for favourites)', `${s.friends[v.id]}`);
  const c0 = s.coins;
  ok(D.heartsOf(s.friends[v.id]) === 0 && D.heartsOf(4) === 1, 'Hearts come at set friendship points');
  for (let i = 0; i < 30; i++) { const o = { id: 9100 + i, from: v.name, who: v.id, items: [{ item: 'wheat', qty: 1 }], reward: 1, xp: 0 }; w.addItem('wheat', 1); s.orders.push(o); E.fillOrder(w, o); }
  ok(D.heartsOf(s.friends[v.id]) === 5 && s.hats.bonnet && s.coins > c0, 'Each heart brings a gift (Granny Elm gives a bonnet)', `${s.friends[v.id]} pts`);
  ok(Math.abs(w.fx.sell - effects(s, w).sell) < 1e-9 && w.fx.sell > 1.0299, 'Five hearts adds their lasting favour', `sell x${w.fx.sell.toFixed(3)}`);
  // village projects
  const p0 = D.PROJECTS[0];
  s.level = 3;
  ok(/level/.test(E.giveProject(w, p0.id)), 'Projects open at their farm level');
  s.level = 12; s.mats = { wood: 30, stone: 0 }; s.coins = 500;
  ok(E.giveProject(w, p0.id) === '' && s.village.give[p0.id].wood === 30 && s.coins === 500, 'You can give a little at a time (and coins only when you choose)', JSON.stringify(s.village.give[p0.id]));
  ok(E.giveProject(w, p0.id, true) === '' && s.coins === 0 && s.village.give[p0.id].coins === 500, 'Paying coins toward it is separate');
  ok(!w.fx.merchant, 'The merchant needs the bridge first');
  s.mats = { wood: 999, stone: 999 }; s.coins = 1e6;
  E.giveProject(w, p0.id, true);
  ok(E.giveProject(w, p0.id) === '' && s.village.done.bridge && w.mat('wood') === 999 - 30 && w.fx.merchant, 'Finishing the bridge brings the merchant', `wood left ${w.mat('wood')}`);
  ok(/Already/.test(E.giveProject(w, p0.id)), 'A finished project takes nothing more');
  const p1 = D.PROJECTS[1]; s.mats = { stone: 999, copper: 999 }; w.addItem('bread', 10); s.coins = 1e6;
  const g0 = w.fx.grow;
  E.giveProject(w, p1.id, true);
  ok(E.giveProject(w, p1.id) === '' && w.fx.grow > g0 && !w.have('bread'), 'The well makes crops grow faster', `${g0} -> ${w.fx.grow}`);
  // the merchant
  const T = Date.UTC(2026, 5, 1);
  let at = null; for (let t = T; t < T + 7 * 86400e3 && !at; t += 600e3) if (M.visitAt(t)) at = t;
  ok(at && M.merchantHere(w, at), 'The merchant visits now and then');
  const vis = M.visitAt(at), stock = M.stockOf(vis.k);
  ok(stock.length === 5 && JSON.stringify(stock) === JSON.stringify(M.stockOf(vis.k)), 'Every device sees the same stock', stock.map((o) => o.key).join(' '));
  ok(M.visitAt(at + D.MERCHANT.stay * 1000 + 1) === null || M.visitAt(at + D.MERCHANT.stay * 1000 + 1).k !== vis.k, 'The cart leaves after a few hours');
  const mat = stock.find((o) => o.key.startsWith('mat:'));
  const [, mk, mn] = mat.key.split(':'); s.mats = {}; s.coins = 1e7; s.shed = 8;
  ok(E.buyOffer(w, mat.key, at) === '' && w.mat(mk) === +mn, 'Materials from the cart go into the shed', mat.key);
  ok(/Sold out/.test(E.buyOffer(w, mat.key, at)), 'Each ware sells once per visit');
  ok(/isn’t here/.test(E.buyOffer(w, mat.key, at + 3 * 86400e3 * 0 + D.MERCHANT.stay * 1000 + 5)), 'Nothing to buy once the cart has gone');
  const perk = stock.find((o) => o.key.startsWith('perk:'));
  if (perk) ok(E.buyOffer(w, perk.key, at) === '' && s.perks[perk.key.split(':')[1]], 'Perks stay with the farm for good', perk.key);
  ok(/merchant/.test(E.seasonalBlock(w, D.DEFS.geode, at + 1e10)) , 'Merchant decorations can’t be bought from the build menu');
  // gold-star produce
  const w2 = fresh(); w2.state.gold = {};
  for (const p of w2.plots) { p.st = 'ripe'; p.p = 1; }
  w2.fx.gold = 1; // everything comes in gold-star
  run(w2, 30, true);
  ok((w2.state.gold.wheat || 0) > 0, 'Some harvests come in gold-star', JSON.stringify(w2.state.gold));
  const gc = w2.state.coins, gn = w2.state.gold.wheat;
  ok(E.sellGold(w2, 'wheat', 1e9) === gn * sellPrice(w2, 'wheat') * D.GOLD_MULT && !w2.state.gold.wheat && w2.state.coins > gc, 'Gold-star crops sell for three times as much');
  // giant crops
  const w3 = empty(), s3 = w3.state; rich(w3, 12, 1e6);
  for (let y = 20; y < 23; y++) for (let x = 19; x < 22; x++) s3.objects.push(initObject({ id: s3.nextId++, type: 'plot', x, y, crop: 'pumpkin', st: 'grow', p: 0.999 }));
  w3.rebuild();
  run(w3, 1, true);
  const S = await import('../js/sim.js');
  if (!w3.plots.some((p) => p.giant)) S.tryGiant(w3, w3.plots[4], 1); // make the lucky roll happen
  newWorker(s3, 'farmer', 'Pip'); newWorker(s3, 'hauler', 'Bea'); s3.workers[0].x = 20.5; s3.workers[0].y = 23.5;
  const g = w3.plots.filter((p) => p.giant);
  ok(g.length === 9 && g.every((p) => p.giant === g[0].giant), 'Nine ripe pumpkins in a square can grow into one giant', `${g.length}`);
  const h0 = s3.stats.harvest.pumpkin || 0;
  run(w3, 20, true);
  const got = (s3.stats.harvest.pumpkin || 0) - h0;
  ok(got >= 9 * D.CROPS.pumpkin.yield * 2 && w3.plots.every((p) => !p.giant && p.st !== 'ripe'), 'Harvesting a giant takes the whole square, for double', `+${got}`);
  ok(s3.stats.giants === 1, 'Giant harvests are counted');
  // save round trip keeps the new progress
  const back = migrate(JSON.parse(serialize(w.state)));
  ok(back.friends[v.id] === s.friends[v.id] && back.village.done.bridge && back.perks && back.gold, 'Friendship, projects and perks are saved');
}

// 29. weather events, greenhouse, animal friendship, fish, finds and the museum
{
  const D = await import('../js/data.js');
  const S = await import('../js/sim.js');
  const W = await import('../js/world.js');
  // weather
  const w = fresh(), s = w.state;
  const seen = new Set();
  for (let t = T0; t < T0 + 200 * 86400e3; t += D.RAIN_BLOCK * 1000) seen.add(S.weatherAt(w, t));
  ok(['clear', 'rain', 'storm', 'heat', 'rainbow'].every((k) => seen.has(k)), 'Every kind of weather turns up', [...seen].join(' '));
  const ws = empty(); ws.state.debrisT = 0;
  let stormT = T0; while (S.weatherAt(ws, stormT) !== 'storm') stormT += D.RAIN_BLOCK * 1000;
  ws._t = stormT;
  run(ws, D.DEBRIS_EVERY / 4 + 2, true);
  ok(ws.debris.length >= 1 && ws.weather === 'storm', 'Storms blow branches and rocks onto the land', `${ws.debris.length}`);
  const wh = empty(), sh = wh.state; rich(wh, 12);
  let heatT = T0; while (S.weatherAt(wh, heatT) !== 'heat') heatT += D.RAIN_BLOCK * 1000;
  sh.objects.push(initObject({ id: sh.nextId++, type: 'plot', x: 19, y: 21, crop: 'wheat', st: 'grow', p: 0 }), initObject({ id: sh.nextId++, type: 'plot', x: 21, y: 21, crop: 'wheat', st: 'grow', p: 0, wet: true }));
  wh.rebuild(); wh._t = heatT; run(wh, 10, true);
  const [dryP, wetP] = wh.plots;
  ok(wh.weather === 'heat' && dryP.p / wetP.p < 0.6, 'Heat waves slow crops that aren’t watered', `${dryP.p.toFixed(4)} vs ${wetP.p.toFixed(4)}`);
  // greenhouse: its own beds inside grow anything, in any season
  const wg = empty(), sg = wg.state; rich(wg, 20); wg._t = T0;
  const { seasonAt } = await import('../js/seasons.js');
  const nowSeason = seasonAt(T0).id;
  const offSeason = Object.keys(CROPS).find((c) => CROPS[c].season && CROPS[c].season !== nowSeason);
  sg.objects.push(initObject({ id: sg.nextId++, type: 'plot', x: 19, y: 21, crop: offSeason }));
  newWorker(sg, 'farmer', 'Pip'); newWorker(sg, 'hauler', 'Bea'); sg.workers[0].x = 19.5; sg.workers[0].y = 22.5; wg.rebuild();
  run(wg, 20, true);
  ok(wg.plots[0].st === 'empty', 'Out of season, a seasonal crop waits in the fields', offSeason);
  ok(E.place(wg, 'greenhouse', 22, 20) === '', 'A greenhouse can be built');
  const gh = wg.objAt(22, 20);
  ok(gh.beds.length === D.bedCount(1) && gh.beds.every((b) => !b.crop), 'It comes with empty beds inside', `${gh.beds.length}`);
  ok(E.setBedCrop(wg, gh, 0, offSeason) === '' && E.setAllBeds(wg, gh, offSeason) === '' && gh.beds.every((b) => b.crop === offSeason), 'Beds take any seed, one at a time or all at once');
  run(wg, 60, true);
  ok(gh.beds.some((b) => b.st !== 'empty'), 'Farmers go in and plant them, even out of season', gh.beds.map((b) => b.st[0]).join(''));
  for (const b of gh.beds) if (b.st === 'grow') b.p = 0.999;
  const h0 = sg.stats.harvest[offSeason] || 0;
  run(wg, 120, true);
  ok((sg.stats.harvest[offSeason] || 0) > h0, 'And harvest them', `+${(sg.stats.harvest[offSeason] || 0) - h0}`);
  ok(!sg.workers.some((x) => x._hidden && !x.job), 'Nobody gets stuck inside');
  sg.coins = 1e6; sg.mats = { wood: 1e5, stone: 1e5, copper: 1e5, iron: 1e5, gold: 1e5 };
  ok(E.upgradeBuilding(wg, gh) === '' && gh.beds.length === D.bedCount(2), 'Upgrading adds beds', `${gh.beds.length}`);
  const back0 = migrate(JSON.parse(serialize(sg)));
  ok(back0.objects.find((o) => o.type === 'greenhouse').beds.length === D.bedCount(2), 'Beds are saved');
  // animals grow happier and produce faster
  const wa = fresh(); rich(wa, 12);
  let coop; for (let y = 10; y < 34 && !coop; y++) for (let x = 8; x < 40 && !coop; x++) if (E.place(wa, 'coop', x, y) === '') coop = wa.objAt(x, y);
  coop.joy = 30; coop.feed = 100;
  run(wa, 600, true);
  ok(coop.joy > 30, 'Fed animals grow happier over time', `${coop.joy.toFixed(1)}`);
  const j0 = coop.joy;
  ok(E.patAnimals(wa, coop) === '' && coop.joy > j0 && /just patted/.test(E.patAnimals(wa, coop)), 'A pat makes them happier, but only every so often');
  coop.feed = 0; wa.state.workers = []; const j1 = coop.joy; run(wa, 300, true);
  ok(coop.joy < j1, 'Hungry animals lose heart', `${j1.toFixed(1)} -> ${coop.joy.toFixed(1)}`);
  // fish
  const wf = fresh(); wf.season = D.SEASONS.find((x) => x.id === 'winter'); wf.weather = 'clear';
  const got = new Set(); for (let i = 0; i < 400; i++) got.add(S.pickFish(wf, Date.UTC(2026, 0, 12, 12)));
  ok(got.has('pike') && !got.has('trout') && !got.has('eel'), 'Which fish bite depends on season and weather', [...got].join(' '));
  wf.weather = 'storm'; const got2 = new Set(); for (let i = 0; i < 2000; i++) got2.add(S.pickFish(wf, Date.UTC(2026, 0, 12, 12)));
  ok(got2.has('eel'), 'Eels come out in the rain');
  // quarry finds
  const wq = fresh(); rich(wq, 16); E.buyParcel(wq, 1, 2); E.buyParcel(wq, 0, 2); E.discoverQuarry(wq); E.hire(wq, 'miner'); E.hire(wq, 'miner'); wq.state.shed = 8; wq.state.mats = {};
  await catchUp(wq, 8 * 3600 * 1000);
  ok(Object.keys(wq.state.finds).length > 0, 'Miners dig up fossils and relics', JSON.stringify(wq.state.finds));
  // museum
  const wings = W.museumWings(s);
  const all = Object.keys(ITEMS), inWings = wings.flatMap((x) => x.items);
  ok(all.every((k) => inWings.filter((y) => y === k).length === 1), 'Every item belongs to exactly one museum wing', all.filter((k) => inWings.filter((y) => y === k).length !== 1).join(','));
  const wm = fresh(); rich(wm, 12); wm.addItem('wheat', 2);
  ok(E.donate(wm, 'wheat') === '' && wm.state.museum.wheat && wm.have('wheat') === 1, 'Donating puts one on display');
  ok(/Already/.test(E.donate(wm, 'wheat')) && /need/.test(E.donate(wm, 'cake')), 'Only one of each, and only what you have');
  const river = W.museumWings(wm.state).find((x) => x.id === 'river');
  for (const k of river.items) wm.state.museum[k] = true;
  wm.state.museum[river.items[0]] = false; delete wm.state.museum[river.items[0]];
  const k0 = river.items[0], s0 = wm.fx.sell;
  if (ITEMS[k0].mat) wm.state.mats[k0] = 1; else if (ITEMS[k0].find) wm.state.finds[k0] = 1; else wm.addItem(k0, 1);
  ok(E.donate(wm, k0) === '' && wm.fx.sell > s0, 'Finishing a wing gives its lasting bonus', `${s0.toFixed(3)} -> ${wm.fx.sell.toFixed(3)}`);
  const back = migrate(JSON.parse(serialize(wm.state)));
  ok(back.museum.wheat && back.finds, 'The museum is saved');
}

// 30. friends: sharing, visiting and gift baskets (against a fake Supabase)
{
  const { farmSnapshot } = await import('../js/save.js');
  const db = { friends: [], gifts: [], me: 'u1', setUp: true };
  const eq = (u, k) => { const v = u.searchParams.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null; };
  const fake = async (url, opts) => {
    const u = new URL(url), body = opts.body ? JSON.parse(opts.body) : null;
    const reply = (j, status = 200) => ({ ok: status < 300, status, text: async () => JSON.stringify(j) });
    if (u.pathname.endsWith('/token')) return reply({ access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: db.me, email: 't@x' } });
    if (!db.setUp && /meadow_(friends|gifts)$/.test(u.pathname)) return reply({ code: 'PGRST205', message: 'not found' }, 404);
    if (u.pathname.endsWith('/meadow_friends')) {
      const code = eq(u, 'code'), uid = eq(u, 'user_id');
      const match = db.friends.filter((r) => (!code || r.code === code) && (!uid || r.user_id === uid));
      if (opts.method === 'POST') { if (db.friends.some((r) => r.code === body.code || r.user_id === body.user_id)) return reply({ code: '23505' }, 409); db.friends.push({ ...body }); return reply([body], 201); }
      if (opts.method === 'PATCH') { match.forEach((r) => Object.assign(r, body)); return reply(match); }
      if (opts.method === 'DELETE') { db.friends = db.friends.filter((r) => !match.includes(r)); return reply([]); }
      return reply(match);
    }
    if (u.pathname.endsWith('/meadow_gifts')) {
      if (opts.method === 'POST') { if (db.gifts.some((g) => g.from_user === body.from_user && g.to_code === body.to_code && g.day === body.day)) return reply({ code: '23505' }, 409); db.gifts.push({ ...body, claimed: false }); return reply([], 201); }
      const to = eq(u, 'to_code'), from = eq(u, 'from_user'), day = eq(u, 'day');
      const match = db.gifts.filter((g) => (!to || g.to_code === to) && (!from || g.from_user === from) && (!day || g.day === day) && (u.searchParams.get('claimed') !== 'is.false' || !g.claimed));
      if (opts.method === 'PATCH') { match.forEach((g) => Object.assign(g, body)); return reply(match); }
      return reply(match);
    }
    return reply({});
  };
  Cloud._setFetch(fake);
  localStorage.removeItem('meadow.session');
  await Cloud.signIn('t@x', 'pw');
  const w = fresh(); rich(w, 9);
  const snap = farmSnapshot(w.state);
  ok(snap.objects && snap.workers && !snap.inv && !snap.settings && !snap.autoSell, 'Friends see the farm, not its storage or settings');
  const mine = await Cloud.share('Bea’s Farm', snap);
  ok(/^[A-Z0-9]{6}$/.test(mine.code) && (await Cloud.myShare()).name === 'Bea’s Farm', 'Sharing gives a 6-character farm code', mine.code);
  const again = await Cloud.share('Bea’s Meadow', snap);
  ok(again.code === mine.code && db.friends.length === 1, 'Renaming keeps the same code');
  const seen = await Cloud.fetchFarm(mine.code.toLowerCase());
  ok(seen && seen.farm.level === 9, 'A friend can look up a farm by its code (any case)');
  ok(await Cloud.fetchFarm('ZZZZZZ') === null, 'Unknown codes find nothing');
  // a second player sends gifts
  db.me = 'u2'; localStorage.removeItem('meadow.session'); await Cloud.signIn('b@x', 'pw');
  ok(await Cloud.sendGift(mine.code, 'Pip', '2026-11-02') === true, 'A friend can send a gift basket');
  ok(await Cloud.sendGift(mine.code, 'Pip', '2026-11-02') === false, 'Only one gift per friend per day');
  ok((await Cloud.giftsSentToday('2026-11-02')).includes(mine.code), 'The game remembers who got a gift today');
  db.me = 'u1'; localStorage.removeItem('meadow.session'); await Cloud.signIn('t@x', 'pw');
  const got = await Cloud.openGifts(mine.code);
  ok(got.length === 1 && got[0].from_name === 'Pip' && (await Cloud.openGifts(mine.code)).length === 0, 'Gifts open once, never twice');
  // a shared farm (no storage, no counters) runs for a good while without tripping up
  const pal = fresh(); rich(pal, 9); for (const p of pal.plots) { p.st = 'ripe'; p.p = 1; }
  const visit = new World(migrate(JSON.parse(JSON.stringify(farmSnapshot(pal.state)))));
  let crash = ''; try { run(visit, 600, false, 0.05); } catch (e) { crash = e.message; }
  ok(!crash && visit.state.inv && Object.keys(visit.state.inv).length > 0, 'A friend’s farm keeps working while you visit (no freeze)', crash || JSON.stringify(visit.state.inv));
  const r = E.giftReward(10);
  ok(r.coins > 0 && r.coins < 5000, 'A gift basket’s size comes from the farm that opens it', JSON.stringify(r));
  await Cloud.unshare();
  ok(!db.friends.length && await Cloud.myShare() === null, 'You can stop sharing any time');
  db.setUp = false;
  let err = null; try { await Cloud.myShare(); } catch (e) { err = e; }
  ok(err instanceof Cloud.NotSetUp, 'Without the friends tables the game says friends aren’t on yet');
  await Cloud.signOut();
  localStorage.removeItem('meadow.sync.u1'); localStorage.removeItem('meadow.sync.u2');
  Cloud._setFetch((...a) => fetch(...a));
}

// 31. building interiors draw for every building that has one
{
  const I = await import('../js/art/interiors.js');
  const { Renderer } = await import('../js/render.js');
  const w = fresh(); rich(w, 30, 1e9);
  for (let n = 0; n < 40; n++) for (let py = 0; py < 5; py++) for (let px = 0; px < 6; px++) E.buyParcel(w, px, py);
  const cv = document.createElement('canvas'); cv.style.width = '400px'; cv.style.height = '700px'; document.body.appendChild(cv);
  const R = new Renderer(cv, w);
  const errs = [], types = Object.keys(DEFS).filter((k) => I.hasInterior(k));
  for (const type of types) {
    let o = w.objects.find((x) => x.type === type);
    if (!o) { for (let y = 2; y < 38 && !o; y++) for (let x = 2; x < 46 && !o; x++) if (E.place(w, type, x, y) === '') o = w.objAt(x, y); }
    if (!o) { errs.push(`${type}: couldn't place`); continue; }
    try {
      I.roomCanvas(o);
      R.insideId = o.id; R.setScene('inside');
      for (let i = 0; i < 5; i++) R.draw(0.1);
      R.setScene('farm'); R.draw(0.1);
    } catch (e) { errs.push(`${type}: ${e.message}`); }
  }
  cv.remove();
  ok(types.length >= 20 && !errs.length, 'Every building interior draws', `${types.length} rooms ${errs.join('; ')}`);
  ok(!I.hasInterior('crate') && !I.hasInterior('market') && !I.hasInterior('plot'), 'Small things and the market keep their usual card');
}

// 32. fair share: fast crops can't crowd slow ones out of storage
{
  const S = await import('../js/sim.js');
  const w = empty(), s = w.state; rich(w, 12, 1e6);
  for (let x = 17; x < 25; x++) s.objects.push(initObject({ id: s.nextId++, type: 'plot', x, y: 21, crop: 'wheat' }));
  for (let x = 17; x < 20; x++) s.objects.push(initObject({ id: s.nextId++, type: 'plot', x, y: 22, crop: 'sugarcane' }));
  newWorker(s, 'farmer', 'Pip'); newWorker(s, 'farmer', 'Fern'); newWorker(s, 'hauler', 'Bea');
  for (const x of s.workers) { x.x = 20.5; x.y = 20.5; }
  w.rebuild();
  ok(w.roomFor('wheat') === w.free() - w.fairShare(), 'Space is held back for each other crop being grown', `${w.roomFor('wheat')} of ${w.free()}`);
  const solo = empty(); solo.state.objects.push(initObject({ id: solo.state.nextId++, type: 'plot', x: 17, y: 21, crop: 'wheat' })); solo.rebuild();
  ok(solo.roomFor('wheat') === solo.free(), 'A farm growing just one thing can fill the whole barn with it');
  const many = empty(); ['wheat', 'carrot', 'corn', 'sugarcane', 'potato', 'tomato', 'pumpkin', 'onion', 'oats', 'cabbage', 'beans', 'rice'].forEach((c, i) => many.state.objects.push(initObject({ id: many.state.nextId++, type: 'plot', x: 16 + i, y: 21, crop: c }))); many.rebuild();
  ok(many.roomFor('carrot') >= Math.min(many.free(), many.fairShare()), 'Even with lots of crops, each one always has room for its own share', `${many.roomFor('carrot')} share ${many.fairShare()}`);
  run(w, 4 * 3600, true, 2);
  const share = w.fairShare();
  ok(share === Math.floor(w.capacity / 2), 'The barn splits its space between the crops being grown', `share ${share} of ${w.capacity}`);
  ok(w.have('wheat') <= share + w.fx.carry, 'Wheat stops at its fair share', `wheat ${w.have('wheat')} / ${share}`);
  ok(w.have('sugarcane') > 0, 'Slow sugar cane still gets its space', `cane ${w.have('sugarcane')}, barn ${w.used()}/${w.capacity}`);
  ok(w.plots.some((p) => p.crop === 'wheat' && p.st === 'ripe'), 'Extra wheat waits ripe in its field instead');
  // selling makes room again
  E.sell(w, 'wheat', w.have('wheat'));
  ok(w.roomFor('wheat') > 0, 'Selling frees the space');
  // pantries hold space for an ingredient before the first one arrives
  const w2 = empty(), s2 = w2.state; rich(w2, 12, 1e6);
  let mill; for (let y = 10; y < 34 && !mill; y++) for (let x = 8; x < 40 && !mill; x++) if (E.place(w2, 'mill', x, y) === '') mill = w2.objAt(x, y);
  s2.objects.push(initObject({ id: s2.nextId++, type: 'plot', x: 17, y: 21, crop: 'wheat' }), initObject({ id: s2.nextId++, type: 'plot', x: 18, y: 21, crop: 'sugarcane' }));
  w2.rebuild(); w2.producing = (await import('../js/world.js')).producingNow(w2);
  mill.inp = { wheat: 1 };
  const capM = S.pantryCap(mill), wheatWant = S.pantryWant(w2, mill, 'wheat');
  ok(wheatWant + 1 <= Math.ceil(capM / 2) + 6, 'Wheat only fills its share of the mill’s pantry', `wants ${wheatWant} more of ${capM}`);
  ok(S.pantryWant(w2, mill, 'sugarcane') > 0, 'Space is kept for sugar cane before any arrives');
  // a pantry stuffed with one thing uses that up first
  mill.inp = { wheat: capM + 10, corn: 4 }; mill.recipe = 'auto'; mill.cur = 'cornmeal';
  ok(S.curRecipe(w2, mill).out === 'flour', 'An over-full pantry makes something that uses up the extra');
}

// 33. a prioritized order may go over the fair share until it's delivered
{
  const S = await import('../js/sim.js');
  const D2 = await import('../js/data.js');
  const w = empty(), s = w.state; rich(w, 12, 1e6);
  for (let x = 17; x < 25; x++) s.objects.push(initObject({ id: s.nextId++, type: 'plot', x, y: 21, crop: 'wheat' }));
  for (let x = 17; x < 20; x++) s.objects.push(initObject({ id: s.nextId++, type: 'plot', x, y: 22, crop: 'carrot' }));
  newWorker(s, 'farmer', 'Pip'); newWorker(s, 'farmer', 'Fern'); newWorker(s, 'hauler', 'Bea');
  for (const x of s.workers) { x.x = 20.5; x.y = 20.5; }
  w.rebuild();
  run(w, 3 * 3600, true, 2);
  const share = w.fairShare();
  ok(w.have('wheat') <= share + w.fx.carry, 'Without priority wheat stays at its share', `${w.have('wheat')} / ${share}`);
  // the barn is full of carrots and wheat: selling carrots makes the room the order needs
  E.sell(w, 'carrot', w.have('carrot'));
  const order = { id: 7001, from: 'Granny Elm', who: 'elm', items: [{ item: 'wheat', qty: 50 }], reward: 900, xp: 10 };
  s.orders.push(order);
  E.prioritizeOrder(w, order);
  ok(w.orderShort('wheat') === 50 - w.haveAll('wheat') && w.roomFor('wheat') >= Math.min(w.free(), w.orderShort('wheat')), 'A prioritized order’s item can go past its share', `room ${w.roomFor('wheat')}`);
  ok(w.roomFor('carrot') <= Math.max(0, w.free() - w.orderShort('wheat')), 'Other crops leave that space alone', `carrot room ${w.roomFor('carrot')}`);
  run(w, 3600, true, 2);
  ok(w.haveAll('wheat') >= 50 && w.have('wheat') > share, 'Wheat gathers past its fair share for the order', `wheat ${w.have('wheat')}, share ${share}`);
  ok(w.haveAll('wheat') <= 50 + w.fx.carry * 3, 'It stops at what the order needs', `${w.haveAll('wheat')}`);
  ok(E.canFill(w, order) && E.fillOrder(w, order) === '' && !s.priority, 'Delivering ends the priority');
  ok(w.priorityOrder() === null && w.roomFor('wheat') <= Math.max(w.free() - Math.max(0, share - w.have('carrot')), share - w.have('wheat'), 0), 'Then wheat is back on the fair share');
  // only one at a time, and tapping again cancels
  const a = { id: 7002, from: 'A', items: [{ item: 'wheat', qty: 5 }], reward: 1, xp: 0 }, b = { id: 7003, from: 'B', items: [{ item: 'carrot', qty: 5 }], reward: 1, xp: 0 };
  s.orders.push(a, b); E.prioritizeOrder(w, a); E.prioritizeOrder(w, b);
  ok(w.priorityOrder() === b, 'Only one order is prioritized at a time');
  E.prioritizeOrder(w, b); ok(!w.priorityOrder(), 'Tapping it again cancels');
  E.prioritizeOrder(w, a); E.skipOrder(w, a); ok(!w.priorityOrder(), 'Skipping a prioritized order clears it');
  // workshops and animals leave the ingredient alone, unless the order wants what they make
  const w2 = empty(); rich(w2, 12, 1e6);
  let mill; for (let y = 10; y < 34 && !mill; y++) for (let x = 8; x < 40 && !mill; x++) if (E.place(w2, 'mill', x, y) === '') mill = w2.objAt(x, y);
  mill.inp = { wheat: 9 }; const flour = D2.DEFS.mill.recipes.find((r) => r.out === 'flour');
  const o2 = { id: 7004, from: 'A', items: [{ item: 'wheat', qty: 9 }], reward: 1, xp: 0 }; w2.state.orders.push(o2); E.prioritizeOrder(w2, o2);
  ok(S.savedForOrder(w2, flour) === 'wheat', 'The mill won’t grind wheat a prioritized order needs');
  o2.items.push({ item: 'flour', qty: 3 });
  ok(S.savedForOrder(w2, flour) === null, 'Unless the order needs the flour too');
  const back = migrate(JSON.parse(serialize(w2.state)));
  ok(back.priority === o2.id, 'The priority is saved');
}

// 34. workshops make what a prioritized order needs
{
  const S = await import('../js/sim.js');
  const w = empty(), s = w.state; rich(w, 12, 1e6);
  let mill; for (let y = 10; y < 34 && !mill; y++) for (let x = 8; x < 40 && !mill; x++) if (E.place(w, 'mill', x, y) === '') mill = w.objAt(x, y);
  newWorker(s, 'hauler', 'Bea'); newWorker(s, 'artisan', 'Art'); for (const x of s.workers) { x.x = 20.5; x.y = 20.5; }
  w.rebuild();
  // the mill is busy on flour, with sugar cane waiting in the barn
  mill.inp = { wheat: 9 }; mill.recipe = 'auto'; mill.cur = 'flour'; w.addItem('sugarcane', 12);
  ok(S.curRecipe(w, mill).out === 'flour', 'Without priority the mill keeps on with flour');
  const order = { id: 8001, from: 'Baker Rue', who: 'rue', items: [{ item: 'sugar', qty: 3 }], reward: 200, xp: 5 };
  s.orders.push(order); E.prioritizeOrder(w, order);
  ok(S.curRecipe(w, mill).out === 'sugar', 'Prioritizing an order for sugar switches the mill to sugar');
  run(w, 600, true);
  ok(w.haveAll('sugar') >= 3, 'And the sugar gets made', `sugar ${w.haveAll('sugar')}`);
  ok(E.fillOrder(w, order) === '' && !w.priorityOrder(), 'The order can be delivered and the priority ends');
  // even a chosen recipe gives way while the order needs something
  mill.recipe = 'flour'; mill.cur = 'flour'; w.addItem('sugarcane', 6); w.takeAll('sugar', 99);
  const o2 = { id: 8002, from: 'A', items: [{ item: 'sugar', qty: 2 }], reward: 1, xp: 0 }; s.orders.push(o2); E.prioritizeOrder(w, o2);
  ok(S.curRecipe(w, mill).out === 'sugar', 'A workshop set to one recipe still helps a prioritized order');
  E.prioritizeOrder(w, o2);
  ok(S.curRecipe(w, mill).out === 'flour', 'Cancelling the priority puts it back on its chosen recipe');
  // two steps down: a cake order makes the mill grind sugar
  w.takeAll('sugar', 99); w.takeAll('flour', 99);
  let bakery; for (let y = 10; y < 34 && !bakery; y++) for (let x = 8; x < 40 && !bakery; x++) if (E.place(w, 'bakery', x, y) === '') bakery = w.objAt(x, y);
  const o3 = { id: 8003, from: 'B', items: [{ item: 'cake', qty: 2 }], reward: 1, xp: 0 }; s.orders.push(o3); E.prioritizeOrder(w, o3);
  ok(w.priorityWanted().has('sugar') && w.priorityWanted().has('flour'), 'An order for cake asks for its sugar and flour', [...w.priorityWanted().keys()].join(' '));
  mill.recipe = 'auto';
  ok(['sugar', 'flour'].includes(S.curRecipe(w, mill).out), 'So the mill makes what the cake needs');
}

// 35. a full tray of one product never stops another (the stuck mill)
{
  const S = await import('../js/sim.js');
  const w = empty(), s = w.state; rich(w, 12, 1e6);
  let mill; for (let y = 10; y < 34 && !mill; y++) for (let x = 8; x < 40 && !mill; x++) if (E.place(w, 'mill', x, y) === '') mill = w.objAt(x, y);
  newWorker(s, 'artisan', 'Art'); for (const x of s.workers) { x.x = 20.5; x.y = 20.5; }
  w.rebuild();
  // flour fills the mill's tray and the barn is too full to take it; sugar cane is waiting
  mill.out = { flour: S.outCap(mill) }; mill.recipe = 'auto'; mill.cur = 'flour';
  s.inv = { sugarcane: 10, carrot: w.capacity - 10 };
  const order = { id: 8101, from: 'Baker Rue', who: 'rue', items: [{ item: 'sugar', qty: 2 }], reward: 50, xp: 1 };
  s.orders.push(order); E.prioritizeOrder(w, order);
  let started = null;
  for (let i = 0; i < 300 && !started; i++) { run(w, 2, true); if (mill.cur === 'sugar' && mill.prog > 0) started = { flour: mill.out.flour || 0 }; }
  ok(started && started.flour >= S.outCap(mill), 'The mill starts sugar while its flour tray is still full', JSON.stringify(started));
  run(w, 600, true);
  ok((mill.out.sugar || 0) + w.haveAll('sugar') >= 2, 'The mill makes the sugar the order needs', `sugar ${w.haveAll('sugar')}, tray ${JSON.stringify(mill.out)}`);
}

// ---- report ----
const pass = results.filter((r) => r.pass).length;
document.getElementById('out').innerHTML = `<h2>${pass}/${results.length} passed</h2>` + results.map((r) =>
  `<div class="${r.pass ? 'p' : 'f'}">${r.pass ? '✓' : '✗'} ${r.name} <small>${r.info}</small></div>`).join('');
window.__results = results;
void MAP;
