// HUD do combate: painel de cada lutador no alto (retrato, nome, tipos, vida, evolução, energia, ultimate e estados),
// relógio e rounds no centro, e a faixa de skills embaixo com recarga, custo e nome de cada espaço.
import { ANCHO, ALTO, HUD_ALTO, BARRA_Y, FUENTE, hex } from '../config.js';
import { REGLAS, TIPOS, ESTADOS_TIPO } from '../data/regras.js';
import { rect, texto, medir } from './pixel.js';

const COLOR_EQUIPO = ['#4a9fff', '#ff5a5a', '#4ade80'];
const ANCHO_VIDA = 176;
const RANURAS = ['lmb', 'rmb', 'esp', 'q', 'e'];
const caso = s => s.charAt(0) + s.slice(1).toLowerCase();

export class Hud {
  constructor(bank) { this.bank = bank; this.estela = [1, 1]; }

  // arena com 3 lutadores: três colunas compactas e o relógio pendurado no meio
  dibujar3(g, luta, t) {
    const parpadeo = Math.floor(t * 4) % 2 === 0, w = ANCHO / 3;
    rect(g, 0, 0, ANCHO, HUD_ALTO, '#0a1a38');
    rect(g, 0, 0, ANCHO, 12, '#17122a');
    rect(g, 0, HUD_ALTO - 2, ANCHO, 1, '#d6a63a');
    rect(g, 0, HUD_ALTO - 1, ANCHO, 1, '#8a6a1c');
    luta.luchadores.forEach((l, i) => {
      const x0 = Math.round(i * w), cEq = COLOR_EQUIPO[i], muerto = l.ko;
      if (i) rect(g, x0, 2, 1, HUD_ALTO - 6, 'rgba(255,255,255,0.12)');
      g.globalAlpha = muerto ? 0.4 : 1;
      rect(g, x0 + 3, 4, 34, 34, cEq); rect(g, x0 + 4, 5, 32, 32, '#0e1a36');
      const img = this.bank.retrato(l.dex);
      if (img) g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, x0 + 4, 5, 32, 32);
      texto(g, l.nombre, x0 + 42, 3, { tam: 7, color: l.mega ? '#ffe14d' : '#ffffff', sombra: true, max: w - 70 });
      let cx = x0 + 42 + Math.min(w - 70, medir(g, l.nombre, 7)) + 4;
      for (const tp of l.tipos) { rect(g, cx, 4, 9, 6, '#000'); rect(g, cx + 1, 5, 7, 4, hex(TIPOS[tp] ?? 0xffffff)); cx += 11; }
      const f = Math.max(0, l.hp / l.hpMax), bw = w - 48, bx = x0 + 42, by = 15;
      this.estela[i] = this.estela[i] > f ? Math.max(f, this.estela[i] - 0.5 / 60) : f;
      rect(g, bx - 1, by - 1, bw + 2, 9, '#000'); rect(g, bx, by, bw, 7, '#2a1d2a');
      rect(g, bx, by, Math.round(bw * this.estela[i]), 7, 'rgba(255,255,255,0.85)');
      rect(g, bx, by, Math.round(bw * f), 7, f > 0.5 ? '#3ccf4e' : f > 0.2 ? '#f2c230' : '#e8463a');
      rect(g, bx, by, Math.round(bw * f), 2, 'rgba(255,255,255,0.35)');
      texto(g, muerto ? 'K.O.' : `${Math.ceil(l.hp)}/${l.hpMax}`, bx + bw / 2, by - 1, { tam: 6, align: 'center', sombra: true });
      const ew = Math.round(bw * 0.5);
      rect(g, bx - 1, 25, ew + 2, 5, '#000'); rect(g, bx, 26, ew, 3, '#2a1d16');
      rect(g, bx, 26, Math.round(ew * l.energia / REGLAS.energiaMax), 3, l.energia >= REGLAS.surgeUmbral ? '#ffd166' : '#f8a03f');
      rect(g, bx + ew + 3, 25, bw - ew - 3 + 2, 5, '#000'); rect(g, bx + ew + 4, 26, bw - ew - 3, 3, '#1d1a30');
      rect(g, bx + ew + 4, 26, Math.round((bw - ew - 3) * l.ulti / REGLAS.ultiMax), 3, l.ultiLista ? (parpadeo ? '#ffe9a8' : '#ffd166') : '#a855f7');
      if (l.etapasTotales > 1) { const k = l.etapa >= l.etapasTotales - 1 ? 1 : Math.min(1, l.exp / l.expNecesaria); rect(g, bx - 1, 32, bw + 2, 3, '#000'); rect(g, bx, 33, Math.round(bw * k), 1, l.puedeEvolucionar ? (parpadeo ? '#fff' : '#7dd3fc') : '#38bdf8'); }
      const est = [];
      if (l.mega) est.push('MEGA');
      else if (l.puedeEvolucionar && l.humano && parpadeo) est.push(this.teclaDe(l, 'mega') === 'EVO' ? 'EVO!' : 'F:EVO');
      else if (l.puedeMega && l.humano && parpadeo) est.push(this.teclaDe(l, 'mega') === 'EVO' ? 'MEGA!' : 'F:MEGA');
      if (l.ultiLista && !l.puedeMega) est.push('ULT!');
      if (l.energia >= REGLAS.surgeUmbral) est.push('SURGE');
      for (const et of Object.values(ESTADOS_TIPO)) if (l.est[et.est] && et.hud) est.push(et.hud);
      if (l.est.quema) est.push('BRN'); if (l.est.veneno) est.push('PSN'); if (l.est.aturdido) est.push('STUN'); if (l.est.drenaje) est.push('SEED');
      texto(g, est.join(' '), x0 + 3, 38, { tam: 6, color: '#c8c8d0', sombra: true, max: w - 8 });
      for (let k = 0; k < REGLAS.rondasParaGanar; k++) { rect(g, x0 + w - 12 - k * 8, 4, 6, 6, '#d6a63a'); rect(g, x0 + w - 11 - k * 8, 5, 4, 4, k < luta.victorias[i] ? '#d6a63a' : '#2a2a40'); }
      g.globalAlpha = 1;
    });
    // relógio pendurado embaixo do HUD
    const tiempo = Math.max(0, Math.ceil(luta.reloj));
    rect(g, ANCHO / 2 - 30, HUD_ALTO - 1, 60, 14, '#0a1a38'); rect(g, ANCHO / 2 - 30, HUD_ALTO + 12, 60, 1, '#8a6a1c');
    texto(g, `R${luta.numRonda} · ${String(tiempo).padStart(2, '0')}`, ANCHO / 2, HUD_ALTO + 1, { tam: 8, align: 'center', color: tiempo <= 10 ? '#ff6a6a' : '#ffffff', sombra: true });
  }

  dibujar(g, luta, t) {
    if (luta.luchadores.length === 3) return this.dibujar3(g, luta, t);
    const parpadeo = Math.floor(t * 4) % 2 === 0;
    // faixa de cima
    rect(g, 0, 0, ANCHO, HUD_ALTO, '#0a1a38');
    rect(g, 0, 0, ANCHO, 16, '#17122a');
    rect(g, 0, HUD_ALTO - 2, ANCHO, 1, '#d6a63a');
    rect(g, 0, HUD_ALTO - 1, ANCHO, 1, '#8a6a1c');
    luta.luchadores.forEach((l, i) => this.panel(g, l, i, t, luta, parpadeo));
    // relógio e rounds
    const tiempo = Math.max(0, Math.ceil(luta.reloj));
    texto(g, luta.entreno ? '--' : String(tiempo).padStart(2, '0'), ANCHO / 2, 5, { tam: 13, align: 'center', color: tiempo <= 10 && !luta.entreno ? '#ff6a6a' : '#ffffff', borde: 3, peso: 700 });
    texto(g, luta.entreno ? 'Training' : `Round ${luta.numRonda}`, ANCHO / 2, 28, { tam: 8, align: 'center', color: '#d6a63a', borde: 2 });
    for (let i = 0; i < 2; i++) {
      for (let k = 0; k < REGLAS.rondasParaGanar; k++) {
        if (luta.entreno) break;
        const x = ANCHO / 2 + (i ? 1 : -1) * (30 + k * 10);
        rect(g, x - 4, 11, 8, 8, '#d6a63a');
        rect(g, x - 3, 12, 6, 6, k < luta.victorias[i] ? '#d6a63a' : '#2a2a40');
      }
    }
  }

  capsula(g, x, y, tipo, derecha) {
    const nombre = caso(tipo), w = Math.ceil(medir(g, nombre, 8)) + 6, x0 = derecha ? x - w : x;
    rect(g, x0 - 1, y, w + 2, 10, '#000'); rect(g, x0, y - 1, w, 12, '#000');
    rect(g, x0, y, w, 10, hex(TIPOS[tipo] ?? 0xffffff));
    rect(g, x0 + 1, y + 1, w - 2, 1, 'rgba(255,255,255,0.3)');
    texto(g, nombre, x0 + 3, y, { tam: 8, color: '#ffffff', sombra: true });
    return w;
  }

  panel(g, l, i, t, luta, parpadeo) {
    const der = i === 1, nx = der ? ANCHO - 50 : 50, px = der ? ANCHO - 44 : 4;
    // retrato com moldura da cor do time
    rect(g, px - 1, 3, 42, 42, '#000'); 
    const cEq = COLOR_EQUIPO[i];
    rect(g, px - 1, 3, 42, 1, cEq); rect(g, px - 1, 44, 42, 1, cEq); rect(g, px - 1, 3, 1, 42, cEq); rect(g, px + 40, 3, 1, 42, cEq);
    rect(g, px, 4, 40, 40, '#0e1a36');
    const img = this.bank.retrato(l.dex);
    if (img) {
      g.save();
      if (der) { g.translate(px + 40, 0); g.scale(-1, 1); g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 4, 40, 40); }
      else g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, px, 4, 40, 40);
      g.restore();
    }
    // nome e tipos
    texto(g, l.nombre, nx, 5, { tam: 8, align: der ? 'right' : 'left', color: l.mega ? '#ffe14d' : '#ffffff', sombra: true });
    let cx = der ? nx - medir(g, l.nombre, 8) - 6 : nx + medir(g, l.nombre, 8) + 6;
    for (const tp of l.tipos) { const w = this.capsula(g, cx, 4, tp, der); cx += der ? -(w + 4) : w + 4; }
    // vida (com rastro branco que desce devagar)
    const f = Math.max(0, l.hp / l.hpMax);
    this.estela[i] = this.estela[i] > f ? Math.max(f, this.estela[i] - 0.5 / 60) : f;
    const bx = der ? nx - ANCHO_VIDA : nx, by = 28;
    rect(g, bx - 1, by - 1, ANCHO_VIDA + 2, 9, '#000');
    rect(g, bx, by, ANCHO_VIDA, 7, '#2a1d2a');
    const we = Math.round(ANCHO_VIDA * this.estela[i]), wv = Math.round(ANCHO_VIDA * f);
    rect(g, der ? bx + ANCHO_VIDA - we : bx, by, we, 7, 'rgba(255,255,255,0.85)');
    const col = f > 0.5 ? '#3ccf4e' : f > 0.2 ? '#f2c230' : '#e8463a';
    rect(g, der ? bx + ANCHO_VIDA - wv : bx, by, wv, 7, col);
    rect(g, der ? bx + ANCHO_VIDA - wv : bx, by, wv, 2, 'rgba(255,255,255,0.35)');
    for (let k = 1; k < 10; k++) rect(g, bx + Math.round((ANCHO_VIDA * k) / 10), by + 4, 1, 3, 'rgba(0,0,0,0.25)');
    texto(g, `${Math.ceil(l.hp)}/${l.hpMax}`, der ? nx - ANCHO_VIDA : nx + ANCHO_VIDA, 17, { tam: 8, align: der ? 'left' : 'right', sombra: true });
    // experiência de evolução e os pontinhos das etapas
    const etapas = l.etapasTotales;
    if (etapas > 1) {
      const xw = 64, xx = der ? nx - xw : nx, xy = 20;
      const final = l.etapa >= etapas - 1, k = final ? 1 : Math.min(1, l.exp / l.expNecesaria);
      rect(g, xx - 1, xy - 1, xw + 2, 5, '#000');
      rect(g, xx, xy, xw, 3, '#101a3a');
      rect(g, der ? xx + xw - Math.round(xw * k) : xx, xy, Math.round(xw * k), 3, final ? '#4b6e63' : l.puedeEvolucionar ? (parpadeo ? '#ffffff' : '#7dd3fc') : '#38bdf8');
      for (let s = 0; s < etapas; s++) {
        const sx = der ? xx - 6 - s * 5 : xx + xw + 3 + s * 5;
        rect(g, sx - 1, xy - 1, 5, 5, '#000'); rect(g, sx, xy, 3, 3, s <= l.etapa ? '#7dd3fc' : '#1d2a3a');
      }
    }
    // energia (marca do SURGE em 80%) e ultimate
    const ew = 84, ex = der ? nx - ew : nx, ey = 37;
    rect(g, ex - 1, ey - 1, ew + 2, 10, '#000');
    rect(g, ex, ey, ew, 4, '#2a1d16');
    const surge = l.energia >= REGLAS.surgeUmbral, wen = Math.round((ew * l.energia) / REGLAS.energiaMax);
    rect(g, der ? ex + ew - wen : ex, ey, wen, 4, surge ? '#ffd166' : '#f8a03f');
    rect(g, der ? ex + ew - Math.round(ew * 0.8) : ex + Math.round(ew * 0.8), ey - 1, 1, 6, 'rgba(255,255,255,0.8)');
    const lista = l.ultiLista, wu = Math.round((ew * l.ulti) / REGLAS.ultiMax);
    rect(g, ex, ey + 5, ew, 3, '#1d1a30');
    rect(g, der ? ex + ew - wu : ex, ey + 5, wu, 3, lista ? (parpadeo ? '#ffe9a8' : '#ffd166') : '#a855f7');
    // etiquetas de estado
    const est = [];
    if (l.mega) est.push('MEGA');
    else if (l.puedeEvolucionar && l.humano && parpadeo) est.push(this.teclaDe(l, 'mega') === 'EVO' ? 'EVO!' : `${this.teclaDe(l, 'mega')}:EVO`);
    else if (l.puedeMega && l.humano && parpadeo) est.push(this.teclaDe(l, 'mega') === 'EVO' ? 'MEGA!' : `${this.teclaDe(l, 'mega')}:MEGA`);
    if (lista && !l.puedeMega) est.push('ULT!');
    if (surge) est.push('SURGE');
    for (const et of Object.values(ESTADOS_TIPO)) if (l.est[et.est] && et.hud) est.push(et.hud);
    if (l.est.quema && !l.est.quemado) est.push('BRN');
    if (l.est.drenaje) est.push('SEED');
    if (l.est.veneno) est.push('PSN');
    if (l.est.lento) est.push('SLW');
    if (l.est.aturdido) est.push('STUN');
    if (l.est.sinDash) est.push('NODASH');
    if (l.est.marca) est.push('MARK');
    if (l.est.escudo) est.push('SHLD');
    if (l.est.caparazon) est.push('SHELL');
    if (l.est.confuso) est.push('CONF');
    if (l.est.defBaja) est.push('DEF-');
    if (l.est.potencia) est.push('ATK+');
    if (l.est.debil) est.push('ATK-');
    texto(g, est.join(' '), der ? nx - 92 : nx + 92, 36, { tam: 8, align: der ? 'right' : 'left', color: lista || surge ? '#ffd166' : '#c8c8d0', sombra: true });
  }

  teclaDe(l, slot) { return this.teclas?.[l.lado]?.[slot] ?? { lmb: 'LMB', rmb: 'RMB', esp: 'SPC', q: 'Q', e: 'E', mega: 'F' }[slot]; }

  // faixa de baixo com as 5 skills de quem joga. `lados` = índices dos lutadores humanos.
  // Um humano: 5 espaços largos no centro. Dois: um bloco compacto em cada canto.
  barraSkills(g, luta, lados, t, teclas) {
    this.teclas = teclas;
    rect(g, 0, BARRA_Y, ANCHO, ALTO - BARRA_Y, 'rgba(0,0,0,0.75)');
    rect(g, 0, BARRA_Y, ANCHO, 1, '#8a6a1c');
    const compacta = lados.length === 2;
    for (const i of lados) {
      const l = luta.luchadores[i], w = compacta ? 56 : 118, gap = compacta ? 2 : 3, total = 5 * w + 4 * gap;
      const x0 = compacta ? (i === 0 ? 6 : ANCHO - 6 - total) : Math.round((ANCHO - total) / 2), y = BARRA_Y + 3;
      RANURAS.forEach((slot, k) => this.ranura(g, l, slot, x0 + k * (w + gap), y, w, compacta, t, i));
    }
  }

  ranura(g, l, slot, x, y, w, compacta, t, lado) {
    const h = l.kit[slot], parpadeo = Math.floor(t * 4) % 2 === 0;
    rect(g, x, y, w, 23, '#0e1018');
    const borde = slot === 'e' ? '#8a6a1c' : compacta ? COLOR_EQUIPO[lado] : '#3a3a5a';
    g.strokeStyle = borde; g.lineWidth = 1; g.globalAlpha = slot === 'e' || !compacta ? 1 : 0.6;
    g.strokeRect(x + 0.5, y + 0.5, w - 1, 22); g.globalAlpha = 1;
    rect(g, x + 1, y + 1, 2, 21, hex(TIPOS[h?.tipo] ?? 0x555566));
    texto(g, this.teclaDe(l, slot), x + 6, y + 1, { tam: 8, color: '#d6a63a', max: compacta ? w - 8 : 28 });
    if (!h) return;
    const cd = l.cd[slot], sobre = slot === 'lmb' && t < l.sobrecargaHasta;
    let st, cs;
    if (slot === 'e') {
      if (l.ultiLista) { st = parpadeo ? 'READY' : 'ULT!'; cs = '#ffd166'; } else { st = `${Math.floor(l.ulti)}%`; cs = '#a855f7'; }
      rect(g, x + 3, y + 1, Math.round((w - 4) * l.ulti / REGLAS.ultiMax), 21, l.ultiLista ? 'rgba(255,209,102,0.25)' : 'rgba(168,85,247,0.18)');
    } else {
      if (sobre) { st = 'OVRLD'; cs = '#ff5a2a'; }
      else if (cd > 0) { st = cd >= 1 ? `${Math.ceil(cd)}s` : 'HEAT'; cs = '#ff9d2e'; }
      else if (l.energia < (h.coste ?? 0)) { st = 'NO EN'; cs = '#9aa0b4'; }
      else { st = 'READY'; cs = '#3ccf4e'; }
      if (cd > 0 && h.cd) rect(g, x + 3, y + 1, Math.round((w - 4) * cd / h.cd), 21, 'rgba(0,0,0,0.45)');
      if (slot === 'lmb') {
        const kc = Math.min(1, l.calor / REGLAS.calorMax);
        rect(g, x + 3, y + 21, w - 4, 2, '#2a1d1d');
        rect(g, x + 3, y + 21, Math.round((w - 4) * kc), 2, sobre ? '#ff2a2a' : kc > 0.7 ? '#ff6a3a' : '#ffc23a');
      }
    }
    if (compacta) { texto(g, st, x + 6, y + 11, { tam: 8, color: cs, max: w - 8 }); return; }
    const valor = slot === 'e' ? '' : h.coste ? String(h.coste) : h.dano ? String(h.dano) : '';
    texto(g, valor, x + 34, y + 1, { tam: 8, color: h.coste ? '#f59e0b' : '#ffe14d' });
    texto(g, st, x + w - 4, y + 1, { tam: 8, align: 'right', color: cs });
    texto(g, h.nombre, x + 6, y + 11, { tam: 8, color: '#ffffff', max: w - 10 });
  }
}
