// Partículas, textos flutuantes, tremida de tela e clarões.
import { TYPE_COLOR } from '../data/dex.js';

const PALETTE = {
  Fire: ['#ffef8a', '#ffb13b', '#ff6a1f', '#e8361c'],
  Water: ['#e6f6ff', '#8fd3ff', '#4aa3f0', '#2f6fd0'],
  Grass: ['#d9ff9a', '#8be04e', '#4caf38', '#2e7d32'],
  Electric: ['#ffffff', '#fff27a', '#ffd400', '#e0a800'],
  Ice: ['#ffffff', '#d8f6ff', '#9ee7f5', '#5cc6e0'],
  Fighting: ['#fff1c9', '#ffb36b', '#e0623a', '#a93226'],
  Poison: ['#f0c8ff', '#c27ae0', '#9b3fbf', '#6a1b8a'],
  Ground: ['#f4dfa3', '#d9b366', '#b08a46', '#7a5a2a'],
  Flying: ['#ffffff', '#e8e4ff', '#c6bdfa', '#a395ee'],
  Psychic: ['#ffe0ef', '#ff9cc8', '#f95587', '#c2185b'],
  Bug: ['#f3ffb0', '#c8db4a', '#a6b91a', '#6f7c10'],
  Rock: ['#e8dcb0', '#c9b469', '#a68c3a', '#6e5a22'],
  Ghost: ['#e2d4ff', '#a98be0', '#735797', '#3e2c5e'],
  Dragon: ['#d9ccff', '#9d7bff', '#6f35fc', '#3a17a8'],
  Dark: ['#cbb9aa', '#8a6f5c', '#5a4636', '#2a201a'],
  Steel: ['#ffffff', '#dcdcec', '#b7b7ce', '#7c7c99'],
  Fairy: ['#fff0f7', '#ffc2e0', '#e88cbd', '#c2588f'],
  Normal: ['#ffffff', '#ecebd8', '#c9c7a5', '#a8a77a'],
};
export const palette = type => PALETTE[type] || PALETTE.Normal;

export class Fx {
  constructor() {
    this.parts = [];
    this.texts = [];
    this.labels = [];
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#fff';
  }

  add(p) {
    if (this.parts.length > 900) this.parts.shift();
    this.parts.push({ vx: 0, vy: 0, g: 0, size: 3, life: 0.5, t: 0, shape: 'sq', drag: 0, rot: 0, vr: 0, ...p });
  }

  burst(x, y, type, n = 12, speed = 160, opts = {}) {
    const pal = palette(type);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.8);
      this.add({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.up || 0), g: opts.g ?? 120, drag: 2.5,
        size: (opts.size || 3) * (0.6 + Math.random() * 0.8), life: (opts.life || 0.45) * (0.6 + Math.random() * 0.8),
        color: pal[Math.floor(Math.random() * pal.length)], shape: shapeFor(type),
      });
    }
  }

  trail(x, y, type, spread = 6, size = 3) {
    const pal = palette(type);
    this.add({
      x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread,
      vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30 - 10, life: 0.25 + Math.random() * 0.2,
      size: size * (0.6 + Math.random() * 0.8), color: pal[Math.floor(Math.random() * pal.length)], shape: shapeFor(type), drag: 1,
    });
  }

  float(x, y, text, color, big = 0) {
    this.texts.push({ x, y, text, color, big, t: 0, life: big ? 1.1 : 0.85, vx: (Math.random() - 0.5) * 20 });
  }

  label(mon, text) {
    this.labels = this.labels.filter(l => l.mon !== mon);
    this.labels.push({ mon, text, t: 0, life: 1.3 });
  }

  update(dt) {
    for (const p of this.parts) {
      p.t += dt;
      p.vy += p.g * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const t of this.texts) { t.t += dt; t.y -= (t.big ? 30 : 45) * dt; t.x += t.vx * dt; }
    this.texts = this.texts.filter(t => t.t < t.life);
    for (const l of this.labels) l.t += dt;
    this.labels = this.labels.filter(l => l.t < l.life);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 3);
  }

  draw(g) {
    for (const p of this.parts) {
      const a = 1 - p.t / p.life;
      g.globalAlpha = Math.max(0, a);
      g.fillStyle = p.color;
      const s = p.size * (p.shape === 'ring' ? 1 + p.t * 4 : 1);
      if (p.shape === 'circle' || p.shape === 'bubble') {
        g.beginPath(); g.arc(p.x, p.y, s, 0, Math.PI * 2);
        if (p.shape === 'bubble') { g.strokeStyle = p.color; g.lineWidth = 1; g.stroke(); } else g.fill();
      } else if (p.shape === 'ring') {
        g.strokeStyle = p.color; g.lineWidth = 2;
        g.beginPath(); g.arc(p.x, p.y, s, 0, Math.PI * 2); g.stroke();
      } else if (p.shape === 'leaf') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.t * 8 + p.x);
        g.fillRect(-s, -s / 2, s * 2, s); g.restore();
      } else if (p.shape === 'spark') {
        g.fillRect(p.x - s / 2, p.y - s * 1.5, s, s * 3);
        g.fillRect(p.x - s * 1.5, p.y - s / 2, s * 3, s);
      } else {
        g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.ceil(s), Math.ceil(s));
      }
    }
    g.globalAlpha = 1;
  }
}

function shapeFor(type) {
  if (type === 'Water') return Math.random() < 0.4 ? 'bubble' : 'circle';
  if (type === 'Grass' || type === 'Bug') return 'leaf';
  if (type === 'Electric' || type === 'Fairy' || type === 'Steel') return 'spark';
  if (type === 'Psychic') return Math.random() < 0.3 ? 'ring' : 'circle';
  if (type === 'Fire' || type === 'Poison' || type === 'Ghost' || type === 'Dragon') return 'circle';
  return 'sq';
}

export { TYPE_COLOR };
