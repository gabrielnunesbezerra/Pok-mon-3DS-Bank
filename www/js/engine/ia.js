// CPU: anda até a distância boa do seu Pokémon, gira em volta, usa as skills quando fazem sentido
// e se esquiva de projéteis. Três níveis: easy, normal, hard.
import { RADIO, OVALO } from '../config.js';
import { aleatorio, entre, difAng, dist } from './util.js';
import { fueraCampo } from './fisica.js';

const NIVELES = {
  facil: { reaccion: 0.45, skills: 0.35, esquiva: 0.25, punteria: 0.85 },
  normal: { reaccion: 0.22, skills: 0.65, esquiva: 0.55, punteria: 0.95 },
  dificil: { reaccion: 0.1, skills: 0.95, esquiva: 0.9, punteria: 1 },
};

export function rangoDe(h) {
  switch (h.forma) {
    case 'proyectil': case 'cono': case 'viento': case 'bombaLodo': case 'burbujas': case 'lluvia': return h.alcance;
    case 'chorro': case 'helice': return h.largo;
    case 'tajo': case 'golpe': case 'rafaga': return h.alcance + (h.embestida ?? 0) * 0.5;
    case 'patada': return h.alcance;
    case 'pulso': return h.radio;
    case 'caparazon': return h.alcance;
    case 'meteoro': return 190;
    case 'vuelo': return 230;
    case 'erupcion': return h.golpes * h.paso * 0.6;
    case 'plantaFeroz': return Math.max(...h.ondas) + 20;
    case 'embestidas': return 150;
    case 'dash': return h.dano ? h.dist : 0;
    default: return 0;
  }
}

export class IA {
  constructor(luta, l, nivel = 'normal') {
    this.luta = luta; this.l = l; this.cfg = NIVELES[nivel] ?? NIVELES.normal;
    this.espera = 0; this.lado = aleatorio() < 0.5 ? 1 : -1; this.cambioLado = 0; this.retardo = {};
  }

  intento(dt) {
    const l = this.l, luta = this.luta, r = l.rival, t = luta.t, c = this.cfg;
    const it = { mx: 0, my: 0, ax: l.ax, ay: l.ay, lmb: false, rmb: false, esp: false, q: false, e: false, mega: false };
    if (!r || r.ko || luta.fase !== 'lucha') return it;
    this.espera -= dt;
    const dx = r.x - l.x, dy = r.y - l.y, d = Math.hypot(dx, dy) || 1;
    const rango = l.def.ia?.rango ?? 100;
    // mira com uma pequena antecipação
    it.ax = r.x + (r.vx ?? 0) * 0.12 * c.punteria;
    it.ay = r.y + (r.vy ?? 0) * 0.12 * c.punteria;
    // movimento: aproxima, afasta e gira em volta
    if (t > this.cambioLado) { this.lado = -this.lado; this.cambioLado = t + entre(1.2, 3); }
    let mx = 0, my = 0;
    const rLmb0 = rangoDe(l.kit.lmb);
    const alvoD = Math.max(24, Math.min(rango * 0.85, rLmb0 > 0 ? rLmb0 * 0.8 : rango));
    if (d > alvoD + 14) { mx = dx / d; my = dy / d; }
    else if (d < alvoD - 22 && alvoD > 80) { mx = -dx / d; my = -dy / d; }
    const girar = d < rango + 60 ? 0.55 : 0.15;
    mx += (-dy / d) * this.lado * girar; my += (dx / d) * this.lado * girar;
    // evita a borda
    if (fueraCampo(l.x + mx * 40, l.y + my * 40, -30)) { const cx = OVALO.cx - l.x, cy = OVALO.cy - l.y, cd = Math.hypot(cx, cy) || 1; mx += (cx / cd) * 1.2; my += (cy / cd) * 1.2; }
    const m = Math.hypot(mx, my) || 1;
    it.mx = mx / m; it.my = my / m;
    if (l.dash || l.accion?.bloquea) { it.mx = 0; it.my = 0; }

    // esquiva: projétil indo na direção ou rival atacando perto
    const perigo = luta.entidades.some(e => e.tipo === 'proj' && e.dueno !== l && Math.hypot(e.x - l.x, e.y - l.y) < 70 && Math.abs(difAng(e.ang, Math.atan2(l.y - e.y, l.x - e.x))) < 0.5)
      || (r.accion && d < 70 && r.accion.slot && r.accion.slot !== 'lmb');
    if (perigo && aleatorio() < c.esquiva * dt * 8 && l.cd.esp <= 0 && l.kit.esp) { it.esp = true; const a = Math.atan2(dy, dx) + (this.lado * Math.PI) / 2; it.mx = Math.cos(a); it.my = Math.sin(a); }

    if (t < (this.retraso ?? 0)) return it;
    // ataque básico
    const lmb = l.kit.lmb;
    const rLmb = rangoDe(lmb);
    if (d < rLmb + 6 && l.calor < 80 && (!lmb.coste)) it.lmb = true;
    // skills
    const quiere = this.espera <= 0 && aleatorio() < c.skills * dt * 5;
    if (quiere) {
      this.espera = c.reaccion;
      const orden = ['e', 'rmb', 'q'];
      for (const slot of orden) {
        const h = l.kit[slot];
        if (!h || l.cd[slot] > 0) continue;
        if (slot === 'e' && !l.ultiLista) continue;
        if ((h.coste ?? 0) > l.energia) continue;
        if (this.usable(h, d, l, r)) { it[slot] = true; break; }
      }
      const sp = l.kit.esp;
      if (sp && l.cd.esp <= 0 && sp.dano && d < sp.dist + 20 && d > 30 && aleatorio() < 0.4) it.esp = true;
    }
    if (l.puedeEvolucionar || l.puedeMega) it.mega = true;
    return it;
  }

  usable(h, d, l, r) {
    switch (h.forma) {
      case 'crecimiento': return !l.est.potencia || l.est.potencia.n < (h.max ?? 3);
      case 'arraigo': return l.hp < l.hpMax * 0.7 && d > 90;
      case 'descanso': return l.hp < l.hpMax * 0.55 && d > 140;
      case 'clones': return d < 220 && !l.clones;
      case 'humo': return d < 180;
      case 'caparazon': return d < h.alcance + 40;
      case 'vuelo': return d < 230 && d > 50;
      default: { const rango = rangoDe(h); return rango > 0 && d < rango; }
    }
  }
}

// Boneco de treino: não faz nada
export class Muneco { intento() { return { mx: 0, my: 0, ax: 0, ay: 0 }; } }
