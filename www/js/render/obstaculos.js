// Desenho dos obstáculos das arenas: o chão (rio, pontes, lava, placas) vai para a imagem fixa da arena;
// pedras e lápides são desenhadas junto com os lutadores, em ordem de profundidade.
import { OVALO } from '../config.js';
import { MAPAS, ACHATA } from '../engine/obstaculos.js';

function clipCampo(g) { g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, OVALO.rx + 14, OVALO.ry + 9, 0, 0, Math.PI * 2); g.clip(); }

export function chaoObstaculos(g, id) {
  const m = MAPAS[id]; if (!m) return;
  g.save(); clipCampo(g);
  if (m.rio) {
    const r = m.rio, y0 = OVALO.cy - OVALO.ry - 20, y1 = OVALO.cy + OVALO.ry + 20;
    // margens de areia molhada
    g.fillStyle = '#c9a86a'; g.fillRect(r.x - r.meio - 9, y0, (r.meio + 9) * 2, y1 - y0);
    const gr = g.createLinearGradient(r.x - r.meio, 0, r.x + r.meio, 0);
    gr.addColorStop(0, '#0e7490'); gr.addColorStop(0.5, '#0891b2'); gr.addColorStop(1, '#0e7490');
    g.fillStyle = gr; g.fillRect(r.x - r.meio, y0, r.meio * 2, y1 - y0);
    g.strokeStyle = 'rgba(224,242,254,0.55)'; g.lineWidth = 1;
    for (let y = y0; y < y1; y += 9) { const o = Math.sin(y * 0.3) * 6; g.beginPath(); g.moveTo(r.x - 10 + o, y); g.quadraticCurveTo(r.x + o, y - 3, r.x + 10 + o, y); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(r.x - r.meio, y0, 2, y1 - y0); g.fillRect(r.x + r.meio - 2, y0, 2, y1 - y0);
    // pontes de madeira com corrimão
    for (const b of r.pontes) {
      const x0 = r.x - r.meio - 14, w = (r.meio + 14) * 2, yb = b.y - b.meio, hb = b.meio * 2;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x0 + 3, yb + 4, w, hb);
      for (let x = x0; x < x0 + w; x += 7) { g.fillStyle = (x / 7) % 2 < 1 ? '#8b5a2b' : '#a0692f'; g.fillRect(Math.round(x), yb, 6, hb); g.fillStyle = '#5c3a1a'; g.fillRect(Math.round(x) + 6, yb, 1, hb); }
      for (const yy of [yb - 3, yb + hb - 1]) { g.fillStyle = '#4a2e14'; g.fillRect(x0, yy, w, 4); g.fillStyle = '#c08a4a'; g.fillRect(x0, yy, w, 1); }
      for (let x = x0; x <= x0 + w; x += w / 3) { g.fillStyle = '#4a2e14'; g.fillRect(Math.round(x) - 2, yb - 9, 4, 9); g.fillRect(Math.round(x) - 2, yb + hb - 6, 4, 9); }
    }
  }
  if (m.lava) for (const z of m.lava) {
    g.fillStyle = '#1c0f0a'; g.beginPath(); g.ellipse(z.x, z.y, z.rx + 8, z.ry + 6, 0, 0, 7); g.fill();
    g.fillStyle = '#3b1a0e'; g.beginPath(); g.ellipse(z.x, z.y, z.rx + 3, z.ry + 2, 0, 0, 7); g.fill();
    const gr = g.createRadialGradient(z.x, z.y, 2, z.x, z.y, z.rx);
    gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.35, '#fbbf24'); gr.addColorStop(0.75, '#ea580c'); gr.addColorStop(1, '#9a3412');
    g.save(); g.translate(z.x, z.y); g.scale(1, z.ry / z.rx); g.translate(-z.x, -z.y); g.fillStyle = gr; g.beginPath(); g.arc(z.x, z.y, z.rx, 0, 7); g.fill(); g.restore();
    g.strokeStyle = 'rgba(28,10,4,0.6)'; g.lineWidth = 2; for (let i = 0; i < 5; i++) { const a = i * 1.3; g.beginPath(); g.moveTo(z.x + Math.cos(a) * z.rx * 0.2, z.y + Math.sin(a) * z.ry * 0.2); g.lineTo(z.x + Math.cos(a + 0.4) * z.rx * 0.7, z.y + Math.sin(a + 0.4) * z.ry * 0.7); g.stroke(); }
  }
  if (m.pads) for (const z of m.pads) {
    g.save(); g.translate(z.x, z.y); g.scale(1, ACHATA);
    g.fillStyle = 'rgba(8,20,40,0.85)'; g.beginPath(); g.arc(0, 0, z.r + 4, 0, 7); g.fill();
    g.strokeStyle = '#22d3ee'; g.lineWidth = 3; g.shadowColor = '#22d3ee'; g.shadowBlur = 12; g.beginPath(); g.arc(0, 0, z.r, 0, 7); g.stroke();
    g.lineWidth = 3; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(-8 + i * 9, -9); g.lineTo(1 + i * 9, 0); g.lineTo(-8 + i * 9, 9); g.stroke(); }
    g.restore();
  }
  if (m.gelo) for (const z of m.gelo) {
    g.fillStyle = 'rgba(14,116,144,0.35)'; g.beginPath(); g.ellipse(z.x, z.y + 2, z.rx + 4, z.ry + 3, 0, 0, 7); g.fill();
    const gr = g.createLinearGradient(z.x - z.rx, z.y - z.ry, z.x + z.rx, z.y + z.ry);
    gr.addColorStop(0, '#e0f7ff'); gr.addColorStop(0.5, '#a5e3f7'); gr.addColorStop(1, '#7cc8e8');
    g.fillStyle = gr; g.beginPath(); g.ellipse(z.x, z.y, z.rx, z.ry, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2; g.beginPath(); g.ellipse(z.x, z.y, z.rx, z.ry, 0, 3.4, 5.6); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 3; i++) g.fillRect(Math.round(z.x - z.rx * 0.5 + i * z.rx * 0.3), Math.round(z.y - z.ry * 0.3 + i * 3), Math.round(z.rx * 0.22), 2);
  }
  if (m.vento) for (const f of m.vento.faixas) {
    g.fillStyle = 'rgba(125,211,252,0.28)'; g.fillRect(OVALO.cx - OVALO.rx - 20, f.y - f.meio, (OVALO.rx + 20) * 2, f.meio * 2);
    g.fillStyle = 'rgba(214,170,60,0.55)'; g.fillRect(OVALO.cx - OVALO.rx - 20, f.y - f.meio, (OVALO.rx + 20) * 2, 2); g.fillRect(OVALO.cx - OVALO.rx - 20, f.y + f.meio - 2, (OVALO.rx + 20) * 2, 2);
  }
  // sombra no chão de cada pedra
  if (m.pedras) for (const p of m.pedras) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(p.x + 4, p.y + 2, p.r * 1.1, p.r * ACHATA * 1.05, 0, 0, 7); g.fill(); }
  g.restore();
}

// sprite de cada pedra/lápide (guardado em cache)
const cache = new Map();
function spritePedra(p, i) {
  const k = `${p.tipo}${p.r}${i % 3}`;
  if (cache.has(k)) return cache.get(k);
  const W = p.r * 2 + 12, H = p.r * 2.4 + 12, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), cx = W / 2, base = H - 6;
  if (p.tipo === 'cristal') {
    const r = p.r;
    g.fillStyle = 'rgba(14,60,90,0.5)'; g.beginPath(); g.ellipse(cx, base, r, 4, 0, 0, 7); g.fill();
    const ponta = (x, h, w, c1, c2) => { g.fillStyle = c1; g.beginPath(); g.moveTo(x - w, base); g.lineTo(x - w * 0.6, base - h * 0.8); g.lineTo(x, base - h); g.lineTo(x + w * 0.6, base - h * 0.8); g.lineTo(x + w, base); g.closePath(); g.fill(); g.fillStyle = c2; g.beginPath(); g.moveTo(x - w, base); g.lineTo(x - w * 0.6, base - h * 0.8); g.lineTo(x, base - h); g.lineTo(x - w * 0.1, base); g.closePath(); g.fill(); g.strokeStyle = '#0c4a6e'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - w, base); g.lineTo(x - w * 0.6, base - h * 0.8); g.lineTo(x, base - h); g.lineTo(x + w * 0.6, base - h * 0.8); g.lineTo(x + w, base); g.stroke(); };
    ponta(cx - r * 0.55, r * 1.3, r * 0.4, '#7dd3fc', '#bae6fd');
    ponta(cx + r * 0.55, r * 1.5, r * 0.42, '#7dd3fc', '#bae6fd');
    ponta(cx, r * 2.1, r * 0.55, '#38bdf8', '#e0f2fe');
    g.fillStyle = '#ffffff'; g.fillRect(Math.round(cx - r * 0.15), Math.round(base - r * 1.7), 2, Math.round(r * 0.9));
  } else if (p.tipo === 'lapide') {
    const w = p.r * 1.3, h = p.r * 2.1;
    g.fillStyle = '#3f3a2e'; g.beginPath(); g.ellipse(cx, base, w * 0.75, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#6b6878'; g.beginPath(); g.moveTo(cx - w / 2, base); g.lineTo(cx - w / 2, base - h + w / 2); g.arc(cx, base - h + w / 2, w / 2, Math.PI, 0); g.lineTo(cx + w / 2, base); g.closePath(); g.fill();
    g.fillStyle = '#8e8a9c'; g.beginPath(); g.moveTo(cx - w / 2, base); g.lineTo(cx - w / 2, base - h + w / 2); g.arc(cx, base - h + w / 2, w / 2, Math.PI, Math.PI * 1.5); g.lineTo(cx - w * 0.15, base); g.closePath(); g.fill();
    g.fillStyle = '#4a4656'; if (i % 2) { g.fillRect(cx - 1, base - h * 0.78, 3, h * 0.42); g.fillRect(cx - 6, base - h * 0.68, 13, 3); } else { g.font = 'bold 7px monospace'; g.textAlign = 'center'; g.fillText('RIP', cx + 1, base - h * 0.55); }
    g.fillStyle = '#5b7a3a'; g.fillRect(cx - w / 2 - 2, base - 3, 5, 3); g.fillRect(cx + w / 2 - 3, base - 2, 6, 2);
  } else {
    const r = p.r, pts = [];
    for (let j = 0; j < 9; j++) { const a = Math.PI + (j / 8) * Math.PI, rr = r * (0.85 + 0.2 * Math.sin(j * 2.3 + i)); pts.push([cx + Math.cos(a) * rr, base + Math.sin(a) * rr * 1.25]); }
    g.fillStyle = '#5f5a4c'; g.beginPath(); g.moveTo(cx - r, base); pts.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(cx + r, base); g.closePath(); g.fill();
    const gr = g.createLinearGradient(cx - r, base - r * 1.2, cx + r * 0.6, base);
    gr.addColorStop(0, '#c9c2a8'); gr.addColorStop(0.5, '#9a937c'); gr.addColorStop(1, '#5f5a4c');
    g.fillStyle = gr; g.beginPath(); g.moveTo(cx - r * 0.9, base - 2); pts.forEach(([x, y]) => g.lineTo(x * 0.92 + cx * 0.08, y + 2)); g.lineTo(cx + r * 0.9, base - 2); g.closePath(); g.fill();
    g.strokeStyle = '#4a4538'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - r * 0.2, base - r * 0.9); g.lineTo(cx, base - r * 0.5); g.lineTo(cx - r * 0.1, base - r * 0.2); g.stroke();
    g.fillStyle = '#6b8a3a'; for (let j = 0; j < 4; j++) g.fillRect(Math.round(cx - r * 0.6 + j * r * 0.35), Math.round(base - r * 1.05 + (j % 2) * 3), 4, 2);
  }
  const s = { c, ox: cx, oy: base };
  cache.set(k, s);
  return s;
}
// lista de pedras para desenhar junto com os lutadores
export function pedrasParaDesenhar(id) {
  const m = MAPAS[id]; if (!m?.pedras) return [];
  return m.pedras.map((p, i) => ({ y: p.y, f: g => { const s = spritePedra(p, i); g.drawImage(s.c, Math.round(p.x - s.ox), Math.round(p.y - s.oy + 2)); } }));
}
// vida do chão a cada quadro: bolhas na lava, brilho das placas, correnteza
export function animarChao(g, id, t) {
  const m = MAPAS[id]; if (!m) return;
  if (m.lava) for (const [j, z] of m.lava.entries()) for (let i = 0; i < 3; i++) { const f = (t * 0.8 + i / 3 + j * 0.37) % 1, a = i * 2.1 + j; g.globalAlpha = 1 - f; g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(z.x + Math.cos(a) * z.rx * 0.45, z.y + Math.sin(a) * z.ry * 0.4 - f * 6, 2 + f * 2, 0, 7); g.fill(); }
  if (m.pads) for (const z of m.pads) { g.globalAlpha = 0.3 + 0.3 * Math.sin(t * 6); g.fillStyle = '#22d3ee'; g.beginPath(); g.ellipse(z.x, z.y, z.r, z.r * ACHATA, 0, 0, 7); g.fill(); }
  if (m.rio) { const r = m.rio; g.globalAlpha = 0.5; g.fillStyle = '#e0f2fe'; for (let i = 0; i < 12; i++) { const y = OVALO.cy - OVALO.ry + ((t * 40 + i * 37) % (OVALO.ry * 2)); if (r.pontes.some(b => Math.abs(y - b.y) < b.meio + 2)) continue; g.fillRect(Math.round(r.x - 8 + Math.sin(i * 3) * 10), Math.round(y), 5, 1); } }
  if (m.vento) for (const f of m.vento.faixas) { const d = m.vento.dir; g.globalAlpha = 0.8; g.strokeStyle = '#0ea5e9'; g.lineWidth = 3; for (let i = 0; i < 9; i++) { const x = OVALO.cx - OVALO.rx + (((t * 120 * d + i * 110) % (OVALO.rx * 2)) + OVALO.rx * 2) % (OVALO.rx * 2), y = f.y + ((i * 13) % 3 - 1) * f.meio * 0.5; g.beginPath(); g.moveTo(x - d * 14, y - 5); g.lineTo(x, y); g.lineTo(x - d * 14, y + 5); g.stroke(); g.globalAlpha = 0.25; g.beginPath(); g.moveTo(x - d * 50, y); g.lineTo(x - d * 16, y); g.stroke(); g.globalAlpha = 0.55; } }
  if (m.gelo) for (const [j, z] of m.gelo.entries()) { const f = (t * 0.4 + j * 0.31) % 1; g.globalAlpha = Math.sin(f * Math.PI) * 0.7; g.fillStyle = '#ffffff'; g.fillRect(Math.round(z.x - z.rx * 0.6 + f * z.rx * 1.2), Math.round(z.y - z.ry * 0.2), 3, 3); }
  g.globalAlpha = 1;
}
