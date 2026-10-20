// Onde ficam os botões e painéis na tela (em pixels CSS), para desenhar e para o toque.
// Joystick à esquerda, golpes em arco à direita (estilo MOBA). O painel do lado vermelho fica
// sempre à esquerda e o do azul à direita; os controles vão para o lado "me" (no online, o convidado
// é o lado azul).
export function computeLayout(W, H, me = 0) {
  const u = Math.min(W, H) / 100;
  const L = { W, H, u, sides: [null, null] };
  const cx = W - 19 * u, cy = H - 19 * u;
  const pw = Math.min(60 * u, W * 0.36);
  const controls = {
    joyZone: { x: 0, y: H * 0.28, w: W * 0.48, h: H * 0.72 },
    joyR: 12 * u,
    dodge: { x: cx, y: cy, r: 9.5 * u },
    moves: [180, 216, 252, 288].map(a => ({ x: cx + Math.cos((a * Math.PI) / 180) * 26 * u, y: cy + Math.sin((a * Math.PI) / 180) * 26 * u, r: 7.6 * u })),
    mega: { x: W - 47 * u, y: H - 53 * u, r: 7 * u },
    mash: { x: W - 22 * u, y: H - 30 * u, r: 16 * u },
  };
  L.sides[0] = { panel: { x: 1.5 * u, y: 1.5 * u, w: pw, h: 17 * u, flip: false } };
  L.sides[1] = { panel: { x: W - 1.5 * u - pw, y: 1.5 * u, w: pw, h: 17 * u, flip: true } };
  Object.assign(L.sides[me], controls);
  L.clock = { x: W / 2, y: 5.6 * u };
  L.pause = { x: W / 2 + 17 * u, y: 5.6 * u, r: 3.8 * u };
  L.weather = { x: W / 2, y: 13.4 * u };
  L.log = { x: W / 2, y: H - 4 * u, w: W * 0.4 };
  return L;
}

export const inCircle = (c, x, y, pad = 1.15) => c && Math.hypot(x - c.x, y - c.y) <= c.r * pad;
export const inRect = (r, x, y) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Retratos do time logo abaixo do painel (tocar troca de Pokémon)
export function teamIcons(panel, u, count) {
  const size = 6.4 * u;
  const out = [];
  for (let k = 0; k < count; k++) {
    // do lado de dentro (perto do meio da tela); a etiqueta do treinador fica do lado de fora
    const x = panel.flip ? panel.x + 3 * u + k * (size + 1 * u) : panel.x + panel.w - 3 * u - (count - k) * (size + 1 * u) + 1 * u;
    out.push({ x, y: panel.y + panel.h + 1 * u, w: size, h: size });
  }
  return out;
}
