// Entrada do jogador: toque (joystick + botões, arrastar o botão do golpe para mirar),
// teclado e controle (Gamepad API). Tudo vira o "input" de cada lado da batalha.
import { computeLayout, inCircle, inRect, teamIcons } from './layout.js';

const KEYMAP = [
  {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    moves: [['KeyJ', 'Digit1'], ['KeyK', 'Digit2'], ['KeyL', 'Digit3'], ['Semicolon', 'Digit4', 'KeyI']],
    dodge: ['Space'], mega: ['KeyE'], next: ['KeyQ'], team: [['KeyZ'], ['KeyX'], ['KeyC']],
  },
  {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    moves: [['Numpad1', 'Digit7'], ['Numpad2', 'Digit8'], ['Numpad3', 'Digit9'], ['Numpad4', 'Digit0']],
    dodge: ['Numpad0', 'Enter', 'ShiftRight'], mega: ['NumpadAdd', 'Backspace'], next: ['NumpadDecimal', 'Minus'], team: [['Numpad7'], ['Numpad8'], ['Numpad9']],
  },
];

const blankEdge = () => ({ move: null, dodge: false, mega: false, switchTo: null, next: false, mash: 0 });

export class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    this.pointers = new Map();
    this.keys = new Set();
    this.mode = '1p';
    this.humans = [true, false];
    this.joy = [null, null];
    this.aim = [null, null];
    this.edges = [blankEdge(), blankEdge()];
    this.padPrev = [{}, {}];
    this.layout = computeLayout(800, 400, '1p');
    this.battle = null;
    this.onPause = null;
    this.enabled = false;
    this.teamCounts = [3, 3];

    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerup', e => this.up(e));
    canvas.addEventListener('pointercancel', e => this.up(e, true));
    window.addEventListener('keydown', e => this.key(e, true));
    window.addEventListener('keyup', e => this.key(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); this.pointers.clear(); this.joy = [null, null]; });
  }

  setup(mode, humans, teamCounts) {
    this.mode = mode;
    this.humans = humans;
    this.teamCounts = teamCounts;
    this.edges = [blankEdge(), blankEdge()];
    this.pointers.clear();
    this.joy = [null, null];
    this.aim = [null, null];
  }

  resize(W, H) {
    this.layout = computeLayout(W, H, this.mode);
  }

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // lado que pode ser comandado por este ponto da tela
  down(e) {
    if (!this.enabled) return;
    e.preventDefault();
    const { x, y } = this.pos(e);
    const L = this.layout;
    if (inCircle(L.pause, x, y, 1.4)) { this.onPause?.(); return; }
    const b = this.battle;
    for (let i = 0; i < 2; i++) {
      if (!this.humans[i]) continue;
      const S = L.sides[i];
      if (b?.clash) {
        const mine = this.mode === '1p' || (i === 0 ? y > L.H / 2 : y < L.H / 2);
        if (mine) { this.edges[i].mash++; this.pointers.set(e.pointerId, { role: 'mash', side: i }); return; }
        continue;
      }
      for (let k = 0; k < S.moves.length; k++) {
        if (inCircle(S.moves[k], x, y)) {
          this.pointers.set(e.pointerId, { role: 'move', side: i, slot: k, x0: x, y0: y, x, y, aiming: false });
          this.canvas.setPointerCapture?.(e.pointerId);
          return;
        }
      }
      if (inCircle(S.dodge, x, y)) { this.edges[i].dodge = true; this.pointers.set(e.pointerId, { role: 'btn', side: i }); return; }
      if (inCircle(S.mega, x, y)) { this.edges[i].mega = true; this.pointers.set(e.pointerId, { role: 'btn', side: i }); return; }
      const icons = teamIcons(S.panel, L.u, this.teamCounts[i]);
      for (let k = 0; k < icons.length; k++) {
        if (inRect(icons[k], x, y)) { this.edges[i].switchTo = k; this.pointers.set(e.pointerId, { role: 'btn', side: i }); return; }
      }
      if (inRect(S.joyZone, x, y) && !this.joy[i]) {
        this.joy[i] = { id: e.pointerId, bx: x, by: y, x, y };
        this.pointers.set(e.pointerId, { role: 'joy', side: i });
        this.canvas.setPointerCapture?.(e.pointerId);
        return;
      }
    }
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const { x, y } = this.pos(e);
    if (p.role === 'joy') {
      const j = this.joy[p.side];
      if (j) { j.x = x; j.y = y; }
    } else if (p.role === 'move') {
      p.x = x; p.y = y;
      const S = this.layout.sides[p.side];
      const d = Math.hypot(x - p.x0, y - p.y0);
      if (d > S.moves[p.slot].r * 0.7) p.aiming = true;
      this.aim[p.side] = p.aiming ? { slot: p.slot, dx: (x - p.x0) / d, dy: (y - p.y0) / d } : null;
    }
  }

  up(e, cancel = false) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (p.role === 'joy') this.joy[p.side] = null;
    if (p.role === 'move') {
      this.aim[p.side] = null;
      if (!cancel) {
        const d = Math.hypot(p.x - p.x0, p.y - p.y0);
        const aim = p.aiming && d > 4 ? { x: (p.x - p.x0) / d, y: (p.y - p.y0) / d } : null;
        this.edges[p.side].move = { slot: p.slot, aim };
      }
    }
  }

  key(e, down) {
    if (e.repeat) { if (this.enabled && this.isGameKey(e.code)) e.preventDefault(); return; }
    if (down) this.keys.add(e.code); else this.keys.delete(e.code);
    if (!this.enabled || !down) return;
    if (e.code === 'Escape' || e.code === 'KeyP') { this.onPause?.(); return; }
    for (let i = 0; i < 2; i++) {
      if (!this.humans[i]) continue;
      const map = this.mode === '1p' && i === 0 ? mergeMaps(KEYMAP[0], KEYMAP[1]) : KEYMAP[i];
      const ed = this.edges[i];
      const mashKey = map.moves.flat().includes(e.code) || map.dodge.includes(e.code);
      if (this.battle?.clash && mashKey) { ed.mash++; e.preventDefault(); continue; }
      map.moves.forEach((codes, k) => { if (codes.includes(e.code)) ed.move = { slot: k, aim: null }; });
      if (map.dodge.includes(e.code)) ed.dodge = true;
      if (map.mega.includes(e.code)) ed.mega = true;
      if (map.next.includes(e.code)) ed.next = true;
      map.team.forEach((codes, k) => { if (codes.includes(e.code)) ed.switchTo = k; });
      if (this.isGameKey(e.code)) e.preventDefault();
    }
  }

  isGameKey(code) {
    return code.startsWith('Arrow') || code === 'Space';
  }

  gamepads() {
    const pads = (navigator.getGamepads?.() || []).filter(Boolean);
    const out = [null, null];
    if (this.mode === '1p') out[0] = pads[0] || null;
    else { out[0] = pads[0] || null; out[1] = pads[1] || null; }
    return out;
  }

  // Escreve no input de cada lado humano da batalha
  poll(battle) {
    this.battle = battle;
    const pads = this.gamepads();
    for (let i = 0; i < 2; i++) {
      if (!this.humans[i]) continue;
      const inp = battle.sides[i].input;
      const ed = this.edges[i];
      let mx = 0, my = 0;
      const map = this.mode === '1p' && i === 0 ? mergeMaps(KEYMAP[0], KEYMAP[1]) : KEYMAP[i];
      const held = list => list.some(c => this.keys.has(c));
      if (held(map.left)) mx -= 1;
      if (held(map.right)) mx += 1;
      if (held(map.up)) my -= 1;
      if (held(map.down)) my += 1;
      const j = this.joy[i];
      if (j) {
        const R = this.layout.sides[i].joyR;
        const dx = j.x - j.bx, dy = j.y - j.by;
        const d = Math.hypot(dx, dy);
        if (d > R) { j.bx = j.x - (dx / d) * R; j.by = j.y - (dy / d) * R; }
        if (d > R * 0.12) { mx = dx / R; my = dy / R; }
      }
      const pad = pads[i];
      if (pad) {
        const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
        if (Math.hypot(ax, ay) > 0.2) { mx = ax; my = ay; }
        const btn = k => pad.buttons[k]?.pressed;
        if (btn(14)) mx = -1; if (btn(15)) mx = 1; if (btn(12)) my = -1; if (btn(13)) my = 1;
        const prev = this.padPrev[i];
        const edge = k => btn(k) && !prev[k];
        [0, 1, 2, 3].forEach(k => { if (edge(k)) { if (battle.clash) ed.mash++; else ed.move = { slot: k, aim: null }; } });
        if (edge(5) || edge(7)) { if (battle.clash) ed.mash++; else ed.dodge = true; }
        if (edge(4) || edge(6)) ed.mega = true;
        if (edge(8)) ed.next = true;
        if (edge(9)) this.onPause?.();
        for (let k = 0; k < 16; k++) prev[k] = btn(k);
      }
      const len = Math.hypot(mx, my);
      if (len > 1) { mx /= len; my /= len; }
      inp.mx = mx;
      inp.my = my;
      if (ed.move) inp.move = ed.move;
      if (ed.dodge) inp.dodge = true;
      if (ed.mega) inp.mega = true;
      if (ed.switchTo !== null) inp.switchTo = ed.switchTo;
      if (ed.next) {
        const opts = battle.switchOptions(i);
        if (opts.length) {
          const cur = battle.sides[i].active?.slot ?? 0;
          inp.switchTo = opts.find(s => s > cur) ?? opts[0];
        }
      }
      inp.mash += ed.mash;
      this.edges[i] = blankEdge();
    }
  }
}

function mergeMaps(a, b) {
  const out = {};
  for (const k of Object.keys(a)) {
    out[k] = Array.isArray(a[k][0]) ? a[k].map((codes, i) => [...codes, ...(b[k][i] || [])]) : [...a[k], ...b[k]];
  }
  return out;
}

export { KEYMAP };
