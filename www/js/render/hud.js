// HUD do combate no estilo do Pokémon Arena 2D: painel escuro e sólido de cada lutador no alto (retrato, nome, tipos,
// vida com coração e número, evolução, energia, ultimate, o nome do golpe que acabou de usar e estados), relógio em
// minutos e rounds no centro, e a faixa de skills embaixo com recarga, custo e nome de cada espaço.
import { temDormindo } from '../engine/formasNovas.js';
import { ANCHO, ALTO, HUD_ALTO, BARRA_Y, FUENTE, hex } from '../config.js';
import { REGLAS, TIPOS, ESTADOS_TIPO } from '../data/regras.js';
import { rect, texto, medir } from './pixel.js';
import { icono, tono } from './iconos.js';

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

// coração de vida em pixels (7x6), no canto da barra
function coracao(g, x, y) {
  g.fillStyle = '#ff4a5a';
  g.fillRect(x + 1, y, 2, 1); g.fillRect(x + 4, y, 2, 1); g.fillRect(x, y + 1, 7, 2); g.fillRect(x + 1, y + 3, 5, 1); g.fillRect(x + 2, y + 4, 3, 1); g.fillRect(x + 3, y + 5, 1, 1);
  g.fillStyle = '#ffd0d6'; g.fillRect(x + 1, y + 1, 1, 1);
}

export class Hud {
  constructor(bank) { this.bank = bank; this.estela = [1, 1, 1, 1]; }

  // painéis presos nos cantos de cima e o relógio numa caixa no meio
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
    texto(g, luta.entreno ? '--' : `${Math.floor(tiempo / 60)}:${String(tiempo % 60).padStart(2, '0')}`, x, 6, { tam: 13, align: 'center', color: urg ? '#ff6a6a' : '#ffffff', borde: 2, peso: 700 });
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
    // fundo escuro e sólido com o canto de dentro cortado na diagonal e uma faixa fina na cor do time no alto
    const corte = 10;
    g.fillStyle = 'rgba(8,12,26,0.92)'; g.beginPath();
    if (der) { g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h); g.lineTo(x + corte, y + h); }
    else { g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w - corte, y + h); g.lineTo(x, y + h); }
    g.closePath(); g.fill();
    g.fillStyle = cor; g.fillRect(x, y, w, 2);
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
      // cor chapada com uma faixa mais escura embaixo (sem degradê)
      const c1 = f > 0.5 ? '#4fd866' : f > 0.2 ? '#f2c63a' : '#e8483a', c2 = f > 0.5 ? '#2a9a42' : f > 0.2 ? '#b8881a' : '#a82a20', bx0 = der ? bx + bw - wv : bx;
      g.fillStyle = c1; g.fillRect(bx0, vy, wv, vh); g.fillStyle = c2; g.fillRect(bx0, vy + vh - 2, wv, 2);
    }
    for (let k = 1; k < 10; k++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(Math.round(bx + (bw * k) / 10), vy + vh - 3, 1, 3); }
    if (!compacta) {
      // coração e número da vida
      const num = morto ? 'K.O.' : `${Math.ceil(l.hp)}`, nw = Math.ceil(medir(g, num, 6)), hx = der ? bx + 3 + nw + 3 : bx + bw - 3 - nw - 8;
      if (!morto) coracao(g, hx, vy + 1);
      texto(g, num, der ? bx + 3 : bx + bw - 3, vy, { tam: 6, align: der ? 'left' : 'right', color: '#ffffff', borde: 2 });
    }
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
    // nome do golpe que acabou de usar numa etiqueta marrom (como no Pokémon Arena 2D), depois os estados em pílulas
    if (!compacta) {
      let sx = der ? x + w - ret - 8 : x + ret + 8;
      const b = this.globos?.find(gb => gb.l === l);
      if (b) {
        const txt = b.txt.toUpperCase(), tw = Math.ceil(medir(g, txt, 6, 700)) + 8, tx = der ? sx - tw : sx;
        g.globalAlpha = (morto ? 0.45 : 1) * Math.min(1, (b.life - b.t) * 4);
        g.fillStyle = '#3a2412'; g.fillRect(tx - 1, y + h, tw + 2, 11); g.fillStyle = '#7a4a22'; g.fillRect(tx, y + h + 1, tw, 9);
        texto(g, txt, tx + tw / 2, y + h + 2, { tam: 6, align: 'center', color: '#ffe8c0', peso: 700 });
        g.globalAlpha = morto ? 0.45 : 1;
        sx += der ? -(tw + 3) : tw + 3;
      }
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
  // barra de skills embaixo: um cartão por skill com o ícone na cor do tipo, nome, tecla, custo, recarga e ult.
  // no celular aparece só a do jogador, menor, no meio entre o analógico e os botões
  barraSkills(g, luta, lados, t, teclas, celular = false) {
    this.teclas = teclas;
    if (!celular) { const gr = g.createLinearGradient(0, BARRA_Y - 4, 0, ALTO); gr.addColorStop(0, 'rgba(4,8,20,0)'); gr.addColorStop(0.35, 'rgba(4,8,20,0.75)'); gr.addColorStop(1, 'rgba(4,8,20,0.9)'); g.fillStyle = gr; g.fillRect(0, BARRA_Y - 4, ANCHO, ALTO - BARRA_Y + 4); }
    const compacta = !celular && lados.length === 2;
    for (const i of (celular ? lados.slice(0, 1) : lados)) {
      const l = luta.luchadores[i];
      let w, gap, x0, y, h;
      if (celular) { const esq = 122, dir = ANCHO - 186; gap = 3; w = Math.min(70, Math.floor((dir - esq - 4 * gap) / 5)); h = 22; x0 = Math.round((esq + dir) / 2 - (5 * w + 4 * gap) / 2); y = ALTO - h - 4; }
      else { w = compacta ? 60 : 120; gap = 3; h = 24; const total = 5 * w + 4 * gap; x0 = compacta ? (i === 0 ? 6 : ANCHO - 6 - total) : Math.round((ANCHO - total) / 2); y = BARRA_Y + 1; }
      RANURAS.forEach((slot, k) => this.cartao(g, l, slot, x0 + k * (w + gap), y, w, h, compacta || celular, t, celular));
    }
  }

  cartao(g, l, slot, x, y, w, h, mini, t, celular) {
    const kit = l.kit[slot]; if (!kit) return;
    const corT = hex(TIPOS[kit.tipo] ?? 0x8888aa), ult = slot === 'e', cd = l.cd[slot] ?? 0, sobre = slot === 'lmb' && t < l.sobrecargaHasta;
    const semEn = !ult && slot !== 'lmb' && l.energia < (kit.coste ?? 0), travada = (kit.forma === 'teleSono' && l.luta && !temDormindo(l.luta, l, kit.alcance)) || (kit.forma === 'xFolha' && !l.xListo) || (kit.requierePlasma && (l.plasma ?? 0) < 100);
    const pronta = ult ? l.ultiLista && !kit.sinUlti : !sobre && !semEn && !travada && !(cd > 0.05 && (kit.cd ?? 0) > 1.2);
    // fundo arredondado
    const r = 4;
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    const fg = g.createLinearGradient(0, y, 0, y + h); fg.addColorStop(0, pronta ? '#222b44' : '#171b28'); fg.addColorStop(1, '#0a0d16'); g.fillStyle = fg; g.fill();
    g.strokeStyle = ult ? (pronta ? '#ffd166' : '#8a6a1c') : pronta ? corT : '#2c3348'; g.lineWidth = 1; g.stroke();
    // ícone na cor do tipo, com a recarga escurecendo de cima para baixo
    const s = h - 4, ix = x + 2, iy = y + 2;
    const ig = g.createLinearGradient(0, iy, 0, iy + s); ig.addColorStop(0, corT); ig.addColorStop(1, tono(corT, -0.45)); g.fillStyle = ig; g.fillRect(ix, iy, s, s);
    icono(g, ult && !kit.forma ? 'ulti' : kit.forma ?? 'basico', ix + s / 2, iy + s / 2, s * 0.36, '#ffffff');
    if (!ult && cd > 0 && kit.cd) { g.fillStyle = 'rgba(0,0,0,0.62)'; g.fillRect(ix, iy, s, Math.round(s * Math.min(1, cd / kit.cd))); if (cd >= 1) texto(g, String(Math.ceil(cd)), ix + s / 2, iy + s / 2 - 4, { tam: 8, align: 'center', color: '#ffffff' }); }
    if (ult && !pronta) { g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(ix, iy, s, Math.round(s * (1 - Math.min(1, l.ulti / REGLAS.ultiMax)))); }
    if (travada || semEn) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(ix, iy, s, s); }
    if (!celular) { const tc = this.teclaDe(l, slot); g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(ix, iy + s - 7, Math.min(s, 4 + tc.length * 4), 7); texto(g, tc, ix + 1, iy + s - 8, { tam: 6, color: '#ffd166' }); }
    // nome e estado
    const tx = ix + s + 3, tw = w - s - 6;
    if (tw < 14) return;
    texto(g, kit.nombre ?? '', tx, y + 2, { tam: mini ? 6 : 8, color: pronta ? '#ffffff' : '#9aa3b8', max: tw });
    let st, cs;
    if (kit.sinUlti && ult) { st = 'EVOLVE'; cs = '#6b7280'; }
    else if (ult) { st = pronta ? 'READY' : `${Math.floor(l.ulti)}%`; cs = pronta ? '#ffd166' : '#c084fc'; }
    else if (sobre) { st = 'OVERLOAD'; cs = '#ff5a2a'; }
    else if (travada) { st = kit.forma === 'xFolha' ? 'DASH 1ST' : kit.requierePlasma ? 'PLASMA' : 'SLEEP'; cs = '#a78bfa'; }
    else if (semEn) { st = 'NO EN'; cs = '#9aa3b8'; }
    else if (cd > 0.05 && (kit.cd ?? 0) > 1.2) { st = `${cd.toFixed(cd < 3 ? 1 : 0)}s`; cs = '#ff9d2e'; }
    else { st = 'READY'; cs = '#3ccf4e'; }
    const ly = y + h - (mini ? 9 : 11);
    texto(g, st, tx, ly, { tam: mini ? 6 : 8, color: cs, max: tw * 0.6 });
    if (!mini && kit.coste && !ult) { const cw = 8 + String(kit.coste).length * 5; g.fillStyle = l.energia >= kit.coste ? '#b45309' : '#3f3f46'; g.fillRect(x + w - cw - 3, ly + 1, cw, 9); texto(g, String(kit.coste), x + w - 3 - cw / 2, ly, { tam: 8, align: 'center', color: '#fff7d6' }); }
    // barra fina embaixo: ult enchendo, ou o calor do básico
    if (ult) { g.fillStyle = '#2a2235'; g.fillRect(x + 2, y + h - 2, w - 4, 1); g.fillStyle = pronta ? '#ffd166' : '#a855f7'; g.fillRect(x + 2, y + h - 2, Math.round((w - 4) * Math.min(1, l.ulti / REGLAS.ultiMax)), 1); }
    else if (slot === 'lmb') { const kc = Math.min(1, l.calor / REGLAS.calorMax); g.fillStyle = sobre ? '#ff2a2a' : kc > 0.7 ? '#ff6a3a' : '#ffc23a'; g.fillRect(x + 2, y + h - 2, Math.round((w - 4) * kc), 1); }
  }

  // (antigo) mantido para quem ainda chama
  ranura(g, l, slot, x, y, w, compacta, t) { this.cartao(g, l, slot, x, y, w, 23, compacta, t, false); }
}
