// As 4 arenas ovais desenhadas por código em pixel art (960 x 441): estádio, neon, cratera e ruínas.
import { MUNDO, OVALO } from '../config.js';

// a arena é desenhada com uma margem grande em volta, para a câmera nunca mostrar o fim (borda preta)
export const MARGEM = { x: 480, y: 320 };
const TODO = [-MARGEM.x, -MARGEM.y, MUNDO.w + MARGEM.x * 2, MUNDO.h + MARGEM.y * 2];
const foraDaArte = (x, y, m = 6) => x < -MARGEM.x - m || x > MUNDO.w + MARGEM.x + m || y < -MARGEM.y - m || y > MUNDO.h + MARGEM.y + m;
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const dentro = (x, y, k = 1) => { const dx = (x - OVALO.cx) / (OVALO.rx * k), dy = (y - OVALO.cy) / (OVALO.ry * k); return dx * dx + dy * dy <= 1; };

function elipse(g, cx, cy, rx, ry, color) { g.fillStyle = color; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
function aro(g, rx, ry, color, w = 2) { g.strokeStyle = color; g.lineWidth = w; g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, rx, ry, 0, 0, Math.PI * 2); g.stroke(); }

// ---------------------------------------------------------------- peças comuns do estádio em perspectiva
// A câmera olha o campo de cima e um pouco inclinada: as faixas do gramado abrem em leque para baixo
// (ponto de fuga bem acima da tela), a mureta e a torcida seguem elipses maiores que o campo.
const FUGA = { x: OVALO.cx, y: -1500 };
const CAMPO_R = { rx: OVALO.rx + 14, ry: OVALO.ry + 9 };
const MURETA = { rin: { rx: OVALO.rx + 16, ry: OVALO.ry + 10 }, rout: { rx: OVALO.rx + 50, ry: OVALO.ry + 36 } };
const ptE = (rx, ry, a) => [OVALO.cx + Math.cos(a) * rx, OVALO.cy + Math.sin(a) * ry];

function quad(g, p, color) { g.fillStyle = color; g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]); g.closePath(); g.fill(); }

// faixas do gramado em leque: cada faixa é um trapézio entre duas retas que saem do ponto de fuga
function faixasLeque(g, cores, largura) {
  const yRef = OVALO.cy;
  for (let i = -14; i < 14; i++) {
    const xa = OVALO.cx + i * largura, xb = xa + largura;
    const at = y => FUGA.x + (xa - FUGA.x) * (y - FUGA.y) / (yRef - FUGA.y), bt = y => FUGA.x + (xb - FUGA.x) * (y - FUGA.y) / (yRef - FUGA.y);
    quad(g, [[at(0), 0], [bt(0), 0], [bt(MUNDO.h), MUNDO.h], [at(MUNDO.h), MUNDO.h]], cores[(i + 100) % cores.length]);
  }
}

// grama com textura: pontinhos claros e escuros e tufos em V, mais nítidos perto da câmera (embaixo)
function texturaGrama(g, R, escuro, claro, tufo) {
  for (let n = 0; n < 11000; n++) {
    const x = Math.floor(R() * MUNDO.w), y = Math.floor(R() * MUNDO.h);
    g.fillStyle = R() < 0.5 ? escuro : claro; g.fillRect(x, y, R() < 0.3 ? 2 : 1, 1);
  }
  for (let n = 0; n < 420; n++) {
    const x = Math.floor(R() * MUNDO.w), y = Math.floor(R() * MUNDO.h), h = 2 + Math.floor((y / MUNDO.h) * 2);
    g.fillStyle = tufo; g.fillRect(x, y - h, 1, h); g.fillRect(x - 1, y - h + 1, 1, 1); g.fillRect(x + 1, y - h + 1, 1, 1); g.fillRect(x + 2, y - h, 1, 1); g.fillRect(x - 2, y - h, 1, 1);
  }
}

// torcida: fileiras de pessoinhas seguindo elipses em volta da mureta, com corredores de escada
function torcida(g, R, { fundo = ['#22283a', '#1c2232'], filas = 62, escadas = 10, roupas = ['#a8424a', '#3a5fa8', '#b89a4a', '#b8b8b8', '#3f8a54', '#7a4a9a', '#a8643a', '#2a2f3e', '#3a3f4e', '#4a3a3a'] } = {}) {
  const pele = ['#f2c9a0', '#d9a273', '#a86c45', '#7a4a2e'], cabelo = ['#2a1a10', '#5a3a1a', '#d8b050', '#1a1a1a', '#8a2a1a'];
  const angEscada = Array.from({ length: escadas }, (_, i) => (i / escadas) * Math.PI * 2 + 0.31);
  for (let f = filas - 1; f >= 0; f--) {
    const rx = MURETA.rout.rx + 6 + f * 13, ry = MURETA.rout.ry + 5 + f * 9.5;
    g.fillStyle = fundo[f % 2]; g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, rx + 13, ry + 9.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, rx + 13, ry + 9.5, 0, 0, Math.PI * 2); g.ellipse(OVALO.cx, OVALO.cy, rx + 11, ry + 8, 0, 0, Math.PI * 2); g.fill('evenodd');
  }
  for (let f = 0; f < filas; f++) {
    const rx = MURETA.rout.rx + 12 + f * 13, ry = MURETA.rout.ry + 9 + f * 9.5, n = Math.round((Math.PI * (rx + ry)) / 7.2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + f * 0.11;
      if (angEscada.some(e => Math.abs(((a - e + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.035 + 6 / rx)) continue;
      const [x, y] = ptE(rx, ry, a);
      if (foraDaArte(x, y)) continue;
      if (R() < 0.08) continue;
      const X = Math.round(x), Y = Math.round(y);
      g.fillStyle = roupas[Math.floor(R() * roupas.length)]; g.fillRect(X - 2, Y - 1, 5, 4);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(X - 2, Y + 2, 5, 1);
      g.fillStyle = pele[Math.floor(R() * pele.length)]; g.fillRect(X - 1, Y - 4, 3, 3);
      g.fillStyle = cabelo[Math.floor(R() * cabelo.length)]; g.fillRect(X - 1, Y - 5, 3, 1);
      if (R() < 0.12) { g.fillStyle = pele[0]; g.fillRect(X - 3, Y - 6, 1, 3); g.fillRect(X + 3, Y - 6, 1, 3); } // braços para cima
    }
  }
  // sombra geral: a torcida fica mais escura longe do campo
  const somb = g.createRadialGradient(OVALO.cx, OVALO.cy, OVALO.rx * 0.9, OVALO.cx, OVALO.cy, OVALO.rx * 2.6);
  somb.addColorStop(0, 'rgba(8,10,18,0.15)'); somb.addColorStop(1, 'rgba(8,10,18,0.55)');
  g.fillStyle = somb; g.fillRect(...TODO);
  // escadas: degraus cinza do muro até a borda
  for (const e of angEscada) for (let f = 0; f < filas; f++) {
    const rx = MURETA.rout.rx + 10 + f * 13, ry = MURETA.rout.ry + 7 + f * 9.5, [x, y] = ptE(rx, ry, e);
    if (foraDaArte(x, y, 10)) continue;
    g.fillStyle = '#4a5160'; g.fillRect(Math.round(x) - 6, Math.round(y) - 2, 12, 5);
    g.fillStyle = '#6d7586'; g.fillRect(Math.round(x) - 6, Math.round(y) - 2, 12, 1);
    g.fillStyle = '#2b303c'; g.fillRect(Math.round(x) - 6, Math.round(y) + 3, 12, 1);
  }
}

// mureta acolchoada em segmentos, com postes cinza entre eles
function mureta(g, cores, poste = ['#5d6575', '#9aa3b2', '#3a404c'], n = 44) {
  const { rin, rout } = MURETA;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, [c, cl, cs] = cores[i % cores.length];
    const P = (r, a) => ptE(r.rx, r.ry, a);
    quad(g, [P(rin, a0), P(rin, a1), P(rout, a1), P(rout, a0)], c);
    // brilho na borda de cima (voltada para o campo) e sombra na de baixo
    const mid = { rx: rin.rx + 4, ry: rin.ry + 3 };
    quad(g, [P(rin, a0), P(rin, a1), P(mid, a1), P(mid, a0)], cl);
    const mid2 = { rx: rout.rx - 4, ry: rout.ry - 3 };
    quad(g, [P(mid2, a0), P(mid2, a1), P(rout, a1), P(rout, a0)], cs);
    // costura do acolchoado
    g.fillStyle = 'rgba(0,0,0,0.18)'; const [sx, sy] = ptE((rin.rx + rout.rx) / 2, (rin.ry + rout.ry) / 2, (a0 + a1) / 2); g.fillRect(Math.round(sx), Math.round(sy), 1, 1);
    // poste
    const da = 0.011, ext = { rx: rout.rx + 2, ry: rout.ry + 2 }, inn = { rx: rin.rx - 1, ry: rin.ry - 1 };
    quad(g, [P(inn, a0 - da * 1.3), P(inn, a0 + da * 1.3), P(ext, a0 + da * 1.3), P(ext, a0 - da * 1.3)], poste[2]);
    quad(g, [P(inn, a0 - da), P(inn, a0 + da), P(ext, a0 + da), P(ext, a0 - da)], poste[0]);
    quad(g, [P(inn, a0 - da), P(inn, a0 - da * 0.2), P(ext, a0 - da * 0.2), P(ext, a0 - da)], poste[1]);
  }
  // linha escura entre mureta e campo
  g.strokeStyle = 'rgba(10,20,10,0.55)'; g.lineWidth = 2; g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, rin.rx, rin.ry, 0, 0, Math.PI * 2); g.stroke();
}

// refletor nos cantos de cima: poste, painel com lâmpadas e brilho
function refletor(g, x, y) {
  g.fillStyle = '#2a2f3a'; g.fillRect(x - 2, y + 18, 4, 60);
  g.fillStyle = '#4a5160'; g.fillRect(x - 1, y + 18, 1, 60);
  const luz = g.createRadialGradient(x, y + 8, 2, x, y + 8, 60);
  luz.addColorStop(0, 'rgba(255,255,230,0.55)'); luz.addColorStop(1, 'rgba(255,255,230,0)');
  g.fillStyle = luz; g.fillRect(x - 60, y - 52, 120, 120);
  g.fillStyle = '#1a1e28'; g.fillRect(x - 26, y - 6, 52, 28);
  g.fillStyle = '#3a404c'; g.fillRect(x - 25, y - 5, 50, 1);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) { const lx = x - 22 + c * 12, ly = y - 2 + r * 12; g.fillStyle = '#fffbe0'; g.fillRect(lx, ly, 9, 8); g.fillStyle = '#ffffff'; g.fillRect(lx + 1, ly + 1, 4, 3); }
}

// linhas brancas pintadas no gramado, com bordinha translúcida para parecer tinta
function linhaElipse(g, rx, ry, cor = '#f2f5ea') {
  g.strokeStyle = 'rgba(242,245,234,0.25)'; g.lineWidth = 6; g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, rx, ry, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = cor; g.lineWidth = 3; g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, rx, ry, 0, 0, Math.PI * 2); g.stroke();
}
function pokebolaChao(g, cx, cy, rx, ry) {
  const el = (a, b, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(cx, cy, a, b, 0, 0, Math.PI * 2); g.fill(); };
  el(rx + 4, ry + 3, 'rgba(242,245,234,0.35)');
  el(rx, ry, '#eef0e6');
  g.save(); g.beginPath(); g.rect(cx - rx, cy - ry, rx * 2, ry - 1); g.clip(); el(rx - 4, ry - 3, '#d6545c'); el(rx - 8, ry - 7, '#e0666c'); g.restore();
  g.save(); g.beginPath(); g.rect(cx - rx, cy + 2, rx * 2, ry); g.clip(); el(rx - 4, ry - 3, '#dcdcd2'); g.restore();
  g.fillStyle = '#6aa84f'; g.fillRect(cx - rx + 3, cy - 1, rx * 2 - 6, 3);
  el(rx * 0.32, ry * 0.32, '#eef0e6'); el(rx * 0.26, ry * 0.26, '#6aa84f'); el(rx * 0.17, ry * 0.17, '#eef0e6');
}

function campo(g, R, { faixas, largura = 46, textura, sombraBorda = 'rgba(20,40,10,0.35)' }) {
  g.save(); g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, CAMPO_R.rx, CAMPO_R.ry, 0, 0, Math.PI * 2); g.clip();
  faixasLeque(g, faixas, largura);
  texturaGrama(g, R, ...textura);
  // luz no centro e borda mais escura (dá volume)
  const v = g.createRadialGradient(OVALO.cx, OVALO.cy - 20, 60, OVALO.cx, OVALO.cy, OVALO.rx * 1.05);
  v.addColorStop(0, 'rgba(255,255,220,0.07)'); v.addColorStop(0.7, 'rgba(0,0,0,0)'); v.addColorStop(1, sombraBorda);
  g.fillStyle = v; g.fillRect(0, 0, MUNDO.w, MUNDO.h);
  g.restore();
}

const ESTILOS = {
  estadio(g, R) {
    g.fillStyle = '#161a26'; g.fillRect(...TODO);
    torcida(g, R);
    mureta(g, [['#c8323a', '#e8606a', '#8a1f28'], ['#2f5ec8', '#5a8ae8', '#1f3a8a']], undefined, 44);
    campo(g, R, { faixas: ['#5fae38', '#6dbf42'], largura: 62, textura: ['rgba(40,90,20,0.22)', 'rgba(170,230,120,0.16)', '#4a9a2c'] });
    linhaElipse(g, OVALO.rx, OVALO.ry);
    g.fillStyle = 'rgba(242,245,234,0.25)'; g.fillRect(OVALO.cx - 3, OVALO.cy - OVALO.ry, 6, OVALO.ry * 2);
    g.fillStyle = '#f2f5ea'; g.fillRect(OVALO.cx - 1, OVALO.cy - OVALO.ry, 3, OVALO.ry * 2);
    // mais folhas de grama, curtas, claras e escuras
    g.save(); g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, CAMPO_R.rx, CAMPO_R.ry, 0, 0, Math.PI * 2); g.clip();
    for (let n = 0; n < 3200; n++) { const x = Math.floor(R() * MUNDO.w), y = Math.floor(R() * MUNDO.h); g.fillStyle = R() < 0.5 ? 'rgba(200,240,150,0.28)' : 'rgba(40,90,20,0.3)'; g.fillRect(x, y, 1, 2); }
    g.restore();
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(OVALO.cx + 3, OVALO.cy + 4, 66, 41, 0, 0, Math.PI * 2); g.fill();
    pokebolaChao(g, OVALO.cx, OVALO.cy, 62, 38);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(OVALO.cx - 18, OVALO.cy - 18, 20, 6, -0.2, 0, Math.PI * 2); g.fill();
    for (const x of [34, MUNDO.w - 34, -220, MUNDO.w + 220]) refletor(g, x, 12);
  },
  neon(g, R) {
    g.fillStyle = '#0c0d18'; g.fillRect(...TODO);
    torcida(g, R, { fundo: ['#181a2c', '#141626'], roupas: ['#6a3fa8', '#2f8ad8', '#c8c8d8', '#2a2f4e', '#a83f8a', '#3f4a6a'] });
    mureta(g, [['#232842', '#3a4266', '#14182a']], ['#3a4266', '#6a74a0', '#1a1e30'], 36);
    luzMureta(g, ['#2ff3ff', '#b06aff']);
    g.save(); g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, CAMPO_R.rx, CAMPO_R.ry, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#262c48'; g.fillRect(0, 0, MUNDO.w, MUNDO.h);
    lajotas(g, R, { largura: 58, alto: 30, cores: ['#262c48', '#2a3150', '#232945', '#2d3456'], junta: '#121628', brilho: 'rgba(255,255,255,0.06)' });
    // emendas que brilham em ciano
    for (let i = 0; i < 9; i++) { const xs = OVALO.cx + (i - 4) * 116; g.strokeStyle = 'rgba(47,243,255,0.18)'; g.lineWidth = 4; linhaFuga(g, xs); g.strokeStyle = 'rgba(120,250,255,0.7)'; g.lineWidth = 1; linhaFuga(g, xs); }
    for (let n = 0; n < 6; n++) { const x = 140 + R() * 680, y = 90 + R() * 260; g.fillStyle = '#151a2e'; g.fillRect(Math.round(x), Math.round(y), 22, 12); g.fillStyle = '#2a3150'; for (let k = 0; k < 4; k++) g.fillRect(Math.round(x) + 2 + k * 5, Math.round(y) + 2, 3, 8); }
    sombraCampo(g);
    g.restore();
    linhaElipse(g, OVALO.rx, OVALO.ry, '#7ef6ff');
    g.strokeStyle = 'rgba(47,243,255,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(OVALO.cx, OVALO.cy - OVALO.ry); g.lineTo(OVALO.cx, OVALO.cy + OVALO.ry); g.stroke();
    const el = (rx, ry, c, w) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, rx, ry, 0, 0, Math.PI * 2); g.stroke(); };
    g.fillStyle = 'rgba(47,243,255,0.1)'; g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, 54, 33, 0, 0, Math.PI * 2); g.fill();
    el(54, 33, '#2ff3ff', 3); el(46, 28, 'rgba(47,243,255,0.4)', 1); el(14, 9, '#2ff3ff', 3);
    g.fillStyle = '#2ff3ff'; g.fillRect(OVALO.cx - 46, OVALO.cy - 1, 32, 2); g.fillRect(OVALO.cx + 14, OVALO.cy - 1, 32, 2);
    for (const x of [34, MUNDO.w - 34, -220, MUNDO.w + 220]) refletor(g, x, 12);
  },
  crater(g, R) {
    g.fillStyle = '#140b08'; g.fillRect(...TODO);
    torcida(g, R, { fundo: ['#2a1a14', '#22140f'], roupas: ['#8a3a2a', '#c86a2a', '#3a2a2a', '#6a4a3a', '#b89a6a', '#4a2a1a'], escadas: 8 });
    // poças de lava fora do campo
    for (const [x, y, r] of [[30, 300, 70], [930, 290, 70], [60, 40, 50], [900, 40, 50], [480, 436, 60], [-260, 120, 90], [1220, 140, 90], [-180, 460, 80], [1150, 470, 80], [480, -150, 80], [200, 560, 70], [760, 580, 70]]) lava(g, x, y, r);
    mureta(g, [['#2a2224', '#463a3a', '#140e0e'], ['#322828', '#4e4040', '#180f0f']], ['#3a2a28', '#5a443e', '#1a0f0c'], 40);
    luzMureta(g, ['#ff7a1f', '#ffb347']);
    g.save(); g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, CAMPO_R.rx, CAMPO_R.ry, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#3a3232'; g.fillRect(0, 0, MUNDO.w, MUNDO.h);
    lajotas(g, R, { largura: 54, alto: 28, cores: ['#3a3232', '#433a38', '#342c2c', '#4a403c', '#2e2828'], junta: '#1a1212', brilho: 'rgba(255,200,160,0.05)', torto: 7 });
    // fendas de lava
    for (let n = 0; n < 22; n++) {
      let x = 60 + R() * 840, y = 70 + R() * 300; const pts = [[x, y]];
      for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 60; y += (R() - 0.5) * 30; pts.push([x, y]); }
      for (const [c, w] of [['rgba(255,120,30,0.18)', 7], ['rgba(255,120,30,0.5)', 3], ['#ffb347', 1]]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) g.lineTo(q[0], q[1]); g.stroke(); }
    }
    sombraCampo(g, 'rgba(255,90,20,0.18)');
    g.restore();
    g.strokeStyle = 'rgba(255,140,40,0.35)'; g.lineWidth = 5; g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, CAMPO_R.rx - 2, CAMPO_R.ry - 2, 0, 0, Math.PI * 2); g.stroke();
    for (const x of [26, MUNDO.w - 26, -160, MUNDO.w + 160]) tocha(g, x, 60);
  },
  ruinas(g, R) {
    g.fillStyle = '#1a2418'; g.fillRect(...TODO);
    torcida(g, R, { fundo: ['#5a5a4a', '#4e4e40'], roupas: ['#8a6a4a', '#6a7a4a', '#b8a888', '#4a5a6a', '#7a4a3a'], escadas: 8 });
    // mato crescendo nas arquibancadas
    for (let n = 0; n < 520; n++) { const a = R() * Math.PI * 2, k = 1.08 + R() * 1.3, [x, y] = ptE(OVALO.rx * k + 40, OVALO.ry * k + 30, a); moita(g, x, y, 4 + R() * 6, R); }
    mureta(g, [['#9a9480', '#b8b29a', '#6a6656'], ['#8e8874', '#aca690', '#625e50']], ['#a8a28c', '#cfc9b0', '#5e5a4c'], 30);
    g.save(); g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, CAMPO_R.rx, CAMPO_R.ry, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#c4bc9c'; g.fillRect(0, 0, MUNDO.w, MUNDO.h);
    lajotas(g, R, { largura: 50, alto: 26, cores: ['#c4bc9c', '#bcb492', '#ccc4a6', '#b4ac8c', '#c8c0a2'], junta: '#8a8468', brilho: 'rgba(255,255,240,0.1)', torto: 4 });
    // musgo e capim nas juntas
    for (let n = 0; n < 70; n++) { const x = 40 + R() * 880, y = 60 + R() * 330, r = 8 + R() * 22; g.fillStyle = 'rgba(110,150,60,0.35)'; g.beginPath(); g.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2); g.fill(); for (let k = 0; k < 14; k++) { g.fillStyle = R() < 0.5 ? '#6a9a3a' : '#88b04a'; g.fillRect(Math.round(x + (R() - 0.5) * r * 2), Math.round(y + (R() - 0.5) * r), 2, 1); } }
    texturaGrama(g, R, 'rgba(90,80,60,0.12)', 'rgba(255,250,230,0.1)', '#6a9a3a');
    sombraCampo(g, 'rgba(40,40,20,0.3)');
    g.restore();
    linhaElipse(g, OVALO.rx, OVALO.ry, 'rgba(240,236,220,0.6)');
    // colunas na borda
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2, [x, y] = ptE(MURETA.rout.rx + 8, MURETA.rout.ry + 6, a);
      if (foraDaArte(x, y, 40)) continue;
      const X = Math.round(x), Y = Math.round(y);
      g.fillStyle = '#3a382e'; g.fillRect(X - 9, Y - 34, 18, 38);
      g.fillStyle = '#a8a28c'; g.fillRect(X - 7, Y - 32, 14, 34);
      g.fillStyle = '#cfc9b0'; g.fillRect(X - 7, Y - 32, 4, 34);
      g.fillStyle = '#6a6656'; g.fillRect(X + 3, Y - 32, 4, 34);
      g.fillStyle = '#d8d2ba'; g.fillRect(X - 9, Y - 36, 18, 4);
      moita(g, X + 6, Y - 28, 4, R);
    }
  },
};

// ---------------------------------------------------------------- peças das outras arenas
// reta que vai do ponto de fuga ao chão passando por x na linha do centro
function linhaFuga(g, xs) {
  const at = y => FUGA.x + (xs - FUGA.x) * (y - FUGA.y) / (OVALO.cy - FUGA.y);
  g.beginPath(); g.moveTo(at(0), 0); g.lineTo(at(MUNDO.h), MUNDO.h); g.stroke();
}
// lajotas em perspectiva: fileiras mais altas perto da câmera, colunas que abrem em leque; "torto" desalinha as juntas
function lajotas(g, R, { largura, alto, cores, junta, brilho, torto = 0 }) {
  const esc = y => (y - FUGA.y) / (OVALO.cy - FUGA.y);
  let y = OVALO.cy - OVALO.ry - 20, fila = 0;
  while (y < MUNDO.h) {
    const h = alto * esc(y), y2 = y + h, off = (fila % 2) * 0.5;
    for (let i = -12; i < 12; i++) {
      const xa = OVALO.cx + (i + off) * largura + (R() - 0.5) * torto, xb = xa + largura;
      const at = (xs, yy) => FUGA.x + (xs - FUGA.x) * esc(yy);
      const p = [[at(xa, y), y], [at(xb, y), y], [at(xb, y2), y2], [at(xa, y2), y2]];
      quad(g, p, cores[Math.floor(R() * cores.length)]);
      g.strokeStyle = junta; g.lineWidth = 1.5; g.beginPath(); g.moveTo(p[0][0], p[0][1]); g.lineTo(p[1][0], p[1][1]); g.lineTo(p[2][0], p[2][1]); g.stroke();
      g.strokeStyle = brilho; g.lineWidth = 1; g.beginPath(); g.moveTo(p[0][0] + 1, p[0][1] + 1.5); g.lineTo(p[1][0] - 1, p[1][1] + 1.5); g.stroke();
    }
    y = y2; fila++;
  }
}
function sombraCampo(g, cor = 'rgba(0,0,0,0.35)') {
  const v = g.createRadialGradient(OVALO.cx, OVALO.cy - 20, 60, OVALO.cx, OVALO.cy, OVALO.rx * 1.05);
  v.addColorStop(0, 'rgba(255,255,255,0.05)'); v.addColorStop(0.7, 'rgba(0,0,0,0)'); v.addColorStop(1, cor);
  g.fillStyle = v; g.fillRect(0, 0, MUNDO.w, MUNDO.h);
}
// faixa de luz no alto da mureta (neon e lava)
function luzMureta(g, cores) {
  const n = 36;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + 0.02, a1 = ((i + 1) / n) * Math.PI * 2 - 0.02, c = cores[i % cores.length];
    const r = { rx: MURETA.rin.rx + 6, ry: MURETA.rin.ry + 4.5 };
    g.strokeStyle = c + '55'; g.lineWidth = 6; g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, r.rx, r.ry, 0, a0, a1); g.stroke();
    g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, r.rx, r.ry, 0, a0, a1); g.stroke();
  }
}
function lava(g, x, y, r) {
  const gl = g.createRadialGradient(x, y, 4, x, y, r * 1.4); gl.addColorStop(0, 'rgba(255,170,60,0.55)'); gl.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = gl; g.fillRect(x - r * 1.5, y - r * 1.5, r * 3, r * 3);
  g.fillStyle = '#b8320f'; g.beginPath(); g.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ff7a1f'; g.beginPath(); g.ellipse(x, y, r * 0.75, r * 0.4, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffd27a'; g.beginPath(); g.ellipse(x - r * 0.2, y - r * 0.08, r * 0.3, r * 0.14, 0, 0, Math.PI * 2); g.fill();
}
function tocha(g, x, y) {
  g.fillStyle = '#2a1a14'; g.fillRect(x - 3, y, 6, 40);
  const gl = g.createRadialGradient(x, y - 6, 2, x, y - 6, 36); gl.addColorStop(0, 'rgba(255,190,80,0.6)'); gl.addColorStop(1, 'rgba(255,120,30,0)');
  g.fillStyle = gl; g.fillRect(x - 36, y - 42, 72, 72);
  g.fillStyle = '#ff7a1f'; g.beginPath(); g.moveTo(x - 7, y); g.quadraticCurveTo(x - 6, y - 14, x, y - 22); g.quadraticCurveTo(x + 6, y - 14, x + 7, y); g.fill();
  g.fillStyle = '#ffd27a'; g.beginPath(); g.moveTo(x - 3, y); g.quadraticCurveTo(x - 2, y - 8, x, y - 13); g.quadraticCurveTo(x + 2, y - 8, x + 3, y); g.fill();
}
function moita(g, x, y, r, R) {
  for (const [c, k] of [['#2a4a1e', 1], ['#3f6a2a', 0.8], ['#5a8a3a', 0.5]]) { g.fillStyle = c; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x + (i - 1) * r * 0.7, y - (i === 1 ? r * 0.3 : 0), r * k, 0, Math.PI * 2); g.fill(); } }
  void R;
}

const cache = new Map();
export function crearArena(id) {
  if (cache.has(id)) return cache.get(id);
  const c = document.createElement('canvas');
  c.width = MUNDO.w + MARGEM.x * 2; c.height = MUNDO.h + MARGEM.y * 2;
  const g = c.getContext('2d');
  g.translate(MARGEM.x, MARGEM.y);
  const semilla = [...id].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7);
  (ESTILOS[id] ?? ESTILOS.estadio)(g, rng(semilla));
  cache.set(id, c);
  return c;
}

// ---------------------------------------------------------------- vida na arena (barato, sem estado)
const frac = v => v - Math.floor(v);
const hash = i => frac(Math.sin(i * 127.1 + 311.7) * 43758.5453);
export function ambienteArena(g, id, t) {
  if (id === 'estadio' || !ESTILOS[id]) {
    // flashes de câmera piscando na torcida
    for (let i = 0; i < 46; i++) {
      if (frac(t * 0.55 + hash(i) * 7) > 0.05) continue;
      const a = hash(i + 50) * Math.PI * 2, k = 1.15 + hash(i + 90) * 0.9, x = OVALO.cx + Math.cos(a) * (MURETA.rout.rx + 30) * k, y = OVALO.cy + Math.sin(a) * (MURETA.rout.ry + 20) * k;
      g.globalAlpha = 0.35; g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, y, 6, 4, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
    }
  } else if (id === 'neon') {
    // faixa de luz que varre o chão e a borda pulsando
    g.save(); g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, CAMPO_R.rx, CAMPO_R.ry, 0, 0, Math.PI * 2); g.clip();
    const x = -200 + frac(t * 0.18) * (MUNDO.w + 400);
    g.globalAlpha = 0.09; g.fillStyle = '#7ef6ff'; g.beginPath(); g.moveTo(x - 60, 0); g.lineTo(x + 20, 0); g.lineTo(x + 120, MUNDO.h); g.lineTo(x + 40, MUNDO.h); g.closePath(); g.fill();
    g.restore();
    g.globalAlpha = 0.25 + 0.2 * Math.sin(t * 3); g.strokeStyle = '#2ff3ff'; g.lineWidth = 3; g.beginPath(); g.ellipse(OVALO.cx, OVALO.cy, OVALO.rx, OVALO.ry, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
  } else if (id === 'crater') {
    // brasas subindo das fendas e da lava
    for (let i = 0; i < 44; i++) {
      const x = -200 + hash(i) * (MUNDO.w + 400), base = 40 + hash(i + 20) * (MUNDO.h + 40), sobe = frac(t * (0.25 + hash(i + 40) * 0.3) + hash(i + 60)) * 140, y = base - sobe;
      g.globalAlpha = 1 - sobe / 140; g.fillStyle = hash(i + 80) < 0.5 ? '#ffb347' : '#ff7a1f'; g.fillRect(Math.round(x + Math.sin(t * 2 + i) * 4), Math.round(y), 2, 2);
    }
    g.globalAlpha = 1;
  } else if (id === 'ruinas') {
    // folhas caindo devagar, balançando
    for (let i = 0; i < 26; i++) {
      const vx = 18 + hash(i) * 16, x = frac((t * vx + hash(i + 10) * 1600) / 1600) * 1600 - 320, y = frac(t * (0.05 + hash(i + 30) * 0.05) + hash(i + 50)) * (MUNDO.h + 200) - 100;
      const gira = Math.sin(t * 3 + i) * 1.5;
      g.fillStyle = hash(i + 70) < 0.5 ? '#6a9a3a' : '#b8a040'; g.fillRect(Math.round(x + gira * 3), Math.round(y), 3, 2); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(Math.round(x + gira * 3), Math.round(y) + 2, 3, 1);
    }
  }
}
