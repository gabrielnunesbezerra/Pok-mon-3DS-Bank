// Salas online: um jogador cria a sala e recebe um código, o outro entra com o código.
// A conexão é direta entre os aparelhos (WebRTC) usando a biblioteca PeerJS e o servidor público
// dela só para os dois se encontrarem. Depois de conectados, quem criou a sala sorteia a semente,
// mede o atraso da rede e manda os dois começarem a mesma batalha (ver lockstep.js).
import { SPECIES, LEARNSETS, MOVES, ITEMS, BASE_SPECIES, MEGA_STONE_FOR, toId } from '../data/dex.js';
import { TRAINER_DATA } from '../data/sprites.js';
import { PROTOCOL, Lockstep } from './lockstep.js';

const PREFIX = 'arena2dchampion-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FRAME_MS = 1000 / 60;

export function makeCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

// O time que chega do outro aparelho passa por aqui antes de entrar na batalha
export function sanitizeTeam(team) {
  if (!Array.isArray(team)) return null;
  const out = [];
  for (const set of team.slice(0, 3)) {
    if (!set || !BASE_SPECIES.includes(set.species)) return null;
    const sp = SPECIES[set.species];
    const learn = LEARNSETS[set.species];
    const moves = [...new Set((Array.isArray(set.moves) ? set.moves : []).map(String))].filter(id => MOVES[id] && learn[id]).slice(0, 4);
    if (!moves.length) return null;
    const ability = sp.abilities.map(toId).includes(set.ability) ? set.ability : toId(sp.abilities[0]);
    const item = set.item && ITEMS[set.item] && (!ITEMS[set.item].mega || MEGA_STONE_FOR[set.species].includes(set.item)) ? set.item : null;
    out.push({ species: set.species, ability, item, gender: ['M', 'F'].includes(set.gender) ? set.gender : 'M', moves, hpType: typeof set.hpType === 'string' ? set.hpType : 'Fire' });
  }
  return out.length ? out : null;
}

const cleanTrainer = id => (TRAINER_DATA[id] ? id : 'red');

function loadPeerLib() {
  if (window.Peer) return Promise.resolve(window.Peer);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/peerjs.min.js';
    s.onload = () => (window.Peer ? resolve(window.Peer) : reject(new Error('PeerJS não carregou')));
    s.onerror = () => reject(new Error('PeerJS não carregou'));
    document.head.append(s);
  });
}

// servidor de encontro: o público do PeerJS, ou outro passado na URL (?peer=host:porta, para testes)
function peerOptions() {
  const q = new URLSearchParams(location.search).get('peer');
  const opts = { debug: 1 };
  if (q) {
    const [host, port] = q.split(':');
    Object.assign(opts, { host, port: Number(port) || 9000, path: '/', secure: location.protocol === 'https:' && host !== 'localhost' });
  }
  return opts;
}

const ERRORS = {
  'peer-unavailable': 'Sala não encontrada. Confira o código.',
  'unavailable-id': 'Esse código já está em uso.',
  network: 'Sem conexão com o servidor de salas.',
  'server-error': 'O servidor de salas não respondeu.',
  'socket-error': 'Sem conexão com o servidor de salas.',
  'socket-closed': 'A conexão com o servidor de salas caiu.',
  'browser-incompatible': 'Este aparelho não suporta conexão direta (WebRTC).',
  disconnected: 'Desconectado do servidor de salas.',
  webrtc: 'Não deu para conectar direto com o outro aparelho.',
};

export class OnlineSession {
  // cb: status(text), start(config), message(text), left(reason)
  constructor(cb) {
    this.cb = cb;
    this.peer = null;
    this.conn = null;
    this.host = false;
    this.code = null;
    this.mine = null; // { team, trainer }
    this.theirs = null;
    this.ping = null;
    this.lastMsgAt = 0;
    this.lockstep = null;
    this.rematch = [false, false];
    this.closed = false;
    this.pingTimer = null;
    // fechando a aba ou o app: avisa o outro lado na hora em vez de deixar ele esperando
    this.onHide = () => this.close();
    if (typeof window !== 'undefined') window.addEventListener('pagehide', this.onHide);
  }

  status(text) { this.cb.status?.(text); }

  async create(mine) {
    this.host = true;
    this.mine = mine;
    const Peer = await loadPeerLib();
    for (let attempt = 0; attempt < 4; attempt++) {
      this.code = makeCode();
      try {
        await this.openPeer(Peer, PREFIX + this.code);
        break;
      } catch (e) {
        if (e.type !== 'unavailable-id' || attempt === 3) throw e;
      }
    }
    this.peer.on('connection', conn => {
      if (this.conn) { conn.on('open', () => { conn.send({ t: 'reject', reason: 'A sala já está cheia.' }); setTimeout(() => conn.close(), 300); }); return; }
      this.attach(conn);
    });
    this.status('Sala criada. Passe o código para o outro jogador.');
    return this.code;
  }

  async join(code, mine) {
    this.host = false;
    this.mine = mine;
    this.code = cleanCode(code);
    const Peer = await loadPeerLib();
    await this.openPeer(Peer, null);
    this.status('Procurando a sala...');
    const conn = this.peer.connect(PREFIX + this.code, { reliable: true, serialization: 'json' });
    this.attach(conn);
    // se a sala não existir, o PeerJS avisa com "peer-unavailable"; se travar, desiste em 15 s
    setTimeout(() => { if (!this.closed && !this.connected) this.fail({ type: 'webrtc' }); }, 15000);
  }

  openPeer(Peer, id) {
    return new Promise((resolve, reject) => {
      const peer = id ? new Peer(id, peerOptions()) : new Peer(peerOptions());
      let opened = false;
      peer.on('open', () => { opened = true; this.peer = peer; resolve(); });
      peer.on('error', e => {
        if (!opened) { peer.destroy(); reject(e); return; }
        this.fail(e);
      });
      peer.on('disconnected', () => { if (!this.closed && !this.connected) this.fail({ type: 'disconnected' }); });
    });
  }

  attach(conn) {
    this.conn = conn;
    conn.on('open', () => {
      this.connected = true;
      this.lastMsgAt = performance.now();
      this.status('Conectado! Combinando a batalha...');
      this.send({ t: 'hello', v: PROTOCOL, team: this.mine.team, trainer: this.mine.trainer });
      this.pingTimer = setInterval(() => this.send({ t: 'ping', s: performance.now() }), 1000);
    });
    conn.on('data', msg => this.onData(msg));
    conn.on('close', () => this.peerLeft('A conexão com o outro jogador caiu.'));
    conn.on('error', () => this.peerLeft('A conexão com o outro jogador caiu.'));
  }

  send(msg) {
    if (this.conn?.open) {
      try { this.conn.send(msg); } catch { /* canal fechando */ }
    }
  }

  fail(e) {
    if (this.closed) return;
    this.cb.message?.(ERRORS[e?.type] || `Erro de conexão${e?.type ? ` (${e.type})` : ''}.`);
    this.close();
  }

  peerLeft(text) {
    if (this.closed) return;
    this.cb.left?.(text);
    this.close();
  }

  onData(msg) {
    if (!msg || typeof msg !== 'object') return;
    this.lastMsgAt = performance.now();
    switch (msg.t) {
      case 'in': case 'hash': case 'sync':
        this.lockstep?.onMessage(msg);
        break;
      case 'ping': this.send({ t: 'pong', s: msg.s }); break;
      case 'pong': {
        const rtt = performance.now() - msg.s;
        this.ping = this.ping === null ? rtt : this.ping * 0.7 + rtt * 0.3;
        break;
      }
      case 'hello': {
        if (msg.v !== PROTOCOL) { this.send({ t: 'reject', reason: 'Os dois aparelhos precisam estar com a mesma versão do jogo.' }); this.fail({ type: 'versão' }); return; }
        const team = sanitizeTeam(msg.team);
        if (!team) { this.send({ t: 'reject', reason: 'Time inválido.' }); return; }
        this.theirs = { team, trainer: cleanTrainer(msg.trainer) };
        if (this.host) this.prepareStart();
        break;
      }
      case 'start': if (!this.host) this.begin(msg); break;
      case 'rematch':
        this.rematch[1] = true;
        if (this.rematch[0] && this.host) this.prepareStart();
        else this.cb.rematchAsked?.();
        break;
      case 'reject': this.cb.message?.(msg.reason || 'O outro jogador recusou.'); this.close(); break;
      case 'bye': this.peerLeft('O outro jogador saiu da sala.'); break;
    }
  }

  // espera umas medidas de atraso antes de começar (até 1,5 s)
  prepareStart() {
    const t0 = performance.now();
    const go = () => {
      if (this.closed) return;
      if (this.ping === null && performance.now() - t0 < 1500) { this.send({ t: 'ping', s: performance.now() }); setTimeout(go, 150); return; }
      const rtt = this.ping ?? 120;
      const delay = Math.max(3, Math.min(12, Math.ceil(rtt / 2 / FRAME_MS) + 3));
      this.game = (this.game || 0) + 1;
      const cfg = {
        t: 'start',
        game: this.game,
        seed: Math.floor(Math.random() * 2 ** 31),
        delay,
        timeLimit: this.cb.timeLimit?.() ?? 240,
        teams: [this.mine.team, this.theirs.team],
        trainers: [cleanTrainer(this.mine.trainer), this.theirs.trainer],
      };
      this.send(cfg);
      this.begin(cfg);
    };
    go();
  }

  begin(cfg) {
    const teams = cfg.teams.map(sanitizeTeam);
    if (!teams[0] || !teams[1]) { this.fail({ type: 'time inválido' }); return; }
    this.rematch = [false, false];
    this.game = cfg.game | 0;
    this.cb.start?.({
      me: this.host ? 0 : 1,
      seed: cfg.seed >>> 0,
      delay: Math.max(2, Math.min(15, cfg.delay | 0)),
      timeLimit: Number(cfg.timeLimit) || 240,
      teams,
      trainers: cfg.trainers.map(cleanTrainer),
    });
  }

  startLockstep(battle, me, delay) {
    this.lockstep = new Lockstep(battle, me, delay, msg => this.send(msg), this.game);
    this.lastMsgAt = performance.now();
    return this.lockstep;
  }

  askRematch() {
    this.rematch[0] = true;
    this.send({ t: 'rematch' });
    if (this.rematch[1] && this.host) this.prepareStart();
  }

  silence() { return this.connected ? performance.now() - this.lastMsgAt : 0; }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.pingTimer);
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.onHide);
    this.send({ t: 'bye' });
    const peer = this.peer;
    setTimeout(() => { try { peer?.destroy(); } catch { /* já fechado */ } }, 200);
  }
}
