// Lobby de batalha (como o da arena do site): até 4 lutadores em cartões. Em cada cartão dá para trocar o Pokémon
// pelas setas ou tocando nele (abre a lista), deixar aleatório e tirar a vaga. Embaixo: arena, nível da CPU e modo
// (todos contra todos ou 2 contra 2). P1 é você; as outras vagas são CPU. No treino a vaga 2 é o boneco.
import { ANCHO, ALTO, hex } from '../config.js';
import { ROSTER, ROLES } from '../data/pokemon.js';
import { ARENAS } from '../data/arenas.js';
import { TIPOS } from '../data/regras.js';
import { texto } from '../render/pixel.js';
import { sfx } from '../audio.js';
import { centrada } from './centrar.js';
import { shinyLiberado } from '../data/conta.js';
import { Escolha } from './escolha.js';

const CORES = ['#3b82f6', '#ef4444', '#22c55e', '#eab308'];
const NIVEIS = [['facil', 'EASY'], ['normal', 'NORMAL'], ['dificil', 'HARD']];
const CARD = { w: 300, h: 92, x: [14, 326], y: [30, 128] };

const azar = () => Math.floor(Math.random() * ROSTER.length);

function caixa(g, x, y, w, h, fundo, borda, r = 5) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  if (fundo) { g.fillStyle = fundo; g.fill(); }
  if (borda) { g.strokeStyle = borda; g.lineWidth = 1.5; g.stroke(); }
}
function botao(g, x, y, w, h, txt, ativo, cor = '#facc15') {
  caixa(g, x, y, w, h, ativo ? cor : '#1e3a6e', ativo ? '#fff7d6' : '#4f7bc4', 4);
  texto(g, txt, x + w / 2, y + h / 2 - 4, { tam: 8, align: 'center', color: ativo ? '#1c1300' : '#e6eefc' });
}

export class Lobby {
  constructor(app, datos = {}) {
    this.app = app; this.t = 0;
    this.entreno = datos.modo === 'entreno';
    const salvo = (this.entreno ? app.ajustes.lobbyEntreno : app.ajustes.lobby) ?? {};
    const n = this.entreno ? 2 : datos.n ?? salvo.n ?? 3;
    const meu = Math.max(0, ROSTER.findIndex(p => p.id === (app.ultimaSeleccion?.[0] != null ? ROSTER[app.ultimaSeleccion[0]]?.id : 'charmander')));
    const valido = k => (Number.isInteger(k) && k >= 0 && k < ROSTER.length ? k : azar());
    this.vagas = Array.from({ length: n }, (_, i) => ({ p: i === 0 ? meu : valido(salvo.vagas?.[i]?.p), aleatorio: !this.entreno && i > 0 && (salvo.vagas?.[i]?.aleatorio ?? false), shiny: i === 0 && !!salvo.shiny0 }));
    this.arena = salvo.arena ?? -1; // -1 = aleatória
    this.nivel = salvo.nivel ?? app.ajustes.nivel ?? 'normal';
    this.modo = datos.modo === 'duplas' || (!datos.modo && n === 4 && salvo.modo === 'duplas') ? 'duplas' : 'todos';
    this.lista = null; // vaga com a lista de Pokémon aberta
    this.escolha = null;
  }
  entrar() { for (const p of ROSTER) { this.app.bank.precargar(p.dex, ['Idle']); this.app.bank.retrato(p.dex); } }
  salvar() {
    const s = { n: this.vagas.length, vagas: this.vagas.map(v => ({ p: v.p, aleatorio: v.aleatorio })), arena: this.arena, nivel: this.nivel, modo: this.modo, shiny0: !!this.vagas[0].shiny };
    if (this.entreno) this.app.ajustes.lobbyEntreno = s; else this.app.ajustes.lobby = s;
    this.app.ajustes.nivel = this.nivel; this.app.guardarAjustes?.();
  }
  atras() { if (this.lista !== null) { this.lista = null; this.escolha = null; return; } sfx('volver'); this.app.ir('titulo', { menu: 'jugar' }); }
  abrirLista(i) {
    const v = this.vagas[i];
    this.lista = i;
    this.escolha = new Escolha({
      titulo: this.entreno && i === 1 ? 'PICK THE DUMMY' : `PICK P${i + 1}`, atual: v.aleatorio ? -1 : v.p, aleatorio: i > 0 && !this.entreno,
      alElegir: k => { if (k < 0) { v.aleatorio = true; v.p = azar(); } else { if (v.p !== k) v.shiny = false; v.p = k; v.aleatorio = false; } this.lista = null; this.escolha = null; },
      alFechar: () => { this.lista = null; this.escolha = null; },
    });
  }
  // botão de shiny da vaga (só aparece se o shiny daquele Pokémon já saiu para você)
  posShiny(i) { const c = this.posCard(i); return { x: c.x + 100, y: c.y + c.h - 20, w: 56, h: 15 }; }
  temShiny(i) { const v = this.vagas[i]; return i === 0 && !v.aleatorio && shinyLiberado(ROSTER[v.p].id); }
  posCard(i) { return { x: CARD.x[i % 2], y: CARD.y[Math.floor(i / 2)], w: CARD.w, h: CARD.h }; }

  lutar() {
    const ids = this.vagas.map(v => ROSTER[v.aleatorio ? azar() : v.p].id), n = ids.length;
    const arena = this.arena < 0 ? ARENAS[Math.floor(Math.random() * ARENAS.length)].id : ARENAS[this.arena].id;
    this.salvar(); this.app.ultimaSeleccion = [this.vagas[0].p]; sfx('confirmar');
    const base = { p1: ids[0], p2: ids[1], p3: ids[2] ?? null, p4: ids[3] ?? null, arena, nivel: this.nivel, shinyQuer: [this.temShiny(0) && this.vagas[0].shiny] };
    if (this.entreno) return this.app.ir('combate', { ...base, modo: 'entreno' });
    if (n === 4 && this.modo === 'duplas') return this.app.ir('combate', { ...base, modo: 'duplas', equipos: [0, 1, 0, 1] });
    return this.app.ir('combate', { ...base, modo: n === 2 ? 'cpu' : 'arena' });
  }

  puntero(tipo, p) {
    if (this.escolha) return this.escolha.puntero(tipo, p);
    if (tipo !== 'down') return;
    const em = (c) => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h;
    if (em({ x: 4, y: 4, w: 70, h: 18 })) return this.atras();
    let tocou = false;
    this.vagas.forEach((v, i) => {
      const c = this.posCard(i);
      if (tocou || !em(c)) return;
      tocou = true;
      const lx = p.x - c.x, ly = p.y - c.y;
      if (this.temShiny(i) && em(this.posShiny(i))) { v.shiny = !v.shiny; sfx(v.shiny ? 'evoCarga' : 'seleccion'); return; }
      if (!this.entreno && i > 0 && this.vagas.length > 2 && lx > c.w - 18 && ly < 16) { this.vagas.splice(i, 1); if (this.vagas.length < 4) this.modo = 'todos'; sfx('volver'); return; }
      if (ly > c.h - 22 && lx > c.w - 96) { if (i > 0 && !this.entreno) { v.aleatorio = !v.aleatorio; if (v.aleatorio) v.p = azar(); sfx('seleccion'); } return; }
      if (lx < 18 || lx > c.w - 18) { const d = lx < 18 ? -1 : 1; v.p = (v.p + d + ROSTER.length) % ROSTER.length; v.aleatorio = false; v.shiny = false; sfx('seleccion'); return; }
      this.abrirLista(i); sfx('seleccion');
    });
    if (tocou) return;
    // vaga vazia: adiciona CPU
    if (!this.entreno && this.vagas.length < 4) { const c = this.posCard(this.vagas.length); if (em(c)) { this.vagas.push({ p: azar(), aleatorio: false }); sfx('confirmar'); } }
    // arena
    for (let i = -1; i < ARENAS.length; i++) if (em(this.posArena(i))) { this.arena = i; sfx('seleccion'); }
    if (this.entreno) { if (em(this.posLutar())) this.lutar(); return; }
    NIVEIS.forEach(([id], k) => { if (em(this.posNivel(k))) { this.nivel = id; sfx('seleccion'); } });
    if (em(this.posModo(0))) { this.modo = 'todos'; sfx('seleccion'); }
    if (em(this.posModo(1))) { if (this.vagas.length === 4) { this.modo = 'duplas'; sfx('seleccion'); } else { while (this.vagas.length < 4) this.vagas.push({ p: azar(), aleatorio: false }); this.modo = 'duplas'; sfx('seleccion'); } }
    if (em(this.posLutar())) this.lutar();
  }
  tecla(c, nova) {
    if (this.escolha) return this.escolha.tecla(c, nova);
    if (!nova) return;
    if (c === 'Escape' || c === 'Backspace') return this.atras();
    if (c === 'Enter' || c === 'Space') this.lutar();
    if (c === 'KeyP' || c === 'Tab') this.abrirLista(0);
  }
  posArena(i) { return { x: 80 + (i + 1) * 64, y: 228, w: 60, h: 16 }; }
  posNivel(k) { return { x: 80 + k * 64, y: 250, w: 60, h: 16 }; }
  posModo(k) { return { x: 80 + k * 100, y: 272, w: 96, h: 16 }; }
  posLutar() { return { x: 500, y: 300, w: 124, h: 26 }; }


  actualizar(dt) { this.t += dt; }

  dibujar(g) {
    const W = 640, bank = this.app.bank;
    // fundo azul com pontinhos, como o site
    g.fillStyle = '#1b3a72'; g.fillRect(-200, 0, W + 400, ALTO);
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let y = 6; y < ALTO; y += 12) for (let x = -196; x < W + 200; x += 12) g.fillRect(x, y, 2, 2);
    botao(g, 4, 4, 70, 18, '< MENU', false);
    texto(g, this.entreno ? 'TRAINING' : 'ARENA', W / 2, 6, { tam: 16, align: 'center', color: '#facc15', borde: 2 });
    if (this.escolha) return this.escolha.dibujar(g, bank, this.t);
    this.vagas.forEach((v, i) => this.dibujarCard(g, v, i, bank));
    if (this.entreno) {
      texto(g, 'ARENA', 14, 231, { tam: 8, color: '#9fc0f0' });
      botao(g, ...Object.values(this.posArena(-1)), 'RANDOM', this.arena === -1);
      ARENAS.forEach((a, i) => botao(g, ...Object.values(this.posArena(i)), a.nombre.slice(0, 8), this.arena === i));
      const L = this.posLutar(); caixa(g, L.x, L.y, L.w, L.h, '#facc15', '#fff7d6', 6); texto(g, 'TRAIN!', L.x + L.w / 2, L.y + 7, { tam: 12, align: 'center', color: '#1c1300' });
      texto(g, 'TAP A CARD TO PICK YOUR POKÉMON OR THE DUMMY · NO TIMER', W / 2, 340, { tam: 6, align: 'center', color: '#9fc0f0' });
      return;
    }
    if (this.vagas.length < 4) { const c = this.posCard(this.vagas.length); g.setLineDash([5, 4]); caixa(g, c.x, c.y, c.w, c.h, 'rgba(10,25,60,0.4)', '#4f7bc4'); g.setLineDash([]); texto(g, '+ ADD CPU', c.x + c.w / 2, c.y + c.h / 2 - 6, { tam: 12, align: 'center', color: '#9fc0f0' }); }
    texto(g, 'ARENA', 14, 231, { tam: 8, color: '#9fc0f0' });
    botao(g, ...Object.values(this.posArena(-1)), 'RANDOM', this.arena === -1);
    ARENAS.forEach((a, i) => botao(g, ...Object.values(this.posArena(i)), a.nombre.slice(0, 8), this.arena === i));
    texto(g, 'CPU', 14, 253, { tam: 8, color: '#9fc0f0' });
    NIVEIS.forEach(([id, nome], k) => botao(g, ...Object.values(this.posNivel(k)), nome, this.nivel === id));
    texto(g, 'MODE', 14, 275, { tam: 8, color: '#9fc0f0' });
    botao(g, ...Object.values(this.posModo(0)), 'FREE FOR ALL', this.modo === 'todos');
    botao(g, ...Object.values(this.posModo(1)), '2 VS 2', this.modo === 'duplas');
    const L = this.posLutar(), pul = 1 + Math.sin(this.t * 5) * 0.03;
    g.save(); g.translate(L.x + L.w / 2, L.y + L.h / 2); g.scale(pul, pul); g.translate(-(L.x + L.w / 2), -(L.y + L.h / 2));
    caixa(g, L.x, L.y, L.w, L.h, '#facc15', '#fff7d6', 6); texto(g, 'FIGHT!', L.x + L.w / 2, L.y + 7, { tam: 12, align: 'center', color: '#1c1300' }); g.restore();
    texto(g, this.modo === 'duplas' ? 'P1 + P3  VS  P2 + P4' : `${this.vagas.length} FIGHTERS · LAST ONE STANDING WINS`, 14, 306, { tam: 8, color: '#e6eefc' });
    texto(g, 'TAP A POKÉMON TO PICK ANOTHER · X REMOVES · RANDOM = NEW POKÉMON EVERY FIGHT', W / 2, 340, { tam: 6, align: 'center', color: '#9fc0f0' });
  }

  dibujarCard(g, v, i, bank) {
    const c = this.posCard(i), def = ROSTER[v.p], cor = CORES[i];
    caixa(g, c.x, c.y, c.w, c.h, '#16223f', cor, 6);
    g.fillStyle = cor; g.fillRect(c.x + 1, c.y + 1, c.w - 2, 13);
    texto(g, `P${i + 1} · ${i === 0 ? 'YOU' : this.entreno ? 'DUMMY' : 'CPU'}`, c.x + 6, c.y + 2, { tam: 8, color: '#ffffff' });
    if (!this.entreno && i > 0 && this.vagas.length > 2) { g.fillStyle = '#7f1d1d'; g.fillRect(c.x + c.w - 16, c.y + 2, 12, 10); texto(g, 'X', c.x + c.w - 10, c.y + 2, { tam: 8, align: 'center', color: '#fecaca' }); }
    // setas
    texto(g, '<', c.x + 6, c.y + 38, { tam: 12, color: '#facc15' }); texto(g, '>', c.x + c.w - 14, c.y + 38, { tam: 12, color: '#facc15' });
    // pedestal e sprite
    const px = c.x + 64, py = c.y + 66;
    g.fillStyle = '#0b1530'; g.beginPath(); g.ellipse(px, py, 30, 7, 0, 0, 7); g.fill(); g.strokeStyle = cor; g.lineWidth = 2; g.stroke();
    if (v.aleatorio) texto(g, '?', px, py - 34, { tam: 24, align: 'center', color: '#facc15', borde: 2 });
    else bank.dibujar(g, v.shiny && this.temShiny(i) ? def.dex + 's' : def.dex, 'Idle', this.t + i, px, py, 1.25, { fila: 0 });
    // nome, tipos e papel
    const tx = c.x + 112;
    texto(g, v.aleatorio ? 'RANDOM' : def.nombre, tx, c.y + 20, { tam: 12, color: '#ffffff' });
    if (!v.aleatorio) {
      let y = c.y + 38;
      for (const tp of def.tipos) { const w = 8 + tp.length * 5; g.fillStyle = hex(TIPOS[tp] ?? 0x888888); g.fillRect(tx, y, w, 10); texto(g, tp, tx + 4, y + 1, { tam: 6, color: '#ffffff' }); y += 12; }
      const rol = ROLES[def.rol]; if (rol) { const w = 8 + rol.nombre.length * 5; g.fillStyle = hex(rol.color); g.fillRect(tx, y, w, 10); texto(g, rol.nombre, tx + 4, y + 1, { tam: 6, color: '#ffffff' }); }
    }
    // controles de baixo
    botao(g, c.x + 34, c.y + c.h - 20, 60, 15, i === 0 ? 'YOU' : this.entreno ? 'DUMMY' : 'CPU', i === 0);
    if (i > 0 && !this.entreno) botao(g, c.x + c.w - 94, c.y + c.h - 20, 80, 15, 'RANDOM', v.aleatorio);
    if (this.temShiny(i)) { const b = this.posShiny(i); botao(g, b.x, b.y, b.w, b.h, 'SHINY', !!v.shiny, '#ffe27a'); }
  }

}
centrada(Lobby);
