using PKForge.Domain;
using PKForge.Engine;
using PKHeX.Core;
using Xunit;

namespace PKForge.Engine.Tests;

/// <summary>"Hatched from egg" is where a Pokémon came from, set and cleared per format.</summary>
public sealed class HatchedOriginTests
{
    private static SaveEngineSession WithMon(int generation, bool hatched)
    {
        var session = (SaveEngineSession)new SaveEngine().OpenBlankSession(generation);
        var mon = session.SaveFile.BlankPKM;
        mon.Species = (ushort)Species.Gastly;
        mon.CurrentLevel = 20;
        if (hatched) mon.EggLocation = EncounterSuggestion.GetSuggestedEncounterEggLocationEgg(mon);
        mon.RefreshChecksum();
        var bytes = new byte[mon.SIZE_STORED];
        mon.WriteDecryptedDataStored(bytes);
        Assert.True(session.ImportSlot(0, 0, bytes));
        return session;
    }

    [Theory]
    [InlineData(4)]
    [InlineData(8)]
    public void HatchedNoClearsTheEggOriginAndYesRestoresIt(int generation)
    {
        using var session = WithMon(generation, hatched: true);
        Assert.True(session.GetMetInfo(0, 0).WasEgg);

        session.ApplyMetEdit(0, 0, new MetEdit(WasEgg: false));
        var cleared = session.GetMetInfo(0, 0);
        Assert.False(cleared.WasEgg);
        Assert.False(cleared.IsEgg); // it never becomes an egg

        session.ApplyMetEdit(0, 0, new MetEdit(WasEgg: true));
        Assert.True(session.GetMetInfo(0, 0).WasEgg);
        Assert.False(session.GetMetInfo(0, 0).IsEgg);
    }

    [Fact]
    public void AWildBdspCatchIsNotReadAsHatched()
    {
        // BDSP marks "no egg location" as 65535, not 0.
        using var session = new SaveEngineSession(new SAV8BS { Version = GameVersion.BD }.Write().ToArray());
        var mon = new PB8 { Species = (ushort)Species.Gastly, CurrentLevel = 20, Version = GameVersion.BD };
        Assert.Equal(Locations.Default8bNone, mon.EggLocation);
        mon.RefreshChecksum();
        var bytes = new byte[mon.SIZE_STORED];
        mon.WriteDecryptedDataStored(bytes);
        Assert.True(session.ImportSlot(0, 0, bytes));
        Assert.False(session.GetMetInfo(0, 0).WasEgg);
    }
}
