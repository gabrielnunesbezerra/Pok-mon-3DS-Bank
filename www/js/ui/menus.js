// Lista de botões navegável por teclado, mouse e toque (usada pela tela inicial e pela pausa).
import { marco, texto, icono } from '../render/pixel.js';
import { UI } from '../config.js';
import { sfx } from '../audio.js';

export class ListaBotones {
  constructor({ x = 320, y = 136, w = 210, h = 23, paso = 25, ops = [], alElegir, tam = 8 }) {
    Object.assign(this, { x, y, w, h, paso, ops, alElegir, tam });
    this.foco = 0;
  }
  caja(i) { return { x: this.x - this.w / 2, y: this.y + i * this.paso, w: this.w, h: this.h }; }
  mover(d) { this.foco = (this.foco + d + this.ops.length) % this.ops.length; sfx('seleccion'); }
  elegir(i = this.foco) { const o = this.ops[i]; if (o && !o.apagado) { sfx(o.atras ? 'atras' : 'confirmar'); this.alElegir(o, i); } }
  tecla(c) {
    if (c === 'ArrowUp' || c === 'KeyW') this.mover(-1);
    else if (c === 'ArrowDown' || c === 'KeyS') this.mover(1);
    else if (c === 'Enter' || c === 'Space' || c === 'NumpadEnter') this.elegir();
    else return false;
    return true;
  }
  puntero(tipo, p) {
    if (tipo !== 'move' && tipo !== 'down') return false;
    for (let i = 0; i < this.ops.length; i++) {
      const c = this.caja(i);
      if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y - 1 && p.y <= c.y + c.h + 2) {
        if (this.foco !== i) { this.foco = i; sfx('seleccion'); }
        if (tipo === 'down') this.elegir(i);
        return true;
      }
    }
    return false;
  }
  dibujar(g, t) {
    this.ops.forEach((o, i) => {
      const c = this.caja(i), f = i === this.foco;
      marco(g, c.x, c.y, c.w, c.h, o.apagado ? 'apagado' : f ? 'oro' : 'azul');
      if (o.ico) icono(g, o.ico, c.x + 8, c.y + (c.h - 9) / 2, f ? '#7a4a00' : '#ffd23c');
      texto(g, o.txt, c.x + 44 + (c.w - 52) / 2, c.y + c.h / 2, { tam: this.tam * 2, color: o.apagado ? UI.apagado : f ? UI.textoOscuro : UI.texto, borde: f ? 0 : 4, align: 'center', base: 'middle', max: c.w - 54 });
      if (f) {
        const bob = Math.round(Math.sin(t * 9) * 2);
        for (let j = -5; j <= 5; j++) {
          const w = 6 - Math.abs(j), x = Math.round(c.x + c.w + 7 + bob), y = Math.round(c.y + c.h / 2 + j);
          g.fillStyle = '#04102c'; g.fillRect(x, y, w, 1);
          if (w > 2) { g.fillStyle = j < 0 ? '#fff2a0' : '#f8c448'; g.fillRect(x + 1, y, w - 2, 1); }
        }
      }
    });
  }
}
