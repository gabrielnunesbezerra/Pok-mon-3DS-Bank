// Sons sintetizados (Web Audio): sem arquivos de áudio. A música entra na fase 3.
let ctx = null;
let mudo = false;
let volumen = 0.5;

export function iniciar() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
}
export function silenciar(v) { mudo = v; }
export const estaMudo = () => mudo;

function tono(f0, f1, dur, tipo = 'square', vol = 0.12, retraso = 0) {
  if (!ctx || mudo) return;
  const t = ctx.currentTime + retraso;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol * volumen * 2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function ruido(dur, vol = 0.15, filtro = 1800) {
  if (!ctx || mudo) return;
  const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = b; f.type = 'lowpass'; f.frequency.value = filtro;
  g.gain.value = vol * volumen * 2;
  s.connect(f).connect(g).connect(ctx.destination);
  s.start();
}

const SONIDOS = {
  seleccion: () => tono(660, 760, 0.05, 'square', 0.08),
  confirmar: () => { tono(520, 700, 0.07, 'square', 0.1); tono(780, 1000, 0.09, 'square', 0.1, 0.06); },
  atras: () => tono(520, 330, 0.09, 'square', 0.09),
  golpe: () => { ruido(0.08, 0.2, 2400); tono(220, 90, 0.08, 'square', 0.12); },
  golpeFuerte: () => { ruido(0.16, 0.3, 1500); tono(160, 50, 0.16, 'sawtooth', 0.16); },
  miss: () => tono(420, 260, 0.06, 'triangle', 0.06),
  clash: () => { tono(900, 600, 0.08, 'square', 0.1); ruido(0.06, 0.12, 4000); },
  disparo: () => tono(500, 900, 0.1, 'square', 0.08),
  dash: () => ruido(0.14, 0.14, 3000),
  cuenta: () => tono(440, 440, 0.12, 'square', 0.12),
  fight: () => { tono(660, 660, 0.12, 'square', 0.14); tono(990, 990, 0.2, 'square', 0.14, 0.1); },
  ko: () => { tono(300, 40, 0.5, 'sawtooth', 0.18); ruido(0.3, 0.2, 800); },
  victoria: () => [523, 659, 784, 1047].forEach((f, i) => tono(f, f, 0.16, 'square', 0.12, i * 0.12)),
  derrota: () => [392, 330, 262, 196].forEach((f, i) => tono(f, f * 0.95, 0.22, 'triangle', 0.12, i * 0.18)),
  evoCarga: () => { tono(220, 900, 1.0, 'sawtooth', 0.07); tono(330, 1320, 1.0, 'square', 0.04, 0.05); },
  evolucion: () => [392, 494, 587, 784, 988].forEach((f, i) => tono(f, f, 0.14, 'square', 0.1, i * 0.08)),
  surge: () => tono(300, 1200, 0.3, 'sawtooth', 0.1),
  estado: () => tono(800, 500, 0.12, 'triangle', 0.1),
  cura: () => { tono(600, 900, 0.1, 'sine', 0.1); tono(900, 1200, 0.12, 'sine', 0.1, 0.08); },
  explosion: () => { ruido(0.4, 0.3, 700); tono(120, 30, 0.4, 'sawtooth', 0.15); },
};
export function sfx(nombre) { SONIDOS[nombre]?.(); }

// ---------------------------------------------------------------- música sintetizada (duas vozes + baixo)
let musica = null;
let musicaOn = true;
export const musicaActiva = () => musicaOn;
export function activarMusica(v) { musicaOn = v; if (!v) pararMusica(); }

const NOTA = n => 440 * 2 ** ((n - 69) / 12);
const TEMAS = {
  menu: { bpm: 104, melodia: [72, 0, 76, 79, 76, 0, 74, 0, 72, 0, 69, 72, 71, 0, 67, 0, 69, 0, 72, 76, 74, 0, 71, 0, 72, 74, 76, 0, 79, 0, 76, 0], bajo: [48, 55, 52, 55, 45, 52, 48, 52, 41, 48, 45, 48, 43, 50, 47, 50], tipo: 'triangle' },
  combate: { bpm: 148, melodia: [76, 76, 0, 79, 76, 0, 74, 76, 72, 72, 0, 76, 72, 0, 71, 72, 69, 69, 0, 72, 69, 0, 67, 69, 71, 74, 71, 67, 71, 74, 76, 0], bajo: [40, 40, 47, 40, 36, 36, 43, 36, 33, 33, 40, 33, 35, 35, 42, 35], tipo: 'square' },
};
export function tocarMusica(nombre) {
  pararMusica();
  if (!musicaOn || !ctx || !TEMAS[nombre]) return;
  const tema = TEMAS[nombre];
  const paso = 60 / tema.bpm / 2;
  let i = 0, proximo = ctx.currentTime + 0.1;
  const nota = (f, t, dur, tipo, vol) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * volumen, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  };
  const timer = setInterval(() => {
    if (!ctx || mudo) { proximo = ctx ? ctx.currentTime + 0.1 : 0; return; }
    while (proximo < ctx.currentTime + 0.4) {
      const m = tema.melodia[i % tema.melodia.length], b = tema.bajo[Math.floor(i / 2) % tema.bajo.length];
      if (m) nota(NOTA(m), proximo, paso * 0.9, tema.tipo, 0.05);
      if (i % 2 === 0) nota(NOTA(b), proximo, paso * 1.8, 'triangle', 0.09);
      proximo += paso; i++;
    }
  }, 100);
  musica = { nombre, timer };
}
export function pararMusica() { if (musica) { clearInterval(musica.timer); musica = null; } }
export const musicaActual = () => musica?.nombre ?? null;
