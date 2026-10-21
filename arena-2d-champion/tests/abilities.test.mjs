// Habilidades e golpes dos Pokémon novos
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../www/js/engine/battle.js';
import { executeMove } from '../www/js/engine/actions.js';
import { calcDamage, liveMove, damageMon } from '../www/js/engine/hit.js';
import { DT, FIELD_TURN } from '../www/js/engine/constants.js';

const mon = (species, moves, extra = {}) => ({ species, ability: extra.ability, item: extra.item ?? null, gender: 'M', moves, ...extra });

function duel(a, b, opts = {}) {
  const battle = new Battle({ teams: [a, b], cpu: [false, false], events: true, seed: opts.seed ?? 4 });
  battle.cinematic = null;
  const [m0, m1] = [battle.sides[0].active, battle.sides[1].active];
  m0.x = 300; m0.y = 320; m1.x = 520; m1.y = 320;
  for (const m of [m0, m1]) m.action = null;
  return { battle, m0, m1 };
}
const run = (battle, seconds) => { for (let i = 0; i < seconds * 60 && !battle.over; i++) battle.step(DT); };
const fixed = battle => { battle.rng.int = (a, b) => b; battle.rng.next = () => 0.99; battle.rng.chance = () => true; };

test('Pixilate transforma Hyper Voice em golpe de Fada mais forte', () => {
  const { battle, m0, m1 } = duel([mon('gardevoir', ['hypervoice'], { item: 'gardevoirite' })], [mon('tyranitar', ['crunch'])]);
  fixed(battle);
  const before = liveMove(battle, m0, 'hypervoice');
  assert.equal(before.type, 'Normal');
  battle.sides[0].megaGauge = 100;
  battle.requestMega(0);
  run(battle, 2.5);
  assert.equal(m0.ability, 'pixilate');
  const mv = liveMove(battle, m0, 'hypervoice');
  assert.equal(mv.type, 'Fairy');
  assert.ok(calcDamage(battle, m0, m1, mv).eff > 1, 'Fada é super eficaz contra Sombrio');
});

test('Adaptability dobra o bônus de mesmo tipo', () => {
  const a = duel([mon('lucario', ['aurasphere'], { ability: 'innerfocus' })], [mon('gengar', ['shadowball'])]);
  const b = duel([mon('lucario', ['aurasphere'], { ability: 'adaptability' })], [mon('gengar', ['shadowball'])]);
  fixed(a.battle); fixed(b.battle);
  const mvA = liveMove(a.battle, a.m0, 'aurasphere');
  const da = calcDamage(a.battle, a.m0, a.m1, { ...mvA, type: 'Steel' }).damage;
  const db = calcDamage(b.battle, b.m0, b.m1, { ...mvA, type: 'Steel' }).damage;
  assert.ok(db > da * 1.25, `${db} deveria ser bem maior que ${da}`);
});

test('Lightning Rod anula golpe Elétrico e aumenta o Ataque Especial', () => {
  const { battle, m0, m1 } = duel([mon('manectric', ['thunderbolt'])], [mon('manectric', ['thunderbolt'], { ability: 'lightningrod' })]);
  fixed(battle);
  m0.facing = 0;
  executeMove(battle, m0, 'thunderbolt', null, {});
  run(battle, 1.5);
  assert.equal(m1.hp, m1.maxhp);
  assert.equal(m1.boosts.spa, 1);
});

test('Flash Fire absorve Fogo e fortalece os próprios golpes de Fogo', () => {
  const { battle, m0, m1 } = duel([mon('charizard', ['flamethrower'])], [mon('houndoom', ['flamethrower'], { ability: 'flashfire' })]);
  fixed(battle);
  executeMove(battle, m0, 'flamethrower', null, {});
  run(battle, 1.5);
  assert.equal(m1.hp, m1.maxhp);
  assert.ok(m1.vol.flashfire);
});

test('Magic Bounce devolve o Taunt', () => {
  const { battle, m0, m1 } = duel([mon('weavile', ['taunt'])], [mon('absol', ['swordsdance'], { ability: 'magicbounce' })]);
  executeMove(battle, m0, 'taunt', null, {});
  run(battle, 1);
  assert.ok(!m1.vol.taunt);
  assert.ok(m0.vol.taunt);
});

test('Intimidate diminui o Ataque de quem está em campo; Inner Focus resiste', () => {
  const a = new Battle({ teams: [[mon('tyranitar', ['crunch'])], [mon('manectric', ['thunderbolt'], { item: 'manectite' })]], cpu: [false, false], seed: 2 });
  a.cinematic = null;
  a.sides.forEach(s => { s.active.action = null; });
  a.sides[1].megaGauge = 100;
  a.requestMega(1);
  run(a, 2.5);
  assert.equal(a.sides[0].active.boosts.atk, -1);
  const b = new Battle({ teams: [[mon('lucario', ['aurasphere'], { ability: 'innerfocus' })], [mon('manectric', ['thunderbolt'], { item: 'manectite' })]], cpu: [false, false], seed: 2 });
  b.cinematic = null;
  b.sides.forEach(s => { s.active.action = null; });
  b.sides[1].megaGauge = 100;
  b.requestMega(1);
  run(b, 2.5);
  assert.equal(b.sides[0].active.boosts.atk, 0);
});

test('Sand Stream chama a tempestade de areia ao entrar', () => {
  const battle = new Battle({ teams: [[mon('tyranitar', ['crunch'], { ability: 'sandstream' })], [mon('venusaur', ['gigadrain'])]], cpu: [false, false], seed: 1 });
  assert.equal(battle.field.weather?.id, 'sandstorm');
});

test('Magic Guard não perde PS com areia nem Life Orb', () => {
  const { battle, m0, m1 } = duel([mon('alakazam', ['psychic'], { ability: 'magicguard', item: 'lifeorb' })], [mon('tyranitar', ['crunch'], { ability: 'sandstream' })]);
  battle.setWeather('sandstorm', 5);
  m1.x = 900;
  run(battle, 4);
  assert.equal(m0.hp, m0.maxhp);
});

test('Psyshock é especial mas bate na Defesa', () => {
  const { battle, m0, m1 } = duel([mon('alakazam', ['psyshock'])], [mon('blastoise', ['waterpulse'])]);
  fixed(battle);
  const before = calcDamage(battle, m0, m1, liveMove(battle, m0, 'psyshock')).damage;
  m1.boosts.spd = 6;
  assert.equal(calcDamage(battle, m0, m1, liveMove(battle, m0, 'psyshock')).damage, before, 'Defesa Especial não muda nada');
  m1.boosts.def = 6;
  assert.ok(calcDamage(battle, m0, m1, liveMove(battle, m0, 'psyshock')).damage < before);
});

test('Emergency Exit foge com menos da metade dos PS', () => {
  const battle = new Battle({ teams: [[mon('golisopod', ['razorshell'], { ability: 'emergencyexit' }), mon('lucario', ['aurasphere'])], [mon('houndoom', ['crunch'])]], cpu: [true, false], seed: 3 });
  battle.cinematic = null;
  const g = battle.sides[0].active;
  damageMon(battle, g, g.maxhp * 0.6, { source: battle.sides[1].active });
  run(battle, 1);
  assert.equal(battle.sides[0].active.species, 'lucario');
});

test('Spikes machucam quem entra e Wish cura depois de um turno', () => {
  const battle = new Battle({ teams: [[mon('golisopod', ['spikes'])], [mon('houndoom', ['crunch']), mon('absol', ['crunch'])]], cpu: [false, false], seed: 5 });
  battle.cinematic = null;
  const g = battle.sides[0].active;
  executeMove(battle, g, 'spikes', null, {});
  assert.equal(battle.sides[1].hazards.spikes, 1);
  battle.switchIn(1, 1);
  const absol = battle.sides[1].active;
  assert.ok(absol.hp < absol.maxhp);
  const w = new Battle({ teams: [[mon('gardevoir', ['wish'])], [mon('houndoom', ['crunch'])]], cpu: [false, false], seed: 5 });
  w.cinematic = null;
  const gv = w.sides[0].active;
  gv.hp = Math.floor(gv.maxhp / 3);
  w.sides[1].active.x = 1500;
  executeMove(w, gv, 'wish', null, {});
  run(w, FIELD_TURN + 0.5);
  assert.ok(gv.hp > gv.maxhp * 0.75);
});

test('Future Sight acerta depois de dois turnos', () => {
  const { battle, m0, m1 } = duel([mon('alakazam', ['futuresight'])], [mon('blastoise', ['waterpulse'])]);
  m1.x = 1500;
  executeMove(battle, m0, 'futuresight', null, {});
  run(battle, FIELD_TURN * 1.5);
  assert.equal(m1.hp, m1.maxhp);
  run(battle, FIELD_TURN);
  assert.ok(m1.hp < m1.maxhp);
});

test('Trace copia a habilidade do adversário', () => {
  const battle = new Battle({ teams: [[mon('tyranitar', ['crunch'], { ability: 'sandstream' })], [mon('gardevoir', ['psychic'], { ability: 'trace' })]], cpu: [false, false], seed: 1 });
  assert.equal(battle.sides[1].active.ability, 'sandstream');
});

test('Choque de Megas novas cria clima', () => {
  const { battle } = duel([mon('manectric', ['thunderbolt'], { item: 'manectite' })], [mon('gardevoir', ['psychic'], { item: 'gardevoirite' })]);
  battle.sides[0].megaGauge = 100; battle.sides[1].megaGauge = 100;
  battle.requestMega(0);
  battle.step(DT);
  battle.sides[1].input.mega = true;
  battle.step(DT);
  assert.equal(battle.cinematic.type, 'megaclash');
  run(battle, 4);
  assert.ok(battle.field.terrain, 'nasceu um terreno');
});
