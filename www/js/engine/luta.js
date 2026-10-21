// Uma luta 1 contra 1: dois lutadores, rounds, relógio, entidades (projéteis, ondas, zonas) e eventos.
// Roda no Node nos testes e no navegador no jogo. O desenho só lê o estado e os eventos.
import { REGLAS } from '../data/regras.js';
import { OVALO, RADIO } from '../config.js';
import { limitarCampo } from './fisica.js';
import { Lutador } from './lutador.js';
import { Habilidades } from './habilidades.js';
import { sembrar } from './util.js';

export class Luta {
  constructor({ p1, p2, etapas = [0, 0], modo = 'cpu', arena = 'estadio', medidas = null, semilla = 1, rapido = false }) {
    sembrar(semilla);
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
    this.luchadores = [p1, p2].map((def, i) => new Lutador(this, def, i, etapas[i] ?? 0));
    this.victorias = [0, 0];
    this.numRonda = 1;
    this.reloj = REGLAS.tiempoRonda;
    this.fase = 'intro';
    this.fin = null; // { ganador }
    this.entreno = modo === 'entreno';
    this.registroDano = []; this.mejorCombo = 0; this.comboActual = 0; this.ultimoGolpeEntreno = -9; this.ultimoDanoEntreno = 0;
    this.empezarRonda();
  }

  emit(ev) { this.eventos.push(ev); }
  programar(seg, fn) { this.tareas.push({ t: this.t + seg, fn }); }
  hitstop(ms) { if (!this.rapido) this.pausaGolpe = Math.max(this.pausaGolpe, ms); }
  add(e) { this.entidades.push(e); return e; }

  // clones (Double Team) e fumaça
  blancos(dueno) {
    const r = dueno.rival;
    return r ? [r, ...(r.clones ?? [])].filter(b => !b.ko) : [];
  }
  enHumo(l) { return this.entidades.some(e => e.tipo === 'humo' && e.dueno !== l && Math.hypot(e.x - l.x, e.y - l.y) < e.radio); }
  humoFrena(l) { return this.entidades.filter(e => e.tipo === 'humo' && e.dueno !== l).reduce((m, e) => Math.max(m, Math.hypot(e.x - l.x, e.y - l.y) < e.radio ? e.frena : 0), 0); }
  dentroDeHumoPropio(l) { return this.entidades.some(e => e.tipo === 'humo' && e.dueno === l && Math.hypot(e.x - l.x, e.y - l.y) < e.radio); }

  empezarRonda() {
    this.entidades = [];
    this.tareas = [];
    const sep = 166;
    this.luchadores[0].reiniciar(OVALO.cx - sep, OVALO.cy);
    this.luchadores[1].reiniciar(OVALO.cx + sep, OVALO.cy);
    if (this.entreno) this.luchadores[1].inmortal = true;
    this.reloj = REGLAS.tiempoRonda;
    this.escalaTiempo = 1;
    this.fase = 'intro';
    this.inicioRonda = this.t;
    const final = this.victorias[0] === REGLAS.rondasParaGanar - 1 && this.victorias[1] === REGLAS.rondasParaGanar - 1;
    this.emit({ t: 'ronda', n: this.numRonda, final });
    if (this.entreno) { this.emit({ t: 'anuncio', txt: 'TRAINING', color: '#f8c448' }); this.programar(0.9, () => { this.fase = 'lucha'; }); return; }
    if (this.rapido) { this.fase = 'lucha'; return; }
    this.emit({ t: 'anuncio', txt: final ? 'FINAL ROUND' : `ROUND ${this.numRonda}`, color: '#f8c448', dur: 0.7 });
    ['3', '2', '1'].forEach((n, i) => this.programar(0.95 + i * 0.55, () => { this.emit({ t: 'anuncio', txt: n, tam: 32, dur: 0.35 }); this.emit({ t: 'sonido', n: 'cuenta' }); }));
    this.programar(0.95 + 3 * 0.55, () => { this.emit({ t: 'anuncio', txt: 'FIGHT!', color: '#ffd23c', tam: 24, dur: 0.45 }); this.emit({ t: 'sonido', n: 'fight' }); this.fase = 'lucha'; });
  }

  alKO(caido) {
    if (this.fase !== 'lucha') return;
    this.fase = 'ko';
    const ganador = 1 - caido.lado;
    this.victorias[ganador]++;
    this.emit({ t: 'ko', l: caido, ganador });
    if (!this.rapido) { this.hitstop(160); this.escalaTiempo = 0.3; this.programar(1.3 * 0.3, () => { this.escalaTiempo = 1; }); }
    this.programar(this.rapido ? 0.01 : 2.6 * 0.3 + 0.5, () => this.siguiente());
  }

  tiempoAgotado() {
    this.fase = 'ko';
    const [a, b] = this.luchadores, fa = a.hp / a.hpMax, fb = b.hp / b.hpMax;
    const hay = Math.abs(fa - fb) > 0.001;
    if (hay) this.victorias[fa > fb ? 0 : 1]++;
    this.emit({ t: 'tiempo', ganador: hay ? (fa > fb ? 0 : 1) : -1 });
    this.programar(this.rapido ? 0.01 : 2.2, () => this.siguiente());
  }

  siguiente() {
    if (Math.max(...this.victorias) >= REGLAS.rondasParaGanar) {
      this.fase = 'fin';
      this.fin = { ganador: this.victorias[0] > this.victorias[1] ? 0 : 1 };
      this.emit({ t: 'fin', ganador: this.fin.ganador });
      return;
    }
    this.numRonda++;
    this.empezarRonda();
  }

  // dt em segundos; intentos[i] = intenção do lutador i (ou null)
  paso(dt, intentos) {
    if (this.pausaGolpe > 0) { this.pausaGolpe -= dt * 1000; return; }
    dt *= this.escalaTiempo;
    this.t += dt;
    if (this.fase === 'fin') return;
    const activos = this.fase === 'lucha' || this.fase === 'ko';
    for (let i = 0; i < 2; i++) {
      const l = this.luchadores[i];
      if (this.fase === 'intro') continue;
      l.update(dt, this.fase === 'lucha' ? intentos?.[i] ?? null : null);
    }
    if (activos) this.separar();
    if (this.entreno && this.fase === 'lucha') this.actualizarEntreno(dt);
    if (activos) {
      for (const e of this.entidades) if (e.vivo !== false && e.update(dt) === false) e.vivo = false;
      this.entidades = this.entidades.filter(e => e.vivo !== false);
      for (const l of this.luchadores) if (l.clones) { l.clones = l.clones.filter(c => !c.ko); if (!l.clones.length) l.clones = null; }
    }
    const vencidas = this.tareas.filter(x => x.t <= this.t);
    if (vencidas.length) {
      this.tareas = this.tareas.filter(x => x.t > this.t);
      const ronda = this.numRonda;
      for (const x of vencidas) { if (ronda !== this.numRonda) break; x.fn(); }
    }
    if (this.fase === 'lucha' && !this.entreno) {
      this.reloj -= dt;
      if (this.reloj <= 0) { this.reloj = 0; this.tiempoAgotado(); }
    }
  }

  // os dois lutadores não se atravessam (exceto em dash, salto, voo ou escondido)
  separar() {
    const [a, b] = this.luchadores;
    if (a.ko || b.ko || a.dash || b.dash || a.salto || b.salto || a.est.vuelo || b.est.vuelo) return;
    let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    const min = RADIO * 2;
    if (d >= min) return;
    if (d < 0.01) { dx = 1; dy = 0; d = 1; }
    const s = (min - d) / 2;
    const pa = limitarCampo(a.x - (dx / d) * s, a.y - (dy / d) * s), pb = limitarCampo(b.x + (dx / d) * s, b.y + (dy / d) * s);
    a.x = pa.x; a.y = pa.y; b.x = pb.x; b.y = pb.y;
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
