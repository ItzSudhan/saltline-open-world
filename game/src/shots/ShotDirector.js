// Staged scenes for screenshots (?shot=chase|street|heist|map|title): each puts the real game
// into a moment (positions, cars, police, mission step, hour), simulates it with the normal
// update loop and held keys, then freezes the frame.
import { Vehicle } from '../vehicles/CarPhysics.js';
import { MISSIONS, CAST } from '../story/StoryScript.js';
import { CREW } from '../crew/CrewAbilities.js';
import { writeSave, readSave, applySave } from '../save/SaveGame.js';
import { LOCATIONS, LANE, roadCoord } from '../world/CityLayout.js';

function simulate(game, seconds, each) {
  const dt = 1 / 30;
  for (let i = 0; i < seconds / dt; i++) {
    each?.(i * dt);
    game.update(dt);
    game.input.endFrame();
  }
}

function jumpToStep(game, missionIdx, type) {
  const d = game.missions;
  d.index = missionIdx;
  d.start(MISSIONS[missionIdx]);
  const steps = MISSIONS[missionIdx].steps;
  while (d.active && d.stepIdx < steps.length && steps[d.stepIdx].type !== type) d.advance();
}

function quietBanner(game) {
  game.hud.bannerT = 0;
  game.hud.el.banner.classList.remove('show');
}

// A player who has played a while: rank RP (and the gear it unlocks) and crew cooldowns in use.
function veteran(game, rp, { fix = 0, plates = 0, eyes = false } = {}) {
  game.rank.rp = rp;
  game.weapons.give('smg', 150);
  game.weapons.unlockForRank(game.rank.rank);
  game.crew.cooldowns.fix = fix;
  game.crew.cooldowns.plates = plates;
  if (eyes) { game.crew.use(CREW[2]); game.crew.cooldowns.eyes -= 8; game.crew.eyesOutT -= 8; }
}

function finish(game) {
  quietBanner(game);
  game.hud.toastT = 0; game.hud.el.toast.style.display = 'none';
  game.forceDistrict = true;
  game.hud.refreshAll();
  game.minimap.draw(0);
}

// Points the render camera directly (the frame is frozen right after).
function frame(game, from, to) {
  const cam = game.three.camera;
  cam.position.set(from.x, from.y, from.z);
  cam.lookAt(to.x, to.y, to.z);
  cam.updateMatrixWorld();
}

const SHOTS = {
  // Cover: a golden-hour getaway up Seabreak Parade, beach and surf on the right, three SBPD
  // cruisers on the bumper, the air unit's searchlight on Rae and a roadblock ahead.
  chase(game) {
    game.startPlaying();
    game.sky.setHour(18.1);
    game.money = 18450;
    const x = roadCoord(8) + LANE, z = 175;
    for (const s of game.traffic.parkingSpots) if (Math.abs(s.x - x) < 16 && s.z > z - 160 && s.z < z + 40) s.taken = true;
    const car = new Vehicle(game, 'coupe', x, z, Math.PI, '#ff5a4f');
    car.vz = -27;
    car.health = 81;
    game.vehicles.push(car);
    game.player.enterVehicle(car);
    game.camera.snapBehind(Math.PI);
    game.player.health = 78; game.player.armor = 45;
    veteran(game, 6180, { fix: 31, eyes: true });
    game.weapons.select('smg');
    jumpToStep(game, 4, 'loseWanted');
    game.wanted.setLevel(4);
    const heli = game.wanted.heli;
    heli.placeOver(car.x, car.z, -6, -40);
    heli.vz = -27;
    const cops = [[-0.2, 7.5], [-7.4, 11], [-3.4, 17], [-7.2, 26]].map(([ox, oz]) => {
      const c = game.wanted.addPoliceCar(x + ox, z + oz, Math.PI); c.vz = -27.5; return c;
    });
    cops[1].heading = Math.PI - 0.08;
    game.wanted.roadblocks.place(roadCoord(8), z - 74, 'z');
    game.traffic.spawnCar(8, 2, { x: 0, z: 1 }, 10, 'scooter', '#ffd166');
    game.traffic.spawnCar(8, 3, { x: 0, z: 1 }, 40, 'taxi');
    game.traffic.spawnCar(8, 3, { x: 0, z: 1 }, 5, 'scooter', '#8ff7ec');
    for (let i = 0; i < 26; i++) game.peds.spawnOnBeach(z - 150 + i * 7);
    for (const [bj, n] of [[3, 5], [4, 6]]) for (let i = 0; i < n; i++) game.peds.spawnOnBlock(7, bj, 30 + i * 41);
    game.input.down.add('KeyW');
    simulate(game, 0.9, () => { game.wanted.lastX = car.x; game.wanted.lastZ = car.z; });
    game.hud.sayNow([{ who: { ...CAST.dispatch }, text: 'All units, suspect northbound on Seabreak Parade. HAWK-1 has a light on her.' }]);
    frame(game, { x: car.x + 5.5, y: 5.4, z: car.z + 23 }, { x: car.x + 5, y: 5.6, z: car.z - 30 });
    finish(game);
  },

  // On foot on the Sunbreak promenade: a busy beach, the boardwalk marker, shotgun in hand.
  street(game) {
    game.startPlaying();
    game.sky.setHour(17.3);
    game.money = 7350;
    veteran(game, 3420, { plates: 12 });
    jumpToStep(game, 3, 'goto');
    const px = 337, pz = 20, bw = LOCATIONS.boardwalk;
    game.player.place(px, pz, Math.PI);
    const yaw = Math.atan2(bw.x - px, bw.z - pz) - 0.12;
    game.camera.yaw = yaw; game.camera.pitch = 0.1; game.player.heading = yaw;
    game.weapons.select('shotgun');
    for (let i = 0; i < 34; i++) game.peds.spawnOnBeach(pz - 70 + i * 2);
    for (const [bj, n] of [[3, 6], [4, 4]]) for (let i = 0; i < n; i++) game.peds.spawnOnBlock(7, bj, 20 + i * 47);
    game.traffic.spawnCar(8, 4, { x: 0, z: -1 }, 18, 'scooter', '#ff9db0');
    game.traffic.spawnCar(8, 4, { x: 0, z: -1 }, 40, 'coupe');
    game.traffic.spawnCar(8, 3, { x: 0, z: 1 }, 30, 'sedan');
    simulate(game, 1.0);
    game.hud.sayNow([{ who: { ...CAST.tide }, text: 'The Coral Kings run that boardwalk. Benny holds court by the big wheel.' }]);
    const p = game.player.position;
    frame(game, { x: p.x - 3.2, y: 3.4, z: p.z + 6.5 }, { x: p.x + 10, y: 1.2, z: p.z - 30 });
    finish(game);
  },

  // The Halcyon Trust job: holding the lobby against SBPD at sunset.
  heist(game) {
    game.startPlaying();
    game.sky.setHour(18.5);
    game.money = 9870;
    veteran(game, 5310, { plates: 40, fix: 12 });
    game.weapons.give('smg', 240);
    game.weapons.select('smg');
    const b = LOCATIONS.bank;
    game.player.place(b.x - 3, b.z - 2, 0.4);
    game.player.armor = 60; game.player.health = 72;
    jumpToStep(game, 4, 'hold');
    game.missions.hold = 8.5;
    game.wanted.heli.placeOver(b.x, b.z, 8, 70);
    const cop = game.wanted.addPoliceCar(b.x + 14, b.z + 15, -1.2);
    game.wanted.addPoliceCar(b.x - 14, b.z + 17, 1.9);
    game.camera.yaw = 0.2; game.camera.pitch = 0.1;
    game.input.buttons[2] = true;
    simulate(game, 1.0, () => { game.camera.yaw = 0.2; });
    game.hostiles.spawn('police', b.x + 6, b.z + 22, { aggro: true });
    simulate(game, 0.5, (t) => {
      if (Math.abs(t - 0.3) < 0.02) cop.explode(true);
      game.camera.yaw = 0.2;
    });
    game.weapons.cooldown = 0;
    game.weapons.fire();
    for (const u of game.hostiles.alive().slice(0, 3)) game.effects.tracer(u.x, 1.35, u.z, game.player.x, 1.3, game.player.z, '#9fd0ff');
    game.hud.sayNow([{ who: { ...CAST.nadia }, text: 'Vault timer is running. Hold the lobby, Rae!' }]);
    const p = game.player.position;
    frame(game, { x: p.x - 3.4, y: 2.6, z: p.z - 4.6 }, { x: p.x + 5, y: 3.6, z: p.z + 30 });
    finish(game);
  },

  map(game) {
    game.startPlaying();
    game.sky.setHour(18.3);
    game.money = 31200;
    veteran(game, 4100);
    game.missions.index = 2;
    game.weapons.give('smg', 90);
    game.pickups.stashFound.add(1); game.pickups.stashFound.add(4);
    game.stats.cars = 14; game.stats.cops = 3;
    game.player.place(LOCATIONS.club.x, LOCATIONS.club.z, 0);
    simulate(game, 0.5);
    game.pause('CITY MAP');
  },

  // Not a screenshot: plays 100 simulated seconds of random driving, carjacking and shooting
  // through the real loop and prints a health report (used to catch runtime errors headless).
  soak(game) {
    game.newGame();
    const keys = ['KeyW', 'KeyA', 'KeyD', 'KeyS', 'ShiftLeft', 'Space'];
    let errors = 0, firstError = '';
    const dt = 1 / 30;
    const frames = Number(new URLSearchParams(location.search).get('frames')) || 3000;
    let t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      if (i % 150 === 0) {
        const p = game.player.position;
        console.log(`soak ${i} ${(performance.now() - t0).toFixed(0)}ms veh=${game.vehicles.length} parked=${game.traffic.parked.length} peds=${game.peds.peds.length} pos=${p.x.toFixed(0)},${p.z.toFixed(0)} car=${!!game.player.vehicle}`);
        t0 = performance.now();
      }
      if (i % 90 === 0) {
        game.input.down.clear();
        for (const k of keys) if (game.rand.chance(0.35)) game.input.down.add(k);
        game.input.down.add('KeyW');
        if (game.rand.chance(0.3)) game.input.pressed.add('KeyF');
        game.input.buttons[2] = game.rand.chance(0.3);
        game.input.mouseDX = (game.rand.next() - 0.5) * 300;
      }
      if (i % 7 === 0) game.input.clicked[0] = true;
      if (i === 600) game.wanted.setLevel(3);
      if (i === 1200) { const m = game.missions; if (!m.active) m.start(m.next); }
      try { game.update(dt); } catch (e) { errors++; if (!firstError) firstError = `${e.message} ${e.stack?.split('\n')[1]}`; }
      game.input.endFrame();
    }
    const p = game.player.position;
    const report = `SOAK frames=3000 errors=${errors} ${firstError}\nvehicles=${game.vehicles.length} peds=${game.peds.peds.length} hostiles=${game.hostiles.units.length} heat=${game.wanted.level} police=${game.wanted.cars.length} money=${game.money} hp=${game.player.health.toFixed(0)} pos=${p.x.toFixed(0)},${p.z.toFixed(0)} inCar=${!!game.player.vehicle} mission=${game.missions.active?.id}`;
    const o = document.getElementById('error-overlay');
    o.style.display = 'block'; o.textContent += report;
    console.log(report);
  },

  // Not a screenshot: plays every story mission through MissionDirector, completing each
  // objective by teleporting or forcing state, and prints which missions pass.
  missiontest(game) {
    game.newGame();
    game.godMode = true;
    const d = game.missions, pl = game.player, results = [];
    const run = (sec) => { for (let i = 0; i < sec * 30; i++) { game.update(1 / 30); game.input.endFrame(); } };
    const goTo = (p, inCar) => {
      if (inCar && !pl.vehicle) { const v = new Vehicle(game, 'sedan', p.x, p.z + 3, 0); game.vehicles.push(v); game.traffic.cars.push(v); pl.enterVehicle(v); }
      if (!inCar && pl.vehicle) pl.exitVehicle(true);
      if (pl.vehicle) { const v = pl.vehicle; v.x = p.x; v.z = p.z; v.vx = v.vz = 0; v.speed = 0; } else pl.place(p.x, p.z);
    };
    for (let m = 0; m < MISSIONS.length; m++) {
      const mission = MISSIONS[m];
      if (pl.vehicle) pl.exitVehicle(true);
      game.wanted.clear();
      d.cooldown = 0;
      goTo(d.loc(mission.start), false);
      run(0.5);
      if (d.active?.id !== mission.id) { results.push(`${mission.id}: did not start`); break; }
      let guard = 0;
      while (d.active && guard++ < 40) {
        const s = d.step;
        if (s.type === 'enterCar') { pl.place(d.cars[s.id].x + 2, d.cars[s.id].z); pl.enterVehicle(d.cars[s.id]); }
        else if (s.type === 'deliver') { if (pl.vehicle !== d.cars[s.id]) pl.enterVehicle(d.cars[s.id]); goTo(d.loc(s.to), true); }
        else if (s.type === 'goto') goTo(d.loc(s.to), !!s.inVehicle);
        else if (s.type === 'destroy') d.cars[s.id].damage(999, true);
        else if (s.type === 'eliminate') for (const u of game.hostiles.alive(s.tag)) game.hostiles.damage(u, 999);
        else if (s.type === 'hold') { goTo(d.loc(s.to), false); run(s.seconds + 1); }
        else if (s.type === 'loseWanted') game.wanted.clear();
        run(0.4);
      }
      results.push(`${mission.id}: ${d.index > m ? 'PASSED' : `stuck at step ${d.stepIdx} (${d.step?.type})`}`);
      if (d.index <= m) break;
    }
    // The Sunbreak Sprint: start it from the beach road, then pass every checkpoint.
    goTo(game.race.start, true);
    run(0.2);
    game.input.pressed.add('KeyE');
    run(0.1);
    let laps = 0;
    while (game.race.active && laps++ < 20) { goTo(game.race.ring.position, true); run(0.3); }
    results.push(`race: ${game.race.best ? `WON ${game.race.best.toFixed(1)}s` : 'not finished'}`);
    const report = `MISSIONTEST ${results.join(' | ')} money=${game.money} weapons=${[...game.weapons.owned]}`;
    const o = document.getElementById('error-overlay');
    o.style.display = 'block'; o.textContent += report;
    console.log(report);
  },

  // Not a screenshot: checks the pursuit and progression systems through the real loop: HEAT 4
  // brings the air unit and a roadblock, the roster names every unit, each crew ability does its
  // job, and rank RP survives a save/load round trip.
  systemstest(game) {
    game.newGame();
    game.godMode = true;
    const out = [], run = (sec) => { for (let i = 0; i < sec * 30; i++) { game.update(1 / 30); game.input.endFrame(); } };
    const x = roadCoord(8) + LANE;
    const car = new Vehicle(game, 'coupe', x, 200, Math.PI);
    game.vehicles.push(car);
    game.player.enterVehicle(car);
    game.wanted.setLevel(4);
    game.input.down.add('KeyW');
    let blocked = 0;
    for (let i = 0; i < 10 * 30; i++) { run(1 / 30); blocked = Math.max(blocked, game.wanted.roadblocks.blocks.length); }
    out.push(`roadblock seen=${blocked > 0}`);
    const w = game.wanted;
    out.push(`heli=${w.heli.active}${w.heli.tracking ? '/lit' : ''} roadblocks=${w.roadblocks.blocks.length} units=${w.roster.units.length}`);
    out.push(`states=${[...new Set(w.roster.units.map((u) => u.state))].join(',')}`);
    out.push(`callsigns unique=${new Set(w.roster.units.map((u) => u.callsign)).size === w.roster.units.length}`);
    game.input.down.clear();
    const before = w.level;
    game.input.pressed.add('KeyZ'); run(0.1);
    out.push(`plates ${before}->${w.level}`);
    car.health = 40;
    game.input.pressed.add('KeyX'); run(0.1);
    out.push(`fix health=${Math.round(car.health)}`);
    game.input.pressed.add('KeyC'); run(0.1);
    out.push(`eyesOut=${game.crew.eyesOut} cooldownZ=${Math.ceil(game.crew.cooldowns.plates)}`);
    game.input.pressed.add('Digit4'); run(0.1);
    const rp = game.rank.rp;
    game.rank.award(3000, 'test');
    out.push(`rank=${game.rank.rank} ${game.rank.title} shotgun=${game.weapons.owned.has('shotgun')}`);
    writeSave(game); game.rank.rp = 0; applySave(game, readSave());
    out.push(`save rp ${game.rank.rp === rp + 3000 ? 'OK' : 'LOST'}`);
    const report = `SYSTEMSTEST ${out.join(' | ')}`;
    const o = document.getElementById('error-overlay');
    o.style.display = 'block'; o.textContent += report;
    console.log(report);
  },

  title(game) {
    game.showTitle();
    game.sky.setHour(18.4);
    simulate(game, 2);
  },
};

export function stageShot(game, name) {
  (SHOTS[name] || SHOTS.chase)(game);
  game.frozen = true;
  document.title = `shot-ready ${name}`;
}
