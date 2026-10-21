// Limites da arena oval e empurrões na borda.
import { OVALO } from '../config.js';

export function limitarCampo(x, y, margen = 0) {
  const o = OVALO;
  const dx = (x - o.cx) / (o.rx - margen), dy = (y - o.cy) / (o.ry - margen), e = dx * dx + dy * dy;
  if (e <= 1) return { x, y };
  const k = 1 / Math.sqrt(e);
  return { x: o.cx + (x - o.cx) * k, y: o.cy + (y - o.cy) * k };
}
export function fueraCampo(x, y, m = 0) {
  const o = OVALO;
  const dx = (x - o.cx) / (o.rx + m), dy = (y - o.cy) / (o.ry + m);
  return dx * dx + dy * dy > 1;
}
// ponto dentro da arena mais próximo (para pedras, ondas e invocações)
export const fijarCampo = (x, y) => limitarCampo(x, y, 6);
