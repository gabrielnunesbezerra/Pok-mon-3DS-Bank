// Animações próprias de cada golpe, desenhadas na camada em pixel art:
// - impacto no alvo dos golpes corpo a corpo (soco, chute, mordida, garra, chifre, cabeçada, asa...)
// - o que acontece em volta de quem usa golpes de status (Swords Dance, Calm Mind, Recover...)
// - golpes de status que pegam o alvo (Taunt, Trick, Encore...)
// Cada família tem a sua forma e cada golpe muda o detalhe (o Fire Punch pega fogo, o Ice Fang tem
// dentes de gelo), em vez de ser o mesmo desenho com outra cor.
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- tabelas
const C = {
  fire: ['#fff3a0', '#ffb030', '#f05a1a', '#a8240e'],
  ice: ['#ffffff', '#c8f4ff', '#78d6f0', '#3f9ec8'],
  elec: ['#ffffff', '#fff27a', '#ffd000', '#c08a00'],
  drain: ['#eaffc8', '#9be86a', '#4cb83a', '#2c7a24'],
  steel: ['#ffffff', '#e2e6f0', '#aab2c8', '#6a7290'],
  dark: ['#d8c8bb', '#7a5a4a', '#4a3428', '#22160f'],
  ghost: ['#f0e0ff', '#b48ae8', '#7550b8', '#3c2468'],
  psy: ['#ffe0f0', '#ff9cc8', '#f0508a', '#a81e58'],
  poison: ['#f6d8ff', '#c27ae0', '#9b3fbf', '#5e1a7c'],
  bug: ['#f0ffb0', '#c8e04a', '#8aa81a', '#56700c'],
  water: ['#ffffff', '#a8e4ff', '#4aa3f0', '#2464c0'],
  dragon: ['#e8dcff', '#a588ff', '#6f35fc', '#3a17a8'],
  fairy: ['#fff4fa', '#ffc8e4', '#f08cc8', '#c2588f'],
  rock: ['#efe4bc', '#c9b469', '#a08436', '#5e4a1a'],
  ground: ['#f4dfa3', '#d9b366', '#a8803c', '#6a4e22'],
  grass: ['#e4ffb0', '#8be04e', '#4caf38', '#25701c'],
  fight: ['#fff1c9', '#ffb36b', '#e0623a', '#93281c'],
  normal: ['#ffffff', '#f4f0d8', '#cfc9a0', '#8a8462'],
  flying: ['#ffffff', '#e4f2ff', '#a8c8f0', '#6a8ac8'],
  blue: ['#ffffff', '#b8e0ff', '#4a8cff', '#1c3ca8'],
};

// impacto no alvo dos golpes corpo a corpo
export const IMPACT = {
  // socos
  firepunch: { k: 'fist', el: 'fire' }, icepunch: { k: 'fist', el: 'ice' }, thunderpunch: { k: 'fist', el: 'elec' },
  drainpunch: { k: 'fist', el: 'drain' }, bulletpunch: { k: 'fist', el: 'steel', n: 3 }, machpunch: { k: 'fist', el: 'normal', n: 2 },
  focuspunch: { k: 'fist', el: 'fight', big: true }, dynamicpunch: { k: 'fist', el: 'fight', big: true, boom: true },
  poweruppunch: { k: 'fist', el: 'fight', up: true }, meteormash: { k: 'fist', el: 'steel', star: true }, shadowpunch: { k: 'fist', el: 'ghost' },
  suckerpunch: { k: 'fist', el: 'dark', sneak: true }, assurance: { k: 'fist', el: 'dark' }, revenge: { k: 'fist', el: 'fight' },
  skyuppercut: { k: 'upper', el: 'fight' }, brickbreak: { k: 'chop', el: 'fight' }, forcepalm: { k: 'palm', el: 'fight' },
  upperhand: { k: 'palm', el: 'fight' }, closecombat: { k: 'flurry', el: 'fight' }, superpower: { k: 'flurry', el: 'fight', big: true },
  // chutes e pisadas
  highjumpkick: { k: 'kick', el: 'fight', big: true }, lowkick: { k: 'kick', el: 'fight', low: true }, blazekick: { k: 'kick', el: 'fire' },
  tripleaxel: { k: 'kick', el: 'ice', n: 3 }, stomp: { k: 'stomp', el: 'normal' }, heavyslam: { k: 'stomp', el: 'steel', big: true },
  heatcrash: { k: 'stomp', el: 'fire', big: true }, bodypress: { k: 'stomp', el: 'fight', big: true },
  // mordidas
  bite: { k: 'bite', el: 'dark' }, crunch: { k: 'bite', el: 'dark', big: true }, firefang: { k: 'bite', el: 'fire' },
  icefang: { k: 'bite', el: 'ice' }, thunderfang: { k: 'bite', el: 'elec' }, psychicfangs: { k: 'bite', el: 'psy' },
  superfang: { k: 'bite', el: 'normal', buck: true }, bugbite: { k: 'mandible', el: 'bug' },
  // garras
  dragonclaw: { k: 'claw', el: 'dragon' }, shadowclaw: { k: 'claw', el: 'ghost' }, crushclaw: { k: 'claw', el: 'normal', big: true },
  honeclaws: null,
  // chifre, ferrão, bico
  megahorn: { k: 'horn', el: 'bug' }, drillrun: { k: 'drill', el: 'ground' }, highhorsepower: { k: 'stomp', el: 'ground' },
  poisonjab: { k: 'jab', el: 'poison' }, pluck: { k: 'peck', el: 'flying' }, rockclimb: { k: 'stomp', el: 'rock' },
  // cabeçadas e investidas de corpo
  zenheadbutt: { k: 'head', el: 'psy' }, ironhead: { k: 'head', el: 'steel' }, headsmash: { k: 'head', el: 'rock', big: true },
  bodyslam: { k: 'slam', el: 'normal' }, doubleedge: { k: 'slam', el: 'normal', recoil: true }, gigaimpact: { k: 'giga', el: 'normal' },
  facade: { k: 'slam', el: 'fire', angry: true }, retaliate: { k: 'slam', el: 'fight', angry: true }, return: { k: 'hearts', el: 'fairy' },
  endeavor: { k: 'slam', el: 'normal' }, chipaway: { k: 'slam', el: 'normal', n: 2 }, flail: { k: 'flurry', el: 'normal' },
  reversal: { k: 'flurry', el: 'fight' }, thrash: { k: 'flurry', el: 'normal', big: true }, struggle: { k: 'slam', el: 'normal' },
  doublehit: { k: 'slam', el: 'normal', n: 2 }, payback: { k: 'slam', el: 'dark', angry: true }, lashout: { k: 'flurry', el: 'dark' },
  foulplay: { k: 'flurry', el: 'dark' }, feintattack: { k: 'jab', el: 'dark' }, pursuit: { k: 'jab', el: 'dark' },
  rapidspin: { k: 'spin', el: 'normal' }, gyroball: { k: 'spin', el: 'steel' }, steelroller: { k: 'spin', el: 'steel' }, icespinner: { k: 'spin', el: 'ice' },
  // asas
  wingattack: { k: 'wing', el: 'flying' }, aerialace: { k: 'wing', el: 'flying', sharp: true }, dualwingbeat: { k: 'wing', el: 'flying', n: 2 },
  bravebird: { k: 'wing', el: 'blue', big: true }, acrobatics: { k: 'wing', el: 'flying', n: 3 }, skyattack: { k: 'wing', el: 'fire', big: true },
  steelwing: { k: 'wing', el: 'steel' },
  // investidas de elemento
  aquajet: { k: 'splash', el: 'water' }, liquidation: { k: 'splash', el: 'water', big: true }, waterfall: { k: 'splash', el: 'water', fall: true },
  wavecrash: { k: 'splash', el: 'water', big: true }, flipturn: { k: 'splash', el: 'water' },
  flareblitz: { k: 'burst', el: 'fire', big: true }, flamecharge: { k: 'burst', el: 'fire' }, temperflare: { k: 'burst', el: 'fire' },
  wildcharge: { k: 'burst', el: 'elec', big: true }, spark: { k: 'burst', el: 'elec' }, dragonrush: { k: 'burst', el: 'dragon', big: true },
  outrage: { k: 'flurry', el: 'dragon', big: true }, trailblaze: { k: 'burst', el: 'grass' },
  // insetos, sombras e outros
  firstimpression: { k: 'mandible', el: 'bug', big: true }, leechlife: { k: 'drain', el: 'bug' }, hornleech: { k: 'drain', el: 'grass' },
  skittersmack: { k: 'jab', el: 'bug' }, uturn: { k: 'jab', el: 'bug' }, knockoff: { k: 'knock', el: 'dark' }, thief: { k: 'knock', el: 'dark', steal: true },
  playrough: { k: 'cloud', el: 'fairy' }, fakeout: { k: 'clap', el: 'normal' }, feint: { k: 'clap', el: 'normal' },
  quickattack: { k: 'speed', el: 'normal' }, extremespeed: { k: 'speed', el: 'normal', big: true },
  seismictoss: { k: 'stomp', el: 'fight', big: true }, circlethrow: { k: 'stomp', el: 'fight' },
};
delete IMPACT.honeclaws;

// em volta de quem usa golpes de status em si mesmo
export const SELF = {
  swordsdance: 'swords', dragondance: 'dragondance', calmmind: 'calmmind', nastyplot: 'nastyplot', bulkup: 'bulkup',
  irondefense: 'irondefense', agility: 'speedup', rockpolish: 'speedup', autotomize: 'speedup', amnesia: 'amnesia', barrier: 'barrier',
  cottonguard: 'cotton', honeclaws: 'honeclaws', workup: 'workup', growth: 'growth', shellsmash: 'shellsmash', bellydrum: 'drum',
  curse: 'curse', recover: 'heal', lifedew: 'dew', roost: 'roost', synthesis: 'sunheal', rest: 'rest', wish: 'wish',
  healingwish: 'wish', reflect: 'wall', lightscreen: 'wall', safeguard: 'dome', tailwind: 'tailwind', magnetrise: 'magnet',
  aquaring: 'aquaring', ingrain: 'roots', destinybond: 'destinybond', batonpass: 'baton', substitute: 'puff', refresh: 'sparkle',
  healbell: 'bell', sleeptalk: 'sparkle', spikes: 'toss', stealthrock: 'toss', toxicspikes: 'toss', futuresight: 'future',
  electricterrain: 'terrain', psychicterrain: 'terrain', mistyterrain: 'terrain', grassyterrain: 'terrain',
  sunnyday: 'weather', raindance: 'weather', sandstorm: 'weather', hail: 'weather', snowscape: 'weather', trickroom: 'room',
  wonderroom: 'room', perishsong: 'notes', haze: 'haze',
};

// golpes de status que acertam o alvo
export const STATUS = {
  taunt: 'taunt', encore: 'encore', trick: 'trick', switcheroo: 'trick', disable: 'lock', torment: 'torment', meanlook: 'eyes',
  spite: 'spite', painsplit: 'painsplit', memento: 'memento', toxic: 'toxic', willowisp: 'burn', thunderwave: 'paralyze',
  sleeppowder: 'sleep', hypnosis: 'sleep', yawn: 'sleep', leechseed: 'seed', charm: 'hearts', roar: 'roar', whirlwind: 'roar',
  defog: 'roar', clearsmog: 'toxic',
};

// ---------------------------------------------------------------- formas básicas
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function starPath(g, x, y, r1, r2, n, rot = 0) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = rot + (i / (n * 2)) * TAU;
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.closePath();
}

function burstStar(g, x, y, r, col, n = 8, rot = 0) {
  starPath(g, x, y, r, r * 0.45, n, rot);
  g.fillStyle = col[1]; g.fill();
  starPath(g, x, y, r * 0.6, r * 0.27, n, rot + 0.2);
  g.fillStyle = col[0]; g.fill();
}

const ease = t => 1 - (1 - t) * (1 - t);

// punho apontando para +x (tamanho s)
function fist(g, s, col) {
  g.fillStyle = col[3];
  rr(g, -s * 0.62, -s * 0.52, s * 1.24, s * 1.04, s * 0.26); g.fill();
  g.fillStyle = col[1];
  rr(g, -s * 0.55, -s * 0.45, s * 1.1, s * 0.9, s * 0.22); g.fill();
  g.fillStyle = col[2];
  for (let i = 0; i < 4; i++) g.fillRect(s * 0.22, -s * 0.42 + i * s * 0.22, s * 0.3, s * 0.06);
  g.fillStyle = col[0];
  g.fillRect(-s * 0.4, -s * 0.38, s * 0.5, s * 0.16);
  g.fillStyle = col[2];
  rr(g, -s * 0.35, s * 0.18, s * 0.5, s * 0.22, s * 0.1); g.fill();
}

function boot(g, s, col) {
  g.fillStyle = col[3];
  rr(g, -s * 0.7, -s * 0.35, s * 1.25, s * 0.7, s * 0.2); g.fill();
  g.fillStyle = col[1];
  rr(g, -s * 0.62, -s * 0.28, s * 1.1, s * 0.56, s * 0.16); g.fill();
  g.fillStyle = col[2];
  g.fillRect(-s * 0.62, s * 0.12, s * 1.1, s * 0.16);
  g.fillStyle = col[0];
  g.fillRect(-s * 0.45, -s * 0.2, s * 0.6, s * 0.1);
}

// partículas do elemento em volta de um ponto
function aura(g, x, y, r, el, t, n = 8) {
  const col = C[el] || C.normal;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + t * 4;
    const d = r * (0.7 + 0.3 * Math.sin(t * 9 + i));
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    g.fillStyle = col[i % 2 ? 1 : 2];
    if (el === 'fire') { g.beginPath(); g.moveTo(px - 4, py + 4); g.quadraticCurveTo(px, py - 12, px + 4, py + 4); g.fill(); }
    else if (el === 'ice') { g.save(); g.translate(px, py); g.rotate(a); g.fillRect(-6, -1.5, 12, 3); g.fillRect(-1.5, -6, 3, 12); g.restore(); }
    else if (el === 'elec') { g.strokeStyle = col[1]; g.lineWidth = 3; g.beginPath(); g.moveTo(px, py - 7); g.lineTo(px + 4, py - 1); g.lineTo(px - 3, py + 1); g.lineTo(px + 2, py + 8); g.stroke(); }
    else if (el === 'drain' || el === 'grass') { g.beginPath(); g.ellipse(px, py, 6, 3, a, 0, TAU); g.fill(); }
    else if (el === 'ghost' || el === 'dark' || el === 'poison') { g.beginPath(); g.arc(px, py, 4 + (i % 3), 0, TAU); g.fill(); }
    else { g.fillRect(px - 2.5, py - 2.5, 5, 5); }
  }
}

// ---------------------------------------------------------------- impacto no alvo
function drawImpact(g, a) {
  const o = a.o;
  const col = C[o.el] || C.normal;
  const t = a.t;
  const big = o.big ? 1.35 : 1;
  const x = a.x, y = a.y;
  const back = { x: -Math.cos(a.dir), y: -Math.sin(a.dir) };
  g.save();
  switch (o.k) {
    case 'fist': case 'upper': case 'palm': case 'chop': {
      const n = o.n || 1;
      for (let i = 0; i < n; i++) {
        const ti = Math.min(1, Math.max(0, (t - i * 0.18) / 0.55));
        if (ti <= 0) continue;
        const off = (i - (n - 1) / 2) * 16;
        const s = 26 * big * (0.7 + 0.5 * Math.sin(Math.min(1, ti * 1.6) * Math.PI / 2));
        const travel = (1 - ease(Math.min(1, ti * 2.2))) * 46;
        g.save();
        let ang = a.dir;
        if (o.k === 'upper') ang = -Math.PI / 2;
        if (o.k === 'chop') ang = Math.PI / 2;
        g.translate(x + back.x * travel - Math.sin(a.dir) * off, y + back.y * travel + Math.cos(a.dir) * off);
        g.rotate(ang);
        if (o.k === 'palm') { g.fillStyle = col[1]; rr(g, -s * 0.4, -s * 0.6, s * 0.8, s * 1.2, s * 0.3); g.fill(); g.fillStyle = col[0]; rr(g, -s * 0.25, -s * 0.45, s * 0.5, s * 0.9, s * 0.2); g.fill(); }
        else if (o.k === 'chop') { g.fillStyle = col[3]; rr(g, -s * 0.9, -s * 0.22, s * 1.8, s * 0.44, s * 0.15); g.fill(); g.fillStyle = col[1]; rr(g, -s * 0.82, -s * 0.15, s * 1.64, s * 0.3, s * 0.1); g.fill(); }
        else fist(g, s, o.sneak ? C.dark : o.el === 'fire' || o.el === 'ice' || o.el === 'elec' || o.el === 'drain' ? C.fight : col);
        g.restore();
        if (ti > 0.35 && ti < 0.8) burstStar(g, x - Math.sin(a.dir) * off, y + Math.cos(a.dir) * off, 18 + 34 * (ti - 0.35) * big, col, o.boom ? 10 : 8, i);
      }
      if (['fire', 'ice', 'elec', 'drain', 'ghost'].includes(o.el)) aura(g, x, y, 34 * big, o.el, t, 10);
      if (o.star && t > 0.3) { g.fillStyle = '#ffe14a'; starPath(g, x, y - 30 * t, 14, 6, 5, t * 6); g.fill(); }
      if (o.up && t > 0.4) { g.fillStyle = '#ff7a3a'; g.beginPath(); g.moveTo(x - 30, y - 10 - 20 * t); g.lineTo(x - 22, y - 26 - 20 * t); g.lineTo(x - 14, y - 10 - 20 * t); g.fill(); }
      if (o.boom && t > 0.4) { g.strokeStyle = col[2]; g.lineWidth = 5; g.beginPath(); g.arc(x, y, 60 * (t - 0.4) * 2.5, 0, TAU); g.stroke(); }
      break;
    }
    case 'flurry': {
      // vários socos e chutes em lugares diferentes
      const hits = o.big ? 7 : 5;
      for (let i = 0; i < hits; i++) {
        const ti = (t * hits * 0.9 - i * 0.6);
        if (ti < 0 || ti > 1) continue;
        const ang = (i * 2.4) % TAU;
        const px = x + Math.cos(ang) * 22, py = y + Math.sin(ang) * 16;
        g.save(); g.translate(px, py); g.rotate(a.dir + (i % 2 ? 0.5 : -0.5));
        if (i % 2) boot(g, 18 * big, o.el === 'dragon' ? C.dragon : C.fight); else fist(g, 18 * big, o.el === 'dragon' ? C.dragon : o.el === 'dark' ? C.dark : C.fight);
        g.restore();
        burstStar(g, px, py, 10 + ti * 16, col, 6, i);
      }
      if (o.el === 'dragon') aura(g, x, y, 40, 'ghost', t, 8);
      break;
    }
    case 'kick': {
      const n = o.n || 1;
      for (let i = 0; i < n; i++) {
        const ti = Math.min(1, Math.max(0, (t - i * 0.2) / 0.6));
        if (ti <= 0) continue;
        const travel = (1 - ease(Math.min(1, ti * 2))) * 50;
        const yy = y + (o.low ? 18 : -6 + i * 10);
        g.save(); g.translate(x + back.x * travel, yy + back.y * travel); g.rotate(a.dir + (o.big ? -0.4 : 0));
        boot(g, 26 * big, o.el === 'ice' ? C.ice : o.el === 'fire' ? C.fire : C.fight);
        g.restore();
        if (ti > 0.4 && ti < 0.85) burstStar(g, x, yy, 16 + 40 * (ti - 0.4) * big, col, 6, i * 0.5);
      }
      if (o.el === 'fire' || o.el === 'ice') aura(g, x, y, 36, o.el, t, 9);
      if (o.low) { g.strokeStyle = C.ground[2]; g.lineWidth = 4; g.beginPath(); g.ellipse(x, y + 22, 40 * t, 10 * t, 0, 0, TAU); g.stroke(); }
      break;
    }
    case 'stomp': {
      // pisada: marca de pé e onda no chão
      const s = 30 * big;
      g.globalAlpha = 1 - t * 0.6;
      g.fillStyle = col[3];
      g.beginPath(); g.ellipse(x, y + 18, s, s * 0.45, 0, 0, TAU); g.fill();
      g.fillStyle = col[2];
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x - s * 0.5 + i * s * 0.5, y + 4, s * 0.18, 0, TAU); g.fill(); }
      g.strokeStyle = col[1]; g.lineWidth = 5;
      g.beginPath(); g.ellipse(x, y + 18, s * (1 + t * 2), s * 0.45 * (1 + t * 2), 0, 0, TAU); g.stroke();
      if (t < 0.6) burstStar(g, x, y - 10, 20 + 30 * t, col, 8);
      for (let i = 0; i < 5; i++) { const ang = (i / 5) * TAU; g.fillStyle = C.rock[i % 2 ? 1 : 3]; g.fillRect(x + Math.cos(ang) * s * 1.6 * t - 3, y + 12 + Math.sin(ang) * s * 0.6 * t - 30 * t * (1 - t) * 4, 6, 6); }
      break;
    }
    case 'bite': case 'mandible': {
      const close = ease(Math.min(1, t / 0.45));
      const s = 30 * big;
      const open = (1 - close) * s * 0.9;
      const jaw = o.k === 'mandible' ? C.bug : o.el === 'dark' ? C.dark : col;
      const tooth = o.el === 'fire' ? '#ffcf5a' : o.el === 'ice' ? '#e8fbff' : o.el === 'elec' ? '#fff27a' : o.el === 'psy' ? '#ffd0e8' : '#ffffff';
      for (const side of [-1, 1]) {
        const yy = y + side * (open + s * 0.12);
        g.fillStyle = jaw[3];
        g.beginPath(); g.ellipse(x, yy + side * s * 0.25, s * 0.9, s * 0.3, 0, side > 0 ? 0 : Math.PI, side > 0 ? Math.PI : TAU); g.fill();
        g.fillStyle = tooth;
        const teeth = o.buck ? 2 : o.k === 'mandible' ? 2 : 5;
        for (let i = 0; i < teeth; i++) {
          const tx = x - s * 0.7 + (i + 0.5) * (s * 1.4) / teeth;
          const tw = o.buck ? s * 0.36 : o.k === 'mandible' ? s * 0.25 : s * 0.16;
          g.beginPath(); g.moveTo(tx - tw, yy); g.lineTo(tx + tw, yy); g.lineTo(tx, yy - side * s * (o.buck ? 0.5 : 0.38)); g.closePath(); g.fill();
        }
      }
      if (t > 0.42) {
        burstStar(g, x, y, 14 + 26 * (t - 0.42), col, 6);
        if (['fire', 'ice', 'elec', 'psy'].includes(o.el)) aura(g, x, y, 34, o.el === 'psy' ? 'psy' : o.el, t, 8);
      }
      break;
    }
    case 'claw': {
      // três riscos de garra aparecendo um depois do outro
      for (let i = 0; i < 3; i++) {
        const ti = Math.min(1, Math.max(0, (t - i * 0.08) / 0.35));
        if (ti <= 0) continue;
        const off = (i - 1) * 14 * big;
        const len = 70 * big;
        g.save(); g.translate(x, y); g.rotate(-0.8);
        g.globalAlpha = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
        g.strokeStyle = col[3]; g.lineWidth = 9;
        g.beginPath(); g.moveTo(-len / 2, off); g.lineTo(-len / 2 + len * ti, off); g.stroke();
        g.strokeStyle = col[1]; g.lineWidth = 4;
        g.beginPath(); g.moveTo(-len / 2, off); g.lineTo(-len / 2 + len * ti, off); g.stroke();
        g.restore();
      }
      if (o.el === 'ghost') aura(g, x, y, 34, 'ghost', t, 6);
      break;
    }
    case 'horn': case 'drill': case 'jab': case 'peck': {
      const ti = ease(Math.min(1, t / 0.4));
      const s = (o.k === 'horn' ? 46 : o.k === 'drill' ? 38 : 28) * big;
      g.save(); g.translate(x + back.x * (1 - ti) * 50, y + back.y * (1 - ti) * 50); g.rotate(a.dir);
      g.fillStyle = col[3];
      g.beginPath(); g.moveTo(s * 0.5, 0); g.lineTo(-s * 0.5, -s * 0.28); g.lineTo(-s * 0.5, s * 0.28); g.closePath(); g.fill();
      g.fillStyle = col[1];
      g.beginPath(); g.moveTo(s * 0.42, 0); g.lineTo(-s * 0.4, -s * 0.18); g.lineTo(-s * 0.4, s * 0.18); g.closePath(); g.fill();
      if (o.k === 'drill') { g.strokeStyle = col[3]; g.lineWidth = 3; for (let i = 0; i < 4; i++) { const xx = -s * 0.35 + i * s * 0.2 + ((t * 120) % (s * 0.2)); g.beginPath(); g.moveTo(xx, -s * 0.22); g.lineTo(xx + s * 0.1, s * 0.22); g.stroke(); } }
      g.restore();
      if (t > 0.35 && t < 0.85) burstStar(g, x, y, 14 + 30 * (t - 0.35), col, o.k === 'jab' ? 4 : 6);
      if (o.el === 'poison') aura(g, x, y, 30, 'poison', t, 7);
      break;
    }
    case 'head': {
      const s = 46 * big;
      if (o.el === 'psy') {
        for (let i = 0; i < 3; i++) { const r = (t * 1.4 - i * 0.2) * s; if (r > 0) { g.strokeStyle = col[i % 2 ? 1 : 2]; g.lineWidth = 5; g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, 0, TAU); g.stroke(); } }
      }
      if (o.el === 'steel') { g.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) { const ang = (i / 4) * TAU + t * 3; starPath(g, x + Math.cos(ang) * s * 0.7, y + Math.sin(ang) * s * 0.5, 8, 3, 4); g.fill(); } }
      if (o.el === 'rock') for (let i = 0; i < 7; i++) { const ang = (i / 7) * TAU; g.fillStyle = C.rock[i % 3]; g.save(); g.translate(x + Math.cos(ang) * s * t * 1.4, y + Math.sin(ang) * s * t); g.rotate(t * 5 + i); g.fillRect(-6, -5, 12, 10); g.restore(); }
      if (t < 0.7) burstStar(g, x, y, 22 + 40 * t * big, col, 10, t);
      break;
    }
    case 'slam': case 'giga': {
      const n = o.n || 1;
      for (let i = 0; i < n; i++) {
        const ti = Math.min(1, Math.max(0, (t - i * 0.25) / 0.6));
        if (ti <= 0 || ti >= 1) continue;
        const s = (o.k === 'giga' ? 60 : 36) * big;
        burstStar(g, x + i * 10, y - i * 6, s * (0.5 + ti), o.k === 'giga' ? ['#ffffff', '#ffd84a', '#a85af0', '#3c1a78'] : col, o.k === 'giga' ? 12 : 9, ti);
        g.strokeStyle = o.k === 'giga' ? '#a85af0' : col[2];
        g.lineWidth = 5;
        g.beginPath(); g.ellipse(x, y + 16, s * ti * 1.6, s * ti * 0.5, 0, 0, TAU); g.stroke();
      }
      if (o.angry) { g.strokeStyle = '#ff3a2a'; g.lineWidth = 4; const ax = x + 26, ay = y - 34; for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.moveTo(ax + dx * 3, ay + dy * 3); g.lineTo(ax + dx * 9, ay + dy * 9); g.stroke(); } }
      if (o.recoil && t > 0.3) for (let i = 0; i < 4; i++) { g.fillStyle = '#fff27a'; g.fillRect(x + back.x * 40 + (i - 2) * 6, y + back.y * 40 - 20 + i * 4, 4, 4); }
      break;
    }
    case 'hearts': {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + t * 2;
        const d = 10 + t * 40;
        heart(g, x + Math.cos(ang) * d, y + Math.sin(ang) * d - t * 20, 9, i % 2 ? '#ff6fa8' : '#ffc8e4');
      }
      if (t < 0.6) burstStar(g, x, y, 24 + 30 * t, C.fairy, 8);
      break;
    }
    case 'wing': {
      const n = o.n || 1;
      for (let i = 0; i < n; i++) {
        const ti = Math.min(1, Math.max(0, (t - i * 0.16) / 0.5));
        if (ti <= 0 || ti >= 1) continue;
        g.save(); g.translate(x, y); g.rotate(a.dir + (i % 2 ? 2.2 : -0.9));
        g.globalAlpha = 1 - ti * 0.6;
        const r = 50 * big;
        g.fillStyle = col[2];
        for (let f = 0; f < 5; f++) { const ang = -0.9 + f * 0.36 + ti * 0.6; g.save(); g.rotate(ang); g.beginPath(); g.ellipse(r * 0.55, 0, r * 0.5, 7, 0, 0, TAU); g.fill(); g.fillStyle = f % 2 ? col[1] : col[0]; g.beginPath(); g.ellipse(r * 0.6, 0, r * 0.38, 3.5, 0, 0, TAU); g.fill(); g.fillStyle = col[2]; g.restore(); }
        g.restore();
      }
      if (o.el === 'blue' || o.el === 'fire') aura(g, x, y, 40, o.el === 'blue' ? 'ghost' : 'fire', t, 10);
      if (o.sharp && t < 0.5) { g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 40, y + 20); g.lineTo(x + 40, y - 20); g.stroke(); }
      break;
    }
    case 'splash': {
      const s = 34 * big;
      for (let i = 0; i < 12; i++) {
        const ang = -Math.PI / 2 + (i / 11 - 0.5) * 2.6;
        const d = s * (0.4 + t * 1.3);
        const h = Math.sin(t * Math.PI) * 26;
        g.fillStyle = C.water[i % 3];
        g.beginPath(); g.ellipse(x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.8 - h * 0.4, 6, 9, ang + Math.PI / 2, 0, TAU); g.fill();
      }
      g.strokeStyle = C.water[2]; g.lineWidth = 5;
      g.beginPath(); g.ellipse(x, y + 16, s * (0.5 + t), s * 0.35 * (0.5 + t), 0, 0, TAU); g.stroke();
      if (o.fall) { g.fillStyle = C.water[1]; g.globalAlpha = 1 - t; g.fillRect(x - 14, y - 90 + t * 60, 28, 90); }
      break;
    }
    case 'burst': {
      const s = 40 * big;
      const pal = col;
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * TAU;
        const d = s * (0.3 + t * 1.2);
        g.save(); g.translate(x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.8); g.rotate(ang);
        g.fillStyle = pal[i % 2 ? 1 : 2];
        if (o.el === 'elec') { g.fillRect(-8, -2, 16, 4); g.fillRect(2, -6, 4, 12); }
        else if (o.el === 'fire') { g.beginPath(); g.moveTo(-8, 4); g.quadraticCurveTo(0, -12, 8, 4); g.fill(); }
        else { g.beginPath(); g.ellipse(0, 0, 9, 4, 0, 0, TAU); g.fill(); }
        g.restore();
      }
      if (t < 0.55) burstStar(g, x, y, s * (0.4 + t), pal, 10);
      break;
    }
    case 'spin': {
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = col[i];
        g.lineWidth = 5;
        const r = 20 + i * 10 + t * 20;
        g.beginPath(); g.arc(x, y, r, t * 12 + i, t * 12 + i + 3.6); g.stroke();
      }
      if (o.el === 'ice') aura(g, x, y, 40, 'ice', t, 8);
      break;
    }
    case 'drain': {
      for (let i = 0; i < 8; i++) {
        const ti = (t + i / 8) % 1;
        const px = x + (a.ux - x) * ti + Math.sin(ti * 9 + i) * 14;
        const py = y + (a.uy - y) * ti + Math.cos(ti * 7 + i) * 10;
        g.fillStyle = col[i % 2 ? 1 : 2];
        g.beginPath(); g.arc(px, py, 5 + (i % 3), 0, TAU); g.fill();
      }
      if (t < 0.5) burstStar(g, x, y, 18 + 24 * t, col, 6);
      break;
    }
    case 'knock': {
      const ti = ease(Math.min(1, t / 0.4));
      g.save(); g.translate(x + back.x * (1 - ti) * 40, y - 6); g.rotate(a.dir + Math.PI / 2 * (1 - ti));
      g.fillStyle = C.dark[2]; rr(g, -22, -10, 44, 20, 8); g.fill();
      g.fillStyle = C.dark[1]; rr(g, -18, -6, 36, 12, 5); g.fill();
      g.restore();
      if (t > 0.35) {
        // o item voando para longe
        const ft = (t - 0.35) / 0.65;
        g.save(); g.translate(x - back.x * ft * 90, y - 40 * Math.sin(ft * Math.PI) - 10); g.rotate(ft * 12);
        g.fillStyle = o.steal ? '#ffd84a' : '#e8e8f0'; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill();
        g.fillStyle = '#7a7a90'; g.fillRect(-8, -1.5, 16, 3);
        g.restore();
        burstStar(g, x, y, 16 + 20 * ft, C.dark, 6);
      }
      break;
    }
    case 'cloud': {
      // briga de desenho animado: nuvem de poeira com estrelas e corações
      const s = 44;
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * TAU + t * 3;
        g.fillStyle = i % 2 ? '#f8e8f0' : '#ffd0e4';
        g.beginPath(); g.arc(x + Math.cos(ang) * s * 0.5, y + Math.sin(ang) * s * 0.35, s * 0.32, 0, TAU); g.fill();
      }
      for (let i = 0; i < 4; i++) {
        const ang = t * 8 + i * 1.6;
        const px = x + Math.cos(ang) * s * 0.7, py = y + Math.sin(ang) * s * 0.5;
        if (i % 2) heart(g, px, py, 7, '#ff5aa8'); else { g.fillStyle = '#ffe14a'; starPath(g, px, py, 8, 3.5, 5, ang); g.fill(); }
      }
      break;
    }
    case 'clap': {
      const close = ease(Math.min(1, t / 0.35));
      for (const side of [-1, 1]) {
        g.save(); g.translate(x + side * (1 - close) * 40 + side * 8, y - 6);
        g.fillStyle = '#f4d0a8'; rr(g, -9, -20, 18, 40, 8); g.fill();
        g.fillStyle = '#d8a878'; g.fillRect(-9, 6, 18, 4);
        g.restore();
      }
      if (t > 0.3) { g.strokeStyle = '#ffffff'; g.lineWidth = 4; for (let i = 0; i < 6; i++) { const ang = (i / 6) * TAU; g.beginPath(); g.moveTo(x + Math.cos(ang) * 18, y - 6 + Math.sin(ang) * 18); g.lineTo(x + Math.cos(ang) * (26 + 30 * (t - 0.3)), y - 6 + Math.sin(ang) * (26 + 30 * (t - 0.3))); g.stroke(); } }
      break;
    }
    case 'speed': {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 4;
      for (let i = 0; i < (o.big ? 9 : 5); i++) {
        const off = (i - 3) * 9;
        const len = 60 * (1 - t);
        const sx = x + back.x * (30 + i * 6) - Math.sin(a.dir) * off, sy = y + back.y * (30 + i * 6) + Math.cos(a.dir) * off;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + back.x * len, sy + back.y * len); g.stroke();
      }
      if (t < 0.6) burstStar(g, x, y, 16 + 30 * t * big, C.normal, 8);
      break;
    }
  }
  g.restore();
}

function heart(g, x, y, s, color) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y + s * 0.9);
  g.bezierCurveTo(x - s * 1.4, y - s * 0.2, x - s * 0.6, y - s * 1.2, x, y - s * 0.4);
  g.bezierCurveTo(x + s * 0.6, y - s * 1.2, x + s * 1.4, y - s * 0.2, x, y + s * 0.9);
  g.fill();
}

// ---------------------------------------------------------------- em quem usa golpe de status
function drawSelf(g, a) {
  const m = a.mon;
  const t = a.t;
  const x = m.x, y = m.y - 26 - (m.hover || 0);
  const r = m.radius * 1.6;
  const k = a.kind;
  g.save();
  if (t > 0.75) g.globalAlpha = (1 - t) / 0.25;
  switch (k) {
    case 'swords': {
      // espadas girando em volta e se cruzando no alto
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * TAU + t * 7;
        const rad = r * 1.2 * (1 - t * 0.5);
        g.save(); g.translate(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad * 0.5 - t * 30); g.rotate(ang + Math.PI / 2);
        g.fillStyle = '#e8eef8'; g.fillRect(-3, -22, 6, 30);
        g.fillStyle = '#ffffff'; g.fillRect(-1, -22, 2, 28);
        g.fillStyle = '#c8a040'; g.fillRect(-9, 8, 18, 4);
        g.fillStyle = '#7a4a1a'; g.fillRect(-2, 12, 4, 9);
        g.restore();
      }
      break;
    }
    case 'dragondance': {
      for (let i = 0; i < 14; i++) {
        const tt = (t * 1.5 + i / 14) % 1;
        const ang = tt * TAU * 2 + i;
        g.fillStyle = i % 2 ? '#a588ff' : '#ff6a4a';
        g.beginPath(); g.ellipse(x + Math.cos(ang) * r, y + 20 - tt * 70, 6, 12, 0, 0, TAU); g.fill();
      }
      break;
    }
    case 'calmmind': {
      for (let i = 0; i < 3; i++) {
        const rr2 = r * 1.6 * (1 - ((t * 1.5 + i / 3) % 1));
        g.strokeStyle = i % 2 ? '#ff9cc8' : '#f0508a'; g.lineWidth = 4;
        g.beginPath(); g.ellipse(x, y - 18, rr2, rr2 * 0.6, 0, 0, TAU); g.stroke();
      }
      break;
    }
    case 'nastyplot': {
      g.fillStyle = '#2a1830'; rr(g, x + 10, y - 62, 44, 26, 10); g.fill();
      g.beginPath(); g.arc(x + 12, y - 30, 4, 0, TAU); g.arc(x + 6, y - 24, 2.5, 0, TAU); g.fill();
      g.fillStyle = '#ff6a6a';
      for (let i = 0; i < 3; i++) if (t * 4 > i) { g.beginPath(); g.arc(x + 22 + i * 10, y - 49, 3.5, 0, TAU); g.fill(); }
      aura(g, x, y, r, 'dark', t, 6);
      break;
    }
    case 'bulkup': {
      g.strokeStyle = '#ff8a3a'; g.lineWidth = 5;
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * TAU;
        const d1 = r * (0.9 + t * 0.6), d2 = d1 + 14;
        g.beginPath(); g.moveTo(x + Math.cos(ang) * d1, y + Math.sin(ang) * d1 * 0.7); g.lineTo(x + Math.cos(ang) * d2, y + Math.sin(ang) * d2 * 0.7); g.stroke();
      }
      break;
    }
    case 'irondefense': {
      g.fillStyle = 'rgba(200,210,230,0.55)';
      g.beginPath(); g.ellipse(x, y, r, r * 1.1, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffffff';
      const sx = x - r + t * r * 2;
      g.save(); g.beginPath(); g.ellipse(x, y, r, r * 1.1, 0, 0, TAU); g.clip(); g.fillRect(sx - 6, y - r * 1.2, 12, r * 2.4); g.restore();
      break;
    }
    case 'speedup': {
      g.strokeStyle = '#ffffff'; g.lineWidth = 4;
      for (let i = 0; i < 6; i++) { const yy = y - 30 + i * 12; const off = ((t * 300 + i * 37) % 80); g.beginPath(); g.moveTo(x - 50 - off, yy); g.lineTo(x - 20 - off, yy); g.stroke(); }
      break;
    }
    case 'amnesia': {
      g.fillStyle = '#ffffff'; rr(g, x + 8, y - 64, 28, 30, 10); g.fill();
      g.fillStyle = '#3f7fe8'; g.font = 'bold 22px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', x + 22, y - 48);
      break;
    }
    case 'barrier': case 'wall': {
      const color = a.id === 'reflect' ? ['#ffb0d8', '#ff6fb0'] : a.id === 'lightscreen' ? ['#fff6a0', '#ffd84a'] : ['#c8f0ff', '#7ad0ff'];
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + t;
        const px = x + Math.cos(ang) * r * 1.2, py = y + Math.sin(ang) * r * 0.7;
        g.fillStyle = color[i % 2]; g.globalAlpha = Math.min(1, t * 4) * (t > 0.75 ? (1 - t) / 0.25 : 1) * 0.8;
        g.beginPath(); for (let h = 0; h < 6; h++) { const ha = (h / 6) * TAU; g.lineTo(px + Math.cos(ha) * 12, py + Math.sin(ha) * 12); } g.closePath(); g.fill();
      }
      break;
    }
    case 'cotton': for (let i = 0; i < 8; i++) { const ang = (i / 8) * TAU + t * 2; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + Math.cos(ang) * r * (0.6 + t), y + Math.sin(ang) * r * 0.6 * (0.6 + t), 10, 0, TAU); g.fill(); } break;
    case 'honeclaws': for (let i = 0; i < 3; i++) { g.strokeStyle = '#ffffff'; g.lineWidth = 3; const yy = y - 10 + i * 8; g.beginPath(); g.moveTo(x + 18, yy); g.lineTo(x + 18 + 20 * Math.sin(t * 20 + i), yy - 6); g.stroke(); } aura(g, x, y, r, 'steel', t, 5); break;
    case 'workup': case 'growth': {
      for (let i = 0; i < 6; i++) {
        const px = x - 30 + i * 12, py = y + 10 - ((t * 80 + i * 13) % 60);
        g.fillStyle = k === 'growth' ? C.grass[1 + (i % 2)] : '#ff7a3a';
        if (k === 'growth') { g.beginPath(); g.ellipse(px, py, 4, 8, 0.4, 0, TAU); g.fill(); }
        else { g.beginPath(); g.moveTo(px - 6, py + 4); g.lineTo(px, py - 6); g.lineTo(px + 6, py + 4); g.fill(); }
      }
      break;
    }
    case 'shellsmash': for (let i = 0; i < 8; i++) { const ang = (i / 8) * TAU; g.save(); g.translate(x + Math.cos(ang) * r * t * 2, y + Math.sin(ang) * r * t * 1.4); g.rotate(t * 8 + i); g.fillStyle = i % 2 ? '#c8a060' : '#8a6030'; g.beginPath(); g.moveTo(0, -8); g.lineTo(7, 6); g.lineTo(-7, 6); g.fill(); g.restore(); } break;
    case 'drum': { g.fillStyle = '#c8302c'; rr(g, x - 16, y - 70, 32, 18, 4); g.fill(); g.fillStyle = '#f4e0b0'; g.fillRect(x - 16, y - 72, 32, 4); for (let i = 0; i < 2; i++) { const rr3 = 20 + ((t * 120 + i * 30) % 60); g.strokeStyle = '#ffd84a'; g.lineWidth = 3; g.beginPath(); g.arc(x, y - 62, rr3, 0, TAU); g.stroke(); } break; }
    case 'curse': { g.fillStyle = '#8a8a9a'; g.save(); g.translate(x, y - 60); g.rotate(0.5); g.fillRect(-3, -18, 6, 30); g.fillRect(-9, -20, 18, 5); g.restore(); aura(g, x, y, r, 'ghost', t, 6); break; }
    case 'heal': case 'dew': case 'sunheal': case 'sparkle': {
      if (k === 'sunheal') { g.fillStyle = 'rgba(255,240,150,0.5)'; g.fillRect(x - 24, y - 140, 48, 140); }
      for (let i = 0; i < 9; i++) {
        const px = x + Math.sin(i * 2.3) * r, py = y + 20 - ((t * 90 + i * 17) % 80);
        if (k === 'dew') { g.fillStyle = '#7ad0ff'; g.beginPath(); g.ellipse(px, py, 4, 6, 0, 0, TAU); g.fill(); }
        else if (k === 'sparkle') { g.fillStyle = '#ffffff'; starPath(g, px, py, 7, 2.5, 4); g.fill(); }
        else { g.fillStyle = '#7df07d'; g.fillRect(px - 2, py - 7, 4, 14); g.fillRect(px - 7, py - 2, 14, 4); }
      }
      break;
    }
    case 'roost': for (let i = 0; i < 7; i++) { const px = x + Math.sin(i * 2.1 + t * 3) * r * 1.2, py = y - 50 + ((t * 100 + i * 20) % 90); g.fillStyle = i % 2 ? '#ffffff' : '#d8e8f8'; g.beginPath(); g.ellipse(px, py, 10, 4, Math.sin(t * 6 + i), 0, TAU); g.fill(); } break;
    case 'rest': { g.fillStyle = '#ffffff'; g.font = '14px "Press Start 2P", monospace'; for (let i = 0; i < 3; i++) g.fillText('Z', x + 12 + i * 12, y - 40 - i * 14 - t * 20); break; }
    case 'wish': { const sy2 = y - 120 + t * 90; g.fillStyle = '#ffe14a'; starPath(g, x + 40 - t * 40, sy2, 14, 6, 5, t * 4); g.fill(); g.strokeStyle = '#fff6b0'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 40 - t * 40, sy2); g.lineTo(x + 80 - t * 40, sy2 - 50); g.stroke(); break; }
    case 'dome': { g.fillStyle = 'rgba(140,255,170,0.35)'; g.beginPath(); g.ellipse(x, y + 10, r * 1.6, r * 1.3, 0, Math.PI, TAU); g.fill(); g.strokeStyle = '#7dffa8'; g.lineWidth = 4; g.stroke(); break; }
    case 'tailwind': for (let i = 0; i < 8; i++) { const yy = y - 60 + i * 14; const xx = x - 120 + ((t * 500 + i * 60) % 240); g.strokeStyle = '#d8f0ff'; g.lineWidth = 4; g.beginPath(); g.moveTo(xx, yy); g.quadraticCurveTo(xx + 20, yy - 8, xx + 40, yy); g.stroke(); } break;
    case 'magnet': for (let i = 0; i < 3; i++) { g.strokeStyle = i % 2 ? '#fff07a' : '#c0c8e0'; g.lineWidth = 4; g.beginPath(); g.ellipse(m.x, m.y + 6, r * (1 + i * 0.25), r * 0.35 * (1 + i * 0.25), 0, 0, TAU); g.stroke(); } break;
    case 'aquaring': for (let i = 0; i < 10; i++) { const ang = (i / 10) * TAU + t * 3; g.fillStyle = C.water[i % 3]; g.beginPath(); g.arc(x + Math.cos(ang) * r * 1.2, y + Math.sin(ang) * r * 0.5, 6, 0, TAU); g.fill(); } break;
    case 'roots': for (let i = 0; i < 6; i++) { const ang = (i / 6) * TAU; g.strokeStyle = C.ground[2 + (i % 2)]; g.lineWidth = 5; g.beginPath(); g.moveTo(m.x, m.y); g.quadraticCurveTo(m.x + Math.cos(ang) * 20, m.y + Math.sin(ang) * 10 + 6, m.x + Math.cos(ang) * r * 1.6 * t, m.y + Math.sin(ang) * r * 0.6 * t); g.stroke(); } break;
    case 'destinybond': for (let i = 0; i < 8; i++) { const ang = (i / 8) * TAU + t * 3; g.strokeStyle = '#7550b8'; g.lineWidth = 4; g.beginPath(); g.arc(x + Math.cos(ang) * r * 1.3, y + Math.sin(ang) * r * 0.6, 7, 0, TAU); g.stroke(); } break;
    case 'baton': { g.save(); g.translate(x, y - 60); g.rotate(t * 14); g.fillStyle = '#e8e8f0'; g.fillRect(-22, -3, 44, 6); g.fillStyle = '#ff5a5a'; g.fillRect(-26, -5, 8, 10); g.fillRect(18, -5, 8, 10); g.restore(); break; }
    case 'puff': for (let i = 0; i < 8; i++) { const ang = (i / 8) * TAU; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + Math.cos(ang) * r * t * 1.4, y + Math.sin(ang) * r * t, 12 * (1 - t), 0, TAU); g.fill(); } break;
    case 'bell': { g.fillStyle = '#ffd84a'; g.beginPath(); g.moveTo(x - 14, y - 50); g.quadraticCurveTo(x - 14, y - 80, x, y - 80); g.quadraticCurveTo(x + 14, y - 80, x + 14, y - 50); g.closePath(); g.fill(); g.fillRect(x - 18, y - 52, 36, 5); for (let i = 0; i < 3; i++) { const rr3 = 30 + ((t * 120 + i * 30) % 70); g.strokeStyle = '#fff6b0'; g.lineWidth = 3; g.beginPath(); g.arc(x, y - 60, rr3, 0, TAU); g.stroke(); } break; }
    case 'toss': {
      const color = a.id === 'stealthrock' ? C.rock : a.id === 'toxicspikes' ? C.poison : C.steel;
      for (let i = 0; i < 5; i++) { const px = x + (a.dirx || 1) * (20 + t * 160) + (i - 2) * 12, py = y - Math.sin(t * Math.PI) * 60 + (i - 2) * 6; g.fillStyle = color[1 + (i % 2)]; g.save(); g.translate(px, py); g.rotate(t * 10 + i); g.beginPath(); g.moveTo(0, -7); g.lineTo(6, 6); g.lineTo(-6, 6); g.fill(); g.restore(); }
      break;
    }
    case 'future': { const yy = y - 40 - t * 200; g.fillStyle = '#c87aff'; g.beginPath(); g.arc(x, yy, 14, 0, TAU); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, yy, 9, 5, 0, 0, TAU); g.fill(); g.fillStyle = '#5a1a8a'; g.beginPath(); g.arc(x, yy, 3.5, 0, TAU); g.fill(); break; }
    case 'notes': for (let i = 0; i < 6; i++) { const ang = (i / 6) * TAU + t * 2; const d = r + t * 80; note(g, x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.6, i % 2 ? '#ff9cf0' : '#ffffff'); } break;
    case 'haze': for (let i = 0; i < 10; i++) { const ang = (i / 10) * TAU + t; g.fillStyle = i % 2 ? '#d8d8e8' : '#b8b8d0'; g.beginPath(); g.arc(x + Math.cos(ang) * (40 + t * 160), y + Math.sin(ang) * (30 + t * 90), 18, 0, TAU); g.fill(); } break;
    case 'terrain': case 'weather': case 'room': {
      const c = { electricterrain: '#fff27a', psychicterrain: '#ff9cf0', mistyterrain: '#ffd0f0', grassyterrain: '#7ad85a', sunnyday: '#ffd84a', raindance: '#7ab8ff', sandstorm: '#d6a756', hail: '#d8f4ff', snowscape: '#ffffff', trickroom: '#ff8ae8', wonderroom: '#8ae8ff' }[a.id] || '#ffffff';
      for (let i = 0; i < 3; i++) { const rr3 = (t * 1.2 - i * 0.15) * 300; if (rr3 > 0) { g.strokeStyle = c; g.lineWidth = 6 - i; g.beginPath(); g.ellipse(m.x, m.y, rr3, rr3 * 0.6, 0, 0, TAU); g.stroke(); } }
      break;
    }
  }
  g.restore();
}

function note(g, x, y, color) {
  g.fillStyle = color;
  g.beginPath(); g.ellipse(x, y, 6, 4.5, -0.4, 0, TAU); g.fill();
  g.fillRect(x + 4, y - 18, 3, 18);
  g.fillRect(x + 4, y - 18, 9, 3);
}

// ---------------------------------------------------------------- golpe de status no alvo
function drawStatus(g, a) {
  const m = a.mon;
  const t = a.t;
  const x = m.x, y = m.y - 30 - (m.hover || 0);
  g.save();
  if (t > 0.75) g.globalAlpha = (1 - t) / 0.25;
  switch (a.kind) {
    case 'taunt': { g.strokeStyle = '#ff3a2a'; g.lineWidth = 5; const ax = x + 18, ay = y - 30; for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.moveTo(ax + dx * 4, ay + dy * 4); g.lineTo(ax + dx * 12, ay + dy * 12); g.stroke(); } break; }
    case 'encore': for (const side of [-1, 1]) { g.save(); g.translate(x + side * (30 + Math.sin(t * 30) * 6), y - 20); g.fillStyle = '#f4d0a8'; rr(g, -7, -14, 14, 28, 6); g.fill(); g.restore(); } break;
    case 'trick': for (let i = 0; i < 2; i++) { const ang = t * 10 + i * Math.PI; g.fillStyle = i ? '#ffd84a' : '#7ad0ff'; g.beginPath(); g.arc(x + Math.cos(ang) * 30, y + Math.sin(ang) * 14, 9, 0, TAU); g.fill(); g.strokeStyle = '#22223a'; g.lineWidth = 2; g.stroke(); } break;
    case 'lock': { g.fillStyle = '#c8c8d8'; rr(g, x - 12, y - 20, 24, 20, 3); g.fill(); g.strokeStyle = '#c8c8d8'; g.lineWidth = 4; g.beginPath(); g.arc(x, y - 22, 8, Math.PI, TAU); g.stroke(); g.fillStyle = '#22223a'; g.fillRect(x - 2, y - 14, 4, 7); break; }
    case 'torment': for (let i = 0; i < 4; i++) { const ang = (i / 4) * TAU + t * 5; g.fillStyle = '#a83a3a'; g.beginPath(); g.moveTo(x + Math.cos(ang) * 30, y + Math.sin(ang) * 14 - 8); g.lineTo(x + Math.cos(ang) * 30 + 6, y + Math.sin(ang) * 14 + 6); g.lineTo(x + Math.cos(ang) * 30 - 6, y + Math.sin(ang) * 14 + 6); g.fill(); } break;
    case 'eyes': for (const side of [-1, 1]) { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x + side * 16, y - 40, 12, 7, 0, 0, TAU); g.fill(); g.fillStyle = '#c8202a'; g.beginPath(); g.arc(x + side * 16, y - 40, 4, 0, TAU); g.fill(); } break;
    case 'spite': case 'memento': aura(g, x, y, 34, 'ghost', t, 10); break;
    case 'painsplit': { g.strokeStyle = '#ff5a5a'; g.lineWidth = 5; g.beginPath(); g.moveTo(x - 20, y - 30); g.lineTo(x + 20, y + 10); g.stroke(); aura(g, x, y, 30, 'psy', t, 6); break; }
    case 'toxic': for (let i = 0; i < 8; i++) { const px = x + Math.sin(i * 2.3) * 26, py = y + 10 - ((t * 60 + i * 11) % 50); g.fillStyle = C.poison[1 + (i % 2)]; g.beginPath(); g.arc(px, py, 6, 0, TAU); g.fill(); } break;
    case 'burn': aura(g, x, y, 30, 'fire', t, 9); break;
    case 'paralyze': aura(g, x, y, 30, 'elec', t, 8); break;
    case 'sleep': { g.fillStyle = '#ffffff'; g.font = '14px "Press Start 2P", monospace'; for (let i = 0; i < 3; i++) g.fillText('z', x + 14 + i * 10, y - 30 - i * 12 - t * 16); break; }
    case 'seed': for (let i = 0; i < 6; i++) { const ang = (i / 6) * TAU + t * 3; g.fillStyle = C.grass[1 + (i % 2)]; g.beginPath(); g.ellipse(x + Math.cos(ang) * 28, y + 14 + Math.sin(ang) * 10, 7, 3, ang, 0, TAU); g.fill(); } break;
    case 'hearts': for (let i = 0; i < 5; i++) heart(g, x - 30 + i * 15, y - 20 - Math.sin(t * 6 + i) * 10 - t * 20, 7, i % 2 ? '#ff6fa8' : '#ffc8e4'); break;
    case 'roar': for (let i = 0; i < 3; i++) { const r = (t * 1.3 - i * 0.15) * 90; if (r > 0) { g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.beginPath(); g.arc(x, y, r, -0.8, 0.8); g.stroke(); g.beginPath(); g.arc(x, y, r, Math.PI - 0.8, Math.PI + 0.8); g.stroke(); } } break;
  }
  g.restore();
}

// ---------------------------------------------------------------- gerenciador
export class MoveVfx {
  constructor() { this.list = []; }

  impact(e) {
    const o = IMPACT[e.mv?.id];
    if (!o || !e.mon) return false;
    const by = e.by || e.mon;
    const dir = Math.atan2(e.mon.y - by.y, e.mon.x - by.x);
    const y = e.mon.y - 26 - (e.mon.hover || 0);
    this.list.push({ type: 'impact', o, x: e.mon.x, y, dir, ux: by.x, uy: by.y - 26, age: 0, dur: o.k === 'flurry' ? 0.75 : o.k === 'drain' ? 0.7 : 0.5 });
    return true;
  }

  self(mon, id, foe) {
    const kind = SELF[id];
    if (!kind) return false;
    const dirx = foe ? Math.sign(foe.x - mon.x) || 1 : 1;
    this.list.push({ type: 'self', kind, id, mon, dirx, age: 0, dur: ['terrain', 'weather', 'room'].includes(kind) ? 1.1 : 0.9 });
    return true;
  }

  status(mon, id) {
    const kind = STATUS[id];
    if (!kind || !mon) return;
    this.list.push({ type: 'status', kind, mon, age: 0, dur: 0.9 });
  }

  update(dt) {
    for (const a of this.list) a.age += dt;
    this.list = this.list.filter(a => a.age < a.dur);
  }

  draw(g) {
    for (const a of this.list) {
      a.t = Math.min(1, a.age / a.dur);
      if (a.type === 'impact') drawImpact(g, a);
      else if (a.type === 'self') drawSelf(g, a);
      else drawStatus(g, a);
    }
  }
}

// ---------------------------------------------------------------- golpes com forma de corte
// estilo do arco do corte para cada golpe (a cor vem do tipo)
export const SLASH_STYLE = {
  dragonclaw: 'claw', shadowclaw: 'claw', crushclaw: 'claw', slash: 'claw',
  nightslash: 'crescent', sacredsword: 'sword', leafblade: 'leaf', razorshell: 'shell', solarblade: 'sword',
  xscissor: 'cross', crosschop: 'cross', dualchop: 'double', throatchop: 'chop', lowsweep: 'low',
  aquatail: 'tail', irontail: 'tail', dragontail: 'tail', breakingswipe: 'tail', avalanche: 'snow', powerwhip: 'vine',
};

export function drawSlashStyle(g, e, col) {
  const style = SLASH_STYLE[e.id] || 'arc';
  const k = e.t / e.dur;
  const half = (e.arc * Math.PI) / 360;
  const reach = e.reach * 0.9;
  const start = e.angle - half + half * 2 * Math.max(0, k - 0.35);
  const end = e.angle - half + half * 2 * Math.min(1, k * 2);
  g.save();
  g.translate(e.x, e.y - 24);
  g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
  const arcBand = (r, w, color, a0 = start, a1 = end) => { g.strokeStyle = color; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, a0, a1); g.stroke(); };
  switch (style) {
    case 'claw':
      for (let i = 0; i < 3; i++) { arcBand(reach - i * 10, 7, col[3]); arcBand(reach - i * 10, 3, col[0]); }
      break;
    case 'crescent':
      // lua crescente escura com fio vermelho (Night Slash)
      arcBand(reach, 16, col[3]); arcBand(reach + 4, 5, '#ff3a3a');
      break;
    case 'sword': {
      arcBand(reach, 14, e.id === 'solarblade' ? '#fff27a' : '#ffd84a'); arcBand(reach, 5, '#ffffff');
      const a = end;
      g.save(); g.rotate(a); g.translate(reach * 0.55, 0);
      g.fillStyle = '#e8eef8'; g.fillRect(0, -4, reach * 0.55, 8); g.fillStyle = '#c8a040'; g.fillRect(-6, -12, 6, 24);
      g.restore();
      break;
    }
    case 'leaf': {
      arcBand(reach, 12, C.grass[2]);
      g.save(); g.rotate(end); g.translate(reach * 0.6, 0);
      g.fillStyle = C.grass[1]; g.beginPath(); g.ellipse(reach * 0.2, 0, reach * 0.35, 9, 0, 0, TAU); g.fill();
      g.strokeStyle = C.grass[3]; g.lineWidth = 2; g.beginPath(); g.moveTo(-reach * 0.1, 0); g.lineTo(reach * 0.5, 0); g.stroke();
      g.restore();
      break;
    }
    case 'shell': arcBand(reach, 14, '#4aa3f0'); arcBand(reach - 6, 4, '#ffffff'); for (let i = 0; i < 4; i++) { const a = start + ((end - start) * i) / 3; g.fillStyle = '#c8e8ff'; g.fillRect(Math.cos(a) * reach - 3, Math.sin(a) * reach - 3, 6, 6); } break;
    case 'cross':
      for (const s of [-1, 1]) { g.save(); g.rotate(e.angle + s * 0.6); g.strokeStyle = col[3]; g.lineWidth = 10; g.beginPath(); g.moveTo(-reach * 0.2, 0); g.lineTo(reach * Math.min(1, k * 2.5), 0); g.stroke(); g.strokeStyle = col[0]; g.lineWidth = 4; g.stroke(); g.restore(); }
      break;
    case 'double': arcBand(reach, 9, col[2]); arcBand(reach * 0.7, 9, col[1], start + 0.4, end + 0.4); break;
    case 'chop': { g.save(); g.rotate(e.angle); g.fillStyle = '#f4d0a8'; rr(g, reach * 0.4, -20 + 40 * Math.min(1, k * 2), reach * 0.5, 12, 5); g.fill(); g.restore(); arcBand(reach, 6, col[1]); break; }
    case 'low': arcBand(reach, 10, col[2], start + 0.4, end + 0.4); break;
    case 'tail': arcBand(reach, 18, col[3]); arcBand(reach, 8, col[1]); if (e.type === 'Water') for (let i = 0; i < 6; i++) { const a = start + ((end - start) * i) / 5; g.fillStyle = C.water[i % 3]; g.beginPath(); g.arc(Math.cos(a) * (reach + 12), Math.sin(a) * (reach + 12), 4, 0, TAU); g.fill(); } break;
    case 'snow': arcBand(reach, 20, '#e8fbff'); arcBand(reach - 10, 8, '#9ee7f5'); break;
    case 'vine': {
      g.strokeStyle = '#3d9a2c'; g.lineWidth = 7;
      g.beginPath(); g.moveTo(0, 0);
      g.quadraticCurveTo(Math.cos(e.angle + 0.5) * reach * 0.5, Math.sin(e.angle + 0.5) * reach * 0.5, Math.cos(e.angle) * reach * Math.min(1, k * 2), Math.sin(e.angle) * reach * Math.min(1, k * 2));
      g.stroke();
      break;
    }
    default: arcBand(reach, 10, '#ffffff'); arcBand(reach - 7, 5, col[2]);
  }
  g.restore();
}

export { C as VFX_COLORS, starPath, heart, note };
