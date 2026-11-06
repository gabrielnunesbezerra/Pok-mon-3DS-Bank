// Desenhos de Dedenne e Morpeko (engine/formasKits11.js). Formas sólidas com contorno e partículas, sem brilho em volta.
import * as PX from './pixelfx.js';
import { EVENTOS_NOVOS, HEROES_NOVOS, ENTIDADES_NOVAS } from './efectosNovos.js';
import { heroi, faiscas, choque, rachas, entre, ale, px } from './efectosKits4.js';

const ELE = ['#fde047', '#ffffff', '#facc15', '#fef9c3'], SOMB = ['#7c3aed', '#c084fc', '#1f1b2e', '#e9d5ff'];
function raioZig(g, x0, y0, x1, y1, cor, w = 2, s = 1) { const n = 6; let a = x0, b = y0; for (let i = 1; i <= n; i++) { const f = i / n, x = x0 + (x1 - x0) * f + (i < n ? Math.sin(i * 7.3 + s) * 6 : 0), y = y0 + (y1 - y0) * f + (i < n ? Math.cos(i * 5.1 + s) * 3 : 0); PX.lineaPix(g, a, b, x, y, cor, w); a = x; b = y; } }

Object.assign(EVENTOS_NOVOS, {
  raioDedenne(fx, e) { heroi(fx, 'raioDedenne', e.fino ? 0.14 : 0.2, { x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, fino: e.fino, s: ale() * 9 }); faiscas(fx, e.x1, e.y1, ELE, e.fino ? 3 : 7, 160); },
  cargaParabolica(fx, e) { faiscas(fx, e.x, e.y - 10, ELE, 24, 260); choque(fx, e.x, e.y, e.r, '#fde047'); choque(fx, e.x, e.y, e.r * 0.6, '#f9a8d4'); heroi(fx, 'antenaPulso', 0.4, { x: e.x, y: e.y, r: e.r }); },
  trocaFome(fx, e) { const c = e.fome ? SOMB : ELE; faiscas(fx, e.l.x, e.l.y - 12, c, 14, 180); choque(fx, e.l.x, e.l.y, 26, c[0]); },
  auraWheel(fx, e) { heroi(fx, 'rodaAura', e.dur + 0.1, { l: e.l, fome: e.fome }); },
  acertoRoda(fx, e) { const c = e.fome ? SOMB : ELE; faiscas(fx, e.x, e.y, c, 14, 240); choque(fx, e.x, e.y + 10, 22, c[0]); },
  lanche(fx, e) { for (let i = 0; i < 8; i++) fx.add({ x: e.l.x + entre(-6, 6), y: e.l.y - 14, vx: entre(-50, 50), vy: -entre(40, 100), g: 260, size: 2, life: 0.5, color: i % 2 ? '#a3e635' : '#854d0e', forma: 'sq' }); fx.texto(e.l.x, e.l.y - e.l.alto - 6, 'NOM!', '#bef264'); },
  rodaFrenesi(fx, e) { faiscas(fx, e.l.x, e.l.y - 10, ELE, 20, 260); choque(fx, e.l.x, e.l.y, 40, '#fde047'); },
});
Object.assign(HEROES_NOVOS, {
  raioDedenne(g, h, k) { g.globalAlpha = 1 - k; if (!h.fino) raioZig(g, h.x0, h.y0, h.x1, h.y1, '#854d0e', 4, h.s); raioZig(g, h.x0, h.y0, h.x1, h.y1, '#fde047', h.fino ? 1 : 2, h.s); raioZig(g, h.x0, h.y0, h.x1, h.y1, '#ffffff', 1, h.s + 0.5); g.globalAlpha = 1; },
  antenaPulso(g, h, k) { g.globalAlpha = 1 - k; for (let i = 0; i < 10; i++) { const a = i * 0.628 + k * 3; raioZig(g, h.x, h.y - 10, h.x + Math.cos(a) * h.r * k, h.y + Math.sin(a) * h.r * 0.62 * k, i % 2 ? '#fde047' : '#f9a8d4', 1, i); } g.globalAlpha = 1; },
  rodaAura(g, h, k, t) { const l = h.l; if (l.ko) return; const c = h.fome ? SOMB : ELE, x = l.x, y = l.y - 12; for (let i = 0; i < 3; i++) { g.strokeStyle = c[i]; g.lineWidth = 3 - i * 0.7; g.beginPath(); g.ellipse(px(x), px(y), 18 + i * 3, 13 + i * 2, 0, t * 22 + i * 2, t * 22 + i * 2 + 4.4); g.stroke(); } for (let i = 0; i < 6; i++) { const a = t * 22 + i * 1.05; PX.disco(g, px(x + Math.cos(a) * 20), px(y + Math.sin(a) * 14), 2, c[i % 2]); } },
});
Object.assign(ENTIDADES_NOVAS, {
  campoEletrico(g, e, t, fx) {
    const al = Math.min(1, (e.dur - e.t) * 2, e.t * 4), R = e.radio;
    g.globalAlpha = al * 0.22; g.fillStyle = '#facc15'; g.beginPath(); g.ellipse(px(e.x), px(e.y), R, R * 0.62, 0, 0, 7); g.fill();
    g.globalAlpha = al; PX.anilloPix(g, px(e.x), px(e.y), px(R), px(R * 0.62), '#fde047', 2, 16, t * 3);
    for (let i = 0; i < 4; i++) { const a = t * 2 + i * 1.57; raioZig(g, e.x + Math.cos(a) * R * 0.3, e.y + Math.sin(a) * R * 0.18, e.x + Math.cos(a + 0.6) * R * 0.85, e.y + Math.sin(a + 0.6) * R * 0.52, '#fef08a', 1, Math.floor(t * 12) + i); }
    if (fx && ale() < 0.5) fx.add({ x: e.x + entre(-R, R) * 0.7, y: e.y + entre(-R, R) * 0.4, vx: 0, vy: -40, g: 0, size: 1.6, life: 0.4, color: ELE[Math.floor(ale() * 4)], forma: 'chispa' });
    g.globalAlpha = 1;
  },
  antenas(g, e, t, fx) { const l = e.dueno; if (l.ko) return; for (const s of [-1, 1]) raioZig(g, l.x + s * 5, l.y - l.alto, l.x + s * 14, l.y - l.alto - 16, '#fde047', 1, Math.floor(t * 16) + s); if (fx && ale() < 0.6) fx.add({ x: l.x + entre(-10, 10), y: l.y - l.alto - 10, vx: entre(-60, 60), vy: -entre(20, 80), g: 0, size: 1.6, life: 0.3, color: ELE[Math.floor(ale() * 4)], forma: 'chispa' }); },
  rodaMorpeko(g, e, t, fx) {
    const l = e.dueno; if (l.ko) return; const c = l.fome ? SOMB : ELE, x = l.x, y = l.y - 12, R = 26;
    g.globalAlpha = 0.3; g.fillStyle = c[0]; g.beginPath(); g.ellipse(px(x), px(l.y), R + 6, (R + 6) * 0.45, 0, 0, 7); g.fill(); g.globalAlpha = 1;
    for (let i = 0; i < 4; i++) { g.strokeStyle = c[i]; g.lineWidth = 3; g.beginPath(); g.ellipse(px(x), px(y), R - i * 3, (R - i * 3) * 0.75, 0, t * 26 + i * 1.6, t * 26 + i * 1.6 + 3.6); g.stroke(); }
    if (fx) for (let i = 0; i < 2; i++) fx.add({ x: x + entre(-R, R), y: l.y, vx: entre(-80, 80), vy: -entre(40, 120), g: 300, size: 2, life: 0.4, color: c[i], forma: 'chispa' });
    rachas.length; void choque;
  },
});

// ---------------------------------------------------------------- Dedenne carregado, pulo energizado e Morpeko novo
Object.assign(EVENTOS_NOVOS, {
  paralisaMorpeko(fx, e) { faiscas(fx, e.l.x, e.l.y - e.l.alto * 0.5, ELE, 10, 180); heroi(fx, 'paralisiaK11', 0.6, { l: e.l }); },
  giroFome(fx, e) { faiscas(fx, e.x, e.y - 10, SOMB, 26, 300); choque(fx, e.x, e.y, e.r, '#7c3aed'); choque(fx, e.x, e.y, e.r * 1.25, '#c084fc'); rachas(fx, e.x, e.y, e.r * 0.7, '#1f1b2e'); },
  trocaForma(fx, e) { const c = e.fome ? SOMB : ELE; faiscas(fx, e.l.x, e.l.y - 12, c, 34, 320); choque(fx, e.l.x, e.l.y, e.r, c[0]); choque(fx, e.l.x, e.l.y, e.r * 1.3, c[1]); heroi(fx, 'trocaK11', 0.7, { l: e.l, fome: e.fome }); },
  puloEnergizado(fx, e) { heroi(fx, 'puloK11', e.dur + 0.1, { ...e }); faiscas(fx, e.x0, e.y0 - 6, ELE, 14, 200); },
  explosaoEletrica(fx, e) { faiscas(fx, e.x, e.y - 10, ELE, 50, 380); faiscas(fx, e.x, e.y - 10, ['#f9a8d4', '#ffffff'], 16, 260); choque(fx, e.x, e.y, e.r, '#fde047'); choque(fx, e.x, e.y, e.r * 1.3, '#ffffff'); choque(fx, e.x, e.y, e.r * 0.5, '#f9a8d4'); rachas(fx, e.x, e.y, e.r * 0.9, '#854d0e'); heroi(fx, 'antenaPulso', 0.6, { x: e.x, y: e.y, r: e.r * 1.1 }); fx.debris?.(e.x, e.y, 'ROCK', 10); },
});
Object.assign(HEROES_NOVOS, {
  paralisiaK11(g, h, k, t) { const l = h.l; if (l.ko) return; g.globalAlpha = 1 - k; for (let i = 0; i < 3; i++) { const a = t * 9 + i * 2.1; raioZig(g, l.x + Math.cos(a) * 10, l.y - l.alto, l.x + Math.cos(a + 1) * 12, l.y - 4, '#fde047', 1, Math.floor(t * 14) + i); } g.globalAlpha = 1; },
  trocaK11(g, h, k, t) { const l = h.l; if (l.ko) return; const c = h.fome ? SOMB : ELE; g.globalAlpha = 1 - k; for (let i = 0; i < 2; i++) { g.strokeStyle = c[i]; g.lineWidth = 3 - i; g.beginPath(); g.ellipse(px(l.x), px(l.y - 12 - k * 20), 16 + k * 20, (16 + k * 20) * 0.5, 0, t * 9 + i * 3, t * 9 + i * 3 + 4.6); g.stroke(); } g.globalAlpha = 1; },
  puloK11(g, h, k, t) {
    const f = Math.min(1, k * (h.dur + 0.1) / h.dur), x = h.x0 + (h.x1 - h.x0) * f, y = h.y0 + (h.y1 - h.y0) * f - Math.sin(f * Math.PI) * 70 - 12;
    g.globalAlpha = 0.3 + f * 0.4; g.fillStyle = '#0b0a14'; g.beginPath(); g.ellipse(px(h.x1), px(h.y1), h.r * f, h.r * 0.62 * f, 0, 0, 7); g.fill(); g.globalAlpha = 1;
    PX.anilloPix(g, px(h.x1), px(h.y1), px(h.r), px(h.r * 0.62), '#fde047', 2, 16, t * 6);
    for (let i = 0; i < 6; i++) { const a = t * 20 + i * 1.05; raioZig(g, x, y, x + Math.cos(a) * 18, y + Math.sin(a) * 12, i % 2 ? '#fde047' : '#ffffff', 1, i + Math.floor(t * 20)); }
  },
});
Object.assign(ENTIDADES_NOVAS, {
  faiscaMorpeko(g, e, t, fx) { const x = e.x, y = e.y - 12; for (let i = 1; i <= 3; i++) PX.disco(g, px(x - Math.cos(e.ang) * i * 6), px(y - Math.sin(e.ang) * i * 5), 2.6 - i * 0.6, ELE[i % 4]); raioZig(g, x - Math.cos(e.ang) * 8, y - Math.sin(e.ang) * 6, x + Math.cos(e.ang) * 6, y + Math.sin(e.ang) * 4, '#fde047', 2, Math.floor(t * 20)); PX.disco(g, px(x), px(y), 3, '#ffffff'); if (fx && ale() < 0.4) fx.add({ x, y, vx: entre(-30, 30), vy: entre(-30, 10), g: 0, size: 1.4, life: 0.25, color: ELE[Math.floor(ale() * 4)], forma: 'chispa' }); },
});
// Dedenne carregado dentro do campo: faíscas e raiozinhos em volta dele
const desenhoCampo = ENTIDADES_NOVAS.campoEletrico;
ENTIDADES_NOVAS.campoEletrico = (g, e, t, fx) => {
  desenhoCampo(g, e, t, fx);
  const l = e.dueno; if (!l || l.ko || !l.est.campoEletrico) return;
  for (let i = 0; i < 3; i++) { const a = t * 7 + i * 2.1; raioZig(g, l.x + Math.cos(a) * 12, l.y - l.alto * 0.5 + Math.sin(a) * 8, l.x + Math.cos(a + 0.8) * 18, l.y - l.alto * 0.5 + Math.sin(a + 0.8) * 12, '#fde047', 1, Math.floor(t * 16) + i); }
  if (fx && ale() < 0.5) fx.add({ x: l.x + entre(-12, 12), y: l.y - entre(4, l.alto), vx: entre(-40, 40), vy: -entre(30, 70), g: 0, size: 1.6, life: 0.35, color: ELE[Math.floor(ale() * 4)], forma: 'chispa' });
};
