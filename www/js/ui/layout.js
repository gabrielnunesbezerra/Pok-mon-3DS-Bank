// Editor do layout de toque: arrastar botões e analógico, mudar o tamanho e escolher analógico fixo ou flutuante.
import { ANCHO, ALTO, UI } from '../config.js';
import { fondoMenu, texto, marco } from '../render/pixel.js';
import { ROSTER } from '../data/pokemon.js';
import { sfx } from '../audio.js';

const AJUSTE = 0.1, MIN = 0.7, MAX = 1.5;

export class LayoutTactil {
  constructor(app) {
    this.app = app; this.t = 0; this.agarre = null;
    // lutador de mentira só para os botões mostrarem os ícones de uma linha de verdade
    const kit = ROSTER[0].kit;
    this.demo = { kit, cd: {}, energia: 100, ulti: 70, ultiLista: false, calor: 0, puedeMega: true, puedeEvolucionar: false, luta: null, sobrecargaHasta: 0 };
  }
  get tactil() { return this.app.tactil; }
  entrar() { this.tactil.editando = true; this.tactil.l = this.demo; this.tactil.colocar(); }
  salir() { this.tactil.editando = false; this.tactil.l = null; }
  sair() { this.tactil.guardarLayout(); sfx('atras'); this.app.ir('titulo', { menu: 'ajustes' }); }

  // botões do editor, no alto e no meio da tela, longe das áreas dos dedos
  botones() {
    const x = ANCHO / 2, lay = this.tactil.lay;
    return [
      { id: 'fijo', x: x - 100, y: 70, w: 200, h: 22, txt: `STICK: ${lay.fijo ? 'FIXED' : 'FLOATING'}` },
      { id: 'menos', x: x - 100, y: 98, w: 96, h: 22, txt: 'SIZE -' },
      { id: 'mas', x: x + 4, y: 98, w: 96, h: 22, txt: 'SIZE +' },
      { id: 'reset', x: x - 100, y: 126, w: 96, h: 22, txt: 'RESET' },
      { id: 'listo', x: x + 4, y: 126, w: 96, h: 22, txt: 'DONE', oro: true },
    ];
  }
  accion(id) {
    const tc = this.tactil, lay = tc.lay;
    if (id === 'fijo') lay.fijo = !lay.fijo;
    else if (id === 'menos') lay.escala = Math.max(MIN, +(lay.escala - AJUSTE).toFixed(2));
    else if (id === 'mas') lay.escala = Math.min(MAX, +(lay.escala + AJUSTE).toFixed(2));
    else if (id === 'reset') tc.restaurarLayout();
    else if (id === 'listo') return this.sair();
    sfx('confirmar'); tc.guardarLayout(); tc.colocar();
  }
  tecla(c, nueva) { if (nueva && (c === 'Escape' || c === 'Backspace' || c === 'Enter')) this.sair(); }

  puntero(tipo, p) {
    const tc = this.tactil;
    if (tipo === 'down') {
      for (const b of this.botones()) if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return this.accion(b.id);
      tc.colocar();
      let mejor = null, dm = Infinity;
      for (const b of tc.botones) { const d = Math.hypot(p.x - b.x, p.y - b.y); if (d < b.r + 8 && d < dm) { mejor = { id: b.id, x: b.x, y: b.y }; dm = d; } }
      const s = tc.stick, ds = Math.hypot(p.x - s.x0, p.y - s.y0);
      if (ds < s.r + 8 && ds < dm) mejor = { id: 'stick', x: s.x0, y: s.y0 };
      if (mejor) this.agarre = { id: mejor.id, dx: p.x - mejor.x, dy: p.y - mejor.y };
    } else if (tipo === 'move' && this.agarre) {
      const a = this.agarre, d = tc.defecto(a.id);
      const o = { x: Math.round(p.x - a.dx - d.x), y: Math.round(p.y - a.dy - d.y) };
      if (a.id === 'stick') tc.lay.stick = o; else tc.lay.b[a.id] = o;
      tc.colocar();
    } else if (tipo === 'up' && this.agarre) { this.agarre = null; tc.guardarLayout(); }
  }
  actualizar(dt) { this.t += dt; }

  dibujar(g) {
    fondoMenu(g, ANCHO, ALTO);
    g.save(); g.globalAlpha = 0.12; g.fillStyle = '#8fd3ff';
    for (let x = 0; x < ANCHO; x += 32) g.fillRect(x, 0, 1, ALTO);
    for (let y = 0; y < ALTO; y += 32) g.fillRect(0, y, ANCHO, 1);
    g.restore();
    texto(g, 'TOUCH LAYOUT', ANCHO / 2, 10, { tam: 14, color: UI.amarillo, borde: 4, align: 'center' });
    texto(g, 'Drag the buttons and the stick where it feels best', ANCHO / 2, 40, { tam: 8, align: 'center', color: '#fff', borde: 2 });
    texto(g, this.tactil.lay.fijo ? 'Fixed stick: the base never follows your finger' : 'Floating stick: the base appears where you touch', ANCHO / 2, 54, { tam: 7, align: 'center', color: '#7dd3fc', borde: 2 });
    for (const b of this.botones()) {
      marco(g, b.x, b.y, b.w, b.h, b.oro ? 'oro' : 'azul');
      texto(g, b.txt, b.x + b.w / 2, b.y + b.h / 2, { tam: 9, align: 'center', base: 'middle', color: b.oro ? UI.textoOscuro : '#fff' });
    }
    this.tactil.dibujar(g, this.t);
    if (this.agarre) {
      const b = this.agarre.id === 'stick' ? { x: this.tactil.stick.x0, y: this.tactil.stick.y0, r: this.tactil.stick.r } : this.tactil.botones.find(x => x.id === this.agarre.id);
      if (b) { g.save(); g.strokeStyle = '#ffe27a'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.arc(b.x, b.y, b.r + 5, 0, 7); g.stroke(); g.restore(); }
    }
  }
}
