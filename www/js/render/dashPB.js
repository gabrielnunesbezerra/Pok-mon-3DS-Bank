// Dashes em pixel art.
// - rastroDashPB (no mundo, pixel art): cauda de cometa grossa nas cores do tipo, larga no corpo e afinando até a ponta,
//   com fio branco no meio e riscos de velocidade tracejados por fora;
// - frenteDash: onda de ar em "V" na frente (rápido, golpe) e casca de água em volta do corpo (água);
// Só desenho: nada aqui muda a luta.
import * as PX from './pixelfx.js';
import { pal, IMPACTO } from './paletas.js';

const px = Math.round;
const geo = l => {
  const d = l.dash, v = d.vel ?? Math.hypot(l.vx, l.vy), ux = Math.cos(d.ang), uy = Math.sin(d.ang) * 0.7;
  return { d, ux, uy, L: Math.min(80, 22 + v * 0.08), y: l.y - l.alto * 0.45 - (l.salto ?? 0), P: pal(d.def.tipo) };
};

export function rastroDashPB(g, l, t) {
  const { ux, uy, L, y, P } = geo(l), larg = Math.max(5, l.alto * 0.42), a0 = g.globalAlpha, n = Math.ceil(L / 1.5);
  // cauda: discos ao longo do caminho, cada camada mais estreita e mais clara
  for (const [k, cor, al] of [[1, P[2], 0.55], [0.62, P[1], 0.8], [0.26, IMPACTO[0], 1]]) {
    g.globalAlpha = a0 * al;
    for (let i = n; i >= 0; i--) { const u = i / n, r = larg * k * (1 - u) ** 0.85; if (r < 0.5) continue; PX.disco(g, px(l.x - ux * L * u), px(y - uy * L * u), r, cor); }
  }
  // riscos de velocidade tracejados que correm para trás
  g.globalAlpha = a0;
  for (const o of [-0.42, 0.42, -0.2]) {
    const nx = -uy * o * l.alto, ny = ux * o * l.alto, fase = (t * 6 + o) % 1;
    for (let s = 0; s < 3; s++) { const u0 = 0.15 + ((s / 3 + fase) % 1) * 0.9, u1 = u0 + 0.18; PX.lineaPix(g, l.x - ux * L * u0 + nx, y - uy * L * u0 + ny, l.x - ux * L * u1 + nx, y - uy * L * u1 + ny, s % 2 ? P[0] : IMPACTO[0], 1); }
  }
}

// onda de ar na frente do corpo: arco em "V" que pulsa
export function ondaFrente(g, l, t, cor) {
  const { d, P } = geo(l), cx = l.x, cy = l.y - l.alto * 0.5 - (l.salto ?? 0), r = l.alto * 0.62 + (Math.floor(t * 20) % 2), a = d.ang, abre = 0.95;
  PX.arcoPix(g, cx, cy, r + 2, a - abre, a + abre, P[3], 4, (r + 2) * 0.8);
  PX.arcoPix(g, cx, cy, r + 2, a - abre * 0.85, a + abre * 0.85, cor ?? P[0], 2, (r + 2) * 0.8);
  PX.arcoPix(g, cx, cy, r + 6, a - abre * 0.5, a + abre * 0.5, IMPACTO[0], 1, (r + 6) * 0.8);
}

// casca de água em volta do corpo, com brilhos brancos varrendo
export function cascaAgua(g, l, t) {
  const P = pal('WATER'), cx = l.x, cy = l.y - l.alto * 0.5 - (l.salto ?? 0), r = l.alto * 0.62, a0 = g.globalAlpha;
  g.globalAlpha = a0 * 0.3; PX.elipsePix(g, cx, cy, r, r * 0.8, P[1]); g.globalAlpha = a0;
  for (let k = 0; k < 3; k++) {
    const b = t * 22 + (k / 3) * Math.PI * 2;
    PX.arcoPix(g, cx, cy, r, b, b + 1.5, P[4], 6, r * 0.8);
    PX.arcoPix(g, cx, cy, r, b, b + 1.5, P[2], 4, r * 0.8);
    PX.arcoPix(g, cx, cy, r, b + 0.25, b + 1.2, P[1], 2, r * 0.8);
    g.fillStyle = IMPACTO[0]; g.fillRect(px(cx + Math.cos(b + 1.3) * r), px(cy + Math.sin(b + 1.3) * r * 0.8), 2, 2);
  }
}
