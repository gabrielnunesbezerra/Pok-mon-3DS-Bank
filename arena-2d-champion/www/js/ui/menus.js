// Telas de menu em HTML: título, montagem de time, escolha de golpes, opções, pausa,
// troca depois de desmaio, resultado, Golpedex, ajuda e créditos.
import {
  SPECIES, MOVES, LEARNSETS, ITEMS, ABILITIES, BASE_SPECIES, PRESETS, TYPE_PT, TYPE_COLOR, CAT_PT, MEGA_STONE_FOR,
  HIDDEN_POWER_TYPES, displayName, toId,
} from '../data/dex.js';
import { describeMove } from '../data/movetext.js';
import { staminaCost, baseCooldown } from '../engine/actions.js';
import { TRAINER_DATA } from '../data/sprites.js';
import { cleanCode } from '../net/online.js';
import { TitleScene } from '../render/title.js';

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
  const canvas = h('canvas', { class: 'title-bg' });
  const stage = h('div', { class: 'title-stage' },
    h('div', { class: 'title-plate' }, h('span', {}, 'MEGA VENUSAUR'), typeChip('Grass'), typeChip('Poison')));
  mount(h('div', { class: 'screen title' },
    canvas,
    stage,
    h('div', { class: 'title-side' },
      h('div', { class: 'logo' },
        h('div', { class: 'big' }, 'ARENA 2D'),
        h('div', { class: 'top' }, 'CHAMPION'),
        h('div', { class: 'sub' }, 'Batalha Pokémon em tempo real')),
      h('div', { class: 'menu' },
        h('button', { class: 'primary', onclick: () => { sfx(app, 'select'); app.mode = '1p'; showTeamBuilder(app); } }, 'CONTRA A CPU'),
        h('button', { class: 'blue', onclick: () => { sfx(app, 'select'); app.mode = 'online'; showTeamBuilder(app); } }, 'ONLINE')),
      h('div', { class: 'menu sub' },
        h('button', { class: 'gold small', onclick: () => { sfx(app); showDex(app); } }, 'GOLPEDEX'),
        h('button', { class: 'small', onclick: () => { sfx(app); showHelp(app, () => showTitle(app)); } }, 'COMO JOGAR'),
        h('button', { class: 'small', onclick: () => { sfx(app); showSettings(app, () => showTitle(app)); } }, 'OPÇÕES'),
        h('button', { class: 'small', onclick: () => { sfx(app); showCredits(app); } }, 'CRÉDITOS')),
      h('div', { class: 'footer-note' }, 'Projeto de fã, sem fins lucrativos. Pokémon © Nintendo, Creatures e GAME FREAK.'))));
  new TitleScene(canvas, stage, app.bank.title).start();
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

export function showTeamBuilder(app) {
  const team = app.teams[0];

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
    if (app.mode === 'online') showOnline(app);
    else showSetup(app);
  };
  mount(h('div', { class: 'screen' },
    h('div', { class: 'topbar' },
      h('button', { class: 'small ghost', onclick: () => { sfx(app, 'back'); showTitle(app); } }, '< VOLTAR'),
      h('h2', { class: 'p1' }, 'SEU TIME (até 3 Pokémon)'),
      h('button', { class: 'small', onclick: () => { sfx(app); app.teams[0] = BASE_SPECIES.slice(0, 3).map(sp => defaultSet(sp)); showTeamBuilder(app); } }, 'SUGERIDO'),
      h('button', { class: 'small', onclick: () => { sfx(app); app.teams[0] = randomTeam(3); showTeamBuilder(app); } }, 'ALEATÓRIO'),
      h('button', { class: 'small primary', onclick: next }, 'PRONTO >')),
    h('div', { class: 'scroll' }, body)));
}

function slotCard(app, team, slot, rerender) {
  const set = team[slot];
  if (!set) {
    if (slot > team.length) return h('div', { class: 'card empty' }, h('div', { class: 'hint' }, 'Vaga livre'));
    return h('div', { class: 'card empty' },
      h('button', { class: 'primary', onclick: () => pickSpecies(app, team, slot, rerender) }, '+ ADICIONAR POKÉMON'));
  }
  const sp = SPECIES[set.species];
  const stones = MEGA_STONE_FOR[set.species];
  const megaId = stones.includes(set.item) ? ITEMS[set.item].mega.to : null;
  const itemSel = h('select', { onchange: e => { set.item = e.target.value; rerender(); } },
    ...Object.entries(ITEMS).filter(([id, it]) => !it.mega || stones.includes(id)).map(([id, it]) => h('option', { value: id, selected: id === (set.item || 'none') }, it.name)));
  const head = h('div', { class: 'card-head' },
    h('img', { src: artwork(app, megaId || set.species) }),
    h('div', { style: { flex: 1 } },
      h('div', { class: 'name' }, sp.name),
      h('div', { class: 'types' }, ...(megaId ? SPECIES[megaId].types : sp.types).map(typeChip)),
      megaId ? h('div', { class: 'hint', style: { color: '#ff9ce8' } }, `Mega: ${displayName(megaId)} (${SPECIES[megaId].abilities[0]})`) : null),
    h('button', { class: 'small', onclick: () => pickSpecies(app, team, slot, rerender) }, 'TROCAR'));
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

// Lista dos Pokémon em grade (com 17 espécies não cabe mais uma fileira de ícones no cartão)
function pickSpecies(app, team, slot, rerender) {
  sfx(app);
  const current = team[slot]?.species;
  const close = () => { modal.remove(); rerender(); };
  const choose = sp => {
    sfx(app, 'select');
    if (sp !== current) { if (team[slot]) team[slot] = defaultSet(sp); else team.push(defaultSet(sp)); }
    close();
  };
  const modal = h('div', { class: 'modal' },
    h('div', { class: 'topbar' },
      h('button', { class: 'small ghost', onclick: () => { sfx(app, 'back'); close(); } }, '< VOLTAR'),
      h('h2', {}, current ? `TROCAR ${SPECIES[current].name.toUpperCase()}` : 'ESCOLHA UM POKÉMON')),
    h('div', { class: 'scroll' },
      h('div', { class: 'species-grid' }, ...BASE_SPECIES.map(sp => {
        const megas = MEGA_STONE_FOR[sp].map(id => displayName(ITEMS[id].mega.to)).join(' / ');
        return h('button', { class: `species-opt ${sp === current ? 'cur' : ''}`, onclick: () => choose(sp) },
          h('img', { src: portrait(app, sp), alt: '' }),
          h('div', {},
            h('div', { class: 'nm' }, SPECIES[sp].name),
            h('div', { class: 'types' }, ...SPECIES[sp].types.map(typeChip)),
            megas ? h('div', { class: 'mg' }, megas) : null));
      }))));
  mount(modal, true);
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

// ---------------------------------------------------------------- escolha de treinador
const TRAINER_IDS = Object.keys(TRAINER_DATA);

export function randomTrainer(except = null) {
  const pool = TRAINER_IDS.filter(id => id !== except);
  return pool[Math.floor(Math.random() * pool.length)];
}

function trainerPicker(app, idx, label, { allowRandom = false } = {}) {
  const grid = h('div', { class: `trainers side${idx}` });
  const draw = () => {
    grid.innerHTML = '';
    const pick = app.trainerPick[idx];
    if (allowRandom) {
      grid.append(h('button', { class: `trainer ${pick === 'random' ? 'on' : ''}`, onclick: () => { sfx(app); app.trainerPick[idx] = 'random'; draw(); } },
        h('div', { class: 'qmark' }, '?'), h('span', {}, 'Sorteio')));
    }
    for (const id of TRAINER_IDS) {
      grid.append(h('button', { class: `trainer ${pick === id ? 'on' : ''}`, onclick: () => { sfx(app); app.trainerPick[idx] = id; draw(); } },
        h('img', { src: TRAINER_DATA[id].img, alt: TRAINER_DATA[id].name }), h('span', {}, TRAINER_DATA[id].name)));
    }
  };
  draw();
  return h('div', { class: 'picker' }, h('div', { class: `picker-label p${idx + 1}` }, label), grid);
}

// ---------------------------------------------------------------- opções da partida
export function showSetup(app) {
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
      h('button', { class: 'small ghost', onclick: () => { sfx(app, 'back'); showTeamBuilder(app); } }, '< VOLTAR'),
      h('h2', {}, 'PREPARAR BATALHA'),
      h('button', { class: 'primary', onclick: () => { sfx(app, 'go'); app.startBattle(); } }, 'LUTAR!')),
    h('div', { class: 'scroll' },
      h('div', { class: 'setup' },
        trainerPicker(app, 0, 'SEU TREINADOR'),
        trainerPicker(app, 1, 'TREINADOR RIVAL', { allowRandom: true }),
        opt('Dificuldade', ['easy', 'normal', 'hard'], 'difficulty', ['FÁCIL', 'NORMAL', 'DIFÍCIL']),
        opt('Time do rival', ['random', 'mirror', 'presets'], 'rivalMode', ['ALEATÓRIO', 'IGUAL AO MEU', 'SUGERIDO']),
        opt('Tempo', [180, 240, 360, 5999], 'timeLimit', ['3 MIN', '4 MIN', '6 MIN', 'SEM LIMITE']),
        h('div', { class: 'hint' }, 'Toque e arraste no lado esquerdo para andar. Toque nos golpes para usar (arraste o botão para mirar). Teclado: WASD, J K L ; para os golpes, Espaço para esquivar, E para Mega.')))));
}

// ---------------------------------------------------------------- online
export function showOnline(app) {
  const status = h('div', { class: 'net-status' }, '');
  const codeBox = h('div', { class: 'room-code' });
  const codeInput = h('input', { type: 'text', placeholder: 'CÓDIGO', maxlength: 5, autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', class: 'code-input' });
  codeInput.addEventListener('input', () => { codeInput.value = cleanCode(codeInput.value); });
  const setStatus = (text, bad = false) => { status.textContent = text; status.className = `net-status ${bad ? 'bad' : ''}`; };
  let busy = false;
  const lock = on => { busy = on; createBtn.disabled = on; joinBtn.disabled = on; cancelBtn.style.display = on ? '' : 'none'; };
  const callbacks = {
    status: t => setStatus(t),
    message: t => { setStatus(t, true); codeBox.textContent = ''; lock(false); },
    left: t => app.onlineLeft(t),
  };
  const createBtn = h('button', { class: 'primary', onclick: async () => {
    if (busy) return;
    sfx(app, 'select');
    lock(true);
    setStatus('Criando a sala...');
    try {
      const code = await app.onlineCreate(callbacks);
      codeBox.textContent = code;
      setStatus('Sala criada! Passe o código para o outro jogador e espere ele entrar.');
    } catch (e) { callbacks.message(app.onlineError(e)); }
  } }, 'CRIAR SALA');
  const joinBtn = h('button', { class: 'blue', onclick: async () => {
    if (busy) return;
    const code = cleanCode(codeInput.value);
    if (code.length !== 5) { setStatus('O código tem 5 letras e números.', true); return; }
    sfx(app, 'select');
    lock(true);
    setStatus('Conectando...');
    try { await app.onlineJoin(code, callbacks); } catch (e) { callbacks.message(app.onlineError(e)); }
  } }, 'ENTRAR');
  const cancelBtn = h('button', { class: 'ghost small', style: { display: 'none' }, onclick: () => { sfx(app, 'back'); app.onlineClose(); codeBox.textContent = ''; setStatus('Cancelado.'); lock(false); } }, 'CANCELAR');
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
      h('button', { class: 'small ghost', onclick: () => { sfx(app, 'back'); app.onlineClose(); showTeamBuilder(app); } }, '< VOLTAR'),
      h('h2', {}, 'BATALHA ONLINE')),
    h('div', { class: 'scroll' },
      h('div', { class: 'setup' },
        trainerPicker(app, 0, 'SEU TREINADOR'),
        h('div', { class: 'online-row' },
          h('div', { class: 'online-card' },
            h('h3', {}, 'Criar uma sala'),
            h('p', { class: 'hint' }, 'Você recebe um código de 5 letras para passar ao amigo. O tempo da batalha é o que você escolher aqui.'),
            opt('Tempo', [180, 240, 360], 'timeLimit', ['3 MIN', '4 MIN', '6 MIN']),
            createBtn, codeBox),
          h('div', { class: 'online-card' },
            h('h3', {}, 'Entrar numa sala'),
            h('p', { class: 'hint' }, 'Digite o código que o seu amigo recebeu.'),
            codeInput, joinBtn)),
        h('div', { class: 'online-foot' }, status, cancelBtn),
        h('div', { class: 'hint' }, 'Os dois aparelhos precisam de internet e da mesma versão do jogo. Cada um usa o próprio time (o que está em "Seu time"). Quem criou a sala joga do lado vermelho.')))));
}

// ---------------------------------------------------------------- pausa e opções
export function showPause(app) {
  mount(h('div', { class: 'overlay' },
    h('div', { class: 'box' },
      h('h2', {}, 'PAUSA'),
      h('button', { class: 'primary', onclick: () => { sfx(app); app.resume(); } }, 'CONTINUAR'),
      h('button', { onclick: () => { sfx(app); showHelp(app, () => showPause(app)); } }, 'COMO JOGAR'),
      h('button', { onclick: () => { sfx(app); showSettings(app, () => showPause(app)); } }, 'OPÇÕES'),
      h('button', { class: 'ghost', onclick: () => { sfx(app, 'back'); app.quit(); } }, app.mode === 'online' ? 'DESISTIR E SAIR' : 'SAIR DA BATALHA'),
      app.mode === 'online' ? h('div', { class: 'hint', style: { textAlign: 'center' } }, 'No online a batalha não para enquanto este menu está aberto.') : null)));
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
  mount(h('div', { class: 'overlay' },
    h('div', { class: 'box' },
      h('h2', {}, c.reason === 'faint' ? `${side.name}: escolha o próximo Pokémon` : `${side.name}: trocar para qual Pokémon?`),
      h('div', { class: 'choice-row' }, ...c.options.map(slot => {
        const m = side.mons[slot];
        return h('button', { onclick: () => { sfx(app, 'select'); clearUi(); app.controls.edges[c.side].switchTo = slot; } },
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
        app.mode === 'online'
          ? h('button', { class: 'primary', onclick: e => { sfx(app, 'select'); e.target.disabled = true; e.target.textContent = 'ESPERANDO O OUTRO...'; app.onlineRematch(); } }, app.rematchAsked ? 'ACEITAR REVANCHE' : 'REVANCHE')
          : h('button', { class: 'primary', onclick: () => { sfx(app, 'select'); app.startBattle(); } }, 'REVANCHE'),
        app.mode === 'online' ? null : h('button', { onclick: () => { sfx(app); app.stopBattle(); showTeamBuilder(app); } }, 'TROCAR TIME'),
        h('button', { class: 'ghost', onclick: () => { sfx(app, 'back'); app.onlineClose(); app.stopBattle(); showTitle(app); } }, 'MENU')))));
}

// aviso simples (ex.: o outro jogador saiu)
export function showNotice(app, title, text, then) {
  mount(h('div', { class: 'overlay' },
    h('div', { class: 'box' },
      h('h2', {}, title),
      h('div', { class: 'text', style: { textAlign: 'center' } }, text),
      h('button', { class: 'primary', onclick: () => { sfx(app); then(); } }, 'OK'))));
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
<p>Arraste no lado esquerdo da tela para andar. Os quatro botões coloridos são os golpes: toque para soltar mirando no adversário, ou arraste o botão para mirar onde quiser. O botão branco é a esquiva: um dash rápido na direção em que você está andando, e durante ele o Pokémon fica intocável.</p>
<p>No teclado: <kbd>WASD</kbd> anda, <kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd> <kbd>;</kbd> (ou <kbd>1</kbd>-<kbd>4</kbd>) usam os golpes, <kbd>Espaço</kbd> esquiva, <kbd>E</kbd> Mega Evolução, <kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd> trocam de Pokémon, <kbd>Esc</kbd> pausa. Controles de videogame também funcionam.</p>
<h3>Stamina e recarga</h3>
<p>Cada golpe gasta stamina (a barra amarela) e tem uma recarga própria. Golpes com pouco PP nos jogos gastam mais stamina, golpes fortes demoram mais para recarregar. Esquivar também gasta stamina: cada risquinho da barra é uma esquiva.</p>
<h3>Atributos temporários</h3>
<p>Swords Dance, Dragon Dance, Calm Mind e companhia aumentam os atributos só por um tempo. A etiqueta no painel (Atq+2, por exemplo) tem uma barrinha que mostra quanto falta; quando ela acaba, o atributo volta um nível a cada poucos segundos. Quedas de atributo também passam com o tempo.</p>
<h3>Igual aos jogos</h3>
<p>O dano usa a mesma fórmula dos jogos (nível 50), com STAB, tipos, críticos, clima, habilidades e itens. Status, mudanças de atributo, Protect, Substitute, Leech Seed, golpes de dois turnos, Fly, Dig e Dive funcionam como nos jogos, só que em tempo real: um "turno" vale alguns segundos.</p>
<h3>Clima</h3>
<p>No sol, Solar Beam sai sem carga, Fogo fica mais forte e Água mais fraca. Na chuva é o contrário, e Hurricane nunca erra. Chlorophyll, Solar Power, Rain Dish e Drought mudam conforme o clima.</p>
<h3>Mega Evolução</h3>
<p>Venusaur, Charizard, Blastoise, Steelix e Gengar segurando a Mega Pedra podem Mega Evoluir uma vez por batalha. O anel em volta do seu treinador é a barra de Mega: enche quando você causa dano, leva dano e esquiva no último instante. Cheio, aperte o botão MEGA.</p>
<h3>Choque de Megas</h3>
<p>Se um treinador Mega Evoluir e o outro responder com a própria Mega durante a animação, as Megas se chocam e criam um clima especial na arena: Sol Extremo, Chuva Torrencial, Tempestade Mega com raios caindo e outros, dependendo dos Pokémon.</p>
<h3>Choque de raios</h3>
<p>Quando dois golpes de raio (Solar Beam, Hydro Pump, Flamethrower, Ice Beam, Hyper Beam...) se encontram, começa o choque: toque o mais rápido que puder. Quem empurrar o raio até o outro lado acerta com mais força. Tipo e poder do golpe ajudam a empurrar.</p>
<h3>Arena</h3>
<p>O Estádio da Liga é grande e a câmera acompanha a luta. Golpes de área como Surf, Earthquake e Heat Wave pegam boa parte do campo. Projéteis se chocam no ar, Fogo e Água juntos viram vapor, Fogo acende a grama e a água apaga.</p>
<h3>Online</h3>
<p>Um jogador cria a sala e recebe um código; o outro digita o código. A conexão é direta entre os dois celulares, então os dois precisam de internet. Se a rede engasgar, a batalha espera o outro lado em vez de pular.</p>` }),
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
<p>Treinadores: Smogon Sprite Project (smogon/sprites) e os artistas creditados lá.</p>
<p>Mega Venusaur, Mega Charizard Y e Mega Blastoise (inclusive a da tela inicial): animações dos modelos 3D do Smogon Sprite Project, convertidas para pixel art. Mega Golisopod: imagem do Pokémon Champions no mesmo repositório, animada por partes.</p>
<h3>Online</h3>
<p>PeerJS (licença MIT) para a conexão direta entre os aparelhos.</p>
<p>${credits.map(c => `${c.what}: ${c.by.join(', ')}`).join('<br>')}</p>
<h3>Fontes</h3>
<p>Press Start 2P (CodeMan38) e Pixelify Sans (Stefie Justprince), licença SIL OFL 1.1.</p>
<h3>Música e efeitos</h3>
<p>Sintetizados no próprio jogo.</p>` }),
      h('button', { class: 'primary', onclick: () => { sfx(app); showTitle(app); } }, 'OK'))));
}
