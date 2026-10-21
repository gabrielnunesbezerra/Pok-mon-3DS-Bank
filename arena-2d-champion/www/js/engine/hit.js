// O que acontece quando um golpe acerta: precisão, dano, status, atributos, itens e habilidades.
// Segue as regras dos jogos principais (fórmula de dano da 5ª geração em diante); só o "turno"
// virou tempo (ver constants.js).
import { MOVES, ITEMS, STAT_PT, STATUS_PT, TYPE_PT, effectiveness } from '../data/dex.js';
import { LEVEL, FIELD_TURN, ACTION_TURN, BOOST_DURATION } from './constants.js';
import {
  getStat, getSpeed, hasType, hasAbility, itemActive, isGrounded, weatherFor, isSun, isRain, accMult, hpFrac, itemRemovable,
  moldBreaks, strongWinds,
} from './mon.js';

// ---------------------------------------------------------------- golpe "vivo"
// Cópia do golpe com tipo, categoria e poder ajustados ao momento (Weather Ball, Hidden Power...)
export function liveMove(b, user, id) {
  const base = MOVES[id];
  const mv = { ...base, flags: base.flags };
  const w = weatherFor(b, user);
  if (id === 'weatherball' && w) {
    mv.type = isSun(w) ? 'Fire' : isRain(w) ? 'Water' : w === 'sandstorm' ? 'Rock' : 'Ice';
  }
  if (id === 'hiddenpower') mv.type = user.hpType;
  if (id === 'naturalgift') {
    const berry = ITEMS[itemActive(user)]?.berry;
    if (berry) mv.type = berry.type;
  }
  if (id === 'terrainpulse' && b.field.terrain && isGrounded(b, user)) mv.type = 'Grass';
  if (id === 'terablast' && getStat(b, user, 'atk') > getStat(b, user, 'spa')) mv.cat = 'Physical';
  // Pixilate: golpes Normais viram Fada (e ficam 20% mais fortes em calcDamage)
  if (hasAbility(user, 'pixilate') && mv.type === 'Normal' && mv.cat !== 'Status' && id !== 'struggle') { mv.type = 'Fairy'; mv.ate = true; }
  // Aerilate: golpes Normais viram Voadores
  if (hasAbility(user, 'aerilate') && mv.type === 'Normal' && mv.cat !== 'Status' && id !== 'struggle') { mv.type = 'Flying'; mv.ate = true; }
  // Prankster: golpes de status saem com prioridade
  if (hasAbility(user, 'prankster') && mv.cat === 'Status') { mv.pri += 1; mv.prankster = true; }
  return mv;
}

export function hitsSemiInvulnerable(mv, mode) {
  if (mode === 'fly') return ['hurricane', 'twister', 'smackdown', 'thunder', 'skyuppercut', 'gust'].includes(mv.id);
  if (mode === 'dig') return ['earthquake', 'magnitude', 'fissure'].includes(mv.id);
  if (mode === 'dive') return ['surf', 'whirlpool'].includes(mv.id);
  return false; // Phantom Force: nada acerta
}

const bypassSub = mv => mv.flags.includes('sound') || mv.flags.includes('bypasssub');

// ---------------------------------------------------------------- poder base
export function basePower(b, user, target, mv, ctx) {
  let bp = mv.bp;
  const opp = target;
  switch (mv.id) {
    case 'acrobatics': return itemActive(user) ? 55 : 110;
    case 'avalanche': case 'revenge':
      return user.lastDamagedBy === opp.uid && b.time - user.lastDamagedAt < 1.6 ? bp * 2 : bp;
    case 'assurance': return b.time - opp.lastDamagedAt < 1.0 ? 120 : 60;
    case 'beatup': return ctx.beatUpPower || 10;
    case 'brine': return opp.hp * 2 <= opp.maxhp ? 130 : 65;
    case 'echoedvoice': return Math.min(200, 40 * (1 + (b.field.echoedvoice?.count || 0)));
    case 'facade': return user.status && user.status !== 'slp' && user.status !== 'frz' ? 140 : 70;
    case 'flail': case 'reversal': {
      const r = Math.floor((48 * user.hp) / user.maxhp);
      return r <= 1 ? 200 : r <= 4 ? 150 : r <= 9 ? 100 : r <= 16 ? 80 : r <= 32 ? 40 : 20;
    }
    case 'fling': return ITEMS[ctx.flungItem]?.fling || 0;
    case 'frustration': return Math.max(1, Math.floor(((255 - user.friendship) * 10) / 25));
    case 'return': return Math.max(1, Math.floor((user.friendship * 10) / 25));
    case 'furycutter': return Math.min(160, 40 * 2 ** (user.vol.furycutter?.count || 0));
    case 'grassknot': case 'lowkick': {
      const w = opp.weightkg;
      return w >= 200 ? 120 : w >= 100 ? 100 : w >= 50 ? 80 : w >= 25 ? 60 : w >= 10 ? 40 : 20;
    }
    case 'gyroball': return Math.min(150, Math.floor((25 * getSpeed(b, opp)) / Math.max(1, getSpeed(b, user))) + 1);
    case 'heatcrash': case 'heavyslam': {
      const r = user.weightkg / opp.weightkg;
      return r >= 5 ? 120 : r >= 4 ? 100 : r >= 3 ? 80 : r >= 2 ? 60 : 40;
    }
    case 'knockoff': return itemRemovable(opp) && opp.item ? 97.5 : 65;
    case 'lashout': return b.time - user.lastStatDropAt < FIELD_TURN ? 150 : 75;
    case 'naturalgift': return ITEMS[itemActive(user)]?.berry?.bp || 0;
    case 'payback': return b.time - opp.lastMoveAt < 1.0 ? 100 : 50;
    case 'punishment': {
      const up = Object.values(opp.boosts).reduce((s, v) => s + Math.max(0, v), 0);
      return Math.min(200, 60 + 20 * up);
    }
    case 'pursuit': return opp.action?.type === 'switching' ? 80 : 40;
    case 'retaliate': return b.time - (b.sides[user.side].lastFaintAt ?? -99) < 6 ? 140 : 70;
    case 'rollout': return 30 * 2 ** Math.min(4, ctx.rolloutHits || 0) * (user.vol.defensecurl ? 2 : 1);
    case 'stompingtantrum': case 'temperflare': return user.lastMoveFailed ? bp * 2 : bp;
    case 'terrainpulse': return b.field.terrain && isGrounded(b, user) ? 100 : 50;
    case 'tripleaxel': return 20 * (ctx.hitIndex || 1);
    case 'venoshock': return opp.status === 'psn' || opp.status === 'tox' ? 130 : 65;
    case 'waterspout': return Math.max(1, Math.floor((150 * user.hp) / user.maxhp));
    case 'weatherball': return weatherFor(b, user) ? 100 : 50;
    case 'round': return 60;
    case 'hex': return opp.status ? 130 : 65;
    case 'storedpower': case 'powertrip': return 20 + 20 * Object.values(user.boosts).reduce((s, v) => s + Math.max(0, v), 0);
    case 'electroball': {
      const r = getSpeed(b, user) / Math.max(1, getSpeed(b, opp));
      return r >= 4 ? 150 : r >= 3 ? 120 : r >= 2 ? 80 : r >= 1 ? 60 : 40;
    }
    default: return bp;
  }
}

// ---------------------------------------------------------------- precisão
export function accuracyCheck(b, user, target, mv, ctx = {}) {
  if (ctx.noAccuracy) return true;
  if (mv.acc === true) return true;
  const w = weatherFor(b, target);
  let acc = mv.acc;
  if (mv.id === 'hurricane' || mv.id === 'thunder') {
    if (isRain(w)) return true;
    if (isSun(w)) acc = 50;
  }
  if (mv.id === 'blizzard' && (w === 'hail' || w === 'snow')) return true;
  if (mv.id === 'toxic' && hasType(user, 'Poison')) return true;
  if (mv.ohko) return b.rng.chance(30);
  if (target.vol.telekinesis) return true;
  let stage = user.boosts.accuracy;
  let eva = target.boosts.evasion;
  if ((target.vol.foresight || hasAbility(user, 'keeneye')) && eva > 0) eva = 0;
  if (hasAbility(target, 'sandveil') && weatherFor(b, target) === 'sandstorm' && !moldBreaks(user, mv)) acc *= 0.8;
  stage = Math.max(-6, Math.min(6, stage - eva));
  acc *= accMult(stage);
  if (itemActive(target) === 'brightpowder') acc *= 0.9;
  if (b.inZone(user, 'steam') || b.inZone(target, 'steam')) acc *= 0.8;
  return b.rng.chance(acc);
}

// ---------------------------------------------------------------- dano
export function calcDamage(b, user, target, mv, ctx = {}) {
  const eff = typeEffect(b, user, target, mv);
  if (mv.id === 'dragonrage') return { damage: 40, eff: eff === 0 ? 0 : 1, crit: false };
  if (mv.id === 'seismictoss' || mv.id === 'nightshade') return { damage: LEVEL, eff: eff === 0 ? 0 : 1, crit: false };
  if (mv.id === 'psywave') return { damage: Math.max(1, Math.floor((LEVEL * b.rng.int(50, 150)) / 100)), eff: eff === 0 ? 0 : 1, crit: false };
  if (mv.ohko) return { damage: target.hp, eff: eff === 0 ? 0 : 1, crit: false, ohko: true };
  if (mv.id === 'superfang') return { damage: Math.max(1, Math.floor(target.hp / 2)), eff: eff === 0 ? 0 : 1, crit: false };
  if (mv.id === 'endeavor') return { damage: Math.max(0, target.hp - user.hp), eff: eff === 0 ? 0 : 1, crit: false };
  let bp = basePower(b, user, target, mv, ctx);
  if (!bp) return { damage: 0, eff, crit: false };
  if (hasAbility(user, 'technician') && bp <= 60) bp *= 1.5;

  // críticos
  let critStage = (mv.crit || 1) - 1;
  if (itemActive(user) === 'scopelens') critStage++;
  if (hasAbility(user, 'superluck')) critStage++;
  if (user.vol.dragoncheer) critStage += hasType(user, 'Dragon') ? 2 : 1;
  let crit = mv.willCrit || !!user.vol.laserfocus || critStage >= 3 || b.rng.next() < [1 / 24, 1 / 8, 1 / 2][critStage];
  if (ctx.noCrit) crit = false;
  if (user.vol.laserfocus) delete user.vol.laserfocus;

  // modificadores do poder
  const item = itemActive(user);
  if (ITEMS[item]?.boostType === mv.type) bp *= 1.2;
  if (item === 'muscleband' && mv.cat === 'Physical') bp *= 1.1;
  if (item === 'wiseglasses' && mv.cat === 'Special') bp *= 1.1;
  if (hasAbility(user, 'toughclaws') && mv.flags.includes('contact')) bp *= 1.3;
  if (sheerForce(user, mv)) bp *= 1.3;
  if (hasAbility(user, 'sandforce') && weatherFor(b, user) === 'sandstorm' && ['Rock', 'Ground', 'Steel'].includes(mv.type)) bp *= 1.3;
  if (hasAbility(user, 'megalauncher') && mv.flags.includes('pulse')) bp *= 1.5;
  if (mv.ate) bp *= 1.2;
  if (hasAbility(user, 'sharpness') && mv.flags.includes('slicing')) bp *= 1.5;
  if (user.vol.flashfire && mv.type === 'Fire') bp *= 1.5;
  if (user.vol.charge && mv.type === 'Electric') bp *= 2;
  const terrain = b.field.terrain?.id;
  if (terrain === 'grassyterrain') {
    if (mv.type === 'Grass' && isGrounded(b, user)) bp *= 1.3;
    if (['earthquake', 'bulldoze'].includes(mv.id) && isGrounded(b, target)) bp *= 0.5;
  }
  if (terrain === 'electricterrain' && isGrounded(b, user)) {
    if (mv.type === 'Electric') bp *= 1.3;
    if (mv.id === 'risingvoltage' && isGrounded(b, target)) bp *= 2;
  }
  if (terrain === 'psychicterrain' && isGrounded(b, user)) {
    if (mv.type === 'Psychic') bp *= 1.3;
    if (mv.id === 'expandingforce') bp *= 1.5;
  }
  if (terrain === 'mistyterrain') {
    if (mv.type === 'Dragon' && isGrounded(b, target)) bp *= 0.5;
    if (mv.id === 'mistyexplosion' && isGrounded(b, user)) bp *= 1.5;
  }
  if (b.field.mudsport > 0 && mv.type === 'Electric') bp /= 3;
  if (mv.id === 'solarbeam' && ['raindance', 'primordialsea', 'sandstorm', 'hail', 'snow'].includes(weatherFor(b, user))) bp *= 0.5;
  if (target.semiInv === 'dig' && mv.id === 'earthquake') bp *= 2;
  if (target.semiInv === 'dive' && (mv.id === 'surf' || mv.id === 'whirlpool')) bp *= 2;
  if (target.semiInv === 'fly' && mv.id === 'twister') bp *= 2;
  if (ctx.powerMult) bp *= ctx.powerMult;
  bp = Math.max(1, Math.floor(bp));

  // atributos de ataque e defesa
  const physical = mv.cat === 'Physical';
  let atkKey = physical ? 'atk' : 'spa';
  let atkSrc = user;
  if (mv.id === 'foulplay') atkSrc = target;
  if (mv.id === 'bodypress') atkKey = 'def';
  // Psyshock e companhia são especiais mas batem na Defesa; Sacred Sword ignora a defesa aumentada
  const defKey = mv.overrideDefensiveStat || (physical ? 'def' : 'spd');
  let A = getStat(b, atkSrc, atkKey, { ignoreNegative: crit });
  let D = getStat(b, target, defKey, { ignorePositive: crit, noBoost: !!mv.ignoreDefensive });

  const third = user.hp * 3 <= user.maxhp;
  if (third && ((hasAbility(user, 'overgrow') && mv.type === 'Grass') || (hasAbility(user, 'blaze') && mv.type === 'Fire') || (hasAbility(user, 'torrent') && mv.type === 'Water') || (hasAbility(user, 'swarm') && mv.type === 'Bug'))) A = Math.floor(A * 1.5);
  if (atkKey === 'atk' && atkSrc === user && hasAbility(user, 'hugepower')) A *= 2;
  const breaks = moldBreaks(user, mv);
  if (!breaks && hasAbility(target, 'thickfat') && (mv.type === 'Fire' || mv.type === 'Ice')) A = Math.floor(A * 0.5);

  let dmg = Math.floor(Math.floor((Math.floor((2 * LEVEL) / 5 + 2) * bp * A) / D) / 50) + 2;

  // clima
  const w = weatherFor(b, target);
  const wu = weatherFor(b, user);
  if (isSun(w) && isSun(wu)) { if (mv.type === 'Fire') dmg = Math.floor(dmg * 1.5); if (mv.type === 'Water') dmg = Math.floor(dmg * 0.5); }
  if (isRain(w) && isRain(wu)) { if (mv.type === 'Water') dmg = Math.floor(dmg * 1.5); if (mv.type === 'Fire') dmg = Math.floor(dmg * 0.5); }
  if (crit) dmg = Math.floor(dmg * 1.5);
  dmg = Math.floor((dmg * b.rng.int(85, 100)) / 100);
  if (user.types.includes(mv.type)) dmg = Math.floor(dmg * (hasAbility(user, 'adaptability') ? 2 : 1.5));
  dmg = Math.floor(dmg * eff);
  if (physical && user.status === 'brn' && mv.id !== 'facade') dmg = Math.floor(dmg * 0.5);
  const conds = b.sides[target.side].conds;
  if (!crit && mv.id !== 'brickbreak') {
    if (physical && conds.reflect > 0) dmg = Math.floor(dmg * 0.5);
    if (!physical && conds.lightscreen > 0) dmg = Math.floor(dmg * 0.5);
  }
  if (item === 'lifeorb') dmg = Math.floor(dmg * 1.3);
  if (item === 'expertbelt' && eff > 1) dmg = Math.floor(dmg * 1.2);
  // Multiscale: com PS cheios, metade do dano
  if (!breaks && hasAbility(target, 'multiscale') && target.hp === target.maxhp) dmg = Math.floor(dmg * 0.5);
  if (eff > 0) dmg = Math.max(1, dmg);
  // o dano é o mesmo dos jogos; quem foi multiplicado foram os PS (HP_SCALE)
  return { damage: dmg, eff, crit };
}

export function typeEffect(b, user, target, mv) {
  if (mv.id === 'struggle') return 1;
  let types = target.types;
  if (target.vol.roost) types = types.filter(t => t !== 'Flying');
  if (mv.type === 'Ground') {
    if (!isGrounded(b, target, moldBreaks(user, mv))) return 0;
    // derrubado por Smack Down (ou pousado com Roost): o tipo Voador não protege mais
    types = types.filter(t => t !== 'Flying');
  }
  if ((target.vol.foresight || hasAbility(user, 'scrappy')) && (mv.type === 'Normal' || mv.type === 'Fighting')) types = types.filter(t => t !== 'Ghost');
  // ventos fortes: o tipo Voador não tem fraqueza
  if (types.includes('Flying') && strongWinds(b) && effectiveness(mv.type, ['Flying']) > 1) types = types.filter(t => t !== 'Flying');
  if (types.length === 0) types = ['Normal'];
  return effectiveness(mv.type, types);
}

// ---------------------------------------------------------------- PS
// direct = dano que não vem de um golpe (clima, status, recuo, armadilha); selfCost = PS gastos de
// propósito (Substitute, Belly Drum), que o Magic Guard não impede
export function damageMon(b, mon, amount, { source = null, mv = null, direct = false, silent = false, color = null, selfCost = false } = {}) {
  if (mon.fainted || amount <= 0) return 0;
  if (direct && !selfCost && hasAbility(mon, 'magicguard')) return 0;
  const before = mon.hp;
  amount = Math.max(1, Math.floor(amount));
  if (!direct && mv && source && source !== mon && mon.vol.substitute && !bypassSub(mv)) {
    const sub = mon.vol.substitute;
    const absorbed = Math.min(sub.hp, amount);
    sub.hp -= absorbed;
    b.text(mon, `-${absorbed}`, '#cfcfcf');
    if (sub.hp <= 0) {
      delete mon.vol.substitute;
      b.say(`O substituto de ${mon.name} desapareceu!`);
      b.emit({ t: 'subBreak', mon });
    }
    return -1; // acertou o substituto
  }
  if (!direct) {
    const fullHp = mon.hp === mon.maxhp;
    if (amount >= mon.hp) {
      if (mon.vol.endure) { amount = mon.hp - 1; b.say(`${mon.name} aguentou o golpe!`); }
      else if (fullHp && hasAbility(mon, 'sturdy') && !moldBreaks(source, mv)) { amount = mon.hp - 1; b.say(`${mon.name} aguentou com Sturdy!`); }
      else if (mv?.id === 'falseswipe') amount = mon.hp - 1;
      else if (fullHp && itemActive(mon) === 'focussash') {
        amount = mon.hp - 1;
        consumeItem(b, mon);
        b.say(`${mon.name} aguentou com a Focus Sash!`);
      }
    }
  }
  amount = Math.min(amount, mon.hp);
  mon.hp -= amount;
  if (!silent) b.text(mon, `-${amount}`, color || (direct ? '#c58cf0' : '#ffffff'));
  if (source && source !== mon) {
    mon.lastDamagedAt = b.time;
    mon.lastDamagedBy = source.uid;
    if (mv) mon.lastHitCategory = mv.cat;
    b.addMegaGauge(source.side, (amount / mon.maxhp) * 62);
    b.addMegaGauge(mon.side, (amount / mon.maxhp) * 48);
    if (mon.action?.type === 'charge' && mon.action.id === 'focuspunch') mon.action.lostFocus = true;
    if (mon.action?.type === 'stance') mon.action.taken = (mon.action.taken || 0) + amount;
  }
  if (mon.hp <= 0) {
    mon.hp = 0;
    b.faint(mon, direct ? null : source);
  } else {
    checkBerry(b, mon);
    if (hasAbility(mon, 'emergencyexit') && !selfCost && before * 2 > mon.maxhp && mon.hp * 2 <= mon.maxhp) b.emergencyExit(mon);
  }
  return amount;
}

export function healMon(b, mon, amount, { silent = false } = {}) {
  if (mon.fainted || mon.hp >= mon.maxhp) return 0;
  if (mon.vol.healblock) return 0;
  amount = Math.max(1, Math.floor(amount));
  amount = Math.min(amount, mon.maxhp - mon.hp);
  mon.hp += amount;
  if (!silent) b.text(mon, `+${amount}`, '#7df07d');
  return amount;
}

// Unnerve: o adversário fica nervoso demais para comer Berries
export function unnerved(b, mon) {
  const foe = b.foeActive?.(mon);
  return !!foe && foe.onField && hasAbility(foe, 'unnerve');
}

function checkBerry(b, mon) {
  if (unnerved(b, mon)) return;
  if (itemActive(mon) === 'sitrusberry' && mon.hp * 2 <= mon.maxhp) {
    consumeItem(b, mon);
    healMon(b, mon, mon.maxhp / 4);
    b.say(`${mon.name} comeu a Sitrus Berry!`);
  }
}

export function consumeItem(b, mon) {
  mon.itemSpent = mon.item;
  mon.item = null;
  b.emit({ t: 'item', mon });
}

// ---------------------------------------------------------------- status
export function applyStatus(b, target, status, source, mv, { fromMove = false, rest = false } = {}) {
  if (target.fainted) return false;
  const loud = fromMove && mv?.cat === 'Status';
  if (target.status) {
    if (loud) b.say(`${target.name} já está ${STATUS_PT[target.status]}!`);
    return false;
  }
  if (source && source !== target) {
    if (target.vol.substitute && !(mv && bypassSub(mv))) { if (loud) b.say('Mas falhou!'); return false; }
    if (b.sides[target.side].conds.safeguard > 0) { if (loud) b.say(`${target.name} está protegido pelo Safeguard!`); return false; }
  }
  const immune =
    (status === 'brn' && hasType(target, 'Fire')) ||
    (status === 'par' && (hasType(target, 'Electric') || hasAbility(target, 'limber'))) ||
    ((status === 'psn' || status === 'tox') && (hasType(target, 'Poison') || hasType(target, 'Steel'))) ||
    (status === 'frz' && (hasType(target, 'Ice') || isSun(weatherFor(b, target)))) ||
    (status === 'slp' && (hasAbility(target, 'insomnia') || b.field.uproar > 0));
  // terrenos protegem quem está no chão: Misty de tudo, Electric do sono
  const terrain = b.field.terrain?.id;
  const shielded = isGrounded(b, target) && (terrain === 'mistyterrain' || (terrain === 'electricterrain' && status === 'slp'));
  if (shielded) {
    if (loud) b.say(`O terreno protegeu ${target.name}!`);
    return false;
  }
  if (immune) {
    if (loud) b.say(`Não afeta ${target.name}...`);
    return false;
  }
  target.status = status;
  target.statusData = { toxicTurns: 0 };
  if (status === 'slp') target.statusData.sleepLeft = (rest ? ACTION_TURN * 2 : ACTION_TURN * b.rng.int(1, 3)) * (hasAbility(target, 'earlybird') ? 0.5 : 1);
  if (status === 'frz') target.statusData.frozenFor = 0;
  const msg = {
    brn: `${target.name} foi queimado!`, par: `${target.name} foi paralisado!`, psn: `${target.name} foi envenenado!`,
    tox: `${target.name} foi gravemente envenenado!`, slp: `${target.name} adormeceu!`, frz: `${target.name} congelou!`,
  }[status];
  b.say(msg);
  b.emit({ t: 'status', mon: target, status });
  if (status === 'slp' || status === 'frz') b.interrupt(target);
  if (itemActive(target) === 'lumberry' && !unnerved(b, target)) {
    consumeItem(b, target);
    cureStatus(b, target);
    b.say(`${target.name} comeu a Lum Berry e se curou!`);
  }
  // Synchronize devolve queimadura, paralisia e veneno para quem causou
  if (hasAbility(target, 'synchronize') && source && source !== target && ['brn', 'par', 'psn', 'tox'].includes(status) && target.status === status) {
    b.say(`O Synchronize de ${target.name} passou o status para ${source.name}!`);
    applyStatus(b, source, status, target, null);
  }
  return true;
}

export function cureStatus(b, mon, silent = false) {
  if (!mon.status) return;
  if (!silent) b.say({ slp: `${mon.name} acordou!`, frz: `${mon.name} descongelou!` }[mon.status] || `${mon.name} se curou!`);
  mon.status = null;
  mon.statusData = { toxicTurns: 0 };
}

// ---------------------------------------------------------------- voláteis
export function addVolatile(b, target, id, source, mv, { fromMove = false } = {}) {
  if (target.fainted) return false;
  const loud = fromMove;
  const fail = (msg = 'Mas falhou!') => { if (loud) b.say(msg); return false; };
  const blockedBySub = target !== source && target.vol.substitute && !(mv && bypassSub(mv));
  switch (id) {
    case 'confusion':
      if (target.vol.confusion) return fail(`${target.name} já está confuso!`);
      if (blockedBySub) return fail();
      if (target !== source && b.sides[target.side].conds.safeguard > 0) return fail(`${target.name} está protegido pelo Safeguard!`);
      target.vol.confusion = { t: ACTION_TURN * b.rng.int(2, 5) };
      b.say(`${target.name} ficou confuso!`);
      b.emit({ t: 'status', mon: target, status: 'confusion' });
      if (itemActive(target) === 'lumberry') { consumeItem(b, target); delete target.vol.confusion; b.say(`${target.name} comeu a Lum Berry!`); }
      return true;
    case 'flinch':
      if (blockedBySub || hasAbility(target, 'innerfocus')) return false;
      b.interrupt(target);
      b.stun(target, 0.55, 'flinch');
      b.say(`${target.name} recuou!`);
      if (hasAbility(target, 'steadfast')) boost(b, target, { spe: 1 }, target, null);
      return true;
    case 'leechseed':
      if (hasType(target, 'Grass')) return fail(`Não afeta ${target.name}...`);
      if (target.vol.leechseed) return fail(`${target.name} já está semeado!`);
      if (blockedBySub) return fail();
      target.vol.leechseed = { by: source.side };
      b.say(`${target.name} foi semeado!`);
      return true;
    case 'attract': {
      const ok = source.gender !== 'N' && target.gender !== 'N' && source.gender !== target.gender;
      if (!ok || target.vol.attract) return fail();
      target.vol.attract = { by: source.uid };
      b.say(`${target.name} se apaixonou!`);
      mentalHerb(b, target);
      return true;
    }
    case 'taunt':
      if (target.vol.taunt) return fail();
      target.vol.taunt = { t: FIELD_TURN * 3 };
      b.say(`${target.name} caiu na provocação!`);
      mentalHerb(b, target);
      return true;
    case 'torment':
      if (target.vol.torment) return fail();
      target.vol.torment = {};
      b.say(`${target.name} está sendo atormentado!`);
      mentalHerb(b, target);
      return true;
    case 'encore': {
      const slot = target.moves.findIndex((m, i) => (m.mimic || m.id) === target.lastMove);
      const bad = ['encore', 'mimic', 'struggle', 'metronome', 'sleeptalk', 'assist', 'naturepower'];
      if (slot < 0 || target.vol.encore || bad.includes(target.lastMove)) return fail();
      target.vol.encore = { t: FIELD_TURN * 3, slot };
      b.say(`${target.name} recebeu um bis!`);
      mentalHerb(b, target);
      return true;
    }
    case 'embargo':
      if (target.vol.embargo) return fail();
      target.vol.embargo = { t: FIELD_TURN * 5 };
      b.say(`${target.name} não pode usar itens!`);
      return true;
    case 'yawn':
      if (target.vol.yawn || target.status || blockedBySub) return fail();
      if (b.sides[target.side].conds.safeguard > 0 || hasAbility(target, 'insomnia')) return fail();
      target.vol.yawn = { t: FIELD_TURN * 0.8 };
      b.say(`${target.name} ficou sonolento!`);
      return true;
    case 'nightmare':
      if (target.status !== 'slp' || target.vol.nightmare) return fail();
      target.vol.nightmare = {};
      b.say(`${target.name} começou a ter um pesadelo!`);
      return true;
    case 'foresight':
      target.vol.foresight = {};
      b.say(`${target.name} foi identificado!`);
      return true;
    case 'partiallytrapped': {
      if (target.vol.partiallytrapped || blockedBySub) return false;
      const turns = itemActive(source) === 'gripclaw' ? 7 : b.rng.int(4, 5);
      target.vol.partiallytrapped = { t: turns * ACTION_TURN, by: source.uid, move: mv.id, frac: itemActive(source) === 'bindingband' ? 1 / 6 : 1 / 8 };
      b.say(`${target.name} ficou preso por ${mv.name}!`);
      return true;
    }
    case 'smackdown':
      target.vol.smackdown = {};
      if (target.semiInv === 'fly') b.cancelSemiInv(target);
      b.say(`${target.name} caiu no chão!`);
      return true;
    case 'disable': {
      const slot = target.moves.findIndex(m => (m.mimic || m.id) === (mv?.id === 'disable' ? target.lastMove : mv?.id));
      if (slot < 0 || target.vol.disable) return fail();
      target.vol.disable = { t: FIELD_TURN * 4, slot };
      b.say(`${MOVES[target.moves[slot].mimic || target.moves[slot].id].name} de ${target.name} foi desativado!`);
      mentalHerb(b, target);
      return true;
    }
    case 'healblock':
      target.vol.healblock = { t: FIELD_TURN * 2 };
      b.say(`${target.name} não pode recuperar PS!`);
      return true;
    case 'telekinesis':
      if (target.vol.telekinesis || target.species === 'gengarmega') return fail();
      target.vol.telekinesis = { t: FIELD_TURN * 3 };
      b.say(`${target.name} foi erguido no ar!`);
      return true;
    case 'trapped':
      if (target.vol.trapped) return fail();
      target.vol.trapped = {};
      b.say(`${target.name} não pode mais fugir!`);
      return true;
    default:
      target.vol[id] = {};
      return true;
  }
}

function mentalHerb(b, mon) {
  if (itemActive(mon) !== 'mentalherb') return;
  for (const k of ['attract', 'taunt', 'encore', 'torment']) delete mon.vol[k];
  consumeItem(b, mon);
  b.say(`${mon.name} usou a Mental Herb e se recuperou!`);
}

// ---------------------------------------------------------------- atributos
export function boost(b, mon, boosts, source, mv, { fromMove = false } = {}) {
  if (mon.fainted) return false;
  let any = false;
  const isDrop = Object.values(boosts).some(v => v < 0);
  if (isDrop && source && source.side !== mon.side) {
    if (b.sides[mon.side].conds.mist > 0) { if (fromMove) b.say(`${mon.name} está protegido pela névoa!`); return false; }
    if (mon.vol.substitute && !(mv && bypassSub(mv)) && mv?.cat === 'Status') { if (fromMove) b.say('Mas falhou!'); return false; }
  }
  for (const [stat, amount] of Object.entries(boosts)) {
    if (!amount) continue;
    // habilidades que impedem o adversário de baixar atributos
    if (amount < 0 && source && source.side !== mon.side && !moldBreaks(source, mv)) {
      const guard = hasAbility(mon, 'clearbody') ? 'Clear Body' : hasAbility(mon, 'hypercutter') && stat === 'atk' ? 'Hyper Cutter' : hasAbility(mon, 'keeneye') && stat === 'accuracy' ? 'Keen Eye' : null;
      if (guard) { b.say(`O ${guard} de ${mon.name} impediu a queda!`); continue; }
    }
    const before = mon.boosts[stat];
    const after = Math.max(-6, Math.min(6, before + amount));
    const delta = after - before;
    const name = STAT_PT[stat];
    if (delta === 0) {
      if (fromMove || mv?.cat === 'Status') b.say(amount > 0 ? `${name} de ${mon.name} não pode subir mais!` : `${name} de ${mon.name} não pode cair mais!`);
      continue;
    }
    mon.boosts[stat] = after;
    mon.boostClock[stat] = BOOST_DURATION;
    any = true;
    const words = delta > 0 ? ['aumentou', 'aumentou muito', 'aumentou drasticamente'] : ['diminuiu', 'diminuiu muito', 'diminuiu drasticamente'];
    b.say(`${name} de ${mon.name} ${words[Math.min(2, Math.abs(delta) - 1)]}!`);
    b.emit({ t: 'boost', mon, stat, delta });
    if (delta < 0) mon.lastStatDropAt = b.time;
    else mon.lastStatRiseAt = b.time;
  }
  if (itemActive(mon) === 'whiteherb' && Object.values(mon.boosts).some(v => v < 0)) {
    for (const k of Object.keys(mon.boosts)) if (mon.boosts[k] < 0) mon.boosts[k] = 0;
    consumeItem(b, mon);
    b.say(`${mon.name} usou a White Herb e voltou ao normal!`);
  }
  return any;
}

// ---------------------------------------------------------------- efeitos secundários
export function sheerForce(user, mv) {
  return user.ability === 'sheerforce' && mv.cat !== 'Status' && (mv.sec || []).length > 0;
}

export function secondaries(b, user, target, mv, dealt) {
  const fainted = target.fainted;
  for (const sec of sheerForce(user, mv) ? [] : mv.sec || []) {
    if (!b.rng.chance(sec.chance ?? 100)) continue;
    if (!fainted && dealt !== -1) {
      if (sec.status) applyStatus(b, target, sec.status, user, mv);
      if (sec.volatileStatus) addVolatile(b, target, sec.volatileStatus, user, mv);
      if (sec.boosts) boost(b, target, sec.boosts, user, mv);
    }
    if (sec.self?.boosts) boost(b, user, sec.self.boosts, user, mv);
  }
  if (itemActive(user) === 'kingsrock' && !fainted && dealt !== -1 && !(mv.sec || []).some(s => s.volatileStatus === 'flinch') && b.rng.chance(10)) {
    addVolatile(b, target, 'flinch', user, mv);
  }
  // golpes de dano com efeito volátil próprio (Fire Spin, Whirlpool, Bind prendem; Smack Down derruba)
  if (mv.vol && mv.cat !== 'Status' && mv.target !== 'self' && !fainted && dealt !== -1) addVolatile(b, target, mv.vol, user, mv);
}

// Texto de eficácia
export function effText(eff) {
  if (eff === 0) return null;
  if (eff > 1) return 'É super eficaz!';
  if (eff < 1) return 'Não é muito eficaz...';
  return null;
}

export { TYPE_PT, hpFrac, bypassSub };
