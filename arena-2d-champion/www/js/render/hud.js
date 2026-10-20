// Interface da batalha desenhada por cima (em pixels da tela): painéis, botões, relógio,
// medidor do choque de raios e telas da Mega Evolução.
import { MOVES, TYPE_COLOR, STATUS_TAG, STATUS_COLOR, WEATHER_PT, ITEMS, displayName } from '../data/dex.js';
import { slotMove, megaTarget } from '../engine/mon.js';
import { slotBlock, staminaCost } from '../engine/actions.js';
import { STAMINA_MAX, MEGA_GAUGE_MAX } from '../engine/constants.js';
import { teamIcons } from '../layout.js';
import { shapeFor } from '../engine/shapes.js';
import { foeBeamThreat } from '../engine/ai.js';

const TAU = Math.PI * 2;
const SIDE_COLOR = ['#e8433f', '#3f7fe8'];
const FONT = '"Press Start 2P", monospace';
const BODY_FONT = '"Pixelify Sans", system-ui, sans-serif';
const BLOCK_TEXT = { recarga: '', escolha: 'TRAVADO', bis: 'BIS', provocado: 'TAUNT', colete: 'VESTE', tormento: 'TORMENT', acordado: 'ACORDADO', stamina: 'STAMINA' };
const STAT_SHORT = { atk: 'Atq', def: 'Def', spa: 'AtE', spd: 'DfE', spe: 'Vel', accuracy: 'Pre', evasion: 'Eva' };

export function drawHud(g, R, b, ui) {
  const L = ui.controls.layout;
  const u = L.u;
  g.save();
  g.textBaseline = 'middle';
  for (let i = 0; i < 2; i++) {
    const S = L.sides[i];
    if (!S?.panel) continue;
    withRotation(g, S.panel, S.panel.rotated, () => drawPanel(g, R, b, i, S.panel, u));
  }
  drawClock(g, b, L, u);
  if (L.log && ui.showLog !== false) drawLog(g, b, L, u);
  for (let i = 0; i < 2; i++) if (ui.humans[i] && L.sides[i]?.moves) drawControls(g, R, b, i, L, ui);
  drawPause(g, L, u);
  if (b.clash) drawClash(g, R, b, L, ui);
  drawCinematic(g, R, b, L, ui);
  g.restore();
}

function withRotation(g, rect, rotated, fn) {
  if (!rotated) return fn();
  g.save();
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  g.translate(cx, cy);
  g.rotate(Math.PI);
  g.translate(-cx, -cy);
  fn();
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

function bar(g, x, y, w, h, frac, color, back = 'rgba(0,0,0,0.55)') {
  g.fillStyle = back;
  g.fillRect(x, y, w, h);
  g.fillStyle = color;
  g.fillRect(x, y, Math.max(0, w * Math.min(1, frac)), h);
}

function drawPanel(g, R, b, i, P, u) {
  const side = b.sides[i];
  const m = side.active;
  roundRect(g, P.x, P.y, P.w, P.h, u * 1.5);
  g.fillStyle = 'rgba(14,16,34,0.82)';
  g.fill();
  g.fillStyle = SIDE_COLOR[i];
  g.fillRect(P.flip ? P.x + P.w - u : P.x, P.y + u, u * 0.8, P.h - 2 * u);
  const portraitSize = P.h - 3 * u;
  const px = P.flip ? P.x + P.w - portraitSize - 2.2 * u : P.x + 2.2 * u;
  const py = P.y + 1.5 * u;
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(px, py, portraitSize, portraitSize);
  if (m) {
    const img = R.bank.portraits[m.species] || R.bank.portraits[m.baseSpecies];
    if (img) g.drawImage(img, px, py, portraitSize, portraitSize);
  }
  const tx = P.flip ? P.x + 2 * u : px + portraitSize + 1.5 * u;
  const tw = P.w - portraitSize - 6 * u;
  g.textAlign = 'left';
  g.fillStyle = '#fff';
  g.font = `${Math.round(2.6 * u)}px ${FONT}`;
  const name = m ? `${m.name}${m.gender === 'M' ? ' ♂' : m.gender === 'F' ? ' ♀' : ''}` : side.name;
  let size = 2.6 * u;
  g.font = `${Math.round(size)}px ${FONT}`;
  const nvW = g.measureText('Nv50').width * 0.8 + u;
  const room = tw - nvW;
  if (g.measureText(name).width > room) { size *= room / g.measureText(name).width; g.font = `${Math.max(6, Math.round(size))}px ${FONT}`; }
  g.fillText(name, tx, P.y + 3.4 * u);
  if (!m) return;
  g.font = `${Math.round(2 * u)}px ${FONT}`;
  g.fillStyle = '#c9cbe0';
  g.textAlign = 'right';
  g.fillText('Nv50', tx + tw, P.y + 3.4 * u);
  g.textAlign = 'left';
  // PS
  const frac = m.hp / m.maxhp;
  bar(g, tx, P.y + 6 * u, tw, 2.6 * u, frac, frac > 0.5 ? '#4ade5a' : frac > 0.2 ? '#f5c518' : '#f04438');
  g.font = `${Math.round(1.9 * u)}px ${FONT}`;
  g.fillStyle = '#fff';
  g.fillText(`${Math.ceil(m.hp)}/${m.maxhp}`, tx, P.y + 10.6 * u);
  // stamina
  bar(g, tx, P.y + 12.6 * u, tw * 0.62, 1.4 * u, m.stamina / STAMINA_MAX, '#ffd84a');
  // status
  let sx = tx + tw * 0.66;
  if (m.status) {
    g.fillStyle = STATUS_COLOR[m.status];
    g.fillRect(sx, P.y + 11.6 * u, 7 * u, 3 * u);
    g.fillStyle = '#fff';
    g.font = `${Math.round(1.6 * u)}px ${FONT}`;
    g.fillText(STATUS_TAG[m.status], sx + 0.8 * u, P.y + 13.2 * u);
    sx += 7.6 * u;
  }
  if (m.vol.confusion) { g.fillStyle = '#ffe14a'; g.font = `${Math.round(1.6 * u)}px ${FONT}`; g.fillText('CNF', sx, P.y + 13.2 * u); }
  // atributos alterados e item
  const boosts = Object.entries(m.boosts).filter(([, v]) => v).map(([k, v]) => `${STAT_SHORT[k]}${v > 0 ? '+' : ''}${v}`).join(' ');
  g.font = `${Math.round(1.6 * u)}px ${FONT}`;
  g.fillStyle = '#9fe0ff';
  const conds = Object.entries(side.conds).filter(([, v]) => v > 0).map(([k]) => ({ reflect: 'REF', lightscreen: 'LSC', safeguard: 'SFG', mist: 'MST', tailwind: 'VNT' }[k])).join(' ');
  g.fillText([boosts, conds].filter(Boolean).join(' · ').slice(0, 34), tx, P.y + 16.3 * u);
  // Mega
  drawMegaGauge(g, b, i, P, u);
  // time
  const icons = teamIcons(P, u, side.mons.length);
  side.mons.forEach((mon, k) => {
    const r = icons[k];
    g.fillStyle = mon === m ? 'rgba(255,255,255,0.3)' : 'rgba(14,16,34,0.8)';
    g.fillRect(r.x, r.y, r.w, r.h);
    const img = R.bank.portraits[mon.isMega ? mon.species : mon.baseSpecies];
    if (img) {
      g.globalAlpha = mon.fainted ? 0.25 : 1;
      g.drawImage(img, r.x, r.y, r.w, r.h);
      g.globalAlpha = 1;
    }
    bar(g, r.x, r.y + r.h - 0.8 * u, r.w, 0.8 * u, mon.hp / mon.maxhp, '#4ade5a');
    if (mon.fainted) { g.strokeStyle = '#f04438'; g.lineWidth = 2; g.beginPath(); g.moveTo(r.x, r.y); g.lineTo(r.x + r.w, r.y + r.h); g.stroke(); }
    if (mon !== m && !mon.fainted && side.switchCd > 0) { g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(r.x, r.y, r.w, r.h * Math.min(1, side.switchCd / 3)); }
    g.strokeStyle = mon === m ? SIDE_COLOR[i] : 'rgba(255,255,255,0.25)';
    g.lineWidth = mon === m ? 2 : 1;
    g.strokeRect(r.x, r.y, r.w, r.h);
  });
}

function drawMegaGauge(g, b, i, P, u) {
  const side = b.sides[i];
  const hasStone = side.mons.some(mm => ITEMS[mm.item]?.mega && ITEMS[mm.item].mega.from === mm.baseSpecies);
  if (!hasStone) return;
  const cx = P.flip ? P.x + P.w + 4 * u : P.x + P.w - 4 * u;
  const cy = P.y + P.h + 4.2 * u;
  const r = 3 * u;
  const frac = side.megaUsed ? 1 : side.megaGauge / MEGA_GAUGE_MAX;
  g.fillStyle = 'rgba(14,16,34,0.85)';
  g.beginPath(); g.arc(cx, cy, r + 0.8 * u, 0, TAU); g.fill();
  g.strokeStyle = side.megaUsed ? '#666' : frac >= 1 ? `hsl(${(performance.now() / 4) % 360},100%,65%)` : '#ff6fd8';
  g.lineWidth = 0.9 * u;
  g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * frac); g.stroke();
  g.fillStyle = '#fff';
  g.font = `${Math.round(1.5 * u)}px ${FONT}`;
  g.textAlign = 'center';
  g.fillText(side.megaUsed ? 'OK' : 'M', cx, cy + 0.2 * u);
  g.textAlign = 'left';
}

function drawClock(g, b, L, u) {
  const left = Math.max(0, b.timeLimit - b.time);
  const mm = Math.floor(left / 60), ss = Math.floor(left % 60);
  g.textAlign = 'center';
  g.font = `${Math.round(2.8 * u)}px ${FONT}`;
  g.fillStyle = left < 30 ? '#ff6b5a' : '#ffffff';
  const { x, y } = L.clock;
  g.save();
  if (L.mode === '2p') { g.translate(x, y); g.rotate(-Math.PI / 2); g.translate(-x, -y); }
  g.fillText(`${mm}:${String(ss).padStart(2, '0')}`, x, y);
  const w = b.field.weather;
  const parts = [];
  if (w) parts.push(`${WEATHER_PT[w.id]} ${Math.ceil(w.t)}s`);
  if (b.field.terrain) parts.push(`Grama ${Math.ceil(b.field.terrain.t)}s`);
  if (b.field.storm > 0) parts.push('Raios!');
  if (parts.length) {
    const txt = parts.join(' · ');
    g.font = `${Math.round(1.8 * u)}px ${FONT}`;
    const w = g.measureText(txt).width + 2 * u;
    g.fillStyle = 'rgba(10,12,28,0.8)';
    g.fillRect(x - w / 2, y + 2.4 * u, w, 3.4 * u);
    g.fillStyle = '#ffe58a';
    g.fillText(txt, x, y + 4.2 * u);
  }
  g.restore();
  g.textAlign = 'left';
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
    g.fillStyle = 'rgba(10,12,28,0.8)';
    g.fillRect(L.log.x - w / 2, y - 2 * u, w, 4 * u);
    g.globalAlpha = a;
    g.fillStyle = '#fff';
    g.fillText(text, L.log.x, y + 0.2 * u, L.W * 0.5);
  });
  g.globalAlpha = 1;
  g.textAlign = 'left';
}

// a Pixelify Sans junta "fi" e "fl" num glifo que não veio no arquivo da fonte
const noLigature = t => t.replace(/f(?=[il])/g, 'f\u200C');

function shortName(name) {
  if (name.length <= 12) return name;
  const parts = name.split(/[\s-]/);
  return parts.length > 1 ? parts.map((p, i) => (i === parts.length - 1 ? p : p[0] + '.')).join(' ').slice(0, 12) : name.slice(0, 11) + '.';
}

function drawControls(g, R, b, i, L, ui) {
  const S = L.sides[i];
  const u = L.u;
  const m = b.sides[i].active;
  const ctl = ui.controls;
  const rot = S.rot;
  // joystick
  const j = ctl.joy[i];
  if (j) {
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath(); g.arc(j.bx, j.by, S.joyR, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.stroke();
    const dx = j.x - j.bx, dy = j.y - j.by, d = Math.hypot(dx, dy);
    const k = d > S.joyR ? S.joyR / d : 1;
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.arc(j.bx + dx * k, j.by + dy * k, S.joyR * 0.45, 0, TAU); g.fill();
  } else if (ui.touchHints) {
    const z = S.joyZone;
    const cx = i === 0 ? z.x + S.joyR * 1.6 : z.x + z.w - S.joyR * 1.6;
    const cy = i === 0 ? z.y + z.h - S.joyR * 1.6 : z.y + S.joyR * 1.6;
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
    g.rotate(rot);
    g.font = `${Math.round(2.2 * u)}px ${FONT}`;
    g.textAlign = 'center';
    g.lineWidth = 4; g.strokeStyle = '#000';
    g.strokeText('RESPONDA COM UM RAIO!', 0, 0);
    g.fillStyle = '#ffe14a';
    g.fillText('RESPONDA COM UM RAIO!', 0, 0);
    g.restore();
  }
  // golpes
  for (let k = 0; k < S.moves.length; k++) {
    const c = S.moves[k];
    const id = slotMove(m, k);
    if (!id) continue;
    const mv = MOVES[id];
    const block = m.onField ? slotBlock(b, m, k) : 'recarga';
    const s = m.moves[k];
    const aiming = ctl.aim[i]?.slot === k;
    const answer = beamIncoming && shapeFor(id).kind === 'beam' && !block;
    g.save();
    g.translate(c.x, c.y);
    g.rotate(rot);
    g.globalAlpha = block && block !== 'recarga' ? 0.55 : 0.92;
    g.fillStyle = TYPE_COLOR[mv.type];
    g.beginPath(); g.arc(0, 0, c.r * (aiming ? 1.12 : 1), 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 2;
    g.stroke();
    // recarga (pizza escura)
    const cdFrac = Math.max(s.cd / (s.cdMax || 1), m.gcd > 0 ? m.gcd / (m.gcdMax || 1) : 0);
    if (cdFrac > 0) {
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, c.r, -Math.PI / 2, -Math.PI / 2 + TAU * cdFrac); g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
    if (answer) {
      g.strokeStyle = `hsl(${(performance.now() / 3) % 360},100%,65%)`;
      g.lineWidth = 0.9 * u;
      g.beginPath(); g.arc(0, 0, c.r + 1.2 * u + Math.sin(performance.now() / 60) * 0.5 * u, 0, TAU); g.stroke();
    }
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    const label = shortName(mv.name);
    const words = label.split(' ');
    const longest = words.length > 1 && label.length > 7 ? Math.max(...[words[0], words.slice(1).join(' ')].map(w => w.length)) : label.length;
    g.font = `${Math.round(Math.max(6, Math.min(c.r * 0.27, (c.r * 1.75) / longest)))}px ${FONT}`;
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(0,0,0,0.7)';
    if (words.length > 1 && label.length > 7) {
      g.strokeText(words[0], 0, -c.r * 0.18); g.fillText(words[0], 0, -c.r * 0.18);
      const rest = words.slice(1).join(' ');
      g.strokeText(rest, 0, c.r * 0.2); g.fillText(rest, 0, c.r * 0.2);
    } else {
      g.strokeText(label, 0, 0); g.fillText(label, 0, 0);
    }
    if (s.cd > 0.05) {
      g.font = `${Math.round(c.r * 0.3)}px ${FONT}`;
      g.fillStyle = '#ffe58a';
      g.fillText(s.cd.toFixed(1), 0, c.r * 0.62);
    } else if (block && BLOCK_TEXT[block]) {
      g.font = `${Math.round(c.r * 0.2)}px ${FONT}`;
      g.fillStyle = '#ffb0a8';
      g.fillText(BLOCK_TEXT[block], 0, c.r * 0.62);
    } else {
      g.font = `${Math.round(c.r * 0.2)}px ${FONT}`;
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.fillText(`${staminaCost(b, m, mv)}`, 0, c.r * 0.62);
    }
    g.restore();
  }
  // esquiva (com anel de stamina)
  const d = S.dodge;
  g.save();
  g.translate(d.x, d.y);
  g.rotate(rot);
  g.fillStyle = m.dodgeCd > 0 ? 'rgba(80,80,100,0.8)' : 'rgba(235,240,255,0.88)';
  g.beginPath(); g.arc(0, 0, d.r, 0, TAU); g.fill();
  g.strokeStyle = '#ffd84a';
  g.lineWidth = 0.8 * u;
  g.beginPath(); g.arc(0, 0, d.r + 0.9 * u, -Math.PI / 2, -Math.PI / 2 + TAU * (m.stamina / STAMINA_MAX)); g.stroke();
  g.fillStyle = '#1b1d36';
  g.textAlign = 'center';
  g.font = `${Math.round(d.r * 0.24)}px ${FONT}`;
  g.fillText('ESQUIVA', 0, 0);
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
    g.rotate(rot);
    const pulse = can || respond ? 1 + 0.08 * Math.sin(performance.now() / 90) : 1;
    g.globalAlpha = can || respond ? 1 : 0.5;
    const hue = (performance.now() / 5) % 360;
    g.fillStyle = can || respond ? `hsl(${hue},90%,60%)` : '#4a4a66';
    g.beginPath(); g.arc(0, 0, M.r * pulse, 0, TAU); g.fill();
    g.strokeStyle = '#ff6fd8';
    g.lineWidth = 0.7 * u;
    g.beginPath(); g.arc(0, 0, M.r + 0.8 * u, -Math.PI / 2, -Math.PI / 2 + TAU * (side.megaGauge / MEGA_GAUGE_MAX)); g.stroke();
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.font = `${Math.round(M.r * 0.32)}px ${FONT}`;
    g.fillText(respond ? 'JÁ!' : 'MEGA', 0, 0);
    g.restore();
  }
  // aviso rápido (sem stamina, não pode trocar...)
  const fb = side.feedback;
  if (fb && b.time - fb.at < 0.8 && fb.reason !== 'recarga') {
    const txt = { stamina: 'Sem stamina!', troca: 'Não dá para trocar agora!', mega: 'Mega ainda não está pronta', dormindo: 'Está dormindo!', congelado: 'Está congelado!', escolha: 'Travado pelo item Choice', bis: 'Preso no Encore', provocado: 'Provocado (Taunt)', colete: 'Assault Vest: só ataques', tormento: 'Não pode repetir (Torment)', acordado: 'Só funciona dormindo' }[fb.reason];
    if (txt) {
      g.save();
      const cx = S.dodge.x - 20 * u, cy = S.dodge.y - 30 * u;
      g.translate(cx, cy); g.rotate(rot);
      g.font = `${Math.round(2.2 * u)}px ${FONT}`;
      g.textAlign = 'center';
      g.fillStyle = 'rgba(0,0,0,0.6)';
      const w = g.measureText(txt).width + 3 * u;
      g.fillRect(-w / 2, -2.4 * u, w, 4.8 * u);
      g.fillStyle = '#ffb0a8';
      g.fillText(txt, 0, 0);
      g.restore();
    }
  }
}

function drawPause(g, L, u) {
  const p = L.pause;
  g.fillStyle = 'rgba(14,16,34,0.7)';
  g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
  g.fillStyle = '#fff';
  g.fillRect(p.x - p.r * 0.38, p.y - p.r * 0.42, p.r * 0.25, p.r * 0.84);
  g.fillRect(p.x + p.r * 0.13, p.y - p.r * 0.42, p.r * 0.25, p.r * 0.84);
}

function drawClash(g, R, b, L, ui) {
  const c = b.clash;
  const u = L.u;
  const W = L.W;
  const bw = W * 0.5, bh = 3.5 * u;
  const x = (W - bw) / 2, y = L.mode === '2p' ? L.H / 2 - 10 * u : 24 * u;
  const k = (c.meter + 1) / 2;
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(x - u, y - u, bw + 2 * u, bh + 2 * u);
  g.fillStyle = SIDE_COLOR[0];
  g.fillRect(x, y, bw * k, bh);
  g.fillStyle = SIDE_COLOR[1];
  g.fillRect(x + bw * k, y, bw * (1 - k), bh);
  g.fillStyle = '#fff';
  g.fillRect(x + bw * k - u * 0.5, y - u, u, bh + 2 * u);
  g.textAlign = 'center';
  g.font = `${Math.round(3.6 * u)}px ${FONT}`;
  const pulse = 1 + 0.1 * Math.sin(performance.now() / 60);
  if (c.result === null) {
    g.save();
    g.translate(W / 2, y + 9 * u);
    g.scale(pulse, pulse);
    g.fillStyle = '#ffe14a';
    g.strokeStyle = '#000'; g.lineWidth = 4;
    g.strokeText('CHOQUE DE RAIOS! TOQUE RÁPIDO!', 0, 0);
    g.fillText('CHOQUE DE RAIOS! TOQUE RÁPIDO!', 0, 0);
    g.restore();
    for (let i = 0; i < 2; i++) {
      if (!ui.humans[i]) continue;
      const S = L.sides[i];
      const mb = S.mash;
      g.save();
      g.translate(mb.x, mb.y);
      g.rotate(S.rot);
      g.scale(pulse, pulse);
      g.fillStyle = SIDE_COLOR[i];
      g.globalAlpha = 0.9;
      g.beginPath(); g.arc(0, 0, mb.r, 0, TAU); g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#fff';
      g.font = `${Math.round(mb.r * 0.28)}px ${FONT}`;
      g.fillText('TOQUE!', 0, 0);
      g.restore();
    }
  } else {
    const txt = c.result === 'draw' ? 'EMPATE!' : `${b.sides[c.result].name.toUpperCase()} VENCEU O CHOQUE!`;
    g.fillStyle = '#fff';
    g.strokeStyle = '#000'; g.lineWidth = 4;
    g.strokeText(txt, W / 2, y + 9 * u);
    g.fillText(txt, W / 2, y + 9 * u);
  }
  g.textAlign = 'left';
}

function bigText(g, txt, x, y, size, color = '#fff') {
  g.font = `${Math.round(size)}px ${FONT}`;
  g.textAlign = 'center';
  g.lineWidth = Math.max(4, size / 5);
  g.strokeStyle = '#000';
  g.strokeText(txt, x, y);
  g.fillStyle = color;
  g.fillText(txt, x, y);
}

function drawCinematic(g, R, b, L, ui) {
  const c = b.cinematic;
  const u = L.u, W = L.W, H = L.H;
  if (c?.type === 'start') {
    const left = c.dur - c.t;
    const txt = left > 1.5 ? '3' : left > 0.9 ? '2' : left > 0.35 ? '1' : 'LUTEM!';
    if (R.lastCount !== txt) { R.lastCount = txt; R.sound.play(txt === 'LUTEM!' ? 'go' : 'countdown'); }
    const k = 1 + (((c.t * 1.6) % 1) * 0.3);
    bigText(g, txt, W / 2, H / 2, 12 * u * k, txt === 'LUTEM!' ? '#ffe14a' : '#ffffff');
  }
  if (c?.type === 'mega') {
    const side = b.sides[c.sides[0]];
    bigText(g, 'MEGA EVOLUÇÃO!', W / 2, H * 0.24, 6 * u, `hsl(${(performance.now() / 4) % 360},100%,70%)`);
    g.font = `${Math.round(2.4 * u)}px ${FONT}`;
    g.fillStyle = '#fff';
    g.fillText(side.name, W / 2, H * 0.33);
    const other = 1 - c.sides[0];
    if (ui.humans[other] && b.canMega(other, true)) bigText(g, 'RESPONDA COM MEGA PARA O CHOQUE DE MEGAS!', W / 2, H * 0.78, 2.6 * u, '#ffe14a');
  }
  if (c?.type === 'megaclash') {
    const k = Math.min(1, c.t / 0.6);
    g.fillStyle = `rgba(0,0,0,${0.4 * k})`;
    g.fillRect(0, 0, W, H);
    const size = Math.min(H * 0.6, W * 0.32);
    c.sides.forEach((s, idx) => {
      const m = b.sides[s].active;
      const target = m ? megaTarget(m) || m.species : null;
      const art = target && R.bank.artwork[target];
      if (!art) return;
      const fromLeft = s === 0;
      const x = fromLeft ? -size + (W * 0.3 + size / 2) * k - size / 2 : W + size - (W * 0.3 + size / 2) * k - size / 2;
      g.save();
      g.globalAlpha = 0.95;
      if (!fromLeft) { g.translate(x + size, H * 0.2); g.scale(-1, 1); g.drawImage(art, 0, 0, size, size); }
      else g.drawImage(art, x, H * 0.2, size, size);
      g.restore();
      void idx;
    });
    bigText(g, 'CHOQUE DE MEGAS!', W / 2, H * 0.15, 6 * u * (1 + 0.05 * Math.sin(performance.now() / 50)), '#ff6fd8');
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
    const txt = b.winner === -1 ? 'EMPATE!' : ui.humans[b.winner] && !ui.humans[1 - b.winner] ? 'VITÓRIA!' : !ui.humans[b.winner] ? 'DERROTA...' : `${b.sides[b.winner].name.toUpperCase()} VENCEU!`;
    bigText(g, txt, W / 2, H * 0.42, 8 * u, b.winner === -1 ? '#fff' : txt === 'DERROTA...' ? '#9fb4c8' : '#ffe14a');
  }
  if (b.choice && ui.humans[b.choice.side]) {
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 0, W, H);
  }
}

export { displayName };
