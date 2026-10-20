// Carrega os sprites PMD (8 direções) e desenha o quadro certo de cada animação.
// As Megas sem sprite próprio usam o sprite da forma normal com outra cor e um pouco maiores.
import { SPRITE_DATA } from '../data/sprites.js';
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

export class SpriteBank {
  constructor() {
    this.sheets = {};
    this.portraits = {};
    this.artwork = {};
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
      if (data.portrait) jobs.push(loadImage(data.portrait).then(img => { this.portraits[key] = img; }));
      if (data.artwork) jobs.push(loadImage(data.artwork).then(img => { this.artwork[key] = img; }));
    }
    let done = 0;
    await Promise.all(jobs.map(j => j.then(() => onProgress?.(++done / jobs.length))));
    // aliases (CopyOf) e Megas sem sprite
    for (const [key, data] of Object.entries(SPRITE_DATA)) {
      if (data.anims) for (const [name, a] of Object.entries(data.anims)) if (a.copyOf && this.sheets[key][a.copyOf]) this.sheets[key][name] = this.sheets[key][a.copyOf];
    }
    for (const [key, body] of Object.entries(BODY)) {
      if (!body.spriteFrom || this.sheets[key]) continue;
      const base = this.sheets[body.spriteFrom];
      this.sheets[key] = {};
      for (const [name, s] of Object.entries(base)) this.sheets[key][name] = { ...s, img: tinted(s.img, body.tint, 0.32) };
    }
    for (const key of Object.keys(this.sheets)) this.feet[key] = this.measureFeet(key);
  }

  // altura do "pé" dentro do quadro Idle olhando para baixo, para o Pokémon pisar no chão certo
  measureFeet(key) {
    const s = this.sheets[key].Idle || Object.values(this.sheets[key])[0];
    try {
      const c = makeCanvas(s.w, s.h);
      const g = c.getContext('2d');
      g.drawImage(s.img, 0, 0, s.w, s.h, 0, 0, s.w, s.h);
      const data = g.getImageData(0, 0, s.w, s.h).data;
      for (let y = s.h - 1; y >= 0; y--) for (let x = 0; x < s.w; x++) if (data[(y * s.w + x) * 4 + 3] > 40) return { idle: y + 1, h: s.h };
    } catch { /* imagem de outra origem: usa o meio */ }
    return { idle: s.h * 0.75, h: s.h };
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

  silhouette(cache, s, rgb) {
    let c = cache.get(s);
    if (!c) { c = tinted(s.img, rgb, 1); cache.set(s, c); }
    return c;
  }

  // Desenha o Pokémon com os pés em (x, y)
  draw(ctx, key, anim, t, facing, x, y, scale, opts = {}) {
    const found = this.sheet(key, anim);
    if (!found) return;
    const { s, name } = found;
    const dir = ((Math.round(facing / (Math.PI / 4)) % 8) + 8) % 8;
    const row = ROW_FOR_DIR[dir];
    const frame = this.frameOf(s, name, t);
    const feet = this.feet[key] || { idle: s.h * 0.75, h: s.h };
    // quadros de animações maiores (Attack etc.) são centralizados no mesmo ponto do Idle
    const idle = this.sheets[key].Idle || s;
    const centerToFeet = feet.idle - idle.h / 2;
    const dw = s.w * scale, dh = s.h * scale;
    const dx = Math.round(x - dw / 2);
    const dy = Math.round(y - centerToFeet * scale - dh / 2);
    ctx.save();
    if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
    ctx.drawImage(s.img, frame * s.w, row * s.h, s.w, s.h, dx, dy, dw, dh);
    if (opts.flash) {
      ctx.globalAlpha *= opts.flash;
      ctx.drawImage(this.silhouette(this.white, s, [255, 255, 255]), frame * s.w, row * s.h, s.w, s.h, dx, dy, dw, dh);
    }
    if (opts.frozen) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(this.silhouette(this.ice, s, [120, 210, 255]), frame * s.w, row * s.h, s.w, s.h, dx, dy, dw, dh);
    }
    ctx.restore();
    return { top: dy, height: dh };
  }

  // tamanho aproximado na tela (para barras e textos acima da cabeça)
  height(key, scale) {
    const f = this.feet[key];
    return f ? f.idle * scale * 0.9 : 50;
  }
}
