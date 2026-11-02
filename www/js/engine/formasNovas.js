// Mecânicas dos Pokémon da última leva (Gengar, Gardevoir, Kangaskhan, Rayquaza, Zeraora e Darkrai).
// Cada função é uma "forma" como as de habilidades.js: recebe (l, h, extra) com `this` = Habilidades.
import { RADIO } from '../config.js';
import { fijarCampo } from './fisica.js';
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

// Parental Bond (Kangaskhan): o filhote repete o golpe logo depois, mais fraco — de perto um soquinho, de longe uma ondinha
export function ecoFilhote(hab, l, h, slot, extra) {
  const luta = hab.luta;
  if (!h.dano) return;
  const k = l.mega ? 0.5 : 0.35;
  luta.programar(0.18, () => {
    if (l.ko || l.est.aturdido || l.est.dormido) return;
    const r = l.rival, ang = r && !r.ko ? Math.atan2(r.y - l.y, r.x - l.x) : angApunte(l), ca = Math.cos(ang), sa = Math.sin(ang);
    const perto = r && !r.ko && Math.hypot(r.x - l.x, r.y - l.y) < 70;
    luta.emit({ t: 'ecoFilhote', l, ang, perto });
    if (perto) areaCirculo(luta, l, l.x + ca * 30, l.y + sa * 20, 22, { dano: h.dano * k, tipo: 'NORMAL', slot, surge: extra.surge, dirX: ca, dirY: sa, empuje: 30 });
    else luta.add(new Proyectil(luta, l, { nombre: 'Joey', dano: h.dano * k, tipo: 'NORMAL', vel: 340, alcance: 190, radio: 4, escala: 1, estilo: 'eco' }, ang, { slot }));
  });
}
