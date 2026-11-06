// Desenhos dos kits de Gigalith, Slowbro e Drampa, do Dragon Scale da Tatsugiri e da onda do Sharpedo
// (engine/formasKits8.js e formasKits4.js): formas sólidas com contorno e partículas, sem brilho em volta.
import * as PX from './pixelfx.js';
import { EVENTOS_NOVOS, HEROES_NOVOS, ENTIDADES_NOVAS } from './efectosNovos.js';
import { heroi, poli, faiscas, rachas, choque, gotas, cacos, entre, ale, px } from './efectosKits4.js';

const CRISTAL = ['#ef4444', '#f87171', '#fecaca', '#7f1d1d'], ROCHA = ['#a8a29e', '#78716c', '#57534e', '#d6d3d1'], PSI = ['#f9a8d4', '#ec4899', '#fbcfe8', '#ffffff'];
const DRACO = ['#7c3aed', '#2dd4bf', '#a78bfa', '#99f6e4'], OURO = ['#fde68a', '#facc15', '#fef3c7', '#ffffff'];
const cristal = (g, x, y, a, L, W, cor = '#ef4444', borda = '#450a0a') => { g.save(); g.translate(px(x), px(y)); g.rotate(a); poli(g, [[-L * 0.3, 0], [0, -W], [L, 0], [0, W]], cor, borda); PX.lineaPix(g, -L * 0.1, -1, L * 0.6, -1, '#fee2e2', 1); g.restore(); };
const espeto = (g, x, y, H, cor, borda) => poli(g, [[x - 4, y], [x - 1, y - H], [x + 1, y - H * 0.9], [x + 4, y]], cor, borda);
const pedrinhas = (fx, x, y, n = 10, v = 180) => { for (let i = 0; i < n; i++) { const a = ale() * 6.28, s = entre(v * 0.4, v); fx.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.4 - entre(80, 180), g: 480, size: entre(1.6, 3.2), life: entre(0.5, 0.8), color: ROCHA[i % 4], forma: 'sq', vr: entre(-10, 10) }); } };

Object.assign(EVENTOS_NOVOS, {
  tiroBloqueado(fx, e) { faiscas(fx, e.x, e.y - 8, ROCHA, 6, 140); },
  acertoLeque(fx, e) { const c = e.visual === 'estilhacoRocha' ? ROCHA : DRACO; faiscas(fx, e.x, e.y, c, 7, 170); if (e.visual !== 'estilhacoRocha') cacos(fx, e.x, e.y, ['#7c3aed', '#2dd4bf'], 4, 110); else pedrinhas(fx, e.x, e.y, 4, 110); },
  // Gigalith
  cargaCristal(fx, e) { heroi(fx, 'cristaisCarga', e.dur + 0.1, { l: e.l }); },
  sobePilar(fx, e) { for (const p of e.pts) { pedrinhas(fx, p.x, p.y, e.mega ? 4 : 8, 160); rachas(fx, p.x, p.y, 18, '#44403c'); } },
  cargaSismica(fx, e) { heroi(fx, 'cargaSismica', e.dur, { l: e.l, r: e.r }); },
  ondaSismica(fx, e) { pedrinhas(fx, e.x, e.y, 30, 300); faiscas(fx, e.x, e.y - 8, CRISTAL, 16, 260); choque(fx, e.x, e.y, e.r, '#d6d3d1'); choque(fx, e.x, e.y, e.r * 0.6, '#ef4444'); rachas(fx, e.x, e.y, e.r * 0.9, '#292524'); fx.debris?.(e.x, e.y, 'ROCK', 12); },
  explodeGeoda(fx, e) { faiscas(fx, e.x, e.y - 12, CRISTAL, 16, 240); cacos(fx, e.x, e.y - 10, CRISTAL, 10, 200); choque(fx, e.x, e.y, 30, '#ef4444'); },
  // Slowbro
  estouraSono(fx, e) { for (let i = 0; i < 10 + (e.r > 30 ? 16 : 0); i++) { const a = ale() * 6.28, s = entre(40, e.r * 3); fx.add({ x: e.x, y: e.y - 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5 - 20, g: -20, drag: 2, size: entre(1.6, 3), life: entre(0.5, 0.9), color: PSI[i % 4], forma: 'burbuja' }); } choque(fx, e.x, e.y, e.r, '#f9a8d4'); },
  dormiu(fx, e) { fx.texto(e.l.x, e.l.y - e.l.alto - 8, 'Zzz', '#bfdbfe'); },
  amnesia(fx, e) { heroi(fx, 'interrogacao', 1, { l: e.l }); },
  conchaFecha(fx, e) { cacos(fx, e.l.x, e.l.y - 10, ['#94a3b8', '#e2e8f0', '#a78bfa'], 10, 160); },
  explosaoPsi(fx, e) { faiscas(fx, e.x, e.y - 12, PSI, 28, 300); choque(fx, e.x, e.y, e.r, '#ec4899'); choque(fx, e.x, e.y, e.r * 0.6, '#fbcfe8'); rachas(fx, e.x, e.y, e.r * 0.7, '#500724'); },
  pulsoMental(fx, e) { heroi(fx, 'pulsoMental', 0.6, { x: e.x, y: e.y, r: e.r }); faiscas(fx, e.x, e.y - 12, PSI, 14, 220); },
  // Drampa
  rugidoAnciao(fx, e) { heroi(fx, 'rugidoAnciao', e.mega ? 0.7 : 0.45, { x: e.l.x, y: e.l.y, ang: e.ang, R: e.R, abre: e.abre }); faiscas(fx, e.l.x + Math.cos(e.ang) * 20, e.l.y - 14, OURO, 10, 200); },
  meteoroDraco(fx, e) { heroi(fx, 'meteoroDraco', e.dur, { x: e.x, y: e.y, r: e.r }); },
  meteoroCai(fx, e) { faiscas(fx, e.x, e.y - 10, DRACO, 40, 360); cacos(fx, e.x, e.y, ['#7c3aed', '#1e1b4b', '#2dd4bf'], 20, 300); pedrinhas(fx, e.x, e.y, 18, 280); choque(fx, e.x, e.y, e.r, '#a78bfa'); choque(fx, e.x, e.y, e.r * 0.6, '#2dd4bf'); rachas(fx, e.x, e.y, e.r * 0.9, '#1e1b4b'); },
  berserk(fx, e) { faiscas(fx, e.l.x, e.l.y - e.l.alto * 0.6, ['#ef4444', '#7f1d1d', '#fca5a5'], 18, 220); choque(fx, e.l.x, e.l.y, 36, '#ef4444'); },
  // Sharpedo
  cargaBarbatana(fx, e) { heroi(fx, 'cargaBarbatana', e.max, { l: e.l, max: e.max }); },
  barbatana(fx, e) { heroi(fx, 'rastroAsa', 0.3, { ...e, agua: true }); gotas(fx, e.x1, e.y1 - 4, e.onda ? 24 : 8, e.onda ? 220 : 130); if (e.onda) choque(fx, e.x1, e.y1, 40, '#93c5fd'); },
});

Object.assign(HEROES_NOVOS, {
  cristaisCarga(g, h, k) { const l = h.l; if (l.ko) return; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.45, x = l.x + Math.cos(a) * 14, y = l.y - l.alto * 0.6 + Math.sin(a) * 10; cristal(g, x, y, a, 6 + k * 4, 3, Math.floor(k * 12 + i) % 2 ? '#ef4444' : '#fca5a5'); } },
  cargaSismica(g, h, k) { const l = h.l; g.globalAlpha = 0.6; PX.anilloPix(g, px(l.x), px(l.y), px(h.r * k), px(h.r * 0.62 * k), '#ef4444', 2, 12, k * 8); PX.anilloPix(g, px(l.x), px(l.y), px(h.r), px(h.r * 0.62), '#78716c', 1, 20, 0); g.globalAlpha = 1; for (let i = 0; i < 6; i++) { const a = i * 1.047 + k, x = l.x + Math.cos(a) * h.r * (1 - k), y = l.y + Math.sin(a) * h.r * 0.62 * (1 - k); poli(g, [[x - 2, y], [x, y - 4], [x + 2, y]], ROCHA[i % 4], '#292524'); } },
  interrogacao(g, h, k) { const l = h.l; if (l.ko) return; g.globalAlpha = 1 - k * k; const y = l.y - l.alto - 14 - k * 10; for (let i = 0; i < 3; i++) PX.disco(g, px(l.x - 6 + i * 6), px(y - Math.sin(k * 10 + i) * 2), 2, PSI[i]); g.globalAlpha = 1; },
  pulsoMental(g, h, k) { g.globalAlpha = 1 - k; for (let i = 0; i < 3; i++) { const r = h.r * Math.min(1, k * 1.5 + i * 0.15); g.strokeStyle = PSI[i]; g.lineWidth = 2; g.beginPath(); g.ellipse(px(h.x), px(h.y - 6), r, r * 0.62, 0, 0, 7); g.stroke(); } for (let i = 0; i < 8; i++) { const a = i * 0.785 + k * 4, r = h.r * k; poli(g, [[h.x + Math.cos(a) * r - 3, h.y + Math.sin(a) * r * 0.62 - 10], [h.x + Math.cos(a) * r, h.y + Math.sin(a) * r * 0.62 - 15], [h.x + Math.cos(a) * r + 3, h.y + Math.sin(a) * r * 0.62 - 10]], '#ec4899', '#500724'); } g.globalAlpha = 1; },
  rugidoAnciao(g, h, k) {
    g.globalAlpha = 1 - k;
    for (let i = 0; i < 4; i++) { const r = h.R * Math.min(1, k * 1.6 + i * 0.18); g.strokeStyle = OURO[i]; g.lineWidth = 3 - i * 0.5; g.beginPath(); g.ellipse(px(h.x), px(h.y - 12), r, r * 0.62, 0, h.ang - h.abre / 2, h.ang + h.abre / 2); g.stroke(); }
    for (let i = 0; i < 6; i++) { const a = h.ang + (i / 5 - 0.5) * h.abre, r = h.R * k; PX.lineaPix(g, h.x + Math.cos(a) * r * 0.6, h.y + Math.sin(a) * r * 0.37 - 12, h.x + Math.cos(a) * r, h.y + Math.sin(a) * r * 0.62 - 12, '#fef3c7', 1); }
    g.globalAlpha = 1;
  },
  meteoroDraco(g, h, k) {
    const y = h.y - 260 * (1 - k), r = 10 + k * 8;
    g.globalAlpha = 0.25 + k * 0.45; g.fillStyle = '#1e1b4b'; g.beginPath(); g.ellipse(px(h.x), px(h.y), h.r * k, h.r * 0.62 * k, 0, 0, 7); g.fill(); g.globalAlpha = 1;
    PX.anilloPix(g, px(h.x), px(h.y), px(h.r), px(h.r * 0.62), '#a78bfa', 2, 16, k * 6);
    for (let i = 1; i <= 6; i++) PX.disco(g, px(h.x + i * 2), px(y - i * 10), r * (1 - i * 0.13), DRACO[i % 4]);
    PX.disco(g, px(h.x), px(y), r, '#4c1d95'); PX.disco(g, px(h.x - r * 0.3), px(y - r * 0.3), r * 0.4, '#2dd4bf');
  },
  cargaBarbatana(g, h, k, t) { const l = h.l; if (l.ko || !l.accion || l.dash) return; const f = Math.min(1, k), cheio = f >= 0.98; g.globalAlpha = 0.9; g.strokeStyle = cheio ? '#ffffff' : '#60a5fa'; g.lineWidth = 2; g.beginPath(); g.arc(px(l.x), px(l.y - l.alto - 10), 6, -Math.PI / 2, -Math.PI / 2 + f * 6.28); g.stroke(); if (cheio && Math.floor(t * 12) % 2) PX.disco(g, px(l.x), px(l.y - l.alto - 10), 2, '#ffffff'); g.globalAlpha = 1; },
});

Object.assign(ENTIDADES_NOVAS, {
  escamaDraco(g, e, t, fx) {
    const x = e.x, y = e.y - 12, s = e.mega ? 1.3 : 1;
    for (let i = 1; i <= 3; i++) PX.disco(g, px(x - Math.cos(e.ang) * i * 6), px(y - Math.sin(e.ang) * i * 5), (2.6 - i * 0.6) * s, DRACO[i % 4]);
    g.save(); g.translate(px(x), px(y)); g.rotate(e.ang + t * 10); poli(g, [[-6 * s, 0], [0, -4 * s], [6 * s, 0], [0, 4 * s]], '#7c3aed', '#1e1b4b'); PX.lineaPix(g, -3, -1, 3, -1, '#99f6e4', 1); g.restore();
    if (fx && ale() < 0.4) fx.add({ x, y, vx: entre(-20, 20), vy: entre(-20, 10), g: 0, size: 1.6, life: 0.3, color: DRACO[Math.floor(ale() * 4)], forma: 'sq' });
  },
  estilhacoRocha(g, e) { g.save(); g.translate(px(e.x), px(e.y - 12)); g.rotate(e.ang); poli(g, [[-7, -3], [3, -5], [8, 0], [2, 5], [-6, 3]], '#78716c', '#292524'); cristal(g, 0, 0, 0, 5, 2); g.restore(); },
  feixeCristal(g, e, t, fx) {
    if (e.t < e.carga) return;
    const k = Math.min(1, (e.t - e.carga) / 0.12), fim = 1 - Math.max(0, (e.t - e.carga - e.dur + 0.2) / 0.2), W = e.ancho * k * fim, ca = Math.cos(e.ang), sa = Math.sin(e.ang), x0 = e.x + ca * 12, y0 = e.y - 16 + sa * 8, x1 = x0 + ca * e.largo, y1 = y0 + sa * e.largo * 0.85;
    for (const [w, c] of [[W, '#7f1d1d'], [W * 0.7, '#ef4444'], [W * 0.4, '#fca5a5'], [W * 0.15, '#ffffff']]) if (w > 0.5) PX.lineaPix(g, x0, y0, x1, y1, c, Math.max(1, Math.round(w)));
    for (let i = 0; i < 8; i++) { const f = ((t * 3 + i / 8) % 1), x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f + Math.sin(t * 20 + i) * W * 0.4; PX.disco(g, px(x), px(y), 1.5, '#fee2e2'); }
    if (fx && ale() < 0.6) { const f = ale(); fx.add({ x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, vx: entre(-60, 60), vy: -entre(40, 120), g: 300, size: entre(1.4, 2.4), life: 0.4, color: CRISTAL[Math.floor(ale() * 3)], forma: 'sq' }); }
  },
  pilaresPedra(g, e) { const sob = Math.min(1, e.t * 6), al = Math.min(1, (e.dur - e.t) * 3); g.globalAlpha = al; for (const p of e.pts) { const H = 34 * sob; g.fillStyle = '#292524'; g.beginPath(); g.ellipse(px(p.x), px(p.y), 14, 6, 0, 0, 7); g.fill(); poli(g, [[p.x - 11, p.y], [p.x - 9, p.y - H], [p.x - 2, p.y - H - 5], [p.x + 9, p.y - H + 2], [p.x + 11, p.y]], '#78716c', '#292524'); PX.lineaPix(g, p.x - 6, p.y - 4, p.x - 5, p.y - H + 4, '#a8a29e', 1); cristal(g, p.x + 3, p.y - H * 0.6, -1.2, 6, 2); } g.globalAlpha = 1; },
  espinhosCristal(g, e) { const sob = Math.min(1, e.t * 6), al = Math.min(1, (e.dur - e.t) * 3); g.globalAlpha = al; for (const [i, p] of e.pts.entries()) { espeto(g, p.x, p.y, (16 + (i % 3) * 5) * sob, i % 2 ? '#ef4444' : '#f87171', '#450a0a'); espeto(g, p.x + 5, p.y + 1, 10 * sob, '#fca5a5', '#450a0a'); } g.globalAlpha = 1; },
  campoGeoda(g, e, t, fx) {
    const al = Math.min(1, (e.dur - e.t) * 2, e.t * 4), R = e.radio;
    g.globalAlpha = al * 0.28; g.fillStyle = '#7f1d1d'; g.beginPath(); g.ellipse(px(e.x), px(e.y), R, R * 0.62, 0, 0, 7); g.fill();
    g.globalAlpha = al; PX.anilloPix(g, px(e.x), px(e.y), px(R), px(R * 0.62), '#ef4444', 2, 18, t * 2);
    for (let i = 0; i < 14; i++) { const a = i * 0.45, rr = R * (0.25 + ((i * 7) % 10) / 13), x = e.x + Math.cos(a) * rr, y = e.y + Math.sin(a) * rr * 0.62; espeto(g, x, y, 6 + (i % 3) * 3 + Math.sin(t * 6 + i) * 1.5, i % 2 ? '#ef4444' : '#fca5a5', '#450a0a'); }
    if (fx && ale() < 0.5) fx.add({ x: e.x + entre(-R, R) * 0.8, y: e.y + entre(-R, R) * 0.5, vx: 0, vy: -50, g: 0, size: 1.8, life: 0.5, color: CRISTAL[Math.floor(ale() * 3)], forma: 'chispa' });
    g.globalAlpha = 1;
  },
  bolhaSono(g, e, t) { const r = (e.mega ? 10 : 7) + Math.sin(t * 6) * 1.2, x = e.x, y = e.y - 14 + Math.sin(t * 4) * 3; g.fillStyle = '#ec4899'; g.globalAlpha = 0.45; g.beginPath(); g.arc(px(x), px(y), r, 0, 7); g.fill(); g.globalAlpha = 1; g.strokeStyle = '#fbcfe8'; g.lineWidth = 1.5; g.stroke(); PX.disco(g, px(x - r * 0.35), px(y - r * 0.35), 1.5, '#ffffff'); texto3z(g, x + r, y - r, t); },
  conchaShellder(g, e, t) {
    const l = e.dueno; if (l.ko) return; const x = l.x, y = l.y - 14, R = 20, abre = Math.min(1, e.t * 5, (e.dur - e.t) * 5);
    g.globalAlpha = 0.6; g.strokeStyle = '#ec4899'; g.lineWidth = 2; g.beginPath(); g.ellipse(px(x), px(y + 8), R + 6 + Math.sin(t * 8) * 2, (R + 6) * 0.5, 0, 0, 7); g.stroke(); g.globalAlpha = 1;
    poli(g, [[x - R, y + 6], [x - R * 0.9, y - R * 0.6 * abre - 4], [x, y - R * abre - 6], [x + R * 0.9, y - R * 0.6 * abre - 4], [x + R, y + 6], [x, y + 10]], '#a8a29e', '#292524');
    for (let i = -3; i <= 3; i++) espeto(g, x + i * 6, y - R * 0.7 * abre - 2 + Math.abs(i) * 2, 9, '#e2e8f0', '#334155');
    PX.lineaPix(g, x - R * 0.8, y + 2, x + R * 0.8, y + 2, '#78716c', 1);
  },
  piaoShellder(g, e, t, fx) {
    const l = e.dueno; if (l.ko) return; const x = l.x, y = l.y - 14, a = t * 18;
    g.globalAlpha = 0.25; g.fillStyle = '#ec4899'; g.beginPath(); g.ellipse(px(x), px(l.y), e.radio, e.radio * 0.62, 0, 0, 7); g.fill(); g.globalAlpha = 1;
    for (let i = 0; i < 3; i++) { g.strokeStyle = PSI[i]; g.lineWidth = 2; g.beginPath(); g.ellipse(px(x), px(l.y), e.radio * (0.35 + i * 0.25), e.radio * 0.62 * (0.35 + i * 0.25), 0, -a + i, -a + i + 3.5); g.stroke(); }
    g.fillStyle = '#a8a29e'; g.beginPath(); g.ellipse(px(x), px(y), 20, 16, 0, 0, 7); g.fill(); g.strokeStyle = '#292524'; g.lineWidth = 1; g.stroke();
    for (let i = 0; i < 8; i++) { const b = a + i * 0.785; espeto(g, x + Math.cos(b) * 18, y + Math.sin(b) * 10 + 4, 8 + Math.sin(b) * 3, '#e2e8f0', '#334155'); }
    if (fx && ale() < 0.6) { const b = ale() * 6.28; fx.add({ x: x + Math.cos(b) * e.radio, y: l.y + Math.sin(b) * e.radio * 0.62, vx: -Math.cos(b) * 160, vy: -Math.sin(b) * 100, g: 0, size: 2, life: 0.4, color: PSI[Math.floor(ale() * 4)], forma: 'sq' }); }
  },
  turbulencia(g, e, t) { const al = Math.min(1, (e.dur - e.t) * 3); g.globalAlpha = al * 0.8; for (let i = 0; i < 10; i++) { const f = ((t * 1.8 + i / 10) % 1), a = e.ang + (((i * 37) % 10) / 10 - 0.5) * e.abre, r = e.R * f, x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r * 0.62 - 10; g.strokeStyle = i % 2 ? '#fef3c7' : '#e2e8f0'; g.lineWidth = 1.5; g.beginPath(); g.arc(px(x), px(y), 6, a - 1.5, a + 1.5); g.stroke(); } g.globalAlpha = 1; },
  nevoaDraco(g, e, t, fx) {
    const al = Math.min(1, (e.dur - e.t) * 2, e.t * 4), R = e.radio;
    g.globalAlpha = al * 0.55;
    for (let i = 0; i < 12; i++) { const a = i * 0.52 + t * 0.4, rr = R * (0.3 + (i % 3) * 0.3), x = e.x + Math.cos(a) * rr, y = e.y + Math.sin(a) * rr * 0.62 - 10; PX.disco(g, px(x), px(y), 16 + (i % 4) * 4, i % 2 ? '#e2e8f0' : '#cbd5e1'); }
    g.globalAlpha = al; if (e.mega) PX.anilloPix(g, px(e.x), px(e.y), px(R), px(R * 0.62), '#a78bfa', 2, 14, t * 2);
    if (fx && ale() < 0.3) fx.add({ x: e.x + entre(-R, R) * 0.7, y: e.y + entre(-R, R) * 0.4 - 10, vx: entre(-20, 20), vy: -10, g: 0, size: 2.4, life: 0.8, color: '#f1f5f9', forma: 'sq' });
    g.globalAlpha = 1;
  },
  ventoDraco(g, e, t, fx) { const ca = Math.cos(e.ang), sa = Math.sin(e.ang), x = e.x, y = e.y - 12; g.save(); g.translate(px(x), px(y)); g.rotate(e.ang); for (let i = 0; i < 4; i++) { g.strokeStyle = DRACO[i]; g.lineWidth = 3 - i * 0.5; g.beginPath(); g.arc(-i * 8, 0, 16 + i * 3, -1.1, 1.1); g.stroke(); } poli(g, [[-6, -6], [10, 0], [-6, 6], [-2, 0]], '#7c3aed', '#1e1b4b'); g.restore(); if (fx) for (let i = 0; i < 2; i++) fx.add({ x: x - ca * 10, y: y - sa * 8, vx: -ca * 80 + entre(-40, 40), vy: -sa * 60 + entre(-40, 40), g: 0, drag: 2, size: entre(1.6, 2.6), life: 0.4, color: DRACO[i + 1], forma: 'sq' }); },
  chamaAzul(g, e, t, fx) {
    const al = Math.min(1, (e.dur - e.t) * 2, e.t * 4), R = e.radio;
    g.globalAlpha = al * 0.3; g.fillStyle = '#1e3a8a'; g.beginPath(); g.ellipse(px(e.x), px(e.y), R, R * 0.62, 0, 0, 7); g.fill(); g.globalAlpha = al;
    for (let i = 0; i < 16; i++) { const a = i * 0.39, rr = R * (0.2 + ((i * 7) % 10) / 12), x = e.x + Math.cos(a) * rr, y = e.y + Math.sin(a) * rr * 0.62, H = 8 + Math.sin(t * 9 + i * 1.7) * 4; poli(g, [[x - 4, y], [x - 1, y - H], [x + 1, y - H * 0.6], [x + 4, y]], i % 3 ? '#3b82f6' : '#93c5fd', '#1e3a8a'); }
    if (fx && ale() < 0.6) fx.add({ x: e.x + entre(-R, R) * 0.8, y: e.y + entre(-R, R) * 0.5, vx: entre(-10, 10), vy: -entre(40, 80), g: 0, size: 2, life: 0.5, color: ale() < 0.5 ? '#60a5fa' : '#bfdbfe', forma: 'sq' });
    g.globalAlpha = 1;
  },
  olhosBerserk(g, e, t, fx) { const l = e.dueno; if (l.ko || l.oculto) return; const y = l.y - l.alto * 0.72 - l.salto, x = l.x + (Math.cos(l.angulo ?? 0) > 0 ? 3 : -3); for (const s of [-1, 1]) PX.disco(g, px(x + s * 3), px(y), 1.6, Math.floor(t * 6) % 2 ? '#ef4444' : '#fca5a5'); if (fx && ale() < 0.25) fx.add({ x: x + entre(-3, 3), y, vx: entre(-20, 20), vy: -30, g: 0, size: 1.4, life: 0.4, color: '#ef4444', forma: 'sq' }); },
  ondaBarbatana(g, e, t) { const x = e.x, y = e.y, a = e.ang; g.save(); g.translate(px(x + Math.cos(a) * 14), px(y + Math.sin(a) * 8)); g.rotate(a); for (let i = 0; i < 3; i++) { g.strokeStyle = ['#1e3a8a', '#3b82f6', '#bfdbfe'][i]; g.lineWidth = 4 - i; g.beginPath(); g.arc(-i * 4, -6, 22 - i * 3, -1.3, 1.3); g.stroke(); } g.restore(); },
});
function texto3z(g, x, y, t) { if (Math.floor(t * 2) % 2) PX.disco(g, px(x), px(y), 1.4, '#bfdbfe'); }
