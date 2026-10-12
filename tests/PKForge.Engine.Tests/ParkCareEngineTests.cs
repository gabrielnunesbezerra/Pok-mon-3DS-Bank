using PKForge.Domain;
using PKForge.Engine;
using PKHeX.Core;
using Xunit;

namespace PKForge.Engine.Tests;

/// <summary>The Poképark's earned changes: friendship and the once-only nature change.</summary>
public sealed class ParkCareEngineTests
{
    private static byte[] Stored(PKM mon)
    {
        mon.RefreshChecksum();
        var bytes = new byte[mon.SIZE_STORED];
        _ = mon.WriteDecryptedDataStored(bytes);
        return bytes;
    }

    private static T Plain<T>(T mon, GameVersion version) where T : PKM
    {
        mon.Species = (ushort)Species.Pikachu;
        mon.CurrentLevel = 30;
        mon.Version = version;
        mon.OriginalTrainerName = "Gab";
        mon.Language = (int)LanguageID.English;
        mon.TID16 = 12345;
        mon.SID16 = 54321;
        mon.PID = 0x12345678;
        mon.Move1 = 33;
        mon.IV_HP = 31;
        mon.IV_SPE = 7;
        mon.CurrentFriendship = 70;
        mon.Nickname = SpeciesName.GetSpeciesNameGeneration(mon.Species, mon.Language, mon.Format);
        return mon;
    }

    [Fact]
    public void FriendshipRisesInTheSameFormatAndCapsAt255()
    {
        var bytes = Stored(Plain(new PK7(), GameVersion.UM));
        var before = ParkCareEngine.Read(bytes, "PK7")!;
        Assert.True(before.SupportsFriendship);
        Assert.Equal(70, before.Friendship);

        var updated = ParkCareEngine.AddFriendship(bytes, "PK7", ParkCareRules.FriendshipPerCare, out var friendship)!;
        Assert.Equal(80, friendship);
        Assert.Equal(bytes.Length, updated.Length);
        var after = ParkCareEngine.Read(updated, "PK7")!;
        Assert.Equal(80, after.Friendship);
        Assert.Equal(before.Nature, after.Nature);
        Assert.Equal(before.IdentityKey, after.IdentityKey);

        var full = ParkCareEngine.AddFriendship(updated, "PK7", 500, out friendship)!;
        Assert.Equal(255, friendship);
        Assert.Equal(255, ParkCareEngine.Read(full, "PK7")!.Friendship);
    }

    [Fact]
    public void NatureChangesOnceKeepingTheSamePokemon()
    {
        var bytes = Stored(Plain(new PK7(), GameVersion.UM));
        var before = ParkCareEngine.Read(bytes, "PK7")!;
        var wanted = (before.Nature + 5) % 25;

        var updated = ParkCareEngine.ChangeNature(bytes, "PK7", wanted, out var refusal);
        Assert.Null(refusal);
        Assert.NotNull(updated);
        var after = ParkCareEngine.Read(updated!, "PK7")!;
        Assert.Equal(wanted, after.Nature);
        Assert.Equal(before.Friendship, after.Friendship);
        Assert.Equal(before.IdentityKey, after.IdentityKey);

        Assert.Null(ParkCareEngine.ChangeNature(updated!, "PK7", wanted, out refusal));
        Assert.NotNull(refusal);
    }

    [Fact]
    public void Gen3NatureChangeKeepsGenderShininessAndIdentity()
    {
        var mon = Plain(new PK3(), GameVersion.E);
        var bytes = Stored(mon);
        var before = ParkCareEngine.Read(bytes, "PK3")!;
        var wanted = (before.Nature + 1) % 25;

        var updated = ParkCareEngine.ChangeNature(bytes, "PK3", wanted, out var refusal);
        Assert.Null(refusal);
        var changed = EntityBytes.Parse(updated!, "PK3")!;
        Assert.Equal(wanted, (int)changed.Nature);
        Assert.Equal(mon.Gender, changed.Gender);
        Assert.Equal(mon.IsShiny, changed.IsShiny);
        Assert.Equal(before.IdentityKey, ParkCareEngine.Read(updated!, "PK3")!.IdentityKey);
    }

    [Fact]
    public void GameBoyPokemonHaveNoNature()
    {
        var mon = new PK2 { Species = (ushort)Species.Pikachu, CurrentLevel = 30, CurrentFriendship = 70 };
        var bytes = Stored(mon);
        var facts = ParkCareEngine.Read(bytes, "PK2")!;
        Assert.False(facts.SupportsNature);
        Assert.Null(ParkCareEngine.ChangeNature(bytes, "PK2", 3, out var refusal));
        Assert.NotNull(refusal);
    }
}
