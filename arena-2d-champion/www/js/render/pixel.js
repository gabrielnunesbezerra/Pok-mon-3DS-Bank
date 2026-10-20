// Camada em pixel art para os efeitos: os golpes são desenhados numa tela pequena em que cada pixel
// tem o tamanho de um pixel dos sprites, e depois ela é ampliada sem suavizar. A transparência vira
// degraus, as cores ficam chapadas e as partes sólidas ganham contorno escuro, como nos efeitos dos
// jogos 2D.
export const FX_PIXEL = 2.5; // unidades do mundo por pixel (o mesmo tamanho dos pixels dos sprites)

// cores em 9 níveis por canal
const STEP = new Uint8Array(256).map((_, v) => Math.min(255, Math.round(v / 32) * 32));

// light: partes semitransparentes são luz (brilho, energia), então não podem ficar escuras
let solidList = new Int32Array(0);
function quantize(img, light) {
  const d = img.data;
  const w = img.width, h = img.height;
  const px = new Uint32Array(d.buffer, d.byteOffset, w * h);
  if (solidList.length < w * h) solidList = new Int32Array(w * h);
  let solids = 0;
  for (let p = 0; p < px.length; p++) {
    if (px[p] === 0) continue; // a maior parte da tela é vazia
    const i = p * 4;
    const a = d[i + 3];
    if (a < 28) { px[p] = 0; continue; }
    d[i + 3] = a < 110 ? 104 : a < 200 ? 184 : 255;
    if (light && a < 200) {
      const mx = Math.max(d[i], d[i + 1], d[i + 2]);
      if (mx > 0 && mx < 220) {
        const k = Math.min(6, 230 / mx);
        d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
      }
    }
    d[i] = STEP[d[i]];
    d[i + 1] = STEP[d[i + 1]];
    d[i + 2] = STEP[d[i + 2]];
    if (a >= 200) solidList[solids++] = p;
  }
  // contorno: pixel sólido encostado em pixel vazio fica mais escuro
  for (let n = 0; n < solids; n++) {
    const p = solidList[n];
    const x = p % w;
    if ((x > 0 && px[p - 1] === 0) || (x < w - 1 && px[p + 1] === 0) || (p >= w && px[p - w] === 0) || (p < px.length - w && px[p + w] === 0)) {
      const i = p * 4;
      d[i] = d[i] * 0.45;
      d[i + 1] = d[i + 1] * 0.45;
      d[i + 2] = d[i + 2] * 0.5;
    }
  }
}

export class PixelLayer {
  constructor({ light = false } = {}) {
    this.light = light;
    this.c = document.createElement('canvas');
    this.g = this.c.getContext('2d', { willReadFrequently: true });
    // brilho somado ('lighter') vira cor chapada por cima, como num sprite
    const op = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'globalCompositeOperation');
    Object.defineProperty(this.g, 'globalCompositeOperation', {
      get() { return op.get.call(this); },
      set(v) { op.set.call(this, v === 'lighter' ? 'source-over' : v); },
    });
    this.w = 0;
    this.h = 0;
    this.P = 1;
  }

  // Começa a desenhar no mundo: mesma câmera da tela principal (R.cam, tremida sx/sy em pixels CSS)
  begin(R, sx = 0, sy = 0) {
    const P = Math.max(1, Math.round(FX_PIXEL * R.cam.z * R.dpr));
    const w = Math.ceil(R.canvas.width / P) + 1, h = Math.ceil(R.canvas.height / P) + 1;
    if (this.c.width < w || this.c.height < h) {
      this.c.width = Math.max(w, this.c.width);
      this.c.height = Math.max(h, this.c.height);
    }
    this.w = w;
    this.h = h;
    this.P = P;
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    const k = (R.cam.z * R.dpr) / P;
    g.setTransform(k, 0, 0, k, ((R.W / 2 + sx) * R.dpr) / P - R.cam.x * k, ((R.H / 2 + sy) * R.dpr) / P - R.cam.y * k);
    g.imageSmoothingEnabled = false;
    g.lineCap = 'butt';
    g.lineJoin = 'miter';
    return g;
  }

  // Passa para pixel art e cola na tela principal
  end(target) {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    const img = g.getImageData(0, 0, this.w, this.h);
    quantize(img, this.light);
    g.putImageData(img, 0, 0);
    target.save();
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.globalAlpha = 1;
    target.globalCompositeOperation = 'source-over';
    target.imageSmoothingEnabled = false;
    target.drawImage(this.c, 0, 0, this.w, this.h, 0, 0, this.w * this.P, this.h * this.P);
    target.restore();
  }
}
