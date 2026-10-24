// Tela da Liga Pokémon: quatro circuitos em colunas. Toque num rival aberto para escolher o seu Pokémon e lutar.
import { ANCHO, ALTO, UI } from '../config.js';
import { ROSTER } from '../data/pokemon.js';
import { fondoMenu, texto, marco, rect } from '../render/pixel.js';
import { sfx } from '../audio.js';
import { centrada } from './centrar.js';
import { LIGA, estadoRival, vitorias, nivelProximo, NOMBRE_DIFICULTAD, desbloqueados, circuitoAbierto, completo, ligaCompleta } from '../liga/liga.js';

const COR_ESTRELA = ['#e0915a', '#dfe7f0', '#ffd23c'];
const COL = { w: 150, gap: 8, y0: 46, card: 46, cardGap: 4 };

// silhueta preta do retrato (rival ainda trancado)
const siluetas = new Map();
function silueta(img) {
  let c = siluetas.get(img);
  if (c) return c;
  c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#0b1226'; g.fillRect(0, 0, c.width, c.height);
  siluetas.set(img, c);
  return c;
}

export class Liga {
  constructor(app) { this.app = app; this.t = 0; this.foco = { c: Math.min(circuitoAbierto(), LIGA.circuitos.length - 1), r: 0 }; this.aviso = null; }
  entrar() { for (const id of LIGA.circuitos.flatMap(c => c.rivales)) { const p = ROSTER.find(x => x.id === id); if (p) this.app.bank.retrato(p.dex); } }
  colX(c) { return COL.gap + c * (COL.w + COL.gap); }
  caja(c, r) { return { x: this.colX(c) + 4, y: COL.y0 + 34 + r * (COL.card + COL.cardGap), w: COL.w - 8, h: COL.card }; }
  volver() { sfx('atras'); this.app.ir('titulo', { menu: 'jugar' }); }

  elegir(c, r) {
    const id = LIGA.circuitos[c]?.rivales[r];
    if (!id) return;
    const est = estadoRival(id);
    if (est === 'cerrado') { sfx('atras'); this.aviso = { t0: this.t, txt: 'BEAT EVERY RIVAL OF THE PREVIOUS CIRCUIT FIRST' }; return; }
    sfx('confirmar');
    this.app.ir('seleccion', { modo: 'liga', liga: id });
  }

  tecla(c, nueva) {
    if (!nueva) return;
    if (c === 'Escape' || c === 'Backspace') return this.volver();
    const f = this.foco, nC = LIGA.circuitos.length;
    if (c === 'ArrowRight' || c === 'KeyD') { f.c = (f.c + 1) % nC; f.r = Math.min(f.r, LIGA.circuitos[f.c].rivales.length - 1); sfx('seleccion'); }
    else if (c === 'ArrowLeft' || c === 'KeyA') { f.c = (f.c + nC - 1) % nC; f.r = Math.min(f.r, LIGA.circuitos[f.c].rivales.length - 1); sfx('seleccion'); }
    else if (c === 'ArrowDown' || c === 'KeyS') { f.r = (f.r + 1) % LIGA.circuitos[f.c].rivales.length; sfx('seleccion'); }
    else if (c === 'ArrowUp' || c === 'KeyW') { const n = LIGA.circuitos[f.c].rivales.length; f.r = (f.r + n - 1) % n; sfx('seleccion'); }
    else if (c === 'Enter' || c === 'Space' || c === 'NumpadEnter') this.elegir(f.c, f.r);
  }
  puntero(tipo, p) {
    if (tipo !== 'down' && tipo !== 'move') return;
    if (tipo === 'down' && p.x >= 4 && p.x <= 80 && p.y >= 4 && p.y <= 22) return this.volver();
    LIGA.circuitos.forEach((ci, c) => ci.rivales.forEach((_, r) => {
      const b = this.caja(c, r);
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { this.foco = { c, r }; if (tipo === 'down') this.elegir(c, r); }
    }));
  }
  actualizar(dt) { this.t += dt; }

  dibujar(g) {
    const bank = this.app.bank, t = this.t, aberto = circuitoAbierto();
    fondoMenu(g, ANCHO, ALTO);
    marco(g, 0, 0, ANCHO, 26, 'panel');
    marco(g, 4, 4, 76, 18); texto(g, '< MENU', 42, 13, { tam: 7, align: 'center', base: 'middle' });
    texto(g, 'POKÉMON LEAGUE', ANCHO / 2, 13, { tam: 12, color: UI.amarillo, borde: 3, align: 'center', base: 'middle' });
    texto(g, `UNLOCKED ${desbloqueados().length}/${ROSTER.length}`, ANCHO - 8, 13, { tam: 7, align: 'right', base: 'middle', color: '#7dd3fc' });
    LIGA.circuitos.forEach((ci, c) => {
      const x = this.colX(c), feito = completo(ci), trancado = c > aberto;
      marco(g, x, 30, COL.w, ALTO - 62, trancado ? 'apagado' : 'panel');
      rect(g, x + 2, 31, COL.w - 4, 16, trancado ? '#2a3040' : ci.cor, trancado ? 1 : 0.85);
      texto(g, ci.nombre, x + COL.w / 2, 39, { tam: 7, align: 'center', base: 'middle', color: trancado ? '#7a8498' : '#0a1428', max: COL.w - 10 });
      texto(g, feito ? 'CLEARED' : trancado ? 'LOCKED' : 'OPEN', x + COL.w / 2, 54, { tam: 6, align: 'center', base: 'middle', color: feito ? '#ffd23c' : trancado ? '#7a8498' : '#86efac' });
      ci.rivales.forEach((id, r) => {
        const p = ROSTER.find(q => q.id === id), b = this.caja(c, r), est = estadoRival(id), v = vitorias(id), foco = this.foco.c === c && this.foco.r === r;
        marco(g, b.x, b.y, b.w, b.h, foco ? 'oro' : est === 'cerrado' ? 'apagado' : 'azul');
        const img = p && bank.retrato(p.dex);
        if (img) g.drawImage(est === 'cerrado' ? silueta(img) : img, 0, 0, img.naturalWidth, img.naturalHeight, b.x + 4, b.y + 4, 38, 38);
        if (est === 'cerrado') { rect(g, b.x + 18, b.y + 20, 10, 8, '#ffd23c'); rect(g, b.x + 20, b.y + 15, 6, 6, '#ffd23c'); rect(g, b.x + 21, b.y + 16, 4, 4, '#0b1226'); }
        texto(g, est === 'cerrado' ? '???' : p.nombre, b.x + 46, b.y + 10, { tam: 7, color: foco ? UI.textoOscuro : '#fff', max: b.w - 50 });
        for (let k = 0; k < 3; k++) { const sx = b.x + 46 + k * 12; rect(g, sx, b.y + 20, 9, 9, '#04102c'); rect(g, sx + 1, b.y + 21, 7, 7, k < v ? COR_ESTRELA[k] : '#1d2a3a'); if (k < v) rect(g, sx + 2, b.y + 22, 2, 2, '#ffffff'); }
        const prox = v >= 3 ? 'DONE' : est === 'cerrado' ? '' : NOMBRE_DIFICULTAD[nivelProximo(id)];
        texto(g, prox, b.x + 46, b.y + 36, { tam: 6, color: v >= 3 ? '#ffd23c' : nivelProximo(id) === 'dificil' ? '#ff7a7a' : nivelProximo(id) === 'normal' ? '#ffd166' : '#86efac' });
      });
    });
    texto(g, ligaCompleta() ? 'LEAGUE CLEARED! The starters got their shiny.' : '1 win unlocks the Pokémon · 2 wins its profile icon · 3 wins its shiny', ANCHO / 2, ALTO - 20, { tam: 7, align: 'center', color: UI.suave });
    if (this.aviso && t - this.aviso.t0 < 1.8) texto(g, this.aviso.txt, ANCHO / 2, ALTO - 8, { tam: 7, align: 'center', color: '#ff9a7a', borde: 2 });
  }
}

centrada(Liga);
