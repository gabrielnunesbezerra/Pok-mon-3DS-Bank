using PKForge.Engine;
using PKHeX.Core;
using Xunit;

namespace PKForge.Engine.Tests;

/// <summary>Legalize keeps where a caught Pokémon came from instead of making it hatched.</summary>
public sealed class LegalizeOriginTests
{
    private const ushort OldChateau = 70; // Gen 4 met location

    [Fact]
    public void AShinyCatchStaysCaughtAtItsLocationInItsBall()
    {
        var save = BlankSaveFile.Get(GameVersion.Pt, "PKForge", LanguageID.English);
        var gastly = new PK4
        {
            Species = (ushort)Species.Gastly,
            CurrentLevel = 16,
            MetLevel = 16,
            MetLocation = OldChateau,
            Version = GameVersion.Pt,
            Ball = (byte)PKHeX.Core.Ball.Master,
            Language = (int)LanguageID.English,
            OriginalTrainerName = save.OT,
            ID32 = save.ID32,
            Move1 = (ushort)Move.Lick,
        };
        gastly.SetPIDGender(0); // male
        gastly.SetShiny();      // a shiny PID that breaks the wild PID/IV link
        gastly.Heal();
        gastly.RefreshChecksum();
        Assert.False(new LegalityAnalysis(gastly).Valid);

        var repaired = LegalizerService.LegalizeKeepingOrigin(save, gastly);

        Assert.True(new LegalityAnalysis(repaired).Valid, new LegalityAnalysis(repaired).Report());
        Assert.False(repaired.WasEgg);
        Assert.Equal(OldChateau, repaired.MetLocation);
        Assert.Equal((byte)PKHeX.Core.Ball.Master, repaired.Ball);
        Assert.True(repaired.IsShiny);
        Assert.Equal(0, repaired.Gender);
    }
}
