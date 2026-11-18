// Every sound is synthesised with WebAudio: engine hum, police siren, gunshots, crashes,
// explosions, UI stings, and three procedural car-radio stations.

const STATIONS = [
  { bpm: 104, root: 45, scale: [0, 3, 5, 7, 10], wave: 'triangle' },   // Saltwater FM: sunset synth-pop
  { bpm: 128, root: 40, scale: [0, 2, 3, 7, 8], wave: 'square' },      // Coral Heat: club
  { bpm: 82, root: 50, scale: [0, 4, 7, 9, 11], wave: 'sine' },        // Low Tide Lounge
];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class SoundEngine {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.station = 0;
    this.radio = false;
    this.step = 0;
    this.nextNote = 0;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(ctx.destination);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Engine.
    this.engOsc = ctx.createOscillator(); this.engOsc.type = 'sawtooth';
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 400;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engOsc.connect(this.engFilter).connect(this.engGain).connect(this.master);
    this.engOsc.start();
    // Siren.
    this.sirenOsc = ctx.createOscillator(); this.sirenOsc.type = 'triangle';
    this.sirenGain = ctx.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
    this.radioGain = ctx.createGain(); this.radioGain.gain.value = 0; this.radioGain.connect(this.master);
  }

  get ok() { return !!this.ctx && this.ctx.state === 'running'; }

  vol(x, z) {
    const p = this.game.player.position;
    return 1 / (1 + Math.hypot(p.x - x, p.z - z) / 18);
  }

  noise(dur, freq, gain, type = 'lowpass', dest = this.master) {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t); src.stop(t + dur + 0.05);
  }

  tone(freq, dur, gain, type = 'sine', delay = 0, dest = this.master, slideTo = 0) {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }

  gunshot(x, z, npc, weapon) {
    const v = this.vol(x, z) * (npc ? 0.6 : 1);
    this.noise(weapon === 'smg' ? 0.09 : 0.16, 2400, 0.9 * v);
    this.tone(150, 0.12, 0.6 * v, 'square', 0, this.master, 50);
  }
  crash(s) { this.noise(0.35, 900, Math.min(1, s / 20)); this.tone(70, 0.3, Math.min(0.6, s / 30), 'sawtooth', 0, this.master, 35); }
  thud() { this.tone(110, 0.15, 0.5, 'sine', 0, this.master, 50); this.noise(0.08, 500, 0.4); }
  whoosh() { this.noise(0.15, 1500, 0.25, 'bandpass'); }
  click() { this.tone(1800, 0.03, 0.2, 'square'); }
  doorSound() { this.noise(0.1, 700, 0.35); this.tone(180, 0.08, 0.25, 'square'); }
  horn(x, z) { const v = this.vol(x, z) * 0.35; this.tone(392, 0.35, v, 'square'); this.tone(311, 0.35, v, 'square'); }
  explosion(x, z) { const v = this.vol(x, z); this.noise(1.6, 300, 1.2 * v); this.tone(55, 1.2, 0.9 * v, 'sine', 0, this.master, 25); }
  pickup() { this.tone(880, 0.08, 0.3, 'square'); this.tone(1320, 0.12, 0.3, 'square', 0.07); }
  heatUp() { this.tone(520, 0.15, 0.25, 'sawtooth'); this.tone(690, 0.2, 0.25, 'sawtooth', 0.12); }
  heatClear() { this.tone(690, 0.15, 0.2, 'triangle'); this.tone(520, 0.3, 0.2, 'triangle', 0.12); }
  missionStart() { [0, 4, 7, 12].forEach((n, i) => this.tone(midi(62 + n), 0.3, 0.22, 'triangle', i * 0.09)); }
  missionPass() { [0, 4, 7, 11, 14, 19].forEach((n, i) => this.tone(midi(60 + n), 0.5, 0.25, 'triangle', i * 0.1)); }
  missionFail() { [7, 3, 0, -5].forEach((n, i) => this.tone(midi(55 + n), 0.45, 0.25, 'sawtooth', i * 0.16)); }

  radioOn() { this.radio = this.station < STATIONS.length; }
  radioOff() { this.radio = false; }
  nextStation() { this.station = (this.station + 1) % (STATIONS.length + 1); this.radio = this.station < STATIONS.length; }

  update(dt) {
    if (!this.ok) return;
    const game = this.game, ctx = this.ctx, t = ctx.currentTime;
    const v = game.player.vehicle;
    const playing = game.state === 'playing';
    // Engine note follows speed with a fake gearbox.
    if (v && playing) {
      const sp = Math.abs(v.speed), gear = Math.min(4, Math.floor(sp / 12));
      const rpm = 0.25 + ((sp - gear * 12) / 12) * 0.75;
      this.engOsc.frequency.setTargetAtTime(45 + rpm * 110 + gear * 8, t, 0.05);
      this.engFilter.frequency.setTargetAtTime(300 + rpm * 900, t, 0.05);
      this.engGain.gain.setTargetAtTime(0.12, t, 0.1);
    } else this.engGain.gain.setTargetAtTime(0, t, 0.1);
    // Siren from the nearest pursuit car.
    let best = Infinity;
    if (playing) for (const c of game.wanted.cars) if (!c.wrecked) best = Math.min(best, Math.hypot(c.x - game.player.position.x, c.z - game.player.position.z));
    const sv = best < Infinity ? 0.16 / (1 + best / 25) : 0;
    this.sirenGain.gain.setTargetAtTime(sv, t, 0.1);
    this.sirenOsc.frequency.setTargetAtTime(Math.floor(t * 2) % 2 ? 960 : 720, t, 0.05);
    // Radio sequencer.
    const st = STATIONS[this.station];
    const radioUp = this.radio && v && playing && st;
    this.radioGain.gain.setTargetAtTime(radioUp ? 0.5 : 0, t, 0.2);
    if (!radioUp) return;
    const beat = 60 / st.bpm / 2;
    if (this.nextNote < t) this.nextNote = t + 0.05;
    while (this.nextNote < t + 0.15) {
      const s = this.step++, when = this.nextNote - t;
      const bar = Math.floor(s / 16) % 4, prog = [0, 3, 4, 2][bar];
      const deg = (k) => st.root + st.scale[(prog + k) % st.scale.length] + 12 * Math.floor((prog + k) / st.scale.length);
      if (s % 4 === 0) this.tone(midi(deg(0)), beat * 3, 0.35, 'sine', when, this.radioGain);
      if (s % 8 === 4) this.noise(0.12, 1800, 0.25, 'bandpass', this.radioGain);
      if (s % 2 === 1) this.noise(0.03, 7000, 0.12, 'highpass', this.radioGain);
      if ((s * 7) % 5 < 2) this.tone(midi(deg((s * 3) % 5) + 24), beat * 1.5, 0.12, st.wave, when, this.radioGain);
      this.nextNote += beat;
    }
  }
}
