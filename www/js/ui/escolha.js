// Lista de Pokémon que abre ao tocar numa vaga (lobby, treino e online): grade com o retrato de todo o roster, filtro
// por função, opção aleatória e, do lado, a ficha do Pokémon em foco (sprite animado, tipos, atributos, skills e a
// linha até a Mega). Setas movem, Q/E trocam o filtro, Enter escolhe, Esc fecha.
import { ROSTER, ROLES } from '../data/pokemon.js';
import { TIPOS } from '../data/regras.js';
import { hex } from '../config.js';
import { texto } from '../render/pixel.js';
import { sfx } from '../audio.js';

const G = { cols: 8, w: 48, h: 44, gap: 3, x0: 8, y0: 58 };
const P = { x: 422, y: 30, w: 212, h: 320 };
const FILTROS = [['', 'ALL'], ...Object.entries(ROLES).map(([k, r]) => [k, r.nombre])];
const MAX = { hp: Math.max(...ROSTER.map(p => p.hp)), atk: Math.max(...ROSTER.map(p => p.atk)), def: Math.max(...ROSTER.map(p => p.def)), vel: Math.max(...ROSTER.map(p => p.vel)) };
const SLOTS = [['lmb', 'BASIC'], ['rmb', 'SKILL'], ['esp', 'DASH'], ['q', 'UTILITY'], ['e', 'ULT']];

function caixa(g, x, y, w, h, fundo, borda, r = 5) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  if (fundo) { g.fillStyle = fundo; g.fill(); }
  if (borda) { g.strokeStyle = borda; g.lineWidth = 1.5; g.stroke(); }
}
const etiqueta = (g, x, y, txt, cor) => { const w = 8 + txt.length * 5; g.fillStyle = cor; g.fillRect(x, y, w, 10); texto(g, txt, x + 4, y + 1, { tam: 6, color: '#ffffff' }); return w + 3; };

export class Escolha {
  // alElegir(i): i = índice no ROSTER, ou -1 para aleatório
  constructor({ titulo = 'PICK A POKÉMON', atual = -1, aleatorio = false, alElegir, alFechar }) {
    this.titulo = titulo; this.aleatorio = aleatorio; this.alElegir = alElegir; this.alFechar = alFechar;
    this.atual = atual; this.filtro = ''; this.t0 = 0;
    this.montar(); this.cursor = Math.max(0, this.lista.indexOf(atual));
  }
  montar() { this.lista = ROSTER.map((_, i) => i).filter(i => !this.filtro || ROSTER[i].rol === this.filtro); if (this.aleatorio) this.lista.push(-1); }
  get total() { return this.lista.length; }
  pos(i) { return { x: G.x0 + (i % G.cols) * (G.w + G.gap), y: G.y0 + Math.floor(i / G.cols) * (G.h + G.gap), w: G.w, h: G.h }; }
  posFiltro(k) { return { x: 8 + k * 68, y: 34, w: 64, h: 16 }; }
  posOk() { return { x: P.x + 10, y: P.y + P.h - 26, w: P.w - 20, h: 20 }; }
  elegir(k) { if (k === undefined) return; sfx('confirmar'); this.alElegir?.(k); }
  fechar() { sfx('atras'); this.alFechar?.(); }
  trocarFiltro(d) { const k = FILTROS.findIndex(([id]) => id === this.filtro); this.filtro = FILTROS[(k + d + FILTROS.length) % FILTROS.length][0]; this.montar(); this.cursor = 0; sfx('seleccion'); }

  puntero(tipo, p) {
    const em = c => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h;
    for (let i = 0; i < this.total; i++) {
      if (!em(this.pos(i))) continue;
      if (tipo === 'move') this.cursor = i;
      else if (tipo === 'down') { if (this.cursor === i) this.elegir(this.lista[i]); else { this.cursor = i; sfx('seleccion'); } }
      return;
    }
    if (tipo !== 'down') return;
    FILTROS.forEach(([id], k) => { if (em(this.posFiltro(k))) { this.filtro = id; this.montar(); this.cursor = 0; sfx('seleccion'); } });
    if (em(this.posOk())) this.elegir(this.lista[this.cursor]);
    if (em({ x: 4, y: 4, w: 70, h: 18 })) this.fechar();
  }
  tecla(c, nova) {
    if (!nova) return;
    const n = this.total;
    if (c === 'Escape' || c === 'Backspace') return this.fechar();
    if (c === 'Enter' || c === 'Space' || c === 'NumpadEnter') return this.elegir(this.lista[this.cursor]);
    if (c === 'KeyQ' || c === 'PageUp') return this.trocarFiltro(-1);
    if (c === 'KeyE' || c === 'PageDown' || c === 'Tab') return this.trocarFiltro(1);
    const dx = ['ArrowRight', 'KeyD'].includes(c) ? 1 : ['ArrowLeft', 'KeyA'].includes(c) ? -1 : 0;
    const dy = ['ArrowDown', 'KeyS'].includes(c) ? G.cols : ['ArrowUp', 'KeyW'].includes(c) ? -G.cols : 0;
    if (dx || dy) { this.cursor = Math.min(n - 1, Math.max(0, this.cursor + dx + dy)); sfx('seleccion'); }
  }

  dibujar(g, bank, t = performance.now() / 1000) {
    g.fillStyle = '#0b1530'; g.fillRect(-200, 0, 1040, 360);
    g.fillStyle = 'rgba(255,255,255,0.04)'; for (let y = 6; y < 360; y += 12) for (let x = -196; x < 840; x += 12) g.fillRect(x, y, 2, 2);
    caixa(g, 4, 4, 70, 18, '#1e3a6e', '#4f7bc4', 4); texto(g, '< BACK', 39, 9, { tam: 8, align: 'center', color: '#e6eefc' });
    texto(g, this.titulo, 214, 8, { tam: 12, align: 'center', color: '#facc15', borde: 2 });
    FILTROS.forEach(([id, nome], k) => { const c = this.posFiltro(k), on = this.filtro === id, cor = id ? hex(ROLES[id].color) : '#facc15'; caixa(g, c.x, c.y, c.w, c.h, on ? cor : '#16223f', on ? '#ffffff' : cor, 4); texto(g, nome, c.x + c.w / 2, c.y + 4, { tam: 6, align: 'center', color: on && !id ? '#1c1300' : '#ffffff' }); });
    for (let i = 0; i < this.total; i++) {
      const c = this.pos(i), k = this.lista[i], def = ROSTER[k], foco = this.cursor === i, atual = k === this.atual;
      const sobe = foco ? Math.round(Math.sin(t * 8) * 1) - 1 : 0;
      caixa(g, c.x, c.y + sobe, c.w, c.h, foco ? '#25427e' : atual ? '#1f3466' : '#16223f', foco ? '#ffffff' : atual ? '#facc15' : def ? hex(ROLES[def.rol]?.color ?? 0x4f7bc4) : '#facc15', 5);
      if (!def) { texto(g, '?', c.x + c.w / 2, c.y + 6 + sobe, { tam: 20, align: 'center', color: '#facc15', borde: 2 }); texto(g, 'RANDOM', c.x + c.w / 2, c.y + c.h - 10 + sobe, { tam: 5, align: 'center', color: '#ffffff' }); continue; }
      const r = bank.retrato(def.dex);
      if (r) { g.imageSmoothingEnabled = false; g.drawImage(r, c.x + c.w / 2 - 14, c.y + 3 + sobe, 28, 28); }
      g.fillStyle = hex(TIPOS[def.tipos[0]] ?? 0x888888); g.fillRect(c.x + 3, c.y + c.h - 13 + sobe, c.w - 6, 1);
      texto(g, def.nombre, c.x + c.w / 2, c.y + c.h - 10 + sobe, { tam: 5, align: 'center', color: '#ffffff', max: c.w - 4 });
    }
    this.ficha(g, bank, t);
  }

  // ficha do Pokémon em foco
  ficha(g, bank, t) {
    const k = this.lista[this.cursor], def = ROSTER[k], x = P.x, y = P.y;
    caixa(g, x, y, P.w, P.h, '#111c38', def ? hex(ROLES[def.rol]?.color ?? 0x4f7bc4) : '#facc15', 7);
    if (!def) {
      texto(g, '?', x + P.w / 2, y + 60, { tam: 48, align: 'center', color: '#facc15', borde: 3 });
      texto(g, 'RANDOM', x + P.w / 2, y + 140, { tam: 12, align: 'center', color: '#ffffff' });
      texto(g, 'A NEW POKÉMON EVERY FIGHT', x + P.w / 2, y + 160, { tam: 6, align: 'center', color: '#9fc0f0' });
    } else {
      // palco com o sprite animado
      g.fillStyle = '#0b1530'; g.fillRect(x + 6, y + 6, P.w - 12, 84);
      g.fillStyle = '#16223f'; g.beginPath(); g.ellipse(x + 56, y + 78, 36, 8, 0, 0, 7); g.fill();
      bank.dibujar(g, def.dex, 'Idle', t, x + 56, y + 78, 1.6, { fila: 0 });
      texto(g, def.nombre, x + 104, y + 12, { tam: 12, color: '#ffffff', max: 104 });
      let ex = x + 104; for (const tp of def.tipos) ex += etiqueta(g, ex, y + 30, tp, hex(TIPOS[tp] ?? 0x888888));
      const rol = ROLES[def.rol]; if (rol) etiqueta(g, x + 104, y + 44, rol.nombre, hex(rol.color));
      const fim = def.evoluciones.at(-1), mega = def.evoluciones.find(e => e.mega)?.mega;
      const linha = [...new Set([def.nombre, ...def.evoluciones.map(e => e.nombre)])].join(' > ') + (mega ? ' > MEGA' : '');
      texto(g, linha, x + 104, y + 60, { tam: 5, color: '#9fc0f0', max: 104 });
      texto(g, `${def.evoluciones.length} UPGRADES${mega ? ' + MEGA' : ''}`, x + 104, y + 70, { tam: 5, color: '#facc15', max: 104 });
      void fim;
      texto(g, `"${def.lema ?? ''}"`, x + P.w / 2, y + 96, { tam: 5, align: 'center', color: '#c8d0e8', max: P.w - 12 });
      // atributos
      [['HP', def.hp / MAX.hp, '#4ade80'], ['ATK', def.atk / MAX.atk, '#f87171'], ['DEF', def.def / MAX.def, '#60a5fa'], ['SPD', def.vel / MAX.vel, '#facc15']].forEach(([n, f, cor], i) => {
        const yy = y + 110 + i * 12;
        texto(g, n, x + 10, yy, { tam: 6, color: '#e6eefc' });
        g.fillStyle = '#0b1530'; g.fillRect(x + 36, yy + 1, P.w - 48, 6);
        g.fillStyle = cor; g.fillRect(x + 36, yy + 1, Math.round((P.w - 48) * Math.max(0.05, Math.min(1, f))), 6);
      });
      // skills
      texto(g, 'SKILLS', x + 10, y + 162, { tam: 6, color: '#facc15' });
      SLOTS.forEach(([sl, n], i) => {
        const h = def.kit[sl]; if (!h) return;
        const yy = y + 174 + i * 15;
        caixa(g, x + 8, yy, P.w - 16, 13, '#16223f', '#2c4170', 3);
        texto(g, n, x + 13, yy + 3, { tam: 5, color: '#9fc0f0' });
        texto(g, h.nombre ?? '', x + 56, yy + 3, { tam: 6, color: '#ffffff', max: P.w - 70 });
        if (sl === 'e' && h.sinUlti) texto(g, 'LV2', x + P.w - 14, yy + 3, { tam: 5, align: 'right', color: '#facc15' });
      });
    }
    const ok = this.posOk(); caixa(g, ok.x, ok.y, ok.w, ok.h, '#facc15', '#fff7d6', 5);
    texto(g, k === this.atual ? 'KEEP' : 'CHOOSE', ok.x + ok.w / 2, ok.y + 6, { tam: 8, align: 'center', color: '#1c1300' });
    texto(g, 'TAP TWICE OR ENTER TO CHOOSE · Q / E CHANGE FILTER', 214, 346, { tam: 5, align: 'center', color: '#9fc0f0' });
  }
}
