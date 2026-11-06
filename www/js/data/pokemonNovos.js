// Linhas novas: Mawile, Skarmory e Tatsugiri (3 Power Ups e Mega) e Carvanha > Sharpedo (evolui, 2 Power Ups e Mega).
// Mesmo formato do ROSTER de pokemon.js; os kits das Megas ficam em megas.js (MEGA_KITS) e as formas das skills em
// engine/formasKits4.js. A ult destrava no 1º Power Up.

// moldes dos espaços comuns (o resto do objeto sobrescreve)
const tiro = (nombre, tipo, estilo, dano, o = {}) => ({ nombre, forma: 'proyectil', estilo, tipo, dano, vel: 300, alcance: 200, radio: 4, escala: 1.3, cd: 0.55, calor: 8, anim: 'Shoot', lanzar: 0.12, ...o });
const corte = (nombre, tipo, dano, o = {}) => ({ nombre, forma: 'tajo', tipo, dano, combo: 3, alcance: 48, angulo: 130, cd: 0.5, calor: 8, anim: 'Attack', lanzar: 0.1, avance: 10, ...o });
const dash = (nombre, tipo, o = {}) => ({ nombre, forma: 'dash', tipo, dano: 4, dist: 130, dur: 0.16, cd: 5, anim: 'Walk', estilo: 'rapido', ...o });
const skill = (nombre, forma, tipo, o = {}) => ({ nombre, forma, tipo, coste: 30, cd: 7, anim: 'Charge', ...o });
const semUlt = (nombre, forma, tipo, o = {}) => ({ nombre, forma, tipo, cd: 1, anim: 'Charge', sinUlti: true, ...o });
const ult = (nombre, forma, tipo, dano, o = {}) => ({ nombre, forma, tipo, dano, cd: 1, anim: 'Charge', sinUlti: false, ...o });

export const ROSTER_NOVOS = [
  // ------------------------------------------------------------ Mawile > 3 Power Ups > Mega Mawile
  { id: 'mawile', dex: '0303', nombre: 'MAWILE', tipos: ['STEEL', 'FAIRY'], rol: 'FISICO', lema: 'THE DECEIVER WITH STEEL JAWS', hp: 72, vel: 128, atk: 1.0, def: 0.98, regen: 4, expEvolucion: [45, 80, 115], ia: { rango: 60 },
    kit: {
      lmb: corte('Iron Head', 'STEEL', 4.4, { combo: 2, alcance: 46 }),
      rmb: skill('Sneaky Bite', 'boteMandibula', 'STEEL', { dano: 7, alcance: 56, angulo: 100, prende: 0.8, coste: 25, cd: 6, anim: 'Attack' }),
      esp: { nombre: 'Play Rough', forma: 'playRough', tipo: 'FAIRY', dano: 5, alcance: 130, aturde: 1, cd: 6, anim: 'Hop' },
      q: skill('Steel Spin', 'giroAco', 'STEEL', { dano: 8, radio: 60, cd: 8 }),
      e: semUlt('Voracious Bite', 'mordidaVoraz', 'STEEL', { dano: 20, alcance: 100, angulo: 90 }),
    },
    evoluciones: [
      { dex: '0303', nombre: 'MAWILE', hp: 80, vel: 130, atk: 1.06, def: 1.0, kit: { lmb: { dano: 4.8 }, rmb: { dano: 7.8 }, e: { dano: 22, sinUlti: false } } },
      { dex: '0303', nombre: 'MAWILE', hp: 88, vel: 131, atk: 1.12, def: 1.03, kit: { lmb: { dano: 5.2 }, rmb: { dano: 7.8 }, e: { dano: 24, sinUlti: false }, q: { dano: 9 } } },
      { dex: '0303', nombre: 'MAWILE', hp: 96, vel: 132, atk: 1.18, def: 1.06, escala: 1.06, kit: { lmb: { dano: 5.6 }, rmb: { dano: 8.6 }, e: { dano: 27, sinUlti: false }, q: { dano: 9 } },
        mega: { dex: '0303-0001', nombre: 'MEGA MAWILE', atk: 0.14, def: 0.06, vel: 2 } },
    ] },
  // ------------------------------------------------------------ Skarmory > 3 Power Ups > Mega Skarmory
  { id: 'skarmory', dex: '0227', nombre: 'SKARMORY', tipos: ['STEEL', 'FLYING'], rol: 'TANQUE', lema: 'RAZOR FEATHERED FORTRESS', hp: 80, vel: 128, atk: 0.92, def: 1.06, regen: 4, expEvolucion: [45, 80, 115], ia: { rango: 90 },
    kit: {
      lmb: corte('Steel Wing', 'STEEL', 4.2, { alcance: 52, angulo: 150 }),
      rmb: skill('Wind Blades', 'laminasVento', 'STEEL', { dano: 8, alcance: 210, coste: 25, cd: 6, anim: 'Shoot' }),
      esp: { nombre: 'Steel Crescent', forma: 'meiaLuaAco', tipo: 'STEEL', dano: 2, dist: 110, dur: 0.24, cd: 6, anim: 'Walk' },
      q: skill('Defensive Plumage', 'plumagem', 'STEEL', { dano: 6, dur: 1.5, radio: 80, cd: 10 }),
      e: semUlt('Steel Dive', 'mergulhoAco', 'STEEL', { dano: 20, alcance: 260, radio: 70 }),
    },
    evoluciones: [
      { dex: '0227', nombre: 'SKARMORY', hp: 88, vel: 130, atk: 0.98, def: 1.1, kit: { lmb: { dano: 4.6 }, rmb: { dano: 7.6 }, e: { dano: 22, sinUlti: false } } },
      { dex: '0227', nombre: 'SKARMORY', hp: 96, vel: 131, atk: 1.04, def: 1.13, kit: { lmb: { dano: 5 }, rmb: { dano: 7.6 }, e: { dano: 24, sinUlti: false }, q: { dur: 1.8 } } },
      { dex: '0227', nombre: 'SKARMORY', hp: 104, vel: 132, atk: 1.1, def: 1.16, escala: 1.06, kit: { lmb: { dano: 5.4 }, rmb: { dano: 8.4 }, e: { dano: 26, sinUlti: false }, q: { dur: 1.8 } },
        mega: { dex: '0227-0001', nombre: 'MEGA SKARMORY', atk: 0.1, def: 0.12, vel: 4 } },
    ] },
  // ------------------------------------------------------------ Carvanha > Sharpedo > 2 Power Ups > Mega Sharpedo
  { id: 'carvanha', dex: '0318', nombre: 'CARVANHA', tipos: ['WATER', 'DARK'], rol: 'FISICO', lema: 'BULLY OF THE SEA', hp: 60, vel: 146, atk: 1.04, def: 0.8, regen: 4, expEvolucion: [45, 80, 115], ia: { rango: 60 },
    kit: {
      lmb: corte('Bite', 'DARK', 4.4, { alcance: 46 }),
      rmb: skill('Fin Rip', 'rasgoBarbatana', 'WATER', { dano: 6, dist: 140, sangra: 2, coste: 25, cd: 6, anim: 'Walk' }),
      esp: dash('Aqua Jet', 'WATER', { dano: 4, dist: 150, estilo: 'agua' }),
      q: skill('Submerged Hunter', 'cacadorSubmerso', 'WATER', { dano: 8, dur: 1.5, cd: 10 }),
      e: semUlt('Predator Lunge', 'boteVoraz', 'DARK', { dano: 20, alcance: 170 }),
    },
    evoluciones: [
      { dex: '0319', nombre: 'SHARPEDO', hp: 76, vel: 154, atk: 1.14, def: 0.84, kit: { lmb: { nombre: 'Crunch', dano: 5 }, rmb: { dano: 7.4 }, q: { dano: 9.5 }, e: { dano: 23, sinUlti: false } } },
      { dex: '0319', nombre: 'SHARPEDO', hp: 82, vel: 157, atk: 1.2, def: 0.85, kit: { lmb: { nombre: 'Crunch', dano: 5.4 }, rmb: { dano: 7.4, sangra: 2.4 }, q: { dano: 9.5 }, e: { dano: 25, sinUlti: false } } },
      { dex: '0319', nombre: 'SHARPEDO', hp: 88, vel: 160, atk: 1.26, def: 0.86, escala: 1.08, kit: { lmb: { nombre: 'Crunch', dano: 5.8 }, rmb: { dano: 7.4, sangra: 2.4 }, q: { dano: 10.5 }, e: { dano: 28, sinUlti: false } },
        mega: { dex: '0319-0001', nombre: 'MEGA SHARPEDO', atk: 0.12, def: 0.04, vel: 8 } },
    ] },
  // ------------------------------------------------------------ Tatsugiri > 3 Power Ups > Mega Tatsugiri
  { id: 'tatsugiri', dex: '0978', nombre: 'TATSUGIRI', tipos: ['DRAGON', 'WATER'], rol: 'DISTANCIA', lema: 'THE TINY COMMANDER', hp: 60, vel: 140, atk: 1.0, def: 0.84, regen: 5, expEvolucion: [45, 80, 115], ia: { rango: 160 },
    kit: {
      lmb: tiro('Water Shuriken', 'WATER', 'cuchillaAgua', 4, { alcance: 200 }),
      rmb: skill('Flip Turn', 'flipTatsu', 'WATER', { dano: 8, alcance: 150, radio: 34, rebote: 90, coste: 25, cd: 6, anim: 'Hop' }),
      esp: { nombre: 'Slippery Slide', forma: 'deslize', tipo: 'WATER', dano: 3, dist: 140, cd: 5, anim: 'Walk' },
      q: skill('Dragon Scale', 'leque', 'DRAGON', { dano: 9, n: 3, abre: 0.5, segue: 4, lento: 0.3, lentoDur: 1.5, vel: 300, alcance: 230, visual: 'escamaDraco', cd: 6, coste: 25, anim: 'Shoot' }),
      e: semUlt('Torrent Turret', 'torretaAgua', 'WATER', { dano: 10, danoTiro: 2, alcance: 280, escudo: 16, dur: 4 }),
    },
    evoluciones: [
      { dex: '0978', nombre: 'TATSUGIRI', hp: 66, vel: 141, atk: 1.06, def: 0.86, kit: { lmb: { dano: 4.4 }, q: { dano: 9.8 }, e: { danoTiro: 2.2, sinUlti: false } } },
      { dex: '0978', nombre: 'TATSUGIRI', hp: 72, vel: 142, atk: 1.12, def: 0.88, kit: { lmb: { dano: 4.8 }, q: { dano: 9.8 }, e: { danoTiro: 2.4, sinUlti: false }, rmb: { cd: 5 } } },
      { dex: '0978', nombre: 'TATSUGIRI', hp: 78, vel: 143, atk: 1.18, def: 0.9, escala: 1.06, kit: { lmb: { dano: 5.2 }, q: { dano: 10.6 }, e: { danoTiro: 2.6, sinUlti: false }, rmb: { cd: 5 } },
        mega: { dex: '0978-0003', nombre: 'MEGA TATSUGIRI', atk: 0.12, def: 0.06, vel: 4 } },
    ] },
  // ------------------------------------------------------------ Snorunt > Glalie > Glalie (Power Up) > Mega Glalie
  { id: 'snorunt', dex: '0361', nombre: 'SNORUNT', tipos: ['ICE'], rol: 'TANQUE', lema: 'THE FACE OF THE BLIZZARD', hp: 70, vel: 124, atk: 0.94, def: 0.96, regen: 4, expEvolucion: [55, 100], ia: { rango: 120 },
    kit: {
      lmb: tiro('Powder Snow', 'ICE', 'bola', 4.2, { alcance: 180, escala: 1.4 }),
      rmb: tiro('Ice Spear', 'ICE', 'tri', 8, { vel: 400, alcance: 220, radio: 5, escala: 1.8, ralentiza: 0.2, ralentizaDur: 2, coste: 25, cd: 5, calor: 0 }),
      esp: dash('Ice Slide', 'ICE', { dano: 4, dist: 130, estilo: 'agua' }),
      q: skill('Cold Mist', 'pulso', 'ICE', { dano: 3, radio: 72, empuje: 10, debilita: { f: 0.85, dur: 3 }, cd: 9 }),
      e: semUlt('Cryo Nova', 'explosion', 'ICE', { dano: 22, radio: 92, carga: 0.5, empuje: 90, ralentiza: 0.7, ralentizaDur: 2 }),
    },
    evoluciones: [
      { dex: '0362', nombre: 'GLALIE', hp: 92, vel: 126, atk: 1.06, def: 1.04, kit: { lmb: { dano: 4.8 }, rmb: { nombre: 'Rolling Avalanche', estilo: 'bola', tipo: 'ICE', dano: 10, vel: 220, radio: 10, escala: 2.6, ralentiza: 0.3, ralentizaDur: 2 }, q: { nombre: 'Frost Breath', forma: 'viento', estilo: 'sonido', dano: 9, alcance: 130, angulo: 70, empuje: 30, debilita: { f: 0.8, dur: 3 }, cd: 8 }, e: { dano: 24, sinUlti: false } } },
      { dex: '0362', nombre: 'GLALIE', hp: 106, vel: 128, atk: 1.14, def: 1.08, escala: 1.1, kit: { lmb: { dano: 5.2 }, rmb: { nombre: 'Rolling Avalanche', estilo: 'bola', tipo: 'ICE', dano: 11.5, vel: 220, radio: 10, escala: 2.6, ralentiza: 0.3, ralentizaDur: 2 }, q: { nombre: 'Frost Breath', forma: 'viento', estilo: 'sonido', dano: 10, alcance: 140, angulo: 70, empuje: 30, debilita: { f: 0.8, dur: 3 }, cd: 8 }, e: { dano: 27, sinUlti: false } },
        mega: { dex: '0362-0001', nombre: 'MEGA GLALIE', atk: 0.14, def: 0.05, vel: 6 } },
    ] },
  // ------------------------------------------------------------ Ralts > Kirlia > Gardevoir > Mega Gardevoir
  { id: 'ralts', dex: '0280', nombre: 'RALTS', tipos: ['PSYCHIC', 'FAIRY'], rol: 'CONTROL', lema: 'MISTRESS OF SPACE', hp: 56, vel: 136, atk: 1.0, def: 0.8, regen: 5, expEvolucion: [55, 100], ia: { rango: 160 },
    kit: {
      lmb: tiro('Disarming Voice', 'FAIRY', 'brisaHada', 4.4, { alcance: 190 }),
      rmb: tiro('Telepathic Pulse', 'PSYCHIC', 'psiOnda', 8, { vel: 420, alcance: 230, radio: 5, escala: 1.8, ralentiza: 0.2, ralentizaDur: 2, coste: 25, cd: 5, calor: 0 }),
      esp: dash('Teleport', 'PSYCHIC', { dano: 0, teleport: true, dist: 115, dur: 0.12, cd: 8, anim: 'Idle', estilo: 'teleport' }),
      q: skill('Ephemeral Leap', 'auraVeloz', 'FAIRY', { dur: 3, vel: 1.3, radio: 110, coste: 20, cd: 10 }),
      e: semUlt('Dazzling Gleam', 'pulso', 'FAIRY', { dano: 16, radio: 70, empuje: 60 }),
    },
    evoluciones: [
      { dex: '0281', nombre: 'KIRLIA', hp: 68, vel: 140, atk: 1.1, def: 0.84, kit: { lmb: { dano: 4.8 }, rmb: { nombre: 'Bewitched Orb', estilo: 'brisaHada', tipo: 'FAIRY', dano: 10, vel: 260, radio: 7, escala: 2, ralentiza: 0, explosion: { radio: 38 } }, q: { nombre: 'Dimensional Waltz', forma: 'valsaEscudo', absorbe: 16, dur: 3, radio: 110, cd: 10 } } },
      { dex: '0282', nombre: 'GARDEVOIR', hp: 82, vel: 142, atk: 1.24, def: 0.88, escala: 1.06,
        kit: { lmb: { nombre: 'Moonblast Shard', dano: 5.2 }, rmb: { nombre: 'Psychic Distortion', forma: 'distorcao', tipo: 'PSYCHIC', dano: 11, alcance: 220, radio: 40, carga: 0.35, prendeDur: 1, cd: 6 }, q: { nombre: 'Astral Sanctuary', forma: 'santuario', radio: 70, dur: 4, cura: 0.02, reduce: 0.25, cd: 13 }, e: ult('Dark Singularity', 'singularidade', 'PSYCHIC', 26, { alcance: 240, radio: 70, dur: 1.4 }) },
        mega: { dex: '0282-0001', nombre: 'MEGA GARDEVOIR', atk: 0.14, def: 0.04, vel: 6 } },
    ] },
  // ------------------------------------------------------------ Absol > 3 Power Ups > Mega Absol
  { id: 'absol', dex: '0359', nombre: 'ABSOL', tipos: ['DARK'], rol: 'FISICO', lema: 'HERALD OF DISASTER', hp: 68, vel: 146, atk: 1.04, def: 0.86, regen: 4, expEvolucion: [45, 80, 115], ia: { rango: 66 },
    kit: {
      lmb: corte('Night Slash', 'DARK', 4.4, { alcance: 52, angulo: 140 }),
      rmb: skill('Calamity Claw', 'garraCalamidade', 'DARK', { dano: 9, alcance: 200, crit: 0.2, coste: 25, cd: 5, anim: 'Attack' }),
      esp: dash('Sucker Punch', 'DARK', { dano: 4, dist: 140, estilo: 'golpe' }),
      q: skill('Dark Omen', 'presagio', 'DARK', { dano: 4, dur: 1, coste: 20, cd: 9 }),
      e: semUlt('Doom Storm', 'tempestadePerdicao', 'DARK', { dano: 22, alcance: 180, anim: 'Attack' }),
    },
    evoluciones: [
      { dex: '0359', nombre: 'ABSOL', hp: 76, vel: 148, atk: 1.1, def: 0.88, kit: { lmb: { dano: 4.8 }, rmb: { dano: 9.8 }, e: { dano: 24, sinUlti: false } } },
      { dex: '0359', nombre: 'ABSOL', hp: 84, vel: 150, atk: 1.16, def: 0.9, kit: { lmb: { dano: 5.2 }, rmb: { dano: 10.4 }, q: { dano: 5 }, e: { dano: 26, sinUlti: false } } },
      { dex: '0359', nombre: 'ABSOL', hp: 92, vel: 152, atk: 1.22, def: 0.93, escala: 1.06, kit: { lmb: { dano: 5.6 }, rmb: { dano: 11 }, q: { dano: 6 }, e: { dano: 28, sinUlti: false } },
        mega: { dex: '0359-0001', nombre: 'MEGA ABSOL', atk: 0.14, def: 0.03, vel: 10 } },
    ] },
  // ------------------------------------------------------------ Roggenrola > Boldore > Gigalith > Mega Gigalith
  { id: 'roggenrola', dex: '0524', nombre: 'ROGGENROLA', tipos: ['ROCK'], rol: 'TANQUE', lema: 'CRYSTAL CORE ARTILLERY', hp: 74, vel: 112, atk: 0.94, def: 1.06, regen: 4, expEvolucion: [55, 100], ia: { rango: 130 },
    kit: {
      lmb: tiro('Rock Blast', 'ROCK', 'guijarro', 4.4, { alcance: 190 }),
      rmb: skill('Stone Cannon', 'leque', 'ROCK', { dano: 9, n: 3, abre: 0.45, vel: 360, alcance: 210, lento: 0.25, lentoDur: 2, planta: 0.3, visual: 'estilhacoRocha', coste: 25, cd: 6, anim: 'Shoot' }),
      esp: dash('Rock Roll', 'ROCK', { dano: 4, dist: 110, estilo: 'golpe' }),
      q: skill('Seismic Fortress', 'fortaleza', 'ROCK', { dano: 3, dur: 4, coste: 25, cd: 10 }),
      e: semUlt('Solar Core', 'ondaSismica', 'ROCK', { dano: 24, radio: 110, carga: 1 }),
    },
    evoluciones: [
      { dex: '0525', nombre: 'BOLDORE', hp: 92, vel: 114, atk: 1.04, def: 1.12, kit: { lmb: { dano: 4.8 }, rmb: { dano: 10 }, e: { dano: 26, sinUlti: false } } },
      { dex: '0526', nombre: 'GIGALITH', hp: 110, vel: 116, atk: 1.14, def: 1.18, escala: 1.08, kit: { lmb: { dano: 5.2 }, rmb: { dano: 11 }, e: { dano: 29, radio: 120, sinUlti: false } },
        mega: { dex: '0526', nombre: 'MEGA GIGALITH', atk: 0.12, def: 0.1, vel: 4 } },
    ] },
  // ------------------------------------------------------------ Slowpoke > Slowbro > Slowbro (Power Up) > Mega Slowbro
  { id: 'slowpoke', dex: '0079', nombre: 'SLOWPOKE', tipos: ['WATER', 'PSYCHIC'], rol: 'TANQUE', lema: 'THE IMPOSSIBLE NAP', hp: 84, vel: 108, atk: 0.9, def: 1.04, regen: 4, expEvolucion: [55, 100], ia: { rango: 140 },
    kit: {
      lmb: tiro('Water Pulse', 'WATER', 'pulsoAgua', 4.4, { vel: 260, alcance: 180, radio: 5 }),
      rmb: skill('Contagious Yawn', 'bolhaSono', 'PSYCHIC', { dano: 5, vel: 150, alcance: 220, duerme: 1, coste: 25, cd: 7, anim: 'Shoot' }),
      esp: dash('Slack Off Slide', 'WATER', { estilo: 'agua', dist: 110, cd: 6 }),
      q: skill('Amnesia', 'amnesia', 'PSYCHIC', { cura: 0.2, dur: 1, coste: 25, cd: 12 }),
      e: semUlt('Shellder Spin', 'giroShellder', 'PSYCHIC', { dano: 8, radio: 110, confunde: 2 }),
    },
    evoluciones: [
      { dex: '0080', nombre: 'SLOWBRO', hp: 98, vel: 112, atk: 1.0, def: 1.1, kit: { lmb: { dano: 5 }, rmb: { dano: 6 }, e: { dano: 10, sinUlti: false } } },
      { dex: '0080', nombre: 'SLOWBRO', hp: 110, vel: 114, atk: 1.08, def: 1.14, escala: 1.06, kit: { lmb: { dano: 5.4 }, rmb: { dano: 7 }, q: { cura: 0.24 }, e: { dano: 12, radio: 120, sinUlti: false } },
        mega: { dex: '0080-0002', nombre: 'MEGA SLOWBRO', atk: 0.06, def: 0.14, vel: 4 } },
    ] },
  // ------------------------------------------------------------ Drampa > 3 Power Ups > Mega Drampa (passiva Fúria Berserk)
  { id: 'drampa', dex: '0780', nombre: 'DRAMPA', tipos: ['NORMAL', 'DRAGON'], rol: 'DISTANCIA', lema: 'BERSERK ELDER DRAGON', berserk: true, hp: 78, vel: 122, atk: 1.0, def: 0.94, regen: 5, expEvolucion: [45, 80, 115], ia: { rango: 150 },
    kit: {
      lmb: tiro('Dragon Breath', 'DRAGON', 'aliento', 4.4, { alcance: 190 }),
      rmb: skill('Hypersonic Roar', 'rugido', 'DRAGON', { dano: 8, alcance: 120, angulo: 70, silencio: 1, coste: 25, cd: 7 }),
      esp: dash('Glide', 'FLYING', { dano: 0, dist: 140, dur: 0.2 }),
      q: skill('Mystic Mist', 'nevoa', 'DRAGON', { radio: 70, dur: 3, cura: 0.02, coste: 25, cd: 12 }),
      e: semUlt('Elder Fury', 'furiaAnciao', 'DRAGON', { dano: 22, alcance: 320 }),
    },
    evoluciones: [
      { dex: '0780', nombre: 'DRAMPA', hp: 86, vel: 123, atk: 1.06, def: 0.97, kit: { lmb: { dano: 4.8 }, rmb: { dano: 8.8 }, e: { dano: 24, sinUlti: false } } },
      { dex: '0780', nombre: 'DRAMPA', hp: 94, vel: 124, atk: 1.12, def: 1.0, kit: { lmb: { dano: 5.2 }, rmb: { dano: 9.6 }, q: { cura: 0.025 }, e: { dano: 26, sinUlti: false } } },
      { dex: '0780', nombre: 'DRAMPA', hp: 102, vel: 125, atk: 1.18, def: 1.03, escala: 1.06, kit: { lmb: { dano: 5.6 }, rmb: { dano: 10.4 }, q: { cura: 0.025 }, e: { dano: 28, sinUlti: false } },
        mega: { dex: '0780-0001', nombre: 'MEGA DRAMPA', atk: 0.14, def: 0.05, vel: 6 } },
    ] },
];
