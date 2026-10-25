// Pokédex: grade com os 9 Pokémon e, ao lado, cada estágio (e Mega) com atributos e as 5 skills.
import { ANCHO, ALTO, UI, hex } from '../config.js';
import { ROSTER, ROLES } from '../data/pokemon.js';
import { TIPOS } from '../data/regras.js';
import { fondoMenu, texto, marco, rect } from '../render/pixel.js';
import { etapaDe } from '../engine/lutador.js';
import { sfx } from '../audio.js';
import { centrada } from './centrar.js';

const FORMA = {
  proyectil: 'Projectile', chorro: 'Beam', helice: 'Spiral beam', cono: 'Cone', pulso: 'Pulse', tajo: 'Melee combo', golpe: 'Melee strike',
  rafaga: 'Flurry', patada: 'Leap kick', meteoro: 'Sky slam', vuelo: 'Vanish', erupcion: 'Eruptions', lluvia: 'Falling rocks',
  burbujas: 'Bubble stream', caparazon: 'Shell spin', viento: 'Sound wave', dash: 'Dash', embestidas: 'Cross dashes', bombaLodo: 'Lobbed bomb', cortesSuelo: 'Ground slashes', jabLuna: 'Curved lunge + jab',
  plantaFeroz: 'Root waves', chapoteo: 'Nothing?', laco: 'Grab & throw', geiser: 'Geyser pull', torreta: 'Turret', espejo: 'Reflect hits', curaAnillo: 'Heal ring', recuperar: 'Heal', estallido: 'Radial burst', lanzaTorretas: 'Turret volley', potenciar: 'Stack buff', escudo: 'Shield', explosion: 'Blast', trampa: 'Trap', torbellino: 'Tornado', arraigo: 'Root', crecimiento: 'Power up', descanso: 'Rest', clones: 'Decoys', humo: 'Smoke',
};
const SLOTS = [['lmb', 'LMB'], ['rmb', 'RMB'], ['esp', 'SPC'], ['q', 'Q'], ['e', 'E']];
const COLS = 4;
const CARD = { w: 40, h: 40, gap: 3, x0: 8, y0: 34 };

export class Pokedex {
  constructor(app) { this.app = app; this.t = 0; this.cursor = 0; this.etapa = 0; }
  entrar() { for (const p of ROSTER) for (const f of [p, ...(p.evoluciones ?? [])]) { this.app.bank.hoja(f.dex, 'Idle'); this.app.bank.retrato(f.dex); if (f.mega) { this.app.bank.hoja(f.mega.dex, 'Idle'); this.app.bank.retrato(f.mega.dex); } } }
  atras() { sfx('atras'); this.app.ir('titulo', { menu: 'principal' }); }
  formas() {
    const p = ROSTER[this.cursor];
    const fs = [p, ...(p.evoluciones ?? [])].map((f, i) => ({ f: etapaDe(p, i), mega: false, i }));
    const ult = fs.at(-1).f;
    if (ult.mega) fs.push({ f: ult, mega: true, i: fs.length - 1 });
    return fs;
  }
  tecla(c, nueva) {
    if (!nueva) return;
    if (c === 'Escape' || c === 'Backspace') return this.atras();
    const n = ROSTER.length, dx = c === 'ArrowRight' || c === 'KeyD' ? 1 : c === 'ArrowLeft' || c === 'KeyA' ? -1 : 0, dy = c === 'ArrowDown' || c === 'KeyS' ? COLS : c === 'ArrowUp' || c === 'KeyW' ? -COLS : 0;
    if (dx || dy) { this.cursor = (this.cursor + dx + dy + n) % n; this.etapa = 0; sfx('seleccion'); }
    if (c === 'Tab' || c === 'Enter' || c === 'Space') { this.etapa = (this.etapa + 1) % this.formas().length; sfx('seleccion'); }
  }
  caja(i) { return { x: CARD.x0 + (i % COLS) * (CARD.w + CARD.gap), y: CARD.y0 + Math.floor(i / COLS) * (CARD.h + CARD.gap), w: CARD.w, h: CARD.h }; }
  puntero(tipo, p) {
    if (tipo !== 'down') return;
    const dentro = (c) => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h;
    for (let i = 0; i < ROSTER.length; i++) if (dentro(this.caja(i))) { this.cursor = i; this.etapa = 0; sfx('seleccion'); return; }
    if (dentro({ x: 4, y: 4, w: 70, h: 18 })) return this.atras();
    const fs = this.formas();
    fs.forEach((_, i) => { if (dentro({ x: 206 + i * 54, y: 30, w: 50, h: 50 })) { this.etapa = i; sfx('seleccion'); } });
  }
  actualizar(dt) { this.t += dt; }
  dibujar(g) {
    const bank = this.app.bank, t = this.t;
    fondoMenu(g, ANCHO, ALTO);
    marco(g, 0, 0, ANCHO, 26, 'panel');
    marco(g, 4, 4, 70, 18); texto(g, '< MENU', 39, 13, { tam: 7, align: 'center', base: 'middle' });
    texto(g, 'POKÉDEX', ANCHO / 2, 13, { tam: 12, color: UI.amarillo, borde: 3, align: 'center', base: 'middle' });
    ROSTER.forEach((p, i) => {
      const c = this.caja(i), foco = i === this.cursor;
      marco(g, c.x, c.y, c.w, c.h, foco ? 'oro' : 'azul');
      const img = bank.retrato(p.dex);
      if (img) g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, c.x + 4, c.y + 2, 32, 32);
      texto(g, p.nombre, c.x + c.w / 2, c.y + c.h - 4, { tam: 5, align: 'center', base: 'bottom', borde: 2, max: c.w - 4 });
    });
    const p = ROSTER[this.cursor], fs = this.formas();
    // estágios
    fs.forEach(({ f, mega }, i) => {
      const x = 206 + i * 54, y = 30, sel = i === this.etapa;
      marco(g, x, y, 50, 50, sel ? 'oro' : 'azul');
      const dex = mega ? f.mega.dex : f.dex;
      const img = bank.retrato(dex);
      if (img) g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, x + 5, y + 2, 40, 40);
      texto(g, mega ? 'MEGA' : `STAGE ${i + 1}`, x + 25, y + 48, { tam: 5, align: 'center', base: 'bottom', color: sel ? UI.textoOscuro : UI.suave });
    });
    const sel = fs[this.etapa], f = sel.f, nombre = sel.mega ? f.mega.nombre : f.nombre, dex = sel.mega ? f.mega.dex : f.dex;
    const tipos = sel.mega ? f.mega.tipos ?? f.tipos : f.tipos;
    const hp = Math.round(f.hp * 1.8), vel = f.vel + (sel.mega ? f.mega.vel : 0), atk = f.atk + (sel.mega ? f.mega.atk : 0), def = f.def + (sel.mega ? f.mega.def : 0);
    marco(g, 206, 86, 428, 266, 'panel');
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(262, 160, 26, 6, 0, 0, 7); g.fill();
    bank.dibujar(g, dex, 'Idle', t, 262, 160, 2, { fila: 2 });
    texto(g, nombre, 262, 168, { tam: 9, align: 'center', borde: 3, max: 100 });
    tipos.forEach((tp, k) => { const x = 262 - tipos.length * 15 + k * 30; rect(g, x - 1, 183, 30, 11, '#04102c'); rect(g, x, 184, 28, 9, hex(TIPOS[tp] ?? 0xffffff)); texto(g, tp, x + 14, 188.5, { tam: 5, align: 'center', base: 'middle', borde: 1 }); });
    texto(g, `${ROLES[p.rol].nombre}`, 262, 203, { tam: 6, align: 'center', color: '#f8c448' });
    texto(g, ROLES[p.rol].desc, 262, 214, { tam: 5, align: 'center', color: UI.suave, max: 100 });
    const barra = (y, n, v, max, color) => { texto(g, n, 218, y, { tam: 6, color: UI.suave }); rect(g, 244, y + 1, 70, 6, '#04102c'); rect(g, 245, y + 2, Math.round(68 * Math.min(1, v / max)), 4, color); texto(g, String(Math.round(v)), 320, y, { tam: 6 }); };
    barra(228, 'HP', hp, 180, '#3cd34e'); barra(238, 'SPD', vel, 190, '#7dd3fc'); barra(248, 'ATK', atk * 100, 160, '#ff7a5a'); barra(258, 'DEF', def * 100, 130, '#ffd166');
    texto(g, p.lema, 262, 282, { tam: 5.5, align: 'center', color: '#7dd3fc', max: 110 });
    texto(g, 'TAB: NEXT FORM', 262, 338, { tam: 5, align: 'center', color: UI.apagado });
    // skills do estágio (kit = base + estágio + mega)
    const kit = Object.fromEntries(Object.entries(p.kit).map(([k, v]) => [k, Object.assign({}, v, f.kit?.[k] ?? {}, sel.mega ? f.mega.kit?.[k] ?? {} : {})]));
    SLOTS.forEach(([s, k], i) => {
      const h = kit[s], y = 90 + i * 51;
      marco(g, 340, y, 288, 46, 'azul');
      rect(g, 346, y + 5, 26, 12, '#04102c'); rect(g, 347, y + 6, 24, 10, '#225697'); texto(g, k, 359, y + 11, { tam: 6, align: 'center', base: 'middle' });
      rect(g, 376, y + 6, 7, 9, '#04102c'); rect(g, 377, y + 7, 5, 7, hex(TIPOS[h.tipo] ?? 0xffffff));
      texto(g, h.nombre, 388, y + 11, { tam: 8, base: 'middle', borde: 2, max: 150 });
      texto(g, FORMA[h.forma] ?? h.forma, 622, y + 11, { tam: 6, align: 'right', base: 'middle', color: '#f8c448' });
      const datos = [h.dano ? `DMG ${Math.round(h.dano * 10) / 10}` : null, h.cd ? `CD ${h.cd}s` : null, h.coste ? `EN ${h.coste}` : s === 'e' ? 'ULT 100' : null, h.alcance ? `RNG ${h.alcance}` : h.largo ? `RNG ${h.largo}` : h.radio ? `RAD ${h.radio}` : h.dist ? `DIST ${h.dist}` : null].filter(Boolean);
      texto(g, datos.join('  ·  '), 346, y + 30, { tam: 6, color: UI.suave });
      const extra = [h.quema && 'BURN', h.veneno && 'POISON', h.drenaje && 'DRAIN', h.confunde && 'CONFUSE', h.aturde && 'STUN', h.debilita && 'ATK DOWN', h.roba && 'LIFESTEAL', h.blindaje && 'ARMOR', h.invul !== false && s === 'esp' && 'I-FRAMES'].filter(Boolean);
      if (extra.length) texto(g, extra.join(' · '), 622, y + 30, { tam: 5.5, align: 'right', color: '#86efac' });
    });
  }
}

centrada(Pokedex);
