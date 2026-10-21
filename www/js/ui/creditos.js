// Créditos: fonte dos sprites, fonte dos dados e avisos.
import { ANCHO, ALTO, UI } from '../config.js';
import { fondoMenu, texto, marco } from '../render/pixel.js';
import { sfx } from '../audio.js';

const LINEAS = [
  ['PK CONFRONT', 'Fan game 1v1, sem fins lucrativos. Não tem ligação com Nintendo, Creatures ou GAME FREAK.'],
  ['SPRITES', 'PMD Sprite Repository (SpriteCollab), CC BY-NC 4.0. Autores de cada sprite em assets/creditos.json.'],
  ['INSPIRAÇÃO', 'Regras e Pokémon baseados no Poké Arena 2D (pokearena2d.com), jogo de fã.'],
  ['FONTE', 'Pixelify Sans (Stefie Justprince), SIL OFL 1.1.'],
  ['SOM', 'Sintetizado no próprio jogo.'],
  ['POKÉMON', '© Nintendo, Creatures Inc. e GAME FREAK inc.'],
];

export class Creditos {
  constructor(app) { this.app = app; this.t = 0; this.volver = { x: 20, y: 8, w: 76, h: 16 }; }
  sair() { sfx('atras'); this.app.ir('titulo', { menu: 'principal' }); }
  tecla(c, nueva) { if (nueva && (c === 'Escape' || c === 'Backspace' || c === 'Enter')) this.sair(); }
  puntero(tipo, p) { const v = this.volver; if (tipo === 'down' && p.x >= v.x && p.x <= v.x + v.w && p.y >= v.y && p.y <= v.y + v.h) this.sair(); }
  actualizar(dt) { this.t += dt; }
  dibujar(g) {
    fondoMenu(g, ANCHO, ALTO);
    texto(g, 'CREDITS', ANCHO / 2, 8, { tam: 16, color: UI.amarillo, borde: 4, align: 'center' });
    marco(g, this.volver.x, this.volver.y, this.volver.w, this.volver.h);
    texto(g, '< MENU', this.volver.x + this.volver.w / 2, this.volver.y + 8, { tam: 8, align: 'center', base: 'middle' });
    LINEAS.forEach(([a, b], i) => {
      const y = 56 + i * 44;
      marco(g, 40, y, ANCHO - 80, 36, 'panel');
      texto(g, a, 52, y + 6, { tam: 8, color: '#f8c448' });
      texto(g, b, 52, y + 20, { tam: 8, max: ANCHO - 110 });
    });
  }
}
