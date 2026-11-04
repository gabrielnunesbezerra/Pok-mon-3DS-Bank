// Progresso da conta: tudo liberado, shiny a 1% na entrada da partida e o que sai fica liberado
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
const C = await import('../www/js/data/conta.js');
const { ROSTER } = await import('../www/js/data/pokemon.js');

test('conta: todos os Pokémon e ícones liberados, nenhum shiny no começo', () => {
  C.reiniciar();
  for (const p of ROSTER) { assert.ok(C.desbloqueado(p.id)); assert.ok(C.iconoLiberado(p.id)); assert.ok(!C.shinyLiberado(p.id)); }
});

test('conta: shiny sai com 1% e fica liberado; depois dá para escolher usar', () => {
  C.reiniciar();
  assert.deepEqual(C.sortearShiny('charmander', false, () => 0.5), { shiny: false, novo: false });
  assert.deepEqual(C.sortearShiny('charmander', true, () => 0.5), { shiny: false, novo: false });
  assert.deepEqual(C.sortearShiny('charmander', false, () => 0.005), { shiny: true, novo: true });
  assert.ok(C.shinyLiberado('charmander'));
  assert.deepEqual(C.sortearShiny('charmander', true, () => 0.9), { shiny: true, novo: false });
  assert.deepEqual(C.sortearShiny('charmander', false, () => 0.9), { shiny: false, novo: false });
  assert.ok(C.fundir({ shinies: { squirtle: true, naoExiste: true } }));
  assert.deepEqual(C.shiniesLiberados().sort(), ['charmander', 'squirtle']);
});
