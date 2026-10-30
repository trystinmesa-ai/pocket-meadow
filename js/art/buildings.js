// Buildings, drawn from a small set of parts (walls, roofs, doors, windows)
// plus a few unique details each. Sprites carry .lights (window rects for
// night glow) and .smoke (chimney points).
import { C, sprite, cached, shade, noise, canvas, pen, outline } from './core.js';
import { DEFS, TILE } from '../data.js';

// ---------- parts ----------
function roof(P, x, y, w, h, [c, d, l], kind = 'shingle') {
  P.r(x, y + 1, w, h - 1, c);
  P.r(x + 1, y, w - 2, 1, c);
  if (kind === 'thatch') {
    for (let j = 1; j < h; j += 2) for (let i = 0; i < w; i += 2) P.px(x + i + (j % 4 ? 1 : 0), y + j, noise(i, j, 3) < 0.5 ? d : l);
  } else if (kind === 'metal') {
    for (let i = 2; i < w; i += 4) P.vl(x + i, y + 1, h - 2, d);
    for (let i = 3; i < w; i += 4) P.vl(x + i, y + 1, h - 2, l);
  } else {
    for (let j = 3; j < h - 1; j += 3) {
      P.hl(x, y + j, w, d);
      for (let i = (j % 2 ? 1 : 3); i < w; i += 4) P.px(x + i, y + j - 1, d);
      for (let i = (j % 2 ? 2 : 0); i < w; i += 6) P.px(x + i, y + j - 2, l);
    }
  }
  P.hl(x + 1, y, w - 2, l); P.hl(x, y + 1, w, l);
  P.hl(x, y + h - 2, w, d); P.hl(x, y + h - 1, w, shade(d, -0.25));
  P.vl(x + w - 1, y + 1, h - 1, d);
}

function wall(P, x, y, w, h, kind, [c, d, l]) {
  P.r(x, y, w, h, c);
  if (kind === 'plank') {
    for (let i = 3; i < w; i += 4) P.vl(x + i, y, h, d);
    for (let i = 0; i < w; i += 4) P.px(x + i + 1, y + 2 + ((noise(i, h, 2) * (h - 4)) | 0), l);
  } else if (kind === 'brick') {
    for (let j = 0; j < h; j += 3) {
      P.hl(x, y + j + 2, w, d);
      for (let i = (j % 2 ? 2 : 5); i < w; i += 6) P.vl(x + i, y + j, 2, d);
      for (let i = (j % 2 ? 3 : 0); i < w; i += 6) P.px(x + i, y + j, l);
    }
  } else if (kind === 'stone') {
    for (let j = 0; j < h; j += 4) for (let i = (j % 8 ? -2 : 0); i < w; i += 6) {
      const sx = Math.max(x, x + i), ex = Math.min(x + w, x + i + 5);
      P.r(sx, y + j, ex - sx, 3, noise(i, j, 1) < 0.5 ? c : l);
      P.hl(sx, y + j + 3, ex - sx, d);
    }
  } else if (kind === 'log') {
    for (let j = 0; j < h; j += 3) { P.hl(x, y + j + 2, w, d); P.hl(x, y + j, w, l); }
  } else if (kind === 'timber') {
    P.vl(x, y, h, C.woodD); P.vl(x + w - 1, y, h, C.woodD); P.hl(x, y + 1, w, C.woodD);
    for (let i = 0; i < w; i += 3) P.px(x + i + 1, y + h - 3, d);
  }
  P.hl(x, y, w, shade(c, -0.35)); // eave shadow
  P.hl(x, y + h - 1, w, d);
}

function door(P, cx, bottom, w = 7, h = 10, c = C.woodD, arch = false) {
  const x = cx - (w >> 1), y = bottom - h;
  P.r(x - 1, y - 1, w + 2, h + 1, C.woodDD);
  P.r(x, y, w, h, c);
  if (arch) { P.px(x, y, C.woodDD); P.px(x + w - 1, y, C.woodDD); }
  for (let i = 2; i < w; i += 2) P.vl(x + i, y + 1, h - 1, shade(c, -0.2));
  P.px(x + w - 2, y + (h >> 1), C.gold);
  P.hl(x - 1, bottom, w + 2, C.stoneD);
}

function win(P, x, y, w = 6, h = 6, frame = C.woodDD, lights) {
  P.r(x - 1, y - 1, w + 2, h + 2, frame);
  P.r(x, y, w, h, C.glass);
  P.r(x, y + (h >> 1), w, h - (h >> 1), C.glassD);
  P.px(x, y, '#d8f2ff'); P.px(x + 1, y, '#d8f2ff');
  P.vl(x + (w >> 1), y, h, frame); P.hl(x, y + (h >> 1), w, frame);
  if (lights) lights.push([x, y, w, h]);
}

function flowerBox(P, x, y, w) {
  P.r(x, y, w, 2, C.woodD);
  for (let i = 0; i < w; i += 2) P.px(x + i, y - 1, i % 4 ? C.pink : C.red);
  for (let i = 1; i < w; i += 2) P.px(x + i, y - 1, C.leaf);
}

function chimney(P, x, y, h = 8, smoke) {
  P.r(x, y, 5, h, C.brick); P.hl(x, y, 5, C.brickL); P.r(x - 1, y - 1, 7, 2, C.stoneD);
  for (let j = 2; j < h; j += 2) P.hl(x, y + j, 5, C.brickD);
  if (smoke) smoke.push([x + 2, y - 2]);
}

function barrel(P, x, y) {
  P.rr(x, y, 6, 8, C.wood); P.hl(x, y + 2, 6, C.stoneDD); P.hl(x, y + 5, 6, C.stoneDD); P.vl(x + 1, y + 1, 6, C.woodL); P.hl(x + 1, y, 4, C.woodD);
}

function make(type, top, fn) {
  const d = DEFS[type];
  const W = d.w * TILE, H = d.h * TILE + top;
  const lights = [], smoke = [];
  const cv = sprite(W, H, (P) => fn(P, W, H, lights, smoke));
  cv.lights = lights; cv.smoke = smoke; cv.top = top;
  return cv;
}

const doorX = (type) => Math.floor((DEFS[type].w - 1) / 2) * TILE + 8;

const DRAW = {
  farmhouse: () => make('farmhouse', 14, (P, W, H, L, S) => {
    const wallTop = H - 24;
    roof(P, 0, 0, W, wallTop + 2, [C.roofR, C.roofRD, C.roofRL]);
    chimney(P, 34, 2, 9, S);
    // dormer window in the roof
    P.r(19, 8, 10, 9, C.cream); roof(P, 17, 4, 14, 6, [C.roofRD, shade(C.roofRD, -0.2), C.roofR]); win(P, 21, 11, 6, 5, C.woodDD, L);
    wall(P, 1, wallTop + 2, W - 2, 22, 'timber', [C.cream, C.creamD, C.creamL]);
    P.vl(16, wallTop + 2, 22, C.woodD); P.vl(31, wallTop + 2, 22, C.woodD);
    door(P, doorX('farmhouse'), H - 1, 8, 12, '#9a5a32', true);
    win(P, 5, wallTop + 7, 7, 7, C.woodDD, L); win(P, 36, wallTop + 7, 7, 7, C.woodDD, L);
    flowerBox(P, 4, wallTop + 16, 9); flowerBox(P, 35, wallTop + 16, 9);
    P.r(26, H - 7, 4, 6, '#7a8a9a'); P.hl(26, H - 7, 4, '#a8b8c8'); // milk can by the door
  }),
  cottage: () => make('cottage', 10, (P, W, H, L, S) => {
    const wallTop = H - 18;
    roof(P, 0, 0, W, wallTop + 2, [C.roofB, C.roofBD, C.roofBL]);
    chimney(P, 22, 1, 7, S);
    wall(P, 1, wallTop + 2, W - 2, 18, 'timber', [C.cream, C.creamD, C.creamL]);
    door(P, doorX('cottage'), H - 1, 7, 11, '#8a6a4a', true);
    win(P, 19, wallTop + 6, 7, 6, C.woodDD, L);
    flowerBox(P, 18, wallTop + 14, 9);
  }),
  barn: () => make('barn', 16, (P, W, H, L) => {
    const wallTop = H - 22;
    roof(P, 0, 0, W, wallTop + 2, [C.roofS, C.roofSD, C.roofSL], 'metal');
    // hayloft
    P.r(19, 5, 10, 9, C.woodDD); P.r(20, 6, 8, 8, '#e8c45a'); P.hl(20, 9, 8, '#c99a2e'); P.px(22, 7, '#fff0a0');
    wall(P, 1, wallTop + 2, W - 2, 22, 'plank', ['#c4483a', '#9a3329', '#da6a54']);
    P.r(1, wallTop + 2, W - 2, 1, C.white); P.vl(1, wallTop + 2, 22, C.white); P.vl(W - 2, wallTop + 2, 22, C.white);
    // big double door with white X
    const dx = doorX('barn') - 8;
    P.r(dx, H - 17, 16, 16, '#9a3329'); P.r(dx - 1, H - 18, 18, 1, C.white); P.vl(dx - 1, H - 18, 17, C.white); P.vl(dx + 16, H - 18, 17, C.white);
    P.vl(dx + 8, H - 17, 16, C.white); P.line(dx, H - 17, dx + 7, H - 2, C.white); P.line(dx + 7, H - 17, dx, H - 2, C.white);
    P.line(dx + 9, H - 17, dx + 15, H - 2, C.white); P.line(dx + 15, H - 17, dx + 9, H - 2, C.white);
    win(P, 5, wallTop + 7, 6, 6, C.white, L); win(P, 37, wallTop + 7, 6, 6, C.white, L);
  }),
  silo: () => make('silo', 28, (P, W, H) => {
    const x = 3, w = 26;
    P.oval(x, 0, w, 14, C.roofRD); P.oval(x + 1, 0, w - 2, 12, C.roofR); P.oval(x + 6, 2, 8, 4, C.roofRL);
    P.r(x, 7, w, H - 8, '#b8c4cc');
    P.r(x, 7, 5, H - 8, '#d8e2e8'); P.r(x + w - 5, 7, 5, H - 8, '#8a98a2');
    for (let y = 12; y < H - 2; y += 6) { P.hl(x, y, w, '#7a8892'); P.hl(x, y + 1, w, '#dce6ec'); }
    P.r(x + 2, 7, 22, 2, C.roofRD);
    door(P, doorX('silo') + 2, H - 1, 6, 9, '#7a8892');
    P.vl(x + w - 3, 14, H - 18, C.stoneDD); for (let y = 15; y < H - 4; y += 3) P.hl(x + w - 4, y, 3, C.stoneDD);
  }),
  crate: () => make('crate', 2, (P, W, H) => {
    P.r(1, 3, 14, 14, C.wood); P.r(1, 3, 14, 2, C.woodL); P.hl(1, 9, 14, C.woodD);
    P.line(2, 5, 13, 16, C.woodD); P.vl(1, 3, 14, C.woodD); P.vl(14, 3, 14, C.woodD);
    P.r(3, 0, 6, 4, C.gold); P.r(9, 1, 4, 3, C.red); P.px(4, 0, C.goldL);
  }),
  well: () => make('well', 14, (P, W, H) => {
    P.vl(2, 4, 16, C.woodD); P.vl(13, 4, 16, C.woodD);
    roof(P, 0, 0, 16, 7, [C.roofRD, shade(C.roofRD, -0.2), C.roofR]);
    P.hl(3, 8, 10, C.woodDD); P.vl(8, 8, 5, '#d9c49a'); P.r(6, 12, 5, 4, C.wood); P.hl(6, 12, 5, C.stoneDD);
    P.oval(0, 16, 16, 13, C.stoneD); P.oval(1, 16, 14, 10, C.stone); P.oval(3, 18, 10, 5, C.waterDD); P.px(6, 19, C.waterL);
    for (const [x, y] of [[1, 23], [5, 26], [10, 26], [13, 23]]) P.r(x, y, 3, 2, C.stoneL);
  }),
  sprinkler: () => make('sprinkler', 4, (P) => {
    P.oval(3, 13, 10, 6, C.stoneD); P.oval(4, 13, 8, 4, C.stone);
    P.r(7, 4, 2, 11, '#8a98a2'); P.vl(7, 4, 11, '#c8d4dc'); P.r(5, 3, 6, 2, '#6a7882'); P.px(4, 3, C.waterL); P.px(11, 3, C.waterL);
  }),
  market: () => make('market', 14, (P, W, H) => {
    P.vl(1, 6, H - 7, C.woodD); P.vl(W - 2, 6, H - 7, C.woodD);
    // striped awning
    for (let i = 0; i < W; i += 4) P.r(i, 2, 4, 9, (i / 4) % 2 ? C.white : C.red);
    P.hl(0, 2, W, C.redD);
    for (let i = 0; i < W; i += 4) { P.px(i + 1, 11, (i / 4) % 2 ? C.white : C.red); P.px(i + 2, 11, (i / 4) % 2 ? C.white : C.red); }
    P.r(2, 12, W - 4, H - 25, 'rgba(0,0,0,0)');
    // counter
    P.r(1, H - 14, W - 2, 13, C.wood); P.r(1, H - 14, W - 2, 2, C.woodL); for (let i = 4; i < W; i += 5) P.vl(i, H - 12, 11, C.woodD);
    // produce crates
    const goods = [[3, C.red], [10, C.orange], [17, C.yellow], [24, '#8b4ab0']];
    for (const [x, c] of goods) { P.r(x, H - 18, 6, 4, C.woodD); for (let i = 0; i < 3; i++) P.r(x + i * 2, H - 20, 2, 2, c); }
    P.r(12, 13, 9, 6, C.cream); P.hl(13, 15, 7, C.woodD); P.px(16, 17, C.gold);
  }),
  board: () => make('board', 10, (P) => {
    P.vl(2, 6, 20, C.woodD); P.vl(13, 6, 20, C.woodD);
    P.r(0, 2, 16, 3, C.roofTD); P.hl(0, 2, 16, C.roofTL);
    P.r(1, 5, 14, 12, C.wood); P.r(2, 6, 12, 10, '#c9935a');
    P.r(3, 7, 4, 4, C.cream); P.r(8, 8, 5, 4, C.white); P.r(4, 12, 4, 3, '#f6e7a8');
    P.px(5, 7, C.red); P.px(10, 8, C.red); P.hl(9, 10, 3, C.stoneD); P.hl(4, 9, 2, C.stoneD);
  }),
  mill: () => make('mill', 26, (P, W, H, L) => {
    // tapered stone tower
    for (let y = 8; y < H - 1; y++) {
      const inset = Math.round(((H - y) / H) * 6);
      P.hl(3 + inset, y, W - 6 - inset * 2, C.stone);
      P.px(3 + inset, y, C.stoneL); P.px(W - 4 - inset, y, C.stoneD);
    }
    for (let y = 12; y < H - 2; y += 4) for (let x = 6; x < W - 6; x += 5) P.hl(x + (y % 8 ? 2 : 0), y, 3, C.stoneD);
    P.oval(6, 0, 20, 12, C.roofTD); P.oval(7, 0, 18, 10, C.roofT); P.oval(10, 1, 6, 3, C.roofTL);
    door(P, doorX('mill') + 4, H - 1, 7, 11, C.woodD, true);
    win(P, 19, 22, 4, 5, C.woodDD, L);
    P.r(22, H - 7, 6, 6, '#efe6d2'); P.hl(22, H - 7, 6, '#c9b48a'); // flour sack
  }),
  bakery: () => make('bakery', 14, (P, W, H, L, S) => {
    const wallTop = H - 22;
    roof(P, 0, 0, W, wallTop + 2, [C.roofT, C.roofTD, C.roofTL]);
    chimney(P, 37, 0, 9, S);
    wall(P, 1, wallTop + 2, W - 2, 22, 'brick', [C.brick, C.brickD, C.brickL]);
    door(P, doorX('bakery'), H - 1, 8, 12, '#7a4a2a', true);
    // display window with bread
    P.r(3, wallTop + 6, 14, 10, C.woodDD); P.r(4, wallTop + 7, 12, 8, C.glow); L.push([4, wallTop + 7, 12, 8]);
    P.r(5, wallTop + 11, 4, 3, '#d98f45'); P.r(10, wallTop + 11, 5, 3, '#c97a35'); P.hl(4, wallTop + 14, 12, C.woodD);
    win(P, 34, wallTop + 7, 8, 7, C.woodDD, L);
    // sign
    P.r(17, wallTop - 4, 14, 6, C.cream); P.r(21, wallTop - 3, 6, 3, '#d98f45'); P.px(22, wallTop - 3, '#f6c27a');
    // awning
    for (let i = 2; i < 18; i += 3) P.r(i, wallTop + 3, 3, 2, (i % 2) ? C.cream : C.roofR);
  }),
  press: () => make('press', 12, (P, W, H, L) => {
    const wallTop = H - 19;
    roof(P, 0, 0, W, wallTop + 2, [C.roofG, C.roofGD, C.roofGL]);
    wall(P, 1, wallTop + 2, W - 2, 19, 'plank', [C.woodL, C.wood, '#e0a868']);
    door(P, doorX('press'), H - 1, 7, 11, C.woodD);
    win(P, 18, wallTop + 6, 6, 5, C.woodDD, L);
    barrel(P, 24, H - 9);
    P.r(17, H - 6, 6, 5, '#f2cf55'); P.hl(17, H - 6, 6, C.woodD);
  }),
  kitchen: () => make('kitchen', 12, (P, W, H, L, S) => {
    const wallTop = H - 19;
    roof(P, 0, 0, W, wallTop + 2, [C.roofR, C.roofRD, C.roofRL]);
    chimney(P, 4, 0, 7, S);
    wall(P, 1, wallTop + 2, W - 2, 19, 'timber', ['#fbe8e0', '#e8c8bc', '#fff4f0']);
    door(P, doorX('kitchen'), H - 1, 7, 11, '#b8604a', true);
    win(P, 18, wallTop + 7, 9, 6, C.woodDD, L);
    for (let i = 16; i < 30; i += 3) P.r(i, wallTop + 3, 3, 3, (i % 2) ? C.pink : C.white);
    for (const [x, c] of [[18, '#d62f4b'], [22, '#4a4fb8'], [26, '#a3123a']]) { P.r(x, wallTop + 15, 3, 3, c); P.hl(x, wallTop + 14, 3, C.white); }
  }),
  dairy: () => make('dairy', 12, (P, W, H, L) => {
    const wallTop = H - 19;
    roof(P, 0, 0, W, wallTop + 2, [C.roofB, C.roofBD, C.roofBL]);
    wall(P, 1, wallTop + 2, W - 2, 19, 'plank', [C.white, C.whiteD, '#ffffff']);
    P.hl(1, wallTop + 10, W - 2, C.roofB);
    door(P, doorX('dairy'), H - 1, 7, 11, C.roofBD);
    win(P, 19, wallTop + 4, 6, 5, C.roofBD, L);
    for (const x of [18, 24]) { P.r(x, H - 8, 5, 7, '#a8b8c8'); P.hl(x, H - 8, 5, '#d8e4ee'); P.r(x + 1, H - 10, 3, 2, '#8898a8'); }
  }),
  brewery: () => make('brewery', 18, (P, W, H, L, S) => {
    const wallTop = H - 22;
    roof(P, 0, 4, W, wallTop - 2, [C.roofT, C.roofTD, C.roofTL]);
    // copper kettle dome
    P.oval(30, 0, 14, 12, '#b8643a'); P.oval(31, 1, 12, 9, '#d8844a'); P.oval(33, 2, 4, 3, '#f0b07a'); P.r(36, 0, 2, 2, '#8a4a2a'); S.push([37, -1]);
    wall(P, 1, wallTop + 2, W - 2, 22, 'stone', [C.stone, C.stoneD, C.stoneL]);
    P.hl(1, wallTop + 3, W - 2, C.woodD);
    door(P, doorX('brewery'), H - 1, 9, 13, C.woodD, true);
    win(P, 5, wallTop + 7, 6, 7, C.woodDD, L); win(P, 36, wallTop + 7, 6, 7, C.woodDD, L);
    barrel(P, 4, H - 9); barrel(P, 11, H - 9); barrel(P, 38, H - 9);
  }),
  winery: () => make('winery', 16, (P, W, H, L) => {
    const wallTop = H - 22;
    roof(P, 0, 0, W, wallTop + 2, [C.roofP, C.roofPD, C.roofPL]);
    wall(P, 1, wallTop + 2, W - 2, 22, 'stone', ['#d8c8a8', '#b0a080', '#ece0c4']);
    door(P, doorX('winery'), H - 1, 10, 14, '#6a3a5a', true);
    P.px(19, H - 15, '#b0a080'); P.px(28, H - 15, '#b0a080');
    win(P, 5, wallTop + 7, 6, 7, C.woodDD, L); win(P, 37, wallTop + 7, 6, 7, C.woodDD, L);
    // vine over the wall
    for (let x = 2; x < W - 2; x += 2) P.px(x, wallTop + 3 + ((noise(x, 1, 1) * 2) | 0), C.leaf);
    for (const x of [7, 15, 33, 41]) { P.r(x, wallTop + 4, 2, 2, '#8b4ab0'); P.px(x, wallTop + 4, '#b27ad6'); }
    barrel(P, 38, H - 9); barrel(P, 3, H - 9);
  }),
  loom: () => make('loom', 12, (P, W, H, L) => {
    const wallTop = H - 19;
    roof(P, 0, 0, W, wallTop + 2, [C.roofP, C.roofPD, C.roofPL]);
    wall(P, 1, wallTop + 2, W - 2, 19, 'timber', ['#e0e8f4', '#c0c8d8', '#f4f8ff']);
    door(P, doorX('loom'), H - 1, 7, 11, '#5a6a9a', true);
    win(P, 19, wallTop + 6, 7, 6, C.woodDD, L);
    P.r(17, H - 7, 5, 6, '#e98aa8'); P.hl(17, H - 5, 5, '#c96a88'); P.r(23, H - 7, 5, 6, '#e9e4f0'); P.hl(23, H - 5, 5, '#c0b8d0');
  }),
  coop: () => make('coop', 10, (P, W, H, L) => {
    P.vl(3, H - 8, 8, C.woodD); P.vl(28, H - 8, 8, C.woodD);
    const wallTop = H - 20;
    roof(P, 1, 2, W - 2, wallTop, [C.roofR, C.roofRD, C.roofRL]);
    wall(P, 2, wallTop + 2, W - 4, 13, 'plank', [C.woodL, C.wood, '#e0a868']);
    P.r(4, wallTop + 5, 6, 5, C.woodDD); P.r(5, wallTop + 6, 4, 4, '#3a2a20'); P.px(6, wallTop + 8, '#f2e0b0');
    win(P, 20, wallTop + 5, 5, 4, C.woodDD, L);
    // ramp to the door
    P.line(4, H - 1, 10, H - 6, C.woodD); P.line(5, H - 1, 11, H - 6, C.wood);
    P.r(14, H - 5, 10, 4, '#e8c45a'); P.hl(14, H - 5, 10, '#f6dc7a');
  }),
  cowshed: () => make('cowshed', 14, (P, W, H, L) => {
    const wallTop = H - 22;
    roof(P, 0, 0, W, wallTop + 2, [C.roofG, C.roofGD, C.roofGL], 'metal');
    wall(P, 1, wallTop + 2, W - 2, 22, 'plank', ['#9a6a42', '#7a4f2e', '#b8845a']);
    const dx = doorX('cowshed') - 7;
    P.r(dx, H - 14, 14, 13, '#3a2a20'); P.r(dx, H - 8, 14, 7, '#7a4f2e'); P.hl(dx, H - 8, 14, C.woodL); P.line(dx, H - 8, dx + 13, H - 2, C.woodL);
    P.r(dx + 2, H - 13, 10, 4, '#e8c45a');
    win(P, 5, wallTop + 7, 6, 5, C.woodDD, L); win(P, 37, wallTop + 7, 6, 5, C.woodDD, L);
    P.r(38, H - 6, 8, 5, '#e8c45a'); P.hl(38, H - 6, 8, '#f6dc7a');
  }),
  sheeppen: () => make('sheeppen', 12, (P, W, H) => {
    const top = 2;
    P.vl(2, top + 8, H - top - 9, C.woodD); P.vl(W - 3, top + 8, H - top - 9, C.woodD); P.vl(22, top + 8, H - top - 18, C.woodD);
    roof(P, 0, top, W, 12, ['#d9b65a', '#b8943a', '#ecd07a'], 'thatch');
    P.r(3, top + 12, W - 6, H - top - 24, '#5a4030');
    P.r(4, H - 16, 16, 6, '#e8c45a'); P.hl(4, H - 16, 16, '#f6dc7a');
    // front fence
    for (let x = 1; x < W - 1; x += 5) P.vl(x, H - 9, 8, C.woodL);
    P.hl(0, H - 7, W, C.wood); P.hl(0, H - 4, W, C.wood);
    P.r(doorX('sheeppen') - 3, H - 9, 7, 8, 'rgba(0,0,0,0)');
  }),
  beehive: () => make('beehive', 6, (P) => {
    P.vl(3, 16, 5, C.woodD); P.vl(12, 16, 5, C.woodD);
    P.r(1, 4, 14, 2, C.woodL); P.hl(1, 4, 14, '#e0a868');
    P.r(2, 6, 12, 5, C.white); P.hl(2, 10, 12, C.whiteD);
    P.r(2, 11, 12, 5, '#f4e8c8'); P.hl(2, 15, 12, C.creamD);
    P.r(6, 14, 4, 1, '#3a2a20'); P.px(4, 12, C.gold); P.vl(12, 12, 3, C.gold);
  }),
  pickler: () => make('pickler', 12, (P, W, H, L) => {
    const wallTop = H - 19;
    roof(P, 0, 0, W, wallTop + 2, ['#6a8a4a', '#4f6e38', '#8aaa62']);
    wall(P, 1, wallTop + 2, W - 2, 19, 'plank', ['#b88a5a', '#8e6438', '#d4a878']);
    door(P, doorX('pickler'), H - 1, 7, 11, C.woodD);
    win(P, 19, wallTop + 6, 6, 5, C.woodDD, L);
    // crocks out front
    for (const [x, c] of [[17, '#c9a070'], [23, '#a87850']]) { P.rr(x, H - 8, 6, 7, c); P.hl(x + 1, H - 8, 4, '#6a4a30'); P.hl(x, H - 5, 6, shade(c, -0.2)); }
    P.r(27, H - 6, 3, 5, '#6a9a3a'); P.hl(27, H - 6, 3, '#d8a040');
  }),
  cookhouse: () => make('cookhouse', 14, (P, W, H, L, S) => {
    const wallTop = H - 21;
    roof(P, 0, 0, W, wallTop + 2, ['#b8603a', '#8e4428', '#d47a50']);
    chimney(P, 8, 0, 9, S); chimney(P, 34, 1, 8, S);
    wall(P, 1, wallTop + 2, W - 2, 21, 'log', ['#a8784a', '#7e542e', '#c8965e']);
    door(P, doorX('cookhouse'), H - 1, 8, 12, '#6a3a20', true);
    win(P, 5, wallTop + 6, 7, 6, C.woodDD, L); win(P, 36, wallTop + 6, 7, 6, C.woodDD, L);
    // big pot on a fire out front
    P.oval(32, H - 6, 10, 5, '#3a3440'); P.hl(33, H - 6, 8, '#6a6470'); P.px(35, H - 1, C.orange); P.px(38, H - 1, C.yellow);
    P.r(17, wallTop - 3, 14, 5, C.cream); P.oval(21, wallTop - 3, 6, 4, '#9a5a32');
  }),
  sweets: () => make('sweets', 12, (P, W, H, L) => {
    const wallTop = H - 19;
    roof(P, 0, 0, W, wallTop + 2, ['#e07ba5', '#b85a84', '#f6a8c8']);
    wall(P, 1, wallTop + 2, W - 2, 19, 'plank', ['#fbf0e0', '#e0d0b8', '#ffffff']);
    for (let i = 1; i < W - 1; i += 4) P.r(i, wallTop + 2, 2, 19, '#f8d8e4');
    for (let i = 1; i < W - 1; i += 4) P.r(i, wallTop + 3, 4, 2, (i / 4) % 2 ? C.pink : C.white);
    door(P, doorX('sweets'), H - 1, 7, 11, '#b85a84', true);
    P.r(17, wallTop + 7, 12, 8, C.woodDD); P.r(18, wallTop + 8, 10, 6, C.glow); L.push([18, wallTop + 8, 10, 6]);
    for (const [x, c] of [[19, '#f06090'], [22, '#f4c030'], [25, '#7ac0f0']]) { P.r(x, wallTop + 10, 2, 3, c); P.px(x, wallTop + 9, '#ffffff'); }
  }),
  smokehouse: () => make('smokehouse', 16, (P, W, H, L, S) => {
    const wallTop = H - 18;
    roof(P, 0, 4, W, wallTop - 2, ['#5a5560', '#45404a', '#77727e'], 'metal');
    chimney(P, 13, 0, 8, S);
    wall(P, 1, wallTop + 2, W - 2, 18, 'stone', [C.stone, C.stoneD, C.stoneL]);
    door(P, doorX('smokehouse'), H - 1, 7, 11, C.woodD);
    win(P, 20, wallTop + 6, 5, 4, C.woodDD, L);
    P.r(17, H - 6, 12, 5, C.woodD); for (let x = 18; x < 29; x += 2) P.r(x, H - 6, 1, 2, C.woodL);
  }),
  teahouse: () => make('teahouse', 18, (P, W, H, L) => {
    const wallTop = H - 20;
    // curved two-tier roof
    roof(P, 6, 0, W - 12, 10, ['#3f7a5a', '#2f5e44', '#5a9a74']);
    roof(P, 0, 8, W, wallTop - 6, ['#3f7a5a', '#2f5e44', '#5a9a74']);
    P.px(0, wallTop + 1, '#5a9a74'); P.px(W - 1, wallTop + 1, '#5a9a74');
    wall(P, 1, wallTop + 2, W - 2, 20, 'timber', ['#f4ead4', '#d8c8a8', '#fff8e8']);
    door(P, doorX('teahouse'), H - 1, 9, 12, '#7a3a2a', true);
    win(P, 5, wallTop + 6, 8, 6, '#7a3a2a', L); win(P, 35, wallTop + 6, 8, 6, '#7a3a2a', L);
    for (const x of [3, 44]) { P.r(x, wallTop + 2, 2, 4, '#e0503a'); P.px(x, wallTop + 6, C.gold); }
  }),
  duckhouse: () => make('duckhouse', 8, (P, W, H, L) => {
    const wallTop = H - 18;
    roof(P, 1, 0, W - 2, wallTop + 2, ['#d9b65a', '#b8943a', '#ecd07a'], 'thatch');
    wall(P, 3, wallTop + 2, W - 6, 12, 'plank', ['#9ac0d8', '#78a0b8', '#b8d8ec']);
    P.oval(6, wallTop + 5, 6, 6, '#3a2a20');
    win(P, 20, wallTop + 6, 5, 4, C.woodDD, L);
    // little pond tub
    P.oval(14, H - 6, 16, 6, C.stoneD); P.oval(15, H - 6, 14, 4, C.water); P.px(18, H - 5, C.waterL);
  }),
  dock: () => make('dock', 10, (P, W, H, L) => {
    const wallTop = H - 22;
    roof(P, 2, 0, 20, wallTop + 2, ['#8a6a4a', '#6a4e34', '#a8845e']);
    wall(P, 3, wallTop + 2, 18, 14, 'plank', ['#b88a5a', '#8e6438', '#d4a878']);
    win(P, 13, wallTop + 6, 5, 4, C.woodDD, L);
    door(P, doorX('dock'), H - 7, 6, 9, C.woodD);
    // pier planks to the side and a fishing rod
    for (let x = 20; x < W; x += 3) { P.r(x, H - 10, 3, 9, C.woodL); P.vl(x + 2, H - 10, 9, C.woodD); }
    P.vl(23, H - 1, 1, C.woodDD); P.vl(29, H - 1, 1, C.woodDD);
    P.line(26, H - 11, 31, H - 22, C.woodD); P.line(31, H - 22, 31, H - 12, '#e8e8e8');
    P.r(4, H - 6, 6, 5, C.wood); P.hl(4, H - 6, 6, C.woodL); P.r(5, H - 8, 3, 2, '#6a9ac8');
  }),
  bigsprinkler: () => make('bigsprinkler', 8, (P) => {
    P.oval(1, 15, 14, 7, C.stoneD); P.oval(2, 15, 12, 5, C.stone);
    P.r(6, 3, 4, 14, '#8a98a2'); P.vl(6, 3, 14, '#c8d4dc');
    P.r(2, 2, 12, 2, '#6a7882'); P.r(1, 1, 2, 2, '#5f9ad0'); P.r(13, 1, 2, 2, '#5f9ad0'); P.r(7, 0, 2, 2, '#5f9ad0');
  }),
};

export function buildingSprite(type) {
  return cached(`bld:${type}`, () => (DRAW[type] || DRAW.crate)());
}

/** Mill sails at one of 8 angles (frame 0..7). */
export function millSails(frame, small = false) {
  return cached(`sails:${frame}:${small}`, () => {
    const S = small ? 18 : 34, R = small ? 8 : 16;
    const cv = canvas(S, S);
    const P = pen(cv);
    const c = S / 2;
    for (let k = 0; k < 4; k++) {
      const a = (frame / 8) * (Math.PI / 2) + (k * Math.PI) / 2;
      const ex = c + Math.cos(a) * R, ey = c + Math.sin(a) * R;
      P.line(c, c, ex, ey, C.woodD);
      // sail cloth beside each arm
      const px = Math.cos(a + Math.PI / 2), py = Math.sin(a + Math.PI / 2);
      for (let t = 0.35; t <= 1; t += 0.08) {
        const x = c + Math.cos(a) * R * t, y = c + Math.sin(a) * R * t;
        P.line(x, y, x + px * (small ? 2 : 4), y + py * (small ? 2 : 4), t > 0.9 ? C.whiteD : C.cream);
      }
    }
    P.r(c - 1, c - 1, 3, 3, C.woodDD);
    outline(cv);
    return cv;
  });
}
