// A* pathfinding on the tile grid. Paths are cheaper to walk on, so
// farmhands naturally prefer the roads you build.
import { MAP } from './data.js';

const N = MAP.w * MAP.h;
const g = new Float32Array(N);
const f = new Float32Array(N);
const from = new Int32Array(N);
const seen = new Uint32Array(N);
const closed = new Uint32Array(N);
let stamp = 0;

// Binary heap of tile indexes ordered by f.
const heap = new Int32Array(N * 4);
let hn = 0;
function push(i) {
  let k = hn++; heap[k] = i;
  while (k > 0) { const p = (k - 1) >> 1; if (f[heap[p]] <= f[i]) break; heap[k] = heap[p]; k = p; }
  heap[k] = i;
}
function pop() {
  const top = heap[0], last = heap[--hn];
  let k = 0;
  for (;;) {
    let c = 2 * k + 1;
    if (c >= hn) break;
    if (c + 1 < hn && f[heap[c + 1]] < f[heap[c]]) c++;
    if (f[heap[c]] >= f[last]) break;
    heap[k] = heap[c]; k = c;
  }
  heap[k] = last;
  return top;
}

/**
 * Find a path of tile coordinates from (sx,sy) to (tx,ty).
 * The start tile is always allowed (a farmhand may stand somewhere newly built on).
 * Returns [[x,y], ...] excluding the start, or null.
 */
export function findPath(world, sx, sy, tx, ty) {
  const W = MAP.w;
  if (sx === tx && sy === ty) return [];
  if (!world.walkable(tx, ty)) return null;
  stamp++; hn = 0;
  const s = sy * W + sx, t = ty * W + tx;
  g[s] = 0; f[s] = (Math.abs(tx - sx) + Math.abs(ty - sy)) * 0.6; seen[s] = stamp; from[s] = -1;
  push(s);
  let iter = 0;
  while (hn > 0 && iter++ < 6000) {
    const c = pop();
    if (closed[c] === stamp) continue;
    closed[c] = stamp;
    if (c === t) {
      const out = [];
      for (let k = t; k !== s; k = from[k]) out.push([k % W, (k / W) | 0]);
      return out.reverse();
    }
    const cx = c % W, cy = (c / W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= W || ny >= MAP.h) continue;
      const n = ny * W + nx;
      if (closed[n] === stamp || !world.walkable(nx, ny)) continue;
      const cost = g[c] + 1 / world.tileSpeed(nx, ny);
      if (seen[n] !== stamp || cost < g[n]) {
        seen[n] = stamp; g[n] = cost; from[n] = c;
        f[n] = cost + (Math.abs(tx - nx) + Math.abs(ty - ny)) * 0.6;
        push(n);
      }
    }
  }
  return null;
}
