// Desenha a batalha: arena, treinadores, Pokémon, golpes, clima e animações especiais.
import { WORLD_W, WORLD_H, FIELD } from '../engine/constants.js';
import { BODY, TYPE_COLOR, MOVES, displayName } from '../data/dex.js';
import { buildArena } from './arena.js';
import { Fx, palette } from './fx.js';
import { drawHud } from './hud.js';

const TAU = Math.PI * 2;
const SIDE_COLOR = ['#e8433f', '#3f7fe8'];

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
    this.trainerPose = [{ t: 9, pose: 'idle' }, { t: 9, pose: 'idle' }];
    this.lastMega = null;
    this.bgFrames = null;
    this.vibrate = true;
    this.resize();
  }

  setBattle(battle) {
    this.battle = battle;
    this.bgFrames = buildArena(battle.arena, battle.platforms);
    this.fx = new Fx();
    this.weatherParts = [];
    this.flashes.clear();
    this.endShown = 0;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const W = window.innerWidth, H = window.innerHeight;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    this.dpr = dpr;
    this.W = W;
    this.H = H;
    // em telas bem largas, corta um pouco da arquibancada de cima para a arena ficar maior
    this.scale = Math.min(W / WORLD_W, H / (WORLD_H - 64));
    this.ox = (W - WORLD_W * this.scale) / 2;
    this.oy = Math.min((H - WORLD_H * this.scale) / 2, H - WORLD_H * this.scale);
  }

  // ------------------------------------------------------------ eventos da batalha
  consume(events) {
    const fx = this.fx;
    for (const e of events) {
      switch (e.t) {
        case 'float': fx.float(e.x, e.y, e.text, e.color, e.big); break;
        case 'label': fx.label(e.mon, e.text); this.pose(e.mon.side, 'point', 0.4); break;
        case 'hit': {
          this.flashes.set(e.mon.uid, this.time);
          const type = e.mv.type;
          fx.burst(e.x, e.y - 18, type, e.eff > 1 ? 22 : 12, e.eff > 1 ? 240 : 160);
          if (e.crit || e.eff > 1) fx.shake = Math.max(fx.shake, e.eff > 1 ? 7 : 5);
          this.sound.play(e.eff > 1 ? 'hitSuper' : e.eff < 1 ? 'hitWeak' : 'hit');
          if (e.crit) this.sound.play('crit');
          if (this.vibrate && e.dmg > 0) navigator.vibrate?.(e.eff > 1 ? 40 : 18);
          break;
        }
        case 'impact': fx.burst(e.x, e.y, e.type, 8, 120); break;
        case 'explode': fx.burst(e.x, e.y, e.type, 26, 260, { size: 4, life: 0.6 }); fx.shake = Math.max(fx.shake, 6); this.sound.play('explode'); break;
        case 'collide': fx.burst(e.x, e.y, e.a, 10, 180); fx.burst(e.x, e.y, e.b, 10, 180); this.sound.play('clash'); break;
        case 'steam': for (let i = 0; i < 8; i++) fx.add({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 40, size: 10 + Math.random() * 8, life: 1.2, color: 'rgba(255,255,255,0.5)', shape: 'circle', drag: 1 }); break;
        case 'shake': fx.shake = Math.max(fx.shake, e.amount); if (e.amount > 6) this.sound.play('quake'); break;
        case 'execute': this.onExecute(e); break;
        case 'charge': this.sound.play('beam', { type: MOVES[e.id].type }); break;
        case 'dodgeStart': this.sound.play('dodge'); break;
        case 'dodge': fx.burst(e.mon.x, e.mon.y - 20, 'Flying', 8, 100); break;
        case 'boost': this.sound.play(e.delta > 0 ? 'up' : 'down'); fx.float(e.mon.x + 20, e.mon.y - 60, e.delta > 0 ? '▲' : '▼', e.delta > 0 ? '#ff8c5a' : '#6aa8ff'); break;
        case 'status': this.sound.play('status'); break;
        case 'protect': this.sound.play('protect'); break;
        case 'protectUp': this.sound.play('protect'); break;
        case 'faint': this.sound.play('faint'); fx.shake = 8; break;
        case 'sendOut': this.pose(e.mon.side, 'throw', 0.6); fx.burst(e.mon.x, e.mon.y - 20, 'Normal', 16, 140); break;
        case 'recall': fx.burst(e.mon.x, e.mon.y - 20, 'Fire', 10, 80); this.pose(e.mon.side, 'point', 0.4); break;
        case 'megaStart': this.sound.play('mega'); this.pose(e.side, 'mega', 2.2); break;
        case 'megaClash': this.sound.play('megaClash'); this.pose(0, 'mega', 3.2); this.pose(1, 'mega', 3.2); break;
        case 'megaEvolve': fx.burst(e.mon.x, e.mon.y - 30, 'Fairy', 40, 260, { size: 4, life: 0.9 }); fx.flash = 1; fx.flashColor = '#ffffff'; break;
        case 'megaClimate': this.climate = { name: e.name, t: 0 }; this.sound.play('weather'); break;
        case 'weather': if (e.id) this.sound.play('weather'); break;
        case 'clashStart': this.sound.play('clash'); fx.flash = 0.6; fx.flashColor = '#ffffff'; break;
        case 'clashEnd': fx.burst(e.x, e.y, 'Electric', 40, 320, { size: 4 }); fx.shake = 12; this.sound.play('explode'); break;
        case 'bolt': this.bolts = [...(this.bolts || []), { x: e.x, y: e.y, t: 0 }]; this.sound.play('thunder'); fx.flash = 0.5; fx.flashColor = '#fff7b0'; break;
        case 'emerge': fx.burst(e.x, e.y, e.mode === 'dig' ? 'Ground' : e.mode === 'dive' ? 'Water' : 'Flying', 20, 200); fx.shake = 5; break;
        case 'vanish': fx.burst(e.mon.x, e.mon.y, e.mode === 'dig' ? 'Ground' : e.mode === 'dive' ? 'Water' : 'Flying', 14, 160); this.sound.play('dash'); break;
        case 'areaHit': this.areaFx(e); break;
        case 'subBreak': fx.burst(e.mon.x, e.mon.y - 20, 'Normal', 14, 150); break;
        case 'end': this.sound.play(e.winner === 0 || (e.winner === 1 && this.humans?.[1]) ? 'win' : 'lose'); break;
      }
    }
  }

  onExecute(e) {
    const m = MOVES[e.id];
    const kind = e.shape;
    if (kind === 'beam' || kind === 'cone') this.sound.play('beam', { type: m.type });
    else if (kind === 'projectile' || kind === 'wave' || kind === 'area') this.sound.play('shoot', { type: m.type });
    else if (kind === 'lunge' || kind === 'grab' || kind === 'rollout' || kind === 'leap') this.sound.play('dash');
    else if (kind === 'slash' || kind === 'spin') this.sound.play('swing');
    else if (kind === 'ring') this.sound.play(m.type === 'Ground' ? 'quake' : 'shoot', { type: m.type });
    if (kind === 'self' || kind === 'field') {
      const heal = m.heal || ['synthesis', 'roost', 'rest', 'lifedew'].includes(e.id);
      this.sound.play(heal ? 'heal' : 'up');
      this.fx.burst(e.mon.x, e.mon.y - 20, m.type, 16, 90, { g: -120, life: 0.7 });
    }
  }

  areaFx(e) {
    const fx = this.fx;
    if (e.id === 'blastburn') { fx.burst(e.x, e.y, 'Fire', 50, 380, { size: 5, life: 0.8 }); fx.shake = 12; this.sound.play('explode'); return; }
    fx.burst(e.x, e.y, e.type, 18, 200, { up: 80 });
    if (e.type === 'Rock' || e.type === 'Ground') this.sound.play('quake');
  }

  pose(side, pose, t) { this.trainerPose[side] = { pose, t }; }

  // ------------------------------------------------------------ quadro
  frame(dt, ui) {
    const b = this.battle;
    this.time += dt;
    this.ui = ui;
    if (b) {
      this.consume(b.events);
      b.events.length = 0;
    }
    this.fx.update(dt);
    if (this.climate) this.climate.t += dt;
    for (const p of this.trainerPose) p.t -= dt;
    if (this.bolts) { for (const bo of this.bolts) bo.t += dt; this.bolts = this.bolts.filter(bo => bo.t < 0.3); }

    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#16172a';
    g.fillRect(0, 0, this.W, this.H);
    if (!b) return;

    // mundo
    g.save();
    const sh = this.fx.shake;
    g.translate(this.ox + (sh ? (Math.random() - 0.5) * sh : 0), this.oy + (sh ? (Math.random() - 0.5) * sh : 0));
    g.scale(this.scale, this.scale);
    g.beginPath(); g.rect(0, 0, WORLD_W, WORLD_H); g.clip();
    const excited = b.clash || b.cinematic?.type?.startsWith('mega');
    g.drawImage(this.bgFrames[Math.floor(this.time / (excited ? 0.15 : 0.45)) % 2], 0, 0);
    this.drawField(g, b);
    this.drawWorld(g, b, dt);
    this.drawWeather(g, b, dt);
    this.fx.draw(g);
    this.drawTexts(g, b);
    this.drawCinematicWorld(g, b);
    g.restore();

    if (this.fx.flash > 0) {
      g.globalAlpha = Math.min(1, this.fx.flash);
      g.fillStyle = this.fx.flashColor;
      g.fillRect(0, 0, this.W, this.H);
      g.globalAlpha = 1;
    }
    drawHud(g, this, b, ui);
  }

  w2s(x, y) { return { x: this.ox + x * this.scale, y: this.oy + y * this.scale }; }

  // ------------------------------------------------------------ chão: terreno, zonas, marcações
  drawField(g, b) {
    const t = this.time;
    if (b.field.terrain?.id === 'grassyterrain') {
      g.fillStyle = 'rgba(80,200,60,0.18)';
      g.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
      g.fillStyle = '#3d9a2c';
      for (let i = 0; i < 70; i++) {
        const x = FIELD.x + ((i * 97) % FIELD.w), y = FIELD.y + ((i * 53) % FIELD.h);
        g.fillRect(x, y, 2, 5 + Math.sin(t * 3 + i) * 1.5);
        if (i % 7 === 0) { g.fillStyle = '#ffe86a'; g.fillRect(x + 3, y - 2, 3, 3); g.fillStyle = '#3d9a2c'; }
      }
    }
    if (b.arena === 'water') {
      g.strokeStyle = 'rgba(255,255,255,0.12)';
      g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const y = FIELD.y + 30 + i * 62 + Math.sin(t + i) * 4;
        g.beginPath();
        for (let x = FIELD.x; x <= FIELD.x + FIELD.w; x += 16) g.lineTo(x, y + Math.sin(x / 40 + t * 2 + i) * 3);
        g.stroke();
      }
    }
    for (const e of b.ents) {
      if (e.kind === 'zone') this.drawZone(g, e, false);
      if (e.kind === 'telegraph' || (e.kind === 'area' && !e.done)) {
        const k = e.kind === 'telegraph' ? e.t / e.dur : e.t / e.delay;
        this.telegraph(g, e.x, e.y, e.r, k, e.side);
      }
      if (e.kind === 'line' && !e.done) {
        const x2 = e.x + Math.cos(e.angle) * e.len, y2 = e.y + Math.sin(e.angle) * e.len;
        g.strokeStyle = `rgba(255,60,60,${0.3 + 0.4 * (e.t / e.delay)})`;
        g.lineWidth = e.width;
        g.setLineDash([12, 8]);
        g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(x2, y2); g.stroke();
        g.setLineDash([]);
      }
      if (e.kind === 'line' && e.done) {
        const x2 = e.x + Math.cos(e.angle) * e.len, y2 = e.y + Math.sin(e.angle) * e.len;
        g.strokeStyle = '#2b1d10';
        g.lineWidth = 6;
        g.beginPath(); g.moveTo(e.x, e.y);
        for (let i = 1; i <= 10; i++) g.lineTo(e.x + (x2 - e.x) * i / 10 + (Math.random() - 0.5) * 14, e.y + (y2 - e.y) * i / 10 + (Math.random() - 0.5) * 14);
        g.stroke();
      }
      if (e.kind === 'bolt' && !e.done) this.telegraph(g, e.x, e.y, 50, e.t / e.delay, -1, '#ffe14a');
    }
  }

  telegraph(g, x, y, r, k, side, color) {
    const c = color || (side === 0 ? '255,90,80' : side === 1 ? '90,150,255' : '255,220,80');
    const rgb = color ? '255,225,80' : c;
    g.fillStyle = `rgba(${rgb},${0.12 + 0.18 * k})`;
    g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, TAU); g.fill();
    g.strokeStyle = `rgba(${rgb},0.9)`;
    g.lineWidth = 2;
    g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, TAU); g.stroke();
    g.beginPath(); g.ellipse(x, y, r * (1 - Math.min(1, k)), r * 0.8 * (1 - Math.min(1, k)), 0, 0, TAU); g.stroke();
  }

  drawZone(g, z) {
    const a = Math.min(1, z.t / 0.6);
    if (z.zone === 'fire') {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + this.time;
        const x = z.x + Math.cos(ang) * z.r * 0.5, y = z.y + Math.sin(ang) * z.r * 0.35;
        const h = 10 + Math.sin(this.time * 12 + i) * 4;
        g.globalAlpha = a;
        g.fillStyle = '#ff7a1f'; g.fillRect(x - 4, y - h, 8, h);
        g.fillStyle = '#ffd44a'; g.fillRect(x - 2, y - h * 0.6, 4, h * 0.6);
      }
      g.globalAlpha = 1;
      if (Math.random() < 0.3) this.fx.trail(z.x + (Math.random() - 0.5) * z.r, z.y - 6, 'Fire', 4, 3);
    } else if (z.zone === 'ice') {
      g.globalAlpha = 0.85 * a;
      g.fillStyle = '#dff6ff';
      g.beginPath(); g.ellipse(z.x, z.y, z.r, z.r * 0.75, 0, 0, TAU); g.fill();
      g.strokeStyle = '#9ad7ef'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#ffffff';
      g.fillRect(z.x - z.r * 0.4, z.y - z.r * 0.3, z.r * 0.3, 3);
      g.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------ objetos ordenados por profundidade
  drawWorld(g, b, dt) {
    this.drawTrainers(g, b);
    const items = [];
    for (const s of b.sides) {
      const m = s.active;
      if (m && (m.onField || m.action?.type === 'fainting')) items.push({ y: m.y, draw: () => this.drawMon(g, b, m) });
    }
    for (const e of b.ents) {
      if (e.kind === 'proj') items.push({ y: e.y, draw: () => this.drawProj(g, e) });
      else if (e.kind === 'slashfx') items.push({ y: e.y + 1, draw: () => this.drawSlash(g, e) });
      else if (e.kind === 'shock') items.push({ y: e.y - 1, draw: () => this.drawShock(g, e) });
      else if (e.kind === 'area' && e.done) items.push({ y: e.y + 2, draw: () => this.drawAreaHit(g, e) });
    }
    // sombras primeiro
    for (const s of b.sides) { const m = s.active; if (m && m.onField) this.shadow(g, m); }
    items.sort((a, c) => a.y - c.y);
    for (const it of items) it.draw();
    for (const e of b.ents) {
      if (e.kind === 'beam') this.drawBeam(g, e, b);
      else if (e.kind === 'cone') this.drawCone(g, e);
      else if (e.kind === 'wave') this.drawWave(g, e);
      else if (e.kind === 'ring') this.drawRing(g, e);
      else if (e.kind === 'gazefx') this.drawGaze(g, e);
      else if (e.kind === 'aura') this.drawAura(g, e);
      else if (e.kind === 'zone' && e.zone === 'steam') this.drawSteam(g, e);
    }
    if (this.bolts) for (const bo of this.bolts) this.drawBolt(g, bo);
    // linha de mira enquanto o jogador arrasta o botão
    const aim = this.ui?.controls?.aim;
    if (aim) for (let i = 0; i < 2; i++) {
      const a = aim[i];
      const m = b.sides[i].active;
      if (!a || !m || !m.onField) continue;
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.setLineDash([8, 6]);
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(m.x, m.y - 20); g.lineTo(m.x + a.dx * 260, m.y - 20 + a.dy * 260); g.stroke();
      g.setLineDash([]);
    }
  }

  shadow(g, m) {
    if (m.semiInv === 'dig' || m.semiInv === 'dive') return;
    const lift = (m.hover || 0) + (m.z || 0) + (m.semiInv === 'fly' ? 80 : 0);
    const k = Math.max(0.35, 1 - lift / 160);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.ellipse(m.x, m.y, m.radius * 1.1 * k, m.radius * 0.42 * k, 0, 0, TAU); g.fill();
  }

  drawMon(g, b, m) {
    const body = BODY[m.species] || BODY[m.baseSpecies];
    const scale = body.scale;
    const a = m.action;
    let alpha = 1;
    let y = m.y;
    let extra = 1;
    const t = this.time;
    if (a?.type === 'fainting') { alpha = Math.max(0, 1 - a.t / a.dur); y += a.t * 18; }
    if (a?.type === 'switching') { extra = Math.max(0.05, 1 - a.t / a.dur); alpha = extra; }
    if (a?.type === 'entering') { extra = Math.min(1, 0.2 + a.t / a.dur); }
    if (m.iframes > 0) alpha *= 0.45 + 0.3 * Math.sin(t * 60);
    if (m.semiInv === 'dig') {
      g.fillStyle = '#7a5a2a';
      g.beginPath(); g.ellipse(m.x, m.y, 18, 8, 0, 0, TAU); g.fill();
      if (Math.random() < 0.5) this.fx.trail(m.x, m.y, 'Ground', 14, 3);
      return;
    }
    if (m.semiInv === 'dive') {
      g.strokeStyle = 'rgba(200,235,255,0.8)';
      g.lineWidth = 2;
      for (let i = 0; i < 2; i++) { const r = 10 + ((t * 30 + i * 12) % 24); g.beginPath(); g.ellipse(m.x, m.y, r, r * 0.5, 0, 0, TAU); g.stroke(); }
      return;
    }
    if (m.semiInv === 'fly') { y -= 140; alpha *= 0.85; }
    const hover = m.hover ? m.hover + Math.sin(t * 4 + m.uid) * 3 : 0;
    y -= hover + (m.z || 0);
    const flash = this.flashes.has(m.uid) ? Math.max(0, 1 - (t - this.flashes.get(m.uid)) / 0.16) : 0;

    // aura de carga / postura / Mega
    if (a?.type === 'charge' || a?.type === 'stance') {
      const col = TYPE_COLOR[MOVES[a.id || (a.mode === 'bide' ? 'bide' : a.mode)]?.type] || '#fff';
      g.globalAlpha = 0.35 + 0.2 * Math.sin(t * 14);
      g.fillStyle = col;
      g.beginPath(); g.arc(m.x, y - 22, m.radius * 1.5, 0, TAU); g.fill();
      g.globalAlpha = 1;
      if (Math.random() < 0.6) this.fx.trail(m.x + (Math.random() - 0.5) * 40, y - 10 - Math.random() * 40, MOVES[a.id || 'bide']?.type || 'Normal', 6, 3);
    }
    if (m.isMega && Math.random() < 0.15) this.fx.trail(m.x + (Math.random() - 0.5) * 30, y - Math.random() * 50, ['Fire', 'Water', 'Grass', 'Psychic', 'Electric'][Math.floor(Math.random() * 5)], 4, 2);
    if (a?.type === 'dash' && a.trail) this.fx.trail(m.x, y - 15, a.trail, 18, 4);
    if (a?.type === 'rollout') this.fx.trail(m.x, y, 'Rock', 14, 3);

    g.save();
    g.globalAlpha = alpha;
    if (m.vol.substitute) {
      this.drawSubstitute(g, m.x, y);
    } else {
      g.translate(m.x, y);
      g.scale(extra, extra);
      const anim = a?.type === 'dash' || a?.type === 'grab' ? 'Attack' : m.anim.name;
      const at = a?.type === 'dash' ? Math.min(m.anim.t, 0.2) : m.anim.t;
      this.bank.draw(g, m.species, anim, at, m.facing, 0, 0, scale, { flash, frozen: m.status === 'frz' });
    }
    g.restore();

    // Protect
    if (m.vol.protect) {
      g.strokeStyle = 'rgba(120,255,140,0.9)';
      g.fillStyle = 'rgba(120,255,140,0.18)';
      g.lineWidth = 2;
      g.beginPath(); g.arc(m.x, y - 22, m.radius * 1.7, 0, TAU); g.fill(); g.stroke();
    }
    if (m.vol.partiallytrapped) {
      const type = MOVES[m.vol.partiallytrapped.move]?.type || 'Normal';
      for (let i = 0; i < 3; i++) this.fx.trail(m.x + Math.cos(t * 8 + i * 2) * 28, y - 10 + Math.sin(t * 8 + i * 2) * 10, type, 4, 3);
    }
    if (m.vol.leechseed && Math.random() < 0.1) this.fx.trail(m.x, y - 20, 'Grass', 20, 3);
    // ícones de status
    const top = y - this.bank.height(m.species, scale) - 6;
    if (m.status === 'slp') { g.fillStyle = '#fff'; g.font = '10px "Press Start 2P"'; g.fillText('z', m.x + 14 + Math.sin(t * 2) * 3, top - ((t * 10) % 12)); g.fillText('Z', m.x + 22, top - 10 - ((t * 10 + 6) % 12)); }
    if (m.status === 'brn' && Math.random() < 0.25) this.fx.trail(m.x, y - 12, 'Fire', 20, 3);
    if (m.status === 'psn' || m.status === 'tox') { if (Math.random() < 0.15) this.fx.trail(m.x, y - 20, 'Poison', 20, 3); }
    if (m.status === 'par' && Math.random() < 0.12) this.fx.trail(m.x, y - 20, 'Electric', 26, 3);
    if (m.vol.confusion) for (let i = 0; i < 3; i++) { g.fillStyle = '#ffe14a'; g.fillRect(m.x + Math.cos(t * 5 + i * 2.1) * 18 - 2, top + Math.sin(t * 5 + i * 2.1) * 4, 4, 4); }
    if (m.vol.attract && Math.random() < 0.05) this.fx.float(m.x, top, '♥', '#ff6fa8');
    if (a?.type === 'fainting') return;
    // barrinha de PS sobre a cabeça
    const w = 44;
    const frac = m.hp / m.maxhp;
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(m.x - w / 2 - 1, top - 2, w + 2, 6);
    g.fillStyle = frac > 0.5 ? '#4ade5a' : frac > 0.2 ? '#f5c518' : '#f04438';
    g.fillRect(m.x - w / 2, top - 1, w * frac, 4);
    g.fillStyle = SIDE_COLOR[m.side];
    g.fillRect(m.x - w / 2 - 1, top - 4, 6, 2);
    if (m.isMega) { g.fillStyle = '#ff6fd8'; g.font = '6px "Press Start 2P"'; g.fillText('M', m.x + w / 2 + 2, top + 4); }
  }

  drawSubstitute(g, x, y) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(x, y, 16, 6, 0, 0, TAU); g.fill();
    g.fillStyle = '#c8a46a';
    g.fillRect(x - 12, y - 30, 24, 28);
    g.fillRect(x - 14, y - 40, 8, 14);
    g.fillRect(x + 6, y - 40, 8, 14);
    g.fillStyle = '#2b1d10';
    g.fillRect(x - 6, y - 22, 3, 3);
    g.fillRect(x + 3, y - 22, 3, 3);
    g.fillStyle = '#8f6b3a';
    g.fillRect(x - 4, y - 14, 8, 2);
  }

  drawTrainers(g, b) {
    for (const s of b.sides) {
      const i = s.index;
      const x = i === 0 ? 44 : WORLD_W - 44;
      const y = FIELD.y + FIELD.h / 2 + 34;
      const p = this.trainerPose[i];
      const pose = p.t > 0 ? p.pose : 'idle';
      const ready = !s.megaUsed && s.active && b.canMega(i);
      drawTrainer(g, x, y, i, pose, this.time, ready);
      if (pose === 'mega' && s.active) {
        // raio da Pedra-chave até o Pokémon
        const m = s.active;
        const hue = (this.time * 360) % 360;
        g.strokeStyle = `hsl(${hue},100%,70%)`;
        g.lineWidth = 3 + Math.sin(this.time * 30) * 1.5;
        g.beginPath(); g.moveTo(x + (i === 0 ? 8 : -8), y - 40); g.lineTo(m.x, m.y - 30); g.stroke();
      }
    }
  }

  // ------------------------------------------------------------ golpes
  drawProj(g, p) {
    if (p.delay > 0) return;
    const col = TYPE_COLOR[p.type] || '#fff';
    const pal = palette(p.type);
    const x = p.x, y = p.y - (p.z || 0);
    const s = p.size;
    const t = this.time;
    if (p.lob) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(p.x, p.y, s, s * 0.4, 0, 0, TAU); g.fill(); }
    if (Math.random() < 0.7) this.fx.trail(x, y, p.type, s * 0.8, Math.max(2, s * 0.3));
    g.save();
    g.translate(x, y);
    g.rotate(p.angle || 0);
    switch (p.sprite) {
      case 'flame':
        g.fillStyle = pal[3]; g.beginPath(); g.arc(0, 0, s * 1.1, 0, TAU); g.fill();
        g.fillStyle = pal[1]; g.beginPath(); g.arc(s * 0.2, 0, s * 0.75, 0, TAU); g.fill();
        g.fillStyle = pal[0]; g.beginPath(); g.arc(s * 0.35, 0, s * 0.4, 0, TAU); g.fill();
        break;
      case 'leaf': case 'petal':
        g.rotate(t * 12);
        g.fillStyle = p.sprite === 'petal' ? '#ff9ccb' : '#5fd34a';
        g.beginPath(); g.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); g.fill();
        g.strokeStyle = '#2e7d32'; g.lineWidth = 1; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke();
        break;
      case 'crescent':
        g.strokeStyle = '#ffffff'; g.lineWidth = 4;
        g.beginPath(); g.arc(-s * 0.4, 0, s, -1.1, 1.1); g.stroke();
        g.strokeStyle = col; g.lineWidth = 2;
        g.beginPath(); g.arc(-s * 0.6, 0, s, -1.1, 1.1); g.stroke();
        break;
      case 'rock': case 'scale': case 'item': case 'berry':
        g.rotate(t * 6);
        g.fillStyle = p.sprite === 'scale' ? '#9d7bff' : p.sprite === 'berry' ? '#ffcf3a' : p.sprite === 'item' ? '#e9e9f5' : '#a68c3a';
        g.beginPath(); g.moveTo(-s, -s * 0.5); g.lineTo(-s * 0.2, -s); g.lineTo(s, -s * 0.4); g.lineTo(s * 0.7, s * 0.8); g.lineTo(-s * 0.6, s); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1; g.stroke();
        break;
      case 'shard': case 'icicle':
        g.fillStyle = '#dff8ff'; g.beginPath(); g.moveTo(s * 1.6, 0); g.lineTo(-s, -s * 0.6); g.lineTo(-s * 0.6, 0); g.lineTo(-s, s * 0.6); g.closePath(); g.fill();
        g.strokeStyle = '#5cc6e0'; g.lineWidth = 1; g.stroke();
        break;
      case 'star':
        g.rotate(t * 10);
        g.fillStyle = '#ffe14a';
        g.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.45 : s; g.lineTo(Math.cos((i * Math.PI) / 5) * r, Math.sin((i * Math.PI) / 5) * r); }
        g.closePath(); g.fill();
        break;
      case 'bubble':
        g.strokeStyle = '#cfefff'; g.lineWidth = 2; g.fillStyle = 'rgba(120,190,255,0.35)';
        g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = '#fff'; g.fillRect(-s * 0.4, -s * 0.5, 3, 3);
        break;
      case 'tornado': case 'vortex':
        for (let i = 0; i < 4; i++) {
          g.strokeStyle = p.sprite === 'vortex' ? `rgba(80,160,255,${0.9 - i * 0.2})` : `rgba(220,220,255,${0.9 - i * 0.2})`;
          g.lineWidth = 3;
          g.beginPath(); g.ellipse(0, -i * s * 0.4, s * (0.5 + i * 0.25), s * 0.25, t * 8 + i, 0, TAU * 0.8); g.stroke();
        }
        break;
      case 'seed':
        g.fillStyle = '#9b6b2f'; g.beginPath(); g.ellipse(0, 0, s, s * 0.7, 0, 0, TAU); g.fill();
        g.fillStyle = '#5fd34a'; g.fillRect(-2, -s, 4, s * 0.6);
        break;
      case 'glob': case 'mud': case 'sand':
        g.fillStyle = p.sprite === 'glob' ? '#9b3fbf' : p.sprite === 'mud' ? '#7a5a2a' : '#d9b366';
        g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(-s * 0.3, -s * 0.3, s * 0.3, 0, TAU); g.fill();
        break;
      case 'aura': case 'pulse': case 'crystal':
        g.fillStyle = col; g.globalAlpha = 0.35; g.beginPath(); g.arc(0, 0, s * 1.5, 0, TAU); g.fill();
        g.globalAlpha = 1; g.fillStyle = pal[1]; g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, s * 0.45, 0, TAU); g.fill();
        if (p.sprite === 'pulse') { g.strokeStyle = pal[0]; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, s * (1.3 + Math.sin(t * 20) * 0.3), 0, TAU); g.stroke(); }
        break;
      case 'wisp':
        g.fillStyle = '#5b8cff'; g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill();
        g.fillStyle = '#c9dcff'; g.beginPath(); g.arc(0, 0, s * 0.5, 0, TAU); g.fill();
        break;
      case 'powder': case 'smoke':
        g.fillStyle = p.sprite === 'smoke' ? 'rgba(80,80,80,0.6)' : p.id === 'sleeppowder' ? 'rgba(120,220,140,0.6)' : 'rgba(190,110,230,0.6)';
        for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(Math.cos(i + t * 4) * s * 0.6, Math.sin(i * 2 + t * 3) * s * 0.6, s * 0.45, 0, TAU); g.fill(); }
        break;
      case 'heart':
        g.fillStyle = '#ff6fa8'; g.font = `${Math.round(s * 1.8)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.rotate(-(p.angle || 0)); g.fillText('♥', 0, 0);
        break;
      case 'web':
        g.strokeStyle = '#f0f0f0'; g.lineWidth = 1;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-s, (i - 1.5) * 4); g.lineTo(s, (i - 1.5) * 4); g.stroke(); }
        break;
      case 'drain':
        g.fillStyle = '#7df07d'; g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill();
        g.fillStyle = '#e8ffe8'; g.beginPath(); g.arc(0, 0, s * 0.5, 0, TAU); g.fill();
        break;
      case 'fist':
        g.fillStyle = '#5a4636'; g.fillRect(-s, -s * 0.7, s * 2, s * 1.4);
        g.fillStyle = '#2a201a'; g.fillRect(s * 0.4, -s * 0.7, s * 0.6, s * 1.4);
        break;
      default:
        g.fillStyle = col; g.globalAlpha = 0.4; g.beginPath(); g.arc(0, 0, s * 1.4, 0, TAU); g.fill();
        g.globalAlpha = 1; g.fillStyle = pal[1]; g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill();
        g.fillStyle = pal[0]; g.beginPath(); g.arc(s * 0.2, -s * 0.2, s * 0.45, 0, TAU); g.fill();
    }
    g.restore();
  }

  drawBeam(g, e, b) {
    if (e.ox === undefined) return;
    const pal = palette(e.type);
    const len = e.len;
    const w = e.width * (0.85 + 0.15 * Math.sin(this.time * 40));
    const fade = e.dead ? 0 : Math.min(1, (e.dur - e.t) / 0.15, e.t / 0.05 + 0.3);
    g.save();
    g.translate(e.ox, e.oy);
    g.rotate(e.angle);
    g.globalAlpha = Math.max(0.2, fade);
    if (e.id === 'flamethrower' || e.id === 'overheat') {
      for (let d = 0; d < len; d += 9) {
        const k = d / Math.max(1, len);
        const r = w * (0.3 + k * 0.6) * (0.8 + Math.random() * 0.4);
        g.fillStyle = pal[3]; g.beginPath(); g.arc(d, (Math.random() - 0.5) * 6, r, 0, TAU); g.fill();
        g.fillStyle = pal[1]; g.beginPath(); g.arc(d, 0, r * 0.6, 0, TAU); g.fill();
      }
      g.fillStyle = pal[0]; g.fillRect(0, -w * 0.12, len * 0.6, w * 0.24);
    } else if (e.sprite === 'bubble') {
      for (let d = 0; d < len; d += 14) {
        g.strokeStyle = '#cfefff'; g.lineWidth = 2;
        g.beginPath(); g.arc(d + ((this.time * 200) % 14), Math.sin(d * 0.3 + this.time * 10) * w * 0.4, 5 + (d % 3), 0, TAU); g.stroke();
      }
    } else {
      const outer = e.id === 'solarbeam' ? '#e8ff8a' : e.id === 'hyperbeam' ? '#ffb347' : e.id === 'signalbeam' ? `hsl(${(this.time * 400) % 360},90%,65%)` : TYPE_COLOR[e.type];
      g.fillStyle = outer;
      g.globalAlpha *= 0.4;
      g.fillRect(0, -w * 0.8, len, w * 1.6);
      g.globalAlpha = Math.max(0.2, fade);
      g.fillStyle = pal[1];
      g.fillRect(0, -w / 2, len, w);
      g.fillStyle = pal[0];
      g.fillRect(0, -w * 0.18, len, w * 0.36);
      g.fillStyle = '#fff';
      g.fillRect(0, -w * 0.07, len, w * 0.14);
      // ondulação
      g.fillStyle = 'rgba(255,255,255,0.5)';
      for (let d = (this.time * 600) % 40; d < len; d += 40) g.fillRect(d, -w / 2, 6, w);
      if (e.type === 'Ice' || e.type === 'Water') for (let i = 0; i < 2; i++) this.fx.trail(e.ox + Math.cos(e.angle) * Math.random() * len, e.oy + Math.sin(e.angle) * Math.random() * len, e.type, w, 3);
    }
    // ponta
    g.fillStyle = pal[0];
    g.beginPath(); g.arc(len, 0, w * 0.9, 0, TAU); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(0, 0, w * 0.7, 0, TAU); g.fill();
    g.restore();
    if (Math.random() < 0.8) this.fx.trail(e.ox + Math.cos(e.angle) * len, e.oy + Math.sin(e.angle) * len, e.type, w, 4);
  }

  drawCone(g, e) {
    const pal = palette(e.type);
    const grow = Math.min(1, e.t / 0.2);
    const r = e.range * grow;
    g.save();
    g.translate(e.x, e.y - 18);
    g.globalAlpha = 0.45 * Math.min(1, (e.dur - e.t) / 0.15 + 0.2);
    const grad = g.createRadialGradient(0, 0, 10, 0, 0, r);
    grad.addColorStop(0, pal[0]);
    grad.addColorStop(0.5, pal[1]);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, e.angle - e.half, e.angle + e.half); g.closePath(); g.fill();
    g.restore();
    for (let i = 0; i < 4; i++) {
      const a = e.angle + (Math.random() - 0.5) * e.half * 2;
      const d = Math.random() * r;
      this.fx.trail(e.x + Math.cos(a) * d, e.y - 18 + Math.sin(a) * d, e.sprite === 'leaf' ? 'Grass' : e.type, 6, 3);
    }
  }

  drawWave(g, e) {
    const pal = palette(e.type);
    g.save();
    g.translate(e.x, e.y);
    g.rotate(e.angle);
    const k = Math.min(1, (e.range - e.traveled) / 80);
    g.globalAlpha = Math.max(0.2, k);
    if (e.id === 'darkpulse' || e.id === 'ominouswind') {
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = i % 2 ? pal[2] : pal[3];
        g.lineWidth = 6;
        g.beginPath(); g.arc(-i * 14 - 60, 0, 70 + i * 6, -0.9, 0.9); g.stroke();
      }
    } else {
      g.fillStyle = pal[2];
      g.beginPath();
      g.moveTo(-e.thickness, -e.width / 2);
      for (let y = -e.width / 2; y <= e.width / 2; y += 10) g.lineTo(e.thickness / 2 + Math.sin(y / 14 + this.time * 12) * 6, y);
      g.lineTo(-e.thickness, e.width / 2);
      g.closePath();
      g.fill();
      g.fillStyle = e.id === 'heatwave' ? 'rgba(255,240,200,0.6)' : '#ffffff';
      for (let y = -e.width / 2; y <= e.width / 2; y += 14) g.fillRect(e.thickness / 2 - 4 + Math.sin(y + this.time * 20) * 3, y, 6, 6);
    }
    g.restore();
  }

  drawRing(g, e) {
    const pal = palette(e.type);
    const k = 1 - e.r / e.maxR;
    g.globalAlpha = Math.max(0.1, k);
    if (e.sound) {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const r = e.r - i * 16; if (r > 0) { g.beginPath(); g.ellipse(e.x, e.y - 20, r, r * 0.75, 0, 0, TAU); g.stroke(); } }
    } else if (e.sprite === 'petal') {
      for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU + this.time * 3; g.fillStyle = '#ff9ccb'; g.fillRect(e.x + Math.cos(a) * e.r - 3, e.y - 10 + Math.sin(a) * e.r * 0.7 - 2, 6, 4); }
    } else {
      g.strokeStyle = pal[2];
      g.lineWidth = 10;
      g.beginPath(); g.ellipse(e.x, e.y, e.r, e.r * 0.72, 0, 0, TAU); g.stroke();
      if (e.ground) for (let i = 0; i < 3; i++) { const a = Math.random() * TAU; this.fx.trail(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r * 0.72, 'Ground', 6, 4); }
    }
    g.globalAlpha = 1;
  }

  drawAreaHit(g, e) {
    const k = Math.min(1, (e.t - e.delay) / 0.35);
    const pal = palette(e.type);
    g.save();
    g.globalAlpha = 1 - k;
    const h = 90 * (1 - k * 0.5);
    switch (e.sprite) {
      case 'rock': case 'icicle':
        g.fillStyle = e.sprite === 'rock' ? '#a68c3a' : '#dff8ff';
        g.beginPath(); g.moveTo(e.x - 14, e.y); g.lineTo(e.x, e.y - 30 - (1 - k) * 40); g.lineTo(e.x + 14, e.y); g.closePath(); g.fill();
        break;
      case 'pillar': case 'geyser': case 'eruption':
        g.fillStyle = pal[2]; g.fillRect(e.x - e.r * 0.5, e.y - h * 1.6, e.r, h * 1.6);
        g.fillStyle = pal[0]; g.fillRect(e.x - e.r * 0.2, e.y - h * 1.6, e.r * 0.4, h * 1.6);
        break;
      case 'explosion':
        g.fillStyle = pal[3]; g.beginPath(); g.arc(e.x, e.y - 20, e.r * (0.6 + k * 0.5), 0, TAU); g.fill();
        g.fillStyle = pal[1]; g.beginPath(); g.arc(e.x, e.y - 20, e.r * (0.4 + k * 0.4), 0, TAU); g.fill();
        g.fillStyle = pal[0]; g.beginPath(); g.arc(e.x, e.y - 20, e.r * 0.25, 0, TAU); g.fill();
        break;
      case 'snare':
        g.strokeStyle = '#3d9a2c'; g.lineWidth = 4;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(e.x - 20 + i * 12, e.y); g.quadraticCurveTo(e.x - 30 + i * 18, e.y - 40, e.x - 10 + i * 8, e.y - 50); g.stroke(); }
        break;
      default:
        g.fillStyle = pal[1]; g.beginPath(); g.ellipse(e.x, e.y - 10, e.r * (0.5 + k), e.r * 0.7 * (0.5 + k), 0, 0, TAU); g.fill();
    }
    g.restore();
  }

  drawSlash(g, e) {
    const k = e.t / e.dur;
    const half = (e.arc * Math.PI) / 360;
    g.save();
    g.translate(e.x, e.y - 20);
    g.globalAlpha = 1 - k;
    if (e.sprite === 'vine') {
      g.strokeStyle = '#3d9a2c'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(0, 0);
      g.quadraticCurveTo(Math.cos(e.angle + 0.4) * e.reach * 0.5, Math.sin(e.angle + 0.4) * e.reach * 0.5, Math.cos(e.angle) * e.reach, Math.sin(e.angle) * e.reach);
      g.stroke();
    } else {
      const start = e.angle - half + (half * 2) * Math.max(0, k - 0.3);
      const end = e.angle - half + half * 2 * Math.min(1, k * 2);
      g.strokeStyle = '#ffffff'; g.lineWidth = 7;
      g.beginPath(); g.arc(0, 0, e.reach * 0.8, start, end); g.stroke();
      g.strokeStyle = TYPE_COLOR[e.type]; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, e.reach * 0.8 - 5, start, end); g.stroke();
    }
    g.restore();
  }

  drawShock(g, e) {
    const k = e.t / e.dur;
    const pal = palette(e.type);
    g.globalAlpha = 1 - k;
    if (e.explosion) {
      g.fillStyle = pal[2]; g.beginPath(); g.ellipse(e.x, e.y, e.r * (0.4 + k * 0.7), e.r * 0.7 * (0.4 + k * 0.7), 0, 0, TAU); g.fill();
      g.fillStyle = pal[0]; g.beginPath(); g.ellipse(e.x, e.y, e.r * 0.4 * (1 - k), e.r * 0.3 * (1 - k), 0, 0, TAU); g.fill();
    } else {
      g.strokeStyle = pal[1]; g.lineWidth = 6;
      g.beginPath(); g.ellipse(e.x, e.y, e.r * (0.3 + k * 0.7), e.r * 0.72 * (0.3 + k * 0.7), 0, 0, TAU); g.stroke();
    }
    g.globalAlpha = 1;
  }

  drawGaze(g, e) {
    const o = e.owner;
    g.globalAlpha = 0.25 * (1 - e.t / e.dur);
    g.fillStyle = TYPE_COLOR[e.type];
    g.beginPath(); g.moveTo(o.x, o.y - 25); g.arc(o.x, o.y - 25, e.range, e.angle - e.half, e.angle + e.half); g.closePath(); g.fill();
    g.globalAlpha = 1;
  }

  drawAura(g, e) {
    const m = e.mon;
    const k = e.t / e.dur;
    g.strokeStyle = TYPE_COLOR[e.type];
    g.globalAlpha = 1 - k;
    g.lineWidth = 3;
    g.beginPath(); g.ellipse(m.x, m.y - 4 - k * 40, m.radius * (1 + k), m.radius * 0.4 * (1 + k), 0, 0, TAU); g.stroke();
    g.globalAlpha = 1;
  }

  drawSteam(g, z) {
    const a = Math.min(1, z.t / 0.8) * 0.55;
    g.fillStyle = `rgba(240,245,250,${a})`;
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * TAU + this.time * 0.6;
      g.beginPath(); g.arc(z.x + Math.cos(ang) * z.r * 0.5, z.y - 20 + Math.sin(ang) * z.r * 0.3, z.r * 0.45, 0, TAU); g.fill();
    }
  }

  drawBolt(g, bo) {
    g.strokeStyle = '#fff7b0';
    g.lineWidth = 5;
    g.globalAlpha = 1 - bo.t / 0.3;
    g.beginPath();
    let x = bo.x, y = 0;
    g.moveTo(x, y);
    while (y < bo.y) { y += 30; x += (Math.random() - 0.5) * 30; g.lineTo(x, Math.min(y, bo.y)); }
    g.stroke();
    g.globalAlpha = 1;
  }

  // ------------------------------------------------------------ clima
  drawWeather(g, b, dt) {
    const w = b.field.weather?.id;
    const parts = this.weatherParts;
    const spawn = (n, make) => { for (let i = 0; i < n; i++) if (parts.length < 400) parts.push(make()); };
    if (w === 'raindance' || w === 'primordialsea' || b.field.storm > 0) spawn(w === 'primordialsea' ? 10 : 5, () => ({ k: 'rain', x: Math.random() * WORLD_W + 100, y: -10, vx: -160, vy: 900, life: 0.8 }));
    if (w === 'sandstorm') spawn(5, () => ({ k: 'sand', x: -10, y: Math.random() * WORLD_H, vx: 500 + Math.random() * 200, vy: 40, life: 2.2 }));
    if (w === 'hail') spawn(3, () => ({ k: 'hail', x: Math.random() * WORLD_W, y: -10, vx: -60, vy: 500, life: 1.2 }));
    if (w === 'snow') spawn(3, () => ({ k: 'snow', x: Math.random() * WORLD_W, y: -10, vx: -30 + Math.random() * 60, vy: 90 + Math.random() * 40, life: 6 }));
    for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    this.weatherParts = parts.filter(p => p.life > 0 && p.y < WORLD_H + 20);
    if (w === 'sunnyday' || w === 'desolateland') {
      const ext = w === 'desolateland';
      const grad = g.createRadialGradient(80, 0, 20, 80, 0, 700);
      grad.addColorStop(0, ext ? 'rgba(255,170,60,0.45)' : 'rgba(255,240,150,0.35)');
      grad.addColorStop(1, 'rgba(255,200,80,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, WORLD_W, WORLD_H);
      g.fillStyle = ext ? 'rgba(255,120,30,0.08)' : 'rgba(255,230,120,0.06)';
      for (let i = 0; i < 5; i++) {
        g.save(); g.translate(80, 0); g.rotate(0.3 + i * 0.22 + Math.sin(this.time * 0.5 + i) * 0.02);
        g.fillRect(0, -10, 1100, 26); g.restore();
      }
    }
    if (w === 'raindance' || w === 'primordialsea' || b.field.storm > 0) {
      g.fillStyle = w === 'primordialsea' || b.field.storm > 0 ? 'rgba(20,30,70,0.28)' : 'rgba(30,50,90,0.15)';
      g.fillRect(0, 0, WORLD_W, WORLD_H);
    }
    if (w === 'sandstorm') { g.fillStyle = 'rgba(200,160,80,0.22)'; g.fillRect(0, 0, WORLD_W, WORLD_H); }
    if (w === 'hail' || w === 'snow') { g.fillStyle = 'rgba(220,240,255,0.12)'; g.fillRect(0, 0, WORLD_W, WORLD_H); }
    for (const p of this.weatherParts) {
      if (p.k === 'rain') { g.strokeStyle = 'rgba(180,210,255,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - 4, p.y + 14); g.stroke(); }
      else if (p.k === 'sand') { g.fillStyle = 'rgba(160,120,60,0.7)'; g.fillRect(p.x, p.y, 3, 2); }
      else if (p.k === 'hail') { g.fillStyle = '#f2fbff'; g.fillRect(p.x, p.y, 4, 4); }
      else { g.fillStyle = '#ffffff'; g.fillRect(p.x + Math.sin(p.y / 20) * 6, p.y, 3, 3); }
    }
    if (b.field.storm > 0 && Math.random() < 0.004) { this.fx.flash = 0.25; this.fx.flashColor = '#cfd8ff'; }
  }

  drawTexts(g, b) {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const t of this.fx.texts) {
      const a = Math.min(1, (t.life - t.t) / 0.3);
      g.globalAlpha = a;
      g.font = `${t.big ? 11 : 9}px "Press Start 2P", monospace`;
      g.lineWidth = 3;
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
      g.font = '8px "Press Start 2P", monospace';
      const w = g.measureText(l.text).width + 10;
      const top = m.y - 95 - (m.hover || 0);
      g.fillStyle = 'rgba(16,18,40,0.85)';
      g.fillRect(m.x - w / 2, top - 8, w, 15);
      g.fillStyle = m.side === 0 ? '#ffb3a8' : '#a8c8ff';
      g.fillText(l.text, m.x, top);
    }
    g.globalAlpha = 1;
  }

  // ------------------------------------------------------------ animações especiais (no mundo)
  drawCinematicWorld(g, b) {
    const c = b.cinematic;
    if (b.clash) {
      const cl = b.clash;
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, 0, WORLD_W, WORLD_H);
      for (const beam of [cl.a, cl.b]) this.drawBeam(g, beam, b);
      const r = 26 + Math.sin(this.time * 30) * 6;
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(cl.x, cl.y, r, 0, TAU); g.fill();
      g.strokeStyle = TYPE_COLOR[cl.a.type]; g.lineWidth = 4;
      g.beginPath(); g.arc(cl.x, cl.y, r + 8, Math.PI / 2, (Math.PI * 3) / 2); g.stroke();
      g.strokeStyle = TYPE_COLOR[cl.b.type];
      g.beginPath(); g.arc(cl.x, cl.y, r + 8, -Math.PI / 2, Math.PI / 2); g.stroke();
      for (let i = 0; i < 3; i++) { this.fx.trail(cl.x, cl.y, cl.a.type, 40, 4); this.fx.trail(cl.x, cl.y, cl.b.type, 40, 4); }
      this.fx.shake = Math.max(this.fx.shake, 3);
    }
    if (!c) return;
    if (c.type === 'mega' || c.type === 'megaclash') {
      const k = c.t / c.dur;
      g.fillStyle = `rgba(10,0,30,${0.55 * Math.min(1, c.t * 3)})`;
      g.fillRect(0, 0, WORLD_W, WORLD_H);
      for (const i of c.sides) {
        const m = b.sides[i].active;
        if (!m) continue;
        const r = 20 + k * 90;
        const hue = (this.time * 300 + i * 180) % 360;
        g.strokeStyle = `hsl(${hue},100%,70%)`;
        g.lineWidth = 4;
        g.beginPath(); g.arc(m.x, m.y - 30, r, 0, TAU); g.stroke();
        g.fillStyle = `hsla(${hue},100%,85%,${0.25 + k * 0.5})`;
        g.beginPath(); g.arc(m.x, m.y - 30, r * 0.8, 0, TAU); g.fill();
        // símbolo da Mega Evolução girando
        g.save();
        g.translate(m.x, m.y - 30);
        g.rotate(this.time * 3);
        g.strokeStyle = '#fff'; g.lineWidth = 3;
        g.beginPath(); g.arc(0, 0, 18, 0.3, Math.PI - 0.3); g.stroke();
        g.beginPath(); g.arc(0, 0, 18, Math.PI + 0.3, TAU - 0.3); g.stroke();
        g.restore();
        this.drawMon(g, b, m);
        if (Math.random() < 0.8) this.fx.trail(m.x + (Math.random() - 0.5) * r * 2, m.y - 30 + (Math.random() - 0.5) * r * 2, ['Fire', 'Water', 'Grass', 'Psychic', 'Electric', 'Ice'][Math.floor(Math.random() * 6)], 6, 4);
      }
      if (c.type === 'megaclash' && c.sides.length === 2) {
        const [m1, m2] = c.sides.map(i => b.sides[i].active);
        if (m1 && m2) {
          g.strokeStyle = `rgba(255,255,255,${0.5 + Math.random() * 0.5})`;
          g.lineWidth = 3;
          g.beginPath(); g.moveTo(m1.x, m1.y - 30);
          for (let i = 1; i <= 8; i++) g.lineTo(m1.x + ((m2.x - m1.x) * i) / 8 + (Math.random() - 0.5) * 30, m1.y - 30 + ((m2.y - m1.y) * i) / 8 + (Math.random() - 0.5) * 30);
          g.stroke();
        }
      }
    }
  }
}

// Treinador em pixel art, feito por código
const TRAINER = [
  '....kkkk....',
  '..kkcccckk..',
  '.kccccccccck',
  '.kvvvvvvvvk.',
  '..kssssssk..',
  '..kskssksk..',
  '..kssssssk..',
  '...kssssk...',
  '..kjjjjjjk..',
  '.kjjjwwjjjk.',
  'kjkjjwwjjkjk',
  'ksk.jjjj.ksk',
  'kgkjjjjjjkgk',
  '.k.kjjjjk.k.',
  '...kppppk...',
  '...kpkkpk...',
  '...kpk.kpk..',
  '...kpk.kpk..',
  '..kbbk.kbbk.',
  '..kkkk.kkkk.',
];
const TRAINER_COLORS = [
  { k: '#1b1b24', c: '#e8433f', v: '#9c1f1c', s: '#f1c27d', j: '#e8433f', w: '#ffffff', p: '#2f3b6b', b: '#3a2a20', g: '#262626' },
  { k: '#1b1b24', c: '#3f7fe8', v: '#1d3f8a', s: '#e0ac69', j: '#28a07a', w: '#ffffff', p: '#2b2b33', b: '#3a2a20', g: '#262626' },
];

function drawTrainer(g, x, y, side, pose, t, megaReady) {
  const px = 3;
  const cols = TRAINER_COLORS[side];
  const w = TRAINER[0].length * px, h = TRAINER.length * px;
  const ox = Math.round(x - w / 2), oy = Math.round(y - h + (pose === 'idle' ? Math.round(Math.sin(t * 2 + side) * 1) : 0));
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath(); g.ellipse(x, y, 16, 5, 0, 0, Math.PI * 2); g.fill();
  for (let r = 0; r < TRAINER.length; r++) {
    for (let c = 0; c < TRAINER[r].length; c++) {
      const ch = TRAINER[r][c];
      if (ch === '.') continue;
      g.fillStyle = cols[ch] || '#f0f';
      const cc = side === 1 ? TRAINER[r].length - 1 - c : c;
      g.fillRect(ox + cc * px, oy + r * px, px, px);
    }
  }
  // braço levantado (Mega, comando, lançar Poké Ball)
  if (pose !== 'idle') {
    const dir = side === 0 ? 1 : -1;
    const sx = x + dir * 16, sy = oy + 30;
    g.fillStyle = cols.j;
    g.fillRect(sx - 3, sy - (pose === 'mega' ? 22 : 12), 6, pose === 'mega' ? 22 : 12);
    g.fillStyle = cols.s;
    g.fillRect(sx - 3, sy - (pose === 'mega' ? 27 : 17), 6, 5);
    if (pose === 'mega') {
      g.fillStyle = `hsl(${(t * 400) % 360},100%,70%)`;
      g.beginPath(); g.arc(sx, sy - 30, 6 + Math.sin(t * 20) * 2, 0, Math.PI * 2); g.fill();
    }
  }
  // Pedra-chave brilhando quando a Mega está pronta
  if (megaReady) {
    const kx = x + (side === 0 ? 14 : -14), ky = oy + 38;
    g.fillStyle = `hsla(${(t * 300) % 360},100%,70%,${0.6 + 0.4 * Math.sin(t * 8)})`;
    g.beginPath(); g.arc(kx, ky, 5, 0, Math.PI * 2); g.fill();
  }
}

export { SIDE_COLOR, displayName };
