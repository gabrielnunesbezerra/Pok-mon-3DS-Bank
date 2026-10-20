// Carrega os sprites e desenha o quadro certo de cada animação.
// - PMD (8 direções, com animações de andar, atacar, levar dano...)
// - Megas sem sprite PMD: sprite de frente/costas no estilo Black/White, animado por código
// - Treinadores: sprites dos jogos
import { SPRITE_DATA, TRAINER_DATA } from '../data/sprites.js';
import { BODY } from '../data/dex.js';

const FALLBACK = {
  Idle: ['Idle', 'Walk'],
  Walk: ['Walk', 'Idle'],
  Attack: ['Attack', 'Strike', 'Idle'],
  Strike: ['Strike', 'Attack', 'Idle'],
  Shoot: ['Shoot', 'Attack', 'Idle'],
  Swing: ['Swing', 'Attack', 'Idle'],
  Charge: ['Charge', 'Idle'],
  Hop: ['Hop', 'Walk', 'Idle'],
  Rotate: ['Rotate', 'Walk', 'Idle'],
  Hurt: ['Hurt', 'Idle'],
  Sleep: ['Sleep', 'Idle'],
};
const LOOP = new Set(['Idle', 'Walk', 'Sleep', 'Rotate', 'Charge']);
// linha do sheet para cada direção (0 = direita, sentido horário de 45 em 45 graus)
const ROW_FOR_DIR = [2, 1, 0, 7, 6, 5, 4, 3];

function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tinted(img, rgb, alpha) {
  const c = makeCanvas(img.width, img.height);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// retângulo com os pixels visíveis (para recortar o rosto do treinador)
function opaqueBox(img) {
  try {
    const c = makeCanvas(img.width, img.height);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const { data } = g.getImageData(0, 0, img.width, img.height);
    let x0 = img.width, y0 = img.height, x1 = 0, y1 = 0;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      if (data[(y * img.width + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
    if (x1 < x0) throw new Error('vazio');
    // centro horizontal da cabeça: média das colunas visíveis no topo do desenho
    const headRows = Math.max(4, Math.round((y1 - y0) * 0.22));
    let sum = 0, n = 0;
    for (let y = y0; y < y0 + headRows; y++) for (let x = x0; x <= x1; x++) if (data[(y * img.width + x) * 4 + 3] > 40) { sum += x; n++; }
    return { x0, y0, x1, y1, headX: n ? sum / n : (x0 + x1) / 2 };
  } catch {
    return { x0: 0, y0: 0, x1: img.width - 1, y1: img.height - 1, headX: img.width / 2 };
  }
}

// linha do último pixel visível (onde ficam os "pés")
function bottomRow(img, sx = 0, sy = 0, w = img.width, h = img.height) {
  try {
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    g.drawImage(img, sx, sy, w, h, 0, 0, w, h);
    const data = g.getImageData(0, 0, w, h).data;
    for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 40) return y + 1;
  } catch { /* sem acesso aos pixels */ }
  return h * 0.85;
}

export class SpriteBank {
  constructor() {
    this.sheets = {};
    this.bw = {};
    this.portraits = {};
    this.artwork = {};
    this.trainers = {};
    this.white = new Map();
    this.ice = new Map();
    this.feet = {};
  }

  async load(onProgress) {
    const jobs = [];
    for (const [key, data] of Object.entries(SPRITE_DATA)) {
      if (data.anims) {
        this.sheets[key] = {};
        for (const [name, a] of Object.entries(data.anims)) {
          if (a.copyOf) continue;
          jobs.push(loadImage(`assets/sprites/${key}/${name}.png`).then(img => {
            if (img) this.sheets[key][name] = { img, w: a.w, h: a.h, durations: a.durations, frames: a.durations.length, total: a.durations.reduce((s, d) => s + d, 0) };
          }));
        }
      }
      if (data.bw) {
        jobs.push(Promise.all([loadImage(data.bw.front), loadImage(data.bw.back)]).then(([front, back]) => {
          if (front && back) this.bw[key] = { front, back, feetFront: bottomRow(front), feetBack: bottomRow(back) };
        }));
      }
      if (data.portrait) jobs.push(loadImage(data.portrait).then(img => { this.portraits[key] = img; }));
      if (data.artwork) jobs.push(loadImage(data.artwork).then(img => { this.artwork[key] = img; }));
    }
    for (const [id, t] of Object.entries(TRAINER_DATA)) {
      jobs.push(loadImage(t.img).then(img => { if (img) this.trainers[id] = { img, name: t.name, feet: bottomRow(img), box: opaqueBox(img) }; }));
    }
    let done = 0;
    await Promise.all(jobs.map(j => j.then(() => onProgress?.(++done / jobs.length))));
    for (const [key, data] of Object.entries(SPRITE_DATA)) {
      if (data.anims) for (const [name, a] of Object.entries(data.anims)) if (a.copyOf && this.sheets[key][a.copyOf]) this.sheets[key][name] = this.sheets[key][a.copyOf];
    }
    for (const key of Object.keys(this.sheets)) this.feet[key] = this.measureFeet(key);
  }

  measureFeet(key) {
    const s = this.sheets[key].Idle || Object.values(this.sheets[key])[0];
    return { idle: bottomRow(s.img, 0, 0, s.w, s.h), h: s.h };
  }

  sheet(key, anim) {
    const set = this.sheets[key];
    if (!set) return null;
    for (const name of FALLBACK[anim] || [anim, 'Idle']) if (set[name]) return { s: set[name], name };
    return { s: Object.values(set)[0], name: 'Idle' };
  }

  frameOf(s, name, t) {
    let tick = Math.floor(t * 60);
    if (LOOP.has(name)) tick %= s.total;
    else if (tick >= s.total) return s.frames - 1;
    for (let i = 0; i < s.frames; i++) {
      tick -= s.durations[i];
      if (tick < 0) return i;
    }
    return s.frames - 1;
  }

  silhouette(cache, img, rgb) {
    let c = cache.get(img);
    if (!c) { c = tinted(img, rgb, 1); cache.set(img, c); }
    return c;
  }

  // Desenha o Pokémon com os pés em (x, y). opts: flash (0..1), frozen, alpha, silhouette (cor do rastro)
  draw(g, key, anim, t, facing, x, y, scale, opts = {}) {
    if (BODY[key]?.bw && this.bw[key]) return this.drawBW(g, key, anim, t, facing, x, y, scale, opts);
    const found = this.sheet(key, anim);
    if (!found) return null;
    const { s, name } = found;
    const dir = ((Math.round(facing / (Math.PI / 4)) % 8) + 8) % 8;
    const row = ROW_FOR_DIR[dir];
    const frame = this.frameOf(s, name, t);
    const feet = this.feet[key] || { idle: s.h * 0.75, h: s.h };
    const idle = this.sheets[key].Idle || s;
    const centerToFeet = feet.idle - idle.h / 2;
    const dw = s.w * scale, dh = s.h * scale;
    const dx = Math.round(x - dw / 2);
    const dy = Math.round(y - centerToFeet * scale - dh / 2);
    this.blit(g, s.img, frame * s.w, row * s.h, s.w, s.h, dx, dy, dw, dh, false, opts);
    return { top: dy, height: dh };
  }

  // Sprite de frente (olhando para baixo) ou de costas, espelhado conforme o lado, com animação por código
  drawBW(g, key, anim, t, facing, x, y, scale, opts) {
    const bw = this.bw[key];
    const front = Math.sin(facing) > -0.3;
    const img = front ? bw.front : bw.back;
    const feet = front ? bw.feetFront : bw.feetBack;
    // de frente o sprite olha para a esquerda; de costas, para a direita
    const flip = front ? Math.cos(facing) > 0.15 : Math.cos(facing) < -0.15;
    let sx = 1, sy = 1, ox = 0, oy = 0;
    const k = Math.sin(t * 7);
    if (anim === 'Walk' || anim === 'Hop') { oy = -Math.abs(Math.sin(t * 12)) * 5; sx = 1 + 0.03 * k; }
    else if (anim === 'Attack' || anim === 'Strike' || anim === 'Swing') { const p = Math.min(1, t / 0.25); ox = Math.sin(p * Math.PI) * 14 * (flip ? 1 : -1) * (front ? 1 : -1); sx = 1 + 0.08 * Math.sin(p * Math.PI); sy = 1 - 0.06 * Math.sin(p * Math.PI); }
    else if (anim === 'Shoot' || anim === 'Charge') { sy = 1 + 0.05 * Math.sin(t * 20); sx = 1 - 0.03 * Math.sin(t * 20); }
    else if (anim === 'Hurt') { ox = Math.sin(t * 60) * 4; }
    else if (anim === 'Sleep') { sy = 0.94 + 0.03 * k; }
    else { sy = 1 + 0.025 * k; sx = 1 - 0.015 * k; }
    const dw = img.width * scale * sx, dh = img.height * scale * sy;
    const dx = Math.round(x - dw / 2 + ox);
    const dy = Math.round(y - feet * scale * sy + oy);
    this.blit(g, img, 0, 0, img.width, img.height, dx, dy, dw, dh, flip, opts);
    return { top: dy, height: dh };
  }

  blit(g, img, sx, sy, sw, sh, dx, dy, dw, dh, flip, opts) {
    g.save();
    if (opts.alpha !== undefined) g.globalAlpha *= opts.alpha;
    if (flip) { g.translate(dx + dw, dy); g.scale(-1, 1); dx = 0; dy = 0; }
    const src = opts.silhouette ? this.silhouette(this.white, img, [255, 255, 255]) : img;
    if (opts.silhouette) { g.globalAlpha *= 0.45; }
    g.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
    if (opts.flash) {
      g.globalAlpha *= opts.flash;
      g.drawImage(this.silhouette(this.white, img, [255, 255, 255]), sx, sy, sw, sh, dx, dy, dw, dh);
    }
    if (opts.frozen) {
      g.globalAlpha = 0.55;
      g.drawImage(this.silhouette(this.ice, img, [120, 210, 255]), sx, sy, sw, sh, dx, dy, dw, dh);
    }
    g.restore();
  }

  // altura aproximada na tela (para barras e textos acima da cabeça)
  height(key, scale) {
    if (BODY[key]?.bw && this.bw[key]) return this.bw[key].feetFront * scale * 0.95;
    const f = this.feet[key];
    return f ? f.idle * scale * 0.9 : 50;
  }

  // Rosto do treinador dentro de um quadrado (x, y, tamanho), olhando para a direita ou para a esquerda
  drawTrainerHead(g, id, x, y, size, faceRight) {
    const t = this.trainers[id];
    if (!t) return false;
    const { y0, y1, headX } = t.box;
    const sh = Math.max(12, (y1 - y0) * 0.36);
    const sx = Math.round(headX - sh / 2), sy = Math.max(0, y0 - 1);
    this.blit(g, t.img, sx, sy, sh, sh, x, y, size, size, faceRight, {});
    return true;
  }

  // Treinador com os pés em (x, y); olhando para a direita (lado esquerdo) ou para a esquerda
  drawTrainer(g, id, x, y, scale, faceRight, opts = {}) {
    const t = this.trainers[id];
    if (!t) return null;
    const dw = t.img.width * scale, dh = t.img.height * scale;
    const dx = Math.round(x - dw / 2), dy = Math.round(y - t.feet * scale);
    // os sprites de treinador olham para a esquerda
    this.blit(g, t.img, 0, 0, t.img.width, t.img.height, dx, dy, dw, dh, faceRight, opts);
    return { top: dy, height: dh, w: dw };
  }
}
