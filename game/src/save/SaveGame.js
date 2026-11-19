// Save slots in localStorage: story progress, money, rank RP, weapons, armour, stashes found, position.
const KEY = 'saltline.save.v1';

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function writeSave(game) {
  const pl = game.player, p = pl.position;
  const data = {
    version: 1,
    savedAt: Date.now(),
    mission: game.missions.index,
    money: game.money,
    health: pl.health,
    armor: pl.armor,
    weapons: [...game.weapons.owned],
    ammo: { pistol: game.weapons.ammo.pistol, smg: game.weapons.ammo.smg, shotgun: game.weapons.ammo.shotgun, rifle: game.weapons.ammo.rifle },
    rp: game.rank.rp,
    stashes: [...game.pickups.stashFound],
    stats: game.stats,
    raceBest: game.race.best,
    hour: game.sky.hour,
    pos: { x: p.x, z: p.z },
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}

export function readSave() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export function applySave(game, data) {
  if (!data) return;
  game.missions.index = data.mission || 0;
  game.money = data.money || 0;
  game.player.health = data.health || 100;
  game.player.armor = data.armor || 0;
  for (const w of data.weapons || []) game.weapons.owned.add(w);
  Object.assign(game.weapons.ammo, data.ammo || {});
  for (const i of data.stashes || []) game.pickups.stashFound.add(i);
  Object.assign(game.stats, data.stats || {});
  game.race.best = data.raceBest ?? null;
  game.rank.rp = data.rp || 0;
  game.weapons.unlockForRank(game.rank.rank);
  if (data.hour) game.sky.setHour(data.hour);
  if (data.pos) game.player.place(data.pos.x, data.pos.z);
}
