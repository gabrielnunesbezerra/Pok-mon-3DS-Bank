// Desenhos dos kits de Mawile, Skarmory, Tatsugiri e Sharpedo (engine/formasKits4.js): formas sólidas em pixel com
// contorno e partículas, sem brilho em volta.
import * as PX from './pixelfx.js';
import { EVENTOS_NOVOS, HEROES_NOVOS, ENTIDADES_NOVAS } from './efectosNovos.js';

const px = Math.round, ale = Math.random, entre = (a, b) => a + ale() * (b - a);
const C = '#0b0a14';
const heroi = (fx, k, life, o) => fx.heroes.push({ k, t: 0, life, ...o });
function poli(g, pts, cor, contorno = C) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(px(x), px(y)) : g.moveTo(px(x), px(y)))); g.closePath(); g.fillStyle = cor; g.fill(); if (contorno) { g.strokeStyle = contorno; g.lineWidth = 1; g.stroke(); } }
const cacos = (fx, x, y, cores, n = 6, v = 120, forma = 'sq') => { for (let i = 0; i < n; i++) { const a = ale() * 6.28; fx.add({ x, y, vx: Math.cos(a) * entre(v * 0.4, v), vy: Math.sin(a) * entre(v * 0.3, v * 0.7) - 40, g: 320, size: entre(1.5, 2.6), life: 0.45, color: cores[i % cores.length], forma }); } };
const gotas = (fx, x, y, n = 8, v = 120) => { for (let i = 0; i < n; i++) { const a = ale() * 6.28, s = entre(v * 0.4, v); fx.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5 - 70, g: 380, size: entre(1.6, 2.6), life: entre(0.4, 0.6), forma: 'gota', rampa: PX.RAMPA_AGUA }); } };
const penas = (fx, x, y, n = 8, v = 140) => { for (let i = 0; i < n; i++) { const a = ale() * 6.28, s = entre(v * 0.4, v); fx.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5 - 50, g: 160, drag: 2, size: entre(2, 3.2), life: entre(0.5, 0.8), color: i % 3 ? '#cbd5e1' : '#7f1d1d', forma: 'sq', vr: entre(-12, 12) }); } };
// uma fileira de dentes (para cima ou para baixo)
function dentes(g, x0, x1, y, s, n, cor = '#f8fafc') { const w = (x1 - x0) / n; for (let i = 0; i < n; i++) poli(g, [[x0 + i * w, y], [x0 + (i + 0.5) * w, y + s * w * 1.1], [x0 + (i + 1) * w, y]], cor); }
// mandíbula aberta: arco de cima e de baixo fechando
function mandibulaDesenho(g, x, y, a, R, abre, cor, dente = '#f8fafc') {
  g.save(); g.translate(px(x), px(y)); g.rotate(a);
  for (const s of [-1, 1]) { const o = s * (2 + abre * R * 0.5); poli(g, [[-R * 0.3, o], [R * 0.6, o + s * 2], [R, o + s * R * 0.22], [R * 0.5, o + s * R * 0.42], [-R * 0.4, o + s * R * 0.36]], cor); dentes(g, -R * 0.2, R * 0.8, o, -s, 5, dente); }
  g.restore();
}

Object.assign(EVENTOS_NOVOS, {
  boteMand(fx, e) { heroi(fx, 'mandAco', 0.32, { x: e.x, y: e.y - 12, ang: e.ang, dupla: e.dupla }); cacos(fx, e.x, e.y - 10, ['#94a3b8', '#e2e8f0', '#f9a8d4'], 6, 110); },
  giroAco(fx, e) { heroi(fx, 'giroAco', 0.34, { l: e.l, r: e.radio, mega: e.mega }); cacos(fx, e.l.x, e.l.y - 8, ['#94a3b8', '#e2e8f0', '#475569'], e.mega ? 12 : 6, 200); },
  mordidaGigante(fx, e) { heroi(fx, 'mordidaG', 0.38, { x: e.l.x, y: e.l.y, ang: e.ang, R: e.alcance, abre: e.angulo, cruz: e.cruz, tubarao: e.tubarao }); const x = e.l.x + Math.cos(e.ang) * e.alcance * 0.6, y = e.l.y + Math.sin(e.ang) * e.alcance * 0.4; if (e.tubarao) gotas(fx, x, y - 10, 8, 140); else cacos(fx, x, y - 10, ['#94a3b8', '#f8fafc', '#a7f3d0'], 10, 170); },
  rasante(fx, e) { heroi(fx, 'rastroAsa', 0.3, { ...e }); penas(fx, e.x1, e.y1 - 12, 6, 120); },
  plumagem(fx, e) { heroi(fx, 'plumagem', e.dur, { l: e.l, ang: e.ang, mega: e.mega }); penas(fx, e.l.x, e.l.y - 14, 6, 90); },
  explodePenas(fx, e) { penas(fx, e.x, e.y - 14, 22, 260); fx.anillo(e.x, e.y, 6, e.radio, '#cbd5e1', 0.35, 3); },
  decola(fx, e) { heroi(fx, 'sombraAlvo', 0.6, { x: e.x, y: e.y, r: e.radio }); penas(fx, e.l.x, e.l.y - 10, 8, 120); },
  impactoAco(fx, e) { cacos(fx, e.x, e.y - 6, ['#94a3b8', '#e2e8f0', '#475569', '#7f1d1d'], 16, 240); fx.anillo(e.x, e.y, 6, e.radio, '#e2e8f0', 0.4, 3); fx.debris?.(e.x, e.y, 'ROCK', 6); },
  deslize(fx, e) { gotas(fx, e.x1, e.y1 - 4, 8, 110); },
  torretaSobe(fx, e) { gotas(fx, e.l.x, e.l.y - 6, 14, 150); },
  tiroTorreta(fx, e) { gotas(fx, e.x, e.y - 10, 4, 90); },
  bolhaGigante(fx, e) { heroi(fx, 'bolhaG', 0.45, { x: e.x, y: e.y }); },
  sangue(fx, e) { for (let i = 0; i < 3; i++) fx.add({ x: e.x + entre(-4, 4), y: e.y, vx: entre(-30, 30), vy: -entre(20, 60), g: 400, size: entre(1.4, 2.2), life: 0.45, color: i % 2 ? '#b91c1c' : '#7f1d1d', forma: 'sq' }); },
  corteSerra(fx, e) { heroi(fx, 'serra', 0.25, { x: e.x, y: e.y, ang: e.ang }); },
  barbatana(fx, e) { heroi(fx, 'rastroAsa', 0.3, { ...e, agua: true }); gotas(fx, e.x1, e.y1 - 4, 8, 130); },
  emergeTubarao(fx, e) { gotas(fx, e.l.x, e.l.y - 4, 18, 200); fx.anillo(e.l.x, e.l.y, 4, 50, '#1e3a8a', 0.35, 3); },
});

Object.assign(HEROES_NOVOS, {
  mandAco(g, h, k) { const fe = Math.min(1, k * 2.5); g.globalAlpha = 1 - k * k; mandibulaDesenho(g, h.x, h.y, h.ang, 22, 1 - fe, '#334155'); if (h.dupla) mandibulaDesenho(g, h.x - Math.cos(h.ang) * 10, h.y - 10, h.ang, 18, 1 - fe, '#1f2937'); g.globalAlpha = 1; },
  giroAco(g, h, k) {
    const l = h.l, n = h.mega ? 3 : 2;
    g.globalAlpha = 1 - k;
    for (let i = 0; i < n; i++) { const a = k * 6.28 * (h.mega ? 2 : 1.2) + (i / n) * 6.28, x = l.x + Math.cos(a) * h.r * 0.8, y = l.y + Math.sin(a) * h.r * 0.5 - 8; mandibulaDesenho(g, x, y, a + 1.57, 12, 0.3, '#475569'); }
    g.strokeStyle = '#cbd5e1'; g.lineWidth = 2; g.beginPath(); g.ellipse(px(l.x), px(l.y), h.r * (0.6 + k * 0.4), h.r * 0.62 * (0.6 + k * 0.4), 0, k * 6, k * 6 + 3.5); g.stroke();
    g.globalAlpha = 1;
  },
  mordidaG(g, h, k) {
    const fe = Math.min(1, k * 2.2), R = h.R * 0.55, x = h.x + Math.cos(h.ang) * h.R * 0.55, y = h.y + Math.sin(h.ang) * h.R * 0.38 - 14;
    g.globalAlpha = 1 - k * k;
    mandibulaDesenho(g, x - Math.cos(h.ang) * R * 0.5, y, h.ang + (h.cruz ? 0.8 : 0), R, (1 - fe) * 0.9, h.tubarao ? '#1e3a8a' : '#334155');
    if (h.cruz) mandibulaDesenho(g, x - Math.cos(h.ang) * R * 0.5, y, h.ang - 0.8, R, (1 - fe) * 0.9, '#334155');
    if (fe >= 1) for (let i = -2; i <= 2; i++) PX.lineaPix(g, x + i * 6, y - 12, x + i * 6 + 4, y + 12, '#f8fafc', 1);
    g.globalAlpha = 1;
  },
  rastroAsa(g, h, k) { g.globalAlpha = 1 - k; const a = Math.atan2(h.y1 - h.y0, h.x1 - h.x0); for (const s of [-1, 1]) { const ox = Math.cos(a + 1.57) * s * 7, oy = Math.sin(a + 1.57) * s * 4; PX.lineaPix(g, h.x0 + ox, h.y0 + oy - 10, h.x1 + ox, h.y1 + oy - 10, h.agua ? '#60a5fa' : '#cbd5e1', 2); } PX.lineaPix(g, h.x0, h.y0 - 10, h.x1, h.y1 - 10, h.agua ? '#1e3a8a' : '#7f1d1d', 1); g.globalAlpha = 1; },
  plumagem(g, h, k) {
    const l = h.l, n = h.mega ? 14 : 6, abre = h.mega ? 6.28 : 1.8, al = Math.min(1, (1 - k) * 4);
    g.globalAlpha = al;
    for (let i = 0; i < n; i++) { const a = h.ang - abre / 2 + (i + 0.5) / n * abre + Math.sin(k * 20 + i) * 0.04, x = l.x + Math.cos(a) * 22, y = l.y + Math.sin(a) * 14 - 12; g.save(); g.translate(px(x), px(y)); g.rotate(a); poli(g, [[-2, -6], [3, -2], [3, 2], [-2, 6], [-1, 0]], i % 2 ? '#cbd5e1' : '#94a3b8'); g.restore(); }
    g.globalAlpha = 1;
  },
  sombraAlvo(g, h, k) { g.globalAlpha = 0.25 + k * 0.35; g.fillStyle = '#0b0a14'; g.beginPath(); g.ellipse(px(h.x), px(h.y), h.r * k, h.r * 0.62 * k, 0, 0, 7); g.fill(); g.globalAlpha = 1; PX.anilloPix(g, px(h.x), px(h.y), px(h.r), px(h.r * 0.62), '#e2e8f0', 1, 12, k * 4); },
  bolhaG(g, h, k) { const r = 10 + k * 34; g.globalAlpha = 1 - k * 0.5; g.strokeStyle = '#bfe9ff'; g.lineWidth = 2; g.beginPath(); g.arc(px(h.x), px(h.y - 20 - (1 - k) * 40), r, 0, 7); g.stroke(); g.fillStyle = '#3b82f6'; g.globalAlpha *= 0.35; g.fill(); g.globalAlpha = 1; },
  serra(g, h, k) { g.globalAlpha = 1 - k; g.save(); g.translate(px(h.x), px(h.y)); g.rotate(h.ang + 0.6); for (let i = -3; i <= 3; i++) poli(g, [[i * 4, -2], [i * 4 + 2, -6 - (i % 2) * 2], [i * 4 + 4, -2]], '#f8fafc'); PX.lineaPix(g, -14, 0, 16, 0, '#b91c1c', 2); g.restore(); g.globalAlpha = 1; },
});

Object.assign(ENTIDADES_NOVAS, {
  penasChao(g, e) { const al = Math.min(1, (e.dur - e.t) * 2), n = Math.max(3, Math.round(Math.hypot(e.x1 - e.x0, e.y1 - e.y0) / 12)); g.globalAlpha = al; for (let i = 0; i <= n; i++) { const f = i / n, x = e.x0 + (e.x1 - e.x0) * f, y = e.y0 + (e.y1 - e.y0) * f + ((i * 7) % 5) - 2; g.save(); g.translate(px(x), px(y)); g.rotate(i * 1.7); poli(g, [[-4, 0], [0, -2], [5, 0], [0, 2]], i % 3 ? '#94a3b8' : '#7f1d1d'); g.restore(); } g.globalAlpha = 1; },
  furacaoAco(g, e, t) {
    const al = Math.min(1, (e.dur - e.t) * 2, e.t * 4), R = e.radio;
    g.globalAlpha = al * 0.25; g.fillStyle = '#475569'; g.beginPath(); g.ellipse(px(e.x), px(e.y), R, R * 0.62, 0, 0, 7); g.fill(); g.globalAlpha = al;
    for (let i = 0; i < 18; i++) { const r = R * (0.25 + (i % 6) / 7), a = t * (6 - r / R * 3) + i * 2.1, x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r * 0.62 - 6 - (i % 4) * 8; g.save(); g.translate(px(x), px(y)); g.rotate(a + 1.57); poli(g, [[-5, 0], [0, -2], [5, 0], [0, 2]], i % 3 ? '#cbd5e1' : '#7f1d1d'); g.restore(); }
    g.globalAlpha = 1;
  },
  jatoTatsu(g, e) { g.save(); g.translate(px(e.x), px(e.y - 10)); g.rotate(e.ang); poli(g, [[-7, -2], [4, -3], [7, 0], [4, 3], [-7, 2]], '#3b82f6', '#1e3a8a'); PX.lineaPix(g, -4, -1, 4, -1, '#bfe9ff', 1); g.restore(); },
  bolhaTatsu(g, e, t) { const r = 5 + Math.sin(t * 12) * 0.6; g.strokeStyle = '#bfe9ff'; g.lineWidth = 1.5; g.beginPath(); g.arc(px(e.x), px(e.y - 12), r, 0, 7); g.stroke(); g.fillStyle = '#3b82f6'; g.globalAlpha = 0.5; g.fill(); g.globalAlpha = 1; PX.disco(g, px(e.x - 2), px(e.y - 14), 1, '#ffffff'); },
  torretaTatsu(g, e, t) {
    const l = e.dueno, al = Math.min(1, e.t * 5, (e.dur - e.t) * 4), r = e.mega ? 22 : 16;
    g.globalAlpha = al;
    PX.anilloPix(g, px(l.x), px(l.y), r + 4, px((r + 4) * 0.62), '#1e3a8a', 2, 10, t * 2);
    for (const s of e.mega ? [-1, 1] : [0]) { const x = l.x + s * 16, y = l.y - 4; poli(g, [[x - 7, y + 3], [x - 5, y - 10], [x + 5, y - 10], [x + 7, y + 3]], '#2563eb', '#1e3a8a'); PX.lineaPix(g, x, y - 10, x, y - 16 - Math.sin(t * 20) * 2, '#bfe9ff', 2); }
    g.globalAlpha = 1;
  },
  tubaraoSub(g, e, t) {
    const l = e.dueno; if (!l?.est?.vuelo) return;
    const a = Math.atan2(l.vy ?? 0, l.vx ?? 1), x = l.x, y = l.y;
    g.globalAlpha = 0.55; g.fillStyle = '#0b1e3f'; g.beginPath(); g.ellipse(px(x), px(y), 16, 6, a, 0, 7); g.fill(); g.globalAlpha = 1;
    g.save(); g.translate(px(x), px(y - 2)); poli(g, [[-4, 0], [2, -10], [5, 0]], '#1e3a8a'); g.restore();
    if (Math.floor(t * 10) % 2) PX.disco(g, px(x - Math.cos(a) * 14), px(y), 1.2, '#93c5fd');
  },
  rastroAgua(g, e, t) { const al = Math.min(1, (e.dur - e.t) * 2, e.t * 6), n = Math.max(2, Math.round(Math.hypot(e.x1 - e.x0, e.y1 - e.y0) / 14)); for (let i = 0; i <= n; i++) { const f = i / n, x = e.x0 + (e.x1 - e.x0) * f, y = e.y0 + (e.y1 - e.y0) * f; g.globalAlpha = al * 0.6; g.fillStyle = '#2563eb'; g.beginPath(); g.ellipse(px(x), px(y), 11, 6, 0, 0, 7); g.fill(); g.globalAlpha = al; PX.lineaPix(g, x - 5, y - 1 + Math.sin(t * 6 + i), x + 3, y - 1 + Math.sin(t * 6 + i), '#bfe9ff', 1); } g.globalAlpha = 1; },
  sangra() {},
});
