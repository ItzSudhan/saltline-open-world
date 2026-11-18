// The game: builds the renderer and every system, runs the frame loop, and handles game states
// (title, playing, paused, down), money, deaths/arrests, explosions and city services.
import * as THREE from 'three';
import { createRandom } from './Random.js';
import { Input } from './Input.js';
import { CollisionWorld } from '../world/Collision.js';
import { generateCity } from '../world/CityGenerator.js';
import { SkyAndLighting } from '../world/SkyAndLighting.js';
import { LOCATIONS } from '../world/CityLayout.js';
import { Pickups } from '../world/Pickups.js';
import { PlayerController } from '../player/PlayerController.js';
import { CameraRig } from '../player/CameraRig.js';
import { TrafficSystem } from '../ai/TrafficSystem.js';
import { PedestrianSystem } from '../ai/PedestrianSystem.js';
import { HostileSquad } from '../ai/HostileSquad.js';
import { WantedSystem } from '../police/WantedSystem.js';
import { WeaponSystem } from '../combat/WeaponSystem.js';
import { Effects } from '../effects/Effects.js';
import { resolveCarCollisions } from '../vehicles/CarPhysics.js';
import { MissionDirector } from '../missions/MissionDirector.js';
import { StreetRace } from '../activities/StreetRace.js';
import { Hud } from '../ui/Hud.js';
import { Minimap } from '../ui/Minimap.js';
import { Menus } from '../ui/Menus.js';
import { SoundEngine } from '../audio/SoundEngine.js';
import { writeSave, readSave, applySave } from '../save/SaveGame.js';

export class Game {
  constructor(canvas, seed = 1) {
    this.canvas = canvas;
    this.rand = createRandom(seed);
    this.state = 'title';
    this.time = 0;
    this.money = 0;
    this.stats = { missions: 0, peds: 0, cops: 0, cars: 0 };
    this.vehicles = [];
    this.peaceful = true;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 2400);
    this.three = { renderer, scene, camera };
    this.scene = scene;

    this.input = new Input(canvas);
    this.collision = new CollisionWorld();
    this.sky = new SkyAndLighting(scene, renderer);
    this.city = generateCity(scene, this.collision, this.rand);
    this.effects = new Effects(this);
    this.pickups = new Pickups(this);
    this.player = new PlayerController(this);
    this.camera = new CameraRig(camera, this);
    this.traffic = new TrafficSystem(this);
    this.peds = new PedestrianSystem(this);
    this.hostiles = new HostileSquad(this);
    this.wanted = new WantedSystem(this);
    this.weapons = new WeaponSystem(this);
    this.missions = new MissionDirector(this);
    this.race = new StreetRace(this);
    this.hud = new Hud(this);
    this.minimap = new Minimap(this, this.city.footprints);
    this.audio = new SoundEngine(this);
    this.menus = new Menus(this);
    this.buildServicePoints();

    this.player.place(LOCATIONS.start.x, LOCATIONS.start.z, Math.PI);
    this.sky.setHour(18.1);
    this.pickups.placeStashes();
    this.hud.updateWeapon();
    addEventListener('resize', () => this.resize());
    this.resize();
    addEventListener('keydown', () => this.audio.unlock(), { once: false });
    canvas.addEventListener('mousedown', () => this.audio.unlock());
    // Losing pointer lock (Esc) pauses the game.
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state === 'playing') this.pause('PAUSED');
    });
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.three.renderer.setSize(w, h, false);
    this.three.camera.aspect = w / h;
    this.three.camera.updateProjectionMatrix();
  }

  buildServicePoints() {
    const ring = (loc, color) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 8, 32), new THREE.MeshBasicMaterial({ color }));
      m.rotation.x = Math.PI / 2;
      m.position.set(loc.x, 0.25, loc.z);
      this.scene.add(m);
    };
    ring(LOCATIONS.gunshop, '#9be08f');
    ring(LOCATIONS.safehouse, '#ffffff');
    ring(LOCATIONS.garageBay, '#ffb347');
  }

  // --- States ---------------------------------------------------------------------------
  showTitle() {
    this.state = 'title';
    this.peaceful = true;
    this.hud.show(false);
    this.menus.showTitle(true);
  }

  newGame() {
    this.money = 500;
    this.missions.index = 0;
    this.player.health = 100; this.player.armor = 0;
    this.player.place(LOCATIONS.start.x, LOCATIONS.start.z, Math.PI);
    this.camera.snapBehind(Math.PI);
    this.startPlaying();
    this.hud.say([{ who: { name: 'Rae Castillo', initials: 'RC', color: '#ff6b5a' }, text: 'Saltline Bay. Sun\'s going down and I\'m flat broke. Tide said to come by the garage.' }]);
  }

  continueGame() {
    applySave(this, readSave());
    this.startPlaying();
    this.hud.toast('Game loaded');
  }

  startPlaying() {
    this.state = 'playing';
    this.peaceful = false;
    this.menus.showTitle(false);
    this.menus.showPause(false);
    this.hud.show(true);
    this.hud.updateWeapon();
  }

  pause(heading) {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.releasePointer();
    this.menus.showPause(true, heading);
  }

  resume() { this.state = 'playing'; this.menus.showPause(false); }

  saveNow() { if (writeSave(this)) this.hud.toast('Game saved'); this.menus.showPause(true, 'SAVED'); }

  quitToTitle() { this.menus.showPause(false); this.showTitle(); }

  addMoney(n, quiet = false) {
    this.money += n;
    if (!quiet) this.hud.toast(`+$${n}`);
    this.audio.pickup();
  }

  // Wasted or arrested: lose some cash, wake up at the hospital or the station.
  onPlayerDown(kind) {
    if (this.player.dead || this.state !== 'playing') return;
    const pl = this.player;
    pl.dead = true;
    if (pl.vehicle) pl.exitVehicle(true);
    pl.model.setDead(kind === 'wasted');
    this.missions.fail(kind === 'wasted' ? 'You were flatlined' : 'You were cuffed');
    const fee = Math.min(this.money, kind === 'wasted' ? 500 : 750);
    this.money -= fee;
    this.hud.banner(kind === 'wasted' ? 'FLATLINED' : 'CUFFED', `Hospital and legal fees: -$${fee}`, true);
    setTimeout(() => {
      const spot = kind === 'wasted' ? LOCATIONS.hospital : LOCATIONS.police;
      this.wanted.clear();
      this.hostiles.clear();
      pl.dead = false;
      pl.health = 100;
      pl.model.setDead(false);
      pl.place(spot.x, spot.z, 0);
    }, 4000);
  }

  onVehicleExploded(v, byPlayer) {
    if (byPlayer || v.lastHitByPlayer) this.wanted.reportCrime('explosion', v.x, v.z);
  }

  onExplosion(x, z) {
    for (const p of this.peds.peds) if (!p.dead && Math.hypot(p.x - x, p.z - z) < 7) this.peds.kill(p, false, (p.x - x) * 2, (p.z - z) * 2);
    for (const u of this.hostiles.units) if (!u.dead && Math.hypot(u.x - x, u.z - z) < 7) this.hostiles.damage(u, 120);
    for (const v of this.vehicles) if (!v.wrecked && Math.hypot(v.x - x, v.z - z) < 7 && Math.hypot(v.x - x, v.z - z) > 0.5) v.damage(45);
    const pp = this.player.position, d = Math.hypot(pp.x - x, pp.z - z);
    if (d < 8) this.player.takeDamage(60 * (1 - d / 8));
    this.peds.panic(x, z, 50);
  }

  onCarHit(a, b) {
    if (a.driver === 'player') b.lastHitByPlayer = true;
    if (b.driver === 'player') a.lastHitByPlayer = true;
  }

  // Garage respray, gun shop and safehouse.
  services() {
    const pl = this.player, pp = pl.position, input = this.input;
    const near = (loc, r) => Math.hypot(pp.x - loc.x, pp.z - loc.z) < r;
    if (pl.vehicle && near(LOCATIONS.garageBay, 7) && this.missions.index >= 1) {
      this.hud.prompt('<b>E</b> Repair &amp; respray at Tide\'s Garage ($250)');
      if (input.wasPressed('KeyE') && this.money >= 250) {
        this.money -= 250;
        pl.vehicle.health = 100;
        pl.vehicle.parts.bodyMat.color.setHSL(this.rand.next(), 0.6, 0.5);
        this.wanted.clear();
        this.hud.toast('Fresh paint. The cops lost you.');
      }
    } else if (!pl.vehicle && near(LOCATIONS.gunshop, 4)) {
      this.hud.prompt('<b>E</b> Ironleaf Arms resupply: ammo + armour ($400)');
      if (input.wasPressed('KeyE') && this.money >= 400) {
        this.money -= 400;
        this.weapons.ammo.pistol += 48;
        if (this.weapons.owned.has('smg')) this.weapons.ammo.smg += 120;
        pl.armor = 100;
        this.hud.updateWeapon();
        this.hud.toast('Locked and loaded');
      }
    } else if (!pl.vehicle && near(LOCATIONS.safehouse, 4)) {
      this.hud.prompt('<b>E</b> Save at Pelican Suites');
      if (input.wasPressed('KeyE')) { writeSave(this); pl.health = 100; this.hud.toast('Game saved. Health restored.'); }
    }
  }

  onMissionPassed(m) {
    if (m.id === 'kings') {
      const s = LOCATIONS.safehouse;
      const v = this.traffic.spawnCar(7, 2, { x: -1, z: 0 }, 20, 'coupe', '#ff6b5a');
      v.ai = null; v.driver = null; v.mission = true; v.x = s.x + 6; v.z = s.z + 6; v.sync();
    }
    writeSave(this);
  }

  // --- Frame ------------------------------------------------------------------------------
  update(dt) {
    this.time += dt;
    const input = this.input;
    if (this.state === 'playing') {
      if (input.wasPressed('Escape') || input.wasPressed('KeyP')) { this.pause('PAUSED'); return; }
      if (input.wasPressed('KeyM')) { this.pause('CITY MAP'); return; }
      if (input.wasPressed('KeyR') && this.player.vehicle) this.audio.nextStation();
      if (input.wasPressed('KeyH') && this.player.vehicle) this.audio.horn(this.player.x, this.player.z);
      this.sky.setHour(this.sky.hour + dt / 240);
      this.player.update(dt);
      this.weapons.update(dt);
      this.services();
    } else if (this.state === 'paused') {
      if (input.wasPressed('Escape') || input.wasPressed('KeyP') || input.wasPressed('KeyM')) this.resume();
      return;
    }
    if (this.state !== 'paused') {
      this.traffic.update(dt);
      this.wanted.update(dt);
      this.hostiles.update(dt);
      this.peds.update(dt);
      resolveCarCollisions(this.vehicles.filter((v) => Math.hypot(v.x - this.player.x, v.z - this.player.z) < 150));
      if (this.state === 'playing') {
        this.missions.update(dt, this.time);
        this.race.update(dt, this.time);
        this.pickups.update(dt, this.time);
        this.camera.update(dt);
        this.driftSmoke();
      } else this.camera.orbit(this.time, 40, 40, 260, 120);
      this.effects.update(dt);
      this.city.update(this.time);
    }
    const p = this.player.position;
    this.sky.follow(p.x, p.z);
    this.city.setNight(this.sky.nightFactor);
    if (this.state === 'playing') { this.hud.update(dt); this.minimap.draw(dt); }
    this.audio.update(dt);
  }

  driftSmoke() {
    const v = this.player.vehicle;
    if (v && v.drift > 4 && Math.random() < 0.5) {
      const f = v.forward();
      this.effects.tyreSmoke(v.x - f.x * 1.6, v.z - f.z * 1.6);
    }
  }

  render() { this.three.renderer.render(this.scene, this.three.camera); }

  run() {
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!this.frozen) this.update(dt);
      this.input.endFrame();
      this.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
