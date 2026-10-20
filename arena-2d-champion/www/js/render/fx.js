// Partículas (com brilho aditivo, fumaça e faíscas), textos flutuantes, tremida de tela, clarões
// e marcas no chão que somem devagar.
import { TYPE_COLOR } from '../data/dex.js';

const PALETTE = {
  Fire: ['#fff6b0', '#ffc23b', '#ff7a1f', '#e8361c'],
  Water: ['#f0fbff', '#9fdcff', '#4aa3f0', '#2f6fd0'],
  Grass: ['#e4ffb0', '#8be04e', '#4caf38', '#2e7d32'],
  Electric: ['#ffffff', '#fff7a0', '#ffd400', '#e0a800'],
  Ice: ['#ffffff', '#e0f8ff', '#9ee7f5', '#5cc6e0'],
  Fighting: ['#fff1c9', '#ffb36b', '#e0623a', '#a93226'],
  Poison: ['#f6d8ff', '#c27ae0', '#9b3fbf', '#6a1b8a'],
  Ground: ['#f4dfa3', '#d9b366', '#b08a46', '#7a5a2a'],
  Flying: ['#ffffff', '#eeeaff', '#c6bdfa', '#a395ee'],
  Psychic: ['#ffe8f3', '#ff9cc8', '#f95587', '#c2185b'],
  Bug: ['#f3ffb0', '#c8db4a', '#a6b91a', '#6f7c10'],
  Rock: ['#efe4bc', '#c9b469', '#a68c3a', '#6e5a22'],
  Ghost: ['#ece0ff', '#b39bea', '#735797', '#3e2c5e'],
  Dragon: ['#e2d8ff', '#a588ff', '#6f35fc', '#3a17a8'],
  Dark: ['#d8c8bb', '#8a6f5c', '#5a4636', '#2a201a'],
  Steel: ['#ffffff', '#e4e4f2', '#b7b7ce', '#7c7c99'],
  Fairy: ['#fff4fa', '#ffc8e4', '#ee8cc2', '#c2588f'],
  Normal: ['#ffffff', '#f2f1de', '#c9c7a5', '#a8a77a'],
};
export const palette = type => PALETTE[type] || PALETTE.Normal;

const GLOW_TYPES = new Set(['Fire', 'Electric', 'Psychic', 'Fairy', 'Dragon', 'Ghost', 'Ice']);

export class Fx {
  constructor() {
    this.parts = [];
    this.texts = [];
    this.labels = [];
    this.decals = [];
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#fff';
  }

  add(p) {
    if (this.parts.length > 1400) this.parts.splice(0, 100);
    this.parts.push({ vx: 0, vy: 0, g: 0, size: 3, grow: 0, life: 0.5, t: 0, shape: 'sq', drag: 0, rot: Math.random() * 6, vr: 0, blend: null, ...p });
  }

  burst(x, y, type, n = 12, speed = 160, opts = {}) {
    const pal = palette(type);
    const glow = GLOW_TYPES.has(type);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.8);
      this.add({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.75 - (opts.up || 0), g: opts.g ?? 140, drag: 2.5,
        size: (opts.size || 3.5) * (0.6 + Math.random() * 0.8), life: (opts.life || 0.5) * (0.6 + Math.random() * 0.8),
        color: pal[Math.floor(Math.random() * pal.length)], shape: shapeFor(type), blend: glow ? 'lighter' : null, vr: (Math.random() - 0.5) * 12,
      });
    }
  }

  // anel de faíscas rápidas (impacto)
  sparks(x, y, color, n = 10, speed = 420) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.5 + Math.random() * 0.6);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 6, size: 2.5, life: 0.22 + Math.random() * 0.12, color, shape: 'streak', blend: 'lighter' });
    }
  }

  smoke(x, y, n = 6, color = 'rgba(70,70,80,0.5)', size = 14) {
    for (let i = 0; i < n; i++) {
      this.add({ x: x + (Math.random() - 0.5) * size, y: y + (Math.random() - 0.5) * size * 0.5, vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 40, drag: 1.5, size: size * (0.6 + Math.random() * 0.6), grow: size * 1.5, life: 0.9 + Math.random() * 0.6, color, shape: 'circle' });
    }
  }

  glow(x, y, color, size, life = 0.3) {
    this.add({ x, y, size, life, color, shape: 'glow', blend: 'lighter', grow: size * 2 });
  }

  trail(x, y, type, spread = 6, size = 3) {
    const pal = palette(type);
    this.add({
      x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread,
      vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30 - 10, life: 0.25 + Math.random() * 0.25,
      size: size * (0.6 + Math.random() * 0.8), color: pal[Math.floor(Math.random() * pal.length)], shape: shapeFor(type), drag: 1,
      blend: GLOW_TYPES.has(type) ? 'lighter' : null, vr: (Math.random() - 0.5) * 10,
    });
  }

  // marcas no chão: queimado, poça, rachadura, gelo, gosma
  decal(x, y, kind, r = 30, life = 7) {
    if (this.decals.length > 70) this.decals.shift();
    const seed = Math.random() * 1000;
    this.decals.push({ x, y, kind, r, t: 0, life, seed, rot: Math.random() * Math.PI });
  }

  float(x, y, text, color, big = 0) {
    this.texts.push({ x, y, text, color, big, t: 0, life: big ? 1.1 : 0.85, vx: (Math.random() - 0.5) * 24 });
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
      p.size += p.grow * dt;
    }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const t of this.texts) { t.t += dt; t.y -= (t.big ? 36 : 54) * dt; t.x += t.vx * dt; }
    this.texts = this.texts.filter(t => t.t < t.life);
    for (const l of this.labels) l.t += dt;
    this.labels = this.labels.filter(l => l.t < l.life);
    for (const d of this.decals) d.t += dt;
    this.decals = this.decals.filter(d => d.t < d.life);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 3);
  }

  drawDecals(g) {
    for (const d of this.decals) {
      const a = Math.min(1, (d.life - d.t) / 1.5) * Math.min(1, d.t / 0.1);
      g.save();
      g.translate(d.x, d.y);
      g.rotate(d.rot);
      g.globalAlpha = a;
      switch (d.kind) {
        case 'scorch': {
          const gr = g.createRadialGradient(0, 0, 2, 0, 0, d.r);
          gr.addColorStop(0, 'rgba(30,18,10,0.75)');
          gr.addColorStop(0.7, 'rgba(50,30,15,0.45)');
          gr.addColorStop(1, 'rgba(50,30,15,0)');
          g.fillStyle = gr;
          g.beginPath(); g.ellipse(0, 0, d.r, d.r * 0.7, 0, 0, Math.PI * 2); g.fill();
          break;
        }
        case 'puddle': {
          g.fillStyle = 'rgba(90,160,230,0.42)';
          g.beginPath(); g.ellipse(0, 0, d.r, d.r * 0.6, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(220,240,255,0.35)';
          g.beginPath(); g.ellipse(-d.r * 0.3, -d.r * 0.15, d.r * 0.3, d.r * 0.12, 0, 0, Math.PI * 2); g.fill();
          break;
        }
        case 'frost': {
          g.fillStyle = 'rgba(225,245,255,0.6)';
          g.beginPath(); g.ellipse(0, 0, d.r, d.r * 0.65, 0, 0, Math.PI * 2); g.fill();
          g.strokeStyle = 'rgba(160,220,245,0.9)';
          g.lineWidth = 1.5;
          for (let i = 0; i < 6; i++) { const ang = (i / 6) * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(ang) * d.r * 0.9, Math.sin(ang) * d.r * 0.6); g.stroke(); }
          break;
        }
        case 'slime': {
          g.fillStyle = 'rgba(140,60,170,0.5)';
          g.beginPath(); g.ellipse(0, 0, d.r, d.r * 0.6, 0, 0, Math.PI * 2); g.fill();
          break;
        }
        case 'crack': {
          g.strokeStyle = 'rgba(60,40,20,0.8)';
          g.lineWidth = 3;
          let s = d.seed;
          const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
          for (let i = 0; i < 5; i++) {
            let ang = (i / 5) * Math.PI * 2 + rnd();
            let px = 0, py = 0;
            g.beginPath(); g.moveTo(0, 0);
            for (let k = 0; k < 4; k++) { ang += (rnd() - 0.5) * 0.9; px += Math.cos(ang) * d.r * 0.3; py += Math.sin(ang) * d.r * 0.2; g.lineTo(px, py); }
            g.stroke();
          }
          g.fillStyle = 'rgba(70,50,25,0.35)';
          g.beginPath(); g.ellipse(0, 0, d.r * 0.35, d.r * 0.2, 0, 0, Math.PI * 2); g.fill();
          break;
        }
        case 'leaves': {
          g.fillStyle = 'rgba(70,160,50,0.8)';
          let s = d.seed;
          const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
          for (let i = 0; i < 7; i++) g.fillRect((rnd() - 0.5) * d.r * 2, (rnd() - 0.5) * d.r, 6, 3);
          break;
        }
      }
      g.restore();
    }
  }

  draw(g) {
    for (const p of this.parts) {
      const a = 1 - p.t / p.life;
      g.globalAlpha = Math.max(0, a);
      g.globalCompositeOperation = p.blend || 'source-over';
      g.fillStyle = p.color;
      const s = Math.max(0.5, p.size);
      switch (p.shape) {
        case 'circle': g.beginPath(); g.arc(p.x, p.y, s, 0, Math.PI * 2); g.fill(); break;
        case 'bubble': g.strokeStyle = p.color; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, s, 0, Math.PI * 2); g.stroke(); break;
        case 'ring': g.strokeStyle = p.color; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, s * (1 + p.t * 4), 0, Math.PI * 2); g.stroke(); break;
        case 'leaf': g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath(); g.ellipse(0, 0, s * 1.4, s * 0.6, 0, 0, Math.PI * 2); g.fill(); g.restore(); break;
        case 'spark': g.fillRect(p.x - s / 2, p.y - s * 1.6, s, s * 3.2); g.fillRect(p.x - s * 1.6, p.y - s / 2, s * 3.2, s); break;
        case 'streak': {
          g.strokeStyle = p.color; g.lineWidth = s;
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); g.stroke();
          break;
        }
        case 'glow': {
          const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
          gr.addColorStop(0, p.color);
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr;
          g.fillRect(p.x - s, p.y - s, s * 2, s * 2);
          break;
        }
        case 'flake': g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-s, -0.6, s * 2, 1.2); g.fillRect(-0.6, -s, 1.2, s * 2); g.restore(); break;
        default: g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-s / 2, -s / 2, s, s); g.restore();
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
}

function shapeFor(type) {
  if (type === 'Water') return Math.random() < 0.4 ? 'bubble' : 'circle';
  if (type === 'Grass' || type === 'Bug') return 'leaf';
  if (type === 'Ice') return Math.random() < 0.5 ? 'flake' : 'sq';
  if (type === 'Electric' || type === 'Fairy' || type === 'Steel') return 'spark';
  if (type === 'Psychic') return Math.random() < 0.3 ? 'ring' : 'circle';
  if (type === 'Fire' || type === 'Poison' || type === 'Ghost' || type === 'Dragon') return 'circle';
  return 'sq';
}

export { TYPE_COLOR };
