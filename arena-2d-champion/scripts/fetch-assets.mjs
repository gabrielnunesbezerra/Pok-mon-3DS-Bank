// Baixa os sprites usados no jogo para www/assets/ (rode uma vez: npm run fetch-assets).
// - Sprites de batalha em 8 direções: PMD SpriteCollab (CC BY-NC 4.0, créditos em assets/credits.json)
// - Megas sem sprite PMD: desenho 2D de frente e de costas (estilo Black/White) do PokeRogue,
//   reduzido para o tamanho de pixel do PMD e animado por partes em sprite-tools.mjs
// - Arte oficial para os menus: repositório PokeAPI/sprites
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { animateSprite, downscalePng } from './sprite-tools.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www/assets');
const COLLAB = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master';
const POKEAPI = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

// chave do jogo -> pasta do SpriteCollab (sprite) e do retrato
// bw: sprite 2D do PokeRogue (número-forma) e rig: como animar as partes (frações da altura):
//   breathe = linha acima da qual o corpo respira, sway = parte de cima que balança, legs = linha das
//   patas, legBins = quantas faixas de patas alternam, wings = asas fora do centro, fly = não pisa no chão
const SPRITES = {
  venusaur: { sprite: '0003', portrait: '0003' },
  charizard: { sprite: '0006', portrait: '0006' },
  blastoise: { sprite: '0009', portrait: '0009' },
  weavile: { sprite: '0461', portrait: '0461' },
  charizardmegax: { sprite: '0006/0001', portrait: '0006/0001' },
  venusaurmega: { sprite: null, portrait: '0003/0001', bw: '3-mega', rig: { breathe: 0.55, sway: 0.32, legs: 0.82, legBins: 2 } },
  charizardmegay: { sprite: null, portrait: '0006/0002', bw: '6-mega-y', rig: { breathe: 0.5, sway: 0.2, legs: 0.85, legBins: 2, wings: { inner: 0.2, bottom: 0.7 }, fly: true } },
  blastoisemega: { sprite: null, portrait: '0009/0001', bw: '9-mega', rig: { breathe: 0.5, sway: 0.15, legs: 0.84, legBins: 2 } },
  steelix: { sprite: '0208', portrait: '0208' },
  gengar: { sprite: '0094', portrait: '0094' },
  steelixmega: { sprite: '0208/0001', portrait: '0208/0001' },
  gengarmega: { sprite: '0094/0001', portrait: '0094/0001' },
  lucario: { sprite: '0448', portrait: '0448' },
  lucariomega: { sprite: '0448/0001', portrait: '0448/0001' },
  gardevoir: { sprite: '0282', portrait: '0282' },
  gardevoirmega: { sprite: '0282/0001', portrait: '0282/0001' },
  tyranitar: { sprite: '0248', portrait: '0248' },
  tyranitarmega: { sprite: '0248/0001', portrait: '0248/0001' },
  absol: { sprite: '0359', portrait: '0359' },
  absolmega: { sprite: '0359/0001', portrait: '0359/0001' },
  manectric: { sprite: '0310', portrait: '0310' },
  manectricmega: { sprite: '0310/0001', portrait: '0310/0001' },
  altaria: { sprite: '0334', portrait: '0334' },
  altariamega: { sprite: '0334/0001', portrait: '0334/0001' },
  alakazam: { sprite: '0065', portrait: '0065' },
  alakazammega: { sprite: '0065/0001', portrait: '0065/0001' },
  houndoom: { sprite: '0229', portrait: '0229' },
  houndoommega: { sprite: '0229/0001', portrait: '0229/0001' },
  gallade: { sprite: '0475', portrait: '0475' },
  gallademega: { sprite: '0475/0001', portrait: '0475/0001' },
  aerodactyl: { sprite: '0142', portrait: '0142' },
  aerodactylmega: { sprite: '0142/0001', portrait: '0142/0001' },
  golisopod: { sprite: '0768', portrait: '0768' },
  golisopodmega: { sprite: null, portrait: '0768/0001', bw: '768-mega', rig: { breathe: 0.5, sway: 0.35, legs: 0.72, legBins: 4 } },
  mewtwo: { sprite: '0150', portrait: '0150' },
  mewtwomegax: { sprite: null, portrait: '0150/0001', bw: '150-mega-x', rig: { breathe: 0.5, sway: 0.25, legs: 0.8, legBins: 2 } },
  mewtwomegay: { sprite: '0150/0002', portrait: '0150/0002' },
  rayquaza: { sprite: '0384', portrait: '0384' },
  rayquazamega: { sprite: '0384/0001', portrait: '0384/0001' },
  garchomp: { sprite: '0445', portrait: '0445' },
  garchompmega: { sprite: null, portrait: '0445/0001', bw: '445-mega', rig: { breathe: 0.5, sway: 0.25, legs: 0.82, legBins: 2, wings: { inner: 0.25, bottom: 0.6 } } },
  garchompmegaz: { sprite: null, portrait: '0445/0002', bw: '445-mega-z', rig: { breathe: 0.5, sway: 0.25, legs: 0.82, legBins: 2, wings: { inner: 0.25, bottom: 0.6 } } },
  gyarados: { sprite: '0130', portrait: '0130' },
  gyaradosmega: { sprite: null, portrait: '0130/0001', bw: '130-mega', rig: { breathe: 0.6, sway: 0.45, legs: 1, legBins: 1, fly: true } },
  greninja: { sprite: '0658', portrait: '0658' },
  greninjamega: { sprite: null, portrait: '0658/0002', bw: '658-mega', rig: { breathe: 0.5, sway: 0.25, legs: 0.82, legBins: 2 } },
  dragonite: { sprite: '0149', portrait: '0149' },
  dragonitemega: { sprite: null, portrait: '0149/0001', bw: '149-mega', rig: { breathe: 0.5, sway: 0.2, legs: 0.85, legBins: 2, wings: { inner: 0.22, bottom: 0.55 }, fly: true } },
  blaziken: { sprite: '0257', portrait: '0257' },
  blazikenmega: { sprite: null, portrait: '0257/0001', bw: '257-mega', rig: { breathe: 0.5, sway: 0.3, legs: 0.8, legBins: 2 } },
  scizor: { sprite: '0212', portrait: '0212' },
  scizormega: { sprite: null, portrait: '0212/0001', bw: '212-mega', rig: { breathe: 0.5, sway: 0.2, legs: 0.82, legBins: 2, wings: { inner: 0.3, bottom: 0.5 } } },
  metagross: { sprite: '0376', portrait: '0376' },
  metagrossmega: { sprite: null, portrait: '0376/0001', bw: '376-mega', rig: { breathe: 0.5, sway: 0.15, legs: 0.7, legBins: 4, fly: true } },
  salamence: { sprite: '0373', portrait: '0373' },
  salamencemega: { sprite: null, portrait: '0373/0001', bw: '373-mega', rig: { breathe: 0.5, sway: 0.2, legs: 0.9, legBins: 2, wings: { inner: 0.2, bottom: 0.75 }, fly: true } },
  lopunny: { sprite: '0428', portrait: '0428' },
  lopunnymega: { sprite: '0428/0001', portrait: '0428/0001' },
  sableye: { sprite: '0302', portrait: '0302' },
  sableyemega: { sprite: '0302/0001', portrait: '0302/0001' },
  mawile: { sprite: '0303', portrait: '0303' },
  mawilemega: { sprite: '0303/0001', portrait: '0303/0001' },
  kangaskhan: { sprite: '0115', portrait: '0115' },
  kangaskhanmega: { sprite: '0115/0001', portrait: '0115/0001' },
  latios: { sprite: '0381', portrait: '0381' },
  latiosmega: { sprite: '0381/0001', portrait: '0381/0001' },
  darkrai: { sprite: '0491', portrait: '0491' },
  darkraimega: { sprite: '0491/0002', portrait: '0491/0002' },
  zeraora: { sprite: '0807', portrait: '0807' },
  zeraoramega: { sprite: '0807/0001', portrait: '0807/0001' },
  excadrill: { sprite: '0530', portrait: '0530' },
  excadrillmega: { sprite: '0530/0001', portrait: '0530/0001' },
  skarmory: { sprite: '0227', portrait: '0227' },
  skarmorymega: { sprite: '0227/0001', portrait: '0227/0001' },
  diancie: { sprite: '0719', portrait: '0719' },
  dianciemega: { sprite: '0719/0001', portrait: '0719/0001' },
};
const ROGUE = 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/images/pokemon';
const BW_SCALE = 0.5; // os desenhos BW têm o dobro de detalhe dos sprites do PMD
const SMOGON = 'https://raw.githubusercontent.com/smogon/sprites/master/src';
// Treinadores (sprites dos jogos e do Smogon Sprite Project)
const TRAINER_BASE = 'https://raw.githubusercontent.com/smogon/sprites/master/src/_uncategorized';
const TRAINERS = {
  ash: ['noncanonical/trainers/misc/Ash.png', 'Ash'],
  ashkalos: ['noncanonical/trainers/misc/Ash-Kalos.png', 'Ash (Kalos)'],
  ashalola: ['noncanonical/trainers/misc/Ash-Alola.png', 'Ash (Alola)'],
  red: ['canonical/trainers/gen4/heartgold-soulsilver/Red.png', 'Red'],
  blue: ['canonical/trainers/gen4/heartgold-soulsilver/Blue.png', 'Blue'],
  misty: ['canonical/trainers/gen4/heartgold-soulsilver/Misty.png', 'Misty'],
  brock: ['canonical/trainers/gen4/heartgold-soulsilver/Brock.png', 'Brock'],
  dawn: ['canonical/trainers/gen4/platinum/Dawn.png', 'Dawn'],
  cynthia: ['canonical/trainers/gen5/black-white/Cynthia.png', 'Cynthia'],
  lance: ['canonical/trainers/gen4/heartgold-soulsilver/Lance.png', 'Lance'],
  steven: ['canonical/trainers/gen5/black2-white2/Steven.png', 'Steven'],
  korrina: ['noncanonical/trainers/gen6/x-y/Korrina.png', 'Korrina'],
  iris: ['canonical/trainers/gen5/black2-white2/Iris.png', 'Iris'],
  hilda: ['canonical/trainers/gen5/black-white/Hilda.png', 'Hilda'],
  lillie: ['noncanonical/trainers/gen7/sun-moon/Lillie.png', 'Lillie'],
  selene: ['noncanonical/trainers/gen7/sun-moon/Selene.png', 'Selene'],
};
const ARTWORK = {
  venusaur: 3, charizard: 6, blastoise: 9, weavile: 461, steelix: 208, gengar: 94,
  venusaurmega: 10033, charizardmegax: 10034, charizardmegay: 10035, blastoisemega: 10036, steelixmega: 10072, gengarmega: 10038,
  lucario: 448, lucariomega: 10059, gardevoir: 282, gardevoirmega: 10051, tyranitar: 248, tyranitarmega: 10049,
  absol: 359, absolmega: 10057, manectric: 310, manectricmega: 10055, altaria: 334, altariamega: 10067,
  alakazam: 65, alakazammega: 10037, houndoom: 229, houndoommega: 10048, gallade: 475, gallademega: 10068,
  aerodactyl: 142, aerodactylmega: 10042, golisopod: 768,
  mewtwo: 150, mewtwomegax: 10043, mewtwomegay: 10044, rayquaza: 384, rayquazamega: 10079, garchomp: 445, garchompmega: 10058,
  gyarados: 130, gyaradosmega: 10041, greninja: 658, dragonite: 149, blaziken: 257, blazikenmega: 10050, scizor: 212, scizormega: 10046,
  metagross: 376, metagrossmega: 10076, salamence: 373, salamencemega: 10089, lopunny: 428, lopunnymega: 10088, sableye: 302,
  sableyemega: 10066, mawile: 303, mawilemega: 10052, kangaskhan: 115, kangaskhanmega: 10039, latios: 381, latiosmega: 10063,
  darkrai: 491, darkraimega: 491, zeraora: 807, zeraoramega: 807, excadrill: 530, skarmory: 227, diancie: 719, dianciemega: 10075,
};
// sem arte oficial no PokeAPI: usa a imagem do Pokémon Champions guardada no smogon/sprites
// (Mega Darkrai e Mega Zeraora ainda não têm nenhuma: ficam com a arte da forma normal)
const ARTWORK_FALLBACK = {
  golisopodmega: 'champions/sgolisopod-omega.png', garchompmegaz: 'champions/sgarchomp-omega_z.png', greninjamega: 'champions/sgreninja-omega.png',
  dragonitemega: 'champions/sdragonite-omega.png', excadrillmega: 'champions/sexcadrill-omega.png', skarmorymega: 'champions/sskarmory-omega.png',
};
const WANTED_ANIMS = ['Idle', 'Walk', 'Attack', 'Shoot', 'Hurt', 'Sleep', 'Charge', 'Swing', 'Hop', 'Rotate', 'Withdraw', 'QuickStrike', 'Faint', 'Strike'];

async function get(url, binary = true) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) return binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
    if (res.status === 404) return null;
    await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
  }
  throw new Error(`Falha ao baixar ${url}`);
}

function parseAnimData(xml) {
  const anims = {};
  for (const m of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)) {
    const b = m[1];
    const tag = t => (b.match(new RegExp(`<${t}>(.*?)</${t}>`)) || [])[1];
    const name = tag('Name');
    const copy = tag('CopyOf');
    if (copy) { anims[name] = { copyOf: copy }; continue; }
    anims[name] = {
      w: +tag('FrameWidth'),
      h: +tag('FrameHeight'),
      durations: [...b.matchAll(/<Duration>(\d+)<\/Duration>/g)].map(d => +d[1]),
      hit: tag('HitFrame') ? +tag('HitFrame') : null,
      rush: tag('RushFrame') ? +tag('RushFrame') : null,
    };
  }
  return anims;
}

const tracker = JSON.parse(await get(`${COLLAB}/tracker.json`, false));
const names = {};
for (const line of (await get(`${COLLAB}/credit_names.txt`, false)).split('\n').slice(1)) {
  const [name, discord] = line.split('\t');
  if (discord) names[discord.trim()] = name.trim();
}
function node(path) {
  const [id, ...sub] = path.split('/');
  let n = tracker[id];
  for (const s of sub) n = n.subgroups[s];
  return n;
}
const credit = c => (c ? names[c] || c : null);

const manifest = {};
const credits = [];
rmSync(join(out, 'bw'), { recursive: true, force: true });
rmSync(join(out, 'gif'), { recursive: true, force: true });
for (const [key, src] of Object.entries(SPRITES)) {
  const entry = { anims: null, portrait: null, artwork: null, bw: null };
  if (src.sprite) {
    const dir = join(out, 'sprites', key);
    mkdirSync(dir, { recursive: true });
    const anims = parseAnimData(await get(`${COLLAB}/sprite/${src.sprite}/AnimData.xml`, false));
    const kept = {};
    for (const name of WANTED_ANIMS) {
      if (!anims[name]) continue;
      const real = anims[name].copyOf || name;
      if (!anims[real] || anims[real].copyOf) continue;
      if (!kept[real]) {
        const png = await get(`${COLLAB}/sprite/${src.sprite}/${real}-Anim.png`);
        if (!png) continue;
        writeFileSync(join(dir, `${real}.png`), png);
        kept[real] = anims[real];
      }
      if (real !== name) kept[name] = { copyOf: real };
    }
    entry.anims = kept;
    const n = node(src.sprite);
    credits.push({ what: `Sprite ${key}`, by: [credit(n.sprite_credit?.primary), ...(n.sprite_credit?.secondary || []).map(credit)].filter(Boolean) });
  }
  if (src.bw) {
    mkdirSync(join(out, 'bw'), { recursive: true });
    entry.bw = {};
    for (const [view, dir] of [['front', ''], ['back', 'back/']]) {
      const atlas = JSON.parse((await get(`${ROGUE}/${dir}${src.bw}.json`, false)) || 'null');
      const sheet = animateSprite(await get(`${ROGUE}/${dir}${src.bw}.png`), { scale: BW_SCALE, rig: src.rig, back: view === 'back', atlas });
      writeFileSync(join(out, 'bw', `${key}-${view}.png`), sheet.png);
      entry.bw[view] = { src: `assets/bw/${key}-${view}.png`, ...sheet.meta };
    }
    credits.push({ what: `Sprite ${key}`, by: ['PokeRogue (pagefaultgames/pokerogue-assets) e os artistas creditados lá', 'animação por partes feita no jogo'] });
  }
  // Mega sem retrato próprio usa o da forma normal
  const portrait = (await get(`${COLLAB}/portrait/${src.portrait}/Normal.png`)) || (await get(`${COLLAB}/portrait/${src.portrait.split('/')[0]}/Normal.png`));
  if (portrait) {
    mkdirSync(join(out, 'portraits'), { recursive: true });
    writeFileSync(join(out, 'portraits', `${key}.png`), portrait);
    entry.portrait = `assets/portraits/${key}.png`;
    const n = node(src.portrait);
    credits.push({ what: `Retrato ${key}`, by: [credit(n.portrait_credit?.primary), ...(n.portrait_credit?.secondary || []).map(credit)].filter(Boolean) });
  }
  const raw = ARTWORK[key] ? await get(`${POKEAPI}/other/official-artwork/${ARTWORK[key]}.png`) : await get(`${SMOGON}/${ARTWORK_FALLBACK[key]}`);
  const art = raw && downscalePng(raw, 256);
  if (art) {
    mkdirSync(join(out, 'artwork'), { recursive: true });
    writeFileSync(join(out, 'artwork', `${key}.png`), art);
    entry.artwork = `assets/artwork/${key}.png`;
  }
  manifest[key] = entry;
  console.log(key, entry.anims ? Object.keys(entry.anims).join(',') : '(sem sprite próprio)');
}

const trainers = {};
mkdirSync(join(out, 'trainers'), { recursive: true });
for (const [id, [path, name]] of Object.entries(TRAINERS)) {
  const png = await get(`${TRAINER_BASE}/${path}`);
  if (!png) { console.log('sem sprite de treinador', id); continue; }
  writeFileSync(join(out, 'trainers', `${id}.png`), png);
  trainers[id] = { name, img: `assets/trainers/${id}.png` };
}
credits.push({ what: 'Treinadores', by: ['sprites dos jogos (via Smogon)', 'Smogon Sprite Project (Ash, Korrina, Lillie, Selene)'] });

// Mega Venusaur da tela inicial: o desenho inteiro, sem reduzir, respirando
const titleSheet = animateSprite(await get(`${ROGUE}/${SPRITES.venusaurmega.bw}.png`), { scale: 1, rig: SPRITES.venusaurmega.rig, only: ['Idle'] });
writeFileSync(join(out, 'bw', 'title-venusaurmega.png'), titleSheet.png);
const { w, h, feet, cols, anims } = titleSheet.meta;
const title = { src: 'assets/bw/title-venusaurmega.png', w, h, feet, cols, frames: anims.Idle.durations.length, durations: anims.Idle.durations };

writeFileSync(join(root, 'www/js/data/sprites.js'),
  '// ARQUIVO GERADO por scripts/fetch-assets.mjs\n' +
  `export const SPRITE_DATA = ${JSON.stringify(manifest, null, 1)};\n` +
  `export const TRAINER_DATA = ${JSON.stringify(trainers, null, 1)};\n` +
  `export const TITLE_SPRITE = ${JSON.stringify(title)};\n`);
writeFileSync(join(out, 'credits.json'), JSON.stringify(credits, null, 1));
