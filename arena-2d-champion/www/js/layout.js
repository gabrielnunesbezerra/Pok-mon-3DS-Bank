// Onde ficam os botões e painéis na tela (em pixels CSS), para desenhar e para o toque.
// 1 jogador (e online): joystick à esquerda, golpes em arco à direita (estilo MOBA). O painel do
// lado vermelho fica sempre à esquerda e o do azul à direita; os controles vão para o lado "me".
// 2 jogadores no mesmo aparelho ("modo mesa"): jogador 1 embaixo, jogador 2 em cima, girado.
export function computeLayout(W, H, mode, me = 0) {
  const u = Math.min(W, H) / 100;
  const L = { W, H, u, mode, sides: [null, null] };
  if (mode !== '2p') {
    const cx = W - 19 * u, cy = H - 19 * u;
    const pw = Math.min(60 * u, W * 0.36);
    const controls = {
      rot: 0,
      joyZone: { x: 0, y: H * 0.28, w: W * 0.48, h: H * 0.72 },
      joyR: 12 * u,
      dodge: { x: cx, y: cy, r: 9.5 * u },
      moves: [180, 216, 252, 288].map(a => ({ x: cx + Math.cos((a * Math.PI) / 180) * 26 * u, y: cy + Math.sin((a * Math.PI) / 180) * 26 * u, r: 7.6 * u })),
      mega: { x: W - 47 * u, y: H - 53 * u, r: 7 * u },
      mash: { x: W - 22 * u, y: H - 30 * u, r: 16 * u },
    };
    L.sides[0] = { rot: 0, panel: { x: 1.5 * u, y: 1.5 * u, w: pw, h: 17 * u, flip: false } };
    L.sides[1] = { rot: 0, panel: { x: W - 1.5 * u - pw, y: 1.5 * u, w: pw, h: 17 * u, flip: true } };
    Object.assign(L.sides[me], controls);
    L.clock = { x: W / 2, y: 5.6 * u };
    L.pause = { x: W / 2 + 17 * u, y: 5.6 * u, r: 3.8 * u };
    L.weather = { x: W / 2, y: 13.4 * u };
    L.log = { x: W / 2, y: H - 4 * u, w: W * 0.4 };
  } else {
    // modo mesa: cada jogador segura um lado do aparelho
    const row = (y, x0, dir) => [0, 1, 2, 3].map(i => ({ x: x0 + dir * i * 15 * u, y, r: 7 * u }));
    const p1y = H - 9 * u, p2y = 9 * u;
    // painel encostado na fileira de golpes de cada um
    const pw = Math.min(56 * u, W - 96 * u);
    L.sides[0] = {
      rot: 0,
      joyZone: { x: 0, y: H * 0.5, w: W * 0.34, h: H * 0.5 },
      joyR: 10 * u,
      moves: row(p1y, W - 75 * u, 1),
      dodge: { x: W - 9 * u, y: p1y - 1 * u, r: 8 * u },
      mega: { x: W - 9 * u, y: p1y - 19 * u, r: 6.5 * u },
      panel: { x: W - 84 * u - pw, y: H - 18 * u, w: pw, h: 16.5 * u, flip: false },
      mash: { x: W - 30 * u, y: H - 25 * u, r: 14 * u },
    };
    L.sides[1] = {
      rot: Math.PI,
      joyZone: { x: W * 0.66, y: 0, w: W * 0.34, h: H * 0.5 },
      joyR: 10 * u,
      moves: row(p2y, 75 * u, -1),
      dodge: { x: 9 * u, y: p2y + 1 * u, r: 8 * u },
      mega: { x: 9 * u, y: p2y + 19 * u, r: 6.5 * u },
      panel: { x: 84 * u, y: 1.5 * u, w: pw, h: 16.5 * u, flip: true, rotated: true },
      mash: { x: 30 * u, y: 25 * u, r: 14 * u },
    };
    L.pause = { x: 5 * u, y: H / 2, r: 4 * u };
    L.clock = { x: W - 8 * u, y: H / 2 };
    L.weather = null;
    L.log = null;
  }
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
    const below = panel.y < 50 * u;
    out.push({ x, y: below ? panel.y + panel.h + 1 * u : panel.y - size - 1 * u, w: size, h: size });
  }
  return out;
}
