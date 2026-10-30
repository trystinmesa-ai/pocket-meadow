// Boot: load the farm (local and cloud), catch up on time away, then run
// the live loop: simulate, draw, update the interface, save.
import { TILE, MAP } from './data.js';
import { World, newGame, migrate } from './world.js';
import { step } from './sim.js';
import { Renderer } from './render.js';
import { attachInput } from './input.js';
import { UI } from './ui.js';
import { saveLocal, loadLocal, catchUp, serialize, wipeLocal, backupLocal, setOwner } from './save.js';
import * as Cloud from './cloud.js';

const LOCAL_SAVE_EVERY = 10;   // seconds
const CLOUD_SAVE_EVERY = 60;   // seconds
const SHOW_SUMMARY_AFTER = 3 * 60 * 1000;

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.lastFrame = performance.now();
    this.saveT = 0; this.cloudT = 0; this.uiT = 0;
    this.busy = false;
  }

  async boot() {
    setOwner(Cloud.user()?.id);
    let state = loadLocal();
    const fresh = !state;
    if (!state) state = newGame();
    this.world = new World(state);
    this.R = new Renderer(this.canvas, this.world);
    this.ui = new UI(this);
    this.input = attachInput(this.canvas, this.R, {
      tap: (x, y) => this.ui.tap(x, y), hover: (x, y) => this.ui.hover(x, y),
      isPaint: () => this.ui.isPaint(), paint: (x, y, f) => this.ui.paint(x, y, f), paintEnd: () => this.ui.paintEnd(),
      escape: () => this.ui.escape(),
    });
    this.frameFarm();
    addEventListener('resize', () => { this.R.resize(); this.R.clampCam(); });
    document.addEventListener('visibilitychange', () => this.onVisibility());
    addEventListener('pagehide', () => this.persist(true));
    Cloud.onStatus(() => { if (this.ui.sheet === 'menu') this.ui.liveSheet(); });

    if (Cloud.user()) await this.pullCloud(true);
    this.R.resize();
    this.frameFarm();
    document.getElementById('boot').classList.add('done');
    await this.catchUpTo(Date.now(), !fresh);
    this.ui.tick();
    if (fresh && !Cloud.user()) this.ui.modal(`<div class="welcome"><h2>Welcome to Pocket Meadow!</h2>
      <p>This little patch of land is yours, with 100 coins to get started. Hire a farmer in <b>Farmhands</b>, then lay a few wheat plots from <b>Build</b>. Wheat seeds cost just 1 coin.</p>
      <p>Follow the goals at the top, sell your harvest at the market stall, and grow your farm. It keeps working while you’re away.</p>
      <p class="hint">Have an account? Open Menu to sign in and load your farm.</p></div>`, [['Let’s farm!', 'ok', 'green']]);
    requestAnimationFrame((t) => this.loop(t));
  }

  frameFarm() {
    // centre on the farmhouse and fit the owned area
    const s = this.world.state;
    const house = s.objects.find((o) => o.type === 'farmhouse');
    this.R.cam.x = house ? (house.x + 7) * TILE : MAP.w * TILE / 2;
    this.R.cam.y = house ? (house.y + 4) * TILE : MAP.h * TILE / 2;
    const fit = Math.min(this.canvas.clientWidth / (14 * TILE), (this.canvas.clientHeight - 140) / (9 * TILE));
    this.R.cam.z = Math.max(1, Math.round(Math.max(1.5, fit) * this.R.dpr)) / this.R.dpr;
    this.R.clampCam();
  }
  focus(x, y) { this.R.cam.x = x; this.R.cam.y = y; this.R.clampCam(); }

  loop(t) {
    const real = (t - this.lastFrame) / 1000;
    this.lastFrame = t;
    if (!this.busy) {
      if (real > 3) this.catchUpTo(Date.now(), real * 1000 > SHOW_SUMMARY_AFTER);
      else {
        const dt = Math.min(0.1, real);
        let left = dt;
        while (left > 1e-6) { const d = Math.min(0.05, left); step(this.world, d, false, Date.now()); left -= d; }
        this.world.state.stats.play += dt;
        for (const e of this.world.events) this.ui.handle(e);
        this.world.events.length = 0;
        this.saveT += dt; this.cloudT += dt; this.uiT += dt;
        if (this.uiT > 0.25) { this.uiT = 0; this.ui.tick(); }
        if (this.saveT > LOCAL_SAVE_EVERY) { this.saveT = 0; saveLocal(this.world.state); }
        if (this.cloudT > CLOUD_SAVE_EVERY) { this.cloudT = 0; this.syncNow(); }
      }
    }
    this.input.tick();
    this.R.draw(Math.min(0.1, real));
    requestAnimationFrame((n) => this.loop(n));
  }

  /** Fast-forward the farm to `now`, with a progress screen for long gaps. */
  async catchUpTo(now, summary) {
    const s = this.world.state;
    const gap = now - s.simTime;
    if (gap < 1000) { s.simTime = now; return; }
    this.busy = true;
    const show = gap > 20 * 1000;
    const bar = document.getElementById('catchup');
    if (show) bar.classList.add('open');
    try {
      const sum = await catchUp(this.world, gap, (p) => { bar.querySelector('i').style.width = `${Math.round(p * 100)}%`; });
      this.world.events.length = 0;
      this.world.rebuild();
      saveLocal(s);
      if (summary && gap > SHOW_SUMMARY_AFTER) this.ui.welcomeBack(sum);
      else if (s.pendingCoins) { s.coins += s.pendingCoins; s.pendingCoins = 0; }
    } finally {
      bar.classList.remove('open');
      this.busy = false;
      this.lastFrame = performance.now();
    }
  }

  dirty() { Cloud.markDirty(); }

  persist(leaving) {
    if (!this.world) return;
    saveLocal(this.world.state);
    if (Cloud.user()) this.syncNow(false, leaving);
  }

  async onVisibility() {
    if (document.hidden) { this.persist(true); return; }
    // back: take any newer save from another device, then catch up
    if (Cloud.user()) await this.pullCloud(false);
    await this.catchUpTo(Date.now(), true);
  }

  // ---------- cloud ----------
  /** Load the cloud copy if it is newer than this device's. */
  async pullCloud(booting) {
    let row;
    try { row = await Cloud.pull(); } catch { return; }
    const meta = Cloud.syncMeta();
    const local = this.world.state;
    if (!row) { this.syncNow(); return; }
    const cloudState = row.data;
    const newer = row.rev > meta.rev;
    if (!newer) return;
    // A newer save exists. If this device also changed things since its last
    // sync (played offline), keep whichever was saved more recently.
    if (meta.dirty && meta.rev && local.savedAt > cloudState.savedAt) return;
    this.adopt(cloudState, row.rev, !booting);
  }

  adopt(data, rev, announce) {
    const state = migrate(data);
    this.world = new World(state);
    this.R.setWorld(this.world);
    this.ui.select(null, true);
    if (this.ui.mode) this.ui.setMode(null);
    Cloud.adopted(rev);
    saveLocal(state);
    if (announce) this.ui.toast('Loaded your farm from your other device', 'good');
    if (this.ui.sheet) this.ui.renderSheet();
  }

  async syncNow(manual = false, keepalive = false) {
    if (!Cloud.user() || this.syncing) return;
    this.syncing = true;
    try {
      saveLocal(this.world.state);
      const res = await Cloud.push(serialize(this.world.state), { keepalive });
      if (res.conflict) {
        // another device saved since we last synced: its farm is the newer one
        const row = res.conflict;
        this.adopt(row.data, row.rev, true);
        await this.catchUpTo(Date.now(), false);
      } else if (manual && res.ok) this.ui.toast('Farm saved to the cloud', 'good');
    } catch (e) {
      if (manual) this.ui.toast(e.message || 'Sync failed', 'bad');
    } finally {
      this.syncing = false;
    }
  }

  /** Show a different farm (another account's, or the guest farm). */
  async showFarm(state, summary = true) {
    this.world = new World(state);
    this.R.setWorld(this.world);
    this.ui.select(null, true);
    if (this.ui.mode) this.ui.setMode(null);
    this.frameFarm();
    saveLocal(state);
    await this.catchUpTo(Date.now(), summary);
    if (this.ui.sheet) this.ui.renderSheet();
  }

  /** After signing in or creating an account: switch to that account's farm. */
  async enterAccount() {
    const guest = this.world.state;
    saveLocal(guest); // keep the guest farm as it was
    setOwner(Cloud.user().id);
    const mine = loadLocal();
    if (mine) { await this.showFarm(mine); await this.pullCloud(false); return; }
    let row = null;
    try { row = await Cloud.pull(); } catch {}
    if (row) {
      this.adopt(row.data, row.rev, false);
      this.frameFarm();
      await this.catchUpTo(Date.now(), true);
      this.ui.toast('Welcome back! Your farm is loaded.', 'good');
      return;
    }
    // a brand-new account: bring this device's farm along, or start fresh
    this.ui.modal(`<h2>Your new account</h2><p>Do you want to keep playing the farm on this device (level ${guest.level}) with this account, or start a brand-new farm?</p>`,
      [['Start a new farm', 'new'], [`Use this farm (Lv ${guest.level})`, 'keep', 'green']], async (v) => {
        if (v === 'keep') { wipeLocal(null); await this.showFarm(JSON.parse(serialize(guest)), false); }
        else await this.showFarm(newGame(), false);
        Cloud.markDirty();
        await this.syncNow(true);
      });
  }

  async signIn(email, pass) {
    await Cloud.signIn(email, pass);
    await this.enterAccount();
  }

  async signUp(email, pass) {
    const res = await Cloud.signUp(email, pass);
    if (res.confirm) return 'confirm';
    await this.enterAccount();
    return 'ok';
  }

  async signOut() {
    await this.syncNow();
    saveLocal(this.world.state);
    await Cloud.signOut();
    setOwner(null);
    await this.showFarm(loadLocal() || newGame(), false);
    this.ui.toast('Signed out. Your farm is safe in your account.');
  }

  /** Replace the current farm with one from a backup file. */
  async restore(state) {
    state.simTime = Math.min(state.simTime || Date.now(), Date.now());
    await this.showFarm(state, true);
    Cloud.markDirty();
    if (Cloud.user()) await this.syncNow(true);
    this.ui.toast('Backup restored!', 'good');
  }

  resetFarm() {
    backupLocal();
    wipeLocal();
    const state = newGame();
    const meta = Cloud.syncMeta();
    this.world = new World(state);
    this.R.setWorld(this.world);
    this.ui.openSheet(null);
    this.frameFarm();
    saveLocal(state);
    if (Cloud.user()) { Cloud.adopted(meta.rev); Cloud.markDirty(); this.syncNow(); }
    this.ui.toast('A fresh start. Welcome to your new farm!', 'good');
  }
}

const game = new Game();
window.__game = game; // handy for debugging in the console
game.boot().catch((e) => {
  console.error(e);
  const b = document.getElementById('boot');
  b.querySelector('p').textContent = 'Something went wrong starting the game. Try reloading.';
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
