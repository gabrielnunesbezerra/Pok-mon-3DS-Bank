using PKForge.Domain;
using PKForge.Engine;
using PKHeX.Core;
using Xunit;

namespace PKForge.Engine.Tests;

/// <summary>
/// In every main game, creating a Pokémon and legalizing a broken one must give a caught
/// Pokémon, never one "hatched from an egg" (eggs fit any request, so the legalizer used to
/// fall back to them), and Legalize or making it shiny must keep where it was caught.
/// </summary>
public sealed class MainGameOriginSweepTests
{
    public static TheoryData<GameVersion, Species> Games => new()
    {
        { GameVersion.E, Species.Zigzagoon },
        { GameVersion.FR, Species.Pidgey },
        { GameVersion.Pt, Species.Bidoof },
        { GameVersion.HG, Species.Sentret },
        { GameVersion.B, Species.Patrat },
        { GameVersion.B2, Species.Patrat },
        { GameVersion.X, Species.Fletchling },
        { GameVersion.OR, Species.Zigzagoon },
        { GameVersion.SN, Species.Yungoos },
        { GameVersion.US, Species.Yungoos },
        { GameVersion.SW, Species.Skwovet },
        { GameVersion.BD, Species.Bidoof },
        { GameVersion.SL, Species.Lechonk },
    };

    private static (SaveEngineSession Session, SaveFile Save) Open(GameVersion version)
    {
        var save = BlankSaveFile.Get(version, "PKForge", LanguageID.English);
        return (new SaveEngineSession(save, null), save);
    }

    [Theory]
    [MemberData(nameof(Games))]
    public void ACreatedPokemonIsCaughtNotHatched(GameVersion version, Species species)
    {
        var (session, save) = Open(version);
        using (session)
        {
            var outcome = new LegalizerService().Generate(session, 0, 0,
                new GenerationRequest((int)species, Level: 20, Shiny: true, Nature: null, Ability: null, Ball: null, Moves: null));
            Assert.True(outcome.Success, outcome.Message);
            var made = save.GetBoxSlotAtIndex(0, 0);
            Assert.True(new LegalityAnalysis(made).Valid, new LegalityAnalysis(made).Report());
            Assert.True(made.IsShiny);
            Assert.False(made.WasEgg, $"{version} {species}: generated as hatched from an egg");
        }
    }

    [Theory]
    [MemberData(nameof(Games))]
    public void LegalizeKeepsTheCatchAndItsLocation(GameVersion version, Species species)
    {
        var (session, save) = Open(version);
        using (session)
        {
            Assert.True(new LegalizerService().Generate(session, 0, 0,
                new GenerationRequest((int)species, Level: 20, Shiny: false, Nature: null, Ability: null, Ball: null, Moves: null)).Success);
            var caught = save.GetBoxSlotAtIndex(0, 0);
            Assert.False(caught.WasEgg);
            var location = caught.MetLocation;

            // Break it the way players do: ask for a shiny and edit the stats by hand.
            var broken = caught.Clone();
            broken.SetShiny();
            broken.IV_ATK = broken.IV_ATK == 31 ? 30 : 31;
            broken.Move1 = (ushort)Move.Transform;
            broken.RefreshChecksum();
            save.SetBoxSlotAtIndex(broken, 0, 0, EntityImportSettings.None);
            Assert.False(new LegalityAnalysis(broken).Valid);

            var outcome = new LegalizerService().LegalizeSlot(session, 0, 0);
            Assert.True(outcome.Success, outcome.Message);
            var repaired = save.GetBoxSlotAtIndex(0, 0);
            Assert.True(new LegalityAnalysis(repaired).Valid, new LegalityAnalysis(repaired).Report());
            Assert.False(repaired.WasEgg, $"{version} {species}: legalized into hatched from an egg");
            Assert.Equal(location, repaired.MetLocation);
            Assert.True(repaired.IsShiny);
        }
    }

    [Theory]
    [MemberData(nameof(Games))]
    public void MakingItShinyKeepsTheCatch(GameVersion version, Species species)
    {
        var (session, save) = Open(version);
        using (session)
        {
            Assert.True(new LegalizerService().Generate(session, 0, 0,
                new GenerationRequest((int)species, Level: 20, Shiny: false, Nature: null, Ability: null, Ball: null, Moves: null)).Success);
            var caught = save.GetBoxSlotAtIndex(0, 0);

            Assert.Equal(1, BulkBoxActions.SetShiny(session, [(0, 0)], shiny: true).Changed);
            var shiny = save.GetBoxSlotAtIndex(0, 0);
            Assert.True(shiny.IsShiny);
            Assert.True(new LegalityAnalysis(shiny).Valid, new LegalityAnalysis(shiny).Report());
            Assert.False(shiny.WasEgg, $"{version} {species}: made shiny as hatched from an egg");
            Assert.Equal(caught.MetLocation, shiny.MetLocation);
        }
    }
}
