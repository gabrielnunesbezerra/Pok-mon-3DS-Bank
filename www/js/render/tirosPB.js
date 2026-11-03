// Tiros básicos no formato do PB Battlegrounds. Duas camadas por tiro:
// - no mundo (pixel art 1:1): formas grossas e grandes com contorno, núcleo branco-quente e rastro de pedaços que desce
//   a paleta do tipo (Water Gun, Water Pulse, Ember, Fire Blast, Razor Leaf, Bullet Seed, Rock Throw, Confusion, Acid);
// - na tela (resolução do aparelho): luz suave e aditiva da cor do tipo por cima, núcleo branco e riscos de velocidade.
// Só desenho: nada aqui muda a luta.
import * as PX from './pixelfx.js';
import { pal, IMPACTO, FUMACA } from './paletas.js';

const px = Math.round;
// rastro guardado no próprio tiro (posições recentes), para os pedaços seguirem a curva do zigue-zague
function rastro(p, n) {
  const r = (p._rb ??= []), y = p.y - p.alt;
  const u = r[r.length - 1];
  if (!u || Math.hypot(u[0] - p.x, u[1] - y) > 1.5) { r.push([p.x, y]); if (r.length > n) r.shift(); }
  return r;
}
// sorteio fixo por índice (nada pisca ao acaso de um quadro para o outro)
const fixo = (i, s = 0) => { const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); };
const raioDe = (p, base) => base * Math.min(2.2, p.escala ?? 1);

// bola de fogo pedaçuda: cabeça redonda e pedaços que ficam para trás, sobem e escurecem
function fogo(g, p, t, base) {
  const P = pal(p.tipoAtq), R = raioDe(p, base), x = p.x, y = p.y - p.alt, tr = rastro(p, 9);
  for (let i = 0; i < tr.length - 1; i++) {
    const k = 1 - i / (tr.length - 1), [qx, qy] = tr[i], j = fixo(i + Math.floor(p.edad * 10), 3) - 0.5;
    const r = Math.max(1, R * (0.25 + 0.55 * (1 - k))), sobe = k * R * 1.4;
    const cor = P[Math.min(4, 1 + Math.floor(k * 3.99))];
    PX.disco(g, px(qx + j * R * 0.6), px(qy - sobe + j * 2), r + 1, P[4]);
    PX.disco(g, px(qx + j * R * 0.6), px(qy - sobe + j * 2), r, cor);
  }
  const ca = Math.cos(p.ang), sa = Math.sin(p.ang), f = Math.floor(t * 16 + p.x * 0.1) % 2;
  // lobos de chama atrás da cabeça, que alternam e dão o recorte pedaçudo
  for (let i = 0; i < 3; i++) { const a = p.ang + Math.PI + (i - 1) * 0.7, d = R * (0.7 + ((i + f) % 2) * 0.25); PX.disco(g, px(x + Math.cos(a) * d), px(y + Math.sin(a) * d - R * 0.2), R * 0.62 + 1, P[4]); PX.disco(g, px(x + Math.cos(a) * d), px(y + Math.sin(a) * d - R * 0.2), R * 0.62, P[3]); }
  PX.disco(g, px(x), px(y), R + 1, P[4]);
  PX.disco(g, px(x), px(y), R, P[2]);
  PX.disco(g, px(x + ca * R * 0.15), px(y + sa * R * 0.15 - R * 0.1), R * 0.72, P[1]);
  PX.disco(g, px(x + ca * R * 0.3), px(y + sa * R * 0.3 - R * 0.15), R * 0.42, P[0]);
  PX.disco(g, px(x + ca * R * 0.35), px(y + sa * R * 0.35 - R * 0.2), Math.max(0.5, R * 0.18), IMPACTO[0]);
}

// cápsula grossa ao longo do ângulo (o jato do Water Gun e as gotas)
function capsula(g, x, y, ang, L, r, cor) {
  const ca = Math.cos(ang), sa = Math.sin(ang), n = Math.max(2, Math.ceil(L / Math.max(1, r * 0.7)));
  for (let i = 0; i <= n; i++) { const k = i / n; PX.disco(g, px(x - ca * L * k), px(y - sa * L * k), Math.max(0.5, r * (1 - k * 0.55)), cor); }
}

export const ESTILOS_PB = {
  brasa(g, p, t) { fogo(g, p, t, 3.6); },
  fuego(g, p, t) { fogo(g, p, t, 5.6); },
  // Water Gun: jato grosso em cápsula com risco branco e gotas soltas atrás
  chorrito(g, p, t) {
    const P = pal('WATER'), r = raioDe(p, 3), L = r * 4.2, x = p.x, y = p.y - p.alt, ca = Math.cos(p.ang), sa = Math.sin(p.ang);
    for (let i = 0; i < 3; i++) { const d = L + 4 + i * r * 1.6 + fixo(i, 1) * 3, o = (fixo(i, 2) - 0.5) * r * 1.6 + Math.sin(t * 20 + i) * 0.8; const gx = x - ca * d - sa * o, gy = y - sa * d + ca * o, rr = Math.max(1, r * (0.55 - i * 0.12)); PX.disco(g, px(gx), px(gy), rr + 1, P[4]); PX.disco(g, px(gx), px(gy), rr, i ? P[2] : P[1]); }
    capsula(g, x, y, p.ang, L, r + 1, P[4]);
    capsula(g, x, y, p.ang, L, r, P[3]);
    capsula(g, x - sa * r * 0.15, y + ca * r * 0.15, p.ang, L * 0.92, r * 0.78, P[2]);
    capsula(g, x - sa * r * 0.3 + ca, y - r * 0.3 + sa, p.ang, L * 0.7, r * 0.42, P[1]);
    const s = (t * 3 + p.x * 0.01) % 1; PX.lineaPix(g, x - ca * L * (0.1 + s * 0.4) - sa * r * 0.35, y - sa * L * (0.1 + s * 0.4) - r * 0.35, x - ca * L * (0.3 + s * 0.4) - sa * r * 0.35, y - sa * L * (0.3 + s * 0.4) - r * 0.35, IMPACTO[0], 1);
    PX.disco(g, px(x + ca * r * 0.2 - sa * r * 0.3), px(y + sa * r * 0.2 - r * 0.35), Math.max(0.5, r * 0.3), IMPACTO[0]);
  },
  // Water Pulse: esfera de água num anel grosso, com brilhos brancos varrendo em volta
  pulsoAgua(g, p, t) {
    const P = pal('WATER'), r = raioDe(p, 4), x = px(p.x), y = px(p.y - p.alt), pul = Math.floor(t * 12) % 2, ra = r + 4 + pul;
    PX.anilloPix(g, x, y, ra + 1, ra + 1, P[4], 2);
    PX.anilloPix(g, x, y, ra, ra, P[2], 2);
    PX.anilloPix(g, x, y, ra - 1, ra - 1, P[1], 1);
    for (let i = 0; i < 3; i++) { const a0 = t * 9 + (i * Math.PI * 2) / 3; for (let j = 0; j < 3; j++) { const a = a0 + j * 0.16; g.fillStyle = j === 1 ? IMPACTO[0] : P[0]; g.fillRect(px(x + Math.cos(a) * ra), px(y + Math.sin(a) * ra), 2, 2); } }
    PX.esfera(g, x, y, r, [P[3], P[2], P[1], IMPACTO[0]], P[4]);
  },
  // Razor Leaf: folha grande com brilho branco na borda e pontinhos verdes atrás
  hoja(g, p, t) {
    const P = pal('GRASS'), L = Math.round(11 * Math.min(2, p.escala)), tr = rastro(p, 6), giro = t * 14 + p.x * 0.05;
    for (let i = 0; i < tr.length - 1; i += 2) { const k = 1 - i / (tr.length - 1); PX.disco(g, px(tr[i][0]), px(tr[i][1]), Math.max(0.5, 1.5 - k), P[k > 0.5 ? 2 : 1]); }
    PX.carimbar(g, PX.hoja(L, [P[3], P[2], P[1], P[0]]), p.x, p.y - p.alt, giro);
    if (Math.floor(t * 10 + p.x) % 3 === 0) { const a = Math.round(giro / (Math.PI / 8)) * (Math.PI / 8); g.fillStyle = IMPACTO[0]; g.fillRect(px(p.x + Math.cos(a) * L * 0.25 - 1), px(p.y - p.alt + Math.sin(a) * L * 0.25 - 2), 2, 1); }
  },
  // Bullet Seed: semente grande com contorno, brilho e riscos de velocidade
  semilla(g, p) {
    const r = raioDe(p, 3.4), x = px(p.x), y = px(p.y - p.alt), ca = Math.cos(p.ang), sa = Math.sin(p.ang);
    for (let i = -1; i <= 1; i += 2) PX.lineaPix(g, x - ca * r * 1.6 - sa * i * r * 0.6, y - sa * r * 1.6 + ca * i * r * 0.6, x - ca * r * 4 - sa * i * r * 0.6, y - sa * r * 4 + ca * i * r * 0.6, '#d6e8a0', 1);
    PX.esfera(g, x, y, r, ['#5a3a12', '#9a6a22', '#d6a64a', IMPACTO[0]]);
    PX.disco(g, px(x - ca * r * 0.6), px(y - sa * r * 0.6), Math.max(1, r * 0.35), '#3f8a2a');
  },
  // Rock Throw: pedra grossa girando, com nuvenzinhas de poeira atrás
  roca(g, p, t) {
    const tr = rastro(p, 8), T = Math.max(4, Math.round(4.6 * Math.min(2, p.escala)));
    for (let i = 0; i < tr.length - 1; i += 2) { const k = 1 - i / (tr.length - 1); PX.disco(g, px(tr[i][0]), px(tr[i][1] + 2), Math.max(1, T * 0.7 * (1 - k * 0.6)), FUMACA[1 + Math.floor(k * 2.9)]); }
    PX.carimbar(g, PX.roca(T), p.x, p.y - p.alt, t * 9);
    g.fillStyle = IMPACTO[0]; g.fillRect(px(p.x - T * 0.4), px(p.y - p.alt - T * 0.5), 2, 1);
  },
  // Confusion: orbe rosa com núcleo branco e dois anéis finos girando em volta
  psico(g, p, t) {
    const P = pal('PSYCHIC'), r = raioDe(p, 3.6), x = px(p.x), y = px(p.y - p.alt);
    for (let i = 0; i < 2; i++) { const a = t * (i ? -7 : 9), rx = r + 4, ry = (r + 4) * Math.abs(Math.cos(a)) + 1; PX.anilloPix(g, x, y, i ? ry : rx, i ? rx : ry, i ? P[1] : P[0], 1, 5, Math.floor(t * 20)); }
    PX.esfera(g, x, y, r, [P[3], P[2], P[1], IMPACTO[0]], P[4]);
    PX.disco(g, x, y, Math.max(1, r * 0.35), IMPACTO[0]);
  },
  // Acid / Sludge: bolha da cor do tipo com brilho e gotas pingando atrás
  bola(g, p, t) {
    const P = pal(p.tipoAtq), r = raioDe(p, 3.4), x = px(p.x), y = px(p.y - p.alt), tr = rastro(p, 8);
    for (let i = 0; i < tr.length - 1; i += 3) { const k = 1 - i / (tr.length - 1), cai = k * 5; PX.disco(g, px(tr[i][0]), px(tr[i][1] + cai), Math.max(1, r * 0.45 * (1 - k * 0.5)) + 1, P[4]); PX.disco(g, px(tr[i][0]), px(tr[i][1] + cai), Math.max(1, r * 0.45 * (1 - k * 0.5)), P[2]); }
    const sq = Math.sin(t * 24) * 0.1;
    PX.elipsePix(g, x, y, r * (1 + sq) + 1, r * (1 - sq) + 1, P[4]);
    PX.elipsePix(g, x, y, r * (1 + sq), r * (1 - sq), P[3]);
    PX.elipsePix(g, x - r * 0.1, y - r * 0.15, r * 0.8, r * 0.7, P[2]);
    PX.disco(g, px(x - r * 0.35), px(y - r * 0.4), Math.max(0.5, r * 0.3), P[0]);
    g.fillStyle = IMPACTO[0]; g.fillRect(px(x - r * 0.45), px(y - r * 0.5), 1, 1);
  },
};

// ---------------------------------------------------------------- luz na tela
// quanto cada estilo brilha: [raio do brilho em pixels do mundo, força, núcleo branco?, riscos de velocidade?]
const LUZ = { brasa: [10, 0.75, 1, 1], fuego: [16, 0.9, 1, 1], chorrito: [10, 0.55, 1, 1], pulsoAgua: [13, 0.6, 1, 0], hoja: [8, 0.4, 0, 1], semilla: [6, 0.3, 0, 1], roca: [0, 0, 0, 1], psico: [12, 0.7, 1, 0], bola: [8, 0.4, 0, 0] };
const halos = new Map();
const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
// brilho radial pronto (um canvas por cor), carimbado com 'lighter': barato até no celular
function halo(cor) {
  let c = halos.get(cor);
  if (!c) {
    c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32), [r, gg, b] = rgb(cor);
    gr.addColorStop(0, `rgba(${r},${gg},${b},1)`); gr.addColorStop(0.3, `rgba(${r},${gg},${b},0.5)`); gr.addColorStop(0.65, `rgba(${r},${gg},${b},0.14)`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); halos.set(cor, c);
  }
  return c;
}

export function luzTiros(g, luta, cam, ox, oy, t) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  const z = cam.z;
  for (const p of luta.entidades) {
    if (p.tipo !== 'proj' || p.vivo === false) continue;
    const L = LUZ[p.estilo];
    if (!L) continue;
    const q = cam.aPantalla(p.x, p.y - p.alt), x = q.x + ox, y = q.y + oy, P = pal(p.tipoAtq), esc = Math.min(2.2, p.escala ?? 1);
    const nasce = Math.min(1, (p.edad ?? 1) / 0.06), tremor = 1 + 0.08 * Math.sin(t * 40 + p.x);
    if (L[0]) {
      const R = L[0] * esc * z * tremor;
      g.globalAlpha = L[1] * nasce; g.drawImage(halo(P[1]), x - R, y - R, R * 2, R * 2);
      if (L[2]) { const r2 = R * 0.42; g.globalAlpha = 0.85 * nasce; g.drawImage(halo(IMPACTO[0]), x - r2, y - r2, r2 * 2, r2 * 2); }
    }
    if (L[3]) {
      // riscos de velocidade: linhas finas claras saindo para trás do tiro
      const v = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / v, uy = p.vy / v, nx = -uy, ny = ux, comp = Math.min(60, v * 0.09) * z;
      g.lineWidth = Math.max(1, z * 0.6); g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const o = (i - 1) * 3.2 * esc * z + Math.sin(t * 30 + i * 2) * z, c0 = (4 + i * 3) * esc * z, c1 = c0 + comp * (1 - Math.abs(i - 1) * 0.4);
        g.globalAlpha = (i === 1 ? 0.55 : 0.3) * nasce; g.strokeStyle = i === 1 ? IMPACTO[0] : P[0];
        g.beginPath(); g.moveTo(x - ux * c0 + nx * o, y - uy * c0 + ny * o); g.lineTo(x - ux * c1 + nx * o, y - uy * c1 + ny * o); g.stroke();
      }
    }
  }
  g.restore();
}
