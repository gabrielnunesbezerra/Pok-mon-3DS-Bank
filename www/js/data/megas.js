// Versões turbinadas das skills de cada Mega: mais alcance, mais golpes e efeitos novos,
// não só mais dano. Entram por cima do kit da última forma (ver Lutador.kitActual).
export const MEGA_KITS = {
  skrelp: {
    lmb: { nombre: 'Mega Sludge', rafaga: 2, cadaRafaga: 0.09, dano: 3.6, charcoFin: { radio: 14, dur: 5, veneno: { dps: 2, dur: 2 } } },
    rmb: { nombre: 'Mega Sludge Bomb', rebote: true, dano: 13, radio: 38, charco: { radio: 38, dur: 8, ralentiza: 0.4 } },
    esp: { nombre: 'Mega Dive', dano: 8, radio: 46, rapidez: 1.8, charcoEntraSale: { radio: 26, dur: 7, veneno: { dps: 3, dur: 2 } } },
    q: { nombre: 'Mega Venoshock', carga: 0.55, dano: 10, largo: 240, ancho: 20, contraVeneno: 2.2, rastro: { radio: 16, dur: 6 } },
    e: { nombre: 'Mega Acid Downpour', forma: 'bombaAcida', tipo: 'POISON', dano: 9, radio: 22, gotas: 9, areaMin: 30, area: 95, alto: 110, vuelo: 0.45, lanzar: 0.3, charco: { radio: 24, dur: 7, ralentiza: 0.3 }, veneno: { dps: 4, dur: 3 } },
  },
  houndour: {
    lmb: { nombre: 'Mega Burning Jealousy', rafaga: 2, cadaRafaga: 0.06, abanico: 0.12, dano: 3.4 },
    rmb: { nombre: 'Mega Foul Play', cadena: 2, dano: 9.5 },
    esp: { nombre: 'Mega Flame Wheel', rastroFuego: true, dano: 2, vel: 2.0 },
    q: { nombre: 'Mega Fire Fang', siempreQuema: true, explosion: 48, danoParede: 12, fuegoSuelo: true, lanza: 210 },
    e: { nombre: 'Mega Inferno', forma: 'infierno', tipo: 'FIRE', dano: 7, radio: 26, pilares: 8, paso: 9, carga: 0.25, quema: { dps: 2, dur: 3, max: 3 } },
  },
  larvitar: {
    lmb: { nombre: 'Mega Crunch', dano: 6.6, alcance: 60 },
    rmb: { nombre: 'Mega Sandstorm', radio: 125, dur: 8, tick: 3 },
    esp: { nombre: 'Mega Bulldoze', dist: 140, dano: 5 },
    q: { nombre: 'Mega Sand Tomb', alcance: 170, ancho: 28, veces: 2 },
    e: { nombre: 'Mega Rock Wrecker', forma: 'vorticeArena', tipo: 'ROCK', dano: 26, radio: 70, requiereTormenta: true },
  },




  charmander: {
    lmb: { nombre: 'Mega Heat Wave', rafaga: 2, cadaRafaga: 0.07, abanico: 0.05, dano: 4.4, escala: 1.6, explosion: { radio: 20 } },
    rmb: { nombre: 'Mega Inferno', tipo: 'DRAGON', dano: 19.2, alcance: 150, angulo: 66, dur: 1.5, quema: { dps: 2, dur: 3, max: 3 } },
    esp: { nombre: 'Mega Dragon Rush', dano: 4.8, dist: 150, empuje: 60 },
    q: { nombre: 'Mega Magma Storm', tipo: 'DRAGON', dano: 11.2, radio: 74, empuje: 100, quema: { dps: 2, dur: 3, max: 3 } },
    e: { nombre: 'Mega Sky Drop', forma: 'agarre', tipo: 'DRAGON', dano: 34, dist: 190, radio: 62, aturde: 0.6 },
  },
  onix: {
    lmb: { nombre: 'Mega Iron Tail', dano: 6.4, alcance: 84, combo: 4, remate: { dano: 4.0, empuje: 190, aturde: 0.4 } },
    rmb: { nombre: 'Mega Gyro Ball', dano: 13.6, dist: 165, empuje: 120 },
    esp: { nombre: 'Mega Drill Run', dano: 7.2, radio: 54, rapidez: 2 },
    q: { nombre: 'Mega Fissure', dano: 9.6, radio: 116, aturde: 0.45 },
    e: { nombre: 'Mega Earthquake', forma: 'sismo', tipo: 'GROUND', dano: 14.4, danoQueda: 9.6, alcance: 220, radio: 90, dur: 3.5, cada: 0.5, tiron: 90 },
  },
  riolu: {
    lmb: { nombre: 'Mega Bone Rush', dano: 5.4, alcance: 70 },
    rmb: { nombre: 'Mega Aura Sphere', dano: 8.5, rafaga: 2, cadaRafaga: 0.16, escala: 2.4, teledirigido: 3.5, explosion: { radio: 30 } },
    esp: { nombre: 'Mega Detect', dano: 7.2, dist: 165 },
    q: { nombre: 'Mega Drain Punch', dano: 17.6, golpes: 9, dur: 1, alcance: 60 },
    e: { nombre: 'Mega Bonemerang', forma: 'hueso', tipo: 'FIGHTING', dano: 27.2, vel: 340, dur: 3, rebotes: 4, aturde: 0.6 },
  },
  abra: {
    lmb: { nombre: 'Mega Psyshock', dano: 2.6, rafaga: 4, cadaRafaga: 0.06, abanico: 0.07, escala: 1.6, teledirigido: 1.2 },
    rmb: { nombre: 'Mega Psycho Cut', dano: 12.8, escala: 2, radio: 8, explosion: { radio: 34 }, confunde: 0.8 },
    esp: { nombre: 'Mega Psycho Shift', dist: 165, cd: 6, dano: 4.8, radio: 40 },
    q: { nombre: 'Mega Future Sight', n: 3, area: 46, cada: 0.22, dano: 6.2 },
    e: { nombre: 'Mega Psychic', forma: 'levitar', tipo: 'PSYCHIC', dano: 26.4, alcance: 260, golpes: 3, aturde: 0.5 },
  },
  tynamo: {
    lmb: { nombre: 'Mega Thunder Punch', dano: 5.6, alcance: 66, combo: 4, remate: { dano: 4.0, empuje: 150, aturde: 0.35 } },
    rmb: { nombre: 'Mega Zap Cannon', dano: 8.5, rafaga: 2, cadaRafaga: 0.18, escala: 2.6, explosion: { radio: 40 }, aturde: 0.3 },
    esp: { nombre: 'Mega Supercell Slam', dano: 7.2, dist: 160, empuje: 70 },
    q: { nombre: 'Mega Electroweb', dano: 7.2, radio: 104, ralentiza: 0.6, ralentizaDur: 2.5 },
    e: { nombre: 'Mega Bind', forma: 'enrollar', tipo: 'ELECTRIC', dano: 24, dist: 180, golpes: 4, aturde: 0.3 },
  },
  swablu: {
    lmb: { nombre: 'Mega Fairy Wind', tipo: 'FAIRY', rafaga: 2, cadaRafaga: 0.08, dano: 3.4, escala: 1.5 },
    rmb: { nombre: 'Mega Disarming Voice', confunde: 2.4, dano: 9, alcance: 170, angulo: 72 },
    esp: { nombre: 'Mega Dual Wingbeat', dano: 5.6, dist: 160, empuje: 60 },
    q: { nombre: 'Mega Cotton Spore', absorbe: 30, dur: 4 },
    e: { nombre: 'Mega Perish Song', tipo: 'FAIRY', dano: 13.6, ondas: [40, 80, 120, 160], aturde: 0.4, repite: 1.1 },
  },
  mewtwo: {
    lmb: { nombre: 'Mega Confusion', dano: 4.5, alcance: 240, radio: 4.5 },
    rmb: { nombre: 'Mega Psystrike', forma: 'estallido', tipo: 'PSYCHIC', estilo: 'psico', n: 14, dano: 7, vel: 400, alcance: 170, radio: 5, escala: 1.4, empuje: 90, aturde: 0.15, anula: 40, bloqueo: 0.35, coste: 30, cd: 7, anim: 'Charge', lanzar: 0.18 },
    esp: { nombre: 'Mega Barrier', dur: 2.2, radio: 26, acelera: { vel: 1.6, dur: 3 } },
    q: { nombre: 'Mega Psywave', rafaga: 7, abanicos: [0, 0.3, -0.26, 0.5, -0.46, 0.7, -0.66], anilla: { dur: 3.5, frena: [0.3, 0.6], aturde: 1.1 } },
    e: { nombre: 'Mega Psycho Boost', forma: 'bolaGigante', tipo: 'PSYCHIC', dano: 30, vel: 240, alcance: 340, radio: 26, carga: 1, teledirigido: 1.4, aturde: 0.5, explosion: { radio: 84 } },
  },
  buneary: {
    lmb: { nombre: 'Mega Power-Up Punch', dano: 5.1, alcance: 62, combo: 4, remate: { dano: 4.0, empuje: 130, aturde: 0.2 } },
    rmb: { nombre: 'Mega High Jump Kick', dano: 18.4, alcance: 165, radio: 36, choque: 13 },
    esp: { nombre: 'Mega Feint', dist: 145, acelera: { vel: 1.5, dur: 2.4 } },
    q: { nombre: 'Mega Charm', dano: 4.0, rafaga: 2, cadaRafaga: 0.12, debilita: { f: 0.6, dur: 5 } },
    e: { nombre: 'Mega Sky Uppercut', forma: 'patada', tipo: 'FAIRY', dano: 8.8, alcance: 150, radio: 34, cadena: 3, aturde: 0.4, blindaje: 0.4 },
  },
  gastly: {
    lmb: { nombre: 'Mega Lick', dano: 5, stacks: 3, paralisa: 0.9, alcance: 80 },
    rmb: { nombre: 'Mega Shadow Ball', forma: 'pesadeloDuplo', entidade: 'chamaRoxa', dividir: true, dano: 14, dur: 0.5, coste: 25, cd: 5, anim: 'Charge' },
    esp: { nombre: 'Mega Shadow Portal', dist: 180, ar: 2 },
    e: { nombre: 'Nightmare Bomb', forma: 'bolaPesadelo', dano: 24, raioEscuro: 260, radio: 100, carga: 0.85, vel: 300, alcance: 380, contraSono: 1.1, aturde: 0.7, anim: 'Charge' },
  },
  zeraora: {
    lmb: { nombre: 'Mega Plasma Fists', dano: 5.8, raioFinal: 6 },
    rmb: { nombre: 'Mega Volt Switch', dano: 11, danoChegada: 9, raioChegada: 48, cadeiaChegada: 7 },
    esp: { nombre: 'Mega Wild Charge', dano: 7, dist: 170, aturde: 0.35 },
    q: { nombre: 'Mega Discharge', dano: 5.5, saltos: 5, decai: 0.8, aturde: 0.4 },
    e: { nombre: 'Thunder Cage', requierePlasma: true, forma: 'jaulaTrovao', dano: 44, radio: 72, dur: 2.2, cada: 0.3, alcance: 300, anim: 'Attack' },
  },
  sceptile: {
    lmb: { nombre: 'Mega Leaf Blade', dano: 5.4 },
    rmb: { nombre: 'Mega Dragon Pulse', dano: 15, largura: 12, alcance: 340, vel: 600, explosion: { radio: 66 } },
    esp: { nombre: 'Mega Leaf Hurricane', dano: 7.5, alcance: 95 },
    q: { nombre: 'Mega X-Scissor', dano: 19, alcance: 145 },
    e: { nombre: 'Tail Missile', forma: 'caudaMissil', tipo: 'GRASS', dano: 38, radio: 72, trava: 0.6, vel: 440, alcance: 420, aturde: 0.6, anim: 'Charge' },
  },
  // ---------------------------------------------------------------- Megas novas (ults em engine/formasMega.js)
  mawile: {
    lmb: { nombre: 'Mega Iron Head', dano: 6.2, alcance: 54 },
    rmb: { nombre: 'Mega Twin Snare', mega: true, dano: 9, alcance: 112, angulo: 150 },
    esp: { nombre: 'Mega Play Rough', mega: true, dano: 7, alcance: 155, aturde: 1.1, cd: 5 },
    q: { nombre: 'Mega Steel Spin', mega: true, dano: 11, radio: 72, escudo: 18 },
    e: { nombre: 'Mega Twin Jaws', mega: true, dano: 32, alcance: 130, angulo: 120 },
  },
  skarmory: {
    lmb: { nombre: 'Mega Steel Wing', dano: 5.8, alcance: 58 },
    rmb: { nombre: 'Mega Wind Blades', mega: true, dano: 10, alcance: 240, danoTrilha: 2 },
    esp: { nombre: 'Mega Steel Crescent', mega: true, dano: 2.5, dist: 130, danoTrilha: 1.5, cd: 5 },
    q: { nombre: 'Mega Feather Burst', mega: true, dano: 9, dur: 2, radio: 90 },
    e: { nombre: 'Mega Blade Hurricane', mega: true, dano: 28, alcance: 300, danoFuracao: 2.5 },
  },
  carvanha: {
    lmb: { nombre: 'Mega Crunch', dano: 6.4, alcance: 50 },
    rmb: { nombre: 'Mega Fin Rip', mega: true, dano: 9, dist: 190, sangra: 3 },
    esp: { nombre: 'Mega Aqua Jet', dano: 6, dist: 180, cd: 4 },
    q: { nombre: 'Mega Abyss Hunter', mega: true, dano: 12, dur: 2, escudo: 14 },
    e: { nombre: 'Mega Feeding Frenzy', mega: true, dano: 30, alcance: 110, sangra: 2 },
  },
  snorunt: {
    lmb: { nombre: 'Mega Powder Snow', dano: 5.8, rafaga: 2, cadaRafaga: 0.08 },
    rmb: { nombre: 'Avalanche Snowball', forma: 'bolaNeve', tipo: 'ICE', mega: true, dano: 16, radio: 78, congela: 1.4, vel: 190, alcance: 260 },
    esp: { nombre: 'Mega Gyro Ball', mega: true, dano: 6.5, dist: 190, quebra: 3.2, cd: 5 },
    q: { nombre: 'Glacial Fortress', forma: 'escudoGlacial', tipo: 'ICE', mega: true, dur: 3.5, danoEstalactite: 12, n: 12, alcance: 170, escudo: 22, cd: 11 },
    e: { nombre: 'Abyssal Jaws', forma: 'abismoMandibula', tipo: 'ICE', mega: true, dano: 40, alcance: 230, angulo: 95, radio: 68, aturde: 1.5, puxa: 2600, totem: 3 },
  },

  ralts: {
    lmb: { nombre: 'Mega Moonblast Shard', dano: 5.8, rafaga: 2, cadaRafaga: 0.08 },
    rmb: { nombre: 'Pixie Supernova', forma: 'estrelasPixie', tipo: 'FAIRY', mega: true, dano: 10, alcance: 240, silencio: 1.2, raio: { forma: 'telecinese', nombre: 'Mega Astral Lasso', tipo: 'FAIRY', dano: 16, alcance: 220, lanza: 240 } },
    esp: { nombre: 'Mega Teleport', dist: 140, cd: 6 },
    q: { nombre: 'Astral Dominance', mega: true, radio: 95, dur: 5, cura: 0.025 },
    e: { nombre: 'Gravitational Cataclysm', mega: true, dano: 22, radio: 110, dur: 2.2, porVida: 0.12 },
  },
  absol: {
    lmb: { nombre: 'Mega Night Slash', dano: 6.2, alcance: 58 },
    rmb: { nombre: 'Ruin Slash', mega: true, dano: 10, alcance: 640 },
    esp: { nombre: 'Mega Sucker Punch', dano: 6, dist: 170, cd: 4 },
    q: { nombre: 'Disaster Vision', mega: true, dur: 0.8 },
    e: { nombre: 'Mega Doom Storm', mega: true, dano: 48, radio: 110 },
  },

  slowpoke: {
    lmb: { nombre: 'Mega Psyshock Pulse', dano: 5.8, rafaga: 2, cadaRafaga: 0.1 },
    rmb: { nombre: 'Torpor Bubble', mega: true, dano: 8, radio: 64, duerme: 1.8 },
    esp: { nombre: 'Mega Slack Off Slide', dist: 130, cd: 5 },
    q: { nombre: 'Inviolable Shell', mega: true, dur: 2.4, regen: 0.012, devolve: 0.4, dano: 6, radio: 80, raioPorHit: 12, danoPorHit: 2.5, cd: 13 },
    e: { nombre: 'Relentless Psy Vortex', mega: true, dur: 3, radio: 170, danoTick: 3.4, puxa: 1150 },
  },
  drampa: {
    lmb: { nombre: 'Mega Dragon Breath', dano: 5.8, rafaga: 2, cadaRafaga: 0.08 },
    rmb: { nombre: 'Mega Hyper Voice', mega: true, dano: 18, alcance: 190, angulo: 80, dur: 3 },
    esp: { nombre: 'Mega Fly', dano: 12, radio: 46, dur: 1.3, aturde: 0.4, cd: 8 },
    q: { nombre: 'Winged Barrier', mega: true, radio: 100, dur: 4 },
    e: { nombre: 'Black Thundercloud', forma: 'nuvemNegra', tipo: 'ELECTRIC', mega: true, dano: 7, radio: 95, dur: 6, vel: 100, cada: 0.5 },
  },

  tatsugiri: {
    lmb: { nombre: 'Mega Water Shuriken', dano: 5.6, rafaga: 2, cadaRafaga: 0.08 },
    rmb: { nombre: 'Mega Flip Turn', mega: true, dano: 10, alcance: 180, radio: 40, danoBolha: 3.5 },
    esp: { nombre: 'Mega Slippery Slide', mega: true, dist: 170, cd: 4 },
    q: { nombre: 'Mega Dragon Scale', mega: true, dano: 13, n: 5, abre: 0.7, fura: true, silencia3: true, alcance: 260 },
    e: { nombre: 'Mega Twin Turret', mega: true, dano: 18, danoTiro: 3.1, dur: 5, escudo: 30 },
  },
  bulbasaur: {
    lmb: { nombre: 'Mega Petal Blizzard', dano: 3.4, escala: 1.9 },
    rmb: { nombre: 'Sleep Sludge', dano: 13, duerme: 1.2, radio: 26 },
    esp: { nombre: 'Vine Throw', forma: 'telecinese', vinha: true, tipo: 'GRASS', dano: 8, alcance: 170, lanza: 190, cd: 7, anim: 'Charge' },
    q: { nombre: 'Ingrain + Sludge Wave', forma: 'arraigoOnda', onda: { radio: 95, dano: 9, empuje: 150, veneno: { dps: 3, dur: 3 } }, coste: 30, cd: 13 },
    e: { nombre: 'Mega Solar Beam', forma: 'raioSolar', tipo: 'GRASS', dano: 30, carga: 0.95, largo: 340, ancho: 30, anchoVisual: 92, dur: 2.4, empuje: 90 },
  },
};
