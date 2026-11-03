// Linguagem das ultimates e da Mega Evolução no estilo do PB Battlegrounds: luz aditiva suave na resolução do aparelho
// (não em pixels de arte), por cima do mundo. Vale para toda ultimate e toda Mega, lendo só os eventos da luta:
// - ao soltar a ult: brilho quente em volta de quem usa e anéis finos fechando (carga);
// - no primeiro acerto da ult: quadro de impacto (a tela fica preta por 2 quadros com linhas de velocidade brancas
//   saindo do golpe, como mangá), estrela de quatro pontas amarelo-branca com brilho, anel fino abrindo e fumaça cinza;
// - nos acertos seguintes da mesma ult: estrela e anel (sem piscar a tela de novo);
// - na Mega Evolução: carga com anéis e, ao virar Mega, quadro de impacto, estrela e anéis na cor do tipo.
// Só desenho: nada aqui muda a luta.
import { pal, IMPACTO, FUMACA } from './paletas.js';

const ale = Math.random;
const entre = (a, b) => a + ale() * (b - a);
const comAlfa = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`; };

export class UltPB {
  constructor() {
    this.ult = new Map(); // lutador -> { ate, tipo, acertos, ultimaEstrela }
    this.auras = []; this.estrelas = []; this.aneis = []; this.cortes = [];
  }

  // eventos da luta (o mesmo lote que Efectos.consumir recebe); fx serve para soltar fumaça no mundo
  consumir(luta, evs, fx) {
    for (const e of evs) {
      if (e.t === 'habilidad' && e.slot === 'e' && e.l && e.h) {
        this.ult.set(e.l, { ate: luta.t + Math.max(2.2, (e.h.dur ?? 0) + (e.h.carga ?? 0) + 1.2), tipo: e.h.tipo, acertos: 0, ultimaEstrela: -9 });
        this.auras.push({ l: e.l, tipo: e.h.tipo, t: 0, life: 0.6 });
      } else if (e.t === 'evoInicio' && e.mega && e.l) {
        this.auras.push({ l: e.l, tipo: e.l.tipos?.[0] ?? 'NORMAL', t: 0, life: 1.1, mega: true });
      } else if (e.t === 'evolucion' && e.mega && e.l) {
        const tipo = e.l.tipos?.[0] ?? 'NORMAL', y = e.l.y - (e.l.alto ?? 30) * 0.5;
        this.corte(e.l.x, y, 3);
        this.estrela(e.l.x, y, tipo, 1.6);
        for (let i = 0; i < 3; i++) this.aneis.push({ x: e.l.x, y, tipo, t: -i * 0.08, life: 0.6, r: 90 + i * 30 });
        fumaca(fx, e.l.x, e.l.y, 8);
      } else if (e.t === 'numero') {
        this.ultimoDano = e.dano;
      } else if (e.t === 'impacto') {
        // todo acerto ganha estrela, anel e fumaça (maiores quanto mais forte); a ult e o golpe muito forte param a tela
        const u = e.fuente && this.ult.get(e.fuente), naUlt = u && luta.t <= u.ate, dano = this.ultimoDano ?? (e.fuerte ? 12 : 4), tipo = naUlt ? u.tipo : e.tipo;
        this.ultimoDano = null;
        const forca = naUlt ? (u.acertos === 0 ? 1.3 : 0.8) : Math.min(0.9, 0.35 + dano / 26);
        if (naUlt) u.acertos++;
        if ((naUlt && u.acertos === 1) || dano >= 20) this.corte(e.x, e.y, 2);
        const quem = e.fuente ?? this, ultima = this.ultEstrela?.get(quem) ?? -9;
        if (luta.t - ultima > 0.08) { (this.ultEstrela ??= new Map()).set(quem, luta.t); this.estrela(e.x, e.y, tipo, forca); fumaca(fx, e.x, e.y + 6, Math.round(forca * 4)); }
        this.aneis.push({ x: e.x, y: e.y, tipo, t: 0, life: 0.36, r: 25 + forca * 40 });
      }
    }
  }

  corte(x, y, quadros) { this.cortes.push({ x, y, quadros, semilla: ale() * 1000 }); }
  estrela(x, y, tipo, esc) { this.estrelas.push({ x, y, tipo, esc, t: 0, life: 0.32, rot: entre(-0.3, 0.3) }); }

  update(dt) {
    for (const lista of [this.auras, this.estrelas, this.aneis]) for (const a of lista) a.t += dt;
    this.auras = this.auras.filter(a => a.t < a.life);
    this.estrelas = this.estrelas.filter(a => a.t < a.life);
    this.aneis = this.aneis.filter(a => a.t < a.life);
  }

  // desenha na tela (g sem transformação de câmera); cam converte do mundo para a tela; z é o zoom da câmera
  dibujar(g, cam, ox, oy, W, H) {
    const tela = (x, y) => { const p = cam.aPantalla(x, y); return [p.x + ox, p.y + oy]; }, z = cam.z;
    g.save();
    // quadro de impacto: preto com linhas de velocidade brancas saindo do golpe (2 ou 3 quadros, contados no desenho)
    for (const c of this.cortes) {
      const [cx, cy] = tela(c.x, c.y);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.fillStyle = '#07070d'; g.fillRect(0, 0, W, H);
      g.fillStyle = IMPACTO[0];
      for (let i = 0; i < 46; i++) {
        const v = Math.sin(c.semilla + i * 12.9898) * 43758.5453, r = v - Math.floor(v), a = (i / 46) * Math.PI * 2 + r * 0.12;
        const r0 = 26 + r * 40, r1 = Math.max(W, H), larg = 0.012 + r * 0.03;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        g.lineTo(cx + Math.cos(a - larg) * r1, cy + Math.sin(a - larg) * r1); g.lineTo(cx + Math.cos(a + larg) * r1, cy + Math.sin(a + larg) * r1); g.closePath(); g.fill();
      }
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + c.semilla; g.beginPath(); g.arc(cx + Math.cos(a) * 12, cy + Math.sin(a) * 8, 14 + (i % 2) * 6, 0, 7); g.fill(); }
      c.quadros--;
    }
    this.cortes = this.cortes.filter(c => c.quadros > 0);
    g.globalCompositeOperation = 'lighter';
    // carga da ult / da Mega: brilho quente em volta de quem usa e anéis finos fechando
    for (const a of this.auras) {
      const k = a.t / a.life, l = a.l, [x, y] = tela(l.x, l.y - (l.alto ?? 30) * 0.5), p = pal(a.tipo), R = (a.mega ? 70 : 52) * z * (0.7 + 0.5 * Math.sin(k * Math.PI));
      const gr = g.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, comAlfa(IMPACTO[0], 0.5 * (1 - k))); gr.addColorStop(0.35, comAlfa(p[1], 0.32 * (1 - k))); gr.addColorStop(1, comAlfa(p[2], 0));
      g.globalAlpha = 1; g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
      g.lineWidth = 1.5;
      for (let i = 0; i < 2; i++) { const u = (k * 1.6 + i / 2) % 1, rr = (1 - u) * 50 * z + 6; g.strokeStyle = comAlfa(i % 2 ? p[1] : IMPACTO[0], 0.4 * (1 - u)); g.beginPath(); g.ellipse(x, y, rr, rr * 0.7, 0, 0, 7); g.stroke(); }
    }
    // anel fino que abre no acerto
    for (const a of this.aneis) {
      if (a.t < 0) continue;
      const k = a.t / a.life, [x, y] = tela(a.x, a.y), p = pal(a.tipo), r = (10 + a.r * (1 - (1 - k) ** 3)) * z;
      g.lineWidth = Math.max(0.5, 3 * (1 - k)); g.strokeStyle = comAlfa(IMPACTO[0], 0.6 * (1 - k)); g.beginPath(); g.ellipse(x, y, r, r * 0.75, 0, 0, 7); g.stroke();
      g.lineWidth = Math.max(0.5, 5 * (1 - k)); g.strokeStyle = comAlfa(p[1], 0.35 * (1 - k)); g.beginPath(); g.ellipse(x, y, r * 0.86, r * 0.64, 0, 0, 7); g.stroke();
    }
    // estrela de quatro pontas amarelo-branca com brilho: abre num pulo e some
    for (const s of this.estrelas) {
      const k = s.t / s.life, [x, y] = tela(s.x, s.y), pop = k < 0.25 ? 0.4 + (k / 0.25) * 0.9 : 1.3 - (k - 0.25) * 0.8, R = 26 * s.esc * pop * z, al = k < 0.6 ? 1 : (1 - k) / 0.4, p = pal(s.tipo);
      const gr = g.createRadialGradient(x, y, 0, x, y, R * 1.4);
      gr.addColorStop(0, comAlfa(IMPACTO[1], 0.55 * al)); gr.addColorStop(0.4, comAlfa(p[1], 0.28 * al)); gr.addColorStop(1, comAlfa(p[2], 0));
      g.globalAlpha = 1; g.fillStyle = gr; g.beginPath(); g.arc(x, y, R * 1.4, 0, 7); g.fill();
      const ponta = (k2, cor) => { g.fillStyle = cor; g.beginPath(); for (let i = 0; i < 8; i++) { const a = s.rot + (i * Math.PI) / 4, rr = (i % 2 ? R * 0.22 : R) * k2; i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
      ponta(1, comAlfa(IMPACTO[2], al)); ponta(0.62, comAlfa(IMPACTO[1], al)); ponta(0.3, comAlfa(IMPACTO[0], al));
    }
    g.restore();
  }
}

// nuvens de fumaça cinza no chão, como as do site (no mundo, em pixels de arte, para assentar junto com a poeira)
function fumaca(fx, x, y, n) {
  if (!fx) return;
  for (let i = 0; i < n; i++) { const a = ale() * Math.PI * 2, s = entre(30, 110); fx.add({ x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.45 - entre(10, 40), drag: 2.8, size: entre(5, 8), grow: 9, life: entre(0.6, 0.9), color: FUMACA[i % 3], forma: 'circulo' }); }
}
