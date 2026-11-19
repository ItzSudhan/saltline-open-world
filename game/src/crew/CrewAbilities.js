// Rae's crew: three specialists on the phone, each with one ability on a hotkey and a cooldown.
//   Z  Juno Reyes, driver     SWAP PLATES  new plates on the car: HEAT drops by one level
//   X  Dex Marlow, mechanic   QUICK FIX    talks Rae through a patch-up: the car is repaired
//   C  Pip Alvarez, lookout   EYES OUT     scanner feed: every SBPD unit shows on the minimap

export const CREW = [
  {
    id: 'plates', key: 'KeyZ', keyLabel: 'Z', name: 'Juno Reyes', role: 'Driver', ability: 'SWAP PLATES', cooldown: 75,
    look: { skin: '#a8714f', hair: '#2a1712', style: 'bun', shirt: '#ff6b5a', bg: '#4a1d33', earring: '#ffd166', smile: true },
  },
  {
    id: 'fix', key: 'KeyX', keyLabel: 'X', name: 'Dex Marlow', role: 'Mechanic', ability: 'QUICK FIX', cooldown: 50,
    look: { skin: '#e2b08c', hair: '#6b4a2e', style: 'buzz', shirt: '#3f5f7a', collar: '#ffb347', bg: '#203a2a', beard: '#6b4a2e', cap: '#ffb347' },
  },
  {
    id: 'eyes', key: 'KeyC', keyLabel: 'C', name: 'Pip Alvarez', role: 'Lookout', ability: 'EYES OUT', cooldown: 60, duration: 22,
    look: { skin: '#7a4b31', hair: '#120c0a', style: 'curly', shirt: '#19d3c5', bg: '#14304a', glasses: '#e8e8e8', headset: true },
  },
];

export class CrewAbilities {
  constructor(game) {
    this.game = game;
    this.cooldowns = { plates: 0, fix: 0, eyes: 0 };
    this.eyesOutT = 0;
  }

  get eyesOut() { return this.eyesOutT > 0; }

  // 0 = ready, otherwise the fraction of the cooldown still to wait.
  charge(member) { return this.cooldowns[member.id] / member.cooldown; }

  update(dt) {
    const game = this.game;
    for (const k in this.cooldowns) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    this.eyesOutT = Math.max(0, this.eyesOutT - dt);
    if (game.state !== 'playing' || game.player.dead) return;
    for (const m of CREW) if (game.input.wasPressed(m.key)) this.use(m);
  }

  use(member) {
    const game = this.game;
    if (this.cooldowns[member.id] > 0) { game.hud.toast(`${member.name}: give me ${Math.ceil(this.cooldowns[member.id])}s`); return false; }
    const fail = this.apply(member);
    const say = (text) => game.hud.sayNow([{ who: { name: member.name, role: `${member.role} · crew`, look: member.look, color: member.look.bg }, text }]);
    if (fail) { say(fail); return false; }
    this.cooldowns[member.id] = member.cooldown;
    game.audio?.pickup();
    return true;
  }

  // Performs the ability; returns a reason string when it can't be used right now.
  apply(member) {
    const game = this.game, v = game.player.vehicle;
    if (member.id === 'plates') {
      if (!v) return 'Plates go on a car, Rae. Get some wheels first.';
      if (game.wanted.level === 0) return 'Nobody is looking for those plates. Save it.';
      const lvl = game.wanted.level;
      game.wanted.setLevel(lvl - 1);
      game.hud.toast(`Plates swapped · HEAT ${lvl} → ${lvl - 1}`);
      return null;
    }
    if (member.id === 'fix') {
      if (!v) return 'Nothing to fix. You are on foot.';
      if (v.wrecked) return 'That one is scrap. Find another ride.';
      if (v.health >= 99 && !v.flat) return 'She is running fine. Call me when it smokes.';
      v.health = 100;
      game.hud.toast(`${v.type.name} patched up${v.flat ? ' · new tyres' : ''} · 0% damage`);
      v.flat = false;
      return null;
    }
    if (member.id === 'eyes') {
      this.eyesOutT = member.duration;
      game.hud.toast(`Scanner feed live for ${member.duration}s`);
      return null;
    }
    return 'Unknown ability';
  }
}
