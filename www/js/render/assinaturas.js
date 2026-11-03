// Assinaturas dos golpes: as camadas que cada skill ganha por cima do desenho de base. Toda assinatura segue as mesmas
// regras: até 5 tons da paleta do tipo (núcleo quase branco, borda escura), três camadas (núcleo, brilho em volta e
// partículas soltas), antecipação antes do golpe e um fim que some devagar. Só desenho: nada aqui muda a luta.
import * as PX from './pixelfx.js';
import { pal, NUCLEO, CLARO, BASE, SOMBRA, BORDA, CONTORNO, IMPACTO, FUMACA } from './paletas.js';

const ale = Math.random;
const entre = (a, b) => a + ale() * (b - a);
// pedaço de risco em zigue-zague fixo (mesmo desenho a cada quadro): sorteio pela semente
const sorteio = (s, i) => { const v = Math.sin(s * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };

// o golpe final (tajo) e a queda do chute não dizem qual skill foi: guarda a última de cada lutador
const ATUAL = new WeakMap();

// ---------------------------------------------------------------- entradas (chamadas por Efectos.consumir)
export function assinatura(fx, e) {
  const { l, h } = e;
  if (!l || !h) return;
  ATUAL.set(l, h);
  (INICIO[h.nombre] ?? INICIO_FORMA[h.forma])?.(fx, l, h, e);
}
export function golpeAssinado(fx, e) {
  if (!e.final || !e.l) return;
  const h = ATUAL.get(e.l);
  (GOLPE[h?.nombre] ?? GOLPE_ESTILO[e.estilo])?.(fx, e, h);
}
// a queda de todo chute (forma patada) chega como um pulso no ponto onde o lutador pousou
export function aterrissagem(fx, e, luta) {
  const l = luta?.luchadores.find(x => Math.abs(x.x - e.x) < 2 && Math.abs(x.y - e.y) < 2);
  queda(fx, e, l ? ATUAL.get(l) : null);
}

// ---------------------------------------------------------------- começo das skills
const INICIO = {
  // Focus Punch: concentra a força no punho antes de soltar
  'Focus Punch'(fx, l, h) { fx.heroes.push({ k: 'focoCarga', l, tipo: h.tipo, fx, t: 0, life: (h.segurar ?? 0) + (h.lanzar ?? 0.14) + 0.06, hue: fx.hue }); },
  // Sucker Punch: some numa nuvem escura e reaparece já batendo
  'Sucker Punch'(fx, l, h) { nuvemSombra(fx, l, h.tipo); },
  'Mind Reader'(fx, l, h) { fx.heroes.push({ k: 'leitura', l, tipo: h.tipo, t: 0, life: 0.4, hue: fx.hue }); },
  'Lock-On'(fx, l, h) { fx.heroes.push({ k: 'leitura', l, tipo: h.tipo, t: 0, life: 0.4, hue: fx.hue }); },
};
const INICIO_FORMA = {
  // todo chute: agacha levantando poeira, e o salto deixa um rastro em três camadas
  patada(fx, l, h) {
    fx.anillo(l.x, l.y, 3, 20, FUMACA[CLARO], 0.3, 1);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; fx.add({ x: l.x + Math.cos(a) * 6, y: l.y, vx: Math.cos(a) * entre(70, 120), vy: Math.sin(a) * 30 - 10, drag: 4, size: entre(3, 5), grow: 6, life: 0.4, color: FUMACA[i % 2 ? CLARO : BASE], forma: 'circulo' }); }
    fx.heroes.push({ k: 'rastroSalto', l, tipo: h.tipo, pts: [], t: 0, life: 1.2, hue: fx.hue });
  },
};

// ---------------------------------------------------------------- o golpe que acerta (fim do tajo)
const GOLPE = {
  'Focus Punch'(fx, e) { socoFoco(fx, e, 1.35); },
  'Sucker Punch'(fx, e) { rasgoSombra(fx, e, 1.2); },
};
const GOLPE_ESTILO = {
  aura(fx, e) { socoFoco(fx, e, 0.8); },
  sombra(fx, e) { rasgoSombra(fx, e, 0.85); },
};

function socoFoco(fx, e, forca) {
  const l = e.l, a = e.ang, x = l.x + Math.cos(a) * 16, y = l.y - l.alto * 0.5 + Math.sin(a) * 9, p = pal(e.tipo);
  fx.heroes.push({ k: 'socoFoco', x, y, ang: a, forca, tipo: e.tipo, t: 0, life: 0.34 + forca * 0.1, hue: fx.hue });
  fx.rafagaDir(x, y, e.tipo, Math.round(10 * forca), 260 * forca, a, 0.45);
  for (let i = 0; i < 8; i++) { const an = a + entre(-0.3, 0.3), s = entre(420, 620) * forca; fx.add({ x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s * 0.7, drag: 8, size: 1, life: 0.16, color: i % 2 ? p[NUCLEO] : p[CLARO], forma: 'raya' }); }
  fx.temblor = Math.max(fx.temblor, 2 + forca * 2.5);
  fx.punch = Math.max(fx.punch ?? 0, 0.02 * forca);
  if (forca > 1) { fx.flash = Math.max(fx.flash, 0.16); fx.flashColor = p[NUCLEO]; }
}

function rasgoSombra(fx, e, forca) {
  const l = e.l, a = e.ang, d = (e.alcance ?? 30) * 0.75, x = l.x + Math.cos(a) * d, y = l.y - l.alto * 0.5 + Math.sin(a) * d * 0.7, p = pal(e.tipo);
  fx.heroes.push({ k: 'rasgoSombra', x, y, ang: a, forca, tipo: e.tipo, semilla: ale() * 99, t: 0, life: 0.42, hue: fx.hue });
  for (let i = 0; i < Math.round(9 * forca); i++) { const an = a + entre(-0.6, 0.6), s = entre(120, 260); fx.add({ x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s * 0.6 - 20, drag: 4, size: entre(2, 4), grow: 5, life: 0.45, color: p[i % 2 ? SOMBRA : BORDA], forma: 'circulo' }); }
  fx.chispas(x, y, p[CLARO], 5, 260);
  fx.temblor = Math.max(fx.temblor, 2 + forca * 2);
}

function nuvemSombra(fx, l, tipo) {
  const p = pal(tipo), y = l.y - l.alto * 0.45;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; fx.add({ x: l.x + Math.cos(a) * 5, y: y + Math.sin(a) * 4, vx: Math.cos(a) * entre(60, 110), vy: Math.sin(a) * 50 - 15, drag: 4, size: entre(3, 5), grow: 7, life: 0.4, color: p[i % 3 ? SOMBRA : BORDA], forma: 'circulo' }); }
  for (let i = 0; i < 4; i++) fx.add({ x: l.x + entre(-8, 8), y: y + entre(-8, 8), vy: -30, size: 2, life: 0.3, color: p[CLARO], forma: 'chispa' });
}

// a queda do chute: anel no chão, rachaduras, poeira subindo e pedrinhas; o chute pesado sacode mais e o escuro marca um X
function queda(fx, e, h) {
  const nome = h?.nombre ?? '', pesado = /Heavy Slam|Body Slam|High Jump Kick/.test(nome), forca = pesado ? 1.35 : 1, x = e.x, y = e.y, p = pal(e.tipo);
  fx.heroes.push({ k: 'impactoChute', x, y, r: (e.radio ?? 30) * forca, tipo: e.tipo, semilla: ale() * 99, t: 0, life: 0.6, hue: fx.hue });
  fx.add({ x, y: y - 8, size: 12 * forca, life: 0.26, fija: true, color: p[NUCLEO], brillo: p[CLARO], forma: 'estouro' });
  for (let i = 0; i < Math.round(10 * forca); i++) { const a = (i / (10 * forca)) * Math.PI * 2 + entre(-0.2, 0.2); fx.add({ x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 3, vx: Math.cos(a) * entre(90, 170) * forca, vy: Math.sin(a) * 40 - entre(10, 40), drag: 3.5, size: entre(4, 6), grow: 8, life: 0.55, color: FUMACA[i % 2 ? CLARO : BASE], forma: 'circulo' }); }
  for (let i = 0; i < Math.round(6 * forca); i++) { const a = ale() * Math.PI * 2, s = entre(60, 150); fx.add({ x, y: y - 3, vx: Math.cos(a) * s, vy: -entre(140, 240), g: 560, drag: 1, size: entre(2, 3.5), life: 0.7, forma: 'roca', vr: entre(-12, 12) }); }
  fx.temblor = Math.max(fx.temblor, 3 + forca * 2);
  if (e.tipo === 'DARK') fx.heroes.push({ k: 'marcaX', x, y: y - 14, tipo: e.tipo, t: 0, life: 0.45, hue: fx.hue });
}

// ---------------------------------------------------------------- desenhos de curta duração ("heróis")
export const HEROES_ASSINATURA = {
  // carga do Focus Punch: brilho em degraus crescendo no punho, três arcos fechando e faíscas sugadas para dentro
  focoCarga(g, h, k, t) {
    const l = h.l, a = l.angulo ?? 0, x = l.x + Math.cos(a) * 14, y = l.y - l.alto * 0.5 + Math.sin(a) * 6 - (l.salto ?? 0), p = pal(h.tipo);
    PX.brilhoDegrau(g, x, y, 5 + k * 10, p, 0.9);
    const r = 6 + (1 - k) * 22;
    for (let i = 0; i < 3; i++) {
      const a0 = t * 14 + (i * Math.PI * 2) / 3;
      PX.arcoPix(g, x, y, r, a0, a0 + 1.1, CONTORNO, 4, r * 0.75);
      PX.arcoPix(g, x, y, r, a0, a0 + 1.1, p[BASE], 2, r * 0.75);
      PX.arcoPix(g, x, y, r, a0 + 0.2, a0 + 0.9, p[NUCLEO], 1, r * 0.75);
    }
    PX.disco(g, x, y, 2 + k * 2 + (Math.floor(t * 30) % 2), p[NUCLEO]);
    if (ale() < 0.9) { const an = ale() * Math.PI * 2, d = entre(20, 30); h.fx.add({ x: x + Math.cos(an) * d, y: y + Math.sin(an) * d * 0.7, vx: -Math.cos(an) * 70, vy: -Math.sin(an) * 50, drag: -2, size: 1.5, life: 0.22, fija: true, color: p[ale() < 0.5 ? CLARO : NUCLEO], forma: 'sq' }); }
  },
  // o soco solto: riscos de velocidade atrás do punho, onda de choque em lua abrindo para a frente e clarão no contato
  socoFoco(g, h, k) {
    const p = pal(h.tipo), a = h.ang, f = h.forca, ca = Math.cos(a), sa = Math.sin(a) * 0.7;
    const al = k < 0.6 ? 1 : k < 0.85 ? 0.6 : 0.3, a0 = g.globalAlpha;
    g.globalAlpha = a0 * al;
    if (k < 0.5) {
      const L = 34 * f * (1 - k * 1.4);
      for (let i = -2; i <= 2; i++) { const nx = -sa * i * 4, ny = ca * i * 3; PX.lineaPix(g, h.x + nx, h.y + ny, h.x - ca * L * (1 - Math.abs(i) * 0.18) + nx, h.y - sa * L * (1 - Math.abs(i) * 0.18) + ny, i ? p[CLARO] : p[NUCLEO], i ? 1 : 2); }
    }
    if (k < 0.3) PX.brilhoDegrau(g, h.x, h.y, 16 * f * (1 - k * 2), IMPACTO, 1);
    for (const [atraso, escala] of [[0, 1], [0.12, 0.7]]) {
      const u = Math.max(0, k - atraso) / (1 - atraso);
      if (u <= 0) continue;
      const r = (8 + u * 34) * f * escala, cx = h.x + ca * u * 20 * f, cy = h.y + sa * u * 20 * f, gro = Math.max(1, Math.round(4 * (1 - u)));
      PX.arcoPix(g, cx, cy, r, a - 1.15, a + 1.15, CONTORNO, gro + 2, r * 0.8);
      PX.arcoPix(g, cx, cy, r, a - 1.1, a + 1.1, p[u < 0.5 ? CLARO : BASE], gro + 1, r * 0.8);
      PX.arcoPix(g, cx, cy, r, a - 0.8, a + 0.8, p[NUCLEO], Math.max(1, gro - 1), r * 0.8);
    }
    g.globalAlpha = a0;
  },
  // rasgo de sombra: um corte serrilhado atravessando o alvo, que abre rápido e fecha devagar
  rasgoSombra(g, h, k) {
    const p = pal(h.tipo), perp = h.ang + Math.PI / 2, abre = Math.min(1, k / 0.18), L = 26 * h.forca * abre, w = Math.max(1, Math.round(5 * (1 - k)));
    const pts = [];
    for (let i = 0; i <= 6; i++) { const u = i / 6 - 0.5, off = (sorteio(h.semilla, i) - 0.5) * 7; pts.push([h.x + Math.cos(perp) * u * L * 2 + Math.cos(h.ang) * off, h.y + Math.sin(perp) * u * L * 1.4 + Math.sin(h.ang) * off]); }
    const a0 = g.globalAlpha;
    g.globalAlpha = a0 * (k < 0.7 ? 1 : 0.5);
    for (const [cor, larg] of [[p[BORDA], w + 3], [p[SOMBRA], w + 1], [p[CLARO], Math.max(1, w - 2)]]) for (let i = 0; i < 6; i++) PX.lineaPix(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], cor, larg);
    if (k < 0.25) PX.disco(g, h.x, h.y, 3 + (1 - k * 4) * 4, p[NUCLEO]);
    g.globalAlpha = a0;
  },
  // rastro do salto: as últimas posições ligadas em três camadas, encurtando; acaba quando o lutador pousa
  rastroSalto(g, h, k, t) {
    const l = h.l;
    if (t > 0.08 && !(l.salto > 0)) { h.life = h.t; return; }
    h.pts.push([l.x, l.y - l.alto * 0.5 - (l.salto ?? 0)]);
    if (h.pts.length > 7) h.pts.shift();
    const p = pal(h.tipo), n = h.pts.length, a0 = g.globalAlpha;
    for (const [cor, larg, al] of [[p[BASE], Math.max(3, Math.round(l.alto * 0.45)), 0.3], [p[CLARO], 3, 0.7], [p[NUCLEO], 1, 1]]) {
      g.globalAlpha = a0 * al;
      for (let i = 1; i < n; i++) PX.lineaPix(g, h.pts[i - 1][0], h.pts[i - 1][1], h.pts[i][0], h.pts[i][1], cor, Math.max(1, Math.round(larg * (i / n))));
    }
    g.globalAlpha = a0;
  },
  // queda do chute: clarão, três anéis no chão abrindo e rachaduras serrilhadas que somem em degraus
  impactoChute(g, h, k) {
    const p = pal(h.tipo), terra = pal('GROUND'), a0 = g.globalAlpha;
    if (k < 0.2) PX.brilhoDegrau(g, h.x, h.y - 4, h.r * 0.9 * (1 - k * 3), IMPACTO, 1, h.r * 0.45);
    g.globalAlpha = a0 * (k < 0.6 ? 1 : k < 0.85 ? 0.55 : 0.25);
    for (let i = 0; i < (h.semRachas ? 0 : 8); i++) {
      const an = (i / 8) * Math.PI * 2 + sorteio(h.semilla, i) * 0.6, L = h.r * (0.6 + sorteio(h.semilla, i + 9) * 0.6) * Math.min(1, k * 6);
      let x0 = h.x, y0 = h.y;
      for (let j = 1; j <= 3; j++) { const u = j / 3, off = (sorteio(h.semilla, i * 3 + j) - 0.5) * 6, x1 = h.x + Math.cos(an) * L * u - Math.sin(an) * off, y1 = h.y + Math.sin(an) * L * u * 0.42; PX.lineaPix(g, x0, y0, x1, y1, terra[BORDA], j === 1 ? 2 : 1); x0 = x1; y0 = y1; }
    }
    for (const [atraso, cor, gro] of [[0, p[CLARO], 3], [0.1, p[BASE], 2], [0.2, FUMACA[CLARO], 1]]) {
      const u = Math.max(0, k - atraso) / (1 - atraso);
      if (u <= 0 || u >= 1) continue;
      const r = h.r * (0.35 + u * 0.95);
      PX.anilloPix(g, h.x, h.y, r, r * 0.42, cor, Math.max(1, Math.round(gro * (1 - u) + 0.5)), u > 0.6 ? 4 : 0, Math.floor(u * 12));
    }
    g.globalAlpha = a0;
  },
  // Foul Play: um X escuro marcado em quem levou o chute
  marcaX(g, h, k) {
    const p = pal(h.tipo), L = 12 * Math.min(1, k * 5), w = Math.max(1, Math.round(4 * (1 - k))), a0 = g.globalAlpha;
    g.globalAlpha = a0 * (k < 0.7 ? 1 : 0.5);
    for (const s of [1, -1]) for (const [cor, larg] of [[CONTORNO, w + 3], [p[SOMBRA], w + 1], [p[CLARO], Math.max(1, w - 1)]]) PX.lineaPix(g, h.x - L, h.y - L * s * 0.8, h.x + L, h.y + L * s * 0.8, cor, larg);
    g.globalAlpha = a0;
  },
  // Mind Reader / Lock-On: um anel de leitura passa pela cabeça, com riscos de varredura
  leitura(g, h, k, t) {
    const l = h.l, p = pal(h.tipo), x = l.x, y = l.y - l.alto - 4 - (l.salto ?? 0), r = 6 + k * 14, a0 = g.globalAlpha;
    g.globalAlpha = a0 * (k < 0.7 ? 1 : 0.5);
    PX.anilloPix(g, x, y, r, r * 0.5, CONTORNO, 2, 0);
    PX.anilloPix(g, x, y, r, r * 0.5, p[CLARO], 1, 5, Math.floor(t * 30));
    for (let i = 0; i < 3; i++) { const yy = y - r * 0.5 + ((t * 60 + i * 7) % (r + 1)); PX.lineaPix(g, x - r * 0.7, yy, x + r * 0.7, yy, i ? p[BASE] : p[NUCLEO], 1); }
    g.globalAlpha = a0;
  },
};
