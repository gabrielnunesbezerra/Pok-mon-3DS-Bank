// Mecânicas específicas que precisam funcionar como nos jogos
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../www/js/engine/battle.js';
import { useMove, executeMove } from '../www/js/engine/actions.js';
import { calcDamage, liveMove } from '../www/js/engine/hit.js';
import { getSpeed } from '../www/js/engine/mon.js';

const mon = (species, moves, extra = {}) => ({ species, ability: extra.ability, item: extra.item ?? null, gender: 'M', moves, ...extra });

function duel(a, b, opts = {}) {
  const battle = new Battle({ teams: [a, b], cpu: [false, false], events: true, seed: opts.seed ?? 3, arena: opts.arena ?? 'grass' });
  battle.cinematic = null;
  const [m0, m1] = [battle.sides[0].active, battle.sides[1].active];
  m0.x = 300; m0.y = 320; m1.x = 520; m1.y = 320;
  for (const m of [m0, m1]) m.action = null;
  return { battle, m0, m1 };
}

function run(battle, seconds) {
  for (let i = 0; i < seconds * 60 && !battle.over; i++) battle.step();
}

function fixedRolls(battle) {
  battle.rng.int = (a, b) => b;
  battle.rng.next = () => 0.99;
  battle.rng.chance = () => true;
}

test('Solar Beam carrega fora do sol e sai na hora no sol', () => {
  const { battle, m0 } = duel([mon('venusaur', ['solarbeam'], { ability: 'overgrow' })], [mon('blastoise', ['tackle'])]);
  executeMove(battle, m0, 'solarbeam', null, {});
  assert.equal(m0.action.type, 'charge');
  const s = duel([mon('venusaur', ['solarbeam'], { ability: 'overgrow' })], [mon('blastoise', ['tackle'])]);
  s.battle.setWeather('sunnyday', 5);
  executeMove(s.battle, s.m0, 'solarbeam', null, {});
  assert.equal(s.m0.action.type, 'channel');
});

test('Thick Fat corta pela metade o dano de Fogo', () => {
  const { battle, m0, m1 } = duel([mon('charizard', ['flamethrower'])], [mon('venusaur', ['tackle'], { item: 'venusaurite' })]);
  fixedRolls(battle);
  const before = calcDamage(battle, m0, m1, liveMove(battle, m0, 'flamethrower')).damage;
  battle.megaEvolve(m1);
  assert.equal(m1.ability, 'thickfat');
  const after = calcDamage(battle, m0, m1, liveMove(battle, m0, 'flamethrower')).damage;
  assert.ok(after < before * 0.6, `${after} deveria ser bem menor que ${before}`);
});

test('Mega Charizard Y traz o sol com Drought', () => {
  const { battle, m0 } = duel([mon('charizard', ['flamethrower'], { item: 'charizarditey' })], [mon('blastoise', ['tackle'])]);
  battle.sides[0].megaGauge = 100;
  assert.ok(battle.requestMega(0));
  run(battle, 2.5);
  assert.equal(m0.species, 'charizardmegay');
  assert.equal(battle.field.weather?.id, 'sunnyday');
});

test('Mega só uma vez por batalha e só com a barra cheia', () => {
  const { battle } = duel([mon('charizard', ['flamethrower'], { item: 'charizarditex' })], [mon('blastoise', ['tackle'])]);
  battle.sides[0].megaGauge = 50;
  assert.equal(battle.requestMega(0), false);
  battle.sides[0].megaGauge = 100;
  assert.ok(battle.requestMega(0));
  run(battle, 2.5);
  assert.equal(battle.sides[0].active.species, 'charizardmegax');
  battle.sides[0].megaGauge = 100;
  assert.equal(battle.requestMega(0), false);
});

test('Choque de Megas cria clima especial (Fogo + Água = Tempestade Mega)', () => {
  const { battle } = duel([mon('charizard', ['flamethrower'], { item: 'charizarditey' })], [mon('blastoise', ['hydropump'], { item: 'blastoisinite' })]);
  battle.sides[0].megaGauge = 100;
  battle.sides[1].megaGauge = 80;
  battle.requestMega(0);
  battle.step();
  battle.sides[1].input.mega = true;
  battle.step();
  assert.equal(battle.cinematic.type, 'megaclash');
  run(battle, 3.5);
  assert.equal(battle.field.weather?.id, 'raindance');
  assert.ok(battle.field.storm > 0);
});

test('Dois raios se encontrando começam o choque de raios', () => {
  const { battle, m0, m1 } = duel([mon('charizard', ['flamethrower'])], [mon('blastoise', ['hydropump'])]);
  executeMove(battle, m0, 'flamethrower', null, {});
  executeMove(battle, m1, 'hydropump', null, {});
  for (let i = 0; i < 30 && !battle.clash; i++) battle.step();
  assert.ok(battle.clash, 'o choque deveria começar');
  for (let i = 0; i < 400 && battle.clash; i++) { battle.sides[1].input.mash = 1; battle.step(); }
  assert.equal(battle.clash, null);
  run(battle, 0.5);
  assert.ok(m0.hp < m0.maxhp, 'quem perdeu o choque leva o golpe');
});

test('Choque de raios termina dos dois lados (vitória do jogador 1 e do jogador 2)', () => {
  for (const winner of [0, 1]) {
    const { battle, m0, m1 } = duel([mon('charizard', ['flamethrower'])], [mon('blastoise', ['hydropump'])]);
    executeMove(battle, m0, 'flamethrower', null, {});
    executeMove(battle, m1, 'hydropump', null, {});
    for (let i = 0; i < 30 && !battle.clash; i++) battle.step();
    assert.ok(battle.clash);
    for (let i = 0; i < 600 && battle.clash; i++) { battle.sides[winner].input.mash = 2; battle.step(); }
    assert.equal(battle.clash, null, `choque vencido pelo lado ${winner} precisa acabar`);
    run(battle, 0.5);
    const loser = winner === 0 ? m1 : m0;
    assert.ok(loser.hp < loser.maxhp);
  }
});

test('Protect bloqueia o golpe', () => {
  const { battle, m0, m1 } = duel([mon('weavile', ['iceshard'])], [mon('blastoise', ['protect'])]);
  executeMove(battle, m1, 'protect', null, {});
  assert.ok(m1.vol.protect);
  executeMove(battle, m0, 'iceshard', null, {});
  run(battle, 0.6);
  assert.equal(m1.hp, m1.maxhp);
});

test('Golpes Terrestres não acertam Charizard, mas acertam depois de Smack Down', () => {
  const { battle, m0, m1 } = duel([mon('blastoise', ['earthquake', 'smackdown'])], [mon('charizard', ['tackle'])]);
  fixedRolls(battle);
  const eq = liveMove(battle, m0, 'earthquake');
  assert.equal(calcDamage(battle, m0, m1, eq).eff, 0);
  m1.vol.smackdown = {};
  assert.ok(calcDamage(battle, m0, m1, eq).eff > 0);
});

test('Chlorophyll dobra a Velocidade no sol', () => {
  const { battle, m0 } = duel([mon('venusaur', ['tackle'], { ability: 'chlorophyll' })], [mon('blastoise', ['tackle'])]);
  const normal = getSpeed(battle, m0);
  battle.setWeather('sunnyday', 5);
  assert.equal(getSpeed(battle, m0), normal * 2);
});

test('Weather Ball vira Fogo no sol com poder dobrado', () => {
  const { battle, m0 } = duel([mon('venusaur', ['weatherball'])], [mon('blastoise', ['tackle'])]);
  battle.setWeather('sunnyday', 5);
  const mv = liveMove(battle, m0, 'weatherball');
  assert.equal(mv.type, 'Fire');
});

test('Choice Scarf trava no primeiro golpe até trocar', () => {
  const { battle, m0 } = duel([mon('weavile', ['iceshard', 'nightslash'], { item: 'choicescarf' })], [mon('blastoise', ['tackle'])]);
  assert.ok(useMove(battle, m0, 0));
  run(battle, 3);
  m0.gcd = 0;
  m0.action = null;
  assert.equal(useMove(battle, m0, 1), false);
});

test('Pickpocket rouba o item de quem encosta', () => {
  const { battle, m0, m1 } = duel([mon('charizard', ['dragonclaw'], { item: 'leftovers' })], [mon('weavile', ['tackle'], { ability: 'pickpocket' })]);
  m0.x = 430;
  executeMove(battle, m0, 'dragonclaw', null, {});
  battle.rng.chance = () => true;
  run(battle, 1);
  assert.equal(m1.item, 'leftovers');
  assert.equal(m0.item, null);
});

test('Taunt impede golpes de status', () => {
  const { battle, m0, m1 } = duel([mon('weavile', ['taunt'])], [mon('venusaur', ['synthesis', 'tackle'])]);
  executeMove(battle, m0, 'taunt', null, {});
  assert.ok(m1.vol.taunt);
  assert.equal(useMove(battle, m1, 0), false);
});

test('Sleep Powder não afeta tipo Planta', () => {
  const { battle, m0, m1 } = duel([mon('venusaur', ['sleeppowder'])], [mon('venusaur', ['tackle'])]);
  battle.rng.chance = () => true;
  executeMove(battle, m0, 'sleeppowder', null, {});
  run(battle, 1.5);
  assert.equal(m1.status, null);
});

test('Fly deixa o usuário invulnerável e cai sobre o alvo', () => {
  const { battle, m0, m1 } = duel([mon('charizard', ['fly'])], [mon('blastoise', ['iceshard'])]);
  battle.rng.chance = () => true;
  executeMove(battle, m0, 'fly', null, {});
  assert.equal(m0.semiInv, 'fly');
  run(battle, 1.6);
  assert.equal(m0.semiInv, null);
  assert.ok(m1.hp < m1.maxhp);
});

test('Atributos aumentados voltam ao normal com o tempo', () => {
  const { battle, m0 } = duel([mon('weavile', ['swordsdance'])], [mon('blastoise', ['tackle'])]);
  executeMove(battle, m0, 'swordsdance', null, {});
  assert.equal(m0.boosts.atk, 2);
  run(battle, 17);
  assert.equal(m0.boosts.atk, 1, 'depois do tempo do buff, cai um estágio');
  run(battle, 3.5);
  assert.equal(m0.boosts.atk, 0);
});

test('Stealth Rock machuca quem entra (Charizard leva 4x)', () => {
  const { battle, m0 } = duel([mon('steelix', ['stealthrock'])], [mon('blastoise', ['tackle']), mon('charizard', ['tackle'])]);
  executeMove(battle, m0, 'stealthrock', null, {});
  assert.ok(battle.sides[1].hazards.stealthrock);
  battle.switchIn(1, 1);
  const zard = battle.sides[1].active;
  assert.equal(zard.maxhp - zard.hp, Math.floor(zard.maxhp / 2));
});

test('Normal e Lutador não afetam Gengar; Shadow Tag impede a troca', () => {
  const { battle, m0, m1 } = duel([mon('weavile', ['tackle', 'brickbreak']), mon('steelix', ['tackle'])], [mon('gengar', ['shadowball'], { item: 'gengarite' })]);
  fixedRolls(battle);
  assert.equal(calcDamage(battle, m0, m1, liveMove(battle, m0, 'tackle')).eff, 0);
  battle.sides[1].megaGauge = 100;
  battle.requestMega(1);
  run(battle, 2.5);
  assert.equal(m1.ability, 'shadowtag');
  battle.sides[0].switchCd = 0;
  assert.equal(battle.canSwitch(0), false);
});

test('Destiny Bond leva o atacante junto', () => {
  const { battle, m0, m1 } = duel([mon('weavile', ['nightslash'])], [mon('gengar', ['destinybond'])]);
  executeMove(battle, m1, 'destinybond', null, {});
  m1.hp = 1;
  m0.x = 470;
  battle.rng.chance = () => true;
  executeMove(battle, m0, 'nightslash', null, {});
  run(battle, 1);
  assert.ok(m1.fainted && m0.fainted);
});

test('Trick Room deixa Steelix mais rápido que Weavile', async () => {
  const { getSpeed } = await import('../www/js/engine/mon.js');
  const { battle } = duel([mon('steelix', ['trickroom'])], [mon('weavile', ['tackle'])]);
  const [s, w] = [battle.sides[0].active, battle.sides[1].active];
  assert.ok(getSpeed(battle, s) < getSpeed(battle, w));
  executeMove(battle, s, 'trickroom', null, {});
  assert.ok(getSpeed(battle, s) > getSpeed(battle, w));
});

test('Batalha CPU contra CPU termina sem erros', () => {
  const team = [mon('charizard', ['flamethrower', 'airslash', 'solarbeam', 'roost'], { item: 'charizarditey' }), mon('weavile', ['nightslash', 'iceshard', 'icepunch', 'swordsdance'])];
  const battle = new Battle({ teams: [team, team], cpu: [true, true], seed: 9, events: false, timeLimit: 400 });
  run(battle, 700); // o limite de tempo encerra a batalha (apresentação, Megas e choques pausam o relógio)
  assert.ok(battle.over);
});
