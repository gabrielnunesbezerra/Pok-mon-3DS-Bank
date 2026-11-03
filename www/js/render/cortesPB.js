// Golpes corpo a corpo em pixel art.
// - golpeChato (no mundo, pixel art): Tackle, Pound, Lick e os outros golpes de contato viram um estouro redondo na
//   frente (núcleo branco, anel da cor do tipo, raios grossos) e riscos de velocidade, enxuto como ataque básico;
// Só desenho: nada aqui muda a luta.
import * as PX from './pixelfx.js';
import { pal, IMPACTO, CONTORNO } from './paletas.js';

const px = Math.round;

// golpe de contato: a, k (0..1 da vida), rr (alcance), fx/fy (ponto da frente)
export function golpeChato(g, a, k, rr, fx, fy) {
  const P = pal(a.tipo), ca = Math.cos(a.ang), sa = Math.sin(a.ang) * 0.8, cresce = 1 - (1 - Math.min(1, k * 2.5)) ** 2;
  // riscos de velocidade vindo de trás, na direção do golpe
  if (k < 0.6) for (let i = -1; i <= 1; i++) {
    const o = i * rr * 0.16, c0 = rr * (0.35 + Math.abs(i) * 0.1) * (1 - k), c1 = c0 + rr * 0.5 * (1 - k * 1.4);
    PX.lineaPix(g, fx - ca * c0 - sa * o, fy - sa * c0 + ca * o, fx - ca * c1 - sa * o, fy - sa * c1 + ca * o, i ? P[1] : IMPACTO[0], i ? 1 : 2);
  }
  // estouro: raios grossos e núcleo branco, que crescem rápido e encolhem
  const r = Math.max(5, Math.round(rr * 0.24 * (k < 0.4 ? 0.7 + cresce * 0.5 : 1.2 - (k - 0.4))));
  if (k < 0.75) PX.carimbar(g, PX.estouro(Math.floor(k * 8), r, IMPACTO[0], P[1]), fx, fy);
  if (k < 0.45) { const rn = r * 0.55 * (1 - k); PX.disco(g, px(fx), px(fy), rn + 1, CONTORNO); PX.disco(g, px(fx), px(fy), rn, P[1]); PX.disco(g, px(fx), px(fy), rn * 0.6, IMPACTO[0]); }
}
