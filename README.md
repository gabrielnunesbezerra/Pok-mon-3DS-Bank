# 3DS Bank

Banco de Pokémon para Android, da Geração 1 à 7, sem edição. Feito para eu e meus amigos
guardarmos e trocarmos Pokémon entre os nossos jogos de emulador.

O 3DS Bank é uma versão modificada do [PKForge](https://github.com/sofianeelhor/PKForge)
de sofianeelhor (versão 3.1, licença GPLv3). Modificado em outubro de 2026.

## O que mudou em relação ao PKForge

- **Nada é editado.** O app não altera Pokémon nem dados do save: sem editar status, IVs,
  EVs, golpes, natureza, shiny, itens, dinheiro, Pokédex, eventos, legalização, evolução
  dentro do app, criação de Pokémon, Mystery Gift, editor hexadecimal ou editores de save.
  O modo Hardcore do PKForge fica ligado para sempre e não aparece nas configurações, e o
  próprio motor do app recusa essas operações mesmo que alguma tela tente fazer.
- **Mover, nunca copiar.** Dá para mover Pokémon entre caixas, mandar para o Bank, tirar do
  Bank e mandar para outro jogo, organizar e soltar. "Duplicar", "Copiar para o Bank" e
  "Copiar para o jogo" não existem. Restaurar um backup que traria de volta um Pokémon que já
  saiu do save também é bloqueado.
- **O que não dá para usar não aparece.** Dex Autopilot, eventos, editores do save e a edição
  do painel do Pokémon foram tirados da tela; o painel só mostra as informações.
- **Conta.** O app abre numa tela de login (criar conta, entrar, falar com o suporte pelo
  WhatsApp). O Bank fica salvo na conta e volta ao entrar de novo, mesmo depois de desinstalar.
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

As regras do 3DS Bank ficam em `src/PKForge.Domain/ThreeDsBankPolicy.cs`. As contas usam um
projeto Firebase (Authentication por e-mail/senha e Realtime Database); a chave e o endereço
ficam em `src/PKForge.App/Services/AccountService.cs` (`CloudSettings`). Regras do banco:

```json
{
  "rules": {
    "banks": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```

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
