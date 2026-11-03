// Roteiro do trailer: controla as lutas, a câmera e desenha as cartelas por cima do jogo, quadro a quadro.
(() => {
  const app = window.pkc, W = 1280, H = 720;
  const ov = document.createElement('canvas'); ov.width = W; ov.height = H;
  Object.assign(ov.style, { position: 'fixed', left: '0', top: '0', width: W + 'px', height: H + 'px', pointerEvents: 'none', zIndex: 999 });
  document.body.appendChild(ov);
  const g = ov.getContext('2d');
  const gameCv = document.getElementById('game');
  const IMG = {};
  for (const d of ['0094', '0094-0001', '0254', '0254-0001', '0807', '0807-0001']) { const i = new Image(); i.src = `assets/pmd/${d}/portrait.png`; IMG[d] = i; }
  const F = (px, w = 700) => `${w} ${px}px "Pixelify Sans"`;
  const c01 = v => Math.max(0, Math.min(1, v)), ease = v => 1 - (1 - c01(v)) ** 3, easeIn = v => c01(v) ** 2;
  const rnd = i => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const lerp = (a, b, k) => a + (b - a) * k;

  // ------------------------------------------------------------ controle da luta
  let A, B, E, L, LS;
  function montar(o) {
    app.ir('combate', { modo: o.modo ?? 'entreno', p1: o.p1, p2: o.p2, p3: o.p3, p4: o.p4, arena: o.arena, etapas: o.etapas ?? [2, 2, 2, 2] });
    E = app.escena; if (!E.luta) E.empezar(); L = E.luta; L.inicioRonda = -999; LS = L.luchadores; A = LS[0]; B = LS[1];
    E.hud.dibujar = () => {}; E.hud.barraSkills = () => {}; E.dibujarEntreno = () => {}; E.dibujarMira = () => {}; E.dibujarBanners = () => {};
    app.ajustes.mira = false;
    TR.it = { mx: 0, my: 0 };
    E.ctrls = LS.map((l, i) => ({ intento: () => (i === 0 ? { mx: TR.it.mx, my: TR.it.my, ax: TR.it.ax ?? B.x, ay: TR.it.ay ?? B.y } : { mx: 0, my: 0, ax: A.x, ay: A.y }) }));
    for (const l of LS) l.inmortal = true;
    (o.pos ?? []).forEach((p, i) => { LS[i].x = p[0]; LS[i].y = p[1]; LS[i].angulo = i === 0 ? 0 : Math.PI; });
    E.camara.listo = false;
    E.camara.actualizar = function (dt) {
      const C = TR.cam ?? { alvo: 'mid', z: 1 };
      const al = C.alvo === 'a' ? A : C.alvo === 'b' ? B : C.alvo === 'mid' ? { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 } : C.alvo;
      const tx = al.x + (C.dx ?? 0), ty = al.y - (C.dy ?? 30), k = this.listo ? Math.min(1, dt * (C.vel ?? 4)) : 1;
      this.z += (C.z - this.z) * k; this.x += (tx - this.x) * k; this.y += (ty - this.y) * k; this.centroY = 180; this.listo = true;
    };
  }
  const usar = (s, l = A) => { for (const k in l.cd) l.cd[k] = 0; l.energia = 100; l.calor = 0; l.sobrecargaHasta = 0; if (s === 'e') l.ulti = 100; const ok = L.habilidades.usar(l, s); if (!ok) console.log('FALHOU', s, l.def.id, l.ultiLista, l.ulti, !!l.accion, l.cd[s], JSON.stringify(Object.keys(l.est))); };
  const andar = (mx, my = 0) => { TR.it.mx = mx; TR.it.my = my; };

  // ------------------------------------------------------------ desenho
  function letterbox(k = 1) { g.fillStyle = '#000'; g.fillRect(0, 0, W, 64 * k); g.fillRect(0, H - 64 * k, W, 64 * k); }
  function texto(t, x, y, px, cor, o = {}) {
    g.font = F(px, o.peso ?? 700); g.textAlign = o.al ?? 'left'; g.textBaseline = 'middle';
    if (o.sombra !== false) { g.fillStyle = o.sombra ?? 'rgba(0,0,0,0.6)'; g.fillText(t, x + px * 0.06, y + px * 0.07); }
    if (o.borda) { g.lineWidth = o.borda; g.strokeStyle = o.bordaCor ?? '#000'; g.lineJoin = 'round'; g.strokeText(t, x, y); }
    g.fillStyle = cor; g.fillText(t, x, y);
  }
  // faixa inclinada de legenda que entra pela esquerda
  function legenda(f, ini, fim, txt, sub, cor) {
    if (f < ini || f > fim) return;
    const e = ease((f - ini) / 10), s = easeIn((f - (fim - 8)) / 8), x = lerp(-700, 0, e) - s * 800, y = H - 160;
    g.save(); g.translate(x, 0);
    g.fillStyle = cor; g.beginPath(); g.moveTo(0, y); g.lineTo(640, y); g.lineTo(600, y + 70); g.lineTo(0, y + 70); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.moveTo(0, y + 70); g.lineTo(600, y + 70); g.lineTo(585, y + 98); g.lineTo(0, y + 98); g.fill();
    texto(txt, 60, y + 36, 42, '#ffffff', { sombra: 'rgba(0,0,0,0.45)' });
    if (sub) texto(sub, 62, y + 84, 20, '#f5f5f5', { peso: 400, sombra: false });
    g.restore();
  }
  function tag(nome, cor) { g.fillStyle = cor; g.fillRect(40, 18, 8, 28); texto(nome, 60, 32, 26, '#ffffff', { sombra: false }); }
  function flash(f, n = 5, cor = '255,255,255') { if (f < n) { g.fillStyle = `rgba(${cor},${0.85 * (1 - f / n)})`; g.fillRect(0, 0, W, H); } }
  function raios(cx, cy, n, rot, cor, al) { g.save(); g.globalAlpha = al; g.fillStyle = cor; for (let i = 0; i < n; i++) { const a = rot + (i / n) * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 1800, cy + Math.sin(a) * 1800); g.lineTo(cx + Math.cos(a + Math.PI / n) * 1800, cy + Math.sin(a + Math.PI / n) * 1800); g.fill(); } g.restore(); }
  function linhasVelocidade(f, cor, n = 46) { g.save(); g.strokeStyle = cor; g.lineCap = 'round'; for (let i = 0; i < n; i++) { const y = rnd(i) * H, L2 = 120 + rnd(i + 9) * 380, x = W + 400 - ((f * (40 + rnd(i + 3) * 60) + rnd(i + 5) * 2000) % (W + 900)); g.globalAlpha = 0.25 + rnd(i + 7) * 0.4; g.lineWidth = 1 + rnd(i + 2) * 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + L2, y); g.stroke(); } g.restore(); }
  function retrato(dex, x, y, s, rot, borda, glow) {
    const im = IMG[dex]; if (!im?.complete) return;
    const lado = 40 * s;
    g.save(); g.translate(x, y); g.rotate(rot);
    g.shadowColor = glow; g.shadowBlur = 50; g.fillStyle = borda; g.fillRect(-lado / 2 - 10, -lado / 2 - 10, lado + 20, lado + 20); g.shadowBlur = 0;
    g.imageSmoothingEnabled = false; g.drawImage(im, -lado / 2, -lado / 2, lado, lado);
    g.restore();
  }

  // ------------------------------------------------------------ cartelas
  const TEMAS = {
    gengar: { nome: 'GENGAR', dex: '0094', mega: '0094-0001', c: ['#0d0218', '#4c1d95', '#c084fc'], tipos: [['GHOST', '#6d28d9'], ['POISON', '#a21caf']], frase: 'O FANTASMA QUE TE FAZ DORMIR' },
    sceptile: { nome: 'SCEPTILE', dex: '0254', mega: '0254-0001', c: ['#03190c', '#15803d', '#86efac'], tipos: [['GRASS', '#16a34a']], frase: 'AS LÂMINAS DA FLORESTA' },
    zeraora: { nome: 'ZERAORA', dex: '0807', mega: '0807-0001', c: ['#170f00', '#a16207', '#fde047'], tipos: [['ELECTRIC', '#ca8a04']], frase: 'A VELOCIDADE DO TROVÃO' },
  };
  function cardIntro(f) {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const lw = ease(f / 14) * W; g.fillStyle = '#fde68a'; g.fillRect(W / 2 - lw / 2, H / 2 - 1, lw, 2);
    if (f > 14) {
      const k = ease((f - 14) / 16); raios(W / 2, H / 2, 18, f * 0.01, '#fbbf24', 0.08 * k);
      const txt = 'PK CONFRONT', n = Math.min(txt.length, Math.floor((f - 14) / 2.2));
      const part = txt.slice(0, n), gl = f < 50 && f % 6 < 2 ? 8 : 0;
      g.globalAlpha = 0.7; texto(part, W / 2 - gl, H / 2 - 30, 120, '#ff3b5c', { al: 'center', sombra: false }); texto(part, W / 2 + gl, H / 2 - 30, 120, '#22d3ee', { al: 'center', sombra: false }); g.globalAlpha = 1;
      const gr = g.createLinearGradient(0, H / 2 - 90, 0, H / 2 + 30); gr.addColorStop(0, '#fff7d6'); gr.addColorStop(1, '#f59e0b');
      texto(part, W / 2, H / 2 - 30, 120, gr, { al: 'center', borda: 10, bordaCor: '#1c0f00' });
    }
    if (f > 50) { const k = ease((f - 50) / 12); g.globalAlpha = k; texto('TRÊS NOVOS DESAFIANTES CHEGARAM', W / 2, H / 2 + 70 + (1 - k) * 20, 32, '#ffffff', { al: 'center' }); g.globalAlpha = 1; }
    if (f > 92) { g.fillStyle = `rgba(255,255,255,${(f - 92) / 13})`; g.fillRect(0, 0, W, H); }
  }
  function cardFace(f, T, mega = false) {
    const [c0, c1, c2] = T.c;
    const gr = g.createRadialGradient(W * 0.66, H / 2, 40, W * 0.66, H / 2, 900); gr.addColorStop(0, c1); gr.addColorStop(1, c0);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    raios(W * 0.66, H / 2, 14, f * 0.012, c2, 0.1);
    linhasVelocidade(f, c2);
    // zoom no rosto: começa colado nos olhos e afasta com tranco
    const z = f < 8 ? 26 : lerp(26, 10.5, ease((f - 8) / 14)), sh = f > 8 && f < 22 ? (rnd(f) - 0.5) * 18 : 0;
    retrato(mega ? T.mega : T.dex, W * 0.68 + sh, H / 2 + sh * 0.5, z, -0.06 * ease((f - 8) / 14), '#ffffff', c2);
    // nome batendo na tela
    if (f > 12) {
      const k = ease((f - 12) / 7), s = lerp(2.4, 1, k);
      g.save(); g.translate(90, H / 2 - 40); g.scale(s, s); g.globalAlpha = c01((f - 12) / 4);
      texto(mega ? 'MEGA' : '', 4, -86, 46, c2, {});
      texto(T.nome, 0, 0, 118, '#ffffff', { borda: 12, bordaCor: c0 });
      g.restore(); g.globalAlpha = 1;
    }
    if (f > 22) {
      let x = 96; for (const [tp, cor] of T.tipos) { const w = 26 + tp.length * 18; g.fillStyle = cor; g.beginPath(); g.moveTo(x + 10, H / 2 + 30); g.lineTo(x + w, H / 2 + 30); g.lineTo(x + w - 10, H / 2 + 64); g.lineTo(x, H / 2 + 64); g.fill(); texto(tp, x + w / 2, H / 2 + 48, 22, '#ffffff', { al: 'center', sombra: false }); x += w + 12; }
      const n = Math.floor((f - 26) * 1.6); texto(T.frase.slice(0, Math.max(0, n)), 96, H / 2 + 110, 30, '#ffffff', {});
    }
    flash(f, 6);
    if (f > 80) { g.fillStyle = `rgba(255,255,255,${(f - 80) / 10})`; g.fillRect(0, 0, W, H); }
  }
  function cardMega(f) {
    g.fillStyle = '#05030a'; g.fillRect(0, 0, W, H);
    const k = ease(f / 18), cx = W / 2, cy = H / 2 - 30, R = 120 * k;
    const cores = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];
    raios(cx, cy, 20, f * 0.02, '#fde68a', 0.1 * k);
    g.lineWidth = 14; for (let i = 0; i < 5; i++) { g.strokeStyle = cores[i]; g.beginPath(); g.arc(cx, cy, R, f * 0.08 + (i * Math.PI * 2) / 5, f * 0.08 + ((i + 1) * Math.PI * 2) / 5); g.stroke(); }
    g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.beginPath(); g.arc(cx - R * 0.15, cy, R * 0.55, -1.2, 1.9); g.stroke(); g.beginPath(); g.arc(cx + R * 0.18, cy + R * 0.1, R * 0.3, 2, 5.4); g.stroke();
    if (f > 14) { const s = lerp(1.8, 1, ease((f - 14) / 8)); g.save(); g.translate(W / 2, H / 2 + 140); g.scale(s, s); const gr = g.createLinearGradient(0, -50, 0, 30); gr.addColorStop(0, '#fffbeb'); gr.addColorStop(1, '#f59e0b'); texto('MEGA EVOLUÇÃO', 0, 0, 84, gr, { al: 'center', borda: 10, bordaCor: '#1c0f00' }); g.restore(); }
    flash(f, 6, '255,236,170');
  }
  function cardFinal(f) {
    g.fillStyle = '#05030a'; g.fillRect(0, 0, W, H);
    const lista = [TEMAS.gengar, TEMAS.sceptile, TEMAS.zeraora], wp = W / 3;
    lista.forEach((T, i) => {
      const k = ease((f - i * 8) / 14); if (k <= 0) return;
      g.save(); g.beginPath(); const x0 = i * wp - 40, x1 = (i + 1) * wp + 40; g.moveTo(x0 + 80, 0); g.lineTo(x1 + 40, 0); g.lineTo(x1 - 40, H); g.lineTo(x0, H); g.closePath(); g.clip();
      g.translate(0, (1 - k) * (i % 2 ? -H : H));
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, T.c[1]); gr.addColorStop(1, T.c[0]); g.fillStyle = gr; g.fillRect(x0, 0, x1 - x0 + 80, H);
      linhasVelocidade(f + i * 50, T.c[2], 14);
      retrato(T.mega, i * wp + wp / 2 + 20, H / 2 - 40, 7.5, 0, '#ffffff', T.c[2]);
      texto('MEGA ' + T.nome, i * wp + wp / 2 + 10, H / 2 + 150, 34, '#ffffff', { al: 'center', borda: 6, bordaCor: T.c[0] });
      g.restore();
    });
    g.strokeStyle = '#ffffff'; g.lineWidth = 6; for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(i * wp + 80, 0); g.lineTo(i * wp, H); g.stroke(); }
    if (f > 50) { const k = ease((f - 50) / 10); g.fillStyle = `rgba(0,0,0,${0.55 * k})`; g.fillRect(0, 0, W, H); const s = lerp(2, 1, k); g.save(); g.translate(W / 2, H / 2 - 20); g.scale(s, s); g.globalAlpha = k; const gr = g.createLinearGradient(0, -60, 0, 40); gr.addColorStop(0, '#fff7d6'); gr.addColorStop(1, '#f59e0b'); texto('PK CONFRONT', 0, 0, 130, gr, { al: 'center', borda: 12, bordaCor: '#1c0f00' }); texto('NOVOS DESAFIANTES · JÁ NO JOGO', 0, 100, 34, '#ffffff', { al: 'center' }); g.restore(); g.globalAlpha = 1; }
    flash(f, 6);
    if (f > 108) { g.fillStyle = `rgba(0,0,0,${(f - 108) / 12})`; g.fillRect(0, 0, W, H); }
  }
  function cardFrase(f) {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const txt = 'não vou clonar teu Celular Lucas', n = Math.min(txt.length, Math.floor(f / 1.3));
    const gl = f > 44 && f < 50 ? (rnd(f) - 0.5) * 14 : 0;
    if (gl) { g.globalAlpha = 0.6; texto(txt, W / 2 + gl, H / 2, 64, '#ff3b5c', { al: 'center', sombra: false }); texto(txt, W / 2 - gl, H / 2, 64, '#22d3ee', { al: 'center', sombra: false }); g.globalAlpha = 1; }
    g.font = F(64); const x0 = W / 2 - g.measureText(txt).width / 2;
    texto(txt.slice(0, n) + (n < txt.length && f % 8 < 4 ? '_' : ''), x0, H / 2, 64, '#ffffff', {});
    if (f > 150) { g.fillStyle = `rgba(0,0,0,${(f - 150) / 20})`; g.fillRect(0, 0, W, H); }
  }

  // tela dividida em três: o jogo tem os três Pokémon lado a lado; cada painel é um recorte ampliado em volta de um deles
  function telaTripla(f) {
    const k = app.k ?? 2, wp = W / 3, Z = 2.5, lista = [[LS[0], TEMAS.gengar], [LS[1], TEMAS.sceptile], [LS[2], TEMAS.zeraora]];
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    lista.forEach(([l, T], i) => {
      const p = E.camara.aPantalla(l.x, l.y - l.alto * 0.55), cx = p.x * k, cy = p.y * k, sw = (wp + 120) / Z, sh = H / Z;
      const ent = ease((f - i * 4) / 10);
      g.save(); g.beginPath(); const x0 = i * wp; g.moveTo(x0 + 60, 0); g.lineTo(x0 + wp + 60, 0); g.lineTo(x0 + wp - 60, H); g.lineTo(x0 - 60, H); g.closePath(); g.clip();
      g.translate(0, (1 - ent) * (i % 2 ? -H : H));
      g.imageSmoothingEnabled = false;
      g.drawImage(gameCv, cx - sw / 2, cy - sh / 2, sw, sh, x0 - 60, 0, wp + 120, H);
      const gr = g.createLinearGradient(0, H - 200, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, T.c[0]); g.fillStyle = gr; g.fillRect(x0 - 60, H - 200, wp + 120, 200);
      texto((l.mega ? 'MEGA ' : '') + T.nome, x0 + wp / 2 - 20, H - 70, 34, '#ffffff', { al: 'center', borda: 6, bordaCor: T.c[0] });
      g.restore();
    });
    g.strokeStyle = '#ffffff'; g.lineWidth = 6; for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(i * wp + 60, 0); g.lineTo(i * wp - 60, H); g.stroke(); }
    if (f > 40 && f < 140) { const kk = ease((f - 40) / 8); g.globalAlpha = kk; texto('MEGA EVOLUÇÃO', W / 2, 56, 46, '#fde68a', { al: 'center', borda: 8, bordaCor: '#1c0f00' }); g.globalAlpha = 1; }
    flash(f, 5);
  }

  // ------------------------------------------------------------ roteiro
  const TG = TEMAS.gengar, TS = TEMAS.sceptile, TZ = TEMAS.zeraora;
  const SHOTS = [
    { n: 105, card: cardIntro },
    { n: 90, card: f => cardFace(f, TG) },
    { n: 300, pre: 20, setup: () => montar({ p1: 'gastly', p2: 'charmander', arena: 'halloween', etapas: [2, 2], pos: [[420, 222], [478, 222]] }),
      cam: f => (f < 36 ? { alvo: 'a', z: 3.4, dy: 26, vel: 2.5 } : f < 60 ? { alvo: 'b', z: 2.4, dy: 34 } : f < 110 ? { alvo: 'mid', z: 1.6, dy: 30 } : f < 150 ? { alvo: 'b', z: 2.1, dy: 32 } : f < 200 ? { alvo: 'mid', z: 1.3, dy: 40 } : { alvo: 'a', z: 1.15, dy: 80, vel: 3 }),
      acts: { 8: () => usar('lmb'), 18: () => usar('lmb'), 28: () => usar('lmb'), 38: () => usar('lmb'), 62: () => andar(-1), 82: () => andar(0), 86: () => usar('q'), 118: () => usar('esp'), 128: () => usar('lmb'), 165: () => usar('e'), 175: () => andar(Math.sign(B.x - A.x) * 0.8, Math.sign(B.y - A.y) * 0.2), 200: () => andar(0) },
      over: f => { letterbox(); tag('GENGAR', '#a855f7'); legenda(f, 6, 58, 'LAMBIDA FANTASMA', '4 marcas e o rival fica paralisado', '#7c3aed'); legenda(f, 84, 116, 'HYPNOSIS', 'agora maior: quem pega dorme', '#a21caf'); legenda(f, 116, 160, 'SHADOW SNEAK', 'só com o rival dormindo: surge nas costas', '#6d28d9'); legenda(f, 166, 290, 'PHANTOM FORCE', 'mergulha na sombra e volta com um fantasma gigante', '#4c1d95'); flash(f); } },
    { n: 90, card: f => cardFace(f, TS) },
    { n: 300, pre: 20, setup: () => montar({ p1: 'sceptile', p2: 'riolu', arena: 'ruinas', etapas: [2, 2], pos: [[400, 222], [480, 222]] }),
      cam: f => (f < 30 ? { alvo: 'a', z: 3.4, dy: 30, vel: 2.5 } : f < 62 ? { alvo: 'mid', z: 1.8, dy: 30 } : f < 90 ? { alvo: 'b', z: 2.3, dy: 30, vel: 6 } : f < 190 ? { alvo: 'mid', z: 1.25, dy: 30 } : f < 214 ? { alvo: 'a', z: 2.2, dy: 40, vel: 3 } : { alvo: 'mid', z: 1.25, dy: 40 }),
      acts: { 10: () => usar('q'), 34: () => usar('q'), 58: () => usar('lmb'), 96: () => andar(-1), 122: () => andar(0), 128: () => usar('rmb'), 176: () => andar(1), 186: () => andar(0), 196: () => usar('e') },
      over: f => { letterbox(); tag('SCEPTILE', '#22c55e'); legenda(f, 8, 56, 'LEAF HURRICANE', 'dash em meia-lua, duas vezes', '#15803d'); legenda(f, 56, 94, 'X DE FOLHAS', 'o básico depois do dash vira um X gigante', '#166534'); legenda(f, 126, 186, 'DRAGON PULSE', 'rajada rente ao chão que vai até o alvo', '#0f766e'); legenda(f, 196, 290, 'SOLAR BLADE', 'a luz do sol num corte gigante', '#b45309'); flash(f); } },
    { n: 90, card: f => cardFace(f, TZ) },
    { n: 240, pre: 20, setup: () => montar({ p1: 'zeraora', p2: 'squirtle', arena: 'neon', etapas: [2, 2], pos: [[420, 222], [470, 222]] }),
      cam: f => (f < 30 ? { alvo: 'a', z: 3.4, dy: 26, vel: 2.5 } : f < 120 ? { alvo: 'mid', z: 1.7, dy: 30 } : f < 175 ? { alvo: 'mid', z: 1.35, dy: 30 } : { alvo: 'b', z: 1.7, dy: 30 }),
      acts: { 8: () => usar('lmb'), 18: () => usar('lmb'), 28: () => usar('lmb'), 48: () => andar(-1), 66: () => andar(0), 70: () => usar('rmb'), 92: () => usar('rmb'), 126: () => usar('q'), 150: () => andar(-1), 160: () => andar(0), 172: () => usar('e') },
      over: f => { letterbox(); tag('ZERAORA', '#facc15'); legenda(f, 6, 46, 'PLASMA FISTS', 'combo elétrico que enche o plasma', '#a16207'); legenda(f, 68, 120, 'VOLT SWITCH', 'atira e se teleporta até o raio', '#ca8a04'); legenda(f, 124, 170, 'DISCHARGE', 'raio que pula de alvo em alvo', '#854d0e'); legenda(f, 172, 236, 'PLASMA OVERDRIVE', '', '#a16207'); flash(f); } },
    { n: 60, card: cardMega },
    { n: 165, pre: 20, setup: () => { montar({ modo: 'duplas', p1: 'gastly', p2: 'sceptile', p3: 'zeraora', p4: 'squirtle', arena: 'estadio', etapas: [2, 2, 2, 0], pos: [[330, 222], [480, 222], [630, 222], [480, 380]] }); for (const l of LS) l.angulo = Math.PI / 2; },
      cam: () => ({ alvo: { x: 480, y: 222 }, z: 0.95, dy: 30 }),
      acts: { 22: () => { for (const l of LS.slice(0, 3)) { l.ulti = 100; L.habilidades.megaevolucionar(l); } } },
      over: f => telaTripla(f) },
    { n: 165, pre: 20, setup: () => { montar({ p1: 'gastly', p2: 'charmander', arena: 'halloween', etapas: [2, 2], pos: [[360, 222], [600, 222]] }); A.mega = true; A.kit = A.kitActual(); },
      cam: f => (f < 30 ? { alvo: 'a', z: 2.6, dy: 50 } : f < 42 ? { alvo: 'a', z: 1.5, dy: 70 } : { alvo: 'b', z: 1.3, dy: 50, vel: 3 }),
      acts: { 8: () => usar('e') },
      over: f => { letterbox(); tag('MEGA GENGAR', '#a855f7'); legenda(f, 10, 150, 'NIGHTMARE BOMB', 'uma Shadow Ball gigante (quem dorme leva mais)', '#6d28d9'); flash(f); } },
    { n: 165, pre: 20, setup: () => { montar({ p1: 'sceptile', p2: 'riolu', arena: 'ruinas', etapas: [2, 2], pos: [[330, 222], [620, 250]] }); A.mega = true; A.kit = A.kitActual(); },
      cam: f => (f < 28 ? { alvo: 'b', z: 2.4, dy: 34, vel: 6 } : f < 110 ? { alvo: 'mid', z: 1.05, dy: 40 } : { alvo: 'b', z: 1.6, dy: 40 }),
      acts: { 6: () => usar('e') },
      over: f => { letterbox(); tag('MEGA SCEPTILE', '#22c55e'); legenda(f, 8, 150, 'TAIL MISSILE', 'trava a mira e dispara a cauda', '#b91c1c'); flash(f); } },
    { n: 150, pre: 20, setup: () => { montar({ p1: 'zeraora', p2: 'squirtle', arena: 'neon', etapas: [2, 2], pos: [[360, 222], [580, 222]] }); A.mega = true; A.kit = A.kitActual(); },
      cam: f => (f < 20 ? { alvo: 'a', z: 2.4, dy: 34 } : { alvo: 'b', z: 1.45, dy: 40, vel: 5 }),
      acts: { 8: () => usar('e') },
      over: f => { letterbox(); tag('MEGA ZERAORA', '#facc15'); legenda(f, 10, 140, 'THUNDER CAGE', 'uma jaula de raios', '#a16207'); flash(f); } },
    { n: 120, card: cardFinal },
    { n: 170, card: cardFrase },
  ];

  const TR = window.TR = {
    it: { mx: 0, my: 0 }, cam: null,
    shots: SHOTS.map(s => ({ n: s.n, pre: s.pre ?? 0 })),
    iniciar(i) { const s = SHOTS[i]; if (s.setup) s.setup(); },
    passo(i, f) {
      const s = SHOTS[i];
      g.clearRect(0, 0, W, H);
      if (s.cam) TR.cam = s.cam(Math.max(0, f));
      if (f >= 0 && s.acts?.[f]) s.acts[f]();
      if (f < 0) return;
      if (s.card) s.card(f); else s.over?.(f);
    },
    precarregar() { for (const d of ['0092', '0093', '0094', '0094-0001', '0252', '0253', '0254', '0254-0001', '0807', '0807-0001', '0004', '0005', '0006', '0447', '0448', '0007', '0008', '0009']) { const m = app.bank.medidas(d); app.bank.precargar(d, Object.keys(m.anims ?? {})); app.bank.precargar(d + 's', []); } },
  };
})();
