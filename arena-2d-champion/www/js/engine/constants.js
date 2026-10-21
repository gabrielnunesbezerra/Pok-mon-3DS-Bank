// Constantes do motor. A arena roda a 60 quadros por segundo e usa unidades de "pixel do mundo"
// num mundo de 1920x1320 (a câmera mostra só uma parte e segue os Pokémon).
export const FPS = 60;
export const DT = 1 / FPS;
export const LEVEL = 50;
// Os PS são multiplicados para a luta durar mais que nos jogos de turno (cada golpe tem recarga própria)
export const HP_SCALE = 4;
// Quanto tempo vale um "turno" dos jogos: clima, telas, veneno, Leftovers etc.
export const FIELD_TURN = 4;
// Turno curto para o que deixa o Pokémon sem agir (sono, confusão, preso)
export const ACTION_TURN = 2;

export const WORLD_W = 1920;
export const WORLD_H = 1320;
// Área jogável (o resto é arquibancada e lugar dos treinadores). A câmera segue os Pokémon.
export const FIELD = { x: 180, y: 250, w: 1560, h: 880 };

export const STAMINA_MAX = 100;
export const GLOBAL_COOLDOWN = 0.55;
export const STAMINA_REGEN = 13;
// Esquiva é um dash rente ao chão (não um pulo)
export const DODGE = { cost: 20, duration: 0.2, speed: 760, iframes: 0.26, cooldown: 0.5 };
export const MEGA_GAUGE_MAX = 100;
export const MEGA_RESPONSE_WINDOW = 1.8;
export const SWITCH_COOLDOWN = 3;
export const TIME_LIMIT = 240;
// Mudanças de atributo são temporárias: depois de BOOST_DURATION segundos começam a voltar ao normal,
// um estágio a cada BOOST_STEP segundos
export const BOOST_DURATION = 16;
export const BOOST_STEP = 3;
