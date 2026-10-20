// Telas de menu em HTML: título, montagem de time, escolha de golpes, opções, pausa,
// troca depois de desmaio, resultado, Golpedex, ajuda e créditos.
import {
  SPECIES, MOVES, LEARNSETS, ITEMS, ABILITIES, BASE_SPECIES, PRESETS, TYPE_PT, TYPE_COLOR, CAT_PT, MEGA_STONE_FOR,
  HIDDEN_POWER_TYPES, displayName, toId,
} from '../data/dex.js';
import { describeMove } from '../data/movetext.js';
import { staminaCost, baseCooldown } from '../engine/actions.js';
import { ARENAS } from '../engine/battle.js';

const ui = () => document.getElementById('ui');

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

export function clearUi() { ui().innerHTML = ''; }
function mount(el, keep = false) { if (!keep) clearUi(); ui().append(el); return el; }

const typeChip = t => h('span', { class: 'type', style: { background: TYPE_COLOR[t] } }, TYPE_PT[t]);
const portrait = (app, key) => app.bank.portraits[key]?.src || '';
const artwork = (app, key) => app.bank.artwork[key]?.src || '';

function sfx(app, name = 'ui') { app.sound.unlock(); app.sound.play(name); }

// ---------------------------------------------------------------- carregando
export function showLoading() {
  const bar = h('div');
  mount(h('div', { class: 'screen loading' },
    h('div', { class: 'logo' }, h('div', { class: 'big' }, 'ARENA 2D'), h('div', { class: 'top' }, 'CHAMPION')),
    h('div', { class: 'bar' }, bar),
    h('div', { class: 'hint' }, 'Carregando sprites...')));
  return p => { bar.style.width = `${Math.round(p * 100)}%`; };
}

// ---------------------------------------------------------------- título
export function showTitle(app) {
  app.sound.playMusic('menu');
  mount(h('div', { class: 'screen title' },
    h('div', { class: 'art-row' }, ...BASE_SPECIES.map(sp => h('img', { src: artwork(app, sp), alt: SPECIES[sp].name }))),
    h('div', { class: 'logo' },
      h('div', { class: 'big' }, 'ARENA 2D'),
      h('div', { class: 'top' }, 'CHAMPION'),
      h('div', { class: 'sub' }, 'Batalha Pokémon em tempo real')),
    h('div', { class: 'menu' },
      h('button', { class: 'primary', onclick: () => { sfx(app, 'select'); app.mode = '1p'; showTeamBuilder(app, 0); } }, '1 JOGADOR'),
      h('button', { class: 'blue', onclick: () => { sfx(app, 'select'); app.mode = '2p'; showTeamBuilder(app, 0); } }, '2 JOGADORES'),
      h('button', { class: 'gold', onclick: () => { sfx(app); showDex(app); } }, 'GOLPEDEX'),
      h('button', { onclick: () => { sfx(app); showHelp(app, () => showTitle(app)); } }, 'COMO JOGAR'),
      h('button', { onclick: () => { sfx(app); showSettings(app, () => showTitle(app)); } }, 'OPÇÕES'),
      h('button', { onclick: () => { sfx(app); showCredits(app); } }, 'CRÉDITOS')),
    h('div', { class: 'footer-note' }, 'Projeto de fã, sem fins lucrativos. Pokémon © Nintendo, Creatures e GAME FREAK.')));
}

// ---------------------------------------------------------------- montagem do time
export function defaultSet(species, presetIndex = 0) {
  const p = PRESETS[species][presetIndex];
  return { species, ability: p.ability, item: p.item, gender: species === 'weavile' ? 'F' : 'M', moves: [...p.moves], hpType: 'Fire' };
}

export function randomTeam(size = 3) {
  const pool = [...BASE_SPECIES].sort(() => Math.random() - 0.5).slice(0, size);
  return pool.map(sp => {
    if (Math.random() < 0.6) return defaultSet(sp, Math.floor(Math.random() * PRESETS[sp].length));
    const learn = Object.keys(LEARNSETS[sp]).filter(id => MOVES[id] && !MOVES[id].nonstd);
    const dmg = learn.filter(id => MOVES[id].cat !== 'Status' && MOVES[id].bp >= 60).sort(() => Math.random() - 0.5);
    const status = learn.filter(id => MOVES[id].cat === 'Status').sort(() => Math.random() - 0.5);
    const moves = [...dmg.slice(0, 3), status[0] || dmg[3]];
    const sp0 = SPECIES[sp];
    const stones = MEGA_STONE_FOR[sp];
    const items = ['leftovers', 'lifeorb', 'sitrusberry', 'expertbelt', 'focussash'];
    return {
      species: sp,
      ability: toId(sp0.abilities[Math.floor(Math.random() * sp0.abilities.length)]),
      item: stones.length && Math.random() < 0.6 ? stones[Math.floor(Math.random() * stones.length)] : items[Math.floor(Math.random() * items.length)],
      gender: Math.random() < 0.5 ? 'M' : 'F',
      moves,
      hpType: 'Fire',
    };
  });
}

export function showTeamBuilder(app, player) {
  const team = app.teams[player];
  const tag = app.mode === '2p' ? `JOGADOR ${player + 1}` : 'SEU TIME';
  const body = h('div', { class: 'team' });
  const render = () => {
    body.innerHTML = '';
    for (let slot = 0; slot < 3; slot++) body.append(slotCard(app, team, slot, render));
  };
  render();
  const next = () => {
    if (!team.length) return;
    app.saveTeams();
    sfx(app, 'select');
    if (app.mode === '2p' && player === 0) showTeamBuilder(app, 1);
    else showSetup(app);
  };
  mount(h('div', { class: 'screen' },
    h('div', { class: 'topbar' },
      h('button', { class: 'small ghost', onclick: () => { sfx(app, 'back'); player === 1 ? showTeamBuilder(app, 0) : showTitle(app); } }, '< VOLTAR'),
      h('h2', { class: player === 0 ? 'p1' : 'p2' }, `${tag} (até 3 Pokémon)`),
      h('button', { class: 'small', onclick: () => { sfx(app); app.teams[player] = BASE_SPECIES.slice(0, 3).map(sp => defaultSet(sp)); showTeamBuilder(app, player); } }, 'SUGERIDO'),
      h('button', { class: 'small', onclick: () => { sfx(app); app.teams[player] = randomTeam(3); showTeamBuilder(app, player); } }, 'ALEATÓRIO'),
      h('button', { class: 'small primary', onclick: next }, 'PRONTO >')),
    h('div', { class: 'scroll' }, body)));
}

function slotCard(app, team, slot, rerender) {
  const set = team[slot];
  if (!set) {
    if (slot > team.length) return h('div', { class: 'card empty' }, h('div', { class: 'hint' }, 'Vaga livre'));
    return h('div', { class: 'card empty' },
      h('div', { class: 'hint' }, 'Adicionar Pokémon'),
      h('div', { class: 'species-row', style: { width: '100%' } }, ...BASE_SPECIES.map(sp => h('button', { onclick: () => { sfx(app); team.push(defaultSet(sp)); rerender(); } }, h('img', { src: portrait(app, sp), alt: sp })))));
  }
  const sp = SPECIES[set.species];
  const stones = MEGA_STONE_FOR[set.species];
  const megaId = stones.includes(set.item) ? ITEMS[set.item].mega.to : null;
  const itemSel = h('select', { onchange: e => { set.item = e.target.value; rerender(); } },
    ...Object.entries(ITEMS).filter(([id, it]) => !it.mega || stones.includes(id)).map(([id, it]) => h('option', { value: id, selected: id === (set.item || 'none') }, it.name)));
  const head = h('div', { class: 'card-head' },
    h('img', { src: artwork(app, megaId || set.species) }),
    h('div', {},
      h('div', { class: 'name' }, sp.name),
      h('div', { class: 'types' }, ...(megaId ? SPECIES[megaId].types : sp.types).map(typeChip)),
      megaId ? h('div', { class: 'hint', style: { color: '#ff9ce8' } }, `Mega: ${displayName(megaId)} (${SPECIES[megaId].abilities[0]})`) : null));
  const abilityRow = h('div', { class: 'row' }, h('label', {}, 'Habilidade'),
    ...sp.abilities.map(a => h('button', { class: `small ${toId(a) === set.ability ? 'on' : ''}`, onclick: () => { set.ability = toId(a); rerender(); } }, a)));
  const genderRow = h('div', { class: 'row' }, h('label', {}, 'Gênero'),
    h('button', { class: `small ${set.gender === 'M' ? 'on' : ''}`, onclick: () => { set.gender = 'M'; rerender(); } }, '♂'),
    h('button', { class: `small ${set.gender === 'F' ? 'on' : ''}`, onclick: () => { set.gender = 'F'; rerender(); } }, '♀'),
    team.length > 1 ? h('button', { class: 'small ghost', style: { marginLeft: 'auto' }, onclick: () => { team.splice(slot, 1); rerender(); } }, 'REMOVER') : null);
  const moves = h('div', { class: 'moves' }, ...[0, 1, 2, 3].map(k => {
    const id = set.moves[k];
    if (!id) return h('button', { class: 'move-btn emptymove', onclick: () => pickMove(app, set, k, rerender) }, '+ golpe');
    const m = MOVES[id];
    return h('button', { class: 'move-btn', style: { background: TYPE_COLOR[m.type] }, onclick: () => pickMove(app, set, k, rerender) },
      m.name, h('small', {}, `${TYPE_PT[m.type]} · ${m.cat === 'Status' ? 'Status' : `Pod ${m.bp || '—'}`}`));
  }));
  const hp = set.moves.includes('hiddenpower')
    ? h('div', { class: 'row' }, h('label', {}, 'Hidden Power'),
      h('select', { onchange: e => { set.hpType = e.target.value; } }, ...HIDDEN_POWER_TYPES.map(t => h('option', { value: t, selected: t === set.hpType }, TYPE_PT[t]))))
    : null;
  return h('div', { class: 'card' },
    h('div', { class: 'species-row' }, ...BASE_SPECIES.map(s => h('button', {
      class: s === set.species ? 'on' : '',
      onclick: () => { if (s !== set.species) { team[slot] = defaultSet(s); sfx(app); rerender(); } },
    }, h('img', { src: portrait(app, s), alt: s })))),
    head,
    moves,
    hp,
    abilityRow,
    h('div', { class: 'hint' }, ABILITIES[set.ability]?.desc || ''),
    h('div', { class: 'row' }, h('label', {}, 'Item'), itemSel),
    h('div', { class: 'hint' }, ITEMS[set.item || 'none']?.desc || ''),
    genderRow);
}

function learnInfo(species, id) {
  const l = LEARNSETS[species]?.[id];
  if (!l) return '';
  const gens = l.gens[0] === l.gens[1] ? `Ger. ${l.gens[0]}` : `Ger. ${l.gens[0]}–${l.gens[1]}`;
  return `${l.how.join(', ')} (${gens})${l.via.length ? ` · via ${l.via.join('/')}` : ''}`;
}

function moveRow(app, id, { species = null, taken = false, onclick = null, learners = null } = {}) {
  const m = MOVES[id];
  const stats = m.cat === 'Status'
    ? `STA ${staminaCost({ foeActive: () => null }, null, m)}<br>REC ${baseCooldown(m).toFixed(1)}s`
    : `POD ${m.bp || '—'} · ${m.acc === true ? '—' : m.acc + '%'}<br>STA ${staminaCost({ foeActive: () => null }, null, m)} · REC ${baseCooldown(m).toFixed(1)}s`;
  return h('div', { class: `mrow ${taken ? 'taken' : ''}`, onclick },
    h('div', {}, typeChip(m.type), h('div', { class: 'type', style: { background: '#3a3d6e', marginTop: '4px', display: 'inline-block' } }, CAT_PT[m.cat])),
    h('div', {},
      h('div', { class: 'mname' }, m.name, m.nonstd === 'Past' ? h('span', { class: 'how' }, '  (gerações antigas)') : null),
      h('div', { class: 'mdesc' }, describeMove(id) || '—'),
      species ? h('div', { class: 'how' }, learnInfo(species, id)) : null,
      learners ? h('div', { class: 'how' }, learners) : null),
    h('div', { class: 'mstats', html: stats }));
}

function pickMove(app, set, k, rerender) {
  sfx(app);
  const all = Object.keys(LEARNSETS[set.species]).filter(id => MOVES[id]).sort((a, b) => MOVES[a].name.localeCompare(MOVES[b].name));
  const list = h('div', { class: 'movelist' });
  const search = h('input', { type: 'search', placeholder: 'Buscar golpe...' });
  const typeSel = h('select', {}, h('option', { value: '' }, 'Todos os tipos'), ...Object.keys(TYPE_PT).filter(t => all.some(id => MOVES[id].type === t)).map(t => h('option', { value: t }, TYPE_PT[t])));
  const catSel = h('select', {}, h('option', { value: '' }, 'Todas as categorias'), ...['Physical', 'Special', 'Status'].map(c => h('option', { value: c }, CAT_PT[c])));
  const count = h('span', { class: 'count' });
  const close = () => { modal.remove(); rerender(); };
  const render = () => {
    const q = search.value.trim().toLowerCase();
    const shown = all.filter(id => (!q || MOVES[id].name.toLowerCase().includes(q)) && (!typeSel.value || MOVES[id].type === typeSel.value) && (!catSel.value || MOVES[id].cat === catSel.value));
    count.textContent = `${shown.length} de ${all.length} golpes`;
    list.innerHTML = '';
    for (const id of shown) {
      const taken = set.moves.includes(id) && set.moves[k] !== id;
      list.append(moveRow(app, id, { species: set.species, taken, onclick: () => { if (taken) return; set.moves[k] = id; sfx(app, 'select'); close(); } }));
    }
  };
  search.addEventListener('input', render);
  typeSel.addEventListener('change', render);
  catSel.addEventListener('change', render);
  const modal = h('div', { class: 'modal' },
    h('div', { class: 'topbar' },
      h('button', { class: 'small ghost', onclick: () => { sfx(app, 'back'); close(); } }, '< VOLTAR'),
      h('h2', {}, `GOLPES DE ${SPECIES[set.species].name.toUpperCase()}`),
      set.moves.filter(Boolean).length > 1 && set.moves[k] ? h('button', { class: 'small', onclick: () => { set.moves.splice(k, 1); close(); } }, 'TIRAR ESTE GOLPE') : null),
    h('div', { class: 'filters' }, search, typeSel, catSel, count),
    h('div', { class: 'scroll' }, list));
  mount(modal, true);
  render();
}

// ---------------------------------------------------------------- opções da partida
export function showSetup(app) {
  const vsCpu = app.mode === '1p';
  const arenas = h('div', { class: 'arenas' });
  const swatch = { grass: 'linear-gradient(90deg,#4f9d3a 50%,#5aab44 50%)', water: 'linear-gradient(#2f7fd8,#1d5cb0)', ice: 'linear-gradient(#e4f5fc,#bfe3f2)' };
  const renderArenas = () => {
    arenas.innerHTML = '';
    for (const [id, a] of Object.entries(ARENAS)) {
      arenas.append(h('div', { class: `arena-opt ${app.arena === id ? 'on' : ''}`, onclick: () => { app.arena = id; sfx(app); renderArenas(); } },
        h('div', { class: 'swatch', style: { background: swatch[id] } }), h('h3', {}, a.name), h('p', {}, a.desc)));
    }
  };
  renderArenas();
  const opt = (label, values, key, names) => {
    const row = h('div', { class: 'opt-row' }, h('span', {}, label));
    const draw = () => {
      row.querySelectorAll('button').forEach(b => b.remove());
      values.forEach((v, i) => row.append(h('button', { class: `small ${app[key] === v ? 'on' : ''}`, onclick: () => { app[key] = v; sfx(app); draw(); } }, names[i])));
    };
    draw();
    return row;
  };
  mount(h('div', { class: 'screen' },
    h('div', { class: 'topbar' },
      h('button', { class: 'small ghost', onclick: () => { sfx(app, 'back'); showTeamBuilder(app, app.mode === '2p' ? 1 : 0); } }, '< VOLTAR'),
      h('h2', {}, 'PREPARAR BATALHA'),
      h('button', { class: 'primary', onclick: () => { sfx(app, 'go'); app.startBattle(); } }, 'LUTAR!')),
    h('div', { class: 'scroll' },
      h('div', { class: 'setup' },
        arenas,
        vsCpu ? opt('Dificuldade', ['easy', 'normal', 'hard'], 'difficulty', ['FÁCIL', 'NORMAL', 'DIFÍCIL']) : null,
        vsCpu ? opt('Time do rival', ['random', 'mirror', 'presets'], 'rivalMode', ['ALEATÓRIO', 'IGUAL AO MEU', 'SUGERIDO']) : null,
        opt('Tempo', [180, 240, 360, 5999], 'timeLimit', ['3 MIN', '4 MIN', '6 MIN', 'SEM LIMITE']),
        h('div', { class: 'hint' }, vsCpu
          ? 'Toque e arraste no lado esquerdo para andar. Toque nos golpes para usar (arraste o botão para mirar). Teclado: WASD, J K L ; para os golpes, Espaço para esquivar, E para Mega.'
          : 'Modo mesa: o jogador 1 joga pela parte de baixo da tela e o jogador 2 pela de cima. No teclado, o jogador 2 usa as setas e o teclado numérico.')))));
}

// ---------------------------------------------------------------- pausa e opções
export function showPause(app) {
  mount(h('div', { class: 'overlay' },
    h('div', { class: 'box' },
      h('h2', {}, 'PAUSA'),
      h('button', { class: 'primary', onclick: () => { sfx(app); app.resume(); } }, 'CONTINUAR'),
      h('button', { onclick: () => { sfx(app); showHelp(app, () => showPause(app)); } }, 'COMO JOGAR'),
      h('button', { onclick: () => { sfx(app); showSettings(app, () => showPause(app)); } }, 'OPÇÕES'),
      h('button', { class: 'ghost', onclick: () => { sfx(app, 'back'); app.quit(); } }, 'SAIR DA BATALHA'))));
}

export function showSettings(app, back) {
  const s = app.settings;
  const range = (label, key) => h('div', { class: 'opt-row' }, h('span', {}, label),
    h('input', { type: 'range', min: 0, max: 100, value: Math.round(s[key] * 100), oninput: e => { s[key] = e.target.value / 100; app.applySettings(); } }));
  const toggle = (label, key) => {
    const btn = h('button', { class: `small ${s[key] ? 'on' : ''}`, onclick: () => { s[key] = !s[key]; btn.className = `small ${s[key] ? 'on' : ''}`; btn.textContent = s[key] ? 'SIM' : 'NÃO'; app.applySettings(); } }, s[key] ? 'SIM' : 'NÃO');
    return h('div', { class: 'opt-row' }, h('span', {}, label), btn);
  };
  mount(h('div', { class: 'overlay' },
    h('div', { class: 'box' },
      h('h2', {}, 'OPÇÕES'),
      range('Música', 'music'),
      range('Efeitos', 'sfx'),
      toggle('Vibração', 'vibrate'),
      toggle('Mensagens', 'log'),
      toggle('Dicas de toque', 'touchHints'),
      h('button', { class: 'primary', onclick: () => { sfx(app); app.saveSettings(); back(); } }, 'OK'))));
}

// ---------------------------------------------------------------- troca depois de desmaio / Flip Turn
export function showChoice(app, battle) {
  const c = battle.choice;
  const side = battle.sides[c.side];
  const rotated = app.mode === '2p' && c.side === 1;
  mount(h('div', { class: 'overlay' },
    h('div', { class: `box ${rotated ? 'rotated' : ''}` },
      h('h2', {}, c.reason === 'faint' ? `${side.name}: escolha o próximo Pokémon` : `${side.name}: trocar para qual Pokémon?`),
      h('div', { class: 'choice-row' }, ...c.options.map(slot => {
        const m = side.mons[slot];
        return h('button', { onclick: () => { sfx(app, 'select'); clearUi(); battle.choose(slot); } },
          h('img', { src: portrait(app, m.baseSpecies) }),
          m.name,
          h('div', { class: 'hpbar' }, h('div', { style: { width: `${(m.hp / m.maxhp) * 100}%` } })));
      })))));
}

// ---------------------------------------------------------------- resultado
export function showResult(app, battle) {
  app.sound.playMusic('menu');
  const title = battle.winner === -1 ? 'EMPATE!' : `${battle.sides[battle.winner].name.toUpperCase()} VENCEU!`;
  const sideBox = s => h('div', { class: 'result-side' },
    h('h3', { style: { color: s.index === 0 ? '#ffb3a8' : '#a8c8ff' } }, `${s.name} · ${s.stats.ko} nocaute(s)`),
    ...s.mons.map(m => h('div', { class: 'result-mon' },
      h('img', { src: portrait(app, m.isMega ? m.species : m.baseSpecies) }),
      h('span', {}, `${m.name}: ${m.fainted ? 'desmaiou' : `${Math.round((m.hp / m.maxhp) * 100)}% dos PS`}`))));
  mount(h('div', { class: 'overlay' },
    h('div', { class: 'box' },
      h('h2', {}, title),
      h('div', { class: 'hint', style: { textAlign: 'center' } }, `Duração: ${Math.floor(battle.time / 60)}min ${Math.floor(battle.time % 60)}s`),
      h('div', { class: 'result-grid' }, sideBox(battle.sides[0]), sideBox(battle.sides[1])),
      h('div', { class: 'choice-row' },
        h('button', { class: 'primary', onclick: () => { sfx(app, 'select'); app.startBattle(); } }, 'REVANCHE'),
        h('button', { onclick: () => { sfx(app); app.stopBattle(); showTeamBuilder(app, 0); } }, 'TROCAR TIME'),
        h('button', { class: 'ghost', onclick: () => { sfx(app, 'back'); app.stopBattle(); showTitle(app); } }, 'MENU')))));
}

// ---------------------------------------------------------------- Golpedex
export function showDex(app) {
  const all = Object.keys(MOVES).filter(id => BASE_SPECIES.some(sp => LEARNSETS[sp][id])).sort((a, b) => MOVES[a].name.localeCompare(MOVES[b].name));
  const list = h('div', { class: 'movelist' });
  const search = h('input', { type: 'search', placeholder: 'Buscar golpe...' });
  const monSel = h('select', {}, h('option', { value: '' }, 'Todos os Pokémon'), ...BASE_SPECIES.map(sp => h('option', { value: sp }, SPECIES[sp].name)));
  const typeSel = h('select', {}, h('option', { value: '' }, 'Todos os tipos'), ...Object.keys(TYPE_PT).filter(t => all.some(id => MOVES[id].type === t)).map(t => h('option', { value: t }, TYPE_PT[t])));
  const count = h('span', { class: 'count' });
  const render = () => {
    const q = search.value.trim().toLowerCase();
    const shown = all.filter(id => (!q || MOVES[id].name.toLowerCase().includes(q)) && (!monSel.value || LEARNSETS[monSel.value][id]) && (!typeSel.value || MOVES[id].type === typeSel.value));
    count.textContent = `${shown.length} golpes`;
    list.innerHTML = '';
    for (const id of shown.slice(0, 400)) {
      const who = BASE_SPECIES.filter(sp => LEARNSETS[sp][id]).map(sp => SPECIES[sp].name).join(', ');
      list.append(moveRow(app, id, { species: monSel.value || null, learners: monSel.value ? null : `Aprendem: ${who}` }));
    }
  };
  search.addEventListener('input', render);
  monSel.addEventListener('change', render);
  typeSel.addEventListener('change', render);
  mount(h('div', { class: 'screen' },
    h('div', { class: 'topbar' },
      h('button', { class: 'small ghost', onclick: () => { sfx(app, 'back'); showTitle(app); } }, '< VOLTAR'),
      h('h2', {}, `GOLPEDEX · ${all.length} GOLPES`)),
    h('div', { class: 'filters' }, search, monSel, typeSel, count),
    h('div', { class: 'scroll' }, list)));
  render();
}

// ---------------------------------------------------------------- ajuda
export function showHelp(app, back) {
  mount(h('div', { class: 'overlay' },
    h('div', { class: 'box' },
      h('h2', {}, 'COMO JOGAR'),
      h('div', {
        class: 'text', html: `
<h3>Controles</h3>
<p>Arraste no lado esquerdo da tela para andar. Os quatro botões coloridos são os golpes: toque para soltar mirando no adversário, ou arraste o botão para mirar onde quiser. O botão branco é a esquiva: por um instante o Pokémon fica intocável.</p>
<p>No teclado: <kbd>WASD</kbd> anda, <kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd> <kbd>;</kbd> (ou <kbd>1</kbd>-<kbd>4</kbd>) usam os golpes, <kbd>Espaço</kbd> esquiva, <kbd>E</kbd> Mega Evolução, <kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd> trocam de Pokémon, <kbd>Esc</kbd> pausa. Controles de videogame também funcionam.</p>
<h3>Stamina e recarga</h3>
<p>Cada golpe gasta stamina (a barra amarela) e tem uma recarga própria. Golpes com pouco PP nos jogos gastam mais stamina, golpes fortes demoram mais para recarregar. Esquivar também gasta stamina.</p>
<h3>Igual aos jogos</h3>
<p>O dano usa a mesma fórmula dos jogos (nível 50), com STAB, tipos, críticos, clima, habilidades e itens. Status, mudanças de atributo, Protect, Substitute, Leech Seed, golpes de dois turnos, Fly, Dig e Dive funcionam como nos jogos, só que em tempo real: um "turno" vale alguns segundos.</p>
<h3>Clima</h3>
<p>No sol, Solar Beam sai sem carga, Fogo fica mais forte e Água mais fraca. Na chuva é o contrário, e Hurricane nunca erra. Chlorophyll, Solar Power, Rain Dish e Drought mudam conforme o clima.</p>
<h3>Mega Evolução</h3>
<p>Venusaur, Charizard e Blastoise segurando a Mega Pedra podem Mega Evoluir uma vez por batalha. A barra de Mega enche quando você causa dano, leva dano e esquiva no último instante. Cheia, aperte o botão MEGA.</p>
<h3>Choque de Megas</h3>
<p>Se um treinador Mega Evoluir e o outro responder com a própria Mega durante a animação, as Megas se chocam e criam um clima especial na arena: Sol Extremo, Chuva Torrencial, Tempestade Mega com raios caindo e outros, dependendo dos Pokémon.</p>
<h3>Choque de raios</h3>
<p>Quando dois golpes de raio (Solar Beam, Hydro Pump, Flamethrower, Ice Beam, Hyper Beam...) se encontram, começa o choque: toque o mais rápido que puder. Quem empurrar o raio até o outro lado acerta com mais força. Tipo e poder do golpe ajudam a empurrar.</p>
<h3>Arena</h3>
<p>Projéteis se chocam no ar. Fogo e Água juntos viram vapor, que atrapalha a mira. Fogo acende a grama do estádio, a água apaga. No Campo Aquático, golpes de Gelo congelam a água e criam chão firme.</p>` }),
      h('button', { class: 'primary', onclick: () => { sfx(app); back(); } }, 'OK'))));
}

// ---------------------------------------------------------------- créditos
export async function showCredits(app) {
  let credits = [];
  try { credits = await (await fetch('assets/credits.json')).json(); } catch { /* sem créditos detalhados */ }
  mount(h('div', { class: 'overlay' },
    h('div', { class: 'box' },
      h('h2', {}, 'CRÉDITOS'),
      h('div', {
        class: 'text', html: `
<p>Arena 2D Champion é um projeto de fã, feito para estudo e sem fins lucrativos. Pokémon e todos os nomes relacionados são marcas de Nintendo, Creatures Inc. e GAME FREAK inc.</p>
<h3>Dados</h3>
<p>Golpes, aprendizado, atributos e tipos: Pokémon Showdown (pacote @pkmn/dex).</p>
<h3>Sprites e retratos</h3>
<p>PMD Sprite Repository (SpriteCollab), licença CC BY-NC 4.0. Artes oficiais via PokeAPI/sprites.</p>
<p>${credits.map(c => `${c.what}: ${c.by.join(', ')}`).join('<br>')}</p>
<h3>Fontes</h3>
<p>Press Start 2P (CodeMan38) e Pixelify Sans (Stefie Justprince), licença SIL OFL 1.1.</p>
<h3>Música e efeitos</h3>
<p>Sintetizados no próprio jogo.</p>` }),
      h('button', { class: 'primary', onclick: () => { sfx(app); showTitle(app); } }, 'OK'))));
}
