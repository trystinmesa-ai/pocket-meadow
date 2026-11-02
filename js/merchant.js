// The travelling merchant: once the village's old bridge is fixed, a cart
// visits for a few hours every couple of days. Visit times and stock come from
// the date alone, so every device sees the same merchant at the same time.
import { MERCHANT, PERKS, HATS, DEFS, ITEMS } from './data.js';
import { hash2 } from './world.js';

const PERIOD = MERCHANT.every * 1000, STAY = MERCHANT.stay * 1000;
const startOf = (k) => k * PERIOD + Math.floor(hash2(k, 7, 4242) * (PERIOD - STAY));

/** The visit happening at this moment ({ k, start, end }), or null. */
export function visitAt(now) {
  const k = Math.floor(now / PERIOD), start = startOf(k);
  return now >= start && now < start + STAY ? { k, start, end: start + STAY } : null;
}
export function nextVisit(now) {
  for (let k = Math.floor(now / PERIOD); ; k++) { const start = startOf(k); if (start + STAY > now) return { k, start, end: start + STAY }; }
}
export const merchantHere = (world, now = Date.now()) => (world.fx.merchant ? visitAt(now) : null);

const MAT_PACKS = [['copper', 25, 6], ['iron', 20, 6], ['gold', 10, 7], ['gem', 2, 5], ['stone', 80, 5], ['wood', 80, 5]];
const SPECIAL = [
  ...Object.keys(DEFS).filter((k) => DEFS[k].merchant).map((k) => `decor:${k}`),
  ...Object.keys(HATS).filter((k) => HATS[k].merchant).map((k) => `hat:${k}`),
  ...Object.keys(PERKS).map((k) => `perk:${k}`),
];
/** What the merchant has on visit k: two material packs and three special wares. */
export function stockOf(k) {
  const pick = (list, n, salt) => list.map((x, i) => [hash2(k, i, salt), x]).sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => x[1]);
  const mats = pick(MAT_PACKS, 2, 11).map(([m, n, mul]) => ({ key: `mat:${m}:${n}`, price: Math.round(ITEMS[m].value * n * mul) }));
  const wares = pick(SPECIAL, 3, 23).map((key) => {
    const [kind, id] = key.split(':');
    return { key, price: kind === 'decor' ? DEFS[id].cost : kind === 'hat' ? HATS[id].cost : PERKS[id].cost };
  });
  return mats.concat(wares);
}
export function offerName(key) {
  const [kind, id, n] = key.split(':');
  if (kind === 'mat') return `${n} ${ITEMS[id].name}`;
  if (kind === 'decor') return DEFS[id].name;
  if (kind === 'hat') return HATS[id].name;
  return PERKS[id].name;
}
/** Is this ware still for sale this visit? (each one sells once per visit; hats and perks once ever) */
export function soldOut(s, v, key) {
  const [kind, id] = key.split(':');
  if (kind === 'hat') return !!s.hats[id];
  if (kind === 'perk') return !!s.perks[id];
  return !!(s.merchant && s.merchant.k === v.k && s.merchant.bought.includes(key));
}
