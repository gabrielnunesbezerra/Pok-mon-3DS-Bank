// Sessão online em "lockstep": os dois aparelhos rodam o mesmo motor (mesma semente) e só trocam os comandos
// de cada passo. Cada comando vale daqui a D passos, então a tela local responde na hora e a rede tem folga.
// A cada segundo os dois comparam um resumo do estado; se divergirem, a partida avisa em vez de seguir errada.
const D0 = 6;               // atraso mínimo em passos (100 ms a 60 passos por segundo)
const NEUTRO = [0, 0, 0, 0, 0];

// comando -> [mx*100, my*100, ax, ay, botões]; os dois lados usam exatamente a versão arredondada
export function cuantizar(it) {
  const b = (it.lmb ? 1 : 0) | (it.rmb ? 2 : 0) | (it.esp ? 4 : 0) | (it.q ? 8 : 0) | (it.e ? 16 : 0) | (it.mega ? 32 : 0);
  return [Math.round((it.mx || 0) * 100), Math.round((it.my || 0) * 100), Math.round(it.ax || 0), Math.round(it.ay || 0), b];
}
export function decodificar(v) {
  const b = v[4];
  return { mx: v[0] / 100, my: v[1] / 100, ax: v[2], ay: v[3], lmb: !!(b & 1), rmb: !!(b & 2), esp: !!(b & 4), q: !!(b & 8), e: !!(b & 16), mega: !!(b & 32) };
}
export function resumen(luta) {
  let h = 5381;
  const txt = luta.luchadores.map(l => [l.x, l.y, l.hp, l.energia, l.ulti, l.exp].map(v => Math.round(v * 100)).join(',')).join('|') + Math.round(luta.t * 1000);
  for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0;
  return h;
}

export class Sesion {
  constructor(tr, lado, n = 2) {
    this.tr = tr; this.lado = lado; this.n = n; this.nj = n; this.alOtro = null; this.alCerrar = null; this.cerrada = false;
    this.rtt = null; this.pico = 0; this.D = D0; this.perdida = false;
    this.listos = new Map();
    this.reiniciar(0);
    tr.alMensaje = m => this.recibir(m);
    tr.alCerrar = () => { this.cerrada = true; this.alCerrar?.(); };
    this.reloj = setInterval(() => tr.enviar({ t: 'ping', s: performance.now(), de: this.lado }), 1000);
    tr.enviar({ t: 'ping', s: performance.now(), de: this.lado });
  }
  get via() { return this.tr.via; }

  // começa de novo (nova partida): os primeiros D0 passos são neutros nos dois lados
  // `id` identifica a partida (a semente): ninguém manda comandos antes de todos estarem prontos
  reiniciar(id = this.id ?? 0) {
    this.id = id;
    this.paso_ = 0; this.prod = D0;
    this.ent = Array.from({ length: this.nj }, () => new Map());
    for (let k = 0; k < D0; k++) for (const e of this.ent) e.set(k, NEUTRO);
    this.hLocal = new Map(); this.hRemoto = new Map();
    this.esperando = 0; this.desync = false; this.sinSenal = performance.now();
    this.listos.set(this.lado, id);
    this.tr.enviar({ t: 'listo', s: this.lado, id });
  }
  get lista() { for (let s = 0; s < this.nj; s++) if (this.listos.get(s) !== this.id) return false; return true; }

  recibir(m) {
    this.sinSenal = performance.now();
    if (m.t === 'listo') this.listos.set(m.s, m.id);
    else if (m.t === 'i') this.ent[m.s]?.set(m.k, m.v);
    else if (m.t === 'h') { const mapa = this.hRemoto.get(m.k) ?? new Map(); mapa.set(m.s, m.v); this.hRemoto.set(m.k, mapa); this.comparar(m.k); }
    else if (m.t === 'ping') this.tr.enviar({ t: 'pong', s: m.s, a: m.de });
    else if (m.t === 'pong') { if (m.a !== undefined && m.a !== this.lado) return; const r = performance.now() - m.s; this.rtt = this.rtt == null ? r : this.rtt * 0.7 + r * 0.3; this.pico = Math.max(r, this.pico * 0.96); }
    else this.alOtro?.(m);
  }
  comparar(k) {
    const a = this.hLocal.get(k), b = this.hRemoto.get(k);
    if (a === undefined || !b || b.size < this.nj - 1) return;
    this.hLocal.delete(k); this.hRemoto.delete(k);
    for (const v of b.values()) if (v !== a) this.desync = true;
  }

  // chamada uma vez por passo de 1/60 s. `amostra()` devolve o comando local. Devolve [cmd0, cmd1] ou null se faltar o do outro.
  paso(luta, amostra) {
    if (!this.lista) { this.esperando++; return null; }
    // atraso de entrada: metade do ping médio, com folga para o pico recente (jitter)
    const base = (this.rtt ?? 0) * 0.65 + this.pico * 0.35;
    this.D = Math.max(D0, Math.min(this.tr.lento ? 30 : 15, Math.ceil((base / 2) / 16.7) + 3));
    if (!this.perdida && performance.now() - this.sinSenal > 7000) { this.perdida = true; this.alCerrar?.(); }
    while (this.prod < this.paso_ + this.D) {
      const v = cuantizar(amostra());
      this.ent[this.lado].set(this.prod, v);
      this.tr.enviar({ t: 'i', k: this.prod, v, s: this.lado });
      this.prod++;
    }
    const cmds = this.ent.map(e => e.get(this.paso_));
    if (cmds.some(c => !c)) { this.esperando++; return null; }
    this.esperando = 0;
    for (const e of this.ent) e.delete(this.paso_ - 8);
    this.paso_++;
    if (luta && this.paso_ % 60 === 0) { const h = resumen(luta); this.hLocal.set(this.paso_, h); this.tr.enviar({ t: 'h', k: this.paso_, v: h, s: this.lado }); this.comparar(this.paso_); }
    return cmds.map(decodificar);
  }

  enviar(m) { this.tr.enviar(m); }
  cerrar() { clearInterval(this.reloj); this.cerrada = true; this.tr.alCerrar = null; this.tr.cerrar(); }
}
