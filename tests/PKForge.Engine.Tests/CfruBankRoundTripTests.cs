using PKForge.Domain;
using PKForge.Engine;
using PKForge.Engine.RadicalRed;
using PKForge.Engine.Unbound;
using PKForge.Infrastructure;
using Xunit;

namespace PKForge.Engine.Tests;

/// <summary>
/// CFRU Pokémon (Unbound, Radical Red, GS Chronicles) through the Bank and through their
/// own PC, on the demo saves in .local-testdata/romhacks/demo (gitignored: derived from
/// players' saves; skipped when absent). The old export turned each one into a vanilla
/// .pk3: species past Deoxys could not be described at all (108 of Radical Red's 160, 16 of
/// Unbound's 28), and the rest came back with a Poké Ball, 70 friendship, no met data, no
/// hidden ability and (Unbound) no language. Every mon must now deposit, show in the Bank,
/// and come back to its own game byte for byte.
/// </summary>
public sealed class CfruBankRoundTripTests : IDisposable
{
    private const string RadicalRedSave = "Radical Red.sav";
    private const string UnboundSave = "Pokemon Unbound.srm";

    private readonly string _root = Path.Combine(Path.GetTempPath(), "pkforge-cfrubank-" + Guid.NewGuid().ToString("N"));
    private readonly SaveEngine _engine = new();

    public void Dispose()
    {
        try { Directory.Delete(_root, recursive: true); } catch { /* best effort */ }
    }

    public static TheoryData<string, string> Saves => new()
    {
        { UnboundSave, CfruEntity.Unbound },
        { RadicalRedSave, CfruEntity.RadicalRed },
        { "Pokemon GS Chronicles.sav", CfruEntity.GsChronicles },
    };

    public static TheoryData<string> PartyGames => new() { UnboundSave, RadicalRedSave };

    /// <summary>The demo save's bytes, or null when the gitignored data is absent (CI).</summary>
    private static byte[]? Demo(string file)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "PKForge.sln")))
            directory = directory.Parent;
        var path = directory is null ? null : Path.Combine(directory.FullName, ".local-testdata", "romhacks", "demo", file);
        return path is not null && File.Exists(path) ? File.ReadAllBytes(path) : null;
    }

    private static IReadOnlyList<SlotImage> Occupied(ISaveEngineSession session) =>
        [.. (session is UnboundEngineSession unbound ? unbound.SlotImages() : ((CfruEngineSession)session).SlotImages())
            .Where(image => !image.Empty)];

    private static byte[] SlotBytes(ISaveEngineSession session, SlotRef slot) =>
        Occupied(session).Single(image => image.Slot == slot).Bytes;

    [Theory]
    [MemberData(nameof(Saves))]
    public void PartyPokemonSwapPlacesInAFullParty(string file, string format)
    {
        if (Demo(file) is not { } bytes) return;
        using var session = _engine.OpenSession(bytes, file);
        var party = Occupied(session).Where(image => image.Slot.Box == -1).OrderBy(image => image.Slot.Slot).ToList();
        if (party.Count < 2) return;
        Assert.Equal(format, session.ExportSlot(-1, 0).Format);
        var last = party[^1].Slot.Slot;

        // The first and the last Pokémon trade places byte for byte; the others stay put,
        // even with six in the party (moving to the end used to be refused as "full").
        session.MoveSlot(-1, 0, -1, last);
        Assert.Equal(party[^1].Bytes, SlotBytes(session, new SlotRef(-1, 0)));
        Assert.Equal(party[0].Bytes, SlotBytes(session, new SlotRef(-1, last)));
        for (var i = 1; i < party.Count - 1; i++)
            Assert.Equal(party[i].Bytes, SlotBytes(session, party[i].Slot));
        Assert.Equal(party.Count, Occupied(session).Count(image => image.Slot.Box == -1));
    }

    [Theory]
    [MemberData(nameof(Saves))]
    public void EveryMonDepositsInTheBank(string file, string format)
    {
        if (Demo(file) is not { } bytes) return;
        using var session = _engine.OpenSession(bytes, file);
        var mons = Occupied(session);
        Assert.NotEmpty(mons);
        Assert.True(mons.All(image => image.Valid));

        var bank = new FileBankService(Path.Combine(_root, format));
        foreach (var image in mons)
        {
            var (box, slot) = (image.Slot.Box, image.Slot.Slot);
            var detail = session.ReadEntity(box, slot);
            var export = session.ExportSlot(box, slot);
            Assert.Equal(format, export.Format);
            Assert.EndsWith("." + format.ToLowerInvariant(), export.FileName);
            Assert.Equal(58, export.Data.Length);

            var info = _engine.TryDescribeEntity(export.Data, file, export.Format);
            Assert.NotNull(info);
            Assert.Equal(format, info.Format);
            Assert.Equal(3, info.Generation);
            Assert.Equal(detail.Species, info.Species);
            Assert.Equal(detail.Form, info.Form);
            Assert.Equal(detail.Nickname, info.Nickname);
            Assert.Equal(detail.IsShiny, info.Shiny);
            if (box >= 0) Assert.Equal(detail.Level, info.Level); // a party level byte may disagree with EXP
            bank.Add(export.Data, info);
        }

        // The index on disk keeps the format, so the Bank hands the bytes back as what they are.
        var reloaded = new FileBankService(Path.Combine(_root, format)).GetAll();
        Assert.Equal(mons.Count, reloaded.Count);
        Assert.All(reloaded, entry => Assert.Equal(format, entry.Info.Format));
    }

    [Theory]
    [MemberData(nameof(Saves))]
    public void BoxedMonsComeHomeByteIdentical(string file, string format)
    {
        if (Demo(file) is not { } bytes) return;
        using var original = _engine.OpenSession(bytes, file);
        foreach (var image in Occupied(original).Where(image => image.Slot.Box >= 0))
        {
            var (box, slot) = (image.Slot.Box, image.Slot.Slot);
            using var game = _engine.OpenSession(bytes, file);
            var export = game.ExportSlot(box, slot);
            Assert.Equal(format, export.Format);
            Assert.Equal(image.Bytes, export.Data);
            var info = _engine.TryDescribeEntity(export.Data, file, export.Format)!;
            game.ReleaseSlot(box, slot); // "Send to Bank" is a move

            // The transfer's dry run on a throwaway copy, then the real import, as TransferService does.
            using (var scratch = _engine.OpenSession(game.Serialize(), file))
            {
                var preview = new TransferPreviewService().Preview(scratch, box, slot, export.Data, info.Format);
                Assert.NotNull(preview);
                Assert.Equal("It goes back into its own game exactly as it was stored.", Assert.Single(preview.Changes));
            }
            Assert.True(game.ImportSlot(box, slot, export.Data, info.Format));

            Assert.Equal(image.Bytes, SlotBytes(game, image.Slot));
            Assert.Equal(bytes, game.Serialize().ToArray());
        }
    }

    [Theory]
    [MemberData(nameof(Saves))]
    public void PartyMonsTravelAsTheGameBoxesThem(string file, string format)
    {
        if (Demo(file) is not { } bytes) return;
        using var original = _engine.OpenSession(bytes, file);
        var empty = original.Snapshot.Slots.First(s => s.Box >= 0 && s.Species is null);
        foreach (var image in Occupied(original).Where(image => image.Slot.Box == -1))
        {
            var export = original.ExportSlot(-1, image.Slot.Slot);
            Assert.Equal(format, export.Format);
            Assert.Equal(CfruEntity.Compact(image.Bytes), export.Data);

            // Into a box: the compact record lands as it is.
            using var game = _engine.OpenSession(bytes, file);
            Assert.True(game.ImportSlot(empty.Box, empty.Slot, export.Data, export.Format));
            Assert.Equal(export.Data, SlotBytes(game, new SlotRef(empty.Box, empty.Slot)));

            // Into the party: withdrawn like the game does, every stored field intact.
            game.ReleaseSlot(-1, image.Slot.Slot);
            Assert.True(game.ImportSlot(-1, 0, export.Data, export.Format));
            var party = Occupied(game).Where(i => i.Slot.Box == -1).Last();
            Assert.Equal(export.Data, CfruEntity.Compact(party.Bytes));
            AssertWithdrawn(game, party.Slot.Slot);
        }
    }

    [Theory]
    [MemberData(nameof(Saves))]
    public void TheBankShowsTheRecordThroughItsOwnGame(string file, string format)
    {
        if (Demo(file) is not { } bytes) return;
        using var session = _engine.OpenSession(bytes, file);
        var bank = new FileBankService(Path.Combine(_root, format));
        foreach (var image in Occupied(session))
        {
            var (box, slot) = (image.Slot.Box, image.Slot.Slot);
            var source = session.ReadEntity(box, slot);
            var export = session.ExportSlot(box, slot);
            var entry = bank.Add(export.Data, _engine.TryDescribeEntity(export.Data, file, export.Format)!);

            // The Bank's viewer (Summary, panel, QR preview) is a session of the record's own game.
            using var view = _engine.OpenEntitySession(export.Data, source.Nickname, export.Format);
            Assert.NotNull(view);
            var shown = view.ReadEntity(0, 0);
            Assert.Equal((source.Species, source.Form, source.Nickname, source.Nature, source.Ability, source.HeldItem),
                (shown.Species, shown.Form, shown.Nickname, shown.Nature, shown.Ability, shown.HeldItem));
            Assert.Equal((source.Move1, source.Move2, source.Move3, source.Move4), (shown.Move1, shown.Move2, shown.Move3, shown.Move4));
            Assert.Equal(source.IVs, shown.IVs);
            Assert.Equal(source.EVs, shown.EVs);
            Assert.Equal((source.IsShiny, source.Ball, source.Gender, source.OriginalTrainer),
                (shown.IsShiny, shown.Ball, shown.Gender, shown.OriginalTrainer));
            if (box >= 0) Assert.Equal((source.Level, source.Friendship), (shown.Level, shown.Friendship));
            Assert.Equal(export.Data, view.ExportSlot(0, 0).Data);

            var summary = new MonSummaryService().Build(view, 0, 0);
            Assert.NotNull(summary);
            Assert.Equal(source.Species, summary.Species);

            // Sorts and filters read the same facts.
            var facts = EntityBytes.StoredFacts(entry, bank.GetData(entry.Id));
            Assert.NotNull(facts);
            Assert.Equal((source.Gender, source.Ball), (facts.Value.Gender, facts.Value.Ball));
        }
    }

    [Theory]
    [MemberData(nameof(PartyGames))]
    public void PartyToBoxToPartyKeepsTheRecord(string file)
    {
        if (Demo(file) is not { } bytes) return;
        using var original = _engine.OpenSession(bytes, file);
        var empty = original.Snapshot.Slots.First(s => s.Box >= 0 && s.Species is null);
        foreach (var image in Occupied(original).Where(image => image.Slot.Box == -1))
        {
            using var game = _engine.OpenSession(bytes, file);
            var record = CfruEntity.Compact(image.Bytes);
            game.MoveSlot(-1, image.Slot.Slot, empty.Box, empty.Slot);
            Assert.Equal(record, SlotBytes(game, new SlotRef(empty.Box, empty.Slot)));

            game.MoveSlot(empty.Box, empty.Slot, -1, 0);
            var party = Occupied(game).Where(i => i.Slot.Box == -1).Last();
            Assert.Equal(record, CfruEntity.Compact(party.Bytes));
            AssertWithdrawn(game, party.Slot.Slot);

            using var reopened = _engine.OpenSession(game.Serialize(), file);
            Assert.Equal(party.Bytes, SlotBytes(reopened, party.Slot));
        }
    }

    /// <summary>A mon just put into the party: stats in the tail's own order, full HP and PP.</summary>
    private static void AssertWithdrawn(ISaveEngineSession game, int slot)
    {
        var bytes = SlotBytes(game, new SlotRef(-1, slot));
        if (game is UnboundEngineSession)
        {
            var mon = new UnboundMon(bytes, 0, party: true);
            Assert.Equal(UnboundData.ComputeStats(mon), mon.PartyStats);
            Assert.Equal(mon.PartyStats![0], mon.CurrentHp);
            Assert.All(Enumerable.Range(0, 4).Where(i => mon.Moves[i] > 0),
                i => Assert.True(mon.MovePp[i] >= UnboundData.MoveBasePp(mon.Moves[i])));
        }
        else
        {
            var mon = new RadicalRedMon(bytes, 0, true);
            Assert.Equal(mon.Data.ComputeStats(mon), mon.PartyStats);
            Assert.Equal(mon.PartyStats![0], mon.CurrentHp);
            Assert.All(game.GetMoveDetails(-1, slot).Moves.Where(move => move.MaxPP > 0),
                move => Assert.Equal(move.MaxPP, move.PP));
        }
    }

    [Fact]
    public void CompactKeepsEveryFieldTheSessionReads()
    {
        if (Demo(RadicalRedSave) is not { } bytes) return;
        using var session = _engine.OpenSession(bytes, "Radical Red");
        foreach (var image in Occupied(session).Where(image => image.Slot.Box == -1))
        {
            var party = new RadicalRedMon(image.Bytes, 0, true);
            var boxed = new RadicalRedMon(CfruEntity.Compact(image.Bytes), 0, false);
            Assert.Equal(party.Pid, boxed.Pid);
            Assert.Equal(party.Otid, boxed.Otid);
            Assert.Equal(party.Nickname, boxed.Nickname);
            Assert.Equal(party.OriginalTrainerName, boxed.OriginalTrainerName);
            Assert.Equal(party.Language, boxed.Language);
            Assert.Equal(party.SanityFlags, boxed.SanityFlags);
            Assert.Equal(party.Markings, boxed.Markings);
            Assert.Equal(party.Species, boxed.Species);
            Assert.Equal(party.HeldItem, boxed.HeldItem);
            Assert.Equal(party.Experience, boxed.Experience);
            Assert.Equal(party.PpBonuses, boxed.PpBonuses);
            Assert.Equal(party.Friendship, boxed.Friendship);
            Assert.Equal(party.Ball, boxed.Ball);
            Assert.Equal(party.Moves, boxed.Moves);
            Assert.Equal(party.EVs, boxed.EVs);
            Assert.Equal(party.IVs, boxed.IVs);
            Assert.Equal(party.HiddenAbility, boxed.HiddenAbility);
            Assert.Equal(party.IsEgg, boxed.IsEgg);
            Assert.Equal(party.Pokerus, boxed.Pokerus);
            Assert.Equal(party.MetLocation, boxed.MetLocation);
            Assert.Equal(party.MetInfo, boxed.MetInfo);
        }
    }

    [Fact]
    public void OtherGamesStillGetThePk3AndHackOnlySpeciesStayHome()
    {
        if (Demo(RadicalRedSave) is not { } bytes || Demo(UnboundSave) is not { } unboundBytes) return;
        using var session = _engine.OpenSession(bytes, "Radical Red");
        var kirlia = session.ExportSlot(0, 0); // Kirlia exists in Gen 3, its Quick Ball does not
        Assert.Equal((int)PKHeX.Core.Ball.Poke, EntityBytes.Parse(kirlia.Data, kirlia.Format)!.Ball);
        Assert.Contains("Its Quick Ball becomes a Poké Ball: Generation 3 does not have it.",
            CfruEntity.Pk3Adjustments(kirlia.Data, kirlia.Format!));
        var (convertible, pk3) = session.Snapshot.Slots.Where(s => s.Species is not null)
            .Select(s => session.ExportSlot(s.Box, s.Slot))
            .Select(e => (Export: e, Pk3: EntityBytes.Parse(e.Data, e.Format)))
            .First(c => c.Pk3 is not null);
        Assert.IsType<PKHeX.Core.PK3>(pk3);

        var terapagos = session.ExportSlot(-1, 0); // Gen 9: no PK3 can hold it
        Assert.Null(EntityBytes.Parse(terapagos.Data, terapagos.Format));
        var refusal = TransferCompatibility.ExplainRefusal(terapagos.Data, "Terapagos", "Gen3", 3, "Emerald", terapagos.Format);
        Assert.Equal("Terapagos cannot go to Emerald. Terapagos-Terastal does not exist in Generation 3. Only Radical Red can take it.", refusal);
        Assert.Contains("Radical Red", PksmEntityConversion.Encode(terapagos.Data, terapagos.Format).Reason);
        Assert.Equal("Radical Red", EntityBytes.RomHackGame(terapagos.Format));
        Assert.Null(EntityBytes.RomHackGame("PK3"));

        // Another hack's record crosses through the PK3 too, never as raw bytes, and lands
        // as a mon the game counts (language and hasSpecies set).
        using var unbound = _engine.OpenSession(unboundBytes, "Unbound");
        var free = unbound.Snapshot.Slots.First(s => s.Box >= 0 && s.Species is null);
        Assert.True(unbound.ImportSlot(free.Box, free.Slot, convertible.Data, convertible.Format));
        Assert.Equal(pk3!.Species, unbound.ReadEntity(free.Box, free.Slot).Species);
        var landed = SlotBytes(unbound, new SlotRef(free.Box, free.Slot));
        Assert.NotEqual(convertible.Data, landed);
        Assert.Equal((2, 2), (landed[0x12], landed[0x13]));
    }

    [Fact]
    public void ExportedFilesComeBackThroughEveryImport()
    {
        if (Demo(RadicalRedSave) is not { } bytes) return;
        using var session = _engine.OpenSession(bytes, "Radical Red");
        var export = session.ExportSlot(-1, 0); // Terapagos: only its own game reads it
        var file = $"1024 - Terapagos 1a2b3c4d.pk3rr";

        // Bank: Import .pk file and folder imports describe by the file name.
        var info = _engine.TryDescribeEntity(export.Data, file, file);
        Assert.Equal(CfruEntity.RadicalRed, info?.Format);
        Assert.True(BankArchive.IsPkFileName(file));

        // PKSM import's loose files keep the record as it is.
        var loose = PksmEntityConversion.Decode(null, false, export.Data, file);
        Assert.Equal(export.Data, loose.Bytes);
        Assert.Equal(CfruEntity.RadicalRed, loose.Info?.Format);

        // A game's Import .pk names the format the same way.
        var free = session.Snapshot.Slots.First(s => s.Box >= 0 && s.Species is null);
        Assert.True(session.ImportSlot(free.Box, free.Slot, export.Data, file));
        Assert.Equal(export.Data, SlotBytes(session, new SlotRef(free.Box, free.Slot)));
    }

    [Fact]
    public void FileNamesAndExtensionsNameTheFormat()
    {
        Assert.Equal(CfruEntity.RadicalRed, EntityBytes.Normalize("pk3rr"));
        Assert.Equal(CfruEntity.Unbound, EntityBytes.Normalize("Larvitar.pk3ub"));
        Assert.Equal(CfruEntity.GsChronicles, EntityBytes.Normalize(".PK3GSC"));
        Assert.Equal("PK3", EntityBytes.Normalize("Kirlia.pk3"));
    }
}
