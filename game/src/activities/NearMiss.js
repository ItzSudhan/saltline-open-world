// Near misses: threading the car past civilian traffic at speed (close, but no contact) pays cash
// and RP. Quick chains build a combo up to x5; the combo drops after 3 s without another.
const MIN_SPEED = 16;   // m/s (~58 km/h)
const CLOSE = 4.6;      // centre-to-centre metres that count as a near miss
const BASE_CASH = 40;

export class NearMiss {
  constructor(game) {
    this.game = game;
    this.combo = 0;
    this.comboT = 0;
    this.total = 0;
  }

  update(dt) {
    const game = this.game, v = game.player.vehicle;
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    if (!v || v.wrecked) return;
    const sp = Math.hypot(v.vx, v.vz);
    if (sp < MIN_SPEED) return;
    for (const o of game.traffic.cars) {
      if (o === v || o.driver !== 'ai' || o.wrecked) continue;
      const d = Math.hypot(o.x - v.x, o.z - v.z);
      if (d > CLOSE || d < v.radius + o.radius - 0.9) continue;
      if (game.time - (o.nearMissAt ?? -99) < 4) continue;
      o.nearMissAt = game.time;
      this.award();
    }
  }

  award() {
    const game = this.game;
    this.combo = Math.min(5, this.combo + 1);
    this.comboT = 3;
    const cash = BASE_CASH * this.combo;
    this.total += cash;
    game.money += cash;
    game.rank.award(10 * this.combo, `Near miss x${this.combo}`);
    game.hud.stunt(this.combo > 1 ? `NEAR MISS x${this.combo}` : 'NEAR MISS', `+$${cash}`);
  }
}
