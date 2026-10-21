// Gera www/js/data/generated.js a partir dos dados do Pokémon Showdown (@pkmn/dex).
// Rode com: npm run gen-data
// O arquivo gerado tem os golpes que cada Pokémon do jogo pode aprender (contando as pré-evoluções,
// golpes de ovo, TM, tutor e evento de todas as gerações) MENOS os que não servem para nada numa
// batalha 1 contra 1 (ver keepMove), os dados das espécies e das Megas, e a tabela de tipos.
import { Dex } from '@pkmn/dex';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPECIES = [
  'venusaur', 'charizard', 'blastoise', 'weavile', 'steelix', 'gengar',
  'lucario', 'gardevoir', 'tyranitar', 'absol', 'manectric', 'altaria', 'alakazam', 'houndoom', 'gallade', 'aerodactyl', 'golisopod',
];
const FORMS = [
  'venusaurmega', 'charizardmegax', 'charizardmegay', 'blastoisemega', 'steelixmega', 'gengarmega',
  'lucariomega', 'gardevoirmega', 'tyranitarmega', 'absolmega', 'manectricmega', 'altariamega', 'alakazammega', 'houndoommega',
  'gallademega', 'aerodactylmega', 'golisopodmega',
];

// ---------------------------------------------------------------- quais golpes ficam
// Golpes usados em sets competitivos (análises e estatísticas do Smogon, todas as gerações)
const toId = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const require = createRequire(import.meta.url);
const setsDir = dirname(require.resolve('@smogon/sets/package.json'));
const USED = {};
for (const file of readdirSync(setsDir).filter(f => /^gen\d.*\.json$/.test(f))) {
  const data = JSON.parse(readFileSync(join(setsDir, file), 'utf8'));
  for (const fmt of Object.values(data)) {
    const add = (sp, mv) => { if (Array.isArray(mv)) mv.forEach(m => add(sp, m)); else (USED[toId(sp)] ||= new Set()).add(toId(mv).replace(/^hiddenpower.+/, 'hiddenpower')); };
    for (const [sp, sets] of Object.entries(fmt.dex || {})) for (const set of Object.values(sets)) for (const mv of set.moves || []) add(sp, mv);
    for (const [sp, info] of Object.entries(fmt.stats || {})) for (const [mv, w] of Object.entries(info?.moves || {})) if (w >= 0.03) add(sp, mv);
  }
}

// Utilidade em batalha 1 contra 1, mesmo com pouco poder: status, aumento de atributo, cura,
// armadilhas, troca, clima, prioridade, poder variável e os golpes com forma especial na arena
const USEFUL = new Set(`
swordsdance dragondance calmmind nastyplot bulkup shellsmash quiverdance agility rockpolish irondefense amnesia
cottonguard curse coil honeclaws growth workup shiftgear bellydrum tailglow autotomize cosmicpower acidarmor barrier
protect detect substitute kingsshield spikyshield banefulbunker
recover roost synthesis morningsun moonlight rest sleeptalk slackoff softboiled milkdrink wish painsplit shoreup strengthsap
leechseed lifedew ingrain aquaring
toxic willowisp thunderwave glare stunspore sleeppowder spore hypnosis yawn lovelykiss toxicspikes spikes stealthrock stickyweb
taunt encore trick switcheroo haze clearsmog roar whirlwind dragontail circlethrow defog rapidspin uturn voltswitch flipturn
partingshot batonpass destinybond perishsong memento healingwish lightscreen reflect auroraveil safeguard tailwind healbell
aromatherapy disable trickroom wonderroom sunnyday raindance sandstorm hail snowscape grassyterrain electricterrain
psychicterrain mistyterrain magnetrise focuspunch futuresight
knockoff pursuit suckerpunch fakeout firstimpression extremespeed bulletpunch machpunch vacuumwave iceshard aquajet
shadowsneak quickattack accelerock feint
nightshade seismictoss superfang endeavor counter mirrorcoat metalburst
lowkick grassknot heavyslam heatcrash gyroball reversal flail return electroball storedpower powertrip acrobatics weatherball
hex avalanche revenge payback assurance retaliate hiddenpower
icywind electroweb mudshot rocktomb bulldoze snarl chargebeam flamecharge poweruppunch trailblaze smackdown
gigadrain drainpunch hornleech leechlife drainingkiss paraboliccharge
fly dig dive bounce phantomforce shadowforce skydrop solarbeam solarblade skyattack hyperbeam gigaimpact explosion
outrage thrash petaldance rollout dreameater
`.trim().split(/\s+/));

// Fracos, imprecisos ou que só servem em dupla: saem mesmo se aparecerem em algum set antigo
const JUNK = new Set(`
helpinghand followme ragepowder allyswitch afteryou quash wideguard quickguard entrainment spotlight instruct coaching
holdhands celebrate happyhour splash confide swagger flatter attract captivate metronome mimic sketch transform
naturepower secretpower naturalgift fling bide rage skullbash razorwind selfdestruct doubleteam minimize lockon mindreader
foresight odorsleuth miracleeye magiccoat snatch focusenergy laserfocus psychup imprison grudge snore nightmare endure
stockpile spitup swallow recycle bestow lastresort round echoedvoice furycutter megapunch megakick strength cut headbutt
slam takedown submission dizzypunch doubleslap cometpunch furyswipes furyattack spikecannon barrage eggbomb rocksmash
`.trim().split(/\s+/));

// Golpes com efeito próprio que o jogo ainda não sabe fazer: ficam de fora
const UNSUPPORTED = new Set([]);

function effectivePower(m) {
  if (Array.isArray(m.multihit)) return m.basePower * (m.multihit[1] >= 5 ? 3.1 : m.multihit[1]);
  if (m.multihit) return m.basePower * m.multihit;
  return m.basePower;
}

function keepMove(m, used) {
  if (!m.exists || JUNK.has(m.id) || UNSUPPORTED.has(m.id)) return false;
  if (m.isNonstandard && !['Past', 'Unobtainable', 'Future'].includes(m.isNonstandard)) return false;
  if (m.isZ || m.isMax) return false;
  if (used.has(m.id) || USEFUL.has(m.id)) return true;
  if (m.category === 'Status') return false;
  if (m.priority > 0) return true;
  const acc = m.accuracy === true ? 100 : m.accuracy;
  return effectivePower(m) >= 60 && acc >= 70;
}

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
const removed = {};
for (const id of SPECIES) {
  const learned = {};
  const used = new Set([...(USED[id] || []), ...FORMS.filter(f => Dex.species.get(f).baseSpecies === Dex.species.get(id).name).flatMap(f => [...(USED[f] || [])])]);
  removed[id] = [];
  let cur = Dex.species.get(id);
  while (cur && cur.exists) {
    const ls = await Dex.learnsets.get(cur.id);
    for (const [moveId, sources] of Object.entries(ls?.learnset || {})) {
      if (!keepMove(Dex.moves.get(moveId), used)) { if (!removed[id].includes(moveId)) removed[id].push(moveId); continue; }
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
    overrideDefensiveStat: m.overrideDefensiveStat,
    ignoreDefensive: m.ignoreDefensive,
    ignoreEvasion: m.ignoreEvasion,
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
for (const id of SPECIES) console.log(`  ${id}: ${Object.keys(learnsets[id]).length} (fora: ${removed[id].length})`);
if (process.argv.includes('--removed')) {
  const all = new Set(Object.values(removed).flat());
  for (const id of Object.values(learnsets).flatMap(Object.keys)) all.delete(id);
  console.log('Removidos:', [...all].sort().join(' '));
}
