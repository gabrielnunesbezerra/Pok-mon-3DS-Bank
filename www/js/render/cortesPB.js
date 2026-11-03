// Golpes corpo a corpo no formato do PB Battlegrounds.
// - golpeChato (no mundo, pixel art): Tackle, Pound, Lick e os outros golpes de contato viram um estouro redondo na
//   frente (núcleo branco, anel da cor do tipo, raios grossos), riscos de velocidade e um anel fino abrindo;
// - luzCortes (na tela, resolução do aparelho): luz aditiva por cima de todo corte, mordida, soco e asa.
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
  const r = Math.max(6, Math.round(rr * 0.34 * (k < 0.4 ? 0.7 + cresce * 0.5 : 1.2 - (k - 0.4))));
  if (k < 0.75) PX.carimbar(g, PX.estouro(Math.floor(k * 8), r, IMPACTO[0], P[1]), fx, fy);
  if (k < 0.45) { const rn = r * 0.55 * (1 - k); PX.disco(g, px(fx), px(fy), rn + 1, CONTORNO); PX.disco(g, px(fx), px(fy), rn, P[1]); PX.disco(g, px(fx), px(fy), rn * 0.6, IMPACTO[0]); }
  // anel fino abrindo
  if (k > 0.15) { const ra = r * (0.6 + (k - 0.15) * 1.8); PX.anilloPix(g, fx, fy, ra, ra * 0.75, k < 0.6 ? IMPACTO[0] : P[0], 1, k > 0.5 ? 3 : 0, Math.floor(k * 20)); }
}

// ---------------------------------------------------------------- luz na tela
const rgba = (h, al) => { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, al))})`; };
const ehChato = a => a.estilo === 'golpe' && !['FIGHTING', 'BUG', 'DARK', 'FLYING'].includes(a.tipo);

// arco elíptico (o mesmo achatamento 0.8 do corte no mundo) desenhado na tela
function arco(g, x, y, R, a0, a1, z) { g.beginPath(); g.ellipse(x, y, R * z, R * z * 0.8, 0, a0, a1); g.stroke(); }

export function luzCortes(g, fx, cam, ox, oy) {
  if (!fx.tajos?.length) return;
  g.save();
  g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  const z = cam.z;
  for (const a of fx.tajos) {
    // 0.55: intensidade geral da luz (o usuário pediu menos claridade)
    const k = a.t / a.life, rr = a.r * 0.9, P = pal(a.tipo), al = (1 - k) * 0.55;
    const fxx = a.x + Math.cos(a.ang) * rr * 0.85, fyy = a.y + Math.sin(a.ang) * rr * 0.85 * 0.8;
    const q = cam.aPantalla(fxx, fyy), sx = q.x + ox, sy = q.y + oy;
    const plano = ehChato(a) || a.tipo === 'BUG' || a.tipo === 'DARK' || (a.tipo === 'FIGHTING' && a.estilo !== 'hueso');
    if (plano || a.tipo === 'FLYING') {
      // brilho redondo no ponto do golpe: quente nos socos, roxo-escuro na mordida, cor do tipo no resto
      const cor = a.tipo === 'DARK' || a.tipo === 'BUG' ? '#b08cff' : a.tipo === 'FIGHTING' ? IMPACTO[2] : P[1];
      const R = rr * (0.55 + 0.3 * Math.min(1, k * 3)) * z, gr = g.createRadialGradient(sx, sy, 0, sx, sy, R);
      gr.addColorStop(0, rgba(IMPACTO[0], 0.9 * al)); gr.addColorStop(0.3, rgba(cor, 0.55 * al)); gr.addColorStop(1, rgba(cor, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, R, 0, 7); g.fill();
      // clarão branco curto quando a mordida fecha
      if ((a.tipo === 'DARK' || a.tipo === 'BUG') && k > 0.35 && k < 0.55) { g.fillStyle = rgba(IMPACTO[0], 0.4); g.beginPath(); g.arc(sx, sy, rr * 0.25 * z, 0, 7); g.fill(); }
      continue;
    }
    // corte em meia-lua: mesma varredura do desenho no mundo (ease-out na frente, recolhe atrás)
    const aco = a.tipo === 'STEEL', span = aco ? 2.45 : 1.9, a0 = a.ang - span / 2, varre = 1 - (1 - Math.min(1, k * 3.2)) ** 3, recolhe = Math.max(0, (k - 0.3) / 0.7) ** 1.6;
    const ini = a0 + span * recolhe * 0.85, fim = a0 + span * varre;
    if (fim - ini < 0.05) continue;
    const c = cam.aPantalla(a.x, a.y), cx = c.x + ox, cy = c.y + oy, R = rr * (1 + k * 0.08), esp = rr * (aco ? 0.46 : a.final ? 0.46 : 0.36);
    g.strokeStyle = rgba(P[1], (aco ? 0.12 : 0.2) * al); g.lineWidth = esp * 1.9 * z; arco(g, cx, cy, R - esp * 0.4, ini, fim, z);
    g.strokeStyle = rgba(P[0], 0.4 * al); g.lineWidth = esp * 1.1 * z; arco(g, cx, cy, R - esp * 0.35, ini + 0.04, fim, z);
    g.strokeStyle = rgba(IMPACTO[0], 0.85 * al); g.lineWidth = Math.max(1.5, esp * 0.28 * z); arco(g, cx, cy, R - esp * 0.3, ini + 0.12, fim - 0.02, z);
    // dois arcos finos de velocidade por fora
    g.lineWidth = Math.max(1, z * 0.7);
    for (let i = 1; i <= 2; i++) { g.strokeStyle = rgba(i === 1 ? IMPACTO[0] : P[0], (0.5 - i * 0.15) * al); arco(g, cx, cy, R + i * 4, ini + 0.25 * i, fim - 0.05, z); }
  }
  g.restore();
}
