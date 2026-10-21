// Cena animada da tela inicial: entardecer em pixel art com montanhas, estrelas e nuvens, e a Mega
// Venusaur respirando em cima de um pedestal, soltando pétalas e esporos. Tudo é desenhado numa tela
// pequena (cerca de 134 linhas) e ampliado sem suavizar, com os mesmos pixels grandes do sprite.
import { gifFrame } from './sprites.js';

const LINES = 134;

// céu de cima para baixo; os últimos tons só aparecem perto do sol
const SKY = ['#0b0d26', '#111336', '#191a46', '#251e56', '#382262', '#53286a', '#7a326f', '#a44470', '#cc626c', '#ea8a68', '#f8ac72', '#ffcf88', '#fff0b8'];
const SKY_END = 9; // índice da cor do horizonte (o resto é o brilho do sol)
const GROUND = ['#2f6043', '#28543b', '#214833', '#1b3c2c', '#153124', '#10261d', '#0b1c16'];
const RING = ['#ff6fd8', '#ffd84a', '#8be09a', '#6fd0ff', '#b07aff'];
const PETALS = [['#ff8fb8', '#c4507a'], ['#ffc2d8', '#e07ea4'], ['#ff6f9e', '#a83a64']];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

const rgb = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const pack = c => { const [r, g, b] = rgb(c); return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; };

function random(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// contorno de elipse pixel a pixel
function ellipseRing(g, cx, cy, rx, ry, color) {
  g.fillStyle = color;
  const n = Math.max(12, Math.ceil(Math.PI * 2 * Math.max(rx, ry)));
  let lx = null, ly = null;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
    if (x !== lx || y !== ly) g.fillRect(x, y, 1, 1);
    lx = x; ly = y;
  }
}

export class TitleScene {
  constructor(canvas, stage, sheet) {
    this.canvas = canvas;
    this.stage = stage;
    this.sheet = sheet;
    this.g = canvas.getContext('2d');
    this.bg = document.createElement('canvas');
    this.t = 0;
    this.last = 0;
    this.key = '';
    this.petals = [];
    this.spores = [];
    this.sparks = [];
    this.emit = 0;
    this.pulseShown = -1;
  }

  start() {
    const tick = now => {
      if (!this.canvas.isConnected) return; // a tela inicial foi fechada
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
      this.last = now;
      this.frame(dt);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Tamanho da tela e posição da Mega (centro da área da esquerda)
  layout() {
    const host = this.canvas.parentElement;
    const W = host.clientWidth, H = host.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    const st = this.stage.getBoundingClientRect(), hr = host.getBoundingClientRect();
    const key = `${W}x${H}x${dpr}x${Math.round(st.left)}x${Math.round(st.width)}x${Math.round(st.height)}`;
    if (key === this.key || !W || !H) return;
    this.key = key;
    // pixels do tamanho certo para caber umas 134 linhas, mas sem deixar a área da Mega estreita demais
    const P = Math.max(2, Math.min(Math.round((H * dpr) / LINES), Math.floor((st.width * dpr) / 150)));
    const w = Math.ceil((W * dpr) / P), h = Math.ceil((H * dpr) / P);
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${(w * P) / dpr}px`;
    this.canvas.style.height = `${(h * P) / dpr}px`;
    const toPx = v => Math.round((v * dpr) / P);
    this.w = w;
    this.h = h;
    this.cx = toPx(st.left - hr.left + st.width / 2);
    this.groundY = toPx(st.top - hr.top + st.height * 0.74);
    this.horizon = this.groundY - 17;
    this.sunR = Math.max(22, Math.min(40, Math.round(h * 0.3)));
    this.sunY = this.horizon - 12;
    const rand = random(7);
    this.stars = [];
    for (let i = 0; i < (w * this.horizon) / 140; i++) {
      const x = Math.floor(rand() * w), y = Math.floor(rand() * (this.horizon - 30));
      if (Math.hypot(x - this.cx, y - this.sunY) < this.sunR * 1.8) continue;
      this.stars.push({ x, y, ph: rand() * 6.3, sp: 1 + rand() * 2.5, big: rand() < 0.1, col: ['#ffffff', '#ffe9a8', '#c4d2ff'][Math.floor(rand() * 3)] });
    }
    this.clouds = [0, 1, 2, 3].map(i => {
      const c = this.cloud(random(40 + i), 18 + Math.floor(rand() * 22));
      return { c, x: rand() * w, y: 8 + Math.floor(rand() * Math.max(4, this.horizon - 52)), sp: 1.2 + rand() * 2.6 };
    });
    this.bake();
  }

  // Nuvem em pixel art: uma base achatada com gomos redondos em cima, borda de cima clara e a de baixo
  // rosada (luz do sol)
  cloud(rand, cw) {
    const ch = Math.ceil(cw * 0.42);
    const br = Math.max(2, Math.round(ch * 0.24)); // raio das pontas da base
    const baseY = ch - br;
    const bumps = [];
    const n = 2 + Math.floor(cw / 14);
    for (let i = 0; i < n; i++) {
      const mid = 1 - Math.abs(i - (n - 1) / 2) / (n / 2);
      bumps.push({ x: br + ((i + 0.5) * (cw - br * 2)) / n + (rand() - 0.5) * 2, r: Math.min(ch - br - 1, ch * (0.22 + 0.3 * mid) + rand() * 2) });
    }
    const inside = (x, y) => {
      if (y < 0 || y >= ch || x < 0 || x >= cw) return false;
      const ex = x < br ? br - x : x > cw - 1 - br ? x - (cw - 1 - br) : 0; // pontas arredondadas da base
      if (y >= baseY - br && ex * ex + (y - baseY) ** 2 <= br * br + 1) return true;
      return bumps.some(b => (x - b.x) ** 2 + (y - (baseY - br + 1)) ** 2 <= b.r * b.r);
    };
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const g = c.getContext('2d');
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        if (!inside(x, y)) continue;
        g.fillStyle = !inside(x, y - 1) ? '#6c4f90' : !inside(x, y + 1) || !inside(x, y + 2) ? '#a8537a' : '#3c2d6a';
        g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  // Parte parada da cena (céu, sol, montanhas, chão e pedestal), refeita só quando o tamanho muda
  bake() {
    const { w, h, cx, horizon, groundY, sunR, sunY } = this;
    this.bg.width = w;
    this.bg.height = h;
    const img = new ImageData(w, h);
    const px = new Uint32Array(img.data.buffer);
    const sky = SKY.map(pack), ground = GROUND.map(pack);
    const rand = random(11);

    // céu com degraus pontilhados e o brilho do sol
    for (let y = 0; y < horizon; y++) {
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - cx, (y - sunY) * 1.1);
        let f = (y / horizon) * SKY_END + 3.4 * Math.max(0, 1 - d / (sunR * 2.4)) ** 1.7;
        if (d < sunR) f = Math.max(f, 10.4 + 1.9 * (1 - d / sunR));
        f = Math.min(SKY.length - 1.001, f);
        const i = Math.floor(f);
        px[y * w + x] = f - i > bayer(x, y) ? sky[i + 1] : sky[i];
      }
    }

    // montanhas ao fundo: picos triangulares, com a face virada para o sol mais clara
    const peaks = [];
    for (let x = -20; x < w + 20; x += 14 + rand() * 22) peaks.push({ x, hgt: 8 + rand() * 16, sl: 0.55 + rand() * 0.5 });
    const lit = pack('#55346f'), dark = pack('#2b1f50'), snow = pack('#8a6aa0');
    for (let x = 0; x < w; x++) {
      let best = null, top = 0;
      for (const p of peaks) {
        const v = p.hgt - Math.abs(x - p.x) * p.sl;
        if (v > top) { top = v; best = p; }
      }
      if (!best) continue;
      const y0 = Math.round(horizon - top);
      const face = (x < best.x) === (cx < best.x) ? lit : dark;
      for (let y = Math.max(0, y0); y < horizon; y++) px[y * w + x] = y - y0 < 2 && best.hgt > 18 ? snow : face;
    }

    // morros mais perto, arredondados
    const ph = [rand() * 6, rand() * 6, rand() * 6];
    const hill = pack('#1c3a37'), hillTop = pack('#356b50');
    for (let x = 0; x < w; x++) {
      const top = Math.round(horizon - (4 + 3 * Math.sin(x * 0.045 + ph[0]) + 2 * Math.sin(x * 0.11 + ph[1]) + 1.5 * Math.sin(x * 0.23 + ph[2])));
      for (let y = Math.max(0, top); y < horizon; y++) px[y * w + x] = y === top ? hillTop : hill;
    }

    // chão em faixas, mais claro onde o sol bate
    for (let y = horizon; y < h; y++) {
      const k = (y - horizon) / Math.max(1, h - horizon);
      for (let x = 0; x < w; x++) {
        const shine = 1.6 * Math.max(0, 1 - Math.abs(x - cx) / (sunR * 2)) * (1 - k);
        const f = Math.max(0, Math.min(GROUND.length - 1.001, k * (GROUND.length - 1) - shine));
        const i = Math.floor(f);
        px[y * w + x] = f - i > bayer(x, y) ? ground[i + 1] : ground[i];
      }
    }
    // tufos de grama e florzinhas
    const tuft = pack('#4c8a58'), tuftDark = pack('#2c5a3e'), fl = ['#ff8fb8', '#ffe27a', '#ffffff'].map(pack);
    for (let n = 0; n < (w * (h - horizon)) / 30; n++) {
      const x = Math.floor(rand() * w), y = horizon + 3 + Math.floor(rand() * (h - horizon - 3));
      if (Math.abs(x - cx) < 62 && Math.abs(y - groundY) < 16) continue;
      if (rand() < 0.8) {
        px[y * w + x] = tuft;
        if (y > 0) px[(y - 1) * w + x] = tuftDark;
        if (x > 0 && rand() < 0.6) px[y * w + x - 1] = tuftDark;
      } else {
        px[y * w + x] = fl[Math.floor(rand() * fl.length)];
      }
    }

    // pedestal de pedra
    const rx = 52, ry = 11, cy = groundY - 1;
    const fillEllipse = (ecx, ecy, erx, ery, col, edge) => {
      const c = pack(col), e = edge ? pack(edge) : 0;
      for (let y = -ery; y <= ery; y++) {
        const half = Math.floor(erx * Math.sqrt(Math.max(0, 1 - (y / (ery + 0.5)) ** 2)));
        for (let x = -half; x <= half; x++) {
          const X = ecx + x, Y = ecy + y;
          if (X < 0 || X >= w || Y < 0 || Y >= h) continue;
          px[Y * w + X] = e && (Math.abs(x) === half || y === -ery || y === ery) ? e : c;
        }
      }
    };
    fillEllipse(cx, cy + 5, rx + 1, ry + 1, '#1f2140', '#111226');
    fillEllipse(cx, cy + 3, rx, ry, '#363a62');
    fillEllipse(cx, cy, rx, ry, '#5d6389', '#141628');
    fillEllipse(cx, cy, Math.round(rx * 0.8), Math.round(ry * 0.78), '#6a719b', '#7f87b4');
    fillEllipse(cx, cy, Math.round(rx * 0.56), Math.round(ry * 0.55), '#5a6088');
    for (let x = -rx + 6; x < rx - 6; x++) {
      const y = cy - Math.floor(ry * Math.sqrt(1 - (x / rx) ** 2));
      if (y >= 0 && rand() < 0.7) px[y * w + cx + x] = pack('#9aa2d6');
    }
    // grama em volta da borda da frente
    for (let x = -rx; x <= rx; x++) {
      if (rand() < 0.45) continue;
      const y = cy + 4 + Math.floor((ry + 1) * Math.sqrt(Math.max(0, 1 - (x / (rx + 1)) ** 2)));
      const len = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < len; k++) if (y - k >= 0 && y - k < h) px[(y - k) * w + cx + x] = k === len - 1 ? tuft : tuftDark;
    }
    // sombra da Mega
    fillEllipse(cx, groundY, 32, 4, '#454a74');
    this.bg.getContext('2d').putImageData(img, 0, 0);
  }

  frame(dt) {
    this.layout();
    if (!this.w) return;
    this.t += dt;
    const { g, t, w, cx, groundY } = this;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.bg, 0, 0);

    // estrelas piscando
    for (const s of this.stars) {
      const b = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
      if (b < 0.2) continue;
      g.fillStyle = b < 0.55 ? '#6e70a8' : s.col;
      g.fillRect(s.x, s.y, 1, 1);
      if (s.big && b > 0.82) {
        g.fillStyle = '#9da6e8';
        g.fillRect(s.x - 1, s.y, 1, 1); g.fillRect(s.x + 1, s.y, 1, 1); g.fillRect(s.x, s.y - 1, 1, 1); g.fillRect(s.x, s.y + 1, 1, 1);
      }
    }
    // nuvens indo devagar para a direita
    for (const c of this.clouds) {
      c.x += c.sp * dt;
      if (c.x > w) c.x = -c.c.width;
      g.drawImage(c.c, Math.round(c.x), c.y);
    }

    const sh = this.sheet;
    const bodyY = groundY - 28;
    // a cada 6 s, uma onda da Mega Evolução sai de trás dela
    const cyc = (t - 1.2) % 6;
    if (t > 1.2 && cyc < 1.3) {
      const k = cyc / 1.3;
      const r = 8 + k * 78;
      ellipseRing(g, cx, bodyY, r, r, RING[Math.floor(t * 14) % RING.length]);
      ellipseRing(g, cx, bodyY, Math.max(1, r - 3), Math.max(1, r - 3), RING[(Math.floor(t * 14) + 2) % RING.length]);
      ellipseRing(g, cx, groundY + 2, r * 1.3, r * 0.26, '#ffe9a8');
      const n = Math.floor((t - 1.2) / 6);
      if (n !== this.pulseShown) {
        this.pulseShown = n;
        for (let i = 0; i < 10; i++) this.spark(cx + (Math.random() - 0.5) * 90, bodyY + (Math.random() - 0.5) * 56);
      }
    }

    if (sh) {
      const f = gifFrame(sh, t);
      g.drawImage(sh.img, (f % sh.cols) * sh.w, Math.floor(f / sh.cols) * sh.h, sh.w, sh.h, Math.round(cx - sh.w / 2), groundY - sh.feet + 1, sh.w, sh.h);
    }

    this.particles(dt);
  }

  spark(x, y) {
    this.sparks.push({ x: Math.round(x), y: Math.round(y), life: 0, dur: 0.5 + Math.random() * 0.3 });
  }

  // pétalas saindo da flor, esporos subindo do chão e brilhos em volta
  particles(dt) {
    const { g, t, w, h, cx, groundY } = this;
    this.emit += dt;
    while (this.emit > 0.22) {
      this.emit -= 0.22;
      const top = groundY - (this.sheet?.feet || 56) + 6;
      if (this.petals.length < 60) {
        const fromFlower = Math.random() < 0.65;
        this.petals.push({
          x: fromFlower ? cx + (Math.random() - 0.5) * 40 : Math.random() * w * 0.9 - 20,
          y: fromFlower ? top + Math.random() * 8 : -2,
          vx: 6 + Math.random() * 12, vy: fromFlower ? -6 - Math.random() * 8 : 4 + Math.random() * 5,
          ph: Math.random() * 6.3, life: 0, dur: 5 + Math.random() * 4,
          col: PETALS[Math.floor(Math.random() * PETALS.length)], leaf: Math.random() < 0.18,
        });
      }
      if (this.spores.length < 26 && Math.random() < 0.7) {
        this.spores.push({ x: cx + (Math.random() - 0.5) * 120, y: groundY + (Math.random() - 0.3) * 10, vy: -(4 + Math.random() * 6), ph: Math.random() * 6.3, life: 0, dur: 3 + Math.random() * 3 });
      }
      if (Math.random() < 0.35) this.spark(cx + (Math.random() - 0.5) * 80, groundY - 10 - Math.random() * 50);
    }

    for (const p of this.petals) {
      p.life += dt;
      p.vy += 3 * dt; // caem devagar depois do impulso
      p.vy = Math.min(p.vy, 7);
      p.x += (p.vx + Math.sin(t * 2 + p.ph) * 6) * dt;
      p.y += p.vy * dt;
      const x = Math.round(p.x), y = Math.round(p.y);
      const flap = Math.floor(t * 5 + p.ph) % 3;
      const [a, b] = p.leaf ? ['#6fcf74', '#3a8a4a'] : p.col;
      g.fillStyle = a;
      g.fillRect(x, y, 1, 1);
      g.fillStyle = b;
      if (flap === 0) g.fillRect(x + 1, y, 1, 1);
      else if (flap === 1) g.fillRect(x + 1, y + 1, 1, 1);
      else g.fillRect(x, y + 1, 1, 1);
    }
    this.petals = this.petals.filter(p => p.life < p.dur && p.y < h + 2 && p.x < w + 2);

    for (const s of this.spores) {
      s.life += dt;
      s.y += s.vy * dt;
      const x = Math.round(s.x + Math.sin(t * 1.6 + s.ph) * 3), y = Math.round(s.y);
      if (Math.floor(t * 6 + s.ph * 3) % 4 === 0) continue; // pisca
      g.fillStyle = s.life / s.dur > 0.7 ? '#7ec27a' : '#d8f58a';
      g.fillRect(x, y, 1, 1);
    }
    this.spores = this.spores.filter(s => s.life < s.dur);

    for (const s of this.sparks) {
      s.life += dt;
      const k = s.life / s.dur;
      const arm = k < 0.25 || k > 0.8 ? 0 : k < 0.45 || k > 0.65 ? 1 : 2;
      g.fillStyle = '#ffb3e6';
      for (let i = 1; i <= arm; i++) {
        g.fillRect(s.x - i, s.y, 1, 1); g.fillRect(s.x + i, s.y, 1, 1); g.fillRect(s.x, s.y - i, 1, 1); g.fillRect(s.x, s.y + i, 1, 1);
      }
      g.fillStyle = '#ffffff';
      g.fillRect(s.x, s.y, 1, 1);
    }
    this.sparks = this.sparks.filter(s => s.life < s.dur);
  }
}
