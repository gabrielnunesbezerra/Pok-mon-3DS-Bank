# 3DS Bank

Banco de Pokémon para Android, da Geração 1 à 7. Feito para eu e meus amigos guardarmos e
trocarmos Pokémon entre os nossos jogos de emulador, e desde a versão 2.0 trocarmos também
entre nós, pelo app.

O 3DS Bank é uma versão modificada do [PKForge](https://github.com/sofianeelhor/PKForge)
de sofianeelhor (versão 3.1, licença GPLv3). Modificado em outubro de 2026.

## O que mudou em relação ao PKForge

- **Quase nada é editado.** O app não altera status, IVs, EVs, golpes, natureza, dinheiro,
  Pokédex nem eventos, não cria Pokémon e não tem Mystery Gift, editor hexadecimal ou editores
  de save. O modo Hardcore do PKForge fica ligado para sempre e o próprio motor do app recusa
  essas operações mesmo que alguma tela tente fazer. As exceções são as da versão 2.0 (abaixo)
  e o cuidado no Poképark: cada uma abre a porta só durante a própria operação.
- **Nenhum Pokémon duplicado pela nuvem (2.5).** Até a 2.4, o Bank ia para a conta alguns
  segundos depois de cada mudança. Quem tirava um Pokémon do Bank (para um jogo, numa troca ou
  exportando) e apagava os dados do app antes desse envio recebia a cópia antiga de volta ao
  entrar de novo, e assim um Pokémon virava dois. Agora um Pokémon só sai do Bank depois que a
  conta confirmou a saída: ele vai primeiro para uma lista de "em viagem" que fica junto do Bank
  na conta, e só então chega ao jogo, ao arquivo, à troca ou ao Poképark. Se não chegar, volta
  para a caixa. Por isso tirar Pokémon do Bank precisa de internet (guardar continua funcionando
  sem). E o servidor recusa um envio feito a partir de uma cópia velha do Bank (outro celular,
  ou um app antigo): o app baixa o Bank da conta e coloca por cima só o que ele mesmo mudou,
  Pokémon por Pokémon, então o que saiu em outro lugar não volta. As opções escondidas de
  duplicar e copiar para o jogo saíram do código.
- **Administrador (2.5).** A conta `adminbielz` é a do administrador. Ela entra pelo nome de
  usuário, como as contas de antes da 2.0, e só ela vê a tela Admin no menu lateral: a lista de
  jogadores, o Bank de qualquer um (com os Pokémon repetidos marcados, e um botão que deixa uma
  cópia só de cada), os Pokémon que ficaram "em viagem" porque o app fechou no meio (dá para
  devolver para as caixas), uma busca de duplicados em todos os Banks ao mesmo tempo (acha um
  Pokémon copiado que foi dado para os amigos) e o evento da Arena. Quem é administrador é
  decidido pelo e-mail que o Firebase assina na conta, e as regras do banco checam a mesma coisa:
  mudar o app não dá esse poder a ninguém. A senha não fica no código; ela existe só no Firebase.
- **Poképark e Máquina de Brinquedos só do administrador (2.5).** Para os outros jogadores as
  duas saíram do menu. No lugar, o menu de um Pokémon do Bank tem "Visit the Poképark": ele sai
  do Bank e vai para o Poképark do administrador, que recebe na tela Admin, cuida dele (ele mora
  no Poképark, come frutas, ganha amizade) e manda de volta com um recado. O Pokémon volta
  sozinho para o Bank do dono. Soltar Pokémon só dá ticket para o administrador.
- **Arena (2.5).** Um evento que o administrador monta na tela Admin: o Campeão (um Pokémon do
  Bank dele), até 6 Pokémon com que os jogadores lutam, os prêmios (Master Ball, Estrela Cadente,
  Rare Candy, Gold Bottle Cap e outros) e quanto tempo dura. A batalha é em tempo real vista de
  cima: o polegar esquerdo anda (o direcional aparece onde tocar) e o direito usa os quatro golpes
  do Pokémon e a esquiva. Cada golpe funciona pelo tipo e pela categoria (físico vai em investida,
  especial vira disparo, os mais fortes viram um raio carregado, Terremoto vira uma onda no chão,
  Lança-chamas vira um jato) e causa dano pela fórmula dos jogos (nível, poder, ataque contra
  defesa, bônus do mesmo tipo, vantagem de tipo e crítico). Todos lutam no nível 50, como nos
  campeonatos. O Campeão é controlado pelo app e, com a "aura" ligada, nunca perde: ele chega
  quase no fim da vida, se levanta uma vez, fica mais forte com o tempo e o relógio acabando conta
  como vitória dele. Desligar a aura deixa as lutas justas, e quem vencer recebe os prêmios no
  Armazém. O placar mostra quantas vezes cada um lutou e quanto da vida do Campeão tirou.
- **Poképark.** O habitat aparece numa tela emoldurada, com o nome no alto da moldura (tocar
  nele abre as opções do parque) e, embaixo no centro, as setas de habitat anterior e próximo
  e o X para sair. Tocar num Pokémon abre a ficha dele. Desde a 2.2 cada habitat tem um pomar num canto: quatro canteiros e um pote. As frutas
  saem do Armazém e cada habitat só cultiva as suas (Campo Ensolarado: Cheri, Pecha e Oran;
  Lago Cascata: Chesto, Leppa e Persim; Bosque das Brasas: Rawst, Figy e Mago; Cume do Céu:
  Aspear, Wiki e Aguav). A árvore fica madura a cada 12 horas e dá 3 frutas, que você arrasta
  até o pote (cabem 12). Os Pokémon do Bank que moram no habitat comem uma fruta por hora, um
  de cada vez, e cada fruta dá +5 de amizade, salva no Pokémon e levada junto para o jogo.
  Depois de 3 horas no parque o Pokémon pode mudar de natureza uma única vez na vida. Se a
  nova natureza deixaria o Pokémon ilegal (na Geração 3 e 4 a natureza depende de como ele foi
  encontrado), a troca é recusada. Desde a 2.4 o espaço dos lados da moldura mostra, à
  esquerda, os Pokémon que moram no habitat com a amizade de cada um e, à direita, os quatro
  canteiros (a fruta plantada e quanto falta para amadurecer) e quantas frutas tem no pote.
  Tocar numa linha abre o Pokémon, o canteiro ou o pote.
- **Voltar para gerações antigas (2.0).** Um Pokémon pode ir da Geração 7 para trás, até a
  Geração 1. No caminho ele é ajustado só no que o jogo antigo não tem: golpes que ainda não
  existiam saem (e no lugar entram golpes que ele aprende por nível nesse jogo), o jogo e o
  local de origem passam a ser um que o jogo antigo conhece, a bola, a habilidade e o idioma
  viram equivalentes que existem lá. A tela de transferência mostra cada mudança antes de
  confirmar. Verificadores de legalidade podem apontar esses Pokémon, mas o jogo carrega
  normalmente.
- **Transferências que mudariam o Pokémon são recusadas.** Ele não troca de espécie ou forma (um
  Rattata de Alola não vai para Pokémon X), ovos não mudam de geração, Let's Go só troca com
  Let's Go e uma ROM hack só recebe de volta os próprios Pokémon. O app mostra o motivo da recusa.
- **Armazém (2.0).** Itens ficam guardados junto com o Bank, cada um com a imagem e a quantidade
  (até 999 de cada). Eles entram vindos da mochila de um jogo ou tirados de um Pokémon do Bank,
  e saem para um Pokémon do Bank segurar ou para a mochila de um jogo. Itens-chave e TMs ficam
  no jogo, e itens da Geração 1 não viajam. Quando um Pokémon vai para um jogo que não tem o
  item que ele segura (Steelixite indo para Pokémon X, por exemplo), o item sai dele e volta
  para o Armazém.
- **Estrela Cadente (2.0).** Toda vez que o Bank chega a mais 60 Pokémon (60, 120, 180...) uma
  conquista é completada e uma Estrela Cadente cai no Armazém. Tirar Pokémon e colocar de novo
  não conta duas vezes. Usar a estrela num Pokémon do Bank deixa ele shiny para sempre,
  mantendo espécie, natureza, gênero e habilidade. Se o jogo dele não teria como gerar aquele
  shiny (Pokémon com shiny travado, ou das Gerações 3 e 4, cuja aparência depende dos IVs), o
  app avisa antes que verificadores de legalidade vão apontar.
- **Amigos e trocas (2.0).** Cada conta tem um perfil (nome, recado, Pokémon favorito, jogo
  favorito e os números do Bank). Dá para procurar um jogador pelo nome de usuário, mandar
  pedido de amizade, aceitar e ver o perfil dos amigos. Com os dois no app ao mesmo tempo,
  um amigo convida o outro para trocar: cada um escolhe um Pokémon do próprio Bank, vê os
  detalhes do Pokémon do outro e confirma. Só quando os dois confirmam a troca acontece; até
  lá qualquer um cancela e nada muda. O Pokémon confirmado fica separado (fora das caixas) até
  a troca terminar, então ele nunca fica nos dois Banks e nunca se perde, mesmo se o app fechar
  no meio: a troca termina na próxima vez que o app abrir. Quem evolui por troca evolui ao
  chegar (Kadabra, Machoke, Onix segurando Metal Coat, Karrablast trocado por Shelmet...), e o
  item usado na evolução é gasto, como nos jogos. Um Everstone impede a evolução.
- **Máquina de Brinquedos (2.1).** Cada Pokémon solto do Bank dá um ticket, e cada ticket gira
  a manivela da máquina uma vez. Sai uma cápsula com um item que vai direto para o Armazém. A
  raridade é sorteada primeiro e depois um item dela, todos com a mesma chance: Comum 60% (24
  itens: 12 bobos, como Fresh Water e Poké Doll, e as 12 frutas do pomar do Poképark), Raro 25%
  (18 itens, como Revive e as pedras de evolução), Épico 10% (19 itens, como Rare Candy e Leftovers), Lendário 4% (13 itens, como
  Master Ball e Gold Bottle Cap) e Secreto 1%, que dá só um "???" sem nome e sem uso. A tela
  da máquina mostra a chance de cada raridade e de cada item. Desde a 2.4 o ticket laranja com
  a quantidade fica no canto de cima, o botão verde Roll embaixo dele, a máquina no meio e o
  quadrado branco com "%" à direita abre as chances.
- **Tela inteira em qualquer celular (2.4).** Em celular com câmera na tela (furo ou notch), o
  app ocupa a tela toda em vez de deixar uma faixa escura do lado da câmera: o fundo vai até a
  borda e os botões e textos ficam fora da área da câmera, dos dois lados da tela.
- **Legalizar mantém o nome (2.4).** Legalizar um Pokémon não troca mais o nome dele por um em
  japonês, coreano ou chinês. O idioma e o apelido voltam a ser os que ele tinha; se a única
  versão legal teria o nome nessas escritas, o Pokémon fica como estava e o app avisa.
- **Feito para o toque (2.1).** As dicas de botão de controle (A, B, X, Y, L, R, +, -) saíram.
  Onde ainda precisa, a ação virou um botão na tela; o resto é tocar no próprio Pokémon, caixa
  ou item. No Bank, um toque escolhe o espaço e o segundo toque abre o menu do Pokémon.
  Um controle físico continua funcionando.
- **Preto e branco, em pixel art (2.3).** O app tem uma cor só, preta com bordas e ícones
  brancos, e a escolha de cores saiu das Configurações. Os mapas do Poképark, o pomar, a
  Máquina de Brinquedos (uma Poké Ball em cima de uma base vermelha) e o cartucho do Bank são
  desenhados em pixel art, e os botões novos usam ícones e a fonte pixelada.
- **Tela inicial e Bank com mais espaço (2.2).** Na tela inicial o Bank fica junto dos jogos,
  em cartuchos maiores, e o resto (Armazém, Amigos, Poképark, Máquina de Brinquedos e
  Configurações) foi para um menu lateral que abre no botão do canto. No Bank a caixa ficou
  maior: Caixas, Busca, Living dex, Ações do Bank, Importar e Exportar estão no menu de três
  pontinhos, e Resumo, Menu do Pokémon e Marcar ficam embaixo do painel do Pokémon.
- **Poképark mais certinho (2.1).** Os Pokémon andam em linha reta pelo chão de verdade de cada
  mapa, sem passar por cima de árvores ou paredes de pedra, e ficam com os pés no chão ao
  trocar de pose ou de direção.
- **Sem Pokémon Showdown.** Exportar e importar times do Showdown e o QR de .pk saíram.
- **Só inglês por enquanto (2.3).** A opção de português saiu das Configurações e da tela de
  login; a tabela de tradução continua no projeto para quando ele voltar.
- **Mover, nunca copiar.** Dá para mover Pokémon entre caixas, mandar para o Bank, tirar do
  Bank e mandar para outro jogo, organizar e soltar. "Duplicar", "Copiar para o Bank" e
  "Copiar para o jogo" não existem. Restaurar um backup que traria de volta um Pokémon que já
  saiu do save também é bloqueado.
- **O que não dá para usar não aparece.** Dex Autopilot, eventos, editores do save e a edição
  do painel do Pokémon foram tirados da tela; o painel só mostra as informações.
- **Conta.** O app abre numa tela de login (criar conta, entrar, esqueci a senha, falar com o
  suporte pelo WhatsApp). O Bank, o Armazém e as estrelas ficam salvos na conta e voltam ao
  entrar de novo, mesmo depois de desinstalar. Desde a 2.0 a conta tem nome de usuário (como
  os amigos te acham) e e-mail (como você entra e recupera a senha: o link para criar uma
  senha nova chega no e-mail). Contas criadas antes da 2.0 continuam entrando com o nome de
  usuário e podem adicionar um e-mail em Configurações > Conta; depois disso entram com o e-mail.
- **Exportar e importar.** Exportar tira o Pokémon do Bank e salva um arquivo .pk; importar
  devolve só arquivos que saíram deste Bank, uma vez cada. Assim um arquivo nunca duplica um
  Pokémon.
- **Só Geração 1 a 7.** Saves de Sword/Shield, Brilliant Diamond/Shining Pearl, Legends:
  Arceus, Scarlet/Violet e ROM hacks baseados neles (Luminescent Platinum, Compass) não
  abrem. Let's Go Pikachu/Eevee conta como Geração 7 e abre.
- **Atualizações** vêm das Releases deste repositório.

Pokémon editados fora do app (no PKHeX, por exemplo) continuam abrindo normalmente: o
3DS Bank só garante que nada é alterado por ele.

## Jogos

- **Geração I:** Red, Blue, Green (JP), Yellow
- **Geração II:** Gold, Silver, Crystal
- **Geração III:** Ruby, Sapphire, Emerald, FireRed, LeafGreen, Box: Ruby & Sapphire, Colosseum, XD
- **Geração IV:** Diamond, Pearl, Platinum, HeartGold, SoulSilver
- **Geração V:** Black, White, Black 2, White 2
- **Geração VI:** X, Y, Omega Ruby, Alpha Sapphire
- **Geração VII:** Sun, Moon, Ultra Sun, Ultra Moon, Let's Go Pikachu, Let's Go Eevee
- **ROM hacks:** Pokémon Unbound, Radical Red, GS Chronicles

Emuladores: RetroArch, Linkboy, Pizza Boy, melonDS, DraStic, Dolphin, Azahar, Lime3DS,
Citra MMJ e Eden. Também dá para abrir um arquivo de save sozinho.

## Instalação

Baixe o arquivo `3DSBank-vX.Y.Z.apk` na página de
[Releases](https://github.com/gabrielnunesbezerra/Pok-mon-3DS-Bank/releases) pelo celular e
abra. Na primeira vez o Android pede para permitir a instalação de apps desconhecidos.
Para atualizar, instale o APK novo por cima. O Bank fica salvo na sua conta, então mesmo
desinstalando é só entrar de novo que ele volta. Use a conta em um celular por vez: se dois
celulares mudarem o mesmo Bank ao mesmo tempo, vale o último que salvar.

O 3DS Bank usa um nome de pacote próprio, então pode ficar instalado junto com o PKForge.

## Compilação

O GitHub Actions compila e testa a cada envio (`.github/workflows/build.yml`). Quando a
versão em `ApplicationDisplayVersion` (`src/PKForge.App/PKForge.App.csproj`) ainda não tem
Release, o envio para `main` publica uma com o APK assinado. Para lançar uma atualização,
aumente essa versão e também `ApplicationVersion`. A chave de assinatura fica no secret
`BANK_ANDROID_KEYSTORE_BASE64` (Settings > Secrets and variables > Actions); todo APK
precisa da mesma chave para atualizar por cima do anterior.

Para compilar localmente: .NET 10 SDK, `dotnet workload install maui-android`, depois
`dotnet build src/PKForge.App/PKForge.App.csproj -c Release -f net10.0-android`.

Os testes das regras do Firebase rodam contra o emulador do Realtime Database: com ele aberto
(`java -jar firebase-database-emulator.jar --port 9000`) e as regras carregadas no namespace
`fake-server`, defina `FIREBASE_DATABASE_EMULATOR=localhost:9000` antes do `dotnet test`. Sem a
variável esses testes passam direto.

As regras do 3DS Bank ficam em `src/PKForge.Domain/ThreeDsBankPolicy.cs`. As contas usam um
projeto Firebase (Authentication por e-mail/senha e Realtime Database); a chave e o endereço
ficam em `src/PKForge.App/Services/AccountService.cs` (`CloudSettings`).

### Firebase para a versão 2.5

1. **Regras novas.** Cole de novo o [`firebase/database.rules.json`](firebase/database.rules.json)
   em Realtime Database > Regras e publique. Elas trazem o administrador, as visitas ao Poképark,
   a Arena e a regra que recusa um Bank enviado de uma cópia velha. Depois disso o app 2.4 não
   consegue mais salvar o Bank na conta, então todo mundo precisa atualizar para a 2.5.
2. **Conta do administrador.** Logo depois de publicar as regras, entre no app com o usuário
   `adminbielz` e a senha que você escolheu. Se a conta ainda não existe, esse primeiro login cria
   ela com essa senha. Faça isso antes de mandar o APK para os outros, para ninguém criar antes.
   Também dá para criar em Authentication > Usuários > Adicionar usuário, com o e-mail
   `adminbielz@users.3dsbank.app`.

### Firebase para a versão 2.0

1. **Regras do banco.** Em Realtime Database > Regras, cole o conteúdo de
   [`firebase/database.rules.json`](firebase/database.rules.json) e publique. Elas deixam cada
   jogador mexer só nas próprias partes: o próprio Bank, o perfil, a presença, os pedidos de
   amizade que mandou, a própria oferta e confirmação numa troca. Sem essas regras, criar conta
   nova, amigos e trocas não funcionam (o app avisa).
2. **E-mail de senha nova em português.** Em Authentication > Templates, mude o idioma para
   Português (Brasil). Os e-mails de "redefinir senha" e de "verificar e trocar e-mail" usam
   esse modelo.
3. **Domínio autorizado.** Os links dos e-mails abrem a página do próprio Firebase
   (`<projeto>.firebaseapp.com`), que já vem autorizada. Nada a configurar.

## Créditos
## Créditos

- [PKForge](https://github.com/sofianeelhor/PKForge) de sofianeelhor (@22sh), o app
  inteiro em que o 3DS Bank se baseia

- [PKHeX](https://github.com/kwsch/PKHeX) by Kaphotics and every contributor over the
  years, the engine everything runs on
- [spritedmistery](https://www.instagram.com/spritedmistery/), the PKForge logo, the app's
  look, its color schemes and logos, and its buttons
- [PKHeX-Plugins / Auto Legality Mod](https://github.com/santacrab2/PKHeX-Plugins), the
  offline legalizer built into the app
- [PKSM](https://github.com/FlagBrew/PKSM), the pixel chrome this UI builds on (GPL-3,
  see [UI attribution](src/PKForge.App/Resources/UI/ATTRIBUTION.md))
- [SteamGridDB](https://www.steamgriddb.com), cartridge icons, second-screen logos, and
  hero banners for the game library (community submissions; see
  [game art attribution](src/PKForge.App/Resources/GameArt/ATTRIBUTION.md))
- [Pokémon Showdown](https://pokemonshowdown.com) by [Smogon](https://www.smogon.com) and
  the artists of its sprite projects, front sprites and box icons
- [PokeAPI](https://pokeapi.co), item art fetched at runtime and cached on device
- [game-icons.net](https://game-icons.net) (CC-BY 3.0, © Lorc, Delapouite, Guard13007,
  Carl Olsen and other contributing artists), UI symbols
- [Bulbagarden Archives](https://archives.bulbagarden.net), Pokérus status sprites
- Sprites and Pokémon names © Nintendo, Creatures Inc., GAME FREAK inc.

## Licença

GPLv3 ou posterior, herdada do PKForge e do PKHeX.Core. Veja [LICENSE](LICENSE).
Não é afiliado à Nintendo, Game Freak ou The Pokémon Company.
