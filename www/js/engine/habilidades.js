// As 25 formas de skill do PK confront. Cada Pokémon só escolhe uma forma e entrega os números.
// usar(l, slot) faz as checagens comuns (recarga, energia, ultimate, calor) e chama a forma.
import { RADIO } from '../config.js';
import { REGLAS } from '../data/regras.js';
import { aleatorio, entre, difAng, clamp, dist, distSegmento } from './util.js';
import { fijarCampo, fueraCampo, limitarCampo } from './fisica.js';
import { Proyectil, Chorro, Cono, Marcas, Humo, Charco, Clon, areaCirculo, pacote, atingir } from './entidades.js';
import { etapaDe, umbralesExp, tipoLinea } from './lutador.js';

const rad = g => (g * Math.PI) / 180;
const angApunte = l => Math.atan2(l.ay - l.y, l.ax - l.x);

// ajuda a mirar: se o alvo está perto da direção apontada, corrige para ele
function triAtaque(l, h) {
  l.ciclo = ((l.ciclo ?? -1) + 1) % h.ciclo.length;
  const tipo = h.ciclo[l.ciclo];
  return { ...h, tipo, quema: tipo === 'FIRE' ? { dps: 1, dur: 2, max: 2 } : undefined, ralentiza: tipo === 'ICE' ? 0.35 : undefined, ralentizaDur: 1.5, aturde: tipo === 'ELECTRIC' ? 0.15 : h.aturde };
}

// Dire Claw (Sneasler): veneno, paralisia ou sono, sorteado
function estadoAleatorio(b, l) {
  const sorte = aleatorio();
  if (sorte < 0.4) { b.ponerEstado('veneno', 3, { dps: 3, fuente: l }); b.texto('POISONED!', '#e879f9'); }
  else if (sorte < 0.7) { b.ponerEstado('paralizado', 2, {}); b.texto('PARALYZED!', '#fde047'); }
  else { b.ponerEstado('dormido', 0.9, { cura: 0, acum: 0 }); b.cortarAccion(); b.texto('ASLEEP!', '#bfdbfe'); }
}

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
      tajo: this.tajo, golpe: this.golpe, cono: this.cono, pulso: this.pulso, burbujas: this.burbujas, caparazon: this.caparazon, laco: this.laco, geiser: this.geiser, espejo: this.espejo, curaAnillo: this.curaAnillo, recuperar: this.recuperar, estallido: this.estallido, torreta: this.torreta, lanzaTorretas: this.lanzaTorretas, chapoteo: this.chapoteo, potenciar: this.potenciar, escudo: this.escudo, burbuja: this.burbuja, explosion: this.explosion, trampa: this.trampa, torbellino: this.torbellino,
      viento: this.viento, lluvia: this.lluvia, vuelo: this.vuelo, erupcion: this.erupcion, patada: this.patada, salto: this.salto, flecha: this.flecha, puente: this.puente, agarre: this.agarre, sismo: this.sismo, bolaGigante: this.bolaGigante, rodar: this.rodar, arenaRoca: this.arenaRoca, espinho: this.espinho, almas: this.almas, hueso: this.hueso, levitar: this.levitar, enrollar: this.enrollar, descanso: this.descanso,
      meteoro: this.meteoro, rafaga: this.rafaga, clones: this.clones, humo: this.humo, embestidas: this.embestidas,
      bombaLodo: this.bombaLodo, plantaFeroz: this.plantaFeroz, arraigo: this.arraigo, gunkShot: this.gunkShot,
    };
  }

  // ---------------------------------------------------------------- uso de um espaço
  usar(l, slot) {
    const h = l.kit[slot];
    const luta = this.luta;
    if (!h || h.sinUlti || l.cd[slot] > 0 || l.est.aturdido || l.est.dormido) return false;
    if (l.accion?.bloquea) return false;
    // voando (Fly) ou debaixo da terra (Dig) só dá para sair da esquiva: nenhuma skill sai
    if (l.est.vuelo) return false;
    const t = luta.t;
    if (slot === 'lmb' && t < l.sobrecargaHasta) return false;
    if (slot === 'esp' && l.est.sinDash) { if (l.humano) l.avisar('sinDash', () => l.texto('NO DASH', '#fde68a')); return false; }
    // enquanto faz outra ação longa (raio, cone...), não começa outra
    if (l.accion && !h.interrompe && slot !== 'esp') return false;
    // rolando (Rollout): só dá para parar de rolar ou soltar a ult
    if (l.est.rodando && slot !== 'esp' && slot !== 'e' && !h.usaRodando) return false;
    if (h.requiereRodar && !l.est.rodando) { if (l.humano) l.avisar('rodar', () => l.texto('ROLL FIRST!', '#e8d8b0')); return false; }
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
    if (l.accion && l.accion !== accionAntes) { l.accion.h = h; l.accion.slot = slot; l.accion.desde = t; }
    l.energia -= coste;
    if (slot === 'e') l.ulti = 0;
    // skill com cargas (Wall Climb): recarga curta entre os usos e longa quando acabam
    if (h.cargas) {
      const c = ((l.cargas ??= {})[slot] ??= { n: h.cargas, t: -99 });
      if (t - c.t > h.cd) c.n = h.cargas;
      c.n--; c.t = t;
      l.cd[slot] = c.n > 0 ? h.cdEntre ?? 0.5 : h.cd;
      if (c.n <= 0) c.n = h.cargas;
    } else if (h.forma !== 'puente' && h.forma !== 'rodar') l.cd[slot] = h.cd;
    // Sneasler: toda skill termina com o corte em X
    if (slot !== 'lmb' && l.kit.lmb?.trasSkill) this.esperarX(l);
    // skills que giram o Pokémon no lugar
    if (h.gira) l.ponerEstado('girando', h.gira);
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
    const luta = this.luta, hBase = h;
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
        // Tri Attack (Porygon): cada tiro troca de tipo — fogo queima, gelo deixa lento, elétrico atordoa um instante
        if (hBase.ciclo) h = triAtaque(l, hBase);
        if (hBase.ultimoGrande && i === n - 1) h = { ...h, escala: (h.escala ?? 1) * 1.9, radio: (h.radio ?? 4) * 1.6, dano: h.dano * 1.6 };
        // leque fixo: o primeiro vai reto, os outros alternam para os lados
        const abre = h.abanicos ? h.abanicos[i % h.abanicos.length] : i ? (i % 2 ? 1 : -1) * (h.abanico ?? 0.06) * Math.ceil(i / 2) : 0;
        const a2 = asistir(l, angApunte(l), h.alcance + 40, 0.7) + abre;
        const lanzarUno = (desde, mult = 1, esClon = false) => {
          // Razor Leaf: duas folhas em zigue-zague espelhado (fases opostas), que se cruzam na linha da mira
          const lados = h.doble ? [-1, 1] : h.zigzag && !h.zigzag.unico && !esClon ? [0, Math.PI] : [0];
          for (const lado of lados) {
            const off = h.doble ? lado * h.doble * 0.5 : 0;
            const pos = desde ?? { x: l.x, y: l.y, alt: l.alto * 0.55 };
            const origen = { x: pos.x + Math.cos(a2) * 10 - Math.sin(a2) * off, y: pos.y + Math.sin(a2) * 6 + Math.cos(a2) * off, alt: l.alto * 0.55 };
            luta.add(new Proyectil(luta, l, h, a2, { ...extra, mult: (extra.mult ?? 1) * mult, desde: origen, zig: h.zigzag && !esClon ? lado : undefined, clon: esClon, volea: esClon ? null : volea }));
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
    if (h.teleport) return this.teletransporte(l, h, extra, ang);
    l.empezarDash(h, ang);
    l.dash.slot = extra?.slot;
    l.accion = null;
    l.animar(h.anim ?? 'Walk', h.dur + 0.1);
    if (h.blindaje) l.ponerEstado('blindaje', h.dur + 0.25, { reduce: h.blindaje });
    if (h.acelera) { l.ponerEstado('rapido', h.dur + h.acelera.dur, { vel: h.acelera.vel }); l.texto('SPEED UP', '#7dd3fc'); }
    luta.emit({ t: 'sonido', n: 'dash' });
  }

  // ---------------------------------------------------------------- Mirror Coat (Milotic): por um instante, devolve o golpe recebido
  espejo(l, h) {
    const luta = this.luta;
    l.ponerEstado('espejo', h.dur ?? 1, { f: h.f ?? 1.2 });
    l.animar(h.anim ?? 'Charge', h.dur ?? 1);
    l.accion = { hasta: luta.t + 0.25, lento: 0.6 };
    luta.emit({ t: 'espejo', l, dur: h.dur ?? 1 });
  }

  // ---------------------------------------------------------------- Aqua Ring: anel de água que cura aos poucos
  curaAnillo(l, h) {
    const luta = this.luta;
    l.ponerEstado('aquaRing', h.dur, { cura: (h.cura * l.hpMax) / h.dur, acum: 0 });
    l.animar(h.anim ?? 'Charge', 0.5);
    l.accion = { hasta: luta.t + 0.25, lento: 0.3 };
    luta.emit({ t: 'aquaRing', l });
  }

  // ---------------------------------------------------------------- Recover: cura na hora
  recuperar(l, h) {
    const luta = this.luta, antes = l.hp;
    l.cura(h.cura * l.hpMax);
    l.animar(h.anim ?? 'Charge', 0.5);
    l.accion = { hasta: luta.t + 0.35, bloquea: true, lento: 0 };
    l.texto(`+${Math.round(((l.hp - antes) / l.hpMax) * 100)}% HP`, '#3ccf4e');
    luta.emit({ t: 'recuperar', l });
  }

  // ---------------------------------------------------------------- Psystrike (Mega Mewtwo Y): rajada de esferas em todas as direções
  estallido(l, h, extra) {
    const luta = this.luta, lanzar = h.lanzar ?? 0.2, ang = angApunte(l);
    l.animar(h.anim ?? 'Charge', lanzar + 0.3);
    l.accion = { hasta: luta.t + lanzar + 0.1, bloquea: true, lento: 0.3, angulo: ang };
    // Psystrike: protegido enquanto concentra
    if (h.bloqueo) l.ponerEstado('bloqueo', h.bloqueo);
    luta.programar(lanzar, () => {
      if (l.ko || l.est.aturdido) return;
      const cx = l.x, cy = l.y, volea = { golpe: false };
      // apaga projéteis inimigos por perto
      if (h.anula) for (const e of luta.entidades) if (e.tipo === 'proj' && e.dueno !== l && e.vivo !== false && Math.hypot(e.x - cx, (e.y - cy) / 0.65) < h.anula) { e.vivo = false; luta.emit({ t: 'finProyectil', x: e.x, y: e.y, tipo: h.tipo }); }
      const n = h.n ?? 12;
      for (let i = 0; i < n; i++) {
        const a = ang + (i / n) * Math.PI * 2;
        luta.add(new Proyectil(luta, l, { ...h, forma: 'proyectil' }, a, { ...extra, desde: { x: cx + Math.cos(a) * (RADIO + 2), y: cy + Math.sin(a) * (RADIO + 2) * 0.6, alt: l.alto * 0.5 }, mult: 1, volea }));
      }
      luta.emit({ t: 'estallido', l, n });
      luta.emit({ t: 'temblor', f: 0.008 });
    });
  }

  // ---------------------------------------------------------------- Pulse Turret (Veluza): torreta no chão que solta pulsos em volta
  torreta(l, h, extra) {
    const luta = this.luta, p = fijarCampo(l.x, l.y + 4);
    const mias = luta.entidades.filter(e => e.tipo === 'torreta' && e.dueno === l && e.vivo);
    if (mias.length >= (h.max ?? 3)) mias[0].vivo = false;
    l.animar(h.anim ?? 'Charge', 0.3);
    l.accion = { hasta: luta.t + 0.2, lento: 0.3 };
    const tr = {
      tipo: 'torreta', dueno: l, vivo: true, x: p.x, y: p.y, t: 0, acum: 0, aLaser: 0, radio: h.radio, dur: h.permanente ? Infinity : h.dur, cada: h.cada, tipoAtq: h.tipo, enlace: h.enlace ?? 260,
      update: dt => {
        tr.t += dt; tr.acum += dt; tr.aLaser += dt;
        if (!tr.vivo || l.ko || tr.t >= tr.dur) return false;
        // torretas perto uma da outra se ligam por um laser que machuca quem passa no meio
        if (tr.aLaser >= 0.25) {
          tr.aLaser -= 0.25;
          for (const o of luta.entidades) {
            if (o === tr || o.tipo !== 'torreta' || o.dueno !== l || !o.vivo || o.x < tr.x || Math.hypot(o.x - tr.x, o.y - tr.y) > tr.enlace) continue;
            for (const b of luta.blancos(l)) {
              if (b.oculto || b.est?.vuelo || distSegmento(b.x, b.y, tr.x, tr.y, o.x, o.y) > RADIO + 4) continue;
              const aturde = h.aturdeLaser && luta.t - (b.ultimoLaser ?? -9) > 1.6 ? h.aturdeLaser : undefined;
              if (aturde) b.ultimoLaser = luta.t;
              atingir(l, b, pacote(h, extra, 0, { dano: h.danoLaser ?? 1.2, tick: !aturde, empuje: 0, ralentiza: undefined, aturde }));
            }
          }
        }
        if (tr.acum >= tr.cada) {
          tr.acum -= tr.cada;
          luta.emit({ t: 'pulsoTorreta', x: tr.x, y: tr.y, radio: tr.radio });
          for (const b of luta.blancos(l)) {
            if (b.oculto || b.est?.vuelo || Math.hypot(b.x - tr.x, b.y - tr.y) >= tr.radio + RADIO) continue;
            atingir(l, b, pacote(h, extra, Math.atan2(b.y - tr.y, b.x - tr.x), { empuje: 20 }));
          }
        }
        return true;
      },
    };
    luta.add(tr);
    luta.emit({ t: 'torretaNace', x: p.x, y: p.y });
  }

  // laser de uma torreta que muda de lugar: machuca quem estiver na linha
  laserTorreta(l, h, extra, x0, y0, x1, y1) {
    const luta = this.luta;
    luta.emit({ t: 'trazo', x0, y0: y0 - 14, x1, y1: y1 - 14, tipo: 'PSYCHIC' });
    for (const b of luta.blancos(l)) if (!b.oculto && distSegmento(b.x, b.y, x0, y0, x1, y1) < RADIO + 6) atingir(l, b, pacote(h, extra, 0, { dano: h.danoLaser ?? 5, empuje: 20 }));
  }

  // ---------------------------------------------------------------- Stellar Bridge (Archaludon): investida que empurra e vira ponte,
  // presa no lugar e atirando laser no básico; apertar de novo sai com outra investida. Na ponte, a ult é uma descarga em volta
  puente(l, h, extra) {
    const luta = this.luta, saliendo = !!l.est.puente;
    const ang = Math.atan2(l.ay - l.y, l.ax - l.x);
    if (saliendo) { delete l.est.puente; l.kit = l.kitActual(); }
    l.empezarDash({ dist: h.dist ?? 110, dur: 0.2, dano: h.dano, tipo: h.tipo, empuje: h.empuje ?? 150, estilo: 'acero', invul: true }, ang);
    l.dash.slot = extra.slot;
    l.animar('Walk', 0.3);
    if (saliendo) { l.cd[extra.slot] = h.cd; return; }
    l.dash.fin = () => {
      if (l.ko) return;
      l.ponerEstado('puente', h.dur ?? 10, {});
      l.ponerEstado('blindaje', h.dur ?? 10, { reduce: h.reduce ?? 0.25 });
      l.kit = { ...l.kit, lmb: { ...h.laser, forma: 'proyectil' }, e: { ...l.kit.e, ...h.descarga, forma: 'pulso' } };
      l.texto('BRIDGE!', '#fde68a');
      luta.emit({ t: 'endurecer', l, estilo: 'acero' });
    };
    l.cd[extra.slot] = 0.4;
  }


  // ================================================================ ultimates das Megas
  // segura o rival no lugar (sem agir) até `hasta`
  prender(r, dur) {
    if (r.dash) r.dash = null;
    r.accion = { hasta: this.luta.t + dur, bloquea: true, lento: 0 };
    r.vx = r.vy = 0; r.empX = r.empY = 0;
  }

  // Mega Charizard X: investe, agarra, sobe voando com o rival e o crava no chão
  agarre(l, h, extra) {
    const luta = this.luta, ang = asistir(l, angApunte(l), (h.dist ?? 180) + 30, 0.8);
    l.empezarDash({ dist: h.dist ?? 180, dur: 0.28, dano: 0, invul: true, estilo: 'dragon' }, ang);
    l.dash.slot = extra.slot;
    l.animar('Walk', 0.3);
    let pegou = false;
    const sonda = { tipo: 'sonda', dueno: l, vivo: true, t: 0, update: dt => {
      sonda.t += dt;
      const r = l.rival;
      if (pegou || l.ko || sonda.t > 0.32 || !r || r.ko) return false;
      if (Math.hypot(r.x - l.x, r.y - l.y) > RADIO * 2 + 10 || r.est.vuelo || r.invulnerable) return true;
      pegou = true; l.dash = null;
      const sube = 0.55, baja = 0.16, total = sube + 0.15 + baja, x0 = r.x, y0 = r.y;
      this.prender(r, total + 0.1);
      l.ponerEstado('invul', total + 0.1);
      r.texto('GRABBED!', '#ffb347', { dy: 12 });
      let t = 0;
      l.animar('Hop', total);
      l.accion = { hasta: luta.t + total, bloquea: true, lento: 0, update: d2 => {
        t += d2;
        const alto = t < sube ? 90 * Math.sin((t / sube) * Math.PI / 2) : t < sube + 0.15 ? 90 : 90 * (1 - (t - sube - 0.15) / baja);
        l.salto = Math.max(0, Math.round(alto)); r.salto = Math.max(0, Math.round(alto - 6));
        l.x = x0 - Math.cos(ang) * 8; l.y = y0; r.x = x0; r.y = y0;
        if (Math.floor(t * 30) % 2) luta.emit({ t: 'rastroLlama', x: x0, y: y0 - alto, tipo: 'DRAGON' });
      }, fin: () => {
        l.salto = 0; r.salto = 0;
        if (l.ko) return;
        luta.emit({ t: 'pulso', x: x0, y: y0, radio: h.radio, tipo: 'DRAGON', estilo: 'fuego' });
        luta.emit({ t: 'pulso', x: x0, y: y0, radio: h.radio * 0.8, tipo: 'GROUND', estilo: 'tierra' });
        luta.emit({ t: 'explosion', x: x0, y: y0 - 6, radio: h.radio, tipo: 'DRAGON' });
        luta.emit({ t: 'pilarFuego', x: x0, y: y0, tipo: 'DRAGON' });
        luta.emit({ t: 'temblor', f: 0.025 });
        areaCirculo(luta, l, x0, y0, h.radio, pacote(h, extra, ang, { pesado: true, empuje: 120, aturde: h.aturde, dirX: undefined, dirY: undefined }));
      } };
      return false;
    } };
    luta.add(sonda);
  }

  // Mega Steelix: se arremessa e cai, deixando um terremoto que pulsa e puxa
  sismo(l, h, extra) {
    const luta = this.luta, ang = angApunte(l), d = Math.min(h.alcance ?? 200, Math.hypot(l.ax - l.x, l.ay - l.y));
    const x0 = l.x, y0 = l.y, p1 = fijarCampo(x0 + Math.cos(ang) * d, y0 + Math.sin(ang) * d), vuelo = 0.55;
    l.ponerEstado('invul', vuelo); l.animar('Hop', vuelo);
    let t = 0;
    l.accion = { hasta: luta.t + vuelo, bloquea: true, lento: 0, angulo: ang,
      update: dt => { t += dt; const k = Math.min(1, t / vuelo); l.x = x0 + (p1.x - x0) * k; l.y = y0 + (p1.y - y0) * k; l.salto = Math.round(Math.sin(k * Math.PI) * 80); },
      fin: () => {
        l.salto = 0;
        if (l.ko) return;
        const z = { tipo: 'sismo', dueno: l, vivo: true, x: l.x, y: l.y, radio: h.radio, t: 0, acum: 1, dur: h.dur ?? 3.5, tipoAtq: h.tipo, update: dt => {
          z.t += dt; z.acum += dt;
          if (l.ko || z.t >= z.dur) return false;
          for (const b of luta.blancos(l)) { if (b.esClon || b.est?.vuelo) continue; const dx = z.x - b.x, dy = z.y - b.y, dd = Math.hypot(dx, dy) || 1; if (dd < z.radio * 1.6 && dd > 10) { b.empX += (dx / dd) * (h.tiron ?? 90) * dt * 9; b.empY += (dy / dd) * (h.tiron ?? 90) * dt * 9; } }
          if (z.acum >= (h.cada ?? 0.5)) {
            z.acum = 0;
            luta.emit({ t: 'pulso', x: z.x, y: z.y, radio: z.radio, tipo: 'GROUND', estilo: 'tierra' });
            luta.emit({ t: 'temblor', f: 0.01 });
            areaCirculo(luta, l, z.x, z.y, z.radio, pacote(h, extra, 0, { dano: h.dano / Math.ceil(z.dur / (h.cada ?? 0.5)), empuje: 0, tick: true, dirX: undefined, dirY: undefined }));
          }
          return true;
        } };
        luta.add(z);
        luta.emit({ t: 'explosion', x: l.x, y: l.y - 6, radio: h.radio, tipo: 'STEEL' });
        luta.emit({ t: 'temblor', f: 0.03 });
        areaCirculo(luta, l, l.x, l.y, h.radio * 0.7, pacote(h, extra, 0, { dano: h.danoQueda ?? 10, aturde: 0.5, empuje: 60, dirX: undefined, dirY: undefined }));
      } };
  }

  // Rollout (Graveler e Golem): vira uma pedra e sai rolando rápido; quem ele atropela leva dano e é jogado longe.
  // Apertar de novo para de rolar.
  rodar(l, h, extra) {
    const luta = this.luta;
    if (l.est.rodando) {
      delete l.est.rodando; delete l.est.blindaje;
      l.cd[extra.slot] = h.cd;
      luta.emit({ t: 'pulso', x: l.x, y: l.y, radio: 26, tipo: 'ROCK', estilo: 'tierra' });
      return;
    }
    l.ponerEstado('rodando', h.dur ?? 4, { vel: h.vel ?? 1.75, dano: h.dano, empuje: h.empuje ?? 160, tipo: h.tipo, slot: extra.slot, cd: h.cd, golpes: new Map() });
    if (h.reduce) l.ponerEstado('blindaje', h.dur ?? 4, { reduce: h.reduce });
    l.cd[extra.slot] = 0.35;
    l.texto('ROLLOUT!', '#e8d8b0');
    luta.emit({ t: 'pulso', x: l.x, y: l.y, radio: 30, tipo: 'ROCK', estilo: 'tierra' });
  }

  // Soul Swarm / Spirit School (Basculegion): solta as almas como peixes fantasmas que perseguem o alvo
  almas(l, h, extra) {
    const luta = this.luta, tem = l.almas ?? 0, n = (h.base ?? 0) + Math.max(h.base ? 0 : 1, tem), bonus = (h.porAlma ?? 0) * tem;
    l.almas = 0;
    const ang = angApunte(l), lanzar = h.lanzar ?? 0.2, volea = { golpe: false };
    l.animar(h.anim ?? 'Shoot', lanzar + 0.3);
    l.accion = { hasta: luta.t + lanzar + n * 0.06 + 0.05, lento: 0.4, angulo: ang };
    for (let i = 0; i < n; i++) luta.programar(lanzar + i * 0.06, () => {
      if (l.ko) return;
      const a = ang + (i - (n - 1) / 2) * (h.abre ?? 0.28);
      luta.add(new Proyectil(luta, l, { forma: 'proyectil', estilo: 'almaPez', tipo: h.tipo, dano: h.dano + bonus, vel: h.vel ?? 260, alcance: h.alcance ?? 300, radio: h.radio ?? 6, escala: h.escala ?? 1.4, teledirigido: h.teledirigido ?? 2.5, noChoca: true, aturde: h.aturde }, a, { ...extra, desde: { x: l.x - Math.cos(a) * 6, y: l.y - Math.sin(a) * 4, alt: l.alto * 0.6 }, volea }));
    });
    luta.emit({ t: 'almasSueltas', l, n });
  }

  // Stone Spire (Golem): um espinho de pedra brota do chão na mira e lança para o alto quem estiver em cima.
  // Rolando, o espinho nasce embaixo do próprio Golem, que é arremessado até a mira e cai causando dano.
  espinho(l, h, extra) {
    const luta = this.luta, ang = angApunte(l), d = Math.min(h.alcance ?? 180, Math.hypot(l.ax - l.x, l.ay - l.y));
    const rolando = !!l.est.rodando, alvo = fijarCampo(l.x + Math.cos(ang) * d, l.y + Math.sin(ang) * d);
    const p = rolando ? { x: l.x, y: l.y } : alvo, aviso = rolando ? 0.1 : h.aviso ?? 0.35;
    if (!rolando) { l.animar(h.anim ?? 'Swing', 0.4); l.accion = { hasta: luta.t + 0.25, lento: 0.3, angulo: ang }; }
    let saiu = false;
    const e = { tipo: 'espinho', dueno: l, vivo: true, x: p.x, y: p.y, radio: h.radio ?? 30, t: 0, aviso, dur: aviso + 0.75, tipoAtq: h.tipo, update: dt => {
      e.t += dt;
      if (!saiu && e.t >= aviso) {
        saiu = true;
        luta.emit({ t: 'pulso', x: e.x, y: e.y, radio: e.radio, tipo: 'ROCK', estilo: 'tierra' });
        luta.emit({ t: 'temblor', f: 0.01 });
        for (const b of luta.blancos(l)) {
          if (b.oculto || b.est?.vuelo || Math.hypot(b.x - e.x, (b.y - e.y) / 0.7) > e.radio + RADIO) continue;
          if (b.esClon) { b.romper(); continue; }
          atingir(l, b, pacote(h, extra, 0, { empuje: 0, pesado: true, dirX: undefined, dirY: undefined }));
          this.lanzarAlto(b, 0.6, h.alto ?? 60);
        }
        if (rolando && !l.ko) this.lanzarGolem(l, h, extra, alvo);
      }
      return e.t < e.dur;
    } };
    luta.add(e);
  }
  // joga um lutador para o alto (sem agir) e o deixa cair com um tranco
  lanzarAlto(b, dur, alto) {
    const luta = this.luta;
    this.prender(b, dur);
    let t = 0;
    luta.add({ tipo: 'lanzado', dueno: null, vivo: true, update: dt => {
      t += dt;
      if (b.ko) { b.salto = 0; return false; }
      if (t >= dur) { b.salto = 0; b.ponerEstado('aturdido', 0.25); luta.emit({ t: 'pulso', x: b.x, y: b.y, radio: 22, tipo: 'GROUND', estilo: 'tierra' }); return false; }
      b.salto = Math.round(Math.sin((t / dur) * Math.PI) * alto);
      return true;
    } });
  }
  // rolando, o espinho arremessa o próprio Golem até a mira; ele cai com impacto em área e continua rolando
  lanzarGolem(l, h, extra, alvo) {
    const luta = this.luta, x0 = l.x, y0 = l.y, vuelo = 0.5;
    l.ponerEstado('invul', vuelo);
    let t = 0;
    l.accion = { hasta: luta.t + vuelo, bloquea: true, lento: 0,
      update: dt => { t += dt; const k = Math.min(1, t / vuelo); l.x = x0 + (alvo.x - x0) * k; l.y = y0 + (alvo.y - y0) * k; l.salto = Math.round(Math.sin(k * Math.PI) * 80); },
      fin: () => {
        l.salto = 0;
        if (l.ko) return;
        const R2 = h.radioCaida ?? 56;
        luta.emit({ t: 'pulso', x: l.x, y: l.y, radio: R2, tipo: 'ROCK', estilo: 'aterrizaje' });
        luta.emit({ t: 'temblor', f: 0.02 });
        areaCirculo(luta, l, l.x, l.y, R2, pacote(h, extra, 0, { dano: h.danoCaida ?? h.dano, empuje: 120, aturde: 0.4, pesado: true, dirX: undefined, dirY: undefined }));
      } };
  }

  // Tectonic Arena (Golem): só rolando. Se arremessa, cai e, se acertar o rival, levanta uma arena de pedra
  // que prende os dois lá dentro por alguns segundos
  arenaRoca(l, h, extra) {
    const luta = this.luta;
    delete l.est.rodando; delete l.est.blindaje;
    const ang = angApunte(l), d = Math.min(h.alcance ?? 210, Math.hypot(l.ax - l.x, l.ay - l.y));
    const x0 = l.x, y0 = l.y, p1 = fijarCampo(x0 + Math.cos(ang) * d, y0 + Math.sin(ang) * d), vuelo = 0.55;
    l.ponerEstado('invul', vuelo); l.animar(h.anim ?? 'Hop', vuelo);
    let t = 0;
    l.accion = { hasta: luta.t + vuelo, bloquea: true, lento: 0, angulo: ang,
      update: dt => { t += dt; const k = Math.min(1, t / vuelo); l.x = x0 + (p1.x - x0) * k; l.y = y0 + (p1.y - y0) * k; l.salto = Math.round(Math.sin(k * Math.PI) * 90); },
      fin: () => {
        l.salto = 0;
        if (l.ko) return;
        const x = l.x, y = l.y, r = l.rival;
        luta.emit({ t: 'pulso', x, y, radio: h.radio, tipo: 'ROCK', estilo: 'aterrizaje' });
        luta.emit({ t: 'explosion', x, y: y - 6, radio: h.radio, tipo: 'ROCK' });
        luta.emit({ t: 'temblor', f: 0.03 });
        const acerto = r && !r.ko && !r.est.vuelo && Math.hypot(r.x - x, (r.y - y) / 0.7) < h.radio + RADIO;
        areaCirculo(luta, l, x, y, h.radio, pacote(h, extra, 0, { empuje: 40, aturde: h.aturde, pesado: true, dirX: undefined, dirY: undefined }));
        if (!acerto) return;
        const A = h.arena ?? 120;
        const ar = { tipo: 'arenaRoca', dueno: l, vivo: true, x, y, radio: A, t: 0, dur: h.dur ?? 5, presos: [l, r], tipoAtq: h.tipo, update: dt => {
          ar.t += dt;
          if (ar.t >= ar.dur) { luta.emit({ t: 'pulso', x: ar.x, y: ar.y, radio: A, tipo: 'ROCK', estilo: 'tierra' }); return false; }
          // ninguém sai: quem encosta na parede volta para dentro
          for (const b of ar.presos) {
            if (!b || b.ko) continue;
            const dx = (b.x - ar.x) / A, dy = (b.y - ar.y) / (A * 0.62), e2 = Math.hypot(dx, dy), lim = 1 - RADIO / A;
            if (e2 > lim) { b.x = ar.x + (dx / e2) * lim * A; b.y = ar.y + (dy / e2) * lim * A * 0.62; b.empX *= -0.3; b.empY *= -0.3; }
          }
          return true;
        } };
        luta.add(ar);
        r.texto('TRAPPED!', '#e8d8b0', { dy: 12 });
        luta.emit({ t: 'arenaSobe', x, y, radio: A });
      } };
  }

  // Mega Mewtwo Y: concentra uma esfera psíquica gigante em cima da cabeça e depois a arremessa
  bolaGigante(l, h, extra) {
    const luta = this.luta, carga = h.carga ?? 1, R = h.radio ?? 26;
    l.animar('Charge', carga + 0.3);
    l.ponerEstado('blindaje', carga + 0.2, { reduce: 0.4 });
    l.accion = { hasta: luta.t + carga + 0.25, bloquea: true, lento: 0, angulo: angApunte(l) };
    const b = {
      tipo: 'bolaGigante', dueno: l, h, vivo: true, t: 0, fase: 'carga', x: l.x, y: l.y, alt: l.alto + R + 10, radio: R, k: 0, vx: 0, vy: 0, rec: 0, tipoAtq: h.tipo,
      update: dt => {
        b.t += dt;
        if (l.ko) return false;
        if (b.fase === 'carga') {
          b.k = Math.min(1, b.t / carga); b.x = l.x; b.y = l.y; b.alt = l.alto + 10 + R * b.k + Math.sin(b.t * 6) * 2;
          if (l.accion) l.accion.angulo = angApunte(l);
          if (b.t >= carga) {
            const a = asistir(l, angApunte(l), (h.alcance ?? 320) + 40, 0.7);
            b.fase = 'vuela'; b.vx = Math.cos(a) * (h.vel ?? 230); b.vy = Math.sin(a) * (h.vel ?? 230);
            l.animar('Shoot', 0.3); luta.emit({ t: 'temblor', f: 0.012 }); luta.emit({ t: 'anillo', x: l.x, y: l.y - l.alto, color: '#f0abfc', r: 30 });
          }
          return true;
        }
        // voando: desce até a altura do peito e segue um pouco o rival
        const r = l.rival;
        if (r && !r.ko && h.teledirigido) { const a = Math.atan2(r.y - b.y, r.x - b.x), v = Math.hypot(b.vx, b.vy), at = Math.atan2(b.vy, b.vx), giro = clamp(difAng(a, at), -h.teledirigido * dt, h.teledirigido * dt); b.vx = Math.cos(at + giro) * v; b.vy = Math.sin(at + giro) * v; }
        b.x += b.vx * dt; b.y += b.vy * dt; b.rec += Math.hypot(b.vx, b.vy) * dt; b.alt += (16 - b.alt) * Math.min(1, dt * 5);
        const toca = luta.blancos(l).some(o => !o.oculto && !o.est?.vuelo && Math.hypot(o.x - b.x, o.y - b.y) < R + RADIO);
        if (toca || b.rec >= (h.alcance ?? 320) || fueraCampo(b.x, b.y, 10)) {
          const E = h.explosion?.radio ?? 80;
          areaCirculo(luta, l, b.x, b.y, E, pacote(h, extra, 0, { empuje: 140, aturde: h.aturde, pesado: true, dirX: undefined, dirY: undefined }));
          luta.emit({ t: 'explosion', x: b.x, y: b.y - 10, radio: E, tipo: 'PSYCHIC' });
          luta.emit({ t: 'novaPsi', x: b.x, y: b.y - 10, radio: E });
          luta.emit({ t: 'temblor', f: 0.03 });
          return false;
        }
        return true;
      },
    };
    luta.add(b);
  }

  // Mega Lucario: osso de aura que gira e quica; se acerta, Lucario aparece no alvo e dá um golpe forte
  hueso(l, h, extra) {
    const luta = this.luta, ang = angApunte(l);
    l.animar('Shoot', 0.4);
    l.accion = { hasta: luta.t + 0.2, lento: 0.3, angulo: ang };
    const o = { tipo: 'hueso', dueno: l, vivo: true, x: l.x + Math.cos(ang) * 14, y: l.y + Math.sin(ang) * 9, vx: Math.cos(ang) * (h.vel ?? 340), vy: Math.sin(ang) * (h.vel ?? 340), t: 0, rebotes: 0, tipoAtq: h.tipo, update: dt => {
      o.t += dt;
      if (l.ko || o.t >= (h.dur ?? 3) || o.rebotes > (h.rebotes ?? 4)) return false;
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (fueraCampo(o.x, o.y, -8)) {
        const nx = (o.x - 480) / (455 * 455), ny = (o.y - 222) / (168 * 168), nm = Math.hypot(nx, ny) || 1, ux = nx / nm, uy = ny / nm, dot = o.vx * ux + o.vy * uy;
        o.vx -= 2 * dot * ux; o.vy -= 2 * dot * uy; const p = limitarCampo(o.x, o.y, 10); o.x = p.x; o.y = p.y; o.rebotes++;
        luta.emit({ t: 'impacto', x: o.x, y: o.y - 10, tipo: 'FIGHTING', estilo: 'aura' });
      }
      for (const b of luta.blancos(l)) {
        if (b.oculto || b.est?.vuelo || Math.hypot(b.x - o.x, b.y - o.y) > RADIO + 10) continue;
        if (b.esClon) { atingir(l, b, pacote(h, extra, 0, {})); continue; }
        // teleporta até o alvo e bate
        const a = Math.atan2(o.vy, o.vx);
        luta.emit({ t: 'teleport', l, x: l.x, y: l.y, estilo: 'aura' });
        const p = fijarCampo(b.x - Math.cos(a) * 22, b.y - Math.sin(a) * 14); l.x = p.x; l.y = p.y; l.angulo = Math.atan2(b.y - l.y, b.x - l.x);
        this.prender(b, 0.35);
        l.animar('Attack', 0.4); l.accion = { hasta: luta.t + 0.35, bloquea: true, lento: 0, angulo: l.angulo };
        luta.programar(0.18, () => {
          if (l.ko) return;
          b.accion = null;
          atingir(l, b, pacote(h, extra, l.angulo, { empuje: 220, aturde: h.aturde, pesado: true }));
          luta.emit({ t: 'explosion', x: b.x, y: b.y - b.alto * 0.5, radio: 46, tipo: 'FIGHTING' });
          luta.emit({ t: 'temblor', f: 0.02 });
        });
        return false;
      }
      return true;
    } };
    luta.add(o);
  }

  // Mega Alakazam: ergue o rival com telecinese e o bate no chão três vezes
  levitar(l, h, extra) {
    const luta = this.luta, r = l.rival;
    if (!r || r.ko || Math.hypot(r.x - l.x, r.y - l.y) > (h.alcance ?? 260) || r.est.vuelo) { if (l.humano) l.texto('OUT OF RANGE', '#9aa0b4'); return false; }
    const golpes = h.golpes ?? 3, ciclo = 0.42, total = golpes * ciclo;
    this.prender(r, total + 0.1);
    l.animar('Charge', total); l.accion = { hasta: luta.t + total, bloquea: true, lento: 0, angulo: Math.atan2(r.y - l.y, r.x - l.x) };
    r.texto('LIFTED!', '#e0b0ff', { dy: 12 });
    let t = 0;
    const ent = { tipo: 'levita', dueno: l, preso: r, vivo: true, t: 0, update: dt => {
      t += dt; ent.t = t;
      if (l.ko || r.ko || t >= total) { r.salto = 0; return false; }
      const k = (t % ciclo) / ciclo;
      r.salto = Math.round(k < 0.75 ? 60 * Math.sin((k / 0.75) * Math.PI / 2) : 60 * (1 - (k - 0.75) / 0.25));
      const i = Math.floor(t / ciclo);
      if (i !== ent.ultimo && k >= 0.97) {
        ent.ultimo = i; const ultimo = i === golpes - 1;
        r.salto = 0;
        atingir(l, r, pacote(h, extra, 0, { dano: h.dano / golpes * (ultimo ? 1.4 : 1), empuje: 0, tick: !ultimo && i > 0, pesado: ultimo, aturde: ultimo ? h.aturde : undefined }));
        luta.emit({ t: 'pulso', x: r.x, y: r.y, radio: 40, tipo: 'PSYCHIC', estilo: 'psico' });
        luta.emit({ t: 'temblor', f: ultimo ? 0.02 : 0.008 });
      }
      return true;
    } };
    luta.add(ent);
  }

  // Mega Eelektross: se enrola no rival e descarrega vários raios antes de explodir
  enrollar(l, h, extra) {
    const luta = this.luta, ang = asistir(l, angApunte(l), 200, 0.8);
    l.empezarDash({ dist: h.dist ?? 170, dur: 0.25, dano: 0, invul: true, estilo: 'rayo' }, ang);
    l.dash.slot = extra.slot;
    const sonda = { tipo: 'sonda', dueno: l, vivo: true, t: 0, update: dt => {
      sonda.t += dt;
      const r = l.rival;
      if (l.ko || sonda.t > 0.3 || !r || r.ko) return false;
      if (Math.hypot(r.x - l.x, r.y - l.y) > RADIO * 2 + 10 || r.est.vuelo || r.invulnerable) return true;
      l.dash = null;
      const n = h.golpes ?? 6, cada = 0.2, total = n * cada + 0.1;
      this.prender(r, total + 0.1); l.ponerEstado('invul', total);
      l.animar('Attack', total); l.accion = { hasta: luta.t + total, bloquea: true, lento: 0, update: () => { l.x = r.x - Math.cos(ang) * 10; l.y = r.y; } };
      r.texto('COILED!', '#fde047', { dy: 12 });
      for (let i = 0; i < n; i++) luta.programar(i * cada, () => {
        if (l.ko || r.ko) return;
        const ultimo = i === n - 1;
        atingir(l, r, pacote(h, extra, 0, { dano: h.dano / n * (ultimo ? 2 : 0.8), tick: i > 0 && !ultimo, empuje: ultimo ? 160 : 0, aturde: ultimo ? h.aturde : undefined, pesado: ultimo }));
        if (ultimo) luta.emit({ t: 'tormentaImpacto', x: r.x, y: r.y, radio: 70 }); else luta.emit({ t: 'impacto', x: r.x, y: r.y - r.alto * 0.5, tipo: 'ELECTRIC' });
        if (ultimo) { luta.emit({ t: 'explosion', x: r.x, y: r.y - 8, radio: 60, tipo: 'ELECTRIC' }); luta.emit({ t: 'temblor', f: 0.02 }); }
      });
      return false;
    } };
    luta.add(sonda);
  }

  // ---------------------------------------------------------------- Cyber Arrow (Porygon-Z): flecha grande que quica nas bordas;
  // quem ela pega vai junto e leva dano a cada batida na borda
  flecha(l, h, extra) {
    const luta = this.luta, ang = angApunte(l), lanzar = h.lanzar ?? 0.2;
    l.animar(h.anim ?? 'Shoot', lanzar + 0.2);
    l.accion = { hasta: luta.t + lanzar + 0.1, bloquea: true, lento: 0, angulo: ang };
    luta.programar(lanzar, () => {
      if (l.ko) return;
      const f = {
        tipo: 'flecha', dueno: l, h, vivo: true, x: l.x + Math.cos(ang) * 16, y: l.y + Math.sin(ang) * 10, vx: Math.cos(ang) * h.vel, vy: Math.sin(ang) * h.vel, t: 0, preso: null, rebotes: 0, tipoAtq: h.tipo,
        update: dt => {
          f.t += dt;
          if (l.ko || f.t >= h.dur || f.rebotes > (h.rebotes ?? 6)) { if (f.preso) { f.preso.empX += f.vx * 0.6; f.preso.empY += f.vy * 0.6; } return false; }
          f.x += f.vx * dt; f.y += f.vy * dt;
          if (fueraCampo(f.x, f.y, -8)) {
            // quica na borda do oval (reflete pela normal da elipse)
            const o = { cx: 480, cy: 222, rx: 455, ry: 168 }, nx = (f.x - o.cx) / (o.rx * o.rx), ny = (f.y - o.cy) / (o.ry * o.ry), nm = Math.hypot(nx, ny) || 1, ux = nx / nm, uy = ny / nm, dot = f.vx * ux + f.vy * uy;
            f.vx -= 2 * dot * ux; f.vy -= 2 * dot * uy;
            const p = limitarCampo(f.x, f.y, 10); f.x = p.x; f.y = p.y; f.rebotes++;
            luta.emit({ t: 'impacto', x: f.x, y: f.y - 8, tipo: h.tipo, estilo: 'glitch' });
            luta.emit({ t: 'temblor', f: 0.006 });
            if (f.preso && !f.preso.ko) atingir(l, f.preso, pacote(h, extra, Math.atan2(f.vy, f.vx), { dano: h.danoBorda ?? 8, empuje: 0, pesado: true }));
          }
          if (!f.preso) {
            for (const b of luta.blancos(l)) if (!b.esClon && !b.oculto && !b.est?.vuelo && Math.hypot(b.x - f.x, b.y - f.y) < RADIO + 10) { f.preso = b; atingir(l, b, pacote(h, extra, Math.atan2(f.vy, f.vx), { empuje: 0, pesado: true })); b.texto('CAUGHT!', '#7df9ff'); break; }
          } else if (!f.preso.ko) { f.preso.x = f.x; f.preso.y = f.y; f.preso.ponerEstado('aturdido', 0.1); }
          return true;
        },
      };
      luta.add(f);
    });
  }

  // ---------------------------------------------------------------- Turret Barrage: puxa as torretas e atira todas no inimigo
  lanzaTorretas(l, h, extra) {
    const luta = this.luta;
    let mias = luta.entidades.filter(e => e.tipo === 'torreta' && e.dueno === l && e.vivo);
    // sem torreta no campo a ultimate não faz nada
    if (!mias.length) { if (l.humano) l.texto('NO TURRETS', '#9aa0b4'); return false; }
    l.animar(h.anim ?? 'Charge', (h.tira ?? 0.35) + 0.3);
    l.accion = { hasta: luta.t + (h.tira ?? 0.35) + 0.1, bloquea: true, lento: 0 };
    mias.forEach((m, i) => {
      if (m.tipo) m.vivo = false;
      const v = { tipo: 'torretaVuela', dueno: l, vivo: true, x: m.x, y: m.y, x0: m.x, y0: m.y, t: 0, tipoAtq: h.tipo,
        update: dt => {
          v.t += dt;
          const k = Math.min(1, v.t / (h.tira ?? 0.35)), ox = l.x + Math.cos(i * 2.1 + 1) * 22, oy = l.y - 6 + Math.sin(i * 2.1 + 1) * 12;
          const px0 = v.x, py0 = v.y;
          v.x = v.x0 + (ox - v.x0) * k * k; v.y = v.y0 + (oy - v.y0) * k * k;
          // a torreta volta riscando laser: quem estiver no caminho leva dano uma vez
          for (const b of luta.blancos(l)) if (!v.feridos?.has(b) && !b.oculto && distSegmento(b.x, b.y, px0, py0, v.x, v.y) < RADIO + 6) { (v.feridos ??= new Set()).add(b); atingir(l, b, pacote(h, extra, 0, { dano: h.dano * 0.6, empuje: 30 })); }
          luta.emit({ t: 'trazo', x0: px0, y0: py0 - 14, x1: v.x, y1: v.y - 14, tipo: 'PSYCHIC' });
          if (k < 1) return true;
          const r = l.rival, ang = r && !r.ko ? Math.atan2(r.y - v.y, r.x - v.x) : angApunte(l);
          luta.add(new Proyectil(luta, l, { ...h, forma: 'proyectil', estilo: 'torretaProj', teledirigido: 2 }, ang + (i - (mias.length - 1) / 2) * 0.08, { ...extra, desde: { x: v.x, y: v.y, alt: 14 }, mult: 1 }));
          return false;
        } };
      luta.add(v);
    });
    luta.emit({ t: 'succion', x: l.x, y: l.y, radio: 60 });
  }

  // ---------------------------------------------------------------- Matcha Geyser: água verde sobe debaixo do alvo e o joga para perto de quem lançou
  geiser(l, h, extra) {
    const luta = this.luta, r = l.rival;
    let x, y;
    if (r && !r.ko && !r.oculto && dist(r, l) <= h.alcance + 40) { x = r.x; y = r.y; }
    else { const a = angApunte(l), d = Math.min(h.alcance, Math.hypot(l.ax - l.x, l.ay - l.y)); x = l.x + Math.cos(a) * d; y = l.y + Math.sin(a) * d; }
    const p = fijarCampo(x, y);
    l.animar(h.anim ?? 'Charge', 0.5);
    l.accion = { hasta: luta.t + 0.3, lento: 0.4 };
    luta.emit({ t: 'geiserAviso', x: p.x, y: p.y, radio: h.radio, dur: h.aviso, l });
    luta.programar(h.aviso, () => {
      if (l.ko) return;
      luta.emit({ t: 'geiser', x: p.x, y: p.y, radio: h.radio });
      for (const b of luta.blancos(l)) {
        if (b.oculto || b.est?.vuelo || Math.hypot(b.x - p.x, b.y - p.y) >= h.radio + RADIO) continue;
        const dx = l.x - b.x, dy = l.y - b.y;
        atingir(l, b, pacote(h, extra, Math.atan2(dy, dx), { empuje: h.tiron ?? 110, pesado: true }));
      }
    });
  }

  // ---------------------------------------------------------------- Teleport: some e reaparece na hora, sem atravessar o caminho
  teletransporte(l, h, extra, ang) {
    const luta = this.luta, x0 = l.x, y0 = l.y;
    const p = fijarCampo(l.x + Math.cos(ang) * h.dist, l.y + Math.sin(ang) * h.dist);
    l.x = p.x; l.y = p.y; l.vx = 0; l.vy = 0; l.empX = 0; l.empY = 0;
    l.angulo = ang;
    l.ponerEstado('invul', 0.25);
    l.accion = { hasta: luta.t + (h.dur ?? 0.12), bloquea: true, lento: 0 };
    luta.emit({ t: 'teleport', l, x0, y0, x1: p.x, y1: p.y, estilo: h.estilo });
    luta.emit({ t: 'sonido', n: 'dash' });
    // a Mega solta uma onda psíquica onde reaparece
    if (h.dano) areaCirculo(luta, l, p.x, p.y, h.radio ?? 36, pacote(h, extra, ang, { dirX: undefined, dirY: undefined, empuje: 60 }));
  }

  // ---------------------------------------------------------------- Psychic Lasso: um laço psíquico que, se prende, puxa e arremessa longe
  laco(l, h, extra) {
    const luta = this.luta;
    const ang = asistir(l, angApunte(l), h.alcance + 20, 0.6);
    l.animar(h.anim ?? 'Charge', 0.8);
    l.accion = { hasta: luta.t + 0.3, bloquea: true, lento: 0, angulo: ang };
    const la = {
      tipo: 'laco', dueno: l, vivo: true, x: l.x, y: l.y, ang, t: 0, d: 0, fase: 'va', preso: null, tipoAtq: h.tipo, radio: h.radio,
      update: dt => {
        la.t += dt;
        if (l.ko) return false;
        if (la.fase === 'va' || la.fase === 'vuelve') {
          la.d += (la.fase === 'va' ? h.vel : -h.vel * 1.6) * dt;
          if (la.fase === 'vuelve' && la.d <= 0) return false;
          if (la.d >= h.alcance) la.fase = 'vuelve';
          la.x = l.x + Math.cos(ang) * la.d; la.y = l.y + Math.sin(ang) * la.d;
          if (la.fase === 'va') for (const b of luta.blancos(l)) {
            if (b.oculto || b.est?.vuelo) continue;
            if (Math.hypot(b.x - la.x, b.y - la.y) >= la.radio + RADIO) continue;
            if (b.esClon) { atingir(l, b, {}); continue; }
            la.preso = b; la.fase = 'tira'; la.t2 = 0;
            atingir(l, b, pacote(h, extra, ang, { dano: h.dano * 0.3, aturde: (h.agarre ?? 0.4) + 0.3, empuje: 0 }));
            luta.emit({ t: 'lacoAgarra', x: b.x, y: b.y });
            l.accion = { hasta: luta.t + (h.agarre ?? 0.4) + 0.1, bloquea: true, lento: 0, angulo: ang };
            break;
          }
          return true;
        }
        if (la.fase === 'tira') {
          const b = la.preso;
          la.t2 += dt;
          if (b.ko) return false;
          // puxa o alvo para perto e o faz flutuar
          const tx = l.x + Math.cos(ang) * 34, ty = l.y + Math.sin(ang) * 22;
          const p = fijarCampo(b.x + (tx - b.x) * Math.min(1, dt * 7), b.y + (ty - b.y) * Math.min(1, dt * 7));
          b.x = p.x; b.y = p.y; b.vx = 0; b.vy = 0; b.empX = 0; b.empY = 0;
          b.salto = Math.round(Math.min(1, la.t2 / 0.2) * 14);
          la.x = b.x; la.y = b.y;
          if (la.t2 >= (h.agarre ?? 0.4)) {
            // arremessa para onde o jogador está mirando
            const a2 = angApunte(l);
            b.salto = 0;
            atingir(l, b, pacote(h, extra, a2, { dano: h.dano * 0.7, empuje: h.lanza ?? 220, aturde: h.aturde, pesado: true }));
            luta.emit({ t: 'lacoLanza', x: b.x, y: b.y, ang: a2 });
            luta.emit({ t: 'temblor', f: 0.012 });
            luta.hitstop(90);
            la.fase = 'suelta'; la.t3 = 0;
          }
          return true;
        }
        la.t3 += dt;
        return la.t3 < 0.2;
      },
    };
    luta.add(la);
    luta.emit({ t: 'sonido', n: 'disparo' });
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
    const luta = this.luta, ang = angApunte(l), mitad = rad(h.angulo) / 2, carga = h.carga ?? 0.15;
    l.animar(h.anim ?? 'Charge', carga + 0.3);
    l.accion = { hasta: luta.t + carga + 0.15, bloquea: true, lento: 0.2, angulo: ang };
    luta.programar(carga, () => {
      if (l.ko) return;
      luta.emit({ t: 'viento', x: l.x, y: l.y - l.alto * 0.4, ang, alcance: h.alcance, angulo: h.angulo, estilo: h.estilo, tipo: h.tipo });
      // como no site: a rajada desfaz os tiros inimigos dentro do cone
      for (const e of luta.entidades) {
        if (e.tipo !== 'proj' || e.dueno === l || e.vivo === false) continue;
        const dx = e.x - l.x, dy = e.y - l.y;
        if (Math.hypot(dx, dy) < h.alcance && Math.abs(difAng(Math.atan2(dy, dx), ang)) < mitad + 0.15) {
          e.vivo = false;
          luta.emit({ t: 'finProyectil', x: e.x, y: e.y, estilo: e.estilo, tipo: e.tipoAtq });
        }
      }
      for (const b of luta.blancos(l)) {
        if (b.oculto || b.est?.vuelo) continue;
        const dx = b.x - l.x, dy = b.y - l.y, d = Math.hypot(dx, dy) || 1;
        if (d < h.alcance + RADIO && Math.abs(difAng(Math.atan2(dy, dx), ang)) < mitad + 0.15) {
          const pegar = () => { if (!b.ko) atingir(l, b, pacote(h, extra, ang, { dirX: dx / d, dirY: dy / d, pesado: true })); };
          if (h.viaja) luta.programar(h.viaja * Math.min(1, d / h.alcance), pegar); else pegar();
        }
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
        // o terceiro golpe da Sneasler é o corte em X
        if (final && h.cruzX) luta.emit({ t: 'corteX', x: l.x + Math.cos(ang) * alcance * 0.55, y: l.y - l.alto * 0.5 + Math.sin(ang) * alcance * 0.4, ang, r: alcance * 0.6, tipo: h.tipo });
        else luta.emit({ t: 'tajo', l, ang, alcance, final, estilo: h.estilo, tipo: h.tipo, anguloArco: h.angulo });
        this.cortarProyectiles(l, ang, alcance, rad(h.angulo) / 2);
        for (const b of luta.blancos(l)) {
          const dx = b.x - l.x, dy = b.y - l.y, d = Math.hypot(dx, dy) || 1;
          if (b.oculto || b.est?.vuelo) continue;
          if (d < alcance + RADIO && Math.abs(difAng(Math.atan2(dy, dx), ang)) < rad(h.angulo) / 2) {
            const rem = final ? remate : null;
            const res = atingir(l, b, pacote(h, extra, ang, { dano: h.dano + (final ? 2 : 0) + (rem?.dano ?? 0), empuje: rem?.empuje ?? (final ? 70 : 22), aturde: rem?.aturde, dirX: dx / d, dirY: dy / d, pesado: final }));
            if (res === 'golpe' && i === 0 && !cierra) l.aciertosCombo++;
            // Dire Claw (Sneasler): o golpe que fecha a combinação deixa veneno, paralisia ou sono
            if (res === 'golpe' && final && h.estadoAleatorio && !b.esClon) estadoAleatorio(b, l);
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
      if (Math.hypot(dx, dy) < alcance + 10 && Math.abs(difAng(Math.atan2(dy, dx), ang)) < mitad + 0.25) {
        e.vivo = false;
        this.luta.emit({ t: 'finProyectil', x: e.x, y: e.y, estilo: e.estilo, tipo: e.tipoAtq });
        this.luta.emit({ t: 'texto', x: e.x, y: e.y - 14, txt: 'CUT', color: '#e5e7eb' });
      }
    }
  }

  // ---------------------------------------------------------------- golpe único com investida
  golpe(l, h, extra) {
    const luta = this.luta;
    // Aqua Tail: enquanto segura o botão, mira (andando devagar); ao soltar, bate
    if (h.segurar && !extra.solto) {
      let t = 0;
      l.animar(h.animCarga ?? 'Charge', h.segurar);
      l.accion = { hasta: luta.t + h.segurar + 0.1, lento: 0.35, angulo: angApunte(l),
        update: dt => { t += dt; l.accion.angulo = angApunte(l); if ((t > 0.08 && !l.intento?.[extra.slot]) || t >= h.segurar) { l.accion = null; this.golpe(l, h, { ...extra, solto: true }); } } };
      luta.emit({ t: 'anillo', x: l.x, y: l.y - l.alto * 0.5, color: '#7ad8ff', r: 14 });
      return;
    }
    const lanzar = h.lanzar ?? 0.14, emb = h.embestida ?? 30, r0 = l.rival;
    // almas gastas no golpe somam dano (porAlma); Last Respects (porFalta) bate mais forte quanto menos almas tem e enche todas
    const almas = h.porAlma ? l.almas ?? 0 : 0;
    if (h.porAlma) { l.almas = 0; if (almas) luta.emit({ t: 'almasSueltas', l, n: almas }); }
    const faltam = h.porFalta ? Math.max(0, (h.maxAlmas ?? 5) - (l.almas ?? 0)) : 0;
    if (h.porFalta) { l.almas = h.maxAlmas ?? 5; if (faltam) { l.texto(`+${faltam} SOULS`, '#c4b5fd'); luta.emit({ t: 'almasSueltas', l, n: faltam }); } }
    if (h.fantasma) luta.emit({ t: 'auraFantasma', l, dur: (h.lanzar ?? 0.14) + 0.3, tipo: h.tipo });
    const ang = asistir(l, angApunte(l), h.alcance + emb + 20, 1.2);
    // como no site: desliza até o alvo durante o lançamento (sem passar dele) e só então bate
    const d0 = r0 && !r0.ko ? Math.hypot(r0.x - l.x, r0.y - l.y) : 999;
    const avance = d0 < h.alcance + emb + 20 ? Math.max(0, Math.min(emb, d0 - 18)) : Math.min(emb, h.lanza ? Math.hypot(l.ax - l.x, l.ay - l.y) : h.avanza ? emb : 12);
    const x0 = l.x, y0 = l.y, p1 = fijarCampo(x0 + Math.cos(ang) * avance, y0 + Math.sin(ang) * avance);
    if (h.lanza || h.blindaje) l.ponerEstado('blindaje', lanzar + 0.15, { reduce: h.blindaje ?? 0.5 });
    l.animar(h.anim ?? 'Attack', lanzar + 0.3);
    let t = 0;
    l.accion = {
      hasta: luta.t + lanzar + 0.12, bloquea: true, lento: 0, angulo: ang,
      update: dt => { t += dt; if (t > lanzar) return; const k = t / lanzar; l.x = x0 + (p1.x - x0) * k; l.y = y0 + (p1.y - y0) * k; },
    };
    luta.programar(lanzar, () => {
      if (l.ko || l.est.aturdido) return;
      luta.emit({ t: 'tajo', l, ang, alcance: h.alcance, final: true, estilo: h.estilo ?? 'golpe', tipo: h.tipo, anguloArco: h.angulo ?? 120 });
      // cauda grande que dá uma volta inteira
      if (h.giraCola) { l.ponerEstado('girando', 0.4); luta.emit({ t: 'colaGigante', l, ang, r: h.alcance + 24 }); }
      this.cortarProyectiles(l, ang, h.alcance, rad(h.angulo ?? 120) / 2);
      const k = h.desesperado ? 1 + h.desesperado * (1 - l.hp / l.hpMax) : 1;
      const ox = l.x + Math.cos(ang) * 20, oy = l.y + Math.sin(ang) * 14;
      if (h.onda) luta.emit({ t: 'anillo', x: ox, y: oy, color: '#ffffff', r: h.onda + 6 });
      for (const b of luta.blancos(l)) {
        if (b.oculto || b.est?.vuelo) continue;
        const dx = b.x - l.x, dy = b.y - l.y, d = Math.hypot(dx, dy) || 1;
        const enOnda = h.onda && Math.hypot(b.x - ox, (b.y - oy) / 0.65) < h.onda + RADIO;
        if (enOnda || (d < h.alcance + RADIO && Math.abs(difAng(Math.atan2(dy, dx), ang)) < rad(h.angulo ?? 120) / 2)) {
          const res = atingir(l, b, pacote(h, extra, ang, { dano: h.dano * k + almas * (h.porAlma ?? 0) + faltam * (h.porFalta ?? 0), empuje: h.empuje ?? 50, castiga: h.castiga, disipa: h.disipa, dirX: dx / d, dirY: dy / d, pesado: true }));
          // Whirlpool Tail (Milotic): quem leva a rabada fica preso num redemoinho
          if (h.remolino && res === 'golpe' && !b.esClon) luta.programar(0.4, () => { if (l.ko || b.ko) return; this.torbellino(l, { ...h.remolino, curaPropia: 0 }, extra); const tb = luta.entidades.at(-1); tb.x = b.x; tb.y = b.y; l.accion = null; });
        }
      }
      // Aqua Tail (Veluza): a rabada joga as próprias torretas para outro lugar, riscando um laser no caminho
      if (h.mueveTorreta) for (const tr of luta.entidades) {
        if (tr.tipo !== 'torreta' || tr.dueno !== l || !tr.vivo) continue;
        const dx = tr.x - l.x, dy = tr.y - l.y, d = Math.hypot(dx, dy) || 1;
        if (d > h.alcance + 20 || Math.abs(difAng(Math.atan2(dy, dx), ang)) > rad(h.angulo ?? 120) / 2 + 0.2) continue;
        const p = fijarCampo(tr.x + Math.cos(ang) * h.mueveTorreta, tr.y + Math.sin(ang) * h.mueveTorreta);
        this.laserTorreta(l, h, extra, tr.x, tr.y, p.x, p.y);
        tr.x = p.x; tr.y = p.y;
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
    luta.add(new Marcas(luta, l, h, extra, puntos, { aviso: 0.3, cada: h.cada, radio: h.radio, estilo: h.estilo ?? 'erupcion' }));
    luta.emit({ t: 'avisos', puntos, aviso: 0.3, radio: h.radio, tipo: h.tipo });
  }

  // ---------------------------------------------------------------- raízes em ondas (Frenzy Plant)
  plantaFeroz(l, h, extra) {
    const luta = this.luta;
    const ang = asistir(l, angApunte(l), 140, 1.2);
    l.animar(h.anim ?? 'Charge', 0.9);
    l.accion = { hasta: luta.t + (h.carga ?? 0.3) + h.ondas.length * h.cada, lento: 0.2, angulo: ang };
    // Moonblast Concert (Mega Altaria): continua cantando e, depois de um intervalo, solta outra onda
    if (h.repite) {
      const total = (h.carga ?? 0.3) + h.ondas.length * h.cada, tras = h.repite;
      l.accion.hasta = luta.t + total + tras + 0.05; l.accion.bloquea = true; l.accion.lento = 0.3;
      for (let k = 0; k < 4; k++) luta.programar(total + (k * tras) / 4, () => { if (!l.ko) luta.emit({ t: 'ondaSonora', x: l.x, y: l.y - l.alto * 0.6, l }); });
      luta.programar(total + tras, () => { if (!l.ko && !l.est.aturdido) { l.accion = null; this.plantaFeroz(l, { ...h, repite: 0 }, extra); } });
    }
    if (h.escudo) { l.escudo = h.escudo; l.ponerEstado('escudo', h.escudoDur ?? 4); }
    // como no site: a área é uma elipse (perspectiva do chão); a 1ª onda pega tudo que está dentro e as
    // outras pegam quem estiver na faixa da onda. Cada alvo leva o golpe inteiro (dano e atordoamento) uma vez só.
    const x0 = l.x, y0 = l.y, atingidos = new Set();
    if (h.estilo !== 'sonido') luta.emit({ t: 'zonaRaiz', x: x0, y: y0, radio: h.ondas.at(-1) + h.banda / 2, dur: (h.carga ?? 0.3) + h.ondas.length * h.cada });
    h.ondas.forEach((dd, i) => {
      luta.programar((h.carga ?? 0.3) + i * h.cada, () => {
        if (l.ko) return;
        luta.emit({ t: h.estilo === 'sonido' ? 'ondaSonora' : 'raices', x: x0, y: y0, ang, dist: dd, banda: h.banda, onda: i, tipo: h.tipo });
        for (const b of luta.blancos(l)) {
          if (atingidos.has(b) || b.est?.vuelo) continue;
          const dx = b.x - x0, dy = b.y - y0, d = Math.hypot(dx, dy / 0.62);
          const dentro = i === 0 ? d < dd + h.banda / 2 + RADIO : Math.abs(d - dd) < h.banda / 2 + RADIO;
          if (!dentro) continue;
          atingidos.add(b);
          const dl = Math.hypot(dx, dy) || 1;
          atingir(l, b, pacote(h, extra, Math.atan2(dy / dl, dx / dl), { aturde: h.aturde, empuje: 12, pesado: true }));
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

  // ---------------------------------------------------------------- Splash (Magikarp): não acontece nada... mas a exp para evoluir enche
  chapoteo(l, h) {
    const luta = this.luta, saltos = h.saltos ?? 4, cada = h.dur / saltos;
    let t = 0;
    l.ponerEstado('invul', h.dur);
    l.accion = { hasta: luta.t + h.dur, bloquea: true, lento: 0, update: dt => { t += dt; l.salto = Math.round(Math.abs(Math.sin((t / cada) * Math.PI)) * 12); }, fin: () => { l.salto = 0; } };
    for (let i = 0; i < saltos; i++) luta.programar(i * cada, () => { if (l.ko) return; l.animar(h.anim ?? 'Hop', cada); luta.emit({ t: 'chapoteo', x: l.x, y: l.y }); luta.emit({ t: 'sonido', n: 'disparo' }); });
    luta.programar(h.dur * 0.55, () => { if (!l.ko) luta.emit({ t: 'anuncio', txt: 'BUT NOTHING HAPPENED!', color: '#bfe9ff', tam: 16, dur: 1.1 }); });
    luta.programar(h.dur, () => { if (!l.ko && l.etapa < l.etapasTotales - 1) l.ganarExp(l.expNecesaria); });
  }

  // ---------------------------------------------------------------- Dragon Dance: acumula força, velocidade e cadência
  potenciar(l, h) {
    const luta = this.luta, max = h.acumula ?? 1, n = Math.min(max, (l.est.potencia?.n ?? 0) + 1), pn = h.porNivel ?? {};
    // como no site: força e cadência sobem por nível, velocidade é fixa, e no nível máximo o básico não esquenta
    l.ponerEstado('potencia', h.dur ?? 6, { n, mult: (pn.mult ?? 0) * n, cadencia: 1 + (pn.cadencia ?? 0) * n, vel: pn.vel ?? 0, calor: n >= max ? 0 : 1, reduce: 0, color: '#a78bfa' });
    l.animar(h.anim ?? 'Charge', 0.6);
    l.accion = { hasta: luta.t + (h.quieto ?? 0.4), bloquea: true, lento: 0.3 };
    l.texto(`${h.texto ?? 'POWER UP'} x${n}${n >= max ? '!' : ''}`, '#c4b5fd');
    luta.emit({ t: 'potenciar', l, tipo: h.tipo, n });
    luta.emit({ t: 'sonido', n: 'cura' });
  }

  // ---------------------------------------------------------------- Harden: escudo que absorve dano
  escudo(l, h) {
    const luta = this.luta;
    const almas = h.porAlma ? l.almas ?? 0 : 0;
    if (h.porAlma) l.almas = 0;
    l.escudo = Math.max(l.escudo ?? 0, ((h.absorbe ?? 10) + almas * (h.porAlma ?? 0)) * (REGLAS.vidaGlobal ?? 1));
    l.ponerEstado('escudo', h.dur ?? 2.5, { estilo: h.estilo, stamina: h.stamina });
    l.animar(h.anim ?? 'Withdraw', 0.5);
    l.accion = { hasta: luta.t + 0.3, lento: h.lento ?? 0.5 };
    if (h.texto) l.texto(h.texto, '#d6dbe4');
    // Barrier (Mewtwo): além do escudo, fica mais rápido
    if (h.acelera) l.ponerEstado('rapido', h.acelera.dur, { vel: h.acelera.vel });
    luta.emit({ t: 'endurecer', l, estilo: h.estilo });
    // Cotton Guard (Altaria): quando acaba, o algodão é arremessado no rival e deixa lento
    if (h.lanza) luta.programar(h.dur ?? 2.5, () => {
      const r = l.rival;
      if (l.ko || !r || r.ko) return;
      const a = Math.atan2(r.y - l.y, r.x - l.x);
      luta.add(new Proyectil(luta, l, { forma: 'proyectil', estilo: 'algodonProj', tipo: h.tipo, radio: 7, escala: 1.4, teledirigido: 1.5, ...h.lanza }, a, { slot: 'q', desde: { x: l.x, y: l.y, alt: l.alto * 0.5 } }));
    });
  }

  // ---------------------------------------------------------------- Barrier (Mewtwo): bolha que bloqueia tudo e desfaz os tiros que encostam
  // Dura h.dur; atacar estoura a bolha na hora. Também deixa mais rápido.
  burbuja(l, h) {
    const luta = this.luta, desde = luta.t, dur = h.dur ?? 1.8;
    l.burbuja?.romper(false);
    l.ponerEstado('bloqueo', dur, { burbuja: true });
    if (h.acelera) l.ponerEstado('rapido', h.acelera.dur, { vel: h.acelera.vel });
    l.animar(h.anim ?? 'Charge', 0.3);
    const b = {
      tipo: 'burbuja', dueno: l, h, vivo: true, t: 0, x: l.x, y: l.y, radio: h.radio ?? 22,
      romper: ruido => {
        if (!b.vivo) return false;
        b.vivo = false;
        if (l.est.bloqueo?.burbuja) delete l.est.bloqueo;
        if (l.burbuja === b) l.burbuja = null;
        if (ruido) luta.emit({ t: 'burbujaRompe', l });
        return false;
      },
      update: dt => {
        b.t += dt; b.x = l.x; b.y = l.y;
        if (l.ko) return b.romper(false);
        if (l.ultimoAtaque > desde + 1e-6 || b.t >= dur) return b.romper(true);
        for (const e of luta.entidades) {
          if (e.tipo !== 'proj' || e.dueno === l || e.vivo === false || Math.hypot(e.x - l.x, e.y - l.y) >= b.radio + 4) continue;
          e.vivo = false;
          luta.emit({ t: 'finProyectil', x: e.x, y: e.y, estilo: e.estilo, tipo: e.tipoAtq });
        }
        return true;
      },
    };
    l.burbuja = b;
    luta.add(b);
    luta.emit({ t: 'endurecer', l, estilo: 'barrera' });
  }

  // ---------------------------------------------------------------- Explosion: carrega, explode em volta e tira um pouco da própria vida
  explosion(l, h, extra) {
    const luta = this.luta, c = h.carga ?? 0.6;
    l.animar(h.anim ?? 'Charge', c + 0.2);
    l.accion = { hasta: luta.t + c + 0.15, bloquea: true, lento: 0 };
    luta.emit({ t: 'cargaExplosion', l, dur: c });
    luta.programar(c, () => {
      if (l.ko) return;
      areaCirculo(luta, l, l.x, l.y, h.radio, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, pesado: true, empuje: 150 }));
      luta.emit({ t: 'autoExplosion', x: l.x, y: l.y, radio: h.radio });
      luta.emit({ t: 'temblor', f: 0.02 });
      luta.hitstop(60);
      if (h.autodano) l.hp = Math.max(1, l.hp - l.hpMax * h.autodano);
    });
  }

  // ---------------------------------------------------------------- Grass Knot: armadilha no chão que prende quem pisa
  trampa(l, h, extra) {
    const luta = this.luta, ang = angApunte(l), d = Math.min(h.alcance, Math.hypot(l.ax - l.x, l.ay - l.y));
    const p = fijarCampo(l.x + Math.cos(ang) * d, l.y + Math.sin(ang) * d);
    const mias = luta.entidades.filter(e => e.tipo === 'trampa' && e.dueno === l && e.vivo);
    if (mias.length >= (h.max ?? 2)) mias[0].vivo = false;
    l.animar(h.anim ?? 'Charge', 0.3);
    l.accion = { hasta: luta.t + 0.2, lento: 0.3 };
    const tr = {
      tipo: 'trampa', dueno: l, vivo: true, x: p.x, y: p.y, radio: h.radio, t: 0, arma: h.arma ?? 0.4, dur: h.dur ?? 8, tipoAtq: h.tipo,
      update: dt => {
        tr.t += dt;
        if (!tr.vivo || tr.t >= tr.dur || l.ko) return false;
        if (tr.t < tr.arma) return true;
        for (const b of luta.blancos(l)) {
          if (b.oculto || b.est?.vuelo || b.salto > 0) continue;
          if (Math.hypot(b.x - tr.x, b.y - tr.y) < tr.radio + RADIO) {
            atingir(l, b, pacote(h, extra, Math.atan2(b.y - tr.y, b.x - tr.x), { empuje: 0 }));
            luta.emit({ t: 'trampaSalta', x: tr.x, y: tr.y });
            return (tr.vivo = false);
          }
        }
        return true;
      },
    };
    luta.add(tr);
  }

  // ---------------------------------------------------------------- Leaf Tornado: um redemoinho que anda atrás do alvo e puxa
  torbellino(l, h, extra) {
    const luta = this.luta;
    let ang = angApunte(l);
    const vida = h.alcance / h.vel, cada = h.tick ?? 0.2, porTick = h.dano / Math.max(1, Math.round(vida / cada));
    if (h.curaPropia) { l.cura(h.curaPropia * l.hpMax); luta.emit({ t: 'aquaRing', l }); }
    l.animar(h.anim ?? 'Charge', 0.5);
    l.accion = { hasta: luta.t + 0.3, lento: 0.3, angulo: ang };
    const tb = {
      tipo: 'torbellino', estilo: h.estilo, dueno: l, vivo: true, x: l.x + Math.cos(ang) * 20, y: l.y + Math.sin(ang) * 20, radio: h.radio, t: 0, acum: 0, tipoAtq: h.tipo, vida,
      update: dt => {
        tb.t += dt;
        if (l.ko || tb.t >= vida) {
          for (const b of luta.blancos(l)) { const dx = b.x - tb.x, dy = b.y - tb.y, d = Math.hypot(dx, dy) || 1; if (d < tb.radio + RADIO && !b.esClon) { b.empX += (dx / d) * (h.suelta ?? 80) * 3; b.empY += (dy / d) * (h.suelta ?? 80) * 3; } }
          return false;
        }
        const r = l.rival;
        if (r && !r.ko && !r.oculto) { const quiere = Math.atan2(r.y - tb.y, r.x - tb.x); ang += clamp(difAng(quiere, ang), -(h.persigue ?? 1.5) * dt, (h.persigue ?? 1.5) * dt); }
        const p = fijarCampo(tb.x + Math.cos(ang) * h.vel * dt, tb.y + Math.sin(ang) * h.vel * dt);
        tb.x = p.x; tb.y = p.y;
        tb.acum += dt;
        const golpea = tb.acum >= cada;
        if (golpea) tb.acum -= cada;
        for (const b of luta.blancos(l)) {
          if (b.oculto || b.est?.vuelo) continue;
          const dx = tb.x - b.x, dy = tb.y - b.y, d = Math.hypot(dx, dy) || 1;
          if (d > tb.radio + RADIO) continue;
          if (!b.esClon) { b.empX += (dx / d) * (h.tiron ?? 80) * dt * 6; b.empY += (dy / d) * (h.tiron ?? 80) * dt * 6; }
          if (golpea) atingir(l, b, pacote(h, extra, Math.atan2(-dy, -dx), { dano: porTick, empuje: 0, tick: true }));
        }
        return true;
      },
    };
    luta.add(tb);
    luta.emit({ t: 'sonido', n: 'disparo' });
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
    // como no site: sobe e some, a mira sai do cursor e o segue a h.sigue px/s durante o aviso,
    // trava vermelha por um instante e o lutador cai ali. Com h.choque, errar machuca quem caiu.
    const luta = this.luta, subida = 0.3, fijar = 0.15, bajada = 0.14, total = subida + h.aviso + fijar + bajada;
    const marca = fijarCampo(l.ax, l.ay);
    l.animar(h.anim ?? 'Hop', subida);
    l.ponerEstado('vuelo', total + 0.05, { oculto: false, rapidez: 0, modo: 'meteoro' });
    l.ponerEstado('invul', total);
    l.accion = { hasta: luta.t + total, bloquea: true, lento: 0, angulo: l.angulo };
    let t = 0, bajaDesde = 0;
    const ent = {
      tipo: 'meteoro', dueno: l, h, tipoAtq: h.tipo, vivo: true, x: marca.x, y: marca.y, radio: h.radio, fase: 'sube', k: 0,
      update: dt => {
        if (l.ko) { l.salto = 0; if (l.est.vuelo) l.est.vuelo.oculto = false; return false; }
        t += dt;
        if (ent.fase === 'sube') {
          const k = Math.min(1, t / subida);
          l.salto = Math.round(h.alto * k * k); ent.k = k;
          if (k >= 1) { ent.fase = 'apunta'; if (l.est.vuelo) l.est.vuelo.oculto = true; }
        } else if (ent.fase === 'apunta') {
          const c = fijarCampo(l.ax, l.ay), dx = c.x - marca.x, dy = c.y - marca.y, dd = Math.hypot(dx, dy), paso = (h.sigue ?? 150) * dt;
          if (dd > paso) { marca.x += (dx / dd) * paso; marca.y += (dy / dd) * paso; } else { marca.x = c.x; marca.y = c.y; }
          ent.k = Math.min(1, (t - subida) / h.aviso);
          if (t >= subida + h.aviso) ent.fase = 'fija';
        } else if (ent.fase === 'fija') {
          ent.k = 1;
          if (t >= subida + h.aviso + fijar) { ent.fase = 'baja'; bajaDesde = t; l.x = marca.x; l.y = marca.y; if (l.est.vuelo) l.est.vuelo.oculto = false; }
        } else {
          const k = Math.min(1, (t - bajaDesde) / bajada);
          l.salto = Math.round(h.alto * (1 - k));
          if (k >= 1) { aterrizar(); return false; }
        }
        ent.x = marca.x; ent.y = marca.y;
        return true;
      },
    };
    const aterrizar = () => {
      l.salto = 0; delete l.est.vuelo; delete l.est.invul;
      const x = l.x, y = l.y, r = l.rival;
      luta.emit({ t: 'pulso', x, y, radio: h.radio, tipo: h.tipo, estilo: h.estilo === 'rayo' ? 'electrico' : 'aterrizaje' });
      luta.emit({ t: 'temblor', f: h.radio >= 44 ? 0.02 : 0.013 });
      // Thunder Crash: raios caem em volta do impacto
      if (h.estilo === 'rayo') luta.emit({ t: 'tormentaImpacto', x, y, radio: h.radio });
      if (r && !r.ko && !r.est.vuelo && Math.hypot(r.x - x, (r.y - y) / 0.65) < h.radio + RADIO) {
        const dx = r.x - x, dy = r.y - y, d = Math.hypot(dx, dy) || 1;
        atingir(l, r, pacote(h, extra, 0, { empuje: 70, aturde: h.aturde, dirX: dx / d, dirY: dy / d, pesado: true }));
      } else if (h.choque) {
        l.texto('CRASH!', '#fca5a5');
        l.recibir(l, { dano: h.choque, tipo: 'NORMAL', puro: true });
        l.ponerEstado('aturdido', 0.4);
      }
      // clones também caem com o impacto
      for (const b of luta.blancos(l)) if (b.esClon && Math.hypot(b.x - x, (b.y - y) / 0.65) < h.radio + RADIO) atingir(l, b, pacote(h, extra, 0, {}));
      // Pancake: quem está perto é puxado para o lugar do impacto
      if (h.atrae) {
        for (const b of luta.blancos(l)) {
          if (b.esClon || b.oculto || b.est?.vuelo) continue;
          const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy) || 1;
          if (d < h.atrae && d > 8) { b.empX += (dx / d) * (h.tiron ?? 60) * 5; b.empY += (dy / d) * (h.tiron ?? 60) * 5; }
        }
        luta.emit({ t: 'succion', x, y, radio: h.atrae });
      }
    };
    luta.add(ent);
  }

  // ---------------------------------------------------------------- Dig / Fly: some e reaparece
  vuelo(l, h, extra) {
    const luta = this.luta;
    const tierra = h.modo === 'tierra' || h.modo === 'fantasma';
    l.animar(h.anim ?? 'Hop', 0.3);
    l.ponerEstado('vuelo', h.dur, { oculto: tierra, rapidez: h.rapidez ?? 1.5, modo: h.modo === 'fantasma' ? 'fantasma' : tierra ? 'tierra' : 'aire' });
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

  // ---------------------------------------------------------------- patada saltada (Jump Kick, Body Slam), como no site
  // Pula no rival se ele está perto e na frente da mira (senão, até a mira) e só acerta se cair em cima dele.
  // Com h.choque (High Jump Kick), errar machuca e atordoa quem pulou.
  patada(l, h, extra) {
    const luta = this.luta, r0 = l.rival, apunte = angApunte(l);
    const sobre = r0 && !r0.ko && !r0.oculto && Math.hypot(r0.x - l.x, r0.y - l.y) < h.alcance + 30 && Math.abs(difAng(Math.atan2(r0.y - l.y, r0.x - l.x), apunte)) < 1;
    const ang = sobre ? Math.atan2(r0.y - l.y, r0.x - l.x) : apunte;
    const d = sobre ? Math.max(0, Math.min(h.alcance, Math.hypot(r0.x - l.x, r0.y - l.y) - 6)) : Math.min(h.alcance, Math.hypot(l.ax - l.x, l.ay - l.y));
    const x0 = l.x, y0 = l.y, p1 = fijarCampo(x0 + Math.cos(ang) * d, y0 + Math.sin(ang) * d);
    const vuelo = 0.26 + d / 700, arco = 16 + d * 0.1;
    if (h.blindaje) l.ponerEstado('blindaje', vuelo + 0.2, { reduce: h.blindaje });
    l.animar(h.anim ?? 'Hop', vuelo);
    l.angulo = ang;
    let t = 0;
    l.accion = {
      hasta: luta.t + vuelo, bloquea: true, lento: 0, angulo: ang,
      update: dt => { t += dt; const k = Math.min(1, t / vuelo); l.x = x0 + (p1.x - x0) * k; l.y = y0 + (p1.y - y0) * k; l.salto = Math.round(Math.sin(k * Math.PI) * arco); },
      fin: () => {
        l.salto = 0;
        if (l.ko) return;
        l.animar(h.animGolpe ?? 'Attack', 0.25);
        luta.emit({ t: 'pulso', x: l.x, y: l.y, radio: h.radio, tipo: h.tipo, estilo: 'patada' });
        const r = l.rival;
        if (h.congela) luta.emit({ t: 'pulso', x: l.x, y: l.y, radio: h.radio, tipo: 'ICE', estilo: 'hielo' });
        const acerto = r && !r.ko && !r.est.vuelo && Math.hypot(r.x - l.x, r.y - l.y) < h.radio + RADIO;
        if (acerto) {
          const res = atingir(l, r, pacote(h, extra, ang, { empuje: h.congela ? 0 : 80, aturde: h.aturde, dirX: Math.cos(ang), dirY: Math.sin(ang), pesado: true }));
          // Ice Jump (Milotic): quem estava na área fica congelado um instante
          if (h.congela && res === 'golpe') { r.ponerEstado('aturdido', h.congela); r.ponerEstado('congelado', h.congela); r.texto('FROZEN!', '#bfe9ff'); }
          luta.emit({ t: 'temblor', f: 0.008 });
        }
        // Mega Lopunny: pula de novo em cima do rival até acabar a cadeia
        if (h.cadena > 1 && !l.ko) { l.accion = null; luta.programar(0.05, () => { if (!l.ko) { const r2 = l.rival; if (r2) { l.ax = r2.x; l.ay = r2.y; } this.patada(l, { ...h, cadena: h.cadena - 1, dano: h.cadena === 2 ? h.dano * 1.6 : h.dano, radio: h.cadena === 2 ? h.radio * 1.4 : h.radio }, extra); } }); luta.emit({ t: 'corazones', x: l.x, y: l.y - 10 }); }
        else if (h.choque && !acerto) {
          l.texto('CRASH!', '#fca5a5');
          l.recibir(l, { dano: h.choque, tipo: 'NORMAL', puro: true });
          l.ponerEstado('aturdido', 0.35);
          luta.emit({ t: 'temblor', f: 0.006 });
        }
      },
    };
  }

  // ---------------------------------------------------------------- Bounce (Gyarados): pula, cai e bate em volta do ponto de queda
  salto(l, h, extra) {
    const luta = this.luta, r0 = l.rival, apunte = angApunte(l);
    const sobre = r0 && !r0.ko && !r0.oculto && Math.hypot(r0.x - l.x, r0.y - l.y) < h.alcance + 25 && Math.abs(difAng(Math.atan2(r0.y - l.y, r0.x - l.x), apunte)) < 1.2;
    const ang = sobre ? Math.atan2(r0.y - l.y, r0.x - l.x) : apunte;
    const d = sobre ? Math.min(h.alcance + 10, Math.hypot(r0.x - l.x, r0.y - l.y)) : Math.min(h.alcance, Math.hypot(l.ax - l.x, l.ay - l.y));
    const x0 = l.x, y0 = l.y, { x: x1, y: y1 } = limitarCampo(x0 + Math.cos(ang) * d, y0 + Math.sin(ang) * d);
    const vuelo = 0.32, nube = 0.45, golpes = h.golpes ?? 1;
    let t = 0;
    l.animar(h.anim ?? 'Hop', vuelo);
    l.angulo = ang;
    l.accion = {
      hasta: luta.t + vuelo + nube, bloquea: true, lento: 0, angulo: ang,
      update: dt => { t += dt; if (t <= vuelo) { const k = t / vuelo; l.x = x0 + (x1 - x0) * k; l.y = y0 + (y1 - y0) * k; l.salto = Math.round(Math.sin(k * Math.PI) * 20); } else l.salto = 0; },
      fin: () => { l.salto = 0; },
    };
    luta.programar(vuelo, () => {
      if (l.ko) return;
      l.salto = 0;
      l.animar('Attack', nube);
      luta.emit({ t: 'pulso', x: x1, y: y1, radio: h.radio, tipo: h.tipo, estilo: h.estilo === 'agua' ? 'agua' : 'patada' });
      if (h.estilo === 'agua') luta.emit({ t: 'chapoteo', x: x1, y: y1 });
      luta.emit({ t: 'temblor', f: 0.004 });
      for (let i = 0; i < golpes; i++) luta.programar(i * 0.15, () => {
        const r = l.rival;
        if (l.ko || !r || r.ko || r.est.vuelo || Math.hypot(r.x - x1, r.y - y1) >= h.radio + RADIO) return;
        const ultimo = i === golpes - 1, dx = r.x - x1, dy = r.y - y1, dd = Math.hypot(dx, dy) || 1;
        atingir(l, r, pacote(h, extra, ang, {
          dano: h.dano / golpes, empuje: ultimo ? 50 : 10, dirX: dx / dd, dirY: dy / dd, tick: i > 0 && !ultimo, pesado: ultimo && !!h.aturde,
          ralentiza: ultimo && h.ralentiza ? { f: h.ralentiza, dur: h.ralentizaDur ?? 1.5 } : undefined, aturde: ultimo ? h.aturde : undefined,
        }));
      });
    });
  }

  // ---------------------------------------------------------------- Rest
  descanso(l, h) {
    const luta = this.luta;
    l.animar('Sleep', h.dur);
    l.ponerEstado('dormido', h.dur, { cura: (h.cura * l.hpMax) / h.dur, acum: 0, refleja: h.refleja ?? 0 });
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
  // ---------------------------------------------------------------- corte em X da Sneasler (Dire Claw) depois de cada skill
  esperarX(l, n = 0) {
    this.luta.programar(0.05, () => {
      if (l.ko || l.est.aturdido || l.est.dormido) return;
      if ((l.accion || l.dash || l.est.vuelo) && n < 50) return this.esperarX(l, n + 1);
      this.corteX(l);
    });
  }

  corteX(l) {
    const luta = this.luta, h = l.kit.lmb, r = l.rival, alcance = (h.alcance ?? 50) + 8;
    const ang = r && !r.ko && !r.oculto && dist(r, l) < alcance + 50 ? Math.atan2(r.y - l.y, r.x - l.x) : l.angulo ?? 0;
    l.angulo = ang;
    l.animar(h.animFinal ?? 'Strike', 0.25);
    luta.emit({ t: 'corteX', x: l.x + Math.cos(ang) * alcance * 0.55, y: l.y - l.alto * 0.5 + Math.sin(ang) * alcance * 0.4, ang, r: alcance * 0.6, tipo: h.tipo });
    this.cortarProyectiles(l, ang, alcance, rad(h.angulo ?? 150) / 2);
    for (const b of luta.blancos(l)) {
      if (b.oculto || b.est?.vuelo) continue;
      const dx = b.x - l.x, dy = b.y - l.y, d = Math.hypot(dx, dy) || 1;
      if (d < alcance + RADIO && Math.abs(difAng(Math.atan2(dy, dx), ang)) < rad(h.angulo ?? 150) / 2) {
        const res = atingir(l, b, pacote(h, { slot: 'lmb' }, ang, { dano: h.dano + 2, empuje: 60, dirX: dx / d, dirY: dy / d, pesado: true }));
        if (res === 'golpe' && !b.esClon) estadoAleatorio(b, l);
      }
    }
  }

  // ---------------------------------------------------------------- Gunk Shot (Sneasler): lança lodo em arco, pula atrás e rasga o chão com garras gigantes
  gunkShot(l, h, extra) {
    const luta = this.luta, lanzar = h.lanzar ?? 0.16, ang = angApunte(l), r = l.rival;
    let tx, ty;
    if (r && !r.ko && !r.oculto && dist(r, l) <= h.alcance + 40) { tx = r.x; ty = r.y; }
    else { const d = Math.min(h.alcance, Math.hypot(l.ax - l.x, l.ay - l.y)); tx = l.x + Math.cos(ang) * d; ty = l.y + Math.sin(ang) * d; }
    const p = fijarCampo(tx, ty), x0 = l.x, y0 = l.y, total = lanzar + h.vuelo;
    l.animar(h.anim ?? 'Shoot', lanzar + 0.1);
    l.ponerEstado('invul', total + 0.1);
    let t = 0, pulo = false;
    l.accion = {
      hasta: luta.t + total + 0.05, bloquea: true, lento: 0, angulo: ang,
      update: dt => {
        t += dt;
        const s = Math.max(0, Math.min(1, (t - lanzar - h.vuelo * 0.3) / (h.vuelo * 0.7)));
        if (s <= 0) return;
        if (!pulo) { pulo = true; l.animar('Hop', h.vuelo * 0.7); luta.emit({ t: 'dash', l, def: { estilo: h.estilo, tipo: h.tipo } }); }
        l.x = x0 + (p.x - x0) * s; l.y = y0 + (p.y - y0) * s; l.salto = Math.round(Math.sin(s * Math.PI) * 30);
      },
      fin: () => { l.salto = 0; },
    };
    luta.programar(lanzar, () => {
      if (l.ko) return;
      let tb = 0;
      const bomba = {
        tipo: 'bomba', dueno: l, estilo: 'lodo', tipoAtq: h.tipo, x: x0, y: y0, alt: 0, h, objetivo: p, vivo: true, escala: 1.6,
        update: dt => {
          tb += dt;
          const k = Math.min(1, tb / h.vuelo);
          bomba.x = x0 + (p.x - x0) * k; bomba.y = y0 + (p.y - y0) * k;
          bomba.alt = Math.sin(k * Math.PI) * h.alto + l.alto * 0.5 * (1 - k);
          if (k < 1) return true;
          areaCirculo(luta, l, p.x, p.y, h.radio, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, pesado: true, empuje: 40 }));
          luta.emit({ t: 'explosion', x: p.x, y: p.y - 6, radio: h.radio, tipo: h.tipo });
          luta.emit({ t: 'temblor', f: 0.01 });
          this.garras(l, h, extra, p.x, p.y, ang);
          return false;
        },
      };
      luta.add(bomba);
    });
  }

  // três rasgos de garra no chão que machucam e envenenam quem pisa
  garras(l, h, extra, cx, cy, ang) {
    const luta = this.luta, G = h.garras, a = ang + Math.PI / 2 + 0.5, ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
    const lineas = [-1, 0, 1].map(i => {
      const ox = cx + px * i * (G.sep ?? 22), oy = cy + py * i * (G.sep ?? 22) * 0.62, L = G.largo * (i ? 0.85 : 1) / 2;
      const p0 = fijarCampo(ox - ca * L, oy - sa * L * 0.62), p1 = fijarCampo(ox + ca * L, oy + sa * L * 0.62);
      return { x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y };
    });
    luta.emit({ t: 'garras', lineas, dur: G.dur, tipo: h.tipo });
    for (const s2 of lineas) luta.emit({ t: 'trazo', x0: s2.x0, y0: s2.y0 - 10, x1: s2.x1, y1: s2.y1 - 10, tipo: h.tipo, estilo: h.estilo });
    let t = 0, prox = 0;
    luta.add({
      tipo: 'garras', dueno: l, vivo: true, x: cx, y: cy,
      update: dt => {
        t += dt;
        if (t >= G.dur || l.ko) return false;
        if (t < prox) return true;
        prox = t + (G.cada ?? 0.45);
        for (const b of luta.blancos(l)) {
          if (b.oculto || b.est?.vuelo || b.salto > 0) continue;
          if (!lineas.some(s2 => distSegmento(b.x, b.y, s2.x0, s2.y0, s2.x1, s2.y1) < (G.ancho ?? 9) + RADIO)) continue;
          atingir(l, b, pacote(h, extra, 0, { dano: G.dano, empuje: 0, tick: true, aturde: undefined }));
        }
        return true;
      },
    });
  }

  embestidas(l, h, extra) {
    // como no site: um centro fixo onde a mira aponta (que segue um pouco o rival a cada passada);
    // cada passada nasce a ~70 px em diagonal, cruza o centro e passa dele. Invulnerável o tempo todo.
    const luta = this.luta, dur = h.dur ?? 0.16, pausa = Math.max(0.12, h.pausa ?? 0.08), total = h.golpes * (dur + pausa) + 0.05;
    l.ponerEstado('invul', total + 0.1);
    const a0 = angApunte(l), d0 = Math.max(40, Math.min(h.alcance ?? 160, Math.hypot(l.ax - l.x, l.ay - l.y)));
    const centro = fijarCampo(l.x + Math.cos(a0) * d0, l.y + Math.sin(a0) * d0);
    let t = 0, i = -1, t0 = 0, x0 = l.x, y0 = l.y, x1 = l.x, y1 = l.y, golpeado = false;
    const nueva = () => {
      i++; golpeado = false; t0 = t;
      const r = l.rival, sigue = h.sigue ?? 30;
      if (i > 0 && r && !r.ko && sigue > 0) {
        const dx = r.x - centro.x, dy = r.y - centro.y, d = Math.hypot(dx, dy);
        if (d > 1) { const k = Math.min(1, sigue / d); centro.x += dx * k; centro.y += dy * k; }
      }
      let a = Math.atan2(centro.y - l.y, centro.x - l.x);
      if (h.cruz) a += ((i % 2 ? 1 : -1) * Math.PI) / 4;
      else if (i > 0) a += (i % 2 ? 1 : -1) * 0.6;
      if (h.cruz || i > 0) { const p = fijarCampo(centro.x - Math.cos(a) * (h.cruz ? 70 : 80), centro.y - Math.sin(a) * (h.cruz ? 70 : 80)); l.x = p.x; l.y = p.y; }
      x0 = l.x; y0 = l.y;
      const fin = fijarCampo(centro.x + Math.cos(a) * (h.pasa ?? 50), centro.y + Math.sin(a) * (h.pasa ?? 50));
      x1 = fin.x; y1 = fin.y;
      if (l.accion) l.accion.angulo = Math.atan2(y1 - y0, x1 - x0);
      luta.emit({ t: 'cruz', x: centro.x, y: centro.y - 10, ang: Math.atan2(y1 - y0, x1 - x0), tipo: h.tipo, largo: 20 });
      luta.emit({ t: 'trazo', x0, y0: y0 - l.alto * 0.5, x1, y1: y1 - l.alto * 0.5, tipo: h.tipo, estilo: h.estilo });
      luta.emit({ t: 'dash', l, def: { estilo: h.estilo, tipo: h.tipo } });
    };
    l.animar(h.anim ?? 'Attack', total);
    l.accion = {
      hasta: luta.t + total, bloquea: true, lento: 0,
      update: dt => {
        t += dt;
        if (i < 0 || (t - t0 >= dur + pausa && i + 1 < h.golpes)) nueva();
        const k = Math.min(1, (t - t0) / dur);
        l.x = x0 + (x1 - x0) * k; l.y = y0 + (y1 - y0) * k;
        if (k < 1) l.angulo = Math.atan2(y1 - y0, x1 - x0);
        const r = l.rival;
        if (!golpeado && k < 1 && r && !r.ko && !r.est.vuelo && Math.hypot(r.x - l.x, r.y - l.y) < RADIO * 2 + 8) {
          golpeado = true;
          const ultimo = i === h.golpes - 1, dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
          atingir(l, r, pacote(h, extra, Math.atan2(dy, dx), { dano: h.dano * (ultimo ? 1.5 : 1), aturde: ultimo ? h.aturdeFinal : undefined, empuje: ultimo ? 70 : 30, dirX: dx / d, dirY: dy / d, pesado: ultimo, tick: i > 0 && !ultimo }));
          luta.emit({ t: 'impacto', x: r.x, y: r.y - r.alto * 0.5, tipo: h.tipo, estilo: h.estilo });
          if (ultimo) { luta.emit({ t: 'temblor', f: 0.01 }); if (extra.slot === 'e') luta.emit({ t: 'xGigante', x: r.x, y: r.y - r.alto * 0.5, tipo: h.tipo }); }
        }
      },
      fin: () => { delete l.est.invul; },
    };
  }

}
