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

const MATCHA = ['#2a4a12', '#5f8f2a', '#a8d060', '#eef8d0'];
export class Efectos {
  constructor() {
    this.parts = []; this.anillos = []; this.tajos = []; this.textos = []; this.nums = []; this.globos = []; this.cortes = [];
    this.temblor = 0; this.flash = 0; this.flashColor = '#fff';
    this.anuncios = [];
    this.ondas = []; this.banners = []; this.cruces = []; this.espinas = []; this.zonas = []; this.grietas = []; this.rayos = []; this.relampagos = []; this.trazos = []; this.simbolos = []; this.colas = [];
  }

  add(p) { if (this.parts.length > 900) this.parts.splice(0, 80); this.parts.push({ vx: 0, vy: 0, g: 0, size: 2, life: 0.5, t: 0, drag: 0, grow: 0, forma: 'sq', rot: ale() * 6, vr: 0, hue: this.hue || 0, ...p }); }

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
  // rastro de uma passada (Cross Poison): faixa que some, escura por fora e clara no miolo
  trazo(x0, y0, x1, y1, tipo, estilo) { this.trazos.push({ x0, y0, x1, y1, tipo, estilo, t: 0, life: 0.5 }); }
  cruz(x, y, ang, tipo, largo) { this.cruces.push({ x, y, ang, tipo, largo, t: 0, life: 0.45 }); }
  tajo(x, y, ang, r, color, final, estilo, tipo) { this.tajos.push({ x, y, ang, r, color, final, estilo, tipo, hue: this.hue || 0, t: 0, life: final ? 0.24 : 0.17 }); }
  onda(x, y, ang, alcance, anguloDeg, tipo, estilo) { this.ondas.push({ x, y, ang, alcance, ang2: (anguloDeg * Math.PI) / 360, tipo, estilo, t: 0, life: 0.45 }); }
  anuncio(txt, op = {}) { this.anuncios = this.anuncios.filter(a => a.quien !== op.quien || op.quien === undefined); this.anuncios.push({ txt, color: op.color ?? '#ffffff', tam: op.tam ?? 16, dur: op.dur ?? 0.8, t: 0, quien: op.quien }); }

  // ---------------------------------------------------------------- eventos do motor
  consumir(luta, evs, camara) {
    for (const e of evs) {
      this.hue = hueShiny(e.l ?? e.dueno);
      switch (e.t) {
        case 'texto': this.texto(e.x, e.y, e.txt, e.color, { dur: 0.95 }); break;
        case 'numero': this.numero(e.x, e.y, e.dano, e.mult); break;
        case 'impacto': this.impacto(e); break;
        case 'anillo': this.anillo(e.x, e.y, 4, e.r ?? 22, e.color, 0.35); break;
        case 'explosion':
          this.add({ x: e.x, y: e.y, size: Math.max(12, e.radio * 0.8), life: 0.34, color: '#ffffff', brillo: mezcla(colorTipo(e.tipo), 0.3), forma: 'estouro' });
          this.rafaga(e.x, e.y, e.tipo, 14, 200, { size: 3, life: 0.55 });
          this.anillo(e.x, e.y, 4, e.radio, colorTipo(e.tipo), 0.3, 2);
          if (e.tipo === 'POISON') for (let i = 0; i < 16; i++) { const a = ale() * Math.PI * 2, s = entre(160, 320); this.add({ x: e.x, y: e.y - 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 40, drag: 4, size: entre(2, 3.2), life: entre(0.3, 0.5), color: ['#f0abfc', '#d946ef', '#a21caf'][i % 3], forma: 'chispa' }); }
          if (e.humo) this.humo(e.x, e.y, 6, 'rgba(230,230,240,0.55)', 10); else this.humo(e.x, e.y, 3, 'rgba(120,110,110,0.4)', 12);
          break;
        case 'area': this.anillo(e.x, e.y, 2, e.radio, colorTipo(e.tipo), 0.22, 2); break;
        case 'pulso':
          if (e.estilo === 'hielo') { for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, s = entre(80, 170); this.add({ x: e.x, y: e.y - 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 60, g: 260, size: entre(2, 3.4), life: entre(0.4, 0.7), color: ['#ffffff', '#bfe9ff', '#7ad8ff'][i % 3], forma: 'chispa' }); } this.anillo(e.x, e.y, 6, e.radio, '#bfe9ff', 0.45, 3); this.humo(e.x, e.y, 5, 'rgba(220,244,255,0.7)', 9); }
          if (e.estilo === 'tierra') this.anillo(e.x, e.y, 6, e.radio * 0.8, '#b08a50', 0.3, 1); else
          this.anillo(e.x, e.y, 6, e.radio, colorTipo(e.tipo), 0.4, 3);
          this.anillo(e.x, e.y, 2, e.radio * 0.7, '#ffffff', 0.3, 1);
          this.rafaga(e.x, e.y, e.tipo, 14, 160);
          if (e.estilo === 'electrico') { this.flash = Math.max(this.flash, 0.2); this.flashColor = '#fff6a8'; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + ale() * 0.3, r = e.radio * (0.5 + ale() * 0.45); this.add({ x: e.x + Math.cos(a) * r, y: e.y - 6 + Math.sin(a) * r * 0.6, vx: Math.cos(a) * 60, vy: Math.sin(a) * 40, size: 3, life: 0.3, color: '#ffe066', forma: 'chispa' }); } this.rayos.push({ x: e.x, y: e.y - 6, radio: e.radio, t: 0, life: 0.35, semilla: Math.floor(ale() * 999) }); }
          // Fire Spin como no site: um anel de chamas em volta, que sobe e gira devagar
          if (e.estilo === 'fuego') for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + ale() * 0.1, r = e.radio * 0.85; this.add({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r * 0.62, vx: -Math.sin(a) * 40, vy: Math.cos(a) * 24 - 20, g: -30, size: 3.2 + ale() * 1.2, grow: 0.8, life: 0.36 + ale() * 0.12, forma: 'llama', rampa: ['#e0400a', '#ff9a1a', '#ffe066', '#ffffff'] }); }
          if (e.estilo === 'tierra' || e.estilo === 'aterrizaje') { this.polvo(e.x, e.y, 6, 8); this.debris(e.x, e.y, 'ROCK', 8); }
          if (e.estilo === 'tierra') this.grietas.push({ x: e.x, y: e.y, radio: e.radio, t: 0, life: 1.1, semilla: Math.floor(ale() * 1000) });
          break;
        case 'tajo': this.tajo(e.l.x + Math.cos(e.ang) * 6, e.l.y - e.l.alto * 0.5 + Math.sin(e.ang) * 4, e.ang, e.alcance, colorTipo(e.tipo), e.final, e.estilo, e.tipo); if (e.final) this.chispas(e.l.x + Math.cos(e.ang) * e.alcance * 0.8, e.l.y - e.l.alto * 0.4, '#fff', 4, 200); break;
        case 'viento': this.onda(e.x, e.y, e.ang, e.alcance, e.angulo, e.tipo, e.estilo); break;
        case 'burbujaRompe': {
          // Barrier estourando: anel que abre e cacos de luz
          const cy = e.l.y - e.l.alto * 0.5;
          this.anillo(e.l.x, cy, e.l.alto * 0.5, e.l.alto * 0.9, '#e0b0ff', 0.25, 2);
          this.chispas(e.l.x, cy, '#f5d0fe', 10, 170);
          break;
        }
        case 'endurecer':
          if (e.estilo === 'barrera') { for (let i = 0; i < 3; i++) this.anillo(e.l.x, e.l.y - e.l.alto * 0.5, 4 + i * 6, e.l.alto * 0.8 + i * 4, i % 2 ? '#ffffff' : '#c084fc', 0.3 + i * 0.06, 2); }
          else if (e.estilo === 'algodon') this.humo(e.l.x, e.l.y - e.l.alto * 0.5, 9, 'rgba(240,244,255,0.85)', 9);
          else if (e.estilo === 'acero') { this.anillo(e.l.x, e.l.y - e.l.alto * 0.5, e.l.alto, e.l.alto * 0.5, '#d6e2ee', 0.3, 2); this.chispas(e.l.x, e.l.y - e.l.alto * 0.5, '#ffffff', 8, 160); }
          else { this.anillo(e.l.x, e.l.y - e.l.alto * 0.5, e.l.alto * 0.9, e.l.alto * 0.55, '#d6dbe4', 0.3, 2); this.chispas(e.l.x, e.l.y - e.l.alto * 0.5, '#ffffff', 5, 120); }
          break;
        case 'espejo': this.anillo(e.l.x, e.l.y - e.l.alto * 0.5, 4, e.l.alto * 0.9, '#e9d5ff', 0.3, 2); this.flash = Math.max(this.flash, 0.15); this.flashColor = '#f5e8ff'; break;
        case 'aquaRing': this.anillo(e.l.x, e.l.y, 4, 22, '#7dd3fc', 0.35, 2); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; this.add({ x: e.l.x + Math.cos(a) * 16, y: e.l.y + Math.sin(a) * 6, vx: Math.cos(a) * 20, vy: -50 - ale() * 30, g: 160, size: 2.2, life: 0.55, color: '#bfe9ff', forma: 'gota', rampa: AGUA }); } break;
        case 'recuperar': for (let i = 0; i < 7; i++) this.add({ x: e.l.x + (ale() - 0.5) * 24, y: e.l.y - ale() * e.l.alto, vy: -40 - ale() * 30, size: 2 + Math.floor(ale() * 2), life: 0.7, forma: 'cruz' }); this.anillo(e.l.x, e.l.y - e.l.alto * 0.5, 4, 26, '#3ccf4e', 0.3, 2); break;
        case 'estallido': this.anillo(e.l.x, e.l.y - e.l.alto * 0.5, 6, 70, '#c084fc', 0.35, 3); this.anillo(e.l.x, e.l.y - e.l.alto * 0.5, 2, 46, '#ffffff', 0.25, 1); this.flash = Math.max(this.flash, 0.25); this.flashColor = '#f0d6ff'; break;
        case 'ondaSonora': {
          // anel de notas musicais que sai em todas as direções, com ondas de som finas
          const o = e.onda ?? 0, n = 8 + o * 3, cores = ['#ffffff', '#bfe9ff', '#ffd6f2', '#fff6a8'];
          for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + o * 0.4; this.add({ x: e.x + Math.cos(a) * e.dist * 0.7, y: e.y - 8 + Math.sin(a) * e.dist * 0.42, vx: Math.cos(a) * 60, vy: Math.sin(a) * 36 - 20, drag: 2, size: 4 + (i % 2), life: 0.6, color: cores[i % cores.length], forma: 'nota' }); }
          this.anillo(e.x, e.y - 4, e.dist * 0.6, e.dist, colorTipo(e.tipo), 0.35, 2); this.anillo(e.x, e.y - 4, e.dist * 0.5, e.dist * 0.9, '#ffffff', 0.3, 1);
          this.temblor = Math.max(this.temblor, 2 + o);
          break;
        }
        case 'pulsoTorreta': this.anillo(e.x, e.y, 6, e.radio, '#e055b0', 0.35, 2); this.anillo(e.x, e.y, 4, e.radio * 0.8, '#9fdcff', 0.3, 1); break;
        case 'torretaNace': this.anillo(e.x, e.y, 2, 16, '#9fdcff', 0.25, 2); this.rafaga(e.x, e.y - 10, 'WATER', 8, 90); break;
        case 'geiserAviso': {
          this.zonas.push({ x: e.x, y: e.y, radio: e.radio + 4, t: 0, life: e.dur + 0.15 });
          // água verde girando em volta da Sinistcha quando ela chama o gêiser
          for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; this.add({ x: e.l.x + Math.cos(a) * 18, y: e.l.y - 4 + Math.sin(a) * 9, vx: -Math.sin(a) * 70, vy: Math.cos(a) * 35 - 30, drag: 2, size: 2.4, life: 0.5, color: '#a8d060', forma: 'gota', rampa: MATCHA }); }
          break;
        }
        case 'geiser': {
          // coluna de água verde que sobe debaixo do alvo
          for (let i = 0; i < 26; i++) { const a = ale() * Math.PI * 2, r = ale() * e.radio * 0.6; this.add({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r * 0.5, vx: Math.cos(a) * 40, vy: -160 - ale() * 160, g: 420, size: 2.4 + ale() * 1.6, life: 0.6 + ale() * 0.3, color: '#a8d060', forma: 'gota', rampa: MATCHA }); }
          this.humo(e.x, e.y - 10, 6, 'rgba(160,210,110,0.55)', 9);
          this.anillo(e.x, e.y, 4, e.radio * 1.3, '#8bc34a', 0.35, 3); this.anillo(e.x, e.y, 2, e.radio, '#eef8d0', 0.3, 1);
          this.temblor = Math.max(this.temblor, 4);
          break;
        }
        case 'tormentaImpacto': {
          for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + ale() * 0.5, r = e.radio * (0.4 + ale() * 0.6); this.relampagos.push({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r * 0.6, t: -i * 0.04, life: 0.24, semilla: Math.floor(ale() * 999) }); }
          this.relampagos.push({ x: e.x, y: e.y, t: 0, life: 0.3, semilla: 7 });
          this.rayos.push({ x: e.x, y: e.y - 4, radio: e.radio * 1.2, t: 0, life: 0.4, semilla: Math.floor(ale() * 999) });
          this.flash = 0.5; this.flashColor = '#fff6a8'; this.temblor = Math.max(this.temblor, 8);
          break;
        }
        case 'succion': this.anillo(e.x, e.y, e.radio, 8, '#ffffff', 0.35, 2); this.anillo(e.x, e.y, e.radio * 0.7, 6, '#cfd8e6', 0.3, 1); break;
        case 'reflejo': this.anillo(e.l.x, e.l.y - e.l.alto * 0.5, 6, e.l.alto * 0.8, '#bfdbfe', 0.25, 2); this.chispas(e.l.x, e.l.y - e.l.alto * 0.5, '#ffffff', 5, 160); break;
        case 'teleport': {
          if (e.estilo === 'glitch') {
            // Glitch Step: blocos ciano e magenta no lugar de onde saiu e para onde foi
            for (const [x, y] of [[e.x0, e.y0], [e.x1, e.y1]]) for (let i = 0; i < 10; i++) this.add({ x: x + (ale() - 0.5) * 24, y: y - 12 + (ale() - 0.5) * 22, vx: (ale() - 0.5) * 60, size: 3 + ale() * 3, life: 0.3, color: ['#2ff3ff', '#ff3ad8', '#ffffff'][i % 3], forma: 'sq', vr: 0 });
            break;
          }
          // some num brilho e reaparece com anéis, como o Teleport do jogo
          for (const [x, y, k] of [[e.x0, e.y0, 0], [e.x1, e.y1, 1]]) {
            this.anillo(x, y - 12, k ? 18 : 2, k ? 2 : 20, '#ff9ad8', 0.3, 2);
            this.anillo(x, y - 12, k ? 10 : 2, k ? 1 : 12, '#ffffff', 0.25, 1);
            for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; this.add({ x: x + Math.cos(a) * (k ? 16 : 4), y: y - 12 + Math.sin(a) * (k ? 10 : 3), vx: Math.cos(a) * (k ? -50 : 70), vy: Math.sin(a) * (k ? -30 : 40), size: 2, life: 0.3, color: i % 2 ? '#ffffff' : '#ff9ad8', forma: 'chispa' }); }
          }
          break;
        }
        case 'lacoAgarra': this.anillo(e.x, e.y - 10, 4, 22, '#ff9ad8', 0.3, 2); this.chispas(e.x, e.y - 10, '#ffd6f2', 8, 180); break;
        case 'lacoLanza': this.anillo(e.x, e.y - 10, 6, 34, '#e055b0', 0.35, 3); this.anillo(e.x, e.y - 10, 2, 22, '#ffffff', 0.25, 1); this.chispas(e.x, e.y - 10, '#ffffff', 10, 260); this.flash = 0.25; this.flashColor = '#ffd6f2'; break;
        case 'chapoteo': this.rafaga(e.x, e.y - 2, 'WATER', 7, 110); this.add({ x: e.x, y: e.y - 2, size: 12, life: 0.3, forma: 'salpicadura' }); break;
        case 'potenciar': { const c = colorTipo(e.tipo); for (let i = 0; i < 3; i++) this.anillo(e.l.x, e.l.y - e.l.alto * 0.5, 6 + i * 5, 26 + i * 8, i % 2 ? '#ffffff' : c, 0.35 + i * 0.08, 2); for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; this.add({ x: e.l.x + Math.cos(a) * 12, y: e.l.y - 4 + Math.sin(a) * 6, vx: Math.cos(a) * 30, vy: -60 - ale() * 50, drag: 2, size: 2.6, life: 0.55, color: c, forma: 'llama', rampa: ['#2a1060', '#6d3fd8', '#a78bfa', '#ede9fe'] }); } this.temblor = Math.max(this.temblor, 2); break; }
        case 'endurecer': this.anillo(e.l.x, e.l.y - e.l.alto * 0.5, e.l.alto * 0.9, e.l.alto * 0.55, '#d6dbe4', 0.3, 2); this.chispas(e.l.x, e.l.y - e.l.alto * 0.5, '#ffffff', 5, 120); break;
        case 'cargaExplosion': for (let i = 0; i < 3; i++) this.anillo(e.l.x, e.l.y - e.l.alto * 0.5, 40 - i * 8, 6, i % 2 ? '#ffffff' : '#ffb347', e.dur * (0.7 + i * 0.15), 2); break;
        case 'autoExplosion':
          this.flash = 0.7; this.flashColor = '#fff6d8'; this.temblor = Math.max(this.temblor, 9);
          this.anillo(e.x, e.y, 8, e.radio, '#ffd23c', 0.4, 4); this.anillo(e.x, e.y, 4, e.radio * 0.75, '#ffffff', 0.3, 2);
          for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, r = e.radio * (0.2 + ale() * 0.55); this.add({ x: e.x + Math.cos(a) * r, y: e.y - 8 + Math.sin(a) * r * 0.6, size: 14 + ale() * 8, life: 0.45 + ale() * 0.2, forma: 'estouro', color: '#ff7a1a', brillo: '#ffe27a' }); }
          this.humo(e.x, e.y - 6, 10, 'rgba(90,80,80,0.6)', 12); this.debris(e.x, e.y, 'ROCK', 8);
          break;
        case 'trampaSalta': for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; this.add({ x: e.x, y: e.y - 3, vx: Math.cos(a) * 70, vy: Math.sin(a) * 40 - 60, g: 260, size: 2.4, life: 0.45, color: '#7ac74c', forma: 'hoja' }); } this.anillo(e.x, e.y, 4, 20, '#7ac74c', 0.25, 2); break;
        case 'zonaRaiz': this.zonas.push({ x: e.x, y: e.y, radio: e.radio, t: 0, life: e.dur + 0.35 }); break;
        case 'raices': { const o = e.onda ?? 0, n = 6 + o * 4; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + o * 0.35 + (ale() - 0.5) * 0.2, d = e.dist + (ale() - 0.5) * 8; this.espinas.push({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d * 0.62, alto: 15 + o * 3 + Math.round(ale() * 6), semilla: i + o * 7, vid: true, t: -i * 0.018, life: 0.75 }); } this.anillo(e.x, e.y, e.dist * 0.5, e.dist, '#4caf38', 0.3, 2); this.polvo(e.x, e.y, 6 + (e.onda ?? 0) * 3, 6); this.temblor = Math.max(this.temblor, 3 + (e.onda ?? 0) * 2); break; }
        case 'humo': this.humo(e.x, e.y, 10, 'rgba(140,165,135,0.6)', e.radio * 0.4); break;
        case 'dash': this.polvo(e.l.x, e.l.y, 4, 5); break;
        case 'desaparece': this.rafaga(e.l.x, e.l.y, e.modo === 'tierra' ? 'GROUND' : 'FLYING', 14, 150); if (e.modo === 'tierra') this.debris(e.l.x, e.l.y, 'ROCK', 6); break;
        case 'evolucion':
          for (let i = 0; i < 5; i++) this.anillo(e.l.x, e.l.y - e.l.alto * 0.5, 30, 4, (e.mega ? ['#2f7fe0', '#5fd08a', '#8fd8f0', '#a8e070', '#e6f8ff'] : ['#ff6fd8', '#ffd23c', '#8be09a', '#6fd0ff', '#b07aff'])[i], 0.4 + i * 0.05, 2);
          this.rafaga(e.l.x, e.l.y - e.l.alto * 0.5, e.mega ? 'WATER' : 'FAIRY', 30, 220, { life: 0.8 });
          if (e.mega) this.rafaga(e.l.x, e.l.y - e.l.alto * 0.5, 'GRASS', 20, 200, { life: 0.8 });
          this.flash = e.mega ? 0.9 : 0.6; this.flashColor = '#ffffff'; this.temblor = Math.max(this.temblor, 6);
          break;
        case 'evoInicio': sfx('evoCarga'); this.temblor = Math.max(this.temblor, 2); break;
        case 'megaInicio': {
          // símbolo da Mega Evolução subindo e partículas nas cores dele
          const cy = e.l.y - e.l.alto * 0.5, cores = ['#4aa3f0', '#8fd8f0', '#e6f8ff', '#5fd08a', '#a8e070', '#2f7fe0'];
          this.anillo(e.l.x, cy, 4, 44, '#8fd8f0', 0.9, 3); this.anillo(e.l.x, cy, 4, 30, '#a8e070', 0.7, 2);
          for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2, s = entre(60, 170); this.add({ x: e.l.x, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, drag: 2, size: entre(2, 3.4), life: entre(0.6, 1), color: cores[i % 6], forma: 'chispa' }); }
          this.simbolos.push({ x: e.l.x, y: e.l.y - e.l.alto - 20, t: 0, life: 1.4 });
          break;
        }
        case 'ko': this.flash = 0.5; this.flashColor = '#ffffff'; this.temblor = Math.max(this.temblor, 10); this.anuncio('K.O!', { color: '#ff4040', tam: 32, dur: 1.3 }); this.chispas(e.l.x, e.l.y - e.l.alto * 0.5, '#fff', 16, 420); break;
        case 'tiempo': this.anuncio('TIME!', { color: '#ffd23c', tam: 32, dur: 1.2 }); break;
        case 'anuncio': this.anuncio(e.txt, { color: e.color, tam: e.tam, dur: e.dur, quien: e.quien }); break;
        case 'habilidad': if (e.slot === 'e') this.banner(`${e.h.nombre}!`, e.h.tipo); else if (e.slot !== 'lmb') this.globo(e.l, `${e.h.nombre}!`, e.h.tipo); break;
        case 'cruz': this.cruz(e.x, e.y, e.ang, e.tipo, e.largo); break;
        case 'rastroLlama': for (let i = 0; i < 2; i++) this.add({ x: e.x + entre(-5, 5), y: e.y + entre(-4, 4), vx: entre(-30, 30), vy: entre(10, 40), size: entre(2.4, 3.6), grow: 2, life: 0.4, forma: 'llama', rampa: rampaFuego(e.tipo) }); break;
        case 'corazones': for (let i = 0; i < 14; i++) { const a = ale() * Math.PI * 2, s = entre(50, 150); this.add({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 60, g: 90, drag: 1, size: entre(1.6, 2.6), life: entre(0.6, 1), forma: 'corazon' }); } for (let i = 0; i < 6; i++) this.add({ x: e.x + entre(-20, 20), y: e.y + entre(-6, 6), vy: -entre(30, 60), size: entre(2, 3), life: 1.1, forma: 'corazon' }); this.anillo(e.x, e.y + 10, 6, 44, '#ff9ac8', 0.4, 2); break;
        case 'colaGigante': this.colas.push({ l: e.l, ang: e.ang, r: e.r, t: 0, life: 0.45 }); break;
        case 'trazo': this.trazo(e.x0, e.y0, e.x1, e.y1, e.tipo, e.estilo); break;
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
    if (e.estilo === 'rayo') { this.relampagos.push({ x: e.x, y: e.y, t: 0, life: 0.22, semilla: Math.floor(ale() * 999) }); this.rayos.push({ x: e.x, y: e.y - 4, radio: 40, t: 0, life: 0.25, semilla: Math.floor(ale() * 999) }); this.flash = Math.max(this.flash, 0.18); this.flashColor = '#fff6a8'; this.temblor = Math.max(this.temblor, 3); }
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
    for (const c of this.colas) c.t += dt; this.colas = this.colas.filter(c => c.t < c.life);
    for (const c of this.simbolos) c.t += dt; this.simbolos = this.simbolos.filter(c => c.t < c.life);
    for (const c of this.trazos) c.t += dt; this.trazos = this.trazos.filter(c => c.t < c.life);
    for (const c of this.espinas) c.t += dt; this.espinas = this.espinas.filter(c => c.t < c.life);
    for (const z of this.zonas) z.t += dt; this.zonas = this.zonas.filter(z => z.t < z.life);
    for (const c of this.relampagos) c.t += dt; this.relampagos = this.relampagos.filter(c => c.t < c.life);
    for (const c of this.rayos) c.t += dt; this.rayos = this.rayos.filter(c => c.t < c.life);
    for (const c of this.grietas) c.t += dt; this.grietas = this.grietas.filter(c => c.t < c.life);
    this.temblor = Math.max(0, this.temblor - dt * 24);
    this.flash = Math.max(0, this.flash - dt * 3);
  }

  // marcas no chão (área da Frenzy Plant): aparecem antes das raízes, para dar para fugir
  dibujarSuelo(g) {
    // rachaduras do Earthquake: linhas quebradas que saem do centro e somem
    for (const c of this.grietas) {
      const a = Math.min(1, (c.life - c.t) / 0.4), cresce = Math.min(1, c.t / 0.12);
      g.globalAlpha = a;
      let sd = c.semilla;
      const rnd = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
      for (let i = 0; i < 7; i++) {
        let ang = (i / 7) * Math.PI * 2 + rnd() * 0.5, x = c.x, y = c.y;
        const passos = 4, largo = c.radio * (0.3 + rnd() * 0.25) * cresce / passos;
        for (let k = 0; k < passos; k++) {
          ang += (rnd() - 0.5) * 0.9;
          const nx = x + Math.cos(ang) * largo, ny = y + Math.sin(ang) * largo * 0.6;
          PX.lineaPix(g, x, y, nx, ny, '#2a1606', 3 - Math.floor(k / 2)); PX.lineaPix(g, x, y - 1, nx, ny - 1, '#8a6238', 1);
          if (k === 1 && rnd() < 0.6) { const ra = ang + (rnd() < 0.5 ? 0.8 : -0.8); PX.lineaPix(g, nx, ny, nx + Math.cos(ra) * largo * 0.6, ny + Math.sin(ra) * largo * 0.36, '#2a1606', 1); }
          x = nx; y = ny;
        }
      }
    }
    g.globalAlpha = 1;
    for (const z of this.zonas) {
      const a = Math.min(1, z.t / 0.12) * Math.min(1, (z.life - z.t) / 0.3), pul = 0.5 + 0.5 * Math.sin(z.t * 18);
      g.globalAlpha = a * 0.22; g.fillStyle = '#3f8f2a';
      g.beginPath(); g.ellipse(R(z.x), R(z.y), z.radio, z.radio * 0.62, 0, 0, 7); g.fill();
      g.globalAlpha = a * (0.25 + 0.15 * pul);
      PX.anilloPix(g, z.x, z.y, z.radio, z.radio * 0.62, '#84cc16', 1, 9, Math.floor(z.t * 20));
    }
    g.globalAlpha = 1;
  }

  // raios elétricos que saem do centro (Thunder Wave, Discharge)
  dibujarRayos(g) {
    // raio que cai do céu (Thunder Storm): zigue-zague grosso amarelo com núcleo branco e clarão no chão
    for (const c of this.relampagos) {
      if (c.t < 0) continue;
      const a = Math.min(1, (c.life - c.t) / 0.12);
      let sd = c.semilla + Math.floor(c.t * 40);
      const rnd = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
      g.globalAlpha = a * 0.4; PX.elipsePix(g, c.x, c.y, 18, 10, '#fff6a8'); g.globalAlpha = a;
      for (const [cor, lw] of [['rgba(255,214,60,0.45)', 9], ['#04102c', 5], ['#ffd23c', 3], ['#ffffff', 1]]) {
        let sd2 = sd, x0 = c.x + 10, y0 = c.y - 170;
        const r2 = () => ((sd2 = (sd2 * 9301 + 49297) % 233280) / 233280);
        for (let k = 1; k <= 7; k++) { const x1 = k === 7 ? c.x : c.x + 10 - k * 1.4 + (r2() - 0.5) * 16, y1 = c.y - 170 + k * (170 / 7); PX.lineaPix(g, x0, y0, x1, y1, cor, lw); x0 = x1; y0 = y1; }
      }
      void rnd;
    }
    g.globalAlpha = 1;
    for (const c of this.rayos) {
      let sd = c.semilla + Math.floor(c.t * 30);
      const rnd = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
      g.globalAlpha = Math.min(1, (c.life - c.t) / 0.15);
      for (let i = 0; i < 7; i++) {
        let a = (i / 7) * Math.PI * 2 + rnd() * 0.4, x = c.x, y = c.y;
        for (let k = 0; k < 4; k++) { a += (rnd() - 0.5) * 1.1; const L = c.radio * 0.25, nx = x + Math.cos(a) * L, ny = y + Math.sin(a) * L * 0.6; PX.lineaPix(g, x, y, nx, ny, '#04102c', 4); PX.lineaPix(g, x, y, nx, ny, '#ffd23c', 2); PX.lineaPix(g, x, y, nx, ny, '#ffffff', 1); x = nx; y = ny; }
      }
    }
    g.globalAlpha = 1;
  }

  dibujar(g) {
    this.dibujarRayos(g);
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
    for (const a of this.tajos) conHue(g, a.hue, () => this.dibujarTajo(g, a));
    g.globalAlpha = 1;
    // cauda gigante da Milotic: faixa azul curva com listras brancas e barbatana, dando uma volta
    for (const c of this.colas) {
      const k = c.t / c.life, a0 = c.ang + k * Math.PI * 2, cx = c.l.x, cy = c.l.y - c.l.alto * 0.4, N = 14, al = Math.min(1, (1 - k) * 4);
      const pt = i => { const f = i / N, a = a0 - (1 - f) * 2.2, r = 8 + c.r * f; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.62, a, f]; };
      g.globalAlpha = al;
      for (let i = 0; i < N; i++) { const [x1, y1, , f] = pt(i), [x2, y2] = pt(i + 1), w = Math.round(16 - f * 6); PX.lineaPix(g, x1, y1, x2, y2, '#0b2a6a', w + 3); PX.lineaPix(g, x1, y1, x2, y2, '#2f7fe0', w); PX.lineaPix(g, x1, y1 - w * 0.25, x2, y2 - w * 0.25, '#7ac8ff', Math.max(1, Math.round(w * 0.3))); }
      for (let i = 2; i < N; i += 2) { const [x, y, a, f] = pt(i), w = 9 - f * 3, nx = Math.cos(a), ny = Math.sin(a) * 0.62; PX.lineaPix(g, x - nx * w, y - ny * w, x + nx * w, y + ny * w, '#e6f6ff', 1); }
      const [fx2, fy2, fa] = pt(N);
      for (let j = -2; j <= 2; j++) { const a = fa + Math.PI / 2 + j * 0.35; PX.lineaPix(g, fx2, fy2, fx2 + Math.cos(a) * 22, fy2 + Math.sin(a) * 14, j % 2 ? '#bfe4ff' : '#4aa3f0', 3); }
      g.globalAlpha = 1;
    }
    for (const c of this.simbolos) {
      if (!IMG_MEGA?.complete || !IMG_MEGA.naturalWidth) continue;
      const k = c.t / c.life, al = Math.min(1, k * 6, (1 - k) * 3), esc = 0.5 + 0.2 * Math.min(1, k * 5);
      g.globalAlpha = al; g.drawImage(IMG_MEGA, Math.round(c.x - IMG_MEGA.naturalWidth * esc / 2), Math.round(c.y - k * 16 - IMG_MEGA.naturalHeight * esc), Math.round(IMG_MEGA.naturalWidth * esc), Math.round(IMG_MEGA.naturalHeight * esc)); g.globalAlpha = 1;
    }
    for (const c of this.trazos) {
      const al = 1 - c.t / c.life, [, c2, c1] = rampaTipo(c.tipo), w = Math.max(1, Math.round(4 * al));
      g.globalAlpha = al * 0.9;
      PX.lineaPix(g, c.x0, c.y0, c.x1, c.y1, '#04102c', w + 3); PX.lineaPix(g, c.x0, c.y0, c.x1, c.y1, c2, w + 1); PX.lineaPix(g, c.x0, c.y0, c.x1, c.y1, c1, Math.max(1, w - 2));
      g.globalAlpha = 1;
    }
    for (const c of this.cruces) {
      const k = c.t / c.life, alfa = Math.min(1, (1 - k) * 1.8), cx = c.x, cy = c.y, L = c.largo * (0.55 + 0.45 * Math.min(1, k * 4));
      const ca = Math.cos(c.ang), sa = Math.sin(c.ang), [, c2, c1] = rampaTipo(c.tipo);
      g.globalAlpha = alfa;
      // um X curto e grosso no alvo (duas barras cruzadas), com brilho do tipo
      for (const s2 of [1, -1]) {
        const bx = ca, by = sa * s2, x1 = cx - bx * L, y1 = cy - by * L, x2 = cx + bx * L, y2 = cy + by * L;
        g.globalAlpha = alfa * 0.4; PX.lineaPix(g, x1, y1, x2, y2, c2, 10); g.globalAlpha = alfa;
        PX.lineaPix(g, x1, y1, x2, y2, '#04102c', 6); PX.lineaPix(g, x1, y1, x2, y2, c2, 4); PX.lineaPix(g, x1, y1, x2, y2, c1, 2);
      }
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
    const matices = [0, ...new Set(this.parts.map(p => p.hue).filter(Boolean))];
    for (const hu of matices) {
    if (hu) { g.save(); g.filter = `hue-rotate(${hu}deg)`; }
    for (const p of this.parts) {
      if ((p.hue || 0) !== hu) continue;
      const a = 1 - p.t / p.life;
      g.globalAlpha = Math.max(0, a);
      g.fillStyle = p.color;
      const s = Math.max(0.6, p.size);
      const al = Math.max(0, a);
      switch (p.forma) {
        // chama deitada no sentido do voo, com a ponta para trás (jato do Flamethrower)
        case 'llamaDir': PX.carimbar(g, PX.llama(Math.floor(p.t * 14 + p.rot), tamSprite(s), p.rampa ?? PX.RAMPA_FOGO), p.x, p.y, Math.atan2(p.vy, p.vx) - Math.PI / 2, 1, Math.min(1, (1 - p.t / p.life) * 2.5)); break;
        case 'corazon': PX.carimbar(g, PX.corazon(Math.max(1, Math.round(s * 0.7))), p.x, p.y, 0, 1, al); break;
        case 'llama': PX.carimbar(g, PX.llama(Math.floor(p.t * 14 + p.rot), tamSprite(s), p.rampa ?? PX.RAMPA_FOGO), p.x, p.y, 0, 1, 1); break;
        case 'gota': PX.carimbar(g, PX.gota(Math.max(5, Math.round(s * 3.2)), p.rampa), p.x, p.y, Math.atan2(p.vy, p.vx), 1, al); break;
        case 'hoja': PX.carimbar(g, PX.hoja(Math.max(6, Math.round(s * 3.4))), p.x, p.y, p.rot, 1, al); break;
        case 'chispa': PX.carimbar(g, PX.chispa(Math.max(2, Math.round(s)), /^#/.test(p.color) ? p.color : '#ffffff'), p.x, p.y, 0, 1, 1); break;
        case 'burbuja': PX.carimbar(g, PX.burbuja(Math.max(2, Math.round(s)), /^#/.test(p.color) ? p.color : '#bfe9ff'), p.x, p.y, 0, 1, 1); break;
        case 'salpicadura': PX.carimbar(g, PX.salpicadura(Math.floor((p.t / p.life) * 4), Math.max(7, Math.round(p.size))), p.x, p.y - 2, 0, 1, 1); break;
        case 'estouro': PX.carimbar(g, PX.estouro(Math.floor((p.t / p.life) * 4), Math.max(6, Math.round(p.size)), p.color, p.brillo ?? '#ffd23c'), p.x, p.y, 0, 1, 1); break;
        case 'humo': PX.carimbar(g, PX.humo(Math.max(3, Math.round(s * 0.9)), p.tono), p.x, p.y, 0, 1, p.alfa ?? 0.8); break;
        case 'nota': PX.carimbar(g, PX.nota(Math.max(3, Math.round(s)), /^#/.test(p.color) ? p.color : '#ffffff'), p.x, p.y + Math.sin(p.t * 12) * 1.5, 0, 1, al); break;
        case 'cruz': PX.carimbar(g, PX.cruzCura(Math.max(2, Math.round(s))), p.x, p.y, 0, 1, al); break;
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
    if (hu) g.restore();
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
      // cauda de aço como no site: meia-lua prateada larga que varre na frente
      const gro = a.final ? 8 : 6, a0 = a.ang - 1.35 + k * 0.9, a1 = a.ang + 1.1 - k * 0.15;
      PX.arcoPix(g, a.x, a.y, rr, a0, a1, '#04102c', gro + 2, rr * 0.82);
      PX.arcoPix(g, a.x, a.y, rr, a0, a1, '#6f8296', gro, rr * 0.82);
      PX.arcoPix(g, a.x, a.y, rr, a0 + 0.1, a1 - 0.08, '#d6e2ee', Math.max(2, gro - 3), rr * 0.82);
      PX.arcoPix(g, a.x, a.y, rr * 0.97, a0 + 0.3, a1 - 0.2, '#ffffff', 1, rr * 0.8);
    } else if (a.tipo === 'FIGHTING' && a.estilo !== 'hueso') {
      // socos (Force Palm, Close Combat): estouro laranja na frente, como no site
      PX.carimbar(g, PX.estouro(Math.floor(k * 3), Math.max(9, Math.round(rr * 0.4)), '#fff2c0', '#ff8a2a'), fx, fy);
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
  algodonProj(g, p, t) { PX.carimbar(g, PX.humo(9, ['#c8d0e8', '#eef2ff', '#ffffff']), p.x, p.y - p.alt, t * 4, 1, 1); PX.carimbar(g, PX.humo(5, ['#dfe6f8', '#ffffff', '#ffffff']), p.x - Math.cos(p.ang) * 7, p.y - p.alt - Math.sin(p.ang) * 5, 0, 1, 0.8); },
  hoja(g, p, t) { PX.carimbar(g, PX.hoja(Math.round(9 * p.escala)), p.x, p.y - p.alt, t * 14 + p.x * 0.05); },
  semilla(g, p) { PX.esfera(g, px(p.x), px(p.y - p.alt), 3, ['#5a3a12', '#9a6a22', '#d6a64a', '#fff0b0']); PX.disco(g, px(p.x + 1), px(p.y - p.alt + 1), 1, '#3f8a2a'); },
  brasa(g, p, t) { llamaProj(g, p, t, 8 * p.escala); },
  fuego(g, p, t) { llamaProj(g, p, t, 12 * p.escala); },
  chorrito(g, p) { PX.carimbar(g, PX.gota(Math.round(7 * Math.min(1.8, p.escala)), AGUA), p.x, p.y - p.alt, p.ang); },
  espuma(g, p, t) { PX.carimbar(g, PX.burbuja(Math.round(4 * p.escala)), p.x + Math.sin(t * 9 + p.x) * 0.6, p.y - p.alt); },
  burbuja(g, p, t) { PX.carimbar(g, PX.burbujaLlena(4 + (Math.floor(p.x * 7 + p.y * 3) & 1)), p.x + Math.sin(t * 11 + p.y) * 0.8, p.y - p.alt); },
  pulsoAgua(g, p, t) {
    const x = px(p.x), y = px(p.y - p.alt), r = 4 * p.escala, f = Math.floor(t * 14) % 3;
    PX.anilloPix(g, x, y, r + 5 + f, r + 5 + f, '#04102c', 2); PX.anilloPix(g, x, y, r + 5 + f, r + 5 + f, '#9fdcff', 1, 5, f);
    PX.esfera(g, x, y, r, AGUA);
  },
  cuchilla(g, p, t) { PX.carimbar(g, PX.anilloAire(7), p.x, p.y - p.alt, p.ang); for (let i = 1; i <= 3; i++) { g.fillStyle = '#ffffff'; g.globalAlpha = 0.7 - i * 0.18; g.fillRect(px(p.x - Math.cos(p.ang) * i * 6 + Math.sin(p.ang) * Math.sin(t * 30 + i) * 3), px(p.y - p.alt - Math.sin(p.ang) * i * 5), 2, 2); } g.globalAlpha = 1; },
  roca(g, p, t) { PX.carimbar(g, PX.roca(Math.max(3, Math.round(3.6 * p.escala))), p.x, p.y - p.alt, t * 9); },
  vacio(g, p) { PX.carimbar(g, PX.mediaLuna(8, ['#6a1f10', '#e0623a', '#ffb08a', '#ffffff']), p.x, p.y - p.alt, p.ang); },
  // Dragon Pulse: esfera de energia dracônica com uma chama roxa atrás
  dragonPulse(g, p, t) {
    const x = px(p.x), y = px(p.y - p.alt), r = 3.2 * p.escala, RAMPA = ['#1a0f5a', '#5a3fd8', '#9f8aff', '#ece6ff'];
    PX.carimbar(g, PX.llama(Math.floor(t * 16), tamSprite(r * 0.9), RAMPA), x - Math.cos(p.ang) * r, y - Math.sin(p.ang) * r, p.ang - Math.PI / 2);
    g.globalAlpha = 0.35; PX.disco(g, x, y, r + 3, '#8f7aff'); g.globalAlpha = 1;
    PX.esfera(g, x, y, r, RAMPA);
  },
  // Fairy Wind: redemoinho rosa com três brilhos girando
  brisaHada(g, p, t) {
    const x = px(p.x), y = px(p.y - p.alt);
    g.globalAlpha = 0.4; PX.disco(g, x, y, 5, '#ffc2e8'); g.globalAlpha = 1;
    PX.arcoPix(g, x, y, 5, t * 14, t * 14 + 3.5, '#ff8ad0', 2, 4);
    for (let i = 0; i < 3; i++) { const a = t * 16 + i * 2.1; PX.carimbar(g, PX.chispa(2, i ? '#ffd6f2' : '#ffffff'), x + Math.cos(a) * 6, y + Math.sin(a) * 4, 0, 1, 1); }
  },
  // Dragon Breath: bafo de chama verde-azulada
  aliento(g, p, t) { PX.carimbar(g, PX.llama(Math.floor(t * 18), tamSprite(2.4 * p.escala), ['#0f3a3a', '#2aa89a', '#7ae8d0', '#e8fff8']), p.x, p.y - p.alt, p.ang - Math.PI / 2); },
  // Tri Attack: triângulo da cor do tipo do tiro (fogo, gelo ou elétrico)
  tri(g, p, t) {
    const R3 = { FIRE: ['#c8320f', '#ff8a2a', '#ffe0a0'], ICE: ['#2a7ac8', '#8fd8ff', '#ffffff'], ELECTRIC: ['#c89a00', '#ffe066', '#ffffff'] }[p.tipoAtq] ?? ['#888', '#ccc', '#fff'];
    PX.carimbar(g, PX.triangulo(Math.round(3.6 * p.escala), R3), p.x, p.y - p.alt, t * 10, 1, 1);
  },
  // Lock-On: mira vermelha que voa girando
  lockon(g, p, t) { PX.carimbar(g, PX.mira(Math.round(4 * p.escala), '#ff4a4a'), p.x, p.y - p.alt, t * 6, 1, 1); },
  // torreta arremessada pela ultimate
  torretaProj(g, p, t) { dibujarTorretaPix(g, p.x, p.y - p.alt, t, 1.1, true); },
  // Aqua Cutter: lâmina de água fina
  cuchillaAgua(g, p) { PX.carimbar(g, PX.mediaLuna(Math.round(6 * p.escala), ['#123f9c', '#2f7fe0', '#9fdcff', '#ffffff']), p.x, p.y - p.alt, p.ang); },
  // Thunder Shock: faísca em zigue-zague amarela com núcleo branco
  rayito(g, p, t) {
    const ca = Math.cos(p.ang), sa = Math.sin(p.ang), x = p.x, y = p.y - p.alt;
    let x0 = x - ca * 12, y0 = y - sa * 12;
    for (let i = 1; i <= 4; i++) { const f = i / 4, o = (i % 2 ? 1 : -1) * 3 * (Math.floor(t * 30) % 2 ? 1 : -1), x1 = x - ca * 12 * (1 - f) - sa * o * (i < 4 ? 1 : 0), y1 = y - sa * 12 * (1 - f) + ca * o * (i < 4 ? 1 : 0); PX.lineaPix(g, x0, y0, x1, y1, '#04102c', 4); PX.lineaPix(g, x0, y0, x1, y1, '#ffd23c', 2); PX.lineaPix(g, x0, y0, x1, y1, '#ffffff', 1); x0 = x1; y0 = y1; }
    PX.carimbar(g, PX.chispa(3, '#fff6a8'), x, y, 0, 1, 1);
  },
  // Charge Beam / Zap Cannon: esfera amarela com raios saindo e girando
  orbeElectrico(g, p, t) {
    const x = px(p.x), y = px(p.y - p.alt), r = 3.6 * p.escala;
    g.globalAlpha = 0.35; PX.disco(g, x, y, r + 4, '#ffe066'); g.globalAlpha = 1;
    PX.esfera(g, x, y, r, ['#8a5a00', '#ffc21a', '#fff29a', '#ffffff']);
    for (let i = 0; i < 4; i++) { const a = t * 18 + i * 1.57 + Math.sin(t * 40 + i), r2 = r + 4 + (i % 2) * 2; PX.lineaPix(g, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, x + Math.cos(a + 0.3) * r2, y + Math.sin(a + 0.3) * r2, '#fff6a8', 1); }
  },
  // Matcha Shot: gota de chá verde com espuma clara
  matcha(g, p, t) { PX.carimbar(g, PX.gota(Math.round(5 * p.escala), ['#2a4a12', '#5f8f2a', '#a8d060', '#eef8d0']), p.x, p.y - p.alt, p.ang, 1, 1); if (Math.floor(t * 20) % 2) PX.disco(g, px(p.x - Math.cos(p.ang) * 6), px(p.y - p.alt - Math.sin(p.ang) * 6), 1, '#dff0b8'); },
  // Confusion: bolinha rosa com anel que pulsa
  psico(g, p, t) {
    const x = px(p.x), y = px(p.y - p.alt), r = 3.2 * p.escala;
    g.globalAlpha = 0.35; PX.disco(g, x, y, r + 3, '#f7a8d8'); g.globalAlpha = 1;
    PX.esfera(g, x, y, r, ['#7a1f6a', '#e055b0', '#ffc2ea', '#ffffff']);
    PX.anilloPix(g, x, y, r + 2 + Math.sin(t * 25) * 1, r + 2 + Math.sin(t * 25) * 1, '#ffd6f2', 1, 4, Math.floor(t * 24));
  },
  // Psybeam: anéis coloridos em sequência, como uma onda
  psiOnda(g, p, t) {
    const ca = Math.cos(p.ang), sa = Math.sin(p.ang), cores = ['#ff7ad0', '#ffd23c', '#7ad8ff'];
    for (let i = 0; i < 3; i++) { const d = i * 6, x = p.x - ca * d, y = p.y - p.alt - sa * d, r = (4 - i * 0.8) * p.escala; PX.anilloPix(g, x, y, r * 0.55, r, '#04102c', 3, 0); PX.anilloPix(g, x, y, r * 0.55, r, cores[(i + Math.floor(t * 12)) % 3], 2, 0); }
  },
  // Psycho Cut: lâmina rosa em meia-lua
  psicorte(g, p) { PX.carimbar(g, PX.mediaLuna(Math.round(7 * p.escala * 0.8), ['#5a1050', '#d13c9c', '#ff9ad8', '#ffffff']), p.x, p.y - p.alt, p.ang); },
  aurasphere(g, p, t) {
    const x = px(p.x), y = px(p.y - p.alt), r = 5 * p.escala * (1 + 0.08 * Math.sin(t * 20));
    g.globalAlpha = 0.35; PX.disco(g, x, y, r + 5, '#6fd0ff'); g.globalAlpha = 1;
    PX.anilloPix(g, x, y, r + 4, r + 4, 'rgba(160,230,255,0.8)', 1, 3, Math.floor(t * 20));
    PX.esfera(g, x, y, r, ['#2a6ac8', '#6fd0ff', '#d6f6ff', '#ffffff']);
    if (Math.floor(t * 30) % 3 === 0) PX.carimbar(g, PX.chispa(3, '#ffffff'), x + Math.cos(t * 17) * (r + 3), y + Math.sin(t * 17) * (r + 3), 0, 1, 1);
  },
  corazon(g, p, t) { PX.carimbar(g, PX.corazon(Math.max(1, Math.round(1.6 * p.escala))), p.x, p.y - p.alt + Math.sin(t * 12) * 0.8); },
  guijarro(g, p) { PX.carimbar(g, PX.roca(2, ['#4a4a52', '#7a7a88', '#a8a8b8', '#e0e0ec']), p.x, p.y - p.alt); },
  shuriken(g, p, t) { PX.carimbar(g, PX.shuriken(5), p.x, p.y - p.alt, t * 26); },
  shurikenGigante(g, p, t) { const x = px(p.x), y = px(p.y - p.alt), R2 = Math.round(11 * p.escala); g.globalAlpha = 0.3; PX.disco(g, x, y, R2 + 4, '#9fdcff'); g.globalAlpha = 1; PX.carimbar(g, PX.shuriken(R2, ['#3f8ee0', '#9fdcff', '#ffffff']), p.x, p.y - p.alt, t * 18); if (Math.floor(t * 40) % 2) PX.carimbar(g, PX.gota(6, PX.RAMPA_AGUA), x - Math.cos(p.ang) * (R2 + 4), y - Math.sin(p.ang) * (R2 + 4), p.ang, 1, 0.8); },
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

// torreta da Veluza: cristal rosa e azul flutuando, com anel de água girando
function dibujarTorretaPix(g, x, y, t, esc = 1, voando = false) {
  const flut = voando ? 0 : Math.sin(t * 4) * 1.5, cy = y - 10 * esc + flut;
  if (!voando) { g.globalAlpha = 0.35; PX.elipsePix(g, x, y, 7, 3, '#0a2a4a'); g.globalAlpha = 1; }
  g.fillStyle = '#04102c'; g.beginPath(); g.moveTo(x, cy - 9 * esc); g.lineTo(x + 6 * esc, cy); g.lineTo(x, cy + 8 * esc); g.lineTo(x - 6 * esc, cy); g.closePath(); g.fill();
  g.fillStyle = '#e055b0'; g.beginPath(); g.moveTo(x, cy - 7 * esc); g.lineTo(x + 4.5 * esc, cy); g.lineTo(x, cy + 6 * esc); g.lineTo(x - 4.5 * esc, cy); g.closePath(); g.fill();
  g.fillStyle = '#9fdcff'; g.beginPath(); g.moveTo(x, cy - 7 * esc); g.lineTo(x + 4.5 * esc, cy); g.lineTo(x, cy); g.closePath(); g.fill();
  PX.disco(g, x - 1, cy - 2, 1, '#ffffff');
  PX.anilloPix(g, x, cy, 9 * esc, 4 * esc, '#4aa3f0', 1, 4, Math.floor(t * 16));
}

// Psychic Lasso: corda de energia rosa que ondula da mão até o laço; quando prende, o laço aperta em volta do alvo
export function dibujarLaco(g, e, t) {
  const l = e.dueno, x0 = l.x + Math.cos(e.ang) * 10, y0 = l.y - l.alto * 0.55, x1 = e.x, y1 = e.y - (e.preso ? e.preso.alto * 0.5 + (e.preso.salto ?? 0) : 12);
  if (e.fase === 'suelta') return;
  const n = 18, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const amp = e.fase === 'tira' ? 2 : 5;
  let px0 = x0, py0 = y0;
  for (let i = 1; i <= n; i++) {
    const f = i / n, o = Math.sin(f * 10 - t * 30) * amp * Math.sin(f * Math.PI);
    const x = x0 + dx * f + nx * o, y = y0 + dy * f + ny * o;
    g.globalAlpha = 0.4; PX.lineaPix(g, px0, py0, x, y, '#ff9ad8', 5); g.globalAlpha = 1;
    PX.lineaPix(g, px0, py0, x, y, '#e055b0', 3); PX.lineaPix(g, px0, py0, x, y, '#ffe0f4', 1);
    px0 = x; py0 = y;
  }
  const r = e.fase === 'tira' ? 12 + Math.sin(t * 30) : 7;
  PX.anilloPix(g, x1, y1, r, r * 0.6, '#04102c', 4, 0); PX.anilloPix(g, x1, y1, r, r * 0.6, '#e055b0', 2, 0); PX.anilloPix(g, x1, y1, r - 2, r * 0.6 - 1, '#ffe0f4', 1, 5, Math.floor(t * 20));
  if (e.fase === 'tira') for (let i = 0; i < 4; i++) { const a = t * 8 + i * 1.57; PX.carimbar(g, PX.chispa(2, '#ffffff'), x1 + Math.cos(a) * (r + 3), y1 + Math.sin(a) * (r + 3) * 0.6, 0, 1, 1); }
}

// Leaf Tornado: um funil de vento verde com folhas girando em volta
export function dibujarTorbellino(g, e, t, fx) {
  const k = Math.min(1, e.t / 0.2, (e.vida - e.t) / 0.25), alto = 56, base = e.radio;
  if (e.estilo === 'agua') {
    // Whirlpool Waltz: redemoinho de água azul que gira, com espuma e gotas subindo
    g.globalAlpha = 0.4 * k; PX.elipsePix(g, px(e.x), px(e.y), base, base * 0.5, '#123f9c'); g.globalAlpha = k;
    for (let i = 0; i < 4; i++) { const r = base * (1 - i * 0.22), gira = -t * (8 + i * 3) + i; PX.arcoPix(g, e.x, e.y - i * 3, r, gira, gira + 2.8, '#04102c', 5, r * 0.5); PX.arcoPix(g, e.x, e.y - i * 3, r, gira + 0.05, gira + 2.75, i % 2 ? '#8fd0ff' : '#2f7fe0', 3, r * 0.5); PX.arcoPix(g, e.x, e.y - i * 3, r, gira + 3.1, gira + 4.4, '#ffffff', 1, r * 0.5); }
    for (let i = 0; i < 6; i++) { const a = -t * 9 + i * 1.05, r = base * 0.8; PX.carimbar(g, PX.humo(3, ['#4aa3f0', '#bfe4ff', '#ffffff']), e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.5 - 2, 0, 1, k); }
    g.globalAlpha = 1;
    if (ale() < 0.5) fx.add({ x: e.x + entre(-base, base) * 0.6, y: e.y, vy: -90 - ale() * 60, g: 260, size: 2, life: 0.5, color: '#cfeeff', forma: 'gota', rampa: AGUA });
    return;
  }
  g.globalAlpha = 0.35 * k; PX.elipsePix(g, px(e.x), px(e.y), base * 0.8, base * 0.35, '#2f5a1e'); g.globalAlpha = k;
  for (let i = 0; i < 5; i++) {
    const f = i / 4, y = e.y - f * alto, r = base * (0.35 + f * 0.75), gira = t * 14 + i;
    PX.arcoPix(g, e.x, y, r, gira, gira + 2.6, '#04102c', 5, r * 0.35);
    PX.arcoPix(g, e.x, y, r, gira + 0.05, gira + 2.55, i % 2 ? '#b6f07a' : '#5fae3a', 3, r * 0.35);
    PX.arcoPix(g, e.x, y, r, gira + 3.2, gira + 4.6, '#3f7a26', 2, r * 0.35);
  }
  for (let i = 0; i < 18; i++) {
    const f = ((i / 18) + t * 0.9) % 1, a = t * 10 + i * 2.1, r = base * (0.3 + f * 0.8), y = e.y - f * alto;
    PX.carimbar(g, PX.hoja(i % 3 ? 6 : 8), e.x + Math.cos(a) * r, y + Math.sin(a) * r * 0.35, a, 1, k);
  }
  g.globalAlpha = 1;
  if (ale() < 0.3) fx.polvo(e.x + entre(-base, base) * 0.6, e.y, 1, 5);
}

export function dibujarEntidades(g, luta, fx, t, dibujarLutadorClon, hue = null) {
  // primeiro o que é normal, depois cada matiz de shiny com o filtro de cor ligado
  if (hue === null) {
    dibujarEntidades(g, luta, fx, t, dibujarLutadorClon, 0);
    for (const hu of new Set(luta.entidades.map(e => hueShiny(e.dueno)).filter(Boolean))) { fx.hue = hu; conHue(g, hu, () => dibujarEntidades(g, luta, fx, t, dibujarLutadorClon, hu)); }
    fx.hue = 0;
    return;
  }
  for (const e of luta.entidades) {
    if (hueShiny(e.dueno) !== hue) continue;
    switch (e.tipo) {
      case 'charco': {
        const k = Math.min(1, (e.dur - e.t) / 0.6);
        g.globalAlpha = 0.5 * k;
        PX.elipsePix(g, px(e.x), px(e.y), e.radio + 1, e.radio * 0.6 + 1, '#2a0f3a');
        PX.elipsePix(g, px(e.x), px(e.y), e.radio, e.radio * 0.6, '#7a2c92');
        PX.elipsePix(g, px(e.x - e.radio * 0.1), px(e.y - 1), e.radio * 0.7, e.radio * 0.38, '#9b46bd');
        PX.elipsePix(g, px(e.x - e.radio * 0.28), px(e.y - e.radio * 0.18), e.radio * 0.28, e.radio * 0.12, '#d68cf0');
        PX.anilloPix(g, px(e.x), px(e.y), e.radio * 0.9, e.radio * 0.55, '#c27ae0', 1, 4, Math.floor(e.t * 8));
        g.globalAlpha = 1;
        if (ale() < 0.12) fx.add({ x: e.x + entre(-e.radio, e.radio) * 0.7, y: e.y, vy: -22, g: 0, size: 2, life: 0.7, color: '#d68cf0', forma: 'burbuja' });
        break;
      }
      case 'hueso': {
        // osso de aura girando, com brilho azul e rastro
        const a = e.t * 22, ca = Math.cos(a), sa = Math.sin(a), x = e.x, y = e.y - 14;
        g.globalAlpha = 0.3; PX.disco(g, x, y, 13, '#6fd0ff'); g.globalAlpha = 1;
        for (const [cor, w] of [['#0b2a6a', 6], ['#bfe9ff', 4], ['#ffffff', 2]]) {
          PX.lineaPix(g, x - ca * 12, y - sa * 7, x + ca * 12, y + sa * 7, cor, w);
          for (const s2 of [-1, 1]) { const ex = x + ca * 12 * s2, ey = y + sa * 7 * s2; PX.disco(g, ex - sa * 3, ey + ca * 2, w * 0.7, cor); PX.disco(g, ex + sa * 3, ey - ca * 2, w * 0.7, cor); }
        }
        if (Math.random() < 0.6) fx.add({ x, y, vx: -e.vx * 0.2 + entre(-20, 20), vy: -e.vy * 0.2 + entre(-20, 20), size: 2, life: 0.3, color: '#8fd8ff', forma: 'chispa' });
        break;
      }
      case 'sismo': {
        // área do terremoto: chão rachado que pulsa e anéis puxando para o centro
        const k = Math.min(1, e.t / 0.2, (e.dur - e.t) / 0.4), pul = (e.acum / 0.5) % 1;
        g.globalAlpha = 0.25 * k; PX.elipsePix(g, e.x, e.y, e.radio, e.radio * 0.62, '#5a3a1a'); g.globalAlpha = 0.8 * k;
        PX.anilloPix(g, e.x, e.y, e.radio, e.radio * 0.62, '#c8a060', 2, 10, Math.floor(e.t * 10));
        PX.anilloPix(g, e.x, e.y, e.radio * (1 - pul), e.radio * 0.62 * (1 - pul), '#e8d0a0', 1, 0);
        for (let i = 0; i < 8; i++) { const a2 = i * 0.785 + 0.3, r1 = e.radio * 0.2, r2 = e.radio * (0.6 + 0.3 * Math.sin(i * 7)); PX.lineaPix(g, e.x + Math.cos(a2) * r1, e.y + Math.sin(a2) * r1 * 0.62, e.x + Math.cos(a2) * r2, e.y + Math.sin(a2) * r2 * 0.62, '#2a1a08', 2); }
        g.globalAlpha = 1;
        if (Math.random() < 0.3) fx.polvo(e.x + entre(-e.radio, e.radio) * 0.8, e.y + entre(-e.radio, e.radio) * 0.5, 1, 5);
        break;
      }
      case 'levita': {
        // telecinese: anéis roxos girando em volta do rival erguido
        const r = e.preso, cy = r.y - r.alto * 0.5 - r.salto;
        for (let i = 0; i < 3; i++) { const a2 = e.t * 7 + i * 2.1; PX.arcoPix(g, r.x, cy, r.alto * 0.6 + i * 4, a2, a2 + 1.6, i % 2 ? '#ff9ad8' : '#c084fc', 2, r.alto * 0.3 + i * 2); }
        g.globalAlpha = 0.25; PX.elipsePix(g, r.x, r.y, 16, 6, '#c084fc'); g.globalAlpha = 1;
        if (Math.random() < 0.5) fx.add({ x: r.x + entre(-12, 12), y: cy + entre(-10, 10), vy: -30, size: 2, life: 0.4, color: '#f0d0ff', forma: 'chispa' });
        break;
      }
      case 'flecha': {
        // Cyber Arrow: seta grande de pixels ciano e magenta com rastro que pisca
        const a = Math.atan2(e.vy, e.vx), ca = Math.cos(a), sa = Math.sin(a), x = e.x, y = e.y - 12;
        for (let i = 1; i <= 4; i++) { g.globalAlpha = 0.5 - i * 0.1; PX.lineaPix(g, x - ca * i * 10, y - sa * i * 10, x - ca * (i + 1) * 10, y - sa * (i + 1) * 10, i % 2 ? '#ff4a8a' : '#7df9ff', 4); }
        g.globalAlpha = 1;
        const p = (f, l2) => [x + ca * f - sa * l2, y + sa * f + ca * l2];
        for (const [cor, k] of [['#04102c', 1.25], [Math.floor(t * 20) % 2 ? '#7df9ff' : '#ff4a8a', 1], ['#ffffff', 0.45]]) {
          g.fillStyle = cor; g.beginPath(); const [ax, ay] = p(16 * k, 0), [bx, by] = p(-8 * k, 9 * k), [cx2, cy2] = p(-3 * k, 0), [dx, dy] = p(-8 * k, -9 * k); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx2, cy2); g.lineTo(dx, dy); g.closePath(); g.fill();
        }
        break;
      }
      case 'torreta': {
        // laser entre torretas próximas
        for (const o of luta.entidades) if (o !== e && o.tipo === 'torreta' && o.dueno === e.dueno && o.vivo && o.x >= e.x && Math.hypot(o.x - e.x, o.y - e.y) <= (e.enlace ?? 170)) {
          g.globalAlpha = 0.35; PX.lineaPix(g, e.x, e.y - 14, o.x, o.y - 14, '#ff9ad8', 5); g.globalAlpha = 0.9 + 0.1 * Math.sin(t * 30); PX.lineaPix(g, e.x, e.y - 14, o.x, o.y - 14, '#d13c9c', 2); PX.lineaPix(g, e.x, e.y - 14, o.x, o.y - 14, '#ffffff', 1); g.globalAlpha = 1;
        }
        const k = Math.min(1, e.t / 0.2, (e.dur - e.t) / 0.4), carga = (e.acum / e.cada);
        g.globalAlpha = k;
        if (carga > 0.7) { g.globalAlpha = k * (carga - 0.7) * 2; PX.anilloPix(g, e.x, e.y, e.radio * (1.2 - carga * 0.3), e.radio * 0.6 * (1.2 - carga * 0.3), '#ff9ad8', 1, 6, Math.floor(t * 20)); g.globalAlpha = k; }
        dibujarTorretaPix(g, e.x, e.y, t + e.x * 0.01);
        g.globalAlpha = 1;
        break;
      }
      case 'torretaVuela': dibujarTorretaPix(g, e.x, e.y, t, 1.1, true); break;
      case 'trampa': {
        // Grass Knot: um nó de capim no chão; pisca quando fica armado
        const armada = e.t >= e.arma, k = Math.min(1, e.t / 0.2), fim = Math.min(1, (e.dur - e.t) / 0.5);
        g.globalAlpha = k * fim;
        PX.elipsePix(g, px(e.x), px(e.y), e.radio * 0.9, e.radio * 0.5, 'rgba(30,70,20,0.35)');
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.3, hx = e.x + Math.cos(a) * e.radio * 0.55, hy = e.y + Math.sin(a) * e.radio * 0.3; PX.carimbar(g, PX.vid(7 + (i % 2) * 3, i), hx, hy - 4, 0, 1, 1); }
        PX.anilloPix(g, px(e.x), px(e.y - 3), 5, 3, '#04102c', 3, 0); PX.anilloPix(g, px(e.x), px(e.y - 3), 5, 3, '#7ac74c', 2, 0);
        if (armada && Math.floor(e.t * 3) % 2 === 0) PX.anilloPix(g, px(e.x), px(e.y), e.radio, e.radio * 0.55, '#b6f07a', 1, 6, Math.floor(e.t * 10));
        g.globalAlpha = 1;
        break;
      }
      case 'humo': {
        const k = Math.min(1, e.t / 0.3) * Math.min(1, (e.dur - e.t) / 0.6);
        // Smokescreen como no site: moitas de fumaça cinza-esverdeada enchendo a área, a de dentro mais clara
        const TONS = [['#4f6a4c', '#86a07e', '#c4d4bc'], ['#5c6e66', '#9fb2a6', '#dfe8e0']];
        for (const [n, rr, tam, tom] of [[12, 0.78, 0.26, 0], [8, 0.45, 0.3, 1], [4, 0.15, 0.32, 1]]) for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + e.t * 0.35 * (tom ? -1 : 1), bob = Math.sin(e.t * 2 + i) * 1.5;
          PX.carimbar(g, PX.humo(Math.round(e.radio * tam), TONS[(i + tom) % 2]), px(e.x + Math.cos(a) * e.radio * rr), px(e.y + Math.sin(a) * e.radio * rr * 0.6 + bob), 0, 1, 0.82 * k);
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
          if (e.t >= p.t0 && e.estilo === 'rayo') { g.globalAlpha = 0.5 + 0.5 * k; PX.anilloPix(g, px(p.x), px(p.y), rad * (1.2 - 0.4 * k), rad * 0.6 * (1.2 - 0.4 * k), '#fff6a8', 1, 0); if (k > 0.6 && Math.floor(e.t * 30) % 2) PX.lineaPix(g, p.x + 3, p.y - 60, p.x, p.y - 30, '#ffe066', 1); }
          if (e.t >= p.t0 && e.estilo === 'psico') { const caida = (1 - k) * 110; g.globalAlpha = 0.5 + 0.5 * k; PX.esfera(g, px(p.x), px(p.y - caida - 8), 4 + k * 3, ['#7a1f6a', '#e055b0', '#ffc2ea', '#ffffff']); PX.lineaPix(g, p.x, p.y - caida - 14, p.x, p.y - caida - 34, '#ffc2ea', 1); }
          if (e.t >= p.t0 && e.estilo === 'roca') { const caida = (1 - k) * 90; g.globalAlpha = 1; PX.carimbar(g, PX.roca(6), p.x, p.y - caida - 6); }
          g.globalAlpha = 1;
        }
        break;
      }
      case 'meteoro': {
        if (e.fase === 'apunta' || e.fase === 'fija' || e.fase === 'baja') {
          // mira como no site: anel duplo com quatro setas para dentro; começa branca, vai para laranja e fica vermelha antes do impacto
          const k = e.fase === 'apunta' ? e.k : 1, R_ = e.radio, cx = px(e.x), cy = px(e.y), gira = t * 1.6, pul = 0.5 + 0.5 * Math.sin(t * (10 + k * 20));
          if (e.tipoAtq === 'FLYING') {
            // Bounce: só a sombra crescendo e um anel fino, como no site
            g.globalAlpha = 0.18 + 0.3 * k; PX.elipsePix(g, cx, cy, R_ * (0.5 + 0.5 * k), R_ * 0.6 * (0.5 + 0.5 * k), '#10301a');
            g.globalAlpha = 0.7; PX.anilloPix(g, cx, cy, R_, R_ * 0.6, '#d8f0ff', 1, 0); g.globalAlpha = 1;
            break;
          }
          const cor = k < 0.45 ? '#ffffff' : k < 0.8 ? '#ffb347' : '#ff4a3a', cor2 = k < 0.45 ? '#cfd8e6' : k < 0.8 ? '#ff8a2a' : '#c81e1e';
          g.globalAlpha = 0.12 + 0.28 * k * (0.6 + 0.4 * pul); PX.elipsePix(g, cx, cy, R_ * 1.05, R_ * 0.63, k < 0.45 ? '#ffffff' : cor);
          g.globalAlpha = 1;
          PX.anilloPix(g, cx, cy, R_, R_ * 0.6, '#04102c', 4, 0);
          PX.anilloPix(g, cx, cy, R_, R_ * 0.6, cor, 2, 0);
          PX.anilloPix(g, cx, cy, R_ * 0.62, R_ * 0.37, cor2, 1, 0);
          PX.anilloPix(g, cx, cy, R_ * 0.25, R_ * 0.15, cor, 1, 0);
          for (let i = 0; i < 4; i++) {
            const a = gira + (i * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a), out = R_ + 9 - pul * 2, inn = R_ - 2;
            const tx = cx + ca * (out + 4), ty = cy + sa * (out + 4) * 0.6, bx = cx + ca * inn, by = cy + sa * inn * 0.6, nx = -sa * 6, ny = ca * 6 * 0.6;
            g.fillStyle = '#04102c'; g.beginPath(); g.moveTo(bx - ca, by - sa * 0.6); g.lineTo(tx + nx * 1.4, ty + ny * 1.4); g.lineTo(tx - nx * 1.4, ty - ny * 1.4); g.closePath(); g.fill();
            g.fillStyle = cor; g.beginPath(); g.moveTo(bx, by); g.lineTo(tx + nx, ty + ny); g.lineTo(tx - nx, ty - ny); g.closePath(); g.fill();
          }
          PX.disco(g, cx, cy, 1.5, '#ffffff');
        }
        break;
      }
      case 'caparazon': {
        // Hydro Typhoon como no site: quatro jatos curvos de água que giram em volta do casco, com espuma nas pontas
        const l = e.dueno, a = e.ang, cx = px(l.x), cy = px(l.y - l.alto * 0.3), L = e.h.alcance, curva = e.h.curva ?? 1.1;
        for (let j = 0; j < 4; j++) {
          const pts = [];
          for (let k = 0; k <= 14; k++) { const u = k / 14, ang = a + j * Math.PI / 2 - u * curva, d = 8 + u * L; pts.push([cx + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.62, u]); }
          // fios paralelos que abrem em leque até a ponta (água espirrando), sem contorno de cano
          const FIOS = [[-2, '#1f5ec4'], [-1, '#5aa8f5'], [0, '#ffffff'], [1, '#8fd0ff'], [2, '#2f7fe0']];
          for (const [o, cor] of FIOS) for (let k = 0; k < pts.length - 1; k++) {
            const [x1, y1, u] = pts[k], [x2, y2, u2] = pts[k + 1], dx = x2 - x1, dy = y2 - y1, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
            const ab = (u + 0.05) * 11 * o, ab2 = (u2 + 0.05) * 11 * o, ond = Math.sin(t * 40 + k + o) * u;
            PX.lineaPix(g, x1 + nx * (ab + ond), y1 + ny * (ab + ond), x2 + nx * (ab2 + ond), y2 + ny * (ab2 + ond), cor, o === 0 ? 2 : 2);
          }
          for (let k = 4; k < pts.length; k += 2) { const [x1, y1, u] = pts[k]; PX.carimbar(g, PX.humo(Math.round(2 + u * 5), k % 2 ? ['#1f5ec4', '#4aa3f0', '#bfe4ff'] : ['#4aa3f0', '#bfe4ff', '#ffffff']), x1 + Math.sin(t * 30 + k) * 2, y1 + Math.cos(t * 26 + k) * 1.5, 0, 1, 1); }
          const [xe, ye] = pts.at(-1);
          if (ale() < 0.5) fx.add({ x: xe, y: ye, vx: entre(-60, 60), vy: entre(-70, -10), g: 260, size: 2, life: 0.4, color: '#cfeeff', forma: 'gota', rampa: AGUA });
        }
        break;
      }
      default: break;
    }
  }
  // raios e cones por cima do chão
  for (const e of luta.entidades) {
    if (hueShiny(e.dueno) !== hue) continue;
    if (e.tipo === 'chorro') { dibujarChorro(g, e, t, fx); dibujarPunta(g, e, t); }
    else if (e.tipo === 'cono') dibujarCono(g, e, t, fx);
  }
}

const clampK = k => Math.max(0, Math.min(1, k));
// shiny: os ataques giram de matiz para a cor do shiny de cada linha (graus de hue-rotate)
const SHINY_HUE = { bulbasaur: -50, charmander: 200, squirtle: 70, zubat: 110, abra: -40, onix: 45, magikarp: 170, munchlax: 30, seedot: 50, buneary: -45, riolu: 180, froakie: 110, poltchageist: 100, tynamo: -70, veluza: 70, duraludon: 130, feebas: 150, swablu: 140, porygon: 90, mewtwo: 200 };
export const hueShiny = l => (l?.shiny && !l.esClon ? SHINY_HUE[l.def?.id] ?? 120 : 0);
export function conHue(g, hu, f) { if (!hu) return f(); g.save(); g.filter = `hue-rotate(${hu}deg)`; f(); g.restore(); }
// símbolo da Mega Evolução (só no navegador)
const IMG_MEGA = typeof Image !== 'undefined' ? Object.assign(new Image(), { src: 'img/mega.png' }) : null;

// ponta do raio: em vez de terminar reto, fecha num estouro redondo que pulsa, com raios curtos girando
const RAMPAS_PUNTA = { psiquico: ['#5a1f8a', '#b05ae8', '#f0d0ff', '#ffffff'], acero: ['#4a5a6a', '#a8b8c8', '#e6eef6', '#ffffff'], glitch: ['#c81e5a', '#ff4a8a', '#7df9ff', '#ffffff'], solar: ['#c88a10', '#ffd23c', '#fff6b0', '#ffffff'] };
function dibujarPunta(g, e, t) {
  if (!e.activo || e.largoVis < 6 || e.h.paleta === 'aura') return;
  const b = e.origenVis(), alt = e.dueno.alto * 0.55;
  const k = clampK(1 - (e.t - e.carga) / e.dur), ancho = e.h.anchoVisual ?? e.ancho * 1.4;
  const w = Math.max(3, Math.round(ancho * (0.5 + 0.5 * Math.min(1, (e.t - e.carga) / 0.12)) * (0.6 + 0.4 * k)));
  const x2 = px(b.x + Math.cos(e.ang) * e.largoVis), y2 = px(b.y + Math.sin(e.ang) * e.largoVis - alt);
  const rampa = RAMPAS_PUNTA[e.h.paleta] ?? (e.tipoAtq === 'FIRE' ? PX.RAMPA_FOGO : e.tipoAtq === 'WATER' ? PX.RAMPA_AGUA : rampaTipo(e.tipoAtq));
  const R = Math.max(3, w * 0.55 * (1 + 0.15 * Math.sin(t * 40)));
  g.globalAlpha = 0.3; PX.disco(g, x2, y2, R * 1.5, rampa[1]); g.globalAlpha = 1;
  PX.esfera(g, x2, y2, R, rampa);
  for (let i = 0; i < 6; i++) {
    const a = t * 6 + i * 1.047, L = R * (1.5 + 0.5 * Math.sin(t * 30 + i));
    PX.lineaPix(g, x2 + Math.cos(a) * R * 0.9, y2 + Math.sin(a) * R * 0.9, x2 + Math.cos(a) * L, y2 + Math.sin(a) * L, rampa[2], 1);
  }
  // cauda indo embora: também arredondada
  if (e.cola > 0) PX.esfera(g, px(b.x), px(b.y - alt), Math.max(2, R * 0.6), rampa);
}

function dibujarChorro(g, e, t, fx) {
  const d = e.dueno, b = e.activo ? e.origenVis() : e.boca(), alt = d.alto * 0.55;
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
  if (e.largoVis < 2) return;
  const x2 = b.x + Math.cos(e.ang) * e.largoVis, y2 = b.y + Math.sin(e.ang) * e.largoVis - alt;
  const w = Math.max(3, Math.round(ancho * (0.5 + 0.5 * Math.min(1, (e.t - e.carga) / 0.12)) * (0.6 + 0.4 * k)));
  const largoTotal = Math.hypot(px(x2) - ox, px(y2) - oy), ux = (px(x2) - ox) / (largoTotal || 1), uy = (px(y2) - oy) / (largoTotal || 1), nxp = -uy, nyp = ux;
  const paletaH = e.h.paleta;
  if (paletaH === 'aura') {
    // sopro de manchas prateadas: nuvens de metal claro que correm pelo raio
    const N = Math.max(8, Math.floor(largoTotal / 5)), tonos = [['#9fd8ff', '#e6f7ff', '#ffffff'], ['#bfe6ff', '#f2fbff', '#ffffff']];
    for (let i = 0; i < N; i++) {
      const f = ((i / N) + t * 1.7) % 1, a1 = Math.sin(i * 12.9898) * 43758.5453, rnd = a1 - Math.floor(a1);
      const lado = (rnd - 0.5) * w * 0.7 * (0.5 + 0.5 * Math.sin(t * 9 + i));
      const tam = [4, 6, 8, 10, 12][Math.min(4, Math.floor(w * 0.18 * (0.6 + rnd * 0.8) / 2.2))] ?? 8;
      PX.carimbar(g, PX.humo(tam, tonos[i % 2]), ox + ux * f * largoTotal + nxp * lado, oy + uy * f * largoTotal + nyp * lado, 0, 1, 0.95 * Math.min(1, (1 - f) * 3));
    }
    for (let i = 0; i < 14; i++) { const f = ((i / 14) + t * 2.6) % 1; PX.disco(g, ox + ux * f * largoTotal + nxp * Math.sin(i * 3 + t * 20) * w * 0.25, oy + uy * f * largoTotal + nyp * Math.sin(i * 3 + t * 20) * w * 0.25, 1.2, '#ffffff'); }
    PX.esfera(g, ox, oy, Math.max(3, w * 0.4), ['#6fb0e0', '#cfeaff', '#ffffff', '#ffffff']);
    if (ale() < 0.5) fx.add({ x: px(x2), y: px(y2), vx: entre(-60, 60), vy: entre(-60, 60), size: 2.2, life: 0.35, color: '#e8f0ff', forma: 'chispa' });
    return;
  }
  if (e.h.forma === 'helice') {
    // Blast Burn como no site: duas fitas finas que se trançam, uma de fogo e outra azul, com brilhos no cruzamento
    const amp = (e.h.amplitud ?? 11) * 0.55, paso = 3, N = Math.max(8, Math.floor(largoTotal / paso));
    const fitas = [[1, ['#e0400a', '#ffa62a', '#fff3b0']], [-1, ['#2a5fd8', '#86c2ff', '#ffffff']]];
    const ponto = (i, sgn) => { const f = i / N, d = largoTotal * f, env = 0.35 + 0.65 * Math.min(1, f * 3); const fase = d / 9 - t * 22, off = Math.sin(fase) * amp * sgn * env; return [ox + ux * d + nxp * off, oy + uy * d + nyp * off, Math.cos(fase) * sgn]; };
    // primeiro os trechos que estão "atrás", depois os da frente
    for (const frente of [false, true]) for (const [sgn, [c0, c1, c2]] of fitas) {
      for (let i = 0; i < N; i++) {
        const [x1, y1, z] = ponto(i, sgn), [x2b, y2b] = ponto(i + 1, sgn);
        if ((z > 0) !== frente) continue;
        g.globalAlpha = frente ? 1 : 0.75;
        g.globalAlpha *= 0.35; PX.lineaPix(g, x1, y1, x2b, y2b, c1, 11); g.globalAlpha = frente ? 1 : 0.75; PX.lineaPix(g, x1, y1, x2b, y2b, c0, 7); PX.lineaPix(g, x1, y1, x2b, y2b, c1, 5); PX.lineaPix(g, x1, y1, x2b, y2b, c2, frente ? 2 : 1);
      }
    }
    g.globalAlpha = 1;
    for (let i = 0; i < N; i += 4) { const f = i / N; if (Math.abs(Math.sin(largoTotal * f / 9 - t * 22)) < 0.3) PX.carimbar(g, PX.chispa(3, '#ffffff'), ox + ux * largoTotal * f, oy + uy * largoTotal * f, 0, 1, 1); }
    PX.esfera(g, ox, oy, Math.max(3, w * 0.3), rampaFuego(col));
    PX.anilloPix(g, px(x2), px(y2), 6 + Math.sin(t * 40) * 2, 5, '#bfe4ff', 1, 3, Math.floor(t * 30));
    if (ale() < 0.6) fx.add({ x: px(x2) + entre(-4, 4), y: px(y2) + entre(-4, 4), vx: entre(-80, 80), vy: entre(-80, 40), size: 2.2, life: 0.35, color: ale() < 0.5 ? '#ffd23c' : '#8fc4ff', forma: 'chispa' });
    return;
  }
  if (col === 'WATER') {
    // Hydro Pump / Hydro Cannon como no site: blocos grossos de água e espuma que crescem até a ponta
    const N = Math.max(10, Math.floor(largoTotal / 7)), tonos = [['#123f9c', '#2f7fe0', '#8fd0ff'], ['#1f5ec4', '#5aa8f5', '#ffffff']];
    for (let i = N - 1; i >= 0; i--) {
      const f = ((i / N) + t * 2.2) % 1, d = largoTotal * f, lado = Math.sin(i * 2.3 + t * 9) * w * 0.28 * (0.4 + f);
      const tam = Math.min(20, Math.round(5 + f * w * 0.75 + (i % 3)));
      PX.carimbar(g, PX.humo(tam, tonos[i % 2]), ox + ux * d + nxp * lado, oy + uy * d + nyp * lado, 0, 1, Math.min(1, f * 8, (1 - f) * 5 + 0.6));
    }
    for (let i = 0; i < 18; i++) { const f = ((i / 18) + t * 2.8) % 1, lado = Math.sin(i * 4.1 + t * 12) * w * 0.6 * f; PX.disco(g, ox + ux * f * largoTotal + nxp * lado, oy + uy * f * largoTotal + nyp * lado, i % 3 ? 1 : 2, '#ffffff'); }
    PX.esfera(g, ox, oy, Math.max(3, w * 0.36), PX.RAMPA_AGUA);
    if (ale() < 0.9) fx.add({ x: px(x2), y: px(y2), vx: entre(-110, 110), vy: entre(-140, -30), g: 300, size: 2.2, life: 0.5, color: '#cfeeff', forma: 'gota', rampa: AGUA });
    return;
  }
  // o raio é uma corrente de trechos curtos com largura que ondula, para as bordas parecerem energia e não um cano
  const nTr = Math.max(2, Math.ceil(largoTotal / 9));
  const solar = paletaH === 'solar';
  if (paletaH === 'psiquico') {
    // Psybeam: raio roxo com anéis psíquicos que correm por ele
    for (const [cor, k] of [['rgba(192,132,252,0.35)', 1.25], ['#5a1f8a', 0.75], ['#b05ae8', 0.55], ['#f0d0ff', 0.28], ['#ffffff', 0.1]]) PX.lineaPix(g, ox, oy, px(x2), px(y2), cor, Math.max(1, Math.round(w * k)));
    const N = Math.max(4, Math.floor(largoTotal / 26));
    for (let i = 0; i < N; i++) { const f = ((i / N) + t * 2.2) % 1, cx = ox + ux * largoTotal * f, cy = oy + uy * largoTotal * f, r = w * (0.45 + 0.2 * Math.sin(t * 20 + i)); g.globalAlpha = Math.min(1, (1 - f) * 3); PX.anilloPix(g, cx, cy, r * 0.35, r, '#04102c', 3, 0); PX.anilloPix(g, cx, cy, r * 0.35, r, i % 2 ? '#ff9ad8' : '#e0b0ff', 2, 0); }
    g.globalAlpha = 1;
    PX.esfera(g, ox, oy, Math.max(3, w * 0.38), ['#5a1f8a', '#b05ae8', '#f0d0ff', '#ffffff']);
    if (ale() < 0.6) fx.add({ x: px(x2), y: px(y2), vx: entre(-80, 80), vy: entre(-80, 60), size: 2.4, life: 0.35, color: '#f0d0ff', forma: 'chispa' });
    return;
  }
  if (paletaH === 'acero') {
    // Flash Cannon: raio prateado com brilho que corre e faíscas
    for (const [cor, k] of [['rgba(214,226,238,0.35)', 1.2], ['#4a5a6a', 0.7], ['#a8b8c8', 0.52], ['#e6eef6', 0.3], ['#ffffff', 0.12]]) PX.lineaPix(g, ox, oy, px(x2), px(y2), cor, Math.max(1, Math.round(w * k)));
    for (let i = 0; i < 6; i++) { const f = ((i / 6) + t * 3) % 1; PX.carimbar(g, PX.chispa(3, '#ffffff'), ox + ux * largoTotal * f + nxp * Math.sin(i * 3 + t * 30) * w * 0.25, oy + uy * largoTotal * f + nyp * Math.sin(i * 3 + t * 30) * w * 0.25, 0, 1, 1); }
    PX.esfera(g, ox, oy, Math.max(3, w * 0.36), ['#4a5a6a', '#a8b8c8', '#e6eef6', '#ffffff']);
    if (ale() < 0.6) fx.chispas(px(x2), px(y2), '#e6eef6', 1, 200);
    return;
  }
  if (paletaH === 'glitch') {
    // Glitch Beam: camadas vermelha e ciano deslocadas, núcleo branco e blocos de pixel que piscam
    const tremor = (Math.floor(t * 30) % 3) - 1;
    PX.lineaPix(g, ox - 2, oy + tremor, px(x2) - 2, px(y2) + tremor, 'rgba(255,40,120,0.7)', Math.max(2, Math.round(w * 0.6)));
    PX.lineaPix(g, ox + 2, oy - tremor, px(x2) + 2, px(y2) - tremor, 'rgba(40,240,255,0.7)', Math.max(2, Math.round(w * 0.6)));
    PX.lineaPix(g, ox, oy, px(x2), px(y2), '#ffffff', Math.max(1, Math.round(w * 0.3)));
    for (let i = 0; i < 14; i++) { const f = ale(), lado = (ale() - 0.5) * w * 1.2, bx = ox + ux * largoTotal * f + nxp * lado, by = oy + uy * largoTotal * f + nyp * lado; g.fillStyle = ['#2ff3ff', '#ff3ad8', '#ffffff', '#fff04a'][i % 4]; g.fillRect(Math.round(bx), Math.round(by), 2 + Math.floor(ale() * 5), 2 + Math.floor(ale() * 3)); }
    PX.esfera(g, ox, oy, Math.max(3, w * 0.34), ['#2a2a6a', '#ff3ad8', '#2ff3ff', '#ffffff']);
    return;
  }
  if (paletaH === 'electrico') {
    // Thunderous Lash / Plasma Lash: relâmpago que treme, com brilho amarelo e núcleo branco
    const N = Math.max(6, Math.floor(largoTotal / 14));
    for (const [cor, lw, amp] of [['rgba(255,214,60,0.25)', Math.min(26, w * 0.8), 1], ['#04102c', Math.min(14, Math.max(4, w * 0.4)), 1], ['#ffd23c', Math.min(10, Math.max(3, w * 0.28)), 1], ['#fff6c8', Math.min(4, Math.max(1, w * 0.1)), 0.6]]) {
      let x0 = ox, y0 = oy, sd = Math.floor(t * 24);
      const rnd = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
      for (let i = 1; i <= N; i++) { const f = i / N, o = i === N ? 0 : (rnd() - 0.5) * Math.min(w, 34) * 0.9 * amp, x1 = ox + ux * largoTotal * f + nxp * o, y1 = oy + uy * largoTotal * f + nyp * o; PX.lineaPix(g, x0, y0, x1, y1, cor, Math.round(lw)); x0 = x1; y0 = y1; }
    }
    for (let i = 0; i < 3; i++) { const f = ale(), x = ox + ux * largoTotal * f, y = oy + uy * largoTotal * f; fx.add({ x, y, vx: entre(-90, 90), vy: entre(-90, 60), size: 2.4, life: 0.25, color: '#fff6a8', forma: 'chispa' }); }
    PX.esfera(g, ox, oy, Math.max(3, w * 0.35), ['#8a5a00', '#ffc21a', '#fff29a', '#ffffff']);
    return;
  }
  const hiper = paletaH === 'hiper', matcha = paletaH === 'matcha';
  const cA = solar ? '#b8860b' : hiper ? '#e0520a' : matcha ? '#3f6b1e' : c3, cB = solar ? '#ffd23c' : hiper ? '#ffb347' : matcha ? '#8bc34a' : c2, cC = solar ? '#fff29a' : hiper ? '#fff6d0' : matcha ? '#eef8d0' : c1;
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
  if (fuego) {
    // como no site: chamas pequenas que voam em linha (abertura de 30% do leque) até o fim do alcance, com miolo claro
    const vida = h.alcance / 190;
    for (let i = 0; i < 3; i++) {
      const a = e.ang + (ale() - 0.5) * 2 * semi * 0.6, s = entre(150, 220), r0 = entre(2, 8);
      fx.add({ x: ox + Math.cos(a) * r0, y: oy + Math.sin(a) * r0, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: vida * entre(0.85, 1.05), size: entre(1.8, 2.6), grow: 1, forma: 'llamaDir', rampa: rampaFuego(tipo) });
    }
    const a = e.ang + (ale() - 0.5) * semi * 0.4, s = entre(170, 230);
    fx.add({ x: ox, y: oy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: vida * 0.7, size: 1.5, grow: 0.6, forma: 'llamaDir', rampa: ['#ffb52e', '#fff3b0', '#ffffff', '#ffffff'] });
    if (ale() < 0.3) fx.add({ x: ox + Math.cos(e.ang) * h.alcance * 0.5, y: oy + Math.sin(e.ang) * h.alcance * 0.5, vx: Math.cos(e.ang) * 90, vy: Math.sin(e.ang) * 60 - 20, life: vida * 1.1, size: 5, grow: 6, forma: 'circulo', color: 'rgba(80,72,70,0.25)' });
    return;
  }
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
