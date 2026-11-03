// Golpes de área no formato do PB Battlegrounds.
// - ondaSom (no mundo): Supersonic, Sing, Screech e Scary Face como arcos grossos ")))" abrindo, com contorno escuro,
//   corpo claro e fio branco, mais grossos no meio e finos nas pontas;
// - fumacaAnel: nuvens de fumaça cinza abrindo em anel no Earthquake / Magnitude e nas quedas;
// - fogoAnel: bolas de fogo pedaçudas subindo em volta no Fire Spin.
// Só desenho: nada aqui muda a luta.
import * as PX from './pixelfx.js';
import { pal, IMPACTO, FUMACA, CONTORNO } from './paletas.js';

const ale = Math.random;
const entre = (a, b) => a + ale() * (b - a);
const SOM = ['#f4fbff', '#bfe0ff', '#7fa8e0', '#3a5a9a', '#1a2a50'];

export function ondaSom(g, o, k) {
  const P = o.tipo && o.tipo !== 'NORMAL' ? pal(o.tipo) : SOM, ca = Math.cos(o.ang), sa = Math.sin(o.ang);
  for (let i = 0; i < 4; i++) {
    const f = Math.min(1, k * 1.25 - i * 0.12); if (f <= 0) continue;
    const d = o.alcance * f, rx = 4 + f * 7, ry = Math.tan(o.ang2) * d * 0.9 + 4, cx = o.x + ca * d, cy = o.y + sa * d * 0.9;
    const pts = [];
    for (let j = 0; j <= 14; j++) { const u = (j / 14 - 0.5) * 2; pts.push([cx - sa * u * ry + ca * (1 - u * u) * rx, cy + ca * u * ry + sa * (1 - u * u) * rx * 0.9, 1 - Math.abs(u)]); }
    g.globalAlpha = Math.min(1, (1 - f) * 2.2 + 0.2);
    for (const [cor, w] of [[CONTORNO, 4], [P[2], 3], [P[1], 2], [IMPACTO[0], 1]]) {
      for (let j = 0; j < pts.length - 1; j++) { const mid = (pts[j][2] + pts[j + 1][2]) / 2, ww = Math.max(1, Math.round(w * (0.45 + 0.55 * mid))); if (cor === IMPACTO[0] && mid < 0.4) continue; PX.lineaPix(g, pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], cor, ww); }
    }
  }
  g.globalAlpha = 1;
}

export function fumacaAnel(fx, x, y, r) {
  const n = Math.max(8, Math.round(r / 5));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + entre(-0.15, 0.15), s = entre(60, 110) * Math.min(1.6, r / 40);
    fx.add({ x: x + Math.cos(a) * r * 0.35, y: y + Math.sin(a) * r * 0.22, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.55 - entre(5, 20), drag: 3.2, size: entre(5, 8), grow: 8, life: entre(0.6, 0.85), color: FUMACA[i % 3], forma: 'circulo' });
  }
}

export function fogoAnel(fx, x, y, r) {
  const P = pal('FIRE');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + entre(-0.1, 0.1), rr = r * entre(0.7, 0.95);
    fx.add({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.62, vx: -Math.sin(a) * 30, vy: Math.cos(a) * 18 - entre(40, 70), drag: 1.4, size: entre(3.5, 5.5), grow: -3, life: entre(0.45, 0.65), color: P[1 + (i % 3)], forma: 'circulo' });
  }
}

// queda do meteoro (Heavy Slam, Pulverizing Pancake, Sky Uppercut, Thunder Crash), na tela: riscos de velocidade
// descendo e uma coluna de luz sobre a marca enquanto o lutador cai
export function luzMeteoro(g, luta, cam, ox, oy) {
  g.save();
  g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  const z = cam.z;
  for (const e of luta.entidades) {
    if (e.tipo !== 'meteoro' || (e.fase !== 'baja' && e.fase !== 'fija') || e.tipoAtq === 'FLYING') continue;
    const forte = e.fase === 'baja', p = cam.aPantalla(e.x, e.y), x = p.x + ox, y = p.y + oy, R = e.radio * z, P = pal(e.tipoAtq);
    const gr = g.createLinearGradient(x, y - 240 * z, x, y);
    gr.addColorStop(0, 'rgba(255,253,244,0)'); gr.addColorStop(1, forte ? 'rgba(255,253,244,0.3)' : 'rgba(255,253,244,0.1)');
    g.fillStyle = gr; g.fillRect(x - R * 0.45, y - 240 * z, R * 0.9, 240 * z);
    for (let i = 0; i < 9; i++) {
      const v = Math.sin(i * 91.7 + Math.floor(luta.t * 30)) * 0.5, dx = (i / 8 - 0.5) * R * 1.2 + v * 6 * z, comp = (60 + (i % 3) * 30) * z, y1 = y - (20 + (i % 4) * 14) * z;
      g.strokeStyle = i % 3 ? `rgba(255,253,244,${forte ? 0.45 : 0.2})` : `${P[0]}${forte ? '99' : '44'}`; g.lineWidth = Math.max(1, (i % 2 ? 1.2 : 2) * z);
      g.beginPath(); g.moveTo(x + dx, y1 - comp); g.lineTo(x + dx, y1); g.stroke();
    }
  }
  g.restore();
}
