// Gerador aleatório com semente (mulberry32), para os testes serem repetíveis e para o modo
// online rodar a mesma batalha nos dois aparelhos. O estado fica em "s" para poder ser salvo.
export function makeRng(seed = Date.now()) {
  const r = { s: seed >>> 0 };
  r.next = () => {
    r.s = (r.s + 0x6d2b79f5) >>> 0;
    let t = r.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.chance = pct => r.next() * 100 < pct;
  r.int = (min, max) => min + Math.floor(r.next() * (max - min + 1));
  r.range = (min, max) => min + r.next() * (max - min);
  r.pick = list => list[Math.floor(r.next() * list.length)];
  return r;
}
