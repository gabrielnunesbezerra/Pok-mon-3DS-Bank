// HUD do combate: painéis de vida/energia/ultimate/evolução em cima, relógio e rounds no centro,
// barra de skills embaixo para quem joga.
import { ANCHO, ALTO, HUD_ALTO, UI, FUENTE, hex } from '../config.js';
import { REGLAS, TIPOS } from '../data/regras.js';
import { marco, rect, texto } from './pixel.js';

const COLOR_EQUIPO = ['#4a9fff', '#ff5a5a'];
const NOMBRES_SLOT = { lmb: 'LMB', rmb: 'RMB', esp: 'SPC', q: 'Q', e: 'E' };
const NOMBRE_CORTO = s => s.length > 11 ? s.slice(0, 10) + '.' : s;

function barra(g, x, y, w, h, frac, color, fondo = '#10162c') {
  rect(g, x - 1, y - 1, w + 2, h + 2, '#04102c');
  rect(g, x, y, w, h, fondo);
  rect(g, x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h, color);
  rect(g, x, y, Math.round(w * Math.max(0, Math.min(1, frac))), 1, 'rgba(255,255,255,0.35)');
}

export class Hud {
  constructor(bank) { this.bank = bank; this.hpMostrado = [1, 1]; }

  dibujar(g, luta, t, opts) {
    const [a, b] = luta.luchadores;
    // fundo
    rect(g, 0, 0, ANCHO, HUD_ALTO, 'rgba(4,16,44,0.82)');
    rect(g, 0, HUD_ALTO - 1, ANCHO, 1, UI.panelBorde);
    this.panel(g, a, 0, t, luta);
    this.panel(g, b, 1, t, luta);
    // relógio e rounds
    const tiempo = Math.max(0, Math.ceil(luta.reloj));
    marco(g, ANCHO / 2 - 22, 4, 44, 26, 'panel');
    texto(g, luta.entreno ? '∞' : String(tiempo).padStart(2, '0'), ANCHO / 2, 17, { tam: 14, align: 'center', base: 'middle', color: tiempo <= 10 && !luta.entreno ? '#ff6a6a' : '#ffffff', borde: 3 });
    for (let i = 0; i < 2; i++) {
      for (let k = 0; k < REGLAS.rondasParaGanar; k++) {
        const x = ANCHO / 2 + (i ? 12 + k * 10 : -12 - k * 10 - 6), lleno = k < luta.victorias[i];
        rect(g, x - 1, 33, 8, 8, '#04102c');
        rect(g, x, 34, 6, 6, lleno ? COLOR_EQUIPO[i] : '#26334f');
        if (lleno) rect(g, x, 34, 6, 1, 'rgba(255,255,255,0.5)');
      }
    }
    if (!luta.entreno) texto(g, `ROUND ${luta.numRonda}`, ANCHO / 2, 44, { tam: 6, align: 'center', color: UI.suave, base: 'bottom' });
  }

  panel(g, l, i, t, luta) {
    const x0 = i === 0 ? 4 : ANCHO - 4 - 250, w = 250;
    const dir = i === 0 ? 1 : -1;
    marco(g, x0, 3, w, HUD_ALTO - 8, 'panel');
    // retrato
    const rx = i === 0 ? x0 + 4 : x0 + w - 4 - 38;
    rect(g, rx - 1, 5, 40, 40, '#04102c');
    rect(g, rx, 6, 38, 38, COLOR_EQUIPO[i]);
    rect(g, rx + 1, 7, 36, 36, '#0e1a36');
    const img = this.bank.retrato(l.dex);
    if (img) {
      g.save(); if (i === 1) { g.translate(rx + 37, 0); g.scale(-1, 1); g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 7, 36, 36); } else g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, rx + 1, 7, 36, 36);
      g.restore();
    }
    const bx = i === 0 ? rx + 44 : x0 + 6, bw = w - 56;
    texto(g, l.nombre, i === 0 ? bx : bx + bw, 6, { tam: 8, align: i === 0 ? 'left' : 'right', color: '#ffffff', borde: 3, max: bw - 40 });
    // tipos
    l.tipos.forEach((tp, k) => {
      const cx = i === 0 ? bx + bw - 28 + k * 14 : bx + 2 + k * 14;
      rect(g, cx - 1, 6, 12, 8, '#04102c'); rect(g, cx, 7, 10, 6, hex(TIPOS[tp] ?? 0xffffff));
    });
    // vida
    const frac = l.hp / l.hpMax;
    const mostrado = this.hpMostrado[i] = this.hpMostrado[i] > frac ? Math.max(frac, this.hpMostrado[i] - 0.5 / 60) : frac;
    const cor = frac > 0.5 ? '#3cd34e' : frac > 0.25 ? '#f2c230' : '#e8463a';
    rect(g, bx - 1, 17, bw + 2, 10, '#04102c');
    rect(g, bx, 18, bw, 8, '#10162c');
    const ancho = (f) => (i === 0 ? { x: bx, w: Math.round(bw * f) } : { x: bx + bw - Math.round(bw * f), w: Math.round(bw * f) });
    let r = ancho(mostrado); rect(g, r.x, 18, r.w, 8, '#ff5a4a');
    r = ancho(frac); rect(g, r.x, 18, r.w, 8, cor); rect(g, r.x, 18, r.w, 2, 'rgba(255,255,255,0.35)');
    texto(g, `${Math.ceil(l.hp)}/${l.hpMax}`, bx + bw / 2, 22, { tam: 6, align: 'center', base: 'middle', borde: 2 });
    // energia (laranja), ultimate (dourado), exp (azul)
    const mini = (y, f, color, label, listo) => {
      const r2 = ancho(f);
      rect(g, bx - 1, y - 1, bw + 2, 6, '#04102c'); rect(g, bx, y, bw, 4, '#10162c');
      rect(g, r2.x, y, r2.w, 4, listo && Math.floor(t * 6) % 2 ? '#ffffff' : color);
      texto(g, label, i === 0 ? bx + bw + 3 : bx - 3, y - 2, { tam: 6, color: UI.suave, align: i === 0 ? 'left' : 'right' });
    };
    mini(30, l.energia / REGLAS.energiaMax, '#f8a03f', 'EN', false);
    mini(37, l.ulti / REGLAS.ultiMax, '#ffd166', l.puedeMega ? 'MEGA' : 'ULT', l.ultiLista);
    if (l.etapa < l.etapasTotales - 1) {
      rect(g, i === 0 ? bx + bw - 2 : bx, 30, 2, 2, 'rgba(0,0,0,0)');
      const f = Math.min(1, l.exp / l.expNecesaria);
      const r3 = ancho(f);
      rect(g, bx - 1, 44, bw + 2, 3, '#04102c'); rect(g, bx, 45, bw, 1, '#10162c'); rect(g, r3.x, 45, r3.w, 1, f >= 1 && Math.floor(t * 8) % 2 ? '#ffffff' : '#7dd3fc');
    }
    // estados
    const icos = [];
    for (const [k, c] of [['quema', '#ff7a1f'], ['veneno', '#c27ae0'], ['quemado', '#ff9a5a'], ['empapado', '#6fb0ff'], ['enredado', '#4caf38'], ['paralizado', '#ffd84a'], ['confuso', '#ff9de2'], ['lento', '#9fb8dd'], ['drenaje', '#86efac'], ['debil', '#f9a8d4'], ['potencia', '#86efac']]) if (l.est[k]) icos.push(c);
    icos.forEach((c, k) => { const ex = i === 0 ? bx + k * 7 : bx + bw - 6 - k * 7; rect(g, ex - 1, 48, 6, 6, '#04102c'); rect(g, ex, 49, 4, 4, c); });
  }

  // barra de skills de quem joga (lado esquerdo = P1, direito = P2)
  barraSkills(g, l, i, t, controles) {
    const slots = ['lmb', 'rmb', 'esp', 'q', 'e'];
    const w = 34, h = 26, sep = 3, total = slots.length * w + (slots.length - 1) * sep;
    const x0 = i === 0 ? 8 : ANCHO - 8 - total, y = ALTO - h - 3;
    slots.forEach((s, k) => {
      const hh = l.kit[s];
      const x = x0 + k * (w + sep);
      const lista = !l.cd[s] && (s !== 'e' || l.ultiLista) && l.energia >= (s === 'e' ? 0 : hh?.coste ?? 0) && !(s === 'lmb' && t < l.sobrecargaHasta);
      marco(g, x, y, w, h, lista ? 'azul' : 'apagado');
      if (!hh) return;
      rect(g, x + 2, y + 2, w - 4, 3, hex(TIPOS[hh.tipo] ?? 0xffffff));
      texto(g, NOMBRE_CORTO(hh.nombre), x + w / 2, y + 12, { tam: 5.5, align: 'center', base: 'middle', color: lista ? '#ffffff' : UI.apagado, max: w - 4 });
      const cdMax = hh.cd || 1;
      if (l.cd[s] > 0 && cdMax > 1.2) { rect(g, x + 2, y + 6, w - 4, Math.round((h - 8) * Math.min(1, l.cd[s] / cdMax)), 'rgba(0,0,0,0.55)'); texto(g, l.cd[s].toFixed(1), x + w / 2, y + 14, { tam: 7, align: 'center', base: 'middle', color: '#ffe58a', borde: 2 }); }
      else if (s === 'e' && !l.ultiLista) texto(g, `${Math.floor(l.ulti)}%`, x + w / 2, y + 17, { tam: 6, align: 'center', base: 'middle', color: UI.suave });
      else if (hh.coste) texto(g, `${hh.coste}`, x + w / 2, y + 19, { tam: 6, align: 'center', base: 'middle', color: l.energia >= hh.coste ? '#f8a03f' : '#7a5a3a' });
      const key = controles?.[s] ?? NOMBRES_SLOT[s];
      texto(g, key, x + 3, y + h - 8, { tam: 5, color: UI.suave });
    });
    if (l.puedeEvolucionar || l.puedeMega) {
      const txt = l.puedeEvolucionar ? 'EVOLVE!' : 'MEGA!';
      if (Math.floor(t * 4) % 2) texto(g, `${controles?.mega ?? 'R'}: ${txt}`, x0 + total / 2, y - 6, { tam: 8, align: 'center', color: '#7dd3fc', borde: 3 });
    }
  }
}
