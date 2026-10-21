# PK confront

Batalha 1 contra 1 de Pokémon em tempo real numa arena oval. Projeto de fã, sem fins lucrativos, no estilo do Poké Arena 2D (a análise e a arquitetura estão em `PLAN.md`).

## O que tem

- **9 linhas de Pokémon**, com evolução em tempo real durante a luta: Bulbasaur, Charmander (com Mega Charizard X), Squirtle, Froakie (até Greninja), Onix (com Mega Steelix), Riolu (com Mega Lucario), Zubat, Buneary (com Mega Lopunny) e Munchlax (até Snorlax).
- **5 skills por Pokémon**: ataque básico (LMB), skill (RMB), esquiva/dash (SPC), utilitária (Q) e ultimate (E). Energia, calor do ataque básico (sobrecarga), barra de ultimate e experiência de evolução.
- **Melhor de 3 rounds de 99 segundos**, arenas ovais (Stadium, Neon, Crater e Ruins), câmera com zoom, hit stop e efeitos em pixel art.
- **Modos**: VS CPU (easy, normal, hard), 2 PLAYERS no mesmo teclado, TRAINING (boneco que não morre) e TUTORIAL.
- **Controles**: teclado e mouse, teclado do jogador 2, controle (gamepad) e toque no celular.
- Pokédex com os estágios, Megas e as 5 skills de cada um.
- **Celular em primeiro lugar**: a tela do jogo se estica até preencher o aparelho (de 16:9 até 25:9, sem faixas pretas), analógico flutuante à esquerda, botões redondos em arco à direita, cada um com o símbolo da skill, a cor do tipo, anel de recarga e custo de energia. Botão de EVO/MEGA aparece quando a evolução está pronta.
- **Evolução com cena**: a forma antiga brilha até virar silhueta, uma coluna de luz sobe e a forma nova aparece (a Mega tem uma cena dourada mais longa). Linhas de uma só evolução evoluem uma vez.
- **Megas de verdade**: cada Mega ganha versões novas das 5 skills (mais golpes, alcance, explosões, tipo Dragão no Charizard X), não só mais dano.

## Controles

| | Jogador 1 | Jogador 2 | Toque |
|---|---|---|---|
| Mover | WASD | setas | analógico à esquerda |
| Ataque básico | clique esquerdo (ou J) | K | ATK |
| Skill | clique direito (ou K) | L | SKL |
| Esquiva / dash | Space | Enter | DASH |
| Utilitária | Q | I | Q |
| Ultimate | E | O | ULT |
| Evoluir / Mega | R | P | EVO |
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
