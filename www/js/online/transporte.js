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
