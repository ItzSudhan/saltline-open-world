// Entry point: shows errors on screen, boots the game, and hands ?shot= URLs to the ShotDirector.
import { Game } from './core/Game.js';
import { stageShot } from './shots/ShotDirector.js';

const overlay = document.getElementById('error-overlay');
function report(msg) {
  overlay.style.display = 'block';
  overlay.textContent += `${msg}\n`;
  console.error(msg);
}
addEventListener('error', (e) => report(`Error: ${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}`));
addEventListener('unhandledrejection', (e) => report(`Promise: ${e.reason?.stack || e.reason}`));

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || 1;
const game = new Game(document.getElementById('view'), seed);
window.saltline = game;
const shot = params.get('shot');
if (shot) stageShot(game, shot);
else game.showTitle();
game.run();
