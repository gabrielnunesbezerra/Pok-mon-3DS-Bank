// Coisas que existem na arena além dos lutadores: projéteis, raios, cones, ondas, pedras caindo,
// fumaça, poças e clones. Cada uma tem update(dt) (devolve false ao acabar) e dados para o desenho.
import { RADIO } from '../config.js';
import { REGLAS } from '../data/regras.js';
import { aleatorio, entre, difAng, distSegmento, clamp } from './util.js';
import { fueraCampo, fijarCampo } from './fisica.js';

const rad = g => (g * Math.PI) / 180;

// monta o pacote de dano que vai para Lutador.recibir
export function pacote(h, extra, ang, mas = {}) {
  return {
    dano: h.dano, tipo: h.tipo, slot: extra?.slot, surge: extra?.surge, dirX: Math.cos(ang), dirY: Math.sin(ang),
    empuje: h.empuje, aturde: h.aturde, confunde: h.confunde || undefined, debilita: h.debilita, drenaje: h.drenaje, quema: h.quema,
    veneno: h.veneno, ralentiza: h.ralentiza ? { f: h.ralentiza, dur: h.ralentizaDur ?? 2 } : undefined, ...mas,
  };
}

// golpeia um alvo (lutador ou clone) e devolve o resultado
export function atingir(dueno, alvo, g) {
  if (alvo.esClon) { alvo.romper(); return 'golpe'; }
  return alvo.recibir(dueno, g);
}

// ---------------------------------------------------------------- projétil
export class Proyectil {
  constructor(luta, dueno, h, ang, extra = {}) {
    this.luta = luta; this.dueno = dueno; this.h = h; this.ang = ang; this.extra = extra;
    this.tipo = 'proj';
    this.estilo = h.estilo ?? 'bola';
    this.tipoAtq = h.tipo;
    const boca = extra.desde ?? { x: dueno.x + Math.cos(ang) * 10, y: dueno.y + Math.sin(ang) * 6, alt: dueno.alto * 0.55 };
    this.x = boca.x; this.y = boca.y; this.alt = boca.alt ?? dueno.alto * 0.55; this.alt0 = this.alt;
    this.recorrido = 0;
    this.vel = h.vel ?? 250;
    this.vx = Math.cos(ang) * this.vel; this.vy = Math.sin(ang) * this.vel;
    this.escala = h.escala ?? 1;
    this.radio = h.radio ?? 4;
    this.dano = h.dano * (extra.mult ?? 1);
    this.alcance = h.alCursor ? Math.max(40, Math.min(h.alcance, Math.hypot(dueno.ax - this.x, dueno.ay - this.y))) : h.alcance * (extra.alcanceK ?? 1);
    this.zig = extra.zig;
    this.zigOff = 0;
    this.soltada = false;
    this.edad = 0;
  }

  update(dt) {
    const { h, dueno, luta } = this;
    this.edad += dt;
    // Leech Seed: soltar e apertar o botão de novo faz a semente estourar
    if (h.revienta) {
      const pulsa = dueno.intento?.[this.extra.slot];
      if (!pulsa) this.soltada = true;
      else if (this.soltada && this.recorrido > 10) return this.terminar(true);
    }
    const r = dueno.rival;
    if (h.teledirigido && r && !r.ko) {
      const dist = Math.hypot(r.x - this.x, r.y - this.y);
      const w = h.cerca ? Math.max(h.teledirigido, 1.5 * this.vel / Math.max(20, dist)) : h.teledirigido;
      const objetivo = Math.atan2(r.y - this.y, r.x - this.x), giro = w * dt;
      this.ang += clamp(difAng(objetivo, this.ang), -giro, giro);
      this.vx = Math.cos(this.ang) * this.vel; this.vy = Math.sin(this.ang) * this.vel;
    } else if (this.extra.slot === 'lmb' && r && !r.ko && !r.oculto) {
      // ataque básico encosta um pouco no alvo (ímã)
      const dif = difAng(Math.atan2(r.y - this.y, r.x - this.x), this.ang);
      if (Math.abs(dif) < REGLAS.imanCono) {
        const giro = REGLAS.imanGiro * dt;
        this.ang += clamp(dif, -giro, giro);
        this.vx = Math.cos(this.ang) * this.vel; this.vy = Math.sin(this.ang) * this.vel;
      }
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.recorrido += this.vel * dt;
    // o tiro desce da boca até a altura do peito do alvo nos primeiros 80 px
    this.alt = this.alt0 + (Math.min(this.alt0, 16) - this.alt0) * Math.min(1, this.recorrido / 80);
    if (this.zig != null) {
      const z = h.zigzag, off = Math.sin(this.recorrido * (z.frec ?? 0.09) + this.zig) * (z.amp ?? 9) * Math.min(1, this.recorrido / 24);
      this.x += -Math.sin(this.ang) * (off - this.zigOff); this.y += Math.cos(this.ang) * (off - this.zigOff);
      this.zigOff = off;
    }
    // dois tiros de donos diferentes se anulam; o mais forte (1,3x) sobrevive com dano reduzido
    if (!h.revienta && !h.noChoca) {
      for (const o of luta.entidades) {
        if (o === this || !(o instanceof Proyectil) || o.vivo === false || o.dueno === dueno || o.h.revienta || o.h.noChoca) continue;
        if (Math.hypot(o.x - this.x, o.y - this.y) >= this.radio + o.radio + 3) continue;
        const mx = (this.x + o.x) / 2, my = (this.y + o.y) / 2 - this.alt;
        luta.emit({ t: 'impacto', x: mx, y: my + 4, tipo: 'NORMAL', slot: 'clash' });
        luta.emit({ t: 'texto', x: mx, y: my - 6, txt: 'CLASH', color: '#ffffff', dur: 0.5 });
        luta.emit({ t: 'sonido', n: 'clash' });
        if (this.dano > o.dano * 1.3) { this.dano -= o.dano; o.chocar(); continue; }
        if (o.dano > this.dano * 1.3) { o.dano -= this.dano; this.chocar(); return false; }
        o.chocar(); this.chocar(); return false;
      }
    }
    // acerta o lutador (ou um clone)
    for (const b of luta.blancos(dueno)) {
      if (b.oculto || b.est?.vuelo) continue;
      if (Math.hypot(b.x - this.x, b.y - this.y) >= this.radio + RADIO) continue;
      // quem está invulnerável (dash) deixa o tiro passar, mostrando MISS
      if (h.revienta && !b.esClon) { this.enRival = true; return this.terminar(true); }
      if (!b.esClon && b.invulnerable && !h.revienta) {
        if (!this.errou) { this.errou = true; b.recibir(dueno, { dano: 0, tipo: h.tipo }); }
        continue;
      }
      if (this.errou && !b.esClon) continue;
      return this.terminar(false, b);
    }
    // corta contra a borda da arena
    if (this.recorrido >= this.alcance || fueraCampo(this.x, this.y, 22)) return this.terminar(true);
    return true;
  }

  terminar(explotarSolo, alvo = null) {
    const { h, dueno, luta } = this;
    this.vivo = false;
    const ang = this.ang;
    const g = pacote(h, this.extra, ang, { dano: this.dano, empuje: h.empuje ?? 18, proyectil: true });
    // numa rajada só o primeiro tiro vale como golpe (sem combo, energia ou som repetido)
    const v = this.extra.volea;
    if (v) { if (v.golpe) g.tick = true; else v.golpe = true; }
    if (this.extra.clon) g.tick = true;
    if (alvo) {
      if (h.explosion) this.explotar(h.explosion.radio, g);
      else {
        const res = atingir(dueno, alvo, g);
        if (res === 'golpe') luta.emit({ t: 'impacto', x: this.x, y: this.y - 4, tipo: h.tipo, estilo: this.estilo, slot: this.extra.slot });
      }
    } else if (h.explosion) this.explotar(h.explosion.radio, g);
    if (h.revienta && explotarSolo) { this.reventar(); luta.emit({ t: 'finProyectil', x: this.x, y: this.y, estilo: this.estilo, tipo: h.tipo }); return false; }
    if (h.metralla && alvo) {
      const m = h.metralla;
      for (let i = 0; i < m.n; i++) {
        const a = (i / m.n) * Math.PI * 2 + this.ang;
        luta.add(new Proyectil(luta, dueno, { ...m, tipo: h.tipo, alcance: m.alcance }, a, { desde: { x: this.x, y: this.y, alt: this.alt }, slot: this.extra.slot }));
      }
    }
    luta.emit({ t: 'finProyectil', x: this.x, y: this.y, estilo: this.estilo, tipo: h.tipo });
    return false;
  }

  // a semente estoura em vinhas: prende (raiz total) quem estiver na área; se ninguém, a armadilha fica um instante
  reventar() {
    const { h, dueno, luta, extra } = this;
    const R = h.revienta.radio, x = this.enRival && dueno.rival ? dueno.rival.x : this.x, y = this.enRival && dueno.rival ? dueno.rival.y : this.y;
    const RR = R + RADIO * 0.5;
    const vinhas = { tipo: 'enredadera', x, y, radio: R, t: 0, dur: h.revienta.dura ?? 0.6, vivo: true, update(dt) { this.t += dt; return this.t < this.dur; } };
    luta.add(vinhas);
    luta.emit({ t: 'enredadera', x, y, radio: R });
    const atrapar = () => {
      const r = dueno.rival;
      if (!r || r.ko || r.est.vuelo || r.invulnerable) return false;
      if (((r.x - x) / RR) ** 2 + ((r.y - y) / (RR * 0.65)) ** 2 > 1) return false;
      const res = r.recibir(dueno, { dano: this.dano, tipo: h.tipo, slot: extra.slot, surge: extra.surge, drenaje: h.drenaje, ralentiza: { f: 1, dur: h.revienta.atrapa }, pesado: true });
      if (res === 'golpe') { r.texto('TRAPPED!', '#86efac', { dy: 14 }); vinhas.dur = Math.max(vinhas.dur, h.revienta.atrapa); vinhas.sobre = r; }
      return true;
    };
    if (atrapar()) return;
    let t = 0;
    luta.add({ vivo: true, update: dt => (t += dt) < (h.revienta.dura ?? 0.6) && !atrapar() });
  }

  // some sem dano (choque com outro tiro)
  chocar() {
    if (this.vivo === false) return;
    this.vivo = false;
    this.luta.emit({ t: 'finProyectil', x: this.x, y: this.y, estilo: this.estilo, tipo: this.h.tipo });
  }

  explotar(radio, g) {
    const { dueno, luta } = this;
    luta.emit({ t: 'explosion', x: this.x, y: this.y - 6, radio, tipo: this.h.tipo });
    for (const b of luta.blancos(dueno)) {
      if (b.oculto) continue;
      if (Math.hypot(b.x - this.x, b.y - this.y) < radio + RADIO) atingir(dueno, b, { ...g, dano: this.dano * (this.extra.clon ? 1 : 1) });
    }
  }
}

// ---------------------------------------------------------------- raio (Solar Beam, Hydro Pump...)
export class Chorro {
  constructor(luta, dueno, h, extra) {
    this.luta = luta; this.dueno = dueno; this.h = h; this.extra = extra;
    this.tipo = 'chorro';
    this.t = 0;
    this.carga = h.carga ?? 0.3;
    this.dur = h.dur ?? 1;
    this.ang = Math.atan2(dueno.ay - dueno.y, dueno.ax - dueno.x);
    this.largo = h.largo; this.ancho = h.ancho;
    this.acum = 0; this.tickEn = 0.1;
    this.tipoAtq = h.tipo;
    this.vivo = true;
    dueno.accion = { hasta: luta.t + this.carga + this.dur + 0.05, bloquea: false, lento: 0.35, angulo: this.ang, update: () => { dueno.accion && (dueno.accion.angulo = this.ang); }, fin: () => { this.vivo = false; } };
    dueno.animar(h.anim ?? 'Charge', this.carga + this.dur);
  }
  get activo() { return this.t >= this.carga; }
  boca() {
    const d = this.dueno;
    return { x: d.x + Math.cos(this.ang) * 12, y: d.y + Math.sin(this.ang) * 8 };
  }
  update(dt) {
    const { dueno, h, luta } = this;
    if (dueno.ko || dueno.est.aturdido) return false;
    this.t += dt;
    const objetivo = Math.atan2(dueno.ay - dueno.y, dueno.ax - dueno.x);
    const giro = (h.giro ?? 2) * dt;
    this.ang += clamp(difAng(objetivo, this.ang), -giro, giro);
    if (this.h.amplitud) this.onda = Math.sin(this.t * 14) * h.amplitud;
    if (!this.activo) return true;
    if (h.retroceso || h.retroceso === 0) { /* nome alternativo */ }
    const back = h.retroceso ?? 0;
    if (back) { dueno.empX -= Math.cos(this.ang) * back * dt * 3; dueno.empY -= Math.sin(this.ang) * back * dt * 3; }
    this.acum += dt;
    if (this.acum >= this.tickEn) {
      this.acum -= this.tickEn;
      const b0 = this.boca(), x2 = b0.x + Math.cos(this.ang) * this.largo, y2 = b0.y + Math.sin(this.ang) * this.largo;
      const ticks = this.dur / this.tickEn;
      for (const b of luta.blancos(dueno)) {
        if (b.oculto || b.est?.vuelo) continue;
        if (distSegmento(b.x, b.y - (b.alto ?? 20) * 0.3, b0.x, b0.y - 8, x2, y2 - 8) < this.ancho / 2 + RADIO) {
          const g = pacote(h, this.extra, this.ang, { dano: h.dano / ticks, tick: true, empuje: (h.empuje ?? 0) / ticks, aturde: undefined, pesado: false });
          atingir(dueno, b, g);
          if (b.est && !b.ko && h.empuje) { b.empX += Math.cos(this.ang) * h.empuje * dt * 3; b.empY += Math.sin(this.ang) * h.empuje * dt * 3; }
        }
      }
    }
    return this.t < this.carga + this.dur;
  }
}

// ---------------------------------------------------------------- cone (Flamethrower)
export class Cono {
  constructor(luta, dueno, h, extra) {
    this.luta = luta; this.dueno = dueno; this.h = h; this.extra = extra;
    this.tipo = 'cono';
    this.t = 0; this.acum = 0;
    this.ang = Math.atan2(dueno.ay - dueno.y, dueno.ax - dueno.x);
    this.tipoAtq = h.tipo;
    dueno.accion = { hasta: luta.t + h.dur + 0.05, lento: h.lento ?? 0.5, angulo: this.ang, update: () => { dueno.accion && (dueno.accion.angulo = this.ang); }, fin: () => { this.vivo = false; } };
    dueno.animar(h.anim ?? 'Shoot', h.dur);
  }
  update(dt) {
    const { dueno, h, luta } = this;
    if (dueno.ko || dueno.est.aturdido) return false;
    this.t += dt; this.acum += dt;
    const objetivo = Math.atan2(dueno.ay - dueno.y, dueno.ax - dueno.x), giro = (h.giro ?? 2) * dt;
    this.ang += clamp(difAng(objetivo, this.ang), -giro, giro);
    // anula projéteis inimigos dentro do cone
    if (h.anula) {
      for (const e of luta.entidades) {
        if (e.tipo === 'proj' && e.dueno !== dueno) {
          const d = Math.hypot(e.x - dueno.x, e.y - dueno.y);
          if (d < h.alcance + 10 && Math.abs(difAng(Math.atan2(e.y - dueno.y, e.x - dueno.x), this.ang)) < rad(h.angulo) / 2) { e.vivo = false; luta.emit({ t: 'finProyectil', x: e.x, y: e.y, estilo: 'brasa', tipo: h.tipo }); }
        }
      }
    }
    if (this.acum >= h.tick) {
      this.acum -= h.tick;
      const ticks = h.dur / h.tick;
      for (const b of luta.blancos(dueno)) {
        if (b.oculto || b.est?.vuelo) continue;
        const dx = b.x - dueno.x, dy = b.y - dueno.y, d = Math.hypot(dx, dy);
        if (d < h.alcance + RADIO && Math.abs(difAng(Math.atan2(dy, dx), this.ang)) < rad(h.angulo) / 2 + 0.1) {
          atingir(dueno, b, pacote(h, this.extra, this.ang, { dano: h.dano / ticks, tick: true, empuje: undefined }));
        }
      }
    }
    return this.t < h.dur;
  }
}

// ---------------------------------------------------------------- onda de dano instantânea em área ou cone
export function areaCirculo(luta, dueno, x, y, radio, g) {
  luta.emit({ t: 'area', x, y, radio, tipo: g.tipo });
  let acertou = false;
  for (const b of luta.blancos(dueno)) {
    if (b.oculto) continue;
    if (Math.hypot(b.x - x, b.y - y) < radio + RADIO) {
      const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy) || 1;
      const res = atingir(dueno, b, { ...g, dirX: g.dirX ?? dx / d, dirY: g.dirY ?? dy / d });
      if (res === 'golpe') acertou = true;
    }
  }
  return acertou;
}

// ---------------------------------------------------------------- rochas caindo, ondas de raiz, erupções
export class Marcas {
  // lista de pontos que avisam, esperam e acertam em momentos diferentes
  constructor(luta, dueno, h, extra, puntos, { aviso, cada, radio, estilo, alFinal }) {
    this.luta = luta; this.dueno = dueno; this.h = h; this.extra = extra;
    this.tipo = 'marcas'; this.estilo = estilo; this.tipoAtq = h.tipo;
    this.puntos = puntos.map((p, i) => ({ ...p, t0: i * cada, golpeado: false, ultimo: i === puntos.length - 1 }));
    this.aviso = aviso; this.radio = radio; this.alFinal = alFinal;
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    const { dueno, h, luta } = this;
    let todos = true;
    for (const p of this.puntos) {
      if (p.golpeado) continue;
      todos = false;
      const k = this.t - p.t0;
      if (k >= this.aviso) {
        p.golpeado = true;
        const g = pacote(h, this.extra, 0, { dano: p.dano ?? h.dano, aturde: p.ultimo ? h.aturdeFinal : undefined, empuje: undefined, tick: false });
        areaCirculo(luta, dueno, p.x, p.y, p.radio ?? this.radio, g);
        luta.emit({ t: 'impacto', x: p.x, y: p.y, tipo: h.tipo, estilo: this.estilo, suelo: true });
      }
    }
    if (todos) { this.vivo = false; return false; }
    return true;
  }
}

// ---------------------------------------------------------------- fumaça (Smokescreen)
export class Humo {
  constructor(luta, dueno, h) {
    this.luta = luta; this.dueno = dueno; this.tipo = 'humo';
    this.x = dueno.x; this.y = dueno.y; this.radio = h.radio; this.frena = h.frena ?? 0.35; this.emboscada = h.emboscada ?? 1.3;
    this.dur = h.dur; this.t = 0;
  }
  update(dt) {
    this.t += dt;
    const d = this.dueno;
    if (!d.ko && Math.hypot(d.x - this.x, d.y - this.y) < this.radio) d.ponerEstado('emboscada', 0.5, { f: this.emboscada });
    return this.t < this.dur;
  }
}

// ---------------------------------------------------------------- poça de veneno
export class Charco {
  constructor(luta, dueno, x, y, h) {
    this.luta = luta; this.dueno = dueno; this.tipo = 'charco';
    this.x = x; this.y = y; this.radio = h.charco.radio; this.dur = h.charco.dur; this.t = 0; this.veneno = h.veneno; this.tipoAtq = h.tipo;
  }
  update(dt) {
    this.t += dt;
    for (const b of this.luta.blancos(this.dueno)) {
      if (b.esClon || b.est?.vuelo) continue;
      if (Math.hypot(b.x - this.x, b.y - this.y) < this.radio + RADIO && this.veneno) b.ponerEstado('veneno', this.veneno.dur, { dps: this.veneno.dps, fuente: this.dueno });
    }
    return this.t < this.dur;
  }
}

// ---------------------------------------------------------------- clone (Double Team)
export class Clon {
  constructor(luta, dueno, desvio, dur, mult) {
    this.luta = luta; this.dueno = dueno; this.esClon = true; this.tipo = 'clon';
    this.desvio = desvio; this.dur = dur; this.t = 0; this.mult = mult; this.ko = false;
    this.x = dueno.x; this.y = dueno.y; this.alto = dueno.alto; this.est = {}; this.oculto = false;
    this.escala = dueno.escala;
  }
  romper() {
    if (this.ko) return;
    this.ko = true;
    this.luta.emit({ t: 'explosion', x: this.x, y: this.y - 10, radio: 20, tipo: 'NORMAL', humo: true });
    this.luta.emit({ t: 'texto', x: this.x, y: this.y - this.alto - 4, txt: 'DECOY!', color: '#c8c8d0' });
  }
  recibir(fuente, g) { if (g.tick) return 'miss'; this.romper(); return 'golpe'; }
  update(dt) {
    this.t += dt;
    const d = this.dueno;
    if (this.ko || d.ko) return false;
    const a = d.angulo + Math.PI / 2;
    const p = fijarCampo(d.x + Math.cos(a) * this.desvio, d.y + Math.sin(a) * this.desvio * 0.6);
    this.x += (p.x - this.x) * Math.min(1, dt * 10);
    this.y += (p.y - this.y) * Math.min(1, dt * 10);
    return this.t < this.dur;
  }
}
