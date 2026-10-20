// Modo online: os dois aparelhos precisam chegar exatamente ao mesmo estado
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../www/js/engine/battle.js';
import { CpuController } from '../www/js/engine/ai.js';
import { DT } from '../www/js/engine/constants.js';
import { Lockstep, packInput, unpackInput, stateHash, snapshot, restore } from '../www/js/net/lockstep.js';

const TEAMS = [
  [
    { species: 'venusaur', ability: 'chlorophyll', item: 'venusaurite', gender: 'M', moves: ['solarbeam', 'sludgebomb', 'sunnyday', 'earthquake'] },
    { species: 'gengar', ability: 'cursedbody', item: 'lifeorb', gender: 'M', moves: ['shadowball', 'sludgewave', 'thunderbolt', 'focusblast'] },
  ],
  [
    { species: 'charizard', ability: 'blaze', item: 'charizarditey', gender: 'M', moves: ['flamethrower', 'airslash', 'solarbeam', 'dragonpulse'] },
    { species: 'steelix', ability: 'sturdy', item: 'leftovers', gender: 'M', moves: ['earthquake', 'ironhead', 'stealthrock', 'stoneedge'] },
  ],
];

const newBattle = seed => new Battle({ teams: structuredClone(TEAMS), cpu: [false, false], seed, events: false, timeLimit: 150 });

test('comando compacto ida e volta', () => {
  const inp = { mx: 0.5, my: -1, move: { slot: 2, aim: { x: 0.6, y: -0.8 } }, dodge: true, mega: true, switchTo: 1, mash: 3 };
  const out = unpackInput(JSON.parse(JSON.stringify(packInput(inp))));
  assert.equal(out.move.slot, 2);
  assert.ok(Math.abs(out.move.aim.x - 0.6) < 1e-9 && Math.abs(out.move.aim.y + 0.8) < 1e-9);
  assert.ok(out.dodge && out.mega);
  assert.equal(out.switchTo, 1);
  assert.equal(out.mash, 3);
  assert.ok(Math.abs(out.mx - 0.5) < 0.01 && out.my === -1);
  const none = unpackInput(packInput({ mx: 0, my: 0, move: null, dodge: false, mega: false, switchTo: null, mash: 0 }));
  assert.equal(none.move, null);
  assert.equal(none.switchTo, null);
});

// Dois "aparelhos" ligados por uma rede de mentira com atraso variável (mensagens em ordem)
function playOnline({ frames, seed = 77, latency = [2, 9], sabotageAt = null }) {
  const peers = [0, 1].map(me => {
    const b = newBattle(seed);
    const bot = new CpuController(b, me, 'hard');
    return { me, b, bot, inbox: [], lastDelivery: 0, hashes: new Map() };
  });
  let now = 0;
  const lat = () => latency[0] + Math.floor(Math.random() * (latency[1] - latency[0] + 1));
  for (const p of peers) {
    const other = peers[1 - p.me];
    p.ls = new Lockstep(p.b, p.me, 6, msg => {
      const at = Math.max(other.lastDelivery, now + lat());
      other.lastDelivery = at;
      other.inbox.push({ at, msg: JSON.parse(JSON.stringify(msg)) });
    });
  }
  let stalls = 0;
  for (now = 0; now < frames * 3; now++) {
    for (const p of peers) {
      while (p.inbox.length && p.inbox[0].at <= now) p.ls.onMessage(p.inbox.shift().msg);
      p.ls.schedule(local => {
        p.bot.update(DT);
        Object.assign(local, p.b.sides[p.me].input);
        p.b.clearInputs();
      });
      if (p.ls.ready()) {
        p.ls.advance(DT);
        if (p.ls.frame % 120 === 0) p.hashes.set(p.ls.frame, stateHash(p.b));
        if (sabotageAt !== null && p.me === 1 && p.ls.frame === sabotageAt) p.b.sides[0].active.hp = Math.max(1, p.b.sides[0].active.hp - 37);
      } else stalls++;
    }
    if (peers.every(p => p.ls.frame >= frames)) break;
  }
  return { peers, stalls };
}

test('os dois lados simulam a mesma batalha com atraso de rede', () => {
  const { peers, stalls } = playOnline({ frames: 60 * 90 });
  const [a, b] = peers;
  assert.ok(a.ls.frame >= 60 * 90 && b.ls.frame >= 60 * 90, 'os dois avançaram');
  let compared = 0;
  for (const [f, h] of a.hashes) if (b.hashes.has(f)) { assert.equal(b.hashes.get(f), h, `quadro ${f}`); compared++; }
  assert.ok(compared > 30);
  assert.equal(a.ls.desyncs + b.ls.desyncs, 0);
  assert.ok(stalls < 60 * 90, 'esperas pela rede ficam limitadas');
});

test('estado completo salvo e restaurado continua igual', () => {
  const a = new Battle({ teams: structuredClone(TEAMS), cpu: [true, true], seed: 5, events: false, timeLimit: 300 });
  for (let i = 0; i < 60 * 40 && !a.over; i++) a.step(DT);
  a.sides.forEach(s => { s.cpu = null; });
  const snap = JSON.parse(JSON.stringify(snapshot(a)));
  const b = newBattle(999);
  restore(b, snap);
  assert.equal(stateHash(b), stateHash(a));
  // os mesmos comandos daqui para frente levam ao mesmo resultado
  let x = 12345;
  const rnd = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
  for (let i = 0; i < 60 * 30; i++) {
    const cmds = [0, 1].map(() => packInput({ mx: rnd() * 2 - 1, my: rnd() * 2 - 1, move: rnd() < 0.05 ? { slot: Math.floor(rnd() * 4), aim: null } : null, dodge: rnd() < 0.01, mega: rnd() < 0.01, switchTo: null, mash: 0 }));
    for (const bt of [a, b]) { cmds.forEach((c, k) => unpackInput(c, bt.sides[k].input)); bt.step(DT); }
  }
  assert.equal(stateHash(b), stateHash(a));
});

test('se um lado divergir, a sala ressincroniza', () => {
  const { peers } = playOnline({ frames: 60 * 40, seed: 31, sabotageAt: 600 });
  const [a, b] = peers;
  assert.ok(a.ls.desyncs >= 1, 'a divergência foi percebida');
  assert.ok(b.ls.syncs >= 1, 'o estado foi reenviado');
  const last = Math.min(a.ls.frame, b.ls.frame);
  const f = Math.floor(last / 120) * 120;
  assert.equal(b.hashes.get(f), a.hashes.get(f), 'voltaram a ficar iguais');
});

test('time que chega do outro aparelho é conferido', async () => {
  const { sanitizeTeam } = await import('../www/js/net/online.js');
  const ok = sanitizeTeam(structuredClone(TEAMS[0]));
  assert.equal(ok.length, 2);
  assert.deepEqual(ok[0].moves, TEAMS[0][0].moves);
  // golpe que o Pokémon não aprende, item de Mega de outro Pokémon e espécie fora do jogo
  const bad = sanitizeTeam([{ species: 'gengar', ability: 'hacker', item: 'venusaurite', moves: ['shadowball', 'v-create', 'frenzyplant'] }]);
  assert.deepEqual(bad[0].moves, ['shadowball']);
  assert.equal(bad[0].item, null);
  assert.equal(bad[0].ability, 'cursedbody');
  assert.equal(sanitizeTeam([{ species: 'mewtwo', moves: ['psystrike'] }]), null);
  assert.equal(sanitizeTeam('lixo'), null);
});
