// Cena de combate: monta a luta, liga os controles, desenha arena, lutadores, efeitos e HUD,
// e cuida de pausa e tela de resultado.
import { ANCHO, ALTO, HUD_ALTO, BARRA_Y, UI, FUENTE } from '../config.js';

const COLOR_EQUIPO = ['#4a9fff', '#ff5a5a', '#4ade80', '#fbbf24'];
import { ROSTER } from '../data/pokemon.js';
import { ARENAS } from '../data/arenas.js';
import { Luta } from '../engine/luta.js';
import { IA, Muneco } from '../engine/ia.js';
import { Camara } from '../render/camara.js';
import { crearArena } from '../render/arena.js';
import { Efectos, dibujarEntidades, dibujarProyectil, dibujarBomba, dibujarTorbellino, colorTipo } from '../render/efectos.js';
import { Hud } from '../render/hud.js';
import { TIPOS } from '../data/regras.js';
import { hex } from '../config.js';
import * as PX from '../render/pixelfx.js';
import { medir } from '../render/pixel.js';
import { mezcla } from '../render/efectos.js';
const hexTipo = t => hex(TIPOS[t] ?? 0xa8a878);
const oscuro = (c, k) => mezcla(c, -k);
const claro = (c, k) => mezcla(c, k);
import { filaDesdeAngulo } from '../render/sprites.js';
import { texto, marco, rect } from '../render/pixel.js';
import { ControlHumano, PanelTactil, CONTROLES } from '../controles.js';
import { ListaBotones } from './menus.js';
import { sfx, silenciar, activarMusica, pararMusica } from '../audio.js';
import { TICK } from '../config.js';

const ANIMS_BASE = ['Idle', 'Walk', 'Attack', 'Hurt'];
const formasDe = def => [def, ...(def.evoluciones ?? [])].flatMap(f => (f.mega ? [f.dex, f.mega.dex] : [f.dex]));
const defDe = id => ROSTER.find(p => p.id === id) ?? ROSTER[0];

export class Combate {
  constructor(app, datos = {}) {
    this.app = app;
    this.datos = { modo: 'cpu', nivel: 'normal', ...datos };
    if (this.datos.modo === 'tutorial') { this.datos.modo = 'entreno'; this.datos.tutorial = true; this.datos.p1 ??= 'riolu'; this.datos.p2 ??= 'munchlax'; }
    const azar = () => ROSTER[Math.floor(Math.random() * ROSTER.length)].id;
    this.datos.p1 = this.datos.p1 ?? azar();
    this.datos.p2 = this.datos.p2 ?? azar();
    this.datos.arena = this.datos.arena ?? ARENAS[Math.floor(Math.random() * ARENAS.length)].id;
    this.cargado = false;
    this.pausado = false;
    this.t = 0;
  }

  entrar() {
    const app = this.app, d = this.datos, bank = app.bank;
    const defs = [defDe(d.p1), defDe(d.p2), d.p3 ? defDe(d.p3) : null, d.p4 ? defDe(d.p4) : null].filter(Boolean);
    for (const def of defs) for (const dex of formasDe(def)) {
      for (const n of ANIMS_BASE) bank.hoja(dex, bank.resolver(dex, n));
      bank.retrato(dex);
    }
    this.defs = defs;
    this.camara = new Camara();
    this.fx = new Efectos();
    this.hud = new Hud(bank);
    this.fondo = crearArena(d.arena);
    this.luta = null;
  }

  listo() {
    const bank = this.app.bank;
    return this.defs.every(def => bank.hoja(def.dex, 'Idle') && bank.hoja(def.dex, 'Walk'));
  }

  empezar() {
    const d = this.datos, app = this.app, bank = app.bank;
    const online = d.modo === 'online';
    this.luta = new Luta({ p1: this.defs[0], p2: this.defs[1], p3: this.defs[2] ?? null, p4: this.defs[3] ?? null, shiny: d.shiny ?? [], etapas: d.etapas ?? [0, 0, 0, 0], modo: online ? 'versus' : d.modo, arena: d.arena, medidas: dex => bank.medidas(dex), semilla: online ? d.semilla : (Math.random() * 1e9) | 0 });
    const luta = this.luta;
    const [a, b] = luta.luchadores;
    const tactil = app.tactil.activo;
    this.lado = online ? d.lado : 0;
    this.sesion = online ? app.online : null;
    app.tactil.l = luta.luchadores[this.lado]; app.tactil.alPausa = () => this.alternarPausa();
    app.tactil.extras = d.modo === 'entreno' ? [
      { x: ANCHO - 208, y: 52, w: 62, h: 24, txt: () => 'RELOAD', al: () => this.recargar() },
      { x: ANCHO - 140, y: 52, w: 88, h: 24, txt: () => (this.ctrls[1]?.quieto ? 'DUMMY: STILL' : 'DUMMY: MOVES'), al: () => this.alternarMuneco() },
    ] : [];
    if (online) {
      this.ctrls = luta.luchadores.map((l, i) => (i === this.lado ? new ControlHumano(app, luta, l, tactil ? 'tactil' : 'kbm', this.camara) : null));
      this.humanos = [this.lado];
      this.sesion.reiniciar(d.semilla);
      this.sesion.alOtro = m => this.mensajeOnline(m);
      this.sesion.alCerrar = () => { this.rivalFuera = true; };
      this.quiereOtra = new Set();
    } else {
      this.ctrls = [new ControlHumano(app, luta, a, tactil ? 'tactil' : 'kbm', this.camara)];
      if (d.modo === 'versus') this.ctrls.push(new ControlHumano(app, luta, b, 'teclado2', this.camara));
      else if (d.modo === 'entreno') this.ctrls.push(new Muneco(b));
      else this.ctrls.push(new IA(luta, b, d.nivel));
      if (luta.luchadores[2]) this.ctrls.push(new IA(luta, luta.luchadores[2], d.nivel));
      this.humanos = d.modo === 'versus' ? [0, 1] : [0];
    }
    if (d.tutorial) this.tutorial = { pasos: [['move', 'MOVE', false], ['lmb', 'BASIC ATTACK', false], ['rmb', 'SKILL', false], ['esp', 'DODGE', false], ['q', 'UTILITY', false], ['e', 'ULTIMATE', false], ['mega', 'EVOLVE / MEGA', false]] };
    if (!app.tactil.activo) app.canvas.style.cursor = 'none';
    this.menuPausa = null;
    this.resultado = null;
    this.cargado = true;
    app.tactil.toques.clear();
    // carrega o resto das animações em segundo plano
    for (const def of this.defs) for (const dex of formasDe(def)) for (const n of Object.keys(bank.manifiesto[dex]?.anims ?? {})) bank.hoja(dex, n);
  }

  salir() { this.app.canvas.style.cursor = 'default'; }
  volver(a = 'seleccion') { this.app.ir(this.datos.tutorial ? 'titulo' : a, { modo: this.datos.modo }); }

  // ---------------------------------------------------------------- entrada
  tecla(c, nueva) {
    if (!nueva) return;
    if (this.luta?.fase === 'fin') {
      if (c === 'KeyR') return this.sesion ? this.pedirOtra() : this.revancha();
      if (c === 'Escape' || c === 'Backspace') return this.sesion ? this.salirOnline() : this.volver();
      return this.resultado?.lista.tecla(c);
    }
    if (this.menuSalir && c !== 'Escape') { this.menuSalir.tecla(c); return; }
    if (c === 'Escape' || c === 'KeyP' && this.datos.modo !== 'versus' && !this.sesion) return this.alternarPausa();
    if (this.luta?.entreno && !this.pausado) { if (c === 'KeyT') this.recargar(); else if (c === 'KeyK') this.alternarMuneco(); }
    if (c === 'KeyM') { this.app.ajustes.sonido = !this.app.ajustes.sonido; silenciar(!this.app.ajustes.sonido); this.app.guardarAjustes(); }
    if (this.pausado) {
      if (this.verControles) { this.verControles = false; return; }
      this.menuPausa.tecla(c);
    }
  }
  puntero(tipo, p, e) {
    if (this.menuSalir) this.menuSalir.puntero(tipo, p);
    else if (this.pausado && !this.verControles) this.menuPausa?.puntero(tipo, p);
    else if (this.verControles && tipo === 'down') this.verControles = false;
    else if (this.luta?.fase === 'fin') this.resultado?.lista.puntero(tipo, p);
  }

  revancha() { this.app.ir('combate', this.datos); }

  // ---------------------------------------------------------------- online
  salirOnline() {
    this.sesion?.enviar({ t: 'adios' });
    this.sesion?.cerrar();
    this.app.online = null;
    this.app.ir('titulo');
  }
  mensajeOnline(m) {
    if (m.t === 'rev') { this.quiereOtra.add(m.lado); this.revisarOtra(); }
    else if (m.t === 'otra') this.app.ir('combate', { ...this.datos, semilla: m.semilla });
  }
  pedirOtra() {
    if (this.quiereOtra.has(this.lado)) return;
    this.quiereOtra.add(this.lado);
    this.sesion.enviar({ t: 'rev', lado: this.lado });
    sfx('confirmar');
    this.revisarOtra();
  }
  revisarOtra() {
    if (this.quiereOtra.size < this.luta.luchadores.length || this.lado !== 0) return;
    const semilla = (Math.random() * 1e9) | 0;
    this.sesion.enviar({ t: 'otra', semilla });
    this.app.ir('combate', { ...this.datos, semilla });
  }
  recargar() { this.luta.recargar(); sfx('confirmar'); }
  alternarMuneco() { const m = this.ctrls?.[1]; if (m instanceof Muneco) m.quieto = !m.quieto; }

  alternarPausa() {
    if (!this.cargado || this.luta.fase === 'fin') return;
    // online a luta não para: só abre um aviso para sair
    if (this.sesion) {
      sfx('confirmar');
      this.menuSalir = this.menuSalir ? null : new ListaBotones({ x: ANCHO / 2, y: ALTO / 2 - 4, w: 150, h: 24, paso: 28, ops: [{ txt: 'CONTINUE', id: 'seguir' }, { txt: 'QUIT', id: 'salir', atras: true }], alElegir: o => { if (o.id === 'seguir') this.menuSalir = null; else this.salirOnline(); } });
      return;
    }
    this.pausado = !this.pausado;
    this.verControles = false;
    sfx('confirmar');
    if (this.pausado) this.armarPausa();
  }
  armarPausa() {
    const app = this.app;
    const ops = [
      { txt: 'RESUME', id: 'seguir' }, { txt: 'RESTART FIGHT', id: 'repetir' },
      { txt: `SOUND: ${app.ajustes.sonido ? 'ON' : 'OFF'}`, id: 'sonido' }, { txt: `MUSIC: ${app.ajustes.musica ? 'ON' : 'OFF'}`, id: 'musica' }, { txt: `AIM GUIDE: ${app.ajustes.mira !== false ? 'ON' : 'OFF'}`, id: 'mira' },
      { txt: 'CONTROLS', id: 'controles' }, { txt: this.datos.tutorial ? 'EXIT TUTORIAL' : 'CHANGE POKÉMON', id: 'cambiar' }, { txt: 'MAIN MENU', id: 'menu' },
    ];
    this.menuPausa = new ListaBotones({
      x: ANCHO / 2, y: 92, w: 172, h: 32, paso: 40, ops, cols: 2, sepX: 184,
      alElegir: (o, i) => {
        if (o.id === 'seguir') this.alternarPausa();
        else if (o.id === 'repetir') this.revancha();
        else if (o.id === 'sonido') { app.ajustes.sonido = !app.ajustes.sonido; silenciar(!app.ajustes.sonido); app.guardarAjustes(); this.armarPausa(); this.menuPausa.foco = i; }
        else if (o.id === 'musica') { app.ajustes.musica = !app.ajustes.musica; app.guardarAjustes(); if (app.ajustes.musica) { activarMusica(true); app.musica(); } else pararMusica(); this.armarPausa(); this.menuPausa.foco = i; }
        else if (o.id === 'mira') { app.ajustes.mira = app.ajustes.mira === false; app.guardarAjustes(); this.armarPausa(); this.menuPausa.foco = i; }
        else if (o.id === 'controles') this.verControles = true;
        else if (o.id === 'cambiar') this.volver();
        else app.ir('titulo');
      },
    });
  }

  // ---------------------------------------------------------------- simulação (60 passos por segundo)
  paso(dt) {
    if (!this.cargado || this.pausado) return;
    const luta = this.luta;
    this.app.tactil.actualizar();
    if (this.sesion) {
      if (this.rivalFuera || luta.fase === 'fin') return;
      const r = this.sesion.paso(luta, () => this.ctrls[this.lado].intento(dt));
      if (r) luta.paso(TICK, r);
      return;
    }
    const intentos = this.ctrls.map(c => c.intento(dt));
    if (this.tutorial) { luta.luchadores[0].ganarUlti(dt * 14); luta.luchadores[0].ganarExp(dt * 6); const it = intentos[0]; if (Math.hypot(it.mx, it.my) > 0.1) this.marcar('move'); if (it.mega && (luta.luchadores[0].puedeMega || luta.luchadores[0].puedeEvolucionar)) this.marcar('mega'); }
    luta.paso(dt, intentos);
  }

  actualizar(dt) {
    this.t += dt;
    if (!this.cargado) { if (this.listo()) this.empezar(); return; }
    const luta = this.luta;
    const evs = luta.tomarEventos();
    this.fx.consumir(luta, evs, this.camara);
    for (const e of evs) {
      if (e.t === 'fin') this.armarResultado(e.ganador);
      if (e.t === 'habilidad' && e.l.humano && e.slot === 'e') this.fx.temblor = Math.max(this.fx.temblor, 3);
      if (e.t === 'habilidad' && e.l.humano) this.marcar(e.slot);
      if (e.t === 'evolucion' && e.l.humano) this.marcar('mega');
    }
    if (this.rivalFuera && !this.saliendo) { this.saliendo = true; setTimeout(() => this.salirOnline(), 2200); }
    if (!this.pausado) this.fx.update(dt);
    const vivos = luta.luchadores.filter(l => !l.ko);
    this.camara.actualizar(dt, vivos.length ? vivos : luta.luchadores, true);
  }

  marcar(id) { const p = this.tutorial?.pasos.find(x => x[0] === id); if (p && !p[2]) { p[2] = true; sfx('confirmar'); } }

  armarResultado(ganador) {
    const d = this.datos;
    const l = this.luta.luchadores[ganador];
    const vs = d.modo === 'cpu' || d.modo === 'arena';
    const titulo = d.modo === 'online' ? (ganador === this.lado ? 'VICTORY!' : `PLAYER ${ganador + 1} WINS`) : d.modo === 'versus' ? `PLAYER ${ganador + 1} WINS!` : vs ? (ganador === 0 ? 'VICTORY' : 'DEFEAT') : `${l.nombre} WINS`;
    sfx(vs && ganador !== 0 || (d.modo === 'online' && ganador !== this.lado) ? 'derrota' : 'victoria');
    this.resultado = {
      ganador, titulo,
      lista: new ListaBotones(this.sesion ? {
        x: ANCHO / 2, y: 232, w: 170, h: 22, paso: 26,
        ops: [{ txt: 'REMATCH', id: 'otra' }, { txt: 'MAIN MENU', id: 'menu' }],
        alElegir: o => { if (o.id === 'otra') this.pedirOtra(); else this.salirOnline(); },
      } : {
        x: ANCHO / 2, y: 232, w: 170, h: 22, paso: 26,
        ops: [{ txt: 'REMATCH', id: 'otra' }, { txt: 'CHANGE POKÉMON', id: 'cambiar' }, { txt: 'MAIN MENU', id: 'menu' }],
        alElegir: o => { if (o.id === 'otra') this.revancha(); else if (o.id === 'cambiar') this.volver(); else this.app.ir('titulo'); },
      }),
    };
  }

  // ---------------------------------------------------------------- desenho
  dibujar(g) {
    g.fillStyle = '#07060c'; g.fillRect(0, 0, ANCHO, ALTO);
    if (!this.cargado) {
      texto(g, 'LOADING...', ANCHO / 2, ALTO / 2, { tam: 8, color: '#d6a63a', align: 'center', base: 'middle' });
      return;
    }
    const luta = this.luta, fx = this.fx, t = luta.t, bank = this.app.bank;
    const sh = fx.temblor, sx = sh ? (Math.random() - 0.5) * sh * 2 : 0, sy = sh ? (Math.random() - 0.5) * sh * 2 : 0;
    g.save();
    g.beginPath(); g.rect(0, HUD_ALTO, ANCHO, ALTO - HUD_ALTO); g.clip();
    this.camara.aplicar(g, sx, sy);
    g.drawImage(this.fondo, 0, 0);
    // chão: avisos, poças, fumaça
    dibujarEntidades(g, luta, fx, this.t, null);
    fx.dibujarSuelo(g);
    // lutadores, clones e projéteis ordenados pela profundidade
    const cosas = [];
    for (const l of luta.luchadores) cosas.push({ y: l.y, f: () => this.dibujarLutador(g, l) });
    for (const e of luta.entidades) {
      if (e.tipo === 'clon') cosas.push({ y: e.y, f: () => this.dibujarClon(g, e) });
      else if (e.tipo === 'proj') cosas.push({ y: e.y + 60, f: () => dibujarProyectil(g, e, this.t) });
      else if (e.tipo === 'bomba') cosas.push({ y: e.y + 60, f: () => dibujarBomba(g, e) });
      else if (e.tipo === 'torbellino') cosas.push({ y: e.y, f: () => dibujarTorbellino(g, e, this.t, fx) });
    }
    cosas.sort((a, b) => a.y - b.y).forEach(c => c.f());
    fx.dibujar(g);
    // guia de mira (alvo marcado, linha de mira do toque): o jogador pode desligar nos ajustes
    if (this.app.ajustes.mira !== false) this.dibujarFijado(g, luta);
    this.barrasMundo(g, luta);
    fx.dibujarTextos(g, FUENTE);
    for (const b of fx.globos) this.dibujarGlobo(g, b);
    g.restore();
    this.dibujarOscuro(g);

    // HUD
    this.hud.dibujar(g, luta, this.t);
    const tk = this.app.tactil.activo ? CONTROLES.tactil : CONTROLES.kbm;
    this.hud.barraSkills(g, luta, this.humanos, this.t, this.sesion ? { 0: tk, 1: tk, 2: tk } : { 0: tk, 1: CONTROLES.teclado2 });
    if (this.sesion) this.dibujarRed(g);
    if (this.app.tactil.activo && !this.pausado && luta.fase !== 'fin') this.app.tactil.dibujar(g, this.t);
    if (luta.entreno) this.dibujarEntreno(g, luta);
    this.dibujarBanners(g);
    if (this.tutorial) this.dibujarTutorial(g);
    if (!this.app.tactil.activo && !this.pausado && this.luta.fase !== 'fin') this.dibujarMira(g);
    // anúncios do centro
    for (const a of fx.anuncios) {
      const k = a.t / a.dur, esc = 1 + Math.max(0, 0.6 - k * 3), al = Math.min(1, (1 - k) * 3);
      g.save(); g.globalAlpha = al; g.translate(ANCHO / 2, 118); g.scale(esc, esc);
      texto(g, a.txt, 0, 0, { tam: a.tam, color: a.color, borde: 6, align: 'center', base: 'middle', peso: 700 });
      g.restore();
    }
    if (fx.flash > 0) { g.globalAlpha = Math.min(1, fx.flash); g.fillStyle = fx.flashColor; g.fillRect(0, 0, ANCHO, ALTO); g.globalAlpha = 1; }
    if (luta.fase === 'fin' && this.resultado) this.dibujarResultado(g);
    if (this.pausado) this.dibujarPausa(g);
  }

  // sombra, aro da equipe e sprite
  dibujarLutador(g, l) {
    const luta = this.luta, bank = this.app.bank, t = luta.t;
    const sc = l.escala, m = bank.medidas(l.dex);
    const rx = Math.max(7, Math.round((m.width ?? 18) * 0.5 * sc)), ry = Math.max(3, Math.round(rx * 0.45));
    if (!l.oculto) {
      g.fillStyle = 'rgba(0,0,0,0.42)'; g.beginPath(); g.ellipse(Math.round(l.x), Math.round(l.y), rx, ry, 0, 0, 7); g.fill();
      if (!l.ko) { g.strokeStyle = l.lado === 0 ? '#4a9fff' : '#ff5a5a'; g.lineWidth = 1.5; g.globalAlpha = 0.9; g.beginPath(); g.ellipse(Math.round(l.x), Math.round(l.y), rx + 3, ry + 2, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
    }
    if (l.oculto) {
      // Dig: um monte de terra que anda e um anel azul marcando onde ele vai sair, como no site
      const pul = 0.5 + 0.5 * Math.sin(this.t * 10), x = Math.round(l.x), y = Math.round(l.y);
      g.globalAlpha = 0.85;
      PX.anilloPix(g, x, y, 27 + pul * 2, 16 + pul, '#8fd0ff', 2, 0);
      PX.anilloPix(g, x, y, 18, 10.5, '#bfe4ff', 1, 0);
      g.globalAlpha = 1;
      PX.elipsePix(g, x, y, 9, 4, '#3a2410'); PX.elipsePix(g, x, y - 1, 7, 3, '#7a5228'); PX.elipsePix(g, x - 1, y - 2, 4, 1.5, '#a87a44');
      if (Math.random() < 0.5) this.fx.polvo(l.x, l.y, 1, 4);
      return;
    }
    if (l.evoVis && t - l.evoVis.t0 < l.evoVis.dur) { this.dibujarEvo(g, l, l.evoVis); return; }
    let nombre = 'Idle', tt = t, bucle = true;
    if (l.ko) { nombre = bank.resolver(l.dex, 'Faint'); tt = t - (l.koT ?? t); bucle = false; }
    else if (l.est.dormido) nombre = 'Sleep';
    else if (l.est.aturdido || t < l.dolorHasta) { nombre = 'Hurt'; tt = t - (l.dolorHasta - 0.18); bucle = false; }
    else if (l.anim && t < l.animHasta) { nombre = l.anim; tt = t - l.animInicio; bucle = false; }
    else if (l.dash) { nombre = l.dash.def.anim ?? 'Walk'; }
    else if (l.moviendo) nombre = 'Walk';
    const flash = l.flash && t - l.flash < 0.1 ? 1 - (t - l.flash) / 0.1 : 0;
    const parpadeo = l.est.invul && Math.floor(t * 30) % 2 ? 0.55 : 1;
    const fila = filaDesdeAngulo(l.angulo);
    if (l.est.arraigo) this.dibujarRaicesPie(g, l, false);
    if (l.dash?.def.estilo === 'sombra') for (let k = 3; k >= 1; k--) bank.dibujar(g, l.dex, 'Walk', t, l.x - Math.cos(l.dash.ang) * k * 9, l.y - Math.sin(l.dash.ang) * k * 6 - l.salto, sc, { fila, bucle: true, alpha: 0.28 - k * 0.05 });
    const ok = bank.dibujar(g, l.dex, nombre, tt, l.x, l.y - l.salto, sc, { fila, bucle, flash, alpha: parpadeo });
    if (!ok) bank.dibujar(g, l.dex, 'Idle', t, l.x, l.y - l.salto, sc, { fila, flash });
    if (l.est.arraigo) this.dibujarRaicesPie(g, l, true);
    if (l.dash) this.dibujarDash(g, l);
    // estados visíveis
    if (l.est.escudo || l.escudo > 0) { g.strokeStyle = 'rgba(125,211,252,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(l.x, l.y - l.alto * 0.5 - l.salto, l.alto * 0.45 + 4, l.alto * 0.55 + 3, 0, 0, 7); g.stroke(); }
    if (l.est.blindaje) { g.strokeStyle = 'rgba(255,214,120,0.7)'; g.lineWidth = 1; g.beginPath(); g.ellipse(l.x, l.y - l.alto * 0.5 - l.salto, l.alto * 0.4 + 3, l.alto * 0.5 + 2, 0, 0, 7); g.stroke(); }
    if (l.est.dormido && Math.floor(t * 2) % 2) texto(g, 'z', l.x + 12, l.y - l.alto - 6 - (t * 10) % 8, { tam: 8, color: '#fff', borde: 2 });
    if (l.est.confuso) for (let i = 0; i < 3; i++) { g.fillStyle = '#ffe14a'; g.fillRect(l.x + Math.cos(t * 5 + i * 2.1) * 14 - 2, l.y - l.alto - 8 + Math.sin(t * 5 + i * 2.1) * 3, 4, 4); }
    if (l.est.quema && Math.random() < 0.25) this.fx.brasas(l.x, l.y - l.alto * 0.4, 1);
    if (l.est.veneno && Math.random() < 0.15) this.fx.gotas(l.x, l.y - l.alto * 0.4, 0);
    if (l.est.potencia && Math.random() < 0.2) this.fx.add({ x: l.x + (Math.random() - 0.5) * 20, y: l.y - 4, vy: -40, size: 2, life: 0.5, color: '#86efac', forma: 'chispa' });
    if (l.est.drenaje && Math.random() < 0.2) this.fx.add({ x: l.x + (Math.random() - 0.5) * 14, y: l.y - l.alto * 0.5, vy: -26, size: 2, life: 0.5, color: '#86efac', forma: 'hoja' });
  }
  // Cena de evolução: a forma antiga brilha até virar silhueta, explode em luz e a nova aparece
  dibujarEvo(g, l, ev) {
    const t = this.luta.t, bank = this.app.bank, fx = this.fx;
    const k = Math.min(1, (t - ev.t0) / ev.dur), mid = 0.55;
    const cor = ev.mega ? [255, 214, 90] : [140, 215, 255];
    const rgb = a => `rgba(${cor[0]},${cor[1]},${cor[2]},${a})`;
    const cy = l.y - l.alto * 0.5, antes = k < mid;
    const u = antes ? k / mid : 0, v = antes ? 0 : (k - mid) / (1 - mid);
    // brilho no chão e coluna de luz
    const raio = (antes ? 14 + u * 40 : 54 + v * 30) * (1 + 0.08 * Math.sin(t * 24));
    g.save();
    g.globalCompositeOperation = 'lighter';
    const halo = g.createRadialGradient(l.x, cy, 2, l.x, cy, raio + l.alto * 0.4);
    halo.addColorStop(0, rgb(antes ? 0.25 + 0.55 * u : 0.8 * (1 - v))); halo.addColorStop(1, rgb(0));
    g.fillStyle = halo; g.beginPath(); g.arc(l.x, cy, raio + l.alto * 0.4, 0, 7); g.fill();
    const largo = antes ? 4 + u * 20 : 24 * (1 - v);
    const pilar = g.createLinearGradient(0, l.y - 190, 0, l.y);
    pilar.addColorStop(0, rgb(0)); pilar.addColorStop(1, rgb(antes ? 0.2 + 0.5 * u : 0.7 * (1 - v)));
    g.fillStyle = pilar; g.fillRect(l.x - largo / 2, l.y - 190, largo, 190);
    g.strokeStyle = rgb(0.8 * (antes ? u : 1 - v)); g.lineWidth = 2;
    for (let i = 0; i < 2; i++) { const r = ((t * 1.6 + i * 0.5) % 1); g.beginPath(); g.ellipse(l.x, l.y, 8 + r * 46, 3 + r * 20, 0, 0, 7); g.globalAlpha = 1 - r; g.stroke(); }
    g.restore();
    // sprite: antiga pulsando até silhueta, depois a nova saindo da luz
    let dex, esc, flash, bucle = true;
    if (antes) {
      dex = ev.desde; esc = ev.escDesde;
      const pulso = 0.5 + 0.5 * Math.sin(t * (10 + 40 * u * u));
      flash = Math.min(1, u * u * 0.9 + pulso * 0.35 * u + (u > 0.88 ? 1 : 0));
      esc *= 1 + 0.07 * u * Math.sin(t * 30);
    } else {
      dex = l.dex; esc = l.escala * (1 + 0.22 * (1 - v) * (1 - v));
      flash = Math.max(0, 1 - v * 1.6);
    }
    const fila = filaDesdeAngulo(l.angulo);
    const dy = antes ? -Math.sin(u * Math.PI * 0.5) * 6 : -Math.sin((1 - v) * Math.PI * 0.5) * 6;
    if (!bank.dibujar(g, dex, 'Idle', t, l.x, l.y + dy, esc, { fila, bucle, flash })) bank.dibujar(g, l.dex, 'Idle', t, l.x, l.y, l.escala, { fila, flash });
    // faíscas voltando para o centro durante a carga, e jorrando depois
    const cores = ev.mega ? ['#ffe27a', '#fff6c8', '#ffb347', '#ffffff'] : ['#bfe9ff', '#ffffff', '#8fd3ff', '#d6c4ff'];
    const n = antes ? 1 + Math.floor(u * 3) : 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, d = antes ? 40 + Math.random() * 40 : 4;
      const x0 = l.x + Math.cos(a) * d, y0 = cy + Math.sin(a) * d * 0.8;
      const sp = antes ? 90 + 120 * u : 60 + Math.random() * 80;
      fx.add({ x: x0, y: y0, vx: antes ? -Math.cos(a) * sp : Math.cos(a) * sp, vy: antes ? -Math.sin(a) * sp * 0.8 : Math.sin(a) * sp * 0.8 - 30, size: 1.5 + Math.random() * 2, life: antes ? d / sp : 0.5, color: cores[i % cores.length], forma: 'chispa' });
    }
    if (!antes && ev.mega && Math.random() < 0.35) fx.anillo(l.x, cy, 6, 30 + Math.random() * 20, cores[0], 0.5, 2);
  }
  // raízes marrons em volta dos pés enquanto o Ingrain está ativo (crescem em 0,4 s) e brilhos de cura subindo
  dibujarRaicesPie(g, l, frente) {
    const ar = l.est.arraigo, t = this.luta.t, crece = Math.min(1, (t - (ar.desde ?? t - 1)) / 0.4), n = 11, rx = 15 * l.escala, ry = 7 * l.escala;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4, y = l.y + Math.sin(a) * ry;
      if ((Math.sin(a) > 0) !== frente) continue;
      PX.carimbar(g, PX.raizPie(i), l.x + Math.cos(a) * rx * crece, y - 1, a * 0.3, 1, crece);
    }
    if (frente && Math.random() < 0.2) this.fx.add({ x: l.x + (Math.random() - 0.5) * 22, y: l.y - 2, vy: -26, size: 1.6, life: 0.7, color: '#8be09a', forma: 'chispa' });
  }

  // desenho por estilo de dash: giro de água, giro de aço, linhas de velocidade, poeira e o chicote de vinha
  dibujarDash(g, l) {
    const d = l.dash, e = d.def.estilo, t = this.t, cx = l.x, cy = l.y - l.alto * 0.5 - l.salto, fx = this.fx, a = d.ang;
    const girar = (r, cols, grosor, n) => { for (let k = 0; k < n; k++) { const a0 = t * 24 + (k / n) * Math.PI * 2; PX.arcoPix(g, cx, cy, r, a0, a0 + 1.3, '#04102c', grosor + 2, r * 0.8); PX.arcoPix(g, cx, cy, r, a0, a0 + 1.3, cols[0], grosor, r * 0.8); PX.arcoPix(g, cx, cy, r, a0 + 0.2, a0 + 1.1, cols[1], Math.max(1, grosor - 2), r * 0.8); } };
    if (e === 'agua') { girar(l.alto * 0.62, ['#4aa3f0', '#ffffff'], 4, 3); if (Math.random() < 0.8) fx.add({ x: cx + (Math.random() - 0.5) * 16, y: cy + (Math.random() - 0.5) * 16, vx: -Math.cos(a) * 50 + (Math.random() - 0.5) * 80, vy: -Math.sin(a) * 30 - 40, g: 260, size: 1.8, life: 0.45, color: '#cfeeff', forma: 'gota', rampa: PX.RAMPA_AGUA }); }
    else if (e === 'veneno') { for (let k = 0; k < 5; k++) { const off = (k - 2) * 4, ln = 16 + (k % 3) * 8; PX.lineaPix(g, cx - Math.sin(a) * off, cy + Math.cos(a) * off, cx - Math.cos(a) * ln - Math.sin(a) * off, cy - Math.sin(a) * ln + Math.cos(a) * off, k % 2 ? '#e070ff' : '#8a2bb8', 2); } if (Math.random() < 0.7) fx.add({ x: cx + (Math.random() - 0.5) * 14, y: cy + (Math.random() - 0.5) * 10, vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 60, size: 2.4, life: 0.35, color: '#d68cf0', forma: 'burbuja' }); }
    else if (e === 'rodar') { girar(l.alto * 0.5, ['#a0783c', '#e8c890'], 3, 2); if (Math.random() < 0.6) fx.polvo(l.x - Math.cos(a) * 8, l.y, 1, 5); }
    else if (e === 'acero') { girar(l.alto * 0.62, ['#9aa8bc', '#ffffff'], 4, 3); if (Math.random() < 0.6) fx.chispas(cx + (Math.random() - 0.5) * 20, cy + 6, '#ffe9a8', 1, 160); }
    else if (e === 'rapido') for (let k = 0; k < 4; k++) { const off = (k - 1.5) * 5, ln = 18 + k * 5; PX.lineaPix(g, cx - Math.cos(a) * 8 - Math.sin(a) * off, cy - Math.sin(a) * 6 + Math.cos(a) * off * 0.8, cx - Math.cos(a) * (8 + ln), cy - Math.sin(a) * (6 + ln * 0.8) + Math.cos(a) * off * 0.8, k % 2 ? '#ffffff' : '#bfe9ff', 1); }
    else if (e === 'golpe') { if (Math.random() < 0.7) fx.polvo(l.x - Math.cos(a) * 8, l.y, 1, 6); if (Math.random() < 0.4) fx.chispas(cx + Math.cos(a) * 14, cy, '#ffe9a8', 1, 200); PX.carimbar(g, PX.estouro(Math.floor(t * 20) % 4, 8, '#ffffff', '#ffd23c'), cx + Math.cos(a) * 16, cy + Math.sin(a) * 9); }
    else if (e === 'sombra') { if (Math.random() < 0.7) fx.add({ x: cx + (Math.random() - 0.5) * 14, y: cy + (Math.random() - 0.5) * 18, vy: -20, size: 2, life: 0.4, color: '#a46ee0', forma: 'chispa' }); }
    else if (e === 'hoja' && d.def.latigo) {
      // chicote de vinha: curva verde com folha na ponta, aparece no meio do dash
      const u0 = Math.min(1, Math.max(0, (d.t - d.dur * 0.2) / (d.dur * 0.8))), L = d.def.latigo.alcance * u0;
      if (u0 > 0) {
        const pts = []; for (let k = 0; k <= 12; k++) { const u = k / 12; pts.push([cx + Math.cos(a) * L * u - Math.sin(a) * Math.sin(u * 6 + t * 30) * 7 * (1 - u) * u * 2, cy + Math.sin(a) * L * u * 0.8 + Math.cos(a) * Math.sin(u * 6 + t * 30) * 5 * (1 - u) * u * 2]); }
        for (const [col, w] of [['#0f3a1c', 5], ['#2e8a34', 3], ['#8be04e', 1]]) for (let k = 0; k < pts.length - 1; k++) PX.lineaPix(g, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], col, w);
        PX.carimbar(g, PX.hoja(9), pts[12][0], pts[12][1], a);
      }
    }
  }
  dibujarClon(g, c) {
    const l = c.dueno, bank = this.app.bank;
    g.globalAlpha = 0.65;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(c.x, c.y, 8, 3.5, 0, 0, 7); g.fill();
    bank.dibujar(g, l.dex, l.moviendo ? 'Walk' : 'Idle', this.luta.t, c.x, c.y, l.escala, { fila: filaDesdeAngulo(l.angulo) });
    g.globalAlpha = 1;
  }
  // nome da skill num balão com a cor do tipo (como no site)
  dibujarGlobo(g, b) {
    const l = b.l, k = b.t / b.life;
    g.globalAlpha = Math.min(1, (1 - k) * 3);
    const col = hexTipo(b.tipo), w = Math.ceil(medir(g, b.txt, 7, 700)) + 8, x = Math.round(l.x - w / 2), y = Math.round(l.y - l.alto - 30 - k * 5);
    rect(g, x - 1, y - 1, w + 2, 14, oscuro(col, 0.55)); rect(g, x, y, w, 12, col); rect(g, x, y, w, 1, 'rgba(255,255,255,0.35)');
    texto(g, b.txt, l.x, y + 6.5, { tam: 7, color: '#ffffff', align: 'center', base: 'middle', peso: 700, sombra: true });
    g.globalAlpha = 1;
  }
  // faixa da ultimate: desliza da esquerda, escurece a cena e some
  // a tela (só a arena) escurece enquanto a ultimate é anunciada e clareia devagar
  dibujarOscuro(g) {
    for (const b of this.fx.banners) rect(g, 0, HUD_ALTO, ANCHO, ALTO - HUD_ALTO, '#02050f', Math.max(0, Math.min(1, Math.min(b.t / 0.1, (b.life - b.t) / 0.5))) * 0.55);
    g.globalAlpha = 1;
  }
  // faixa da ultimate como no site: entra pela esquerda, borda direita inclinada, nome grande alinhado à esquerda
  dibujarBanners(g) {
    for (const b of this.fx.banners) {
      const entra = Math.min(1, b.t / 0.16), sale = Math.min(1, (b.life - b.t) / 0.25), al = Math.max(0, Math.min(entra, sale));
      const y0 = HUD_ALTO + 6, h = 40, w = Math.min(ANCHO * 0.62, 420), ease = 1 - (1 - entra) ** 3, x0 = Math.round((ease - 1) * (w + 30)), col = hexTipo(b.tipo);
      g.save(); g.globalAlpha = al; g.translate(x0, 0);
      const slab = (dx, dy, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, y0 + dy); g.lineTo(w + dx, y0 + dy); g.lineTo(w + dx - 22, y0 + h + dy); g.lineTo(0, y0 + h + dy); g.closePath(); g.fill(); };
      slab(4, 4, 'rgba(2,5,15,0.6)');
      slab(0, 0, oscuro(col, 0.45));
      g.save(); g.beginPath(); g.moveTo(0, y0); g.lineTo(w - 3, y0); g.lineTo(w - 25, y0 + h - 3); g.lineTo(0, y0 + h - 3); g.closePath(); g.clip();
      const grad = g.createLinearGradient(0, y0, 0, y0 + h); grad.addColorStop(0, claro(col, 0.25)); grad.addColorStop(1, col);
      g.fillStyle = grad; g.fillRect(0, y0, w, h);
      // brilho que atravessa a faixa
      const bx = ((b.t * 900) % (w + 200)) - 100;
      g.globalAlpha = al * 0.35; g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(bx, y0); g.lineTo(bx + 26, y0); g.lineTo(bx + 4, y0 + h); g.lineTo(bx - 22, y0 + h); g.closePath(); g.fill();
      g.globalAlpha = al;
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, y0 + 2, w, 2);
      g.restore();
      texto(g, b.txt, 16, y0 + h / 2, { tam: 22, color: '#ffffff', borde: 4, colorBorde: oscuro(col, 0.7), base: 'middle', peso: 700, max: w - 40 });
      g.restore();
    }
    g.globalAlpha = 1;
  }
  // barrinhas de calor, de estado e de "vida de baixo" em cima dos lutadores
  barrasMundo(g, luta) {
    for (const l of luta.luchadores) {
      if (l.ko || l.oculto) continue;
      const sx = Math.round(l.x), by = Math.round(l.y - l.alto - l.salto - 9);
      if (l.calor > 12 || luta.t < l.sobrecargaHasta) {
        const k = Math.min(1, l.calor / 100), w = 28, x = sx - 14;
        rect(g, x - 1, by - 1, w + 2, 6, '#04102c'); rect(g, x, by, w, 4, '#3a1a14');
        rect(g, x, by, Math.round(w * k), 4, luta.t < l.sobrecargaHasta ? (Math.floor(luta.t * 10) % 2 ? '#ff2a2a' : '#ffae2e') : k > 0.75 ? '#ff7a1a' : k > 0.5 ? '#ffae2e' : '#ffe066');
      }
      if (l.cargaTipo) {
        for (let i = 0; i < 3; i++) { const px = sx - 9 + i * 7; rect(g, px - 1, by - 11, 6, 6, '#000'); rect(g, px, by - 10, 4, 4, i < l.cargaTipo.n ? colorTipo(l.cargaTipo.tipo === 'CONFUSION' ? 'PSYCHIC' : l.cargaTipo.tipo) : '#2a3040'); }
      }
    }
  }

  // online: ping, espera pelo outro jogador e aviso de divergência
  dibujarRed(g) {
    const s = this.sesion;
    const ms = s.rtt == null ? null : Math.round(s.rtt);
    const col = ms == null ? '#93acd4' : ms < 60 ? '#3ccf4e' : ms < 110 ? '#f2c230' : '#e8463a';
    texto(g, `${s.via} ${ms ?? '--'} MS`, ANCHO / 2, HUD_ALTO + 4, { tam: 8, align: 'center', color: col, borde: 2 });
    if (s.esperando > 24 && !this.rivalFuera) texto(g, 'WAITING FOR THE OTHER PLAYER...', ANCHO / 2, 120, { tam: 8, align: 'center', color: '#f8c448', borde: 3 });
    if (s.desync) texto(g, 'OUT OF SYNC - PLEASE REMATCH', ANCHO / 2, 134, { tam: 8, align: 'center', color: '#ff7a7a', borde: 3 });
    if (this.rivalFuera) texto(g, 'THE OTHER PLAYER LEFT', ANCHO / 2, 120, { tam: 9, align: 'center', color: '#ffd23c', borde: 3 });
    if (this.menuSalir) {
      rect(g, 0, 0, ANCHO, ALTO, 'rgba(4,10,28,0.6)');
      texto(g, 'ONLINE: THE FIGHT GOES ON', ANCHO / 2, ALTO / 2 - 36, { tam: 9, align: 'center', color: '#ffd23c', borde: 3 });
      this.menuSalir.dibujar(g, this.t);
    }
  }

  // colchetes no rival quando quem luta de perto está ao alcance; ponto de mira de quem joga sem mouse
  dibujarFijado(g, luta) {
    luta.luchadores.forEach((yo, i) => {
      const r = yo.rival, c = this.ctrls?.[i];
      if (!yo.humano || yo.ko) return;
      if (yo.kit.lmb.forma === 'tajo' && r && !r.ko && Math.hypot(r.x - yo.x, r.y - yo.y) < yo.kit.lmb.alcance + 9 + 30) {
        const cx = Math.round(r.x), cy = Math.round(r.y - r.alto * 0.5), a = Math.round(r.alto * 0.5) + 4;
        g.fillStyle = COLOR_EQUIPO[i]; g.globalAlpha = 0.9;
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          g.fillRect(cx + sx * a - (sx > 0 ? 3 : 0), cy + sy * a, 4, 1);
          g.fillRect(cx + sx * a, cy + sy * a - (sy > 0 ? 3 : 0), 1, 4);
        }
        g.globalAlpha = 1;
      }
      const ap = c?.esquema === 'tactil' ? this.app.tactil.estado.apunta : null;
      if (ap) {
        // linha pontilhada e seta na direção em que o dedo está mirando
        for (let k = 1; k <= 6; k++) { g.fillStyle = k % 2 ? '#ffffff' : COLOR_EQUIPO[i]; g.fillRect(Math.round(yo.x + ap.x * (14 + k * 9)), Math.round(yo.y - yo.alto * 0.4 + ap.y * (14 + k * 9) * 0.8), 2, 2); }
        const px_ = yo.x + ap.x * 78, py_ = yo.y - yo.alto * 0.4 + ap.y * 78 * 0.8;
        g.fillStyle = '#04102c'; g.fillRect(Math.round(px_) - 2, Math.round(py_) - 2, 5, 5); g.fillStyle = '#ffffff'; g.fillRect(Math.round(px_) - 1, Math.round(py_) - 1, 3, 3);
      }
      if (c?.esquema && c.esquema !== 'kbm' && c.esquema !== 'tactil') {
        const ang = Math.atan2(yo.ay - yo.y, yo.ax - yo.x), fx = Math.round(yo.x + Math.cos(ang) * 16), fy = Math.round(yo.y + Math.sin(ang) * 9);
        g.fillStyle = COLOR_EQUIPO[i]; g.fillRect(fx - 1, fy - 1, 3, 3);
      }
    });
  }

  // treino: último dano, dano por segundo e combo; dica das teclas
  dibujarEntreno(g, luta) {
    const combo = luta.t - luta.ultimoGolpeEntreno < 2.2 ? luta.comboActual : 0;
    texto(g, `Last ${Math.round(luta.ultimoDanoEntreno)} · Dps ${luta.dps.toFixed(1)} · Combo ${combo} (Max ${luta.mejorCombo})`, ANCHO / 2, HUD_ALTO + 22, { tam: 8, align: 'center', borde: 2 });
    texto(g, this.app.tactil.activo ? 'All recharges in 3 s' : 'All recharges in 3 s · T instant · K dummy still/moving', ANCHO / 2, BARRA_Y - 12, { tam: 8, align: 'center', color: '#93acd4', borde: 2 });
  }

  dibujarTutorial(g) {
    const ps = this.tutorial.pasos, x = 6, y = HUD_ALTO + 6;
    marco(g, x, y, 112, 14 + ps.length * 11, 'panel');
    texto(g, 'TUTORIAL', x + 6, y + 4, { tam: 6, color: UI.amarillo });
    ps.forEach(([id, txt, ok], i) => texto(g, `${ok ? '✓' : '·'} ${txt}`, x + 6, y + 15 + i * 11, { tam: 6, color: ok ? '#86efac' : '#ffffff' }));
    if (ps.every(p => p[2])) texto(g, 'DONE! ESC TO EXIT', ANCHO / 2, HUD_ALTO + 12, { tam: 8, align: 'center', color: '#ffd23c', borde: 3 });
  }
  dibujarMira(g) {
    const p = this.app.entrada.ptr;
    if (p.fuera || p.y < HUD_ALTO) return;
    g.strokeStyle = '#04102c'; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, 5, 0, 7); g.moveTo(p.x - 9, p.y); g.lineTo(p.x - 3, p.y); g.moveTo(p.x + 3, p.y); g.lineTo(p.x + 9, p.y); g.moveTo(p.x, p.y - 9); g.lineTo(p.x, p.y - 3); g.moveTo(p.x, p.y + 3); g.lineTo(p.x, p.y + 9); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.stroke();
  }

  dibujarResultado(g) {
    const r = this.resultado, luta = this.luta;
    rect(g, 0, 0, ANCHO, ALTO, 'rgba(0,0,0,0.6)');
    const perd = this.datos.modo === 'cpu' && r.ganador === 1;
    texto(g, r.titulo, ANCHO / 2, 70, { tam: 24, color: perd ? '#ff5a5a' : '#ffd23c', borde: 6, align: 'center', base: 'middle', peso: 700 });
    const w = luta.luchadores[r.ganador];
    texto(g, `${w.nombre} ${luta.victorias[r.ganador]}-${luta.victorias[1 - r.ganador]}`, ANCHO / 2, 100, { tam: 8, align: 'center' });
    const n = luta.luchadores.length;
    luta.luchadores.forEach((x, i) => {
      const cx = n >= 3 ? ANCHO / 2 + (i - (n - 1) / 2) * (n === 4 ? 140 : 170) : ANCHO / 2 + (i ? 120 : -120);
      texto(g, x.nombre, cx, 134, { tam: 8, color: COLOR_EQUIPO[i], align: 'center' });
      texto(g, `DAMAGE ${Math.round(x.stats.dano)}`, cx, 150, { tam: 8, align: 'center' });
      texto(g, `HITS ${x.stats.golpes}`, cx, 164, { tam: 8, align: 'center' });
    });
    texto(g, this.sesion ? 'R  REMATCH      ESC  LEAVE' : 'R  REMATCH      ESC  PICK AGAIN', ANCHO / 2, 200, { tam: 8, color: '#f8c448', align: 'center' });
    r.lista.dibujar(g, this.t);
  }

  dibujarPausa(g) {
    rect(g, 0, 0, ANCHO, ALTO, 'rgba(4,10,28,0.78)');
    if (this.verControles) {
      texto(g, 'CONTROLS', ANCHO / 2, 40, { tam: 16, color: UI.amarillo, borde: 4, align: 'center' });
      const k = CONTROLES.kbm, k2 = CONTROLES.teclado2;
      [['PLAYER 1', `${k.mover} move · mouse aim · ${k.lmb} basic · ${k.rmb} skill`], ['', `${k.esp} dodge · ${k.q} utility · ${k.e} ultimate · ${k.mega} evolve`],
        ['PLAYER 2', `${k2.mover} move · ${k2.lmb} basic · ${k2.rmb} skill · ${k2.esp} dodge`], ['', `${k2.q} utility · ${k2.e} ultimate · ${k2.mega} evolve`], ['PAUSE', 'ESC or P']].forEach(([a, b], i) => {
        if (a) texto(g, a, 40, 76 + i * 24, { tam: 8, color: '#f8c448' });
        texto(g, b, 150, 76 + i * 24, { tam: 8, max: 460 });
      });
      texto(g, 'ANY KEY TO GO BACK', ANCHO / 2, 250, { tam: 8, color: UI.suave, align: 'center' });
      return;
    }
    texto(g, 'PAUSE', ANCHO / 2, 60, { tam: 24, color: '#ffd23c', borde: 5, align: 'center', base: 'middle', peso: 700 });
    this.menuPausa.dibujar(g, this.t);
  }
}
