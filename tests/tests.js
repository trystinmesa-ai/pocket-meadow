// In-browser test suite. Open tests/index.html on the dev server.
import { World, newGame, newWorker, migrate, sellPrice, doorTile, initObject } from '../js/world.js';
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
const empty = () => { const s = newGame(T0); s.simTime = T0; const w = new World(s); w.state.nextOrderAt = T0 + 1e12; return w; };
const fresh = () => {
  const w = empty(), s = w.state;
  for (const [x, y] of [[19, 21], [20, 21], [21, 21], [19, 22], [20, 22], [21, 22]]) s.objects.push(initObject({ id: s.nextId++, type: 'plot', x, y, crop: 'wheat' }));
  newWorker(s, 'farmer', 'Pip'); newWorker(s, 'hauler', 'Bea');
  s.workers[0].x = 20.5; s.workers[0].y = 20.5; s.workers[1].x = 23.5; s.workers[1].y = 19.5;
  w.rebuild();
  return w;
};
const rich = (w, level = 12, coins = 1e7) => { w.state.level = level; w.state.coins = coins; for (const c in CROPS) w.state.seeds[c] = true; w.rebuild(); };

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
  w.state.autoSell.wheat = 5;
  E.autoSellItem(w, 'wheat');
  ok(w.have('wheat') === 5, 'Auto-sell keeps the reserve', `have ${w.have('wheat')}`);
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
  w.state.autoSell.wheat = 0;
  const sum = await catchUp(w, 2 * 3600 * 1000);
  ok(sum.harvest.wheat > 100, 'Two hours away: farm keeps harvesting', `wheat ${sum.harvest.wheat}`);
  ok(w.state.pendingCoins > 0 && sum.coins > 0, 'Offline auto-sale coins wait to be collected', `pending ${w.state.pendingCoins}`);
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
  for (const it in ITEMS) w.state.autoSell[it] = 0;
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
  // with auto-sell on, the farm keeps earning even when storage is full of other goods
  w.state.inv = { carrot: w.capacity };
  w.state.autoSell.wheat = 0;
  const c0 = w.state.coins;
  run(w, 600, true);
  ok(w.state.coins > c0 + 50, 'Auto-sell goods sell from the basket when storage is full', `+${w.state.coins - c0}`);
}

// 16. expansion content
{
  const w = fresh();
  rich(w, 20);
  w.state.autoSell.wheat = 0;
  ok(E.place(w, 'dock', 16, 21) === 'Build it right next to water', 'Fishing dock must be built beside water');
  // buy land toward the east stream and find a spot touching water
  for (const [px, py] of [[4, 2], [5, 2]]) E.buyParcel(w, px, py);
  let placed = '';
  for (let x = 38; x < 46 && !placed; x++) for (let y = 16; y < 22 && !placed; y++) if (E.place(w, 'dock', x, y) === '') placed = `${x},${y}`;
  ok(placed, 'Fishing dock can be built at the stream', placed);
  E.place(w, 'cottage', 16, 21);
  E.hire(w, 'rancher');
  run(w, 1200, true);
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
  for (const d of Object.values(D)) { if (d.fruit) sources.add(d.fruit); if (d.animal) sources.add(d.animal.item); if (d.hive) sources.add(d.hive.item); for (const r of d.recipes || []) sources.add(r.out); }
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
  // switching a ripe plot doesn't change what's growing
  p.st = 'ripe'; p.p = 1;
  E.setCrop(w, p, 'carrot');
  ok(p.crop === 'pumpkin' && p.next === 'carrot', 'A planted crop stays; the new one is queued');
  w.state.coins = 1000;
  run(w, 30, true);
  ok((w.state.stats.harvest.pumpkin || 0) >= 1 && p.crop === 'carrot' && !p.next, 'After the harvest the plot switches to the new crop', `${p.crop} ${p.st} ${p.p.toFixed(2)}`);
  ok(p.st === 'empty' || p.p < 0.5, 'The new crop starts growing from scratch');
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
  const missing = Object.keys(ITEMS).filter((k) => !(D.SOURCES[k] || []).length);
  ok(!missing.length, 'Every item says where it comes from', missing.join(','));
}

// ---- report ----
const pass = results.filter((r) => r.pass).length;
document.getElementById('out').innerHTML = `<h2>${pass}/${results.length} passed</h2>` + results.map((r) =>
  `<div class="${r.pass ? 'p' : 'f'}">${r.pass ? '✓' : '✗'} ${r.name} <small>${r.info}</small></div>`).join('');
window.__results = results;
void MAP;
