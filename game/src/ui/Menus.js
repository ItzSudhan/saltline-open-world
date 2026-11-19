// Title screen (New Game / Continue / Controls) and the pause menu with the full city map,
// story progress and stats.
import { hasSave } from '../save/SaveGame.js';
import { MISSIONS, CAST } from '../story/StoryScript.js';
import { CREW } from '../crew/CrewAbilities.js';
import { STASH_SPOTS } from '../world/Pickups.js';

const $ = (id) => document.getElementById(id);

export class Menus {
  constructor(game) {
    this.game = game;
    this.title = $('title-screen');
    this.pause = $('pause-screen');
    $('title-menu').addEventListener('click', (e) => {
      const a = e.target.dataset?.action;
      game.audio.unlock();
      if (a === 'new') game.newGame();
      if (a === 'continue') game.continueGame();
      if (a === 'controls') $('controls-help').classList.toggle('hidden');
    });
    $('pause-menu').addEventListener('click', (e) => {
      const a = e.target.dataset?.action;
      if (a === 'resume') game.resume();
      if (a === 'save') game.saveNow();
      if (a === 'title') game.quitToTitle();
    });
  }

  showTitle(on) {
    this.title.classList.toggle('hidden', !on);
    $('continue-btn').disabled = !hasSave();
    $('title-menu').querySelector('button').classList.toggle('focus', on);
  }

  showPause(on, heading = 'PAUSED') {
    this.pause.classList.toggle('hidden', !on);
    if (!on) return;
    $('pause-heading').textContent = heading;
    const game = this.game, s = game.stats, done = game.missions.index;
    // Story jobs: done, current (next to start or in progress) and locked, with giver and pay.
    $('job-list').innerHTML = MISSIONS.map((m, i) => {
      const state = i < done ? 'done' : i === done ? 'now' : 'locked';
      const tag = { done: 'DONE', now: game.missions.active ? 'ACTIVE' : 'NEXT', locked: 'LOCKED' }[state];
      return `<div class="job ${state}"><span class="tag">${tag}</span>${m.title}<span class="who">${CAST[m.giver].name}</span><span class="pay">$${m.reward.toLocaleString('en-US')}</span></div>`;
    }).join('');
    const tile = (c, label, value, sub) => `<div class="tile" style="--c:${c}"><small>${label}</small><b>${value}</b><em>${sub}</em></div>`;
    $('stat-tiles').innerHTML = [
      tile('#7dffa8', 'CASH', `$${game.money.toLocaleString('en-US')}`, `${s.cars} cars stolen`),
      tile('#c9b8ff', 'RANK', `${game.rank.rank} · ${game.rank.title}`, `${game.rank.rp.toLocaleString('en-US')} RP`),
      tile('#ffd166', 'STORY', `${done}/${MISSIONS.length}`, 'jobs done'),
      tile('#ff6b5a', 'HEAT', `${game.wanted.level}/5`, `${s.cops} cops dropped`),
    ].join('');
    $('stats').innerHTML = [
      `Crew <b>${CREW.map((c) => c.name.split(' ')[0]).join(' · ')}</b> &middot; Salt Stashes <b>${game.pickups.stashFound.size}/${STASH_SPOTS.length}</b>`,
      `Arsenal <b>${[...game.weapons.owned].map((w) => w.toUpperCase()).join(' · ')}</b>`,
      `Sunbreak Sprint <b>${game.race.best ? `${game.race.best.toFixed(1)}s` : 'not raced'}</b> &middot; Near-miss cash <b>$${game.nearMiss.total.toLocaleString('en-US')}</b>`,
    ].join('<br>');
    $('legend').innerHTML = [
      ['#ffd166', 'Objective'], ['#19d3c5', 'Salt Stash'], ['#ffb347', "Tide's Garage (repair, cool heat)"],
      ['#ffffff', 'Safehouse (save)'], ['#9be08f', 'Ironleaf Arms (resupply)'], ['#ff6b5a', 'Sunbreak Sprint street race'], ['#ff2a4a', 'SBPD pursuit'],
    ].map(([c, t]) => `<span class="dot" style="background:${c}"></span>${t}`).join('<br>');
    game.minimap.drawBig();
  }
}
