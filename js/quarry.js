// The quarry: a separate little map reached by a trail from the farm's edge.
// Miners chop trees and mine rocks and ore veins, carry what they get to the
// cart by the trail, and it lands in the material shed. Veins regrow.
import { QUARRY, QZONES, QNODES } from './data.js';
import { hash2 } from './world.js';
import { minerSpeed, minerDur, addXp } from './sim.js';

export function newQuarry(seed) {
  const q = { zones: 0, nodes: [], nextId: 1 };
  addZone(q, 0, seed);
  return q;
}

/** Open zone i and scatter its trees, rocks and veins (the same on every device). */
export function addZone(q, i, seed) {
  const z = QZONES[i];
  q.zones = Math.max(q.zones, i + 1);
  const taken = new Set(q.nodes.map((n) => n.x + ',' + n.y));
  const near = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (taken.has(x + dx + ',' + (y + dy))) return true; return false; };
  let n = 0;
  for (const [k, count] of Object.entries(z.nodes)) for (let c = 0; c < count; c++, n++) {
    for (let tries = 0; tries < 80; tries++) {
      const x = z.x0 + Math.floor(hash2(n * 7 + i, tries, seed + 77) * (z.x1 - z.x0 + 1));
      const y = 2 + Math.floor(hash2(tries, n * 5 + i, seed + 91) * (QUARRY.h - 4));
      if (Math.abs(y - QUARRY.road) <= 1 || near(x, y)) continue; // keep the cart road clear
      taken.add(x + ',' + y);
      q.nodes.push({ id: q.nextId++, k, x, y, z: i, hp: QNODES[k].hp });
      break;
    }
  }
}

export const nodeAt = (q, x, y) => q && q.nodes.find((n) => n.x === x && n.y === y);
const cartSpot = () => [QUARRY.cart[0] + 1.5, QUARRY.cart[1] + 0.5];

export function stepQuarry(world, dt) {
  const s = world.state, q = s.quarry;
  if (!q) return;
  for (const n of q.nodes) if (n.hp <= 0) { n.re = (n.re ?? QNODES[n.k].regrow) - dt; if (n.re <= 0) { n.hp = QNODES[n.k].hp; delete n.re; } }
  for (const w of s.workers) if (w.role === 'miner') minerStep(world, w, dt);
}

// A miner's plan lives in w._q (not saved: after loading they simply re-plan).
function plan(world, w) {
  const q = world.state.quarry;
  if (w.carry && world.mat(w.carry.item) >= world.shedCap) return null; // nowhere to put it yet
  if (w.carry) return { st: 'go', x: cartSpot()[0], y: cartSpot()[1], next: 'drop', act: `Bringing ${w.carry.qty} ${w.carry.item} to the cart` };
  let best = null, bd = Infinity;
  for (const n of q.nodes) {
    if (n.hp <= 0 || n.z >= q.zones || (n._c && n._c !== w.id)) continue;
    if (world.mat(QNODES[n.k].item) >= world.shedCap) continue; // the shed has no room for it
    const d = Math.abs(n.x + 0.5 - w.x) + Math.abs(n.y + 1.3 - w.y);
    if (d < bd) { bd = d; best = n; }
  }
  if (!best) return null;
  best._c = w.id;
  return { st: 'go', x: best.x + 0.5, y: best.y + 1.3, next: 'mine', node: best, act: `${best.k === 'tree' ? 'Chopping' : 'Mining'} ${QNODES[best.k].name.toLowerCase()}` };
}

function release(w) { if (w._q?.node && w._q.node._c === w.id) delete w._q.node._c; w._q = null; }

function minerStep(world, w, dt) {
  const q = world.state.quarry;
  let guard = 0;
  while (dt > 1e-6 && guard++ < 30) {
    if (!w._q) {
      if (w._wait > 0) { const u = Math.min(dt, w._wait); w._wait -= u; dt -= u; w._anim = 'idle'; continue; }
      w._q = plan(world, w);
      if (!w._q) {
        const full = w.carry || Object.values(QNODES).some((k) => world.mat(k.item) >= world.shedCap);
        w._act = full ? `Waiting: the material shed is full${w.carry ? ` of ${w.carry.item}` : ''}` : 'Waiting for trees and rocks to grow back';
        w._anim = 'idle'; w._wait = 3; continue;
      }
    }
    const j = w._q;
    w._act = j.act;
    if (j.st === 'go') {
      w._anim = 'walk'; w._tool = null;
      const dx = j.x - w.x, dy = j.y - w.y, d = Math.hypot(dx, dy);
      const step = minerSpeed(world, w) * dt;
      if (d > 1e-3) w._dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u');
      if (step >= d) { w.x = j.x; w.y = j.y; dt -= d / minerSpeed(world, w); j.st = j.next; j.left = undefined; }
      else { w.x += (dx / d) * step; w.y += (dy / d) * step; dt = 0; }
      continue;
    }
    if (j.st === 'mine') {
      const n = j.node, K = QNODES[n.k];
      if (n.hp <= 0 || !q.nodes.includes(n)) { release(w); continue; }
      if (j.left === undefined) j.left = minerDur(world, w, K.time);
      w._anim = 'work'; w._tool = n.k === 'tree' ? 'axe' : 'pick'; w._dir = 'u';
      const u = Math.min(dt, j.left);
      j.left -= u; dt -= u;
      if (j.left > 1e-6) continue;
      j.left = undefined;
      n.hp--;
      w.carry = { item: K.item, qty: (w.carry?.qty || 0) + 1 };
      addXp(world, w, 1);
      if (K.gem && Math.random() < K.gem) { world.addMat('gem', 1); world.events.push({ t: 'gem' }); }
      world.events.push({ t: 'qhit', n, item: K.item });
      if (n.hp <= 0) n.re = K.regrow;
      if (n.hp <= 0 || w.carry.qty >= world.fx.carry || world.mat(K.item) + w.carry.qty >= world.shedCap) { release(w); }
      continue;
    }
    if (j.st === 'drop') {
      if (j.left === undefined) j.left = 0.6;
      w._anim = 'deposit';
      const u = Math.min(dt, j.left);
      j.left -= u; dt -= u;
      if (j.left > 1e-6) continue;
      if (w.carry) {
        const put = world.addMat(w.carry.item, w.carry.qty);
        w.carry.qty -= put;
        if (w.carry.qty <= 0) w.carry = null;
        else { w._q = null; w._wait = 5; w._act = 'Waiting: the material shed is full'; continue; }
      }
      release(w);
      continue;
    }
    release(w);
  }
}
