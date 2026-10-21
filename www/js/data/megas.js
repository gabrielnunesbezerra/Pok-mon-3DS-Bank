// Versões turbinadas das skills de cada Mega: mais alcance, mais golpes e efeitos novos,
// não só mais dano. Entram por cima do kit da última forma (ver Lutador.kitActual).
export const MEGA_KITS = {
  charmander: {
    lmb: { nombre: 'Dragon Ember', rafaga: 2, cadaRafaga: 0.07, abanico: 0.05, dano: 5.5, escala: 1.6, explosion: { radio: 20 } },
    rmb: { nombre: 'Dragon Flamethrower', tipo: 'DRAGON', dano: 24, alcance: 150, angulo: 66, dur: 1.5, quema: { dps: 2, dur: 3, max: 3 } },
    esp: { nombre: 'Dragon Rush', dano: 6, dist: 150, empuje: 60 },
    q: { nombre: 'Dragon Spin', tipo: 'DRAGON', dano: 14, radio: 74, empuje: 100, quema: { dps: 2, dur: 3, max: 3 } },
    e: { nombre: 'Dragon Burn', tipo: 'DRAGON', dano: 30, largo: 400, ancho: 32, empuje: 40 },
  },
  onix: {
    lmb: { nombre: 'Adamant Tail', dano: 8, alcance: 84, combo: 4, remate: { dano: 5, empuje: 190, aturde: 0.4 } },
    rmb: { nombre: 'Colossal Gyro Ball', dano: 17, dist: 165, empuje: 120 },
    esp: { nombre: 'Deep Dig', dano: 9, radio: 54, rapidez: 2 },
    q: { nombre: 'Magnitude Quake', dano: 12, radio: 116, aturde: 0.45 },
    e: { nombre: 'Titan Slam', dano: 31, radio: 60, sigue: 175, aturde: 0.7 },
  },
  riolu: {
    lmb: { nombre: 'Aura Bone Rush', dano: 6.8, alcance: 70 },
    rmb: { nombre: 'Twin Aura Sphere', dano: 15, rafaga: 2, cadaRafaga: 0.16, escala: 2.4, teledirigido: 3.5, explosion: { radio: 30 } },
    esp: { nombre: 'Mach Speed', dano: 9, dist: 165 },
    q: { nombre: 'Flurry Combat', dano: 22, golpes: 9, dur: 1, alcance: 60 },
    e: { nombre: 'Aura Cataclysm', dano: 33, largo: 345, ancho: 36, anchoVisual: 54, dur: 1.05 },
  },
  buneary: {
    lmb: { nombre: 'Power-Up Punch', dano: 6.4, alcance: 62, combo: 4, remate: { dano: 5, empuje: 130, aturde: 0.2 } },
    rmb: { nombre: 'Mega High Jump Kick', dano: 23, alcance: 165, radio: 36, choque: 13 },
    esp: { nombre: 'Hyper Agility', dist: 145, acelera: { vel: 1.5, dur: 2.4 } },
    q: { nombre: 'Heart Charm', dano: 5, rafaga: 2, cadaRafaga: 0.12, debilita: { f: 0.6, dur: 5 } },
    e: { nombre: 'Mega Bounce', dano: 34, radio: 48, alto: 200, sigue: 175, aturde: 0.75 },
  },
};
