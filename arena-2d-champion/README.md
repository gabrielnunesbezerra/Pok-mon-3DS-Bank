# Arena 2D Champion

Batalha de Pokémon em tempo real numa arena 2D vista de cima, inspirada no "Pokémon Arena" que circula nas redes. Projeto de fã, sem fins lucrativos, feito para estudo.

## O que tem

- **17 Pokémon**: Venusaur, Charizard, Blastoise, Weavile, Steelix, Gengar, Lucario, Gardevoir, Tyranitar, Absol, Manectric, Altaria, Alakazam, Houndoom, Gallade, Aerodactyl e Golisopod, com times de até 3.
- **Golpes que valem a pena**: 323 golpes na Golpedex. Saíram os que quase ninguém usa (Tackle, Growl, Leer, Ember, Water Gun, Swagger, Metronome, golpes de nocaute instantâneo, golpes que só servem em batalha dupla e afins). Ficou o que aparece nos times de competição do Smogon, o que tem efeito útil e os golpes de dano com poder 60 ou mais e boa precisão. Cada um funciona como nos jogos: mesmo poder, precisão, tipo, categoria, efeitos secundários, prioridade, golpes de dois turnos, recarga do Hyper Beam, Protect, Substitute, Leech Seed, Wish, Future Sight, Spikes, terrenos, Trick Room e por aí vai.
- **Efeito próprio para cada golpe**: socos, chutes, mordidas, garras, cortes, raios, projéteis e golpes de área têm desenhos diferentes (Fire Punch é um punho em chamas, Ice Fang são presas de gelo, Sacred Sword é uma espada dourada, Moonblast é uma lua, Draco Meteor faz meteoros caírem), em vez da mesma imagem com outra cor.
- **Fórmula de dano dos jogos** (nível 50), conferida contra a calculadora do Smogon: STAB, tipos, crítico, clima, terreno, telas, habilidades e itens.
- **Habilidades** de todos, inclusive as das Megas (Thick Fat, Tough Claws, Drought, Mega Launcher, Sand Force, Shadow Tag, Adaptability, Pixilate, Magic Bounce, Intimidate, Lightning Rod, Magic Guard e outras).
- **17 Mega Evoluções**, uma para cada Pokémon com Mega (Charizard tem X e Y), todas animadas. A barra de Mega fica em volta do treinador e enche com dano causado, dano recebido e esquivas no último instante.
- **Choque de Megas**: se os dois treinadores Mega Evoluem juntos, as Megas criam um clima especial (Sol Extremo, Chuva Torrencial, Tempestade Mega com raios, Tempestade de Areia...).
- **Choque de raios**: quando dois golpes de raio se encontram (Solar Beam x Hydro Pump, Flamethrower x Hydro Pump...), começa um minigame de tocar rápido.
- **Atributos temporários**: Swords Dance, Dragon Dance e companhia aumentam o atributo por um tempo, depois ele volta aos poucos.
- **Esquiva em dash** com invencibilidade e rastro, **stamina e recarga** em cada golpe. A stamina enche rápido (13 por segundo) para a luta ficar corrida.
- **Treinadores dos jogos e do anime** (Ash, Red, Blue, Misty, Brock, Dawn, Cynthia, Lance, Steven, Iris e outros), com apresentação "VS" e corte de Mega Evolução.
- **Estádio grande** com câmera que acompanha a luta. Surf, Earthquake, Heat Wave e outros golpes de área pegam boa parte do campo e deixam marcas no chão.
- **Modos**: contra a CPU (3 dificuldades) e online com código de sala. Também dá para jogar com teclado ou controle.
- **Efeitos em pixel art**: os golpes são desenhados com pixels do mesmo tamanho dos pixels dos sprites, cores chapadas e contorno, no estilo dos jogos 2D.

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
  js/render/         desenho (canvas): arena, sprites, efeitos (pixel.js: camada em pixel art), HUD
  js/net/            modo online (lockstep.js: simulação sincronizada; online.js: salas)
  js/render/title.js cena animada da tela inicial
  js/ui/menus.js     telas de menu
  vendor/            PeerJS (MIT)
  js/data/           dados gerados (golpes, aprendizado) e escritos à mão
android/             projeto Android (Capacitor)
scripts/             geração de dados, download de sprites (gif-sheet.mjs converte GIF em pixel art), servidor local
tests/               testes do motor
```

Os dados dos golpes vêm do Pokémon Showdown (`npm run gen-data` gera de novo) e os sprites do PMD SpriteCollab e do Smogon Sprite Project (`npm run fetch-assets`).

## Créditos

- Dados: Pokémon Showdown (@pkmn/dex).
- Sprites e retratos: PMD Sprite Repository (SpriteCollab), CC BY-NC 4.0. Os autores de cada sprite estão em `www/assets/credits.json` e na tela de créditos do jogo.
- Treinadores: Smogon Sprite Project (smogon/sprites).
- Mega Venusaur, Mega Charizard Y e Mega Blastoise: animações dos modelos 3D do Smogon Sprite Project, convertidas para pixel art. Mega Golisopod: imagem do Pokémon Champions no mesmo repositório, animada por partes.
- Artes oficiais: PokeAPI/sprites.
- Conexão online: PeerJS (MIT).
- Fontes: Press Start 2P e Pixelify Sans (SIL OFL 1.1).

Pokémon © Nintendo, Creatures Inc. e GAME FREAK inc. Este projeto não tem ligação com elas.

A chave `android/app/arena-debug.keystore` é uma chave de depuração pública (senha `android`), só para os APKs novos instalarem por cima dos antigos. Ela não deve ser usada para publicar em loja.
