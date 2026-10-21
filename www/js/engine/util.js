// Aleatório com semente (para testes e simulações repetíveis) e geometria básica.
let semente = 0x9e3779b9;
export function sembrar(s) { semente = (s >>> 0) || 1; }
export function aleatorio() {
  semente ^= semente << 13; semente >>>= 0;
  semente ^= semente >>> 17;
  semente ^= semente << 5; semente >>>= 0;
  return semente / 4294967296;
}
export const entre = (a, b) => a + aleatorio() * (b - a);
export const elegir = l => l[Math.floor(aleatorio() * l.length)];
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// diferença entre dois ângulos, de -PI a PI
export function difAng(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
// distância de um ponto a um segmento
export function distSegmento(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
