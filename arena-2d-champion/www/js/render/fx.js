// Partículas (com brilho aditivo, fumaça e faíscas), textos flutuantes, tremida de tela, clarões
// e marcas no chão que somem devagar. As partículas "com altura" (gotas, pedras, brasas, folhas)
// voam em arco, quicam e respingam ao cair, com sombra no chão.
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
    this.ph = []; // partículas com altura (z) e gravidade
    this.ripples = [];
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

  // ---------------------------------------------------------------- partículas com altura
  // kind: drop (água: respinga ao cair), rock (quica), shard (gelo: quica e brilha), ember (sobe),
  // leaf (cai balançando), goo (veneno: respinga roxo), spark (faísca que quica), dust (nuvem)
  phys(p) {
    if (this.ph.length > 700) this.ph.splice(0, 60);
    this.ph.push({ vx: 0, vy: 0, vz: 0, z: 0, g: 900, size: 3, life: 1.6, t: 0, bounce: 0, landed: 0, ...p });
  }

  ripple(x, y, r0, r1, color = '#cfeeff', life = 0.45) {
    if (this.ripples.length > 120) this.ripples.shift();
    this.ripples.push({ x, y, r0, r1, color, life, t: 0 });
  }

  // Respingo de água: gotas sobem em arco, caem e fazem anéis no chão
  splash(x, y, power = 1, dir = null) {
    const pal = PALETTE.Water;
    const n = Math.round(10 + 16 * power);
    for (let i = 0; i < n; i++) {
      const a = dir === null ? Math.random() * Math.PI * 2 : dir + (Math.random() - 0.5) * 2.2;
      const sp = (60 + Math.random() * 200) * (0.7 + power * 0.5);
      this.phys({ kind: 'drop', x, y, z: 6 + Math.random() * 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 160 + Math.random() * 260 * (0.6 + power * 0.6), size: 2 + Math.random() * 2.5 * power, color: pal[Math.floor(Math.random() * 3)] });
    }
    this.ripple(x, y, 6, 30 + 30 * power, '#d8f2ff', 0.5);
    this.ripple(x, y, 2, 18 + 18 * power, '#9fdcff', 0.4);
  }

  // Pedaços que voam e quicam (pedra, terra, gelo, metal)
  debris(x, y, type, n = 10, power = 1) {
    const pal = palette(type);
    const kind = type === 'Ice' ? 'shard' : type === 'Steel' || type === 'Electric' ? 'spark' : 'rock';
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (50 + Math.random() * 190) * (0.7 + power * 0.4);
      this.phys({
        kind, x, y, z: 4 + Math.random() * 18, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 120 + Math.random() * 260 * power,
        size: kind === 'spark' ? 1.6 + Math.random() : 2.5 + Math.random() * 4 * Math.min(1.5, power), color: pal[1 + Math.floor(Math.random() * 3)],
        bounce: kind === 'spark' ? 0.55 : 0.38, life: kind === 'spark' ? 0.7 : 1.5 + Math.random() * 0.6, rot: Math.random() * 6,
      });
    }
  }

  // Brasas que sobem e piscam
  embers(x, y, n = 10, spread = 30) {
    for (let i = 0; i < n; i++) {
      this.phys({ kind: 'ember', x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread * 0.4, z: 4 + Math.random() * 30, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 20, vz: 40 + Math.random() * 90, g: -60, size: 1.6 + Math.random() * 2, life: 0.7 + Math.random() * 0.8, color: palette('Fire')[Math.floor(Math.random() * 3)] });
    }
  }

  // Folhas que caem balançando
  leaves(x, y, n = 8, power = 1) {
    const pal = palette('Grass');
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 140 * power;
      this.phys({ kind: 'leaf', x, y, z: 20 + Math.random() * 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: 80 + Math.random() * 160, g: 260, size: 2.5 + Math.random() * 2, life: 1.6 + Math.random(), color: pal[1 + Math.floor(Math.random() * 3)], ph: Math.random() * 6 });
    }
  }

  // Poeira no chão (passos, dash, aterrissagem)
  dust(x, y, n = 3, size = 6, dir = null, color = 'rgba(214,200,160,0.55)') {
    for (let i = 0; i < n; i++) {
      const a = dir === null ? Math.random() * Math.PI * 2 : dir + Math.PI + (Math.random() - 0.5) * 1.4;
      const sp = 20 + Math.random() * 60;
      this.phys({ kind: 'dust', x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 4, z: 1 + Math.random() * 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: 10 + Math.random() * 30, g: 30, size: size * (0.6 + Math.random() * 0.6), grow: size * 1.4, life: 0.35 + Math.random() * 0.3, color });
    }
  }

  // Impacto de cada tipo com partículas físicas (power ~ 0.5 fraco, 1 normal, 2 enorme)
  kit(x, y, type, power = 1, dir = null) {
    switch (type) {
      case 'Water': this.splash(x, y, power, dir); break;
      case 'Fire': this.embers(x, y, Math.round(8 + 12 * power), 30 * power); this.smoke(x, y - 10, Math.round(2 + 3 * power), 'rgba(60,50,50,0.45)', 12 + 8 * power); break;
      case 'Rock': case 'Ground': this.debris(x, y, type, Math.round(6 + 10 * power), power); this.dust(x, y, Math.round(3 + 5 * power), 10 + 6 * power); break;
      case 'Ice': this.debris(x, y, 'Ice', Math.round(6 + 10 * power), power); break;
      case 'Steel': case 'Electric': this.debris(x, y, type, Math.round(6 + 8 * power), power); break;
      case 'Grass': case 'Bug': this.leaves(x, y, Math.round(4 + 8 * power), power); break;
      case 'Poison': {
        for (let i = 0; i < 6 + 8 * power; i++) {
          const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 150;
          this.phys({ kind: 'goo', x, y, z: 8 + Math.random() * 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 120 + Math.random() * 200, size: 2.5 + Math.random() * 2.5, color: palette('Poison')[1 + Math.floor(Math.random() * 3)] });
        }
        break;
      }
      case 'Fighting': case 'Normal': case 'Flying': case 'Dark': this.dust(x, y, Math.round(3 + 4 * power), 8 + 6 * power, dir); break;
      default: break;
    }
  }

  updatePhys(dt) {
    for (const p of this.ph) {
      p.t += dt;
      p.vz -= p.g * dt;
      p.z += p.vz * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.grow) p.size += p.grow * dt;
      if (p.kind === 'leaf') { p.vx *= Math.exp(-2.5 * dt); p.vy *= Math.exp(-2.5 * dt); p.vz = Math.max(p.vz, -55); p.x += Math.sin(p.t * 6 + p.ph) * 40 * dt; }
      if (p.kind === 'dust') { p.vx *= Math.exp(-4 * dt); p.vy *= Math.exp(-4 * dt); }
      if (p.z <= 0 && p.vz < 0) {
        p.z = 0;
        if (p.kind === 'drop' || p.kind === 'goo') {
          p.dead = true;
          if (p.size > 2.4) {
            for (let i = 0; i < 2; i++) this.phys({ kind: p.kind, x: p.x, y: p.y, z: 0.1, vx: (Math.random() - 0.5) * 70, vy: (Math.random() - 0.5) * 30, vz: 50 + Math.random() * 60, size: 1.4, color: p.color, life: 0.4 });
            this.ripple(p.x, p.y, 1, 6 + p.size * 2.5, p.kind === 'goo' ? '#c27ae0' : '#d8f2ff', 0.35);
          }
        } else if (p.kind === 'leaf') { p.vz = 0; p.g = 0; p.vx = 0; p.vy = 0; p.rest = true; }
        else if (p.bounce && Math.abs(p.vz) > 40) {
          p.vz = -p.vz * p.bounce; p.vx *= 0.6; p.vy *= 0.6; p.landed++;
          if (p.kind === 'rock' && p.landed === 1 && p.size > 4) this.dust(p.x, p.y, 1, p.size * 1.5);
        } else { p.vz = 0; p.vx *= 0.5; p.vy *= 0.5; p.g = 0; p.rest = true; }
      }
    }
    this.ph = this.ph.filter(p => !p.dead && p.t < p.life);
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter(r => r.t < r.life);
  }

  // anéis de água no chão (embaixo dos Pokémon)
  drawRipples(g) {
    g.lineWidth = 2;
    for (const r of this.ripples) {
      const k = r.t / r.life;
      const rad = r.r0 + (r.r1 - r.r0) * Math.sqrt(k);
      g.globalAlpha = 1 - k;
      g.strokeStyle = r.color;
      g.beginPath(); g.ellipse(r.x, r.y, rad, rad * 0.45, 0, 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
  }

  drawPhys(g) {
    // sombras no chão primeiro
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (const p of this.ph) {
      if (p.kind === 'dust' || p.kind === 'ember' || p.z < 2) continue;
      const s = Math.max(1, p.size * (1 - Math.min(0.6, p.z / 200)));
      g.fillRect(p.x - s / 2, p.y - s * 0.25, s, Math.max(1, s * 0.5));
    }
    for (const p of this.ph) {
      const fade = Math.min(1, (p.life - p.t) / 0.25);
      const x = p.x, y = p.y - p.z, s = Math.max(1, p.size);
      g.globalAlpha = fade;
      switch (p.kind) {
        case 'drop': case 'goo':
          g.fillStyle = p.color;
          // esticada na direção da queda
          g.fillRect(x - s / 2, y - s / 2, s, s * (1 + Math.min(1.5, Math.abs(p.vz) / 260)));
          break;
        case 'rock':
          g.save(); g.translate(x, y); g.rotate(Math.round((p.rot + p.t * 6 * (p.rest ? 0 : 1)) / (Math.PI / 4)) * (Math.PI / 4));
          g.fillStyle = p.color; g.fillRect(-s / 2, -s / 2, s, s);
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-s / 2, 0, s, s / 2);
          g.restore();
          break;
        case 'shard':
          g.fillStyle = p.color;
          g.beginPath(); g.moveTo(x, y - s * 1.3); g.lineTo(x + s * 0.6, y); g.lineTo(x, y + s * 0.6); g.lineTo(x - s * 0.6, y); g.closePath(); g.fill();
          if (Math.floor(p.t * 14) % 3 === 0) { g.fillStyle = '#ffffff'; g.fillRect(x - 1, y - s, 2, 2); }
          break;
        case 'spark':
          g.fillStyle = Math.floor(p.t * 20) % 2 ? '#ffffff' : p.color;
          g.fillRect(x - s, y - s / 2, s * 2, s);
          break;
        case 'ember':
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = Math.floor(p.t * 12 + p.x) % 3 ? p.color : '#fff3b0';
          g.fillRect(x - s / 2, y - s / 2, s, s);
          g.globalCompositeOperation = 'source-over';
          break;
        case 'leaf': {
          const flip = Math.sin(p.t * 8 + (p.ph || 0));
          g.fillStyle = p.color;
          g.fillRect(x - s, y - s * 0.35 * Math.abs(flip) - 0.5, s * 2, Math.max(1, s * 0.7 * Math.abs(flip)));
          break;
        }
        case 'dust':
          g.globalAlpha = fade * (1 - p.t / p.life) * 0.9;
          g.fillStyle = p.color;
          g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
          break;
      }
    }
    g.globalAlpha = 1;
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
    this.updatePhys(dt);
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
          // mancha queimada em pixel art: borda clara e miolo escuro, meio torta
          g.fillStyle = 'rgba(90,60,25,0.35)';
          g.beginPath(); g.ellipse(0, 0, d.r, d.r * 0.7, 0, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.ellipse(d.r * 0.35, d.r * 0.1, d.r * 0.6, d.r * 0.45, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(45,28,12,0.55)';
          g.beginPath(); g.ellipse(-d.r * 0.1, 0, d.r * 0.55, d.r * 0.38, 0, 0, Math.PI * 2); g.fill();
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
          // brilho em pixel art: discos chapados um dentro do outro
          for (const [k, al] of [[1, 0.35], [0.66, 0.7], [0.36, 1]]) {
            g.globalAlpha = Math.max(0, a) * al;
            g.beginPath(); g.arc(p.x, p.y, s * k, 0, Math.PI * 2); g.fill();
          }
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
