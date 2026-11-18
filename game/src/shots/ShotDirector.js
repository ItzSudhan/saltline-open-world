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
    game.hud.lines = [];
    game.hud.say([{ who: { name: "Tomas 'Tide' Okafor", initials: 'TO', color: '#ffb347' }, text: 'Every cop in Saltline is coming. Lose them, Rae!' }]);
    const c1 = game.wanted.addPoliceCar(x - 0.5, z + 16, Math.PI); c1.vz = -25;
    const c2 = game.wanted.addPoliceCar(x - 5.5, z + 30, Math.PI - 0.05); c2.vz = -24;
    for (const back of [20, 60]) game.traffic.spawnCar(5, 1, { x: 0, z: 1 }, back);
    game.traffic.spawnCar(5, 3, { x: 0, z: 1 }, 30);
    game.input.down.add('KeyW');
    simulate(game, 1.6, () => { game.wanted.lastX = car.x; game.wanted.lastZ = car.z; });
    quietBanner(game);
    game.forceDistrict = true;
    game.hud.update(0); game.minimap.draw(0);
  },

  // On foot in Coral Heights, the target Kestrel GT under its marker across the street.
  street(game) {
    game.startPlaying();
    game.sky.setHour(17.4);
    game.money = 2350;
    const k = LOCATIONS.kestrel;
    game.player.place(-250.6, k.z + 22, 0);
    jumpToStep(game, 0, 'enterCar');
    const yaw = Math.atan2(k.x - game.player.x, k.z - game.player.z) - 0.25;
    game.camera.yaw = yaw; game.camera.pitch = 0.12; game.player.heading = yaw;
    for (const s of [86, 94, 108, 118, 130, 74]) game.peds.spawnOnBlock(0, 1, s);
    for (const s of [190, 205, 215, 160]) game.peds.spawnOnBlock(1, 1, s);
    game.traffic.spawnCar(1, 1, { x: 0, z: 1 }, 25);
    game.traffic.spawnCar(1, 3, { x: 0, z: -1 }, 40);
    game.traffic.spawnCar(1, 2, { x: 0, z: 1 }, 52);
    game.weapons.select('pistol');
    simulate(game, 1.2);
    quietBanner(game);
    game.hud.lines = [];
    game.hud.lineT = 0;
    game.hud.say([{ who: { name: "Tomas 'Tide' Okafor", initials: 'TO', color: '#ffb347' }, text: 'Client wants a Kestrel GT. Cherry red. One is parked up in Coral Heights.' }]);
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
    game.camera.yaw = 0.35; game.camera.pitch = 0.08;
    game.input.buttons[2] = true;
    game.hud.lines = []; game.hud.lineT = 0;
    simulate(game, 1.0, (t) => {
      if (Math.abs(t - 0.6) < 0.02) cop.explode(true);
      game.camera.yaw = 0.35;
    });
    for (const u of game.hostiles.alive()) { u.x = Math.max(u.x, b.x - 12); }
    game.hostiles.spawn('police', b.x + 6, b.z + 22, { aggro: true });
    simulate(game, 0.3, () => { game.camera.yaw = 0.35; });
    game.weapons.cooldown = 0;
    game.weapons.fire();
    for (const u of game.hostiles.alive().slice(0, 2)) game.effects.tracer(u.x, 1.35, u.z, game.player.x, 1.3, game.player.z, '#9fd0ff');
    quietBanner(game);
    game.hud.say([{ who: { name: 'SBPD Dispatch', initials: 'PD', color: '#6ab7ff' }, text: 'Silent alarm at Halcyon Trust! All units respond!' }]);
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
