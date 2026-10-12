using PKForge.Domain;
using PKHeX.Core;
using Xunit;

namespace PKForge.Engine.Tests;

/// <summary>PKHeX's era switch is process-wide, so these run apart from the parallel tests.</summary>
[CollectionDefinition(nameof(LegalityEraCollection), DisableParallelization = true)]
public sealed class LegalityEraCollection;

/// <summary>
/// Report: official Game Boy distributions (Gen 2 PCNY eggs, Pokémon Stadium gifts) were
/// flagged. PKHeX holds them (event1.pkl / event2.pkl) but only consults them under the
/// cartridge era, which PKForge never set, so every GB Pokémon was checked under the 3DS
/// Virtual Console rules.
/// </summary>
[Collection(nameof(LegalityEraCollection))]
public sealed class GameBoyEraEventTests
{
    [Theory]
    [InlineData(GameVersion.C, (int)Species.Bulbasaur, (int)Move.AncientPower)] // PCNY egg
    [InlineData(GameVersion.C, (int)Species.Teddiursa, (int)Move.SweetScent)] // PCNY egg
    [InlineData(GameVersion.RD, (int)Species.Psyduck, (int)Move.Amnesia)] // Pokémon Stadium gift
    public void CartridgeSavesRecognizeGameBoyEraEvents(GameVersion version, int species, int move)
    {
        using var session = new SaveEngineSession(BlankSaveFile.Get(version, "PKForge", LanguageID.English), null);
        session.MakeActive();

        var outcome = new LegalizerService().Generate(session, 0, 0,
            new GenerationRequest(species, null, Shiny: false, Nature: null, Ability: null, Ball: null, Moves: [move], Form: 0));

        Assert.True(outcome.Success, outcome.Message);
        var pk = session.GetEntity(0, 0);
        Assert.True(pk.HasMove((ushort)move));
        var la = new LegalityAnalysis(pk);
        Assert.True(la.Valid, la.Report());
        Assert.IsType(version == GameVersion.RD ? typeof(EncounterGift1) : typeof(EncounterGift2), la.EncounterMatch);
    }

    [Fact]
    public void OnlyTheSaveThePlayerOpensSetsTheEra()
    {
        using var crystal = new SaveEngineSession(BlankSaveFile.Get(GameVersion.C, "PKForge", LanguageID.English), null);
        crystal.MakeActive();
        Assert.False(ParseSettings.AllowGBVirtualConsole3DS);

        // A transfer or the Bank reading another game's save leaves the open save's era alone.
        var bytes = BlankSaveFile.Get(GameVersion.B2, "PKForge", LanguageID.English).Write().ToArray();
        using (new SaveEngineSession(bytes)) { }
        Assert.False(ParseSettings.AllowGBVirtualConsole3DS);

        // Opening a later game switches to the Virtual Console rules its GB Pokémon came through.
        using var black2 = new SaveEngineSession(bytes);
        black2.MakeActive();
        Assert.True(ParseSettings.AllowGBVirtualConsole3DS);
    }
}
