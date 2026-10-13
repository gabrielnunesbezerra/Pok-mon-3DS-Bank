using PKForge.Domain;
using PKForge.Engine;
using PKHeX.Core;
using Xunit;

namespace PKForge.Engine.Tests;

/// <summary>
/// Legalizing must not rename a Pokémon: a repair built from a Japanese or Chinese encounter
/// gets the language and the name it had back, or is refused when only that version is legal.
/// </summary>
public sealed class LegalizeKeepsNameTests
{
    private static SaveEngineSession Legal(int generation, int species)
    {
        var session = (SaveEngineSession)new SaveEngine().OpenBlankSession(generation);
        var outcome = new LegalizerService().Generate(session, 0, 0,
            new GenerationRequest(species, 50, Shiny: false, Nature: null, Ability: null, Ball: null, Moves: null));
        Assert.True(outcome.Success, outcome.Message);
        return session;
    }

    [Theory]
    [InlineData(LanguageID.Japanese)]
    [InlineData(LanguageID.ChineseS)]
    [InlineData(LanguageID.Korean)]
    public void ARepairInAnotherScriptGetsItsLanguageAndNameBack(LanguageID language)
    {
        using var session = Legal(7, 25);
        var original = session.SaveFile.GetBoxSlotAtIndex(0, 0);
        Assert.True(new LegalityAnalysis(original).Valid);
        Assert.False(LegalizerService.HasAsianScript(original.Nickname));

        var foreign = original.Clone();
        foreign.Language = (int)language;
        foreign.ClearNickname();
        foreign.RefreshChecksum();
        Assert.True(LegalizerService.HasAsianScript(foreign.Nickname));

        var kept = LegalizerService.KeepName(foreign, original);

        Assert.Equal(original.Language, kept.Language);
        Assert.Equal(original.Nickname, kept.Nickname);
        Assert.False(LegalizerService.RenamedIntoAsianScript(original, kept));
    }

    [Fact]
    public void ANicknameSurvivesTheRepair()
    {
        using var session = Legal(7, 25);
        var original = session.SaveFile.GetBoxSlotAtIndex(0, 0);
        original.SetNickname("Sparky");
        original.RefreshChecksum();
        Assert.True(new LegalityAnalysis(original).Valid);

        var renamed = original.Clone();
        renamed.ClearNickname();
        renamed.RefreshChecksum();

        Assert.Equal("Sparky", LegalizerService.KeepName(renamed, original).Nickname);
    }

    [Fact]
    public void LegalizeKeepsTheNameOfARepairedMon()
    {
        using var session = Legal(7, 25);
        var before = session.SaveFile.GetBoxSlotAtIndex(0, 0);

        // An impossible ball makes it illegal without touching its name.
        session.ApplyEdit(0, 0, new EntityEdit(Ball: 999));
        var outcome = new LegalizerService().LegalizeSlot(session, 0, 0);

        Assert.True(outcome.Success, outcome.Message);
        var after = session.SaveFile.GetBoxSlotAtIndex(0, 0);
        Assert.Equal(before.Nickname, after.Nickname);
        Assert.Equal(before.Language, after.Language);
    }

    [Theory]
    [InlineData("Pikachu", false)]
    [InlineData("Évoli", false)]
    [InlineData("ピカチュウ", true)]
    [InlineData("皮卡丘", true)]
    [InlineData("피카츄", true)]
    public void AsianScriptIsSpotted(string name, bool asian) =>
        Assert.Equal(asian, LegalizerService.HasAsianScript(name));
}
