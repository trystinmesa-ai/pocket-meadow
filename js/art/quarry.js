// Quarry art: its ground, rocks and ore veins, the mine cart and the trail
// sign, plus the branches and rocks that turn up as debris on the farm.
import { C, sprite, cached, canvas, pen, shade } from './core.js';
import { gradeCanvas } from './grade.js';
import { TILE, QUARRY, QZONES } from '../data.js';
import { hash2 } from '../world.js';
import { wildSprite } from './decor.js';

const ORE = { copper: ['#e0844a', '#ffb878'], iron: ['#9aa6b8', '#e4ecf6'], gold: ['#f4c542', '#fff0a0'] };

function boulder(P, x, y, w, h, base = C.stone) {
  P.oval(x, y + 1, w, h, shade(base, -0.28)); P.oval(x + 1, y, w - 2, h - 1, base);
  P.oval(x + 2, y + 1, Math.max(2, (w / 2.4) | 0), Math.max(2, (h / 3) | 0), shade(base, 0.22));
}

/** A tree, boulder or ore vein in the quarry. Depleted ones show a stump or rubble. */
export function nodeSprite(k, depleted, season = 'summer') {
  return cached(`qnode:${k}:${depleted ? 1 : 0}:${k === 'tree' ? season : ''}`, () => {
    if (k === 'tree') return depleted ? wildSprite('stump', season) : wildSprite('pine', season);
    if (depleted) return sprite(14, 7, (P) => { boulder(P, 0, 2, 6, 5, C.stoneD); boulder(P, 5, 1, 5, 5, C.stoneD); boulder(P, 9, 3, 5, 4, C.stoneD); });
    const big = k === 'rock';
    return sprite(18, 15, (P) => {
      boulder(P, 0, 2, 18, 13, k === 'gold' ? '#a89a88' : C.stone);
      if (big) { P.line(5, 6, 9, 9, C.stoneD); P.px(12, 5, C.stoneDD); return; }
      const [c, c2] = ORE[k];
      // chunky glinting ore so veins read clearly even zoomed out
      for (const [x, y] of [[3, 6], [8, 4], [12, 7], [7, 9], [11, 11]]) { P.r(x, y, 2, 2, c); P.px(x + 1, y + 1, shade(c, -0.25)); P.px(x, y, c2); }
      P.r(5, 3, 1, 1, c2); P.r(14, 5, 1, 1, c2);
    });
  });
}

export function debrisSprite(type) {
  return cached(`debris:${type}`, () => {
    if (type === 'rubble_log') return sprite(16, 9, (P) => {
      P.r(1, 3, 13, 5, C.wood); P.hl(1, 3, 13, C.woodL); P.hl(1, 7, 13, C.woodD);
      P.oval(12, 3, 4, 5, '#d8a870'); P.px(13, 5, C.woodD); P.line(5, 3, 3, 0, C.woodD); P.px(2, 0, C.leaf); P.px(3, 0, C.leafL);
    });
    if (type === 'rubble_ore') return sprite(14, 11, (P) => {
      boulder(P, 0, 1, 14, 10);
      for (const [x, y] of [[4, 4], [8, 3], [6, 7], [10, 6]]) P.px(x, y, ORE.copper[0]);
      P.px(8, 2, ORE.copper[1]);
    });
    return sprite(14, 10, (P) => { boulder(P, 0, 1, 14, 9); P.px(9, 4, C.stoneD); P.px(3, 8, C.leaf); });
  });
}

export function cartSprite(full) {
  return cached(`cart:${full ? 1 : 0}`, () => sprite(20, 15, (P) => {
    if (full) { P.oval(3, 0, 6, 5, C.wood); P.oval(8, 0, 6, 5, C.stone); P.oval(12, 1, 5, 4, C.stoneD); P.px(10, 1, ORE.copper[0]); }
    P.r(1, 4, 18, 7, '#6a6470'); P.hl(1, 4, 18, '#8a8496'); P.r(2, 5, 16, 1, '#4a4652');
    P.vl(6, 5, 6, '#4a4652'); P.vl(13, 5, 6, '#4a4652');
    for (const x of [4, 15]) { P.oval(x - 2, 10, 5, 5, C.ol); P.px(x, 12, '#8a8496'); }
  }));
}

/** Signpost for the trail from the farm to the quarry. */
export function signSprite(back) {
  return cached(`qsign:${back ? 1 : 0}`, () => sprite(18, 20, (P) => {
    P.vl(8, 6, 14, C.woodD); P.vl(9, 6, 14, C.wood);
    P.r(1, 1, 16, 7, C.woodL); P.hl(1, 1, 16, '#e8b070'); P.hl(1, 7, 16, C.woodD);
    if (back) { P.line(4, 4, 7, 2, C.ol); P.line(4, 4, 7, 6, C.ol); P.hl(5, 4, 8, C.ol); }
    else { P.line(13, 4, 10, 2, C.ol); P.line(13, 4, 10, 6, C.ol); P.hl(4, 4, 8, C.ol); P.px(4, 3, C.stoneDD); }
  }));
}
export function lockSprite() {
  return cached('qlock', () => sprite(16, 16, (P) => {
    P.r(3, 7, 10, 8, C.gold); P.hl(3, 7, 10, C.goldL); P.r(7, 10, 2, 3, C.ol);
    P.r(4, 2, 2, 6, C.stoneD); P.r(10, 2, 2, 6, C.stoneD); P.hl(5, 1, 6, C.stoneD);
  }));
}

/** The whole quarry floor, painted once per zone count and season. */
export function quarryGround(seed, zones, season) {
  return cached(`qground:${seed}:${zones}:${season}`, () => {
    const W = QUARRY.w * TILE, H = QUARRY.h * TILE;
    const cv = canvas(W, H), ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H), d = img.data;
    const pal = [
      ['#6fa74a', '#619a40', '#7fb556'], // woodland edge: grass
      ['#a48a64', '#94795a', '#b49a72'], // copper hollow: dirt
      ['#9a958a', '#8a857c', '#aaa59a'], // iron ridge: grey rock
      ['#8a7f78', '#7a6f6a', '#9a8f88'], // gold seam: dark rock
    ].map((p) => p.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]));
    const zoneOf = (tx) => { let z = 0; for (let i = 0; i < QZONES.length; i++) if (tx >= QZONES[i].x0 - 1) z = i; return z; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const tx = (x / TILE) | 0, ty = (y / TILE) | 0;
      // blend zones over a few pixels so the borders look natural
      const z = zoneOf(((x + (hash2(x >> 2, y >> 2, seed) * 10 - 5)) / TILE) | 0);
      const n = hash2(x >> 1, y >> 1, seed + 3);
      let c = pal[z][n < 0.3 ? 1 : n > 0.85 ? 2 : 0];
      if (Math.abs(ty - QUARRY.road) <= 0 && ty === QUARRY.road) c = n < 0.5 ? [200, 168, 116] : [186, 152, 102]; // the cart road
      if (ty <= 1) c = n < 0.5 ? [112, 104, 98] : [128, 120, 112]; // cliff
      if (ty >= QUARRY.h - 1) c = [90, 84, 80];
      const o = (y * W + x) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const P = pen(cv);
    // cliff edge and rails along the road
    P.hl(0, 2 * TILE, W, '#5a524e'); P.hl(0, 2 * TILE + 1, W, '#6e6660');
    const ry = QUARRY.road * TILE;
    for (let x = 0; x < W; x += 6) { P.r(x, ry + 4, 3, 9, '#7a5a3a'); }
    P.hl(0, ry + 5, W, '#8a8496'); P.hl(0, ry + 11, W, '#8a8496');
    // little bridge where the trail comes in
    for (let x = 0; x < 2 * TILE; x += 3) { P.r(x, ry - 2, 2, TILE + 4, C.woodL); P.px(x, ry - 2, C.woodD); }
    // pebbles and tufts
    for (let ty = 2; ty < QUARRY.h - 1; ty++) for (let tx = 0; tx < QUARRY.w; tx++) {
      if (ty === QUARRY.road) continue;
      const h = hash2(tx, ty, seed + 9), ox = tx * TILE, oy = ty * TILE;
      if (h < 0.25) { const z = zoneOf(tx); const x = ox + 3 + ((h * 40) | 0) % 10, y = oy + 4 + ((h * 97) | 0) % 9;
        if (z === 0) { P.px(x, y, '#4f8c3a'); P.px(x - 1, y - 1, '#4f8c3a'); P.px(x + 1, y - 1, '#8cc45c'); }
        else { P.px(x, y, '#6e6a60'); P.px(x + 1, y, '#bdb8a9'); } }
    }
    // zones you haven't opened yet are fenced off with rope
    for (let i = zones; i < QZONES.length; i++) {
      const x = (QZONES[i].x0 - 1) * TILE + 6;
      for (let y = 2 * TILE; y < (QUARRY.h - 1) * TILE; y += 12) { P.r(x, y, 2, 8, C.woodD); P.hl(x - 1, y + 2, 4, '#e8d8a0'); }
    }
    return gradeCanvas(cv);
  });
}
