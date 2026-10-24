// Servidor de teste que imita o Firebase (login por e-mail e senha, Realtime Database por REST e
// Server-Sent Events). Só para testar o jogo sem internet: não guarda nada em disco e não tem regras.
//   node scripts/fake-firebase.mjs        (porta 9099)
// No jogo: globalThis.PK_FIREBASE = { db: 'http://localhost:9099/db', auth: 'http://localhost:9099/auth', token: 'http://localhost:9099/token' }
import { createServer } from 'node:http';

const contas = new Map(); // email -> { uid, senha }
let raiz = {};
const assinantes = new Set(); // { caminho: [..], res }

const partes = p => p.split('/').filter(Boolean);
const pegar = (ps) => { let n = raiz; for (const k of ps) { if (n == null || typeof n !== 'object') return null; n = n[k]; } return n ?? null; };
const limpar = v => { if (v && typeof v === 'object') { for (const k of Object.keys(v)) { v[k] = limpar(v[k]); if (v[k] == null) delete v[k]; } return Object.keys(v).length ? v : null; } return v; };
function definir(ps, v) {
  if (!ps.length) { raiz = limpar(structuredClone(v)) ?? {}; return; }
  let n = raiz;
  for (let i = 0; i < ps.length - 1; i++) { if (!n[ps[i]] || typeof n[ps[i]] !== 'object') n[ps[i]] = {}; n = n[ps[i]]; }
  const c = limpar(v == null ? null : structuredClone(v));
  if (c == null) delete n[ps.at(-1)]; else n[ps.at(-1)] = c;
  raiz = limpar(raiz) ?? {};
}
const comeca = (a, b) => b.every((k, i) => a[i] === k);
function avisar(ps, tipo, dados) {
  for (const s of assinantes) {
    if (comeca(ps, s.caminho)) s.res.write(`event: ${tipo}\ndata: ${JSON.stringify({ path: '/' + ps.slice(s.caminho.length).join('/'), data: dados })}\n\n`);
    else if (comeca(s.caminho, ps)) s.res.write(`event: put\ndata: ${JSON.stringify({ path: '/', data: pegar(s.caminho) })}\n\n`);
  }
}
const corpo = req => new Promise(ok => { let b = ''; req.on('data', d => (b += d)); req.on('end', () => ok(b)); });
const json = (res, st, v) => { res.writeHead(st, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(v)); };
const sessao = (uid, email) => ({ localId: uid, email, idToken: `tok-${uid}-${Date.now()}`, refreshToken: `ref-${uid}`, expiresIn: '3600' });

const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,PATCH,DELETE,POST', 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }
  if (u.pathname.startsWith('/auth/accounts:')) {
    const b = JSON.parse((await corpo(req)) || '{}'), metodo = u.pathname.split(':')[1];
    if (metodo === 'signUp') { if (contas.has(b.email)) return json(res, 400, { error: { message: 'EMAIL_EXISTS' } }); const uid = 'u' + Math.random().toString(36).slice(2, 10); contas.set(b.email, { uid, senha: b.password }); return json(res, 200, sessao(uid, b.email)); }
    if (metodo === 'signInWithPassword') { const c = contas.get(b.email); if (!c || c.senha !== b.password) return json(res, 400, { error: { message: 'INVALID_LOGIN_CREDENTIALS' } }); return json(res, 200, sessao(c.uid, b.email)); }
    if (metodo === 'delete') return json(res, 200, {});
    return json(res, 404, {});
  }
  if (u.pathname.startsWith('/token/token')) { const b = new URLSearchParams(await corpo(req)); const uid = String(b.get('refresh_token')).replace('ref-', ''); return json(res, 200, { id_token: `tok-${uid}-${Date.now()}`, refresh_token: `ref-${uid}`, user_id: uid, expires_in: '3600' }); }
  if (u.pathname.startsWith('/db/')) {
    const ps = partes(decodeURIComponent(u.pathname.slice(4).replace(/\.json$/, '')));
    if (req.method === 'GET' && (req.headers.accept ?? '').includes('text/event-stream')) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
      const s = { caminho: ps, res };
      assinantes.add(s);
      res.write(`event: put\ndata: ${JSON.stringify({ path: '/', data: pegar(ps) })}\n\n`);
      const vivo = setInterval(() => res.write('event: keep-alive\ndata: null\n\n'), 15000);
      req.on('close', () => { clearInterval(vivo); assinantes.delete(s); });
      return;
    }
    if (req.method === 'GET') return json(res, 200, pegar(ps));
    if (req.method === 'PUT') { const v = JSON.parse((await corpo(req)) || 'null'); definir(ps, v); avisar(ps, 'put', v); return json(res, 200, v); }
    if (req.method === 'PATCH') { const v = JSON.parse((await corpo(req)) || '{}'); for (const [k, x] of Object.entries(v)) definir([...ps, ...partes(k)], x); avisar(ps, 'patch', v); return json(res, 200, v); }
    if (req.method === 'DELETE') { definir(ps, null); avisar(ps, 'put', null); return json(res, 200, null); }
  }
  json(res, 404, { error: 'not found' });
});
const porta = Number(process.env.PORT || 9099);
server.listen(porta, () => console.log(`Firebase falso em http://localhost:${porta}`));
