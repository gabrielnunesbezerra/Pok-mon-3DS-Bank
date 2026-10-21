// Menus desenhados para 640 de largura: em tela mais larga (celular) ficam centralizados.
import { ANCHO, ALTO, setAncho } from '../config.js';
import { fondoMenu } from '../render/pixel.js';

export function centrada(C) {
  const d0 = C.prototype.dibujar, p0 = C.prototype.puntero;
  C.prototype.dibujar = function (g) {
    const real = ANCHO, dx = (real - 640) / 2;
    fondoMenu(g, real, ALTO);
    g.save(); g.translate(dx, 0);
    setAncho(640);
    try { d0.call(this, g); } finally { setAncho(real); g.restore(); }
  };
  if (p0) C.prototype.puntero = function (t, p, e) { return p0.call(this, t, { x: p.x - (ANCHO - 640) / 2, y: p.y }, e); };
}
