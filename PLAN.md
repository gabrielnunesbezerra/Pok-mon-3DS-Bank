# PK confront: plano

Clone 1 contra 1 do Poké Arena 2D (https://www.pokearena2d.com/, versão alpha 0.47.2 no dia da análise).
Este plano vem do que o site entrega de fato (dados, regras e telas lidos do código público dele). Nada aqui foi chutado.

## O que o jogo original é

- Phaser 2D, visão de cima inclinada, arena oval (elipse de 455 x 168 num mundo de 960 x 441), câmera que dá zoom conforme os dois lutadores se afastam.
- Mundo lógico de 640 x 360 (tela inicial) e 60 passos por segundo.
- Partida em melhor de 3 rounds, 99 segundos por round, contagem "ROUND n, 3, 2, 1, FIGHT!", "K.O!" em câmera lenta. Se o tempo acabar, ganha quem tem mais vida.
- Cada Pokémon tem 5 espaços de habilidade: LMB (ataque básico), RMB (skill), SPC (esquiva ou dash), Q (utilitária) e E (ultimate). Mais a tecla de Mega Evolução/evolução.
- Recursos de cada lutador: vida, energia (começa em 30, máximo 100), calor (o ataque básico esquenta e dá sobrecarga de 2 s), barra de ultimate (0 a 100) e experiência de evolução.
- Evolução em tempo real: a experiência enche (dano feito, dano recebido e tempo) e aparece "CAN EVOLVE!". A Mega usa a barra de ultimate cheia.
- Estados por tipo: Fogo queima, Água encharca (corta a energia), Planta enreda (lento), Elétrico paralisa (ataque mais lento). Acertar 3 golpes do mesmo tipo em 3 s aplica o estado. Gelo congela depois de 3 acertos. Confusão inverte os controles.
- Eficácia de tipo simplificada (super eficaz x1,35, pouco eficaz x0,8). O ataque básico é neutro.

## Escopo do PK confront

Entra: tela inicial (PLAY, POKÉDEX, TUTORIAL, SETTINGS, CREDITS), PLAY com VS CPU, 2 PLAYERS e TRAINING, seleção de Pokémon, combate 1v1, Pokédex dos 9, tela de controles, créditos, pausa, som sintetizado.

Fica de fora de propósito: ONLINE, ranked, contas, amigos, ranking, liga, ARENA MODE (mais de 2 lutadores), chat e gravação de replays. Motivos: o seu pedido é 1v1 e "nada que não exista"; o que depende de servidor do site original não dá para copiar, porque o servidor é deles.

## Roster (9 linhas, igual ao site)

| Linha | Estágios | Mega |
|---|---|---|
| Bulbasaur | Bulbasaur, Ivysaur, Venusaur | não |
| Charmander | Charmander, Charmeleon, Charizard | Mega Charizard X |
| Squirtle | Squirtle, Wartortle, Blastoise | não |
| Froakie | Froakie, Frogadier, Greninja | não |
| Onix | Onix, Steelix | Mega Steelix |
| Riolu | Riolu, Lucario | Mega Lucario |
| Zubat | Zubat, Golbat, Crobat | não |
| Buneary | Buneary, Lopunny | Mega Lopunny |
| Munchlax | Munchlax, Snorlax | não |

Observações: o site usa Froakie, Riolu, Buneary e Munchlax como inicial das linhas que você chamou de Greninja, Lucario, Lopunny e Snorlax. "Mega Charmander X" é a Mega Charizard X. Os dados de cada estágio (vida, velocidade, ataque, defesa, 5 skills com dano, alcance, custo e recarga) estão em `docs/referencia/ref9.json`.

## As 25 formas de skill

Todo kit do site é montado com um conjunto pequeno de formas: proyectil, dash, chorro, tajo, golpe, meteoro, vuelo, pulso, patada, clones, bombaLodo, arraigo, plantaFeroz, crecimiento, helice, cono, burbujas, caparazon, embestidas, viento, lluvia, erupcion, descanso, rafaga, humo. O motor implementa cada forma uma vez, lendo os números do kit. Os 9 Pokémon viram dados, não código.

## Sprites, arte e som

- Sprites, retratos e ícones: somente PMD SpriteCollab (CC BY-NC 4.0), baixados por script, com créditos no jogo.
- Fundos de arena, logo, efeitos e interface: desenhados em pixel art por código (nenhuma imagem do site original é copiada).
- Som e música: sintetizados (Web Audio).
- O código do site original não é copiado. O motor é escrito do zero a partir das regras acima.

## Arquitetura

JavaScript puro em módulos ES e Canvas 2D. Sem biblioteca de jogo. O motor não usa o DOM, então roda no Node nos testes.

```
www/
  index.html
  style.css
  js/
    main.js            entrada e troca de cenas
    config.js          constantes (tela, passo fixo, arena)
    data/
      regras.js        regras globais (energia, calor, ultimate, estados, tipos)
      pokemon.js       os 9 Pokémon e seus estágios, kits e Megas
      arenas.js        as 4 arenas ovais
    engine/
      luta.js          rounds, relógio, K.O, hit stop
      lutador.js       vida, energia, calor, ultimate, exp, estados, evolução e Mega
      habilidades.js   as 25 formas de skill
      fisica.js        movimento, colisão com a borda oval, projéteis e hitboxes
      ia.js            CPU (fácil, normal, difícil)
    render/
      camera.js        zoom e enquadramento dos dois lutadores
      sprites.js       carrega e anima os sprites PMD (8 direções)
      efeitos.js       partículas, impactos, números de dano, rastros
      arena.js         desenho das 4 arenas
      hud.js           barras, ultimate, recargas, rounds
    ui/
      titulo.js        tela inicial
      selecao.js       escolha de Pokémon
      pokedex.js  controles.js  creditos.js  pausa.js
    input.js           teclado, mouse, controle e toque
    audio.js           sons e música sintetizados
  assets/pmd/          sprites e retratos do SpriteCollab
scripts/               fetch-pmd.mjs, serve.mjs
tests/                 testes do motor
android/               projeto Capacitor
docs/referencia/       dados extraídos do site (só números e nomes)
```

## Fases

0. Este plano.
1. Limpeza total do repositório (C#, pokebank, Arena 2D Champion), renome para PK confront, infraestrutura (Capacitor, workflow do APK, servidor local) e tela inicial.
2. Motor 1v1: arena oval, movimento, esquiva, rounds, relógio, câmera, HUD, IA, controles.
3. Os 9 Pokémon: 25 formas de skill, evolução em tempo real, Megas, estados, sprites PMD, efeitos, sons, Pokédex, testes e APK.

## Riscos

- Fidelidade 100% não é possível em tudo: o jogo original tem arte própria (fundos, logo, efeitos em folha de sprites) que não vou copiar. O resultado terá o mesmo comportamento e a mesma estrutura, com visual próprio nessas partes.
- O site está em alpha e muda de versão. Esta cópia segue a 0.47.2.
- A renomeação do repositório no GitHub (de Pok-mon-3DS-Bank para PK confront) só você consegue fazer, em Settings. Eu renomeio o projeto dentro do código.
