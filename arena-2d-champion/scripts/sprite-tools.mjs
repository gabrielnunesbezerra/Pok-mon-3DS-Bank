// Ferramentas de imagem para os sprites: reduz desenhos grandes para o tamanho de pixel do jogo
// (média das cores, transparência dura e contorno escuro como nos sprites do PMD) e anima por partes
// os desenhos 2D parados das Megas que não têm sprite PMD.
import { PNG } from 'pngjs';

function bbox(frames, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (const f of frames) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (f.data[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  return { x0, y0, x1, y1 };
}

// reduz com média (cor pesada pela transparência), transparência dura e contorno
function shrink(src, sw, box, f) {
  const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
  const dw = Math.max(1, Math.round(bw * f)), dh = Math.max(1, Math.round(bh * f));
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (let dy = 0; dy < dh; dy++) {
    for (let dx = 0; dx < dw; dx++) {
      const sx0 = box.x0 + (dx * bw) / dw, sx1 = box.x0 + ((dx + 1) * bw) / dw;
      const sy0 = box.y0 + (dy * bh) / dh, sy1 = box.y0 + ((dy + 1) * bh) / dh;
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) {
        for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
          const p = (y * sw + x) * 4;
          const al = src[p + 3] / 255;
          r += src[p] * al; g += src[p + 1] * al; b += src[p + 2] * al; a += al; n++;
        }
      }
      const o = (dy * dw + dx) * 4;
      if (n && a / n >= 0.45) {
        out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; out[o + 3] = 255;
      }
    }
  }
  // contorno escuro como nos sprites do PMD
  const solid = i => out[i * 4 + 3] === 255;
  const edge = new Uint8Array(dw * dh);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const i = y * dw + x;
    if (!solid(i)) continue;
    if (x === 0 || y === 0 || x === dw - 1 || y === dh - 1 || !solid(i - 1) || !solid(i + 1) || !solid(i - dw) || !solid(i + dw)) edge[i] = 1;
  }
  for (let i = 0; i < edge.length; i++) if (edge[i]) { out[i * 4] *= 0.42; out[i * 4 + 1] *= 0.42; out[i * 4 + 2] *= 0.48; }
  return { data: out, w: dw, h: dh };
}

// Reduz uma imagem grande (arte oficial) mantendo a proporção, com média das cores
export function downscalePng(buf, max) {
  const img = PNG.sync.read(buf);
  const f = Math.min(1, max / Math.max(img.width, img.height));
  if (f >= 1) return buf;
  const dw = Math.round(img.width * f), dh = Math.round(img.height * f);
  const png = new PNG({ width: dw, height: dh });
  for (let dy = 0; dy < dh; dy++) {
    for (let dx = 0; dx < dw; dx++) {
      const sx0 = Math.floor(dx / f), sx1 = Math.min(img.width, Math.ceil((dx + 1) / f));
      const sy0 = Math.floor(dy / f), sy1 = Math.min(img.height, Math.ceil((dy + 1) / f));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) {
        const p = (y * img.width + x) * 4;
        const al = img.data[p + 3];
        r += img.data[p] * al; g += img.data[p + 1] * al; b += img.data[p + 2] * al; a += al; n++;
      }
      const o = (dy * dw + dx) * 4;
      if (a > 0) { png.data[o] = r / a; png.data[o + 1] = g / a; png.data[o + 2] = b / a; }
      png.data[o + 3] = n ? a / n : 0;
    }
  }
  return PNG.sync.write(png);
}

// ---------------------------------------------------------------- sprite 2D parado animado por partes
// Um sprite parado (estilo Black/White) vira uma folha de animações em pixel art. Cada quadro é o
// mesmo desenho deformado por "campos" de deslocamento: o corpo respira, a parte de cima balança
// (folhas, garras), as asas batem e as patas levantam alternadas. O mapeamento é feito ao contrário
// (para cada pixel do quadro, de onde ele vem no desenho), então não sobram buracos, e os
// deslocamentos são arredondados para pixels inteiros, como numa animação feita à mão.
const clamp01 = v => Math.max(0, Math.min(1, v));

function crop(img, box) {
  const w = box.x1 - box.x0 + 1, h = box.y1 - box.y0 + 1;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const s = ((box.y0 + y) * img.width + box.x0) * 4;
    data.set(img.data.subarray(s, s + w * 4), y * w * 4);
    for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] < 128) data.fill(0, (y * w + x) * 4, (y * w + x) * 4 + 4);
    else data[(y * w + x) * 4 + 3] = 255;
  }
  return { data, w, h };
}

// Poses de cada animação. lean > 0 inclina para trás (o sprite de frente olha para a esquerda)
function poses(rig, idleFrames = 1) {
  const idle = [], walk = [];
  // desenho que já vem animado: o "parado" é a animação original, sem deformar
  if (idleFrames > 1) for (let i = 0; i < idleFrames; i++) idle.push({ frame: i, lift: [0, 0] });
  else for (let i = 0; i < 8; i++) {
    const ph = (i / 8) * Math.PI * 2;
    idle.push({ breathe: 1.1 * (1 - Math.cos(ph)) / 2, sway: 0.9 * Math.sin(ph), wing: rig.wings ? 2.2 * Math.sin(ph) : 0, bob: rig.fly ? Math.sin(ph) : 0, lift: [0, 0] });
  }
  for (let i = 0; i < 6; i++) {
    const ph = (i / 6) * Math.PI * 2;
    walk.push(rig.fly
      ? { breathe: 0.4, sway: 0.6 * Math.sin(ph), wing: 3.2 * Math.sin(ph * 2), bob: -Math.abs(Math.sin(ph)) * 1.2, lift: [0, 0] }
      : { breathe: 0.6 * Math.abs(Math.sin(ph)), sway: 0.8 * Math.sin(ph), wing: rig.wings ? 1.5 * Math.sin(ph) : 0, bob: -Math.abs(Math.sin(ph)), lift: [Math.max(0, Math.sin(ph)) * 2.2, Math.max(0, -Math.sin(ph)) * 2.2] });
  }
  const attack = [
    { breathe: 1.4, lean: 1.5, wing: -2, sway: 1 },
    { breathe: 2.4, lean: 2.6, wing: -3, sway: 1.5 },
    { breathe: -1, lean: -3, wing: 3, sway: -1.5 },
    { breathe: -1, lean: -3.4, wing: 2.5, sway: -1 },
    { breathe: 0.5, lean: -1, wing: 0.5, sway: 0 },
  ];
  const hurt = [{ breathe: 1.2, lean: 2.2, wing: -1.5 }, { breathe: 0.8, lean: 1.6, wing: -1 }, { breathe: 0.3, lean: 0.6 }];
  return {
    Idle: { frames: idle, durations: idle.map(() => (idleFrames > 1 ? 110 : 120)) },
    Walk: { frames: walk, durations: walk.map(() => 90) },
    Attack: { frames: attack, durations: [70, 80, 80, 140, 110] },
    Hurt: { frames: hurt, durations: [90, 110, 120] },
  };
}

// rig: { breathe, sway, legs (frações da altura), legBins, wings: { inner, bottom }, fly }
// back: sprite de costas (olha para a direita, então "para trás" é para a esquerda)
function renderPose(base, rig, p, k, M, W, H, back) {
  const { w, h, data } = base;
  const out = new Uint8ClampedArray(W * H * 4);
  const cx = w / 2;
  const cutB = h * rig.breathe, rampB = Math.max(3, h * 0.3);
  const cutS = h * rig.sway, rampS = Math.max(2, h * 0.2);
  const legY = h * rig.legs, rampL = Math.max(2, h - legY);
  const dirLean = back ? -1 : 1;
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const x = X - M, y = Y - M;
      let dx = (p.sway || 0) * k * clamp01((cutS - y) / rampS) + (p.lean || 0) * k * dirLean * clamp01((h - y) / h);
      let dy = (p.bob || 0) * k + (p.breathe || 0) * k * clamp01((cutB - y) / rampB);
      if (rig.wings && p.wing) {
        const out1 = clamp01((Math.abs(x - cx) - w * rig.wings.inner) / (w * 0.12));
        const reach = clamp01((Math.abs(x - cx) - w * rig.wings.inner) / (w * (0.5 - rig.wings.inner)));
        dy += p.wing * k * out1 * (0.4 + 0.6 * reach) * clamp01((h * rig.wings.bottom - y) / (h * 0.15));
      }
      if (p.lift && y > legY - rampL) {
        const bin = Math.min(rig.legBins - 1, Math.max(0, Math.floor((x / w) * rig.legBins)));
        dy -= (p.lift[bin % 2] || 0) * k * clamp01((y - legY + rampL) / rampL);
      }
      const sx = Math.round(x - dx), sy = Math.round(y - dy);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const s = (sy * w + sx) * 4;
      if (!data[s + 3]) continue;
      const d = (Y * W + X) * 4;
      out[d] = data[s]; out[d + 1] = data[s + 1]; out[d + 2] = data[s + 2]; out[d + 3] = 255;
    }
  }
  return out;
}

// Quadros de uma folha do TexturePacker (atlas JSON do PokeRogue), cada um no tamanho original
function atlasFrames(img, atlas) {
  const list = atlas?.textures?.[0]?.frames || atlas?.frames;
  if (!Array.isArray(list) || list.length < 2) return [{ data: img.data, w: img.width, h: img.height }];
  return list.map(f => {
    const { w, h } = f.sourceSize;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < f.frame.h; y++) {
      for (let x = 0; x < f.frame.w; x++) {
        const s = ((f.frame.y + y) * img.width + f.frame.x + x) * 4;
        const d = ((f.spriteSourceSize.y + y) * w + f.spriteSourceSize.x + x) * 4;
        data.set(img.data.subarray(s, s + 4), d);
      }
    }
    return { data, w, h };
  });
}

export function animateSprite(buf, { scale = 1, rig, back = false, only = null, atlas = null }) {
  const img = PNG.sync.read(buf);
  let frames = atlasFrames(img, atlas);
  // no máximo uns 24 quadros da animação original
  const step = Math.ceil(frames.length / 24);
  frames = frames.filter((_, i) => i % step === 0);
  const box = bbox(frames, frames[0].w, frames[0].h);
  const bases = frames.map(f => (scale === 1 ? crop(f.width ? f : { ...f, width: f.w, height: f.h }, box) : shrink(f.data, f.w, box, scale)));
  const base = bases[0];
  const k = Math.max(1, base.h / 40); // movimentos maiores em sprites maiores
  const M = Math.ceil(4 * k);
  const W = base.w + M * 2, H = base.h + M + 1;
  const all = poses(rig, bases.length);
  if (bases.length > 1) all.Idle.durations = all.Idle.durations.map(() => Math.round((1000 / 12) * step));
  const names = only || Object.keys(all);
  const cols = Math.max(...names.map(n => all[n].frames.length));
  const png = new PNG({ width: cols * W, height: names.length * H });
  png.data.fill(0);
  const anims = {};
  names.forEach((name, row) => {
    const a = all[name];
    a.frames.forEach((p, col) => {
      const f = renderPose(bases[p.frame ?? (name === 'Walk' ? (col * 2) % bases.length : 0)], rig, p, k, M, W, H, back);
      for (let y = 0; y < H; y++) png.data.set(f.subarray(y * W * 4, (y + 1) * W * 4), ((row * H + y) * png.width + col * W) * 4);
    });
    anims[name] = { row, durations: a.durations };
  });
  return { png: PNG.sync.write(png), meta: { w: W, h: H, feet: M + base.h, cols, anims } };
}
