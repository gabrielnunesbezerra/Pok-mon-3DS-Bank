// Social pela conta do Poke Bank: progresso da Liga salvo no perfil, presença (online), amigos,
// pedidos de amizade e convites para sala. Tudo nos caminhos que as regras do Poke Bank já permitem:
// profiles/<uid> (o próprio perfil), presence/<uid>, friends, friendRequests e arena/results/<evento>/<uid>
// (cada um escreve só o seu nó, todos os logados leem) para convites e salas.
import { cuenta, claveNombre, normalizarNombre } from './firebase.js';
import * as liga from '../liga/liga.js';

export const EVENTO_CONVITE = uid => `pkcinv_${uid}`;
const VALIDADE_CONVITE = 10 * 60 * 1000;

class Social {
  constructor() {
    this.amigos = []; this.pedidos = []; this.convites = []; this.vistos = new Set();
    this.fechar = []; this.timer = null; this.oyentes = new Set();
    this.ultimoErro = '';
  }
  alCambiar(fn) { this.oyentes.add(fn); return () => this.oyentes.delete(fn); }
  avisar() { for (const fn of this.oyentes) fn(this); }

  // liga/desliga junto com a conta
  iniciar() {
    cuenta.alCambiar(s => (s ? this.ligar() : this.desligar()));
    liga.alCambiar(() => this.salvarProgresso());
    if (cuenta.conectado) this.ligar();
  }
  async ligar() {
    this.desligar();
    try {
      const remoto = await cuenta.get(`profiles/${cuenta.uid}/pkc`);
      liga.fundir(remoto);
      await this.salvarProgresso(true);
    } catch (e) { this.ultimoErro = e.message; }
    const presenca = () => cuenta.put(`presence/${cuenta.uid}`, Date.now()).catch(() => {});
    presenca(); this.timer = setInterval(presenca, 60000);
    this.fechar.push(cuenta.escuchar(`arena/results/${EVENTO_CONVITE(cuenta.uid)}`, d => {
      const agora = Date.now();
      this.convites = Object.entries(d ?? {}).filter(([, v]) => v?.sala && agora - (v.t ?? 0) < VALIDADE_CONVITE && !this.vistos.has(`${v.sala}-${v.t}`)).map(([uid, v]) => ({ uid, nombre: v.username, sala: v.sala, t: v.t }));
      this.avisar();
    }));
    this.fechar.push(cuenta.escuchar(`friendRequests/${cuenta.uid}`, d => { this.pedidos = Object.entries(d ?? {}).map(([uid, v]) => ({ uid, nombre: v?.username ?? '?' })); this.avisar(); }));
    this.cargarAmigos();
  }
  desligar() { for (const f of this.fechar) f(); this.fechar = []; clearInterval(this.timer); this.amigos = []; this.pedidos = []; this.convites = []; this.avisar(); }

  async salvarProgresso(agora = false) {
    if (!cuenta.conectado) return;
    clearTimeout(this.salvarT);
    const enviar = () => { const p = liga.progreso(); return cuenta.patch(`profiles/${cuenta.uid}/pkc`, { vencidos: p.vencidos, icono: p.icono ?? null, t: Date.now() }).catch(e => { this.ultimoErro = e.message; }); };
    if (agora) return enviar();
    this.salvarT = setTimeout(enviar, 1500);
  }

  async cargarAmigos() {
    if (!cuenta.conectado) return [];
    const lista = await cuenta.get(`friends/${cuenta.uid}`).catch(() => null);
    const uids = Object.keys(lista ?? {});
    this.amigos = await Promise.all(uids.map(async uid => {
      const [perfil, visto] = await Promise.all([cuenta.get(`profiles/${uid}`).catch(() => null), cuenta.get(`presence/${uid}`).catch(() => 0)]);
      return { uid, nombre: perfil?.username ?? '?', icono: perfil?.pkc?.icono ?? null, online: Date.now() - (Number(visto) || 0) < 150000 };
    }));
    this.amigos.sort((a, b) => b.online - a.online || a.nombre.localeCompare(b.nombre));
    this.avisar();
    return this.amigos;
  }
  async pedirAmizade(nomeBruto) {
    const nome = normalizarNombre(nomeBruto);
    if (!nome) throw new Error('USERNAME NOT FOUND');
    if (nome === cuenta.nombre) throw new Error('THAT IS YOU');
    const uid = await cuenta.get(`usernames/${claveNombre(nome)}`);
    if (!uid) throw new Error('USERNAME NOT FOUND');
    await cuenta.put(`friendRequests/${uid}/${cuenta.uid}`, { username: cuenta.nombre, t: Date.now() });
    return nome;
  }
  async aceitar(uid) {
    await cuenta.put(`friends/${cuenta.uid}/${uid}`, true);
    await cuenta.put(`friends/${uid}/${cuenta.uid}`, true);
    await cuenta.del(`friendRequests/${cuenta.uid}/${uid}`);
    await this.cargarAmigos();
  }
  async recusar(uid) { await cuenta.del(`friendRequests/${cuenta.uid}/${uid}`); }
  async convidar(uid, sala) { await cuenta.put(`arena/results/${EVENTO_CONVITE(uid)}/${cuenta.uid}`, { username: cuenta.nombre, sala, t: Date.now() }); }
  descartarConvite(c) { this.vistos.add(`${c.sala}-${c.t}`); this.convites = this.convites.filter(x => x !== c); this.avisar(); }
}

export const social = new Social();
