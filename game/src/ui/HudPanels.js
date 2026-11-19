// The HUD's data panels, refreshed a few times a second from the live systems: the SBPD response
// roster, the flame-segment HEAT display, rank and RP, the crew abilities, the five-slot weapon
// bar, the mission stage/next lines, and the car's damage and radio track by the speedometer.
import { WEAPONS, ORDER } from '../combat/WeaponSystem.js';
import { CREW } from '../crew/CrewAbilities.js';
import { BEHAVIOUR_COLORS } from '../police/PoliceRoster.js';
import { RADIO_STATIONS, RADIO_SONGS, CAST } from '../story/StoryScript.js';
import { LOCATIONS } from '../world/CityLayout.js';
import { portraitCanvas } from './Portraits.js';

const $ = (id) => document.getElementById(id);
const FLAME = 'M12 1C14 8 21 11 21 20C21 27 17 31 12 31C7 31 3 27 3 21C3 15 7 13 8 8C9 12 11 13 12 13C12 9 10 5 12 1Z';
const ICONS = {
  fists: 'M9 8h20a5 5 0 0 1 5 5v3a6 6 0 0 1-6 6H15l-6-4zM13 8v6M19 8v6M25 8v6',
  pistol: 'M5 6h30v6H20l-2 10h-7l2-10H5z',
  smg: 'M3 7h37v6h-9l-2 3h-3v7h-5v-7h-5l-2 6H8l2-9H3z',
  shotgun: 'M1 8h45v4H24l-3 3H10l-7 5-2-6 7-3z',
  rifle: 'M1 8h46v4h-8v3h-4l-1 7h-5l1-7H16l-9 6-5-2 8-6H1z',
};
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export class HudPanels {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.buildHeat();
    this.buildWeaponBar();
    this.buildCrew();
  }

  buildHeat() {
    $('heat-flames').innerHTML = Array.from({ length: 5 }, (_, i) =>
      `<svg class="flame" viewBox="0 0 24 32" style="--i:${i}"><path d="${FLAME}"/><path class="core" d="M12 14C13 18 16 20 16 24C16 27 14 29 12 29C10 29 8 27 8 24C8 21 11 19 12 14Z"/></svg>`).join('');
    this.flames = [...$('heat-flames').children];
  }

  buildWeaponBar() {
    $('weapon-bar').innerHTML = ORDER.map((id) => {
      const w = WEAPONS[id];
      return `<div class="wslot" data-id="${id}"><span class="wkey">${w.slot}</span>` +
        `<svg viewBox="0 0 48 26"><path d="${ICONS[id]}"/></svg><span class="wname">${w.short}</span><span class="wammo"></span></div>`;
    }).join('');
    this.slots = [...$('weapon-bar').children];
  }

  buildCrew() {
    const box = $('crew-list');
    box.innerHTML = '';
    this.crewRows = CREW.map((m) => {
      const row = document.createElement('div');
      row.className = 'crew-row';
      const pic = portraitCanvas(m.look, 96);
      pic.className = 'crew-pic';
      row.innerHTML = `<div class="crew-info"><div class="crew-name">${m.name} <span>${m.role}</span></div>` +
        `<div class="crew-ability"><span class="ckey">${m.keyLabel}</span>${m.ability}<span class="cstate"></span></div>` +
        `<div class="cbar"><div class="cfill"></div></div></div>`;
      row.prepend(pic);
      box.appendChild(row);
      return { row, member: m, state: row.querySelector('.cstate'), fill: row.querySelector('.cfill') };
    });
  }

  // Weapon bar: owned slots show ammo, rank-locked ones say what unlocks them.
  updateWeapons() {
    const w = this.game.weapons;
    for (const el of this.slots) {
      const id = el.dataset.id, def = WEAPONS[id], owned = w.owned.has(id);
      el.classList.toggle('sel', w.current.id === id);
      el.classList.toggle('locked', !owned);
      el.querySelector('.wammo').textContent = !owned ? (def.unlockRank ? `RANK ${def.unlockRank}` : '—') : def.melee ? '∞' : w.ammo[id];
    }
  }

  update(dt) {
    this.t += dt;
    const game = this.game;
    this.updatePolice();
    this.updateHeat();
    this.updateRank();
    this.updateCrew();
    this.updateMission();
    this.updateVehicle();
    $('weapon-bar').classList.toggle('driving', !!game.player.vehicle);
  }

  updatePolice() {
    const game = this.game, roster = game.wanted.roster, units = roster.units;
    const panel = $('police-panel');
    panel.style.display = units.length || game.wanted.level ? 'block' : 'none';
    if (panel.style.display === 'none') return;
    $('police-summary').textContent = `${units.length} UNIT${units.length === 1 ? '' : 'S'} · CODE ${roster.code}`;
    $('police-list').innerHTML = units.slice(0, 6).map((u) =>
      `<div class="unit"><span class="ukind k-${u.kind}"></span><span class="ucall">${u.callsign}</span>` +
      `<span class="udist">${Math.round(u.d)} m</span><span class="utag" style="--c:${BEHAVIOUR_COLORS[u.state] || '#fff'}">${u.state}</span></div>`).join('') +
      (units.length > 6 ? `<div class="unit more">+${units.length - 6} more</div>` : '') +
      (!units.length ? '<div class="unit more">Units en route…</div>' : '');
  }

  updateHeat() {
    const wanted = this.game.wanted, level = wanted.level;
    this.flames.forEach((f, i) => f.classList.toggle('on', i < level));
    const heat = $('heat');
    heat.classList.toggle('hot', level > 0);
    heat.classList.toggle('evading', wanted.evading);
    const st = $('heat-status');
    if (!level) st.textContent = 'CLEAN';
    else if (wanted.evading) st.textContent = `EVADING ${Math.round(wanted.evadeFrac * 100)}%`;
    else st.textContent = wanted.heli.tracking ? 'LIT UP · AIR UNIT' : 'SPOTTED';
    $('heat-level').textContent = level;
  }

  updateRank() {
    const r = this.game.rank, p = r.progress();
    $('rank-num').textContent = `RANK ${r.rank}`;
    $('rank-title').textContent = r.title.toUpperCase();
    $('rank-rp').textContent = `${p.have.toLocaleString('en-US')} / ${p.need.toLocaleString('en-US')} RP`;
    $('rank-fill').style.width = `${Math.round(p.frac * 100)}%`;
    $('rp-feed').innerHTML = r.feed.map((f) => `<div style="opacity:${Math.min(1, f.t)}">${esc(f.text)}</div>`).join('');
  }

  updateCrew() {
    const crew = this.game.crew;
    for (const c of this.crewRows) {
      const left = crew.cooldowns[c.member.id];
      const active = c.member.id === 'eyes' && crew.eyesOut;
      c.row.classList.toggle('ready', left <= 0);
      c.row.classList.toggle('active', active);
      c.state.textContent = active ? `LIVE ${Math.ceil(crew.eyesOutT)}s` : left > 0 ? `${Math.ceil(left)}s` : 'READY';
      c.fill.style.width = `${Math.round((1 - crew.charge(c.member)) * 100)}%`;
    }
  }

  updateMission() {
    const game = this.game, d = game.missions, info = d.stageInfo();
    const stage = $('stage-row'), next = $('next-line');
    if (info) {
      $('mission-num').textContent = `MISSION ${info.num}`;
      $('mission-title').textContent = info.title;
      $('stage-label').textContent = `STAGE ${info.stage}/${info.stages}`;
      $('stage-fill').style.width = `${Math.round((info.stage - 1 + info.within) / info.stages * 100)}%`;
      stage.style.display = 'flex';
      next.innerHTML = info.next ? `<b>NEXT</b> ${esc(info.next)}` : '<b>NEXT</b> Get paid';
    } else {
      stage.style.display = 'none';
      const job = d.next;
      $('mission-num').textContent = job ? 'FREE ROAM' : 'SALTLINE BAY';
      $('mission-title').textContent = job ? `JOB ${d.index + 1}/${game.missions.total}` : 'ALL JOBS DONE';
      if (job) {
        const giver = CAST[job.giver];
        game.hud.el['objective-text'].textContent = game.wanted.level ? 'Lose the heat' : `Meet ${giver.name.split(' ')[0].replace(/'/g, '')} for “${job.title}”`;
        next.innerHTML = `<b>AT</b> ${esc(LOCATIONS[job.start].label)}`;
      } else next.innerHTML = '';
    }
  }

  updateVehicle() {
    const game = this.game, v = game.player.vehicle;
    if (!v) return;
    const dmg = Math.round(100 - Math.max(0, v.health));
    $('vehicle-dmg').textContent = `DMG ${dmg}%`;
    $('vehicle-dmg').style.color = dmg > 55 ? '#ff6b5a' : dmg > 25 ? '#ffd166' : '#7dffa8';
    $('dmg-fill').style.width = `${Math.max(0, v.health)}%`;
    const st = game.audio?.station ?? 0;
    $('radio-name').textContent = RADIO_STATIONS[st];
    const songs = RADIO_SONGS[st];
    $('radio-song').textContent = songs.length ? `♪ ${songs[Math.floor(game.time / 140) % songs.length]}` : '';
  }
}
