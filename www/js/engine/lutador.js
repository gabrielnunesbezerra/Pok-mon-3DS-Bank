// Um lutador: vida, energia, calor, ultimate, experiência de evolução, estados, movimento e dano.
// O motor não toca no DOM: tudo que o jogador vê sai como eventos (luta.emit) que o desenho lê.
import { RADIO } from '../config.js';
import { REGLAS, ESTADOS_TIPO, efectividad } from '../data/regras.js';
import { limitarCampo } from './fisica.js';
import { resolverLutador } from './obstaculos.js';
import { clamp, difAng } from './util.js';

// chama no chão deixada pela corrida da Mega Houndoom: queima quem pisa
function llamaSuelo(luta, dueno, x, y, dano) {
  let t = 0, prox = 0.1;
  return { tipo: 'llama', dueno, vivo: true, x, y, update: dt => {
    t += dt;
    if (t >= prox) {
      prox = t + 0.4;
      for (const b of luta.blancos(dueno)) if (!b.est?.vuelo && Math.hypot(b.x - x, (b.y - y) / 0.62) < 14 + RADIO) b.recibir(dueno, { dano, tipo: 'FIRE', tick: true, quema: { dps: 2, dur: 2, max: 2 } });
    }
    return t < 2;
  } };
}

// espada fantasma do Ceruledge: segue o alvo e corta de novo depois de 0,8 s
function espadaFantasma(luta, dono, alvo, g) {
  let t = 0;
  luta.emit({ t: 'espadaAparece', b: alvo });
  return { tipo: 'espadaFantasma', dueno: dono, vivo: true, alvo, x: alvo.x, y: alvo.y, t: 0, update(dt) {
    t += dt; this.t = t; this.x = alvo.x; this.y = alvo.y;
    if (alvo.ko || dono.ko) return false;
    if (t < 0.8) return true;
    alvo.recibir(dono, { dano: (g.dano ?? 0) * 0.4, tipo: 'GHOST', slot: g.slot, espada: true, empuje: 30, dirX: g.dirX, dirY: g.dirY });
    luta.emit({ t: 'corteEspada', x: alvo.x, y: alvo.y - alvo.alto * 0.5 });
    return false;
  } };
}

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

const CONTROLES_CC = new Set(['aturdido', 'paralizado', 'dormido', 'confuso', 'enredado', 'lento', 'ancorado', 'silencio', 'debil', 'cego']);

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
  // Aegislash: na forma Lâmina usa o sprite e os atributos da lâmina (forma.lamina)
  get lam() { return this.lamina && !this.mega ? this.forma.lamina : null; }
  // Morpeko: no modo Faminto usa o sprite da forma Hangry
  get dex() { return (this.mega ? this.forma.mega.dex : this.lam?.dex ?? (this.fome && this.def.dexFome ? this.def.dexFome : this.forma.dex)) + (this.shiny ? 's' : ''); }
  get nombre() { return this.mega ? this.forma.mega.nombre : this.forma.nombre; }
  get tipos() { return (this.mega && this.forma.mega.tipos) || this.forma.tipos; }
  get hpMax() { return Math.round(this.forma.hp * REGLAS.vidaGlobal); }
  get atk() { return this.forma.atk + (this.mega ? this.forma.mega.atk : 0) + (this.lam?.atk ?? 0); }
  get defensa() { return this.forma.def + (this.mega ? this.forma.mega.def : 0) + (this.lam?.def ?? 0); }
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
      if (o === this || o.ko || o.equipo === this.equipo) continue;
      const d = Math.hypot(o.x - this.x, o.y - this.y);
      if (d < dm) { dm = d; mejor = o; }
    }
    return mejor ?? this.luta.luchadores.find(o => o !== this && o.equipo !== this.equipo);
  }
  get cadencia() { return this.est.potencia?.cadencia ?? 1; }
  get pecho() { return { x: this.x, y: this.y - this.alto * 0.5 - this.salto }; }
  get invulnerable() { return !!this.est.invul || !!this.est.bloqueo; }
  get oculto() { return !!this.est.vuelo && this.est.vuelo.oculto; }

  // kit = kit base da linha + kit do estágio atual + kit da Mega (cada um sobrepõe só o que muda)
  kitActual() {
    // Morpeko: no modo Faminto entra o kit de perto (def.kitFome) por cima do kit do estágio
    const capas = [this.forma.kit, this.fome ? this.def.kitFome : null, this.mega ? this.forma.mega.kit : null].filter(Boolean);
    return Object.fromEntries(Object.entries(this.def.kit).map(([k, v]) => [k, Object.assign({}, v, ...capas.map(c => c[k] ?? {}))]));
  }

  // altura do sprite (para posicionar barras e textos); a luta preenche com as medidas do PMD
  medidas() { return this.luta.medidas?.(this.dex) ?? { feet: 5, head: -16, width: 18 }; }
  get alto() { const m = this.medidas(); return Math.round(((m.feet ?? 5) - (m.head ?? -16)) * this.escala); }
  get pies() { return Math.round((this.medidas().feet ?? 5) * this.escala); }

  reiniciar(x, y) {
    // a Mega Slowbro fica Mega nos rounds seguintes, ganhando ou perdendo
    this.mega = !!(this.def.megaFija && this.mega && this.forma?.mega);
    this.evoVis = null;
    this.fome = false;
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
    this.almas = 0; this.xListo = false; this.jabHasta = 0; this.fervor = 0; this.ultimoFuego = -99; this.plasma = 0; this.voltPos = null; this.disfarce = !!this.def.disfarce; this.disfarceVolta = 0; this.carga = 0; this.folhaHasta = 0;
    this.stats = { dano: 0, golpes: 0, usos: 0 };
    this.intento = null;
  }

  ponerEstado(nombre, dur, datos = {}) {
    // Amnésia / Shellder (Slowbro): imune a controle
    if (this.est.imuneCC && this.est.imuneCC.hasta > this.luta.t && CONTROLES_CC.has(nombre)) return;
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
    n *= this.def.ultiMult ?? 1;
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
        const sc = d.sobrecarga;
        r.recibir(this, {
          dano: h.dano * (sc ? 1.3 : 1), tipo: h.tipo, empuje: h.empuje ?? 60, aturde: sc ? Math.max(h.aturde ?? 0, 0.35) : h.aturde, velocista: h.velocista, maldicion: h.maldicion,
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
      if (this.est.concha && g.dano > 0) { this.est.concha.acum += g.dano; if (!g.tick) this.est.concha.hits++; }
      if (g.tick) return 'miss';
      // Preságio Sombrio da Mega Absol: desviou de um golpe
      if (this.est.presagio && fuente && fuente !== this) this.est.presagio.fn(fuente, true);
      this.avisar('miss', () => { this.texto(bloquea ? 'BLOCK' : 'MISS', bloquea ? '#ffb347' : '#c8c8d0'); luta.emit({ t: 'sonido', n: bloquea ? 'clash' : 'miss' }); }, 0.4);
      return 'miss';
    }
    // Disguise (Mimikyu): o primeiro golpe só rasga o pano; ele volta depois de um tempo sem apanhar
    if (this.disfarce && fuente && fuente !== this && !g.tick && !g.puro && (g.dano ?? 0) > 0) {
      this.disfarce = false; this.disfarceVolta = t + 22;
      this.texto('DISGUISE BROKE!', '#fde68a'); luta.emit({ t: 'disfarceQuebra', l: this }); luta.hitstop(80);
      return 'bloqueo';
    }
    // espinhos de cristal da Mega Gigalith: devolvem parte do dano dos básicos
    if (this.est.refleteBasico && g.slot === 'lmb' && fuente && fuente !== this && !g.reflejado && !fuente.ko) fuente.recibir(this, { dano: (g.dano ?? 0) * this.est.refleteBasico.f, tipo: g.tipo, tick: true, reflejado: true });
    // paralisia: tiros marcados (a cada 3 do Morpeko) e o primeiro golpe depois da troca de forma pela ult
    if (fuente && fuente !== this && !g.tick && !g.reflejado && (g.paralisa || (fuente.est?.proxParalisa && !g.naoConsome))) { if (fuente.est?.proxParalisa && !g.paralisa) delete fuente.est.proxParalisa; this.ponerEstado('paralizado', g.paralisa || 1.2, {}); this.texto('PARALYZED!', '#fde047'); luta.emit({ t: 'paralisaMorpeko', l: this }); }
    // Fúria Berserk (Drampa): abaixo de 50% de vida bate 30% mais e o controle dura +0,5s
    if (fuente?.def?.berserk && fuente.hp < fuente.hpMax * 0.5 && !g.reflejado) { g = { ...g, dano: (g.dano ?? 0) * 1.3 }; if (g.aturde) g.aturde += 0.5; if (g.ralentiza) g.ralentiza = { ...g.ralentiza, dur: g.ralentiza.dur + 0.5 }; if (g.duerme) g.duerme += 0.5; }
    // Escudo Glacial (Glalie): quem acerta várias vezes congela
    if (this.est.glacial && fuente && fuente !== this && !g.tick && !g.reflejado && !fuente.ko) this.est.glacial.fn(fuente);
    // Preságio Sombrio (Absol): na postura, quem bate fica lento e leva o contra-ataque
    if (this.est.presagio && fuente && fuente !== this && !g.tick && !g.contragolpe && !fuente.ko) this.est.presagio.fn(fuente, false);
    // Counter (Kangaskhan): na guarda, o golpe não entra e volta como soco (de longe só bloqueia)
    const ct = this.est.contra;
    if (ct && fuente && fuente !== this && !g.tick && !fuente.ko && !g.contragolpe) {
      delete this.est.contra; this.accion = null;
      const h = ct.h, dx = fuente.x - this.x, dy = fuente.y - this.y, dd = Math.hypot(dx, dy) || 1;
      this.ponerEstado('invul', 0.3);
      this.texto('COUNTER!', '#ffd166');
      luta.emit({ t: 'contragolpe', l: this, b: fuente, perto: dd < 200 });
      if (dd < 200) { this.animar('Attack', 0.4); this.angulo = Math.atan2(dy, dx); fuente.recibir(this, { dano: h.dano + (g.dano ?? 0) * (h.devuelve ?? 0.5), tipo: h.tipo, slot: 'q', dirX: dx / dd, dirY: dy / dd, empuje: 150, aturde: h.aturde ?? 0.6, pesado: true, contragolpe: true }); luta.hitstop(110); }
      return 'bloqueo';
    }
    // Dark Void (Darkrai): quem dorme com pesadelo acorda com o golpe, que entra mais forte
    const pesadilla = this.est.dormido?.pesadilla && fuente && fuente !== this && !g.tick;
    if (pesadilla) { delete this.est.dormido; this.texto('NIGHTMARE!', '#a78bfa'); luta.emit({ t: 'despertar', l: this }); }
    // clone: leva o golpe no lugar do lutador
    const mult = g.puro || (REGLAS.basicosNeutros && g.slot === 'lmb') ? 1 : efectividad(g.tipo, this.tipos);
    let d = g.dano * mult * (g.puro ? 1 : REGLAS.danoGlobal);
    if (!g.puro) {
      d *= (fuente?.atk ?? 1) / this.defensa;
      d *= (fuente?.ventaja ?? 1) / (this.ventaja ?? 1);
      // Houndoom: quanto mais quente, mais dano (até +60%)
      if (fuente?.def?.fervor) d *= 1 + (fuente.fervor / 100) * 0.8;
      if (g.surge) d *= REGLAS.surgeMult;
      if (this.est.marca) d *= this.est.marca.f ?? REGLAS.marcaMult;
      if (fuente?.est.furia) d *= fuente.est.furia.mult;
      if (fuente?.est.potencia?.mult) d *= 1 + fuente.est.potencia.mult;
      if (fuente?.est.quemado) d *= ESTADOS_TIPO.FIRE.dano;
      // Megas batem um pouco menos (estavam dando dano demais)
      if (fuente?.mega && fuente !== this) d *= REGLAS.danoMega ?? 0.85;
      if (fuente?.est.emboscada && g.slot) { d *= fuente.est.emboscada.f; delete fuente.est.emboscada; }
      if (this.est.defBaja) d *= 1.2;
      // maldição (Gengar), pesadelo (Darkrai) e Hex: dano a mais
      if (this.est.maldito) d *= this.est.maldito.f;
      if (this.est.pesadelo && fuente === this.est.pesadelo.fuente) d *= this.est.pesadelo.f;
      if (pesadilla) d *= 1.5;
      if (g.contraEstado && (this.tieneEstado() || this.est.maldito)) { d *= g.contraEstado; this.avisar('hex', () => this.texto('HEX!', '#c084fc', { dy: 10 }), 0.5); }
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
      // Cotton Guard: quebra depois de alguns golpes, mesmo com escudo sobrando
      const es = this.est.escudo;
      if (es?.golpesMax && !g.tick && ++es.golpes >= es.golpesMax) { this.escudo = 0; es.roto = true; this.texto('GUARD BROKEN!', '#e5e7eb'); luta.emit({ t: 'burbujaRompe', l: this }); }
      if (this.escudo <= 0) delete this.est.escudo;
      if (d <= 0.01) return 'bloqueo';
    }
    // Psychic Link (Gardevoir): o aliado ligado divide o dano com ela
    const pr = this.est.protegido;
    if (pr && !g.vinculado && fuente !== this && pr.por && !pr.por.ko && d > 0) { const parte = d * pr.reparte; d -= parte; pr.por.recibir(fuente, { dano: parte, tipo: g.tipo, puro: true, tick: true, vinculado: true }); }
    this.hp = Math.max(0, this.hp - d);
    if (this.def.berserk && this.hp > 0 && this.hp < this.hpMax * 0.5 && !this.luta.entidades.some(e => e.tipo === 'olhosBerserk' && e.dueno === this)) {
      this.texto('BERSERK!', '#ef4444'); luta.emit({ t: 'berserk', l: this });
      luta.add({ tipo: 'olhosBerserk', dueno: this, vivo: true, update: () => !this.ko && this.hp < this.hpMax * 0.5 });
    }
    if (d > 0) this.ultimoDano = t;
    // Ceruledge: golpe de skill deixa uma espada fantasma que corta de novo um instante depois
    if (fuente?.def?.espadas && g.slot && g.slot !== 'lmb' && !g.tick && !g.espada && d > 0 && !this.ko) luta.add(espadaFantasma(luta, fuente, this, g));
    // ligada a um rival, parte do que ela sofre volta para ele
    const vi = this.est.vinculo;
    if (vi?.modo === 'inimigo' && !g.vinculado && fuente && fuente !== this && d > 0 && !vi.con.ko) { vi.con.recibir(this, { dano: d * vi.refleja, tipo: 'PSYCHIC', puro: true, tick: true, vinculado: true }); luta.emit({ t: 'vinculoDor', l: this, b: vi.con }); }
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
    // Spirit Shackle: preso no chão (a sombra fica pregada)
    if (g.prende && !this.ko) { this.cortarAccion(); this.accion = { hasta: this.luta.t + g.prende, bloquea: true, lento: 0 }; this.vx = this.vy = 0; this.ponerEstado('ancorado', g.prende); }
    if (g.maldicion) { if (!this.est.maldito) this.texto('CURSED!', '#c084fc'); this.ponerEstado('maldito', g.maldicion.dur ?? 4, { f: g.maldicion.f ?? 1.2, fuente }); }
    if (g.duerme && !this.est.dormido && !this.ko) { this.ponerEstado('dormido', g.duerme, { cura: 0, acum: 0, pesadilla: true, dps: g.pesadillaDps ?? 0, fuente }); this.cortarAccion(); this.texto('ASLEEP!', '#a5b4fc'); }
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
  // ---------------------------------------------------------------- Houndoom: superaquecimento
  calentar(n) {
    const antes = this.fervor;
    this.fervor = Math.min(100, this.fervor + n); this.ultimoFuego = this.luta.t;
    if (antes < 75 && this.fervor >= 75) { this.texto('OVERHEATING!', '#ff5a2a'); this.luta.emit({ t: 'sonido', n: 'surge' }); }
  }

  // Psychic Link, plasma do Zeraora e passivas das Megas novas
  pasivasNuevas(dt) {
    const luta = this.luta, vi = this.est.vinculo;
    if (vi) {
      if (vi.con.ko || Math.hypot(vi.con.x - this.x, vi.con.y - this.y) > 320) {
        delete this.est.vinculo; delete vi.con.est.protegido; delete vi.con.est.ligado;
        luta.emit({ t: 'vinculoRompe', l: this, b: vi.con });
      } else if (vi.modo === 'aliado') { vi.acum = (vi.acum ?? 0) + dt; if (vi.acum >= 1) { vi.acum -= 1; vi.con.cura(vi.cura); } }
    }
    if (this.def.plasma) {
      const antes = this.plasma;
      this.plasma = Math.min(100, this.plasma + Math.hypot(this.vx, this.vy) * dt * (this.mega ? 0.42 : 0.12));
      if (antes < 100 && this.plasma >= 100) { this.texto('PLASMA FULL!', '#fde047'); luta.emit({ t: 'plasmaCheio', l: this }); }
    }
    if (this.def.disfarce && !this.disfarce && luta.t >= this.disfarceVolta) { this.disfarce = true; this.texto('DISGUISE UP', '#fde68a'); luta.emit({ t: 'disfarceVolta', l: this }); }
    const pas = this.mega ? this.forma.mega?.pasiva : null;
    // Mega Gengar (Shadow Tag): quem está perto não consegue dar dash
    if (pas === 'sombra') for (const b of luta.blancos(this)) if (!b.esClon && Math.hypot(b.x - this.x, b.y - this.y) < 150) b.ponerEstado('sinDash', 0.2);
    // Mega Rayquaza (Delta Stream): tiros inimigos perto dele perdem força
    if (pas === 'delta') for (const o of luta.entidades) if (o.tipo === 'proj' && o.dueno && o.dueno.equipo !== this.equipo && Math.hypot(o.x - this.x, o.y - this.y) < 110) { const f = Math.exp(-2.2 * dt); o.vx *= f; o.vy *= f; }
  }

  acierto(d, g) {
    const t = this.luta.t;
    if (g.roubaVida && !g.tick) this.cura(d * g.roubaVida);
    if (this.def.plasma && !g.tick) this.plasma = Math.min(100, this.plasma + (g.slot === 'lmb' ? 5 : 2));
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
    // Flame Charge (Houndoom): a corrida gasta o calor; acabou o calor, para
    const co = this.est.corrida;
    if (co) {
      this.fervor = Math.max(0, this.fervor - co.gasta * dt); this.ultimoFuego = t;
      if (co.rastro && t >= co.prox && Math.hypot(this.vx, this.vy) > 20) { co.prox = t + 0.12; this.luta.emit({ t: 'rastroLlama', x: this.x, y: this.y }); this.luta.add(llamaSuelo(this.luta, this, this.x, this.y, co.dano)); }
      if (this.fervor <= 0) { delete this.est.corrida; this.cd.esp = Math.max(this.cd.esp, co.cd ?? 2); }
    }
    // Houndoom: esfria quando para de usar fogo; acima de 75 o corpo queima
    if (this.def.fervor && this.fervor > 0) {
      if (t - this.ultimoFuego > 1.5) this.fervor = Math.max(0, this.fervor - 9 * dt);
      if (this.fervor > 80) { this.dolorCalor = (this.dolorCalor ?? 0) + (this.fervor - 80) * 0.1 * dt; if (this.dolorCalor >= 1) { const n = Math.floor(this.dolorCalor); this.dolorCalor -= n; this.recibir(this, { dano: n, tipo: 'FIRE', puro: true, tick: true }); } }
    }
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
      if (e.acum >= paso) { e.acum -= paso; this.cura(nombre === 'dormido' ? e.cura * 0.5 : e.cura); if (nombre === 'dormido' && e.dps) { this.recibir(e.fuente, { dano: e.dps * 0.5, tipo: 'DARK', puro: true, tick: true }); if (this.ko) return; } }
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

    this.pasivasNuevas(dt);
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
      if (this.est.ligado) vel *= 1 - this.est.ligado.f;
      if (this.est.arraigo || this.est.dormido || this.est.puente) { vel = 0; this.empX = 0; this.empY = 0; }
      if (this.accion?.lento != null) vel *= this.accion.lento;
      if (t < this.sobrecargaHasta) vel *= 0.75;
      if (this.est.rapido) vel *= this.est.rapido.vel;
      if (this.est.rodando) vel *= this.est.rodando.vel;
      if (this.est.potencia?.vel) vel *= 1 + this.est.potencia.vel;
      if (this.est.vuelo) vel *= this.est.vuelo.rapidez ?? 1;
      if (this.est.caparazon) vel *= this.est.caparazon.rapidez ?? 1;
      if (luta.enHumo(this)) vel *= 1 - luta.humoFrena(this);
      if (this.est.corrida) vel *= this.est.corrida.vel;
      if (this.est.surf) vel *= this.est.surf.vel;
      const av = this.est.aeronave;
      if (av) {
        // Jet Mode (Dragapult): anda sempre para a frente e vira devagar, como um carro; o Dragon Dance acelera
        const dd = 1 + (this.est.potencia?.n ?? 0) * 0.12;
        if (Math.hypot(mx, my) > 0.1) av.rumbo += clamp(difAng(Math.atan2(my, mx), av.rumbo), -av.giro * dt, av.giro * dt);
        const v = this.velBase * av.vel * dd * (this.accion?.lento != null ? Math.max(0.7, this.accion.lento) : 1);
        this.vx = Math.cos(av.rumbo) * v; this.vy = Math.sin(av.rumbo) * v;
      } else { this.vx = mx * vel; this.vy = my * vel; }
    }
    this.x += (this.vx + this.empX) * dt;
    this.y += (this.vy + this.empY) * dt;
    const k = Math.exp(-9 * dt);
    this.empX *= k; this.empY *= k;
    const p = limitarCampo(this.x, this.y);
    this.x = p.x; this.y = p.y;
    resolverLutador(this.luta, this, dt);
    this.moviendo = !this.dash && Math.hypot(mx, my) > 0.1;
    const apuntando = this.accion || t - this.ultimoAtaque < 0.45;
    if (this.accion?.angulo != null) this.angulo = this.accion.angulo;
    else if (apuntando) this.angulo = Math.atan2(this.ay - this.y, this.ax - this.x);
    else if (this.moviendo) this.angulo = Math.atan2(my, mx);
    // Rollout: parou de girar de qualquer jeito (tempo, ult, atordoado) => recarga grande
    if (this._rodando && !this.est.rodando) this.cd[this._rodando.slot ?? 'esp'] = Math.max(this.cd[this._rodando.slot ?? 'esp'], this._rodando.cd ?? 14);
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
