# Arena 2D Champion

Batalha de Pokémon em tempo real numa arena 2D vista de cima, inspirada no "Pokémon Arena" que circula nas redes. Projeto de fã, sem fins lucrativos, feito para estudo.

## O que tem

- **6 Pokémon**: Venusaur, Charizard, Blastoise, Weavile, Steelix e Gengar, com times de até 3.
- **Todos os golpes que eles podem aprender**: 356 golpes no total (nível, TM, tutor, ovo e evento, de todas as gerações, contando as pré-evoluções). Cada um funciona como nos jogos: mesmo poder, precisão, tipo, categoria, efeitos secundários, prioridade, golpes de dois turnos, recarga do Hyper Beam, Protect, Substitute, Leech Seed, Rollout, Outrage, Counter, Baton Pass, Roar, Metronome, Sleep Talk, Perish Song, Destiny Bond, Trick Room e por aí vai.
- **Fórmula de dano dos jogos** (nível 50), conferida contra a calculadora do Smogon: STAB, tipos, crítico, clima, terreno, telas, habilidades e itens.
- **Habilidades** de todos, inclusive as das Megas (Thick Fat, Tough Claws, Drought, Mega Launcher, Sand Force, Shadow Tag).
- **Mega Evolução** de Venusaur, Charizard (X e Y), Blastoise, Steelix e Gengar, com sprites das Megas. A barra de Mega fica em volta do treinador e enche com dano causado, dano recebido e esquivas no último instante.
- **Choque de Megas**: se os dois treinadores Mega Evoluem juntos, as Megas criam um clima especial (Sol Extremo, Chuva Torrencial, Tempestade Mega com raios, Tempestade de Areia...).
- **Choque de raios**: quando dois golpes de raio se encontram (Solar Beam x Hydro Pump, Flamethrower x Hydro Pump...), começa um minigame de tocar rápido.
- **Atributos temporários**: Swords Dance, Dragon Dance e companhia aumentam o atributo por um tempo, depois ele volta aos poucos.
- **Esquiva em dash** com invencibilidade e rastro, **stamina e recarga** em cada golpe.
- **Treinadores dos jogos e do anime** (Ash, Red, Blue, Misty, Brock, Dawn, Cynthia, Lance, Steven, Iris e outros), com apresentação "VS" e corte de Mega Evolução.
- **Estádio grande** com câmera que acompanha a luta. Surf, Earthquake, Heat Wave e outros golpes de área pegam boa parte do campo e deixam marcas no chão.
- **Modos**: contra a CPU (3 dificuldades), online com código de sala e 2 jogadores no mesmo celular (ou teclado/controle).

## Online

Um jogador toca em CRIAR SALA e recebe um código de 5 letras; o outro toca em ENTRAR e digita o código. A conexão é direta entre os aparelhos (WebRTC, pela biblioteca PeerJS); o servidor público do PeerJS só serve para os dois se encontrarem. Os dois aparelhos rodam a mesma simulação e trocam apenas os comandos de cada quadro, com alguns quadros de atraso conforme a rede. De tempos em tempos eles comparam um resumo do estado e, se algo divergir, quem criou a sala manda o estado completo. Os dois precisam de internet e da mesma versão do jogo.

## Como jogar no celular

O APK é compilado pelo GitHub Actions a cada atualização e fica na página **Releases** do repositório (release `arena-apk`). Baixe o `ArenaChampion.apk` no celular, abra e permita instalar de fontes desconhecidas.

## Repositório próprio

Esta pasta já funciona como raiz de um repositório separado (por exemplo `ARENA-2D-CAHMPION`): copie o conteúdo dela para a raiz do outro repositório e o workflow `.github/workflows/apk.yml` passa a compilar o APK e publicar na release `apk` a cada push.

## Como rodar no computador

```bash
npm install
npm run serve     # abre em http://localhost:8080
npm test          # simula todos os golpes, as mecânicas e o modo online
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
  js/net/            modo online (lockstep.js: simulação sincronizada; online.js: salas)
  js/ui/menus.js     telas de menu
  vendor/            PeerJS (MIT)
  js/data/           dados gerados (golpes, aprendizado) e escritos à mão
android/             projeto Android (Capacitor)
scripts/             geração de dados, download de sprites, servidor local
tests/               testes do motor
```

Os dados dos golpes vêm do Pokémon Showdown (`npm run gen-data` gera de novo) e os sprites do PMD SpriteCollab e do Smogon Sprite Project (`npm run fetch-assets`).

## Créditos

- Dados: Pokémon Showdown (@pkmn/dex).
- Sprites e retratos: PMD Sprite Repository (SpriteCollab), CC BY-NC 4.0. Os autores de cada sprite estão em `www/assets/credits.json` e na tela de créditos do jogo.
- Treinadores e Megas no estilo Black/White (Mega Venusaur, Mega Charizard Y, Mega Blastoise): Smogon Sprite Project (smogon/sprites).
- Artes oficiais: PokeAPI/sprites.
- Conexão online: PeerJS (MIT).
- Fontes: Press Start 2P e Pixelify Sans (SIL OFL 1.1).

Pokémon © Nintendo, Creatures Inc. e GAME FREAK inc. Este projeto não tem ligação com elas.

A chave `android/app/arena-debug.keystore` é uma chave de depuração pública (senha `android`), só para os APKs novos instalarem por cima dos antigos. Ela não deve ser usada para publicar em loja.
