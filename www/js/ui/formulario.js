// Formulário por cima do jogo (usuário, senha, código): campos de verdade do navegador, para o teclado do
// celular aparecer e a senha ficar escondida. pedirFormulario(...) devolve os valores ou null se cancelar.
let aberto = null;

export function pedirFormulario({ titulo, campos, ok = 'OK', cancelar = 'CANCEL', nota = '' }) {
  if (aberto) aberto.fechar(null);
  return new Promise(resolve => {
    const fundo = document.createElement('div');
    fundo.className = 'pk-form-fundo';
    const caixa = document.createElement('form');
    caixa.className = 'pk-form';
    caixa.innerHTML = `<h2></h2>${nota ? '<p class="pk-form-nota"></p>' : ''}<div class="pk-form-campos"></div><p class="pk-form-erro"></p><div class="pk-form-botoes"><button type="button" class="pk-cancelar"></button><button type="submit" class="pk-ok"></button></div>`;
    caixa.querySelector('h2').textContent = titulo;
    if (nota) caixa.querySelector('.pk-form-nota').textContent = nota;
    caixa.querySelector('.pk-ok').textContent = ok;
    caixa.querySelector('.pk-cancelar').textContent = cancelar;
    const lista = caixa.querySelector('.pk-form-campos'), entradas = {};
    for (const c of campos) {
      const l = document.createElement('label');
      l.textContent = c.rotulo;
      const i = document.createElement('input');
      i.type = c.tipo ?? 'text'; i.value = c.valor ?? ''; i.autocomplete = c.autocomplete ?? 'off';
      i.autocapitalize = 'none'; i.spellcheck = false; if (c.max) i.maxLength = c.max;
      l.appendChild(i); lista.appendChild(l); entradas[c.id] = i;
    }
    const fechar = v => { if (!aberto) return; aberto = null; fundo.remove(); resolve(v); };
    caixa.addEventListener('submit', e => { e.preventDefault(); fechar(Object.fromEntries(Object.entries(entradas).map(([k, i]) => [k, i.value]))); });
    caixa.querySelector('.pk-cancelar').addEventListener('click', () => fechar(null));
    fundo.addEventListener('pointerdown', e => { if (e.target === fundo) fechar(null); });
    // as teclas digitadas não chegam ao jogo enquanto o formulário está aberto
    caixa.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') fechar(null); });
    fundo.appendChild(caixa);
    document.body.appendChild(fundo);
    aberto = { fechar };
    setTimeout(() => campos.length && entradas[campos[0].id].focus(), 30);
  });
}
export const formularioAberto = () => !!aberto;
