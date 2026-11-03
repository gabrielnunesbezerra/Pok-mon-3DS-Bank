// Raios e cones em pixel art.
// - jatoAgua (no mundo): Hydro Pump / Hydro Cannon como uma coluna grossa de água com borda serrilhada em lascas, em
//   camadas do azul escuro ao núcleo branco, com pontilhado e borrifo brancos, leque de pontas brancas na ponta e
//   cristais de água subindo em leque em volta de quem usa quando o jato sai;
// - bolasFogo (no mundo): bolas de fogo pedaçudas rolando na ponta e nas bordas do Flamethrower.
// Só desenho: nada aqui muda a luta.
import * as PX from './pixelfx.js';
import { pal, IMPACTO } from './paletas.js';

const px = Math.round;
const fixo = (i, s = 0) => { const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); };

// faixa ao longo do raio com meia-largura hw(f) (f de 0 na boca a 1 na ponta), preenchida numa cor
function faixa(g, o, hw, cor) {
  const N = Math.max(8, Math.ceil(o.L / 5)), cima = [], baixo = [];
  for (let i = 0; i <= N; i++) { const f = i / N, d = o.L * f, h = hw(f, i); cima.push([o.x + o.ux * d + o.nx * h, o.y + o.uy * d + o.ny * h]); baixo.push([o.x + o.ux * d - o.nx * h, o.y + o.uy * d - o.ny * h]); }
  g.fillStyle = cor; g.beginPath(); g.moveTo(px(cima[0][0]), px(cima[0][1]));
  for (const [x, y] of cima) g.lineTo(px(x), px(y));
  for (let i = baixo.length - 1; i >= 0; i--) g.lineTo(px(baixo[i][0]), px(baixo[i][1]));
  g.closePath(); g.fill();
}

// o: { x, y (boca), ux, uy, nx, ny (direção e normal), L (comprimento), w (largura), desde (tempo desde que saiu) }
export function jatoAgua(g, o, t) {
  const P = pal('WATER'), w = o.w;
  // cristais de água subindo em leque em volta de quem usa, logo que o jato sai
  if (o.desde < 0.45) {
    const k = o.desde / 0.45;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.42, d = 6 + k * (16 + fixo(i) * 8), cx = o.x - o.ux * 6 + Math.cos(a) * d, cy = o.y + 4 + Math.sin(a) * d * 0.8 - k * 6, h = (5 + fixo(i, 1) * 4) * (1 - k * 0.6), lw = h * 0.42;
      g.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
      for (const [cor, s] of [[P[4], 1.35], [P[2], 1], [P[0], 0.45]]) { g.fillStyle = cor; g.beginPath(); g.moveTo(px(cx), px(cy - h * s)); g.lineTo(px(cx + lw * s), px(cy)); g.lineTo(px(cx), px(cy + h * s * 0.6)); g.lineTo(px(cx - lw * s), px(cy)); g.closePath(); g.fill(); }
    }
    g.globalAlpha = 1;
  }
  coluna(g, o, t, P, true);
}

// paletas das colunas de energia das ults (5 tons, do núcleo à borda, como em paletas.js)
export const PALETA_COLUNA = {
  hiper: ['#fff8e0', '#ffd890', '#ffa24a', '#d0581a', '#5a2008'],
  solar: ['#fffbe0', '#fff29a', '#ffd23c', '#c8960e', '#5a420a'],
  matcha: ['#f6fbe6', '#d2eaa0', '#8bc34a', '#4f7a22', '#22380e'],
};

// coluna grossa que ondula, em camadas da borda ao núcleo branco, com brilhos correndo e estouro pedaçudo na ponta
export function coluna(g, o, t, P, agua = false) {
  const w = o.w, fr = Math.floor(t * 16);
  if (o.L < 3) return;
  // camadas: borda, sombra, base, claro e núcleo branco. Água (como no Pokémon Arena 2D): borda serrilhada em lascas que
  // muda a cada quadro; energia (Hyper Beam...): borda quase reta, sólida
  const borda = agua ? (f, i) => ((i + fr) % 2 ? 1.16 : 0.86) : (f, i) => 1 + 0.03 * Math.sin(f * 22 - t * 34 + i * 0.3);
  const forma = kw => (f, i) => w * 0.5 * kw * borda(f, i) * (f < 0.06 ? 0.55 + f * 7.5 : 1) * (0.85 + 0.25 * f);
  faixa(g, o, (f, i) => forma(1)(f, i) + 1.5, P[4]);
  faixa(g, o, forma(1), P[3]);
  faixa(g, o, forma(0.78), P[2]);
  faixa(g, o, forma(0.5), P[1]);
  faixa(g, o, forma(0.16), IMPACTO[0]);
  const xp = o.x + o.ux * o.L, yp = o.y + o.uy * o.L;
  if (agua) {
    // pontilhado branco por dentro e traços curtos de borrifo saindo das bordas
    g.fillStyle = IMPACTO[0];
    for (let i = 0; i < 26; i++) { const d = o.L * fixo(i, fr), lado = (fixo(i, fr + 1) - 0.5) * w * 0.8; g.fillRect(px(o.x + o.ux * d + o.nx * lado), px(o.y + o.uy * d + o.ny * lado), 1, 1); }
    for (let i = 0; i < 8; i++) {
      const f = (i / 8 + t * 2.2) % 1, lado = i % 2 ? 1 : -1, d = o.L * f, b = w * 0.55 * (0.85 + 0.25 * f), x0 = o.x + o.ux * d + o.nx * lado * b, y0 = o.y + o.uy * d + o.ny * lado * b;
      PX.lineaPix(g, x0, y0, x0 + o.nx * lado * 4 - o.ux * 3, y0 + o.ny * lado * 4 - o.uy * 3, P[0], 1);
    }
    espinhos(g, xp, yp, Math.atan2(o.uy, o.ux), w, fr, P);
  } else for (let i = 0; i < 5; i++) { const a = i * 1.257 + fr * 0.4, r = w * (0.2 + 0.1 * fixo(i, fr)), d = w * 0.3; PX.disco(g, px(xp + Math.cos(a) * d), px(yp + Math.sin(a) * d * 0.8), r + 1, P[4]); PX.disco(g, px(xp + Math.cos(a) * d), px(yp + Math.sin(a) * d * 0.8), r, i % 2 ? P[1] : P[0]); }
  PX.esfera(g, px(o.x), px(o.y), Math.max(3, w * 0.38), [P[3], P[2], P[1], IMPACTO[0]], P[4]);
}

// leque de pontas de água brancas e anguladas (o respingo do jato no Pokémon Arena 2D)
function espinhos(g, x, y, ang, w, fr, P) {
  for (let i = -3; i <= 3; i++) {
    const a = ang + i * 0.38 + (fixo(i + 9, fr) - 0.5) * 0.2, len = w * (0.6 + fixo(i + 4, fr) * 0.55) * (1 - Math.abs(i) * 0.1), bw = w * 0.15, nx = -Math.sin(a), ny = Math.cos(a) * 0.8;
    const tx = x + Math.cos(a) * len, ty = y + Math.sin(a) * len * 0.8;
    for (const [cor, k] of [[P[3], 1.35], [P[0], 1], [IMPACTO[0], 0.45]]) { g.fillStyle = cor; g.beginPath(); g.moveTo(px(x + (tx - x) * (k > 1 ? 1.08 : 1)), px(y + (ty - y) * (k > 1 ? 1.08 : 1))); g.lineTo(px(x + nx * bw * k), px(y + ny * bw * k)); g.lineTo(px(x - nx * bw * k), px(y - ny * bw * k)); g.closePath(); g.fill(); }
  }
}

// bolas de fogo pedaçudas: rolam do meio até a ponta do jato e se soltam nas bordas
export function bolasFogo(g, o, t, tipo) {
  const P = pal(tipo), fr = Math.floor(t * 20);
  for (let i = 0; i < 7; i++) {
    const f = 0.45 + ((i / 7 + t * 1.8) % 1) * 0.6, d = o.L * Math.min(1.02, f), abre = (o.abre ?? 0.4) * d, lado = (fixo(i, 3) - 0.5) * 2 * abre * 0.9;
    const r = Math.max(2, (2 + d * 0.06) * (0.8 + 0.4 * fixo(i, fr >> 2))), x = o.x + o.ux * d + o.nx * lado, y = o.y + o.uy * d + o.ny * lado * 0.8 - (f - 0.45) * 6;
    PX.disco(g, px(x), px(y), r + 1, P[4]);
    PX.disco(g, px(x), px(y), r, f > 0.9 ? P[3] : P[2]);
    PX.disco(g, px(x + o.ux * r * 0.2), px(y - r * 0.2), r * 0.62, P[1]);
    if (f < 0.85) PX.disco(g, px(x + o.ux * r * 0.25), px(y - r * 0.3), Math.max(0.5, r * 0.28), IMPACTO[0]);
  }
}
