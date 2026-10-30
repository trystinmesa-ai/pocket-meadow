// Draws the farm: ground, depth-sorted sprites, farmhands and animals,
// particles, day/night lighting, weather and the build-mode overlays.
import { TILE, MAP, DEFS, CROPS } from './data.js';
import { PW, PH, idx, inMap, doorTile, hash2 } from './world.js';
import { paintTerrain, soilTile, waterGlint } from './art/land.js';
import { cropSprite, treeSprite, CROP_H, FRUIT_COLOR } from './art/plants.js';
import { buildingSprite, millSails } from './art/buildings.js';
import { decorSprite, fenceSprite, basketSprite, wildSprite, smallWindmillSails } from './art/decor.js';
import { workerFrame, toolSprite, animalFrame, bugSprite } from './art/chars.js';
import { itemIcon } from './art/items.js';
import { ROLES } from './data.js';
import { animalCount } from './sim.js';
import { parcelBuyable, parcelsBought } from './economy.js';
import { parcelLevel, parcelCost } from './data.js';
import { silhouette } from './looks.js';
import { seasonAt } from './seasons.js';
import { petFrame } from './art/chars.js';
import { PETS } from './data.js';
import { gradeCanvas, gradeHex } from './art/grade.js';

const BORDER = 6; // tiles of forest drawn around the map

export class Renderer {
  constructor(canvas, world) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.cam = { x: 24 * TILE, y: 20 * TILE, z: 3 };
    this.particles = [];
    this.floats = [];
    this.critters = new Map();
    this.bugs = [];
    this.t = 0;
    this.hits = [];
    this.overlay = null; // set by the UI: { mode, ghost, sel, ... }
    this.lightCv = document.createElement('canvas');
    this.terrainKey = '';
    this.wild = [];
    this.border = [];
    this.makeBorder();
    const hour = new URLSearchParams(location.search).get('hour');
    if (hour !== null) this.forceHour = +hour; // e.g. ?hour=21 to preview night
    this.vignette = document.getElementById('vignette');
    this.resize();
  }

  setWorld(world) { this.world = world; this.terrainKey = ''; this.critters.clear(); this.makeBorder(); }

  resize() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.dpr = dpr;
    const w = this.cv.clientWidth, h = this.cv.clientHeight;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.lightCv.width = Math.ceil(this.cv.width / 4); this.lightCv.height = Math.ceil(this.cv.height / 4);
  }

  get scale() {
    const s = this.cam.z * this.dpr;
    return this.cam.free ? s : Math.max(1, Math.round(s));
  }
  // world px -> screen css px
  toScreen(x, y) {
    const S = this.scale;
    return [(this.cv.width / 2 + (x - this.cam.x) * S) / this.dpr, (this.cv.height / 2 + (y - this.cam.y) * S) / this.dpr];
  }
  toWorld(sx, sy) {
    const S = this.scale;
    return [(sx * this.dpr - this.cv.width / 2) / S + this.cam.x, (sy * this.dpr - this.cv.height / 2) / S + this.cam.y];
  }
  clampCam() {
    const c = this.cam, S = this.scale;
    const halfW = this.cv.width / 2 / S, halfH = this.cv.height / 2 / S;
    const minX = -BORDER * TILE * 0.6 + halfW, maxX = (MAP.w + BORDER * 0.6) * TILE - halfW;
    const minY = -BORDER * TILE * 0.6 + halfH, maxY = (MAP.h + BORDER * 0.6) * TILE - halfH;
    c.x = minX > maxX ? MAP.w * TILE / 2 : Math.max(minX, Math.min(maxX, c.x));
    c.y = minY > maxY ? MAP.h * TILE / 2 : Math.max(minY, Math.min(maxY, c.y));
  }

  makeBorder() {
    const seed = this.world.state.seed;
    this.border = [];
    for (let y = -BORDER; y < MAP.h + BORDER; y++) for (let x = -BORDER; x < MAP.w + BORDER; x++) {
      if (inMap(x, y)) continue;
      const h = hash2(x, y, seed);
      if (h < 0.55) this.border.push({ x, y, k: h < 0.2 ? 'pine' : 'tree', ox: (hash2(x, y, 3) * 6) | 0 });
    }
  }

  get sid() { return (this.world.season || seasonAt(Date.now())).id; }

  rebuildTerrain() {
    const w = this.world;
    const key = this.sid + w.state.map.owned.join('') + '|' + w.objects.filter((o) => DEFS[o.type].cat === 'path').map((o) => `${o.type}${o.x},${o.y}`).join(';');
    if (key === this.terrainKey) return;
    this.terrainKey = key;
    this.terrain = gradeCanvas(paintTerrain(w, this.sid));
    // wild clutter on unowned land
    this.wild = [];
    const seed = w.state.seed;
    for (let y = 0; y < MAP.h; y++) for (let x = 0; x < MAP.w; x++) {
      if (w.ownedTile(x, y) || w.terrain[idx(x, y)]) continue;
      const h = hash2(x, y, seed + 5);
      let k = null;
      if (h < 0.05) k = 'tree'; else if (h < 0.075) k = 'pine'; else if (h < 0.12) k = 'tall'; else if (h < 0.14) k = 'bush'; else if (h < 0.155) k = 'rock'; else if (h < 0.165) k = 'stump';
      if (k) this.wild.push({ x, y, k });
    }
  }

  // ---------- frame ----------
  draw(dt) {
    this.t += dt;
    const { ctx, world } = this;
    const s = world.state;
    this.rebuildTerrain();
    const S = this.scale;
    const ox = Math.round(this.cv.width / 2 - this.cam.x * S), oy = Math.round(this.cv.height / 2 - this.cam.y * S);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COL.bg;
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(S, 0, 0, S, ox, oy);
    const vx0 = -ox / S, vy0 = -oy / S, vx1 = vx0 + this.cv.width / S, vy1 = vy0 + this.cv.height / S;
    this.view = [vx0, vy0, vx1, vy1];
    const vis = (x, y, w, h) => x + w > vx0 - 8 && x < vx1 + 8 && y + h > vy0 - 8 && y < vy1 + 40;

    // forest floor around the map
    ctx.fillStyle = COL.forest;
    ctx.fillRect(-BORDER * TILE, -BORDER * TILE, (MAP.w + BORDER * 2) * TILE, (MAP.h + BORDER * 2) * TILE);
    ctx.drawImage(this.terrain, 0, 0);

    // water glints
    const gf = Math.floor(this.t * 1.5) % 3;
    for (let y = Math.max(0, (vy0 / TILE) | 0); y < Math.min(MAP.h, vy1 / TILE + 1); y++)
      for (let x = Math.max(0, (vx0 / TILE) | 0); x < Math.min(MAP.w, vx1 / TILE + 1); x++)
        if (world.terrain[idx(x, y)] === 1) ctx.drawImage(waterGlint((gf + x + y) % 3), x * TILE, y * TILE);

    // soil under crops
    for (const p of world.plots) {
      if (!vis(p.x * TILE, p.y * TILE, TILE, TILE)) continue;
      let m = 0;
      const isP = (x, y) => { const o = world.objAt(x, y); return o && o.type === 'plot'; };
      if (isP(p.x, p.y - 1)) m |= 1; if (isP(p.x + 1, p.y)) m |= 2; if (isP(p.x, p.y + 1)) m |= 4; if (isP(p.x - 1, p.y)) m |= 8;
      ctx.drawImage(soilTile(p.wet && p.st !== 'empty', m), p.x * TILE, p.y * TILE);
    }

    // grid in build modes
    const ov = this.overlay || {};
    if (ov.grid || s.settings.grid) this.drawGrid(vx0, vy0, vx1, vy1);

    // ---------- depth-sorted sprites ----------
    const list = [];
    const add = (y, fn) => list.push([y, fn]);
    const sid = this.sid;
    this.hits = [];
    for (const b of this.border) {
      const X = b.x * TILE, Y = b.y * TILE;
      if (!vis(X - 8, Y - 24, 32, 40)) continue;
      add(Y + TILE, () => this.blit(wildSprite(b.k, sid), X + b.ox - 3, Y + TILE, 1));
    }
    for (const wd of this.wild) {
      const X = wd.x * TILE, Y = wd.y * TILE;
      if (!vis(X - 8, Y - 24, 32, 40)) continue;
      add(Y + TILE - 1, () => this.blit(wildSprite(wd.k, sid), X + TILE / 2, Y + TILE, 1));
    }
    for (const o of world.objects) {
      const d = DEFS[o.type];
      if (d.cat === 'path') continue;
      const X = o.x * TILE, Y = o.y * TILE, W = d.w * TILE, H = d.h * TILE;
      if (!vis(X - 16, Y - 48, W + 32, H + 56)) continue;
      add(Y + H - (d.walk && d.cat !== 'field' ? 8 : 0), () => this.drawObject(o, d, X, Y, W, H));
    }
    for (const p of s.piles) {
      const X = p.x * TILE + 8, Y = p.y * TILE + 13;
      add(Y, () => { this.blit(itemIcon(p.item), X, Y - 4, 1); this.blit(basketSprite(), X, Y + 1, 1); });
    }
    this.updateCritters(dt);
    this.updatePets(dt);
    for (const p of this.petState.values()) add(p.y, () => this.drawPet(p));
    for (const c of this.critters.values()) for (const a of c) add(a.y, () => this.drawCritter(a));
    for (const w of s.workers) {
      if (w._hidden) continue;
      const fx = w.x * TILE, fy = w.y * TILE + 4;
      add(fy, () => this.drawWorker(w, fx, fy));
    }
    this.drawCastShadows(vis, S, ox, oy);
    list.sort((a, b) => a[0] - b[0]);
    for (const [, fn] of list) fn();
    // land you do not own yet sits in soft shade
    ctx.fillStyle = 'rgba(30,26,34,0.32)';
    for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
      if (!s.map.owned[py * PW + px]) ctx.fillRect(px * MAP.parcel * TILE, py * MAP.parcel * TILE, MAP.parcel * TILE, MAP.parcel * TILE);
    }
    ctx.fillRect(-BORDER * TILE, -BORDER * TILE, (MAP.w + BORDER * 2) * TILE, BORDER * TILE);
    ctx.fillRect(-BORDER * TILE, MAP.h * TILE, (MAP.w + BORDER * 2) * TILE, BORDER * TILE);
    ctx.fillRect(-BORDER * TILE, 0, BORDER * TILE, MAP.h * TILE);
    ctx.fillRect(MAP.w * TILE, 0, BORDER * TILE, MAP.h * TILE);

    this.drawBunting();
    // building overlays: mill sails and busy smoke
    this.drawParticles(dt);
    this.drawBugs(dt);
    this.drawOverlay(ov);
    this.drawLighting();
    this.drawWeather(dt);
    this.drawFloats(dt);
  }

  /** Soft cast shadows leaning up-right, as if lit from the lower left. */
  drawCastShadows(vis, S, ox, oy) {
    const sid = this.sid;
    const strength = 0.32 * Math.max(0, 1 - this.darkness() / 0.45);
    if (strength < 0.02) return;
    // drawn at one canvas pixel per game pixel, then scaled up: cheap and crisp
    const W = Math.ceil(this.cv.width / S) + 2, H = Math.ceil(this.cv.height / S) + 2;
    if (!this.shadowCv || this.shadowCv.width !== W || this.shadowCv.height !== H) {
      this.shadowCv = document.createElement('canvas'); this.shadowCv.width = W; this.shadowCv.height = H;
    }
    const fx = ox / S - Math.floor(ox / S), fy = oy / S - Math.floor(oy / S);
    const bx = Math.floor(ox / S), by0 = Math.floor(oy / S);
    const sc = this.shadowCv.getContext('2d');
    sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, W, H); sc.imageSmoothingEnabled = false;
    const cast = (cv, cx, by) => {
      sc.setTransform(1, 0, -0.6, 0.42, bx + cx + 1, by0 + by + 1);
      sc.drawImage(silhouette(cv), -Math.round(cv.width / 2), -cv.height + (cv.pad || 0));
    };
    for (const o of this.world.objects) {
      const d = DEFS[o.type];
      if (d.walk || d.cat === 'path' || d.cat === 'fence') continue;
      const X = o.x * TILE, Y = o.y * TILE, Wd = d.w * TILE, Hd = d.h * TILE;
      if (!vis(X - 48, Y - 48, Wd + 96, Hd + 56)) continue;
      let cv;
      if (d.cat === 'tree') cv = treeSprite(d.look, null, false, sid);
      else if (d.cat === 'decor') cv = decorSprite(o.type, sid);
      else cv = buildingSprite(o.type);
      cast(cv, X + Wd / 2, Y + Hd - 1);
    }
    for (const wd of this.wild) if (wd.k === 'tree' || wd.k === 'pine') {
      if (vis(wd.x * TILE - 48, wd.y * TILE - 48, 112, 80)) cast(wildSprite(wd.k, sid), wd.x * TILE + TILE / 2, wd.y * TILE + TILE - 1);
    }
    for (const b of this.border) if (vis(b.x * TILE - 48, b.y * TILE - 48, 112, 80)) cast(wildSprite(b.k, sid), b.x * TILE + b.ox + 5, b.y * TILE + TILE - 1);
    for (const w of this.world.state.workers) if (!w._hidden) cast(workerFrame(w.look, hatOf(w), 'd', 'idle', 0), w.x * TILE, w.y * TILE + 3);
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(S, 0, 0, S, Math.round((fx - 1) * S), Math.round((fy - 1) * S));
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = strength;
    ctx.drawImage(this.shadowCv, 0, 0);
    ctx.restore();
  }

  /** Draw a sprite with its bottom-centre at (cx, by). Records a hit box. */
  blit(cv, cx, by, z, ref) {
    const pad = cv.pad || 0;
    const x = Math.round(cx - cv.width / 2), y = Math.round(by - cv.height + pad);
    this.ctx.drawImage(cv, x, y);
    if (ref) this.hits.push({ ref, x0: x, y0: y, x1: x + cv.width, y1: y + cv.height });
    return [x, y];
  }

  drawObject(o, d, X, Y, W, H) {
    const ctx = this.ctx, t = this.t, ov = this.overlay || {};
    const moving = ov.moving === o;
    if (moving) ctx.globalAlpha = 0.35;
    const cx = X + W / 2, by = Y + H;
    if (o.type === 'plot') {
      const st = o.st === 'empty' ? -1 : o.st === 'ripe' ? 3 : o.p < 0.15 ? 0 : o.p < 0.55 ? 1 : 2;
      if (st >= 0 && o.crop) {
        const cs = cropSprite(o.crop, st);
        // gentle sway: draw the top part shifted
        const sway = Math.round(Math.sin(t * 1.6 + o.x * 0.7 + o.y * 0.3) * 0.8);
        const split = CROP_H - 12;
        ctx.drawImage(cs, 0, 0, 16, split, X + sway, by - CROP_H, 16, split);
        ctx.drawImage(cs, 0, split, 16, CROP_H - split, X, by - CROP_H + split, 16, CROP_H - split);
        if (st === 3 && Math.random() < 0.004) this.spark(X + 4 + Math.random() * 8, by - 10);
      }
      this.hits.push({ ref: o, x0: X, y0: Y, x1: X + W, y1: Y + H });
    } else if (d.cat === 'tree') {
      const look = d.look;
      const fruitCol = FRUIT_COLOR[look];
      const ripe = o.p >= 1, flowering = o.p > 0.45 && !ripe;
      const cv = treeSprite(look, ripe ? fruitCol : null, flowering, this.sid);
      this.shadow(cx, by - 2, 9, 3);
      const [x, y] = this.blit(cv, cx, by, 0);
      this.hits.push({ ref: o, x0: x, y0: y, x1: x + cv.width, y1: by });
    } else if (d.cat === 'fence') {
      let m = 0;
      const same = (x, y) => { const q = this.world.objAt(x, y); return q && q.type === o.type; };
      if (same(o.x, o.y - 1)) m |= 1; if (same(o.x + 1, o.y)) m |= 2; if (same(o.x, o.y + 1)) m |= 4; if (same(o.x - 1, o.y)) m |= 8;
      const [x, y] = this.blit(fenceSprite(o.type, m), cx, by + 1, 0);
      this.hits.push({ ref: o, x0: x, y0: y, x1: x + 18, y1: by });
    } else if (d.cat === 'decor') {
      const cv = decorSprite(o.type, this.sid);
      if (d.tall) this.shadow(cx, by - 2, 9, 3);
      const [x, y] = this.blit(cv, cx, by, 0);
      this.hits.push({ ref: o, x0: Math.min(x, X), y0: y, x1: Math.max(x + cv.width, X + W), y1: by });
      if (o.type === 'windmill') this.blit(smallWindmillSails(Math.floor(t * 4) % 8), cx, by - 13, 0);
      if (o.type === 'fountain' && Math.random() < 0.25) this.particles.push({ k: 'drop', x: cx + (Math.random() - 0.5) * 6, y: by - 28, vx: (Math.random() - 0.5) * 14, vy: -18, life: 0.9 });
    } else {
      const cv = buildingSprite(o.type);
      ctx.fillStyle = 'rgba(40,24,30,0.22)';
      ctx.fillRect(X + 1, by - 2, W - 2, 3);
      const [x, y] = this.blit(cv, cx, by + 1, 0);
      this.hits.push({ ref: o, x0: x, y0: y, x1: x + cv.width, y1: by });
      const pad = cv.pad;
      const busy = o._busy;
      if (o.type === 'mill') {
        const f = Math.floor(t * (busy ? 10 : 1.5)) % 8;
        const sail = millSails(f);
        ctx.drawImage(sail, Math.round(x + pad + 16 - sail.width / 2), Math.round(y + pad + 14 - sail.height / 2));
      }
      // chimney smoke
      const smokeOn = o.type === 'farmhouse' || o.type === 'cottage' || busy;
      if (smokeOn && cv.smoke) for (const [sx, sy] of cv.smoke) {
        if (Math.random() < (busy ? 0.12 : 0.04)) this.particles.push({ k: 'smoke', x: x + pad + sx, y: y + pad + sy, vx: 2 + Math.random() * 3, vy: -6 - Math.random() * 3, life: 2.4, r: 1.5 });
      }
      if (d.radius && Math.random() < 0.5 * d.radius) {
        const a = Math.random() * Math.PI * 2;
        this.particles.push({ k: 'drop', x: cx, y: by - 16, vx: Math.cos(a) * 18, vy: -8 + Math.sin(a) * 6, life: 0.7 });
      }
      if (o.type === 'beehive') this.ensureBees(o, cx, by - 10);
      // status bubbles
      if (d.recipes && !busy && this.statusIcon(o)) this.bubble(cx, y + pad - 2, this.statusIcon(o));
    }
    if (moving) ctx.globalAlpha = 1;
  }

  statusIcon(o) {
    let n = 0; for (const k in o.out) n += o.out[k];
    if (n > 0) return Object.keys(o.out)[0];
    return null;
  }

  bubble(cx, y, item) {
    const ctx = this.ctx;
    const bob = Math.round(Math.sin(this.t * 3) * 1);
    ctx.fillStyle = '#35232a';
    ctx.fillRect(cx - 7, y - 15 + bob, 14, 13);
    ctx.fillStyle = '#fbf8ef';
    ctx.fillRect(cx - 6, y - 14 + bob, 12, 11);
    ctx.fillRect(cx - 1, y - 3 + bob, 2, 2);
    ctx.drawImage(itemIcon(item), cx - 6, y - 15 + bob);
  }

  shadow(cx, cy, rx, ry) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(40,24,30,0.22)';
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }

  drawWorker(w, fx, fy) {
    const t = this.t + w.id * 0.37;
    const anim = w._anim || 'idle';
    let pose = 'idle', f = 0, dir = w._dir || 'd', tool = null;
    if (anim === 'walk') { pose = w.carry ? 'carry' : 'walk'; f = Math.floor(t * 8) % 4; }
    else if (anim === 'sit') { pose = 'sit'; dir = 'd'; }
    else if (anim === 'idle') { pose = w.carry ? 'carry' : 'idle'; f = (t % 3.7) < 0.14 ? 1 : 0; }
    else if (anim === 'deposit' || anim === 'drop' || anim === 'load') { pose = 'crouch'; dir = 'd'; }
    else { pose = 'work'; f = Math.floor(t * 3.2) % 2; dir = 'd'; tool = w._tool; }
    if (pose === 'carry' && !w.carry) pose = 'walk';
    this.shadow(fx, fy - 1, 4, 1.5);
    const hat = hatOf(w);
    const cv = workerFrame(w.look, hat, dir, pose, f);
    const [x, y] = this.blit(cv, fx, fy, 0);
    this.hits.push({ ref: w, worker: true, x0: x - 2, y0: y - 2, x1: x + cv.width + 2, y1: y + cv.height + 2 });
    if (tool) {
      const ts = toolSprite(tool, f);
      this.ctx.drawImage(ts, x + 8, y + (tool === 'can' ? 7 : 3) + (f ? 1 : 0));
    }
    if (w.carry && (pose === 'carry' || pose === 'idle')) {
      const ic = itemIcon(w.carry.item);
      this.ctx.drawImage(ic, Math.round(fx - 6), y - 8 + (f === 1 || f === 3 ? 1 : 0));
    }
    const sel = this.overlay && this.overlay.sel === w;
    if (sel) {
      this.ctx.fillStyle = '#ffe27a';
      const b = Math.round(Math.sin(this.t * 5) * 1.5);
      this.ctx.fillRect(Math.round(fx) - 1, y - 6 + b, 3, 3);
      this.ctx.fillRect(Math.round(fx), y - 3 + b, 1, 1);
    }
  }

  // ---------- animals ----------
  updateCritters(dt) {
    const world = this.world;
    const live = new Set();
    for (const a of world.animals) {
      live.add(a.id);
      const d = DEFS[a.type], kind = d.animal.kind;
      const n = Math.min(6, animalCount(a));
      let list = this.critters.get(a.id);
      if (!list || list.n !== n || list.ax !== a.x || list.ay !== a.y) {
        list = [];
        list.n = n; list.ax = a.x; list.ay = a.y;
        for (let i = 0; i < n; i++) {
          const p = this.critterSpot(a);
          list.push({ kind, x: p[0], y: p[1], tx: p[0], ty: p[1], wait: Math.random() * 3, left: Math.random() < 0.5, f: 0, home: a });
        }
        this.critters.set(a.id, list);
      }
      const speed = kind === 'chicken' || kind === 'duck' ? 9 : 6;
      for (const c of list) {
        if (c.wait > 0) { c.wait -= dt; c.f = kind === 'chicken' && (this.t % 1.2) < 0.4 && c.peck ? 2 : 0; if (c.wait <= 0) { const p = this.critterSpot(a); c.tx = p[0]; c.ty = p[1]; c.peck = Math.random() < 0.6; } continue; }
        const dx = c.tx - c.x, dy = c.ty - c.y, dd = Math.hypot(dx, dy);
        if (dd < 0.5) { c.wait = 1 + Math.random() * 4; continue; }
        const st = Math.min(dd, speed * dt);
        c.x += (dx / dd) * st; c.y += (dy / dd) * st; c.left = dx < 0;
        c.f = Math.floor(this.t * 6) % 2;
      }
    }
    for (const id of [...this.critters.keys()]) if (!live.has(id)) this.critters.delete(id);
  }
  critterSpot(a) {
    const d = DEFS[a.type];
    for (let k = 0; k < 12; k++) {
      const x = a.x - 1 + Math.floor(Math.random() * (d.w + 2)), y = a.y + d.h + Math.floor(Math.random() * 2);
      if (this.world.walkable(x, y) || (x >= a.x && x < a.x + d.w && y === a.y + d.h)) return [x * TILE + 3 + Math.random() * 10, y * TILE + 6 + Math.random() * 8];
    }
    const [x, y] = doorTile(a);
    return [x * TILE + 8, y * TILE + 8];
  }
  drawCritter(c) {
    const cv = animalFrame(c.kind, c.f, c.left);
    this.shadow(c.x, c.y - 1, c.kind === 'chicken' || c.kind === 'duck' ? 3 : 7, 1.5);
    this.blit(cv, c.x, c.y, 0);
  }

  ensureBees(h, x, y) {
    if (!h._bees) h._bees = [0, 1, 2].map((i) => ({ a: i * 2.1, r: 6 + i * 3, s: 1.4 + i * 0.5 }));
    for (const b of h._bees) {
      b.a += b.s * 0.016;
      const bx = x + Math.cos(b.a) * b.r, by = y + Math.sin(b.a * 1.7) * 5 - 4;
      this.ctx.drawImage(bugSprite('bee', Math.floor(this.t * 12) % 2), Math.round(bx), Math.round(by));
    }
  }

  drawBugs(dt) {
    const world = this.world;
    const night = this.darkness() > 0.2;
    if (!night && !world.raining && this.bugs.length < 5 && Math.random() < 0.01 && this.view) {
      const [x0, y0, x1, y1] = this.view;
      this.bugs.push({ x: x0 + Math.random() * (x1 - x0), y: y0 + Math.random() * (y1 - y0), a: Math.random() * 6, c: Math.floor(Math.random() * 4), life: 12 + Math.random() * 10 });
    }
    for (const b of this.bugs) {
      b.life -= dt; b.a += (Math.random() - 0.5) * 0.4;
      b.x += Math.cos(b.a) * 9 * dt; b.y += Math.sin(b.a) * 6 * dt + Math.sin(this.t * 4 + b.c) * 0.15;
      this.ctx.drawImage(bugSprite('fly', b.c * 2 + (Math.floor(this.t * 8 + b.c) % 2)), Math.round(b.x), Math.round(b.y));
    }
    this.bugs = this.bugs.filter((b) => b.life > 0);
  }

  // ---------- particles & floating text ----------
  spark(x, y) { this.particles.push({ k: 'spark', x, y, vx: 0, vy: -4, life: 0.8 }); }
  splash(tx, ty) { for (let i = 0; i < 6; i++) this.particles.push({ k: 'drop', x: tx * TILE + 8, y: ty * TILE + 10, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 10, life: 0.5 }); }
  float(x, y, text, item) { this.floats.push({ x: x * TILE + 8, y: y * TILE, text, item, life: 1.6 }); }
  burst(sx, sy) { for (let i = 0; i < 14; i++) this.particles.push({ k: 'coin', x: sx, y: sy, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 40, life: 1, screen: true }); }

  drawParticles(dt) {
    const ctx = this.ctx;
    for (const p of this.particles) {
      if (p.screen) continue;
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 'drop') { p.vy += 60 * dt; ctx.fillStyle = '#a2dcf1'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      else if (p.k === 'smoke') {
        p.r += dt * 1.2;
        ctx.fillStyle = `rgba(235,230,225,${Math.max(0, Math.min(0.6, p.life / 2.4))})`;
        const r = Math.round(p.r);
        ctx.fillRect(Math.round(p.x - r), Math.round(p.y - r), r * 2, r * 2);
      } else if (p.k === 'spark') {
        ctx.fillStyle = `rgba(255,246,190,${Math.max(0, p.life)})`;
        const x = Math.round(p.x), y = Math.round(p.y);
        ctx.fillRect(x, y - 1, 1, 3); ctx.fillRect(x - 1, y, 3, 1);
      } else if (p.k === 'heart') {
        ctx.fillStyle = `rgba(240,96,128,${Math.max(0, p.life)})`;
        const x = Math.round(p.x), y = Math.round(p.y);
        ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x - 1, y + 1, 5, 1); ctx.fillRect(x, y + 2, 3, 1); ctx.fillRect(x + 1, y + 3, 1, 1);
      } else if (p.k === 'z') {
        ctx.fillStyle = `rgba(250,250,255,${Math.max(0, p.life * 0.6)})`;
        const x = Math.round(p.x), y = Math.round(p.y);
        ctx.fillRect(x, y, 3, 1); ctx.fillRect(x + 1, y + 1, 1, 1); ctx.fillRect(x, y + 2, 3, 1);
      } else if (p.k === 'leaf') {
        p.vx = Math.sin(this.t * 2 + p.y) * 6;
        ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
      }
    }
    // occasional falling leaves from trees
    const leafRate = { spring: 0.03, summer: 0.015, autumn: 0.14, winter: 0 }[this.sid];
    if (Math.random() < leafRate && this.world.trees.length + this.world.objects.length > 0) {
      const trees = this.world.objects.filter((o) => DEFS[o.type].tall || DEFS[o.type].cat === 'tree');
      const tr = trees[Math.floor(Math.random() * trees.length)];
      if (tr) this.particles.push({ k: 'leaf', x: tr.x * TILE + 2 + Math.random() * 12, y: tr.y * TILE - 14, vx: 0, vy: 7, life: 3, c: this.sid === 'autumn' ? ['#d8702e', '#c84a2a', '#e8a838'][Math.floor(Math.random() * 3)] : this.sid === 'spring' || tr.type === 'blossom' || tr.type === 'cherrytree' ? '#f7b8cf' : '#7cc75a' });
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  drawFloats(dt) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = this.dpr;
    ctx.font = `${Math.round(11 * dpr)}px "Pixelify Sans", ui-monospace, monospace`;
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      f.life -= dt; f.y -= dt * 10;
      const [sx, sy] = this.toScreen(f.x, f.y);
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.5));
      const X = sx * dpr, Y = sy * dpr;
      const isz = Math.round(12 * dpr);
      if (f.item) ctx.drawImage(itemIcon(f.item), Math.round(X - isz - 2 * dpr), Math.round(Y - isz / 2), isz, isz);
      ctx.fillStyle = '#35232a'; ctx.fillText(f.text, X + dpr, Y + dpr);
      ctx.fillStyle = '#fff6d8'; ctx.fillText(f.text, X, Y);
    }
    ctx.globalAlpha = 1;
    // screen-space coins
    for (const p of this.particles) {
      if (!p.screen) continue;
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt;
      const sz = Math.round(10 * dpr);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.drawImage(iconCoin(), Math.round(p.x * dpr), Math.round(p.y * dpr), sz, sz);
    }
    ctx.globalAlpha = 1;
    this.floats = this.floats.filter((f) => f.life > 0);
  }

  // ---------- light & weather ----------
  darkness() {
    if (this.forceHour !== undefined) return darkAt(this.forceHour);
    const d = new Date();
    return darkAt(d.getHours() + d.getMinutes() / 60);
  }

  drawLighting() {
    const dark = this.darkness();
    const ctx = this.ctx;
    const hour = this.forceHour ?? (new Date().getHours() + new Date().getMinutes() / 60);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // warm tint at dawn/dusk
    const warm = Math.max(0, 1 - Math.abs(hour - 18.6) / 1.4) * 0.16 + Math.max(0, 1 - Math.abs(hour - 6.3) / 1) * 0.1;
    if (warm > 0.01) { ctx.fillStyle = `rgba(255,140,70,${warm})`; ctx.fillRect(0, 0, this.cv.width, this.cv.height); }
    // vignette deepens from soft golden (day) to heavy (night)
    if (this.vignette) {
      const v = (0.55 + dark * 0.9).toFixed(2);
      if (this.vignette._v !== v) { this.vignette.style.opacity = v; this.vignette._v = v; }
    }
    if (dark < 0.02) return;
    // Moody Evening: drain some colour before the night falls over it
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = Math.min(0.3, dark * 0.55);
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const L = this.lightCv, lc = L.getContext('2d');
    const k = this.scale; // one light cell per game pixel: blocky pixel-art glow
    const lw = Math.ceil(this.cv.width / k), lh = Math.ceil(this.cv.height / k);
    if (L.width !== lw || L.height !== lh) { L.width = lw; L.height = lh; }
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, L.width, L.height);
    lc.fillStyle = `rgba(8,22,50,${Math.min(0.74, dark * 1.3)})`;
    lc.fillRect(0, 0, L.width, L.height);
    lc.globalCompositeOperation = 'destination-out';
    const S = this.scale / k;
    const ox = this.cv.width / (2 * k) - this.cam.x * S, oy = this.cv.height / (2 * k) - this.cam.y * S;
    const glow = (x, y, r) => {
      const X = ox + x * S, Y = oy + y * S, R = r * S;
      if (X < -R || Y < -R || X > L.width + R || Y > L.height + R) return;
      const g = lc.createRadialGradient(X, Y, 0, X, Y, R);
      g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g; lc.fillRect(X - R, Y - R, R * 2, R * 2);
    };
    const warmSpots = [];
    for (const o of this.world.objects) {
      const d = DEFS[o.type];
      if (d.light) { glow(o.x * TILE + 8, o.y * TILE - 6, 40); warmSpots.push([o.x * TILE + 8, o.y * TILE - 6, 26]); }
      else if (d.door && !d.walk && d.cat !== 'storage' && d.cat !== 'special' || o.type === 'farmhouse') {
        const cv = buildingSprite(o.type);
        const X = o.x * TILE + (d.w * TILE - (cv.width - 2)) / 2, Y = (o.y + d.h) * TILE + 1 - (cv.height - 2);
        for (const [lx, ly, lw, lh] of cv.lights || []) { glow(X + lx + lw / 2, Y + ly + lh / 2, 18); warmSpots.push([X + lx + lw / 2, Y + ly + lh / 2, 10]); }
      }
    }
    for (const w of this.world.state.workers) if (!w._hidden) glow(w.x * TILE, w.y * TILE - 4, 14);
    lc.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = k === 4;
    ctx.drawImage(L, 0, 0, L.width * k, L.height * k);
    ctx.imageSmoothingEnabled = false;
    // warm glow on top
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, r] of warmSpots) {
      const [sx, sy] = this.toScreen(x, y);
      const R = r * this.scale;
      const X = sx * this.dpr, Y = sy * this.dpr;
      const g = ctx.createRadialGradient(X, Y, 0, X, Y, R);
      g.addColorStop(0, `rgba(255,160,70,${0.55 * dark})`); g.addColorStop(1, "rgba(255,160,70,0)");
      ctx.fillStyle = g; ctx.fillRect(X - R, Y - R, R * 2, R * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    // fireflies
    if (dark > 0.3) {
      for (let i = 0; i < 14; i++) {
        const x = (Math.sin(this.t * 0.3 + i * 12.7) * 0.5 + 0.5) * this.cv.width, y = (Math.cos(this.t * 0.23 + i * 7.1) * 0.5 + 0.5) * this.cv.height;
        const a = (Math.sin(this.t * 2 + i) * 0.5 + 0.5) * dark;
        ctx.fillStyle = `rgba(230,255,140,${a})`;
        ctx.fillRect(Math.round(x), Math.round(y), Math.round(2 * this.dpr), Math.round(2 * this.dpr));
      }
    }
  }

  drawWeather(dt) {
    if (this.sid === 'winter') { this.drawSnow(dt, this.world.raining ? 160 : 45); return; }
    if (!this.world.raining) { this.rain = null; return; }
    const ctx = this.ctx, W = this.cv.width, H = this.cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(60,80,120,0.16)';
    ctx.fillRect(0, 0, W, H);
    if (!this.rain) this.rain = Array.from({ length: 110 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 0.7 + Math.random() * 0.6 }));
    ctx.fillStyle = 'rgba(200,225,255,0.55)';
    const d = this.dpr;
    for (const r of this.rain) {
      r.y += 420 * d * r.s * dt; r.x -= 60 * d * dt;
      if (r.y > H) { r.y = -10; r.x = Math.random() * W * 1.1; }
      ctx.fillRect(Math.round(r.x), Math.round(r.y), Math.max(1, Math.round(d)), Math.round(7 * d));
    }
  }

  drawSnow(dt, n) {
    const ctx = this.ctx, W = this.cv.width, H = this.cv.height, d = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (n > 60) { ctx.fillStyle = 'rgba(200,215,235,0.12)'; ctx.fillRect(0, 0, W, H); }
    if (!this.snow || this.snow.length !== n) this.snow = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random(), p: Math.random() * 6 }));
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const f of this.snow) {
      f.y += 34 * d * f.s * dt; f.x += Math.sin(this.t * 1.3 + f.p) * 14 * d * dt;
      if (f.y > H) { f.y = -4; f.x = Math.random() * W; }
      const z = Math.max(1, Math.round(d * (f.s > 1.1 ? 2 : 1)));
      ctx.fillRect(Math.round(f.x), Math.round(f.y), z, z);
    }
  }

  /** Little flags strung between the buildings on festival weekends. */
  drawBunting() {
    if (!this.world.festival) return;
    const ctx = this.ctx;
    const tops = this.world.objects.filter((o) => ['farmhouse', 'barn', 'market', 'board', 'cottage'].includes(o.type)).map((o) => {
      const d = DEFS[o.type], cv = buildingSprite(o.type);
      return [o.x * TILE + (d.w * TILE) / 2, (o.y + d.h) * TILE - cv.height + 8];
    }).sort((a, b) => a[0] - b[0]);
    const cols = ['#e04a4a', '#f4c742', '#5b8fe0', '#f08bb0', '#5fb35a'];
    for (let i = 0; i + 1 < tops.length; i++) {
      const [x0, y0] = tops[i], [x1, y1] = tops[i + 1];
      if (x1 - x0 > 14 * TILE || Math.abs(y1 - y0) > 4 * TILE) continue;
      const len = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(len / 5);
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 10;
        ctx.fillStyle = '#5a3a28'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
        if (k % 1 === 0 && k < n) {
          ctx.fillStyle = cols[(k + i) % cols.length];
          const fx = Math.round(x), fy = Math.round(y) + 1;
          ctx.fillRect(fx, fy, 3, 1); ctx.fillRect(fx, fy + 1, 2, 1); ctx.fillRect(fx, fy + 2, 1, 1);
        }
      }
    }
  }

  // ---------- pets ----------
  updatePets(dt) {
    this.petState ||= new Map();
    const pets = this.world.state.pets || [];
    const ids = new Set(pets.map((p) => p.id));
    for (const id of [...this.petState.keys()]) if (!ids.has(id)) this.petState.delete(id);
    const house = this.world.objects.find((o) => o.type === 'farmhouse');
    for (const pet of pets) {
      let p = this.petState.get(pet.id);
      if (!p) {
        const [hx, hy] = house ? doorTile(house) : [24, 20];
        p = { pet, x: hx * TILE + 8 + Math.random() * 16, y: hy * TILE + 10, tx: 0, ty: 0, mode: 'sit', t: 1 + Math.random() * 2, f: 2, left: false };
        this.petState.set(pet.id, p);
      }
      p.pet = pet;
      const speed = pet.kind === 'bunny' ? 14 : 18;
      if (p.mode === 'follow' && p.target && !p.target._hidden) { p.tx = p.target.x * TILE - 10; p.ty = p.target.y * TILE + 6; }
      p.t -= dt;
      if (p.t <= 0) this.petPlan(p);
      if (p.mode === 'walk' || p.mode === 'follow') {
        const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
        if (d > 3) { const st = Math.min(d, speed * dt * (p.mode === 'follow' && d > 30 ? 1.8 : 1)); p.x += (dx / d) * st; p.y += (dy / d) * st; p.left = dx < 0; p.f = pet.kind === 'bunny' ? (Math.floor(this.t * 5) % 2) : Math.floor(this.t * 7) % 2; }
        else { p.f = 2; if (p.mode === 'walk') p.t = Math.min(p.t, 0.1); }
      }
      if (p.mode === 'nap' && Math.random() < dt * 0.6) this.particles.push({ k: 'z', x: p.x + 4, y: p.y - 10, vx: 3, vy: -5, life: 1.6 });
      if (p.hearts > 0) { p.hearts -= dt; if (Math.random() < dt * 8) this.particles.push({ k: 'heart', x: p.x + (Math.random() - 0.5) * 8, y: p.y - 10, vx: 0, vy: -10, life: 1 }); }
    }
  }
  petPlan(p) {
    const r = Math.random(), workers = this.world.state.workers;
    if (r < 0.25 && workers.length) { p.mode = 'follow'; p.target = workers[Math.floor(Math.random() * workers.length)]; p.t = 8 + Math.random() * 10; return; }
    if (r < 0.45) { p.mode = 'nap'; p.f = 3; p.t = 10 + Math.random() * 15; return; }
    if (r < 0.6) { p.mode = 'sit'; p.f = 2; p.t = 3 + Math.random() * 5; return; }
    for (let k = 0; k < 10; k++) {
      const tx = Math.floor(p.x / TILE) + Math.floor(Math.random() * 9) - 4, ty = Math.floor(p.y / TILE) + Math.floor(Math.random() * 7) - 3;
      if (this.world.walkable(tx, ty)) { p.tx = tx * TILE + 8; p.ty = ty * TILE + 12; break; }
    }
    p.mode = 'walk'; p.t = 6;
  }
  drawPet(p) {
    const col = PETS[p.pet.kind].colors[p.pet.color % PETS[p.pet.kind].colors.length];
    const cv = petFrame(p.pet.kind, col, p.f, p.left);
    this.shadow(p.x, p.y - 1, 5, 1.5);
    const [x, y] = this.blit(cv, p.x, p.y, 0);
    this.hits.push({ ref: p.pet, worker: true, x0: x - 2, y0: y - 4, x1: x + cv.width + 2, y1: y + cv.height + 2 });
    if (this.overlay && this.overlay.sel === p.pet) { this.ctx.fillStyle = '#ffe27a'; const b = Math.round(Math.sin(this.t * 5) * 1.5); this.ctx.fillRect(Math.round(p.x) - 1, y - 2 + b, 3, 3); }
  }
  pat(pet) { const p = this.petState && this.petState.get(pet.id); if (p) { p.hearts = 1.2; p.mode = 'sit'; p.f = 2; p.t = 3; } }

  // ---------- build overlays ----------
  drawGrid(vx0, vy0, vx1, vy1) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let x = Math.max(0, Math.floor(vx0 / TILE)); x <= Math.min(MAP.w, vx1 / TILE); x++) ctx.fillRect(x * TILE, Math.max(0, vy0), 0.5, Math.min(MAP.h * TILE, vy1) - Math.max(0, vy0));
    for (let y = Math.max(0, Math.floor(vy0 / TILE)); y <= Math.min(MAP.h, vy1 / TILE); y++) ctx.fillRect(Math.max(0, vx0), y * TILE, Math.min(MAP.w * TILE, vx1) - Math.max(0, vx0), 0.5);
  }

  drawOverlay(ov) {
    const ctx = this.ctx, world = this.world, t = this.t;
    const pulse = 0.55 + Math.sin(t * 5) * 0.25;
    // selection
    if (ov.sel && !ov.sel.role && world.byId.has(ov.sel.id)) {
      const o = ov.sel, d = DEFS[o.type];
      ctx.strokeStyle = `rgba(255,226,122,${pulse + 0.2})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(o.x * TILE + 0.5, o.y * TILE + 0.5, d.w * TILE - 1, d.h * TILE - 1);
      if (d.door) {
        const [dx, dy] = doorTile(o);
        ctx.fillStyle = 'rgba(255,226,122,0.35)';
        ctx.fillRect(dx * TILE + 4, dy * TILE + 4, 8, 8);
      }
      if (o.type === 'beehive') { ctx.strokeStyle = 'rgba(246,213,72,0.5)'; ctx.strokeRect((o.x - 3) * TILE + 0.5, (o.y - 3) * TILE + 0.5, 7 * TILE - 1, 7 * TILE - 1); }
      if (d.radius) { const rr = d.radius; ctx.strokeStyle = 'rgba(162,220,241,0.7)'; ctx.strokeRect((o.x - rr) * TILE + 0.5, (o.y - rr) * TILE + 0.5, (2 * rr + 1) * TILE - 1, (2 * rr + 1) * TILE - 1); }
    }
    // placement ghost
    if (ov.ghost) {
      const g = ov.ghost, d = DEFS[g.type];
      const ok = !g.why;
      ctx.fillStyle = ok ? 'rgba(120,230,120,0.35)' : 'rgba(240,90,90,0.4)';
      ctx.fillRect(g.x * TILE, g.y * TILE, d.w * TILE, d.h * TILE);
      if (d.door) {
        const [dx, dy] = doorTile({ ...g, type: g.type });
        ctx.fillStyle = ok ? 'rgba(255,240,160,0.45)' : 'rgba(240,90,90,0.3)';
        ctx.fillRect(dx * TILE + 3, dy * TILE + 3, 10, 10);
      }
      ctx.globalAlpha = 0.75;
      const o = { ...g, id: -1, st: 'grow', p: 0.6, lvl: 1, out: {}, inp: {} };
      this.drawObject(o, d, g.x * TILE, g.y * TILE, d.w * TILE, d.h * TILE);
      ctx.globalAlpha = 1;
    }
    // land purchase mode
    if (ov.land) {
      const s = world.state;
      const k = parcelsBought(s);
      for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
        const X = px * MAP.parcel * TILE, Y = py * MAP.parcel * TILE, Z = MAP.parcel * TILE;
        if (s.map.owned[py * PW + px]) continue;
        const can = parcelBuyable(world, px, py);
        ctx.fillStyle = can ? 'rgba(255,230,140,0.12)' : 'rgba(20,30,40,0.25)';
        ctx.fillRect(X, Y, Z, Z);
        if (can) {
          ctx.strokeStyle = ov.landSel && ov.landSel[0] === px && ov.landSel[1] === py ? '#fff6c0' : `rgba(255,226,122,${pulse})`;
          ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
          ctx.strokeRect(X + 1, Y + 1, Z - 2, Z - 2);
          ctx.setLineDash([]);
        }
      }
      // labels in screen space
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dpr = this.dpr;
      ctx.font = `${Math.round(12 * dpr)}px "Pixelify Sans", ui-monospace, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
        if (s.map.owned[py * PW + px] || !parcelBuyable(world, px, py)) continue;
        const [sx, sy] = this.toScreen((px + 0.5) * MAP.parcel * TILE, (py + 0.5) * MAP.parcel * TILE);
        const lvl = parcelLevel(k);
        const label = s.level < lvl ? `Lv ${lvl}` : fmtShort(parcelCost(k));
        const w = ctx.measureText(label).width + 26 * dpr;
        ctx.fillStyle = '#35232a'; ctx.fillRect(sx * dpr - w / 2 - dpr, sy * dpr - 10 * dpr, w + 2 * dpr, 20 * dpr);
        ctx.fillStyle = s.level < lvl ? '#c9c0b0' : '#f4e4c1'; ctx.fillRect(sx * dpr - w / 2, sy * dpr - 9 * dpr, w, 18 * dpr);
        ctx.drawImage(iconCoin(s.level < lvl), Math.round(sx * dpr - w / 2 + 4 * dpr), Math.round(sy * dpr - 6 * dpr), Math.round(12 * dpr), Math.round(12 * dpr));
        ctx.fillStyle = '#35232a'; ctx.fillText(label, sx * dpr + 8 * dpr, sy * dpr + dpr);
      }
      ctx.restore();
    }
  }

  /** Topmost thing under a screen point. */
  pick(sx, sy) {
    const [x, y] = this.toWorld(sx, sy);
    let best = null;
    for (const h of this.hits) {
      if (x >= h.x0 && x < h.x1 && y >= h.y0 && y < h.y1) {
        if (!best || h.worker || !best.worker) best = h;
      }
    }
    return best ? best.ref : null;
  }
}

const COL = { bg: gradeHex('#2f5a2c'), forest: gradeHex('#3e7531') };

const hatOf = (w) => w.hat || ROLES[w.role].hat;

function darkAt(h) {
  if (h >= 20.5 || h < 5) return 0.55;
  if (h < 6.5) return 0.55 * (1 - (h - 5) / 1.5);
  if (h < 18.3) return 0;
  return 0.55 * ((h - 18.3) / 2.2);
}

import { icon } from './art/icons.js';
const iconCoin = (lock) => icon(lock ? 'lock' : 'coin');

export function fmtShort(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'k';
  return String(Math.floor(n));
}
