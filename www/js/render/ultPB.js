// Linguagem das ultimates e da Mega Evolução no estilo do PB Battlegrounds: luz aditiva suave na resolução do aparelho
// (não em pixels de arte), por cima do mundo. Vale para toda ultimate e toda Mega, lendo só os eventos da luta:
// - ao soltar a ult: brilho da cor do tipo em volta de quem usa (carga);
// - no acerto: estrela de quatro pontas amarelo-branca, sem fumaça (sem quadro de impacto: a tela só pisca no K.O.);
// - no ataque básico (LMB): só uma estrela pequena;
// - na Mega Evolução: brilho de carga e, ao virar Mega, estrela na cor do tipo.
// Sem anéis brancos nem brilho branco em volta (o usuário achou exagero): o brilho é da cor do tipo.
// Só desenho: nada aqui muda a luta.
import { pal, IMPACTO } from './paletas.js';

const ale = Math.random;
const entre = (a, b) => a + ale() * (b - a);
const comAlfa = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`; };

export class UltPB {
  constructor() {
    this.ult = new Map(); // lutador -> { ate, tipo, acertos, ultimaEstrela }
    this.auras = []; this.estrelas = [];
  }

  // eventos da luta (o mesmo lote que Efectos.consumir recebe)
  consumir(luta, evs) {
    for (const e of evs) {
      if (e.t === 'habilidad' && e.slot === 'e' && e.l && e.h) {
        this.ult.set(e.l, { ate: luta.t + Math.max(2.2, (e.h.dur ?? 0) + (e.h.carga ?? 0) + 1.2), tipo: e.h.tipo, acertos: 0, ultimaEstrela: -9 });
        this.auras.push({ l: e.l, tipo: e.h.tipo, t: 0, life: 0.6 });
      } else if (e.t === 'evoInicio' && e.mega && e.l) {
        this.auras.push({ l: e.l, tipo: e.l.tipos?.[0] ?? 'NORMAL', t: 0, life: 1.1, mega: true });
      } else if (e.t === 'evolucion' && e.mega && e.l) {
        const tipo = e.l.tipos?.[0] ?? 'NORMAL', y = e.l.y - (e.l.alto ?? 30) * 0.5;
        this.estrela(e.l.x, y, tipo, 1.6);
      } else if (e.t === 'numero') {
        this.ultimoDano = e.dano;
      } else if (e.t === 'impacto') {
        // todo acerto ganha uma estrela (maior quanto mais forte); a do ataque básico é pequena
        const u = e.fuente && this.ult.get(e.fuente), naUlt = u && luta.t <= u.ate, dano = this.ultimoDano ?? (e.fuerte ? 12 : 4), tipo = naUlt ? u.tipo : e.tipo;
        this.ultimoDano = null;
        const basico = e.slot === 'lmb' && !naUlt, forca = naUlt ? (u.acertos === 0 ? 1.3 : 0.8) : basico ? 0.3 : Math.min(0.9, 0.35 + dano / 26);
        if (naUlt) u.acertos++;
        const quem = e.fuente ?? this, ultima = this.ultEstrela?.get(quem) ?? -9;
        if (luta.t - ultima > 0.08) { (this.ultEstrela ??= new Map()).set(quem, luta.t); this.estrela(e.x, e.y, tipo, forca); }
      }
    }
  }

  estrela(x, y, tipo, esc) { this.estrelas.push({ x, y, tipo, esc, t: 0, life: 0.32, rot: entre(-0.3, 0.3) }); }

  update(dt) {
    for (const lista of [this.auras, this.estrelas]) for (const a of lista) a.t += dt;
    this.auras = this.auras.filter(a => a.t < a.life);
    this.estrelas = this.estrelas.filter(a => a.t < a.life);
  }

  // desenha na tela (g sem transformação de câmera); cam converte do mundo para a tela; z é o zoom da câmera
  dibujar(g, cam, ox, oy) {
    const tela = (x, y) => { const p = cam.aPantalla(x, y); return [p.x + ox, p.y + oy]; }, z = cam.z;
    g.save();
    g.globalCompositeOperation = 'lighter';
    // carga da ult / da Mega: brilho da cor do tipo em volta de quem usa
    for (const a of this.auras) {
      const k = a.t / a.life, l = a.l, [x, y] = tela(l.x, l.y - (l.alto ?? 30) * 0.5), p = pal(a.tipo), R = (a.mega ? 70 : 52) * z * (0.7 + 0.5 * Math.sin(k * Math.PI));
      const gr = g.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, comAlfa(p[1], 0.35 * (1 - k))); gr.addColorStop(0.35, comAlfa(p[1], 0.22 * (1 - k))); gr.addColorStop(1, comAlfa(p[2], 0));
      g.globalAlpha = 1; g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
    }
    // estrela de quatro pontas amarelo-branca com brilho: abre num pulo e some
    for (const s of this.estrelas) {
      const k = s.t / s.life, [x, y] = tela(s.x, s.y), pop = k < 0.25 ? 0.4 + (k / 0.25) * 0.9 : 1.3 - (k - 0.25) * 0.8, R = 26 * s.esc * pop * z, al = k < 0.6 ? 1 : (1 - k) / 0.4, p = pal(s.tipo);
      const gr = g.createRadialGradient(x, y, 0, x, y, R * 1.1);
      gr.addColorStop(0, comAlfa(p[1], 0.35 * al)); gr.addColorStop(0.4, comAlfa(p[1], 0.18 * al)); gr.addColorStop(1, comAlfa(p[2], 0));
      g.globalAlpha = 1; g.fillStyle = gr; g.beginPath(); g.arc(x, y, R * 1.1, 0, 7); g.fill();
      const ponta = (k2, cor) => { g.fillStyle = cor; g.beginPath(); for (let i = 0; i < 8; i++) { const a = s.rot + (i * Math.PI) / 4, rr = (i % 2 ? R * 0.22 : R) * k2; i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
      ponta(1, comAlfa(IMPACTO[2], al)); ponta(0.62, comAlfa(IMPACTO[1], al)); ponta(0.3, comAlfa(IMPACTO[0], al));
    }
    g.restore();
  }
}
