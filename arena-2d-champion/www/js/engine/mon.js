// O Pokémon em batalha: atributos, formas Mega, estágios de atributo e estado na arena.
import { SPECIES, ITEMS, BODY, MOVES, toId } from '../data/dex.js';
import { LEVEL, HP_SCALE, STAMINA_MAX } from './constants.js';

const IV = 31;
const EV = 84; // 510 EVs divididos igualmente

export function calcStat(base, key) {
  const core = Math.floor(((2 * base + IV + Math.floor(EV / 4)) * LEVEL) / 100);
  return key === 'hp' ? core + LEVEL + 10 : core + 5;
}

let uidCounter = 1;

export function createMon(set, sideIndex, slot) {
  const sp = SPECIES[set.species];
  const mon = {
    uid: uidCounter++,
    side: sideIndex,
    slot,
    set,
    baseSpecies: set.species,
    species: set.species,
    name: sp.name,
    gender: set.gender || (sp.gender === 'F' ? 'F' : sp.gender === 'N' ? 'N' : 'M'),
    types: [...sp.types],
    ability: toId(set.ability || sp.abilities[0]),
    item: set.item && set.item !== 'none' ? set.item : null,
    itemSpent: null,
    stats: {},
    maxhp: 0,
    hp: 0,
    status: null,
    statusData: {},
    moves: set.moves.filter(id => MOVES[id]).map(id => ({ id, cd: 0, cdMax: 1 })),
    hpType: set.hpType || 'Fire',
    friendship: set.moves.includes('frustration') && !set.moves.includes('return') ? 0 : 255,
    isMega: false,
    fainted: false,
    onField: false,
  };
  recalcStats(mon, true);
  mon.hp = mon.maxhp;
  resetField(mon);
  return mon;
}

export function recalcStats(mon, full = false) {
  const sp = SPECIES[mon.species];
  for (const key of ['atk', 'def', 'spa', 'spd', 'spe']) mon.stats[key] = calcStat(sp.baseStats[key], key);
  const maxhp = calcStat(sp.baseStats.hp, 'hp') * HP_SCALE;
  if (full) mon.maxhp = maxhp;
  mon.weightkg = sp.weightkg;
  const body = BODY[mon.species] || BODY[mon.baseSpecies];
  mon.radius = body.radius;
  mon.hover = body.hover;
}

// Estado que some quando o Pokémon sai de campo
export function resetField(mon) {
  mon.boosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 };
  // segundos até cada mudança de atributo começar a voltar ao normal (buffs são temporários)
  mon.boostClock = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 };
  mon.vol = {};
  mon.action = null;
  mon.stamina = STAMINA_MAX;
  mon.gcd = 0;
  mon.gcdMax = 1;
  mon.iframes = 0;
  mon.dodgeCd = 0;
  mon.hitstun = 0;
  mon.vx = 0;
  mon.vy = 0;
  mon.kx = 0;
  mon.ky = 0;
  mon.lastMove = null;
  mon.lastMoveAt = -99;
  mon.lastMoveFailed = false;
  mon.lastDamagedAt = -99;
  mon.lastDamagedBy = null;
  mon.lastStatDropAt = -99;
  mon.actedSinceEntry = false;
  mon.enteredAt = 0;
  mon.residualClock = 0;
  mon.statusData.toxicTurns = 0;
  mon.types = [...SPECIES[mon.species].types];
  mon.weightkg = SPECIES[mon.species].weightkg;
  mon.semiInv = null;
  mon.airborne = false;
  mon.z = 0;
  mon.facing = mon.facing || 0;
  mon.anim = { name: 'Idle', t: 0, lock: 0 };
  for (const m of mon.moves) m.mimic = null;
}

export function boostMult(stage) {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}
export function accMult(stage) {
  return stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage);
}

export function hasType(mon, type) {
  return mon.types.includes(type);
}

export function itemActive(mon) {
  return mon.item && !mon.vol.embargo ? mon.item : null;
}

export function hasAbility(mon, id) {
  return mon.ability === id;
}

// Golpe efetivo de um espaço (Mimic troca o golpe enquanto o Pokémon estiver em campo)
export function slotMove(mon, slot) {
  const s = mon.moves[slot];
  return s ? s.mimic || s.id : null;
}

export function isGrounded(b, mon) {
  if (mon.vol.magnetrise || mon.vol.telekinesis) return false;
  if (mon.vol.smackdown) return true;
  if (mon.vol.roost) return true;
  if (mon.vol.ingrain) return true;
  if (hasType(mon, 'Flying')) return false;
  if (itemActive(mon) === 'airballoon') return false;
  return true;
}

export function weatherFor(b, mon) {
  // Utility Umbrella ignora sol e chuva para quem segura
  const w = b.field.weather?.id || null;
  if (mon && itemActive(mon) === 'utilityumbrella' && ['sunnyday', 'raindance', 'desolateland', 'primordialsea'].includes(w)) return null;
  return w;
}
export const isSun = w => w === 'sunnyday' || w === 'desolateland';
export const isRain = w => w === 'raindance' || w === 'primordialsea';

export function getStat(b, mon, key, { ignorePositive = false, ignoreNegative = false, noBoost = false } = {}) {
  // Wonder Room troca Defesa e Defesa Especial
  if (b.field.wonderroom > 0 && (key === 'def' || key === 'spd')) key = key === 'def' ? 'spd' : 'def';
  let stage = noBoost ? 0 : mon.boosts[key] || 0;
  if (ignorePositive && stage > 0) stage = 0;
  if (ignoreNegative && stage < 0) stage = 0;
  let value = Math.floor(mon.stats[key] * boostMult(stage));
  const item = itemActive(mon);
  const w = weatherFor(b, mon);
  if (key === 'atk' && item === 'choiceband') value = Math.floor(value * 1.5);
  if (key === 'spa' && item === 'choicespecs') value = Math.floor(value * 1.5);
  if (key === 'spd' && item === 'assaultvest') value = Math.floor(value * 1.5);
  if (key === 'spa' && hasAbility(mon, 'solarpower') && isSun(w)) value = Math.floor(value * 1.5);
  if (key === 'spd' && w === 'sandstorm' && hasType(mon, 'Rock')) value = Math.floor(value * 1.5);
  if (key === 'def' && w === 'snow' && hasType(mon, 'Ice')) value = Math.floor(value * 1.5);
  return value;
}

export function getSpeed(b, mon) {
  let spe = getStat(b, mon, 'spe');
  if (itemActive(mon) === 'choicescarf') spe *= 1.5;
  if (hasAbility(mon, 'chlorophyll') && isSun(weatherFor(b, mon))) spe *= 2;
  if (b.sides[mon.side].conds.tailwind > 0) spe *= 2;
  if (mon.status === 'par') spe *= 0.5;
  // Trick Room: os lentos ficam rápidos e os rápidos ficam lentos
  if (b.field.trickroom > 0) spe = Math.max(30, 300 - spe);
  return spe;
}

// Velocidade de andar na arena (pixels por segundo)
export function moveSpeed(b, mon) {
  const spe = getSpeed(b, mon);
  let v = 130 + spe * 1.05;
  if (mon.vol.partiallytrapped) v *= 0.55;
  if (mon.vol.ingrain) v *= 0.4;
  v *= b.arenaSpeedMult(mon);
  return Math.min(v, 520);
}

// Recarga dos golpes encolhe um pouco para quem é rápido
export function cooldownMult(b, mon) {
  const spe = getSpeed(b, mon);
  return Math.max(0.72, Math.min(1.18, 1.22 - spe / 380));
}

export function hpFrac(mon) {
  return mon.hp / mon.maxhp;
}

export function megaTarget(mon) {
  const mega = ITEMS[mon.item]?.mega;
  return mega && mega.from === mon.baseSpecies && !mon.isMega ? mega.to : null;
}

// Mega Pedras não podem ser tomadas do Pokémon que as usa
export function itemRemovable(mon) {
  if (!mon.item) return false;
  const mega = ITEMS[mon.item]?.mega;
  return !(mega && mega.from === mon.baseSpecies);
}
