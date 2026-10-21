// Tela de controles (teclado, mouse, jogador 2 e controle).
import { ANCHO, ALTO, UI } from '../config.js';
import { fondoMenu, texto, marco } from '../render/pixel.js';
import { sfx } from '../audio.js';
import { centrada } from './centrar.js';

export const CONTROLES = {
  kbm: { mover: 'WASD', lmb: 'Left click', rmb: 'Right click', esp: 'Space', q: 'Q', e: 'E', mega: 'F' },
  teclado2: { mover: 'Arrows', lmb: 'K', rmb: 'L', esp: 'Enter', q: 'I', e: 'O', mega: 'P' },
};

export class Controles {
  constructor(app) { this.app = app; this.volver = { x: 20, y: 8, w: 76, h: 16 }; }
  sair() { sfx('atras'); this.app.ir('titulo', { menu: 'ajustes' }); }
  tecla(c, nueva) { if (nueva && (c === 'Escape' || c === 'Backspace' || c === 'Enter')) this.sair(); }
  puntero(tipo, p) { const v = this.volver; if (tipo === 'down' && p.x >= v.x && p.x <= v.x + v.w && p.y >= v.y && p.y <= v.y + v.h) this.sair(); }
  dibujar(g) {
    fondoMenu(g, ANCHO, ALTO);
    texto(g, 'CONTROLS', ANCHO / 2, 8, { tam: 16, color: UI.amarillo, borde: 4, align: 'center' });
    marco(g, this.volver.x, this.volver.y, this.volver.w, this.volver.h);
    texto(g, '< MENU', this.volver.x + this.volver.w / 2, this.volver.y + 8, { tam: 8, align: 'center', base: 'middle' });
    const k = CONTROLES.kbm, k2 = CONTROLES.teclado2;
    const filas = [
      ['KEYBOARD & MOUSE', `${k.mover} move · mouse aim · ${k.esp} dodge`],
      ['', `${k.lmb} basic · ${k.rmb} skill · ${k.q} utility`],
      ['', `${k.e} ultimate · ${k.mega} evolve / mega evolve`],
      ['PLAYER 2', `${k2.mover} move · ${k2.lmb} basic · ${k2.rmb} skill`],
      ['', `${k2.esp} dodge · ${k2.q} Q · ${k2.e} ultimate · ${k2.mega} evolve`],
      ['GAMEPAD', 'Left stick move · right stick aim · A dodge · X basic · B skill'],
      ['', 'Y utility · RT ultimate · LB evolve · START pause'],
      ['TOUCH', 'Left stick move · buttons on the right for each skill'],
      ['PAUSE', 'ESC or P'],
    ];
    filas.forEach(([a, b], i) => {
      const y = 50 + i * 26;
      if (a) texto(g, a, 40, y, { tam: 8, color: '#f8c448' });
      texto(g, b, 176, y, { tam: 8, max: ANCHO - 200 });
    });
  }
}

centrada(Controles);
