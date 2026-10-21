// Quem manda no lutador: teclado e mouse (jogador 1), teclado do jogador 2, controle (gamepad) e toque.
import { ANCHO, ALTO, UI, hex } from './config.js';
import { marco, rect, texto } from './render/pixel.js';

export const CONTROLES = {
  kbm: { mover: 'WASD', lmb: 'LMB', rmb: 'RMB', esp: 'SPC', q: 'Q', e: 'E', mega: 'R' },
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
      it.esp = ent.abajo('Space'); it.q = ent.abajo('KeyQ'); it.e = ent.abajo('KeyE'); it.mega = ent.abajo('KeyR');
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

// Controles de toque: analógico à esquerda e botões à direita (a mira é automática no rival)
export class PanelTactil {
  constructor(app) {
    this.app = app; this.toques = new Map(); this.estado = VACIO(); this.activo = false;
    this.stick = { cx: 70, cy: 270, r: 40 };
    this.botones = [
      { id: 'lmb', x: 574, y: 292, r: 24, txt: 'ATK' },
      { id: 'rmb', x: 530, y: 318, r: 18, txt: 'SKL' },
      { id: 'esp', x: 612, y: 238, r: 16, txt: 'DASH' },
      { id: 'q', x: 524, y: 266, r: 16, txt: 'Q' },
      { id: 'e', x: 566, y: 238, r: 18, txt: 'ULT' },
      { id: 'mega', x: 480, y: 318, r: 14, txt: 'EVO' },
    ];
    const c = app.canvas;
    const abajo = e => { if (e.pointerType !== 'touch') return; this.activo = true; this.toques.set(e.pointerId, { ...app.aCoord(e.clientX, e.clientY), inicio: app.aCoord(e.clientX, e.clientY), stick: false }); this.clasificar(this.toques.get(e.pointerId)); };
    const mueve = e => { const t = this.toques.get(e.pointerId); if (!t) return; Object.assign(t, app.aCoord(e.clientX, e.clientY)); };
    const suelta = e => { this.toques.delete(e.pointerId); };
    c.addEventListener('pointerdown', abajo); c.addEventListener('pointermove', mueve);
    c.addEventListener('pointerup', suelta); c.addEventListener('pointercancel', suelta);
  }
  clasificar(t) { if (t.x < ANCHO * 0.42) { t.stick = true; this.stick.cx = Math.max(54, Math.min(ANCHO * 0.4, t.x)); this.stick.cy = Math.max(120, Math.min(ALTO - 44, t.y)); } }
  actualizar() {
    const e = VACIO(), s = this.stick;
    for (const t of this.toques.values()) {
      if (t.stick) { const dx = t.x - s.cx, dy = t.y - s.cy, d = Math.hypot(dx, dy); if (d > 6) { const k = Math.min(1, d / s.r); e.mx = (dx / d) * k; e.my = (dy / d) * k; } }
      else for (const b of this.botones) if (Math.hypot(t.x - b.x, t.y - b.y) < b.r + 8) e[b.id] = true;
    }
    this.estado = e;
  }
  dibujar(g) {
    if (!this.activo) return;
    const s = this.stick;
    g.globalAlpha = 0.35; g.fillStyle = '#04102c'; g.beginPath(); g.arc(s.cx, s.cy, s.r, 0, 7); g.fill();
    g.strokeStyle = '#8fd3ff'; g.lineWidth = 2; g.stroke();
    g.globalAlpha = 0.7; g.fillStyle = '#8fd3ff'; g.beginPath(); g.arc(s.cx + this.estado.mx * s.r * 0.6, s.cy + this.estado.my * s.r * 0.6, 14, 0, 7); g.fill();
    for (const b of this.botones) {
      const on = this.estado[b.id];
      g.globalAlpha = on ? 0.85 : 0.45; g.fillStyle = on ? '#f8c448' : '#225697'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill();
      g.strokeStyle = '#04102c'; g.lineWidth = 2; g.stroke();
      g.globalAlpha = 1; texto(g, b.txt, b.x, b.y, { tam: b.r > 20 ? 8 : 6, align: 'center', base: 'middle', borde: 2 });
    }
    g.globalAlpha = 1;
  }
}
