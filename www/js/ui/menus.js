// Lista de botões navegável por teclado, mouse e toque (usada pela tela inicial e pela pausa).
import { marco, texto, icono } from '../render/pixel.js';
import { UI } from '../config.js';
import { sfx } from '../audio.js';

export class ListaBotones {
  constructor({ x = 320, y = 136, w = 210, h = 23, paso = 25, ops = [], alElegir, tam = 8, cols = 1, sepX = 0 }) {
    Object.assign(this, { x, y, w, h, paso, ops, alElegir, tam, cols, sepX });
    this.foco = 0;
  }
  caja(i) {
    const col = i % this.cols, fila = Math.floor(i / this.cols);
    const dx = this.cols === 1 ? 0 : (col - (this.cols - 1) / 2) * this.sepX;
    return { x: this.x - this.w / 2 + dx, y: this.y + fila * this.paso, w: this.w, h: this.h };
  }
  mover(d) { this.foco = (this.foco + d + this.ops.length) % this.ops.length; sfx('seleccion'); }
  moverCuadro(dc, df) {
    const n = this.ops.length, filas = Math.ceil(n / this.cols);
    const col = ((this.foco % this.cols) + dc + this.cols) % this.cols, fila = (Math.floor(this.foco / this.cols) + df + filas) % filas;
    this.foco = Math.min(n - 1, fila * this.cols + col); sfx('seleccion');
  }
  elegir(i = this.foco) { const o = this.ops[i]; if (o && !o.apagado) { sfx(o.atras ? 'atras' : 'confirmar'); this.alElegir(o, i); } }
  tecla(c) {
    if (this.cols > 1 && (c === 'ArrowLeft' || c === 'KeyA')) this.moverCuadro(-1, 0);
    else if (this.cols > 1 && (c === 'ArrowRight' || c === 'KeyD')) this.moverCuadro(1, 0);
    else if (c === 'ArrowUp' || c === 'KeyW') this.cols > 1 ? this.moverCuadro(0, -1) : this.mover(-1);
    else if (c === 'ArrowDown' || c === 'KeyS') this.cols > 1 ? this.moverCuadro(0, 1) : this.mover(1);
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
          const w = 6 - Math.abs(j), x = this.cols > 1 ? Math.round(c.x - 9 + bob) : Math.round(c.x + c.w + 7 + bob), y = Math.round(c.y + c.h / 2 + j);
          g.fillStyle = '#04102c'; g.fillRect(x, y, w, 1);
          if (w > 2) { g.fillStyle = j < 0 ? '#fff2a0' : '#f8c448'; g.fillRect(x + 1, y, w - 2, 1); }
        }
      }
    });
  }
}

// Menu de cartões (tela inicial): cada opção tem a sua caixa (x, y, w, h), cor, subtítulo e arte de Pokémon.
// Mesma interface da ListaBotones (ops, foco, tecla, puntero, dibujar). Setas andam para o cartão mais perto naquela direção.
export class MenuTarjetas {
  constructor({ ops, alElegir, bank }) { this.ops = ops; this.alElegir = alElegir; this.bank = bank; this.foco = 0; }
  caja(i) { return this.ops[i]; }
  mover(dx, dy) {
    const a = this.ops[this.foco], cx = a.x + a.w / 2, cy = a.y + a.h / 2;
    let mejor = -1, dm = Infinity;
    this.ops.forEach((o, i) => {
      if (i === this.foco) return;
      const ox = o.x + o.w / 2 - cx, oy = o.y + o.h / 2 - cy;
      if (dx && (Math.sign(ox) !== dx || Math.abs(ox) < 4)) return;
      if (dy && (Math.sign(oy) !== dy || Math.abs(oy) < 4)) return;
      const d = dx ? Math.abs(ox) + Math.abs(oy) * 3 : Math.abs(oy) + Math.abs(ox) * 0.6;
      if (d < dm) { dm = d; mejor = i; }
    });
    if (mejor >= 0) { this.foco = mejor; sfx('seleccion'); }
  }
  elegir(i = this.foco) { const o = this.ops[i]; if (o && !o.apagado) { sfx(o.atras ? 'atras' : 'confirmar'); this.alElegir(o, i); } }
  tecla(c) {
    if (c === 'ArrowLeft' || c === 'KeyA') this.mover(-1, 0);
    else if (c === 'ArrowRight' || c === 'KeyD') this.mover(1, 0);
    else if (c === 'ArrowUp' || c === 'KeyW') this.mover(0, -1);
    else if (c === 'ArrowDown' || c === 'KeyS') this.mover(0, 1);
    else if (c === 'Enter' || c === 'Space' || c === 'NumpadEnter') this.elegir();
    else return false;
    return true;
  }
  puntero(tipo, p) {
    if (tipo !== 'move' && tipo !== 'down') return false;
    for (let i = 0; i < this.ops.length; i++) {
      const c = this.ops[i];
      if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) {
        if (this.foco !== i) { this.foco = i; sfx('seleccion'); }
        if (tipo === 'down') this.elegir(i);
        return true;
      }
    }
    return false;
  }
  dibujar(g, t) {
    this.ops.forEach((o, i) => {
      const f = i === this.foco, { x, y, w, h } = o, grande = h >= 48, cor = o.cor ?? '#4a9fff', esc = f ? 1.04 + Math.sin(t * 5) * 0.008 : 1;
      g.save();
      g.translate(x + w / 2, y + h / 2); g.scale(esc, esc); g.translate(-(x + w / 2), -(y + h / 2));
      // sombra e corpo de vidro escuro com borda na cor do cartão
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.roundRect(x + 2, y + 3, w, h, grande ? 12 : 9); g.fill();
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, f ? 'rgba(46,70,128,0.95)' : 'rgba(20,32,66,0.9)'); gr.addColorStop(1, f ? 'rgba(14,24,58,0.97)' : 'rgba(8,14,34,0.92)');
      g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, w, h, grande ? 12 : 9); g.fill();
      // arte: retratos dos Pokémon no canto (cortados pela borda do cartão)
      if (o.arte && this.bank) {
        g.save(); g.beginPath(); g.roundRect(x, y, w, h, grande ? 12 : 9); g.clip();
        const artes = [].concat(o.arte), tam = grande ? h - 10 : h - 6;
        artes.forEach((dex, k) => {
          const img = this.bank.retrato(dex);
          if (!img) return;
          const ax = x + w - 6 - tam - k * (tam * 0.62), ay = y + (h - tam) / 2 + (grande ? 6 : 0);
          g.globalAlpha = f ? 1 : 0.75; g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, ax, ay, tam, tam);
        });
        g.globalAlpha = 1;
        // escurece o lado do texto para ele ler bem por cima da arte
        const sombraTxt = g.createLinearGradient(x, 0, x + w * 0.75, 0); sombraTxt.addColorStop(0, 'rgba(8,14,34,0.95)'); sombraTxt.addColorStop(0.6, 'rgba(8,14,34,0.6)'); sombraTxt.addColorStop(1, 'rgba(8,14,34,0)');
        g.fillStyle = sombraTxt; g.fillRect(x, y, w, h);
        // brilho passando pelo cartão em foco
        if (f) { const sx = x - 40 + ((t * 160) % (w + 80)); const br = g.createLinearGradient(sx, 0, sx + 30, 0); br.addColorStop(0, 'rgba(255,255,255,0)'); br.addColorStop(0.5, 'rgba(255,255,255,0.16)'); br.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = br; g.fillRect(x, y, w, h); }
        g.restore();
      }
      g.lineWidth = f ? 2 : 1; g.strokeStyle = cor; g.globalAlpha = f ? 1 : 0.65; g.beginPath(); g.roundRect(x, y, w, h, grande ? 12 : 9); g.stroke(); g.globalAlpha = 1;
      // faixa de cor no alto
      g.fillStyle = cor; g.globalAlpha = f ? 0.95 : 0.6; g.beginPath(); g.roundRect(x + 8, y, Math.min(46, w - 16), 3, 2); g.fill(); g.globalAlpha = 1;
      if (grande) {
        if (o.ico) icono(g, o.ico, x + 10, y + 12, cor);
        texto(g, o.txt, x + 10, y + h - 30, { tam: 12, color: '#ffffff', borde: 3, peso: 700, max: w - 20 });
        if (o.sub) texto(g, o.sub, x + 10, y + h - 14, { tam: 6, color: f ? '#e0ecff' : '#9fb3d8', max: w - 16 });
      } else {
        if (o.ico) icono(g, o.ico, x + 7, y + (h - 9) / 2, cor);
        texto(g, o.txt, x + (o.ico ? 20 : 8) + (w - (o.ico ? 28 : 16)) / 2, y + h / 2, { tam: 7, color: o.apagado ? UI.apagado : '#ffffff', borde: 2, align: 'center', base: 'middle', max: w - 26 });
      }
      g.restore();
    });
  }
}
