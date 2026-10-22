// Quem manda no lutador: teclado e mouse (jogador 1), teclado do jogador 2, controle (gamepad) e toque.
import { ANCHO, ALTO, BARRA_Y, UI, hex } from './config.js';
import { marco, rect, texto } from './render/pixel.js';
import { icono, tono } from './render/iconos.js';
import { TIPOS } from './data/regras.js';

export const CONTROLES = {
  kbm: { mover: 'WASD', lmb: 'LMB', rmb: 'RMB', esp: 'SPC', q: 'Q', e: 'E', mega: 'F' },
  tactil: { mover: 'Stick', lmb: 'ATK', rmb: 'SKL', esp: 'DASH', q: 'UTIL', e: 'ULT', mega: 'EVO' },
  teclado2: { mover: 'Arrows', lmb: 'K', rmb: 'L', esp: '↵', q: 'I', e: 'O', mega: 'P' },
};
export const nombreTecla = c => ({ Space: 'SPC', Enter: 'ENTER', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[c] ?? c.replace(/^Key|^Digit/, ''));

const VACIO = () => ({ mx: 0, my: 0, ax: 0, ay: 0, lmb: false, rmb: false, esp: false, q: false, e: false, mega: false });

export class ControlHumano {
  // esquema: 'kbm' (WASD + mouse), 'teclado2' (setas + K L Enter I O P), 'pad' (controle), 'tactil'
  constructor(app, luta, l, esquema, camara) {
    this.app = app; this.luta = luta; this.l = l; this.esquema = esquema; this.camara = camara; this.tactil = null;
    this.ultimoMouse = -9;
    l.humano = true;
  }
  intento() {
    const l = this.l, ent = this.app.entrada, r = l.rival;
    const it = VACIO();
    const mira = () => { it.ax = r ? r.x : l.x + 100; it.ay = r ? r.y : l.y; };
    if (this.esquema === 'kbm') {
      it.mx = (ent.abajo('KeyD') ? 1 : 0) - (ent.abajo('KeyA') ? 1 : 0);
      it.my = (ent.abajo('KeyS') ? 1 : 0) - (ent.abajo('KeyW') ? 1 : 0);
      it.lmb = ent.ptr.izq || ent.abajo('KeyJ');
      it.rmb = ent.ptr.der || ent.abajo('KeyK');
      it.esp = ent.abajo('Space'); it.q = ent.abajo('KeyQ'); it.e = ent.abajo('KeyE'); it.mega = ent.abajo('KeyF') || ent.abajo('KeyR');
      if (!ent.ptr.fuera && this.camara) { const p = this.camara.aMundo(ent.ptr.x, ent.ptr.y); it.ax = p.x; it.ay = p.y; this.hayMouse = true; }
      else mira();
    } else if (this.esquema === 'teclado2') {
      it.mx = (ent.abajo('ArrowRight') ? 1 : 0) - (ent.abajo('ArrowLeft') ? 1 : 0);
      it.my = (ent.abajo('ArrowDown') ? 1 : 0) - (ent.abajo('ArrowUp') ? 1 : 0);
      it.lmb = ent.abajo('KeyK'); it.rmb = ent.abajo('KeyL'); it.esp = ent.abajo('Enter'); it.q = ent.abajo('KeyI'); it.e = ent.abajo('KeyO'); it.mega = ent.abajo('KeyP');
      mira();
    } else if (this.esquema === 'tactil') {
      const s = this.app.tactil?.estado ?? VACIO();
      Object.assign(it, s);
      mira();
      if (s.apunta) { it.ax = l.x + s.apunta.x * 220; it.ay = l.y + s.apunta.y * 220; }
    }
    // controle: funciona junto com qualquer esquema do jogador 1
    const pad = ent.mando(this.esquema === 'teclado2' ? 1 : 0);
    if (pad) {
      const dz = v => (Math.abs(v) > 0.2 ? v : 0);
      const px = dz(pad.axes[0]), py = dz(pad.axes[1]);
      if (px || py) { it.mx = px; it.my = py; }
      const rx = pad.axes[2] ?? 0, ry = pad.axes[3] ?? 0;
      if (Math.hypot(rx, ry) > 0.35) { it.ax = l.x + rx * 200; it.ay = l.y + ry * 200; } else if (this.esquema !== 'kbm' || ent.ptr.fuera) mira();
      const b = i => pad.buttons[i]?.pressed;
      it.lmb ||= b(2) || b(7); it.rmb ||= b(1) || b(5); it.esp ||= b(0); it.q ||= b(3); it.e ||= b(7) && b(6) || b(4) && b(5); it.mega ||= b(4);
    }
    const m = Math.hypot(it.mx, it.my);
    if (m > 1) { it.mx /= m; it.my /= m; }
    return it;
  }
}

// Controles de toque: analógico flutuante à esquerda e botões em arco à direita (a mira é automática no rival)
const SLOTS = {
  lmb: { dx: 0, dy: 0, r: 27, rot: 'ATK' },
  rmb: { dx: -58, dy: 14, r: 21, rot: 'SKILL' },
  esp: { dx: -48, dy: -46, r: 19, rot: 'DASH' },
  q: { dx: -100, dy: -30, r: 18, rot: 'UTIL' },
  e: { dx: -6, dy: -74, r: 20, rot: 'ULT' },
  mega: { dx: -104, dy: -76, r: 20, rot: 'EVO' },
};

export class PanelTactil {
  constructor(app) {
    this.app = app; this.toques = new Map(); this.estado = VACIO();
    // em celular (ponteiro "grosso") o modo toque já nasce ligado, antes de qualquer toque na tela
    this.activo = !!globalThis.matchMedia?.('(pointer: coarse)').matches;
    this.l = null; this.alPausa = null; this.extras = [];
    this.stick = { cx: 62, cy: 284, r: 34, x0: 62, y0: 284 };
    this.botones = Object.entries(SLOTS).map(([id, s]) => ({ id, r: s.r, x: 0, y: 0, txt: s.rot }));
    this.pausa = { id: 'pausa', x: 0, y: 66, r: 12 };
    this.colocar();
    const c = app.canvas;
    const abajo = e => {
      if (e.pointerType !== 'touch') return;
      this.activo = true;
      const p = app.aCoord(e.clientX, e.clientY);
      this.toques.set(e.pointerId, { ...p, stick: false });
      this.clasificar(this.toques.get(e.pointerId));
    };
    const mueve = e => { const t = this.toques.get(e.pointerId); if (t) Object.assign(t, app.aCoord(e.clientX, e.clientY)); };
    const suelta = e => { this.toques.delete(e.pointerId); };
    c.addEventListener('pointerdown', abajo); c.addEventListener('pointermove', mueve);
    c.addEventListener('pointerup', suelta); c.addEventListener('pointercancel', suelta);
  }
  // posições ancoradas na borda direita: acompanham a largura da tela
  colocar() {
    const W = ANCHO, ax = W - 52, ay = BARRA_Y - 46;
    for (const b of this.botones) { const s = SLOTS[b.id]; b.x = ax + s.dx; b.y = ay + s.dy; }
    this.pausa.x = W - 20;
    if (this.stick.x0 !== 62 || this.stick.y0 !== 284) { this.stick.x0 = 62; this.stick.y0 = 284; }
  }
  botonEn(t, extra = 12) {
    let mejor = null, dm = Infinity;
    for (const b of [...this.botones, this.pausa]) {
      if (b.id === 'mega' && !this.mostrarMega()) continue;
      const d = Math.hypot(t.x - b.x, t.y - b.y);
      if (d < b.r + extra && d < dm) { mejor = b; dm = d; }
    }
    return mejor;
  }
  mostrarMega() { return !!this.l && (this.l.puedeMega || this.l.puedeEvolucionar); }
  clasificar(t) {
    this.colocar();
    const b = this.botonEn(t);
    if (b?.id === 'pausa') { t.boton = 'pausa'; this.alPausa?.(); return; }
    const ex = this.extras.find(e => t.x >= e.x - 4 && t.x <= e.x + e.w + 4 && t.y >= e.y - 4 && t.y <= e.y + e.h + 4);
    if (ex) { t.boton = 'extra'; ex.al(); return; }
    if (b) { t.boton = b.id; return; }
    if (t.x < ANCHO * 0.45) {
      t.stick = true;
      this.stick.cx = Math.max(46, Math.min(ANCHO * 0.4, t.x));
      this.stick.cy = Math.max(110, Math.min(BARRA_Y - 52, t.y));
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
        if (d > s.r * 1.5) { const k = (d - s.r * 1.5) / d; s.cx += dx * k; s.cy += dy * k; }
        const d2 = Math.hypot(t.x - s.cx, t.y - s.cy);
        if (d2 > 7) { const k = Math.min(1, (d2 - 7) / (s.r - 7)); e.mx = ((t.x - s.cx) / d2) * k; e.my = ((t.y - s.cy) / d2) * k; }
      } else {
        // o dedo que começou num botão continua nele mesmo ao arrastar; arrastar para fora do centro mira
        const fijo = t.boton && t.boton !== 'pausa' && t.boton !== 'extra' ? this.botones.find(x => x.id === t.boton) : null;
        const b = fijo ?? this.botonEn(t, 16);
        if (b && b.id !== 'pausa') {
          t.boton = b.id; e[b.id] = true;
          const dx = t.x - b.x, dy = t.y - b.y, d = Math.hypot(dx, dy);
          if (d > 12) e.apunta = { x: dx / d, y: dy / d, id: b.id };
        }
      }
    }
    if (!this.stickActivo) { s.cx += (s.x0 - s.cx) * 0.2; s.cy += (s.y0 - s.cy) * 0.2; }
    this.estado = e;
  }

  dibujar(g, t = 0) {
    if (!this.activo) return;
    this.colocar();
    const s = this.stick, l = this.l;
    // analógico
    g.save();
    g.globalAlpha = this.stickActivo ? 0.8 : 0.38;
    const base = g.createRadialGradient(s.cx, s.cy, 6, s.cx, s.cy, s.r);
    base.addColorStop(0, 'rgba(20,50,100,0.55)'); base.addColorStop(1, 'rgba(10,30,70,0.85)');
    g.fillStyle = base; g.beginPath(); g.arc(s.cx, s.cy, s.r, 0, 7); g.fill();
    g.lineWidth = 3; g.strokeStyle = '#04102c'; g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = '#8fd3ff'; g.beginPath(); g.arc(s.cx, s.cy, s.r - 2, 0, 7); g.stroke();
    g.fillStyle = 'rgba(143,211,255,0.55)';
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.save(); g.translate(s.cx + Math.cos(a) * (s.r - 11), s.cy + Math.sin(a) * (s.r - 11)); g.rotate(a); g.beginPath(); g.moveTo(3, 0); g.lineTo(-3, -4); g.lineTo(-3, 4); g.fill(); g.restore(); }
    const kx = s.cx + this.estado.mx * s.r * 0.62, ky = s.cy + this.estado.my * s.r * 0.62;
    const knob = g.createRadialGradient(kx - 4, ky - 4, 2, kx, ky, 14);
    knob.addColorStop(0, '#d6f0ff'); knob.addColorStop(1, '#3d86d6');
    g.fillStyle = knob; g.beginPath(); g.arc(kx, ky, 13, 0, 7); g.fill();
    g.lineWidth = 2.5; g.strokeStyle = '#04102c'; g.stroke();
    g.restore();
    // botões
    for (const b of this.botones) {
      if (b.id === 'mega' && !this.mostrarMega()) continue;
      this.boton(g, b, l, t);
    }
    this.botonPausa(g);
    for (const e of this.extras) {
      g.save(); g.globalAlpha = 0.85;
      g.fillStyle = 'rgba(8,24,56,0.85)'; g.beginPath(); g.roundRect(e.x, e.y, e.w, e.h, 6); g.fill();
      g.lineWidth = 1.5; g.strokeStyle = '#8fd3ff'; g.stroke(); g.restore();
      texto(g, e.txt(), e.x + e.w / 2, e.y + e.h / 2, { tam: 7, align: 'center', base: 'middle', color: '#e8f6ff', borde: 2 });
    }
  }

  boton(g, b, l, t) {
    const id = b.id, on = !!this.estado[id];
    const h = l && id !== 'mega' ? l.kit[id] : null;
    const cdMax = h?.cd || 1, cd = l && id !== 'mega' ? l.cd[id] ?? 0 : 0;
    const esUlti = id === 'e';
    const sobre = id === 'lmb' && l && l.luta && l.luta.t < l.sobrecargaHasta;
    const sinEn = !!h && !esUlti && id !== 'lmb' && l.energia < (h.coste ?? h.energia ?? 0);
    const ultiOk = esUlti ? l?.ultiLista : true;
    const lista = !sobre && !sinEn && ultiOk && !(cd > 0 && cdMax > 1.2);
    const tipo = h?.tipo ?? 'NORMAL';
    let col = id === 'mega' ? (l?.puedeMega ? '#ffd23c' : '#46d6a0') : hex(TIPOS[tipo] ?? 0xa8a878);
    if (esUlti) col = '#ffb703';
    const forma = id === 'mega' ? (l?.puedeMega ? 'mega' : 'evo') : esUlti && !h?.forma ? 'ulti' : h?.forma ?? 'basico';
    const r = b.r * (on ? 0.93 : 1), x = b.x, y = b.y;
    const pulso = id === 'mega' || (esUlti && l?.ultiLista) ? 1 + 0.05 * Math.sin(t * 8) : 1;
    g.save();
    g.translate(x, y); g.scale(pulso, pulso); g.translate(-x, -y);
    // sombra e halo
    if (on || (lista && (esUlti || id === 'mega'))) { g.fillStyle = `rgba(255,226,122,${on ? 0.4 : 0.2})`; g.beginPath(); g.arc(x, y, r + 4, 0, 7); g.fill(); }
    // corpo: degradê do tipo
    const cuerpo = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
    if (lista) { cuerpo.addColorStop(0, tono(col, 0.35)); cuerpo.addColorStop(0.6, col); cuerpo.addColorStop(1, tono(col, -0.45)); }
    else { cuerpo.addColorStop(0, '#5b6678'); cuerpo.addColorStop(1, '#262d3b'); }
    g.globalAlpha = lista ? 0.72 : 0.6;
    g.fillStyle = cuerpo; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.lineWidth = 2; g.strokeStyle = '#04102c'; g.stroke();
    g.lineWidth = 1.2; g.strokeStyle = on ? '#fff6c8' : lista ? '#d6ecff' : '#7a8498'; g.beginPath(); g.arc(x, y, r - 1.6, 0, 7); g.stroke();
    // brilho de vidro
    g.globalAlpha = 0.22; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x - r * 0.18, y - r * 0.5, r * 0.55, r * 0.26, -0.3, 0, 7); g.fill();
    g.globalAlpha = 1;
    // símbolo
    icono(g, forma, x, y, r * 0.5, lista ? '#ffffff' : '#aab4c8');
    // recarga: fatia escura que vai girando + segundos
    if (cd > 0 && cdMax > 0.01 && !esUlti) {
      const f = Math.min(1, cd / cdMax);
      g.fillStyle = 'rgba(4,10,28,0.62)'; g.beginPath(); g.moveTo(x, y); g.arc(x, y, r - 1, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); g.closePath(); g.fill();
      if (cdMax > 1.2) texto(g, cd >= 10 ? String(Math.ceil(cd)) : cd.toFixed(1), x, y, { tam: 7, align: 'center', base: 'middle', color: '#ffe58a', borde: 3, peso: 700 });
    }
    // ultimate / experiência: anel de progresso
    if (esUlti && l) this.anel(g, x, y, r + 3.5, l.ulti / 100, l.ultiLista ? '#ffe27a' : '#e0a21a');
    if (id === 'mega' && l) this.anel(g, x, y, r + 3.5, 1, '#fff6c8');
    if (id === 'lmb' && l && l.calor > 6) this.anel(g, x, y, r + 3.5, Math.min(1, l.calor / 100), sobre ? '#ff3a2a' : '#ff9a2e');
    g.restore();
  }
  anel(g, x, y, r, f, cor) {
    g.lineWidth = 3; g.strokeStyle = 'rgba(4,16,44,0.8)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
    if (f <= 0) return;
    g.strokeStyle = cor; g.beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.min(1, f) * Math.PI * 2); g.stroke();
  }
  botonPausa(g) {
    const p = this.pausa;
    g.save();
    g.globalAlpha = 0.8;
    g.fillStyle = 'rgba(8,24,56,0.85)'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
    g.lineWidth = 2; g.strokeStyle = '#8fd3ff'; g.stroke();
    g.restore();
    icono(g, 'pausa', p.x, p.y, p.r * 0.5, '#e8f6ff');
  }
}
