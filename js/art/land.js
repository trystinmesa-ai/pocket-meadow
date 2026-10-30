// Ground art: grass, wild land, water, paths and tilled soil.
import { C, canvas, pen, noise, cached, shade } from './core.js';
import { MAP, TILE, DEFS } from '../data.js';
import { idx, inMap } from '../world.js';

function vnoise(x, y, scale, seed) {
  const gx = x / scale, gy = y / scale;
  const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const n00 = noise(x0, y0, seed), n10 = noise(x0 + 1, y0, seed), n01 = noise(x0, y0 + 1, seed), n11 = noise(x0 + 1, y0 + 1, seed);
  return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
}

const RGB = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
// ground palettes per season: [owned land, wild land, tuft dark, tuft light]
const GROUND = {
  spring: [['#4a9038', '#5fa846', '#74bc54', '#8ccc62', '#a8dc78'], ['#3a7a32', '#46883a', '#529642', '#5ea24a', '#6cae52'], '#3f7f30', '#b4e488'],
  summer: [[C.gd, C.g2, C.g1, C.g3, C.g4], ['#3f7a35', '#4a8a3c', '#56963f', '#62a247', '#70ae4f'], C.gd, C.g4],
  autumn: [['#7a7a34', '#8e8a3a', '#a29444', '#b6a24e', '#c8b05a'], ['#6a6a30', '#787434', '#867e3a', '#948a40', '#a29648'], '#6a5a28', '#d8b060'],
  winter: [['#aebfd6', '#bfcfe4', '#cfdcee', '#dde7f6', '#eef3fc'], ['#9cadc4', '#a8b8ce', '#b4c4d8', '#c0cee0', '#ccd8e8'], '#7a90aa', '#ffffff'],
};

/** Paint the whole ground layer into one canvas. Redrawn when land or paths change. */
export function paintTerrain(world, season = 'summer') {
  const [GP, WP, TD, TL] = GROUND[season] || GROUND.summer;
  const G = GP.map(RGB), WILD = WP.map(RGB);
  const W = MAP.w * TILE, H = MAP.h * TILE;
  const cv = canvas(W, H);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const seed = world.state.seed % 1000;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const tx = (x / TILE) | 0, ty = (y / TILE) | 0;
      const own = world.ownedTile(tx, ty);
      const pal = own ? G : WILD;
      const v = vnoise(x, y, 28, seed) * 0.7 + vnoise(x, y, 9, seed + 3) * 0.3;
      let k = v < 0.33 ? 1 : v < 0.62 ? 2 : 3;
      const n = noise(x, y, seed);
      if (n < 0.06) k = Math.max(0, k - 1);
      else if (n > 0.965) k = Math.min(4, k + 1);
      const c = pal[k];
      const o = (y * W + x) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const P = pen(cv);
  // grass tufts and tiny flowers
  for (let ty = 0; ty < MAP.h; ty++) for (let tx = 0; tx < MAP.w; tx++) {
    const own = world.ownedTile(tx, ty);
    const h = noise(tx, ty, seed + 11);
    const ox = tx * TILE, oy = ty * TILE;
    const dark = TD, lite = TL;
    if (h < 0.45) {
      const n = 1 + ((h * 10) | 0) % 3;
      for (let i = 0; i < n; i++) {
        const x = ox + 2 + ((noise(tx, ty, i + 20) * 12) | 0), y = oy + 3 + ((noise(tx, ty, i + 40) * 11) | 0);
        P.px(x, y, dark); P.px(x - 1, y - 1, dark); P.px(x + 1, y - 1, dark); P.px(x, y - 1, lite);
      }
    }
    if (season === 'autumn' && h > 0.7) {
      // fallen leaves
      for (let i = 0; i < 3; i++) P.px(ox + 2 + ((noise(tx, ty, i + 70) * 12) | 0), oy + 2 + ((noise(tx, ty, i + 80) * 12) | 0), ['#d8702e', '#c84a2a', '#e8a838'][i]);
    }
    if (season === 'winter' && h > 0.82) {
      // grass poking through the snow
      const x = ox + 3 + ((noise(tx, ty, 90) * 10) | 0), y = oy + 3 + ((noise(tx, ty, 91) * 10) | 0);
      P.px(x, y, '#6a8a5a'); P.px(x + 1, y - 1, '#7a9a6a'); P.px(x - 1, y - 1, '#6a8a5a');
    }
    if (own && season !== 'winter' && h > (season === 'spring' ? 0.84 : 0.93)) {
      const cols = season === 'autumn' ? ['#e8a838', '#c84a2a', '#fbf8ef'] : ['#fbf8ef', '#f6d548', '#f08bb0', '#a9c8ff'];
      const c = cols[((h * 1000) | 0) % cols.length];
      const x = ox + 3 + ((noise(tx, ty, 60) * 10) | 0), y = oy + 3 + ((noise(tx, ty, 61) * 10) | 0);
      P.px(x, y - 1, c); P.px(x - 1, y, c); P.px(x + 1, y, c); P.px(x, y + 1, c); P.px(x, y, C.yellowD);
    }
  }
  // water and shores
  for (let ty = 0; ty < MAP.h; ty++) for (let tx = 0; tx < MAP.w; tx++) {
    if (world.terrain[idx(tx, ty)] !== 1) continue;
    const ox = tx * TILE, oy = ty * TILE;
    P.r(ox, oy, TILE, TILE, C.water);
    for (let i = 0; i < 6; i++) P.hl(ox + ((noise(tx, ty, i) * 12) | 0), oy + ((noise(tx, ty, i + 9) * 15) | 0), 3, C.waterD);
    const wet = (x, y) => !inMap(x, y) || world.terrain[idx(x, y)] === 1;
    if (!wet(tx, ty - 1)) { P.hl(ox, oy, TILE, '#d9c48c'); P.hl(ox, oy + 1, TILE, C.waterL); }
    if (!wet(tx, ty + 1)) { P.hl(ox, oy + 15, TILE, C.waterDD); P.hl(ox, oy + 14, TILE, C.waterD); }
    if (!wet(tx - 1, ty)) { P.vl(ox, oy, TILE, '#d9c48c'); P.vl(ox + 1, oy, TILE, C.waterL); }
    if (!wet(tx + 1, ty)) { P.vl(ox + 15, oy, TILE, '#c9b47c'); P.vl(ox + 14, oy, TILE, C.waterD); }
  }
  // paths
  for (const o of world.objects) {
    const def = DEFS[o.type];
    if (def.cat === 'path') drawPath(P, world, o);
  }
  return cv;
}

const isPath = (world, x, y) => { const o = world.objAt(x, y); return !!o && DEFS[o.type].cat === 'path'; };

function drawPath(P, world, o) {
  const ox = o.x * TILE, oy = o.y * TILE;
  const n = isPath(world, o.x, o.y - 1), s = isPath(world, o.x, o.y + 1), w = isPath(world, o.x - 1, o.y), e = isPath(world, o.x + 1, o.y);
  const t = o.type;
  const base = t === 'path_dirt' ? C.path : t === 'path_gravel' ? '#b8b0a0' : t === 'path_flag' ? '#8e8a7e' : t === 'path_stone' ? '#a39d8e' : t === 'path_brick' ? '#a65a45' : C.wood;
  const edgeD = t === 'path_dirt' || t === 'path_gravel' ? C.pathD : t === 'path_flag' ? C.stoneDD : t === 'path_stone' ? C.stoneDD : t === 'path_brick' ? C.brickD : C.woodDD;
  // footprint with soft irregular edges
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const jag = noise(ox + x, oy + y, 5) < 0.5 ? 1 : 2;
    if (!n && y < jag) continue;
    if (!s && y > TILE - 1 - jag) continue;
    if (!w && x < jag) continue;
    if (!e && x > TILE - 1 - jag) continue;
    let c = base;
    if (t === 'path_dirt') { const k = noise(ox + x, oy + y, 9); c = k < 0.12 ? C.pathD : k > 0.9 ? C.pathL : C.path; }
    if (t === 'path_gravel') { const k = noise(ox + x, oy + y, 13); c = k < 0.25 ? '#958d80' : k > 0.75 ? '#d8d0c0' : '#b8b0a0'; }
    P.px(ox + x, oy + y, c);
  }
  if (t === 'path_stone') {
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const sx = ox + 1 + i * 5 + (j % 2 ? 2 : 0) - 1, sy = oy + 1 + j * 5;
      const k = noise(o.x * 3 + i, o.y * 3 + j, 4);
      const c = k < 0.33 ? C.stone : k < 0.66 ? C.stoneL : '#cbc6b5';
      if (sx < ox + (w ? 0 : 2) || sx + 4 > ox + TILE - (e ? 0 : 2)) continue;
      if (sy < oy + (n ? 0 : 2) || sy + 4 > oy + TILE - (s ? 0 : 2)) continue;
      P.rr(sx, sy, 4, 4, c); P.px(sx + 1, sy + 1, C.white); P.hl(sx + 1, sy + 3, 2, C.stoneD);
    }
  } else if (t === 'path_brick') {
    for (let j = 0; j < 4; j++) {
      const y = oy + j * 4;
      P.hl(ox + (w ? 0 : 2), y + 3, TILE - (w ? 0 : 2) - (e ? 0 : 2), C.brickD);
      for (let i = (j % 2 ? -4 : 0); i < TILE; i += 8) {
        if (i > 0 && i < TILE) P.vl(ox + i, y, 3, C.brickD);
        P.hl(ox + Math.max(i + 1, w ? 0 : 2), y, 3, C.brickL);
      }
    }
  } else if (t === 'path_flag') {
    const k = noise(o.x, o.y, 21);
    const slabs = k < 0.5 ? [[1, 1, 8, 6], [10, 1, 5, 7], [1, 8, 6, 7], [8, 9, 7, 6]] : [[1, 1, 6, 8], [8, 1, 7, 5], [8, 7, 7, 8], [1, 10, 6, 5]];
    for (const [sx, sy, w, h] of slabs) { P.rr(ox + sx, oy + sy, w, h, noise(sx, sy + o.x, o.y) < 0.5 ? C.stone : '#cbc6b5'); P.hl(ox + sx + 1, oy + sy, w - 2, C.stoneL); P.hl(ox + sx + 1, oy + sy + h - 1, w - 2, C.stoneD); }
  } else if (t === 'path_wood') {
    for (let j = 0; j < 4; j++) {
      const y = oy + j * 4;
      P.hl(ox, y + 3, TILE, C.woodDD); P.hl(ox, y, TILE, C.woodL);
      P.px(ox + 2, y + 1, C.woodDD); P.px(ox + 13, y + 1, C.woodDD);
    }
  }
  // darker rim on open sides
  if (!n) P.hl(ox + 2, oy + 1, TILE - 4, edgeD);
  if (!s) P.hl(ox + 2, oy + TILE - 2, TILE - 4, shade(edgeD, -0.1));
  if (!w) P.vl(ox + 1, oy + 2, TILE - 4, edgeD);
  if (!e) P.vl(ox + TILE - 2, oy + 2, TILE - 4, edgeD);
}

/** Tilled soil tile; mask bits say which sides join another plot (1 N, 2 E, 4 S, 8 W). */
export function soilTile(wet, mask) {
  return cached(`soil:${wet ? 1 : 0}:${mask}`, () => {
    const cv = canvas(TILE, TILE);
    const P = pen(cv);
    const b = wet ? C.wet : C.soil, dk = wet ? C.wetD : C.soilD, lt = wet ? C.wetL : C.soilL;
    const N = mask & 1, E = mask & 2, S = mask & 4, W = mask & 8;
    const x0 = W ? 0 : 1, y0 = N ? 0 : 1, x1 = E ? 16 : 15, y1 = S ? 16 : 15;
    P.r(x0, y0, x1 - x0, y1 - y0, b);
    // furrows
    for (const fy of [3, 8, 13]) {
      P.hl(x0, fy, x1 - x0, lt);
      P.hl(x0, fy + 1, x1 - x0, b);
      P.hl(x0, fy + 2, x1 - x0, dk);
    }
    for (let i = 0; i < 6; i++) P.px(x0 + ((noise(i, mask, wet ? 3 : 4) * (x1 - x0)) | 0), y0 + ((noise(i, mask, 7) * (y1 - y0)) | 0), dk);
    // rims
    if (!N) P.hl(x0, 0, x1 - x0, C.gd);
    if (!S) { P.hl(x0, 15, x1 - x0, C.gdd); P.hl(x0, 14, x1 - x0, dk); }
    if (!W) P.vl(0, y0, y1 - y0, C.gd);
    if (!E) P.vl(15, y0, y1 - y0, C.gd);
    if (!N && !W) P.px(1, 1, C.gd);
    if (!N && !E) P.px(14, 1, C.gd);
    if (wet) for (const [x, y] of [[4, 5], [11, 10], [7, 2]]) P.px(x, y, '#7d5a48');
    return cv;
  });
}

/** Three frames of glints drawn over water tiles. */
export function waterGlint(frame) {
  return cached(`glint:${frame}`, () => {
    const cv = canvas(TILE, TILE);
    const P = pen(cv);
    for (let i = 0; i < 3; i++) {
      const x = ((noise(i, frame, 77) * 11) | 0) + 1, y = ((noise(i, frame, 78) * 12) | 0) + 2;
      P.hl(x, y, 2 + (i % 2), C.waterL);
    }
    return cv;
  });
}

/** Small preview of a path type for menus. */
export function pathThumb(type) {
  return cached(`pthumb:${type}`, () => {
    const cv = canvas(48, 16);
    const P = pen(cv);
    const fake = { objAt: (x, y) => (y === 0 && x >= 0 && x <= 2 ? { type } : null) };
    for (let x = 0; x < 3; x++) drawPath(P, fake, { type, x, y: 0 });
    const out = canvas(16, 16);
    out.getContext('2d').drawImage(cv, 16, 0, 16, 16, 0, 0, 16, 16);
    return out;
  });
}
