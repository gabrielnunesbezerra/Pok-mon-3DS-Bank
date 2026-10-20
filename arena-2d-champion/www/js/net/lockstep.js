// Modo online por "lockstep": os dois aparelhos rodam a mesma batalha (mesma semente) e trocam só
// os comandos de cada quadro. O comando local vale alguns quadros depois de apertado (o "atraso"),
// tempo para ele chegar ao outro lado. De tempos em tempos os dois comparam um resumo do estado;
// se divergirem, quem criou a sala manda o estado completo e o outro continua dali.
// Este arquivo não usa nada do navegador, então dá para testar no Node.
import { blankInput } from '../engine/battle.js';
import { makeRng } from '../engine/rng.js';

export const PROTOCOL = 'arena2d-online-1';
const HASH_EVERY = 90;
const KEEP = 300;
const EMPTY = [0, 0, -1, 0, 0, 0, 0, -1, 0];

// ---------------------------------------------------------------- comandos compactos
// [mx, my, golpe, mira x, mira y, mira?, esquiva|mega, troca, toques] em inteiros
export function packInput(inp) {
  const mv = inp.move;
  const aim = mv?.aim;
  return [
    Math.round((inp.mx || 0) * 127), Math.round((inp.my || 0) * 127),
    mv ? mv.slot : -1,
    aim ? Math.round(aim.x * 1000) : 0, aim ? Math.round(aim.y * 1000) : 0, aim ? 1 : 0,
    (inp.dodge ? 1 : 0) | (inp.mega ? 2 : 0),
    inp.switchTo ?? -1,
    Math.min(30, inp.mash || 0),
  ];
}

export function unpackInput(p, out = blankInput()) {
  out.mx = p[0] / 127;
  out.my = p[1] / 127;
  out.move = p[2] >= 0 && p[2] < 4 ? { slot: p[2], aim: p[5] ? { x: p[3] / 1000, y: p[4] / 1000 } : null } : null;
  out.dodge = !!(p[6] & 1);
  out.mega = !!(p[6] & 2);
  out.switchTo = p[7] >= 0 && p[7] < 6 ? p[7] : null;
  out.mash = Math.max(0, Math.min(30, p[8] | 0));
  return out;
}

const validPacked = p => Array.isArray(p) && p.length === EMPTY.length && p.every(Number.isInteger);

// ---------------------------------------------------------------- resumo do estado
export function stateHash(b) {
  let h = 2166136261;
  const add = v => {
    const s = typeof v === 'number' ? v.toFixed(3) : String(v);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= 124; h = Math.imul(h, 16777619);
  };
  add(b.time); add(b.rng.s); add(b.ents.length); add(b.over); add(b.winner);
  for (const s of b.sides) {
    add(s.megaGauge); add(s.active ? s.active.slot : -1);
    for (const m of s.mons) {
      add(m.hp); add(m.x ?? 0); add(m.y ?? 0); add(m.stamina); add(m.species); add(m.status); add(m.action?.type ?? '');
      for (const v of Object.values(m.boosts)) add(v);
    }
  }
  return h >>> 0;
}

// ---------------------------------------------------------------- estado completo (para ressincronizar)
// Grafo de objetos com referências: o mesmo objeto aparece uma vez só (ex.: um golpe que guarda o Pokémon).
export function snapshot(b) {
  const ids = new Map();
  const table = [];
  const enc = v => {
    if (typeof v === 'function' || v === undefined) return undefined;
    if (typeof v === 'number') return Number.isFinite(v) ? (Object.is(v, -0) ? { $n: '-0' } : v) : { $n: String(v) };
    if (v === null || typeof v !== 'object') return v;
    if (ids.has(v)) return { $r: ids.get(v) };
    const id = table.length;
    ids.set(v, id);
    table.push(null);
    let o;
    if (Array.isArray(v)) o = { $a: v.map(x => { const e = enc(x); return e === undefined ? null : e; }) };
    else {
      o = {};
      for (const k of Object.keys(v)) { const e = enc(v[k]); if (e !== undefined) o[k] = e; }
    }
    table[id] = o;
    return { $r: id };
  };
  const root = {};
  for (const k of Object.keys(b)) {
    if (k === 'events' || k === 'rng' || k === 'recordEvents') continue;
    root[k] = k === 'log' ? b.log.slice(-12) : b[k];
  }
  root.sides = b.sides.map(s => ({ ...s, cpu: null }));
  const top = enc(root);
  return { top, table, rng: b.rng.s };
}

export function restore(b, snap) {
  const built = new Array(snap.table.length);
  const dec = v => {
    if (v === null || typeof v !== 'object') return v;
    if ('$n' in v) return v.$n === '-0' ? -0 : Number(v.$n);
    if ('$r' in v) return build(v.$r);
    return v;
  };
  const build = id => {
    if (built[id]) return built[id];
    const src = snap.table[id];
    if ('$a' in src) {
      const arr = [];
      built[id] = arr;
      for (const x of src.$a) arr.push(dec(x));
      return arr;
    }
    const obj = {};
    built[id] = obj;
    for (const k of Object.keys(src)) obj[k] = dec(src[k]);
    return obj;
  };
  const state = dec(snap.top);
  for (const k of Object.keys(state)) b[k] = state[k];
  b.sides.forEach(s => { s.cpu = null; });
  b.rng = makeRng(0);
  b.rng.s = snap.rng >>> 0;
  b.events = [];
}

// ---------------------------------------------------------------- o laço de quadros
export class Lockstep {
  // game: número da partida na sala (mensagens atrasadas de uma partida anterior são ignoradas)
  constructor(battle, me, delay, send, game = 0) {
    this.b = battle;
    this.me = me;
    this.delay = delay;
    this.game = game;
    this.send = msg => send({ ...msg, g: game });
    this.frame = 0; // próximo quadro a simular
    this.next = delay; // próximo quadro que recebe o comando local
    this.buf = [new Map(), new Map()];
    for (let f = 0; f < delay; f++) for (const m of this.buf) m.set(f, EMPTY);
    this.local = blankInput();
    this.hashes = new Map();
    this.remoteHashes = new Map();
    this.desyncs = 0;
    this.syncs = 0;
    this.wantSync = false;
  }

  // agenda o comando local (poll preenche this.local com o que o jogador está fazendo agora)
  schedule(poll) {
    if (this.next > this.frame + this.delay) return;
    poll(this.local);
    const p = packInput(this.local);
    const l = this.local;
    l.move = null; l.dodge = false; l.mega = false; l.switchTo = null; l.mash = 0;
    this.buf[this.me].set(this.next, p);
    this.send({ t: 'in', f: this.next, d: p });
    this.next++;
  }

  ready() {
    return this.buf[0].has(this.frame) && this.buf[1].has(this.frame);
  }

  advance(dt) {
    for (let i = 0; i < 2; i++) unpackInput(this.buf[i].get(this.frame), this.b.sides[i].input);
    this.b.step(dt);
    this.frame++;
    for (const m of this.buf) m.delete(this.frame - KEEP);
    if (this.frame % HASH_EVERY === 0) {
      const h = stateHash(this.b);
      this.hashes.set(this.frame, h);
      this.send({ t: 'hash', f: this.frame, h });
      this.check(this.frame);
    }
    if (this.wantSync && this.me === 0) {
      this.wantSync = false;
      this.syncs++;
      this.send({ t: 'sync', f: this.frame, state: snapshot(this.b) });
    }
  }

  onMessage(msg) {
    if ((msg.g ?? 0) !== this.game) return;
    if (msg.t === 'in') {
      if (Number.isInteger(msg.f) && msg.f >= 0 && validPacked(msg.d)) this.buf[1 - this.me].set(msg.f, msg.d);
    } else if (msg.t === 'hash') {
      this.remoteHashes.set(msg.f, msg.h);
      this.check(msg.f);
    } else if (msg.t === 'sync' && this.me === 1) {
      restore(this.b, msg.state);
      this.frame = msg.f;
      this.hashes.clear();
      this.remoteHashes.clear();
      this.syncs++;
    }
  }

  check(f) {
    if (!this.hashes.has(f) || !this.remoteHashes.has(f)) return;
    const ok = this.hashes.get(f) === this.remoteHashes.get(f);
    this.hashes.delete(f);
    this.remoteHashes.delete(f);
    if (!ok) {
      this.desyncs++;
      if (this.me === 0) this.wantSync = true;
    }
  }
}
