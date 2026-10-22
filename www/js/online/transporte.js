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
    pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) this.cerrar(true); };
  }
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
    pc.ondatachannel = e => tr.usar(e.channel);
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
    this.pares = []; this.pareado = false; this.n = 1; this.iniciada = false; this.dc = null;
  }
  set alPar(fn) { this._alPar = fn; if (this.pareado && fn) fn(this.n); }
  get alPar() { return this._alPar; }

  enviar(obj) {
    const txt = JSON.stringify(obj);
    if (this.rol === 'host') { if (obj.t === 'ir') this.iniciada = true; for (const p of this.pares) if (p.dc?.readyState === 'open' && p.listo) p.dc.send(txt); }
    else if (this.dc?.readyState === 'open') this.dc.send(txt);
  }
  cerrar(desdeFuera) {
    if (this.fin) return;
    this.fin = true;
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
    tr.senal = senal; tr.codigo = codigo; tr.pareado = true; tr.n = 1;
    const candidatos = tr.cand = new Map(); // candidatos que chegam antes da resposta estar pronta
    senal.alMsg = async m => {
      if (m.type === 'OFFER') tr.aceptar(m);
      else if (m.type === 'CANDIDATE') { const p = tr.pares.find(x => x.id === m.src); if (p?.pc.remoteDescription) p.pc.addIceCandidate(m.payload.candidate).catch(() => {}); else candidatos.set(m.src, [...(candidatos.get(m.src) ?? []), m.payload.candidate]); }
    };
    senal.alCierre = () => { /* a sala continua: o canal de sinalização só serve para novos amigos entrarem */ };
    return tr;
  }

  async aceptar(m) {
    const pc = new RTCPeerConnection({ iceServers: ICE_NUBE }), p = { id: m.src, pc, dc: null, listo: false, slot: 0, cid: m.payload.connectionId };
    this.pares.push(p);
    pc.onicecandidate = e => { if (e.candidate) this.senal.enviar({ type: 'CANDIDATE', dst: m.src, payload: { candidate: e.candidate.toJSON(), type: 'data', connectionId: p.cid } }); };
    pc.ondatachannel = e => {
      p.dc = e.channel;
      p.dc.onopen = () => this.entro(p);
      p.dc.onmessage = ev => { let x; try { x = JSON.parse(ev.data); } catch { return; } if (x.t === 'ir') return; for (const o of this.pares) if (o !== p && o.listo && o.dc?.readyState === 'open') o.dc.send(ev.data); this.alMensaje?.(x); };
      p.dc.onclose = () => this.salio(p);
    };
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) this.salio(p); };
    try {
      await pc.setRemoteDescription(m.payload.sdp);
      for (const c of this.cand.get(m.src) ?? []) pc.addIceCandidate(c).catch(() => {});
      this.cand.delete(m.src);
      await pc.setLocalDescription(await pc.createAnswer());
      this.senal.enviar({ type: 'ANSWER', dst: m.src, payload: { sdp: descJSON(pc.localDescription), type: 'data', connectionId: p.cid } });
    } catch { this.salio(p); }
  }
  entro(p) {
    const usados = new Set(this.pares.filter(x => x.listo).map(x => x.slot));
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
    if (!p.listo || this.fin) return;
    this.n = 1 + this.pares.filter(x => x.listo).length;
    const m = { t: 'salio', slot: p.slot, n: this.n };
    for (const o of this.pares) if (o.listo && o.dc?.readyState === 'open') o.dc.send(JSON.stringify(m));
    this.alMensaje?.(m);
  }

  // ---- convidado: entra pelo código de 4 letras
  static async unir(codigo) {
    codigo = String(codigo).toUpperCase().trim();
    const tr = new TransporteNube('guest');
    const senal = await abrirSenal(PREFIJO + 'g' + aleatorio(12));
    tr.senal = senal;
    const dst = PREFIJO + codigo, cid = 'dc_' + aleatorio(10);
    const pc = tr.pc = new RTCPeerConnection({ iceServers: ICE_NUBE });
    const dc = tr.dc = pc.createDataChannel('pk', { ordered: true });
    pc.onicecandidate = e => { if (e.candidate) senal.enviar({ type: 'CANDIDATE', dst, payload: { candidate: e.candidate.toJSON(), type: 'data', connectionId: cid } }); };
    return new Promise((ok, fallo) => {
      let resuelta = false; const previos = [];
      const terminar = (err) => { if (resuelta) return; resuelta = true; clearTimeout(limite); if (err) { senal.cerrar(); try { pc.close(); } catch { /* nada */ } fallo(new Error(err)); } else ok(tr); };
      const limite = setTimeout(() => terminar('ROOM NOT FOUND'), 12000);
      senal.alMsg = async m => {
        if (m.type === 'ANSWER') { try { await pc.setRemoteDescription(m.payload.sdp); for (const c of previos) pc.addIceCandidate(c).catch(() => {}); previos.length = 0; } catch { terminar('CONNECTION FAILED'); } }
        else if (m.type === 'CANDIDATE') { if (pc.remoteDescription) pc.addIceCandidate(m.payload.candidate).catch(() => {}); else previos.push(m.payload.candidate); }
        else if (m.type === 'EXPIRE') terminar('ROOM NOT FOUND');
      };
      dc.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'sala') { tr.slot = m.slot; tr.n = m.n; tr.pareado = true; senal.cerrar(); return terminar(); }
        if (m.t === 'error') return terminar(m.msg);
        if (m.t === 'par') { tr.n = m.n; tr.pareado = true; return tr._alPar?.(m.n); }
        if (m.t === 'adios') return tr.cerrar(true);
        tr.alMensaje?.(m);
      };
      dc.onclose = () => { if (!resuelta) terminar('ROOM NOT FOUND'); else tr.cerrar(true); };
      pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) { if (!resuelta) terminar('CONNECTION FAILED'); else tr.cerrar(true); } };
      pc.createOffer().then(async o => {
        await pc.setLocalDescription(o);
        senal.enviar({ type: 'OFFER', dst, payload: { sdp: descJSON(pc.localDescription), type: 'data', connectionId: cid, label: 'pk', reliable: true, serialization: 'json' } });
      }).catch(() => terminar('CONNECTION FAILED'));
    });
  }
}
