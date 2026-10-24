// Tela ONLINE: criar sala, entrar numa sala por código, ou jogar direto entre dois celulares sem servidor (P2P).
import { ANCHO, ALTO, UI } from '../config.js';
import { fondoMenu, texto, marco, rect } from '../render/pixel.js';
import { ROSTER } from '../data/pokemon.js';
import { ListaBotones } from './menus.js';
import { TransporteWS, TransporteP2P, TransporteNube } from '../online/transporte.js';
import { Sesion } from '../online/sesion.js';
import { sfx } from '../audio.js';
import { centrada } from './centrar.js';
import { cuenta } from '../nube/firebase.js';
import { social } from '../nube/social.js';
import { TransporteFirebase } from '../nube/sala.js';
import { pedirFormulario } from './formulario.js';

const servidorPorDefecto = () => (/^https?:/.test(location.protocol) ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/relay` : '');
const copiar = txt => { try { navigator.clipboard?.writeText(txt).catch(() => {}); } catch { /* sem área de transferência */ } };
const MAXJ = 4;
const pedir = (msg, def = '') => { try { return window.prompt(msg, def); } catch { return null; } };

export class Online {
  constructor(app, datos = {}) {
    this.app = app; this.t = 0; this.estado = 'menu'; this.msg = ''; this.error = false; this.codigo = ''; this.tr = null; this.ocupado = false;
    this.armar('principal');
    this.quitar = social.alCambiar(() => { if (this.menu === 'principal' && this.estado === 'menu') this.armar('principal'); });
    // vindo de um convite (entrar na sala do amigo) ou do perfil (criar sala e convidar um amigo)
    if (datos.unir) setTimeout(() => this.sala('unir', datos.unir), 0);
    else if (datos.convidar) setTimeout(() => this.sala('crear').then(() => this.tr && this.convidar(datos.convidar)), 0);
  }
  salir() { this.quitar?.(); }

  servidor() { return this.app.ajustes.servidor || servidorPorDefecto(); }

  armar(que) {
    this.menu = que;
    const convites = social.convites.slice(0, 2).map(c => ({ id: 'convite', txt: `JOIN ${c.nombre.toUpperCase()}'S ROOM`, convite: c }));
    const ops = que === 'principal' ? [
      ...convites, { id: 'crear', txt: 'CREATE ROOM' }, { id: 'unir', txt: 'JOIN ROOM' }, { id: 'avanzado', txt: 'MORE OPTIONS' }, { id: 'atras', txt: 'BACK', atras: true },
    ] : que === 'avanzado' ? [
      { id: 'p2p', txt: 'NO SERVER (P2P CODES)' },
      { id: 'servidor', txt: this.app.ajustes.servidor ? 'OWN SERVER: CHANGE' : 'OWN SERVER: SET ADDRESS' }, { id: 'atras', txt: 'BACK', atras: true },
    ] : [
      { id: 'p2pHost', txt: 'HOST: CREATE CODE' }, { id: 'p2pUnir', txt: 'JOIN: PASTE CODE' }, { id: 'atras', txt: 'BACK', atras: true },
    ];
    this.lista = new ListaBotones({ x: 320, y: 118, w: 262, h: 26, paso: 31, ops, alElegir: o => this.elegir(o) });
  }

  decir(msg, error = false) { this.msg = msg; this.error = error; }

  elegir(o) {
    if (this.ocupado) return;
    if (o.id === 'atras') return this.volver();
    if (o.id === 'avanzado') return this.armar('avanzado');
    if (o.id === 'p2p') return this.armar('p2p');
    if (o.id === 'servidor') {
      const v = pedir('SERVER ADDRESS (example: ws://192.168.0.10:8080/relay)\nLeave empty to use the free cloud rooms.', this.app.ajustes.servidor || servidorPorDefecto());
      if (v != null) { this.app.ajustes.servidor = v.trim(); this.app.guardarAjustes(); this.armar('avanzado'); }
      return;
    }
    if (o.id === 'convite') { social.descartarConvite(o.convite); return this.sala('unir', o.convite.sala); }
    if (o.id === 'crear' || o.id === 'unir') return this.sala(o.id);
    if (!TransporteP2P.soportado()) return this.decir('P2P NOT SUPPORTED HERE', true);
    return o.id === 'p2pHost' ? this.p2pAnfitrion() : this.p2pInvitado();
  }

  volver() {
    sfx('atras');
    if (this.estado === 'amigos') { this.estado = 'sala'; return; }
    if (this.estado === 'sala') { this.tr?.cerrar(); this.tr = null; this.estado = 'menu'; this.decir(''); return; }
    if (this.menu === 'p2p') return this.armar('avanzado');
    if (this.menu === 'avanzado') return this.armar('principal');
    this.app.ir('titulo');
  }

  async sala(id, codigoDado) {
    const propio = this.app.ajustes.servidor;
    let accion = { crear: true };
    if (id === 'unir') {
      const c = codigoDado ?? (await pedirFormulario({ titulo: 'Join room', campos: [{ id: 'codigo', rotulo: 'Room code (4 letters)', max: 4 }], ok: 'JOIN' }))?.codigo;
      if (!c) return;
      accion = { unir: c.trim().toUpperCase() };
    }
    if (accion.unir && !/^[A-Z]{4}$/.test(accion.unir)) return this.decir('THE CODE HAS 4 LETTERS', true);
    this.ocupado = true; this.decir('CONNECTING...');
    try {
      // com conta: sala pelo Firebase do Poke Bank (conexão direta e, se não der, pela nuvem);
      // sem conta: sala pelo serviço público de códigos (só conexão direta)
      const tr = propio
        ? await TransporteWS.conectar(propio, accion)
        : cuenta.conectado
          ? accion.crear ? await TransporteFirebase.crear() : await TransporteFirebase.unir(accion.unir)
          : accion.crear ? await TransporteNube.crear() : await TransporteNube.unir(accion.unir);
      this.tr = tr; this.codigo = tr.codigo; this.jugadores = tr.n ?? 1; this.estado = 'sala';
      this.decir(tr.rol === 'host' ? 'WAITING FOR YOUR FRIENDS' : 'WAITING FOR THE HOST TO START');
      if (tr.rol === 'host') copiar(tr.codigo);
      tr.alCerrar = () => { if (this.estado === 'sala') { this.estado = 'menu'; this.decir('THE ROOM WAS CLOSED', true); } };
      tr.alPar = n => { this.jugadores = n; if (tr.rol === 'host' && n >= MAXJ) this.comenzar(); };
      tr.alMensaje = m => { if (m.t === 'ir') this.emparejar(tr, m.n); else if (m.t === 'salio') this.jugadores = m.n; };
    } catch (e) { this.decir(e.message === 'ID-TAKEN' ? 'TRY AGAIN' : e.message, true); }
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

  // convite para um amigo entrar nesta sala
  async abrirAmigos() { this.estado = 'amigos'; this.decir('LOADING FRIENDS'); await social.cargarAmigos().catch(() => {}); this.decir(social.amigos.length ? '' : 'NO FRIENDS YET: ADD THEM IN PROFILE'); }
  async convidar(uid) {
    const a = social.amigos.find(x => x.uid === uid);
    try { await social.convidar(uid, this.codigo); this.decir(`INVITE SENT TO ${(a?.nombre ?? 'FRIEND').toUpperCase()}`); } catch (e) { this.decir(e.message, true); }
    this.estado = 'sala';
  }

  tecla(c, nueva) {
    if (!nueva) return;
    if (c === 'Escape' || c === 'Backspace') return this.volver();
    if (this.estado === 'menu') this.lista.tecla(c);
  }
  puntero(tipo, p) {
    if (this.estado === 'amigos') {
      if (tipo !== 'down') return;
      social.amigos.slice(0, 8).forEach((a, i) => { if (p.x > 170 && p.x < 470 && p.y > 52 + i * 30 && p.y < 78 + i * 30) this.convidar(a.uid); });
      if (p.x > 220 && p.x < 420 && p.y > 300 && p.y < 324) this.volver();
      return;
    }
    if (this.estado === 'sala') { if (tipo === 'down') { if (p.x > 220 && p.x < 420 && p.y > 270 && p.y < 296) this.volver(); else if (p.x > 220 && p.x < 420 && p.y > 236 && p.y < 262) this.comenzar(); else if (cuenta.conectado && p.x > 220 && p.x < 420 && p.y > 302 && p.y < 326) this.abrirAmigos(); } return; }
    this.lista.puntero(tipo, p);
  }
  actualizar(dt) { this.t += dt; }

  dibujar(g) {
    fondoMenu(g, ANCHO, ALTO);
    marco(g, 0, 0, ANCHO, 26, 'panel');
    texto(g, 'ONLINE', ANCHO / 2, 13, { tam: 12, color: UI.amarillo, borde: 3, align: 'center', base: 'middle' });
    if (this.estado === 'amigos') {
      texto(g, 'INVITE A FRIEND', ANCHO / 2, 40, { tam: 9, align: 'center', color: UI.suave });
      social.amigos.slice(0, 8).forEach((a, i) => {
        const y = 52 + i * 30;
        marco(g, 170, y, 300, 26, 'azul');
        const p = a.icono && ROSTER.find(x => x.id === a.icono), img = p && this.app.bank.retrato(p.dex);
        if (img) g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 174, y + 2, 22, 22);
        texto(g, a.nombre.toUpperCase(), 202, y + 13, { tam: 9, base: 'middle' });
        rect(g, 446, y + 9, 8, 8, a.online ? '#3ccf4e' : '#4a5160');
        texto(g, a.online ? 'ONLINE' : 'OFFLINE', 440, y + 13, { tam: 6, align: 'right', base: 'middle', color: a.online ? '#86efac' : UI.apagado });
      });
      if (this.msg) texto(g, this.msg, ANCHO / 2, 292, { tam: 8, align: 'center', color: '#7dd3fc' });
      marco(g, 220, 300, 200, 24, 'azul'); texto(g, 'BACK', ANCHO / 2, 312, { tam: 10, align: 'center', base: 'middle' });
      return;
    }
    if (this.estado === 'sala') {
      texto(g, 'ROOM CODE', ANCHO / 2, 96, { tam: 9, align: 'center', color: UI.suave });
      if (this.tr?.via) texto(g, this.tr.via === 'P2P' ? 'DIRECT CONNECTION' : this.tr.via === 'CLOUD' ? 'CONNECTION: CLOUD (WORKS ON ANY NETWORK)' : `CONNECTION: ${this.tr.via}`, ANCHO / 2, 70, { tam: 7, align: 'center', color: this.tr.via === 'P2P' ? '#86efac' : '#7dd3fc' });
      texto(g, this.codigo, ANCHO / 2, 150, { tam: 36, align: 'center', base: 'middle', color: '#ffd23c', borde: 6, peso: 700 });
      texto(g, 'Friends join with this code (JOIN ROOM). Up to 4 players.', ANCHO / 2, 190, { tam: 8, align: 'center', color: '#fff' });
      texto(g, `PLAYERS ${this.jugadores}/4`, ANCHO / 2, 208, { tam: 9, align: 'center', color: '#ffd23c', borde: 2 });
      texto(g, this.msg + '.'.repeat(1 + Math.floor(this.t * 2) % 3), ANCHO / 2, 226, { tam: 8, align: 'center', color: '#7dd3fc' });
      if (this.tr?.rol === 'host') {
        const ok = this.jugadores >= 2;
        marco(g, 220, 236, 200, 26, ok ? 'oro' : 'apagado');
        texto(g, ok ? `START (${this.jugadores} PLAYERS)` : 'START (NEEDS 2+)', ANCHO / 2, 249, { tam: 10, align: 'center', base: 'middle', color: ok ? UI.textoOscuro : UI.apagado });
      }
      marco(g, 220, 270, 200, 26, 'azul');
      texto(g, 'CANCEL', ANCHO / 2, 283, { tam: 10, align: 'center', base: 'middle' });
      if (cuenta.conectado) { marco(g, 220, 302, 200, 24, 'azul'); texto(g, 'INVITE A FRIEND', ANCHO / 2, 314, { tam: 9, align: 'center', base: 'middle', color: '#ffd23c' }); }
      return;
    }
    this.lista.dibujar(g, this.t);
    if (this.msg) texto(g, this.msg, ANCHO / 2, 296, { tam: 8, align: 'center', color: this.error ? '#ff7a7a' : '#7dd3fc', borde: 2 });
    texto(g, this.menu === 'principal' ? (cuenta.conectado ? `Signed in as ${cuenta.nombre}: rooms work on any network, friends can invite you.` : 'Tip: sign in (PROFILE) so rooms work on any network and friends can invite you.') : 'No account needed. Only the phones are used.', ANCHO / 2, 318, { tam: 7, align: 'center', color: UI.apagado });
  }
}

centrada(Online);
