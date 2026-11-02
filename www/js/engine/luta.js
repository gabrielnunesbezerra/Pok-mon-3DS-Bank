// Uma luta 1 contra 1: dois lutadores, rounds, relógio, entidades (projéteis, ondas, zonas) e eventos.
// Roda no Node nos testes e no navegador no jogo. O desenho só lê o estado e os eventos.
import { REGLAS } from '../data/regras.js';
import { OVALO, RADIO } from '../config.js';
import { limitarCampo } from './fisica.js';
import { Lutador } from './lutador.js';
import { Habilidades } from './habilidades.js';
import { sembrar, estadoAleatorio, restaurarAleatorio } from './util.js';

export class Luta {
  constructor({ p1, p2, p3 = null, p4 = null, etapas = [0, 0, 0, 0], shiny = [], equipos = null, modo = 'cpu', arena = 'estadio', medidas = null, semilla = 1, rapido = false }) {
    sembrar(semilla);
    this.semilla = semilla;
    this.modo = modo;
    this.arena = arena;
    this.medidas = medidas;
    this.rapido = rapido; // simulação sem animações de apresentação (testes)
    this.t = 0;
    this.eventos = [];
    this.entidades = [];
    this.tareas = [];
    this.pausaGolpe = 0;
    this.escalaTiempo = 1;
    this.habilidades = new Habilidades(this);
    this.luchadores = [p1, p2, p3, p4].filter(Boolean).map((def, i) => new Lutador(this, def, i, etapas[i] ?? 0));
    // duplas: equipos[i] = time do lutador i (0 azul, 1 vermelho); sem times, cada um é o seu próprio time
    this.equipos = equipos;
    this.luchadores.forEach((l, i) => { l.shiny = !!shiny?.[i]; l.equipo = equipos ? equipos[i] : i; });
    this.victorias = this.luchadores.map(() => 0);
    this.numRonda = 1;
    this.reloj = REGLAS.tiempoRonda;
    this.fase = 'intro';
    this.fin = null; // { ganador }
    this.entreno = modo === 'entreno';
    this.registroDano = []; this.mejorCombo = 0; this.comboActual = 0; this.ultimoGolpeEntreno = -9; this.ultimoDanoEntreno = 0;
    this.empezarRonda();
    this.rng = estadoAleatorio();
  }

  // cada evento sabe de quem é (para o desenho pintar o shiny com a cor dele)
  emit(ev) { if (this.ctx && ev.l === undefined && ev.dueno === undefined) ev.quien = this.ctx; this.eventos.push(ev); }
  programar(seg, fn) { this.tareas.push({ t: this.t + seg, fn, ctx: this.ctx }); }
  hitstop(ms) { if (!this.rapido) this.pausaGolpe = Math.max(this.pausaGolpe, ms); }
  add(e) { this.entidades.push(e); return e; }

  // clones (Double Team) e fumaça
  blancos(dueno) {
    const lista = [];
    const eq = dueno?.equipo;
    for (const o of this.luchadores) if (o !== dueno && !o.ko && (eq === undefined || o.equipo !== eq)) lista.push(o, ...(o.clones ?? []));
    return lista.filter(b => !b.ko);
  }
  enHumo(l) { return this.entidades.some(e => e.tipo === 'humo' && e.dueno !== l && Math.hypot(e.x - l.x, e.y - l.y) < e.radio); }
  humoFrena(l) { return this.entidades.filter(e => e.tipo === 'humo' && e.dueno !== l).reduce((m, e) => Math.max(m, Math.hypot(e.x - l.x, e.y - l.y) < e.radio ? e.frena : 0), 0); }
  dentroDeHumoPropio(l) { return this.entidades.some(e => e.tipo === 'humo' && e.dueno === l && Math.hypot(e.x - l.x, e.y - l.y) < e.radio); }

  empezarRonda() {
    this.entidades = [];
    this.tareas = [];
    const sep = 166;
    if (this.equipos) {
      // cada time do seu lado, um em cima e outro embaixo
      const n = [0, 0];
      for (const l of this.luchadores) { const k = n[l.equipo]++; l.reiniciar(OVALO.cx + (l.equipo ? sep : -sep), OVALO.cy + (k ? 56 : -56)); }
    } else {
      this.luchadores[0].reiniciar(OVALO.cx - sep, OVALO.cy);
      this.luchadores[1].reiniciar(OVALO.cx + sep, OVALO.cy);
      this.luchadores[2]?.reiniciar(OVALO.cx, OVALO.cy + 112);
      this.luchadores[3]?.reiniciar(OVALO.cx, OVALO.cy - 100);
    }
    if (this.entreno) this.luchadores[1].inmortal = true;
    this.reloj = REGLAS.tiempoRonda;
    this.escalaTiempo = 1;
    this.fase = 'intro';
    this.inicioRonda = this.t;
    const final = this.victorias.filter(v => v === REGLAS.rondasParaGanar - 1).length >= 2;
    this.emit({ t: 'ronda', n: this.numRonda, final });
    if (this.entreno) { this.emit({ t: 'anuncio', txt: 'TRAINING', color: '#f8c448' }); this.programar(0.9, () => { this.fase = 'lucha'; }); return; }
    if (this.rapido) { this.fase = 'lucha'; return; }
    this.emit({ t: 'anuncio', txt: final ? 'FINAL ROUND' : `ROUND ${this.numRonda}`, color: '#f8c448', dur: 0.7 });
    ['3', '2', '1'].forEach((n, i) => this.programar(0.95 + i * 0.55, () => { this.emit({ t: 'anuncio', txt: n, tam: 32, dur: 0.35 }); this.emit({ t: 'sonido', n: 'cuenta' }); }));
    this.programar(0.95 + 3 * 0.55, () => { this.emit({ t: 'anuncio', txt: 'FIGHT!', color: '#ffd23c', tam: 24, dur: 0.45 }); this.emit({ t: 'sonido', n: 'fight' }); this.fase = 'lucha'; });
  }

  alKO(caido) {
    if (this.fase !== 'lucha') return;
    const vivos = this.luchadores.filter(l => !l.ko);
    // a rodada só acaba quando sobra um time de pé (sem times: um lutador)
    if (new Set(vivos.map(l => l.equipo)).size > 1) { this.emit({ t: 'ko', l: caido, ganador: -1, parcial: true }); return; }
    this.fase = 'ko';
    const ganador = vivos.length ? vivos[0].lado : -1;
    if (ganador >= 0) this.vencer(ganador);
    this.emit({ t: 'ko', l: caido, ganador });
    if (!this.rapido) { this.hitstop(160); this.escalaTiempo = 0.3; this.programar(1.3 * 0.3, () => { this.escalaTiempo = 1; }); }
    this.programar(this.rapido ? 0.01 : 2.6 * 0.3 + 0.5, () => this.siguiente());
  }

  tiempoAgotado() {
    this.fase = 'ko';
    // no tempo: ganha quem tem mais vida (no modo duplas, a soma do time)
    const vida = l => (l.ko ? 0 : l.hp / l.hpMax);
    const fr = this.luchadores.map(l => (this.equipos ? this.luchadores.filter(o => o.equipo === l.equipo).reduce((s, o) => s + vida(o), 0) : l.ko ? -1 : vida(l))), mx = Math.max(...fr);
    const lideres = new Set(this.luchadores.filter((l, i) => Math.abs(fr[i] - mx) <= 0.001).map(l => l.equipo)).size;
    const ganador = lideres === 1 ? fr.indexOf(mx) : -1;
    if (ganador >= 0) this.vencer(ganador);
    this.emit({ t: 'tiempo', ganador });
    this.programar(this.rapido ? 0.01 : 2.2, () => this.siguiente());
  }

  // rodada ganha: no modo duplas conta para o time inteiro
  vencer(i) { const eq = this.luchadores[i].equipo; this.luchadores.forEach((l, k) => { if (l.equipo === eq) this.victorias[k]++; }); }
  aliados(l) { return this.luchadores.filter(o => o !== l && !o.ko && o.equipo === l.equipo); }

  siguiente() {
    if (Math.max(...this.victorias) >= REGLAS.rondasParaGanar) {
      this.fase = 'fin';
      const ganador = this.victorias.indexOf(Math.max(...this.victorias));
      this.fin = { ganador, equipo: this.luchadores[ganador].equipo };
      this.emit({ t: 'fin', ganador, equipo: this.fin.equipo });
      return;
    }
    this.numRonda++;
    this.empezarRonda();
  }

  // dt em segundos; intentos[i] = intenção do lutador i (ou null)
  paso(dt, intentos) { restaurarAleatorio(this.rng); this.avanzar(dt, intentos); this.rng = estadoAleatorio(); }
  avanzar(dt, intentos) {
    if (this.pausaGolpe > 0) { this.pausaGolpe -= dt * 1000; return; }
    dt *= this.escalaTiempo;
    this.t += dt;
    if (this.fase === 'fin') return;
    const activos = this.fase === 'lucha' || this.fase === 'ko';
    for (let i = 0; i < this.luchadores.length; i++) {
      const l = this.luchadores[i];
      if (this.fase === 'intro') continue;
      this.ctx = l;
      l.update(dt, this.fase === 'lucha' ? intentos?.[i] ?? null : null);
    }
    this.ctx = null;
    if (activos) this.separar();
    if (this.entreno && this.fase === 'lucha') this.actualizarEntreno(dt);
    if (activos) {
      for (const e of this.entidades) { this.ctx = e.dueno ?? null; if (e.vivo !== false && e.update(dt) === false) e.vivo = false; }
      this.ctx = null;
      this.entidades = this.entidades.filter(e => e.vivo !== false);
      for (const l of this.luchadores) if (l.clones) { l.clones = l.clones.filter(c => !c.ko); if (!l.clones.length) l.clones = null; }
    }
    const vencidas = this.tareas.filter(x => x.t <= this.t);
    if (vencidas.length) {
      this.tareas = this.tareas.filter(x => x.t > this.t);
      const ronda = this.numRonda;
      for (const x of vencidas) { if (ronda !== this.numRonda) break; this.ctx = x.ctx ?? null; x.fn(); }
      this.ctx = null;
    }
    if (this.fase === 'lucha' && !this.entreno) {
      this.reloj -= dt;
      if (this.reloj <= 0) { this.reloj = 0; this.tiempoAgotado(); }
    }
  }

  // os dois lutadores não se atravessam (exceto em dash, salto, voo ou escondido)
  separar() {
    const L = this.luchadores;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if (a.ko || b.ko || a.dash || b.dash || a.salto || b.salto || a.est.vuelo || b.est.vuelo) continue;
      let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      const min = RADIO * 2;
      if (d >= min) continue;
      if (d < 0.01) { dx = 1; dy = 0; d = 1; }
      const s = (min - d) / 2;
      const pa = limitarCampo(a.x - (dx / d) * s, a.y - (dy / d) * s), pb = limitarCampo(b.x + (dx / d) * s, b.y + (dy / d) * s);
      a.x = pa.x; a.y = pa.y; b.x = pb.x; b.y = pb.y;
    }
  }

  // treino: dano por segundo, combo, recarga automática em 3 s e boneco que se cura
  anotarEntreno(d) {
    this.registroDano.push({ t: this.t, d });
    this.comboActual = this.t - this.ultimoGolpeEntreno < REGLAS.comboVentana ? this.comboActual + 1 : 1;
    this.ultimoGolpeEntreno = this.t;
    this.mejorCombo = Math.max(this.mejorCombo, this.comboActual);
    this.ultimoDanoEntreno = d;
  }
  get dps() { return this.registroDano.reduce((s, x) => s + x.d, 0) / 5; }
  actualizarEntreno(dt) {
    for (const l of this.luchadores) {
      if (!l.humano) continue;
      for (const k in l.cd) l.cd[k] = Math.min(l.cd[k], 3);
      l.energia = Math.min(REGLAS.energiaMax, l.energia + (REGLAS.energiaMax / 3) * dt);
      if (l.ulti < REGLAS.ultiMax) l.ulti = Math.min(REGLAS.ultiMax, l.ulti + (REGLAS.ultiMax / 3) * dt);
      if (l.etapa < l.etapasTotales - 1 && l.exp < l.expNecesaria) l.exp = Math.min(l.expNecesaria, l.exp + (l.expNecesaria / 3) * dt);
    }
    this.registroDano = this.registroDano.filter(x => this.t - x.t <= 5);
    const m = this.luchadores[1];
    if (this.t - this.ultimoGolpeEntreno > 2.5 && m.hp < m.hpMax) m.hp = m.hpMax;
  }
  recargar() {
    if (!this.entreno) return;
    for (const l of this.luchadores) {
      if (!l.humano) continue;
      l.energia = REGLAS.energiaMax; l.ulti = REGLAS.ultiMax; l.calor = 0; l.sobrecargaHasta = 0;
      if (l.etapa < l.etapasTotales - 1) l.exp = l.expNecesaria;
      for (const k in l.cd) l.cd[k] = 0;
      l.texto('RELOAD', '#3ccf4e');
    }
  }

  // eventos desde a última leitura (o desenho chama uma vez por quadro)
  tomarEventos() { const e = this.eventos; this.eventos = []; return e; }
}
