// Crops at each growth stage, fruit trees and decorative trees.
import { C, sprite, cached, outline, canvas, pen, noise } from './core.js';

const PO = '#2d4a2a'; // plant outline
export const CROP_H = 28; // crop canvas height (tile is the bottom 16 rows)

function plantSprite(fn) {
  const cv = canvas(16, CROP_H);
  const P = pen(cv);
  fn(P);
  outline(cv, PO);
  return cv;
}

const sprout = (P, x, y) => { P.px(x, y - 1, C.leafL); P.px(x - 1, y - 2, C.leafL); P.px(x + 1, y - 2, C.leaf); };
const leafPair = (P, x, y, c = C.leaf, c2 = C.leafL) => { P.px(x - 1, y, c); P.px(x + 1, y, c2); };
const bush = (P, x, y, w, h, c = C.leaf, d = C.leafD, l = C.leafL) => {
  P.oval(x - (w >> 1), y - h, w, h, c);
  P.r(x - (w >> 1) + 1, y - 2, w - 2, 2, d);
  P.px(x - 1, y - h + 1, l); P.px(x - 2, y - h + 2, l);
};

// Each crop: plant(P, stage, x, y) draws one plant whose base is at (x, y).
// layout = base points in a 16x28 canvas (tile occupies y 12..27).
const TWO_ROWS = [[4, 19], [11, 19], [4, 26], [11, 26]];
const STAGGER = [[5, 20], [11, 23], [4, 27]];
const PAIR = [[5, 21], [11, 26]];
const ONE = [[8, 25]];

const CROPS = {
  wheat: { layout: [[3, 18], [8, 19], [13, 18], [3, 24], [8, 26], [13, 24]], plant(P, s, x, y) {
    if (s === 1) { P.vl(x, y - 3, 3, C.leaf); P.px(x - 1, y - 2, C.leafL); P.px(x + 1, y - 3, C.leafL); return; }
    const h = s === 2 ? 7 : 9, st = s === 2 ? C.leaf : '#d9b448', tip = s === 2 ? C.leafL : C.goldL;
    P.vl(x, y - h, h, st); P.vl(x - 1, y - h + 2, h - 2, s === 2 ? C.leafD : '#c79a32'); P.vl(x + 1, y - h + 3, h - 3, st);
    if (s === 3) { P.r(x - 1, y - h - 1, 3, 4, C.gold); P.px(x, y - h - 2, C.goldL); P.px(x + 1, y - h, C.goldL); P.px(x - 1, y - h + 2, C.goldD); }
    else P.px(x, y - h - 1, tip);
  } },
  carrot: { layout: TWO_ROWS, plant(P, s, x, y) {
    const h = s === 1 ? 3 : 5;
    P.vl(x, y - h, h, C.leaf); P.line(x, y - 1, x - 2, y - h + 1, C.leafD); P.line(x, y - 1, x + 2, y - h + 1, C.leafL);
    P.px(x - 2, y - h, C.leafL); P.px(x + 2, y - h, C.leaf);
    if (s === 3) { P.r(x - 1, y - 1, 3, 2, C.orange); P.px(x, y - 1, '#ffb066'); }
  } },
  strawberry: { layout: TWO_ROWS, plant(P, s, x, y) {
    bush(P, x, y, s === 1 ? 4 : 6, s === 1 ? 3 : 5);
    if (s === 2) { P.px(x - 1, y - 3, C.white); P.px(x + 2, y - 2, C.white); }
    if (s === 3) { P.r(x - 2, y - 2, 2, 2, C.red); P.r(x + 1, y - 3, 2, 2, C.red); P.px(x - 2, y - 2, '#ff8a8a'); P.px(x, y - 1, C.redD); }
  } },
  corn: { layout: PAIR, plant(P, s, x, y) {
    const h = s === 1 ? 5 : s === 2 ? 11 : 14;
    P.vl(x, y - h, h, C.leaf); P.vl(x + 1, y - h + 2, h - 2, C.leafD);
    for (let k = 3; k < h; k += 4) { P.line(x, y - k, x - 3, y - k - 2, C.leafL); P.line(x + 1, y - k - 1, x + 4, y - k - 3, C.leaf); }
    if (s >= 2) { P.px(x, y - h - 1, '#e8d080'); P.px(x - 1, y - h, '#e8d080'); }
    if (s === 3) { P.r(x + 2, y - 9, 2, 5, C.yellow); P.px(x + 2, y - 9, C.goldL); P.r(x + 1, y - 5, 2, 1, C.leafL); }
  } },
  blueberry: { layout: [[5, 20], [11, 26], [4, 27]], plant(P, s, x, y) {
    bush(P, x, y, s === 1 ? 5 : 8, s === 1 ? 4 : 7, '#4f8f4a', '#356a38', '#6fb064');
    if (s === 3) for (const [dx, dy] of [[-2, -3], [1, -5], [2, -2], [-1, -6], [-3, -5]]) { P.px(x + dx, y + dy, '#4d63c9'); P.px(x + dx + 1, y + dy, '#3b4aa0'); }
    if (s === 2) { P.px(x - 1, y - 5, C.white); P.px(x + 2, y - 3, C.white); }
  } },
  sugarcane: { layout: [[3, 22], [8, 24], [13, 22], [5, 27], [11, 27]], plant(P, s, x, y) {
    const h = s === 1 ? 4 : s === 2 ? 9 : 13;
    P.vl(x, y - h, h, s === 3 ? '#c9d76a' : C.leafL); P.vl(x + 1, y - h + 1, h - 1, '#8aa63a');
    for (let k = 3; k < h; k += 3) P.hl(x, y - k, 2, '#6f8a2e');
    P.line(x, y - h, x - 2, y - h - 2, C.leaf); P.line(x + 1, y - h, x + 3, y - h - 1, C.leafL);
  } },
  potato: { layout: TWO_ROWS, plant(P, s, x, y) {
    bush(P, x, y, s === 1 ? 4 : 7, s === 1 ? 3 : 5, '#5e9e46', '#467a38', '#7cbf5a');
    if (s >= 2) { P.px(x, y - 5, '#f2e8ff'); P.px(x - 2, y - 4, '#c9a8f0'); }
    if (s === 3) { P.r(x - 3, y - 1, 2, 2, '#c99a5e'); P.r(x + 2, y - 1, 2, 1, '#c99a5e'); }
  } },
  tomato: { layout: PAIR, plant(P, s, x, y) {
    const h = s === 1 ? 4 : s === 2 ? 9 : 11;
    if (s >= 2) P.vl(x + 3, y - h - 1, h + 1, C.woodL);
    P.vl(x, y - h, h, C.leaf);
    for (let k = 2; k < h; k += 3) { leafPair(P, x, y - k); P.px(x - 2, y - k - 1, C.leafD); P.px(x + 2, y - k + 1, C.leaf); }
    if (s === 2) { P.px(x - 1, y - 6, C.yellow); P.px(x + 1, y - 4, C.yellow); }
    if (s === 3) for (const [dx, dy] of [[-2, -4], [1, -7], [1, -3]]) { P.r(x + dx, y + dy, 2, 2, '#e2483a'); P.px(x + dx, y + dy, '#ff8a6a'); }
  } },
  sunflower: { layout: PAIR, plant(P, s, x, y) {
    const h = s === 1 ? 5 : s === 2 ? 11 : 14;
    P.vl(x, y - h, h, C.leafD); leafPair(P, x, y - 4); P.px(x - 2, y - 5, C.leaf); P.px(x + 2, y - 3, C.leafL);
    if (s === 2) P.rr(x - 1, y - h - 2, 3, 3, C.leaf);
    if (s === 3) { P.rr(x - 3, y - h - 4, 7, 6, C.yellow); P.px(x - 2, y - h - 4, C.goldL); P.r(x - 1, y - h - 2, 3, 2, '#6b3f1f'); P.px(x, y - h - 2, '#8e5a2e'); }
  } },
  pumpkin: { layout: ONE, plant(P, s, x, y) {
    P.line(x - 6, y - 2, x + 6, y - 3, C.leafD);
    for (const dx of [-5, -1, 4]) { P.oval(x + dx - 1, y - 5, 4, 3, C.leaf); P.px(x + dx, y - 5, C.leafL); }
    if (s === 2) { P.rr(x - 2, y - 4, 5, 4, '#9ccc5a'); P.vl(x, y - 4, 4, '#7aa63a'); }
    if (s === 3) {
      P.rr(x - 5, y - 7, 10, 7, C.orange); P.vl(x - 2, y - 6, 5, C.orangeD); P.vl(x + 1, y - 6, 5, C.orangeD);
      P.r(x - 4, y - 6, 1, 2, '#ffb767'); P.r(x - 1, y - 9, 2, 2, C.leafD);
    }
  } },
  hops: { layout: [[8, 26]], plant(P, s, x, y) {
    P.vl(x - 6, y - 15, 15, C.woodL); P.vl(x + 6, y - 15, 15, C.woodL); P.hl(x - 6, y - 15, 13, C.woodD);
    const h = s === 1 ? 5 : s === 2 ? 11 : 14;
    for (const dx of [-4, 0, 4]) {
      P.vl(x + dx, y - h, h, C.leafD);
      for (let k = 2; k < h; k += 3) P.px(x + dx + (k % 2 ? 1 : -1), y - k, C.leaf);
      if (s === 3) { P.r(x + dx - 1, y - 9, 2, 3, '#a9d65e'); P.r(x + dx + 1, y - 5, 2, 3, '#a9d65e'); P.px(x + dx - 1, y - 9, '#d6f29a'); }
    }
  } },
  grapes: { layout: [[8, 26]], plant(P, s, x, y) {
    P.vl(x - 6, y - 13, 13, C.woodD); P.vl(x + 6, y - 13, 13, C.woodD); P.hl(x - 7, y - 12, 15, C.woodL); P.hl(x - 7, y - 7, 15, C.woodL);
    if (s === 1) { P.vl(x, y - 4, 4, C.leafD); P.px(x - 1, y - 4, C.leaf); return; }
    for (let k = -6; k <= 6; k += 3) { P.oval(x + k - 1, y - 14 + (k % 2 ? 1 : 0), 4, 3, C.leaf); P.px(x + k, y - 13, C.leafL); }
    P.vl(x, y - 11, 11, C.woodD);
    if (s === 3) for (const dx of [-4, 3]) { P.r(x + dx, y - 10, 3, 2, '#8b4ab0'); P.r(x + dx, y - 8, 2, 2, '#8b4ab0'); P.px(x + dx, y - 10, '#b27ad6'); }
  } },
  cotton: { layout: STAGGER, plant(P, s, x, y) {
    P.vl(x, y - 6, 6, C.woodD); P.line(x, y - 3, x - 3, y - 6, C.woodD); P.line(x, y - 4, x + 3, y - 7, C.woodD);
    bush(P, x, y - 2, s === 1 ? 4 : 7, s === 1 ? 3 : 5, '#6a9a4a', '#4a7a3a', '#8aba6a');
    if (s === 3) for (const [dx, dy] of [[-3, -7], [3, -8], [0, -9], [-1, -5]]) { P.r(x + dx, y + dy, 2, 2, C.white); P.px(x + dx, y + dy, '#fff'); }
  } },
  lavender: { layout: [[3, 20], [8, 21], [13, 20], [5, 27], [11, 27]], plant(P, s, x, y) {
    const h = s === 1 ? 3 : 6;
    P.vl(x, y - h, h, '#6a9a6a'); P.px(x - 1, y - 2, '#8aba8a'); P.px(x + 1, y - 3, '#8aba8a');
    if (s >= 2) { const c = s === 3 ? '#9a7ae0' : '#b8c8a8'; P.r(x - 1, y - h - 3, 3, 4, c); P.px(x, y - h - 4, s === 3 ? '#c4aaf8' : c); P.px(x - 1, y - h - 1, s === 3 ? '#7a5ac0' : '#9aa88a'); }
  } },
  oats: { layout: [[3, 18], [8, 19], [13, 18], [3, 24], [8, 26], [13, 24]], plant(P, s, x, y) {
    const h = s === 1 ? 4 : s === 2 ? 7 : 9, st = s === 3 ? '#c8b070' : C.leaf;
    P.vl(x, y - h, h, st); P.line(x, y - 2, x - 2, y - 4, s === 3 ? '#b8a060' : C.leafD);
    if (s >= 2) for (let k = 0; k < 3; k++) { P.px(x - 1, y - h + k * 2, s === 3 ? '#efe0a8' : C.leafL); P.px(x + 1, y - h + 1 + k * 2, s === 3 ? '#e0d090' : C.leafL); }
  } },
  cabbage: { layout: [[5, 20], [11, 20], [5, 26], [11, 26]], plant(P, s, x, y) {
    const w = s === 1 ? 4 : s === 2 ? 6 : 8;
    P.oval(x - (w >> 1), y - w + 2, w, w - 1, '#5e9e46');
    if (s >= 2) P.oval(x - (w >> 1) + 1, y - w + 3, w - 2, w - 3, s === 3 ? '#b8e08a' : '#8cc45c');
    if (s === 3) { P.px(x, y - 4, '#e0f4c0'); P.line(x, y - 5, x, y - 1, '#7ab85a'); }
  } },
  onion: { layout: TWO_ROWS, plant(P, s, x, y) {
    const h = s === 1 ? 3 : 6;
    P.vl(x, y - h, h, C.leafL); P.vl(x + 1, y - h + 1, h - 1, C.leaf); P.px(x - 1, y - h + 1, C.leaf);
    if (s === 3) { P.r(x - 1, y - 2, 3, 2, '#d8a060'); P.px(x, y - 2, '#f0c890'); }
  } },
  beans: { layout: PAIR, plant(P, s, x, y) {
    const h = s === 1 ? 4 : s === 2 ? 10 : 12;
    P.vl(x + 2, y - h - 1, h + 1, C.woodL); P.vl(x, y - h, h, C.leafD);
    for (let k = 2; k < h; k += 3) { P.oval(x - 3, y - k - 1, 3, 2, C.leaf); P.oval(x + 1, y - k - 2, 3, 2, C.leafL); }
    if (s === 3) for (const dy of [-5, -9]) { P.vl(x - 2, y + dy, 3, '#9ac060'); P.vl(x + 3, y + dy + 1, 3, '#9ac060'); }
  } },
  cucumber: { layout: PAIR, plant(P, s, x, y) {
    P.line(x - 5, y - 1, x + 5, y - 2, C.leafD);
    const n = s === 1 ? 2 : 4;
    for (let k = 0; k < n; k++) { const dx = -4 + k * 3; P.oval(x + dx - 1, y - 5, 4, 3, k % 2 ? C.leafL : C.leaf); }
    if (s >= 2) P.px(x, y - 6, C.yellow);
    if (s === 3) { P.r(x - 3, y - 2, 4, 2, '#3f7a2e'); P.hl(x - 3, y - 2, 4, '#6aa84a'); P.r(x + 2, y - 3, 3, 2, '#3f7a2e'); }
  } },
  raspberry: { layout: [[5, 20], [11, 26], [4, 27]], plant(P, s, x, y) {
    P.vl(x, y - 9, 9, C.woodD); P.vl(x + 2, y - 7, 7, C.woodD);
    bush(P, x + 1, y - 1, s === 1 ? 5 : 8, s === 1 ? 4 : 7);
    if (s === 3) for (const [dx, dy] of [[-2, -4], [2, -6], [3, -2], [0, -7], [-3, -6]]) { P.r(x + dx, y + dy, 2, 2, '#d9345a'); P.px(x + dx, y + dy, '#ff8aa8'); }
  } },
  bellpepper: { layout: PAIR, plant(P, s, x, y) {
    const h = s === 1 ? 4 : 8;
    P.vl(x, y - h, h, C.leafD);
    for (let k = 2; k < h; k += 3) { P.oval(x - 3, y - k - 2, 3, 2, C.leaf); P.oval(x + 1, y - k - 1, 3, 2, C.leafL); }
    if (s === 2) P.px(x + 1, y - 5, C.white);
    if (s === 3) { P.rr(x - 3, y - 5, 3, 4, '#e8402a'); P.px(x - 3, y - 5, '#ff8a6a'); P.rr(x + 1, y - 7, 3, 4, '#f4c742'); }
  } },
  watermelon: { layout: ONE, plant(P, s, x, y) {
    P.line(x - 6, y - 2, x + 6, y - 2, C.leafD);
    for (const dx of [-5, 0, 4]) { P.oval(x + dx - 1, y - 5, 4, 3, C.leaf); P.px(x + dx, y - 5, C.leafL); }
    if (s === 2) { P.oval(x - 2, y - 4, 5, 4, '#5a9a4a'); }
    if (s === 3) { P.oval(x - 6, y - 7, 12, 7, '#3f8a3a'); for (const dx of [-4, -1, 2]) P.vl(x + dx, y - 6, 5, '#2a6a2a'); P.oval(x - 4, y - 6, 4, 2, '#6aae5a'); }
  } },
  honeydew: { layout: ONE, plant(P, s, x, y) {
    P.line(x - 6, y - 2, x + 6, y - 2, C.leafD);
    for (const dx of [-5, 0, 4]) { P.oval(x + dx - 1, y - 5, 4, 3, C.leaf); P.px(x + dx, y - 5, C.leafL); }
    if (s === 2) P.oval(x - 2, y - 4, 5, 4, '#b8d080');
    if (s === 3) { P.oval(x - 5, y - 8, 10, 8, '#d8eaa0'); P.oval(x - 3, y - 7, 4, 3, '#f0f8d0'); P.px(x + 2, y - 3, '#a8c070'); }
  } },
  rice: { layout: [[3, 19], [8, 20], [13, 19], [3, 26], [8, 27], [13, 26]], plant(P, s, x, y) {
    P.px(x - 1, y, '#7ab8d8'); P.px(x + 1, y, '#7ab8d8');
    const h = s === 1 ? 4 : s === 2 ? 7 : 8;
    P.line(x, y, x - 1, y - h, C.leaf); P.line(x, y, x + 2, y - h + 1, C.leafL);
    if (s === 3) { P.px(x - 2, y - h, '#e8d890'); P.px(x - 2, y - h + 1, '#e8d890'); P.px(x + 3, y - h + 1, '#e8d890'); }
  } },
  tealeaf: { layout: [[5, 21], [11, 21], [8, 27]], plant(P, s, x, y) {
    bush(P, x, y, s === 1 ? 5 : 8, s === 1 ? 4 : 6, '#3f8a4a', '#2f6a3a', '#5aaa5e');
    if (s === 3) for (const [dx, dy] of [[-2, -5], [1, -6], [3, -3]]) { P.px(x + dx, y + dy, '#a8e080'); P.px(x + dx + 1, y + dy, '#a8e080'); }
  } },
  coffeebean: { layout: PAIR, plant(P, s, x, y) {
    const h = s === 1 ? 5 : 10;
    P.vl(x, y - h, h, C.woodD);
    for (let k = 2; k < h; k += 3) { P.oval(x - 4, y - k - 1, 4, 2, '#3f7a3a'); P.oval(x + 1, y - k - 2, 4, 2, '#4f8a42'); }
    if (s === 3) for (const dy of [-4, -7]) { P.r(x - 1, y + dy, 1, 2, '#c8302a'); P.r(x + 1, y + dy + 1, 1, 2, '#a8201e'); }
  } },
  asparagus: { layout: [[3, 20], [8, 21], [13, 20], [5, 27], [11, 27]], plant(P, s, x, y) {
    const h = s === 1 ? 3 : s === 2 ? 6 : 8;
    P.vl(x, y - h, h, '#6a9a4a'); P.px(x + 1, y - 2, '#7aaa5a');
    if (s === 3) { P.r(x - 1, y - h - 1, 2, 2, '#8ab860'); P.px(x, y - h - 2, '#a07ab0'); P.vl(x + 2, y - 5, 5, '#6a9a4a'); }
  } },
  sunberry: { layout: TWO_ROWS, plant(P, s, x, y) {
    bush(P, x, y, s === 1 ? 4 : 7, s === 1 ? 3 : 5);
    if (s === 3) for (const [dx, dy] of [[-2, -3], [1, -4], [2, -2]]) { P.r(x + dx, y + dy, 2, 2, '#f4a020'); P.px(x + dx, y + dy, '#ffe070'); }
  } },
  cranberry: { layout: TWO_ROWS, plant(P, s, x, y) {
    bush(P, x, y, s === 1 ? 5 : 8, s === 1 ? 3 : 4, '#5a7a3a', '#3e5a2a', '#7a9a52');
    if (s === 3) for (const [dx, dy] of [[-3, -2], [0, -3], [2, -1], [-1, -1]]) P.px(x + dx, y + dy, '#b01a3a');
  } },
  frostmint: { layout: TWO_ROWS, plant(P, s, x, y) {
    bush(P, x, y, s === 1 ? 4 : 7, s === 1 ? 3 : 5, '#5aaa98', '#3a8a7a', '#9ae0d0');
    if (s === 3) { P.px(x - 1, y - 4, '#ffffff'); P.px(x + 2, y - 3, '#e0f8f4'); }
  } },
};

export function cropSprite(crop, stage) {
  return cached(`crop:${crop}:${stage}`, () => plantSprite((P) => {
    const def = CROPS[crop];
    for (const [x, y] of def.layout) {
      if (stage === 0) sprout(P, x, y - 1);
      else def.plant(P, stage, x, y - 1);
    }
  }));
}

// ---------- trees ----------
const CANOPY = {
  oak: ['#4f9a45', '#3c7f37', '#6cb85a', '#2f6a2c'],
  apple: ['#56a046', '#3f8236', '#76c25e', '#2f6a2c'],
  cherry: ['#5a9e4e', '#43823c', '#7cbf66', '#336b30'],
  orange: ['#3f8f4a', '#2f743c', '#5aae5e', '#245c30'],
  birch: ['#8cc25a', '#6aa646', '#b0dc7a', '#4f8a3a'],
  blossom: ['#f2a7c3', '#d9819f', '#ffd0e0', '#b8607e'],
  plum: ['#4a8a4a', '#36703a', '#68a85e', '#285a2c'],
  peach: ['#5aa04a', '#428438', '#7cc060', '#2f6a2c'],
  maple: ['#d86a2e', '#b84a22', '#f09848', '#8a3418'],
};

function canopy(P, cx, cy, rx, ry, pal) {
  const [c, d, l, dd] = pal;
  P.oval(cx - rx, cy - ry, rx * 2, ry * 2, d);
  P.oval(cx - rx + 1, cy - ry, rx * 2 - 2, ry * 2 - 3, c);
  // leaf clumps
  for (let i = 0; i < 9; i++) {
    const a = noise(i, rx, 3) * Math.PI * 2, r = noise(i, ry, 4) * (rx - 3);
    const x = cx + Math.cos(a) * r, y = cy - 2 + Math.sin(a) * r * (ry / rx);
    P.oval(x - 2, y - 2, 4, 3, l);
    P.px(x - 1, y + 1, c);
  }
  P.oval(cx - rx + 3, cy - ry + 2, 5, 3, l);
  for (let i = 0; i < 10; i++) P.px(cx - rx + 2 + ((noise(i, 9, rx) * (rx * 2 - 4)) | 0), cy + ry - 3 - ((noise(i, 8, ry) * 3) | 0), dd);
}

const AUTUMN = {
  oak: ['#d8782e', '#b8561e', '#f0a048', '#8a3c18'],
  birch: ['#e8c040', '#c89a28', '#f8dc68', '#9a7420'],
  blossom: ['#d8582e', '#b03e22', '#f08850', '#7a2a18'],
  fruit: ['#8a9a3a', '#6e7e2e', '#b0b048', '#4e5a22'],
};
const WINTER_FRUIT = ['#7a9a7a', '#5e7e62', '#a8c0a8', '#4a6450'];
const DECIDUOUS = new Set(['oak', 'birch', 'blossom']);

function snowCap(P, cx, cy, rx) {
  for (let x = cx - rx + 2; x < cx + rx - 2; x++) {
    const d = Math.abs(x - cx) / rx, top = Math.round(cy - rx * Math.sqrt(1 - d * d));
    P.px(x, top + 1, '#f4f8fa'); P.px(x, top + 2, '#e0eaf0');
    if ((x * 7) % 5 === 0) P.px(x, top + 3, '#f4f8fa');
  }
}

/** A tree sprite (24 x 34). kind = canopy palette; fruit = colour of fruit or null; flowers = blossom dots. */
export function treeSprite(kind, fruit = null, flowers = false, season = 'summer') {
  return cached(`tree:${kind}:${fruit}:${flowers}:${season}`, () => sprite(24, 34, (P) => {
    if (season === 'winter' && DECIDUOUS.has(kind)) { bareTree(P, kind); return; }
    const trunk = kind === 'birch' ? '#efeae0' : C.woodD;
    P.r(10, 20, 4, 13, trunk); P.vl(13, 20, 13, kind === 'birch' ? '#cfc8b8' : C.woodDD); P.px(9, 32, trunk); P.px(14, 32, trunk);
    if (kind === 'birch') for (const y of [23, 27, 30]) P.hl(10, y, 2, '#4a4a4a');
    if (kind === 'maple') { P.r(13, 25, 4, 4, '#9aa8b0'); P.hl(13, 25, 4, '#c8d4dc'); P.px(12, 24, C.stoneDD); if (fruit) P.hl(13, 26, 4, '#d8a050'); }
    let pal = CANOPY[kind] || CANOPY.oak;
    if (season === 'autumn') pal = AUTUMN[kind] || (kind === 'maple' ? pal : AUTUMN.fruit);
    if (season === 'winter') pal = kind === 'maple' ? AUTUMN.oak : WINTER_FRUIT;
    if (season === 'spring' && !fruit && !DECIDUOUS.has(kind)) flowers = true;
    canopy(P, 12, 13, 11, 11, pal);
    if (season === 'winter') snowCap(P, 12, 13, 11);
    if (flowers) for (let i = 0; i < 9; i++) { const x = 3 + ((noise(i, 1, 5) * 18) | 0), y = 4 + ((noise(i, 2, 5) * 14) | 0); P.px(x, y, '#fff2f6'); P.px(x + 1, y, '#f7b8cf'); }
    if (fruit && kind !== 'maple') for (const [x, y] of [[5, 10], [15, 6], [18, 13], [9, 16], [12, 9], [6, 17], [16, 18]]) {
      P.r(x, y, 2, 2, fruit); P.px(x, y, 'rgba(255,255,255,0.55)');
    }
  }));
}

export function pineSprite(season = 'summer') {
  return cached(`tree:pine:${season}`, () => sprite(20, 34, (P) => {
    P.r(8, 26, 4, 7, C.woodD);
    const layers = [[10, 3, 4], [10, 7, 6], [10, 12, 8], [10, 18, 10]];
    for (const [cx, y, r] of layers) {
      for (let j = 0; j < 8; j++) {
        const w = Math.round((r * (j + 2)) / 9);
        P.hl(cx - w, y + j, w * 2, j > 5 ? '#2f6a3c' : '#3f8a4a');
        P.px(cx - w + 1, y + j, '#5aa65e');
        if (season === 'winter' && j < 2) P.hl(cx - w, y + j, w * 2, j ? '#e0eaf0' : '#f4f8fa');
      }
    }
    P.px(10, 2, season === 'winter' ? '#ffffff' : '#5aa65e');
  }));
}

/** Fruit colour shown on a ripe tree (null = no fruit dots). */
export const FRUIT_COLOR = { apple: '#d63a3a', cherry: '#b81e3c', orange: '#f08a24', plum: '#7a3f9a', peach: '#f4a070', maple: '#d8a050' };

/** Leafless winter tree with snow on the branches. */
function bareTree(P, kind) {
  const bark = kind === 'birch' ? '#efeae0' : C.woodD, dk = kind === 'birch' ? '#cfc8b8' : C.woodDD;
  P.r(10, 16, 4, 17, bark); P.vl(13, 16, 17, dk); P.px(9, 32, bark); P.px(14, 32, bark);
  if (kind === 'birch') for (const y of [20, 25, 29]) P.hl(10, y, 2, '#4a4a4a');
  const br = [[11, 18, 3, 6], [12, 16, 20, 5], [11, 13, 5, 2], [12, 12, 17, 1], [12, 10, 9, 3], [12, 9, 14, 4], [11, 20, 2, 12], [13, 19, 22, 11]];
  for (const [x0, y0, x1, y1] of br) {
    P.line(x0, y0, x1, y1, bark);
    P.px(x1, y1 - 1, '#f4f8fa'); P.px(Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2) - 1, '#e0eaf0');
  }
  P.px(8, 2, '#f4f8fa'); P.px(16, 3, '#f4f8fa');
}
