// Gigalith (torres de cristal, empurrão, laser que descarrega as torres e ult que liga as torres) e Drampa
// (Hyper Voice segurando, Calm Mind e a nuvem negra da Mega).
import { RADIO } from '../config.js';
import { fijarCampo } from './fisica.js';
import { pacote, atingir } from './entidades.js';
import { formasKits8 } from './formasKits8.js';

const angApunte = l => Math.atan2(l.ay - l.y, l.ax - l.x);
const dAng = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const dentro = (b, x, y, r) => Math.hypot(b.x - x, (b.y - y) / 0.62) < r;
const inimigos = (luta, l) => luta.blancos(l).filter(b => !b.oculto && !b.est?.vuelo && !b.ko);
function maisPerto(luta, l, alc, de = l) { let m = null, dm = alc; for (const b of inimigos(luta, l)) { const d = Math.hypot(b.x - de.x, b.y - de.y); if (d < dm && !b.esClon) { dm = d; m = b; } } return m; }
function mirar(l, alc) { const r = l.rival, a = angApunte(l); if (!r || r.ko || r.oculto) return a; const ar = Math.atan2(r.y - l.y, r.x - l.x); return Math.hypot(r.x - l.x, r.y - l.y) < alc && Math.abs(dAng(ar, a)) < 0.8 ? ar : a; }
function jogarAlto(luta, b, dur = 0.8, alto = 46) { const x0 = b.x, y0 = b.y; let t = 0; luta.add({ tipo: 'lanzado', dueno: null, vivo: true, update: dt => { t += dt; if (b.ko) { b.salto = 0; return false; } b.x = x0; b.y = y0; b.salto = Math.round(Math.sin(Math.min(1, t / dur) * Math.PI) * alto); if (t < dur) return true; b.salto = 0; return false; } }); }
export const torresDe = (luta, l) => luta.entidades.filter(e => e.tipo === 'torreCristal' && e.dueno === l && e.vivo !== false);

export const formasKits10 = {
  // ================================================================ GIGALITH
  // Torre de Cristal: uma torre grande sai do chão na mira e fica até você pôr outra (no máximo 2: a terceira derruba
  // a mais velha). Segura tiros inimigos e ninguém passa por ela
  torresCristal(l, h, extra) {
    const luta = this.luta, a = mirar(l, 160), d = Math.min(h.alcance ?? 120, Math.hypot(l.ax - l.x, l.ay - l.y) || 120), p = fijarCampo(l.x + Math.cos(a) * d, l.y + Math.sin(a) * d), R = h.radio ?? 18;
    l.animar('Charge', 0.4); l.accion = { hasta: luta.t + 0.3, bloquea: true, lento: 0, angulo: a };
    const minhas = torresDe(luta, l);
    if (minhas.length >= (h.max ?? 2)) { const v = minhas[0]; v.vivo = false; luta.emit({ t: 'torreCai', x: v.x, y: v.y }); }
    // quem estava no lugar é jogado para longe
    for (const b of inimigos(luta, l)) if (dentro(b, p.x, p.y, R + 14)) { const dx = b.x - p.x, dy = b.y - p.y, dd = Math.hypot(dx, dy) || 1; atingir(l, b, pacote(h, extra, 0, { dirX: dx / dd, dirY: dy / dd, empuje: 200 })); }
    luta.emit({ t: 'torreSobe', x: p.x, y: p.y }); luta.emit({ t: 'temblor', f: 0.01 });
    const e = { tipo: 'torreCristal', dueno: l, vivo: true, x: p.x, y: p.y, r: R, t: 0, vx: 0, vy: 0, acerto: new Set(), ativa: 0, update: dt => {
      e.t += dt; if (l.ko) return false;
      // deslizando depois de empurrada: quem ela pega voa para o alto
      if (Math.hypot(e.vx, e.vy) > 20) {
        e.x += e.vx * dt; e.y += e.vy * dt; const k = Math.exp(-dt * 3.2); e.vx *= k; e.vy *= k;
        const q = fijarCampo(e.x, e.y); if (q.x !== e.x || q.y !== e.y) { e.x = q.x; e.y = q.y; e.vx = e.vy = 0; }
        for (const b of inimigos(luta, l)) if (!e.acerto.has(b) && Math.hypot(b.x - e.x, (b.y - e.y) / 0.62) < R + RADIO + 4) { e.acerto.add(b); atingir(l, b, { dano: h.danoEmpurra ?? 8, tipo: 'ROCK', slot: 'esp', dirX: e.vx / (Math.hypot(e.vx, e.vy) || 1), dirY: e.vy / (Math.hypot(e.vx, e.vy) || 1), empuje: 0, aturde: 0.8, pesado: true }); jogarAlto(luta, b, 0.8, 50); luta.emit({ t: 'torreBate', x: b.x, y: b.y }); }
      } else { e.vx = e.vy = 0; e.acerto.clear(); }
      // corpo da torre: ninguém atravessa
      for (const b of luta.luchadores) { if (b.ko || b.est?.vuelo) continue; const dx = b.x - e.x, dy = (b.y - e.y) / 0.62, dd = Math.hypot(dx, dy), rr = R + RADIO; if (dd < rr && dd > 0.01) { b.x = e.x + (dx / dd) * rr; b.y = e.y + (dy / dd) * rr * 0.62; } }
      // segura tiros inimigos
      for (const o of luta.entidades) if ((o.tipo === 'proj' || o.bloqueavel) && o.vivo !== false && o.dueno && o.dueno.equipo !== l.equipo && Math.hypot(o.x - e.x, (o.y - e.y) / 0.62) < R + 2) { o.vivo = false; luta.emit({ t: 'tiroBloqueado', x: o.x, y: o.y }); }
      // ligada pela ult: laser teleguiado contínuo em quem estiver perto
      if (e.ativa > luta.t && e.t >= (e.proxLaser ?? 0)) {
        e.proxLaser = e.t + 0.3; const b = maisPerto(luta, l, h.alcanceLaser ?? 230, e);
        if (b) { atingir(l, b, { dano: h.danoLaser ?? 2.6, tipo: 'FIRE', slot: 'e', dirX: 0, dirY: 0, empuje: 0, tick: true }); b.ponerEstado('defBaja', 1, {}); luta.emit({ t: 'laserTorre', x0: e.x, y0: e.y - 38, x1: b.x, y1: b.y - b.alto * 0.5 }); }
      }
      return true;
    } };
    luta.add(e);
  },
  // Empurrão (dash): não avança; empurra quem estiver na frente e as próprias torres, que saem deslizando
  empurrao(l, h, extra) {
    const luta = this.luta, mx = l.intento?.mx ?? 0, my = l.intento?.my ?? 0, a = Math.hypot(mx, my) > 0.2 ? Math.atan2(my, mx) : mirar(l, 120), R = h.alcance ?? 70, abre = 1.9;
    l.cortarAccion(); l.animar('Attack', 0.3); l.accion = { hasta: luta.t + 0.25, bloquea: true, lento: 0, angulo: a }; l.ponerEstado('blindaje', 0.3, { reduce: 0.4 });
    const naFrente = (x, y, r) => { const dx = x - l.x, dy = y - l.y, d = Math.hypot(dx, dy); return d < R + r && (d < 14 || Math.abs(dAng(Math.atan2(dy, dx), a)) < abre / 2); };
    for (const b of inimigos(luta, l)) if (naFrente(b.x, b.y, RADIO)) atingir(l, b, pacote(h, extra, a, { empuje: h.empuje ?? 260, pesado: true }));
    for (const t of torresDe(luta, l)) if (naFrente(t.x, t.y, t.r)) { const ta = Math.atan2(t.y - l.y, t.x - l.x), dir = Math.abs(dAng(ta, a)) < 1.2 ? a : ta; t.vx = Math.cos(dir) * (h.forcaTorre ?? 420); t.vy = Math.sin(dir) * (h.forcaTorre ?? 420) * 0.8; t.acerto.clear(); luta.emit({ t: 'torreEmpurrada', x: t.x, y: t.y }); }
    luta.emit({ t: 'empurrao', l, ang: a, R }); luta.emit({ t: 'temblor', f: 0.008 });
  },
  // Descarga Cristalina: o feixe de cristal, e cada torre solta uma descarga vermelha forte em volta
  raioCristal(l, h, extra) {
    formasKits8.raioCristal.call(this, l, h, extra);
    const luta = this.luta;
    for (const t of torresDe(luta, l)) {
      luta.emit({ t: 'cargaTorre', x: t.x, y: t.y, dur: h.carga ?? 0.35 });
      luta.programar(h.carga ?? 0.35, () => { if (l.ko || t.vivo === false) return; for (const b of inimigos(luta, l)) if (dentro(b, t.x, t.y, h.radioDescarga ?? 74)) { atingir(l, b, pacote(h, extra, 0, { dano: h.danoDescarga ?? 12, dirX: undefined, dirY: undefined, empuje: 120, aturde: 0.3 })); b.ponerEstado('defBaja', 3, {}); } luta.emit({ t: 'descargaTorre', x: t.x, y: t.y, r: h.radioDescarga ?? 74 }); luta.emit({ t: 'temblor', f: 0.01 }); });
    }
  },
  // Cataclismo de Geoda: o campo de geodo, e as torres dentro dele atiram lasers teleguiados até o campo acabar
  campoGeoda(l, h, extra) {
    formasKits8.campoGeoda.call(this, l, h, extra);
    const luta = this.luta, R = h.radio ?? 130;
    for (const t of torresDe(luta, l)) if (dentro(t, l.x, l.y, R + 10)) { t.ativa = luta.t + (h.dur ?? 4); luta.emit({ t: 'torreLiga', x: t.x, y: t.y }); }
  },

  // ================================================================ DRAMPA
  // Hyper Voice: segure para gritar sem parar (até acabar); dá para andar devagar enquanto grita.
  // Mega: alcance enorme, mais dano e silencia
  hyperVoice(l, h, extra) {
    const luta = this.luta, max = h.dur ?? (h.mega ? 3 : 2.2), R = h.alcance ?? (h.mega ? 190 : 130), abre = ((h.angulo ?? 70) * Math.PI) / 180;
    let t = 0, prox = 0, solto = false;
    l.animar('Charge', max);
    const e = { tipo: 'hyperVoice', dueno: l, vivo: true, x: l.x, y: l.y, ang: 0, R, abre, t: 0, mega: !!h.mega };
    luta.add(Object.assign(e, { update: () => e.vivo && !l.ko }));
    l.accion = { hasta: luta.t + max, lento: 0.5, interrompe: false, update: dt => {
      t += dt; e.t = t; e.x = l.x; e.y = l.y; const a = angApunte(l); e.ang = a; l.angulo = a;
      const pulsa = l.intento?.[extra.slot]; if (!pulsa && t > 0.25 && l.humano) solto = true;
      if (solto) { l.accion.hasta = luta.t; return; }
      if (t < prox) return; prox += 0.25;
      for (const b of inimigos(luta, l)) { const dx = b.x - l.x, dy = b.y - l.y; if (Math.hypot(dx, dy) < R + RADIO && Math.abs(dAng(Math.atan2(dy, dx), a)) < abre / 2) { atingir(l, b, pacote(h, extra, a, { dano: h.dano * 0.25 / max * 2.2, empuje: h.mega ? 90 : 50, tick: true })); if (h.mega) b.ponerEstado('silencio', 0.4, {}); } }
      luta.emit({ t: 'ondaVoz', x: l.x, y: l.y, ang: a, R, abre, mega: !!h.mega });
    }, fin: () => { e.vivo = false; } };
  },
  // Calm Mind (ult da forma normal): aumenta defesa, ataque especial e velocidade por um tempo
  calmaMente(l, h) {
    const luta = this.luta, dur = h.dur ?? 7;
    l.animar('Charge', 0.6); l.accion = { hasta: luta.t + 0.4, bloquea: true, lento: 0 };
    l.ponerEstado('potencia', dur, { n: 1, mult: h.ataque ?? 0.35, cadencia: 1.1, vel: 0, reduce: 0, color: '#a78bfa' });
    l.ponerEstado('blindaje', dur, { reduce: h.defesa ?? 0.3 });
    l.ponerEstado('rapido', dur, { vel: h.velocidade ?? 1.3 });
    l.texto('CALM MIND!', '#c4b5fd'); luta.emit({ t: 'calmaMente', l, dur });
  },
  // Nuvem Negra (ult da Mega): nuvem gigante que persegue os inimigos e solta raios neles
  nuvemNegra(l, h, extra) {
    const luta = this.luta, dur = h.dur ?? 6, R = h.radio ?? 90, p = fijarCampo(l.ax, l.ay);
    l.animar('Charge', 0.6); l.accion = { hasta: luta.t + 0.45, bloquea: true, lento: 0 };
    luta.emit({ t: 'temblor', f: 0.012 });
    const e = { tipo: 'nuvemNegra', dueno: l, vivo: true, x: p.x, y: p.y, radio: R, t: 0, dur, prox: 0.5, update: dt => {
      e.t += dt; if (l.ko) return false;
      const alvo = maisPerto(luta, l, 9999, e);
      if (alvo) { const dx = alvo.x - e.x, dy = alvo.y - e.y, d = Math.hypot(dx, dy) || 1, v = Math.min(d, (h.vel ?? 95) * dt); e.x += (dx / d) * v; e.y += (dy / d) * v; }
      if (e.t >= e.prox) {
        e.prox += h.cada ?? 0.55;
        const sob = inimigos(luta, l).filter(b => dentro(b, e.x, e.y, R));
        for (const b of sob.slice(0, 3)) { atingir(l, b, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, empuje: 20, aturde: 0.25 })); luta.emit({ t: 'raioNuvem', x: b.x, y: b.y }); }
        if (!sob.length) luta.emit({ t: 'raioNuvem', x: e.x + ((e.t * 37) % 1 - 0.5) * R, y: e.y + ((e.t * 53) % 1 - 0.5) * R * 0.5, vazio: true });
      }
      return e.t < dur;
    } };
    luta.add(e);
  },
};
