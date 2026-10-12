using System.Buffers.Binary;
using PKHeX.Core;
using PKForge.Domain;
using PKForge.Engine;
using Xunit;

namespace PKForge.Engine.Tests;

/// <summary>
/// The dex editor's save path end to end, the way the app runs it: set an entry through the
/// session, serialize, reopen the bytes as a new session, read the entry back. A setter that
/// falls through to SaveFile's no-op base looks fine until the reload.
/// </summary>
public sealed class DexRoundTripTests
{
    private const int Alakazam = 65;
    private const int Pikachu = 25; // in Paldea, unlike Alakazam

    private static SaveFile BlankSave(GameVersion version)
    {
        var save = BlankSaveFile.Get(version, "PKForge", LanguageID.English);
        // A new game stamps the Gen 7 dex block's magic; PKHeX's blank leaves it zero, and
        // Zukan7 asserts on it when the written bytes are loaded again.
        var dex = save switch { SAV7 s7 => s7.Zukan.Data, SAV7b gg => gg.Zukan.Data, _ => default };
        if (!dex.IsEmpty) BinaryPrimitives.WriteUInt32LittleEndian(dex, 0x2F120F17);
        return save;
    }

    /// <summary>Reopens what the session would write. Byte-backed saves reload from the
    /// serialized file. PKHeX's Switch blanks (SCBlock saves) carry blocks a real file never
    /// has, so their encrypted image can't be decrypted again; those reload from a deep copy
    /// of the block list, which is exactly what SwishCrypto.Encrypt writes out.</summary>
    private static SaveEngineSession Reload(SaveEngineSession session, SaveFile save)
    {
        var bytes = session.Serialize().ToArray();
        SaveFile reloaded = save switch
        {
            ISCBlockArray => save.Clone(),
            SAV7b => new SAV7b(bytes),
            SAV7USUM => new SAV7USUM(bytes),
            SAV6XY => new SAV6XY(bytes),
            SAV5B2W2 => new SAV5B2W2(bytes),
            SAV8BS => new SAV8BS(bytes),
            _ => throw new ArgumentOutOfRangeException(nameof(save), save.GetType().Name),
        };
        return new SaveEngineSession(reloaded, null);
    }

    [Theory]
    [InlineData(GameVersion.GP, Alakazam)]  // Let's Go Pikachu (SAV7b)
    [InlineData(GameVersion.SW, Alakazam)]  // Sword (SAV8SWSH)
    [InlineData(GameVersion.BD, Alakazam)]  // Brilliant Diamond (SAV8BS)
    [InlineData(GameVersion.PLA, Alakazam)] // Legends: Arceus (SAV8LA)
    [InlineData(GameVersion.SL, Pikachu)]   // Scarlet (SAV9SV)
    [InlineData(GameVersion.ZA, Alakazam)]  // Legends: Z-A (SAV9ZA)
    [InlineData(GameVersion.US, Alakazam)]  // Ultra Sun (SAV7)
    [InlineData(GameVersion.X, Alakazam)]   // X (SAV6XY)
    [InlineData(GameVersion.B2, Alakazam)]  // Black 2 (SAV5)
    public void CaughtAndSeenSurviveWriteAndReload(GameVersion version, int species)
    {
        var save = BlankSave(version);
        using var session = new SaveEngineSession(save, null);
        Assert.False(session.GetDexEntry(species).Caught);

        session.SetDexEntry(species, seen: true, caught: true);
        using (var caught = Reload(session, save))
        {
            var state = caught.GetDexEntry(species);
            Assert.True(state.Seen, $"{version}: seen lost on reload");
            Assert.True(state.Caught, $"{version}: caught lost on reload");
        }

        session.SetDexEntry(species, seen: true, caught: false);
        using (var seenOnly = Reload(session, save))
        {
            var state = seenOnly.GetDexEntry(species);
            Assert.True(state.Seen, $"{version}: seen lost when caught was cleared");
            Assert.False(state.Caught, $"{version}: caught did not clear");
        }

        // Legends: Arceus has no way back to "never seen": its research entry keeps the
        // updated flag once set (PKHeX's own editor can't clear it either).
        if (version == GameVersion.PLA) return;

        session.SetDexEntry(species, seen: false, caught: false);
        using var cleared = Reload(session, save);
        Assert.Equal(new DexEntryState(false, false), cleared.GetDexEntry(species));
    }

    [Theory]
    [InlineData(GameVersion.GP, true)]
    [InlineData(GameVersion.SW, true)]   // Isle of Armor
    [InlineData(GameVersion.BD, true)]
    [InlineData(GameVersion.PLA, true)]
    [InlineData(GameVersion.SL, false)]  // the Abra line never came to Paldea or its DLC
    [InlineData(GameVersion.ZA, true)]
    [InlineData(GameVersion.US, true)]
    public void EditorOnlyOffersSpeciesTheGameCanRecord(GameVersion version, bool hasAlakazam)
    {
        var save = BlankSave(version);
        using var session = new SaveEngineSession(save, null);
        Assert.Equal(hasAlakazam, session.IsDexSpecies(Alakazam));
        if (hasAlakazam) return;

        // The reason it's hidden: the game has no cell, so the write is dropped.
        session.SetDexEntry(Alakazam, seen: true, caught: true);
        using var reopened = Reload(session, save);
        Assert.Equal(new DexEntryState(false, false), reopened.GetDexEntry(Alakazam));
    }

    [Theory]
    [InlineData(GameVersion.GP)]
    [InlineData(GameVersion.PLA)]
    [InlineData(GameVersion.ZA)]
    public void CompleteDexCountsAfterReload(GameVersion version)
    {
        var save = BlankSave(version);
        using var session = new SaveEngineSession(save, null);
        session.CompleteDex();
        using var reopened = Reload(session, save);
        Assert.True(reopened.GetDexProgress().Caught > 0, $"{version}: Complete the Pokédex wrote nothing");
    }
}
