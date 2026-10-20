// Gera www/js/data/generated.js a partir dos dados do Pokémon Showdown (@pkmn/dex).
// Rode com: npm run gen-data
// O arquivo gerado tem os golpes que Venusaur, Charizard, Blastoise e Weavile podem aprender
// (contando as pré-evoluções, golpes de ovo, TM, tutor e evento de todas as gerações),
// os dados das espécies e das Megas, e a tabela de tipos.
import { Dex } from '@pkmn/dex';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPECIES = ['venusaur', 'charizard', 'blastoise', 'weavile'];
const FORMS = ['venusaurmega', 'charizardmegax', 'charizardmegay', 'blastoisemega'];

// Golpes que ninguém aprende mas que Nature Power e o cansaço (Struggle) podem usar
const EXTRA_MOVES = ['triattack', 'struggle'];

const SOURCE_KIND = { L: 'Nível', M: 'TM', E: 'Ovo', T: 'Tutor', S: 'Evento', V: 'Virtual Console', D: 'Dream World', R: 'Especial' };

function speciesData(sp) {
  return {
    id: sp.id,
    num: sp.num,
    name: sp.name,
    types: sp.types,
    baseStats: sp.baseStats,
    abilities: Object.values(sp.abilities),
    weightkg: sp.weightkg,
    genderRatio: sp.genderRatio || null,
    gender: sp.gender || null,
    requiredItem: sp.requiredItem || null,
    baseSpecies: sp.baseSpecies,
    forme: sp.forme || '',
  };
}

const learnsets = {};
const moveIds = new Set();
for (const id of SPECIES) {
  const learned = {};
  let cur = Dex.species.get(id);
  while (cur && cur.exists) {
    const ls = await Dex.learnsets.get(cur.id);
    for (const [moveId, sources] of Object.entries(ls?.learnset || {})) {
      const entry = learned[moveId] || (learned[moveId] = { how: new Set(), via: new Set(), gens: new Set() });
      for (const src of sources) {
        const gen = parseInt(src, 10);
        const kind = src.replace(/^\d+/, '')[0];
        entry.how.add(SOURCE_KIND[kind] || kind);
        entry.gens.add(gen);
      }
      if (cur.id !== id) entry.via.add(cur.name);
      moveIds.add(moveId);
    }
    cur = cur.prevo ? Dex.species.get(cur.prevo) : null;
  }
  learnsets[id] = Object.fromEntries(
    Object.entries(learned)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, e]) => [m, { how: [...e.how], via: [...e.via], gens: [Math.min(...e.gens), Math.max(...e.gens)] }]),
  );
}

function clean(obj) {
  if (obj === null || obj === undefined) return undefined;
  return JSON.parse(JSON.stringify(obj, (k, v) => (typeof v === 'function' ? undefined : v)));
}

const moves = {};
for (const id of [...moveIds, ...EXTRA_MOVES].sort()) {
  const m = Dex.moves.get(id);
  const out = {
    id: m.id,
    name: m.name,
    num: m.num,
    type: m.type,
    cat: m.category,
    bp: m.basePower,
    acc: m.accuracy,
    pp: m.pp,
    pri: m.priority,
    flags: Object.keys(m.flags).filter(f => m.flags[f]),
    target: m.target,
    crit: m.critRatio || 1,
    gen: m.gen,
    nonstd: m.isNonstandard || null,
    desc: m.shortDesc || m.desc,
  };
  const optional = {
    sec: m.secondaries ? clean(m.secondaries) : undefined,
    self: clean(m.self),
    boosts: clean(m.boosts),
    selfBoost: clean(m.selfBoost),
    drain: m.drain,
    recoil: m.recoil,
    multihit: m.multihit,
    heal: m.heal,
    weather: m.weather,
    side: m.sideCondition,
    terrain: m.terrain,
    pseudo: m.pseudoWeather,
    status: m.status,
    vol: m.volatileStatus,
    selfSwitch: m.selfSwitch,
    forceSwitch: m.forceSwitch,
    ohko: m.ohko,
    selfdestruct: m.selfdestruct,
    thaws: m.thawsTarget,
    damage: m.damage,
    willCrit: m.willCrit,
    breaksProtect: m.breaksProtect,
    sleepUsable: m.sleepUsable,
    stalling: m.stallingMove,
    nonGhostTarget: m.nonGhostTarget,
    multiacc: m.multiaccuracy,
    ignoreAbility: m.ignoreAbility,
    hasCrashDamage: m.hasCrashDamage,
  };
  for (const [k, v] of Object.entries(optional)) if (v !== undefined && v !== null && v !== false) out[k] = v;
  moves[id] = out;
}

// Tabela de tipos: TYPE_CHART[atacante][defensor] = multiplicador
const types = Dex.types.all().filter(t => t.isNonstandard !== 'Future' && t.name !== 'Stellar' && t.name !== '???');
const typeNames = types.map(t => t.name);
const chart = {};
for (const atk of typeNames) {
  chart[atk] = {};
  for (const def of types) {
    const code = def.damageTaken[atk];
    chart[atk][def.name] = code === 1 ? 2 : code === 2 ? 0.5 : code === 3 ? 0 : 1;
  }
}

const species = {};
for (const id of [...SPECIES, ...FORMS]) species[id] = speciesData(Dex.species.get(id));
for (const id of SPECIES) species[id].prevos = (() => {
  const list = [];
  let cur = Dex.species.get(id);
  while (cur.prevo) { cur = Dex.species.get(cur.prevo); list.push(cur.name); }
  return list;
})();

const header = '// ARQUIVO GERADO por scripts/gen-data.mjs (dados do Pokémon Showdown via @pkmn/dex). Não edite à mão.\n';
const body =
  header +
  `export const SPECIES = ${JSON.stringify(species, null, 1)};\n` +
  `export const LEARNSETS = ${JSON.stringify(learnsets)};\n` +
  `export const MOVES = ${JSON.stringify(moves, null, 1)};\n` +
  `export const TYPE_CHART = ${JSON.stringify(chart)};\n`;
writeFileSync(join(root, 'www/js/data/generated.js'), body);
console.log(`Golpes: ${Object.keys(moves).length}`);
for (const id of SPECIES) console.log(`  ${id}: ${Object.keys(learnsets[id]).length}`);
