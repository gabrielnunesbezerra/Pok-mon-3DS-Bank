// Treinador controlado pelo computador: anda, mira, escolhe golpes, esquiva, troca, Mega Evolui
// e aperta rápido no choque de raios.
import { MOVES, effectiveness } from '../data/dex.js';
import { shapeFor } from './shapes.js';
import { slotMove, getStat, hpFrac, weatherFor, isSun, isRain, hasType } from './mon.js';
import { slotBlock, canStartMove } from './actions.js';
import { liveMove, typeEffect, basePower } from './hit.js';
import { FIELD } from './constants.js';

const DIFF = {
  easy: { react: 0.5, dodge: 0.12, mash: 4.5, megaResponse: 0.3, lead: 0, smart: 0.3, mega: 0.4 },
  normal: { react: 0.3, dodge: 0.38, mash: 6.5, megaResponse: 0.65, lead: 0.35, smart: 0.65, mega: 0.8 },
  hard: { react: 0.17, dodge: 0.72, mash: 8.5, megaResponse: 0.9, lead: 0.75, smart: 0.95, mega: 1 },
};

// o adversário está carregando ou soltando um raio (devolve algo que identifica esse raio)
export function foeBeamThreat(b, foe) {
  const a = foe.action;
  if (a?.type === 'windup' && shapeFor(a.id).kind === 'beam') return a;
  if (a?.type === 'charge' && shapeFor(a.id).kind === 'beam' && a.dur - a.t < 0.6) return a;
  if (a?.type === 'channel' && a.ent?.kind === 'beam' && !a.ent.hit && a.ent.t < 0.45) return a.ent;
  return null;
}

const MELEE = new Set(['lunge', 'slash', 'grab', 'spin', 'rollout']);
const WEATHER_OF = { sunnyday: 'sunnyday', raindance: 'raindance', sandstorm: 'sandstorm', hail: 'hail', snowscape: 'snow' };

export class CpuController {
  constructor(b, sideIdx, difficulty = 'normal') {
    this.b = b;
    this.side = sideIdx;
    this.d = DIFF[difficulty] || DIFF.normal;
    this.think = 0.5;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = 2;
    this.wantRange = 240;
    this.mashClock = 0;
    this.megaResponseAt = null;
    this.seen = new WeakSet();
  }

  get me() {
    const m = this.b.sides[this.side].active;
    return m && m.onField && !m.fainted ? m : null;
  }
  get foe() {
    const m = this.b.sides[1 - this.side].active;
    return m && m.onField && !m.fainted ? m : null;
  }

  update(dt) {
    const b = this.b;
    const inp = b.sides[this.side].input;
    if (b.clash) {
      this.mashClock += dt;
      const rate = this.d.mash * (0.85 + Math.random() * 0.3);
      while (this.mashClock > 1 / rate) { this.mashClock -= 1 / rate; inp.mash++; }
      return;
    }
    if (b.cinematic?.type === 'mega' && b.cinematic.sides[0] !== this.side) {
      if (this.megaResponseAt === null) this.megaResponseAt = Math.random() < this.d.megaResponse && b.canMega(this.side, true) ? 0.3 + Math.random() * 0.9 : -1;
      if (this.megaResponseAt > 0 && b.cinematic.t >= this.megaResponseAt) { inp.mega = true; this.megaResponseAt = -1; }
      return;
    }
    if (!b.cinematic) this.megaResponseAt = null;
    if (b.cinematic || b.choice || b.over) { inp.mx = 0; inp.my = 0; return; }
    const me = this.me;
    const foe = this.foe;
    if (!me) { inp.mx = 0; inp.my = 0; return; }
    this.think -= dt;
    if (this.think <= 0) {
      this.think = this.d.react * (0.7 + Math.random() * 0.6);
      this.decide(me, foe, inp);
    }
    this.steer(me, foe, inp, dt);
    if (!this.beamAnswer(me, foe, inp)) this.dodgeCheck(me, foe, inp);
  }

  // Raio vindo na minha direção e eu tenho um raio pronto: respondo para começar o choque
  beamAnswer(me, foe, inp) {
    if (!foe || !canStartMove(this.b, me)) return false;
    const incoming = foeBeamThreat(this.b, foe);
    if (!incoming || this.answered === incoming) return false;
    this.answered = incoming;
    if (Math.random() > this.d.megaResponse) return false;
    const slot = me.moves.findIndex((m, k) => shapeFor(slotMove(me, k)).kind === 'beam' && !slotBlock(this.b, me, k));
    if (slot < 0) return false;
    inp.move = { slot, aim: null };
    return true;
  }

  decide(me, foe, inp) {
    const b = this.b;
    if (b.canMega(this.side) && Math.random() < this.d.mega) { inp.mega = true; return; }
    // troca só quando o confronto é ruim e o Pokémon já ficou um tempo em campo (evita trocar sem parar)
    if (foe && b.canSwitch(this.side) && b.time - me.enteredAt > 7 && Math.random() < this.d.smart * 0.035) {
      const now = this.matchup(me, foe);
      if (now < -1 && hpFrac(me) > 0.4) {
        const opts = b.switchOptions(this.side);
        const best = this.chooseSwitch(opts);
        if (this.matchup(b.sides[this.side].mons[best], foe) > now + 1) { inp.switchTo = best; return; }
      }
    }
    // escolhe o melhor golpe disponível
    let best = null, bestScore = 0;
    let bestAttack = null, bestAttackScore = 0;
    for (let slot = 0; slot < me.moves.length; slot++) {
      const raw = this.score(me, foe, slot, true);
      if (raw > bestAttackScore && MOVES[slotMove(me, slot)].cat !== 'Status') { bestAttackScore = raw; bestAttack = slot; }
      if (slotBlock(b, me, slot)) continue;
      const s = this.score(me, foe, slot, false) * (1 + (1 - this.d.smart) * (Math.random() - 0.3));
      if (s > bestScore) { bestScore = s; best = slot; }
    }
    if (bestAttack !== null) {
      const sh = shapeFor(slotMove(me, bestAttack));
      this.wantRange = MELEE.has(sh.kind) ? 20 : sh.kind === 'ring' ? 140 : sh.kind === 'cone' ? 170 : sh.kind === 'gaze' ? 220 : 250;
    }
    if (best !== null && canStartMove(b, me)) {
      const id = slotMove(me, best);
      const shape = shapeFor(id);
      if (MELEE.has(shape.kind) && foe) {
        const reach = (shape.range || 60) + (shape.reach || 0) + me.radius + foe.radius;
        if (Math.hypot(foe.x - me.x, foe.y - me.y) > reach + 30) return; // ainda longe: chega perto antes
      }
      inp.move = { slot: best, aim: this.leadAim(me, foe, shape) };
    }
  }

  leadAim(me, foe, shape) {
    if (!foe || shape.kind !== 'projectile' || shape.homing || shape.lob || this.d.lead === 0) return null;
    const d = Math.hypot(foe.x - me.x, foe.y - me.y);
    const t = (d / shape.speed) * this.d.lead;
    const tx = foe.x + foe.vx * t, ty = foe.y + foe.vy * t;
    const len = Math.hypot(tx - me.x, ty - me.y) || 1;
    return { x: (tx - me.x) / len, y: (ty - me.y) / len };
  }

  score(me, foe, slot, ignoreReady) {
    const b = this.b;
    const id = slotMove(me, slot);
    if (!id) return 0;
    const mv = liveMove(b, me, id);
    const w = weatherFor(b, me);
    if (mv.cat !== 'Status') {
      if (!foe) return 0;
      const eff = typeEffect(b, me, foe, mv);
      if (eff === 0) return 0;
      if (id === 'dreameater' && foe.status !== 'slp') return 0;
      if (id === 'fakeout' && (me.actedSinceEntry || b.time - me.enteredAt > 2.2)) return 0;
      if (id === 'upperhand') return 0;
      if (id === 'snore' && me.status !== 'slp') return 0;
      if (id === 'naturalgift' || id === 'fling') { if (!me.item) return 0; }
      if (b.field.weather?.id === 'primordialsea' && mv.type === 'Fire') return 0;
      if (b.field.weather?.id === 'desolateland' && mv.type === 'Water') return 0;
      let bp;
      try { bp = basePower(b, me, foe, mv, {}); } catch { bp = mv.bp; }
      if (mv.damage === 'level') bp = 75;
      if (mv.damage === 40) bp = 45;
      if (mv.ohko) bp = 45;
      if (['counter', 'mirrorcoat', 'metalburst'].includes(id)) {
        const a = foe.action;
        const cat = MOVES[a?.id]?.cat;
        const ok = id === 'metalburst' ? cat && cat !== 'Status' : cat === (id === 'counter' ? 'Physical' : 'Special');
        return a && a.type === 'windup' && ok ? 150 : 2;
      }
      if (id === 'bide') return 8;
      if (!bp) bp = 60;
      const stab = me.types.includes(mv.type) ? 1.5 : 1;
      const atk = mv.cat === 'Physical' ? getStat(b, me, 'atk') : getStat(b, me, 'spa');
      const def = mv.cat === 'Physical' ? getStat(b, foe, 'def') : getStat(b, foe, 'spd');
      const acc = mv.acc === true ? 1 : mv.acc / 100;
      let s = (bp * stab * eff * atk * acc) / def;
      if (mv.multihit) s *= Array.isArray(mv.multihit) ? 3 : mv.multihit;
      if (isSun(w)) { if (mv.type === 'Fire') s *= 1.5; if (mv.type === 'Water') s *= 0.5; }
      if (isRain(w)) { if (mv.type === 'Water') s *= 1.5; if (mv.type === 'Fire') s *= 0.5; }
      if (mv.self?.volatileStatus === 'mustrecharge') s *= 0.75;
      if (id === 'solarbeam' && !isSun(w)) s *= 0.6;
      if (id === 'focuspunch') s *= 0.5;
      if (mv.drain && hpFrac(me) < 0.6) s *= 1.3;
      if (mv.recoil) s *= 0.9;
      if (mv.self?.boosts && Object.values(mv.self.boosts).some(v => v < 0)) s *= 0.85;
      return s;
    }
    // golpes de status
    const hp = hpFrac(me);
    const danger = foe && (foe.action?.type === 'windup' || foe.action?.type === 'charge' || b.ents.some(e => e.side !== this.side && (e.kind === 'proj' || e.kind === 'beam')));
    if (WEATHER_OF[id]) {
      const wid = WEATHER_OF[id];
      if (b.field.weather?.id === wid || b.field.weather?.id === 'desolateland' || b.field.weather?.id === 'primordialsea') return 0;
      return this.likesWeather(me, wid) ? 95 : 3;
    }
    if (id === 'grassyterrain') return b.field.terrain ? 0 : this.likesWeather(me, 'grass') ? 60 : 20;
    if (['protect', 'detect'].includes(id)) return danger && Math.random() < this.d.smart ? 130 : 2;
    if (id === 'endure') return hp < 0.25 && danger ? 80 : 1;
    if (['synthesis', 'roost', 'lifedew', 'rest'].includes(id)) {
      if (id === 'rest') return hp < 0.35 && !me.status ? 120 : 0;
      return hp < 0.45 ? 115 : hp < 0.7 ? 35 : 0;
    }
    if (id === 'substitute') return hp > 0.55 && !me.vol.substitute ? 45 : 0;
    if (id === 'leechseed') return foe && !foe.vol.leechseed && !hasType(foe, 'Grass') ? 75 : 0;
    if (id === 'bellydrum') return hp > 0.8 && me.boosts.atk < 2 ? 70 : 0;
    if (['reflect', 'lightscreen', 'tailwind', 'safeguard', 'mist'].includes(id)) return b.sides[this.side].conds[id] > 0 ? 0 : 45;
    if (id === 'haze') return foe && Object.values(foe.boosts).reduce((a, v) => a + v, 0) >= 2 ? 90 : 0;
    if (['taunt', 'torment', 'encore', 'spite', 'psychup', 'mimic', 'embargo', 'foresight', 'nightmare', 'block', 'snatch', 'defog'].includes(id)) {
      if (id === 'nightmare') return foe?.status === 'slp' && !foe.vol.nightmare ? 70 : 0;
      if (id === 'psychup') return foe && Object.values(foe.boosts).reduce((a, v) => a + v, 0) >= 2 ? 80 : 0;
      if (id === 'taunt') return foe && !foe.vol.taunt && foe.moves.some(m => MOVES[m.id].cat === 'Status') ? 40 : 0;
      return 15;
    }
    if (['helpinghand', 'followme', 'holdhands', 'dragoncheer', 'celebrate'].includes(id)) return 0.5;
    if (['metronome', 'assist', 'naturepower', 'sleeptalk'].includes(id)) {
      if (id === 'sleeptalk') return me.status === 'slp' ? 120 : 0;
      return 35;
    }
    if (id === 'batonpass') return Object.values(me.boosts).reduce((a, v) => a + v, 0) >= 2 && b.switchOptions(this.side).length ? 60 : 0;
    if (id === 'roar') return foe && Object.values(foe.boosts).reduce((a, v) => a + v, 0) >= 2 && b.switchOptions(1 - this.side).length ? 80 : 0;
    if (mv.status) {
      if (!foe || foe.status) return 0;
      if (foe.vol.substitute) return 0;
      if (mv.flags.includes('powder') && hasType(foe, 'Grass')) return 0;
      if (mv.status === 'brn' && hasType(foe, 'Fire')) return 0;
      if ((mv.status === 'psn' || mv.status === 'tox') && (hasType(foe, 'Poison') || hasType(foe, 'Steel'))) return 0;
      return mv.status === 'slp' ? 90 : 70;
    }
    if (mv.vol === 'confusion' || id === 'swagger') return foe && !foe.vol.confusion ? 45 : 0;
    if (mv.vol === 'yawn') return foe && !foe.status && !foe.vol.yawn ? 55 : 0;
    if (mv.vol === 'attract') return foe && !foe.vol.attract && foe.gender !== me.gender && foe.gender !== 'N' ? 30 : 0;
    if (mv.boosts && (mv.target === 'self' || mv.target === 'allySide' || mv.target === 'allies')) {
      const sum = Object.entries(mv.boosts).reduce((a, [k, v]) => a + (me.boosts[k] >= 4 ? 0 : v), 0);
      const far = !foe || Math.hypot(foe.x - me.x, foe.y - me.y) > 200;
      return sum > 0 && hp > 0.55 ? (far ? 65 : 30) : 0;
    }
    if (mv.boosts) {
      if (!foe) return 0;
      const room = Object.entries(mv.boosts).every(([k, v]) => (v < 0 ? foe.boosts[k] > -4 : true));
      return room ? 22 : 0;
    }
    return 12;
  }

  likesWeather(me, w) {
    const ids = me.moves.map(m => m.id);
    if (w === 'sunnyday') return hasType(me, 'Fire') || ids.includes('solarbeam') || ids.includes('synthesis') || ['chlorophyll', 'solarpower', 'drought'].includes(me.ability);
    if (w === 'raindance') return hasType(me, 'Water') || ids.includes('hurricane') || me.ability === 'raindish';
    if (w === 'hail' || w === 'snow') return hasType(me, 'Ice') || ids.includes('blizzard');
    if (w === 'sandstorm') return hasType(me, 'Rock') || hasType(me, 'Ground');
    if (w === 'grass') return hasType(me, 'Grass');
    return false;
  }

  // positivo = bom para mim
  matchup(mon, foe) {
    const best = (a, d) => Math.max(0, ...a.moves.map(s => MOVES[s.id]).filter(m => m.cat !== 'Status').map(m => effectiveness(m.type, d.types) * (a.types.includes(m.type) ? 1.5 : 1)));
    return best(mon, foe) - best(foe, mon);
  }

  chooseSwitch(opts) {
    const foe = this.foe;
    const mons = this.b.sides[this.side].mons;
    let best = opts[0], bestScore = -99;
    for (const slot of opts) {
      const m = mons[slot];
      const s = (foe ? this.matchup(m, foe) : 0) + hpFrac(m);
      if (s > bestScore) { bestScore = s; best = slot; }
    }
    return best;
  }

  steer(me, foe, inp, dt) {
    let mx = 0, my = 0;
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = 1.2 + Math.random() * 2; }
    if (foe) {
      const dx = foe.x - me.x, dy = foe.y - me.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      const want = this.wantRange + me.radius + foe.radius;
      if (d > want + 40) { mx += ux; my += uy; }
      else if (d < want - 50) { mx -= ux; my -= uy; }
      mx += -uy * this.strafe * 0.7;
      my += ux * this.strafe * 0.7;
    }
    // foge das paredes, de áreas marcadas e do fogo no chão
    const cx = FIELD.x + FIELD.w / 2, cy = FIELD.y + FIELD.h / 2;
    const margin = 70;
    if (me.x < FIELD.x + margin || me.x > FIELD.x + FIELD.w - margin) mx += Math.sign(cx - me.x) * 1.2;
    if (me.y < FIELD.y + margin || me.y > FIELD.y + FIELD.h - margin) my += Math.sign(cy - me.y) * 1.2;
    for (const e of this.b.ents) {
      const danger = (e.kind === 'telegraph' && e.side !== this.side) || (e.kind === 'area' && e.side !== this.side && !e.done) || (e.kind === 'zone' && e.zone === 'fire' && !hasType(me, 'Fire')) || e.kind === 'bolt';
      if (!danger) continue;
      const r = (e.r || 40) + me.radius + 10;
      const ddx = me.x - e.x, ddy = me.y - e.y;
      const dd = Math.hypot(ddx, ddy) || 1;
      if (dd < r) { mx += (ddx / dd) * 2; my += (ddy / dd) * 2; }
    }
    const len = Math.hypot(mx, my);
    inp.mx = len > 0.05 ? mx / Math.max(1, len) : 0;
    inp.my = len > 0.05 ? my / Math.max(1, len) : 0;
  }

  dodgeCheck(me, foe, inp) {
    const b = this.b;
    if (me.dodgeCd > 0 || me.stamina < 30) return;
    for (const e of b.ents) {
      if (e.side === this.side || e.dead || this.seen.has(e)) continue;
      let threat = false;
      let ax = 0, ay = 0;
      if (e.kind === 'proj' && e.delay <= 0) {
        const rx = me.x - e.x, ry = me.y - e.y;
        const vv = e.vx * e.vx + e.vy * e.vy;
        const t = (rx * e.vx + ry * e.vy) / (vv || 1);
        if (t > 0 && t < 0.45) {
          const cxp = e.x + e.vx * t - me.x, cyp = e.y + e.vy * t - me.y;
          if (Math.hypot(cxp, cyp) < e.size + me.radius + 8) { threat = true; ax = -e.vy; ay = e.vx; }
        }
        if (e.lob) {
          const left = e.lob.dur - e.lob.t;
          if (left < 0.35 && Math.hypot(e.lob.tx - me.x, e.lob.ty - me.y) < (e.explode || 30) + me.radius) { threat = true; ax = me.x - e.lob.tx; ay = me.y - e.lob.ty; }
        }
      } else if ((e.kind === 'area' && !e.done && e.delay - e.t < 0.32) || (e.kind === 'telegraph' && e.dur - e.t < 0.3)) {
        if (Math.hypot(e.x - me.x, e.y - me.y) < e.r + me.radius) { threat = true; ax = me.x - e.x; ay = me.y - e.y; }
      } else if (e.kind === 'beam' && e.t < 0.05) {
        threat = true; ax = -Math.sin(e.angle); ay = Math.cos(e.angle);
      }
      if (!threat) continue;
      this.seen.add(e);
      if (Math.random() < this.d.dodge) {
        const l = Math.hypot(ax, ay) || 1;
        const s = Math.random() < 0.5 ? 1 : -1;
        inp.mx = (ax / l) * (e.kind === 'proj' && !e.lob ? s : 1);
        inp.my = (ay / l) * (e.kind === 'proj' && !e.lob ? s : 1);
        inp.dodge = true;
        return;
      }
    }
    // avanço corpo a corpo vindo na minha direção
    if (foe?.action?.type === 'dash' && !this.seen.has(foe.action)) {
      this.seen.add(foe.action);
      if (Math.hypot(foe.x - me.x, foe.y - me.y) < 200 && Math.random() < this.d.dodge * 0.8) {
        inp.mx = -Math.sin(foe.action.dir); inp.my = Math.cos(foe.action.dir);
        inp.dodge = true;
      }
    }
  }
}
