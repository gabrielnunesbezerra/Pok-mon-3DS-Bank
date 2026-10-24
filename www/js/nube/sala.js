// Sala online pela conta do Poke Bank (até 4 jogadores). Cada jogador escreve só o próprio nó em
// arena/results/pkcroom_<CÓDIGO>/<uid> e todos leem a sala inteira em tempo real.
//  - Conexão direta: cada convidado abre um canal WebRTC com o anfitrião (a oferta e a resposta passam
//    pela sala). Servidores STUN e TURN (inclusive TURN por TCP/TLS na porta 443) ajudam a atravessar NAT.
//  - Reserva: se o canal direto não abre (VPN, rede de escola, 4G muito fechado), as mensagens passam
//    pelo próprio Firebase, que é HTTPS comum. Os dois caminhos podem valer ao mesmo tempo; mensagens
//    repetidas são descartadas pelo número de sequência de quem enviou.
// Entrega o mesmo objeto que os outros transportes: enviar(obj), alMensaje, alCerrar, alPar(n), rol, slot, codigo.
import { cuenta } from './firebase.js';

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MAX = 4;
const ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478', 'stun:global.stun.twilio.com:3478'] },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp', 'turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
];
const VIVO = 20000;           // sem sinal de vida por 20 s = saiu
const ESPERA_DIRETA = 9000;   // tempo para o canal direto abrir antes de usar a reserva
export const caminhoSala = codigo => `arena/results/pkcroom_${codigo}`;

function esperarGelo(pc, ms = 3500) {
  return new Promise(ok => {
    if (pc.iceGatheringState === 'complete') return ok();
    const fim = () => { pc.removeEventListener('icegatheringstatechange', ver); ok(); };
    const ver = () => { if (pc.iceGatheringState === 'complete') fim(); };
    pc.addEventListener('icegatheringstatechange', ver);
    setTimeout(fim, ms);
  });
}

export class TransporteFirebase {
  constructor(codigo, rol) {
    this.codigo = codigo; this.rol = rol; this.slot = rol === 'host' ? 0 : -1; this.n = 1;
    this.P = caminhoSala(codigo); this.yo = cuenta.uid;
    this.alMensaje = null; this.alCerrar = null; this._alPar = null; this.fin = false; this.pareado = rol === 'host';
    this.seq = 0; this.vistos = new Map(); this.fila = []; this.escritos = [];
    this.pares = new Map(); // uid -> { pc, dc, slot, desde }
    this.dc = null; this.pc = null; this.relay = false; this.iniciada = false; this.anfitriao = null;
  }
  get via() { return this.diretoTodos ? 'P2P' : 'CLOUD'; }
  get lento() { return !this.diretoTodos; }
  get diretoTodos() {
    if (this.rol !== 'host') return this.dc?.readyState === 'open' && !this.relay;
    const convidados = Object.keys(this.slots ?? {}).filter(u => u !== this.yo);
    return convidados.length > 0 && convidados.every(u => this.pares.get(u)?.dc?.readyState === 'open');
  }
  set alPar(fn) { this._alPar = fn; if (this.pareado && fn) fn(this.n); }
  get alPar() { return this._alPar; }

  // ---------------------------------------------------------------- criar e entrar
  static async crear() {
    if (!cuenta.conectado) throw new Error('SIGN IN FIRST');
    let codigo = '';
    for (let i = 0; i < 8; i++) {
      codigo = Array.from({ length: 4 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join('');
      const s = await cuenta.get(caminhoSala(codigo));
      if (!s || !Object.values(s).some(m => m?.host && Date.now() - (m.t ?? 0) < VIVO)) break;
    }
    const tr = new TransporteFirebase(codigo, 'host');
    await cuenta.put(`${tr.P}/${tr.yo}`, { username: cuenta.nombre, host: true, t: Date.now(), n: 1, slots: { [tr.yo]: 0 } });
    tr.comecar();
    return tr;
  }
  static async unir(codigoBruto) {
    if (!cuenta.conectado) throw new Error('SIGN IN FIRST');
    const codigo = String(codigoBruto).toUpperCase().trim();
    const s = await cuenta.get(caminhoSala(codigo));
    const host = Object.entries(s ?? {}).find(([, m]) => m?.host && Date.now() - (m.t ?? 0) < VIVO);
    if (!host) throw new Error('ROOM NOT FOUND');
    if (host[1].ir) throw new Error('FIGHT ALREADY STARTED');
    if ((host[1].n ?? 1) >= MAX) throw new Error('ROOM FULL');
    const tr = new TransporteFirebase(codigo, 'guest');
    tr.anfitriao = host[0];
    await cuenta.put(`${tr.P}/${tr.yo}`, { username: cuenta.nombre, t: Date.now() });
    tr.comecar();
    await new Promise((ok, falha) => {
      const fim = setTimeout(() => { tr.cerrar(); falha(new Error('THE HOST DID NOT ANSWER')); }, 15000);
      tr.aoEntrar = () => { clearTimeout(fim); ok(); };
    });
    tr.abrirDireto();
    return tr;
  }

  comecar() {
    this.parar = cuenta.escuchar(this.P, d => this.aoMudar(d ?? {}));
    this.pulso = setInterval(() => cuenta.patch(`${this.P}/${this.yo}`, { t: Date.now(), ...(this.rol === 'host' ? { relay: this.precisaRelay() } : {}) }).catch(() => {}), 5000);
    this.envio = setInterval(() => this.descarregar(), 50);
  }

  // ---------------------------------------------------------------- a sala mudou
  aoMudar(sala) {
    if (this.fin) return;
    const agora = Date.now();
    if (this.rol === 'host') {
      const meu = sala[this.yo] ?? {}, slots = { ...(meu.slots ?? {}) };
      let mudou = false;
      // convidados novos ganham um lugar; quem sumiu perde
      for (const [uid, m] of Object.entries(sala)) {
        if (uid === this.yo || !m || agora - (m.t ?? 0) > VIVO || slots[uid] != null) continue;
        if (this.iniciada || Object.keys(slots).length >= MAX) continue;
        const usados = new Set(Object.values(slots)); let k = 1; while (usados.has(k)) k++;
        slots[uid] = k; mudou = true;
      }
      for (const uid of Object.keys(slots)) {
        if (uid === this.yo) continue;
        const m = sala[uid];
        if (!m || agora - (m.t ?? 0) > VIVO) { const s = slots[uid]; delete slots[uid]; mudou = true; this.fecharPar(uid); const n = Object.keys(slots).length; this.n = n; this.alMensaje?.({ t: 'salio', slot: s, n }); }
      }
      if (mudou) { this.n = Object.keys(slots).length; cuenta.patch(`${this.P}/${this.yo}`, { slots, n: this.n }).catch(() => {}); this._alPar?.(this.n); }
      this.slots = slots;
      // ofertas dos convidados para a conexão direta
      for (const [uid, m] of Object.entries(sala)) if (uid !== this.yo && slots[uid] != null && m?.sdp?.[this.yo] && !this.pares.has(uid)) this.responder(uid, m.sdp[this.yo]);
    } else {
      const h = sala[this.anfitriao];
      if (!h) { if (this.slot >= 0) this.cerrar(true); return; }
      const s = h.slots?.[this.yo];
      if (s != null && this.slot < 0) { this.slot = s; this.pareado = true; this.aoEntrar?.(); }
      if (h.n && h.n !== this.n) { this.n = h.n; this._alPar?.(this.n); }
      this.relay = !!h.relay;
      if (h.sdp?.[this.yo] && this.pc && !this.pc.remoteDescription) this.pc.setRemoteDescription(h.sdp[this.yo]).catch(() => {});
    }
    // mensagens que chegaram pela nuvem
    for (const [uid, m] of Object.entries(sala)) {
      if (uid === this.yo || !m?.m) continue;
      for (const [k, txt] of Object.entries(m.m)) { const s = Number(k.slice(1)); this.receber(uid, s, txt); }
    }
  }

  receber(de, s, carga) {
    let v = this.vistos.get(de);
    if (!v) this.vistos.set(de, (v = new Set()));
    if (v.has(s)) return;
    v.add(s);
    if (v.size > 3000) { const ordem = [...v].sort((a, b) => a - b); for (const x of ordem.slice(0, 1000)) v.delete(x); }
    let m; try { m = typeof carga === 'string' ? JSON.parse(carga) : carga; } catch { return; }
    if (m?.t === 'adios') return;
    this.alMensaje?.(m);
  }

  // ---------------------------------------------------------------- enviar
  precisaRelay() { return this.rol === 'host' ? [...Object.keys(this.slots ?? {})].some(uid => uid !== this.yo && this.pares.get(uid)?.dc?.readyState !== 'open') : true; }
  enviar(obj) {
    if (this.fin) return;
    const s = ++this.seq, txt = JSON.stringify(obj), pacote = JSON.stringify({ de: this.yo, s, m: txt });
    if (obj.t === 'ir') { this.iniciada = true; if (this.rol === 'host') cuenta.patch(`${this.P}/${this.yo}`, { ir: true }).catch(() => {}); }
    let direto = false;
    if (this.rol === 'host') { const ps = [...this.pares.values()]; for (const p of ps) if (p.dc?.readyState === 'open') p.dc.send(pacote); direto = ps.length > 0 && ps.every(p => p.dc?.readyState === 'open') && Object.keys(this.slots ?? {}).length - 1 === ps.length; }
    else if (this.dc?.readyState === 'open') { this.dc.send(pacote); direto = !this.relay; }
    if (!direto) this.fila.push([s, txt]);
  }
  // grava as mensagens da fila de uma vez (a cada 50 ms) e apaga as antigas
  descarregar() {
    if (this.fin || this.gravando || !this.fila.length) return;
    const lote = this.fila.splice(0), patch = {};
    for (const [s, txt] of lote) { patch[`m/s${s}`] = txt; this.escritos.push(s); }
    while (this.escritos.length > 300) patch[`m/s${this.escritos.shift()}`] = null;
    this.gravando = true;
    cuenta.patch(`${this.P}/${this.yo}`, patch).catch(() => { this.fila.unshift(...lote); }).finally(() => { this.gravando = false; });
  }

  // ---------------------------------------------------------------- conexão direta (WebRTC)
  usarCanal(dc, uid) {
    dc.onmessage = e => {
      let p; try { p = JSON.parse(e.data); } catch { return; }
      // o anfitrião repassa o que chega de um convidado para os outros convidados
      if (this.rol === 'host') for (const [u, o] of this.pares) if (u !== uid && o.dc?.readyState === 'open') o.dc.send(e.data);
      this.receber(p.de, p.s, p.m);
    };
  }
  async abrirDireto() {
    if (typeof RTCPeerConnection === 'undefined') return;
    const pc = this.pc = new RTCPeerConnection({ iceServers: ICE });
    this.dc = pc.createDataChannel('pk', { ordered: true });
    this.usarCanal(this.dc, this.anfitriao);
    await pc.setLocalDescription(await pc.createOffer());
    await esperarGelo(pc);
    cuenta.patch(`${this.P}/${this.yo}`, { [`sdp/${this.anfitriao}`]: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } }).catch(() => {});
  }
  async responder(uid, oferta) {
    if (typeof RTCPeerConnection === 'undefined') return;
    const pc = new RTCPeerConnection({ iceServers: ICE }), par = { pc, dc: null, desde: Date.now() };
    this.pares.set(uid, par);
    pc.ondatachannel = e => { par.dc = e.channel; this.usarCanal(e.channel, uid); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { par.dc = null; } };
    try {
      await pc.setRemoteDescription(oferta);
      await pc.setLocalDescription(await pc.createAnswer());
      await esperarGelo(pc);
      cuenta.patch(`${this.P}/${this.yo}`, { [`sdp/${uid}`]: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } }).catch(() => {});
    } catch { /* fica pela nuvem */ }
  }
  fecharPar(uid) { const p = this.pares.get(uid); if (p) { try { p.pc.close(); } catch { /* nada */ } this.pares.delete(uid); } }

  cerrar(desdeFuera) {
    if (this.fin) return;
    this.fin = true;
    clearInterval(this.pulso); clearInterval(this.envio); this.parar?.();
    for (const uid of [...this.pares.keys()]) this.fecharPar(uid);
    try { this.pc?.close(); } catch { /* nada */ }
    cuenta.del(`${this.P}/${this.yo}`).catch(() => {});
    this.alCerrar?.(!!desdeFuera);
  }
}
