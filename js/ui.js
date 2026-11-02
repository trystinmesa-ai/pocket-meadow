// Interface: top bar, dock, sheets (build, farmhands, market, orders,
// upgrades, menu), the selection card, placement modes, toasts and dialogs.
import { ACHIEVEMENTS, achReward, HATS, discovered, DEFS, ITEMS, CROPS, USES, SOURCES, CROP_ORDER, ROLES, ROLE_ORDER, UPGRADES, upgradeCost, xpForLevel, GOALS, BUILD_TABS,
  MAX_WORKER_LEVEL, workerXpNeeded, MAP, TILE, parcelCost, parcelLevel, levelReward, MAX_LEVEL } from './data.js';
import { doorTile, sellPrice, storeCap, cropUnlocked, PW } from './world.js';
import * as E from './economy.js';
import { curRecipe, recipesFor, outTotal, outCap, animalCount, animalCap, feedCap, hiveCap, hiveRate, craftTime, PANTRY, pantryCap, pantryUsed, pantryItems } from './sim.js';
import { img, itemImg, iconURL } from './art/icons.js';
import { itemURL } from './art/items.js';
import { buildingSprite } from './art/buildings.js';
import { decorSprite, fenceSprite } from './art/decor.js';
import { cropSprite, treeSprite, FRUIT_COLOR } from './art/plants.js';
import { pathThumb, soilTile } from './art/land.js';
import { workerFrame, petFrame } from './art/chars.js';
import { fmtShort } from './render.js';
import * as Cloud from './cloud.js';
import { exportSave, parseSave, farmSnapshot } from './save.js';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
import { seasonAt, seasonDaysLeft, festivalOn, untilFestival, inSeason, canPlantNow } from './seasons.js';
import { SEASONS, SEASON_BONUS, PETS, MAX_PETS, BUNDLE_ROOMS, ALL_BUNDLES_REWARD, MATS, matsFor, upgMatsFor, buildTime, needsBuilding,
  QZONES, QNODES, SHED_MAX, shedCap, shedCost, VILLAGERS, HEARTS, heartsOf, PROJECTS, PERKS, GOLD_MULT,
  WEATHER, FISH, ANIMAL_TREASURE, MUSEUM_WINGS, MUSEUM_REWARD, PAT_EVERY } from './data.js';
import { farmPerks, museumWings } from './world.js';
import { merchantHere, nextVisit, stockOf, offerName, soldOut } from './merchant.js';
import { debrisSprite } from './art/quarry.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n) => (n < 1e5 ? Math.floor(n).toLocaleString('en-US') : fmtShort(n));
export function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return s && m < 10 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}
const coin = (n) => `<span class="cost">${img('coin')}${fmt(n)}</span>`;
const PAINTABLE = new Set(['field', 'path', 'fence']);
/** Material chips, e.g. [wood]12 [stone]8; ones you're short of are marked. */
const matsHTML = (m, w) => (m ? Object.entries(m).map(([k, n]) => `<span class="mat ${w && w.mat(k) < n ? 'short' : ''}" title="${ITEMS[k].name}">${itemImg(k)}${fmt(n)}</span>`).join('') : '');
/** Attributes that keep a buy button disabled until you can afford it. */
const needAttr = (cost, mats) => `data-need="${cost}"${mats ? ` data-mats='${JSON.stringify(mats)}'` : ''}`;

const thumbCache = new Map();
function thumb(type, extra) {
  const key = type + (extra || '');
  if (thumbCache.has(key)) return thumbCache.get(key);
  const d = DEFS[type];
  let cv;
  if (type === 'plot') cv = extra ? cropSprite(extra, 3) : soilTile(false, 0);
  else if (d.cat === 'tree') cv = treeSprite(d.look, FRUIT_COLOR[d.look]);
  else if (d.cat === 'path') cv = pathThumb(type);
  else if (d.cat === 'fence') cv = fenceSprite(type, 10);
  else if (d.cat === 'decor') cv = decorSprite(type);
  else if (d.cat === 'debris') cv = debrisSprite(type);
  else cv = buildingSprite(type);
  const url = cv.toDataURL();
  thumbCache.set(key, url);
  return url;
}
const avatar = (w) => workerFrame(w.look, w.hat || ROLES[w.role].hat, 'd', 'idle', 0).toDataURL();
const PREVIEW_LOOK = { skin: '#f6d2ae', hair: '#6b4226', shirt: '#5fb35a', pants: '#4a5a8a', style: 0 };
const hatPreview = (id) => workerFrame(PREVIEW_LOOK, id, 'd', 'idle', 0).toDataURL();
const ribbon = (n) => `<span class="cost">${img('ribbon')}${fmt(n)}</span>`;
const petPreview = (kind, color) => petFrame(kind, PETS[kind].colors[color % PETS[kind].colors.length], 2, false).toDataURL();
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const roman = (n) => ROMAN[n] || String(n);
function achName(code) { const [id, t] = code.split(':'); const a = ACHIEVEMENTS.find((x) => x.id === id); return a ? `${a.name} ${roman(+t + 1)}` : 'an achievement'; }
/** Where an undiscovered item comes from, for the collection book. */
function sourceOf(item) {
  if (CROPS[item]) return `Grow ${ITEMS[item].name.toLowerCase()} (farm level ${CROPS[item].level})`;
  for (const [, d] of Object.entries(DEFS)) {
    if (d.fruit === item) return `Plant a ${d.name}`;
    if (d.animal && d.animal.item === item) return `Build a ${d.name}`;
    if (d.hive && d.hive.item === item) return `Build a ${d.name}`;
    for (const r of d.recipes || []) if (r.out === item) return `Made in the ${d.name} from ${Object.keys(r.in).map((k) => ITEMS[k].name).join(', ')}`;
  }
  if (ITEMS[item].find) return 'Dug up now and then by miners in the quarry (rarer ones deeper in)';
  if (ITEMS[item].fishy) return 'Caught now and then at a Fishing Dock (it depends on the season, weather and time of day)';
  if (Object.values(ANIMAL_TREASURE).includes(item)) return 'A treasure from very happy animals';
  if (ITEMS[item].mat) return item === 'wood' || item === 'stone' ? 'Clearing debris, or the quarry' : 'Mining in the quarry';
  return 'Keep farming!';
}
/** A tappable item icon that opens its info card. */
const infoImg = (k, cls) => `<button class="ib" data-act="iteminfo" data-item="${k}" title="${esc(ITEMS[k].name)}">${itemImg(k, cls)}</button>`;
/** One short line of what an item is used for. */
function usesHTML(item, max = 7) {
  const u = USES[item] || [];
  if (!u.length) return '';
  const outs = [...new Set(u.filter((x) => x.out).map((x) => x.out))];
  const extra = [...new Set(u.filter((x) => x.feeds).map((x) => `feeds ${x.feeds === 'sheep' ? x.feeds : x.feeds + 's'}`))];
  if (u.some((x) => x.bees)) extra.push('helps bees');
  return `<div class="uses"><span>Used for</span>${outs.slice(0, max).map((k) => infoImg(k)).join('')}${outs.length > max ? `<small>+${outs.length - max}</small>` : ''}${extra.length ? `<small>${extra.join(' · ')}</small>` : ''}</div>`;
}
// Who works each kind of thing, for the tip on its card.
const WORK = {
  field: [['farmer'], 'Farmers plant, water and harvest it.'],
  tree: [['farmer', 'rancher'], 'Farmers or ranchers pick the fruit.'],
  craft: [['artisan'], 'An artisan runs it. Haulers keep its pantry stocked with ingredients, so they don’t fill your barn.'],
  animal: [['rancher'], 'A rancher feeds the animals and collects what they make.'],
  hive: [['rancher'], 'Makes it on its own. A rancher collects it.'],
  storage: [[], 'Farmhands drop goods off here. Haulers also move any piles into it.'],
};

export class UI {
  constructor(game) {
    this.g = game;
    this.mode = null;
    this.sel = null;
    this.sheet = null;
    this.tab = { build: 'field', menu: 'farm', journal: 'goals', orders: 'orders' };
    this.toastQ = [];
    this.modalQ = [];
    this.lastFull = 0;
    this.hireRole = 'farmer';
    this.dom();
  }
  get w() { return this.g.world; }
  get s() { return this.g.world.state; }

  // ---------- DOM skeleton ----------
  dom() {
    $('#hud').innerHTML = `
      <button class="res" data-act="sheet" data-v="market" aria-label="Coins">${img('coin')}<b id="h-coins">0</b></button>
      <button class="res lvl" data-act="levelinfo" aria-label="Farm level">${img('star')}<b>Lv <span id="h-level">1</span></b><span class="bar"><i id="h-xp"></i></span></button>
      <button class="res" data-act="sheet" data-v="inventory" aria-label="Everything you own">${img('box')}<b id="h-store">0/0</b></button>
      <button class="res charm" data-act="charminfo" aria-label="Charm">${img('heart')}<b id="h-charm">0</b></button>
      <button class="res season" id="h-season" data-act="sheet" data-v="season" aria-label="Season and festival"></button>
      <button class="res merchant" id="h-merchant" data-act="openmerchant" aria-label="Travelling merchant" hidden>${img('market')}<b>Merchant</b></button>
      <button class="res wx" id="h-wx" data-act="weatherinfo" aria-label="Weather"></button>`;
    const dock = [
      ['build', 'hammer', 'Build'], ['workers', 'people', 'Farmhands', 'Crew'], ['market', 'market', 'Market'],
      ['orders', 'scroll', 'Village'], ['journal', 'book', 'Journal'], ['upgrades', 'up', 'Upgrades', 'Perks'], ['land', 'map', 'Land'], ['menu', 'menu', 'Menu'],
    ];
    $('#dock').innerHTML = dock.map(([id, ic, name, short]) =>
      `<button data-act="${id === 'land' ? 'landmode' : 'sheet'}" data-v="${id}" id="d-${id}" aria-label="${name}">${img(ic, 'pi big')}<span class="long${short ? ' cut' : ''}">${name}</span>${short ? `<span class="short">${short}</span>` : ''}<em class="badge" id="b-${id}"></em></button>`).join('');
    for (const el of ['#hud', '#dock', '#sheet', '#card', '#placebar', '#scenebar', '#goal', '#modal', '#zoom']) {
      $(el).addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b || b.disabled) return;
        e.stopPropagation();
        this.act(b.dataset.act, b.dataset, b);
      });
    }
    $('#sheet').addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'restore-file' && t.files[0]) { this.restoreFile(t.files[0]); t.value = ''; return; }
      if (t.dataset.chg) this.act(t.dataset.chg, { ...t.dataset, value: t.value, checked: t.checked }, t);
    });
    $('#card').addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.chg) this.act(t.dataset.chg, { ...t.dataset, value: t.value }, t);
    });
    $('#zoom').innerHTML = `<button data-act="zoom" data-v="1" aria-label="Zoom in">+</button><button data-act="zoom" data-v="-1" aria-label="Zoom out">−</button>`;
  }

  // ---------- action dispatcher ----------
  act(a, d, el) {
    const w = this.w, s = this.s;
    const fail = (why) => { if (why) this.toast(why, 'bad'); return !why; };
    if (['sharefarm', 'unshare', 'addpal', 'removepal', 'visitpal', 'giftpal'].includes(a)) { this.palAct(a, d); return; }
    if (a === 'leavevisit') { this.g.leaveVisit(); return; }
    // while visiting, anything else takes you back home first
    if (this.g.visitWorld && !['close', 'zoom', 'modalbtn', 'collect', 'weatherinfo', 'levelinfo', 'charminfo', 'tab'].includes(a)) this.g.leaveVisit();
    // building and buying land happen on the farm
    if (this.inQuarry() && (a === 'landmode' || a === 'pick' || a === 'removemode' || (a === 'sheet' && d.v === 'build'))) this.goFarm();
    switch (a) {
      case 'sheet': this.openSheet(this.sheet === d.v ? null : d.v); break;
      case 'close': this.openSheet(null); break;
      case 'tab': this.tab[d.sheet] = d.v; this.renderSheet(); break;
      case 'zoom': this.g.input.zoomBy(+d.v); break;
      case 'levelinfo': this.levelInfo(); break;
      case 'donate': if (fail(E.donate(w, d.item))) { this.toast(`${ITEMS[d.item].name} is on display!`, 'good'); this.g.dirty(); this.renderSheet(); } break;
      case 'donateall': { const n = E.donateAll(w); if (n) { this.toast(`${n} new thing${n > 1 ? 's' : ''} on display!`, 'good'); this.g.dirty(); } this.renderSheet(); break; }
      case 'museumtab': this.tab.journal = 'museum'; this.openSheet('journal'); break;
      case 'patanimals': if (fail(E.patAnimals(w, this.sel))) { this.toast('They love it!', 'good'); const o = this.sel, dd = DEFS[o.type]; for (let i = 0; i < 6; i++) this.g.R.particles.push({ k: 'heart', x: (o.x + Math.random() * dd.w) * TILE, y: o.y * TILE + 4, vx: (Math.random() - 0.5) * 8, vy: -12, life: 1.2 }); this.g.dirty(); this.renderCard(); } break;
      case 'weatherinfo': { const x = WEATHER[w.weather || 'clear']; this.toast(`${x.name}: ${x.desc}`); break; }
      case 'charminfo': this.toast(`Charm ${Math.floor(w.charm)}: everything sells for +${Math.round(w.charmBonus() * 100)}% (max +25%). Decorations add charm.`); break;
      // build
      case 'pick': this.startPlacing(d.type, d.crop ? { crop: d.crop } : {}); break;
      case 'seed': if (fail(E.buySeed(w, d.crop))) { this.toast(`${ITEMS[d.crop].name} seeds unlocked!`, 'good'); this.g.dirty(); this.renderSheet(); } break;
      case 'cancelmode': this.setMode(null); break;
      case 'confirm': this.confirmPlace(); break;
      case 'removemode': this.openSheet(null); this.setMode({ k: 'remove' }); break;
      // selection card
      case 'deselect': this.select(null); break;
      case 'move': this.setMode({ k: 'move', obj: this.sel, x: this.sel.x, y: this.sel.y }); this.select(null, true); break;
      case 'remove': this.askRemove(this.sel); break;
      case 'toggleoff': this.sel.off = !this.sel.off; if (!this.sel.off) delete this.sel.off; this.toast(`${DEFS[this.sel.type].name} switched ${this.sel.off ? 'off' : 'on'}`); this.g.dirty(); this.renderCard(); break;
      case 'upgradepantry': if (fail(E.upgradePantry(w, this.sel))) { this.toast(`Pantry now holds ${pantryCap(this.sel)} ingredients`, 'good'); this.g.dirty(); this.renderCard(); } break;
      case 'upgradeb': if (fail(E.upgradeBuilding(w, this.sel))) { this.toast(`${DEFS[this.sel.type].name} upgraded to level ${this.sel.lvl}!`, 'good'); this.g.dirty(); this.renderCard(); } break;
      case 'recipe': this.sel.recipe = d.value; curRecipe(w, this.sel); this.g.dirty(); this.renderCard(); break;
      case 'setcrop': if (fail(E.setCrop(w, this.sel, d.crop))) { this.g.dirty(); this.renderCard(); } break;
      case 'cropfield': if (this.sel.next || this.sel.crop) this.cropField(this.sel, this.sel.next || this.sel.crop); break;
      case 'buyseedcard': if (fail(E.buySeed(w, d.crop))) { E.setCrop(w, this.sel, d.crop); this.g.dirty(); this.renderCard(); } break;
      case 'fire': { const wk = s.workers.find((x) => x.id === +d.id); if (wk) this.askFire(wk); break; }
      case 'iteminfo': this.itemInfo(d.item); break;
      case 'open': this.openSheet(d.v); break;
      // farmhands
      case 'hirerole': this.hireRole = d.v; this.renderSheet(); break;
      case 'hire': if (fail(E.hire(w, this.hireRole))) { this.g.dirty(); this.renderSheet(); } break;
      case 'find': { const wk = s.workers.find((x) => x.id === +d.id); if (wk) { this.openSheet(null); if (wk.role === 'miner') this.goQuarry(); else this.goFarm(); this.select(wk); this.g.focus(wk.x * TILE, wk.y * TILE); } break; }
      // materials & quarry
      case 'cleardebris': { const o = this.sel, g = DEFS[o.type].gives; if (fail(E.remove(w, o))) { this.toast(`Cleared! +${E.matsText(g)}`, 'good'); this.select(null); this.g.dirty(); } break; }
      case 'goquarry': this.goQuarry(); break;
      case 'openmerchant': this.tab.orders = 'merchant'; this.openSheet('orders'); break;
      case 'giveproject': if (fail(E.giveProject(w, d.id))) { this.g.dirty(); this.renderSheet(); } break;
      case 'payproject': if (fail(E.giveProject(w, d.id, true))) { this.coinPop(el); this.g.dirty(); this.renderSheet(); } break;
      case 'buyoffer': {
        const [kind, id] = d.key.split(':');
        if (kind === 'decor') { this.openSheet(null); this.startPlacing(id, {}); break; }
        if (fail(E.buyOffer(w, d.key))) { this.toast(`Bought ${offerName(d.key)}!`, 'good'); this.coinPop(el); this.g.dirty(); this.renderSheet(); }
        break;
      }
      case 'sellgold': { const c = E.sellGold(w, d.item, +d.n || 1e9); if (c) { this.coinPop(el); this.g.dirty(); } this.renderSheet(); break; }
      case 'gofarm': this.goFarm(); break;
      case 'hireminer': this.hireRole = 'miner'; this.openSheet('workers'); break;
      case 'openzone': if (fail(E.openZone(w, +d.i))) { this.g.dirty(); this.renderSheet(); } break;
      case 'upgradeshed': if (fail(E.upgradeShed(w))) { this.toast(`The shed now holds ${w.shedCap} of each material`, 'good'); this.g.dirty(); this.renderSheet(); } break;
      case 'sellmat': { const c = E.sellMat(w, d.item, +d.n); if (c) { this.coinPop(el); this.g.dirty(); } this.renderSheet(); break; }
      case 'rename': this.rename(+d.id); break;
      case 'helpers': s.settings.helpers = !!d.checked; this.g.dirty(); break;
      // market
      case 'sell': { const n = d.n === 'all' ? w.haveAll(d.item) : +d.n; const c = E.sell(w, d.item, n); if (c) { this.coinPop(el); this.g.dirty(); } this.renderSheet(); break; }
      case 'sellcrops': { let c = 0; for (const k in s.inv) if (CROPS[k] && s.autoSell[k] === undefined) c += E.sell(w, k, w.have(k)); if (c) { this.toast(`Sold crops for ${fmt(c)} coins`, 'good'); this.coinPop(el); this.g.dirty(); } this.renderSheet(); break; }
      case 'auto': if (s.autoSell[d.item] === undefined) s.autoSell[d.item] = 0; else delete s.autoSell[d.item]; E.autoSellItem(w, d.item); this.g.dirty(); this.renderSheet(); break;
      case 'reserve': { const v = Math.max(0, (s.autoSell[d.item] || 0) + +d.n); s.autoSell[d.item] = v; this.g.dirty(); this.renderSheet(); break; }
      // orders
      case 'fill': { const o = s.orders.find((x) => x.id === +d.id); if (o && fail(E.fillOrder(w, o))) { this.toast(`Order delivered! +${fmt(o.reward)} coins`, 'good'); this.coinPop(el); this.g.dirty(); } this.renderSheet(); break; }
      case 'skip': { const o = s.orders.find((x) => x.id === +d.id); if (o) { E.skipOrder(w, o); this.g.dirty(); this.renderSheet(); } break; }
      // upgrades
      case 'upg': if (fail(E.buyUpgrade(w, d.id))) { this.toast(`${UPGRADES.find((u) => u.id === d.id).name} upgraded!`, 'good'); this.g.dirty(); this.renderSheet(); } break;
      // land
      case 'landmode': this.openSheet(null); this.setMode(this.mode?.k === 'land' ? null : { k: 'land' }); break;
      case 'buyland': { const [px, py] = this.mode.sel; if (fail(E.buyParcel(w, px, py))) { this.toast('New land! Room to grow.', 'good'); this.g.dirty(); this.mode.sel = null; this.renderPlacebar(); } break; }
      // goals & achievements
      case 'claim': this.claimGoal(); break;
      case 'givebundle': if (fail(E.giveBundle(w, d.id, d.item))) { this.g.dirty(); this.renderSheet(); } break;
      case 'claimach': {
        // one tap claims every tier already reached, so the button goes away
        const a = ACHIEVEMENTS.find((x) => x.id === d.id), from = s.ach[d.id] || 0;
        let got = 0;
        while (E.achState(w, a).ready) { got += achReward(a, s.ach[d.id] || 0); E.claimAch(w, d.id); }
        const to = s.ach[d.id] || 0;
        if (to === from) break;
        this.toast(`${a.name} ${roman(to)}! +${fmt(got)} coins`, 'good'); this.coinPop(el);
        for (let t = from; t < to; t++) { const hat = Object.entries(HATS).find(([, h]) => h.ach === `${d.id}:${t}`); if (hat) this.toast(`New hat unlocked: ${hat[1].name}!`, 'good'); }
        this.g.dirty(); this.renderSheet(); break;
      }
      case 'fillfest': { const o = s.fest?.orders.find((x) => x.id === +d.id); if (o && fail(E.fillFestOrder(w, o))) { this.toast(`Delivered to the fair! +${o.ribbons} ribbons`, 'good'); this.coinPop(el); this.g.dirty(); } this.renderSheet(); break; }
      case 'petkind': this.petPick = { kind: d.v, color: 0 }; this.renderSheet(); break;
      case 'petcolor': this.petPick.color = +d.v; this.renderSheet(); break;
      case 'adopt': if (fail(E.adoptPet(w, this.petPick.kind, this.petPick.color))) { this.g.dirty(); this.renderSheet(); } break;
      case 'findpet': { const p = s.pets.find((x) => x.id === +d.id); const st = p && this.g.R.petState?.get(p.id); if (p) { this.openSheet(null); this.select(p); if (st) this.g.focus(st.x, st.y); } break; }
      case 'pat': { const p = this.sel; E.patPet(w); this.g.R.pat(p); this.g.dirty(); break; }
      case 'renamepet': this.renamePet(+d.id); break;
      case 'sethat': { const wk = s.workers.find((x) => x.id === +d.id); if (wk) { wk.hat = d.value || null; this.g.dirty(); this.sheet ? this.renderSheet() : this.renderCard(); } break; }
      case 'buyhat': if (fail(E.buyHat(w, d.id))) { this.toast(`${HATS[d.id].name} bought! Give it to a farmhand.`, 'good'); this.g.dirty(); this.renderSheet(); } break;
      // menu
      case 'signin': this.signIn(false); break;
      case 'signup': this.signIn(true); break;
      case 'backup': this.downloadBackup(); break;
      case 'restore': $('#restore-file')?.click(); break;
      case 'signout': this.g.signOut(); break;
      case 'syncnow': this.g.syncNow(true); break;
      case 'setting': s.settings[d.k] = !!d.checked; this.g.dirty(); break;
      case 'reset': this.askReset(); break;
      case 'modalbtn': this.closeModal(d.v); break;
      case 'collect': this.closeModal('collect'); break;
      case 'testhour': this.g.R.forceHour = d.v === '' ? undefined : +d.v; break;
      default: break;
    }
  }

  // ---------- HUD ----------
  tick() {
    const w = this.w, s = this.s;
    $('#h-coins').textContent = fmt(s.coins);
    $('#h-level').textContent = s.level;
    const a = xpForLevel(s.level), b = xpForLevel(s.level + 1);
    $('#h-xp').style.width = s.level >= MAX_LEVEL ? '100%' : `${Math.max(0, Math.min(100, ((s.xp - a) / (b - a)) * 100))}%`;
    const used = w.used();
    const st = $('#h-store');
    st.textContent = `${fmt(used)}/${fmt(w.capacity)}`;
    st.parentElement.classList.toggle('full', used >= w.capacity);
    $('#h-charm').textContent = Math.floor(w.charm);
    const sync = Cloud.user() ? `<i class="sync ${Cloud.status.state}" title="Cloud save: ${Cloud.status.state}"></i>` : '';
    const wi = { storm: 'storm', heat: 'heat', rainbow: 'rainbow' }[w.weather] || (w.raining ? (w.season?.id === 'winter' ? 'winter' : 'rain') : this.g.R.darkness() > 0.2 ? 'moon' : 'sun');
    const wh = img(wi) + sync;
    if ($('#h-wx')._h !== wh) { $('#h-wx').innerHTML = wh; $('#h-wx')._h = wh; }
    const sea = seasonAt(Date.now()), fest = festivalOn(Date.now());
    const sh = `${img(sea.id)}<b>${fest ? sea.festival : sea.name}</b>${fest ? '' : `<small>${seasonDaysLeft(Date.now())}d</small>`}`;
    const se = $('#h-season');
    if (se._h !== sh) { se.innerHTML = sh; se._h = sh; se.classList.toggle('fest', fest); }
    const fo = fest && s.fest ? s.fest.orders.filter((o) => E.canFill(w, o)).length : 0;
    const fillable = s.orders.filter((o) => E.canFill(w, o)).length;
    this.badge('orders', fillable || '');
    $('#h-season').classList.toggle('ready', fo > 0);
    this.badge('journal', E.claimableAch(w) + E.bundlesReady(w) || '');
    this.badge('workers', s.workers.length < w.housing && s.coins >= E.nextHireCost(w) ? '!' : '');
    const mv = merchantHere(w), mb = $('#h-merchant');
    if (mb.hidden !== !mv) mb.hidden = !mv;
    if (mv && this.merchantK !== mv.k) { if (this.merchantK !== undefined || Date.now() - mv.start < 60000) this.toast('The travelling merchant has arrived! Tap the cart up top to see their wares.', 'good'); this.merchantK = mv.k; }
    this.renderGoal();
    if (this.inQuarry()) { const q = $('#scenebar [data-live="qs"]'), v = this.quarryStatus(s.workers.filter((x) => x.role === 'miner').length); if (q && q._v !== v) { q.innerHTML = v; q._v = v; } }
    if (this.sheet) this.liveSheet();
    if (this.sel) this.liveCard();
    if (this.mode?.k === 'place' || this.mode?.k === 'paint') this.renderPlacebar(true);
  }
  badge(id, v) { const b = $(`#b-${id}`); if (b && b.textContent !== String(v)) b.textContent = v; }

  // ---------- goals ----------
  goalState() {
    const g = GOALS[this.s.goal];
    if (!g) return null;
    const v = Math.min(g.n, g.check(this.s, this.w));
    return { g, v, done: v >= g.n };
  }
  renderGoal() {
    const el = $('#goal');
    const st = this.goalState();
    if (!st || this.mode) { el.hidden = true; return; }
    el.hidden = false;
    const html = `<span class="gt">${img('star')}${esc(st.g.text)}</span><span class="gp">${st.done ? `<button class="btn small gold" data-act="claim">Claim ${coin(st.g.reward)}</button>` : `${fmt(st.v)}/${fmt(st.g.n)}`}</span>`;
    if (el._h !== html) { el.innerHTML = html; el._h = html; el.classList.toggle('done', st.done); }
  }
  claimGoal() {
    const st = this.goalState();
    if (!st || !st.done) return;
    this.s.coins += st.g.reward;
    this.s.goal++;
    this.toast(`Goal complete! +${fmt(st.g.reward)} coins`, 'good');
    this.coinPop($('#goal'));
    this.g.dirty();
  }

  // ---------- sheets ----------
  openSheet(name) {
    if (name === 'menu' && this.sheet !== 'menu') this.pals = null; // fresh friend info each time
    if (name && this.mode) this.setMode(null);
    this.sheet = name;
    for (const b of document.querySelectorAll('#dock button')) b.classList.toggle('on', b.dataset.v === name || (b.dataset.v === 'land' && this.mode?.k === 'land'));
    const el = $('#sheet');
    if (!name) { el.classList.remove('open'); return; }
    if (this.sel) this.select(null, true);
    el.classList.add('open');
    this.renderSheet();
    el.querySelector('.sb')?.scrollTo(0, 0);
  }

  renderSheet() {
    if (!this.sheet) return;
    const el = $('#sheet');
    const body = this[`sheet_${this.sheet}`]();
    const prev = el.querySelector('.sb');
    const scroll = prev ? prev.scrollTop : 0;
    el.innerHTML = `<div class="sh"><h2>${body.title}</h2>${body.tabs || ''}<button class="x" data-act="close" aria-label="Close">${img('x')}</button></div><div class="sb">${body.html}</div>`;
    el.querySelector('.sb').scrollTop = scroll;
    this.updateNeeds(el);
  }
  liveSheet() {
    const el = $('#sheet');
    const fn = this[`live_${this.sheet}`];
    if (!fn) return;
    const vals = fn.call(this);
    for (const k in vals) {
      const n = el.querySelector(`[data-live="${k}"]`);
      if (n && n._v !== vals[k]) { n.innerHTML = vals[k]; n._v = vals[k]; }
    }
    // keep buttons enabled state current
    this.updateNeeds(el);
  }
  updateNeeds(el) {
    for (const b of el.querySelectorAll('[data-need]')) b.disabled = this.s.coins < +b.dataset.need || (!!b.dataset.mats && !this.w.hasMats(JSON.parse(b.dataset.mats)));
  }
  tabs(sheet, list) {
    return `<div class="tabs">${list.map(([id, name]) => `<button class="${this.tab[sheet] === id ? 'on' : ''}" data-act="tab" data-sheet="${sheet}" data-v="${id}">${name}</button>`).join('')}</div>`;
  }

  sheet_build() {
    const w = this.w, s = this.s, tab = this.tab.build;
    const t = BUILD_TABS.find((x) => x.id === tab);
    let html = '';
    if (tab === 'field') {
      html += `<p class="hint">Buy field plots and tap or drag to lay them on your land. Each new plot costs a bit more than the last. Then tap a plot to pick its seed. Farmers pay the seed price each time they plant.</p><div class="grid">${this.buildTile('plot')}</div>`;
      html += `<h3>Seeds</h3><p class="hint">Unlock seeds here, then choose them on a plot. Tap a crop picture to see what it is for.</p><div class="grid">`;
      for (const c of CROP_ORDER) {
        const cr = CROPS[c], it = ITEMS[c];
        const lockLvl = s.level < cr.level, owned = !!s.seeds[c];
        let btn;
        const sea = seasonAt(Date.now());
        const tag = cr.season ? `<span class="stag ${cr.season === sea.id ? 'on' : ''}">${img(cr.season)} ${SEASONS.find((x) => x.id === cr.season).name} only</span>` : inSeason(c, sea) ? `<span class="stag on">${img(sea.id)} In season +${Math.round((SEASON_BONUS - 1) * 100)}%</span>` : '';
        if (lockLvl) btn = `<span class="lock">${img('lock')} Lv ${cr.level}</span>`;
        else if (!owned) btn = `<button class="btn small" data-act="seed" data-crop="${c}" data-need="${cr.cost}">Unlock ${coin(cr.cost)}</button>`;
        else btn = '<span class="max">UNLOCKED</span>';
        html += `<div class="tile ${lockLvl ? 'locked' : ''}"><button class="ib" data-act="iteminfo" data-item="${c}"><img class="thumb" src="${thumb('plot', c)}" alt=""></button><div class="tn">${it.name}</div>
          <div class="tm">${img('clock')}${fmtTime(cr.time)} · ${cr.yield}× ${coin(it.value)}${cr.regrow ? ' · regrows' : ''}</div><div class="tm">Seeds ${cr.seed ? coin(cr.seed) : 'free'} each planting</div>${tag}${btn}</div>`;
      }
      html += '</div><h3>Fruit trees</h3><div class="grid">';
      for (const type of Object.keys(DEFS).filter((k) => DEFS[k].cat === 'tree')) html += this.buildTile(type);
      html += '</div>';
    } else {
      const cats = t.cats;
      const groups = tab === 'build'
        ? [['Workshops', ['craft']], ['Animals', ['animal']], ['Storage', ['storage']], ['Homes & utility', ['house', 'utility']]]
        : tab === 'path' ? [['Paths', ['path']], ['Fences & hedges', ['fence']]] : [['Decorations', cats]];
      for (const [name, cs] of groups) {
        const types = Object.keys(DEFS).filter((k) => cs.includes(DEFS[k].cat) && !DEFS[k].fixed && !DEFS[k].festival);
        types.sort((a, b) => DEFS[a].level - DEFS[b].level);
        html += `<h3>${name}</h3><div class="grid">${types.map((k) => this.buildTile(k)).join('')}</div>`;
      }
      if (tab === 'build') html = `<p class="hint">Buildings need materials as well as coins: you have ${this.matsLine()}. Farmhands clear fallen branches and rocks on your land for wood and stone. For much more, and for ore, buy land at the edge of the map and follow the trail to the quarry.</p>` + html;
      if (tab === 'decor') html = `<p class="hint">Decorations are just for looks, but each one adds a little charm (charm raises sell prices a bit).</p>` + html;
    }
    html += `<div class="row center"><button class="btn" data-act="removemode">${img('trash')} Remove things</button></div>`;
    return { title: `${img('hammer', 'pi big')} Build`, tabs: this.tabs('build', BUILD_TABS.map((x) => [x.id, x.name])), html };
  }
  buildTile(type) {
    const w = this.w, s = this.s, d = DEFS[type];
    const lock = s.level < d.level;
    const cost = E.costOf(w, type);
    const mats = matsFor(type, w.count(type)), bt = buildTime(type, cost);
    const meta = d.charm ? `${img('heart')}+${d.charm} charm` : d.store ? `${img('box')}+${d.store} storage` : d.houses ? `${img('people')} houses ${d.houses}` : d.speed ? `walk ×${d.speed}` : '';
    return `<div class="tile ${lock ? 'locked' : ''}"><img class="thumb" src="${thumb(type)}" alt="">
      <div class="tn">${d.name}</div><div class="tm">${meta}</div>
      ${d.desc ? `<div class="td">${esc(d.desc)}</div>` : ''}
      ${mats ? `<div class="tmats">${matsHTML(mats, w)}</div><div class="tm">${img('clock')} Builds in ${fmtTime(bt)}</div>` : ''}
      ${d.season ? `<span class="stag ${E.seasonalBlock(w, d) ? '' : 'on'}">${img(d.season)} ${SEASONS.find((x) => x.id === d.season).name} only</span>` : ''}
      ${lock ? `<span class="lock">${img('lock')} Lv ${d.level}</span>` : E.seasonalBlock(w, d) ? `<span class="lock">${img('lock')} ${E.seasonalBlock(w, d)}</span>`
        : d.ribbons ? `<button class="btn small" data-act="pick" data-type="${type}" ${s.ribbons < d.ribbons ? 'disabled' : ''}>${ribbon(d.ribbons)}</button>`
        : `<button class="btn small" data-act="pick" data-type="${type}" ${needAttr(cost, mats)}>${coin(cost)}</button>`}</div>`;
  }

  sheet_workers() {
    const w = this.w, s = this.s;
    const cost = E.nextHireCost(w);
    const room = s.workers.length < w.housing;
    let html = `<div class="hire"><div class="roles">${ROLE_ORDER.map((r) => `<button class="${this.hireRole === r ? 'on' : ''}" data-act="hirerole" data-v="${r}">${ROLES[r].name}</button>`).join('')}</div>
      <p class="hint">${esc(ROLES[this.hireRole].desc)}${this.hireRole === 'miner' && !s.quarry ? ' <b>Find the quarry first:</b> buy land at the edge of the map and follow the trail sign.' : ''}</p>
      <div class="row"><span>${img('people')} ${s.workers.length}/${w.housing} beds${room ? '' : ' · build a Cottage for more'}</span>
      <button class="btn green" data-act="hire" ${room && (this.hireRole !== 'miner' || s.quarry) ? `data-need="${cost}"` : 'disabled'}>Hire ${coin(cost)}</button></div></div>`;
    html += `<label class="check"><input type="checkbox" data-chg="helpers" ${s.settings.helpers ? 'checked' : ''}> Farmhands help with other jobs when their own work is done</label>`;
    html += '<div class="list">';
    for (const wk of s.workers) {
      const need = workerXpNeeded(wk.lvl);
      html += `<div class="wrow"><img class="ava" src="${avatar(wk)}" alt="">
        <div class="wi"><div class="wn"><button class="link" data-act="rename" data-id="${wk.id}">${esc(wk.name)}</button> <span class="lv">Lv ${wk.lvl}</span></div>
        <div class="bar thin"><i data-live="xp${wk.id}" style="width:${wk.lvl >= MAX_WORKER_LEVEL ? 100 : (wk.xp / need) * 100}%"></i></div>
        <div class="wa" data-live="act${wk.id}">${esc(this.activity(wk))}</div></div>
        <div class="wc"><span class="job">${ROLES[wk.role].name}</span>${this.hatSelect(wk)}
        <button class="btn small" data-act="find" data-id="${wk.id}">${img('eye')} Find</button></div></div>`;
    }
    html += '</div><h3>' + img('hat') + ' Hat rack</h3><p class="hint">Earn hats from achievements in the Journal, or buy a few here. Tap a farmhand to dress them up.</p><div class="list">';
    for (const [id, h] of Object.entries(HATS)) {
      const have = E.hatUnlocked(s, id);
      html += `<div class="urow ${have ? '' : 'locked'}"><img class="ava" src="${hatPreview(id)}" alt=""><div class="ui"><div class="un">${h.name}</div><div class="ud">${have ? 'In your hat rack' : h.cost ? 'For sale' : h.ribbons ? `Festival prize at the ${SEASONS.find((x) => x.id === h.festival).festival}` : h.bundle ? `Reward from the ${E.bundleLabel(h.bundle)}` : h.villager ? `A gift from ${VILLAGERS.find((v) => v.id === h.villager).name} at 3 hearts` : h.merchant ? 'Sold by the travelling merchant' : `Earned from ${achName(h.ach)}`}</div></div>
        ${have ? '<span class="max">OWNED</span>' : h.cost && !h.merchant ? `<button class="btn small" data-act="buyhat" data-id="${id}" data-need="${h.cost}">${coin(h.cost)}</button>` : h.ribbons && !E.seasonalBlock(this.w, h) ? `<button class="btn small" data-act="buyhat" data-id="${id}" ${s.ribbons < h.ribbons ? 'disabled' : ''}>${ribbon(h.ribbons)}</button>` : `<span class="lock">${img('lock')}</span>`}</div>`;
    }
    html += '</div>' + this.petsSection();
    html += '<p class="hint">Farmhands keep the job they were hired for. To change jobs, let someone go from their card (you get half the cost back) and hire someone new. Farmhands level up as they work: each level makes them 5% quicker at tasks and 4% faster on their feet.</p>';
    return { title: `${img('people', 'pi big')} Farmhands`, html };
  }
  petsSection() {
    const w = this.w, s = this.s;
    this.petPick ||= { kind: 'cat', color: 0 };
    const pk = this.petPick, room = s.pets.length < MAX_PETS, cost = E.nextPetCost(w);
    let html = `<h3>${img('heart')} Pets</h3><p class="hint">Pets wander the farm, nap in the sun and tag along with your farmhands. Each adds +5 charm. Tap one on the farm to give it a pat.</p>`;
    html += `<div class="hire"><div class="roles">${Object.entries(PETS).map(([k, p]) => `<button class="${pk.kind === k ? 'on' : ''}" data-act="petkind" data-v="${k}"><img class="pi big" src="${petPreview(k, 0)}" alt=""> ${p.name}</button>`).join('')}</div>
      <div class="chips">${PETS[pk.kind].colors.map((c, i) => `<button class="chip ${pk.color === i ? 'on' : ''}" data-act="petcolor" data-v="${i}"><img src="${petPreview(pk.kind, i)}" alt=""></button>`).join('')}</div>
      <div class="row"><span>${s.pets.length}/${MAX_PETS} pets</span><button class="btn green" data-act="adopt" ${room ? `data-need="${cost}"` : 'disabled'}>Adopt ${coin(cost)}</button></div></div>`;
    if (s.pets.length) html += '<div class="list">' + s.pets.map((p) => `<div class="urow"><img class="ava" src="${petPreview(p.kind, p.color)}" alt=""><div class="ui"><div class="un"><button class="link" data-act="renamepet" data-id="${p.id}">${esc(p.name)}</button></div><div class="ud">${PETS[p.kind].name}</div></div>
      <button class="btn small" data-act="findpet" data-id="${p.id}">${img('eye')} Find</button></div>`).join('') + '</div>';
    return html;
  }

  sheet_season() {
    const w = this.w, s = this.s, now = Date.now();
    const sea = seasonAt(now), fest = festivalOn(now);
    let html = `<div class="seasonbar ${sea.id}">${img(sea.id, 'pi big')}<div><b>${sea.name}</b><small>${seasonDaysLeft(now)} day${seasonDaysLeft(now) > 1 ? 's' : ''} left · seasons change every week</small></div></div>`;
    html += `<h3>In season (+${Math.round((SEASON_BONUS - 1) * 100)}% growth)</h3><div class="oi">${sea.favored.map((c) => `<span class="need ok">${itemImg(c)}${ITEMS[c].name}</span>`).join('')}</div>`;
    if (sea.id === 'winter') html += '<p class="hint">Winter is chilly: other crops grow 15% slower. Rain falls as snow.</p>';
    const seasonal = Object.keys(DEFS).filter((k) => DEFS[k].season === sea.id);
    html += `<h3>Only this season</h3><div class="grid">${seasonal.map((k) => this.buildTile(k)).join('')}</div>`;
    html += `<p class="hint">${Object.keys(CROPS).filter((c) => CROPS[c].season === sea.id).map((c) => `${ITEMS[c].name} seeds can only be planted now.`).join(' ')} Seasonal decorations are yours to keep.</p>`;
    html += `<h3>${img('ribbon')} ${sea.festival}</h3>`;
    if (!fest) {
      html += `<p>Festivals happen every weekend. The next one starts in about <b>${fmtTime(untilFestival(now) / 1000)}</b>.</p><p class="hint">Fill festival orders to win ribbons, then trade ribbons for decorations and hats you can’t get anywhere else. You have ${ribbon(s.ribbons)}.</p>`;
    } else {
      html += `<p>The ${sea.festival} is on all weekend! You have <b>${ribbon(s.ribbons)}</b>.</p>`;
      const orders = s.fest ? s.fest.orders : [];
      for (const o of orders) {
        const ok = E.canFill(w, o);
        html += `<div class="order fest ${ok ? 'ready' : ''}"><div class="of">${esc(o.from)} needs for the fair:</div><div class="oi">${o.items.map((x) => `<span class="need ${w.haveAll(x.item) >= x.qty ? 'ok' : ''}">${itemImg(x.item)}<b>${fmt(Math.min(w.haveAll(x.item), x.qty))}/${x.qty}</b> ${ITEMS[x.item].name}</span>`).join('')}</div>
          <div class="row"><span>${ribbon(o.ribbons)} + ${coin(o.reward)}</span><button class="btn small green" data-act="fillfest" data-id="${o.id}" ${ok ? '' : 'disabled'}>Deliver</button></div></div>`;
      }
      if (!orders.length) html += '<p class="hint">New festival orders are on their way.</p>';
    }
    const prizes = Object.keys(DEFS).filter((k) => DEFS[k].festival && (DEFS[k].festival === sea.id || DEFS[k].festival === 'any'));
    const hats = Object.entries(HATS).filter(([, h]) => h.festival === sea.id);
    html += `<h3>Festival prizes</h3><div class="grid">${prizes.map((k) => this.buildTile(k)).join('')}${hats.map(([id, h]) => `<div class="tile ${fest ? '' : 'locked'}"><img class="thumb" src="${hatPreview(id)}" alt=""><div class="tn">${h.name}</div><div class="tm">Hat</div>
      ${E.hatUnlocked(s, id) ? '<span class="max">OWNED</span>' : fest ? `<button class="btn small" data-act="buyhat" data-id="${id}" ${s.ribbons < h.ribbons ? 'disabled' : ''}>${ribbon(h.ribbons)}</button>` : `<span class="lock">${img('lock')} Festival only</span>`}</div>`).join('')}</div>`;
    return { title: `${img(sea.id, 'pi big')} ${fest ? sea.festival : 'Seasons & festivals'}`, html };
  }

  hatSelect(wk) {
    const own = Object.keys(HATS).filter((id) => E.hatUnlocked(this.s, id));
    return `<select data-chg="sethat" data-id="${wk.id}"><option value="">${ROLES[wk.role].name} hat</option>${own.map((id) => `<option value="${id}" ${wk.hat === id ? 'selected' : ''}>${HATS[id].name}</option>`).join('')}</select>`;
  }
  activity(wk) {
    const carry = wk.carry ? ` (carrying ${wk.carry.qty} ${ITEMS[wk.carry.item].name.toLowerCase()})` : '';
    return (wk._act || 'Getting ready') + carry;
  }
  live_workers() {
    const out = {};
    for (const wk of this.s.workers) out[`act${wk.id}`] = esc(this.activity(wk));
    return out;
  }

  sheet_market() {
    const w = this.w, s = this.s;
    const items = Object.keys(ITEMS).filter((k) => w.haveAll(k) > 0 || s.autoSell[k] !== undefined);
    const used = w.used();
    let html = `<div class="store"><div class="bar big ${used >= w.capacity ? 'full' : ''}"><i style="width:${Math.min(100, (used / w.capacity) * 100)}%"></i></div>
      <span data-live="store">${fmt(used)} / ${fmt(w.capacity)} stored</span><span class="hint">Prices +${Math.round((w.fx.sell - 1) * 100)}% from haggling & charm</span></div>`;
    html += `<div class="row"><button class="btn gold" data-act="sellcrops">${img('coin')} Sell all crops</button><span class="hint">Skips items set to auto-sell</span></div>`;
    if (!items.length) html += `<p class="empty">Storage is empty. Your farmhands will bring harvests here.</p>`;
    html += '<div class="list">';
    for (const k of items) {
      const auto = s.autoSell[k];
      html += `<div class="irow">${infoImg(k, 'pi big')}<div class="ii"><div class="in">${ITEMS[k].name}</div><div class="iq"><b data-live="q${k}">${this.qtyText(k)}</b> · ${coin(sellPrice(w, k))} each</div></div>
        <div class="ib"><button class="btn small" data-act="sell" data-item="${k}" data-n="1">Sell 1</button><button class="btn small gold" data-act="sell" data-item="${k}" data-n="all">All</button></div>
        <div class="ia"><label class="check"><input type="checkbox" data-chg="auto" data-item="${k}" ${auto !== undefined ? 'checked' : ''}> Auto-sell</label>
        ${auto !== undefined ? `<span class="keep">keep <button class="btn tiny" data-act="reserve" data-item="${k}" data-n="-5">−</button><b>${auto}</b><button class="btn tiny" data-act="reserve" data-item="${k}" data-n="5">+</button></span>` : ''}</div></div>`;
    }
    html += '</div><p class="hint">Auto-sell sells anything above the amount you keep, even while you are away. Keep some if a workshop needs it.</p>';
    const golds = Object.keys(s.gold).filter((k) => s.gold[k] > 0);
    if (golds.length) {
      html += `<h3>${img('star')} Gold-star produce</h3><p class="hint">Your best harvests, worth ${GOLD_MULT}× the usual price.</p><div class="list">`;
      for (const k of golds) html += `<div class="irow">${infoImg(k, 'pi big')}<div class="ii"><div class="in">Gold-star ${ITEMS[k].name} ${img('star')}</div><div class="iq"><b>${fmt(s.gold[k])}</b> · ${coin(E.goldPrice(w, k))} each</div></div>
        <div class="ib"><button class="btn small gold" data-act="sellgold" data-item="${k}" data-n="all">Sell all</button></div></div>`;
      html += '</div>';
    }
    html += `<div class="row"><span class="hint">Building materials and finds are kept separately: see everything you own in the Inventory.</span><button class="btn small" data-act="sheet" data-v="inventory">${img('box')} Inventory</button></div>`;
    return { title: `${img('market', 'pi big')} Market`, html };
  }
  matsLine() { return MATS.map((k) => `<span class="mat">${infoImg(k)}${fmt(this.w.mat(k))}</span>`).join(''); }
  live_market() {
    const w = this.w, out = { store: `${fmt(w.used())} / ${fmt(w.capacity)} stored` };
    for (const k in ITEMS) if (w.haveAll(k)) out[`q${k}`] = this.qtyText(k);
    return out;
  }
  qtyText(k) {
    const n = this.w.inBuildings(k);
    return fmt(this.w.haveAll(k)) + (n ? ` <span class="inb">(${fmt(n)} in workshops)</span>` : '');
  }

  sheet_quarry() {
    const w = this.w, s = this.s, q = s.quarry;
    const title = `${img('pick', 'pi big')} Quarry`;
    if (!q) return { title, html: `<p class="hint">Somewhere past the edge of your land there's an old quarry full of timber, stone and ore. Buy land along the edge of the map and a trail sign appears: tap it to find the quarry.</p>${this.shedHTML()}` };
    const miners = s.workers.filter((x) => x.role === 'miner').length;
    let html = `<p class="hint">Miners chop trees and dig stone and ore here, and the cart sends it to your material shed. Trees and veins grow back after a while. Miners keep working while you're away.</p>
      <div class="row"><span>${img('people')} ${miners} miner${miners === 1 ? '' : 's'}</span><span><button class="btn small" data-act="hireminer">Hire a miner</button> ${this.inQuarry() ? '' : `<button class="btn small green" data-act="goquarry">Visit</button>`}</span></div>`;
    html += this.shedHTML();
    html += `<h3>Quarry zones</h3><div class="list">`;
    QZONES.forEach((z, i) => {
      const open = i < q.zones, why = E.zoneBlock(w, i);
      const kinds = [...new Set(Object.keys(z.nodes).map((k) => QNODES[k].item))];
      html += `<div class="urow ${open ? '' : 'locked'}"><div class="ui"><div class="un">${z.name}</div><div class="ud">${kinds.map((k) => itemImg(k)).join('')} ${kinds.map((k) => ITEMS[k].name).join(', ')}</div>
        ${!open && z.mats ? `<div class="tmats">${matsHTML(z.mats, w)}</div>` : ''}</div>
        ${open ? '<span class="max">OPEN</span>' : why ? `<span class="lock">${img('lock')} ${why}</span>` : `<button class="btn small green" data-act="openzone" data-i="${i}" ${needAttr(z.cost, z.mats)}>Open ${coin(z.cost)}</button>`}</div>`;
    });
    html += '</div>';
    return { title, html };
  }
  shedHTML() {
    const w = this.w, s = this.s, L = s.shed || 1;
    let html = `<h3>${img('box')} Material shed</h3><div class="list">`;
    for (const k of MATS) {
      html += `<div class="irow">${infoImg(k, 'pi big')}<div class="ii"><div class="in">${ITEMS[k].name}</div><div class="iq"><b data-live="m${k}">${fmt(w.mat(k))}</b> / ${fmt(w.shedCap)} · ${coin(ITEMS[k].value)} each</div></div>
        <div class="ib"><button class="btn small" data-act="sellmat" data-item="${k}" data-n="10" ${w.mat(k) < 1 ? 'disabled' : ''}>Sell 10</button></div></div>`;
    }
    html += '</div>';
    if (L >= SHED_MAX) html += '<p class="hint">Your shed is as big as it gets.</p>';
    else { const c = shedCost(L); html += `<div class="row"><span>Bigger shed: hold ${fmt(shedCap(L + 1))} of each <span class="tmats">${matsHTML(c.mats, w)}</span></span><button class="btn small green" data-act="upgradeshed" ${needAttr(c.coins, c.mats)}>${img('up')} ${coin(c.coins)}</button></div>`; }
    return html;
  }
  live_quarry() { const out = {}; for (const k of MATS) out[`m${k}`] = fmt(this.w.mat(k)); return out; }

  // ---------- everything you own, wherever it is ----------
  sheet_inventory() {
    const w = this.w, s = this.s, tab = this.tab.inventory || 'all';
    const place = {}; // item -> { where: n }
    const put = (k, where, n) => { if (n > 0) ((place[k] ||= {})[where] = (place[k][where] || 0) + n); };
    for (const k in s.inv) put(k, 'Barn', s.inv[k]);
    for (const b of w.bldgs) { const nm = DEFS[b.type].name; for (const k in b.inp) put(k, `${nm} pantry`, b.inp[k]); for (const k in b.out) put(k, `${nm} (ready)`, b.out[k]); }
    for (const a of w.animals.concat(w.hives)) { const d = DEFS[a.type], k = d.hive ? d.hive.item : d.animal.item; put(k, `${d.name} (ready)`, a.out); }
    for (const p of s.piles) put(p.item, 'On the ground', p.qty);
    for (const x of s.workers) if (x.carry) put(x.carry.item, x.role === 'miner' ? 'Miner’s basket' : 'Being carried', x.carry.qty);
    for (const k in s.mats) put(k, 'Material shed', s.mats[k]);
    for (const k in s.finds) put(k, 'Finds shelf', s.finds[k]);
    const keys = Object.keys(place);
    const total = (k) => Object.values(place[k]).reduce((a, b) => a + b, 0);
    let html = `<p class="hint">Everything on your farm, wherever it is: the barn, workshop pantries, things waiting to be picked up, the material shed and more. Pantry and workshop stock counts for orders, bundles and selling too.</p>
      <div class="row"><span>${img('box')} Barn ${fmt(w.used())}/${fmt(w.capacity)}</span><span>${itemImg('stone')} Shed up to ${fmt(w.shedCap)} each</span></div>`;
    if (!keys.length) return { title: `${img('box', 'pi big')} Inventory`, tabs: this.invTabs(), html: html + '<p class="empty">Nothing yet. Your farmhands will fill this up.</p>' };
    if (tab === 'all') {
      const groups = [['Crops & fruit', (k) => CROPS[k] || SOURCES[k]?.some((t) => t !== 'plot' && DEFS[t]?.cat === 'tree')], ['Animal goods & fish', (k) => ITEMS[k].fishy || k === 'fish' || Object.values(ANIMAL_TREASURE).includes(k) || SOURCES[k]?.some((t) => DEFS[t]?.animal || DEFS[t]?.hive)],
        ['Made in workshops', (k) => SOURCES[k]?.some((t) => DEFS[t]?.recipes)], ['Materials', (k) => ITEMS[k].mat], ['Finds', (k) => ITEMS[k].find]];
      const used = new Set();
      for (const [name, test] of groups) {
        const list = keys.filter((k) => !used.has(k) && test(k)).sort((a, b) => total(b) - total(a));
        if (!list.length) continue;
        list.forEach((k) => used.add(k));
        html += `<h3>${name}</h3><div class="inv">${list.map((k) => `<button class="invi" data-act="iteminfo" data-item="${k}" title="${esc(Object.entries(place[k]).map(([p, n]) => `${p}: ${n}`).join(', '))}">${itemImg(k, 'pi big')}<b>${fmt(total(k))}</b><small>${esc(ITEMS[k].name)}</small><i>${esc(Object.keys(place[k]).length > 1 ? `${Object.keys(place[k]).length} places` : Object.keys(place[k])[0])}</i></button>`).join('')}</div>`;
      }
      const rest = keys.filter((k) => !used.has(k));
      if (rest.length) html += `<h3>Other</h3><div class="inv">${rest.map((k) => `<button class="invi" data-act="iteminfo" data-item="${k}">${itemImg(k, 'pi big')}<b>${fmt(total(k))}</b><small>${esc(ITEMS[k].name)}</small></button>`).join('')}</div>`;
    } else {
      const byPlace = {};
      for (const k of keys) for (const [p, n] of Object.entries(place[k])) (byPlace[p] ||= []).push([k, n]);
      const order = (p) => (p === 'Barn' ? 0 : p === 'Material shed' ? 2 : p === 'Finds shelf' ? 3 : /pantry/.test(p) ? 1 : 4);
      for (const p of Object.keys(byPlace).sort((a, b) => order(a) - order(b) || a.localeCompare(b))) {
        html += `<h3>${esc(p)}</h3><div class="oi">${byPlace[p].sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="need">${infoImg(k)}<b>${fmt(n)}</b> ${esc(ITEMS[k].name)}</span>`).join('')}</div>`;
      }
    }
    const golds = Object.keys(s.gold).filter((k) => s.gold[k] > 0);
    if (golds.length) html += `<h3>${img('star')} Gold-star shelf</h3><div class="oi">${golds.map((k) => `<span class="need">${itemImg(k)}<b>${fmt(s.gold[k])}</b> ${esc(ITEMS[k].name)} ${img('star')}</span>`).join('')}</div>`;
    html += `<div class="row center"><button class="btn small gold" data-act="sheet" data-v="market">${img('market')} Market</button><button class="btn small" data-act="sheet" data-v="quarry">${img('pick')} Quarry & shed</button><button class="btn small" data-act="museumtab">${img('book')} Museum</button></div>`;
    return { title: `${img('box', 'pi big')} Inventory`, tabs: this.invTabs(), html };
  }
  invTabs() { this.tab.inventory ||= 'all'; return this.tabs('inventory', [['all', 'Everything'], ['place', 'By place']]); }

  sheet_orders() {
    const tab = this.tab.orders;
    const v = merchantHere(this.w);
    const tabs = this.tabs('orders', [['orders', 'Orders'], ['friends', 'Neighbours'], ['village', 'Restore'], ['merchant', v ? 'Merchant!' : 'Merchant']]);
    const html = tab === 'friends' ? this.friendsHTML() : tab === 'village' ? this.villageHTML() : tab === 'merchant' ? this.merchantHTML() : this.ordersHTML();
    return { title: `${img('scroll', 'pi big')} Village`, tabs, html };
  }
  ordersHTML() {
    const w = this.w, s = this.s;
    let html = `<p class="hint">Neighbours post requests here. Orders pay much more than the market, give bonus XP and make friends. Neighbours ask for their favourite things most often.</p>`;
    if (!s.orders.length) html += `<p class="empty">No orders right now.</p>`;
    for (const o of s.orders) {
      const ok = E.canFill(w, o), v = VILLAGERS.find((x) => x.id === o.who);
      const fav = (k) => v && v.likes.includes(k) ? ` <span class="fav" title="${esc(v.name)} loves this">${img('heart')}</span>` : '';
      html += `<div class="order ${ok ? 'ready' : ''}"><div class="of">${esc(o.from)} would like:${v ? ` <span class="hearts">${this.heartsHTML(s.friends[v.id])}</span>` : ''}</div><div class="oi">${o.items.map((x) => {
        const have = w.haveAll(x.item);
        return `<span class="need ${have >= x.qty ? 'ok' : ''}">${itemImg(x.item)}<b data-live="o${o.id}${x.item}">${fmt(Math.min(have, x.qty))}/${x.qty}</b> ${ITEMS[x.item].name}${fav(x.item)}</span>`;
      }).join('')}</div>
        <div class="row"><span>Reward ${coin(o.reward)} <span class="xp">+${fmt(o.xp)} XP</span>${v ? ` <span class="xp">+${E.friendPoints(o)} ${img('heart')}</span>` : ''}</span>
        <span><button class="btn small" data-act="skip" data-id="${o.id}">Skip</button> <button class="btn small green" data-act="fill" data-id="${o.id}" ${ok ? '' : 'disabled'}>Deliver</button></span></div></div>`;
    }
    html += `<p class="hint" data-live="next">${this.nextOrderText()}</p>`;
    return html;
  }
  heartsHTML(pts = 0) {
    const h = heartsOf(pts);
    return HEARTS.map((_, i) => `<i class="ht ${i < h ? 'on' : ''}"></i>`).join('');
  }
  friendsHTML() {
    const s = this.s;
    let html = '<p class="hint">Fill a neighbour’s orders to become friends. Each heart brings a gift, and at five hearts they do you a lasting favour. Orders with their favourite things count extra.</p><div class="list">';
    for (const v of VILLAGERS) {
      const pts = s.friends[v.id] || 0, h = heartsOf(pts), next = HEARTS[h];
      const g = h < HEARTS.length ? E.heartGift(v, h + 1) : null;
      const giftText = (x) => x.coins ? coin(x.coins) : x.ribbons ? ribbon(x.ribbons) : x.hat ? `the ${HATS[x.hat].name}` : v.perkText;
      html += `<div class="friend"><div class="fh"><b>${esc(v.name)}</b><span class="hearts">${this.heartsHTML(pts)}</span></div>
        <div class="fd">${esc(v.about)}</div>
        <div class="fl">Loves ${v.likes.map((k) => infoImg(k)).join('')}</div>
        <div class="fn">${g ? `Next heart (${pts}/${next}): ${giftText(g)}` : `Best friends: ${esc(v.perkText)}`}</div></div>`;
    }
    return html + '</div>';
  }
  villageHTML() {
    const w = this.w;
    let html = '<p class="hint">The village next door has seen better days. Help fix it up: give goods, materials and coins a little at a time, whenever you have some spare. Each finished building helps your farm for good.</p><div class="list">';
    for (const p of PROJECTS) {
      const st = E.projectState(w, p.id);
      const slots = st.slots.map((x) => `<span class="need ${x.got >= x.need ? 'ok' : ''}">${x.k === 'coins' ? img('coin') : itemImg(x.k)}<b>${fmt(x.got)}/${fmt(x.need)}</b></span>`).join('');
      html += `<div class="order project ${st.done ? 'done' : ''} ${st.open ? '' : 'locked'}"><div class="of"><img class="thumb xs" src="${thumb(p.thumb)}" alt=""><b>${p.name}</b>${st.done ? ` <span class="max">RESTORED</span>` : ''}</div>
        <div class="shelfperk">${img('star')} ${esc(p.text)}</div>
        ${st.done ? '' : `<div class="oi">${slots}</div><div class="row"><span class="hint">${st.open ? 'Give what you have now, the rest later.' : `${img('lock')} Opens at farm level ${p.level}`}</span>
        <span><button class="btn small" data-act="payproject" data-id="${p.id}" ${st.canPay ? '' : 'disabled'}>Pay ${coin(Math.min(st.slots.find((x) => x.k === 'coins')?.left || 0, Math.max(0, Math.floor(this.s.coins))))}</button>
        <button class="btn small green" data-act="giveproject" data-id="${p.id}" ${st.canGive ? '' : 'disabled'}>Give goods</button></span></div>`}</div>`;
    }
    return html + '</div>';
  }
  merchantHTML() {
    const w = this.w, s = this.s;
    if (!w.fx.merchant) return `<p class="hint">Travelling merchants stopped coming when the old bridge fell down. Restore the <b>Old Stone Bridge</b> (in the Restore tab) and they’ll visit every couple of days with rare wares.</p>`;
    const v = merchantHere(w);
    if (!v) { const n = nextVisit(Date.now()); return `<p class="hint">The merchant’s cart is on the road. Next visit in about <b>${fmtTime((n.start - Date.now()) / 1000)}</b>, for ${fmtTime((n.end - n.start) / 1000)}. Wares change every visit.</p>`; }
    let html = `<p class="hint">Rare wares, this visit only. The cart leaves in <b data-live="mleft">${fmtTime((v.end - Date.now()) / 1000)}</b>.</p><div class="list">`;
    for (const o of stockOf(v.k)) {
      const [kind, id] = o.key.split(':'), out = soldOut(s, v, o.key);
      const pic = kind === 'mat' ? itemImg(id, 'pi big') : kind === 'decor' ? `<img class="ava" src="${thumb(id)}" alt="">` : kind === 'hat' ? `<img class="ava" src="${hatPreview(id)}" alt="">` : img('star', 'pi big');
      const desc = kind === 'mat' ? 'Straight into the material shed' : kind === 'decor' ? `Only from the merchant · +${DEFS[id].charm} charm` : kind === 'hat' ? 'A hat for your hat rack' : PERKS[id].desc;
      html += `<div class="urow ${out ? 'locked' : ''}">${pic}<div class="ui"><div class="un">${offerName(o.key)}</div><div class="ud">${esc(desc)}</div></div>
        ${out ? '<span class="max">SOLD</span>' : `<button class="btn small green" data-act="buyoffer" data-key="${o.key}" data-need="${o.price}">${coin(o.price)}</button>`}</div>`;
    }
    return html + '</div>';
  }
  nextOrderText() {
    const s = this.s;
    if (s.orders.length >= this.w.fx.orderSlots) return 'The board is full. Deliver or skip an order to get a new one.';
    return `Next order in about ${fmtTime((s.nextOrderAt - Date.now()) / 1000)}.`;
  }
  live_orders() {
    const w = this.w, out = { next: this.nextOrderText() };
    const v = merchantHere(w); if (v) out.mleft = fmtTime((v.end - Date.now()) / 1000);
    for (const o of this.s.orders) for (const x of o.items) out[`o${o.id}${x.item}`] = `${fmt(Math.min(w.haveAll(x.item), x.qty))}/${x.qty}`;
    return out;
  }

  sheet_journal() {
    const w = this.w, s = this.s, tab = this.tab.journal;
    let html = '';
    if (tab === 'goals') {
      const st = this.goalState();
      html += `<p class="hint">Goals guide you through everything the farm can become. ${s.goal} of ${GOALS.length} done.</p>`;
      if (st) html += `<div class="order ${st.done ? 'ready' : ''}"><div class="of">${img('star')} ${esc(st.g.text)}</div><div class="bar"><i style="width:${(st.v / st.g.n) * 100}%"></i></div>
        <div class="row"><span>${fmt(st.v)} / ${fmt(st.g.n)}</span>${st.done ? `<button class="btn small gold" data-act="claim">Claim ${coin(st.g.reward)}</button>` : `<span>Reward ${coin(st.g.reward)}</span>`}</div></div>`;
      else html += '<p class="empty">Every goal complete. What a farm!</p>';
      html += '<h3>Coming up</h3><div class="list">' + GOALS.slice(s.goal + 1, s.goal + 6).map((g) => `<div class="urow"><span class="ui">${esc(g.text)}</span>${coin(g.reward)}</div>`).join('') + '</div>';
    } else if (tab === 'ach') {
      html += '<div class="list">';
      for (const a of ACHIEVEMENTS) {
        const st = E.achState(w, a);
        const hats = Object.entries(HATS).filter(([, h]) => h.ach && h.ach.startsWith(a.id + ':')).map(([, h]) => `${img('hat')} ${h.name} at ${roman(+h.ach.split(':')[1] + 1)}`).join(' ');
        const target = st.done ? a.tiers[a.tiers.length - 1] : st.next;
        html += `<div class="urow ${st.done ? 'doneach' : ''}">${img('trophy', 'pi big')}<div class="ui"><div class="un">${a.name} ${st.claimed ? roman(st.claimed) : ''}</div>
          <div class="ud">${a.what}: ${fmt(Math.min(st.value, target))} / ${fmt(target)}${hats ? ` · ${hats}` : ''}</div>
          <div class="pips">${a.tiers.map((_, i) => `<i class="${i < st.claimed ? 'on' : ''}"></i>`).join('')}</div></div>
          ${st.ready ? `<button class="btn small gold" data-act="claimach" data-id="${a.id}">Claim ${coin(achReward(a, st.claimed))}</button>` : st.done ? '<span class="max">DONE</span>' : ''}</div>`;
      }
      html += '</div>';
    } else if (tab === 'bundles') {
      html += this.bundlesHTML();
    } else {
      html += this.museumHTML();
    }
    return { title: `${img('book', 'pi big')} Journal`, tabs: this.tabs('journal', [['goals', 'Goals'], ['ach', `Trophies${E.claimableAch(w) ? ` (${E.claimableAch(w)})` : ''}`], ['bundles', `Bundles${E.bundlesReady(w) ? ` (${E.bundlesReady(w)})` : ''}`], ['museum', `Museum${this.donatable() ? ` (${this.donatable()})` : ''}`]]), html };
  }

  donatable() { const s = this.s; return Object.keys(ITEMS).filter((k) => !s.museum[k] && E.museumHave(this.w, k) > 0).length; }
  museumHTML() {
    const w = this.w, s = this.s, wings = museumWings(s);
    const shown = Object.keys(s.museum).length, total = wings.reduce((a, x) => a + x.items.length, 0), ready = this.donatable();
    let html = `<p class="hint">The village museum wants one of everything: crops, cooking, animal goods, fish, ore and the fossils your miners dig up. Each finished wing gives a lasting bonus. <b>${shown} / ${total}</b> on display.</p>`;
    if (ready) html += `<div class="row"><span>${ready} thing${ready > 1 ? 's' : ''} you have can go on display</span><button class="btn small green" data-act="donateall">Donate all new</button></div>`;
    for (const wg of wings) {
      html += `<h3>${esc(wg.name)} <small class="shelf">${wg.n}/${wg.items.length}</small></h3><p class="hint shelfperk ${wg.done ? 'on' : ''}">${wg.done ? img('check') + ' ' : 'Finish it: '}${esc(wg.perkText)}</p><div class="collection">`;
      for (const k of wg.items) {
        const on = s.museum[k], have = !on && E.museumHave(w, k) > 0, seen = on || have || (s.stats.harvest[k] || 0) + (s.stats.craft[k] || 0) > 0;
        html += on ? `<div class="ci on" title="${esc(ITEMS[k].name)}: on display">${itemImg(k, 'pi big')}<small>${esc(ITEMS[k].name)}</small></div>`
          : have ? `<button class="ci give" data-act="donate" data-item="${k}" title="Donate a ${esc(ITEMS[k].name)}">${itemImg(k, 'pi big')}<small>Donate</small></button>`
          : `<div class="ci ${seen ? 'missing' : 'unknown'}" title="${esc(seen ? `${ITEMS[k].name}: you'll need another one` : sourceOf(k))}">${itemImg(k, 'pi big')}<small>${seen ? esc(ITEMS[k].name) : '???'}</small></div>`;
      }
      html += '</div>';
    }
    html += `<p class="hint">Fill every wing: ${coin(MUSEUM_REWARD.coins)} and +${MUSEUM_REWARD.charm} charm. Hover or tap and hold a ??? to see where it comes from.</p>`;
    return html;
  }
  rewardHTML(r) {
    const out = [];
    if (r.coins) out.push(coin(r.coins));
    if (r.ribbons) out.push(ribbon(r.ribbons));
    if (r.decor) out.push(`<span class="need"><img class="thumb xs" src="${thumb(r.decor)}" alt="">${DEFS[r.decor].name}</span>`);
    if (r.hat) out.push(`<span class="need"><img class="thumb xs" src="${hatPreview(r.hat)}" alt="">${HATS[r.hat].name}</span>`);
    return out.join(' ');
  }
  bundlesHTML() {
    const w = this.w, s = this.s, sea = seasonAt(Date.now());
    const total = BUNDLE_ROOMS.reduce((n, r) => n + r.bundles.length, 0), done = Object.keys(s.bundles.done).filter((k) => !k.includes(':') && k !== 'all').length;
    let html = `<p class="hint">The village pantry: give goods from storage or your workshops to fill bundles and earn rewards. Fill a whole shelf for a lasting bonus. Seasonal crops only grow in their season, so save some for these. <b>${done} / ${total}</b> bundles done.</p>`;
    for (const r of BUNDLE_ROOMS) {
      const rd = E.bundleDone(s, `room:${r.id}`), n = r.bundles.filter((b) => s.bundles.done[b.id]).length;
      html += `<h3>${img(r.icon)} ${r.name} <small class="shelf">${n}/${r.bundles.length}</small></h3>
        <p class="hint shelfperk ${rd ? 'on' : ''}">${rd ? `${img('check')} ${r.perkText}` : `Fill the shelf: ${r.perkText.toLowerCase()} + ${this.rewardHTML(r.reward)}`}</p>`;
      for (const b of r.bundles) {
        const st = E.bundleState(w, b.id);
        const tag = b.season ? `<span class="stag ${b.season === sea.id ? 'on' : ''}">${img(b.season)} ${SEASONS.find((x) => x.id === b.season).name} crops</span>` : '';
        if (!st.open) { html += `<div class="order bundle locked"><div class="of">${esc(b.name)} ${tag}</div><span class="lock">${img('lock')} Opens at Lv ${b.level}</span></div>`; continue; }
        const slots = st.slots.map((x) => `<button class="need ${x.left ? '' : 'ok'}" data-act="givebundle" data-id="${b.id}" data-item="${x.item}" ${st.done || !x.left || !x.have ? 'disabled' : ''} title="You have ${fmt(x.have)}">${itemImg(x.item)}<b>${x.got}/${x.need}</b> ${ITEMS[x.item].name}${x.left && !st.done ? `<small>· have ${fmt(x.have)}</small>` : ''}</button>`).join('');
        html += `<div class="order bundle ${st.done ? 'done' : st.ready ? 'ready' : ''}"><div class="of">${esc(b.name)} ${tag}</div><div class="oi">${slots}</div>
          <div class="row"><span>${st.done ? `${img('check')} Done` : `Reward ${this.rewardHTML(b.reward)}`}</span>${st.done ? '' : `<button class="btn small green" data-act="givebundle" data-id="${b.id}" ${st.canGive ? '' : 'disabled'}>Give all I can</button>`}</div></div>`;
      }
    }
    html += `<p class="hint">Finish every bundle: ${this.rewardHTML(ALL_BUNDLES_REWARD)}</p>`;
    return html;
  }

  sheet_upgrades() {
    const s = this.s;
    let html = '<div class="list">';
    for (const u of UPGRADES) {
      const l = s.upgrades[u.id] || 0;
      const lock = s.level < u.level, max = l >= u.max;
      const cost = upgradeCost(u, l);
      html += `<div class="urow ${lock ? 'locked' : ''}">${img(u.icon, 'pi big')}<div class="ui"><div class="un">${u.name}</div><div class="ud">${esc(u.desc)}</div>
        <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div></div>
        ${lock ? `<span class="lock">${img('lock')} Lv ${u.level}</span>` : max ? '<span class="max">MAX</span>' : `<button class="btn small green" data-act="upg" data-id="${u.id}" data-need="${cost}">${coin(cost)}</button>`}</div>`;
    }
    html += '</div><p class="hint">Buildings upgrade separately: tap a building on your farm.</p>';
    html += this.bonusesHTML();
    return { title: `${img('up', 'pi big')} Upgrades`, html };
  }

  bitingNow() {
    const w = this.w, hr = new Date().getHours(), night = hr >= 20 || hr < 5;
    return FISH.filter((f) => f.w >= 1 && (!f.seasons || f.seasons.includes(w.season?.id)) && (!f.night || night) && (!f.weather || f.weather.includes(w.weather))).map((f) => f.id);
  }
  /** Every lasting bonus earned so far and where it came from. */
  bonusesHTML() {
    const s = this.s, rows = [];
    for (const r of BUNDLE_ROOMS) if (s.bundles.done[`room:${r.id}`]) rows.push([r.name, r.perkText]);
    for (const v of VILLAGERS) if ((s.friends[v.id] || 0) >= HEARTS[HEARTS.length - 1]) rows.push([`${v.name} (best friends)`, v.perkText]);
    for (const p of PROJECTS) if (s.village.done[p.id]) rows.push([p.name, p.text]);
    for (const wg of museumWings(s)) if (wg.done) rows.push([`Museum: ${wg.name}`, wg.perkText]);
    for (const id in s.perks) if (PERKS[id]) rows.push([PERKS[id].name, PERKS[id].desc]);
    return `<h3>${img('star')} Lasting bonuses</h3>` + (rows.length
      ? `<div class="list">${rows.map(([a, b]) => `<div class="urow"><div class="ui"><div class="un">${esc(a)}</div><div class="ud">${esc(b)}</div></div>${img('check')}</div>`).join('')}</div>`
      : '<p class="hint">Finish bundle shelves, become best friends with neighbours, restore the village, fill museum wings or buy the merchant’s rare wares to earn bonuses that last for good.</p>');
  }

  sheet_menu() {
    const s = this.s, w = this.w;
    const tab = this.tab.menu;
    let html = '';
    if (tab === 'pals') html += this.palsHTML();
    else if (tab === 'farm') {
      const u = Cloud.user();
      html += `<h3>${img('cloud')} Account & cloud save</h3>`;
      if (u) {
        const st = Cloud.status;
        html += `<p>Signed in as <b>${esc(u.email)}</b>.</p><p class="hint" data-live="sync">${this.syncText()}</p>
          <div class="row"><button class="btn" data-act="syncnow">Sync now</button><button class="btn" data-act="signout">Sign out</button></div>`;
        void st;
      } else {
        html += `<p class="hint">Sign in to keep this farm in the cloud and play the same farm on your phone and laptop. Everyone who signs in gets their own private farm.</p>
          <form class="signin" onsubmit="return false"><input id="si-email" type="email" autocomplete="username" placeholder="Email">
          <input id="si-pass" type="password" autocomplete="current-password" placeholder="Password">
          <div class="row"><button class="btn green" data-act="signin">Sign in</button><button class="btn" data-act="signup">Create account</button></div></form>
          <p class="hint" id="si-msg"></p>`;
      }
      html += `<h3>${img('gear')} Settings</h3>
        <label class="check"><input type="checkbox" data-chg="setting" data-k="grid" ${s.settings.grid ? 'checked' : ''}> Always show the tile grid</label>
        <label class="check"><input type="checkbox" data-chg="helpers" ${s.settings.helpers ? 'checked' : ''}> Farmhands help with other jobs when idle</label>`;
      html += `<h3>${img('star')} Farm stats</h3><div class="stats">
        <span>Coins earned</span><b>${fmt(s.stats.earned)}</b>
        <span>Crops harvested</span><b>${fmt(Object.entries(s.stats.harvest).filter(([k]) => CROPS[k]).reduce((a, [, v]) => a + v, 0))}</b>
        <span>Goods crafted</span><b>${fmt(Object.values(s.stats.craft).reduce((a, v) => a + v, 0))}</b>
        <span>Orders filled</span><b>${fmt(s.stats.orders)}</b>
        <span>Land owned</span><b>${s.map.owned.filter(Boolean).length} / ${s.map.owned.length} parcels</b>
        <span>Farm started</span><b>${new Date(s.created).toLocaleDateString()}</b>
        <span>Away limit</span><b>${w.fx.offlineH} hours</b></div>`;
      html += `<h3>${img('box')} Backups</h3><p class="hint">Save a copy of this farm to a file, or load one back.</p>
        <div class="row"><button class="btn" data-act="backup">Download backup</button><button class="btn" data-act="restore">Restore backup…</button></div>
        <input id="restore-file" type="file" accept=".json,application/json" hidden>`;
      html += `<h3>Danger zone</h3><button class="btn red" data-act="reset">Start a new farm…</button>`;
    } else {
      html += `<div class="help">
        <p><b>The idea:</b> lay fields, and your farmhands plant, water, harvest and carry everything to storage. Sell goods, then spend coins to grow.</p>
        <p><b>Controls:</b> drag to move around, pinch or scroll to zoom. Tap anything to see it up close. In build mode, drag to paint fields, paths and fences (use two fingers or right-drag to move the view).</p>
        <p><b>Farmhands:</b> each has a job. Farmers tend fields and trees, Haulers carry harvests and stock workshops, Artisans run workshops, Ranchers care for animals and bees. When their own work is done they help elsewhere.</p>
        <p><b>Making things:</b> workshops turn crops into goods worth much more. Tap a workshop to pick a recipe, or leave it on Auto to make the most valuable thing it can.</p>
        <p><b>While you are away:</b> the farm keeps running for up to ${w.fx.offlineH} hours (Night Shift adds more). Coins from auto-sell wait for you to collect. Storage limits apply, so upgrade your barn and use auto-sell.</p>
        <p><b>Tips:</b> paths make farmhands faster. Put storage crates near far-off fields. Wells and sprinklers make crops grow faster. Rain waters everything for free. Flowers near beehives make more honey. Expand out to the stream or pond and build a Fishing Dock to catch fish.</p>
        <p><b>Materials:</b> buildings need wood and stone, and better ones need copper, iron and gold ore. Farmhands clear fallen branches and rocks on your land for a little. For lots more, buy land at the edge of the map, follow the trail sign to the quarry and hire Miners. New buildings take a while to go up, and idle farmhands help.</p>
        <p><b>The village:</b> neighbours post orders on the notice board. Fill them to make friends (each heart brings a gift). Restore the village buildings for lasting bonuses; fixing the old bridge brings a travelling merchant every couple of days.</p>
        <p><b>Long-term:</b> the Journal tracks goals, tiered achievements (some unlock hats for your farmhands) and a collection book of every good on the farm.</p>
        <p><b>Install on your phone:</b> on iPhone open this page in Safari, tap Share, then "Add to Home Screen". On Android tap the menu, then "Install app".</p></div>`;
    }
    return { title: `${img('menu', 'pi big')} Menu`, tabs: this.tabs('menu', [['farm', 'Farm'], ['pals', 'Friends'], ['help', 'How to play']]), html };
  }
  // ---------- real friends: share your farm, visit theirs, send gifts ----------
  palsHTML() {
    const s = this.s, p = this.pals;
    if (!Cloud.user()) return '<p class="hint">Sign in (Menu → Farm) to share your farm with friends, visit theirs and send each other a gift basket every day.</p>';
    if (!p) { this.loadPals(); return '<p class="hint">Loading…</p>'; }
    if (p.notSetUp) return '<p class="hint">Friends aren’t switched on for this game yet. (Whoever runs the game needs to set up the friends tables once.)</p>';
    let html = '<p class="hint">Share your farm to get a code, then swap codes with friends. Visiting is look-only: nothing you do there changes anyone’s farm. You can send each friend one gift basket a day.</p>';
    html += `<h3>${img('user')} Your farm</h3>`;
    if (s.share) html += `<div class="row"><span>Your code: <b class="code">${esc(s.share.code)}</b></span><button class="btn small" data-act="unshare">Stop sharing</button></div>`;
    html += `<div class="row"><input id="share-name" maxlength="24" placeholder="Name friends will see" value="${esc(s.share?.name || this.lastShareName || '')}"><button class="btn small green" data-act="sharefarm">${s.share ? 'Save name' : 'Share my farm'}</button></div>`;
    html += `<h3>${img('people')} Friends</h3><div class="row"><input id="pal-code" maxlength="8" placeholder="Friend’s code" autocomplete="off" autocapitalize="characters"><button class="btn small green" data-act="addpal">Add friend</button></div>`;
    const pals = s.pals || [];
    if (!pals.length) html += '<p class="empty">No friends added yet.</p>';
    html += '<div class="list">' + pals.map((f) => {
      const sent = p.sent.includes(f.code);
      return `<div class="urow"><div class="ui"><div class="un">${esc(f.name)}</div><div class="ud">Code ${esc(f.code)}</div></div>
        <span><button class="btn small" data-act="visitpal" data-code="${f.code}">${img('eye')} Visit</button> <button class="btn small gold" data-act="giftpal" data-code="${f.code}" ${sent ? 'disabled' : ''}>${sent ? 'Gift sent' : `${img('heart')} Gift`}</button> <button class="btn small" data-act="removepal" data-code="${f.code}">${img('x')}</button></span></div>`;
    }).join('') + '</div>';
    if (!s.share) html += '<p class="hint">Friends can only send you gifts once you share your farm.</p>';
    return html;
  }
  async loadPals() {
    if (this.palsLoading) return;
    this.palsLoading = true;
    try {
      const mine = await Cloud.myShare();
      if (mine) this.s.share = { code: mine.code, name: mine.name }; else delete this.s.share;
      this.pals = { sent: await Cloud.giftsSentToday(today()) };
    } catch (e) { this.pals = e instanceof Cloud.NotSetUp ? { notSetUp: true } : { sent: [], error: e.message }; }
    this.palsLoading = false;
    if (this.sheet === 'menu') this.renderSheet();
  }
  async palAct(a, d) {
    const s = this.s;
    try {
      if (a === 'sharefarm') {
        this.wasShared = !!s.share;
        const name = ($('#share-name')?.value || '').trim().slice(0, 24);
        if (!name) { this.toast('Pick a name for your farm first', 'bad'); return; }
        this.lastShareName = name;
        const row = await Cloud.share(name, farmSnapshot(s));
        s.share = { code: row.code, name: row.name };
        this.toast(s.share && this.wasShared ? 'Name saved' : `Shared! Your farm code is ${row.code}`, 'good');
      } else if (a === 'unshare') {
        await Cloud.unshare(); delete s.share; this.toast('Your farm is no longer shared');
      } else if (a === 'addpal') {
        const code = Cloud.cleanCode($('#pal-code')?.value);
        if (code.length !== 6) { this.toast('Codes are 6 letters and numbers', 'bad'); return; }
        if (code === s.share?.code) { this.toast('That’s your own code!', 'bad'); return; }
        if ((s.pals || []).some((f) => f.code === code)) { this.toast('Already on your list'); return; }
        const row = await Cloud.fetchFarm(code, false);
        if (!row) { this.toast('No shared farm has that code', 'bad'); return; }
        (s.pals ||= []).push({ code, name: row.name });
        this.toast(`${row.name} added!`, 'good');
      } else if (a === 'removepal') {
        s.pals = (s.pals || []).filter((f) => f.code !== d.code);
      } else if (a === 'visitpal') {
        this.openSheet(null);
        await this.g.visit(d.code);
        return;
      } else if (a === 'giftpal') {
        const ok = await Cloud.sendGift(d.code, s.share?.name || 'A friend', today());
        this.pals?.sent.push(d.code);
        this.toast(ok ? 'Gift basket sent!' : 'You already sent them one today', ok ? 'good' : '');
      }
      this.g.dirty();
    } catch (e) { this.toast(e instanceof Cloud.NotSetUp ? e.message : e.message || 'Something went wrong', 'bad'); }
    if (this.sheet === 'menu') this.renderSheet(); else this.renderScenebar();
  }

  syncText() {
    const st = Cloud.status;
    const when = st.last ? new Date(st.last).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'not yet';
    return { ok: `Saved to the cloud (last sync ${when}).`, syncing: 'Syncing…', offline: 'Offline: saved on this device, will sync when back online.', error: `Sync problem: ${esc(st.error)}`, off: 'Not syncing.' }[st.state] || '';
  }
  live_menu() { return { sync: this.syncText() }; }

  async signIn(create) {
    const email = $('#si-email').value.trim(), pass = $('#si-pass').value;
    const msg = $('#si-msg');
    if (!email || !pass) { msg.textContent = 'Enter your email and password.'; return; }
    msg.textContent = create ? 'Creating your account…' : 'Signing in…';
    try {
      if (create) {
        const r = await this.g.signUp(email, pass);
        if (r === 'confirm') { msg.textContent = 'Check your email to confirm your account, then sign in here.'; return; }
      } else await this.g.signIn(email, pass);
      this.renderSheet();
    } catch (e) {
      msg.textContent = e.message === 'Invalid login credentials' ? 'That email and password don’t match.' : e.message;
    }
  }

  downloadBackup() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(exportSave(this.s));
    a.download = `pocket-meadow-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    this.toast('Backup downloaded', 'good');
  }
  async restoreFile(file) {
    let state;
    try { state = parseSave(await file.text()); } catch (e) { this.toast(e.message || 'Couldn’t read that file', 'bad'); return; }
    this.modal(`<h2>Restore this backup?</h2><p>Load a level ${state.level} farm with ${fmt(state.coins)} coins. It replaces the farm you have now${Cloud.user() ? ', on every device' : ''}.</p>`,
      [['Cancel', 'no'], ['Restore', 'yes', 'green']], (v) => { if (v === 'yes') this.g.restore(state); });
  }

  // ---------- selection card ----------
  select(obj, keepSheet) {
    this.sel = obj;
    this.g.R.overlay = this.overlay();
    if (obj && !keepSheet && this.sheet) this.openSheet(null);
    this.renderCard();
  }
  renderCard() {
    const el = $('#card');
    const o = this.sel;
    if (!o || !this.exists(o)) { el.classList.remove('open'); this.sel = null; this.g.R.overlay = this.overlay(); return; }
    const c = o.role ? this.workerCard(o) : o.kind && PETS[o.kind] ? this.petCard(o) : this.objCard(o);
    el.innerHTML = `<div class="ch">${c.icon}<div class="ct"><h2>${c.title}</h2><div class="cs">${c.sub || ''}</div></div><button class="x" data-act="deselect" aria-label="Close">${img('x')}</button></div>
      <div class="cb">${c.body || ''}</div>${c.btns ? `<div class="cbtn">${c.btns}</div>` : ''}`;
    el.classList.add('open');
    this.cardLive = c.live;
    this.updateNeeds(el);
  }
  liveCard() {
    if (!this.sel) return;
    if (!this.exists(this.sel)) { this.select(null); return; }
    if (!this.cardLive) return;
    const vals = this.cardLive();
    const el = $('#card');
    for (const k in vals) {
      const n = el.querySelector(`[data-live="${k}"]`);
      if (n && n._v !== vals[k]) { n.innerHTML = vals[k]; n._v = vals[k]; }
    }
    this.updateNeeds(el);
  }

  exists(o) { return o.role ? this.s.workers.includes(o) : o.kind && PETS[o.kind] ? this.s.pets.includes(o) : this.w.byId.has(o.id); }

  petCard(p) {
    return {
      icon: `<img class="ava" src="${petPreview(p.kind, p.color)}" alt="">`,
      title: esc(p.name), sub: `Your ${PETS[p.kind].name.toLowerCase()}`,
      body: `<p class="hint">${esc(p.name)} has had ${fmt(this.s.stats.pats || 0)} pats from you in total. They love it.</p>`,
      btns: `<button class="btn small gold" data-act="pat">${img('heart')} Give a pat</button><button class="btn small" data-act="renamepet" data-id="${p.id}">Rename</button>`,
    };
  }

  renamePet(id) {
    const p = this.s.pets.find((x) => x.id === id);
    if (!p) return;
    this.modal(`<h2>Rename ${esc(p.name)}</h2><input id="rn" maxlength="14" value="${esc(p.name)}">`, [['Cancel', 'no'], ['Save', 'yes', 'green']], (v) => {
      const n = $('#rn')?.value.trim();
      if (v === 'yes' && n) { p.name = n; this.g.dirty(); this.sheet ? this.renderSheet() : this.renderCard(); }
    }, () => { const i = $('#rn'); i.focus(); i.select(); });
  }

  workerCard(wk) {
    const need = workerXpNeeded(wk.lvl);
    return {
      icon: `<img class="ava" src="${avatar(wk)}" alt="">`,
      title: `${esc(wk.name)} <span class="lv">Lv ${wk.lvl}</span>`,
      sub: ROLES[wk.role].name,
      body: `<div class="wa" data-live="act">${esc(this.activity(wk))}</div>
        <div class="bar thin"><i data-live="xpbar" style="width:${wk.lvl >= MAX_WORKER_LEVEL ? 100 : (wk.xp / need) * 100}%"></i></div>
        <div class="row"><span>Job</span><b>${ROLES[wk.role].name}</b></div>
        <div class="row"><span>Hat</span>${this.hatSelect(wk)}</div>
        <p class="hint">${esc(ROLES[wk.role].desc)}</p>`,
      btns: `<button class="btn small" data-act="rename" data-id="${wk.id}">Rename</button><button class="btn small" data-act="fire" data-id="${wk.id}">Let go</button>`,
      live: () => ({ act: esc(this.activity(wk)) }),
    };
  }

  objCard(o) {
    const w = this.w, s = this.s, d = DEFS[o.type];
    const moveBtn = d.fixed && d.cat !== 'special' && d.cat !== 'house' ? '' : `<button class="btn small" data-act="move">${img('move')} Move</button>`;
    const rmBtn = d.fixed ? '' : `<button class="btn small" data-act="remove">${img('trash')} Remove</button>`;
    const um = d.upg && o.lvl < d.maxLvl ? upgMatsFor(o) : null;
    const upBtn = d.upg ? (o.lvl >= d.maxLvl ? '<span class="max">MAX LEVEL</span>'
      : `<button class="btn small green" data-act="upgradeb" ${needAttr(E.bUpgradeCost(o), um)}>${img('up')} Upgrade ${coin(E.bUpgradeCost(o))}${um ? `<span class="bmats">${matsHTML(um, w)}</span>` : ''}</button>`) : '';
    const lvl = o.lvl ? ` <span class="lv">Lv ${o.lvl}${d.maxLvl ? `/${d.maxLvl}` : ''}</span>` : '';
    const power = `<div class="row power ${o.off ? 'off' : ''}"><span><b>${o.off ? 'Switched off' : 'Working'}</b></span><button class="btn small ${o.off ? 'green' : ''}" data-act="toggleoff">${o.off ? 'Turn on' : 'Turn off'}</button></div>`;
    const base = { icon: `<img class="thumb" src="${thumb(o.type, o.crop)}" alt="">`, title: d.name + lvl, btns: upBtn + moveBtn + rmBtn };
    if (o.build > 0) {
      const info = () => ({ st: `Going up: ${fmtTime(o.build)} left${o._cb ? ' · a farmhand is helping' : ''}`, pb: `<i style="width:${(1 - o.build / (o.buildT || o.build)) * 100}%"></i>` });
      const v = info();
      return { ...base, title: d.name, sub: 'Under construction',
        body: `<div class="status" data-live="st">${v.st}</div><div class="bar" data-live="pb">${v.pb}</div>
          <p class="hint">It starts working once it's finished. Any farmhand with nothing else to do will come and help, which speeds it up. It keeps building while you're away. Removing it now gives back everything you paid.</p>`,
        btns: moveBtn + rmBtn, live: info };
    }
    if (d.cat === 'debris') {
      return { ...base, title: d.name, sub: `Gives ${E.matsText(d.gives)}`,
        body: `<p class="hint">${esc(d.desc)} A farmhand will clear it when they have a moment, or you can clear it yourself now.</p>`,
        btns: `<button class="btn small green" data-act="cleardebris">${img('trash')} Clear it ${matsHTML(d.gives)}</button>` };
    }
    if (o.type === 'plot' && !o.crop) return this.bareCard(o, base, moveBtn, rmBtn);
    if (o.type === 'plot') {
      const cr = CROPS[o.crop];
      const status = () => {
        let t;
        if (o.st === 'empty') t = !cropUnlocked(s, o.crop) ? 'Seed locked' : !canPlantNow(o.crop, seasonAt(Date.now())) && !w.sheltered.has(o.y * MAP.w + o.x) ? `Waiting for ${SEASONS.find((x) => x.id === cr.season).name} to plant again (or build a Greenhouse nearby)`
          : !E.canAffordSeeds(w, o.crop) ? `Needs ${fmt(cr.seed)} coins for seeds` : 'Waiting for a farmer to plant';
        else if (o.st === 'ripe') t = '✨ Ripe! A farmer will harvest it soon';
        else t = `Growing ${Math.floor(o.p * 100)}% · ${fmtTime(((1 - o.p) * cr.time) / (w.fx.grow * (o.wet ? w.fx.water : 1)))} left${o.wet ? ' · watered' : ''}`;
        return o.next ? `${t}<small class="next">Then ${itemImg(o.next)} ${ITEMS[o.next].name}, planted after this harvest</small>` : t;
      };
      const crops = CROP_ORDER.filter((c) => s.level >= CROPS[c].level).map((c) => s.seeds[c]
        ? `<button class="chip ${o.crop === c ? 'on' : ''} ${o.next === c ? 'queued' : ''}" data-act="setcrop" data-crop="${c}" title="${ITEMS[c].name} · seeds ${CROPS[c].seed}">${itemImg(c)}<small>${CROPS[c].seed ? fmtShort(CROPS[c].seed) : 'free'}</small></button>`
        : `<button class="chip lockchip" data-act="buyseedcard" data-crop="${c}" data-need="${CROPS[c].cost}" title="Unlock ${ITEMS[c].name}">${itemImg(c)}<small>${img('lock')}${fmtShort(CROPS[c].cost)}</small></button>`).join('');
      return { ...base, title: `${ITEMS[o.crop].name} field`, sub: `${cr.yield}× per harvest · sells ${fmt(sellPrice(w, o.crop))} each · seeds ${cr.seed ? fmt(cr.seed) : 'free'}`,
        body: `<div data-live="st" class="status">${status()}</div><div class="bar" data-live="pb"><i style="width:${o.p * 100}%"></i></div>
          ${usesHTML(o.crop)}
          <div class="chips">${crops}</div>
          <p class="hint">Tap a crop to grow it here. Anything already planted finishes and gets harvested first. Numbers are the seed price per planting.</p>
          ${this.workTip('field')}`,
        btns: `<button class="btn small" data-act="iteminfo" data-item="${o.crop}">${img('book')} About ${ITEMS[o.crop].name}</button><button class="btn small" data-act="cropfield">Same seed on whole field</button>` + moveBtn + rmBtn,
        live: () => ({ st: status(), pb: `<i style="width:${o.p * 100}%"></i>` }) };
    }
    if (d.cat === 'tree') {
      const status = () => (o.p >= 1 ? `✨ Ready to pick (${d.yield} ${ITEMS[d.fruit].name.toLowerCase()}s)` : `Fruit in ${fmtTime(((1 - o.p) * d.time) / w.fx.grow)}`);
      return { ...base, sub: `Fruits every ${fmtTime(d.time)} · ${d.yield} ${ITEMS[d.fruit].name.toLowerCase()} worth ${fmt(sellPrice(w, d.fruit))} each`,
        body: `<div class="status" data-live="st">${status()}</div><p class="hint">${esc(d.desc)}</p>${usesHTML(d.fruit)}${this.workTip('tree')}`,
        btns: `<button class="btn small" data-act="iteminfo" data-item="${d.fruit}">${img('book')} About ${ITEMS[d.fruit].name}</button>` + moveBtn + rmBtn, live: () => ({ st: status() }) };
    }
    if (d.recipes) {
      const list = recipesFor(s, o);
      const info = () => {
        const r = curRecipe(w, o);
        const n = outTotal(o);
        let st;
        if (o._busy) st = `Making ${ITEMS[o.batch || r.out].name}… ${Math.floor(o.prog * 100)}%${o.off ? ' (stops after this one)' : ''}`;
        else if (o.off) st = 'Not making anything. Its pantry can still be used for orders, selling and other workshops.';
        else if (!r) st = 'Nothing to make yet: waiting for ingredients';
        else if (n >= outCap(o)) st = 'Output full: waiting for pickup';
        else if (o.prog > 0) st = `Paused at ${Math.floor(o.prog * 100)}%: waiting for an artisan`;
        else {
          const miss = Object.keys(r.in).filter((k) => (o.inp[k] || 0) < r.in[k]);
          st = miss.length ? `Waiting for ${miss.map((k) => ITEMS[k].name).join(', ')}` : 'Ready: waiting for an artisan';
        }
        if (o.off) {}
        else if (!o._busy && w.free() <= 0) st += '<small class="next">Your storage is full. Sell something or upgrade storage to keep goods moving.</small>';
        else if (!o._busy && !s.workers.some((x) => x.role === 'artisan') && /artisan/.test(st)) st += '<small class="next">No artisan yet: others only help when they are free.</small>';
        const inp = pantryItems(s, o).map((k) => `<span class="pi-slot ${o.inp[k] ? '' : 'empty'}">${itemImg(k)}${o.inp[k] || 0}</span>`).join('') + ` <small>(${pantryUsed(o)}/${pantryCap(o)})</small>`;
        const out = n ? Object.entries(o.out).map(([k, v]) => `${itemImg(k)}${v}`).join(' ') : '—';
        return { st, inp, out: `${out} <small>(${n}/${outCap(o)})</small>`, pb: `<i style="width:${o.prog * 100}%"></i>` };
      };
      const v = info();
      const opts = `<option value="auto" ${o.recipe === 'auto' ? 'selected' : ''}>Auto (best available)</option>` + list.map((r) => `<option value="${r.out}" ${o.recipe === r.out ? 'selected' : ''}>${ITEMS[r.out].name}</option>`).join('');
      const recipes = list.map((r) => `<div class="recipe ${curRecipe(w, o) === r ? 'on' : ''}">${Object.entries(r.in).map(([k, q]) => `<span>${infoImg(k)}${q}</span>`).join('<i>+</i>')}<i>→</i><span>${infoImg(r.out)}</span>
        <small>${fmtTime(craftTime(w, o, r))} · ${coin(sellPrice(w, r.out))}</small></div>`).join('');
      const locked = DEFS[o.type].recipes.filter((r) => !list.includes(r)).map((r) => `<div class="recipe locked">${itemImg(r.out)} ${ITEMS[r.out].name} <small>${img('lock')} Lv ${r.level}</small></div>`).join('');
      return { ...base, sub: d.desc,
        body: `${power}<div class="status" data-live="st">${v.st}</div><div class="bar" data-live="pb">${v.pb}</div>
          <div class="row"><span>Make</span><select data-chg="recipe">${opts}</select></div>
          <div class="pantry"><div class="row"><span>${img('box')} Pantry</span>${(o.pl || 1) >= PANTRY.length ? '<span class="max">MAX</span>' : `<button class="btn small" data-act="upgradepantry" data-need="${E.pantryCost(o)}">${img('up')} Hold ${PANTRY[o.pl || 1]} ${coin(E.pantryCost(o))}</button>`}</div><div class="pslots" data-live="inp">${v.inp}</div></div>
          <div class="io"><span>Out: <b data-live="out">${v.out}</b></span></div>
          <div class="recipes">${recipes}${locked}</div>
          <p class="hint">Tap any item to see what it is for.</p>${this.workTip('craft')}`,
        live: info };
    }
    if (d.animal) {
      const A = d.animal;
      const info = () => ({ st: o.off ? 'Switched off: the animals rest and don’t eat' : o.feed > 0 ? (o.out >= animalCap(o) ? `Full: waiting for a rancher` : `Happy and producing`) : `Hungry: needs ${ITEMS[A.feed].name.toLowerCase()} from storage`,
        feed: `${itemImg(A.feed)} ${o.feed}/${feedCap(o)}`, out: `${itemImg(A.item)} ${o.out}/${animalCap(o)}` });
      const v = info();
      const joy = () => `<span class="joy"><i style="width:${Math.round(o.joy ?? 30)}%"></i></span> ${Math.round(o.joy ?? 30)}%`;
      const tr = ANIMAL_TREASURE[o.type];
      const patBtn = () => E.patReady(o) ? `<button class="btn small gold" data-act="patanimals">${img('heart')} Give them a pat</button>` : `<small>Patted: try again in ${fmtTime(PAT_EVERY - (Date.now() - o.patT) / 1000)}</small>`;
      return { ...base, sub: `${animalCount(o)} ${A.kind}s · 1 ${ITEMS[A.item].name.toLowerCase()} each ${fmtTime(A.time / (animalCount(o) * w.fx.animal * (1 + 0.25 * (o.joy ?? 30) / 100)))}`,
        body: `${power}<div class="status" data-live="st">${v.st}</div><div class="io"><span>Feed: <b data-live="feed">${v.feed}</b></span><span>Ready: <b data-live="out">${v.out}</b></span></div>
        <div class="row"><span>${img('heart')} Happiness <b data-live="joy">${joy()}</b></span><span data-live="pat">${patBtn()}</span></div>
        <p class="hint">Fed animals grow happier, and a pat now and then makes their day. Happy animals produce up to 25% faster${tr ? ` and sometimes give a ${ITEMS[tr].name}` : ''}. ${esc(d.desc)} Upgrading adds an animal.</p>${usesHTML(A.item)}${this.workTip('animal')}`,
        live: () => ({ ...info(), joy: joy(), pat: patBtn() }) };
    }
    if (d.hive) {
      const it = d.hive.item;
      const info = () => ({ out: `${itemImg(it)} ${o.out}/${hiveCap(o)}` });
      const near = o.type === 'beehive' ? `${o._flowers || 0} flowers nearby · ` : '';
      const biting = it === 'fish' ? `<h3>Biting right now</h3><div class="oi">${this.bitingNow().map((k) => `<span class="need">${infoImg(k)} ${ITEMS[k].name}</span>`).join('')}</div><p class="hint">Some catches are special fish, which go straight to storage. Which ones bite depends on the season, the weather and the time of day. The rarest turn up only once in a long while.</p>` : '';
      return { ...base, sub: `${near}1 ${ITEMS[it].name.toLowerCase()} every ${fmtTime(d.hive.time / (hiveRate(o) * w.fx.animal))}`,
        body: `${power}<div class="io"><span>${ITEMS[it].name}: <b data-live="out">${info().out}</b></span></div><p class="hint">${esc(d.desc)}</p>${biting}${usesHTML(it)}${this.workTip('hive')}`, live: info };
    }
    if (d.store) {
      return { ...base, sub: `Holds ${storeCap(o)} items`, body: `<div class="io"><span>${img('box')} Farm storage: <b data-live="u">${fmt(w.used())}/${fmt(w.capacity)}</b></span></div><p class="hint">${esc(d.desc)}</p>${this.workTip('storage')}`,
        btns: upBtn + `<button class="btn small" data-act="open" data-v="market">Open market</button>` + moveBtn + rmBtn, live: () => ({ u: `${fmt(w.used())}/${fmt(w.capacity)}` }) };
    }
    if (d.houses) return { ...base, sub: `Home for ${d.houses} farmhands`, body: `<p class="hint">${s.workers.length}/${w.housing} beds in use across your farm.</p>`, btns: `<button class="btn small" data-act="open" data-v="workers">Farmhands</button>` + moveBtn + rmBtn };
    if (o.type === 'market') return { ...base, sub: d.desc, btns: `<button class="btn small gold" data-act="open" data-v="market">Open market</button>` + moveBtn };
    if (o.type === 'board') return { ...base, sub: d.desc, btns: `<button class="btn small gold" data-act="open" data-v="orders">See orders</button>` + moveBtn };
    const extra = [d.speed && `Farmhands walk ${Math.round((d.speed - 1) * 100)}% faster here.`, d.charm && `Adds ${d.charm} charm. Charm makes everything sell for a little more.`,
      d.radius && 'Works on its own, no farmhand needed.', d.light && 'Glows at night.', o.type === 'well' && 'Farmers walk here to fill their watering cans, so place it near your fields.'].filter(Boolean);
    return { ...base, sub: d.desc || (d.charm ? 'Decoration' : ''), body: extra.length ? `<p class="hint">${extra.join(' ')}</p>` : '' };
  }

  bareCard(o, base, moveBtn, rmBtn) {
    const s = this.s;
    const chips = CROP_ORDER.filter((c) => s.level >= CROPS[c].level).map((c) => s.seeds[c]
      ? `<button class="chip" data-act="setcrop" data-crop="${c}" title="${ITEMS[c].name} · seeds ${CROPS[c].seed}">${itemImg(c)}<small>${fmtShort(CROPS[c].seed)}</small></button>`
      : `<button class="chip lockchip" data-act="buyseedcard" data-crop="${c}" data-need="${CROPS[c].cost}" title="Unlock ${ITEMS[c].name}">${itemImg(c)}<small>${img('lock')}${fmtShort(CROPS[c].cost)}</small></button>`).join('');
    return { ...base, title: 'Bare plot', sub: 'Tilled and ready for seeds',
      body: `<div class="status">Pick a seed for farmers to plant here</div>
        <div class="chips">${chips}</div>
        <p class="hint">Numbers are the seed price, paid each time a farmer plants. After picking, use “Same seed on whole field” to fill the plots next to it.</p>
        ${this.workTip('field')}`,
      btns: moveBtn + rmBtn };
  }

  cropField(plot, crop) {
    // change every connected plot to this crop
    const w = this.w, seen = new Set(), stack = [plot];
    let n = 0;
    while (stack.length) {
      const p = stack.pop();
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      if (p.crop === crop ? p.next : p.next !== crop) { E.setCrop(w, p, crop); n++; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q = w.objAt(p.x + dx, p.y + dy);
        if (q && q.type === 'plot' && !seen.has(q.id)) stack.push(q);
      }
    }
    const later = [...seen].some((id) => w.byId.get(id)?.next === crop);
    this.toast(!n ? 'The whole field already grows this' : later ? `${n} plots will switch to ${ITEMS[crop].name} after their harvest` : `${n} plots switched to ${ITEMS[crop].name}`, n ? 'good' : '');
    this.g.dirty();
  }

  /** Who works this, with a nudge when you have nobody for it yet. */
  workTip(kind) {
    const [roles, text] = WORK[kind];
    if (!roles.length || this.s.workers.some((x) => roles.includes(x.role))) return `<p class="tip">${img('people')} ${text}</p>`;
    const who = roles.map((r) => `${/^[aeiou]/i.test(ROLES[r].name) ? 'an' : 'a'} ${ROLES[r].name}`).join(' or ');
    return `<p class="tip warn">${img('people')} ${text} Hire ${who} in Farmhands to get it going.</p>`;
  }

  /** A short card about an item: price, where it comes from, what it makes. */
  itemInfo(k) {
    const it = ITEMS[k], cr = CROPS[k], w = this.w, s = this.s;
    if (!it) return;
    if (it.mat) {
      const where = k === 'wood' || k === 'stone' ? 'Clearing branches and rocks on your farm, and from the quarry' : k === 'gem' ? 'A lucky find while mining iron and gold veins' : `Mining ${ITEMS[k].name.toLowerCase()} veins deeper in the quarry`;
      const html = `<h2>${itemImg(k, 'pi big')} ${it.name}</h2><div class="facts"><span>Building material</span><span>You have ${fmt(w.mat(k))}/${fmt(w.shedCap)}</span><span>Sells for ${coin(it.value)}</span></div>
        <p class="hint">Comes from: ${where}.</p><p class="hint">Used to put up buildings and upgrade them. It's kept in the material shed, not the barn.</p>`;
      const m = { html, buttons: [['Close', 'ok']], info: true };
      if (this.modalOpen?.info) { this.modalQ.unshift(m); this.nextModal(); } else { this.modalQ.push(m); if (!this.modalOpen) this.nextModal(); }
      return;
    }
    const facts = [`Sells for ${coin(sellPrice(w, k))}`, w.haveAll(k) ? `You have ${fmt(w.haveAll(k))}` : ''];
    if (cr) facts.push(`${img('clock')} ${fmtTime(cr.time)} to grow`, `${cr.yield} per harvest`, `Seeds ${cr.seed ? coin(cr.seed) : 'free'}`,
      cr.regrow ? 'Regrows after picking' : '', cr.season ? `${SEASONS.find((x) => x.id === cr.season).name} only` : '');
    const from = [...new Set((SOURCES[k] || []).map((t) => (t === 'plot' ? 'Field plots' : DEFS[t].name)))];
    const rows = (USES[k] || []).map((u) => {
      const at = DEFS[u.at], lvl = Math.max(at.level, u.r?.level || 0), lock = s.level < lvl ? ` ${img('lock')} Lv ${lvl}` : '';
      if (u.out) return `<div class="recipe">${Object.entries(u.r.in).map(([i, q]) => `<span>${infoImg(i)}${q}</span>`).join('<i>+</i>')}<i>→</i><span>${infoImg(u.out)}</span><b>${ITEMS[u.out].name}</b><small>${at.name}${lock}</small></div>`;
      if (u.feeds) return `<div class="recipe">Feeds the ${u.feeds === 'sheep' ? u.feeds : u.feeds + 's'}<small>${at.name}${lock}</small></div>`;
      return `<div class="recipe">Bees nearby make honey faster<small>${at.name}${lock}</small></div>`;
    }).join('');
    const html = `<h2>${itemImg(k, 'pi big')} ${it.name}</h2><div class="facts">${facts.filter(Boolean).map((f) => `<span>${f}</span>`).join('')}</div>
      ${from.length ? `<p class="hint">Comes from: ${from.join(', ')}</p>` : ''}
      ${rows ? `<h3>Used for</h3><div class="recipes">${rows}</div>` : '<p class="hint">Not used to make anything. Sell it or use it for orders.</p>'}`;
    const m = { html, buttons: [['Close', 'ok']], info: true };
    // tapping an item inside an open info card swaps to that item
    if (this.modalOpen?.info) { this.modalQ.unshift(m); this.nextModal(); } else { this.modalQ.push(m); if (!this.modalOpen) this.nextModal(); }
  }

  askFire(wk) {
    const refund = E.fireRefund(this.w);
    this.modal(`<h2>Let ${esc(wk.name)} go?</h2><p>${esc(wk.name)} leaves the farm and you get back ${coin(refund)}. Their level ${wk.lvl} goes with them: a new farmhand starts at level 1.</p>`,
      [['Keep them', 'no'], ['Let go', 'yes', 'red']], (v) => {
        if (v !== 'yes') return;
        E.fire(this.w, wk);
        if (this.sel === wk) this.select(null);
        this.g.dirty();
        if (this.sheet === 'workers') this.renderSheet();
      });
  }

  askRemove(o) {
    const d = DEFS[o.type];
    const refund = E.refundOf(this.w, o);
    const doIt = () => { const why = E.remove(this.w, o); if (why) this.toast(why, 'bad'); else { this.select(null); this.g.dirty(); } };
    if (d.cat === 'path' || d.cat === 'fence' || d.cat === 'field' || (typeof d.cost === 'number' && d.cost < 50)) { doIt(); return; }
    this.modal(`<h2>Remove ${d.name}?</h2><p>You get back ${coin(refund)}.${d.recipes || d.animal ? ' Anything stocked inside goes back to storage.' : ''}</p>`,
      [['Keep it', 'no'], ['Remove', 'yes', 'red']], (v) => { if (v === 'yes') doIt(); });
  }

  rename(id) {
    const wk = this.s.workers.find((x) => x.id === id);
    if (!wk) return;
    this.modal(`<h2>Rename ${esc(wk.name)}</h2><input id="rn" maxlength="14" value="${esc(wk.name)}">`, [['Cancel', 'no'], ['Save', 'yes', 'green']], (v) => {
      const n = $('#rn')?.value.trim();
      if (v === 'yes' && n) { wk.name = n; this.g.dirty(); this.sheet ? this.renderSheet() : this.renderCard(); }
    }, () => { const i = $('#rn'); i.focus(); i.select(); });
  }

  askReset() {
    this.modal(`<h2>Start over?</h2><p>This replaces your farm with a brand new one${Cloud.user() ? ', on every device' : ''}. Type <b>NEW FARM</b> to confirm.</p><input id="rs" autocomplete="off">`,
      [['Cancel', 'no'], ['Start over', 'yes', 'red']], (v) => { if (v === 'yes' && $('#rs')?.value.trim().toUpperCase() === 'NEW FARM') this.g.resetFarm(); });
  }

  levelInfo() {
    const s = this.s;
    const next = xpForLevel(s.level + 1);
    const unlocks = unlocksAt(s.level + 1);
    this.modal(`<h2>${img('star', 'pi big')} Farm level ${s.level}</h2><p>${fmt(s.xp)} / ${fmt(next)} XP. You earn XP from every coin you make.</p>
      ${unlocks.length ? `<h3>At level ${s.level + 1}</h3><div class="unl">${unlocks.join('')}</div>` : ''}`, [['Nice', 'ok', 'green']]);
  }

  // ---------- placement modes ----------
  startPlacing(type, extra = {}) {
    const d = DEFS[type];
    this.openSheet(null);
    this.select(null, true);
    if (PAINTABLE.has(d.cat) || (d.cat === 'decor' && d.w === 1 && d.h === 1 && E.costOf(this.w, type) <= 30)) this.setMode({ k: 'paint', type, extra });
    else {
      const [cx, cy] = this.g.R.toWorld(innerWidth / 2, innerHeight * 0.42);
      const x = Math.floor(cx / TILE - (d.w - 1) / 2), y = Math.floor(cy / TILE - (d.h - 1) / 2);
      this.setMode({ k: 'place', type, extra, x, y });
    }
  }
  setMode(m) {
    this.mode = m;
    if (m && this.sheet) { this.sheet = null; $('#sheet').classList.remove('open'); }
    for (const b of document.querySelectorAll('#dock button')) b.classList.toggle('on', m?.k === 'land' && b.dataset.v === 'land');
    document.body.classList.toggle('placing', !!m);
    this.g.R.overlay = this.overlay();
    this.renderPlacebar();
    this.renderGoal();
  }
  overlay() {
    const m = this.mode;
    const ov = { sel: this.sel };
    if (!m) return ov;
    ov.grid = m.k !== 'land';
    if (m.k === 'place' || m.k === 'move') {
      const type = m.k === 'move' ? m.obj.type : m.type;
      ov.ghost = { type, x: m.x, y: m.y, ...(m.extra || {}), crop: m.extra?.crop || m.obj?.crop, why: this.w.canPlace(type, m.x, m.y, m.obj?.id || 0) };
      if (m.k === 'move') ov.moving = m.obj;
    }
    if (m.k === 'paint' && m.hover) ov.ghost = { type: m.type, x: m.hover[0], y: m.hover[1], ...(m.extra || {}), why: this.w.canPlace(m.type, m.hover[0], m.hover[1]) };
    if (m.k === 'land') { ov.land = true; ov.landSel = m.sel; }
    return ov;
  }
  renderPlacebar(liveOnly) {
    const el = $('#placebar');
    const m = this.mode;
    if (!m) { el.classList.remove('open'); el._h = ''; return; }
    let html = '';
    if (m.k === 'paint' || m.k === 'place') {
      const d = DEFS[m.type];
      const cost = E.costOf(this.w, m.type);
      const name = d.name;
      const why = m.k === 'place' ? this.w.canPlace(m.type, m.x, m.y) : '';
      const tip = m.k === 'paint' ? `${m.type === 'plot' ? 'Each new plot costs a bit more. Tap a plot afterwards to pick its seed. ' : ''}Tap or drag to place. Two fingers to move the view.` : why ? `<span class="why">${why}</span>` : 'Tap where it should go, then press the check.';
      html = `<img class="thumb sm" src="${thumb(m.type, m.extra?.crop)}" alt=""><div class="pt"><b>${name}</b> ${d.ribbons ? ribbon(d.ribbons) : coin(cost)}<small>${tip}</small></div>
        ${m.k === 'place' ? `<button class="btn green icon" data-act="confirm" aria-label="Place" ${this.w.canPlace(m.type, m.x, m.y) || this.s.coins < cost ? 'disabled' : ''}>${img('check')}</button>` : ''}
        <button class="btn icon" data-act="cancelmode" aria-label="Done">${m.k === 'paint' ? 'Done' : img('x')}</button>`;
    } else if (m.k === 'move') {
      const why = this.w.canPlace(m.obj.type, m.x, m.y, m.obj.id);
      html = `<img class="thumb sm" src="${thumb(m.obj.type, m.obj.crop)}" alt=""><div class="pt"><b>Move ${DEFS[m.obj.type].name}</b><small>${why ? `<span class="why">${why}</span>` : 'Tap the new spot, then press the check.'}</small></div>
        <button class="btn green icon" data-act="confirm" aria-label="Move here" ${this.w.canPlace(m.obj.type, m.x, m.y, m.obj.id) ? 'disabled' : ''}>${img('check')}</button><button class="btn icon" data-act="cancelmode" aria-label="Cancel">${img('x')}</button>`;
    } else if (m.k === 'remove') {
      html = `${img('trash', 'pi big')}<div class="pt"><b>Remove things</b><small>Tap or drag over things to remove them (half the cost back).</small></div><button class="btn icon" data-act="cancelmode">Done</button>`;
    } else if (m.k === 'land') {
      const s = this.s, k = E.parcelsBought(s), lvl = parcelLevel(k), cost = parcelCost(k);
      const sel = m.sel;
      html = `${img('map', 'pi big')}<div class="pt"><b>Buy land</b> ${s.level < lvl ? `<span class="lock">${img('lock')} Farm level ${lvl}</span>` : coin(cost)}<small>${sel ? 'Buy this parcel?' : 'Tap a glowing parcel next to your farm.'}</small></div>
        ${sel ? `<button class="btn green" data-act="buyland" ${s.level < lvl ? 'disabled' : `data-need="${cost}"`}>Buy</button>` : ''}<button class="btn icon" data-act="cancelmode">Done</button>`;
    }
    if (el._h !== html) { el.innerHTML = html; el._h = html; }
    if (!liveOnly) el.classList.add('open');
    this.updateNeeds(el);
  }

  tileAt(sx, sy) {
    const [x, y] = this.g.R.toWorld(sx, sy);
    return [Math.floor(x / TILE), Math.floor(y / TILE)];
  }

  // Paths are painted into the ground, so they have no sprite to hit: fall back to the tile.
  pickAt(sx, sy) {
    const hit = this.g.R.pick(sx, sy);
    if (hit) return hit;
    const o = this.w.objAt(...this.tileAt(sx, sy));
    return o && DEFS[o.type].cat === 'path' ? o : null;
  }

  // ---------- the quarry scene ----------
  inQuarry() { return this.g.R.scene === 'quarry'; }
  goQuarry() {
    if (!this.s.quarry) {
      const why = E.discoverQuarry(this.w);
      if (why) { this.toast(why, 'bad'); return; }
    }
    if (this.mode) this.setMode(null);
    if (this.sel) this.select(null, true);
    this.g.R.setScene('quarry');
    document.body.classList.add('inquarry');
    this.renderScenebar();
  }
  goFarm() {
    if (!this.inQuarry()) return;
    if (this.sel) this.select(null, true);
    this.g.R.setScene('farm');
    document.body.classList.remove('inquarry');
    this.renderScenebar();
  }
  renderScenebar() {
    const el = $('#scenebar');
    const v = this.g.visitInfo;
    if (v) {
      const sent = this.pals?.sent.includes(v.code);
      el.innerHTML = `${img('eye', 'pi big')}<div class="pt"><b>Visiting ${esc(v.name)}</b><small>Farm level ${v.level} · look around, nothing here changes</small></div>
        <button class="btn small gold" data-act="giftpal" data-code="${v.code}" ${sent ? 'disabled' : ''}>${sent ? 'Gift sent' : `${img('heart')} Gift`}</button><button class="btn small green" data-act="leavevisit">Back home</button>`;
      el.classList.add('open');
      return;
    }
    if (!this.inQuarry()) { el.classList.remove('open'); el.innerHTML = ''; return; }
    const miners = this.s.workers.filter((x) => x.role === 'miner').length;
    el.innerHTML = `${img('pick', 'pi big')}<div class="pt"><b>The Quarry</b><small data-live="qs">${this.quarryStatus(miners)}</small></div>
      <button class="btn small" data-act="sheet" data-v="quarry">${itemImg('stone')} Shed</button><button class="btn small green" data-act="gofarm">Back to farm</button>`;
    el.classList.add('open');
  }
  quarryStatus(miners) {
    if (!miners) return 'No miners yet: hire one in Farmhands';
    return MATS.filter((k) => this.w.mat(k) || k === 'wood' || k === 'stone').map((k) => `${itemImg(k)}${fmt(this.w.mat(k))}`).join(' ');
  }
  tapQuarry(sx, sy) {
    const hit = this.g.R.pick(sx, sy);
    if (!hit) { if (this.sheet) this.openSheet(null); else if (this.sel) this.select(null); return; }
    if (hit.role) { this.select(hit === this.sel ? null : hit); return; }
    if (hit.qback) { this.goFarm(); return; }
    if (hit.qcart || hit.qzone !== undefined) { this.openSheet('quarry'); return; }
    if (hit.qnode) {
      const n = hit.qnode, K = QNODES[n.k];
      this.toast(n.hp > 0 ? `${K.name}: ${n.hp} more ${ITEMS[K.item].name.toLowerCase()} before it needs to grow back` : `${K.name}: grows back in ${fmtTime(n.re ?? K.regrow)}`);
    }
  }

  tap(sx, sy) {
    if (this.g.visitWorld) { this.toast('You’re visiting. Tap “Back home” to get back to your farm.'); return; }
    if (this.inQuarry()) { this.tapQuarry(sx, sy); return; }
    const m = this.mode, w = this.w;
    if (m) {
      const [tx, ty] = this.tileAt(sx, sy);
      if (m.k === 'paint') { this.paintAt(tx, ty, true); return; }
      if (m.k === 'place' || m.k === 'move') {
        const d = DEFS[m.k === 'move' ? m.obj.type : m.type];
        m.x = tx - Math.floor((d.w - 1) / 2); m.y = ty - Math.floor((d.h - 1) / 2);
        this.g.R.overlay = this.overlay(); this.renderPlacebar();
        return;
      }
      if (m.k === 'remove') {
        const o = this.pickAt(sx, sy);
        if (o && !o.role) this.askRemove(o);
        return;
      }
      if (m.k === 'land') {
        const px = Math.floor(tx / MAP.parcel), py = Math.floor(ty / MAP.parcel);
        m.sel = E.parcelBuyable(w, px, py) ? [px, py] : null;
        if (!m.sel && !w.ownedTile(tx, ty)) this.toast('You can only buy land next to your farm');
        this.g.R.overlay = this.overlay(); this.renderPlacebar();
        return;
      }
    }
    const hit = this.pickAt(sx, sy);
    if (hit && hit.trail) { this.goQuarry(); return; }
    if (hit && !hit.role && hit.type === 'market') { this.select(null, true); this.openSheet('market'); return; }
    if (hit && !hit.role && hit.type === 'board') { this.select(null, true); this.openSheet('orders'); return; }
    if (this.sheet && !hit) { this.openSheet(null); return; }
    this.select(hit && hit !== this.sel ? hit : null);
  }

  hover(sx, sy) {
    const m = this.mode;
    if (!m) return;
    const [tx, ty] = this.tileAt(sx, sy);
    if (m.k === 'paint') {
      if (!m.hover || m.hover[0] !== tx || m.hover[1] !== ty) { m.hover = [tx, ty]; this.g.R.overlay = this.overlay(); }
    } else if (m.k === 'place' || m.k === 'move') {
      const d = DEFS[m.k === 'move' ? m.obj.type : m.type];
      const x = tx - Math.floor((d.w - 1) / 2), y = ty - Math.floor((d.h - 1) / 2);
      if (x !== m.x || y !== m.y) { m.x = x; m.y = y; this.g.R.overlay = this.overlay(); this.renderPlacebar(); }
    }
  }

  isPaint() { return this.mode && (this.mode.k === 'paint' || this.mode.k === 'remove'); }
  paint(sx, sy, first) {
    if (first) this.stroke = { last: null, errs: new Set(), n: 0, cost: 0 };
    const [tx, ty] = this.tileAt(sx, sy);
    if (this.stroke.last && this.stroke.last[0] === tx && this.stroke.last[1] === ty) return;
    // fill gaps when dragging fast
    const from = this.stroke.last || [tx, ty];
    const steps = Math.max(Math.abs(tx - from[0]), Math.abs(ty - from[1]));
    for (let i = 1; i <= Math.max(1, steps); i++) {
      const x = Math.round(from[0] + ((tx - from[0]) * i) / Math.max(1, steps)), y = Math.round(from[1] + ((ty - from[1]) * i) / Math.max(1, steps));
      this.paintAt(x, y, false);
    }
    this.stroke.last = [tx, ty];
  }
  paintEnd() {
    const st = this.stroke;
    if (st && st.errs.size) for (const e of st.errs) if (e !== 'Something is already here') { this.toast(e, 'bad'); break; }
    this.stroke = null;
  }
  paintAt(tx, ty, single) {
    const m = this.mode, w = this.w;
    if (m.k === 'remove') {
      const o = w.objAt(tx, ty);
      if (!o) return;
      const d = DEFS[o.type];
      if (single || ['path', 'fence', 'field', 'debris'].includes(d.cat) || (d.cat === 'decor' && d.w === 1)) {
        if (!single && !['path', 'fence', 'field', 'decor', 'debris'].includes(d.cat)) return;
        if (single) { this.askRemove(o); return; }
        const why = E.remove(w, o);
        if (!why) this.g.dirty();
      }
      return;
    }
    const existing = w.objAt(tx, ty);
    if (existing && existing.type === 'plot' && m.type === 'plot') return;
    const why = E.place(w, m.type, tx, ty, { ...m.extra });
    if (why) { if (single) this.toast(why, 'bad'); else this.stroke?.errs.add(why); }
    else { this.g.dirty(); if (this.stroke) this.stroke.n++; }
    this.renderPlacebar(true);
  }

  confirmPlace() {
    const m = this.mode, w = this.w;
    if (m.k === 'place') {
      const why = E.place(w, m.type, m.x, m.y, { ...m.extra });
      if (why) { this.toast(why, 'bad'); return; }
      this.toast(`${DEFS[m.type].name} built!`, 'good');
      this.g.dirty();
      const placed = w.objects[w.objects.length - 1];
      this.setMode(null);
      this.select(placed);
    } else if (m.k === 'move') {
      const why = E.move(w, m.obj, m.x, m.y);
      if (why) { this.toast(why, 'bad'); return; }
      this.g.dirty();
      const o = m.obj;
      this.setMode(null);
      this.select(o);
    }
  }

  escape() {
    if (this.modalOpen) return;
    if (this.mode) this.setMode(null);
    else if (this.sheet) this.openSheet(null);
    else if (this.sel) this.select(null);
  }

  // ---------- events from the simulation ----------
  handle(e) {
    const R = this.g.R;
    if (e.t === 'float') { if (!this.inQuarry()) R.float(e.x, e.y, e.text, e.item); }
    else if (e.t === 'qhit') { if (this.inQuarry()) R.float(e.n.x, e.n.y - 1, '+1', e.item); }
    else if (e.t === 'built') this.toast(`The ${DEFS[e.o.type].name} is finished!`, 'good');
    else if (e.t === 'quarry') this.toast('You found the quarry! Hire a miner to dig for wood, stone and ore.', 'good');
    else if (e.t === 'zone') this.toast(`${QZONES[e.i].name} is open for mining!`, 'good');
    else if (e.t === 'gem') this.toast('A miner found a gemstone!', 'good');
    else if (e.t === 'heart') { const v = VILLAGERS.find((x) => x.id === e.who), g = e.gift; this.toast(`${v.name}: ${e.h} heart${e.h > 1 ? 's' : ''}! ${g.coins ? `+${fmt(g.coins)} coins` : g.ribbons ? `+${g.ribbons} ribbons` : g.hat ? `New hat: ${HATS[g.hat].name}` : v.perkText}`, 'good'); }
    else if (e.t === 'project') this.toast(`${PROJECTS.find((p) => p.id === e.id).name} restored! ${PROJECTS.find((p) => p.id === e.id).text}`, 'good');
    else if (e.t === 'treasure') this.toast(`Your happy animals left you a ${ITEMS[e.item].name}!`, 'good');
    else if (e.t === 'catch') { const rare = ['koi', 'sturgeon'].includes(e.item); if (rare || !this.s.museum[e.item] && !(this.s.stats.harvest[e.item] > 1)) this.toast(`The dock landed a ${ITEMS[e.item].name}!${rare ? ' What a rare catch!' : ''}`, 'good'); }
    else if (e.t === 'find') this.toast(`A miner dug up a ${ITEMS[e.item].name}! (Museum)`, 'good');
    else if (e.t === 'wing') { const wg = MUSEUM_WINGS.find((x) => x.id === e.id); this.toast(`Museum: ${wg.name} complete! ${wg.perkText}`, 'good'); }
    else if (e.t === 'museum') this.toast(`The whole museum is full! +${fmt(MUSEUM_REWARD.coins)} coins`, 'good');
    else if (e.t === 'giantgrew') this.toast(`A giant ${ITEMS[e.crop].name.toLowerCase()} grew on your farm!`, 'good');
    else if (e.t === 'giant') { if (!this.inQuarry()) R.float(e.x + 1, e.y, 'GIANT!', e.crop); }
    else if (e.t === 'debris') { if (!this.debrisTold) { this.debrisTold = true; this.toast(`A ${DEFS[e.type].name.toLowerCase()} turned up on your land. Farmhands will clear it for materials.`); } }
    else if (e.t === 'splash') R.splash(e.x, e.y);
    else if (e.t === 'level') this.levelUp(e.level, e.reward);
    else if (e.t === 'wlevel') this.toast(`${e.w.name} reached level ${e.w.lvl}!`, 'good');
    else if (e.t === 'full') { if (Date.now() - this.lastFull > 30000) { this.lastFull = Date.now(); this.toast('Storage is full! Sell goods, turn on auto-sell or upgrade the barn.', 'bad'); } }
    else if (e.t === 'fired') { this.toast(`${e.w.name} said goodbye to the farm`); }
    else if (e.t === 'bundle') {
      if (!e.done.length) this.toast(`Gave ${e.n} to the ${E.bundleLabel(e.id)}`);
      for (const k of e.done) this.toast(k === 'all' ? 'Every bundle complete! The Golden Scarecrow is yours' : k.startsWith('room:') ? `${E.bundleLabel(k)} complete! ${BUNDLE_ROOMS.find((r) => `room:${r.id}` === k).perkText}` : `${E.bundleLabel(k)} complete!`, 'good');
    }
    else if (e.t === 'hired') { this.toast(`${e.w.name} joined the farm as a ${ROLES[e.w.role].name.toLowerCase()}!`, 'good'); }
    else if (e.t === 'land') { const [sx, sy] = R.toScreen((e.px + 0.5) * MAP.parcel * TILE, (e.py + 0.5) * MAP.parcel * TILE); R.burst(sx, sy); }
  }
  levelUp(level, reward) {
    const unl = unlocksAt(level);
    this.modal(`<div class="lvlup"><div class="big">${img('star', 'pi huge')}</div><h2>Farm level ${level}!</h2><p>Bonus ${coin(reward)}</p>
      ${unl.length ? `<h3>New things to try</h3><div class="unl">${unl.join('')}</div>` : ''}</div>`, [['Wonderful', 'ok', 'green']]);
  }

  // ---------- toasts, modals, coins ----------
  toast(text, kind = '') {
    const root = $('#toasts');
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = text;
    root.appendChild(t);
    while (root.children.length > 3) root.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }
  coinPop(el) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    this.g.R.burst(r.left + r.width / 2, r.top + r.height / 2);
  }
  modal(html, buttons, cb, onOpen) {
    this.modalQ.push({ html, buttons, cb, onOpen });
    if (!this.modalOpen) this.nextModal();
  }
  nextModal() {
    const m = this.modalQ.shift();
    const el = $('#modal');
    if (!m) { el.classList.remove('open'); this.modalOpen = null; return; }
    this.modalOpen = m;
    el.innerHTML = `<div class="mbox">${m.html}<div class="mbtns">${(m.buttons || []).map(([label, v, cls]) => `<button class="btn ${cls || ''}" data-act="modalbtn" data-v="${v}">${label}</button>`).join('')}</div></div>`;
    el.classList.add('open');
    m.onOpen?.();
  }
  closeModal(v) {
    const m = this.modalOpen;
    try { m?.cb?.(v); } finally { this.nextModal(); }
  }

  welcomeBack(sum) {
    const rows = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `<span class="need ok">${itemImg(k)}<b>${fmt(v)}</b></span>`).join('');
    const h = Object.keys(sum.harvest).length, c = Object.keys(sum.craft).length, so = Object.keys(sum.sold).length;
    const pending = this.s.pendingCoins;
    this.modal(`<div class="welcome"><h2>Welcome back!</h2><p>You were away ${fmtTime(sum.ms / 1000)}${sum.capped ? ` (the farm works up to ${sum.capH}h while you’re gone; Night Shift raises it)` : ''}. Here’s what your farmhands did:</p>
      ${h ? `<h3>Gathered</h3><div class="oi">${rows(sum.harvest)}</div>` : ''}
      ${c ? `<h3>Crafted</h3><div class="oi">${rows(sum.craft)}</div>` : ''}
      ${so ? `<h3>Auto-sold</h3><div class="oi">${rows(sum.sold)}</div>` : ''}
      ${sum.mats && Object.keys(sum.mats).length ? `<h3>Materials</h3><div class="oi">${rows(sum.mats)}</div>` : ''}
      ${sum.built ? `<p>${img('hammer')} ${sum.built} building${sum.built > 1 ? 's' : ''} finished going up.</p>` : ''}
      ${sum.levels ? `<p>${img('star')} The farm reached level <b>${this.s.level}</b>!</p>` : ''}
      ${sum.newOrders ? `<p>${img('scroll')} ${sum.newOrders} new order${sum.newOrders > 1 ? 's' : ''} on the notice board.</p>` : ''}
      ${!h && !c && !(sum.mats && Object.keys(sum.mats).length) ? '<p class="hint">Not much happened. Make sure storage has room and fields have crops.</p>' : ''}
      ${pending ? `<div class="earned">${img('coin', 'pi big')} <b>${fmt(pending)}</b> coins waiting</div>` : ''}</div>`,
    [[pending ? `Collect ${fmt(pending)}` : 'Back to the farm', 'collect', 'gold']], () => {
      const n = E.collectPending(this.w);
      if (n) { this.coinPop($('#h-coins')); this.g.dirty(); }
    });
  }
}

/** HTML chips for everything that unlocks at a farm level. */
export function unlocksAt(level) {
  const out = [];
  for (const c of CROP_ORDER) if (CROPS[c].level === level) out.push(`<span class="need">${itemImg(c)}${ITEMS[c].name} seeds</span>`);
  for (const [k, d] of Object.entries(DEFS)) if (d.level === level && !d.fixed) out.push(`<span class="need"><img class="pi" src="${thumb(k)}" alt="">${d.name}</span>`);
  for (const d of Object.values(DEFS)) for (const r of d.recipes || []) if (r.level === level) out.push(`<span class="need">${itemImg(r.out)}${ITEMS[r.out].name} recipe</span>`);
  for (const u of UPGRADES) if (u.level === level) out.push(`<span class="need">${img(u.icon)}${u.name}</span>`);
  if (parcelLevel(0) <= level) void 0;
  return out;
}

export { PW, doorTile, levelReward, iconURL, itemURL };
