// Desenhos das mecânicas das linhas novas (engine/formasMega.js): formas sólidas em pixel, com contorno,
// quase sem brilho, sem fumaça e sem piscar a tela (a tela só pisca no K.O.).
import * as PX from './pixelfx.js';
import { EVENTOS_NOVOS, HEROES_NOVOS, ENTIDADES_NOVAS } from './efectosNovos.js';

const px = Math.round;
const ale = Math.random;
const entre = (a, b) => a + ale() * (b - a);
const C = '#0b0a14'; // contorno
const heroi = (fx, k, life, o) => fx.heroes.push({ k, t: 0, life, hue: fx.hue, ...o });
function poli(g, pts, cor, contorno = C) {
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(px(x), px(y)) : g.moveTo(px(x), px(y)))); g.closePath();
  if (contorno) { g.strokeStyle = contorno; g.lineWidth = 2; g.stroke(); }
  g.fillStyle = cor; g.fill();
}
// lasca/losango apontando em `a`
function lasca(g, x, y, a, L, W, cor, claro) {
  const c = Math.cos(a), s = Math.sin(a);
  poli(g, [[x + c * L, y + s * L], [x - s * W, y + c * W], [x - c * L * 0.5, y - s * L * 0.5], [x + s * W, y - c * W]], cor);
  if (claro) PX.lineaPix(g, x - c * L * 0.2, y - s * L * 0.2, x + c * L * 0.7, y + s * L * 0.7, claro, 1);
}
function linhaGrossa(g, x0, y0, x1, y1, cores, w) {
  g.lineCap = 'round';
  cores.forEach((c, i) => { g.strokeStyle = c; g.lineWidth = Math.max(1, w - i * (w / cores.length)); g.beginPath(); g.moveTo(px(x0), px(y0)); g.lineTo(px(x1), px(y1)); g.stroke(); });
  g.lineCap = 'butt';
}
function elipseChao(g, x, y, r, cor, a) { g.globalAlpha *= a; g.fillStyle = cor; g.beginPath(); g.ellipse(x, y, r, r * 0.62, 0, 0, 7); g.fill(); g.globalAlpha /= a; }
function bordaChao(g, x, y, r, cor, a, w = 2, tr = 0) { g.globalAlpha *= a; g.strokeStyle = cor; g.lineWidth = w; if (tr) g.setLineDash([tr, tr]); g.beginPath(); g.ellipse(x, y, r, r * 0.62, 0, 0, 7); g.stroke(); g.setLineDash([]); g.globalAlpha /= a; }
function raioZig(g, x0, y0, x1, y1, s, cor, w = 2) {
  const n = 6, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  g.strokeStyle = cor; g.lineWidth = w; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x0, y0);
  for (let i = 1; i < n; i++) { const v = Math.sin(s * 9.1 + i * 7.7) * 43758.5, o = (v - Math.floor(v) - 0.5) * Math.min(18, L * 0.3); g.lineTo(x0 + dx * (i / n) + nx * o, y0 + dy * (i / n) + ny * o); }
  g.lineTo(x1, y1); g.stroke(); g.lineJoin = 'miter';
}
const cacos = (fx, x, y, cores, n = 6, v = 120) => { for (let i = 0; i < n; i++) { const a = ale() * 6.28; fx.add({ x, y, vx: Math.cos(a) * entre(v * 0.4, v), vy: Math.sin(a) * entre(v * 0.3, v * 0.7) - 40, g: 320, size: entre(1.5, 2.6), life: 0.45, color: cores[i % cores.length], forma: 'sq' }); } };

// ---------------------------------------------------------------- eventos do motor
Object.assign(EVENTOS_NOVOS, {
  bocejo(fx, e) { fx.texto(e.x, e.y - 34, 'Zzz', '#bfdbfe'); },
  conchaQuebra(fx, e) { cacos(fx, e.x, e.y - 12, ['#f9a8d4', '#e2e8f0'], 4, 90); },
  avisoLinha(fx, e) { heroi(fx, 'linhaAviso', e.dur, { x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, cor: e.cor, larg: e.larg ?? 10 }); },
  pontaPedra(fx, e) { heroi(fx, 'pontaPedra', 1.4, { x: e.x, y: e.y, s: ale() }); cacos(fx, e.x, e.y - 4, ['#a68c3a', '#6b5a1e'], 3, 70); },
  fossilCai(fx, e) { heroi(fx, 'fossilCai', e.dur, { x: e.x, y: e.y, s: ale() * 6 }); },
  impactoFossil(fx, e) { heroi(fx, 'crateraPedra', 0.9, { x: e.x, y: e.y, r: e.radio }); cacos(fx, e.x, e.y - 4, ['#d6b48a', '#8a6a3a', '#5b4a2a'], 12, 200); },
  passadaAco(fx, e) { heroi(fx, 'cortePena', 0.3, { ...e }); },
  prismaFim(fx, e) { cacos(fx, e.x, e.y - 20, ['#f9a8d4', '#c4b5fd', '#fef3c7'], 12, 180); },
  estrelaAviso(fx, e) { heroi(fx, 'estrelaAviso', e.dur, { x: e.x, y: e.y, r: e.radio }); },
  estrelaCai(fx, e) { heroi(fx, 'estrelaImpacto', 0.5, { x: e.x, y: e.y, r: e.radio }); cacos(fx, e.x, e.y - 8, ['#f9a8d4', '#fbcfe8', '#fde68a'], 14, 220); },
  corteIai(fx, e) { heroi(fx, 'corteIai', 0.35, { ...e }); },
  corteIaiFim(fx, e) { heroi(fx, 'corteIaiFim', 0.3, { ...e }); },
  corteEstrela(fx, e) { heroi(fx, 'corteFino', 0.7, { ...e, cor: '#4ade80' }); },
  estrelaFecha(fx, e) { cacos(fx, e.x, e.y - 10, ['#86efac', '#dcfce7'], 12, 200); heroi(fx, 'cruzVerde', 0.3, { x: e.x, y: e.y }); },
  rastroSombra(fx, e) { heroi(fx, 'rastroSombra', 0.3, { ...e }); },
  roubaEnergia(fx, e) { heroi(fx, 'roubo', 0.4, { l: e.l, b: e.b }); },
  joiaExplode(fx, e) { cacos(fx, e.x, e.y - 8, ['#a78bfa', '#c4b5fd', '#4c1d95'], 14, 200); heroi(fx, 'estalo', 0.25, { x: e.x, y: e.y - 6, r: e.radio * 0.6, cor: '#8b5cf6' }); },
  joiaGuarda(fx, e) { cacos(fx, e.x, e.y - 10, ['#c4b5fd'], 3, 60); },
  joiaSolta(fx, e) { heroi(fx, 'estalo', 0.2, { x: e.l.x, y: e.l.y - 16, r: 18, cor: '#a78bfa' }); },
  mandibula(fx, e) { heroi(fx, 'mandibula', e.dur, { l: e.l, b: e.b }); },
  mordida(fx, e) { heroi(fx, 'mordidaM', 0.22, { x: e.x, y: e.y - 12, r: e.grande ? 20 : 13 }); },
  mandibulaDupla(fx, e) { heroi(fx, 'mandibulaV', e.dur + 0.25, { l: e.l, ang: e.ang, largo: e.largo, dur: e.dur }); },
  meditacao(fx, e) { heroi(fx, 'meditacao', e.dur, { l: e.l }); },
  palmaZen(fx, e) { heroi(fx, 'palmaZen', 0.35, { ...e }); },
  choqueParede(fx, e) { cacos(fx, e.x, e.y - 12, ['#fca5a5', '#f9a8d4', '#fde68a'], 8, 160); heroi(fx, 'estalo', 0.22, { x: e.x, y: e.y - 14, r: 16, cor: '#f472b6' }); },
  palma(fx, e) { heroi(fx, 'palmaM', 0.14, { x: e.x, y: e.y, ang: e.ang }); },
  marcasEstouram(fx, e) { heroi(fx, 'estalo', 0.28, { x: e.x, y: e.y - 14, r: 12 + Math.min(14, e.n), cor: '#f87171' }); cacos(fx, e.x, e.y - 14, ['#fca5a5', '#fde68a'], 8, 160); },
  saltoRaio(fx, e) { heroi(fx, 'raioRastro', 0.22, { ...e, s: ale() * 9 }); },
  trilhaRaio(fx, e) { heroi(fx, 'trilhaRaio', 0.35, { pts: e.pts, s: ale() * 9 }); },
  raioPara(fx, e) { heroi(fx, 'raioPara', 0.2, { ...e, s: ale() * 9 }); if (!e.vazio) fx.chispas(e.x, e.y - 8, '#fde047', 5, 140); },
  bombaLava(fx, e) { heroi(fx, 'bombaLava', e.dur, { ...e }); },
  costura(fx, e) { heroi(fx, 'linhaCostura', 1.2, { l: e.l, b: e.b, k: e.k }); },
  linhaPuxa(fx, e) { heroi(fx, 'linhaCostura', 0.25, { l: e.l, b: e.b, k: 3 }); },
  caixaAbre(fx, e) { heroi(fx, 'bonecoMola', 0.8, { x: e.x, y: e.y }); cacos(fx, e.x, e.y - 10, ['#7c3aed', '#facc15', '#1f2937'], 12, 200); },
  luaQuebra(fx, e) { cacos(fx, e.x, e.y - 16, ['#6d28d9', '#c4b5fd', '#1e1b4b'], 12, 200); },
  presagioCorte(fx, e) { heroi(fx, 'corteGrande', 0.35, { x: e.x, y: e.y - 14, forte: e.forte }); },
  congela(fx, e) { heroi(fx, 'blocoGelo', 1.2, { l: e.l }); },
  geloEstilhaca(fx, e) { cacos(fx, e.x, e.y - 12, ['#e0f2fe', '#7dd3fc', '#38bdf8'], 18, 220); },
  mordidaGelo(fx, e) { heroi(fx, 'mordidaM', 0.3, { x: e.x, y: e.y - 12, r: 24, gelo: true }); cacos(fx, e.x, e.y - 12, ['#e0f2fe', '#7dd3fc'], 10, 180); },
  sinoAparece(fx, e) { heroi(fx, 'sino', 0.3 + e.i * 0.25 + 0.35, { x: e.x, y: e.y }); },
  sinoToca(fx, e) { heroi(fx, 'ondaSino', 0.45, { x: e.x, y: e.y, r: e.radio, grande: e.grande }); },
  sinoGrande(fx, e) { heroi(fx, 'sinoGrande', e.dur, { x: e.x, y: e.y }); },
  torpedoBate(fx, e) { cacos(fx, e.x, e.y - 10, ['#bfdbfe', '#60a5fa', '#1e3a8a'], 12, 200); heroi(fx, 'estalo', 0.22, { x: e.x, y: e.y - 12, r: 18, cor: '#60a5fa' }); },
  saltoAgua(fx, e) { for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + entre(-1, 1); fx.add({ x: e.x, y: e.y - 4, vx: Math.cos(a) * entre(60, 160), vy: Math.sin(a) * entre(120, 220), g: 520, size: entre(1.6, 2.6), life: 0.6, color: i % 2 ? '#93c5fd' : '#dbeafe', forma: 'sq' }); } },
  terraMexe(fx, e) { fx.add({ x: e.x + entre(-6, 6), y: e.y, vx: entre(-30, 30), vy: -entre(40, 90), g: 300, size: 2, life: 0.4, color: ['#8a6a3a', '#5b4a2a', '#c8a868'][Math.floor(ale() * 3)], forma: 'sq' }); },
  brocaSai(fx, e) { heroi(fx, 'brocaSai', 0.4, { x: e.x, y: e.y, fim: e.fim }); cacos(fx, e.x, e.y - 4, ['#8a6a3a', '#5b4a2a', '#d1d5db'], e.fim ? 14 : 8, 200); },
  faisca(fx, e) { fx.chispas(e.x, e.y, '#fde68a', 3, 160); },
  cabecada(fx, e) { heroi(fx, 'estalo', 0.2, { x: e.x1, y: e.y1 - 14, r: 12 + e.i * 4, cor: '#fb923c' }); },
  redePega(fx, e) { heroi(fx, 'rede', 1.2, { b: e.b }); },
  socoBriga(fx, e) { heroi(fx, 'estalo', 0.16, { x: e.x + entre(-8, 8), y: e.y + entre(-6, 6), r: 9 + e.i * 2, cor: '#fdba74' }); },
  avisoCruz(fx, e) { heroi(fx, 'cruzAviso', e.dur, { x: e.x, y: e.y, b: e.braco }); },
  impactoCruz(fx, e) { heroi(fx, 'cruzImpacto', 0.5, { x: e.x, y: e.y, b: e.braco }); cacos(fx, e.x, e.y - 4, ['#d6b48a', '#86efac', '#5b4a2a'], 14, 220); },
  suplexImpacto(fx, e) { heroi(fx, 'crateraPedra', 1, { x: e.x, y: e.y, r: 40 }); cacos(fx, e.x, e.y - 4, ['#d6b48a', '#8a6a3a', '#bbf7d0'], 16, 240); },
  diamanteQuebra(fx, e) { cacos(fx, e.x, e.y - 4, ['#fbcfe8', '#f0abfc', '#fdf4ff'], 5, 120); },
  cristalPulsa(fx, e) { heroi(fx, 'pulsoCristal', 0.35, { x: e.x, y: e.y, r: e.radio }); },
  cristalQuebra(fx, e) { for (const p of e.pts) cacos(fx, p.x, p.y - 14, ['#fbcfe8', '#f0abfc', '#a21caf'], 6, 160); },
  rugido(fx, e) { heroi(fx, 'rugido', 0.5, { ...e }); },
  sopro(fx, e) { heroi(fx, 'sopro', 0.35, { ...e }); },
  chafariz(fx, e) { heroi(fx, 'chafariz', e.dur, { x: e.x, y: e.y }); },
  dragaoAguaBate(fx, e) { cacos(fx, e.x, e.y - 6, ['#a5f3fc', '#22d3ee', '#0e7490'], 12, 200); },
  trocaPostura(fx, e) { heroi(fx, 'postura', 0.3, { l: e.l, lamina: e.lamina }); },
  giroEspada(fx, e) { heroi(fx, 'giroEspada', 0.22, { x: e.x, y: e.y, r: e.radio }); },
  espadaCrava(fx, e) { heroi(fx, 'espadaCrava', 0.9, { x: e.x, y: e.y }); cacos(fx, e.x, e.y - 4, ['#9ca3af', '#a78bfa', '#5b4a2a'], 14, 220); },
});

// ---------------------------------------------------------------- desenhos curtos (k vai de 0 a 1)
Object.assign(HEROES_NOVOS, {
  linhaAviso(g, h, k) { g.globalAlpha = 0.18 + 0.3 * k; linhaGrossa(g, h.x0, h.y0, h.x1, h.y1, [h.cor], h.larg); g.globalAlpha = 0.6; g.setLineDash([4, 4]); linhaGrossa(g, h.x0, h.y0, h.x1, h.y1, [h.cor], 1); g.setLineDash([]); g.globalAlpha = 1; },
  pontaPedra(g, h, k) { const al = Math.min(1, (1 - k) * 4), s = Math.min(1, k * 8), H = 14 * s; g.globalAlpha = al; poli(g, [[h.x - 6, h.y], [h.x - 1, h.y - H], [h.x + 2, h.y - H * 0.7], [h.x + 6, h.y]], '#a68c3a'); PX.lineaPix(g, h.x - 1, h.y - H + 2, h.x - 2, h.y - 2, '#efe3a8', 1); g.globalAlpha = 1; },
  fossilCai(g, h, k) { const y = h.y - 160 * (1 - k); bordaChao(g, h.x, h.y, 14 * (0.5 + k * 0.5), '#d6b48a', 0.6, 1); poli(g, [[h.x - 7, y - 4], [h.x - 2, y - 10], [h.x + 7, y - 6], [h.x + 6, y + 3], [h.x - 5, y + 4]], '#8a6a3a'); PX.lineaPix(g, h.x - 4, y - 4, h.x + 3, y - 6, '#e8d29a', 1); },
  crateraPedra(g, h, k) { const al = 1 - k; elipseChao(g, h.x, h.y, h.r, '#3b2f1e', 0.45 * al); for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28, r = h.r * (0.6 + 0.3 * Math.sin(i * 3)); g.globalAlpha = al; lasca(g, h.x + Math.cos(a) * r, h.y + Math.sin(a) * r * 0.62, a, 8, 4, '#8a6a3a', '#d6b48a'); } g.globalAlpha = 1; },
  cortePena(g, h, k) { g.globalAlpha = 1 - k; linhaGrossa(g, h.x0, h.y0 - 14, h.x1, h.y1 - 14, ['#334155', '#cbd5e1', '#f8fafc'], 6 * (1 - k * 0.6)); g.globalAlpha = 1; },
  estrelaAviso(g, h, k) { bordaChao(g, h.x, h.y, h.r, '#f472b6', 0.5 + 0.3 * k, 2, 5); elipseChao(g, h.x, h.y, h.r * k, '#f9a8d4', 0.18); const y = h.y - 220 * (1 - k); estrela(g, h.x, y - 20, 10 + k * 10, '#f472b6', '#fbcfe8'); },
  estrelaImpacto(g, h, k) { g.globalAlpha = 1 - k; estrela(g, h.x, h.y - 20, 22 * (1 - k * 0.3), '#f472b6', '#fbcfe8'); elipseChao(g, h.x, h.y, h.r * (0.6 + 0.4 * k), '#db2777', 0.25); g.globalAlpha = 1; },
  corteIai(g, h, k) { g.globalAlpha = 1 - k; linhaGrossa(g, h.x0, h.y0 - 12, h.x1, h.y1 - 12, ['#14532d', '#4ade80', '#f0fdf4'], 5 * (1 - k)); g.globalAlpha = 1; },
  corteIaiFim(g, h, k) { const n = 5; for (let i = 0; i < n; i++) { const f = (i + 0.5) / n, x = h.x0 + (h.x1 - h.x0) * f, y = h.y0 + (h.y1 - h.y0) * f - 12, a = Math.atan2(h.y1 - h.y0, h.x1 - h.x0) + Math.PI / 2; g.globalAlpha = 1 - k; lasca(g, x, y, a + (i % 2 ? 0.3 : -0.3), 12 * (1 - k * 0.5), 3, '#22c55e', '#dcfce7'); } g.globalAlpha = 1; },
  corteFino(g, h, k) { g.globalAlpha = 1 - k; linhaGrossa(g, h.x0, h.y0 - 10, h.x1, h.y1 - 10, ['#14532d', h.cor, '#f0fdf4'], 4); g.globalAlpha = 1; },
  cruzVerde(g, h, k) { g.globalAlpha = 1 - k; const r = 26 * (0.6 + k); linhaGrossa(g, h.x - r, h.y - 14 - r * 0.6, h.x + r, h.y - 14 + r * 0.6, ['#14532d', '#4ade80'], 5); linhaGrossa(g, h.x + r, h.y - 14 - r * 0.6, h.x - r, h.y - 14 + r * 0.6, ['#14532d', '#4ade80'], 5); g.globalAlpha = 1; },
  rastroSombra(g, h, k) { g.globalAlpha = (1 - k) * 0.7; linhaGrossa(g, h.x0, h.y0 - 10, h.x1, h.y1 - 10, ['#1e1b4b', '#6d28d9'], 8); g.globalAlpha = 1; },
  roubo(g, h, k) { const x = h.b.x + (h.l.x - h.b.x) * k, y = h.b.y - 18 + (h.l.y - h.b.y) * k - Math.sin(k * Math.PI) * 24; for (let i = 0; i < 4; i++) lasca(g, x + Math.cos(i * 1.6) * 5, y + Math.sin(i * 1.6) * 4, i * 1.6, 4, 2, '#a78bfa', '#ede9fe'); },
  estalo(g, h, k) { g.globalAlpha = 1 - k; const r = h.r * (0.6 + k * 0.6); for (let i = 0; i < 6; i++) { const a = i * 1.047 + 0.3; lasca(g, h.x + Math.cos(a) * r * 0.5, h.y + Math.sin(a) * r * 0.5, a, r * 0.5, 2.5, h.cor, null); } g.globalAlpha = 1; },
  mandibula(g, h, k) {
    const l = h.l, b = h.b, a = Math.atan2(b.y - l.y, b.x - l.x), x = l.x + Math.cos(a) * 26, y = l.y + Math.sin(a) * 16 - 14, ab = Math.abs(Math.sin(k * Math.PI * 4)) * 0.6;
    g.save(); g.translate(px(x), px(y)); g.rotate(a);
    for (const s of [-1, 1]) { g.save(); g.rotate(s * ab); poli(g, [[-12, 0], [14, s * 2], [10, s * 10], [-10, s * 12]], '#1f2937'); for (let i = 0; i < 4; i++) poli(g, [[-6 + i * 5, s * 2], [-4 + i * 5, s * 6], [-2 + i * 5, s * 2]], '#f8fafc', null); g.restore(); }
    g.restore();
  },
  mordidaM(g, h, k) { const ab = 1 - Math.min(1, k * 2.2), r = h.r, cor = h.gelo ? '#7dd3fc' : '#f8fafc'; g.globalAlpha = 1 - k * k; for (const s of [-1, 1]) { const y = h.y + s * (4 + ab * r * 0.6); for (let i = 0; i < 4; i++) { const x = h.x - r * 0.6 + i * (r * 0.4); poli(g, [[x - 3, y], [x, y - s * 7], [x + 3, y]], cor); } } g.globalAlpha = 1; },
  mandibulaV(g, h, k) {
    const l = h.l, a = h.ang, fe = Math.min(1, h.t / h.dur), L = h.largo * Math.min(1, k * 3);
    for (const s of [-1, 1]) {
      const ab = (1 - fe) * 0.5, aa = a + s * ab, x1 = l.x + Math.cos(aa) * L, y1 = l.y + Math.sin(aa) * L * 0.8 - 12;
      linhaGrossa(g, l.x, l.y - 12, x1, y1, ['#111827', '#374151'], 7);
      g.save(); g.translate(px(x1), px(y1)); g.rotate(aa); poli(g, [[-8, 0], [10, -s * 2], [6, -s * 9], [-8, -s * 8]], '#1f2937'); for (let i = 0; i < 3; i++) poli(g, [[-4 + i * 5, -s * 1], [-2 + i * 5, -s * 5], [i * 5, -s * 1]], '#f8fafc', null); g.restore();
    }
  },
  meditacao(g, h, k) { const l = h.l, n = 3; for (let i = 0; i < n; i++) { const a = k * 6 + (i * 6.28) / n, x = l.x + Math.cos(a) * 20, y = l.y - 14 + Math.sin(a) * 8; PX.disco(g, px(x), px(y), 2, '#f472b6'); } },
  palmaZen(g, h, k) { const a = h.ang, L = h.largo * Math.min(1, k * 2.5), c = Math.cos(a), s = Math.sin(a); g.globalAlpha = 1 - k; for (let i = 0; i < 4; i++) { const d = L * (i / 3), x = h.x + c * d, y = h.y - 14 + s * d * 0.8; palmaDes(g, x, y, a, 6 + i * 2); } g.globalAlpha = 1; },
  palmaM(g, h, k) { g.globalAlpha = 1 - k; palmaDes(g, h.x, h.y, h.ang, 7); g.globalAlpha = 1; },
  raioRastro(g, h, k) { g.globalAlpha = 1 - k; raioZig(g, h.x0, h.y0 - 12, h.x1, h.y1 - 12, h.s, '#facc15', 3); raioZig(g, h.x0, h.y0 - 12, h.x1, h.y1 - 12, h.s, '#fef9c3', 1); g.globalAlpha = 1; },
  trilhaRaio(g, h, k) { g.globalAlpha = 1 - k; for (let i = 1; i < h.pts.length; i++) { const p = h.pts[i - 1], q = h.pts[i]; raioZig(g, p.x, p.y - 2, q.x, q.y - 2, h.s + i + Math.floor(k * 4), '#facc15', 3); raioZig(g, p.x, p.y - 2, q.x, q.y - 2, h.s + i + Math.floor(k * 4), '#fef9c3', 1); } g.globalAlpha = 1; },
  raioPara(g, h, k) { g.globalAlpha = 1 - k; raioZig(g, h.rx, h.ry - 46, h.x, h.y - 8, h.s, '#facc15', 2); raioZig(g, h.x, h.y - 160, h.x, h.y - 8, h.s + 1, '#fde047', 2); g.globalAlpha = 1; },
  bombaLava(g, h, k) { const x = h.x0 + (h.x - h.x0) * k, y = h.y0 + (h.y - h.y0) * k - Math.sin(k * Math.PI) * 70; PX.esfera(g, px(x), px(y), 4, ['#450a0a', '#c2410c', '#fb923c', '#fde68a']); bordaChao(g, h.x, h.y, 12 + k * 8, '#f97316', 0.5 * k, 1); },
  linhaCostura(g, h, k) { const l = h.l, b = h.b; if (b.ko) return; g.globalAlpha = 1 - k * 0.6; g.strokeStyle = '#f5f5f4'; g.lineWidth = 1; g.setLineDash([3, 2]); g.beginPath(); g.moveTo(l.x, l.y - 16); g.quadraticCurveTo((l.x + b.x) / 2, Math.min(l.y, b.y) - 30, b.x, b.y - 12); g.stroke(); g.setLineDash([]); for (let i = 0; i < Math.min(3, h.k); i++) { PX.lineaPix(g, b.x - 6 + i * 5, b.y - 6, b.x - 2 + i * 5, b.y - 2, '#a8a29e', 1); PX.lineaPix(g, b.x - 2 + i * 5, b.y - 6, b.x - 6 + i * 5, b.y - 2, '#a8a29e', 1); } g.globalAlpha = 1; },
  bonecoMola(g, h, k) { const s = Math.sin(Math.min(1, k * 2) * Math.PI * 0.5), H = 40 * s * (1 - k * 0.3), x = h.x, y = h.y - 6; for (let i = 0; i < 5; i++) { const yy = y - (H * i) / 5; PX.lineaPix(g, x - 5, yy, x + 5, yy - H / 10, '#9ca3af', 2); } const cy = y - H - 8; PX.esfera(g, px(x), px(cy), 8, ['#0b0a14', '#4c1d95', '#7c3aed', '#c4b5fd']); PX.disco(g, px(x - 3), px(cy - 1), 1.5, '#facc15'); PX.disco(g, px(x + 3), px(cy - 1), 1.5, '#facc15'); PX.lineaPix(g, x - 4, cy + 3, x + 4, cy + 3, '#facc15', 1); },
  corteGrande(g, h, k) { g.globalAlpha = 1 - k; const r = (h.forte ? 34 : 24) * (0.7 + k * 0.5); linhaGrossa(g, h.x - r, h.y - r * 0.7, h.x + r, h.y + r * 0.7, ['#1e1b4b', '#7c3aed', '#ede9fe'], h.forte ? 8 : 5); g.globalAlpha = 1; },
  blocoGelo(g, h, k) { const l = h.l; if (l.ko) return; const al = Math.min(1, (1 - k) * 4); g.globalAlpha = al * 0.75; poli(g, [[l.x - 14, l.y], [l.x - 16, l.y - 22], [l.x - 6, l.y - 34], [l.x + 10, l.y - 32], [l.x + 16, l.y - 18], [l.x + 13, l.y]], '#7dd3fc', '#0c4a6e'); g.globalAlpha = al; PX.lineaPix(g, l.x - 9, l.y - 26, l.x - 4, l.y - 8, '#e0f2fe', 1); PX.lineaPix(g, l.x + 6, l.y - 28, l.x + 10, l.y - 20, '#e0f2fe', 1); g.globalAlpha = 1; },
  sino(g, h, k) { const y = h.y - 30 - Math.sin(k * 12) * 2; desenhaSino(g, h.x, y, 7, Math.sin(k * 20) * 0.2); },
  ondaSino(g, h, k) { const r = h.r * (0.3 + k * 0.7); g.globalAlpha = 1 - k; for (let i = 0; i < 2; i++) bordaChao(g, h.x, h.y, r * (1 - i * 0.18), i ? '#a5b4fc' : '#fde68a', 1, h.grande ? 3 : 2); for (let i = 0; i < 8; i++) { const a = i * 0.785, x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r * 0.62 - 6; PX.carimbar(g, PX.nota(5, '#fde68a'), x, y, 0, 1, 1 - k); } g.globalAlpha = 1; },
  sinoGrande(g, h, k) { const t = h.t, y = h.y - 70 + Math.sin(t * 3) * 2; g.globalAlpha = Math.min(1, (1 - k) * 6, k * 10); desenhaSino(g, h.x, y, 18, Math.sin(t * 9) * 0.25); g.globalAlpha = 1; },
  brocaSai(g, h, k) { const H = (h.fim ? 34 : 24) * Math.sin(Math.min(1, k * 2) * Math.PI * 0.5) * (1 - k * 0.5); g.globalAlpha = 1 - k * 0.6; poli(g, [[h.x - 8, h.y], [h.x, h.y - H], [h.x + 8, h.y]], '#9ca3af'); for (let i = 1; i < 4; i++) PX.lineaPix(g, h.x - 8 + i * 2, h.y - (H * i) / 4, h.x + 8 - i * 2, h.y - (H * i) / 4 - 3, '#e5e7eb', 1); g.globalAlpha = 1; },
  rede(g, h, k) { const b = h.b; if (b.ko) return; g.globalAlpha = 1 - k * k; g.strokeStyle = '#fb923c'; g.lineWidth = 1; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(b.x - 14, b.y - 16 + i * 6); g.lineTo(b.x + 14, b.y - 16 + i * 6); g.stroke(); g.beginPath(); g.moveTo(b.x + i * 6, b.y - 30); g.lineTo(b.x + i * 6, b.y - 2); g.stroke(); } g.globalAlpha = 1; },
  cruzAviso(g, h, k) { g.globalAlpha = 0.25 + 0.35 * k; g.fillStyle = '#86efac'; g.fillRect(px(h.x - h.b), px(h.y - 6), px(h.b * 2), 12); g.fillRect(px(h.x - 7), px(h.y - h.b * 0.62), 14, px(h.b * 1.24)); g.globalAlpha = 1; PX.disco(g, px(h.x), px(h.y), 4 + k * 4, '#22c55e'); },
  cruzImpacto(g, h, k) { const al = 1 - k; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 0.62], [0, -0.62]]) for (let i = 1; i <= 4; i++) { const d = h.b * (i / 4) * Math.min(1, k * 3), x = h.x + dx * d, y = h.y + dy * d; g.globalAlpha = al; lasca(g, x, y - 2, -Math.PI / 2 + entre(-0.3, 0.3) * 0, 10 - i, 3, '#8a6a3a', '#d6b48a'); } g.globalAlpha = 1; },
  pulsoCristal(g, h, k) { bordaChao(g, h.x, h.y, h.r * (0.2 + k * 0.8), '#f0abfc', (1 - k) * 0.8, 2); },
  rugido(g, h, k) { const a = h.ang; g.globalAlpha = 1 - k; for (let i = 0; i < 3; i++) { const r = h.alcance * (0.3 + 0.7 * ((k + i / 3) % 1)); g.strokeStyle = i % 2 ? '#86efac' : '#bbf7d0'; g.lineWidth = 3; g.beginPath(); g.ellipse(h.x, h.y - 12, r, r * 0.62, 0, a - 0.65, a + 0.65); g.stroke(); } g.globalAlpha = 1; },
  sopro(g, h, k) { g.globalAlpha = 1 - k; linhaGrossa(g, h.x0, h.y0 - 14, h.x1, h.y1 - 14, ['#14532d', '#22c55e', '#bbf7d0'], 12 * (1 - k * 0.5)); g.globalAlpha = 1; },
  chafariz(g, h, k) { const H = 50 * Math.sin(Math.min(1, k * 1.5) * Math.PI * 0.5); g.globalAlpha = 1 - k * 0.5; poli(g, [[h.x - 10, h.y], [h.x - 5, h.y - H], [h.x + 5, h.y - H], [h.x + 10, h.y]], '#22d3ee', '#0e7490'); PX.lineaPix(g, h.x - 2, h.y - H + 4, h.x - 3, h.y - 4, '#cffafe', 1); g.globalAlpha = 1; },
  postura(g, h, k) { const l = h.l; g.globalAlpha = 1 - k; if (h.lamina) lasca(g, l.x + 10, l.y - 30 - k * 8, -Math.PI / 2, 14, 3, '#9ca3af', '#f3f4f6'); else poli(g, [[l.x - 12, l.y - 30], [l.x + 12, l.y - 30], [l.x + 8, l.y - 12], [l.x, l.y - 6], [l.x - 8, l.y - 12]], '#fde68a'); g.globalAlpha = 1; },
  giroEspada(g, h, k) { const a = k * 6.28; g.globalAlpha = 1 - k * 0.5; g.strokeStyle = '#a78bfa'; g.lineWidth = 3; g.beginPath(); g.ellipse(h.x, h.y - 12, h.r, h.r * 0.62, 0, a, a + 2.4); g.stroke(); lasca(g, h.x + Math.cos(a + 2.4) * h.r, h.y - 12 + Math.sin(a + 2.4) * h.r * 0.62, a + 2.4 + Math.PI / 2, 12, 3, '#d1d5db', '#ffffff'); g.globalAlpha = 1; },
  espadaCrava(g, h, k) { const y = h.y - Math.max(0, 1 - k * 6) * 120, al = Math.min(1, (1 - k) * 3); g.globalAlpha = al; poli(g, [[h.x - 4, y - 40], [h.x + 4, y - 40], [h.x + 3, y], [h.x, y + 6], [h.x - 3, y]], '#d1d5db'); poli(g, [[h.x - 12, y - 42], [h.x + 12, y - 42], [h.x + 10, y - 38], [h.x - 10, y - 38]], '#a16207'); PX.disco(g, px(h.x), px(y - 48), 3, '#7c3aed'); elipseChao(g, h.x, h.y, 22, '#1f2937', 0.4); g.globalAlpha = 1; },
});

function estrela(g, x, y, R, cor, claro) {
  const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R * 0.45 : R; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
  poli(g, pts, cor); PX.lineaPix(g, x - R * 0.2, y - R * 0.5, x - R * 0.05, y - R * 0.1, claro, 1);
}
function palmaDes(g, x, y, a, r) { g.save(); g.translate(px(x), px(y)); g.rotate(a); poli(g, [[-r * 0.6, -r * 0.7], [r * 0.5, -r * 0.8], [r, -r * 0.2], [r, r * 0.3], [r * 0.4, r * 0.8], [-r * 0.6, r * 0.7]], '#f472b6', '#831843'); g.restore(); }
function desenhaSino(g, x, y, r, rot) { g.save(); g.translate(px(x), px(y)); g.rotate(rot); poli(g, [[-r * 0.5, -r], [r * 0.5, -r], [r * 0.8, r * 0.5], [r, r * 0.8], [-r, r * 0.8], [-r * 0.8, r * 0.5]], '#fde68a', '#78350f'); PX.disco(g, 0, px(r * 0.9), Math.max(1.5, r * 0.22), '#b45309'); PX.lineaPix(g, -r * 0.3, -r * 0.7, -r * 0.5, r * 0.4, '#fffbeb', 1); g.restore(); }

// ---------------------------------------------------------------- entidades (o que fica na arena)
Object.assign(ENTIDADES_NOVAS, {
  mareLenta(g, e) { const r = e.r, al = Math.min(1, (e.dur - e.t) * 3); g.globalAlpha = al; for (let i = 0; i < 18; i++) { const a = (i / 18) * 6.28, x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r * 0.62; poli(g, [[x - 6, y], [x - 2, y - 7], [x + 4, y - 9], [x + 6, y]], i % 2 ? '#3b82f6' : '#60a5fa', '#1e3a8a'); } elipseChao(g, e.x, e.y, r, '#60a5fa', 0.12); g.globalAlpha = 1; },
  conchaGiro(g, e) { const x = e.x, y = e.y - 12; g.save(); g.translate(px(x), px(y)); g.rotate(e.t * 14); poli(g, [[0, -6], [6, 0], [3, 5], [-3, 5], [-6, 0]], '#f9a8d4', '#831843'); PX.lineaPix(g, 0, -4, 0, 4, '#fdf2f8', 1); g.restore(); },
  cortinaLaminas(g, e, t) { const al = Math.min(1, (e.dur - e.t) * 2), n = Math.max(3, Math.round(Math.hypot(e.x1 - e.x0, e.y1 - e.y0) / 14)); g.globalAlpha = al; for (let i = 0; i <= n; i++) { const f = i / n, x = e.x0 + (e.x1 - e.x0) * f, y = e.y0 + (e.y1 - e.y0) * f, b = Math.sin(t * 5 + i) * 2; PX.lineaPix(g, x, y - 30, x, y - 22 + b, '#64748b', 1); lasca(g, x, y - 14 + b, Math.PI / 2 + Math.sin(t * 3 + i) * 0.2, 8, 3, '#cbd5e1', '#f8fafc'); } g.globalAlpha = 1; },
  prismaLunar(g, e, t) {
    const on = e.t > 0.35;
    if (on) { const s = Math.floor(t * 20); g.globalAlpha = 0.85; for (let i = 0; i < 3; i++) { const p = e.pts[i], q = e.pts[(i + 1) % 3]; linhaGrossa(g, p.x, p.y - 16, q.x, q.y - 16, ['#be185d', (s + i) % 2 ? '#f9a8d4' : '#fbcfe8'], 4); } g.globalAlpha = 1; elipseChao(g, e.x, e.y, 30, '#f472b6', 0.15); }
    for (const p of e.pts) { const y = p.y - 16 - Math.sin(t * 4 + p.x) * 2; poli(g, [[p.x, y - 10], [p.x + 6, y], [p.x, y + 8], [p.x - 6, y]], '#f9a8d4', '#831843'); PX.lineaPix(g, p.x - 1, y - 6, p.x - 3, y, '#fdf2f8', 1); }
  },
  joiaFalsa(g, e, t) { const pis = e.t > e.dur - 0.4 && Math.floor(t * 16) % 2; poli(g, [[e.x, e.y - 18], [e.x + 7, e.y - 10], [e.x, e.y - 2], [e.x - 7, e.y - 10]], pis ? '#ede9fe' : '#8b5cf6', '#2e1065'); },
  joiaEspelho(g, e, t) { const a = e.ang, x = e.x + Math.cos(a) * 18, y = e.y - 16 + Math.sin(a) * 12, s = 1 + Math.sin(t * 8) * 0.05; g.save(); g.translate(px(x), px(y)); g.scale(s, s); poli(g, [[0, -14], [10, -4], [7, 10], [-7, 10], [-10, -4]], '#a78bfa', '#2e1065'); poli(g, [[0, -9], [5, -3], [0, 5], [-5, -3]], '#ddd6fe', null); g.restore(); for (let i = 0; i < Math.min(6, e.guardados); i++) PX.disco(g, px(x - 8 + i * 3), px(y + 14), 1, '#ede9fe'); },
  lascaJoia(g, e) { lasca(g, e.x, e.y - 14, e.ang, 6, 2.5, '#a78bfa', '#ede9fe'); },
  paraRaios(g, e, t) { const al = Math.min(1, (e.dur - e.t) * 3); g.globalAlpha = al; bordaChao(g, e.x, e.y, e.radio, '#facc15', 0.35, 1, 4); PX.lineaPix(g, e.x, e.y, e.x, e.y - 44, '#78716c', 3); PX.lineaPix(g, e.x, e.y, e.x, e.y - 44, '#d6d3d1', 1); poli(g, [[e.x - 4, e.y - 44], [e.x, e.y - 52], [e.x + 4, e.y - 44]], '#fde047', '#713f12'); if (Math.floor(t * 12) % 3 === 0) raioZig(g, e.x, e.y - 50, e.x + entre(-10, 10), e.y - 62, t, '#fef08a', 1); g.globalAlpha = 1; },
  pocaLava(g, e, t) { const al = Math.min(1, (e.dur - e.t) * 2); elipseChao(g, e.x, e.y, 18, '#7c2d12', 0.7 * al); elipseChao(g, e.x, e.y, 12, '#ea580c', 0.7 * al); if (Math.floor(t * 6 + e.x) % 4 === 0) PX.disco(g, px(e.x + Math.sin(t * 3 + e.y) * 6), px(e.y), 1.5, '#fde68a'); },
  fendaMagma(g, e, t) {
    const c = Math.cos(e.ang), s = Math.sin(e.ang), n = Math.max(2, Math.round(e.d / 10)), fogo = e.t > e.abre, al = Math.min(1, (e.dur - e.t) * 2);
    g.globalAlpha = al; g.strokeStyle = '#1c0a05'; g.lineWidth = 6; g.beginPath(); for (let i = 0; i <= n; i++) { const d = (e.d * i) / n, o = Math.sin(i * 2.3) * 4; const x = e.x0 + c * d - s * o, y = e.y0 + s * d + c * o * 0.62; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.strokeStyle = '#f97316'; g.lineWidth = 2; g.stroke();
    if (fogo) for (let i = 0; i <= n; i += 2) { const d = (e.d * i) / n, x = e.x0 + c * d, y = e.y0 + s * d, H = 10 + Math.abs(Math.sin(t * 9 + i)) * 12; poli(g, [[x - 5, y], [x - 2, y - H * 0.6], [x, y - H], [x + 3, y - H * 0.5], [x + 5, y]], i % 4 ? '#f97316' : '#fb923c', '#7c2d12'); PX.lineaPix(g, x, y - 2, x, y - H * 0.5, '#fde68a', 1); }
    g.globalAlpha = 1;
  },
  agulha(g, e) { const c = Math.cos(e.ang), s = Math.sin(e.ang), x = e.x, y = e.y - 14; PX.lineaPix(g, x - c * 8, y - s * 8, x + c * 6, y + s * 6, '#d6d3d1', 2); PX.lineaPix(g, x - c * 10, y - s * 10, x - c * 16, y - s * 13, '#f5f5f4', 1); },
  caixaSurpresa(g, e, t) { if (e.abriu) { bordaChao(g, e.x, e.y, e.radio, '#7c3aed', Math.max(0, 1 - (e.t - e.espera) * 2), 2); return; } const tr = Math.sin(t * 30) * (e.t / e.espera) * 2; bordaChao(g, e.x, e.y, e.radio, '#8b5cf6', 0.6, 1, 4); const x = e.x + tr, y = e.y - 6; poli(g, [[x - 10, y], [x - 10, y - 16], [x + 10, y - 16], [x + 10, y]], '#4c1d95', C); poli(g, [[x - 11, y - 16], [x - 11, y - 19], [x + 11, y - 19], [x + 11, y - 16]], '#7c3aed', C); PX.lineaPix(g, x - 9, y - 8, x + 9, y - 8, '#facc15', 1); },
  luaDesastre(g, e, t) { const x = e.x, y = e.y - 18, a = t * 16, R = Math.min(e.radio, 18 + e.t * 40); g.save(); g.translate(px(x), px(y)); g.rotate(a); g.scale(1, 0.62); g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 1.3); g.arc(R * 0.25, 0, R * 0.75, Math.PI * 1.3, 0, true); g.closePath(); g.fillStyle = '#4c1d95'; g.fill(); g.strokeStyle = '#ddd6fe'; g.lineWidth = 2; g.stroke(); g.restore(); if (e.t > e.voo) elipseChao(g, e.cx, e.cy, e.radio, '#4c1d95', 0.18); },
  presagio(g, e, t) { const b = e.b; if (b.ko) return; const rest = e.dur - e.t, x = b.x, y = b.y - b.alto - 16; const n = Math.ceil(rest); for (let i = 0; i < 3; i++) PX.disco(g, px(x - 8 + i * 8), px(y), 2.5, i < n ? '#a855f7' : '#3b0764'); if (rest < 0.6 && Math.floor(t * 14) % 2) { PX.lineaPix(g, x - 10, y + 6, x + 10, y + 22, '#e9d5ff', 1); } },
  prisaoGelo(g, e, t) {
    const R = e.radio, prep = Math.min(1, e.t / e.aviso);
    elipseChao(g, e.x, e.y, R, '#bae6fd', 0.2 + 0.15 * prep); bordaChao(g, e.x, e.y, R, '#7dd3fc', 0.8, 2);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28, r = R * (0.9 - (1 - prep) * 0.3), x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r * 0.62; const H = 4 + prep * 10; poli(g, [[x - 3, y], [x, y - H], [x + 3, y]], '#e0f2fe', '#0c4a6e'); }
  },
  bocaGelo(g, e, t) { const a = e.ang, x = e.x + Math.cos(a) * 18, y = e.y - 12 + Math.sin(a) * 10; g.globalAlpha = 0.25; g.fillStyle = '#bae6fd'; g.beginPath(); g.moveTo(x, y); g.arc(x, y, e.alcance, a - 0.6, a + 0.6); g.closePath(); g.fill(); g.globalAlpha = 1; for (let i = 0; i < 8; i++) { const f = ((t * 1.8 + i / 8) % 1), d = e.alcance * (1 - f), aa = a + Math.sin(i * 2.1) * 0.5, px2 = x + Math.cos(aa) * d, py = y + Math.sin(aa) * d * 0.8; lasca(g, px2, py, aa + Math.PI, 4, 1.5, '#e0f2fe', null); } },
  torpedo(g, e) { const c = Math.cos(e.ang), s = Math.sin(e.ang); for (let i = 1; i <= 3; i++) PX.disco(g, px(e.x - c * i * 9), px(e.y - s * i * 6 - 8), 3 - i * 0.6, '#93c5fd'); },
  frenesi(g, e, t) { const k = e.t / e.dur; bordaChao(g, e.cx, e.cy, 60, '#60a5fa', 0.5, 2, 6); elipseChao(g, e.cx, e.cy, 60, '#1e3a8a', 0.15); const a = e.ang + Math.PI / 2, x = e.x, y = e.y; g.save(); g.translate(px(x), px(y)); g.rotate(Math.cos(a) > 0 ? 0 : 0); poli(g, [[-6, 0], [Math.cos(a) * 4, -14], [6, 0]], '#1e40af', C); g.restore(); if (ale() < 0.5 + k * 0.4) PX.disco(g, px(x + entre(-6, 6)), px(y), 1.5, '#dbeafe'); },
  brocaTunel(g, e, t) { elipseChao(g, e.x, e.y, 12, '#3b2f1e', 0.5); for (let i = 0; i < 3; i++) { const a = t * 10 + i * 2.1; PX.disco(g, px(e.x + Math.cos(a) * 8), px(e.y + Math.sin(a) * 4), 2, '#8a6a3a'); } },
  brocaGigante(g, e, t) { const a = e.ang, c = Math.cos(a), s = Math.sin(a), x0 = e.x + c * 12, y0 = e.y - 14 + s * 8, L = e.alcance, x1 = e.x + c * L, y1 = e.y - 14 + s * L * 0.8, W = 14; const nx = -s, ny = c; poli(g, [[x0 + nx * W, y0 + ny * W * 0.8], [x1, y1], [x0 - nx * W, y0 - ny * W * 0.8]], '#6b7280'); for (let i = 1; i < 6; i++) { const f = ((i / 6) + t * 4) % 1, w = W * (1 - f), cx = x0 + (x1 - x0) * f, cy = y0 + (y1 - y0) * f; PX.lineaPix(g, cx + nx * w, cy + ny * w * 0.8, cx - nx * w * 0.6 + c * 4, cy - ny * w * 0.5 + s * 3, '#e5e7eb', 1); } },
  capuzRede(g, e) { const x = e.x, y = e.y - 14; g.strokeStyle = '#fb923c'; g.lineWidth = 1; PX.lineaPix(g, e.x0, e.y0 - 14, x, y, '#c2410c', 1); for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x - 8, y + i * 5); g.lineTo(x + 8, y + i * 5); g.stroke(); g.beginPath(); g.moveTo(x + i * 5, y - 8); g.lineTo(x + i * 5, y + 8); g.stroke(); } },
  diamante(g, e) { const y = e.y - 6; poli(g, [[e.x, y - 6], [e.x + 4, y], [e.x, y + 5], [e.x - 4, y]], '#f0abfc', '#701a75'); PX.disco(g, px(e.x - 1), px(y - 2), 1, '#fdf4ff'); },
  jardimCristal(g, e, t) { const al = Math.min(1, (e.dur - e.t) * 3, e.t * 6); g.globalAlpha = al; elipseChao(g, e.x, e.y, e.radio, '#f0abfc', 0.12); for (let i = 0; i < e.pts.length; i++) { const p = e.pts[i], q = e.pts[(i + 1) % e.pts.length]; g.globalAlpha = al * 0.5; linhaGrossa(g, p.x, p.y - 6, q.x, q.y - 6, ['#f0abfc'], 1); g.globalAlpha = al; const H = 26 + Math.sin(i * 2) * 4; poli(g, [[p.x - 6, p.y], [p.x - 5, p.y - H * 0.7], [p.x, p.y - H], [p.x + 5, p.y - H * 0.7], [p.x + 6, p.y]], '#f9a8d4', '#701a75'); PX.lineaPix(g, p.x - 2, p.y - H + 6, p.x - 3, p.y - 4, '#fdf4ff', 1); } g.globalAlpha = 1; },
  fitaDraco(g, e) { const p = e.pts; for (let i = 1; i < p.length; i++) { const f = i / p.length; linhaGrossa(g, p[i - 1].x, p[i - 1].y - 14, p[i].x, p[i].y - 14, ['#14532d', '#4ade80', '#dcfce7'], 2 + f * 6); } },
  dondozo(g, e) { if (e.t < 0.35) return; const a = e.ang, c = Math.cos(a), s = Math.sin(a), x = e.x, y = e.y - 18; g.save(); g.translate(px(x), px(y)); g.scale(c >= 0 ? 1 : -1, 1); g.globalAlpha = 0.85; poli(g, [[-40, -14], [10, -20], [30, -6], [32, 8], [-30, 14], [-48, 4]], '#64748b', C); poli(g, [[-48, 4], [-60, -10], [-58, 14]], '#475569', C); poli(g, [[10, 2], [30, 2], [28, 8], [8, 8]], '#fda4af', null); PX.disco(g, 18, -8, 2, '#f8fafc'); g.restore(); g.globalAlpha = 1; },
  dragaoAgua(g, e) { const p = e.pts; for (let i = 1; i < p.length; i++) { const f = i / p.length; linhaGrossa(g, p[i - 1].x, p[i - 1].y, p[i].x, p[i].y, ['#0e7490', '#22d3ee'], 2 + f * 6); } lasca(g, e.x, e.y, e.ang, 8, 4, '#22d3ee', '#cffafe'); },
  muralhaReal(g, e, t) { const a = e.ang, x = e.x + Math.cos(a) * 26, y = e.y - 18 + Math.sin(a) * 14, al = Math.min(1, (e.dur - e.t) * 4); g.globalAlpha = al; g.save(); g.translate(px(x), px(y)); poli(g, [[-14, -18], [14, -18], [12, 6], [0, 18], [-12, 6]], '#a16207', C); poli(g, [[-9, -13], [9, -13], [8, 4], [0, 12], [-8, 4]], '#fde68a', null); PX.disco(g, 0, -3, 3, '#7c3aed'); g.restore(); g.globalAlpha = 1; },
});
