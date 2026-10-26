// Sessão online em "lockstep": os dois aparelhos rodam o mesmo motor (mesma semente) e só trocam os comandos
// de cada passo. Cada comando vale daqui a D passos, então a tela local responde na hora e a rede tem folga.
// A cada segundo os dois comparam um resumo do estado; se divergirem, a partida avisa em vez de seguir errada.
// Contra rede ruim de celular:
//  - todo pacote leva de novo os comandos que o outro ainda não confirmou: se um se perde, o próximo cobre,
//    e o canal rápido pode ser sem reenvio (não trava esperando um pacote velho);
//  - quem ficou para trás roda passos extras até alcançar, em vez de arrastar o atraso para sempre;
//  - se o sinal some, a luta espera e mostra RECONNECTING; só desiste depois de muito tempo.
const D0 = 5;               // atraso mínimo em passos (83 ms a 60 passos por segundo)
const NEUTRO = [0, 0, 0, 0, 0];
const VENTANA = 40;         // no máximo quantos comandos repetidos por pacote
const MUDO_AVISO = 2500;    // sem nada do outro por 2,5 s: mostra que está reconectando
const MUDO_FIM = 45000;     // sem nada por 45 s: desiste

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
    this.rtt = null; this.pico = 0; this.D = D0; this.perdida = false; this.reconectando = false;
    this.listos = new Map();
    this.reiniciar(0);
    tr.alMensaje = m => this.recibir(m);
    tr.alCerrar = () => { this.cerrada = true; this.alCerrar?.(); };
    this.reloj = setInterval(() => this.ping(), 500);
    this.ping();
  }
  get via() { return this.tr.via; }
  // comandos e ping vão pelo canal rápido quando o transporte tem um
  rapido(m) { if (this.tr.enviarRapido) this.tr.enviarRapido(m); else this.tr.enviar(m); }
  ping() { this.rapido({ t: 'ping', s: performance.now(), de: this.lado }); if (!this.lista) this.tr.enviar({ t: 'listo', s: this.lado, id: this.id }); }

  // começa de novo (nova partida): os primeiros D0 passos são neutros nos dois lados
  // `id` identifica a partida (a semente): ninguém manda comandos antes de todos estarem prontos
  reiniciar(id = this.id ?? 0) {
    this.id = id;
    this.paso_ = 0; this.prod = D0;
    this.ent = Array.from({ length: this.nj }, () => new Map());
    for (let k = 0; k < D0; k++) for (const e of this.ent) e.set(k, NEUTRO);
    this.ack = new Array(this.nj).fill(D0 - 1);                              // até onde tenho os comandos de cada um, sem buraco
    this.ackDe = Array.from({ length: this.nj }, () => new Array(this.nj).fill(D0 - 1)); // até onde cada um diz ter os meus
    this.hLocal = new Map(); this.hRemoto = new Map();
    this.esperando = 0; this.desync = false; this.sinSenal = performance.now(); this.reconectando = false;
    this.listos.set(this.lado, id);
    this.tr.enviar({ t: 'listo', s: this.lado, id });
  }
  get lista() { for (let s = 0; s < this.nj; s++) if (this.listos.get(s) !== this.id) return false; return true; }

  recibir(m) {
    this.sinSenal = performance.now();
    if (m.t === 'I') {
      if (m.id !== this.id || !this.ent[m.s] || m.s === this.lado) return;
      const e = this.ent[m.s];
      for (let j = 0; j < m.v.length; j++) { const k = m.k + j; if (k >= this.paso_) e.set(k, m.v[j]); }
      let a = this.ack[m.s]; while (a + 1 < this.paso_ || e.has(a + 1)) a++; this.ack[m.s] = a;
      if (m.a) { const d = this.ackDe[m.s]; for (let s = 0; s < this.nj; s++) d[s] = Math.max(d[s], m.a[s] ?? -1); }
    } else if (m.t === 'listo') this.listos.set(m.s, m.id);
    else if (m.t === 'i') this.ent[m.s]?.set(m.k, m.v);
    else if (m.t === 'h') { const mapa = this.hRemoto.get(m.k) ?? new Map(); mapa.set(m.s, m.v); this.hRemoto.set(m.k, mapa); this.comparar(m.k); }
    else if (m.t === 'ping') this.rapido({ t: 'pong', s: m.s, a: m.de });
    else if (m.t === 'pong') { if (m.a !== undefined && m.a !== this.lado) return; const r = performance.now() - m.s; this.rtt = this.rtt == null ? r : this.rtt * 0.75 + r * 0.25; this.pico = Math.max(r, this.pico * 0.9); }
    else this.alOtro?.(m);
  }
  comparar(k) {
    const a = this.hLocal.get(k), b = this.hRemoto.get(k);
    if (a === undefined || !b || b.size < this.nj - 1) return;
    this.hLocal.delete(k); this.hRemoto.delete(k);
    for (const v of b.values()) if (v !== a) this.desync = true;
  }

  // manda os meus comandos que alguém ainda não confirmou (e as minhas confirmações)
  enviarEntradas() {
    let desde = this.prod;
    for (let o = 0; o < this.nj; o++) if (o !== this.lado) desde = Math.min(desde, this.ackDe[o][this.lado] + 1);
    desde = Math.max(desde, this.prod - VENTANA);
    const v = [];
    for (let k = desde; k < this.prod; k++) v.push(this.ent[this.lado].get(k) ?? NEUTRO);
    // com tudo confirmado, só um aviso de vida de vez em quando
    if (!v.length && (this.tick_ = (this.tick_ ?? 0) + 1) % 6) return;
    this.rapido({ t: 'I', id: this.id, s: this.lado, k: desde, v, a: this.ack });
  }

  // está atrás dos outros? (tem comandos deles bem além do próprio passo) então roda passos extras
  atrasado() {
    if (!this.lista) return false;
    let min = Infinity;
    for (let o = 0; o < this.nj; o++) if (o !== this.lado) min = Math.min(min, this.ack[o]);
    return min - this.D > this.paso_ + 1;
  }

  // chamada uma vez por passo de 1/60 s. `amostra()` devolve o comando local. Devolve [cmd0, cmd1] ou null se faltar o do outro.
  paso(luta, amostra) {
    if (!this.lista) { this.esperando++; return null; }
    const mudo = performance.now() - this.sinSenal;
    this.reconectando = mudo > MUDO_AVISO;
    if (!this.perdida && mudo > MUDO_FIM) { this.perdida = true; this.alCerrar?.(); }
    // atraso de entrada: metade do ping médio, com folga para o pico recente (jitter)
    const base = (this.rtt ?? 0) * 0.75 + this.pico * 0.25;
    this.D = Math.max(D0, Math.min(this.tr.lento ? 30 : 15, Math.ceil((base / 2) / 16.7) + 2));
    while (this.prod < this.paso_ + this.D) {
      const v = cuantizar(amostra());
      this.ent[this.lado].set(this.prod, v);
      this.prod++;
    }
    this.enviarEntradas();
    const cmds = this.ent.map(e => e.get(this.paso_));
    if (cmds.some(c => !c)) { this.esperando++; return null; }
    this.esperando = 0;
    for (const e of this.ent) e.delete(this.paso_ - 64);
    this.paso_++;
    if (luta && this.paso_ % 60 === 0) { const h = resumen(luta); this.hLocal.set(this.paso_, h); this.tr.enviar({ t: 'h', k: this.paso_, v: h, s: this.lado }); this.comparar(this.paso_); }
    return cmds.map(decodificar);
  }

  enviar(m) { this.tr.enviar(m); }
  cerrar() { clearInterval(this.reloj); this.cerrada = true; this.tr.alCerrar = null; this.tr.cerrar(); }
}
