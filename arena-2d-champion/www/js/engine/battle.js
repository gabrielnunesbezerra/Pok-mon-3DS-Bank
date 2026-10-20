// A batalha: lados, Pokémon em campo, entidades (projéteis, raios, ondas...), clima, troca,
// Mega Evolução, choque de Megas e choque de raios.
import { SPECIES, MOVES, TYPE_CHART, effectiveness, displayName } from '../data/dex.js';
import {
  DT, FIELD, FIELD_TURN, ACTION_TURN, STAMINA_MAX, STAMINA_REGEN, DODGE, MEGA_GAUGE_MAX, MEGA_RESPONSE_WINDOW,
  SWITCH_COOLDOWN, TIME_LIMIT,
} from './constants.js';
import { makeRng } from './rng.js';
import {
  createMon, resetField, recalcStats, moveSpeed, hasType, hasAbility, itemActive, isGrounded, weatherFor, isSun, isRain,
  megaTarget, hpFrac,
} from './mon.js';
import * as H from './hit.js';
import { useMove, executeMove, strike, selfMove, applySelfEffects, failMove } from './actions.js';
import { shapeFor } from './shapes.js';
import { CpuController } from './ai.js';

const TAU = Math.PI * 2;
const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

export const ARENAS = {
  grass: { name: 'Estádio de Grama', desc: 'Fogo no chão acende a grama.' },
  water: { name: 'Campo Aquático', desc: 'Fora das plataformas, quem não é de Água nada mais devagar. Gelo congela a água.' },
  ice: { name: 'Arena de Gelo', desc: 'O chão escorrega (menos para o tipo Gelo).' },
};

const CLASH_ELEMENT = { venusaurmega: 'grass', charizardmegax: 'fire', charizardmegay: 'fire', blastoisemega: 'water' };

export class Battle {
  constructor({ teams, names = ['Jogador', 'Rival'], cpu = [false, true], difficulty = 'normal', arena = 'grass', seed, timeLimit = TIME_LIMIT, events = true }) {
    this.rng = makeRng(seed ?? Math.floor(Math.random() * 2 ** 31));
    this.time = 0;
    this.arena = arena;
    this.timeLimit = timeLimit;
    this.recordEvents = events;
    this.events = [];
    this.log = [];
    this.ents = [];
    this.field = { weather: null, terrain: null, mudsport: 0, storm: 0, stormClock: 0, echoedvoice: null };
    this.cinematic = null;
    this.clash = null;
    this.choice = null;
    this.winner = null;
    this.over = false;
    this.platforms = arena === 'water'
      ? [{ x: FIELD.x + FIELD.w / 2, y: FIELD.y + FIELD.h / 2, r: 78 }, { x: FIELD.x + 150, y: FIELD.y + FIELD.h / 2, r: 64 }, { x: FIELD.x + FIELD.w - 150, y: FIELD.y + FIELD.h / 2, r: 64 }]
      : [];
    this.sides = [0, 1].map(i => ({
      index: i,
      name: names[i],
      mons: teams[i].map((set, slot) => createMon(set, i, slot)),
      active: null,
      conds: { reflect: 0, lightscreen: 0, safeguard: 0, mist: 0, tailwind: 0 },
      megaGauge: 0,
      megaUsed: false,
      switchCd: 0,
      lastFaintAt: -99,
      input: blankInput(),
      cpu: cpu[i] ? new CpuController(this, i, difficulty) : null,
      feedback: null,
      stats: { damage: 0, ko: 0 },
    }));
    for (const s of this.sides) this.switchIn(s.index, 0, { initial: true });
    this.cinematic = { type: 'start', t: 0, dur: 2.2 };
  }

  // ---------------------------------------------------------------- utilidades
  emit(ev) { if (this.recordEvents) this.events.push(ev); }
  say(text) {
    if (!text) return;
    this.log.push({ text, at: this.time });
    if (this.log.length > 60) this.log.shift();
    this.emit({ t: 'log', text });
  }
  text(mon, str, color = '#fff', big = 0) { this.emit({ t: 'float', x: mon.x, y: mon.y - 40 - mon.hover, text: str, color, big }); }
  moveLabel(mon, name) { this.emit({ t: 'label', mon, text: name }); }
  feedback(sideIdx, reason) { this.sides[sideIdx].feedback = { reason, at: this.time }; }
  setAnim(mon, name, lock = 0) { mon.anim = { name, t: 0, lock }; }
  foeActive(mon) {
    const s = this.sides[1 - mon.side].active;
    return s && s.onField && !s.fainted ? s : null;
  }
  opponentOfSide(i) { return this.sides[1 - i].active; }
  inZone(mon, kind) { return this.ents.some(e => e.kind === 'zone' && e.zone === kind && Math.hypot(e.x - mon.x, e.y - mon.y) < e.r); }
  onWater(mon) {
    if (this.arena !== 'water') return false;
    if (this.platforms.some(p => Math.hypot(p.x - mon.x, p.y - mon.y) < p.r)) return false;
    if (this.inZone(mon, 'ice')) return false;
    return true;
  }
  arenaSpeedMult(mon) {
    if (this.onWater(mon) && mon.hover === 0) return hasType(mon, 'Water') ? 1.12 : 0.78;
    return 1;
  }
  addMegaGauge(sideIdx, amount) {
    const s = this.sides[sideIdx];
    if (s.megaUsed) return;
    s.megaGauge = Math.min(MEGA_GAUGE_MAX, s.megaGauge + amount);
  }

  stun(mon, dur, reason) {
    if (!mon.onField || mon.fainted) return;
    if (['fainting', 'switching', 'semiinv', 'grabbed', 'skydrop'].includes(mon.action?.type)) return;
    this.interrupt(mon);
    mon.action = { type: 'stun', t: 0, dur, reason };
    this.setAnim(mon, 'Hurt', dur);
  }

  // Cancela preparo, carga, raio, postura (sono, congelamento, recuo)
  interrupt(mon) {
    const a = mon.action;
    if (!a) return;
    if (['windup', 'charge', 'stance', 'endlag', 'rollout', 'dash', 'leap'].includes(a.type)) {
      if (a.exec) this.release(a.exec);
      mon.action = null;
      mon.airborne = false;
    }
    if (a.type === 'channel') {
      if (a.ent) a.ent.dead = true;
      mon.action = null;
    }
    if (mon.vol.lockedmove) delete mon.vol.lockedmove;
  }

  cancelSemiInv(mon) {
    if (mon.action?.type === 'semiinv') {
      this.release(mon.action.exec);
      mon.action = null;
    }
    mon.semiInv = null;
  }

  perfectDodge(mon) {
    if (mon.lastPerfectDodge && this.time - mon.lastPerfectDodge < 0.4) return;
    mon.lastPerfectDodge = this.time;
    this.text(mon, 'Esquivou!', '#8ff0ff');
    this.addMegaGauge(mon.side, 7);
    this.emit({ t: 'dodge', mon });
  }

  // ---------------------------------------------------------------- loop principal
  step(dt = DT) {
    if (this.over) { this.time += dt; this.updateEnts(dt, true); return; }
    for (const s of this.sides) if (s.cpu) s.cpu.update(dt);
    if (this.choice) return this.clearInputs();
    if (this.cinematic) { this.updateCinematic(dt); return this.clearInputs(); }
    if (this.clash) { this.updateClash(dt); return this.clearInputs(); }

    this.time += dt;
    for (const s of this.sides) this.processInput(s);
    for (const s of this.sides) if (s.active) this.updateMon(s.active, dt);
    this.separate();
    this.updateEnts(dt);
    this.updateField(dt);
    for (const s of this.sides) {
      s.switchCd = Math.max(0, s.switchCd - dt);
      if (!s.megaUsed) this.addMegaGauge(s.index, dt * 0.8);
    }
    if (this.time >= this.timeLimit && !this.over) this.timeUp();
    this.clearInputs();
  }

  clearInputs() {
    for (const s of this.sides) {
      const i = s.input;
      i.move = null; i.dodge = false; i.mega = false; i.switchTo = null; i.mash = 0;
    }
  }

  processInput(side) {
    const inp = side.input;
    const mon = side.active;
    if (!mon || mon.fainted || !mon.onField) return;
    if (inp.mega) this.requestMega(side.index);
    if (inp.switchTo !== null && inp.switchTo !== undefined) this.trySwitch(side.index, inp.switchTo);
    if (inp.dodge) this.tryDodge(mon, inp);
    if (inp.move) useMove(this, mon, inp.move.slot, inp.move.aim || null);
  }

  tryDodge(mon, inp) {
    const a = mon.action;
    if (mon.dodgeCd > 0 || mon.stamina < DODGE.cost) { if (mon.stamina < DODGE.cost) this.feedback(mon.side, 'stamina'); return; }
    if (mon.status === 'slp' || mon.status === 'frz' || mon.hitstun > 0) return;
    if (a && !['windup', 'endlag'].includes(a.type)) return;
    if (a?.type === 'windup') mon.action = null; // esquivar cancela o golpe que estava saindo
    let dx = inp.mx, dy = inp.my;
    if (Math.hypot(dx, dy) < 0.2) {
      const foe = this.foeActive(mon);
      const ang = foe ? angleTo(foe, mon) + Math.PI / 2 * (this.rng.next() < 0.5 ? 1 : -1) : mon.facing + Math.PI;
      dx = Math.cos(ang); dy = Math.sin(ang);
    }
    const len = Math.hypot(dx, dy);
    mon.stamina -= DODGE.cost;
    mon.dodgeCd = DODGE.cooldown;
    mon.iframes = DODGE.iframes;
    mon.action = { type: 'dodge', t: 0, dur: DODGE.duration, dx: dx / len, dy: dy / len };
    this.setAnim(mon, 'Hop', DODGE.duration);
    this.emit({ t: 'dodgeStart', mon });
  }

  // ---------------------------------------------------------------- Pokémon
  updateMon(mon, dt) {
    if (!mon.onField) return;
    mon.anim.t += dt;
    if (mon.anim.lock > 0) mon.anim.lock -= dt;
    mon.iframes = Math.max(0, mon.iframes - dt);
    mon.dodgeCd = Math.max(0, mon.dodgeCd - dt);
    mon.hitstun = Math.max(0, mon.hitstun - dt);
    for (const m of mon.moves) if (m.cd > 0) m.cd = Math.max(0, m.cd - dt);
    if (mon.gcd > 0) mon.gcd = Math.max(0, mon.gcd - dt);
    const channeling = mon.action && ['channel', 'charge', 'stance', 'dash', 'rollout'].includes(mon.action.type);
    if (!channeling) mon.stamina = Math.min(STAMINA_MAX, mon.stamina + STAMINA_REGEN * dt * (mon.action?.type === 'dodge' ? 0 : 1));

    if (mon.fainted) { this.updateAction(mon, dt); return; }
    this.updateTimers(mon, dt);
    if (mon.fainted || !mon.onField) return;
    this.updateAction(mon, dt);
    if (mon.fainted || !mon.onField) return;

    // movimento
    const side = this.sides[mon.side];
    const a = mon.action;
    let factor = 1;
    if (a) factor = { windup: 0.35, charge: 0.2, channel: 0, endlag: 0.55, recharge: 0, stun: 0, stance: 0.3, switching: 0, entering: 0, fainting: 0, dodge: 0, dash: 0, semiinv: 0, leap: 0, rollout: 0, grabbed: 0, skydrop: 0 }[a.type] ?? 1;
    if (mon.status === 'slp' || mon.status === 'frz') factor = 0;
    if (mon.hitstun > 0) factor = 0;
    let mx = side.input.mx, my = side.input.my;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    if (mon.vol.confusion && ml > 0.1) {
      const wob = Math.sin(this.time * 5 + mon.uid) * 0.9;
      const c = Math.cos(wob), s = Math.sin(wob);
      [mx, my] = [mx * c - my * s, mx * s + my * c];
    }
    const sp = moveSpeed(this, mon) * factor;
    const tvx = mx * sp, tvy = my * sp;
    const slippery = (this.arena === 'ice' && !hasType(mon, 'Ice') && mon.hover === 0) || (this.inZone(mon, 'ice') && !hasType(mon, 'Ice'));
    const accel = slippery ? 2.6 : 14;
    const k = Math.min(1, accel * dt);
    mon.vx += (tvx - mon.vx) * k;
    mon.vy += (tvy - mon.vy) * k;
    if (a?.type === 'dodge') { mon.vx = a.dx * DODGE.speed; mon.vy = a.dy * DODGE.speed; }
    mon.x += (mon.vx + mon.kx) * dt;
    mon.y += (mon.vy + mon.ky) * dt;
    const decay = Math.pow(slippery ? 0.2 : 0.004, dt);
    mon.kx *= decay; mon.ky *= decay;
    this.clampToField(mon);
    if (!a || ['windup', 'endlag'].includes(a.type)) {
      if (Math.hypot(mon.vx, mon.vy) > 30 && (!a || a.type === 'endlag')) mon.facing = Math.atan2(mon.vy, mon.vx);
      const foe = this.foeActive(mon);
      if (a?.type === 'windup' && foe) mon.facing = a.aim ? Math.atan2(a.aim.y, a.aim.x) : angleTo(mon, foe);
    }
    // animação base
    if (mon.anim.lock <= 0) {
      const name = mon.status === 'slp' || mon.status === 'frz' ? (mon.status === 'slp' ? 'Sleep' : 'Hurt') : Math.hypot(mon.vx, mon.vy) > 25 ? 'Walk' : 'Idle';
      if (mon.anim.name !== name) mon.anim = { name, t: 0, lock: 0 };
    }
  }

  clampToField(mon) {
    const r = mon.radius;
    const x0 = FIELD.x + r, x1 = FIELD.x + FIELD.w - r, y0 = FIELD.y + r * 0.6, y1 = FIELD.y + FIELD.h - r * 0.4;
    let hit = false;
    if (mon.x < x0) { mon.x = x0; mon.kx = Math.abs(mon.kx) * 0.3; hit = true; }
    if (mon.x > x1) { mon.x = x1; mon.kx = -Math.abs(mon.kx) * 0.3; hit = true; }
    if (mon.y < y0) { mon.y = y0; mon.ky = Math.abs(mon.ky) * 0.3; hit = true; }
    if (mon.y > y1) { mon.y = y1; mon.ky = -Math.abs(mon.ky) * 0.3; hit = true; }
    return hit;
  }

  separate() {
    const a = this.sides[0].active, b = this.sides[1].active;
    if (!a || !b || !a.onField || !b.onField || a.fainted || b.fainted) return;
    if (a.semiInv || b.semiInv || a.airborne || b.airborne) return;
    const d = dist(a, b);
    const min = a.radius + b.radius;
    if (d < min && d > 0.01) {
      const push = (min - d) / 2;
      const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      this.clampToField(a); this.clampToField(b);
    }
  }

  updateTimers(mon, dt) {
    const v = mon.vol;
    const tick = (key, onEnd) => { if (v[key] && v[key].t !== undefined) { v[key].t -= dt; if (v[key].t <= 0) { delete v[key]; onEnd?.(); } } };
    tick('protect');
    tick('endure');
    tick('laserfocus');
    tick('snatch');
    tick('roost');
    tick('taunt', () => this.say(`${mon.name} saiu da provocação.`));
    tick('encore', () => this.say(`O bis de ${mon.name} acabou.`));
    tick('embargo', () => this.say(`${mon.name} pode usar itens de novo.`));
    tick('confusion', () => this.say(`${mon.name} não está mais confuso!`));
    tick('partiallytrapped', () => this.say(`${mon.name} se libertou!`));
    tick('yawn', () => H.applyStatus(this, mon, 'slp', null, null));
    if (mon.status === 'slp') {
      mon.statusData.sleepLeft -= dt;
      if (mon.statusData.sleepLeft <= 0) H.cureStatus(this, mon);
    }
    if (mon.status === 'frz') {
      mon.statusData.frozenFor += dt;
      mon.statusData.thawClock = (mon.statusData.thawClock || 0) + dt;
      if (mon.statusData.thawClock >= 1) {
        mon.statusData.thawClock -= 1;
        if (this.rng.chance(20) || mon.statusData.frozenFor > 8) H.cureStatus(this, mon);
      }
    }
    // dano e cura por turno, entregues a cada segundo
    mon.residualClock += dt;
    if (mon.residualClock >= 1) {
      mon.residualClock -= 1;
      this.residual(mon, 1 / FIELD_TURN);
    }
    if (mon.status === 'tox') {
      mon.statusData.toxClock = (mon.statusData.toxClock || 0) + dt;
      if (mon.statusData.toxClock >= FIELD_TURN) { mon.statusData.toxClock -= FIELD_TURN; mon.statusData.toxicTurns++; }
    }
    // Flame Orb / Toxic Orb ativam depois de um turno em campo
    const item = itemActive(mon);
    if ((item === 'flameorb' || item === 'toxicorb') && !mon.status && this.time - mon.enteredAt > FIELD_TURN) {
      H.applyStatus(this, mon, item === 'flameorb' ? 'brn' : 'tox', null, null);
    }
  }

  residual(mon, f) {
    const w = weatherFor(this, mon);
    const max = mon.maxhp;
    const hurt = (frac, msg) => { if (!mon.fainted) H.damageMon(this, mon, max * frac * f, { direct: true }); };
    const heal = frac => { if (!mon.fainted) H.healMon(this, mon, max * frac * f); };
    if (w === 'sandstorm' && !['Rock', 'Ground', 'Steel'].some(t => hasType(mon, t)) && !mon.semiInv) hurt(1 / 16);
    if (w === 'hail' && !hasType(mon, 'Ice') && !mon.semiInv) hurt(1 / 16);
    if (hasAbility(mon, 'solarpower') && isSun(w)) hurt(1 / 8);
    if (hasAbility(mon, 'raindish') && isRain(w)) heal(1 / 16);
    if (this.field.terrain?.id === 'grassyterrain' && isGrounded(this, mon)) heal(1 / 16);
    const item = itemActive(mon);
    if (item === 'leftovers') heal(1 / 16);
    if (item === 'blacksludge') hasType(mon, 'Poison') ? heal(1 / 16) : hurt(1 / 8);
    const root = item === 'bigroot' ? 1.3 : 1;
    if (mon.vol.aquaring) heal((1 / 16) * root);
    if (mon.vol.ingrain) heal((1 / 16) * root);
    if (mon.vol.leechseed) {
      const foe = this.foeActive(mon);
      const before = mon.hp;
      hurt(1 / 8);
      const drained = before - mon.hp;
      if (foe && drained > 0) H.healMon(this, foe, drained * (itemActive(foe) === 'bigroot' ? 1.3 : 1));
    }
    if (mon.status === 'brn') hurt(1 / 16);
    if (mon.status === 'psn') hurt(1 / 8);
    if (mon.status === 'tox') hurt(Math.min(15, mon.statusData.toxicTurns + 1) / 16);
    if (mon.vol.nightmare && mon.status === 'slp') hurt(1 / 4);
    if (mon.vol.nightmare && mon.status !== 'slp') delete mon.vol.nightmare;
    if (mon.vol.partiallytrapped) hurt(mon.vol.partiallytrapped.frac);
  }

  // ---------------------------------------------------------------- estado de ação
  updateAction(mon, dt) {
    const a = mon.action;
    if (!a) {
      this.autoLockedMove(mon);
      return;
    }
    a.t += dt;
    const foe = this.foeActive(mon);
    switch (a.type) {
      case 'windup':
        if (a.t >= a.dur) {
          mon.action = null;
          executeMove(this, mon, a.id, a.aim, { slot: a.slot });
        }
        break;
      case 'charge':
        if (a.t >= a.dur) {
          mon.action = null;
          executeMove(this, mon, a.id, a.aim, { slot: a.slot, charged: true, called: a.called, lostFocus: a.lostFocus });
        }
        break;
      case 'endlag': case 'stun': case 'dodge': case 'recharge':
        if (a.t >= a.dur) mon.action = null;
        break;
      case 'entering':
        if (a.t >= a.dur) mon.action = null;
        break;
      case 'switching':
        if (a.t >= a.dur) this.switchIn(mon.side, a.to, { baton: a.baton });
        break;
      case 'fainting':
        if (a.t >= a.dur) this.removeFainted(mon);
        break;
      case 'channel':
        if (!a.ent || a.ent.dead) { mon.action = { type: 'endlag', t: 0, dur: 0.18 }; if (a.exec) this.release(a.exec, a.ent); }
        break;
      case 'dash': this.updateDash(mon, a, dt, foe); break;
      case 'semiinv': this.updateSemiInv(mon, a, dt, foe); break;
      case 'leap': this.updateLeap(mon, a, dt, foe); break;
      case 'rollout': this.updateRollout(mon, a, dt, foe); break;
      case 'stance': this.updateStance(mon, a, dt, foe); break;
      case 'skydrop': this.updateSkyDrop(mon, a, dt); break;
      case 'grabbed': if (a.t > 3) { mon.action = null; mon.semiInv = null; } break;
    }
  }

  autoLockedMove(mon) {
    const lm = mon.vol.lockedmove;
    if (!lm || this.time < lm.next || mon.hitstun > 0) return;
    if (mon.status === 'slp' || mon.status === 'frz') { delete mon.vol.lockedmove; return; }
    if (lm.left > 0) {
      lm.left--;
      lm.next = this.time + 1.0;
      this.moveLabel(mon, MOVES[lm.id].name);
      this.setAnim(mon, shapeFor(lm.id).anim || 'Attack', 0.4);
      executeMove(this, mon, lm.id, null, { auto: true, slot: lm.slot });
    } else {
      delete mon.vol.lockedmove;
      this.say(`${mon.name} ficou confuso de cansaço!`);
      H.addVolatile(this, mon, 'confusion', mon, null);
    }
  }

  // Avanço corpo a corpo (lunge, slash e agarrões começam assim)
  updateDash(mon, a, dt, foe) {
    if (foe && a.homing) {
      const want = angleTo(mon, foe);
      const d = angDiff(a.dir, want);
      a.dir += Math.max(-5 * dt, Math.min(5 * dt, d));
    }
    const step = a.speed * dt;
    mon.x += Math.cos(a.dir) * step;
    mon.y += Math.sin(a.dir) * step;
    mon.facing = a.dir;
    a.left -= step;
    const wall = this.clampToField(mon);
    const touching = foe && !foe.semiInv && dist(mon, foe) <= mon.radius + foe.radius + a.reach;
    if (a.slash) {
      if (a.left <= 0 || touching || wall) this.finishSlash(mon, a, foe);
      return;
    }
    if (touching) {
      mon.action = { type: 'endlag', t: 0, dur: 0.22 };
      mon.kx -= Math.cos(a.dir) * 140; mon.ky -= Math.sin(a.dir) * 140;
      if (a.grab) this.resolveGrab(mon, a, foe);
      else this.multiStrike(mon, foe, a.exec, { dir: a.dir });
      this.release(a.exec);
      return;
    }
    if (a.left <= 0 || wall) {
      mon.action = { type: 'endlag', t: 0, dur: 0.25 };
      this.release(a.exec);
    }
  }

  finishSlash(mon, a, foe) {
    mon.action = { type: 'endlag', t: 0, dur: 0.22 };
    const shape = a.shape;
    this.ents.push({ kind: 'slashfx', x: mon.x, y: mon.y, angle: a.dir, reach: shape.reach, arc: shape.arc, t: 0, dur: 0.18, type: a.exec.mv.type, sprite: shape.sprite, side: mon.side });
    if (foe && !foe.semiInv) {
      const d = dist(mon, foe);
      const ang = Math.abs(angDiff(a.dir, angleTo(mon, foe)));
      if (d <= shape.reach + foe.radius && (ang <= (shape.arc * Math.PI) / 360 || d < mon.radius + foe.radius + 6)) {
        this.multiStrike(mon, foe, a.exec, { dir: a.dir });
      }
    }
    this.release(a.exec);
  }

  rollHits(mv) {
    if (!mv.multihit) return 1;
    if (typeof mv.multihit === 'number') return mv.multihit;
    return this.rng.pick([2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
  }

  // Golpes corpo a corpo de vários acertos (Double Hit, Fury Swipes, Triple Axel...)
  multiStrike(user, foe, exec, ctx) {
    const mv = exec.mv;
    if (mv.id === 'beatup') {
      const members = this.sides[user.side].mons.filter(m => !m.fainted && !m.status);
      const volley = { checked: false, ok: true };
      for (const m of members) {
        if (foe.fainted) break;
        const r = strike(this, user, foe, exec, { ...ctx, volley, beatUpPower: Math.floor(SPECIES[m.species].baseStats.atk / 10) + 5 });
        if (r === 'miss' || r === 'immune' || r === 'blocked') break;
      }
      return;
    }
    const hits = this.rollHits(mv);
    const volley = { checked: false, ok: true };
    let landed = 0;
    for (let i = 1; i <= hits; i++) {
      if (foe.fainted || user.fainted) break;
      const r = strike(this, user, foe, exec, { ...ctx, volley: mv.multiacc ? { checked: false } : volley, hitIndex: i });
      if (r !== 'hit') break;
      landed++;
    }
    if (hits > 1 && landed > 1) this.say(`Acertou ${landed} vezes!`);
  }

  resolveGrab(mon, a, foe) {
    const exec = a.exec;
    const mv = exec.mv;
    if (a.grab === 'skydrop') {
      if (foe.weightkg >= 200 || foe.vol.substitute) return failMove(this, mon);
      if (foe.iframes > 0) return this.perfectDodge(foe);
      if (foe.vol.protect) { this.say(`${foe.name} se protegeu!`); return; }
      if (!H.accuracyCheck(this, mon, foe, mv)) { this.text(foe, 'Errou!', '#ddd'); return; }
      this.interrupt(foe);
      mon.action = { type: 'skydrop', t: 0, dur: 1.4, target: foe, exec };
      foe.action = { type: 'grabbed', t: 0, by: mon.uid };
      mon.semiInv = 'fly'; foe.semiInv = 'fly';
      exec.pending++;
      this.say(`${mon.name} levou ${foe.name} para o céu!`);
      return;
    }
    const r = strike(this, mon, foe, exec, { dir: a.dir });
    if (r === 'hit' && a.grab === 'toss') this.emit({ t: 'toss', mon: foe });
  }

  updateSkyDrop(mon, a, dt) {
    const foe = a.target;
    if (foe.onField && !foe.fainted) { foe.x = mon.x + 8; foe.y = mon.y + 4; }
    if (a.t < a.dur) return;
    mon.semiInv = null;
    mon.action = { type: 'endlag', t: 0, dur: 0.3 };
    if (foe.onField && !foe.fainted) {
      foe.semiInv = null;
      foe.action = null;
      if (hasType(foe, 'Flying')) this.say(`Não afeta ${foe.name}...`);
      else strike(this, mon, foe, a.exec, { noAccuracy: true, unavoidable: true });
    }
    this.release(a.exec);
  }

  updateSemiInv(mon, a, dt, foe) {
    if (a.t < a.dur - 0.38) {
      if (foe) { a.tx = foe.x; a.ty = foe.y; }
      const d = Math.hypot(a.tx - mon.x, a.ty - mon.y);
      const step = Math.min(d, 330 * dt);
      if (d > 1) { mon.x += ((a.tx - mon.x) / d) * step; mon.y += ((a.ty - mon.y) / d) * step; }
    } else if (!a.locked) {
      a.locked = true;
      this.ents.push({ kind: 'telegraph', x: a.tx, y: a.ty, r: a.radius, t: 0, dur: 0.38, side: mon.side, type: a.exec.mv.type });
    }
    if (a.t >= a.dur) {
      mon.semiInv = null;
      mon.x = a.tx; mon.y = a.ty;
      this.clampToField(mon);
      mon.action = { type: 'endlag', t: 0, dur: 0.3 };
      this.setAnim(mon, 'Attack', 0.35);
      this.emit({ t: 'emerge', mon, mode: a.mode, x: mon.x, y: mon.y });
      if (foe && dist(mon, foe) <= a.radius + foe.radius) strike(this, mon, foe, a.exec, { dir: mon.facing });
      this.release(a.exec);
    }
  }

  updateLeap(mon, a, dt, foe) {
    const p = Math.min(1, a.t / a.dur);
    mon.x = a.fx + (a.tx - a.fx) * p;
    mon.y = a.fy + (a.ty - a.fy) * p;
    mon.z = Math.sin(p * Math.PI) * 70;
    if (p >= 1) {
      mon.airborne = false;
      mon.z = 0;
      mon.action = { type: 'endlag', t: 0, dur: 0.3 };
      this.emit({ t: 'shake', amount: 6 });
      this.ents.push({ kind: 'shock', x: mon.x, y: mon.y, r: a.radius, t: 0, dur: 0.3, type: a.exec.mv.type, side: mon.side });
      if (foe && dist(mon, foe) <= a.radius + foe.radius) strike(this, mon, foe, a.exec, { dir: mon.facing });
      this.release(a.exec);
    }
  }

  updateRollout(mon, a, dt, foe) {
    const side = this.sides[mon.side];
    const inp = side.input;
    let want = a.dir;
    if (Math.hypot(inp.mx, inp.my) > 0.3 && !side.cpu) want = Math.atan2(inp.my, inp.mx);
    else if (foe) want = angleTo(mon, foe);
    a.dir += Math.max(-4 * dt, Math.min(4 * dt, angDiff(a.dir, want)));
    const speed = 300 + 40 * a.hits;
    mon.x += Math.cos(a.dir) * speed * dt;
    mon.y += Math.sin(a.dir) * speed * dt;
    mon.facing = a.dir;
    if (this.clampToField(mon)) a.dir += Math.PI * 0.8;
    a.rehit -= dt;
    if (foe && a.rehit <= 0 && !foe.semiInv && dist(mon, foe) <= mon.radius + foe.radius + 6) {
      const r = strike(this, mon, foe, a.exec, { rolloutHits: a.hits, dir: a.dir });
      a.rehit = 0.5;
      a.dir += Math.PI;
      if (r === 'hit') a.hits++;
      if (r === 'miss' || r === 'blocked' || r === 'immune' || a.hits >= 5) a.t = a.dur;
    }
    if (a.t >= a.dur) {
      mon.action = { type: 'endlag', t: 0, dur: 0.3 };
      this.release(a.exec);
    }
  }

  updateStance(mon, a, dt, foe) {
    if (a.t < a.dur) return;
    mon.action = { type: 'endlag', t: 0, dur: 0.2 };
    if (a.mode === 'bide') {
      if (a.taken > 0 && foe) {
        this.say(`${mon.name} liberou a energia!`);
        this.ents.push({ kind: 'shock', x: mon.x, y: mon.y, r: 140, t: 0, dur: 0.4, type: 'Normal', side: mon.side });
        H.damageMon(this, foe, a.taken * 2, { source: mon, mv: MOVES.bide });
        a.exec.hitAny = true;
      } else this.say('Mas falhou!');
    } else {
      this.say('Mas falhou!');
    }
    this.release(a.exec);
  }

  // ---------------------------------------------------------------- entrega dos golpes
  deliver(user, exec, shape, aim) {
    const foe = this.foeActive(user);
    const dir = aim ? Math.atan2(aim.y, aim.x) : foe ? angleTo(user, foe) : user.facing;
    user.facing = dir;
    exec.dir = dir;
    const mv = exec.mv;
    const type = mv.type;
    const ox = user.x + Math.cos(dir) * user.radius;
    const oy = user.y + Math.sin(dir) * user.radius - user.hover * 0.5;
    this.emit({ t: 'execute', mon: user, id: mv.id, shape: shape.kind });
    switch (shape.kind) {
      case 'self': case 'field':
        selfMove(this, user, exec);
        if (!user.action || user.action.type === 'windup') user.action = { type: 'endlag', t: 0, dur: 0.2 };
        this.ents.push({ kind: 'aura', mon: user, t: 0, dur: 0.6, type, side: user.side });
        this.finalize(exec);
        break;
      case 'lunge':
        exec.pending++;
        user.action = { type: 'dash', t: 0, dir, speed: shape.speed, left: shape.range, reach: shape.reach, exec, shape, homing: !aim, trail: shape.trail };
        break;
      case 'slash':
        exec.pending++;
        user.action = { type: 'dash', t: 0, dir, speed: 520, left: shape.range, reach: 0, exec, shape, slash: true, homing: !aim };
        break;
      case 'grab':
        exec.pending++;
        user.action = { type: 'dash', t: 0, dir, speed: 640, left: shape.range, reach: 14, exec, shape, grab: shape.mode, homing: !aim };
        break;
      case 'spin':
        user.action = { type: 'endlag', t: 0, dur: 0.3 };
        this.ents.push({ kind: 'shock', x: user.x, y: user.y, r: shape.radius, t: 0, dur: 0.3, type, side: user.side, spin: true });
        if (foe && !foe.semiInv && dist(user, foe) <= shape.radius + foe.radius) strike(this, user, foe, exec, { dir });
        this.finalize(exec);
        break;
      case 'projectile': this.spawnProjectiles(user, exec, shape, dir, foe); break;
      case 'beam': {
        const ent = { kind: 'beam', side: user.side, owner: user, exec, mv, angle: dir, len: 0, maxLen: shape.length, width: shape.width, t: 0, dur: shape.duration, grow: shape.grow, hit: false, type, id: mv.id, track: !aim, sprite: shape.sprite };
        exec.pending++;
        this.ents.push(ent);
        user.action = { type: 'channel', t: 0, ent, exec };
        break;
      }
      case 'cone': {
        const ent = { kind: 'cone', side: user.side, owner: user, exec, mv, angle: dir, range: shape.range, half: (shape.angle * Math.PI) / 360, t: 0, dur: shape.duration, hit: false, type, id: mv.id, sprite: shape.sprite };
        exec.pending++;
        this.ents.push(ent);
        user.action = { type: 'channel', t: 0, ent, exec };
        break;
      }
      case 'wave': {
        exec.pending++;
        this.ents.push({ kind: 'wave', side: user.side, owner: user, exec, mv, x: ox, y: oy, dx: Math.cos(dir), dy: Math.sin(dir), angle: dir, width: shape.width, thickness: shape.thickness, speed: shape.speed, range: shape.range, traveled: 0, hit: false, type, id: mv.id, sprite: shape.sprite });
        user.action = { type: 'endlag', t: 0, dur: 0.3 };
        break;
      }
      case 'ring': {
        exec.pending++;
        this.ents.push({ kind: 'ring', side: user.side, owner: user, exec, mv, x: user.x, y: user.y, r: user.radius, maxR: shape.radius, speed: shape.speed, hit: false, type, id: mv.id, ground: !!shape.ground, sound: !!shape.sound, sprite: shape.sprite });
        user.action = { type: 'endlag', t: 0, dur: 0.32 };
        if (shape.ground) this.emit({ t: 'shake', amount: shape.radius > 250 ? 10 : 5 });
        break;
      }
      case 'area': {
        let tx = foe ? foe.x : user.x + Math.cos(dir) * 200;
        let ty = foe ? foe.y : user.y + Math.sin(dir) * 200;
        if (aim) { tx = user.x + Math.cos(dir) * 230; ty = user.y + Math.sin(dir) * 230; }
        const d = Math.hypot(tx - user.x, ty - user.y);
        if (d > 440) { tx = user.x + ((tx - user.x) / d) * 440; ty = user.y + ((ty - user.y) / d) * 440; }
        const volley = { checked: false, ok: true, single: true, done: false };
        for (let i = 0; i < (shape.count || 1); i++) {
          const ang = this.rng.next() * TAU;
          const rr = i === 0 ? 0 : this.rng.next() * shape.spread;
          exec.pending++;
          this.ents.push({ kind: 'area', side: user.side, owner: user, exec, mv, x: tx + Math.cos(ang) * rr, y: ty + Math.sin(ang) * rr, r: shape.radius, delay: shape.delay + i * 0.08, t: 0, done: false, type, id: mv.id, ground: !!shape.ground, sprite: shape.sprite, volley });
        }
        user.action = { type: 'endlag', t: 0, dur: 0.3 };
        break;
      }
      case 'line': {
        exec.pending++;
        this.ents.push({ kind: 'line', side: user.side, owner: user, exec, mv, x: user.x, y: user.y, angle: dir, len: shape.length, width: shape.width, delay: shape.delay, t: 0, done: false, type, id: mv.id });
        user.action = { type: 'endlag', t: 0, dur: 0.35 };
        break;
      }
      case 'gaze': {
        this.ents.push({ kind: 'gazefx', owner: user, angle: dir, range: shape.range, half: (shape.angle * Math.PI) / 360, t: 0, dur: 0.35, type, side: user.side });
        user.action = { type: 'endlag', t: 0, dur: 0.25 };
        if (foe && dist(user, foe) <= shape.range + foe.radius && Math.abs(angDiff(dir, angleTo(user, foe))) <= (shape.angle * Math.PI) / 360 + 0.2) {
          strike(this, user, foe, exec, { dir });
        } else this.say('Mas não alcançou!');
        this.finalize(exec);
        break;
      }
      case 'semiinv': {
        const herb = itemActive(user) === 'powerherb';
        if (herb) { H.consumeItem(this, user); this.say(`${user.name} ficou pronto na hora com a Power Herb!`); }
        user.semiInv = shape.mode;
        exec.pending++;
        user.action = { type: 'semiinv', mode: shape.mode, t: 0, dur: herb ? 0.5 : shape.duration, exec, radius: shape.radius, tx: foe?.x ?? user.x, ty: foe?.y ?? user.y };
        this.say({ fly: `${user.name} voou bem alto!`, dig: `${user.name} cavou um buraco!`, dive: `${user.name} mergulhou!` }[shape.mode]);
        this.emit({ t: 'vanish', mon: user, mode: shape.mode });
        break;
      }
      case 'leap': {
        let tx = foe ? foe.x : user.x + Math.cos(dir) * 180;
        let ty = foe ? foe.y : user.y + Math.sin(dir) * 180;
        const d = Math.hypot(tx - user.x, ty - user.y);
        if (d > shape.range) { tx = user.x + ((tx - user.x) / d) * shape.range; ty = user.y + ((ty - user.y) / d) * shape.range; }
        exec.pending++;
        user.airborne = true;
        user.action = { type: 'leap', t: 0, dur: 0.55, fx: user.x, fy: user.y, tx, ty, exec, radius: shape.radius };
        this.ents.push({ kind: 'telegraph', x: tx, y: ty, r: shape.radius, t: 0, dur: 0.55, side: user.side, type });
        break;
      }
      case 'stance': {
        exec.pending++;
        const dur = shape.mode === 'bide' ? 2.6 : 1.1;
        user.action = { type: 'stance', mode: shape.mode, t: 0, dur, exec, taken: 0 };
        this.say(shape.mode === 'bide' ? `${user.name} está acumulando energia!` : `${user.name} se preparou para revidar!`);
        break;
      }
      case 'rollout':
        exec.pending++;
        user.action = { type: 'rollout', t: 0, dur: 4.2, hits: 0, dir, rehit: 0, exec };
        break;
      default:
        this.finalize(exec);
    }
  }

  spawnProjectiles(user, exec, shape, dir, foe) {
    const mv = exec.mv;
    let count = shape.count || 1;
    const multi = !!mv.multihit || mv.id === 'beatup';
    let members = null;
    if (mv.id === 'beatup') {
      members = this.sides[user.side].mons.filter(m => !m.fainted && !m.status);
      count = members.length;
    } else if (mv.multihit) count = this.rollHits(mv);
    const volley = { checked: false, ok: true, single: !multi && count > 1, done: false, hits: 0, total: count };
    for (let i = 0; i < count; i++) {
      let ang = dir;
      if (shape.burst) ang += (this.rng.next() - 0.5) * (shape.spread || 0.1);
      else if (count > 1) ang += (i - (count - 1) / 2) * (shape.spread || 0.2);
      const p = {
        kind: 'proj', side: user.side, owner: user, exec, mv, id: mv.id, type: mv.type,
        x: user.x + Math.cos(ang) * user.radius, y: user.y + Math.sin(ang) * user.radius - user.hover * 0.5,
        vx: Math.cos(ang) * shape.speed, vy: Math.sin(ang) * shape.speed, speed: shape.speed, size: shape.size,
        range: shape.range, traveled: 0, homing: shape.homing || 0, sprite: shape.sprite, explode: shape.explode || 0,
        delay: shape.burst ? i * shape.burst : 0, volley, ctx: { hitIndex: i + 1 }, z: 0, angle: ang,
      };
      if (members) p.ctx.beatUpPower = Math.floor(SPECIES[members[i].species].baseStats.atk / 10) + 5;
      if (shape.lob) {
        let tx = foe ? foe.x : user.x + Math.cos(dir) * 260;
        let ty = foe ? foe.y : user.y + Math.sin(dir) * 260;
        if (exec.aimManual) { tx = user.x + Math.cos(dir) * 260; ty = user.y + Math.sin(dir) * 260; }
        const d = Math.hypot(tx - user.x, ty - user.y);
        const maxD = shape.range;
        if (d > maxD) { tx = user.x + ((tx - user.x) / d) * maxD; ty = user.y + ((ty - user.y) / d) * maxD; }
        p.lob = { sx: p.x, sy: p.y, tx, ty, t: 0, dur: Math.max(0.35, Math.min(maxD, d) / shape.speed), h: 50 + Math.min(maxD, d) * 0.25 };
      }
      exec.pending++;
      this.ents.push(p);
    }
    user.action = { type: 'endlag', t: 0, dur: shape.burst ? count * shape.burst + 0.15 : 0.22 };
  }

  // Um pedaço do golpe terminou; quando todos terminarem, fecha o golpe
  release(exec, ent) {
    if (!exec || exec.finalized) return;
    exec.pending = Math.max(0, exec.pending - 1);
    if (exec.pending === 0) this.finalize(exec);
  }

  finalize(exec) {
    if (exec.finalized) return;
    exec.finalized = true;
    const user = exec.user;
    user.lastMoveFailed = !exec.hitAny;
    if (!exec.hitAny && exec.id === 'furycutter') delete user.vol.furycutter;
    if (!user.onField || user.fainted) return;
    if (exec.mustRecharge) {
      user.action = { type: 'recharge', t: 0, dur: 1.4 };
      this.say(`${user.name} precisa recarregar!`);
      this.setAnim(user, 'Hurt', 0.2);
    }
    if (exec.selfSwitch) this.selfSwitch(user, {});
  }

  // ---------------------------------------------------------------- entidades
  updateEnts(dt, visualOnly = false) {
    for (const e of this.ents) {
      if (e.dead) continue;
      if (visualOnly && !['slashfx', 'gazefx', 'shock', 'aura', 'telegraph', 'zone'].includes(e.kind)) { e.dead = true; continue; }
      switch (e.kind) {
        case 'proj': this.updateProj(e, dt); break;
        case 'beam': this.updateBeam(e, dt); break;
        case 'cone': this.updateCone(e, dt); break;
        case 'wave': this.updateWave(e, dt); break;
        case 'ring': this.updateRing(e, dt); break;
        case 'area': this.updateArea(e, dt); break;
        case 'line': this.updateLine(e, dt); break;
        case 'bolt': this.updateBolt(e, dt); break;
        case 'zone': this.updateZone(e, dt); break;
        default:
          e.t += dt;
          if (e.t >= e.dur) e.dead = true;
      }
    }
    if (!visualOnly) this.collideEnts();
    this.ents = this.ents.filter(e => {
      if (e.dead && e.exec && !e.released) { e.released = true; this.release(e.exec, e); }
      return !e.dead;
    });
  }

  targetFor(e) {
    const foe = this.sides[1 - e.side].active;
    return foe && foe.onField && !foe.fainted ? foe : null;
  }

  updateProj(p, dt) {
    if (p.delay > 0) {
      p.delay -= dt;
      p.x = p.owner.x + Math.cos(p.angle) * p.owner.radius;
      p.y = p.owner.y + Math.sin(p.angle) * p.owner.radius;
      if (p.lob) { p.lob.sx = p.x; p.lob.sy = p.y; }
      return;
    }
    if (p.volley.single && p.volley.done) { p.dead = true; return; }
    const foe = this.targetFor(p);
    if (p.lob) {
      const L = p.lob;
      L.t += dt;
      const k = Math.min(1, L.t / L.dur);
      p.x = L.sx + (L.tx - L.sx) * k;
      p.y = L.sy + (L.ty - L.sy) * k;
      p.z = L.h * 4 * k * (1 - k);
      if (k >= 1) this.explode(p, foe, Math.max(p.explode, 30));
      return;
    }
    if (p.homing && foe && !foe.semiInv) {
      const want = angleTo(p, foe);
      const cur = Math.atan2(p.vy, p.vx);
      const na = cur + Math.max(-p.homing * dt, Math.min(p.homing * dt, angDiff(cur, want)));
      p.vx = Math.cos(na) * p.speed; p.vy = Math.sin(na) * p.speed;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle = Math.atan2(p.vy, p.vx);
    p.traveled += p.speed * dt;
    if (foe && !p.passed && Math.hypot(foe.x - p.x, foe.y - (p.y + foe.hover * 0.3)) <= p.size + foe.radius) {
      const r = strike(this, p.owner, foe, p.exec, { volley: p.volley, ...p.ctx, dir: p.angle });
      if (r === 'dodged' || r === 'none') { p.passed = r === 'dodged'; }
      else {
        if (p.volley.single) p.volley.done = true;
        if (p.explode) this.explode(p, null, p.explode, true);
        else this.emit({ t: 'impact', x: p.x, y: p.y, type: p.type, size: p.size });
        p.dead = true;
        return;
      }
    }
    const out = p.x < FIELD.x - 40 || p.x > FIELD.x + FIELD.w + 40 || p.y < FIELD.y - 60 || p.y > FIELD.y + FIELD.h + 40;
    if (p.traveled >= p.range || out) {
      if (p.explode) this.explode(p, foe, p.explode);
      else this.groundEffect(p.x, p.y, p.type, p.id);
      p.dead = true;
    }
  }

  explode(p, foe, radius, alreadyHit = false) {
    p.dead = true;
    this.ents.push({ kind: 'shock', x: p.x, y: p.y, r: radius, t: 0, dur: 0.35, type: p.type, side: p.side, explosion: true });
    this.emit({ t: 'explode', x: p.x, y: p.y, type: p.type, r: radius });
    this.groundEffect(p.x, p.y, p.type, p.id);
    if (alreadyHit || !foe || foe.semiInv) return;
    if (p.volley.single && p.volley.done) return;
    if (Math.hypot(foe.x - p.x, foe.y - p.y) <= radius + foe.radius) {
      const r = strike(this, p.owner, foe, p.exec, { volley: p.volley, ...p.ctx, dir: Math.atan2(foe.y - p.y, foe.x - p.x) });
      if (r !== 'dodged' && r !== 'none' && p.volley.single) p.volley.done = true;
    }
  }

  beamEnd(e) {
    return { x: e.ox + Math.cos(e.angle) * e.len, y: e.oy + Math.sin(e.angle) * e.len };
  }

  updateBeam(e, dt) {
    const o = e.owner;
    if (!o.onField || o.fainted || o.action?.ent !== e) { e.dead = true; return; }
    e.t += dt;
    const foe = this.targetFor(e);
    if (e.track && foe && !e.hit) e.angle += Math.max(-0.6 * dt, Math.min(0.6 * dt, angDiff(e.angle, angleTo(o, foe))));
    o.facing = e.angle;
    e.ox = o.x + Math.cos(e.angle) * o.radius;
    e.oy = o.y + Math.sin(e.angle) * o.radius - o.hover * 0.5;
    e.len = Math.min(e.maxLen, e.len + e.grow * dt);
    // o raio para na parede
    const end = this.beamEnd(e);
    const maxX = FIELD.x + FIELD.w + 20, minX = FIELD.x - 20;
    if (end.x > maxX || end.x < minX) e.len = Math.max(0, ((end.x > maxX ? maxX : minX) - e.ox) / Math.cos(e.angle));
    if (foe && !e.hit && !foe.semiInv) {
      const d = segDist(foe.x, foe.y - foe.hover * 0.3, e.ox, e.oy, this.beamEnd(e).x, this.beamEnd(e).y);
      if (d <= e.width / 2 + foe.radius) {
        const r = strike(this, o, foe, e.exec, { dir: e.angle });
        if (r !== 'dodged' && r !== 'none') {
          e.hit = true;
          e.len = Math.min(e.len, Math.hypot(foe.x - e.ox, foe.y - e.oy));
        }
      }
    }
    if (e.t >= e.dur) {
      e.dead = true;
      const end2 = this.beamEnd(e);
      this.groundEffect(end2.x, end2.y, e.type, e.id);
    }
  }

  updateCone(e, dt) {
    const o = e.owner;
    if (!o.onField || o.fainted || o.action?.ent !== e) { e.dead = true; return; }
    e.t += dt;
    e.x = o.x; e.y = o.y;
    const foe = this.targetFor(e);
    if (foe && !e.hit && !foe.semiInv) {
      const d = dist(o, foe);
      const grow = Math.min(1, e.t / 0.2);
      if (d <= e.range * grow + foe.radius && Math.abs(angDiff(e.angle, angleTo(o, foe))) <= e.half + Math.atan2(foe.radius, Math.max(1, d))) {
        const r = strike(this, o, foe, e.exec, { dir: e.angle });
        if (r !== 'dodged' && r !== 'none') e.hit = true;
      }
    }
    if (e.t >= e.dur) {
      e.dead = true;
      this.groundEffect(o.x + Math.cos(e.angle) * e.range * 0.7, o.y + Math.sin(e.angle) * e.range * 0.7, e.type, e.id);
    }
  }

  updateWave(e, dt) {
    e.x += e.dx * e.speed * dt;
    e.y += e.dy * e.speed * dt;
    e.traveled += e.speed * dt;
    const foe = this.targetFor(e);
    if (foe && !e.hit && (!foe.semiInv || H.hitsSemiInvulnerable(e.mv, foe.semiInv))) {
      const rx = foe.x - e.x, ry = foe.y - e.y;
      const along = rx * e.dx + ry * e.dy;
      const lat = -rx * e.dy + ry * e.dx;
      if (Math.abs(along) <= e.thickness / 2 + foe.radius && Math.abs(lat) <= e.width / 2 + foe.radius) {
        const r = strike(this, e.owner, foe, e.exec, { dir: Math.atan2(e.dy, e.dx) });
        if (r !== 'dodged' && r !== 'none') e.hit = true;
      }
    }
    if (e.traveled >= e.range || e.x < FIELD.x - 60 || e.x > FIELD.x + FIELD.w + 60) e.dead = true;
  }

  updateRing(e, dt) {
    e.r += e.speed * dt;
    const foe = this.targetFor(e);
    if (foe && !e.hit && (!foe.semiInv || H.hitsSemiInvulnerable(e.mv, foe.semiInv))) {
      if (!(e.ground && foe.airborne) && dist(e, foe) <= e.r + foe.radius * 0.5) {
        e.hit = true;
        const r = strike(this, e.owner, foe, e.exec, { dir: angleTo(e, foe) });
        if (r === 'dodged') e.hit = false;
      }
    }
    if (e.r >= e.maxR) e.dead = true;
  }

  updateArea(e, dt) {
    e.t += dt;
    if (!e.done && e.t >= e.delay) {
      e.done = true;
      this.emit({ t: 'areaHit', x: e.x, y: e.y, r: e.r, type: e.type, id: e.id });
      if (e.ground) this.emit({ t: 'shake', amount: 5 });
      const foe = this.targetFor(e);
      this.groundEffect(e.x, e.y, e.type, e.id);
      if (foe && !(e.volley.single && e.volley.done) && (!foe.semiInv || H.hitsSemiInvulnerable(e.mv, foe.semiInv)) && !(e.ground && foe.airborne)) {
        if (Math.hypot(foe.x - e.x, foe.y - e.y) <= e.r + foe.radius * 0.7) {
          const r = strike(this, e.owner, foe, e.exec, { volley: e.volley, dir: angleTo(e, foe) });
          if (r !== 'dodged' && r !== 'none') e.volley.done = true;
        }
      }
    }
    if (e.t >= e.delay + 0.35) e.dead = true;
  }

  updateLine(e, dt) {
    e.t += dt;
    if (!e.done && e.t >= e.delay) {
      e.done = true;
      this.emit({ t: 'shake', amount: 8 });
      const foe = this.targetFor(e);
      if (foe && (!foe.semiInv || H.hitsSemiInvulnerable(e.mv, foe.semiInv)) && !foe.airborne) {
        const x2 = e.x + Math.cos(e.angle) * e.len, y2 = e.y + Math.sin(e.angle) * e.len;
        if (segDist(foe.x, foe.y, e.x, e.y, x2, y2) <= e.width / 2 + foe.radius) strike(this, e.owner, foe, e.exec, { dir: e.angle });
      }
    }
    if (e.t >= e.delay + 0.4) e.dead = true;
  }

  updateBolt(e, dt) {
    e.t += dt;
    if (!e.done && e.t >= e.delay) {
      e.done = true;
      this.emit({ t: 'bolt', x: e.x, y: e.y });
      this.emit({ t: 'shake', amount: 7 });
      for (const s of this.sides) {
        const m = s.active;
        if (!m || !m.onField || m.fainted || m.semiInv || m.iframes > 0) continue;
        if (Math.hypot(m.x - e.x, m.y - e.y) > 50 + m.radius) continue;
        const eff = effectiveness('Electric', m.types);
        if (eff === 0) { this.text(m, 'Imune', '#bbb'); continue; }
        this.say(`Um raio atingiu ${m.name}!`);
        H.damageMon(this, m, (m.maxhp / 10) * eff, { direct: true, color: '#ffe066' });
        if (this.rng.chance(30)) H.applyStatus(this, m, 'par', null, null);
      }
    }
    if (e.t >= e.delay + 0.3) e.dead = true;
  }

  updateZone(e, dt) {
    e.t -= dt * (e.zone === 'fire' && isRain(this.field.weather?.id) ? 4 : 1);
    if (e.t <= 0) { e.dead = true; return; }
    if (e.zone !== 'fire') return;
    e.clock = (e.clock || 0) + dt;
    if (e.clock < 0.6) return;
    e.clock = 0;
    for (const s of this.sides) {
      const m = s.active;
      if (!m || !m.onField || m.fainted || m.semiInv || m.hover > 0 || hasType(m, 'Fire')) continue;
      if (Math.hypot(m.x - e.x, m.y - e.y) > e.r + m.radius * 0.4) continue;
      H.damageMon(this, m, m.maxhp / 45, { direct: true, color: '#ff9a4a' });
      if (this.rng.chance(10)) H.applyStatus(this, m, 'brn', null, null);
    }
  }

  // Interações do golpe com o chão da arena
  groundEffect(x, y, type, id) {
    const zones = this.ents.filter(e => e.kind === 'zone');
    if (type === 'Water') {
      for (const z of zones) if (z.zone === 'fire' && Math.hypot(z.x - x, z.y - y) < z.r + 50) {
        z.dead = true;
        this.addZone('steam', z.x, z.y, 55, 2.5);
      }
    }
    if (type === 'Fire') {
      const grassy = this.arena === 'grass' || this.field.terrain?.id === 'grassyterrain';
      if (grassy && !isRain(this.field.weather?.id) && !this.onWaterPoint(x, y)) this.addZone('fire', x, y, 34, 4);
      for (const z of zones) if (z.zone === 'ice' && Math.hypot(z.x - x, z.y - y) < z.r + 30) { z.dead = true; this.addZone('steam', z.x, z.y, 50, 2); }
    }
    if (type === 'Ice' && this.onWaterPoint(x, y)) this.addZone('ice', x, y, 56, 7);
  }

  onWaterPoint(x, y) {
    return this.arena === 'water' && !this.platforms.some(p => Math.hypot(p.x - x, p.y - y) < p.r);
  }

  addZone(zone, x, y, r, t) {
    if (x < FIELD.x || x > FIELD.x + FIELD.w || y < FIELD.y || y > FIELD.y + FIELD.h) return;
    const same = this.ents.filter(e => e.kind === 'zone' && e.zone === zone);
    if (same.length >= 8) same[0].dead = true;
    this.ents.push({ kind: 'zone', zone, x, y, r, t, max: t });
    if (zone === 'steam') this.emit({ t: 'steam', x, y });
  }

  // Colisões entre golpes: projétil x projétil, raio x projétil e o choque de raios
  collideEnts() {
    const projs = this.ents.filter(e => e.kind === 'proj' && !e.dead && e.delay <= 0 && !e.lob);
    for (let i = 0; i < projs.length; i++) for (let j = i + 1; j < projs.length; j++) {
      const a = projs[i], b = projs[j];
      if (a.side === b.side || a.dead || b.dead) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) > a.size + b.size) continue;
      const pa = (a.mv.bp || 40) * (TYPE_CHART[a.type]?.[b.type] ?? 1);
      const pb = (b.mv.bp || 40) * (TYPE_CHART[b.type]?.[a.type] ?? 1);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      this.emit({ t: 'collide', x: mx, y: my, a: a.type, b: b.type });
      if ((a.type === 'Fire' && b.type === 'Water') || (a.type === 'Water' && b.type === 'Fire')) this.addZone('steam', mx, my, 70, 4);
      if (pa > pb * 1.25) b.dead = true;
      else if (pb > pa * 1.25) a.dead = true;
      else { a.dead = true; b.dead = true; }
    }
    const beams = this.ents.filter(e => e.kind === 'beam' && !e.dead);
    for (const beam of beams) {
      const end = this.beamEnd(beam);
      for (const p of projs) {
        if (p.dead || p.side === beam.side) continue;
        if (segDist(p.x, p.y, beam.ox, beam.oy, end.x, end.y) <= beam.width / 2 + p.size) {
          p.dead = true;
          this.emit({ t: 'collide', x: p.x, y: p.y, a: beam.type, b: p.type });
          if ((beam.type === 'Fire' && p.type === 'Water') || (beam.type === 'Water' && p.type === 'Fire')) this.addZone('steam', p.x, p.y, 60, 3);
        }
      }
    }
    if (beams.length >= 2 && !this.clash) {
      const a = beams.find(e => e.side === 0), b = beams.find(e => e.side === 1);
      if (a && b && !a.hit && !b.hit && a.t > 0.04 && b.t > 0.04) {
        const ea = this.beamEnd(a), eb = this.beamEnd(b);
        const p = segIntersect(a.ox, a.oy, ea.x, ea.y, b.ox, b.oy, eb.x, eb.y);
        // raios de frente um para o outro ficam paralelos: a ponta de um encostando no outro já é choque
        const reach = (a.width + b.width) / 2;
        const headOn = segDist(ea.x, ea.y, b.ox, b.oy, eb.x, eb.y) < reach || segDist(eb.x, eb.y, a.ox, a.oy, ea.x, ea.y) < reach;
        if (p || headOn) this.startClash(a, b, p || { x: (ea.x + eb.x) / 2, y: (ea.y + eb.y) / 2 });
      }
    }
  }

  // ---------------------------------------------------------------- choque de raios (minigame)
  startClash(a, b, point) {
    const strength = (beam, other) => {
      const u = beam.owner;
      const stab = u.types.includes(beam.mv.type) ? 1.5 : 1;
      const stat = beam.mv.cat === 'Physical' ? u.stats.atk : u.stats.spa;
      return (beam.mv.bp || 60) * stab * stat * (TYPE_CHART[beam.mv.type]?.[other.mv.type] ?? 1);
    };
    // raiz quadrada: tipo e poder ajudam, mas quem toca mais rápido ainda consegue virar
    const sa = Math.sqrt(strength(a, b)), sb = Math.sqrt(strength(b, a));
    this.clash = { a, b, x: point.x, y: point.y, meter: 0, t: 0, dur: 5, push: [sa / (sa + sb), sb / (sa + sb)], taps: [0, 0], result: null };
    a.len = Math.hypot(point.x - a.ox, point.y - a.oy);
    b.len = Math.hypot(point.x - b.ox, point.y - b.oy);
    this.say(`${a.owner.name} e ${b.owner.name}: CHOQUE DE RAIOS!`);
    this.emit({ t: 'clashStart', x: point.x, y: point.y });
  }

  updateClash(dt) {
    const c = this.clash;
    c.t += dt;
    if (c.result !== null) {
      if (c.t >= c.resultAt + 0.8) this.endClash();
      return;
    }
    for (const i of [0, 1]) {
      const taps = this.sides[i].input.mash || 0;
      c.taps[i] += taps;
      c.meter += (i === 0 ? 1 : -1) * taps * 0.085 * c.push[i] * 2;
    }
    c.meter += (c.push[0] - c.push[1]) * dt * 0.15;
    c.meter = Math.max(-1, Math.min(1, c.meter));
    const total = Math.hypot(c.a.ox - c.b.ox, c.a.oy - c.b.oy);
    const k = (c.meter + 1) / 2;
    c.x = c.a.ox + (c.b.ox - c.a.ox) * (0.15 + 0.7 * k);
    c.y = c.a.oy + (c.b.oy - c.a.oy) * (0.15 + 0.7 * k);
    c.a.len = Math.hypot(c.x - c.a.ox, c.y - c.a.oy);
    c.b.len = Math.hypot(c.x - c.b.ox, c.y - c.b.oy);
    void total;
    if (Math.abs(c.meter) >= 1 || c.t >= c.dur) {
      c.result = Math.abs(c.meter) < 0.15 ? 'draw' : c.meter > 0 ? 0 : 1;
      c.resultAt = c.t;
      this.emit({ t: 'clashEnd', result: c.result, x: c.x, y: c.y });
    }
  }

  endClash() {
    const c = this.clash;
    this.clash = null;
    const { a, b } = c;
    for (const beam of [a, b]) { beam.dead = true; beam.hit = true; }
    if (c.result === 'draw') {
      this.say('Os raios explodiram no meio da arena!');
      this.ents.push({ kind: 'shock', x: c.x, y: c.y, r: 120, t: 0, dur: 0.5, type: 'Normal', side: -1, explosion: true });
      this.emit({ t: 'explode', x: c.x, y: c.y, type: 'Normal', r: 120 });
      for (const [beam, other] of [[a, b], [b, a]]) {
        const target = other.owner;
        if (!target.onField || target.fainted) continue;
        const res = H.calcDamage(this, beam.owner, target, beam.mv, { noCrit: true });
        H.damageMon(this, target, res.damage * 0.3, { source: beam.owner, mv: beam.mv });
        beam.exec.hitAny = true;
      }
      return;
    }
    const win = c.result === 0 ? a : b;
    const lose = win === a ? b : a;
    const target = lose.owner;
    this.say(`${win.owner.name} venceu o choque de raios!`);
    this.addMegaGauge(win.side, 15);
    if (target.onField && !target.fainted) {
      strike(this, win.owner, target, win.exec, { noAccuracy: true, unavoidable: true, powerMult: 1.25, dir: win.angle });
    }
  }

  // ---------------------------------------------------------------- campo
  setWeather(id, turns, { silentFail = false } = {}) {
    const cur = this.field.weather;
    const extreme = id === 'desolateland' || id === 'primordialsea';
    if (cur && (cur.id === 'desolateland' || cur.id === 'primordialsea') && !extreme) {
      this.say(cur.id === 'desolateland' ? 'O sol extremo não foi afetado!' : 'A chuva torrencial não foi afetada!');
      return false;
    }
    if (cur && cur.id === id && !extreme) { if (!silentFail) this.say('Mas falhou!'); return false; }
    this.field.weather = { id, t: turns * FIELD_TURN, max: turns * FIELD_TURN };
    this.say({
      sunnyday: 'A luz do sol ficou forte!', raindance: 'Começou a chover!', sandstorm: 'Uma tempestade de areia começou!',
      hail: 'Começou a cair granizo!', snow: 'Começou a nevar!', desolateland: 'A luz do sol ficou extremamente forte!',
      primordialsea: 'Uma chuva torrencial começou a cair!',
    }[id]);
    this.emit({ t: 'weather', id });
    if (isRain(id)) for (const e of this.ents) if (e.kind === 'zone' && e.zone === 'fire') e.t = Math.min(e.t, 0.5);
    for (const s of this.sides) { const m = s.active; if (m && m.status === 'frz' && isSun(id)) H.cureStatus(this, m); }
    return true;
  }

  setTerrain(id, turns) {
    this.field.terrain = { id, t: turns * FIELD_TURN, max: turns * FIELD_TURN };
    this.say('A grama cresceu por toda a arena!');
    this.emit({ t: 'terrain', id });
  }

  clearTerrain() {
    if (!this.field.terrain) return;
    this.field.terrain = null;
    this.say('O terreno voltou ao normal.');
    this.emit({ t: 'terrain', id: null });
  }

  updateField(dt) {
    const f = this.field;
    if (f.weather) {
      f.weather.t -= dt;
      if (f.weather.t <= 0) {
        const id = f.weather.id;
        f.weather = null;
        this.say({
          sunnyday: 'A luz do sol enfraqueceu.', raindance: 'A chuva parou.', sandstorm: 'A tempestade de areia passou.', hail: 'O granizo parou.',
          snow: 'A neve parou.', desolateland: 'O sol extremo enfraqueceu.', primordialsea: 'A chuva torrencial parou.',
        }[id]);
        this.emit({ t: 'weather', id: null });
      }
    }
    if (f.terrain) { f.terrain.t -= dt; if (f.terrain.t <= 0) this.clearTerrain(); }
    if (f.mudsport > 0) f.mudsport -= dt;
    for (const s of this.sides) for (const k of Object.keys(s.conds)) {
      if (s.conds[k] > 0) {
        s.conds[k] -= dt;
        if (s.conds[k] <= 0) {
          s.conds[k] = 0;
          this.say({ reflect: 'O Reflect acabou.', lightscreen: 'A Light Screen acabou.', safeguard: 'O Safeguard acabou.', mist: 'A névoa sumiu.', tailwind: 'O vento de cauda parou.' }[k]);
        }
      }
    }
    if (f.storm > 0) {
      f.storm -= dt;
      f.stormClock += dt;
      if (f.stormClock >= 2.3) {
        f.stormClock = 0;
        const mons = this.sides.map(s => s.active).filter(m => m && m.onField && !m.fainted);
        const m = this.rng.pick(mons);
        if (m) this.ents.push({ kind: 'bolt', x: m.x + this.rng.range(-40, 40), y: m.y + this.rng.range(-30, 30), t: 0, delay: 0.9, done: false });
      }
    }
  }

  // ---------------------------------------------------------------- troca
  switchOptions(sideIdx) {
    const s = this.sides[sideIdx];
    return s.mons.filter(m => !m.fainted && m !== s.active).map(m => m.slot);
  }

  canSwitch(sideIdx) {
    const s = this.sides[sideIdx];
    const m = s.active;
    if (!m || m.fainted || !m.onField) return false;
    if (s.switchCd > 0) return false;
    if (m.vol.partiallytrapped || m.vol.trapped || m.vol.ingrain) return false;
    if (m.action && !['windup', 'endlag', 'stun'].includes(m.action.type)) return false;
    if (m.vol.lockedmove) return false;
    return this.switchOptions(sideIdx).length > 0;
  }

  trySwitch(sideIdx, slot) {
    if (!this.canSwitch(sideIdx)) { this.feedback(sideIdx, 'troca'); return false; }
    if (!this.switchOptions(sideIdx).includes(slot)) return false;
    const m = this.sides[sideIdx].active;
    if (m.action?.exec) this.release(m.action.exec);
    m.action = { type: 'switching', t: 0, dur: 0.4, to: slot };
    this.say(`${this.sides[sideIdx].name} chamou ${m.name} de volta!`);
    this.emit({ t: 'recall', mon: m });
    return true;
  }

  switchIn(sideIdx, slot, { initial = false, baton = false, forced = false } = {}) {
    const s = this.sides[sideIdx];
    const old = s.active;
    const mon = s.mons[slot];
    let passed = null;
    if (old && old !== mon) {
      if (baton && !old.fainted) passed = { boosts: { ...old.boosts }, vol: pick(old.vol, ['substitute', 'confusion', 'leechseed', 'ingrain', 'aquaring', 'curse', 'embargo']) };
      old.onField = false;
      if (!old.fainted) { mon.x = old.x; mon.y = old.y; }
      resetField(old);
    }
    resetField(mon);
    if (passed) { mon.boosts = passed.boosts; Object.assign(mon.vol, passed.vol); }
    if (initial || !old) {
      mon.x = sideIdx === 0 ? FIELD.x + 150 : FIELD.x + FIELD.w - 150;
      mon.y = FIELD.y + FIELD.h / 2;
    }
    if (old && old.fainted) { mon.x = sideIdx === 0 ? FIELD.x + 130 : FIELD.x + FIELD.w - 130; mon.y = FIELD.y + FIELD.h / 2; }
    mon.facing = sideIdx === 0 ? 0 : Math.PI;
    mon.onField = true;
    mon.enteredAt = this.time;
    mon.action = { type: 'entering', t: 0, dur: initial ? 0.01 : 0.45 };
    s.active = mon;
    if (!initial) s.switchCd = SWITCH_COOLDOWN;
    this.say(initial ? `${s.name} enviou ${mon.name}!` : `Vai, ${mon.name}!`);
    this.emit({ t: 'sendOut', mon, initial });
    this.entryEffects(mon);
  }

  entryEffects(mon) {
    if (hasAbility(mon, 'drought')) this.setWeather('sunnyday', itemActive(mon) === 'heatrock' ? 8 : 5, { silentFail: true });
    if (hasAbility(mon, 'pressure')) this.say(`${mon.name} está exercendo Pressure!`);
    if (itemActive(mon) === 'airballoon') this.say(`${mon.name} está flutuando num balão!`);
  }

  selfSwitch(mon, { baton = false } = {}) {
    const opts = this.switchOptions(mon.side);
    if (!opts.length) return false;
    const side = this.sides[mon.side];
    if (side.cpu) {
      this.beginSwitch(mon, side.cpu.chooseSwitch(opts), baton);
    } else {
      this.choice = { side: mon.side, reason: 'self', options: opts, baton, mon };
    }
    return true;
  }

  beginSwitch(mon, slot, baton) {
    mon.action = { type: 'switching', t: 0, dur: 0.35, to: slot, baton };
    this.emit({ t: 'recall', mon });
  }

  forceSwitch(target) {
    const opts = this.switchOptions(target.side);
    if (!opts.length || target.vol.ingrain || target.fainted) return false;
    const slot = this.rng.pick(opts);
    this.interrupt(target);
    this.say(`${target.name} foi arrastado para fora!`);
    this.switchIn(target.side, slot, { forced: true });
    return true;
  }

  // escolha do jogador humano (depois de desmaio ou de Flip Turn / Baton Pass)
  choose(slot) {
    const c = this.choice;
    if (!c || !c.options.includes(slot)) return false;
    this.choice = null;
    if (c.reason === 'faint') this.switchIn(c.side, slot);
    else this.beginSwitch(c.mon, slot, c.baton);
    return true;
  }

  // ---------------------------------------------------------------- desmaio e fim
  faint(mon) {
    if (mon.fainted) return;
    mon.fainted = true;
    mon.hp = 0;
    mon.status = null;
    const a = mon.action;
    if (a?.exec) this.release(a.exec);
    if (a?.type === 'channel' && a.ent) a.ent.dead = true;
    if (a?.type === 'skydrop' && a.target) { a.target.action = null; a.target.semiInv = null; }
    mon.semiInv = null;
    mon.airborne = false;
    mon.action = { type: 'fainting', t: 0, dur: 1.1 };
    this.setAnim(mon, 'Hurt', 2);
    const side = this.sides[mon.side];
    side.lastFaintAt = this.time;
    this.sides[1 - mon.side].stats.ko++;
    this.say(`${mon.name} desmaiou!`);
    this.emit({ t: 'faint', mon });
  }

  removeFainted(mon) {
    mon.onField = false;
    mon.action = null;
    const side = this.sides[mon.side];
    const opts = this.switchOptions(mon.side);
    if (!opts.length) {
      side.active = null;
      this.checkWinner();
      return;
    }
    if (side.cpu) this.switchIn(mon.side, side.cpu.chooseSwitch(opts));
    else if (opts.length === 1) this.switchIn(mon.side, opts[0]);
    else this.choice = { side: mon.side, reason: 'faint', options: opts };
  }

  checkWinner() {
    const alive = this.sides.map(s => s.mons.some(m => !m.fainted));
    if (alive[0] && alive[1]) return;
    this.over = true;
    this.winner = alive[0] ? 0 : alive[1] ? 1 : -1;
    this.say(this.winner >= 0 ? `${this.sides[this.winner].name} venceu a batalha!` : 'Empate!');
    this.emit({ t: 'end', winner: this.winner });
  }

  timeUp() {
    const score = this.sides.map(s => s.mons.reduce((acc, m) => acc + hpFrac(m), 0) / s.mons.length);
    this.over = true;
    this.winner = Math.abs(score[0] - score[1]) < 0.001 ? -1 : score[0] > score[1] ? 0 : 1;
    this.say('Tempo esgotado!');
    this.say(this.winner >= 0 ? `${this.sides[this.winner].name} venceu nos pontos!` : 'Empate!');
    this.emit({ t: 'end', winner: this.winner, timeUp: true });
  }

  // ---------------------------------------------------------------- Mega Evolução
  canMega(sideIdx, response = false) {
    const s = this.sides[sideIdx];
    const m = s.active;
    if (!m || !m.onField || m.fainted || s.megaUsed || !megaTarget(m)) return false;
    if (m.action && ['switching', 'fainting', 'semiinv', 'grabbed', 'skydrop', 'entering'].includes(m.action.type)) return false;
    return s.megaGauge >= (response ? 70 : MEGA_GAUGE_MAX);
  }

  requestMega(sideIdx) {
    const c = this.cinematic;
    if (c && c.type === 'mega' && c.sides[0] !== sideIdx && c.t < MEGA_RESPONSE_WINDOW && this.canMega(sideIdx, true)) {
      this.sides[sideIdx].megaUsed = true;
      this.cinematic = { type: 'megaclash', sides: [c.sides[0], sideIdx], t: 0, dur: 3.0 };
      this.emit({ t: 'megaClash', sides: this.cinematic.sides });
      this.say('Os dois treinadores ativaram a Mega Evolução ao mesmo tempo!');
      return true;
    }
    if (c || !this.canMega(sideIdx)) { if (!c) this.feedback(sideIdx, 'mega'); return false; }
    this.sides[sideIdx].megaUsed = true;
    this.cinematic = { type: 'mega', sides: [sideIdx], t: 0, dur: 2.0 };
    const m = this.sides[sideIdx].active;
    this.say(`A Mega Pedra de ${m.name} está reagindo à Pedra-chave de ${this.sides[sideIdx].name}!`);
    this.emit({ t: 'megaStart', side: sideIdx });
    return true;
  }

  // durante a animação de Mega, o outro treinador ainda pode responder
  updateCinematic(dt) {
    const c = this.cinematic;
    c.t += dt;
    if (c.type === 'mega') {
      const other = 1 - c.sides[0];
      if (this.sides[other].input.mega) this.requestMega(other);
    }
    if (this.cinematic !== c) return;
    if (c.t < c.dur) return;
    this.cinematic = null;
    if (c.type === 'mega' || c.type === 'megaclash') {
      for (const i of c.sides) this.megaEvolve(this.sides[i].active);
      if (c.type === 'megaclash') this.megaClashWeather(c.sides.map(i => this.sides[i].active));
    }
  }

  megaEvolve(mon) {
    const to = megaTarget(mon);
    if (!to) return;
    const before = mon.name;
    mon.species = to;
    mon.isMega = true;
    mon.name = displayName(to);
    mon.types = [...SPECIES[to].types];
    mon.ability = SPECIES[to].abilities[0].toLowerCase().replace(/[^a-z]/g, '');
    recalcStats(mon);
    this.say(`${before} Mega Evoluiu em ${mon.name}!`);
    this.emit({ t: 'megaEvolve', mon });
    this.entryEffects(mon);
  }

  megaClashWeather(mons) {
    const els = mons.map(m => CLASH_ELEMENT[m.species]).sort().join('+');
    const table = {
      'fire+fire': () => { this.setWeather('desolateland', 6); return 'Sol Extremo'; },
      'water+water': () => { this.setWeather('primordialsea', 6); return 'Chuva Torrencial'; },
      'grass+grass': () => { this.setWeather('sunnyday', 8, { silentFail: true }); this.setTerrain('grassyterrain', 8); return 'Primavera Ardente'; },
      'fire+water': () => { this.setWeather('raindance', 8, { silentFail: true }); this.field.storm = 8 * FIELD_TURN; this.field.stormClock = 0; return 'Tempestade Mega'; },
      'fire+grass': () => { this.setWeather('sunnyday', 8, { silentFail: true }); return 'Sol Escaldante'; },
      'grass+water': () => { this.setWeather('raindance', 8, { silentFail: true }); this.setTerrain('grassyterrain', 8); return 'Chuva Primaveril'; },
    };
    const name = (table[els] || table['fire+water'])();
    this.say(`O choque das Megas criou um clima: ${name}!`);
    this.emit({ t: 'megaClimate', name, els });
  }
}

export function blankInput() {
  return { mx: 0, my: 0, move: null, dodge: false, mega: false, switchTo: null, mash: 0 };
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k]) out[k] = obj[k];
  return out;
}

export function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function segIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(d) < 1e-6) return null;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}
