// Absol (pulo negro e corte triplo) e Glalie (Gyro Ball, bola de neve, escudo glacial e Blizzard).
// "Congelado" = atordoado + estado `congelado` (o Gyro Ball quebra o gelo com dano extra).
import { RADIO } from '../config.js';
import { fijarCampo } from './fisica.js';
import { pacote, atingir } from './entidades.js';

const angApunte = l => Math.atan2(l.ay - l.y, l.ax - l.x);
const dAng = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const dentro = (b, x, y, r) => Math.hypot(b.x - x, (b.y - y) / 0.62) < r;
const inimigos = (luta, l) => luta.blancos(l).filter(b => !b.oculto && !b.est?.vuelo && !b.ko);
function maisPerto(luta, l, alc, de = l) { let m = null, dm = alc; for (const b of inimigos(luta, l)) { const d = Math.hypot(b.x - de.x, b.y - de.y); if (d < dm && !b.esClon) { dm = d; m = b; } } return m; }
function mirar(l, alc) { const r = l.rival, a = angApunte(l); if (!r || r.ko || r.oculto) return a; const ar = Math.atan2(r.y - l.y, r.x - l.x); return Math.hypot(r.x - l.x, r.y - l.y) < alc && Math.abs(dAng(ar, a)) < 0.8 ? ar : a; }
const direcao = (l, alc) => { const mx = l.intento?.mx ?? 0, my = l.intento?.my ?? 0; return Math.hypot(mx, my) > 0.2 ? Math.atan2(my, mx) : mirar(l, alc); };
export function congelar(luta, b, dur) { if (b.ko) return; b.ponerEstado('aturdido', dur); b.ponerEstado('congelado', dur, {}); b.texto('FROZEN!', '#bae6fd'); luta.emit({ t: 'congelaK9', l: b, dur }); }
// segmento A-B: quem está a menos de `lat` da linha
const naLinha = (b, A, B, lat) => { const L = Math.hypot(B.x - A.x, B.y - A.y) || 1, ux = (B.x - A.x) / L, uy = (B.y - A.y) / L, qx = b.x - A.x, qy = b.y - A.y, lon = qx * ux + qy * uy; return lon > -8 && lon < L + 8 && Math.abs(-qx * uy + qy * ux) < lat; };

export const formasKits9 = {
  // ================================================================ ABSOL
  // Sucker Punch (dash): pulo negro na direção do analógico (ou no alvo), cai com um corte de sombra em volta
  puloNegro(l, h, extra) {
    const luta = this.luta, a = direcao(l, (h.dist ?? 140) + 30), r = maisPerto(luta, l, (h.dist ?? 140) + 20);
    const d = r && Math.abs(dAng(Math.atan2(r.y - l.y, r.x - l.x), a)) < 0.6 ? Math.max(20, Math.hypot(r.x - l.x, r.y - l.y) - 14) : h.dist ?? 140;
    const p = fijarCampo(l.x + Math.cos(a) * d, l.y + Math.sin(a) * d), x0 = l.x, y0 = l.y, dur = h.dur ?? 0.26;
    l.cortarAccion(); l.ponerEstado('invul', dur); l.animar('Hop', dur); l.angulo = a;
    luta.emit({ t: 'puloNegro', x0, y0, x1: p.x, y1: p.y, dur });
    let t = 0;
    l.accion = { hasta: luta.t + dur, bloquea: true, lento: 0, angulo: a, update: dt => { t += dt; const k = Math.min(1, t / dur); l.x = x0 + (p.x - x0) * k; l.y = y0 + (p.y - y0) * k; l.salto = Math.round(Math.sin(k * Math.PI) * 30); },
      fin: () => { l.salto = 0; if (l.ko) return; for (const b of inimigos(luta, l)) if (dentro(b, l.x, l.y, h.radio ?? 40)) atingir(l, b, pacote(h, extra, a, { dirX: undefined, dirY: undefined, empuje: 70 })); luta.emit({ t: 'caiNegro', x: l.x, y: l.y, r: h.radio ?? 40 }); } };
  },
  // Corte Triplo: ativa 3 vezes. 1ª: a meia-lua de sombra (Garra da Calamidade); 2ª: corte negro em volta toda;
  // 3ª: corte reto que rasga o chão até longe (como a ult da Sneasler)
  slashTriplo(l, h, extra) {
    const luta = this.luta, t0 = luta.t;
    if (!(t0 < (l.slashHasta ?? 0) && (l.slashN ?? 0) < 3)) l.slashN = 0;
    const n = ++l.slashN; l.slashHasta = t0 + (h.janela ?? 2.5);
    l.cd.rmb = n >= 3 ? h.cd : 0.35;
    luta.programar((h.janela ?? 2.5) + 0.05, () => { if (l.slashN === n && n < 3) { l.slashN = 0; l.cd.rmb = Math.max(l.cd.rmb, h.cd * 0.7); } });
    if (n === 1) return this.formas.garraCalamidade.call(this, l, h, extra);
    if (n === 2) {
      const R = h.radioGiro ?? (h.mega ? 76 : 60);
      l.animar('Rotate', 0.35); l.ponerEstado('girando', 0.3); l.accion = { hasta: luta.t + 0.25, bloquea: true, lento: 0 };
      luta.emit({ t: 'corteRoda', l, r: R });
      for (const b of inimigos(luta, l)) if (dentro(b, l.x, l.y, R)) { const dx = b.x - l.x, dy = b.y - l.y, d = Math.hypot(dx, dy) || 1; atingir(l, b, pacote(h, extra, 0, { dano: h.dano * 1.1, dirX: dx / d, dirY: dy / d, empuje: 120 })); b.ponerEstado('marcaRuina', 5, {}); if (h.mega) b.ponerEstado('defBaja', 3, {}); }
      return;
    }
    // 3ª: corte em linha que vai rasgando o chão
    const a = mirar(l, 300), L = h.linha ?? (h.mega ? 380 : 280), A = { x: l.x, y: l.y }, B = fijarCampo(l.x + Math.cos(a) * L, l.y + Math.sin(a) * L), ja = new Set();
    l.animar('Attack', 0.4); l.accion = { hasta: luta.t + 0.3, bloquea: true, lento: 0, angulo: a };
    luta.emit({ t: 'corteLinha', x0: A.x, y0: A.y, x1: B.x, y1: B.y, dur: 0.3 });
    for (let i = 1; i <= 6; i++) luta.programar(0.05 * i, () => {
      if (l.ko) return; const f = i / 6, P = { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f };
      for (const b of inimigos(luta, l)) if (!ja.has(b) && naLinha(b, A, P, 22)) { ja.add(b); const crit = !!b.est.marcaRuina; atingir(l, b, pacote(h, extra, a, { dano: h.dano * (crit ? 2.1 : 1.5), empuje: 90, pesado: true })); if (crit) { b.texto('CRITICAL!', '#ef4444'); luta.emit({ t: 'critico', x: b.x, y: b.y - b.alto * 0.5 }); } }
    });
  },

  // ================================================================ GLALIE
  // Gyro Ball (dash): avança girando e puxa quem está perto do caminho; em quem estiver congelado, quebra o gelo
  // com muito dano. Mega: vai mais longe e deixa gelo no caminho
  gyroBall(l, h, extra) {
    const luta = this.luta, a = direcao(l, (h.dist ?? 150) + 30), dur = h.dur ?? 0.4, x0 = l.x, y0 = l.y, p = fijarCampo(l.x + Math.cos(a) * (h.dist ?? 150), l.y + Math.sin(a) * (h.dist ?? 150)), ja = new Set();
    l.cortarAccion(); l.ponerEstado('girando', dur); l.ponerEstado('blindaje', dur, { reduce: 0.4 }); l.animar('Rotate', dur);
    let t = 0;
    luta.emit({ t: 'gyroBall', l, dur });
    l.accion = { hasta: luta.t + dur, bloquea: true, lento: 0, angulo: a, update: dt => {
      t += dt; const k = Math.min(1, t / dur); l.x = x0 + (p.x - x0) * k; l.y = y0 + (p.y - y0) * k;
      for (const b of inimigos(luta, l)) {
        const d = Math.hypot(b.x - l.x, b.y - l.y);
        if (d < 70 && !ja.has(b)) { b.empX += ((l.x - b.x) / (d || 1)) * 900 * dt; b.empY += ((l.y - b.y) / (d || 1)) * 900 * dt; }
        if (ja.has(b) || d > RADIO * 2 + 10) continue;
        ja.add(b);
        if (b.est.congelado) { delete b.est.congelado; delete b.est.aturdido; atingir(l, b, pacote(h, extra, a, { dano: h.dano * (h.quebra ?? 3), empuje: 160, pesado: true })); b.texto('SHATTER!', '#e0f2fe'); luta.emit({ t: 'quebraGelo', x: b.x, y: b.y }); luta.hitstop(100); }
        else atingir(l, b, pacote(h, extra, a, { empuje: 60 }));
      }
    }, fin: () => { if (h.mega) luta.add({ tipo: 'chaoGelo', dueno: l, vivo: true, x: (x0 + p.x) / 2, y: (y0 + p.y) / 2, radio: 40, t: 0, dur: 3, prox: 0.5, update(dt) { this.t += dt; if (this.t >= this.prox) { this.prox += 0.5; for (const b of inimigos(luta, l)) if (dentro(b, this.x, this.y, this.radio)) b.ponerEstado('lento', 0.6, { f: Math.max(0.35, b.est.lento?.f ?? 0) }); } return this.t < this.dur; } }); } };
  },
  // Bola de Neve Gigante: rola com espinhos de gelo deixando camadas de neve (lentidão); ao pegar alguém explode e
  // congela. Mega: maior, cresce rolando, a explosão é maior, quebra armadura e deixa o chão congelado
  bolaNeve(l, h, extra) {
    const luta = this.luta, a = mirar(l, 260), vel = h.vel ?? 200, alc = h.alcance ?? 240, R0 = h.mega ? 24 : 18;
    l.animar('Shoot', 0.4); l.accion = { hasta: luta.t + 0.3, lento: 0.3, angulo: a };
    let rastro = 0;
    const explode = p => {
      const R = (h.radio ?? 50) * (h.mega ? 1 + p.t * 0.6 : 1);
      for (const b of inimigos(luta, l)) if (dentro(b, p.x, p.y, R)) { atingir(l, b, pacote(h, extra, a, { dirX: undefined, dirY: undefined, empuje: 60 })); congelar(luta, b, h.congela ?? 1); if (h.mega) b.ponerEstado('defBaja', 4, {}); }
      luta.emit({ t: 'explodeNeve', x: p.x, y: p.y, r: R }); luta.emit({ t: 'temblor', f: 0.01 });
      if (h.mega) luta.add({ tipo: 'chaoGelo', dueno: l, vivo: true, x: p.x, y: p.y, radio: R, t: 0, dur: 3, prox: 0.5, update(dt) { this.t += dt; if (this.t >= this.prox) { this.prox += 0.5; for (const b of inimigos(luta, l)) if (dentro(b, this.x, this.y, this.radio)) { b.recibir(l, { dano: 1.5, tipo: 'ICE', tick: true }); b.ponerEstado('lento', 0.6, { f: Math.max(0.4, b.est.lento?.f ?? 0) }); } } return this.t < this.dur; } });
    };
    const p = { tipo: 'bolaNeve', dueno: l, vivo: true, bloqueavel: false, x: l.x + Math.cos(a) * 14, y: l.y + Math.sin(a) * 9, ang: a, t: 0, r: R0, mega: !!h.mega, update: dt => {
      p.t += dt; p.x += Math.cos(a) * vel * dt; p.y += Math.sin(a) * vel * dt * 0.85; if (h.mega) p.r = Math.min(40, R0 + p.t * 12);
      rastro += vel * dt;
      if (rastro > 26) { rastro = 0; luta.add({ tipo: 'neveChao', dueno: l, vivo: true, x: p.x, y: p.y, radio: p.r + 6, t: 0, dur: 2.5, update(d) { this.t += d; for (const b of inimigos(luta, l)) if (dentro(b, this.x, this.y, this.radio)) b.ponerEstado('lento', 0.3, { f: Math.max(0.3, b.est.lento?.f ?? 0) }); return this.t < this.dur; } }); }
      if (inimigos(luta, l).some(b => Math.hypot(b.x - p.x, b.y - p.y) < RADIO + p.r)) { explode(p); return false; }
      if (p.t >= alc / vel) { explode(p); return false; }
      return true;
    } };
    luta.add(p);
  },
  // Escudo Glacial: casca de gelo que reduz o dano; quem acertar 3 vezes congela. Mega: reduz mais, 2 acertos
  // já congelam e, quando acaba, a casca explode em estalactites para todos os lados
  escudoGlacial(l, h, extra) {
    const luta = this.luta, dur = h.dur ?? 3;
    l.animar('Charge', 0.4);
    l.ponerEstado('blindaje', dur, { reduce: h.reduce ?? (h.mega ? 0.55 : 0.4) });
    const conta = new Map();
    l.ponerEstado('glacial', dur, { fn: fonte => { const k = (conta.get(fonte) ?? 0) + 1; conta.set(fonte, k); luta.emit({ t: 'trincaGelo', l, k }); if (k >= (h.mega ? 2 : 3)) { conta.set(fonte, 0); congelar(luta, fonte, h.congela ?? 1.2); } } });
    luta.emit({ t: 'escudoGelo', l });
    if (h.mega) luta.programar(dur, () => { if (!l.ko) this.formas.tempestadeGelo.call(this, l, { ...h, dano: h.danoEstalactite ?? 12 }, extra); });
  },
  // Blizzard: nevasca em volta que vai juntando gelo e explode no fim (muito dano e 70% de lentidão)
  blizzard(l, h, extra) {
    const luta = this.luta, R = h.radio ?? 110, dur = h.carga ?? 1.6;
    l.animar('Charge', 0.5); l.accion = { hasta: luta.t + 0.35, bloquea: true, lento: 0 };
    let t = 0, prox = 0.3;
    luta.add({ tipo: 'nevasca', dueno: l, vivo: true, x: l.x, y: l.y, radio: R, t: 0, dur, update(dt) {
      t += dt; this.t = t; this.x = l.x; this.y = l.y; if (l.ko) return false;
      // dentro da nevasca: dano aos poucos e cada vez mais lento
      if (t >= prox) { prox += 0.3; for (const b of inimigos(luta, l)) if (dentro(b, l.x, l.y, R)) { b.recibir(l, { dano: h.danoTick ?? 1.2, tipo: 'ICE', tick: true }); b.ponerEstado('lento', 0.5, { f: Math.min(0.6, Math.max(0.3, (b.est.lento?.f ?? 0) + 0.08)) }); } }
      if (t < dur) return true;
      // explode: congela todo mundo dentro e depois deixa 70% mais lento
      for (const b of inimigos(luta, l)) if (dentro(b, l.x, l.y, R)) { atingir(l, b, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, empuje: 0, ralentiza: { f: 0.7, dur: 2 + (h.congela ?? 1.4) }, pesado: true })); congelar(luta, b, h.congela ?? 1.4); }
      luta.emit({ t: 'explodeNevasca', x: l.x, y: l.y, r: R });
      luta.add({ tipo: 'chaoGelo', dueno: l, vivo: true, x: l.x, y: l.y, radio: R * 0.9, t: 0, dur: 2.5, prox: 0.5, update(dt) { this.t += dt; if (this.t >= this.prox) { this.prox += 0.5; for (const b of inimigos(luta, l)) if (dentro(b, this.x, this.y, this.radio)) b.ponerEstado('lento', 0.6, { f: Math.max(0.4, b.est.lento?.f ?? 0) }); } return this.t < this.dur; } }); luta.emit({ t: 'temblor', f: 0.016 }); luta.hitstop(100);
      return false;
    } });
  },
};
