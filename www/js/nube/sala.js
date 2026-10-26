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
const VIVO = 20000;           // sem sinal de vida por 20 s = saiu (na luta, 60 s: dá tempo de voltar)
const VIVO_LUTA = 60000;
// canal rápido: sem ordem e sem reenvio (os comandos já vão repetidos em todo pacote)
const RAPIDO = { ordered: false, maxRetransmits: 0 };
const ESPERA_DIRETA = 9000;   // tempo para o canal direto abrir antes de usar a reserva
export const caminhoSala = codigo => `arena/results/pkcroom_${codigo}`;
// canal direto aberto e a conexão de pé (com o sinal oscilando, o canal ainda diz "open" mas nada passa: aí vai pela nuvem)
const ligado = (pc, dc) => dc?.readyState === 'open' && (pc?.connectionState ?? 'connected') === 'connected';

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
    this.seq = 0; this.vistos = new Map(); this.fila = []; this.escritos = []; this.rapidos = new Map(); this.v = 0;
    this.pares = new Map(); // uid -> { pc, dc, slot, desde }
    this.dc = null; this.dcr = null; this.pc = null; this.relay = false; this.iniciada = false; this.anfitriao = null;
  }
  get via() { return this.diretoTodos ? 'P2P' : 'CLOUD'; }
  get lento() { return !this.diretoTodos; }
  get diretoTodos() {
    if (this.rol !== 'host') return ligado(this.pc, this.dc) && !this.relay;
    const convidados = Object.keys(this.slots ?? {}).filter(u => u !== this.yo);
    return convidados.length > 0 && convidados.every(u => { const p = this.pares.get(u); return ligado(p?.pc, p?.dc); });
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
    this.pulso = setInterval(() => { cuenta.patch(`${this.P}/${this.yo}`, { t: Date.now(), ...(this.rol === 'host' ? { relay: this.precisaRelay() } : {}) }).catch(() => {}); this.vigiarDireto(); }, 5000);
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
        if (uid === this.yo || !m || agora - (m.t ?? 0) > (this.iniciada ? VIVO_LUTA : VIVO) || slots[uid] != null) continue;
        if (this.iniciada || Object.keys(slots).length >= MAX) continue;
        const usados = new Set(Object.values(slots)); let k = 1; while (usados.has(k)) k++;
        slots[uid] = k; mudou = true;
      }
      for (const uid of Object.keys(slots)) {
        if (uid === this.yo) continue;
        const m = sala[uid];
        if (!m || agora - (m.t ?? 0) > (this.iniciada ? VIVO_LUTA : VIVO)) { const s = slots[uid]; delete slots[uid]; mudou = true; this.fecharPar(uid); const n = Object.keys(slots).length; this.n = n; this.alMensaje?.({ t: 'salio', slot: s, n }); }
      }
      if (mudou) { this.n = Object.keys(slots).length; cuenta.patch(`${this.P}/${this.yo}`, { slots, n: this.n }).catch(() => {}); this._alPar?.(this.n); }
      this.slots = slots;
      // ofertas dos convidados para a conexão direta
      // uma oferta nova (versão diferente) quer dizer que o convidado está refazendo a conexão direta
      for (const [uid, m] of Object.entries(sala)) {
        const of = m?.sdp?.[this.yo];
        if (uid === this.yo || slots[uid] == null || !of) continue;
        const p = this.pares.get(uid);
        if (!p || p.v !== (of.v ?? 1)) { if (p) this.fecharPar(uid); this.responder(uid, of); }
      }
    } else {
      const h = sala[this.anfitriao];
      if (!h) { if (this.slot >= 0) this.cerrar(true); return; }
      const s = h.slots?.[this.yo];
      if (s != null && this.slot < 0) { this.slot = s; this.pareado = true; this.aoEntrar?.(); }
      if (h.n && h.n !== this.n) { this.n = h.n; this._alPar?.(this.n); }
      this.relay = !!h.relay;
      const r = h.sdp?.[this.yo];
      if (r && this.pc && !this.pc.remoteDescription && (r.v ?? 1) === this.v) this.pc.setRemoteDescription({ type: r.type, sdp: r.sdp }).catch(() => {});
    }
    // mensagens que chegaram pela nuvem
    for (const [uid, m] of Object.entries(sala)) {
      if (uid === this.yo || !m?.m) continue;
      for (const [k, txt] of Object.entries(m.m)) { const s = Number(k.slice(1)); this.receber(uid, s, txt); }
    }
  }

  receber(de, s, carga) {
    if (de === undefined || s === undefined) { let m; try { m = typeof carga === 'string' ? JSON.parse(carga) : carga; } catch { return; } if (m && m.t !== 'adios') this.alMensaje?.(m); return; }
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
  precisaRelay() { return this.rol === 'host' ? [...Object.keys(this.slots ?? {})].some(uid => { const p = this.pares.get(uid); return uid !== this.yo && !ligado(p?.pc, p?.dc); }) : true; }
  enviar(obj) {
    if (this.fin) return;
    const s = ++this.seq, txt = JSON.stringify(obj), pacote = JSON.stringify({ de: this.yo, s, m: txt });
    if (obj.t === 'ir') { this.iniciada = true; if (this.rol === 'host') cuenta.patch(`${this.P}/${this.yo}`, { ir: true }).catch(() => {}); }
    let direto = false;
    if (this.rol === 'host') { const ps = [...this.pares.values()]; for (const p of ps) if (p.dc?.readyState === 'open') p.dc.send(pacote); direto = ps.length > 0 && ps.every(p => ligado(p.pc, p.dc)) && Object.keys(this.slots ?? {}).length - 1 === ps.length; }
    else if (this.dc?.readyState === 'open') { this.dc.send(pacote); direto = ligado(this.pc, this.dc) && !this.relay; }
    if (!direto) this.fila.push([s, txt]);
  }
  // comandos e ping: pelo canal rápido; se algum amigo não tem conexão direta, vai pela nuvem só o mais novo de cada tipo
  // (o pacote de comandos mais novo já carrega os anteriores)
  enviarRapido(obj) {
    if (this.fin) return;
    const txt = JSON.stringify(obj);
    let todos;
    if (this.rol === 'host') {
      const conv = Object.keys(this.slots ?? {}).filter(u => u !== this.yo);
      todos = conv.length > 0;
      for (const u of conv) if (!this.mandarRapido(this.pares.get(u), txt)) todos = false;
    } else todos = this.mandarRapido(this, txt) && !this.relay;
    if (!todos) this.rapidos.set(obj.t, txt);
  }
  mandarRapido(p, txt) {
    if (ligado(p?.pc, p?.dcr)) { p.dcr.send(txt); return true; }
    if (ligado(p?.pc, p?.dc)) { p.dc.send(JSON.stringify({ m: txt })); return true; }
    return false;
  }
  // grava as mensagens da fila de uma vez (a cada 50 ms) e apaga as antigas
  descarregar() {
    if (this.fin || this.gravando || (!this.fila.length && !this.rapidos.size)) return;
    const lote = this.fila.splice(0), patch = {};
    for (const txt of this.rapidos.values()) lote.push([++this.seq, txt]);
    this.rapidos.clear();
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
  // canal rápido: o anfitrião repassa para os outros convidados pelo canal rápido deles
  usarRapido(dc, uid) {
    dc.onmessage = e => {
      if (this.rol === 'host') for (const [u, o] of this.pares) if (u !== uid) this.mandarRapido(o, e.data);
      this.receber(undefined, undefined, e.data);
    };
  }
  async abrirDireto() {
    if (typeof RTCPeerConnection === 'undefined' || this.fin) return;
    try { this.pc?.close(); } catch { /* nada */ }
    this.tentativa = Date.now(); this.caidoDesde = 0;
    const v = ++this.v, pc = this.pc = new RTCPeerConnection({ iceServers: ICE });
    this.dc = pc.createDataChannel('pk', { ordered: true });
    this.dcr = pc.createDataChannel('pkf', RAPIDO);
    this.usarCanal(this.dc, this.anfitriao); this.usarRapido(this.dcr, this.anfitriao);
    pc.onconnectionstatechange = () => { if (pc === this.pc && pc.connectionState === 'failed') { this.tentativa = 0; this.caidoDesde = Date.now() - 6000; this.vigiarDireto(); } };
    await pc.setLocalDescription(await pc.createOffer());
    await esperarGelo(pc);
    if (pc !== this.pc || this.fin) return;
    cuenta.patch(`${this.P}/${this.yo}`, { [`sdp/${this.anfitriao}`]: { type: pc.localDescription.type, sdp: pc.localDescription.sdp, v } }).catch(() => {});
  }
  // convidado: se a conexão direta caiu e não voltou sozinha em alguns segundos, refaz (enquanto isso vai pela nuvem)
  vigiarDireto() {
    if (this.rol !== 'guest' || this.fin || this.slot < 0 || typeof RTCPeerConnection === 'undefined') return;
    if (ligado(this.pc, this.dc)) { this.caidoDesde = 0; return; }
    if (!this.caidoDesde) this.caidoDesde = Date.now();
    if (Date.now() - this.caidoDesde > 6000 && Date.now() - (this.tentativa ?? 0) > 10000) this.abrirDireto();
  }
  async responder(uid, oferta) {
    if (typeof RTCPeerConnection === 'undefined') return;
    const pc = new RTCPeerConnection({ iceServers: ICE }), par = { pc, dc: null, dcr: null, desde: Date.now(), v: oferta.v ?? 1 };
    this.pares.set(uid, par);
    pc.ondatachannel = e => { if (e.channel.label === 'pkf') { par.dcr = e.channel; this.usarRapido(e.channel, uid); } else { par.dc = e.channel; this.usarCanal(e.channel, uid); } };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { par.dc = null; } };
    try {
      await pc.setRemoteDescription({ type: oferta.type, sdp: oferta.sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await esperarGelo(pc);
      if (this.pares.get(uid) !== par || this.fin) return;
      cuenta.patch(`${this.P}/${this.yo}`, { [`sdp/${uid}`]: { type: pc.localDescription.type, sdp: pc.localDescription.sdp, v: par.v } }).catch(() => {});
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
