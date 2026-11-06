// Desenhos dos kits de Glalie, Gardevoir e Absol (engine/formasKits7.js): formas sólidas com contorno, partículas
// densas, ondas de choque e rachaduras, sem brilho em volta.
import * as PX from './pixelfx.js';
import { EVENTOS_NOVOS, HEROES_NOVOS, ENTIDADES_NOVAS } from './efectosNovos.js';
import { heroi, poli, faiscas, rachas, choque, cacos, mandibulaDesenho, entre, ale, px } from './efectosKits4.js';

const GELO = ['#e0f2fe', '#bae6fd', '#7dd3fc', '#ffffff'], PSI = ['#f9a8d4', '#c084fc', '#fbcfe8', '#ffffff'], SOMBRA = ['#1f1b2e', '#4c1d95', '#a78bfa', '#e2e8f0'];
const cristal = (g, x, y, a, L, W, cor = '#bae6fd') => { g.save(); g.translate(px(x), px(y)); g.rotate(a); poli(g, [[-L * 0.4, 0], [0, -W], [L, 0], [0, W]], cor, '#0c4a6e'); PX.lineaPix(g, -L * 0.2, -1, L * 0.6, -1, '#ffffff', 1); g.restore(); };
const neve = (fx, x, y, n = 10, v = 140) => { for (let i = 0; i < n; i++) { const a = ale() * 6.28, s = entre(v * 0.3, v); fx.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5 - 40, g: 60, drag: 2, size: entre(1.4, 2.6), life: entre(0.5, 0.9), color: GELO[i % 4], forma: 'sq', vr: entre(-8, 8) }); } };
function estrela(g, x, y, r, cor) { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; p.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } poli(g, p, cor, '#831843'); }

Object.assign(EVENTOS_NOVOS, {
  // Glalie
  cometaGelo(fx, e) { heroi(fx, 'cometa', e.dur, { ...e }); },
  impactoGelo(fx, e) { cacos(fx, e.x, e.y - 6, GELO, 18, 260); neve(fx, e.x, e.y - 8, 16, 200); choque(fx, e.x, e.y, e.r, '#bae6fd'); rachas(fx, e.x, e.y, e.r * 0.8, '#0c4a6e'); heroi(fx, 'espetosGelo', 1, { x: e.x, y: e.y, r: e.r, s: ale() * 9 }); },
  escudoGelo(fx, e) { heroi(fx, 'cascaGelo', 3, { l: e.l }); neve(fx, e.l.x, e.l.y - 12, 14, 160); },
  abismo(fx, e) { heroi(fx, 'abismo', e.dur + 0.2, { l: e.l, ang: e.ang, R: e.R, abre: e.abre }); },
  estilhaco(fx, e) { cacos(fx, e.x, e.y - 10, GELO, 30, 320); faiscas(fx, e.x, e.y - 10, GELO, 20, 300); neve(fx, e.x, e.y - 10, 24, 240); choque(fx, e.x, e.y, e.r * 1.3, '#e0f2fe'); rachas(fx, e.x, e.y, e.r, '#0c4a6e'); fx.debris?.(e.x, e.y, 'ICE', 10); },
  // Gardevoir
  auraVeloz(fx, e) { heroi(fx, 'anelSobe', 0.5, { l: e.l, cor: '#f9a8d4' }); for (let i = 0; i < 8; i++) fx.add({ x: e.l.x + entre(-10, 10), y: e.l.y, vx: 0, vy: -entre(60, 120), g: 0, size: 2, life: 0.5, color: PSI[i % 4], forma: 'chispa' }); },
  valsa(fx, e) { heroi(fx, 'valsa', 0.8, { l: e.l }); },
  distorcao(fx, e) { heroi(fx, 'distorce', e.dur, { x: e.x, y: e.y, r: e.r }); },
  distorcaoFim(fx, e) { faiscas(fx, e.x, e.y - 10, PSI, 16, 220); choque(fx, e.x, e.y, e.r, '#c084fc'); heroi(fx, 'correntes', 1, { x: e.x, y: e.y, r: e.r }); },
  explodeBuraco(fx, e) { faiscas(fx, e.x, e.y - 12, ['#1f1b2e', '#7c3aed', '#c084fc', '#ffffff'], e.mega ? 40 : 24, 340); choque(fx, e.x, e.y, e.r * 1.4, '#c084fc'); choque(fx, e.x, e.y, e.r, '#f9a8d4'); rachas(fx, e.x, e.y, e.r, '#2e1065'); cacos(fx, e.x, e.y, ['#4c1d95', '#1f1b2e'], 16, 260); },
  estrelaFim(fx, e) { faiscas(fx, e.x, e.y - 12, PSI, 8, 160); },
  // Absol
  critico(fx, e) { heroi(fx, 'critico', 0.35, { x: e.x, y: e.y }); faiscas(fx, e.x, e.y, ['#ef4444', '#ffffff'], 10, 240); },
  pressagio(fx, e) { heroi(fx, 'olhoPressagio', e.dur, { l: e.l, mega: e.mega }); },
  presagioOk(fx, e) { faiscas(fx, e.l.x, e.l.y - 14, SOMBRA, 16, 220); choque(fx, e.l.x, e.l.y, 40, '#a78bfa'); },
  corteRuina(fx, e) { heroi(fx, 'rastroRuina', 0.4, { pts: [{ x: e.x0, y: e.y0 }, { x: e.x1, y: e.y1 }] }); faiscas(fx, e.x1, e.y1 - 12, SOMBRA, 16, 260); },
  zigueZague(fx, e) { heroi(fx, 'rastroRuina', e.passo * e.pts.length + 0.4, { pts: e.pts, passo: e.passo }); },
  impactoRuina(fx, e) { faiscas(fx, e.x, e.y - 10, SOMBRA, 34, 340); choque(fx, e.x, e.y, e.r, '#a78bfa'); choque(fx, e.x, e.y, e.r * 0.6, '#e2e8f0'); rachas(fx, e.x, e.y, e.r * 0.9, '#1f1b2e'); cacos(fx, e.x, e.y, ['#4c1d95', '#1f1b2e', '#94a3b8'], 18, 280); fx.debris?.(e.x, e.y, 'ROCK', 10); },
});

Object.assign(HEROES_NOVOS, {
  cometa(g, h, k) {
    const x = h.x0 + (h.x - h.x0) * k, y = h.y0 + (h.y - h.y0) * k - Math.sin(k * Math.PI) * 90 - 10, r = 10 + k * 6;
    g.globalAlpha = 0.3 + k * 0.4; g.fillStyle = '#0b0a14'; g.beginPath(); g.ellipse(px(h.x), px(h.y), h.r * k, h.r * 0.62 * k, 0, 0, 7); g.fill(); g.globalAlpha = 1;
    PX.anilloPix(g, px(h.x), px(h.y), px(h.r), px(h.r * 0.62), '#bae6fd', 1, 12, k * 5);
    for (let i = 1; i <= 4; i++) PX.disco(g, px(x - (h.x - h.x0) * 0.04 * i), px(y + i * 4), r * (0.5 - i * 0.08), GELO[i % 4]);
    for (let i = 0; i < 6; i++) cristal(g, x + Math.cos(i + k * 8) * r * 0.5, y + Math.sin(i + k * 8) * r * 0.5, i * 1.05 + k * 6, r, r * 0.45, i % 2 ? '#bae6fd' : '#e0f2fe');
  },
  espetosGelo(g, h, k) { const al = Math.min(1, (1 - k) * 3), sob = Math.min(1, k * 8); g.globalAlpha = al; for (let i = 0; i < 9; i++) { const a = i * 0.7 + h.s, rr = h.r * (0.2 + ((i * 37) % 10) / 14), x = h.x + Math.cos(a) * rr, y = h.y + Math.sin(a) * rr * 0.62, L = (8 + (i % 3) * 4) * sob; poli(g, [[x - 3, y], [x + (i % 2 ? 1 : -1), y - L], [x + 3, y]], i % 2 ? '#bae6fd' : '#e0f2fe', '#0c4a6e'); } g.globalAlpha = 1; },
  cascaGelo(g, h, k) { const l = h.l; if (l.ko || !l.est.escudo) return; g.globalAlpha = 0.85; for (let i = 0; i < 8; i++) { const a = i * 0.785 + k * 2, x = l.x + Math.cos(a) * 18, y = l.y - 12 + Math.sin(a) * 12; cristal(g, x, y, a, 7, 3, i % 2 ? '#bae6fd' : '#e0f2fe'); } g.globalAlpha = 1; },
  abismo(g, h, k, t) {
    const l = h.l, abre = Math.min(1, k * 3), x = l.x + Math.cos(h.ang) * 22, y = l.y + Math.sin(h.ang) * 14 - 14;
    g.globalAlpha = 0.25; g.fillStyle = '#0c4a6e'; g.beginPath(); g.moveTo(px(l.x), px(l.y)); g.arc(px(l.x), px(l.y), h.R, h.ang - h.abre / 2, h.ang + h.abre / 2); g.closePath(); g.fill();
    g.globalAlpha = 1;
    for (let i = 0; i < 14; i++) { const f = ((t * 2.5 + i / 14) % 1), a = h.ang + (((i * 53) % 10) / 10 - 0.5) * h.abre, rr = h.R * (1 - f); PX.lineaPix(g, l.x + Math.cos(a) * rr, l.y + Math.sin(a) * rr * 0.62 - 10, l.x + Math.cos(a) * (rr - 12), l.y + Math.sin(a) * (rr - 12) * 0.62 - 10, GELO[i % 4], 1); }
    mandibulaDesenho(g, x, y, h.ang, 34, abre * 0.9, '#7dd3fc', '#ffffff');
  },
  anelSobe(g, h, k) { const l = h.l; g.globalAlpha = 1 - k; g.strokeStyle = h.cor; g.lineWidth = 2; g.beginPath(); g.ellipse(px(l.x), px(l.y - k * 30), 14 + k * 6, (14 + k * 6) * 0.4, 0, 0, 7); g.stroke(); g.globalAlpha = 1; },
  valsa(g, h, k) { const l = h.l; g.globalAlpha = 1 - k; for (let i = 0; i < 6; i++) { const a = i * 1.047 + k * 6, x = l.x + Math.cos(a) * 20, y = l.y - 12 + Math.sin(a) * 9; PX.disco(g, px(x), px(y), 2.4, PSI[i % 4]); } g.strokeStyle = '#c084fc'; g.lineWidth = 2; g.beginPath(); g.ellipse(px(l.x), px(l.y - 12), 20, 9, 0, 0, 7); g.stroke(); g.globalAlpha = 1; },
  distorce(g, h, k, t) { g.globalAlpha = 0.4 + k * 0.4; for (let j = 0; j < 3; j++) { const r = h.r * (1 - ((k + j / 3) % 1)); g.strokeStyle = PSI[j]; g.lineWidth = 2; g.beginPath(); g.ellipse(px(h.x), px(h.y), r, r * 0.62, t * 2, 0, 5); g.stroke(); } g.globalAlpha = 1; },
  correntes(g, h, k) { g.globalAlpha = 1 - k; for (let i = 0; i < 6; i++) { const a = i * 1.047, x0 = h.x + Math.cos(a) * h.r, y0 = h.y + Math.sin(a) * h.r * 0.62; for (let j = 0; j < 4; j++) { const f = j / 4; PX.anilloPix(g, px(x0 + (h.x - x0) * f), px(y0 + (h.y - y0) * f - 4), 3, 2, '#c084fc', 1); } } g.globalAlpha = 1; },
  critico(g, h, k) { g.globalAlpha = 1 - k; g.save(); g.translate(px(h.x), px(h.y)); for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 4); PX.lineaPix(g, -6 - k * 12, 0, 6 + k * 12, 0, i % 2 ? '#ef4444' : '#ffffff', 2); } g.restore(); g.globalAlpha = 1; },
  olhoPressagio(g, h, k, t) { const l = h.l; if (l.ko) return; const x = l.x, y = l.y - l.alto - 12, ab = Math.min(1, k * 6); g.globalAlpha = Math.min(1, (1 - k) * 4); poli(g, [[x - 10, y], [x, y - 5 * ab], [x + 10, y], [x, y + 5 * ab]], '#e2e8f0', '#1f1b2e'); PX.disco(g, px(x), px(y), 2.5 * ab, '#7c3aed'); g.strokeStyle = h.mega ? '#a78bfa' : '#4c1d95'; g.lineWidth = 2; g.beginPath(); g.ellipse(px(l.x), px(l.y - 12), 22, 14, 0, t * 4, t * 4 + 4.5); g.stroke(); g.globalAlpha = 1; },
  rastroRuina(g, h, k) {
    const n = h.pts.length - 1, fe = h.passo ? Math.min(n, (k * (h.passo * (n + 1) + 0.4)) / h.passo) : n, al = 1 - Math.max(0, (k - 0.7) / 0.3);
    g.globalAlpha = al;
    for (let i = 0; i < Math.min(n, Math.ceil(fe)); i++) { const A = h.pts[i], B = h.pts[i + 1], f = Math.min(1, fe - i), bx = A.x + (B.x - A.x) * f, by = A.y + (B.y - A.y) * f; PX.lineaPix(g, A.x, A.y - 12, bx, by - 12, '#1f1b2e', 5); PX.lineaPix(g, A.x, A.y - 12, bx, by - 12, '#a78bfa', 3); PX.lineaPix(g, A.x, A.y - 13, bx, by - 13, '#ffffff', 1); }
    g.globalAlpha = 1;
  },
});

Object.assign(ENTIDADES_NOVAS, {
  estalactite(g, e) { cristal(g, e.x, e.y - 12, e.ang, 9, 3); },
  chaoGelo(g, e, t, fx) {
    const al = Math.min(1, (e.dur - e.t) * 2, e.t * 5), R = e.radio;
    g.globalAlpha = al * 0.5; g.fillStyle = '#7dd3fc'; g.beginPath(); g.ellipse(px(e.x), px(e.y), R, R * 0.62, 0, 0, 7); g.fill();
    g.globalAlpha = al; PX.anilloPix(g, px(e.x), px(e.y), px(R), px(R * 0.62), '#e0f2fe', 1, 0, 0);
    for (let i = 0; i < 10; i++) { const a = i * 0.63, rr = R * (0.3 + (i % 4) * 0.18), x = e.x + Math.cos(a) * rr, y = e.y + Math.sin(a) * rr * 0.62; poli(g, [[x - 3, y], [x, y - 7 - (i % 3) * 2], [x + 3, y]], i % 2 ? '#bae6fd' : '#e0f2fe', '#0c4a6e'); }
    if (fx && ale() < 0.3) fx.add({ x: e.x + entre(-R, R) * 0.7, y: e.y + entre(-R, R) * 0.4, vx: 0, vy: -20, g: 0, size: 1.6, life: 0.6, color: '#ffffff', forma: 'sq' });
    g.globalAlpha = 1;
  },
  santuario(g, e, t, fx) {
    const al = Math.min(1, (e.dur - e.t) * 2, e.t * 4), R = e.radio;
    g.globalAlpha = al * 0.22; g.fillStyle = e.mega ? '#f472b6' : '#c084fc'; g.beginPath(); g.ellipse(px(e.x), px(e.y), R, R * 0.62, 0, 0, 7); g.fill();
    g.globalAlpha = al; PX.anilloPix(g, px(e.x), px(e.y), px(R), px(R * 0.62), '#fbcfe8', 2, 16, t * 2); PX.anilloPix(g, px(e.x), px(e.y), px(R * 0.7), px(R * 0.43), '#c084fc', 1, 10, -t * 3);
    for (let i = 0; i < 6; i++) { const a = t + i * 1.047; estrela(g, e.x + Math.cos(a) * R * 0.85, e.y + Math.sin(a) * R * 0.53 - 4, 3, '#fbcfe8'); }
    if (fx && ale() < 0.4) fx.add({ x: e.x + entre(-R, R) * 0.7, y: e.y + entre(-R, R) * 0.4, vx: 0, vy: -40, g: 0, size: 2, life: 0.7, color: PSI[Math.floor(ale() * 4)], forma: 'chispa' });
    g.globalAlpha = 1;
  },
  buracoNegro(g, e, t, fx) {
    const R = e.radio, k = Math.min(1, e.t * 3), cy = e.y - 18, r = (e.mega ? 18 : 12) * k;
    g.globalAlpha = 0.3 * k; g.fillStyle = '#2e1065'; g.beginPath(); g.ellipse(px(e.x), px(e.y), R, R * 0.62, 0, 0, 7); g.fill(); g.globalAlpha = 1;
    for (let j = 0; j < 3; j++) { g.strokeStyle = ['#7c3aed', '#c084fc', '#f9a8d4'][j]; g.lineWidth = 2; g.beginPath(); g.ellipse(px(e.x), px(cy), r * (1.8 + j * 0.6), r * (0.5 + j * 0.15), 0, t * (4 + j) , t * (4 + j) + 4); g.stroke(); }
    PX.disco(g, px(e.x), px(cy), r, '#0b0a14'); g.strokeStyle = '#a78bfa'; g.lineWidth = 1; g.beginPath(); g.arc(px(e.x), px(cy), r, 0, 7); g.stroke();
    if (fx) for (let i = 0; i < (e.mega ? 3 : 2); i++) { const a = ale() * 6.28, d = R * entre(0.8, 1.4); fx.add({ x: e.x + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.62, vx: -Math.cos(a) * d * 2.2, vy: -Math.sin(a) * d * 1.4, g: 0, size: entre(1.4, 2.4), life: 0.45, color: PSI[i % 4], forma: 'sq' }); }
  },
  estrelaPixie(g, e, t) { estrela(g, e.x, e.y - 12, 6 + Math.sin(t * 20) * 0.6, '#f9a8d4'); for (let i = 1; i <= 3; i++) PX.disco(g, px(e.x - Math.cos(e.ang) * i * 6), px(e.y - 12 - Math.sin(e.ang) * i * 5), 2.4 - i * 0.6, PSI[i]); },
  meiaLuaSombra(g, e) {
    const r = e.mega ? 22 : 15, x = e.x, y = e.y - 12;
    g.save(); g.translate(px(x), px(y)); g.rotate(e.ang);
    g.fillStyle = '#1f1b2e'; g.beginPath(); g.arc(0, 0, r + 2, -1.4, 1.4); g.arc(-r * 0.45, 0, r * 0.95, 1.2, -1.2, true); g.closePath(); g.fill();
    g.fillStyle = '#7c3aed'; g.beginPath(); g.arc(0, 0, r, -1.3, 1.3); g.arc(-r * 0.4, 0, r * 0.9, 1.15, -1.15, true); g.closePath(); g.fill();
    g.strokeStyle = '#e2e8f0'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, r, -1.2, 1.2); g.stroke();
    g.restore();
  },
});
