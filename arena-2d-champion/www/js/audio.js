// Sons sintetizados na hora (Web Audio): nada de arquivo de áudio, o APK fica leve.
// As músicas são composições próprias e simples, no estilo chiptune.
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
const SONGS = {
  // Lá menor: Am F G E, 150 bpm
  battle: {
    bpm: 152,
    bass: [45, 0, 57, 45, 0, 45, 57, 0, 41, 0, 53, 41, 0, 41, 53, 0, 43, 0, 55, 43, 0, 43, 55, 0, 40, 0, 52, 40, 0, 44, 47, 52],
    lead: [69, 72, 76, 0, 74, 72, 71, 72, 69, 0, 65, 69, 72, 0, 74, 72, 71, 74, 79, 0, 77, 76, 74, 71, 76, 0, 75, 76, 80, 0, 83, 0,
      69, 72, 76, 81, 79, 76, 74, 76, 77, 0, 76, 74, 72, 74, 76, 0, 74, 0, 71, 74, 79, 77, 76, 74, 76, 75, 76, 80, 83, 0, 0, 0],
    drums: 'k.h.s.h.k.k.s.h.',
  },
  menu: {
    bpm: 104,
    bass: [48, 0, 55, 0, 45, 0, 52, 0, 41, 0, 48, 0, 43, 0, 50, 0],
    lead: [72, 0, 76, 79, 76, 0, 72, 0, 69, 0, 72, 76, 72, 0, 69, 0, 65, 0, 69, 72, 77, 0, 76, 0, 74, 0, 71, 74, 79, 0, 0, 0],
    drums: 'k...h...s...h...',
  },
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.sfxVol = 0.5;
    this.musicVol = 0.25;
    this.muted = false;
    this.song = null;
    this.timer = null;
    this.lastPlay = {};
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.music = this.ctx.createGain();
    this.music.connect(this.master);
    this.applyVolumes();
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.pendingSong) this.playMusic(this.pendingSong);
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : 1;
    this.sfx.gain.value = this.sfxVol;
    this.music.gain.value = this.musicVol;
  }

  tone(freq, dur, { type = 'square', vol = 0.3, slide = 0, delay = 0, attack = 0.005, out } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.3, freq = 1200, q = 1, type = 'lowpass', slide = 0, delay = 0, out } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(out || this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  play(name, opt = {}) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (this.lastPlay[name] && now - this.lastPlay[name] < 45) return;
    this.lastPlay[name] = now;
    const type = opt.type;
    switch (name) {
      case 'ui': this.tone(880, 0.06, { vol: 0.15 }); break;
      case 'select': this.tone(660, 0.06, { vol: 0.15 }); this.tone(990, 0.08, { vol: 0.15, delay: 0.06 }); break;
      case 'back': this.tone(520, 0.08, { vol: 0.15, slide: 0.6 }); break;
      case 'hit': this.noise(0.12, { vol: 0.5, freq: 900, slide: 0.3 }); this.tone(140, 0.12, { type: 'square', vol: 0.25, slide: 0.5 }); break;
      case 'hitSuper': this.noise(0.18, { vol: 0.6, freq: 2400, slide: 0.2 }); this.tone(220, 0.16, { vol: 0.3, slide: 0.4 }); this.tone(1320, 0.1, { vol: 0.12, type: 'triangle', delay: 0.04 }); break;
      case 'hitWeak': this.noise(0.08, { vol: 0.3, freq: 600, slide: 0.4 }); break;
      case 'crit': this.tone(1760, 0.08, { vol: 0.15, type: 'triangle' }); this.tone(2200, 0.1, { vol: 0.12, type: 'triangle', delay: 0.05 }); break;
      case 'shoot': this.sfxForType(type, 0.18); break;
      case 'beam': this.sfxForType(type, 0.7, true); break;
      case 'swing': this.noise(0.12, { vol: 0.25, freq: 3000, type: 'bandpass', q: 2, slide: 0.3 }); break;
      case 'dash': this.noise(0.18, { vol: 0.2, freq: 1500, type: 'bandpass', slide: 2 }); break;
      case 'dodge': this.noise(0.15, { vol: 0.2, freq: 4000, type: 'highpass', slide: 0.4 }); break;
      case 'explode': this.noise(0.45, { vol: 0.6, freq: 700, slide: 0.15 }); this.tone(80, 0.4, { type: 'sine', vol: 0.4, slide: 0.4 }); break;
      case 'quake': this.noise(0.6, { vol: 0.5, freq: 300, slide: 0.5 }); this.tone(55, 0.6, { type: 'sine', vol: 0.4 }); break;
      case 'up': [523, 659, 784].forEach((f, i) => this.tone(f, 0.08, { vol: 0.12, delay: i * 0.06 })); break;
      case 'down': [784, 659, 523].forEach((f, i) => this.tone(f, 0.08, { vol: 0.12, delay: i * 0.06 })); break;
      case 'heal': [880, 1108, 1320, 1760].forEach((f, i) => this.tone(f, 0.12, { vol: 0.08, type: 'triangle', delay: i * 0.05 })); break;
      case 'status': this.tone(300, 0.25, { vol: 0.15, type: 'sawtooth', slide: 0.6 }); break;
      case 'protect': this.tone(1200, 0.2, { vol: 0.12, type: 'triangle' }); this.tone(1500, 0.2, { vol: 0.08, type: 'triangle', delay: 0.05 }); break;
      case 'faint': this.tone(400, 0.6, { vol: 0.25, slide: 0.25 }); break;
      case 'mega': [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.25, { vol: 0.14, type: 'triangle', delay: i * 0.12 })); this.noise(1.2, { vol: 0.15, freq: 6000, type: 'highpass', delay: 0.7 }); break;
      case 'megaClash': [262, 330, 392, 523, 659, 784, 1046].forEach((f, i) => { this.tone(f, 0.3, { vol: 0.14, type: 'square', delay: i * 0.1 }); this.tone(f * 1.5, 0.3, { vol: 0.08, type: 'triangle', delay: i * 0.1 + 0.05 }); }); this.noise(1.6, { vol: 0.3, freq: 400, delay: 0.9, slide: 0.3 }); break;
      case 'clash': this.tone(110, 0.15, { type: 'sawtooth', vol: 0.18 }); this.noise(0.15, { vol: 0.2, freq: 2000, type: 'bandpass' }); break;
      case 'thunder': this.noise(0.8, { vol: 0.6, freq: 3000, slide: 0.1 }); break;
      case 'countdown': this.tone(660, 0.12, { vol: 0.2 }); break;
      case 'go': this.tone(1320, 0.3, { vol: 0.2 }); break;
      case 'win': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.18, { vol: 0.18, delay: i * 0.14 })); break;
      case 'lose': [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.25, { vol: 0.16, delay: i * 0.2 })); break;
      case 'weather': this.noise(1.0, { vol: 0.2, freq: 800, type: 'bandpass', slide: 1.5 }); break;
    }
  }

  sfxForType(type, dur, long = false) {
    switch (type) {
      case 'Fire': this.noise(dur, { vol: 0.35, freq: 1200, slide: 0.5 }); break;
      case 'Water': for (let i = 0; i < (long ? 6 : 2); i++) this.tone(400 + Math.random() * 500, 0.08, { type: 'sine', vol: 0.15, slide: 1.8, delay: i * 0.07 }); this.noise(dur, { vol: 0.2, freq: 1800, type: 'bandpass' }); break;
      case 'Ice': this.tone(1800, dur, { type: 'triangle', vol: 0.1, slide: 1.2 }); this.noise(dur * 0.6, { vol: 0.15, freq: 7000, type: 'highpass' }); break;
      case 'Grass': this.noise(dur, { vol: 0.25, freq: 2500, type: 'bandpass', q: 1.5 }); break;
      case 'Electric': this.tone(70, dur, { type: 'sawtooth', vol: 0.15 }); this.noise(dur, { vol: 0.15, freq: 5000, type: 'highpass' }); break;
      case 'Dark': case 'Ghost': this.tone(160, dur, { type: 'sawtooth', vol: 0.15, slide: 0.6 }); break;
      case 'Psychic': this.tone(600, dur, { type: 'sine', vol: 0.15, slide: 1.6 }); break;
      case 'Dragon': this.tone(110, dur, { type: 'sawtooth', vol: 0.2, slide: 1.3 }); this.noise(dur, { vol: 0.15, freq: 900 }); break;
      default: this.tone(long ? 220 : 520, dur, { type: long ? 'sawtooth' : 'square', vol: 0.12, slide: long ? 1.5 : 0.5 });
    }
  }

  playMusic(name) {
    if (!this.ctx) { this.pendingSong = name; return; }
    if (this.song === name) return;
    this.stopMusic();
    this.song = name;
    const song = SONGS[name];
    if (!song) return;
    const step = 60 / song.bpm / 2;
    let i = 0;
    let next = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => {
      while (next < this.ctx.currentTime + 0.2) {
        const b = song.bass[i % song.bass.length];
        const l = song.lead[i % song.lead.length];
        const d = song.drums[i % song.drums.length];
        const delay = next - this.ctx.currentTime;
        if (b) this.tone(NOTE(b), step * 0.9, { type: 'triangle', vol: 0.35, delay, out: this.music });
        if (l) this.tone(NOTE(l), step * 0.8, { type: 'square', vol: 0.09, delay, out: this.music });
        if (d === 'k') this.tone(120, 0.1, { type: 'sine', vol: 0.4, slide: 0.4, delay, out: this.music });
        if (d === 's') this.noise(0.08, { vol: 0.18, freq: 2500, type: 'bandpass', delay, out: this.music });
        if (d === 'h') this.noise(0.03, { vol: 0.08, freq: 8000, type: 'highpass', delay, out: this.music });
        i++;
        next += step;
      }
    }, 25);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.song = null;
  }
}
