// The "Golden Cozy" colour grade: soft olive-gold greens, warm light and
// plum-tinted shadows. It is baked into every sprite once, when the sprite is
// first drawn, so it costs nothing per frame.

const G = {
  gamma: 1.08, bal: [1.06, 1.0, 0.8], greenWarm: 0.32, sat: 0.95, contrast: 1.1,
  shadow: [0.26, 0.14, 0.24], ws: 0.55, hi: [1.0, 0.92, 0.7], wh: 0.28,
};

const memo = new Map();

/** Grade one colour (0-255 channels). */
export function gradeRGB(r, g, b) {
  const key = (r << 16) | (g << 8) | b;
  let out = memo.get(key);
  if (out) return out;
  let c = [r / 255, g / 255, b / 255].map((v, i) => Math.pow(v, G.gamma) * G.bal[i]);
  const gd = Math.max(0, c[1] - Math.max(c[0], c[2]));
  c[0] += gd * G.greenWarm * 1.6; c[2] -= gd * G.greenWarm * 0.5;
  const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  c = c.map((v) => l + (v - l) * G.sat);
  c = c.map((v) => (v - 0.45) * G.contrast + 0.45);
  const l2 = Math.max(0, Math.min(1, 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]));
  const ws = Math.pow(1 - l2, 2.2) * G.ws, wh = Math.pow(l2, 2.5) * G.wh;
  c = c.map((v, i) => v + (G.shadow[i] - v) * ws);
  c = c.map((v, i) => v + (G.hi[i] - v) * wh);
  out = c.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))));
  if (memo.size < 200000) memo.set(key, out);
  return out;
}

export function gradeHex(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = gradeRGB((n >> 16) & 255, (n >> 8) & 255, n & 255);
  return `rgb(${r},${g},${b})`;
}

/** Grade a canvas in place (once). */
export function gradeCanvas(cv) {
  if (cv._graded || !cv.width || !cv.height) return cv;
  const ctx = cv.getContext('2d');
  const img = ctx.getImageData(0, 0, cv.width, cv.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const o = gradeRGB(d[i], d[i + 1], d[i + 2]);
    d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2];
  }
  ctx.putImageData(img, 0, 0);
  cv._graded = true;
  return cv;
}
