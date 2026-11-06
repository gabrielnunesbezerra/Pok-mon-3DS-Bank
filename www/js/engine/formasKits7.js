// Kits de Glalie, Gardevoir e Absol. Como em formasKits4.js, `h.mega` (posto nos kits da Mega) muda o que a skill faz.
import { RADIO } from '../config.js';
import { fijarCampo } from './fisica.js';
import { areaCirculo, pacote, atingir } from './entidades.js';
import { aleatorio } from './util.js';
import { congelar } from './formasKits9.js';
// Gardevoir dentro do próprio Santuário: a primeira skill vira o raio que carrega e dispara (como o Solar Beam da Mega Venusaur)
function noSantuario(luta, l) { return luta.entidades.some(e => e.tipo === 'santuario' && e.dueno === l && e.t < e.dur && Math.hypot(l.x - e.x, (l.y - e.y) / 0.62) < e.radio); }

const angApunte = l => Math.atan2(l.ay - l.y, l.ax - l.x);
const dAng = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const dentro = (b, x, y, r) => Math.hypot(b.x - x, (b.y - y) / 0.62) < r;
const inimigos = (luta, l) => luta.blancos(l).filter(b => !b.oculto && !b.est?.vuelo && !b.ko);
const aliados = (luta, l) => [l, ...luta.aliados(l)];
function maisPerto(luta, l, alc, de = l) { let m = null, dm = alc; for (const b of inimigos(luta, l)) { const d = Math.hypot(b.x - de.x, b.y - de.y); if (d < dm && !b.esClon) { dm = d; m = b; } } return m; }
function mirar(l, alc) { const r = l.rival, a = angApunte(l); if (!r || r.ko || r.oculto) return a; const ar = Math.atan2(r.y - l.y, r.x - l.x); return Math.hypot(r.x - l.x, r.y - l.y) < alc && Math.abs(dAng(ar, a)) < 0.8 ? ar : a; }
// ponto da mira, limitado ao alcance
function pontoMira(l, alc) { const r = maisPerto(l.luta, l, alc + 40), a = r ? Math.atan2(r.y - l.y, r.x - l.x) : angApunte(l), d = Math.min(alc, r ? Math.hypot(r.x - l.x, r.y - l.y) : Math.hypot(l.ax - l.x, l.ay - l.y)); return fijarCampo(l.x + Math.cos(a) * d, l.y + Math.sin(a) * d); }
function puxar(b, x, y, forca, dt) { const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy) || 1; if (d < 6) return; b.empX += (dx / d) * forca * dt; b.empY += (dy / d) * forca * dt; }
// tiro reto com update próprio (atravessa quando `fura`)
function tiro(luta, l, o) {
  const ja = new Set();
  const p = { tipo: o.tipo, dueno: l, vivo: true, x: l.x + Math.cos(o.ang) * 10, y: l.y + Math.sin(o.ang) * 6, ang: o.ang, t: 0, ...o.extra, update: dt => {
    p.t += dt; p.x += Math.cos(o.ang) * o.vel * dt; p.y += Math.sin(o.ang) * o.vel * dt * 0.85;
    for (const b of inimigos(luta, l)) { if (ja.has(b) || Math.hypot(b.x - p.x, b.y - p.y) > RADIO + (o.raio ?? 5)) continue; ja.add(b); o.acerta(b, p); if (!o.fura) { o.fim?.(p); return false; } }
    if (p.t >= o.alc / o.vel) { o.fim?.(p); return false; }
    return true;
  } };
  return luta.add(p);
}
const LIMPA_CC = ['aturdido', 'paralizado', 'dormido', 'confuso', 'enredado', 'lento', 'ancorado', 'silencio', 'debil'];

export const formasKits7 = {
  // ================================================================ GLALIE
  // Cometa Criogênico (Mega): pedra de gelo gigante que cai na mira, congela (atordoa) e quebra a armadura
  cometaGelo(l, h, extra) {
    const luta = this.luta, p = pontoMira(l, h.alcance ?? 230), R = h.radio ?? 58, voo = h.vuelo ?? 0.5;
    l.animar('Shoot', 0.4); l.accion = { hasta: luta.t + 0.25, lento: 0.3, angulo: Math.atan2(p.y - l.y, p.x - l.x) };
    luta.emit({ t: 'cometaGelo', x0: l.x, y0: l.y, x: p.x, y: p.y, r: R, dur: voo });
    luta.programar(voo, () => {
      if (l.ko) return;
      for (const b of inimigos(luta, l)) if (dentro(b, p.x, p.y, R)) { atingir(l, b, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, empuje: 60, aturde: h.aturde ?? 1 })); b.ponerEstado('defBaja', 4, {}); b.texto('FROZEN!', '#bae6fd'); }
      luta.emit({ t: 'impactoGelo', x: p.x, y: p.y, r: R }); luta.emit({ t: 'temblor', f: 0.012 }); luta.hitstop(80);
    });
  },
  // Tempestade 360° (Mega): estalactites para todos os lados + escudo de gelo; quem já estava lento congela
  tempestadeGelo(l, h, extra) {
    const luta = this.luta, n = h.n ?? 12;
    l.animar('Rotate', 0.5); l.accion = { hasta: luta.t + 0.3, bloquea: true, lento: 0 };
    l.escudo = Math.max(l.escudo ?? 0, h.escudo ?? 20); l.ponerEstado('escudo', 3, {});
    luta.emit({ t: 'escudoGelo', l });
    for (let i = 0; i < n; i++) tiro(luta, l, { tipo: 'estalactite', ang: (i / n) * Math.PI * 2, vel: 330, alc: h.alcance ?? 170, raio: 6, fura: true, acerta: (b, p) => {
      const congela = !!b.est.lento;
      atingir(l, b, pacote(h, extra, p.ang, { dano: h.dano / 3, empuje: 30, aturde: congela ? 1.2 : 0, ralentiza: { f: 0.3, dur: 2 } }));
      if (congela) { b.texto('FROZEN!', '#bae6fd'); luta.emit({ t: 'impactoGelo', x: b.x, y: b.y, r: 20 }); }
    } });
  },
  // Abismo das Mandíbulas (Mega ult): abre a mandíbula, puxa todo mundo do cone para a boca e estilhaça:
  // muito dano, atordoa e deixa o chão congelado machucando
  abismoMandibula(l, h, extra) {
    const luta = this.luta, R = h.alcance ?? 170, abre = ((h.angulo ?? 80) * Math.PI) / 180, a = mirar(l, R + 30), suga = h.suga ?? 0.8;
    const bx = l.x + Math.cos(a) * 22, by = l.y + Math.sin(a) * 14;
    l.animar('Charge', suga + 0.3); l.accion = { hasta: luta.t + suga + 0.3, bloquea: true, lento: 0, angulo: a };
    l.ponerEstado('blindaje', suga + 0.3, { reduce: 0.4 });
    luta.emit({ t: 'abismo', l, ang: a, R, abre, dur: suga });
    let t = 0;
    luta.add({ tipo: 'sucaoAbismo', dueno: l, vivo: true, update: dt => {
      t += dt; if (l.ko) return false;
      for (const b of inimigos(luta, l)) { const dx = b.x - l.x, dy = b.y - l.y, d = Math.hypot(dx, dy); if (d < R + RADIO && Math.abs(dAng(Math.atan2(dy, dx), a)) < abre / 2 + 0.15) puxar(b, bx, by, h.puxa ?? 1500, dt); }
      return t < suga;
    } });
    luta.programar(suga, () => {
      if (l.ko) return;
      areaCirculo(luta, l, bx, by, h.radio ?? 64, pacote(h, extra, a, { dirX: undefined, dirY: undefined, empuje: 140, aturde: h.aturde ?? 1.5, pesado: true }));
      // quem foi mordido vira um totem de gelo, com o chão congelado em volta enquanto durar
      if (h.totem) for (const b of inimigos(luta, l)) if (dentro(b, bx, by, h.radio ?? 64)) {
        congelar(luta, b, h.totem); b.ponerEstado('totem', h.totem, {});
        luta.add({ tipo: 'chaoGelo', dueno: l, vivo: true, x: b.x, y: b.y, radio: 54, t: 0, dur: h.totem, prox: 0.5, update(dt) { this.t += dt; this.x = b.x; this.y = b.y; if (this.t >= this.prox) { this.prox += 0.5; for (const o of inimigos(luta, l)) if (o !== b && dentro(o, this.x, this.y, this.radio)) { o.recibir(l, { dano: 1.5, tipo: 'ICE', tick: true }); o.ponerEstado('lento', 0.6, { f: Math.max(0.45, o.est.lento?.f ?? 0) }); } } return this.t < this.dur && !b.ko && !!b.est.congelado; } });
      }
      luta.emit({ t: 'estilhaco', x: bx, y: by, r: h.radio ?? 64 }); luta.emit({ t: 'temblor', f: 0.018 }); luta.hitstop(120);
      const e = { tipo: 'chaoGelo', dueno: l, vivo: true, x: bx, y: by, radio: (h.radio ?? 64) + 16, t: 0, dur: 4, prox: 0.5, update: dt => {
        e.t += dt; if (e.t >= e.prox) { e.prox += 0.5; for (const b of inimigos(luta, l)) if (dentro(b, e.x, e.y, e.radio)) { b.recibir(l, { dano: h.danoChao ?? 2, tipo: 'ICE', tick: true }); b.ponerEstado('lento', 0.6, { f: Math.max(0.4, b.est.lento?.f ?? 0) }); } }
        return e.t < e.dur;
      } };
      luta.add(e);
    });
  },

  // ================================================================ GARDEVOIR
  // Salto Efêmero (Ralts): aura que deixa você e os aliados perto mais rápidos
  auraVeloz(l, h) {
    const luta = this.luta;
    for (const a of aliados(luta, l)) if (a === l || Math.hypot(a.x - l.x, a.y - l.y) < (h.radio ?? 110)) { a.ponerEstado('rapido', h.dur ?? 3, { vel: h.vel ?? 1.3 }); luta.emit({ t: 'auraVeloz', l: a }); }
    l.texto('SPEED UP!', '#f9a8d4');
  },
  // Valsa Dimensional (Kirlia): escudo de mana em você e nos aliados perto
  valsaEscudo(l, h) {
    const luta = this.luta;
    for (const a of aliados(luta, l)) if (a === l || Math.hypot(a.x - l.x, a.y - l.y) < (h.radio ?? 110)) { a.escudo = Math.max(a.escudo ?? 0, h.absorbe ?? 16); a.ponerEstado('escudo', h.dur ?? 3, {}); luta.emit({ t: 'valsa', l: a }); }
  },
  // Distorção Psíquica: distorce o espaço na mira; quem estiver lá apanha e fica preso
  distorcao(l, h, extra) {
    if (h.raio && noSantuario(this.luta, l)) return this.formas.raioSolar.call(this, l, { ...h, ...h.raio }, extra);
    const luta = this.luta, p = pontoMira(l, h.alcance ?? 220), R = h.radio ?? 40, c = h.carga ?? 0.35;
    l.animar('Charge', c + 0.1); l.accion = { hasta: luta.t + 0.2, lento: 0.3, angulo: Math.atan2(p.y - l.y, p.x - l.x) };
    luta.emit({ t: 'distorcao', x: p.x, y: p.y, r: R, dur: c });
    luta.programar(c, () => { if (l.ko) return; for (const b of inimigos(luta, l)) if (dentro(b, p.x, p.y, R)) { atingir(l, b, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, empuje: 0 })); this.prender(b, h.prendeDur ?? 1); } luta.emit({ t: 'distorcaoFim', x: p.x, y: p.y, r: R }); });
  },
  // Santuário Astral: zona que cura você e os aliados e reduz o dano que levam. Mega: maior, empurra inimigos que
  // entram e deixa quem está dentro imune a controle
  santuario(l, h) {
    const luta = this.luta, R = h.radio ?? 70, dur = h.dur ?? 4, x = l.x, y = l.y;
    l.animar('Charge', 0.4);
    const e = { tipo: 'santuario', dueno: l, vivo: true, x, y, radio: R, t: 0, dur, mega: !!h.mega, prox: 0, update: dt => {
      e.t += dt;
      for (const a of aliados(luta, l)) if (dentro(a, x, y, R)) { a.ponerEstado('blindaje', 0.3, { reduce: h.reduce ?? 0.25 }); if (h.mega) for (const k of LIMPA_CC) delete a.est[k]; }
      if (e.t >= e.prox) {
        e.prox += 0.5;
        for (const a of aliados(luta, l)) if (dentro(a, x, y, R)) a.cura(a.hpMax * (h.cura ?? 0.02));
        if (h.mega) for (const b of inimigos(luta, l)) if (dentro(b, x, y, R + 6)) { const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy) || 1; atingir(l, b, { dano: 2, tipo: 'FAIRY', dirX: dx / d, dirY: dy / d, empuje: 200, tick: true }); }
      }
      return e.t < dur && !l.ko;
    } };
    luta.add(e);
  },
  // Singularidade Obscura: buraco negro na mira que puxa e explode. Mega: enorme, puxa muito mais e a explosão
  // tira uma parte da vida máxima de quem estiver dentro
  singularidade(l, h, extra) {
    const luta = this.luta, p = pontoMira(l, h.alcance ?? 240), R = h.radio ?? (h.mega ? 110 : 70), dur = h.dur ?? (h.mega ? 2.2 : 1.4);
    l.animar('Charge', 0.5); l.accion = { hasta: luta.t + 0.35, bloquea: true, lento: 0 };
    const e = { tipo: 'buracoNegro', dueno: l, vivo: true, x: p.x, y: p.y, radio: R, t: 0, dur, mega: !!h.mega, prox: 0.3, update: dt => {
      e.t += dt; if (l.ko) return false;
      for (const b of inimigos(luta, l)) if (dentro(b, e.x, e.y, R * 1.5)) puxar(b, e.x, e.y, h.mega ? 1300 : 800, dt);
      if (e.t >= e.prox) { e.prox += 0.35; for (const b of inimigos(luta, l)) if (dentro(b, e.x, e.y, R)) b.recibir(l, { dano: h.danoTick ?? 1.5, tipo: 'PSYCHIC', tick: true }); }
      if (e.t < dur) return true;
      for (const b of inimigos(luta, l)) if (dentro(b, e.x, e.y, R)) { atingir(l, b, pacote(h, extra, 0, { dano: h.dano + (h.mega ? b.hpMax * (h.porVida ?? 0.12) : 0), dirX: undefined, dirY: undefined, empuje: 160, pesado: true })); }
      luta.emit({ t: 'explodeBuraco', x: e.x, y: e.y, r: R, mega: !!h.mega }); luta.emit({ t: 'temblor', f: h.mega ? 0.02 : 0.012 }); luta.hitstop(100);
      return false;
    } };
    luta.add(e);
  },
  // Supernova Pixie (Mega): 3 estrelas em cone que silenciam
  estrelasPixie(l, h, extra) {
    if (h.raio && noSantuario(this.luta, l)) return this.formas.raioSolar.call(this, l, { ...h, ...h.raio }, extra);
    const luta = this.luta, a = mirar(l, 240);
    l.animar('Shoot', 0.3); l.accion = { hasta: luta.t + 0.2, lento: 0.3, angulo: a };
    for (let i = -1; i <= 1; i++) tiro(luta, l, { tipo: 'estrelaPixie', ang: a + i * 0.3, vel: 340, alc: h.alcance ?? 240, raio: 7, acerta: (b, p) => { atingir(l, b, pacote(h, extra, p.ang, { empuje: 40 })); b.ponerEstado('silencio', h.silencio ?? 1.2, {}); b.texto('SILENCED!', '#f9a8d4'); }, fim: p => luta.emit({ t: 'estrelaFim', x: p.x, y: p.y }) });
  },

  // ================================================================ ABSOL
  // Garra da Calamidade: meia-lua de sombra que avança (20% de chance de crítico). Mega: atravessa a arena toda,
  // quebra armadura e sempre dá crítico em quem já foi marcado por ela
  garraCalamidade(l, h, extra) {
    const luta = this.luta, a = mirar(l, 240);
    l.animar('Attack', 0.3); l.accion = { hasta: luta.t + 0.2, lento: 0.2, angulo: a };
    tiro(luta, l, { tipo: 'meiaLuaSombra', ang: a, vel: h.mega ? 460 : 380, alc: h.alcance ?? (h.mega ? 640 : 200), raio: h.mega ? 16 : 12, fura: true, extra: { mega: !!h.mega }, acerta: (b, p) => {
      const crit = (h.mega && b.est.marcaRuina) || aleatorio() < (h.crit ?? 0.2);
      atingir(l, b, pacote(h, extra, p.ang, { dano: h.dano * (crit ? 1.6 : 1), empuje: 50 }));
      if (crit) { b.texto('CRITICAL!', '#ef4444'); luta.emit({ t: 'critico', x: b.x, y: b.y - b.alto * 0.5 }); }
      b.ponerEstado('marcaRuina', 5, {});
      if (h.mega) b.ponerEstado('defBaja', 3, {});
    } });
  },
  // Preságio Sombrio: postura de 1s que bloqueia 60% e deixa lento quem bater. Mega: fica intocável por 0,8s;
  // se desviar de algo, zera a Garra e ganha velocidade de ataque
  presagio(l, h) {
    const luta = this.luta, dur = h.dur ?? (h.mega ? 0.8 : 1);
    l.cortarAccion(); l.animar('Charge', dur);
    if (h.mega) l.ponerEstado('invul', dur); else l.ponerEstado('blindaje', dur, { reduce: 0.6 });
    let usou = false;
    l.ponerEstado('presagio', dur, { fn: (fonte, desviou) => {
      if (usou) return; usou = true;
      if (h.mega && desviou) { l.cd.rmb = 0; l.ponerEstado('potencia', 4, { n: 1, mult: 0, cadencia: 1.4, vel: 0, reduce: 0, color: '#c4b5fd' }); l.ponerEstado('rapido', 2, { vel: 1.3 }); l.texto('FORESEEN!', '#c4b5fd'); luta.emit({ t: 'presagioOk', l }); }
      else if (!h.mega) { fonte.ponerEstado('lento', 2, { f: 0.5 }); fonte.recibir(l, { dano: h.dano ?? 4, tipo: 'DARK', empuje: 60, dirX: Math.sign(fonte.x - l.x) || 1, dirY: 0 }); l.texto('OMEN!', '#c4b5fd'); luta.emit({ t: 'presagioOk', l }); }
    } });
    luta.emit({ t: 'pressagio', l, dur, mega: !!h.mega });
  },
  // Tempestade da Perdição: corte fundo num alvo só (mais dano se ele estiver sozinho). Mega: intocável, 6 cortes em
  // zigue-zague numa área grande e um impacto no centro que joga todo mundo para o alto
  tempestadePerdicao(l, h, extra) {
    const luta = this.luta, b0 = maisPerto(luta, l, h.alcance ?? 180);
    if (!h.mega) {
      if (!b0) { if (l.humano) l.avisar('perd', () => l.texto('NO TARGET', '#fca5a5')); return false; }
      const a = Math.atan2(b0.y - l.y, b0.x - l.x), so = !luta.aliados(b0).some(o => Math.hypot(o.x - b0.x, o.y - b0.y) < 140);
      const p = fijarCampo(b0.x + Math.cos(a) * 30, b0.y + Math.sin(a) * 20), x0 = l.x, y0 = l.y; let t = 0;
      l.cortarAccion(); l.ponerEstado('invul', 0.35); l.animar('Attack', 0.4);
      luta.emit({ t: 'corteRuina', x0, y0, x1: p.x, y1: p.y });
      l.accion = { hasta: luta.t + 0.16, bloquea: true, lento: 0, angulo: a, update: dt => { t += dt; const k = Math.min(1, t / 0.16); l.x = x0 + (p.x - x0) * k; l.y = y0 + (p.y - y0) * k; } };
      luta.programar(0.1, () => { if (l.ko || b0.ko) return; atingir(l, b0, pacote(h, extra, a, { dano: h.dano * (so ? 1.35 : 1), empuje: 120, pesado: true })); if (so) b0.texto('ISOLATED!', '#c4b5fd'); luta.hitstop(110); luta.emit({ t: 'temblor', f: 0.012 }); });
      return;
    }
    const c = b0 ? { x: b0.x, y: b0.y } : fijarCampo(l.ax, l.ay), R = h.radio ?? 110, n = 6, passo = 0.11;
    l.cortarAccion(); l.ponerEstado('invul', n * passo + 0.5); l.animar('Attack', n * passo + 0.3);
    const pts = Array.from({ length: n + 1 }, (_, i) => { const ang = i * 2.6 + 0.4; return fijarCampo(c.x + Math.cos(ang) * R * (i % 2 ? 1 : 0.85), c.y + Math.sin(ang) * R * 0.62 * (i % 2 ? 1 : 0.85)); });
    luta.emit({ t: 'zigueZague', pts, passo });
    let i = 0, t = 0;
    l.accion = { hasta: luta.t + n * passo + 0.35, bloquea: true, lento: 0, update: dt => {
      t += dt; const k = Math.min(n, t / passo), j = Math.floor(k), f = k - j, p0 = pts[Math.min(j, n)], p1 = pts[Math.min(j + 1, n)];
      if (j < n) { l.x = p0.x + (p1.x - p0.x) * f; l.y = p0.y + (p1.y - p0.y) * f; l.angulo = Math.atan2(p1.y - p0.y, p1.x - p0.x); }
      while (i < Math.min(j, n)) {
        const A = pts[i], B = pts[i + 1], L = Math.hypot(B.x - A.x, B.y - A.y) || 1, ux = (B.x - A.x) / L, uy = (B.y - A.y) / L;
        for (const b of inimigos(luta, l)) { const qx = b.x - A.x, qy = b.y - A.y, lon = qx * ux + qy * uy, lat = Math.abs(-qx * uy + qy * ux); if (lon > -8 && lon < L + 8 && lat < 22) atingir(l, b, pacote(h, extra, Math.atan2(uy, ux), { dano: h.dano * 0.1, empuje: 20 })); }
        i++;
      }
    }, fin: () => {
      if (l.ko) return;
      l.x = c.x; l.y = c.y;
      for (const b of inimigos(luta, l)) if (dentro(b, c.x, c.y, R)) { atingir(l, b, pacote(h, extra, 0, { dano: h.dano * 0.45, dirX: undefined, dirY: undefined, empuje: 0, aturde: 1, pesado: true })); const x0 = b.x, y0 = b.y; let tt = 0; luta.add({ tipo: 'lanzado', dueno: null, vivo: true, update: d => { tt += d; if (b.ko) { b.salto = 0; return false; } b.x = x0; b.y = y0; b.salto = Math.round(Math.sin(Math.min(1, tt) * Math.PI) * 50); if (tt < 1) return true; b.salto = 0; return false; } }); }
      luta.emit({ t: 'impactoRuina', x: c.x, y: c.y, r: R }); luta.emit({ t: 'temblor', f: 0.02 }); luta.hitstop(130);
    } };
  },
};
