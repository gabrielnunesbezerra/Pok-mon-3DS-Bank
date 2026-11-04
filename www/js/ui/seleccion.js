// Escolha de Pokémon (online): quadro de cada lado com sprite, tipos, atributos e as 5 skills; no centro o botão
// que abre a lista de todo o roster (a mesma do lobby) e o botão do shiny, quando ele já foi liberado.
import { ANCHO, ALTO, UI, hex, VERSION } from '../config.js';
import { ROSTER, ROLES, HUELLA } from '../data/pokemon.js';
import { ARENAS } from '../data/arenas.js';
import { TIPOS } from '../data/regras.js';
import { fondoMenu, texto, marco, rect } from '../render/pixel.js';
import { formasDe } from '../render/sprites.js';
import { sfx } from '../audio.js';
import { centrada } from './centrar.js';
import { shinyLiberado, sortearShiny } from '../data/conta.js';
import { Escolha } from './escolha.js';

const NIVELES = ['facil', 'normal', 'dificil'];
const NOMBRE_NIVEL = { facil: 'EASY', normal: 'NORMAL', dificil: 'HARD' };
const SLOTS = [['lmb', 'LMB'], ['rmb', 'RMB'], ['esp', 'SPC'], ['q', 'Q'], ['e', 'E']];


export class Seleccion {
  constructor(app, datos = {}) {
    this.app = app;
    this.modo = datos.modo ?? 'cpu';
    this.t = 0;

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
    if (!ROSTER[this.elegido[this.mi]]) this.elegido[this.mi] = 0;
    this.cursor = this.elegido[this.mi];
    this.escolha = null;
    this.querShiny = false;
    if (this.online) this.preparar();
  }
  get contraCpu() { return this.modo === 'cpu' || this.modo === 'arena' || this.modo === 'duplas'; }
  abrirLista() {
    if (this.online && this.listo) return;
    const lado = this.online ? this.mi : this.lado;
    this.escolha = new Escolha({
      titulo: 'PICK YOUR POKÉMON', atual: this.elegido[lado],
      alElegir: k => { this.escolha = null; if (k >= 0) this.elegirCarta(k); },
      alFechar: () => { this.escolha = null; },
    });
  }
  get temShiny() { const p = ROSTER[this.elegido[this.online ? this.mi : 0]]; return !!p && shinyLiberado(p.id); }
  ladoHumano(lado) { return this.online ? lado === this.mi : lado === 0 || (this.modo === 'versus' && lado === 1); }

  entrar() { for (const p of ROSTER) { const f = [p, ...(p.evoluciones ?? [])]; for (const x of f) { this.app.bank.hoja(x.dex, 'Idle'); this.app.bank.retrato(x.dex); } } }

  atras() {
    sfx('atras');
    if (this.escolha) { this.escolha = null; return; }
    if (this.online) { this.online.cerrar(); this.app.online = null; return this.app.ir('titulo'); }
    this.app.ir('titulo', { menu: 'jugar' });
  }

  // ---------------------------------------------------------------- online: cada um escolhe o seu; o anfitrião (lugar 0) sorteia a semente e manda começar
  preparar() {
    const o = this.online;
    this.listo = false; this.esperaTxt = '';
    // cada um manda a sua versão e responde uma vez a do outro (a primeira pode chegar antes de o outro estar aqui)
    const ver = () => o.enviar({ t: 'ver', v: VERSION, h: HUELLA });
    o.alOtro = m => {
      if (m.t === 'ver') { if (!this.verOk) { this.verOk = true; ver(); } if (m.h !== HUELLA) this.versionDistinta(m.v); return; }
      if (this.malaVersion) return;
      if (m.t === 'shiny') { (this.shiny ??= [])[m.lado] = m.on; return; }
      if (m.t === 'pick') {
        // versões antigas mandavam a posição na lista, que muda quando entra Pokémon novo
        const i = ROSTER.findIndex(p => p.id === m.id);
        if (i < 0) return this.versionDistinta(null);
        this.elegido[m.lado] = i; (this.shiny ??= [])[m.lado] = !!m.shiny; if (m.lado === 0 && m.arena != null) this.arenaPronta = m.arena; this.revisar();
      } else if (m.t === 'start') { if (m.picks.some(id => id && !ROSTER.some(p => p.id === id))) return this.versionDistinta(null); this.empezarOnline(m); }
    };
    ver();
    o.alCerrar = () => { this.esperaTxt = 'OPPONENT LEFT'; this.cerrado = true; setTimeout(() => this.atras(), 1600); };
  }
  versionDistinta(v) {
    this.malaVersion = true; this.listo = false;
    this.esperaTxt = `DIFFERENT GAME VERSIONS (YOU ${VERSION} ${HUELLA}${v ? ` · FRIEND ${v}` : ''}): BOTH NEED THE LATEST APK`;
  }
  revisar() {
    const o = this.online;
    if (!this.listo || this.mi !== 0) return;
    // duplas: o anfitrião sorteia os Pokémon das CPUs que completam os times
    for (const c of o.cpus ?? []) if (this.elegido[c] < 0) this.elegido[c] = Math.floor(Math.random() * ROSTER.length);
    if (this.elegido.some(i => i < 0)) return;
    const duplas = o.modo === 'duplas';
    const msg = { t: 'start', semilla: (Math.random() * 1e9) | 0, picks: this.elegido.map(i => ROSTER[i].id), shiny: this.elegido.map((_, k) => !!this.shiny?.[k]), arena: ARENAS[this.arena].id, equipos: duplas ? [0, 1, 0, 1] : null, cpus: o.cpus ?? [] };
    o.enviar(msg);
    this.empezarOnline(msg);
  }
  empezarOnline(m) {
    const shinyNovo = []; shinyNovo[this.mi] = !!this.shinyNovo;
    this.app.ir('combate', { modo: 'online', lado: this.mi, n: this.n, p1: m.picks[0], p2: m.picks[1], p3: m.picks[2] ?? null, p4: m.picks[3] ?? null, shiny: m.shiny, shinyNovo, arena: m.arena, semilla: m.semilla, equipos: m.equipos ?? null, cpus: m.cpus ?? [] });
  }
  luchar() {
    const i = this.aleatorio[1] && (this.modo === 'cpu' || this.modo === 'duplas') ? Math.floor(Math.random() * ROSTER.length) : this.elegido[1];
    if (this.online) {
      if (this.listo || this.cerrado || this.malaVersion) return;
      sfx('confirmar');
      this.listo = true; this.esperaTxt = 'WAITING FOR THE OTHERS...';
      this.app.ultimaSeleccion = [this.elegido[this.mi]];
      // shiny: 1% de chance ao entrar na partida (o que sai fica liberado na conta)
      const s = sortearShiny(ROSTER[this.elegido[this.mi]].id, this.querShiny && this.temShiny);
      (this.shiny ??= [])[this.mi] = s.shiny; this.shinyNovo = s.novo;
      this.online.enviar({ t: 'pick', lado: this.mi, id: ROSTER[this.elegido[this.mi]].id, shiny: s.shiny, arena: ARENAS[this.arena].id });
      return this.revisar();
    }
    this.app.ultimaSeleccion = [...this.elegido];
    this.app.ajustes.nivel = this.nivel; this.app.ajustes.arena = ARENAS[this.arena].id; this.app.guardarAjustes();
    sfx('confirmar');
    if (this.modo === 'duplas') {
      // você + um parceiro CPU contra duas CPUs; o parceiro e o segundo rival são sorteados
      const r = () => ROSTER[Math.floor(Math.random() * ROSTER.length)].id;
      return this.app.ir('combate', { modo: 'duplas', p1: ROSTER[this.elegido[0]].id, p2: ROSTER[i].id, p3: r(), p4: r(), equipos: [0, 1, 0, 1], shinyQuer: [this.querShiny && this.temShiny], arena: ARENAS[this.arena].id, nivel: this.nivel });
    }
    const j = this.n === 3 && this.aleatorio[2] ? Math.floor(Math.random() * ROSTER.length) : this.elegido[2];
    this.app.ir('combate', { modo: this.modo, p1: ROSTER[this.elegido[0]].id, p2: ROSTER[this.modo === 'entreno' ? this.elegido[1] : i].id, p3: this.n === 3 ? ROSTER[j].id : null, shinyQuer: [this.querShiny && this.temShiny], arena: ARENAS[this.arena].id, nivel: this.nivel });
  }

  elegirCarta(i) {
    if (this.online && this.listo) return;
    if (this.elegido[this.lado] !== i) this.querShiny = false;
    this.elegido[this.lado] = i;
    this.aleatorio[this.lado] = false;
    sfx('confirmar');
    if (!this.online && this.lado < this.n - 1 && this.modo !== 'entreno') { this.lado++; this.cursor = this.elegido[this.lado]; }
    else this.foco = 'luchar';
  }

  tecla(c, nueva) {
    if (this.escolha) return this.escolha.tecla(c, nueva);
    if (!nueva) return;
    const n = ROSTER.length;
    if (c === 'Escape' || c === 'Backspace') return this.atras();
    if (c === 'Tab') { if (this.modo !== 'entreno' && !this.online) { this.lado = (this.lado + 1) % this.n; this.cursor = this.elegido[this.lado]; sfx('seleccion'); } return; }
    if (c === 'KeyR' && this.foco === 'grade' && this.lado >= 1 && this.contraCpu) { this.aleatorio[this.lado] = true; this.elegido[this.lado] = Math.floor(Math.random() * n); sfx('seleccion'); return; }
    const dx = ['ArrowRight', 'KeyD'].includes(c) ? 1 : ['ArrowLeft', 'KeyA'].includes(c) ? -1 : 0;
    const dy = ['ArrowDown', 'KeyS'].includes(c) ? 1 : ['ArrowUp', 'KeyW'].includes(c) ? -1 : 0;
    const accion = ['Enter', 'Space', 'NumpadEnter'].includes(c);
    if (this.foco === 'grade') {
      if (dy > 0) { this.foco = 'arena'; sfx('seleccion'); }
      if (accion) this.abrirLista();
    } else {
      const orden = this.contraCpu ? ['arena', 'nivel', 'luchar'] : ['arena', 'luchar'];
      const i = orden.indexOf(this.foco);
      if (dy) { const j = i + dy; if (j < 0) this.foco = 'grade'; else if (j < orden.length) this.foco = orden[j]; sfx('seleccion'); }
      if (this.foco === 'arena' && dx) { this.arena = (this.arena + dx + ARENAS.length) % ARENAS.length; sfx('seleccion'); }
      if (this.foco === 'nivel' && dx) { this.nivel = NIVELES[(NIVELES.indexOf(this.nivel) + dx + 3) % 3]; sfx('seleccion'); }
      if (this.foco === 'luchar' && accion) this.luchar();
    }
  }

  cajaElegir() { return { x: 218, y: 70, w: 192, h: 96 }; }
  cajaShiny() { return { x: 264, y: 176, w: 100, h: 20 }; }
  puntero(tipo, p) {
    if (this.escolha) return this.escolha.puntero(tipo, p);
    if (tipo !== 'down') return;
    const dentro = (c, m = 0) => p.x >= c.x - m && p.x <= c.x + c.w + m && p.y >= c.y - m && p.y <= c.y + c.h + m;
    if (dentro(this.cajaElegir()) || dentro({ x: 4, y: 64, w: 178, h: 236 })) { sfx('seleccion'); return this.abrirLista(); }
    if (this.temShiny && dentro(this.cajaShiny()) && !(this.online && this.listo)) { this.querShiny = !this.querShiny; sfx(this.querShiny ? 'evoCarga' : 'seleccion'); return; }
    if (dentro(this.cajaVolver())) return this.atras();
    if (dentro(this.cajaLuchar())) return this.luchar();
    if (dentro(this.cajaArena(-1))) { this.arena = (this.arena - 1 + ARENAS.length) % ARENAS.length; sfx('seleccion'); return; }
    if (dentro(this.cajaArena(1))) { this.arena = (this.arena + 1) % ARENAS.length; sfx('seleccion'); return; }
    if (this.contraCpu) { if (dentro(this.cajaNivel(-1))) { this.nivel = NIVELES[(NIVELES.indexOf(this.nivel) + 2) % 3]; sfx('seleccion'); return; } if (dentro(this.cajaNivel(1))) { this.nivel = NIVELES[(NIVELES.indexOf(this.nivel) + 1) % 3]; sfx('seleccion'); return; } }
    if (this.modo !== 'entreno' && !this.online) { if (dentro({ x: 4, y: 38, w: 178, h: 24 })) { this.lado = 0; this.cursor = this.elegido[0]; sfx('seleccion'); } if (dentro({ x: 458, y: 38, w: 178, h: 24 })) { this.lado = this.lado === 1 && this.n === 3 ? 2 : 1; this.cursor = this.elegido[this.lado]; sfx('seleccion'); } }
  }
  cajaVolver() { return { x: 4, y: 4, w: 70, h: 18 }; }
  cajaLuchar() { return { x: 320 - 64, y: 308, w: 128, h: 28 }; }
  cajaArena(d) { return { x: d < 0 ? 196 : 410, y: 244, w: 20, h: 18 }; }
  cajaNivel(d) { return { x: d < 0 ? 196 : 410, y: 266, w: 20, h: 18 }; }

  actualizar(dt) { this.t += dt; }

  dibujar(g) {
    const bank = this.app.bank, t = this.t;
    fondoMenu(g, ANCHO, ALTO);
    marco(g, 0, 0, ANCHO, 26, 'panel');
    const v = this.cajaVolver(); marco(g, v.x, v.y, v.w, v.h); texto(g, '< MENU', v.x + v.w / 2, v.y + v.h / 2, { tam: 7, align: 'center', base: 'middle' });
    texto(g, this.modo === 'versus' ? '2 PLAYERS' : this.modo === 'entreno' ? 'TRAINING' : this.modo === 'arena' ? 'ARENA · 3 FIGHTERS' : this.modo === 'duplas' ? 'DOUBLES · 2 VS 2' : this.online ? (this.online.modo === 'duplas' ? 'ONLINE · DOUBLES 2 VS 2' : null) ??  `ONLINE · ${this.n} PLAYERS` : 'VS CPU', ANCHO / 2, 13, { tam: 12, color: UI.amarillo, borde: 3, align: 'center', base: 'middle' });
    // painéis laterais
    // painel esquerdo: o meu (ou o jogador 1). Direito: o oponente em edição (arena: 1 ou 2) ou o primeiro oponente online
    const izq = this.online ? this.mi : 0;
    const der = this.online ? [...this.elegido.keys()].find(k => k !== this.mi) : this.lado >= 1 ? this.lado : 1;
    this.panel(g, izq, 4, t, 0);
    this.panel(g, der, 458, t, 1);
    // botão que abre a lista de Pokémon e o do shiny
    const ce = this.cajaElegir(), fe = this.foco === 'grade';
    marco(g, ce.x, ce.y, ce.w, ce.h, fe ? 'oro' : 'azul');
    texto(g, 'CHOOSE POKÉMON', ce.x + ce.w / 2, ce.y + 30, { tam: 12, align: 'center', base: 'middle', color: fe ? UI.textoOscuro : '#fff', borde: fe ? 0 : 3 });
    texto(g, `TAP HERE OR YOUR CARD · ${ROSTER.length} POKÉMON`, ce.x + ce.w / 2, ce.y + 56, { tam: 6, align: 'center', base: 'middle', color: fe ? UI.textoOscuro : UI.suave });
    if (this.temShiny) { const b = this.cajaShiny(); marco(g, b.x, b.y, b.w, b.h, this.querShiny ? 'oro' : 'azul'); texto(g, this.querShiny ? 'SHINY: ON' : 'SHINY: OFF', b.x + b.w / 2, b.y + b.h / 2, { tam: 8, align: 'center', base: 'middle', color: this.querShiny ? UI.textoOscuro : '#fff' }); }
    // opções
    const fila = (y, etiqueta, valor, enfocado, cajaIzq, cajaDer) => {
      marco(g, 218, y, 192, 18, enfocado ? 'oro' : 'azul');
      texto(g, etiqueta, 226, y + 9, { tam: 6, base: 'middle', color: enfocado ? UI.textoOscuro : UI.suave });
      texto(g, valor, 314, y + 9, { tam: 8, align: 'center', base: 'middle', color: enfocado ? UI.textoOscuro : '#fff' });
      texto(g, '<', cajaIzq.x + 10, y + 9, { tam: 8, align: 'center', base: 'middle', color: enfocado ? UI.textoOscuro : '#fff' });
      texto(g, '>', cajaDer.x + 10, y + 9, { tam: 8, align: 'center', base: 'middle', color: enfocado ? UI.textoOscuro : '#fff' });
    };
    fila(244, 'ARENA', ARENAS[this.arena].nombre, this.foco === 'arena', this.cajaArena(-1), this.cajaArena(1));
    if (this.contraCpu) fila(266, 'LEVEL', NOMBRE_NIVEL[this.nivel], this.foco === 'nivel', this.cajaNivel(-1), this.cajaNivel(1));
    const l = this.cajaLuchar();
    marco(g, l.x, l.y, l.w, l.h, this.foco === 'luchar' ? 'oro' : 'azul');
    texto(g, this.online ? (this.listo ? 'WAITING...' : 'READY!') : 'FIGHT!', l.x + l.w / 2, l.y + l.h / 2, { tam: 12, align: 'center', base: 'middle', color: this.foco === 'luchar' ? UI.textoOscuro : '#fff', borde: this.foco === 'luchar' ? 0 : 3 });
    if (this.avisoShiny && this.t - this.avisoShiny.t0 < 1.6) texto(g, this.avisoShiny.txt ?? (this.avisoShiny.on ? 'SHINY ON!' : 'SHINY OFF'), ANCHO / 2, 298, { tam: 12, align: 'center', base: 'middle', color: '#ffe27a', borde: 3 });
    texto(g, this.esperaTxt || 'ENTER OPENS THE LIST · ARROWS MOVE', ANCHO / 2, ALTO - 10, { tam: 6, color: this.esperaTxt ? '#7dd3fc' : UI.apagado, align: 'center' });
    if (this.escolha) this.escolha.dibujar(g, bank, t);
  }

  panel(g, lado, x0, t, pos = lado) {
    const bank = this.app.bank;
    if (pos === 1 && this.modo === 'entreno') { marco(g, x0, 30, 178, 270, 'panel'); texto(g, 'DUMMY', x0 + 89, 52, { tam: 10, align: 'center', color: UI.suave }); texto(g, 'Stands still, takes hits.\nNo timer.', x0 + 89, 80, { tam: 7, align: 'center', color: UI.suave }); return; }
    const idx = lado >= 1 && this.aleatorio[lado] && this.contraCpu ? -1 : this.elegido[lado];
    const activo = this.lado === lado && this.modo !== 'entreno' && !this.online;
    marco(g, x0, 30, 178, 270, 'panel');
    const color = ['#1f4f9a', '#9a2a2a', '#2f7d46', '#9a7a1a'][lado] ?? '#9a2a2a';
    const nombre = this.online ? (lado === this.mi ? 'YOU' : this.online.cpus?.includes(lado) ? 'CPU' : `PLAYER ${lado + 1}`) : this.modo === 'arena' ? (lado === 0 ? 'PLAYER 1' : `CPU ${lado}`) : lado === 0 ? 'PLAYER 1' : this.modo === 'cpu' ? 'CPU' : this.modo === 'duplas' ? 'RIVAL CPU' : 'PLAYER 2';
    rect(g, x0 + 2, 31, 174, 14, color);
    texto(g, nombre, x0 + 89, 38, { tam: 7, align: 'center', base: 'middle', borde: 2 });
    if (activo) { g.strokeStyle = '#ffd23c'; g.lineWidth = 2; g.strokeRect(x0 + 1, 31, 176, 268); }
    if (idx < 0) { texto(g, this.online ? 'CHOOSING...' : 'RANDOM', x0 + 89, 140, { tam: 14, align: 'center', color: '#ffd23c', borde: 3 }); texto(g, '?', x0 + 89, 110, { tam: 30, align: 'center', color: '#fff', borde: 4 }); return; }
    const p = ROSTER[idx];
    const forma = [p, ...(p.evoluciones ?? [])];
    // sprite grande
    const fila = pos === 0 ? 2 : 6;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x0 + 89, 118, 26, 6, 0, 0, 7); g.fill();
    const brilha = this.shiny?.[lado] || (lado === (this.online ? this.mi : 0) && this.querShiny && this.temShiny);
    bank.dibujar(g, brilha ? p.dex + 's' : p.dex, 'Idle', t, x0 + 89, 118, 2, { fila });
    if (brilha) { for (let k = 0; k < 4; k++) { const a = t * 3 + k * 1.57; rect(g, Math.round(x0 + 89 + Math.cos(a) * 30), Math.round(96 + Math.sin(a) * 16), 2, 2, k % 2 ? '#fff6a8' : '#ffffff'); } texto(g, 'SHINY', x0 + 89, 60, { tam: 7, align: 'center', color: '#ffe27a', borde: 2 }); }
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
