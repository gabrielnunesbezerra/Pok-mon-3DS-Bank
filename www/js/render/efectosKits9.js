// Desenhos do pulo negro e do corte triplo do Absol e do Gyro Ball, bola de neve, escudo glacial, Blizzard e gelo
// do Glalie (engine/formasKits9.js). Formas sólidas com contorno e partículas, sem brilho em volta.
import * as PX from './pixelfx.js';
import { EVENTOS_NOVOS, HEROES_NOVOS, ENTIDADES_NOVAS } from './efectosNovos.js';
import { heroi, poli, faiscas, rachas, choque, cacos, entre, ale, px } from './efectosKits4.js';

const GELO = ['#e0f2fe', '#bae6fd', '#7dd3fc', '#ffffff'], SOMBRA = ['#1f1b2e', '#4c1d95', '#a78bfa', '#e2e8f0'];
const neve = (fx, x, y, n = 10, v = 140) => { for (let i = 0; i < n; i++) { const a = ale() * 6.28, s = entre(v * 0.3, v); fx.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5 - 40, g: 60, drag: 2, size: entre(1.4, 2.8), life: entre(0.5, 0.9), color: GELO[i % 4], forma: 'sq', vr: entre(-8, 8) }); } };
const lamina = (g, x0, y0, x1, y1, w) => { PX.lineaPix(g, x0, y0, x1, y1, '#1f1b2e', w + 2); PX.lineaPix(g, x0, y0, x1, y1, '#7c3aed', w); PX.lineaPix(g, x0, y0 - 1, x1, y1 - 1, '#ffffff', 1); };

Object.assign(EVENTOS_NOVOS, {
  puloNegro(fx, e) { heroi(fx, 'rastroNegro', e.dur + 0.2, { ...e }); faiscas(fx, e.x0, e.y0 - 6, SOMBRA, 8, 140); },
  caiNegro(fx, e) { faiscas(fx, e.x, e.y - 8, SOMBRA, 16, 220); choque(fx, e.x, e.y, e.r, '#a78bfa'); rachas(fx, e.x, e.y, e.r * 0.8, '#1f1b2e'); },
  corteRoda(fx, e) { heroi(fx, 'corteRoda', 0.35, { l: e.l, r: e.r }); faiscas(fx, e.l.x, e.l.y - 12, SOMBRA, 20, 260); },
  corteLinha(fx, e) { heroi(fx, 'corteLinha', 0.7, { ...e }); },
  gyroBall(fx, e) { heroi(fx, 'gyro', e.dur, { l: e.l }); },
  quebraGelo(fx, e) { cacos(fx, e.x, e.y - 12, GELO, 26, 300); faiscas(fx, e.x, e.y - 12, ['#ffffff', '#e0f2fe'], 16, 280); choque(fx, e.x, e.y, 36, '#e0f2fe'); },
  congelaK9(fx, e) { heroi(fx, 'blocoGeloK9', e.dur, { l: e.l }); neve(fx, e.l.x, e.l.y - 12, 10, 120); },
  explodeNeve(fx, e) { neve(fx, e.x, e.y - 10, 30, 260); cacos(fx, e.x, e.y - 8, GELO, 18, 240); choque(fx, e.x, e.y, e.r, '#e0f2fe'); rachas(fx, e.x, e.y, e.r * 0.7, '#0c4a6e'); },
  trincaGelo(fx, e) { cacos(fx, e.l.x, e.l.y - 14, GELO, 4 + e.k * 2, 120); },
  explodeNevasca(fx, e) { neve(fx, e.x, e.y - 10, 70, 360); cacos(fx, e.x, e.y - 10, GELO, 34, 340); faiscas(fx, e.x, e.y - 12, ['#ffffff', '#e0f2fe', '#7dd3fc'], 24, 320); choque(fx, e.x, e.y, e.r, '#bae6fd'); choque(fx, e.x, e.y, e.r * 1.2, '#ffffff'); choque(fx, e.x, e.y, e.r * 0.55, '#38bdf8'); rachas(fx, e.x, e.y, e.r * 0.9, '#0c4a6e'); heroi(fx, 'espetosGelo', 1.4, { x: e.x, y: e.y, r: e.r * 0.85, s: ale() * 9 }); heroi(fx, 'espetosGelo', 1.2, { x: e.x, y: e.y, r: e.r * 0.45, s: ale() * 9 }); }
});
Object.assign(HEROES_NOVOS, {
  rastroNegro(g, h, k) { const f = Math.min(1, k * 1.3), al = 1 - Math.max(0, (k - 0.6) / 0.4); g.globalAlpha = al; for (let i = 0; i < 10; i++) { const q = (i / 10) * f, x = h.x0 + (h.x1 - h.x0) * q, y = h.y0 + (h.y1 - h.y0) * q - Math.sin(q * Math.PI) * 30 - 10; PX.disco(g, px(x), px(y), 3.4 - i * 0.2, SOMBRA[i % 3]); } g.globalAlpha = 1; },
  corteRoda(g, h, k) { const l = h.l; g.globalAlpha = 1 - k; for (let j = 0; j < 3; j++) { const r = h.r * (0.6 + j * 0.2), a0 = k * 9 + j * 2; g.strokeStyle = ['#1f1b2e', '#7c3aed', '#e2e8f0'][j]; g.lineWidth = 4 - j; g.beginPath(); g.ellipse(px(l.x), px(l.y - 8), r, r * 0.62, 0, a0, a0 + 4.2); g.stroke(); } g.globalAlpha = 1; },
  corteLinha(g, h, k) { const f = Math.min(1, k * 2.4), al = 1 - Math.max(0, (k - 0.55) / 0.45), x1 = h.x0 + (h.x1 - h.x0) * f, y1 = h.y0 + (h.y1 - h.y0) * f; g.globalAlpha = al; lamina(g, h.x0, h.y0, x1, y1, 3); const n = Math.floor(f * 8); for (let i = 1; i <= n; i++) { const q = i / 8, x = h.x0 + (h.x1 - h.x0) * q, y = h.y0 + (h.y1 - h.y0) * q; poli(g, [[x - 4, y], [x, y - 14 - (i % 2) * 6], [x + 4, y]], i % 2 ? '#7c3aed' : '#4c1d95', '#1f1b2e'); } g.globalAlpha = 1; },
  gyro(g, h, k, t) { const l = h.l; if (l.ko) return; g.globalAlpha = 0.85; for (let i = 0; i < 3; i++) { const a = t * 20 + i * 2.1; g.strokeStyle = GELO[i]; g.lineWidth = 2; g.beginPath(); g.ellipse(px(l.x), px(l.y - 12), 22, 14, 0, a, a + 2.4); g.stroke(); } g.globalAlpha = 1; },
  blocoGeloK9(g, h, k, t) { const l = h.l; if (l.ko || !l.est.congelado) return; const W = l.est.totem ? 30 : 22, H = l.alto + (l.est.totem ? 16 : 6), x = l.x, y = l.y; g.globalAlpha = 0.55; g.fillStyle = '#bae6fd'; g.fillRect(px(x - W / 2), px(y - H), W, H); g.globalAlpha = 1; g.strokeStyle = '#0c4a6e'; g.lineWidth = 1; g.strokeRect(px(x - W / 2) + 0.5, px(y - H) + 0.5, W, H); PX.lineaPix(g, x - W / 2 + 3, y - H + 3, x - W / 2 + 3, y - 4, '#ffffff', 1); if (l.est.totem) for (let i = -1; i <= 1; i++) poli(g, [[x + i * 9 - 4, y - H], [x + i * 9, y - H - 10], [x + i * 9 + 4, y - H]], '#e0f2fe', '#0c4a6e'); },
});
Object.assign(ENTIDADES_NOVAS, {
  bolaNeve(g, e, t, fx) {
    const r = e.r, x = e.x, y = e.y - r - 2, a = e.t * 9;
    g.globalAlpha = 0.35; g.fillStyle = '#0b0a14'; g.beginPath(); g.ellipse(px(e.x), px(e.y), r, r * 0.4, 0, 0, 7); g.fill(); g.globalAlpha = 1;
    PX.disco(g, px(x), px(y), r, '#e0f2fe'); PX.disco(g, px(x - r * 0.25), px(y - r * 0.25), r * 0.55, '#ffffff');
    g.strokeStyle = '#7dd3fc'; g.lineWidth = 1; g.beginPath(); g.arc(px(x), px(y), r, 0, 7); g.stroke();
    for (let i = 0; i < 7; i++) { const b = a + i * 0.9, cx = x + Math.cos(b) * r, cy = y + Math.sin(b) * r; poli(g, [[cx - Math.sin(b) * 3, cy + Math.cos(b) * 3], [x + Math.cos(b) * (r + 7), y + Math.sin(b) * (r + 7)], [cx + Math.sin(b) * 3, cy - Math.cos(b) * 3]], '#7dd3fc', '#0c4a6e'); }
    if (fx && ale() < 0.7) fx.add({ x: e.x + entre(-r, r), y: e.y, vx: entre(-40, 40), vy: -entre(30, 80), g: 200, size: entre(1.4, 2.4), life: 0.4, color: GELO[Math.floor(ale() * 4)], forma: 'sq' });
  },
  neveChao(g, e) { const al = Math.min(1, (e.dur - e.t) * 1.5); g.globalAlpha = al * 0.75; g.fillStyle = '#f1f5f9'; g.beginPath(); g.ellipse(px(e.x), px(e.y), e.radio, e.radio * 0.5, 0, 0, 7); g.fill(); g.fillStyle = '#e0f2fe'; g.beginPath(); g.ellipse(px(e.x + 3), px(e.y - 1), e.radio * 0.6, e.radio * 0.28, 0, 0, 7); g.fill(); g.globalAlpha = 1; },
  nevasca(g, e, t, fx) {
    const R = e.radio, k = Math.min(1, e.t / e.dur), x = e.x, y = e.y;
    // chão branqueando e o anel que fecha até a explosão
    g.globalAlpha = 0.18 + k * 0.32; g.fillStyle = '#e0f2fe'; g.beginPath(); g.ellipse(px(x), px(y), R, R * 0.62, 0, 0, 7); g.fill();
    g.globalAlpha = 1; PX.anilloPix(g, px(x), px(y), px(R), px(R * 0.62), '#ffffff', 2, 20, t * 3); PX.anilloPix(g, px(x), px(y), px(R * (1 - k) + 6), px((R * (1 - k) + 6) * 0.62), '#38bdf8', 2, 0, 0);
    // cristais crescendo na borda
    for (let i = 0; i < 14; i++) { const a = i * 0.449 + 0.2, cx = x + Math.cos(a) * R * 0.92, cy = y + Math.sin(a) * R * 0.57, H = (6 + (i % 3) * 4) * (0.3 + k * 0.7); poli(g, [[cx - 3, cy], [cx, cy - H], [cx + 3, cy]], i % 2 ? '#bae6fd' : '#e0f2fe', '#0c4a6e'); }
    // redemoinho de vento e neve em três alturas
    for (let j = 0; j < 3; j++) { g.globalAlpha = 0.55; g.strokeStyle = GELO[j]; g.lineWidth = 2; g.beginPath(); g.ellipse(px(x), px(y - 8 - j * 14), R * (0.85 - j * 0.2), R * 0.32 * (0.85 - j * 0.2), 0, t * (4 + j) + j, t * (4 + j) + j + 3.6); g.stroke(); }
    g.globalAlpha = 1;
    for (let i = 0; i < 30; i++) { const a = t * (3 + (i % 3)) + i * 0.21, rr = R * (0.15 + (i % 7) * 0.12), px1 = x + Math.cos(a) * rr, py1 = y + Math.sin(a) * rr * 0.62 - 8 - (i % 4) * 9; PX.lineaPix(g, px1, py1, px1 - Math.sin(a) * 7, py1 + Math.cos(a) * 3, GELO[i % 4], i % 5 ? 1 : 2); }
    if (fx) for (let i = 0; i < 4; i++) { const a = ale() * 6.28; fx.add({ x: x + Math.cos(a) * R, y: y + Math.sin(a) * R * 0.62 - 10, vx: -Math.sin(a) * 180 - Math.cos(a) * 40, vy: Math.cos(a) * 70 - 20, g: 0, drag: 0.5, size: entre(1.4, 3), life: 0.6, color: GELO[i], forma: 'sq', vr: entre(-8, 8) }); }
  },
});
