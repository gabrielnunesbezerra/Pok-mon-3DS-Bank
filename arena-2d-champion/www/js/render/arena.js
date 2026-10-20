// Estádio da Liga Pokémon desenhado por código: campo grande de grama, arquibancadas com torcida
// animada em cima e embaixo, placas de publicidade e a área dos treinadores nas laterais.
import { WORLD_W, WORLD_H, FIELD } from '../engine/constants.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function rand(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const SHIRT_RED = ['#e74c3c', '#c0392b', '#ff6f61', '#f1c40f', '#ecf0f1', '#e67e22'];
const SHIRT_BLUE = ['#3498db', '#2c7fd1', '#5dade2', '#1abc9c', '#ecf0f1', '#9b59b6'];
const HAIR = ['#2c1b0e', '#5a3410', '#111', '#d9a441', '#7a3d14', '#c0392b'];

const STAND_TOP = 190; // altura da arquibancada de cima
const STAND_BOTTOM = 150;

// Torcida: cada pessoa é um bloquinho; metade da arquibancada torce para cada lado
function crowdStrip(w, h, rows, frame, seed, facingDown) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const r = rand(seed);
  const rowH = h / rows;
  for (let row = 0; row < rows; row++) {
    const y = row * rowH;
    const shade = facingDown ? 0.55 + (row / rows) * 0.45 : 1 - (row / rows) * 0.45;
    g.fillStyle = `rgb(${Math.round(58 * shade)},${Math.round(62 * shade)},${Math.round(98 * shade)})`;
    g.fillRect(0, y, w, rowH);
    g.fillStyle = `rgba(0,0,0,0.25)`;
    g.fillRect(0, y + rowH - 4, w, 4);
    for (let x = 6 + (row % 2) * 7; x < w - 6; x += 14) {
      if (r() < 0.1) continue;
      const left = x < w / 2;
      const shirts = left ? SHIRT_RED : SHIRT_BLUE;
      const jump = frame && r() < 0.45 ? -3 : 0;
      const by = y + rowH - 18 + jump;
      g.fillStyle = shirts[Math.floor(r() * shirts.length)];
      g.fillRect(x, by + 6, 10, 9);
      g.fillStyle = SKIN[Math.floor(r() * SKIN.length)];
      g.fillRect(x + 2, by, 6, 6);
      g.fillStyle = HAIR[Math.floor(r() * HAIR.length)];
      g.fillRect(x + 2, by - 1, 6, 2);
      if (frame && r() < 0.35) {
        g.fillStyle = SKIN[0];
        g.fillRect(x - 2, by - 4, 2, 6);
        g.fillRect(x + 10, by - 4, 2, 6);
      }
      if (r() < 0.04) { // bandeirinha
        g.fillStyle = left ? '#e8433f' : '#3f7fe8';
        g.fillRect(x + 10, by - 10 + (frame ? 2 : 0), 10, 7);
        g.fillStyle = '#ddd';
        g.fillRect(x + 9, by - 10, 1, 16);
      }
    }
  }
  return c;
}

function pokeball(g, x, y, r, alpha) {
  g.save();
  g.globalAlpha = alpha;
  g.lineWidth = r * 0.08;
  g.strokeStyle = '#ffffff';
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(x - r, y); g.lineTo(x - r * 0.3, y); g.moveTo(x + r * 0.3, y); g.lineTo(x + r, y); g.stroke();
  g.beginPath(); g.arc(x, y, r * 0.3, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(x, y, r * 0.14, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
  g.restore();
}

function board(g, x, y, w, h, text, color) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fillRect(x, y, w, h / 2);
  g.fillStyle = '#ffffff';
  g.font = `${Math.round(h * 0.42)}px "Press Start 2P", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x + w / 2, y + h / 2 + 1);
}

function drawBase() {
  const c = makeCanvas(WORLD_W, WORLD_H);
  const g = c.getContext('2d');
  const { x, y, w, h } = FIELD;
  // fundo do estádio
  g.fillStyle = '#1d2040';
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  // pista em volta do campo
  g.fillStyle = '#b5583c';
  g.fillRect(40, STAND_TOP + 40, WORLD_W - 80, WORLD_H - STAND_TOP - STAND_BOTTOM - 80);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 4; i++) g.fillRect(40, STAND_TOP + 52 + i * 8, WORLD_W - 80, 2);
  // muretas com placas
  const boards = [['POKéMON LEAGUE', '#c8302c'], ['ARENA 2D CHAMPION', '#2c5fc8'], ['MEGA EVOLUÇÃO', '#8e44ad'], ['POKéMON LEAGUE', '#c8302c'], ['SILPH CO.', '#16a085'], ['DEVON CORP.', '#2c3e50']];
  const bw = (WORLD_W - 80) / boards.length;
  boards.forEach(([t, col], i) => board(g, 40 + i * bw + 2, STAND_TOP + 6, bw - 4, 30, t, col));
  boards.slice().reverse().forEach(([t, col], i) => board(g, 40 + i * bw + 2, WORLD_H - STAND_BOTTOM - 36, bw - 4, 30, t, col));
  // campo
  const stripes = 16;
  for (let i = 0; i < stripes; i++) {
    g.fillStyle = i % 2 ? '#4c9a37' : '#58a842';
    g.fillRect(x + (w / stripes) * i, y, Math.ceil(w / stripes) + 1, h);
  }
  const r = rand(17);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(25,70,20,0.28)' : 'rgba(170,230,130,0.2)';
    g.fillRect(x + r() * w, y + r() * h, 2, 3 + r() * 2);
  }
  // sombra suave nas bordas do campo
  const vg = g.createRadialGradient(x + w / 2, y + h / 2, h * 0.35, x + w / 2, y + h / 2, w * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = vg;
  g.fillRect(x, y, w, h);
  // linhas
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 5;
  g.strokeRect(x + 10, y + 10, w - 20, h - 20);
  g.beginPath(); g.moveTo(x + w / 2, y + 10); g.lineTo(x + w / 2, y + h - 10); g.stroke();
  g.beginPath(); g.arc(x + w / 2, y + h / 2, 150, 0, Math.PI * 2); g.stroke();
  for (const side of [0, 1]) {
    const bx = side === 0 ? x + 10 : x + w - 10 - 220;
    g.strokeRect(bx, y + h / 2 - 220, 220, 440);
    g.strokeRect(side === 0 ? x + 10 : x + w - 10 - 90, y + h / 2 - 120, 90, 240);
    const a0 = side === 0 ? -1.2 : Math.PI - 1.2;
    g.beginPath(); g.arc(side === 0 ? x + 230 : x + w - 230, y + h / 2, 80, a0, a0 + 2.4); g.stroke();
  }
  for (const [cx, cy, a0] of [[x + 10, y + 10, 0], [x + w - 10, y + 10, Math.PI / 2], [x + w - 10, y + h - 10, Math.PI], [x + 10, y + h - 10, Math.PI * 1.5]]) {
    g.beginPath(); g.arc(cx, cy, 30, a0, a0 + Math.PI / 2); g.stroke();
  }
  pokeball(g, x + w / 2, y + h / 2, 120, 0.55);
  // áreas dos treinadores nas laterais
  for (const side of [0, 1]) {
    const tx = side === 0 ? 60 : WORLD_W - 60 - 100;
    const ty = y + h / 2 - 90;
    g.fillStyle = side === 0 ? 'rgba(232,67,63,0.35)' : 'rgba(63,127,232,0.35)';
    g.fillRect(tx, ty, 100, 180);
    g.strokeStyle = side === 0 ? '#ff8a80' : '#8ab4ff';
    g.lineWidth = 4;
    g.strokeRect(tx, ty, 100, 180);
  }
  // refletores nos cantos
  for (const lx of [120, WORLD_W - 120]) {
    const lg = g.createRadialGradient(lx, STAND_TOP + 20, 10, lx, STAND_TOP + 20, 420);
    lg.addColorStop(0, 'rgba(255,250,220,0.35)');
    lg.addColorStop(1, 'rgba(255,250,220,0)');
    g.fillStyle = lg;
    g.fillRect(0, 0, WORLD_W, WORLD_H);
  }
  return c;
}

// Fundo da arena: base fixa + duas tiras de torcida (dois quadros para a torcida pular)
export function buildArena() {
  const base = drawBase();
  const top = [0, 1].map(f => crowdStrip(WORLD_W, STAND_TOP, 7, f, 101, true));
  const bottom = [0, 1].map(f => crowdStrip(WORLD_W, STAND_BOTTOM, 5, f, 202, false));
  return { base, top, bottom, standTop: STAND_TOP, standBottom: STAND_BOTTOM };
}

export function drawArena(g, arena, frame) {
  g.drawImage(arena.base, 0, 0);
  g.drawImage(arena.top[frame], 0, 0);
  g.drawImage(arena.bottom[frame], 0, WORLD_H - arena.standBottom);
}
