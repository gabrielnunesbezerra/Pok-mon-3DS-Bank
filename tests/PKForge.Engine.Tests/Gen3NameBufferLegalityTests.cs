using PKForge.Domain;
using PKHeX.Core;
using Xunit;

namespace PKForge.Engine.Tests;

/// <summary>
/// v3.0.3 reports: legitimately obtained Gen 3 Pokémon flagged "Final terminator missing",
/// and an ORAS-only event Malamar kept in a Pokémon Y save. Each Pokémon is built from
/// PKHeX's own encounter templates and checked through PKForge's legality path.
/// </summary>
public sealed class Gen3NameBufferLegalityTests
{
    private const string FinalTerminatorMissing = "Final terminator missing.";

    private static SaveFile FireRed() => BlankSaveFile.Get(GameVersion.FR, "Sof", LanguageID.English);

    private static T Encounter<T>(PKM probe, ITrainerInfo trainer, GameVersion version, Func<T, bool> match)
        where T : IEncounterable =>
        EncounterMovesetGenerator.GenerateEncounters(probe, trainer, ReadOnlyMemory<ushort>.Empty, version)
            .OfType<T>().First(match);

    /// <summary>Colosseum/XD rewrite the OT with zeroes after its terminator when handing a
    /// Pokémon to a GBA game, but the nickname can keep stale bytes of a name converted before
    /// it (PKHeX's legal XD Articuno sample "3008" carries such bytes).</summary>
    private static PK3 HandedBackByGameCube(XK3 xk3, string previousName)
    {
        var pk3 = xk3.ConvertToPK3();
        Span<byte> previous = stackalloc byte[10];
        previous.Fill(StringConverter3.TerminatorByte);
        StringConverter3.SetString(previous, previousName, 10, pk3.Language, StringConverterOption.None);
        var nickname = pk3.NicknameTrash;
        var end = nickname.IndexOf(StringConverter3.TerminatorByte);
        Assert.InRange(end, 0, nickname.Length - 2); // the test needs room for stale bytes
        previous[(end + 1)..].CopyTo(nickname[(end + 1)..]);
        pk3.RefreshChecksum();
        return pk3;
    }

    private static LegalityReport AnalyzeInFireRed(PKM pk)
    {
        using var session = new SaveEngineSession(FireRed(), "FR");
        session.SaveFile.SetBoxSlotAtIndex(pk, 0, 0, EntityImportSettings.None);
        return new LegalityService().Analyze(session, 0, 0);
    }

    private static void AssertLegal(LegalityReport report) =>
        Assert.True(report.Valid, string.Join("\n", report.Lines));

    [Theory]
    [InlineData((ushort)Species.Eevee, (ushort)94)]    // Celadon City gift
    [InlineData((ushort)Species.Magikarp, (ushort)104)] // Route 4 salesman
    public void FireRedGiftStaysLegalAfterVisitingXD(ushort species, ushort location)
    {
        var fr = FireRed();
        var gift = Encounter<EncounterStatic3>(new PK3 { Species = species, Language = 2 }, fr, GameVersion.FR,
            e => e.Species == species && e.Location == location);
        var pk = gift.ConvertToPKM(fr);
        AssertLegal(AnalyzeInFireRed(pk));

        var back = HandedBackByGameCube(pk.ConvertToXK3(), "SANDSHREW");
        var report = AnalyzeInFireRed(back);
        AssertLegal(report);
        Assert.DoesNotContain(report.Lines, line => line.Contains(FinalTerminatorMissing, StringComparison.Ordinal));
    }

    [Fact]
    public void TradeEvolvedHuntailStaysLegalAfterVisitingXD()
    {
        var emerald = BlankSaveFile.Get(GameVersion.E, "Sof", LanguageID.English);
        var wild = Encounter<EncounterSlot3>(new PK3 { Species = (ushort)Species.Clamperl, Language = 2 }, emerald, GameVersion.E,
            e => e.Species == (ushort)Species.Clamperl);
        var pk = wild.ConvertToPKM(emerald);

        // Trade evolution as the game does it: the new species name from the ROM table (zero padded).
        pk.Species = (ushort)Species.Huntail;
        pk.NicknameTrash.Clear();
        pk.Nickname = SpeciesName.GetSpeciesNameGeneration(pk.Species, pk.Language, 3);
        pk.RefreshChecksum();
        AssertLegal(AnalyzeInFireRed(pk));

        AssertLegal(AnalyzeInFireRed(HandedBackByGameCube(pk.ConvertToXK3(), "CLAMPERL")));
    }

    [Fact]
    public void XDPokeSpotCaptureStaysLegalInAGbaGame()
    {
        var xd = new SAV3XD { OT = "Sof", Language = (int)LanguageID.English, TID16 = 12345, SID16 = 54321 };
        // XD's Rock Poké Spot, as PKHeX's Encounters3XD lists it (Sandshrew, Gligar, Trapinch).
        var rockSpot = new EncounterArea3XD(90, 027, 23, 207, 20, 328, 20);
        var spot = rockSpot.Slots.First(e => e.Species == (ushort)Species.Gligar);
        var xk3 = spot.ConvertToPKM(xd);

        AssertLegal(AnalyzeInFireRed(xk3.ConvertToPK3()));
        var report = AnalyzeInFireRed(HandedBackByGameCube(xk3, "SANDSHREW"));
        AssertLegal(report);
        Assert.DoesNotContain(report.Lines, line => line.Contains(FinalTerminatorMissing, StringComparison.Ordinal));
    }

    [Fact]
    public void OmegaRubyOnlyEventMalamarIsLegalInPokemonY()
    {
        // Card 552 can only be redeemed in Omega Ruby; Bank keeps the origin game.
        var card = EncounterEvent.MGDB_G6.First(g => g.CardID == 552 && g.Species == (ushort)Species.Malamar);
        Assert.Equal(GameVersion.OR, card.Version);
        var pk = card.ConvertToPKM(BlankSaveFile.Get(GameVersion.OR, "Sof", LanguageID.English));

        using var session = new SaveEngineSession(BlankSaveFile.Get(GameVersion.Y, "Sof", LanguageID.English), "Y");
        var bytes = new byte[pk.SIZE_PARTY];
        pk.WriteDecryptedDataParty(bytes);
        Assert.NotNull(session.ImportSlotWithReport(0, 0, bytes, out var refusal, "pk6"));
        Assert.Null(refusal);
        Assert.Equal(GameVersion.OR, session.GetEntity(0, 0).Version);
        AssertLegal(new LegalityService().Analyze(session, 0, 0));
    }

    private static PK3 FireRedEevee(SaveFile fr)
    {
        var gift = Encounter<EncounterStatic3>(new PK3 { Species = (ushort)Species.Eevee, Language = 2 }, fr, GameVersion.FR,
            e => e.Species == (ushort)Species.Eevee);
        var pk = gift.ConvertToPKM(fr);
        pk.NicknameTrash[6..].Fill(0x42); // the game leaves stack garbage after an unnamed species name
        pk.RefreshChecksum();
        return pk;
    }

    [Fact]
    public void RenamingAGen3PokemonFillsTheBufferLikeTheNameRater()
    {
        var fr = FireRed();
        using var session = new SaveEngineSession(fr, "FR");
        session.SaveFile.SetBoxSlotAtIndex(FireRedEevee(fr), 0, 0, EntityImportSettings.None);
        AssertLegal(new LegalityService().Analyze(session, 0, 0));

        session.ApplyEdit(0, 0, new EntityEdit(Nickname: "Bob"));

        var renamed = session.GetEntity(0, 0);
        Assert.Equal("Bob", renamed.Nickname);
        Assert.All(renamed.NicknameTrash[3..].ToArray(), b => Assert.Equal(StringConverter3.TerminatorByte, b));
        AssertLegal(new LegalityService().Analyze(session, 0, 0));
    }

    [Fact]
    public void MakeMineOnGen3CopiesTheSaveNameBuffer()
    {
        var fr = FireRed();
        using var session = new SaveEngineSession(fr, "FR");
        var eevee = FireRedEevee(fr);
        eevee.OriginalTrainerName = "LONGNAM";
        eevee.RefreshChecksum();
        session.SaveFile.SetBoxSlotAtIndex(eevee, 0, 0, EntityImportSettings.None);
        session.SetTrainer(session.GetTrainer() with { Name = "Ash" });

        var outcome = session.MakeMine(0, 0);

        Assert.True(outcome.Success, outcome.Message);
        var owned = (PK3)session.GetEntity(0, 0);
        Assert.Equal("Ash", owned.OriginalTrainerName);
        Assert.All(owned.OriginalTrainerTrash[3..].ToArray(), b => Assert.Equal(StringConverter3.TerminatorByte, b));
        Assert.Equal(((SAV3)session.SaveFile).SmallBlock.OriginalTrainerTrash[..7].ToArray(), owned.OriginalTrainerTrash.ToArray());
        AssertLegal(new LegalityService().Analyze(session, 0, 0));
    }

    [Fact]
    public void RenamingTheGen3TrainerLeavesNoTailForLaterCatches()
    {
        var fr = FireRed();
        using var session = new SaveEngineSession(fr, "FR");
        session.SetTrainer(session.GetTrainer() with { Name = "LONGNAM" });
        session.SetTrainer(session.GetTrainer() with { Name = "Bob" });

        var buffer = ((SAV3)session.SaveFile).SmallBlock.OriginalTrainerTrash.ToArray();
        Assert.Equal("Bob", session.GetTrainer().Name);
        Assert.All(buffer[3..], b => Assert.Equal(StringConverter3.TerminatorByte, b));

        // A gift received after the rename: the game copies the save's name buffer as the OT.
        var eevee = FireRedEevee(fr);
        eevee.OriginalTrainerName = "Bob";
        buffer.AsSpan(0, 7).CopyTo(eevee.OriginalTrainerTrash);
        eevee.RefreshChecksum();
        AssertLegal(AnalyzeInFireRed(eevee));
    }
}
