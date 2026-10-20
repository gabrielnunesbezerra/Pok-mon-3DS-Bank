// Descrição dos golpes em português, montada a partir dos dados (com notas à mão para os especiais)
import { MOVES, STAT_PT, TYPE_PT, CAT_PT } from './dex.js';

const STATUS_VERB = {
  brn: 'queimar', par: 'paralisar', psn: 'envenenar', tox: 'envenenar gravemente', slp: 'fazer dormir', frz: 'congelar',
};
const STATUS_3P = {
  brn: 'Queima', par: 'Paralisa', psn: 'Envenena', tox: 'Envenena gravemente', slp: 'Faz dormir', frz: 'Congela',
};
const STAT_SHORT = { atk: 'Ataque', def: 'Defesa', spa: 'Ataque Especial', spd: 'Defesa Especial', spe: 'Velocidade', accuracy: 'Precisão', evasion: 'Evasão' };

function boostsText(boosts) {
  const up = [], down = [];
  for (const [k, v] of Object.entries(boosts)) (v > 0 ? up : down).push(`${STAT_SHORT[k]} ${v > 0 ? '+' : ''}${v}`);
  return [...up, ...down].join(', ');
}

// Notas para golpes que os dados sozinhos não explicam
export const NOTES = {
  solarbeam: 'Carrega antes de disparar; no sol sai na hora. Na chuva, areia ou neve o poder cai pela metade.',
  skullbash: 'Carrega (Defesa +1) e depois avança com tudo.',
  razorwind: 'Carrega e depois solta lâminas de vento.',
  focuspunch: 'Concentra antes de socar. Se levar dano na concentração, falha.',
  fly: 'Voa (fica invulnerável) e mergulha onde o alvo estava. Hurricane, Twister e Smack Down acertam quem está no ar.',
  dig: 'Some debaixo da terra e sai onde o alvo estava. Earthquake acerta em dobro quem está cavando.',
  dive: 'Mergulha e sai onde o alvo estava. Surf e Whirlpool acertam em dobro quem está mergulhado.',
  skydrop: 'Agarra o alvo, leva para o céu e solta. Não causa dano em tipo Voador.',
  hyperbeam: 'Depois de acertar, o usuário fica parado recarregando.',
  gigaimpact: 'Depois de acertar, o usuário fica parado recarregando.',
  blastburn: 'Explosão enorme. Depois de acertar, o usuário fica parado recarregando.',
  hydrocannon: 'Depois de acertar, o usuário fica parado recarregando.',
  frenzyplant: 'Depois de acertar, o usuário fica parado recarregando.',
  outrage: 'Ataca 2 ou 3 vezes seguidas sozinho e depois fica confuso.',
  petaldance: 'Ataca 2 ou 3 vezes seguidas sozinho e depois fica confuso.',
  rollout: 'Sai rolando por alguns segundos (dá para guiar); cada acerto dobra o poder. Defense Curl antes dobra de novo.',
  furycutter: 'Cada acerto seguido dobra o poder (até 160).',
  echoedvoice: 'Usado em seguida fica mais forte (até 200).',
  counter: 'Postura de contra-ataque: devolve em dobro o próximo golpe físico recebido.',
  mirrorcoat: 'Postura de contra-ataque: devolve em dobro o próximo golpe especial recebido.',
  bide: 'Aguenta os golpes por um tempo e devolve o dobro do dano.',
  protect: 'Bloqueia quase tudo por um instante. Usar em seguida tem chance de falhar.',
  detect: 'Bloqueia quase tudo por um instante. Usar em seguida tem chance de falhar.',
  endure: 'Aguenta qualquer golpe com 1 PS por um instante.',
  substitute: 'Gasta 1/4 dos PS para criar um boneco que recebe os golpes.',
  rest: 'Recupera tudo e dorme por 2 turnos.',
  synthesis: 'Recupera metade dos PS; 2/3 no sol e 1/4 em outros climas.',
  roost: 'Recupera metade dos PS e perde o tipo Voador por um turno.',
  weatherball: 'Vira Fogo, Água, Pedra ou Gelo conforme o clima, com poder dobrado.',
  growth: 'Ataque e Ataque Especial +1 (+2 no sol).',
  curse: 'Velocidade -1, Ataque +1 e Defesa +1.',
  bellydrum: 'Gasta metade dos PS para deixar o Ataque no máximo.',
  batonpass: 'Troca de Pokémon passando as mudanças de atributo e o substituto.',
  flipturn: 'Depois de acertar, troca de Pokémon.',
  roar: 'Obriga o adversário a trocar de Pokémon.',
  dragontail: 'Obriga o adversário a trocar de Pokémon.',
  fakeout: 'Só funciona logo depois de entrar em campo.',
  upperhand: 'Só funciona se o alvo estiver preparando um golpe de prioridade.',
  feint: 'Atravessa e quebra o Protect.',
  pursuit: 'Poder dobrado contra quem está saindo de campo.',
  avalanche: 'Poder dobrado se o usuário acabou de levar dano do alvo.',
  revenge: 'Poder dobrado se o usuário acabou de levar dano do alvo.',
  assurance: 'Poder dobrado se o alvo acabou de levar dano.',
  payback: 'Poder dobrado se o alvo atacou logo antes.',
  retaliate: 'Poder dobrado se um aliado desmaiou há pouco.',
  lashout: 'Poder dobrado se um atributo do usuário caiu há pouco.',
  temperflare: 'Poder dobrado se o último golpe do usuário falhou.',
  stompingtantrum: 'Poder dobrado se o último golpe do usuário falhou.',
  facade: 'Poder dobrado se o usuário está queimado, envenenado ou paralisado (a queimadura não enfraquece).',
  brine: 'Poder dobrado se o alvo está com metade dos PS ou menos.',
  venoshock: 'Poder dobrado se o alvo está envenenado.',
  acrobatics: 'Poder dobrado se o usuário não está segurando item.',
  knockoff: 'Derruba o item do alvo (e fica mais forte se ele tiver um).',
  thief: 'Rouba o item do alvo se o usuário não tiver nenhum.',
  fling: 'Arremessa o item que está segurando; o poder depende do item.',
  naturalgift: 'Usa a berry que está segurando; o tipo e o poder dependem dela.',
  incinerate: 'Queima a berry do alvo.',
  flail: 'Quanto menos PS o usuário tem, mais forte.',
  reversal: 'Quanto menos PS o usuário tem, mais forte.',
  waterspout: 'Quanto mais PS o usuário tem, mais forte.',
  gyroball: 'Mais forte quanto mais lento o usuário for em relação ao alvo.',
  heatcrash: 'Mais forte quanto mais pesado o usuário for em relação ao alvo.',
  lowkick: 'Mais forte contra alvos pesados.',
  grassknot: 'Mais forte contra alvos pesados.',
  return: 'Mais forte com amizade alta (102 de poder com amizade máxima).',
  frustration: 'Mais forte com amizade baixa (102 de poder com amizade mínima).',
  punishment: 'Mais forte quanto mais o alvo aumentou os atributos.',
  beatup: 'Cada Pokémon saudável do time dá um golpe.',
  tripleaxel: 'Três chutes de 20, 40 e 60 de poder; cada um pode errar.',
  hiddenpower: 'O tipo é escolhido na montagem do time.',
  terrainpulse: 'Em campo com terreno, vira do tipo do terreno com poder dobrado.',
  secretpower: 'O efeito muda com a arena: Grama faz dormir, Água baixa o Ataque, Gelo congela.',
  naturepower: 'Vira outro golpe conforme a arena: Energy Ball, Hydro Pump ou Ice Beam.',
  metronome: 'Usa um golpe aleatório.',
  sleeptalk: 'Só funciona dormindo: usa um dos outros golpes ao acaso.',
  snore: 'Só funciona dormindo.',
  assist: 'Usa um golpe aleatório de outro Pokémon do time.',
  mimic: 'Copia o último golpe usado pelo alvo enquanto ficar em campo.',
  snatch: 'Rouba o efeito do próximo golpe de status que o adversário usar em si mesmo.',
  psychup: 'Copia as mudanças de atributo do alvo.',
  spite: 'Faz o último golpe do alvo recarregar e tira stamina dele.',
  haze: 'Zera as mudanças de atributo de todo mundo.',
  defog: 'Evasão do alvo -1 e varre Reflect, Light Screen, Safeguard, Mist e terrenos.',
  brickbreak: 'Quebra Reflect e Light Screen.',
  rapidspin: 'Livra o usuário de Leech Seed e de golpes que prendem. Velocidade +1.',
  icespinner: 'Acaba com o terreno.',
  smackdown: 'Derruba o alvo no chão: golpes Terrestres passam a acertar tipo Voador.',
  dreameater: 'Só funciona em alvo dormindo. Recupera metade do dano.',
  nightmare: 'Alvo dormindo perde 1/4 dos PS por turno.',
  leechseed: 'Suga 1/8 dos PS do alvo por turno para quem estiver em campo do seu lado.',
  ingrain: 'Cria raízes: recupera PS por turno, mas fica mais lento e não pode trocar.',
  aquaring: 'Recupera 1/16 dos PS por turno.',
  helpinghand: 'Só funciona em batalha de dupla (aqui falha).',
  followme: 'Só funciona em batalha de dupla (aqui falha).',
  holdhands: 'Só funciona em batalha de dupla (aqui falha).',
  dragoncheer: 'Só funciona em batalha de dupla (aqui falha).',
  celebrate: 'Comemora. Não faz nada.',
  captivate: 'Ataque Especial do alvo -2, se for do gênero oposto.',
  attract: 'Apaixona o alvo do gênero oposto: ele pode deixar de atacar.',
  worryseed: 'Troca a habilidade do alvo para Insomnia.',
  yawn: 'O alvo dorme pouco depois.',
  taunt: 'O alvo não consegue usar golpes de status por 3 turnos.',
  torment: 'O alvo não consegue usar o mesmo golpe duas vezes seguidas.',
  encore: 'Prende o alvo no último golpe que ele usou por 3 turnos.',
  embargo: 'O alvo não pode usar itens por 5 turnos.',
  block: 'O alvo não pode mais trocar.',
  foresight: 'Ignora a evasão do alvo.',
  laserfocus: 'O próximo golpe é crítico.',
  tailwind: 'Velocidade do time dobrada por 4 turnos.',
  reflect: 'Dano físico pela metade por 5 turnos.',
  lightscreen: 'Dano especial pela metade por 5 turnos.',
  safeguard: 'Protege o time de status por 5 turnos.',
  mist: 'Impede que o adversário baixe seus atributos por 5 turnos.',
  mudsport: 'Golpes Elétricos ficam muito mais fracos por 5 turnos.',
  grassyterrain: 'Terreno de grama por 5 turnos: cura quem está no chão e fortalece golpes de Planta.',
  sunnyday: 'Sol forte por 5 turnos: Fogo +50%, Água -50%, Solar Beam sem carga.',
  raindance: 'Chuva por 5 turnos: Água +50%, Fogo -50%, Hurricane nunca erra.',
  sandstorm: 'Tempestade de areia por 5 turnos: machuca quem não é Pedra, Terrestre ou Aço.',
  hail: 'Granizo por 5 turnos: machuca quem não é Gelo; Blizzard nunca erra.',
  snowscape: 'Neve por 5 turnos: Defesa x1,5 para o tipo Gelo; Blizzard nunca erra.',
  fissure: 'Nocaute em um golpe só, mas acerta só 30% das vezes. Não pega quem está no ar.',
  seismictoss: 'Causa dano igual ao nível (50).',
  dragonrage: 'Sempre causa 40 de dano.',
  falseswipe: 'Sempre deixa o alvo com pelo menos 1 PS.',
  struggle: 'Usado quando nenhum golpe pode ser usado. Tira 1/4 dos PS do usuário.',
  bulldoze: 'Onda no chão: não pega quem está voando.',
  earthquake: 'Onda no chão: não pega quem está voando, acerta em dobro quem está cavando.',
  hurricane: 'Nunca erra na chuva; no sol a precisão cai para 50%.',
  blizzard: 'Nunca erra no granizo ou na neve.',
  toxic: 'Envenena gravemente o alvo (o dano cresce a cada turno). Nunca erra se o usuário for tipo Venenoso.',
  scald: 'Descongela o alvo.',
  scorchingsands: 'Descongela o alvo.',
  firespin: 'Prende o alvo num redemoinho de fogo por alguns turnos.',
  whirlpool: 'Prende o alvo num redemoinho de água por alguns turnos. Acerta em dobro quem está mergulhado.',
  bind: 'Prende o alvo por alguns turnos.',
  surf: 'Acerta em dobro quem está mergulhado.',
  twister: 'Acerta em dobro quem está voando.',
  rage: 'Enquanto continuar usando, o Ataque sobe quando leva golpes.',
  defensecurl: 'Defesa +1 e dobra o poder de Rollout.',
};

export function describeMove(id) {
  const m = MOVES[id];
  if (!m) return '';
  const parts = [];
  if (m.pri > 0) parts.push(`Prioridade +${m.pri}: sai quase na hora.`);
  if (m.pri < 0) parts.push(`Prioridade ${m.pri}: demora para sair.`);
  for (const s of m.sec || []) {
    const chance = s.chance ?? 100;
    const pre = chance >= 100 ? 'Sempre' : `${chance}% de chance de`;
    if (s.status) parts.push(chance >= 100 ? `${STATUS_3P[s.status]} o alvo.` : `${pre} ${STATUS_VERB[s.status]} o alvo.`);
    if (s.volatileStatus === 'flinch') parts.push(chance >= 100 ? 'Faz o alvo recuar.' : `${pre} fazer o alvo recuar.`);
    if (s.volatileStatus === 'confusion') parts.push(chance >= 100 ? 'Confunde o alvo.' : `${pre} confundir o alvo.`);
    if (s.boosts) parts.push(`${chance >= 100 ? 'Alvo:' : `${chance}% de chance, alvo:`} ${boostsText(s.boosts)}.`);
    if (s.self?.boosts) parts.push(`${chance >= 100 ? 'Usuário:' : `${chance}% de chance, usuário:`} ${boostsText(s.self.boosts)}.`);
  }
  if (m.cat === 'Status') {
    if (m.status && !NOTES[id]) parts.push(`Tenta ${STATUS_VERB[m.status]} o alvo.`);
    if (m.boosts && !NOTES[id]) parts.push(`${m.target === 'self' || m.target === 'allySide' || m.target === 'allies' ? 'Usuário' : 'Alvo'}: ${boostsText(m.boosts)}.`);
    if (m.vol === 'confusion' && !NOTES[id]) parts.push('Confunde o alvo.');
    if (m.heal && !NOTES[id]) parts.push(`Recupera ${Math.round((m.heal[0] / m.heal[1]) * 100)}% dos PS.`);
  }
  if (m.self?.boosts) parts.push(`Usuário: ${boostsText(m.self.boosts)}.`);
  if (m.selfBoost?.boosts) parts.push(`Depois dos acertos, usuário: ${boostsText(m.selfBoost.boosts)}.`);
  if (m.drain) parts.push(`Recupera ${Math.round((m.drain[0] / m.drain[1]) * 100)}% do dano causado.`);
  if (m.recoil) parts.push(`Recebe ${Math.round((m.recoil[0] / m.recoil[1]) * 100)}% do dano causado de volta.`);
  if (m.multihit && !NOTES[id]) parts.push(Array.isArray(m.multihit) ? `Acerta de ${m.multihit[0]} a ${m.multihit[1]} vezes.` : `Acerta ${m.multihit} vezes.`);
  if (m.crit > 1) parts.push('Chance alta de acerto crítico.');
  if (m.flags.includes('sound')) parts.push('Som: atravessa o substituto.');
  if (m.flags.includes('defrost')) parts.push('Descongela o usuário.');
  if (m.flags.includes('contact')) parts.push('Contato.');
  if (m.flags.includes('powder')) parts.push('Pó: não afeta tipo Planta.');
  if (NOTES[id]) parts.unshift(NOTES[id]);
  return parts.join(' ');
}

export function moveSummary(id) {
  const m = MOVES[id];
  return {
    name: m.name,
    type: m.type,
    typePt: TYPE_PT[m.type],
    cat: CAT_PT[m.cat],
    power: m.bp || '—',
    acc: m.acc === true ? '—' : `${m.acc}%`,
    desc: describeMove(id),
  };
}

export { STAT_PT };
