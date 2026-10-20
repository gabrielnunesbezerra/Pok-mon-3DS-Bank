using PKForge.Infrastructure;
using Xunit;

namespace PKForge.Domain.Tests;

/// <summary>3DS Bank 2.5: the outgoing ledger, the Poképark visit records, the admin account.</summary>
public sealed class BankExitsTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "bank-exits-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }

    [Fact]
    public void TheOutgoingLedgerTravelsInTheBankSnapshot()
    {
        var bank = new FileBankService(_root);
        var entry = bank.Add([1, 2, 3, 4], new BankEntryInfo(25, 0, true, "Pika", 50, 7, "Test", "PK7"));
        var ledger = new OutgoingLedger();
        ledger.Batches["trip"] = new OutgoingBatch("Pokémon Moon", 1, [new OutgoingMon(Convert.ToBase64String(bank.GetData(entry.Id)), entry.Info, entry.Box, entry.Slot)]);
        BankSideFiles.Save(_root, OutgoingLedger.FileName, ledger);
        bank.Remove(entry.Id);

        var snapshot = BankSnapshot.Pack(_root);
        var other = Path.Combine(_root + "-copy");
        try
        {
            BankSnapshot.Restore(other, snapshot);
            var back = BankSideFiles.Load<OutgoingLedger>(other, OutgoingLedger.FileName);
            Assert.Equal([1, 2, 3, 4], back.Batches["trip"].Mons[0].Bytes);
            Assert.Empty(new FileBankService(other).GetAll());
        }
        finally
        {
            if (Directory.Exists(other)) Directory.Delete(other, recursive: true);
        }
    }

    [Fact]
    public void AVisitIsCollectedOnce()
    {
        var ledger = new ParkVisitLedger();
        ledger.MarkCollected("a");
        ledger.MarkCollected("a");
        Assert.Single(ledger.Collected);
        for (var i = 0; i < ParkVisitLedger.Kept + 10; i++) ledger.MarkCollected($"v{i}");
        Assert.Equal(ParkVisitLedger.Kept, ledger.Collected.Count);
    }

    [Fact]
    public void TheGuestBookKnowsWhoseAGuestIs()
    {
        var book = new ParkGuestBook();
        var id = Guid.NewGuid();
        book.Guests["visit1"] = new ParkGuest(id, "uid", "ash", 1);
        Assert.Equal("visit1", book.VisitOf(id));
        Assert.Null(book.VisitOf(Guid.NewGuid()));
    }

    private static string Token(string payloadJson)
    {
        static string Encode(string text) => Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(text)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return $"{Encode("{\"alg\":\"RS256\"}")}.{Encode(payloadJson)}.signature";
    }

    [Fact]
    public void OnlyTheAdminAddressIsTheAdmin()
    {
        var admin = new CloudSession("u1", "adminbielz", Token("{\"email\":\"adminbielz@users.3dsbank.app\"}"), "r", DateTimeOffset.UtcNow);
        var player = new CloudSession("u2", "adminbielz", Token("{\"email\":\"someone@gmail.com\"}"), "r", DateTimeOffset.UtcNow);
        Assert.True(admin.IsAdmin);
        Assert.False(player.IsAdmin);
        Assert.False(new CloudSession("u3", "x", "not-a-token", "r", DateTimeOffset.UtcNow).IsAdmin);
        Assert.Equal("adminbielz@users.3dsbank.app", CloudAccountClient.AdminEmail);
    }

    [Fact]
    public void ArenaEventsOpenAndClose()
    {
        var mon = new ArenaMon("", "PK7", 25, 0, false, "Pika", 50);
        var open = new ArenaEvent("e", "T", "D", true, 0, "adminbielz", mon, [mon], ArenaEvent.RewardChoices.Take(2).ToList(), true);
        Assert.True(open.IsOpen(100));
        Assert.False((open with { EndsUnixMs = 50 }).IsOpen(100));
        Assert.False((open with { Active = false }).IsOpen(100));
        Assert.All(ArenaEvent.RewardChoices, reward => Assert.True(reward.Item > 0 || reward.Stars > 0));
    }
}

public sealed class DuplicateFinderTests
{
    private static BankHolding Mon(string owner, string strict, string loose, bool shiny = true) =>
        new(owner, owner, Guid.NewGuid(), strict, loose, new BankEntryInfo(6, 0, shiny, "Zard", 50, 7, "Test"));

    [Fact]
    public void ExactCopiesAreFoundAndAllButOneGoes()
    {
        var a = Mon("friend", "S1", "L1");
        var b = Mon("friend", "S1", "L1");
        var c = Mon("friend", "S1", "L1");
        var other = Mon("me", "S2", "L2");
        var groups = DuplicateFinder.Find([a, b, c, other]);
        var group = Assert.Single(groups);
        Assert.True(group.Exact);
        Assert.Equal(3, group.Copies.Count);
        Assert.Equal([b.EntryId, c.EntryId], DuplicateFinder.ExtraCopies(groups, "friend"));
        Assert.Empty(DuplicateFinder.ExtraCopies(groups, "me"));
    }

    [Fact]
    public void ACopyChangedLaterIsASuspectAcrossBanks()
    {
        var original = Mon("friend", "S1", "L1");
        var madeShinyLater = Mon("buddy", "S9", "L1");
        var groups = DuplicateFinder.Find([original, madeShinyLater]);
        var group = Assert.Single(groups);
        Assert.False(group.Exact);
        Assert.Equal(2, group.Holders.Count);
        Assert.Empty(DuplicateFinder.ExtraCopies(groups, "friend"));
    }
}

public sealed class BankMergeTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "bank-merge-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        foreach (var dir in new[] { _root, _root + "-phone" })
            if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true);
    }

    private static BankEntryInfo Info(string name) => new(25, 0, name == "Shiny", name, 50, 7, "Test", "PK7");

    [Fact]
    public void AStalePhoneNeverBringsBackAPokemonThatLeftElsewhere()
    {
        // The account at the last sync: A, B and the shiny S.
        var online = new FileBankService(_root);
        var a = online.Add([1], Info("A"));
        var b = online.Add([2], Info("B"));
        var s = online.Add([3], Info("Shiny"));
        var synced = new HashSet<Guid> { a.Id, b.Id, s.Id };

        // The phone, offline since then: it sent S to a game and took N in from a game.
        BankSnapshot.Restore(_root + "-phone", BankSnapshot.Pack(_root));
        var phone = new FileBankService(_root + "-phone");
        phone.Remove(s.Id);
        phone.Add([9], Info("N"));
        var local = phone.GetAll().Select(e => (e, phone.GetData(e.Id))).ToList();

        // Meanwhile online: the admin took the duplicated B out, another phone added C.
        online.Remove(b.Id);
        online.Add([4], Info("C"));

        // The phone's upload is refused, it takes the online Bank and merges its own changes.
        var merged = new FileBankService(_root);
        var (added, letGo) = BankMerge.Apply(merged, local, synced);
        var names = merged.GetAll().Select(e => e.Info.Nickname).Order().ToList();
        Assert.Equal(["A", "C", "N"], names);
        Assert.Equal(1, added);
        Assert.Equal(1, letGo); // S, still online, leaves: the phone sent it to a game
    }

    [Fact]
    public void WhatThePhoneLetGoStaysGoneEvenIfStillOnline()
    {
        var online = new FileBankService(_root);
        var a = online.Add([1], Info("A"));
        var s = online.Add([3], Info("Shiny"));
        var synced = new HashSet<Guid> { a.Id, s.Id };
        var local = online.GetAll().Where(e => e.Id != s.Id).Select(e => (e, online.GetData(e.Id))).ToList();
        var (_, letGo) = BankMerge.Apply(online, local, synced);
        Assert.Equal(1, letGo);
        Assert.DoesNotContain(online.GetAll(), e => e.Id == s.Id);
    }

    [Fact]
    public void AnExactCopyIsNeverAddedTwice()
    {
        var online = new FileBankService(_root);
        online.Add([7, 7], Info("Same"));
        var phone = new FileBankService(_root + "-phone");
        var copy = phone.Add([7, 7], Info("Same"));
        var (added, _) = BankMerge.Apply(online, [(copy, phone.GetData(copy.Id))], new HashSet<Guid>());
        Assert.Equal(0, added);
        Assert.Single(online.GetAll());
    }
}

public sealed class OnlineRecordJsonTests
{
    private static readonly System.Text.Json.JsonSerializerOptions Json = new() { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase };

    [Fact]
    public void AnEventGoesOnlineAndComesBack()
    {
        var mon = ArenaMon.From([1, 2, 3], new BankEntryInfo(6, 0, true, "Zard", 80, 7, "Test", "PK7"));
        var sent = new ArenaEvent("e1", "Cup", "Win!", true, 5, "adminbielz", mon, [mon, mon], [ArenaEvent.RewardChoices[0]], true);
        var json = System.Text.Json.JsonSerializer.Serialize(sent, Json);
        Assert.DoesNotContain("\"bytes\"", json);
        Assert.Contains("\"championAura\":true", json);
        var back = System.Text.Json.JsonSerializer.Deserialize<ArenaEvent>(json, Json)!;
        Assert.Equal(2, back.Loaners.Count);
        Assert.Equal([1, 2, 3], back.Champion.Bytes);
        Assert.Equal("Master Ball ×5", back.Rewards[0].Name);
    }

    [Fact]
    public void AVisitGoesOnlineWithTheFieldsTheRulesCheck()
    {
        var visit = ParkVisit.From("v1", "alice", "alice", [9, 9], new BankEntryInfo(25, 0, false, "Pika", 30, 7, "Test", "PK7"), 1);
        var json = System.Text.Json.JsonSerializer.Serialize(visit, Json);
        Assert.Contains("\"ownerUid\":\"alice\"", json);
        Assert.Contains("\"state\":\"sent\"", json);
        Assert.Contains("\"data\":\"CQk=\"", json);
        Assert.DoesNotContain("\"bytes\"", json);
        var back = System.Text.Json.JsonSerializer.Deserialize<ParkVisit>(json, Json)!;
        Assert.Equal(visit, back);
    }
}

public sealed class BankLedgerMergeTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "ledger-merge-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }

    [Fact]
    public void APokemonInFlightSurvivesAMergeAndNothingIsTakenInTwice()
    {
        Directory.CreateDirectory(_root);
        var info = new BankEntryInfo(25, 0, true, "Pika", 50, 7, "Test", "PK7");
        // This phone: a trip to a game under way, a trade held, a visit already collected.
        var outgoing = new OutgoingLedger();
        outgoing.Batches["trip"] = new OutgoingBatch("Pokémon Moon", 1, [new OutgoingMon("AQI=", info, 0, 0)]);
        BankSideFiles.Save(_root, OutgoingLedger.FileName, outgoing);
        var trades = new TradeLedger();
        trades.Escrow["t1"] = new TradeEscrow("AQI=", info, 0, 1, "bob", "bob", 1);
        trades.MarkApplied("t0");
        BankSideFiles.Save(_root, TradeLedger.FileName, trades);
        var visits = new ParkVisitLedger();
        visits.MarkCollected("v1");
        BankSideFiles.Save(_root, ParkVisitLedger.FileName, visits);
        var local = BankMerge.ReadLedgers(_root);

        // The online Bank replaces the folder: it knows nothing of those, but applied trade t1 elsewhere.
        foreach (var file in Directory.GetFiles(_root)) File.Delete(file);
        var online = new TradeLedger();
        online.MarkApplied("t1");
        BankSideFiles.Save(_root, TradeLedger.FileName, online);

        BankMerge.MergeLedgers(_root, local);
        Assert.True(BankSideFiles.Load<OutgoingLedger>(_root, OutgoingLedger.FileName).Batches.ContainsKey("trip"));
        var merged = BankSideFiles.Load<TradeLedger>(_root, TradeLedger.FileName);
        Assert.Empty(merged.Escrow); // t1 was applied already: its held Pokémon is not given back too
        Assert.Contains("t0", merged.Applied);
        Assert.Contains("t1", merged.Applied);
        Assert.Contains("v1", BankSideFiles.Load<ParkVisitLedger>(_root, ParkVisitLedger.FileName).Collected);
    }
}
