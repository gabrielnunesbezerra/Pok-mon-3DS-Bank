// Interface da batalha desenhada por cima (em pixels da tela): painéis com treinador e Pokémon,
// botões, relógio, medidor do choque de raios e as telas especiais (apresentação, Mega Evolução).
import { MOVES, TYPE_COLOR, STATUS_TAG, STATUS_COLOR, WEATHER_PT, ITEMS } from '../data/dex.js';
import { slotMove, megaTarget } from '../engine/mon.js';
import { slotBlock, staminaCost } from '../engine/actions.js';
import { STAMINA_MAX, MEGA_GAUGE_MAX, BOOST_DURATION, DODGE } from '../engine/constants.js';
import { START_INTRO } from '../engine/battle.js';
import { teamIcons } from '../layout.js';
import { shapeFor } from '../engine/shapes.js';
import { foeBeamThreat } from '../engine/ai.js';

const TAU = Math.PI * 2;
const SIDE_COLOR = ['#e8433f', '#3f7fe8'];
const SIDE_DARK = ['#5a1420', '#142a5a'];
const FONT = '"Press Start 2P", monospace';
const BODY_FONT = '"Pixelify Sans", system-ui, sans-serif';
const BLOCK_TEXT = { recarga: '', escolha: 'TRAVADO', bis: 'BIS', provocado: 'TAUNT', colete: 'VESTE', tormento: 'TORMENT', acordado: 'ACORDADO', stamina: 'STAMINA', desativado: 'BLOQ.', aprisionado: 'PRESO' };
const STAT_SHORT = { atk: 'Atq', def: 'Def', spa: 'AtE', spd: 'DfE', spe: 'Vel', accuracy: 'Pre', evasion: 'Eva' };
const COND_SHORT = { reflect: 'REF', lightscreen: 'LSC', safeguard: 'SFG', mist: 'MST', tailwind: 'VNT' };
const WEATHER_ICON = { sunnyday: '#ffb52e', desolateland: '#ff5a1f', raindance: '#4aa3ff', primordialsea: '#2f6bff', sandstorm: '#d6a756', hail: '#bfe8ff', snow: '#e8f6ff', deltastream: '#8fd8c8' };

export function drawHud(g, R, b, ui) {
  const L = ui.controls.layout;
  const u = L.u;
  g.save();
  g.textBaseline = 'middle';
  for (let i = 0; i < 2; i++) {
    const S = L.sides[i];
    if (!S?.panel) continue;
    drawPanel(g, R, b, i, S.panel, u);
    drawTeam(g, R, b, i, S.panel, u);
  }
  drawClock(g, b, L, u, ui);
  if (L.log && ui.showLog !== false) drawLog(g, b, L, u);
  for (let i = 0; i < 2; i++) if (ui.humans[i] && L.sides[i]?.moves) drawControls(g, R, b, i, L, ui);
  drawPause(g, L, u);
  if (b.clash) drawClash(g, R, b, L, ui);
  drawCinematic(g, R, b, L, ui);
  if (ui.net) drawNet(g, b, L, ui);
  g.restore();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, gg = (n >> 8) & 255, bb = n & 255;
  if (k > 0) { r += (255 - r) * k; gg += (255 - gg) * k; bb += (255 - bb) * k; } else { r *= 1 + k; gg *= 1 + k; bb *= 1 + k; }
  return `rgb(${Math.round(r)},${Math.round(gg)},${Math.round(bb)})`;
}

function outlined(g, txt, x, y, fill, stroke = 'rgba(0,0,0,0.85)', lw = 3) {
  g.lineWidth = lw;
  g.strokeStyle = stroke;
  g.strokeText(txt, x, y);
  g.fillStyle = fill;
  g.fillText(txt, x, y);
}

function fitFont(g, txt, size, maxW, font = FONT) {
  g.font = `${Math.round(size)}px ${font}`;
  const w = g.measureText(txt).width;
  if (w > maxW) g.font = `${Math.max(6, Math.floor((size * maxW) / w))}px ${font}`;
}

// barra com brilho em cima; "trail" é a parte que ainda está descendo (dano recente)
function bar(g, x, y, w, h, frac, color, trail = null) {
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  if (trail !== null && trail > frac) { g.fillStyle = '#ff5a4a'; g.fillRect(x, y, w * Math.min(1, trail), h); }
  g.fillStyle = color;
  g.fillRect(x, y, Math.max(0, w * Math.min(1, frac)), h);
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.fillRect(x, y, Math.max(0, w * Math.min(1, frac)), h * 0.4);
}

const hpColor = f => (f > 0.5 ? '#4ade5a' : f > 0.2 ? '#f5c518' : '#f04438');

function trainerName(R, i) {
  return R.bank.trainers[R.trainers?.[i]]?.name || '';
}

// ---------------------------------------------------------------- painel de cada lado
function drawPanel(g, R, b, i, P, u) {
  const side = b.sides[i];
  const m = side.active;
  const flip = P.flip;
  const slant = 3 * u;
  // fundo inclinado na ponta de dentro
  g.beginPath();
  if (!flip) { g.moveTo(P.x, P.y); g.lineTo(P.x + P.w, P.y); g.lineTo(P.x + P.w - slant, P.y + P.h); g.lineTo(P.x, P.y + P.h); }
  else { g.moveTo(P.x, P.y); g.lineTo(P.x + P.w, P.y); g.lineTo(P.x + P.w, P.y + P.h); g.lineTo(P.x + slant, P.y + P.h); }
  g.closePath();
  const grad = g.createLinearGradient(P.x, P.y, P.x, P.y + P.h);
  grad.addColorStop(0, 'rgba(26,28,58,0.93)');
  grad.addColorStop(1, 'rgba(10,11,26,0.93)');
  g.fillStyle = grad;
  g.fill();
  g.strokeStyle = SIDE_COLOR[i];
  g.lineWidth = Math.max(1.5, 0.35 * u);
  g.stroke();
  // treinador no círculo de fora, com o medidor de Mega em volta (é ele quem segura a Pedra-Chave)
  const br = 6.2 * u;
  const bx = flip ? P.x + P.w - 1.4 * u - br : P.x + 1.4 * u + br;
  const by = P.y + P.h / 2;
  drawTrainerBadge(g, R, b, i, bx, by, br, u, !flip);
  // retrato do Pokémon
  const ps = 11.6 * u;
  const px = flip ? bx - br - 1.6 * u - ps : bx + br + 1.6 * u;
  const py = P.y + (P.h - ps) / 2;
  const pg = g.createRadialGradient(px + ps / 2, py + ps / 2, 1, px + ps / 2, py + ps / 2, ps * 0.7);
  pg.addColorStop(0, shade(SIDE_COLOR[i], 0.15));
  pg.addColorStop(1, SIDE_DARK[i]);
  g.fillStyle = pg;
  g.fillRect(px, py, ps, ps);
  if (m) {
    const img = R.bank.portraits[m.species] || R.bank.portraits[m.baseSpecies];
    if (img) {
      g.save();
      if (flip) { g.translate(px + ps, py); g.scale(-1, 1); g.drawImage(img, 0, 0, ps, ps); } else g.drawImage(img, px, py, ps, ps);
      g.restore();
    }
    if (m.isMega) {
      g.strokeStyle = `hsl(${(R.time * 120) % 360},100%,70%)`;
      g.lineWidth = 0.5 * u;
      g.strokeRect(px, py, ps, ps);
    }
  }
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 1.5;
  g.strokeRect(px, py, ps, ps);

  // textos e barras
  const inner = 1.2 * u;
  const tx = flip ? P.x + slant + inner : px + ps + inner + 0.4 * u;
  const tw = flip ? px - inner - 0.4 * u - tx : P.x + P.w - slant - inner - tx;
  g.textAlign = 'left';
  if (!m) {
    g.font = `${Math.round(2.2 * u)}px ${FONT}`;
    outlined(g, side.name, tx, P.y + P.h / 2, '#fff');
    return;
  }
  // todos lutam no nível 50, então o espaço fica todo para o nome (Mega Charizard Y é comprido)
  const gender = m.gender === 'M' ? ' ♂' : m.gender === 'F' ? ' ♀' : '';
  fitFont(g, m.name + gender, 2.3 * u, tw);
  outlined(g, m.name + gender, tx, P.y + 3 * u, '#ffffff');
  // PS com a parte vermelha descendo devagar
  const frac = m.hp / m.maxhp;
  R.hudHp ||= new Map();
  const shown = R.hudHp.get(m.uid) ?? frac;
  const next = shown > frac ? Math.max(frac, shown - (R.dt || 0.016) * 0.45) : frac;
  R.hudHp.set(m.uid, next);
  bar(g, tx, P.y + 5.2 * u, tw, 2.6 * u, frac, hpColor(frac), next);
  g.font = `${Math.round(1.5 * u)}px ${FONT}`;
  outlined(g, `${Math.ceil(m.hp)}/${m.maxhp}`, tx, P.y + 9.6 * u, '#ffffff', 'rgba(0,0,0,0.8)', 2.5);
  // stamina com marcas a cada esquiva
  const sx = tx + tw * 0.46, sw = tw * 0.54;
  bar(g, sx, P.y + 9 * u, sw, 1.3 * u, m.stamina / STAMINA_MAX, m.stamina >= DODGE.cost ? '#ffd84a' : '#b88a2a');
  g.fillStyle = 'rgba(0,0,0,0.55)';
  for (let k = DODGE.cost; k < STAMINA_MAX; k += DODGE.cost) g.fillRect(sx + (sw * k) / STAMINA_MAX, P.y + 9 * u, 1, 1.3 * u);
  // linha de chips: status, atributos (com tempo) e proteções do lado
  drawChips(g, R, b, side, m, tx, P.y + 12.6 * u, tw, u);
}

function drawTrainerBadge(g, R, b, i, x, y, r, u, faceRight) {
  const side = b.sides[i];
  g.save();
  g.beginPath(); g.arc(x, y, r, 0, TAU);
  const bg = g.createRadialGradient(x, y - r * 0.3, 1, x, y, r);
  bg.addColorStop(0, shade(SIDE_COLOR[i], 0.35));
  bg.addColorStop(1, SIDE_DARK[i]);
  g.fillStyle = bg;
  g.fill();
  g.clip();
  const s = r * 2.05;
  if (!R.bank.drawTrainerHead(g, R.trainers?.[i], x - s / 2, y - s / 2 + r * 0.08, s, faceRight)) {
    g.fillStyle = '#fff'; g.font = `${Math.round(r * 0.8)}px ${FONT}`; g.textAlign = 'center'; g.fillText(i === 0 ? 'P1' : 'P2', x, y);
  }
  g.restore();
  // anel da Mega
  const hasStone = side.mons.some(mm => ITEMS[mm.item]?.mega && ITEMS[mm.item].mega.from === mm.baseSpecies);
  g.lineWidth = Math.max(2, 0.75 * u);
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.beginPath(); g.arc(x, y, r + 0.3 * u, 0, TAU); g.stroke();
  if (hasStone) {
    const frac = side.megaUsed ? 1 : side.megaGauge / MEGA_GAUGE_MAX;
    const ready = !side.megaUsed && frac >= 1;
    g.strokeStyle = side.megaUsed ? '#8a6a9a' : ready ? `hsl(${(R.time * 300) % 360},100%,65%)` : '#ff6fd8';
    g.beginPath(); g.arc(x, y, r + 0.3 * u, -Math.PI / 2, -Math.PI / 2 + TAU * frac); g.stroke();
    if (ready) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.35 + 0.25 * Math.sin(R.time * 8);
      g.lineWidth = 1.6 * u;
      g.beginPath(); g.arc(x, y, r + 0.6 * u, 0, TAU); g.stroke();
      g.restore();
    }
    // Pedra-Chave
    const kx = x + r * 0.72 * (faceRight ? 1 : -1), ky = y + r * 0.72, kr = 1.5 * u;
    const kg = g.createRadialGradient(kx - kr * 0.3, ky - kr * 0.3, 0.5, kx, ky, kr);
    kg.addColorStop(0, '#ffffff');
    kg.addColorStop(0.5, side.megaUsed ? '#9a8aa8' : `hsl(${(R.time * 200) % 360},90%,65%)`);
    kg.addColorStop(1, '#3a2a4a');
    g.fillStyle = kg;
    g.beginPath(); g.arc(kx, ky, kr, 0, TAU); g.fill();
    g.strokeStyle = '#d8d8e8'; g.lineWidth = 1.2; g.stroke();
  } else {
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(x, y, r + 0.3 * u, 0, TAU); g.stroke();
  }
}

function drawChips(g, R, b, side, m, x, y, w, u) {
  const chips = [];
  if (m.status) chips.push({ text: STATUS_TAG[m.status], bg: STATUS_COLOR[m.status] });
  if (m.vol.confusion) chips.push({ text: 'CNF', bg: '#b8962a' });
  if (m.vol.leechseed) chips.push({ text: 'SEM', bg: '#3f8f3a' });
  if (m.vol.substitute) chips.push({ text: 'SUB', bg: '#8a6a3a' });
  if (m.vol.perish) chips.push({ text: `FIM ${Math.ceil(m.vol.perish.t / 4)}`, bg: '#8a3a8a' });
  for (const [k, v] of Object.entries(m.boosts)) {
    if (!v) continue;
    chips.push({ text: `${STAT_SHORT[k]}${v > 0 ? '+' : ''}${v}`, bg: v > 0 ? '#b8452e' : '#2e5fb8', timer: Math.min(1, (m.boostClock[k] || 0) / BOOST_DURATION) });
  }
  for (const [k, v] of Object.entries(side.conds)) if (v > 0 && COND_SHORT[k]) chips.push({ text: COND_SHORT[k], bg: '#1f8a7a' });
  g.font = `${Math.round(1.35 * u)}px ${FONT}`;
  g.textAlign = 'left';
  const h = 2.5 * u;
  let cx = x;
  for (const c of chips) {
    const cw = g.measureText(c.text).width + 1.2 * u;
    if (cx + cw > x + w) break;
    roundRect(g, cx, y - h / 2, cw, h, 0.6 * u);
    g.fillStyle = c.bg;
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillText(c.text, cx + 0.6 * u, y + 0.1 * u);
    if (c.timer !== undefined) {
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(cx + 0.4 * u, y + h / 2 - 0.55 * u, cw - 0.8 * u, 0.35 * u);
      g.fillStyle = '#ffffff';
      g.fillRect(cx + 0.4 * u, y + h / 2 - 0.55 * u, (cw - 0.8 * u) * c.timer, 0.35 * u);
    }
    cx += cw + 0.6 * u;
  }
}

// time abaixo do painel (tocar troca de Pokémon) e nome do treinador
function drawTeam(g, R, b, i, P, u) {
  const side = b.sides[i];
  const m = side.active;
  const icons = teamIcons(P, u, side.mons.length);
  side.mons.forEach((mon, k) => {
    const r = icons[k];
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    g.beginPath(); g.arc(cx, cy, r.w / 2, 0, TAU);
    g.fillStyle = mon === m ? 'rgba(255,255,255,0.32)' : 'rgba(14,16,34,0.85)';
    g.fill();
    g.save();
    g.clip();
    const img = R.bank.portraits[mon.isMega ? mon.species : mon.baseSpecies];
    if (img) {
      g.globalAlpha = mon.fainted ? 0.25 : 1;
      g.drawImage(img, r.x, r.y, r.w, r.h);
      g.globalAlpha = 1;
    }
    if (mon !== m && !mon.fainted && side.switchCd > 0) { g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(r.x, r.y, r.w, r.h * Math.min(1, side.switchCd / 3)); }
    g.restore();
    g.lineWidth = mon === m ? 2.5 : 1.5;
    g.strokeStyle = mon === m ? SIDE_COLOR[i] : 'rgba(255,255,255,0.4)';
    g.beginPath(); g.arc(cx, cy, r.w / 2, 0, TAU); g.stroke();
    if (!mon.fainted) {
      const f = mon.hp / mon.maxhp;
      g.strokeStyle = hpColor(f);
      g.lineWidth = 0.5 * u;
      g.beginPath(); g.arc(cx, cy, r.w / 2 + 0.45 * u, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * f); g.stroke();
    } else {
      g.strokeStyle = '#f04438'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(r.x + r.w * 0.2, r.y + r.h * 0.2); g.lineTo(r.x + r.w * 0.8, r.y + r.h * 0.8); g.stroke();
    }
  });
  // etiqueta com o nome do treinador do lado de fora
  const name = trainerName(R, i) || side.name;
  if (!name || !icons.length) return;
  g.font = `${Math.round(1.5 * u)}px ${FONT}`;
  const w = g.measureText(name.toUpperCase()).width + 2 * u;
  const y = icons[0].y + 0.6 * u;
  const x = P.flip ? P.x + P.w - w : P.x;
  roundRect(g, x, y, w, 3.4 * u, 0.8 * u);
  g.fillStyle = SIDE_DARK[i];
  g.fill();
  g.strokeStyle = SIDE_COLOR[i]; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = '#ffffff';
  g.textAlign = 'left';
  g.fillText(name.toUpperCase(), x + u, y + 1.8 * u);
}

// ---------------------------------------------------------------- relógio e clima
function drawClock(g, b, L, u, ui) {
  const left = Math.max(0, b.timeLimit - b.time);
  const mm = Math.floor(left / 60), ss = Math.floor(left % 60);
  const { x, y } = L.clock;
  g.save();
  const txt = `${mm}:${String(ss).padStart(2, '0')}`;
  g.font = `${Math.round(3 * u)}px ${FONT}`;
  const w = g.measureText(txt).width + 4 * u;
  roundRect(g, x - w / 2, y - 3.6 * u, w, 7.2 * u, 3.6 * u);
  g.fillStyle = 'rgba(12,13,30,0.88)';
  g.fill();
  g.strokeStyle = left < 30 ? '#ff6b5a' : 'rgba(255,255,255,0.6)';
  g.lineWidth = 2;
  g.stroke();
  g.textAlign = 'center';
  g.fillStyle = left < 30 ? '#ff6b5a' : '#ffffff';
  g.fillText(txt, x, y + 0.3 * u);
  const wthr = b.field.weather;
  const parts = [];
  if (wthr) parts.push({ text: `${WEATHER_PT[wthr.id]} ${Math.ceil(wthr.t)}s`, color: WEATHER_ICON[wthr.id] || '#ffe58a' });
  if (b.field.terrain) parts.push({ text: `Grama ${Math.ceil(b.field.terrain.t)}s`, color: '#7ad85a' });
  if (b.field.trickroom > 0) parts.push({ text: `Trick Room ${Math.ceil(b.field.trickroom)}s`, color: '#ff8ae8' });
  if (b.field.wonderroom > 0) parts.push({ text: `Wonder Room ${Math.ceil(b.field.wonderroom)}s`, color: '#8ae8ff' });
  if (b.field.storm > 0) parts.push({ text: 'Raios!', color: '#fff27a' });
  const wy = L.weather ? L.weather.y : y + 7 * u;
  g.font = `${Math.round(1.5 * u)}px ${FONT}`;
  parts.forEach((p, k) => {
    const pw = g.measureText(p.text).width + 4 * u;
    const py = wy + k * 3.8 * u;
    roundRect(g, x - pw / 2, py - 1.6 * u, pw, 3.2 * u, 1.6 * u);
    g.fillStyle = 'rgba(12,13,30,0.85)';
    g.fill();
    g.fillStyle = p.color;
    g.beginPath(); g.arc(x - pw / 2 + 1.6 * u, py, 0.8 * u, 0, TAU); g.fill();
    g.fillText(p.text, x + 0.8 * u, py + 0.15 * u);
  });
  g.restore();
  g.textAlign = 'left';
  void ui;
}

function drawLog(g, b, L, u) {
  const lines = b.log.filter(l => b.time - l.at < 3.5).slice(-2);
  g.textAlign = 'center';
  g.font = `${Math.round(3 * u)}px ${BODY_FONT}`;
  lines.forEach((l, k) => {
    const a = Math.min(1, (3.5 - (b.time - l.at)) / 0.6);
    const y = L.log.y - (lines.length - 1 - k) * 4.2 * u;
    const text = noLigature(l.text);
    const w = Math.min(L.W * 0.5, g.measureText(text).width + 4 * u);
    g.globalAlpha = a * 0.85;
    roundRect(g, L.log.x - w / 2, y - 2 * u, w, 4 * u, 2 * u);
    g.fillStyle = 'rgba(10,12,28,0.8)';
    g.fill();
    g.globalAlpha = a;
    g.fillStyle = '#fff';
    g.fillText(text, L.log.x, y + 0.2 * u, L.W * 0.5);
  });
  g.globalAlpha = 1;
  g.textAlign = 'left';
}

// a Pixelify Sans junta "fi" e "fl" num glifo que não veio no arquivo da fonte
const noLigature = t => t.replace(/f(?=[il])/g, 'f‌');

function shortName(name) {
  if (name.length <= 12) return name;
  const parts = name.split(/[\s-]/);
  return parts.length > 1 ? parts.map((p, i) => (i === parts.length - 1 ? p : p[0] + '.')).join(' ').slice(0, 12) : name.slice(0, 11) + '.';
}

// ---------------------------------------------------------------- botões
function bolt(g, x, y, s) {
  g.beginPath();
  g.moveTo(x + 0.15 * s, y - 0.5 * s);
  g.lineTo(x - 0.3 * s, y + 0.08 * s);
  g.lineTo(x - 0.02 * s, y + 0.08 * s);
  g.lineTo(x - 0.15 * s, y + 0.5 * s);
  g.lineTo(x + 0.3 * s, y - 0.08 * s);
  g.lineTo(x + 0.02 * s, y - 0.08 * s);
  g.closePath();
  g.fill();
}

function drawMoveButton(g, b, m, k, c, ctl, i, beamIncoming, u, time) {
  const id = slotMove(m, k);
  if (!id) return;
  const mv = MOVES[id];
  const block = m.onField ? slotBlock(b, m, k) : 'recarga';
  const s = m.moves[k];
  const aiming = ctl.aim[i]?.slot === k;
  const answer = beamIncoming && shapeFor(id).kind === 'beam' && !block;
  const col = TYPE_COLOR[mv.type];
  const r = c.r * (aiming ? 1.12 : 1);
  g.globalAlpha = block && block !== 'recarga' ? 0.55 : 1;
  // sombra e aro escuro
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.beginPath(); g.arc(0, 0.25 * u, r + 0.5 * u, 0, TAU); g.fill();
  const grd = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  grd.addColorStop(0, shade(col, 0.35));
  grd.addColorStop(0.7, col);
  grd.addColorStop(1, shade(col, -0.35));
  g.fillStyle = grd;
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = Math.max(1.5, 0.3 * u);
  g.beginPath(); g.arc(0, 0, r - 0.35 * u, 0, TAU); g.stroke();
  // categoria (físico, especial, status) numa marquinha em cima
  const catColor = mv.cat === 'Physical' ? '#ff8a3a' : mv.cat === 'Special' ? '#5aa0ff' : '#c8c8c8';
  g.fillStyle = catColor;
  g.beginPath(); g.arc(0, -r + 0.9 * u, 0.7 * u, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; g.stroke();
  // recarga
  const cdFrac = Math.max(s.cd / (s.cdMax || 1), m.gcd > 0 ? m.gcd / (m.gcdMax || 1) : 0);
  if (cdFrac > 0) {
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * cdFrac); g.closePath(); g.fill();
  }
  g.globalAlpha = 1;
  if (answer) {
    g.strokeStyle = `hsl(${(time * 330) % 360},100%,65%)`;
    g.lineWidth = 0.9 * u;
    g.beginPath(); g.arc(0, 0, r + 1.2 * u + Math.sin(time * 16) * 0.5 * u, 0, TAU); g.stroke();
  }
  g.textAlign = 'center';
  const label = shortName(mv.name);
  const words = label.split(' ');
  const two = words.length > 1 && label.length > 7;
  const longest = two ? Math.max(words[0].length, words.slice(1).join(' ').length) : label.length;
  g.font = `${Math.round(Math.max(6, Math.min(r * 0.27, (r * 1.75) / longest)))}px ${FONT}`;
  if (two) {
    outlined(g, words[0], 0, -r * 0.16, '#fff', 'rgba(0,0,0,0.75)', 3);
    outlined(g, words.slice(1).join(' '), 0, r * 0.2, '#fff', 'rgba(0,0,0,0.75)', 3);
  } else outlined(g, label, 0, 0, '#fff', 'rgba(0,0,0,0.75)', 3);
  if (s.cd > 0.05) {
    g.font = `${Math.round(r * 0.3)}px ${FONT}`;
    outlined(g, s.cd.toFixed(1), 0, r * 0.62, '#ffe58a', 'rgba(0,0,0,0.8)', 3);
  } else if (block && BLOCK_TEXT[block]) {
    g.font = `${Math.round(r * 0.19)}px ${FONT}`;
    outlined(g, BLOCK_TEXT[block], 0, r * 0.62, '#ffb0a8', 'rgba(0,0,0,0.8)', 3);
  } else {
    const cost = String(staminaCost(b, m, mv));
    g.font = `${Math.round(r * 0.21)}px ${FONT}`;
    const tw = g.measureText(cost).width;
    g.fillStyle = '#ffd84a';
    bolt(g, -tw / 2 - r * 0.1, r * 0.62, r * 0.26);
    outlined(g, cost, r * 0.1, r * 0.63, '#fff', 'rgba(0,0,0,0.8)', 2.5);
  }
}

function drawControls(g, R, b, i, L, ui) {
  const S = L.sides[i];
  const u = L.u;
  const m = b.sides[i].active;
  const ctl = ui.controls;
  const time = R.time;
  // joystick
  const j = ctl.joy[i];
  if (j) {
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath(); g.arc(j.bx, j.by, S.joyR, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.stroke();
    const dx = j.x - j.bx, dy = j.y - j.by, d = Math.hypot(dx, dy);
    const k = d > S.joyR ? S.joyR / d : 1;
    const kg = g.createRadialGradient(j.bx + dx * k - S.joyR * 0.15, j.by + dy * k - S.joyR * 0.15, 1, j.bx + dx * k, j.by + dy * k, S.joyR * 0.45);
    kg.addColorStop(0, 'rgba(255,255,255,0.85)');
    kg.addColorStop(1, 'rgba(200,205,230,0.55)');
    g.fillStyle = kg;
    g.beginPath(); g.arc(j.bx + dx * k, j.by + dy * k, S.joyR * 0.45, 0, TAU); g.fill();
  } else if (ui.touchHints) {
    const z = S.joyZone;
    const cx = z.x + S.joyR * 1.6;
    const cy = z.y + z.h - S.joyR * 1.6;
    g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, S.joyR, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath(); g.arc(cx, cy, S.joyR * 0.45, 0, TAU); g.fill();
  }
  if (!m) return;
  const foe = b.foeActive(m);
  const beamIncoming = foe && m.onField && foeBeamThreat(b, foe);
  if (beamIncoming && m.moves.some((_, k) => shapeFor(slotMove(m, k)).kind === 'beam' && !slotBlock(b, m, k))) {
    g.save();
    g.translate(S.dodge.x - 22 * u, S.dodge.y - 36 * u);
    g.font = `${Math.round(2.2 * u)}px ${FONT}`;
    g.textAlign = 'center';
    outlined(g, 'RESPONDA COM UM RAIO!', 0, 0, '#ffe14a', '#000', 4);
    g.restore();
  }
  for (let k = 0; k < S.moves.length; k++) {
    const c = S.moves[k];
    g.save();
    g.translate(c.x, c.y);
    drawMoveButton(g, b, m, k, c, ctl, i, beamIncoming, u, time);
    g.restore();
  }
  // esquiva (dash) com anel de stamina
  const d = S.dodge;
  g.save();
  g.translate(d.x, d.y);
  const ready = m.dodgeCd <= 0 && m.stamina >= DODGE.cost;
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.beginPath(); g.arc(0, 0.3 * u, d.r + 0.5 * u, 0, TAU); g.fill();
  const dg = g.createRadialGradient(-d.r * 0.3, -d.r * 0.35, 1, 0, 0, d.r);
  dg.addColorStop(0, ready ? '#ffffff' : '#9a9ab0');
  dg.addColorStop(1, ready ? '#b8c4e8' : '#55556a');
  g.fillStyle = dg;
  g.beginPath(); g.arc(0, 0, d.r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 0.9 * u;
  g.beginPath(); g.arc(0, 0, d.r + 0.9 * u, 0, TAU); g.stroke();
  g.strokeStyle = '#ffd84a';
  g.beginPath(); g.arc(0, 0, d.r + 0.9 * u, -Math.PI / 2, -Math.PI / 2 + TAU * (m.stamina / STAMINA_MAX)); g.stroke();
  // setas de dash
  g.fillStyle = '#1b1d36';
  for (let n = 0; n < 2; n++) {
    const ox = -d.r * 0.22 + n * d.r * 0.3;
    g.beginPath();
    g.moveTo(ox - d.r * 0.12, -d.r * 0.42); g.lineTo(ox + d.r * 0.12, -d.r * 0.27); g.lineTo(ox - d.r * 0.12, -d.r * 0.12);
    g.lineTo(ox - d.r * 0.04, -d.r * 0.27);
    g.closePath(); g.fill();
  }
  g.textAlign = 'center';
  g.font = `${Math.round(d.r * 0.24)}px ${FONT}`;
  g.fillText('ESQUIVA', 0, d.r * 0.18);
  g.restore();
  // Mega
  const M = S.mega;
  const side = b.sides[i];
  const can = b.canMega(i);
  const respond = b.cinematic?.type === 'mega' && b.cinematic.sides[0] !== i && b.canMega(i, true);
  const hasMega = m && megaTarget(m) && !side.megaUsed;
  if (hasMega) {
    g.save();
    g.translate(M.x, M.y);
    const live = can || respond;
    const pulse = live ? 1 + 0.08 * Math.sin(time * 11) : 1;
    g.globalAlpha = live ? 1 : 0.6;
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath(); g.arc(0, 0.3 * u, M.r * pulse + 0.5 * u, 0, TAU); g.fill();
    if (live && g.createConicGradient) {
      const cg = g.createConicGradient(time * 3, 0, 0);
      for (let k = 0; k <= 6; k++) cg.addColorStop(k / 6, `hsl(${k * 60},95%,62%)`);
      g.fillStyle = cg;
    } else g.fillStyle = live ? `hsl(${(time * 200) % 360},90%,60%)` : '#4a4a66';
    g.beginPath(); g.arc(0, 0, M.r * pulse, 0, TAU); g.fill();
    // símbolo da Mega Evolução (gota com a hélice)
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.beginPath(); g.arc(0, -M.r * 0.05, M.r * 0.52, 0, TAU); g.fill();
    g.strokeStyle = live ? '#7a2a9a' : '#555';
    g.lineWidth = Math.max(1.5, M.r * 0.1);
    g.beginPath();
    g.arc(-M.r * 0.08, -M.r * 0.05, M.r * 0.3, -2.4, 0.9);
    g.moveTo(M.r * 0.1, M.r * 0.12);
    g.arc(M.r * 0.08, -M.r * 0.05, M.r * 0.18, 1.2, 4.2);
    g.stroke();
    g.strokeStyle = '#ff6fd8';
    g.lineWidth = 0.7 * u;
    g.beginPath(); g.arc(0, 0, M.r + 0.8 * u, -Math.PI / 2, -Math.PI / 2 + TAU * (side.megaGauge / MEGA_GAUGE_MAX)); g.stroke();
    g.textAlign = 'center';
    g.font = `${Math.round(M.r * 0.24)}px ${FONT}`;
    outlined(g, respond ? 'JÁ!' : 'MEGA', 0, M.r * 0.72, '#ffffff', '#000', 3);
    g.restore();
  }
  // aviso rápido (sem stamina, não pode trocar...)
  const fb = side.feedback;
  if (fb && b.time - fb.at < 0.8 && fb.reason !== 'recarga') {
    const txt = { stamina: 'Sem stamina!', troca: 'Não dá para trocar agora!', mega: 'Mega ainda não está pronta', dormindo: 'Está dormindo!', congelado: 'Está congelado!', escolha: 'Travado pelo item Choice', bis: 'Preso no Encore', provocado: 'Provocado (Taunt)', colete: 'Assault Vest: só ataques', tormento: 'Não pode repetir (Torment)', acordado: 'Só funciona dormindo', desativado: 'Golpe bloqueado (Disable)', aprisionado: 'Golpe preso (Imprison)' }[fb.reason];
    if (txt) {
      g.save();
      const cx = S.dodge.x - 20 * u, cy = S.dodge.y - 30 * u;
      g.translate(cx, cy);
      g.font = `${Math.round(2.2 * u)}px ${FONT}`;
      g.textAlign = 'center';
      const w = g.measureText(txt).width + 3 * u;
      roundRect(g, -w / 2, -2.4 * u, w, 4.8 * u, 2.4 * u);
      g.fillStyle = 'rgba(0,0,0,0.7)';
      g.fill();
      g.fillStyle = '#ffb0a8';
      g.fillText(txt, 0, 0);
      g.restore();
    }
  }
}

function drawPause(g, L, u) {
  const p = L.pause;
  g.fillStyle = 'rgba(12,13,30,0.85)';
  g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#fff';
  g.fillRect(p.x - p.r * 0.36, p.y - p.r * 0.4, p.r * 0.24, p.r * 0.8);
  g.fillRect(p.x + p.r * 0.12, p.y - p.r * 0.4, p.r * 0.24, p.r * 0.8);
  void u;
}

// ---------------------------------------------------------------- choque de raios
function drawClash(g, R, b, L, ui) {
  const c = b.clash;
  const u = L.u;
  const W = L.W;
  const bw = W * 0.5, bh = 3.5 * u;
  const x = (W - bw) / 2, y = 24 * u;
  const k = (c.meter + 1) / 2;
  roundRect(g, x - u, y - u, bw + 2 * u, bh + 2 * u, u);
  g.fillStyle = 'rgba(0,0,0,0.7)';
  g.fill();
  g.fillStyle = SIDE_COLOR[0];
  g.fillRect(x, y, bw * k, bh);
  g.fillStyle = SIDE_COLOR[1];
  g.fillRect(x + bw * k, y, bw * (1 - k), bh);
  g.fillStyle = '#fff';
  g.fillRect(x + bw * k - u * 0.5, y - u, u, bh + 2 * u);
  g.textAlign = 'center';
  g.font = `${Math.round(3.6 * u)}px ${FONT}`;
  const pulse = 1 + 0.1 * Math.sin(R.time * 16);
  if (c.result === null) {
    g.save();
    g.translate(W / 2, y + 9 * u);
    g.scale(pulse, pulse);
    outlined(g, 'CHOQUE DE RAIOS! TOQUE RÁPIDO!', 0, 0, '#ffe14a', '#000', 4);
    g.restore();
    for (let i = 0; i < 2; i++) {
      if (!ui.humans[i]) continue;
      const S = L.sides[i];
      const mb = S.mash;
      if (!mb) continue;
      g.save();
      g.translate(mb.x, mb.y);
      g.scale(pulse, pulse);
      g.fillStyle = SIDE_COLOR[i];
      g.globalAlpha = 0.9;
      g.beginPath(); g.arc(0, 0, mb.r, 0, TAU); g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
      g.font = `${Math.round(mb.r * 0.28)}px ${FONT}`;
      outlined(g, 'TOQUE!', 0, 0, '#fff', '#000', 3);
      g.restore();
    }
  } else {
    const txt = c.result === 'draw' ? 'EMPATE!' : `${b.sides[c.result].name.toUpperCase()} VENCEU O CHOQUE!`;
    outlined(g, txt, W / 2, y + 9 * u, '#fff', '#000', 4);
  }
  g.textAlign = 'left';
}

function bigText(g, txt, x, y, size, color = '#fff') {
  g.font = `${Math.round(size)}px ${FONT}`;
  g.textAlign = 'center';
  outlined(g, txt, x, y, color, '#000', Math.max(4, size / 5));
}

// ---------------------------------------------------------------- telas especiais
function drawIntro(g, R, b, L, c) {
  const u = L.u, W = L.W, H = L.H;
  const t = c.t;
  const out = Math.max(0, (t - (START_INTRO - 0.3)) / 0.3);
  const k = Math.min(1, t / 0.28);
  g.save();
  g.globalAlpha = 1 - out;
  g.fillStyle = 'rgba(6,6,18,0.7)';
  g.fillRect(0, 0, W, H);
  // faixas diagonais de cada lado
  for (let i = 0; i < 2; i++) {
    const dir = i === 0 ? -1 : 1;
    const off = (1 - k) * W * 0.6 * dir;
    g.save();
    g.translate(off, 0);
    g.beginPath();
    if (i === 0) { g.moveTo(0, 0); g.lineTo(W * 0.56, 0); g.lineTo(W * 0.44, H); g.lineTo(0, H); }
    else { g.moveTo(W * 0.56, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(W * 0.44, H); }
    g.closePath();
    const gr = g.createLinearGradient(i === 0 ? 0 : W, 0, W / 2, 0);
    gr.addColorStop(0, SIDE_DARK[i]);
    gr.addColorStop(1, SIDE_COLOR[i]);
    g.fillStyle = gr;
    g.globalAlpha = (1 - out) * 0.9;
    g.fill();
    // linhas de velocidade
    g.globalAlpha = (1 - out) * 0.25;
    g.fillStyle = '#ffffff';
    for (let n = 0; n < 8; n++) {
      const ly = ((n * 97 + t * 900 * (i === 0 ? 1 : -1)) % H + H) % H;
      g.fillRect(i === 0 ? 0 : W * 0.5, ly, W * 0.5, 2);
    }
    g.restore();
    // treinador grande
    const tr = R.bank.trainers[R.trainers?.[i]];
    if (tr) {
      const scale = Math.max(1, Math.floor((H * 0.62) / tr.img.height * 2) / 2);
      const tx = (i === 0 ? W * 0.2 : W * 0.8) + off * 1.3;
      g.globalAlpha = 1 - out;
      R.bank.drawTrainer(g, R.trainers[i], tx, H * 0.86, scale, i === 0);
    }
    // nome do treinador e o time, em cima de cada um
    const nx = (i === 0 ? W * 0.22 : W * 0.78) + off;
    g.globalAlpha = 1 - out;
    g.textAlign = 'center';
    fitFont(g, (tr?.name || b.sides[i].name).toUpperCase(), 3.4 * u, W * 0.4);
    outlined(g, (tr?.name || b.sides[i].name).toUpperCase(), nx, H * 0.08, '#ffffff', '#000', 5);
    const roster = b.sides[i].mons.map(m => m.name).join(' · ');
    fitFont(g, roster, 1.8 * u, W * 0.4);
    outlined(g, roster, nx, H * 0.16, '#ffe58a', '#000', 4);
  }
  g.globalAlpha = 1 - out;
  const vs = 1 + Math.max(0, 0.6 - t) * 1.2;
  bigText(g, 'VS', W / 2, H * 0.55, 11 * u * vs, '#ffe14a');
  g.restore();
}

function drawMegaCutIn(g, R, b, L, side, t) {
  const u = L.u, W = L.W, H = L.H;
  const show = 1.5;
  if (t > show) return;
  const inK = Math.min(1, t / 0.22), outK = Math.max(0, (t - (show - 0.25)) / 0.25);
  const dir = side === 0 ? -1 : 1;
  const y0 = H * 0.56, bh = H * 0.3;
  g.save();
  g.translate(dir * W * (1 - inK) + dir * W * outK, 0);
  const gr = g.createLinearGradient(0, y0, W, y0);
  gr.addColorStop(side === 0 ? 0 : 1, SIDE_COLOR[side]);
  gr.addColorStop(side === 0 ? 1 : 0, 'rgba(40,0,60,0.95)');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(0, y0 + 2 * u); g.lineTo(W, y0 - 2 * u); g.lineTo(W, y0 + bh - 2 * u); g.lineTo(0, y0 + bh + 2 * u); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.3)';
  for (let n = 0; n < 7; n++) {
    const lx = ((n * 173 + t * 1600 * -dir) % W + W) % W;
    g.fillRect(lx, y0 + (n % 3) * bh * 0.3 + 0.1 * bh, W * 0.12, 2);
  }
  const tr = R.bank.trainers[R.trainers?.[side]];
  const tx = side === 0 ? W * 0.16 : W * 0.84;
  if (tr) {
    const scale = Math.max(1, Math.floor(((bh * 1.25) / tr.img.height) * 2) / 2);
    g.save();
    g.beginPath(); g.rect(0, y0 - bh * 0.35, W, bh * 1.35 + 2 * u); g.clip();
    R.bank.drawTrainer(g, R.trainers[side], tx, y0 + bh + 1.5 * u, scale, side === 0);
    g.restore();
    // brilho da Pedra-Chave
    const kx = tx + (side === 0 ? 1 : -1) * tr.img.width * scale * 0.2, ky = y0 + bh * 0.42;
    g.globalCompositeOperation = 'lighter';
    const kg = g.createRadialGradient(kx, ky, 1, kx, ky, 8 * u);
    kg.addColorStop(0, `hsla(${(R.time * 400) % 360},100%,85%,1)`);
    kg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = kg;
    g.beginPath(); g.arc(kx, ky, 8 * u, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  const m = b.sides[side].active;
  const textX = side === 0 ? W * 0.58 : W * 0.42;
  g.textAlign = 'center';
  g.font = `${Math.round(2.4 * u)}px ${FONT}`;
  const who = tr?.name || b.sides[side].name;
  outlined(g, m ? `${who}: ${m.name}, Mega Evolua!` : who, textX, y0 + bh * 0.68, '#ffffff', '#000', 4);
  g.restore();
}

function drawCinematic(g, R, b, L, ui) {
  const c = b.cinematic;
  const u = L.u, W = L.W, H = L.H;
  if (c?.type === 'start') {
    if (c.t < START_INTRO) drawIntro(g, R, b, L, c);
    else {
      const left = c.dur - c.t;
      const txt = left > 1.5 ? '3' : left > 0.9 ? '2' : left > 0.35 ? '1' : 'LUTEM!';
      if (R.lastCount !== txt) { R.lastCount = txt; R.sound.play(txt === 'LUTEM!' ? 'go' : 'countdown'); }
      const k = 1 + (((c.t * 1.6) % 1) * 0.3);
      bigText(g, txt, W / 2, H / 2, 12 * u * k, txt === 'LUTEM!' ? '#ffe14a' : '#ffffff');
    }
  } else R.lastCount = null;
  if (c?.type === 'mega') {
    drawMegaCutIn(g, R, b, L, c.sides[0], c.t);
    bigText(g, 'MEGA EVOLUÇÃO!', W / 2, H * 0.24, 6 * u, `hsl(${(R.time * 250) % 360},100%,70%)`);
    const other = 1 - c.sides[0];
    if (ui.humans[other] && b.canMega(other, true)) bigText(g, 'RESPONDA COM MEGA PARA O CHOQUE DE MEGAS!', W / 2, H * 0.34, 2.4 * u, '#ffe14a');
  }
  if (c?.type === 'megaclash') {
    const k = Math.min(1, c.t / 0.6);
    g.fillStyle = `rgba(0,0,0,${0.4 * k})`;
    g.fillRect(0, 0, W, H);
    const size = Math.min(H * 0.6, W * 0.32);
    for (const s of c.sides) {
      const m = b.sides[s].active;
      const target = m ? megaTarget(m) || m.species : null;
      const art = target && R.bank.artwork[target];
      if (!art) continue;
      const fromLeft = s === 0;
      const x = fromLeft ? -size + (W * 0.3 + size / 2) * k - size / 2 : W + size - (W * 0.3 + size / 2) * k - size / 2;
      g.save();
      g.globalAlpha = 0.95;
      if (!fromLeft) { g.translate(x + size, H * 0.2); g.scale(-1, 1); g.drawImage(art, 0, 0, size, size); }
      else g.drawImage(art, x, H * 0.2, size, size);
      g.restore();
      // treinadores pequenos nos cantos de baixo
      const tr = R.bank.trainers[R.trainers?.[s]];
      if (tr) R.bank.drawTrainer(g, R.trainers[s], fromLeft ? W * 0.08 : W * 0.92, H * 0.98, Math.max(1, Math.round((H * 0.3) / tr.img.height)), fromLeft, { alpha: k });
    }
    bigText(g, 'CHOQUE DE MEGAS!', W / 2, H * 0.15, 6 * u * (1 + 0.05 * Math.sin(R.time * 20)), '#ff6fd8');
    if (c.t > 1.4) bigText(g, 'Um novo clima vai nascer...', W / 2, H * 0.88, 2.6 * u, '#ffe58a');
  }
  if (R.climate && R.climate.t < 2.6) {
    const a = Math.min(1, (2.6 - R.climate.t) / 0.5);
    g.globalAlpha = a;
    bigText(g, R.climate.name.toUpperCase(), W / 2, H * 0.4, 5 * u, '#ffe14a');
    g.globalAlpha = 1;
  }
  if (b.over) {
    R.endShown += 1 / 60;
    const txt = b.winner === -1 ? 'EMPATE!' : ui.humans[b.winner] && !ui.humans[1 - b.winner] ? 'VITÓRIA!' : !ui.humans[b.winner] && ui.humans[1 - b.winner] ? 'DERROTA...' : `${b.sides[b.winner].name.toUpperCase()} VENCEU!`;
    bigText(g, txt, W / 2, H * 0.42, 8 * u, b.winner === -1 ? '#fff' : txt === 'DERROTA...' ? '#9fb4c8' : '#ffe14a');
  }
  if (b.choice) {
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 0, W, H);
    if (!ui.humans[b.choice.side]) bigText(g, `${b.sides[b.choice.side].name} está escolhendo...`, W / 2, H * 0.5, 2.8 * u, '#ffffff');
  }
}

// ---------------------------------------------------------------- online: atraso e espera
function drawNet(g, b, L, ui) {
  const u = L.u;
  const n = ui.net;
  g.textAlign = 'center';
  if (n.ping !== null && n.ping !== undefined) {
    g.font = `${Math.round(1.4 * u)}px ${FONT}`;
    const col = n.ping < 90 ? '#7ad85a' : n.ping < 180 ? '#f5c518' : '#f04438';
    g.fillStyle = col;
    g.fillText(`${Math.round(n.ping)}ms`, L.pause.x, L.pause.y + L.pause.r + 2 * u);
  }
  if (n.waiting) bigText(g, n.waiting, L.W / 2, L.H * 0.6, 2.6 * u, '#ffffff');
  g.textAlign = 'left';
}
