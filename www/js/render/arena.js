// As 4 arenas ovais desenhadas por código em pixel art (960 x 441): estádio, neon, cratera e ruínas.
import { MUNDO, OVALO } from '../config.js';

function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const dentro = (x, y, k = 1) => { const dx = (x - OVALO.cx) / (OVALO.rx * k), dy = (y - OVALO.cy) / (OVALO.ry * k); return dx * dx + dy * dy <= 1; };

function elipse(g, cx, cy, rx, ry, color) { g.fillStyle = color; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
function aro(g, rx, ry, color, w = 2) { g.strokeStyle = color; g.lineWidth = w; g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, rx, ry, 0, 0, Math.PI * 2); g.stroke(); }

const ESTILOS = {
  estadio(g, R) {
    g.fillStyle = '#0d1a2e'; g.fillRect(0, 0, MUNDO.w, MUNDO.h);
    // arquibancada: anéis de gente
    for (let i = 0; i < 6; i++) {
      const k = 1.34 - i * 0.045;
      elipse(g, OVALO.cx, OVALO.cy, OVALO.rx * k + 20, OVALO.ry * k + 14, i % 2 ? '#1a2c4a' : '#15243d');
    }
    for (let n = 0; n < 2600; n++) {
      const a = R() * Math.PI * 2, k = 1.1 + R() * 0.3;
      const x = OVALO.cx + Math.cos(a) * (OVALO.rx * k + 20), y = OVALO.cy + Math.sin(a) * (OVALO.ry * k + 14);
      g.fillStyle = ['#e8463a', '#f8c448', '#7dd3fc', '#f4f4f4', '#86efac', '#c084fc'][Math.floor(R() * 6)];
      g.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
    elipse(g, OVALO.cx, OVALO.cy, OVALO.rx + 22, OVALO.ry + 18, '#2d3f5e');
    elipse(g, OVALO.cx, OVALO.cy, OVALO.rx + 14, OVALO.ry + 10, '#1d2c47');
    // gramado com faixas
    g.save(); g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, OVALO.rx + 6, OVALO.ry + 6, 0, 0, Math.PI * 2); g.clip();
    for (let x = 0; x < MUNDO.w; x += 40) { g.fillStyle = (x / 40) % 2 ? '#3f8f48' : '#47a050'; g.fillRect(x, 0, 40, MUNDO.h); }
    for (let n = 0; n < 1400; n++) { g.fillStyle = R() < 0.5 ? '#38823f' : '#58b05c'; g.fillRect(Math.floor(R() * MUNDO.w), Math.floor(R() * MUNDO.h), 2, 1); }
    g.restore();
    aro(g, OVALO.rx, OVALO.ry, '#f4f4f4', 3);
    g.strokeStyle = 'rgba(244,244,244,0.85)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(OVALO.cx, OVALO.cy - OVALO.ry); g.lineTo(OVALO.cx, OVALO.cy + OVALO.ry); g.stroke();
    g.beginPath(); g.arc(OVALO.cx, OVALO.cy, 62, 0, Math.PI * 2); g.stroke();
    elipse(g, OVALO.cx, OVALO.cy, 5, 5, '#f4f4f4');
  },
  neon(g, R) {
    g.fillStyle = '#07040f'; g.fillRect(0, 0, MUNDO.w, MUNDO.h);
    for (let n = 0; n < 160; n++) { g.fillStyle = R() < 0.5 ? '#2a1a55' : '#12306a'; g.fillRect(Math.floor(R() * MUNDO.w), Math.floor(R() * MUNDO.h), 2, 2); }
    elipse(g, OVALO.cx, OVALO.cy, OVALO.rx + 24, OVALO.ry + 20, '#1a0f3a');
    g.save(); g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, OVALO.rx + 4, OVALO.ry + 4, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#120a2b'; g.fillRect(0, 0, MUNDO.w, MUNDO.h);
    g.strokeStyle = '#2d1c6a'; g.lineWidth = 1;
    for (let x = 0; x < MUNDO.w; x += 24) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, MUNDO.h); g.stroke(); }
    for (let y = 0; y < MUNDO.h; y += 24) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(MUNDO.w, y + 0.5); g.stroke(); }
    g.strokeStyle = '#ff2fa8'; g.lineWidth = 1;
    for (let x = 0; x < MUNDO.w; x += 120) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, MUNDO.h); g.stroke(); }
    for (let y = 0; y < MUNDO.h; y += 96) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(MUNDO.w, y + 0.5); g.stroke(); }
    g.restore();
    aro(g, OVALO.rx + 2, OVALO.ry + 2, '#04102c', 6);
    aro(g, OVALO.rx, OVALO.ry, '#2ff3ff', 3);
    aro(g, OVALO.rx - 8, OVALO.ry - 8, '#ff2fa8', 1);
    elipse(g, OVALO.cx, OVALO.cy, 40, 30, 'rgba(47,243,255,0.12)');
    aro(g, 40, 30, '#2ff3ff', 1);
  },
  crater(g, R) {
    g.fillStyle = '#1a0d08'; g.fillRect(0, 0, MUNDO.w, MUNDO.h);
    for (let i = 0; i < 5; i++) elipse(g, OVALO.cx, OVALO.cy, OVALO.rx + 70 - i * 12, OVALO.ry + 46 - i * 8, ['#2a1410', '#331a12', '#3d2016', '#4a281b', '#5a3222'][i]);
    // lava no entorno
    for (let n = 0; n < 360; n++) {
      const a = R() * Math.PI * 2, k = 1.06 + R() * 0.08;
      g.fillStyle = ['#ff7a1f', '#ffb347', '#e8361c'][Math.floor(R() * 3)];
      g.fillRect(Math.round(OVALO.cx + Math.cos(a) * OVALO.rx * k), Math.round(OVALO.cy + Math.sin(a) * OVALO.ry * k), 3, 2);
    }
    g.save(); g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, OVALO.rx + 4, OVALO.ry + 4, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#7a4a2e'; g.fillRect(0, 0, MUNDO.w, MUNDO.h);
    for (let n = 0; n < 3200; n++) { g.fillStyle = ['#6b3f27', '#8a5636', '#946040', '#5b3320'][Math.floor(R() * 4)]; g.fillRect(Math.floor(R() * MUNDO.w), Math.floor(R() * MUNDO.h), 3 + Math.floor(R() * 5), 2); }
    g.strokeStyle = '#2b140c'; g.lineWidth = 2;
    for (let n = 0; n < 16; n++) {
      let x = R() * MUNDO.w, y = R() * MUNDO.h; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 50; y += (R() - 0.5) * 36; g.lineTo(x, y); }
      g.stroke();
    }
    g.restore();
    aro(g, OVALO.rx, OVALO.ry, '#ffb347', 2);
    aro(g, OVALO.rx + 3, OVALO.ry + 3, '#3d1a0c', 3);
  },
  ruinas(g, R) {
    g.fillStyle = '#0f1a14'; g.fillRect(0, 0, MUNDO.w, MUNDO.h);
    for (let n = 0; n < 500; n++) { g.fillStyle = R() < 0.5 ? '#1c3326' : '#14261c'; g.fillRect(Math.floor(R() * MUNDO.w), Math.floor(R() * MUNDO.h), 4, 3); }
    elipse(g, OVALO.cx, OVALO.cy, OVALO.rx + 26, OVALO.ry + 20, '#3b4a45');
    g.save(); g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, OVALO.rx + 4, OVALO.ry + 4, 0, 0, Math.PI * 2); g.clip();
    for (let y = 0; y < MUNDO.h; y += 36) for (let x = 0; x < MUNDO.w; x += 48) {
      const o = (y / 36) % 2 ? 24 : 0, c = ['#8c9a94', '#7f8d87', '#95a39d', '#76847e'][Math.floor(R() * 4)];
      g.fillStyle = c; g.fillRect(x - o, y, 47, 35);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x - o, y, 47, 2);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - o, y + 34, 47, 1);
    }
    for (let n = 0; n < 260; n++) { g.fillStyle = ['#4f8a45', '#3f7a39', '#62a055'][Math.floor(R() * 3)]; g.fillRect(Math.floor(R() * MUNDO.w), Math.floor(R() * MUNDO.h), 2 + Math.floor(R() * 4), 2); }
    g.restore();
    aro(g, OVALO.rx, OVALO.ry, '#c9d6cf', 2);
    // colunas na borda
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.2, x = OVALO.cx + Math.cos(a) * (OVALO.rx + 18), y = OVALO.cy + Math.sin(a) * (OVALO.ry + 14);
      g.fillStyle = '#04102c'; g.fillRect(Math.round(x) - 9, Math.round(y) - 18, 18, 24);
      g.fillStyle = '#a7b5ae'; g.fillRect(Math.round(x) - 7, Math.round(y) - 16, 14, 20);
      g.fillStyle = '#cfd9d3'; g.fillRect(Math.round(x) - 7, Math.round(y) - 16, 4, 20);
      g.fillStyle = '#6a7872'; g.fillRect(Math.round(x) + 3, Math.round(y) - 16, 4, 20);
    }
  },
};

const cache = new Map();
export function crearArena(id) {
  if (cache.has(id)) return cache.get(id);
  const c = document.createElement('canvas');
  c.width = MUNDO.w; c.height = MUNDO.h;
  const g = c.getContext('2d');
  const semilla = [...id].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7);
  (ESTILOS[id] ?? ESTILOS.estadio)(g, rng(semilla));
  cache.set(id, c);
  return c;
}
