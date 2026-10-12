using PKForge.Domain;
using PKForge.Engine;
using PKHeX.Core;
using Xunit;

namespace PKForge.Engine.Tests;

/// <summary>The editor's Friendship row: what friendship evolutions (Golbat, Eevee, Riolu) wait for.</summary>
public sealed class FriendshipEditTests
{
    [Theory]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(8)]
    public void FriendshipIsReadAndWrittenInEveryGenerationThatKeepsIt(int generation)
    {
        using var session = (SaveEngineSession)new SaveEngine().OpenBlankSession(generation);
        var mon = session.SaveFile.BlankPKM;
        mon.Species = (ushort)Species.Golbat;
        mon.CurrentLevel = 30;
        mon.CurrentFriendship = 70;
        mon.RefreshChecksum();
        var bytes = new byte[mon.SIZE_STORED];
        mon.WriteDecryptedDataStored(bytes);
        Assert.True(session.ImportSlot(0, 0, bytes));
        Assert.Equal(70, session.ReadEntity(0, 0).Friendship);

        session.ApplyEdit(0, 0, new EntityEdit(Friendship: 220));
        Assert.Equal(220, session.ReadEntity(0, 0).Friendship);

        session.ApplyEdit(0, 0, new EntityEdit(Friendship: 999)); // clamped to the byte it is stored in
        Assert.Equal(255, session.ReadEntity(0, 0).Friendship);
    }
}
