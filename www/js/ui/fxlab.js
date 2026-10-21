// Laboratório de efeitos (uso interno): mostra os sprites de pixel art ampliados. Abra /?pantalla=fxlab
import * as P from '../render/pixelfx.js';
import { paleta } from '../render/efectos.js';

export class FxLab {
  constructor(app) { this.app = app; this.t = 0; }
  actualizar(dt) { this.t += dt; }
  dibujar(g) {
    g.fillStyle = '#2f7d32'; g.fillRect(0, 0, 640, 360);
    g.save(); g.scale(2, 2); g.imageSmoothingEnabled = false;
    const f = Math.floor(this.t * 8);
    let x = 14;
    for (const tam of [8, 11, 15, 20]) { P.carimbar(g, P.llama(f, tam), x, 40); x += tam + 14; }
    const azul = P.rampaDe('#6ab0f0'); for (const tam of [8, 12]) { P.carimbar(g, P.llama(f, tam, ['#2a1060', '#7a3cf0', '#c49cff', '#ffffff']), x, 40); x += tam + 14; }
    for (const L of [8, 12, 16]) { P.carimbar(g, P.gota(L), x, 34); x += L + 12; }
    for (const L of [9, 13, 17]) { P.carimbar(g, P.hoja(L), x, 34); x += L + 12; }
    x = 14;
    for (const t of [2, 3, 5]) { P.carimbar(g, P.chispa(t, '#fff7a8'), x, 80); x += t * 2 + 12; }
    for (const t of [6, 9, 13]) { P.carimbar(g, P.humo(t), x + t, 80); x += t * 2 + 12; }
    for (const r of [3, 5, 8]) { P.carimbar(g, P.burbuja(r), x, 80); x += r * 2 + 12; }
    for (const r of [3, 5, 8]) { P.carimbar(g, P.roca(r), x, 80); x += r * 2 + 10; }
    x = 14;
    for (const s of [1, 2]) { P.carimbar(g, P.corazon(s), x, 125); x += 8 * s + 14; }
    for (const r of [4, 7, 10]) { P.carimbar(g, P.shuriken(r), x, 125, this.t * 6); x += r * 2 + 12; }
    for (let k = 0; k < 4; k++) { P.carimbar(g, P.estouro(k, 12), x, 125); x += 32; }
    x = 20;
    for (const tipo of ['FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'DRAGON', 'PSYCHIC']) { const pa = paleta(tipo); P.esfera(g, x, 170, 7, [pa[3], pa[2], pa[1], pa[0]]); x += 26; }
    g.restore();
  }
}
