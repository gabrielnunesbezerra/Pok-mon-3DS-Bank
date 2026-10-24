// Perfil: entrar ou criar conta (a mesma do Poke Bank), escolher o ícone (liberado na Liga),
// ver amigos, aceitar pedidos de amizade, adicionar amigos e chamar um amigo para uma sala.
import { ANCHO, ALTO, UI } from '../config.js';
import { ROSTER } from '../data/pokemon.js';
import { fondoMenu, texto, marco, rect } from '../render/pixel.js';
import { sfx } from '../audio.js';
import { centrada } from './centrar.js';
import { pedirFormulario } from './formulario.js';
import { cuenta } from '../nube/firebase.js';
import { social } from '../nube/social.js';
import { icono, elegirIcono, iconoLiberado, desbloqueados, vitorias, LIGA } from '../liga/liga.js';

const B = (x, y, w, h, id, txt, estilo = 'azul') => ({ x, y, w, h, id, txt, estilo });
const dentro = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

export class Perfil {
  constructor(app) {
    this.app = app; this.t = 0; this.modo = 'perfil'; this.msg = ''; this.error = false; this.ocupado = false;
    this.quitar = [social.alCambiar(() => {}), cuenta.alCambiar(() => { this.msg = ''; })];
    if (cuenta.conectado) social.cargarAmigos().catch(() => {});
  }
  salir() { for (const q of this.quitar) q(); }
  entrar() { for (const p of ROSTER) this.app.bank.retrato(p.dex); }
  decir(msg, error = false) { this.msg = msg; this.error = error; }

  botones() {
    if (this.modo === 'iconos') return [B(220, 318, 200, 24, 'voltar', 'BACK')];
    if (!cuenta.conectado) return [B(190, 196, 260, 28, 'crear', 'CREATE ACCOUNT', 'oro'), B(190, 230, 260, 28, 'entrar', 'SIGN IN'), B(190, 300, 260, 24, 'menu', 'BACK')];
    const bs = [B(20, 250, 170, 24, 'iconos', 'CHANGE ICON'), B(20, 280, 170, 24, 'sair', 'SIGN OUT'), B(20, 318, 170, 24, 'menu', 'BACK'), B(436, 318, 184, 24, 'adicionar', 'ADD FRIEND', 'oro')];
    social.pedidos.slice(0, 2).forEach((p, i) => { bs.push(B(520, 64 + i * 30, 46, 22, `aceitar:${p.uid}`, 'YES', 'oro'), B(570, 64 + i * 30, 46, 22, `recusar:${p.uid}`, 'NO')); });
    const y0 = 70 + Math.min(2, social.pedidos.length) * 30 + 14;
    social.amigos.slice(0, 6).forEach((a, i) => bs.push(B(540, y0 + i * 32 + 3, 76, 22, `convidar:${a.uid}`, 'INVITE')));
    return bs;
  }

  async acao(id) {
    if (this.ocupado) return;
    const [nome, arg] = id.split(':');
    if (nome === 'menu') { sfx('atras'); return this.app.ir('titulo'); }
    if (nome === 'voltar') { sfx('atras'); this.modo = 'perfil'; return; }
    if (nome === 'iconos') { sfx('confirmar'); this.modo = 'iconos'; return; }
    if (nome === 'sair') { cuenta.salir(); sfx('atras'); return this.decir('SIGNED OUT'); }
    if (nome === 'convidar') { sfx('confirmar'); return this.app.ir('online', { convidar: arg }); }
    sfx('confirmar');
    this.ocupado = true;
    try {
      if (nome === 'crear' || nome === 'entrar') {
        const novo = nome === 'crear';
        const f = await pedirFormulario({
          titulo: novo ? 'Create account' : 'Sign in',
          nota: novo ? 'The same account works in the Poké Bank. Your League progress is saved in it.' : 'Use your PK confront or Poké Bank account (username or e-mail).',
          campos: [{ id: 'usuario', rotulo: novo ? 'Username (3 to 20 letters, numbers, . or _)' : 'Username or e-mail', max: 60, autocomplete: 'username' }, { id: 'senha', rotulo: 'Password (6+ characters)', tipo: 'password', autocomplete: novo ? 'new-password' : 'current-password' }],
          ok: novo ? 'CREATE' : 'SIGN IN',
        });
        if (f) { this.decir(novo ? 'CREATING ACCOUNT...' : 'SIGNING IN...'); novo ? await cuenta.crear(f.usuario, f.senha) : await cuenta.entrar(f.usuario, f.senha); this.decir(`WELCOME, ${cuenta.nombre.toUpperCase()}!`); social.cargarAmigos().catch(() => {}); }
      } else if (nome === 'adicionar') {
        const f = await pedirFormulario({ titulo: 'Add friend', campos: [{ id: 'nome', rotulo: "Your friend's username", max: 20 }], ok: 'SEND' });
        if (f) { const n = await social.pedirAmizade(f.nome); this.decir(`FRIEND REQUEST SENT TO ${n.toUpperCase()}`); }
      } else if (nome === 'aceitar') { await social.aceitar(arg); this.decir('NEW FRIEND!'); }
      else if (nome === 'recusar') { await social.recusar(arg); this.decir('REQUEST REMOVED'); }
    } catch (e) { this.decir(e.message, true); sfx('atras'); }
    this.ocupado = false;
  }

  cajaIcono(i) { const c = i % 10, f = Math.floor(i / 10); return { x: 40 + c * 57, y: 60 + f * 60, w: 52, h: 52 }; }
  tecla(c, nueva) { if (nueva && (c === 'Escape' || c === 'Backspace')) this.acao(this.modo === 'iconos' ? 'voltar' : 'menu'); }
  puntero(tipo, p) {
    if (tipo !== 'down') return;
    if (this.modo === 'iconos') ROSTER.forEach((q, i) => { if (dentro(p, this.cajaIcono(i))) { if (elegirIcono(q.id)) { sfx('confirmar'); this.decir(`ICON: ${q.nombre}`); this.modo = 'perfil'; } else { sfx('atras'); this.decir('WIN 2 TIMES IN THE LEAGUE TO UNLOCK THIS ICON', true); } } });
    for (const b of this.botones()) if (dentro(p, b)) return this.acao(b.id);
  }
  actualizar(dt) { this.t += dt; }

  retrato(g, id, x, y, tam, apagado = false) {
    const q = ROSTER.find(r => r.id === id), img = q && this.app.bank.retrato(q.dex);
    if (!img) return;
    g.globalAlpha = apagado ? 0.25 : 1;
    g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, x, y, tam, tam);
    g.globalAlpha = 1;
  }

  dibujar(g) {
    fondoMenu(g, ANCHO, ALTO);
    marco(g, 0, 0, ANCHO, 26, 'panel');
    texto(g, this.modo === 'iconos' ? 'PROFILE ICON' : 'PROFILE', ANCHO / 2, 13, { tam: 12, color: UI.amarillo, borde: 3, align: 'center', base: 'middle' });
    if (this.modo === 'iconos') {
      ROSTER.forEach((q, i) => {
        const b = this.cajaIcono(i), ok = iconoLiberado(q.id);
        marco(g, b.x, b.y, b.w, b.h, icono() === q.id ? 'oro' : ok ? 'azul' : 'apagado');
        this.retrato(g, q.id, b.x + 4, b.y + 4, 44, !ok);
        if (!ok) texto(g, `${vitorias(q.id)}/2`, b.x + b.w / 2, b.y + b.h - 8, { tam: 7, align: 'center', color: '#ffd23c', borde: 2 });
      });
      texto(g, 'Icons unlock with 2 League wins against that Pokémon. Starters are free.', ANCHO / 2, 300, { tam: 7, align: 'center', color: UI.suave });
    } else if (!cuenta.conectado) {
      marco(g, 150, 46, 340, 140, 'panel');
      this.retrato(g, icono(), 290, 58, 60);
      texto(g, 'GUEST', ANCHO / 2, 132, { tam: 12, align: 'center', color: '#fff', borde: 3 });
      texto(g, 'Sign in with your Poké Bank account, or create one.', ANCHO / 2, 152, { tam: 7, align: 'center', color: UI.suave });
      texto(g, 'Your League progress goes to the cloud, friends can find you', ANCHO / 2, 164, { tam: 7, align: 'center', color: UI.suave });
      texto(g, 'and invite you, and rooms work even on school Wi-Fi or a VPN.', ANCHO / 2, 176, { tam: 7, align: 'center', color: UI.suave });
    } else {
      // cartão do jogador
      marco(g, 14, 34, 182, 206, 'panel');
      marco(g, 63, 44, 84, 84, 'oro');
      this.retrato(g, icono(), 67, 48, 76);
      texto(g, cuenta.nombre.toUpperCase(), 105, 142, { tam: 11, align: 'center', color: '#fff', borde: 3, max: 170 });
      const total = LIGA.circuitos.flatMap(c => c.rivales), estrelas = total.reduce((n, id) => n + vitorias(id), 0);
      texto(g, `UNLOCKED ${desbloqueados().length}/${ROSTER.length}`, 105, 166, { tam: 8, align: 'center', color: '#7dd3fc' });
      texto(g, `LEAGUE STARS ${estrelas}/${total.length * 3}`, 105, 182, { tam: 8, align: 'center', color: '#ffd23c' });
      texto(g, 'Same account as the Poké Bank', 105, 214, { tam: 6, align: 'center', color: UI.apagado });
      // amigos e pedidos
      marco(g, 206, 34, 420, 278, 'panel');
      texto(g, 'FRIEND REQUESTS', 216, 48, { tam: 8, color: UI.suave });
      if (!social.pedidos.length) texto(g, 'none', 216, 64, { tam: 7, color: UI.apagado });
      social.pedidos.slice(0, 2).forEach((p, i) => { const y = 64 + i * 30; marco(g, 214, y, 300, 22, 'azul'); texto(g, `${p.nombre.toUpperCase()} wants to be your friend`, 222, y + 11, { tam: 7, base: 'middle', max: 290 }); });
      const y0 = 70 + Math.min(2, social.pedidos.length) * 30 + 14;
      texto(g, `FRIENDS (${social.amigos.length})`, 216, y0 - 6, { tam: 8, color: UI.suave });
      if (!social.amigos.length) texto(g, 'Add friends by their username. Same friends as the Poké Bank.', 216, y0 + 12, { tam: 7, color: UI.apagado });
      social.amigos.slice(0, 6).forEach((a, i) => {
        const y = y0 + i * 32;
        marco(g, 214, y, 406, 28, 'azul');
        if (a.icono) this.retrato(g, a.icono, 218, y + 2, 24);
        texto(g, a.nombre.toUpperCase(), 248, y + 14, { tam: 9, base: 'middle' });
        rect(g, 458, y + 10, 8, 8, a.online ? '#3ccf4e' : '#4a5160');
        texto(g, a.online ? 'ONLINE' : 'OFFLINE', 470, y + 14, { tam: 6, base: 'middle', color: a.online ? '#86efac' : UI.apagado });
      });
    }
    for (const b of this.botones()) { marco(g, b.x, b.y, b.w, b.h, b.estilo); texto(g, b.txt, b.x + b.w / 2, b.y + b.h / 2, { tam: b.h > 24 ? 10 : 8, align: 'center', base: 'middle', color: b.estilo === 'oro' ? UI.textoOscuro : '#fff' }); }
    if (this.msg) texto(g, this.msg, ANCHO / 2, this.modo === 'iconos' ? 312 : cuenta.conectado ? 300 : 280, { tam: 8, align: 'center', color: this.error ? '#ff7a7a' : '#86efac', borde: 2 });
  }
}

centrada(Perfil);
