# PK confront

Batalha 1 contra 1 de Pokémon em tempo real numa arena oval. Projeto de fã, sem fins lucrativos, no estilo do Poké Arena 2D (a análise e a arquitetura estão em `PLAN.md`).

## Versão 1.0

Primeira versão completa (saiu do alpha).

- **31 linhas de Pokémon** com evolução durante a luta e Megas, cada uma com 5 skills próprias: básico, skill, dash, utilitária e ultimate. A primeira forma não tem ult; ela chega com a evolução.
- **Megas com kits novos de verdade**, entre elas Mega Gengar (Nightmare Bomb, que cega quem está na escuridão), Mega Sceptile (cauda-míssil teleguiada), Mega Zeraora (Thunder Cage, só com o plasma cheio) e Mega Venusaur (vinhas que arremessam, onda de veneno e Solar Beam gigante).
- **Seis arenas com mecânicas próprias**: estádio livre, ruínas com pedras que bloqueiam o caminho e os tiros, praia com um rio no meio e duas pontes, cratera com lava que queima, halloween com lápides e neon com placas de impulso. Muro e arquibancada em 3D.
- **Modos**: VS CPU (easy, normal, hard), Liga com desbloqueio por vitórias, duplas 2x2 (com CPU completando), arena de 3, online por código (P2P, sem servidor), treino e tutorial.
- **Celular em primeiro lugar**: tela que preenche o aparelho, analógico flutuante, botões em arco e a barra de skills embaixo com recarga, custo e ult.
- **Efeitos em pixel art**: cada ataque solta partículas do tipo ao sair do Pokémon, golpes com efeitos próprios, ondas de choque e raios de ult que afinam até sumir.
- Pokédex, perfil, shiny secreto e créditos dos sprites (PMD SpriteCollab e sprites enviados pela comunidade).

## Controles

| | Jogador 1 | Jogador 2 | Toque |
|---|---|---|---|
| Mover | WASD | setas | analógico à esquerda |
| Ataque básico | clique esquerdo (ou J) | K | ATK |
| Skill | clique direito (ou K) | L | SKL |
| Esquiva / dash | Space | Enter | DASH |
| Utilitária | Q | I | Q |
| Ultimate | E | O | ULT |
| Evoluir / Mega | F | P | EVO |
| Pausa | Esc ou P | | |

A mira do jogador 1 é o mouse; no toque e no jogador 2 é automática no rival.

## Como rodar

```bash
npm install
npm run fetch-pmd   # baixa os sprites do PMD SpriteCollab para www/assets/pmd
npm run serve       # http://localhost:8080
npm test            # motor: todas as skills, evolução, Mega e os 72 duelos
```

## APK

O GitHub Actions compila o APK a cada push e publica na página **Releases** (release `apk`). Baixe `PKconfront.apk` no celular, abra e permita instalar de fontes desconhecidas.

## Estrutura

```
www/js/engine/   motor (roda no Node): lutador, luta, habilidades, entidades, IA
www/js/render/   desenho: arenas, sprites, efeitos, HUD, câmera
www/js/ui/       telas: título, seleção, combate, Pokédex, controles, créditos
www/js/data/     Pokémon, regras e arenas
scripts/         fetch-pmd.mjs (sprites), serve.mjs
tests/           testes do motor
docs/referencia/ números e nomes extraídos do Poké Arena 2D v0.47.2
android/         projeto Capacitor
```

## Créditos

- Sprites e retratos: PMD Sprite Repository (SpriteCollab), CC BY-NC 4.0. Os autores de cada sprite estão em `www/assets/creditos.json`.
- Regras, Pokémon e skills baseados no Poké Arena 2D (pokearena2d.com). Nenhum código nem imagem do site foi copiado; o motor foi escrito do zero.
- Fonte: Pixelify Sans (SIL OFL 1.1). Som e música sintetizados no jogo.

Pokémon © Nintendo, Creatures Inc. e GAME FREAK inc. Este projeto não tem ligação com elas.

A chave `android/app/arena-debug.keystore` é de depuração pública (senha `android`), só para os APKs novos instalarem por cima dos antigos. Não serve para publicar em loja.


## Jogar online com amigos

O jogo online roda igual nos dois (ou três) aparelhos: cada um manda só os comandos de cada passo e o motor, que usa a mesma semente, calcula tudo. Por isso a luta é igual para todos e o atraso fica pequeno (cerca de 100 ms de folga). Se os aparelhos divergirem, o jogo avisa na tela.

**Sala por código só com os celulares (até 4 jogadores)**
ONLINE > CREATE ROOM mostra um código de 4 letras; os amigos usam JOIN ROOM e digitam o código. Não precisa de computador nem de servidor seu: o código é registrado no serviço público de sinalização do PeerJS e depois os celulares conversam direto (WebRTC), com o anfitrião no centro. Com 4 jogadores a luta começa sozinha; com 2 ou 3 o anfitrião aperta START. Se o serviço público estiver fora do ar ou a rede bloquear, use as opções abaixo.

**Servidor próprio (Wi-Fi local ou internet)**
1. No computador: `npm install` e `npm run serve`. O terminal mostra um endereço como `http://192.168.0.10:8080`.
2. Todo mundo abre esse endereço e, em ONLINE > MORE OPTIONS > OWN SERVER, coloca `ws://ENDERECO:8080/relay`.

**Pela internet sem servidor (P2P, só 2 jogadores)**
ONLINE > NO SERVER. Quem cria envia o código que aparece (já copiado); o amigo cola, recebe um código de resposta e devolve. Funciona direto entre os celulares (WebRTC com servidores STUN públicos). Redes de operadora muito restritas podem bloquear; nesse caso use a sala por código.

**Pela internet com sala por código**
Coloque `npm run serve` (ou `npm run relay`) num servidor com Node, ou exponha seu PC com um túnel (por exemplo Cloudflare Tunnel). No APK, ONLINE > SERVER: SET ADDRESS e digite `ws://ENDERECO:8080/relay` (ou `wss://` se tiver HTTPS).
