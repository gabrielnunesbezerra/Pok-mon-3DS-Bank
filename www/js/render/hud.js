// HUD do combate: painel de cada lutador no alto (retrato, nome, tipos, vida, evolução, energia, ultimate e estados),
// relógio e rounds no centro, e a faixa de skills embaixo com recarga, custo e nome de cada espaço.
import { ANCHO, ALTO, HUD_ALTO, BARRA_Y, FUENTE, hex } from '../config.js';
import { REGLAS, TIPOS, ESTADOS_TIPO } from '../data/regras.js';
import { rect, texto, medir } from './pixel.js';

const COLOR_EQUIPO = ['#4a9fff', '#ff5a5a', '#4ade80', '#facc15'];
const COLOR_TIME = ['#4a9fff', '#ff5a5a'];
const RANURAS = ['lmb', 'rmb', 'esp', 'q', 'e'];
const caso = s => s.charAt(0) + s.slice(1).toLowerCase();
export const corDe = (luta, l) => (luta.equipos ? COLOR_TIME[l.equipo] : COLOR_EQUIPO[l.lado]);

// etiquetas de estado mais importantes primeiro (cabem poucas)
function etiquetas(l, parpadeo, tecla) {
  const est = [];
  if (l.mega) est.push(['MEGA', '#ffe14d']);
  else if (l.puedeEvolucionar && l.humano && parpadeo) est.push([tecla === 'EVO' ? 'EVO!' : `${tecla}:EVO`, '#7dd3fc']);
  else if (l.puedeMega && l.humano && parpadeo) est.push([tecla === 'EVO' ? 'MEGA!' : `${tecla}:MEGA`, '#ffe14d']);
  if (l.ultiLista && !l.puedeMega && !l.kit.e?.sinUlti) est.push(['ULT', '#ffd166']);
  if (l.energia >= REGLAS.surgeUmbral) est.push(['SURGE', '#ffb347']);
  for (const et of Object.values(ESTADOS_TIPO)) if (l.est[et.est] && et.hud) est.push([et.hud, '#c4b5fd']);
  const mapa = [['quema', 'BRN', '#ff7a3a'], ['veneno', 'PSN', '#d68cf0'], ['aturdido', 'STUN', '#ffe14d'], ['lento', 'SLW', '#7dd3fc'], ['drenaje', 'SEED', '#86efac'], ['sinDash', 'NODASH', '#9aa0b4'], ['marca', 'MARK', '#ff6a6a'], ['escudo', 'SHLD', '#bfe9ff'], ['confuso', 'CONF', '#f0abfc'], ['dormido', 'SLEEP', '#a5b4fc'], ['potencia', 'ATK+', '#fca5a5'], ['debil', 'ATK-', '#9aa0b4'], ['defBaja', 'DEF-', '#9aa0b4']];
  for (const [k, txt, c] of mapa) if (l.est[k] && !(k === 'quema' && l.est.quemado)) est.push([txt, c]);
  return est;
}

export class Hud {
  constructor(bank) { this.bank = bank; this.estela = [1, 1, 1, 1]; }

  // cartões de vidro flutuando no alto (sem faixa opaca: a arena aparece atrás) e o relógio numa pílula no meio
  dibujar(g, luta, t) {
    const parpadeo = Math.floor(t * 4) % 2 === 0, L = luta.luchadores;
    // ordem: no modo duplas, o time azul à esquerda e o vermelho à direita
    const ordem = luta.equipos ? [...L].sort((a, b) => a.equipo - b.equipo || a.lado - b.lado) : L;
    const esq = luta.equipos ? ordem.filter(l => l.equipo === 0) : ordem.slice(0, Math.ceil(L.length / 2));
    const dir = luta.equipos ? ordem.filter(l => l.equipo === 1) : ordem.slice(Math.ceil(L.length / 2));
    const meio = 34, lado = ANCHO / 2 - meio - 6;
    for (const [lista, der] of [[esq, false], [dir, true]]) {
      const n = lista.length, compacta = n > 1 || L.length > 2, w = Math.min(compacta ? 150 : 214, Math.floor((lado - 4 * (n - 1)) / Math.max(1, n)));
      lista.forEach((l, k) => {
        // presos na borda da tela: o meio fica livre para a luta
        const x = der ? ANCHO - 6 - (n - k) * w - (n - k - 1) * 4 : 6 + k * (w + 4);
        this.tarjeta(g, luta, l, x, 4, w, compacta, der, t, parpadeo);
      });
    }
    this.relogio(g, luta, t);
  }

  relogio(g, luta, t) {
    const tiempo = Math.max(0, Math.ceil(luta.reloj)), x = ANCHO / 2, urg = tiempo <= 10 && !luta.entreno;
    g.save();
    g.fillStyle = 'rgba(6,12,30,0.72)'; g.beginPath(); g.roundRect(x - 28, 4, 56, 26, 9); g.fill();
    g.lineWidth = 1; g.strokeStyle = urg ? (Math.floor(t * 4) % 2 ? '#ff6a6a' : '#7a2a2a') : 'rgba(214,166,58,0.8)'; g.stroke();
    g.restore();
    texto(g, luta.entreno ? '--' : String(tiempo).padStart(2, '0'), x, 6, { tam: 13, align: 'center', color: urg ? '#ff6a6a' : '#ffffff', borde: 2, peso: 700 });
    texto(g, luta.entreno ? 'TRAINING' : `ROUND ${luta.numRonda}`, x, 21, { tam: 6, align: 'center', color: '#d6a63a' });
    if (luta.entreno) return;
    // rounds ganhos: bolinhas embaixo da pílula (por time no modo duplas)
    const lados = luta.equipos ? [0, 1].map(e => luta.luchadores.find(l => l.equipo === e)) : luta.luchadores;
    lados.forEach((l, i) => {
      if (!l) return;
      const n = lados.length, cor = corDe(luta, l), x0 = x - ((n - 1) * 22) / 2 + i * 22;
      for (let k = 0; k < REGLAS.rondasParaGanar; k++) {
        const cx = x0 + (k - (REGLAS.rondasParaGanar - 1) / 2) * 7;
        g.fillStyle = 'rgba(4,10,28,0.8)'; g.beginPath(); g.arc(cx, 35, 3, 0, 7); g.fill();
        if (k < luta.victorias[l.lado]) { g.fillStyle = cor; g.beginPath(); g.arc(cx, 35, 2.2, 0, 7); g.fill(); }
      }
    });
  }

  // um lutador: retrato, nome, tipos, vida com rastro, energia, ultimate, evolução e estados
  tarjeta(g, luta, l, x, y, w, compacta, der, t, parpadeo) {
    const i = l.lado, cor = corDe(luta, l), h = compacta ? 36 : 40, ret = compacta ? 22 : 32, morto = l.ko;
    g.save();
    g.globalAlpha = morto ? 0.45 : 1;
    // fundo de vidro: mais escuro na borda da tela, quase transparente para o meio
    const fundo = g.createLinearGradient(der ? x + w : x, 0, der ? x : x + w, 0);
    fundo.addColorStop(0, 'rgba(6,12,30,0.8)'); fundo.addColorStop(1, 'rgba(6,12,30,0.35)');
    g.fillStyle = fundo; g.beginPath(); g.roundRect(x, y, w, h, 8); g.fill();
    g.lineWidth = 1; g.strokeStyle = cor; g.globalAlpha *= 0.75; g.stroke(); g.globalAlpha = morto ? 0.45 : 1;
    // retrato
    const px = der ? x + w - ret - 4 : x + 4, py = y + 3;
    g.save(); g.beginPath(); g.roundRect(px, py, ret, ret, 6); g.clip();
    g.fillStyle = '#0e1a36'; g.fillRect(px, py, ret, ret);
    const img = this.bank.retrato(l.dex);
    if (img) { if (der) { g.translate(px * 2 + ret, 0); g.scale(-1, 1); } g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, px, py, ret, ret); }
    g.restore();
    g.lineWidth = 1.5; g.strokeStyle = cor; g.beginPath(); g.roundRect(px, py, ret, ret, 6); g.stroke();
    // nome e tipos
    const bx = der ? x + 6 : px + ret + 5, bw = w - ret - 15;
    const nomeX = der ? px - 5 : bx;
    texto(g, l.nombre, nomeX, y + 3, { tam: compacta ? 6 : 8, align: der ? 'right' : 'left', color: l.mega ? '#ffe14d' : '#ffffff', sombra: true, max: bw - (compacta ? 16 : 40) });
    let cx = der ? nomeX - Math.min(bw - 40, medir(g, l.nombre, compacta ? 6 : 8)) - 4 : nomeX + Math.min(bw - 40, medir(g, l.nombre, compacta ? 6 : 8)) + 4;
    for (const tp of l.tipos) {
      const c = hex(TIPOS[tp] ?? 0xffffff);
      if (compacta) { g.fillStyle = c; g.beginPath(); g.arc(cx + (der ? -3 : 3), y + 7, 2.5, 0, 7); g.fill(); cx += der ? -7 : 7; continue; }
      const nm = caso(tp), tw = Math.ceil(medir(g, nm, 6)) + 6, tx = der ? cx - tw : cx;
      g.fillStyle = c; g.beginPath(); g.roundRect(tx, y + 3, tw, 9, 4); g.fill();
      texto(g, nm, tx + tw / 2, y + 4, { tam: 6, align: 'center', color: '#fff', sombra: true });
      cx += der ? -(tw + 3) : tw + 3;
    }
    // vida
    const f = Math.max(0, l.hp / l.hpMax), vy = y + (compacta ? 12 : 16), vh = compacta ? 6 : 8;
    this.estela[i] = this.estela[i] > f ? Math.max(f, this.estela[i] - 0.5 / 60) : f;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.roundRect(bx - 1, vy - 1, bw + 2, vh + 2, 4); g.fill();
    const we = bw * this.estela[i], wv = bw * f;
    if (we > 1) { g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.roundRect(der ? bx + bw - we : bx, vy, we, vh, 3); g.fill(); }
    if (wv > 1) {
      const gv = g.createLinearGradient(0, vy, 0, vy + vh), c1 = f > 0.5 ? '#5ef07a' : f > 0.2 ? '#ffd84a' : '#ff5a4a', c2 = f > 0.5 ? '#1fa83c' : f > 0.2 ? '#d19a1a' : '#b8221a';
      gv.addColorStop(0, c1); gv.addColorStop(1, c2);
      g.fillStyle = gv; g.beginPath(); g.roundRect(der ? bx + bw - wv : bx, vy, wv, vh, 3); g.fill();
    }
    for (let k = 1; k < 10; k++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(Math.round(bx + (bw * k) / 10), vy + vh - 3, 1, 3); }
    if (!compacta) texto(g, morto ? 'K.O.' : `${Math.ceil(l.hp)}`, der ? bx + 3 : bx + bw - 3, vy, { tam: 6, align: der ? 'left' : 'right', color: '#ffffff', borde: 2 });
    // energia (marca do SURGE) e ultimate
    const ey = vy + vh + 3, eh = compacta ? 2 : 3, ew = Math.round(bw * 0.55), uw = bw - ew - 3;
    const surge = l.energia >= REGLAS.surgeUmbral;
    const barra = (bx2, w2, k, c) => { g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(bx2, ey, w2, eh); g.fillStyle = c; g.fillRect(der ? bx2 + w2 - Math.round(w2 * k) : bx2, ey, Math.round(w2 * k), eh); };
    barra(der ? bx + uw + 3 : bx, ew, l.energia / REGLAS.energiaMax, surge ? '#ffd166' : '#f8a03f');
    barra(der ? bx : bx + ew + 3, uw, l.ulti / REGLAS.ultiMax, l.ultiLista ? (parpadeo ? '#fff3c4' : '#ffd166') : '#a855f7');
    // evolução: pontinhos das etapas e barra fina
    if (l.etapasTotales > 1) {
      const final = l.etapa >= l.etapasTotales - 1, k = final ? 1 : Math.min(1, l.exp / l.expNecesaria), xy = ey + eh + 2;
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(bx, xy, bw, 1);
      g.fillStyle = final ? '#4b6e63' : l.puedeEvolucionar ? (parpadeo ? '#ffffff' : '#7dd3fc') : '#38bdf8'; g.fillRect(der ? bx + bw - Math.round(bw * k) : bx, xy, Math.round(bw * k), 1);
    }
    // estados em pílulas pequenas
    if (!compacta) {
      let sx = der ? x + w - ret - 8 : x + ret + 8;
      for (const [txt, c] of etiquetas(l, parpadeo, this.teclaDe(l, 'mega')).slice(0, 4)) {
        const tw = Math.ceil(medir(g, txt, 6)) + 6, tx = der ? sx - tw : sx;
        g.fillStyle = 'rgba(6,12,30,0.75)'; g.beginPath(); g.roundRect(tx, y + h + 1, tw, 9, 4); g.fill();
        texto(g, txt, tx + tw / 2, y + h + 2, { tam: 6, align: 'center', color: c });
        sx += der ? -(tw + 2) : tw + 2;
      }
    }
    g.restore();
  }

  teclaDe(l, slot) { return this.teclas?.[l.lado]?.[slot] ?? { lmb: 'LMB', rmb: 'RMB', esp: 'SPC', q: 'Q', e: 'E', mega: 'F' }[slot]; }

  // faixa de baixo com as 5 skills de quem joga. `lados` = índices dos lutadores humanos.
  // Um humano: 5 espaços largos no centro. Dois: um bloco compacto em cada canto.
  barraSkills(g, luta, lados, t, teclas) {
    this.teclas = teclas;
    rect(g, 0, BARRA_Y, ANCHO, ALTO - BARRA_Y, 'rgba(4,8,20,0.6)');
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
    if (slot === 'e' && h.sinUlti) { st = 'EVOLVE'; cs = '#6b7280'; }
    else if (slot === 'e') {
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
