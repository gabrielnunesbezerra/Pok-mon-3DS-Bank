// Símbolos das skills desenhados em vetor: um por forma de skill (a mesma lista do motor).
// Cada símbolo cabe num quadrado de -1 a 1; contorno escuro por baixo e traço claro por cima.
const CONTORNO = '#04102c';

const arco = (g, x, y, r, a0 = 0, a1 = 6.2832) => { g.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r); g.arc(x, y, r, a0, a1); };
const pol = (g, pts, cerrar) => { pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (cerrar) g.closePath(); };

// cada desenho recebe g já com escala aplicada e devolve se deve preencher (true) ou só traçar
const GLIFOS = {
  proyectil: g => { arco(g, 0.3, 0, 0.42); pol(g, [[-0.15, -0.35], [-0.95, -0.35]]); pol(g, [[-0.3, 0], [-1, 0]]); pol(g, [[-0.15, 0.35], [-0.95, 0.35]]); return 'bola'; },
  crecimiento: g => { pol(g, [[0, 0.85], [0, -0.65]]); pol(g, [[-0.55, -0.15], [0, -0.75], [0.55, -0.15]]); pol(g, [[-0.4, 0.85], [0.4, 0.85]]); },
  dash: g => { pol(g, [[-0.85, -0.6], [-0.25, 0], [-0.85, 0.6]]); pol(g, [[0, -0.6], [0.6, 0], [0, 0.6]]); },
  chorro: g => { g.moveTo(-0.95, 0); g.bezierCurveTo(-0.6, -0.7, -0.3, 0.7, 0, 0); g.bezierCurveTo(0.3, -0.7, 0.6, 0.7, 0.95, 0); },
  helice: g => { for (let i = 0; i < 3; i++) arco(g, 0, 0, 0.75, i * 2.0944, i * 2.0944 + 1.3); arco(g, 0, 0, 0.12); return 'bola'; },
  tajo: g => { for (const o of [-0.55, 0, 0.55]) pol(g, [[-0.65 + o, -0.85], [0.15 + o, 0.85]]); },
  golpe: g => { const p = []; for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8, r = i % 2 ? 0.45 : 1; p.push([Math.cos(a) * r, Math.sin(a) * r]); } pol(g, p, true); return 'lleno'; },
  cono: g => { pol(g, [[-0.9, 0], [0.9, -0.75], [0.9, 0.75]], true); return 'lleno'; },
  pulso: g => { arco(g, 0, 0, 0.3); arco(g, 0, 0, 0.7); pol(g, [[0, -1], [0, -0.85]]); pol(g, [[0, 1], [0, 0.85]]); pol(g, [[-1, 0], [-0.85, 0]]); pol(g, [[1, 0], [0.85, 0]]); },
  burbujas: g => { arco(g, -0.35, 0.3, 0.38); arco(g, 0.4, -0.05, 0.28); arco(g, -0.05, -0.62, 0.2); },
  caparazon: g => { pol(g, [[0, -0.95], [0.8, -0.55], [0.72, 0.3], [0, 0.95], [-0.72, 0.3], [-0.8, -0.55]], true); },
  viento: g => { g.moveTo(-0.9, -0.45); g.bezierCurveTo(0, -0.9, 0.9, -0.5, 0.5, -0.1); g.moveTo(-0.9, 0.05); g.bezierCurveTo(-0.1, -0.3, 0.9, 0.2, 0.7, 0.55); g.moveTo(-0.7, 0.6); g.bezierCurveTo(-0.2, 0.9, 0.4, 0.9, 0.5, 0.65); },
  lluvia: g => { for (const o of [-0.65, 0, 0.65]) { pol(g, [[o - 0.15, -0.9], [o + 0.1, -0.15]]); arco(g, o + 0.12, 0.35, 0.2); } },
  vuelo: g => { g.moveTo(0, 0.35); g.bezierCurveTo(-0.3, -0.6, -0.7, -0.7, -0.98, -0.3); g.bezierCurveTo(-0.6, -0.35, -0.5, 0, -0.35, 0.3); g.moveTo(0, 0.35); g.bezierCurveTo(0.3, -0.6, 0.7, -0.7, 0.98, -0.3); g.bezierCurveTo(0.6, -0.35, 0.5, 0, 0.35, 0.3); },
  erupcion: g => { pol(g, [[-0.85, 0.85], [-0.2, -0.1], [0.2, -0.1], [0.85, 0.85]], true); pol(g, [[0, -0.35], [0, -0.95]]); pol(g, [[-0.45, -0.25], [-0.7, -0.8]]); pol(g, [[0.45, -0.25], [0.7, -0.8]]); },
  patada: g => { pol(g, [[-0.5, -0.9], [-0.5, 0.25], [0.5, 0.25], [0.85, 0.7], [-0.5, 0.7]], true); pol(g, [[0.55, -0.4], [0.95, -0.7]]); pol(g, [[0.5, -0.05], [1, -0.1]]); },
  descanso: g => { pol(g, [[-0.8, -0.8], [0, -0.8], [-0.8, 0], [0, 0]]); pol(g, [[0.2, 0.15], [0.7, 0.15], [0.2, 0.65], [0.7, 0.65]]); },
  meteoro: g => { arco(g, 0.35, 0.35, 0.42); pol(g, [[0.1, 0.0], [-0.8, -0.8]]); pol(g, [[-0.05, 0.2], [-0.9, -0.2]]); pol(g, [[0.2, -0.1], [-0.2, -0.95]]); return 'bola'; },
  rafaga: g => { for (const y of [-0.62, 0, 0.62]) { pol(g, [[-0.8, y], [0.25, y]]); arco(g, 0.6, y, 0.14); } },
  clones: g => { arco(g, -0.38, -0.45, 0.27); g.moveTo(-0.85, 0.85); g.quadraticCurveTo(-0.38, -0.2, 0.09, 0.85); arco(g, 0.42, -0.35, 0.27); g.moveTo(-0.05, 0.85); g.quadraticCurveTo(0.42, -0.1, 0.9, 0.85); },
  humo: g => { arco(g, -0.4, 0.2, 0.4, 1.5708, 4.7124); arco(g, 0.0, -0.15, 0.5, 3.1416, 6.2832); arco(g, 0.45, 0.2, 0.4, 4.7124, 7.854); pol(g, [[-0.4, 0.6], [0.45, 0.6]]); },
  embestidas: g => { pol(g, [[-0.9, 0.9], [0.4, -0.4]]); pol(g, [[-0.2, -0.45], [0.5, -0.5], [0.45, 0.2]]); pol(g, [[0.6, 0.3], [0.95, 0.6]]); pol(g, [[0.2, 0.55], [0.3, 0.95]]); },
  bombaLodo: g => { arco(g, -0.1, 0.25, 0.55); g.moveTo(0.2, -0.2); g.quadraticCurveTo(0.45, -0.6, 0.8, -0.55); pol(g, [[0.8, -0.95], [0.8, -0.35]]); pol(g, [[0.55, -0.75], [1, -0.75]]); return 'bola'; },
  plantaFeroz: g => { g.moveTo(-0.8, 0.8); g.quadraticCurveTo(-0.9, -0.7, 0.85, -0.85); g.quadraticCurveTo(0.9, 0.7, -0.8, 0.8); pol(g, [[-0.8, 0.8], [0.3, -0.3]]); },
  arraigo: g => { pol(g, [[0, -0.9], [0, 0.15]]); pol(g, [[0, 0.15], [-0.65, 0.9]]); pol(g, [[0, 0.15], [0, 0.95]]); pol(g, [[0, 0.15], [0.65, 0.9]]); pol(g, [[-0.4, -0.4], [0, -0.1]]); pol(g, [[0.4, -0.55], [0, -0.2]]); },
  torreta: g => { pol(g, [[0, -0.9], [0.55, -0.1], [0, 0.6], [-0.55, -0.1]], true); pol(g, [[-0.8, 0.9], [0.8, 0.9]]); },
  lanzaTorretas: g => { pol(g, [[-0.9, 0.4], [-0.5, -0.1], [-0.1, 0.4], [-0.5, 0.9]], true); pol(g, [[0.1, -0.2], [0.9, -0.85]]); pol(g, [[0.5, -0.85], [0.9, -0.85], [0.9, -0.45]]); },
  geiser: g => { pol(g, [[-0.8, 0.85], [0.8, 0.85]]); g.moveTo(-0.3, 0.85); g.quadraticCurveTo(-0.45, -0.2, -0.1, -0.85); g.moveTo(0.3, 0.85); g.quadraticCurveTo(0.45, -0.2, 0.1, -0.85); },
  laco: g => { arco(g, 0.35, -0.35, 0.45); g.moveTo(-0.9, 0.9); g.quadraticCurveTo(-0.6, -0.1, 0.0, 0.0); },
  chapoteo: g => { arco(g, 0, 0.1, 0.55, 3.4, 6.0); pol(g, [[-0.8, 0.75], [-0.4, 0.5], [0, 0.75], [0.4, 0.5], [0.8, 0.75]]); pol(g, [[-0.3, -0.5], [-0.5, -0.85]]); pol(g, [[0.3, -0.5], [0.5, -0.85]]); },
  potenciar: g => { pol(g, [[-0.7, 0.2], [0, -0.55], [0.7, 0.2]]); pol(g, [[-0.7, 0.75], [0, 0.0], [0.7, 0.75]]); pol(g, [[0, -0.95], [0, -0.6]]); },
  escudo: g => { pol(g, [[0, -0.9], [0.75, -0.55], [0.6, 0.35], [0, 0.9], [-0.6, 0.35], [-0.75, -0.55]], true); pol(g, [[0, -0.5], [0, 0.5]]); },
  explosion: g => { const p = []; for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8, r = i % 2 ? 0.4 : 0.95; p.push([Math.cos(a) * r, Math.sin(a) * r]); } pol(g, p, true); },
  trampa: g => { arco(g, -0.3, 0.1, 0.4); arco(g, 0.3, 0.1, 0.4); pol(g, [[-0.9, 0.8], [0.9, 0.8]]); },
  torbellino: g => { arco(g, 0, -0.55, 0.75, 3.4, 6.0); arco(g, 0, -0.05, 0.5, 3.4, 6.0); arco(g, 0, 0.4, 0.28, 3.4, 6.0); pol(g, [[0, 0.65], [0, 0.95]]); },
  // símbolos de interface
  mega: g => { pol(g, [[0, -0.95], [0.75, 0], [0, 0.95], [-0.75, 0]], true); pol(g, [[-0.28, 0.05], [0, -0.3], [0.28, 0.05]]); pol(g, [[-0.28, 0.4], [0, 0.05], [0.28, 0.4]]); },
  evo: g => { pol(g, [[-0.55, 0.15], [0, -0.5], [0.55, 0.15]]); pol(g, [[-0.55, 0.7], [0, 0.05], [0.55, 0.7]]); pol(g, [[0, -0.95], [0, -0.7]]); },
  ulti: g => { const p = []; for (let i = 0; i < 10; i++) { const a = -1.5708 + (i * Math.PI) / 5, r = i % 2 ? 0.42 : 1; p.push([Math.cos(a) * r, Math.sin(a) * r]); } pol(g, p, true); return 'lleno'; },
  pausa: g => { g.rect(-0.55, -0.7, 0.35, 1.4); g.rect(0.2, -0.7, 0.35, 1.4); return 'lleno'; },
  basico: g => { const p = []; for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6, r = i % 2 ? 0.5 : 1; p.push([Math.cos(a) * r, Math.sin(a) * r]); } pol(g, p, true); return 'lleno'; },
};

// Desenha o símbolo `forma` centrado em (x, y) com meia-largura r.
export function icono(g, forma, x, y, r, color = '#ffffff') {
  const dib = GLIFOS[forma] ?? GLIFOS.basico;
  g.save();
  g.translate(x, y); g.scale(r, r);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [c, w] of [[CONTORNO, 0.5], [color, 0.26]]) {
    g.beginPath();
    const modo = dib(g);
    g.strokeStyle = c; g.fillStyle = c; g.lineWidth = w;
    if (modo) g.fill();
    g.stroke();
  }
  g.restore();
}

export const hayIcono = forma => forma in GLIFOS;

// mistura de cores '#rrggbb' com branco (k > 0) ou preto (k < 0)
export function tono(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
