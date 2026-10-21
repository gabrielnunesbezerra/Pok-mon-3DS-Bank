// Efeitos visuais em pixel art: partículas, anéis, golpes de corte, números de dano, avisos no chão
// e o desenho das entidades da arena (projéteis, raios, cones, fumaça...). Tudo em coordenadas do mundo.
import { TIPOS } from '../data/regras.js';
import { hex } from '../config.js';
import { aleatorio as azar } from '../engine/util.js';
import { sfx } from '../audio.js';

const ale = () => Math.random();
const entre = (a, b) => a + ale() * (b - a);

export function mezcla(c, k) {
  // k > 0 clareia, k < 0 escurece
  const n = parseInt(c.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = k > 0 ? 255 : 0, a = Math.abs(k);
  r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); b = Math.round(b + (t - b) * a);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
export const colorTipo = t => hex(TIPOS[t] ?? 0xffffff);
export const paleta = t => { const c = colorTipo(t); return [mezcla(c, 0.7), mezcla(c, 0.35), c, mezcla(c, -0.35)]; };
const BRILLA = new Set(['FIRE', 'ELECTRIC', 'PSYCHIC', 'FAIRY', 'DRAGON', 'GHOST', 'ICE']);

export class Efectos {
  constructor() {
    this.parts = []; this.anillos = []; this.tajos = []; this.textos = []; this.nums = []; this.globos = []; this.cortes = [];
    this.temblor = 0; this.flash = 0; this.flashColor = '#fff';
    this.anuncios = [];
    this.ondas = [];
  }

  add(p) { if (this.parts.length > 900) this.parts.splice(0, 80); this.parts.push({ vx: 0, vy: 0, g: 0, size: 2, life: 0.5, t: 0, drag: 0, grow: 0, forma: 'sq', rot: ale() * 6, vr: 0, ...p }); }

  rafaga(x, y, tipo, n = 10, vel = 120, op = {}) {
    const pal = paleta(tipo);
    for (let i = 0; i < n; i++) {
      const a = ale() * Math.PI * 2, s = vel * (0.3 + ale() * 0.8);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7 - (op.arriba ?? 0), g: op.g ?? 120, drag: 2.5, size: (op.size ?? 2.5) * (0.6 + ale() * 0.8), life: (op.life ?? 0.45) * (0.6 + ale() * 0.8), color: pal[Math.floor(ale() * pal.length)], forma: formaDe(tipo) });
    }
  }
  chispas(x, y, color = '#ffffff', n = 8, vel = 300) {
    for (let i = 0; i < n; i++) {
      const a = ale() * Math.PI * 2, s = vel * (0.5 + ale() * 0.6);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 6, size: 1.6, life: 0.2 + ale() * 0.12, color, forma: 'raya' });
    }
  }
  humo(x, y, n = 5, color = 'rgba(190,190,200,0.45)', size = 8) {
    for (let i = 0; i < n; i++) this.add({ x: x + (ale() - 0.5) * size, y: y + (ale() - 0.5) * size * 0.4, vx: (ale() - 0.5) * 30, vy: -14 - ale() * 22, drag: 1.4, size: size * (0.6 + ale() * 0.5), grow: size * 1.2, life: 0.7 + ale() * 0.5, color, forma: 'circulo' });
  }
  polvo(x, y, n = 3, size = 4) { this.humo(x, y, n, 'rgba(214,200,160,0.5)', size); }
  anillo(x, y, r0, r1, color = '#ffffff', dur = 0.35, w = 2) { this.anillos.push({ x, y, r0, r1, color, dur, t: 0, w }); }
  texto(x, y, txt, color = '#ffffff', op = {}) { this.textos.push({ x, y, txt, color, t: 0, life: op.dur ?? 0.9, vy: -(op.sube ?? 22), tam: op.tam ?? 8 }); }
  numero(x, y, dano, mult) { this.nums.push({ x: x + (ale() - 0.5) * 10, y, dano, mult, t: 0, life: 0.8 }); }
  globo(l, txt) { this.globos = this.globos.filter(b => b.l !== l); this.globos.push({ l, txt, t: 0, life: 1.1 }); }
  tajo(x, y, ang, r, color, final, estilo) { this.tajos.push({ x, y, ang, r, color, final, estilo, t: 0, life: final ? 0.22 : 0.16 }); }
  onda(x, y, ang, alcance, anguloDeg, tipo) { this.ondas.push({ x, y, ang, alcance, ang2: (anguloDeg * Math.PI) / 360, tipo, t: 0, life: 0.45 }); }
  anuncio(txt, op = {}) { this.anuncios = this.anuncios.filter(a => a.quien !== op.quien || op.quien === undefined); this.anuncios.push({ txt, color: op.color ?? '#ffffff', tam: op.tam ?? 16, dur: op.dur ?? 0.8, t: 0, quien: op.quien }); }

  // ---------------------------------------------------------------- eventos do motor
  consumir(luta, evs, camara) {
    for (const e of evs) {
      switch (e.t) {
        case 'texto': this.texto(e.x, e.y, e.txt, e.color, { dur: 0.95 }); break;
        case 'numero': this.numero(e.x, e.y, e.dano, e.mult); break;
        case 'impacto': this.impacto(e); break;
        case 'anillo': this.anillo(e.x, e.y, 4, e.r ?? 22, e.color, 0.35); break;
        case 'explosion':
          this.rafaga(e.x, e.y, e.tipo, 18, 200, { size: 3, life: 0.55 });
          this.anillo(e.x, e.y, 4, e.radio, colorTipo(e.tipo), 0.3, 2);
          if (e.humo) this.humo(e.x, e.y, 6, 'rgba(230,230,240,0.55)', 10); else this.humo(e.x, e.y, 3, 'rgba(120,110,110,0.4)', 12);
          break;
        case 'area': this.anillo(e.x, e.y, 2, e.radio, colorTipo(e.tipo), 0.22, 2); break;
        case 'pulso':
          this.anillo(e.x, e.y, 6, e.radio, colorTipo(e.tipo), 0.4, 3);
          this.anillo(e.x, e.y, 2, e.radio * 0.7, '#ffffff', 0.3, 1);
          this.rafaga(e.x, e.y, e.tipo, 14, 160);
          if (e.estilo === 'tierra' || e.estilo === 'aterrizaje') { this.polvo(e.x, e.y, 6, 8); this.debris(e.x, e.y, 'ROCK', 8); }
          break;
        case 'tajo': this.tajo(e.l.x + Math.cos(e.ang) * 6, e.l.y - e.l.alto * 0.5 + Math.sin(e.ang) * 4, e.ang, e.alcance, colorTipo(e.tipo), e.final, e.estilo); if (e.final) this.chispas(e.l.x + Math.cos(e.ang) * e.alcance * 0.8, e.l.y - e.l.alto * 0.4, '#fff', 4, 200); break;
        case 'viento': this.onda(e.x, e.y, e.ang, e.alcance, e.angulo, e.tipo); break;
        case 'raices': for (let i = -3; i <= 3; i++) { const a = e.ang + i * 0.2; this.add({ x: e.x + Math.cos(a) * e.dist, y: e.y + Math.sin(a) * e.dist * 0.8, vy: -50, g: 100, size: 3, life: 0.5, color: i % 2 ? '#4caf38' : '#2e7d32', forma: 'hoja' }); } break;
        case 'humo': this.humo(e.x, e.y, 14, 'rgba(120,120,135,0.55)', e.radio * 0.5); break;
        case 'dash': this.polvo(e.l.x, e.l.y, 4, 5); break;
        case 'desaparece': this.rafaga(e.l.x, e.l.y, e.modo === 'tierra' ? 'GROUND' : 'FLYING', 14, 150); if (e.modo === 'tierra') this.debris(e.l.x, e.l.y, 'ROCK', 6); break;
        case 'evolucion':
          for (let i = 0; i < 5; i++) this.anillo(e.l.x, e.l.y - e.l.alto * 0.5, 30, 4, ['#ff6fd8', '#ffd23c', '#8be09a', '#6fd0ff', '#b07aff'][i], 0.4 + i * 0.05, 2);
          this.rafaga(e.l.x, e.l.y - e.l.alto * 0.5, 'FAIRY', 30, 220, { life: 0.8 });
          this.flash = e.mega ? 0.9 : 0.6; this.flashColor = '#ffffff'; this.temblor = Math.max(this.temblor, 6);
          break;
        case 'evoInicio': sfx('evoCarga'); this.temblor = Math.max(this.temblor, 2); break;
        case 'megaInicio': this.anillo(e.l.x, e.l.y - e.l.alto * 0.5, 4, 40, '#ffe27a', 0.9, 3); break;
        case 'ko': this.flash = 0.5; this.flashColor = '#ffffff'; this.temblor = Math.max(this.temblor, 10); this.anuncio('K.O!', { color: '#ff4040', tam: 32, dur: 1.3 }); this.chispas(e.l.x, e.l.y - e.l.alto * 0.5, '#fff', 16, 420); break;
        case 'tiempo': this.anuncio('TIME!', { color: '#ffd23c', tam: 32, dur: 1.2 }); break;
        case 'anuncio': this.anuncio(e.txt, { color: e.color, tam: e.tam, dur: e.dur, quien: e.quien }); break;
        case 'habilidad': if (e.slot !== 'lmb') this.globo(e.l, `${e.h.nombre}!`); break;
        case 'temblor': this.temblor = Math.max(this.temblor, e.f * 900); break;
        case 'sobrecarga': this.humo(e.l.x, e.l.y - e.l.alto, 6, 'rgba(120,110,110,0.6)', 8); break;
        case 'finProyectil': this.rafaga(e.x, e.y, e.tipo, 6, 100, { size: 2 }); break;
        case 'dormir': break;
        case 'sonido': sfx(e.n); break;
        default: break;
      }
    }
  }

  impacto(e) {
    const c = colorTipo(e.tipo);
    this.chispas(e.x, e.y, '#ffffff', e.fuerte ? 12 : 7, e.fuerte ? 380 : 260);
    this.rafaga(e.x, e.y, e.tipo, e.fuerte ? 14 : 8, e.fuerte ? 200 : 140);
    this.anillo(e.x, e.y, 2, e.fuerte ? 22 : 14, c, 0.22, 2);
    switch (e.tipo) {
      case 'WATER': this.gotas(e.x, e.y, e.fuerte ? 12 : 7); break;
      case 'FIRE': this.brasas(e.x, e.y, e.fuerte ? 10 : 6); break;
      case 'ROCK': case 'GROUND': this.debris(e.x, e.y, e.tipo, e.fuerte ? 9 : 5); this.polvo(e.x, e.y, 2, 6); break;
      case 'GRASS': case 'BUG': for (let i = 0; i < 5; i++) this.add({ x: e.x, y: e.y, vx: entre(-70, 70), vy: entre(-90, -20), g: 160, size: 2.5, life: 0.7, color: ['#8be04e', '#4caf38', '#2e7d32'][i % 3], forma: 'hoja', vr: 8 }); break;
      case 'ICE': this.debris(e.x, e.y, 'ICE', 7); break;
      case 'POISON': for (let i = 0; i < 6; i++) this.add({ x: e.x, y: e.y, vx: entre(-60, 60), vy: entre(-100, -30), g: 240, size: 2.2, life: 0.6, color: ['#c27ae0', '#9b3fbf'][i % 2], forma: 'circulo' }); break;
      default: break;
    }
  }
  gotas(x, y, n) { for (let i = 0; i < n; i++) { const a = ale() * Math.PI * 2, s = entre(40, 140); this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.4 - entre(60, 150), g: 420, size: entre(1.5, 3), life: 0.6, color: ['#f0fbff', '#9fdcff', '#4aa3f0'][i % 3], forma: 'gota' }); } this.anillo(x, y + 8, 3, 16, '#d8f2ff', 0.4, 1); }
  brasas(x, y, n) { for (let i = 0; i < n; i++) this.add({ x: x + entre(-6, 6), y, vx: entre(-30, 30), vy: -entre(30, 90), g: -20, size: entre(1.4, 2.6), life: entre(0.4, 0.9), color: ['#fff6b0', '#ffc23b', '#ff7a1f', '#e8361c'][i % 4], forma: 'sq' }); }
  debris(x, y, tipo, n) { const pal = paleta(tipo); for (let i = 0; i < n; i++) { const a = ale() * Math.PI * 2, s = entre(50, 170); this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.4 - entre(60, 160), g: 480, size: entre(1.6, 3.4), life: entre(0.5, 0.9), color: pal[1 + (i % 3)], forma: 'sq', vr: entre(-10, 10) }); } }

  // ---------------------------------------------------------------- passo e desenho
  update(dt) {
    for (const p of this.parts) {
      p.t += dt; p.vy += p.g * dt;
      const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.size += p.grow * dt;
    }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const a of this.anillos) a.t += dt; this.anillos = this.anillos.filter(a => a.t < a.dur);
    for (const a of this.tajos) a.t += dt; this.tajos = this.tajos.filter(a => a.t < a.life);
    for (const a of this.ondas) a.t += dt; this.ondas = this.ondas.filter(a => a.t < a.life);
    for (const x of this.textos) { x.t += dt; x.y += x.vy * dt; x.vy *= 0.97; } this.textos = this.textos.filter(x => x.t < x.life);
    for (const x of this.nums) { x.t += dt; } this.nums = this.nums.filter(x => x.t < x.life);
    for (const b of this.globos) b.t += dt; this.globos = this.globos.filter(b => b.t < b.life);
    for (const a of this.anuncios) a.t += dt; this.anuncios = this.anuncios.filter(a => a.t < a.dur);
    this.temblor = Math.max(0, this.temblor - dt * 24);
    this.flash = Math.max(0, this.flash - dt * 3);
  }

  dibujar(g) {
    // ondas de sopro e arcos de corte
    for (const o of this.ondas) {
      const k = o.t / o.life;
      g.strokeStyle = colorTipo(o.tipo); g.globalAlpha = 1 - k; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(o.x, o.y, o.alcance * (0.35 + 0.65 * k) * (0.7 + i * 0.15), o.ang - o.ang2, o.ang + o.ang2); g.stroke(); }
    }
    for (const a of this.tajos) {
      const k = a.t / a.life;
      g.globalAlpha = 1 - k;
      const arco = (r, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'butt'; g.beginPath(); g.arc(a.x, a.y, r, a.ang - 0.9 + k * 0.5, a.ang + 0.9 - k * 0.3); g.stroke(); };
      arco(a.r * 0.9, a.final ? 6 : 4, '#04102c');
      arco(a.r * 0.9, a.final ? 4 : 2.5, a.color);
      arco(a.r * 0.9, 1.2, '#ffffff');
    }
    g.globalAlpha = 1;
    for (const a of this.anillos) {
      const k = a.t / a.dur, r = a.r0 + (a.r1 - a.r0) * Math.sqrt(k);
      g.globalAlpha = 1 - k; g.strokeStyle = a.color; g.lineWidth = a.w;
      g.beginPath(); g.ellipse(a.x, a.y, r, r * 0.8, 0, 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
    for (const p of this.parts) {
      const a = 1 - p.t / p.life;
      g.globalAlpha = Math.max(0, a);
      g.fillStyle = p.color;
      const s = Math.max(0.6, p.size);
      switch (p.forma) {
        case 'circulo': g.beginPath(); g.arc(p.x, p.y, s, 0, 7); g.fill(); break;
        case 'gota': g.fillRect(p.x - s / 2, p.y - s, s, s * 1.8); break;
        case 'raya': g.strokeStyle = p.color; g.lineWidth = s; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); g.stroke(); break;
        case 'hoja': g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-s * 1.2, -s * 0.5, s * 2.4, s); g.restore(); break;
        case 'chispa': g.fillRect(p.x - s / 2, p.y - s * 1.5, s, s * 3); g.fillRect(p.x - s * 1.5, p.y - s / 2, s * 3, s); break;
        default: g.save(); g.translate(p.x, p.y); g.rotate(Math.round(p.rot / (Math.PI / 4)) * (Math.PI / 4)); g.fillRect(-s / 2, -s / 2, s, s); g.restore();
      }
    }
    g.globalAlpha = 1;
  }

  // textos no mundo (acima do resto)
  dibujarTextos(g, fuente) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const x of this.textos) {
      const a = Math.min(1, (x.life - x.t) / 0.25);
      g.globalAlpha = a; g.font = `700 ${x.tam * 1.25}px ${fuente}`;
      g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = '#04102c'; g.strokeText(x.txt, Math.round(x.x), Math.round(x.y));
      g.fillStyle = x.color; g.fillText(x.txt, Math.round(x.x), Math.round(x.y));
    }
    for (const n of this.nums) {
      const k = n.t / n.life, y = n.y - 14 * Math.sin(Math.min(1, k * 1.6) * Math.PI / 2);
      g.globalAlpha = 1 - k * k; g.font = `700 ${(n.mult > 1 ? 14 : 11) * 1.25}px ${fuente}`;
      g.lineWidth = 3; g.strokeStyle = '#04102c'; g.strokeText(String(n.dano), Math.round(n.x), Math.round(y));
      g.fillStyle = n.mult > 1 ? '#ffd23f' : n.mult < 1 ? '#9aa0b4' : '#ffffff'; g.fillText(String(n.dano), Math.round(n.x), Math.round(y));
    }
    g.globalAlpha = 1;
  }
}

function formaDe(tipo) {
  if (tipo === 'WATER') return ale() < 0.4 ? 'gota' : 'circulo';
  if (tipo === 'GRASS' || tipo === 'BUG') return 'hoja';
  if (tipo === 'ELECTRIC' || tipo === 'FAIRY' || tipo === 'STEEL') return 'chispa';
  if (tipo === 'FIRE' || tipo === 'POISON' || tipo === 'GHOST' || tipo === 'DRAGON') return 'circulo';
  return 'sq';
}

// ---------------------------------------------------------------- desenho das entidades da arena
const px = v => Math.round(v);

function sombra(g, x, y, r) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px(x - r), px(y - r * 0.3), px(r * 2), Math.max(1, px(r * 0.6))); }

function bolaPixel(g, x, y, r, col) {
  const [c0, c1, c2, c3] = paleta(col);
  g.fillStyle = '#04102c'; g.fillRect(px(x - r - 1), px(y - r - 1), px(r * 2 + 2), px(r * 2 + 2));
  g.fillStyle = c3; g.fillRect(px(x - r), px(y - r), px(r * 2), px(r * 2));
  g.fillStyle = c2; g.fillRect(px(x - r), px(y - r), px(r * 2 - 1), px(r * 2 - 1));
  g.fillStyle = c0; g.fillRect(px(x - r * 0.6), px(y - r * 0.6), Math.max(1, px(r * 0.7)), Math.max(1, px(r * 0.7)));
}

const ESTILOS_PROJ = {
  hoja(g, p, t) { g.save(); g.translate(px(p.x), px(p.y - p.alt)); g.rotate(t * 14); g.fillStyle = '#04102c'; g.fillRect(-5, -3, 10, 6); g.fillStyle = '#4caf38'; g.fillRect(-4, -2, 8, 4); g.fillStyle = '#8be04e'; g.fillRect(-3, -2, 5, 2); g.restore(); },
  semilla(g, p) { bolaPixel(g, p.x, p.y - p.alt, 3, 'GRASS'); g.fillStyle = '#c8a24a'; g.fillRect(px(p.x - 1), px(p.y - p.alt - 1), 2, 2); },
  brasa(g, p, t) { llama(g, p, t, 3 * p.escala); },
  fuego(g, p, t) { llama(g, p, t, 3.5 * p.escala); },
  chorrito(g, p) { bolaPixel(g, p.x, p.y - p.alt, 2.5 * Math.min(1.6, p.escala), 'WATER'); },
  espuma(g, p) { g.strokeStyle = '#04102c'; g.lineWidth = 3; g.beginPath(); g.arc(px(p.x), px(p.y - p.alt), 4 * p.escala, 0, 7); g.stroke(); g.strokeStyle = '#bfe9ff'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(px(p.x - 2), px(p.y - p.alt - 2), 2, 2); },
  burbuja(g, p) { ESTILOS_PROJ.espuma(g, { ...p, escala: 0.8 }); },
  pulsoAgua(g, p, t) { g.strokeStyle = '#04102c'; g.lineWidth = 4; for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(px(p.x), px(p.y - p.alt), (3 + i * 3) * p.escala, 0, 7); g.stroke(); } g.strokeStyle = i2(t) ? '#9fdcff' : '#4aa3f0'; g.lineWidth = 2; for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(px(p.x), px(p.y - p.alt), (3 + i * 3) * p.escala, 0, 7); g.stroke(); } },
  cuchilla(g, p) { g.save(); g.translate(px(p.x), px(p.y - p.alt)); g.rotate(p.ang); g.fillStyle = '#04102c'; g.fillRect(-6, -3, 12, 6); g.fillStyle = '#eeeaff'; g.fillRect(-5, -2, 10, 4); g.fillStyle = '#a395ee'; g.fillRect(-5, 0, 10, 2); g.restore(); },
  roca(g, p, t) { g.save(); g.translate(px(p.x), px(p.y - p.alt)); g.rotate(t * 9); const s = 3.5 * p.escala; g.fillStyle = '#04102c'; g.fillRect(-s - 1, -s - 1, s * 2 + 2, s * 2 + 2); g.fillStyle = '#a68c3a'; g.fillRect(-s, -s, s * 2, s * 2); g.fillStyle = '#c9b469'; g.fillRect(-s, -s, s, s); g.restore(); },
  vacio(g, p, t) { g.strokeStyle = '#04102c'; g.lineWidth = 4; g.beginPath(); g.arc(px(p.x), px(p.y - p.alt), 5 * p.escala, p.ang - 1.2, p.ang + 1.2); g.stroke(); g.strokeStyle = '#e0623a'; g.lineWidth = 2; g.stroke(); },
  aurasphere(g, p, t) { const r = 5 * p.escala * (1 + 0.1 * Math.sin(t * 20)); bolaPixel(g, p.x, p.y - p.alt, r, 'FIGHTING'); g.strokeStyle = 'rgba(111,208,255,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.arc(px(p.x), px(p.y - p.alt), r + 3, 0, 7); g.stroke(); },
  corazon(g, p) { const x = px(p.x), y = px(p.y - p.alt), s = 2.2 * p.escala; g.fillStyle = '#04102c'; g.fillRect(x - s * 2 - 1, y - s - 1, s * 4 + 2, s * 2 + 2); g.fillStyle = '#ff6fa8'; g.fillRect(x - s * 2, y - s, s * 2 - 1, s * 1.5); g.fillRect(x + 1, y - s, s * 2 - 1, s * 1.5); g.fillRect(x - s * 1.5, y, s * 3, s); g.fillStyle = '#ffc2d8'; g.fillRect(x - s * 1.5, y - s, 2, 2); },
  guijarro(g, p) { bolaPixel(g, p.x, p.y - p.alt, 2, 'ROCK'); },
  shuriken(g, p, t) { g.save(); g.translate(px(p.x), px(p.y - p.alt)); g.rotate(t * 26); g.fillStyle = '#04102c'; g.fillRect(-5, -2, 10, 4); g.fillRect(-2, -5, 4, 10); g.fillStyle = '#9fdcff'; g.fillRect(-4, -1, 8, 2); g.fillRect(-1, -4, 2, 8); g.restore(); },
  shurikenGigante(g, p, t) { g.save(); g.translate(px(p.x), px(p.y - p.alt)); g.rotate(t * 20); const s = 5 * p.escala; g.fillStyle = '#04102c'; g.fillRect(-s - 2, -s / 2 - 2, s * 2 + 4, s + 4); g.fillRect(-s / 2 - 2, -s - 2, s + 4, s * 2 + 4); g.fillStyle = '#4aa3f0'; g.fillRect(-s, -s / 2, s * 2, s); g.fillRect(-s / 2, -s, s, s * 2); g.fillStyle = '#d8f2ff'; g.fillRect(-s, -1, s * 2, 2); g.restore(); },
  bola(g, p) { bolaPixel(g, p.x, p.y - p.alt, 3 * p.escala, p.tipoAtq); },
};
const i2 = t => Math.floor(t * 12) % 2;
function llama(g, p, t, r) {
  const x = px(p.x), y = px(p.y - p.alt);
  g.fillStyle = '#e8361c'; g.fillRect(x - r, y - r, r * 2, r * 2);
  g.fillStyle = '#ff7a1f'; g.fillRect(x - r * 0.7 - (i2(t) ? 1 : 0), y - r * 0.9, r * 1.4, r * 1.6);
  g.fillStyle = '#ffc23b'; g.fillRect(x - r * 0.4, y - r * 0.5, r * 0.8, r * 0.8);
  g.fillStyle = '#fff6b0'; g.fillRect(x - 1, y - 1, 2, 2);
}

export function dibujarEntidades(g, luta, fx, t, dibujarLutadorClon) {
  for (const e of luta.entidades) {
    switch (e.tipo) {
      case 'charco': {
        const k = Math.min(1, (e.dur - e.t) / 0.6);
        g.globalAlpha = 0.55 * k; g.fillStyle = '#7a2c92'; g.beginPath(); g.ellipse(px(e.x), px(e.y), e.radio, e.radio * 0.6, 0, 0, 7); g.fill();
        g.fillStyle = '#c27ae0'; g.beginPath(); g.ellipse(px(e.x - 4), px(e.y - 2), e.radio * 0.4, e.radio * 0.2, 0, 0, 7); g.fill(); g.globalAlpha = 1;
        if (ale() < 0.1) fx.add({ x: e.x + entre(-e.radio, e.radio) * 0.7, y: e.y, vy: -20, g: 0, size: 2, life: 0.6, color: '#c27ae0', forma: 'circulo' });
        break;
      }
      case 'humo': {
        const k = Math.min(1, e.t / 0.3) * Math.min(1, (e.dur - e.t) / 0.6);
        g.globalAlpha = 0.5 * k; g.fillStyle = '#6b6b80';
        for (let i = 0; i < 9; i++) { const a = (i / 9) * 7 + e.t * 0.4; g.beginPath(); g.arc(px(e.x + Math.cos(a) * e.radio * 0.55), px(e.y + Math.sin(a) * e.radio * 0.4), e.radio * 0.4, 0, 7); g.fill(); }
        g.globalAlpha = 1;
        break;
      }
      case 'marcas': {
        for (const p of e.puntos) {
          if (p.golpeado) continue;
          const k = clampK((e.t - p.t0) / e.aviso);
          if (e.t < p.t0) { g.globalAlpha = 0.25; }
          else g.globalAlpha = 0.7;
          g.strokeStyle = e.estilo === 'erupcion' || e.estilo === 'roca' ? '#ffd23c' : colorTipo(e.tipoAtq); g.lineWidth = 1.5;
          g.beginPath(); g.ellipse(px(p.x), px(p.y), (p.radio ?? e.radio), (p.radio ?? e.radio) * 0.6, 0, 0, 7); g.stroke();
          g.fillStyle = 'rgba(255,200,60,0.25)'; g.beginPath(); g.ellipse(px(p.x), px(p.y), (p.radio ?? e.radio) * k, (p.radio ?? e.radio) * 0.6 * k, 0, 0, 7); g.fill();
          if (e.t >= p.t0 && e.estilo === 'roca') { const caida = (1 - k) * 90; g.globalAlpha = 1; g.fillStyle = '#04102c'; g.fillRect(px(p.x - 6), px(p.y - caida - 6), 12, 12); g.fillStyle = '#a68c3a'; g.fillRect(px(p.x - 5), px(p.y - caida - 5), 10, 10); g.fillStyle = '#c9b469'; g.fillRect(px(p.x - 5), px(p.y - caida - 5), 5, 5); }
          g.globalAlpha = 1;
        }
        break;
      }
      case 'meteoro': {
        if (e.fase === 'apunta' || e.fase === 'baja') {
          const k = e.fase === 'baja' ? 1 : e.k;
          g.globalAlpha = 0.35 + 0.35 * k; g.fillStyle = '#ff5a3a'; g.beginPath(); g.ellipse(px(e.x), px(e.y), e.radio * (0.5 + 0.5 * k), e.radio * (0.5 + 0.5 * k) * 0.6, 0, 0, 7); g.fill();
          g.strokeStyle = '#ffd23c'; g.lineWidth = 2; g.beginPath(); g.ellipse(px(e.x), px(e.y), e.radio, e.radio * 0.6, 0, 0, 7); g.stroke(); g.globalAlpha = 1;
        }
        break;
      }
      case 'caparazon': {
        const l = e.dueno, a = e.ang;
        g.strokeStyle = '#04102c'; g.lineWidth = 6; g.beginPath(); g.arc(px(l.x), px(l.y - l.alto * 0.4), e.h.alcance * 0.7, a, a + 2.6); g.stroke();
        g.strokeStyle = '#9fdcff'; g.lineWidth = 3; g.stroke();
        g.strokeStyle = '#04102c'; g.lineWidth = 6; g.beginPath(); g.arc(px(l.x), px(l.y - l.alto * 0.4), e.h.alcance * 0.7, a + Math.PI, a + Math.PI + 2.6); g.stroke();
        g.strokeStyle = '#4aa3f0'; g.lineWidth = 3; g.stroke();
        break;
      }
      default: break;
    }
  }
  // raios e cones por cima do chão
  for (const e of luta.entidades) {
    if (e.tipo === 'chorro') dibujarChorro(g, e, t, fx);
    else if (e.tipo === 'cono') dibujarCono(g, e, t, fx);
  }
}

const clampK = k => Math.max(0, Math.min(1, k));

function dibujarChorro(g, e, t, fx) {
  const d = e.dueno, b = e.boca(), alt = d.alto * 0.55;
  const col = e.tipoAtq, [c0, c1, c2, c3] = paleta(col);
  if (!e.activo) {
    const k = e.t / e.carga;
    g.globalAlpha = 0.6; g.fillStyle = c1; g.beginPath(); g.arc(px(b.x), px(b.y - alt), 3 + k * 8, 0, 7); g.fill();
    g.globalAlpha = 1; g.fillStyle = '#fff'; g.fillRect(px(b.x - 1), px(b.y - alt - 1), 3, 3);
    fx.chispas(b.x + Math.cos(e.ang) * 20 + (ale() - 0.5) * 30, b.y - alt + (ale() - 0.5) * 30, c1, 1, 40);
    return;
  }
  const k = clampK(1 - (e.t - e.carga) / e.dur), ancho = e.h.anchoVisual ?? e.ancho * 1.4;
  const x2 = b.x + Math.cos(e.ang) * e.largo, y2 = b.y + Math.sin(e.ang) * e.largo - alt;
  const w = ancho * (0.5 + 0.5 * Math.min(1, (e.t - e.carga) / 0.12)) * (0.6 + 0.4 * k);
  g.save();
  g.lineCap = 'butt';
  const capa = (grosor, color, alfa = 1) => { g.globalAlpha = alfa; g.strokeStyle = color; g.lineWidth = grosor; g.beginPath(); g.moveTo(px(b.x), px(b.y - alt)); g.lineTo(px(x2), px(y2)); g.stroke(); };
  capa(w + 6, '#04102c', 0.85); capa(w, c3); capa(w * 0.72, c2); capa(w * 0.42, c1); capa(w * 0.18, '#ffffff');
  // pedaços que correm pelo raio
  g.globalAlpha = 1;
  const n = Math.floor(e.largo / 16);
  for (let i = 0; i < n; i++) {
    const f = (((i / n) + t * 2.2) % 1), ox = b.x + (x2 - b.x) * f, oy = b.y - alt + (y2 - (b.y - alt)) * f;
    const s = 2 + ((i * 7) % 3);
    g.fillStyle = i % 2 ? c0 : c1; g.fillRect(px(ox - s / 2 + Math.sin(t * 30 + i) * w * 0.25), px(oy - s / 2 + Math.cos(t * 28 + i) * w * 0.25), s, s);
  }
  g.restore();
  g.globalAlpha = 1;
  g.fillStyle = c1; g.beginPath(); g.arc(px(b.x), px(b.y - alt), w * 0.5, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(px(b.x), px(b.y - alt), w * 0.25, 0, 7); g.fill();
  if (BRILLA.has(col) && ale() < 0.6) fx.chispas(x2 + (ale() - 0.5) * 8, y2 + (ale() - 0.5) * 8, c1, 1, 100);
  if (ale() < 0.5) fx.rafaga(x2, y2 + alt, col, 1, 80, { size: 2 });
}

function dibujarCono(g, e, t, fx) {
  const d = e.dueno, alt = d.alto * 0.5, h = e.h;
  const ox = d.x + Math.cos(e.ang) * 10, oy = d.y + Math.sin(e.ang) * 6 - alt;
  const [c0, c1, c2] = paleta(h.tipo);
  const k = clampK(1 - e.t / h.dur);
  g.globalAlpha = 0.25 * k; g.fillStyle = c2;
  g.beginPath(); g.moveTo(px(ox), px(oy)); g.arc(px(ox), px(oy), h.alcance, e.ang - (h.angulo * Math.PI) / 360, e.ang + (h.angulo * Math.PI) / 360); g.closePath(); g.fill(); g.globalAlpha = 1;
  for (let i = 0; i < 3; i++) {
    const a = e.ang + (ale() - 0.5) * (h.angulo * Math.PI) / 180, s = entre(80, 150);
    fx.add({ x: ox + Math.cos(a) * 8, y: oy + Math.sin(a) * 8, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 1.2, size: entre(2, 4), grow: 3, life: entre(0.25, 0.45), color: [c0, c1, c2][i % 3], forma: 'circulo' });
  }
}

export function dibujarProyectil(g, p, t) {
  const f = ESTILOS_PROJ[p.estilo] ?? ESTILOS_PROJ.bola;
  sombra(g, p.x, p.y, 3 * p.escala);
  f(g, p, t);
}
export function dibujarBomba(g, p) {
  sombra(g, p.x, p.y, 5);
  bolaPixel(g, p.x, p.y - p.alt, 5, 'POISON');
}
