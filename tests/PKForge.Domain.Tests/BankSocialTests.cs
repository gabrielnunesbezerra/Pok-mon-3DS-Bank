using System.Text.Json;
using PKForge.Infrastructure;
using Xunit;

namespace PKForge.Domain.Tests;

/// <summary>
/// 3DS Bank 2.0's rules that need no network: the Storage and its Shooting Star achievement,
/// the online trade's stages, the trade ledger, e-mail accounts and the side files.
/// </summary>
public sealed class BankSocialTests
{
    // ── The Storage ──────────────────────────────────────────────────────────

    [Fact]
    public void TheStorageKeepsUpTo999OfAnItem()
    {
        var storage = new StorageState();
        Assert.Equal(10, storage.Add(234, 10));
        Assert.Equal(989, storage.Add(234, 5000));
        Assert.Equal(0, storage.Add(234, 1));
        Assert.Equal(StorageState.MaxPerItem, storage.CountOf(234));
        Assert.False(storage.Take(234, 1000));
        Assert.True(storage.Take(234, 999));
        Assert.Empty(storage.Items);
        Assert.Equal(0, storage.Add(0, 3));
        Assert.Equal(0, storage.Add(-1, 3));
    }

    [Fact]
    public void AStarFallsForEverySixtyPokemonOnce()
    {
        var storage = new StorageState();
        Assert.Equal(0, storage.AwardStars(59));
        Assert.Equal(1, storage.AwardStars(60));
        Assert.Equal(0, storage.AwardStars(60));
        // Taking Pokémon out and putting them back earns nothing new.
        Assert.Equal(0, storage.AwardStars(10));
        Assert.Equal(0, storage.AwardStars(60));
        Assert.Equal(120, storage.NextStarAt);
        // Jumping past several marks at once gives one star per mark.
        Assert.Equal(2, storage.AwardStars(185));
        Assert.Equal(3, storage.Stars);
        Assert.Equal(3, storage.StarsEarned);
        Assert.Equal(240, storage.NextStarAt);
    }

    [Fact]
    public void UsingAStarSpendsIt()
    {
        var storage = new StorageState();
        Assert.False(storage.UseStar());
        storage.AwardStars(60);
        Assert.True(storage.UseStar());
        Assert.False(storage.UseStar());
        Assert.Equal(1, storage.StarsUsed);
        Assert.Equal(1, storage.StarsEarned);
    }

    [Fact]
    public void AHandEditedStorageIsCleanedUp()
    {
        var storage = new StorageState { Items = new() { [5] = 0, [6] = -2, [7] = 5000, [-3] = 4 }, Stars = -1 }.Normalized();
        Assert.Equal(new Dictionary<int, int> { [7] = StorageState.MaxPerItem }, storage.Items);
        Assert.Equal(0, storage.Stars);
    }

    // ── Online trades ────────────────────────────────────────────────────────

    private static readonly TradeOffer Offer = new("AAAA", "PK7", 25, 0, false, "Pikachu", 20, 0, 7);

    private static TradeRecord Trade(string state, string[] offers, string[] confirmed, string[]? done = null) => new(
        "t1", "a", "b", new Dictionary<string, string> { ["a"] = "ash", ["b"] = "misty" }, state, 0,
        offers.ToDictionary(uid => uid, _ => Offer), confirmed.ToDictionary(uid => uid, _ => TradeRules.Fingerprint(Offer)),
        (done ?? []).ToHashSet());

    [Fact]
    public void BothPlayersChooseBeforeAnyoneCanConfirm()
    {
        var view = TradeRules.View(Trade(TradeRecord.Open, ["a"], []), "a");
        Assert.Equal(TradeStage.Choosing, view.Stage);
        Assert.True(view.CanChoose);
        Assert.False(view.CanConfirm);
        Assert.True(view.CanCancel);

        view = TradeRules.View(Trade(TradeRecord.Open, ["a", "b"], []), "a");
        Assert.True(view.CanConfirm);
    }

    [Fact]
    public void AfterTheFirstYesTheOffersAreFrozen()
    {
        var trade = Trade(TradeRecord.Open, ["a", "b"], ["b"]);
        var mine = TradeRules.View(trade, "a");
        Assert.Equal(TradeStage.PartnerConfirmed, mine.Stage);
        Assert.False(mine.CanChoose);
        Assert.True(mine.CanConfirm);

        var theirs = TradeRules.View(trade, "b");
        Assert.Equal(TradeStage.WaitingForPartner, theirs.Stage);
        Assert.False(theirs.CanConfirm);
        Assert.True(theirs.CanCancel);
        Assert.False(TradeRules.ReadyToSeal(trade));
    }

    [Fact]
    public void TwoYesesSealTheTradeAndNobodyCanCancel()
    {
        var trade = Trade(TradeRecord.Open, ["a", "b"], ["a", "b"]);
        Assert.True(TradeRules.ReadyToSeal(trade));
        var view = TradeRules.View(trade, "a");
        Assert.Equal(TradeStage.Sealing, view.Stage);
        Assert.False(view.CanCancel);

        var sealedTrade = Trade(TradeRecord.Committed, ["a", "b"], ["a", "b"], ["b"]);
        Assert.False(TradeRules.ReadyToSeal(sealedTrade));
        Assert.False(TradeRules.View(sealedTrade, "a").Finished);
        Assert.True(TradeRules.View(sealedTrade, "b").Finished);
    }

    [Fact]
    public void AYesForADifferentPokemonNeverSealsTheTrade()
    {
        var other = Offer with { Data = "BBBB" };
        var trade = new TradeRecord("t1", "a", "b", new Dictionary<string, string>(), TradeRecord.Open, 0,
            new Dictionary<string, TradeOffer> { ["a"] = Offer, ["b"] = other },
            new Dictionary<string, string> { ["a"] = TradeRules.Fingerprint(Offer), ["b"] = TradeRules.Fingerprint(Offer) },
            new HashSet<string>());
        Assert.False(TradeRules.ReadyToSeal(trade));
        var view = TradeRules.View(trade, "a");
        Assert.Equal(TradeStage.Mismatch, view.Stage);
        Assert.True(view.CanCancel);
        Assert.NotEqual(TradeRules.Fingerprint(Offer), TradeRules.Fingerprint(other));
    }

    [Fact]
    public void ACalledOffTradeIsOverForBoth()
    {
        var view = TradeRules.View(Trade(TradeRecord.Cancelled, ["a", "b"], ["a"]), "b");
        Assert.Equal(TradeStage.Cancelled, view.Stage);
        Assert.True(view.Finished);
        Assert.False(view.CanConfirm);
    }

    [Fact]
    public void OnlineMeansSeenInTheLast90Seconds()
    {
        Assert.True(TradeRules.IsOnline(100_000, 100_000 + 89_000));
        Assert.False(TradeRules.IsOnline(100_000, 100_000 + 91_000));
        Assert.False(TradeRules.IsOnline(0, 5));
    }

    [Fact]
    public void TheLedgerNeverAppliesATradeTwiceAndForgetsTheOldest()
    {
        var ledger = new TradeLedger();
        ledger.MarkApplied("x");
        ledger.MarkApplied("x");
        Assert.Single(ledger.Applied);
        for (var i = 0; i < TradeLedger.AppliedKept + 10; i++) ledger.MarkApplied($"t{i}");
        Assert.Equal(TradeLedger.AppliedKept, ledger.Applied.Count);
        Assert.DoesNotContain("x", ledger.Applied);
        Assert.Equal($"t{TradeLedger.AppliedKept + 9}", ledger.Applied[^1]);
    }

    [Fact]
    public void ATradeIsReadFromTheServer()
    {
        var json = """
        {
          "a": "uidA", "b": "uidB", "state": "open", "created": 1700000000000,
          "names": { "uidA": "ash", "uidB": "misty" },
          "offers": { "uidA": { "data": "AQID", "format": "PK3", "species": 64, "form": 0, "shiny": true,
                                "nickname": "Kadabra", "level": 30, "item": 233, "generation": 3 } },
          "confirm": { "uidA": "0123456789abcdef" },
          "done": { }
        }
        """;
        using var document = JsonDocument.Parse(json);
        var trade = CloudSocialClient.ReadTrade("t9", document.RootElement);
        Assert.Equal("uidB", trade.PartnerOf("uidA"));
        Assert.Equal("misty", trade.NameOf("uidB"));
        Assert.Equal(1700000000000, trade.CreatedUnixMs);
        var offer = trade.Offers["uidA"];
        Assert.Equal(64, offer.Species);
        Assert.True(offer.Shiny);
        Assert.Equal(233, offer.HeldItem);
        Assert.Equal("PK3", offer.Format);
        Assert.True(trade.HasConfirmed("uidA"));
        Assert.Equal("0123456789abcdef", trade.Confirmations["uidA"]);
        Assert.Empty(trade.Done);
    }

    [Fact]
    public void TradeIdsAreUniqueKeys()
    {
        var ids = Enumerable.Range(0, 50).Select(_ => CloudSocialClient.NewTradeId()).ToList();
        Assert.Equal(ids.Count, ids.Distinct().Count());
        Assert.All(ids, id => Assert.Matches("^[0-9a-f]+$", id));
    }

    // ── Accounts ─────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("gabriel@gmail.com", "gabriel@gmail.com")]
    [InlineData("  Ash.Ketchum@pallet.town ", "Ash.Ketchum@pallet.town")]
    public void EmailsAreTrimmed(string raw, string expected) =>
        Assert.Equal(expected, CloudAccountClient.NormalizeEmail(raw));

    [Theory]
    [InlineData("gabriel")]
    [InlineData("gabriel@")]
    [InlineData("@gmail.com")]
    [InlineData("two words@gmail.com")]
    [InlineData("gabriel@users.3dsbank.app")]
    [InlineData(null)]
    public void InvalidOrPrivateEmailsAreRefused(string? raw) =>
        Assert.Null(CloudAccountClient.NormalizeEmail(raw));

    [Fact]
    public void UsernamesWithDotsBecomeDatabaseKeys()
    {
        Assert.Equal("red,1996", FirebaseDatabase.Key("red.1996"));
        Assert.Equal("red.1996", FirebaseDatabase.Unkey("red,1996"));
        Assert.True(CloudAccountClient.LooksLikeEmail("a@b.c"));
        Assert.False(CloudAccountClient.LooksLikeEmail("ash"));
        Assert.True(CloudAccountClient.IsPrivateAddress("ash@users.3dsbank.app"));
    }

    [Fact]
    public async Task UnconfiguredAccountsCannotSignUpOrResetEither()
    {
        using var http = new HttpClient();
        var client = new CloudAccountClient(new CloudConfig("", ""), http);
        var error = await Assert.ThrowsAsync<CloudAccountException>(() => client.SignUpAsync("gabriel", "g@gmail.com", "secret1"));
        Assert.Contains("not set up", error.Message, StringComparison.Ordinal);
        error = await Assert.ThrowsAsync<CloudAccountException>(() => client.SendPasswordResetAsync("g@gmail.com"));
        Assert.Contains("not set up", error.Message, StringComparison.Ordinal);
    }

    // ── Side files ───────────────────────────────────────────────────────────

    [Fact]
    public void SideFilesRoundTripAndABrokenOneIsSetAside()
    {
        var root = Path.Combine(Path.GetTempPath(), "bank-side-" + Guid.NewGuid().ToString("N"));
        try
        {
            var storage = new StorageState();
            storage.Add(234, 3);
            storage.AwardStars(60);
            BankSideFiles.Save(root, StorageState.FileName, storage);
            var back = BankSideFiles.Load<StorageState>(root, StorageState.FileName);
            Assert.Equal(3, back.CountOf(234));
            Assert.Equal(1, back.Stars);

            File.WriteAllText(Path.Combine(root, StorageState.FileName), "{ not json");
            var fresh = BankSideFiles.Load<StorageState>(root, StorageState.FileName);
            Assert.Empty(fresh.Items);
            Assert.True(File.Exists(Path.Combine(root, StorageState.FileName + ".bad")));
        }
        finally
        {
            if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
        }
    }
}
