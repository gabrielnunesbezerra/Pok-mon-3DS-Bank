// Mecânicas das linhas novas (Megas que faltavam e o Aegislash). Cada função é uma "forma" como as de
// habilidades.js: recebe (l, h, extra) com `this` = Habilidades. Os desenhos estão em render/efectosMega.js.
// META diz à IA como usar cada forma e qual ícone ela mostra.
import { RADIO } from '../config.js';
import { fijarCampo } from './fisica.js';
import { pacote, atingir, areaCirculo } from './entidades.js';

const angApunte = l => Math.atan2(l.ay - l.y, l.ax - l.x);
const dentroElipse = (b, x, y, r) => Math.hypot(b.x - x, (b.y - y) / 0.62) < r;
const dAng = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const entre = (a, b) => a + Math.random() * (b - a);
const vivos = (luta, l) => luta.blancos(l).filter(b => !b.oculto && !b.ko);
function maisPerto(luta, l, alcance, de = l) {
  let m = null, dm = alcance;
  for (const b of vivos(luta, l)) { if (b.esClon) continue; const d = Math.hypot(b.x - de.x, b.y - de.y); if (d < dm) { dm = d; m = b; } }
  return m;
}
// ponto mirado: o rival mais perto da mira (até `alc`) ou a própria mira
function alvoMira(luta, l, alc) {
  const r = maisPerto(luta, l, alc, { x: l.ax, y: l.ay });
  if (r && Math.hypot(r.x - l.x, r.y - l.y) < alc) return { x: r.x, y: r.y, b: r };
  const a = angApunte(l), d = Math.min(alc, Math.hypot(l.ax - l.x, l.ay - l.y));
  return { ...fijarCampo(l.x + Math.cos(a) * d, l.y + Math.sin(a) * d), b: null };
}
// distância de b ao segmento (x0,y0)-(x1,y1)
function distSeg(b, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((b.x - x0) * dx + (b.y - y0) * dy) / L2));
  return Math.hypot(b.x - (x0 + dx * u), b.y - (y0 + dy * u));
}
const bate = (l, b, h, extra, ang, mas) => atingir(l, b, pacote(h, extra, ang, mas));
const trava = (l, luta, dur, ang) => { l.accion = { hasta: luta.t + dur, bloquea: true, lento: 0, angulo: ang }; };
const semAlvo = (l, k) => { if (l.humano) l.avisar(k, () => l.texto('NO TARGET', '#fca5a5')); return false; };

export const formasMega = {
  // ================================================================ Slowbro
  // Slack Tide (Slowbro): uma maré lenta sai em anel e vai empurrando; quem ainda estiver na água no fim adormece
  mareLenta(l, h, extra) {
    const luta = this.luta, R = h.radio ?? 130, dur = h.dur ?? 1.6;
    l.animar('Charge', 0.5); trava(l, luta, 0.35);
    l.texto('SLACK TIDE', '#7dd3fc');
    const e = { tipo: 'mareLenta', dueno: l, vivo: true, x: l.x, y: l.y, radio: R, t: 0, dur, r: 0, tocados: new Map(), update: dt => {
      e.t += dt; e.r = R * Math.min(1, e.t / dur);
      for (const b of vivos(luta, l)) {
        const d = Math.hypot(b.x - e.x, (b.y - e.y) / 0.62);
        if (Math.abs(d - e.r) > 16) continue;
        const a = Math.atan2(b.y - e.y, b.x - e.x), p = fijarCampo(b.x + Math.cos(a) * 70 * dt, b.y + Math.sin(a) * 70 * dt * 0.62);
        b.x = p.x; b.y = p.y;
        if (!e.tocados.has(b)) { e.tocados.set(b, 0); bate(l, b, h, extra, a, { dano: h.dano * 0.5, empuje: 40, ralentiza: { f: 0.5, dur: 1.5 } }); }
        e.tocados.set(b, e.tocados.get(b) + dt);
      }
      if (e.t >= dur) {
        for (const [b, s] of e.tocados) if (!b.ko && s > 0.2) { bate(l, b, h, extra, 0, { dano: h.dano * 0.5, duerme: h.duerme ?? 1.4, dirX: undefined, dirY: undefined }); luta.emit({ t: 'bocejo', x: b.x, y: b.y }); }
        return false;
      }
      return !l.ko;
    } };
    luta.add(e);
  },
  // Shell Barrage (Mega Slowbro): entra na concha (blindado) e dispara três voltas de conchas giratórias em espiral
  conchaGiro(l, h, extra) {
    const luta = this.luta, voltas = h.voltas ?? 3, n = h.n ?? 8, dur = 0.35 * voltas + 0.3;
    l.animar('Withdraw', dur); trava(l, luta, dur);
    l.ponerEstado('blindaje', dur, { reduce: 0.6 });
    l.texto('SHELL BARRAGE!', '#f9a8d4');
    for (let v = 0; v < voltas; v++) luta.programar(0.2 + v * 0.35, () => {
      if (l.ko) return;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + v * 0.4;
        const c = { tipo: 'conchaGiro', dueno: l, vivo: true, x: l.x, y: l.y, ang: a, t: 0, vel: 220, update: dt => {
          c.t += dt; c.ang += 1.6 * dt; c.x += Math.cos(c.ang) * c.vel * dt; c.y += Math.sin(c.ang) * c.vel * dt * 0.7;
          for (const b of vivos(luta, l)) if (Math.hypot(b.x - c.x, b.y - c.y) < RADIO + 6) { bate(l, b, h, extra, c.ang, { dano: h.dano / (n * 0.6) , empuje: 50 }); luta.emit({ t: 'conchaQuebra', x: c.x, y: c.y }); return false; }
          return c.t < 0.9;
        } };
        luta.add(c);
      }
      luta.emit({ t: 'temblor', f: 0.004 });
    });
  },

  // ================================================================ Aerodactyl
  // Ancient Dive (Aerodactyl): sobe ao céu e mergulha em linha reta até a mira, deixando uma fila de pontas de pedra
  mergulhoAntigo(l, h, extra) {
    const luta = this.luta, p = alvoMira(luta, l, h.alcance ?? 280), sobe = h.sobe ?? 0.45;
    l.cortarAccion(); l.animar('Hop', sobe);
    l.ponerEstado('vuelo', sobe, { oculto: true, modo: 'meteoro', rapidez: 0 });
    trava(l, luta, sobe + 0.3);
    luta.emit({ t: 'avisoLinha', x0: l.x, y0: l.y, x1: p.x, y1: p.y, dur: sobe, cor: '#d6b48a' });
    const x0 = l.x, y0 = l.y;
    luta.programar(sobe, () => {
      if (l.ko) return;
      l.x = p.x; l.y = p.y; l.animar('Attack', 0.3); l.ponerEstado('invul', 0.2);
      const a = Math.atan2(p.y - y0, p.x - x0);
      for (const b of vivos(luta, l)) if (distSeg(b, x0, y0, p.x, p.y) < RADIO + 14) bate(l, b, h, extra, a, { empuje: 120, aturde: 0.3, pesado: true });
      const n = Math.max(3, Math.round(Math.hypot(p.x - x0, p.y - y0) / 34));
      for (let i = 1; i <= n; i++) luta.programar(i * 0.05, () => {
        const x = x0 + (p.x - x0) * (i / n), y = y0 + (p.y - y0) * (i / n);
        luta.emit({ t: 'pontaPedra', x, y });
        for (const b of vivos(luta, l)) if (Math.hypot(b.x - x, b.y - y) < 20) bate(l, b, h, extra, a, { dano: h.dano * 0.08, empuje: 30, tick: true });
      });
      luta.emit({ t: 'temblor', f: 0.012 }); luta.hitstop(80);
    });
  },
  // Primal Gale (Mega Aerodactyl): circula em volta do alvo largando fósseis que caem e atordoam, e fecha com um rasante
  rasanteFossil(l, h, extra) {
    const luta = this.luta, r = maisPerto(luta, l, h.alcance ?? 300);
    if (!r) return semAlvo(l, 'rasante');
    const dur = h.dur ?? 1.4, n = h.n ?? 6, R = 70;
    l.cortarAccion(); l.ponerEstado('invul', dur); l.ponerEstado('vuelo', dur, { oculto: false, modo: 'cielo', rapidez: 0 });
    trava(l, luta, dur + 0.1);
    l.texto('PRIMAL GALE!', '#fbbf24');
    let t = 0, solto = 0;
    const cx = r.x, cy = r.y;
    luta.add({ tipo: 'rasanteFossil', dueno: l, vivo: true, update: dt => {
      t += dt;
      const a = (t / dur) * Math.PI * 2;
      const p = fijarCampo(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.62);
      l.angulo = a + Math.PI / 2; l.x = p.x; l.y = p.y;
      if (t > (solto + 1) * (dur / (n + 1)) && solto < n) {
        solto++;
        const fx = cx + entre(-30, 30), fy = cy + entre(-20, 20);
        luta.emit({ t: 'fossilCai', x: fx, y: fy, dur: 0.35 });
        luta.programar(0.35, () => { areaCirculo(luta, l, fx, fy, 24, pacote(h, extra, 0, { dano: h.dano * 0.1, aturde: 0.25, empuje: 20, dirX: undefined, dirY: undefined })); });
      }
      if (t >= dur) {
        delete l.est.vuelo;
        areaCirculo(luta, l, cx, cy, h.radio ?? 54, pacote(h, extra, 0, { dano: h.dano * 0.4, empuje: 170, aturde: h.aturde ?? 0.5, pesado: true, dirX: undefined, dirY: undefined }));
        luta.emit({ t: 'impactoFossil', x: cx, y: cy, radio: h.radio ?? 54 }); luta.emit({ t: 'temblor', f: 0.014 }); luta.hitstop(90);
        return false;
      }
      return !l.ko;
    } });
  },

  // ================================================================ Skarmory
  // Steel Strafe (Skarmory): três passadas rasantes em cruz sobre o alvo, cada uma corta em linha
  rasanteAco(l, h, extra) {
    const luta = this.luta, p = alvoMira(luta, l, h.alcance ?? 260), passes = h.passes ?? 3, cada = 0.32, L = 110;
    l.cortarAccion(); l.ponerEstado('invul', passes * cada + 0.1); trava(l, luta, passes * cada + 0.15);
    l.texto('STEEL STRAFE!', '#cbd5e1');
    for (let i = 0; i < passes; i++) luta.programar(i * cada, () => {
      if (l.ko) return;
      const a = angApunte(l) + (i - 1) * 1.05, x0 = p.x - Math.cos(a) * L, y0 = p.y - Math.sin(a) * L * 0.62, x1 = p.x + Math.cos(a) * L, y1 = p.y + Math.sin(a) * L * 0.62;
      const q = fijarCampo(x1, y1); l.x = q.x; l.y = q.y; l.angulo = a; l.animar('Attack', 0.25);
      luta.emit({ t: 'passadaAco', x0, y0, x1, y1 });
      for (const b of vivos(luta, l)) if (distSeg(b, x0, y0, x1, y1) < RADIO + 10) bate(l, b, h, extra, a, { dano: h.dano / passes, empuje: 60, aturde: i === passes - 1 ? 0.4 : 0.12 });
    });
  },
  // Razor Curtain (Mega Skarmory): voa reto e deixa uma cortina de penas-navalha suspensas que cortam e freiam quem passa
  cortinaLaminas(l, h, extra) {
    const luta = this.luta, a = angApunte(l), L = h.largo ?? 220, dur = h.dur ?? 4;
    const x0 = l.x, y0 = l.y, p = fijarCampo(l.x + Math.cos(a) * L, l.y + Math.sin(a) * L);
    l.cortarAccion(); l.animar('Attack', 0.3); l.ponerEstado('invul', 0.25); trava(l, luta, 0.25, a);
    l.x = p.x; l.y = p.y;
    l.texto('RAZOR CURTAIN!', '#e2e8f0');
    for (const b of vivos(luta, l)) if (distSeg(b, x0, y0, p.x, p.y) < RADIO + 12) bate(l, b, h, extra, a, { dano: h.dano * 0.35, empuje: 40 });
    const e = { tipo: 'cortinaLaminas', dueno: l, vivo: true, x0, y0, x1: p.x, y1: p.y, t: 0, dur, acum: 0, update: dt => {
      e.t += dt; e.acum += dt;
      const tick = e.acum >= 0.4; if (tick) e.acum -= 0.4;
      for (const b of vivos(luta, l)) {
        if (distSeg(b, e.x0, e.y0, e.x1, e.y1) > RADIO + 8) continue;
        b.ponerEstado?.('lento', 0.3, { f: 0.45 });
        if (tick) bate(l, b, h, extra, a + Math.PI / 2, { dano: h.dano * 0.08, empuje: 0, tick: true, dirX: undefined, dirY: undefined });
      }
      return e.t < dur && !l.ko;
    } };
    luta.add(e);
  },

  // ================================================================ Gardevoir
  // Prism Moonblast (Gardevoir): três prismas em triângulo em volta do alvo; um raio lunar ricocheteia entre eles
  prismaLunar(l, h, extra) {
    const luta = this.luta, c = alvoMira(luta, l, h.alcance ?? 260), R = h.radio ?? 64, dur = h.dur ?? 1.6;
    l.animar('Charge', 0.5); trava(l, luta, 0.4);
    l.texto('PRISM MOONBLAST', '#f9a8d4');
    const pts = [0, 1, 2].map(i => { const a = -Math.PI / 2 + (i * Math.PI * 2) / 3; return { x: c.x + Math.cos(a) * R, y: c.y + Math.sin(a) * R * 0.62 }; });
    const e = { tipo: 'prismaLunar', dueno: l, vivo: true, x: c.x, y: c.y, pts, t: 0, dur, acum: 0, update: dt => {
      e.t += dt;
      if (e.t < 0.35) return true;
      e.acum += dt;
      if (e.acum >= 0.2) {
        e.acum -= 0.2;
        for (const b of vivos(luta, l)) for (let i = 0; i < 3; i++) { const p = pts[i], q = pts[(i + 1) % 3]; if (distSeg(b, p.x, p.y, q.x, q.y) < RADIO + 6 || dentroElipse(b, e.x, e.y, R * 0.45)) { bate(l, b, h, extra, 0, { dano: h.dano * 0.7 / ((dur - 0.35) / 0.2), tick: true, empuje: 0, dirX: undefined, dirY: undefined, debilita: { f: 0.8, dur: 3 } }); break; } }
      }
      if (e.t >= dur) { areaCirculo(luta, l, e.x, e.y, R, pacote(h, extra, 0, { dano: h.dano * 0.3, empuje: 120, aturde: 0.4, dirX: undefined, dirY: undefined })); luta.emit({ t: 'prismaFim', x: e.x, y: e.y, radio: R }); return false; }
      return !l.ko;
    } };
    luta.add(e);
  },
  // Wishing Star (Mega Gardevoir): marca o chão; uma estrela rosa grande cai e a Gardevoir se cura com o dano causado
  estrelaDesejo(l, h, extra) {
    const luta = this.luta, c = alvoMira(luta, l, h.alcance ?? 280), R = h.radio ?? 70, queda = h.queda ?? 0.9;
    l.animar('Charge', 0.6); trava(l, luta, 0.45);
    l.texto('WISHING STAR!', '#fbcfe8');
    luta.emit({ t: 'estrelaAviso', x: c.x, y: c.y, radio: R, dur: queda });
    luta.programar(queda, () => {
      if (l.ko) return;
      let dano = 0;
      for (const b of vivos(luta, l)) if (dentroElipse(b, c.x, c.y, R + RADIO)) { const v = b.hp; bate(l, b, h, extra, Math.atan2(b.y - c.y, b.x - c.x), { empuje: 110, aturde: h.aturde ?? 0.5 }); dano += Math.max(0, v - b.hp); }
      if (dano > 0) { l.hp = Math.min(l.hpMax, l.hp + dano * (h.cura ?? 0.5)); l.texto(`+${Math.round(dano * (h.cura ?? 0.5))}`, '#86efac'); }
      luta.emit({ t: 'estrelaCai', x: c.x, y: c.y, radio: R }); luta.emit({ t: 'temblor', f: 0.012 }); luta.hitstop(80);
    });
  },

  // ================================================================ Gallade
  // Iai Slash (Gallade): pose de 0,35 s, aparece no fim da linha e a linha explode logo depois
  corteIai(l, h, extra) {
    const luta = this.luta, a = angApunte(l), L = h.largo ?? 170, pose = h.pose ?? 0.35;
    l.animar('Charge', pose); trava(l, luta, pose + 0.35, a);
    luta.emit({ t: 'avisoLinha', x0: l.x, y0: l.y, x1: l.x + Math.cos(a) * L, y1: l.y + Math.sin(a) * L, dur: pose, cor: '#86efac' });
    luta.programar(pose, () => {
      if (l.ko) return;
      const x0 = l.x, y0 = l.y, p = fijarCampo(l.x + Math.cos(a) * L, l.y + Math.sin(a) * L);
      l.x = p.x; l.y = p.y; l.animar('Attack', 0.3); l.ponerEstado('invul', 0.3);
      luta.emit({ t: 'corteIai', x0, y0, x1: p.x, y1: p.y });
      const pegos = vivos(luta, l).filter(b => distSeg(b, x0, y0, p.x, p.y) < RADIO + 12);
      for (const b of pegos) bate(l, b, h, extra, a, { dano: h.dano * 0.3, empuje: 0, aturde: 0.3 });
      luta.programar(0.3, () => { for (const b of pegos) if (!b.ko) bate(l, b, h, extra, a + Math.PI / 2, { dano: h.dano * 0.7, empuje: 130, aturde: 0.4, pesado: true }); luta.emit({ t: 'corteIaiFim', x0, y0, x1: p.x, y1: p.y }); luta.hitstop(90); });
    });
  },
  // Blade Star (Mega Gallade): cinco cortes que desenham uma estrela em volta do alvo; o último fecha no centro
  estrelaLaminas(l, h, extra) {
    const luta = this.luta, r = maisPerto(luta, l, h.alcance ?? 220);
    if (!r) return semAlvo(l, 'estrela');
    const R = h.radio ?? 60, cada = 0.12, cx = r.x, cy = r.y;
    l.cortarAccion(); l.ponerEstado('invul', cada * 6 + 0.2); trava(l, luta, cada * 6 + 0.2);
    l.texto('BLADE STAR!', '#bbf7d0');
    const pts = [0, 1, 2, 3, 4].map(i => { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R * 0.62 }; });
    for (let i = 0; i < 5; i++) luta.programar(i * cada, () => {
      if (l.ko) return;
      const p = pts[i], q = pts[(i + 1) % 5], s = fijarCampo(q.x, q.y);
      l.x = s.x; l.y = s.y; l.angulo = Math.atan2(q.y - p.y, q.x - p.x); l.animar('Attack', 0.12);
      luta.emit({ t: 'corteEstrela', x0: p.x, y0: p.y, x1: q.x, y1: q.y, i });
      for (const b of vivos(luta, l)) if (distSeg(b, p.x, p.y, q.x, q.y) < RADIO + 10) bate(l, b, h, extra, l.angulo, { dano: h.dano * 0.1, empuje: 0, aturde: 0.15, tick: true });
    });
    luta.programar(5 * cada + 0.08, () => {
      if (l.ko) return;
      const s = fijarCampo(cx, cy - 2); l.x = s.x; l.y = s.y;
      areaCirculo(luta, l, cx, cy, R * 0.75, pacote(h, extra, 0, { dano: h.dano * 0.5, empuje: 150, aturde: 0.5, pesado: true, dirX: undefined, dirY: undefined }));
      luta.emit({ t: 'estrelaFecha', x: cx, y: cy, radio: R }); luta.emit({ t: 'temblor', f: 0.012 }); luta.hitstop(90);
    });
  },

  // ================================================================ Sableye
  // Gem Heist (Sableye): arranca até o rival, rouba energia e larga uma joia falsa que explode depois
  rouboJoia(l, h, extra) {
    const luta = this.luta, r = maisPerto(luta, l, h.alcance ?? 200);
    if (!r) return semAlvo(l, 'roubo');
    const x0 = l.x, y0 = l.y, a = Math.atan2(r.y - l.y, r.x - l.x), p = fijarCampo(r.x - Math.cos(a) * 16, r.y - Math.sin(a) * 10);
    l.x = p.x; l.y = p.y; l.angulo = a; l.cortarAccion(); l.animar('Attack', 0.3); l.ponerEstado('invul', 0.3); trava(l, luta, 0.3, a);
    luta.emit({ t: 'rastroSombra', x0, y0, x1: p.x, y1: p.y });
    const res = bate(l, r, h, extra, a, { dano: h.dano * 0.4, empuje: 60, aturde: 0.3 });
    if (res === 'golpe') { const tira = Math.min(r.energia ?? 0, h.rouba ?? 40); r.energia -= tira; l.energia = Math.min(100, l.energia + tira); l.texto(`+${Math.round(tira)} ENERGY`, '#a78bfa'); luta.emit({ t: 'roubaEnergia', l, b: r }); }
    const g = { tipo: 'joiaFalsa', dueno: l, vivo: true, x: x0, y: y0, t: 0, dur: h.espera ?? 1.2, update: dt => {
      g.t += dt;
      if (g.t < g.dur) return true;
      areaCirculo(luta, l, g.x, g.y, h.radio ?? 56, pacote(h, extra, 0, { dano: h.dano * 0.6, empuje: 110, aturde: 0.4, dirX: undefined, dirY: undefined }));
      luta.emit({ t: 'joiaExplode', x: g.x, y: g.y, radio: h.radio ?? 56 }); luta.emit({ t: 'temblor', f: 0.01 });
      return false;
    } };
    luta.add(g);
  },
  // Prism Hoard (Mega Sableye): ergue a joia gigante na frente; ela guarda os tiros que pega e depois devolve tudo em lascas
  joiaEspelho(l, h, extra) {
    const luta = this.luta, dur = h.dur ?? 2;
    l.animar('Charge', dur); l.accion = { hasta: luta.t + dur, bloquea: false, lento: 0.35 };
    l.texto('PRISM HOARD', '#c4b5fd');
    const e = { tipo: 'joiaEspelho', dueno: l, vivo: true, x: l.x, y: l.y, ang: angApunte(l), t: 0, dur, guardados: 0, update: dt => {
      e.t += dt; e.x = l.x; e.y = l.y; e.ang = angApunte(l);
      for (const p of luta.entidades ?? []) {
        if (p.tipo !== 'proj' || p.dueno === l || p.dueno?.equipo === l.equipo || !p.vivo) continue;
        if (Math.hypot(p.x - (l.x + Math.cos(e.ang) * 18), p.y - (l.y + Math.sin(e.ang) * 12)) < 26) { p.vivo = false; p.muerto = true; e.guardados++; luta.emit({ t: 'joiaGuarda', x: p.x, y: p.y }); }
      }
      if (e.t >= dur || l.ko) {
        const n = Math.min(14, 5 + e.guardados * 2);
        for (let i = 0; i < n; i++) {
          const a = e.ang + (i / (n - 1) - 0.5) * 1.3, s = { tipo: 'lascaJoia', dueno: l, vivo: true, x: l.x, y: l.y, ang: a, t: 0, update: dt2 => {
            s.t += dt2; s.x += Math.cos(s.ang) * 420 * dt2; s.y += Math.sin(s.ang) * 420 * dt2;
            for (const b of vivos(luta, l)) if (Math.hypot(b.x - s.x, b.y - s.y) < RADIO + 4) { bate(l, b, h, extra, s.ang, { dano: h.dano / 6, empuje: 40, aturde: 0.1, tick: true }); return false; }
            return s.t < 0.6;
          } };
          luta.add(s);
        }
        l.animar('Attack', 0.3); luta.emit({ t: 'joiaSolta', l, n });
        return false;
      }
      return true;
    } };
    luta.add(e);
  },

  // ================================================================ Mawile
  // Deceiver's Jaws (Mawile): as mandíbulas das costas abocanham o rival mais perto, mastigam três vezes e jogam para trás
  mandibulaFalsa(l, h, extra) {
    const luta = this.luta, r = maisPerto(luta, l, h.alcance ?? 150);
    if (!r) return semAlvo(l, 'mandibula');
    const a = Math.atan2(r.y - l.y, r.x - l.x);
    // dá o bote: a Mawile pula de costas até o rival e as mandíbulas abocanham
    const x0 = l.x, y0 = l.y, chega = fijarCampo(r.x - Math.cos(a) * 26, r.y - Math.sin(a) * 16);
    l.x = chega.x; l.y = chega.y; l.angulo = a; l.cortarAccion();
    luta.emit({ t: 'rastroSombra', x0, y0, x1: chega.x, y1: chega.y });
    l.animar('Attack', 0.9); trava(l, luta, 0.9, a);
    r.ponerEstado?.('aturdido', 0.9);
    luta.emit({ t: 'mandibula', l, b: r, dur: 0.9 });
    for (let i = 0; i < 3; i++) luta.programar(0.15 + i * 0.22, () => { if (!r.ko && !l.ko) { const q = fijarCampo(l.x + Math.cos(a) * 26, l.y + Math.sin(a) * 16); r.x = q.x; r.y = q.y; bate(l, r, h, extra, a, { dano: h.dano * 0.2, empuje: 0, tick: true }); luta.emit({ t: 'mordida', x: r.x, y: r.y }); } });
    luta.programar(0.85, () => { if (!r.ko && !l.ko) { const q = fijarCampo(l.x - Math.cos(a) * 30, l.y - Math.sin(a) * 18); r.x = q.x; r.y = q.y; bate(l, r, h, extra, a + Math.PI, { dano: h.dano * 0.4, empuje: 200, aturde: 0.5, pesado: true }); luta.emit({ t: 'temblor', f: 0.012 }); luta.hitstop(80); } });
  },
  // Twin Trap (Mega Mawile): as duas mandíbulas avançam em V e fecham no meio; quem ficar entre elas é preso e mordido
  mandibulaDupla(l, h, extra) {
    const luta = this.luta, a = angApunte(l), L = h.alcance ?? 150, dur = 0.35;
    l.animar('Attack', 0.6); trava(l, luta, 0.6, a);
    luta.emit({ t: 'mandibulaDupla', l, ang: a, largo: L, dur });
    luta.programar(dur, () => {
      if (l.ko) return;
      const x1 = l.x + Math.cos(a) * L, y1 = l.y + Math.sin(a) * L * 0.8, mx = (l.x + x1) / 2, my = (l.y + y1) / 2;
      for (const b of vivos(luta, l)) {
        if (distSeg(b, l.x, l.y, x1, y1) > (h.ancho ?? 44)) continue;
        const q = fijarCampo(mx, my); b.x = q.x; b.y = q.y;
        bate(l, b, h, extra, a, { dano: h.dano * 0.5, empuje: 0, aturde: h.aturde ?? 0.9 });
        luta.programar(0.4, () => { if (!b.ko) bate(l, b, h, extra, a, { dano: h.dano * 0.5, empuje: 160, aturde: 0.3, pesado: true }); });
      }
      luta.emit({ t: 'mordida', x: mx, y: my, grande: true }); luta.emit({ t: 'temblor', f: 0.012 });
    });
  },

  // ================================================================ Medicham
  // Zen Palm (Medicham): medita (invulnerável) e solta uma palma de choque; quem bate na parede leva o dobro
  palmaZen(l, h, extra) {
    const luta = this.luta, med = h.medita ?? 0.5, a0 = angApunte(l);
    l.animar('Charge', med); l.ponerEstado('invul', med); trava(l, luta, med + 0.25, a0);
    luta.emit({ t: 'meditacao', l, dur: med });
    luta.programar(med, () => {
      if (l.ko) return;
      const a = angApunte(l), L = h.largo ?? 150;
      l.animar('Attack', 0.3); l.angulo = a;
      luta.emit({ t: 'palmaZen', x: l.x, y: l.y, ang: a, largo: L });
      for (const b of vivos(luta, l)) {
        if (distSeg(b, l.x, l.y, l.x + Math.cos(a) * L, l.y + Math.sin(a) * L) > RADIO + 16) continue;
        bate(l, b, h, extra, a, { dano: h.dano * 0.6, empuje: 260, aturde: 0.35 });
        const x0 = b.x, y0 = b.y;
        luta.programar(0.3, () => { if (b.ko) return; const andou = Math.hypot(b.x - x0, b.y - y0); if (andou < 40) { bate(l, b, h, extra, a, { dano: h.dano * 0.8, empuje: 0, aturde: 0.6, pesado: true }); luta.emit({ t: 'choqueParede', x: b.x, y: b.y }); luta.emit({ t: 'temblor', f: 0.012 }); } });
      }
    });
  },
  // Hundred Palms (Mega Medicham): rajada de palmas em leque por 1,2 s; cada acerto marca, e no fim as marcas estouram
  cemPalmas(l, h, extra) {
    const luta = this.luta, dur = h.dur ?? 1.2, cada = 0.08, marcas = new Map();
    l.animar('MultiStrike', dur); l.accion = { hasta: luta.t + dur, bloquea: true, lento: 0.25 };
    l.texto('HUNDRED PALMS!', '#fca5a5');
    let t = 0, acum = 0;
    luta.add({ tipo: 'cemPalmas', dueno: l, vivo: true, update: dt => {
      t += dt; acum += dt;
      const a = angApunte(l); l.angulo = a;
      while (acum >= cada) {
        acum -= cada;
        const aa = a + entre(-0.45, 0.45), d = entre(20, h.alcance ?? 70);
        luta.emit({ t: 'palma', x: l.x + Math.cos(aa) * d, y: l.y + Math.sin(aa) * d * 0.7 - 10, ang: aa });
        for (const b of vivos(luta, l)) { const db = Math.hypot(b.x - l.x, b.y - l.y); if (db < (h.alcance ?? 70) + RADIO && Math.abs(dAng(Math.atan2(b.y - l.y, b.x - l.x), a)) < 0.6) { bate(l, b, h, extra, a, { dano: h.dano * 0.025, empuje: 8, tick: true }); marcas.set(b, (marcas.get(b) ?? 0) + 1); } }
      }
      if (t >= dur || l.ko) {
        for (const [b, n] of marcas) if (!b.ko) { bate(l, b, h, extra, a, { dano: h.dano * 0.025 * n, empuje: 180, aturde: 0.5, pesado: true }); luta.emit({ t: 'marcasEstouram', x: b.x, y: b.y, n }); }
        if (marcas.size) { luta.emit({ t: 'temblor', f: 0.012 }); luta.hitstop(90); }
        return false;
      }
      return true;
    } });
  },

  // ================================================================ Manectric
  // Thunder Fang Zigzag (Manectric): três saltos em zigue-zague mordendo os rivais; o rastro fica carregado e dá choque depois
  zigueRaio(l, h, extra) {
    const luta = this.luta, saltos = h.saltos ?? 3, cada = 0.2, trilha = [{ x: l.x, y: l.y }];
    l.cortarAccion(); l.ponerEstado('invul', saltos * cada + 0.1); trava(l, luta, saltos * cada + 0.1);
    l.texto('THUNDER ZIGZAG!', '#fde047');
    for (let i = 0; i < saltos; i++) luta.programar(i * cada, () => {
      if (l.ko) return;
      // cada salto passa pelo rival e termina do outro lado, um pouco para um lado e depois para o outro
      const r = maisPerto(luta, l, 220), base = r ? Math.atan2(r.y - l.y, r.x - l.x) : angApunte(l), lado = i % 2 ? 1 : -1;
      const alvo = r ? { x: r.x + Math.cos(base) * 44 - Math.sin(base) * 26 * lado, y: r.y + Math.sin(base) * 44 + Math.cos(base) * 18 * lado } : { x: l.x + Math.cos(base + lado * 0.5) * 100, y: l.y + Math.sin(base + lado * 0.5) * 100 };
      const x0 = l.x, y0 = l.y, p = fijarCampo(alvo.x, alvo.y), a = Math.atan2(p.y - y0, p.x - x0);
      l.x = p.x; l.y = p.y; l.angulo = a; l.animar('Attack', 0.18); trilha.push({ x: p.x, y: p.y });
      luta.emit({ t: 'saltoRaio', x0, y0, x1: p.x, y1: p.y });
      for (const b of vivos(luta, l)) if (distSeg(b, x0, y0, p.x, p.y) < RADIO + 10) bate(l, b, h, extra, a, { dano: h.dano * 0.15, empuje: 50, aturde: 0.15 });
    });
    luta.programar(saltos * cada + 0.35, () => {
      luta.emit({ t: 'trilhaRaio', pts: trilha });
      for (const b of vivos(luta, l)) for (let i = 1; i < trilha.length; i++) if (distSeg(b, trilha[i - 1].x, trilha[i - 1].y, trilha[i].x, trilha[i].y) < RADIO + 12) { bate(l, b, h, extra, 0, { dano: h.dano * 0.55, empuje: 70, aturde: 0.4, dirX: undefined, dirY: undefined }); break; }
    });
  },
  // Lightning Rod (Mega Manectric): finca um para-raios; por 3 s ele puxa raios que caem nos rivais perto e voltam para ele
  paraRaios(l, h, extra) {
    const luta = this.luta, c = alvoMira(luta, l, h.alcance ?? 200), R = h.radio ?? 160, dur = h.dur ?? 3, cada = h.cada ?? 0.35;
    l.animar('Charge', 0.4); trava(l, luta, 0.3);
    l.texto('LIGHTNING ROD!', '#fde047');
    const e = { tipo: 'paraRaios', dueno: l, vivo: true, x: c.x, y: c.y, radio: R, t: 0, dur, prox: 0.3, update: dt => {
      e.t += dt;
      if (e.t >= e.prox && e.t < dur) {
        e.prox += cada;
        const perto = vivos(luta, l).filter(b => dentroElipse(b, e.x, e.y, R));
        const b = perto[Math.floor(Math.random() * perto.length)];
        if (b) { bate(l, b, h, extra, Math.atan2(e.y - b.y, e.x - b.x), { dano: h.dano / (dur / cada) * 1.2, empuje: -30, aturde: 0.12, tick: true }); luta.emit({ t: 'raioPara', x: b.x, y: b.y, rx: e.x, ry: e.y }); }
        else luta.emit({ t: 'raioPara', x: e.x + entre(-R, R) * 0.5, y: e.y + entre(-R, R) * 0.3, rx: e.x, ry: e.y, vazio: true });
      }
      return e.t < dur && !l.ko;
    } };
    luta.add(e);
  },

  // ================================================================ Camerupt
  // Back Volcano (Camerupt): o vulcão das costas cospe seis bombas de lava em volta do alvo; cada uma deixa uma poça que queima
  vulcaoCostas(l, h, extra) {
    const luta = this.luta, c = alvoMira(luta, l, h.alcance ?? 240), n = h.n ?? 6;
    l.animar('Charge', 0.8); trava(l, luta, 0.6);
    l.texto('ERUPTION!', '#fb923c');
    for (let i = 0; i < n; i++) luta.programar(0.1 + i * 0.1, () => {
      if (l.ko) return;
      const a = (i / n) * Math.PI * 2, d = i === 0 ? 0 : entre(26, 56), x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d * 0.62, vuelo = 0.55;
      luta.emit({ t: 'bombaLava', x0: l.x, y0: l.y - l.alto, x, y, dur: vuelo });
      luta.programar(vuelo, () => {
        areaCirculo(luta, l, x, y, 26, pacote(h, extra, 0, { dano: h.dano / n * 0.7, empuje: 50, quema: { dps: 2, dur: 3, max: 3 }, dirX: undefined, dirY: undefined }));
        const p = { tipo: 'pocaLava', dueno: l, vivo: true, x, y, t: 0, dur: 3, acum: 0, update: dt => {
          p.t += dt; p.acum += dt;
          if (p.acum >= 0.5) { p.acum -= 0.5; for (const b of vivos(luta, l)) if (!b.est?.vuelo && dentroElipse(b, x, y, 20)) b.recibir(l, { dano: h.dano * 0.02, tipo: 'FIRE', tick: true, puro: true, quema: { dps: 1, dur: 2, max: 3 } }); }
          return p.t < p.dur;
        } };
        luta.add(p);
      });
    });
    luta.programar(0.7, () => luta.emit({ t: 'temblor', f: 0.01 }));
  },
  // Magma Rift (Mega Camerupt): pisa forte; uma fenda de magma corre para a frente e vira um muro de fogo por 1,5 s
  fendaMagma(l, h, extra) {
    const luta = this.luta, a = angApunte(l), L = h.largo ?? 260, vel = 520;
    l.animar('Attack', 0.5); trava(l, luta, 0.45, a);
    l.ponerEstado('brinco', 0.3, { dur: 0.3, t0: luta.t });
    const x0 = l.x, y0 = l.y;
    const e = { tipo: 'fendaMagma', dueno: l, vivo: true, x0, y0, ang: a, largo: L, d: 0, t: 0, abre: L / vel, dur: L / vel + (h.dur ?? 1.5), acum: 0, pegos: new Set(), update: dt => {
      e.t += dt; e.d = Math.min(L, e.d + vel * dt);
      const x1 = x0 + Math.cos(a) * e.d, y1 = y0 + Math.sin(a) * e.d;
      for (const b of vivos(luta, l)) if (!e.pegos.has(b) && distSeg(b, x0, y0, x1, y1) < RADIO + 8) { e.pegos.add(b); bate(l, b, h, extra, a + Math.PI / 2, { dano: h.dano * 0.4, empuje: 90, aturde: 0.3 }); }
      if (e.t > e.abre) {
        e.acum += dt;
        if (e.acum >= 0.25) { e.acum -= 0.25; for (const b of vivos(luta, l)) if (distSeg(b, x0, y0, x1, y1) < RADIO + 10) b.recibir(l, { dano: h.dano * 0.06, tipo: 'FIRE', tick: true, quema: { dps: 2, dur: 2, max: 3 } }); }
      }
      return e.t < e.dur && !l.ko;
    } };
    luta.add(e);
    luta.emit({ t: 'temblor', f: 0.012 });
  },

  // ================================================================ Banette
  // Stitch Needles (Banette): três agulhas; cada uma que pega costura o rival no chão e a terceira puxa ele até a Banette
  agulhaCostura(l, h, extra) {
    const luta = this.luta, n = 3;
    l.animar('Shoot', 0.5); trava(l, luta, 0.45);
    const pontos = new Map();
    for (let i = 0; i < n; i++) luta.programar(i * 0.12, () => {
      if (l.ko) return;
      const a = angApunte(l) + (i - 1) * 0.12, s = { tipo: 'agulha', dueno: l, vivo: true, x: l.x, y: l.y, ang: a, t: 0, update: dt => {
        s.t += dt; s.x += Math.cos(s.ang) * 480 * dt; s.y += Math.sin(s.ang) * 480 * dt;
        for (const b of vivos(luta, l)) if (Math.hypot(b.x - s.x, b.y - s.y) < RADIO + 4) {
          const k = (pontos.get(b) ?? 0) + 1; pontos.set(b, k);
          bate(l, b, h, extra, s.ang, { dano: h.dano * 0.25, empuje: 0, tick: true });
          b.ponerEstado?.('lento', 1.2, { f: 0.1 }); luta.emit({ t: 'costura', l, b, k });
          if (k >= 2) luta.programar(0.15, () => { if (b.ko || l.ko) return; const aa = Math.atan2(l.y - b.y, l.x - b.x), q = fijarCampo(l.x - Math.cos(aa) * 30, l.y - Math.sin(aa) * 18); b.x = q.x; b.y = q.y; bate(l, b, h, extra, aa, { dano: h.dano * 0.35, empuje: 0, aturde: 0.6 }); luta.emit({ t: 'linhaPuxa', l, b }); });
          return false;
        }
        return s.t < 0.55;
      } };
      luta.add(s);
    });
  },
  // Jack-in-the-Box (Mega Banette): larga uma caixa de surpresa no alvo; ela abre com um boneco de mola que joga todos para o alto
  caixaSurpresa(l, h, extra) {
    const luta = this.luta, c = alvoMira(luta, l, h.alcance ?? 240), R = h.radio ?? 66, espera = h.espera ?? 0.7;
    l.animar('Charge', 0.5); trava(l, luta, 0.35);
    l.texto('SURPRISE!', '#c4b5fd');
    const e = { tipo: 'caixaSurpresa', dueno: l, vivo: true, x: c.x, y: c.y, radio: R, t: 0, espera, dur: espera + 0.8, abriu: false, update: dt => {
      e.t += dt;
      if (!e.abriu && e.t >= espera) {
        e.abriu = true;
        for (const b of vivos(luta, l)) if (dentroElipse(b, e.x, e.y, R + RADIO)) { bate(l, b, h, extra, 0, { empuje: 60, aturde: h.aturde ?? 0.9, maldicion: { dur: 4, f: 1.2 }, dirX: undefined, dirY: undefined }); b.ponerEstado?.('brinco', 0.6, { dur: 0.6, t0: luta.t }); b.ponerEstado?.('maldito', 4, { f: 1.2, fuente: l }); }
        luta.emit({ t: 'caixaAbre', x: e.x, y: e.y, radio: R }); luta.emit({ t: 'temblor', f: 0.012 }); luta.hitstop(80);
      }
      return e.t < e.dur;
    } };
    luta.add(e);
  },

  // ================================================================ Absol
  // Disaster Crescent (Absol): pula e crava uma lua crescente escura que gira no lugar moendo quem estiver perto
  luaDesastre(l, h, extra) {
    const luta = this.luta, c = alvoMira(luta, l, h.alcance ?? 220), R = h.radio ?? 50, dur = h.dur ?? 1.2;
    l.animar('Attack', 0.4); trava(l, luta, 0.35);
    l.texto('DISASTER CRESCENT', '#c4b5fd');
    const e = { tipo: 'luaDesastre', dueno: l, vivo: true, x: l.x, y: l.y, cx: c.x, cy: c.y, radio: R, t: 0, voo: 0.25, dur: dur + 0.25, acum: 0, update: dt => {
      e.t += dt;
      const k = Math.min(1, e.t / e.voo); e.x = l.x + (e.cx - l.x) * k; e.y = l.y + (e.cy - l.y) * k;
      if (e.t < e.voo) return true;
      e.x = e.cx; e.y = e.cy; e.acum += dt;
      if (e.acum >= 0.15) { e.acum -= 0.15; for (const b of vivos(luta, l)) if (dentroElipse(b, e.x, e.y, R + RADIO)) { const a = Math.atan2(e.y - b.y, e.x - b.x); bate(l, b, h, extra, a, { dano: h.dano * 0.8 / (dur / 0.15), empuje: -40, tick: true }); } }
      if (e.t >= e.dur) { areaCirculo(luta, l, e.x, e.y, R, pacote(h, extra, 0, { dano: h.dano * 0.2, empuje: 140, aturde: 0.45, dirX: undefined, dirY: undefined })); luta.emit({ t: 'luaQuebra', x: e.x, y: e.y, radio: R }); return false; }
      return !l.ko;
    } };
    luta.add(e);
  },
  // Doom Omen (Mega Absol): marca o rival com uma contagem de 3 s; cada golpe que ele leva no meio-tempo deixa o corte final mais forte
  presagio(l, h, extra) {
    const luta = this.luta, r = maisPerto(luta, l, h.alcance ?? 300);
    if (!r) return semAlvo(l, 'presagio');
    const dur = h.dur ?? 3;
    l.animar('Charge', 0.4); trava(l, luta, 0.3);
    l.texto('DOOM OMEN', '#e9d5ff'); r.texto('DOOMED!', '#c084fc');
    const vida0 = r.hp;
    const e = { tipo: 'presagio', dueno: l, vivo: true, b: r, t: 0, dur, update: dt => {
      e.t += dt;
      if (r.ko) return false;
      if (e.t >= dur) {
        const perdeu = Math.max(0, vida0 - r.hp), extraDano = Math.min(h.dano, perdeu * (h.cobra ?? 0.6));
        bate(l, r, h, extra, 0, { dano: h.dano * 0.5 + extraDano, empuje: 120, aturde: 0.6, pesado: true, dirX: undefined, dirY: undefined });
        luta.emit({ t: 'presagioCorte', x: r.x, y: r.y, forte: extraDano > h.dano * 0.4 }); luta.emit({ t: 'temblor', f: 0.014 }); luta.hitstop(100);
        return false;
      }
      return !l.ko;
    } };
    luta.add(e);
  },

  // ================================================================ Glalie
  // Ice Prison (Glalie): congela um círculo do chão; quem não sair em 1 s fica preso no gelo, que depois estilhaça
  prisaoGelo(l, h, extra) {
    const luta = this.luta, c = alvoMira(luta, l, h.alcance ?? 220), R = h.radio ?? 64, aviso = h.aviso ?? 1;
    l.animar('Charge', 0.5); trava(l, luta, 0.4);
    l.texto('ICE PRISON', '#bae6fd');
    const e = { tipo: 'prisaoGelo', dueno: l, vivo: true, x: c.x, y: c.y, radio: R, t: 0, aviso, dur: aviso + 1.3, presos: [], update: dt => {
      e.t += dt;
      if (e.t < aviso) { for (const b of vivos(luta, l)) if (dentroElipse(b, e.x, e.y, R)) b.ponerEstado?.('lento', 0.2, { f: 0.5 }); return true; }
      if (!e.presos.length && e.t - dt < aviso) {
        e.presos = vivos(luta, l).filter(b => dentroElipse(b, e.x, e.y, R + 4));
        for (const b of e.presos) { bate(l, b, h, extra, 0, { dano: h.dano * 0.3, empuje: 0, aturde: 1.2, dirX: undefined, dirY: undefined }); luta.emit({ t: 'congela', l: b }); }
        luta.emit({ t: 'temblor', f: 0.006 });
      }
      if (e.t >= e.dur) { for (const b of e.presos) if (!b.ko) bate(l, b, h, extra, 0, { dano: h.dano * 0.7, empuje: 120, aturde: 0.2, pesado: true, dirX: undefined, dirY: undefined }); luta.emit({ t: 'geloEstilhaca', x: e.x, y: e.y, radio: R }); if (e.presos.length) luta.hitstop(90); return false; }
      return true;
    } };
    luta.add(e);
  },
  // Frost Maw (Mega Glalie): abre a boca gigante e aspira tudo à frente; quem chega perto leva a mordida congelante
  bocaGelo(l, h, extra) {
    const luta = this.luta, dur = h.dur ?? 1.2, alc = h.alcance ?? 170, ang = (h.angulo ?? 70) * Math.PI / 360;
    l.animar('Charge', dur); l.accion = { hasta: luta.t + dur + 0.2, bloquea: true, lento: 0 };
    l.texto('FROST MAW!', '#e0f2fe');
    let t = 0;
    luta.add({ tipo: 'bocaGelo', dueno: l, vivo: true, x: l.x, y: l.y, ang: l.angulo, t: 0, dur, alcance: alc, update(dt) {
      t += dt; this.t = t; this.x = l.x; this.y = l.y; const a = angApunte(l); this.ang = a; l.angulo = a;
      for (const b of vivos(luta, l)) {
        const d = Math.hypot(b.x - l.x, b.y - l.y);
        if (d > alc || Math.abs(dAng(Math.atan2(b.y - l.y, b.x - l.x), a)) > ang) continue;
        const q = fijarCampo(b.x - Math.cos(a) * 130 * dt, b.y - Math.sin(a) * 130 * dt); b.x = q.x; b.y = q.y;
        b.ponerEstado?.('lento', 0.2, { f: 0.5 });
      }
      if (t >= dur || l.ko) {
        l.animar('Attack', 0.3);
        for (const b of vivos(luta, l)) if (Math.hypot(b.x - l.x, b.y - l.y) < 60 + RADIO) { bate(l, b, h, extra, a, { empuje: 150, aturde: h.aturde ?? 1, pesado: true }); luta.emit({ t: 'congela', l: b }); }
        luta.emit({ t: 'mordidaGelo', x: l.x + Math.cos(a) * 30, y: l.y + Math.sin(a) * 18 }); luta.emit({ t: 'temblor', f: 0.012 });
        return false;
      }
      return true;
    } });
  },

  // ================================================================ Chimecho
  // Echo Chimes (Chimecho): três sinos em fila tocam um depois do outro; quem leva duas ondas fica confuso
  sinosEco(l, h, extra) {
    const luta = this.luta, a = angApunte(l), passo = h.passo ?? 70, R = h.radio ?? 54, vezes = new Map();
    l.animar('Charge', 0.6); trava(l, luta, 0.4, a);
    for (let i = 0; i < 3; i++) {
      const x = l.x + Math.cos(a) * passo * (i + 1), y = l.y + Math.sin(a) * passo * (i + 1) * 0.8, p = fijarCampo(x, y);
      luta.emit({ t: 'sinoAparece', x: p.x, y: p.y, i });
      luta.programar(0.3 + i * 0.25, () => {
        if (l.ko) return;
        luta.emit({ t: 'sinoToca', x: p.x, y: p.y, radio: R });
        for (const b of vivos(luta, l)) if (dentroElipse(b, p.x, p.y, R + RADIO)) {
          const k = (vezes.get(b) ?? 0) + 1; vezes.set(b, k);
          bate(l, b, h, extra, a, { dano: h.dano / 3, empuje: 50, confunde: k >= 2 ? (h.confunde ?? 2) : undefined, aturde: k >= 3 ? 0.4 : undefined });
        }
      });
    }
  },
  // Grand Resonance (Mega Chimecho): um sino enorme aparece em cima do alvo e toca quatro vezes, cada onda maior; a última atordoa
  ressonancia(l, h, extra) {
    const luta = this.luta, c = alvoMira(luta, l, h.alcance ?? 260), toques = 4;
    l.animar('Charge', 0.8); trava(l, luta, 0.5);
    l.texto('GRAND RESONANCE', '#fef9c3');
    luta.emit({ t: 'sinoGrande', x: c.x, y: c.y, dur: 0.35 * toques + 0.3 });
    for (let i = 0; i < toques; i++) luta.programar(0.3 + i * 0.35, () => {
      if (l.ko) return;
      const R = 36 + i * 22, fim = i === toques - 1;
      luta.emit({ t: 'sinoToca', x: c.x, y: c.y, radio: R, grande: true });
      areaCirculo(luta, l, c.x, c.y, R, pacote(h, extra, 0, { dano: h.dano / toques, empuje: fim ? 140 : 40, aturde: fim ? (h.aturde ?? 0.8) : 0.1, confunde: fim ? undefined : 0.8, dirX: undefined, dirY: undefined }));
      if (fim) { luta.emit({ t: 'temblor', f: 0.012 }); luta.hitstop(80); }
    });
  },

  // ================================================================ Sharpedo
  // Jet Torpedo (Sharpedo): trava a direção e acelera reto até bater em alguém ou na parede (na parede ricocheteia uma vez)
  torpedo(l, h, extra) {
    const luta = this.luta;
    let a = angApunte(l), vel = 120, t = 0, ricochete = 1;
    l.cortarAccion(); l.animar('Walk', 1.2); l.ponerEstado('invul', 1.1); trava(l, luta, 1.2, a);
    l.texto('JET TORPEDO!', '#7dd3fc');
    luta.add({ tipo: 'torpedo', dueno: l, vivo: true, x: l.x, y: l.y, ang: a, update(dt) {
      t += dt; vel = Math.min(h.vel ?? 620, vel + 1400 * dt);
      const nx = l.x + Math.cos(a) * vel * dt, ny = l.y + Math.sin(a) * vel * dt, p = fijarCampo(nx, ny);
      if (Math.hypot(p.x - nx, p.y - ny) > 0.5) { if (ricochete-- > 0) { a = Math.atan2(-(ny - l.y), -(nx - l.x)) + entre(-0.4, 0.4); luta.emit({ t: 'temblor', f: 0.008 }); } else { delete l.est.invul; return false; } }
      l.x = p.x; l.y = p.y; l.angulo = a; this.x = l.x; this.y = l.y; this.ang = a;
      for (const b of vivos(luta, l)) if (Math.hypot(b.x - l.x, b.y - l.y) < RADIO * 2 + 4) {
        bate(l, b, h, extra, a, { dano: h.dano * Math.min(1, 0.55 + vel / 1400), empuje: 220, aturde: h.aturde ?? 0.5, pesado: true });
        luta.emit({ t: 'torpedoBate', x: b.x, y: b.y }); luta.emit({ t: 'temblor', f: 0.012 }); luta.hitstop(90);
        delete l.est.invul; l.accion = null; return false;
      }
      if (t > 1.1) { delete l.est.invul; return false; }
      return !l.ko;
    } });
  },
  // Feeding Frenzy (Mega Sharpedo): a barbatana circula o alvo puxando-o para o centro, e então salta mordendo três vezes
  frenesi(l, h, extra) {
    const luta = this.luta, r = maisPerto(luta, l, h.alcance ?? 260);
    if (!r) return semAlvo(l, 'frenesi');
    const dur = h.dur ?? 1.4, R = 60;
    l.cortarAccion(); l.ponerEstado('vuelo', dur, { oculto: true, modo: 'agua', rapidez: 0 }); trava(l, luta, dur + 0.5);
    l.texto('FEEDING FRENZY!', '#93c5fd');
    let t = 0; const cx = r.x, cy = r.y;
    luta.add({ tipo: 'frenesi', dueno: l, vivo: true, x: l.x, y: l.y, cx, cy, ang: 0, t: 0, dur, update(dt) {
      t += dt; this.t = t;
      const a = t * 6; this.ang = a; this.x = cx + Math.cos(a) * R; this.y = cy + Math.sin(a) * R * 0.62; l.x = this.x; l.y = this.y;
      for (const b of vivos(luta, l)) if (dentroElipse(b, cx, cy, R + 30)) { const q = fijarCampo(b.x + (cx - b.x) * 2 * dt, b.y + (cy - b.y) * 2 * dt); b.x = q.x; b.y = q.y; b.ponerEstado?.('lento', 0.2, { f: 0.5 }); }
      if (t >= dur) {
        delete l.est.vuelo; const p = fijarCampo(cx, cy + 4); l.x = p.x; l.y = p.y; l.animar('Attack', 0.5);
        for (let i = 0; i < 3; i++) luta.programar(i * 0.14, () => { for (const b of vivos(luta, l)) if (dentroElipse(b, cx, cy, 40 + RADIO)) bate(l, b, h, extra, 0, { dano: h.dano / 3, empuje: i === 2 ? 160 : 20, aturde: i === 2 ? 0.5 : 0.2, dirX: undefined, dirY: undefined }); luta.emit({ t: 'mordida', x: cx, y: cy - 6, grande: i === 2 }); });
        luta.emit({ t: 'saltoAgua', x: cx, y: cy }); luta.emit({ t: 'temblor', f: 0.012 });
        return false;
      }
      return !l.ko;
    } });
  },

  // ================================================================ Excadrill
  // Drill Run Triple (Excadrill): cava e anda debaixo da terra atrás do alvo, furando o chão três vezes no caminho
  brocaTunel(l, h, extra) {
    const luta = this.luta, dur = h.dur ?? 1.2, saidas = 3;
    l.cortarAccion(); l.ponerEstado('vuelo', dur + 0.1, { oculto: true, modo: 'meteoro', rapidez: 0 }); trava(l, luta, dur + 0.2);
    l.texto('DRILL TUNNEL!', '#d6b48a');
    let t = 0, feitas = 0;
    luta.add({ tipo: 'brocaTunel', dueno: l, vivo: true, x: l.x, y: l.y, update(dt) {
      t += dt;
      const r = maisPerto(luta, l, 400), a = r ? Math.atan2(r.y - l.y, r.x - l.x) : angApunte(l), p = fijarCampo(l.x + Math.cos(a) * 210 * dt, l.y + Math.sin(a) * 210 * dt);
      l.x = p.x; l.y = p.y; this.x = p.x; this.y = p.y;
      if (Math.random() < 0.5) luta.emit({ t: 'terraMexe', x: l.x, y: l.y });
      if (t >= ((feitas + 1) * dur) / saidas) {
        feitas++;
        const fim = feitas === saidas;
        areaCirculo(luta, l, l.x, l.y, fim ? 48 : 34, pacote(h, extra, 0, { dano: h.dano / saidas * (fim ? 1.4 : 0.8), empuje: fim ? 160 : 60, aturde: fim ? 0.5 : 0.25, dirX: undefined, dirY: undefined }));
        luta.emit({ t: 'brocaSai', x: l.x, y: l.y, fim }); luta.emit({ t: 'temblor', f: fim ? 0.012 : 0.006 });
      }
      if (feitas >= saidas) { delete l.est.vuelo; l.animar('Attack', 0.3); return false; }
      return !l.ko;
    } });
  },
  // Titan Drill (Mega Excadrill): a broca gigante gira à frente moendo sem parar e anda devagar empurrando tudo
  brocaGigante(l, h, extra) {
    const luta = this.luta, dur = h.dur ?? 1.5, alc = h.alcance ?? 90;
    l.animar('Attack', dur); l.ponerEstado('blindaje', dur, { reduce: 0.5 }); l.accion = { hasta: luta.t + dur, bloquea: true, lento: 0 };
    l.texto('TITAN DRILL!', '#e5e7eb');
    let t = 0, acum = 0;
    luta.add({ tipo: 'brocaGigante', dueno: l, vivo: true, x: l.x, y: l.y, ang: 0, t: 0, dur, alcance: alc, update(dt) {
      t += dt; acum += dt; this.t = t;
      const a = angApunte(l); l.angulo = a; this.ang = a;
      const p = fijarCampo(l.x + Math.cos(a) * 70 * dt, l.y + Math.sin(a) * 70 * dt); l.x = p.x; l.y = p.y; this.x = p.x; this.y = p.y;
      const x1 = l.x + Math.cos(a) * alc, y1 = l.y + Math.sin(a) * alc * 0.8;
      for (const b of vivos(luta, l)) if (distSeg(b, l.x, l.y, x1, y1) < RADIO + 12) { const q = fijarCampo(b.x + Math.cos(a) * 80 * dt, b.y + Math.sin(a) * 80 * dt); b.x = q.x; b.y = q.y; }
      if (acum >= 0.12) { acum -= 0.12; for (const b of vivos(luta, l)) if (distSeg(b, l.x, l.y, x1, y1) < RADIO + 12) { bate(l, b, h, extra, a, { dano: h.dano / (dur / 0.12), empuje: 10, aturde: 0.15, tick: true }); luta.emit({ t: 'faisca', x: b.x, y: b.y - 10 }); } }
      return t < dur && !l.ko;
    } });
  },

  // ================================================================ Scrafty
  // Headbutt Chain (Scrafty): até três cabeçadas, cada uma pula no rival mais perto e dá blindagem
  cabecadas(l, h, extra) {
    const luta = this.luta, n = h.n ?? 3;
    if (!maisPerto(luta, l, h.alcance ?? 180)) return semAlvo(l, 'cabecadas');
    l.cortarAccion(); trava(l, luta, n * 0.28 + 0.1);
    l.texto('HEADBUTT CHAIN!', '#fdba74');
    for (let i = 0; i < n; i++) luta.programar(i * 0.28, () => {
      const r = maisPerto(luta, l, (h.alcance ?? 180) + 40);
      if (!r || l.ko) return;
      const a = Math.atan2(r.y - l.y, r.x - l.x), x0 = l.x, y0 = l.y, p = fijarCampo(r.x - Math.cos(a) * 18, r.y - Math.sin(a) * 12);
      l.x = p.x; l.y = p.y; l.angulo = a; l.animar('Attack', 0.25); l.ponerEstado('brinco', 0.22, { dur: 0.22, t0: luta.t });
      l.ponerEstado('blindaje', 1.5, { reduce: Math.min(0.5, 0.15 * (i + 1)) });
      luta.emit({ t: 'cabecada', x0, y0, x1: r.x, y1: r.y, i });
      bate(l, r, h, extra, a, { dano: h.dano / n * (i === n - 1 ? 1.3 : 0.85), empuje: i === n - 1 ? 190 : 70, aturde: i === n - 1 ? 0.5 : 0.25, pesado: i === n - 1 });
      if (i === n - 1) { luta.emit({ t: 'temblor', f: 0.012 }); luta.hitstop(80); }
    });
  },
  // Hood Snare (Mega Scrafty): joga o capuz como uma rede; quem pega é puxado e apanha uma sequência de cinco golpes
  capuzRede(l, h, extra) {
    const luta = this.luta, a = angApunte(l), alc = h.alcance ?? 200;
    l.animar('Shoot', 0.3); trava(l, luta, 0.3, a);
    const s = { tipo: 'capuzRede', dueno: l, vivo: true, x: l.x, y: l.y, x0: l.x, y0: l.y, ang: a, t: 0, update: dt => {
      s.t += dt; s.x += Math.cos(a) * 420 * dt; s.y += Math.sin(a) * 420 * dt;
      for (const b of vivos(luta, l)) if (Math.hypot(b.x - s.x, b.y - s.y) < RADIO + 8) {
        b.ponerEstado?.('aturdido', 1.2); luta.emit({ t: 'redePega', l, b });
        const q = fijarCampo(l.x + Math.cos(a) * 24, l.y + Math.sin(a) * 16); b.x = q.x; b.y = q.y;
        l.animar('MultiStrike', 0.9); trava(l, luta, 0.95, a);
        for (let i = 0; i < 5; i++) luta.programar(0.1 + i * 0.16, () => { if (b.ko || l.ko) return; bate(l, b, h, extra, a, { dano: h.dano / 5, empuje: i === 4 ? 200 : 0, aturde: i === 4 ? 0.5 : 0.3, pesado: i === 4, tick: i < 4 }); luta.emit({ t: 'socoBriga', x: b.x, y: b.y - 10, i }); if (i === 4) { luta.emit({ t: 'temblor', f: 0.012 }); luta.hitstop(80); } });
        return false;
      }
      return Math.hypot(s.x - s.x0, s.y - s.y0) < alc;
    } };
    luta.add(s);
  },

  // ================================================================ Hawlucha
  // Flying Press (Hawlucha): salto altíssimo e queda de corpo; o impacto corre em cruz pelo chão
  prensaVoadora(l, h, extra) {
    const luta = this.luta, c = alvoMira(luta, l, h.alcance ?? 220), sobe = h.sobe ?? 0.6, L = h.braco ?? 110;
    l.cortarAccion(); l.animar('Hop', sobe); l.ponerEstado('vuelo', sobe, { oculto: false, modo: 'salto', rapidez: 0 }); l.ponerEstado('invul', sobe + 0.1); trava(l, luta, sobe + 0.25);
    l.texto('FLYING PRESS!', '#86efac');
    luta.emit({ t: 'avisoCruz', x: c.x, y: c.y, braco: L, dur: sobe });
    const x0 = l.x, y0 = l.y;
    luta.add({ tipo: 'prensaVoadora', dueno: l, vivo: true, t: 0, update(dt) { this.t += dt; const k = Math.min(1, this.t / sobe); l.x = x0 + (c.x - x0) * k; l.y = y0 + (c.y - y0) * k; l.salto = Math.round(Math.sin(k * Math.PI) * 90); return k < 1 && !l.ko; } });
    luta.programar(sobe, () => {
      if (l.ko) return;
      l.salto = 0; l.animar('Attack', 0.3);
      areaCirculo(luta, l, c.x, c.y, 40, pacote(h, extra, 0, { dano: h.dano * 0.5, empuje: 120, aturde: 0.5, pesado: true, dirX: undefined, dirY: undefined }));
      for (const b of vivos(luta, l)) if (!dentroElipse(b, c.x, c.y, 40) && (Math.abs(b.x - c.x) < 16 && Math.abs(b.y - c.y) < L * 0.62 || Math.abs(b.y - c.y) < 14 && Math.abs(b.x - c.x) < L)) bate(l, b, h, extra, Math.atan2(b.y - c.y, b.x - c.x), { dano: h.dano * 0.5, empuje: 110, aturde: 0.3 });
      luta.emit({ t: 'impactoCruz', x: c.x, y: c.y, braco: L }); luta.emit({ t: 'temblor', f: 0.016 }); luta.hitstop(100);
    });
  },
  // Sky Suplex (Mega Hawlucha): agarra o rival, sobe com ele e desce de cabeça no chão
  suplexCeu(l, h, extra) {
    const luta = this.luta, r = maisPerto(luta, l, h.alcance ?? 160);
    if (!r) return semAlvo(l, 'suplex');
    const dur = h.dur ?? 0.9;
    luta.emit({ t: 'rastroSombra', x0: l.x, y0: l.y, x1: r.x, y1: r.y });
    l.cortarAccion(); l.ponerEstado('invul', dur + 0.2); trava(l, luta, dur + 0.25);
    r.ponerEstado?.('aturdido', dur + 0.1); r.ponerEstado?.('invul', dur - 0.05);
    l.texto('SKY SUPLEX!', '#bbf7d0');
    const x = r.x, y = r.y;
    luta.add({ tipo: 'suplexCeu', dueno: l, vivo: true, t: 0, update(dt) {
      this.t += dt; const k = Math.min(1, this.t / dur), alt = Math.sin(k * Math.PI) * 110;
      l.x = x; l.y = y + 2; l.salto = Math.round(alt); r.x = x; r.y = y; r.salto = Math.round(alt + 14);
      return k < 1 && !l.ko && !r.ko;
    } });
    luta.programar(dur, () => {
      l.salto = 0; r.salto = 0; delete r.est.invul;
      if (l.ko) return;
      bate(l, r, h, extra, 0, { empuje: 90, aturde: h.aturde ?? 0.8, pesado: true, dirX: undefined, dirY: undefined });
      areaCirculo(luta, l, x, y, 56, pacote(h, extra, 0, { dano: h.dano * 0.25, empuje: 120, aturde: 0.3, dirX: undefined, dirY: undefined }));
      luta.emit({ t: 'suplexImpacto', x, y }); luta.emit({ t: 'temblor', f: 0.018 }); luta.hitstop(110);
    });
  },

  // ================================================================ Diancie
  // Diamond Spiral (Diancie): diamantes orbitam e saem em espiral; a Diancie fica blindada enquanto giram
  espiralDiamante(l, h, extra) {
    const luta = this.luta, n = h.n ?? 10, orbita = 0.6;
    l.animar('Charge', orbita + 0.2); trava(l, luta, orbita + 0.2); l.ponerEstado('blindaje', orbita + 2, { reduce: 0.35 });
    l.texto('DIAMOND SPIRAL', '#f0abfc');
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, s = { tipo: 'diamante', dueno: l, vivo: true, x: l.x, y: l.y, ang: a0, t: 0, r: 22, update: dt => {
        s.t += dt;
        if (s.t < orbita) { s.ang += 7 * dt; s.x = l.x + Math.cos(s.ang) * s.r; s.y = l.y - 10 + Math.sin(s.ang) * s.r * 0.62; return !l.ko; }
        s.r += 330 * dt; s.ang += 1.4 * dt; s.x = l.x + Math.cos(s.ang) * s.r; s.y = l.y - 10 + Math.sin(s.ang) * s.r * 0.62;
        for (const b of vivos(luta, l)) if (Math.hypot(b.x - s.x, b.y - 10 - s.y) < RADIO + 4) { bate(l, b, h, extra, s.ang, { dano: h.dano / (n * 0.5), empuje: 60, aturde: 0.15 }); luta.emit({ t: 'diamanteQuebra', x: s.x, y: s.y }); return false; }
        return s.r < 240;
      } };
      luta.add(s);
    }
  },
  // Crystal Garden (Mega Diancie): cinco pilares de cristal em pentágono em volta do alvo; prendem e pulsam dano
  jardimCristal(l, h, extra) {
    const luta = this.luta, c = alvoMira(luta, l, h.alcance ?? 260), R = h.radio ?? 66, dur = h.dur ?? 3, n = 5;
    l.animar('Charge', 0.6); trava(l, luta, 0.4);
    l.texto('CRYSTAL GARDEN', '#fbcfe8');
    const pts = Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI * 2) / n; return { x: c.x + Math.cos(a) * R, y: c.y + Math.sin(a) * R * 0.62 }; });
    const e = { tipo: 'jardimCristal', dueno: l, vivo: true, x: c.x, y: c.y, radio: R, pts, t: 0, dur, acum: 0, update: dt => {
      e.t += dt; e.acum += dt;
      for (const b of vivos(luta, l)) {
        const dx = b.x - e.x, dy = (b.y - e.y) / 0.62, d = Math.hypot(dx, dy) || 1;
        if (d > R - 8 && d < R + 8) { b.x = e.x + (dx / d) * (R - 8); b.y = e.y + (dy / d) * (R - 8) * 0.62; }
      }
      if (e.acum >= 0.6) { e.acum -= 0.6; luta.emit({ t: 'cristalPulsa', x: e.x, y: e.y, radio: R }); for (const b of vivos(luta, l)) if (dentroElipse(b, e.x, e.y, R)) bate(l, b, h, extra, 0, { dano: h.dano / (dur / 0.6), empuje: 0, aturde: 0.15, tick: true, dirX: undefined, dirY: undefined }); }
      if (e.t >= dur) { luta.emit({ t: 'cristalQuebra', x: e.x, y: e.y, pts }); return false; }
      return !l.ko;
    } };
    luta.add(e);
  },

  // ================================================================ Drampa
  // Dragon Ribbon (Drampa): uma fita dracônica longa avança em onda e passa várias vezes por quem estiver no caminho
  fitaDraco(l, h, extra) {
    const luta = this.luta, a = angApunte(l), alc = h.alcance ?? 280, vel = 260, vezes = new Map();
    l.animar('Shoot', 0.6); trava(l, luta, 0.4, a);
    l.texto('DRAGON RIBBON', '#86efac');
    const s = { tipo: 'fitaDraco', dueno: l, vivo: true, x0: l.x, y0: l.y, ang: a, d: 0, t: 0, pts: [], update: dt => {
      s.t += dt; s.d += vel * dt;
      const off = Math.sin(s.t * 9) * 34, x = s.x0 + Math.cos(a) * s.d - Math.sin(a) * off, y = s.y0 + Math.sin(a) * s.d + Math.cos(a) * off * 0.62;
      s.pts.push({ x, y }); if (s.pts.length > 18) s.pts.shift();
      for (const b of vivos(luta, l)) if (Math.hypot(b.x - x, b.y - y) < RADIO + 10 && luta.t - (vezes.get(b) ?? -9) > 0.25) { vezes.set(b, luta.t); bate(l, b, h, extra, a, { dano: h.dano / 4, empuje: 40, ralentiza: { f: 0.5, dur: 1.2 }, tick: true }); }
      return s.d < alc;
    } };
    luta.add(s);
  },
  // Elder Roar (Mega Drampa): rugido em leque que quebra escudos e blindagens e atordoa; logo depois um sopro reto atravessa o leque
  rugidoAncestral(l, h, extra) {
    const luta = this.luta, a = angApunte(l), alc = h.alcance ?? 180, ang = 0.7;
    l.animar('Charge', 0.7); trava(l, luta, 0.75, a);
    l.texto('ELDER ROAR!', '#bbf7d0');
    luta.emit({ t: 'rugido', x: l.x, y: l.y, ang: a, alcance: alc });
    for (const b of vivos(luta, l)) {
      if (Math.hypot(b.x - l.x, b.y - l.y) > alc + RADIO || Math.abs(dAng(Math.atan2(b.y - l.y, b.x - l.x), a)) > ang) continue;
      delete b.est.escudo; delete b.est.blindaje;
      if (b.est.potencia) delete b.est.potencia;
      bate(l, b, h, extra, a, { dano: h.dano * 0.35, empuje: 60, aturde: h.aturde ?? 0.7 });
      b.texto('BROKEN!', '#bbf7d0');
    }
    luta.programar(0.4, () => {
      if (l.ko) return;
      const L = alc + 120, x1 = l.x + Math.cos(a) * L, y1 = l.y + Math.sin(a) * L;
      luta.emit({ t: 'sopro', x0: l.x, y0: l.y, x1, y1 });
      for (const b of vivos(luta, l)) if (distSeg(b, l.x, l.y, x1, y1) < RADIO + 14) bate(l, b, h, extra, a, { dano: h.dano * 0.65, empuje: 160, pesado: true });
      luta.emit({ t: 'temblor', f: 0.012 });
    });
  },

  // ================================================================ Tatsugiri
  // Order Up (Tatsugiri): chama um Dondozo-fantasma que vem de trás e atropela tudo em linha reta
  ordemDondozo(l, h, extra) {
    const luta = this.luta, a = angApunte(l), L = h.largo ?? 320, larg = h.largura ?? 40, vel = 560;
    l.animar('Charge', 0.5); trava(l, luta, 0.35, a);
    l.texto('ORDER UP!', '#fda4af');
    const x0 = l.x - Math.cos(a) * 60, y0 = l.y - Math.sin(a) * 60, pegos = new Set();
    luta.emit({ t: 'avisoLinha', x0, y0, x1: x0 + Math.cos(a) * L, y1: y0 + Math.sin(a) * L, dur: 0.35, cor: '#fda4af', larg });
    const e = { tipo: 'dondozo', dueno: l, vivo: true, x: x0, y: y0, ang: a, d: -40, t: 0, update: dt => {
      e.t += dt; if (e.t < 0.35) return true;
      e.d += vel * dt; e.x = x0 + Math.cos(a) * e.d; e.y = y0 + Math.sin(a) * e.d;
      for (const b of vivos(luta, l)) if (!pegos.has(b) && Math.hypot(b.x - e.x, (b.y - e.y) / 0.8) < larg + RADIO) { pegos.add(b); bate(l, b, h, extra, a, { empuje: 230, aturde: h.aturde ?? 0.6, pesado: true }); luta.emit({ t: 'temblor', f: 0.012 }); }
      return e.d < L;
    } };
    luta.add(e);
  },
  // Dragon Fountain (Mega Tatsugiri): sobe num chafariz e solta três dragões d'água que perseguem os rivais
  chafarizDraco(l, h, extra) {
    const luta = this.luta, n = h.n ?? 3;
    l.animar('Charge', 0.8); trava(l, luta, 0.7); l.ponerEstado('invul', 0.6);
    l.texto('DRAGON FOUNTAIN!', '#a5f3fc');
    luta.emit({ t: 'chafariz', x: l.x, y: l.y, dur: 0.7 });
    for (let i = 0; i < n; i++) luta.programar(0.25 + i * 0.12, () => {
      if (l.ko) return;
      const s = { tipo: 'dragaoAgua', dueno: l, vivo: true, x: l.x, y: l.y - 30, ang: -Math.PI / 2 + (i - 1) * 0.9, t: 0, pts: [], update: dt => {
        s.t += dt;
        const r = maisPerto(luta, l, 500, s);
        if (r) s.ang += Math.max(-5 * dt, Math.min(5 * dt, dAng(Math.atan2(r.y - 10 - s.y, r.x - s.x), s.ang)));
        s.x += Math.cos(s.ang) * 300 * dt; s.y += Math.sin(s.ang) * 300 * dt;
        s.pts.push({ x: s.x, y: s.y }); if (s.pts.length > 10) s.pts.shift();
        for (const b of vivos(luta, l)) if (Math.hypot(b.x - s.x, b.y - 10 - s.y) < RADIO + 6) { areaCirculo(luta, l, s.x, s.y + 10, 34, pacote(h, extra, s.ang, { dano: h.dano / n, empuje: 110, aturde: 0.35, dirX: undefined, dirY: undefined })); luta.emit({ t: 'dragaoAguaBate', x: s.x, y: s.y + 10 }); return false; }
        return s.t < 2.2;
      } };
      luta.add(s);
    });
  },

  // ================================================================ Aegislash (Stance Change)
  // King's Wall (Aegislash, forma Escudo): o escudo gigante fica na frente; o que bate nele volta e quem encosta é empurrado e enfraquecido
  muralhaReal(l, h, extra) {
    const luta = this.luta, dur = h.dur ?? 2.2;
    l.animar('Charge', 0.4); l.accion = { hasta: luta.t + dur, bloquea: false, lento: 0.5 };
    l.ponerEstado('escudo', dur, { refleja: 1, hasta: luta.t + dur }); l.ponerEstado('blindaje', dur, { reduce: 0.5 });
    l.texto("KING'S WALL", '#fde68a');
    const e = { tipo: 'muralhaReal', dueno: l, vivo: true, x: l.x, y: l.y, ang: angApunte(l), t: 0, dur, acum: 0, update: dt => {
      e.t += dt; e.acum += dt; e.x = l.x; e.y = l.y; e.ang = angApunte(l);
      if (e.acum >= 0.25) {
        e.acum -= 0.25;
        const fx = l.x + Math.cos(e.ang) * 30, fy = l.y + Math.sin(e.ang) * 18;
        for (const b of vivos(luta, l)) if (Math.hypot(b.x - fx, b.y - fy) < RADIO + 20) bate(l, b, h, extra, e.ang, { dano: h.dano * 0.1, empuje: 150, debilita: { f: 0.7, dur: 3 }, tick: true });
      }
      return e.t < dur && !l.ko;
    } };
    luta.add(e);
  },
  // Royal Execution (Aegislash, forma Lâmina): três giros de espada que crescem; o último crava a lâmina-fantasma no chão
  execucaoReal(l, h, extra) {
    const luta = this.luta, giros = 3;
    l.animar('Attack', 0.9); trava(l, luta, 0.95);
    l.texto('ROYAL EXECUTION!', '#fca5a5');
    for (let i = 0; i < giros; i++) luta.programar(i * 0.22, () => {
      if (l.ko) return;
      const R = 46 + i * 16;
      l.ponerEstado('girando', 0.2);
      luta.emit({ t: 'giroEspada', x: l.x, y: l.y, radio: R, i });
      areaCirculo(luta, l, l.x, l.y, R, pacote(h, extra, 0, { dano: h.dano * 0.18, empuje: 40, aturde: 0.15, tick: true, dirX: undefined, dirY: undefined }));
    });
    luta.programar(giros * 0.22 + 0.1, () => {
      if (l.ko) return;
      const a = angApunte(l), x = l.x + Math.cos(a) * 50, y = l.y + Math.sin(a) * 32;
      areaCirculo(luta, l, x, y, 46, pacote(h, extra, a, { dano: h.dano * 0.46, empuje: 180, aturde: 0.6, pesado: true }));
      luta.emit({ t: 'espadaCrava', x, y }); luta.emit({ t: 'temblor', f: 0.016 }); luta.hitstop(100);
    });
  },
  // a ult do Aegislash depende da postura: Escudo = King's Wall, Lâmina = Royal Execution
  ultPostura(l, h, extra) {
    return l.lamina ? formasMega.execucaoReal.call(this, l, { ...h, ...(h.lamina ?? {}) }, extra) : formasMega.muralhaReal.call(this, l, { ...h, ...(h.escudo ?? {}) }, extra);
  },
};

// como a IA usa cada forma (o mesmo formato de planoDe em ia.js) e o ícone de cada uma
const area = (alc, ret) => P => { P.tipo = 'area'; P.alcance = alc; P.retardo = ret; };
const mele = (alc, ret = 0.1) => P => { P.tipo = 'mele'; P.alcance = alc; P.retardo = ret; };
export const META = {
  mareLenta: { ia: area(110, 0.6), icono: 'pulso' }, conchaGiro: { ia: area(150, 0.3), icono: 'rafaga' },
  mergulhoAntigo: { ia: mele(260, 0.5), icono: 'vuelo' }, rasanteFossil: { ia: area(280, 1), icono: 'meteoro' },
  rasanteAco: { ia: area(240, 0.3), icono: 'cortesSuelo' }, cortinaLaminas: { ia: mele(200, 0.1), icono: 'dash' },
  prismaLunar: { ia: area(240, 0.5), icono: 'pulso' }, estrelaDesejo: { ia: area(260, 0.9), icono: 'meteoro' },
  corteIai: { ia: mele(160, 0.4), icono: 'tajo' }, estrelaLaminas: { ia: mele(200, 0.1), icono: 'jabLuna' },
  rouboJoia: { ia: mele(190, 0.05), icono: 'dash' }, joiaEspelho: { ia: P => { P.tipo = 'defensa'; P.alcance = 200; }, icono: 'espejo' },
  mandibulaFalsa: { ia: mele(140, 0.1), icono: 'golpe' }, mandibulaDupla: { ia: mele(140, 0.35), icono: 'golpe' },
  palmaZen: { ia: mele(140, 0.5), icono: 'golpe' }, cemPalmas: { ia: mele(70, 0.1), icono: 'rafaga' },
  zigueRaio: { ia: mele(190, 0.1), icono: 'embestidas' }, paraRaios: { ia: area(190, 0.3), icono: 'pulso' },
  vulcaoCostas: { ia: area(230, 0.7), icono: 'erupcion' }, fendaMagma: { ia: P => { P.alcance = 240; P.ancho = 20; P.retardo = 0.3; }, icono: 'cortesSuelo' },
  agulhaCostura: { ia: P => { P.alcance = 240; P.ancho = 10; P.retardo = 0.3; }, icono: 'proyectil' }, caixaSurpresa: { ia: area(230, 0.7), icono: 'trampa' },
  luaDesastre: { ia: area(210, 0.4), icono: 'jabLuna' }, presagio: { ia: area(280, 0.2), icono: 'espejo' },
  prisaoGelo: { ia: area(210, 1), icono: 'trampa' }, bocaGelo: { ia: P => { P.alcance = 150; P.ancho = 50; P.retardo = 0.3; }, icono: 'cono' },
  sinosEco: { ia: P => { P.alcance = 200; P.ancho = 50; P.retardo = 0.5; }, icono: 'viento' }, ressonancia: { ia: area(250, 0.6), icono: 'pulso' },
  torpedo: { ia: mele(280, 0.2), icono: 'dash' }, frenesi: { ia: area(250, 1.4), icono: 'vuelo' },
  brocaTunel: { ia: area(300, 0.5), icono: 'vuelo' }, brocaGigante: { ia: mele(90, 0.1), icono: 'rodar' },
  cabecadas: { ia: mele(170, 0.1), icono: 'embestidas' }, capuzRede: { ia: P => { P.alcance = 190; P.ancho = 12; P.retardo = 0.3; }, icono: 'laco' },
  prensaVoadora: { ia: area(210, 0.6), icono: 'salto' }, suplexCeu: { ia: mele(150, 0.05), icono: 'agarre' },
  espiralDiamante: { ia: area(150, 0.7), icono: 'rafaga' }, jardimCristal: { ia: area(250, 0.4), icono: 'escudo' },
  fitaDraco: { ia: P => { P.alcance = 260; P.ancho = 30; P.retardo = 0.4; }, icono: 'viento' }, rugidoAncestral: { ia: P => { P.alcance = 170; P.ancho = 60; P.retardo = 0.1; }, icono: 'cono' },
  ordemDondozo: { ia: P => { P.alcance = 300; P.ancho = 36; P.retardo = 0.5; }, icono: 'embestidas' }, chafarizDraco: { ia: area(400, 0.8), icono: 'proyectil' },
  muralhaReal: { ia: P => { P.tipo = 'defensa'; P.alcance = 120; }, icono: 'escudo' }, execucaoReal: { ia: mele(70, 0.1), icono: 'tajo' }, ultPostura: { ia: mele(80, 0.1), icono: 'tajo' },
};
