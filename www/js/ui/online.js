// Tela ONLINE: criar sala, entrar numa sala por código, ou jogar direto entre dois celulares sem servidor (P2P).
import { ANCHO, ALTO, UI } from '../config.js';
import { fondoMenu, texto, marco } from '../render/pixel.js';
import { ListaBotones } from './menus.js';
import { TransporteWS, TransporteP2P } from '../online/transporte.js';
import { Sesion } from '../online/sesion.js';
import { sfx } from '../audio.js';
import { centrada } from './centrar.js';

const servidorPorDefecto = () => (/^https?:/.test(location.protocol) ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/relay` : '');
const copiar = txt => { try { navigator.clipboard?.writeText(txt).catch(() => {}); } catch { /* sem área de transferência */ } };
const pedir = (msg, def = '') => { try { return window.prompt(msg, def); } catch { return null; } };

export class Online {
  constructor(app) {
    this.app = app; this.t = 0; this.estado = 'menu'; this.msg = ''; this.error = false; this.codigo = ''; this.tr = null; this.ocupado = false;
    this.armar('principal');
  }

  servidor() { return this.app.ajustes.servidor || servidorPorDefecto(); }

  armar(que) {
    this.menu = que;
    const ops = que === 'principal' ? [
      { id: 'crear', txt: 'CREATE ROOM' }, { id: 'unir', txt: 'JOIN ROOM' }, { id: 'p2p', txt: 'NO SERVER (P2P CODES)' },
      { id: 'servidor', txt: this.servidor() ? 'SERVER: CHANGE' : 'SERVER: SET ADDRESS' }, { id: 'atras', txt: 'BACK', atras: true },
    ] : [
      { id: 'p2pHost', txt: 'HOST: CREATE CODE' }, { id: 'p2pUnir', txt: 'JOIN: PASTE CODE' }, { id: 'atras', txt: 'BACK', atras: true },
    ];
    this.lista = new ListaBotones({ x: 320, y: 118, w: 262, h: 26, paso: 31, ops, alElegir: o => this.elegir(o) });
  }

  decir(msg, error = false) { this.msg = msg; this.error = error; }

  elegir(o) {
    if (this.ocupado) return;
    if (o.id === 'atras') return this.volver();
    if (o.id === 'p2p') return this.armar('p2p');
    if (o.id === 'servidor') {
      const v = pedir('SERVER ADDRESS (example: ws://192.168.0.10:8080/relay)\nLeave empty to use this site.', this.app.ajustes.servidor || servidorPorDefecto());
      if (v != null) { this.app.ajustes.servidor = v.trim(); this.app.guardarAjustes(); this.armar('principal'); }
      return;
    }
    if (o.id === 'crear' || o.id === 'unir') return this.sala(o.id);
    if (!TransporteP2P.soportado()) return this.decir('P2P NOT SUPPORTED HERE', true);
    return o.id === 'p2pHost' ? this.p2pAnfitrion() : this.p2pInvitado();
  }

  volver() {
    sfx('atras');
    if (this.estado === 'sala') { this.tr?.cerrar(); this.tr = null; this.estado = 'menu'; this.decir(''); return; }
    if (this.menu === 'p2p') return this.armar('principal');
    this.app.ir('titulo');
  }

  async sala(id) {
    const url = this.servidor();
    if (!url) return this.decir('SET THE SERVER ADDRESS FIRST', true);
    let accion = { crear: true };
    if (id === 'unir') {
      const c = pedir('ROOM CODE (4 LETTERS)');
      if (!c) return;
      accion = { unir: c.trim().toUpperCase() };
    }
    this.ocupado = true; this.decir('CONNECTING...');
    try {
      const tr = await TransporteWS.conectar(url, accion);
      this.tr = tr; this.codigo = tr.codigo; this.jugadores = 1; this.estado = 'sala';
      this.decir(tr.rol === 'host' ? 'WAITING FOR YOUR FRIENDS' : 'WAITING FOR THE HOST TO START');
      if (tr.rol === 'host') copiar(tr.codigo);
      tr.alCerrar = () => { if (this.estado === 'sala') { this.estado = 'menu'; this.decir('THE ROOM WAS CLOSED', true); } };
      tr.alPar = n => { this.jugadores = n; if (tr.rol === 'host' && n >= 3) this.comenzar(); };
      tr.alMensaje = m => { if (m.t === 'ir') this.emparejar(tr, m.n); else if (m.t === 'salio') this.jugadores = m.n; };
    } catch (e) { this.decir(e.message, true); }
    this.ocupado = false;
  }

  async p2pAnfitrion() {
    this.ocupado = true; this.decir('CREATING CODE...');
    try {
      const tr = await TransporteP2P.anfitrion();
      copiar(tr.codigo);
      pedir('STEP 1 OF 2: send this code to your friend (already copied).', tr.codigo);
      const r = pedir('STEP 2 OF 2: paste the REPLY code your friend sends back.');
      if (!r) { tr.cerrar(); this.decir('CANCELED'); this.ocupado = false; return; }
      this.decir('CONNECTING...');
      await tr.responder(r);
      tr.alPar = () => this.emparejar(tr, 2);
      setTimeout(() => { if (!tr.pareado && !tr.fin) { tr.cerrar(); this.decir('COULD NOT CONNECT (TRY THE ROOM CODE)', true); } }, 20000);
      this.tr = tr;
    } catch { this.decir('INVALID CODE', true); }
    this.ocupado = false;
  }

  async p2pInvitado() {
    const c = pedir('Paste the code your friend sent you.');
    if (!c) return;
    this.ocupado = true; this.decir('PREPARING REPLY...');
    try {
      const tr = await TransporteP2P.invitado(c);
      copiar(tr.codigo);
      this.tr = tr;
      tr.alPar = () => this.emparejar(tr, 2);
      this.decir('WAITING FOR THE HOST...');
      pedir('Send this REPLY code back to your friend (already copied). Then press OK and wait.', tr.codigo);
      setTimeout(() => { if (!tr.pareado && !tr.fin) { tr.cerrar(); this.decir('COULD NOT CONNECT (TRY THE ROOM CODE)', true); } }, 40000);
    } catch { this.decir('INVALID CODE', true); }
    this.ocupado = false;
  }

  // o anfitrião manda começar (2 ou 3 jogadores na sala)
  comenzar() {
    if (this.tr?.rol !== 'host' || this.jugadores < 2 || this.hecho) return;
    this.tr.enviar({ t: 'ir', n: this.jugadores });
    this.emparejar(this.tr, this.jugadores);
  }

  emparejar(tr, n = 2) {
    if (this.hecho) return;
    this.hecho = true;
    sfx('confirmar');
    this.app.online = new Sesion(tr, tr.slot ?? (tr.rol === 'host' ? 0 : 1), n);
    this.app.ir('seleccion', { modo: 'online' });
  }

  tecla(c, nueva) {
    if (!nueva) return;
    if (c === 'Escape' || c === 'Backspace') return this.volver();
    if (this.estado === 'menu') this.lista.tecla(c);
  }
  puntero(tipo, p) {
    if (this.estado === 'sala') { if (tipo === 'down') { if (p.x > 220 && p.x < 420 && p.y > 270 && p.y < 296) this.volver(); else if (p.x > 220 && p.x < 420 && p.y > 236 && p.y < 262) this.comenzar(); } return; }
    this.lista.puntero(tipo, p);
  }
  actualizar(dt) { this.t += dt; }

  dibujar(g) {
    fondoMenu(g, ANCHO, ALTO);
    marco(g, 0, 0, ANCHO, 26, 'panel');
    texto(g, 'ONLINE', ANCHO / 2, 13, { tam: 12, color: UI.amarillo, borde: 3, align: 'center', base: 'middle' });
    if (this.estado === 'sala') {
      texto(g, 'ROOM CODE', ANCHO / 2, 96, { tam: 9, align: 'center', color: UI.suave });
      texto(g, this.codigo, ANCHO / 2, 150, { tam: 36, align: 'center', base: 'middle', color: '#ffd23c', borde: 6, peso: 700 });
      texto(g, 'Friends join with this code (JOIN ROOM). Up to 3 players.', ANCHO / 2, 190, { tam: 8, align: 'center', color: '#fff' });
      texto(g, `PLAYERS ${this.jugadores}/3`, ANCHO / 2, 208, { tam: 9, align: 'center', color: '#ffd23c', borde: 2 });
      texto(g, this.msg + '.'.repeat(1 + Math.floor(this.t * 2) % 3), ANCHO / 2, 226, { tam: 8, align: 'center', color: '#7dd3fc' });
      if (this.tr?.rol === 'host') {
        const ok = this.jugadores >= 2;
        marco(g, 220, 236, 200, 26, ok ? 'oro' : 'apagado');
        texto(g, ok ? `START (${this.jugadores} PLAYERS)` : 'START (NEEDS 2+)', ANCHO / 2, 249, { tam: 10, align: 'center', base: 'middle', color: ok ? UI.textoOscuro : UI.apagado });
      }
      marco(g, 220, 270, 200, 26, 'azul');
      texto(g, 'CANCEL', ANCHO / 2, 283, { tam: 10, align: 'center', base: 'middle' });
      return;
    }
    this.lista.dibujar(g, this.t);
    if (this.msg) texto(g, this.msg, ANCHO / 2, 296, { tam: 8, align: 'center', color: this.error ? '#ff7a7a' : '#7dd3fc', borde: 2 });
    texto(g, this.menu === 'principal' ? 'Play with a friend: same Wi-Fi, or anywhere with P2P codes.' : 'No server needed. Works best when both are on normal Wi-Fi or 4G.', ANCHO / 2, 318, { tam: 7, align: 'center', color: UI.apagado });
  }
}

centrada(Online);
