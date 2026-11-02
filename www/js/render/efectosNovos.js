// Efeitos da última leva (Gengar, Gardevoir, Kangaskhan, Rayquaza, Zeraora e Darkrai): estilos de tiro,
// eventos do motor, desenhos de curta duração ("heróis") e as zonas no chão.
import * as PX from './pixelfx.js';

const px = v => Math.round(v);
const ale = Math.random;
const entre = (a, b) => a + ale() * (b - a);
const ROXO = ['#1a0830', '#4c1d95', '#8b5cf6', '#e9d5ff'];
const ROSA = ['#5b1440', '#db2777', '#f9a8d4', '#fff1f8'];
const RAIO = ['#5a3a00', '#facc15', '#fef08a', '#ffffff'];

// raio em zigue-zague entre dois pontos (o mesmo desenho a cada quadro de um sorteio fixo)
function raio(g, x0, y0, x1, y1, semente, cor = '#fde047', w = 2, nos = 7) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const pts = [[x0, y0]];
  for (let i = 1; i < nos; i++) { const f = i / nos, v = Math.sin(semente * 12.9 + i * 78.2) * 43758.5; const off = (v - Math.floor(v) - 0.5) * Math.min(26, L * 0.25); pts.push([x0 + dx * f + nx * off, y0 + dy * f + ny * off]); }
  pts.push([x1, y1]);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [c, lw, a] of [[cor, w + 4, 0.3], [cor, w + 1, 0.85], ['#ffffff', Math.max(1, w - 1), 1]]) {
    g.globalAlpha *= a; g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.globalAlpha /= a;
  }
  g.lineCap = 'butt'; g.lineJoin = 'miter';
}

// ---------------------------------------------------------------- estilos de tiro
export const ESTILOS_NOVOS = {
  // bola de sombra: núcleo escuro com olhos que piscam e fumaça roxa atrás
  sombra(g, p, t) {
    const x = p.x, y = p.y - p.alt, r = 4 * (p.escala ?? 1);
    for (let i = 1; i <= 4; i++) { g.globalAlpha = 0.35 - i * 0.07; PX.disco(g, px(x - Math.cos(p.ang) * i * 5), px(y - Math.sin(p.ang) * i * 4 + Math.sin(t * 14 + i) * 1.5), r * (1 - i * 0.15), '#6d28d9'); }
    g.globalAlpha = 0.4; PX.disco(g, px(x), px(y), r + 3, '#7c3aed'); g.globalAlpha = 1;
    PX.esfera(g, px(x), px(y), r, ['#0b0418', '#2e1065', '#7c3aed', '#c4b5fd']);
    if (Math.floor(t * 6) % 5) { g.fillStyle = '#f0abfc'; g.fillRect(px(x - 2), px(y - 1), 1, 1); g.fillRect(px(x + 1), px(y - 1), 1, 1); }
  },
  // Hex: olho roxo girando com runas em volta
  hex(g, p, t) {
    const x = p.x, y = p.y - p.alt, r = 4 * (p.escala ?? 1);
    g.globalAlpha = 0.5; PX.anilloPix(g, px(x), px(y), r + 5, (r + 5) * 0.8, '#c084fc', 1, 3, Math.floor(t * 18)); g.globalAlpha = 1;
    PX.esfera(g, px(x), px(y), r, ['#2a0a3a', '#7e22ce', '#d8b4fe', '#ffffff']);
    g.fillStyle = '#1a0830'; g.fillRect(px(x - 1), px(y - r * 0.6), 2, Math.max(2, px(r * 1.2)));
    for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.09; PX.disco(g, px(x + Math.cos(a) * (r + 5)), px(y + Math.sin(a) * (r + 5) * 0.8), 1, '#f5d0fe'); }
  },
  // Moonblast: lua cheia rosada com halo e estrelinhas
  luna(g, p, t) {
    const x = p.x, y = p.y - p.alt, r = 4 * (p.escala ?? 1);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35; PX.disco(g, px(x), px(y), r * 1.9, '#f472b6'); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    PX.esfera(g, px(x), px(y), r, ['#9d174d', '#f9a8d4', '#fff1f8', '#ffffff']);
    PX.disco(g, px(x + r * 0.3), px(y + r * 0.2), Math.max(1, r * 0.22), '#fbcfe8');
    for (let i = 0; i < 3; i++) { const a = -t * 4 + i * 2.09; PX.carimbar(g, PX.chispa(2, '#ffffff'), x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6), 0, 1, 0.9); }
  },
  // Air Slash: lâmina de ar em meia-lua, verde-clara
  aire(g, p, t) {
    const x = p.x, y = p.y - p.alt, s = p.escala ?? 1;
    g.save(); g.translate(px(x), px(y)); g.rotate(p.ang);
    for (const [c, k, a] of [['#86efac', 1.25, 0.35], ['#dcfce7', 1, 0.9], ['#ffffff', 0.6, 1]]) { g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = 2.5 * k; g.beginPath(); g.arc(-4 * s, 0, 8 * s, -1.1, 1.1); g.stroke(); }
    g.restore(); g.globalAlpha = 1;
  },
  // Volt Switch: bola de plasma azul-amarela com faíscas
  plasma(g, p, t) {
    const x = p.x, y = p.y - p.alt, r = 4 * (p.escala ?? 1);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.4; PX.disco(g, px(x), px(y), r * 2, '#60a5fa'); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    PX.esfera(g, px(x), px(y), r, ['#1e3a8a', '#3b82f6', '#fde047', '#ffffff']);
    g.save(); g.globalAlpha = 0.9;
    for (let i = 0; i < 2; i++) { const a = ale() * 6.28, b = a + entre(0.5, 1.2); raio(g, x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(b) * r * 2.4, y + Math.sin(b) * r * 2.4, t * 30 + i, '#fde047', 1, 3); }
    g.restore();
  },
  // Dark Void: esfera de vazio que suga a luz em espiral
  vazio(g, p, t) {
    const x = p.x, y = p.y - p.alt, r = 4 * (p.escala ?? 1);
    for (let i = 0; i < 10; i++) { const f = (t * 1.4 + i / 10) % 1, a = i * 0.63 + t * 5, d = r * (2.6 - f * 1.8); g.globalAlpha = f * 0.8; PX.disco(g, px(x + Math.cos(a) * d), px(y + Math.sin(a) * d * 0.8), 1, i % 2 ? '#a78bfa' : '#e11d48'); }
    g.globalAlpha = 0.45; PX.disco(g, px(x), px(y), r + 3, '#4c1d95'); g.globalAlpha = 1;
    PX.disco(g, px(x), px(y), r + 1, '#04010a'); PX.disco(g, px(x), px(y), r, '#0b0418');
    PX.anilloPix(g, px(x), px(y), r, r, '#e11d48', 1, 0);
  },
  // Dream Eater: bolha de sonho rosa e lilás que balança
  sueno(g, p, t) {
    const x = p.x, y = p.y - p.alt + Math.sin(t * 10) * 1.5, r = 4 * (p.escala ?? 1);
    for (let i = 1; i <= 3; i++) { g.globalAlpha = 0.3 - i * 0.07; PX.disco(g, px(x - Math.cos(p.ang) * i * 6), px(y - Math.sin(p.ang) * i * 4), r * (1 - i * 0.2), '#f0abfc'); }
    g.globalAlpha = 1; PX.carimbar(g, PX.burbuja(Math.round(r + 1), '#f5d0fe'), x, y, 0, 1, 1);
    PX.disco(g, px(x), px(y), Math.max(1, r * 0.4), '#a78bfa');
  },
  // filhote da Kangaskhan: ondinha de soco amarela
  eco(g, p, t) {
    const x = p.x, y = p.y - p.alt;
    g.save(); g.translate(px(x), px(y)); g.rotate(p.ang);
    for (const [c, k] of [['#92400e', 1.2], ['#fbbf24', 1], ['#fef3c7', 0.55]]) { g.strokeStyle = c; g.lineWidth = 2 * k; g.beginPath(); g.arc(-3, 0, 5 * k + 1, -1, 1); g.stroke(); }
    g.restore();
  },
};

// ---------------------------------------------------------------- eventos do motor
export const EVENTOS_NOVOS = {
  posesion(fx, e) { fx.humo(e.l.x, e.l.y - 10, 6, 'rgba(76,29,149,0.6)', 10); fx.anillo(e.b.x, e.b.y, 4, 34, '#8b5cf6', 0.4, 2); for (let i = 0; i < 10; i++) fx.add({ x: e.l.x, y: e.l.y - 12, vx: (e.b.x - e.l.x) * 3 + entre(-40, 40), vy: (e.b.y - e.l.y) * 3 + entre(-40, 10), drag: 3, size: entre(2, 3.5), grow: 2, life: 0.35, forma: 'llama', rampa: ROXO }); },
  sombraSale(fx, e) { fx.heroes.push({ k: 'garraSombra', x: e.l.x, y: e.l.y, ang: e.l.angulo, t: 0, life: 0.45, hue: fx.hue }); fx.humo(e.l.x, e.l.y - 8, 5, 'rgba(76,29,149,0.6)', 10); fx.flash = Math.max(fx.flash, 0.06); fx.flashColor = '#c4b5fd'; },
  reinoSombras(fx, e) { fx.anillo(e.x, e.y, 10, e.radio * 1.2, '#a78bfa', 0.5, 3); fx.flash = Math.max(fx.flash, 0.1); fx.flashColor = '#4c1d95'; for (let i = 0; i < 18; i++) { const a = (i / 18) * 6.28; fx.add({ x: e.x + Math.cos(a) * 10, y: e.y + Math.sin(a) * 6, vx: Math.cos(a) * 180, vy: Math.sin(a) * 110, drag: 3, size: 3, grow: 3, life: 0.5, forma: 'llama', rampa: ROXO }); } },
  vinculo(fx, e) { fx.anillo(e.b.x, e.b.y, 4, 30, e.modo === 'aliado' ? '#86efac' : '#f472b6', 0.4, 2); fx.anillo(e.l.x, e.l.y, 4, 30, '#f9a8d4', 0.4, 2); },
  vinculoRompe(fx, e) { fx.chispas((e.l.x + e.b.x) / 2, (e.l.y + e.b.y) / 2 - 20, '#f9a8d4', 8, 160); },
  vinculoDor(fx, e) { fx.heroes.push({ k: 'pulsoVinculo', l: e.l, b: e.b, t: 0, life: 0.3, hue: fx.hue }); },
  teletransporte(fx, e) { fx.heroes.push({ k: 'fantasmaTele', x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, l: e.l, t: 0, life: 0.45, hue: fx.hue }); for (const [x, y] of [[e.x0, e.y0], [e.x1, e.y1]]) { fx.anillo(x, y, 3, 24, '#f9a8d4', 0.3, 2); for (let i = 0; i < 8; i++) fx.add({ x: x + entre(-10, 10), y: y - entre(0, 30), vy: -entre(20, 60), size: 2, life: 0.5, color: i % 2 ? '#f9a8d4' : '#ffffff', forma: 'chispa' }); } },
  campoFada(fx, e) { fx.anillo(e.x, e.y, 10, e.radio, '#f9a8d4', 0.5, 3); for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.28; fx.add({ x: e.x + Math.cos(a) * e.radio * 0.5, y: e.y + Math.sin(a) * e.radio * 0.3, vy: -entre(40, 90), size: entre(4, 6), life: 0.8, forma: 'corazon' }); } },
  guardia(fx, e) { fx.heroes.push({ k: 'guardia', l: e.l, t: 0, life: e.dur, hue: fx.hue }); },
  contragolpe(fx, e) { const x = e.perto ? (e.l.x + e.b.x) / 2 : e.l.x, y = (e.perto ? (e.l.y + e.b.y) / 2 : e.l.y) - e.l.alto * 0.5; fx.add({ x, y, size: 30, life: 0.3, color: '#ffffff', brillo: '#fbbf24', forma: 'estouro' }); fx.anillo(x, y + 10, 6, 54, '#fbbf24', 0.35, 3); fx.chispas(x, y, '#fde68a', 12, 260); fx.temblor = Math.max(fx.temblor, 6); fx.flash = Math.max(fx.flash, 0.08); fx.flashColor = '#fff7d6'; },
  deltaStream(fx, e) { fx.heroes.push({ k: 'deltaEntrada', x: e.x, y: e.y, ang: e.ang, faixas: e.faixas, t: 0, life: 0.6, hue: fx.hue }); fx.flash = Math.max(fx.flash, 0.1); fx.flashColor = '#bbf7d0'; },
  desvio(fx, e) { fx.add({ x: e.x, y: e.y, size: 10, life: 0.2, color: '#ffffff', brillo: '#86efac', forma: 'estouro' }); for (let i = 0; i < 5; i++) fx.add({ x: e.x, y: e.y, vx: entre(-90, 90), vy: entre(-90, 30), drag: 3, size: 2, life: 0.35, color: '#dcfce7', forma: 'chispa' }); },
  voltTeleporte(fx, e) { fx.heroes.push({ k: 'rastroRaio', x0: e.x0, y0: e.y0 - 16, x1: e.x1, y1: e.y1 - 16, semente: ale() * 99, t: 0, life: 0.3, hue: fx.hue }); fx.anillo(e.x1, e.y1, 4, 40, '#fde047', 0.3, 2); fx.chispas(e.x1, e.y1 - 14, '#fef08a', 10, 240); },
  raioCadeia(fx, e) { fx.heroes.push({ k: 'rastroRaio', x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, semente: ale() * 99, t: 0, life: 0.25, grosso: e.i === 0, hue: fx.hue }); fx.chispas(e.x1, e.y1, '#fef08a', 6, 200); fx.add({ x: e.x1, y: e.y1, size: 14, life: 0.2, color: '#ffffff', brillo: '#facc15', forma: 'estouro' }); },
  plasmaCarga(fx, e) { fx.anillo(e.l.x, e.l.y, 4, 46, '#fde047', 0.35, 3); fx.flash = Math.max(fx.flash, 0.08); fx.flashColor = '#fef9c3'; },
  plasmaGolpe(fx, e) { fx.heroes.push({ k: 'rastroRaio', x0: e.x0, y0: e.y0 - 16, x1: e.x1, y1: e.y1 - 16, semente: ale() * 99, t: 0, life: 0.22, grosso: true, hue: fx.hue }); fx.add({ x: e.bx, y: e.by, size: e.final ? 34 : 18, life: 0.25, color: '#ffffff', brillo: '#facc15', forma: 'estouro' }); fx.chispas(e.bx, e.by, '#fde047', e.final ? 16 : 6, e.final ? 320 : 200); if (e.final) { fx.anillo(e.bx, e.by + 12, 6, 60, '#fde047', 0.35, 3); fx.flash = Math.max(fx.flash, 0.12); fx.flashColor = '#fef9c3'; } },
  nocheEterna(fx, e) { fx.flash = Math.max(fx.flash, 0.25); fx.flashColor = '#1a0830'; fx.anillo(e.l.x, e.l.y, 10, 160, '#7c3aed', 0.6, 3); for (let i = 0; i < 20; i++) { const a = (i / 20) * 6.28; fx.add({ x: e.l.x, y: e.l.y - 20, vx: Math.cos(a) * 220, vy: Math.sin(a) * 140, drag: 2.5, size: 3.5, grow: 3, life: 0.6, forma: 'llama', rampa: ['#04010a', '#2e1065', '#be123c', '#fda4af'] }); } },
  despertar(fx, e) { fx.add({ x: e.l.x, y: e.l.y - e.l.alto * 0.6, size: 16, life: 0.25, color: '#fda4af', brillo: '#7c3aed', forma: 'estouro' }); },
  ecoFilhote(fx, e) { const x = e.l.x + Math.cos(e.ang) * 22, y = e.l.y + Math.sin(e.ang) * 14 - e.l.alto * 0.45; fx.heroes.push({ k: 'punhoFilhote', x, y, ang: e.ang, perto: e.perto, t: 0, life: 0.22, hue: fx.hue }); },
  plasmaCheio(fx, e) { fx.anillo(e.l.x, e.l.y, 4, 30, '#fde047', 0.4, 2); fx.chispas(e.l.x, e.l.y - e.l.alto * 0.5, '#fef08a', 8, 160); },
  sobrecargaPlasma(fx, e) { fx.anillo(e.l.x, e.l.y, 6, 44, '#facc15', 0.35, 3); fx.flash = Math.max(fx.flash, 0.08); fx.flashColor = '#fef9c3'; },
};

// ---------------------------------------------------------------- desenhos curtos
export const HEROES_NOVOS = {
  // Gengar saindo da sombra: mão-garra roxa subindo do chão
  garraSombra(g, h, k, t) {
    const al = 1 - k, sobe = Math.min(1, t / 0.12) * 30;
    g.globalAlpha = al * 0.5; PX.elipsePix(g, h.x, h.y, 22, 8, '#2e1065');
    g.globalAlpha = al;
    for (let i = -1; i <= 1; i++) {
      g.fillStyle = i ? '#6d28d9' : '#8b5cf6'; g.beginPath();
      g.moveTo(h.x + i * 8 - 4, h.y); g.quadraticCurveTo(h.x + i * 9, h.y - sobe * 0.6, h.x + i * 12 + 2, h.y - sobe - (i ? 0 : 6)); g.lineTo(h.x + i * 8 + 4, h.y); g.fill();
    }
    g.globalAlpha = 1;
  },
  // eco do vínculo: um pulso rosa correndo pela corrente até o rival
  pulsoVinculo(g, h, k) {
    const a = h.l, b = h.b, f = k, x = a.x + (b.x - a.x) * f, y = a.y - a.alto * 0.5 + (b.y - b.alto * 0.5 - a.y + a.alto * 0.5) * f;
    g.globalAlpha = 1 - k * 0.5; PX.disco(g, x, y, 4, '#f472b6'); PX.disco(g, x, y, 2, '#ffffff'); g.globalAlpha = 1;
  },
  // Teleport: silhueta rosa que some na saída e risco de luz até a chegada
  fantasmaTele(g, h, k) {
    g.globalAlpha = (1 - k) * 0.6; g.strokeStyle = '#f9a8d4'; g.lineWidth = 2; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(h.x0, h.y0 - 16); g.lineTo(h.x1, h.y1 - 16); g.stroke(); g.setLineDash([]);
    g.globalAlpha = (1 - k) * 0.5; PX.elipsePix(g, h.x0, h.y0 - 16 - k * 12, 9, 16, '#fbcfe8');
    g.globalAlpha = 1;
  },
  guardia(g, h, k, t) {
    const l = h.l, cx = l.x + Math.cos(l.angulo ?? 0) * 12, cy = l.y - l.alto * 0.5, pul = 1 + Math.sin(t * 20) * 0.05;
    if (!l.est.contra) return;
    g.globalAlpha = 0.25; PX.disco(g, cx, cy, 20 * pul, '#fde68a');
    g.globalAlpha = 0.9; PX.anilloPix(g, cx, cy, 20 * pul, 22 * pul, '#fbbf24', 2, 6, Math.floor(t * 20));
    g.globalAlpha = 1;
  },
  punhoFilhote(g, h, k) {
    const al = 1 - k, x = h.x + Math.cos(h.ang) * k * 10, y = h.y + Math.sin(h.ang) * k * 6;
    g.globalAlpha = al; PX.disco(g, x, y, 4, '#92400e'); PX.disco(g, x, y, 3, '#d6a35c'); PX.disco(g, x - 1, y - 1, 1, '#fde68a');
    if (h.perto) { g.globalAlpha = al * 0.8; PX.anilloPix(g, x, y, 6 + k * 10, 5 + k * 8, '#fbbf24', 1, 0); }
    g.globalAlpha = 1;
  },
  rastroRaio(g, h, k) {
    g.save(); g.globalAlpha = 1 - k; raio(g, h.x0, h.y0, h.x1, h.y1, h.semente + Math.floor(k * 4), '#facc15', h.grosso ? 3 : 2, 8); g.restore();
  },
  // Delta Stream entrando: três rajadas verdes cruzando a arena
  deltaEntrada(g, h, k) {
    const ca = Math.cos(h.ang), sa = Math.sin(h.ang), L = 520 * Math.min(1, k * 2.5);
    g.save(); g.globalAlpha = (1 - k) * 0.8; g.lineCap = 'round';
    for (const o of h.faixas) { const x = h.x - sa * o, y = h.y + ca * o; g.strokeStyle = '#bbf7d0'; g.lineWidth = 6; g.beginPath(); g.moveTo(x - ca * 40, y - sa * 40); g.lineTo(x + ca * L, y + sa * L); g.stroke(); }
    g.restore();
  },
};

// ---------------------------------------------------------------- zonas no chão
export const ENTIDADES_NOVAS = {
  // Phantom Realm: cúpula de sombra com borda de chama roxa e olhos abrindo no chão
  reino(g, e, t, fx) {
    const al = Math.min(1, e.t * 3, (e.dur - e.t) / 0.4), R = e.radio;
    g.globalAlpha = al * 0.32; PX.elipsePix(g, px(e.x), px(e.y), R, R * 0.62, '#1a0830');
    g.globalAlpha = al * 0.25; PX.elipsePix(g, px(e.x), px(e.y), R * 0.75, R * 0.46, '#2e1065');
    g.globalAlpha = al * 0.85; PX.anilloPix(g, px(e.x), px(e.y), R, R * 0.62, '#8b5cf6', 2, 6, Math.floor(t * 10));
    for (let i = 0; i < 10; i++) { const a = i * 0.628 + t * 0.8, x = e.x + Math.cos(a) * R, y = e.y + Math.sin(a) * R * 0.62; g.globalAlpha = al; PX.carimbar(g, PX.llama(Math.floor(t * 12 + i), 6, ROXO), x, y - 5, 0, 1, 0.9); }
    for (let i = 0; i < 4; i++) { const a = i * 1.7 + 0.4, d = R * (0.3 + (i % 2) * 0.3), x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d * 0.62, abre = Math.max(0, Math.sin(t * 2 + i * 1.3)); if (abre < 0.2) continue; g.globalAlpha = al * abre; PX.elipsePix(g, px(x), px(y), 5, 2 * abre, '#f0abfc'); PX.disco(g, px(x), px(y), 1, '#1a0830'); }
    g.globalAlpha = 1;
    if (ale() < 0.3) fx.add({ x: e.x + entre(-R, R) * 0.8, y: e.y + entre(-R, R) * 0.45, vy: -entre(20, 50), size: 3, grow: 2, life: 0.6, forma: 'llama', rampa: ROXO });
  },
  // Misty Terrain: névoa rosa, flores de luz e corações subindo
  campoFada(g, e, t, fx) {
    const al = Math.min(1, e.t * 3, (e.dur - e.t) / 0.4), R = e.radio;
    g.globalAlpha = al * 0.22; PX.elipsePix(g, px(e.x), px(e.y), R, R * 0.62, '#f9a8d4');
    g.globalAlpha = al * 0.6; PX.anilloPix(g, px(e.x), px(e.y), R, R * 0.62, '#fbcfe8', 2, 8, Math.floor(t * 6));
    for (let i = 0; i < 8; i++) { const a = i * 0.785 - t * 0.6, d = R * 0.7, x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d * 0.62; g.globalAlpha = al * 0.35; PX.carimbar(g, PX.humo(10, ['#f9a8d4', '#fbcfe8', '#fff1f8']), x, y - 6, 0, 1, 0.6); g.globalAlpha = al; PX.disco(g, px(x), px(y - 2), 1.5, '#ffffff'); }
    g.globalAlpha = 1;
    if (ale() < 0.15) fx.add({ x: e.x + entre(-R, R) * 0.7, y: e.y + entre(-R, R) * 0.4, vy: -entre(25, 45), size: 4, life: 0.9, forma: 'corazon' });
  },
  // Delta Stream: três faixas de vento verde correndo, com riscos e folhas de ar
  delta(g, e, t, fx) {
    const al = Math.min(1, e.t * 4, (e.dur - e.t) / 0.4), ca = Math.cos(e.ang), sa = Math.sin(e.ang), L = 640;
    g.save(); g.lineCap = 'round';
    for (const o of e.faixas) {
      const x0 = e.x - sa * o - ca * 120, y0 = e.y + ca * o - sa * 120;
      g.globalAlpha = al * 0.22; g.strokeStyle = '#4ade80'; g.lineWidth = e.larg * 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + ca * L, y0 + sa * L); g.stroke();
      g.globalAlpha = al * 0.35; g.strokeStyle = '#bbf7d0'; g.lineWidth = 2; for (const lado of [-1, 1]) { g.beginPath(); g.moveTo(x0 - sa * e.larg * lado, y0 + ca * e.larg * lado); g.lineTo(x0 + ca * L - sa * e.larg * lado, y0 + sa * L + ca * e.larg * lado); g.stroke(); }
      for (let i = 0; i < 7; i++) { const f = (t * 1.6 + i / 7) % 1, x = x0 + ca * L * f, y = y0 + sa * L * f, lat = Math.sin(i * 2.3) * e.larg * 0.6; g.globalAlpha = al * 0.9; g.strokeStyle = i % 2 ? '#dcfce7' : '#ffffff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - sa * lat, y + ca * lat); g.lineTo(x - sa * lat - ca * 26, y + ca * lat - sa * 26); g.stroke(); }
    }
    g.restore(); g.globalAlpha = 1;
  },
};
