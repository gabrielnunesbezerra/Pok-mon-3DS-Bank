// Quem manda no lutador: teclado e mouse (jogador 1), teclado do jogador 2, controle (gamepad) e toque.
import { temDormindo } from './engine/formasNovas.js';
import { ANCHO, ALTO, HUD_ALTO, UI, hex } from './config.js';
import { marco, rect, texto } from './render/pixel.js';
import { icono, tono } from './render/iconos.js';
import { TIPOS } from './data/regras.js';

export const CONTROLES = {
  kbm: { mover: 'WASD', lmb: 'LMB', rmb: 'RMB', esp: 'SPC', q: 'Q', e: 'E', mega: 'F' },
  tactil: { mover: 'Stick', lmb: 'ATK', rmb: 'SKL', esp: 'DASH', q: 'UTIL', e: 'ULT', mega: 'EVO' },
  teclado2: { mover: 'Arrows', lmb: 'K', rmb: 'L', esp: '↵', q: 'I', e: 'O', mega: 'P' },
};
export const nombreTecla = c => ({ Space: 'SPC', Enter: 'ENTER', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', NumpadAdd: 'NUM+', NumpadEnter: 'NUM ENTER' }[c] ?? c.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'NUM'));

const rgba = (c, a) => { const n = parseInt(c.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const VACIO = () => ({ mx: 0, my: 0, ax: 0, ay: 0, lmb: false, rmb: false, esp: false, q: false, e: false, mega: false });

// teclas de cada jogador (dá para trocar na tela CONTROLS; ficam salvas nos ajustes)
export const ACOES = [['up', 'UP'], ['down', 'DOWN'], ['left', 'LEFT'], ['right', 'RIGHT'], ['lmb', 'BASIC'], ['rmb', 'SKILL'], ['esp', 'DASH'], ['q', 'UTILITY'], ['e', 'ULTIMATE'], ['mega', 'EVOLVE']];
export const TECLAS_PADRAO = {
  p1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', lmb: 'KeyG', rmb: 'KeyH', esp: 'Space', q: 'KeyQ', e: 'KeyE', mega: 'KeyF' },
  p2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', lmb: 'KeyK', rmb: 'KeyL', esp: 'Enter', q: 'KeyI', e: 'KeyO', mega: 'KeyP' },
  p3: { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', lmb: 'Numpad1', rmb: 'Numpad2', esp: 'Numpad0', q: 'Numpad3', e: 'NumpadAdd', mega: 'NumpadEnter' },
};
export const teclasDe = (app, j) => ({ ...TECLAS_PADRAO[j], ...(app.ajustes?.teclas?.[j] ?? {}) });
// dispositivo de cada jogador: P1 'kbm' (teclado + mouse), 'teclado' (só teclado, mira automática), 'pad0'/'pad1'; P2 'teclado2', 'pad0', 'pad1'
const PADS = [['pad0', 'GAMEPAD 1'], ['pad1', 'GAMEPAD 2'], ['pad2', 'GAMEPAD 3']];
export const ENTRADAS = { p1: [['kbm', 'KEYS + MOUSE'], ['teclado', 'KEYBOARD'], ...PADS], p2: [['teclado2', 'KEYBOARD'], ...PADS], p3: [['teclado3', 'NUMPAD'], ...PADS] };
export const entradaDe = (app, j) => app.ajustes?.entrada?.[j] ?? ({ p1: 'kbm', p2: 'teclado2', p3: 'teclado3' }[j]);
const PAD = { lmb: 'X', rmb: 'B', esp: 'A', q: 'Y', e: 'RT', mega: 'LB' };
// nomes das teclas para a barra de skills do HUD
export function etiquetasDe(app, esquema) {
  if (esquema === 'tactil') return CONTROLES.tactil;
  if (/^pad\d$/.test(esquema)) return { mover: 'L-Stick', ...PAD };
  const k = teclasDe(app, esquema === 'teclado2' ? 'p2' : esquema === 'teclado3' ? 'p3' : 'p1'), n = nombreTecla;
  const r = { mover: `${n(k.up)}${n(k.left)}${n(k.down)}${n(k.right)}`, lmb: n(k.lmb), rmb: n(k.rmb), esp: n(k.esp), q: n(k.q), e: n(k.e), mega: n(k.mega) };
  if (esquema === 'kbm') { r.lmb = 'LMB'; r.rmb = 'RMB'; }
  return r;
}

export class ControlHumano {
  // esquema: 'kbm' (teclado + mouse), 'teclado' (só teclado do P1), 'teclado2' (teclado do P2), 'pad0'/'pad1' (controle), 'tactil'
  // comPad: no jogo de um jogador só, o controle 1 também vale junto com o teclado
  constructor(app, luta, l, esquema, camara, comPad = false) {
    this.app = app; this.luta = luta; this.l = l; this.esquema = esquema; this.camara = camara; this.tactil = null; this.comPad = comPad;
    this.ultimoMouse = -9;
    l.humano = true;
  }
  intento() {
    const l = this.l, ent = this.app.entrada, r = l.rival;
    const it = VACIO();
    const mira = () => { it.ax = r ? r.x : l.x + 100; it.ay = r ? r.y : l.y; };
    const teclado = j => {
      const k = teclasDe(this.app, j), a = c => ent.abajo(c);
      it.mx = (a(k.right) ? 1 : 0) - (a(k.left) ? 1 : 0); it.my = (a(k.down) ? 1 : 0) - (a(k.up) ? 1 : 0);
      it.lmb = a(k.lmb); it.rmb = a(k.rmb); it.esp = a(k.esp); it.q = a(k.q); it.e = a(k.e); it.mega = a(k.mega);
    };
    // celular que não foi reconhecido como toque no começo da luta: assim que há toque, vale o esquema de toque
    const esquema = this.esquema === 'kbm' && this.app.tactil?.activo ? 'tactil' : this.esquema;
    let padI = /^pad\d$/.test(esquema) ? +esquema[3] : this.comPad ? 0 : -1;
    if (esquema === 'kbm') {
      teclado('p1');
      it.lmb ||= ent.ptr.izq; it.rmb ||= ent.ptr.der;
      if (!ent.ptr.fuera && this.camara) { const p = this.camara.aMundo(ent.ptr.x, ent.ptr.y); it.ax = p.x; it.ay = p.y; this.hayMouse = true; }
      else mira();
    } else if (esquema === 'teclado') { teclado('p1'); mira(); }
    else if (esquema === 'teclado2') { teclado('p2'); mira(); }
    else if (esquema === 'teclado3') { teclado('p3'); mira(); }
    else if (esquema === 'tactil') {
      const s = this.app.tactil?.estado ?? VACIO();
      Object.assign(it, s);
      mira();
      if (s.apunta) { it.ax = l.x + s.apunta.x * 220; it.ay = l.y + s.apunta.y * 220; }
    } else mira();
    const pad = padI >= 0 ? ent.mando(padI) : null;
    if (pad) {
      const dz = v => (Math.abs(v) > 0.2 ? v : 0);
      const px = dz(pad.axes[0]), py = dz(pad.axes[1]);
      if (px || py) { it.mx = px; it.my = py; }
      const rx = pad.axes[2] ?? 0, ry = pad.axes[3] ?? 0;
      if (Math.hypot(rx, ry) > 0.35) { it.ax = l.x + rx * 200; it.ay = l.y + ry * 200; } else if (esquema !== 'kbm' || ent.ptr.fuera) mira();
      const b = i => pad.buttons[i]?.pressed;
      it.lmb ||= b(2) || b(7); it.rmb ||= b(1) || b(5); it.esp ||= b(0); it.q ||= b(3); it.e ||= b(7) && b(6) || b(4) && b(5); it.mega ||= b(4);
    }
    const m = Math.hypot(it.mx, it.my);
    if (m > 1) { it.mx /= m; it.my /= m; }
    return it;
  }
}

// Controles de toque: analógico que aparece onde o dedo encosta (metade esquerda) e botões de vidro em arco em volta
// do ataque, no canto direito. Translúcidos para não esconder a luta; a mira é automática no rival.
const SLOTS = {
  lmb: { dx: 0, dy: 0, r: 25, rot: 'ATK' },
  rmb: { dx: -64, dy: 2, r: 18, rot: 'SKILL' },
  q: { dx: -45, dy: -46, r: 18, rot: 'UTIL' },
  e: { dx: 2, dy: -64, r: 19, rot: 'ULT' },
  esp: { dx: -110, dy: 8, r: 15, rot: 'DASH' },
  mega: { dx: -48, dy: -104, r: 15, rot: 'EVO' },
};

// Layout personalizável: deslocamentos em relação à posição padrão, tamanho e se o analógico fica fixo
const CLAVE_LAYOUT = 'pkconfront.layout2';
const LAYOUT0 = () => ({ fijo: false, escala: 1, stick: { x: 0, y: 0 }, b: {} });
const cargarLayout = () => {
  try { const l = JSON.parse(localStorage.getItem(CLAVE_LAYOUT)); return l ? { ...LAYOUT0(), ...l, stick: { ...LAYOUT0().stick, ...l.stick }, b: { ...l.b } } : LAYOUT0(); } catch { return LAYOUT0(); }
};

export class PanelTactil {
  constructor(app) {
    this.app = app; this.toques = new Map(); this.estado = VACIO();
    // em celular (ponteiro "grosso") o modo toque já nasce ligado, antes de qualquer toque na tela
    this.activo = !!globalThis.matchMedia?.('(pointer: coarse)').matches;
    this.l = null; this.alPausa = null; this.extras = [];
    this.lay = cargarLayout(); this.editando = false;
    this.stick = { cx: 70, cy: ALTO - 70, r: 30, x0: 70, y0: ALTO - 70 };
    this.botones = Object.entries(SLOTS).map(([id, s]) => ({ id, r: s.r, x: 0, y: 0, txt: s.rot }));
    this.pausa = { id: 'pausa', x: 0, y: HUD_ALTO + 14, r: 11 };
    this.colocar();
    const c = app.canvas;
    const abajo = e => {
      if (e.pointerType !== 'touch' || this.editando) return;
      this.activo = true;
      const p = app.aCoord(e.clientX, e.clientY);
      this.toques.set(e.pointerId, { ...p, x0: p.x, y0: p.y, stick: false });
      this.clasificar(this.toques.get(e.pointerId));
    };
    const mueve = e => { const t = this.toques.get(e.pointerId); if (t) Object.assign(t, app.aCoord(e.clientX, e.clientY)); };
    const suelta = e => { this.toques.delete(e.pointerId); };
    c.addEventListener('pointerdown', abajo); c.addEventListener('pointermove', mueve);
    c.addEventListener('pointerup', suelta); c.addEventListener('pointercancel', suelta);
  }
  // posição padrão de cada botão (ancorada na borda direita, acompanha a largura da tela) sem o ajuste do jogador
  defecto(id) {
    const k = this.lay.escala, ax = ANCHO - 44, ay = ALTO - 42;
    if (id === 'stick') return { x: 70, y: ALTO - 70 };
    const s = SLOTS[id];
    return { x: ax + s.dx * k, y: ay + s.dy * k };
  }
  colocar() {
    const k = this.lay.escala;
    for (const b of this.botones) {
      const d = this.defecto(b.id), o = this.lay.b[b.id] ?? { x: 0, y: 0 };
      b.r = SLOTS[b.id].r * k;
      b.x = Math.max(b.r + 2, Math.min(ANCHO - b.r - 2, d.x + o.x));
      b.y = Math.max(HUD_ALTO + b.r + 2, Math.min(ALTO - b.r - 2, d.y + o.y));
    }
    this.pausa.x = ANCHO - 20;
    const st = this.stick, d = this.defecto('stick'), o = this.lay.stick;
    st.r = 30 * k;
    st.x0 = Math.max(st.r + 2, Math.min(ANCHO - st.r - 2, d.x + o.x));
    st.y0 = Math.max(HUD_ALTO + st.r + 2, Math.min(ALTO - st.r - 2, d.y + o.y));
    if (this.lay.fijo) { st.cx = st.x0; st.cy = st.y0; }
  }
  guardarLayout() { try { localStorage.setItem(CLAVE_LAYOUT, JSON.stringify(this.lay)); } catch { /* sem armazenamento */ } }
  restaurarLayout() { this.lay = LAYOUT0(); this.guardarLayout(); }
  botonEn(t, extra = 12) {
    let mejor = null, dm = Infinity;
    for (const b of [...this.botones, this.pausa]) {
      if (b.id === 'mega' && !this.mostrarMega()) continue;
      if (b.id === 'e' && this.l?.kit?.e?.sinUlti && !this.editando) continue;
      const d = Math.hypot(t.x - b.x, t.y - b.y);
      if (d < b.r + extra && d < dm) { mejor = b; dm = d; }
    }
    return mejor;
  }
  mostrarMega() { return this.editando || !!this.l && (this.l.puedeMega || this.l.puedeEvolucionar); }
  clasificar(t) {
    this.colocar();
    const b = this.botonEn(t);
    if (b?.id === 'pausa') { t.boton = 'pausa'; this.alPausa?.(); return; }
    const ex = this.extras.find(e => t.x >= e.x - 4 && t.x <= e.x + e.w + 4 && t.y >= e.y - 4 && t.y <= e.y + e.h + 4);
    if (ex) { t.boton = 'extra'; ex.al(); return; }
    if (b) { t.boton = b.id; return; }
    if (this.lay.fijo) {
      // analógico fixo: a base nunca anda; vale tocar perto dela
      if (Math.hypot(t.x - this.stick.x0, t.y - this.stick.y0) < this.stick.r * 2.6) t.stick = true;
    } else if (t.x < ANCHO * 0.45) {
      t.stick = true;
      this.stick.cx = Math.max(40, Math.min(ANCHO * 0.4, t.x));
      this.stick.cy = Math.max(HUD_ALTO + 40, Math.min(ALTO - 36, t.y));
    }
  }
  actualizar() {
    this.colocar();
    const e = VACIO(), s = this.stick;
    this.stickActivo = false;
    for (const t of this.toques.values()) {
      if (t.stick) {
        this.stickActivo = true;
        const dx = t.x - s.cx, dy = t.y - s.cy, d = Math.hypot(dx, dy);
        // quem arrasta além do raio leva a base junto, o dedo nunca "sai" do analógico
        if (!this.lay.fijo && d > s.r * 1.5) { const k = (d - s.r * 1.5) / d; s.cx += dx * k; s.cy += dy * k; }
        const d2 = Math.hypot(t.x - s.cx, t.y - s.cy);
        if (d2 > 7) { const k = Math.min(1, (d2 - 7) / (s.r - 7)); e.mx = ((t.x - s.cx) / d2) * k; e.my = ((t.y - s.cy) / d2) * k; }
      } else {
        // o dedo que começou num botão continua nele mesmo ao arrastar; arrastar para fora do centro mira
        const fijo = t.boton && t.boton !== 'pausa' && t.boton !== 'extra' ? this.botones.find(x => x.id === t.boton) : null;
        const b = fijo ?? this.botonEn(t, 16);
        if (b && b.id !== 'pausa') {
          t.boton = b.id; e[b.id] = true;
          // só mira à mão quem ARRASTA o dedo (16 px desde onde tocou); um toque simples, mesmo na borda do
          // botão, mira sozinho no rival
          const dx = t.x - b.x, dy = t.y - b.y, d = Math.hypot(dx, dy), arrasto = Math.hypot(t.x - (t.x0 ?? t.x), t.y - (t.y0 ?? t.y));
          if (arrasto > 16 && d > 10) e.apunta = { x: dx / d, y: dy / d, id: b.id };
        }
      }
    }
    if (this.lay.fijo) { s.cx = s.x0; s.cy = s.y0; }
    else if (!this.stickActivo) { s.cx += (s.x0 - s.cx) * 0.2; s.cy += (s.y0 - s.cy) * 0.2; }
    this.estado = e;
  }

  dibujar(g, t = 0) {
    if (!this.activo && !this.editando) return;
    this.colocar();
    const s = this.stick, l = this.l, usado = this.stickActivo || this.editando;
    // analógico: parado é só um contorno quase invisível; com o dedo, base de vidro e bolinha
    g.save();
    g.globalAlpha = usado ? 0.9 : 0.22;
    g.fillStyle = 'rgba(8,14,30,0.35)'; g.beginPath(); g.arc(s.cx, s.cy, s.r, 0, 7); g.fill();
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(220,236,255,0.7)'; g.stroke();
    if (usado) {
      const ang = Math.atan2(this.estado.my, this.estado.mx), forca = Math.hypot(this.estado.mx, this.estado.my);
      if (forca > 0.1) { g.lineWidth = 3; g.strokeStyle = 'rgba(125,211,252,0.9)'; g.beginPath(); g.arc(s.cx, s.cy, s.r, ang - 0.5, ang + 0.5); g.stroke(); }
      const kx = s.cx + this.estado.mx * s.r * 0.6, ky = s.cy + this.estado.my * s.r * 0.6;
      const knob = g.createRadialGradient(kx - 3, ky - 3, 1, kx, ky, 12);
      knob.addColorStop(0, 'rgba(255,255,255,0.95)'); knob.addColorStop(1, 'rgba(160,200,240,0.75)');
      g.fillStyle = knob; g.beginPath(); g.arc(kx, ky, 11, 0, 7); g.fill();
    }
    g.restore();
    // botões
    for (const b of this.botones) {
      if (b.id === 'mega' && !this.mostrarMega()) continue;
      if (b.id === 'e' && this.l?.kit?.e?.sinUlti && !this.editando) continue;
      this.boton(g, b, l, t);
    }
    this.botonPausa(g);
    for (const e of this.extras) {
      g.save(); g.globalAlpha = 0.8;
      g.fillStyle = 'rgba(8,14,30,0.5)'; g.beginPath(); g.roundRect(e.x, e.y, e.w, e.h, 8); g.fill();
      g.lineWidth = 1; g.strokeStyle = 'rgba(220,236,255,0.6)'; g.stroke(); g.restore();
      texto(g, e.txt(), e.x + e.w / 2, e.y + e.h / 2, { tam: 7, align: 'center', base: 'middle', color: '#e8f6ff', borde: 2 });
    }
  }

  // botão de vidro: fundo escuro translúcido, aro fino na cor do tipo, símbolo branco; recarga gira por dentro
  boton(g, b, l, t) {
    const id = b.id, on = !!this.estado[id];
    const h = l && id !== 'mega' ? l.kit[id] : null;
    const cdMax = h?.cd || 1, cd = l && id !== 'mega' ? l.cd[id] ?? 0 : 0;
    const esUlti = id === 'e';
    const sobre = id === 'lmb' && l && l.luta && l.luta.t < l.sobrecargaHasta;
    const sinEn = !!h && !esUlti && id !== 'lmb' && l.energia < (h.coste ?? h.energia ?? 0);
    const ultiOk = esUlti ? l?.ultiLista : true;
    const semSono = (h?.forma === 'teleSono' && l?.luta && !temDormindo(l.luta, l, h.alcance)) || (h?.forma === 'xFolha' && !l?.xListo) || (h?.requierePlasma && (l?.plasma ?? 0) < 100);
    const lista = !sobre && !sinEn && ultiOk && !semSono && !(cd > 0 && cdMax > 1.2);
    const tipo = h?.tipo ?? 'NORMAL';
    let col = id === 'mega' ? (l?.puedeMega ? '#ffd23c' : '#46d6a0') : hex(TIPOS[tipo] ?? 0xa8a878);
    if (esUlti) col = '#ffcf4a';
    const forma = id === 'mega' ? (l?.puedeMega ? 'mega' : 'evo') : esUlti && !h?.forma ? 'ulti' : h?.forma ?? 'basico';
    const r = b.r * (on ? 0.92 : 1), x = b.x, y = b.y;
    const brilha = lista && (id === 'mega' || esUlti);
    g.save();
    // brilho de "pronto" (ult e mega) e de toque
    if (brilha || on) {
      const halo = g.createRadialGradient(x, y, r * 0.6, x, y, r + 9);
      halo.addColorStop(0, rgba(col, on ? 0.65 : 0.4)); halo.addColorStop(1, rgba(col, 0));
      g.globalAlpha = on ? 1 : 0.6 + 0.4 * Math.sin(t * 6);
      g.fillStyle = halo; g.beginPath(); g.arc(x, y, r + 9, 0, 7); g.fill();
    }
    // corpo de vidro
    g.globalAlpha = 1;
    const vidro = g.createLinearGradient(x, y - r, x, y + r);
    vidro.addColorStop(0, on ? 'rgba(40,60,100,0.62)' : 'rgba(30,40,70,0.42)'); vidro.addColorStop(1, on ? 'rgba(10,16,34,0.7)' : 'rgba(6,10,24,0.5)');
    g.fillStyle = vidro; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    // aro: cor do tipo quando pronto, cinza quando não
    g.lineWidth = id === 'lmb' ? 2.4 : 1.8;
    g.strokeStyle = lista ? col : 'rgba(150,160,180,0.55)';
    g.globalAlpha = lista ? 0.95 : 0.7;
    g.beginPath(); g.arc(x, y, r - 1, 0, 7); g.stroke();
    g.globalAlpha = 0.18; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y - r * 0.45, r * 0.6, r * 0.22, 0, 0, 7); g.fill();
    // símbolo
    g.globalAlpha = lista ? 0.95 : 0.45;
    icono(g, forma, x, y, r * 0.5, '#ffffff');
    g.globalAlpha = 1;
    // recarga: fatia escura que vai abrindo + segundos
    if (cd > 0 && cdMax > 0.01 && !esUlti) {
      const f = Math.min(1, cd / cdMax);
      g.fillStyle = 'rgba(2,6,16,0.55)'; g.beginPath(); g.moveTo(x, y); g.arc(x, y, r - 2, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); g.closePath(); g.fill();
      if (cdMax > 1.2) texto(g, cd >= 10 ? String(Math.ceil(cd)) : cd.toFixed(1), x, y, { tam: 7, align: 'center', base: 'middle', color: '#ffffff', borde: 2, peso: 700 });
    }
    // ultimate: anel de progresso dourado; aquecimento do básico em laranja
    if (esUlti && l) this.anel(g, x, y, r + 3, l.ulti / 100, l.ultiLista ? '#ffe27a' : '#c9a0ff');
    if (id === 'lmb' && l && l.calor > 6) this.anel(g, x, y, r + 3, Math.min(1, l.calor / 100), sobre ? '#ff3a2a' : '#ff9a2e');
    // custo sem energia: pontinho vermelho
    if (sinEn) { g.fillStyle = '#ff6a5a'; g.beginPath(); g.arc(x + r * 0.7, y - r * 0.7, 2.5, 0, 7); g.fill(); }
    g.restore();
  }
  anel(g, x, y, r, f, cor) {
    g.lineWidth = 2; g.strokeStyle = 'rgba(4,10,28,0.45)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
    if (f <= 0) return;
    g.lineCap = 'round'; g.strokeStyle = cor; g.beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.min(1, f) * Math.PI * 2); g.stroke(); g.lineCap = 'butt';
  }
  botonPausa(g) {
    const p = this.pausa;
    g.save();
    g.globalAlpha = 0.7;
    g.fillStyle = 'rgba(8,14,30,0.45)'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
    g.lineWidth = 1; g.strokeStyle = 'rgba(220,236,255,0.6)'; g.stroke();
    g.restore();
    icono(g, 'pausa', p.x, p.y, p.r * 0.5, '#e8f6ff');
  }
}
