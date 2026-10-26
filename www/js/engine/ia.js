// CPU: a cada reação lê o campo (projéteis vindo, raios, golpes do rival, marcas no chão), soma as vontades
// de movimento (distância boa, rodeio, fuga das ameaças, borda) e escolhe skills pela chance de acertar e
// pelo dano esperado. Também se defende (dash, escudo, espelho) quando vê algo forte vindo.
// Três níveis: easy, normal, hard. Usa o aleatório com semente, então a luta continua repetível.
import { RADIO, OVALO } from '../config.js';
import { REGLAS, efectividad } from '../data/regras.js';
import { aleatorio, entre, difAng } from './util.js';
import { limitarCampo } from './fisica.js';

const NIVELES = {
  facil: { reaccion: 0.22, error: 22, esquiva: 0.25, basicos: 0.15, reflejo: 0.4, agresividad: 0.4, juicio: 0.45, umbralUlti: 0.45 },
  normal: { reaccion: 0.13, error: 12, esquiva: 0.5, basicos: 0.3, reflejo: 0.28, agresividad: 0.65, juicio: 0.75, umbralUlti: 0.6 },
  dificil: { reaccion: 0.08, error: 5, esquiva: 0.75, basicos: 0.45, reflejo: 0.2, agresividad: 0.9, juicio: 1, umbralUlti: 0.7 },
};

// jeito de jogar de cada Pokémon; o campo `ia` da linha pode trocar qualquer valor
const CEREBRO = {
  rangoBanda: 18, lateral: 0.3, lateralEntrada: 0.85, huidaMele: 1.3, rodeo: 0.55,
  pPlantarse: 0.35, plantadoDur: [0.4, 0.7], rodeoDur: [0.7, 1.3], cambioLado: [0.9, 1.6],
  pesoEsquiva: { area: 2.4, rayo: 2.6, fuerte: 2.2, disparo: 1.5, mele: 1.8, embestida: 2.2 },
  horizonteBasico: 0.35, horizonteEsquiva: 0.75, huidaZona: 1.8, calorTope: 88, dashUrgencia: 0.32,
  evoDist: 150, evoHp: 0.5, megaDist: 170,
  valorBase: 0.5, pesoDano: 1, pesoEficacia: 1.3, pesoLetal: 2.2, pesoVendido: 1.6, pesoApartar: 1.5, cautelaUlti: 0.1,
  ultiPaciencia: 5, ultiRelajo: 0.25, ultiDesesperado: 0.3,
  energiaTope: 85, pSeguro: 0.8, pConGanas: 0.3, pSinGanas: 0.55, reservaEnergia: 30, pAhorro: 0.3,
  pEmbestir: 0.55, pEntrar: 0.5, entradaLateral: 0.45, escapeHp: 0.3, escapeDist: 70, pEscape: 0.25, acosadoDist: 95,
  curaHp: 0.6, curaUrgente: 0.3, restHp: 0.45, restDist: 170, arraigoHp: 0.7, arraigoDist: 200,
  growthDist: 150, growthSoltar: 90, buffDist: 130, escudoDist: 130, clonesDist: 220, humoCerca: 120, splashDist: 160,
  pBasico: 0.35, volarLejos: 200, pVolar: 0.3, pCaer: 0.5,
};

const SLOTS = ['lmb', 'rmb', 'q', 'esp', 'e'];
const RAYOS = new Set(['chorro', 'helice', 'cono']);
const AREAS = new Set(['pulso', 'explosion', 'plantaFeroz', 'caparazon', 'erupcion', 'estallido']);
const MELES = new Set(['tajo', 'rafaga', 'golpe', 'patada', 'salto']);
const BUFFS = new Set(['potenciar', 'crecimiento', 'recuperar', 'descanso', 'arraigo', 'chapoteo', 'curaAnillo', 'torreta']);
const DEFESAS = new Set(['escudo', 'humo', 'clones', 'espejo', 'caparazon', 'burbuja']);
const ATAQUES_ESP = new Set(['patada', 'salto', 'golpe', 'proyectil']);

// alcance da skill para quem só quer saber "dá para usar daqui?"
// nos níveis fáceis a CPU bate mais fraco e aguenta menos (como o "ventaja" do site); só contra a CPU, nunca online
export const ventajaDe = nivel => NIVELES[nivel]?.ventaja ?? 1;

export function rangoDe(h) {
  switch (h.forma) {
    case 'proyectil': case 'cono': case 'viento': case 'bombaLodo': case 'burbujas': case 'lluvia': return h.alcance;
    case 'chorro': case 'helice': return h.largo;
    case 'tajo': case 'golpe': case 'rafaga': return h.alcance + (h.embestida ?? 0) * 0.5;
    case 'patada': case 'salto': case 'cortesSuelo': case 'jabLuna': return h.alcance;
    case 'pulso': return h.radio;
    case 'caparazon': return h.alcance;
    case 'meteoro': return (h.sigue ?? 150) * (h.aviso ?? 0.6) + h.radio;
    case 'vuelo': return 230;
    case 'erupcion': return h.golpes * h.paso * 0.6;
    case 'plantaFeroz': return Math.max(...h.ondas) + 20;
    case 'embestidas': return 150;
    case 'dash': return h.dano ? h.dist : 0;
    default: return h.alcance ?? 0;
  }
}

// o que a skill exige para acertar: alcance útil, largura, demora até chegar e quanto segue o alvo
function perfil(h, slot, d) {
  const f = h.forma ?? 'proyectil';
  const P = { h, slot, forma: f, tipo: 'dirigida', alcance: (h.alcance ?? 0) * 0.92, ancho: h.radio ?? 4, retardo: (h.lanzar ?? 0.15) + (h.carga ?? 0), sigue: 0, invul: false, golpes: 1 };
  switch (f) {
    case 'proyectil':
      P.retardo += d / (h.vel ?? 250);
      if (h.teledirigido) P.sigue = Math.min(1, h.teledirigido / 3);
      if (h.revienta) P.ancho = (h.revienta.radio ?? 30) * 0.7;
      if (h.explosion) P.ancho += (h.explosion.radio ?? 20) * 0.6;
      if (h.rafaga) { P.ancho += 6 + Math.sin(h.abanico ?? 0) * d * 0.5; P.golpes = Math.max(1, h.rafaga * 0.7); }
      break;
    case 'lanzaTorretas': P.retardo += d / (h.vel ?? 200); break;
    case 'laco': P.retardo += d / (h.vel ?? 300); break;
    case 'burbujas': P.retardo += d / (h.vel ?? 200); P.ancho = 14; P.golpes = 2; break;
    case 'estallido':
      P.tipo = 'area';
      P.alcance = Math.min((h.alcance ?? 170) * 0.85, (h.n * 2 * (RADIO + (h.radio ?? 5))) / (2 * Math.PI));
      P.retardo = (h.lanzar ?? 0.2) + d / (h.vel ?? 250);
      break;
    case 'chorro': case 'helice':
      P.alcance = h.largo * 0.9; P.ancho = (h.ancho ?? 20) / 2; P.retardo = h.carga ?? 0.3; P.sigue = h.giro ? 0.6 : 0.3;
      break;
    case 'cono': case 'viento':
      P.alcance = h.alcance * 0.85; P.ancho = Math.tan(((h.angulo ?? 50) * Math.PI) / 360) * d + 6; P.retardo = h.carga ?? 0; P.sigue = h.giro ? 0.5 : 0;
      break;
    case 'pulso': P.tipo = 'area'; P.alcance = h.radio + RADIO - 4; P.retardo = h.carga ?? 0; break;
    case 'explosion': P.tipo = 'area'; P.alcance = h.radio * 0.8; P.retardo = h.carga ?? 0.5; break;
    case 'plantaFeroz': P.tipo = 'area'; P.alcance = h.ondas.at(-1) + (h.banda ?? 20) * 0.5; P.retardo = h.carga ?? 0.3; break;
    case 'erupcion':
      P.alcance = h.golpes * h.paso * (h.persigue ? 0.7 : 0.9); P.ancho = h.radio; P.sigue = h.persigue ? 1 : 0.3;
      P.retardo = 0.2 + (h.cada ?? 0.12) * (h.golpes - 1) * 0.5; P.golpes = Math.max(1, h.golpes * 0.4);
      break;
    case 'lluvia': P.alcance = (h.alcance ?? 200) + 60; P.ancho = (h.area ?? 40) * 0.6 + h.radio; P.retardo = (h.aviso ?? 0.4) + 0.3; P.golpes = Math.max(1, (h.n ?? 1) * 0.35); break;
    case 'geiser': P.ancho = h.radio; P.retardo = h.aviso ?? 0.5; break;
    case 'torbellino': P.alcance = h.alcance * 0.8; P.ancho = h.radio; P.retardo = d / (h.vel ?? 120); P.sigue = h.persigue ? 0.7 : 0.3; break;
    case 'bombaLodo': P.ancho = h.radio; P.retardo = (h.lanzar ?? 0.18) + (h.vuelo ?? 0.5); break;
    case 'trampa': P.ancho = h.radio; P.retardo = h.arma ?? 0.5; break;
    case 'meteoro':
      P.alcance = (h.sigue ?? 150) * (h.aviso ?? 0.6) + h.radio; P.ancho = h.radio; P.retardo = 0.3 + (h.aviso ?? 0.6) + 0.15; P.sigue = 0.9; P.invul = true;
      break;
    case 'tajo': P.tipo = 'mele'; P.alcance = h.alcance + (h.avance ?? 0) + 14; break;
    case 'rafaga': P.tipo = 'mele'; P.alcance = h.alcance + 6; P.golpes = h.golpes ?? 1; break;
    case 'golpe': P.tipo = 'mele'; P.alcance = h.alcance + (h.embestida ?? 30) * 0.85 + (h.onda ?? 0) * 0.5; P.retardo = h.lanzar ?? 0.14; break;
    case 'puente': P.tipo = 'mele'; P.alcance = h.rajada?.alcance ?? 120; P.retardo = 0.05; break;
    case 'patada': P.alcance = h.alcance + 20; P.ancho = h.radio ?? 20; P.retardo = 0.26 + d / 700; P.sigue = 0.8; break;
    case 'salto': P.alcance = h.alcance + 20; P.ancho = h.radio ?? 20; P.retardo = 0.32; P.sigue = 0.8; break;
    case 'cortesSuelo': P.tipo = 'mele'; P.alcance = h.alcance; P.retardo = (h.carga ?? 0.15) + (h.viaja ?? 0.25) * 0.5; break;
    case 'jabLuna': P.tipo = 'mele'; P.alcance = h.alcance; P.retardo = (h.dur ?? 0.3) * 0.5; break;
    case 'vuelo': P.tipo = 'vuelo'; P.alcance = h.radio; P.ancho = h.radio; P.invul = true; break;
    case 'dash':
      P.tipo = h.dano ? 'embestida' : 'movil'; P.alcance = h.dist * 0.9; P.invul = h.invul !== false;
      P.ancho = RADIO + 4 + (h.latigo ? h.latigo.ancho / 2 : 0); P.retardo = d / (h.dist / h.dur);
      break;
    case 'agarre': case 'enrollar': P.tipo = 'embestida'; P.alcance = (h.dist ?? 170) * 0.9; P.ancho = RADIO + 8; P.retardo = 0.28; break;
    case 'sismo': P.alcance = (h.alcance ?? 200) + h.radio * 0.6; P.ancho = h.radio; P.retardo = 0.55; P.sigue = 0.3; break;
    case 'levitar': P.alcance = (h.alcance ?? 260) * 0.95; P.ancho = 40; P.retardo = 0; P.sigue = 1; break;
    case 'bolaGigante': P.alcance = (h.alcance ?? 320) * 0.9; P.ancho = h.radio ?? 26; P.retardo = (h.carga ?? 1) + d / (h.vel ?? 230); P.sigue = 0.5; break;
    case 'hueso': P.alcance = 320; P.ancho = 14; P.retardo = d / (h.vel ?? 340); break;
    case 'rodar': P.tipo = 'movil'; break;
    case 'almas': P.retardo += d / (h.vel ?? 260); P.sigue = 0.8; P.alcance = (h.alcance ?? 300) * 0.9; P.golpes = (h.base ?? 0) + 2; break;
    case 'espinho': P.tipo = 'area'; P.alcance = (h.alcance ?? 180) + 10; P.ancho = h.radio ?? 30; P.retardo = h.aviso ?? 0.35; break;
    case 'arenaRoca': P.alcance = (h.alcance ?? 210) + h.radio * 0.5; P.ancho = h.radio; P.retardo = 0.55; P.sigue = 0.3; break;
    case 'flecha': P.alcance = 300; P.ancho = 14; P.retardo = (h.lanzar ?? 0.2) + d / (h.vel ?? 300); break;
    case 'embestidas': P.alcance = 170; P.ancho = 30; P.retardo = 0.1; P.sigue = 0.6; P.invul = true; P.golpes = Math.max(1, (h.golpes ?? 1) * 0.7); break;
    default:
      if (DEFESAS.has(f)) P.tipo = 'defensa';
      else if (BUFFS.has(f)) P.tipo = 'buff';
  }
  if (f === 'caparazon') { P.tipo = 'defensa'; P.alcance = h.alcance * 0.9; }
  return P;
}

// empurra para o centro quando chega perto da borda do oval
function empujeBorde(x, y, margen, f) {
  const o = OVALO, ex = (x - o.cx) / (o.rx - margen), ey = (y - o.cy) / (o.ry - margen), e = Math.hypot(ex, ey);
  if (e < 0.86) return { x: 0, y: 0 };
  const k = f * Math.min(1.6, (e - 0.86) / 0.14), cx = o.cx - x, cy = o.cy - y, m = Math.hypot(cx, cy) || 1;
  return { x: (cx / m) * k, y: (cy / m) * k };
}

export class IA {
  constructor(luta, l, nivel = 'normal') {
    this.luta = luta; this.l = l;
    this.cfg = NIVELES[nivel] ?? NIVELES.normal;
    this.c = { ...CEREBRO, ...(l.def.ia ?? {}) };
    this.espera = 0;
    this.lado = aleatorio() < 0.5 ? 1 : -1;
    this.cambioLado = 1;
    this.it = { mx: 0, my: 0, ax: l.x, ay: l.y };
    this.disparando = false;
    this.mantener = null;
    this.vistas = new WeakMap(); this.lados = new WeakMap();
    this.rumbo = { x: 0, y: 0 };
    this.ultimaDecision = 0;
    this.plan = { plantado: false, hasta: 0 };
    this.ultiDesde = null;
    this.aterrice = -9; this.volando = false;
    this.vistoEn = null;
  }

  // chamado a cada passo; devolve a intenção (movimento, mira e botões) daquele passo
  intento(dt) {
    const yo = this.l, luta = this.luta, r = yo.rival, t = luta.t, it = this.it;
    it.lmb = it.rmb = it.esp = it.q = it.e = it.mega = false;
    if (!r || r.ko || luta.fase !== 'lucha') { it.mx = 0; it.my = 0; return { ...it }; }
    this.espera -= dt;
    if (this.volando && !yo.est.vuelo) this.aterrice = t;
    this.volando = !!yo.est.vuelo;
    if (!yo.ultiLista) this.ultiDesde = null;
    else this.ultiDesde ??= t;
    if (this.disparando && yo.cd.lmb <= 0 && !yo.dash && yo.calor < this.c.calorTope) it.lmb = true;
    // segurando uma skill (Growth): solta quando o rival chega perto ou acaba o tempo
    const mant = this.mantener;
    if (mant) {
      if (t < mant.hasta && Math.hypot(r.x - yo.x, r.y - yo.y) > mant.cerca) { it[mant.slot] = true; return { ...it }; }
      this.mantener = null;
    }
    // semente que estoura (Leech Seed): aperta de novo quando passa perto do rival
    for (const o of luta.entidades) {
      if (o.tipo === 'proj' && o.dueno === yo && o.h.revienta && o.recorrido > 12 && Math.hypot(o.x - r.x, o.y - r.y) < (o.h.revienta.radio ?? 30) * 0.7) it[o.extra.slot] = true;
    }
    if (yo.est.vuelo && luta.entidades.some(o => o.tipo === 'vuelo' && o.dueno === yo)) { this.volar(it, r); return { ...it }; }
    if (!r.oculto) this.vistoEn = { x: r.x, y: r.y };
    if (this.espera > 0) return { ...it };
    this.espera = this.cfg.reaccion * (0.7 + aleatorio() * 0.6);
    const s = this.percibir(r);
    this.mover(s);
    this.elegir(s);
    return { ...it };
  }

  // ---------------------------------------------------------------- leitura do campo
  percibir(r) {
    const yo = this.l, luta = this.luta, t = luta.t, cfg = this.cfg;
    const dx = r.x - yo.x, dy = r.y - yo.y, d = Math.hypot(dx, dy) || 1;
    const rango = this.c.rango ?? 100;
    const s = {
      r, d, ux: dx / d, uy: dy / d, rango, mele: rango < 60, rivalMele: (r.def.ia?.rango ?? 100) < 60,
      amenazas: [], huir: { x: 0, y: 0 }, lmb: perfil(yo.kit.lmb, 'lmb', d),
    };
    const re = r.est;
    s.vendido = !!(re.aturdido || re.lento || re.enredado || re.confuso || re.dormido || re.paralizado);
    s.clavado = Math.max(0, ...[re.aturdido, re.dormido, re.arraigo].filter(Boolean).map(x => x.hasta - t));
    s.canaliza = r.accion?.bloquea && !re.vuelo && !r.dash ? Math.max(0, r.accion.hasta - t) : 0;
    s.rCanaliza = s.canaliza > 0.3;
    let invul = Math.max(re.invul?.hasta ?? 0, re.vuelo?.hasta ?? 0, re.bloqueo?.hasta ?? 0);
    if (r.dash && r.dash.def.invul !== false) invul = Math.max(invul, t + r.dash.dur - r.dash.t);
    s.rInvul = Math.max(0, invul - t);
    s.rEspejo = !!(re.espejo || re.dormido?.refleja);
    s.rivalUltiLista = r.ultiLista;

    for (const o of luta.entidades) {
      if (o.dueno === yo || o.vivo === false) continue;
      if (o.tipo === 'proj') {
        const a = this.trayectoria({
          x: o.x, y: o.y, vx: o.vx, vy: o.vy, ancho: (o.radio ?? 4) + (o.h.explosion?.radio ?? 0) * 0.7 + (o.h.revienta?.radio ?? 0) * 0.7,
          fuerte: o.dano >= 8 || !!o.h.aturde || !!o.h.revienta, sigue: !!o.h.teledirigido, visto: o.edad ?? 0, obj: o,
        });
        if (a) s.amenazas.push(a);
      } else if (o.tipo === 'chorro' || o.tipo === 'cono') {
        const l = o.dueno, ox = yo.x - l.x, oy = yo.y - l.y, od = Math.hypot(ox, oy) || 1;
        const largo = (o.tipo === 'chorro' ? o.h.largo : o.h.alcance) + 24;
        if (od < largo) {
          const medio = o.tipo === 'cono' ? ((o.h.angulo ?? 50) * Math.PI) / 360 : Math.atan2((o.ancho ?? 20) / 2 + RADIO + 10, od);
          if (Math.abs(difAng(Math.atan2(oy, ox), o.ang)) < medio + (o.h.giro ?? 0) * 0.15 + 0.2) {
            const carga = o.carga ?? 0, ot = o.t ?? 0;
            s.amenazas.push(this.amenaza('rayo', Math.max(0, carga - ot), true, -ox / od, -oy / od, o.ang, l, { queda: carga + (o.dur ?? o.h.dur ?? 1) - ot, ancho: 24, visto: ot + 0.3, obj: o }));
          }
        }
      } else if (o.tipo === 'marcas') {
        for (const p of o.puntos) {
          if (p.golpeado) continue;
          const zx = yo.x - p.x, zy = yo.y - p.y, zd = Math.hypot(zx, zy), rad = (p.radio ?? o.radio) + RADIO + 8;
          const falta = p.t0 + o.aviso - o.t;
          if (zd < rad && falta < 0.9 && this.ve(p, cfg.esquiva + 0.1)) { s.huir.x += (zx / (zd || 1)) * this.c.huidaZona; s.huir.y += (zy / (zd || 1)) * this.c.huidaZona; }
        }
      } else if (o.tipo === 'meteoro') {
        const zx = yo.x - o.x, zy = yo.y - o.y, zd = Math.hypot(zx, zy) || 1;
        if (o.fase !== 'sube' && zd < o.radio + RADIO + 20 && this.ve(o, cfg.esquiva + 0.1)) { s.huir.x += (zx / zd) * this.c.huidaZona * 1.4; s.huir.y += (zy / zd) * this.c.huidaZona * 1.4; }
      } else if (o.radio && Number.isFinite(o.x) && (o.tipo === 'torbellino' || o.tipo === 'charco' || o.tipo === 'trampa' || o.tipo === 'geiser' || o.tipo === 'torreta')) {
        const zx = yo.x - o.x, zy = yo.y - o.y, zd = Math.hypot(zx, zy) || 1;
        if (zd < o.radio + RADIO + 14 && this.ve(o, cfg.esquiva)) { s.huir.x += (zx / zd) * this.c.huidaZona * 0.7; s.huir.y += (zy / zd) * this.c.huidaZona * 0.7; }
      }
    }
    // o que os outros lutadores estão fazendo agora
    for (const l of luta.luchadores) {
      if (l === yo || l.ko) continue;
      const ox = yo.x - l.x, oy = yo.y - l.y, od = Math.hypot(ox, oy) || 1, hx = -ox / od, hy = -oy / od;
      if (l.dash) {
        const dd = l.dash, resta = Math.max(0, dd.dur - dd.t) * dd.vel, c = Math.cos(dd.ang), sn = Math.sin(dd.ang), a2 = ox * c + oy * sn;
        if (dd.def.dano && a2 > 0 && a2 < resta + 20 && Math.abs(oy * c - ox * sn) < RADIO * 2 + 12) {
          s.amenazas.push(this.amenaza('embestida', a2 / dd.vel, (dd.def.dano ?? 0) >= 7, hx, hy, dd.ang, l, { ancho: 20, visto: dd.t, obj: dd }));
        }
        continue;
      }
      const h = l.accion?.h;
      if (!h) continue;
      const f = h.forma, ulti = l.accion.slot === 'e', gordo = (h.dano ?? 0) >= 8 || ulti;
      const queda = Math.max(0, l.accion.hasta - this.luta.t), visto = this.luta.t - (l.accion.desde ?? this.luta.t - 1), obj = l.accion;
      let a = null;
      if (AREAS.has(f) || f === 'vuelo') {
        const radio = f === 'plantaFeroz' ? h.ondas.at(-1) + (h.banda ?? 20) : f === 'erupcion' ? h.golpes * h.paso : f === 'estallido' ? (h.alcance ?? 170) * 0.6 : f === 'caparazon' ? h.alcance : (h.radio ?? 40);
        if (od < radio + RADIO + 16) a = this.amenaza('area', queda, gordo, hx, hy, null, l, { cx: l.x, cy: l.y, radio, obj });
      } else if (MELES.has(f)) {
        const alcance = h.alcance + (h.embestida ?? h.avance ?? 0) + (f === 'patada' ? 30 : 20);
        if (od < alcance) a = this.amenaza('mele', queda, gordo, hx, hy, null, l, { ancho: 20, obj });
      } else if (f === 'embestidas') a = this.amenaza('embestida', 0.1, true, hx, hy, Math.atan2(-oy, -ox), l, { ancho: 30, obj });
      else if (f === 'viento' && od < h.alcance + 10) a = this.amenaza('mele', queda, false, hx, hy, null, l, { ancho: 20, obj });
      if (a) { a.ulti = ulti; a.visto = visto; s.amenazas.push(a); }
    }
    // só reage ao que "viu" (tempo de reflexo) e, de cada ameaça, decide uma vez se percebeu
    s.amenazas = s.amenazas.filter(a => (a.visto ?? 1) >= cfg.reflejo && this.ve(a.obj ?? a, a.clase === 'disparo' && !a.fuerte ? cfg.basicos : cfg.esquiva + 0.1));
    s.peligro = s.amenazas.reduce((m, a) => (!m || a.t - (a.fuerte ? 0.3 : 0) < m.t - (m.fuerte ? 0.3 : 0) ? a : m), null);
    return s;
  }

  ve(obj, p) {
    if (!this.vistas.has(obj)) this.vistas.set(obj, aleatorio() < p);
    return this.vistas.get(obj);
  }

  // ameaça com o rumo de fuga (ex, ey): de área foge do centro, de golpe recua de lado, de disparo sai da linha
  amenaza(clase, t, fuerte, dirx, diry, ang, de, extra = {}) {
    const yo = this.l;
    let ex, ey;
    if (clase === 'area') {
      const zx = yo.x - extra.cx, zy = yo.y - extra.cy, zd = Math.hypot(zx, zy) || 1;
      ex = zx / zd; ey = zy / zd;
      if (zd < 4) { ex = -dirx; ey = -diry; }
    } else if (clase === 'mele') {
      ex = -dirx * 0.7 - diry * this.lado * 0.7;
      ey = -diry * 0.7 + dirx * this.lado * 0.7;
    } else {
      const px = -Math.sin(ang), py = Math.cos(ang);
      let sd = (de ? (yo.x - de.x) * px + (yo.y - de.y) * py : 0) >= 0 ? 1 : -1;
      if (extra.obj && typeof extra.obj === 'object') {
        if (!this.lados.has(extra.obj)) this.lados.set(extra.obj, sd);
        sd = this.lados.get(extra.obj);
      }
      ex = px * sd; ey = py * sd;
    }
    return { clase, t, fuerte, dirx, diry, ex, ey, de, ...extra };
  }

  // projétil: em quanto tempo passa por mim e se passa perto o bastante para acertar
  trayectoria(p) {
    const yo = this.l, rx = yo.x - p.x, ry = yo.y - p.y, v = Math.hypot(p.vx, p.vy) || 1;
    const t = (rx * p.vx + ry * p.vy) / (v * v);
    if (t <= 0 || t > 0.7) return null;
    const falta = Math.hypot(p.x + p.vx * t - yo.x, p.y + p.vy * t - yo.y), ancho = p.ancho + RADIO + 6;
    if (falta > ancho + (p.sigue ? 50 : p.fuerte ? 12 : 2)) return null;
    return this.amenaza('disparo', t, p.fuerte, -p.vx / v, -p.vy / v, Math.atan2(p.vy, p.vx), { x: p.x, y: p.y }, { ancho, visto: p.visto, obj: p.obj });
  }

  // ---------------------------------------------------------------- movimento
  mover(s) {
    const yo = this.l, it = this.it, c = this.c, t = this.luta.t, { d, ux, uy, rango } = s;
    const dtDec = Math.max(0.03, t - this.ultimaDecision);
    this.ultimaDecision = t;
    let mx = 0, my = 0;
    this.cambioLado -= dtDec;
    if (this.cambioLado <= 0) { this.cambioLado = entre(c.cambioLado[0], c.cambioLado[0] + c.cambioLado[1]); if (aleatorio() < 0.5) this.lado *= -1; }
    // distância boa: corpo a corpo entra em zigue-zague contra quem atira; quem atira recua de quem bate
    if (d > rango + c.rangoBanda) {
      const lateral = s.mele && !s.rivalMele ? c.lateralEntrada : c.lateral;
      mx += ux - uy * this.lado * lateral; my += uy + ux * this.lado * lateral;
    } else if (d < rango - c.rangoBanda) {
      const huida = s.rivalMele && rango >= 60 ? c.huidaMele : 1;
      mx -= ux * huida; my -= uy * huida;
    }
    // às vezes fica plantado atirando, às vezes rodeia
    if (t >= this.plan.hasta) {
      const plantado = aleatorio() < c.pPlantarse;
      this.plan = { plantado, hasta: t + (plantado ? entre(c.plantadoDur[0], c.plantadoDur[0] + c.plantadoDur[1]) : entre(c.rodeoDur[0], c.rodeoDur[0] + c.rodeoDur[1])) };
    }
    const plantado = this.plan.plantado && !s.mele && d < s.lmb.alcance && !s.peligro?.fuerte && (!s.rivalMele || d > 100);
    const rodeo = plantado ? 0 : s.mele && d < rango + 30 ? c.rodeo * 0.3 : c.rodeo;
    mx += -uy * this.lado * rodeo; my += ux * this.lado * rodeo;
    if (s.rEspejo && !s.mele && d < 160) { mx -= ux * 0.6; my -= uy * 0.6; }
    for (const a of s.amenazas) {
      const basico = a.clase === 'disparo' && !a.fuerte;
      if (a.t > (basico ? c.horizonteBasico : c.horizonteEsquiva)) continue;
      const peso = a.clase === 'disparo' ? (a.fuerte ? c.pesoEsquiva.fuerte : c.pesoEsquiva.disparo) : c.pesoEsquiva[a.clase] ?? 2;
      mx += a.ex * peso; my += a.ey * peso;
    }
    mx += s.huir.x; my += s.huir.y;
    const borde = empujeBorde(yo.x, yo.y, 34, 1.3);
    mx += borde.x; my += borde.y;
    const m = Math.hypot(mx, my);
    let nx = m > 0.15 ? mx / m : 0, ny = m > 0.15 ? my / m : 0;
    // muda de rumo com suavidade, menos quando precisa fugir já
    const urgente = s.amenazas.some(a => a.t < 0.5 && (a.fuerte || a.clase !== 'disparo')) || s.huir.x !== 0 || s.huir.y !== 0;
    const basicoEncima = s.amenazas.some(a => a.clase === 'disparo' && !a.fuerte && a.t < 0.4);
    if (!urgente) {
      const k = Math.min(basicoEncima ? 0.6 : 0.35, dtDec / (basicoEncima ? 0.18 : 0.45));
      nx = this.rumbo.x + (nx - this.rumbo.x) * k; ny = this.rumbo.y + (ny - this.rumbo.y) * k;
    }
    this.rumbo = { x: nx, y: ny };
    const mm = Math.hypot(nx, ny);
    it.mx = mm > 0.15 ? nx / mm : 0; it.my = mm > 0.15 ? ny / mm : 0;
  }

  // ---------------------------------------------------------------- escolha das skills
  elegir(s) {
    const yo = this.l, it = this.it, kit = yo.kit, c = this.c, { d } = s;
    if (yo.puedeEvolucionar && (d > c.evoDist || yo.hp / yo.hpMax < c.evoHp || s.vendido)) { it.mega = true; this.apuntar(s.lmb, s); return; }
    if (yo.puedeMega && (d < c.megaDist || s.vendido)) { it.mega = true; this.apuntar(s.lmb, s); return; }
    const listo = sl => {
      const h = kit[sl];
      // Archaludon: virou ponte, fica ponte até acabar (desfazer não desvia de nada)
      return !!h && !h.sinUlti && h.forma !== 'ninguna' && !(h.forma === 'puente' && yo.est.puente) && !(h.requiereRodar && !yo.est.rodando) && !(yo.est.rodando && sl !== 'esp' && sl !== 'e' && !h.usaRodando) && yo.cd[sl] <= 0 && !(sl === 'esp' && yo.est.sinDash) && (sl === 'e' ? yo.ultiLista : yo.energia >= (h.coste ?? 0));
    };
    const perfiles = {};
    for (const sl of SLOTS) if (kit[sl]) perfiles[sl] = perfil(kit[sl], sl, d);
    let usar = null;
    // dentro do Barrier não ataca (atacar estoura a bolha), a não ser que o rival esteja vendido
    const enBurbuja = !!yo.burbuja?.vivo && !s.vendido;
    if (s.peligro && aleatorio() < this.cfg.esquiva + 0.2) usar = this.responder(s, listo, perfiles);
    if (!usar && !enBurbuja) usar = this.atacar(s, listo, perfiles);
    if (!usar && !enBurbuja) usar = this.dashear(s, listo, perfiles);
    if (usar) {
      it[usar.slot] = true;
      if (usar.mx !== undefined) { it.mx = usar.mx; it.my = usar.my; this.rumbo = { x: usar.mx, y: usar.my }; }
      this.apuntar(usar.P, s, usar.hacia);
      // dash vai para onde a mira aponta: mira no rumo escolhido
      if (usar.slot === 'esp' && usar.mx !== undefined && kit.esp.forma === 'dash') { it.ax = yo.x + usar.mx * kit.esp.dist; it.ay = yo.y + usar.my * kit.esp.dist; }
    }
    const lmb = s.lmb;
    this.disparando = !enBurbuja && !(s.rEspejo && lmb.tipo !== 'mele') && yo.calor < c.calorTope && d < lmb.alcance + (lmb.tipo === 'mele' ? 10 : 0)
      && (lmb.tipo === 'mele' || this.pAcierto(lmb, s) >= c.pBasico);
    if (!usar) this.apuntar(lmb, s);
  }

  // algo forte vindo: dash para fora, escudo, espelho, ou cortar o raio com outro
  responder(s, listo, perfiles) {
    const yo = this.l, kit = yo.kit, c = this.c, p = s.peligro, d = s.d;
    const gordo = p.fuerte || p.ulti;
    if (p.clase === 'rayo' && (p.queda ?? 1) > 0.5 && listo('esp') && kit.esp.forma === 'vuelo') return { slot: 'esp', P: perfiles.esp };
    const hb = kit.esp;
    if (hb?.forma === 'burbuja' && listo('esp') && !yo.burbuja?.vivo && (gordo || p.clase !== 'disparo') && p.t < Math.min(0.45, (hb.dur ?? 1.8) - 0.3)) {
      return { slot: 'esp', P: perfiles.esp, mx: -s.ux, my: -s.uy };
    }
    for (const sl of ['rmb', 'q', 'e']) {
      if (!listo(sl)) continue;
      const h = kit[sl], f = h.forma, P = perfiles[sl];
      if (f === 'espejo' && (p.clase === 'disparo' || p.clase === 'rayo') && p.t < (h.dur ?? 1) - 0.1) return { slot: sl, P };
      if (f === 'escudo' && gordo && p.t < (h.dur ?? 2) - 0.2) return { slot: sl, P };
      if (f === 'pulso' && h.bloqueo && (p.clase === 'mele' || p.clase === 'embestida' || gordo)) {
        const c2 = h.carga ?? 0;
        if (p.t >= c2 - 0.05 && p.t <= c2 + h.bloqueo * 0.85) return { slot: sl, P };
      }
      if (f === 'estallido' && h.anula && (p.clase === 'mele' || p.clase === 'embestida' || (p.clase === 'disparo' && gordo)) && p.t < 0.3) return { slot: sl, P };
      if ((f === 'cono' && h.anula) && p.de === s.r && p.clase === 'disparo' && d < P.alcance + 20 && p.t > (h.carga ?? 0) + 0.05) return { slot: sl, P, hacia: p };
      if (f === 'clones' && !yo.clones && (p.clase === 'disparo' || p.clase === 'rayo')) return { slot: sl, P };
      if (f === 'humo' && (p.clase === 'mele' || p.clase === 'embestida')) return { slot: sl, P };
    }
    if (p.t < c.dashUrgencia && (gordo || p.ancho > 28 || p.clase === 'rayo' || p.clase === 'area' || p.clase === 'embestida')) {
      for (const sl of ['esp', 'e', 'rmb', 'q']) {
        if (!listo(sl)) continue;
        const h = kit[sl], P = perfiles[sl];
        if (h.forma === 'vuelo' && (gordo || p.clase === 'rayo')) return { slot: sl, P };
        if (h.forma === 'embestidas' && d < P.alcance && aleatorio() < this.cfg.esquiva) return { slot: sl, P };
        if (h.forma === 'meteoro' && gordo && this.pAcierto(P, s) > 0.5) return { slot: sl, P };
        if (sl === 'esp' && h.forma === 'dash' && h.invul !== false && aleatorio() < this.cfg.esquiva) {
          const m = Math.hypot(p.ex, p.ey) || 1;
          return { slot: sl, P, mx: p.ex / m, my: p.ey / m };
        }
      }
    }
    return null;
  }

  // nota cada skill pronta (chance de acerto x dano esperado) e fica com a melhor que vale a pena
  atacar(s, listo, perfiles) {
    const yo = this.l, kit = yo.kit, cfg = this.cfg, c = this.c, { r, d } = s, luta = this.luta;
    let mejor = null, mejorValor = 0;
    const surge = yo.energia >= REGLAS.surgeUmbral;
    const prisa = (luta.reloj ?? 99) < 20 && yo.hp / yo.hpMax <= r.hp / r.hpMax;
    const acosado = s.rivalMele && s.rango >= 100 && d < c.acosadoDist;
    for (const sl of ['e', 'rmb', 'q', 'esp']) {
      if (!listo(sl)) continue;
      const h = kit[sl], P = perfiles[sl];
      if (sl === 'esp' && !ATAQUES_ESP.has(h.forma)) continue;
      if (P.tipo === 'buff' || P.tipo === 'defensa' || P.tipo === 'vuelo' || P.tipo === 'movil') {
        const u = this.especial(sl, h, P, s);
        if (u) return u;
        continue;
      }
      if (s.rEspejo && P.tipo === 'dirigida') continue;
      let p = this.pAcierto(P, s);
      if (p <= 0) continue;
      p = p * cfg.juicio + aleatorio() * (1 - cfg.juicio);
      const ef = efectividad(h.tipo, r.tipos);
      const danoEst = (h.dano ?? 0) * P.golpes * ef * (REGLAS.danoGlobal ?? 1) * (yo.atk / r.defensa) * (surge && sl !== 'e' ? REGLAS.surgeMult ?? 1.3 : 1);
      const letal = danoEst >= r.hp;
      const aparta = !!(h.empuje || h.aturde || h.ralentiza || h.forma === 'trampa' || h.forma === 'viento' || h.forma === 'laco');
      let valor = p * (c.valorBase + c.pesoDano * Math.min(1, danoEst / 20));
      if (ef > 1) valor *= c.pesoEficacia; else if (ef < 1) valor *= 0.8;
      if (letal) valor *= c.pesoLetal;
      if (s.vendido || s.rCanaliza) valor *= c.pesoVendido;
      if (acosado && aparta) valor *= c.pesoApartar;
      if (s.rivalUltiLista) valor *= 1 - c.cautelaUlti;
      if (sl === 'e') {
        let umbral = cfg.umbralUlti - Math.min(0.2, Math.max(0, luta.t - (this.ultiDesde ?? luta.t) - c.ultiPaciencia) / 40);
        if (letal || s.clavado > P.retardo * 0.7 || prisa || yo.hp / yo.hpMax < c.ultiDesesperado) umbral -= c.ultiRelajo;
        if (p < umbral) continue;
      } else {
        const ganas = surge || yo.energia >= c.energiaTope || ef > 1 || letal || s.vendido || s.rCanaliza || p >= c.pSeguro
          || (acosado && aparta) || (P.tipo === 'area' && luta.t - this.aterrice < 0.6);
        if (p < (ganas ? c.pConGanas : c.pSinGanas)) continue;
        if (!ganas && aleatorio() > cfg.agresividad * 0.7) continue;
        if (!ganas && yo.energia < c.reservaEnergia && aleatorio() < c.pAhorro) continue;
      }
      if (valor > mejorValor) { mejorValor = valor; mejor = { slot: sl, P }; }
    }
    return mejor;
  }

  // buffs, curas e defesas: cada um tem a sua hora
  especial(sl, h, P, s) {
    const yo = this.l, c = this.c, { r, d } = s, f = h.forma, viene = !!s.peligro, hp = yo.hp / yo.hpMax, u = { slot: sl, P }, t = this.luta.t;
    switch (f) {
      case 'arraigo': return hp < c.arraigoHp && d < c.arraigoDist && !s.rivalMele ? u : null;
      case 'recuperar': return hp < c.curaHp && (!viene || hp < c.curaUrgente) ? u : null;
      case 'curaAnillo': return hp < 0.8 && !yo.est.aquaRing ? u : null;
      case 'descanso': return hp < c.restHp && (d > c.restDist || s.vendido) && !viene ? u : null;
      case 'crecimiento':
        if ((d > c.growthDist || s.vendido) && !viene && (!yo.ultiLista || yo.energia < 60)) {
          this.mantener = { slot: sl, hasta: t + (h.max ?? 3) * (0.5 + aleatorio() * 0.5), cerca: s.vendido ? 40 : c.growthSoltar };
          return u;
        }
        return null;
      case 'potenciar': {
        const p = yo.est.potencia, tope = p && (p.n ?? p.nivel ?? 1) >= (h.acumula ?? 1) && p.hasta - t > 2;
        return !tope && (d < c.buffDist || (h.enfria && yo.calor > 60)) ? u : null;
      }
      case 'torreta': return d < (h.alcance ?? 150) + 80 ? u : null;
      case 'clones': return d < c.clonesDist && !yo.clones ? u : null;
      case 'humo': return d < c.humoCerca ? u : null;
      case 'espejo': return d < 170 && !s.rivalMele && (r.accion || t - r.ultimoAtaque < 0.3) ? u : null;
      case 'caparazon': return d < P.alcance && !s.rInvul ? u : null;
      case 'escudo': return d < c.escudoDist && (r.accion || viene) ? u : null;
      case 'chapoteo': return d > c.splashDist || s.vendido ? u : null;
      case 'vuelo': return this.volarOfensivo(sl, h, P, s);
      default: return null;
    }
  }

  // dash: foge quando está apertado, entra quando é corpo a corpo, ou usa como golpe
  dashear(s, listo, perfiles) {
    const yo = this.l, cfg = this.cfg, c = this.c, h = yo.kit.esp, { d, ux, uy } = s;
    if (h?.forma === 'rodar') return !yo.est.rodando && listo('esp') && d > 50 && d < 320 && aleatorio() < cfg.agresividad * 0.6 ? { slot: 'esp', P: perfiles.esp } : null;
    if (!h || !listo('esp') || (h.forma !== 'dash' && h.forma !== 'vuelo' && h.forma !== 'burbuja')) return null;
    const P = perfiles.esp, hp = yo.hp / yo.hpMax;
    if (h.forma === 'burbuja') {
      const acosado = (hp < c.escapeHp || (s.rivalMele && s.rango >= 60)) && d < c.escapeDist;
      return !yo.burbuja?.vivo && acosado && aleatorio() < c.pEscape + cfg.esquiva * 0.3 ? { slot: 'esp', P, mx: -ux * 0.7 - uy * this.lado * 0.7, my: -uy * 0.7 + ux * this.lado * 0.7 } : null;
    }
    if (P.tipo === 'vuelo') return this.volarOfensivo('esp', h, P, s);
    if ((hp < c.escapeHp || (s.rivalMele && s.rango >= 60)) && d < c.escapeDist && aleatorio() < c.pEscape + cfg.esquiva * 0.3) {
      return { slot: 'esp', P, mx: -ux * 0.7 - uy * this.lado * 0.7, my: -uy * 0.7 + ux * this.lado * 0.7 };
    }
    if (P.tipo === 'embestida' && d > 28 && d < P.alcance && this.pAcierto(P, s) >= c.pEmbestir && aleatorio() < cfg.agresividad) {
      const q = this.prever(P, s), qx = q.x - yo.x, qy = q.y - yo.y, m = Math.hypot(qx, qy) || 1;
      return { slot: 'esp', P, mx: qx / m, my: qy / m };
    }
    if (s.mele && d > 70 && d < P.alcance + 60 && !s.peligro && aleatorio() < cfg.agresividad * c.pEntrar) {
      const lado = d > P.alcance ? this.lado * c.entradaLateral : 0, mx = ux - uy * lado, my = uy + ux * lado, m = Math.hypot(mx, my) || 1;
      return { slot: 'esp', P, mx: mx / m, my: my / m };
    }
    return null;
  }

  volarOfensivo(sl, h, P, s) {
    const { d } = s, c = this.c, u = { slot: sl, P };
    if (s.rInvul > 0.5) return null;
    if (d > c.volarLejos && aleatorio() < this.cfg.agresividad * c.pVolar) return u;
    if (d < h.radio * 0.9 && (s.vendido || s.rCanaliza || aleatorio() < this.cfg.agresividad * c.pCaer)) return u;
    if (this.l.hp / this.l.hpMax < c.escapeHp && d < 80) return u;
    return null;
  }

  // voando ou debaixo da terra: persegue o rival e sai quando está em cima dele
  volar(it, r) {
    const yo = this.l, vuelo = yo.est.vuelo, h = yo.kit.esp;
    const huye = yo.hp / yo.hpMax < 0.3 && r.hp > yo.hp;
    const dx = r.x - yo.x, dy = r.y - yo.y, d = Math.hypot(dx, dy) || 1;
    it.mx = huye ? -dx / d : dx / d; it.my = huye ? -dy / d : dy / d;
    it.ax = r.x; it.ay = r.y;
    it.sueltoVuelo = true;
    const dentro = (h?.dur ?? 1.5) - (vuelo.hasta - this.luta.t);
    const rInvul = r.est.invul || r.est.vuelo || r.est.bloqueo || (r.dash && r.dash.def.invul !== false);
    it.esp = !huye && d < (h?.radio ?? 40) * 0.75 && !rInvul && dentro > 0.6;
  }

  // ---------------------------------------------------------------- pontaria
  pAcierto(P, s) {
    const { r, d } = s, h = P.h, cfg = this.cfg;
    if (P.tipo === 'buff' || P.tipo === 'defensa') return 1;
    if (s.rInvul > P.retardo + 0.05) return 0;
    if (d > P.alcance) return P.tipo === 'mele' || P.tipo === 'area' || P.tipo === 'embestida' ? 0 : Math.max(0, 1 - (d - P.alcance) / 40) * 0.3;
    if (s.clavado > P.retardo + 0.05) return 0.95;
    const frenado = !!(r.est.lento || r.est.enredado || r.est.confuso), atado = s.canaliza > P.retardo + 0.05;
    const visible = (h.carga ?? 0) + (h.aviso ?? 0) + (h.lanzar ?? 0) >= cfg.reflejo + 0.08 && !atado && !frenado;
    let p;
    if (P.tipo === 'mele') p = d < P.alcance * 0.7 ? 0.9 : 0.65;
    else if (P.forma === 'meteoro') p = r.velBase * 0.9 < (h.sigue ?? 150) ? 0.75 : 0.45;
    else if (P.tipo === 'area') {
      const sale = visible ? r.velBase * P.retardo * 0.8 : 0, margen = P.alcance - d - sale;
      p = margen > 15 ? 0.9 : margen > 0 ? 0.6 : 0.3;
      if (P.forma === 'lluvia') p = Math.min(p, 0.75);
    } else {
      let perp = Math.abs(-s.uy * (r.vx ?? 0) + s.ux * (r.vy ?? 0));
      if (visible) perp = Math.max(perp, r.velBase * 0.6);
      if (RAYOS.has(P.forma) && h.giro) {
        const necesario = perp / Math.max(d, 30);
        p = necesario < h.giro * 0.6 ? 0.9 : necesario < h.giro ? 0.7 : 0.4;
      } else {
        const desvio = Math.max(0, perp * (visible ? P.retardo : Math.max(0, P.retardo - 0.3)) * (1 - P.sigue) - P.ancho - RADIO);
        p = Math.max(0.1, 1 - desvio / (RADIO + 20));
      }
    }
    if (P.forma === 'laco') p = Math.min(p, d < P.alcance * 0.5 ? 0.8 : 0.5);
    const rayoRival = r.accion?.h && RAYOS.has(r.accion.h.forma);
    if (atado) p = rayoRival && RAYOS.has(P.forma) ? Math.min(p, 0.15) : Math.max(p, 0.85);
    if (frenado) p = Math.min(1, p + 0.2);
    if (visible && r.cd.esp <= 0) p *= P.tipo === 'area' ? 0.75 : 0.65;
    else if (P.retardo > 0.3 && r.cd.esp <= 0) p *= 0.85;
    return p;
  }

  // onde o rival vai estar quando o golpe chegar
  prever(P, s) {
    const { r, d } = s;
    let t = Math.min(0.3, P.retardo) * (1 - P.sigue * 0.8), x = r.x, y = r.y;
    if (r.est.aturdido || r.est.arraigo || s.rCanaliza || r.est.dormido) t = 0;
    if (r.dash) {
      const dd = r.dash, tt = Math.min(Math.max(0, dd.dur - dd.t), t);
      x += Math.cos(dd.ang) * dd.vel * tt; y += Math.sin(dd.ang) * dd.vel * tt;
    } else if (t > 0) {
      let vx = r.vx ?? 0, vy = r.vy ?? 0;
      const v = Math.hypot(vx, vy), vmax = r.velBase;
      if (v > vmax) { vx *= vmax / v; vy *= vmax / v; }
      if (r.accion?.lento != null) { vx *= r.accion.lento; vy *= r.accion.lento; }
      x += vx * t; y += vy * t;
    }
    return { ...limitarCampo(x, y), d };
  }

  apuntar(P, s, hacia) {
    const yo = this.l, it = this.it;
    // cortando um disparo: mira no projétil, não no rival
    if (hacia && hacia.clase === 'disparo' && hacia.de !== s.r) { it.ax = yo.x + hacia.dirx * 120; it.ay = yo.y + hacia.diry * 120; return; }
    if (s.r.oculto && this.vistoEn) { it.ax = this.vistoEn.x + (aleatorio() * 2 - 1) * 20; it.ay = this.vistoEn.y + (aleatorio() * 2 - 1) * 14; return; }
    const q = this.prever(P, s), err = this.cfg.error * (0.6 + Math.min(1, s.d / 250)) * (P.tipo === 'mele' ? 0.3 : 1);
    it.ax = q.x + (aleatorio() * 2 - 1) * err;
    it.ay = q.y + (aleatorio() * 2 - 1) * err;
  }
}

// boneco de treino: gira devagar pelo lado direito da arena ou fica parado (tecla K)
export class Muneco {
  constructor(l) { this.l = l; this.t = 0; this.quieto = false; }
  intento(dt = 1 / 60) {
    this.t += dt;
    const l = this.l, r = l?.rival;
    const base = { ax: r ? r.x : (l?.x ?? 0) - 50, ay: r ? r.y : l?.y ?? 0 };
    if (!l || this.quieto) return { mx: 0, my: 0, ...base };
    const tx = OVALO.cx + OVALO.rx * 0.24 + Math.cos(this.t * 0.5) * 110, ty = OVALO.cy + Math.sin(this.t) * 60;
    const dx = tx - l.x, dy = ty - l.y, d = Math.hypot(dx, dy) || 1, v = d > 6 ? 0.45 : 0;
    return { mx: (dx / d) * v, my: (dy / d) * v, ...base };
  }
}
