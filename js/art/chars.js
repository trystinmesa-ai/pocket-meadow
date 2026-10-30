// Farmhands (12x16 frames) and farm animals, drawn per look and cached.
import { C, sprite, cached, shade, flipX } from './core.js';

const EYE = '#2a1e24', SHOE = '#4a3020', BLUSH = '#f2a0a0';
const HATS = {
  straw: { c: '#ecc95c', d: '#c99a32', band: '#d9534f' },
  cap: { c: '#4f7fd0', d: '#36589a' },
  bandana: { c: '#f4f0e6', d: '#d8d0c0', dot: '#d9534f' },
  wide: { c: '#8a5a32', d: '#6a3f22', band: '#3e2a1e' },
};

// Unlockable hats (drawn over the head; y = top of head - 2).
const FANCY = {
  flowercrown(P, dir, y) { P.hl(3, y + 2, 6, C.leaf); for (const [x, c] of [[3, C.pink], [5, C.yellow], [7, C.red], [8, C.white]]) P.px(x, y + 1, c); },
  chef(P, dir, y) { P.r(3, y - 2, 6, 5, C.white); P.r(2, y - 3, 8, 2, C.white); P.hl(3, y + 2, 6, C.whiteD); P.px(4, y - 2, '#e8e4d8'); },
  beanie(P, dir, y) { P.r(3, y, 6, 4, '#d9534f'); P.hl(3, y + 3, 6, '#f4efe6'); P.r(5, y - 2, 2, 2, '#f4efe6'); P.px(4, y + 1, '#e8806f'); },
  buckethat(P, dir, y) { P.r(3, y, 6, 3, '#a8b870'); P.hl(2, y + 3, 8, '#8a9a58'); P.hl(4, y, 4, '#c0d088'); },
  beekeeper(P, dir, y) { P.r(2, y + 1, 8, 2, '#f4efe6'); P.r(3, y - 1, 6, 2, '#f4efe6'); P.r(2, y + 3, 1, 4, 'rgba(240,240,240,0.7)'); P.r(9, y + 3, 1, 4, 'rgba(240,240,240,0.7)'); },
  beret(P, dir, y) { P.r(2, y + 1, 8, 2, '#7a3a6a'); P.r(3, y, 5, 1, '#7a3a6a'); P.px(6, y - 1, '#5a2a4a'); P.hl(3, y + 3, 6, '#5a2a4a'); },
  froghat(P, dir, y) { P.r(3, y, 6, 4, '#6aae5a'); P.r(2, y - 1, 3, 3, '#7cc06a'); P.r(7, y - 1, 3, 3, '#7cc06a'); if (dir !== 'u') { P.px(3, y, C.ol); P.px(8, y, C.ol); } P.hl(3, y + 3, 6, '#4a8a3a'); },
  pumpkinhat(P, dir, y) { P.rr(2, y - 1, 8, 5, C.orange); P.vl(5, y - 1, 5, C.orangeD); P.r(5, y - 3, 2, 2, C.leafD); },
  mushroomcap(P, dir, y) { P.rr(1, y - 1, 10, 5, C.red); P.px(3, y, C.white); P.px(7, y - 1, C.white); P.px(8, y + 1, C.white); P.px(5, y + 2, C.white); },
  tophat(P, dir, y) { P.r(3, y - 4, 6, 7, '#2e2a36'); P.hl(3, y + 1, 6, '#d9534f'); P.hl(1, y + 3, 10, '#2e2a36'); P.vl(4, y - 3, 4, '#4a4458'); },
  wizard(P, dir, y) { P.r(4, y - 2, 4, 3, '#4a4fb8'); P.r(5, y - 4, 2, 2, '#4a4fb8'); P.px(6, y - 5, '#4a4fb8'); P.hl(1, y + 2, 10, '#4a4fb8'); P.hl(2, y + 3, 8, '#383c90'); P.px(5, y, C.gold); P.px(6, y - 3, C.gold); },
  bunnyears(P, dir, y) { P.r(3, y - 5, 2, 6, '#f4efe6'); P.r(7, y - 5, 2, 6, '#f4efe6'); P.px(3, y - 4, '#f2a0b8'); P.px(7, y - 4, '#f2a0b8'); P.hl(3, y + 1, 6, '#f2a0b8'); },
  sunhat(P, dir, y) { P.r(3, y - 1, 6, 3, '#f6e7a8'); P.hl(3, y + 1, 6, '#5fb3c8'); P.hl(0, y + 2, 12, '#f6e7a8'); P.hl(1, y + 3, 10, '#d8c078'); P.px(8, y, C.pink); },
  acornhat(P, dir, y) { P.rr(2, y - 1, 8, 4, '#8a5a32'); for (let x = 3; x < 9; x += 2) P.px(x, y, '#6a3f22'); P.r(5, y - 3, 2, 2, '#5a3a20'); },
  earmuffs(P, dir, y) { P.hl(3, y, 6, '#6a6478'); P.r(1, y + 2, 3, 4, '#e8606a'); P.r(8, y + 2, 3, 4, '#e8606a'); P.px(1, y + 2, '#ff9aa0'); },
  crown(P, dir, y) { P.r(3, y, 6, 3, C.gold); P.px(3, y - 1, C.gold); P.px(5, y - 1, C.gold); P.px(6, y - 1, C.gold); P.px(8, y - 1, C.gold); P.px(5, y + 1, C.red); P.hl(3, y + 2, 6, C.goldD); },
};

function hat(P, kind, dir, b) {
  if (FANCY[kind]) { FANCY[kind](P, dir, b + 1); return; }
  const h = HATS[kind];
  if (!h) return;
  const y = b;
  if (kind === 'straw') {
    P.r(3, y, 6, 3, h.c); P.hl(3, y + 2, 6, h.band); P.hl(4, y, 4, shade(h.c, 0.25));
    P.hl(1, y + 3, 10, h.c); P.hl(1, y + 4, 10, h.d);
  } else if (kind === 'wide') {
    P.r(3, y, 6, 3, h.c); P.hl(3, y + 2, 6, h.band); P.px(5, y, h.d); P.px(6, y, h.d);
    P.hl(0, y + 3, 12, h.c); P.hl(1, y + 4, 10, h.d);
  } else if (kind === 'cap') {
    P.r(3, y + 1, 6, 3, h.c); P.hl(4, y + 1, 3, shade(h.c, 0.3)); P.px(6, y, h.d);
    if (dir === 'd') P.hl(2, y + 4, 8, h.d);
    else if (dir === 'r') P.r(8, y + 3, 3, 1, h.d);
  } else if (kind === 'bandana') {
    P.r(3, y + 1, 6, 2, h.c); P.hl(3, y + 3, 6, h.d); P.px(4, y + 1, h.dot); P.px(7, y + 2, h.dot);
    if (dir !== 'd') { P.px(dir === 'r' ? 2 : 9, y + 3, h.c); P.px(dir === 'r' ? 2 : 9, y + 4, h.d); }
  }
}

function head(P, L, dir, b, blink) {
  const sk = L.skin, hr = L.hair, hrD = shade(L.hair, -0.25);
  const y = 2 + b;
  P.r(3, y, 6, 6, sk);
  if (dir === 'u') {
    P.r(3, y, 6, 6, hr); P.hl(3, y + 5, 6, hrD);
    if (L.style === 1) { P.r(3, y + 5, 6, 2, hr); }
    if (L.style === 2) { P.r(5, y - 2, 2, 2, hr); }
  } else if (dir === 'd') {
    P.r(3, y, 6, 2, hr); P.px(3, y + 2, hr); P.px(8, y + 2, hr);
    if (L.style === 1) { P.vl(2, y + 1, 6, hr); P.vl(9, y + 1, 6, hr); P.vl(3, y + 2, 4, hrD); P.vl(8, y + 2, 4, hrD); }
    if (L.style === 2) { P.r(5, y - 2, 2, 2, hr); }
    if (L.style === 3) { P.hl(2, y, 8, hr); P.px(2, y + 1, hr); P.px(9, y + 1, hr); P.px(4, y + 2, hr); }
    if (!blink) { P.px(4, y + 3, EYE); P.px(7, y + 3, EYE); P.px(4, y + 2, shade(sk, -0.1)); }
    else { P.px(4, y + 3, shade(sk, -0.3)); P.px(7, y + 3, shade(sk, -0.3)); }
    P.px(4, y + 4, BLUSH); P.px(7, y + 4, BLUSH);
  } else { // right
    P.r(3, y, 6, 2, hr); P.r(3, y + 2, 3, 2, hr); P.px(3, y + 4, hr);
    if (L.style === 1) { P.vl(3, y + 2, 6, hr); P.vl(2, y + 2, 5, hrD); }
    if (L.style === 2) { P.r(2, y + 1, 2, 2, hr); }
    if (L.style === 3) { P.hl(3, y - 1, 5, hr); P.px(2, y + 1, hr); }
    P.px(9, y + 3, sk);
    if (!blink) P.px(7, y + 3, EYE); else P.px(7, y + 3, shade(sk, -0.3));
    P.px(7, y + 4, BLUSH);
  }
}

/**
 * pose: walk | idle | carry | work | crouch | sit ; f = frame
 */
function body(P, L, hatKind, dir, pose, f) {
  const sh = L.shirt, shD = shade(L.shirt, -0.22), pa = L.pants, paD = shade(L.pants, -0.25), sk = L.skin;
  const walking = pose === 'walk' || pose === 'carry';
  const low = pose === 'crouch' || pose === 'sit' ? 2 : 0;
  const b = (walking && (f === 1 || f === 3) ? 1 : 0) + (pose === 'work' && f === 1 ? 1 : 0) + low;
  // legs
  if (pose === 'sit') {
    P.r(4, 13, 4, 1, pa); if (dir === 'd') { P.r(4, 14, 2, 1, SHOE); P.r(6, 14, 2, 1, SHOE); } else P.r(6, 14, 4, 1, SHOE);
  } else if (pose === 'crouch') {
    P.r(4, 14, 2, 1, pa); P.r(6, 14, 2, 1, pa); P.r(4, 15, 2, 1, SHOE); P.r(6, 15, 2, 1, SHOE);
  } else if (dir === 'r') {
    const spread = walking && (f === 1 || f === 3);
    if (spread) { P.r(4, 13, 1, 2, paD); P.px(4, 15, SHOE); P.px(3, 15, SHOE); P.r(7, 13, 1, 2, pa); P.r(7, 15, 2, 1, SHOE); }
    else { P.r(5, 13, 2, 2, pa); P.r(5, 15, 3, 1, SHOE); }
  } else {
    const liftL = walking && f === 1, liftR = walking && f === 3;
    P.r(4, 13, 2, liftL ? 1 : 2, pa); P.r(4, liftL ? 14 : 15, 2, 1, SHOE);
    P.r(6, 13, 2, liftR ? 1 : 2, paD); P.r(6, liftR ? 14 : 15, 2, 1, SHOE);
  }
  // torso
  const ty = 8 + b;
  P.r(3, ty + 3, 6, 2 - (low ? 1 : 0), pa); // pants top / belt line
  if (dir === 'r') {
    P.r(4, ty, 5, 4, sh); P.vl(4, ty, 4, shD);
  } else {
    P.r(3, ty, 6, 4, sh); P.vl(8, ty, 4, shD);
    if (dir === 'd') { P.px(5, ty, shade(sh, 0.25)); P.px(6, ty, shade(sh, 0.25)); }
  }
  // arms
  if (pose === 'carry') {
    if (dir === 'r') { P.r(6, ty - 4, 2, 4, sh); P.r(6, ty - 5, 2, 1, sk); }
    else { P.r(2, ty - 4, 1, 4, sh); P.r(9, ty - 4, 1, 4, sh); P.px(2, ty - 5, sk); P.px(9, ty - 5, sk); }
  } else if (pose === 'work' || pose === 'crouch') {
    if (dir === 'r') { P.r(7, ty + 1, 3, 1, sh); P.px(10, ty + 1, sk); }
    else { P.r(2, ty + 1, 1, 2, sh); P.r(9, ty + 1, 1, 2, sh); P.px(3, ty + 3, sk); P.px(8, ty + 3, sk); }
  } else if (dir === 'r') {
    const sw = walking ? (f === 1 ? 1 : f === 3 ? -1 : 0) : 0;
    P.r(6 + sw, ty + 1, 2, 2, shD); P.px(6 + sw + (sw > 0 ? 1 : 0), ty + 3, sk);
  } else {
    const sw = walking ? (f === 1 ? 1 : f === 3 ? -1 : 0) : 0;
    P.r(2, ty + Math.max(0, sw), 1, 3, sh); P.px(2, ty + 3 + Math.max(0, sw), sk);
    P.r(9, ty + Math.max(0, -sw), 1, 3, shD); P.px(9, ty + 3 + Math.max(0, -sw), sk);
  }
  head(P, L, dir, b, pose === 'idle' && f === 1);
  hat(P, hatKind, dir, b);
}

export function workerFrame(look, hatKind, dir, pose, f) {
  const key = `w:${look.skin}${look.hair}${look.shirt}${look.pants}${look.style}:${hatKind}:${dir}:${pose}:${f}`;
  return cached(key, () => {
    if (dir === 'l') return flipX(workerFrame(look, hatKind, 'r', pose, f));
    return sprite(12, 16, (P) => body(P, look, hatKind, dir, pose, f));
  });
}

// ---------- tools held while working ----------
const TOOLS = {
  hoe: [(P) => { P.vl(2, 0, 10, C.woodL); P.r(0, 0, 4, 2, C.stoneD); }, (P) => { P.line(0, 3, 8, 9, C.woodL); P.r(8, 8, 2, 4, C.stoneD); }],
  sickle: [(P) => { P.vl(5, 5, 5, C.woodD); P.line(5, 5, 2, 1, C.stoneL); P.line(2, 1, 5, 0, C.stoneL); }, (P) => { P.hl(0, 7, 5, C.woodD); P.line(5, 7, 9, 4, C.stoneL); P.line(9, 4, 8, 1, C.stoneL); }],
  can: [(P) => { P.r(1, 3, 6, 5, '#5f9ad0'); P.hl(1, 3, 6, '#8ac0f0'); P.line(7, 4, 9, 2, '#5f9ad0'); P.r(2, 1, 3, 2, '#3f6a9a'); },
    (P) => { P.r(0, 2, 6, 5, '#5f9ad0'); P.hl(0, 2, 6, '#8ac0f0'); P.line(6, 5, 8, 7, '#5f9ad0'); P.px(9, 9, C.waterL); P.px(8, 11, C.waterL); P.px(10, 11, C.water); }],
  basket: [(P) => { P.rr(0, 2, 8, 5, '#c9944a'); P.hl(0, 2, 8, '#e0b06a'); P.line(1, 2, 4, 0, '#a8743a'); P.line(4, 0, 7, 2, '#a8743a'); },
    (P) => { P.rr(0, 3, 8, 5, '#c9944a'); P.hl(0, 3, 8, '#e0b06a'); P.line(1, 3, 4, 1, '#a8743a'); P.line(4, 1, 7, 3, '#a8743a'); }],
};
export function toolSprite(tool, f) {
  return cached(`tool:${tool}:${f}`, () => sprite(11, 12, TOOLS[tool][f % 2]));
}

// ---------- animals (facing right; flip for left) ----------
const ANIMALS = {
  chicken: [9, 8, (P, f) => {
    const peck = f === 2;
    P.oval(1, 2, 6, 5, C.white); P.r(0, 2, 2, 2, C.white); P.px(0, 1, C.whiteD);
    P.hl(2, 5, 4, C.whiteD); P.px(3, 3, '#e8e4d8');
    if (peck) { P.r(6, 4, 2, 2, C.white); P.px(8, 5, C.orange); P.px(7, 3, C.red); }
    else { P.r(5, 0, 3, 3, C.white); P.px(6, 0, C.red); P.px(7, 0, C.red); P.px(8, 2, C.orange); P.px(7, 1, EYE); P.px(7, 3, C.red); }
    P.px(3 + (f === 1 ? 1 : 0), 7, C.orange); P.px(5 - (f === 1 ? 1 : 0), 7, C.orange);
  }],
  cow: [18, 13, (P, f) => {
    P.r(2, 2, 12, 7, C.white); P.r(3, 1, 10, 1, C.white);
    P.r(4, 2, 4, 3, '#3a2e2e'); P.r(10, 5, 3, 3, '#3a2e2e'); P.px(6, 7, '#3a2e2e');
    P.hl(2, 8, 12, C.whiteD);
    P.r(13, 1, 4, 5, C.white); P.r(14, 4, 4, 3, '#f2b0b8'); P.px(16, 5, '#c97a84'); P.px(15, 2, EYE); P.px(13, 0, C.creamD); P.px(16, 0, C.creamD);
    P.px(1, 3, '#3a2e2e'); P.vl(0, 3, 3, C.white);
    const a = f === 1 ? 1 : 0;
    for (const [x, o] of [[3, a], [5, -a], [10, -a], [12, a]]) { P.r(x + o, 9, 2, 3, C.white); P.r(x + o, 12, 2, 1, '#3a2e2e'); }
    P.r(7, 9, 3, 1, '#f2b0b8');
  }],
  duck: [10, 9, (P, f) => {
    P.oval(0, 3, 8, 5, C.white); P.px(0, 2, C.white); P.hl(2, 6, 5, C.whiteD);
    P.r(6, 0, 3, 4, C.white); P.px(8, 1, EYE); P.r(9, 2, 1, 1, C.orange); P.px(9, 3, C.orange);
    P.px(3 + (f === 1 ? 1 : 0), 8, C.orange); P.px(5 - (f === 1 ? 1 : 0), 8, C.orange); P.px(3, 4, '#e8e4d8');
  }],
  sheep: [15, 11, (P, f) => {
    P.oval(0, 0, 12, 9, '#f2ede2'); P.oval(2, 0, 4, 3, '#ffffff'); P.oval(6, 1, 4, 3, '#ffffff'); P.hl(1, 7, 10, '#ddd6c6');
    P.r(10, 2, 4, 5, '#4a3e3e'); P.px(12, 3, '#fff'); P.px(10, 2, '#f2ede2'); P.px(14, 5, '#4a3e3e');
    const a = f === 1 ? 1 : 0;
    for (const [x, o] of [[2, a], [4, -a], [7, -a], [9, a]]) P.r(x + o, 8, 1, 3, '#4a3e3e');
  }],
};
const PET_DRAW = {
  cat(P, f, col) {
    const d = shade(col, -0.25), l = shade(col, 0.3);
    if (f === 3) { P.oval(0, 4, 11, 5, col); P.oval(7, 2, 5, 5, col); P.r(8, 1, 1, 1, col); P.r(11, 1, 1, 1, col); P.hl(8, 5, 2, d); P.hl(1, 7, 8, d); P.px(0, 5, l); return; }
    if (f === 2) { P.oval(2, 3, 7, 7, col); P.oval(5, 0, 5, 5, col); P.px(5, 0, col); P.px(9, 0, col); P.px(8, 2, EYE); P.vl(1, 4, 5, col); P.px(1, 3, col); P.hl(3, 9, 5, d); return; }
    P.r(1, 3, 8, 4, col); P.oval(7, 0, 5, 5, col); P.px(7, 0, col); P.px(11, 0, col); P.px(10, 2, EYE); P.hl(2, 3, 6, l);
    P.line(1, 3, 0, 0 + (f ? 1 : 0), col);
    for (const [x, o] of [[2, f], [7, 1 - f]]) P.r(x + o, 7, 1, 2, d);
  },
  dog(P, f, col) {
    const d = shade(col, -0.28), l = shade(col, 0.3);
    if (f === 3) { P.oval(0, 4, 12, 5, col); P.oval(8, 2, 5, 5, col); P.r(8, 3, 2, 3, d); P.hl(1, 7, 9, d); return; }
    if (f === 2) { P.oval(2, 3, 8, 7, col); P.oval(6, 0, 6, 5, col); P.r(6, 1, 2, 4, d); P.px(10, 2, EYE); P.px(12, 3, EYE); P.vl(1, 2, 3, col); return; }
    P.r(1, 3, 9, 4, col); P.oval(8, 0, 6, 5, col); P.r(8, 1, 2, 4, d); P.px(12, 2, EYE); P.px(13, 3, EYE); P.hl(2, 3, 7, l);
    P.line(1, 3, 0, 1 + (f ? 1 : 0), col);
    for (const [x, o] of [[2, f], [8, 1 - f]]) P.r(x + o, 7, 1, 3, d);
  },
  bunny(P, f, col) {
    const d = shade(col, -0.25);
    if (f === 3) { P.oval(0, 4, 10, 5, col); P.r(7, 2, 4, 2, col); P.hl(1, 7, 7, d); P.px(0, 4, '#ffffff'); return; }
    P.oval(0, 3 + (f === 1 ? -1 : 0), 8, 6, col); P.oval(5, 1, 5, 5, col); P.r(6, -3, 1, 4, col); P.r(8, -3, 1, 4, col); P.px(6, -2, '#f2a0b8');
    P.px(8, 3, EYE); P.px(0, 4, '#ffffff'); P.hl(1, 8, 6, d);
  },
  fox(P, f, col) {
    const d = shade(col, -0.25);
    if (f === 3) { P.oval(0, 4, 11, 5, col); P.oval(7, 2, 5, 5, col); P.oval(0, 5, 6, 3, '#f4efe6'); P.hl(2, 8, 7, d); return; }
    if (f === 2) { P.oval(2, 3, 7, 7, col); P.oval(5, 0, 6, 5, col); P.px(5, 0, col); P.px(10, 0, col); P.px(9, 2, EYE); P.oval(6, 3, 3, 2, '#f4efe6'); P.oval(0, 5, 4, 5, col); P.px(0, 9, '#f4efe6'); return; }
    P.r(2, 3, 8, 4, col); P.oval(8, 0, 6, 5, col); P.px(8, 0, col); P.px(13, 0, col); P.px(12, 2, EYE); P.r(11, 3, 3, 2, '#f4efe6'); P.px(14, 3, EYE);
    P.oval(-1, 1 + (f ? 1 : 0), 4, 5, col); P.px(-1, 2 + (f ? 1 : 0), '#f4efe6');
    for (const [x, o] of [[3, f], [8, 1 - f]]) P.r(x + o, 7, 1, 3, '#3a2a20');
  },
};
export function petFrame(kind, color, f, left) {
  return cached(`pet:${kind}:${color}:${f}:${left}`, () => {
    if (left) return flipX(petFrame(kind, color, f, false));
    return sprite(16, 12, (P) => { P.ctx.translate(1, 3); PET_DRAW[kind](P, f, color); });
  });
}

export function animalFrame(kind, f, left) {
  return cached(`an:${kind}:${f}:${left}`, () => {
    if (left) return flipX(animalFrame(kind, f, false));
    const [w, h, fn] = ANIMALS[kind];
    return sprite(w, h, (P) => fn(P, f));
  });
}

// little bee / butterfly / bird
export function bugSprite(kind, f) {
  return cached(`bug:${kind}:${f}`, () => {
    if (kind === 'bee') return sprite(3, 2, (P) => { P.r(0, 0, 3, 2, C.gold); P.px(1, 0, '#3a2a20'); if (f) P.px(1, -1, '#fff'); }, { ol: false, pad: 1 });
    const col = ['#f6d548', '#f08bb0', '#a9c8ff', '#fbf8ef'][f >> 1];
    return sprite(5, 4, (P) => {
      if (f % 2) { P.r(0, 0, 2, 3, col); P.r(3, 0, 2, 3, col); } else { P.r(1, 1, 1, 2, col); P.r(3, 1, 1, 2, col); }
      P.vl(2, 0, 4, '#3a2a20');
    }, { ol: false, pad: 1 });
  });
}
