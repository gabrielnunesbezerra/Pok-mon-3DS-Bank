// Dados escritos à mão: nomes em português, habilidades, itens, Megas e times sugeridos.
import { SPECIES, LEARNSETS, MOVES, TYPE_CHART } from './generated.js';

export { SPECIES, LEARNSETS, MOVES, TYPE_CHART };

export const BASE_SPECIES = ['venusaur', 'charizard', 'blastoise', 'weavile'];

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
};

export const toId = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

// Itens. fling = poder do golpe Fling com esse item.
export const ITEMS = {
  none: { name: 'Nenhum', desc: 'Sem item.', fling: 0 },
  venusaurite: { name: 'Venusaurite', desc: 'Mega Pedra: Venusaur vira Mega Venusaur.', fling: 80, mega: { from: 'venusaur', to: 'venusaurmega' } },
  charizarditex: { name: 'Charizardite X', desc: 'Mega Pedra: Charizard vira Mega Charizard X.', fling: 80, mega: { from: 'charizard', to: 'charizardmegax' } },
  charizarditey: { name: 'Charizardite Y', desc: 'Mega Pedra: Charizard vira Mega Charizard Y.', fling: 80, mega: { from: 'charizard', to: 'charizardmegay' } },
  blastoisinite: { name: 'Blastoisinite', desc: 'Mega Pedra: Blastoise vira Mega Blastoise.', fling: 80, mega: { from: 'blastoise', to: 'blastoisemega' } },
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

export const MEGA_STONE_FOR = { venusaur: ['venusaurite'], charizard: ['charizarditex', 'charizarditey'], blastoise: ['blastoisinite'], weavile: [] };

// Raio do corpo na arena, altura do voo (Charizard paira) e escala do sprite
export const BODY = {
  venusaur: { radius: 25, hover: 0, scale: 2 },
  venusaurmega: { radius: 28, hover: 0, scale: 2.3, tint: [255, 120, 170], spriteFrom: 'venusaur' },
  charizard: { radius: 22, hover: 14, scale: 2 },
  charizardmegax: { radius: 24, hover: 14, scale: 2 },
  charizardmegay: { radius: 23, hover: 16, scale: 2.2, tint: [255, 200, 60], spriteFrom: 'charizard' },
  blastoise: { radius: 23, hover: 0, scale: 2 },
  blastoisemega: { radius: 26, hover: 0, scale: 2.25, tint: [80, 150, 255], spriteFrom: 'blastoise' },
  weavile: { radius: 18, hover: 0, scale: 2 },
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
};

export function speciesName(id) { return SPECIES[id]?.name || id; }
// 'Charizard-Mega-X' -> 'Mega Charizard X'
export function displayName(id) {
  const n = SPECIES[id]?.name || id;
  const m = n.match(/^(.*)-Mega(?:-([XY]))?$/);
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
