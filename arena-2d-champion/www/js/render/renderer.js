// Desenha a batalha: estádio, câmera que acompanha a luta, treinadores, Pokémon, golpes, marcas no
// chão, clima e animações especiais (Mega, choque de Megas, choque de raios).
import { WORLD_W, WORLD_H, FIELD } from '../engine/constants.js';
import { BODY, TYPE_COLOR, MOVES, displayName } from '../data/dex.js';
import { buildArena, drawArena } from './arena.js';
import { Fx, palette } from './fx.js';
import { drawHud } from './hud.js';

const TAU = Math.PI * 2;
const SIDE_COLOR = ['#e8433f', '#3f7fe8'];
const DECAL_FOR = { Fire: 'scorch', Water: 'puddle', Ice: 'frost', Ground: 'crack', Rock: 'crack', Poison: 'slime', Grass: 'leaves', Steel: 'crack' };
const TRAINER_POS = [{ x: 110, y: FIELD.y + FIELD.h / 2 + 80 }, { x: WORLD_W - 110, y: FIELD.y + FIELD.h / 2 + 80 }];

export class Renderer {
  constructor(canvas, bank, sound) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.bank = bank;
    this.sound = sound;
    this.fx = new Fx();
    this.time = 0;
    this.weatherParts = [];
    this.flashes = new Map();
    this.hpShown = new Map();
    this.afterimages = [];
    this.trainerPose = [{ t: 0, pose: 'idle' }, { t: 0, pose: 'idle' }];
    this.trainers = ['red', 'blue'];
    this.arena = null;
    this.vibrate = true;
    this.cam = { x: WORLD_W / 2, y: FIELD.y + FIELD.h / 2, z: 0.5 };
    this.resize();
  }

  setBattle(battle, { trainers, humans } = {}) {
    this.battle = battle;
    if (!this.arena) this.arena = buildArena();
    if (trainers) this.trainers = trainers;
    if (humans) this.humans = humans;
    this.fx = new Fx();
    this.weatherParts = [];
    this.flashes.clear();
    this.hpShown.clear();
    this.afterimages = [];
    this.endShown = 0;
    this.climate = null;
    this.camInit = false;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    this.dpr = dpr;
    this.W = W;
    this.H = H;
  }

  // ------------------------------------------------------------ eventos da batalha
  consume(events) {
    const fx = this.fx;
    for (const e of events) {
      switch (e.t) {
        case 'float': fx.float(e.x, e.y, e.text, e.color, e.big); break;
        case 'label': fx.label(e.mon, e.text); this.pose(e.mon.side, 'point', 0.45); break;
        case 'hit': {
          this.flashes.set(e.mon.uid, this.time);
          const type = e.mv.type;
          const big = e.eff > 1 || e.crit;
          fx.burst(e.x, e.y - 24, type, big ? 26 : 14, big ? 300 : 190);
          fx.sparks(e.x, e.y - 24, '#ffffff', big ? 14 : 8, big ? 520 : 380);
          fx.glow(e.x, e.y - 24, TYPE_COLOR[type], big ? 70 : 44, 0.25);
          if (big) fx.shake = Math.max(fx.shake, e.eff > 1 ? 9 : 6);
          if (DECAL_FOR[type] && Math.random() < 0.6) fx.decal(e.x, e.y, DECAL_FOR[type], 22);
          this.sound.play(e.eff > 1 ? 'hitSuper' : e.eff < 1 ? 'hitWeak' : 'hit');
          if (e.crit) this.sound.play('crit');
          if (this.vibrate && e.dmg > 0) navigator.vibrate?.(e.eff > 1 ? 45 : 20);
          break;
        }
        case 'impact': fx.burst(e.x, e.y, e.type, 10, 150); fx.glow(e.x, e.y, TYPE_COLOR[e.type], 30, 0.2); if (DECAL_FOR[e.type]) fx.decal(e.x, e.y, DECAL_FOR[e.type], 20); break;
        case 'explode': {
          const r = e.r || 60;
          fx.burst(e.x, e.y, e.type, e.big ? 70 : 32, e.big ? 520 : 300, { size: e.big ? 6 : 4.5, life: 0.7 });
          fx.glow(e.x, e.y, '#fff3b0', r * 1.4, 0.35);
          fx.smoke(e.x, e.y - 10, e.big ? 9 : 5, 'rgba(150,140,135,0.28)', e.big ? 34 : 18);
          if (e.big) for (let i = 0; i < 26; i++) {
            const a = Math.random() * TAU, sp = 120 + Math.random() * 320;
            fx.add({ x: e.x, y: e.y - 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 80, drag: 2.5, size: 7 + Math.random() * 7, grow: 10, life: 0.5 + Math.random() * 0.4, color: palette('Fire')[1 + (i % 3)], shape: 'circle', blend: 'lighter' });
          }
          fx.shake = Math.max(fx.shake, e.big ? 18 : 7);
          if (e.big) { fx.flash = 0.8; fx.flashColor = '#fff6d0'; }
          fx.decal(e.x, e.y, DECAL_FOR[e.type] || 'scorch', Math.min(140, r * 0.45), 9);
          this.sound.play('explode');
          break;
        }
        case 'collide': fx.burst(e.x, e.y, e.a, 12, 220); fx.burst(e.x, e.y, e.b, 12, 220); fx.sparks(e.x, e.y, '#fff', 10); this.sound.play('clash'); break;
        case 'steam': fx.smoke(e.x, e.y, 10, 'rgba(240,245,250,0.5)', 26); break;
        case 'shake': fx.shake = Math.max(fx.shake, e.amount); if (e.amount > 6) this.sound.play('quake'); break;
        case 'execute': this.onExecute(e); break;
        case 'charge': this.sound.play('beam', { type: MOVES[e.id].type }); break;
        case 'dodgeStart': this.sound.play('dodge'); fx.smoke(e.mon.x, e.mon.y, 4, 'rgba(230,230,220,0.45)', 10); break;
        case 'dodge': fx.sparks(e.mon.x, e.mon.y - 24, '#9ff0ff', 10, 300); break;
        case 'boost': this.sound.play(e.delta > 0 ? 'up' : 'down'); this.boostFx(e.mon, e.delta > 0); break;
        case 'status': this.sound.play('status'); break;
        case 'protect': case 'protectUp': this.sound.play('protect'); break;
        case 'faint': this.sound.play('faint'); fx.shake = 10; fx.smoke(e.mon.x, e.mon.y, 8, 'rgba(255,255,255,0.4)', 18); break;
        case 'sendOut': this.pose(e.mon.side, 'throw', 0.7); this.sendOutFx(e.mon); break;
        case 'recall': this.recallFx(e.mon); this.pose(e.mon.side, 'point', 0.45); break;
        case 'megaStart': this.sound.play('mega'); this.pose(e.side, 'mega', 2.2); break;
        case 'megaClash': this.sound.play('megaClash'); this.pose(0, 'mega', 3.2); this.pose(1, 'mega', 3.2); break;
        case 'megaEvolve': fx.burst(e.mon.x, e.mon.y - 40, 'Fairy', 60, 340, { size: 5, life: 1 }); fx.glow(e.mon.x, e.mon.y - 40, '#ffffff', 160, 0.5); fx.flash = 1; fx.flashColor = '#ffffff'; break;
        case 'megaClimate': this.climate = { name: e.name, t: 0 }; this.sound.play('weather'); break;
        case 'weather': if (e.id) this.sound.play('weather'); break;
        case 'room': if (e.on) { fx.flash = 0.5; fx.flashColor = '#ff9cf0'; this.sound.play('weather'); } break;
        case 'hazard': this.sound.play('quake'); break;
        case 'hazardHit': fx.burst(e.mon.x, e.mon.y - 20, 'Rock', 16, 200); break;
        case 'clashStart': this.sound.play('clash'); fx.flash = 0.6; fx.flashColor = '#ffffff'; break;
        case 'clashEnd': fx.burst(e.x, e.y, 'Electric', 60, 420, { size: 5 }); fx.glow(e.x, e.y, '#ffffff', 200, 0.4); fx.shake = 16; this.sound.play('explode'); break;
        case 'bolt': this.bolts = [...(this.bolts || []), { x: e.x, y: e.y, t: 0 }]; this.sound.play('thunder'); fx.flash = 0.45; fx.flashColor = '#fff7b0'; fx.decal(e.x, e.y, 'scorch', 30); break;
        case 'rockfall': fx.burst(e.x, e.y, 'Rock', 26, 260, { up: 120 }); fx.decal(e.x, e.y, 'crack', 40); fx.smoke(e.x, e.y, 6, 'rgba(160,130,80,0.5)', 20); this.sound.play('quake'); break;
        case 'emerge': fx.burst(e.x, e.y, e.mode === 'dig' ? 'Ground' : e.mode === 'dive' ? 'Water' : e.mode === 'phantom' ? 'Ghost' : 'Flying', 28, 260); fx.shake = 7; if (e.mode === 'dig') fx.decal(e.x, e.y, 'crack', 50); break;
        case 'vanish': fx.burst(e.mon.x, e.mon.y, e.mode === 'dig' ? 'Ground' : e.mode === 'dive' ? 'Water' : e.mode === 'phantom' ? 'Ghost' : 'Flying', 18, 200); this.sound.play('dash'); break;
        case 'areaHit': this.areaFx(e); break;
        case 'subBreak': fx.burst(e.mon.x, e.mon.y - 20, 'Normal', 18, 180); break;
        case 'end': this.sound.play(e.winner >= 0 && this.humans?.[e.winner] ? 'win' : e.winner === -1 ? 'up' : 'lose'); break;
      }
    }
  }

  onExecute(e) {
    const m = MOVES[e.id];
    const kind = e.shape;
    if (kind === 'beam' || kind === 'cone') this.sound.play('beam', { type: m.type });
    else if (kind === 'projectile' || kind === 'wave' || kind === 'area') this.sound.play('shoot', { type: m.type });
    else if (['lunge', 'grab', 'rollout', 'leap'].includes(kind)) this.sound.play('dash');
    else if (kind === 'slash' || kind === 'spin') this.sound.play('swing');
    else if (kind === 'ring') this.sound.play(m.type === 'Ground' ? 'quake' : 'shoot', { type: m.type });
    if (kind === 'beam') this.fx.glow(e.mon.x, e.mon.y - 30, TYPE_COLOR[m.type], 60, 0.3);
    if (kind === 'self' || kind === 'field') {
      const heal = m.heal || ['synthesis', 'roost', 'rest', 'lifedew'].includes(e.id);
      this.sound.play(heal ? 'heal' : 'up');
      for (let i = 0; i < 18; i++) this.fx.add({ x: e.mon.x + (Math.random() - 0.5) * 50, y: e.mon.y - Math.random() * 20, vy: -60 - Math.random() * 80, size: 3, life: 0.8, color: palette(m.type)[Math.floor(Math.random() * 3)], shape: 'spark', blend: 'lighter' });
    }
  }

  boostFx(mon, up) {
    for (let i = 0; i < 10; i++) {
      this.fx.add({ x: mon.x + (Math.random() - 0.5) * 40, y: mon.y - Math.random() * 30, vy: up ? -140 : 120, size: 3, life: 0.6, color: up ? '#ff8c5a' : '#6aa8ff', shape: 'streak', blend: 'lighter' });
    }
    this.fx.float(mon.x + 24, mon.y - 70, up ? '▲' : '▼', up ? '#ff8c5a' : '#6aa8ff');
  }

  sendOutFx(mon) {
    const fx = this.fx;
    fx.glow(mon.x, mon.y - 30, '#ffffff', 90, 0.4);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      fx.add({ x: mon.x, y: mon.y - 30, vx: Math.cos(a) * 260, vy: Math.sin(a) * 180, drag: 4, size: 3, life: 0.5, color: i % 2 ? '#ffffff' : '#ff5a5a', shape: 'streak', blend: 'lighter' });
    }
  }

  recallFx(mon) {
    for (let i = 0; i < 16; i++) this.fx.add({ x: mon.x + (Math.random() - 0.5) * 50, y: mon.y - Math.random() * 60, vx: 0, vy: -30, size: 4, life: 0.4, color: '#ff4040', shape: 'streak', blend: 'lighter' });
  }

  areaFx(e) {
    const fx = this.fx;
    const big = e.id === 'blastburn';
    fx.burst(e.x, e.y, e.type, big ? 70 : 26, big ? 460 : 240, { up: 100, size: big ? 6 : 4 });
    fx.glow(e.x, e.y - 20, TYPE_COLOR[e.type], big ? 220 : 70, 0.3);
    if (DECAL_FOR[e.type]) fx.decal(e.x, e.y, DECAL_FOR[e.type], e.r * 0.8);
    if (big) { fx.shake = 14; this.sound.play('explode'); }
    if (e.type === 'Rock' || e.type === 'Ground') { this.sound.play('quake'); fx.smoke(e.x, e.y, 5, 'rgba(170,140,90,0.5)', 22); }
    if (e.id === 'thunder') this.bolts = [...(this.bolts || []), { x: e.x, y: e.y, t: 0 }];
  }

  pose(side, pose, t) { this.trainerPose[side] = { pose, t }; }

  // ------------------------------------------------------------ câmera
  updateCamera(dt, b) {
    const mons = b.sides.map(s => s.active).filter(m => m && (m.onField || m.action?.type === 'fainting'));
    let tx = FIELD.x + FIELD.w / 2, ty = FIELD.y + FIELD.h / 2, spanX = 900, spanY = 600;
    const focus = [];
    if (b.cinematic?.type === 'mega' || b.cinematic?.type === 'megaclash') {
      for (const i of b.cinematic.sides) { const m = b.sides[i].active; if (m) focus.push(m); }
    } else if (b.clash) {
      focus.push({ x: b.clash.a.ox, y: b.clash.a.oy }, { x: b.clash.b.ox, y: b.clash.b.oy });
    } else focus.push(...mons);
    if (focus.length) {
      const xs = focus.map(m => m.x), ys = focus.map(m => m.y - 30);
      tx = (Math.min(...xs) + Math.max(...xs)) / 2;
      ty = (Math.min(...ys) + Math.max(...ys)) / 2;
      spanX = Math.max(...xs) - Math.min(...xs) + 520;
      spanY = Math.max(...ys) - Math.min(...ys) + 380;
    }
    const zMax = this.H / 520, zMin = Math.max(this.W / WORLD_W, this.H / 1180);
    let tz = Math.min(this.W / spanX, this.H / spanY);
    if (b.cinematic?.type === 'mega') tz = zMax * 1.15;
    tz = Math.max(zMin, Math.min(zMax * 1.2, tz));
    if (!this.camInit) { this.cam = { x: tx, y: ty, z: tz }; this.camInit = true; }
    const k = Math.min(1, dt * 3.2);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    this.cam.z += (tz - this.cam.z) * Math.min(1, dt * 2.2);
    // a câmera não sai do estádio
    const hw = this.W / (2 * this.cam.z), hh = this.H / (2 * this.cam.z);
    this.cam.x = Math.max(hw, Math.min(WORLD_W - hw, this.cam.x));
    this.cam.y = Math.max(hh - 40, Math.min(WORLD_H - hh, this.cam.y));
  }

  view() {
    const c = this.cam;
    return { x0: c.x - this.W / (2 * c.z), y0: c.y - this.H / (2 * c.z), x1: c.x + this.W / (2 * c.z), y1: c.y + this.H / (2 * c.z) };
  }

  w2s(x, y) {
    return { x: (x - this.cam.x) * this.cam.z + this.W / 2, y: (y - this.cam.y) * this.cam.z + this.H / 2 };
  }

  // ------------------------------------------------------------ quadro
  frame(dt, ui) {
    const b = this.battle;
    this.time += dt;
    this.ui = ui;
    this.dt = dt;
    if (b) {
      this.consume(b.events);
      b.events.length = 0;
    }
    this.fx.update(dt);
    if (this.climate) this.climate.t += dt;
    for (const p of this.trainerPose) p.t -= dt;
    if (this.bolts) { for (const bo of this.bolts) bo.t += dt; this.bolts = this.bolts.filter(bo => bo.t < 0.35); }
    for (const a of this.afterimages) a.t += dt;
    this.afterimages = this.afterimages.filter(a => a.t < a.life);

    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#12132a';
    g.fillRect(0, 0, this.W, this.H);
    if (!b) return;

    this.updateCamera(dt, b);
    g.save();
    const sh = this.fx.shake;
    g.translate(this.W / 2 + (sh ? (Math.random() - 0.5) * sh * this.cam.z * 2 : 0), this.H / 2 + (sh ? (Math.random() - 0.5) * sh * this.cam.z * 2 : 0));
    g.scale(this.cam.z, this.cam.z);
    g.translate(-this.cam.x, -this.cam.y);
    const excited = b.clash || b.cinematic?.type?.startsWith('mega');
    drawArena(g, this.arena, Math.floor(this.time / (excited ? 0.12 : 0.4)) % 2);
    this.fx.drawDecals(g);
    this.drawField(g, b);
    this.drawWorld(g, b, dt);
    this.fx.draw(g);
    this.drawWeatherWorld(g, b, dt);
    this.drawTexts(g, b);
    this.drawCinematicWorld(g, b);
    g.restore();

    this.drawWeatherScreen(g, b);
    if (this.fx.flash > 0) {
      g.globalAlpha = Math.min(1, this.fx.flash);
      g.fillStyle = this.fx.flashColor;
      g.fillRect(0, 0, this.W, this.H);
      g.globalAlpha = 1;
    }
    drawHud(g, this, b, ui);
  }

  // ------------------------------------------------------------ chão: terreno, zonas, marcações, armadilhas
  drawField(g, b) {
    const t = this.time;
    if (b.field.terrain?.id === 'grassyterrain') {
      g.fillStyle = 'rgba(90,210,70,0.16)';
      g.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
      for (let i = 0; i < 160; i++) {
        const x = FIELD.x + ((i * 97) % FIELD.w), y = FIELD.y + ((i * 53) % FIELD.h);
        g.fillStyle = '#3d9a2c';
        g.fillRect(x, y, 3, 8 + Math.sin(t * 3 + i) * 2);
        if (i % 7 === 0) { g.fillStyle = i % 2 ? '#ffe86a' : '#ff9ccb'; g.fillRect(x + 4, y - 3, 5, 5); }
      }
    }
    if (b.field.trickroom > 0) {
      g.strokeStyle = `rgba(255,120,240,${0.35 + 0.15 * Math.sin(t * 4)})`;
      g.lineWidth = 6;
      for (let i = 0; i < 4; i++) {
        const inset = 30 + i * 70 + ((t * 40) % 70);
        g.strokeRect(FIELD.x + inset, FIELD.y + inset * 0.6, FIELD.w - inset * 2, FIELD.h - inset * 1.2);
      }
    }
    this.drawHazards(g, b);
    for (const e of b.ents) {
      if (e.kind === 'zone' && e.zone !== 'steam') this.drawZone(g, e);
      if (e.kind === 'telegraph' || (e.kind === 'area' && !e.done)) {
        const k = e.kind === 'telegraph' ? e.t / e.dur : e.t / e.delay;
        this.telegraph(g, e.x, e.y, e.r, k, e.side);
      }
      if (e.kind === 'line' && !e.done) {
        const x2 = e.x + Math.cos(e.angle) * e.len, y2 = e.y + Math.sin(e.angle) * e.len;
        g.strokeStyle = `rgba(255,60,60,${0.3 + 0.4 * (e.t / e.delay)})`;
        g.lineWidth = e.width;
        g.setLineDash([16, 10]);
        g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(x2, y2); g.stroke();
        g.setLineDash([]);
      }
      if (e.kind === 'line' && e.done && !e.cracked) {
        e.cracked = true;
        for (let d = 0; d < e.len; d += 60) this.fx.decal(e.x + Math.cos(e.angle) * d, e.y + Math.sin(e.angle) * d, 'crack', 40, 8);
      }
      if (e.kind === 'bolt' && !e.done) this.telegraph(g, e.x, e.y, 50, e.t / e.delay, -1, e.rock ? '#c9b469' : '#ffe14a');
    }
  }

  drawHazards(g, b) {
    for (const s of b.sides) {
      const m = s.active;
      const hz = s.hazards;
      if (!hz) continue;
      const cx = m && m.onField ? m.x : TRAINER_POS[s.index].x + (s.index === 0 ? 120 : -120);
      const cy = m && m.onField ? m.y : TRAINER_POS[s.index].y;
      if (hz.stealthrock) {
        for (let i = 0; i < 4; i++) {
          const a = this.time * 1.2 + (i * TAU) / 4;
          const x = cx + Math.cos(a) * 46, y = cy - 10 + Math.sin(a) * 16 - 10;
          g.fillStyle = '#a68c3a';
          g.beginPath(); g.moveTo(x - 7, y + 4); g.lineTo(x - 2, y - 8); g.lineTo(x + 7, y - 2); g.lineTo(x + 4, y + 6); g.closePath(); g.fill();
          g.strokeStyle = '#6e5a22'; g.lineWidth = 1.5; g.stroke();
        }
      }
      if (hz.toxicspikes) {
        g.fillStyle = '#9b3fbf';
        const bx = TRAINER_POS[s.index].x + (s.index === 0 ? 140 : -140);
        for (let i = 0; i < 4 * hz.toxicspikes; i++) {
          const x = bx + ((i * 37) % 90) - 45, y = TRAINER_POS[s.index].y - 60 + ((i * 53) % 120);
          g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x, y - 12); g.lineTo(x + 6, y); g.closePath(); g.fill();
        }
      }
    }
  }

  telegraph(g, x, y, r, k, side, color) {
    const rgb = color ? hexRgb(color) : side === 0 ? '255,90,80' : side === 1 ? '90,150,255' : '255,220,80';
    k = Math.min(1, Math.max(0, k));
    g.fillStyle = `rgba(${rgb},${0.1 + 0.2 * k})`;
    g.beginPath(); g.ellipse(x, y, r, r * 0.72, 0, 0, TAU); g.fill();
    g.strokeStyle = `rgba(${rgb},0.95)`;
    g.lineWidth = 3;
    g.beginPath(); g.ellipse(x, y, r, r * 0.72, 0, 0, TAU); g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.ellipse(x, y, r * (1 - k), r * 0.72 * (1 - k), 0, 0, TAU); g.stroke();
  }

  drawZone(g, z) {
    const a = Math.min(1, z.t / 0.6);
    if (z.zone === 'fire') {
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * TAU + this.time;
        const x = z.x + Math.cos(ang) * z.r * 0.55, y = z.y + Math.sin(ang) * z.r * 0.35;
        const h = 16 + Math.sin(this.time * 12 + i) * 6;
        g.globalAlpha = a * 0.9;
        g.fillStyle = '#ff6a1f'; g.beginPath(); g.ellipse(x, y - h / 2, 6, h / 2, 0, 0, TAU); g.fill();
        g.fillStyle = '#ffd44a'; g.beginPath(); g.ellipse(x, y - h / 3, 3, h / 3, 0, 0, TAU); g.fill();
      }
      g.restore();
      if (Math.random() < 0.3) this.fx.trail(z.x + (Math.random() - 0.5) * z.r, z.y - 10, 'Fire', 4, 3);
    } else if (z.zone === 'ice') {
      g.globalAlpha = 0.85 * a;
      g.fillStyle = '#e4f8ff';
      g.beginPath(); g.ellipse(z.x, z.y, z.r, z.r * 0.72, 0, 0, TAU); g.fill();
      g.strokeStyle = '#9ad7ef'; g.lineWidth = 2; g.stroke();
      g.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------ objetos ordenados por profundidade
  drawWorld(g, b, dt) {
    this.drawTrainers(g, b);
    for (const a of this.afterimages) {
      this.bank.draw(g, a.key, a.anim, a.at, a.facing, a.x, a.y, a.scale, { silhouette: true, alpha: 1 - a.t / a.life });
    }
    const items = [];
    for (const s of b.sides) {
      const m = s.active;
      if (m && (m.onField || m.action?.type === 'fainting')) items.push({ y: m.y, draw: () => this.drawMon(g, b, m, dt) });
    }
    for (const e of b.ents) {
      if (e.kind === 'proj') items.push({ y: e.y, draw: () => this.drawProj(g, e) });
      else if (e.kind === 'slashfx') items.push({ y: e.y + 1, draw: () => this.drawSlash(g, e) });
      else if (e.kind === 'shock') items.push({ y: e.y - 1, draw: () => this.drawShock(g, e) });
      else if (e.kind === 'area') items.push({ y: e.y + 2, draw: () => this.drawArea(g, e) });
    }
    for (const s of b.sides) { const m = s.active; if (m && m.onField) this.shadow(g, m); }
    items.sort((a, c) => a.y - c.y);
    for (const it of items) it.draw();
    for (const e of b.ents) {
      if (e.kind === 'beam') this.drawBeam(g, e);
      else if (e.kind === 'cone') this.drawCone(g, e);
      else if (e.kind === 'wave') this.drawWave(g, e);
      else if (e.kind === 'ring') this.drawRing(g, e);
      else if (e.kind === 'gazefx') this.drawGaze(g, e);
      else if (e.kind === 'aura') this.drawAura(g, e);
      else if (e.kind === 'zone' && e.zone === 'steam') this.drawSteam(g, e);
    }
    if (this.bolts) for (const bo of this.bolts) this.drawBolt(g, bo);
    const aim = this.ui?.controls?.aim;
    if (aim) for (let i = 0; i < 2; i++) {
      const a = aim[i];
      const m = b.sides[i].active;
      if (!a || !m || !m.onField) continue;
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.setLineDash([12, 8]);
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(m.x, m.y - 24); g.lineTo(m.x + a.dx * 360, m.y - 24 + a.dy * 360); g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(m.x + a.dx * 360, m.y - 24 + a.dy * 360, 8, 0, TAU); g.fill();
    }
  }

  shadow(g, m) {
    if (m.semiInv === 'dig' || m.semiInv === 'dive' || m.semiInv === 'phantom') return;
    const lift = (m.hover || 0) + (m.z || 0) + (m.semiInv === 'fly' ? 80 : 0);
    const k = Math.max(0.35, 1 - lift / 160);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(m.x, m.y, m.radius * 1.15 * k, m.radius * 0.45 * k, 0, 0, TAU); g.fill();
  }

  scaleOf(m) {
    const body = BODY[m.species] || BODY[m.baseSpecies];
    return body.bw ? body.scale * 1.25 : body.scale * 1.25;
  }

  drawMon(g, b, m, dt) {
    const scale = this.scaleOf(m);
    const a = m.action;
    let alpha = 1, y = m.y, extra = 1;
    const t = this.time;
    if (a?.type === 'fainting') { alpha = Math.max(0, 1 - a.t / a.dur); y += a.t * 22; }
    if (a?.type === 'switching') { extra = Math.max(0.05, 1 - a.t / a.dur); alpha = extra; }
    if (a?.type === 'entering') extra = Math.min(1, 0.2 + a.t / a.dur);
    if (m.iframes > 0) alpha *= 0.55 + 0.25 * Math.sin(t * 60);
    if (m.semiInv === 'dig') {
      g.fillStyle = '#7a5a2a';
      g.beginPath(); g.ellipse(m.x, m.y, 22, 10, 0, 0, TAU); g.fill();
      if (Math.random() < 0.5) this.fx.trail(m.x, m.y, 'Ground', 18, 4);
      return;
    }
    if (m.semiInv === 'dive') {
      g.strokeStyle = 'rgba(200,235,255,0.85)';
      g.lineWidth = 3;
      for (let i = 0; i < 2; i++) { const r = 12 + ((t * 34 + i * 14) % 28); g.beginPath(); g.ellipse(m.x, m.y, r, r * 0.5, 0, 0, TAU); g.stroke(); }
      return;
    }
    if (m.semiInv === 'phantom') {
      if (Math.random() < 0.4) this.fx.trail(m.x, m.y - 20, 'Ghost', 30, 4);
      return;
    }
    if (m.semiInv === 'fly') { y -= 150; alpha *= 0.9; }
    const hover = m.hover ? m.hover + Math.sin(t * 4 + m.uid) * 4 : 0;
    y -= hover + (m.z || 0);
    const flash = this.flashes.has(m.uid) ? Math.max(0, 1 - (t - this.flashes.get(m.uid)) / 0.16) : 0;
    const anim = a?.type === 'dash' || a?.type === 'grab' ? 'Attack' : m.anim.name;
    const at = a?.type === 'dash' ? Math.min(m.anim.t, 0.2) : m.anim.t;

    // rastro do dash (esquiva)
    if (a?.type === 'dodge' || (a?.type === 'dash' && a.speed >= 850)) {
      this.afterimages.push({ key: m.species, anim, at, facing: m.facing, x: m.x, y, scale, t: 0, life: 0.22 });
      if (Math.random() < 0.6) this.fx.add({ x: m.x + (Math.random() - 0.5) * 20, y: m.y, vx: -Math.cos(m.facing) * 80, vy: -10, size: 6, grow: 20, life: 0.35, color: 'rgba(230,230,215,0.45)', shape: 'circle' });
    }
    // aura de carga / postura
    if (a?.type === 'charge' || a?.type === 'stance' || (a?.type === 'windup' && MOVES[a.id] && MOVES[a.id].bp >= 100)) {
      const type = MOVES[a.id || (a.mode === 'bide' ? 'bide' : a.mode)]?.type || 'Normal';
      const col = TYPE_COLOR[type];
      g.save();
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(m.x, y - 28, 4, m.x, y - 28, m.radius * 2.4);
      gr.addColorStop(0, col);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.45 + 0.25 * Math.sin(t * 16);
      g.fillStyle = gr;
      g.beginPath(); g.arc(m.x, y - 28, m.radius * 2.4, 0, TAU); g.fill();
      g.restore();
      for (let i = 0; i < 2; i++) {
        const ang = Math.random() * TAU, r = 60 + Math.random() * 30;
        this.fx.add({ x: m.x + Math.cos(ang) * r, y: y - 28 + Math.sin(ang) * r * 0.7, vx: -Math.cos(ang) * r * 3, vy: -Math.sin(ang) * r * 2, size: 3, life: 0.3, color: palette(type)[1], shape: 'streak', blend: 'lighter' });
      }
    }
    if (m.isMega) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.18 + 0.08 * Math.sin(t * 5);
      g.fillStyle = `hsl(${(t * 120) % 360},90%,60%)`;
      g.beginPath(); g.ellipse(m.x, m.y, m.radius * 1.6, m.radius * 0.6, 0, 0, TAU); g.fill();
      g.restore();
      if (Math.random() < 0.12) this.fx.add({ x: m.x + (Math.random() - 0.5) * 50, y: m.y - Math.random() * 70, vy: -40, size: 2.5, life: 0.6, color: `hsl(${Math.random() * 360},100%,70%)`, shape: 'spark', blend: 'lighter' });
    }
    if (a?.type === 'dash' && a.trail) for (let i = 0; i < 2; i++) this.fx.trail(m.x, y - 18, a.trail, 26, 5);
    if (a?.type === 'rollout') this.fx.trail(m.x, y, 'Rock', 18, 4);

    g.save();
    g.globalAlpha = alpha;
    if (m.vol.substitute) this.drawSubstitute(g, m.x, y);
    else {
      g.translate(m.x, y);
      g.scale(extra, extra);
      this.bank.draw(g, m.species, anim, at, m.facing, 0, 0, scale, { flash, frozen: m.status === 'frz' });
    }
    g.restore();

    if (m.vol.protect || m.vol.wideguard) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = 'rgba(120,255,160,0.9)';
      g.fillStyle = 'rgba(120,255,160,0.14)';
      g.lineWidth = 3;
      g.beginPath(); g.arc(m.x, y - 28, m.radius * 2, 0, TAU); g.fill(); g.stroke();
      for (let i = 0; i < 6; i++) { const ang = (i / 6) * TAU + t; g.beginPath(); g.moveTo(m.x, y - 28); g.lineTo(m.x + Math.cos(ang) * m.radius * 2, y - 28 + Math.sin(ang) * m.radius * 2); g.stroke(); }
      g.restore();
    }
    if (m.vol.partiallytrapped) {
      const type = MOVES[m.vol.partiallytrapped.move]?.type || 'Normal';
      for (let i = 0; i < 3; i++) this.fx.trail(m.x + Math.cos(t * 8 + i * 2) * 34, y - 12 + Math.sin(t * 8 + i * 2) * 12, type, 5, 4);
    }
    if (m.vol.leechseed && Math.random() < 0.1) this.fx.trail(m.x, y - 20, 'Grass', 24, 4);
    if (m.vol.curse && Math.random() < 0.15) this.fx.trail(m.x, y - 40, 'Ghost', 24, 4);
    if (m.vol.magnetrise || m.vol.telekinesis) { g.strokeStyle = 'rgba(255,240,120,0.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(m.x, m.y, m.radius * 1.4, m.radius * 0.5, 0, 0, TAU); g.stroke(); }
    const top = y - this.bank.height(m.species, scale) - 8;
    if (m.status === 'slp') { g.fillStyle = '#fff'; g.font = '12px "Press Start 2P"'; g.fillText('z', m.x + 18 + Math.sin(t * 2) * 3, top - ((t * 10) % 14)); g.fillText('Z', m.x + 28, top - 12 - ((t * 10 + 7) % 14)); }
    if (m.status === 'brn' && Math.random() < 0.3) this.fx.trail(m.x, y - 14, 'Fire', 24, 4);
    if ((m.status === 'psn' || m.status === 'tox') && Math.random() < 0.15) this.fx.trail(m.x, y - 24, 'Poison', 24, 4);
    if (m.status === 'par' && Math.random() < 0.14) this.fx.trail(m.x, y - 24, 'Electric', 30, 4);
    if (m.vol.confusion) for (let i = 0; i < 3; i++) { g.fillStyle = '#ffe14a'; g.fillRect(m.x + Math.cos(t * 5 + i * 2.1) * 22 - 3, top + Math.sin(t * 5 + i * 2.1) * 5, 6, 6); }
    if (m.vol.attract && Math.random() < 0.05) this.fx.float(m.x, top, '♥', '#ff6fa8');
    if (m.vol.perish) { g.font = '12px "Press Start 2P"'; g.fillStyle = '#ff9cf0'; g.textAlign = 'center'; g.fillText(String(Math.ceil(m.vol.perish.t / 4)), m.x - 30, top); g.textAlign = 'left'; }
    if (a?.type === 'fainting') return;
    // barrinha de PS sobre a cabeça (desce devagar para dar para ver o dano)
    const w = 56;
    const frac = m.hp / m.maxhp;
    const shown = this.hpShown.get(m.uid) ?? frac;
    const nextShown = shown > frac ? Math.max(frac, shown - dt * 0.6) : frac;
    this.hpShown.set(m.uid, nextShown);
    g.fillStyle = 'rgba(0,0,0,0.65)';
    g.fillRect(m.x - w / 2 - 2, top - 3, w + 4, 9);
    g.fillStyle = '#ff5a4a';
    g.fillRect(m.x - w / 2, top - 1, w * nextShown, 5);
    g.fillStyle = frac > 0.5 ? '#4ade5a' : frac > 0.2 ? '#f5c518' : '#f04438';
    g.fillRect(m.x - w / 2, top - 1, w * frac, 5);
    g.fillStyle = SIDE_COLOR[m.side];
    g.fillRect(m.x - w / 2 - 2, top - 6, 10, 3);
    if (m.isMega) { g.fillStyle = '#ff6fd8'; g.font = '8px "Press Start 2P"'; g.fillText('M', m.x + w / 2 + 4, top + 5); }
  }

  drawSubstitute(g, x, y) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(x, y, 20, 7, 0, 0, TAU); g.fill();
    g.fillStyle = '#c8a46a';
    g.fillRect(x - 15, y - 38, 30, 36);
    g.fillRect(x - 18, y - 52, 10, 18);
    g.fillRect(x + 8, y - 52, 10, 18);
    g.fillStyle = '#2b1d10';
    g.fillRect(x - 8, y - 28, 4, 4);
    g.fillRect(x + 4, y - 28, 4, 4);
    g.fillStyle = '#8f6b3a';
    g.fillRect(x - 5, y - 18, 10, 2);
  }

  drawTrainers(g, b) {
    for (const s of b.sides) {
      const i = s.index;
      const pos = TRAINER_POS[i];
      const p = this.trainerPose[i];
      const pose = p.t > 0 ? p.pose : 'idle';
      const bob = pose === 'idle' ? Math.sin(this.time * 2 + i) * 1.5 : pose === 'mega' ? -6 : -3;
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath(); g.ellipse(pos.x, pos.y, 30, 9, 0, 0, TAU); g.fill();
      const r = this.bank.drawTrainer(g, this.trainers[i], pos.x, pos.y + bob, 1.6, i === 0);
      if (!r) continue;
      const ready = !s.megaUsed && s.active && b.canMega(i);
      const ks = { x: pos.x + (i === 0 ? 18 : -18), y: r.top + r.height * 0.45 };
      if (ready || pose === 'mega') {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const hue = (this.time * 300) % 360;
        const rr = pose === 'mega' ? 16 + Math.sin(this.time * 20) * 4 : 8 + Math.sin(this.time * 8) * 2;
        const gr = g.createRadialGradient(ks.x, ks.y, 1, ks.x, ks.y, rr * 2);
        gr.addColorStop(0, `hsla(${hue},100%,80%,1)`);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(ks.x, ks.y, rr * 2, 0, TAU); g.fill();
        g.restore();
      }
      if (pose === 'mega' && s.active) {
        const m = s.active;
        g.save();
        g.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) {
          g.strokeStyle = `hsla(${(this.time * 360 + k * 120) % 360},100%,70%,0.8)`;
          g.lineWidth = 6 - k * 1.5;
          g.beginPath(); g.moveTo(ks.x, ks.y);
          for (let j = 1; j <= 8; j++) g.lineTo(ks.x + ((m.x - ks.x) * j) / 8 + (Math.random() - 0.5) * 20, ks.y + ((m.y - 40 - ks.y) * j) / 8 + (Math.random() - 0.5) * 20);
          g.stroke();
        }
        g.restore();
      }
    }
  }

  // ------------------------------------------------------------ golpes
  drawProj(g, p) {
    if (p.delay > 0) return;
    const col = TYPE_COLOR[p.type] || '#fff';
    const pal = palette(p.type);
    const x = p.x, y = p.y - (p.z || 0) - 20;
    const s = p.size * 1.25;
    const t = this.time;
    if (p.lob) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(p.x, p.y, s, s * 0.4, 0, 0, TAU); g.fill(); }
    if (Math.random() < 0.8) this.fx.trail(x, y, p.type, s * 0.8, Math.max(2.5, s * 0.35));
    // brilho
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(x, y, 0, x, y, s * 2.6);
    gr.addColorStop(0, hexA(col, 0.55));
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, s * 2.6, 0, TAU); g.fill();
    g.restore();
    g.save();
    g.translate(x, y);
    g.rotate(p.angle || 0);
    switch (p.sprite) {
      case 'flame':
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) { g.fillStyle = pal[3 - i]; g.beginPath(); g.ellipse(-i * s * 0.35, (Math.random() - 0.5) * 3, s * (1.25 - i * 0.2), s * (1 - i * 0.18), 0, 0, TAU); g.fill(); }
        break;
      case 'leaf': case 'petal':
        g.rotate(t * 14);
        g.fillStyle = p.sprite === 'petal' ? '#ff9ccb' : '#5fd34a';
        g.beginPath(); g.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); g.fill();
        g.strokeStyle = '#2e7d32'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke();
        break;
      case 'crescent':
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = '#ffffff'; g.lineWidth = 5;
        g.beginPath(); g.arc(-s * 0.4, 0, s * 1.2, -1.2, 1.2); g.stroke();
        g.strokeStyle = col; g.lineWidth = 3;
        g.beginPath(); g.arc(-s * 0.65, 0, s * 1.2, -1.2, 1.2); g.stroke();
        break;
      case 'rock': case 'scale': case 'item': case 'berry':
        g.rotate(t * 7);
        g.fillStyle = p.sprite === 'scale' ? '#9d7bff' : p.sprite === 'berry' ? '#ffcf3a' : p.sprite === 'item' ? '#e9e9f5' : '#a68c3a';
        g.beginPath(); g.moveTo(-s, -s * 0.5); g.lineTo(-s * 0.2, -s); g.lineTo(s, -s * 0.4); g.lineTo(s * 0.7, s * 0.8); g.lineTo(-s * 0.6, s); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(-s * 0.4, -s * 0.6, s * 0.5, s * 0.3);
        break;
      case 'shard': case 'icicle':
        g.fillStyle = '#e8fbff'; g.beginPath(); g.moveTo(s * 1.8, 0); g.lineTo(-s, -s * 0.6); g.lineTo(-s * 0.6, 0); g.lineTo(-s, s * 0.6); g.closePath(); g.fill();
        g.strokeStyle = '#5cc6e0'; g.lineWidth = 1.5; g.stroke();
        break;
      case 'star':
        g.rotate(t * 10);
        g.fillStyle = '#ffe14a';
        g.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.45 : s; g.lineTo(Math.cos((i * Math.PI) / 5) * r, Math.sin((i * Math.PI) / 5) * r); }
        g.closePath(); g.fill();
        break;
      case 'bubble':
        g.strokeStyle = '#d8f2ff'; g.lineWidth = 2.5; g.fillStyle = 'rgba(120,190,255,0.35)';
        g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = '#fff'; g.fillRect(-s * 0.45, -s * 0.5, 3, 3);
        break;
      case 'tornado': case 'vortex':
        g.rotate(-(p.angle || 0));
        for (let i = 0; i < 6; i++) {
          g.strokeStyle = p.sprite === 'vortex' ? `rgba(90,170,255,${0.9 - i * 0.12})` : `rgba(230,230,255,${0.9 - i * 0.12})`;
          g.lineWidth = 4;
          g.beginPath(); g.ellipse(0, -i * s * 0.35, s * (0.45 + i * 0.22), s * 0.22, t * 9 + i, 0, TAU * 0.8); g.stroke();
        }
        break;
      case 'seed':
        g.fillStyle = '#9b6b2f'; g.beginPath(); g.ellipse(0, 0, s, s * 0.7, 0, 0, TAU); g.fill();
        g.fillStyle = '#5fd34a'; g.fillRect(-2, -s, 4, s * 0.6);
        break;
      case 'glob': case 'mud': case 'sand': case 'smoke': case 'swarm':
        g.fillStyle = p.sprite === 'glob' ? '#9b3fbf' : p.sprite === 'mud' ? '#7a5a2a' : p.sprite === 'sand' ? '#d9b366' : p.sprite === 'swarm' ? '#a6b91a' : 'rgba(110,90,120,0.8)';
        for (let i = 0; i < (p.sprite === 'glob' || p.sprite === 'mud' ? 1 : 6); i++) { g.beginPath(); g.arc(i ? Math.cos(i + t * 5) * s * 0.6 : 0, i ? Math.sin(i * 2 + t * 4) * s * 0.6 : 0, i ? s * 0.5 : s, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(-s * 0.3, -s * 0.3, s * 0.3, 0, TAU); g.fill();
        break;
      case 'aura': case 'pulse': case 'crystal': case 'spark':
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = pal[2]; g.beginPath(); g.arc(0, 0, s * 1.2, 0, TAU); g.fill();
        g.fillStyle = pal[1]; g.beginPath(); g.arc(0, 0, s * 0.85, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, s * 0.45, 0, TAU); g.fill();
        if (p.sprite === 'pulse') { g.strokeStyle = pal[0]; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, s * (1.5 + Math.sin(t * 20) * 0.35), 0, TAU); g.stroke(); }
        if (p.sprite === 'spark') { g.strokeStyle = '#fff7a0'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { const a = Math.random() * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * s * 2, Math.sin(a) * s * 2); g.stroke(); } }
        break;
      case 'wisp':
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = p.type === 'Ghost' ? '#c9a0ff' : '#5b8cff'; g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill();
        g.fillStyle = '#e8eeff'; g.beginPath(); g.arc(0, 0, s * 0.5, 0, TAU); g.fill();
        break;
      case 'powder':
        g.fillStyle = p.id === 'sleeppowder' ? 'rgba(120,220,140,0.65)' : 'rgba(190,110,230,0.65)';
        for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(Math.cos(i + t * 4) * s * 0.7, Math.sin(i * 2 + t * 3) * s * 0.7, s * 0.4, 0, TAU); g.fill(); }
        break;
      case 'heart':
        g.fillStyle = '#ff6fa8'; g.font = `${Math.round(s * 2)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.rotate(-(p.angle || 0)); g.fillText('♥', 0, 0);
        break;
      case 'web':
        g.strokeStyle = '#f0f0f0'; g.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-s, (i - 1.5) * 5); g.lineTo(s, (i - 1.5) * 5); g.stroke(); }
        break;
      case 'drain':
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = '#7df07d'; g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill();
        g.fillStyle = '#e8ffe8'; g.beginPath(); g.arc(0, 0, s * 0.5, 0, TAU); g.fill();
        break;
      case 'shadow': {
        const sg = g.createRadialGradient(0, 0, s * 0.1, 0, 0, s * 1.3);
        sg.addColorStop(0, '#12061f');
        sg.addColorStop(0.55, '#3b1a63');
        sg.addColorStop(0.85, '#8a5ad6');
        sg.addColorStop(1, 'rgba(160,110,240,0)');
        g.fillStyle = sg;
        g.beginPath(); g.arc(0, 0, s * 1.3, 0, TAU); g.fill();
        g.strokeStyle = '#c9a8ff';
        g.lineWidth = 2;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, s * (0.55 + i * 0.22), t * 9 + i * 2.1, t * 9 + i * 2.1 + 1.6); g.stroke(); }
        g.fillStyle = '#ff5ad0';
        g.beginPath(); g.arc(-s * 0.25, -s * 0.1, s * 0.12, 0, TAU); g.arc(s * 0.25, -s * 0.1, s * 0.12, 0, TAU); g.fill();
        if (Math.random() < 0.5) this.fx.add({ x: p.x + (Math.random() - 0.5) * s * 2, y: y + (Math.random() - 0.5) * s * 2, vx: 0, vy: -30, size: s * 0.5, grow: s * 0.6, life: 0.4, color: 'rgba(60,25,100,0.45)', shape: 'circle' });
        break;
      }
      case 'fist':
        g.fillStyle = '#5a4636'; g.fillRect(-s, -s * 0.7, s * 2, s * 1.4);
        g.fillStyle = '#2a201a'; g.fillRect(s * 0.4, -s * 0.7, s * 0.6, s * 1.4);
        break;
      default:
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = pal[2]; g.beginPath(); g.arc(0, 0, s * 1.1, 0, TAU); g.fill();
        g.fillStyle = pal[1]; g.beginPath(); g.arc(0, 0, s * 0.8, 0, TAU); g.fill();
        g.fillStyle = pal[0]; g.beginPath(); g.arc(s * 0.2, -s * 0.2, s * 0.45, 0, TAU); g.fill();
    }
    g.restore();
  }

  beamStyle(e) {
    if (['flamethrower', 'overheat'].includes(e.id)) return 'fire';
    if (['hydropump', 'watergun', 'scald', 'hydrocannon'].includes(e.id)) return 'water';
    if (e.id === 'thunderbolt') return 'lightning';
    if (['solarbeam', 'meteorbeam'].includes(e.id)) return 'solar';
    if (e.id === 'bubblebeam') return 'bubble';
    if (e.id === 'icebeam') return 'ice';
    return 'energy';
  }

  drawBeam(g, e) {
    if (e.ox === undefined) return;
    const pal = palette(e.type);
    const len = e.len;
    const w = e.width;
    const t = this.time;
    const fade = e.dead ? 0.2 : Math.max(0.25, Math.min(1, (e.dur - e.t) / 0.18, e.t / 0.06 + 0.3));
    const style = this.beamStyle(e);
    g.save();
    g.translate(e.ox, e.oy - 10);
    g.rotate(e.angle);
    g.globalAlpha = fade;
    g.globalCompositeOperation = 'lighter';
    // brilho largo
    const glow = g.createLinearGradient(0, -w * 1.6, 0, w * 1.6);
    glow.addColorStop(0, 'rgba(0,0,0,0)');
    glow.addColorStop(0.5, hexA(style === 'solar' ? '#f6ff9a' : TYPE_COLOR[e.type], 0.55));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.fillRect(0, -w * 1.6, len, w * 3.2);
    if (style === 'fire') {
      for (let d = 0; d < len; d += 10) {
        const k = d / Math.max(1, len);
        const r = w * (0.35 + k * 0.7) * (0.8 + Math.random() * 0.4);
        const yy = Math.sin(d * 0.08 - t * 30) * w * 0.15;
        g.fillStyle = pal[3]; g.beginPath(); g.arc(d, yy, r, 0, TAU); g.fill();
        g.fillStyle = pal[1]; g.beginPath(); g.arc(d, yy, r * 0.6, 0, TAU); g.fill();
      }
      g.fillStyle = pal[0]; g.fillRect(0, -w * 0.12, len * 0.7, w * 0.24);
    } else if (style === 'water') {
      g.fillStyle = pal[3]; g.fillRect(0, -w * 0.55, len, w * 1.1);
      g.fillStyle = pal[2]; g.fillRect(0, -w * 0.38, len, w * 0.76);
      g.fillStyle = pal[0];
      for (let d = (t * 900) % 60; d < len; d += 60) g.fillRect(d, -w * 0.3 + Math.sin(d) * w * 0.2, 30, 3);
      g.fillStyle = '#ffffff'; g.fillRect(0, -w * 0.08, len, w * 0.16);
    } else if (style === 'lightning') {
      if (!e.bolt || t - e.boltAt > 0.05) { e.bolt = zigzag(len, w * 1.2); e.boltAt = t; }
      for (const [lw, col] of [[w * 0.9, TYPE_COLOR.Electric], [w * 0.4, '#fff7a0'], [2.5, '#ffffff']]) {
        g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(0, 0); for (const [x, y] of e.bolt) g.lineTo(x, y); g.stroke();
      }
    } else if (style === 'bubble') {
      g.globalCompositeOperation = 'source-over';
      for (let d = 0; d < len; d += 16) {
        g.strokeStyle = '#d8f2ff'; g.lineWidth = 2.5;
        g.beginPath(); g.arc(d + ((t * 240) % 16), Math.sin(d * 0.3 + t * 10) * w * 0.45, 6 + (d % 4), 0, TAU); g.stroke();
      }
    } else {
      const outer = style === 'solar' ? '#f6ff9a' : e.id === 'hyperbeam' ? '#ffb347' : e.id === 'signalbeam' ? `hsl(${(t * 400) % 360},90%,65%)` : TYPE_COLOR[e.type];
      if (style !== 'solar') g.globalCompositeOperation = 'source-over';
      g.fillStyle = hexA(outer, 0.92); g.fillRect(0, -w / 2, len, w);
      g.fillStyle = pal[1]; g.fillRect(0, -w * 0.3, len, w * 0.6);
      g.fillStyle = pal[0]; g.fillRect(0, -w * 0.14, len, w * 0.28);
      if (e.type === 'Dragon' || e.type === 'Psychic' || e.type === 'Ghost') {
        g.lineWidth = Math.max(3, w * 0.16);
        for (const [ph, col] of [[0, pal[3]], [Math.PI, pal[2]]]) {
          g.strokeStyle = col;
          g.beginPath();
          for (let d = 0; d <= len; d += 8) g.lineTo(d, Math.sin(d * 0.05 - t * 18 + ph) * w * 0.55);
          g.stroke();
        }
      }
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,255,255,0.55)';
      for (let d = (t * 800) % 46; d < len; d += 46) g.fillRect(d, -w / 2, 8, w);
      if (style === 'solar') for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(255,255,220,0.25)'; g.fillRect(0, -w * (1 + i * 0.4) + Math.sin(t * 12 + i) * 4, len, 3); }
      if (style === 'ice') for (let i = 0; i < 2; i++) { const d = Math.random() * len; g.fillStyle = '#ffffff'; g.save(); g.translate(d, (Math.random() - 0.5) * w); g.rotate(Math.random() * 3); g.fillRect(-6, -1.5, 12, 3); g.fillRect(-1.5, -6, 3, 12); g.restore(); }
    }
    // ponta e boca do raio
    g.fillStyle = pal[0];
    g.beginPath(); g.arc(len, 0, w * 0.75, 0, TAU); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(0, 0, w * 0.5, 0, TAU); g.fill();
    g.restore();
    const ex = e.ox + Math.cos(e.angle) * len, ey = e.oy - 10 + Math.sin(e.angle) * len;
    for (let i = 0; i < 2; i++) this.fx.trail(ex, ey, e.type, w, 5);
    if (Math.random() < 0.08 && DECAL_FOR[e.type]) this.fx.decal(ex, ey + 10, DECAL_FOR[e.type], 24, 6);
  }

  drawCone(g, e) {
    const pal = palette(e.type);
    const grow = Math.min(1, e.t / 0.2);
    const r = e.range * grow;
    g.save();
    g.translate(e.x, e.y - 22);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.5 * Math.min(1, (e.dur - e.t) / 0.15 + 0.2);
    const grad = g.createRadialGradient(0, 0, 10, 0, 0, r);
    grad.addColorStop(0, pal[0]);
    grad.addColorStop(0.5, hexA(pal[1], 0.7));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, e.angle - e.half, e.angle + e.half); g.closePath(); g.fill();
    g.restore();
    const n = e.id === 'blizzard' ? 10 : 5;
    for (let i = 0; i < n; i++) {
      const a = e.angle + (Math.random() - 0.5) * e.half * 2;
      const d = Math.random() * r;
      const sx = e.x + Math.cos(a) * d, sy = e.y - 22 + Math.sin(a) * d;
      if (e.type === 'Ice') this.fx.add({ x: sx, y: sy, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, drag: 2, size: 3 + Math.random() * 3, life: 0.4, color: '#ffffff', shape: 'flake', blend: 'lighter', vr: 10 });
      else this.fx.trail(sx, sy, e.sprite === 'leaf' ? 'Grass' : e.sprite === 'smoke' ? 'Poison' : e.type, 8, 4);
    }
    if (e.type === 'Ice' && Math.random() < 0.15) this.fx.decal(e.x + Math.cos(e.angle) * r * 0.7, e.y + Math.sin(e.angle) * r * 0.7, 'frost', 30, 6);
  }

  drawWave(g, e) {
    const pal = palette(e.type);
    const k = Math.min(1, (e.range - e.traveled) / 120);
    g.save();
    g.translate(e.x, e.y);
    g.rotate(e.angle);
    g.globalAlpha = Math.max(0.15, k);
    const half = e.width / 2;
    if (e.id === 'darkpulse' || e.id === 'ominouswind' || e.id === 'psywave') {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        g.strokeStyle = hexA(pal[i % 2 ? 1 : 2], 0.9);
        g.lineWidth = 8;
        g.beginPath(); g.arc(-i * 22 - half * 0.6, 0, half * 0.75 + i * 8, -0.85, 0.85); g.stroke();
      }
    } else if (e.id === 'heatwave') {
      const grd = g.createLinearGradient(-e.thickness * 3, 0, e.thickness * 0.6, 0);
      grd.addColorStop(0, 'rgba(255,90,20,0)');
      grd.addColorStop(0.75, 'rgba(255,90,20,0.32)');
      grd.addColorStop(1, 'rgba(232,54,28,0.55)');
      g.fillStyle = grd;
      g.fillRect(-e.thickness * 3, -half, e.thickness * 3.6, e.width);
      // línguas de fogo na frente
      for (let yy = -half; yy <= half; yy += 16) {
        const h = 16 + 12 * Math.sin(yy * 0.13 + this.time * 22) + Math.random() * 6;
        const x0 = e.thickness * 0.5;
        g.fillStyle = pal[3];
        g.beginPath(); g.moveTo(x0 - 6, yy - 9); g.quadraticCurveTo(x0 + h, yy, x0 - 6, yy + 9); g.fill();
        g.fillStyle = pal[1];
        g.beginPath(); g.moveTo(x0 - 6, yy - 5); g.quadraticCurveTo(x0 + h * 0.6, yy, x0 - 6, yy + 5); g.fill();
      }
      // ar tremendo atrás
      g.strokeStyle = 'rgba(255,220,170,0.45)';
      g.lineWidth = 2.5;
      for (let yy = -half + 10; yy < half; yy += 30) {
        g.beginPath(); g.moveTo(-e.thickness * 2.4, yy);
        for (let xx = -e.thickness * 2.4; xx < 0; xx += 12) g.lineTo(xx, yy + Math.sin(xx * 0.12 + this.time * 16 + yy) * 5);
        g.stroke();
      }
      if (Math.random() < 0.3) this.fx.decal(e.x - e.dx * 30 + (Math.random() - 0.5) * e.width * -e.dy, e.y - e.dy * 30 + (Math.random() - 0.5) * e.width * e.dx, 'scorch', 18, 4);
    } else {
      // Surf / Muddy Water: paredão de água com espuma na crista
      const deep = e.id === 'muddywater' ? ['rgba(90,65,30,0)', 'rgba(110,80,40,0.75)', '#8a6a3c', '#d9c49a'] : ['rgba(40,110,210,0)', 'rgba(50,130,230,0.75)', '#3a8fe8', '#e9f7ff'];
      const body = g.createLinearGradient(-e.thickness * 4, 0, e.thickness * 0.6, 0);
      body.addColorStop(0, deep[0]);
      body.addColorStop(0.7, deep[1]);
      body.addColorStop(1, deep[2]);
      g.fillStyle = body;
      g.beginPath();
      g.moveTo(-e.thickness * 4, -half);
      for (let yy = -half; yy <= half; yy += 18) g.lineTo(e.thickness * 0.6 + Math.sin(yy / 30 + this.time * 10) * 10, yy);
      g.lineTo(-e.thickness * 4, half);
      g.closePath();
      g.fill();
      // crista
      g.fillStyle = deep[3];
      for (let yy = -half; yy <= half; yy += 14) {
        const xx = e.thickness * 0.55 + Math.sin(yy / 30 + this.time * 10) * 10;
        g.beginPath(); g.arc(xx, yy, 7 + Math.sin(yy + this.time * 20) * 3, 0, TAU); g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,0.35)';
      for (let yy = -half; yy <= half; yy += 40) g.fillRect(-e.thickness * 2 + Math.sin(yy + this.time * 6) * 20, yy, 40, 4);
    }
    g.restore();
    // espuma e marcas no chão
    if (e.big || e.id === 'surf') {
      for (let i = 0; i < 4; i++) {
        const lat = (Math.random() - 0.5) * e.width;
        const px = e.x + e.dx * e.thickness * 0.5 - e.dy * lat, py = e.y + e.dy * e.thickness * 0.5 + e.dx * lat;
        this.fx.add({ x: px, y: py - 10, vx: e.dx * 200 + (Math.random() - 0.5) * 60, vy: -80 - Math.random() * 80, g: 300, size: 3 + Math.random() * 3, life: 0.5, color: e.id === 'muddywater' ? '#d9c49a' : '#eaf8ff', shape: 'circle' });
      }
      if (Math.random() < 0.25 && e.type === 'Water') this.fx.decal(e.x - e.dx * 60 + (Math.random() - 0.5) * e.width * -e.dy, e.y - e.dy * 60 + (Math.random() - 0.5) * e.width * e.dx, 'puddle', 30, 5);
    }
  }

  drawRing(g, e) {
    const pal = palette(e.type);
    const k = 1 - e.r / e.maxR;
    g.save();
    g.globalAlpha = Math.max(0.1, k);
    if (e.sound) {
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = e.type === 'Normal' ? '#ffffff' : pal[1];
      g.lineWidth = 4;
      for (let i = 0; i < 3; i++) { const r = e.r - i * 22; if (r > 0) { g.beginPath(); g.ellipse(e.x, e.y - 24, r, r * 0.72, 0, 0, TAU); g.stroke(); } }
    } else if (e.sprite === 'petal') {
      for (let i = 0; i < 26; i++) { const a = (i / 26) * TAU + this.time * 3; g.fillStyle = i % 2 ? '#ff9ccb' : '#ffd1e6'; g.save(); g.translate(e.x + Math.cos(a) * e.r, e.y - 14 + Math.sin(a) * e.r * 0.7); g.rotate(a); g.fillRect(-5, -2.5, 10, 5); g.restore(); }
    } else if (e.sprite === 'sludge') {
      g.strokeStyle = pal[2]; g.lineWidth = 22;
      g.beginPath(); g.ellipse(e.x, e.y, e.r, e.r * 0.72, 0, 0, TAU); g.stroke();
      g.strokeStyle = pal[0]; g.lineWidth = 6;
      g.beginPath(); g.ellipse(e.x, e.y - 6, e.r, e.r * 0.72, 0, 0, TAU); g.stroke();
      if (Math.random() < 0.5) { const a = Math.random() * TAU; this.fx.decal(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r * 0.72, 'slime', 22, 5); }
    } else if (e.ground) {
      g.strokeStyle = 'rgba(120,90,45,0.85)'; g.lineWidth = 14;
      g.beginPath(); g.ellipse(e.x, e.y, e.r, e.r * 0.72, 0, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(230,200,140,0.6)'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(e.x, e.y - 4, e.r, e.r * 0.72, 0, 0, TAU); g.stroke();
      for (let i = 0; i < 4; i++) { const a = Math.random() * TAU; this.fx.add({ x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r * 0.72, vy: -60 - Math.random() * 80, vx: (Math.random() - 0.5) * 40, g: 200, size: 4 + Math.random() * 4, grow: 10, life: 0.6, color: 'rgba(170,140,90,0.6)', shape: 'circle' }); }
      if (Math.random() < 0.35) { const a = Math.random() * TAU; this.fx.decal(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r * 0.72, 'crack', 34, 7); }
    } else {
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = pal[1]; g.lineWidth = 12;
      g.beginPath(); g.ellipse(e.x, e.y - 10, e.r, e.r * 0.72, 0, 0, TAU); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(e.x, e.y - 10, e.r, e.r * 0.72, 0, 0, TAU); g.stroke();
    }
    g.restore();
  }

  drawArea(g, e) {
    const pal = palette(e.type);
    if (!e.done) {
      // pedras e gelo caindo: aparecem lá em cima e descem até o alvo
      if (['rock', 'icicle', 'stoneedge'].includes(e.sprite) || e.id === 'rockslide') {
        const k = Math.min(1, e.t / e.delay);
        if (e.sprite !== 'stoneedge') {
          const yy = e.y - 260 * (1 - k * k);
          g.fillStyle = e.sprite === 'icicle' ? '#e8fbff' : '#a68c3a';
          g.beginPath(); g.moveTo(e.x - 14, yy - 10); g.lineTo(e.x, yy - 34); g.lineTo(e.x + 16, yy - 6); g.lineTo(e.x + 4, yy + 10); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.stroke();
        }
      }
      return;
    }
    const k = Math.min(1, (e.t - e.delay) / 0.4);
    g.save();
    g.globalAlpha = 1 - k * k;
    const h = 120 * (1 - k * 0.4);
    switch (e.sprite) {
      case 'stoneedge':
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + 0.3, rr = e.r * 0.55;
          const x = e.x + Math.cos(a) * rr, y = e.y + Math.sin(a) * rr * 0.6;
          const hh = (50 + (i % 3) * 18) * Math.min(1, (e.t - e.delay) / 0.08);
          g.fillStyle = '#b39b5a'; g.beginPath(); g.moveTo(x - 12, y); g.lineTo(x - 3, y - hh); g.lineTo(x + 12, y); g.closePath(); g.fill();
          g.fillStyle = '#e2d3a2'; g.beginPath(); g.moveTo(x - 3, y - hh); g.lineTo(x + 2, y - hh * 0.4); g.lineTo(x + 12, y); g.closePath(); g.fill();
        }
        break;
      case 'rock': case 'icicle':
        g.fillStyle = e.sprite === 'rock' ? '#a68c3a' : '#e8fbff';
        g.beginPath(); g.moveTo(e.x - 18, e.y); g.lineTo(e.x, e.y - 40); g.lineTo(e.x + 18, e.y); g.closePath(); g.fill();
        break;
      case 'pillar': case 'geyser': case 'eruption': {
        g.globalCompositeOperation = 'lighter';
        const grd = g.createLinearGradient(0, e.y - h * 1.8, 0, e.y);
        grd.addColorStop(0, 'rgba(0,0,0,0)');
        grd.addColorStop(0.3, hexA(pal[1], 0.9));
        grd.addColorStop(1, pal[0]);
        g.fillStyle = grd;
        g.fillRect(e.x - e.r * 0.5, e.y - h * 1.8, e.r, h * 1.8);
        g.fillStyle = '#ffffff';
        g.fillRect(e.x - e.r * 0.15, e.y - h * 1.6, e.r * 0.3, h * 1.6);
        break;
      }
      case 'explosion': case 'psy': default: {
        g.globalCompositeOperation = 'lighter';
        const rr = e.r * (0.6 + k * 0.7);
        const grd = g.createRadialGradient(e.x, e.y - 20, 4, e.x, e.y - 20, rr);
        grd.addColorStop(0, '#ffffff');
        grd.addColorStop(0.35, pal[1]);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.beginPath(); g.arc(e.x, e.y - 20, rr, 0, TAU); g.fill();
      }
      case 'snare':
        if (e.sprite === 'snare') {
          g.strokeStyle = '#3d9a2c'; g.lineWidth = 5;
          for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(e.x - 24 + i * 12, e.y); g.quadraticCurveTo(e.x - 34 + i * 18, e.y - 50, e.x - 10 + i * 8, e.y - 64); g.stroke(); }
        }
    }
    g.restore();
  }

  drawSlash(g, e) {
    const k = e.t / e.dur;
    const half = (e.arc * Math.PI) / 360;
    g.save();
    g.translate(e.x, e.y - 24);
    g.globalAlpha = 1 - k;
    if (e.sprite === 'vine') {
      g.strokeStyle = '#3d9a2c'; g.lineWidth = 7;
      g.beginPath(); g.moveTo(0, 0);
      g.quadraticCurveTo(Math.cos(e.angle + 0.4) * e.reach * 0.5, Math.sin(e.angle + 0.4) * e.reach * 0.5, Math.cos(e.angle) * e.reach, Math.sin(e.angle) * e.reach);
      g.stroke();
    } else {
      g.globalCompositeOperation = 'lighter';
      const start = e.angle - half + half * 2 * Math.max(0, k - 0.3);
      const end = e.angle - half + half * 2 * Math.min(1, k * 2);
      g.strokeStyle = '#ffffff'; g.lineWidth = 10;
      g.beginPath(); g.arc(0, 0, e.reach * 0.85, start, end); g.stroke();
      g.strokeStyle = TYPE_COLOR[e.type]; g.lineWidth = 5;
      g.beginPath(); g.arc(0, 0, e.reach * 0.85 - 7, start, end); g.stroke();
    }
    g.restore();
  }

  drawShock(g, e) {
    const k = e.t / e.dur;
    const pal = palette(e.type);
    g.save();
    g.globalAlpha = 1 - k;
    if (e.explosion) {
      g.globalCompositeOperation = 'lighter';
      const rr = e.r * (0.35 + k * 0.8);
      const grd = g.createRadialGradient(e.x, e.y - 20, 4, e.x, e.y - 20, rr);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.3, pal[1]);
      grd.addColorStop(0.7, pal[3]);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.beginPath(); g.ellipse(e.x, e.y - 20, rr, rr * 0.8, 0, 0, TAU); g.fill();
      // anel de choque correndo pelo chão
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = `rgba(255,248,225,${0.8 * (1 - k)})`;
      g.lineWidth = 10 * (1 - k) + 2;
      g.beginPath(); g.ellipse(e.x, e.y, e.r * (0.2 + k * 1.1), e.r * 0.7 * (0.2 + k * 1.1), 0, 0, TAU); g.stroke();
    } else {
      g.strokeStyle = pal[1]; g.lineWidth = 8;
      g.beginPath(); g.ellipse(e.x, e.y, e.r * (0.3 + k * 0.7), e.r * 0.72 * (0.3 + k * 0.7), 0, 0, TAU); g.stroke();
    }
    g.restore();
  }

  drawGaze(g, e) {
    const o = e.owner;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.28 * (1 - e.t / e.dur);
    g.fillStyle = TYPE_COLOR[e.type];
    g.beginPath(); g.moveTo(o.x, o.y - 30); g.arc(o.x, o.y - 30, e.range, e.angle - e.half, e.angle + e.half); g.closePath(); g.fill();
    g.restore();
  }

  drawAura(g, e) {
    const m = e.mon;
    const k = e.t / e.dur;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = TYPE_COLOR[e.type];
    g.globalAlpha = 1 - k;
    g.lineWidth = 4;
    g.beginPath(); g.ellipse(m.x, m.y - 4 - k * 50, m.radius * (1.2 + k), m.radius * 0.45 * (1.2 + k), 0, 0, TAU); g.stroke();
    g.restore();
  }

  drawSteam(g, z) {
    const a = Math.min(1, z.t / 0.8) * 0.55;
    g.fillStyle = `rgba(240,245,250,${a})`;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * TAU + this.time * 0.6;
      g.beginPath(); g.arc(z.x + Math.cos(ang) * z.r * 0.5, z.y - 24 + Math.sin(ang) * z.r * 0.3, z.r * 0.5, 0, TAU); g.fill();
    }
  }

  drawBolt(g, bo) {
    const v = this.view();
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 1 - bo.t / 0.35;
    for (const [lw, col] of [[14, 'rgba(255,230,90,0.6)'], [6, '#fff7b0'], [2, '#ffffff']]) {
      g.strokeStyle = col; g.lineWidth = lw;
      g.beginPath();
      let x = bo.x, y = v.y0 - 20;
      g.moveTo(x, y);
      let s = Math.floor(bo.x * 7 + bo.y);
      while (y < bo.y - 20) { y += 34; s = (s * 9301 + 49297) % 233280; x += (s / 233280 - 0.5) * 50; g.lineTo(x, Math.min(y, bo.y - 20)); }
      g.stroke();
    }
    g.restore();
  }

  // ------------------------------------------------------------ clima
  drawWeatherWorld(g, b, dt) {
    const w = b.field.weather?.id;
    const v = this.view();
    const parts = this.weatherParts;
    const spawn = (n, make) => { for (let i = 0; i < n; i++) if (parts.length < 500) parts.push(make()); };
    const rx = () => v.x0 + Math.random() * (v.x1 - v.x0 + 200);
    if (w === 'raindance' || w === 'primordialsea' || b.field.storm > 0) spawn(w === 'primordialsea' ? 14 : 7, () => ({ k: 'rain', x: rx(), y: v.y0 - 20, vx: -200, vy: 1300, life: 1 }));
    if (w === 'sandstorm') spawn(8, () => ({ k: 'sand', x: v.x0 - 10, y: v.y0 + Math.random() * (v.y1 - v.y0), vx: 700 + Math.random() * 300, vy: 60, life: 2.2 }));
    if (w === 'hail') spawn(4, () => ({ k: 'hail', x: rx(), y: v.y0 - 10, vx: -80, vy: 700, life: 1.4 }));
    if (w === 'snow') spawn(4, () => ({ k: 'snow', x: rx(), y: v.y0 - 10, vx: -40 + Math.random() * 80, vy: 120 + Math.random() * 60, life: 7 }));
    for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    this.weatherParts = parts.filter(p => p.life > 0 && p.y < v.y1 + 40);
    for (const p of this.weatherParts) {
      if (p.k === 'rain') { g.strokeStyle = 'rgba(190,215,255,0.65)'; g.lineWidth = 2; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - 5, p.y + 22); g.stroke(); }
      else if (p.k === 'sand') { g.fillStyle = 'rgba(170,130,70,0.75)'; g.fillRect(p.x, p.y, 4, 2); }
      else if (p.k === 'hail') { g.fillStyle = '#f2fbff'; g.fillRect(p.x, p.y, 5, 5); }
      else { g.fillStyle = '#ffffff'; g.fillRect(p.x + Math.sin(p.y / 20) * 6, p.y, 4, 4); }
    }
    if ((w === 'raindance' || w === 'primordialsea') && Math.random() < 0.3) this.fx.add({ x: rx(), y: v.y0 + Math.random() * (v.y1 - v.y0), size: 2, grow: 30, life: 0.3, color: 'rgba(200,225,255,0.6)', shape: 'ring' });
  }

  drawWeatherScreen(g, b) {
    const w = b.field.weather?.id;
    if (w === 'sunnyday' || w === 'desolateland') {
      const ext = w === 'desolateland';
      const grad = g.createRadialGradient(this.W * 0.1, 0, 10, this.W * 0.1, 0, this.W);
      grad.addColorStop(0, ext ? 'rgba(255,170,60,0.45)' : 'rgba(255,240,150,0.32)');
      grad.addColorStop(1, 'rgba(255,200,80,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, this.W, this.H);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = ext ? 'rgba(255,120,30,0.07)' : 'rgba(255,230,120,0.06)';
      for (let i = 0; i < 5; i++) { g.save(); g.translate(this.W * 0.1, 0); g.rotate(0.3 + i * 0.22 + Math.sin(this.time * 0.5 + i) * 0.02); g.fillRect(0, -10, this.W * 1.5, this.H * 0.06); g.restore(); }
      g.restore();
    }
    if (w === 'raindance' || w === 'primordialsea' || b.field.storm > 0) { g.fillStyle = w === 'primordialsea' || b.field.storm > 0 ? 'rgba(15,25,65,0.3)' : 'rgba(30,50,90,0.15)'; g.fillRect(0, 0, this.W, this.H); }
    if (w === 'sandstorm') { g.fillStyle = 'rgba(200,160,80,0.22)'; g.fillRect(0, 0, this.W, this.H); }
    if (w === 'hail' || w === 'snow') { g.fillStyle = 'rgba(220,240,255,0.12)'; g.fillRect(0, 0, this.W, this.H); }
    if (b.field.trickroom > 0) { g.fillStyle = 'rgba(255,100,230,0.06)'; g.fillRect(0, 0, this.W, this.H); }
    if (b.field.storm > 0 && Math.random() < 0.004) { this.fx.flash = 0.25; this.fx.flashColor = '#cfd8ff'; }
  }

  drawTexts(g, b) {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const t of this.fx.texts) {
      const a = Math.min(1, (t.life - t.t) / 0.3);
      const pop = 1 + Math.max(0, 0.4 - t.t) * 1.5;
      g.globalAlpha = a;
      g.font = `${Math.round((t.big ? 15 : 12) * pop)}px "Press Start 2P", monospace`;
      g.lineWidth = 4;
      g.strokeStyle = '#000';
      g.strokeText(t.text, t.x, t.y);
      g.fillStyle = t.color;
      g.fillText(t.text, t.x, t.y);
    }
    for (const l of this.fx.labels) {
      const m = l.mon;
      if (!m.onField) continue;
      const a = Math.min(1, (l.life - l.t) / 0.3);
      g.globalAlpha = a;
      g.font = '11px "Press Start 2P", monospace';
      const w = g.measureText(l.text).width + 14;
      const top = m.y - 125 - (m.hover || 0);
      g.fillStyle = 'rgba(16,18,40,0.9)';
      g.fillRect(m.x - w / 2, top - 11, w, 22);
      g.fillStyle = SIDE_COLOR[m.side];
      g.fillRect(m.x - w / 2, top - 11, 4, 22);
      g.fillStyle = '#ffffff';
      g.fillText(l.text, m.x + 2, top + 1);
    }
    g.globalAlpha = 1;
  }

  // ------------------------------------------------------------ animações especiais (no mundo)
  drawCinematicWorld(g, b) {
    const c = b.cinematic;
    if (b.clash) {
      const cl = b.clash;
      const v = this.view();
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
      for (const beam of [cl.a, cl.b]) this.drawBeam(g, beam);
      const r = 34 + Math.sin(this.time * 30) * 8;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const grd = g.createRadialGradient(cl.x, cl.y - 10, 2, cl.x, cl.y - 10, r * 2.5);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.4, hexA(TYPE_COLOR[cl.a.type], 0.8));
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(cl.x, cl.y - 10, r * 2.5, 0, TAU); g.fill();
      g.restore();
      for (let i = 0; i < 3; i++) { this.fx.trail(cl.x, cl.y - 10, cl.a.type, 50, 5); this.fx.trail(cl.x, cl.y - 10, cl.b.type, 50, 5); }
      if (Math.random() < 0.5) this.fx.sparks(cl.x, cl.y - 10, '#ffffff', 4, 500);
      this.fx.shake = Math.max(this.fx.shake, 3);
    }
    if (!c) return;
    if (c.type === 'mega' || c.type === 'megaclash') {
      const k = c.t / c.dur;
      const v = this.view();
      g.fillStyle = `rgba(10,0,30,${0.6 * Math.min(1, c.t * 3)})`;
      g.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
      for (const i of c.sides) {
        const m = b.sides[i].active;
        if (!m) continue;
        const r = 30 + k * 110;
        const hue = (this.time * 300 + i * 180) % 360;
        g.save();
        g.globalCompositeOperation = 'lighter';
        const grd = g.createRadialGradient(m.x, m.y - 40, 4, m.x, m.y - 40, r);
        grd.addColorStop(0, `hsla(${hue},100%,90%,${0.4 + k * 0.5})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.beginPath(); g.arc(m.x, m.y - 40, r, 0, TAU); g.fill();
        g.strokeStyle = `hsl(${hue},100%,75%)`;
        g.lineWidth = 5;
        g.beginPath(); g.arc(m.x, m.y - 40, r * 0.9, 0, TAU); g.stroke();
        g.translate(m.x, m.y - 40);
        g.rotate(this.time * 3);
        g.strokeStyle = '#ffffff'; g.lineWidth = 4;
        g.beginPath(); g.arc(0, 0, 24, 0.3, Math.PI - 0.3); g.stroke();
        g.beginPath(); g.arc(0, 0, 24, Math.PI + 0.3, TAU - 0.3); g.stroke();
        g.restore();
        this.drawMon(g, b, m, 0);
        if (Math.random() < 0.9) this.fx.add({ x: m.x + (Math.random() - 0.5) * r * 2, y: m.y - 40 + (Math.random() - 0.5) * r * 2, size: 3, life: 0.5, color: `hsl(${Math.random() * 360},100%,70%)`, shape: 'spark', blend: 'lighter' });
      }
      if (c.type === 'megaclash' && c.sides.length === 2) {
        const [m1, m2] = c.sides.map(i => b.sides[i].active);
        if (m1 && m2) {
          g.save();
          g.globalCompositeOperation = 'lighter';
          g.strokeStyle = `rgba(255,255,255,${0.5 + Math.random() * 0.5})`;
          g.lineWidth = 5;
          g.beginPath(); g.moveTo(m1.x, m1.y - 40);
          for (let i = 1; i <= 10; i++) g.lineTo(m1.x + ((m2.x - m1.x) * i) / 10 + (Math.random() - 0.5) * 50, m1.y - 40 + ((m2.y - m1.y) * i) / 10 + (Math.random() - 0.5) * 50);
          g.stroke();
          g.restore();
        }
      }
    }
  }
}

function zigzag(len, amp) {
  const pts = [];
  for (let x = 24; x < len; x += 24) pts.push([x, (Math.random() - 0.5) * amp]);
  pts.push([len, 0]);
  return pts;
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function hexA(color, a) {
  if (!color || color[0] !== '#') return color;
  return `rgba(${hexRgb(color)},${a})`;
}

export { SIDE_COLOR, displayName };
