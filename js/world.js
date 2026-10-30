// Game state: creating a new farm, indexes for fast lookups, inventory,
// placement rules and the derived effects of upgrades.
import { BUNDLE_ROOMS, MAP, DEFS, ITEMS, CROPS, START_PARCELS, SAVE_VERSION, UPGRADES, CHARM_BONUS_PER, CHARM_BONUS_MAX,
  BEE_FLOWERS, SKIN, HAIR, SHIRTS, PANTS, WORKER_NAMES } from './data.js';

export const PW = MAP.w / MAP.parcel;
export const PH = MAP.h / MAP.parcel;
export const idx = (x, y) => y * MAP.w + x;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP.w && y < MAP.h;

// Small seeded random generator so the land looks the same on every device.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; };
}
export const hash2 = (x, y, seed = 0) => {
  let h = (x * 374761393 + y * 668265263 + seed * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Terrain: 0 grass, 1 water. Generated from the seed, never saved.
export function makeTerrain(seed) {
  const t = new Uint8Array(MAP.w * MAP.h);
  // a winding stream along the east side and a pond in the south-west
  for (let y = 0; y < MAP.h; y++) {
    const cx = 44 + Math.round(Math.sin(y * 0.35 + seed) * 1.5 + Math.sin(y * 0.11) * 1);
    for (let x = cx; x < cx + 2 + (y % 7 === 0 ? 1 : 0); x++) if (inMap(x, y)) t[idx(x, y)] = 1;
  }
  const pond = [[4, 33], [5, 33], [6, 33], [3, 34], [4, 34], [5, 34], [6, 34], [7, 34], [3, 35], [4, 35], [5, 35], [6, 35], [7, 35], [4, 36], [5, 36], [6, 36]];
  for (const [x, y] of pond) t[idx(x, y)] = 1;
  return t;
}

export function randomLook(r = Math.random) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  return { skin: pick(SKIN), hair: pick(HAIR), shirt: pick(SHIRTS), pants: pick(PANTS), style: Math.floor(r() * 4) };
}

export function newWorker(state, role, name) {
  const used = new Set(state.workers.map((w) => w.name));
  name ||= WORKER_NAMES.find((n) => !used.has(n)) || `Hand ${state.workers.length + 1}`;
  const house = state.objects.find((o) => o.type === 'farmhouse');
  const w = {
    id: state.nextId++, name, role, lvl: 1, xp: 0, look: randomLook(),
    x: house ? house.x + 1.5 : 24, y: house ? house.y + 3.5 : 20, carry: null,
  };
  state.workers.push(w);
  return w;
}

export function newGame(now = Date.now()) {
  const seed = Math.floor(Math.random() * 1e9);
  const owned = new Array(PW * PH).fill(false);
  for (const [px, py] of START_PARCELS) owned[py * PW + px] = true;
  const s = {
    v: SAVE_VERSION, rev: 0, savedAt: now, simTime: now, created: now, seed,
    coins: 100, pendingCoins: 0, xp: 0, level: 1,
    map: { owned },
    objects: [], piles: [], workers: [], inv: {}, autoSell: {},
    seeds: { wheat: true, carrot: true },
    upgrades: {}, orders: [], nextOrderAt: now + 90 * 1000,
    goal: 0, ach: {}, hats: {}, pets: [], ribbons: 0, fest: null, bundles: { give: {}, done: {} },
    stats: { earned: 0, soldCoins: 0, harvest: {}, craft: {}, sold: {}, orders: 0, play: 0 },
    settings: { grid: false, helpers: true, motion: true },
    nextId: 1,
  };
  const add = (type, x, y, extra = {}) => { const o = { id: s.nextId++, type, x, y, ...extra }; initObject(o); s.objects.push(o); return o; };
  // starting farm: 16 x 8 tiles at x 16..31, y 16..23
  add('farmhouse', 17, 16);
  add('barn', 22, 16, { lvl: 1 });
  add('market', 27, 16);
  add('board', 30, 17);
  for (let x = 18; x <= 30; x++) add('path_dirt', x, 19);
  add('path_dirt', 23, 18);
  add('path_dirt', 27, 18);
  add('flowers_red', 16, 19); add('flowers_yellow', 16, 20); add('oak', 31, 22); add('bush', 25, 23); add('fence_wood', 26, 21);
  add('fence_wood', 27, 21); add('fence_wood', 28, 21); add('haybale', 29, 22);
  // no farmhands or fields yet: the player hires and plants their own
  return s;
}

// Fill in per-type fields on an object.
export function initObject(o) {
  const d = DEFS[o.type];
  if (o.type === 'plot') { o.crop ||= null; o.st ||= 'empty'; o.p ||= 0; o.wet ||= false; }
  if (d.cat === 'tree') { o.p ??= 0.3; }
  if (d.recipes) { o.lvl ||= 1; o.recipe ||= 'auto'; o.cur ||= null; o.inp ||= {}; o.out ||= {}; o.prog ||= 0; }
  if (d.animal) { o.lvl ||= 1; o.feed ||= 0; o.prog ||= 0; o.out ||= 0; }
  if (d.hive) { o.lvl ||= 1; o.prog ||= 0; o.out ||= 0; }
  if (d.store) { o.lvl ||= 1; }
  return o;
}

// Older saves get any fields added since.
export function migrate(s) {
  s.stats ||= {}; s.stats.harvest ||= {}; s.stats.craft ||= {}; s.stats.sold ||= {};
  s.ach ||= {}; s.hats ||= {}; s.pets ||= []; s.ribbons ||= 0; s.fest ||= null;
  s.bundles ||= {}; s.bundles.give ||= {}; s.bundles.done ||= {};
  s.stats.earned ||= 0; s.stats.soldCoins ||= 0; s.stats.orders ||= 0; s.stats.play ||= 0;
  s.settings = { grid: false, helpers: true, motion: true, ...(s.settings || {}) };
  s.piles ||= []; s.orders ||= []; s.autoSell ||= {}; s.upgrades ||= {}; s.seeds ||= { wheat: true, carrot: true };
  s.pendingCoins ||= 0; s.goal ||= 0; s.rev ||= 0;
  s.objects = s.objects.filter((o) => DEFS[o.type]);
  s.objects.forEach(initObject);
  for (const w of s.workers) { w.lvl ||= 1; w.xp ||= 0; if (w.carry && !ITEMS[w.carry.item]) w.carry = null; }
  s.v = SAVE_VERSION;
  return s;
}

// ---------- World: state + indexes ----------
export class World {
  constructor(state) {
    this.state = state;
    this.terrain = makeTerrain(state.seed);
    this.occ = new Int32Array(MAP.w * MAP.h);
    this.events = [];
    this.rebuild();
  }

  get objects() { return this.state.objects; }

  rebuild() {
    const s = this.state;
    this.occ.fill(0);
    this.byId = new Map();
    this.plots = []; this.trees = []; this.bldgs = []; this.storages = []; this.wells = []; this.sprinklers = [];
    this.animals = []; this.hives = []; this.lights = [];
    this.doors = new Set();
    this.housing = 0; this.capacity = 0; this.charm = 0;
    const flowers = [];
    for (const o of s.objects) {
      const d = DEFS[o.type];
      this.byId.set(o.id, o);
      for (let y = o.y; y < o.y + d.h; y++) for (let x = o.x; x < o.x + d.w; x++) if (inMap(x, y)) this.occ[idx(x, y)] = o.id;
      if (o.type === 'plot') { this.plots.push(o); if (BEE_FLOWERS.has(o.crop)) flowers.push(o); }
      else if (d.cat === 'tree') this.trees.push(o);
      if (d.recipes) this.bldgs.push(o);
      if (d.store) { this.storages.push(o); this.capacity += storeCap(o); }
      if (o.type === 'well') this.wells.push(o);
      if (DEFS[o.type].radius) this.sprinklers.push(o);
      if (d.animal) this.animals.push(o);
      if (d.hive) this.hives.push(o);
      if (d.houses) this.housing += d.houses;
      if (d.charm) this.charm += d.charm;
      if (d.flower) flowers.push(o);
      if (d.light) this.lights.push(o);
      if (d.door) this.doors.add(idx(...doorTile(o)));
    }
    this.charm += 5 * (s.pets || []).length; // pets make a farm feel loved
    // beehive flower bonus
    for (const h of this.hives) {
      let n = 0;
      for (const f of flowers) if (Math.abs(f.x - h.x) <= 3 && Math.abs(f.y - h.y) <= 3) n++;
      h._flowers = n;
    }
    // sprinkler coverage
    this.sprinkled = new Set();
    for (const sp of this.sprinklers) {
      const r = DEFS[sp.type].radius;
      for (let y = sp.y - r; y <= sp.y + r; y++) for (let x = sp.x - r; x <= sp.x + r; x++) if (inMap(x, y)) this.sprinkled.add(idx(x, y));
    }
    this.fx = effects(s, this);
    this.version = (this.version || 0) + 1;
  }

  ownedTile(x, y) {
    if (!inMap(x, y)) return false;
    return this.state.map.owned[Math.floor(y / MAP.parcel) * PW + Math.floor(x / MAP.parcel)];
  }
  objAt(x, y) { return inMap(x, y) ? this.byId.get(this.occ[idx(x, y)]) : undefined; }

  walkable(x, y) {
    if (!this.ownedTile(x, y) || this.terrain[idx(x, y)] !== 0) return false;
    const o = this.objAt(x, y);
    return !o || DEFS[o.type].walk;
  }
  // Path speed multiplier for a tile.
  tileSpeed(x, y) {
    const o = this.objAt(x, y);
    return o && DEFS[o.type].speed ? DEFS[o.type].speed : 1;
  }

  // ---------- inventory ----------
  used() { let n = 0; for (const k in this.state.inv) n += this.state.inv[k]; return n; }
  free() { return this.capacity - this.used(); }
  have(item) { return this.state.inv[item] || 0; }
  addItem(item, qty) {
    const put = Math.max(0, Math.min(qty, this.free()));
    if (put > 0) this.state.inv[item] = (this.state.inv[item] || 0) + put;
    return put;
  }
  takeItem(item, qty) {
    const got = Math.min(qty, this.have(item));
    if (got > 0) { this.state.inv[item] -= got; if (!this.state.inv[item]) delete this.state.inv[item]; }
    return got;
  }

  count(type) { let n = 0; for (const o of this.state.objects) if (o.type === type) n++; return n; }

  // ---------- placement ----------
  // Returns '' when (type) fits at (x,y), otherwise a reason.
  canPlace(type, x, y, ignoreId = 0) {
    const d = DEFS[type];
    for (let ty = y; ty < y + d.h; ty++) for (let tx = x; tx < x + d.w; tx++) {
      if (!inMap(tx, ty) || !this.ownedTile(tx, ty)) return 'Not your land yet';
      if (this.terrain[idx(tx, ty)] !== 0) return 'Can’t build on water';
      const o = this.objAt(tx, ty);
      if (o && o.id !== ignoreId) return 'Something is already here';
      if (!d.walk && this.doors.has(idx(tx, ty))) {
        const owner = this.state.objects.find((b) => DEFS[b.type].door && b.id !== ignoreId && idx(...doorTile(b)) === idx(tx, ty));
        if (owner) return `Keep the ${DEFS[owner.type].name} entrance clear`;
      }
    }
    if (d.water) {
      let wet = false;
      for (let ty = y - 1; ty <= y + d.h && !wet; ty++) for (let tx = x - 1; tx <= x + d.w; tx++) if (inMap(tx, ty) && this.terrain[idx(tx, ty)] === 1) { wet = true; break; }
      if (!wet) return 'Build it right next to water';
    }
    if (d.door) {
      const [dx, dy] = doorTile({ x, y, type });
      if (!this.ownedTile(dx, dy) || this.terrain[idx(dx, dy)] !== 0) return 'The entrance needs open ground';
      const o = this.objAt(dx, dy);
      if (o && o.id !== ignoreId && !DEFS[o.type].walk) return 'The entrance is blocked';
    }
    return '';
  }

  // Charm sell bonus as a fraction.
  charmBonus() { return Math.min(CHARM_BONUS_MAX, this.charm * CHARM_BONUS_PER); }
}

export function storeCap(o) {
  const d = DEFS[o.type];
  return Math.round(d.store * (1 + 0.6 * ((o.lvl || 1) - 1)));
}

// The tile workers stand on to use a building.
export function doorTile(o) {
  const d = DEFS[o.type];
  return [o.x + Math.floor((d.w - 1) / 2), o.y + d.h];
}

export const ulvl = (s, id) => s.upgrades[id] || 0;

export function effects(s, w) {
  const u = (id) => ulvl(s, id);
  // finished bundle shelves add small lasting bonuses
  const perk = { grow: 0, craft: 0, animal: 0, sell: 0 };
  for (const r of BUNDLE_ROOMS) if (s.bundles?.done[`room:${r.id}`]) for (const k in r.perk) perk[k] += r.perk[k];
  return {
    grow: 1 + 0.1 * u('grow') + perk.grow,
    walk: 1 + 0.08 * u('boots'),
    carry: 3 + u('basket'),
    work: 1 + 0.1 * u('tools'),
    water: 1.4 + 0.1 * u('water'),
    sell: (1 + 0.05 * u('haggle') + perk.sell) * (1 + (w ? w.charmBonus() : 0)),
    animal: 1 + 0.12 * u('animal') + perk.animal,
    craft: 1 + 0.1 * u('craft') + perk.craft,
    bumper: 0.08 * u('bumper'),
    offlineH: 8 + 2 * u('night'),
  };
}

export const sellPrice = (w, item) => Math.max(1, Math.round(ITEMS[item].value * w.fx.sell));
export const cropUnlocked = (s, c) => !!s.seeds[c] && s.level >= CROPS[c].level;
