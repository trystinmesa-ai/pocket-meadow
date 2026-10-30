import { gradeCanvas } from './grade.js';

// Pixel-art toolkit. Every sprite in the game is drawn in code with these
// helpers at 1 pixel = 1 game pixel, then cached as a canvas.

export const C = {
  ol: '#35232a',          // outline
  shadow: 'rgba(40,24,30,0.28)',
  g1: '#74b14e', g2: '#62a043', g3: '#8cc45c', g4: '#a6d56e', gd: '#4f8c3a', gdd: '#3e7531',
  wild1: '#5d9a45', wild2: '#4d8a3c', wild3: '#6eaa50',
  soil: '#8e5c3c', soilD: '#704532', soilL: '#a8714a', wet: '#5f3c2b', wetD: '#4a2f24', wetL: '#734a35',
  wood: '#ac733f', woodD: '#7e502d', woodL: '#cd9257', woodDD: '#5c3820',
  stone: '#bdb8a9', stoneD: '#928d80', stoneL: '#dcd7c6', stoneDD: '#6e6a60',
  roofR: '#c8523e', roofRD: '#9c3b2f', roofRL: '#e47658',
  roofB: '#4f7fae', roofBD: '#3b6390', roofBL: '#6f9fcc',
  roofG: '#5f9a5a', roofGD: '#467a44', roofGL: '#7fb874',
  roofP: '#8c5aa8', roofPD: '#6d4386', roofPL: '#aa7bc4',
  roofT: '#a8603a', roofTD: '#83472a', roofTL: '#c67d50',
  roofS: '#6c6a78', roofSD: '#54525f', roofSL: '#8a8896',
  cream: '#f3e5c4', creamD: '#dbc69e', creamL: '#fff4da',
  white: '#fbf8ef', whiteD: '#dcd8cc',
  brick: '#b85c44', brickD: '#8f4334', brickL: '#d2775b',
  water: '#5aaad6', waterD: '#3f8cbf', waterL: '#a2dcf1', waterDD: '#327aa8',
  path: '#d6b47c', pathD: '#bb9460', pathL: '#e8cc98',
  glass: '#7cc4e0', glassD: '#4f95b8', glow: '#ffd77a',
  gold: '#f4c542', goldD: '#c9922a', goldL: '#ffe27a',
  red: '#d94545', redD: '#a83232', pink: '#f08bb0', pinkD: '#c9628a', yellow: '#f6d548', yellowD: '#d1a92e',
  blue: '#5b8fe0', purple: '#9a6ad0', orange: '#f0902e', orangeD: '#c66c1f',
  leaf: '#5aa646', leafD: '#3f8236', leafL: '#7cc75a', leafDD: '#2f6a2c',
  skinShade: 'rgba(120,60,40,0.25)',
};

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** A drawing context with pixel helpers. */
export function pen(cv) {
  const ctx = cv.getContext('2d');
  const P = {
    ctx, w: cv.width, h: cv.height,
    px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); },
    r(x, y, w, h, c) { if (w <= 0 || h <= 0) return; ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); },
    // horizontal / vertical lines
    hl(x, y, w, c) { P.r(x, y, w, 1, c); },
    vl(x, y, h, c) { P.r(x, y, 1, h, c); },
    line(x0, y0, x1, y1, c) {
      x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      for (;;) {
        P.px(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e;
        if (e2 >= dy) { e += dy; x0 += sx; }
        if (e2 <= dx) { e += dx; y0 += sy; }
      }
    },
    // filled ellipse in a box
    oval(x, y, w, h, c) {
      const cx = x + w / 2 - 0.5, cy = y + h / 2 - 0.5, rx = w / 2, ry = h / 2;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const dx = (x + i - cx) / rx, dy = (y + j - cy) / ry;
        if (dx * dx + dy * dy <= 1.0) P.px(x + i, y + j, c);
      }
    },
    // rounded rectangle (corners cut by 1px)
    rr(x, y, w, h, c) { P.r(x + 1, y, w - 2, h, c); P.r(x, y + 1, w, h - 2, c); },
  };
  return P;
}

/** Add a 1px outline around all opaque pixels. */
export function outline(cv, color = C.ol, diag = false) {
  const ctx = cv.getContext('2d');
  const { width: W, height: H } = cv;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const a = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[(y * W + x) * 4 + 3]);
  const mark = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (a(x, y) > 40) continue;
    if (a(x - 1, y) > 140 || a(x + 1, y) > 140 || a(x, y - 1) > 140 || a(x, y + 1) > 140 ||
      (diag && (a(x - 1, y - 1) > 140 || a(x + 1, y + 1) > 140 || a(x + 1, y - 1) > 140 || a(x - 1, y + 1) > 140))) mark.push(x, y);
  }
  const [r, g, b] = hex(color);
  for (let i = 0; i < mark.length; i += 2) {
    const k = (mark[i + 1] * W + mark[i]) * 4;
    d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function shade(c, k) {
  const [r, g, b] = hex(c);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return `#${((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1)}`;
}

/** Build a sprite: size w x h, drawn by fn(P), optionally outlined. pad adds room for the outline. */
export function sprite(w, h, fn, { ol = true, pad = 1 } = {}) {
  const cv = canvas(w + pad * 2, h + pad * 2);
  const P = pen(cv);
  P.ctx.translate(pad, pad);
  fn(P);
  P.ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (ol) outline(cv);
  cv.pad = pad;
  return cv;
}

/** Mirror a canvas horizontally. */
export function flipX(src) {
  const cv = canvas(src.width, src.height);
  const ctx = cv.getContext('2d');
  ctx.translate(src.width, 0); ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  cv.pad = src.pad;
  cv._graded = src._graded;
  return cv;
}

/** Tint a sprite toward a colour (used for wild land and ghosts). */
export function tinted(src, color, alpha) {
  const cv = canvas(src.width, src.height);
  const ctx = cv.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, cv.width, cv.height);
  cv.pad = src.pad;
  cv._graded = src._graded;
  return cv;
}

// simple cache
const cache = new Map();
export function cached(key, make) {
  let v = cache.get(key);
  if (!v) {
    v = make();
    // every cached sprite gets the Golden Cozy colour grade, once
    if (v && v.getContext && !v._graded) gradeCanvas(v);
    cache.set(key, v);
  }
  return v;
}

/** Deterministic noise for per-pixel texture. */
export function noise(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
