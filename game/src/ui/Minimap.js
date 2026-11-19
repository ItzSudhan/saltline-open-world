// Paints Saltline Bay's map once (roads, blocks, beach, ocean, landmarks, districts), then draws
// it as the rotating round minimap and the full pause-menu map, with blips on top.
import { GRID, HALF, ROAD_HALF, SHORE_X, LANDMARKS, roadCoord, blockCenter, DISTRICTS, ROAD_NAMES_Z } from '../world/CityLayout.js';

const MIN = -380, MAX = 500, SIZE = 1024;
const S = SIZE / (MAX - MIN);
const toMap = (v) => (v - MIN) * S;

export function paintCityMap(footprints) {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  g.fillStyle = '#c7b78f';
  g.fillRect(0, 0, SIZE, SIZE);
  // Ocean and beach.
  g.fillStyle = '#e9d39a';
  g.fillRect(toMap(HALF + ROAD_HALF), 0, SIZE, SIZE);
  g.fillStyle = '#2a8fb0';
  g.fillRect(toMap(SHORE_X), 0, SIZE, SIZE);
  g.fillStyle = '#56c3d0';
  g.fillRect(toMap(SHORE_X), 0, 10, SIZE);
  // City base and roads.
  g.fillStyle = '#566173';
  g.fillRect(toMap(-HALF - ROAD_HALF), toMap(-HALF - ROAD_HALF), (2 * HALF + 2 * ROAD_HALF) * S, (2 * HALF + 2 * ROAD_HALF) * S);
  for (let bi = 0; bi < GRID; bi++) for (let bj = 0; bj < GRID; bj++) {
    const x0 = roadCoord(bi) + ROAD_HALF, z0 = roadCoord(bj) + ROAD_HALF;
    g.fillStyle = '#2b3445';
    g.fillRect(toMap(x0), toMap(z0), (80 - 2 * ROAD_HALF) * S, (80 - 2 * ROAD_HALF) * S);
  }
  for (const f of footprints) {
    g.fillStyle = f.h === 0 ? '#5aa457' : f.color === '#f0c27a' ? '#e39b4c' : f.h > 30 ? '#45607d' : '#3b4a60';
    g.fillRect(toMap(f.minX), toMap(f.minZ), (f.maxX - f.minX) * S, (f.maxZ - f.minZ) * S);
  }
  // Pier.
  g.fillStyle = '#9b7653';
  g.fillRect(toMap(SHORE_X - 10), toMap(115.5), 150 * S, 9 * S);
  return c;
}

export class Minimap {
  constructor(game, footprints) {
    this.game = game;
    this.map = paintCityMap(footprints);
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    this.big = document.getElementById('bigmap');
    this.t = 0;
  }

  collectBlips() {
    const game = this.game, out = [];
    const flash = Math.floor(this.t * 4) % 2 === 0;
    // SBPD units: only those close enough to hear, unless Pip's scanner feed (Eyes Out) is live,
    // which shows every cruiser, roadblock and the air unit, pinned to the rim when off the map.
    const eyes = game.crew.eyesOut, p = game.player.position;
    const near = (x, z) => eyes || Math.hypot(x - p.x, z - p.z) < 70;
    const kind = eyes ? 'police' : null;
    for (const v of game.wanted.cars) if (!v.wrecked && near(v.x, v.z)) out.push({ x: v.x, z: v.z, color: flash ? '#ff2a4a' : '#3a7bff', size: 5, kind });
    for (const v of game.wanted.roadblocks.cars) if (near(v.x, v.z)) out.push({ x: v.x, z: v.z, color: '#ff6bd0', size: 5, label: '‖', kind });
    const heli = game.wanted.heli;
    if (heli.active && !heli.leaving && near(heli.x, heli.z)) out.push({ x: heli.x, z: heli.z, color: '#fff3b0', size: 6, label: 'H', kind });
    for (const u of game.hostiles.units) if (!u.dead) out.push({ x: u.x, z: u.z, color: u.team === 'police' ? '#6ab7ff' : '#ff4d3d', size: 3.5 });
    for (const it of game.pickups.items) if (it.kind === 'stash') out.push({ x: it.x, z: it.z, color: '#19d3c5', size: 3, faint: true });
    out.push({ x: LANDMARKS_POS.gunshop.x, z: LANDMARKS_POS.gunshop.z, color: '#9be08f', size: 4.5, label: '$' });
    out.push({ x: LANDMARKS_POS.safehouse.x, z: LANDMARKS_POS.safehouse.z, color: '#ffffff', size: 4.5, label: 'S' });
    out.push({ x: LANDMARKS_POS.garage.x, z: LANDMARKS_POS.garage.z, color: '#ffb347', size: 4.5, label: 'G' });
    out.push(...game.missions.blips());
    out.push(...game.race.blips());
    return out;
  }

  draw(dt) {
    this.t += dt;
    const game = this.game, g = this.ctx, W = this.canvas.width, R = W / 2;
    const pl = game.player, p = pl.position;
    const zoom = pl.vehicle ? 1.15 : 1.75; // canvas px per map px
    const yaw = game.camera.yaw;
    const rot = -Math.PI / 2 - Math.atan2(Math.cos(yaw), Math.sin(yaw));
    g.save();
    g.clearRect(0, 0, W, W);
    g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#c7b78f'; g.fillRect(0, 0, W, W);
    g.translate(R, R);
    g.rotate(rot);
    g.scale(zoom, zoom);
    g.translate(-toMap(p.x), -toMap(p.z));
    g.drawImage(this.map, 0, 0);
    g.restore();
    // Blips (kept upright), clamped to the rim when off-map.
    const cos = Math.cos(rot), sin = Math.sin(rot);
    for (const b of this.collectBlips()) {
      const mx = (toMap(b.x) - toMap(p.x)) * zoom, mz = (toMap(b.z) - toMap(p.z)) * zoom;
      let sx = mx * cos - mz * sin, sy = mx * sin + mz * cos;
      const d = Math.hypot(sx, sy);
      if (d > R - 10) {
        if (b.kind !== 'objective' && b.kind !== 'contact' && b.kind !== 'police') continue;
        sx *= (R - 10) / d; sy *= (R - 10) / d;
      }
      this.blip(g, R + sx, R + sy, b);
    }
    // The player arrow.
    const ph = pl.vehicle ? pl.vehicle.heading : pl.heading;
    const a = rot + Math.atan2(Math.cos(ph), Math.sin(ph));
    g.save();
    g.translate(R, R); g.rotate(a);
    g.fillStyle = '#ffffff'; g.strokeStyle = '#10131c'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(9, 0); g.lineTo(-7, -6); g.lineTo(-4, 0); g.lineTo(-7, 6); g.closePath();
    g.fill(); g.stroke();
    g.restore();
    // Eyes Out: a pulsing scanner ring around the rim.
    if (game.crew.eyesOut) {
      g.strokeStyle = `rgba(25, 211, 197, ${0.55 + Math.sin(this.t * 6) * 0.35})`; g.lineWidth = 6;
      g.beginPath(); g.arc(R, R, R - 3, 0, Math.PI * 2); g.stroke();
      const sweep = this.t * 2.5;
      g.fillStyle = 'rgba(25, 211, 197, .16)';
      g.beginPath(); g.moveTo(R, R); g.arc(R, R, R, sweep, sweep + 0.6); g.closePath(); g.fill();
    }
    // North marker.
    const nx = R + Math.sin(-rot) * 0 + (R - 12) * Math.cos(rot - Math.PI / 2), ny = R + (R - 12) * Math.sin(rot - Math.PI / 2);
    g.fillStyle = '#10131c'; g.beginPath(); g.arc(nx, ny, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', nx, ny + 1);
  }

  blip(g, x, y, b) {
    g.fillStyle = b.color;
    g.strokeStyle = '#10131c';
    g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, b.size + (b.label ? 3 : 0), 0, Math.PI * 2); g.fill(); g.stroke();
    if (b.label) {
      g.fillStyle = '#10131c'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(b.label, x, y + 1);
    }
  }

  // Full map for the pause menu.
  drawBig() {
    const game = this.game, g = this.big.getContext('2d'), W = this.big.width;
    const k = W / SIZE;
    g.drawImage(this.map, 0, 0, W, W);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const labels = [['Coral Heights', 1, 1], ['Pelican Point', 5, 0.5], ['Halcyon Downtown', 3.5, 3.6], ['Mangrove Flats', 1, 5.5], ['Marina Row', 6, 4.5], ['Palmetto Yards', 3.5, 6.5]];
    g.font = 'italic 900 22px "Avenir Next", Arial, sans-serif';
    for (const [name, bi, bj] of labels) {
      const c = blockCenter(bi, bj);
      g.lineWidth = 5; g.strokeStyle = 'rgba(10,14,30,.85)'; g.strokeText(name.toUpperCase(), toMap(c.x) * k, toMap(c.z) * k);
      g.fillStyle = DISTRICTS.find((d) => d.name === name).color; g.fillText(name.toUpperCase(), toMap(c.x) * k, toMap(c.z) * k);
    }
    g.save(); g.translate(toMap(395) * k, toMap(0) * k); g.rotate(-Math.PI / 2);
    g.strokeText('SUNBREAK BEACH', 0, 0); g.fillStyle = '#f5d38a'; g.fillText('SUNBREAK BEACH', 0, 0); g.restore();
    g.font = '600 13px "Avenir Next", Arial, sans-serif'; g.fillStyle = 'rgba(255,255,255,.7)';
    g.fillText(ROAD_NAMES_Z[2].toUpperCase(), toMap(-40) * k, toMap(roadCoord(2)) * k - 1);
    for (const b of this.collectBlips()) this.blip(g, toMap(b.x) * k, toMap(b.z) * k, { ...b, size: b.size + 1 });
    const p = game.player.position;
    this.blip(g, toMap(p.x) * k, toMap(p.z) * k, { color: '#ffffff', size: 7, label: '▲' });
  }
}

const LANDMARKS_POS = {};
for (const [key, lm] of Object.entries(LANDMARKS)) {
  const [bi, bj] = key.split(',').map(Number);
  const c = blockCenter(bi, bj);
  LANDMARKS_POS[lm.id] = { x: c.x, z: c.z + 12 };
}
