// Canvas-painted textures: asphalt with lane markings, stucco and glass facades, signs, sand.
import * as THREE from 'three';
import { CELL, ROAD_HALF } from './CityLayout.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function speckle(ctx, w, h, n, colors, rand) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
  }
}

// One city cell (80 m) of road: road centre lines lie on the texture's edges, so it tiles.
export function makeRoadTexture(rand) {
  const S = 1024, k = S / CELL;
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#353a45';
  ctx.fillRect(0, 0, S, S);
  speckle(ctx, S, S, 26000, ['#2f333d', '#41454f', '#3b3f49', '#2a2d35'], rand);
  // Wrapped rectangle helper: draws at every tile offset so markings cross edges cleanly.
  const rect = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) ctx.fillRect(x + ox, y + oy, w, h);
  };
  const m = (v) => v * k;
  // Tyre wear along lanes.
  for (const lane of [-3.8, 3.8]) {
    rect(m(lane - 1.2), 0, m(2.4), S, 'rgba(20,20,24,0.18)');
    rect(0, m(lane - 1.2), S, m(2.4), 'rgba(20,20,24,0.18)');
  }
  // Double yellow centre lines, dashed white edge lines, outside the intersection.
  for (let p = m(ROAD_HALF + 1); p < S - m(ROAD_HALF + 1); p += m(1)) {
    rect(m(-0.35), p, m(0.22), m(1.02), '#e8c547');
    rect(m(0.13), p, m(0.22), m(1.02), '#e8c547');
    rect(p, m(-0.35), m(1.02), m(0.22), '#e8c547');
    rect(p, m(0.13), m(1.02), m(0.22), '#e8c547');
  }
  for (let p = m(ROAD_HALF + 1); p < S - m(ROAD_HALF + 1); p += m(6)) {
    for (const e of [-7.2, 7.0]) {
      rect(m(e), p, m(0.2), m(3), '#e6e6e6');
      rect(p, m(e), m(3), m(0.2), '#e6e6e6');
    }
  }
  // Zebra crossings on every approach.
  for (let s = -6.5; s < 6.5; s += 1.3) {
    for (const d of [ROAD_HALF + 0.6, -ROAD_HALF - 3.6]) {
      rect(m(s), m(d), m(0.7), m(3), '#f1f1f1');
      rect(m(d), m(s), m(3), m(0.7), '#f1f1f1');
    }
    // stop lines
  }
  return toTexture(c);
}

// A 4 m wide by 3.5 m tall bay of a stucco building: one window with a frame and a sill.
export function makeFacadeTexture(rand) {
  const [c, ctx] = canvas(128, 112);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 112);
  speckle(ctx, 128, 112, 900, ['#f1f1f1', '#e9e9e9', '#fafafa'], rand);
  ctx.fillStyle = '#d9d9d9';
  ctx.fillRect(22, 18, 84, 66);
  const g = ctx.createLinearGradient(0, 22, 0, 80);
  g.addColorStop(0, '#2e4f6e'); g.addColorStop(0.5, '#4d7fa3'); g.addColorStop(1, '#22384f');
  ctx.fillStyle = g;
  ctx.fillRect(27, 22, 74, 58);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.moveTo(27, 60); ctx.lineTo(70, 22); ctx.lineTo(84, 22); ctx.lineTo(27, 72); ctx.fill();
  ctx.fillStyle = '#d0d0d0';
  ctx.fillRect(62, 22, 4, 58);
  ctx.fillStyle = '#bdbdbd';
  ctx.fillRect(18, 84, 92, 6);
  return toTexture(c);
}

// Curtain-wall glass for downtown towers: reflective panes with mullions and floor bands.
export function makeGlassTexture(rand) {
  const [c, ctx] = canvas(128, 112);
  const g = ctx.createLinearGradient(0, 0, 128, 112);
  g.addColorStop(0, '#9fd8f0'); g.addColorStop(0.5, '#4f8fb8'); g.addColorStop(1, '#7cc2e0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 112);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.05 + rand() * 0.12})`;
    ctx.fillRect(i * 32, 0, 32, 112);
  }
  ctx.fillStyle = '#d7e3ea';
  ctx.fillRect(0, 0, 128, 10);
  for (let i = 0; i <= 4; i++) ctx.fillRect(i * 32 - 1, 0, 3, 112);
  return toTexture(c);
}

// A street-level shopfront bay: a coloured fascia over a big display window and a door.
export function makeShopTexture(fascia, rand) {
  const [c, ctx] = canvas(128, 112);
  ctx.fillStyle = '#e9e4da';
  ctx.fillRect(0, 0, 128, 112);
  ctx.fillStyle = fascia;
  ctx.fillRect(0, 6, 128, 22);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 5; i++) ctx.fillRect(14 + i * 20 + rand() * 4, 13, 10 + rand() * 6, 7);
  const g = ctx.createLinearGradient(0, 30, 0, 112);
  g.addColorStop(0, '#5f86a0'); g.addColorStop(0.6, '#2a4256'); g.addColorStop(1, '#1d2b38');
  ctx.fillStyle = g;
  ctx.fillRect(8, 34, 76, 72);
  ctx.fillStyle = '#20262e';
  ctx.fillRect(92, 40, 28, 72);
  ctx.fillStyle = 'rgba(255,240,200,0.35)';
  ctx.fillRect(12, 70, 68, 30);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath(); ctx.moveTo(8, 80); ctx.lineTo(50, 34); ctx.lineTo(62, 34); ctx.lineTo(8, 94); ctx.fill();
  return toTexture(c);
}

// A building sign: name text on a coloured panel.
export function makeSignTexture(text, bg, fg = '#ffffff') {
  const [c, ctx] = canvas(1024, 160);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 160);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 1004, 140);
  ctx.fillStyle = fg;
  ctx.font = 'italic 900 92px "Avenir Next", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 512, 84, 960);
  return toTexture(c, false);
}

export function makeSandTexture(rand) {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#e9cf98';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 9000, ['#f3dcaa', '#dcbf86', '#e2c48c', '#f7e4ba'], rand);
  return toTexture(c);
}

export function makeConcreteTexture(rand) {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#cfc9bd';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 5000, ['#c4beb2', '#d8d2c6', '#bdb7ab'], rand);
  ctx.fillStyle = '#b3ada1';
  for (let i = 0; i <= 256; i += 64) { ctx.fillRect(i, 0, 2, 256); ctx.fillRect(0, i, 256, 2); }
  return toTexture(c);
}

// A soft round puff used for smoke, dust and glows.
export function makePuffTexture() {
  const [c, ctx] = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
