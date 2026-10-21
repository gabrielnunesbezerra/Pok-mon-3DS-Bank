// Dados do PK confront. Números e nomes vêm do Poké Arena 2D v0.47.2 (ver docs/referencia).
export const REGLAS = {
 "energiaInicial": 30,
 "energiaMax": 100,
 "energiaPorGolpeBasico": 6,
 "energiaPorGolpeRecibido": 3,
 "surgeUmbral": 80,
 "surgeMult": 1.3,
 "calorMax": 100,
 "calorEnfriaRetraso": 0.6,
 "calorEnfria": 20,
 "sobrecargaDur": 2,
 "comboVentana": 2.2,
 "comboBonusEnergia": 10,
 "invulDash": 0.25,
 "rondasParaGanar": 2,
 "tiempoRonda": 99,
 "tablaTipos": false,
 "superEficaz": 1.35,
 "pocoEficaz": 0.8,
 "marcaMult": 1.15,
 "ultiMax": 100,
 "ultiPorDanoHecho": 1.1,
 "ultiPorDanoRecibido": 0.75,
 "ultiPasiva": 0.9,
 "expEvolucion": [
  55,
  100
 ],
 "expPorDanoHecho": 1,
 "expPorDanoRecibido": 0.5,
 "expPasiva": 1,
 "curaEvolucion": 0.3,
 "expPorLinea": {
  "L3": [
   50,
   90
  ]
 },
 "expArrastre": true,
 "curaPerdida": {
  "L3": 0.6,
  "L2": 0.6,
  "LEG": 0.4,
  "PU": 0.4
 },
 "vidaGlobal": 1.8,
 "imanDisparo": 0.3,
 "imanGiro": 0.8,
 "imanCono": 0.8,
 "giroCarga": 8,
 "escalaPorEtapa": 0.12,
 "escalaMega": 0.06,
 "danoGlobal": 1.3,
 "basicosNeutros": true,
 "estadoGolpes": 3,
 "estadoVentana": 3,
 "estadoDur": 3,
 "congelaGolpes": 3,
 "congelaVentana": 10,
 "congelaDur": 1.2,
 "congelaReduce": 0.5,
 "curaTras": 4,
 "curaFuera": 1
};

export const ESTADOS_TIPO = {
 "FIRE": {
  "est": "quemado",
  "texto": "BURNED!",
  "hud": "BURN",
  "color": 16742938,
  "dps": 1.5,
  "dano": 0.7
 },
 "WATER": {
  "est": "empapado",
  "texto": "SOAKED!",
  "hud": "WET",
  "color": 6333946,
  "energia": 0.5,
  "quita": 20
 },
 "GRASS": {
  "est": "enredado",
  "texto": "TANGLED!",
  "hud": "ROOT",
  "color": 4906624,
  "vel": 0.7
 },
 "ELECTRIC": {
  "est": "paralizado",
  "texto": "PARALYZED!",
  "hud": "PAR",
  "color": 16436245,
  "ataque": 0.7
 },
 "CONFUSION": {
  "est": "confuso",
  "texto": "CONFUSED!",
  "color": 16752098,
  "dur": 1.1
 }
};

export const TIPOS = {"NORMAL":11052922,"FIRE":15630640,"WATER":6525168,"ELECTRIC":16240684,"GRASS":8046412,"ICE":9886166,"FIGHTING":12725800,"POISON":10698401,"GROUND":14860133,"FLYING":11112435,"PSYCHIC":16340359,"BUG":10926362,"ROCK":11968822,"GHOST":7559063,"DRAGON":7288316,"DARK":7362374,"STEEL":12040142,"FAIRY":14058925};

export const TABLA = {"NORMAL":{"ROCK":0.5,"STEEL":0.5,"GHOST":0},"GRASS":{"WATER":2,"GROUND":2,"ROCK":2,"FIRE":0.5,"GRASS":0.5,"POISON":0.5,"FLYING":0.5,"BUG":0.5,"DRAGON":0.5,"STEEL":0.5},"POISON":{"GRASS":2,"FAIRY":2,"POISON":0.5,"GROUND":0.5,"ROCK":0.5,"GHOST":0.5,"STEEL":0},"WATER":{"FIRE":2,"GROUND":2,"ROCK":2,"WATER":0.5,"GRASS":0.5,"DRAGON":0.5},"FIRE":{"GRASS":2,"ICE":2,"BUG":2,"STEEL":2,"FIRE":0.5,"WATER":0.5,"ROCK":0.5,"DRAGON":0.5},"ELECTRIC":{"WATER":2,"FLYING":2,"ELECTRIC":0.5,"GRASS":0.5,"DRAGON":0.5,"GROUND":0},"GHOST":{"GHOST":2,"PSYCHIC":2,"DARK":0.5,"NORMAL":0},"FAIRY":{"FIGHTING":2,"DRAGON":2,"DARK":2,"FIRE":0.5,"POISON":0.5,"STEEL":0.5},"DRAGON":{"DRAGON":2,"STEEL":0.5,"FAIRY":0},"GROUND":{"FIRE":2,"ELECTRIC":2,"POISON":2,"ROCK":2,"STEEL":2,"GRASS":0.5,"BUG":0.5,"FLYING":0},"FIGHTING":{"NORMAL":2,"ICE":2,"ROCK":2,"DARK":2,"STEEL":2,"POISON":0.5,"FLYING":0.5,"PSYCHIC":0.5,"BUG":0.5,"FAIRY":0.5,"GHOST":0},"STEEL":{"ICE":2,"ROCK":2,"FAIRY":2,"FIRE":0.5,"WATER":0.5,"ELECTRIC":0.5,"STEEL":0.5}};

// Com tablaTipos desligada (como no site), a eficácia de tipo não muda o dano.
export function efectividad(tipoAtaque, tiposDefensor) {
  if (!REGLAS.tablaTipos) return 1;
  let p = 1;
  for (const t of tiposDefensor) {
    const v = TABLA[tipoAtaque]?.[t] ?? 1;
    p *= v === 0 ? 0.5 : v;
  }
  if (p >= 2) return REGLAS.superEficaz;
  if (p <= 0.5) return REGLAS.pocoEficaz;
  return 1;
}
