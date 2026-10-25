// Um lutador: vida, energia, calor, ultimate, experiência de evolução, estados, movimento e dano.
// O motor não toca no DOM: tudo que o jogador vê sai como eventos (luta.emit) que o desenho lê.
import { RADIO } from '../config.js';
import { REGLAS, ESTADOS_TIPO, efectividad } from '../data/regras.js';
import { limitarCampo } from './fisica.js';
import { clamp } from './util.js';

export const tipoLinea = def => {
  const evs = def.evoluciones ?? [];
  if (!evs.length) return 'L1';
  if (evs.every(e => e.dex === def.dex)) return 'LEG';
  return evs.length === 2 ? 'L3' : 'L2';
};
export const umbralesExp = def => (def.expEvolucion ?? REGLAS.expPorLinea?.[tipoLinea(def)] ?? REGLAS.expEvolucion).map(v => Math.round(v * (REGLAS.dificultadEvo ?? 1)));
export const etapaDe = (def, i) => {
  if (!i) return def;
  const e = def.evoluciones[i - 1];
  return { ...e, tipos: e.tipos ?? def.tipos, regen: e.regen ?? def.regen };
};

const ESTADOS_DURACION = ['quema', 'veneno', 'quemado', 'paralizado', 'empapado', 'enredado'];

export class Lutador {
  constructor(luta, def, lado, etapa = 0) {
    this.luta = luta;
    this.def = def;
    this.lado = lado;
    this.etapa = etapa;
    this.exp = 0;
    this.ulti = 0;
    this.humano = false;
    this.mega = false;
    this.reiniciar(0, 0);
  }

  // ---------------------------------------------------------------- dados derivados
  get forma() { return etapaDe(this.def, this.etapa); }
  // shiny: a mesma forma com "s" no fim (pasta dos sprites shiny do PMD)
  get dex() { return (this.mega ? this.forma.mega.dex : this.forma.dex) + (this.shiny ? 's' : ''); }
  get nombre() { return this.mega ? this.forma.mega.nombre : this.forma.nombre; }
  get tipos() { return (this.mega && this.forma.mega.tipos) || this.forma.tipos; }
  get hpMax() { return Math.round(this.forma.hp * REGLAS.vidaGlobal); }
  get atk() { return this.forma.atk + (this.mega ? this.forma.mega.atk : 0); }
  get defensa() { return this.forma.def + (this.mega ? this.forma.mega.def : 0); }
  get velBase() { return this.forma.vel + (this.mega ? this.forma.mega.vel : 0); }
  get regen() { return this.forma.regen ?? this.def.regen; }
  get escala() { return (this.forma.escala ?? 1 + REGLAS.escalaPorEtapa * this.etapa) + (this.mega ? REGLAS.escalaMega : 0); }
  get etapasTotales() { return 1 + (this.def.evoluciones?.length ?? 0); }
  get expNecesaria() { return umbralesExp(this.def)[this.etapa] ?? Infinity; }
  // segundos de rodada ainda faltando para liberar a evolução / a Mega (no treino não há espera)
  get evoEn() { return this.luta.entreno ? 0 : Math.max(0, (REGLAS.evoTras ?? 0) - (this.luta.t - this.luta.inicioRonda)); }
  get megaEn() { return this.luta.entreno ? 0 : Math.max(0, (REGLAS.megaTras ?? 0) - (this.luta.t - this.luta.inicioRonda)); }
  get puedeEvolucionar() { return this.etapa < this.etapasTotales - 1 && this.exp >= this.expNecesaria && !this.ko && this.evoEn <= 0; }
  get puedeMega() { return !!this.forma.mega && !this.mega && !this.ko && this.ulti >= REGLAS.ultiMax && this.megaEn <= 0; }
  get ultiLista() { return this.ulti >= REGLAS.ultiMax; }
  // alvo principal: o inimigo vivo mais perto (numa luta de 2 é sempre o outro lutador)
  get rival() {
    let mejor = null, dm = Infinity;
    for (const o of this.luta.luchadores) {
      if (o === this || o.ko) continue;
      const d = Math.hypot(o.x - this.x, o.y - this.y);
      if (d < dm) { dm = d; mejor = o; }
    }
    return mejor ?? this.luta.luchadores.find(o => o !== this);
  }
  get cadencia() { return this.est.potencia?.cadencia ?? 1; }
  get pecho() { return { x: this.x, y: this.y - this.alto * 0.5 - this.salto }; }
  get invulnerable() { return !!this.est.invul || !!this.est.bloqueo; }
  get oculto() { return !!this.est.vuelo && this.est.vuelo.oculto; }

  // kit = kit base da linha + kit do estágio atual + kit da Mega (cada um sobrepõe só o que muda)
  kitActual() {
    const capas = [this.forma.kit, this.mega ? this.forma.mega.kit : null].filter(Boolean);
    return Object.fromEntries(Object.entries(this.def.kit).map(([k, v]) => [k, Object.assign({}, v, ...capas.map(c => c[k] ?? {}))]));
  }

  // altura do sprite (para posicionar barras e textos); a luta preenche com as medidas do PMD
  medidas() { return this.luta.medidas?.(this.dex) ?? { feet: 5, head: -16, width: 18 }; }
  get alto() { const m = this.medidas(); return Math.round(((m.feet ?? 5) - (m.head ?? -16)) * this.escala); }
  get pies() { return Math.round((this.medidas().feet ?? 5) * this.escala); }

  reiniciar(x, y) {
    this.mega = false;
    this.evoVis = null;
    this.kit = this.kitActual();
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.empX = 0; this.empY = 0;
    this.angulo = this.lado === 1 ? Math.PI : this.lado === 2 ? -Math.PI / 2 : 0;
    this.ax = x; this.ay = y;
    this.hp = this.hpMax;
    this.energia = REGLAS.energiaInicial;
    this.calor = 0;
    this.sobrecargaHasta = 0;
    this.ultimoBasico = -9; this.ultimoAtaque = -9; this.ultimoDano = -99;
    this.cd = { lmb: 0, rmb: 0, esp: 0, q: 0, e: 0 };
    this.est = {};
    this.cargaTipo = null;
    this.accion = null;
    this.dash = null;
    this.salto = 0;
    this.combo = 0; this.ultimoGolpe = -99; this.pasoCombo = 0; this.racha = 0;
    this.aciertosCombo = 0; this.ultimoTajo = -9; this.tejido = -99;
    this.escudo = 0;
    this.ko = false;
    this.moviendo = false;
    this.dolorHasta = 0;
    this.anim = null; this.animHasta = 0; this.animEscala = 1;
    this.avisos = {};
    this.clones = null;
    this.burbuja = null;
    this.almas = 0; this.xListo = false;
    this.stats = { dano: 0, golpes: 0, usos: 0 };
    this.intento = null;
  }

  ponerEstado(nombre, dur, datos = {}) {
    const previo = this.est[nombre];
    this.est[nombre] = { ...previo, ...datos, hasta: Math.max(previo?.hasta ?? 0, this.luta.t + dur) };
  }
  tieneEstado() {
    return ['quemado', 'paralizado', 'empapado', 'enredado', 'quema', 'veneno', 'drenaje', 'lento', 'aturdido', 'confuso', 'dormido', 'debil', 'defBaja'].some(k => this.est[k]);
  }

  // animação de ação (ataque, poder...) por `dur` segundos; alHit = instante do golpe dentro da animação
  animar(nombre, dur) { this.anim = nombre; this.animInicio = this.luta.t; this.animHasta = this.luta.t + dur; }

  avisar(clave, fn, cada = 0.8) {
    const t = this.luta.t;
    if (t - (this.avisos[clave] ?? -9) < cada) return;
    this.avisos[clave] = t;
    fn();
  }
  texto(txt, color = '#ffffff', extra = {}) {
    this.luta.emit({ t: 'texto', x: this.x, y: this.y - this.alto - 6 - (extra.dy ?? 0), txt, color, ...extra });
  }

  // ---------------------------------------------------------------- recursos
  ganarExp(n) {
    if (this.ko || n <= 0 || this.etapa >= this.etapasTotales - 1 || this.est.congelado) return;
    const antes = this.exp;
    const tope = this.expNecesaria + (REGLAS.expArrastre ? (umbralesExp(this.def)[this.etapa + 1] ?? 0) : 0);
    this.exp = Math.min(tope, this.exp + n);
    if (antes < this.expNecesaria && this.exp >= this.expNecesaria) {
      this.texto('CAN EVOLVE!', '#7dd3fc');
      this.luta.emit({ t: 'puedeEvolucionar', l: this });
    }
  }
  ganarEnergia(n) {
    if (this.est.congelado) return;
    if (this.est.empapado) n *= ESTADOS_TIPO.WATER.energia;
    this.energia = Math.min(REGLAS.energiaMax, this.energia + n);
  }
  ganarUlti(n) {
    if (this.ko || n <= 0 || this.est.congelado) return;
    const antes = this.ulti;
    this.ulti = Math.min(REGLAS.ultiMax, this.ulti + n);
    if (antes < REGLAS.ultiMax && this.ulti >= REGLAS.ultiMax) {
      this.texto('ULTIMATE READY!', '#ffd166');
      this.luta.emit({ t: 'ultiLista', l: this });
    }
  }
  cura(n) {
    if (this.ko) return 0;
    const antes = this.hp;
    this.hp = Math.min(this.hpMax, this.hp + n);
    const d = this.hp - antes;
    if (d > 0.4) this.luta.emit({ t: 'texto', x: this.x, y: this.y - this.alto - 2, txt: `+${Math.max(1, Math.round(d))}`, color: '#86efac' });
    return d;
  }

  cortarAccion() {
    if (this.est.vuelo || this.est.invul || this.salto > 0) return;
    if (this.accion) { const a = this.accion; this.accion = null; a.fin?.(); }
    if (this.dash) { const d = this.dash; this.dash = null; this.vx *= 0.2; this.vy *= 0.2; d.fin?.(); }
  }

  // ---------------------------------------------------------------- dash
  empezarDash(def, ang) {
    this.dash = { def, ang, dur: def.dur, t: 0, vel: def.dist / def.dur, golpeado: false };
    delete this.est.arraigo;
    this.angulo = ang;
    if (def.invul !== false) this.ponerEstado('invul', Math.max(REGLAS.invulDash, def.dur));
    this.luta.emit({ t: 'dash', l: this, def });
  }

  avanzarDash(dt) {
    const d = this.dash;
    d.t += dt;
    this.vx = Math.cos(d.ang) * d.vel;
    this.vy = Math.sin(d.ang) * d.vel;
    if (d.def.arco) this.salto = Math.round(Math.sin(Math.min(1, d.t / d.dur) * Math.PI) * d.def.arco);
    const r = this.rival;
    const lat = d.def.latigo, c = Math.cos(d.ang), s = Math.sin(d.ang);
    const enLatigo = lat && r && d.t >= d.dur * 0.35 && (() => {
      const dx = r.x - this.x, dy = r.y - this.y, a = dx * c + dy * s;
      return a > -RADIO && a < lat.alcance + RADIO && Math.abs(dy * c - dx * s) < lat.ancho / 2 + RADIO;
    })();
    if (!d.golpeado && r && !r.ko && !r.est.vuelo && (Math.hypot(r.x - this.x, r.y - this.y) < RADIO * 2 + 4 || enLatigo)) {
      d.golpeado = true;
      const h = d.def;
      if (h.dano) {
        // Wave Crash (Basculegion): a investida machuca quem bate também
        if (h.recoil) this.luta.programar(0, () => { if (!this.ko) this.recibir(this, { dano: h.dano * h.recoil, tipo: 'NORMAL', puro: true, tick: true }); });
        r.recibir(this, {
          dano: h.dano, tipo: h.tipo, empuje: h.empuje ?? 60, aturde: h.aturde, velocista: h.velocista,
          dirX: c, dirY: s, slot: d.slot ?? 'esp', pesado: !!h.aturde || (h.empuje ?? 0) > 150,
          ralentiza: h.ralentiza ? { f: h.ralentiza, dur: h.ralentizaDur ?? 2 } : undefined,
        });
        this.luta.emit({ t: 'impacto', x: (r.x + this.x) / 2, y: r.y - r.alto * 0.5, tipo: h.tipo, estilo: h.estilo });
      }
    }
    if (d.t >= d.dur) {
      this.dash = null; this.vx *= 0.2; this.vy *= 0.2;
      if (d.def.arco) this.salto = 0;
      d.fin?.();
    }
  }

  // ---------------------------------------------------------------- dano
  // g: { dano, tipo, slot, empuje, dirX, dirY, aturde, puro, tick, surge, ... } -> 'golpe' | 'miss' | 'bloqueo' | 'nada'
  recibir(fuente, g) {
    if (this.ko) return 'nada';
    const luta = this.luta, t = luta.t;
    // Rest do Snorlax: dormindo, os golpes ricocheteiam em quem atacou
    const refleja = this.est.dormido?.refleja || this.est.espejo?.f;
    // Rest (Snorlax) e Mirror Coat (Milotic): o golpe volta para quem atacou
    if (refleja && fuente && fuente !== this && !fuente.ko && !g.reflejado && g.dano > 0) {
      fuente.recibir(this, { ...g, dano: g.dano * refleja, reflejado: true, dirX: -(g.dirX ?? 0), dirY: -(g.dirY ?? 0), aturde: undefined });
      this.avisar('reflejo', () => { this.texto('REFLECT!', '#bfdbfe'); luta.emit({ t: 'reflejo', l: this }); }, 0.3);
      return 'miss';
    }
    if (g.silencioso) {
      if (this.invulnerable || this.est.vuelo) return 'miss';
      this.aplicarEfectos(fuente, g);
      return 'golpe';
    }
    if ((this.invulnerable && !g.puro && !(g.atraviesa && !this.est.invul)) || (this.est.vuelo && !g.puro && !g.alcanzaVuelo)) {
      const bloquea = !!this.est.bloqueo;
      if (g.tick) return 'miss';
      this.avisar('miss', () => { this.texto(bloquea ? 'BLOCK' : 'MISS', bloquea ? '#ffb347' : '#c8c8d0'); luta.emit({ t: 'sonido', n: bloquea ? 'clash' : 'miss' }); }, 0.4);
      return 'miss';
    }
    // clone: leva o golpe no lugar do lutador
    const mult = g.puro || (REGLAS.basicosNeutros && g.slot === 'lmb') ? 1 : efectividad(g.tipo, this.tipos);
    let d = g.dano * mult * (g.puro ? 1 : REGLAS.danoGlobal);
    if (!g.puro) {
      d *= (fuente?.atk ?? 1) / this.defensa;
      d *= (fuente?.ventaja ?? 1) / (this.ventaja ?? 1);
      if (g.surge) d *= REGLAS.surgeMult;
      if (this.est.marca) d *= this.est.marca.f ?? REGLAS.marcaMult;
      if (fuente?.est.furia) d *= fuente.est.furia.mult;
      if (fuente?.est.potencia?.mult) d *= 1 + fuente.est.potencia.mult;
      if (fuente?.est.quemado) d *= ESTADOS_TIPO.FIRE.dano;
      if (fuente?.est.emboscada && g.slot) { d *= fuente.est.emboscada.f; delete fuente.est.emboscada; }
      if (this.est.defBaja) d *= 1.2;
      // Venoshock (Sneasler): bem mais forte em quem está envenenado
      if (g.contraVeneno && this.est.veneno) { d *= g.contraVeneno; this.avisar('vshock', () => this.texto('VENOM BONUS!', '#e879f9', { dy: 10 }), 0.5); }
      if (this.est.arraigo) d *= 1 - this.est.arraigo.reduce;
      if (this.est.potencia?.reduce) d *= 1 - this.est.potencia.reduce;
      if (this.est.blindaje) d *= 1 - this.est.blindaje.reduce;
      if (fuente?.est.debil) d *= fuente.est.debil.f;
      if (g.velocista && fuente) d *= clamp(g.velocista > 0 ? fuente.velBase / this.velBase : this.velBase / fuente.velBase, 0.8, 1.6);
      if (g.castiga && (this.accion || t - this.ultimoAtaque < 0.3)) { d *= g.castiga; this.texto('PUNISHED!', '#c084fc'); }
    }
    if (this.est.congelado && fuente !== this) d *= 1 - REGLAS.congelaReduce;
    // Stamina (Archaludon): cada golpe na defesa aumenta força e velocidade de ataque enquanto ela durar
    const st = this.est.escudo?.stamina;
    if (st && fuente && fuente !== this && !g.tick) {
      const n = Math.min(st.max ?? 5, (this.est.potencia?.n ?? 0) + 1);
      this.ponerEstado('potencia', Math.max(0.1, this.est.escudo.hasta - t), { n, mult: n * (st.mult ?? 0.06), cadencia: 1 + n * (st.cadencia ?? 0.1), vel: 0, reduce: 0, color: '#fde047' });
      this.texto(`STAMINA x${n}`, '#fde047', { dy: 10 });
    }
    if (this.escudo > 0 && !g.puro && !g.atraviesa) {
      const abs = Math.min(this.escudo, d);
      this.escudo -= abs; d -= abs;
      luta.emit({ t: 'anillo', x: this.x, y: this.y - this.alto * 0.5, color: '#7dd3fc' });
      if (this.escudo <= 0) delete this.est.escudo;
      if (d <= 0.01) return 'bloqueo';
    }
    this.hp = Math.max(0, this.hp - d);
    if (d > 0) this.ultimoDano = t;
    if (this.inmortal) { this.hp = Math.max(1, this.hp); luta.anotarEntreno?.(d); }
    if (fuente && fuente !== this) fuente.acierto(d, g);
    this.ganarUlti(d * REGLAS.ultiPorDanoRecibido);
    this.ganarExp(d * REGLAS.expPorDanoRecibido);
    this.efectosGolpe(d, mult, g, fuente);
    if (!g.tick) this.ganarEnergia(REGLAS.energiaPorGolpeRecibido);
    if (g.empuje && Number.isFinite(g.dirX) && Number.isFinite(g.dirY) && !this.est.blindaje) {
      this.empX += g.dirX * g.empuje * 5;
      this.empY += g.dirY * g.empuje * 5;
    }
    if (g.aturde) this.ponerEstado('aturdido', g.aturde);
    this.aplicarEfectos(fuente, g);
    if (fuente && fuente !== this && !g.puro) this.cargarEstadoTipo(fuente, g);
    if (this.hp <= 0) this.morir(fuente);
    return 'golpe';
  }

  aplicarEfectos(fuente, g) {
    if (g.ralentiza) this.ponerEstado('lento', g.ralentiza.dur, { f: g.ralentiza.f });
    if (g.confunde) {
      if (!this.est.confuso) this.texto('CONFUSED!', '#ff9de2');
      this.ponerEstado('confuso', g.confunde);
    }
    if (g.debilita) {
      if (!this.est.debil) this.texto('ATK DOWN', '#f9a8d4');
      this.ponerEstado('debil', g.debilita.dur, { f: g.debilita.f });
    }
    if (g.drenaje) this.ponerEstado('drenaje', g.drenaje.dur, { dps: g.drenaje.dps, cura: g.drenaje.cura, fuente });
    if (g.veneno) {
      if (!this.est.veneno) this.texto('POISONED!', '#e879f9');
      this.ponerEstado('veneno', g.veneno.dur, { dps: g.veneno.dps, fuente });
    }
    if (g.quema) {
      const pilas = Math.min(g.quema.max ?? 1, (this.est.quema?.pilas ?? 0) + 1);
      this.ponerEstado('quema', g.quema.dur, { dps: g.quema.dps, pilas, fuente });
    }
    if (g.sinDash) this.ponerEstado('sinDash', g.sinDash);
    if (g.anilla) this.anillar(g.anilla, fuente);
    // Lock-On (Porygon): o alvo marcado leva mais dano por alguns segundos
    if (g.marca) { if (!this.est.marca) this.texto('LOCKED ON', '#7df9ff'); this.ponerEstado('marca', g.marca, { f: g.marcaF ?? REGLAS.marcaMult }); }
  }

  // Psywave (Mewtwo): cada anel freia mais; o terceiro prende o alvo por um instante
  anillar(a, fuente) {
    const previo = this.est.anillas?.n ?? 0;
    if (previo >= 3) return;
    const n = previo + 1;
    this.anillasDe = fuente;
    if (n >= 3) {
      this.ponerEstado('aturdido', a.aturde);
      this.est.anillas = { n: 3, hasta: this.luta.t + a.aturde };
      this.texto('BOUND!', '#c084fc', { dy: 14 });
      this.luta.emit({ t: 'anillo', x: this.x, y: this.y - this.alto * 0.5, color: '#c084fc', r: 22 });
      return;
    }
    this.est.anillas = { n, hasta: this.luta.t + a.dur };
    this.ponerEstado('lento', a.dur, { f: Math.max(a.frena[n - 1], this.est.lento?.f ?? 0) });
    this.texto(n === 1 ? 'SLOWED' : 'SLOWED!!', '#f0abfc', { dy: 14 });
  }

  // dano que este lutador causou: carrega ultimate e experiência, ganha energia, combo e roubo de vida
  acierto(d, g) {
    const t = this.luta.t;
    this.ganarUlti(d * REGLAS.ultiPorDanoHecho);
    this.ganarExp(d * REGLAS.expPorDanoHecho);
    this.stats.dano += d;
    if (!g.tick) this.stats.golpes++;
    // Basculegion: cada golpe acertado junta uma alma de Basculin (até 5)
    if (this.def.almas && !g.tick && !g.puro && g.slot && g.slot !== 'e' && (this.almas ?? 0) < 5) { this.almas = (this.almas ?? 0) + 1; this.luta.emit({ t: 'alma', l: this }); }
    const roba = !g.puro && this.kit?.[g.slot]?.roba;
    if (roba && d > 0 && !this.ko) this.cura(d * roba);
    if (g.tick) return;
    if (g.slot === 'lmb') this.ganarEnergia(REGLAS.energiaPorGolpeBasico);
    this.combo = t - this.ultimoGolpe < REGLAS.comboVentana ? this.combo + 1 : 1;
    this.ultimoGolpe = t;
    if (this.combo === 3) {
      this.texto('3 HIT COMBO!', '#ff7ad9');
      this.luta.emit({ t: 'sonido', n: 'confirmar' });
      this.ganarEnergia(REGLAS.comboBonusEnergia);
    }
  }

  efectosGolpe(d, mult, g, fuente) {
    const luta = this.luta;
    luta.emit({ t: 'numero', x: this.x, y: this.y - this.alto - 2 - this.salto, dano: Math.max(1, Math.round(d)), mult });
    if (g.tick) return;
    luta.emit({ t: 'sonido', n: d >= 12 || g.pesado ? 'golpeFuerte' : 'golpe' });
    if (mult > 1) this.avisar('se', () => this.texto('Super Effective!', '#ffd23f'), 1);
    else if (mult < 1) this.avisar('nve', () => this.texto('Not very effective', '#9aa0b4'), 1);
    this.flash = luta.t;
    if (d >= 3) this.dolorHasta = luta.t + 0.18;
    luta.hitstop(g.ligero ? 8 : Math.min(70, 18 + d * 2.5));
    luta.emit({ t: 'impacto', x: this.x, y: this.y - this.alto * 0.5, tipo: g.tipo, fuerte: d >= 12, fuente, slot: g.slot });
    if (d >= 12 || g.pesado) luta.emit({ t: 'temblor', f: 0.006 });
  }

  // 3 golpes do mesmo tipo em 3 s aplicam o estado do tipo (queimar, encharcar, enredar, paralisar)
  cargarEstadoTipo(fuente, g) {
    const clave = g.estado ?? g.tipo, et = ESTADOS_TIPO[clave];
    if (!et || this.ko) return;
    if (g.slot === 'e' && !g.cargaEstado) { this.ponerEstadoTipo(clave, fuente); return; }
    if ((g.slot !== 'lmb' && !g.cargaEstado) || g.tick || this.est[et.est]) return;
    const c = this.cargaTipo, t = this.luta.t;
    if (c && c.tipo === clave && t - c.desde <= REGLAS.estadoVentana) c.n++;
    else this.cargaTipo = { tipo: clave, n: 1, desde: t };
    if (this.cargaTipo.n >= REGLAS.estadoGolpes) this.ponerEstadoTipo(clave, fuente);
  }
  ponerEstadoTipo(tipo, fuente) {
    const et = ESTADOS_TIPO[tipo], nuevo = !this.est[et.est];
    this.ponerEstado(et.est, et.dur ?? REGLAS.estadoDur, { fuente, dps: et.dps });
    this.cargaTipo = null;
    if (!nuevo) return;
    if (et.quita) this.energia = Math.max(0, this.energia - et.quita);
    this.texto(et.texto, '#' + et.color.toString(16).padStart(6, '0'));
    this.luta.emit({ t: 'anillo', x: this.x, y: this.y - this.alto * 0.5, color: '#' + et.color.toString(16).padStart(6, '0') });
    this.luta.emit({ t: 'sonido', n: 'estado' });
  }

  morir(fuente) {
    this.ko = true;
    this.koT = this.luta.t;
    this.accion = null; this.dash = null; this.est = {}; this.cargaTipo = null; this.salto = 0;
    this.luta.alKO(this, fuente);
  }

  // ---------------------------------------------------------------- passo de simulação
  update(dt, intento) {
    const luta = this.luta, t = luta.t;
    this.intento = intento;
    if (this.ko) return;
    const ritmo = this.est.paralizado ? ESTADOS_TIPO.ELECTRIC.ataque : 1;
    const cad = this.cadencia;
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt * ritmo * (k === 'lmb' ? cad : 1));
    this.ganarEnergia(this.regen * dt);
    if (intento) { this.ganarUlti(REGLAS.ultiPasiva * dt); this.ganarExp(REGLAS.expPasiva * dt); }
    // calor do ataque básico
    if (t < this.sobrecargaHasta) this.calor = REGLAS.calorMax * (this.sobrecargaHasta - t) / REGLAS.sobrecargaDur;
    else if (t - this.ultimoBasico > REGLAS.calorEnfriaRetraso) this.calor = Math.max(0, this.calor - REGLAS.calorEnfria * dt);
    if (this.est.puente && this.est.puente.hasta <= t) { delete this.est.puente; this.kit = this.kitActual(); }
    for (const k of Object.keys(this.est)) if (this.est[k].hasta <= t) delete this.est[k];
    if (this.est.escudo === undefined) this.escudo = 0;
    if (this.cargaTipo && t - this.cargaTipo.desde > REGLAS.estadoVentana) this.cargaTipo = null;
    if (this.anim && t >= this.animHasta) this.anim = null;

    // dreno (Leech Seed): rouba vida por segundo e cura quem lançou
    const dr = this.est.drenaje;
    if (dr) {
      dr.acum = (dr.acum ?? 0) + dt;
      if (dr.acum >= 1) {
        dr.acum -= 1;
        const antes = this.hp;
        this.recibir(dr.fuente, { dano: dr.dps, tipo: 'GRASS', puro: true, tick: true });
        const f = dr.fuente, robado = antes - this.hp;
        if (f && !f.ko && robado > 0) f.cura(robado * (dr.cura ?? 1));
        if (this.ko) return;
      }
    }
    // regeneração fora de combate
    if (t - this.ultimoDano >= REGLAS.curaTras && this.hp < this.hpMax) this.hp = Math.min(this.hpMax, this.hp + REGLAS.curaFuera * REGLAS.vidaGlobal * dt);
    for (const nombre of ['dormido', 'arraigo', 'aquaRing']) {
      const e = this.est[nombre];
      if (!e) continue;
      e.acum = (e.acum ?? 0) + dt;
      const paso = nombre === 'dormido' ? 0.5 : 1;
      if (e.acum >= paso) { e.acum -= paso; this.cura(nombre === 'dormido' ? e.cura * 0.5 : e.cura); }
    }
    for (const clave of ['quema', 'quemado', 'veneno']) {
      const q = this.est[clave];
      if (!q) continue;
      q.acum = (q.acum ?? 0) + dt;
      if (q.acum >= 1) {
        q.acum -= 1;
        this.recibir(q.fuente, { dano: (q.dps ?? 1) * (q.pilas ?? 1), tipo: clave === 'veneno' ? 'POISON' : 'FIRE', puro: true, tick: true });
        if (this.ko) return;
      }
    }

    const aturdido = !!this.est.aturdido || !!this.est.dormido;
    if (aturdido) this.cortarAccion();
    let mx = 0, my = 0;
    if (intento && !aturdido) {
      mx = intento.mx; my = intento.my;
      if (this.est.confuso) { mx = -mx; my = -my; }
      this.ax = intento.ax; this.ay = intento.ay;
    }
    if (this.dash) this.avanzarDash(dt);
    else {
      let vel = this.velBase;
      if (this.est.lento) vel *= 1 - this.est.lento.f;
      if (this.est.enredado) vel *= ESTADOS_TIPO.GRASS.vel;
      if (this.est.arraigo || this.est.dormido || this.est.puente) { vel = 0; this.empX = 0; this.empY = 0; }
      if (this.accion?.lento != null) vel *= this.accion.lento;
      if (t < this.sobrecargaHasta) vel *= 0.75;
      if (this.est.rapido) vel *= this.est.rapido.vel;
      if (this.est.rodando) vel *= this.est.rodando.vel;
      if (this.est.potencia?.vel) vel *= 1 + this.est.potencia.vel;
      if (this.est.vuelo) vel *= this.est.vuelo.rapidez ?? 1;
      if (this.est.caparazon) vel *= this.est.caparazon.rapidez ?? 1;
      if (luta.enHumo(this)) vel *= 1 - luta.humoFrena(this);
      this.vx = mx * vel; this.vy = my * vel;
    }
    this.x += (this.vx + this.empX) * dt;
    this.y += (this.vy + this.empY) * dt;
    const k = Math.exp(-9 * dt);
    this.empX *= k; this.empY *= k;
    const p = limitarCampo(this.x, this.y);
    this.x = p.x; this.y = p.y;
    this.moviendo = !this.dash && Math.hypot(mx, my) > 0.1;
    const apuntando = this.accion || t - this.ultimoAtaque < 0.45;
    if (this.accion?.angulo != null) this.angulo = this.accion.angulo;
    else if (apuntando) this.angulo = Math.atan2(this.ay - this.y, this.ax - this.x);
    else if (this.moviendo) this.angulo = Math.atan2(my, mx);
    // Rollout: quando para de rolar (de qualquer jeito), a skill entra em recarga
    if (this._rodando && !this.est.rodando) this.cd[this._rodando.slot ?? 'esp'] = Math.max(this.cd[this._rodando.slot ?? 'esp'], this._rodando.cd ?? 8);
    this._rodando = this.est.rodando ?? null;
    // Rollout: atropela quem encosta (cada alvo no máximo uma vez a cada 0,6 s)
    const rod = this.est.rodando;
    if (rod && !this.dash && Math.hypot(this.vx, this.vy) > 20) {
      const v = Math.hypot(this.vx, this.vy);
      for (const b of luta.blancos(this)) {
        if (b.oculto || b.est?.vuelo || Math.hypot(b.x - this.x, b.y - this.y) > RADIO * 2 + 6 || t - (rod.golpes.get(b) ?? -9) < 0.6) continue;
        rod.golpes.set(b, t);
        if (b.esClon) { b.romper(); continue; }
        b.recibir(this, { dano: rod.dano, tipo: rod.tipo ?? 'ROCK', slot: rod.slot ?? 'esp', empuje: rod.empuje, dirX: this.vx / v, dirY: this.vy / v, aturde: 0.2, pesado: true });
        luta.emit({ t: 'impacto', x: (b.x + this.x) / 2, y: b.y - b.alto * 0.5, tipo: 'ROCK', fuerte: true });
        luta.emit({ t: 'temblor', f: 0.008 });
      }
    }
    // nada deixa o lutador preso no ar (ex.: pulo cortado no meio)
    if (!this.accion && !this.dash && !this.est.vuelo && this.salto > 0) this.salto = 0;
    if (this.accion) {
      this.accion.update?.(dt);
      if (this.accion && t >= this.accion.hasta) { const a = this.accion; this.accion = null; a.fin?.(); }
    }
    // evolução / Mega
    if (intento?.mega && !aturdido && !this.dash && !this.est.vuelo && !this.accion?.bloquea) {
      if (this.puedeEvolucionar) luta.habilidades.evolucionar(this);
      else if (this.puedeMega) luta.habilidades.megaevolucionar(this);
    }
    if (intento && !aturdido && !this.dash) {
      for (const slot of ['esp', 'e', 'q', 'rmb', 'lmb']) if (intento[slot]) luta.habilidades.usar(this, slot);
    }
  }
}
