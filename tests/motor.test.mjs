// Testes do motor 1v1: dados, recursos, evolução, Mega, as 25 formas de skill e duelos completos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { Luta } from '../www/js/engine/luta.js';
import { IA } from '../www/js/engine/ia.js';
import { ROSTER } from '../www/js/data/pokemon.js';
import { REGLAS } from '../www/js/data/regras.js';
import { sembrar } from '../www/js/engine/util.js';

const def = id => ROSTER.find(p => p.id === id);
const nuevaLuta = (a = 'riolu', b = 'munchlax', extra = {}) => { const l = new Luta({ p1: def(a), p2: def(b), rapido: true, semilla: 7, ...extra }); if (!extra.conEspera) l.inicioRonda = -999; return l; };
const correr = (luta, seg, intentos = null) => { for (let i = 0; i < seg * 60; i++) { luta.paso(1 / 60, intentos); luta.tomarEventos(); } };
const FORMAS = ['proyectil', 'crecimiento', 'dash', 'chorro', 'helice', 'tajo', 'golpe', 'cono', 'pulso', 'burbujas', 'caparazon', 'viento', 'lluvia', 'vuelo', 'erupcion', 'patada', 'descanso', 'meteoro', 'rafaga', 'clones', 'humo', 'embestidas', 'bombaLodo', 'plantaFeroz', 'arraigo', 'chapoteo', 'potenciar', 'escudo', 'explosion', 'trampa', 'torbellino', 'laco', 'ninguna', 'geiser', 'torreta', 'lanzaTorretas', 'espejo', 'curaAnillo', 'recuperar', 'estallido', 'burbuja', 'salto', 'flecha', 'puente'];

test('o roster tem os 20 Pokémon pedidos', () => {
  assert.deepEqual(ROSTER.map(p => p.id), ['bulbasaur', 'charmander', 'squirtle', 'zubat', 'abra', 'onix', 'magikarp', 'munchlax', 'seedot', 'buneary', 'riolu', 'froakie', 'poltchageist', 'tynamo', 'veluza', 'duraludon', 'feebas', 'swablu', 'porygon', 'mewtwo']);
  const finais = ROSTER.map(p => (p.evoluciones.at(-1).mega?.nombre ?? p.evoluciones.at(-1).nombre));
  assert.ok(finais.includes('MEGA CHARIZARD X') && finais.includes('MEGA STEELIX') && finais.includes('MEGA LUCARIO') && finais.includes('MEGA LOPUNNY'));
  assert.ok(ROSTER.some(p => p.evoluciones.some(e => e.nombre === 'GRENINJA')));
  assert.ok(ROSTER.some(p => p.evoluciones.some(e => e.nombre === 'SNORLAX')));
});

test('cada Pokémon tem as 5 skills e só usa formas que o motor conhece', () => {
  for (const p of ROSTER) {
    assert.deepEqual(Object.keys(p.kit).sort(), ['e', 'esp', 'lmb', 'q', 'rmb']);
    for (const h of Object.values(p.kit)) assert.ok(FORMAS.includes(h.forma ?? 'proyectil'), `${p.id}: ${h.forma}`);
    for (const e of p.evoluciones) for (const h of Object.values(e.kit ?? {})) if (h.forma) assert.ok(FORMAS.includes(h.forma), `${e.nombre}: ${h.forma}`);
  }
});

test('todos os sprites do PMD existem no manifesto e nos arquivos', { skip: !existsSync('www/assets/pmd/manifest.json') }, () => {
  const m = JSON.parse(readFileSync('www/assets/pmd/manifest.json', 'utf8'));
  for (const p of ROSTER) for (const f of [p, ...p.evoluciones]) for (const dex of [f.dex, f.mega?.dex].filter(Boolean)) {
    assert.ok(m[dex]?.anims.Idle && m[dex].anims.Walk, `faltam sprites de ${dex}`);
    assert.ok(existsSync(`www/assets/pmd/${m[dex].anims.Idle.file}`));
  }
});

test('a luta começa com energia 30, vida cheia e 99 segundos', () => {
  const l = nuevaLuta();
  const [a, b] = l.luchadores;
  assert.equal(a.energia, REGLAS.energiaInicial);
  assert.equal(a.hp, a.hpMax);
  assert.equal(l.reloj, REGLAS.tiempoRonda);
  assert.equal(b.hpMax, Math.round(def('munchlax').hp * REGLAS.vidaGlobal));
});

test('dano usa ataque, defesa e dano global; golpe com energia cheia dá surge', () => {
  const l = nuevaLuta();
  const [a, b] = l.luchadores;
  const antes = b.hp;
  b.recibir(a, { dano: 10, tipo: 'NORMAL', slot: 'rmb' });
  const esperado = 10 * REGLAS.danoGlobal * a.atk / b.defensa;
  assert.ok(Math.abs(antes - b.hp - esperado) < 0.01, `${antes - b.hp} vs ${esperado}`);
  const antes2 = b.hp;
  b.recibir(a, { dano: 10, tipo: 'NORMAL', slot: 'rmb', surge: true });
  assert.ok(Math.abs(antes2 - b.hp - esperado * REGLAS.surgeMult) < 0.01);
});

test('golpe sem energia não sai e gasta energia quando sai', () => {
  const l = nuevaLuta('charmander', 'munchlax');
  const [a, b] = l.luchadores;
  a.energia = 0; a.ax = b.x; a.ay = b.y;
  assert.equal(l.habilidades.usar(a, 'rmb'), false);
  a.energia = 50;
  assert.equal(l.habilidades.usar(a, 'rmb'), true);
  assert.equal(a.energia, 50 - a.kit.rmb.coste);
  assert.ok(a.cd.rmb > 0);
  assert.equal(l.habilidades.usar(a, 'rmb'), false, 'em recarga');
});

test('Charmander e Bulbasaur não têm ultimate na primeira fase', () => {
  for (const id of ['charmander', 'bulbasaur']) {
    const l = nuevaLuta(id, 'munchlax');
    const a = l.luchadores[0];
    a.ulti = 100;
    assert.equal(l.habilidades.usar(a, 'e'), false, id);
  }
});

test('ultimate só sai com a barra cheia e zera a barra', () => {
  const l = nuevaLuta('squirtle', 'munchlax');
  const [a, b] = l.luchadores;
  a.ax = b.x; a.ay = b.y;
  assert.equal(l.habilidades.usar(a, 'e'), false);
  a.ulti = 100;
  assert.equal(l.habilidades.usar(a, 'e'), true);
  assert.equal(a.ulti, 0);
});

test('o ataque básico esquenta e causa sobrecarga', () => {
  const l = nuevaLuta('charmander', 'munchlax');
  const [a, b] = l.luchadores;
  a.ax = b.x; a.ay = b.y;
  let usos = 0;
  for (let i = 0; i < 60 * 12 && !(l.t < a.sobrecargaHasta); i++) { a.cd.lmb = 0; a.accion = null; if (l.habilidades.usar(a, 'lmb')) usos++; l.paso(1 / 60, [null, null]); }
  assert.ok(a.sobrecargaHasta > 0, 'chegou à sobrecarga');
  assert.ok(usos >= 10 && usos <= 14, `${usos} golpes até sobrecarregar`);
  a.cd.lmb = 0;
  assert.equal(l.habilidades.usar(a, 'lmb'), false, 'bloqueado na sobrecarga');
});

test('a evolução acontece em tempo real: exp cheia, tecla de evoluir, estágio e kit novos', () => {
  const l = nuevaLuta('bulbasaur', 'munchlax');
  const [a] = l.luchadores;
  assert.equal(a.puedeEvolucionar, false);
  a.ganarExp(a.expNecesaria);
  assert.equal(a.puedeEvolucionar, true);
  const hpMaxAntes = a.hpMax;
  correr(l, 0.1, [{ mx: 0, my: 0, ax: 0, ay: 0, mega: true }, null]);
  assert.equal(a.etapa, 1);
  assert.equal(a.nombre, 'IVYSAUR');
  assert.ok(a.hpMax > hpMaxAntes);
  assert.equal(a.kit.e.dano, 28);
  a.ganarExp(500); correr(l, 2.2, [{ mx: 0, my: 0, ax: 0, ay: 0, mega: true }, null]);
  assert.equal(a.nombre, 'VENUSAUR');
  assert.equal(a.kit.rmb.nombre, 'Sludge Bomb');
});

test('Mega Evolução: ultimate cheia no último estágio troca forma, tipos e atributos', () => {
  const l = nuevaLuta('riolu', 'munchlax', { etapas: [2, 0] });
  const [a] = l.luchadores;
  assert.equal(a.nombre, 'LUCARIO');
  const atk0 = a.atk, vel0 = a.velBase;
  a.ulti = 100;
  assert.equal(a.puedeMega, true);
  correr(l, 0.1, [{ mx: 0, my: 0, ax: 0, ay: 0, mega: true }, null]);
  correr(l, 1, [null, null]);
  assert.equal(a.mega, true);
  assert.equal(a.nombre, 'MEGA LUCARIO');
  assert.ok(a.atk > atk0 && a.velBase > vel0);
  assert.equal(a.kit.rmb.teledirigido, 3.5);
  assert.ok(a.ulti < 5, 'a barra foi gasta');
});

test('Mega Charizard X vira Fogo/Dragão e Mega Steelix fica maior', () => {
  const l = nuevaLuta('charmander', 'onix', { etapas: [2, 2] });
  const [a, b] = l.luchadores;
  a.ulti = 100; b.ulti = 100;
  correr(l, 0.1, [{ mx: 0, my: 0, ax: 0, ay: 0, mega: true }, { mx: 0, my: 0, ax: 0, ay: 0, mega: true }]);
  correr(l, 1, [null, null]);
  assert.deepEqual(a.tipos, ['FIRE', 'DRAGON']);
  assert.equal(b.nombre, 'MEGA STEELIX');
  assert.ok(b.kit.e.radio >= 56);
});

test('todas as skills de todos os estágios e Megas podem ser usadas sem erro', () => {
  let usadas = 0;
  for (const p of ROSTER) {
    const maxEtapa = p.evoluciones.length;
    for (let etapa = 0; etapa <= maxEtapa; etapa++) for (const mega of [false, true]) {
      const l = nuevaLuta(p.id, 'munchlax', { etapas: [etapa, 0] });
      const [a, b] = l.luchadores;
      if (mega) { if (!a.forma.mega) continue; a.mega = true; a.kit = a.kitActual(); }
      b.inmortal = true;
      for (const slot of ['lmb', 'rmb', 'esp', 'q', 'e']) {
        a.energia = 100; a.ulti = 100; a.accion = null; a.dash = null; a.est = {}; a.calor = 0; for (const k in a.cd) a.cd[k] = 0;
        a.x = 380; a.y = 222; b.x = 520; b.y = 222; a.ax = b.x; a.ay = b.y;
        const ok = l.habilidades.usar(a, slot);
        // formas bebê não têm ultimate: o botão existe mas não faz nada
        if (a.kit[slot].sinUlti) { assert.equal(ok, false, `${p.id} etapa ${etapa} sem ultimate`); continue; }
        assert.ok(ok, `${p.id} etapa ${etapa}${mega ? ' mega' : ''} ${slot}`);
        usadas++;
        correr(l, 2.2, [{ mx: 0, my: 0, ax: b.x, ay: b.y }, null]);
        assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.hp), `${p.id} ${slot} corrompeu o estado`);
      }
    }
  }
  assert.ok(usadas >= 9 * 3 * 5);
});

test('Double Team cria clones que seguem o lutador e somem ao serem atingidos', () => {
  const l = nuevaLuta('froakie', 'munchlax', { etapas: [1, 0] });
  const [a, b] = l.luchadores;
  a.energia = 100; a.ax = b.x; a.ay = b.y;
  assert.ok(l.habilidades.usar(a, 'rmb'));
  assert.equal(a.clones.length, 1);
  correr(l, 0.4, [null, null]);
  const c = a.clones[0];
  c.romper();
  correr(l, 0.1, [null, null]);
  assert.equal(a.clones, null);
});

test('um duelo completo termina em melhor de 3 e é repetível com a mesma semente', () => {
  const resultado = semilla => {
    const l = nuevaLuta('charmander', 'squirtle', { semilla });
    const ias = l.luchadores.map(x => new IA(l, x, 'normal'));
    let n = 0;
    while (l.fase !== 'fin' && n < 60 * 400) { l.paso(1 / 60, ias.map(ia => ia.intento(1 / 60))); l.tomarEventos(); n++; }
    return { victorias: [...l.victorias], ganador: l.fin?.ganador, n };
  };
  const r1 = resultado(11), r2 = resultado(11);
  assert.ok(r1.ganador === 0 || r1.ganador === 1);
  assert.equal(Math.max(...r1.victorias), REGLAS.rondasParaGanar);
  assert.deepEqual(r1, r2);
});

test('os 72 duelos entre os 9 Pokémon terminam sem erro', () => {
  for (const a of ROSTER) for (const b of ROSTER) {
    if (a === b) continue;
    const l = nuevaLuta(a.id, b.id, { semilla: 3 });
    const ias = l.luchadores.map(x => new IA(l, x, 'normal'));
    let n = 0;
    while (l.fase !== 'fin' && n < 60 * 400) { l.paso(1 / 60, ias.map(ia => ia.intento(1 / 60))); l.tomarEventos(); n++; }
    assert.equal(l.fase, 'fin', `${a.id} x ${b.id} não terminou`);
  }
});

test('se o tempo acaba, ganha quem tem mais vida', () => {
  const l = nuevaLuta('riolu', 'munchlax');
  const [a, b] = l.luchadores;
  l.fase = 'lucha';
  b.hp = b.hpMax * 0.5;
  l.reloj = 0.05;
  correr(l, 0.2, [null, null]);
  assert.deepEqual(l.victorias, [1, 0]);
});

test('treino: sem relógio e o boneco não morre', () => {
  const l = nuevaLuta('riolu', 'munchlax', { modo: 'entreno' });
  const [a, b] = l.luchadores;
  correr(l, 1.2, [null, null]);
  assert.equal(l.fase, 'lucha');
  b.recibir(a, { dano: 9999, tipo: 'NORMAL', slot: 'rmb' });
  assert.ok(b.hp >= 1 && !b.ko);
  const r0 = l.reloj;
  correr(l, 5, [null, null]);
  assert.equal(l.reloj, r0);
});

test('o segundo estágio de mesma forma é Power Up e a Mega muda as skills de verdade', () => {
  for (const id of ['onix', 'munchlax', 'buneary', 'riolu']) {
    const p = ROSTER.find(x => x.id === id);
    assert.equal(p.evoluciones.length, 2, id);
    assert.equal(p.evoluciones[0].dex, p.evoluciones[1].dex, `${id}: o segundo estágio repete a forma (Power Up)`);
  }
  const l = nuevaLuta('onix', 'munchlax', { etapas: [1, 0] });
  const [a] = l.luchadores;
  a.hp = a.hpMax * 0.5; a.exp = 9999;
  const vida0 = a.hp, esc0 = a.escala;
  correr(l, 0.1, [{ mx: 0, my: 0, ax: 0, ay: 0, mega: true }, null]);
  correr(l, 2.2, [null, null]);
  assert.equal(a.etapa, 2);
  assert.ok(a.escala > esc0 && a.hp > vida0, 'Power Up cresce e cura');
  for (const p of ROSTER) {
    const fin = p.evoluciones.at(-1);
    if (!fin.mega) continue;
    const l = nuevaLuta(p.id, 'munchlax', { etapas: [p.evoluciones.length, 0] });
    const [a] = l.luchadores;
    const antes = JSON.stringify(a.kit);
    a.mega = true; a.kit = a.kitActual();
    const cambian = ['lmb', 'rmb', 'esp', 'q', 'e'].filter(s => JSON.stringify(a.kit[s]) !== JSON.stringify(JSON.parse(antes)[s]));
    assert.equal(cambian.length, 5, `${p.id}: a Mega deve mexer nas 5 skills`);
    assert.notEqual(a.kit.lmb.nombre, JSON.parse(antes).lmb.nombre, `${p.id}: nome novo na Mega`);
  }
});

test('evoluir e Mega demoram: só depois de alguns segundos da rodada e com a barra cheia', () => {
  const l = nuevaLuta('riolu', 'munchlax', { conEspera: true });
  const [a] = l.luchadores;
  a.etapa = 2; a.ulti = 100; a.exp = 9999;
  assert.equal(a.puedeMega, false, 'Mega bloqueada no começo da rodada');
  assert.ok(a.megaEn > 30);
  l.t += 36;
  assert.equal(a.puedeMega, true);
  const b = nuevaLuta('bulbasaur', 'munchlax', { conEspera: true }).luchadores[0];
  b.exp = 9999;
  assert.equal(b.puedeEvolucionar, false);
  assert.ok(b.expNecesaria >= 90, `exige mais exp que o site: ${b.expNecesaria}`);
});

test('voando (Fly) ou debaixo da terra (Dig) nenhuma skill sai, só emergir', () => {
  for (const [id, slot] of [['charmander', 'esp'], ['onix', 'esp']]) {
    const l = nuevaLuta(id, 'munchlax', { etapas: [id === 'charmander' ? 2 : 1, 0] });
    const [a] = l.luchadores;
    a.energia = 100; a.ulti = 100;
    assert.equal(l.habilidades.usar(a, slot), true, id);
    assert.ok(a.est.vuelo, id);
    for (const s of ['lmb', 'rmb', 'q', 'e']) assert.equal(l.habilidades.usar(a, s), false, `${id} ${s} voando`);
  }
});

test('Frenzy Plant: atordoa e dá dano perto, no meio e na borda da área (não só na ponta)', () => {
  for (const [dx, dy] of [[30, 0], [70, 0], [100, 0], [0, 50], [-60, 30]]) {
    const l = nuevaLuta('bulbasaur', 'munchlax', { etapas: [2, 0] });
    const [a, b] = l.luchadores;
    b.x = a.x + dx; b.y = a.y + dy; b.vx = 0; b.vy = 0;
    const hp0 = b.hp;
    a.ulti = 100;
    assert.equal(l.habilidades.usar(a, 'e'), true);
    let atordoou = false;
    for (let i = 0; i < 60; i++) { l.paso(1 / 60, [null, null]); l.tomarEventos(); if (b.est.aturdido) atordoou = true; }
    assert.ok(b.hp < hp0, `dano em (${dx},${dy})`);
    assert.ok(atordoou, `atordoa em (${dx},${dy})`);
  }
});

test('Magikarp: Splash não faz nada mas enche a exp; Gyarados acumula Dragon Dance e recarrega depois do Hyper Beam', () => {
  const l = nuevaLuta('magikarp', 'munchlax');
  const [a] = l.luchadores;
  a.ulti = 100;
  assert.equal(l.habilidades.usar(a, 'e'), true);
  correr(l, 1.6, [null, null]);
  assert.ok(a.exp >= a.expNecesaria, 'exp cheia depois do Splash');
  const g = nuevaLuta('magikarp', 'munchlax', { etapas: [1, 0] }).luchadores[0];
  g.energia = 100;
  assert.equal(g.nombre, 'GYARADOS');
  g.luta.habilidades.usar(g, 'q'); correr(g.luta, 0.5, [null, null]); g.cd.q = 0; g.luta.habilidades.usar(g, 'q');
  assert.equal(g.est.potencia.n, 2);
});

test('Seedot: Grass Knot prende quem pisa; Shiftry: Leaf Tornado dá dano', () => {
  const l = nuevaLuta('seedot', 'munchlax');
  const [a, b] = l.luchadores;
  a.energia = 100; b.x = a.x + 80; b.y = a.y; a.ax = b.x; a.ay = b.y;
  assert.equal(l.habilidades.usar(a, 'rmb'), true);
  const hp0 = b.hp; let preso = false;
  for (let i = 0; i < 60; i++) { l.paso(1 / 60, [null, null]); l.tomarEventos(); if (b.est.aturdido) preso = true; }
  assert.ok(b.hp < hp0 && preso);
  const s = nuevaLuta('seedot', 'munchlax', { etapas: [2, 0] });
  const [c, d] = s.luchadores;
  d.x = c.x + 90; d.y = c.y; c.ax = d.x; c.ay = d.y; c.ulti = 100;
  const hp1 = d.hp;
  assert.equal(s.habilidades.usar(c, 'e'), true);
  correr(s, 2.5, [null, null]);
  assert.ok(d.hp < hp1, 'o redemoinho alcança o alvo');
});

test('Alakazam: Teleport reaparece na hora; Psychic Lasso prende, puxa e arremessa longe', () => {
  const l = nuevaLuta('abra', 'munchlax', { etapas: [2, 0] });
  const [a, b] = l.luchadores;
  const x0 = a.x;
  a.ax = a.x - 200; a.ay = a.y;
  assert.equal(l.habilidades.usar(a, 'esp'), true);
  assert.ok(x0 - a.x > 100, 'teleportou na hora');
  correr(l, 0.5, [null, null]);
  b.x = a.x + 120; b.y = a.y; a.ax = b.x; a.ay = b.y; a.ulti = 100;
  const hp0 = b.hp;
  assert.equal(l.habilidades.usar(a, 'e'), true);
  correr(l, 0.45, [null, null]);
  assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 70, 'puxou para perto');
  a.ax = a.x + 300; a.ay = a.y;
  correr(l, 1.2, [null, null]);
  assert.ok(b.hp < hp0, 'deu dano');
  assert.ok(b.x - a.x > 120, `arremessou longe (${Math.round(b.x - a.x)})`);
});

test('formas bebê sem ultimate; Eelektrik e Eelektross com ultimates diferentes', () => {
  for (const [id, etapa] of [['abra', 0], ['abra', 1], ['poltchageist', 0], ['tynamo', 0]]) {
    const a = nuevaLuta(id, 'munchlax', { etapas: [etapa, 0] }).luchadores[0];
    a.ulti = 100;
    assert.equal(a.luta.habilidades.usar(a, 'e'), false, `${id} ${etapa}`);
  }
  const k1 = nuevaLuta('tynamo', 'munchlax', { etapas: [1, 0] }).luchadores[0].kit.e, k2 = nuevaLuta('tynamo', 'munchlax', { etapas: [2, 0] }).luchadores[0].kit.e;
  assert.notEqual(k1.nombre, k2.nombre);
  assert.notEqual(k1.forma, k2.forma);
  const ala = nuevaLuta('abra', 'munchlax', { etapas: [2, 0] }).luchadores[0];
  ala.ulti = 100;
  assert.equal(ala.luta.habilidades.usar(ala, 'e'), true);
  assert.equal(ala.kit.esp.cd, 8);
});

test('Snorlax dormindo devolve os golpes; Matcha Geyser puxa o alvo; jato do Blastoise atordoa', () => {
  const l = nuevaLuta('munchlax', 'charmander', { etapas: [1, 0] });
  const [a, b] = l.luchadores;
  a.energia = 100;
  assert.equal(l.habilidades.usar(a, 'q'), true);
  const hpA = a.hp, hpB = b.hp;
  a.recibir(b, { dano: 10, tipo: 'FIRE', dirX: 1, dirY: 0 });
  assert.equal(a.hp >= hpA, true, 'Snorlax não leva o golpe');
  assert.ok(b.hp < hpB, 'o golpe volta para quem atacou');
  assert.equal(a.kit.q.cd, 30);
  const s = nuevaLuta('poltchageist', 'munchlax', { etapas: [1, 0] });
  const [c, d] = s.luchadores;
  c.energia = 100; d.x = c.x + 160; d.y = c.y;
  const d0 = d.x - c.x;
  assert.equal(s.habilidades.usar(c, 'q'), true);
  correr(s, 1.2, [null, null]);
  assert.ok(d.x - c.x < d0 - 40, `o gêiser joga o alvo para perto (${Math.round(d.x - c.x)})`);
  const w = nuevaLuta('squirtle', 'munchlax', { etapas: [2, 0] });
  const [e, f] = w.luchadores;
  e.energia = 100; f.x = e.x + 50; f.y = e.y;
  w.habilidades.usar(e, 'q');
  let atordoou = false;
  for (let i = 0; i < 90; i++) { w.paso(1 / 60, [null, null]); w.tomarEventos(); if (f.est.aturdido) atordoou = true; }
  assert.ok(atordoou, 'jato do Hydro Typhoon atordoa');
});

test('Veluza: torreta nasce onde ela está, pulsa e dá dano; ultimate puxa as torretas e atira no inimigo', () => {
  const l = nuevaLuta('veluza', 'munchlax');
  const [a, b] = l.luchadores;
  a.energia = 100; b.x = a.x + 30; b.y = a.y; a.ax = b.x; a.ay = b.y;
  assert.equal(l.habilidades.usar(a, 'q'), true);
  const hp0 = b.hp;
  correr(l, 2.5, [null, null]);
  assert.ok(b.hp < hp0, 'a torreta pulsou no inimigo');
  assert.equal(l.entidades.filter(e => e.tipo === 'torreta').length, 1);
  const hp1 = b.hp;
  a.ulti = 100;
  assert.equal(l.habilidades.usar(a, 'e'), true);
  correr(l, 2, [null, null]);
  assert.equal(l.entidades.filter(e => e.tipo === 'torreta' && e.vivo).length, 0, 'a torreta foi usada');
  assert.ok(b.hp < hp1, 'as torretas acertaram');
});

test('novos: Mirror Coat devolve, Aqua Ring cura, Lock-On marca, Tri Attack troca de tipo, Psystrike solta 14 esferas', () => {
  const l = nuevaLuta('feebas', 'charmander');
  const [a, b] = l.luchadores;
  a.energia = 100;
  assert.equal(l.habilidades.usar(a, 'rmb'), true);
  const hpB = b.hp, hpA = a.hp;
  a.recibir(b, { dano: 10, tipo: 'FIRE', dirX: 1, dirY: 0 });
  assert.ok(a.hp >= hpA && b.hp < hpB, 'Mirror Coat devolve o golpe');
  correr(l, 1.5, [null, null]);
  a.hp = a.hpMax * 0.5; a.cd.q = 0;
  assert.equal(l.habilidades.usar(a, 'q'), true);
  const h0 = a.hp; correr(l, 3, [null, null]);
  assert.ok(a.hp > h0, 'Aqua Ring cura');
  const p = nuevaLuta('porygon', 'munchlax');
  const [c, d] = p.luchadores;
  c.energia = 100; d.x = c.x + 100; d.y = c.y; c.ax = d.x; c.ay = d.y;
  p.habilidades.usar(c, 'rmb'); correr(p, 0.6, [null, null]);
  assert.ok(d.est.marca, 'Lock-On marcou o alvo');
  const tipos = new Set();
  for (let i = 0; i < 3; i++) { c.cd.lmb = 0; c.calor = 0; c.accion = null; p.habilidades.usar(c, 'lmb'); correr(p, 0.3, [null, null]); for (const e of p.entidades) if (e.tipo === 'proj') tipos.add(e.tipoAtq); }
  assert.ok(tipos.size >= 2, `Tri Attack troca de tipo (${[...tipos]})`);
  const m = nuevaLuta('mewtwo', 'munchlax', { etapas: [2, 0] });
  const [e] = m.luchadores;
  e.mega = true; e.kit = e.kitActual(); e.energia = 100;
  assert.equal(m.habilidades.usar(e, 'rmb'), true);
  correr(m, 0.25, [null, null]);
  assert.equal(m.entidades.filter(x => x.tipo === 'proj').length, 14);
});
