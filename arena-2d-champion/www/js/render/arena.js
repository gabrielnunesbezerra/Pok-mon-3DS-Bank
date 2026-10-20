// Desenho das arenas (feito por código, em pixel art): arquibancada com torcida, campo e
// lugar dos treinadores.
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
const SHIRT = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#ecf0f1', '#1abc9c', '#ff6fa8', '#34495e'];
const HAIR = ['#2c1b0e', '#5a3410', '#111', '#d9a441', '#7a3d14', '#c0392b'];

// Torcida: dois quadros para ela "pular"
function drawCrowd(g, frame, seed) {
  const r = rand(seed);
  g.fillStyle = '#3b3f58';
  g.fillRect(0, 0, WORLD_W, 96);
  for (let row = 0; row < 4; row++) {
    const y = 14 + row * 19;
    g.fillStyle = row % 2 ? '#454a68' : '#50567a';
    g.fillRect(0, y + 10, WORLD_W, 9);
    for (let x = 4 + (row % 2) * 6; x < WORLD_W; x += 12) {
      if (r() < 0.12) continue;
      const jump = frame && r() < 0.5 ? -2 : 0;
      const shirt = SHIRT[Math.floor(r() * SHIRT.length)];
      const skin = SKIN[Math.floor(r() * SKIN.length)];
      const hair = HAIR[Math.floor(r() * HAIR.length)];
      g.fillStyle = shirt;
      g.fillRect(x, y + 5 + jump, 8, 7);
      g.fillStyle = skin;
      g.fillRect(x + 2, y + jump, 4, 5);
      g.fillStyle = hair;
      g.fillRect(x + 2, y - 1 + jump, 4, 2);
      if (frame && r() < 0.3) { g.fillStyle = skin; g.fillRect(x - 1, y - 3 + jump, 2, 4); g.fillRect(x + 7, y - 3 + jump, 2, 4); }
    }
  }
}

function drawBanner(g, text) {
  g.fillStyle = '#20223a';
  g.fillRect(0, 92, WORLD_W, 16);
  g.fillStyle = '#f5c518';
  for (let x = 0; x < WORLD_W; x += 24) { g.fillRect(x, 92, 12, 2); g.fillRect(x + 12, 106, 12, 2); }
  g.fillStyle = '#d7d9ec';
  g.font = '8px "Press Start 2P", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, WORLD_W / 2, 100);
}

function pokeballEmblem(g, x, y, r, alpha = 0.35) {
  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = '#fff';
  g.lineWidth = 4;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(x - r, y); g.lineTo(x - r * 0.28, y); g.moveTo(x + r * 0.28, y); g.lineTo(x + r, y); g.stroke();
  g.beginPath(); g.arc(x, y, r * 0.28, 0, Math.PI * 2); g.stroke();
  g.restore();
}

function trainerBoxes(g, color) {
  g.fillStyle = color;
  g.fillRect(0, 108, FIELD.x - 6, WORLD_H - 108);
  g.fillRect(FIELD.x + FIELD.w + 6, 108, WORLD_W - FIELD.x - FIELD.w - 6, WORLD_H - 108);
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 2;
  g.strokeRect(10, FIELD.y + FIELD.h / 2 - 56, FIELD.x - 28, 112);
  g.strokeRect(FIELD.x + FIELD.w + 18, FIELD.y + FIELD.h / 2 - 56, FIELD.x - 28, 112);
}

function grassField(g) {
  const { x, y, w, h } = FIELD;
  for (let i = 0; i < 14; i++) {
    g.fillStyle = i % 2 ? '#4f9d3a' : '#5aab44';
    g.fillRect(x + (w / 14) * i, y, Math.ceil(w / 14), h);
  }
  const r = rand(7);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(30,80,20,0.35)' : 'rgba(160,220,120,0.25)';
    g.fillRect(x + r() * w, y + r() * h, 2, 3);
  }
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 3;
  g.strokeRect(x + 6, y + 6, w - 12, h - 12);
  g.beginPath(); g.moveTo(x + w / 2, y + 6); g.lineTo(x + w / 2, y + h - 6); g.stroke();
  g.strokeRect(x + 6, y + h / 2 - 80, 90, 160);
  g.strokeRect(x + w - 96, y + h / 2 - 80, 90, 160);
  pokeballEmblem(g, x + w / 2, y + h / 2, 70, 0.6);
}

function waterField(g) {
  const { x, y, w, h } = FIELD;
  // borda de concreto com faixa de alerta
  g.fillStyle = '#9aa3ad';
  g.fillRect(x - 10, y - 10, w + 20, h + 20);
  for (let i = 0; i < (w + 20) / 14; i++) {
    g.fillStyle = i % 2 ? '#f5c518' : '#2b2b2b';
    g.fillRect(x - 10 + i * 14, y - 10, 14, 6);
  }
  const grad = g.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, '#2f7fd8');
  grad.addColorStop(1, '#1d5cb0');
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);
  const r = rand(11);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 260; i++) g.fillRect(x + r() * w, y + r() * h, 6 + r() * 10, 2);
}

function iceField(g) {
  const { x, y, w, h } = FIELD;
  g.fillStyle = '#cfeaf7';
  g.fillRect(x, y, w, h);
  const r = rand(5);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    let px = x + r() * w, py = y + r() * h;
    g.beginPath(); g.moveTo(px, py);
    for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 60; py += (r() - 0.5) * 40; g.lineTo(px, py); }
    g.stroke();
  }
  g.fillStyle = 'rgba(140,190,220,0.35)';
  for (let i = 0; i < 300; i++) g.fillRect(x + r() * w, y + r() * h, 3, 1);
  g.strokeStyle = 'rgba(70,130,180,0.6)';
  g.lineWidth = 3;
  g.strokeRect(x + 6, y + 6, w - 12, h - 12);
  g.beginPath(); g.moveTo(x + w / 2, y + 6); g.lineTo(x + w / 2, y + h - 6); g.stroke();
  pokeballEmblem(g, x + w / 2, y + h / 2, 70, 0.4);
  // montes de neve nas bordas
  g.fillStyle = '#f4fbff';
  for (let i = 0; i < 30; i++) { g.beginPath(); g.ellipse(x + r() * w, y + 4, 20 + r() * 20, 8, 0, 0, Math.PI * 2); g.fill(); }
}

export function platformsLayer(g, platforms) {
  for (const p of platforms) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(p.x + 4, p.y + 8, p.r, p.r * 0.92, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b07a43';
    g.beginPath(); g.ellipse(p.x, p.y, p.r, p.r * 0.92, 0, 0, Math.PI * 2); g.fill();
    g.save();
    g.beginPath(); g.ellipse(p.x, p.y, p.r - 3, p.r * 0.92 - 3, 0, 0, Math.PI * 2); g.clip();
    for (let i = -p.r; i < p.r; i += 12) {
      g.fillStyle = (i / 12) % 2 ? '#c48b52' : '#b98049';
      g.fillRect(p.x + i, p.y - p.r, 11, p.r * 2);
    }
    g.restore();
    g.strokeStyle = '#7b4f25';
    g.lineWidth = 3;
    g.beginPath(); g.ellipse(p.x, p.y, p.r, p.r * 0.92, 0, 0, Math.PI * 2); g.stroke();
  }
}

export const ARENA_TITLE = { grass: 'POKÉMON LEAGUE · GRASS FIELD', water: 'POKÉMON LEAGUE · WATER FIELD', ice: 'POKÉMON LEAGUE · ICE FIELD' };

// Gera os dois quadros do fundo de uma arena
export function buildArena(kind, platforms = []) {
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const c = makeCanvas(WORLD_W, WORLD_H);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    drawCrowd(g, f, 99);
    drawBanner(g, ARENA_TITLE[kind]);
    trainerBoxes(g, kind === 'water' ? '#7d8790' : kind === 'ice' ? '#a9c6d6' : '#3e7d2f');
    if (kind === 'water') { waterField(g); platformsLayer(g, platforms); }
    else if (kind === 'ice') iceField(g);
    else grassField(g);
    frames.push(c);
  }
  return frames;
}
