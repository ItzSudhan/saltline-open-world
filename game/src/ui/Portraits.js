// Small painted faces for the dialogue box and the crew panel: every character has a "look"
// (skin, hair style and colour, shirt, extras like glasses, a beard, a cap or a headset) that is
// drawn onto a canvas with plain 2D paths. No image files.

const cache = new Map();

function ellipse(g, x, y, rx, ry, fill) {
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// Paints `look` into a square canvas of `size` px and returns it (cached per look + size).
export function portraitCanvas(look, size = 96) {
  const key = JSON.stringify(look) + size;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.scale(size / 100, size / 100);
  drawFace(g, look);
  cache.set(key, c);
  return c;
}

// Copies a painted portrait into an existing canvas element.
export function paintInto(canvas, look) {
  const src = portraitCanvas(look, canvas.width);
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.drawImage(src, 0, 0);
}

function drawFace(g, L) {
  const skin = L.skin || '#c98d66', hair = L.hair || '#1d1612', bg = L.bg || '#1b3550';
  // Backdrop: a two-tone disc with a sunset rim.
  const grad = g.createLinearGradient(0, 0, 0, 100);
  grad.addColorStop(0, shade(bg, 1.35)); grad.addColorStop(1, shade(bg, 0.7));
  g.fillStyle = grad; g.fillRect(0, 0, 100, 100);
  g.fillStyle = 'rgba(255,255,255,.08)';
  g.beginPath(); g.arc(78, 18, 30, 0, Math.PI * 2); g.fill();
  // Shoulders and shirt.
  g.fillStyle = L.shirt || '#2b4c6f';
  g.beginPath(); g.moveTo(8, 100); g.quadraticCurveTo(12, 72, 50, 70); g.quadraticCurveTo(88, 72, 92, 100); g.fill();
  if (L.collar) { g.fillStyle = L.collar; g.beginPath(); g.moveTo(40, 72); g.lineTo(50, 86); g.lineTo(60, 72); g.fill(); }
  // Long hair falls behind the neck.
  if (L.style === 'long') { g.fillStyle = hair; g.beginPath(); g.moveTo(26, 40); g.quadraticCurveTo(22, 78, 30, 84); g.lineTo(70, 84); g.quadraticCurveTo(78, 78, 74, 40); g.fill(); }
  // Neck, ears, head.
  g.fillStyle = shade(skin, 0.85); g.fillRect(42, 58, 16, 16);
  ellipse(g, 29, 46, 4.5, 7, shade(skin, 0.92));
  ellipse(g, 71, 46, 4.5, 7, shade(skin, 0.92));
  ellipse(g, 50, 44, 21, 25, skin);
  // Cheek shadow on one side for volume.
  g.fillStyle = 'rgba(0,0,0,.10)'; g.beginPath(); g.ellipse(60, 48, 10, 19, 0, -Math.PI / 2, Math.PI / 2); g.fill();
  // Hair on top.
  g.fillStyle = hair;
  if (L.style === 'bald') { g.fillStyle = 'rgba(255,255,255,.18)'; ellipse(g, 44, 26, 8, 4, 'rgba(255,255,255,.18)'); }
  else if (L.style === 'buzz') { g.beginPath(); g.ellipse(50, 30, 21, 13, 0, Math.PI, 0); g.fill(); }
  else if (L.style === 'bun') {
    g.beginPath(); g.ellipse(50, 31, 22, 15, 0, Math.PI, 0); g.fill();
    ellipse(g, 50, 13, 9, 8, hair);
  } else if (L.style === 'curly') {
    for (let i = 0; i < 9; i++) ellipse(g, 30 + i * 5, 24 + Math.abs(4 - i) * 1.6, 7, 7, hair);
  } else {
    g.beginPath(); g.moveTo(28, 40); g.quadraticCurveTo(28, 16, 50, 17); g.quadraticCurveTo(74, 16, 73, 40);
    g.quadraticCurveTo(64, 26, 46, 29); g.quadraticCurveTo(34, 30, 28, 40); g.fill();
  }
  // Eyes, brows, nose, mouth.
  const eyeY = 45;
  ellipse(g, 42, eyeY, 3.4, 2.4, '#ffffff'); ellipse(g, 58, eyeY, 3.4, 2.4, '#ffffff');
  ellipse(g, 42.6, eyeY, 1.7, 1.9, L.eyes || '#2a1a10'); ellipse(g, 58.6, eyeY, 1.7, 1.9, L.eyes || '#2a1a10');
  g.strokeStyle = shade(hair === '#f2f2f2' ? '#8a8a8a' : hair, 1); g.lineWidth = 2.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(37, 39 - (L.stern ? 0 : 1)); g.lineTo(47, 39 + (L.stern ? 1.5 : 0)); g.stroke();
  g.beginPath(); g.moveTo(53, 39 + (L.stern ? 1.5 : 0)); g.lineTo(63, 39 - (L.stern ? 0 : 1)); g.stroke();
  g.strokeStyle = shade(skin, 0.7); g.lineWidth = 1.8;
  g.beginPath(); g.moveTo(50, 46); g.lineTo(48, 54); g.lineTo(52, 55); g.stroke();
  g.strokeStyle = L.lips || shade(skin, 0.55); g.lineWidth = 2.4;
  g.beginPath();
  if (L.smile) { g.moveTo(43, 60); g.quadraticCurveTo(50, 65, 57, 60); } else { g.moveTo(44, 61); g.lineTo(56, 61); }
  g.stroke();
  // Extras.
  if (L.beard) {
    g.fillStyle = L.beard; g.globalAlpha = 0.9;
    g.beginPath(); g.moveTo(30, 48); g.quadraticCurveTo(32, 72, 50, 70); g.quadraticCurveTo(68, 72, 70, 48);
    g.quadraticCurveTo(66, 58, 58, 58); g.quadraticCurveTo(50, 56, 42, 58); g.quadraticCurveTo(34, 58, 30, 48); g.fill();
    g.globalAlpha = 1;
  }
  if (L.glasses) {
    g.strokeStyle = L.glasses; g.lineWidth = 2;
    g.fillStyle = L.shades ? 'rgba(10,10,14,.85)' : 'rgba(200,230,255,.18)';
    for (const x of [42, 58]) { g.beginPath(); g.roundRect(x - 6.5, eyeY - 4.5, 13, 9, 3); g.fill(); g.stroke(); }
    g.beginPath(); g.moveTo(48.5, eyeY - 1); g.lineTo(51.5, eyeY - 1); g.stroke();
  }
  if (L.cap) {
    g.fillStyle = L.cap;
    g.beginPath(); g.ellipse(50, 28, 23, 13, 0, Math.PI, 0); g.fill();
    g.fillRect(48, 26, 30, 5);
    if (L.capBadge) ellipse(g, 50, 21, 4, 4, L.capBadge);
  }
  if (L.headset) {
    g.strokeStyle = '#1a1d24'; g.lineWidth = 3.5;
    g.beginPath(); g.arc(50, 42, 25, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    ellipse(g, 26, 47, 4, 6, '#1a1d24');
    g.lineWidth = 2; g.beginPath(); g.moveTo(26, 52); g.quadraticCurveTo(30, 64, 42, 62); g.stroke();
  }
  if (L.earring) ellipse(g, 71, 53, 1.8, 1.8, L.earring);
  // Rim.
  g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 97, 97);
}
