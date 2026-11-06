// Kits de Mawile, Skarmory, Tatsugiri e Sharpedo. Cada forma lê `h.mega` (posto nos kits da Mega) para trocar o
// comportamento: a Mega Evolução é permanente e muda o que a skill faz, não só o dano.
import { RADIO } from '../config.js';
import { fijarCampo } from './fisica.js';
import { areaCirculo, pacote, atingir } from './entidades.js';

const angApunte = l => Math.atan2(l.ay - l.y, l.ax - l.x);
const dAng = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const dentro = (b, x, y, r) => Math.hypot(b.x - x, (b.y - y) / 0.62) < r;
function inimigos(luta, l) { return luta.blancos(l).filter(b => !b.oculto && !b.est?.vuelo && !b.ko); }
function maisPerto(luta, l, alc, de = l) { let m = null, dm = alc; for (const b of inimigos(luta, l)) { const d = Math.hypot(b.x - de.x, b.y - de.y); if (d < dm && !b.esClon) { dm = d; m = b; } } return m; }
function mirar(l, alc) { const r = l.rival, a = angApunte(l); if (!r || r.ko || r.oculto) return a; const ar = Math.atan2(r.y - l.y, r.x - l.x); return Math.hypot(r.x - l.x, r.y - l.y) < alc && Math.abs(dAng(ar, a)) < 0.8 ? ar : a; }
// leva alguém até (x, y) em `dur` segundos, com um pulinho de altura `alto`
function arrastar(luta, b, x1, y1, dur, alto = 0, fim) {
  const x0 = b.x, y0 = b.y; let t = 0;
  luta.add({ tipo: 'lanzado', dueno: null, vivo: true, update: dt => { t += dt; const k = Math.min(1, t / dur); if (b.ko) { b.salto = 0; return false; } b.x = x0 + (x1 - x0) * k; b.y = y0 + (y1 - y0) * k; b.salto = Math.round(Math.sin(k * Math.PI) * alto); if (k < 1) return true; b.salto = 0; fim?.(); return false; } });
}
// dash em linha reta que acerta todo mundo no caminho uma vez só
function dashLinha(hab, l, h, extra, dist, dur, aoAcertar) {
  const luta = hab.luta, mx = l.intento?.mx ?? 0, my = l.intento?.my ?? 0;
  const a = Math.hypot(mx, my) > 0.2 ? Math.atan2(my, mx) : mirar(l, dist + 40), x0 = l.x, y0 = l.y, p = fijarCampo(l.x + Math.cos(a) * dist, l.y + Math.sin(a) * dist);
  const ja = new Set(); let t = 0;
  l.cortarAccion(); l.ponerEstado('invul', dur * 0.8);
  l.accion = { hasta: luta.t + dur, bloquea: true, lento: 0, angulo: a, update: dt => {
    t += dt; const k = Math.min(1, t / dur); l.x = x0 + (p.x - x0) * k; l.y = y0 + (p.y - y0) * k;
    for (const b of inimigos(luta, l)) { if (ja.has(b) || Math.hypot(b.x - l.x, b.y - l.y) > RADIO * 2 + 10) continue; ja.add(b); aoAcertar(b, a); }
  } };
  return { a, x0, y0, x1: p.x, y1: p.y };
}
// sangramento: dano por segundo que acumula (cada camada soma)
function sangrar(luta, l, b, dps, dur) {
  const s = (b.est.sangra ??= { n: 0, hasta: 0 }); s.n = Math.min(5, s.n + 1); s.hasta = luta.t + dur; s.dps = dps; s.fonte = l;
  if (s.ent?.vivo) return;
  let acum = 0;
  s.ent = { tipo: 'sangra', dueno: l, vivo: true, update: dt => {
    if (b.ko || luta.t > s.hasta) { delete b.est.sangra; return false; }
    acum += dt; if (acum >= 0.5) { acum -= 0.5; b.recibir(s.fonte, { dano: s.dps * s.n * 0.5, tipo: 'DARK', tick: true }); luta.emit({ t: 'sangue', x: b.x, y: b.y - b.alto * 0.5 }); }
    return true;
  } };
  luta.add(s.ent);
}

export const formasKits4 = {
  // ================================================================ MAWILE
  // Bote Traiçoeiro: avança e morde (prende). Mega: mais longe, as duas mandíbulas pegam até 2 e puxam (atordoa)
  boteMandibula(l, h, extra) {
    const luta = this.luta, dist = h.dist ?? 70;
    const r = dashLinha(this, l, h, extra, dist, 0.16, () => {});
    luta.programar(0.17, () => {
      if (l.ko) return;
      const fx = l.x + Math.cos(r.a) * 26, fy = l.y + Math.sin(r.a) * 16, alvos = inimigos(luta, l).filter(b => Math.hypot(b.x - fx, b.y - fy) < (h.mega ? 58 : 36)).slice(0, h.mega ? 2 : 1);
      luta.emit({ t: 'boteMand', l, x: fx, y: fy, ang: r.a, dupla: !!h.mega });
      for (const b of alvos) {
        atingir(l, b, pacote(h, extra, r.a, { empuje: 0, aturde: h.mega ? 1.2 : 0 }));
        if (h.mega) arrastar(luta, b, l.x + Math.cos(r.a) * 28, l.y + Math.sin(r.a) * 18, 0.2, 6);
        else this.prender(b, h.prende ?? 0.8);
      }
    });
  },
  // Giro de Aço: gira 360 com a mandíbula (reduz dano). Mega: gira duas vezes, ganha escudo e puxa quem está perto
  giroAco(l, h, extra) {
    const luta = this.luta, R = h.radio ?? 62, n = h.mega ? 2 : 1;
    l.animar('Rotate', 0.6); l.ponerEstado('girando', 0.35 * n + 0.2);
    l.ponerEstado('blindaje', 1, { reduce: 0.3 });
    if (h.mega) { l.escudo = Math.max(l.escudo ?? 0, h.escudo ?? 18); l.ponerEstado('escudo', 3, {}); for (const b of inimigos(luta, l)) if (dentro(b, l.x, l.y, R * 1.6)) arrastar(luta, b, l.x + (b.x - l.x) * 0.35, l.y + (b.y - l.y) * 0.35, 0.25, 4); }
    for (let i = 0; i < n; i++) luta.programar(0.1 + i * 0.35, () => {
      if (l.ko) return;
      luta.emit({ t: 'giroAco', l, radio: R, mega: !!h.mega });
      areaCirculo(luta, l, l.x, l.y, R, pacote(h, extra, 0, { dano: h.dano / n, dirX: undefined, dirY: undefined, empuje: 60 }));
    });
  },
  // Mordida Voraz: mordida gigante em cone (lentidão). Mega: cone maior, duas mordidas: a 1ª quebra a armadura,
  // a 2ª é cruzada e bate mais quanto menos vida o alvo tem
  mordidaVoraz(l, h, extra) {
    const luta = this.luta, R = h.alcance ?? 110, abre = ((h.angulo ?? 90) * Math.PI) / 180, a = mirar(l, R + 30);
    l.animar('Attack', 0.6); l.accion = { hasta: luta.t + (h.mega ? 0.7 : 0.4), bloquea: true, lento: 0, angulo: a };
    const morder = (i) => {
      if (l.ko) return;
      luta.emit({ t: 'mordidaGigante', l, ang: a, alcance: R, angulo: abre, cruz: i === 1 });
      for (const b of inimigos(luta, l)) {
        const dx = b.x - l.x, dy = b.y - l.y, d = Math.hypot(dx, dy) || 1;
        if (d > R + RADIO || Math.abs(dAng(Math.atan2(dy, dx), a)) > abre / 2) continue;
        if (!h.mega) { atingir(l, b, pacote(h, extra, a, { empuje: 60, ralentiza: { f: 0.6, dur: 2 }, pesado: true })); continue; }
        if (i === 0) { atingir(l, b, pacote(h, extra, a, { dano: h.dano * 0.45, empuje: 20 })); b.ponerEstado('defBaja', 4, {}); b.texto('ARMOR BROKEN', '#cbd5e1'); }
        else atingir(l, b, pacote(h, extra, a, { dano: h.dano * 0.55 * (1 + (1 - b.hp / b.hpMax) * 1.2), empuje: 120, pesado: true }));
      }
      luta.emit({ t: 'temblor', f: 0.01 }); luta.hitstop(80);
    };
    luta.programar(0.25, () => morder(0));
    if (h.mega) luta.programar(0.55, () => morder(1));
  },

  // ================================================================ SKARMORY
  // Rasante de Aço: dash cortando com as asas (lentidão). Mega: mais longe e deixa penas afiadas no chão por 3s
  rasanteAco(l, h, extra) {
    const luta = this.luta, dist = h.dist ?? 150;
    const r = dashLinha(this, l, h, extra, dist, 0.2, (b, a) => atingir(l, b, pacote(h, extra, a, { empuje: 40, ralentiza: { f: 0.3, dur: 2 } })));
    luta.emit({ t: 'rasante', l, ...r });
    if (!h.mega) return;
    const e = { tipo: 'penasChao', dueno: l, vivo: true, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, t: 0, dur: 3, prox: 0, update: dt => {
      e.t += dt; if (e.t < e.prox) return e.t < e.dur; e.prox = e.t + 0.4;
      const L = Math.hypot(e.x1 - e.x0, e.y1 - e.y0) || 1, ux = (e.x1 - e.x0) / L, uy = (e.y1 - e.y0) / L;
      for (const b of inimigos(luta, l)) { const px = b.x - e.x0, py = b.y - e.y0, lon = px * ux + py * uy, lat = Math.abs(-px * uy + py * ux); if (lon < 0 || lon > L || lat > 16) continue; b.recibir(l, { dano: h.danoTrilha ?? 2, tipo: 'STEEL', tick: true }); b.ponerEstado('defBaja', 1, {}); }
      return e.t < e.dur;
    } };
    luta.add(e);
  },
  // Plumagem Defensiva: escudo de vento e aço na frente (metade do dano) que empurra. Mega: cobre tudo em volta e,
  // ao acabar, explode em penas que atordoam
  plumagem(l, h, extra) {
    const luta = this.luta, dur = h.dur ?? 1.5, a = mirar(l, 200);
    l.animar('Charge', 0.4); l.ponerEstado('blindaje', dur, { reduce: 0.5 });
    luta.emit({ t: 'plumagem', l, ang: a, dur, mega: !!h.mega });
    for (const b of inimigos(luta, l)) { const dx = b.x - l.x, dy = b.y - l.y, d = Math.hypot(dx, dy) || 1; if (d < 80 && (h.mega || Math.abs(dAng(Math.atan2(dy, dx), a)) < 1)) atingir(l, b, pacote(h, extra, a, { dano: 2, empuje: 160, dirX: dx / d, dirY: dy / d })); }
    if (h.mega) luta.programar(dur, () => { if (l.ko) return; areaCirculo(luta, l, l.x, l.y, h.radio ?? 80, pacote(h, extra, 0, { aturde: 1, dirX: undefined, dirY: undefined, empuje: 90 })); luta.emit({ t: 'explodePenas', x: l.x, y: l.y, radio: h.radio ?? 80 }); });
  },
  // Corte Aéreo: decola e mergulha numa área (joga para o alto). Mega: área dobrada, furacão de lâminas por 3s que
  // puxa para o centro e quebra escudos
  mergulhoAco(l, h, extra) {
    const luta = this.luta, r = maisPerto(luta, l, h.alcance ?? 260), alvo = r ? { x: r.x, y: r.y } : fijarCampo(l.ax, l.ay), R = (h.radio ?? 70) * (h.mega ? 2 : 1);
    l.cortarAccion(); l.ponerEstado('vuelo', 0.6, { oculto: true, modo: 'aire', rapidez: 0 });
    luta.emit({ t: 'decola', l, x: alvo.x, y: alvo.y, radio: R });
    luta.programar(0.6, () => {
      if (l.ko) return;
      delete l.est.vuelo; l.x = alvo.x; l.y = alvo.y; l.ponerEstado('invul', 0.2);
      for (const b of inimigos(luta, l)) if (dentro(b, alvo.x, alvo.y, R)) { if (h.mega) { b.escudo = 0; delete b.est.escudo; } atingir(l, b, pacote(h, extra, 0, { dirX: undefined, dirY: undefined, empuje: 0, aturde: 0.8 })); arrastar(luta, b, b.x, b.y, 0.8, 50); }
      luta.emit({ t: 'impactoAco', x: alvo.x, y: alvo.y, radio: R }); luta.emit({ t: 'temblor', f: 0.014 }); luta.hitstop(100);
      if (!h.mega) return;
      const e = { tipo: 'furacaoAco', dueno: l, vivo: true, x: alvo.x, y: alvo.y, radio: R, t: 0, dur: 3, prox: 0.3, update: dt => {
        e.t += dt;
        for (const b of inimigos(luta, l)) if (dentro(b, e.x, e.y, R * 1.2)) { const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy) || 1; b.empX += (dx / d) * 300 * dt * 6; b.empY += (dy / d) * 300 * dt * 6; }
        if (e.t >= e.prox) { e.prox += 0.4; for (const b of inimigos(luta, l)) if (dentro(b, e.x, e.y, R)) b.recibir(l, { dano: h.danoFuracao ?? 2.5, tipo: 'STEEL', tick: true }); }
        return e.t < e.dur && !l.ko;
      } };
      luta.add(e);
    });
  },

  // ================================================================ TATSUGIRI
  // Deslize Escorregadio: desliza na água (intocável) deixando um rastro que deixa lento. Mega: mais longe, solta 3
  // bolhas teleguiadas e fica mais rápido
  deslize(l, h, extra) {
    const luta = this.luta, dist = h.dist ?? 100;
    const r = dashLinha(this, l, h, extra, dist, 0.22, () => {});
    l.ponerEstado('invul', 0.5);
    luta.emit({ t: 'deslize', l, ...r });
    // rastro d'água: quem pisa fica 25% mais lento
    const e = { tipo: 'rastroAgua', dueno: l, vivo: true, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, t: 0, dur: 3, update: dt => {
      e.t += dt; const L = Math.hypot(e.x1 - e.x0, e.y1 - e.y0) || 1, ux = (e.x1 - e.x0) / L, uy = (e.y1 - e.y0) / L;
      for (const b of inimigos(luta, l)) { const qx = b.x - e.x0, qy = b.y - e.y0, lon = qx * ux + qy * uy, lat = Math.abs(-qx * uy + qy * ux); if (lon > -10 && lon < L + 10 && lat < 16) b.ponerEstado('lento', 0.4, { f: Math.max(0.25, b.est.lento?.f ?? 0) }); }
      return e.t < e.dur;
    } };
    luta.add(e);
    if (!h.mega) return;
    l.ponerEstado('rapido', 2, { vel: 1.3 });
    for (let i = 0; i < 3; i++) luta.programar(0.25 + i * 0.12, () => { if (!l.ko) bolha(this, l, h, extra, maisPerto(luta, l, 260)); });
  },
  // Cuspe Traiçoeiro: 3 tiros em leque. Mega: 5 tiros que atravessam; 3 ou mais no mesmo alvo silenciam
  cuspe(l, h, extra) {
    const luta = this.luta, n = h.mega ? 5 : 3, a = mirar(l, 240), abre = h.mega ? 0.6 : 0.4, acertos = new Map();
    l.animar('Shoot', 0.3); l.accion = { hasta: luta.t + 0.2, lento: 0.3, angulo: a };
    for (let i = 0; i < n; i++) {
      const ang = a + (i / (n - 1) - 0.5) * abre, ja = new Set();
      const p = { tipo: 'jatoTatsu', dueno: l, vivo: true, x: l.x + Math.cos(ang) * 10, y: l.y + Math.sin(ang) * 10, ang, t: 0, update: dt => {
        p.t += dt; p.x += Math.cos(ang) * 340 * dt; p.y += Math.sin(ang) * 340 * dt;
        for (const b of inimigos(luta, l)) { if (ja.has(b) || Math.hypot(b.x - p.x, b.y - p.y) > RADIO + 5) continue; ja.add(b); atingir(l, b, pacote(h, extra, ang, { dano: h.dano / n * 1.6, empuje: 15 })); b.ponerEstado('defBaja', 3, {}); const k = (acertos.get(b) ?? 0) + 1; acertos.set(b, k); if (h.mega && k === 3) { b.ponerEstado('silencio', 1.2, {}); b.texto('SILENCED!', '#7dd3fc'); } if (!h.mega) return false; }
        return p.t < (h.alcance ?? 220) / 340;
      } };
      luta.add(p);
    }
  },
  // Torreta Torrencial: monta numa torreta d'água parada por 4s, com escudo, atirando rajadas que deixam cada vez mais
  // lento. Mega: 5s, escudo maior, tiros em volta toda e no fim uma bolha gigante que atordoa
  torretaAgua(l, h, extra) {
    const luta = this.luta, dur = h.dur ?? (h.mega ? 5 : 4), alc = h.alcance ?? 280;
    l.ponerEstado('arraigo', dur, { cura: 0, acum: 0, reduce: 0 });
    l.escudo = Math.max(l.escudo ?? 0, h.escudo ?? (h.mega ? 30 : 18)); l.ponerEstado('escudo', dur, {});
    luta.emit({ t: 'torretaSobe', l });
    let prox = 0.2, t = 0;
    luta.add({ tipo: 'torretaTatsu', dueno: l, vivo: true, x: l.x, y: l.y, t: 0, dur, mega: !!h.mega, update(dt) {
      t += dt; this.t = t; this.x = l.x; this.y = l.y;
      if (l.ko) return false;
      if (t >= prox) {
        prox += h.mega ? 0.35 : 0.28;
        const alvos = h.mega ? inimigos(luta, l).filter(b => Math.hypot(b.x - l.x, b.y - l.y) < alc) : [maisPerto(luta, l, alc)].filter(Boolean);
        for (const b of alvos) { atingir(l, b, pacote(h, extra, Math.atan2(b.y - l.y, b.x - l.x), { dano: h.danoTiro ?? 2.2, empuje: 10, tick: true })); b.ponerEstado('lento', 1, { f: Math.min(0.5, (b.est.lento?.f ?? 0) + 0.08) }); luta.emit({ t: 'tiroTorreta', l, x: b.x, y: b.y }); }
      }
      if (t >= dur) {
        if (h.mega) { const b = maisPerto(luta, l, alc); if (b) { luta.emit({ t: 'bolhaGigante', l, x: b.x, y: b.y }); luta.programar(0.4, () => { if (l.ko) return; areaCirculo(luta, l, b.x, b.y, 70, pacote(h, extra, 0, { dano: h.dano, aturde: 1.5, dirX: undefined, dirY: undefined, empuje: 80 })); luta.emit({ t: 'temblor', f: 0.012 }); }); } }
        return false;
      }
      return true;
    } });
  },

  // ================================================================ SHARPEDO
  // Rasgo de Barbatana: dash em linha cortando com a barbatana (sangramento). Mega: mais longe, sangra mais e quebra armadura
  rasgoBarbatana(l, h, extra) {
    const luta = this.luta;
    const r = dashLinha(this, l, h, extra, h.dist ?? 140, 0.18, (b, a) => { atingir(l, b, pacote(h, extra, a, { empuje: 30 })); sangrar(luta, l, b, h.sangra ?? 2, 3); if (h.mega) b.ponerEstado('defBaja', 3, {}); luta.emit({ t: 'corteSerra', x: b.x, y: b.y - b.alto * 0.5, ang: a }); });
    luta.emit({ t: 'barbatana', l, ...r });
  },
  // Caçador Submerso: mergulha (intocável e rápido) e sai mordendo o primeiro alvo. Mega: mais tempo, com escudo; sai
  // com dano em área, joga para o alto e acerta crítico em quem está com menos da metade da vida
  cacadorSubmerso(l, h, extra) {
    const luta = this.luta, dur = h.dur ?? (h.mega ? 2 : 1.5);
    l.cortarAccion(); l.ponerEstado('vuelo', dur + 0.2, { oculto: true, modo: 'agua', rapidez: 1.4 });
    if (h.mega) { l.escudo = Math.max(l.escudo ?? 0, h.escudo ?? 14); l.ponerEstado('escudo', dur + 1, {}); }
    luta.emit({ t: 'desaparece', l, modo: 'agua' });
    let t = 0, solto = false;
    luta.add({ tipo: 'tubaraoSub', dueno: l, vivo: true, update: dt => {
      t += dt; if (l.ko) return false;
      const pulsa = l.intento?.[extra.slot]; if (!pulsa) solto = true;
      if (t < dur && !(t > 0.4 && pulsa && solto)) return true;
      delete l.est.vuelo; l.salto = 0; l.ponerEstado('invul', 0.2);
      luta.emit({ t: 'emergeTubarao', l });
      if (h.mega) for (const b of inimigos(luta, l)) { if (!dentro(b, l.x, l.y, 60)) continue; const crit = b.hp / b.hpMax < 0.5 ? 1.6 : 1; atingir(l, b, pacote(h, extra, 0, { dano: h.dano * crit, dirX: undefined, dirY: undefined, empuje: 0, aturde: 0.8 })); arrastar(luta, b, b.x, b.y, 0.8, 50); if (crit > 1) b.texto('CRITICAL!', '#ef4444'); }
      else { const b = maisPerto(luta, l, 50); if (b) atingir(l, b, pacote(h, extra, 0, { empuje: 60 })); }
      return false;
    } });
  },
  // Bote Voraz: dá o bote num alvo (mais dano quanto menos vida ele tem; cura ao derrotar). Mega: cone com 4 mordidas
  // rápidas que acumulam sangramento; derrotar alguém zera a recarga das skills
  boteVoraz(l, h, extra) {
    const luta = this.luta;
    if (!h.mega) {
      const b = maisPerto(luta, l, h.alcance ?? 170);
      if (!b) { if (l.humano) l.avisar('bote', () => l.texto('NO TARGET', '#fca5a5')); return false; }
      const a = Math.atan2(b.y - l.y, b.x - l.x); l.cortarAccion(); l.ponerEstado('invul', 0.25);
      arrastar(luta, l, b.x - Math.cos(a) * 20, b.y - Math.sin(a) * 12, 0.18, 10, () => {
        if (l.ko || b.ko) return;
        atingir(l, b, pacote(h, extra, a, { dano: h.dano * (1 + (1 - b.hp / b.hpMax) * 1.3), empuje: 100, pesado: true }));
        luta.emit({ t: 'mordidaGigante', l, ang: a, alcance: 50, angulo: 1.2, tubarao: true }); luta.hitstop(90);
        if (b.ko) { l.cura(l.hpMax * 0.2); l.texto('DEVOUR!', '#86efac'); }
      });
      return;
    }
    const R = h.alcance ?? 100, abre = 1.6, a = mirar(l, R + 30);
    l.animar('Attack', 0.9); l.accion = { hasta: luta.t + 0.8, bloquea: true, lento: 0, angulo: a };
    for (let i = 0; i < 4; i++) luta.programar(0.12 + i * 0.16, () => {
      if (l.ko) return;
      luta.emit({ t: 'mordidaGigante', l, ang: a + (i % 2 ? 0.2 : -0.2), alcance: R, angulo: abre, tubarao: true });
      for (const b of inimigos(luta, l)) {
        const dx = b.x - l.x, dy = b.y - l.y, d = Math.hypot(dx, dy) || 1;
        if (d > R + RADIO || Math.abs(dAng(Math.atan2(dy, dx), a)) > abre / 2) continue;
        atingir(l, b, pacote(h, extra, a, { dano: h.dano / 4, empuje: i === 3 ? 90 : 10 })); sangrar(luta, l, b, h.sangra ?? 1.5, 4);
        if (b.ko) { for (const s of ['rmb', 'q', 'esp']) l.cd[s] = 0; l.texto('FRENZY!', '#f87171'); }
      }
    });
  },
};
// bolha teleguiada do Deslize da Mega Tatsugiri
function bolha(hab, l, h, extra, alvo) {
  const luta = hab.luta; let t = 0, ang = alvo ? Math.atan2(alvo.y - l.y, alvo.x - l.x) : angApunte(l);
  const p = { tipo: 'bolhaTatsu', dueno: l, vivo: true, x: l.x, y: l.y, t: 0, update: dt => {
    t += dt; p.t = t;
    if (alvo && !alvo.ko) ang += Math.max(-5 * dt, Math.min(5 * dt, dAng(Math.atan2(alvo.y - p.y, alvo.x - p.x), ang)));
    p.x += Math.cos(ang) * 260 * dt; p.y += Math.sin(ang) * 260 * dt;
    for (const b of inimigos(luta, l)) if (Math.hypot(b.x - p.x, b.y - p.y) < RADIO + 6) { atingir(l, b, pacote(h, extra, ang, { dano: h.danoBolha ?? 3, empuje: 20 })); luta.emit({ t: 'salpico', x: p.x, y: p.y, radio: 14, tipo: 'WATER' }); return false; }
    return t < 1.2;
  } };
  luta.add(p);
}
