// Constantes do motor. A arena roda a 60 quadros por segundo e usa unidades de "pixel do mundo"
// num mundo de 960x540.
export const FPS = 60;
export const DT = 1 / FPS;
export const LEVEL = 50;
// Os PS são multiplicados para a luta durar mais que nos jogos de turno (cada golpe tem recarga própria)
export const HP_SCALE = 4;
// Quanto tempo vale um "turno" dos jogos: clima, telas, veneno, Leftovers etc.
export const FIELD_TURN = 4;
// Turno curto para o que deixa o Pokémon sem agir (sono, confusão, preso)
export const ACTION_TURN = 2;

export const WORLD_W = 960;
export const WORLD_H = 540;
// Área jogável (o resto é arquibancada e lugar dos treinadores)
export const FIELD = { x: 92, y: 118, w: 776, h: 392 };

export const STAMINA_MAX = 100;
export const GLOBAL_COOLDOWN = 0.9;
export const STAMINA_REGEN = 9;
export const DODGE = { cost: 20, duration: 0.2, speed: 560, iframes: 0.26, cooldown: 0.5 };
export const MEGA_GAUGE_MAX = 100;
export const MEGA_RESPONSE_WINDOW = 1.8;
export const SWITCH_COOLDOWN = 3;
export const TIME_LIMIT = 240;
