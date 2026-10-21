// Constantes do PK confront. O mundo lógico tem 640 x 360 e a simulação roda a 60 passos por segundo.
export const VERSION = '2.2.0';
// largura lógica: 640 em tela 16:9; em celulares compridos cresce até 900 para preencher a tela
export let ANCHO = 640;
export const setAncho = w => { ANCHO = w; };
export const ALTO = 360;
export const TICK = 1 / 60;
export const FUENTE = '"Pixelify Sans", monospace';

// Cores da interface (azul escuro com botões azuis e destaque dourado)
export const UI = {
  fondo: 0x0b1d3b, cuadro: 0x0f2649, contorno: 0x04102c, borde: 0x79c4f7, bordeLuz: 0xa8e8ff,
  relleno: 0x225697, rellenoLuz: 0x3577c2, rellenoBajo: 0x2c66ad, sombra: 0x061226,
  oro: 0xf8c448, oroBorde: 0xfff2a0, oroLuz: 0xffe27a, anillo: 0x8fd3ff,
  texto: '#ffffff', textoOscuro: '#2a1a00', suave: '#9fb8dd', apagado: '#5d7399', amarillo: '#ffd23c', bordeTexto: '#04102c',
  rojo: 0xe8463a, rojoLuz: 0xff7a6a, rojoBajo: 0xa8281e,
  panel: 0x0a1a38, panelBorde: 0x2c4f8c, panelLuz: 0x1b3a6e,
};
export const hex = n => '#' + n.toString(16).padStart(6, '0');

// Arena oval do combate (mundo de 960 x 441, elipse centrada em 480,222)
export const MUNDO = { w: 960, h: 441 };
export const RADIO = 9;
export const HUD_ALTO = 48;
// faixa de baixo com as 5 skills (mesma altura do jogo original)
export const BARRA_Y = 334;

// Arena oval do combate: elipse em coordenadas do mundo
export const OVALO = { cx: 480, cy: 222, rx: 455, ry: 168 };
