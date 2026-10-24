// Escolha de Pokémon: grade 3x3 no centro, quadro de cada lado com sprite, tipos, atributos e as 5 skills.
import { ANCHO, ALTO, UI, hex } from '../config.js';
import { ROSTER, ROLES } from '../data/pokemon.js';
import { ARENAS } from '../data/arenas.js';
import { TIPOS } from '../data/regras.js';
import { fondoMenu, texto, marco, rect } from '../render/pixel.js';
import { formasDe } from '../render/sprites.js';
import { sfx } from '../audio.js';
import { centrada } from './centrar.js';
import { desbloqueado, shinyLiberado, circuitoDe, nivelProximo, NOMBRE_DIFICULTAD, vitorias } from '../liga/liga.js';

const NIVELES = ['facil', 'normal', 'dificil'];
const NOMBRE_NIVEL = { facil: 'EASY', normal: 'NORMAL', dificil: 'HARD' };
const SLOTS = [['lmb', 'LMB'], ['rmb', 'RMB'], ['esp', 'SPC'], ['q', 'Q'], ['e', 'E']];
const COLS = 4;
const CARD = { w: 64, h: 30, gap: 4, x0: 186, y0: 56 };
const SHINY_TOQUES = 20;

export class Seleccion {
  constructor(app, datos = {}) {
    this.app = app;
    this.modo = datos.modo ?? 'cpu';
    this.t = 0;
    // Liga Pokémon: o rival e a arena vêm do circuito, a dificuldade depende de quantas vezes você já o venceu
    this.liga = this.modo === 'liga' ? datos.liga : null;
    const ant = app.ultimaSeleccion;
    const azar = () => Math.floor(Math.random() * ROSTER.length);
    this.online = this.modo === 'online' ? app.online : null;
    this.n = this.modo === 'arena' ? 3 : this.online ? this.online.n : 2;
    this.mi = this.online ? this.online.lado : 0; // meu lugar na luta
    this.elegido = this.online ? Array.from({ length: this.n }, (_, i) => (i === this.mi ? (ant?.[0] ?? 0) : -1)) : [ant?.[0] ?? 0, this.modo === 'entreno' ? 1 : (ant?.[1] ?? azar()), this.n === 3 ? (ant?.[2] ?? azar()) : -1];
    this.arenaPronta = null;
    this.cursor = this.elegido[this.mi];
    this.lado = this.mi; // quem está sendo editado: 0 = jogador 1, 1 e 2 = oponentes
    this.nivel = app.ajustes.nivel ?? 'normal';
    this.arena = Math.max(0, ARENAS.findIndex(a => a.id === app.ajustes.arena));
    this.foco = 'grade'; // 'grade' | 'arena' | 'nivel' | 'luchar' | 'volver'
    this.aleatorio = [false, this.modo !== 'versus' && !this.online, this.n === 3 && !this.online];
    if (this.liga) {
      const ri = ROSTER.findIndex(p => p.id === this.liga), c = circuitoDe(this.liga);
      this.elegido[1] = ri; this.aleatorio = [false, false, false];
      this.nivel = nivelProximo(this.liga);
      this.arena = Math.max(0, ARENAS.findIndex(a => a.id === c?.arena));
    }
    // o seu Pokémon tem que estar desbloqueado na Liga
    if (!desbloqueado(ROSTER[this.elegido[this.mi]]?.id)) this.elegido[this.mi] = Math.max(0, ROSTER.findIndex(p => desbloqueado(p.id)));
    if (this.modo === 'versus' && !desbloqueado(ROSTER[this.elegido[1]]?.id)) this.elegido[1] = this.elegido[0];
    this.cursor = this.elegido[this.mi];
    if (this.online) this.preparar();
  }
  // lados controlados por gente só podem usar Pokémon desbloqueados
  ladoHumano(lado) { return this.online ? lado === this.mi : lado === 0 || (this.modo === 'versus' && lado === 1); }

  entrar() { for (const p of ROSTER) { const f = [p, ...(p.evoluciones ?? [])]; for (const x of f) { this.app.bank.hoja(x.dex, 'Idle'); this.app.bank.retrato(x.dex); } } }

  atras() {
    sfx('atras');
    if (this.liga) return this.app.ir('liga');
    if (this.online) { this.online.cerrar(); this.app.online = null; return this.app.ir('titulo'); }
    this.app.ir('titulo', { menu: 'jugar' });
  }

  // ---------------------------------------------------------------- online: cada um escolhe o seu; o anfitrião (lugar 0) sorteia a semente e manda começar
  preparar() {
    const o = this.online;
    this.listo = false; this.esperaTxt = '';
    o.alOtro = m => {
      if (m.t === 'shiny') { (this.shiny ??= [])[m.lado] = m.on; return; }
      if (m.t === 'pick') { this.elegido[m.lado] = m.i; if (m.lado === 0 && m.arena != null) this.arenaPronta = m.arena; this.revisar(); }
      else if (m.t === 'start') this.empezarOnline(m);
    };
    o.alCerrar = () => { this.esperaTxt = 'OPPONENT LEFT'; this.cerrado = true; setTimeout(() => this.atras(), 1600); };
  }
  revisar() {
    const o = this.online;
    if (!this.listo || this.elegido.some(i => i < 0) || this.mi !== 0) return;
    const msg = { t: 'start', semilla: (Math.random() * 1e9) | 0, picks: this.elegido.map(i => ROSTER[i].id), shiny: this.elegido.map((_, k) => !!this.shiny?.[k]), arena: ARENAS[this.arena].id };
    o.enviar(msg);
    this.empezarOnline(msg);
  }
  empezarOnline(m) {
    this.app.ir('combate', { modo: 'online', lado: this.mi, n: this.n, p1: m.picks[0], p2: m.picks[1], p3: m.picks[2] ?? null, p4: m.picks[3] ?? null, shiny: m.shiny, arena: m.arena, semilla: m.semilla });
  }
  luchar() {
    const i = this.aleatorio[1] && this.modo === 'cpu' ? Math.floor(Math.random() * ROSTER.length) : this.elegido[1];
    if (this.online) {
      if (this.listo || this.cerrado) return;
      sfx('confirmar');
      this.listo = true; this.esperaTxt = 'WAITING FOR THE OTHERS...';
      this.app.ultimaSeleccion = [this.elegido[this.mi]];
      this.online.enviar({ t: 'pick', lado: this.mi, i: this.elegido[this.mi], arena: ARENAS[this.arena].id });
      return this.revisar();
    }
    if (this.liga) {
      sfx('confirmar');
      this.app.ultimaSeleccion = [this.elegido[0], this.elegido[1]];
      return this.app.ir('combate', { modo: 'cpu', liga: this.liga, p1: ROSTER[this.elegido[0]].id, p2: this.liga, shiny: [!!this.shiny?.[0], false], arena: ARENAS[this.arena].id, nivel: this.nivel });
    }
    this.app.ultimaSeleccion = [...this.elegido];
    this.app.ajustes.nivel = this.nivel; this.app.ajustes.arena = ARENAS[this.arena].id; this.app.guardarAjustes();
    sfx('confirmar');
    const j = this.n === 3 && this.aleatorio[2] ? Math.floor(Math.random() * ROSTER.length) : this.elegido[2];
    this.app.ir('combate', { modo: this.modo, p1: ROSTER[this.elegido[0]].id, p2: ROSTER[this.modo === 'entreno' ? this.elegido[1] : i].id, p3: this.n === 3 ? ROSTER[j].id : null, shiny: [!!this.shiny?.[0], !!this.shiny?.[1], !!this.shiny?.[2]], arena: ARENAS[this.arena].id, nivel: this.nivel });
  }

  elegirCarta(i) {
    if (this.online && this.listo) return;
    // segredo: tocar 20 vezes seguidas no mesmo Pokémon troca o seu para a versão shiny
    this.toquesShiny = this.ultimaCarta === i ? (this.toquesShiny ?? 0) + 1 : 1;
    this.ultimaCarta = i;
    if (this.toquesShiny >= SHINY_TOQUES && !shinyLiberado(ROSTER[i].id)) { this.toquesShiny = 0; this.avisoShiny = { t0: this.t, on: false, txt: 'WIN 3 TIMES IN THE LEAGUE TO UNLOCK' }; }
    if (this.toquesShiny >= SHINY_TOQUES) {
      const yo = this.online ? this.mi : 0;
      this.toquesShiny = 0;
      this.shiny ??= [];
      this.shiny[yo] = !this.shiny[yo];
      this.elegido[yo] = i;
      this.avisoShiny = { t0: this.t, on: this.shiny[yo] };
      sfx('evoCarga');
      if (this.online) this.online.enviar({ t: 'shiny', lado: yo, on: this.shiny[yo] });
      return;
    }
    if (this.ladoHumano(this.lado) && !desbloqueado(ROSTER[i].id)) { sfx('atras'); this.avisoShiny = { t0: this.t, on: false, txt: 'LOCKED: BEAT IT IN THE POKÉMON LEAGUE' }; return; }
    if (this.shiny?.[this.lado] && this.elegido[this.lado] !== i && !shinyLiberado(ROSTER[i].id)) this.shiny[this.lado] = false;
    this.elegido[this.lado] = i;
    this.aleatorio[this.lado] = false;
    sfx('confirmar');
    if (!this.online && !this.liga && this.lado < this.n - 1 && this.modo !== 'entreno') { this.lado++; this.cursor = this.elegido[this.lado]; }
    else this.foco = 'luchar';
  }

  tecla(c, nueva) {
    if (!nueva) return;
    const n = ROSTER.length;
    if (c === 'Escape' || c === 'Backspace') return this.atras();
    if (c === 'Tab') { if (this.modo !== 'entreno' && !this.online && !this.liga) { this.lado = (this.lado + 1) % this.n; this.cursor = this.elegido[this.lado]; sfx('seleccion'); } return; }
    if (c === 'KeyR' && this.foco === 'grade' && this.lado >= 1 && (this.modo === 'cpu' || this.modo === 'arena')) { this.aleatorio[this.lado] = true; this.elegido[this.lado] = Math.floor(Math.random() * n); sfx('seleccion'); return; }
    const dx = ['ArrowRight', 'KeyD'].includes(c) ? 1 : ['ArrowLeft', 'KeyA'].includes(c) ? -1 : 0;
    const dy = ['ArrowDown', 'KeyS'].includes(c) ? 1 : ['ArrowUp', 'KeyW'].includes(c) ? -1 : 0;
    const accion = ['Enter', 'Space', 'NumpadEnter'].includes(c);
    if (this.foco === 'grade') {
      if (dx) { this.cursor = (this.cursor + dx + n) % n; sfx('seleccion'); }
      if (dy) { const f = Math.floor(this.cursor / COLS) + dy, filas = Math.ceil(n / COLS); if (f > filas - 1) this.foco = 'arena'; else if (f >= 0) this.cursor = Math.min(n - 1, f * COLS + (this.cursor % COLS)); sfx('seleccion'); }
      if (accion) this.elegirCarta(this.cursor);
    } else {
      const orden = this.liga ? ['luchar'] : this.modo === 'cpu' || this.modo === 'arena' ? ['arena', 'nivel', 'luchar'] : ['arena', 'luchar'];
      const i = orden.indexOf(this.foco);
      if (dy) { const j = i + dy; if (j < 0) this.foco = 'grade'; else if (j < orden.length) this.foco = orden[j]; sfx('seleccion'); }
      if (this.foco === 'arena' && dx) { this.arena = (this.arena + dx + ARENAS.length) % ARENAS.length; sfx('seleccion'); }
      if (this.foco === 'nivel' && dx) { this.nivel = NIVELES[(NIVELES.indexOf(this.nivel) + dx + 3) % 3]; sfx('seleccion'); }
      if (this.foco === 'luchar' && accion) this.luchar();
    }
  }

  cajaCarta(i) { return { x: CARD.x0 + (i % COLS) * (CARD.w + CARD.gap), y: CARD.y0 + Math.floor(i / COLS) * (CARD.h + CARD.gap), w: CARD.w, h: CARD.h }; }
  puntero(tipo, p) {
    if (tipo !== 'down' && tipo !== 'move') return;
    const dentro = (c, m = 0) => p.x >= c.x - m && p.x <= c.x + c.w + m && p.y >= c.y - m && p.y <= c.y + c.h + m;
    for (let i = 0; i < ROSTER.length; i++) if (dentro(this.cajaCarta(i))) { if (tipo === 'move') { if (this.cursor !== i || this.foco !== 'grade') { this.cursor = i; this.foco = 'grade'; } } else { this.cursor = i; this.foco = 'grade'; this.elegirCarta(i); } return; }
    if (tipo !== 'down') return;
    if (dentro(this.cajaVolver())) return this.atras();
    if (dentro(this.cajaLuchar())) return this.luchar();
    if (this.liga) return;
    if (dentro(this.cajaArena(-1))) { this.arena = (this.arena - 1 + ARENAS.length) % ARENAS.length; sfx('seleccion'); return; }
    if (dentro(this.cajaArena(1))) { this.arena = (this.arena + 1) % ARENAS.length; sfx('seleccion'); return; }
    if (this.modo === 'cpu' || this.modo === 'arena') { if (dentro(this.cajaNivel(-1))) { this.nivel = NIVELES[(NIVELES.indexOf(this.nivel) + 2) % 3]; sfx('seleccion'); return; } if (dentro(this.cajaNivel(1))) { this.nivel = NIVELES[(NIVELES.indexOf(this.nivel) + 1) % 3]; sfx('seleccion'); return; } }
    if (this.modo !== 'entreno' && !this.online) { if (dentro({ x: 4, y: 38, w: 178, h: 24 })) { this.lado = 0; this.cursor = this.elegido[0]; sfx('seleccion'); } if (dentro({ x: 458, y: 38, w: 178, h: 24 })) { this.lado = this.lado === 1 && this.n === 3 ? 2 : 1; this.cursor = this.elegido[this.lado]; sfx('seleccion'); } }
  }
  cajaVolver() { return { x: 4, y: 4, w: 70, h: 18 }; }
  cajaLuchar() { return { x: ANCHO / 2 - 64, y: 308, w: 128, h: 28 }; }
  cajaArena(d) { return { x: d < 0 ? 196 : 410, y: 232, w: 20, h: 18 }; }
  cajaNivel(d) { return { x: d < 0 ? 196 : 410, y: 258, w: 20, h: 18 }; }

  actualizar(dt) { this.t += dt; }

  dibujar(g) {
    const bank = this.app.bank, t = this.t;
    fondoMenu(g, ANCHO, ALTO);
    marco(g, 0, 0, ANCHO, 26, 'panel');
    const v = this.cajaVolver(); marco(g, v.x, v.y, v.w, v.h); texto(g, '< MENU', v.x + v.w / 2, v.y + v.h / 2, { tam: 7, align: 'center', base: 'middle' });
    texto(g, this.liga ? 'POKÉMON LEAGUE' : this.modo === 'versus' ? '2 PLAYERS' : this.modo === 'entreno' ? 'TRAINING' : this.modo === 'arena' ? 'ARENA · 3 FIGHTERS' : this.online ? `ONLINE · ${this.n} PLAYERS` : 'VS CPU', ANCHO / 2, 13, { tam: 12, color: UI.amarillo, borde: 3, align: 'center', base: 'middle' });
    // painéis laterais
    // painel esquerdo: o meu (ou o jogador 1). Direito: o oponente em edição (arena: 1 ou 2) ou o primeiro oponente online
    const izq = this.online ? this.mi : 0;
    const der = this.online ? [...this.elegido.keys()].find(k => k !== this.mi) : this.lado >= 1 ? this.lado : 1;
    this.panel(g, izq, 4, t, 0);
    this.panel(g, der, 458, t, 1);
    // grade
    ROSTER.forEach((p, i) => {
      const c = this.cajaCarta(i), sel0 = this.elegido[0] === i, sel1 = this.elegido[1] === i && this.modo !== 'entreno', sel2 = this.n >= 3 && this.elegido[2] === i, sel3 = this.n === 4 && this.elegido[3] === i;
      const foco = this.cursor === i && this.foco === 'grade';
      const trancado = !desbloqueado(p.id);
      marco(g, c.x, c.y, c.w, c.h, foco ? 'oro' : trancado ? 'apagado' : 'azul');
      const img = bank.retrato(p.dex);
      if (img) g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, c.x + 2, c.y + 3, 24, 24);
      texto(g, p.nombre, c.x + 28, c.y + 6, { tam: 6, color: foco ? UI.textoOscuro : '#fff', max: c.w - 30 });
      p.tipos.forEach((tp, k) => { rect(g, c.x + 28 + k * 14, c.y + 18, 12, 7, '#04102c'); rect(g, c.x + 29 + k * 14, c.y + 19, 10, 5, hex(TIPOS[tp] ?? 0xffffff)); });
      if (trancado) { rect(g, c.x + 1, c.y + 1, c.w - 2, c.h - 2, '#060a18', 0.6); rect(g, c.x + 9, c.y + 15, 10, 8, '#ffd23c'); rect(g, c.x + 11, c.y + 10, 6, 6, '#ffd23c'); rect(g, c.x + 12, c.y + 11, 4, 4, '#060a18'); }
      if (sel0) { rect(g, c.x + c.w - 14, c.y - 5, 16, 10, '#04102c'); rect(g, c.x + c.w - 13, c.y - 4, 14, 8, '#4a9fff'); texto(g, 'P1', c.x + c.w - 6, c.y, { tam: 5, align: 'center', base: 'middle' }); }
      if (sel1) { rect(g, c.x - 2, c.y - 5, 22, 10, '#04102c'); rect(g, c.x - 1, c.y - 4, 20, 8, '#ff5a5a'); texto(g, this.modo === 'cpu' ? 'CPU' : this.modo === 'arena' ? 'CPU1' : 'P2', c.x + 9, c.y, { tam: 5, align: 'center', base: 'middle' }); }
      if (sel3) { rect(g, c.x + c.w - 14, c.y + c.h - 5, 16, 10, '#04102c'); rect(g, c.x + c.w - 13, c.y + c.h - 4, 14, 8, '#fbbf24'); texto(g, 'P4', c.x + c.w - 6, c.y + c.h, { tam: 5, align: 'center', base: 'middle', color: '#04102c' }); }
      if (sel2) { rect(g, c.x - 2, c.y + c.h - 5, 22, 10, '#04102c'); rect(g, c.x - 1, c.y + c.h - 4, 20, 8, '#4ade80'); texto(g, this.modo === 'arena' ? 'CPU2' : 'P3', c.x + 9, c.y + c.h, { tam: 5, align: 'center', base: 'middle' }); }
    });
    // opções
    const fila = (y, etiqueta, valor, enfocado, cajaIzq, cajaDer) => {
      marco(g, 218, y, 192, 18, enfocado ? 'oro' : 'azul');
      texto(g, etiqueta, 226, y + 9, { tam: 6, base: 'middle', color: enfocado ? UI.textoOscuro : UI.suave });
      texto(g, valor, 314, y + 9, { tam: 8, align: 'center', base: 'middle', color: enfocado ? UI.textoOscuro : '#fff' });
      texto(g, '<', cajaIzq.x + 10, y + 9, { tam: 8, align: 'center', base: 'middle', color: enfocado ? UI.textoOscuro : '#fff' });
      texto(g, '>', cajaDer.x + 10, y + 9, { tam: 8, align: 'center', base: 'middle', color: enfocado ? UI.textoOscuro : '#fff' });
    };
    if (this.liga) {
      const ci = circuitoDe(this.liga), v = vitorias(this.liga);
      marco(g, 218, 232, 192, 44, 'azul');
      texto(g, ci?.nombre ?? 'LEAGUE', 314, 241, { tam: 7, align: 'center', base: 'middle', color: '#7dd3fc' });
      texto(g, `${ARENAS[this.arena].nombre} · ${NOMBRE_DIFICULTAD[this.nivel]}`, 314, 254, { tam: 8, align: 'center', base: 'middle', color: this.nivel === 'dificil' ? '#ff7a7a' : this.nivel === 'normal' ? '#ffd166' : '#86efac' });
      texto(g, v >= 3 ? 'REMATCH · ALL REWARDS EARNED' : ['WIN TO UNLOCK IT', 'WIN AGAIN: PROFILE ICON', 'WIN AGAIN: SHINY'][v], 314, 267, { tam: 6, align: 'center', base: 'middle', color: UI.suave });
    } else fila(232, 'ARENA', ARENAS[this.arena].nombre, this.foco === 'arena', this.cajaArena(-1), this.cajaArena(1));
    if (!this.liga && (this.modo === 'cpu' || this.modo === 'arena')) fila(258, 'LEVEL', NOMBRE_NIVEL[this.nivel], this.foco === 'nivel', this.cajaNivel(-1), this.cajaNivel(1));
    const l = this.cajaLuchar();
    marco(g, l.x, l.y, l.w, l.h, this.foco === 'luchar' ? 'oro' : 'azul');
    texto(g, this.online ? (this.listo ? 'WAITING...' : 'READY!') : 'FIGHT!', l.x + l.w / 2, l.y + l.h / 2, { tam: 12, align: 'center', base: 'middle', color: this.foco === 'luchar' ? UI.textoOscuro : '#fff', borde: this.foco === 'luchar' ? 0 : 3 });
    if (this.avisoShiny && this.t - this.avisoShiny.t0 < 1.6) texto(g, this.avisoShiny.txt ?? (this.avisoShiny.on ? 'SHINY ON!' : 'SHINY OFF'), ANCHO / 2, 222, { tam: 12, align: 'center', base: 'middle', color: '#ffe27a', borde: 3 });
    texto(g, this.esperaTxt || (this.modo === 'cpu' || this.modo === 'arena' ? 'ARROWS MOVE · ENTER PICK · TAB SWITCH SIDE · R RANDOM CPU' : 'ARROWS MOVE · ENTER PICK · TAB SWITCH SIDE'), ANCHO / 2, ALTO - 10, { tam: 6, color: this.esperaTxt ? '#7dd3fc' : UI.apagado, align: 'center' });
  }

  panel(g, lado, x0, t, pos = lado) {
    const bank = this.app.bank;
    if (pos === 1 && this.modo === 'entreno') { marco(g, x0, 30, 178, 270, 'panel'); texto(g, 'DUMMY', x0 + 89, 52, { tam: 10, align: 'center', color: UI.suave }); texto(g, 'Stands still, takes hits.\nNo timer.', x0 + 89, 80, { tam: 7, align: 'center', color: UI.suave }); return; }
    const idx = lado >= 1 && this.aleatorio[lado] && (this.modo === 'cpu' || this.modo === 'arena') ? -1 : this.elegido[lado];
    const activo = this.lado === lado && this.modo !== 'entreno' && !this.online;
    marco(g, x0, 30, 178, 270, 'panel');
    const color = ['#1f4f9a', '#9a2a2a', '#2f7d46', '#9a7a1a'][lado] ?? '#9a2a2a';
    const nombre = this.liga ? (lado === 0 ? 'YOU' : 'LEAGUE RIVAL') : this.online ? (lado === this.mi ? 'YOU' : `PLAYER ${lado + 1}`) : this.modo === 'arena' ? (lado === 0 ? 'PLAYER 1' : `CPU ${lado}`) : lado === 0 ? 'PLAYER 1' : this.modo === 'cpu' ? 'CPU' : 'PLAYER 2';
    rect(g, x0 + 2, 31, 174, 14, color);
    texto(g, nombre, x0 + 89, 38, { tam: 7, align: 'center', base: 'middle', borde: 2 });
    if (activo) { g.strokeStyle = '#ffd23c'; g.lineWidth = 2; g.strokeRect(x0 + 1, 31, 176, 268); }
    if (idx < 0) { texto(g, this.online ? 'CHOOSING...' : 'RANDOM', x0 + 89, 140, { tam: 14, align: 'center', color: '#ffd23c', borde: 3 }); texto(g, '?', x0 + 89, 110, { tam: 30, align: 'center', color: '#fff', borde: 4 }); return; }
    const p = ROSTER[idx];
    const forma = [p, ...(p.evoluciones ?? [])];
    // sprite grande
    const fila = pos === 0 ? 2 : 6;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x0 + 89, 118, 26, 6, 0, 0, 7); g.fill();
    bank.dibujar(g, this.shiny?.[lado] ? p.dex + 's' : p.dex, 'Idle', t, x0 + 89, 118, 2, { fila });
    if (this.shiny?.[lado]) { for (let k = 0; k < 4; k++) { const a = t * 3 + k * 1.57; rect(g, Math.round(x0 + 89 + Math.cos(a) * 30), Math.round(96 + Math.sin(a) * 16), 2, 2, k % 2 ? '#fff6a8' : '#ffffff'); } texto(g, 'SHINY', x0 + 89, 60, { tam: 7, align: 'center', color: '#ffe27a', borde: 2 }); }
    texto(g, p.nombre, x0 + 89, 126, { tam: 9, align: 'center', color: '#fff', borde: 3 });
    p.tipos.forEach((tp, k) => { const x = x0 + 89 - p.tipos.length * 15 + k * 30; rect(g, x - 1, 141, 30, 11, '#04102c'); rect(g, x, 142, 28, 9, hex(TIPOS[tp] ?? 0xffffff)); texto(g, tp, x + 14, 146.5, { tam: 5, align: 'center', base: 'middle', borde: 1 }); });
    texto(g, `${ROLES[p.rol].nombre} · ${p.lema}`, x0 + 89, 157, { tam: 5.5, align: 'center', color: UI.suave, max: 168 });
    // linha evolutiva
    const cadena = forma.map(f => f.nombre).join(' > ') + (forma.at(-1).mega ? ` > ${forma.at(-1).mega.nombre}` : '');
    texto(g, cadena, x0 + 89, 168, { tam: 5, align: 'center', color: '#7dd3fc', max: 170 });
    // atributos
    const barra = (y, nombre, v, max, color) => { texto(g, nombre, x0 + 8, y, { tam: 5.5, color: UI.suave }); rect(g, x0 + 36, y + 1, 70, 5, '#04102c'); rect(g, x0 + 37, y + 2, Math.round(68 * Math.min(1, v / max)), 3, color); };
    barra(176, 'HP', p.hp, 100, '#3cd34e'); barra(184, 'SPD', p.vel, 180, '#7dd3fc'); barra(192, 'ATK', p.atk * 100, 140, '#ff7a5a'); barra(200, 'DEF', p.def * 100, 125, '#ffd166');
    // skills
    SLOTS.forEach(([s, k], i) => {
      const h = p.kit[s], y = 216 + i * 14;
      rect(g, x0 + 6, y - 1, 24, 10, '#04102c'); rect(g, x0 + 7, y, 22, 8, '#225697');
      texto(g, k, x0 + 18, y + 4, { tam: 5, align: 'center', base: 'middle' });
      rect(g, x0 + 33, y + 1, 5, 6, hex(TIPOS[h.tipo] ?? 0xffffff));
      texto(g, h.nombre, x0 + 42, y + 4, { tam: 6, base: 'middle', max: 130 });
    });
  }
}

centrada(Seleccion);
