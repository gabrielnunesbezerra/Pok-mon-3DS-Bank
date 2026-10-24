// Conta e nuvem pelo Firebase do Poke Bank (mesmo projeto, mesmas contas): login com usuário e senha,
// banco de dados em tempo real pela API REST e escuta por Server-Sent Events. Nenhuma biblioteca externa.
// O endereço pode ser trocado por globalThis.PK_FIREBASE (servidor de teste local).
const CFG = {
  apiKey: 'AIzaSyC60Y7TatOmUtsHQ2Nr9g4JDmCbHsaTE0w',
  db: 'https://ds-bank-92a42-default-rtdb.firebaseio.com',
  auth: 'https://identitytoolkit.googleapis.com/v1',
  token: 'https://securetoken.googleapis.com/v1',
  dominio: 'users.3dsbank.app',
  ...(globalThis.PK_FIREBASE ?? {}),
};
const CLAVE = 'pkconfront.cuenta';
export const normalizarNombre = s => { const n = String(s ?? '').trim().toLowerCase(); return /^[a-z0-9._]{3,20}$/.test(n) ? n : null; };
export const claveNombre = n => n.replace(/\./g, ',');

const ERROS = {
  EMAIL_EXISTS: 'THAT USERNAME IS TAKEN', INVALID_LOGIN_CREDENTIALS: 'WRONG USERNAME OR PASSWORD', INVALID_PASSWORD: 'WRONG USERNAME OR PASSWORD',
  EMAIL_NOT_FOUND: 'WRONG USERNAME OR PASSWORD', WEAK_PASSWORD: 'PASSWORD NEEDS 6+ CHARACTERS', TOO_MANY_ATTEMPTS_TRY_LATER: 'TOO MANY TRIES, WAIT A BIT', USER_DISABLED: 'ACCOUNT DISABLED',
};
const erroDe = j => { const c = String(j?.error?.message ?? '').split(' ')[0]; return new Error(ERROS[c] ?? (c || 'NO CONNECTION')); };

async function pedir(url, opts = {}) {
  let r;
  try { r = await fetch(url, opts); } catch { throw new Error('NO CONNECTION'); }
  const txt = await r.text();
  let j = null; try { j = txt ? JSON.parse(txt) : null; } catch { j = null; }
  if (!r.ok) { const e = r.status === 401 || r.status === 403 ? new Error('PERMISSION DENIED') : erroDe(j); e.status = r.status; throw e; }
  return j;
}

class Cuenta {
  constructor() {
    this.sesion = null;
    try { this.sesion = JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch { this.sesion = null; }
    this.oyentes = new Set();
  }
  get conectado() { return !!this.sesion; }
  get uid() { return this.sesion?.uid ?? null; }
  get nombre() { return this.sesion?.nombre ?? null; }
  alCambiar(fn) { this.oyentes.add(fn); return () => this.oyentes.delete(fn); }
  guardar(s) {
    this.sesion = s;
    try { s ? localStorage.setItem(CLAVE, JSON.stringify(s)) : localStorage.removeItem(CLAVE); } catch { /* sem armazenamento */ }
    for (const fn of this.oyentes) fn(s);
  }

  async auth(metodo, email, password) {
    const j = await pedir(`${CFG.auth}/accounts:${metodo}?key=${CFG.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
    return { uid: j.localId, idToken: j.idToken, refresh: j.refreshToken, expira: Date.now() + (Number(j.expiresIn) || 3600) * 1000 };
  }

  // conta nova: usuário + senha. O nome fica reservado em usernames/ como no Poke Bank.
  async crear(nombreBruto, password) {
    const nombre = normalizarNombre(nombreBruto);
    if (!nombre) throw new Error('USERNAME: 3 TO 20 LETTERS, NUMBERS, . OR _');
    if (String(password).length < 6) throw new Error('PASSWORD NEEDS 6+ CHARACTERS');
    const s = await this.auth('signUp', `${nombre}@${CFG.dominio}`, password);
    s.nombre = nombre;
    this.sesion = s;
    try {
      const dono = await this.get(`usernames/${claveNombre(nombre)}`);
      if (dono && dono !== s.uid) throw new Error('THAT USERNAME IS TAKEN');
      if (!dono) await this.put(`usernames/${claveNombre(nombre)}`, s.uid);
      await this.patch(`profiles/${s.uid}`, { username: nombre });
    } catch (e) {
      await pedir(`${CFG.auth}/accounts:delete?key=${CFG.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: s.idToken }) }).catch(() => {});
      this.sesion = null;
      throw e;
    }
    this.guardar(s);
    return s;
  }

  // entra com usuário (ou o e-mail da conta do Poke Bank) e senha
  async entrar(identificador, password) {
    const txt = String(identificador ?? '').trim();
    let email, nombre = null;
    if (txt.includes('@')) email = txt;
    else { nombre = normalizarNombre(txt); if (!nombre) throw new Error('WRONG USERNAME OR PASSWORD'); email = `${nombre}@${CFG.dominio}`; }
    const s = await this.auth('signInWithPassword', email, password);
    this.sesion = s;
    if (!nombre) nombre = normalizarNombre(await this.get(`profiles/${s.uid}/username`).catch(() => null)) ?? txt.split('@')[0].slice(0, 20);
    else await this.patch(`profiles/${s.uid}`, { username: nombre }).catch(() => {});
    s.nombre = nombre;
    this.guardar(s);
    return s;
  }
  salir() { this.guardar(null); }

  // token válido (renova uns minutos antes de vencer)
  async token() {
    const s = this.sesion;
    if (!s) throw new Error('NOT SIGNED IN');
    if (Date.now() < s.expira - 120000) return s.idToken;
    const j = await pedir(`${CFG.token}/token?key=${CFG.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refresh)}` });
    const n = { ...s, idToken: j.id_token, refresh: j.refresh_token, expira: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
    this.guardar(n);
    return n.idToken;
  }
  async url(path) { return `${CFG.db}/${path}.json?auth=${encodeURIComponent(await this.token())}`; }
  async get(path) { return pedir(await this.url(path)); }
  async put(path, v) { return pedir(await this.url(path), { method: 'PUT', body: JSON.stringify(v) }); }
  async patch(path, v) { return pedir(await this.url(path), { method: 'PATCH', body: JSON.stringify(v) }); }
  async del(path) { return pedir(await this.url(path), { method: 'DELETE' }); }

  // escuta um caminho em tempo real: mantém uma cópia local e chama fn(dados) a cada mudança
  escuchar(path, fn) {
    let es = null, fechado = false, dados = null, tentativas = 0;
    // "put" troca o valor no caminho; "patch" troca cada filho (as chaves podem ser caminhos "a/b")
    const aplicar = (rel, valor, mesclar) => {
      if (mesclar && valor && typeof valor === 'object') { for (const [k, v] of Object.entries(valor)) aplicar(`${rel}/${k}`, v, false); return; }
      const partes = rel.split('/').filter(Boolean);
      if (!partes.length) { dados = valor; return; }
      if (!dados || typeof dados !== 'object') dados = {};
      let n = dados;
      for (let i = 0; i < partes.length - 1; i++) { if (!n[partes[i]] || typeof n[partes[i]] !== 'object') n[partes[i]] = {}; n = n[partes[i]]; }
      if (valor === null) delete n[partes.at(-1)]; else n[partes.at(-1)] = valor;
    };
    const abrir = async () => {
      if (fechado) return;
      let u;
      try { u = await this.url(path); } catch { return setTimeout(abrir, 3000); }
      es = new EventSource(u);
      const ev = (tipo, mesclar) => es.addEventListener(tipo, e => { tentativas = 0; let j; try { j = JSON.parse(e.data); } catch { return; } if (!j) return; aplicar(j.path ?? '/', j.data, mesclar); fn(dados); });
      ev('put', false); ev('patch', true);
      const reabrir = () => { es?.close(); es = null; if (!fechado) setTimeout(abrir, Math.min(8000, 500 * 2 ** tentativas++)); };
      es.addEventListener('auth_revoked', reabrir);
      es.addEventListener('cancel', reabrir);
      es.onerror = () => { if (es?.readyState === 2) reabrir(); };
    };
    abrir();
    return () => { fechado = true; es?.close(); };
  }
}

export const cuenta = new Cuenta();
export const CONFIG_FIREBASE = CFG;
