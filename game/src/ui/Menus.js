// Title screen (New Game / Continue / Controls) and the pause menu with the full city map,
// story progress and stats.
import { hasSave } from '../save/SaveGame.js';
import { MISSIONS } from '../story/StoryScript.js';
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
    const game = this.game, s = game.stats;
    const next = MISSIONS[game.missions.index];
    $('stats').innerHTML = [
      `Story <b>${game.missions.index}/${MISSIONS.length}</b> jobs done`,
      next ? `Next job <b>${next.title}</b>` : '<b>Story complete</b>: Saltline Bay is yours',
      `Cash <b>$${game.money.toLocaleString('en-US')}</b>`,
      `Salt Stashes <b>${game.pickups.stashFound.size}/${STASH_SPOTS.length}</b>`,
      `Cars stolen <b>${s.cars}</b> &middot; Cops dropped <b>${s.cops}</b>`,
      `Arsenal <b>${[...game.weapons.owned].map((w) => w.toUpperCase()).join(' · ')}</b>`,
    ].join('<br>');
    $('legend').innerHTML = [
      ['#ffd166', 'Objective'], ['#19d3c5', 'Salt Stash'], ['#ffb347', "Tide's Garage (repair, cool heat)"],
      ['#ffffff', 'Safehouse (save)'], ['#9be08f', 'Ironleaf Arms (resupply)'], ['#ff2a4a', 'SBPD pursuit'],
    ].map(([c, t]) => `<span class="dot" style="background:${c}"></span>${t}`).join('<br>');
    game.minimap.drawBig();
  }
}
