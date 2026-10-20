// Usa cada golpe que os quatro Pokémon aprendem numa batalha simulada e confere que nada quebra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../www/js/engine/battle.js';
import { MOVES, LEARNSETS, BASE_SPECIES, PRESETS } from '../www/js/data/dex.js';
import { useMove } from '../www/js/engine/actions.js';

function learners(id) {
  return BASE_SPECIES.filter(sp => LEARNSETS[sp][id]);
}

function runWith(species, moveId, foeSpecies, seed) {
  const others = PRESETS[species][0].moves.filter(m => m !== moveId).slice(0, 3);
  const item = ['naturalgift', 'fling'].includes(moveId) ? 'sitrusberry' : 'leftovers';
  const team0 = [
    { species, ability: PRESETS[species][0].ability, item, moves: [moveId, ...others] },
    { species: 'weavile', ...PRESETS.weavile[0] },
  ];
  const team1 = [{ species: foeSpecies, ...PRESETS[foeSpecies][1] }, { species: 'blastoise', ...PRESETS.blastoise[0] }];
  const b = new Battle({ teams: [team0, team1], cpu: [true, true], seed, events: true, timeLimit: 999 });
  b.cinematic = null;
  let executed = 0;
  for (let i = 0; i < 60 * 25 && !b.over; i++) {
    const me = b.sides[0].active;
    if (me && me.onField && me.species.startsWith(species)) {
      if ((moveId === 'sleeptalk' || moveId === 'snore') && !me.status) { me.status = 'slp'; me.statusData = { sleepLeft: 99, toxicTurns: 0 }; }
      b.sides[0].cpu.think = 1; // o teste escolhe o golpe
      b.sides[0].input.move = { slot: 0 };
    }
    if (b.choice) b.choose(b.choice.options[0]);
    b.step();
    // golpes de dupla (Helping Hand, Follow Me...) falham sozinhos, como nos jogos: basta terem sido usados
    for (const e of b.events) if ((e.t === 'execute' || e.t === 'moveStart') && e.mon.species.startsWith(species)) executed++;
    b.events.length = 0;
    for (const s of b.sides) for (const m of s.mons) {
      assert.ok(m.hp >= 0 && m.hp <= m.maxhp, `${moveId}: PS fora do limite (${m.name} ${m.hp}/${m.maxhp})`);
      if (m.onField) assert.ok(Number.isFinite(m.x) && Number.isFinite(m.y), `${moveId}: posição inválida`);
    }
  }
  return executed;
}

const ids = Object.keys(MOVES).filter(id => learners(id).length);

test(`todos os ${ids.length} golpes aprendíveis rodam sem erro`, () => {
  const never = [];
  for (const id of ids) {
    const sp = learners(id)[0];
    for (const foe of ['venusaur', 'charizard']) {
      let n = 0;
      for (let seed = 1; seed <= 2 && n === 0; seed++) n += runWith(sp, id, foe, seed * 7 + id.length);
      if (n === 0) never.push(`${id} (${sp} vs ${foe})`);
    }
  }
  assert.deepEqual(never, [], `golpes que nunca saíram: ${never.join(', ')}`);
});

test('os times sugeridos só têm golpes que o Pokémon aprende', () => {
  for (const sp of BASE_SPECIES) for (const preset of PRESETS[sp]) for (const m of preset.moves) {
    assert.ok(LEARNSETS[sp][m], `${sp} não aprende ${m}`);
  }
});
