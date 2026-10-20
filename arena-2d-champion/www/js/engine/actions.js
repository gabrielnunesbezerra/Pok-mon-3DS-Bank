// Uso e execução dos golpes: custo de stamina, recarga, preparo, golpes de dois turnos,
// golpes que chamam outros golpes e o "acerto" de cada golpe no alvo.
import { MOVES, ITEMS, SPECIES } from '../data/dex.js';
import { shapeFor } from './shapes.js';
import { FIELD_TURN, HP_SCALE, GLOBAL_COOLDOWN } from './constants.js';
import {
  slotMove, itemActive, hasAbility, hasType, cooldownMult, getStat, isGrounded, weatherFor, isSun, isRain, itemRemovable,
} from './mon.js';
import { effectiveness } from '../data/dex.js';
import * as H from './hit.js';

// ---------------------------------------------------------------- custos
export function staminaCost(b, mon, mv) {
  const pp = mv.pp || 10;
  let cost = pp <= 5 ? 40 : pp <= 10 ? 32 : pp <= 15 ? 26 : pp <= 20 ? 22 : pp <= 25 ? 18 : pp <= 30 ? 16 : 14;
  const foe = b.foeActive(mon);
  if (foe && hasAbility(foe, 'pressure')) cost = Math.round(cost * 1.4);
  return cost;
}

export function baseCooldown(mv) {
  if (mv.id === 'struggle') return 1.2;
  if (mv.cat === 'Status') {
    if (mv.weather || mv.terrain) return 14;
    if (mv.side) return 12;
    if (mv.stalling) return 2.6;
    if (['synthesis', 'roost', 'rest', 'lifedew'].includes(mv.id)) return 10;
    if (mv.target === 'self' && mv.boosts) return 7;
    if (mv.status || mv.vol) return 7;
    return 6;
  }
  let power = mv.bp || 70;
  if (mv.multihit) power *= Array.isArray(mv.multihit) ? 3 : mv.multihit;
  if (['counter', 'mirrorcoat', 'bide'].includes(mv.id)) power = 90;
  if (mv.ohko) power = 160;
  let cd = 1.2 + power / 30;
  if (mv.pri > 0) cd *= 0.75;
  if (mv.self?.volatileStatus === 'mustrecharge') cd += 1;
  return Math.max(1.6, Math.min(7, cd));
}

function windupFor(mv, shape) {
  if (shape.kind === 'stance') return 0.02;
  const p = mv.pri;
  if (shape.kind === 'beam' && p <= 0) return 0.34; // brilho de carga antes do raio
  if (p >= 2) return 0.04;
  if (p === 1) return 0.08;
  if (p <= -6) return 0.45;
  if (p <= -4) return 0.4;
  if (p < 0) return 0.32;
  return mv.cat === 'Status' ? 0.24 : 0.2;
}

// Por que o espaço não pode ser usado agora (null = pode)
export function slotBlock(b, mon, slot) {
  const id = slotMove(mon, slot);
  if (!id) return 'vazio';
  const mv = MOVES[id];
  if (mon.moves[slot].cd > 0 || mon.gcd > 0) return 'recarga';
  if (mon.vol.choicelock && mon.vol.choicelock.slot !== slot) return 'escolha';
  if (mon.vol.encore && mon.vol.encore.slot !== slot) return 'bis';
  if (mv.cat === 'Status' && mon.vol.taunt) return 'provocado';
  if (mv.cat === 'Status' && itemActive(mon) === 'assaultvest') return 'colete';
  if (mon.vol.torment && mon.lastMove === id) return 'tormento';
  if (mon.vol.disable && mon.vol.disable.slot === slot) return 'desativado';
  const foe = b.foeActive?.(mon);
  if (foe?.vol.imprison && foe.moves.some(m => (m.mimic || m.id) === id)) return 'aprisionado';
  if ((id === 'snore' || id === 'sleeptalk') && mon.status !== 'slp') return 'acordado';
  if (mon.stamina < staminaCost(b, mon, mv)) return 'stamina';
  return null;
}
const RESTRICTION = ['escolha', 'bis', 'provocado', 'colete', 'tormento', 'acordado', 'desativado', 'aprisionado'];

function allRestricted(b, mon) {
  return mon.moves.every((m, i) => RESTRICTION.includes(slotBlock(b, mon, i)));
}

export function canStartMove(b, mon) {
  if (!mon || mon.fainted || !mon.onField) return false;
  if (mon.action && mon.action.type !== 'endlag') return false;
  if (mon.hitstun > 0) return false;
  if (mon.vol.lockedmove) return false;
  return true;
}

// ---------------------------------------------------------------- usar golpe (botão apertado)
export function useMove(b, mon, slot, aim = null) {
  if (!canStartMove(b, mon)) return false;
  let id = slotMove(mon, slot);
  const block = slotBlock(b, mon, slot);
  if (block) {
    if (RESTRICTION.includes(block) && allRestricted(b, mon) && block !== 'recarga') id = 'struggle';
    else { b.feedback(mon.side, block); return false; }
  }
  const mv = MOVES[id];
  if (mon.status === 'slp' && !['snore', 'sleeptalk'].includes(id)) { b.feedback(mon.side, 'dormindo'); return false; }
  if (mon.status === 'frz') {
    if (!mv.flags.includes('defrost')) { b.feedback(mon.side, 'congelado'); return false; }
    H.cureStatus(b, mon);
  }
  if (id !== 'struggle') {
    mon.stamina -= staminaCost(b, mon, mv);
    const cd = baseCooldown(mv) * cooldownMult(b, mon);
    mon.moves[slot].cd = cd;
    mon.moves[slot].cdMax = cd;
    // recarga global: depois de qualquer golpe, todos esperam um pouco
    mon.gcd = GLOBAL_COOLDOWN * cooldownMult(b, mon);
    mon.gcdMax = mon.gcd;
    if (['choiceband', 'choicespecs', 'choicescarf'].includes(itemActive(mon)) && !mon.vol.choicelock) mon.vol.choicelock = { slot };
  }
  // paralisia, paixão e confusão podem impedir o golpe
  if (mon.status === 'par' && b.rng.chance(25)) {
    b.say(`${mon.name} está paralisado! Não consegue se mexer!`);
    b.stun(mon, 0.8, 'par');
    mon.lastMoveFailed = true;
    return true;
  }
  if (mon.vol.attract) {
    const foe = b.foeActive(mon);
    if (foe && foe.uid === mon.vol.attract.by && b.rng.chance(50)) {
      b.say(`${mon.name} está apaixonado e não atacou!`);
      b.stun(mon, 0.7, 'attract');
      return true;
    }
  }
  if (mon.vol.confusion && b.rng.chance(33)) {
    b.say(`${mon.name} está confuso! Ele se feriu na confusão!`);
    const self = { ...MOVES.struggle, id: 'confusionhit', type: '???', bp: 40, flags: [] };
    const atk = getStat(b, mon, 'atk');
    const def = getStat(b, mon, 'def');
    const dmg = Math.floor(Math.floor((22 * 40 * atk) / def) / 50) + 2;
    H.damageMon(b, mon, dmg, { direct: true, mv: self });
    b.stun(mon, 0.6, 'confusion');
    return true;
  }
  const shape = shapeFor(id);
  let dur = windupFor(mv, shape);
  if (itemActive(mon) === 'quickclaw' && b.rng.chance(20)) { dur = 0.02; b.say(`A Quick Claw de ${mon.name} agiu!`); }
  if (id === 'grassyglide' && b.field.terrain?.id === 'grassyterrain' && isGrounded(b, mon)) dur = 0.08;
  mon.action = { type: 'windup', t: 0, dur, id, slot, aim, pri: mv.pri };
  b.setAnim(mon, shape.anim || 'Attack', dur + 0.25);
  b.emit({ t: 'moveStart', mon, id });
  b.moveLabel(mon, id === 'struggle' ? 'Struggle' : mv.name);
  return true;
}

// ---------------------------------------------------------------- execução
const CALLERS = ['metronome', 'sleeptalk', 'assist', 'naturepower', 'mimic', 'snatch'];
const NO_METRONOME = new Set(['metronome', 'struggle', 'assist', 'sleeptalk', 'mimic', 'naturepower', 'counter', 'mirrorcoat', 'protect', 'detect', 'endure', 'snatch', 'helpinghand', 'followme', 'feint', 'focuspunch', 'bide', 'holdhands', 'celebrate']);

export function newExec(b, user, mv, opts = {}) {
  return { user, mv, id: mv.id, hitAny: false, selfDone: false, pending: 0, finalized: false, slot: opts.slot ?? null, called: !!opts.called, aimManual: !!opts.aim };
}

export function executeMove(b, user, id, aim, opts = {}) {
  if (!user.onField || user.fainted) return;
  const raw = MOVES[id];
  const prevActed = user.actedSinceEntry;
  user.actedSinceEntry = true;
  if (!opts.called && !opts.auto) {
    if (user.vol.rage && id !== 'rage') delete user.vol.rage;
  }
  if (!opts.called) {
    user.lastMove = id;
    user.lastMoveAt = b.time;
  }

  // golpes que chamam outro golpe
  if (id === 'metronome') {
    const pool = Object.values(MOVES).filter(m => m.flags.includes('metronome') && !NO_METRONOME.has(m.id));
    const pick = b.rng.pick(pool);
    b.say(`Metronome virou ${pick.name}!`);
    b.moveLabel(user, pick.name);
    return executeMove(b, user, pick.id, aim, { ...opts, called: true });
  }
  if (id === 'sleeptalk') {
    const pool = user.moves.map(m => m.mimic || m.id).filter(m => m !== 'sleeptalk' && !MOVES[m].flags.includes('nosleeptalk') && !MOVES[m].flags.includes('charge'));
    if (user.status !== 'slp' || !pool.length) return failMove(b, user);
    const pick = b.rng.pick(pool);
    b.moveLabel(user, MOVES[pick].name);
    return executeMove(b, user, pick, aim, { ...opts, called: true });
  }
  if (id === 'assist') {
    const pool = [];
    for (const m of b.sides[user.side].mons) if (m !== user) for (const s of m.moves) if (!MOVES[s.id].flags.includes('noassist') && s.id !== 'assist') pool.push(s.id);
    if (!pool.length) return failMove(b, user);
    const pick = b.rng.pick(pool);
    b.moveLabel(user, MOVES[pick].name);
    return executeMove(b, user, pick, aim, { ...opts, called: true });
  }
  if (id === 'naturepower') {
    const pick = b.field.terrain?.id === 'grassyterrain' ? 'energyball' : { grass: 'energyball', water: 'hydropump', ice: 'icebeam' }[b.arena] || 'triattack';
    b.say(`Nature Power virou ${MOVES[pick].name}!`);
    b.moveLabel(user, MOVES[pick].name);
    return executeMove(b, user, pick, aim, { ...opts, called: true });
  }

  const mv = H.liveMove(b, user, id);
  const shape = shapeFor(id);
  const foe = b.foeActive(user);

  // condições de falha antes de soltar o golpe
  if (id === 'fakeout' && (prevActed || b.time - user.enteredAt > 2.5)) return failMove(b, user);
  if (id === 'upperhand') {
    const a = foe?.action;
    if (!(a && (a.type === 'windup' || a.type === 'charge') && a.pri > 0)) return failMove(b, user);
  }
  if (['helpinghand', 'followme', 'holdhands', 'dragoncheer', 'allyswitch'].includes(id)) return failMove(b, user);
  if (id === 'suckerpunch') {
    // só funciona se o alvo estiver preparando um ataque
    const a = foe?.action;
    if (!(a && ['windup', 'charge'].includes(a.type) && MOVES[a.id]?.cat !== 'Status')) return failMove(b, user);
  }
  if (id === 'poltergeist' && !foe?.item) return failMove(b, user);
  if (id === 'steelroller' && !b.field.terrain) return failMove(b, user);
  if (id === 'rototiller' && !(hasType(user, 'Grass') && isGrounded(b, user))) return failMove(b, user);
  if (id === 'snore' && user.status !== 'slp') return failMove(b, user);
  if (mv.cat !== 'Status' && b.field.weather?.id === 'primordialsea' && mv.type === 'Fire') {
    b.say('O ataque de Fogo se apagou na chuva torrencial!');
    return failMove(b, user);
  }
  if (mv.cat !== 'Status' && b.field.weather?.id === 'desolateland' && mv.type === 'Water') {
    b.say('O ataque de Água evaporou no sol extremo!');
    return failMove(b, user);
  }
  if (id === 'naturalgift' && !ITEMS[itemActive(user)]?.berry) return failMove(b, user);
  if (id === 'fling' && (!itemActive(user) || !itemRemovable(user))) return failMove(b, user);

  // golpes de dois turnos (carga)
  const chargeTime = shape.charge || 0;
  if (chargeTime && !opts.charged) {
    let skip = id === 'solarbeam' && isSun(weatherFor(b, user));
    if (!skip && itemActive(user) === 'powerherb') {
      H.consumeItem(b, user);
      b.say(`${user.name} ficou pronto na hora com a Power Herb!`);
      skip = true;
    }
    if (!skip) {
      const msg = {
        solarbeam: `${user.name} está absorvendo luz!`, skullbash: `${user.name} abaixou a cabeça!`,
        razorwind: `${user.name} criou um redemoinho!`, focuspunch: `${user.name} está se concentrando!`,
      }[id];
      if (msg) b.say(msg);
      if (id === 'skullbash') H.boost(b, user, { def: 1 }, user, mv);
      if (id === 'meteorbeam') H.boost(b, user, { spa: 1 }, user, mv);
      user.action = { type: 'charge', t: 0, dur: chargeTime, id, aim, called: opts.called, slot: opts.slot, pri: mv.pri };
      b.setAnim(user, 'Charge', chargeTime);
      b.emit({ t: 'charge', mon: user, id });
      return;
    }
  }
  if (id === 'focuspunch' && opts.lostFocus) {
    b.say(`${user.name} perdeu a concentração e não atacou!`);
    return failMove(b, user);
  }

  const exec = newExec(b, user, mv, { ...opts, aim });
  if (raw.self?.volatileStatus === 'lockedmove' && !opts.auto && !user.vol.lockedmove) {
    user.vol.lockedmove = { id, left: b.rng.int(1, 2), next: b.time + 1.0, slot: opts.slot };
  }
  if (raw.self?.volatileStatus === 'rage') user.vol.rage = {};
  if (id === 'furycutter') {
    const fc = user.vol.furycutter;
    if (!fc || b.time - fc.at > 3.5) user.vol.furycutter = { count: 0, at: b.time };
  }
  if (id === 'echoedvoice') {
    const ev = b.field.echoedvoice;
    b.field.echoedvoice = ev && b.time - ev.at < FIELD_TURN ? { count: Math.min(4, ev.count + 1), at: b.time } : { count: 0, at: b.time };
  }
  if (id === 'fling') {
    exec.flungItem = user.item;
    H.consumeItem(b, user);
  }
  if (id === 'naturalgift') {
    H.consumeItem(b, user);
  }

  b.deliver(user, exec, shape, aim);
  return exec;
}

export function failMove(b, user, msg = 'Mas falhou!') {
  if (msg) b.say(msg);
  user.lastMoveFailed = true;
  user.action = { type: 'endlag', t: 0, dur: 0.25 };
}

// ---------------------------------------------------------------- golpes de status em si mesmo / no campo
export function selfMove(b, user, exec) {
  const mv = exec.mv;
  const id = mv.id;
  // Snatch: o adversário rouba o efeito de golpes "roubáveis"
  const foe = b.foeActive(user);
  if (mv.flags.includes('snatch') && foe?.vol.snatch) {
    delete foe.vol.snatch;
    b.say(`${foe.name} roubou o efeito de ${mv.name}!`);
    return selfMove(b, foe, { ...exec, user: foe });
  }
  const turns = n => n * FIELD_TURN;
  const w = weatherFor(b, user);
  const heal = frac => H.healMon(b, user, user.maxhp * frac);
  const ok = () => { exec.hitAny = true; };
  const fail = (msg = 'Mas falhou!') => { b.say(msg); };
  switch (id) {
    case 'growth': ok(); return H.boost(b, user, isSun(w) ? { atk: 2, spa: 2 } : { atk: 1, spa: 1 }, user, mv, { fromMove: true });
    case 'curse':
      // Fantasma: gasta metade dos PS e amaldiçoa o alvo; outros tipos: Vel -1, Atq +1, Def +1
      if (hasType(user, 'Ghost')) {
        if (!foe || foe.vol.curse) return fail();
        H.damageMon(b, user, user.maxhp / 2, { direct: true });
        foe.vol.curse = {};
        b.say(`${user.name} cortou os próprios PS e amaldiçoou ${foe.name}!`);
        b.emit({ t: 'statusHit', mon: foe, by: user, mv });
        return ok();
      }
      ok(); return H.boost(b, user, { spe: -1, atk: 1, def: 1 }, user, mv, { fromMove: true });
    case 'autotomize':
      ok();
      H.boost(b, user, { spe: 2 }, user, mv, { fromMove: true });
      if (user.weightkg > 0.1) { user.weightkg = Math.max(0.1, user.weightkg - 100); b.say(`${user.name} ficou mais leve!`); }
      return;
    case 'magnetrise':
      if (user.vol.magnetrise || user.vol.smackdown || user.vol.ingrain) return fail();
      user.vol.magnetrise = { t: FIELD_TURN * 5 };
      b.say(`${user.name} levitou com eletromagnetismo!`);
      return ok();
    case 'destinybond':
      user.vol.destinybond = { t: FIELD_TURN };
      b.say(`${user.name} está tentando levar o adversário junto!`);
      return ok();
    case 'grudge':
      user.vol.grudge = {};
      b.say(`${user.name} quer que o adversário guarde rancor!`);
      return ok();
    case 'imprison':
      if (user.vol.imprison) return fail();
      user.vol.imprison = {};
      b.say(`${user.name} selou os golpes que conhece!`);
      return ok();
    case 'wideguard':
      user.vol.wideguard = { t: 1.2 };
      b.say('O Wide Guard protege o time!');
      b.emit({ t: 'protectUp', mon: user });
      return ok();
    case 'perishsong': {
      const mons = [user, foe].filter(Boolean);
      for (const m of mons) if (!m.vol.perish) m.vol.perish = { t: FIELD_TURN * 3 };
      b.say('Todos que ouviram a canção vão desmaiar em 3 turnos!');
      return ok();
    }
    case 'stealthrock': case 'toxicspikes': {
      const hz = b.sides[1 - user.side].hazards;
      if (id === 'stealthrock') { if (hz.stealthrock) return fail(); hz.stealthrock = true; b.say('Pedras pontudas flutuam em volta do lado adversário!'); }
      else { if (hz.toxicspikes >= 2) return fail(); hz.toxicspikes++; b.say('Espinhos venenosos se espalharam pelo lado adversário!'); }
      b.emit({ t: 'hazard', side: 1 - user.side, id });
      return ok();
    }
    case 'trickroom':
      b.field.trickroom = b.field.trickroom > 0 ? 0 : FIELD_TURN * 5;
      b.say(b.field.trickroom ? `${user.name} distorceu as dimensões!` : 'As dimensões voltaram ao normal.');
      b.emit({ t: 'room', id: 'trickroom', on: b.field.trickroom > 0 });
      return ok();
    case 'wonderroom':
      b.field.wonderroom = b.field.wonderroom > 0 ? 0 : FIELD_TURN * 5;
      b.say(b.field.wonderroom ? 'Defesa e Defesa Especial foram trocadas!' : 'A Wonder Room acabou.');
      b.emit({ t: 'room', id: 'wonderroom', on: b.field.wonderroom > 0 });
      return ok();
    case 'rototiller':
      ok();
      return H.boost(b, user, { atk: 1, spa: 1 }, user, mv, { fromMove: true });
    case 'bellydrum':
      if (user.hp * 2 <= user.maxhp || user.boosts.atk >= 6) return fail();
      H.damageMon(b, user, Math.floor(user.maxhp / 2), { direct: true });
      user.boosts.atk = 6;
      b.say(`${user.name} cortou os próprios PS e maximizou o Ataque!`);
      b.emit({ t: 'boost', mon: user, stat: 'atk', delta: 6 });
      return ok();
    case 'rest':
      if (user.hp === user.maxhp || hasAbility(user, 'insomnia')) return fail();
      H.cureStatus(b, user, true);
      user.hp = user.maxhp;
      b.text(user, 'PS cheio', '#7df07d');
      H.applyStatus(b, user, 'slp', user, mv, { rest: true });
      b.say(`${user.name} dormiu e se recuperou!`);
      return ok();
    case 'synthesis': case 'morningsun': {
      const frac = isSun(w) ? 2 / 3 : w ? 0.25 : 0.5;
      if (user.hp === user.maxhp) return fail(`Os PS de ${user.name} já estão cheios!`);
      heal(frac);
      return ok();
    }
    case 'roost':
      if (user.hp === user.maxhp) return fail(`Os PS de ${user.name} já estão cheios!`);
      heal(0.5);
      user.vol.roost = { t: FIELD_TURN };
      if (hasType(user, 'Flying') && user.semiInv === null) b.say(`${user.name} pousou para descansar!`);
      return ok();
    case 'lifedew':
      if (user.hp === user.maxhp) return fail(`Os PS de ${user.name} já estão cheios!`);
      heal(0.25);
      return ok();
    case 'substitute':
      if (user.vol.substitute) return fail(`${user.name} já tem um substituto!`);
      if (user.hp <= user.maxhp / 4) return fail('Não tem PS suficiente para o substituto!');
      H.damageMon(b, user, Math.floor(user.maxhp / 4), { direct: true });
      user.vol.substitute = { hp: Math.floor(user.maxhp / 4) };
      delete user.vol.partiallytrapped;
      b.say(`${user.name} criou um substituto!`);
      b.emit({ t: 'sub', mon: user });
      return ok();
    case 'protect': case 'detect': case 'endure': {
      const last = user.vol.stall;
      const recent = last && b.time - last.at < 2.8;
      const chance = recent ? 100 / 3 ** last.count : 100;
      if (!b.rng.chance(chance)) { user.vol.stall = { at: b.time, count: 0 }; return fail(); }
      user.vol.stall = { at: b.time, count: recent ? last.count + 1 : 1 };
      if (id === 'endure') { user.vol.endure = { t: 1.0 }; b.say(`${user.name} se preparou para aguentar!`); }
      else { user.vol.protect = { t: 0.95 }; b.say(`${user.name} se protegeu!`); b.emit({ t: 'protectUp', mon: user }); }
      return ok();
    }
    case 'haze':
      for (const s of b.sides) if (s.active) for (const k of Object.keys(s.active.boosts)) s.active.boosts[k] = 0;
      b.say('Todos os atributos voltaram ao normal!');
      b.emit({ t: 'haze' });
      return ok();
    case 'batonpass':
      if (!b.switchOptions(user.side).length) return fail();
      ok();
      return b.selfSwitch(user, { baton: true });
    case 'celebrate':
      b.say(`Parabéns, ${b.sides[user.side].name}!`);
      return ok();
    case 'refresh':
      if (!['brn', 'par', 'psn', 'tox'].includes(user.status)) return fail();
      H.cureStatus(b, user);
      return ok();
    case 'aquaring':
      if (user.vol.aquaring) return fail();
      user.vol.aquaring = {};
      b.say(`${user.name} se cercou com um véu de água!`);
      return ok();
    case 'ingrain':
      if (user.vol.ingrain) return fail();
      user.vol.ingrain = {};
      b.say(`${user.name} criou raízes!`);
      return ok();
    case 'laserfocus':
      user.vol.laserfocus = { t: FIELD_TURN };
      b.say(`${user.name} se concentrou intensamente!`);
      return ok();
    case 'snatch':
      user.vol.snatch = { t: 2.0 };
      b.say(`${user.name} está esperando o adversário usar um golpe!`);
      return ok();
    case 'defensecurl':
      user.vol.defensecurl = {};
      ok();
      return H.boost(b, user, { def: 1 }, user, mv, { fromMove: true });
    case 'mudsport':
      if (b.field.mudsport > 0) return fail();
      b.field.mudsport = turns(5);
      b.say('O poder dos golpes Elétricos enfraqueceu!');
      return ok();
    case 'grassyterrain':
      if (b.field.terrain?.id === 'grassyterrain') return fail();
      b.setTerrain('grassyterrain', 5);
      return ok();
    case 'sunnyday': case 'raindance': case 'sandstorm': case 'hail': case 'snowscape': {
      const wid = id === 'snowscape' ? 'snow' : id;
      const rock = ITEMS[itemActive(user)]?.weather;
      const long = rock === wid || (rock === 'hail' && wid === 'snow');
      if (b.setWeather(wid, long ? 8 : 5)) ok();
      return;
    }
    case 'reflect': case 'lightscreen': case 'safeguard': case 'mist': case 'tailwind': {
      const conds = b.sides[user.side].conds;
      if (conds[id] > 0) return fail();
      const n = id === 'tailwind' ? 4 : (id === 'reflect' || id === 'lightscreen') && itemActive(user) === 'lightclay' ? 8 : 5;
      conds[id] = turns(n);
      b.say({
        reflect: 'Reflect aumentou a resistência a golpes físicos!', lightscreen: 'Light Screen aumentou a resistência a golpes especiais!',
        safeguard: 'O time está protegido pelo Safeguard!', mist: 'O time ficou envolto em névoa!', tailwind: 'Um vento de cauda soprou!',
      }[id]);
      b.emit({ t: 'sideCond', side: user.side, id });
      return ok();
    }
    default:
      if (mv.boosts) { ok(); H.boost(b, user, mv.boosts, user, mv, { fromMove: true }); }
      if (mv.heal) { if (user.hp === user.maxhp) return fail(`Os PS de ${user.name} já estão cheios!`); heal(mv.heal[0] / mv.heal[1]); ok(); }
      if (!mv.boosts && !mv.heal) fail();
  }
}

// ---------------------------------------------------------------- golpe acertou o alvo
// Retorna: 'hit', 'miss', 'blocked', 'immune', 'fail', 'none' (passou direto) ou 'dodged'
export function strike(b, user, target, exec, ctx = {}) {
  const mv = ctx.mv || exec.mv;
  if (!target || target.fainted || !target.onField) return 'none';
  if (target.semiInv && !H.hitsSemiInvulnerable(mv, target.semiInv)) return 'none';
  if (target.airborne && mv.type === 'Ground' && mv.cat !== 'Status') return 'none';
  if (target.iframes > 0 && !ctx.unavoidable) {
    b.perfectDodge(target);
    return 'dodged';
  }
  if (target.action?.type === 'switching' && mv.id !== 'pursuit') return 'none';
  if (target.action?.type === 'entering') return 'none';
  if (target.vol.protect && mv.flags.includes('protect') && !ctx.unavoidable) {
    if (mv.id === 'feint' || mv.id === 'phantomforce') {
      delete target.vol.protect;
      b.say(`${target.name} teve a proteção quebrada!`);
    } else {
      b.say(`${target.name} se protegeu!`);
      b.emit({ t: 'protect', mon: target });
      return 'blocked';
    }
  }
  const volley = ctx.volley;
  const firstOfVolley = !volley || !volley.checked;
  if (firstOfVolley || mv.multiacc) {
    if (mv.cat !== 'Status') {
      if (H.typeEffect(b, user, target, mv) === 0) {
        b.say(`Não afeta ${target.name}...`);
        b.text(target, 'Imune', '#bbbbbb');
        if (volley) { volley.checked = true; volley.ok = false; }
        return 'immune';
      }
      if (mv.id === 'dreameater' && target.status !== 'slp') { b.say(`Não afeta ${target.name}...`); return 'immune'; }
    }
    if (mv.ohko && hasAbility(target, 'sturdy')) { b.say(`${target.name} aguentou com Sturdy!`); return 'immune'; }
    if (mv.id === 'thunderwave' && effectiveness('Electric', target.types) === 0) { b.say(`Não afeta ${target.name}...`); return 'immune'; }
    if (mv.flags.includes('powder') && hasType(target, 'Grass')) {
      b.say(`Não afeta ${target.name}...`);
      b.text(target, 'Imune', '#bbbbbb');
      return 'immune';
    }
    if (!H.accuracyCheck(b, user, target, mv, ctx)) {
      b.text(target, 'Errou!', '#dddddd');
      b.say(`O ataque de ${user.name} errou!`);
      if (volley) { volley.checked = true; volley.ok = false; }
      return 'miss';
    }
    if (volley) { volley.checked = true; volley.ok = true; }
  } else if (!volley.ok) return 'miss';

  if (mv.cat === 'Status') return statusHit(b, user, target, exec, mv, ctx);

  if (target.vol.wideguard && ['allAdjacent', 'allAdjacentFoes'].includes(mv.target)) {
    b.say(`O Wide Guard protegeu ${target.name}!`);
    b.emit({ t: 'protect', mon: target });
    return 'blocked';
  }
  if (mv.id === 'brickbreak' || mv.id === 'psychicfangs') {
    const conds = b.sides[target.side].conds;
    if (conds.reflect > 0 || conds.lightscreen > 0) { conds.reflect = 0; conds.lightscreen = 0; b.say('As barreiras foram quebradas!'); }
  }
  const res = H.calcDamage(b, user, target, mv, { ...ctx, flungItem: exec.flungItem });
  if (res.ohko) b.say('Um golpe só! Nocaute!');
  const dealt = H.damageMon(b, target, res.damage, { source: user, mv });
  exec.hitAny = true;
  if (res.crit && dealt !== 0) { b.text(target, 'Crítico!', '#ffd84a', 1); b.say('Um acerto crítico!'); }
  const et = H.effText(res.eff);
  if (et && dealt !== -1) { b.text(target, res.eff > 1 ? 'Super eficaz!' : 'Pouco eficaz', res.eff > 1 ? '#ff7a3d' : '#9fb4c8', 1); b.say(et); }
  b.emit({ t: 'hit', mon: target, by: user, mv, eff: res.eff, crit: res.crit, dmg: dealt, x: target.x, y: target.y });

  if (dealt > 0 && !target.fainted) {
    const heavy = Math.min(1, (res.damage / target.maxhp) * 3);
    target.hitstun = Math.max(target.hitstun, 0.1 + 0.2 * heavy);
    const ang = ctx.dir ?? Math.atan2(target.y - user.y, target.x - user.x);
    const push = 120 + 360 * heavy * (mv.id === 'seismictoss' ? 3 : 1);
    target.kx += Math.cos(ang) * push;
    target.ky += Math.sin(ang) * push;
    b.setAnim(target, 'Hurt', 0.3);
  }
  // dreno, recuo, Life Orb, Shell Bell
  if (mv.drain && dealt > 0) {
    let amount = (dealt * mv.drain[0]) / mv.drain[1];
    if (itemActive(user) === 'bigroot') amount *= 1.3;
    H.healMon(b, user, amount);
  }
  if (mv.recoil && dealt > 0 && !hasAbility(user, 'rockhead')) {
    H.damageMon(b, user, (dealt * mv.recoil[0]) / mv.recoil[1], { direct: true });
    b.say(`${user.name} se feriu com o impacto!`);
  }
  if (mv.id === 'struggle') H.damageMon(b, user, user.maxhp / 4 / HP_SCALE, { direct: true });
  // Life Orb e Rocky Helmet tiram o mesmo tanto de PS que nos jogos (não escalam com HP_SCALE),
  // porque aqui se ataca bem mais vezes que um golpe por turno
  if (dealt > 0 && itemActive(user) === 'lifeorb') H.damageMon(b, user, user.maxhp / 10 / HP_SCALE, { direct: true });
  if (dealt > 0 && itemActive(user) === 'shellbell') H.healMon(b, user, dealt / 8);
  if (target.status === 'frz' && dealt !== -1 && (mv.type === 'Fire' || mv.thaws)) H.cureStatus(b, target);

  // efeitos secundários e especiais
  H.secondaries(b, user, target, mv, dealt);
  if (exec.flungItem && dealt !== -1 && !target.fainted) {
    if (exec.flungItem === 'kingsrock') H.addVolatile(b, target, 'flinch', user, mv);
    if (exec.flungItem === 'flameorb') H.applyStatus(b, target, 'brn', user, mv);
    if (exec.flungItem === 'toxicorb') H.applyStatus(b, target, 'tox', user, mv);
  }
  if (mv.id === 'secretpower' && dealt !== -1 && !target.fainted && b.rng.chance(30)) {
    const effect = b.field.terrain?.id === 'grassyterrain' ? 'slp' : { grass: 'slp', water: 'atk', ice: 'frz' }[b.arena] || 'par';
    if (effect === 'atk') H.boost(b, target, { atk: -1 }, user, mv);
    else H.applyStatus(b, target, effect, user, mv);
  }
  if (mv.id === 'knockoff' && dealt !== -1 && target.item && itemRemovable(target)) {
    b.say(`${user.name} derrubou o item ${ITEMS[target.item].name} de ${target.name}!`);
    target.item = null;
    b.emit({ t: 'item', mon: target });
  }
  if (mv.id === 'thief' && dealt !== -1 && !user.item && target.item && itemRemovable(target)) {
    user.item = target.item;
    target.item = null;
    b.say(`${user.name} roubou ${ITEMS[user.item].name} de ${target.name}!`);
    b.emit({ t: 'item', mon: target });
  }
  if (mv.id === 'incinerate' && dealt !== -1 && ITEMS[target.item]?.berry) {
    b.say(`A ${ITEMS[target.item].name} de ${target.name} queimou!`);
    target.item = null;
  }
  if (mv.id === 'rapidspin' && !user.fainted) {
    delete user.vol.leechseed;
    delete user.vol.partiallytrapped;
  }
  if ((mv.id === 'icespinner' || mv.id === 'steelroller') && b.field.terrain) b.clearTerrain();
  if (mv.id === 'clearsmog' && dealt !== -1 && !target.fainted) {
    for (const k of Object.keys(target.boosts)) target.boosts[k] = 0;
    b.say(`As mudanças de atributo de ${target.name} foram desfeitas!`);
  }
  if (mv.id === 'steelbeam' && !user.fainted) {
    H.damageMon(b, user, user.maxhp / 4, { direct: true });
    b.say(`${user.name} se feriu com o próprio raio!`);
  }
  if (mv.id === 'furycutter' && user.vol.furycutter) user.vol.furycutter = { count: Math.min(2, user.vol.furycutter.count + 1), at: b.time };
  if (mv.id === 'tripleaxel') ctx.hitLanded = true;

  // contato
  if (mv.flags.includes('contact') && dealt !== 0) {
    if (itemActive(target) === 'rockyhelmet' && !user.fainted) {
      H.damageMon(b, user, user.maxhp / 6 / HP_SCALE, { direct: true });
      b.say(`${user.name} se machucou no Rocky Helmet!`);
    }
    if (hasAbility(target, 'pickpocket') && !target.fainted && !target.item && user.item && itemRemovable(user)) {
      target.item = user.item;
      user.item = null;
      b.say(`${target.name} roubou ${ITEMS[target.item].name} de ${user.name} com Pickpocket!`);
      b.emit({ t: 'item', mon: user });
    }
  }
  // reações do alvo
  if (dealt > 0 && !target.fainted) {
    if (target.vol.rage) H.boost(b, target, { atk: 1 }, target, null);
    if (res.eff > 1 && itemActive(target) === 'weaknesspolicy') {
      H.consumeItem(b, target);
      H.boost(b, target, { atk: 2, spa: 2 }, target, null);
    }
    if (itemActive(target) === 'airballoon') {
      H.consumeItem(b, target);
      b.say(`O balão de ${target.name} estourou!`);
    }
    if (target.action?.type === 'stance' && target.action.mode !== 'bide') stanceRetaliate(b, target, user, mv, dealt);
  }
  if (dealt > 0 && !target.fainted && hasAbility(target, 'cursedbody') && !user.vol.disable && b.rng.chance(30)) {
    const slot = user.moves.findIndex(m => (m.mimic || m.id) === exec.id);
    if (slot >= 0) {
      user.vol.disable = { t: FIELD_TURN * 4, slot };
      b.say(`O Cursed Body de ${target.name} desativou ${mv.name}!`);
    }
  }
  applySelfEffects(b, user, exec);
  if (mv.forceSwitch && dealt !== -1 && !target.fainted) b.forceSwitch(target);
  return 'hit';
}

// efeitos no próprio usuário que acontecem uma vez por golpe (Overheat, Scale Shot, Hyper Beam...)
export function applySelfEffects(b, user, exec) {
  if (exec.selfDone) return;
  exec.selfDone = true;
  const raw = MOVES[exec.id];
  if (raw.self?.boosts) H.boost(b, user, raw.self.boosts, user, exec.mv);
  if (raw.selfBoost?.boosts) H.boost(b, user, raw.selfBoost.boosts, user, exec.mv);
  if (raw.self?.volatileStatus === 'mustrecharge') exec.mustRecharge = true;
  if (raw.selfSwitch === true) exec.selfSwitch = true;
}

function stanceRetaliate(b, mon, attacker, mv, dealt) {
  const mode = mon.action.mode;
  const wanted = mode === 'counter' ? 'Physical' : 'Special';
  if (mv.cat !== wanted || attacker.side === mon.side) return;
  const counterMove = MOVES[mode];
  const eff = H.typeEffect(b, mon, attacker, counterMove);
  const exec = mon.action.exec;
  mon.action = { type: 'endlag', t: 0, dur: 0.2 };
  if (eff === 0) { b.say(`Não afeta ${attacker.name}...`); return; }
  b.say(`${mon.name} revidou com ${counterMove.name}!`);
  b.emit({ t: 'counter', mon, target: attacker });
  H.damageMon(b, attacker, dealt * 2, { source: mon, mv: counterMove });
  if (exec) exec.hitAny = true;
}

// ---------------------------------------------------------------- status no alvo
function statusHit(b, user, target, exec, mv, ctx) {
  const id = mv.id;
  const loud = { fromMove: true };
  const subBlocks = target.vol.substitute && !H.bypassSub(mv) && target !== user;
  const fail = (msg = 'Mas falhou!') => { b.say(msg); return 'fail'; };
  const done = () => { exec.hitAny = true; b.emit({ t: 'statusHit', mon: target, by: user, mv }); return 'hit'; };
  if (subBlocks && !['roar', 'spite', 'encore', 'taunt', 'torment', 'psychup', 'mimic', 'attract', 'embargo', 'block'].includes(id)) return fail();
  switch (id) {
    case 'swagger':
      H.boost(b, target, { atk: 2 }, user, mv, loud);
      H.addVolatile(b, target, 'confusion', user, mv, loud);
      return done();
    case 'captivate':
      if (user.gender === 'N' || target.gender === 'N' || user.gender === target.gender) return fail();
      H.boost(b, target, { spa: -2 }, user, mv, loud);
      return done();
    case 'psychup':
      user.boosts = { ...target.boosts };
      b.say(`${user.name} copiou as mudanças de atributo de ${target.name}!`);
      return done();
    case 'spite': {
      const slot = target.moves.findIndex(m => (m.mimic || m.id) === target.lastMove);
      if (slot < 0) return fail();
      target.moves[slot].cd = Math.max(target.moves[slot].cd, 5);
      target.moves[slot].cdMax = Math.max(target.moves[slot].cdMax, 5);
      target.stamina = Math.max(0, target.stamina - 30);
      b.say(`${target.name} perdeu energia de ${MOVES[target.lastMove].name}!`);
      return done();
    }
    case 'mimic': {
      const last = target.lastMove;
      if (!last || ['mimic', 'struggle', 'metronome', 'sleeptalk'].includes(last) || user.moves.some(m => (m.mimic || m.id) === last)) return fail();
      const slot = user.moves.findIndex(m => m.id === 'mimic');
      if (slot < 0) return fail();
      user.moves[slot].mimic = last;
      b.say(`${user.name} aprendeu ${MOVES[last].name}!`);
      return done();
    }
    case 'roar':
      if (!b.switchOptions(target.side).length || target.vol.ingrain) return fail();
      b.forceSwitch(target);
      return done();
    case 'worryseed':
      if (target.ability === 'insomnia') return fail();
      target.ability = 'insomnia';
      b.say(`A habilidade de ${target.name} virou Insomnia!`);
      if (target.status === 'slp') H.cureStatus(b, target);
      return done();
    case 'defog': {
      H.boost(b, target, { evasion: -1 }, user, mv, loud);
      for (const s of b.sides) for (const k of ['reflect', 'lightscreen', 'safeguard', 'mist']) if (s.index === target.side) s.conds[k] = 0;
      if (b.field.terrain) b.clearTerrain();
      b.say('O vento varreu as barreiras!');
      return done();
    }
    case 'disable':
      if (H.addVolatile(b, target, 'disable', user, mv, loud)) return done();
      return 'fail';
    case 'meanlook':
      H.addVolatile(b, target, 'trapped', user, mv, loud);
      return done();
    case 'telekinesis':
      if (H.addVolatile(b, target, 'telekinesis', user, mv, loud)) return done();
      return 'fail';
    case 'painsplit': {
      const avg = Math.floor((user.hp / user.maxhp + target.hp / target.maxhp) / 2 * 1000) / 1000;
      user.hp = Math.max(1, Math.round(user.maxhp * avg));
      target.hp = Math.max(1, Math.round(target.maxhp * avg));
      b.say('Os dois dividiram os PS!');
      return done();
    }
    case 'reflecttype':
      user.types = [...target.types];
      b.say(`${user.name} copiou o tipo de ${target.name}!`);
      return done();
    case 'roleplay':
      if (target.ability === user.ability) return fail();
      user.ability = target.ability;
      b.say(`${user.name} copiou a habilidade de ${target.name}!`);
      return done();
    case 'skillswap':
      if (target.isMega || user.isMega) return fail();
      [user.ability, target.ability] = [target.ability, user.ability];
      b.say(`${user.name} trocou de habilidade com ${target.name}!`);
      return done();
    case 'trick': {
      if ((!user.item && !target.item) || (user.item && !itemRemovable(user)) || (target.item && !itemRemovable(target))) return fail();
      [user.item, target.item] = [target.item, user.item];
      b.say(`${user.name} trocou de item com ${target.name}!`);
      b.emit({ t: 'item', mon: target });
      return done();
    }
    case 'corrosivegas':
      if (!target.item || !itemRemovable(target)) return fail();
      b.say(`O gás corroeu o item ${ITEMS[target.item].name} de ${target.name}!`);
      target.item = null;
      return done();
    case 'block':
      H.addVolatile(b, target, 'trapped', user, mv, loud);
      return done();
    default: {
      let any = false;
      if (mv.status) any = H.applyStatus(b, target, mv.status, user, mv, loud) || any;
      if (mv.boosts) any = H.boost(b, target, mv.boosts, user, mv, loud) || any;
      if (mv.vol) any = H.addVolatile(b, target, mv.vol, user, mv, loud) || any;
      return any ? done() : 'fail';
    }
  }
}
