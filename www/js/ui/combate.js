// Em construção (fases 2 e 3)
import { ANCHO, ALTO } from '../config.js';
import { fondoMenu, texto } from '../render/pixel.js';
export class Combate {
  constructor(app) { this.app = app; }
  tecla(c, nueva) { if (nueva && (c === 'Escape' || c === 'Backspace')) this.app.ir('titulo'); }
  puntero(tipo) { if (tipo === 'down') this.app.ir('titulo'); }
  dibujar(g) { fondoMenu(g, ANCHO, ALTO); texto(g, 'COMING SOON', ANCHO / 2, ALTO / 2, { tam: 16, align: 'center', base: 'middle', borde: 4 }); }
}
