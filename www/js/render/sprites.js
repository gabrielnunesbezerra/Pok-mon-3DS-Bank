// Sprites do PMD SpriteCollab: carrega o manifesto, baixa as folhas de cada forma quando precisa e
// desenha o quadro certo para a animação, a direção (8 linhas) e o tempo.
import { ROSTER } from '../data/pokemon.js';

// ângulo (0 = leste, y para baixo) -> linha da folha do PMD (0 = baixo, 2 = direita, 4 = cima, 6 = esquerda)
const OCTANTE_A_FILA = [2, 1, 0, 7, 6, 5, 4, 3];
export function filaDesdeAngulo(a) {
  if (!Number.isFinite(a)) return 0;
  return OCTANTE_A_FILA[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

const SUSTITUTA = {
  Sleep: 'Idle', Strike: 'Attack', Swing: 'Attack', Shoot: 'Attack', Pose: 'Charge', Withdraw: 'Charge', Rotate: 'Walk', Hop: 'Walk',
  Faint: 'Hurt', Charge: 'Idle', Attack: 'Idle', Double: 'Attack', Kick: 'Attack', Punch: 'Attack', Jab: 'Attack', MultiStrike: 'Attack',
  QuickStrike: 'Attack', SpAttack: 'Attack', Special0: 'Attack',
};

export class SpriteBank {
  constructor() {
    this.manifiesto = {};
    this.hojas = new Map(); // "dex/anim" -> Image
    this.retratos = new Map();
    this.pendientes = new Map();
  }

  async cargar() {
    this.manifiesto = await (await fetch('assets/pmd/manifest.json')).json();
  }

  tiene(dex) { return !!this.manifiesto[dex]; }
  medidas(dex) { return this.manifiesto[dex] || { feet: 5, head: -16, width: 18, anims: {} }; }

  // pede a folha (devolve a imagem quando já chegou)
  hoja(dex, nombre) {
    const a = this.manifiesto[dex]?.anims[nombre];
    if (!a) return null;
    const k = `${dex}/${a.file}`;
    let img = this.hojas.get(k);
    if (!img) {
      img = new Image();
      img.src = `assets/pmd/${a.file}`;
      this.hojas.set(k, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  // garante que as animações pedidas estão sendo baixadas
  precargar(dex, nombres = ['Idle', 'Walk']) { for (const n of nombres) this.hoja(dex, this.resolver(dex, n)); }

  retrato(dex) {
    let img = this.retratos.get(dex);
    if (!img) { img = new Image(); img.src = `assets/pmd/${dex}/portrait.png`; this.retratos.set(dex, img); }
    return img.complete && img.naturalWidth ? img : null;
  }

  tieneAnim(dex, n) { return !!this.manifiesto[dex]?.anims[n]; }
  resolver(dex, n) {
    for (let i = 0; i < 4 && !this.tieneAnim(dex, n); i++) n = SUSTITUTA[n] || 'Idle';
    return this.tieneAnim(dex, n) ? n : 'Idle';
  }

  // Quadro da animação no tempo t (segundos). Duração dos quadros em 1/60 s, como nos jogos.
  quadro(dex, nombre, t, bucle = true) {
    const a = this.manifiesto[dex]?.anims[nombre];
    if (!a) return 0;
    const total = a.durations.reduce((s, d) => s + d, 0);
    let tick = Math.floor(t * 60);
    if (bucle) tick %= total; else if (tick >= total) return a.durations.length - 1;
    for (let i = 0; i < a.durations.length; i++) { tick -= a.durations[i]; if (tick < 0) return i; }
    return a.durations.length - 1;
  }

  // Desenha com os pés em (x, y). opts: fila, bucle, alpha, flash (0..1), espejo
  dibujar(g, dex, nombre, t, x, y, escala = 1, opts = {}) {
    nombre = this.resolver(dex, nombre);
    const a = this.manifiesto[dex]?.anims[nombre];
    const img = a && this.hoja(dex, nombre);
    if (!img) return false;
    const filas = Math.max(1, Math.round(img.naturalHeight / a.fh));
    const fila = filas === 8 ? (opts.fila ?? 0) : 0;
    const q = this.quadro(dex, nombre, t, opts.bucle ?? (nombre === 'Idle' || nombre === 'Walk'));
    const m = this.medidas(dex);
    const dw = a.fw * escala, dh = a.fh * escala;
    const dx = Math.round(x - dw / 2), dy = Math.round(y - (m.feet ?? 5) * escala - dh / 2);
    g.save();
    if (opts.alpha !== undefined) g.globalAlpha *= opts.alpha;
    g.drawImage(img, q * a.fw, fila * a.fh, a.fw, a.fh, dx, dy, dw, dh);
    if (opts.flash) {
      const f = this.blanco(dex, nombre, img);
      g.globalAlpha *= opts.flash;
      g.drawImage(f, q * a.fw, fila * a.fh, a.fw, a.fh, dx, dy, dw, dh);
    }
    g.restore();
    return true;
  }

  // silhueta branca da folha (para o piscar de dano)
  blanco(dex, nombre, img) {
    const k = `b:${dex}/${nombre}`;
    let c = this.hojas.get(k);
    if (!c) {
      c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      this.hojas.set(k, c);
    }
    return c;
  }
}

// Todas as formas de uma linha: [base, evoluções..., megas]
export function formasDe(def) {
  const fs = [def, ...(def.evoluciones ?? [])];
  return fs.flatMap(f => (f.mega ? [f, { ...f.mega, esMega: true }] : [f]));
}

// Formas finais de cada linha (para os desfiles do menu)
export const FINALES = ROSTER.map(p => (p.evoluciones?.at(-1) ?? p));
export const TODAS_LAS_FORMAS = ROSTER.flatMap(p => [p, ...(p.evoluciones ?? [])]);
