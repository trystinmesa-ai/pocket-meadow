// Building interiors: one cosy, lived-in room per building, drawn in the same
// pixel style as the farm. The room (floor, walls, furniture) is painted once
// and cached, along with where its lamps and windows are so the renderer can
// light it for the time of day. The renderer adds the lively bits on top:
// animals, the artisan at work, the oven's glow, goods on the shelves.
import { C, cached, canvas, pen, shade } from './core.js';
import { gradeCanvas } from './grade.js';
import { TILE, DEFS } from '../data.js';
import { itemIcon } from './items.js';
import { hash2 } from '../world.js';

export const ROOM = { w: 14, h: 9 };
export const RW = ROOM.w * TILE, RH = ROOM.h * TILE;
export const WALL_H = 34; // wall height in pixels; the floor starts below it

const FLOORS = {
  wood: ['#b07a48', '#9c6a3c', '#c48c56'], plank: ['#8a6a4a', '#7a5a3c', '#9a7a58'], stone: ['#a8a29a', '#968f88', '#b8b2aa'],
  straw: ['#d8b860', '#c8a44c', '#e8c878'], tile: ['#efe6d4', '#d6c8b0', '#f6efe0'], dirt: ['#8e6a48', '#7e5c3c', '#9c7854'],
  cellar: ['#7a7068', '#6a6058', '#8a8078'], tatami: ['#c8c890', '#b4b47c', '#d8d8a4'], pastel: ['#f0dce4', '#e0c4d0', '#f8e8ee'],
};
const WALLS = {
  cream: ['#f0e2c0', '#d8c8a0'], plank: ['#a8744a', '#8a5a32'], stone: ['#b8b0a4', '#9a9288'], brick: ['#c06a50', '#9a4a38'],
  red: ['#b8503a', '#943c2a'], pastel: ['#f4d8e4', '#e0b8cc'], dark: ['#6a4a34', '#54382a'], glass: ['#dff4f2', '#b8e2e0'], teal: ['#8ac0b0', '#6aa090'],
  sage: ['#c8d8b0', '#a8bc90'], blue: ['#a8c0d8', '#88a0bc'],
};

// lamps and windows found while painting a room (kept with its canvas)
let LIGHTS = [], WINS = [];
const light = (x, y, r = 28, c = 'warm') => LIGHTS.push([x, y, r, c]);

// ---------- the room shell ----------
function paintFloor(P, kind, seed) {
  const [a, b, c] = FLOORS[kind];
  for (let y = WALL_H; y < RH; y++) for (let x = 0; x < RW; x++) {
    const n = hash2(x >> 2, y >> 1, seed);
    let col = n < 0.07 ? b : n > 0.95 ? c : a;
    if (kind === 'wood' || kind === 'plank') { if ((y - WALL_H) % 8 === 0) col = b; if ((x + ((y - WALL_H) >> 3) * 11) % 32 === 0) col = shade(a, -0.2); }
    if (kind === 'tile') col = (((x >> 4) + ((y - WALL_H) >> 4)) & 1) ? b : a;
    if (kind === 'pastel') col = (((x >> 3) + ((y - WALL_H) >> 3)) & 1) ? b : a;
    if (kind === 'tatami' && (x % 32 === 0 || (y - WALL_H) % 16 === 0)) col = shade(a, -0.25);
    if (kind === 'stone' || kind === 'cellar') { if ((y - WALL_H) % 12 === 0 || (x + ((y - WALL_H) / 12 | 0) * 7) % 20 === 0) col = shade(a, -0.18); }
    if (kind === 'straw' && hash2(x, y, seed + 9) < 0.06) col = '#b8903c';
    P.px(x, y, col);
  }
}
function paintWalls(P, kind, windows = []) {
  const [a, b] = WALLS[kind];
  P.r(0, 0, RW, WALL_H, a);
  if (kind === 'plank' || kind === 'red' || kind === 'dark') for (let x = 0; x < RW; x += 10) P.vl(x, 0, WALL_H, b);
  if (kind === 'brick' || kind === 'stone') for (let y = 0; y < WALL_H; y += 6) { P.hl(0, y, RW, b); for (let x = (y / 6) % 2 ? 0 : 6; x < RW; x += 12) P.vl(x, y, 6, b); }
  if (kind === 'cream' || kind === 'sage' || kind === 'blue' || kind === 'pastel' || kind === 'teal') { for (let x = 4; x < RW; x += 12) P.vl(x, 0, WALL_H - 12, shade(a, -0.05)); P.hl(0, WALL_H - 12, RW, shade(a, -0.22)); P.r(0, WALL_H - 11, RW, 8, shade(a, -0.1)); }
  if (kind === 'glass') {
    for (let y = 0; y < WALL_H; y++) P.hl(0, y, RW, y < 18 ? '#a8dcf0' : '#c4ead8');
    for (let x = 0; x < RW; x += 7) P.oval(x - 2, 20 + ((x * 7) % 5), 10, 9, '#8cc46c');
    for (let x = 0; x < RW; x += 16) { P.r(x, 0, 2, WALL_H, C.white); P.vl(x + 2, 0, WALL_H, '#a8c8c4'); }
    P.r(0, 14, RW, 2, C.white); WINS.push([0, 0, RW, WALL_H - 3]);
  }
  P.hl(0, WALL_H - 3, RW, shade(a, -0.35)); P.hl(0, WALL_H - 2, RW, shade(a, -0.2)); P.hl(0, WALL_H - 1, RW, C.ol);
  for (const w of windows) { const [x, cur] = Array.isArray(w) ? w : [w, null]; win(P, x, 5, cur); }
  P.r(0, WALL_H, 3, RH - WALL_H, shade(a, -0.3)); P.r(RW - 3, WALL_H, 3, RH - WALL_H, shade(a, -0.3));
  P.r(0, RH - 3, RW, 3, shade(a, -0.4));
  P.r(RW / 2 - 12, RH - 4, 24, 4, '#c49a62'); P.hl(RW / 2 - 12, RH - 4, 24, '#e0b878');
  P.rr(RW / 2 - 10, RH - 13, 20, 8, '#8a5a32'); P.rr(RW / 2 - 9, RH - 12, 18, 6, '#c9944a'); for (let i = 0; i < 18; i += 3) P.vl(RW / 2 - 8 + i, RH - 11, 4, '#a8743a');
}
function win(P, x, y, curtain, w = 18, h = 16) {
  P.r(x - 2, y - 2, w + 4, h + 4, C.woodD); P.r(x, y, w, h, '#a8daf0'); P.r(x, y + h / 2, w, h / 2, '#8cc8e4');
  P.oval(x + 2, y + h - 5, 8, 6, '#8cc46c'); P.oval(x + 9, y + h - 6, 9, 7, '#7ab85a');
  P.vl(x + w / 2, y, h, C.woodD); P.hl(x, y + h / 2, w, C.woodD); P.px(x + 1, y + 1, '#ffffff'); P.px(x + 2, y + 1, '#e8f8ff');
  P.r(x - 3, y + h + 1, w + 6, 2, C.woodL);
  WINS.push([x, y, w, h]);
  if (curtain) { P.hl(x - 5, y - 3, w + 10, C.woodDD); for (const cx of [x - 5, x + w + 1]) { P.r(cx, y - 2, 4, h + 3, curtain); P.vl(cx + 1, y - 2, h + 3, shade(curtain, 0.2)); P.r(cx, y + h, 4, 2, shade(curtain, -0.2)); } }
}

// ---------- furniture & bits ----------
const icon = (c, k, x, y) => c.drawImage(itemIcon(k), x, y);
const ART = [
  (P, x, y, w, h) => { P.r(x, y, w, h, '#a8d8f0'); P.oval(x - 2, y + h - 6, w * 0.7, 10, '#6aae5a'); P.oval(x + w * 0.4, y + h - 7, w * 0.8, 10, '#4f8c3a'); P.r(x + w - 6, y + 2, 3, 3, C.gold); },
  (P, x, y, w, h) => { P.r(x, y, w, h, '#3a4a6a'); P.rr(x + w / 2 - 3, y + h - 7, 6, 6, '#e8e0d0'); for (const [dx, c] of [[-3, C.red], [0, C.yellow], [3, C.pink]]) P.oval(x + w / 2 + dx - 2, y + h - 12, 4, 4, c); P.vl(x + w / 2, y + h - 9, 3, C.leaf); },
  (P, x, y, w, h) => { P.r(x, y, w, h, '#e8d8b0'); P.oval(x + w / 2 - 4, y + 2, 8, 8, '#d9a27a'); P.r(x + w / 2 - 3, y + 1, 6, 3, '#6b4226'); P.r(x + w / 2 - 5, y + 10, 10, h - 10, '#4f7fd0'); },
  (P, x, y, w, h) => { P.r(x, y, w, h / 2, '#f4c890'); P.r(x, y + h / 2, w, h / 2, '#4f8fc8'); P.oval(x + w / 2 - 3, y + h / 2 - 3, 6, 6, '#f0702e'); P.hl(x + 1, y + h / 2 + 3, w - 2, '#8ac0f0'); },
  (P, x, y, w, h) => { for (let i = 0; i < w; i += 3) P.vl(x + i, y, h, ['#d94545', '#f4c542', '#5b8fe0', '#5fb35a'][(i / 3) % 4]); },
];
function painting(P, x, y, w = 16, h = 12, kind = 0, frame = C.goldD) {
  P.r(x - 2, y - 2, w + 4, h + 4, frame); P.hl(x - 2, y - 2, w + 4, shade(frame, 0.3));
  ART[kind % ART.length](P, x, y, w, h);
}
function clock(P, x, y) { P.oval(x, y, 12, 12, C.woodD); P.oval(x + 1, y + 1, 10, 10, C.cream); P.vl(x + 6, y + 3, 3, C.ol); P.hl(x + 6, y + 6, 3, C.ol); P.px(x + 6, y + 6, C.red); }
function bunting(P, x, y, w) { P.hl(x, y, w, C.woodD); for (let i = 0; i < w; i += 8) { const c = [C.red, C.yellow, C.blue, C.pink, C.leaf][(i / 8) % 5]; P.r(x + i + 1, y + 1, 5, 2, c); P.r(x + i + 2, y + 3, 3, 2, c); P.px(x + i + 3, y + 5, c); } }
function sconce(P, x, y) { P.r(x, y + 4, 4, 3, C.goldD); P.r(x - 1, y, 6, 5, C.glow); P.hl(x - 1, y, 6, '#fff4c0'); light(x + 2, y + 3, 26); }
function lantern(P, x, y) { P.vl(x + 3, y - 3, 3, C.stoneDD); P.r(x, y, 7, 9, '#4a4652'); P.r(x + 1, y + 2, 5, 5, C.glow); P.px(x + 3, y + 3, '#ffffff'); light(x + 3, y + 5, 30); }
function candle(P, x, y) { P.r(x, y + 2, 3, 5, C.cream); P.px(x + 1, y, '#f4c542'); P.px(x + 1, y + 1, '#ff8a3a'); light(x + 1, y + 1, 16); }
function pendant(P, x, y, c = '#3a6a5a') { P.vl(x + 4, 0, y, C.stoneDD); P.r(x, y, 9, 4, c); P.hl(x - 1, y + 4, 11, shade(c, -0.2)); P.r(x + 2, y + 5, 5, 2, C.glow); light(x + 4, y + 8, 34); }
function fairyLights(P, x, y, w) { for (let i = 0; i < w; i += 2) P.px(x + i, y + Math.round(Math.sin(i / 8) * 3), C.woodDD); for (let i = 4; i < w; i += 14) { const yy = y + Math.round(Math.sin(i / 8) * 3) + 1; P.r(x + i, yy, 2, 2, [C.yellow, C.pink, '#a8e0ff', C.leafL][(i / 14 | 0) % 4]); light(x + i + 1, yy + 1, 26); } }
function lamp(P, x, y) { P.vl(x + 3, y + 5, 10, C.woodDD); P.r(x, y, 8, 6, C.glow); P.hl(x, y, 8, '#fff0b0'); P.r(x + 1, y + 15, 6, 2, C.woodDD); light(x + 4, y + 3, 34); }
function bed(P, x, y, blanket) {
  P.r(x, y, 18, 28, C.woodD); P.r(x + 1, y + 1, 16, 26, C.woodL);
  P.r(x + 2, y + 2, 14, 7, C.white); P.hl(x + 2, y + 8, 14, C.whiteD);
  P.r(x + 2, y + 10, 14, 16, blanket); P.hl(x + 2, y + 10, 14, shade(blanket, 0.25));
  for (let i = 0; i < 3; i++) P.hl(x + 2, y + 14 + i * 4, 14, shade(blanket, -0.15));
  P.px(x + 5, y + 18, C.white); P.px(x + 11, y + 22, C.white);
}
function nightstand(P, x, y) { P.r(x, y, 10, 10, C.wood); P.hl(x, y, 10, C.woodL); P.hl(x + 2, y + 5, 6, C.woodDD); candle(P, x + 3, y - 7); }
function dresser(P, x, y) { P.r(x, y, 22, 16, C.wood); P.hl(x, y, 22, C.woodL); for (let i = 0; i < 3; i++) { P.hl(x + 1, y + 4 + i * 4, 20, C.woodD); P.px(x + 10, y + 2 + i * 4, C.gold); } P.r(x + 1, y + 16, 2, 2, C.woodDD); P.r(x + 19, y + 16, 2, 2, C.woodDD); }
function bookshelf(P, x, y, w = 20) {
  P.r(x, y, w, 28, C.woodD); P.r(x + 1, y + 1, w - 2, 26, C.woodDD);
  for (let r = 0; r < 3; r++) { P.hl(x + 1, y + 9 + r * 9, w - 2, C.wood); for (let i = 2; i < w - 2; i += 3) { const h = 5 + ((i + r) % 3); P.r(x + i, y + 9 + r * 9 - h, 2, h, [C.red, C.blue, C.leaf, C.yellow, C.purple, C.orange][(i + r * 2) % 6]); } }
}
function armchair(P, x, y, c) { P.rr(x, y, 16, 14, shade(c, -0.25)); P.rr(x + 2, y + 1, 12, 8, c); P.r(x + 1, y + 8, 14, 5, shade(c, 0.15)); P.r(x, y + 4, 3, 9, shade(c, -0.1)); P.r(x + 13, y + 4, 3, 9, shade(c, -0.1)); }
function sofa(P, x, y, c) { P.rr(x, y, 34, 14, shade(c, -0.25)); P.r(x + 2, y + 1, 30, 7, c); P.r(x + 2, y + 8, 30, 5, shade(c, 0.15)); P.vl(x + 17, y + 8, 5, shade(c, -0.1)); P.r(x + 4, y + 3, 6, 5, C.cream); P.r(x + 24, y + 3, 6, 5, C.yellow); }
function rug(P, x, y, w, h, c) { P.rr(x, y, w, h, c); P.rr(x + 2, y + 2, w - 4, h - 4, shade(c, 0.2)); P.rr(x + 4, y + 4, w - 8, h - 8, c); for (let i = 2; i < w - 2; i += 3) { P.px(x + i, y - 1, C.cream); P.px(x + i, y + h, C.cream); } }
function rugRound(P, x, y, w, h, c) { P.oval(x, y, w, h, c); P.oval(x + 3, y + 2, w - 6, h - 4, shade(c, 0.2)); P.oval(x + 7, y + 4, w - 14, h - 8, c); }
function table(P, x, y, w = 24) { P.r(x, y, w, 10, C.wood); P.hl(x, y, w, C.woodL); P.hl(x, y + 9, w, C.woodDD); P.r(x + 1, y + 10, 2, 5, C.woodDD); P.r(x + w - 3, y + 10, 2, 5, C.woodDD); }
function cloth(P, x, y, w, c = '#e8d8f0') { P.r(x - 1, y - 1, w + 2, 7, c); for (let i = 0; i < w + 2; i += 4) P.r(x - 1 + i, y + 6, 2, 2, c); }
function chair(P, x, y) { P.r(x, y, 8, 3, C.woodD); P.r(x, y + 3, 8, 5, C.wood); P.r(x, y + 8, 2, 3, C.woodDD); P.r(x + 6, y + 8, 2, 3, C.woodDD); }
function cafeTable(P, c, x, y, k) { chair(P, x - 10, y + 2); chair(P, x + 14, y + 2); P.oval(x, y, 14, 6, C.white); P.oval(x + 1, y + 1, 12, 4, '#f4efe6'); P.vl(x + 6, y + 6, 6, C.stoneDD); P.hl(x + 3, y + 12, 8, C.stoneDD); if (k) icon(c, k, x + 1, y - 7); candle(P, x + 10, y - 5); }
function shelf(P, c, x, y, w, items) { P.r(x, y + 10, w, 3, C.woodD); P.hl(x, y + 10, w, C.woodL); P.r(x, y + 13, 2, 3, C.woodDD); P.r(x + w - 2, y + 13, 2, 3, C.woodDD); items.forEach((k, i) => { if (i * 11 + 10 <= w) icon(c, k, x + i * 11, y); }); }
function wallShelf(P, c, x, y, w, items) { P.r(x, y + 10, w, 2, C.woodD); P.hl(x, y + 10, w, C.woodL); P.px(x + 2, y + 12, C.woodDD); P.px(x + w - 3, y + 12, C.woodDD); items.forEach((k, i) => { if (i * 11 + 10 <= w) icon(c, k, x + 1 + i * 11, y); }); }
function cupboard(P, x, y, w) { P.r(x, y, w, 16, C.woodL); P.hl(x, y, w, '#e8b878'); for (let i = 0; i < w; i += 12) { P.r(x + i + 1, y + 2, 10, 12, C.wood); P.px(x + i + 9, y + 8, C.gold); } P.hl(x, y + 15, w, C.woodDD); }
function plates(P, x, y, n = 4) { for (let i = 0; i < n; i++) { P.oval(x + i * 7, y, 7, 7, C.white); P.oval(x + i * 7 + 2, y + 2, 3, 3, ['#5b8fe0', C.red, C.leaf, C.yellow][i % 4]); } }
function utensils(P, x, y) { P.hl(x, y, 34, C.stoneDD); for (let i = 0; i < 6; i++) { P.vl(x + 3 + i * 6, y + 1, 7, C.stoneD); if (i % 2) P.oval(x + 1 + i * 6, y + 7, 5, 4, '#c87a3a'); else P.r(x + 2 + i * 6, y + 7, 3, 3, C.stoneL); } }
function knives(P, x, y) { P.r(x, y, 22, 3, C.woodDD); for (let i = 0; i < 4; i++) { P.vl(x + 3 + i * 5, y + 3, 7, C.stoneL); P.r(x + 2 + i * 5, y - 3, 3, 4, C.woodD); } }
function cuttingBoard(P, c, x, y, k = 'bread') { P.rr(x, y, 20, 10, C.woodL); P.hl(x + 1, y + 1, 18, '#e8b878'); P.px(x + 17, y + 4, C.woodDD); icon(c, k, x + 4, y - 3); }
function mixingBowl(P, x, y, c = '#5b8fe0') { P.oval(x, y + 2, 14, 9, shade(c, -0.2)); P.oval(x + 1, y + 1, 12, 5, '#f6ead0'); P.r(x + 1, y + 4, 12, 4, c); P.line(x + 9, y - 3, x + 12, y + 2, C.woodL); }
function register(P, x, y) { P.r(x, y + 4, 16, 9, '#4a4652'); P.r(x + 2, y, 12, 6, '#6a6672'); P.r(x + 3, y + 1, 10, 3, '#a8e0a0'); for (let i = 0; i < 4; i++) P.px(x + 3 + i * 3, y + 7, C.gold); P.r(x + 1, y + 11, 14, 2, '#3a3640'); }
function chalkboard(P, x, y, w = 26, h = 18) { P.r(x - 1, y - 1, w + 2, h + 2, C.woodD); P.r(x, y, w, h, '#2e3a32'); for (let j = 0; j < 4; j++) { P.hl(x + 2, y + 3 + j * 4, w - 8 - ((j * 5) % 7), '#e8e8e0'); P.px(x + w - 4, y + 3 + j * 4, C.yellow); } }
function counter(P, x, y, w, top = C.woodL) { P.r(x, y, w, 14, C.wood); P.r(x, y, w, 3, top); P.hl(x, y + 13, w, C.woodDD); for (let i = 6; i < w; i += 12) P.vl(x + i, y + 4, 9, C.woodD); }
function glassCase(P, c, x, y, w, items) {
  P.r(x, y, w, 18, C.woodD); P.r(x + 1, y + 1, w - 2, 12, '#cdeef6'); P.hl(x + 1, y + 1, w - 2, '#ffffff'); P.hl(x + 1, y + 7, w - 2, '#b8dce4');
  items.forEach((k, i) => { if (i * 11 + 12 <= w) icon(c, k, x + 2 + i * 11, y + 2); });
  P.r(x, y + 13, w, 5, C.wood); P.hl(x, y + 13, w, C.woodL);
}
function oven(P, x, y) { P.r(x, y, 30, 30, C.brick); for (let j = 0; j < 30; j += 5) P.hl(x, y + j, 30, C.brickD); P.oval(x + 6, y + 10, 18, 14, '#3a2a28'); P.r(x + 6, y + 17, 18, 7, '#3a2a28'); P.r(x + 11, y - 8, 8, 10, C.brick); P.hl(x - 2, y + 28, 34, C.stoneD); }
function stove(P, x, y) { P.r(x, y, 28, 20, '#4a4652'); P.hl(x, y, 28, '#6a6672'); P.oval(x + 3, y + 2, 9, 4, '#2a2830'); P.oval(x + 15, y + 2, 9, 4, '#2a2830'); P.r(x + 4, y + 9, 20, 8, '#3a3640'); P.r(x + 5, y + 10, 18, 6, '#e8702a'); light(x + 14, y + 13, 22); }
function pot(P, x, y, c = '#c8603a') { P.rr(x, y, 14, 10, '#4a4652'); P.r(x + 1, y, 12, 3, c); P.hl(x - 1, y + 1, 2, '#4a4652'); P.hl(x + 13, y + 1, 2, '#4a4652'); }
function fireplace(P, x, y) {
  P.r(x, y, 34, 30, C.brick); for (let j = 0; j < 30; j += 5) P.hl(x, y + j, 34, C.brickD); P.r(x - 2, y - 2, 38, 4, C.stoneD);
  P.r(x + 7, y + 12, 20, 18, '#2a1e1e'); P.r(x + 10, y + 24, 14, 4, C.woodD); light(x + 17, y + 22, 44, 'fire');
}
function barrel(P, x, y) { P.rr(x, y, 12, 15, C.wood); P.hl(x, y + 3, 12, C.stoneDD); P.hl(x, y + 11, 12, C.stoneDD); P.vl(x + 2, y + 1, 13, C.woodL); P.oval(x + 1, y - 1, 10, 4, C.woodD); }
function crate(P, x, y, s = 14) { P.r(x, y, s, s, C.wood); P.r(x, y, s, 2, C.woodL); P.line(x, y + s - 1, x + s - 1, y, C.woodD); P.vl(x, y, s, C.woodDD); P.vl(x + s - 1, y, s, C.woodDD); P.hl(x, y + s - 1, s, C.woodDD); }
function produceCrate(P, c, x, y, k) { crate(P, x, y, 16); icon(c, k, x + 1, y - 4); icon(c, k, x + 6, y - 5); }
function sack(P, c, x, y, k) { P.oval(x, y + 3, 14, 13, '#d8c49a'); P.oval(x + 3, y, 8, 6, '#c8b088'); P.hl(x + 4, y + 4, 6, '#a8905e'); if (k) icon(c, k, x + 2, y + 6); }
function basket(P, c, x, y, k) { P.rr(x, y + 4, 14, 9, '#c9944a'); P.hl(x, y + 4, 14, '#e0b06a'); for (let i = 1; i < 14; i += 2) P.vl(x + i, y + 5, 7, '#a8743a'); if (k) { icon(c, k, x + 1, y - 2); icon(c, k, x + 4, y - 3); } }
function hay(P, x, y, w = 24) { P.rr(x - 1, y - 1, w + 2, 16, '#9a7428'); P.rr(x, y, w, 14, '#e0c060'); P.hl(x, y + 4, w, '#c8a440'); P.hl(x, y + 9, w, '#c8a440'); for (let i = 2; i < w; i += 4) P.px(x + i, y + 1, '#f4dc88'); }
function hayPile(P, x, y) { P.oval(x - 1, y, 28, 15, '#9a7428'); P.oval(x, y, 26, 14, '#e0c060'); P.oval(x + 4, y - 3, 18, 10, '#ecd078'); for (let i = 0; i < 8; i++) P.px(x + 3 + i * 3, y + 3 + (i % 3), '#c8a440'); }
function plant(P, x, y) { P.r(x + 2, y + 9, 8, 7, '#c0603a'); P.hl(x + 2, y + 9, 8, '#e07850'); P.oval(x, y, 12, 10, C.leaf); P.px(x + 3, y + 2, C.leafL); P.px(x + 8, y + 4, C.leafL); }
function plantTall(P, x, y) { P.r(x + 3, y + 22, 10, 9, '#c0603a'); P.hl(x + 3, y + 22, 10, '#e07850'); P.vl(x + 8, y + 6, 16, C.woodD); for (const [dx, dy] of [[-1, 0], [8, 3], [0, 9], [9, 12], [2, 15]]) P.oval(x + dx, y + dy, 9, 7, dy % 2 ? C.leaf : C.leafD); }
function hangingPlant(P, x, y) { P.vl(x + 5, 0, y, C.stoneDD); P.r(x + 1, y, 9, 6, '#c0603a'); P.oval(x - 2, y - 3, 15, 7, C.leaf); for (let i = 0; i < 4; i++) P.vl(x - 1 + i * 4, y + 4, 4 + (i % 2) * 3, C.leafD); }
function flowers(P, x, y) { P.rr(x + 1, y + 6, 8, 8, '#8ac0d8'); for (const [dx, dy, c] of [[1, 1, C.red], [5, 0, C.yellow], [3, 3, C.pink]]) { P.vl(x + dx + 1, y + dy + 2, 4, C.leaf); P.r(x + dx, y + dy, 3, 3, c); } }
function bench(P, x, y, w = 30) { P.r(x, y, w, 4, C.wood); P.hl(x, y, w, C.woodL); P.r(x + 2, y + 4, 2, 5, C.woodDD); P.r(x + w - 4, y + 4, 2, 5, C.woodDD); }
function stool(P, x, y) { P.oval(x, y, 10, 4, C.woodL); P.vl(x + 2, y + 3, 6, C.woodDD); P.vl(x + 7, y + 3, 6, C.woodDD); }
function broom(P, x, y) { P.line(x, y, x + 4, y + 22, C.woodL); P.r(x + 2, y + 20, 7, 6, '#d8b860'); for (let i = 0; i < 7; i += 2) P.vl(x + 2 + i, y + 22, 4, '#b8903c'); }
function ladder(P, x, y, h = 40) { P.vl(x, y, h, C.woodL); P.vl(x + 8, y, h, C.woodL); for (let j = 4; j < h; j += 6) P.hl(x, y + j, 9, C.wood); }
function toolRack(P, x, y) { P.hl(x, y, 36, C.woodDD); P.vl(x + 4, y, 22, C.woodL); P.r(x + 1, y + 20, 7, 3, C.stoneD); P.vl(x + 14, y, 22, C.woodL); P.r(x + 11, y + 20, 7, 2, C.stoneD); for (let i = 0; i < 3; i++) P.vl(x + 11 + i * 3, y + 22, 3, C.stoneD); P.vl(x + 26, y, 18, C.woodL); P.oval(x + 22, y + 17, 9, 7, C.stoneD); }
function workbench(P, c, x, y, w = 40) { table(P, x, y, w); P.r(x + 4, y - 4, 8, 4, C.stoneD); P.line(x + 16, y - 1, x + 24, y - 5, C.woodL); P.r(x + 23, y - 6, 4, 3, C.stoneDD); P.r(x + w - 12, y - 6, 9, 6, '#c9944a'); }
function bucket(P, x, y, fill = C.water) { P.line(x, y + 2, x + 5, y - 1, C.stoneDD); P.line(x + 5, y - 1, x + 10, y + 2, C.stoneDD); P.r(x, y + 2, 10, 10, '#9aa8b0'); P.r(x + 1, y + 2, 8, 2, fill); P.vl(x + 2, y + 4, 7, '#c8d4dc'); }
function tank(P, x, y, h = 34) { P.rr(x, y, 20, h, '#c87a3a'); P.vl(x + 4, y + 2, h - 4, '#e8a060'); P.hl(x, y + 8, 20, '#a85a22'); P.hl(x, y + h - 8, 20, '#a85a22'); P.r(x + 8, y + h, 4, 4, '#6a4a34'); P.oval(x + 3, y - 3, 14, 6, '#d88a48'); P.oval(x + 7, y + 12, 6, 6, '#e8e0d0'); P.px(x + 10, y + 14, C.ol); }
function pipes(P, x, y, w) { P.r(x, y, w, 3, '#c87a3a'); P.hl(x, y, w, '#e8a060'); for (let i = 0; i < w; i += 26) P.r(x + i, y - 2, 4, 7, '#a85a22'); }
function taps(P, x, y, n) { counter(P, x, y + 8, n * 12 + 8, '#8a5a32'); for (let i = 0; i < n; i++) { P.vl(x + 8 + i * 12, y, 9, C.gold); P.r(x + 6 + i * 12, y - 2, 5, 3, ['#d8a040', '#8a3a2a', '#e8d080'][i % 3]); } }
function mugs(P, x, y, n = 3) { for (let i = 0; i < n; i++) { P.r(x + i * 7, y, 5, 6, '#f4e8c0'); P.r(x + i * 7, y, 5, 2, '#ffffff'); P.vl(x + i * 7 + 5, y + 2, 2, '#f4e8c0'); } }
function barrelRack(P, x, y, n) { P.r(x, y + 26, n * 16 + 2, 3, C.woodDD); for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { const bx = x + 1 + i * 16, by = y + j * 13; P.oval(bx, by, 15, 13, C.wood); P.oval(bx + 3, by + 3, 9, 7, C.woodD); P.px(bx + 7, by + 6, C.woodDD); } }
function bottleRack(P, x, y, c) { P.r(x, y, 34, 26, C.woodD); for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++) { P.oval(x + 2 + i * 6, y + 3 + j * 8, 5, 5, '#2a1e24'); P.px(x + 4 + i * 6, y + 5 + j * 8, c); } }
function gear(P, x, y, r = 10) { P.oval(x - r, y - r, r * 2, r * 2, '#8a7a6a'); P.oval(x - r + 3, y - r + 3, r * 2 - 6, r * 2 - 6, '#a8988a'); P.oval(x - 2, y - 2, 4, 4, '#5a4a3a'); for (const [dx, dy] of [[0, -r - 2], [0, r], [-r - 2, 0], [r, 0]]) P.r(x + dx, y + dy, 2, 2, '#8a7a6a'); }
function loomFrame(P, x, y) { P.r(x, y, 40, 4, C.woodD); P.r(x, y + 24, 40, 4, C.woodD); P.vl(x + 2, y, 30, C.wood); P.vl(x + 37, y, 30, C.wood); for (let i = 5; i < 36; i += 3) P.vl(x + i, y + 4, 20, i % 6 ? '#e98aa8' : '#f4efe6'); P.r(x + 6, y + 14, 28, 2, C.woodL); }
function spinningWheel(P, x, y) { P.oval(x, y, 22, 22, C.woodD); P.oval(x + 3, y + 3, 16, 16, C.wood); P.oval(x + 5, y + 5, 12, 12, '#d8c49a'); P.line(x + 11, y + 2, x + 11, y + 20, C.woodD); P.line(x + 2, y + 11, x + 20, y + 11, C.woodD); P.line(x + 11, y + 22, x + 6, y + 30, C.woodD); P.line(x + 11, y + 22, x + 16, y + 30, C.woodD); P.r(x + 20, y + 6, 6, 3, '#f4efe6'); }
function press(P, x, y) { P.r(x, y + 16, 30, 16, C.wood); P.r(x + 2, y + 18, 26, 10, '#7a2a3a'); P.vl(x + 14, y - 6, 22, C.stoneDD); P.vl(x + 15, y - 6, 22, C.stoneD); P.r(x + 4, y + 10, 22, 4, C.woodD); P.hl(x + 8, y - 6, 14, C.woodDD); }
function churn(P, x, y) { P.rr(x, y + 6, 12, 18, C.woodL); P.hl(x, y + 10, 12, C.woodD); P.hl(x, y + 19, 12, C.woodD); P.vl(x + 5, y - 4, 12, C.woodDD); P.r(x + 3, y - 4, 6, 2, C.woodD); }
function cans(P, x, y, n = 3) { for (let i = 0; i < n; i++) { P.rr(x + i * 10, y + 4, 9, 14, '#c8d4dc'); P.r(x + 2 + i * 10, y, 5, 5, '#a8b4bc'); P.hl(x + i * 10, y + 9, 9, '#9aa6b0'); } }
function rack(P, c, x, y, k) { P.hl(x, y, 40, C.woodDD); P.vl(x, y, 26, C.woodD); P.vl(x + 39, y, 26, C.woodD); for (let i = 0; i < 3; i++) { P.vl(x + 8 + i * 12, y + 1, 4, '#d8d0c0'); icon(c, k, x + 4 + i * 12, y + 5); } }
function herbs(P, x, y, n = 4) { P.hl(x, y, n * 7, C.woodDD); for (let i = 0; i < n; i++) { P.vl(x + 3 + i * 7, y, 3, '#d8c49a'); P.oval(x + i * 7, y + 3, 7, 9, ['#6a9a4a', '#8ab860', '#a07ab0', '#5a8a3a'][i % 4]); } }
function nest(P, c, x, y, egg = true) { P.oval(x, y + 4, 18, 9, '#9a7428'); P.oval(x + 1, y + 4, 16, 8, '#c8a050'); P.oval(x + 3, y + 3, 12, 6, '#a88038'); if (egg) icon(c, 'egg', x + 4, y - 3); }
function perch(P, x, y, w) { P.hl(x, y, w, C.woodD); P.hl(x, y + 1, w, C.woodDD); P.vl(x + 2, y, 14, C.woodD); P.vl(x + w - 3, y, 14, C.woodD); }
function trough(P, x, y, w = 40) { P.r(x, y, w, 9, C.woodD); P.r(x + 2, y + 1, w - 4, 5, '#e0c060'); P.hl(x, y + 8, w, C.woodDD); }
function waterTrough(P, x, y, w = 30) { P.r(x, y, w, 9, C.stoneD); P.r(x + 2, y + 1, w - 4, 5, C.water); P.hl(x + 3, y + 2, 6, C.waterL); }
function stall(P, x, y) { P.r(x, y, 3, 26, C.wood); P.hl(x - 4, y + 8, 11, C.woodD); P.hl(x - 4, y + 18, 11, C.woodD); }
function pond(P, x, y, w, h) { P.oval(x - 2, y - 2, w + 4, h + 4, C.stoneD); P.oval(x, y, w, h, C.waterD); P.oval(x + 2, y + 2, w - 4, h - 4, C.water); P.hl(x + w / 3, y + h / 3, 6, C.waterL); P.oval(x + w - 16, y + 4, 8, 4, C.leaf); }
function jars(P, c, x, y, ks) { wallShelf(P, c, x, y, ks.length * 11 + 2, ks); }
function teaCounter(P, x, y) { counter(P, x, y, 60, '#d8c088'); for (let i = 0; i < 4; i++) { P.rr(x + 6 + i * 13, y - 5, 8, 6, ['#9ab040', '#c0603a', '#5a3420', '#e8e0d0'][i]); P.px(x + 13 + i * 13, y - 4, '#4a4652'); } }
function paperLantern(P, x, y, c = '#f06050') { P.vl(x + 4, 0, y, C.stoneDD); P.oval(x, y, 9, 11, c); P.hl(x + 1, y + 3, 7, shade(c, -0.2)); P.hl(x + 1, y + 7, 7, shade(c, -0.2)); P.r(x + 2, y + 10, 5, 2, C.woodDD); light(x + 4, y + 5, 22); }
function cushion(P, x, y, c) { P.rr(x, y, 12, 8, c); P.hl(x + 1, y + 1, 10, shade(c, 0.25)); P.px(x + 6, y + 4, shade(c, -0.3)); }
function candyJars(P, x, y) { for (let i = 0; i < 5; i++) { const c = ['#f06090', '#8ad0c8', '#f4c030', '#c98a3a', '#a070e0'][i]; P.rr(x + i * 13, y, 11, 14, '#e8f4f8'); P.r(x + 1 + i * 13, y + 5, 9, 8, c); P.r(x + 2 + i * 13, y - 2, 7, 3, C.woodD); P.px(x + 3 + i * 13, y + 2, '#ffffff'); } }
function lollipops(P, x, y) { P.r(x, y + 8, 12, 6, C.woodL); for (let i = 0; i < 4; i++) { P.vl(x + 2 + i * 3, y + 2, 7, C.white); P.oval(x + i * 3, y - 1, 5, 5, [C.red, C.pink, C.yellow, C.purple][i]); } }
function net(P, x, y) { for (let i = 0; i < 24; i += 4) { P.line(x + i, y, x + i + 6, y + 16, '#c8b898'); P.line(x + i + 6, y, x + i, y + 16, '#c8b898'); } P.hl(x, y, 30, C.woodD); }
function lifeRing(P, x, y) { P.oval(x, y, 14, 14, C.white); for (const [dx, dy] of [[5, 0], [0, 5], [10, 5], [5, 10]]) P.r(x + dx, y + dy, 4, 4, C.red); P.oval(x + 4, y + 4, 6, 6, '#a8744a'); }
function oars(P, x, y) { P.line(x, y, x + 6, y + 26, C.woodL); P.oval(x + 3, y + 22, 6, 9, C.wood); P.line(x + 10, y, x + 16, y + 26, C.woodL); P.oval(x + 13, y + 22, 6, 9, C.wood); }
function wateringCan(P, x, y) { P.r(x + 1, y + 3, 9, 7, '#5f9ad0'); P.hl(x + 1, y + 3, 9, '#8ac0f0'); P.line(x + 10, y + 4, x + 14, y, '#5f9ad0'); P.r(x + 3, y, 5, 3, '#3f6a9a'); }

function vat(P, x, y, c) { P.oval(x, y + 8, 30, 14, C.woodD); P.r(x, y, 30, 15, C.wood); P.hl(x, y + 4, 30, C.stoneDD); P.hl(x, y + 11, 30, C.stoneDD); P.oval(x, y - 3, 30, 8, C.woodD); P.oval(x + 2, y - 2, 26, 6, c); P.hl(x + 8, y - 1, 6, shade(c, 0.3)); }
function cheeseWheels(P, x, y) { for (let i = 0; i < 3; i++) { P.oval(x + i * 4, y - i * 5, 18, 8, '#e8b84a'); P.oval(x + i * 4, y - i * 5, 18, 5, '#f4d070'); P.px(x + 6 + i * 4, y - i * 5 + 2, '#d09830'); } }
function grainHeap(P, x, y, c = '#e0c060') { P.oval(x, y, 30, 14, shade(c, -0.25)); P.oval(x + 2, y - 2, 26, 12, c); P.oval(x + 8, y - 4, 14, 7, shade(c, 0.2)); for (let i = 0; i < 6; i++) P.px(x + 5 + i * 4, y + 3 + (i % 2), shade(c, -0.3)); }
function island(P, c, x, y, w, items) { P.r(x, y, w, 16, C.woodD); P.r(x, y, w, 4, '#d8c8b0'); P.hl(x, y, w, '#f0e4d0'); for (let i = 4; i < w; i += 14) P.r(x + i, y + 6, 10, 8, C.wood); items.forEach((k, i) => icon(c, k, x + 3 + i * 11, y - 7)); }
function bottleCrate(P, x, y, c) { crate(P, x, y, 16); for (let i = 0; i < 4; i++) { P.r(x + 2 + i * 3, y - 5, 2, 6, c); P.px(x + 2 + i * 3, y - 6, C.woodD); } }
function firewood(P, x, y) { for (let j = 0; j < 3; j++) for (let i = 0; i < 4 - j; i++) { P.oval(x + i * 8 + j * 4, y - j * 6, 8, 7, C.woodD); P.oval(x + 2 + i * 8 + j * 4, y + 1 - j * 6, 4, 4, '#d8a870'); } }
function chopBlock(P, x, y) { P.oval(x, y + 6, 16, 8, C.woodDD); P.r(x, y, 16, 9, C.wood); P.oval(x, y - 3, 16, 7, '#d8a870'); P.line(x + 8, y - 2, x + 12, y - 12, C.woodL); P.r(x + 10, y - 14, 5, 4, C.stoneD); }
function crock(P, x, y, c = '#a88a6a') { P.rr(x, y, 12, 13, c); P.hl(x, y + 3, 12, shade(c, -0.25)); P.r(x + 2, y - 2, 8, 3, shade(c, -0.15)); }
function gumball(P, x, y) { P.oval(x, y, 14, 14, '#e8f4f8'); for (const [dx, dy, c] of [[3, 4, C.red], [7, 3, C.yellow], [5, 8, C.blue], [9, 7, C.pink], [4, 10, C.leaf]]) P.r(x + dx, y + dy, 2, 2, c); P.r(x + 3, y + 13, 8, 8, C.red); P.r(x + 6, y + 16, 2, 2, C.gold); }
function mannequin(P, x, y) { P.oval(x + 2, y, 8, 7, '#d8c8b0'); P.r(x, y + 6, 12, 14, '#e98aa8'); P.hl(x, y + 10, 12, '#f4efe6'); P.vl(x + 6, y + 20, 8, C.woodDD); P.hl(x + 2, y + 28, 9, C.woodDD); }
function feedBin(P, c, x, y, k) { P.r(x, y, 20, 14, '#8a9aa8'); P.hl(x, y, 20, '#a8b8c4'); P.r(x - 1, y - 3, 22, 4, '#6a7a88'); icon(c, k, x + 5, y + 2); }
function windowBox(P, x, y, w) { P.r(x, y, w, 4, C.woodD); for (let i = 1; i < w; i += 3) { P.px(x + i, y - 1, C.leaf); P.px(x + i, y - 2, i % 2 ? C.pink : C.yellow); } }
function sign(P, x, y, c = C.woodL) { P.r(x, y, 26, 10, c); P.hl(x, y, 26, shade(c, 0.2)); P.hl(x + 3, y + 4, 20, C.woodDD); P.px(x + 2, y + 2, C.woodDD); P.px(x + 23, y + 2, C.woodDD); }
function longTable(P, x, y, w) { table(P, x, y, w); P.r(x + 2, y - 6, w - 4, 3, C.woodD); P.r(x + 2, y + 16, w - 4, 3, C.woodD); }
// ---------- the rooms ----------
// Each room: floor, wall, windows ([x, curtain colour]); optional station (where
// the artisan works), fire / glow spots, a dynamic shelf for storage, beds,
// animals or fish. draw(P, ctx, o) adds the furniture.
const recipesOut = (type) => (DEFS[type].recipes || []).map((r) => r.out);
const ROOMS = {
  farmhouse: { floor: 'wood', wall: 'cream', windows: [[66, '#d94545'], [150, '#d94545']], fire: [31, 50], draw(P, c) {
    fireplace(P, 14, 24); P.r(14, 18, 38, 3, C.woodD); candle(P, 18, 11); clock(P, 36, 7); candle(P, 44, 11);
    painting(P, 104, 8, 18, 13, 0); sconce(P, 94, 10); sconce(P, 128, 10); bookshelf(P, 182, 6, 24);
    rug(P, 12, 62, 56, 34, '#c0603a'); armchair(P, 14, 58, '#5b8fe0'); armchair(P, 48, 58, '#5fb35a'); table(P, 30, 76, 20); mugs(P, 33, 72, 2);
    basket(P, c, 54, 84, 'wool'); P.r(36, 96, 10, 4, '#e98aa8');
    const n = DEFS.farmhouse.houses;
    for (let i = 0; i < n; i++) { bed(P, 116 + i * 30, 46, ['#5b8fe0', '#d94545', '#5fb35a'][i % 3]); nightstand(P, 135 + i * 30, 52); }
    rugRound(P, 120, 80, 80, 20, '#a66bd1');
    stove(P, 12, 112); cupboard(P, 44, 108, 34); table(P, 86, 112, 26); chair(P, 80, 124); chair(P, 108, 124); cloth(P, 86, 112, 26); flowers(P, 94, 102);
    dresser(P, 186, 110); plantTall(P, 200, 76); plant(P, 156, 120); broom(P, 172, 110); lamp(P, 102, 40);
  } },
  cottage: { floor: 'wood', wall: 'sage', windows: [[92, '#e07ba5']], draw(P, c) {
    painting(P, 40, 8, 16, 12, 1); painting(P, 150, 8, 16, 12, 3, C.woodD); clock(P, 184, 8); sconce(P, 70, 10); sconce(P, 126, 10);
    bed(P, 150, 44, '#e07ba5'); nightstand(P, 170, 50); bed(P, 186, 44, '#43b3a6');
    rug(P, 54, 64, 64, 34, '#5b8fe0'); sofa(P, 62, 56, '#e8b23a'); table(P, 74, 78, 24); mugs(P, 78, 74, 2); armchair(P, 104, 80, '#a66bd1');
    stove(P, 12, 46); cupboard(P, 12, 72, 24); shelf(P, c, 12, 100, 34, ['egg', 'carrot', 'bread']); herbs(P, 12, 36, 3);
    plantTall(P, 196, 92); plant(P, 132, 120); flowers(P, 150, 118); bookshelf(P, 160, 104, 22); basket(P, c, 40, 124, 'apple');
  } },
  barn: { floor: 'straw', wall: 'red', windows: [[100, null]], shelf: { x: 66, y: 46, cols: 6, rows: 3 }, draw(P, c) {
    ladder(P, 30, 2, 50); toolRack(P, 160, 6); lantern(P, 60, 8); lantern(P, 160, 34); P.hl(0, 2, RW, C.woodDD);
    P.r(64, 44, 96, 70, '#8a5a32'); P.r(66, 46, 92, 66, '#6a3f22');
    hay(P, 10, 52); hay(P, 10, 66); hay(P, 34, 58); hayPile(P, 176, 112); hay(P, 186, 98);
    crate(P, 176, 46); crate(P, 192, 50); crate(P, 184, 64); barrel(P, 200, 72);
    produceCrate(P, c, 20, 108, 'carrot'); produceCrate(P, c, 40, 114, 'potato'); sack(P, c, 62, 118, 'wheat'); bucket(P, 150, 124); broom(P, 140, 104);
  } },
  silo: { floor: 'stone', wall: 'stone', windows: [], shelf: { x: 70, y: 52, cols: 6, rows: 3 }, draw(P, c) {
    lantern(P, 40, 8); lantern(P, 180, 8); ladder(P, 104, 0, 40); P.r(66, 50, 92, 66, '#6a6058');
    for (const [x, y, k] of [[12, 44, 'wheat'], [28, 50, 'corn'], [12, 62, 'oats'], [182, 44, 'wheat'], [196, 52, 'corn'], [184, 66, 'rice']]) sack(P, c, x, y, k);
    hayPile(P, 14, 104); hayPile(P, 176, 110); bucket(P, 40, 124); broom(P, 160, 102); crate(P, 30, 88);
  } },
  mill: { floor: 'stone', wall: 'plank', windows: [[160, null]], station: [100, 70], draw(P, c) {
    gear(P, 40, 18, 11); gear(P, 62, 22, 7); lantern(P, 130, 6); lantern(P, 30, 40);
    P.r(98, 8, 4, 58, C.woodD); P.vl(99, 8, 58, C.woodL); P.hl(40, 18, 60, C.woodD); P.hl(40, 19, 60, C.woodDD);
    P.line(88, 40, 94, 54, C.woodD); P.line(112, 40, 106, 54, C.woodD); P.hl(88, 40, 25, C.woodD); P.r(90, 41, 21, 3, '#e0c060');
    P.r(120, 74, 20, 14, C.woodD); P.r(121, 75, 18, 10, '#f4efe6'); P.hl(121, 75, 18, '#ffffff');
    for (const [x, y, k] of [[14, 44, 'wheat'], [30, 50, 'wheat'], [14, 60, 'wheat'], [180, 44, 'flour'], [196, 50, 'flour'], [186, 62, 'flour'], [186, 100, 'cornmeal'], [170, 108, 'sugar']]) sack(P, c, x, y, k);
    hay(P, 12, 104); crate(P, 34, 110); barrel(P, 150, 100); workbench(P, c, 50, 112, 34); broom(P, 140, 96); bucket(P, 200, 124); wallShelf(P, c, 150, 10, 34, ['flour', 'cornmeal', 'sugar']);
    grainHeap(P, 40, 80); sack(P, c, 64, 76, 'corn'); grainHeap(P, 150, 76, '#f4efe6'); table(P, 96, 118, 30); P.r(102, 112, 10, 6, C.stoneD); P.hl(100, 112, 14, C.goldD); basket(P, c, 118, 112, 'wheat');
  } },
  bakery: { floor: 'tile', wall: 'cream', windows: [[150, '#f08bb0']], station: [40, 80], glow: [24, 50, 18, 12], draw(P, c) {
    oven(P, 18, 38); cupboard(P, 54, 4, 60); plates(P, 58, 22, 4); knives(P, 92, 22);
    counter(P, 54, 40, 70, '#d8c8b0'); cuttingBoard(P, c, 60, 38, 'bread'); mixingBowl(P, 86, 36); mixingBowl(P, 102, 37, C.red); P.r(116, 38, 6, 4, C.woodL);
    wallShelf(P, c, 130, 16, 46, ['bread', 'cornbread', 'muffin', 'cake']); sack(P, c, 186, 44, 'flour'); sack(P, c, 200, 48, 'sugar'); basket(P, c, 172, 50, 'egg');
    counter(P, 54, 92, 110); glassCase(P, c, 62, 78, 70, recipesOut('bakery').slice(0, 6)); register(P, 140, 80); chalkboard(P, 190, 4, 24, 18);
    cafeTable(P, c, 26, 112, 'muffin'); cafeTable(P, c, 182, 112, 'applepie'); plantTall(P, 4, 80); plant(P, 206, 86); flowers(P, 150, 120);
    painting(P, 24, 6, 16, 12, 1); sconce(P, 46, 8); sconce(P, 126, 8); pendant(P, 80, 56); pendant(P, 118, 56, '#c0603a');
  } },
  press: { floor: 'wood', wall: 'plank', windows: [[120, null]], station: [90, 66], draw(P, c) {
    press(P, 80, 40); barrel(P, 20, 48); barrel(P, 36, 52); barrel(P, 20, 66); produceCrate(P, c, 176, 46, 'apple'); produceCrate(P, c, 194, 52, 'orange'); produceCrate(P, c, 184, 66, 'tomato');
    wallShelf(P, c, 152, 10, 56, ['applejuice', 'carrotjuice', 'oil', 'sauce', 'orangejuice']); lantern(P, 40, 8); lantern(P, 110, 6); painting(P, 66, 8, 16, 12, 3, C.woodD);
    table(P, 120, 100, 40); for (let i = 0; i < 4; i++) icon(c, ['applejuice', 'wmjuice', 'peachjuice', 'sunjuice'][i], 122 + i * 9, 92);
    sack(P, c, 22, 104, 'apple'); sack(P, c, 38, 110, 'sunflower'); bucket(P, 66, 120); broom(P, 196, 100); stool(P, 166, 120);
    vat(P, 30, 84, '#9a3a5a'); rugRound(P, 100, 116, 46, 18, '#7a2a3a'); bottleCrate(P, 150, 70, '#e8a030'); bottleCrate(P, 168, 88, '#c84a3a'); shelf(P, c, 60, 100, 34, ['apple', 'orange', 'tomato']); sconce(P, 140, 10);
  } },
  kitchen: { floor: 'tile', wall: 'cream', windows: [[60, '#5fb35a']], station: [120, 64], draw(P, c) {
    stove(P, 106, 40); pot(P, 109, 37, '#d94570'); pot(P, 121, 37, '#4d63c9'); utensils(P, 100, 22); herbs(P, 150, 2, 4);
    jars(P, c, 150, 16, ['strawjam', 'bluejam', 'cherryjam', 'peachjam', 'plumjam']); cupboard(P, 14, 30, 34);
    counter(P, 14, 96, 76); jars(P, c, 18, 82, ['rasjam', 'cransauce', 'wmjelly', 'melonjelly']); cuttingBoard(P, c, 60, 94, 'strawberry');
    basket(P, c, 150, 50, 'strawberry'); basket(P, c, 166, 54, 'blueberry'); basket(P, c, 182, 50, 'cherry'); sack(P, c, 196, 100, 'sugar');
    table(P, 120, 104, 40); chair(P, 114, 116); chair(P, 150, 116); cloth(P, 120, 104, 40, '#f4c8d8'); flowers(P, 134, 96);
    plantTall(P, 200, 64); painting(P, 86, 6, 12, 10, 1); clock(P, 196, 8); sconce(P, 50, 10);
    island(P, c, 30, 58, 60, ['strawberry', 'sugar', 'blueberry', 'cherry', 'raspberry']); mixingBowl(P, 66, 52, C.pink); pendant(P, 56, 40); rug(P, 104, 124, 40, 12, '#5fb35a'); stool(P, 34, 78); stool(P, 70, 78);
  } },
  dairy: { floor: 'tile', wall: 'teal', windows: [[100, '#ffffff']], station: [60, 70], draw(P, c) {
    churn(P, 50, 46); churn(P, 70, 50); cans(P, 160, 44, 4); rack(P, c, 150, 92, 'cheese'); rack(P, c, 150, 70, 'smokedcheese');
    wallShelf(P, c, 14, 10, 56, ['butter', 'cheese', 'icecream', 'yogurt', 'milk']); bucket(P, 30, 70, '#fbf8ef'); bucket(P, 12, 74, '#fbf8ef');
    table(P, 90, 100, 36); for (let i = 0; i < 3; i++) icon(c, ['cheese', 'butter', 'yogurt'][i], 93 + i * 11, 92);
    counter(P, 14, 116, 60, '#c8d4dc'); icon(c, 'icecream', 24, 108); icon(c, 'icecream', 40, 108); stool(P, 30, 130); stool(P, 50, 130);
    painting(P, 130, 8, 16, 12, 0); clock(P, 70, 8); plant(P, 200, 118); sconce(P, 160, 10); sconce(P, 40, 30); pendant(P, 104, 70, '#e8e0d0');
    cheeseWheels(P, 120, 70); cheeseWheels(P, 186, 126); bottleCrate(P, 90, 124, '#fbf8ef'); bench(P, 14, 92, 30); cans(P, 110, 44, 2); rug(P, 80, 76, 36, 14, '#43b3a6');
  } },
  brewery: { floor: 'stone', wall: 'brick', windows: [], station: [96, 70], draw(P, c) {
    tank(P, 14, 40); tank(P, 40, 40); tank(P, 66, 46, 28); pipes(P, 10, 34, 80);
    taps(P, 120, 86, 4); mugs(P, 126, 92, 4); stool(P, 126, 112); stool(P, 146, 112); stool(P, 166, 112);
    barrel(P, 190, 44); barrel(P, 204, 50); barrel(P, 196, 62); wallShelf(P, c, 120, 10, 60, ['beer', 'cider', 'mead', 'stout', 'beer']);
    chalkboard(P, 96, 4, 20, 16); lantern(P, 186, 6); lantern(P, 56, 6); sack(P, c, 14, 90, 'hops'); sack(P, c, 30, 96, 'wheat'); sack(P, c, 14, 108, 'oats');
    table(P, 40, 118, 30); chair(P, 34, 130); chair(P, 66, 130); mugs(P, 46, 114, 2); painting(P, 164, 8, 16, 12, 4, C.woodD); plant(P, 200, 118);
    longTable(P, 140, 60, 40); mugs(P, 146, 56, 4); barrel(P, 70, 92); barrel(P, 82, 98); rug(P, 120, 110, 70, 10, '#8a3a2a'); pendant(P, 150, 40, '#c87a3a'); pendant(P, 40, 70, '#c87a3a');
  } },
  winery: { floor: 'cellar', wall: 'stone', windows: [], station: [110, 76], draw(P, c) {
    barrelRack(P, 10, 40, 4); bottleRack(P, 150, 40, '#7a1f3d'); bottleRack(P, 186, 40, '#c8b048');
    table(P, 100, 96, 34); for (let i = 0; i < 3; i++) icon(c, ['wine', 'plumwine', 'raswine'][i], 104 + i * 10, 88); candle(P, 128, 88);
    lantern(P, 40, 6); lantern(P, 130, 6); lantern(P, 196, 6); painting(P, 86, 8, 18, 12, 0, C.goldD);
    crate(P, 30, 104); produceCrate(P, c, 48, 110, 'grapes'); produceCrate(P, c, 68, 116, 'plum'); barrel(P, 180, 100); barrel(P, 196, 106);
    armchair(P, 150, 112, '#7a1f3d'); rugRound(P, 90, 118, 50, 16, '#7a1f3d');
    vat(P, 70, 70, '#5a2a6a'); bottleCrate(P, 30, 76, '#7a1f3d'); bottleCrate(P, 150, 78, '#c8b048'); table(P, 170, 74, 30); candle(P, 176, 67); icon(c, 'wine', 186, 66); chair(P, 200, 86);
  } },
  loom: { floor: 'wood', wall: 'pastel', windows: [[150, '#a66bd1']], station: [70, 70], draw(P, c) {
    loomFrame(P, 50, 40); spinningWheel(P, 14, 46); wallShelf(P, c, 110, 10, 44, ['cloth', 'yarn', 'sachet', 'wool']);
    sack(P, c, 180, 46, 'cotton'); sack(P, c, 196, 52, 'wool'); basket(P, c, 176, 70, 'yarn'); basket(P, c, 196, 74, 'lavender');
    rug(P, 104, 90, 70, 30, '#a66bd1'); armchair(P, 112, 84, '#e98aa8'); table(P, 140, 96, 22); icon(c, 'cloth', 144, 88); lamp(P, 166, 84);
    bookshelf(P, 14, 104, 22); plantTall(P, 196, 100); painting(P, 20, 8, 14, 11, 1); painting(P, 86, 8, 14, 11, 2); sconce(P, 60, 10);
    mannequin(P, 104, 44); P.oval(44, 92, 40, 16, '#f2ede2'); P.oval(50, 90, 28, 10, '#ffffff'); basket(P, c, 90, 112, 'cotton'); chair(P, 40, 118); shelf(P, c, 150, 120, 34, ['yarn', 'cloth', 'yarn']); pendant(P, 140, 60, '#a66bd1');
  } },
  pickler: { floor: 'plank', wall: 'plank', windows: [[100, null]], station: [100, 72], draw(P, c) {
    barrel(P, 16, 46); barrel(P, 32, 50); barrel(P, 16, 64); barrel(P, 184, 46); barrel(P, 200, 52);
    jars(P, c, 132, 10, ['pickles', 'sauerkraut', 'pickledon', 'pickledpep', 'vinegar']); herbs(P, 20, 2, 4);
    counter(P, 70, 96, 64); jars(P, c, 74, 82, ['cucumber', 'cabbage', 'onion', 'bellpepper']); cuttingBoard(P, c, 110, 94, 'cucumber');
    produceCrate(P, c, 160, 104, 'cucumber'); produceCrate(P, c, 180, 110, 'cabbage'); sack(P, c, 20, 104, 'onion'); bucket(P, 40, 120);
    lantern(P, 70, 6); lantern(P, 170, 34); stool(P, 140, 120); plant(P, 200, 118); painting(P, 60, 8, 12, 10, 0, C.woodD);
    for (let i = 0; i < 4; i++) crock(P, 50 + i * 15, 52 + (i % 2) * 4, ['#a88a6a', '#8a9a7a', '#b89a7a', '#7a8a9a'][i]); longTable(P, 140, 60, 40); jars(P, c, 142, 48, ['pickles', 'vinegar', 'sauerkraut']);
    rug(P, 60, 120, 44, 12, '#6a9a3a'); produceCrate(P, c, 40, 82, 'onion'); bucket(P, 200, 80); pendant(P, 100, 70, '#6a9a3a');
  } },
  cookhouse: { floor: 'tile', wall: 'brick', windows: [[150, '#d94545']], station: [60, 66], fire: [47, 50], draw(P, c) {
    fireplace(P, 30, 24); pot(P, 40, 44, '#e0a040'); utensils(P, 76, 18); herbs(P, 76, 2, 4); cupboard(P, 170, 4, 36);
    wallShelf(P, c, 100, 10, 50, ['veggiesoup', 'beanstew', 'oatmeal', 'fishstew']);
    table(P, 110, 76, 40); chair(P, 104, 88); chair(P, 146, 88); cloth(P, 110, 76, 40, '#f4efe6'); candle(P, 128, 69);
    table(P, 160, 108, 34); chair(P, 154, 120); chair(P, 190, 120); icon(c, 'friedrice', 168, 100); icon(c, 'bakedpotato', 182, 100);
    counter(P, 14, 92, 50); cuttingBoard(P, c, 20, 90, 'carrot'); mixingBowl(P, 44, 86); produceCrate(P, c, 14, 116, 'potato'); produceCrate(P, c, 34, 120, 'onion');
    plantTall(P, 200, 60); sconce(P, 96, 30);
    rug(P, 104, 70, 56, 30, '#c0603a'); chalkboard(P, 120, 2, 24, 14); pendant(P, 126, 54, '#d94545'); pendant(P, 174, 86, '#d94545'); cafeTable(P, c, 84, 122, 'veggiesoup'); flowers(P, 128, 76); bench(P, 66, 106, 28); basket(P, c, 196, 90, 'potato');
  } },
  sweets: { floor: 'pastel', wall: 'pastel', windows: [[30, '#f4c030']], station: [150, 70], draw(P, c) {
    bunting(P, 4, 2, RW - 8); fairyLights(P, 4, 26, RW - 8); counter(P, 70, 92, 100, '#f4c8d8'); candyJars(P, 80, 78); register(P, 150, 80); lollipops(P, 52, 88);
    wallShelf(P, c, 110, 12, 64, ['candy', 'toffee', 'honeydrops', 'soda', 'maplecandy', 'mintcandy']); chalkboard(P, 186, 6, 24, 18);
    cafeTable(P, c, 26, 112, 'soda'); cafeTable(P, c, 186, 112, 'candy'); plantTall(P, 196, 60); flowers(P, 14, 46); flowers(P, 60, 46);
    shelf(P, c, 14, 60, 40, ['candy', 'toffee', 'honeydrops']); painting(P, 60, 8, 16, 12, 4); sconce(P, 98, 10); sconce(P, 180, 30);
    gumball(P, 30, 84); gumball(P, 176, 84); rugRound(P, 80, 112, 64, 20, '#f06090'); barrel(P, 14, 100); P.oval(15, 98, 10, 4, '#f4c030'); P.oval(170, 116, 10, 4, '#a070e0'); basket(P, c, 160, 118, 'candy'); pendant(P, 110, 60, '#f06090');
  } },
  smokehouse: { floor: 'plank', wall: 'dark', windows: [], station: [100, 76], glow: [100, 104, 22, 6], draw(P, c) {
    rack(P, c, 20, 40, 'fish'); rack(P, c, 70, 40, 'fish'); rack(P, c, 150, 40, 'smokedfish'); P.r(96, 100, 30, 12, '#3a2a28'); P.r(100, 104, 22, 6, '#e8702a'); light(111, 106, 36, 'fire');
    barrel(P, 190, 96); barrel(P, 200, 110); P.r(14, 100, 30, 26, C.woodDD); for (let i = 0; i < 4; i++) P.hl(16, 104 + i * 6, 26, C.wood);
    lantern(P, 60, 6); lantern(P, 140, 6); bucket(P, 160, 120); net(P, 176, 6); toolRack(P, 10, 6); wallShelf(P, c, 100, 14, 34, ['smokedfish', 'smokedcheese', 'fish']);
    firewood(P, 54, 120); chopBlock(P, 150, 96); rack(P, c, 20, 70, 'smokedfish'); table(P, 120, 124, 36); icon(c, 'smokedfish', 124, 116); icon(c, 'smokedcheese', 138, 116); crock(P, 180, 70); sack(P, c, 196, 70, 'fish'); lantern(P, 196, 34); basket(P, c, 74, 70, 'fish');
  } },
  teahouse: { floor: 'tatami', wall: 'cream', windows: [[40, '#9ab040'], [170, '#9ab040']], station: [110, 66], draw(P, c) {
    teaCounter(P, 80, 80); wallShelf(P, c, 90, 10, 50, ['tea', 'chai', 'coffee', 'latte']); paperLantern(P, 70, 6); paperLantern(P, 150, 8, '#f4c542'); paperLantern(P, 30, 40, '#e07ba5'); paperLantern(P, 186, 70, '#5fb35a');
    plantTall(P, 4, 96); plantTall(P, 200, 96); rug(P, 16, 50, 44, 30, '#9ab040'); P.r(26, 58, 24, 10, C.woodD); P.hl(26, 58, 24, C.woodL); mugs(P, 30, 54, 3);
    cushion(P, 18, 72, '#e07ba5'); cushion(P, 44, 72, '#5b8fe0'); sack(P, c, 186, 50, 'tealeaf'); sack(P, c, 172, 56, 'coffeebean');
    table(P, 130, 112, 40); cushion(P, 128, 126, '#e8b23a'); cushion(P, 156, 126, '#43b3a6'); icon(c, 'tea', 140, 104); icon(c, 'latte', 154, 104);
    painting(P, 112, 8, 12, 14, 0, C.woodD); flowers(P, 60, 120);
    P.r(20, 96, 40, 4, C.woodD); P.hl(20, 96, 40, C.woodL); mugs(P, 26, 92, 2); cushion(P, 18, 104, '#a66bd1'); cushion(P, 46, 104, '#f4c542'); plant(P, 170, 52); bookshelf(P, 186, 6, 20); flowers(P, 100, 120);
  } },
  coop: { floor: 'straw', wall: 'plank', windows: [[110, null]], animals: 'chicken', draw(P, c) {
    for (let i = 0; i < 4; i++) nest(P, c, 14 + i * 22, 38); perch(P, 136, 38, 70); perch(P, 146, 48, 50); lantern(P, 120, 6);
    trough(P, 150, 124, 50); waterTrough(P, 20, 126, 30); hayPile(P, 176, 96); lantern(P, 40, 30); lantern(P, 196, 30); basket(P, c, 196, 64, 'egg'); sack(P, c, 6, 98, 'wheat'); ladder(P, 96, 0, 34);
    windowBox(P, 106, 23, 26); sign(P, 150, 8); feedBin(P, c, 6, 64, 'wheat'); hay(P, 196, 80, 18); basket(P, c, 6, 118, 'egg'); flowers(P, 80, 122); broom(P, 204, 104); P.line(116, 56, 136, 40, C.woodL); for (let i = 0; i < 4; i++) P.hl(118 + i * 5, 54 - i * 4, 4, C.woodD);
  } },
  cowshed: { floor: 'straw', wall: 'red', windows: [[100, null]], animals: 'cow', draw(P, c) {
    for (let i = 0; i < 5; i++) stall(P, 24 + i * 44, 36); trough(P, 14, 36, 190); lantern(P, 60, 8); lantern(P, 160, 8); lantern(P, 110, 8); toolRack(P, 120, 4);
    hay(P, 186, 118); hayPile(P, 8, 116); bucket(P, 200, 100, '#fbf8ef'); bucket(P, 40, 128, '#fbf8ef'); cans(P, 70, 124, 2);
    feedBin(P, c, 6, 70, 'corn'); hay(P, 6, 88, 18); sign(P, 20, 10, '#c49a62'); windowBox(P, 96, 23, 26); stool(P, 150, 126); broom(P, 204, 70); P.r(170, 10, 14, 10, C.woodD); P.oval(172, 12, 10, 6, C.stoneD);
  } },
  sheeppen: { floor: 'straw', wall: 'plank', windows: [[60, null], [150, null]], animals: 'sheep', draw(P, c) {
    trough(P, 14, 38, 70); waterTrough(P, 100, 40, 30); hayPile(P, 170, 40); lantern(P, 104, 6); lantern(P, 30, 30); lantern(P, 190, 30); toolRack(P, 10, 4);
    sack(P, c, 196, 116, 'wool'); basket(P, c, 176, 122, 'wool'); hay(P, 10, 118); bucket(P, 40, 128); P.vl(196, 60, 30, C.woodD); P.r(192, 70, 10, 3, '#e8e0d0');
    feedBin(P, c, 6, 64, 'carrot'); hay(P, 6, 82, 18); windowBox(P, 56, 23, 26); windowBox(P, 146, 23, 26); stool(P, 160, 124); P.r(140, 122, 8, 3, C.stoneD); sign(P, 120, 10); flowers(P, 80, 124); hay(P, 196, 92, 18);
  } },
  duckhouse: { floor: 'straw', wall: 'teal', windows: [[150, null]], animals: 'duck', draw(P, c) {
    pond(P, 60, 72, 96, 40); nest(P, c, 14, 40, false); nest(P, c, 40, 40, false); nest(P, c, 180, 40, false); icon(c, 'duckegg', 186, 37);
    trough(P, 14, 124, 40); lantern(P, 110, 6); lantern(P, 60, 30); lantern(P, 170, 30); sack(P, c, 196, 116, 'oats'); P.oval(100, 66, 10, 4, C.leaf); flowers(P, 160, 120);
    feedBin(P, c, 196, 60, 'oats'); windowBox(P, 146, 23, 26); sign(P, 70, 10); for (const [x, y] of [[66, 70], [150, 98], [62, 104]]) { P.vl(x, y - 8, 9, '#6a9a4a'); P.oval(x - 1, y - 11, 3, 5, '#8a5a32'); } hay(P, 6, 80, 18); basket(P, c, 176, 124, 'duckegg'); bucket(P, 200, 84);
  } },
  dock: { floor: 'plank', wall: 'plank', windows: [[40, null], [160, null]], fish: true, draw(P, c) {
    P.r(3, 66, RW - 6, RH - 72, C.waterD); P.r(3, 68, RW - 6, RH - 76, C.water);
    for (let x = 6; x < RW - 6; x += 14) P.hl(x, 80 + (x % 28 ? 6 : 0), 6, C.waterL);
    P.r(RW / 2 - 14, 66, 28, RH - 70, C.woodL); for (let y = 66; y < RH - 4; y += 6) P.hl(RW / 2 - 14, y, 28, C.woodD);
    barrel(P, 16, 42); crate(P, 30, 48); bucket(P, 50, 52); P.line(130, 40, 150, 70, C.woodDD); P.px(150, 71, '#ffffff');
    net(P, 70, 4); lifeRing(P, 120, 6); oars(P, 186, 34); lantern(P, 106, 34); wallShelf(P, c, 136, 16, 40, ['fish', 'perch', 'trout']);
    crate(P, 170, 48); basket(P, c, 156, 52, 'fish'); stool(P, 136, 54);
  } },
  greenhouse: { floor: 'dirt', wall: 'glass', windows: [], beds: true, draw(P) {
    fairyLights(P, 4, 4, RW - 8); for (const x of [20, 90, 170]) hangingPlant(P, x, 12);
    plant(P, 3, 40); plantTall(P, 2, 108); plant(P, 208, 40); plantTall(P, 206, 108); wateringCan(P, 6, 80); wateringCan(P, 208, 80);
    lantern(P, 8, 60); lantern(P, 208, 60); lantern(P, 8, 96); lantern(P, 208, 96);
  } },
};
export const hasInterior = (type) => !!ROOMS[type];
export const roomSpec = (type) => ROOMS[type];

/** The painted room for a building (cached per type and level). Carries .lights and .wins for day/night lighting. */
export function roomCanvas(o) {
  const spec = ROOMS[o.type];
  return cached(`room:${o.type}:${o.lvl || 1}`, () => {
    LIGHTS = []; WINS = [];
    const cv = canvas(RW, RH), P = pen(cv), ctx = cv.getContext('2d');
    paintFloor(P, spec.floor, o.type.length * 31);
    paintWalls(P, spec.wall, spec.windows);
    spec.draw(P, ctx, o);
    const out = gradeCanvas(cv);
    out.lights = LIGHTS; out.wins = WINS;
    return out;
  });
}
