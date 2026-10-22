// Efeitos visuais em pixel art: partículas, anéis, golpes de corte, números de dano, avisos no chão
// e o desenho das entidades da arena (projéteis, raios, cones, fumaça...). Tudo em coordenadas do mundo.
import { TIPOS } from '../data/regras.js';
import { hex } from '../config.js';
import { aleatorio as azar } from '../engine/util.js';
import { sfx } from '../audio.js';
import * as PX from './pixelfx.js';

const ale = () => Math.random();
const R = Math.round;
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
// rampa [sombra, base, luz, brilho] do tipo, para os sprites
const rampaTipo = t => { const [a, b, c, d] = paleta(t); return [d, c, b, a]; };
const RAMPA_DRAGON = ['#2a1060', '#7a3cf0', '#c49cff', '#ffffff'];
const rampaFuego = t => (t === 'DRAGON' ? RAMPA_DRAGON : t === 'GHOST' ? ['#2a1050', '#7a4cc0', '#b496ee', '#f0e4ff'] : t === 'PSYCHIC' || t === 'FAIRY' ? rampaTipo(t) : PX.RAMPA_FOGO);
const tamSprite = s => [5, 6, 8, 10, 12, 16, 20, 24].find(v => v >= s * 2.6) ?? 24;
const rampa4 = c => { const n = parseInt(c.slice(1), 16); void n; return [mezcla(c, -0.5), c, mezcla(c, 0.5), mezcla(c, 0.9)]; };
export const paleta = t => { const c = colorTipo(t); return [mezcla(c, 0.7), mezcla(c, 0.35), c, mezcla(c, -0.35)]; };
const BRILLA = new Set(['FIRE', 'ELECTRIC', 'PSYCHIC', 'FAIRY', 'DRAGON', 'GHOST', 'ICE']);

export class Efectos {
  constructor() {
    this.parts = []; this.anillos = []; this.tajos = []; this.textos = []; this.nums = []; this.globos = []; this.cortes = [];
    this.temblor = 0; this.flash = 0; this.flashColor = '#fff';
    this.anuncios = [];
    this.ondas = []; this.banners = []; this.cruces = []; this.espinas = []; this.zonas = [];
  }

  add(p) { if (this.parts.length > 900) this.parts.splice(0, 80); this.parts.push({ vx: 0, vy: 0, g: 0, size: 2, life: 0.5, t: 0, drag: 0, grow: 0, forma: 'sq', rot: ale() * 6, vr: 0, ...p }); }

  rafaga(x, y, tipo, n = 10, vel = 120, op = {}) {
    const pal = paleta(tipo);
    for (let i = 0; i < n; i++) {
      const a = ale() * Math.PI * 2, s = vel * (0.3 + ale() * 0.8);
      const forma = formaDe(tipo);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7 - (op.arriba ?? 0), g: forma === 'llama' ? -30 : op.g ?? 120, drag: 2.5, size: (op.size ?? 2.5) * (0.6 + ale() * 0.8) * (forma === 'llama' ? 0.8 : 1), life: (op.life ?? 0.45) * (0.6 + ale() * 0.8), color: pal[Math.floor(ale() * pal.length)], forma, rampa: forma === 'llama' ? rampaFuego(tipo) : tipo === 'WATER' ? PX.RAMPA_AGUA : undefined });
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
  globo(l, txt, tipo = 'NORMAL') { this.globos = this.globos.filter(b => b.l !== l); this.globos.push({ l, txt, tipo, t: 0, life: 1.1 }); }
  banner(txt, tipo) { this.banners.push({ txt, tipo, t: 0, life: 1.15 }); }
  cruz(x, y, ang, tipo, largo) { this.cruces.push({ x, y, ang, tipo, largo, t: 0, life: 0.45 }); }
  tajo(x, y, ang, r, color, final, estilo, tipo) { this.tajos.push({ x, y, ang, r, color, final, estilo, tipo, t: 0, life: final ? 0.24 : 0.17 }); }
  onda(x, y, ang, alcance, anguloDeg, tipo, estilo) { this.ondas.push({ x, y, ang, alcance, ang2: (anguloDeg * Math.PI) / 360, tipo, estilo, t: 0, life: 0.45 }); }
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
          this.add({ x: e.x, y: e.y, size: Math.max(12, e.radio * 0.8), life: 0.34, color: '#ffffff', brillo: mezcla(colorTipo(e.tipo), 0.3), forma: 'estouro' });
          this.rafaga(e.x, e.y, e.tipo, 14, 200, { size: 3, life: 0.55 });
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
        case 'tajo': this.tajo(e.l.x + Math.cos(e.ang) * 6, e.l.y - e.l.alto * 0.5 + Math.sin(e.ang) * 4, e.ang, e.alcance, colorTipo(e.tipo), e.final, e.estilo, e.tipo); if (e.final) this.chispas(e.l.x + Math.cos(e.ang) * e.alcance * 0.8, e.l.y - e.l.alto * 0.4, '#fff', 4, 200); break;
        case 'viento': this.onda(e.x, e.y, e.ang, e.alcance, e.angulo, e.tipo, e.estilo); break;
        case 'zonaRaiz': this.zonas.push({ x: e.x, y: e.y, radio: e.radio, t: 0, life: e.dur + 0.35 }); break;
        case 'raices': { const n = Math.max(6, Math.round((Math.PI * 2 * e.dist) / 17)); const gira = ale() * 6; for (let i = 0; i < n; i++) { const a = gira + (i / n) * Math.PI * 2 + (ale() - 0.5) * 0.15, d = e.dist + (ale() - 0.5) * 10; this.espinas.push({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d * 0.62, alto: e.dist < 50 ? 34 + Math.round(ale() * 14) : e.dist < 90 ? 24 + Math.round(ale() * 10) : 15 + Math.round(ale() * 8), semilla: i, vid: e.dist < 90 || i % 2 === 0, t: -ale() * 0.05, life: 0.7 }); } this.anillo(e.x, e.y, e.dist * 0.5, e.dist, '#4caf38', 0.3, 2); this.polvo(e.x, e.y, 6 + (e.onda ?? 0) * 3, 6); this.temblor = Math.max(this.temblor, 3 + (e.onda ?? 0) * 2); break; }
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
        case 'habilidad': if (e.slot === 'e') this.banner(`${e.h.nombre}!`, e.h.tipo); else if (e.slot !== 'lmb') this.globo(e.l, `${e.h.nombre}!`, e.h.tipo); break;
        case 'cruz': this.cruz(e.x, e.y, e.ang, e.tipo, e.largo); break;
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
    this.add({ x: e.x, y: e.y, size: e.fuerte ? 15 : 10, life: e.fuerte ? 0.28 : 0.22, color: '#ffffff', brillo: mezcla(c, 0.25), forma: e.tipo === 'WATER' ? 'salpicadura' : 'estouro' });
    this.chispas(e.x, e.y, '#ffffff', e.fuerte ? 8 : 4, e.fuerte ? 380 : 260);
    this.rafaga(e.x, e.y, e.tipo, e.fuerte ? 10 : 6, e.fuerte ? 200 : 140);
    this.anillo(e.x, e.y, 2, e.fuerte ? 22 : 14, c, 0.22, 1);
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
    for (const b of this.banners) b.t += dt; this.banners = this.banners.filter(b => b.t < b.life);
    for (const c of this.cruces) c.t += dt; this.cruces = this.cruces.filter(c => c.t < c.life);
    for (const c of this.espinas) c.t += dt; this.espinas = this.espinas.filter(c => c.t < c.life);
    for (const z of this.zonas) z.t += dt; this.zonas = this.zonas.filter(z => z.t < z.life);
    this.temblor = Math.max(0, this.temblor - dt * 24);
    this.flash = Math.max(0, this.flash - dt * 3);
  }

  // marcas no chão (área da Frenzy Plant): aparecem antes das raízes, para dar para fugir
  dibujarSuelo(g) {
    for (const z of this.zonas) {
      const a = Math.min(1, z.t / 0.12) * Math.min(1, (z.life - z.t) / 0.3), pul = 0.5 + 0.5 * Math.sin(z.t * 18);
      g.globalAlpha = a * 0.22; g.fillStyle = '#3f8f2a';
      g.beginPath(); g.ellipse(R(z.x), R(z.y), z.radio, z.radio * 0.62, 0, 0, 7); g.fill();
      g.globalAlpha = a * (0.6 + 0.3 * pul);
      PX.anilloPix(g, z.x, z.y, z.radio, z.radio * 0.62, '#04102c', 3, 0);
      PX.anilloPix(g, z.x, z.y, z.radio, z.radio * 0.62, '#84cc16', 2, 9, Math.floor(z.t * 20));
    }
    g.globalAlpha = 1;
  }

  dibujar(g) {
    // ondas de sopro e arcos de corte
    for (const o of this.ondas) {
      const k = o.t / o.life, c = colorTipo(o.tipo);
      g.globalAlpha = Math.min(1, (1 - k) * 1.6);
      if (o.estilo === 'sonido') {
        // ondas sonoras: anéis finos e claros que saem da boca e vão abrindo
        for (let i = 0; i < 4; i++) {
          const f = Math.min(1, k * 1.25 - i * 0.12); if (f <= 0) continue;
          const d = o.alcance * f, rx = 3 + f * 5, ry = Math.tan(o.ang2) * d * 0.9 + 3;
          const cx = o.x + Math.cos(o.ang) * d, cy = o.y + Math.sin(o.ang) * d * 0.9;
          const ca = Math.cos(o.ang), sa = Math.sin(o.ang);
          for (let j = 0; j < 22; j++) {
            if (j % 3 === 2) continue;
            const u = (j / 21 - 0.5) * 2, px_ = cx + (-sa) * u * ry + ca * (1 - u * u) * rx, py_ = cy + ca * u * ry + sa * (1 - u * u) * rx * 0.9;
            g.fillStyle = j % 2 ? '#ffffff' : '#bfe0ff'; g.fillRect(R(px_), R(py_), 2, 2);
          }
        }
      } else for (let i = 0; i < 3; i++) {
        const r = o.alcance * (0.35 + 0.65 * k) * (0.7 + i * 0.15), a2 = o.ang2 * (0.8 + i * 0.1);
        PX.arcoPix(g, o.x, o.y, r, o.ang - a2, o.ang + a2, '#04102c', 4);
        PX.arcoPix(g, o.x, o.y, r, o.ang - a2 * 0.96, o.ang + a2 * 0.96, i === 1 ? '#ffffff' : c, 2);
      }
    }
    for (const a of this.tajos) this.dibujarTajo(g, a);
    g.globalAlpha = 1;
    for (const c of this.cruces) {
      const k = c.t / c.life, alfa = Math.min(1, (1 - k) * 1.8), cx = c.x, cy = c.y, L = c.largo * (0.55 + 0.45 * Math.min(1, k * 4));
      const ca = Math.cos(c.ang), sa = Math.sin(c.ang), [, c2, c1] = rampaTipo(c.tipo);
      g.globalAlpha = alfa;
      PX.lineaPix(g, cx - ca * L, cy - sa * L * 0.8, cx + ca * L, cy + sa * L * 0.8, '#04102c', 5);
      PX.lineaPix(g, cx - ca * L, cy - sa * L * 0.8, cx + ca * L, cy + sa * L * 0.8, c2, 3);
      PX.lineaPix(g, cx - ca * L, cy - sa * L * 0.8, cx + ca * L, cy + sa * L * 0.8, c1, 1);
      PX.disco(g, cx, cy, 2.5, '#ffffff');
      g.globalAlpha = 1;
    }
    for (const a of this.anillos) {
      const k = a.t / a.dur, r = a.r0 + (a.r1 - a.r0) * Math.sqrt(k);
      g.globalAlpha = Math.min(1, (1 - k) * 1.4);
      PX.anilloPix(g, a.x, a.y, r, r * 0.8, '#04102c', a.w + 1, 0);
      PX.anilloPix(g, a.x, a.y, r, r * 0.8, a.color, a.w, r > 24 ? 7 : 0, Math.floor(a.t * 30));
    }
    g.globalAlpha = 1;
    for (const sp of [...this.espinas].sort((a, b) => a.y - b.y)) {
      if (sp.t < 0) continue;
      const k = sp.t / sp.life, sube = Math.min(1, sp.t / 0.1), baja = Math.min(1, (sp.life - sp.t) / 0.16), h = Math.max(3, Math.round(sp.alto * Math.min(sube, baja)));
      PX.carimbar(g, sp.vid ? PX.vid(h, sp.semilla) : PX.espina(h), sp.x, sp.y - h / 2 + 2, 0, 1, 1);
      void k;
    }
    for (const p of this.parts) {
      const a = 1 - p.t / p.life;
      g.globalAlpha = Math.max(0, a);
      g.fillStyle = p.color;
      const s = Math.max(0.6, p.size);
      const al = Math.max(0, a);
      switch (p.forma) {
        case 'llama': PX.carimbar(g, PX.llama(Math.floor(p.t * 14 + p.rot), tamSprite(s), p.rampa ?? PX.RAMPA_FOGO), p.x, p.y, 0, 1, 1); break;
        case 'gota': PX.carimbar(g, PX.gota(Math.max(5, Math.round(s * 3.2)), p.rampa), p.x, p.y, Math.atan2(p.vy, p.vx), 1, al); break;
        case 'hoja': PX.carimbar(g, PX.hoja(Math.max(6, Math.round(s * 3.4))), p.x, p.y, p.rot, 1, al); break;
        case 'chispa': PX.carimbar(g, PX.chispa(Math.max(2, Math.round(s)), /^#/.test(p.color) ? p.color : '#ffffff'), p.x, p.y, 0, 1, 1); break;
        case 'burbuja': PX.carimbar(g, PX.burbuja(Math.max(2, Math.round(s)), /^#/.test(p.color) ? p.color : '#bfe9ff'), p.x, p.y, 0, 1, 1); break;
        case 'salpicadura': PX.carimbar(g, PX.salpicadura(Math.floor((p.t / p.life) * 4), Math.max(7, Math.round(p.size))), p.x, p.y - 2, 0, 1, 1); break;
        case 'estouro': PX.carimbar(g, PX.estouro(Math.floor((p.t / p.life) * 4), Math.max(6, Math.round(p.size)), p.color, p.brillo ?? '#ffd23c'), p.x, p.y, 0, 1, 1); break;
        case 'humo': PX.carimbar(g, PX.humo(Math.max(3, Math.round(s * 0.9)), p.tono), p.x, p.y, 0, 1, p.alfa ?? 0.8); break;
        case 'bola': { const r = Math.max(2, s); PX.esfera(g, p.x, p.y, r, p.rampa ?? PX.RAMPA_FOGO); break; }
        case 'circulo': {
          if (/^#/.test(p.color)) { PX.disco(g, p.x, p.y, Math.max(1, s * 0.8), p.color); break; }
          const m = /([\d.]+)\)$/.exec(p.color);
          PX.carimbar(g, PX.humo(Math.max(3, Math.round(s * 0.9))), p.x, p.y, 0, 1, Math.min(1, (m ? Number(m[1]) : 0.6) + 0.15));
          break;
        }
        case 'raya': g.strokeStyle = p.color; g.lineWidth = Math.max(1, Math.round(s)); PX.lineaPix(g, p.x, p.y, p.x - p.vx * 0.04, p.y - p.vy * 0.04, p.color, Math.max(1, Math.round(s))); break;
        default: g.save(); g.translate(R(p.x), R(p.y)); g.rotate(Math.round(p.rot / (Math.PI / 4)) * (Math.PI / 4)); g.fillRect(-Math.round(s / 2), -Math.round(s / 2), Math.max(1, Math.round(s)), Math.max(1, Math.round(s))); g.restore();
      }
    }
    g.globalAlpha = 1;
  }

  // cada tipo de golpe tem o seu desenho: asa, mordida, barra de aço, palma ou corte em lua
  dibujarTajo(g, a) {
    const k = a.t / a.life, rr = a.r * 0.9, [, base, claro, brillo] = rampa4(a.color);
    const fx = a.x + Math.cos(a.ang) * rr * 0.85, fy = a.y + Math.sin(a.ang) * rr * 0.85 * 0.8;
    g.globalAlpha = Math.min(1, (1 - k) * 1.5);
    if (a.tipo === 'FLYING' && a.estilo !== 'rafaga') {
      // asa: três penas em leque, brancas com borda azul
      for (let i = -1; i <= 1; i++) {
        const rad = rr * (0.95 - Math.abs(i) * 0.1), abre = a.ang + i * 0.5, a0 = abre - 0.55 + k * 0.3, a1 = abre + 0.55 - k * 0.1;
        PX.arcoPix(g, a.x, a.y, rad, a0, a1, '#2a4a8a', 5, rad * 0.8);
        PX.arcoPix(g, a.x, a.y, rad, a0 + 0.05, a1 - 0.05, '#cfe4ff', 3, rad * 0.8);
        PX.arcoPix(g, a.x, a.y, rad, a0 + 0.15, a1 - 0.15, '#ffffff', 1, rad * 0.8);
      }
    } else if (a.tipo === 'BUG' || a.tipo === 'DARK') {
      PX.carimbar(g, PX.mordida(k, Math.max(8, Math.round(rr * 0.45))), fx, fy, a.ang);
    } else if (a.tipo === 'STEEL') {
      // barra metálica que cruza em diagonal
      const dx = Math.cos(a.ang + 1.5708), dy = Math.sin(a.ang + 1.5708) * 0.8, mv = (k - 0.5) * rr * 0.7;
      const x0 = fx - dx * rr * 0.55 + Math.cos(a.ang) * mv * 0.4, y0 = fy - dy * rr * 0.55, x1 = fx + dx * rr * 0.55 + Math.cos(a.ang) * mv * 0.4, y1 = fy + dy * rr * 0.55;
      PX.lineaPix(g, x0, y0, x1, y1, '#04102c', 8); PX.lineaPix(g, x0, y0, x1, y1, '#8fa4b8', 6); PX.lineaPix(g, x0, y0, x1, y1, '#e0eaf2', 3); PX.lineaPix(g, x0, y0, x1, y1, '#ffffff', 1);
    } else if (a.tipo === 'FIGHTING' && (a.estilo === 'aura' || a.estilo === 'golpe')) {
      PX.carimbar(g, PX.estouro(Math.floor(k * 3), Math.max(9, Math.round(rr * 0.4)), '#ffffff', '#ff8a5a'), fx, fy);
      PX.anilloPix(g, fx, fy, 6 + k * 14, 5 + k * 11, '#ffd0b0', 1, 3, Math.floor(a.t * 40));
    } else {
      const gro = a.final ? 7 : 5, a0 = a.ang - 0.95 + k * 0.55, a1 = a.ang + 0.95 - k * 0.2;
      PX.arcoPix(g, a.x, a.y, rr, a0, a1, '#04102c', gro + 2, rr * 0.82);
      PX.arcoPix(g, a.x, a.y, rr, a0, a1, base, gro, rr * 0.82);
      PX.arcoPix(g, a.x, a.y, rr, a0 + 0.1, a1 - 0.1, claro, Math.max(2, gro - 2), rr * 0.82);
      PX.arcoPix(g, a.x, a.y, rr, a0 + 0.25, a1 - 0.25, brillo, Math.max(1, gro - 4), rr * 0.82);
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
  if (tipo === 'WATER') return ale() < 0.55 ? 'gota' : 'burbuja';
  if (tipo === 'GRASS' || tipo === 'BUG') return 'hoja';
  if (tipo === 'ELECTRIC' || tipo === 'FAIRY' || tipo === 'STEEL' || tipo === 'PSYCHIC') return 'chispa';
  if (tipo === 'FIRE' || tipo === 'DRAGON' || tipo === 'GHOST') return 'llama';
  if (tipo === 'POISON') return 'burbuja';
  return 'sq';
}

// ---------------------------------------------------------------- desenho das entidades da arena
const px = v => Math.round(v);

function sombra(g, x, y, r) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px(x - r), px(y - r * 0.3), px(r * 2), Math.max(1, px(r * 0.6))); }

function bolaPixel(g, x, y, r, tipo) { PX.esfera(g, px(x), px(y), Math.max(1.5, r), rampaTipo(tipo)); }

// estela de cauda: bolinhas que encolhem atrás do tiro
function cola(g, p, n, color, r0) {
  for (let i = 1; i <= n; i++) {
    const k = i / (n + 1), rr = Math.max(0.6, r0 * (1 - k));
    PX.disco(g, px(p.x - Math.cos(p.ang) * i * 4), px(p.y - p.alt - Math.sin(p.ang) * i * 4 * 0.9), rr, color);
  }
}
const AGUA = PX.RAMPA_AGUA;
const ESTILOS_PROJ = {
  hoja(g, p, t) { PX.carimbar(g, PX.hoja(Math.round(9 * p.escala)), p.x, p.y - p.alt, t * 14 + p.x * 0.05); },
  semilla(g, p) { PX.esfera(g, px(p.x), px(p.y - p.alt), 3, ['#5a3a12', '#9a6a22', '#d6a64a', '#fff0b0']); PX.disco(g, px(p.x + 1), px(p.y - p.alt + 1), 1, '#3f8a2a'); },
  brasa(g, p, t) { llamaProj(g, p, t, 8 * p.escala); },
  fuego(g, p, t) { llamaProj(g, p, t, 12 * p.escala); },
  chorrito(g, p) { PX.carimbar(g, PX.gota(Math.round(7 * Math.min(1.8, p.escala)), AGUA), p.x, p.y - p.alt, p.ang); },
  espuma(g, p, t) { PX.carimbar(g, PX.burbuja(Math.round(4 * p.escala)), p.x + Math.sin(t * 9 + p.x) * 0.6, p.y - p.alt); },
  burbuja(g, p, t) { PX.carimbar(g, PX.burbuja(Math.round(3.4)), p.x, p.y - p.alt); },
  pulsoAgua(g, p, t) {
    const x = px(p.x), y = px(p.y - p.alt), r = 4 * p.escala, f = Math.floor(t * 14) % 3;
    PX.anilloPix(g, x, y, r + 5 + f, r + 5 + f, '#04102c', 2); PX.anilloPix(g, x, y, r + 5 + f, r + 5 + f, '#9fdcff', 1, 5, f);
    PX.esfera(g, x, y, r, AGUA);
  },
  cuchilla(g, p, t) { PX.carimbar(g, PX.anilloAire(7), p.x, p.y - p.alt, p.ang); for (let i = 1; i <= 3; i++) { g.fillStyle = '#ffffff'; g.globalAlpha = 0.7 - i * 0.18; g.fillRect(px(p.x - Math.cos(p.ang) * i * 6 + Math.sin(p.ang) * Math.sin(t * 30 + i) * 3), px(p.y - p.alt - Math.sin(p.ang) * i * 5), 2, 2); } g.globalAlpha = 1; },
  roca(g, p, t) { PX.carimbar(g, PX.roca(Math.max(3, Math.round(3.6 * p.escala))), p.x, p.y - p.alt, t * 9); },
  vacio(g, p) { PX.carimbar(g, PX.mediaLuna(8, ['#6a1f10', '#e0623a', '#ffb08a', '#ffffff']), p.x, p.y - p.alt, p.ang); },
  aurasphere(g, p, t) {
    const x = px(p.x), y = px(p.y - p.alt), r = 5 * p.escala * (1 + 0.08 * Math.sin(t * 20));
    PX.anilloPix(g, x, y, r + 4, r + 4, 'rgba(111,208,255,0.55)', 1, 3, Math.floor(t * 20));
    PX.esfera(g, x, y, r, ['#2a6ac8', '#6fd0ff', '#d6f6ff', '#ffffff']);
  },
  corazon(g, p, t) { PX.carimbar(g, PX.corazon(Math.max(1, Math.round(1.6 * p.escala))), p.x, p.y - p.alt + Math.sin(t * 12) * 0.8); },
  guijarro(g, p) { PX.carimbar(g, PX.roca(2, ['#4a4a52', '#7a7a88', '#a8a8b8', '#e0e0ec']), p.x, p.y - p.alt); },
  shuriken(g, p, t) { PX.carimbar(g, PX.shuriken(5), p.x, p.y - p.alt, t * 26); },
  shurikenGigante(g, p, t) { const x = px(p.x), y = px(p.y - p.alt); PX.anilloPix(g, x, y, 12 * p.escala, 12 * p.escala, 'rgba(159,220,255,0.5)', 1, 4, Math.floor(t * 18)); PX.carimbar(g, PX.shuriken(Math.round(9 * p.escala)), p.x, p.y - p.alt, t * 20); },
  bola(g, p) { bolaPixel(g, p.x, p.y - p.alt, 3 * p.escala, p.tipoAtq); },
};
const i2 = t => Math.floor(t * 12) % 2;
// bola de fogo: chama virada para trás, núcleo claro na frente
function llamaProj(g, p, t, tam) {
  const x = p.x, y = p.y - p.alt, rampa = rampaFuego(p.tipoAtq);
  const q = tamSprite(tam / 2.6);
  PX.carimbar(g, PX.llama(Math.floor(t * 14 + p.x * 0.1), q, rampa), x - Math.cos(p.ang) * q * 0.45, y - Math.sin(p.ang) * q * 0.45, p.ang - Math.PI / 2);
  PX.disco(g, px(x), px(y), Math.max(1, q * 0.18), rampa[3]);
}

export function dibujarEntidades(g, luta, fx, t, dibujarLutadorClon) {
  for (const e of luta.entidades) {
    switch (e.tipo) {
      case 'charco': {
        const k = Math.min(1, (e.dur - e.t) / 0.6);
        g.globalAlpha = 0.85 * k;
        PX.elipsePix(g, px(e.x), px(e.y), e.radio + 1, e.radio * 0.6 + 1, '#2a0f3a');
        PX.elipsePix(g, px(e.x), px(e.y), e.radio, e.radio * 0.6, '#7a2c92');
        PX.elipsePix(g, px(e.x - e.radio * 0.1), px(e.y - 1), e.radio * 0.7, e.radio * 0.38, '#9b46bd');
        PX.elipsePix(g, px(e.x - e.radio * 0.28), px(e.y - e.radio * 0.18), e.radio * 0.28, e.radio * 0.12, '#d68cf0');
        PX.anilloPix(g, px(e.x), px(e.y), e.radio * 0.9, e.radio * 0.55, '#c27ae0', 1, 4, Math.floor(e.t * 8));
        g.globalAlpha = 1;
        if (ale() < 0.12) fx.add({ x: e.x + entre(-e.radio, e.radio) * 0.7, y: e.y, vy: -22, g: 0, size: 2, life: 0.7, color: '#d68cf0', forma: 'burbuja' });
        break;
      }
      case 'humo': {
        const k = Math.min(1, e.t / 0.3) * Math.min(1, (e.dur - e.t) / 0.6);
        const n = 9;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * 7 + e.t * 0.4;
          PX.carimbar(g, PX.humo(Math.round(e.radio * 0.34)), px(e.x + Math.cos(a) * e.radio * 0.55), px(e.y + Math.sin(a) * e.radio * 0.4), 0, 1, 0.55 * k);
        }
        break;
      }
      case 'enredadera': {
        const k = Math.min(1, e.t / 0.25), fade = Math.min(1, (e.dur - e.t) / 0.25), at = e.sobre ? { x: e.sobre.x, y: e.sobre.y } : e;
        g.globalAlpha = fade;
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + i * 0.7, r = e.radio * (0.25 + 0.7 * ((i * 37) % 10) / 10), alto = (14 + (i * 11) % 14) * k;
          const bx = px(at.x + Math.cos(a) * r), by = px(at.y + Math.sin(a) * r * 0.6);
          PX.lineaPix(g, bx, by, bx + Math.sin(i * 2.1) * 3, by - alto, '#0f3a1c', 4);
          PX.lineaPix(g, bx, by, bx + Math.sin(i * 2.1) * 3, by - alto, '#2e8a34', 2);
          PX.lineaPix(g, bx, by - 1, bx + Math.sin(i * 2.1) * 3, by - alto + 1, '#8be04e', 1);
          PX.disco(g, bx + Math.sin(i * 2.1) * 3, by - alto, 2, '#4caf38');
        }
        PX.anilloPix(g, px(at.x), px(at.y), e.radio * k, e.radio * 0.65 * k, '#4caf38', 1, 3, Math.floor(e.t * 10));
        g.globalAlpha = 1;
        break;
      }
      case 'marcas': {
        for (const p of e.puntos) {
          if (p.golpeado) continue;
          const k = clampK((e.t - p.t0) / e.aviso), rad = p.radio ?? e.radio, col = e.estilo === 'erupcion' || e.estilo === 'roca' ? '#ffd23c' : colorTipo(e.tipoAtq);
          g.globalAlpha = e.t < p.t0 ? 0.35 : 0.9;
          PX.anilloPix(g, px(p.x), px(p.y), rad, rad * 0.6, '#04102c', 2);
          PX.anilloPix(g, px(p.x), px(p.y), rad, rad * 0.6, col, 1, 4, Math.floor(e.t * 12));
          if (e.t >= p.t0) { g.globalAlpha = 0.35; PX.elipsePix(g, px(p.x), px(p.y), rad * k, rad * 0.6 * k, 'rgba(255,150,40,0.7)'); }
          if (e.t >= p.t0 && e.estilo === 'roca') { const caida = (1 - k) * 90; g.globalAlpha = 1; PX.carimbar(g, PX.roca(6), p.x, p.y - caida - 6); }
          g.globalAlpha = 1;
        }
        break;
      }
      case 'meteoro': {
        if (e.fase === 'apunta' || e.fase === 'baja') {
          const k = e.fase === 'baja' ? 1 : e.k, R_ = e.radio, cx = px(e.x), cy = px(e.y), gira = Math.floor(t * 14);
          g.globalAlpha = 0.3 + 0.25 * k; PX.elipsePix(g, cx, cy, R_ * (0.4 + 0.6 * k), R_ * 0.6 * (0.4 + 0.6 * k), e.tipoAtq === 'FLYING' ? '#ffb02e' : '#ff4a3a');
          g.globalAlpha = 1;
          PX.anilloPix(g, cx, cy, R_ + 2, R_ * 0.6 + 2, '#04102c', 2);
          PX.anilloPix(g, cx, cy, R_, R_ * 0.6, '#ff6a5a', 1, 4, gira);
          PX.anilloPix(g, cx, cy, R_ * 0.55, R_ * 0.33, '#ffd0c0', 1, 3, gira + 1);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { PX.lineaPix(g, cx + dx * (R_ - 3), cy + dy * (R_ * 0.6 - 2), cx + dx * (R_ + 8), cy + dy * (R_ * 0.6 + 6), '#ff6a5a', 2); }
          PX.disco(g, cx, cy, 1.5, '#ffffff');
        }
        break;
      }
      case 'caparazon': {
        const l = e.dueno, a = e.ang, cx = px(l.x), cy = px(l.y - l.alto * 0.4), r = e.h.alcance * 0.7;
        g.globalAlpha = 0.28; PX.elipsePix(g, cx, cy + 2, r * 0.95, r * 0.7, '#4aa3f0'); g.globalAlpha = 1;
        for (const [ini, col] of [[a, '#9fdcff'], [a + Math.PI, '#4aa3f0']]) {
          PX.arcoPix(g, cx, cy, r, ini, ini + 2.6, '#04102c', 8, r * 0.8);
          PX.arcoPix(g, cx, cy, r, ini + 0.05, ini + 2.55, col, 5, r * 0.8);
          PX.arcoPix(g, cx, cy, r, ini + 0.4, ini + 2.2, '#ffffff', 2, r * 0.8);
        }
        // jatos de água que saem girando
        for (let j = 0; j < 4; j++) {
          const ang = a + j * Math.PI / 2 + 0.6, ca = Math.cos(ang), sa = Math.sin(ang);
          for (let k = 0; k < 7; k++) {
            const f = ((k / 7) + t * 2.2 + j * 0.25) % 1, d = r * (0.95 + f * 0.9);
            PX.carimbar(g, PX.gota(Math.max(5, Math.round(7 - f * 3)), PX.RAMPA_AGUA), cx + ca * d, cy + sa * d * 0.8, ang, 1, 1 - f * 0.7);
          }
        }
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
  const col = e.tipoAtq, [c0, c1, c2, c3] = paleta(col), rampa = rampaTipo(col);
  const ox = px(b.x), oy = px(b.y - alt);
  if (!e.activo) {
    // carga: esfera de energia que cresce, faíscas entrando e uma linha fina de mira
    const k = e.t / e.carga;
    PX.esfera(g, ox, oy, 2 + k * 7, rampa);
    const mx = b.x + Math.cos(e.ang) * 260, my = b.y - alt + Math.sin(e.ang) * 260;
    g.globalAlpha = 0.35; PX.anilloPix(g, ox, oy, 4 + k * 12, 4 + k * 12, c1, 1, 3, Math.floor(t * 20)); g.globalAlpha = 1;
    for (let i = 0; i < 18; i++) { const f = i / 18, ex = ox + (mx - ox) * f, ey = oy + (my - oy) * f; if (i % 2 === Math.floor(t * 12) % 2) { g.fillStyle = c1; g.globalAlpha = 0.5 * (1 - f); g.fillRect(px(ex), px(ey), 2, 1); } }
    g.globalAlpha = 1;
    const a = ale() * 6.28, rr = 22 + ale() * 14;
    fx.add({ x: ox + Math.cos(a) * rr, y: oy + Math.sin(a) * rr, vx: -Math.cos(a) * rr * 4, vy: -Math.sin(a) * rr * 4, size: 1.6, life: 0.25, color: c1, forma: 'chispa' });
    return;
  }
  const k = clampK(1 - (e.t - e.carga) / e.dur), ancho = e.h.anchoVisual ?? e.ancho * 1.4;
  const x2 = b.x + Math.cos(e.ang) * e.largo, y2 = b.y + Math.sin(e.ang) * e.largo - alt;
  const w = Math.max(3, Math.round(ancho * (0.5 + 0.5 * Math.min(1, (e.t - e.carga) / 0.12)) * (0.6 + 0.4 * k)));
  const largoTotal = Math.hypot(px(x2) - ox, px(y2) - oy), ux = (px(x2) - ox) / (largoTotal || 1), uy = (px(y2) - oy) / (largoTotal || 1), nxp = -uy, nyp = ux;
  const paletaH = e.h.paleta;
  if (paletaH === 'aura') {
    // sopro de manchas prateadas: nuvens de metal claro que correm pelo raio
    const N = Math.max(8, Math.floor(largoTotal / 5)), tonos = [['#6f9cc4', '#bfe2f6', '#f4fcff'], ['#8aa8c8', '#d6ecf8', '#ffffff']];
    for (let i = 0; i < N; i++) {
      const f = ((i / N) + t * 1.7) % 1, a1 = Math.sin(i * 12.9898) * 43758.5453, rnd = a1 - Math.floor(a1);
      const lado = (rnd - 0.5) * w * 0.7 * (0.5 + 0.5 * Math.sin(t * 9 + i));
      const tam = [4, 6, 8, 10, 12][Math.min(4, Math.floor(w * 0.18 * (0.6 + rnd * 0.8) / 2.2))] ?? 8;
      PX.carimbar(g, PX.humo(tam, tonos[i % 2]), ox + ux * f * largoTotal + nxp * lado, oy + uy * f * largoTotal + nyp * lado, 0, 1, 0.95 * Math.min(1, (1 - f) * 3));
    }
    for (let i = 0; i < 14; i++) { const f = ((i / 14) + t * 2.6) % 1; PX.disco(g, ox + ux * f * largoTotal + nxp * Math.sin(i * 3 + t * 20) * w * 0.25, oy + uy * f * largoTotal + nyp * Math.sin(i * 3 + t * 20) * w * 0.25, 1.2, '#ffffff'); }
    PX.esfera(g, ox, oy, Math.max(3, w * 0.4), ['#6a7894', '#b9c6dc', '#eef4ff', '#ffffff']);
    if (ale() < 0.5) fx.add({ x: px(x2), y: px(y2), vx: entre(-60, 60), vy: entre(-60, 60), size: 2.2, life: 0.35, color: '#e8f0ff', forma: 'chispa' });
    return;
  }
  if (e.h.forma === 'helice') {
    // Blast Burn: duas fitas trançadas, uma de fogo e outra azul, em volta de um núcleo claro
    const amp = (e.h.amplitud ?? 11) * 1.25, N = Math.max(12, Math.floor(largoTotal / 6));
    const fogo = rampaFuego(col), azul = ['#0c2a7a', '#2f6fe0', '#8fc4ff', '#ffffff'];
    g.globalAlpha = 0.95; PX.lineaPix(g, ox, oy, px(x2), px(y2), '#04102c', Math.max(3, Math.round(w * 0.34))); PX.lineaPix(g, ox, oy, px(x2), px(y2), '#ffd9a0', Math.max(2, Math.round(w * 0.2))); PX.lineaPix(g, ox, oy, px(x2), px(y2), '#ffffff', Math.max(1, Math.round(w * 0.09))); g.globalAlpha = 1;
    for (let i = N - 1; i >= 0; i--) {
      const f = i / N, fase = f * 12 - t * 16, d = largoTotal * f, env = 0.3 + f * 0.7;
      for (const [sgn, rampa] of [[1, fogo], [-1, azul]]) {
        const off = Math.sin(fase) * amp * sgn * env, frente = Math.cos(fase) * sgn > 0;
        const tam = tamSprite((w * 0.16 + f * 2.4) * (frente ? 1.15 : 0.85));
        PX.carimbar(g, PX.llama(Math.floor(t * 14 + i), tam, rampa), ox + ux * d + nxp * off, oy + uy * d + nyp * off, Math.atan2(uy, ux) - Math.PI / 2, 1, frente ? 1 : 0.8);
      }
    }
    PX.esfera(g, ox, oy, Math.max(3, w * 0.42), fogo);
    PX.anilloPix(g, px(x2), px(y2), 7 + Math.sin(t * 40) * 2, 6, '#ffd9a0', 1, 3, Math.floor(t * 30));
    if (ale() < 0.7) fx.add({ x: px(x2) + entre(-5, 5), y: px(y2) + entre(-5, 5), vx: entre(-80, 80), vy: entre(-80, 40), size: 2.4, life: 0.4, color: ale() < 0.5 ? '#ffd23c' : '#8fc4ff', forma: 'chispa' });
    return;
  }
  if (col === 'WATER') {
    // Hydro Pump / Hydro Cannon: ondas que rolam, com espuma, em vez de um cano liso
    const base = Math.max(3, Math.round(w * 0.62));
    g.globalAlpha = 0.95; PX.lineaPix(g, ox, oy, px(x2), px(y2), '#04102c', base + 3); PX.lineaPix(g, ox, oy, px(x2), px(y2), '#1f5ec4', base); PX.lineaPix(g, ox, oy, px(x2), px(y2), '#4aa3f0', Math.max(2, Math.round(base * 0.55))); g.globalAlpha = 1;
    const N = Math.max(6, Math.floor(largoTotal / 13)), tam = Math.max(5, Math.round(w * 0.36));
    for (let i = N - 1; i >= 0; i--) {
      const f = ((i / N) + t * 1.5) % 1, lado = Math.sin(i * 2.3 + t * 8) * w * 0.34, d = largoTotal * f;
      PX.carimbar(g, PX.ola(tam, Math.floor(t * 9 + i)), ox + ux * d + nxp * lado, oy + uy * d + nyp * lado, Math.atan2(uy, ux), 1, Math.min(1, f * 6, (1 - f) * 4 + 0.3));
    }
    for (let i = 0; i < 16; i++) { const f = ((i / 16) + t * 2.4) % 1, lado = Math.sin(i * 4.1 + t * 12) * w * 0.55; PX.disco(g, ox + ux * f * largoTotal + nxp * lado, oy + uy * f * largoTotal + nyp * lado, i % 3 ? 1 : 2, '#ffffff'); }
    PX.esfera(g, ox, oy, Math.max(3, w * 0.4), PX.RAMPA_AGUA);
    if (ale() < 0.8) fx.add({ x: px(x2), y: px(y2), vx: entre(-90, 90), vy: entre(-130, -30), g: 300, size: 2, life: 0.5, color: '#cfeeff', forma: 'gota', rampa: AGUA });
    return;
  }
  // o raio é uma corrente de trechos curtos com largura que ondula, para as bordas parecerem energia e não um cano
  const nTr = Math.max(2, Math.ceil(largoTotal / 9));
  const solar = paletaH === 'solar';
  const cA = solar ? '#b8860b' : c3, cB = solar ? '#ffd23c' : c2, cC = solar ? '#fff29a' : c1;
  const capas = [[4, '#04102c', 0.92, 1], [0, cA, 1, 1], [0, cB, 1, 0.74], [0, cC, 1, 0.46], [0, '#ffffff', 1, 0.2]];
  for (const [extra, color, alfa, f] of capas) {
    g.globalAlpha = alfa;
    for (let i = 0; i < nTr; i++) {
      const u0 = i / nTr, u1 = (i + 1) / nTr + 0.02, onda = 0.9 + 0.1 * Math.sin(t * 22 + i * 1.4) + (i % 3 === 0 ? 0.04 : 0);
      const gro = Math.max(1, Math.round((w * f + (f === 1 ? extra : 0)) * onda * (i === 0 ? 0.8 : 1)));
      PX.lineaPix(g, ox + (px(x2) - ox) * u0, oy + (px(y2) - oy) * u0, ox + (px(x2) - ox) * u1, oy + (px(y2) - oy) * u1, color, gro);
    }
  }
  g.globalAlpha = 1;
  if (col === 'WATER') for (let i = 0; i < 12; i++) { const f = ((i / 12) + t * 2.2) % 1, lado = (i % 2 ? 1 : -1) * w * 0.5; PX.disco(g, ox + ux * f * largoTotal + nxp * lado, oy + uy * f * largoTotal + nyp * lado, 1.8, '#ffffff'); }
  // nós de energia que correm pelo raio
  const nx = Math.cos(e.ang), ny = Math.sin(e.ang), n = Math.floor(e.largo / 14);
  for (let i = 0; i < n; i++) {
    const f = (((i / n) + t * 2.4) % 1), cx = ox + (px(x2) - ox) * f, cy = oy + (px(y2) - oy) * f;
    const lado = Math.sin(t * 30 + i * 1.7) * w * 0.3;
    PX.disco(g, cx - ny * lado, cy + nx * lado, i % 3 === 0 ? 2 : 1, i % 2 ? c0 : '#ffffff');
  }
  // boca e ponta
  PX.esfera(g, ox, oy, Math.max(3, w * 0.45), rampa);
  if (BRILLA.has(col) && ale() < 0.6) fx.chispas(x2 + (ale() - 0.5) * 8, y2 + (ale() - 0.5) * 8, c1, 1, 100);
  if (ale() < 0.5) fx.rafaga(x2, y2 + alt, col, 1, 80, { size: 2 });
}

function dibujarCono(g, e, t, fx) {
  const d = e.dueno, alt = d.alto * 0.5, h = e.h;
  const ox = d.x + Math.cos(e.ang) * 10, oy = d.y + Math.sin(e.ang) * 6 - alt;
  const tipo = h.tipo, k = clampK(1 - e.t / h.dur), semi = (h.angulo * Math.PI) / 360;
  // contorno do leque só no começo (mostra a área sem pintar um triângulo)
  if (e.t < 0.18) {
    g.globalAlpha = (1 - e.t / 0.18) * 0.7;
    for (const lado of [-1, 1]) { const a = e.ang + lado * semi; for (let r = 14; r < h.alcance; r += 7) { g.fillStyle = '#ffffff'; g.fillRect(px(ox + Math.cos(a) * r), px(oy + Math.sin(a) * r), 2, 1); } }
    PX.arcoPix(g, ox, oy, h.alcance, e.ang - semi, e.ang + semi, 'rgba(255,255,255,0.6)', 1);
    g.globalAlpha = 1;
  }
  const fuego = tipo === 'FIRE' || tipo === 'DRAGON';
  for (let i = 0; i < 4; i++) {
    const a = e.ang + (ale() - 0.5) * 2 * semi * 0.85, s = h.alcance * entre(2.2, 3.4), r0 = entre(4, 14);
    const base = { x: ox + Math.cos(a) * r0, y: oy + Math.sin(a) * r0, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 1.25, life: entre(0.4, 0.62) * (0.6 + 0.4 * k) };
    if (fuego) fx.add({ ...base, size: entre(2.6, 3.6), grow: 7, g: -30, forma: 'llama', rampa: rampaFuego(tipo) });
    else if (tipo === 'WATER') fx.add({ ...base, size: entre(1.6, 2.6), g: 80, forma: ale() < 0.6 ? 'gota' : 'burbuja', color: '#cfeeff', rampa: AGUA });
    else if (tipo === 'GRASS' || tipo === 'BUG') fx.add({ ...base, size: entre(1.8, 2.8), forma: 'hoja', vr: 8 });
    else if (tipo === 'POISON') fx.add({ ...base, size: entre(2, 3.2), forma: 'burbuja', color: '#d68cf0' });
    else fx.add({ ...base, size: entre(1.6, 3), grow: 3, forma: 'circulo', color: mezcla(colorTipo(tipo), 0.2) });
  }
}

export function dibujarProyectil(g, p, t) {
  const f = ESTILOS_PROJ[p.estilo] ?? ESTILOS_PROJ.bola;
  sombra(g, p.x, p.y, 3 * p.escala);
  f(g, p, t);
}
export function dibujarBomba(g, p) {
  sombra(g, p.x, p.y, 5);
  PX.esfera(g, px(p.x), px(p.y - p.alt), 5, ['#4a1a62', '#9b3fbf', '#d68cf0', '#f6d6ff']);
  PX.disco(g, px(p.x + 2), px(p.y - p.alt + 6), 1, '#9b3fbf');
}
