// Dois jeitos de ligar dois jogadores. Os dois entregam o mesmo objeto: enviar(obj), alMensaje(obj), alCerrar().
//  - Sala por código: os dois entram no servidor de salas (npm run serve) e ele repassa as mensagens.
//  - P2P sem servidor: troca de dois códigos (oferta e resposta) e conexão direta WebRTC entre os celulares.

export class TransporteWS {
  constructor(ws) {
    this.ws = ws; this.via = 'SERVER'; this.alMensaje = null; this.alCerrar = null; this.alPar = null; this.codigo = ''; this.rol = '';
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'par') { this.pareado = true; this.n = m.n ?? 2; return this._alPar?.(this.n); }
      if (m.t === 'adios') return this.cerrar(true);
      this.alMensaje?.(m);
    };
    ws.onclose = () => this.cerrar(true);
    ws.onerror = () => {};
  }
  set alPar(fn) { this._alPar = fn; if (this.pareado && fn) fn(this.n); }
  get alPar() { return this._alPar; }
  enviar(obj) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); }
  cerrar(desdeFuera) {
    if (this.fin) return;
    this.fin = true;
    try { this.ws.close(); } catch { /* já fechado */ }
    this.alCerrar?.(desdeFuera);
  }

  // accion: { crear: true } ou { unir: 'ABCD' }. Resolve quando o servidor responde com a sala.
  static conectar(url, accion) {
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(url); } catch { return reject(new Error('BAD SERVER ADDRESS')); }
      const limite = setTimeout(() => { try { ws.close(); } catch { /* nada */ } reject(new Error('SERVER NOT REACHABLE')); }, 8000);
      const tr = new TransporteWS(ws);
      ws.onopen = () => ws.send(JSON.stringify(accion.crear ? { t: 'crear' } : { t: 'unir', codigo: accion.unir }));
      const recibir = ws.onmessage;
      ws.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'sala') { clearTimeout(limite); tr.codigo = m.codigo; tr.rol = m.rol; tr.slot = m.slot ?? 0; ws.onmessage = recibir; resolve(tr); }
        else if (m.t === 'error') { clearTimeout(limite); reject(new Error(m.msg)); }
        else recibir(e);
      };
      ws.onclose = () => { clearTimeout(limite); reject(new Error('SERVER NOT REACHABLE')); };
    });
  }
}

// ---------------------------------------------------------------- P2P (WebRTC) com códigos copiados à mão
// canal rápido: sem ordem e sem reenvio (os comandos já vão repetidos em todo pacote)
export const RAPIDO = { ordered: false, maxRetransmits: 0 };
const SERVIDORES_ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] }];

const aB64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function empacotar(desc) {
  const txt = JSON.stringify({ t: desc.type, s: desc.sdp });
  const bytes = new TextEncoder().encode(txt);
  if (typeof CompressionStream !== 'undefined') {
    const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return 'c' + aB64(new Uint8Array(await new Response(cs).arrayBuffer()));
  }
  return 'p' + aB64(bytes);
}
async function desempacotar(codigo) {
  codigo = codigo.trim().replace(/\s+/g, '');
  let bytes = deB64(codigo.slice(1));
  if (codigo[0] === 'c') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  const o = JSON.parse(new TextDecoder().decode(bytes));
  return { type: o.t, sdp: o.s };
}
function esperarGelo(pc) {
  return new Promise(ok => {
    if (pc.iceGatheringState === 'complete') return ok();
    const fin = () => { pc.removeEventListener('icegatheringstatechange', cambio); ok(); };
    const cambio = () => { if (pc.iceGatheringState === 'complete') fin(); };
    pc.addEventListener('icegatheringstatechange', cambio);
    setTimeout(fin, 5000);
  });
}

export class TransporteP2P {
  constructor(pc) {
    this.pc = pc; this.dc = null; this.via = 'P2P'; this.alMensaje = null; this.alCerrar = null; this.alPar = null; this.fin = false;
    this.abierto = new Promise(ok => { this._ok = ok; });
    // "disconnected" costuma voltar sozinho no celular; só desiste se falhar de vez ou ficar caído 20 s
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'failed' || st === 'closed') return this.cerrar(true);
      clearTimeout(this.caido);
      if (st === 'disconnected') this.caido = setTimeout(() => { if (pc.connectionState !== 'connected') this.cerrar(true); }, 20000);
    };
  }
  usarRapido(dc) { this.dcr = dc; dc.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } this.alMensaje?.(m); }; }
  enviarRapido(obj) { if (this.dcr?.readyState === 'open') this.dcr.send(JSON.stringify(obj)); else this.enviar(obj); }
  usar(dc) {
    this.dc = dc;
    dc.onopen = () => { this.pareado = true; this.n = 2; this._ok(); this._alPar?.(2); };
    dc.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } this.alMensaje?.(m); };
    dc.onclose = () => this.cerrar(true);
  }
  set alPar(fn) { this._alPar = fn; if (this.pareado && fn) fn(this.n); }
  get alPar() { return this._alPar; }
  enviar(obj) { if (this.dc?.readyState === 'open') this.dc.send(JSON.stringify(obj)); }
  cerrar(desdeFuera) {
    if (this.fin) return;
    this.fin = true;
    try { this.pc.close(); } catch { /* nada */ }
    this.alCerrar?.(desdeFuera);
  }

  static soportado() { return typeof RTCPeerConnection !== 'undefined'; }

  // quem cria a sala: devolve o código de oferta e uma função para colar a resposta do amigo
  static async anfitrion() {
    const pc = new RTCPeerConnection({ iceServers: SERVIDORES_ICE }), tr = new TransporteP2P(pc);
    tr.rol = 'host'; tr.slot = 0;
    tr.usar(pc.createDataChannel('pk', { ordered: true }));
    tr.usarRapido(pc.createDataChannel('pkf', RAPIDO));
    await pc.setLocalDescription(await pc.createOffer());
    await esperarGelo(pc);
    tr.codigo = await empacotar(pc.localDescription);
    tr.responder = async codigo => { await pc.setRemoteDescription(await desempacotar(codigo)); };
    return tr;
  }

  // quem entra: recebe o código do anfitrião e devolve o seu código de resposta
  static async invitado(codigoOferta) {
    const pc = new RTCPeerConnection({ iceServers: SERVIDORES_ICE }), tr = new TransporteP2P(pc);
    tr.rol = 'guest'; tr.slot = 1;
    pc.ondatachannel = e => (e.channel.label === 'pkf' ? tr.usarRapido(e.channel) : tr.usar(e.channel));
    await pc.setRemoteDescription(await desempacotar(codigoOferta));
    await pc.setLocalDescription(await pc.createAnswer());
    await esperarGelo(pc);
    tr.codigo = await empacotar(pc.localDescription);
    return tr;
  }
}

// ---------------------------------------------------------------- sala por código sem servidor seu (até 4 jogadores)
// O código da sala é o nome do anfitrião no serviço público de sinalização do PeerJS, que só ajuda a trocar a
// oferta e a resposta do WebRTC. Depois disso os celulares conversam direto, com o anfitrião no centro repassando
// os comandos (o mesmo papel do servidor de salas). Se o serviço público estiver fora do ar, use o servidor próprio.
const SENAL = 'wss://0.peerjs.com/peerjs?key=peerjs';
const PREFIJO = 'pkcf-';
const LETRAS_SALA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const ICE_NUBE = [...SERVIDORES_ICE, { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' }];
const aleatorio = n => Array.from({ length: n }, () => Math.random().toString(36)[2]).join('');

function abrirSenal(id, url = globalThis.PK_SENAL ?? SENAL) {
  return new Promise((ok, fallo) => {
    let ws;
    try { ws = new WebSocket(`${url}&id=${id}&token=${aleatorio(10)}`); } catch { return fallo(new Error('CLOUD NOT REACHABLE')); }
    const s = { ws, alMsg: null, hb: null, enviar: o => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); }, cerrar: () => { clearInterval(s.hb); try { ws.close(); } catch { /* nada */ } } };
    const limite = setTimeout(() => { s.cerrar(); fallo(new Error('CLOUD NOT REACHABLE')); }, 9000);
    let abierto = false;
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === 'OPEN') { abierto = true; clearTimeout(limite); s.hb = setInterval(() => s.enviar({ type: 'HEARTBEAT' }), 5000); ok(s); }
      else if (m.type === 'ID-TAKEN') { clearTimeout(limite); s.cerrar(); fallo(new Error('ID-TAKEN')); }
      else s.alMsg?.(m);
    };
    ws.onclose = () => { clearTimeout(limite); if (!abierto) fallo(new Error('CLOUD NOT REACHABLE')); else s.alCierre?.(); };
    ws.onerror = () => {};
  });
}

const descJSON = d => ({ type: d.type, sdp: d.sdp });

export class TransporteNube {
  constructor(rol) {
    this.via = 'ROOM'; this.rol = rol; this.slot = 0; this.codigo = ''; this.alMensaje = null; this.alCerrar = null; this.fin = false;
    this.pares = []; this.pareado = false; this.n = 1; this.iniciada = false; this.dc = null; this.dcr = null; this.ausentes = new Map();
  }
  set alPar(fn) { this._alPar = fn; if (this.pareado && fn) fn(this.n); }
  get alPar() { return this._alPar; }

  enviar(obj) {
    const txt = JSON.stringify(obj);
    if (this.rol === 'host') { if (obj.t === 'ir') this.iniciada = true; for (const p of this.pares) if (p.dc?.readyState === 'open' && p.listo) p.dc.send(txt); }
    else if (this.dc?.readyState === 'open') this.dc.send(txt);
  }
  enviarRapido(obj) {
    const txt = JSON.stringify(obj);
    if (this.rol === 'host') { for (const p of this.pares) if (p.listo) this.mandarRapido(p, txt); }
    else if (this.dcr?.readyState === 'open') this.dcr.send(txt);
    else if (this.dc?.readyState === 'open') this.dc.send(txt);
  }
  mandarRapido(p, txt) { if (p.dcr?.readyState === 'open') p.dcr.send(txt); else if (p.dc?.readyState === 'open') p.dc.send(txt); }
  cerrar(desdeFuera) {
    if (this.fin) return;
    this.fin = true;
    for (const t of this.ausentes.values()) clearTimeout(t);
    if (this.rol === 'host') for (const p of this.pares) { try { p.dc?.send(JSON.stringify({ t: 'adios' })); } catch { /* nada */ } try { p.pc.close(); } catch { /* nada */ } }
    else try { this.pc?.close(); } catch { /* nada */ }
    this.senal?.cerrar();
    this.alCerrar?.(!!desdeFuera);
  }

  // ---- anfitrião: abre a sala e aceita até 3 amigos
  static async crear() {
    let senal = null, codigo = '';
    for (let i = 0; i < 6 && !senal; i++) {
      codigo = Array.from({ length: 4 }, () => LETRAS_SALA[Math.floor(Math.random() * LETRAS_SALA.length)]).join('');
      try { senal = await abrirSenal(PREFIJO + codigo); } catch (e) { if (e.message !== 'ID-TAKEN') throw e; }
    }
    if (!senal) throw new Error('TRY AGAIN');
    const tr = new TransporteNube('host');
    tr.codigo = codigo; tr.pareado = true; tr.n = 1; tr.cand = new Map(); // candidatos que chegam antes da resposta estar pronta
    tr.ligarSenal(senal);
    return tr;
  }
  ligarSenal(senal) {
    this.senal = senal;
    senal.alMsg = async m => {
      if (m.type === 'OFFER') this.aceptar(m);
      else if (m.type === 'CANDIDATE') { const p = this.pares.find(x => x.id === m.src); if (p?.pc.remoteDescription) p.pc.addIceCandidate(m.payload.candidate).catch(() => {}); else this.cand.set(m.src, [...(this.cand.get(m.src) ?? []), m.payload.candidate]); }
    };
    // a sinalização só serve para alguém entrar ou voltar; se cair (troca de rede), abre de novo com o mesmo código
    senal.alCierre = () => this.reabrirSenal();
  }
  async reabrirSenal() {
    while (!this.fin) {
      await new Promise(ok => setTimeout(ok, 3000));
      if (this.fin) return;
      try { const s2 = await abrirSenal(PREFIJO + this.codigo); if (this.fin) return s2.cerrar(); return this.ligarSenal(s2); } catch { /* tenta de novo */ }
    }
  }

  async aceptar(m) {
    const pc = new RTCPeerConnection({ iceServers: ICE_NUBE }), p = { id: m.src, pc, dc: null, dcr: null, listo: false, slot: 0, cid: m.payload.connectionId, volver: m.payload.volver };
    this.pares.push(p);
    pc.onicecandidate = e => { if (e.candidate) this.senal?.enviar({ type: 'CANDIDATE', dst: m.src, payload: { candidate: e.candidate.toJSON(), type: 'data', connectionId: p.cid } }); };
    pc.ondatachannel = e => {
      const ch = e.channel, rapido = ch.label === 'pkf';
      if (rapido) p.dcr = ch; else { p.dc = ch; ch.onopen = () => this.entro(p); ch.onclose = () => this.salio(p); }
      ch.onmessage = ev => {
        let x; try { x = JSON.parse(ev.data); } catch { return; }
        if (x.t === 'ir') return;
        for (const o of this.pares) if (o !== p && o.listo) { if (rapido) this.mandarRapido(o, ev.data); else if (o.dc?.readyState === 'open') o.dc.send(ev.data); }
        this.alMensaje?.(x);
      };
    };
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) this.salio(p); };
    try {
      await pc.setRemoteDescription(m.payload.sdp);
      for (const c of this.cand.get(m.src) ?? []) pc.addIceCandidate(c).catch(() => {});
      this.cand.delete(m.src);
      await pc.setLocalDescription(await pc.createAnswer());
      this.senal?.enviar({ type: 'ANSWER', dst: m.src, payload: { sdp: descJSON(pc.localDescription), type: 'data', connectionId: p.cid } });
    } catch { this.salio(p); }
  }
  entro(p) {
    // quem caiu no meio da luta volta para o mesmo lugar (se o anfitrião ainda não tinha notado a queda, a conexão velha sai)
    if (p.volver != null && this.iniciada && !this.ausentes.has(p.volver)) {
      const velho = this.pares.find(x => x !== p && x.listo && x.slot === p.volver);
      if (velho) { this.pares = this.pares.filter(x => x !== velho); try { velho.pc.close(); } catch { /* nada */ } this.ausentes.set(p.volver, 0); }
    }
    if (p.volver != null && this.ausentes.has(p.volver)) {
      clearTimeout(this.ausentes.get(p.volver)); this.ausentes.delete(p.volver);
      p.slot = p.volver; p.listo = true;
      p.dc.send(JSON.stringify({ t: 'sala', slot: p.slot, n: this.n }));
      return;
    }
    const usados = new Set([...this.pares.filter(x => x.listo).map(x => x.slot), ...this.ausentes.keys()]);
    let slot = 1; while (usados.has(slot)) slot++;
    if (this.iniciada || slot > 3) { p.dc.send(JSON.stringify({ t: 'error', msg: this.iniciada ? 'FIGHT ALREADY STARTED' : 'ROOM FULL' })); setTimeout(() => { try { p.pc.close(); } catch { /* nada */ } }, 400); this.pares = this.pares.filter(x => x !== p); return; }
    p.slot = slot; p.listo = true;
    this.n = 1 + this.pares.filter(x => x.listo).length;
    p.dc.send(JSON.stringify({ t: 'sala', slot, n: this.n }));
    for (const o of this.pares) if (o.listo) o.dc.send(JSON.stringify({ t: 'par', n: this.n }));
    this._alPar?.(this.n);
  }
  salio(p) {
    if (!this.pares.includes(p)) return;
    this.pares = this.pares.filter(x => x !== p);
    try { p.pc.close(); } catch { /* nada */ }
    if (!p.listo || this.fin) return;
    const avisar = () => {
      this.ausentes.delete(p.slot);
      this.n = 1 + this.pares.filter(x => x.listo).length;
      const m = { t: 'salio', slot: p.slot, n: this.n };
      for (const o of this.pares) if (o.listo && o.dc?.readyState === 'open') o.dc.send(JSON.stringify(m));
      this.alMensaje?.(m);
    };
    // durante a luta o lugar fica guardado 40 s esperando a pessoa voltar
    if (this.iniciada) this.ausentes.set(p.slot, setTimeout(avisar, 40000)); else avisar();
  }

  // ---- convidado: entra pelo código de 4 letras
  static async unir(codigo) {
    const tr = new TransporteNube('guest');
    tr.codigo = String(codigo).toUpperCase().trim();
    await tr.conectar();
    return tr;
  }
  async conectar(volver) {
    const senal = await abrirSenal(PREFIJO + 'g' + aleatorio(12));
    const dst = PREFIJO + this.codigo, cid = 'dc_' + aleatorio(10);
    try { this.pc?.close(); } catch { /* nada */ }
    const pc = this.pc = new RTCPeerConnection({ iceServers: ICE_NUBE });
    const dc = this.dc = pc.createDataChannel('pk', { ordered: true });
    const dcr = this.dcr = pc.createDataChannel('pkf', RAPIDO);
    pc.onicecandidate = e => { if (e.candidate) senal.enviar({ type: 'CANDIDATE', dst, payload: { candidate: e.candidate.toJSON(), type: 'data', connectionId: cid } }); };
    const repassar = e => { let m; try { m = JSON.parse(e.data); } catch { return; } this.alMensaje?.(m); };
    dcr.onmessage = repassar;
    return new Promise((ok, fallo) => {
      let resuelta = false; const previos = [];
      const terminar = (err) => { if (resuelta) return; resuelta = true; clearTimeout(limite); senal.cerrar(); if (err) { try { pc.close(); } catch { /* nada */ } fallo(new Error(err)); } else ok(this); };
      const limite = setTimeout(() => terminar('ROOM NOT FOUND'), 12000);
      // caiu depois de entrar: tenta voltar para a mesma sala sozinho
      const caiu = () => { if (resuelta && this.pc === pc && !this.fin) this.reconectar(); };
      senal.alMsg = async m => {
        if (m.type === 'ANSWER') { try { await pc.setRemoteDescription(m.payload.sdp); for (const c of previos) pc.addIceCandidate(c).catch(() => {}); previos.length = 0; } catch { terminar('CONNECTION FAILED'); } }
        else if (m.type === 'CANDIDATE') { if (pc.remoteDescription) pc.addIceCandidate(m.payload.candidate).catch(() => {}); else previos.push(m.payload.candidate); }
        else if (m.type === 'EXPIRE') terminar('ROOM NOT FOUND');
      };
      dc.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'sala') { this.slot = m.slot; this.n = m.n; this.pareado = true; return terminar(); }
        if (m.t === 'error') return terminar(m.msg);
        if (m.t === 'par') { this.n = m.n; this.pareado = true; return this._alPar?.(m.n); }
        if (m.t === 'adios') return this.cerrar(true);
        this.alMensaje?.(m);
      };
      dc.onclose = () => { if (!resuelta) terminar('ROOM NOT FOUND'); else caiu(); };
      pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) { if (!resuelta) terminar('CONNECTION FAILED'); else caiu(); } };
      pc.createOffer().then(async o => {
        await pc.setLocalDescription(o);
        senal.enviar({ type: 'OFFER', dst, payload: { sdp: descJSON(pc.localDescription), type: 'data', connectionId: cid, label: 'pk', reliable: true, serialization: 'json', volver } });
      }).catch(() => terminar('CONNECTION FAILED'));
    });
  }
  async reconectar() {
    if (this.fin || this.voltando) return;
    this.voltando = true;
    const ate = Date.now() + 40000;
    while (!this.fin && Date.now() < ate) {
      try { await this.conectar(this.slot); this.voltando = false; return; } catch { await new Promise(ok => setTimeout(ok, 2000)); }
    }
    this.voltando = false;
    this.cerrar(true);
  }
}
