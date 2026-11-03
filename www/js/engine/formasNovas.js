// Mecânicas dos Pokémon da última leva (Gengar, Gardevoir, Kangaskhan, Rayquaza, Zeraora e Darkrai).
// Cada função é uma "forma" como as de habilidades.js: recebe (l, h, extra) com `this` = Habilidades.
import { RADIO } from '../config.js';
const entre = (a, b) => a + Math.random() * (b - a);
import { fijarCampo, limitarCampo } from './fisica.js';
import { Proyectil, areaCirculo, pacote, atingir } from './entidades.js';

const angApunte = l => Math.atan2(l.ay - l.y, l.ax - l.x);
const dentroElipse = (b, x, y, r) => Math.hypot(b.x - x, (b.y - y) / 0.62) < r;

// inimigo de verdade mais perto (sem clones nem escondidos)
function maisPerto(luta, l, alcance, de = l, menos = null) {
  let m = null, dm = alcance;
  for (const b of luta.blancos(l)) {
    if (b.esClon || b.oculto || b === menos) continue;
    const d = Math.hypot(b.x - de.x, b.y - de.y);
    if (d < dm) { dm = d; m = b; }
  }
  return m;
}

export const formasNovas = {
  // ---------------------------------------------------------------- Shadow Possession (Gengar): entra na sombra do rival e anda grudado
  // nele sem poder ser atingido; sai (soltando e apertando de novo, ou no fim do tempo) com um golpe que amaldiçoa
  posesion(l, h, extra) {
    const luta = this.luta, alvo = maisPerto(luta, l, h.alcance ?? 170);
    if (!alvo) { if (l.humano) l.avisar('posesion', () => l.texto('NO SHADOW NEAR', '#c4b5fd')); return false; }
    const dur = h.dur ?? 2.2;
    l.cortarAccion();
    l.ponerEstado('vuelo', dur + 0.2, { oculto: true, modo: 'sombra', rapidez: 0 });
    alvo.ponerEstado('poseido', dur + 0.2, { por: l });
    l.texto('POSSESSION!', '#a78bfa');
    luta.emit({ t: 'posesion', l, b: alvo });
    let t = 0, solto = false;
    const sair = () => {
      if (!l.est.vuelo) return;
      delete l.est.vuelo; delete alvo.est.poseido;
      // reaparece colado nas costas do rival
      const costas = alvo.angulo + Math.PI, p = fijarCampo(alvo.x + Math.cos(costas) * 22, alvo.y + Math.sin(costas) * 14);
      l.x = p.x; l.y = p.y; l.angulo = Math.atan2(alvo.y - l.y, alvo.x - l.x);
      l.animar('Attack', 0.35); l.ponerEstado('invul', 0.25);
      luta.emit({ t: 'sombraSale', l, b: alvo });
      if (alvo.ko) return;
      const res = atingir(l, alvo, pacote(h, extra, l.angulo, { empuje: 70, aturde: h.aturde ?? 0.45, pesado: true }));
      if (res === 'golpe') { alvo.ponerEstado('maldito', h.maldicion?.dur ?? 4, { f: h.maldicion?.f ?? 1.2, fuente: l }); alvo.texto('CURSED!', '#c084fc'); }
      luta.emit({ t: 'temblor', f: 0.006 });
    };
    luta.add({ tipo: 'posesion', dueno: l, vivo: true, update: dt => {
      t += dt;
      if (l.ko) { delete alvo.est.poseido; return false; }
      if (alvo.ko) { sair(); return false; }
      l.x = alvo.x; l.y = alvo.y + 1; l.vx = l.vy = 0;
      const pulsa = l.intento?.[extra.slot];
      if (!pulsa) solto = true;
      if (t >= dur || (t > 0.35 && pulsa && solto)) { sair(); return false; }
      return true;
    } });
  },

  // ---------------------------------------------------------------- Phantom Realm (Gengar): cúpula de sombra; dentro dela o rival fica
  // lento, amaldiçoado e perde vida; a Mega é maior e drena mais
  reinoSombras(l, h) {
    const luta = this.luta, R = h.radio ?? 110, dur = h.dur ?? 5;
    l.animar(h.anim ?? 'Charge', 0.5);
    l.accion = { hasta: luta.t + 0.3, bloquea: true, lento: 0 };
    luta.emit({ t: 'reinoSombras', x: l.x, y: l.y, radio: R, dur });
    luta.emit({ t: 'temblor', f: 0.01 });
    const e = { tipo: 'reino', dueno: l, vivo: true, x: l.x, y: l.y, radio: R, t: 0, dur, acum: 0, update: dt => {
      e.t += dt; e.acum += dt;
      const tick = e.acum >= 0.5;
      if (tick) e.acum -= 0.5;
      for (const b of luta.blancos(l)) {
        if (b.esClon || !dentroElipse(b, e.x, e.y, R)) continue;
        b.ponerEstado('lento', 0.3, { f: h.ralentiza ?? 0.3 });
        b.ponerEstado('maldito', 0.6, { f: h.maldicionF ?? 1.2, fuente: l });
        if (tick && !b.oculto) b.recibir(l, { dano: (h.dps ?? 3) * 0.5, tipo: 'GHOST', puro: true, tick: true });
      }
      return e.t < dur && !l.ko;
    } };
    luta.add(e);
  },

  // ---------------------------------------------------------------- Psychic Link (Gardevoir): liga num aliado (divide o dano dele e cura)
  // ou, sem aliado por perto, no rival mais perto (parte do dano que ela leva volta para ele, e ele fica mais lento)
  vinculo(l, h) {
    const luta = this.luta, alcance = h.alcance ?? 260;
    const aliado = luta.aliados(l).filter(a => Math.hypot(a.x - l.x, a.y - l.y) < alcance).sort((a, b) => Math.hypot(a.x - l.x, a.y - l.y) - Math.hypot(b.x - l.x, b.y - l.y))[0];
    const alvo = aliado ?? maisPerto(luta, l, alcance);
    if (!alvo) { if (l.humano) l.avisar('vinculo', () => l.texto('NO ONE TO LINK', '#f9a8d4')); return false; }
    const dur = h.dur ?? 6, modo = aliado ? 'aliado' : 'inimigo';
    l.animar(h.anim ?? 'Charge', 0.35);
    l.ponerEstado('vinculo', dur, { con: alvo, modo, cura: h.cura ?? 2.5, reparte: h.reparte ?? 0.35, refleja: h.refleja ?? 0.35 });
    if (modo === 'aliado') alvo.ponerEstado('protegido', dur, { por: l, reparte: h.reparte ?? 0.35 });
    else alvo.ponerEstado('ligado', dur, { por: l, f: h.ralentiza ?? 0.15 });
    l.texto(modo === 'aliado' ? 'LINKED: SHARE PAIN' : 'LINKED: PAIN RETURNS', '#f9a8d4');
    luta.emit({ t: 'vinculo', l, b: alvo, modo });
  },

  // ---------------------------------------------------------------- Teleport (Gardevoir): some e aparece para onde o analógico aponta
  teleporte(l, h, extra) {
    const luta = this.luta, mov = l.intento && (l.intento.mx || l.intento.my);
    const a = mov ? Math.atan2(l.intento.my, l.intento.mx) : angApunte(l);
    const x0 = l.x, y0 = l.y, p = fijarCampo(l.x + Math.cos(a) * (h.dist ?? 120), l.y + Math.sin(a) * (h.dist ?? 120));
    l.cortarAccion();
    l.x = p.x; l.y = p.y; l.vx = l.vy = 0; l.angulo = a;
    l.ponerEstado('invul', h.invul ?? 0.25);
    luta.emit({ t: 'teletransporte', l, x0, y0, x1: p.x, y1: p.y, tipo: h.tipo });
    luta.emit({ t: 'sonido', n: 'dash' });
    // a Mega deixa uma explosão de fada onde estava
    if (h.estallido) areaCirculo(luta, l, x0, y0, h.estallido.radio ?? 40, pacote(h, extra, a, { dano: h.estallido.dano ?? 6, dirX: undefined, dirY: undefined, empuje: 50 }));
  },

  // ---------------------------------------------------------------- Misty Terrain (Gardevoir): campo de fada; cura aliados e tira veneno e
  // queimadura deles; inimigos dentro ficam lentos e mais fracos (a Mega ainda machuca)
  campoFada(l, h) {
    const luta = this.luta, R = h.radio ?? 120, dur = h.dur ?? 6;
    l.animar(h.anim ?? 'Charge', 0.5);
    l.accion = { hasta: luta.t + 0.3, bloquea: true, lento: 0 };
    luta.emit({ t: 'campoFada', x: l.x, y: l.y, radio: R, dur });
    const e = { tipo: 'campoFada', dueno: l, vivo: true, x: l.x, y: l.y, radio: R, t: 0, dur, acum: 0, update: dt => {
      e.t += dt; e.acum += dt;
      const tick = e.acum >= 1;
      if (tick) e.acum -= 1;
      for (const a of [l, ...luta.aliados(l)]) {
        if (a.ko || !dentroElipse(a, e.x, e.y, R)) continue;
        delete a.est.veneno; delete a.est.quema;
        if (tick) a.cura(h.cura ?? 3);
      }
      for (const b of luta.blancos(l)) {
        if (b.esClon || !dentroElipse(b, e.x, e.y, R)) continue;
        b.ponerEstado('lento', 0.3, { f: h.ralentiza ?? 0.25 });
        b.ponerEstado('debil', 0.3, { f: h.debil ?? 0.85 });
        if (tick && h.dps && !b.oculto) b.recibir(l, { dano: h.dps, tipo: 'FAIRY', puro: true, tick: true });
      }
      return e.t < dur && !l.ko;
    } };
    luta.add(e);
  },

  // ---------------------------------------------------------------- Counter (Kangaskhan): guarda com o filhote na bolsa; quem bater nela
  // nesse tempo leva o golpe de volta com um soco enorme (de longe, só bloqueia)
  contraataque(l, h) {
    const luta = this.luta, dur = h.dur ?? 0.7;
    l.cortarAccion();
    l.ponerEstado('contra', dur, { h });
    l.accion = { hasta: luta.t + dur, bloquea: true, lento: 0.2 };
    l.animar(h.anim ?? 'Charge', dur);
    l.texto('COUNTER!', '#ffd166');
    luta.emit({ t: 'guardia', l, dur });
  },

  // ---------------------------------------------------------------- Delta Stream (Rayquaza): três correntes de vento atravessam a arena na
  // direção da mira: apagam tiros inimigos que entram nelas, empurram e machucam os rivais e aceleram os aliados
  deltaStream(l, h) {
    const luta = this.luta, a = angApunte(l), dur = h.dur ?? 6, sep = h.sep ?? 64, larg = h.ancho ?? 24;
    const ca = Math.cos(a), sa = Math.sin(a), faixas = [-sep, 0, sep];
    l.animar(h.anim ?? 'Charge', 0.5);
    l.accion = { hasta: luta.t + 0.35, bloquea: true, lento: 0 };
    luta.emit({ t: 'deltaStream', x: l.x, y: l.y, ang: a, faixas, larg, dur });
    luta.emit({ t: 'temblor', f: 0.012 });
    const naFaixa = (x, y) => { const dx = x - e.x, dy = y - e.y, lat = -dx * sa + dy * ca; return faixas.some(o => Math.abs(lat - o) < larg); };
    const e = { tipo: 'delta', dueno: l, vivo: true, x: l.x, y: l.y, ang: a, faixas, larg, t: 0, dur, acum: 0, update: dt => {
      e.t += dt; e.acum += dt;
      const tick = e.acum >= 0.5;
      if (tick) e.acum -= 0.5;
      for (const o of luta.entidades) {
        if (o.tipo !== 'proj' || o.vivo === false || !o.dueno || o.dueno.equipo === l.equipo || !naFaixa(o.x, o.y)) continue;
        o.vivo = false;
        luta.emit({ t: 'desvio', x: o.x, y: o.y - (o.alt ?? 10) });
      }
      for (const b of luta.blancos(l)) {
        if (b.esClon || b.oculto || !naFaixa(b.x, b.y)) continue;
        b.empX += ca * 150 * dt * 6; b.empY += sa * 150 * dt * 6;
        if (tick) b.recibir(l, { dano: (h.dps ?? 3) * 0.5, tipo: 'DRAGON', puro: true, tick: true });
      }
      for (const x of [l, ...luta.aliados(l)]) if (!x.ko && naFaixa(x.x, x.y)) x.ponerEstado('rapido', 0.15, { vel: h.acelera ?? 1.35 });
      return e.t < dur && !l.ko;
    } };
    luta.add(e);
  },

  // ---------------------------------------------------------------- Volt Switch (Zeraora): solta uma bola de raio; apertando de novo enquanto
  // ela voa (ou logo depois de bater) ele se teleporta até ela, com um choque na chegada
  voltSwitch(l, h, extra) {
    const luta = this.luta, janela = h.janela ?? 1.1, vp = l.voltPos;
    if (vp && luta.t - vp.desde < janela) {
      const x0 = l.x, y0 = l.y, p = fijarCampo(vp.x, vp.y);
      l.voltPos = null; if (vp.bola) vp.bola.vivo = false;
      l.cortarAccion();
      l.x = p.x; l.y = p.y; l.vx = l.vy = 0;
      l.ponerEstado('invul', 0.2);
      luta.emit({ t: 'voltTeleporte', l, x0, y0, x1: p.x, y1: p.y });
      areaCirculo(luta, l, p.x, p.y, h.raioChegada ?? 36, pacote(h, extra, 0, { dano: h.danoChegada ?? h.dano * 0.7, aturde: 0.3, dirX: undefined, dirY: undefined, empuje: 50 }));
      luta.programar(0, () => { l.cd[extra.slot] = h.cdReal ?? 6; });
      return;
    }
    const ang = Math.atan2(l.ay - l.y, l.ax - l.x);
    l.animar(h.anim ?? 'Shoot', 0.3);
    l.accion = { hasta: luta.t + 0.15, angulo: ang, lento: 0.6 };
    const bola = new Proyectil(luta, l, h, ang, extra);
    luta.add(bola);
    l.voltPos = { x: bola.x, y: bola.y, desde: luta.t, bola };
    const reg = l.voltPos;
    luta.add({ tipo: 'voltRastro', dueno: l, vivo: true, update: () => {
      if (l.voltPos !== reg) return false;
      if (bola.vivo !== false) { reg.x = bola.x; reg.y = bola.y; }
      if (luta.t - reg.desde >= janela) { l.voltPos = null; l.cd[extra.slot] = Math.max(l.cd[extra.slot], (h.cdReal ?? 6) - janela); return false; }
      return true;
    } });
  },

  // ---------------------------------------------------------------- Discharge (Zeraora): raio que pula de inimigo em inimigo
  // (sozinho com um rival, ele volta e acerta o mesmo de novo, mais fraco)
  cadenaRayo(l, h, extra) {
    const luta = this.luta;
    let alvo = maisPerto(luta, l, h.alcance ?? 180);
    if (!alvo) { if (l.humano) l.avisar('cadena', () => l.texto('NO TARGET', '#fde047')); return false; }
    l.animar(h.anim ?? 'Charge', 0.35);
    l.accion = { hasta: luta.t + 0.2, lento: 0.3 };
    let de = { x: l.x, y: l.y - l.alto * 0.5 };
    for (let i = 0; i < (h.saltos ?? 3); i++) luta.programar(0.06 + i * 0.12, () => {
      if (!alvo || alvo.ko || l.ko) return;
      const para = { x: alvo.x, y: alvo.y - alvo.alto * 0.5 };
      luta.emit({ t: 'raioCadeia', x0: de.x, y0: de.y, x1: para.x, y1: para.y, i });
      atingir(l, alvo, pacote(h, extra, 0, { dano: h.dano * Math.pow(h.decai ?? 0.7, i), aturde: i === 0 ? (h.aturde ?? 0.25) : 0.1, dirX: undefined, dirY: undefined }));
      de = para;
      alvo = maisPerto(luta, l, h.salto ?? 150, alvo, alvo) ?? alvo;
    });
  },

  // ---------------------------------------------------------------- Plasma Fists Overdrive (Zeraora): vira raio e acerta o rival de vários
  // lados seguidos, teleportando em volta dele; o último golpe atordoa
  blitzPlasma(l, h, extra) {
    const luta = this.luta, alvo = maisPerto(luta, l, h.alcance ?? 230);
    if (!alvo) { if (l.humano) l.avisar('blitz', () => l.texto('NO TARGET', '#fde047')); return false; }
    const n = h.golpes ?? 5, cada = h.cada ?? 0.14, base = Math.atan2(l.y - alvo.y, l.x - alvo.x);
    l.ponerEstado('invul', n * cada + 0.35);
    l.accion = { hasta: luta.t + n * cada + 0.25, bloquea: true, lento: 0 };
    luta.emit({ t: 'plasmaCarga', l });
    for (let i = 0; i < n; i++) luta.programar(0.12 + i * cada, () => {
      if (l.ko || alvo.ko) return;
      const ult = i === n - 1, ang = base + i * 2.4, x0 = l.x, y0 = l.y;
      const p = fijarCampo(alvo.x + Math.cos(ang) * 30, alvo.y + Math.sin(ang) * 20);
      l.x = p.x; l.y = p.y; l.angulo = Math.atan2(alvo.y - l.y, alvo.x - l.x);
      l.animar('Attack', cada);
      luta.emit({ t: 'plasmaGolpe', x0, y0, x1: p.x, y1: p.y, bx: alvo.x, by: alvo.y - alvo.alto * 0.5, final: ult });
      atingir(l, alvo, pacote(h, extra, l.angulo, { dano: (h.dano / (n + 1)) * (ult ? 2 : 1), aturde: ult ? h.aturde ?? 0.6 : 0.12, empuje: ult ? 140 : 10, pesado: ult }));
      if (ult) { luta.emit({ t: 'temblor', f: 0.014 }); luta.hitstop(90); }
    });
  },

  // ---------------------------------------------------------------- Eternal Night (Darkrai): a arena escurece; os rivais quase não enxergam,
  // perdem vida aos poucos e levam mais dano do Darkrai enquanto durar
  nocheEterna(l, h) {
    const luta = this.luta, dur = h.dur ?? 6;
    l.animar(h.anim ?? 'Charge', 0.6);
    l.accion = { hasta: luta.t + 0.4, bloquea: true, lento: 0 };
    luta.emit({ t: 'nocheEterna', l, dur });
    luta.emit({ t: 'anuncio', txt: 'ETERNAL NIGHT', color: '#a78bfa', tam: 20, dur: 1 });
    const e = { tipo: 'noche', dueno: l, vivo: true, t: 0, dur, acum: 0, update: dt => {
      e.t += dt; e.acum += dt;
      const tick = e.acum >= 0.5;
      if (tick) e.acum -= 0.5;
      for (const b of luta.blancos(l)) {
        if (b.esClon) continue;
        b.ponerEstado('cegado', 0.2, { por: l });
        b.ponerEstado('pesadelo', 0.2, { f: h.mult ?? 1.3, fuente: l });
        if (tick && !b.oculto) b.recibir(l, { dano: (h.dps ?? 3) * 0.5 * (b.est.dormido ? 2 : 1), tipo: 'DARK', puro: true, tick: true });
      }
      return e.t < dur && !l.ko;
    } };
    luta.add(e);
  },
};


// ajuda a mirar: se o rival está perto da direção apontada, corrige para ele
function mirar(l, alcance, cone = 0.7) {
  const a = angApunte(l), r = l.rival;
  if (!r || r.ko || r.oculto) return a;
  const ar = Math.atan2(r.y - l.y, r.x - l.x);
  return Math.hypot(r.x - l.x, r.y - l.y) < alcance && Math.abs(((ar - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < cone ? ar : a;
}
// arrasta um lutador de onde está até (x1, y1) em `dur` segundos, com um pulinho opcional
function arrastar(luta, b, x1, y1, dur, alto = 0, fim) {
  const x0 = b.x, y0 = b.y; let t = 0;
  luta.add({ tipo: 'lanzado', dueno: null, vivo: true, update: dt => {
    t += dt; const k = Math.min(1, t / dur);
    if (b.ko) { b.salto = 0; return false; }
    b.x = x0 + (x1 - x0) * k; b.y = y0 + (y1 - y0) * k; b.salto = Math.round(Math.sin(k * Math.PI) * alto);
    if (k < 1) return true;
    b.salto = 0; fim?.(); return false;
  } });
}
const pocasDe = (luta, l) => luta.entidades.filter(e => e.tipo === 'sombraPoca' && e.dueno === l && e.vivo !== false);

Object.assign(formasNovas, {
  // ---------------------------------------------------------------- Shadow Ball (Gengar): onde a bola cai fica uma poça de sombra
  // (no máximo 3); rival dentro dela anda mais devagar
  bolaSombra(l, h, extra) {
    const luta = this.luta, ang = mirar(l, (h.alcance ?? 220) + 40);
    l.animar(h.anim ?? 'Shoot', 0.35);
    l.accion = { hasta: luta.t + (h.lanzar ?? 0.18) + 0.05, angulo: ang, lento: 0.6 };
    luta.programar(h.lanzar ?? 0.18, () => {
      if (l.ko) return;
      const bola = new Proyectil(luta, l, h, ang, extra);
      luta.add(bola);
      luta.add({ tipo: 'vigiaBola', dueno: l, vivo: true, update: () => {
        if (bola.vivo !== false) return true;
        const velhas = pocasDe(luta, l);
        if (velhas.length >= (h.maxPocas ?? 3)) velhas[0].vivo = false;
        const R = h.poca ?? 28, dur = h.pocaDur ?? 9;
        const e = { tipo: 'sombraPoca', dueno: l, vivo: true, x: bola.x, y: bola.y, radio: R, t: 0, dur, update: dt => {
          e.t += dt;
          e.acum = (e.acum ?? 0) + dt; const tick = e.acum >= 0.5; if (tick) e.acum -= 0.5;
          for (const b of luta.blancos(l)) if (!b.esClon && Math.hypot(b.x - e.x, (b.y - e.y) / 0.62) < R) { b.ponerEstado('lento', 0.2, { f: 0.35 }); if (tick && !b.oculto) b.recibir(l, { dano: (h.pocaDps ?? 2) * 0.5, tipo: 'GHOST', puro: true, tick: true }); }
          return e.t < dur && !l.ko;
        } };
        luta.add(e);
        luta.emit({ t: 'pocaSombra', x: e.x, y: e.y, radio: R });
        return false;
      } });
    });
  },

  // ---------------------------------------------------------------- Phantom Step (Gengar): mergulha na poça de sombra que estiver mais na
  // direção do analógico e sai dela com garras; sem poça, um passo fantasma curto
  saltoSombra(l, h, extra) {
    const luta = this.luta, mov = l.intento && (l.intento.mx || l.intento.my);
    const a = mov ? Math.atan2(l.intento.my, l.intento.mx) : angApunte(l);
    let alvo = null, melhor = -Infinity;
    for (const e of pocasDe(luta, l)) {
      const dx = e.x - l.x, dy = e.y - l.y, d = Math.hypot(dx, dy);
      if (d < 20 || d > (h.alcance ?? 320)) continue;
      const nota = Math.cos(Math.atan2(dy, dx) - a) * 2 - d / 300;
      if (nota > melhor) { melhor = nota; alvo = e; }
    }
    const x0 = l.x, y0 = l.y, p = alvo ? { x: alvo.x, y: alvo.y } : fijarCampo(l.x + Math.cos(a) * (h.dist ?? 90), l.y + Math.sin(a) * (h.dist ?? 90));
    l.cortarAccion();
    l.x = p.x; l.y = p.y; l.vx = l.vy = 0; l.angulo = a;
    l.ponerEstado('invul', 0.3);
    luta.emit({ t: 'saltoSombra', l, x0, y0, x1: p.x, y1: p.y, poca: !!alvo });
    if (alvo) areaCirculo(luta, l, p.x, p.y, h.radio ?? 34, pacote(h, extra, a, { dirX: undefined, dirY: undefined, empuje: 40 }));
  },

  // ---------------------------------------------------------------- Lick (Gengar): a língua estica em linha reta; quem ela pega é puxado
  // até a boca do Gengar e fica amaldiçoado
  lambida(l, h, extra) {
    const luta = this.luta, a = mirar(l, (h.alcance ?? 150) + 30), ca = Math.cos(a), sa = Math.sin(a), alc = h.alcance ?? 150;
    l.animar(h.anim ?? 'Attack', 0.4);
    l.accion = { hasta: luta.t + 0.35, bloquea: true, lento: 0, angulo: a };
    let preso = null, melhor = Infinity;
    for (const b of luta.blancos(l)) {
      if (b.oculto || b.est?.vuelo) continue;
      const dx = b.x - l.x, dy = b.y - l.y, lon = dx * ca + dy * sa, lat = Math.abs(-dx * sa + dy * ca);
      if (lon < 0 || lon > alc + RADIO || lat > RADIO + 10 || lon >= melhor) continue;
      melhor = lon; preso = b;
    }
    const fim = preso ? melhor : alc;
    luta.emit({ t: 'lingua', l, ang: a, alcance: fim, pegou: !!preso });
    if (!preso) return;
    luta.programar(0.12, () => {
      if (l.ko || preso.ko) return;
      const res = atingir(l, preso, pacote(h, extra, a, { empuje: 0 }));
      if (res !== 'golpe' || preso.esClon) return;
      preso.ponerEstado('maldito', h.maldicion?.dur ?? 4, { f: h.maldicion?.f ?? 1.2, fuente: l });
      this.prender(preso, 0.35);
      arrastar(luta, preso, l.x + ca * 30, l.y + sa * 20, 0.22, 6);
    });
  },

  // ---------------------------------------------------------------- Shadow Hands (Gengar): mãos gigantes de sombra saem de todas as poças
  // (e debaixo do Gengar) e agarram quem estiver perto
  maosSombra(l, h, extra) {
    const luta = this.luta, r = l.rival, pontos = [{ x: l.x, y: l.y }, ...pocasDe(luta, l).map(e => ({ x: e.x, y: e.y }))];
    // uma mão nasce sempre embaixo do rival
    if (r && !r.ko && !r.oculto && Math.hypot(r.x - l.x, r.y - l.y) < 320) pontos.push({ x: r.x, y: r.y });
    l.animar(h.anim ?? 'Charge', 0.6);
    l.accion = { hasta: luta.t + 0.4, bloquea: true, lento: 0 };
    for (const pt of pontos) luta.emit({ t: 'maoAviso', x: pt.x, y: pt.y, radio: h.radio ?? 42 });
    luta.programar(h.carga ?? 0.4, () => {
      if (l.ko) return;
      luta.emit({ t: 'temblor', f: 0.012 });
      const ja = new Set();
      for (const pt of pontos) {
        luta.emit({ t: 'maoGigante', x: pt.x, y: pt.y, radio: h.radio ?? 42 });
        for (const b of luta.blancos(l)) {
          if (ja.has(b) || b.oculto || Math.hypot(b.x - pt.x, (b.y - pt.y) / 0.62) > (h.radio ?? 42) + RADIO) continue;
          ja.add(b);
          if (atingir(l, b, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, empuje: 0, pesado: true })) === 'golpe' && !b.esClon) { this.prender(b, h.prende ?? 0.8); b.ponerEstado('maldito', 4, { f: 1.2, fuente: l }); }
        }
      }
    });
  },

  // ---------------------------------------------------------------- Psychic (Gardevoir): ergue o rival com a mente, segura no ar e arremessa
  // para onde você mirar; se bater na parede, leva mais dano e fica tonto
  telecinese(l, h, extra) {
    const luta = this.luta, r = maisPerto(luta, l, h.alcance ?? 200);
    if (!r) { if (l.humano) l.avisar('telec', () => l.texto('NO TARGET', '#f9a8d4')); return false; }
    l.animar(h.anim ?? 'Charge', 0.9);
    l.accion = { hasta: luta.t + 0.55, lento: 0.3 };
    luta.emit({ t: 'telecinese', l, b: r, dur: 0.55 });
    this.prender(r, 0.95);
    atingir(l, r, pacote(h, extra, 0, { dano: h.dano * 0.4, empuje: 0, dirX: undefined, dirY: undefined }));
    let t = 0;
    luta.add({ tipo: 'lanzado', dueno: null, vivo: true, update: dt => { t += dt; if (r.ko) { r.salto = 0; return false; } r.salto = Math.round(Math.min(1, t / 0.3) * 22); return t < 0.55; } });
    luta.programar(0.55, () => {
      if (l.ko || r.ko) { r.salto = 0; return; }
      const a = angApunte(l), L = h.lanza ?? 170, fim = { x: r.x + Math.cos(a) * L, y: r.y + Math.sin(a) * L }, p = limitarCampo(fim.x, fim.y), parede = Math.hypot(p.x - fim.x, p.y - fim.y) > 4;
      luta.emit({ t: 'arremessoPsi', b: r, x0: r.x, y0: r.y, x1: p.x, y1: p.y });
      arrastar(luta, r, p.x, p.y, 0.28, 22, () => {
        atingir(l, r, pacote(h, extra, a, { dano: h.dano * (parede ? 0.9 : 0.6), empuje: 0, aturde: parede ? 0.6 : 0.2, pesado: true }));
        luta.emit({ t: 'impactoPsi', x: r.x, y: r.y, parede });
        if (parede) luta.emit({ t: 'temblor', f: 0.012 });
      });
    });
  },

  // ---------------------------------------------------------------- Future Sight (Gardevoir): marca onde o rival está; um instante depois o
  // futuro chega e o lugar explode
  futuroVisao(l, h, extra) {
    const luta = this.luta, r = l.rival, alvo = r && !r.ko && Math.hypot(r.x - l.x, r.y - l.y) < (h.alcance ?? 260) ? { x: r.x, y: r.y } : fijarCampo(l.ax, l.ay);
    l.animar(h.anim ?? 'Charge', 0.3);
    l.accion = { hasta: luta.t + 0.15, lento: 0.5 };
    const espera = h.espera ?? 1.1, R = h.radio ?? 36;
    luta.emit({ t: 'futuro', x: alvo.x, y: alvo.y, radio: R, espera });
    luta.programar(espera, () => {
      if (l.ko) return;
      luta.emit({ t: 'futuroExplode', x: alvo.x, y: alvo.y, radio: R });
      areaCirculo(luta, l, alvo.x, alvo.y, R, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, empuje: 60, aturde: h.aturde ?? 0.3 }));
    });
  },

  // ---------------------------------------------------------------- Moonfall (Gardevoir): uma lua desce do céu sobre o rival; quando cai,
  // machuca os rivais e cura os aliados que estiverem embaixo
  luaCaindo(l, h, extra) {
    const luta = this.luta, r = l.rival, alvo = r && !r.ko ? { x: r.x, y: r.y } : fijarCampo(l.ax, l.ay), R = h.radio ?? 80, queda = h.queda ?? 1.1;
    l.animar(h.anim ?? 'Charge', 0.8);
    l.accion = { hasta: luta.t + 0.4, bloquea: true, lento: 0 };
    luta.emit({ t: 'luaCai', x: alvo.x, y: alvo.y, radio: R, queda });
    luta.programar(queda, () => {
      if (l.ko) return;
      luta.emit({ t: 'luaImpacto', x: alvo.x, y: alvo.y, radio: R });
      luta.emit({ t: 'temblor', f: 0.016 });
      areaCirculo(luta, l, alvo.x, alvo.y, R, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, empuje: 90, aturde: 0.4, pesado: true }));
      for (const a of [l, ...luta.aliados(l)]) if (!a.ko && Math.hypot(a.x - alvo.x, (a.y - alvo.y) / 0.62) < R + RADIO) a.cura(h.cura ?? 14);
    });
  },

  // ---------------------------------------------------------------- Joey Toss (Kangaskhan): joga o filhote; se acertar, ele gruda no rival e
  // fica socando até pular de volta para a bolsa
  filhoteLanca(l, h, extra) {
    const luta = this.luta, ang = mirar(l, (h.alcance ?? 190) + 30);
    if (l.est.semFilhote) return false;
    l.animar(h.anim ?? 'Shoot', 0.3);
    l.accion = { hasta: luta.t + 0.2, angulo: ang, lento: 0.5 };
    const dur = h.grudado ?? 2;
    l.ponerEstado('semFilhote', dur + 1);
    const bola = new Proyectil(luta, l, { ...h, estilo: 'filhote', dano: h.dano * 0.4 }, ang, extra);
    luta.add(bola);
    luta.add({ tipo: 'vigiaFilhote', dueno: l, vivo: true, update: () => {
      if (bola.vivo !== false) return true;
      const r = l.rival;
      if (!r || r.ko || Math.hypot(r.x - bola.x, r.y - bola.y) > RADIO * 2 + 10) { delete l.est.semFilhote; luta.emit({ t: 'filhoteVolta', l }); return false; }
      let t = 0, prox = 0.15;
      luta.emit({ t: 'filhoteGruda', b: r, dur });
      luta.add({ tipo: 'filhoteGrudado', dueno: l, vivo: true, alvo: r, update: dt => {
        t += dt;
        if (r.ko || l.ko || t >= dur) { delete l.est.semFilhote; luta.emit({ t: 'filhoteVolta', l }); return false; }
        if (t >= prox) { prox = t + (h.cada ?? 0.3); r.recibir(l, { dano: h.dano * 0.15, tipo: 'NORMAL', slot: 'q' }); luta.emit({ t: 'socoFilhote', x: r.x, y: r.y - r.alto * 0.6 }); }
        return true;
      } });
      return false;
    } });
  },

  // ---------------------------------------------------------------- Dizzy Punch + Uppercut (Kangaskhan): o soco deixa tonto e abre um instante
  // para apertar de novo: o gancho joga o rival para o alto
  socoCombo(l, h, extra) {
    const luta = this.luta, a = mirar(l, 70), ca = Math.cos(a), sa = Math.sin(a), segundo = l.comboHasta > luta.t;
    l.animar('Attack', 0.3);
    l.accion = { hasta: luta.t + 0.22, bloquea: true, lento: 0, angulo: a };
    l.empX += ca * 260; l.empY += sa * 160;
    luta.programar(0.1, () => {
      if (l.ko) return;
      const cx = l.x + ca * 30, cy = l.y + sa * 20;
      let pegou = null;
      for (const b of luta.blancos(l)) { if (b.oculto || Math.hypot(b.x - cx, b.y - cy) > 30 + RADIO) continue; if (atingir(l, b, pacote(h, extra, a, segundo ? { dano: h.dano * 1.3, empuje: 0, pesado: true } : { confunde: h.confunde ?? 1.2, empuje: 60 })) === 'golpe' && !b.esClon) pegou = b; }
      luta.emit({ t: segundo ? 'gancho' : 'socoTonto', x: cx, y: cy - 12, ang: a });
      if (segundo && pegou) { this.lanzarAlto(pegou, 0.6, 46); luta.emit({ t: 'temblor', f: 0.01 }); }
    });
    if (segundo) { l.comboHasta = 0; luta.programar(0, () => { l.cd[extra.slot] = h.cdReal ?? 6; }); }
    else { l.comboHasta = luta.t + (h.janela ?? 1.2); luta.programar(h.janela ?? 1.2, () => { if (l.comboHasta && luta.t >= l.comboHasta) { l.comboHasta = 0; l.cd[extra.slot] = Math.max(l.cd[extra.slot], (h.cdReal ?? 6) - (h.janela ?? 1.2)); } }); }
  },

  // ---------------------------------------------------------------- Outrage (Kangaskhan): agarra o rival e bate ele no chão três vezes,
  // a última com tremor e arremesso
  agarraoSlam(l, h, extra) {
    const luta = this.luta, r = maisPerto(luta, l, h.alcance ?? 150);
    if (!r) { if (l.humano) l.avisar('agarra', () => l.texto('NO TARGET', '#fde68a')); return false; }
    const n = h.golpes ?? 3, a = Math.atan2(r.y - l.y, r.x - l.x);
    const p = fijarCampo(r.x - Math.cos(a) * 26, r.y - Math.sin(a) * 18);
    l.x = p.x; l.y = p.y; l.angulo = a;
    l.ponerEstado('invul', n * 0.38 + 0.3);
    l.accion = { hasta: luta.t + n * 0.38 + 0.2, bloquea: true, lento: 0, angulo: a };
    this.prender(r, n * 0.38 + 0.15);
    luta.emit({ t: 'agarrao', l, b: r });
    for (let i = 0; i < n; i++) luta.programar(0.1 + i * 0.38, () => {
      if (l.ko || r.ko) return;
      const ult = i === n - 1;
      l.animar('Attack', 0.3);
      let t = 0;
      luta.add({ tipo: 'lanzado', dueno: null, vivo: true, update: dt => { t += dt; if (r.ko) { r.salto = 0; return false; } r.salto = Math.round(Math.sin(Math.min(1, t / 0.3) * Math.PI) * 30); if (t < 0.3) return true; r.salto = 0; return false; } });
      luta.programar(0.3, () => {
        if (l.ko || r.ko) return;
        luta.emit({ t: 'slamChao', x: r.x, y: r.y, final: ult });
        luta.emit({ t: 'temblor', f: ult ? 0.018 : 0.008 });
        atingir(l, r, pacote(h, extra, a, { dano: (h.dano / (n + 1)) * (ult ? 2 : 1), empuje: ult ? 180 : 0, aturde: ult ? 0.6 : 0.1, pesado: true }));
      });
    });
  },

  // ---------------------------------------------------------------- Dragon Ascent (Rayquaza): sobe ao céu e mergulha numa linha reta como um
  // cometa verde, atravessando a arena; quem estiver no caminho voa e fica um rastro de vento que deixa lento
  ascensaoDraco(l, h, extra) {
    const luta = this.luta, a = mirar(l, 400, 1), ca = Math.cos(a), sa = Math.sin(a), sobe = h.sobe ?? 0.6, L = h.largo ?? 300, larg = h.ancho ?? 30;
    l.cortarAccion();
    l.ponerEstado('vuelo', sobe + 0.4, { oculto: true, modo: 'aire', rapidez: 0 });
    l.accion = { hasta: luta.t + sobe + 0.4, bloquea: true, lento: 0, angulo: a };
    luta.emit({ t: 'ascensao', l });
    const x0 = l.x - ca * 40, y0 = l.y - sa * 40;
    luta.emit({ t: 'ascensaoAviso', x0, y0, ang: a, largo: L, ancho: larg, espera: sobe });
    luta.programar(sobe, () => {
      if (l.ko) return;
      const fim = fijarCampo(x0 + ca * L, y0 + sa * L);
      luta.emit({ t: 'cometaVerde', x0, y0, x1: fim.x, y1: fim.y, ancho: larg });
      luta.emit({ t: 'temblor', f: 0.02 });
      for (const b of luta.blancos(l)) {
        if (b.oculto) continue;
        const dx = b.x - x0, dy = b.y - y0, lon = dx * ca + dy * sa, lat = Math.abs(-dx * sa + dy * ca);
        if (lon < -RADIO || lon > L + RADIO || lat > larg + RADIO) continue;
        if (atingir(l, b, pacote(h, extra, a, { empuje: 60, pesado: true })) === 'golpe' && !b.esClon) this.lanzarAlto(b, 0.55, 40);
      }
      delete l.est.vuelo; l.x = fim.x; l.y = fim.y;
      const rastro = { tipo: 'ventoVerde', dueno: l, vivo: true, x0, y0, x1: fim.x, y1: fim.y, ancho: larg, t: 0, dur: h.rastro ?? 3, update: dt => {
        rastro.t += dt;
        for (const b of luta.blancos(l)) { const dx = b.x - x0, dy = b.y - y0, lon = dx * ca + dy * sa, lat = Math.abs(-dx * sa + dy * ca); if (!b.esClon && lon > 0 && lon < L && lat < larg) b.ponerEstado('lento', 0.2, { f: 0.3 }); }
        return rastro.t < rastro.dur;
      } };
      luta.add(rastro);
    });
  },

  // ---------------------------------------------------------------- Shadow Step (Darkrai): some e aparece nas costas do rival; o próximo golpe
  // sai bem mais forte
  passoSombra(l, h) {
    const luta = this.luta, r = maisPerto(luta, l, h.alcance ?? 220);
    const x0 = l.x, y0 = l.y;
    let p;
    if (r) { const costas = Math.atan2(r.y - l.y, r.x - l.x); p = fijarCampo(r.x + Math.cos(costas) * 28, r.y + Math.sin(costas) * 18); l.angulo = costas + Math.PI; }
    else { const a = angApunte(l); p = fijarCampo(l.x + Math.cos(a) * 110, l.y + Math.sin(a) * 110); }
    l.cortarAccion();
    l.x = p.x; l.y = p.y; l.vx = l.vy = 0;
    l.ponerEstado('invul', 0.3);
    l.ponerEstado('emboscada', h.dur ?? 1.6, { f: h.bonus ?? 1.5 });
    luta.emit({ t: 'passoSombra', l, x0, y0, x1: p.x, y1: p.y });
  },

  // ---------------------------------------------------------------- Nightmare Twins (Darkrai): duas sombras dele saem pelos lados e fazem uma
  // curva que se cruza no rival; quem dorme leva o dobro
  pesadeloDuplo(l, h, extra) {
    const luta = this.luta, r = l.rival, alvo = r && !r.ko ? r : null, tx = alvo ? alvo.x : l.ax, ty = alvo ? alvo.y : l.ay;
    l.animar(h.anim ?? 'Charge', 0.4);
    l.accion = { hasta: luta.t + 0.25, lento: 0.4 };
    const a = Math.atan2(ty - l.y, tx - l.x), dur = h.dur ?? 0.45;
    for (const lado of [-1, 1]) {
      const ctrl = { x: (l.x + tx) / 2 - Math.sin(a) * lado * 90, y: (l.y + ty) / 2 + Math.cos(a) * lado * 60 };
      const x0 = l.x, y0 = l.y, ja = new Set();
      const e = { tipo: h.entidade ?? 'sombraGemea', dueno: l, vivo: true, x: x0, y: y0, t: 0, lado, update: dt => {
        e.t += dt; const k = Math.min(1, e.t / dur), u = 1 - k;
        const ex = alvo && !alvo.ko ? alvo.x : tx, ey = alvo && !alvo.ko ? alvo.y : ty;
        e.x = u * u * x0 + 2 * u * k * ctrl.x + k * k * ex; e.y = u * u * y0 + 2 * u * k * ctrl.y + k * k * ey;
        for (const b of luta.blancos(l)) {
          if (ja.has(b) || b.oculto || Math.hypot(b.x - e.x, b.y - e.y) > RADIO + 12) continue;
          ja.add(b);
          atingir(l, b, pacote(h, extra, Math.atan2(b.y - e.y, b.x - e.x), { empuje: 50 }));
        }
        return k < 1;
      } };
      luta.add(e);
    }
  },
});


Object.assign(formasNovas, {
  // ---------------------------------------------------------------- Play Rough (Mimikyu): pula no rival e os dois somem numa nuvem de briga,
  // com vários golpes seguidos
  brigaNuvem(l, h, extra) {
    const luta = this.luta, r = maisPerto(luta, l, h.alcance ?? 120);
    // sem ninguém perto: só um pulo para a frente
    if (!r) { const a0 = angApunte(l), p0 = fijarCampo(l.x + Math.cos(a0) * 60, l.y + Math.sin(a0) * 60); l.x = p0.x; l.y = p0.y; luta.emit({ t: 'nuvemBriga', x: l.x, y: l.y, dur: 0.3 }); return; }
    const n = h.golpes ?? 4, dur = h.dur ?? 0.6, a = Math.atan2(r.y - l.y, r.x - l.x);
    const p = fijarCampo(r.x - Math.cos(a) * 16, r.y - Math.sin(a) * 10);
    l.x = p.x; l.y = p.y; l.angulo = a;
    l.ponerEstado('invul', dur + 0.15);
    l.accion = { hasta: luta.t + dur + 0.1, bloquea: true, lento: 0, angulo: a };
    this.prender(r, dur);
    luta.emit({ t: 'nuvemBriga', x: (l.x + r.x) / 2, y: (l.y + r.y) / 2, dur });
    for (let i = 0; i < n; i++) luta.programar((i + 1) * (dur / (n + 1)), () => {
      if (l.ko || r.ko) return;
      atingir(l, r, pacote(h, extra, a, { dano: h.dano / n, empuje: i === n - 1 ? 120 : 0, aturde: i === n - 1 ? 0.3 : 0.05 }));
      luta.emit({ t: 'socoNuvem', x: r.x + entre(-10, 10), y: r.y - r.alto * 0.5 + entre(-8, 8) });
    });
  },

  // ---------------------------------------------------------------- Trick Room (Mimikyu): uma sala distorcida; dentro dela o rival fica lento
  // e o Mimikyu mais rápido
  salaTruque(l, h) {
    const luta = this.luta, R = h.radio ?? 95, dur = h.dur ?? 4.5;
    l.animar(h.anim ?? 'Charge', 0.4);
    l.accion = { hasta: luta.t + 0.25, lento: 0.3 };
    luta.emit({ t: 'salaTruque', x: l.x, y: l.y, radio: R });
    const e = { tipo: 'salaTruque', dueno: l, vivo: true, x: l.x, y: l.y, radio: R, t: 0, dur, update: dt => {
      e.t += dt;
      for (const b of luta.blancos(l)) if (!b.esClon && Math.hypot(b.x - e.x, (b.y - e.y) / 0.62) < R) b.ponerEstado('lento', 0.2, { f: h.ralentiza ?? 0.4 });
      for (const a of [l, ...luta.aliados(l)]) if (Math.hypot(a.x - e.x, (a.y - e.y) / 0.62) < R) a.ponerEstado('rapido', 0.2, { vel: h.acelera ?? 1.3 });
      return e.t < dur && !l.ko;
    } };
    luta.add(e);
  },

  // ---------------------------------------------------------------- Let's Snuggle Forever (Mimikyu): agarra o rival e puxa para baixo do pano;
  // lá dentro é só pancada, e no fim ele sai voando
  abraco(l, h, extra) {
    const luta = this.luta, r = maisPerto(luta, l, h.alcance ?? 150);
    if (!r) { if (l.humano) l.avisar('abraco', () => l.texto('NO TARGET', '#f9a8d4')); return false; }
    const dur = h.dur ?? 1.4, n = h.golpes ?? 6, a = Math.atan2(r.y - l.y, r.x - l.x);
    const p = fijarCampo(r.x - Math.cos(a) * 10, r.y - Math.sin(a) * 6);
    l.x = p.x; l.y = p.y; l.angulo = a;
    l.ponerEstado('invul', dur + 0.3);
    l.ponerEstado('panoAbraco', dur, { alvo: r });
    l.accion = { hasta: luta.t + dur + 0.2, bloquea: true, lento: 0, angulo: a };
    this.prender(r, dur + 0.05);
    luta.emit({ t: 'abraco', l, b: r, dur });
    for (let i = 0; i < n; i++) luta.programar(0.15 + i * ((dur - 0.2) / n), () => {
      if (l.ko || r.ko) return;
      const ult = i === n - 1;
      atingir(l, r, pacote(h, extra, a, { dano: (h.dano / (n + 1)) * (ult ? 2 : 1), empuje: 0, aturde: 0.05 }));
      luta.emit({ t: 'socoNuvem', x: r.x + entre(-12, 12), y: r.y - r.alto * 0.5 + entre(-10, 10), forte: ult });
      if (ult) { this.lanzarAlto(r, 0.6, 50); luta.emit({ t: 'temblor', f: 0.016 }); }
    });
  },

  // ---------------------------------------------------------------- arco carregado (Decidueye): segure para puxar a corda; ao soltar, a flecha
  // sai mais rápida, mais longe e mais forte quanto mais carregou
  arcoCarga(l, h, extra) {
    const luta = this.luta, max = h.carga ?? 1.2, min = h.cargaMin ?? 0.3;
    let t = 0, solto = false;
    l.animar(h.anim ?? 'Charge', max + 0.2);
    luta.emit({ t: 'arcoPuxa', l, max });
    l.accion = { hasta: luta.t + max + 0.4, bloquea: true, lento: 0.45, angulo: angApunte(l),
      update: dt => {
        t += dt;
        l.accion.angulo = angApunte(l); l.carga = Math.min(1, t / max);
        if (!l.intento?.[extra.slot]) solto = true;
        if (solto && t >= min || t >= max) {
          const k = Math.min(1, t / max), a = mirar(l, 400, 0.4);
          const hh = { ...h, dano: h.dano * (0.45 + 0.75 * k), vel: (h.vel ?? 360) + 340 * k, alcance: (h.alcance ?? 200) + 180 * k, escala: (h.escala ?? 1.4) * (1 + 0.4 * k), estilo: h.estilo ?? 'flechaFolha' };
          luta.add(new Proyectil(luta, l, hh, a, extra));
          luta.emit({ t: 'arcoSolta', l, k, ang: a });
          l.animar('Shoot', 0.25); l.carga = 0;
          l.accion = { hasta: luta.t + 0.12, lento: 0.6, angulo: a };
        }
      },
      fin: () => { l.carga = 0; } };
  },

  // ---------------------------------------------------------------- Sinister Arrow Raid (Decidueye): pula para fora da tela e uma chuva de
  // flechas fantasmas cai em volta do rival
  chuvaFlechas(l, h, extra) {
    const luta = this.luta, r = l.rival, alvo = r && !r.ko ? { x: r.x, y: r.y } : fijarCampo(l.ax, l.ay), n = h.n ?? 12, sobe = 0.35;
    l.cortarAccion();
    l.ponerEstado('vuelo', sobe + n * (h.cada ?? 0.07) + 0.5, { oculto: true, modo: 'aire', rapidez: 0 });
    luta.emit({ t: 'pulaCeu', l });
    for (let i = 0; i < n; i++) luta.programar(sobe + i * (h.cada ?? 0.07), () => {
      if (l.ko) return;
      const rr = l.rival, cx = rr && !rr.ko ? rr.x : alvo.x, cy = rr && !rr.ko ? rr.y : alvo.y, a = (i * 2.4) % 6.28, d = i === 0 ? 0 : 12 + ((i * 37) % (h.area ?? 60));
      const p = fijarCampo(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.62);
      luta.emit({ t: 'flechaCai', x: p.x, y: p.y, queda: 0.22 });
      luta.programar(0.22, () => { if (!l.ko) areaCirculo(luta, l, p.x, p.y, h.radio ?? 20, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, empuje: 20 })); });
    });
    luta.programar(sobe + n * (h.cada ?? 0.07) + 0.4, () => { if (l.ko) return; delete l.est.vuelo; const p = fijarCampo(alvo.x - 60, alvo.y); l.x = p.x; l.y = p.y; luta.emit({ t: 'pousa', l }); });
  },

  // ---------------------------------------------------------------- Ring of Blades (Ceruledge): três espadas de chama giram em volta dele e
  // cortam quem encosta
  espadasOrbita(l, h, extra) {
    const luta = this.luta, dur = h.dur ?? 4, R = h.raio ?? 36, n = h.n ?? 3;
    l.animar(h.anim ?? 'Charge', 0.3);
    l.ponerEstado('espadasGiram', dur, { n, R });
    luta.emit({ t: 'espadasNascem', l });
    const ultimo = new Map();
    luta.add({ tipo: 'orbitaEspadas', dueno: l, vivo: true, t: 0, update(dt) {
      this.t += dt;
      for (let k = 0; k < n; k++) {
        const a = luta.t * 5 + (k / n) * Math.PI * 2, x = l.x + Math.cos(a) * R, y = l.y + Math.sin(a) * R * 0.62;
        for (const b of luta.blancos(l)) {
          const chave = b.lado * 10 + k;
          if (b.oculto || Math.hypot(b.x - x, b.y - y) > RADIO + 8 || luta.t - (ultimo.get(chave) ?? -9) < 0.5) continue;
          ultimo.set(chave, luta.t);
          atingir(l, b, pacote(h, extra, a + Math.PI / 2, { empuje: 50, espada: true }));
          luta.emit({ t: 'corteEspada', x: b.x, y: b.y - b.alto * 0.5 });
        }
      }
      return this.t < dur && !l.ko;
    } });
  },

  // ---------------------------------------------------------------- Bitter Malice (Ceruledge): uma espada gigante de fogo fantasma cai do céu
  // no lugar do rival e solta uma onda de chamas
  espadaGigante(l, h, extra) {
    const luta = this.luta, r = l.rival, alvo = r && !r.ko ? { x: r.x, y: r.y } : fijarCampo(l.ax, l.ay), R = h.radio ?? 64, queda = h.queda ?? 0.7;
    l.animar(h.anim ?? 'Charge', 0.7);
    l.accion = { hasta: luta.t + 0.4, bloquea: true, lento: 0 };
    luta.emit({ t: 'espadaCai', x: alvo.x, y: alvo.y, radio: R, queda });
    luta.programar(queda, () => {
      if (l.ko) return;
      luta.emit({ t: 'espadaImpacto', x: alvo.x, y: alvo.y, radio: R });
      luta.emit({ t: 'temblor', f: 0.02 });
      areaCirculo(luta, l, alvo.x, alvo.y, R, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, empuje: 120, aturde: 0.5, pesado: true, quema: { dps: 3, dur: 3, max: 3 } }));
    });
  },

  // ---------------------------------------------------------------- Sing (Lapras): notas musicais saem em leque; quem elas pegam dorme
  cancao(l, h, extra) {
    const luta = this.luta, a = mirar(l, (h.alcance ?? 140) + 30, 1), meio = ((h.angulo ?? 70) * Math.PI) / 360;
    l.animar(h.anim ?? 'Charge', 0.6);
    l.accion = { hasta: luta.t + 0.45, lento: 0.2, angulo: a };
    luta.emit({ t: 'cancao', l, ang: a, alcance: h.alcance ?? 140, angulo: h.angulo ?? 70 });
    luta.programar(0.3, () => {
      if (l.ko) return;
      for (const b of luta.blancos(l)) {
        const dx = b.x - l.x, dy = b.y - l.y, d = Math.hypot(dx, dy), da = Math.abs(((Math.atan2(dy, dx) - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (b.oculto || d > (h.alcance ?? 140) + RADIO || da > meio + 0.15) continue;
        atingir(l, b, pacote(h, extra, a, { empuje: 0 }));
      }
    });
  },

  // ---------------------------------------------------------------- Surf (Lapras): monta numa onda gigante que corre para onde você guia;
  // quem a onda pega é arrastado junto
  surfar(l, h, extra) {
    const luta = this.luta, dur = h.dur ?? 2.4;
    l.ponerEstado('surf', dur, { vel: h.vel ?? 1.9 });
    l.ponerEstado('blindaje', dur, { reduce: 0.3 });
    luta.emit({ t: 'surfComeca', l });
    const ultimo = new Map();
    luta.add({ tipo: 'onda', dueno: l, vivo: true, x: l.x, y: l.y, ang: 0, t: 0, dur, update(dt) {
      this.t += dt; this.x = l.x; this.y = l.y;
      const v = Math.hypot(l.vx, l.vy); if (v > 10) this.ang = Math.atan2(l.vy, l.vx);
      for (const b of luta.blancos(l)) {
        if (b.oculto || Math.hypot(b.x - l.x, (b.y - l.y) / 0.7) > RADIO + 30) continue;
        b.empX += Math.cos(this.ang) * 220 * dt * 8; b.empY += Math.sin(this.ang) * 220 * dt * 8;
        if (luta.t - (ultimo.get(b) ?? -9) < 0.5) continue;
        ultimo.set(b, luta.t);
        atingir(l, b, pacote(h, extra, this.ang, { empuje: 60 }));
      }
      return this.t < dur && !l.ko;
    } });
  },
});

// Parental Bond (Kangaskhan): o filhote repete o golpe logo depois, mais fraco — de perto um soquinho, de longe uma ondinha
export function ecoFilhote(hab, l, h, slot, extra) {
  const luta = hab.luta;
  if (!h.dano) return;
  if (l.est.semFilhote) return; // o filhote está grudado no rival
  // na Mega o filhote anda do lado e repete tudo: a mãe bate duas vezes
  const k = l.mega ? 0.5 : 0.28;
  luta.programar(0.18, () => {
    if (l.ko || l.est.aturdido || l.est.dormido) return;
    const r = l.rival, ang = r && !r.ko ? Math.atan2(r.y - l.y, r.x - l.x) : angApunte(l), ca = Math.cos(ang), sa = Math.sin(ang);
    const ox = l.mega ? l.x - Math.sin(ang) * 18 : l.x, oy = l.mega ? l.y + Math.cos(ang) * 10 : l.y;
    const perto = r && !r.ko && Math.hypot(r.x - ox, r.y - oy) < 70;
    luta.emit({ t: 'ecoFilhote', l, ang, perto });
    if (perto) areaCirculo(luta, l, ox + ca * 30, oy + sa * 20, 22, { dano: h.dano * k, tipo: 'NORMAL', slot, surge: extra.surge, dirX: ca, dirY: sa, empuje: 30 });
    else luta.add(new Proyectil(luta, l, { nombre: 'Joey', dano: h.dano * k, tipo: 'NORMAL', vel: 340, alcance: 190, radio: 4, escala: 1, estilo: 'eco' }, ang, { slot, desde: { x: ox, y: oy, alt: 10 } }));
  });
}


// ================================================================ Gengar (Gengar e Mega Gengar)
// alvos de verdade (sem clones nem escondidos) que estão dormindo, do mais perto ao mais longe
function dormindoPerto(luta, l, alcance) {
  let m = null, dm = alcance;
  for (const b of luta.blancos(l)) {
    if (b.esClon || b.oculto || !b.est.dormido) continue;
    const d = Math.hypot(b.x - l.x, b.y - l.y);
    if (d < dm) { dm = d; m = b; }
  }
  return m;
}
export const temDormindo = (luta, l, alcance = 340) => !!dormindoPerto(luta, l, alcance);

Object.assign(formasNovas, {
  // ---------------------------------------------------------------- Lick (básico do Gengar): linguada curta em linha; cada lambida marca o
  // rival com um fantasminha e, com a marca cheia, ele fica paralisado
  linguada(l, h, extra) {
    const luta = this.luta, alc = h.alcance ?? 72, a = mirar(l, alc + 40, 0.9), ca = Math.cos(a), sa = Math.sin(a);
    l.animar(h.anim ?? 'Attack', 0.3); l.angulo = a;
    let alvo = null, melhor = Infinity;
    for (const b of luta.blancos(l)) {
      if (b.oculto || b.est?.vuelo) continue;
      const dx = b.x - l.x, dy = b.y - l.y, lon = dx * ca + dy * sa, lat = Math.abs(-dx * sa + dy * ca);
      if (lon < -6 || lon > alc + RADIO || lat > RADIO + 8 || lon >= melhor) continue;
      melhor = lon; alvo = b;
    }
    luta.emit({ t: 'lingua', l, ang: a, alcance: alvo ? Math.max(20, melhor) : alc, pegou: !!alvo, curta: true });
    if (!alvo) return;
    luta.programar(0.08, () => {
      if (l.ko || alvo.ko) return;
      const res = atingir(l, alvo, pacote(h, extra, a, { empuje: 18 }));
      if (res !== 'golpe' || alvo.esClon) return;
      const n = (alvo.est.marcaFantasma?.n ?? 0) + 1, max = h.stacks ?? 4;
      if (n >= max) {
        delete alvo.est.marcaFantasma;
        alvo.ponerEstado('aturdido', h.paralisa ?? 0.8);
        alvo.ponerEstado('paralizado', 2.5, {});
        alvo.texto('PARALYZED!', '#e9d5ff');
        luta.emit({ t: 'paralisiaFantasma', b: alvo, l });
        luta.hitstop(70);
      } else { alvo.est.marcaFantasma = { n, max, hasta: luta.t + 4 }; luta.emit({ t: 'marcaFantasma', b: alvo, n }); }
    });
  },

  // ---------------------------------------------------------------- Shadow Sneak (Gengar): só com alguém dormindo; some e aparece nas costas
  // dele, e o próximo golpe sai mais forte
  teleSono(l, h) {
    const luta = this.luta, b = dormindoPerto(luta, l, h.alcance ?? 340);
    if (!b) { if (l.humano) l.avisar('teleSono', () => l.texto('TARGET MUST BE ASLEEP', '#c4b5fd')); return false; }
    const x0 = l.x, y0 = l.y, costas = (b.angulo ?? 0) + Math.PI, p = fijarCampo(b.x + Math.cos(costas) * 26, b.y + Math.sin(costas) * 16);
    l.cortarAccion();
    l.x = p.x; l.y = p.y; l.vx = l.vy = 0; l.angulo = Math.atan2(b.y - l.y, b.x - l.x);
    l.ponerEstado('invul', 0.25);
    l.ponerEstado('emboscada', h.dur ?? 1.6, { f: h.bonus ?? 1.5 });
    l.texto('BEHIND YOU', '#c4b5fd');
    luta.emit({ t: 'passoSombra', l, x0, y0, x1: p.x, y1: p.y });
  },

  // ---------------------------------------------------------------- Phantom Force (ult do Gengar): mergulha na própria sombra e anda
  // submerso; apertando de novo (ou no fim do tempo) sobe com um fantasma gigante atrás e dano em área
  mergulhoFantasma(l, h, extra) {
    const luta = this.luta, dur = h.dur ?? 2.4;
    l.animar('Hop', 0.3);
    l.cortarAccion();
    l.ponerEstado('vuelo', dur + 0.2, { oculto: true, rapidez: h.rapidez ?? 1.7, modo: 'fantasma' });
    luta.emit({ t: 'mergulhoFantasma', l });
    let t = 0, solto = false, saiu = false;
    const subir = () => {
      if (saiu) return; saiu = true;
      delete l.est.vuelo; l.salto = 0;
      l.ponerEstado('invul', 0.5);
      l.accion = { hasta: luta.t + 0.45, bloquea: true, lento: 0 };
      l.animar('Attack', 0.5);
      luta.emit({ t: 'fantasmaGigante', l, x: l.x, y: l.y, radio: h.radio ?? 80 });
      luta.programar(0.22, () => {
        if (l.ko) return;
        areaCirculo(luta, l, l.x, l.y, h.radio ?? 80, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, pesado: true, aturde: h.aturde ?? 0.6, empuje: 110 }));
        luta.emit({ t: 'impactoFantasma', x: l.x, y: l.y, radio: h.radio ?? 80 });
        luta.emit({ t: 'temblor', f: 0.012 }); luta.hitstop(90);
      });
    };
    luta.add({ tipo: 'vuelo', dueno: l, vivo: true, x: l.x, y: l.y, update: dt => {
      t += dt;
      if (l.ko) return false;
      const pulsa = l.intento?.[extra.slot];
      if (!pulsa) solto = true;
      if (t >= dur || (t > 0.45 && pulsa && solto)) { subir(); return false; }
      return true;
    } });
  },

  // ---------------------------------------------------------------- Phantom Feast (ult da Mega Gengar): uma boca de fantasma gigante abre
  // embaixo do rival, puxa todo mundo perto e morde duas vezes; quem está dormindo leva mais
  bocaFantasma(l, h, extra) {
    const luta = this.luta, r = maisPerto(luta, l, h.alcance ?? 320) ?? (l.rival && !l.rival.ko ? l.rival : null);
    const x = r ? r.x : l.ax, y = r ? r.y : l.ay, R = h.radio ?? 90, espera = h.espera ?? 0.55, n = h.golpes ?? 2;
    l.animar(h.anim ?? 'Charge', 0.7);
    l.accion = { hasta: luta.t + 0.4, lento: 0.2 };
    l.texto('PHANTOM FEAST!', '#e9d5ff');
    luta.emit({ t: 'bocaFantasma', x, y, radio: R, espera, golpes: n });
    // puxa para o centro enquanto a boca abre
    luta.programar(espera * 0.4, () => {
      for (const b of luta.blancos(l)) if (!b.esClon && !b.oculto && dentroElipse(b, x, y, R * 1.25)) arrastar(luta, b, x + (b.x - x) * 0.2, y + (b.y - y) * 0.2, espera * 0.5, 4);
    });
    for (let i = 0; i < n; i++) luta.programar(espera + i * 0.4, () => {
      if (l.ko) return;
      for (const b of luta.blancos(l)) {
        if (b.oculto || !dentroElipse(b, x, y, R)) continue;
        const sono = b.est.dormido ? (h.contraSono ?? 1.5) : 1;
        atingir(l, b, pacote(h, extra, Math.atan2(b.y - y, b.x - x), { dano: (h.dano / n) * sono, empuje: i === n - 1 ? 140 : 10, aturde: i === n - 1 ? 0.5 : 0.25, pesado: i === n - 1 }));
      }
      luta.emit({ t: 'mordidaFantasma', x, y, radio: R, ultima: i === n - 1 });
      luta.emit({ t: 'temblor', f: 0.01 }); luta.hitstop(70);
    });
  },
});
