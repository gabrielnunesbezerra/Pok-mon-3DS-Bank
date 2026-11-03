// Raios e cones no formato do PB Battlegrounds.
// - jatoAgua (no mundo): Hydro Pump / Hydro Cannon como uma coluna grossa de água que ondula, em camadas do azul
//   escuro ao núcleo branco, com brilhos brancos varrendo, espuma pedaçuda na ponta e cristais de água subindo em leque
//   em volta de quem usa quando o jato sai;
// - bolasFogo (no mundo): bolas de fogo pedaçudas rolando na ponta e nas bordas do Flamethrower;
// - luzRaios (na tela): luz suave ao longo de todo raio e cone.
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
  coluna(g, o, t, P);
}

// paletas das colunas de energia das ults (5 tons, do núcleo à borda, como em paletas.js)
export const PALETA_COLUNA = {
  hiper: ['#fff8e0', '#ffd890', '#ffa24a', '#d0581a', '#5a2008'],
  solar: ['#fffbe0', '#fff29a', '#ffd23c', '#c8960e', '#5a420a'],
  matcha: ['#f6fbe6', '#d2eaa0', '#8bc34a', '#4f7a22', '#22380e'],
};

// coluna grossa que ondula, em camadas da borda ao núcleo branco, com brilhos correndo e estouro pedaçudo na ponta
export function coluna(g, o, t, P) {
  const w = o.w;
  if (o.L < 3) return;
  // coluna em camadas: borda, sombra, base, claro e núcleo branco; a borda ondula como água correndo
  const onda = (f, i, k) => 1 + k * Math.sin(f * 22 - t * 34 + i * 0.3) + k * 0.6 * Math.sin(f * 9 + t * 21);
  const forma = (kw, ko) => (f, i) => w * 0.5 * kw * onda(f, i, ko) * (f < 0.06 ? 0.55 + f * 7.5 : 1) * (0.85 + 0.25 * f);
  faixa(g, o, (f, i) => forma(1, 0.1)(f, i) + 1.5, P[4]);
  faixa(g, o, forma(1, 0.1), P[3]);
  faixa(g, o, forma(0.78, 0.08), P[2]);
  faixa(g, o, forma(0.5, 0.06), P[1]);
  faixa(g, o, forma(0.16, 0.04), IMPACTO[0]);
  // brilhos brancos varrendo ao longo do jato
  for (let i = 0; i < 6; i++) {
    const f = (i / 6 + t * 2.6) % 1, lado = (i % 2 ? 1 : -1) * w * 0.26 * (0.85 + 0.25 * f), d0 = o.L * f, d1 = Math.min(o.L, d0 + 6 + w * 0.3);
    PX.lineaPix(g, o.x + o.ux * d0 + o.nx * lado, o.y + o.uy * d0 + o.ny * lado, o.x + o.ux * d1 + o.nx * lado, o.y + o.uy * d1 + o.ny * lado, i % 3 ? P[0] : IMPACTO[0], i % 3 ? 1 : 2);
  }
  // pedaços na ponta (espuma na água, estouro de energia no resto) e esfera na boca
  const xp = o.x + o.ux * o.L, yp = o.y + o.uy * o.L, fr = Math.floor(t * 18);
  for (let i = 0; i < 6; i++) { const a = i * 1.047 + fr * 0.4, r = w * (0.32 + 0.16 * fixo(i, fr)), d = w * 0.38; PX.disco(g, px(xp + Math.cos(a) * d), px(yp + Math.sin(a) * d * 0.8), r + 1, P[4]); PX.disco(g, px(xp + Math.cos(a) * d), px(yp + Math.sin(a) * d * 0.8), r, i % 2 ? P[1] : P[0]); }
  PX.disco(g, px(xp), px(yp), w * 0.42, IMPACTO[0]);
  PX.esfera(g, px(o.x), px(o.y), Math.max(3, w * 0.38), [P[3], P[2], P[1], IMPACTO[0]], P[4]);
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

// ---------------------------------------------------------------- luz na tela
const rgba = (h, al) => { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${al})`; };
export function luzRaios(g, luta, cam, ox, oy, t) {
  g.save();
  g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  const z = cam.z;
  for (const e of luta.entidades) {
    let x0, y0, x1, y1, W, cor;
    if (e.tipo === 'chorro' && e.activo && e.largoVis > 4) {
      const b = e.origenVis(), alt = e.dueno.alto * 0.55, ca = Math.cos(e.ang), sa = Math.sin(e.ang);
      x0 = b.x; y0 = b.y - alt; x1 = b.x + ca * e.largoVis; y1 = b.y - alt + sa * e.largoVis; W = (e.h.anchoVisual ?? e.ancho * 1.4) * 1.6; cor = pal(e.tipoAtq)[1];
    } else if (e.tipo === 'cono' && e.dueno) {
      const d = e.dueno, alt = d.alto * 0.5, L = Math.min(e.h.alcance, e.t * 650), ca = Math.cos(e.ang), sa = Math.sin(e.ang);
      x0 = d.x + ca * 10; y0 = d.y + sa * 6 - alt; x1 = x0 + ca * L; y1 = y0 + sa * L; W = Math.max(10, L * Math.tan((e.h.angulo * Math.PI) / 720) * 2.4); cor = pal(e.h.tipo)[1];
    } else continue;
    const a = cam.aPantalla(x0, y0), b = cam.aPantalla(x1, y1), pul = 1 + 0.06 * Math.sin(t * 36);
    g.strokeStyle = rgba(cor, 0.1); g.lineWidth = W * z * pul; g.beginPath(); g.moveTo(a.x + ox, a.y + oy); g.lineTo(b.x + ox, b.y + oy); g.stroke();
    g.strokeStyle = rgba(IMPACTO[0], 0.1); g.lineWidth = W * 0.35 * z; g.beginPath(); g.moveTo(a.x + ox, a.y + oy); g.lineTo(b.x + ox, b.y + oy); g.stroke();
  }
  g.restore();
}
