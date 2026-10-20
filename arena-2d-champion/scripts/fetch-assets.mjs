// Baixa os sprites usados no jogo para www/assets/ (rode uma vez: npm run fetch-assets).
// - Sprites de batalha em 8 direções: PMD SpriteCollab (CC BY-NC 4.0, créditos em assets/credits.json)
// - Arte oficial para os menus: repositório PokeAPI/sprites
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www/assets');
const COLLAB = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master';
const POKEAPI = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

// chave do jogo -> pasta do SpriteCollab (sprite) e do retrato
const SPRITES = {
  venusaur: { sprite: '0003', portrait: '0003' },
  charizard: { sprite: '0006', portrait: '0006' },
  blastoise: { sprite: '0009', portrait: '0009' },
  weavile: { sprite: '0461', portrait: '0461' },
  charizardmegax: { sprite: '0006/0001', portrait: '0006/0001' },
  venusaurmega: { sprite: null, portrait: '0003/0001' },
  charizardmegay: { sprite: null, portrait: '0006/0002' },
  blastoisemega: { sprite: null, portrait: '0009/0001' },
};
const ARTWORK = {
  venusaur: 3, charizard: 6, blastoise: 9, weavile: 461,
  venusaurmega: 10033, charizardmegax: 10034, charizardmegay: 10035, blastoisemega: 10036,
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
for (const [key, src] of Object.entries(SPRITES)) {
  const entry = { anims: null, portrait: null, artwork: null };
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
  const portrait = await get(`${COLLAB}/portrait/${src.portrait}/Normal.png`);
  if (portrait) {
    mkdirSync(join(out, 'portraits'), { recursive: true });
    writeFileSync(join(out, 'portraits', `${key}.png`), portrait);
    entry.portrait = `assets/portraits/${key}.png`;
    const n = node(src.portrait);
    credits.push({ what: `Retrato ${key}`, by: [credit(n.portrait_credit?.primary), ...(n.portrait_credit?.secondary || []).map(credit)].filter(Boolean) });
  }
  const art = await get(`${POKEAPI}/other/official-artwork/${ARTWORK[key]}.png`);
  if (art) {
    mkdirSync(join(out, 'artwork'), { recursive: true });
    writeFileSync(join(out, 'artwork', `${key}.png`), art);
    entry.artwork = `assets/artwork/${key}.png`;
  }
  manifest[key] = entry;
  console.log(key, entry.anims ? Object.keys(entry.anims).join(',') : '(sem sprite próprio)');
}

writeFileSync(join(root, 'www/js/data/sprites.js'),
  '// ARQUIVO GERADO por scripts/fetch-assets.mjs\n' +
  `export const SPRITE_DATA = ${JSON.stringify(manifest, null, 1)};\n`);
writeFileSync(join(out, 'credits.json'), JSON.stringify(credits, null, 1));
