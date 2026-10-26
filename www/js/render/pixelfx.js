// Biblioteca de pixel art para os efeitos: primitivas que desenham pixel a pixel (círculos, anéis, linhas, esferas
// sombreadas) e geradores de sprites pequenos (chama, gota, folha, faísca, fumaça, bolha, rocha, coração, shuriken).
// Os sprites são desenhados uma vez em canvas pequenos e guardados; o resto do jogo só os carimba na tela.
const R = Math.round;
const CONTORNO = '#04102c';
const memo = new Map();
export const limparMemo = () => memo.clear();

function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}
export function guardado(clave, w, h, dibujar) {
  let c = memo.get(clave);
  if (!c) { const [cv, g] = lienzo(w, h); dibujar(g, cv.width, cv.height); memo.set(clave, cv); c = cv; }
  return c;
}

// ---------------------------------------------------------------- primitivas
export function disco(g, cx, cy, r, c) {
  g.fillStyle = c; cx = R(cx); cy = R(cy);
  const ri = Math.ceil(r), rr = (r + 0.5) * (r + 0.5);
  for (let y = -ri; y <= ri; y++) { const w = Math.floor(Math.sqrt(Math.max(0, rr - y * y))); g.fillRect(cx - w, cy + y, w * 2 + 1, 1); }
}
export function elipsePix(g, cx, cy, rx, ry, c) {
  g.fillStyle = c; cx = R(cx); cy = R(cy);
  const yi = Math.ceil(ry);
  for (let y = -yi; y <= yi; y++) { const k = 1 - (y * y) / ((ry + 0.5) * (ry + 0.5)); if (k < 0) continue; const w = Math.floor((rx + 0.5) * Math.sqrt(k)); g.fillRect(cx - w, cy + y, w * 2 + 1, 1); }
}
export function lineaPix(g, x0, y0, x1, y1, c, w = 1) {
  x0 = R(x0); y0 = R(y0); x1 = R(x1); y1 = R(y1);
  // grossa: um traço só (bem mais leve que carimbar um quadrado w x w em cada pixel)
  if (w >= 3) {
    g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'square'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    return;
  }
  g.fillStyle = c;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, h = Math.floor(w / 2);
  for (let i = 0; i < 600; i++) {
    g.fillRect(x0 - h, y0 - h, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
// anel de pixels (elipse vazada); `huecos` abre falhas para parecer energia em movimento
export function anilloPix(g, cx, cy, rx, ry, c, grosor = 1, huecos = 0, fase = 0) {
  g.fillStyle = c;
  const n = Math.max(12, Math.ceil((rx + ry) * 3));
  for (let i = 0; i < n; i++) {
    if (huecos && ((i + fase) % huecos) === 0) continue;
    const a = (i / n) * Math.PI * 2;
    g.fillRect(R(cx + Math.cos(a) * rx), R(cy + Math.sin(a) * ry), grosor, grosor);
  }
}
// esfera com contorno e três tons de luz; rampa = [sombra, base, luz, brilho]
export function esfera(g, cx, cy, r, rampa, contorno = CONTORNO) {
  disco(g, cx, cy, r + 1, contorno);
  disco(g, cx, cy, r, rampa[0]);
  disco(g, cx - r * 0.12, cy - r * 0.14, r * 0.84, rampa[1]);
  disco(g, cx - r * 0.3, cy - r * 0.34, r * 0.5, rampa[2]);
  disco(g, cx - r * 0.38, cy - r * 0.42, Math.max(0.5, r * 0.2), rampa[3]);
}
// faixa tracejada (xadrez) entre duas cores: dá meio-tom sem borrar
export function tramado(g, x, y, w, h, c1, c2, fase = 0) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { g.fillStyle = (i + j + fase) % 2 ? c1 : c2; g.fillRect(x + i, y + j, 1, 1); }
}

// ---------------------------------------------------------------- cores
function mezclar(c, k) {
  const n = parseInt(c.slice(1), 16), t = k > 0 ? 255 : 0, a = Math.abs(k);
  const f = v => Math.round(v + (t - v) * a);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
// rampa de 4 tons a partir de uma cor base
export const rampaDe = c => [mezclar(c, -0.45), c, mezclar(c, 0.45), mezclar(c, 0.85)];
export const RAMPA_FOGO = ['#a01c14', '#ff6a1a', '#ffb52e', '#fff3b0'];
export const RAMPA_AGUA = ['#1f5ec4', '#4aa3f0', '#9fdcff', '#ffffff'];

// ---------------------------------------------------------------- sprites
// chama de 4 quadros, apontando para cima, com camadas (borda, miolo, centro, núcleo)
export function llama(frame, tam, rampa = RAMPA_FOGO) {
  const h = Math.round(tam * 1.5);
  return guardado(`llama${frame % 4}-${tam}-${rampa.join()}`, tam + 4, h + 2, (g, W, H) => {
    const cx = W / 2, f = frame % 4;
    [[1, 0, rampa[0]], [0.76, 0.14, rampa[1]], [0.5, 0.3, rampa[2]], [0.26, 0.5, rampa[3]]].forEach(([e, arriba, color]) => {
      g.fillStyle = color;
      for (let y = Math.round(H * arriba); y < H - 1; y++) {
        const t = (y - H * arriba) / (H - 1 - H * arriba);      // 0 na ponta, 1 na base
        const ancho = (tam / 2) * e * Math.pow(Math.sin(Math.min(1, t * 1.1) * Math.PI / 2), 0.85) * (t > 0.86 ? Math.cos(((t - 0.86) / 0.14) * Math.PI / 2) * 0.35 + 0.65 : 1);
        const desvio = Math.sin(f * 1.7 + t * 5.5) * (1 - t) * tam * 0.2;
        const w = Math.max(0, Math.round(ancho));
        if (w >= 0) g.fillRect(Math.round(cx + desvio - w), y, w * 2 + 1, 1);
      }
    });
    // contorno escuro por fora
    const dat = g.getImageData(0, 0, W, H), d = dat.data, copia = new Uint8ClampedArray(d);
    const [or, og, ob] = [60, 8, 8];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (copia[i + 3]) continue;
      const vec = (x > 0 && copia[i - 4 + 3]) || (x < W - 1 && copia[i + 4 + 3]) || (y > 0 && copia[i - W * 4 + 3]) || (y < H - 1 && copia[i + W * 4 + 3]);
      if (vec) { d[i] = or; d[i + 1] = og; d[i + 2] = ob; d[i + 3] = 255; }
    }
    g.putImageData(dat, 0, 0);
  });
}

// gota apontando para a direita
export function gota(L, rampa = RAMPA_AGUA) {
  return guardado(`gota${L}-${rampa.join()}`, L + 4, Math.ceil(L * 0.7) + 4, (g, W, H) => {
    const cy = H / 2;
    for (const [grow, color] of [[1.5, CONTORNO], [0.5, rampa[0]], [-0.4, rampa[1]]]) {
      g.fillStyle = color;
      for (let x = 0; x < L; x++) {
        const t = x / (L - 1), semi = (L * 0.3) * Math.pow(Math.sin((1 - t) * Math.PI / 2 * 1.05), 0.8) * (t < 0.15 ? 0.55 + t * 3 : 1) + grow;
        const h = Math.max(0, Math.round(semi));
        g.fillRect(2 + x, Math.round(cy - h), 1, h * 2 + 1);
      }
    }
    g.fillStyle = rampa[2]; g.fillRect(2 + Math.round(L * 0.45), Math.round(cy - L * 0.2), Math.max(1, Math.round(L * 0.25)), 1);
    g.fillStyle = rampa[3]; g.fillRect(2 + Math.round(L * 0.5), Math.round(cy - L * 0.2), Math.max(1, Math.round(L * 0.1)), 1);
  });
}

// folha (lente com nervura) apontando para a direita
export function hoja(L, verde = ['#1f6a28', '#4caf38', '#8be04e', '#d7ffa0']) {
  return guardado(`hoja${L}-${verde.join()}`, L + 4, Math.ceil(L * 0.6) + 4, (g, W, H) => {
    const cy = Math.floor(H / 2);
    for (const [grow, color] of [[1, CONTORNO], [0, verde[0]]]) {
      g.fillStyle = color;
      for (let x = -grow; x < L + grow; x++) {
        const t = Math.min(1, Math.max(0, x / (L - 1))), semi = Math.sin(t * Math.PI) * L * 0.26 + grow;
        const h = Math.max(0, Math.round(semi));
        g.fillRect(2 + x, cy - h, 1, h * 2 + 1);
      }
    }
    for (let x = 1; x < L - 1; x++) {
      const t = x / (L - 1), semi = Math.round(Math.sin(t * Math.PI) * L * 0.26);
      g.fillStyle = verde[1]; g.fillRect(2 + x, cy - semi + 1, 1, Math.max(0, semi * 2 - 1));
      g.fillStyle = verde[2]; g.fillRect(2 + x, cy - semi + 1, 1, Math.max(0, Math.round(semi * 0.8)));
    }
    g.fillStyle = verde[0]; g.fillRect(2, cy, L, 1);
    g.fillStyle = verde[3]; g.fillRect(2 + Math.round(L * 0.3), cy - Math.round(L * 0.12), Math.max(1, Math.round(L * 0.25)), 1);
  });
}

// faísca de quatro pontas
export function chispa(tam, color = '#ffffff') {
  return guardado(`chispa${tam}-${color}`, tam * 2 + 3, tam * 2 + 3, (g, W) => {
    const c = Math.floor(W / 2);
    g.fillStyle = CONTORNO;
    g.fillRect(c - 1, c - tam - 1, 3, tam * 2 + 3); g.fillRect(c - tam - 1, c - 1, tam * 2 + 3, 3);
    g.fillStyle = color;
    for (let i = 0; i <= tam; i++) { const w = i < tam * 0.5 ? 1 : 0; g.fillRect(c - w, c - tam + i, w * 2 + 1, 1); g.fillRect(c - w, c + tam - i, w * 2 + 1, 1); g.fillRect(c - tam + i, c - w, 1, w * 2 + 1); g.fillRect(c + tam - i, c - w, 1, w * 2 + 1); }
    g.fillStyle = '#ffffff'; g.fillRect(c, c, 1, 1);
  });
}

// nuvem de fumaça: discos sobrepostos em três tons, com meio-tom na borda
export function humo(tam, tono = ['#4a4a5c', '#7c7c90', '#b4b4c4']) {
  return guardado(`humo${tam}-${tono.join()}`, tam * 2 + 4, tam * 2 + 4, (g, W) => {
    const c = W / 2, semilla = [[0, 0, 1], [-0.45, 0.2, 0.62], [0.5, 0.15, 0.6], [0.05, -0.45, 0.58], [-0.1, 0.45, 0.5]];
    for (const [k, color] of [[1.12, tono[0]], [1, tono[1]], [0.62, tono[2]]]) for (const [dx, dy, r] of semilla) disco(g, c + dx * tam * 0.5, c + dy * tam * 0.5, tam * 0.5 * r * k, color);
  });
}

// bolha: anel com brilho
export function burbuja(r, color = '#bfe9ff') {
  return guardado(`burbuja${r}-${color}`, r * 2 + 5, r * 2 + 5, (g, W) => {
    const c = Math.floor(W / 2);
    anilloPix(g, c, c, r + 1, r + 1, CONTORNO, 2);
    anilloPix(g, c, c, r, r, color, 1);
    g.fillStyle = 'rgba(255,255,255,0.22)'; disco(g, c, c, r - 1, 'rgba(160,220,255,0.2)');
    g.fillStyle = '#ffffff'; g.fillRect(c - Math.round(r * 0.55), c - Math.round(r * 0.45), Math.max(1, Math.round(r * 0.3)), 1); g.fillRect(c - Math.round(r * 0.55), c - Math.round(r * 0.45), 1, Math.max(1, Math.round(r * 0.3)));
    g.fillRect(c + Math.round(r * 0.35), c + Math.round(r * 0.35), 1, 1);
  });
}

// bolha cheia e brilhante (Bubble Beam), como as do site
export function burbujaLlena(r) {
  return guardado(`burbujaL${r}`, r * 2 + 5, r * 2 + 5, (g, W) => {
    const c = Math.floor(W / 2);
    disco(g, c, c, r + 1, CONTORNO);
    disco(g, c, c, r, '#2f7fe0');
    disco(g, c - r * 0.15, c - r * 0.15, r * 0.78, '#5aa8f5');
    disco(g, c - r * 0.3, c - r * 0.3, r * 0.45, '#9fd6ff');
    disco(g, c - r * 0.4, c - r * 0.42, Math.max(1, r * 0.2), '#ffffff');
    g.fillStyle = '#cfeaff'; g.fillRect(c + Math.round(r * 0.35), c + Math.round(r * 0.3), 1, 1);
  });
}

// nota musical (Sing, Perish Song): cabeça oval, haste e bandeirinha, com contorno escuro
export function nota(tam = 6, color = '#ffffff') {
  return guardado(`nota${tam}-${color}`, tam * 2 + 6, tam * 3 + 6, (g, W, H) => {
    const cx = Math.floor(W / 2) - 1, base = H - 4;
    for (const [c, k] of [[CONTORNO, 1], [color, 0]]) {
      g.fillStyle = c;
      g.beginPath(); g.ellipse(cx - 1, base - 1, tam * 0.55 + k, tam * 0.4 + k, -0.4, 0, Math.PI * 2); g.fill();
      g.fillRect(cx + Math.round(tam * 0.35) - k, base - tam * 2.4 - k, 2 + k * 2, tam * 2.3 + k);
      g.fillRect(cx + Math.round(tam * 0.35) - k, base - tam * 2.4 - k, Math.round(tam * 0.9) + k * 2, 2 + k * 2);
    }
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(cx - 2, base - 2, 1, 1);
  });
}
// triângulo de energia (Tri Attack): uma ponta para cada tipo
export function triangulo(tam, rampa) {
  return guardado(`tri${tam}-${rampa.join()}`, tam * 2 + 6, tam * 2 + 6, (g, W) => {
    const c = W / 2, tri = (k, color) => { g.fillStyle = color; g.beginPath(); for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i * Math.PI * 2) / 3; (i ? g.lineTo : g.moveTo).call(g, c + Math.cos(a) * tam * k, c + Math.sin(a) * tam * k); } g.closePath(); g.fill(); };
    tri(1.25, CONTORNO); tri(1, rampa[0]); tri(0.75, rampa[1]); tri(0.4, rampa[2]);
  });
}
// mira (Lock-On): quatro cantos e um ponto no meio
export function mira(tam, color = '#ff3a3a') {
  return guardado(`mira${tam}-${color}`, tam * 2 + 6, tam * 2 + 6, (g, W) => {
    const c = Math.floor(W / 2), r = tam, L = Math.max(2, Math.round(tam * 0.5));
    for (const [cor, w] of [[CONTORNO, 3], [color, 1]]) {
      g.fillStyle = cor;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = c + sx * r, y = c + sy * r; g.fillRect(Math.min(x, x - sx * L) - (w - 1) / 2, y - (w - 1) / 2, L + w - 1, w); g.fillRect(x - (w - 1) / 2, Math.min(y, y - sy * L) - (w - 1) / 2, w, L + w - 1); }
      g.fillRect(c - (w - 1) / 2, c - (w - 1) / 2, w, w);
    }
  });
}
// cruz verde de cura (Recover)
export function cruzCura(tam = 3) {
  return guardado(`cruz${tam}`, tam * 3 + 4, tam * 3 + 4, (g) => {
    const c = 2;
    g.fillStyle = CONTORNO; g.fillRect(c + tam - 1, c - 1, tam + 2, tam * 3 + 2); g.fillRect(c - 1, c + tam - 1, tam * 3 + 2, tam + 2);
    g.fillStyle = '#3ccf4e'; g.fillRect(c + tam, c, tam, tam * 3); g.fillRect(c, c + tam, tam * 3, tam);
    g.fillStyle = '#b6f5be'; g.fillRect(c + tam, c, 1, tam * 3);
  });
}

// rocha irregular com faces
export function roca(tam, tono = ['#6b5a1e', '#a68c3a', '#c9b469', '#efe3a8']) {
  return guardado(`roca${tam}-${tono.join()}`, tam * 2 + 4, tam * 2 + 4, (g, W) => {
    const c = W / 2, pts = [[-1, -0.35], [-0.6, -0.95], [0.35, -1], [1, -0.4], [0.9, 0.55], [0.2, 1], [-0.7, 0.85]];
    const poli = (k, color) => { g.fillStyle = color; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(c + x * tam * k, c + y * tam * k) : g.moveTo(c + x * tam * k, c + y * tam * k))); g.closePath(); g.fill(); };
    poli(1.18, CONTORNO); poli(1, tono[0]);
    g.save(); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(c + x * tam, c + y * tam) : g.moveTo(c + x * tam, c + y * tam))); g.closePath(); g.clip();
    g.fillStyle = tono[1]; g.fillRect(0, 0, W, c * 0.95); g.fillStyle = tono[2]; g.fillRect(0, 0, c * 0.9, c * 0.8); g.fillStyle = tono[3]; g.fillRect(c * 0.35, c * 0.3, Math.max(1, tam * 0.35), 1);
    g.fillStyle = tono[0]; g.fillRect(c * 1.1, c * 1.1, W, W);
    g.restore();
  });
}

// coração de pixels
export function corazon(s, rosa = ['#b8326e', '#ff6fa8', '#ffc2d8']) {
  const m = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  return guardado(`corazon${s}-${rosa.join()}`, 9 * s, 8 * s, (g) => {
    const cel = (x, y, c) => { g.fillStyle = c; g.fillRect((x + 1) * s, (y + 1) * s, s, s); };
    m.forEach((fila, y) => [...fila].forEach((ch, x) => { if (ch === 'X') for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { g.fillStyle = CONTORNO; g.fillRect((x + 1 + dx) * s, (y + 1 + dy) * s, s, s); } }));
    m.forEach((fila, y) => [...fila].forEach((ch, x) => { if (ch === 'X') cel(x, y, y > 3 || x > 4 ? rosa[0] : rosa[1]); }));
    cel(1, 1, rosa[2]); cel(2, 1, rosa[2]);
  });
}

// shuriken de quatro pontas com furo
export function shuriken(r, rampa = ['#1f5ec4', '#4aa3f0', '#cfeeff']) {
  return guardado(`shuri${r}-${rampa.join()}`, r * 2 + 6, r * 2 + 6, (g, W) => {
    const c = W / 2;
    const estrela = (k, color) => { g.fillStyle = color; g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2, rr = (i % 2 ? r * 0.44 : r) * k; (i ? g.lineTo : g.moveTo).call(g, c + Math.cos(a) * rr, c + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    estrela(1.2, CONTORNO); estrela(1, rampa[0]); estrela(0.78, rampa[1]); estrela(0.4, rampa[2]);
    disco(g, c, c, Math.max(1, r * 0.16), CONTORNO);
  });
}

// estouro de impacto: raios que crescem e somem em 4 quadros
export function estouro(frame, r, color = '#ffffff', brillo = '#ffd23c') {
  return guardado(`estouro${frame}-${r}-${color}-${brillo}`, r * 2 + 6, r * 2 + 6, (g, W) => {
    const c = W / 2, k = [0.55, 0.85, 1, 0.8][frame % 4], n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (frame % 2) * 0.2, largo = r * k * (i % 2 ? 0.62 : 1), x1 = c + Math.cos(a) * largo, y1 = c + Math.sin(a) * largo;
      lineaPix(g, c + Math.cos(a) * r * 0.2, c + Math.sin(a) * r * 0.2, x1, y1, CONTORNO, 3);
    }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (frame % 2) * 0.2, largo = r * k * (i % 2 ? 0.62 : 1);
      lineaPix(g, c + Math.cos(a) * r * 0.2, c + Math.sin(a) * r * 0.2, c + Math.cos(a) * largo, c + Math.sin(a) * largo, i % 2 ? brillo : color, 1);
    }
    disco(g, c, c, r * 0.28 * k + 1, CONTORNO); disco(g, c, c, r * 0.28 * k, brillo); disco(g, c, c, r * 0.14 * k, color);
  });
}

// arco de pixels com espessura que afina nas pontas (lua crescente); a0..a1 em radianos
export function arcoPix(g, cx, cy, r, a0, a1, color, grosor = 3, ry = r) {
  g.fillStyle = color;
  const n = Math.max(10, Math.ceil(Math.abs(a1 - a0) * r * 1.2));
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = a0 + (a1 - a0) * u, w = Math.max(1, Math.round(grosor * Math.sin(u * Math.PI) + 0.4));
    g.fillRect(R(cx + Math.cos(a) * r - w / 2), R(cy + Math.sin(a) * ry - w / 2), w, w);
  }
}

// lua crescente apontando para a direita (corte de ar, onda de vácuo)
export function mediaLuna(r, rampa) {
  return guardado(`luna${r}-${rampa.join()}`, r * 2 + 8, r * 2 + 8, (g, W) => {
    const c = W / 2;
    arcoPix(g, c - r * 0.5, c, r, -1.15, 1.15, CONTORNO, 6);
    arcoPix(g, c - r * 0.5, c, r, -1.1, 1.1, rampa[1], 4);
    arcoPix(g, c - r * 0.5, c, r, -1.0, 1.0, rampa[2], 2);
    arcoPix(g, c - r * 0.5, c, r, -0.8, 0.8, rampa[3], 1);
  });
}

// disco de vento (Air Cutter): elipse fina e clara perpendicular ao voo, com faíscas
export function anilloAire(r) {
  return guardado(`aire${r}`, r * 2 + 8, r * 2 + 8, (g, W) => {
    const c = Math.floor(W / 2);
    for (const dx of [-3, 3]) {
      anilloPix(g, c + dx, c, r * 0.42, r, 'rgba(120,170,255,0.9)', 2);
      anilloPix(g, c + dx, c, r * 0.42, r, '#f4fbff', 1);
    }
    g.fillStyle = '#ffffff'; g.fillRect(c - 1, c - r - 1, 2, 2); g.fillRect(c - 1, c + r - 1, 2, 2);
  });
}

// salpicadura de água: leque de jatos que sobem e abrem (4 quadros)
export function salpicadura(frame, r, rampa = RAMPA_AGUA) {
  return guardado(`salp${frame % 4}-${r}-${rampa.join()}`, r * 2 + 8, r * 2 + 8, (g, W) => {
    const c = W / 2, k = [0.5, 0.85, 1, 0.75][frame % 4];
    for (let i = -3; i <= 3; i++) {
      const ang = -Math.PI / 2 + i * 0.34, alto = r * k * (1 - Math.abs(i) * 0.1);
      const x1 = c + Math.cos(ang) * alto, y1 = c + 3 + Math.sin(ang) * alto;
      lineaPix(g, c + i * 1.2, c + 4, x1, y1, CONTORNO, 4);
    }
    for (let i = -3; i <= 3; i++) {
      const ang = -Math.PI / 2 + i * 0.34, alto = r * k * (1 - Math.abs(i) * 0.1);
      const x1 = c + Math.cos(ang) * alto, y1 = c + 3 + Math.sin(ang) * alto;
      lineaPix(g, c + i * 1.2, c + 4, x1, y1, rampa[1], 2);
      lineaPix(g, c + i * 1.2, c + 3, x1, y1 + 1, rampa[2], 1);
      disco(g, x1, y1 - 1, 1.3, rampa[3]);
    }
    elipsePix(g, c, c + 5, r * 0.55 * k, r * 0.18 * k + 1, rampa[1]);
    elipsePix(g, c, c + 4, r * 0.35 * k, r * 0.1 * k + 1, rampa[3]);
  });
}

// mordida: duas fileiras de presas que se fecham (k de 0 a 1); aponta para a direita
export function mordida(k, r) {
  return guardado(`mord${Math.round(k * 4)}-${r}`, r * 2 + 8, r * 2 + 8, (g, W) => {
    const c = Math.floor(W / 2), abre = Math.round(r * 0.8 * (1 - Math.min(1, k * 1.2))) + 1, alto = Math.max(4, Math.round(r * 0.55));
    for (const lado of [-1, 1]) for (let i = -1; i <= 1; i++) {
      const x = c + i * Math.round(r * 0.5);
      for (let j = 0; j < alto; j++) {
        const w = Math.max(0, Math.round((alto - j) / alto * 3));
        const y = c + lado * (abre + alto - j);
        g.fillStyle = CONTORNO; g.fillRect(x - w - 1, y, w * 2 + 3, 1);
        g.fillStyle = '#f4f7ec'; g.fillRect(x - w, y, w * 2 + 1, 1);
      }
      g.fillStyle = '#b6f26a'; g.fillRect(x, c + lado * (abre + alto) - (lado > 0 ? 0 : 0), 1, 1);
    }
    if (k > 0.55) { disco(g, c, c, 2, '#d8ff8a'); }
  });
}

// crista de onda (Hydro Pump / Hydro Cannon): corpo azul em degradê e espuma branca no topo; aponta para a direita
export function ola(tam, fase = 0) {
  return guardado(`ola${tam}-${fase % 3}`, tam * 2 + 6, Math.round(tam * 1.5) + 6, (g, W, H) => {
    const base = H - 3, ancho = tam * 2;
    const alto = x => { const u = x / ancho; return Math.max(0, tam * 1.15 * Math.pow(Math.sin(Math.min(1, u * 1.05) * Math.PI), 0.75) * (u > 0.7 ? 1 + (u - 0.7) * 0.9 : 1)); };
    for (let x = 0; x < ancho; x++) {
      const a = Math.round(alto(x) + Math.sin((x + fase * 5) * 0.8) * 0.8);
      for (let y = 0; y <= a; y++) {
        const prof = y / Math.max(1, a);
        g.fillStyle = prof < 0.18 ? '#ffffff' : prof < 0.4 ? '#bfe9ff' : prof < 0.75 ? '#4aa3f0' : '#1f5ec4';
        g.fillRect(3 + x, base - y, 1, 1);
      }
      g.fillStyle = CONTORNO; g.fillRect(3 + x, base - a - 1, 1, 1);
    }
    for (let i = 0; i < 4; i++) { g.fillStyle = '#ffffff'; g.fillRect(3 + Math.round(ancho * (0.25 + i * 0.2)) + (fase % 2), base - Math.round(alto(ancho * (0.25 + i * 0.2))) - 2 - (i % 2), 2, 1); }
    g.fillStyle = CONTORNO; g.fillRect(2, base, ancho + 2, 1);
  });
}

// espinho de raiz (Frenzy Plant): triângulo marrom com luz
export function espina(alto) {
  return guardado(`espina${alto}`, Math.round(alto * 0.55) + 6, alto + 4, (g, W, H) => {
    const c = Math.floor(W / 2), base = H - 2;
    for (const [grow, color] of [[1.5, '#2a1406'], [0, '#7a4a1e']]) {
      g.fillStyle = color;
      for (let y = 0; y < alto; y++) { const w = Math.round((alto * 0.27) * (y / alto) + grow); g.fillRect(c - w, base - alto + y - (grow ? 1 : 0), w * 2 + 1, 1); }
    }
    for (let y = 2; y < alto; y++) { const w = Math.round((alto * 0.27) * (y / alto)); g.fillStyle = '#b8742f'; g.fillRect(c - w + 1, base - alto + y, Math.max(1, Math.round(w * 0.9)), 1); g.fillStyle = '#e0a055'; g.fillRect(c - w + 1, base - alto + y, Math.max(1, Math.round(w * 0.35)), 1); }
    g.fillStyle = '#3f8a2a'; g.fillRect(c - 3, base - 1, 7, 1);
  });
}

// vinha/raiz retorcida e nodosa (Frenzy Plant): tronco marrom que afina e balança
export function vid(alto, semilla = 0) {
  return guardado(`vid${alto}-${semilla % 4}`, 22, alto + 6, (g, W, H) => {
    const c = W / 2, base = H - 2;
    for (const [grow, color] of [[1.4, '#2a1406'], [0, '#7a4a1e']]) {
      g.fillStyle = color;
      for (let y = 0; y < alto; y++) {
        const u = y / alto, w = Math.round(2.8 * (1 - u * 0.8) + 0.8 + grow), x = Math.round(c + Math.sin(u * 7 + semilla * 1.7) * 2.6 * (0.4 + u) + (u > 0.8 ? (u - 0.8) * 14 : 0));
        g.fillRect(x - w, base - y - 1, w * 2 + 1, 1);
        if (y % 11 === 6 && !grow) { g.fillRect(x + w, base - y - 2, 3, 2); g.fillRect(x - w - 2, base - y - 4, 3, 2); }
      }
    }
    for (let y = 1; y < alto - 1; y++) {
      const u = y / alto, w = Math.round(2.8 * (1 - u * 0.8) + 0.8), x = Math.round(c + Math.sin(u * 7 + semilla * 1.7) * 2.6 * (0.4 + u) + (u > 0.8 ? (u - 0.8) * 14 : 0));
      g.fillStyle = '#b8742f'; g.fillRect(x - w + 1, base - y - 1, Math.max(1, Math.round(w * 0.8)), 1);
      if (y % 3 === 0) { g.fillStyle = '#e0a055'; g.fillRect(x - w + 1, base - y - 1, 1, 1); }
    }
    g.fillStyle = '#3f8a2a'; g.fillRect(c - 4, base, 9, 1);
  });
}

// pedacinhos de raiz marrom (Ingrain): pequeno e curto
export function raizPie(semilla) {
  return guardado(`raizpie${semilla % 6}`, 16, 10, (g) => {
    const pts = [[1, 6], [3, 5], [5, 6], [7, 4], [9, 5], [11, 3], [13, 4]];
    for (const [dx, color, off] of [[0, '#2a1406', 1], [0, '#8a5a2b', 0]]) {
      g.fillStyle = color;
      pts.forEach(([x, y], i) => { const yy = y + ((i + semilla) % 3 === 0 ? 1 : 0); g.fillRect(x - off, yy - off, 2 + off * 2, 2 + off * 2); });
      void dx;
    }
    g.fillStyle = '#d6a05a'; g.fillRect(3, 5, 1, 1); g.fillRect(9, 5, 1, 1);
  });
}

// carimba um sprite centrado (com giro opcional em passos de 22,5 graus para manter a cara de pixel)
export function carimbar(g, img, x, y, ang = 0, escala = 1, alfa = 1) {
  g.save();
  if (alfa !== 1) g.globalAlpha *= alfa;
  g.translate(R(x), R(y));
  if (ang) g.rotate(Math.round(ang / (Math.PI / 8)) * (Math.PI / 8));
  if (escala !== 1) g.scale(escala, escala);
  g.drawImage(img, -Math.floor(img.width / 2), -Math.floor(img.height / 2));
  g.restore();
}
