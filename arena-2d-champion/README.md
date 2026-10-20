# Arena 2D Champion

Batalha de Pokémon em tempo real numa arena 2D vista de cima, inspirada no "Pokémon Arena" que circula nas redes. Projeto de fã, sem fins lucrativos, feito para estudo.

## O que tem

- **4 Pokémon**: Venusaur, Charizard, Blastoise e Weavile, com times de até 3.
- **Todos os golpes que eles podem aprender**: 286 golpes no total (nível, TM, tutor, ovo e evento, de todas as gerações, contando as pré-evoluções). Cada um funciona como nos jogos: mesmo poder, precisão, tipo, categoria, efeitos secundários, prioridade, golpes de dois turnos, recarga do Hyper Beam, Protect, Substitute, Leech Seed, Rollout, Outrage, Counter, Baton Pass, Roar, Metronome, Sleep Talk e por aí vai.
- **Fórmula de dano dos jogos** (nível 50), conferida contra a calculadora do Smogon: STAB, tipos, crítico, clima, terreno, telas, habilidades e itens.
- **Habilidades**: Overgrow, Chlorophyll, Blaze, Solar Power, Torrent, Rain Dish, Pressure, Pickpocket e as das Megas (Thick Fat, Tough Claws, Drought, Mega Launcher).
- **Mega Evolução** de Venusaur, Charizard (X e Y) e Blastoise. A barra de Mega enche com dano causado, dano recebido e esquivas no último instante.
- **Choque de Megas**: se os dois treinadores Mega Evoluem juntos, as Megas criam um clima especial (Sol Extremo, Chuva Torrencial, Tempestade Mega com raios, Chuva Primaveril...).
- **Choque de raios**: quando dois golpes de raio se encontram (Solar Beam x Hydro Pump, Flamethrower x Hydro Pump...), começa um minigame de tocar rápido.
- **Clima de verdade**: Solar Beam sem carga no sol, Hurricane que não erra na chuva, Synthesis que cura mais no sol, Weather Ball que muda de tipo...
- **Interações na arena**: projéteis se chocam no ar, fogo com água vira vapor que atrapalha a mira, fogo acende a grama, água apaga, gelo congela a água do Campo Aquático.
- **Stamina e recarga** em cada golpe, **esquiva** com invencibilidade, troca de Pokémon, 3 arenas, IA em 3 dificuldades e modo 2 jogadores no mesmo aparelho (ou teclado/controle).

## Como jogar no celular

O APK é compilado pelo GitHub Actions a cada atualização e fica na página **Releases** do repositório (release `arena-apk`). Baixe o `ArenaChampion.apk` no celular, abra e permita instalar de fontes desconhecidas.

## Repositório próprio

Esta pasta já funciona como raiz de um repositório separado (por exemplo `ARENA-2D-CAHMPION`): copie o conteúdo dela para a raiz do outro repositório e o workflow `.github/workflows/apk.yml` passa a compilar o APK e publicar na release `apk` a cada push.

## Como rodar no computador

```bash
npm install
npm run serve     # abre em http://localhost:8080
npm test          # simula todos os golpes e confere que nada quebra
```

Controles no teclado: `WASD` anda, `J` `K` `L` `;` (ou `1`-`4`) usam os golpes, `Espaço` esquiva, `E` Mega Evolução, `Z` `X` `C` trocam de Pokémon, `Esc` pausa.

## Estrutura

```
www/                 o jogo (HTML + JavaScript puro, sem framework)
  js/engine/         motor da batalha (roda também no Node, sem navegador)
    battle.js        loop, entidades, clima, troca, Mega, choques
    actions.js       uso e execução dos golpes
    hit.js           precisão, dano, status, atributos, itens
    shapes.js        a "forma" de cada golpe na arena (raio, projétil, onda...)
    ai.js            treinador do computador
  js/render/         desenho (canvas): arena, sprites, efeitos, HUD
  js/ui/menus.js     telas de menu
  js/data/           dados gerados (golpes, aprendizado) e escritos à mão
android/             projeto Android (Capacitor)
scripts/             geração de dados, download de sprites, servidor local
tests/               testes do motor
```

Os dados dos golpes vêm do Pokémon Showdown (`npm run gen-data` gera de novo) e os sprites do PMD SpriteCollab (`npm run fetch-assets`).

## Créditos

- Dados: Pokémon Showdown (@pkmn/dex).
- Sprites e retratos: PMD Sprite Repository (SpriteCollab), CC BY-NC 4.0. Os autores de cada sprite estão em `www/assets/credits.json` e na tela de créditos do jogo.
- Artes oficiais: PokeAPI/sprites.
- Fontes: Press Start 2P e Pixelify Sans (SIL OFL 1.1).

Pokémon © Nintendo, Creatures Inc. e GAME FREAK inc. Este projeto não tem ligação com elas.

A chave `android/app/arena-debug.keystore` é uma chave de depuração pública (senha `android`), só para os APKs novos instalarem por cima dos antigos. Ela não deve ser usada para publicar em loja.
