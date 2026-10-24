// Regras da Liga Pokémon: desbloqueio por vitórias, colunas em ordem, ícone e shiny
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
const L = await import('../www/js/liga/liga.js');
const { ROSTER } = await import('../www/js/data/pokemon.js');

test('liga: só os iniciais começam liberados e cada Pokémon do roster está em um circuito', () => {
  L.reiniciar();
  assert.deepEqual(L.desbloqueados().sort(), ['bulbasaur', 'charmander', 'squirtle']);
  const naLiga = L.LIGA.circuitos.flatMap(c => c.rivales);
  for (const p of ROSTER) assert.ok(L.LIGA.iniciales.includes(p.id) || naLiga.includes(p.id), `${p.id} fora da liga`);
  for (const c of L.LIGA.circuitos) assert.ok(c.rivales.length >= 3 && c.rivales.length <= 5, `${c.id} com ${c.rivales.length}`);
});

test('liga: 1 vitória libera, 2 dão o ícone, 3 o shiny; dificuldade sobe; coluna seguinte só abre com todos vencidos', () => {
  L.reiniciar();
  const [c1, c2] = L.LIGA.circuitos;
  assert.equal(L.estadoRival(c2.rivales[0]), 'cerrado');
  const z = c1.rivales[0];
  assert.equal(L.nivelProximo(z), 'facil');
  assert.deepEqual(L.vencer(z), ['pokemon']);
  assert.ok(L.desbloqueado(z) && !L.iconoLiberado(z));
  assert.equal(L.nivelProximo(z), 'normal');
  assert.deepEqual(L.vencer(z), ['icono']);
  assert.equal(L.nivelProximo(z), 'dificil');
  assert.deepEqual(L.vencer(z), ['shiny']);
  assert.ok(L.shinyLiberado(z));
  for (const id of c1.rivales) L.vencer(id);
  assert.equal(L.estadoRival(c2.rivales[0]), 'abierto');
  for (const c of L.LIGA.circuitos) for (const id of c.rivales) L.vencer(id);
  assert.ok(L.ligaCompleta() && L.shinyLiberado('charmander'));
});

test('liga: progresso da conta se junta com o do aparelho (fica o maior)', () => {
  L.reiniciar();
  L.vencer('zubat');
  L.fundir({ vencidos: { zubat: 3, seedot: 1, naoexiste: 3 } });
  assert.equal(L.vitorias('zubat'), 3);
  assert.equal(L.vitorias('seedot'), 1);
  assert.equal(L.vitorias('naoexiste'), 0);
});
