// Baixa os sprites usados no jogo para www/assets/ (rode uma vez: npm run fetch-assets).
// - Sprites de batalha em 8 direções: PMD SpriteCollab (CC BY-NC 4.0, créditos em assets/credits.json)
// - Megas sem sprite PMD: animações de frente e de costas do repositório smogon/sprites (pasta models),
//   convertidas em folhas de pixel art por gif-sheet.mjs; Mega Golisopod só tem imagem parada (champions)
// - Arte oficial para os menus: repositório PokeAPI/sprites
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { gifToSheet, pngToSprite, downscalePng } from './gif-sheet.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www/assets');
const COLLAB = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master';
const POKEAPI = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

// chave do jogo -> pasta do SpriteCollab (sprite) e do retrato
// gif: animação dos "models" do Smogon (scale = redução para o tamanho de pixel do jogo)
// rig: imagem parada que o jogo anima por partes
const SPRITES = {
  venusaur: { sprite: '0003', portrait: '0003' },
  charizard: { sprite: '0006', portrait: '0006' },
  blastoise: { sprite: '0009', portrait: '0009' },
  weavile: { sprite: '0461', portrait: '0461' },
  charizardmegax: { sprite: '0006/0001', portrait: '0006/0001' },
  venusaurmega: { sprite: null, portrait: '0003/0001', gif: 'venusaur-omega', scale: 0.33 },
  charizardmegay: { sprite: null, portrait: '0006/0002', gif: 'charizard-omega_y', scale: 0.33 },
  blastoisemega: { sprite: null, portrait: '0009/0001', gif: 'blastoise-omega', scale: 0.39 },
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
  golisopodmega: { sprite: null, portrait: '0768/0001', rig: 'champions/sgolisopod-omega.png', scale: 0.39 },
};
const SMOGON = 'https://raw.githubusercontent.com/smogon/sprites/master/src';
// Mega Venusaur maior e mais detalhada para a tela inicial
const TITLE_GIF = { gif: 'venusaur-omega', scale: 0.62 };
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
};
// sem arte oficial no PokeAPI: usa a imagem do Pokémon Champions guardada no smogon/sprites
const ARTWORK_FALLBACK = { golisopodmega: 'champions/sgolisopod-omega.png' };
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
for (const [key, src] of Object.entries(SPRITES)) {
  const entry = { anims: null, portrait: null, artwork: null, gif: null, rig: null };
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
  if (src.gif) {
    mkdirSync(join(out, 'gif'), { recursive: true });
    entry.gif = {};
    for (const [view, suffix] of [['front', ''], ['back', '-b']]) {
      const sheet = gifToSheet(await get(`${SMOGON}/models/s${src.gif}${suffix}.gif`), { scale: src.scale });
      writeFileSync(join(out, 'gif', `${key}-${view}.png`), sheet.png);
      entry.gif[view] = { src: `assets/gif/${key}-${view}.png`, ...sheet.meta };
    }
    credits.push({ what: `Sprite ${key}`, by: ['animação 3D dos jogos, via smogon/sprites (models)'] });
  }
  if (src.rig) {
    mkdirSync(join(out, 'gif'), { recursive: true });
    const sprite = pngToSprite(await get(`${SMOGON}/${src.rig}`), { scale: src.scale });
    writeFileSync(join(out, 'gif', `${key}-rig.png`), sprite.png);
    entry.rig = { src: `assets/gif/${key}-rig.png`, ...sprite.meta };
    credits.push({ what: `Sprite ${key}`, by: ['Pokémon Champions, via smogon/sprites (animado por partes no jogo)'] });
  }
  const portrait = await get(`${COLLAB}/portrait/${src.portrait}/Normal.png`);
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

// Mega Venusaur da tela inicial
const titleSheet = gifToSheet(await get(`${SMOGON}/models/s${TITLE_GIF.gif}.gif`), { scale: TITLE_GIF.scale });
writeFileSync(join(out, 'gif', 'title-venusaurmega.png'), titleSheet.png);
const title = { src: 'assets/gif/title-venusaurmega.png', ...titleSheet.meta };

writeFileSync(join(root, 'www/js/data/sprites.js'),
  '// ARQUIVO GERADO por scripts/fetch-assets.mjs\n' +
  `export const SPRITE_DATA = ${JSON.stringify(manifest, null, 1)};\n` +
  `export const TRAINER_DATA = ${JSON.stringify(trainers, null, 1)};\n` +
  `export const TITLE_SPRITE = ${JSON.stringify(title)};\n`);
writeFileSync(join(out, 'credits.json'), JSON.stringify(credits, null, 1));
