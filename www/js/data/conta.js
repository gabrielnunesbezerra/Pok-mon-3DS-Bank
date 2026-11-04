// Progresso salvo no aparelho (e na conta, ver nube/social.js): todos os Pokémon e ícones já vêm liberados;
// o que se ganha são os shinies. Ao entrar numa partida o seu Pokémon tem 1% de chance de nascer shiny,
// e quando sai um shiny ele fica liberado para sempre (dá para ligar ou desligar no seletor).
import { ROSTER } from './pokemon.js';

export const CHANCE_SHINY = 0.01;
const CLAVE = 'pkconfront.conta';

let cache = null;
const oyentes = new Set();
export const alCambiar = fn => { oyentes.add(fn); return () => oyentes.delete(fn); };

export function progreso() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch { cache = null; }
  if (!cache || cache.v !== 2 || typeof cache.shinies !== 'object' || !cache.shinies || Array.isArray(cache.shinies)) cache = { v: 2, shinies: {}, icono: null };
  for (const id of Object.keys(cache.shinies)) if (!ROSTER.some(p => p.id === id)) delete cache.shinies[id];
  if (cache.icono && !ROSTER.some(p => p.id === cache.icono)) cache.icono = null;
  return cache;
}
function guardar(p) {
  cache = p;
  try { localStorage.setItem(CLAVE, JSON.stringify(p)); } catch { /* sem armazenamento */ }
  for (const fn of oyentes) fn(p);
}

export const desbloqueado = () => true;
export const iconoLiberado = () => true;
export const shinyLiberado = id => !!progreso().shinies[id];
export const shiniesLiberados = () => Object.keys(progreso().shinies);

// sorteio do 1% na entrada da partida; se sair, libera o shiny na conta. Devolve { shiny, novo }
export function sortearShiny(id, querShiny = false, rnd = Math.random) {
  if (querShiny && shinyLiberado(id)) return { shiny: true, novo: false };
  if (rnd() >= CHANCE_SHINY) return { shiny: false, novo: false };
  const novo = !shinyLiberado(id);
  if (novo) { const p = progreso(); p.shinies[id] = true; guardar(p); }
  return { shiny: true, novo };
}

export function elegirIcono(id) { if (!ROSTER.some(p => p.id === id)) return false; const p = progreso(); p.icono = id; guardar(p); return true; }
export const icono = () => progreso().icono ?? 'charmander';

// junta o progresso salvo na conta com o do aparelho (shiny liberado em qualquer um dos dois fica)
export function fundir(remoto) {
  if (!remoto) return false;
  const p = progreso();
  let mudou = false;
  for (const id of Object.keys(remoto.shinies ?? {})) if (ROSTER.some(q => q.id === id) && !p.shinies[id]) { p.shinies[id] = true; mudou = true; }
  if (remoto.icono && !p.icono) { p.icono = remoto.icono; mudou = true; }
  if (mudou) guardar(p);
  return mudou;
}
export function reiniciar() { guardar({ v: 2, shinies: {}, icono: null }); }
