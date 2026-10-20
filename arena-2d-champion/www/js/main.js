// Ponto de entrada: carrega tudo, guarda times e opções, e roda o loop da batalha.
import { Battle } from './engine/battle.js';
import { DT } from './engine/constants.js';
import { SpriteBank } from './render/sprites.js';
import { Renderer } from './render/renderer.js';
import { Controls } from './input.js';
import { Sound } from './audio.js';
import { BASE_SPECIES } from './data/dex.js';
import * as UI from './ui/menus.js';

const STORE = 'arena2d.v1';

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(`${STORE}.${key}`)); return v ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(`${STORE}.${key}`, JSON.stringify(value)); } catch { /* armazenamento indisponível */ }
}

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    this.sound = new Sound();
    this.bank = new SpriteBank();
    this.controls = new Controls(this.canvas);
    this.renderer = null;
    this.mode = '1p';
    this.arena = load('arena', 'grass');
    this.difficulty = load('difficulty', 'normal');
    this.rivalMode = load('rivalMode', 'random');
    this.timeLimit = load('timeLimit', 240);
    this.settings = { music: 0.25, sfx: 0.6, vibrate: true, log: true, touchHints: true, ...load('settings', {}) };
    this.teams = [load('team0', null) || BASE_SPECIES.slice(0, 3).map(sp => UI.defaultSet(sp)), load('team1', null) || UI.randomTeam(3)];
    this.battle = null;
    this.paused = false;
    this.acc = 0;
    this.last = performance.now();
    this.resultTimer = 0;
    this.controls.onPause = () => this.pause();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.battle && !this.battle.over) this.pause(); });
    // o áudio só pode começar depois de um toque
    // Botão "voltar" do Android: pausa a batalha ou volta ao menu (no menu inicial, sai do app)
    history.pushState({ arena: 1 }, '');
    window.addEventListener('popstate', () => {
      if (this.onBack()) history.pushState({ arena: 1 }, '');
    });
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
    if (this.battle) { this.stopBattle(); UI.showTitle(this); return true; }
    if (document.querySelector('.title')) return false;
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
  saveTeams() { save('team0', this.teams[0]); save('team1', this.teams[1]); }

  rivalTeam() {
    if (this.mode === '2p') return this.teams[1];
    if (this.rivalMode === 'mirror') return JSON.parse(JSON.stringify(this.teams[0]));
    if (this.rivalMode === 'presets') return BASE_SPECIES.slice(1, 4).map(sp => UI.defaultSet(sp, 1));
    return UI.randomTeam(Math.max(1, this.teams[0].length));
  }

  startBattle() {
    save('arena', this.arena); save('difficulty', this.difficulty); save('rivalMode', this.rivalMode); save('timeLimit', this.timeLimit);
    const humans = this.mode === '2p' ? [true, true] : [true, false];
    const names = this.mode === '2p' ? ['Jogador 1', 'Jogador 2'] : ['Você', 'Rival'];
    const teams = [this.teams[0], this.rivalTeam()].map(t => JSON.parse(JSON.stringify(t)));
    this.battle = new Battle({ teams, names, cpu: humans.map(x => !x), difficulty: this.difficulty, arena: this.arena, timeLimit: this.timeLimit });
    this.controls.setup(this.mode, humans, teams.map(t => t.length));
    this.controls.resize(window.innerWidth, window.innerHeight);
    this.controls.enabled = true;
    this.renderer.setBattle(this.battle);
    this.renderer.humans = humans;
    this.humans = humans;
    this.paused = false;
    this.resultTimer = 0;
    this.choiceShown = false;
    this.acc = 0;
    UI.clearUi();
    this.sound.playMusic('battle');
    this.tryFullscreen();
  }

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
    this.stopBattle();
    UI.showTitle(this);
  }

  stopBattle() {
    this.battle = null;
    this.paused = false;
    this.controls.enabled = false;
    if (this.renderer) this.renderer.battle = null;
  }

  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    const b = this.battle;
    if (b && !this.paused) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= DT && steps < 5) {
        this.controls.poll(b);
        b.step(DT);
        this.acc -= DT;
        steps++;
      }
      if (b.choice && this.humans[b.choice.side] && !this.choiceShown) { this.choiceShown = true; UI.showChoice(this, b); }
      if (!b.choice) this.choiceShown = false;
      if (b.over) {
        this.resultTimer += dt;
        if (this.resultTimer > 3 && !this.resultShown) { this.resultShown = true; this.controls.enabled = false; UI.showResult(this, b); }
      } else this.resultShown = false;
    }
    if (this.renderer) {
      if (b) this.renderer.frame(dt, { controls: this.controls, humans: this.humans, showLog: this.settings.log, touchHints: this.settings.touchHints });
      else this.renderer.frame(dt, { controls: this.controls, humans: [false, false] });
    }
    requestAnimationFrame(tt => this.loop(tt));
  }
}

const app = new App();
window.arenaApp = app;
app.init();
