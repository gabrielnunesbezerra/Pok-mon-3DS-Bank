// Obstáculos e mecânicas de cada arena (parte do motor: os dois aparelhos do online calculam igual).
//  - ruínas: pedras grandes que bloqueiam o caminho e os tiros
//  - halloween: lápides que bloqueiam o caminho e os tiros
//  - praia: um rio no meio divide a arena; só dá para atravessar pelas duas pontes
//  - cratera: poças de lava que queimam quem pisa
//  - neon: placas de impulso que deixam mais rápido por um instante
//  - estádio: campo livre
import { OVALO, RADIO } from '../config.js';

const C = OVALO;
const P = (fx, fy) => ({ x: Math.round(C.cx + fx * C.rx), y: Math.round(C.cy + fy * C.ry) });
export const ACHATA = 0.6; // a pedra é redonda, mas em perspectiva fica achatada no chão

export const MAPAS = {
  ruinas: { pedras: [[-0.42, -0.42, 26], [0.44, 0.4, 28], [-0.12, 0.55, 20], [0.16, -0.52, 22], [-0.66, 0.28, 18], [0.66, -0.22, 20], [-0.3, 0.05, 15], [0.3, -0.02, 15]].map(([fx, fy, r]) => ({ ...P(fx, fy), r, tipo: 'pedra' })) },
  halloween: { pedras: [[-0.5, -0.3, 14], [-0.36, 0.42, 14], [0.5, 0.32, 14], [0.38, -0.42, 14], [0, -0.6, 13], [0, 0.62, 13], [-0.18, 0.02, 12], [0.18, 0.02, 12]].map(([fx, fy, r]) => ({ ...P(fx, fy), r, tipo: 'lapide' })) },
  praia: { rio: { x: C.cx, meio: 30, pontes: [{ y: Math.round(C.cy - C.ry * 0.48), meio: 24 }, { y: Math.round(C.cy + C.ry * 0.48), meio: 24 }] } },
  crater: { lava: [{ ...P(-0.4, 0.12), rx: 64, ry: 34 }, { ...P(0.4, -0.12), rx: 64, ry: 34 }, { ...P(0, 0.62), rx: 50, ry: 22 }, { ...P(0, -0.62), rx: 50, ry: 22 }] },
  neon: { pads: [{ ...P(-0.5, 0), r: 24 }, { ...P(0.5, 0), r: 24 }, { ...P(0, -0.56), r: 22 }, { ...P(0, 0.56), r: 22 }] },
};

const naPonte = (rio, y) => rio.pontes.some(b => Math.abs(y - b.y) < b.meio - 3);
// ponte mais perto de (x, y)
export function pontePerto(luta, y) { const r = MAPAS[luta.arena]?.rio; if (!r) return null; let m = null; for (const b of r.pontes) if (!m || Math.abs(b.y - y) < Math.abs(m.y - y)) m = b; return { x: r.x, y: m.y }; }
export const temRio = luta => !!MAPAS[luta.arena]?.rio;
export const ladoDoRio = (luta, x) => Math.sign(x - (MAPAS[luta.arena]?.rio?.x ?? x)) || 1;

// empurra o lutador para fora dos obstáculos e aplica a mecânica do chão
export function resolverLutador(luta, l, dt) {
  const m = MAPAS[luta.arena];
  if (!m || l.ko || l.est.vuelo) return;
  if (m.pedras) for (const p of m.pedras) {
    const rr = p.r + RADIO, dx = l.x - p.x, dy = (l.y - p.y) / ACHATA, d = Math.hypot(dx, dy);
    if (d >= rr) continue;
    const ux = d > 0.01 ? dx / d : 1, uy = d > 0.01 ? dy / d : 0;
    l.x = p.x + ux * rr; l.y = p.y + uy * rr * ACHATA;
    const vn = l.empX * ux + l.empY * uy; if (vn < 0) { l.empX -= vn * ux; l.empY -= vn * uy; }
  }
  if (m.rio) {
    const r = m.rio, borda = r.meio + RADIO, dentro = Math.abs(l.x - r.x) < borda;
    if (l._ladoRio === undefined) l._ladoRio = Math.sign(l.x - r.x) || 1;
    if (dentro && !naPonte(r, l.y)) { l.x = r.x + l._ladoRio * borda; if (Math.sign(l.empX) === -l._ladoRio) l.empX = 0; }
    else if (!dentro || naPonte(r, l.y)) l._ladoRio = Math.sign(l.x - r.x) || l._ladoRio;
  }
  if (m.lava) {
    const pisa = m.lava.some(z => ((l.x - z.x) / z.rx) ** 2 + ((l.y - z.y) / z.ry) ** 2 < 1);
    if (pisa) {
      l._lava = (l._lava ?? 0) + dt;
      if (l._lava >= 0.4) { l._lava -= 0.4; l.recibir(null, { dano: 2.5, tipo: 'FIRE', tick: true, puro: true }); luta.emit({ t: 'lavaQueima', x: l.x, y: l.y }); }
    } else l._lava = 0;
  }
  if (m.pads) {
    const pad = m.pads.find(z => Math.hypot(l.x - z.x, (l.y - z.y) / ACHATA) < z.r);
    if (pad && l._pad !== pad) { l.ponerEstado('rapido', 1.4, { vel: 1.5 }); luta.emit({ t: 'padNeon', x: pad.x, y: pad.y, l }); }
    l._pad = pad ?? null;
  }
}
// pedra no caminho do tiro?
export function bloqueiaTiro(luta, x, y) {
  const m = MAPAS[luta.arena];
  if (!m?.pedras) return false;
  for (const p of m.pedras) if (Math.hypot(x - p.x, (y - p.y) / ACHATA) < p.r) return true;
  return false;
}
