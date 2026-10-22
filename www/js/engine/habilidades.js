// As 25 formas de skill do PK confront. Cada Pokémon só escolhe uma forma e entrega os números.
// usar(l, slot) faz as checagens comuns (recarga, energia, ultimate, calor) e chama a forma.
import { RADIO } from '../config.js';
import { REGLAS } from '../data/regras.js';
import { aleatorio, entre, difAng, clamp, dist } from './util.js';
import { fijarCampo, fueraCampo } from './fisica.js';
import { Proyectil, Chorro, Cono, Marcas, Humo, Charco, Clon, areaCirculo, pacote, atingir } from './entidades.js';
import { etapaDe, umbralesExp, tipoLinea } from './lutador.js';

const rad = g => (g * Math.PI) / 180;
const angApunte = l => Math.atan2(l.ay - l.y, l.ax - l.x);

// ajuda a mirar: se o alvo está perto da direção apontada, corrige para ele
function asistir(l, ang, alcance, cono = 0.9) {
  const r = l.rival;
  if (!r || r.ko || r.oculto) return ang;
  const dx = r.x - l.x, dy = r.y - l.y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  return d < alcance && Math.abs(difAng(a, ang)) < cono ? a : ang;
}

export class Habilidades {
  constructor(luta) {
    this.luta = luta;
    this.formas = {
      proyectil: this.proyectil, crecimiento: this.crecimiento, dash: this.dash, chorro: this.chorro, helice: this.chorro,
      tajo: this.tajo, golpe: this.golpe, cono: this.cono, pulso: this.pulso, burbujas: this.burbujas, caparazon: this.caparazon,
      viento: this.viento, lluvia: this.lluvia, vuelo: this.vuelo, erupcion: this.erupcion, patada: this.patada, descanso: this.descanso,
      meteoro: this.meteoro, rafaga: this.rafaga, clones: this.clones, humo: this.humo, embestidas: this.embestidas,
      bombaLodo: this.bombaLodo, plantaFeroz: this.plantaFeroz, arraigo: this.arraigo,
    };
  }

  // ---------------------------------------------------------------- uso de um espaço
  usar(l, slot) {
    const h = l.kit[slot];
    const luta = this.luta;
    if (!h || l.cd[slot] > 0 || l.est.aturdido || l.est.dormido) return false;
    if (l.accion?.bloquea) return false;
    // voando (Fly) ou debaixo da terra (Dig) só dá para sair da esquiva: nenhuma skill sai
    if (l.est.vuelo) return false;
    const t = luta.t;
    if (slot === 'lmb' && t < l.sobrecargaHasta) return false;
    if (slot === 'esp' && l.est.sinDash) { if (l.humano) l.avisar('sinDash', () => l.texto('NO DASH', '#fde68a')); return false; }
    // enquanto faz outra ação longa (raio, cone...), não começa outra
    if (l.accion && !h.interrompe && slot !== 'esp') return false;
    if (slot === 'e' && !l.ultiLista) {
      if (l.humano) l.avisar('ulti', () => l.texto(`ULT ${Math.floor(l.ulti)}%`, '#9aa0b4'));
      return false;
    }
    const coste = slot === 'e' ? 0 : h.coste ?? 0;
    if (l.energia < coste) {
      if (l.humano) l.avisar('energia', () => { l.texto('NO ENERGY', '#9aa0b4'); luta.emit({ t: 'sonido', n: 'miss' }); }, 1);
      return false;
    }
    const surge = slot !== 'e' && coste > 0 && l.energia >= REGLAS.surgeUmbral;
    const forma = this.formas[h.forma ?? 'proyectil'];
    if (!forma) return false;
    const accionAntes = l.accion;
    if (forma.call(this, l, h, { slot, surge }) === false) return false;
    if (l.accion && l.accion !== accionAntes) { l.accion.h = h; l.accion.slot = slot; }
    l.energia -= coste;
    if (slot === 'e') l.ulti = 0;
    l.cd[slot] = h.cd;
    l.ultimoAtaque = t;
    l.stats.usos++;
    if (slot !== 'lmb') l.tejido = t;
    if (surge) { l.texto('SURGE +30%', '#ffb347', { dy: 18 }); luta.emit({ t: 'sonido', n: 'surge' }); }
    if (slot === 'lmb') {
      l.ultimoBasico = t;
      l.calor += (h.calor ?? 0) * (l.est.potencia?.calor ?? 1);
      if (l.calor >= REGLAS.calorMax) {
        l.sobrecargaHasta = t + REGLAS.sobrecargaDur;
        l.texto('OVERLOAD!', '#ff5a2a');
        luta.emit({ t: 'sobrecarga', l });
      }
    }
    luta.emit({ t: 'habilidad', l, slot, h, surge });
    return true;
  }

  // ---------------------------------------------------------------- evolução e Mega
  // A troca de forma é aplicada na hora (o motor já luta com a forma nova); o desenho mostra a forma
  // antiga brilhando até a metade da cena (evoVis) e só então revela a nova, com o anúncio.
  iniciarEvo(l, mega, texto, cor) {
    const luta = this.luta, dur = REGLAS.evoDuracion ?? 1.8;
    l.evoVis = { t0: luta.t, dur, mega, desde: l.dex, escDesde: l.escala };
    l.ponerEstado('invul', dur);
    l.accion = { hasta: luta.t + dur, bloquea: true, lento: 0 };
    l.vx = 0; l.vy = 0;
    luta.hitstop(mega ? 260 : 200);
    luta.emit({ t: 'evoInicio', l, mega });
    luta.programar(dur * 0.55, () => {
      luta.emit({ t: 'evolucion', l, mega });
      luta.emit({ t: 'anuncio', txt: texto, color: cor, tam: 24, dur: 1, quien: l.lado });
    });
  }

  evolucionar(l) {
    const luta = this.luta;
    const gasto = l.expNecesaria;
    l.exp = Math.max(0, l.exp - gasto);
    const fracVida = l.hp / l.hpMax;
    const antes = { dex: l.dex, esc: l.escala, nombre: l.nombre };
    // mesma forma na etapa seguinte = "power up" (Steelix, Snorlax, Lopunny e Lucario no site)
    const potenciar = etapaDe(l.def, l.etapa + 1).dex === l.forma.dex;
    l.etapa++;
    l.kit = l.kitActual();
    // cura uma parte da vida que faltava (60% nas linhas comuns)
    const k = REGLAS.curaPerdida?.[potenciar && tipoLinea(l.def) !== 'LEG' ? 'PU' : tipoLinea(l.def)];
    l.hp = k != null ? fracVida * l.hpMax + k * (1 - fracVida) * l.hpMax : Math.min(l.hpMax, fracVida * l.hpMax + REGLAS.curaEvolucion * l.hpMax);
    const curado = Math.round(100 * (l.hp / l.hpMax - fracVida));
    l.texto(potenciar ? `${antes.nombre} IS POWERING UP!` : `WHAT? ${antes.nombre} IS EVOLVING!`, '#ffffff', { dy: 4 });
    luta.programar(1.2, () => { if (!l.ko && curado > 0) l.texto(`+${curado}% HP`, '#3ccf4e'); });
    this.iniciarEvo(l, false, potenciar ? 'POWER UP!' : `${l.nombre}!`, potenciar ? '#fde047' : '#7dd3fc');
    l.evoVis.desde = antes.dex; l.evoVis.escDesde = antes.esc;
  }

  megaevolucionar(l) {
    const antes = { dex: l.dex, esc: l.escala };
    l.ulti = 0;
    l.mega = true;
    l.kit = l.kitActual();
    this.iniciarEvo(l, true, 'MEGA EVOLUTION!', '#ffe27a');
    l.evoVis.desde = antes.dex; l.evoVis.escDesde = antes.esc;
    this.luta.emit({ t: 'megaInicio', l });
  }

  // ---------------------------------------------------------------- proyétil
  proyectil(l, h, extra) {
    const luta = this.luta;
    let ang = asistir(l, angApunte(l), h.alcance + 40, 0.7);
    const lanzar = h.lanzar ?? 0.15;
    l.animar(h.anim ?? 'Shoot', lanzar + 0.22);
    l.accion = { hasta: luta.t + lanzar + (h.rafaga ? (h.rafaga - 1) * (h.cadaRafaga ?? 0.06) : 0) + 0.05, angulo: ang, lento: 0.6 };
    let n = h.rafaga ?? 1;
    // Protean (Froakie): usar uma skill e atacar em seguida solta bolhas extras
    if (extra.slot === 'lmb' && h.tejido && luta.t - l.tejido < (h.tejidoDur ?? 3)) { n += h.tejido; l.tejido = -99; l.texto('PROTEAN!', '#93c5fd'); }
    if (n > 1) l.accion.hasta = luta.t + lanzar + (n - 1) * (h.cadaRafaga ?? 0.06) + 0.05;
    const volea = h.doble || h.zigzag || n > 1 ? { golpe: false } : null;
    for (let i = 0; i < n; i++) {
      luta.programar(lanzar + i * (h.cadaRafaga ?? 0.06), () => {
        if (l.ko || l.est.aturdido) return;
        // leque fixo: o primeiro vai reto, os outros alternam para os lados
        const abre = i ? (i % 2 ? 1 : -1) * (h.abanico ?? 0.06) * Math.ceil(i / 2) : 0;
        const a2 = asistir(l, angApunte(l), h.alcance + 40, 0.7) + abre;
        const lanzarUno = (desde, mult = 1, esClon = false) => {
          const lados = h.doble ? [-1, 1] : [0];
          for (const lado of lados) {
            const off = lado * (h.doble ?? 0) * 0.5;
            const pos = desde ?? { x: l.x, y: l.y, alt: l.alto * 0.55 };
            const origen = { x: pos.x + Math.cos(a2) * 10 - Math.sin(a2) * off, y: pos.y + Math.sin(a2) * 6 + Math.cos(a2) * off, alt: l.alto * 0.55 };
            luta.add(new Proyectil(luta, l, h, a2, { ...extra, mult: (extra.mult ?? 1) * mult, desde: origen, zig: h.zigzag ? aleatorio() * 6 : undefined, clon: esClon, volea: esClon ? null : volea }));
          }
        };
        lanzarUno();
        if (l.clones && (extra.slot === 'lmb' || extra.slot === 'e')) for (const c of l.clones) lanzarUno({ x: c.x, y: c.y, alt: l.alto * 0.55 }, h.clonMult ?? c.mult, true);
        luta.emit({ t: 'disparo', l, h, ang: a2 });
      });
    }
  }

  // ---------------------------------------------------------------- Growth (segurar para carregar)
  // Enquanto o botão estiver apertado o lutador carrega: ganha energia e ultimate por segundo e sobe de nível
  // (1 a 3). Ao soltar, ganha força por h.potenciaDur. Levar dano ou ser atordoado corta a carga.
  crecimiento(l, h, extra) {
    const luta = this.luta;
    let t = 0, nivel = 0, cortado = false;
    l.animar(h.anim ?? 'Charge', h.max ?? 3);
    l.canal = { forma: 'crecimiento', nivel: 0, t: 0 };
    l.accion = {
      hasta: luta.t + (h.max ?? 3), bloquea: true, lento: h.lento ?? 0.15, angulo: l.angulo,
      update: dt => {
        t += dt;
        const suelta = t > (h.minimo ?? 0.25) && !l.intento?.[extra.slot];
        if (luta.t < l.dolorHasta || l.est.aturdido) cortado = true;
        if (suelta || cortado) { l.accion.hasta = luta.t; return; }
        l.ganarEnergia((h.energia ?? 0) * dt);
        l.ganarUlti((h.ulti ?? 0) * dt);
        const n = Math.min(3, 1 + Math.floor((t / (h.max ?? 3)) * 3));
        if (n !== nivel) {
          if (nivel) { luta.emit({ t: 'anillo', x: l.x, y: l.y - l.alto * 0.5, color: '#fde047', r: 12 + n * 6 }); luta.emit({ t: 'sonido', n: 'seleccion' }); }
          nivel = n;
        }
        l.canal = { forma: 'crecimiento', nivel, t };
      },
      fin: () => {
        l.canal = null;
        l.anim = null;
        if (l.ko || cortado || !nivel || !h.potencia) return;
        luta.emit({ t: 'anillo', x: l.x, y: l.y - l.alto * 0.5, color: '#fde047', r: 12 + nivel * 6 });
        l.texto(nivel >= 3 ? 'FULL! ATK UP' : 'ATK UP', '#fde047');
        luta.emit({ t: 'sonido', n: 'cura' });
        l.ponerEstado('potencia', h.potenciaDur ?? 5, { n: nivel, mult: h.potencia * nivel, cadencia: 1, vel: 0, reduce: 0, color: '#fde047' });
      },
    };
  }

  // ---------------------------------------------------------------- dash
  dash(l, h, extra) {
    const luta = this.luta;
    const moviendo = extra?.slot === 'esp' && Math.hypot(l.vx, l.vy) > 5;
    let ang = moviendo ? Math.atan2(l.vy, l.vx) : extra?.slot !== 'esp' && h.dano ? asistir(l, angApunte(l), h.dist + 30, 0.7) : angApunte(l);
    if (h.alPunto) {
      const dx = l.ax - l.x, dy = l.ay - l.y, d = Math.hypot(dx, dy);
      if (d > 1) ang = Math.atan2(dy, dx);
      h = { ...h, dist: Math.max(h.distMin ?? 24, Math.min(h.dist, d)) };
    }
    l.empezarDash(h, ang);
    l.dash.slot = extra?.slot;
    l.accion = null;
    l.animar(h.anim ?? 'Walk', h.dur + 0.1);
    if (h.blindaje) l.ponerEstado('blindaje', h.dur + 0.25, { reduce: h.blindaje });
    if (h.acelera) { l.ponerEstado('rapido', h.dur + h.acelera.dur, { vel: h.acelera.vel }); l.texto('SPEED UP', '#7dd3fc'); }
    luta.emit({ t: 'sonido', n: 'dash' });
  }

  // ---------------------------------------------------------------- raio
  chorro(l, h, extra) {
    const luta = this.luta;
    const c = new Chorro(luta, l, h, extra);
    luta.add(c);
    luta.emit({ t: 'cargando', l, h });
  }

  // ---------------------------------------------------------------- cone (Flamethrower)
  cono(l, h, extra) {
    this.luta.add(new Cono(this.luta, l, h, extra));
    this.luta.emit({ t: 'sonido', n: 'disparo' });
  }

  // Supersonic: sopro instantâneo em cone
  viento(l, h, extra) {
    const luta = this.luta;
    const ang = asistir(l, angApunte(l), h.alcance + 30, 1);
    l.animar(h.anim ?? 'Charge', (h.carga ?? 0.15) + 0.3);
    l.accion = { hasta: luta.t + (h.carga ?? 0.15) + 0.1, angulo: ang, lento: 0.3 };
    luta.programar(h.carga ?? 0.15, () => {
      if (l.ko) return;
      luta.emit({ t: 'viento', x: l.x, y: l.y - l.alto * 0.4, ang, alcance: h.alcance, angulo: h.angulo, estilo: h.estilo, tipo: h.tipo });
      for (const b of luta.blancos(l)) {
        const dx = b.x - l.x, dy = b.y - l.y;
        if (Math.hypot(dx, dy) < h.alcance + RADIO && Math.abs(difAng(Math.atan2(dy, dx), ang)) < rad(h.angulo) / 2) atingir(l, b, pacote(h, extra, ang, { pesado: true }));
      }
    });
  }

  // ---------------------------------------------------------------- melee em arco
  tajo(l, h, extra) {
    const luta = this.luta;
    const lanzar = h.lanzar ?? 0.12, n = h.golpes ?? 1, entre2 = h.entre ?? 0.1;
    let ang = asistir(l, angApunte(l), h.alcance + 45);
    l.pasoCombo = luta.t - l.ultimoTajo < 1 ? (l.pasoCombo + 1) % (h.combo ?? 1) : 0;
    l.ultimoTajo = luta.t;
    const paso = l.pasoCombo, cierra = h.combo ? paso === h.combo - 1 : false;
    if (paso === 0) l.aciertosCombo = 0;
    const remate = cierra && h.remate && l.aciertosCombo >= paso ? h.remate : null;
    l.animar(cierra ? h.animFinal ?? 'Strike' : h.anim ?? 'Attack', lanzar + 0.2);
    l.accion = { hasta: luta.t + lanzar + (n - 1) * entre2 + 0.08, angulo: ang, lento: 0.6 };
    const r0 = l.rival;
    const d0 = r0 && !r0.ko ? Math.hypot(r0.x - l.x, r0.y - l.y) : 999;
    const avance = d0 < h.alcance + 45 ? Math.min(30, Math.max(0, d0 - 20)) : h.avance ?? 0;
    l.empX += Math.cos(ang) * avance * 6; l.empY += Math.sin(ang) * avance * 6;
    for (let i = 0; i < n; i++) {
      luta.programar(lanzar + i * entre2, () => {
        if (l.ko || l.est.aturdido) return;
        const final = cierra && i === n - 1;
        const alcance = h.alcance + (final ? 8 : 0);
        ang = asistir(l, ang, alcance + RADIO + 12, 1.6);
        l.angulo = ang;
        luta.emit({ t: 'tajo', l, ang, alcance, final, estilo: h.estilo, tipo: h.tipo, anguloArco: h.angulo });
        this.cortarProyectiles(l, ang, alcance, rad(h.angulo) / 2);
        for (const b of luta.blancos(l)) {
          const dx = b.x - l.x, dy = b.y - l.y, d = Math.hypot(dx, dy) || 1;
          if (b.oculto || b.est?.vuelo) continue;
          if (d < alcance + RADIO && Math.abs(difAng(Math.atan2(dy, dx), ang)) < rad(h.angulo) / 2) {
            const rem = final ? remate : null;
            const res = atingir(l, b, pacote(h, extra, ang, { dano: h.dano + (final ? 2 : 0) + (rem?.dano ?? 0), empuje: rem?.empuje ?? (final ? 70 : 22), aturde: rem?.aturde, dirX: dx / d, dirY: dy / d, pesado: final }));
            if (res === 'golpe' && i === 0 && !cierra) l.aciertosCombo++;
            if (rem && res === 'golpe') { l.texto('CRUSHED!', '#e5e7eb'); luta.emit({ t: 'temblor', f: 0.006 }); }
          }
        }
      });
    }
  }

  // golpe corpo a corpo corta projéteis que passam no arco
  cortarProyectiles(l, ang, alcance, mitad) {
    for (const e of this.luta.entidades) {
      if (e.tipo !== 'proj' || e.dueno === l) continue;
      const dx = e.x - l.x, dy = e.y - l.y;
      if (Math.hypot(dx, dy) < alcance && Math.abs(difAng(Math.atan2(dy, dx), ang)) < mitad) {
        e.vivo = false;
        this.luta.emit({ t: 'finProyectil', x: e.x, y: e.y, estilo: e.estilo, tipo: e.tipoAtq });
        this.luta.emit({ t: 'texto', x: e.x, y: e.y - 14, txt: 'CUT', color: '#e5e7eb' });
      }
    }
  }

  // ---------------------------------------------------------------- golpe único com investida
  golpe(l, h, extra) {
    const luta = this.luta;
    const lanzar = h.lanzar ?? 0.12;
    const ang = asistir(l, angApunte(l), h.alcance + (h.embestida ?? 0) + 40, 1.1);
    l.animar(h.anim ?? 'Attack', lanzar + 0.3);
    l.accion = { hasta: luta.t + lanzar + 0.2, angulo: ang, lento: 0.35 };
    if (h.blindaje) l.ponerEstado('blindaje', lanzar + 0.3, { reduce: h.blindaje });
    luta.programar(lanzar, () => {
      if (l.ko || l.est.aturdido) return;
      l.empX += Math.cos(ang) * (h.embestida ?? 0) * 6; l.empY += Math.sin(ang) * (h.embestida ?? 0) * 6;
      luta.emit({ t: 'tajo', l, ang, alcance: h.alcance, final: true, estilo: h.estilo ?? 'golpe', tipo: h.tipo, anguloArco: h.angulo });
      const k = h.desesperado ? 1 + h.desesperado * (1 - l.hp / l.hpMax) : 1;
      for (const b of luta.blancos(l)) {
        const dx = b.x - l.x, dy = b.y - l.y, d = Math.hypot(dx, dy) || 1;
        const cerca = d < h.alcance + (h.embestida ?? 0) * 0.5 + RADIO + 6 && Math.abs(difAng(Math.atan2(dy, dx), ang)) < rad(h.angulo) / 2 + 0.2;
        const onda = h.onda && d < h.onda + RADIO;
        if (cerca || onda) {
          atingir(l, b, pacote(h, extra, ang, { dano: h.dano * k, empuje: h.empuje ?? (h.lanza ? 90 : 40), dirX: dx / d, dirY: dy / d, pesado: true }));
        }
      }
    });
  }

  // ---------------------------------------------------------------- rajada (Close Combat)
  rafaga(l, h, extra) {
    const luta = this.luta;
    const ang = asistir(l, angApunte(l), h.alcance + 40, 1.1);
    l.animar(h.anim ?? 'Double', h.dur + 0.2);
    l.accion = { hasta: luta.t + h.dur + 0.05, angulo: ang, lento: 0.5 };
    const k = h.dur / h.golpes;
    for (let i = 0; i < h.golpes; i++) {
      luta.programar(0.05 + i * k, () => {
        if (l.ko || l.est.aturdido) return;
        const ultimo = i === h.golpes - 1;
        const a2 = asistir(l, ang, h.alcance + RADIO + 12, 1.6);
        luta.emit({ t: 'tajo', l, ang: a2, alcance: h.alcance, final: ultimo, estilo: 'rafaga', tipo: h.tipo, anguloArco: h.angulo, flurry: true });
        for (const b of luta.blancos(l)) {
          const dx = b.x - l.x, dy = b.y - l.y, d = Math.hypot(dx, dy) || 1;
          if (d < h.alcance + RADIO && Math.abs(difAng(Math.atan2(dy, dx), a2)) < rad(h.angulo) / 2) {
            atingir(l, b, pacote(h, extra, a2, { dano: h.dano / h.golpes, tick: !ultimo, empuje: ultimo ? 60 : 8, dirX: dx / d, dirY: dy / d, aturde: undefined, pesado: ultimo }));
          }
        }
      });
    }
    if (h.defBaja) luta.programar(h.dur, () => { l.ponerEstado('defBaja', h.defBaja); l.texto('DEF DOWN', '#f9a8d4'); });
  }

  // ---------------------------------------------------------------- pulso em volta de quem usa
  pulso(l, h, extra) {
    const luta = this.luta;
    l.animar(h.anim ?? 'Swing', (h.carga ?? 0.2) + 0.35);
    l.accion = { hasta: luta.t + (h.carga ?? 0.2) + 0.05, lento: 0.2 };
    if (h.bloqueo) l.ponerEstado('bloqueo', (h.carga ?? 0.2) + h.bloqueo);
    luta.emit({ t: 'cargaArea', x: l.x, y: l.y, radio: h.radio, tipo: h.tipo, dur: h.carga ?? 0.2 });
    luta.programar(h.carga ?? 0.2, () => {
      if (l.ko) return;
      areaCirculo(luta, l, l.x, l.y, h.radio, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, pesado: true }));
      luta.emit({ t: 'pulso', x: l.x, y: l.y, radio: h.radio, tipo: h.tipo, estilo: h.estilo });
      luta.emit({ t: 'temblor', f: 0.008 });
      for (const e of luta.entidades) if (h.bloqueo && e.tipo === 'proj' && e.dueno !== l && dist(e, l) < h.radio + 14) { e.vivo = false; luta.emit({ t: 'finProyectil', x: e.x, y: e.y, estilo: e.estilo, tipo: e.tipoAtq }); }
    });
  }

  // ---------------------------------------------------------------- bolhas contínuas
  burbujas(l, h, extra) {
    const luta = this.luta;
    l.animar(h.anim ?? 'Shoot', h.dur + 0.2);
    const estado = { ang: angApunte(l) };
    l.accion = { hasta: luta.t + h.dur + 0.05, lento: 0.5, angulo: estado.ang, update: () => { if (l.accion) l.accion.angulo = estado.ang; } };
    const n = Math.floor(h.dur / h.cada);
    for (let i = 0; i < n; i++) {
      luta.programar(0.1 + i * h.cada, () => {
        if (l.ko || l.est.aturdido) return;
        const objetivo = Math.atan2(l.ay - l.y, l.ax - l.x);
        const giro = (h.giro ?? 2) * h.cada;
        estado.ang += clamp(difAng(objetivo, estado.ang), -giro, giro);
        const a2 = estado.ang + (aleatorio() - 0.5) * 2 * (h.abanico ?? 0.1);
        const lados = h.doble ? [-1, 1] : [0];
        for (const lado of lados) {
          const off = lado * (h.doble ?? 0) * 0.5;
          luta.add(new Proyectil(luta, l, { ...h, estilo: 'burbuja', dano: h.dano / n / (lados.length > 1 ? 1 : 1) }, a2, { ...extra, desde: { x: l.x + Math.cos(a2) * 10 - Math.sin(a2) * off, y: l.y + Math.sin(a2) * 6 + Math.cos(a2) * off, alt: l.alto * 0.5 }, mult: 1 }));
        }
      });
    }
  }

  // ---------------------------------------------------------------- casco girando (Hydro Typhoon)
  caparazon(l, h, extra) {
    const luta = this.luta;
    l.animar(h.anim ?? 'Withdraw', h.dur + 0.1);
    l.ponerEstado('blindaje', h.dur, { reduce: h.reduce ?? 0.5 });
    l.ponerEstado('caparazon', h.dur, { rapidez: h.rapidez ?? 1.3 });
    l.accion = { hasta: luta.t + h.dur, lento: 1, angulo: undefined };
    let acum = 0, giro = 0;
    luta.add({
      tipo: 'caparazon', dueno: l, h, tipoAtq: h.tipo, t: 0,
      get ang() { return giro; },
      update: dt => {
        if (l.ko || l.est.aturdido) { delete l.est.caparazon; delete l.est.blindaje; return false; }
        this.luta; giro += (h.giro ?? 5) * dt; acum += dt;
        if (acum >= (h.cadencia ?? 0.4)) {
          acum = 0;
          const r = l.rival;
          if (r && !r.ko && !r.est.vuelo && dist(r, l) < h.alcance + RADIO) {
            const dx = r.x - l.x, dy = r.y - l.y, d = Math.hypot(dx, dy) || 1;
            atingir(l, r, pacote(h, extra, 0, { dano: h.dano, tick: true, empuje: h.empuje ?? 20, dirX: dx / d, dirY: dy / d, slot: 'q' }));
          }
        }
        return luta.t < l.est.caparazon?.hasta;
      },
    });
  }

  // ---------------------------------------------------------------- pedras caindo (Rock Slide)
  lluvia(l, h, extra) {
    const luta = this.luta;
    l.animar(h.anim ?? 'Charge', 0.5);
    l.accion = { hasta: luta.t + 0.4, lento: 0.3 };
    const r = l.rival;
    let cx, cy;
    if (r && !r.ko && dist(r, l) <= h.alcance + 80) { cx = r.x; cy = r.y; }
    else { const d = Math.min(h.alcance, Math.hypot(l.ax - l.x, l.ay - l.y)); const a = angApunte(l); cx = l.x + Math.cos(a) * d; cy = l.y + Math.sin(a) * d; }
    const puntos = [];
    for (let i = 0; i < h.n; i++) {
      const a = aleatorio() * Math.PI * 2, rr = Math.sqrt(aleatorio()) * h.area;
      const p = fijarCampo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7);
      puntos.push({ x: p.x, y: p.y, dano: h.dano });
    }
    luta.add(new Marcas(luta, l, h, extra, puntos, { aviso: h.aviso, cada: h.cada, radio: h.radio, estilo: h.estilo ?? 'roca' }));
    luta.emit({ t: 'avisos', puntos, aviso: h.aviso, radio: h.radio, tipo: h.tipo });
  }

  // ---------------------------------------------------------------- erupções em linha (Stone Edge)
  erupcion(l, h, extra) {
    const luta = this.luta;
    l.animar(h.anim ?? 'Charge', 0.5);
    let ang = angApunte(l);
    l.accion = { hasta: luta.t + 0.35, lento: 0.3, angulo: ang };
    const r = l.rival;
    const puntos = [];
    let x = l.x, y = l.y;
    for (let i = 0; i < h.golpes; i++) {
      if (r && !r.ko && h.persigue) {
        const objetivo = Math.atan2(r.y - y, r.x - x);
        ang += clamp(difAng(objetivo, ang), -h.persigue, h.persigue);
      }
      x += Math.cos(ang) * h.paso; y += Math.sin(ang) * h.paso * 0.9;
      const p = fijarCampo(x, y);
      puntos.push({ x: p.x, y: p.y, dano: h.dano });
    }
    luta.add(new Marcas(luta, l, h, extra, puntos, { aviso: 0.3, cada: h.cada, radio: h.radio, estilo: 'erupcion' }));
    luta.emit({ t: 'avisos', puntos, aviso: 0.3, radio: h.radio, tipo: h.tipo });
  }

  // ---------------------------------------------------------------- raízes em ondas (Frenzy Plant)
  plantaFeroz(l, h, extra) {
    const luta = this.luta;
    const ang = asistir(l, angApunte(l), 140, 1.2);
    l.animar(h.anim ?? 'Charge', 0.9);
    l.accion = { hasta: luta.t + (h.carga ?? 0.3) + h.ondas.length * h.cada, lento: 0.2, angulo: ang };
    if (h.escudo) { l.escudo = h.escudo; l.ponerEstado('escudo', h.escudoDur ?? 4); }
    h.ondas.forEach((dd, i) => {
      luta.programar((h.carga ?? 0.3) + i * h.cada, () => {
        if (l.ko) return;
        const ultimo = i === h.ondas.length - 1;
        luta.emit({ t: 'raices', x: l.x, y: l.y, ang, dist: dd, banda: h.banda });
        for (const b of luta.blancos(l)) {
          const dx = b.x - l.x, dy = b.y - l.y, d = Math.hypot(dx, dy);
          // as raízes saem em volta do lutador, em todas as direções
          if (Math.abs(d - dd) < h.banda / 2 + RADIO) {
            atingir(l, b, pacote(h, extra, ang, { dano: h.dano / h.ondas.length, aturde: ultimo ? h.aturde : undefined, empuje: undefined, tick: !ultimo }));
          }
        }
      });
    });
  }

  // ---------------------------------------------------------------- enraizar (Ingrain)
  arraigo(l, h) {
    const luta = this.luta;
    l.animar(h.anim ?? 'Charge', 0.5);
    l.ponerEstado('arraigo', h.dur, { reduce: h.reduce, cura: h.cura, desde: luta.t });
    l.accion = { hasta: luta.t + 0.3, lento: 0 };
    luta.emit({ t: 'raizarse', l, dur: h.dur });
  }

  // ---------------------------------------------------------------- bomba lançada (Sludge Bomb)
  bombaLodo(l, h, extra) {
    const luta = this.luta;
    const lanzar = h.lanzar ?? 0.18;
    l.animar(h.anim ?? 'Shoot', lanzar + 0.25);
    const ang = angApunte(l);
    l.accion = { hasta: luta.t + lanzar + 0.05, angulo: ang, lento: 0.4 };
    luta.programar(lanzar, () => {
      if (l.ko) return;
      const r = l.rival;
      let tx, ty;
      if (r && !r.ko && dist(r, l) <= h.alcance + 40) { tx = r.x + r.vx * h.vuelo * 0.6; ty = r.y + r.vy * h.vuelo * 0.6; }
      else { const d = Math.min(h.alcance, Math.hypot(l.ax - l.x, l.ay - l.y)); tx = l.x + Math.cos(ang) * d; ty = l.y + Math.sin(ang) * d; }
      const p = fijarCampo(tx, ty);
      const x0 = l.x, y0 = l.y;
      let t = 0;
      const bomba = {
        tipo: 'bomba', dueno: l, estilo: 'lodo', tipoAtq: h.tipo, x: x0, y: y0, alt: 0, h, objetivo: p, vivo: true,
        update: dt => {
          t += dt;
          const k = Math.min(1, t / h.vuelo);
          bomba.x = x0 + (p.x - x0) * k; bomba.y = y0 + (p.y - y0) * k;
          bomba.alt = Math.sin(k * Math.PI) * h.alto + l.alto * 0.5 * (1 - k);
          if (k >= 1) {
            areaCirculo(luta, l, p.x, p.y, h.radio, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, pesado: false, empuje: 20 }));
            luta.add(new Charco(luta, l, p.x, p.y, h));
            luta.emit({ t: 'explosion', x: p.x, y: p.y - 6, radio: h.radio, tipo: h.tipo });
            return false;
          }
          return true;
        },
      };
      luta.add(bomba);
    });
  }

  // ---------------------------------------------------------------- salto alto e queda (Bounce, Heavy Slam, Pancake)
  meteoro(l, h, extra) {
    const luta = this.luta;
    const subida = 0.3, bajada = 0.14;
    l.animar(h.anim ?? 'Hop', subida + h.aviso + bajada);
    l.ponerEstado('vuelo', subida + h.aviso + bajada + 0.05, { oculto: false, rapidez: 0 });
    l.accion = { hasta: luta.t + subida + h.aviso + bajada, bloquea: true, lento: 0, angulo: l.angulo };
    let t = 0;
    const ent = {
      tipo: 'meteoro', dueno: l, h, tipoAtq: h.tipo, vivo: true, x: l.x, y: l.y, radio: h.radio, fase: 'sube', k: 0,
      update: dt => {
        if (l.ko) { l.salto = 0; return false; }
        t += dt;
        const r = l.rival;
        if (t < subida) { l.salto = Math.round(h.alto * Math.sin((t / subida) * Math.PI / 2)); ent.fase = 'sube'; ent.k = t / subida; }
        else if (t < subida + h.aviso) {
          ent.fase = 'apunta'; ent.k = (t - subida) / h.aviso; l.salto = h.alto;
          if (r && !r.ko) {
            const dx = r.x - l.x, dy = r.y - l.y, d = Math.hypot(dx, dy);
            if (d > 1) { const paso = Math.min(d, h.sigue * dt); l.x += (dx / d) * paso; l.y += (dy / d) * paso; }
          }
        } else if (t < subida + h.aviso + bajada) { ent.fase = 'baja'; l.salto = Math.round(h.alto * (1 - (t - subida - h.aviso) / bajada)); ent.k = 1; }
        else {
          l.salto = 0; delete l.est.vuelo;
          areaCirculo(luta, l, l.x, l.y, h.radio, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, pesado: true, empuje: 80, alcanzaVuelo: false }));
          luta.emit({ t: 'pulso', x: l.x, y: l.y, radio: h.radio, tipo: h.tipo, estilo: 'aterrizaje' });
          luta.emit({ t: 'temblor', f: 0.012 });
          return false;
        }
        ent.x = l.x; ent.y = l.y;
        return true;
      },
    };
    luta.add(ent);
  }

  // ---------------------------------------------------------------- Dig / Fly: some e reaparece
  vuelo(l, h, extra) {
    const luta = this.luta;
    const tierra = h.modo === 'tierra';
    l.animar(h.anim ?? 'Hop', 0.3);
    l.ponerEstado('vuelo', h.dur, { oculto: tierra, rapidez: h.rapidez ?? 1.5 });
    l.accion = null;
    luta.emit({ t: 'desaparece', l, modo: tierra ? 'tierra' : 'aire' });
    let t = 0;
    const emergir = () => {
      if (!l.est.vuelo) return;
      delete l.est.vuelo; l.salto = 0;
      const g = pacote(h, extra, 0, { dirX: undefined, dirY: undefined, pesado: true, aturde: h.aturde, empuje: h.empuje ?? 50 });
      areaCirculo(luta, l, l.x, l.y, h.radio, g);
      luta.emit({ t: 'pulso', x: l.x, y: l.y, radio: h.radio, tipo: h.tipo, estilo: tierra ? 'tierra' : 'aire' });
      luta.emit({ t: 'temblor', f: 0.008 });
      l.ponerEstado('invul', 0.15);
    };
    luta.add({
      tipo: 'vuelo', dueno: l, vivo: true, x: l.x, y: l.y,
      update: dt => {
        t += dt;
        if (l.ko) return false;
        if (!tierra) l.salto = Math.round(34 * Math.min(1, t / 0.25));
        const pulsa = l.intento?.[extra.slot];
        if (t > 0.5 && (t >= h.dur - 0.02 || (pulsa && l.intento?.sueltoVuelo))) { emergir(); return false; }
        if (!pulsa) l.intento && (l.intento.sueltoVuelo = true);
        if (t >= h.dur) { emergir(); return false; }
        return true;
      },
    });
  }

  // ---------------------------------------------------------------- patada saltada (Jump Kick, Body Slam)
  patada(l, h, extra) {
    const luta = this.luta;
    let ang = asistir(l, angApunte(l), h.alcance + 40, 1);
    const dur = 0.32;
    l.animar(h.anim ?? 'Hop', dur + 0.2);
    if (h.blindaje) l.ponerEstado('blindaje', dur + 0.2, { reduce: h.blindaje });
    l.accion = { hasta: luta.t + dur + 0.05, bloquea: false, lento: 0, angulo: ang };
    l.ponerEstado('invul', 0.1);
    const r = l.rival;
    const alc = r && !r.ko ? clamp(Math.hypot(r.x - l.x, r.y - l.y) - 10, 30, h.alcance) : h.alcance;
    l.dash = { def: { ...h, dist: alc, dur, arco: 22, invul: false, dano: 0 }, ang, dur, t: 0, vel: alc / dur, golpeado: true, fin: () => {
      if (l.ko) return;
      const g = pacote(h, extra, ang, { pesado: true, empuje: 70, aturde: h.aturde });
      const ok = areaCirculo(luta, l, l.x + Math.cos(ang) * 14, l.y + Math.sin(ang) * 14, h.radio, g);
      luta.emit({ t: 'pulso', x: l.x, y: l.y, radio: h.radio, tipo: h.tipo, estilo: 'patada' });
      if (ok && h.choque) l.hp = Math.max(1, l.hp - 0); // sem recuo no PK confront
      luta.emit({ t: 'temblor', f: 0.006 });
    } };
    l.angulo = ang;
  }

  // ---------------------------------------------------------------- Rest
  descanso(l, h) {
    const luta = this.luta;
    l.animar('Sleep', h.dur);
    l.ponerEstado('dormido', h.dur, { cura: (h.cura * l.hpMax) / h.dur, acum: 0 });
    l.cortarAccion();
    l.accion = null;
    l.texto('ZZZ...', '#bfdbfe');
    luta.emit({ t: 'dormir', l, dur: h.dur });
  }

  // ---------------------------------------------------------------- clones (Double Team)
  clones(l, h) {
    const luta = this.luta;
    l.animar(h.anim ?? 'Charge', 0.4);
    l.accion = { hasta: luta.t + 0.3, lento: 0.2 };
    const lista = [];
    for (let i = 0; i < h.n; i++) {
      const lado = i % 2 ? 1 : -1, escalon = Math.floor(i / 2) + 1;
      const c = new Clon(luta, l, lado * h.sep * escalon, h.dur, h.mult);
      lista.push(c);
      luta.add(c);
    }
    l.clones = lista;
    luta.emit({ t: 'clones', l });
  }

  // ---------------------------------------------------------------- fumaça
  humo(l, h) {
    const luta = this.luta;
    l.animar(h.anim ?? 'Charge', 0.4);
    l.accion = { hasta: luta.t + 0.3, lento: 0.3 };
    luta.add(new Humo(luta, l, h));
    luta.emit({ t: 'humo', x: l.x, y: l.y, radio: h.radio });
  }

  // ---------------------------------------------------------------- investidas cruzadas (Cross Poison)
  embestidas(l, h, extra) {
    const luta = this.luta;
    l.animar(h.anim ?? 'Attack', h.golpes * (h.dur + h.pausa));
    const base = asistir(l, angApunte(l), 260, 1.4);
    l.accion = { hasta: luta.t + h.golpes * (h.dur + h.pausa) + 0.1, lento: 0, bloquea: true };
    for (let i = 0; i < h.golpes; i++) {
      luta.programar(i * (h.dur + h.pausa), () => {
        if (l.ko || l.est.aturdido) return;
        const r = l.rival;
        if (!r || r.ko) return;
        const dx = r.x - l.x, dy = r.y - l.y, d = Math.hypot(dx, dy) || 1;
        const a = Math.atan2(dy, dx) + (h.cruz ? (i % 2 ? 0.7 : -0.7) : 0);
        const dd = Math.max(40, Math.min(d + (h.pasa ?? 40), 200));
        const ultimo = i === h.golpes - 1;
        luta.emit({ t: 'cruz', x: r.x, y: r.y - r.alto * 0.45, ang: a + (h.cruz ? 0 : 0), tipo: h.tipo, largo: 70 });
        l.empezarDash({ dist: dd, dur: h.dur, dano: h.dano, tipo: h.tipo, estilo: h.estilo, empuje: 30, aturde: ultimo ? h.aturdeFinal : undefined, invul: true, anim: 'Walk' }, a);
        l.dash.slot = extra.slot;
      });
    }
  }
}
