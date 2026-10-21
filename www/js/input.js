// Entrada: teclado, ponteiro (mouse e toque) em coordenadas lógicas, e controle (gamepad).
export class Entrada {
  constructor(canvas, aCoord) {
    this.teclas = new Set();
    this.ptr = { x: 0, y: 0, abajo: false, izq: false, der: false, fuera: true };
    this.alTecla = null;
    this.alPuntero = null;
    const bloquear = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace']);
    addEventListener('keydown', e => {
      if (bloquear.has(e.code)) e.preventDefault();
      if (!this.teclas.has(e.code)) this.alTecla?.(e.code, true, e);
      else if (e.code !== 'Space') this.alTecla?.(e.code, false, e);
      this.teclas.add(e.code);
    });
    addEventListener('keyup', e => this.teclas.delete(e.code));
    addEventListener('blur', () => { this.teclas.clear(); this.ptr.abajo = false; });
    const mover = e => { const p = aCoord(e.clientX, e.clientY); this.ptr.x = p.x; this.ptr.y = p.y; this.ptr.fuera = false; };
    canvas.addEventListener('pointermove', e => { mover(e); this.alPuntero?.('move', this.ptr, e); });
    canvas.addEventListener('pointerdown', e => {
      mover(e);
      this.ptr.abajo = true;
      if (e.pointerType === 'touch') { /* o toque é tratado pelo painel de toque */ } else if (e.button === 2) this.ptr.der = true; else this.ptr.izq = true;
      canvas.setPointerCapture?.(e.pointerId);
      this.alPuntero?.('down', this.ptr, e);
    });
    addEventListener('pointerup', e => { this.ptr.abajo = false; this.ptr.izq = false; this.ptr.der = false; this.alPuntero?.('up', this.ptr, e); });
    canvas.addEventListener('pointerleave', () => { this.ptr.fuera = true; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  abajo(...codes) { return codes.some(c => this.teclas.has(c)); }
  mando(i = 0) { return navigator.getGamepads?.()[i] ?? null; }
}
