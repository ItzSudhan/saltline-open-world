// The SBPD response as a list of named units: every pursuit cruiser, roadblock cruiser, officer on
// foot and the air unit gets a callsign, its current behaviour (set by the system driving it) and
// a live distance to the player. The HUD's response panel and the minimap read this.

const CAR_NAMES = ['GULL', 'REEF', 'SHOAL', 'MARLIN', 'HERON', 'SKIFF', 'DUNE', 'PIKE'];

export const BEHAVIOUR_COLORS = {
  RAMMING: '#ff4d3d', FLANKING: '#ffb347', PURSUING: '#ffd166', RESPONDING: '#9fb4c7', ROADBLOCK: '#ff6bd0',
  SPOTLIGHT: '#fff3b0', SEARCHING: '#9fb4c7', 'ON FOOT': '#7dd3ff', ENGAGING: '#ff4d3d', ARRESTING: '#ff4d3d', 'EN ROUTE': '#9fb4c7',
};

export class PoliceRoster {
  constructor(game) {
    this.game = game;
    this.units = [];
    this.names = new WeakMap();
    this.serial = 11;
  }

  callsign(obj, kind) {
    if (!this.names.has(obj)) {
      this.serial = (this.serial + 37) % 89 + 10;
      this.issued = (this.issued || 0) + 1;
      const base = kind === 'foot' ? 'UNIT' : CAR_NAMES[this.issued % CAR_NAMES.length];
      this.names.set(obj, `${base}-${this.serial}`);
    }
    return this.names.get(obj);
  }

  // "CODE n": how hard dispatch is leaning on the response, from the heat level.
  get code() { return Math.min(4, this.game.wanted.level); }

  update() {
    const game = this.game, p = game.player.position, out = [];
    const dist = (x, z) => Math.hypot(x - p.x, z - p.z);
    const heli = game.wanted.heli;
    if (heli.active && !heli.leaving) out.push({ callsign: heli.callsign, kind: 'air', state: heli.tracking ? 'SPOTLIGHT' : 'SEARCHING', d: heli.distance, x: heli.x, z: heli.z });
    for (const v of game.wanted.cars) {
      if (v.wrecked) continue;
      out.push({ callsign: this.callsign(v, 'car'), kind: 'car', state: v.police?.state || 'RESPONDING', d: dist(v.x, v.z), x: v.x, z: v.z });
    }
    for (const v of game.wanted.roadblocks.cars) {
      if (v.wrecked) continue;
      out.push({ callsign: this.callsign(v, 'car'), kind: 'block', state: 'ROADBLOCK', d: dist(v.x, v.z), x: v.x, z: v.z });
    }
    for (const u of game.hostiles.alive()) {
      if (u.team !== 'police') continue;
      const d = dist(u.x, u.z);
      out.push({ callsign: this.callsign(u, 'foot'), kind: 'foot', state: d < 3 ? 'ARRESTING' : d < 40 ? 'ENGAGING' : 'ON FOOT', d, x: u.x, z: u.z });
    }
    out.sort((a, b) => a.d - b.d);
    this.units = out;
  }
}
