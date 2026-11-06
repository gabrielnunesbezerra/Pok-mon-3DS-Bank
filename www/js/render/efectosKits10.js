// Desenhos das torres de cristal e do empurrão do Gigalith e do Hyper Voice, Calm Mind e nuvem negra do Drampa
// (engine/formasKits10.js). Formas sólidas com contorno e partículas, sem brilho em volta.
import * as PX from './pixelfx.js';
import { EVENTOS_NOVOS, HEROES_NOVOS, ENTIDADES_NOVAS } from './efectosNovos.js';
import { heroi, poli, faiscas, rachas, choque, cacos, entre, ale, px } from './efectosKits4.js';

const CRISTAL = ['#ef4444', '#f87171', '#fecaca', '#7f1d1d'], ROCHA = ['#a8a29e', '#78716c', '#57534e', '#d6d3d1'], OURO = ['#fde68a', '#facc15', '#fef3c7', '#ffffff'], RAIO = ['#fde047', '#ffffff', '#a78bfa', '#facc15'];
const pedrinhas = (fx, x, y, n = 10, v = 180) => { for (let i = 0; i < n; i++) { const a = ale() * 6.28, s = entre(v * 0.4, v); fx.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.4 - entre(80, 180), g: 480, size: entre(1.6, 3.2), life: entre(0.5, 0.8), color: ROCHA[i % 4], forma: 'sq', vr: entre(-10, 10) }); } };
function raioZig(g, x0, y0, x1, y1, cor, w = 2, s = 1) { const n = 6; let px0 = x0, py0 = y0; for (let i = 1; i <= n; i++) { const f = i / n, x = x0 + (x1 - x0) * f + (i < n ? Math.sin(i * 7.3 + s) * 7 : 0), y = y0 + (y1 - y0) * f; PX.lineaPix(g, px0, py0, x, y, cor, w); px0 = x; py0 = y; } }

Object.assign(EVENTOS_NOVOS, {
  torreSobe(fx, e) { pedrinhas(fx, e.x, e.y, 18, 220); faiscas(fx, e.x, e.y - 20, CRISTAL, 12, 200); choque(fx, e.x, e.y, 34, '#d6d3d1'); rachas(fx, e.x, e.y, 30, '#292524'); },
  torreCai(fx, e) { cacos(fx, e.x, e.y - 20, CRISTAL, 16, 200); pedrinhas(fx, e.x, e.y, 10, 160); },
  torreBate(fx, e) { cacos(fx, e.x, e.y - 12, CRISTAL, 12, 220); choque(fx, e.x, e.y, 30, '#ef4444'); },
  torreEmpurrada(fx, e) { pedrinhas(fx, e.x, e.y, 8, 140); },
  empurrao(fx, e) { heroi(fx, 'empurrao', 0.3, { x: e.l.x, y: e.l.y, ang: e.ang, R: e.R }); pedrinhas(fx, e.l.x + Math.cos(e.ang) * 30, e.l.y + Math.sin(e.ang) * 20, 10, 200); },
  cargaTorre(fx, e) { heroi(fx, 'cargaTorre', e.dur, { x: e.x, y: e.y }); },
  descargaTorre(fx, e) { faiscas(fx, e.x, e.y - 30, CRISTAL, 30, 320); cacos(fx, e.x, e.y - 20, CRISTAL, 10, 220); choque(fx, e.x, e.y, e.r, '#ef4444'); choque(fx, e.x, e.y, e.r * 0.6, '#fecaca'); rachas(fx, e.x, e.y, e.r * 0.8, '#450a0a'); heroi(fx, 'descarga', 0.35, { x: e.x, y: e.y, r: e.r }); },
  torreLiga(fx, e) { faiscas(fx, e.x, e.y - 40, CRISTAL, 14, 200); },
  laserTorre(fx, e) { heroi(fx, 'laserTorre', 0.18, { ...e }); faiscas(fx, e.x1, e.y1, CRISTAL, 5, 140); },
  ondaVoz(fx, e) { heroi(fx, 'ondaVoz', 0.4, { ...e }); },
  calmaMente(fx, e) { heroi(fx, 'calmaMente', e.dur, { l: e.l }); faiscas(fx, e.l.x, e.l.y - 14, ['#a78bfa', '#c4b5fd', '#ffffff'], 16, 160); choque(fx, e.l.x, e.l.y, 40, '#a78bfa'); },
  raioNuvem(fx, e) { heroi(fx, 'raioNuvem', 0.22, { x: e.x, y: e.y, s: ale() * 9 }); if (!e.vazio) { faiscas(fx, e.x, e.y - 10, RAIO, 12, 220); choque(fx, e.x, e.y, 24, '#fde047'); } else faiscas(fx, e.x, e.y, RAIO, 4, 120); },
});
Object.assign(HEROES_NOVOS, {
  empurrao(g, h, k) { g.globalAlpha = 1 - k; for (let i = 0; i < 3; i++) { const r = h.R * (0.5 + k * 0.6 + i * 0.12); g.strokeStyle = ROCHA[i]; g.lineWidth = 3 - i; g.beginPath(); g.ellipse(px(h.x), px(h.y - 10), r, r * 0.62, 0, h.ang - 0.9, h.ang + 0.9); g.stroke(); } g.globalAlpha = 1; },
  cargaTorre(g, h, k, t) { g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 40); for (let i = 0; i < 6; i++) { const a = i * 1.047 + k * 6, r = 30 * (1 - k); PX.disco(g, px(h.x + Math.cos(a) * r), px(h.y - 30 + Math.sin(a) * r * 0.6), 2, CRISTAL[i % 3]); } g.globalAlpha = 1; },
  descarga(g, h, k) { g.globalAlpha = 1 - k; for (let i = 0; i < 8; i++) { const a = i * 0.785 + k; raioZig(g, h.x, h.y - 34, h.x + Math.cos(a) * h.r, h.y + Math.sin(a) * h.r * 0.62, i % 2 ? '#ef4444' : '#fecaca', 2, i); } g.globalAlpha = 1; },
  laserTorre(g, h, k) { g.globalAlpha = 1 - k * 0.6; PX.lineaPix(g, h.x0, h.y0, h.x1, h.y1, '#7f1d1d', 5); PX.lineaPix(g, h.x0, h.y0, h.x1, h.y1, '#ef4444', 3); PX.lineaPix(g, h.x0, h.y0, h.x1, h.y1, '#ffffff', 1); g.globalAlpha = 1; },
  ondaVoz(g, h, k) { g.globalAlpha = (1 - k) * 0.9; const r = h.R * (0.25 + k * 0.85); for (let i = 0; i < 2; i++) { g.strokeStyle = h.mega ? OURO[i] : ['#e2e8f0', '#fde68a'][i]; g.lineWidth = 3 - i; g.beginPath(); g.ellipse(px(h.x), px(h.y - 14), r - i * 6, (r - i * 6) * 0.62, 0, h.ang - h.abre / 2, h.ang + h.abre / 2); g.stroke(); } g.globalAlpha = 1; },
  calmaMente(g, h, k, t) { const l = h.l; if (l.ko) return; g.globalAlpha = 0.7 * Math.min(1, (1 - k) * 6); for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1, x = l.x + Math.cos(a) * 18, y = l.y - l.alto - 6 + Math.sin(a) * 5; PX.disco(g, px(x), px(y), 2, ['#a78bfa', '#60a5fa', '#facc15'][i]); } g.globalAlpha = 1; },
  raioNuvem(g, h, k) { g.globalAlpha = 1 - k; raioZig(g, h.x + 4, h.y - 150, h.x, h.y - 4, '#1e1b4b', 5, h.s); raioZig(g, h.x + 4, h.y - 150, h.x, h.y - 4, '#fde047', 3, h.s); raioZig(g, h.x + 4, h.y - 150, h.x, h.y - 4, '#ffffff', 1, h.s); g.globalAlpha = 1; },
});
Object.assign(ENTIDADES_NOVAS, {
  torreCristal(g, e, t, fx) {
    const sob = Math.min(1, e.t * 5), H = 56 * sob, x = e.x, y = e.y, W = e.r, liga = e.ativa > (e.dueno?.luta?.t ?? 0);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(px(x + 3), px(y + 2), W + 6, (W + 6) * 0.45, 0, 0, 7); g.fill();
    // base de rocha
    poli(g, [[x - W - 4, y + 2], [x - W, y - 8], [x + W, y - 8], [x + W + 4, y + 2], [x, y + 7]], '#78716c', '#292524');
    // cristal principal e dois menores
    const cr = (cx, h, w, c1, c2) => { poli(g, [[cx - w, y - 6], [cx - w * 0.7, y - 6 - h * 0.8], [cx, y - 6 - h], [cx + w * 0.7, y - 6 - h * 0.8], [cx + w, y - 6]], c1, '#450a0a'); poli(g, [[cx - w, y - 6], [cx - w * 0.7, y - 6 - h * 0.8], [cx, y - 6 - h], [cx - w * 0.1, y - 6]], c2, null); };
    cr(x - W * 0.6, H * 0.55, W * 0.4, '#b91c1c', '#ef4444'); cr(x + W * 0.6, H * 0.65, W * 0.42, '#b91c1c', '#ef4444'); cr(x, H, W * 0.6, '#dc2626', '#f87171');
    PX.lineaPix(g, x - 2, y - 10, x - 2, y - 6 - H * 0.85, '#fee2e2', 1);
    if (liga || Math.floor(t * 3 + e.x) % 5 === 0) PX.disco(g, px(x), px(y - 6 - H * 0.6), 2.5, '#ffffff');
    if (fx && (liga ? ale() < 0.6 : ale() < 0.08)) fx.add({ x: x + entre(-W, W) * 0.6, y: y - entre(10, H), vx: entre(-20, 20), vy: -entre(20, 60), g: 0, size: entre(1.4, 2.4), life: 0.5, color: CRISTAL[Math.floor(ale() * 3)], forma: 'sq' });
  },
  hyperVoice(g, e, t) { if (!e.vivo) return; g.globalAlpha = 0.5; for (let i = 0; i < 3; i++) { const f = ((t * 3 + i / 3) % 1), r = e.R * f; g.strokeStyle = e.mega ? OURO[i] : '#f8fafc'; g.lineWidth = 2; g.beginPath(); g.ellipse(px(e.x), px(e.y - 14), r, r * 0.62, 0, e.ang - e.abre / 2, e.ang + e.abre / 2); g.stroke(); } g.globalAlpha = 1; },
  nuvemNegra(g, e, t, fx) {
    const al = Math.min(1, e.t * 3, (e.dur - e.t) * 2), R = e.radio, cy = e.y - 110;
    g.globalAlpha = al * 0.35; g.fillStyle = '#0b0a14'; g.beginPath(); g.ellipse(px(e.x), px(e.y), R, R * 0.62, 0, 0, 7); g.fill();
    g.globalAlpha = al;
    for (let i = 0; i < 14; i++) { const a = i * 0.45 + t * 0.6, rr = R * (0.2 + (i % 4) * 0.22), x = e.x + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.35; PX.disco(g, px(x), px(y), 16 + (i % 3) * 6, i % 2 ? '#1e1b4b' : '#312e81'); }
    for (let i = 0; i < 6; i++) { const a = i * 1.05 - t * 0.4, x = e.x + Math.cos(a) * R * 0.6, y = cy + 8 + Math.sin(a) * 10; PX.disco(g, px(x), px(y), 12, '#0f0d1f'); }
    if (Math.floor(t * 8) % 4 === 0) raioZig(g, e.x - R * 0.3, cy, e.x + R * 0.3, cy + 6, '#fde047', 1, t);
    if (fx && ale() < 0.3) fx.add({ x: e.x + entre(-R, R) * 0.7, y: cy + 16, vx: 0, vy: 160, g: 0, size: 1.4, life: 0.4, color: '#93c5fd', forma: 'sq' });
    g.globalAlpha = 1;
  },
});

// ---------------------------------------------------------------- reforços: Hyper Voice, descarga das torres e pulo do Slowbro
const SOM = ['#fde68a', '#ffffff', '#e2e8f0', '#facc15'];
Object.assign(EVENTOS_NOVOS, {
  ondaVoz(fx, e) {
    heroi(fx, 'ondaVoz', 0.45, { ...e });
    const bx = e.x + Math.cos(e.ang) * 16, by = e.y - 14 + Math.sin(e.ang) * 10;
    choque(fx, bx, by + 14, 14, e.mega ? '#facc15' : '#f8fafc');
    for (let i = 0; i < (e.mega ? 12 : 7); i++) { const a = e.ang + (ale() - 0.5) * e.abre, s = entre(180, 320); fx.add({ x: bx, y: by, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.62, g: 0, drag: 2, size: entre(1.6, 3), life: entre(0.3, 0.5), color: SOM[i % 4], forma: i % 3 ? 'sq' : 'chispa' }); }
    for (let i = 0; i < 2; i++) { const a = e.ang + (ale() - 0.5) * e.abre, r = e.R * entre(0.4, 1); fx.add({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r * 0.62, vx: Math.cos(a) * 60, vy: -40, g: 300, size: 2, life: 0.4, color: '#a8a29e', forma: 'sq' }); }
  },
  descargaTorre(fx, e) { faiscas(fx, e.x, e.y - 30, CRISTAL, 44, 380); cacos(fx, e.x, e.y - 20, CRISTAL, 16, 260); choque(fx, e.x, e.y, e.r, '#ef4444'); choque(fx, e.x, e.y, e.r * 1.25, '#fecaca'); choque(fx, e.x, e.y, e.r * 0.55, '#ffffff'); rachas(fx, e.x, e.y, e.r * 0.9, '#450a0a'); heroi(fx, 'descarga', 0.6, { x: e.x, y: e.y, r: e.r }); fx.debris?.(e.x, e.y, 'ROCK', 8); },
  puloConcha(fx, e) { faiscas(fx, e.l.x, e.l.y - 8, ['#f9a8d4', '#ec4899', '#ffffff'], 10, 160); },
  caiConcha(fx, e) { faiscas(fx, e.x, e.y - 8, ['#f9a8d4', '#ec4899', '#ffffff'], 22, 260); cacos(fx, e.x, e.y, ['#a8a29e', '#e2e8f0'], 12, 220); choque(fx, e.x, e.y, e.r, '#ec4899'); rachas(fx, e.x, e.y, e.r * 0.8, '#500724'); },
});
Object.assign(HEROES_NOVOS, {
  descarga(g, h, k, t) { const al = 1 - k; g.globalAlpha = al; for (let i = 0; i < 12; i++) { const a = i * 0.52 + Math.floor(t * 20) * 0.7; raioZig(g, h.x, h.y - 34, h.x + Math.cos(a) * h.r, h.y + Math.sin(a) * h.r * 0.62, '#7f1d1d', 4, i + t * 9); raioZig(g, h.x, h.y - 34, h.x + Math.cos(a) * h.r, h.y + Math.sin(a) * h.r * 0.62, i % 2 ? '#ef4444' : '#fecaca', 2, i + t * 9); } g.globalAlpha = al * 0.35; g.fillStyle = '#ef4444'; g.beginPath(); g.ellipse(px(h.x), px(h.y), h.r * (0.5 + k * 0.5), h.r * 0.62 * (0.5 + k * 0.5), 0, 0, 7); g.fill(); g.globalAlpha = 1; },
});
