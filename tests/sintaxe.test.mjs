// Todo arquivo do jogo tem que ser JavaScript válido (um erro de sintaxe numa tela deixa o jogo inteiro sem abrir)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const arquivos = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? arquivos(p) : p.endsWith('.js') ? [p] : []; });

test('todos os arquivos .js do jogo passam no node --check', () => {
  const ruins = arquivos(new URL('../www/js', import.meta.url).pathname).filter(f => spawnSync(process.execPath, ['--check', f]).status !== 0);
  assert.deepEqual(ruins, []);
});
