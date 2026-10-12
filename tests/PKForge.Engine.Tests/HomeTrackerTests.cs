using PKForge.Domain;
using PKHeX.Core;
using Xunit;

namespace PKForge.Engine.Tests;

/// <summary>
/// Report: event Pokémon, shiny mythicals above all, were illegal for "HOME transfer tracker
/// missing". Only HOME's servers issue a tracker, so a HOME gift received in-app never has
/// one: it is a warning now, not a reason to call the Pokémon illegal.
/// </summary>
public sealed class HomeTrackerTests
{
    [Fact]
    public void AHomeGiftWithoutATrackerIsLegalWithAWarning()
    {
        using var session = new SaveEngineSession(BlankSaveFile.Get(GameVersion.SW, "PKForge", LanguageID.English), null);
        var gift = EncounterEvent.MGDB_G8.First(card => card.CardID == 9011); // shiny Zeraora
        var pk = gift.ConvertToPKM(session.SaveFile);
        Assert.Equal(0ul, ((IHomeTrack)pk).Tracker);

        var la = new LegalityAnalysis(pk);
        Assert.True(la.Valid, la.Report());
        Assert.Contains(la.Results, check => check.Judgement == Severity.Fishy);
    }
}
