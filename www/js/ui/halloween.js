// Tema de Halloween do menu: liga sozinho de 1º de outubro a 7 de novembro (dá para ligar ou desligar nos ajustes).
// Tudo desenhado por código: lua cheia, morcegos, cemitério no horizonte, abóboras acesas, fantasminhas e névoa.
import { ANCHO } from '../config.js';

export function emTemporada(d = new Date()) { const m = d.getMonth(), dia = d.getDate(); return m === 9 || (m === 10 && dia <= 7); }
export const halloweenAtivo = aj => aj?.halloween ?? emTemporada();

const LARANJA = ['#7a2e06', '#e0661a', '#ff9a2e', '#ffd36a'];

// céu: lua cheia com brilho e crateras, estrelas piscando
export function cieloHalloween(g, t, BX, BAJA) {
  const mx = BX + 236, my = 34 + BAJA;
  const hal = g.createRadialGradient(mx, my, 10, mx, my, 90);
  hal.addColorStop(0, 'rgba(255,214,140,0.35)'); hal.addColorStop(1, 'rgba(255,214,140,0)');
  g.fillStyle = hal; g.fillRect(mx - 90, my - 90, 180, 180);
  g.fillStyle = '#fff1c4'; g.beginPath(); g.arc(mx, my, 24, 0, 7); g.fill();
  g.fillStyle = '#f2d894'; g.beginPath(); g.arc(mx + 5, my + 3, 21, 0, 7); g.fill();
  g.fillStyle = '#fff1c4'; g.beginPath(); g.arc(mx - 3, my - 3, 19, 0, 7); g.fill();
  for (const [dx, dy, r] of [[-8, -6, 4], [6, 4, 3], [-2, 9, 2.5], [9, -8, 2]]) { g.fillStyle = '#e6c77e'; g.beginPath(); g.arc(mx + dx, my + dy, r, 0, 7); g.fill(); }
  const ex = (ANCHO - 640) / 2;
  for (let i = 0; i < 26; i++) {
    const x = -ex + ((i * 97.3) % (640 + ex * 2)), y = 6 + ((i * 53.7) % 120), k = Math.sin(t * 2 + i * 1.9);
    if (k < 0) continue;
    g.globalAlpha = k; g.fillStyle = i % 5 ? '#e9dcff' : '#ffb35a'; g.fillRect(Math.round(x), Math.round(y), i % 7 ? 1 : 2, i % 7 ? 1 : 2);
  }
  g.globalAlpha = 1;
}

// morcegos atravessando a tela em ondas, batendo as asas
export function murcielagos(g, t) {
  const ex = (ANCHO - 640) / 2, larg = 640 + ex * 2 + 80;
  for (let i = 0; i < 7; i++) {
    const vel = 26 + (i % 3) * 9, x = -ex - 40 + ((t * vel + i * 131) % larg), y = 20 + (i * 37) % 90 + Math.sin(t * 1.7 + i) * 8, s = i % 2 ? 1 : 0.75;
    const asa = Math.sin(t * 14 + i * 2) * 4 * s;
    g.fillStyle = '#120818';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 9 * s, y - 2 - asa); g.lineTo(x - 6 * s, y + 1); g.lineTo(x - 3 * s, y - 1); g.lineTo(x, y + 2);
    g.lineTo(x + 3 * s, y - 1); g.lineTo(x + 6 * s, y + 1); g.lineTo(x + 9 * s, y - 2 - asa); g.closePath(); g.fill();
    g.fillStyle = '#ff5a2a'; g.fillRect(Math.round(x - 1), Math.round(y), 1, 1); g.fillRect(Math.round(x + 1), Math.round(y), 1, 1);
  }
}

// cemitério recortado no horizonte, logo acima da linha do chão
export function horizonteHalloween(g, linha) {
  const ex = (ANCHO - 640) / 2;
  g.fillStyle = '#2b1745';
  for (let x = -ex - 20; x < 640 + ex + 20; x += 38) {
    const k = Math.abs(Math.sin(x * 0.37)), h = 8 + k * 8;
    if (k > 0.55) { g.fillRect(x + 2, linha - h - 6, 3, h + 6); g.fillRect(x - 2, linha - h - 2, 11, 3); }
    else { g.beginPath(); g.moveTo(x, linha); g.lineTo(x, linha - h); g.arc(x + 5, linha - h, 5, Math.PI, 0); g.lineTo(x + 10, linha); g.fill(); }
  }
  // árvores secas nas pontas
  for (const [x, esp] of [[-ex + 20, 1], [640 + ex - 24, -1]]) {
    g.strokeStyle = '#2b1745'; g.lineCap = 'round';
    g.lineWidth = 5; g.beginPath(); g.moveTo(x, linha); g.lineTo(x + esp * 4, linha - 60); g.stroke();
    g.lineWidth = 2;
    for (const [y0, dx, dy] of [[-48, 18, -14], [-36, -14, -12], [-56, 10, -18], [-26, 16, -6]]) { g.beginPath(); g.moveTo(x + esp * 3, linha + y0); g.lineTo(x + esp * (3 + dx), linha + y0 + dy); g.stroke(); }
    g.lineCap = 'butt';
  }
}

// abóbora acesa: gomos laranja, cabinho, olhos e boca com a luz da vela tremendo
export function calabaza(g, x, y, t, s = 1, semente = 0) {
  const luz = 0.7 + 0.3 * Math.sin(t * 9 + semente * 3) * Math.sin(t * 13 + semente);
  const glow = g.createRadialGradient(x, y - 6 * s, 2, x, y - 6 * s, 26 * s);
  glow.addColorStop(0, `rgba(255,150,40,${0.35 * luz})`); glow.addColorStop(1, 'rgba(255,150,40,0)');
  g.fillStyle = glow; g.fillRect(x - 26 * s, y - 32 * s, 52 * s, 52 * s);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, y, 13 * s, 3 * s, 0, 0, 7); g.fill();
  g.fillStyle = '#3a6a1a'; g.fillRect(Math.round(x - 1.5 * s), Math.round(y - 19 * s), Math.round(3 * s), Math.round(5 * s));
  for (const [dx, w, c] of [[-5, 7, LARANJA[1]], [5, 7, LARANJA[1]], [0, 7, LARANJA[2]]]) { g.fillStyle = c; g.beginPath(); g.ellipse(x + dx * s, y - 8 * s, w * s, 8 * s, 0, 0, 7); g.fill(); }
  g.strokeStyle = LARANJA[0]; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y - 8 * s, 12 * s, 8 * s, 0, 0, 7); g.stroke();
  g.fillStyle = luz > 0.75 ? '#ffe680' : '#ffc23a';
  for (const lado of [-1, 1]) { g.beginPath(); g.moveTo(x + lado * 2 * s, y - 11 * s); g.lineTo(x + lado * 7 * s, y - 11 * s); g.lineTo(x + lado * 4.5 * s, y - 14 * s); g.closePath(); g.fill(); }
  g.beginPath(); g.moveTo(x - 7 * s, y - 6 * s); g.lineTo(x - 4 * s, y - 4 * s); g.lineTo(x - 2 * s, y - 6 * s); g.lineTo(x, y - 4 * s); g.lineTo(x + 2 * s, y - 6 * s); g.lineTo(x + 4 * s, y - 4 * s); g.lineTo(x + 7 * s, y - 6 * s); g.lineTo(x + 5 * s, y - 2 * s); g.lineTo(x - 5 * s, y - 2 * s); g.closePath(); g.fill();
}

// fantasminha flutuando, com barra ondulada e olhinhos
export function fantasma(g, x, y, t, fase = 0) {
  const yy = y + Math.sin(t * 2.4 + fase) * 4, al = 0.65 + 0.2 * Math.sin(t * 3 + fase);
  g.globalAlpha = al;
  g.fillStyle = '#f2ecff';
  g.beginPath(); g.moveTo(x - 9, yy + 8); g.lineTo(x - 9, yy - 2); g.arc(x, yy - 2, 9, Math.PI, 0);
  for (let i = 0; i <= 6; i++) { const px = x + 9 - i * 3, py = yy + 8 + (i % 2 ? -3 : 0) + Math.sin(t * 8 + i + fase) * 1; g.lineTo(px, py); }
  g.closePath(); g.fill();
  g.fillStyle = '#2a1640'; g.fillRect(Math.round(x - 4), Math.round(yy - 4), 2, 3); g.fillRect(Math.round(x + 2), Math.round(yy - 4), 2, 3);
  g.fillRect(Math.round(x - 1), Math.round(yy + 1), 2, 2);
  g.globalAlpha = 1;
}

// névoa roxa andando devagar pelo chão
export function nevoa(g, t, y) {
  const ex = (ANCHO - 640) / 2;
  for (let i = 0; i < 8; i++) {
    const x = -ex - 60 + ((t * (8 + i % 3 * 4) + i * 110) % (640 + ex * 2 + 120));
    g.globalAlpha = 0.1 + (i % 3) * 0.04; g.fillStyle = '#b9a4e6';
    g.beginPath(); g.ellipse(x, y + (i % 3) * 7, 60, 7, 0, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}

// chapéu de bruxa para pôr em cima da pokébola do logo
export function sombrero(g, x, y) {
  g.fillStyle = '#04102c'; g.beginPath(); g.ellipse(x, y + 1, 21, 5, -0.12, 0, 7); g.fill();
  g.fillStyle = '#1c1030'; g.beginPath(); g.ellipse(x, y, 19, 4, -0.12, 0, 7); g.fill();
  g.beginPath(); g.moveTo(x - 10, y - 1); g.quadraticCurveTo(x - 4, y - 18, x + 6, y - 30); g.quadraticCurveTo(x + 4, y - 16, x + 11, y - 2); g.closePath(); g.fill();
  g.fillStyle = '#9b4dff'; g.beginPath(); g.moveTo(x - 10, y - 2); g.lineTo(x + 11, y - 3); g.lineTo(x + 10, y - 7); g.lineTo(x - 8.5, y - 6); g.closePath(); g.fill();
  g.fillStyle = '#ffd23c'; g.fillRect(Math.round(x - 1), Math.round(y - 7), 4, 4); g.fillStyle = '#1c1030'; g.fillRect(Math.round(x), Math.round(y - 6), 2, 2);
}
