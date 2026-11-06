// Dedenne (carga parabólica, campo elétrico e tempestade de antenas) e Morpeko (Aura Wheel com a troca de forma
// Barriga Cheia / Faminto, lanche e a ult de roda frenética).
import { RADIO } from '../config.js';
import { fijarCampo } from './fisica.js';
import { pacote, atingir } from './entidades.js';

const angApunte = l => Math.atan2(l.ay - l.y, l.ax - l.x);
const dAng = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const dentro = (b, x, y, r) => Math.hypot(b.x - x, (b.y - y) / 0.62) < r;
const inimigos = (luta, l) => luta.blancos(l).filter(b => !b.oculto && !b.est?.vuelo && !b.ko);
const aliados = (luta, l) => [l, ...luta.aliados(l)];
function maisPerto(luta, l, alc, de = l, fora = null) { let m = null, dm = alc; for (const b of inimigos(luta, l)) { if (fora?.has(b)) continue; const d = Math.hypot(b.x - de.x, b.y - de.y); if (d < dm && !b.esClon) { dm = d; m = b; } } return m; }
function mirar(l, alc) { const r = l.rival, a = angApunte(l); if (!r || r.ko || r.oculto) return a; const ar = Math.atan2(r.y - l.y, r.x - l.x); return Math.hypot(r.x - l.x, r.y - l.y) < alc && Math.abs(dAng(ar, a)) < 0.8 ? ar : a; }
// Morpeko: troca Barriga Cheia <-> Faminto
export function trocaFome(luta, l, para) { l.fome = para ?? !l.fome; l.texto(l.fome ? 'HANGRY MODE!' : 'FULL BELLY', l.fome ? '#c084fc' : '#fde047'); luta.emit({ t: 'trocaFome', l, fome: l.fome }); }

export const formasKits11 = {
  // ================================================================ DEDENNE
  // Carga Parabólica: descarga em volta que machuca e devolve metade do dano em vida
  cargaParabolica(l, h, extra) {
    const luta = this.luta, R = h.radio ?? 75;
    l.animar('Charge', 0.35); l.accion = { hasta: luta.t + 0.3, bloquea: true, lento: 0 };
    luta.programar(0.15, () => {
      if (l.ko) return; let soma = 0;
      for (const b of inimigos(luta, l)) if (dentro(b, l.x, l.y, R)) { const hp0 = b.hp; atingir(l, b, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, empuje: 60 })); soma += Math.max(0, hp0 - b.hp); luta.emit({ t: 'raioDedenne', x0: l.x, y0: l.y - 10, x1: b.x, y1: b.y - b.alto * 0.5 }); }
      if (soma > 0) l.cura(soma * (h.drena ?? 0.5));
      luta.emit({ t: 'cargaParabolica', x: l.x, y: l.y, r: R });
    });
  },
  // Campo Elétrico: por 4s, aliados dentro ficam mais rápidos e inimigos levam choques que às vezes paralisam
  campoEletrico(l, h) {
    const luta = this.luta, R = h.radio ?? 85, dur = h.dur ?? 4, x = l.x, y = l.y;
    l.animar('Charge', 0.4); l.accion = { hasta: luta.t + 0.25, bloquea: true, lento: 0 };
    let n = 0;
    const e = { tipo: 'campoEletrico', dueno: l, vivo: true, x, y, radio: R, t: 0, dur, prox: 0.4, update: dt => {
      e.t += dt;
      for (const a of aliados(luta, l)) if (dentro(a, x, y, R)) a.ponerEstado('rapido', 0.3, { vel: h.vel ?? 1.25 });
      if (e.t >= e.prox) { e.prox += 0.6; n++; for (const b of inimigos(luta, l)) if (dentro(b, x, y, R)) { b.recibir(l, { dano: h.danoTick ?? 2, tipo: 'ELECTRIC', tick: true }); if (n % 3 === 0) { b.ponerEstado('paralizado', 0.5, {}); b.texto('PARALYZED!', '#fde047'); } luta.emit({ t: 'raioDedenne', x0: x, y0: y - 6, x1: b.x, y1: b.y - b.alto * 0.5, fino: true }); } }
      return e.t < dur && !l.ko;
    } };
    luta.add(e);
  },
  // Tempestade de Antenas (ult): por 2,2s solta raios em cadeia: do Dedenne para o inimigo mais perto e pulando para
  // mais até 3 outros
  tempestadeAntenas(l, h, extra) {
    const luta = this.luta, dur = h.dur ?? 2.2;
    l.cortarAccion(); l.animar('Charge', dur); l.ponerEstado('blindaje', dur, { reduce: 0.3 });
    l.accion = { hasta: luta.t + dur, lento: 0.4 };
    let t = 0, prox = 0.1;
    luta.add({ tipo: 'antenas', dueno: l, vivo: true, t: 0, dur, update(dt) {
      t += dt; this.t = t; if (l.ko) return false;
      if (t >= prox) {
        prox += h.cada ?? 0.28;
        let de = { x: l.x, y: l.y - l.alto * 0.7 }; const ja = new Set();
        for (let i = 0; i < (h.saltos ?? 4); i++) {
          const b = maisPerto(luta, l, i === 0 ? (h.alcance ?? 210) : (h.pulo ?? 130), de, ja); if (!b) break;
          ja.add(b); atingir(l, b, pacote(h, extra, 0, { dano: h.dano * (i === 0 ? 0.12 : 0.09), dirX: undefined, dirY: undefined, empuje: 20, tick: true }));
          if (i === 0 && Math.floor(t / 0.28) % 3 === 0) b.ponerEstado('paralizado', 0.3, {});
          luta.emit({ t: 'raioDedenne', x0: de.x, y0: de.y, x1: b.x, y1: b.y - b.alto * 0.5 });
          de = { x: b.x, y: b.y - b.alto * 0.5 };
        }
      }
      return t < dur;
    } });
  },

  // ================================================================ MORPEKO
  // Aura Wheel: rola numa roda de aura acertando quem pegar e fica mais rápido. Barriga Cheia = elétrico, pode
  // paralisar; Faminto = sombrio, bate mais e quebra armadura. Depois troca de forma
  auraWheel(l, h, extra) {
    const luta = this.luta, mx = l.intento?.mx ?? 0, my = l.intento?.my ?? 0, a = Math.hypot(mx, my) > 0.2 ? Math.atan2(my, mx) : mirar(l, 200);
    const dist = h.dist ?? 160, dur = h.dur ?? 0.36, x0 = l.x, y0 = l.y, p = fijarCampo(l.x + Math.cos(a) * dist, l.y + Math.sin(a) * dist), fome = !!l.fome, ja = new Set();
    l.cortarAccion(); l.ponerEstado('invul', dur * 0.7); l.ponerEstado('girando', dur); l.animar('Rotate', dur);
    luta.emit({ t: 'auraWheel', l, dur, fome });
    let t = 0;
    l.accion = { hasta: luta.t + dur, bloquea: true, lento: 0, angulo: a, update: dt => {
      t += dt; const k = Math.min(1, t / dur); l.x = x0 + (p.x - x0) * k; l.y = y0 + (p.y - y0) * k;
      for (const b of inimigos(luta, l)) {
        if (ja.has(b) || Math.hypot(b.x - l.x, b.y - l.y) > RADIO * 2 + 12) continue; ja.add(b);
        atingir(l, b, pacote({ ...h, tipo: fome ? 'DARK' : 'ELECTRIC' }, extra, a, { dano: h.dano * (fome ? 1.4 : 1), empuje: 120, pesado: fome }));
        if (fome) b.ponerEstado('defBaja', 3, {}); else { b.ponerEstado('paralizado', 0.4, {}); }
        luta.emit({ t: 'acertoRoda', x: b.x, y: b.y - b.alto * 0.5, fome });
      }
    }, fin: () => { if (l.ko) return; l.ponerEstado('rapido', 2, { vel: h.acelera ?? 1.3 }); trocaFome(luta, l); } };
  },
  // Lanche: come uma semente, recupera vida e energia e troca de forma na hora
  lanche(l, h) {
    const luta = this.luta;
    l.animar('Double', 0.5); l.accion = { hasta: luta.t + 0.35, bloquea: true, lento: 0 };
    l.cura(l.hpMax * (h.cura ?? 0.12)); l.energia = Math.min(100, l.energia + (h.energia ?? 20)); l.ponerEstado('rapido', 1.5, { vel: 1.2 });
    luta.emit({ t: 'lanche', l }); trocaFome(luta, l);
  },
  // Roda Frenética (ult): vira uma roda de aura gigante por 3s, atropelando todo mundo e trocando de forma sem parar
  rodaFrenesi(l, h) {
    const luta = this.luta, dur = h.dur ?? 3;
    l.cortarAccion(); l.ponerEstado('blindaje', dur, { reduce: 0.4 }); l.ponerEstado('imuneCC', dur, {});
    l.ponerEstado('rodando', dur, { vel: h.vel ?? 1.9, dano: h.dano ?? 8, empuje: 150, golpes: new Map(), tipo: 'ELECTRIC', slot: 'e', desde: luta.t });
    luta.emit({ t: 'rodaFrenesi', l, dur });
    let t = 0, prox = 0.5;
    luta.add({ tipo: 'rodaMorpeko', dueno: l, vivo: true, t: 0, dur, update(dt) {
      t += dt; this.t = t; if (l.ko) return false;
      if (t >= prox) { prox += 0.5; l.fome = !l.fome; luta.emit({ t: 'trocaFome', l, fome: l.fome }); if (l.est.rodando) { l.est.rodando.tipo = l.fome ? 'DARK' : 'ELECTRIC'; l.est.rodando.golpes.clear(); } }
      return t < dur && !!l.est.rodando;
    } });
  },
};
