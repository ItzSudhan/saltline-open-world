// Staged scenes for screenshots (?shot=chase|street|heist|map|title): each puts the real game
// into a moment (positions, cars, police, mission step, hour), simulates it with the normal
// update loop and held keys, then freezes the frame.
import { Vehicle } from '../vehicles/CarPhysics.js';
import { MISSIONS } from '../story/StoryScript.js';
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

const SHOTS = {
  // Cover: a sunset getaway up Marlin Ave with SBPD on the bumper.
  chase(game) {
    game.startPlaying();
    game.sky.setHour(18.15);
    game.money = 18450;
    const x = roadCoord(5) + LANE, z = 210;
    // Keep the camera's side of the boulevard free of parked cars for a clear view.
    for (const s of game.traffic.parkingSpots) if (Math.abs(s.x - x) < 14 && s.z > z - 90 && s.z < z + 20) s.taken = true;
    const car = new Vehicle(game, 'coupe', x, z, Math.PI, '#ff5a4f');
    car.vz = -26;
    game.vehicles.push(car);
    game.player.enterVehicle(car);
    game.camera.snapBehind(Math.PI);
    game.camera.lastMouse = 10;
    game.camera.pitch = 0.14;
    game.weapons.give('smg', 150);
    jumpToStep(game, 4, 'loseWanted');
    game.wanted.setLevel(4);
    const c1 = game.wanted.addPoliceCar(x - 0.5, z + 10, Math.PI); c1.vz = -27;
    const c2 = game.wanted.addPoliceCar(x - 7.2, z + 15, Math.PI - 0.04); c2.vz = -27;
    const c3 = game.wanted.addPoliceCar(x - 3.5, z + 30, Math.PI); c3.vz = -27;
    for (const back of [20, 60]) game.traffic.spawnCar(5, 1, { x: 0, z: 1 }, back);
    game.traffic.spawnCar(5, 3, { x: 0, z: 1 }, 30);
    game.input.down.add('KeyW');
    simulate(game, 0.9, () => { game.wanted.lastX = car.x; game.wanted.lastZ = car.z; });
    quietBanner(game);
    game.hud.sayNow([{ who: { name: "Tomas 'Tide' Okafor", initials: 'TO', color: '#ffb347' }, text: 'Every cop in Saltline is coming. Lose them, Rae!' }]);
    // Holding C: the look-back camera on the pursuit.
    game.input.down.add('KeyC');
    game.camera.dist = 10.5;
    game.camera.update(0.001);
    game.forceDistrict = true;
    game.hud.update(0); game.minimap.draw(0);
  },

  // On foot in Coral Heights, the target Kestrel GT under its marker across the street.
  street(game) {
    game.startPlaying();
    game.sky.setHour(17.4);
    game.money = 2350;
    const k = LOCATIONS.kestrel;
    game.player.place(-251, k.z + 19, 0);
    for (const s of game.traffic.parkingSpots) if (Math.hypot(s.x - k.x, s.z - k.z) < 30) s.taken = true;
    jumpToStep(game, 0, 'enterCar');
    const yaw = Math.atan2(k.x - game.player.x, k.z - game.player.z) - 0.3;
    game.camera.yaw = yaw; game.camera.pitch = 0.12; game.player.heading = yaw;
    for (const s of [86, 94, 108, 118, 130, 74]) game.peds.spawnOnBlock(0, 1, s);
    for (const s of [190, 205, 215, 160]) game.peds.spawnOnBlock(1, 1, s);
    game.traffic.spawnCar(1, 1, { x: 0, z: 1 }, 25);
    game.traffic.spawnCar(1, 3, { x: 0, z: -1 }, 40);
    game.traffic.spawnCar(1, 2, { x: 0, z: 1 }, 52);
    game.weapons.select('pistol');
    simulate(game, 1.2);
    quietBanner(game);
    game.hud.sayNow([{ who: { name: "Tomas 'Tide' Okafor", initials: 'TO', color: '#ffb347' }, text: 'Client wants a Kestrel GT. Cherry red. One is parked up in Coral Heights.' }]);
    game.forceDistrict = true;
    game.hud.update(0); game.minimap.draw(0);
  },

  // The Halcyon Trust job: holding the lobby against SBPD at sunset.
  heist(game) {
    game.startPlaying();
    game.sky.setHour(18.5);
    game.money = 9870;
    game.weapons.give('smg', 240);
    game.weapons.select('smg');
    const b = LOCATIONS.bank;
    game.player.place(b.x - 3, b.z - 2, 0.4);
    game.player.armor = 60; game.player.health = 72;
    jumpToStep(game, 4, 'hold');
    game.missions.hold = 8.5;
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
    quietBanner(game);
    game.hud.sayNow([{ who: { name: 'SBPD Dispatch', initials: 'PD', color: '#6ab7ff' }, text: 'Silent alarm at Halcyon Trust! All units respond!' }]);
    game.hud.update(0); game.minimap.draw(0);
  },

  map(game) {
    game.startPlaying();
    game.sky.setHour(18.3);
    game.money = 31200;
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
