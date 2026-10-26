// Utilidades de desenho em pixel art: texto com contorno, botões azuis e dourados, ícones e brilhos.
import { UI, FUENTE, hex } from '../config.js';

export function texto(g, s, x, y, { tam = 8, color = UI.texto, borde = 0, colorBorde = UI.bordeTexto, align = 'left', base = 'top', peso = 400, sombra = false, max = 0 } = {}) {
  g.save();
  const fs = tam * 1.25;
  g.font = `${peso} ${fs}px ${FUENTE}`;
  g.textAlign = align;
  g.textBaseline = base;
  let k = 1;
  if (max) { const w = g.measureText(s).width; if (w > max) k = max / w; }
  g.translate(x, y);
  if (k < 1) g.scale(k, 1);
  if (borde) { g.lineJoin = 'round'; g.lineWidth = borde; g.strokeStyle = colorBorde; g.strokeText(s, 0, 0); }
  if (sombra) { g.fillStyle = '#000'; g.fillText(s, 1, 1); }
  g.fillStyle = color;
  g.fillText(s, 0, 0);
  g.restore();
}

export function medir(g, s, tam = 8, peso = 400) {
  g.save();
  g.font = `${peso} ${tam * 1.25}px ${FUENTE}`;
  const w = g.measureText(s).width;
  g.restore();
  return w;
}

export function rect(g, x, y, w, h, color, alfa = 1) {
  g.globalAlpha = alfa;
  g.fillStyle = typeof color === 'number' ? hex(color) : color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  g.globalAlpha = 1;
}

function redondo(g, x, y, w, h, color, r = 2, alfa = 1) {
  g.globalAlpha = alfa;
  g.fillStyle = hex(color);
  if (r <= 0) g.fillRect(x, y, w, h);
  else {
    g.fillRect(x + r, y, w - 2 * r, h);
    g.fillRect(x, y + r, w, h - 2 * r);
    for (let i = 1; i < r; i++) g.fillRect(x + r - i, y + i, w - 2 * (r - i), h - 2 * i);
  }
  g.globalAlpha = 1;
}

// Moldura de botão e painel: estilo "azul" (normal), "oro" (selecionado), "apagado" e "panel"
export function marco(g, x, y, w, h, estilo = 'azul', alfa = 1) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (estilo === 'oro') {
    redondo(g, x - 1, y - 1, w + 2, h + 2, UI.anillo, 3);
    redondo(g, x, y, w, h, UI.contorno, 2);
    redondo(g, x + 1, y + 1, w - 2, h - 2, UI.oroBorde, 1);
    rect(g, x + 2, y + 2, w - 4, h - 4, UI.oro);
    rect(g, x + 2, y + 2, w - 4, 1, UI.oroLuz);
    return;
  }
  if (estilo === 'panel') {
    redondo(g, x, y, w, h, UI.contorno, 2, alfa);
    redondo(g, x + 1, y + 1, w - 2, h - 2, UI.panelBorde, 1, alfa);
    rect(g, x + 2, y + 2, w - 4, h - 4, UI.panel, alfa);
    rect(g, x + 2, y + 1, w - 4, 1, UI.panelLuz, alfa);
    return;
  }
  const apagado = estilo === 'apagado';
  rect(g, x + 2, y + h, w - 4, 1, UI.sombra);
  redondo(g, x, y, w, h, UI.contorno, 2);
  redondo(g, x + 1, y + 1, w - 2, h - 2, apagado ? UI.panelBorde : UI.borde, 1);
  rect(g, x + 2, y + 2, w - 4, h - 4, apagado ? UI.panel : UI.relleno);
  if (apagado) return;
  rect(g, x + 2, y + 1, w - 4, 1, UI.bordeLuz);
  rect(g, x + 1, y + 2, 1, h - 4, UI.bordeLuz);
  rect(g, x + 2, y + 2, w - 4, 1, UI.rellenoLuz);
  rect(g, x + 2, y + h - 3, w - 4, 1, UI.rellenoBajo);
}

// Fundo dos menus: azul escuro com quadradinhos em xadrez
// tema dos menus ('halloween' troca o fundo azul por roxo com quadradinhos laranja)
let temaMenu = null;
export const setTemaMenu = t => { temaMenu = t; };
export function fondoMenu(g, w, h) {
  if (temaMenu === 'halloween') {
    rect(g, 0, 0, w, h, 0x170c29);
    for (let y = -4, f = 0; y < h; y += 16, f++) {
      const impar = Math.abs(Math.round(y / 16)) % 2;
      for (let x = impar ? 8 : 0, c = 0; x < w; x += 16, c++) { g.fillStyle = (f * 7 + c * 3) % 11 === 0 ? '#3a1d10' : '#22113a'; g.fillRect(x, y, 7, 7); }
    }
    return;
  }
  rect(g, 0, 0, w, h, UI.fondo);
  g.fillStyle = hex(UI.cuadro);
  for (let y = -4; y < h; y += 16) {
    const impar = Math.abs(Math.round(y / 16)) % 2;
    for (let x = impar ? 8 : 0; x < w; x += 16) g.fillRect(x, y, 7, 7);
  }
}

// Plaquinha vermelha (NEW!, contadores)
export function chapa(g, s, x, y) {
  const w = Math.max(14, Math.round(medir(g, s)) + 8), h = 13;
  redondo(g, x, y - 6, w, h, UI.contorno, 2);
  redondo(g, x + 1, y - 5, w - 2, h - 2, UI.rojo, 1);
  rect(g, x + 2, y - 5, w - 4, 1, UI.rojoLuz);
  rect(g, x + 2, y + 5, w - 4, 1, UI.rojoBajo);
  texto(g, s, x + 4, y - 4, { tam: 8 });
  return w;
}

// Estrelinha de 4 pontas (brilho)
export function destello(g, x, y, color, grande) {
  g.fillStyle = color;
  const n = grande ? 3 : 2;
  g.fillRect(x, y, 1, 1);
  for (let i = 1; i <= n; i++) { g.fillRect(x - i, y, 1, 1); g.fillRect(x + i, y, 1, 1); g.fillRect(x, y - i, 1, 1); g.fillRect(x, y + i, 1, 1); }
}

// Ícones 9x9 dos botões (1 = traço escuro, 2 = branco, 3 = cor do tema)
const ICONOS = {
  pokeball: ['..11111..', '.1333331.', '133323331', '133211331', '111122111', '122211221', '122222221', '.1222221.', '..11111..'],
  libro: ['.1111111.', '133333331', '132222231', '132222231', '133333331', '132222231', '132222231', '133333331', '.1111111.'],
  ayuda: ['..11111..', '.1222221.', '12211.221', '1111.1221', '....1221.', '...1221..', '...122...', '.........', '...122...'],
  engranaje: ['....1....', '.1.121.1.', '.1.121.1.', '..12221..', '112232211', '..12221..', '.1.121.1.', '.1.121.1.', '....1....'],
  personas: ['.11...11.', '1221.1221', '1221.1221', '.11...11.', '1222.2221', '12222222.', '1222.2221', '.........', '.........'],
  robot: ['....1....', '...121...', '.1111111.', '123323321', '122222221', '123333321', '122222221', '.1111111.', '..1...1..'],
  dos: ['.11...11.', '1221.1221', '.11...11.', '.1.....1.', '121...121', '.1.....1.', '.1.1.1.1.', '.........', '.........'],
  diana: ['..11111..', '.1222221.', '12233221.', '1223.3221', '1223.3221', '1223333221', '.1222221.', '..11111..', '.........'],
  atras: ['.........', '...1.....', '..121....', '.12211111', '1222222221', '.12211111', '..121....', '...1.....', '.........'],
};
export function icono(g, id, x, y, color = '#ffd23c') {
  const m = ICONOS[id];
  if (!m) return;
  for (let j = 0; j < m.length; j++) for (let i = 0; i < m[j].length; i++) {
    const c = m[j][i];
    if (c === '.') continue;
    g.fillStyle = c === '1' ? '#04102c' : c === '2' ? '#ffffff' : color;
    g.fillRect(x + i, y + j, 1, 1);
  }
}
