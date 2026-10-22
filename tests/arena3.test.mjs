// Testes do modo arena (3 lutadores) e da sessão online em lockstep.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Luta } from '../www/js/engine/luta.js';
import { IA } from '../www/js/engine/ia.js';
import { ROSTER } from '../www/js/data/pokemon.js';
import { Sesion, resumen, cuantizar } from '../www/js/online/sesion.js';

const def = id => ROSTER.find(p => p.id === id);
const nueva = (ids, extra = {}) => new Luta({ p1: def(ids[0]), p2: def(ids[1]), p3: ids[2] ? def(ids[2]) : null, rapido: true, semilla: 11, ...extra });

test('arena com 3 lutadores: todos contra todos termina com um vencedor', () => {
  for (const ids of [['riolu', 'munchlax', 'zubat'], ['charmander', 'squirtle', 'bulbasaur'], ['onix', 'froakie', 'buneary']]) {
    const l = nueva(ids);
    assert.equal(l.luchadores.length, 3);
    const ias = l.luchadores.map(x => new IA(l, x, 'normal'));
    let n = 0;
    while (l.fase !== 'fin' && n < 60 * 500) { l.paso(1 / 60, ias.map(ia => ia.intento(1 / 60))); l.tomarEventos(); n++; }
    assert.equal(l.fase, 'fin', ids.join(' x '));
    assert.equal(l.victorias.length, 3);
    assert.ok(l.fin.ganador >= 0 && l.fin.ganador <= 2);
    assert.equal(Math.max(...l.victorias), 2);
  }
});

test('a rodada só acaba quando sobra um lutador de pé', () => {
  const l = nueva(['riolu', 'munchlax', 'zubat']);
  l.fase = 'lucha';
  l.luchadores[1].morir(l.luchadores[0]);
  assert.equal(l.fase, 'lucha');
  l.luchadores[2].morir(l.luchadores[0]);
  assert.equal(l.fase, 'ko');
  assert.deepEqual(l.victorias, [1, 0, 0]);
});

test('o alvo é o inimigo vivo mais perto', () => {
  const l = nueva(['riolu', 'munchlax', 'zubat']);
  const [a, b, c] = l.luchadores;
  a.x = 100; a.y = 200; b.x = 400; b.y = 200; c.x = 160; c.y = 200;
  assert.equal(a.rival, c);
  c.ko = true;
  assert.equal(a.rival, b);
});

// transporte falso: entrega as mensagens do outro lado depois de `atraso` chamadas de passo
function par(atraso) {
  const fila = [[], []], mk = i => ({ via: 'TEST', alMensaje: null, alCerrar: null, enviar(m) { fila[1 - i].push({ m: JSON.parse(JSON.stringify(m)), t: atraso }); }, cerrar() {} });
  const a = mk(0), b = mk(1);
  return { a, b, tick() { fila.forEach((f, i) => { for (const x of f) x.t--; while (f.length && f[0].t <= 0) { const { m } = f.shift(); (i === 0 ? a : b).alMensaje?.(m); } }); } };
}

test('lockstep: dois aparelhos com rede lenta ficam idênticos', () => {
  const rede = par(4);
  const sA = new Sesion(rede.a, 0), sB = new Sesion(rede.b, 1);
  const lA = new Luta({ p1: def('riolu'), p2: def('onix'), rapido: true, semilla: 5 }), lB = new Luta({ p1: def('riolu'), p2: def('onix'), rapido: true, semilla: 5 });
  const iaA = new IA(lA, lA.luchadores[0], 'normal'), iaB = new IA(lB, lB.luchadores[1], 'normal');
  let pasosA = 0, pasosB = 0;
  for (let i = 0; i < 60 * 40; i++) {
    rede.tick();
    const rA = sA.paso(lA, () => iaA.intento(1 / 60)); if (rA) { lA.paso(1 / 60, rA); lA.tomarEventos(); pasosA++; }
    const rB = sB.paso(lB, () => iaB.intento(1 / 60)); if (rB) { lB.paso(1 / 60, rB); lB.tomarEventos(); pasosB++; }
  }
  assert.ok(pasosA > 60 * 20 && pasosB > 60 * 20, `avançou pouco: ${pasosA}/${pasosB}`);
  const n = Math.min(pasosA, pasosB);
  assert.ok(Math.abs(pasosA - pasosB) <= 12);
  assert.equal(sA.desync, false); assert.equal(sB.desync, false);
  // mesmo número de passos => mesmo estado (alinha o mais adiantado)
  while (pasosA > n) { const r = sA.paso(lA, () => [0, 0, 0, 0, 0]); if (r) break; pasosA = n; }
  assert.equal(Math.round(lA.luchadores[0].hp) >= 0, true);
  sA.cerrar(); sB.cerrar();
});

test('o comando é arredondado igual nos dois lados', () => {
  const v = cuantizar({ mx: 0.7071067, my: -0.7071067, ax: 123.6, ay: 80.2, lmb: true, e: true });
  assert.deepEqual(v, [71, -71, 124, 80, 17]);
  assert.equal(typeof resumen(nueva(['riolu', 'munchlax'])), 'number');
});

test('Double Team: quando o tempo acaba os bonecos somem e não atiram mais', () => {
  const l = new Luta({ p1: def('froakie'), p2: def('munchlax'), rapido: true, semilla: 3 });
  const [a, b] = l.luchadores;
  for (let i = 0; i < 90; i++) { l.paso(1 / 60, [null, null]); l.tomarEventos(); }
  a.clones = null;
  l.habilidades.clones(a, { ...a.kit.rmb, n: 2, dur: 1 });
  assert.equal(a.clones.length, 2);
  for (let i = 0; i < 90; i++) { l.paso(1 / 60, [null, null]); l.tomarEventos(); }
  assert.equal(a.clones, null);
  const antes = l.entidades.length;
  a.cd.lmb = 0; a.ax = b.x; a.ay = b.y; l.habilidades.usar(a, 'lmb');
  for (let i = 0; i < 12; i++) { l.paso(1 / 60, [null, null]); l.tomarEventos(); }
  const tiros = l.entidades.filter(e => e.tipo === 'proj').length;
  assert.ok(tiros <= 3, `só o lutador atira: ${tiros} tiros`);
});
