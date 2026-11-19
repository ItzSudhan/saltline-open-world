// Rank and RP: jobs, races, evading the heat and street crimes earn reputation points. Each rank
// has a title, and some ranks unlock gear at Ironleaf Arms. Saved with the rest of the game.

export const RANK_TITLES = ['Deckhand', 'Runner', 'Wheelman', 'Hustler', 'Riptide', 'Operator', 'Shot Caller', 'Bay Boss', 'Kingpin', 'Legend of the Bay'];

// Total RP needed to reach `rank` (rank 1 needs 0).
export const rpForRank = (rank) => 250 * (rank - 1) * rank;

export const RP_FOR = {
  carjack: 25, assault: 10, runover: 10, copcar: 60, copkill: 80, explosion: 40,
  stash: 150, raceWin: 450, raceBest: 250,
};

export class RankSystem {
  constructor(game) {
    this.game = game;
    this.rp = 0;
    this.feed = [];           // recent awards for the HUD ticker: { text, t }
  }

  get rank() {
    let r = 1;
    while (r < RANK_TITLES.length && this.rp >= rpForRank(r + 1)) r++;
    return r;
  }

  get title() { return RANK_TITLES[this.rank - 1]; }

  // Total RP, the RP the next rank needs, and the fraction of the current rank done.
  progress() {
    const r = this.rank, lo = rpForRank(r), hi = rpForRank(r + 1);
    if (r >= RANK_TITLES.length) return { have: this.rp, need: this.rp, frac: 1 };
    return { have: this.rp, need: hi, frac: (this.rp - lo) / (hi - lo) };
  }

  award(amount, reason) {
    if (!amount || this.game.peaceful) return;
    const before = this.rank;
    this.rp += Math.round(amount);
    this.feed.unshift({ text: `+${Math.round(amount)} RP · ${reason}`, t: 3 });
    this.feed.length = Math.min(this.feed.length, 3);
    const after = this.rank;
    if (after > before) this.onRankUp(after);
  }

  onRankUp(rank) {
    const game = this.game;
    game.hud.banner(`RANK ${rank}`, RANK_TITLES[rank - 1].toUpperCase(), false, 3.5);
    game.audio?.missionPass();
    const unlocked = game.weapons.unlockForRank(rank);
    for (const w of unlocked) game.hud.toast(`Unlocked: ${w.name}`);
  }

  update(dt) {
    for (const f of this.feed) f.t -= dt;
    this.feed = this.feed.filter((f) => f.t > 0);
  }
}
