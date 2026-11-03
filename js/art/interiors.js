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
  P.hl(x + 1, y + 28, 16, 'rgba(40,24,30,0.3)');
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
function table(P, x, y, w = 24) { P.hl(x + 1, y + 15, w - 2, 'rgba(40,24,30,0.22)'); P.r(x, y, w, 10, C.wood); P.hl(x, y, w, C.woodL); P.hl(x, y + 9, w, C.woodDD); P.r(x + 1, y + 10, 2, 5, C.woodDD); P.r(x + w - 3, y + 10, 2, 5, C.woodDD); }
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
function barrel(P, x, y) { P.hl(x + 1, y + 15, 10, 'rgba(40,24,30,0.28)'); P.rr(x, y, 12, 15, C.wood); P.hl(x, y + 3, 12, C.stoneDD); P.hl(x, y + 11, 12, C.stoneDD); P.vl(x + 2, y + 1, 13, C.woodL); P.oval(x + 1, y - 1, 10, 4, C.woodD); }
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
function press(P, x, y) {
  // a slatted tub full of fruit, a press plate and a big screw with a cross handle, juice running into a bucket
  P.hl(x - 2, y + 34, 34, 'rgba(40,24,30,0.28)');
  P.r(x - 2, y + 28, 34, 6, C.woodD); P.hl(x - 2, y + 28, 34, C.woodL);
  P.r(x + 2, y + 12, 26, 17, C.wood); for (let i = 4; i < 28; i += 4) P.vl(x + i, y + 12, 17, C.woodD); P.hl(x + 2, y + 16, 26, C.stoneDD); P.hl(x + 2, y + 25, 26, C.stoneDD);
  P.oval(x + 3, y + 9, 24, 7, '#c84a3a'); P.px(x + 8, y + 10, '#f06050'); P.px(x + 16, y + 11, '#e8a030'); P.px(x + 21, y + 10, '#7a2a3a');
  P.r(x + 1, y + 6, 28, 4, C.woodL); P.hl(x + 1, y + 6, 28, '#e8b878');
  P.r(x - 2, y - 14, 4, 42, C.woodD); P.r(x + 28, y - 14, 4, 42, C.woodD); P.r(x - 2, y - 16, 34, 4, C.woodD); P.hl(x - 2, y - 16, 34, C.woodL);
  P.r(x + 13, y - 12, 4, 18, C.stoneDD); for (let j = -11; j < 6; j += 3) P.hl(x + 13, y + j, 4, C.stoneD);
  P.hl(x + 5, y - 18, 20, C.woodL); P.vl(x + 15, y - 20, 5, C.woodL);
  P.r(x + 32, y + 22, 6, 3, C.woodD); P.vl(x + 37, y + 25, 4, '#c84a3a'); bucket(P, x + 32, y + 28, '#c84a3a');
}
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
// ---------- tidy groups (things that belong together) ----------
const shadow = (P, x, y, w) => { P.hl(x + 1, y, w - 2, 'rgba(40,24,30,0.28)'); P.hl(x + 2, y + 1, w - 4, 'rgba(40,24,30,0.14)'); };
function wallCabinet(P, x, y, w) { P.r(x, y, w, 15, C.woodD); P.r(x + 1, y + 1, w - 2, 13, C.woodL); for (let i = 0; i < w - 2; i += 11) { P.r(x + 2 + i, y + 2, 9, 11, C.wood); P.px(x + 9 + i, y + 9, C.gold); } P.hl(x, y + 15, w, 'rgba(40,24,30,0.3)'); }
function sink(P, x, y) { P.r(x, y + 1, 16, 5, '#c8d4dc'); P.r(x + 2, y + 2, 12, 3, '#8aa8b8'); P.vl(x + 8, y - 6, 7, C.stoneD); P.hl(x + 6, y - 6, 5, C.stoneD); }
function kitchenRun(P, c, x, y, w, items = []) {
  // a counter along the back wall with a sink and a few things on top
  counter(P, x, y, w, '#d8c8b0'); shadow(P, x, y + 14, w); sink(P, x + w - 22, y);
  items.forEach((k, i) => icon(c, k, x + 3 + i * 11, y - 8));
}
function coatRack(P, x, y) { P.vl(x + 4, y, 22, C.woodD); P.hl(x + 1, y + 2, 7, C.woodD); P.r(x, y + 3, 4, 8, '#5b8fe0'); P.r(x + 5, y + 3, 4, 6, '#d94545'); P.hl(x + 1, y + 22, 7, C.woodDD); shadow(P, x, y + 23, 9); }
function trunk(P, x, y) { P.rr(x, y, 22, 13, C.wood); P.r(x, y, 22, 4, C.woodL); P.hl(x, y + 4, 22, C.woodDD); P.r(x + 9, y + 3, 4, 4, C.gold); P.vl(x + 4, y, 13, C.stoneDD); P.vl(x + 17, y, 13, C.stoneDD); shadow(P, x, y + 13, 22); }
function sackStack(P, c, x, y, k, n = 3) { for (let i = 0; i < n; i++) sack(P, c, x + (i % 2) * 12, y - Math.floor(i / 2) * 9 + (i % 2) * 3, k); shadow(P, x, y + 16, 26); }
function crateStack(P, x, y) { crate(P, x, y + 10); crate(P, x + 14, y + 10); crate(P, x + 7, y - 3); shadow(P, x, y + 24, 28); }
function barrelRow(P, x, y, n) { for (let i = 0; i < n; i++) barrel(P, x + i * 13, y); shadow(P, x, y + 15, n * 13); }
function hayStack(P, x, y) { hay(P, x, y + 12, 26); hay(P, x + 4, y, 22); shadow(P, x, y + 27, 28); }
function platform(P, x, y, w, h) { P.r(x, y, w, h, C.woodD); P.r(x + 1, y + 1, w - 2, h - 3, C.wood); for (let i = 4; i < w; i += 8) P.vl(x + i, y + 1, h - 3, C.woodD); shadow(P, x, y + h, w); }
function millstoneSet(P, x, y) {
  // a pair of grooved stones on a wooden stand, fed by a hopper
  platform(P, x - 24, y + 4, 48, 18);
  P.oval(x - 19, y + 2, 38, 14, C.stoneDD); P.oval(x - 18, y, 36, 13, C.stone); P.oval(x - 16, y - 1, 32, 10, C.stoneL);
  for (let a = 0; a < 6; a++) P.line(x, y + 4, x + Math.round(Math.cos(a) * 14), y + 4 + Math.round(Math.sin(a) * 4), C.stoneD);
  P.oval(x - 3, y + 2, 6, 4, C.stoneDD);
  P.line(x - 10, y - 18, x - 4, y - 4, C.woodD); P.line(x + 10, y - 18, x + 4, y - 4, C.woodD); P.hl(x - 11, y - 19, 23, C.woodD); P.r(x - 9, y - 18, 19, 3, '#e0c060');
  P.r(x + 18, y + 8, 10, 4, C.woodL); P.r(x + 26, y + 10, 4, 8, C.woodD);
}
function flourBin(P, c, x, y) { P.r(x, y, 16, 14, C.woodD); P.r(x + 1, y + 1, 14, 4, '#f4efe6'); P.hl(x, y + 5, 16, C.woodDD); icon(c, 'flour', x + 3, y + 5); shadow(P, x, y + 14, 16); }
function diningSet(P, c, x, y, w = 28, k = 'bread', cl = '#f4efe6') {
  chair(P, x + 3, y - 9); chair(P, x + w - 11, y - 9);
  table(P, x, y, w); cloth(P, x, y, w, cl); shadow(P, x, y + 15, w);
  chair(P, x + 3, y + 13); chair(P, x + w - 11, y + 13); icon(c, k, x + w / 2 - 5, y - 6);
}
function fireLounge(P, x, y) { rug(P, x, y, 56, 30, '#c0603a'); armchair(P, x + 2, y + 2, '#5b8fe0'); armchair(P, x + 38, y + 2, '#5fb35a'); P.r(x + 21, y + 12, 14, 7, C.woodD); P.hl(x + 21, y + 12, 14, C.woodL); mugs(P, x + 23, y + 8, 2); }
function doorPlants(P) { plant(P, RW / 2 - 30, 120); plant(P, RW / 2 + 18, 120); }

// ---------- the rooms ----------
// Layout in every room: the back wall holds windows, pictures, cabinets and
// shelves; tall furniture lines the walls; one purpose per area, anchored by
// a rug; a clear path from the door. station: where the artisan works.
const recipesOut = (type) => (DEFS[type].recipes || []).map((r) => r.out);
const ROOMS = {
  farmhouse: { floor: 'wood', wall: 'cream', windows: [[66, '#d94545'], [158, '#d94545']], fire: [112, 50], draw(P, c) {
    // kitchen along the back-left wall: cabinets up on the wall, counter, sink and stove below
    wallCabinet(P, 4, 4, 46); plates(P, 8, 22, 3); stove(P, 4, 34); kitchenRun(P, c, 32, 36, 34, ['bread', 'apple']); utensils(P, 4, 22);
    // the hearth in the middle of the back wall, with a picture and clock above
    fireplace(P, 95, 24); P.r(93, 20, 38, 3, C.woodD); candle(P, 96, 13); candle(P, 126, 13); painting(P, 104, 4, 16, 11, 0); clock(P, 82, 8);
    // the beds along the back-right wall, with a lamp between and a rug at their feet
    for (let i = 0; i < 3; i++) bed(P, 148 + i * 22, 36, ['#5b8fe0', '#d94545', '#5fb35a'][i]);
    nightstand(P, 136, 44); bookshelf(P, 196, 4, 24);
    rug(P, 146, 70, 66, 16, '#a66bd1');
    // dining on the left, the lounge facing the fire
    rug(P, 6, 64, 62, 44, '#d8a050'); diningSet(P, c, 18, 82, 36, 'bread');
    fireLounge(P, 84, 62);
    // by the door: coat rack, plants, a trunk and a dresser
    coatRack(P, 72, 110); doorPlants(P); trunk(P, 10, 120); dresser(P, 190, 112); plantTall(P, 170, 102); sconce(P, 140, 10); lamp(P, 178, 92);
  } },
  cottage: { floor: 'wood', wall: 'sage', windows: [[60, '#e07ba5'], [140, '#e07ba5']], draw(P, c) {
    wallCabinet(P, 4, 4, 34); stove(P, 4, 34); kitchenRun(P, c, 32, 36, 26, ['egg']); herbs(P, 82, 2, 3); painting(P, 100, 6, 14, 11, 1); clock(P, 120, 8);
    bed(P, 170, 36, '#e07ba5'); bed(P, 194, 36, '#43b3a6'); nightstand(P, 160, 44); painting(P, 176, 6, 14, 10, 3, C.woodD);
    rug(P, 60, 64, 76, 36, '#5b8fe0'); sofa(P, 80, 64, '#e8b23a'); P.r(84, 84, 26, 8, C.woodD); P.hl(84, 84, 26, C.woodL); mugs(P, 88, 80, 2); armchair(P, 116, 80, '#a66bd1');
    diningSet(P, c, 10, 84, 30, 'carrot', '#f4c8d8');
    bookshelf(P, 194, 104, 22); coatRack(P, 76, 110); doorPlants(P); basket(P, c, 172, 124, 'apple'); sconce(P, 44, 10); sconce(P, 156, 10);
  } },
  barn: { floor: 'straw', wall: 'red', windows: [[104, null]], shelf: { x: 66, y: 46, cols: 6, rows: 3 }, draw(P, c) {
    toolRack(P, 10, 4); lantern(P, 60, 8); lantern(P, 160, 8); ladder(P, 190, 0, 50); P.hl(0, 2, RW, C.woodDD);
    P.r(64, 44, 96, 70, '#8a5a32'); P.r(66, 46, 92, 66, '#6a3f22'); shadow(P, 64, 114, 96);
    hayStack(P, 8, 40); hayStack(P, 8, 72); crateStack(P, 172, 52); crateStack(P, 172, 82);
    for (let i = 0; i < 3; i++) produceCrate(P, c, 8 + i * 18, 120, ['carrot', 'potato', 'corn'][i]);
    barrelRow(P, 168, 120, 3); doorPlants(P);
  } },
  silo: { floor: 'stone', wall: 'stone', windows: [], shelf: { x: 70, y: 52, cols: 6, rows: 3 }, draw(P, c) {
    lantern(P, 40, 8); lantern(P, 180, 8); ladder(P, 108, 0, 46); P.r(66, 50, 92, 66, '#6a6058'); shadow(P, 66, 116, 92);
    sackStack(P, c, 8, 50, 'wheat'); sackStack(P, c, 8, 82, 'corn'); sackStack(P, c, 186, 50, 'oats'); sackStack(P, c, 186, 82, 'rice');
    grainHeap(P, 10, 118); grainHeap(P, 184, 118, '#f4d070'); doorPlants(P);
  } },
  mill: { floor: 'stone', wall: 'plank', windows: [[176, null]], station: [100, 66], draw(P, c) {
    // the gear train on the wall drives the shaft down to the millstones
    gear(P, 40, 16, 11); gear(P, 62, 22, 7); P.hl(40, 16, 72, C.woodD); P.hl(40, 17, 72, C.woodDD); P.r(110, 8, 4, 40, C.woodD); P.vl(111, 8, 40, C.woodL);
    lantern(P, 140, 8); lantern(P, 24, 40); wallShelf(P, c, 136, 16, 34, ['flour', 'cornmeal', 'sugar']);
    millstoneSet(P, 112, 64); flourBin(P, c, 140, 72);
    sackStack(P, c, 8, 46, 'wheat'); sackStack(P, c, 8, 78, 'wheat'); grainHeap(P, 34, 70);
    sackStack(P, c, 186, 46, 'flour'); sackStack(P, c, 186, 78, 'flour');
    workbench(P, c, 8, 116, 40); barrelRow(P, 170, 120, 3); doorPlants(P);
  } },
  bakery: { floor: 'tile', wall: 'cream', windows: [[164, '#f08bb0']], station: [40, 80], glow: [24, 50, 18, 12], draw(P, c) {
    oven(P, 18, 38); wallCabinet(P, 54, 4, 56); knives(P, 116, 22); wallShelf(P, c, 120, 8, 34, ['bread', 'cornbread', 'muffin']);
    kitchenRun(P, c, 54, 40, 76); cuttingBoard(P, c, 60, 38, 'bread'); mixingBowl(P, 84, 34); mixingBowl(P, 98, 35, C.red);
    sackStack(P, c, 188, 44, 'flour', 2); basket(P, c, 172, 48, 'egg'); chalkboard(P, 192, 4, 22, 16);
    counter(P, 54, 92, 112); shadow(P, 54, 106, 112); glassCase(P, c, 62, 78, 72, recipesOut('bakery').slice(0, 6)); register(P, 142, 80); flowers(P, 160, 82);
    cafeTable(P, c, 26, 112, 'muffin'); cafeTable(P, c, 184, 112, 'applepie'); plantTall(P, 4, 74); plantTall(P, 204, 74);
    painting(P, 26, 6, 16, 12, 1); sconce(P, 46, 8); pendant(P, 84, 58); pendant(P, 128, 58, '#c0603a');
  } },
  press: { floor: 'wood', wall: 'plank', windows: [[104, null]], station: [100, 64], draw(P, c) {
    press(P, 96, 50); wallShelf(P, c, 140, 10, 56, ['applejuice', 'carrotjuice', 'oil', 'sauce', 'orangejuice']); lantern(P, 40, 8); lantern(P, 176, 34); painting(P, 60, 8, 16, 12, 3, C.woodD);
    barrelRow(P, 8, 42, 3); barrelRow(P, 8, 60, 3); vat(P, 60, 88, '#9a3a5a');
    for (let i = 0; i < 3; i++) produceCrate(P, c, 160 + i * 18, 48, ['apple', 'orange', 'tomato'][i]);
    table(P, 150, 88, 54); shadow(P, 150, 103, 54); for (let i = 0; i < 5; i++) icon(c, ['applejuice', 'wmjuice', 'peachjuice', 'sunjuice', 'orangejuice'][i], 152 + i * 10, 80);
    sackStack(P, c, 8, 112, 'apple'); bottleCrate(P, 186, 120, '#e8a030'); doorPlants(P);
  } },
  kitchen: { floor: 'tile', wall: 'cream', windows: [[34, '#5fb35a']], station: [120, 64], draw(P, c) {
    wallCabinet(P, 60, 4, 40); utensils(P, 104, 6); herbs(P, 150, 2, 4); jars(P, c, 150, 18, ['strawjam', 'bluejam', 'cherryjam', 'peachjam', 'plumjam']);
    kitchenRun(P, c, 60, 36, 44, ['sugar', 'strawberry']); stove(P, 106, 34); pot(P, 109, 31, '#d94570'); pot(P, 121, 31, '#4d63c9');
    island(P, c, 70, 76, 64, ['strawberry', 'blueberry', 'cherry', 'raspberry', 'sugar']); pendant(P, 98, 56); stool(P, 76, 98); stool(P, 118, 98);
    for (let i = 0; i < 3; i++) basket(P, c, 152 + i * 18, 52, ['strawberry', 'blueberry', 'cherry'][i]);
    diningSet(P, c, 166, 100, 40, 'bluejam', '#f4c8d8'); jars(P, c, 8, 46, ['rasjam', 'cransauce', 'wmjelly']); sackStack(P, c, 8, 76, 'sugar');
    plantTall(P, 4, 104); clock(P, 196, 8); doorPlants(P);
  } },
  dairy: { floor: 'tile', wall: 'teal', windows: [[100, '#ffffff']], station: [60, 70], draw(P, c) {
    wallShelf(P, c, 8, 10, 56, ['butter', 'cheese', 'icecream', 'yogurt', 'milk']); painting(P, 136, 8, 16, 12, 0); clock(P, 76, 8); sconce(P, 160, 10);
    churn(P, 42, 44); churn(P, 60, 46); cans(P, 150, 42, 4); shadow(P, 150, 60, 40);
    rack(P, c, 176, 70, 'cheese'); rack(P, c, 176, 96, 'smokedcheese'); cheeseWheels(P, 150, 124);
    counter(P, 8, 100, 60, '#c8d4dc'); shadow(P, 8, 114, 60); icon(c, 'icecream', 16, 92); icon(c, 'icecream', 30, 92); icon(c, 'yogurt', 44, 92); stool(P, 16, 118); stool(P, 40, 118);
    table(P, 86, 82, 40); shadow(P, 86, 97, 40); for (let i = 0; i < 3; i++) icon(c, ['cheese', 'butter', 'milk'][i], 90 + i * 12, 74); pendant(P, 102, 60, '#e8e0d0');
    bucket(P, 8, 60, '#fbf8ef'); bucket(P, 20, 64, '#fbf8ef'); doorPlants(P);
  } },
  brewery: { floor: 'stone', wall: 'brick', windows: [], station: [96, 70], draw(P, c) {
    pipes(P, 8, 30, 86); tank(P, 10, 38); tank(P, 36, 38); tank(P, 62, 38); chalkboard(P, 104, 4, 20, 16); lantern(P, 56, 6); lantern(P, 186, 6);
    wallShelf(P, c, 132, 8, 56, ['beer', 'cider', 'mead', 'stout', 'beer']);
    taps(P, 130, 40, 4); mugs(P, 136, 46, 4); stool(P, 138, 66); stool(P, 158, 66); stool(P, 178, 66);
    rugRound(P, 120, 86, 70, 22, '#8a3a2a'); barrelRow(P, 182, 110, 2);
    diningSet(P, c, 30, 96, 44, 'beer', '#e8d8b0'); sackStack(P, c, 8, 112, 'hops'); pendant(P, 52, 76, '#c87a3a'); pendant(P, 160, 26, '#c87a3a'); doorPlants(P);
  } },
  winery: { floor: 'cellar', wall: 'stone', windows: [], station: [110, 70], draw(P, c) {
    barrelRack(P, 8, 38, 4); bottleRack(P, 150, 38, '#7a1f3d'); bottleRack(P, 186, 38, '#c8b048'); painting(P, 96, 6, 18, 12, 0, C.goldD);
    lantern(P, 40, 6); lantern(P, 130, 6); lantern(P, 196, 6);
    vat(P, 20, 84, '#5a2a6a'); for (let i = 0; i < 2; i++) produceCrate(P, c, 56 + i * 18, 88, ['grapes', 'plum'][i]);
    rugRound(P, 134, 84, 72, 26, '#7a1f3d'); armchair(P, 140, 84, '#7a1f3d'); table(P, 160, 92, 26); candle(P, 166, 85); icon(c, 'wine', 174, 84); armchair(P, 188, 86, '#7a1f3d');
    barrelRow(P, 8, 120, 3); barrelRow(P, 176, 120, 3); doorPlants(P);
  } },
  loom: { floor: 'wood', wall: 'pastel', windows: [[150, '#a66bd1']], station: [70, 70], draw(P, c) {
    painting(P, 20, 8, 14, 11, 1); painting(P, 96, 8, 14, 11, 2); sconce(P, 60, 10); wallShelf(P, c, 112, 10, 34, ['cloth', 'yarn', 'sachet']);
    loomFrame(P, 50, 38); spinningWheel(P, 12, 44); mannequin(P, 108, 40);
    sackStack(P, c, 186, 44, 'wool', 2); basket(P, c, 170, 52, 'cotton');
    rug(P, 104, 84, 76, 30, '#a66bd1'); armchair(P, 112, 84, '#e98aa8'); table(P, 140, 92, 22); icon(c, 'cloth', 144, 84); lamp(P, 166, 82);
    bookshelf(P, 8, 100, 22); for (let i = 0; i < 2; i++) basket(P, c, 186 + i * 16, 118, ['yarn', 'lavender'][i]); doorPlants(P);
  } },
  pickler: { floor: 'plank', wall: 'plank', windows: [[60, null]], station: [100, 66], draw(P, c) {
    herbs(P, 10, 2, 4); jars(P, c, 132, 10, ['pickles', 'sauerkraut', 'pickledon', 'pickledpep', 'vinegar']); lantern(P, 104, 6); painting(P, 90, 8, 12, 10, 0, C.woodD);
    barrelRow(P, 8, 42, 3); for (let i = 0; i < 4; i++) crock(P, 140 + i * 16, 44, ['#a88a6a', '#8a9a7a', '#b89a7a', '#7a8a9a'][i]);
    counter(P, 70, 80, 70); shadow(P, 70, 94, 70); jars(P, c, 74, 66, ['cucumber', 'cabbage', 'onion', 'bellpepper']); cuttingBoard(P, c, 116, 78, 'cucumber'); pendant(P, 100, 54, '#6a9a3a');
    rug(P, 64, 104, 84, 12, '#6a9a3a');
    for (let i = 0; i < 3; i++) produceCrate(P, c, 8 + i * 18, 118, ['cucumber', 'cabbage', 'onion'][i]); barrelRow(P, 176, 118, 3); doorPlants(P);
  } },
  cookhouse: { floor: 'tile', wall: 'brick', windows: [[174, '#d94545']], station: [60, 66], fire: [47, 50], draw(P, c) {
    fireplace(P, 30, 24); pot(P, 40, 44, '#e0a040'); utensils(P, 76, 18); herbs(P, 76, 2, 4); chalkboard(P, 120, 4, 24, 14);
    kitchenRun(P, c, 76, 36, 44, ['carrot', 'onion']); wallShelf(P, c, 132, 18, 34, ['veggiesoup', 'beanstew', 'fishstew']);
    rug(P, 96, 64, 76, 50, '#c0603a'); diningSet(P, c, 104, 78, 30, 'veggiesoup'); diningSet(P, c, 140, 96, 30, 'bakedpotato'); pendant(P, 118, 50, '#d94545'); pendant(P, 154, 70, '#d94545');
    for (let i = 0; i < 2; i++) produceCrate(P, c, 8 + i * 18, 70, ['potato', 'onion'][i]); sackStack(P, c, 8, 100, 'rice');
    plantTall(P, 202, 60); bench(P, 180, 124, 34); doorPlants(P); sconce(P, 96, 30);
  } },
  sweets: { floor: 'pastel', wall: 'pastel', windows: [[30, '#f4c030']], station: [150, 70], draw(P, c) {
    bunting(P, 4, 2, RW - 8); fairyLights(P, 4, 26, RW - 8); wallShelf(P, c, 112, 10, 64, ['candy', 'toffee', 'honeydrops', 'soda', 'maplecandy', 'mintcandy']); chalkboard(P, 186, 4, 24, 18); painting(P, 66, 8, 16, 12, 4);
    gumball(P, 10, 40); gumball(P, 26, 40); shelf(P, c, 46, 44, 40, ['candy', 'toffee', 'honeydrops']);
    counter(P, 70, 88, 100, '#f4c8d8'); shadow(P, 70, 102, 100); candyJars(P, 80, 74); register(P, 150, 76); lollipops(P, 52, 82); pendant(P, 110, 56, '#f06090');
    rugRound(P, 76, 110, 72, 18, '#f06090'); cafeTable(P, c, 26, 114, 'soda'); cafeTable(P, c, 186, 114, 'candy'); plantTall(P, 200, 48); barrel(P, 8, 72); P.oval(9, 70, 10, 4, '#f4c030');
  } },
  smokehouse: { floor: 'plank', wall: 'dark', windows: [], station: [100, 70], glow: [100, 104, 22, 6], draw(P, c) {
    toolRack(P, 10, 6); net(P, 176, 6); lantern(P, 60, 6); lantern(P, 140, 6); wallShelf(P, c, 96, 14, 34, ['smokedfish', 'smokedcheese', 'fish']);
    rack(P, c, 12, 38, 'fish'); rack(P, c, 60, 38, 'fish'); rack(P, c, 150, 38, 'smokedfish');
    P.r(92, 96, 38, 18, C.stoneDD); P.r(96, 100, 30, 12, '#3a2a28'); P.r(100, 104, 22, 6, '#e8702a'); light(111, 106, 36, 'fire'); shadow(P, 92, 114, 38);
    firewood(P, 52, 118); chopBlock(P, 150, 104); table(P, 164, 80, 44); shadow(P, 164, 95, 44); icon(c, 'smokedfish', 168, 72); icon(c, 'smokedcheese', 182, 72); icon(c, 'smokedfish', 196, 72);
    barrelRow(P, 8, 84, 2); sackStack(P, c, 186, 112, 'fish', 2); lantern(P, 196, 34);
  } },
  teahouse: { floor: 'tatami', wall: 'cream', windows: [[40, '#9ab040'], [170, '#9ab040']], station: [110, 62], draw(P, c) {
    paperLantern(P, 70, 6); paperLantern(P, 150, 8, '#f4c542'); wallShelf(P, c, 90, 10, 50, ['tea', 'chai', 'coffee', 'latte']); painting(P, 112, 4, 12, 14, 0, C.woodD);
    teaCounter(P, 80, 76); shadow(P, 80, 90, 60); sackStack(P, c, 186, 44, 'tealeaf', 2); sackStack(P, c, 8, 44, 'coffeebean', 2);
    rug(P, 10, 96, 56, 30, '#9ab040'); P.r(24, 106, 28, 8, C.woodD); P.hl(24, 106, 28, C.woodL); mugs(P, 28, 102, 3); cushion(P, 12, 114, '#e07ba5'); cushion(P, 52, 114, '#5b8fe0');
    rug(P, 158, 96, 56, 30, '#e8b23a'); P.r(172, 106, 28, 8, C.woodD); P.hl(172, 106, 28, C.woodL); icon(c, 'tea', 176, 98); icon(c, 'latte', 188, 98); cushion(P, 160, 114, '#43b3a6'); cushion(P, 200, 114, '#a66bd1');
    plantTall(P, 4, 60); plantTall(P, 204, 60); lamp(P, 66, 100); lamp(P, 150, 100); doorPlants(P);
  } },
  coop: { floor: 'straw', wall: 'plank', windows: [[110, null]], animals: 'chicken', draw(P, c) {
    // nesting boxes along the back wall, perches on the right, feed and water by the door
    for (let i = 0; i < 4; i++) nest(P, c, 8 + i * 22, 38); perch(P, 142, 38, 70); perch(P, 152, 48, 50); sign(P, 150, 8); windowBox(P, 106, 23, 26);
    lantern(P, 60, 8); lantern(P, 196, 8); feedBin(P, c, 6, 70, 'wheat'); hayStack(P, 190, 70);
    trough(P, 140, 126, 60); waterTrough(P, 24, 126, 34); basket(P, c, 6, 112, 'egg');
    // a ramp up to the perches, egg baskets hung by the door, a feed sack beside the bin
    P.line(130, 62, 146, 46, C.woodL); P.line(131, 62, 147, 46, C.woodD); for (let i = 0; i < 4; i++) P.hl(132 + i * 4, 59 - i * 4, 3, C.woodDD);
    for (let i = 0; i < 2; i++) { P.vl(30 + i * 14, 18, 4, C.stoneDD); P.rr(26 + i * 14, 22, 10, 7, '#c9944a'); icon(c, 'egg', 27 + i * 14, 18); }
    sack(P, c, 26, 72, 'wheat'); hay(P, 190, 102, 18);
  } },
  cowshed: { floor: 'straw', wall: 'red', windows: [[100, null]], animals: 'cow', draw(P, c) {
    for (let i = 0; i < 5; i++) stall(P, 24 + i * 44, 36); trough(P, 14, 36, 190); lantern(P, 60, 8); lantern(P, 160, 8); toolRack(P, 120, 4); sign(P, 20, 10, '#c49a62'); windowBox(P, 96, 23, 26);
    feedBin(P, c, 6, 74, 'corn'); hayStack(P, 190, 74); cans(P, 6, 120, 3); bucket(P, 200, 124, '#fbf8ef');
    // milking corner, a cowbell and little name plates on the stalls
    stool(P, 184, 112); bucket(P, 172, 116, '#fbf8ef'); P.vl(76, 8, 4, C.stoneDD); P.rr(73, 12, 7, 7, C.gold); P.px(76, 18, C.goldD);
    for (let i = 0; i < 4; i++) { P.r(40 + i * 44, 26, 12, 5, C.cream); P.hl(42 + i * 44, 28, 8, C.woodD); }
    sack(P, c, 26, 78, 'corn'); hay(P, 6, 98, 20);
  } },
  sheeppen: { floor: 'straw', wall: 'plank', windows: [[60, null], [150, null]], animals: 'sheep', draw(P, c) {
    trough(P, 14, 38, 70); waterTrough(P, 100, 40, 30); lantern(P, 104, 6); toolRack(P, 10, 4); sign(P, 120, 10); windowBox(P, 56, 23, 26); windowBox(P, 146, 23, 26);
    hayStack(P, 176, 40); feedBin(P, c, 6, 70, 'carrot'); hayStack(P, 6, 106);
    // the shearing corner: stool, clippers on a hook and baskets of wool
    stool(P, 176, 116); P.vl(196, 60, 4, C.stoneDD); P.line(194, 64, 198, 70, C.stoneD); P.line(198, 64, 194, 70, C.stoneD);
    for (let i = 0; i < 3; i++) basket(P, c, 158 + i * 18, 124, 'wool'); sack(P, c, 196, 98, 'wool'); sack(P, c, 26, 74, 'carrot');
  } },
  duckhouse: { floor: 'straw', wall: 'teal', windows: [[150, null]], animals: 'duck', draw(P, c) {
    nest(P, c, 8, 38, false); nest(P, c, 30, 38, false); nest(P, c, 186, 38, false); icon(c, 'duckegg', 192, 35); lantern(P, 110, 6); sign(P, 70, 10); windowBox(P, 146, 23, 26);
    pond(P, 62, 70, 100, 42); for (const [x, y] of [[66, 72], [156, 100], [64, 106]]) { P.vl(x, y - 8, 9, '#6a9a4a'); P.oval(x - 1, y - 11, 3, 5, '#8a5a32'); }
    feedBin(P, c, 196, 64, 'oats'); trough(P, 8, 126, 40); basket(P, c, 186, 124, 'duckegg');
  } },
  dock: { floor: 'plank', wall: 'plank', windows: [[40, null], [160, null]], fish: true, draw(P, c) {
    P.r(3, 66, RW - 6, RH - 72, C.waterD); P.r(3, 68, RW - 6, RH - 76, C.water);
    for (let x = 6; x < RW - 6; x += 14) P.hl(x, 80 + (x % 28 ? 6 : 0), 6, C.waterL);
    P.r(RW / 2 - 14, 66, 28, RH - 70, C.woodL); for (let y = 66; y < RH - 4; y += 6) P.hl(RW / 2 - 14, y, 28, C.woodD);
    net(P, 70, 4); lifeRing(P, 120, 6); oars(P, 190, 34); lantern(P, 100, 34); wallShelf(P, c, 136, 16, 40, ['fish', 'perch', 'trout']);
    barrelRow(P, 8, 42, 2); crate(P, 36, 48); bucket(P, 52, 52); basket(P, c, 160, 50, 'fish'); crate(P, 176, 48); stool(P, 136, 54);
    P.line(130, 40, 150, 70, C.woodDD); P.px(150, 71, '#ffffff');
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
