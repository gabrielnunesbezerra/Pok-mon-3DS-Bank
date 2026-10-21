// Converte um GIF animado (sprites "models" do Smogon) numa folha de quadros em pixel art:
// junta os quadros, recorta o espaço vazio, reduz o tamanho (média das cores), deixa a
// transparência dura e escurece a borda para ficar com o contorno dos sprites do PMD.
import omggif from 'omggif';
import { PNG } from 'pngjs';

const { GifReader } = omggif;

// todos os quadros já compostos (RGBA), respeitando o modo de descarte de cada quadro
export function decodeGif(buf) {
  const gif = new GifReader(new Uint8Array(buf));
  const w = gif.width, h = gif.height;
  const canvas = new Uint8ClampedArray(w * h * 4);
  const frames = [];
  for (let i = 0; i < gif.numFrames(); i++) {
    const info = gif.frameInfo(i);
    const before = info.disposal === 3 ? canvas.slice() : null;
    const layer = new Uint8ClampedArray(w * h * 4);
    gif.decodeAndBlitFrameRGBA(i, layer);
    for (let y = info.y; y < info.y + info.height; y++) {
      for (let x = info.x; x < info.x + info.width; x++) {
        const p = (y * w + x) * 4;
        if (layer[p + 3]) canvas.set(layer.subarray(p, p + 4), p);
      }
    }
    frames.push({ data: canvas.slice(), delay: (info.delay || 4) * 10 });
    if (info.disposal === 2) {
      for (let y = info.y; y < info.y + info.height; y++) canvas.fill(0, (y * w + info.x) * 4, (y * w + info.x + info.width) * 4);
    } else if (before) canvas.set(before);
  }
  return { w, h, frames };
}

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

// Folha com os quadros em grade. step = pula quadros (2 = metade dos quadros, durações somadas)
export function gifToSheet(buf, { scale, step = 2 }) {
  const { w, h, frames } = decodeGif(buf);
  const box = bbox(frames, w, h);
  const kept = [];
  for (let i = 0; i < frames.length; i += step) {
    let delay = 0;
    for (let k = i; k < Math.min(frames.length, i + step); k++) delay += frames[k].delay;
    kept.push({ ...shrink(frames[i].data, w, box, scale), delay });
  }
  const fw = Math.max(...kept.map(f => f.w)), fh = Math.max(...kept.map(f => f.h));
  const cols = Math.ceil(Math.sqrt(kept.length));
  const rows = Math.ceil(kept.length / cols);
  const png = new PNG({ width: cols * fw, height: rows * fh });
  png.data.fill(0);
  kept.forEach((f, i) => {
    const ox = (i % cols) * fw, oy = Math.floor(i / cols) * fh;
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const s = (y * f.w + x) * 4, d = ((oy + y) * png.width + ox + x) * 4;
      png.data[d] = f.data[s]; png.data[d + 1] = f.data[s + 1]; png.data[d + 2] = f.data[s + 2]; png.data[d + 3] = f.data[s + 3];
    }
  });
  // linha dos "pés": último pixel visível em qualquer quadro
  let feet = 0;
  for (const f of kept) for (let y = f.h - 1; y >= 0; y--) { let any = false; for (let x = 0; x < f.w; x++) if (f.data[(y * f.w + x) * 4 + 3]) { any = true; break; } if (any) { feet = Math.max(feet, y + 1); break; } }
  return { png: PNG.sync.write(png), meta: { w: fw, h: fh, cols, frames: kept.length, durations: kept.map(f => f.delay), feet } };
}

// Imagem parada (PNG) reduzida do mesmo jeito, para a Mega animada por partes
export function pngToSprite(buf, { scale }) {
  const img = PNG.sync.read(buf);
  const frames = [{ data: img.data, delay: 100 }];
  const box = bbox(frames, img.width, img.height);
  const f = shrink(img.data, img.width, box, scale);
  const png = new PNG({ width: f.w, height: f.h });
  png.data.set(f.data);
  return { png: PNG.sync.write(png), meta: { w: f.w, h: f.h, feet: f.h } };
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
