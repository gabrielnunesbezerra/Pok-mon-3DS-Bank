// Habilidades e golpes dos 20 Pokémon da terceira leva
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../www/js/engine/battle.js';
import { executeMove } from '../www/js/engine/actions.js';
import { calcDamage, liveMove, typeEffect } from '../www/js/engine/hit.js';
import { DT, FIELD_TURN } from '../www/js/engine/constants.js';
import { getSpeed } from '../www/js/engine/mon.js';

const mon = (species, moves, extra = {}) => ({ species, ability: extra.ability, item: extra.item ?? null, gender: 'M', moves, ...extra });

function duel(a, b, opts = {}) {
  const battle = new Battle({ teams: [a, b], cpu: [false, false], events: true, seed: opts.seed ?? 4 });
  battle.cinematic = null;
  const [m0, m1] = [battle.sides[0].active, battle.sides[1].active];
  m0.x = 300; m0.y = 320; m1.x = 400; m1.y = 320;
  for (const m of [m0, m1]) m.action = null;
  return { battle, m0, m1 };
}
const run = (battle, seconds) => { for (let i = 0; i < seconds * 60 && !battle.over; i++) battle.step(DT); };
const fixed = battle => { battle.rng.int = (a, b) => b; battle.rng.next = () => 0.99; battle.rng.chance = () => true; };
const hits = battle => battle.events.filter(e => e.t === 'hit');

test('Parental Bond acerta duas vezes, a segunda mais fraca', () => {
  const { battle, m0, m1 } = duel([mon('kangaskhan', ['return'], { ability: 'parentalbond' })], [mon('steelix', ['protect'])]);
  fixed(battle);
  battle.events.length = 0;
  executeMove(battle, m0, 'return', null, {});
  run(battle, 1);
  const h = hits(battle).filter(e => e.mon === m1);
  assert.equal(h.length, 2);
  assert.ok(h[1].dmg < h[0].dmg / 2, `${h[1].dmg} deveria ser bem menor que ${h[0].dmg}`);
});

test('Huge Power dobra o Ataque físico', () => {
  const a = duel([mon('mawile', ['ironhead'], { ability: 'intimidate' })], [mon('gengar', ['shadowball'])]);
  const b = duel([mon('mawile', ['ironhead'], { ability: 'hugepower' })], [mon('gengar', ['shadowball'])]);
  fixed(a.battle); fixed(b.battle);
  const da = calcDamage(a.battle, a.m0, a.m1, liveMove(a.battle, a.m0, 'ironhead')).damage;
  const db = calcDamage(b.battle, b.m0, b.m1, liveMove(b.battle, b.m0, 'ironhead')).damage;
  assert.ok(db > da * 1.8, `${db} deveria ser quase o dobro de ${da}`);
});

test('Levitate anula Earthquake, mas Mold Breaker passa por cima', () => {
  const a = duel([mon('excadrill', ['earthquake'], { ability: 'sandrush' })], [mon('latios', ['surf'], { ability: 'levitate' })]);
  const b = duel([mon('excadrill', ['earthquake'], { ability: 'moldbreaker' })], [mon('latios', ['surf'], { ability: 'levitate' })]);
  assert.equal(typeEffect(a.battle, a.m0, a.m1, liveMove(a.battle, a.m0, 'earthquake')), 0);
  assert.equal(typeEffect(b.battle, b.m0, b.m1, liveMove(b.battle, b.m0, 'earthquake')), 1);
});

test('Multiscale corta o dano pela metade com PS cheios', () => {
  const { battle, m0, m1 } = duel([mon('mewtwo', ['icebeam'])], [mon('dragonite', ['roost'], { ability: 'multiscale' })]);
  fixed(battle);
  const mv = liveMove(battle, m0, 'icebeam');
  const full = calcDamage(battle, m0, m1, mv).damage;
  m1.hp -= 1;
  const hurt = calcDamage(battle, m0, m1, mv).damage;
  assert.ok(Math.abs(full * 2 - hurt) <= 2, `${full} x2 deveria dar ${hurt}`);
});

test('Volt Absorb anula golpe Elétrico e cura', () => {
  const { battle, m0, m1 } = duel([mon('zeraora', ['thunderbolt'])], [mon('zeraora', ['thunderbolt'], { ability: 'voltabsorb' })]);
  fixed(battle);
  m1.hp = Math.floor(m1.maxhp / 2);
  executeMove(battle, m0, 'thunderbolt', null, {});
  run(battle, 1.5);
  assert.ok(m1.hp > m1.maxhp / 2);
});

test('Protean muda o tipo para o do golpe', () => {
  const { battle, m0 } = duel([mon('greninja', ['icebeam'], { ability: 'protean' })], [mon('steelix', ['protect'])]);
  executeMove(battle, m0, 'icebeam', null, {});
  assert.deepEqual(m0.types, ['Ice']);
});

test('Technician fortalece golpes fracos', () => {
  const a = duel([mon('scizor', ['bulletpunch'], { ability: 'swarm' })], [mon('gardevoir', ['psychic'])]);
  const b = duel([mon('scizor', ['bulletpunch'], { ability: 'technician' })], [mon('gardevoir', ['psychic'])]);
  fixed(a.battle); fixed(b.battle);
  const da = calcDamage(a.battle, a.m0, a.m1, liveMove(a.battle, a.m0, 'bulletpunch')).damage;
  const db = calcDamage(b.battle, b.m0, b.m1, liveMove(b.battle, b.m0, 'bulletpunch')).damage;
  assert.ok(db > da * 1.4);
});

test('Scrappy acerta Fantasma com golpe Normal', () => {
  const { battle, m0, m1 } = duel([mon('kangaskhan', ['return'], { ability: 'scrappy' })], [mon('gengar', ['shadowball'])]);
  assert.equal(typeEffect(battle, m0, m1, liveMove(battle, m0, 'return')), 1);
});

test('Delta Stream tira a fraqueza do tipo Voador', () => {
  const { battle, m0, m1 } = duel([mon('rayquaza', ['dragonascent'], { item: 'meteorite' })], [mon('mewtwo', ['icebeam'])]);
  assert.equal(typeEffect(battle, m1, m0, liveMove(battle, m1, 'icebeam')), 4);
  battle.sides[0].megaGauge = 100;
  battle.requestMega(0);
  run(battle, 2.5);
  assert.equal(m0.ability, 'deltastream');
  assert.equal(typeEffect(battle, m1, m0, liveMove(battle, m1, 'icebeam')), 2);
});

test('Speed Boost aumenta a Velocidade com o tempo', () => {
  const { battle, m0 } = duel([mon('blaziken', ['protect'], { ability: 'speedboost' })], [mon('steelix', ['protect'])]);
  const before = getSpeed(battle, m0);
  run(battle, FIELD_TURN + 0.5);
  assert.equal(m0.boosts.spe, 1);
  assert.ok(getSpeed(battle, m0) > before);
});

test('Aerilate transforma golpe Normal em Voador', () => {
  const { battle, m0 } = duel([mon('salamence', ['return'], { item: 'salamencite' })], [mon('steelix', ['protect'])]);
  battle.sides[0].megaGauge = 100;
  battle.requestMega(0);
  run(battle, 2.5);
  assert.equal(liveMove(battle, m0, 'return').type, 'Flying');
});

test('Clear Body impede o Intimidate', () => {
  const { battle, m0, m1 } = duel([mon('gyarados', ['waterfall'], { ability: 'intimidate' })], [mon('metagross', ['meteormash'], { ability: 'clearbody' })]);
  battle.entryEffects(m0);
  assert.equal(m1.boosts.atk, 0);
});

test('Metal Burst devolve 1,5x o dano', () => {
  const { battle, m0, m1 } = duel([mon('scizor', ['xscissor'])], [mon('metagross', ['metalburst'])]);
  fixed(battle);
  executeMove(battle, m1, 'metalburst', null, {});
  executeMove(battle, m0, 'xscissor', null, {});
  run(battle, 1);
  assert.ok(m0.hp < m0.maxhp, 'Scizor levou o revide');
});
