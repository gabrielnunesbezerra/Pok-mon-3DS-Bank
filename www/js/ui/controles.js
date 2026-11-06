// Tela de controles: as teclas do jogador 1 e do jogador 2 (clique numa e aperte a tecla nova),
// o dispositivo de cada um (teclado + mouse, só teclado, controle 1 ou 2) e o mapa do controle.
import { ALTO, UI } from '../config.js';
import { fondoMenu, texto, marco } from '../render/pixel.js';
import { sfx } from '../audio.js';
import { centrada } from './centrar.js';
import { ACOES, TECLAS_PADRAO, teclasDe, ENTRADAS, entradaDe, nombreTecla } from '../controles.js';

export const CONTROLES = {
  kbm: { mover: 'WASD', lmb: 'Left click', rmb: 'Right click', esp: 'Space', q: 'Q', e: 'E', mega: 'F' },
  teclado2: { mover: 'Arrows', lmb: 'K', rmb: 'L', esp: 'Enter', q: 'I', e: 'O', mega: 'P' },
};
const COL = { p1: 104, p2: 238, p3: 372, p4: 506 }, Y0 = 70, PASSO = 20, W = 124;

export class Controles {
  constructor(app) { this.app = app; this.volver = { x: 20, y: 8, w: 76, h: 16 }; this.esperando = null; }
  sair() { sfx('atras'); this.app.ir('titulo', { menu: 'ajustes' }); }
  salvarTecla(j, acao, codigo) {
    const aj = this.app.ajustes; aj.teclas ??= {}; aj.teclas[j] ??= {};
    // a mesma tecla não pode servir a duas ações: quem já tinha ela troca com a tecla antiga
    for (const jj of ['p1', 'p2', 'p3', 'p4']) { const k = teclasDe(this.app, jj); for (const [a] of ACOES) if (k[a] === codigo && !(jj === j && a === acao)) { aj.teclas[jj] ??= {}; aj.teclas[jj][a] = teclasDe(this.app, j)[acao]; } }
    aj.teclas[j][acao] = codigo; this.app.guardarAjustes?.();
  }
  tecla(c, nueva) {
    if (!nueva) return;
    if (this.esperando) {
      if (c !== 'Escape') { this.salvarTecla(this.esperando.j, this.esperando.acao, c); sfx('confirmar'); } else sfx('atras');
      this.esperando = null; return;
    }
    if (c === 'Escape' || c === 'Backspace') this.sair();
  }
  caixa(j, i) { return { x: COL[j], y: Y0 + i * PASSO, w: W, h: 16 }; }
  caixaEntrada(j) { return { x: COL[j], y: 44, w: W, h: 16 }; }
  caixaReset() { return { x: 270, y: Y0 + ACOES.length * PASSO + 4, w: 100, h: 16 }; }
  puntero(tipo, p) {
    if (tipo !== 'down') return;
    const em = c => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h;
    if (em(this.volver)) return this.sair();
    for (const j of ['p1', 'p2', 'p3', 'p4']) {
      if (em(this.caixaEntrada(j))) { const ops = ENTRADAS[j], i = ops.findIndex(([id]) => id === entradaDe(this.app, j)); this.app.ajustes.entrada ??= {}; this.app.ajustes.entrada[j] = ops[(i + 1) % ops.length][0]; this.app.guardarAjustes?.(); sfx('seleccion'); return; }
      ACOES.forEach(([acao], i) => { if (em(this.caixa(j, i))) { this.esperando = { j, acao }; sfx('seleccion'); } });
    }
    if (em(this.caixaReset())) { this.app.ajustes.teclas = {}; this.app.guardarAjustes?.(); sfx('confirmar'); }
  }
  dibujar(g) {
    fondoMenu(g, 640, ALTO);
    texto(g, 'CONTROLS', 320, 8, { tam: 16, color: UI.amarillo, borde: 4, align: 'center' });
    marco(g, this.volver.x, this.volver.y, this.volver.w, this.volver.h);
    texto(g, '< MENU', this.volver.x + this.volver.w / 2, this.volver.y + 8, { tam: 8, align: 'center', base: 'middle' });
    for (const j of ['p1', 'p2', 'p3', 'p4']) {
      texto(g, `PLAYER ${j[1]}`, COL[j] + W / 2, 32, { tam: 8, align: 'center', color: { p1: '#7db8ff', p2: '#ff8a8a', p3: '#86efac', p4: '#fde047' }[j] });
      const ce = this.caixaEntrada(j), ent = ENTRADAS[j].find(([id]) => id === entradaDe(this.app, j))?.[1] ?? '';
      marco(g, ce.x, ce.y, ce.w, ce.h, 'oro'); texto(g, `◀ ${ent} ▶`, ce.x + ce.w / 2, ce.y + 8, { tam: 8, align: 'center', base: 'middle' });
      const k = teclasDe(this.app, j);
      ACOES.forEach(([acao, nome], i) => {
        const c = this.caixa(j, i), sel = this.esperando?.j === j && this.esperando.acao === acao;
        if (j === 'p1') texto(g, nome, 14, c.y + 4, { tam: 8, color: '#f8c448' });
        marco(g, c.x, c.y, c.w, c.h, sel ? 'oro' : 'azul');
        texto(g, sel ? 'PRESS A KEY...' : nombreTecla(k[acao]) + (j === 'p1' && acao === 'lmb' ? ' / LMB' : j === 'p1' && acao === 'rmb' ? ' / RMB' : ''), c.x + c.w / 2, c.y + 8, { tam: 8, align: 'center', base: 'middle', color: sel ? '#ffd23c' : '#ffffff' });
      });
    }
    const r = this.caixaReset(); marco(g, r.x, r.y, r.w, r.h); texto(g, 'RESET KEYS', r.x + r.w / 2, r.y + 8, { tam: 8, align: 'center', base: 'middle' });
    texto(g, 'GAMEPAD: left stick move · right stick aim · A dash · X basic · B skill · Y utility · RT ult · LB evolve', 320, ALTO - 34, { tam: 6, align: 'center', color: '#c8d0e8' });
    texto(g, 'CLICK A KEY AND PRESS THE NEW ONE (ESC CANCELS) · KEYBOARD MODE AIMS AT THE RIVAL BY ITSELF', 320, ALTO - 20, { tam: 6, align: 'center', color: '#c8d0e8' });
    void TECLAS_PADRAO;
  }
}

centrada(Controles);
