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
import { Online } from './ui/online.js';
import { LayoutTactil } from './ui/layout.js';
import { Liga } from './ui/liga.js';
import { Perfil } from './ui/perfil.js';
import { social } from './nube/social.js';
import { formularioAberto } from './ui/formulario.js';
import { texto as textoPx, rect as rectPx } from './render/pixel.js';
import { FxLab } from './ui/fxlab.js';
import { Combate } from './ui/combate.js';
import { PanelTactil } from './controles.js';

const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
const app = {
  canvas, g, bank: new SpriteBank(), escena: null, tiempo: 0, ajustes: cargarAjustes(),
  zoom: 1,
  ir(nombre, datos) {
    const E = ESCENAS[nombre];
    try { this.escena?.salir?.(); } catch (e) { avisarFalha(e); }
    try {
      this.escena = new E(this, datos);
      this.escena.entrar?.();
      this.nombre = nombre;
    } catch (e) {
      // uma tela que quebra ao abrir não trava o jogo: volta para o menu e mostra o erro
      avisarFalha(e);
      if (nombre !== 'titulo') return this.ir('titulo');
    }
    this.musica();
  },
};
// erro numa tela não para o jogo: fica registrado e aparece no canto por alguns segundos
let falha = null;
function avisarFalha(e) { console.error(e); falha = { msg: String(e?.message ?? e).slice(0, 80), t: app.tiempo }; }
function seguro(f) { try { f(); } catch (e) { avisarFalha(e); } }
const ESCENAS = { titulo: Titulo, creditos: Creditos, controles: Controles, pokedex: Pokedex, seleccion: Seleccion, online: Online, layout: LayoutTactil, liga: Liga, perfil: Perfil, fxlab: FxLab, combate: Combate };

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
  const dpr = Math.min(2, devicePixelRatio || 1);
  // a altura lógica é sempre 360; a largura acompanha a proporção da tela (640 a 1100)
  const W = Math.max(640, Math.min(1100, Math.round((ALTO * innerWidth) / innerHeight)));
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
app.entrada.alTecla = (c, nueva, e) => { audio.iniciar(); app.musica(); seguro(() => app.escena?.tecla?.(c, nueva, e)); };
// aviso de convite de amigo, por cima de qualquer tela (menos durante a luta)
const conviteVisivel = () => social.convites.length && app.nombre !== 'combate' && app.nombre !== 'online' && !formularioAberto();
const caixaConvite = () => ({ x: app.W / 2 - 170, y: 30, w: 340, h: 24 });
function dibujarConvite(g) {
  if (!conviteVisivel()) return;
  const c = social.convites[0], b = caixaConvite(), pul = 0.5 + 0.5 * Math.sin(app.tiempo * 6);
  rectPx(g, b.x - 2, b.y - 2, b.w + 4, b.h + 4, '#04102c');
  rectPx(g, b.x, b.y, b.w, b.h, pul > 0.5 ? '#ffd23c' : '#f2c230');
  textoPx(g, `${c.nombre.toUpperCase()} INVITED YOU · TAP TO JOIN`, b.x + 10, b.y + b.h / 2, { tam: 8, base: 'middle', color: '#1a1406', max: b.w - 40 });
  rectPx(g, b.x + b.w - 24, b.y + 3, 20, 18, '#04102c'); textoPx(g, 'X', b.x + b.w - 14, b.y + b.h / 2, { tam: 9, align: 'center', base: 'middle', color: '#fff' });
}
app.entrada.alPuntero = (tipo, p, e) => {
  if (tipo === 'down') { audio.iniciar(); app.musica(); }
  if (tipo === 'down' && conviteVisivel()) {
    const b = caixaConvite();
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
      const c = social.convites[0];
      social.descartarConvite(c);
      if (p.x < b.x + b.w - 26) app.ir('online', { unir: c.sala });
      return;
    }
  }
  seguro(() => app.escena?.puntero?.(tipo, p, e));
};
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
  seguro(() => { while (acum >= TICK && pasos < 6) { app.escena?.paso?.(TICK); acum -= TICK; pasos++; } });
  if (pasos === 6) acum = 0;
  seguro(() => app.escena?.actualizar?.(dt));
  g.setTransform(app.k, 0, 0, app.k, 0, 0);
  g.globalAlpha = 1;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#07060c';
  g.fillRect(0, 0, app.W, ALTO);
  seguro(() => app.escena?.dibujar(g));
  g.setTransform(app.k, 0, 0, app.k, 0, 0); g.globalAlpha = 1;
  seguro(() => dibujarConvite(g));
  if (falha && app.tiempo - falha.t < 8) textoPx(g, `ERROR: ${falha.msg}`, 4, ALTO - 6, { tam: 6, base: 'middle', color: '#ff8a8a' });
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
  social.iniciar();
  app.ir(ESCENAS[params.get('pantalla')] ? params.get('pantalla') : 'titulo');
  requestAnimationFrame(bucle);
}
arrancar();
