// Kits de Gigalith, Slowbro e Drampa (e o tiro em leque teleguiado da Tatsugiri). `h.mega` muda o que a skill faz.
import { RADIO } from '../config.js';
import { fijarCampo } from './fisica.js';
import { areaCirculo, pacote, atingir, Humo } from './entidades.js';

const angApunte = l => Math.atan2(l.ay - l.y, l.ax - l.x);
const dAng = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const dentro = (b, x, y, r) => Math.hypot(b.x - x, (b.y - y) / 0.62) < r;
const inimigos = (luta, l) => luta.blancos(l).filter(b => !b.oculto && !b.est?.vuelo && !b.ko);
const aliados = (luta, l) => [l, ...luta.aliados(l)];
function maisPerto(luta, l, alc, de = l) { let m = null, dm = alc; for (const b of inimigos(luta, l)) { const d = Math.hypot(b.x - de.x, b.y - de.y); if (d < dm && !b.esClon) { dm = d; m = b; } } return m; }
function mirar(l, alc) { const r = l.rival, a = angApunte(l); if (!r || r.ko || r.oculto) return a; const ar = Math.atan2(r.y - l.y, r.x - l.x); return Math.hypot(r.x - l.x, r.y - l.y) < alc && Math.abs(dAng(ar, a)) < 0.8 ? ar : a; }
function puxar(b, x, y, forca, dt) { const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy) || 1; if (d < 8) return; b.empX += (dx / d) * forca * dt; b.empY += (dy / d) * forca * dt; }
function jogarAlto(luta, b, dur = 1, alto = 50) { const x0 = b.x, y0 = b.y; let t = 0; luta.add({ tipo: 'lanzado', dueno: null, vivo: true, update: dt => { t += dt; if (b.ko) { b.salto = 0; return false; } b.x = x0; b.y = y0; b.salto = Math.round(Math.sin(Math.min(1, t / dur) * Math.PI) * alto); if (t < dur) return true; b.salto = 0; return false; } }); }
// apaga os tiros inimigos que entram no círculo
function bloquearTiros(luta, l, x, y, r) { for (const o of luta.entidades) if ((o.tipo === 'proj' || o.bloqueavel) && o.vivo !== false && o.dueno && o.dueno.equipo !== l.equipo && Math.hypot(o.x - x, (o.y - y) / 0.62) < r) { o.vivo = false; luta.emit({ t: 'tiroBloqueado', x: o.x, y: o.y }); } }

export const formasKits8 = {
  // ================================================================ TIRO EM LEQUE (Tatsugiri: Dragon Scale; Gigalith: Canhão de Pedra)
  // n tiros em leque; `segue` faz cada um virar atrás do inimigo mais perto; `fura` atravessa; na Mega da Tatsugiri,
  // 3 acertos no mesmo alvo silenciam
  leque(l, h, extra) {
    const luta = this.luta, n = h.n ?? 3, a = mirar(l, (h.alcance ?? 220) + 20), abre = h.abre ?? 0.5, vel = h.vel ?? 330, acertos = new Map();
    l.animar(h.anim ?? 'Shoot', 0.3); l.accion = { hasta: luta.t + (h.planta ?? 0.2), lento: h.planta ? 0 : 0.3, bloquea: !!h.planta, angulo: a };
    for (let i = 0; i < n; i++) {
      const ja = new Set(); let ang = a + (n > 1 ? (i / (n - 1) - 0.5) * abre : 0), alvo = h.segue ? maisPerto(luta, l, (h.alcance ?? 220) + 60) : null;
      const p = { tipo: h.visual ?? 'escamaDraco', dueno: l, vivo: true, bloqueavel: true, x: l.x + Math.cos(ang) * 10, y: l.y + Math.sin(ang) * 6, ang, t: 0, mega: !!h.mega, update: dt => {
        p.t += dt;
        if (alvo && !alvo.ko && p.t > 0.08) ang += Math.max(-h.segue * dt, Math.min(h.segue * dt, dAng(Math.atan2(alvo.y - p.y, alvo.x - p.x), ang)));
        p.ang = ang; p.x += Math.cos(ang) * vel * dt; p.y += Math.sin(ang) * vel * dt * 0.85;
        for (const b of inimigos(luta, l)) {
          if (ja.has(b) || Math.hypot(b.x - p.x, b.y - p.y) > RADIO + 5) continue;
          ja.add(b); atingir(l, b, pacote(h, extra, ang, { dano: h.dano / n * (h.multi ?? 1.6), empuje: 15, ralentiza: h.lento ? { f: h.lento, dur: h.lentoDur ?? 2 } : undefined }));
          luta.emit({ t: 'acertoLeque', x: b.x, y: b.y - b.alto * 0.5, visual: p.tipo });
          if (h.quebra) b.ponerEstado('defBaja', h.quebra, {});
          const k = (acertos.get(b) ?? 0) + 1; acertos.set(b, k);
          if (h.silencia3 && k === 3) { b.ponerEstado('silencio', 1.2, {}); b.texto('SILENCED!', '#c4b5fd'); }
          if (!h.fura) return false;
        }
        return p.t < (h.alcance ?? 220) / vel;
      } };
      luta.add(p);
    }
  },

  // ================================================================ GIGALITH
  // Descarga Cristalina (Mega): feixe contínuo de energia pelos cristais por 1,5s, atravessa e quebra a armadura
  raioCristal(l, h, extra) {
    const luta = this.luta, dur = h.dur ?? 1.5, L = h.largo ?? 300, W = h.ancho ?? 22, carga = h.carga ?? 0.35;
    let a = mirar(l, L), t = 0, prox = carga;
    l.animar('Charge', dur + carga);
    luta.emit({ t: 'cargaCristal', l, dur: carga });
    const e = { tipo: 'feixeCristal', dueno: l, vivo: true, x: l.x, y: l.y, ang: a, largo: L, ancho: W, t: 0, carga, dur };
    l.accion = { hasta: luta.t + carga + dur, bloquea: true, lento: 0, angulo: a, update: dt => {
      t += dt; e.t = t;
      // o feixe vira devagar atrás da mira
      a += Math.max(-1.2 * dt, Math.min(1.2 * dt, dAng(angApunte(l), a))); e.ang = a; e.x = l.x; e.y = l.y; l.angulo = a;
      if (t < prox) return; prox += 0.15;
      const ux = Math.cos(a), uy = Math.sin(a);
      for (const b of inimigos(luta, l)) { const qx = b.x - l.x, qy = b.y - l.y, lon = qx * ux + qy * uy, lat = Math.abs(-qx * uy + qy * ux); if (lon < 0 || lon > L || lat > W / 2 + RADIO) continue; atingir(l, b, pacote(h, extra, a, { dano: h.dano * 0.15 / dur * 1.5, empuje: 20, tick: true })); b.ponerEstado('defBaja', 3, {}); }
    }, fin: () => { e.vivo = false; } };
    e.update = () => e.vivo && t < carga + dur; luta.add(e);
  },
  // Fortaleza Sísmica: 2 pilares de pedra na frente que seguram tiros inimigos e empurram quem estava no lugar.
  // Mega: semicírculo de espinhos de cristal em volta, escudo e reflete 20% do dano de básicos
  fortaleza(l, h, extra) {
    const luta = this.luta, a = mirar(l, 200), dur = h.dur ?? 4;
    l.animar('Charge', 0.4); l.accion = { hasta: luta.t + 0.25, bloquea: true, lento: 0, angulo: a };
    luta.emit({ t: 'temblor', f: 0.008 });
    const pts = h.mega ? Array.from({ length: 7 }, (_, i) => { const ang = a - Math.PI / 2 + (i / 6) * Math.PI; return fijarCampo(l.x + Math.cos(ang) * 46, l.y + Math.sin(ang) * 30); })
      : [-1, 1].map(s => fijarCampo(l.x + Math.cos(a) * 50 + Math.cos(a + Math.PI / 2) * s * 22, l.y + Math.sin(a) * 34 + Math.sin(a + Math.PI / 2) * s * 14));
    for (const p of pts) for (const b of inimigos(luta, l)) if (dentro(b, p.x, p.y, h.mega ? 22 : 26)) { const dx = b.x - l.x, dy = b.y - l.y, d = Math.hypot(dx, dy) || 1; atingir(l, b, pacote(h, extra, 0, { dirX: dx / d, dirY: dy / d, empuje: 170 })); }
    if (h.mega) { l.escudo = Math.max(l.escudo ?? 0, h.escudo ?? 24); l.ponerEstado('escudo', dur, {}); l.ponerEstado('refleteBasico', dur, { f: h.reflete ?? 0.2 }); }
    luta.emit({ t: 'sobePilar', pts, mega: !!h.mega });
    const e = { tipo: h.mega ? 'espinhosCristal' : 'pilaresPedra', dueno: l, vivo: true, pts, t: 0, dur, update: dt => { e.t += dt; for (const p of pts) bloquearTiros(luta, l, p.x, p.y, h.mega ? 18 : 24); return e.t < dur; } };
    luta.add(e);
  },
  // Núcleo Solar: canaliza 1s e solta uma onda sísmica em volta (muito dano e joga para o alto)
  ondaSismica(l, h, extra) {
    const luta = this.luta, c = h.carga ?? 1, R = h.radio ?? 110;
    l.cortarAccion(); l.animar('Charge', c + 0.2); l.accion = { hasta: luta.t + c + 0.15, bloquea: true, lento: 0 };
    l.ponerEstado('blindaje', c, { reduce: 0.3 });
    luta.emit({ t: 'cargaSismica', l, dur: c, r: R });
    luta.programar(c, () => {
      if (l.ko) return;
      for (const b of inimigos(luta, l)) if (dentro(b, l.x, l.y, R)) { atingir(l, b, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, empuje: 0, aturde: 1, pesado: true })); jogarAlto(luta, b, 1, 52); }
      luta.emit({ t: 'ondaSismica', x: l.x, y: l.y, r: R }); luta.emit({ t: 'temblor', f: 0.02 }); luta.hitstop(120);
    });
  },
  // Cataclismo de Geoda (Mega): o chão em volta vira um campo de geodo por 4s: dano por segundo, 50% de lentidão e
  // quem usar skill lá dentro explode
  campoGeoda(l, h, extra) {
    const luta = this.luta, R = h.radio ?? 130, dur = h.dur ?? 4, x = l.x, y = l.y;
    l.animar('Charge', 0.5); l.accion = { hasta: luta.t + 0.4, bloquea: true, lento: 0 };
    luta.emit({ t: 'ondaSismica', x, y, r: R * 0.6 }); luta.emit({ t: 'temblor', f: 0.014 });
    const explode = b => { b.recibir(l, { dano: h.danoExplosao ?? 9, tipo: 'ROCK', empuje: 80, dirX: 0, dirY: -1, aturde: 0.4 }); luta.emit({ t: 'explodeGeoda', x: b.x, y: b.y }); b.texto('GEODE BURST!', '#f87171'); };
    const e = { tipo: 'campoGeoda', dueno: l, vivo: true, x, y, radio: R, t: 0, dur, prox: 0.4, update: dt => {
      e.t += dt;
      for (const b of inimigos(luta, l)) if (dentro(b, x, y, R)) { b.ponerEstado('lento', 0.3, { f: Math.max(0.5, b.est.lento?.f ?? 0) }); b.ponerEstado('geoda', 0.3, { fn: explode }); }
      if (e.t >= e.prox) { e.prox += 0.5; for (const b of inimigos(luta, l)) if (dentro(b, x, y, R)) b.recibir(l, { dano: h.danoTick ?? 2, tipo: 'ROCK', tick: true }); }
      return e.t < dur && !l.ko;
    } };
    luta.add(e);
  },

  // ================================================================ SLOWBRO
  // Bocejo Contagioso: bolha lenta; quem leva fica 40% mais lento por 1,5s e depois dorme 1s.
  // Mega: estoura em área e todo mundo dorme 1,8s (acordar apanhando dá dano crítico)
  bolhaSono(l, h, extra) {
    const luta = this.luta, a = mirar(l, 240), vel = h.vel ?? 150, alc = h.alcance ?? 220;
    l.animar('Shoot', 0.4); l.accion = { hasta: luta.t + 0.25, lento: 0.3, angulo: a };
    const estoura = (x, y) => {
      luta.emit({ t: 'estouraSono', x, y, r: h.mega ? 64 : 24 });
      if (!h.mega) return;
      for (const b of inimigos(luta, l)) if (dentro(b, x, y, h.radio ?? 64)) atingir(l, b, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, empuje: 0, duerme: h.duerme ?? 1.8 }));
    };
    const p = { tipo: 'bolhaSono', dueno: l, vivo: true, bloqueavel: true, x: l.x + Math.cos(a) * 12, y: l.y + Math.sin(a) * 8, ang: a, t: 0, mega: !!h.mega, update: dt => {
      p.t += dt; p.x += Math.cos(a) * vel * dt; p.y += Math.sin(a) * vel * dt * 0.85;
      const b = inimigos(luta, l).find(o => Math.hypot(o.x - p.x, o.y - p.y) < RADIO + 9);
      if (b) {
        if (h.mega) { estoura(p.x, p.y); return false; }
        atingir(l, b, pacote(h, extra, a, { empuje: 10, ralentiza: { f: 0.4, dur: 1.5 } }));
        b.texto('DROWSY...', '#f9a8d4'); luta.emit({ t: 'estouraSono', x: p.x, y: p.y, r: 24 });
        luta.programar(1.5, () => { if (!b.ko && !l.ko) { b.ponerEstado('dormido', h.duerme ?? 1, { cura: 0, acum: 0 }); b.cortarAccion(); b.texto('ASLEEP!', '#a5b4fc'); luta.emit({ t: 'dormiu', l: b }); } });
        return false;
      }
      if (p.t >= alc / vel) { if (h.mega) estoura(p.x, p.y); return false; }
      return true;
    } };
    luta.add(p);
  },
  // Amnésia Defensiva: senta, recupera 20% da vida perdida e fica imune a controle por 1s.
  // Mega: o Shellder engole o corpo por 2s: intocável, regenera e, ao sair, devolve 40% do que teria levado em explosão
  amnesia(l, h, extra) {
    const luta = this.luta;
    l.cortarAccion();
    if (!h.mega) {
      l.cura((l.hpMax - l.hp) * (h.cura ?? 0.2)); for (const k of ['aturdido', 'paralizado', 'dormido', 'confuso', 'enredado', 'lento', 'ancorado', 'silencio', 'debil']) delete l.est[k];
      l.ponerEstado('imuneCC', h.dur ?? 1, {}); l.animar('Sleep', 0.6); l.accion = { hasta: luta.t + 0.5, bloquea: true, lento: 0 };
      l.texto('AMNESIA', '#f9a8d4'); luta.emit({ t: 'amnesia', l }); return;
    }
    const dur = h.dur ?? 2;
    l.ponerEstado('invul', dur); l.ponerEstado('imuneCC', dur, {}); l.ponerEstado('concha', dur, { acum: 0 });
    l.accion = { hasta: luta.t + dur, bloquea: true, lento: 0 }; l.animar('Withdraw', dur);
    luta.emit({ t: 'conchaFecha', l, dur });
    let t = 0, prox = 0.25;
    luta.add({ tipo: 'conchaShellder', dueno: l, vivo: true, t: 0, dur, update(dt) {
      t += dt; this.t = t; if (l.ko) return false;
      if (t >= prox) { prox += 0.25; l.cura(l.hpMax * (h.regen ?? 0.012)); }
      if (t < dur) return true;
      const acum = l.est.concha?.acum ?? 0; delete l.est.concha;
      areaCirculo(luta, l, l.x, l.y, h.radio ?? 80, pacote(h, extra, 0, { dano: h.dano + acum * (h.devolve ?? 0.4), dirX: undefined, dirY: undefined, empuje: 160 }));
      luta.emit({ t: 'explosaoPsi', x: l.x, y: l.y, r: h.radio ?? 80 }); luta.emit({ t: 'temblor', f: 0.012 });
      return false;
    } });
  },
  // Giro do Shellder: pulso mental em 360 que inverte os controles de quem pega por 2s.
  // Mega: fecha no Shellder e gira como um pião por 3s puxando todo mundo e machucando
  giroShellder(l, h, extra) {
    const luta = this.luta;
    if (!h.mega) {
      const R = h.radio ?? 110; l.animar('Charge', 0.5); l.accion = { hasta: luta.t + 0.35, bloquea: true, lento: 0 };
      luta.programar(0.25, () => { if (l.ko) return; areaCirculo(luta, l, l.x, l.y, R, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, empuje: 40, confunde: h.confunde ?? 2 })); luta.emit({ t: 'pulsoMental', x: l.x, y: l.y, r: R }); });
      return;
    }
    const dur = h.dur ?? 3, R = h.radio ?? 150;
    l.ponerEstado('blindaje', dur, { reduce: 0.7 }); l.ponerEstado('imuneCC', dur, {}); l.ponerEstado('girando', dur); l.ponerEstado('rapido', dur, { vel: 1.15 });
    let t = 0, prox = 0.3;
    luta.add({ tipo: 'piaoShellder', dueno: l, vivo: true, t: 0, dur, radio: R, update(dt) {
      t += dt; this.t = t; if (l.ko) return false;
      for (const b of inimigos(luta, l)) if (dentro(b, l.x, l.y, R)) puxar(b, l.x, l.y, 700, dt);
      if (t >= prox) { prox += 0.3; for (const b of inimigos(luta, l)) if (dentro(b, l.x, l.y, 46)) b.recibir(l, { dano: h.danoTick ?? 3, tipo: 'PSYCHIC', tick: true, empuje: 30, dirX: Math.sign(b.x - l.x) || 1, dirY: 0 }); }
      return t < dur;
    } });
  },

  // ================================================================ DRAMPA (passiva Fúria Berserk fica em lutador.js)
  // Rugido Hipersônico: onda sonora em cone que empurra e silencia 1s. Mega: alcance enorme e turbulência que fica
  // empurrando por 2s
  rugido(l, h, extra) {
    const luta = this.luta, R = h.alcance ?? 120, abre = ((h.angulo ?? 70) * Math.PI) / 180, a = mirar(l, R + 20);
    l.animar('Charge', 0.4); l.accion = { hasta: luta.t + 0.3, bloquea: true, lento: 0, angulo: a };
    luta.emit({ t: 'rugidoAnciao', l, ang: a, R, abre, mega: !!h.mega }); luta.emit({ t: 'temblor', f: 0.01 });
    const noCone = b => { const dx = b.x - l.x, dy = b.y - l.y; return Math.hypot(dx, dy) < R + RADIO && Math.abs(dAng(Math.atan2(dy, dx), a)) < abre / 2; };
    for (const b of inimigos(luta, l)) if (noCone(b)) { atingir(l, b, pacote(h, extra, a, { empuje: 120 })); b.ponerEstado('silencio', (h.silencio ?? 1) + (l.def.berserk && l.hp < l.hpMax * 0.5 ? 0.5 : 0), {}); b.texto('SILENCED!', '#fde68a'); }
    if (!h.mega) return;
    let t = 0, prox = 0.35;
    luta.add({ tipo: 'turbulencia', dueno: l, vivo: true, x: l.x, y: l.y, ang: a, R, abre, t: 0, dur: 2, update(dt) {
      t += dt; this.t = t; if (l.ko) return false;
      if (t >= prox) { prox += 0.35; for (const b of inimigos(luta, l)) if (noCone(b)) atingir(l, b, { dano: 1.2, tipo: 'DRAGON', tick: true, dirX: Math.cos(a), dirY: Math.sin(a), empuje: 160 }); }
      return t < 2;
    } });
  },
  // Névoa Mística: nuvem por 3s: aliados dentro ficam escondidos e regeneram; inimigos dentro enxergam menos.
  // Mega: maior, segura tiros, e inimigos dentro ficam silenciados e 30% mais lentos
  nevoa(l, h) {
    const luta = this.luta, R = h.radio ?? (h.mega ? 100 : 70), dur = h.dur ?? 3, x = l.x, y = l.y;
    l.animar('Charge', 0.4);
    luta.add(new Humo(luta, l, { radio: R, dur, frena: 0.35, emboscada: 1 }));
    const e = { tipo: 'nevoaDraco', dueno: l, vivo: true, x, y, radio: R, t: 0, dur, mega: !!h.mega, prox: 0, update: dt => {
      e.t += dt;
      if (e.t >= e.prox) { e.prox += 0.5; for (const a of aliados(luta, l)) if (dentro(a, x, y, R)) a.cura(a.hpMax * (h.cura ?? 0.02)); }
      for (const b of inimigos(luta, l)) if (dentro(b, x, y, R)) { b.ponerEstado('cego', 0.3, {}); if (h.mega) { b.ponerEstado('silencio', 0.3, {}); b.ponerEstado('lento', 0.3, { f: Math.max(0.3, b.est.lento?.f ?? 0) }); } }
      if (h.mega) bloquearTiros(luta, l, x, y, R);
      return e.t < dur;
    } };
    luta.add(e);
  },
  // Fúria do Ancião: rajada de vento dracônico em linha reta (atravessa, 60% de lentidão por 2s).
  // Mega: sobe na arena e chama um meteoro dracônico no meio da briga: área enorme, joga para o alto e deixa
  // chamas azuis que tiram uma parte da vida máxima
  furiaAnciao(l, h, extra) {
    const luta = this.luta;
    if (!h.mega) {
      const a = mirar(l, 320), ja = new Set(), vel = 420, alc = h.alcance ?? 320;
      l.animar('Shoot', 0.4); l.accion = { hasta: luta.t + 0.3, bloquea: true, lento: 0, angulo: a };
      const p = { tipo: 'ventoDraco', dueno: l, vivo: true, x: l.x, y: l.y, ang: a, t: 0, update: dt => {
        p.t += dt; p.x += Math.cos(a) * vel * dt; p.y += Math.sin(a) * vel * dt * 0.85;
        for (const b of inimigos(luta, l)) { if (ja.has(b) || Math.hypot(b.x - p.x, b.y - p.y) > RADIO + 22) continue; ja.add(b); atingir(l, b, pacote(h, extra, a, { empuje: 110, ralentiza: { f: 0.6, dur: 2 }, pesado: true })); }
        return p.t < alc / vel;
      } };
      luta.add(p); luta.emit({ t: 'temblor', f: 0.01 });
      return;
    }
    const alvos = inimigos(luta, l), c = alvos.length ? fijarCampo(alvos.reduce((s, b) => s + b.x, 0) / alvos.length, alvos.reduce((s, b) => s + b.y, 0) / alvos.length) : fijarCampo(l.ax, l.ay);
    const R = h.radio ?? 130, sobe = 0.9;
    l.cortarAccion(); l.ponerEstado('invul', sobe + 0.3); l.animar('Charge', sobe + 0.3);
    l.accion = { hasta: luta.t + sobe + 0.3, bloquea: true, lento: 0, update: () => { l.salto = 34; }, fin: () => { l.salto = 0; } };
    luta.emit({ t: 'meteoroDraco', x: c.x, y: c.y, r: R, dur: sobe });
    luta.programar(sobe, () => {
      if (l.ko) return;
      for (const b of inimigos(luta, l)) if (dentro(b, c.x, c.y, R)) { atingir(l, b, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, empuje: 0, aturde: 1.2, pesado: true })); jogarAlto(luta, b, 1.2, 56); }
      luta.emit({ t: 'meteoroCai', x: c.x, y: c.y, r: R }); luta.emit({ t: 'temblor', f: 0.024 }); luta.hitstop(140);
      const e = { tipo: 'chamaAzul', dueno: l, vivo: true, x: c.x, y: c.y, radio: R * 0.85, t: 0, dur: 4, prox: 0.5, update: dt => {
        e.t += dt; if (e.t >= e.prox) { e.prox += 0.5; for (const b of inimigos(luta, l)) if (dentro(b, e.x, e.y, e.radio)) b.recibir(l, { dano: b.hpMax * (h.porVida ?? 0.015), tipo: 'DRAGON', tick: true, puro: true }); }
        return e.t < e.dur;
      } };
      luta.add(e);
    });
  },
};
