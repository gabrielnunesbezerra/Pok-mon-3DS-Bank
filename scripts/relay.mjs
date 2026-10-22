// Servidor de salas do PK confront: liga dois jogadores por um código de 4 letras e repassa as mensagens.
// Não entende o jogo, só repassa texto. Usa só o Node (WebSocket escrito à mão).
//   npm run relay            servidor sozinho (porta 8081)
//   npm run serve            site + servidor de salas juntos (porta 8080, caminho /relay)
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function enviar(socket, texto) {
  const p = Buffer.from(texto);
  const cab = p.length < 126 ? Buffer.from([0x81, p.length]) : p.length < 65536 ? Buffer.from([0x81, 126, p.length >> 8, p.length & 255]) : null;
  if (!cab || socket.destroyed) return;
  socket.write(Buffer.concat([cab, p]));
}

export function anexarRelay(server, ruta = '/relay') {
  const salas = new Map();
  const codigo = () => { for (;;) { const c = Array.from({ length: 4 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join(''); if (!salas.has(c)) return c; } };

  const MAX = 4;
  function salir(c) {
    if (c.cerrado) return;
    c.cerrado = true;
    const s = c.sala && salas.get(c.sala);
    if (s) {
      const i = s.m.indexOf(c);
      s.m.splice(i, 1);
      if (i === 0 || s.m.length === 0) {
        // o anfitrião saiu: a sala acaba
        for (const o of s.m) enviar(o.socket, JSON.stringify({ t: 'adios' }));
        salas.delete(c.sala);
      } else for (const o of s.m) enviar(o.socket, JSON.stringify({ t: 'salio', slot: i, n: s.m.length }));
    }
    c.socket.destroy();
  }

  function mensaje(c, texto) {
    let m;
    try { m = JSON.parse(texto); } catch { return; }
    if (m.t === 'crear' && !c.sala) {
      const cod = codigo();
      salas.set(cod, { m: [c], desde: Date.now(), iniciada: false });
      c.sala = cod;
      return enviar(c.socket, JSON.stringify({ t: 'sala', codigo: cod, rol: 'host', slot: 0 }));
    }
    if (m.t === 'unir' && !c.sala) {
      const cod = String(m.codigo ?? '').toUpperCase().trim(), s = salas.get(cod);
      if (!s) return enviar(c.socket, JSON.stringify({ t: 'error', msg: 'ROOM NOT FOUND' }));
      if (s.m.length >= MAX || s.iniciada) return enviar(c.socket, JSON.stringify({ t: 'error', msg: s.iniciada ? 'FIGHT ALREADY STARTED' : 'ROOM FULL' }));
      s.m.push(c); c.sala = cod;
      enviar(c.socket, JSON.stringify({ t: 'sala', codigo: cod, rol: 'guest', slot: s.m.length - 1 }));
      for (const o of s.m) enviar(o.socket, JSON.stringify({ t: 'par', n: s.m.length }));
      return;
    }
    const s = c.sala && salas.get(c.sala);
    if (!s) return;
    if (m.t === 'ir' && s.m[0] === c) s.iniciada = true;
    for (const o of s.m) if (o !== c) enviar(o.socket, texto);
  }

  function leer(c) {
    for (;;) {
      const b = c.buf;
      if (b.length < 2) return;
      const op = b[0] & 15, enmascarado = !!(b[1] & 128);
      let n = b[1] & 127, pos = 2;
      if (n === 126) { if (b.length < 4) return; n = b.readUInt16BE(2); pos = 4; }
      else if (n === 127) return salir(c);
      if (!enmascarado || n > 60000) return salir(c);
      if (b.length < pos + 4 + n) return;
      const mask = b.subarray(pos, pos + 4), dato = Buffer.from(b.subarray(pos + 4, pos + 4 + n));
      for (let i = 0; i < n; i++) dato[i] ^= mask[i & 3];
      c.buf = b.subarray(pos + 4 + n);
      if (op === 1) mensaje(c, dato.toString('utf8'));
      else if (op === 8) return salir(c);
      else if (op === 9) c.socket.write(Buffer.concat([Buffer.from([0x8a, dato.length]), dato]));
    }
  }

  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (new URL(req.url, 'http://x').pathname !== ruta || !key) { socket.destroy(); return; }
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${createHash('sha1').update(key + GUID).digest('base64')}\r\n\r\n`);
    socket.setNoDelay(true);
    const c = { socket, sala: null, buf: Buffer.alloc(0), cerrado: false };
    socket.on('data', d => { c.buf = Buffer.concat([c.buf, d]); leer(c); });
    socket.on('close', () => salir(c));
    socket.on('error', () => salir(c));
  });
  // limpa salas esquecidas
  setInterval(() => { for (const [k, s] of salas) if (!s.iniciada && Date.now() - s.desde > 30 * 60e3) { for (const o of s.m) o.socket.destroy(); salas.delete(k); } }, 60e3).unref();
  return salas;
}

// servidor sozinho
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('PK confront relay'); });
  anexarRelay(server);
  const port = Number(process.env.PORT || 8081);
  server.listen(port, () => console.log(`Servidor de salas em ws://localhost:${port}/relay`));
}
