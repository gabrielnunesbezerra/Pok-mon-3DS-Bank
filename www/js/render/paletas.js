// Paletas dos efeitos: todo ataque usa só estas cores. Cada elemento tem 5 tons, do quase branco do centro ao escuro da
// borda: [núcleo, claro, base, sombra, borda]. As sombras puxam para o frio e as luzes para o quente, como em pixel art
// feita à mão; nenhuma cor é pura de código (255,0,0) e nenhum efeito faz degradê suave entre elas.
export const NUCLEO = 0, CLARO = 1, BASE = 2, SOMBRA = 3, BORDA = 4;

export const PALETAS = {
  NORMAL: ['#fbf8ea', '#dcd8b6', '#a8a77a', '#6f6a52', '#3c3830'],
  FIRE: ['#fff6c8', '#ffc04a', '#ee8130', '#b8401c', '#641818'],
  WATER: ['#eaf8ff', '#9fd2ff', '#6390f0', '#2f52b8', '#182a66'],
  ELECTRIC: ['#fffbe0', '#fff07a', '#f7d02c', '#c48a12', '#6a420c'],
  GRASS: ['#f2ffd8', '#b8ec7a', '#7ac74c', '#3e8a34', '#1c4a24'],
  ICE: ['#f2ffff', '#c8f4f2', '#96d9d6', '#4e9cb4', '#23506e'],
  FIGHTING: ['#fff0e0', '#f08a5a', '#c22e28', '#7e1620', '#420c16'],
  POISON: ['#fcecff', '#dc9ae0', '#a33ea1', '#652070', '#34103e'],
  GROUND: ['#fff6dc', '#f2dc9a', '#e2bf65', '#a4783a', '#5a3c1e'],
  FLYING: ['#f6f2ff', '#d2c4ff', '#a98ff3', '#6c58c0', '#362c6e'],
  PSYCHIC: ['#fff0f6', '#ffb0cc', '#f95587', '#b42a64', '#621636'],
  BUG: ['#f8ffd8', '#d6e468', '#a6b91a', '#667c12', '#34440c'],
  ROCK: ['#fbf4dc', '#dccc86', '#b6a136', '#7a6626', '#413418'],
  GHOST: ['#f2eaff', '#b8a2dc', '#735797', '#46316a', '#22183a'],
  DRAGON: ['#f0eaff', '#b49cff', '#6f35fc', '#4018b0', '#1e0c5e'],
  DARK: ['#eee6e0', '#a8968a', '#705746', '#46342a', '#221814'],
  STEEL: ['#fafbff', '#dcdcea', '#b7b7ce', '#7a7a96', '#3e3e52'],
  FAIRY: ['#fff2fa', '#f2c0dc', '#d685ad', '#9a4a7a', '#562840'],
};

// paletas que não são de um tipo: o clarão do acerto, cura, escudo e fumaça
export const IMPACTO = ['#fffdf4', '#fff0b8', '#ffd060', '#d08a30', '#6a3e18'];
export const CURA = ['#f0fff0', '#b6f5be', '#5cd86a', '#2a8a44', '#12482a'];
export const ESCUDO = ['#f0fbff', '#b8e8ff', '#6cc0f0', '#2e78c0', '#143c6a'];
export const FUMACA = ['#eceaf2', '#b8b4c6', '#86829a', '#58546c', '#302c40'];
export const CONTORNO = '#04102c';
// o "branco" dos efeitos: quase branco e levemente quente, nunca #ffffff
export const BRANCO = IMPACTO[NUCLEO];

export const pal = tipo => PALETAS[tipo] ?? PALETAS.NORMAL;
export const tom = (tipo, i) => pal(tipo)[Math.max(0, Math.min(4, i))];
// rampa de 4 tons no formato dos sprites de pixelfx: [sombra, base, luz, brilho]
export const rampa = tipo => { const p = pal(tipo); return [p[SOMBRA], p[BASE], p[CLARO], p[NUCLEO]]; };
// do claro ao escuro em 4 tons, no formato que os efeitos antigos usam: [núcleo, claro, base, sombra]
export const clara = tipo => pal(tipo).slice(0, 4);

// a paleta cuja cor base é esta (as cores de tipo que circulam pelos efeitos); null quando não é cor de tipo
const PORBASE = new Map();
export function deCor(c) {
  if (typeof c !== 'string') return null;
  if (!PORBASE.size) for (const [t, p] of Object.entries(PALETAS)) for (const x of p) if (!PORBASE.has(x)) PORBASE.set(x, p);
  return PORBASE.get(c.toLowerCase()) ?? null;
}

// um passo da paleta conforme a vida que já passou (0 recém-nascida, 1 morrendo): desce um tom de cada vez
export const passo = (p, inicio, k) => p[Math.min(p.length - 1, inicio + Math.floor(Math.max(0, Math.min(0.999, k)) * (p.length - inicio)))];
// transparência em degraus: inteira quase a vida toda, metade só no finalzinho (nada de sumir suave)
export const alfaDegrau = k => (k < 0.72 ? 1 : k < 0.9 ? 0.6 : 0.3);

export const RAMPA_FOGO = rampa('FIRE');
export const RAMPA_AGUA = rampa('WATER');
