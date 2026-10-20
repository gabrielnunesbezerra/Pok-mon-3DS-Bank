// Ponto de entrada: carrega tudo, guarda times e opções, e roda o loop da batalha.
import { Battle } from './engine/battle.js';
import { DT } from './engine/constants.js';
import { SpriteBank } from './render/sprites.js';
import { Renderer } from './render/renderer.js';
import { Controls } from './input.js';
import { Sound } from './audio.js';
import { BASE_SPECIES } from './data/dex.js';
import { TRAINER_DATA } from './data/sprites.js';
import { OnlineSession } from './net/online.js';
import * as UI from './ui/menus.js';

const STORE = 'arena2d.v1';

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(`${STORE}.${key}`)); return v ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(`${STORE}.${key}`, JSON.stringify(value)); } catch { /* armazenamento indisponível */ }
}

const trainerName = id => TRAINER_DATA[id]?.name || 'Treinador';
const ONLINE_TIMEOUT = 20; // segundos sem notícias do outro aparelho até encerrar a sala

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    this.sound = new Sound();
    this.bank = new SpriteBank();
    this.controls = new Controls(this.canvas);
    this.renderer = null;
    this.mode = '1p';
    this.difficulty = load('difficulty', 'normal');
    this.rivalMode = load('rivalMode', 'random');
    this.timeLimit = load('timeLimit', 240);
    this.trainerPick = [load('trainer0', 'red'), load('trainer1', 'random')];
    this.settings = { music: 0.25, sfx: 0.6, vibrate: true, log: true, touchHints: true, ...load('settings', {}) };
    this.teams = [load('team0', null) || BASE_SPECIES.slice(0, 3).map(sp => UI.defaultSet(sp))];
    this.battle = null;
    this.paused = false;
    this.acc = 0;
    this.last = performance.now();
    this.resultTimer = 0;
    this.online = null; // sessão online aberta
    this.lockstep = null;
    this.stallFor = 0;
    this.controls.onPause = () => this.pause();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.battle && !this.battle.over) this.pause(); });
    // Botão "voltar" do Android: pausa a batalha ou volta ao menu (no menu inicial, sai do app)
    history.pushState({ arena: 1 }, '');
    window.addEventListener('popstate', () => {
      if (this.onBack()) history.pushState({ arena: 1 }, '');
    });
    // o áudio só pode começar depois de um toque
    const unlock = () => { this.sound.unlock(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  async init() {
    const progress = UI.showLoading();
    try { await document.fonts?.load('10px "Press Start 2P"'); } catch { /* segue sem esperar a fonte */ }
    await this.bank.load(progress);
    this.renderer = new Renderer(this.canvas, this.bank, this.sound);
    this.applySettings();
    this.resize();
    UI.showTitle(this);
    requestAnimationFrame(t => this.loop(t));
  }

  onBack() {
    if (this.battle && !this.battle.over) {
      if (this.paused) this.resume(); else this.pause();
      return true;
    }
    if (this.battle) { this.onlineClose(); this.stopBattle(); UI.showTitle(this); return true; }
    if (document.querySelector('.title')) return false;
    this.onlineClose();
    UI.showTitle(this);
    return true;
  }

  resize() {
    this.renderer?.resize();
    this.controls.resize(window.innerWidth, window.innerHeight);
  }

  applySettings() {
    const s = this.settings;
    this.sound.musicVol = s.music;
    this.sound.sfxVol = s.sfx;
    this.sound.applyVolumes();
    if (this.renderer) this.renderer.vibrate = s.vibrate;
  }
  saveSettings() { save('settings', this.settings); }
  saveTeams() { save('team0', this.teams[0]); }

  rivalTeam() {
    if (this.rivalMode === 'mirror') return JSON.parse(JSON.stringify(this.teams[0]));
    if (this.rivalMode === 'presets') return BASE_SPECIES.slice(1, 4).map(sp => UI.defaultSet(sp, 1));
    return UI.randomTeam(Math.max(1, this.teams[0].length));
  }

  resolveTrainers() {
    const t0 = this.trainerPick[0] === 'random' || !TRAINER_DATA[this.trainerPick[0]] ? UI.randomTrainer() : this.trainerPick[0];
    const t1 = this.trainerPick[1] === 'random' || !TRAINER_DATA[this.trainerPick[1]] ? UI.randomTrainer(t0) : this.trainerPick[1];
    return [t0, t1];
  }

  sideNames(trainers) {
    const names = trainers.map(trainerName);
    if (names[0] === names[1]) names[1] += ' 2';
    return names;
  }

  startBattle() {
    save('difficulty', this.difficulty); save('rivalMode', this.rivalMode); save('timeLimit', this.timeLimit);
    save('trainer0', this.trainerPick[0]); save('trainer1', this.trainerPick[1]);
    const humans = [true, false];
    const trainers = this.resolveTrainers();
    const teams = [this.teams[0], this.rivalTeam()].map(t => JSON.parse(JSON.stringify(t)));
    const battle = new Battle({ teams, names: this.sideNames(trainers), cpu: humans.map(x => !x), difficulty: this.difficulty, timeLimit: this.timeLimit });
    this.beginBattle(battle, { humans, trainers, me: 0 });
  }

  beginBattle(battle, { humans, trainers, me }) {
    this.battle = battle;
    this.controls.setup(humans, battle.sides.map(s => s.mons.length), me);
    this.controls.resize(window.innerWidth, window.innerHeight);
    this.controls.enabled = true;
    this.renderer.setBattle(battle, { trainers, humans });
    this.humans = humans;
    this.paused = false;
    this.resultTimer = 0;
    this.resultShown = false;
    this.choiceShown = false;
    this.rematchAsked = false;
    this.stallFor = 0;
    this.acc = 0;
    UI.clearUi();
    this.sound.playMusic('battle');
    this.tryFullscreen();
  }

  // ------------------------------------------------------------ online
  onlineCallbacks(cb) {
    return {
      ...cb,
      timeLimit: () => this.timeLimit,
      start: cfg => this.startOnline(cfg),
      rematchAsked: () => { this.rematchAsked = true; if (this.resultShown) UI.showResult(this, this.battle); },
    };
  }

  async onlineCreate(cb) {
    this.onlineClose();
    save('trainer0', this.trainerPick[0]); save('timeLimit', this.timeLimit);
    this.online = new OnlineSession(this.onlineCallbacks(cb));
    return this.online.create(this.onlineMine());
  }

  async onlineJoin(code, cb) {
    this.onlineClose();
    save('trainer0', this.trainerPick[0]);
    this.online = new OnlineSession(this.onlineCallbacks(cb));
    return this.online.join(code, this.onlineMine());
  }

  onlineMine() {
    const trainer = this.trainerPick[0] === 'random' ? UI.randomTrainer() : this.trainerPick[0];
    return { team: JSON.parse(JSON.stringify(this.teams[0])), trainer };
  }

  onlineError(e) {
    const known = { 'peer-unavailable': 'Sala não encontrada. Confira o código.', network: 'Sem conexão com o servidor de salas.', 'browser-incompatible': 'Este aparelho não suporta conexão direta (WebRTC).' };
    return known[e?.type] || (e?.message?.includes('PeerJS') ? 'Não deu para carregar o módulo online.' : 'Não deu para conectar. Verifique a internet e tente de novo.');
  }

  onlineClose() {
    if (this.online) this.online.close();
    this.online = null;
    this.lockstep = null;
  }

  startOnline(cfg) {
    this.mode = 'online';
    const humans = [cfg.me === 0, cfg.me === 1];
    const battle = new Battle({ teams: cfg.teams, names: this.sideNames(cfg.trainers), cpu: [false, false], seed: cfg.seed, timeLimit: cfg.timeLimit });
    this.lockstep = this.online.startLockstep(battle, cfg.me, cfg.delay);
    this.me = cfg.me;
    this.beginBattle(battle, { humans, trainers: cfg.trainers, me: cfg.me });
  }

  onlineRematch() {
    this.online?.askRematch();
  }

  onlineLeft(text) {
    const b = this.battle;
    const mid = b && !b.over && this.lockstep;
    this.online = null;
    this.lockstep = null;
    if (mid) {
      this.stopBattle();
      UI.showNotice(this, 'VITÓRIA POR W.O.', text, () => UI.showTitle(this));
    } else if (b) {
      this.stopBattle();
      UI.showNotice(this, 'FIM DA SALA', text, () => UI.showTitle(this));
    } else {
      UI.showNotice(this, 'SALA FECHADA', text, () => UI.showOnline(this));
    }
  }

  // ------------------------------------------------------------ batalha
  tryFullscreen() {
    if (window.Capacitor?.isNativePlatform?.()) return;
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen && matchMedia('(pointer: coarse)').matches) {
      el.requestFullscreen().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
    }
  }

  pause() {
    if (!this.battle || this.battle.over || this.paused) return;
    this.paused = true;
    this.controls.enabled = false;
    UI.showPause(this);
  }

  resume() {
    this.paused = false;
    this.controls.enabled = true;
    this.last = performance.now();
    this.choiceShown = false; // se a pausa cobriu a escolha de Pokémon, ela aparece de novo
    UI.clearUi();
  }

  quit() {
    this.onlineClose();
    this.stopBattle();
    UI.showTitle(this);
  }

  stopBattle() {
    this.battle = null;
    this.paused = false;
    this.controls.enabled = false;
    if (this.renderer) this.renderer.battle = null;
  }

  // passos fixos de 1/60 s; no online, cada passo espera o comando do outro aparelho
  simulate(b, dt) {
    if (this.lockstep) {
      const ls = this.lockstep;
      this.acc = Math.min(this.acc + dt, DT * 12);
      let steps = 0;
      while (this.acc >= DT && steps < 6) {
        ls.schedule(local => this.controls.poll(b, [local, local]));
        if (!ls.ready()) break;
        ls.advance(DT);
        this.acc -= DT;
        steps++;
      }
      this.stallFor = steps === 0 && this.acc >= DT ? this.stallFor + dt : 0;
      if (this.online && this.online.silence() > ONLINE_TIMEOUT * 1000) this.online.peerLeft('O outro jogador parou de responder.');
      return;
    }
    if (this.paused) return;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= DT && steps < 5) {
      this.controls.poll(b);
      b.step(DT);
      this.acc -= DT;
      steps++;
    }
  }

  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    const b = this.battle;
    if (b) {
      this.simulate(b, dt);
      if (b.choice && this.humans[b.choice.side] && !this.choiceShown && !this.paused) { this.choiceShown = true; UI.showChoice(this, b); }
      if (!b.choice) this.choiceShown = false;
      if (b.over) {
        this.resultTimer += dt;
        if (this.resultTimer > 3 && !this.resultShown) { this.resultShown = true; this.controls.enabled = false; UI.showResult(this, b); }
      }
    }
    if (this.renderer) {
      const left = this.online ? Math.ceil(ONLINE_TIMEOUT - this.online.silence() / 1000) : 0;
      const net = this.lockstep && this.online ? { ping: this.online.ping, waiting: this.stallFor > 0.5 ? `Esperando o outro jogador... ${Math.max(0, left)}s` : null } : null;
      if (b) this.renderer.frame(dt, { controls: this.controls, humans: this.humans, showLog: this.settings.log, touchHints: this.settings.touchHints, net });
      else this.renderer.frame(dt, { controls: this.controls, humans: [false, false] });
    }
    requestAnimationFrame(tt => this.loop(tt));
  }
}

const app = new App();
window.arenaApp = app;
app.init();
