// The on-screen HUD: money, clock, health/armour with numbers, speedometer, objective, mission
// timer, dialogue box with painted portraits, banners, toasts and prompts. The data panels
// (police roster, HEAT, rank, crew, weapon bar, mission stages) live in HudPanels.
import { districtAt } from '../world/CityLayout.js';
import { HudPanels } from './HudPanels.js';
import { paintInto } from './Portraits.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {};
    for (const id of ['hud', 'mission-title', 'objective-text', 'mission-timer', 'hold-bar', 'hold-fill', 'clock', 'money',
      'district-name', 'health-fill', 'armor-fill', 'health-num', 'armor-num', 'speedo', 'speed-value', 'vehicle-name',
      'crosshair', 'prompt', 'dialogue', 'dialogue-portrait', 'dialogue-speaker', 'dialogue-role', 'dialogue-text', 'banner', 'banner-title', 'banner-sub',
      'toast', 'damage-flash', 'stunt', 'speedlines']) this.el[id] = $(id);
    this.stuntT = 0;
    this.panels = new HudPanels(game);
    this.panelT = 0;
    this.shownMoney = 0;
    this.lines = [];
    this.lineT = 0;
    this.bannerT = 0;
    this.toastT = 0;
    this.districtT = 0;
    this.district = '';
    this.promptText = '';
    this.vehicleNameT = 0;
    this.hitT = 0;
  }

  show(on) { this.el.hud.classList.toggle('hidden', !on); }

  setObjective(title, text) {
    this.el['mission-title'].textContent = title;
    this.el['objective-text'].textContent = text;
  }

  missionStart(title) { this.banner(title.toUpperCase(), 'New job', false, 3); }

  setTimer(sec) {
    const el = this.el['mission-timer'];
    if (sec === null || sec === undefined) { el.textContent = ''; return; }
    const s = Math.max(0, Math.ceil(sec));
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    el.style.color = s < 20 ? '#ff6b5a' : '#fff';
  }

  setHold(frac) {
    this.el['hold-bar'].style.display = frac === null ? 'none' : 'block';
    if (frac !== null) this.el['hold-fill'].style.width = `${Math.min(100, frac * 100)}%`;
  }

  say(lines) { this.lines.push(...lines); if (this.lineT <= 0) this.nextLine(); }

  // Interrupt whatever is being said.
  sayNow(lines) { this.lines = [...lines]; this.lineT = 0; this.nextLine(); }

  nextLine() {
    const line = this.lines.shift();
    const box = this.el.dialogue;
    if (!line) { box.classList.remove('show'); this.lineT = 0; return; }
    box.classList.add('show');
    paintInto(this.el['dialogue-portrait'], line.who.look || { bg: line.who.color, shirt: line.who.color });
    this.el['dialogue-speaker'].textContent = line.who.name;
    this.el['dialogue-role'].textContent = line.who.role || '';
    this.el['dialogue-text'].textContent = line.text;
    this.lineT = 2.4 + line.text.length * 0.045;
  }

  banner(title, sub, fail = false, time = 4.5) {
    this.el['banner-title'].textContent = title;
    this.el['banner-sub'].textContent = sub;
    this.el.banner.classList.toggle('fail', fail);
    this.el.banner.classList.remove('show');
    void this.el.banner.offsetWidth;
    this.el.banner.classList.add('show');
    this.bannerT = time;
  }

  toast(text) { this.el.toast.textContent = text; this.el.toast.style.display = 'block'; this.toastT = 2.6; }
  prompt(html) { this.promptText = html; }
  // Driving bonus popup (near misses), e.g. "NEAR MISS x3" with the cash it paid.
  stunt(title, sub) {
    this.el.stunt.innerHTML = `<b>${title}</b><span>${sub}</span>`;
    this.el.stunt.classList.add('show');
    this.stuntT = 1.8;
  }
  flashDamage() { this.el['damage-flash'].style.opacity = 1; setTimeout(() => { this.el['damage-flash'].style.opacity = 0; }, 120); }
  hitMarker(hit) { if (hit) { this.el.crosshair.classList.add('hit'); this.hitT = 0.15; } }
  showVehicleName(name) { this.el['vehicle-name'].textContent = name; this.vehicleNameT = 4; }

  updateWeapon() { this.panels.updateWeapons(); }

  // Refresh everything at once (used when a staged scene freezes the frame).
  refreshAll() { this.panelT = 0; this.update(0); this.panels.update(0); this.panels.updateWeapons(); }

  update(dt) {
    const game = this.game, pl = game.player, el = this.el;
    // Money counts up.
    const target = game.money;
    this.shownMoney += (target - this.shownMoney) * Math.min(1, dt * 6);
    if (Math.abs(target - this.shownMoney) < 1) this.shownMoney = target;
    el.money.textContent = `$${Math.round(this.shownMoney).toLocaleString('en-US')}`;
    const h = game.sky.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    el.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    el['health-fill'].style.width = `${Math.max(0, pl.health)}%`;
    el['armor-fill'].style.width = `${pl.armor}%`;
    el['health-num'].textContent = Math.max(0, Math.round(pl.health));
    el['armor-num'].textContent = Math.round(pl.armor);
    // Driving vs on foot.
    const v = pl.vehicle;
    el.speedo.style.display = v ? 'block' : 'none';
    el.crosshair.style.display = v || pl.dead || game.weapons.current.melee ? 'none' : 'block';
    // Speed lines streak in at the screen edges above ~100 km/h.
    const kmh = v ? Math.abs(v.speed) * 3.6 : 0;
    el.speedlines.style.opacity = Math.max(0, Math.min(0.75, (kmh - 100) / 80));
    if (v) {
      el['speed-value'].textContent = Math.round(kmh);
      el['vehicle-name'].textContent = v.type.name.toUpperCase();
    }
    this.panelT -= dt;
    if (this.panelT <= 0) { this.panelT = 0.15; this.panels.update(0.15); }
    // District name when it changes.
    const d = districtAt(pl.position.x, pl.position.z).name;
    if (d !== this.district) { this.district = d; this.districtT = 5; el['district-name'].textContent = d; }
    this.districtT -= dt;
    el['district-name'].style.opacity = this.districtT > 0 || game.forceDistrict ? 1 : 0;
    // Timed elements.
    if (this.lineT > 0) { this.lineT -= dt; if (this.lineT <= 0) this.nextLine(); }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) el.banner.classList.remove('show'); }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) el.toast.style.display = 'none'; }
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) el.crosshair.classList.remove('hit'); }
    // Context prompt (set fresh each frame).
    if (!this.promptText && !v && !pl.dead) {
      const near = pl.nearestVehicle(4.5);
      if (near) this.promptText = near.owned ? `<b>F</b> Get in the ${near.type.name}` : `<b>F</b> STEAL <i>${near.type.name}</i>`;
    }
    if (this.stuntT > 0) { this.stuntT -= dt; if (this.stuntT <= 0) el.stunt.classList.remove('show'); }
    el.prompt.innerHTML = this.promptText;
    el.prompt.style.display = this.promptText ? 'block' : 'none';
    this.promptText = '';
  }
}
