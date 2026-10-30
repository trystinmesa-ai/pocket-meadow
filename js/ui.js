// Interface: top bar, dock, sheets (build, farmhands, market, orders,
// upgrades, menu), the selection card, placement modes, toasts and dialogs.
import { ACHIEVEMENTS, achReward, HATS, discovered, DEFS, ITEMS, CROPS, USES, SOURCES, CROP_ORDER, ROLES, ROLE_ORDER, UPGRADES, upgradeCost, xpForLevel, GOALS, BUILD_TABS,
  MAX_WORKER_LEVEL, workerXpNeeded, MAP, TILE, parcelCost, parcelLevel, levelReward, MAX_LEVEL } from './data.js';
import { doorTile, sellPrice, storeCap, cropUnlocked, PW } from './world.js';
import * as E from './economy.js';
import { curRecipe, recipesFor, outTotal, outCap, animalCount, animalCap, feedCap, hiveCap, hiveRate, craftTime } from './sim.js';
import { img, itemImg, iconURL } from './art/icons.js';
import { itemURL } from './art/items.js';
import { buildingSprite } from './art/buildings.js';
import { decorSprite, fenceSprite } from './art/decor.js';
import { cropSprite, treeSprite, FRUIT_COLOR } from './art/plants.js';
import { pathThumb } from './art/land.js';
import { workerFrame, petFrame } from './art/chars.js';
import { fmtShort } from './render.js';
import * as Cloud from './cloud.js';
import { exportSave, parseSave } from './save.js';
import { seasonAt, seasonDaysLeft, festivalOn, untilFestival, inSeason, canPlantNow } from './seasons.js';
import { SEASONS, SEASON_BONUS, PETS, MAX_PETS } from './data.js';

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

const thumbCache = new Map();
function thumb(type, extra) {
  const key = type + (extra || '');
  if (thumbCache.has(key)) return thumbCache.get(key);
  const d = DEFS[type];
  let cv;
  if (type === 'plot') cv = cropSprite(extra || 'wheat', 3);
  else if (d.cat === 'tree') cv = treeSprite(d.look, FRUIT_COLOR[d.look]);
  else if (d.cat === 'path') cv = pathThumb(type);
  else if (d.cat === 'fence') cv = fenceSprite(type, 10);
  else if (d.cat === 'decor') cv = decorSprite(type);
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
  return 'Keep farming!';
}
/** A tappable item icon that opens its info card. */
const infoImg = (k, cls) => `<button class="ib" data-act="iteminfo" data-item="${k}" title="${esc(ITEMS[k].name)}">${itemImg(k, cls)}</button>`;
/** One short line of what an item is used for. */
function usesHTML(item, max = 7) {
  const u = USES[item] || [];
  if (!u.length) return '';
  const outs = [...new Set(u.filter((x) => x.out).map((x) => x.out))];
  const extra = [...new Set(u.filter((x) => x.feeds).map((x) => `feeds ${x.feeds}s`))];
  if (u.some((x) => x.bees)) extra.push('helps bees');
  return `<div class="uses"><span>Used for</span>${outs.slice(0, max).map((k) => infoImg(k)).join('')}${outs.length > max ? `<small>+${outs.length - max}</small>` : ''}${extra.length ? `<small>${extra.join(' · ')}</small>` : ''}</div>`;
}
// Who works each kind of thing, for the tip on its card.
const WORK = {
  field: [['farmer'], 'Farmers plant, water and harvest it.'],
  tree: [['farmer', 'rancher'], 'Farmers or ranchers pick the fruit.'],
  craft: [['artisan'], 'An artisan runs it. Haulers help bring ingredients.'],
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
    this.tab = { build: 'field', menu: 'farm', journal: 'goals' };
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
      <button class="res" data-act="sheet" data-v="market" aria-label="Storage">${img('box')}<b id="h-store">0/0</b></button>
      <button class="res charm" data-act="charminfo" aria-label="Charm">${img('heart')}<b id="h-charm">0</b></button>
      <button class="res season" id="h-season" data-act="sheet" data-v="season" aria-label="Season and festival"></button>
      <span class="res wx" id="h-wx"></span>`;
    const dock = [
      ['build', 'hammer', 'Build'], ['workers', 'people', 'Farmhands'], ['market', 'market', 'Market'],
      ['orders', 'scroll', 'Orders'], ['journal', 'book', 'Journal'], ['upgrades', 'up', 'Upgrades'], ['land', 'map', 'Land'], ['menu', 'menu', 'Menu'],
    ];
    $('#dock').innerHTML = dock.map(([id, ic, name]) =>
      `<button data-act="${id === 'land' ? 'landmode' : 'sheet'}" data-v="${id}" id="d-${id}">${img(ic, 'pi big')}<span>${name}</span><em class="badge" id="b-${id}"></em></button>`).join('');
    for (const el of ['#hud', '#dock', '#sheet', '#card', '#placebar', '#goal', '#modal', '#zoom']) {
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
    switch (a) {
      case 'sheet': this.openSheet(this.sheet === d.v ? null : d.v); break;
      case 'close': this.openSheet(null); break;
      case 'tab': this.tab[d.sheet] = d.v; this.renderSheet(); break;
      case 'zoom': this.g.input.zoomBy(+d.v); break;
      case 'levelinfo': this.levelInfo(); break;
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
      case 'upgradeb': if (fail(E.upgradeBuilding(w, this.sel))) { this.toast(`${DEFS[this.sel.type].name} upgraded to level ${this.sel.lvl}!`, 'good'); this.g.dirty(); this.renderCard(); } break;
      case 'recipe': this.sel.recipe = d.value; curRecipe(w, this.sel); this.g.dirty(); this.renderCard(); break;
      case 'setcrop': if (fail(E.setCrop(w, this.sel, d.crop))) { this.g.dirty(); this.renderCard(); } break;
      case 'cropfield': this.cropField(this.sel, this.sel.next || this.sel.crop); break;
      case 'buyseedcard': if (fail(E.buySeed(w, d.crop))) { E.setCrop(w, this.sel, d.crop); this.g.dirty(); this.renderCard(); } break;
      case 'fire': { const wk = s.workers.find((x) => x.id === +d.id); if (wk) this.askFire(wk); break; }
      case 'iteminfo': this.itemInfo(d.item); break;
      case 'open': this.openSheet(d.v); break;
      // farmhands
      case 'hirerole': this.hireRole = d.v; this.renderSheet(); break;
      case 'hire': if (fail(E.hire(w, this.hireRole))) { this.g.dirty(); this.renderSheet(); } break;
      case 'find': { const wk = s.workers.find((x) => x.id === +d.id); if (wk) { this.openSheet(null); this.select(wk); this.g.focus(wk.x * TILE, wk.y * TILE); } break; }
      case 'rename': this.rename(+d.id); break;
      case 'helpers': s.settings.helpers = !!d.checked; this.g.dirty(); break;
      // market
      case 'sell': { const n = d.n === 'all' ? w.have(d.item) : +d.n; const c = E.sell(w, d.item, n); if (c) { this.coinPop(el); this.g.dirty(); } this.renderSheet(); break; }
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
      case 'claimach': { const a = ACHIEVEMENTS.find((x) => x.id === d.id); const tier = (s.ach[d.id] || 0); if (fail(E.claimAch(w, d.id))) { this.toast(`${a.name} ${roman(tier + 1)}! +${fmt(achReward(a, tier))} coins`, 'good'); this.coinPop(el); const hat = Object.entries(HATS).find(([, h]) => h.ach === `${d.id}:${tier}`); if (hat) this.toast(`New hat unlocked: ${hat[1].name}!`, 'good'); this.g.dirty(); this.renderSheet(); } break; }
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
    $('#h-xp').style.width = s.level >= MAX_LEVEL ? '100%' : `${Math.min(100, ((s.xp - a) / (b - a)) * 100)}%`;
    const used = w.used();
    const st = $('#h-store');
    st.textContent = `${fmt(used)}/${fmt(w.capacity)}`;
    st.parentElement.classList.toggle('full', used >= w.capacity);
    $('#h-charm').textContent = Math.floor(w.charm);
    const sync = Cloud.user() ? `<i class="sync ${Cloud.status.state}" title="Cloud save: ${Cloud.status.state}"></i>` : '';
    $('#h-wx').innerHTML = (w.raining ? img(w.season?.id === 'winter' ? 'winter' : 'rain') : img(this.g.R.darkness() > 0.2 ? 'moon' : 'sun')) + sync;
    const sea = seasonAt(Date.now()), fest = festivalOn(Date.now());
    const sh = `${img(sea.id)}<b>${fest ? sea.festival : sea.name}</b>${fest ? '' : `<small>${seasonDaysLeft(Date.now())}d</small>`}`;
    const se = $('#h-season');
    if (se._h !== sh) { se.innerHTML = sh; se._h = sh; se.classList.toggle('fest', fest); }
    const fo = fest && s.fest ? s.fest.orders.filter((o) => E.canFill(w, o)).length : 0;
    const fillable = s.orders.filter((o) => E.canFill(w, o)).length;
    this.badge('orders', fillable || '');
    $('#h-season').classList.toggle('ready', fo > 0);
    this.badge('journal', E.claimableAch(w) || '');
    this.badge('workers', s.workers.length < w.housing && s.coins >= E.nextHireCost(w) ? '!' : '');
    this.renderGoal();
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
    for (const b of el.querySelectorAll('[data-need]')) b.disabled = this.s.coins < +b.dataset.need;
  }
  tabs(sheet, list) {
    return `<div class="tabs">${list.map(([id, name]) => `<button class="${this.tab[sheet] === id ? 'on' : ''}" data-act="tab" data-sheet="${sheet}" data-v="${id}">${name}</button>`).join('')}</div>`;
  }

  sheet_build() {
    const w = this.w, s = this.s, tab = this.tab.build;
    const t = BUILD_TABS.find((x) => x.id === tab);
    let html = '';
    if (tab === 'field') {
      html += `<p class="hint">Pick a crop, then tap or drag on your land to lay field plots. Each new plot costs a little more than the last. Farmers then pay for seeds each time they plant. Tap a crop picture to see what it is for.</p><div class="grid">`;
      for (const c of CROP_ORDER) {
        const cr = CROPS[c], it = ITEMS[c];
        const lockLvl = s.level < cr.level, owned = !!s.seeds[c];
        const cost = E.costOf(w, 'plot');
        let btn;
        const sea = seasonAt(Date.now());
        const tag = cr.season ? `<span class="stag ${cr.season === sea.id ? 'on' : ''}">${img(cr.season)} ${SEASONS.find((x) => x.id === cr.season).name} only</span>` : inSeason(c, sea) ? `<span class="stag on">${img(sea.id)} In season +${Math.round((SEASON_BONUS - 1) * 100)}%</span>` : '';
        if (lockLvl) btn = `<span class="lock">${img('lock')} Lv ${cr.level}</span>`;
        else if (!owned) btn = `<button class="btn small" data-act="seed" data-crop="${c}" data-need="${cr.cost}">Unlock ${coin(cr.cost)}</button>`;
        else btn = `<button class="btn small green" data-act="pick" data-type="plot" data-crop="${c}">Plot ${coin(cost)}</button>`;
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
      if (tab === 'decor') html = `<p class="hint">Decorations are just for looks, but each one adds a little charm (charm raises sell prices a bit).</p>` + html;
    }
    html += `<div class="row center"><button class="btn" data-act="removemode">${img('trash')} Remove things</button></div>`;
    return { title: `${img('hammer', 'pi big')} Build`, tabs: this.tabs('build', BUILD_TABS.map((x) => [x.id, x.name])), html };
  }
  buildTile(type) {
    const w = this.w, s = this.s, d = DEFS[type];
    const lock = s.level < d.level;
    const cost = E.costOf(w, type);
    const meta = d.charm ? `${img('heart')}+${d.charm} charm` : d.store ? `${img('box')}+${d.store} storage` : d.houses ? `${img('people')} houses ${d.houses}` : d.speed ? `walk ×${d.speed}` : '';
    return `<div class="tile ${lock ? 'locked' : ''}"><img class="thumb" src="${thumb(type)}" alt="">
      <div class="tn">${d.name}</div><div class="tm">${meta}</div>
      ${d.desc ? `<div class="td">${esc(d.desc)}</div>` : ''}
      ${d.season ? `<span class="stag ${E.seasonalBlock(w, d) ? '' : 'on'}">${img(d.season)} ${SEASONS.find((x) => x.id === d.season).name} only</span>` : ''}
      ${lock ? `<span class="lock">${img('lock')} Lv ${d.level}</span>` : E.seasonalBlock(w, d) ? `<span class="lock">${img('lock')} ${E.seasonalBlock(w, d)}</span>`
        : d.ribbons ? `<button class="btn small" data-act="pick" data-type="${type}" ${s.ribbons < d.ribbons ? 'disabled' : ''}>${ribbon(d.ribbons)}</button>`
        : `<button class="btn small" data-act="pick" data-type="${type}" data-need="${cost}">${coin(cost)}</button>`}</div>`;
  }

  sheet_workers() {
    const w = this.w, s = this.s;
    const cost = E.nextHireCost(w);
    const room = s.workers.length < w.housing;
    let html = `<div class="hire"><div class="roles">${ROLE_ORDER.map((r) => `<button class="${this.hireRole === r ? 'on' : ''}" data-act="hirerole" data-v="${r}">${ROLES[r].name}</button>`).join('')}</div>
      <p class="hint">${esc(ROLES[this.hireRole].desc)}</p>
      <div class="row"><span>${img('people')} ${s.workers.length}/${w.housing} beds${room ? '' : ' · build a Cottage for more'}</span>
      <button class="btn green" data-act="hire" ${room ? `data-need="${cost}"` : 'disabled'}>Hire ${coin(cost)}</button></div></div>`;
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
      html += `<div class="urow ${have ? '' : 'locked'}"><img class="ava" src="${hatPreview(id)}" alt=""><div class="ui"><div class="un">${h.name}</div><div class="ud">${have ? 'In your hat rack' : h.cost ? 'For sale' : h.ribbons ? `Festival prize at the ${SEASONS.find((x) => x.id === h.festival).festival}` : `Earned from ${achName(h.ach)}`}</div></div>
        ${have ? '<span class="max">OWNED</span>' : h.cost ? `<button class="btn small" data-act="buyhat" data-id="${id}" data-need="${h.cost}">${coin(h.cost)}</button>` : h.ribbons && !E.seasonalBlock(this.w, h) ? `<button class="btn small" data-act="buyhat" data-id="${id}" ${s.ribbons < h.ribbons ? 'disabled' : ''}>${ribbon(h.ribbons)}</button>` : `<span class="lock">${img('lock')}</span>`}</div>`;
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
        html += `<div class="order fest ${ok ? 'ready' : ''}"><div class="of">${esc(o.from)} needs for the fair:</div><div class="oi">${o.items.map((x) => `<span class="need ${w.have(x.item) >= x.qty ? 'ok' : ''}">${itemImg(x.item)}<b>${fmt(Math.min(w.have(x.item), x.qty))}/${x.qty}</b> ${ITEMS[x.item].name}</span>`).join('')}</div>
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
    const items = Object.keys(ITEMS).filter((k) => w.have(k) > 0 || s.autoSell[k] !== undefined);
    const used = w.used();
    let html = `<div class="store"><div class="bar big ${used >= w.capacity ? 'full' : ''}"><i style="width:${Math.min(100, (used / w.capacity) * 100)}%"></i></div>
      <span data-live="store">${fmt(used)} / ${fmt(w.capacity)} stored</span><span class="hint">Prices +${Math.round((w.fx.sell - 1) * 100)}% from haggling & charm</span></div>`;
    html += `<div class="row"><button class="btn gold" data-act="sellcrops">${img('coin')} Sell all crops</button><span class="hint">Skips items set to auto-sell</span></div>`;
    if (!items.length) html += `<p class="empty">Storage is empty. Your farmhands will bring harvests here.</p>`;
    html += '<div class="list">';
    for (const k of items) {
      const auto = s.autoSell[k];
      html += `<div class="irow">${infoImg(k, 'pi big')}<div class="ii"><div class="in">${ITEMS[k].name}</div><div class="iq"><b data-live="q${k}">${fmt(w.have(k))}</b> · ${coin(sellPrice(w, k))} each</div></div>
        <div class="ib"><button class="btn small" data-act="sell" data-item="${k}" data-n="1">Sell 1</button><button class="btn small gold" data-act="sell" data-item="${k}" data-n="all">All</button></div>
        <div class="ia"><label class="check"><input type="checkbox" data-chg="auto" data-item="${k}" ${auto !== undefined ? 'checked' : ''}> Auto-sell</label>
        ${auto !== undefined ? `<span class="keep">keep <button class="btn tiny" data-act="reserve" data-item="${k}" data-n="-5">−</button><b>${auto}</b><button class="btn tiny" data-act="reserve" data-item="${k}" data-n="5">+</button></span>` : ''}</div></div>`;
    }
    html += '</div><p class="hint">Auto-sell sells anything above the amount you keep, even while you are away. Keep some if a workshop needs it.</p>';
    return { title: `${img('market', 'pi big')} Market`, html };
  }
  live_market() {
    const w = this.w, out = { store: `${fmt(w.used())} / ${fmt(w.capacity)} stored` };
    for (const k in this.s.inv) out[`q${k}`] = fmt(w.have(k));
    return out;
  }

  sheet_orders() {
    const w = this.w, s = this.s;
    let html = `<p class="hint">Neighbours post requests here. Orders pay much more than the market and give bonus XP.</p>`;
    if (!s.orders.length) html += `<p class="empty">No orders right now.</p>`;
    for (const o of s.orders) {
      const ok = E.canFill(w, o);
      html += `<div class="order ${ok ? 'ready' : ''}"><div class="of">${esc(o.from)} would like:</div><div class="oi">${o.items.map((x) => {
        const have = w.have(x.item);
        return `<span class="need ${have >= x.qty ? 'ok' : ''}">${itemImg(x.item)}<b data-live="o${o.id}${x.item}">${fmt(Math.min(have, x.qty))}/${x.qty}</b> ${ITEMS[x.item].name}</span>`;
      }).join('')}</div>
        <div class="row"><span>Reward ${coin(o.reward)} <span class="xp">+${fmt(o.xp)} XP</span></span>
        <span><button class="btn small" data-act="skip" data-id="${o.id}">Skip</button> <button class="btn small green" data-act="fill" data-id="${o.id}" ${ok ? '' : 'disabled'}>Deliver</button></span></div></div>`;
    }
    html += `<p class="hint" data-live="next">${this.nextOrderText()}</p>`;
    return { title: `${img('scroll', 'pi big')} Orders`, html };
  }
  nextOrderText() {
    const s = this.s;
    if (s.orders.length >= 3) return 'The board is full. Deliver or skip an order to get a new one.';
    return `Next order in about ${fmtTime((s.nextOrderAt - Date.now()) / 1000)}.`;
  }
  live_orders() {
    const w = this.w, out = { next: this.nextOrderText() };
    for (const o of this.s.orders) for (const x of o.items) out[`o${o.id}${x.item}`] = `${fmt(Math.min(w.have(x.item), x.qty))}/${x.qty}`;
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
    } else {
      const total = Object.keys(ITEMS).length, n = discovered(s);
      html += `<p class="hint">Every crop, fruit and product you have ever gathered or made: <b>${n} / ${total}</b>.</p><div class="collection">`;
      for (const k of Object.keys(ITEMS)) {
        const got = (s.stats.harvest[k] || 0) + (s.stats.craft[k] || 0) > 0;
        html += `<div class="ci ${got ? '' : 'unknown'}" title="${got ? esc(ITEMS[k].name) : esc(sourceOf(k))}">${itemImg(k, 'pi big')}<small>${got ? esc(ITEMS[k].name) : '???'}</small></div>`;
      }
      html += '</div><p class="hint">Tap and hold (or hover) a ??? to see where it comes from.</p>';
    }
    return { title: `${img('book', 'pi big')} Journal`, tabs: this.tabs('journal', [['goals', 'Goals'], ['ach', `Achievements${E.claimableAch(w) ? ` (${E.claimableAch(w)})` : ''}`], ['collection', 'Collection']]), html };
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
    return { title: `${img('up', 'pi big')} Upgrades`, html };
  }

  sheet_menu() {
    const s = this.s, w = this.w;
    const tab = this.tab.menu;
    let html = '';
    if (tab === 'farm') {
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
        <p><b>Long-term:</b> the Journal tracks goals, tiered achievements (some unlock hats for your farmhands) and a collection book of every good on the farm.</p>
        <p><b>Install on your phone:</b> on iPhone open this page in Safari, tap Share, then "Add to Home Screen". On Android tap the menu, then "Install app".</p></div>`;
    }
    return { title: `${img('menu', 'pi big')} Menu`, tabs: this.tabs('menu', [['farm', 'Farm'], ['help', 'How to play']]), html };
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
    for (const b of el.querySelectorAll('[data-need]')) b.disabled = this.s.coins < +b.dataset.need;
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
    const upBtn = d.upg ? (o.lvl >= d.maxLvl ? '<span class="max">MAX LEVEL</span>'
      : `<button class="btn small green" data-act="upgradeb" data-need="${E.bUpgradeCost(o)}">${img('up')} Upgrade ${coin(E.bUpgradeCost(o))}</button>`) : '';
    const lvl = o.lvl ? ` <span class="lv">Lv ${o.lvl}${d.maxLvl ? `/${d.maxLvl}` : ''}</span>` : '';
    const base = { icon: `<img class="thumb" src="${thumb(o.type, o.crop)}" alt="">`, title: d.name + lvl, btns: upBtn + moveBtn + rmBtn };
    if (o.type === 'plot') {
      const cr = CROPS[o.crop];
      const status = () => {
        let t;
        if (o.st === 'empty') t = !cropUnlocked(s, o.crop) ? 'Seed locked' : !canPlantNow(o.crop, seasonAt(Date.now())) ? `Waiting for ${SEASONS.find((x) => x.id === cr.season).name} to plant again`
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
        btns: `<button class="btn small" data-act="iteminfo" data-item="${o.crop}">${img('book')} About ${ITEMS[o.crop].name}</button><button class="btn small" data-act="cropfield">Plant whole field</button>` + moveBtn + rmBtn,
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
        if (o._busy) st = `Making ${ITEMS[o.batch || r.out].name}… ${Math.floor(o.prog * 100)}%`;
        else if (!r) st = 'Nothing to make: needs ingredients in storage';
        else if (n >= outCap(o)) st = 'Output full: waiting for pickup';
        else if (o.prog > 0) st = `Paused at ${Math.floor(o.prog * 100)}%: waiting for an artisan`;
        else {
          const miss = Object.keys(r.in).filter((k) => (o.inp[k] || 0) < r.in[k]);
          st = miss.length ? `Waiting for ${miss.map((k) => ITEMS[k].name).join(', ')}` : 'Ready: waiting for an artisan';
        }
        const inp = Object.keys(o.inp).length ? Object.entries(o.inp).map(([k, v]) => `${itemImg(k)}${v}`).join(' ') : '—';
        const out = n ? Object.entries(o.out).map(([k, v]) => `${itemImg(k)}${v}`).join(' ') : '—';
        return { st, inp, out: `${out} <small>(${n}/${outCap(o)})</small>`, pb: `<i style="width:${o.prog * 100}%"></i>` };
      };
      const v = info();
      const opts = `<option value="auto" ${o.recipe === 'auto' ? 'selected' : ''}>Auto (best available)</option>` + list.map((r) => `<option value="${r.out}" ${o.recipe === r.out ? 'selected' : ''}>${ITEMS[r.out].name}</option>`).join('');
      const recipes = list.map((r) => `<div class="recipe ${curRecipe(w, o) === r ? 'on' : ''}">${Object.entries(r.in).map(([k, q]) => `<span>${infoImg(k)}${q}</span>`).join('<i>+</i>')}<i>→</i><span>${infoImg(r.out)}</span>
        <small>${fmtTime(craftTime(w, o, r))} · ${coin(sellPrice(w, r.out))}</small></div>`).join('');
      const locked = DEFS[o.type].recipes.filter((r) => !list.includes(r)).map((r) => `<div class="recipe locked">${itemImg(r.out)} ${ITEMS[r.out].name} <small>${img('lock')} Lv ${r.level}</small></div>`).join('');
      return { ...base, sub: d.desc,
        body: `<div class="status" data-live="st">${v.st}</div><div class="bar" data-live="pb">${v.pb}</div>
          <div class="row"><span>Make</span><select data-chg="recipe">${opts}</select></div>
          <div class="io"><span>In: <b data-live="inp">${v.inp}</b></span><span>Out: <b data-live="out">${v.out}</b></span></div>
          <div class="recipes">${recipes}${locked}</div>
          <p class="hint">Tap any item to see what it is for.</p>${this.workTip('craft')}`,
        live: info };
    }
    if (d.animal) {
      const A = d.animal;
      const info = () => ({ st: o.feed > 0 ? (o.out >= animalCap(o) ? `Full: waiting for a rancher` : `Happy and producing`) : `Hungry: needs ${ITEMS[A.feed].name.toLowerCase()} from storage`,
        feed: `${itemImg(A.feed)} ${o.feed}/${feedCap(o)}`, out: `${itemImg(A.item)} ${o.out}/${animalCap(o)}` });
      const v = info();
      return { ...base, sub: `${animalCount(o)} ${A.kind}s · 1 ${ITEMS[A.item].name.toLowerCase()} each ${fmtTime(A.time / (animalCount(o) * w.fx.animal))}`,
        body: `<div class="status" data-live="st">${v.st}</div><div class="io"><span>Feed: <b data-live="feed">${v.feed}</b></span><span>Ready: <b data-live="out">${v.out}</b></span></div>
        <p class="hint">${esc(d.desc)} Upgrading adds an animal.</p>${usesHTML(A.item)}${this.workTip('animal')}`, live: info };
    }
    if (d.hive) {
      const it = d.hive.item;
      const info = () => ({ out: `${itemImg(it)} ${o.out}/${hiveCap(o)}` });
      const near = o.type === 'beehive' ? `${o._flowers || 0} flowers nearby · ` : '';
      return { ...base, sub: `${near}1 ${ITEMS[it].name.toLowerCase()} every ${fmtTime(d.hive.time / (hiveRate(o) * w.fx.animal))}`,
        body: `<div class="io"><span>${ITEMS[it].name}: <b data-live="out">${info().out}</b></span></div><p class="hint">${esc(d.desc)}</p>${usesHTML(it)}${this.workTip('hive')}`, live: info };
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
    const facts = [`Sells for ${coin(sellPrice(w, k))}`, w.have(k) ? `You have ${fmt(w.have(k))}` : ''];
    if (cr) facts.push(`${img('clock')} ${fmtTime(cr.time)} to grow`, `${cr.yield} per harvest`, `Seeds ${cr.seed ? coin(cr.seed) : 'free'}`,
      cr.regrow ? 'Regrows after picking' : '', cr.season ? `${SEASONS.find((x) => x.id === cr.season).name} only` : '');
    const from = [...new Set((SOURCES[k] || []).map((t) => (t === 'plot' ? 'Field plots' : DEFS[t].name)))];
    const rows = (USES[k] || []).map((u) => {
      const at = DEFS[u.at], lvl = Math.max(at.level, u.r?.level || 0), lock = s.level < lvl ? ` ${img('lock')} Lv ${lvl}` : '';
      if (u.out) return `<div class="recipe">${Object.entries(u.r.in).map(([i, q]) => `<span>${infoImg(i)}${q}</span>`).join('<i>+</i>')}<i>→</i><span>${infoImg(u.out)}</span><b>${ITEMS[u.out].name}</b><small>${at.name}${lock}</small></div>`;
      if (u.feeds) return `<div class="recipe">Feeds the ${u.feeds}s<small>${at.name}${lock}</small></div>`;
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
      const name = m.type === 'plot' ? `${ITEMS[m.extra.crop].name} field` : d.name;
      const why = m.k === 'place' ? this.w.canPlace(m.type, m.x, m.y) : '';
      const tip = m.k === 'paint' ? `${m.type === 'plot' ? `Price is for the plot, rising ${coin(2)} each; seeds are ${coin(CROPS[m.extra.crop].seed)} per planting. ` : ''}Tap or drag to place. Two fingers to move the view.` : why ? `<span class="why">${why}</span>` : 'Tap where it should go, then press the check.';
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
    for (const b of el.querySelectorAll('[data-need]')) b.disabled = this.s.coins < +b.dataset.need;
  }

  tileAt(sx, sy) {
    const [x, y] = this.g.R.toWorld(sx, sy);
    return [Math.floor(x / TILE), Math.floor(y / TILE)];
  }

  tap(sx, sy) {
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
        const o = this.g.R.pick(sx, sy);
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
    const hit = this.g.R.pick(sx, sy);
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
      if (single || ['path', 'fence', 'field'].includes(d.cat) || (d.cat === 'decor' && d.w === 1)) {
        if (!single && !['path', 'fence', 'field', 'decor'].includes(d.cat)) return;
        if (single) { this.askRemove(o); return; }
        const why = E.remove(w, o);
        if (!why) this.g.dirty();
      }
      return;
    }
    const existing = w.objAt(tx, ty);
    if (existing && existing.type === 'plot' && m.type === 'plot') {
      if (existing.crop !== m.extra.crop) { E.setCrop(w, existing, m.extra.crop); this.g.dirty(); }
      return;
    }
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
    if (e.t === 'float') R.float(e.x, e.y, e.text, e.item);
    else if (e.t === 'splash') R.splash(e.x, e.y);
    else if (e.t === 'level') this.levelUp(e.level, e.reward);
    else if (e.t === 'wlevel') this.toast(`${e.w.name} reached level ${e.w.lvl}!`, 'good');
    else if (e.t === 'full') { if (Date.now() - this.lastFull > 30000) { this.lastFull = Date.now(); this.toast('Storage is full! Sell goods, turn on auto-sell or upgrade the barn.', 'bad'); } }
    else if (e.t === 'fired') { this.toast(`${e.w.name} said goodbye to the farm`); }
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
      ${sum.levels ? `<p>${img('star')} The farm reached level <b>${this.s.level}</b>!</p>` : ''}
      ${sum.newOrders ? `<p>${img('scroll')} ${sum.newOrders} new order${sum.newOrders > 1 ? 's' : ''} on the notice board.</p>` : ''}
      ${!h && !c ? '<p class="hint">Not much happened. Make sure storage has room and fields have crops.</p>' : ''}
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
