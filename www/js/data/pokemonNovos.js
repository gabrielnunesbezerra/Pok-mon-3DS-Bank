// Linhas novas: os Pokémon das Megas que faltavam (com a linha evolutiva que os sprites do PMD permitem) e o
// Aegislash. Mesmo formato do ROSTER de pokemon.js; os kits das Megas ficam em megas.js (MEGA_KITS).
// As ults da forma final e da Mega usam as formas de engine/formasMega.js.

// moldes dos espaços comuns (o resto do objeto sobrescreve)
const tiro = (nombre, tipo, estilo, dano, o = {}) => ({ nombre, forma: 'proyectil', estilo, tipo, dano, vel: 300, alcance: 200, radio: 4, escala: 1.3, cd: 0.55, calor: 8, anim: 'Shoot', lanzar: 0.12, ...o });
const corte = (nombre, tipo, dano, o = {}) => ({ nombre, forma: 'tajo', tipo, dano, combo: 3, alcance: 48, angulo: 130, cd: 0.5, calor: 8, anim: 'Attack', lanzar: 0.1, avance: 10, ...o });
const dash = (nombre, tipo, o = {}) => ({ nombre, forma: 'dash', tipo, dano: 4, dist: 130, dur: 0.16, cd: 5, anim: 'Walk', estilo: 'rapido', ...o });
const skill = (nombre, forma, tipo, o = {}) => ({ nombre, forma, tipo, coste: 30, cd: 7, anim: 'Charge', ...o });
const semUlt = (nombre, forma, tipo, o = {}) => ({ nombre, forma, tipo, cd: 1, anim: 'Charge', sinUlti: true, ...o });
const ult = (nombre, forma, tipo, dano, o = {}) => ({ nombre, forma, tipo, dano, cd: 1, anim: 'Charge', sinUlti: false, ...o });

export const ROSTER_NOVOS = [
  // ------------------------------------------------------------ Slowpoke > Slowbro > Mega Slowbro
  { id: 'slowpoke', dex: '0079', nombre: 'SLOWPOKE', tipos: ['WATER', 'PSYCHIC'], rol: 'TANQUE', lema: 'SLOW TIDE, HEAVY SHELL', hp: 82, vel: 112, atk: 0.9, def: 1.0, regen: 4, expEvolucion: [55, 100], ia: { rango: 140 },
    kit: {
      lmb: tiro('Water Pulse', 'WATER', 'pulsoAgua', 4.4, { vel: 260, alcance: 180, radio: 5 }),
      rmb: tiro('Confusion Wave', 'PSYCHIC', 'psiOnda', 9, { vel: 240, alcance: 190, radio: 7, escala: 1.8, confunde: 1.2, coste: 30, cd: 6, calor: 0, lanzar: 0.18 }),
      esp: dash('Slack Off Slide', 'WATER', { estilo: 'agua', dist: 110, cd: 6 }),
      q: skill('Amnesia', 'escudo', 'PSYCHIC', { absorbe: 16, dur: 3, lento: 0.3, cd: 11 }),
      e: semUlt('Surf Nap', 'pulso', 'WATER', { dano: 14, radio: 70, empuje: 80, duerme: 0.8 }),
    },
    evoluciones: [
      { dex: '0080', nombre: 'SLOWBRO', hp: 96, vel: 116, atk: 1.0, def: 1.08, kit: { lmb: { dano: 5 }, rmb: { dano: 10.5 }, e: { dano: 18, sinUlti: false } } },
      { dex: '0080', nombre: 'SLOWBRO', hp: 108, vel: 118, atk: 1.08, def: 1.12, escala: 1.08,
        kit: { lmb: { nombre: 'Psyshock Pulse', dano: 5.4 }, rmb: { nombre: 'Zen Wave', dano: 11.5 }, q: { nombre: 'Slack Off', forma: 'recuperar', cura: 0.18, coste: 30, cd: 14 }, e: ult('Slack Tide', 'mareLenta', 'WATER', 24, { radio: 135, dur: 1.6, duerme: 1.4 }) },
        mega: { dex: '0080-0002', nombre: 'MEGA SLOWBRO', atk: 0.06, def: 0.12, vel: 4 } },
    ] },
  // ------------------------------------------------------------ Aerodactyl > Mega Aerodactyl
  { id: 'aerodactyl', dex: '0142', nombre: 'AERODACTYL', tipos: ['ROCK', 'FLYING'], rol: 'FISICO', lema: 'ANCIENT SKY TERROR', hp: 76, vel: 150, atk: 1.0, def: 0.9, regen: 4, expEvolucion: [55, 100], ia: { rango: 70 },
    kit: {
      lmb: corte('Bite', 'DARK', 4.6, { alcance: 50 }),
      rmb: tiro('Rock Slide', 'ROCK', 'roca', 4, { rafaga: 3, cadaRafaga: 0.08, abanico: 0.14, alcance: 190, coste: 25, cd: 5, calor: 0, escala: 1.7 }),
      esp: dash('Wing Attack', 'FLYING', { dano: 6, dist: 150, cd: 5.5, estilo: 'golpe' }),
      q: skill('Rock Polish', 'potenciar', 'ROCK', { dur: 4, porNivel: { mult: 0.15, cadencia: 0.1, vel: 0.1 }, texto: 'ROCK POLISH', cd: 11, coste: 25 }),
      e: semUlt('Sky Attack', 'dash', 'FLYING', { dano: 16, dist: 200, dur: 0.22, estilo: 'golpe' }),
    },
    evoluciones: [
      { dex: '0142', nombre: 'AERODACTYL', hp: 88, vel: 154, atk: 1.1, def: 0.94, kit: { lmb: { dano: 5.2 }, rmb: { dano: 4.5 }, e: { dano: 20, sinUlti: false } } },
      { dex: '0142', nombre: 'AERODACTYL', hp: 98, vel: 158, atk: 1.18, def: 0.98, escala: 1.1,
        kit: { lmb: { nombre: 'Crunch', dano: 5.6 }, rmb: { nombre: 'Stone Shower', dano: 5 }, e: ult('Ancient Dive', 'mergulhoAntigo', 'ROCK', 28, { alcance: 280, sobe: 0.45 }) },
        mega: { dex: '0142-0001', nombre: 'MEGA AERODACTYL', atk: 0.12, def: 0.04, vel: 8 } },
    ] },
  // ------------------------------------------------------------ Skarmory > Mega Skarmory
  { id: 'skarmory', dex: '0227', nombre: 'SKARMORY', tipos: ['STEEL', 'FLYING'], rol: 'TANQUE', lema: 'RAZOR FEATHERED FORTRESS', hp: 80, vel: 128, atk: 0.92, def: 1.06, regen: 4, expEvolucion: [55, 100], ia: { rango: 90 },
    kit: {
      lmb: corte('Steel Wing', 'STEEL', 4.4, { alcance: 52, angulo: 150 }),
      rmb: tiro('Air Cutter', 'FLYING', 'cuchilla', 7, { rafaga: 2, cadaRafaga: 0.12, alcance: 210, coste: 25, cd: 5, calor: 0, escala: 1.6 }),
      esp: dash('Drill Peck', 'FLYING', { dano: 5, dist: 140, estilo: 'golpe' }),
      q: skill('Iron Defense', 'escudo', 'STEEL', { absorbe: 20, dur: 3, lento: 0.2, cd: 11 }),
      e: semUlt('Spikes', 'trampa', 'GROUND', { dano: 12, alcance: 170, radio: 18, arma: 0.4, dur: 8, max: 3, aturde: 0.4 }),
    },
    evoluciones: [
      { dex: '0227', nombre: 'SKARMORY', hp: 92, vel: 130, atk: 1.0, def: 1.1, kit: { lmb: { dano: 5 }, rmb: { dano: 8 }, e: { dano: 14, sinUlti: false } } },
      { dex: '0227', nombre: 'SKARMORY', hp: 104, vel: 132, atk: 1.08, def: 1.14, escala: 1.08,
        kit: { lmb: { nombre: 'Steel Wing', dano: 5.4 }, rmb: { nombre: 'Air Slash', dano: 8.6 }, e: ult('Steel Strafe', 'rasanteAco', 'STEEL', 27, { alcance: 260, passes: 3 }) },
        mega: { dex: '0227-0001', nombre: 'MEGA SKARMORY', atk: 0.1, def: 0.08, vel: 6 } },
    ] },
  // ------------------------------------------------------------ Ralts > Kirlia > Gardevoir > Mega Gardevoir
  { id: 'ralts', dex: '0280', nombre: 'RALTS', tipos: ['PSYCHIC', 'FAIRY'], rol: 'DISTANCIA', lema: 'MOONLIGHT PRISMS', hp: 56, vel: 136, atk: 1.0, def: 0.8, regen: 5, expEvolucion: [55, 100], ia: { rango: 160 },
    kit: {
      lmb: tiro('Disarming Voice', 'FAIRY', 'brisaHada', 4.4, { alcance: 190 }),
      rmb: tiro('Psybeam', 'PSYCHIC', 'psiOnda', 9, { vel: 280, radio: 7, escala: 1.8, confunde: 1, coste: 30, cd: 6, calor: 0, lanzar: 0.16 }),
      esp: dash('Teleport', 'PSYCHIC', { dano: 0, teleport: true, dist: 115, dur: 0.12, cd: 8, anim: 'Idle', estilo: 'teleport' }),
      q: skill('Draining Kiss', 'golpe', 'FAIRY', { dano: 8, alcance: 46, angulo: 130, embestida: 40, roba: 0.6, cd: 8, anim: 'Attack' }),
      e: semUlt('Dazzling Gleam', 'pulso', 'FAIRY', { dano: 16, radio: 70, empuje: 60 }),
    },
    evoluciones: [
      { dex: '0281', nombre: 'KIRLIA', hp: 70, vel: 140, atk: 1.12, def: 0.84, kit: { lmb: { dano: 4.8 }, rmb: { dano: 10 }, e: { dano: 20, sinUlti: false } } },
      { dex: '0282', nombre: 'GARDEVOIR', hp: 84, vel: 142, atk: 1.26, def: 0.88, escala: 1.06,
        kit: { lmb: { nombre: 'Moonblast Shard', estilo: 'psico', tipo: 'FAIRY', dano: 5, rafaga: 2, cadaRafaga: 0.08 }, rmb: { nombre: 'Psyshock', dano: 11.5 }, e: ult('Prism Moonblast', 'prismaLunar', 'FAIRY', 30, { alcance: 260, radio: 64, dur: 1.6 }) },
        mega: { dex: '0282-0001', nombre: 'MEGA GARDEVOIR', atk: 0.14, def: 0.03, vel: 6 } },
    ] },
  // ------------------------------------------------------------ Ralts > Kirlia > Gallade > Mega Gallade
  { id: 'gallade', dex: '0280', nombre: 'RALTS', tipos: ['PSYCHIC', 'FAIRY'], rol: 'FISICO', lema: 'BLADE OF CHIVALRY', hp: 58, vel: 136, atk: 1.02, def: 0.84, regen: 4, expEvolucion: [55, 100], ia: { rango: 70 },
    kit: {
      lmb: corte('Confusion Slash', 'PSYCHIC', 4.4),
      rmb: tiro('Psycho Cut', 'PSYCHIC', 'psicorte', 10, { vel: 330, alcance: 210, radio: 6, escala: 1.8, coste: 30, cd: 5, calor: 0 }),
      esp: dash('Teleport', 'PSYCHIC', { dano: 0, teleport: true, dist: 115, dur: 0.12, cd: 8, anim: 'Idle', estilo: 'teleport' }),
      q: skill('Quick Guard', 'escudo', 'FIGHTING', { absorbe: 14, dur: 2, lento: 0.3, cd: 10 }),
      e: semUlt('Night Slash', 'dash', 'DARK', { dano: 15, dist: 160, dur: 0.18, estilo: 'golpe', anim: 'Attack' }),
    },
    evoluciones: [
      { dex: '0281', nombre: 'KIRLIA', tipos: ['PSYCHIC', 'FAIRY'], hp: 72, vel: 140, atk: 1.12, def: 0.88, kit: { lmb: { dano: 4.9 }, rmb: { dano: 11 }, e: { dano: 19, sinUlti: false } } },
      { dex: '0475', nombre: 'GALLADE', tipos: ['PSYCHIC', 'FIGHTING'], hp: 92, vel: 144, atk: 1.24, def: 0.96, escala: 1.08,
        kit: { lmb: { nombre: 'Leaf Blade Arm', tipo: 'FIGHTING', dano: 5.4, alcance: 56, angulo: 150 }, rmb: { nombre: 'Sacred Sword Wave', tipo: 'FIGHTING', dano: 12 }, e: ult('Iai Slash', 'corteIai', 'FIGHTING', 30, { largo: 170, pose: 0.35 }) },
        mega: { dex: '0475-0001', nombre: 'MEGA GALLADE', atk: 0.13, def: 0.04, vel: 8 } },
    ] },
  // ------------------------------------------------------------ Sableye > Mega Sableye
  { id: 'sableye', dex: '0302', nombre: 'SABLEYE', tipos: ['DARK', 'GHOST'], rol: 'CONTROL', lema: 'GEM THIEF OF THE CAVES', hp: 70, vel: 132, atk: 0.98, def: 0.94, regen: 4, expEvolucion: [55, 100], ia: { rango: 80 },
    kit: {
      lmb: corte('Fury Swipes', 'NORMAL', 3.8, { combo: 4, alcance: 44 }),
      rmb: tiro('Shadow Sneak Gem', 'GHOST', 'sombra', 9, { vel: 280, radio: 6, escala: 1.6, coste: 25, cd: 5, calor: 0 }),
      esp: dash('Shadow Sneak', 'GHOST', { dano: 4, dist: 130, estilo: 'teleport', teleport: true }),
      q: skill('Confuse Ray', 'proyectil', 'GHOST', { estilo: 'hex', dano: 4, vel: 220, alcance: 200, radio: 6, escala: 1.6, confunde: 2, cd: 9 }),
      e: semUlt('Foul Play', 'golpe', 'DARK', { dano: 14, alcance: 50, angulo: 140, embestida: 60, anim: 'Attack' }),
    },
    evoluciones: [
      { dex: '0302', nombre: 'SABLEYE', hp: 82, vel: 134, atk: 1.06, def: 0.98, kit: { lmb: { dano: 4.2 }, rmb: { dano: 10 }, e: { dano: 18, sinUlti: false } } },
      { dex: '0302', nombre: 'SABLEYE', hp: 94, vel: 136, atk: 1.14, def: 1.02, escala: 1.06,
        kit: { lmb: { nombre: 'Shadow Claw', tipo: 'GHOST', dano: 4.6 }, rmb: { nombre: 'Power Gem', tipo: 'ROCK', estilo: 'tri', dano: 10.5 }, e: ult('Gem Heist', 'rouboJoia', 'DARK', 26, { alcance: 200, rouba: 40, espera: 1.2, radio: 56 }) },
        mega: { dex: '0302-0001', nombre: 'MEGA SABLEYE', atk: 0.06, def: 0.14, vel: 2 } },
    ] },
  // ------------------------------------------------------------ Mawile > Mega Mawile
  { id: 'mawile', dex: '0303', nombre: 'MAWILE', tipos: ['STEEL', 'FAIRY'], rol: 'FISICO', lema: 'THE DECEIVER WITH STEEL JAWS', hp: 72, vel: 128, atk: 1.02, def: 0.98, regen: 4, expEvolucion: [55, 100], ia: { rango: 60 },
    kit: {
      lmb: corte('Iron Head', 'STEEL', 4.6, { combo: 2, alcance: 46 }),
      rmb: tiro('Fairy Wind', 'FAIRY', 'brisaHada', 8, { vel: 300, radio: 6, escala: 1.6, coste: 25, cd: 5, calor: 0 }),
      esp: dash('Sucker Punch', 'DARK', { dano: 5, dist: 120, estilo: 'golpe' }),
      q: skill('Sweet Scent', 'pulso', 'FAIRY', { dano: 4, radio: 60, empuje: 20, debilita: { f: 0.7, dur: 4 }, cd: 9 }),
      e: semUlt('Crunch', 'golpe', 'DARK', { dano: 15, alcance: 50, angulo: 130, embestida: 50, anim: 'Attack' }),
    },
    evoluciones: [
      { dex: '0303', nombre: 'MAWILE', hp: 84, vel: 130, atk: 1.12, def: 1.02, kit: { lmb: { dano: 5.2 }, rmb: { dano: 9 }, e: { dano: 19, sinUlti: false } } },
      { dex: '0303', nombre: 'MAWILE', hp: 96, vel: 132, atk: 1.2, def: 1.06, escala: 1.06,
        kit: { lmb: { nombre: 'Iron Head', dano: 5.8 }, rmb: { nombre: 'Play Rough Wind', dano: 9.6 }, e: ult("Deceiver's Jaws", 'mandibulaFalsa', 'STEEL', 28, { alcance: 150 }) },
        mega: { dex: '0303-0001', nombre: 'MEGA MAWILE', atk: 0.16, def: 0.06, vel: 2 } },
    ] },
  // ------------------------------------------------------------ Meditite > Medicham > Mega Medicham
  { id: 'meditite', dex: '0307', nombre: 'MEDITITE', tipos: ['FIGHTING', 'PSYCHIC'], rol: 'FISICO', lema: 'INNER FOCUS, OUTER FORCE', hp: 64, vel: 138, atk: 1.0, def: 0.88, regen: 4, expEvolucion: [55, 100], ia: { rango: 60 },
    kit: {
      lmb: corte('Force Palm', 'FIGHTING', 4.4, { combo: 3, alcance: 46 }),
      rmb: tiro('Confusion', 'PSYCHIC', 'psico', 8, { vel: 300, radio: 6, escala: 1.6, coste: 25, cd: 5, calor: 0 }),
      esp: dash('Fake Out', 'NORMAL', { dano: 4, dist: 120, aturde: 0.3, estilo: 'golpe' }),
      q: skill('Calm Mind', 'potenciar', 'PSYCHIC', { dur: 4, porNivel: { mult: 0.15, cadencia: 0.1 }, cd: 11, coste: 25 }),
      e: semUlt('High Jump Kick', 'patada', 'FIGHTING', { dano: 15, alcance: 130, radio: 30, aturde: 0.35, anim: 'Hop', animGolpe: 'Attack' }),
    },
    evoluciones: [
      { dex: '0308', nombre: 'MEDICHAM', hp: 82, vel: 142, atk: 1.12, def: 0.94, kit: { lmb: { dano: 5 }, rmb: { dano: 9 }, e: { dano: 19, sinUlti: false } } },
      { dex: '0308', nombre: 'MEDICHAM', hp: 94, vel: 144, atk: 1.22, def: 0.98, escala: 1.06,
        kit: { lmb: { nombre: 'Drain Punch', dano: 5.4 }, rmb: { nombre: 'Zen Headbutt Wave', dano: 9.8 }, e: ult('Zen Palm', 'palmaZen', 'FIGHTING', 28, { medita: 0.5, largo: 150 }) },
        mega: { dex: '0308-0001', nombre: 'MEGA MEDICHAM', atk: 0.14, def: 0.03, vel: 8 } },
    ] },
  // ------------------------------------------------------------ Electrike > Manectric > Mega Manectric
  { id: 'electrike', dex: '0309', nombre: 'ELECTRIKE', tipos: ['ELECTRIC'], rol: 'MIXTO', lema: 'THUNDER ON FOUR PAWS', hp: 62, vel: 150, atk: 1.0, def: 0.84, regen: 4, expEvolucion: [55, 100], ia: { rango: 110 },
    kit: {
      lmb: corte('Spark Bite', 'ELECTRIC', 4.2, { combo: 3, alcance: 46 }),
      rmb: tiro('Shock Wave', 'ELECTRIC', 'rayito', 8, { vel: 380, alcance: 220, radio: 5, escala: 1.6, coste: 25, cd: 5, calor: 0, teledirigido: 2 }),
      esp: dash('Quick Attack', 'NORMAL', { dano: 4, dist: 140 }),
      q: skill('Charge', 'potenciar', 'ELECTRIC', { dur: 4, porNivel: { mult: 0.15, cadencia: 0.15, vel: 0.06 }, texto: 'CHARGE', cd: 11, coste: 25 }),
      e: semUlt('Discharge', 'pulso', 'ELECTRIC', { dano: 15, radio: 70, empuje: 60, aturde: 0.3 }),
    },
    evoluciones: [
      { dex: '0310', nombre: 'MANECTRIC', hp: 80, vel: 154, atk: 1.12, def: 0.9, kit: { lmb: { dano: 4.8 }, rmb: { dano: 9 }, e: { dano: 19, sinUlti: false } } },
      { dex: '0310', nombre: 'MANECTRIC', hp: 92, vel: 158, atk: 1.2, def: 0.94, escala: 1.06,
        kit: { lmb: { nombre: 'Thunder Fang', dano: 5.2 }, rmb: { nombre: 'Thunderbolt', estilo: 'orbeElectrico', dano: 10 }, e: ult('Thunder Zigzag', 'zigueRaio', 'ELECTRIC', 28, { saltos: 3 }) },
        mega: { dex: '0310-0001', nombre: 'MEGA MANECTRIC', atk: 0.12, def: 0.04, vel: 10 } },
    ] },
  // ------------------------------------------------------------ Numel > Camerupt > Mega Camerupt
  { id: 'numel', dex: '0322', nombre: 'NUMEL', tipos: ['FIRE', 'GROUND'], rol: 'TANQUE', lema: 'A VOLCANO ON ITS BACK', hp: 80, vel: 110, atk: 0.94, def: 1.0, regen: 4, expEvolucion: [55, 100], ia: { rango: 130 },
    kit: {
      lmb: tiro('Ember', 'FIRE', 'brasa', 4.4, { alcance: 180 }),
      rmb: skill('Magnitude', 'pulso', 'GROUND', { estilo: 'tierra', dano: 10, radio: 62, empuje: 70, carga: 0.15, cd: 6, anim: 'Attack', salta: 0.3 }),
      esp: dash('Take Down', 'NORMAL', { dano: 5, dist: 110, estilo: 'golpe' }),
      q: skill('Lava Plume', 'pulso', 'FIRE', { estilo: 'fuego', dano: 8, radio: 54, empuje: 60, quema: { dps: 1, dur: 2, max: 2 }, cd: 9 }),
      e: semUlt('Earth Power', 'geiser', 'GROUND', { dano: 14, alcance: 190, radio: 28, aviso: 0.4, tiron: 60 }),
    },
    evoluciones: [
      { dex: '0323', nombre: 'CAMERUPT', hp: 98, vel: 112, atk: 1.06, def: 1.06, kit: { lmb: { dano: 5 }, rmb: { dano: 11 }, e: { dano: 18, sinUlti: false } } },
      { dex: '0323', nombre: 'CAMERUPT', hp: 110, vel: 114, atk: 1.14, def: 1.1, escala: 1.1,
        kit: { lmb: { nombre: 'Flame Burst', estilo: 'fuego', dano: 5.4 }, rmb: { nombre: 'Earth Slam', dano: 12 }, e: ult('Back Volcano', 'vulcaoCostas', 'FIRE', 28, { alcance: 240, n: 6 }) },
        mega: { dex: '0323-0001', nombre: 'MEGA CAMERUPT', atk: 0.12, def: 0.08, vel: 0 } },
    ] },
  // ------------------------------------------------------------ Shuppet > Banette > Mega Banette
  { id: 'shuppet', dex: '0353', nombre: 'SHUPPET', tipos: ['GHOST'], rol: 'CONTROL', lema: 'A GRUDGE STITCHED TOGETHER', hp: 60, vel: 136, atk: 0.98, def: 0.84, regen: 4, expEvolucion: [55, 100], ia: { rango: 120 },
    kit: {
      lmb: tiro('Night Shade', 'GHOST', 'hex', 4.2, { alcance: 190 }),
      rmb: tiro('Will-O-Wisp', 'FIRE', 'fuego', 6, { vel: 220, radio: 6, escala: 1.5, quema: { dps: 2, dur: 3, max: 2 }, coste: 25, cd: 6, calor: 0 }),
      esp: dash('Phantom Step', 'GHOST', { dano: 0, teleport: true, dist: 120, dur: 0.12, cd: 7, anim: 'Idle', estilo: 'teleport' }),
      q: skill('Spite', 'proyectil', 'GHOST', { estilo: 'sombra', dano: 6, vel: 260, alcance: 200, radio: 6, escala: 1.5, debilita: { f: 0.7, dur: 4 }, cd: 9 }),
      e: semUlt('Shadow Claw', 'golpe', 'GHOST', { dano: 14, alcance: 50, angulo: 140, embestida: 50, anim: 'Attack' }),
    },
    evoluciones: [
      { dex: '0354', nombre: 'BANETTE', hp: 80, vel: 138, atk: 1.12, def: 0.9, kit: { lmb: { dano: 4.8 }, rmb: { dano: 7 }, e: { dano: 18, sinUlti: false } } },
      { dex: '0354', nombre: 'BANETTE', hp: 92, vel: 140, atk: 1.2, def: 0.94, escala: 1.06,
        kit: { lmb: { nombre: 'Shadow Sneak Shot', dano: 5.2 }, rmb: { nombre: 'Will-O-Wisp', dano: 7.6 }, e: ult('Stitch Needles', 'agulhaCostura', 'GHOST', 26) },
        mega: { dex: '0354-0001', nombre: 'MEGA BANETTE', atk: 0.14, def: 0.02, vel: 6 } },
    ] },
  // ------------------------------------------------------------ Absol > Mega Absol
  { id: 'absol', dex: '0359', nombre: 'ABSOL', tipos: ['DARK'], rol: 'FISICO', lema: 'HERALD OF DISASTER', hp: 70, vel: 146, atk: 1.06, def: 0.86, regen: 4, expEvolucion: [55, 100], ia: { rango: 66 },
    kit: {
      lmb: corte('Night Slash', 'DARK', 4.6, { alcance: 52, angulo: 140 }),
      rmb: tiro('Razor Wind', 'NORMAL', 'cuchilla', 9, { vel: 340, alcance: 210, radio: 6, escala: 1.7, coste: 25, cd: 5, calor: 0 }),
      esp: dash('Sucker Punch', 'DARK', { dano: 5, dist: 140, estilo: 'golpe' }),
      q: skill('Swords Dance', 'potenciar', 'NORMAL', { dur: 4, porNivel: { mult: 0.2, cadencia: 0.05 }, texto: 'SWORDS DANCE', cd: 11, coste: 25 }),
      e: semUlt('Psycho Cut', 'proyectil', 'PSYCHIC', { estilo: 'psicorte', dano: 14, vel: 360, alcance: 230, radio: 7, escala: 2.2, anim: 'Attack' }),
    },
    evoluciones: [
      { dex: '0359', nombre: 'ABSOL', hp: 82, vel: 150, atk: 1.16, def: 0.9, kit: { lmb: { dano: 5.2 }, rmb: { dano: 10 }, e: { dano: 18, sinUlti: false } } },
      { dex: '0359', nombre: 'ABSOL', hp: 92, vel: 152, atk: 1.26, def: 0.94, escala: 1.06,
        kit: { lmb: { nombre: 'Night Slash', dano: 5.6 }, rmb: { nombre: 'Air Cutter', dano: 10.6 }, e: ult('Disaster Crescent', 'luaDesastre', 'DARK', 28, { radio: 50, dur: 1.2 }) },
        mega: { dex: '0359-0001', nombre: 'MEGA ABSOL', atk: 0.14, def: 0.03, vel: 10 } },
    ] },
  // ------------------------------------------------------------ Snorunt > Glalie > Mega Glalie
  { id: 'snorunt', dex: '0361', nombre: 'SNORUNT', tipos: ['ICE'], rol: 'TANQUE', lema: 'THE FACE OF THE BLIZZARD', hp: 70, vel: 124, atk: 0.94, def: 0.96, regen: 4, expEvolucion: [55, 100], ia: { rango: 120 },
    kit: {
      lmb: tiro('Powder Snow', 'ICE', 'bola', 4.2, { alcance: 180, escala: 1.4 }),
      rmb: tiro('Ice Shard', 'ICE', 'tri', 4, { rafaga: 3, cadaRafaga: 0.07, vel: 420, alcance: 200, coste: 25, cd: 5, calor: 0, ralentiza: 0.3, ralentizaDur: 1 }),
      esp: dash('Ice Slide', 'ICE', { dano: 4, dist: 130, estilo: 'agua' }),
      q: skill('Protect', 'escudo', 'NORMAL', { absorbe: 16, dur: 2.5, lento: 0.3, cd: 10 }),
      e: semUlt('Icy Wind', 'viento', 'ICE', { estilo: 'sonido', dano: 12, alcance: 150, angulo: 70, empuje: 50, ralentiza: 0.5, ralentizaDur: 2 }),
    },
    evoluciones: [
      { dex: '0362', nombre: 'GLALIE', hp: 92, vel: 126, atk: 1.06, def: 1.04, kit: { lmb: { dano: 4.8 }, rmb: { dano: 4.6 }, e: { dano: 17, sinUlti: false } } },
      { dex: '0362', nombre: 'GLALIE', hp: 106, vel: 128, atk: 1.14, def: 1.08, escala: 1.1,
        kit: { lmb: { nombre: 'Ice Fang Shot', dano: 5.2 }, rmb: { nombre: 'Ice Shard', dano: 5 }, e: ult('Ice Prison', 'prisaoGelo', 'ICE', 27, { radio: 64, aviso: 1 }) },
        mega: { dex: '0362-0001', nombre: 'MEGA GLALIE', atk: 0.14, def: 0.04, vel: 6 } },
    ] },
  // ------------------------------------------------------------ Chingling > Chimecho > Mega Chimecho
  { id: 'chingling', dex: '0433', nombre: 'CHINGLING', tipos: ['PSYCHIC'], rol: 'CONTROL', lema: 'BELLS THAT BEND THE MIND', hp: 60, vel: 132, atk: 0.98, def: 0.86, regen: 5, expEvolucion: [55, 100], ia: { rango: 150 },
    kit: {
      lmb: tiro('Echoed Voice', 'NORMAL', 'psiOnda', 4.2, { alcance: 190, escala: 1.2 }),
      rmb: skill('Uproar', 'viento', 'NORMAL', { estilo: 'sonido', dano: 9, alcance: 140, angulo: 70, empuje: 40, confunde: 1, cd: 6, carga: 0.1 }),
      esp: dash('Teleport', 'PSYCHIC', { dano: 0, teleport: true, dist: 115, dur: 0.12, cd: 8, anim: 'Idle', estilo: 'teleport' }),
      q: skill('Heal Bell', 'curaAnillo', 'NORMAL', { dur: 4, cura: 0.14, cd: 14 }),
      e: semUlt('Extrasensory', 'proyectil', 'PSYCHIC', { estilo: 'psico', dano: 14, vel: 300, alcance: 230, radio: 8, escala: 2, aturde: 0.3 }),
    },
    evoluciones: [
      { dex: '0358', nombre: 'CHIMECHO', hp: 80, vel: 134, atk: 1.1, def: 0.92, kit: { lmb: { dano: 4.8 }, rmb: { dano: 10 }, e: { dano: 18, sinUlti: false } } },
      { dex: '0358', nombre: 'CHIMECHO', hp: 92, vel: 136, atk: 1.2, def: 0.96, escala: 1.06,
        kit: { lmb: { nombre: 'Psychic Chime', dano: 5.2 }, rmb: { nombre: 'Hyper Voice', dano: 10.6 }, e: ult('Echo Chimes', 'sinosEco', 'PSYCHIC', 27, { passo: 70, radio: 54, confunde: 2 }) },
        mega: { dex: '0358-0001', nombre: 'MEGA CHIMECHO', atk: 0.13, def: 0.05, vel: 4 } },
    ] },
  // ------------------------------------------------------------ Carvanha > Sharpedo > Mega Sharpedo
  { id: 'carvanha', dex: '0318', nombre: 'CARVANHA', tipos: ['WATER', 'DARK'], rol: 'FISICO', lema: 'BULLY OF THE SEA', hp: 60, vel: 146, atk: 1.06, def: 0.8, regen: 4, expEvolucion: [55, 100], ia: { rango: 60 },
    kit: {
      lmb: corte('Bite', 'DARK', 4.6, { alcance: 46 }),
      rmb: tiro('Water Gun', 'WATER', 'chorrito', 7, { rafaga: 2, cadaRafaga: 0.1, vel: 340, coste: 25, cd: 5, calor: 0 }),
      esp: dash('Aqua Jet', 'WATER', { dano: 5, dist: 150, estilo: 'agua' }),
      q: skill('Scary Face', 'pulso', 'DARK', { dano: 3, radio: 60, empuje: 20, ralentiza: 0.5, ralentizaDur: 2.5, cd: 9 }),
      e: semUlt('Crunch', 'golpe', 'DARK', { dano: 15, alcance: 50, angulo: 130, embestida: 60, anim: 'Attack' }),
    },
    evoluciones: [
      { dex: '0319', nombre: 'SHARPEDO', hp: 78, vel: 156, atk: 1.2, def: 0.84, kit: { lmb: { dano: 5.4 }, rmb: { dano: 8 }, e: { dano: 19, sinUlti: false } } },
      { dex: '0319', nombre: 'SHARPEDO', hp: 88, vel: 160, atk: 1.28, def: 0.86, escala: 1.08,
        kit: { lmb: { nombre: 'Crunch', dano: 5.8 }, rmb: { nombre: 'Liquidation Shot', dano: 8.6 }, e: ult('Jet Torpedo', 'torpedo', 'WATER', 30, { vel: 620 }) },
        mega: { dex: '0319-0001', nombre: 'MEGA SHARPEDO', atk: 0.14, def: 0.04, vel: 8 } },
    ] },
  // ------------------------------------------------------------ Drilbur > Excadrill > Mega Excadrill
  { id: 'drilbur', dex: '0529', nombre: 'DRILBUR', tipos: ['GROUND'], rol: 'FISICO', lema: 'DRILLS THROUGH ANYTHING', hp: 66, vel: 132, atk: 1.04, def: 0.9, regen: 4, expEvolucion: [55, 100], ia: { rango: 60 },
    kit: {
      lmb: corte('Metal Claw', 'STEEL', 4.6, { alcance: 46 }),
      rmb: tiro('Mud-Slap', 'GROUND', 'roca', 7, { vel: 300, radio: 5, escala: 1.5, ralentiza: 0.4, ralentizaDur: 1.5, coste: 25, cd: 5, calor: 0 }),
      esp: dash('Rapid Spin', 'NORMAL', { dano: 4, dist: 130, estilo: 'rodar' }),
      q: skill('Hone Claws', 'potenciar', 'DARK', { dur: 4, porNivel: { mult: 0.15, cadencia: 0.1 }, cd: 11, coste: 25 }),
      e: semUlt('Drill Run', 'dash', 'GROUND', { dano: 15, dist: 190, dur: 0.24, estilo: 'rodar' }),
    },
    evoluciones: [
      { dex: '0530', nombre: 'EXCADRILL', tipos: ['GROUND', 'STEEL'], hp: 88, vel: 136, atk: 1.16, def: 0.98, kit: { lmb: { dano: 5.2 }, rmb: { dano: 8 }, e: { dano: 19, sinUlti: false } } },
      { dex: '0530', nombre: 'EXCADRILL', tipos: ['GROUND', 'STEEL'], hp: 100, vel: 138, atk: 1.24, def: 1.02, escala: 1.08,
        kit: { lmb: { nombre: 'Iron Head Claw', dano: 5.6 }, rmb: { nombre: 'Rock Slide', estilo: 'roca', tipo: 'ROCK', dano: 8.6 }, e: ult('Drill Tunnel', 'brocaTunel', 'GROUND', 29, { dur: 1.2 }) },
        mega: { dex: '0530-0001', nombre: 'MEGA EXCADRILL', atk: 0.13, def: 0.06, vel: 4 } },
    ] },
  // ------------------------------------------------------------ Scraggy > Scrafty > Mega Scrafty
  { id: 'scraggy', dex: '0559', nombre: 'SCRAGGY', tipos: ['DARK', 'FIGHTING'], rol: 'FISICO', lema: 'HOODLUM WITH A HARD HEAD', hp: 66, vel: 130, atk: 1.02, def: 0.96, regen: 4, expEvolucion: [55, 100], ia: { rango: 60 },
    kit: {
      lmb: corte('Low Kick', 'FIGHTING', 4.4, { alcance: 44 }),
      rmb: skill('Brick Break', 'golpe', 'FIGHTING', { dano: 10, alcance: 50, angulo: 120, embestida: 50, coste: 25, cd: 5, anim: 'Attack' }),
      esp: dash('Feint Step', 'NORMAL', { dano: 3, dist: 120 }),
      q: skill('Bulk Up', 'potenciar', 'FIGHTING', { dur: 4, porNivel: { mult: 0.15, cadencia: 0.1 }, cd: 11, coste: 25 }),
      e: semUlt('Hi Jump Kick', 'patada', 'FIGHTING', { dano: 15, alcance: 120, radio: 30, aturde: 0.35, anim: 'Hop', animGolpe: 'Attack' }),
    },
    evoluciones: [
      { dex: '0560', nombre: 'SCRAFTY', hp: 88, vel: 132, atk: 1.12, def: 1.04, kit: { lmb: { dano: 5 }, rmb: { dano: 11 }, e: { dano: 19, sinUlti: false } } },
      { dex: '0560', nombre: 'SCRAFTY', hp: 100, vel: 134, atk: 1.2, def: 1.08, escala: 1.06,
        kit: { lmb: { nombre: 'Drain Punch', dano: 5.4 }, rmb: { nombre: 'Crunch Rush', tipo: 'DARK', dano: 11.6 }, e: ult('Headbutt Chain', 'cabecadas', 'FIGHTING', 28, { n: 3, alcance: 180 }) },
        mega: { dex: '0560-0001', nombre: 'MEGA SCRAFTY', atk: 0.12, def: 0.08, vel: 4 } },
    ] },
  // ------------------------------------------------------------ Hawlucha > Mega Hawlucha
  { id: 'hawlucha', dex: '0701', nombre: 'HAWLUCHA', tipos: ['FIGHTING', 'FLYING'], rol: 'FISICO', lema: 'THE MASKED LUCHADOR', hp: 70, vel: 148, atk: 1.04, def: 0.9, regen: 4, expEvolucion: [55, 100], ia: { rango: 66 },
    kit: {
      lmb: corte('Karate Chop', 'FIGHTING', 4.4, { alcance: 46 }),
      rmb: tiro('Aerial Ace', 'FLYING', 'cuchilla', 8, { vel: 360, radio: 6, escala: 1.6, teledirigido: 2.5, coste: 25, cd: 5, calor: 0 }),
      esp: dash('Bounce Step', 'FLYING', { dano: 4, dist: 140, estilo: 'golpe' }),
      q: skill('Detect', 'escudo', 'FIGHTING', { absorbe: 14, dur: 1.5, lento: 0.2, cd: 9 }),
      e: semUlt('Sky Drop Kick', 'salto', 'FLYING', { dano: 15, golpes: 1, radio: 30, alcance: 130, anim: 'Hop' }),
    },
    evoluciones: [
      { dex: '0701', nombre: 'HAWLUCHA', hp: 82, vel: 152, atk: 1.14, def: 0.94, kit: { lmb: { dano: 5 }, rmb: { dano: 9 }, e: { dano: 19, sinUlti: false } } },
      { dex: '0701', nombre: 'HAWLUCHA', hp: 94, vel: 154, atk: 1.22, def: 0.98, escala: 1.06,
        kit: { lmb: { nombre: 'Cross Chop', dano: 5.4 }, rmb: { nombre: 'Aerial Ace', dano: 9.6 }, e: ult('Flying Press', 'prensaVoadora', 'FIGHTING', 29, { sobe: 0.6, braco: 110 }) },
        mega: { dex: '0701-0001', nombre: 'MEGA HAWLUCHA', atk: 0.13, def: 0.05, vel: 8 } },
    ] },
  // ------------------------------------------------------------ Diancie > Mega Diancie
  { id: 'diancie', dex: '0719', nombre: 'DIANCIE', tipos: ['ROCK', 'FAIRY'], rol: 'CONTROL', lema: 'PRINCESS OF DIAMONDS', hp: 72, vel: 128, atk: 1.0, def: 1.0, regen: 4, expEvolucion: [55, 100], ia: { rango: 120 },
    kit: {
      lmb: tiro('Rock Throw', 'ROCK', 'roca', 4.4, { alcance: 190 }),
      rmb: tiro('Draining Kiss', 'FAIRY', 'corazon', 8, { vel: 280, radio: 6, escala: 1.6, coste: 25, cd: 5, calor: 0 }),
      esp: dash('Teleport', 'PSYCHIC', { dano: 0, teleport: true, dist: 115, dur: 0.12, cd: 8, anim: 'Idle', estilo: 'teleport' }),
      q: skill('Reflect', 'escudo', 'PSYCHIC', { absorbe: 16, dur: 2.5, lento: 0.3, cd: 10 }),
      e: semUlt('Power Gem', 'proyectil', 'ROCK', { estilo: 'tri', dano: 14, vel: 320, alcance: 230, radio: 8, escala: 2.2 }),
    },
    evoluciones: [
      { dex: '0719', nombre: 'DIANCIE', hp: 86, vel: 130, atk: 1.1, def: 1.04, kit: { lmb: { dano: 5 }, rmb: { dano: 9 }, e: { dano: 18, sinUlti: false } } },
      { dex: '0719', nombre: 'DIANCIE', hp: 98, vel: 132, atk: 1.18, def: 1.08, escala: 1.06,
        kit: { lmb: { nombre: 'Ancient Power', dano: 5.4 }, rmb: { nombre: 'Moonblast', estilo: 'brisaHada', dano: 9.6 }, e: ult('Diamond Spiral', 'espiralDiamante', 'ROCK', 28, { n: 10 }) },
        mega: { dex: '0719-0001', nombre: 'MEGA DIANCIE', atk: 0.14, def: 0.02, vel: 8 } },
    ] },
  // ------------------------------------------------------------ Drampa > Mega Drampa
  { id: 'drampa', dex: '0780', nombre: 'DRAMPA', tipos: ['NORMAL', 'DRAGON'], rol: 'DISTANCIA', lema: 'GENTLE ELDER DRAGON', hp: 78, vel: 122, atk: 1.0, def: 0.94, regen: 5, expEvolucion: [55, 100], ia: { rango: 150 },
    kit: {
      lmb: tiro('Dragon Breath', 'DRAGON', 'aliento', 4.4, { alcance: 190 }),
      rmb: tiro('Hyper Voice', 'NORMAL', 'psiOnda', 9, { vel: 280, radio: 7, escala: 1.8, coste: 25, cd: 5, calor: 0 }),
      esp: dash('Glide', 'FLYING', { dano: 0, dist: 140, dur: 0.2 }),
      q: skill('Safeguard', 'escudo', 'NORMAL', { absorbe: 18, dur: 2.5, lento: 0.3, cd: 10 }),
      e: semUlt('Dragon Pulse', 'proyectil', 'DRAGON', { estilo: 'dragonPulse', dano: 14, vel: 320, alcance: 240, radio: 8, escala: 2 }),
    },
    evoluciones: [
      { dex: '0780', nombre: 'DRAMPA', hp: 92, vel: 124, atk: 1.12, def: 0.98, kit: { lmb: { dano: 5 }, rmb: { dano: 10 }, e: { dano: 18, sinUlti: false } } },
      { dex: '0780', nombre: 'DRAMPA', hp: 104, vel: 126, atk: 1.2, def: 1.02, escala: 1.1,
        kit: { lmb: { nombre: 'Dragon Breath', dano: 5.4 }, rmb: { nombre: 'Boomburst', dano: 10.8 }, e: ult('Dragon Ribbon', 'fitaDraco', 'DRAGON', 28, { alcance: 280 }) },
        mega: { dex: '0780-0001', nombre: 'MEGA DRAMPA', atk: 0.14, def: 0.04, vel: 6 } },
    ] },
  // ------------------------------------------------------------ Tatsugiri > Mega Tatsugiri
  { id: 'tatsugiri', dex: '0978', nombre: 'TATSUGIRI', tipos: ['DRAGON', 'WATER'], rol: 'DISTANCIA', lema: 'THE TINY COMMANDER', hp: 60, vel: 140, atk: 1.02, def: 0.84, regen: 5, expEvolucion: [55, 100], ia: { rango: 160 },
    kit: {
      lmb: tiro('Water Shuriken', 'WATER', 'cuchillaAgua', 4.2, { alcance: 200 }),
      rmb: tiro('Dragon Pulse', 'DRAGON', 'dragonPulse', 9, { vel: 320, radio: 6, escala: 1.6, coste: 25, cd: 5, calor: 0 }),
      esp: dash('Aqua Jet', 'WATER', { dano: 3, dist: 140, estilo: 'agua' }),
      q: skill('Taunt Splash', 'pulso', 'WATER', { dano: 5, radio: 60, empuje: 70, cd: 8 }),
      e: semUlt('Muddy Water', 'viento', 'WATER', { estilo: 'sonido', dano: 13, alcance: 150, angulo: 70, empuje: 60 }),
    },
    evoluciones: [
      { dex: '0978', nombre: 'TATSUGIRI', hp: 74, vel: 142, atk: 1.14, def: 0.88, kit: { lmb: { dano: 4.8 }, rmb: { dano: 10 }, e: { dano: 18, sinUlti: false } } },
      { dex: '0978', nombre: 'TATSUGIRI', hp: 86, vel: 144, atk: 1.24, def: 0.9, escala: 1.04,
        kit: { lmb: { nombre: 'Water Shuriken', dano: 5.2 }, rmb: { nombre: 'Draco Pulse', dano: 10.8 }, e: ult('Order Up', 'ordemDondozo', 'DRAGON', 29, { largo: 320, largura: 40 }) },
        mega: { dex: '0978-0003', nombre: 'MEGA TATSUGIRI', atk: 0.14, def: 0.04, vel: 6 } },
    ] },
  // ------------------------------------------------------------ Honedge > Doublade > Aegislash (Stance Change, sem Mega)
  { id: 'honedge', dex: '0679', nombre: 'HONEDGE', tipos: ['STEEL', 'GHOST'], rol: 'MIXTO', lema: 'THE ROYAL SWORD AND SHIELD', hp: 64, vel: 128, atk: 1.0, def: 1.0, regen: 4, expEvolucion: [55, 100], ia: { rango: 70 },
    kit: {
      lmb: corte('Fury Cutter', 'BUG', 4.4, { alcance: 52, angulo: 150 }),
      rmb: tiro('Shadow Sneak Slash', 'GHOST', 'sombra', 8, { vel: 300, radio: 6, escala: 1.5, coste: 25, cd: 5, calor: 0 }),
      esp: dash('Shadow Sneak', 'GHOST', { dano: 4, dist: 130, estilo: 'teleport', teleport: true }),
      q: skill('Iron Defense', 'escudo', 'STEEL', { absorbe: 16, dur: 2.5, lento: 0.3, cd: 10 }),
      e: semUlt('Sacred Sword', 'golpe', 'FIGHTING', { dano: 14, alcance: 54, angulo: 160, embestida: 50, anim: 'Attack' }),
    },
    evoluciones: [
      { dex: '0680', nombre: 'DOUBLADE', hp: 82, vel: 128, atk: 1.1, def: 1.08, kit: { lmb: { nombre: 'Twin Blades', dano: 4.8, combo: 4 }, rmb: { dano: 9 }, e: { dano: 18, sinUlti: false } } },
      { dex: '0681', nombre: 'AEGISLASH', hp: 96, vel: 126, atk: 1.0, def: 1.2, escala: 1.08,
        // forma Lâmina: puxa a espada ao atacar (mais ataque, menos defesa); King's Shield volta ao Escudo
        lamina: { dex: '0681-0001', atk: 0.3, def: -0.3 },
        kit: {
          lmb: { nombre: 'Sacred Blade', tipo: 'STEEL', dano: 5.2, combo: 3 },
          rmb: { nombre: 'Shadow Ball', estilo: 'sombra', dano: 10, escala: 1.8 },
          q: { nombre: "King's Shield", forma: 'escudo', tipo: 'STEEL', absorbe: 24, dur: 1.8, lento: 0.4, debilita: { f: 0.75, dur: 3 }, coste: 25, cd: 9 },
          e: ult('Stance Ultimate', 'ultPostura', 'STEEL', 28, { escudo: { nombre: "King's Wall", dur: 2.2 }, lamina: { nombre: 'Royal Execution' } }),
        } },
    ] },
];
