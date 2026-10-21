// Câmera: segue os dois lutadores com zoom suave. A tela útil começa abaixo do HUD de cima.
import { ANCHO, ALTO, HUD_ALTO, MUNDO } from '../config.js';
import { clamp } from '../engine/util.js';

export class Camara {
  constructor() { this.z = 0.7; this.x = MUNDO.w / 2; this.y = MUNDO.h / 2; this.listo = false; }

  actualizar(dt, luchadores, conBarraAbajo) {
    const arriba = HUD_ALTO, abajo = conBarraAbajo ? 30 : 0, vh = ALTO - arriba - abajo;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, altoMax = 0;
    for (const l of luchadores) {
      x0 = Math.min(x0, l.x); x1 = Math.max(x1, l.x);
      y0 = Math.min(y0, l.y - l.alto - 12); y1 = Math.max(y1, l.y);
      altoMax = Math.max(altoMax, l.alto + 12);
    }
    const zMin = Math.max(0.5, Math.min(ANCHO / (MUNDO.w * 0.98), vh / (MUNDO.h * 0.98)));
    const zObj = Math.max(zMin, Math.min(1, ANCHO / (x1 - x0 + 220), vh / (y1 - y0 + 150)));
    const k = this.listo ? Math.min(1, dt * 2.5) : 1;
    this.z += (zObj - this.z) * k;
    const lim = (c, a, b, v) => Math.min(Math.max(a + v / 2, b - v / 2), Math.max(Math.min(a + v / 2, b - v / 2), c));
    const vw = ANCHO / this.z, vhw = vh / this.z;
    const cx = lim((x0 + x1) / 2, -8, MUNDO.w + 8, vw);
    const cy = lim((y0 + y1) / 2, -10, MUNDO.h + 20, vhw);
    if (!this.listo) { this.x = cx; this.y = cy; this.listo = true; }
    this.x += (cx - this.x) * k; this.y += (cy - this.y) * k;
    this.centroY = arriba + vh / 2;
  }

  aplicar(g, sx = 0, sy = 0) {
    g.translate(ANCHO / 2 + sx, this.centroY + sy);
    g.scale(this.z, this.z);
    g.translate(-this.x, -this.y);
  }
  aMundo(px, py) { return { x: (px - ANCHO / 2) / this.z + this.x, y: (py - this.centroY) / this.z + this.y }; }
  aPantalla(x, y) { return { x: (x - this.x) * this.z + ANCHO / 2, y: (y - this.y) * this.z + this.centroY }; }
}
