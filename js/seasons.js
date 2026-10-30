// Seasons (one real week each) and weekend festivals, worked out from the
// date so every device agrees. ?season=autumn and ?festival=1 preview them.
import { SEASONS, SEASON_BONUS, WINTER_SLOW, CROPS } from './data.js';

const DAY = 86400000;
let forceSeason = null, forceFestival = null;
try {
  const q = new URLSearchParams(location.search);
  if (q.get('season')) forceSeason = SEASONS.find((s) => s.id === q.get('season')) || null;
  if (q.get('festival') !== null) forceFestival = q.get('festival') === '1';
} catch {}

// weeks start on Monday (1 Jan 1970 was a Thursday)
const weekOf = (t) => Math.floor((t / DAY + 3) / 7);

export function seasonAt(t) {
  return forceSeason || SEASONS[((weekOf(t) % 4) + 4) % 4];
}

/** Days left in the current season (rounded up). */
export function seasonDaysLeft(t) {
  const end = (weekOf(t) + 1) * 7 - 3;
  return Math.max(1, Math.ceil(end - t / DAY));
}

/** Festivals run all weekend (Saturday and Sunday, your local time). */
export function festivalOn(t) {
  if (forceFestival !== null) return forceFestival;
  const d = new Date(t).getDay();
  return d === 6 || d === 0;
}
export const festivalId = (t) => `${seasonAt(t).id}-${weekOf(t)}`;

/** Time until the next festival starts, in ms (0 while one is on). */
export function untilFestival(t) {
  if (festivalOn(t)) return 0;
  const d = new Date(t);
  const sat = new Date(d.getFullYear(), d.getMonth(), d.getDate() + ((6 - d.getDay() + 7) % 7), 0, 0, 0);
  return Math.max(0, sat.getTime() - t);
}

export const inSeason = (crop, season) => season.favored.includes(crop);
export const canPlantNow = (crop, season) => !CROPS[crop].season || CROPS[crop].season === season.id;

/** Growth speed multiplier a season gives a crop. */
export function seasonGrowth(crop, season) {
  if (inSeason(crop, season)) return SEASON_BONUS;
  return season.id === 'winter' ? WINTER_SLOW : 1;
}
