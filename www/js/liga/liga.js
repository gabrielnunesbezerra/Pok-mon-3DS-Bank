// Liga Pokémon: só os iniciais começam liberados. Cada vitória contra um rival conta:
// 1 vitória desbloqueia o Pokémon, 2 liberam o ícone de perfil dele e 3 liberam o shiny.
// A próxima luta contra o mesmo rival fica mais difícil (fácil, médio, difícil).
// Os circuitos (colunas) abrem em ordem: é preciso vencer cada rival da coluna pelo menos uma vez.
import { ROSTER } from '../data/pokemon.js';

export const LIGA = {
  iniciales: ['bulbasaur', 'charmander', 'squirtle'],
  circuitos: [
    { id: 'c1', nombre: 'ROOKIE CIRCUIT', arena: 'estadio', cor: '#7dd3fc', rivales: ['zubat', 'seedot', 'buneary', 'tynamo'] },
    { id: 'c2', nombre: 'EARTH CIRCUIT', arena: 'ruinas', cor: '#86efac', rivales: ['abra', 'riolu', 'geodude', 'froakie', 'feebas'] },
    { id: 'c3', nombre: 'VOLCANO CIRCUIT', arena: 'crater', cor: '#fb923c', rivales: ['magikarp', 'onix', 'munchlax', 'poltchageist', 'swablu'] },
    { id: 'c4', nombre: 'LEGEND CIRCUIT', arena: 'neon', cor: '#c084fc', rivales: ['duraludon', 'porygon', 'veluza', 'mewtwo'] },
    { id: 'c5', nombre: 'SPIRIT CIRCUIT', arena: 'neon', cor: '#c084fc', rivales: ['basculegion', 'basculegionf', 'sneasler'] },
  ],
};
export const NIVEL_POR_VITORIA = ['facil', 'normal', 'dificil'];
export const NOMBRE_DIFICULTAD = { facil: 'EASY', normal: 'MEDIUM', dificil: 'HARD' };
const EN_LIGA = new Set(LIGA.circuitos.flatMap(c => c.rivales));
const CLAVE = 'pkconfront.liga';

let cache = null;
const oyentes = new Set();
export const alCambiar = fn => { oyentes.add(fn); return () => oyentes.delete(fn); };

export function progreso() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch { cache = null; }
  if (!cache || cache.v !== 1 || typeof cache.vencidos !== 'object' || !cache.vencidos || Array.isArray(cache.vencidos)) cache = { v: 1, vencidos: {}, icono: null };
  // progresso salvo por versões antigas: só rivais que existem e de 0 a 3 vitórias
  for (const [id, v] of Object.entries(cache.vencidos)) { const n = Math.min(3, Math.max(0, v | 0)); if (!EN_LIGA.has(id) || !n) delete cache.vencidos[id]; else cache.vencidos[id] = n; }
  if (cache.icono && !ROSTER.some(p => p.id === cache.icono)) cache.icono = null;
  return cache;
}
function guardar(p) {
  cache = p;
  try { localStorage.setItem(CLAVE, JSON.stringify(p)); } catch { /* sem armazenamento */ }
  for (const fn of oyentes) fn(p);
}

export const vitorias = id => progreso().vencidos[id] ?? 0;
export const enLiga = id => EN_LIGA.has(id);
export const desbloqueado = id => LIGA.iniciales.includes(id) || !EN_LIGA.has(id) || vitorias(id) >= 1;
export const iconoLiberado = id => LIGA.iniciales.includes(id) || vitorias(id) >= 2;
// os iniciais já começam com o shiny liberado
export const shinyLiberado = id => LIGA.iniciales.includes(id) || vitorias(id) >= 3;
export const desbloqueados = () => ROSTER.filter(p => desbloqueado(p.id)).map(p => p.id);
export const completo = c => c.rivales.every(id => vitorias(id) >= 1);
export const ligaCompleta = () => LIGA.circuitos.every(completo);
// índice do primeiro circuito ainda não vencido (os anteriores seguem abertos para revanches)
export function circuitoAbierto() { const k = LIGA.circuitos.findIndex(c => !completo(c)); return k < 0 ? LIGA.circuitos.length : k; }
export function circuitoDe(id) { return LIGA.circuitos.find(c => c.rivales.includes(id)) ?? null; }
export function estadoRival(id) {
  const k = LIGA.circuitos.findIndex(c => c.rivales.includes(id));
  if (k < 0) return 'fuera';
  if (vitorias(id) >= 1) return 'vencido';
  return k <= circuitoAbierto() ? 'abierto' : 'cerrado';
}
export const nivelProximo = id => NIVEL_POR_VITORIA[Math.min(2, vitorias(id))];

// registra uma vitória e diz o que foi liberado
export function vencer(id) {
  const p = progreso(), antes = p.vencidos[id] ?? 0, n = Math.min(3, antes + 1);
  const completoAntes = ligaCompleta();
  p.vencidos[id] = Math.max(antes, n);
  guardar(p);
  const premios = [];
  if (antes < 1 && n >= 1) premios.push('pokemon');
  if (antes < 2 && n >= 2) premios.push('icono');
  if (antes < 3 && n >= 3) premios.push('shiny');
  if (!completoAntes && ligaCompleta()) premios.push('liga');
  return premios;
}
export function elegirIcono(id) { const p = progreso(); if (!iconoLiberado(id)) return false; p.icono = id; guardar(p); return true; }
export const icono = () => progreso().icono ?? LIGA.iniciales[0];

// junta o progresso salvo na conta com o do aparelho (fica o maior de cada)
export function fundir(remoto) {
  if (!remoto?.vencidos) return false;
  const p = progreso();
  let mudou = false;
  for (const [id, v] of Object.entries(remoto.vencidos)) if (EN_LIGA.has(id) && (v | 0) > (p.vencidos[id] ?? 0)) { p.vencidos[id] = Math.min(3, v | 0); mudou = true; }
  if (remoto.icono && !p.icono) { p.icono = remoto.icono; mudou = true; }
  if (mudou) guardar(p);
  return mudou;
}
export function reiniciar() { guardar({ v: 1, vencidos: {}, icono: null }); }
