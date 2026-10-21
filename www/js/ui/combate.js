// Cena de combate: monta a luta, liga os controles, desenha arena, lutadores, efeitos e HUD,
// e cuida de pausa e tela de resultado.
import { ANCHO, ALTO, HUD_ALTO, UI, FUENTE } from '../config.js';
import { ROSTER } from '../data/pokemon.js';
import { ARENAS } from '../data/arenas.js';
import { Luta } from '../engine/luta.js';
import { IA, Muneco } from '../engine/ia.js';
import { Camara } from '../render/camara.js';
import { crearArena } from '../render/arena.js';
import { Efectos, dibujarEntidades, dibujarProyectil, dibujarBomba, colorTipo } from '../render/efectos.js';
import { Hud } from '../render/hud.js';
import { filaDesdeAngulo } from '../render/sprites.js';
import { texto, marco, rect } from '../render/pixel.js';
import { ControlHumano, PanelTactil, CONTROLES } from '../controles.js';
import { ListaBotones } from './menus.js';
import { sfx, silenciar } from '../audio.js';

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
    const defs = [defDe(d.p1), defDe(d.p2)];
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
    if (!app.tactil) app.tactil = new PanelTactil(app);
  }

  listo() {
    const bank = this.app.bank;
    return this.defs.every(def => bank.hoja(def.dex, 'Idle') && bank.hoja(def.dex, 'Walk'));
  }

  empezar() {
    const d = this.datos, app = this.app, bank = app.bank;
    this.luta = new Luta({ p1: this.defs[0], p2: this.defs[1], etapas: d.etapas ?? [0, 0], modo: d.modo, arena: d.arena, medidas: dex => bank.medidas(dex), semilla: (Math.random() * 1e9) | 0 });
    const luta = this.luta;
    const [a, b] = luta.luchadores;
    const tactil = app.tactil.activo;
    this.ctrls = [new ControlHumano(app, luta, a, tactil ? 'tactil' : 'kbm', this.camara)];
    if (d.modo === 'versus') this.ctrls.push(new ControlHumano(app, luta, b, 'teclado2', this.camara));
    else if (d.modo === 'entreno') this.ctrls.push(new Muneco());
    else this.ctrls.push(new IA(luta, b, d.nivel));
    this.humanos = d.modo === 'versus' ? [0, 1] : [0];
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
      if (c === 'KeyR') return this.revancha();
      if (c === 'Escape' || c === 'Backspace') return this.volver();
      return this.resultado?.lista.tecla(c);
    }
    if (c === 'Escape' || c === 'KeyP' && this.datos.modo !== 'versus') return this.alternarPausa();
    if (c === 'KeyM') { this.app.ajustes.sonido = !this.app.ajustes.sonido; silenciar(!this.app.ajustes.sonido); this.app.guardarAjustes(); }
    if (this.pausado) {
      if (this.verControles) { this.verControles = false; return; }
      this.menuPausa.tecla(c);
    }
  }
  puntero(tipo, p, e) {
    if (this.pausado && !this.verControles) this.menuPausa?.puntero(tipo, p);
    else if (this.verControles && tipo === 'down') this.verControles = false;
    else if (this.luta?.fase === 'fin') this.resultado?.lista.puntero(tipo, p);
    else if (tipo === 'down' && e?.pointerType === 'touch' && p.x > ANCHO - 40 && p.y < 36) this.alternarPausa();
  }

  revancha() { this.app.ir('combate', this.datos); }

  alternarPausa() {
    if (!this.cargado || this.luta.fase === 'fin') return;
    this.pausado = !this.pausado;
    this.verControles = false;
    sfx('confirmar');
    if (this.pausado) this.armarPausa();
  }
  armarPausa() {
    const app = this.app;
    const ops = [
      { txt: 'RESUME', id: 'seguir' }, { txt: 'RESTART FIGHT', id: 'repetir' },
      { txt: `SOUND: ${app.ajustes.sonido ? 'ON' : 'OFF'}`, id: 'sonido' },
      { txt: 'CONTROLS', id: 'controles' }, { txt: 'CHANGE POKÉMON', id: 'cambiar' }, { txt: 'MAIN MENU', id: 'menu' },
    ];
    this.menuPausa = new ListaBotones({
      x: ANCHO / 2, y: 96, w: 190, h: 22, paso: 26, ops,
      alElegir: o => {
        if (o.id === 'seguir') this.alternarPausa();
        else if (o.id === 'repetir') this.revancha();
        else if (o.id === 'sonido') { app.ajustes.sonido = !app.ajustes.sonido; silenciar(!app.ajustes.sonido); app.guardarAjustes(); this.armarPausa(); this.menuPausa.foco = 2; }
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
    if (!this.pausado) this.fx.update(dt);
    this.camara.actualizar(dt, luta.luchadores, true);
  }

  marcar(id) { const p = this.tutorial?.pasos.find(x => x[0] === id); if (p && !p[2]) { p[2] = true; sfx('confirmar'); } }

  armarResultado(ganador) {
    const d = this.datos;
    const l = this.luta.luchadores[ganador];
    const titulo = d.modo === 'versus' ? `PLAYER ${ganador + 1} WINS!` : d.modo === 'cpu' ? (ganador === 0 ? 'VICTORY' : 'DEFEAT') : `${l.nombre} WINS`;
    sfx(d.modo === 'cpu' && ganador === 1 ? 'derrota' : 'victoria');
    this.resultado = {
      ganador, titulo,
      lista: new ListaBotones({
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
    // lutadores, clones e projéteis ordenados pela profundidade
    const cosas = [];
    for (const l of luta.luchadores) cosas.push({ y: l.y, f: () => this.dibujarLutador(g, l) });
    for (const e of luta.entidades) {
      if (e.tipo === 'clon') cosas.push({ y: e.y, f: () => this.dibujarClon(g, e) });
      else if (e.tipo === 'proj') cosas.push({ y: e.y + 60, f: () => dibujarProyectil(g, e, this.t) });
      else if (e.tipo === 'bomba') cosas.push({ y: e.y + 60, f: () => dibujarBomba(g, e) });
    }
    cosas.sort((a, b) => a.y - b.y).forEach(c => c.f());
    fx.dibujar(g);
    this.barrasMundo(g, luta);
    fx.dibujarTextos(g, FUENTE);
    for (const b of fx.globos) this.dibujarGlobo(g, b);
    g.restore();

    // HUD
    this.hud.dibujar(g, luta, this.t);
    for (const i of this.humanos) {
      const esquema = i === 0 ? (this.app.tactil.activo ? CONTROLES.kbm : CONTROLES.kbm) : CONTROLES.teclado2;
      this.hud.barraSkills(g, luta.luchadores[i], i, this.t, esquema);
    }
    if (this.app.tactil.activo) this.app.tactil.dibujar(g);
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
    if (l.oculto) { if (Math.random() < 0.4) this.fx.polvo(l.x, l.y, 1, 4); return; }
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
    const ok = bank.dibujar(g, l.dex, nombre, tt, l.x, l.y - l.salto, sc, { fila, bucle, flash, alpha: parpadeo });
    if (!ok) bank.dibujar(g, l.dex, 'Idle', t, l.x, l.y - l.salto, sc, { fila, flash });
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
  dibujarClon(g, c) {
    const l = c.dueno, bank = this.app.bank;
    g.globalAlpha = 0.65;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(c.x, c.y, 8, 3.5, 0, 0, 7); g.fill();
    bank.dibujar(g, l.dex, l.moviendo ? 'Walk' : 'Idle', this.luta.t, c.x, c.y, l.escala, { fila: filaDesdeAngulo(l.angulo) });
    g.globalAlpha = 1;
  }
  dibujarGlobo(g, b) {
    const l = b.l, k = b.t / b.life;
    g.globalAlpha = Math.min(1, (1 - k) * 3);
    texto(g, b.txt, l.x, l.y - l.alto - 22 - k * 6, { tam: 8, color: '#ffffff', borde: 4, align: 'center', base: 'middle', peso: 700 });
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
    luta.luchadores.forEach((x, i) => {
      const cx = ANCHO / 2 + (i ? 120 : -120);
      texto(g, x.nombre, cx, 134, { tam: 8, color: i ? '#ff5a5a' : '#4aa8ff', align: 'center' });
      texto(g, `DAMAGE ${Math.round(x.stats.dano)}`, cx, 150, { tam: 8, align: 'center' });
      texto(g, `HITS ${x.stats.golpes}`, cx, 164, { tam: 8, align: 'center' });
    });
    texto(g, 'R  REMATCH      ESC  PICK AGAIN', ANCHO / 2, 200, { tam: 8, color: '#f8c448', align: 'center' });
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
