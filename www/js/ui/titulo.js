// Tela inicial: logo flutuando, dois Pokémon dos lados, menu de botões no centro e um desfile de
// Pokémon andando no chão. Menus: principal, PLAY e SETTINGS.
import { ANCHO, ALTO, UI, VERSION, hex } from '../config.js';
import { HUELLA } from '../data/pokemon.js';
import { texto, fondoMenu, rect, destello, medir, setTemaMenu } from '../render/pixel.js';
import { halloweenAtivo, cieloHalloween, murcielagos, horizonteHalloween, calabaza, fantasma, nevoa, sombrero } from './halloween.js';
import { FINALES, TODAS_LAS_FORMAS, filaDesdeAngulo } from '../render/sprites.js';
import { ListaBotones } from './menus.js';
import { sfx } from '../audio.js';
import { centrada } from './centrar.js';

const MENUS = {
  principal: [
    { id: 'jugar', txt: 'PLAY', menu: 'jugar', ico: 'pokeball' },
    { id: 'pokedex', txt: 'POKÉDEX', escena: 'pokedex', ico: 'libro' },
    { id: 'online', txt: 'ONLINE', escena: 'online', ico: 'dos' },
    { id: 'perfil', txt: 'PROFILE', escena: 'perfil', ico: 'personas' },
    { id: 'tutorial', txt: 'TUTORIAL', escena: 'combate', datos: { modo: 'tutorial' }, ico: 'ayuda' },
    { id: 'ajustes', txt: 'SETTINGS', menu: 'ajustes', ico: 'engranaje' },
    { id: 'creditos', txt: 'CREDITS', escena: 'creditos', ico: 'personas' },
  ],
  jugar: [
    { id: 'liga', txt: 'POKÉMON LEAGUE', escena: 'liga', ico: 'pokeball' },
    { id: 'cpu', txt: 'VS CPU', escena: 'seleccion', datos: { modo: 'cpu' }, ico: 'robot' },
    { id: 'arena', txt: 'ARENA (3 FIGHTERS)', escena: 'seleccion', datos: { modo: 'arena' }, ico: 'personas' },
    { id: 'versus', txt: '2 PLAYERS', escena: 'seleccion', datos: { modo: 'versus' }, ico: 'dos' },
    { id: 'entreno', txt: 'TRAINING', escena: 'seleccion', datos: { modo: 'entreno' }, ico: 'diana' },
    { id: 'atras', txt: 'BACK', menu: 'principal', ico: 'atras', atras: true },
  ],
  ajustes: [
    { id: 'controles', txt: 'CONTROLS', escena: 'controles', ico: 'engranaje' },
    { id: 'layout', txt: 'TOUCH LAYOUT', escena: 'layout', ico: 'engranaje' },
    { id: 'sonido', txt: 'SOUND', ajuste: 'sonido', ico: 'ayuda' },
    { id: 'musica', txt: 'MUSIC', ajuste: 'musica', ico: 'ayuda' },
    { id: 'mira', txt: 'AIM GUIDE', ajuste: 'mira', ico: 'diana' },
    { id: 'graficos', txt: 'GRAPHICS', ajuste: 'graficosBajos', ico: 'engranaje' },
    { id: 'halloween', txt: 'HALLOWEEN', ajuste: 'halloween', ico: 'engranaje' },
    { id: 'atras', txt: 'BACK', menu: 'principal', ico: 'atras', atras: true },
  ],
};
const SUBTITULO = { principal: `ALPHA ${VERSION} · ${HUELLA} · FAN GAME`, jugar: 'PLAY ON THIS DEVICE · NO INTERNET NEEDED', ajustes: `ALPHA ${VERSION} · ${HUELLA} · FAN GAME` };
const BX = 320, BAJA = 24, LINEA_SUELO = 312, SUELO = 334;
const DESTELLOS = [[245, 14, '#7fe8ff', 0], [469, 31, '#ffd23c', 1], [132, 50, '#c9a0ff', 0], [195, 72, '#ffd23c', 1], [470, 74, '#c9a0ff', 0], [433, 93, '#7fe8ff', 1], [140, 103, '#7fe8ff', 0], [83, 88, '#ff9ccf', 0], [554, 68, '#ff9ccf', 0], [555, 106, '#7fe8ff', 0], [60, 40, '#ffd23c', 1], [585, 30, '#7fe8ff', 1]];

const azar = (a, b) => a + Math.random() * (b - a);
const elegir = lista => lista[Math.floor(Math.random() * lista.length)];

export class Titulo {
  constructor(app, datos) {
    this.app = app;
    this.t = 0;
    this.menu = MENUS[datos?.menu] ? datos.menu : 'principal';
    this.lista = null;
    this.desfile = [];
    this.guardianes = [];
    this.ataque = [0, 0];
  }

  entrar() {
    const bank = this.app.bank;
    // dois Pokémon grandes nos lados (formas finais de duas linhas diferentes, que não sejam muito altas)
    const medianos = FINALES.filter(f => { const m = bank.medidas(f.dex); return (m.feet ?? 5) - (m.head ?? -16) <= 40; });
    const pool = [...medianos].sort(() => Math.random() - 0.5);
    this.guardianes = [{ x: 110 - (ANCHO - 640) / 4, f: pool[0], fila: 2 }, { x: 530 + (ANCHO - 640) / 4, f: pool[1], fila: 6 }].filter(x => x.f);
    for (const gd of this.guardianes) bank.precargar(gd.f.dex, ['Idle', 'Attack']);
    for (let i = 0; i < 5; i++) this.nuevoDesfile(true);
    this.abrir(this.menu);
  }

  abrir(menu, desde = null) {
    this.menu = menu;
    this.lista = new ListaBotones({
      x: BX, y: 112 + BAJA + (menu === 'principal' ? 0 : 2), w: 210, h: menu === 'jugar' ? 24 : 23, paso: menu === 'jugar' ? 27 : 25,
      ops: MENUS[menu].map(o => ({ ...o })),
      alElegir: o => this.elegirOpcion(o),
    });
    const i = MENUS[menu].findIndex(o => o.menu === desde);
    this.lista.foco = Math.max(0, i);
    this.refrescarAjustes();
  }

  refrescarAjustes() {
    setTemaMenu(halloweenAtivo(this.app.ajustes) ? 'halloween' : null);
    for (const o of this.lista.ops) if (o.ajuste) o.txt = o.id === 'halloween' ? `HALLOWEEN THEME: ${halloweenAtivo(this.app.ajustes) ? 'ON' : 'OFF'}` : o.id === 'graficos' ? `GRAPHICS: ${this.app.ajustes.graficosBajos ? 'LOW' : 'HIGH'}` : `${{ sonido: 'SOUND', musica: 'MUSIC', mira: 'AIM GUIDE' }[o.id]}: ${this.app.ajustes[o.ajuste] !== false && (o.id === 'mira' || this.app.ajustes[o.ajuste]) ? 'ON' : 'OFF'}`;
  }

  elegirOpcion(o) {
    if (o.ajuste === 'halloween') { this.app.ajustes.halloween = !halloweenAtivo(this.app.ajustes); this.app.guardarAjustes(); this.refrescarAjustes(); return; }
    if (o.ajuste) {
      this.app.ajustes[o.ajuste] = o.ajuste === 'mira' ? this.app.ajustes.mira === false : !this.app.ajustes[o.ajuste];
      this.app.guardarAjustes();
      if (o.ajuste === 'graficosBajos') this.app.aplicarGraficos?.();
      import('../audio.js').then(a => { a.silenciar(!this.app.ajustes.sonido); this.app.musica(); if (!this.app.ajustes.musica) a.pararMusica(); });
      this.refrescarAjustes();
      return;
    }
    if (o.menu) return this.abrir(o.menu, o.menu === 'principal' ? this.menu : null);
    if (o.escena) this.app.ir(o.escena, o.datos);
  }

  nuevoDesfile(enMarcha = false) {
    const forma = elegir(TODAS_LAS_FORMAS);
    const m = this.app.bank.medidas(forma.dex);
    if ((m.feet ?? 5) - (m.head ?? -16) > 50 || !this.app.bank.tiene(forma.dex)) return;
    this.app.bank.precargar(forma.dex, ['Walk']);
    const derecha = Math.random() < 0.5;
    const ex = (ANCHO - 640) / 2;
    const x = enMarcha ? azar(-ex + 40, 640 + ex - 40) : derecha ? -ex - 30 : 640 + ex + 30;
    this.desfile.push({ forma, x, y: SUELO + Math.round(azar(-5, 5)), v: (derecha ? 1 : -1) * azar(24, 40), fila: derecha ? 2 : 6 });
  }

  actualizar(dt) {
    this.t += dt;
    for (const d of this.desfile) d.x += d.v * dt;
    this.desfile = this.desfile.filter(d => d.x > -(ANCHO - 640) / 2 - 40 && d.x < 640 + (ANCHO - 640) / 2 + 40);
    if (this.t - (this.ultimoDesfile ?? 0) > 1.5) { this.ultimoDesfile = this.t; this.nuevoDesfile(); }
    this.guardianes.forEach((gd, i) => {
      if (this.t > (gd.proximo ??= 3.2 + i * 1.6)) { gd.proximo = this.t + 3.2 + i * 1.6; gd.ataque = this.t; }
    });
  }

  tecla(c, nueva) {
    if (!nueva) return;
    if (this.lista.tecla(c)) return;
    if ((c === 'Escape' || c === 'Backspace') && this.menu !== 'principal') { sfx('atras'); this.abrir('principal', this.menu); }
  }
  puntero(tipo, p) { this.lista.puntero(tipo, p); }

  dibujar(g) {
    const t = this.t, bank = this.app.bank, hw = halloweenAtivo(this.app.ajustes);
    if (hw) cieloHalloween(g, t, BX, BAJA);
    // halo atrás do logo
    const hal = g.createRadialGradient(BX, 62 + BAJA, 10, BX, 62 + BAJA, 150);
    const cor = hw ? '255,140,40' : '120,190,255';
    hal.addColorStop(0, `rgba(${cor},${hw ? 0.22 : 0.32})`); hal.addColorStop(1, `rgba(${cor},0)`);
    g.fillStyle = hal; g.fillRect(-300, 0, 1240, 230);
    if (hw) { murcielagos(g, t); horizonteHalloween(g, LINEA_SUELO); }
    // chão
    rect(g, -300, LINEA_SUELO + 1, 1240, 1, UI.contorno);
    rect(g, -300, LINEA_SUELO, 1240, 1, hw ? 0x6a2fa8 : 0x2a5a9a);
    rect(g, -300, LINEA_SUELO + 2, 1240, ALTO - LINEA_SUELO - 2, hw ? 0x140a22 : 0x0a1830);
    if (hw) { const ex = (ANCHO - 640) / 2; calabaza(g, 24 - ex * 0.5, 328, t, 1.1, 0); calabaza(g, 616 + ex * 0.5, 330, t, 1, 1); calabaza(g, 58 - ex * 0.5, 340, t, 0.7, 2); calabaza(g, 586 + ex * 0.5, 342, t, 0.75, 3); }

    // dois Pokémon grandes
    const suelo = 114 + BAJA;
    for (const gd of this.guardianes) {
      const m = bank.medidas(gd.f.dex);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(gd.x, suelo, 23, 5, 0, 0, 7); g.fill();
      const atacando = gd.ataque != null && t - gd.ataque < 0.7 && bank.tieneAnim(gd.f.dex, 'Attack');
      if (atacando) bank.dibujar(g, gd.f.dex, 'Attack', t - gd.ataque, gd.x, suelo, 2, { fila: gd.fila, bucle: false });
      else bank.dibujar(g, gd.f.dex, 'Idle', t, gd.x, suelo, 2, { fila: gd.fila });
    }
    if (hw) this.guardianes.forEach((gd, i) => fantasma(g, gd.x + (i ? -34 : 34), suelo - 62, t, i * 2));

    this.logo(g, t, hw);

    // brilhos
    DESTELLOS.forEach(([x, y, c, gr], i) => {
      const k = Math.sin(t * 1.3 + i * 1.7);
      if (k > 0.1) { g.globalAlpha = Math.min(1, k * 1.4); destello(g, x, y + BAJA, c, gr); g.globalAlpha = 1; }
    });

    if (hw && this.menu === 'principal') texto(g, `HAPPY HALLOWEEN! · ALPHA ${VERSION}`, BX, 99 + BAJA, { tam: 8, color: '#ffb35a', align: 'center' });
    else texto(g, SUBTITULO[this.menu], BX, 99 + BAJA, { tam: 8, color: UI.suave, align: 'center' });

    this.lista.dibujar(g, t);

    // desfile no chão
    for (const d of this.desfile.sort((a, b) => a.y - b.y)) {
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(d.x, d.y, 11, 3, 0, 0, 7); g.fill();
      bank.dibujar(g, d.forma.dex, 'Walk', t + d.x * 0.01, d.x, d.y, 1, { fila: d.fila });
    }
    if (hw) nevoa(g, t, LINEA_SUELO + 14);
    texto(g, 'SPRITES: PMDCOLLAB SPRITECOLLAB (CC BY-NC 4.0) · NON-PROFIT FAN GAME', BX, ALTO - 12, { tam: 8, color: UI.apagado, align: 'center' });
  }

  // Logo desenhado por código: pokébola, "PK" grande dourado e "CONFRONT" azul com contorno
  logo(g, t, hw = false) {
    const y = 4 + BAJA + Math.round(Math.sin(t * 2.2) * 2);
    g.save();
    g.translate(BX, y);
    const wPK = medir(g, 'PK', 44, 700);
    const ancho = 56 + 8 + wPK, x0 = -ancho / 2;
    // pokébola
    const bx = x0 + 28, by = 29;
    g.fillStyle = '#04102c'; g.beginPath(); g.arc(bx, by, 27, 0, 7); g.fill();
    g.fillStyle = '#e8463a'; g.beginPath(); g.arc(bx, by, 24, Math.PI, 0); g.fill();
    g.fillStyle = '#f4f4f4'; g.beginPath(); g.arc(bx, by, 24, 0, Math.PI); g.fill();
    g.fillStyle = '#04102c'; g.fillRect(bx - 24, by - 2, 48, 4);
    g.beginPath(); g.arc(bx, by, 9, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, 5.5, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(bx - 18, by - 18, 9, 3);
    if (hw) sombrero(g, bx + 2, by - 20);
    // PK (no Halloween, laranja de abóbora; CONFRONT em roxo)
    const px = x0 + 64, [cSombra, cBase, cLuz] = hw ? ['#4a1500', '#ff8a1a', '#ffd08a'] : ['#5b3300', '#ffd23c', '#fff2a0'];
    texto(g, 'PK', px, -6, { tam: 44, color: cSombra, borde: 9, colorBorde: cSombra, peso: 700 });
    texto(g, 'PK', px, -6, { tam: 44, color: cBase, borde: 5, colorBorde: cSombra, peso: 700 });
    texto(g, 'PK', px, -8, { tam: 44, color: cLuz, peso: 700 });
    // CONFRONT
    texto(g, 'CONFRONT', 0, 53, { tam: 24, color: '#04102c', borde: 2, colorBorde: '#04102c', peso: 700, align: 'center' });
    texto(g, 'CONFRONT', 0, 52, { tam: 24, color: hw ? '#b07aff' : '#8fd3ff', peso: 700, align: 'center' });
    texto(g, 'CONFRONT', 0, 51, { tam: 24, color: hw ? '#efe4ff' : '#ffffff', peso: 700, align: 'center', max: 300 });
    g.restore();
  }
}

centrada(Titulo);
