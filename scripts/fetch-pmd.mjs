// Baixa do PMD SpriteCollab (CC BY-NC 4.0) os sprites e retratos de todas as formas do PK confront
// e gera www/assets/pmd/manifest.json (animações, tamanho dos quadros, pés, cabeça e largura) e
// www/assets/creditos.json. Rode uma vez: npm run fetch-pmd
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www/assets/pmd');
const COLLAB = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master';
const ANIMS = ['Idle', 'Walk', 'Attack', 'Strike', 'Shoot', 'Hurt', 'Sleep', 'Charge', 'Swing', 'Hop', 'Rotate', 'Faint', 'Double', 'Kick', 'Punch', 'Jab', 'MultiStrike', 'QuickStrike', 'Withdraw', 'Pose', 'Special0', 'SpAttack'];

// formas do jogo: dex do SpriteCollab (forma depois do traço)
const ref = JSON.parse(readFileSync(join(root, 'docs/referencia/ref9.json'), 'utf8'));
const dexs = new Set();
for (const p of ref.roster) for (const f of [p, ...(p.evoluciones ?? [])]) { dexs.add(f.dex); if (f.mega) dexs.add(f.mega.dex); }
// linhas novas (Magikarp e Seedot)
for (const d of ['0129', '0130', '0273', '0274', '0275', '0063', '0064', '0065', '0065-0001', '1012', '1013', '0602', '0603', '0604', '0604-0001', '0976', '0884', '1018', '0349', '0350', '0333', '0334', '0334-0001', '0137', '0233', '0474', '0150', '0150-0002']) dexs.add(d);
// versão shiny de cada forma: mesma pasta com "s" no fim (0006-0001s)
for (const d of [...dexs]) dexs.add(d + 's');
const pathOf = d => (d.endsWith('s') ? (d.includes('-') ? d.slice(0, -1).replace('-', '/') + '/0001' : d.slice(0, -1) + '/0000/0001') : d.replace('-', '/'));

async function get(url, binary = true) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url);
    if (res.ok) return binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
    if (res.status === 404) return null;
    await new Promise(r => setTimeout(r, 1000 * 2 ** i));
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
      fw: +tag('FrameWidth'), fh: +tag('FrameHeight'),
      durations: [...b.matchAll(/<Duration>(\d+)<\/Duration>/g)].map(d => +d[1]),
      hit: tag('HitFrame') != null ? +tag('HitFrame') : null,
      rush: tag('RushFrame') != null ? +tag('RushFrame') : null,
    };
  }
  return anims;
}

// pés, cabeça e largura do corpo, medidos no primeiro quadro de Idle voltado para baixo
function medir(png, a) {
  const img = PNG.sync.read(png);
  let y0 = a.fh, y1 = -1, x0 = a.fw, x1 = -1;
  for (let y = 0; y < a.fh; y++) for (let x = 0; x < a.fw; x++) {
    if (img.data[(y * img.width + x) * 4 + 3] > 20) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  }
  // o centro do quadro é o ponto (0,0): pés e cabeça em relação a ele
  return { feet: y1 + 1 - a.fh / 2, head: y0 - a.fh / 2, width: Math.max(0, x1 - x0 + 1) };
}

const tracker = JSON.parse(await get(`${COLLAB}/tracker.json`, false));
const names = {};
for (const line of (await get(`${COLLAB}/credit_names.txt`, false)).split('\n').slice(1)) {
  const [name, discord] = line.split('\t');
  if (discord) names[discord.trim()] = name.trim();
}
const nodeOf = path => { const [id, ...sub] = path.split('/'); let n = tracker[id]; for (const s of sub) n = n?.subgroups?.[s]; return n; };
const nome = c => (c ? names[c] || c : null);

// incremental: o que já foi baixado fica
let manifest = {};
try { manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8')); } catch { /* primeira vez */ }
let creditos = [];
try { creditos = JSON.parse(readFileSync(join(root, 'www/assets/creditos.json'), 'utf8')); } catch { /* primeira vez */ }
void rmSync;
for (const dex of [...dexs].sort()) {
  if (manifest[dex]) continue;
  const path = pathOf(dex);
  const dir = join(out, dex);
  mkdirSync(dir, { recursive: true });
  const xml = await get(`${COLLAB}/sprite/${path}/AnimData.xml`, false);
  if (!xml) { console.log(dex, 'sem sprite'); continue; }
  const anims = parseAnimData(xml);
  const kept = {};
  for (const name of ANIMS) {
    const a = anims[name];
    if (!a) continue;
    const real = a.copyOf || name;
    if (!anims[real] || anims[real].copyOf) continue;
    if (!kept[real]) {
      const png = await get(`${COLLAB}/sprite/${path}/${real}-Anim.png`);
      if (!png) continue;
      writeFileSync(join(dir, `${real}.png`), png);
      kept[real] = { file: `${dex}/${real}.png`, ...anims[real] };
      if (real === 'Idle') Object.assign(kept, { __medidas: medir(png, anims[real]) });
    }
    if (real !== name) kept[name] = kept[real];
  }
  const { __medidas, ...animsOk } = kept;
  const portrait = await get(`${COLLAB}/portrait/${path}/Normal.png`) || (dex.endsWith('s') ? await get(`${COLLAB}/portrait/${pathOf(dex.slice(0, -1))}/Normal.png`) : null) || await get(`${COLLAB}/portrait/${path.split('/')[0]}/Normal.png`);
  if (portrait) writeFileSync(join(dir, 'portrait.png'), portrait);
  manifest[dex] = { ...__medidas, anims: animsOk };
  const n = nodeOf(path);
  creditos.push({ dex, sprite: [nome(n?.sprite_credit?.primary), ...(n?.sprite_credit?.secondary || []).map(nome)].filter(Boolean), retrato: [nome(n?.portrait_credit?.primary), ...(n?.portrait_credit?.secondary || []).map(nome)].filter(Boolean) });
  console.log(dex, Object.keys(animsOk).join(','));
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest));
writeFileSync(join(root, 'www/assets/creditos.json'), JSON.stringify(creditos, null, 1));
