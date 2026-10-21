// Dados escritos à mão: nomes em português, habilidades, itens, Megas e times sugeridos.
import { SPECIES, LEARNSETS, MOVES, TYPE_CHART } from './generated.js';

export { SPECIES, LEARNSETS, MOVES, TYPE_CHART };

export const BASE_SPECIES = [
  'venusaur', 'charizard', 'blastoise', 'weavile', 'steelix', 'gengar',
  'lucario', 'gardevoir', 'tyranitar', 'absol', 'manectric', 'altaria', 'alakazam', 'houndoom', 'gallade', 'aerodactyl', 'golisopod',
  'mewtwo', 'rayquaza', 'garchomp', 'gyarados', 'greninja', 'dragonite', 'blaziken', 'scizor', 'metagross', 'salamence',
  'lopunny', 'sableye', 'mawile', 'kangaskhan', 'latios', 'darkrai', 'zeraora', 'excadrill', 'skarmory', 'diancie',
];

export const TYPE_PT = {
  Normal: 'Normal', Fire: 'Fogo', Water: 'Água', Grass: 'Planta', Electric: 'Elétrico', Ice: 'Gelo',
  Fighting: 'Lutador', Poison: 'Venenoso', Ground: 'Terrestre', Flying: 'Voador', Psychic: 'Psíquico',
  Bug: 'Inseto', Rock: 'Pedra', Ghost: 'Fantasma', Dragon: 'Dragão', Dark: 'Sombrio', Steel: 'Aço', Fairy: 'Fada',
};

export const TYPE_COLOR = {
  Normal: '#a8a77a', Fire: '#ee8130', Water: '#6390f0', Grass: '#7ac74c', Electric: '#f7d02c', Ice: '#96d9d6',
  Fighting: '#c22e28', Poison: '#a33ea1', Ground: '#e2bf65', Flying: '#a98ff3', Psychic: '#f95587',
  Bug: '#a6b91a', Rock: '#b6a136', Ghost: '#735797', Dragon: '#6f35fc', Dark: '#705746', Steel: '#b7b7ce', Fairy: '#d685ad',
};

export const CAT_PT = { Physical: 'Físico', Special: 'Especial', Status: 'Status' };

export const STAT_PT = {
  hp: 'PS', atk: 'Ataque', def: 'Defesa', spa: 'Ataque Especial', spd: 'Defesa Especial', spe: 'Velocidade',
  accuracy: 'Precisão', evasion: 'Evasão',
};

export const STATUS_PT = {
  brn: 'queimado', par: 'paralisado', psn: 'envenenado', tox: 'gravemente envenenado', slp: 'dormindo', frz: 'congelado',
};
export const STATUS_TAG = { brn: 'QUE', par: 'PAR', psn: 'ENV', tox: 'ENV', slp: 'DOR', frz: 'CON' };
export const STATUS_COLOR = { brn: '#e8582e', par: '#d8b52a', psn: '#9b4fb0', tox: '#7a2c92', slp: '#8c8c9c', frz: '#59b9d6' };

export const WEATHER_PT = {
  sunnyday: 'Sol forte', raindance: 'Chuva', sandstorm: 'Tempestade de areia', hail: 'Granizo', snow: 'Neve',
  desolateland: 'Sol extremo', primordialsea: 'Chuva torrencial',
};

export const ABILITIES = {
  overgrow: { name: 'Overgrow', desc: 'Com 1/3 dos PS ou menos, golpes de Planta ficam 50% mais fortes.' },
  chlorophyll: { name: 'Chlorophyll', desc: 'No sol, a Velocidade dobra.' },
  blaze: { name: 'Blaze', desc: 'Com 1/3 dos PS ou menos, golpes de Fogo ficam 50% mais fortes.' },
  solarpower: { name: 'Solar Power', desc: 'No sol, Ataque Especial x1,5, mas perde 1/8 dos PS por turno.' },
  torrent: { name: 'Torrent', desc: 'Com 1/3 dos PS ou menos, golpes de Água ficam 50% mais fortes.' },
  raindish: { name: 'Rain Dish', desc: 'Na chuva, recupera 1/16 dos PS por turno.' },
  pressure: { name: 'Pressure', desc: 'Os golpes do adversário gastam mais stamina (o PP extra dos jogos).' },
  pickpocket: { name: 'Pickpocket', desc: 'Ao levar um golpe de contato sem estar segurando nada, rouba o item do atacante.' },
  thickfat: { name: 'Thick Fat', desc: 'Golpes de Fogo e Gelo causam metade do dano.' },
  toughclaws: { name: 'Tough Claws', desc: 'Golpes de contato ficam 30% mais fortes.' },
  drought: { name: 'Drought', desc: 'Ao entrar (ou Mega Evoluir), deixa o sol forte por 5 turnos.' },
  megalauncher: { name: 'Mega Launcher', desc: 'Golpes de pulso e aura (Water Pulse, Dark Pulse, Dragon Pulse, Aura Sphere) ficam 50% mais fortes.' },
  insomnia: { name: 'Insomnia', desc: 'Não consegue dormir.' },
  rockhead: { name: 'Rock Head', desc: 'Não recebe dano de recuo (Head Smash, Double-Edge, Take Down...).' },
  sturdy: { name: 'Sturdy', desc: 'Com PS cheios, aguenta qualquer golpe com 1 PS. Imune a golpes de nocaute instantâneo.' },
  sheerforce: { name: 'Sheer Force', desc: 'Golpes com efeito secundário ficam 30% mais fortes, mas perdem o efeito.' },
  sandforce: { name: 'Sand Force', desc: 'Na tempestade de areia, golpes de Pedra, Terrestre e Aço ficam 30% mais fortes. Não sofre dano da areia.' },
  cursedbody: { name: 'Cursed Body', desc: '30% de chance de desativar o golpe que o acertou.' },
  shadowtag: { name: 'Shadow Tag', desc: 'O adversário não consegue trocar de Pokémon.' },
  steadfast: { name: 'Steadfast', desc: 'Toda vez que recua, a Velocidade aumenta.' },
  innerfocus: { name: 'Inner Focus', desc: 'Nunca recua e não sente o Intimidate.' },
  justified: { name: 'Justified', desc: 'Levar um golpe Sombrio aumenta o Ataque.' },
  synchronize: { name: 'Synchronize', desc: 'Quem queimar, paralisar ou envenenar este Pokémon recebe o mesmo status.' },
  trace: { name: 'Trace', desc: 'Ao entrar, copia a habilidade do adversário.' },
  telepathy: { name: 'Telepathy', desc: 'Só desvia de golpes de aliados (não faz nada numa batalha 1 contra 1).' },
  sandstream: { name: 'Sand Stream', desc: 'Ao entrar (ou Mega Evoluir), começa uma tempestade de areia por 5 turnos.' },
  unnerve: { name: 'Unnerve', desc: 'O adversário fica nervoso e não consegue comer Berries.' },
  superluck: { name: 'Super Luck', desc: 'Aumenta a chance de acerto crítico.' },
  static: { name: 'Static', desc: 'Quem encostar com um golpe de contato tem 30% de chance de ficar paralisado.' },
  lightningrod: { name: 'Lightning Rod', desc: 'Atrai golpes Elétricos: fica imune a eles e o Ataque Especial aumenta.' },
  minus: { name: 'Minus', desc: 'Só funciona em dupla com Plus (não faz nada numa batalha 1 contra 1).' },
  naturalcure: { name: 'Natural Cure', desc: 'Sai de campo curado de qualquer status.' },
  cloudnine: { name: 'Cloud Nine', desc: 'Enquanto está em campo, ninguém sente os efeitos do clima.' },
  magicguard: { name: 'Magic Guard', desc: 'Só perde PS com golpes de ataque: nada de dano por clima, status, recuo, Life Orb ou armadilhas.' },
  earlybird: { name: 'Early Bird', desc: 'Acorda na metade do tempo.' },
  flashfire: { name: 'Flash Fire', desc: 'Imune a golpes de Fogo; ao ser acertado por um, os próprios golpes de Fogo ficam 50% mais fortes.' },
  sharpness: { name: 'Sharpness', desc: 'Golpes de corte (Leaf Blade, Sacred Sword, Night Slash...) ficam 50% mais fortes.' },
  emergencyexit: { name: 'Emergency Exit', desc: 'Quando os PS caem para menos da metade, foge da arena e chama outro Pokémon.' },
  adaptability: { name: 'Adaptability', desc: 'O bônus de golpes do mesmo tipo (STAB) vira x2 em vez de x1,5.' },
  pixilate: { name: 'Pixilate', desc: 'Golpes do tipo Normal viram Fada e ficam 20% mais fortes.' },
  magicbounce: { name: 'Magic Bounce', desc: 'Golpes de status como Toxic, Taunt e Stealth Rock voltam para quem usou.' },
  intimidate: { name: 'Intimidate', desc: 'Ao entrar (ou Mega Evoluir), o Ataque do adversário diminui.' },
  airlock: { name: 'Air Lock', desc: 'Enquanto está em campo, ninguém sente os efeitos do clima.' },
  deltastream: { name: 'Delta Stream', desc: 'Ventos fortes: golpes super eficazes contra o tipo Voador viram dano normal, e nenhum outro clima vale.' },
  cutecharm: { name: 'Cute Charm', desc: 'Quem encostar com um golpe de contato tem 30% de chance de ficar apaixonado (se for do gênero oposto).' },
  klutz: { name: 'Klutz', desc: 'O item segurado não faz efeito (a Mega Pedra continua funcionando).' },
  limber: { name: 'Limber', desc: 'Não pode ser paralisado.' },
  scrappy: { name: 'Scrappy', desc: 'Golpes Normais e Lutadores acertam o tipo Fantasma. Não sente o Intimidate.' },
  keeneye: { name: 'Keen Eye', desc: 'A precisão não pode ser diminuída e ignora a evasão do adversário.' },
  stall: { name: 'Stall', desc: 'Demora um pouco mais para soltar os golpes.' },
  prankster: { name: 'Prankster', desc: 'Golpes de status saem mais rápido, mas não afetam o tipo Sombrio.' },
  hypercutter: { name: 'Hyper Cutter', desc: 'O Ataque não pode ser diminuído pelo adversário.' },
  hugepower: { name: 'Huge Power', desc: 'O Ataque dobra.' },
  parentalbond: { name: 'Parental Bond', desc: 'Golpes de dano acertam duas vezes; a segunda pancada tem 1/4 da força.' },
  levitate: { name: 'Levitate', desc: 'Flutua: imune a golpes Terrestres, Spikes e terrenos.' },
  baddreams: { name: 'Bad Dreams', desc: 'O adversário dormindo perde 1/8 dos PS por turno.' },
  voltabsorb: { name: 'Volt Absorb', desc: 'Imune a golpes Elétricos: ao ser acertado por um, recupera 1/4 dos PS.' },
  sandrush: { name: 'Sand Rush', desc: 'Na tempestade de areia, a Velocidade dobra. Não sofre dano da areia.' },
  moldbreaker: { name: 'Mold Breaker', desc: 'Os golpes ignoram as habilidades do adversário (Levitate, Sturdy, Multiscale...).' },
  piercingdrill: { name: 'Piercing Drill', desc: 'Golpes de contato atravessam Protect e Detect, causando 1/4 do dano.' },
  weakarmor: { name: 'Weak Armor', desc: 'Ao levar golpe físico, a Defesa cai e a Velocidade sobe muito.' },
  stalwart: { name: 'Stalwart', desc: 'Os golpes não podem ser desviados para outro alvo (não muda nada no 1 contra 1).' },
  clearbody: { name: 'Clear Body', desc: 'Os atributos não podem ser diminuídos pelo adversário.' },
  sandveil: { name: 'Sand Veil', desc: 'Na tempestade de areia, os golpes do adversário erram mais. Não sofre dano da areia.' },
  roughskin: { name: 'Rough Skin', desc: 'Quem acertar um golpe de contato perde 1/8 dos PS.' },
  moxie: { name: 'Moxie', desc: 'Ao derrotar um Pokémon, o Ataque aumenta.' },
  protean: { name: 'Protean', desc: 'Vira do tipo do golpe que vai usar (uma vez por entrada em campo).' },
  battlebond: { name: 'Battle Bond', desc: 'Ao derrotar um Pokémon, Ataque, Ataque Especial e Velocidade aumentam. Uma vez por batalha.' },
  multiscale: { name: 'Multiscale', desc: 'Com PS cheios, recebe metade do dano.' },
  speedboost: { name: 'Speed Boost', desc: 'A Velocidade aumenta a cada turno em campo.' },
  swarm: { name: 'Swarm', desc: 'Com 1/3 dos PS ou menos, golpes de Inseto ficam 50% mais fortes.' },
  technician: { name: 'Technician', desc: 'Golpes com poder 60 ou menos ficam 50% mais fortes.' },
  lightmetal: { name: 'Light Metal', desc: 'Pesa a metade (Heavy Slam e Low Kick fazem menos dano nele).' },
  aerilate: { name: 'Aerilate', desc: 'Golpes do tipo Normal viram Voadores e ficam 20% mais fortes.' },
};

export const toId = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

// Itens. fling = poder do golpe Fling com esse item.
export const ITEMS = {
  none: { name: 'Nenhum', desc: 'Sem item.', fling: 0 },
  venusaurite: { name: 'Venusaurite', desc: 'Mega Pedra: Venusaur vira Mega Venusaur.', fling: 80, mega: { from: 'venusaur', to: 'venusaurmega' } },
  charizarditex: { name: 'Charizardite X', desc: 'Mega Pedra: Charizard vira Mega Charizard X.', fling: 80, mega: { from: 'charizard', to: 'charizardmegax' } },
  charizarditey: { name: 'Charizardite Y', desc: 'Mega Pedra: Charizard vira Mega Charizard Y.', fling: 80, mega: { from: 'charizard', to: 'charizardmegay' } },
  blastoisinite: { name: 'Blastoisinite', desc: 'Mega Pedra: Blastoise vira Mega Blastoise.', fling: 80, mega: { from: 'blastoise', to: 'blastoisemega' } },
  steelixite: { name: 'Steelixite', desc: 'Mega Pedra: Steelix vira Mega Steelix.', fling: 80, mega: { from: 'steelix', to: 'steelixmega' } },
  gengarite: { name: 'Gengarite', desc: 'Mega Pedra: Gengar vira Mega Gengar.', fling: 80, mega: { from: 'gengar', to: 'gengarmega' } },
  lucarionite: { name: 'Lucarionite', desc: 'Mega Pedra: Lucario vira Mega Lucario.', fling: 80, mega: { from: 'lucario', to: 'lucariomega' } },
  gardevoirite: { name: 'Gardevoirite', desc: 'Mega Pedra: Gardevoir vira Mega Gardevoir.', fling: 80, mega: { from: 'gardevoir', to: 'gardevoirmega' } },
  tyranitarite: { name: 'Tyranitarite', desc: 'Mega Pedra: Tyranitar vira Mega Tyranitar.', fling: 80, mega: { from: 'tyranitar', to: 'tyranitarmega' } },
  absolite: { name: 'Absolite', desc: 'Mega Pedra: Absol vira Mega Absol.', fling: 80, mega: { from: 'absol', to: 'absolmega' } },
  manectite: { name: 'Manectite', desc: 'Mega Pedra: Manectric vira Mega Manectric.', fling: 80, mega: { from: 'manectric', to: 'manectricmega' } },
  altarianite: { name: 'Altarianite', desc: 'Mega Pedra: Altaria vira Mega Altaria.', fling: 80, mega: { from: 'altaria', to: 'altariamega' } },
  alakazite: { name: 'Alakazite', desc: 'Mega Pedra: Alakazam vira Mega Alakazam.', fling: 80, mega: { from: 'alakazam', to: 'alakazammega' } },
  houndoominite: { name: 'Houndoominite', desc: 'Mega Pedra: Houndoom vira Mega Houndoom.', fling: 80, mega: { from: 'houndoom', to: 'houndoommega' } },
  galladite: { name: 'Galladite', desc: 'Mega Pedra: Gallade vira Mega Gallade.', fling: 80, mega: { from: 'gallade', to: 'gallademega' } },
  aerodactylite: { name: 'Aerodactylite', desc: 'Mega Pedra: Aerodactyl vira Mega Aerodactyl.', fling: 80, mega: { from: 'aerodactyl', to: 'aerodactylmega' } },
  golisopite: { name: 'Golisopite', desc: 'Mega Pedra: Golisopod vira Mega Golisopod.', fling: 80, mega: { from: 'golisopod', to: 'golisopodmega' } },
  mewtwonitex: { name: 'Mewtwonite X', desc: 'Mega Pedra: Mewtwo vira Mega Mewtwo X.', fling: 80, mega: { from: 'mewtwo', to: 'mewtwomegax' } },
  mewtwonitey: { name: 'Mewtwonite Y', desc: 'Mega Pedra: Mewtwo vira Mega Mewtwo Y.', fling: 80, mega: { from: 'mewtwo', to: 'mewtwomegay' } },
  meteorite: { name: 'Meteorito', desc: 'Rayquaza vira Mega Rayquaza (nos jogos ele precisa saber Dragon Ascent; aqui o Meteorito faz o papel).', fling: 80, mega: { from: 'rayquaza', to: 'rayquazamega' } },
  garchompite: { name: 'Garchompite', desc: 'Mega Pedra: Garchomp vira Mega Garchomp.', fling: 80, mega: { from: 'garchomp', to: 'garchompmega' } },
  garchompitez: { name: 'Garchompite Z', desc: 'Mega Pedra: Garchomp vira Mega Garchomp Z.', fling: 80, mega: { from: 'garchomp', to: 'garchompmegaz' } },
  gyaradosite: { name: 'Gyaradosite', desc: 'Mega Pedra: Gyarados vira Mega Gyarados.', fling: 80, mega: { from: 'gyarados', to: 'gyaradosmega' } },
  greninjite: { name: 'Greninjite', desc: 'Mega Pedra: Greninja vira Mega Greninja.', fling: 80, mega: { from: 'greninja', to: 'greninjamega' } },
  dragoninite: { name: 'Dragoninite', desc: 'Mega Pedra: Dragonite vira Mega Dragonite.', fling: 80, mega: { from: 'dragonite', to: 'dragonitemega' } },
  blazikenite: { name: 'Blazikenite', desc: 'Mega Pedra: Blaziken vira Mega Blaziken.', fling: 80, mega: { from: 'blaziken', to: 'blazikenmega' } },
  scizorite: { name: 'Scizorite', desc: 'Mega Pedra: Scizor vira Mega Scizor.', fling: 80, mega: { from: 'scizor', to: 'scizormega' } },
  metagrossite: { name: 'Metagrossite', desc: 'Mega Pedra: Metagross vira Mega Metagross.', fling: 80, mega: { from: 'metagross', to: 'metagrossmega' } },
  salamencite: { name: 'Salamencite', desc: 'Mega Pedra: Salamence vira Mega Salamence.', fling: 80, mega: { from: 'salamence', to: 'salamencemega' } },
  lopunnite: { name: 'Lopunnite', desc: 'Mega Pedra: Lopunny vira Mega Lopunny.', fling: 80, mega: { from: 'lopunny', to: 'lopunnymega' } },
  sablenite: { name: 'Sablenite', desc: 'Mega Pedra: Sableye vira Mega Sableye.', fling: 80, mega: { from: 'sableye', to: 'sableyemega' } },
  mawilite: { name: 'Mawilite', desc: 'Mega Pedra: Mawile vira Mega Mawile.', fling: 80, mega: { from: 'mawile', to: 'mawilemega' } },
  kangaskhanite: { name: 'Kangaskhanite', desc: 'Mega Pedra: Kangaskhan vira Mega Kangaskhan.', fling: 80, mega: { from: 'kangaskhan', to: 'kangaskhanmega' } },
  latiosite: { name: 'Latiosite', desc: 'Mega Pedra: Latios vira Mega Latios.', fling: 80, mega: { from: 'latios', to: 'latiosmega' } },
  darkranite: { name: 'Darkranite', desc: 'Mega Pedra: Darkrai vira Mega Darkrai.', fling: 80, mega: { from: 'darkrai', to: 'darkraimega' } },
  zeraorite: { name: 'Zeraorite', desc: 'Mega Pedra: Zeraora vira Mega Zeraora.', fling: 80, mega: { from: 'zeraora', to: 'zeraoramega' } },
  excadrite: { name: 'Excadrite', desc: 'Mega Pedra: Excadrill vira Mega Excadrill.', fling: 80, mega: { from: 'excadrill', to: 'excadrillmega' } },
  skarmorite: { name: 'Skarmorite', desc: 'Mega Pedra: Skarmory vira Mega Skarmory.', fling: 80, mega: { from: 'skarmory', to: 'skarmorymega' } },
  diancite: { name: 'Diancite', desc: 'Mega Pedra: Diancie vira Mega Diancie.', fling: 80, mega: { from: 'diancie', to: 'dianciemega' } },
  leftovers: { name: 'Leftovers', desc: 'Recupera 1/16 dos PS por turno.', fling: 10 },
  blacksludge: { name: 'Black Sludge', desc: 'Tipo Venenoso recupera 1/16 por turno; os outros perdem 1/8.', fling: 30 },
  sitrusberry: { name: 'Sitrus Berry', desc: 'Com metade dos PS ou menos, recupera 1/4. Uma vez.', fling: 10, berry: { type: 'Psychic', bp: 80 } },
  lumberry: { name: 'Lum Berry', desc: 'Cura qualquer status ou confusão. Uma vez.', fling: 10, berry: { type: 'Flying', bp: 80 } },
  lifeorb: { name: 'Life Orb', desc: 'Golpes de dano ficam 30% mais fortes, mas cada um tira 1/10 dos PS.', fling: 30 },
  choiceband: { name: 'Choice Band', desc: 'Ataque x1,5, mas só deixa usar o primeiro golpe escolhido até trocar.', fling: 10 },
  choicespecs: { name: 'Choice Specs', desc: 'Ataque Especial x1,5, mas só deixa usar o primeiro golpe escolhido até trocar.', fling: 10 },
  choicescarf: { name: 'Choice Scarf', desc: 'Velocidade x1,5, mas só deixa usar o primeiro golpe escolhido até trocar.', fling: 10 },
  focussash: { name: 'Focus Sash', desc: 'Com PS cheios, aguenta um golpe que nocautearia, ficando com 1 PS.', fling: 10 },
  expertbelt: { name: 'Expert Belt', desc: 'Golpes super eficazes ficam 20% mais fortes.', fling: 10 },
  muscleband: { name: 'Muscle Band', desc: 'Golpes físicos ficam 10% mais fortes.', fling: 10 },
  wiseglasses: { name: 'Wise Glasses', desc: 'Golpes especiais ficam 10% mais fortes.', fling: 10 },
  charcoal: { name: 'Charcoal', desc: 'Golpes de Fogo ficam 20% mais fortes.', fling: 30, boostType: 'Fire' },
  mysticwater: { name: 'Mystic Water', desc: 'Golpes de Água ficam 20% mais fortes.', fling: 30, boostType: 'Water' },
  miracleseed: { name: 'Miracle Seed', desc: 'Golpes de Planta ficam 20% mais fortes.', fling: 30, boostType: 'Grass' },
  nevermeltice: { name: 'Never-Melt Ice', desc: 'Golpes de Gelo ficam 20% mais fortes.', fling: 30, boostType: 'Ice' },
  blackglasses: { name: 'Black Glasses', desc: 'Golpes Sombrios ficam 20% mais fortes.', fling: 30, boostType: 'Dark' },
  sharpbeak: { name: 'Sharp Beak', desc: 'Golpes Voadores ficam 20% mais fortes.', fling: 50, boostType: 'Flying' },
  dragonfang: { name: 'Dragon Fang', desc: 'Golpes de Dragão ficam 20% mais fortes.', fling: 70, boostType: 'Dragon' },
  poisonbarb: { name: 'Poison Barb', desc: 'Golpes Venenosos ficam 20% mais fortes.', fling: 70, boostType: 'Poison' },
  heatrock: { name: 'Heat Rock', desc: 'O sol que este Pokémon cria dura 8 turnos.', fling: 60, weather: 'sunnyday' },
  damprock: { name: 'Damp Rock', desc: 'A chuva que este Pokémon cria dura 8 turnos.', fling: 60, weather: 'raindance' },
  icyrock: { name: 'Icy Rock', desc: 'Granizo/neve deste Pokémon duram 8 turnos.', fling: 40, weather: 'hail' },
  smoothrock: { name: 'Smooth Rock', desc: 'A tempestade de areia deste Pokémon dura 8 turnos.', fling: 10, weather: 'sandstorm' },
  lightclay: { name: 'Light Clay', desc: 'Reflect e Light Screen duram 8 turnos.', fling: 30 },
  powerherb: { name: 'Power Herb', desc: 'Pula a carga de um golpe de dois turnos. Uma vez.', fling: 10 },
  rockyhelmet: { name: 'Rocky Helmet', desc: 'Quem acertar um golpe de contato perde 1/6 dos PS.', fling: 60 },
  assaultvest: { name: 'Assault Vest', desc: 'Defesa Especial x1,5, mas não deixa usar golpes de status.', fling: 80 },
  brightpowder: { name: 'Bright Powder', desc: 'Os golpes do adversário erram mais (precisão x0,9).', fling: 10 },
  scopelens: { name: 'Scope Lens', desc: 'Aumenta a chance de acerto crítico.', fling: 30 },
  kingsrock: { name: "King's Rock", desc: 'Golpes de dano têm 10% de chance de fazer recuar.', fling: 30 },
  shellbell: { name: 'Shell Bell', desc: 'Recupera 1/8 do dano causado.', fling: 30 },
  bigroot: { name: 'Big Root', desc: 'Golpes de dreno, Leech Seed, Ingrain e Aqua Ring curam 30% a mais.', fling: 10 },
  bindingband: { name: 'Binding Band', desc: 'Golpes que prendem (Bind, Fire Spin, Whirlpool) tiram 1/6 por turno.', fling: 30 },
  gripclaw: { name: 'Grip Claw', desc: 'Golpes que prendem duram 7 turnos.', fling: 90 },
  whiteherb: { name: 'White Herb', desc: 'Desfaz atributos diminuídos. Uma vez.', fling: 10 },
  mentalherb: { name: 'Mental Herb', desc: 'Cura Taunt, Encore, Torment e paixão. Uma vez.', fling: 10 },
  weaknesspolicy: { name: 'Weakness Policy', desc: 'Ao levar golpe super eficaz: Ataque e Ataque Especial +2. Uma vez.', fling: 80 },
  airballoon: { name: 'Air Balloon', desc: 'Imune a golpes Terrestres até levar um golpe.', fling: 10 },
  quickclaw: { name: 'Quick Claw', desc: '20% de chance de soltar o golpe sem preparo.', fling: 80 },
  utilityumbrella: { name: 'Utility Umbrella', desc: 'Ignora os efeitos de sol e chuva.', fling: 60 },
  flameorb: { name: 'Flame Orb', desc: 'Queima o Pokémon depois de um turno em campo.', fling: 30 },
  toxicorb: { name: 'Toxic Orb', desc: 'Envenena gravemente o Pokémon depois de um turno em campo.', fling: 30 },
};

export const MEGA_STONE_FOR = {
  venusaur: ['venusaurite'], charizard: ['charizarditex', 'charizarditey'], blastoise: ['blastoisinite'], weavile: [], steelix: ['steelixite'],
  gengar: ['gengarite'], lucario: ['lucarionite'], gardevoir: ['gardevoirite'], tyranitar: ['tyranitarite'], absol: ['absolite'],
  manectric: ['manectite'], altaria: ['altarianite'], alakazam: ['alakazite'], houndoom: ['houndoominite'], gallade: ['galladite'],
  aerodactyl: ['aerodactylite'], golisopod: ['golisopite'],
  mewtwo: ['mewtwonitex', 'mewtwonitey'], rayquaza: ['meteorite'], garchomp: ['garchompite', 'garchompitez'], gyarados: ['gyaradosite'],
  greninja: ['greninjite'], dragonite: ['dragoninite'], blaziken: ['blazikenite'], scizor: ['scizorite'], metagross: ['metagrossite'],
  salamence: ['salamencite'], lopunny: ['lopunnite'], sableye: ['sablenite'], mawile: ['mawilite'], kangaskhan: ['kangaskhanite'],
  latios: ['latiosite'], darkrai: ['darkranite'], zeraora: ['zeraorite'], excadrill: ['excadrite'], skarmory: ['skarmorite'], diancie: ['diancite'],
};

// Raio do corpo na arena, altura do voo (Charizard paira) e escala do sprite.
// sheet: 'bw' = Mega sem sprite PMD: desenho 2D de frente e de costas (estilo Black/White), animado
// por partes em scripts/sprite-tools.mjs
export const BODY = {
  venusaur: { radius: 25, hover: 0, scale: 2 },
  venusaurmega: { radius: 29, hover: 0, scale: 2, sheet: 'bw' },
  charizard: { radius: 22, hover: 14, scale: 2 },
  charizardmegax: { radius: 24, hover: 14, scale: 2 },
  charizardmegay: { radius: 25, hover: 16, scale: 2, sheet: 'bw' },
  blastoise: { radius: 23, hover: 0, scale: 2 },
  blastoisemega: { radius: 27, hover: 0, scale: 2, sheet: 'bw' },
  weavile: { radius: 18, hover: 0, scale: 2 },
  steelix: { radius: 30, hover: 0, scale: 2 },
  steelixmega: { radius: 32, hover: 0, scale: 2 },
  gengar: { radius: 20, hover: 0, scale: 2 },
  gengarmega: { radius: 22, hover: 0, scale: 2 },
  lucario: { radius: 19, hover: 0, scale: 2 },
  lucariomega: { radius: 20, hover: 0, scale: 2 },
  gardevoir: { radius: 19, hover: 0, scale: 2 },
  gardevoirmega: { radius: 21, hover: 0, scale: 2 },
  tyranitar: { radius: 27, hover: 0, scale: 2 },
  tyranitarmega: { radius: 29, hover: 0, scale: 2 },
  absol: { radius: 20, hover: 0, scale: 2 },
  absolmega: { radius: 21, hover: 0, scale: 2 },
  manectric: { radius: 21, hover: 0, scale: 2 },
  manectricmega: { radius: 22, hover: 0, scale: 2 },
  altaria: { radius: 22, hover: 14, scale: 2 },
  altariamega: { radius: 24, hover: 14, scale: 2 },
  alakazam: { radius: 19, hover: 0, scale: 2 },
  alakazammega: { radius: 20, hover: 6, scale: 2 },
  houndoom: { radius: 21, hover: 0, scale: 2 },
  houndoommega: { radius: 22, hover: 0, scale: 2 },
  gallade: { radius: 20, hover: 0, scale: 2 },
  gallademega: { radius: 21, hover: 0, scale: 2 },
  aerodactyl: { radius: 24, hover: 16, scale: 2 },
  aerodactylmega: { radius: 26, hover: 16, scale: 2 },
  golisopod: { radius: 25, hover: 0, scale: 2 },
  golisopodmega: { radius: 28, hover: 0, scale: 2, sheet: 'bw' },
  mewtwo: { radius: 21, hover: 0, scale: 2 },
  mewtwomegax: { radius: 21, hover: 0, scale: 2, sheet: 'bw' },
  mewtwomegay: { radius: 20, hover: 8, scale: 2 },
  rayquaza: { radius: 30, hover: 18, scale: 2 },
  rayquazamega: { radius: 32, hover: 18, scale: 2 },
  garchomp: { radius: 24, hover: 0, scale: 2 },
  garchompmega: { radius: 26, hover: 0, scale: 2, sheet: 'bw' },
  garchompmegaz: { radius: 25, hover: 0, scale: 2, sheet: 'bw' },
  gyarados: { radius: 30, hover: 8, scale: 2 },
  gyaradosmega: { radius: 32, hover: 8, scale: 2, sheet: 'bw' },
  greninja: { radius: 19, hover: 0, scale: 2 },
  greninjamega: { radius: 20, hover: 0, scale: 2, sheet: 'bw' },
  dragonite: { radius: 25, hover: 12, scale: 2 },
  dragonitemega: { radius: 26, hover: 12, scale: 2, sheet: 'bw' },
  blaziken: { radius: 20, hover: 0, scale: 2 },
  blazikenmega: { radius: 21, hover: 0, scale: 2, sheet: 'bw' },
  scizor: { radius: 21, hover: 0, scale: 2 },
  scizormega: { radius: 22, hover: 0, scale: 2, sheet: 'bw' },
  metagross: { radius: 28, hover: 6, scale: 2 },
  metagrossmega: { radius: 30, hover: 10, scale: 2, sheet: 'bw' },
  salamence: { radius: 26, hover: 14, scale: 2 },
  salamencemega: { radius: 27, hover: 16, scale: 2, sheet: 'bw' },
  lopunny: { radius: 18, hover: 0, scale: 2 },
  lopunnymega: { radius: 19, hover: 0, scale: 2 },
  sableye: { radius: 16, hover: 0, scale: 2 },
  sableyemega: { radius: 19, hover: 0, scale: 2 },
  mawile: { radius: 17, hover: 0, scale: 2 },
  mawilemega: { radius: 19, hover: 0, scale: 2 },
  kangaskhan: { radius: 25, hover: 0, scale: 2 },
  kangaskhanmega: { radius: 26, hover: 0, scale: 2 },
  latios: { radius: 22, hover: 14, scale: 2 },
  latiosmega: { radius: 24, hover: 14, scale: 2 },
  darkrai: { radius: 20, hover: 10, scale: 2 },
  darkraimega: { radius: 22, hover: 10, scale: 2 },
  zeraora: { radius: 19, hover: 0, scale: 2 },
  zeraoramega: { radius: 20, hover: 0, scale: 2 },
  excadrill: { radius: 21, hover: 0, scale: 2 },
  excadrillmega: { radius: 23, hover: 0, scale: 2 },
  skarmory: { radius: 23, hover: 12, scale: 2 },
  skarmorymega: { radius: 25, hover: 12, scale: 2 },
  diancie: { radius: 18, hover: 4, scale: 2 },
  dianciemega: { radius: 20, hover: 6, scale: 2 },
};

export const HIDDEN_POWER_TYPES = ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel'];

// Times sugeridos para começar a jogar rápido
export const PRESETS = {
  venusaur: [
    { name: 'Mega Sol', ability: 'chlorophyll', item: 'venusaurite', moves: ['solarbeam', 'sludgebomb', 'sunnyday', 'synthesis'] },
    { name: 'Tanque', ability: 'overgrow', item: 'leftovers', moves: ['gigadrain', 'leechseed', 'sleeppowder', 'earthquake'] },
  ],
  charizard: [
    { name: 'Mega Y', ability: 'blaze', item: 'charizarditey', moves: ['flamethrower', 'solarbeam', 'airslash', 'focusblast'] },
    { name: 'Mega X', ability: 'blaze', item: 'charizarditex', moves: ['flareblitz', 'dragonclaw', 'dragondance', 'earthquake'] },
  ],
  blastoise: [
    { name: 'Mega Canhão', ability: 'torrent', item: 'blastoisinite', moves: ['hydropump', 'waterpulse', 'darkpulse', 'aurasphere'] },
    { name: 'Chuva', ability: 'raindish', item: 'leftovers', moves: ['raindance', 'scald', 'icebeam', 'protect'] },
  ],
  weavile: [
    { name: 'Lâmina', ability: 'pickpocket', item: 'lifeorb', moves: ['nightslash', 'icepunch', 'iceshard', 'swordsdance'] },
    { name: 'Raio Gélido', ability: 'pressure', item: 'nevermeltice', moves: ['iciclecrash', 'knockoff', 'fakeout', 'icebeam'] },
  ],
  steelix: [
    { name: 'Mega Muralha', ability: 'sturdy', item: 'steelixite', moves: ['heavyslam', 'earthquake', 'stoneedge', 'stealthrock'] },
    { name: 'Força Bruta', ability: 'sheerforce', item: 'lifeorb', moves: ['ironhead', 'earthquake', 'icefang', 'thunderfang'] },
  ],
  gengar: [
    { name: 'Mega Sombra', ability: 'cursedbody', item: 'gengarite', moves: ['shadowball', 'sludgebomb', 'focusblast', 'destinybond'] },
    { name: 'Pesadelo', ability: 'cursedbody', item: 'lifeorb', moves: ['hypnosis', 'dreameater', 'shadowball', 'thunderbolt'] },
  ],
  lucario: [
    { name: 'Mega Aura', ability: 'innerfocus', item: 'lucarionite', moves: ['aurasphere', 'flashcannon', 'nastyplot', 'vacuumwave'] },
    { name: 'Punhos', ability: 'justified', item: 'lifeorb', moves: ['closecombat', 'meteormash', 'extremespeed', 'swordsdance'] },
  ],
  gardevoir: [
    { name: 'Mega Fada', ability: 'trace', item: 'gardevoirite', moves: ['hypervoice', 'psyshock', 'calmmind', 'focusblast'] },
    { name: 'Desejo', ability: 'synchronize', item: 'leftovers', moves: ['moonblast', 'psychic', 'willowisp', 'wish'] },
  ],
  tyranitar: [
    { name: 'Mega Areia', ability: 'sandstream', item: 'tyranitarite', moves: ['stoneedge', 'crunch', 'dragondance', 'earthquake'] },
    { name: 'Muralha', ability: 'sandstream', item: 'leftovers', moves: ['stoneedge', 'crunch', 'stealthrock', 'fireblast'] },
  ],
  absol: [
    { name: 'Mega Desastre', ability: 'justified', item: 'absolite', moves: ['suckerpunch', 'knockoff', 'swordsdance', 'playrough'] },
    { name: 'Super Sorte', ability: 'superluck', item: 'scopelens', moves: ['nightslash', 'psychocut', 'suckerpunch', 'swordsdance'] },
  ],
  manectric: [
    { name: 'Mega Trovão', ability: 'lightningrod', item: 'manectite', moves: ['thunderbolt', 'flamethrower', 'voltswitch', 'snarl'] },
    { name: 'Tempestade', ability: 'static', item: 'lifeorb', moves: ['thunder', 'raindance', 'discharge', 'wildcharge'] },
  ],
  altaria: [
    { name: 'Mega Fada', ability: 'naturalcure', item: 'altarianite', moves: ['return', 'earthquake', 'dragondance', 'roost'] },
    { name: 'Nuvem', ability: 'naturalcure', item: 'leftovers', moves: ['dragonpulse', 'flamethrower', 'cottonguard', 'roost'] },
  ],
  alakazam: [
    { name: 'Mega Mente', ability: 'magicguard', item: 'alakazite', moves: ['psychic', 'shadowball', 'focusblast', 'calmmind'] },
    { name: 'Mágico', ability: 'magicguard', item: 'lifeorb', moves: ['psyshock', 'dazzlinggleam', 'energyball', 'recover'] },
  ],
  houndoom: [
    { name: 'Mega Inferno', ability: 'flashfire', item: 'houndoominite', moves: ['fireblast', 'darkpulse', 'nastyplot', 'sunnyday'] },
    { name: 'Caçador', ability: 'flashfire', item: 'lifeorb', moves: ['flamethrower', 'crunch', 'suckerpunch', 'willowisp'] },
  ],
  gallade: [
    { name: 'Mega Lâmina', ability: 'sharpness', item: 'galladite', moves: ['sacredsword', 'leafblade', 'psychocut', 'swordsdance'] },
    { name: 'Justiceiro', ability: 'justified', item: 'lifeorb', moves: ['closecombat', 'zenheadbutt', 'shadowsneak', 'knockoff'] },
  ],
  aerodactyl: [
    { name: 'Mega Fóssil', ability: 'rockhead', item: 'aerodactylite', moves: ['stoneedge', 'dualwingbeat', 'firefang', 'dragondance'] },
    { name: 'Vento', ability: 'unnerve', item: 'focussash', moves: ['rockslide', 'skyattack', 'tailwind', 'stealthrock'] },
  ],
  golisopod: [
    { name: 'Mega Armadura', ability: 'emergencyexit', item: 'golisopite', moves: ['firstimpression', 'liquidation', 'leechlife', 'swordsdance'] },
    { name: 'Ninja', ability: 'emergencyexit', item: 'leftovers', moves: ['razorshell', 'aquajet', 'spikes', 'knockoff'] },
  ],
  mewtwo: [
    { name: 'Mega Y', ability: 'pressure', item: 'mewtwonitey', moves: ['psystrike', 'aurasphere', 'icebeam', 'calmmind'] },
    { name: 'Mega X', ability: 'unnerve', item: 'mewtwonitex', moves: ['drainpunch', 'zenheadbutt', 'stoneedge', 'bulkup'] },
  ],
  rayquaza: [
    { name: 'Mega Céu', ability: 'airlock', item: 'meteorite', moves: ['dragonascent', 'extremespeed', 'earthquake', 'dragondance'] },
    { name: 'Meteoro', ability: 'airlock', item: 'lifeorb', moves: ['dracometeor', 'fireblast', 'thunderbolt', 'extremespeed'] },
  ],
  garchomp: [
    { name: 'Mega Areia', ability: 'roughskin', item: 'garchompite', moves: ['earthquake', 'dragonclaw', 'stoneedge', 'swordsdance'] },
    { name: 'Mega Z', ability: 'roughskin', item: 'garchompitez', moves: ['dracometeor', 'earthpower', 'fireblast', 'stealthrock'] },
  ],
  gyarados: [
    { name: 'Mega Fúria', ability: 'intimidate', item: 'gyaradosite', moves: ['waterfall', 'crunch', 'earthquake', 'dragondance'] },
    { name: 'Moxie', ability: 'moxie', item: 'lifeorb', moves: ['waterfall', 'bounce', 'icefang', 'dragondance'] },
  ],
  greninja: [
    { name: 'Mega Ninja', ability: 'protean', item: 'greninjite', moves: ['hydropump', 'darkpulse', 'icebeam', 'watershuriken'] },
    { name: 'Camaleão', ability: 'protean', item: 'lifeorb', moves: ['gunkshot', 'uturn', 'spikes', 'watershuriken'] },
  ],
  dragonite: [
    { name: 'Mega Dragão', ability: 'multiscale', item: 'dragoninite', moves: ['dracometeor', 'fireblast', 'thunderbolt', 'roost'] },
    { name: 'Dança', ability: 'multiscale', item: 'lumberry', moves: ['dragondance', 'extremespeed', 'earthquake', 'firepunch'] },
  ],
  blaziken: [
    { name: 'Mega Chama', ability: 'speedboost', item: 'blazikenite', moves: ['flareblitz', 'closecombat', 'thunderpunch', 'swordsdance'] },
    { name: 'Turbo', ability: 'speedboost', item: 'lifeorb', moves: ['overheat', 'focusblast', 'vacuumwave', 'protect'] },
  ],
  scizor: [
    { name: 'Mega Pinça', ability: 'technician', item: 'scizorite', moves: ['bulletpunch', 'uturn', 'knockoff', 'swordsdance'] },
    { name: 'Tanque', ability: 'technician', item: 'leftovers', moves: ['bulletpunch', 'superpower', 'roost', 'swordsdance'] },
  ],
  metagross: [
    { name: 'Mega Cometa', ability: 'clearbody', item: 'metagrossite', moves: ['meteormash', 'zenheadbutt', 'icepunch', 'bulletpunch'] },
    { name: 'Agilidade', ability: 'clearbody', item: 'lifeorb', moves: ['meteormash', 'earthquake', 'hammerarm', 'agility'] },
  ],
  salamence: [
    { name: 'Mega Asas', ability: 'intimidate', item: 'salamencite', moves: ['return', 'earthquake', 'dragondance', 'roost'] },
    { name: 'Moxie', ability: 'moxie', item: 'lifeorb', moves: ['dracometeor', 'fireblast', 'hydropump', 'roost'] },
  ],
  lopunny: [
    { name: 'Mega Chute', ability: 'limber', item: 'lopunnite', moves: ['fakeout', 'return', 'highjumpkick', 'icepunch'] },
    { name: 'Charme', ability: 'cutecharm', item: 'leftovers', moves: ['return', 'closecombat', 'healingwish', 'encore'] },
  ],
  sableye: [
    { name: 'Mega Espelho', ability: 'prankster', item: 'sablenite', moves: ['willowisp', 'recover', 'knockoff', 'foulplay'] },
    { name: 'Travesso', ability: 'prankster', item: 'leftovers', moves: ['shadowball', 'darkpulse', 'calmmind', 'recover'] },
  ],
  mawile: [
    { name: 'Mega Mandíbula', ability: 'intimidate', item: 'mawilite', moves: ['playrough', 'ironhead', 'suckerpunch', 'swordsdance'] },
    { name: 'Força Bruta', ability: 'sheerforce', item: 'lifeorb', moves: ['playrough', 'firefang', 'suckerpunch', 'stealthrock'] },
  ],
  kangaskhan: [
    { name: 'Mega Mãe e Filho', ability: 'scrappy', item: 'kangaskhanite', moves: ['fakeout', 'return', 'suckerpunch', 'earthquake'] },
    { name: 'Lutadora', ability: 'scrappy', item: 'lifeorb', moves: ['doubleedge', 'poweruppunch', 'suckerpunch', 'seismictoss'] },
  ],
  latios: [
    { name: 'Mega Jato', ability: 'levitate', item: 'latiosite', moves: ['dracometeor', 'psyshock', 'surf', 'roost'] },
    { name: 'Brilho', ability: 'levitate', item: 'lifeorb', moves: ['lusterpurge', 'dragonpulse', 'calmmind', 'recover'] },
  ],
  darkrai: [
    { name: 'Mega Pesadelo', ability: 'baddreams', item: 'darkranite', moves: ['darkpulse', 'sludgebomb', 'nastyplot', 'darkvoid'] },
    { name: 'Escuridão', ability: 'baddreams', item: 'lifeorb', moves: ['darkpulse', 'focusblast', 'icebeam', 'willowisp'] },
  ],
  zeraora: [
    { name: 'Mega Plasma', ability: 'voltabsorb', item: 'zeraorite', moves: ['plasmafists', 'closecombat', 'knockoff', 'bulkup'] },
    { name: 'Relâmpago', ability: 'voltabsorb', item: 'lifeorb', moves: ['voltswitch', 'grassknot', 'thunderbolt', 'focusblast'] },
  ],
  excadrill: [
    { name: 'Mega Broca', ability: 'moldbreaker', item: 'excadrite', moves: ['earthquake', 'ironhead', 'rapidspin', 'swordsdance'] },
    { name: 'Tempestade', ability: 'sandrush', item: 'lifeorb', moves: ['drillrun', 'rockslide', 'xscissor', 'stealthrock'] },
  ],
  skarmory: [
    { name: 'Mega Lâmina', ability: 'sturdy', item: 'skarmorite', moves: ['bravebird', 'ironhead', 'spikes', 'roost'] },
    { name: 'Muralha', ability: 'sturdy', item: 'leftovers', moves: ['bodypress', 'irondefense', 'roost', 'whirlwind'] },
  ],
  diancie: [
    { name: 'Mega Diamante', ability: 'clearbody', item: 'diancite', moves: ['diamondstorm', 'moonblast', 'earthpower', 'calmmind'] },
    { name: 'Joia', ability: 'clearbody', item: 'leftovers', moves: ['diamondstorm', 'playrough', 'stealthrock', 'protect'] },
  ],
};

export function speciesName(id) { return SPECIES[id]?.name || id; }
// 'Charizard-Mega-X' -> 'Mega Charizard X'
export function displayName(id) {
  const n = SPECIES[id]?.name || id;
  const m = n.match(/^(.*)-Mega(?:-([XYZ]))?$/);
  return m ? `Mega ${m[1]}${m[2] ? ' ' + m[2] : ''}` : n;
}
export function abilityId(name) { return toId(name); }
export function learnableMoves(speciesId) { return Object.keys(LEARNSETS[speciesId] || {}); }
export function megaStoneFor(item, speciesId) {
  const mega = ITEMS[item]?.mega;
  return mega && mega.from === speciesId ? mega.to : null;
}

export function effectiveness(moveType, defTypes) {
  let mult = 1;
  for (const t of defTypes) mult *= TYPE_CHART[moveType]?.[t] ?? 1;
  return mult;
}
