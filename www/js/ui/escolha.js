// Lista de Pokémon que abre ao tocar numa vaga (lobby, treino e online): grade com o retrato de todo o roster,
// opção aleatória e o atual marcado. Setas movem, Enter escolhe, Esc fecha.
import { ROSTER } from '../data/pokemon.js';
import { texto } from '../render/pixel.js';
import { sfx } from '../audio.js';

const G = { cols: 11, w: 54, h: 46, gap: 3, x0: 8, y0: 40 };

function caixa(g, x, y, w, h, fundo, borda, r = 5) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  if (fundo) { g.fillStyle = fundo; g.fill(); }
  if (borda) { g.strokeStyle = borda; g.lineWidth = 1.5; g.stroke(); }
}

export class Escolha {
  // alElegir(i): i = índice no ROSTER, ou -1 para aleatório
  constructor({ titulo = 'PICK A POKÉMON', atual = -1, aleatorio = false, alElegir, alFechar }) {
    this.titulo = titulo; this.aleatorio = aleatorio; this.alElegir = alElegir; this.alFechar = alFechar;
    this.atual = atual; this.cursor = Math.max(0, atual);
  }
  get total() { return ROSTER.length + (this.aleatorio ? 1 : 0); }
  pos(i) { return { x: G.x0 + (i % G.cols) * (G.w + G.gap), y: G.y0 + Math.floor(i / G.cols) * (G.h + G.gap), w: G.w, h: G.h }; }
  elegir(i) { sfx('confirmar'); this.alElegir?.(i >= ROSTER.length ? -1 : i); }
  fechar() { sfx('atras'); this.alFechar?.(); }

  puntero(tipo, p) {
    const em = c => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h;
    for (let i = 0; i < this.total; i++) {
      if (!em(this.pos(i))) continue;
      if (tipo === 'move') this.cursor = i;
      else if (tipo === 'down') this.elegir(i);
      return;
    }
    if (tipo === 'down' && em({ x: 4, y: 4, w: 70, h: 18 })) this.fechar();
  }
  tecla(c, nova) {
    if (!nova) return;
    const n = this.total;
    if (c === 'Escape' || c === 'Backspace') return this.fechar();
    if (c === 'Enter' || c === 'Space' || c === 'NumpadEnter') return this.elegir(this.cursor);
    const dx = ['ArrowRight', 'KeyD'].includes(c) ? 1 : ['ArrowLeft', 'KeyA'].includes(c) ? -1 : 0;
    const dy = ['ArrowDown', 'KeyS'].includes(c) ? G.cols : ['ArrowUp', 'KeyW'].includes(c) ? -G.cols : 0;
    if (dx || dy) { this.cursor = Math.min(n - 1, Math.max(0, this.cursor + dx + dy)); sfx('seleccion'); }
  }

  dibujar(g, bank) {
    g.fillStyle = 'rgba(8,16,40,0.92)'; g.fillRect(-200, 0, 1040, 360);
    caixa(g, 4, 4, 70, 18, '#1e3a6e', '#4f7bc4', 4); texto(g, '< BACK', 39, 9, { tam: 8, align: 'center', color: '#e6eefc' });
    texto(g, this.titulo, 320, 8, { tam: 12, align: 'center', color: '#facc15', borde: 2 });
    texto(g, `${ROSTER.length} POKÉMON · ALL UNLOCKED`, 320, 26, { tam: 6, align: 'center', color: '#9fc0f0' });
    for (let i = 0; i < this.total; i++) {
      const c = this.pos(i), def = ROSTER[i], foco = this.cursor === i, atual = i === this.atual;
      caixa(g, c.x, c.y, c.w, c.h, atual ? '#2a4a8a' : foco ? '#1f3260' : '#16223f', foco ? '#ffffff' : atual ? '#facc15' : '#4f7bc4', 5);
      if (!def) { texto(g, '?', c.x + c.w / 2, c.y + 6, { tam: 20, align: 'center', color: '#facc15' }); texto(g, 'RANDOM', c.x + c.w / 2, c.y + c.h - 10, { tam: 5, align: 'center', color: '#ffffff' }); continue; }
      const r = bank.retrato(def.dex);
      if (r) { g.imageSmoothingEnabled = false; g.drawImage(r, c.x + c.w / 2 - 15, c.y + 3, 30, 30); }
      texto(g, def.nombre, c.x + c.w / 2, c.y + c.h - 10, { tam: 5, align: 'center', color: '#ffffff', max: c.w - 4 });
    }
  }
}
