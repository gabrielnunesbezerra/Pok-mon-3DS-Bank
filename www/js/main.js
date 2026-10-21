// Ponto de entrada: tela única em 640 x 360 com escala nítida, troca de cenas e laço principal.
import { ANCHO, ALTO, TICK, setAncho } from './config.js';
import { Entrada } from './input.js';
import { SpriteBank } from './render/sprites.js';
import * as audio from './audio.js';
import { Titulo } from './ui/titulo.js';
import { Creditos } from './ui/creditos.js';
import { Controles } from './ui/controles.js';
import { Pokedex } from './ui/pokedex.js';
import { Seleccion } from './ui/seleccion.js';
import { Combate } from './ui/combate.js';
import { PanelTactil } from './controles.js';

const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
const app = {
  canvas, g, bank: new SpriteBank(), escena: null, tiempo: 0, ajustes: cargarAjustes(),
  zoom: 1,
  ir(nombre, datos) {
    const E = ESCENAS[nombre];
    this.escena?.salir?.();
    this.escena = new E(this, datos);
    this.escena.entrar?.();
    this.nombre = nombre;
    this.musica();
  },
};
const ESCENAS = { titulo: Titulo, creditos: Creditos, controles: Controles, pokedex: Pokedex, seleccion: Seleccion, combate: Combate };

function cargarAjustes() {
  try { return { musica: true, sonido: true, ...JSON.parse(localStorage.getItem('pkconfront.ajustes')) }; } catch { return { musica: true, sonido: true }; }
}
app.musica = () => {
  const que = app.nombre === 'combate' ? 'combate' : 'menu';
  audio.activarMusica(app.ajustes.musica);
  if (app.ajustes.musica && audio.musicaActual() !== que) audio.tocarMusica(que);
};
app.guardarAjustes = () => { try { localStorage.setItem('pkconfront.ajustes', JSON.stringify(app.ajustes)); } catch { /* sem armazenamento */ } };

// escala: a tela lógica cabe na janela, desenhada em resolução cheia do aparelho
function medir() {
  const dpr = Math.min(3, devicePixelRatio || 1);
  // a altura lógica é sempre 360; a largura acompanha a proporção da tela (640 a 900)
  const W = Math.max(640, Math.min(900, Math.round((ALTO * innerWidth) / innerHeight)));
  setAncho(W);
  app.W = W;
  const z = Math.min(innerWidth / W, innerHeight / ALTO);
  app.zoom = z;
  canvas.width = Math.round(W * z * dpr);
  canvas.height = Math.round(ALTO * z * dpr);
  canvas.style.width = `${W * z}px`;
  canvas.style.height = `${ALTO * z}px`;
  app.k = canvas.width / W;
}
addEventListener('resize', medir);
medir();

const aCoord = (cx, cy) => {
  const r = canvas.getBoundingClientRect();
  return { x: ((cx - r.left) / r.width) * app.W, y: ((cy - r.top) / r.height) * ALTO };
};
app.aCoord = aCoord;
app.tactil = new PanelTactil(app);
app.entrada = new Entrada(canvas, aCoord);
app.entrada.alTecla = (c, nueva, e) => { audio.iniciar(); app.musica(); app.escena?.tecla?.(c, nueva, e); };
app.entrada.alPuntero = (tipo, p, e) => { if (tipo === 'down') { audio.iniciar(); app.musica(); } app.escena?.puntero?.(tipo, p, e); };
audio.silenciar(!app.ajustes.sonido);

let ultimo = performance.now();
let acum = 0;
function bucle(ahora) {
  let dt = Math.min(0.1, (ahora - ultimo) / 1000);
  ultimo = ahora;
  app.tiempo += dt;
  acum += dt;
  // passos fixos de 1/60 s para o motor; o resto (menus) usa o dt real
  let pasos = 0;
  while (acum >= TICK && pasos < 6) { app.escena?.paso?.(TICK); acum -= TICK; pasos++; }
  if (pasos === 6) acum = 0;
  app.escena?.actualizar?.(dt);
  g.setTransform(app.k, 0, 0, app.k, 0, 0);
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#07060c';
  g.fillRect(0, 0, app.W, ALTO);
  app.escena?.dibujar(g);
  requestAnimationFrame(bucle);
}

async function arrancar() {
  g.setTransform(app.k, 0, 0, app.k, 0, 0);
  g.fillStyle = '#07060c'; g.fillRect(0, 0, ANCHO, ALTO);
  g.fillStyle = '#d6a63a'; g.font = '12px sans-serif'; g.textAlign = 'center'; g.fillText('LOADING...', ANCHO / 2, ALTO / 2);
  try { await document.fonts.load('10px "Pixelify Sans"'); await document.fonts.load('700 10px "Pixelify Sans"'); } catch { /* usa a fonte padrão */ }
  await app.bank.cargar();
  const params = new URLSearchParams(location.search);
  window.pkc = app;
  app.ir(ESCENAS[params.get('pantalla')] ? params.get('pantalla') : 'titulo');
  requestAnimationFrame(bucle);
}
arrancar();
