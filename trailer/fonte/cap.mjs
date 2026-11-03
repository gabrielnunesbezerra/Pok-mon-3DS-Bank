import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const SP = '/tmp/claude-0/-home-user-Pok-mon-3DS-Bank/5df0679f-1b07-5d27-8b5f-6a7d8d6b40b2/scratchpad/trailer';
const so = process.argv[2] ? process.argv[2].split(',').map(Number) : null; // só alguns planos (teste)
const passoTeste = +(process.argv[3] ?? 1);
mkdirSync(`${SP}/frames`, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on('console', m => { if (m.text().startsWith('FALHOU')) console.log(m.text()); });
page.on('pageerror', e => console.log('ERR', e.message, (e.stack ?? '').split('\n')[1]));
await page.clock.install({ time: new Date('2026-11-03T12:00:00') });
await page.goto('http://localhost:8080/');
for (let i = 0; i < 30; i++) { await page.clock.runFor(100); await page.waitForTimeout(40); }
await page.addScriptTag({ path: `${SP}/trailer.js` });
await page.evaluate(() => TR.precarregar());
for (let i = 0; i < 40; i++) { await page.clock.runFor(50); await page.waitForTimeout(60); }
const shots = await page.evaluate(() => TR.shots);
let gf = 0;
for (let i = 0; i < shots.length; i++) {
  const { n, pre } = shots[i];
  if (so && !so.includes(i)) { gf += n; continue; }
  await page.evaluate(i => TR.iniciar(i), i);
  for (let f = -pre; f < 0; f++) { await page.evaluate(([i, f]) => TR.passo(i, f), [i, f]); await page.clock.runFor(1000 / 30); }
  if (pre) await page.waitForTimeout(300);
  for (let f = 0; f < n; f++) {
    await page.evaluate(([i, f]) => TR.passo(i, f), [i, f]);
    await page.clock.runFor(1000 / 30);
    if (f % passoTeste === 0) await page.screenshot({ path: `${SP}/${process.env.OUT ?? 'frames'}/${String(gf + f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  }
  gf += n;
  console.log('plano', i, 'ok');
}
await browser.close();
