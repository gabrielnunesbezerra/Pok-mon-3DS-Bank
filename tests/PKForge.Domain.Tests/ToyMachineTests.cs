using Xunit;

namespace PKForge.Domain.Tests;

/// <summary>3DS Bank 2.1's toy machine: tickets, tiers, odds and prizes.</summary>
public sealed class ToyMachineTests
{
    private static readonly ToyRarity[] Tiers = [ToyRarity.Common, ToyRarity.Rare, ToyRarity.Epic, ToyRarity.Legendary, ToyRarity.Secret];

    [Fact]
    public void TheOddsAddUpAndGetRarerTierByTier()
    {
        Assert.Equal(ToyMachine.TotalWeight, ToyMachine.Odds.Sum(odd => odd.Weight));
        Assert.Equal(Tiers, ToyMachine.Odds.Select(odd => odd.Rarity));
        for (var i = 1; i < ToyMachine.Odds.Count; i++)
            Assert.True(ToyMachine.Odds[i].Weight < ToyMachine.Odds[i - 1].Weight);
        Assert.Equal(0.6, ToyMachine.ChanceOf(ToyRarity.Common), 6);
        Assert.Equal(0.01, ToyMachine.ChanceOf(ToyRarity.Secret), 6);
        // Every item's chance together is the whole machine.
        Assert.Equal(1.0, Tiers.Sum(tier => ToyMachine.ChanceOfEach(tier) * ToyMachine.Pool(tier).Count), 9);
    }

    [Theory]
    [InlineData(0, ToyRarity.Common)]
    [InlineData(599, ToyRarity.Common)]
    [InlineData(600, ToyRarity.Rare)]
    [InlineData(849, ToyRarity.Rare)]
    [InlineData(850, ToyRarity.Epic)]
    [InlineData(949, ToyRarity.Epic)]
    [InlineData(950, ToyRarity.Legendary)]
    [InlineData(989, ToyRarity.Legendary)]
    [InlineData(990, ToyRarity.Secret)]
    [InlineData(999, ToyRarity.Secret)]
    public void ARollFallsInItsTier(int roll, ToyRarity expected) => Assert.Equal(expected, ToyMachine.RarityFor(roll));

    [Fact]
    public void ThePrizeListsAreRealItemsAndNeverOverlap()
    {
        var all = Tiers.Where(tier => tier != ToyRarity.Secret).SelectMany(tier => ToyMachine.Pool(tier)).ToList();
        Assert.Equal(all.Count, all.Distinct().Count());
        // Items that exist up to Generation 7 (USUM's last item is 959).
        Assert.All(all, item => Assert.InRange(item, 1, 959));
        Assert.Equal(new[] { 0 }, ToyMachine.Pool(ToyRarity.Secret));
        Assert.Contains(1, ToyMachine.Pool(ToyRarity.Legendary)); // the Master Ball is legendary
        Assert.Contains(30, ToyMachine.Pool(ToyRarity.Common));   // Fresh Water is not
    }

    [Theory]
    [InlineData(0.6, "60%")]
    [InlineData(0.25 / 18, "1.39%")]
    [InlineData(0.04 / 13, "0.308%")]
    public void ChancesAreShownAsPercentages(double chance, string expected) => Assert.Equal(expected, ToyMachine.Percent(chance));

    [Fact]
    public void ReleasingGivesTicketsUpToTheCap()
    {
        var storage = new StorageState();
        Assert.Equal(3, storage.AddTickets(3));
        Assert.Equal(0, storage.AddTickets(0));
        Assert.Equal(StorageState.MaxTickets - 3, storage.AddTickets(int.MaxValue / 2));
        Assert.Equal(StorageState.MaxTickets, storage.Tickets);
        Assert.Equal(0, storage.AddTickets(1));
        Assert.Equal(StorageState.MaxTickets, storage.TicketsEarned);
    }

    [Fact]
    public void NoTicketNoTurn()
    {
        var storage = new StorageState();
        var play = ToyMachine.Play(storage, new Random(1));
        Assert.Null(play.Prize);
        Assert.Contains("Release a Pokémon", play.Refusal, StringComparison.Ordinal);
        Assert.Empty(storage.Items);
        Assert.Equal(0, storage.Spins);
    }

    [Fact]
    public void ATurnSpendsOneTicketAndThePrizeLandsInTheStorage()
    {
        var storage = new StorageState();
        storage.AddTickets(200);
        var random = new Random(7);
        var mysteries = 0;
        for (var i = 0; i < 200; i++)
        {
            var before = storage.Items.Values.Sum();
            var play = ToyMachine.Play(storage, random);
            Assert.NotNull(play.Prize);
            Assert.Contains(play.Prize!.Item, ToyMachine.Pool(play.Prize.Rarity));
            if (play.Prize.IsMystery) mysteries++;
            else Assert.Equal(before + 1, storage.Items.Values.Sum());
        }
        Assert.Equal(0, storage.Tickets);
        Assert.Equal(200, storage.Spins);
        Assert.Equal(mysteries, storage.Mysteries);
    }

    [Fact]
    public void TheMachineFollowsItsOdds()
    {
        var storage = new StorageState();
        var random = new Random(2026);
        var counts = Tiers.ToDictionary(tier => tier, _ => 0);
        const int turns = 200_000;
        for (var i = 0; i < turns; i++)
        {
            storage.Tickets = 1;
            storage.Items.Clear();
            storage.Mysteries = 0;
            counts[ToyMachine.Play(storage, random).Prize!.Rarity]++;
        }
        foreach (var tier in Tiers)
            Assert.InRange(counts[tier] / (double)turns, ToyMachine.ChanceOf(tier) - 0.005, ToyMachine.ChanceOf(tier) + 0.005);
    }

    [Fact]
    public void AFullStorageKeepsTheTicket()
    {
        var storage = new StorageState { Mysteries = StorageState.MaxPerItem };
        foreach (var tier in Tiers.Where(tier => tier != ToyRarity.Secret))
            foreach (var item in ToyMachine.Pool(tier))
                storage.Add(item, StorageState.MaxPerItem);
        storage.AddTickets(1);
        var play = ToyMachine.Play(storage, new Random(3));
        Assert.Null(play.Prize);
        Assert.NotNull(play.Refusal);
        Assert.Equal(1, storage.Tickets);
        Assert.Equal(0, storage.Spins);
    }

    [Fact]
    public void AnItemTheStorageIsFullOfPassesToAnotherOfItsTier()
    {
        var storage = new StorageState();
        var common = ToyMachine.Pool(ToyRarity.Common);
        foreach (var item in common.Skip(1)) storage.Add(item, StorageState.MaxPerItem);
        storage.AddTickets(1);
        // A roll that lands on Common (the seed is fixed, the test checks the tier first).
        for (var seed = 0; seed < 1000; seed++)
        {
            var copy = new StorageState { Items = new(storage.Items), Tickets = 1 };
            var probe = new Random(seed);
            if (ToyMachine.RarityFor(probe.Next(ToyMachine.TotalWeight)) != ToyRarity.Common) continue;
            var play = ToyMachine.Play(copy, new Random(seed));
            Assert.Equal(new ToyPrize(ToyRarity.Common, common[0]), play.Prize);
            return;
        }
        Assert.Fail("No seed rolled a common prize.");
    }

    [Fact]
    public void AnOlderStorageFileReadsWithNoTickets()
    {
        var storage = new StorageState { Tickets = -4, Mysteries = 5000, Spins = -1 }.Normalized();
        Assert.Equal(0, storage.Tickets);
        Assert.Equal(StorageState.MaxPerItem, storage.Mysteries);
        Assert.Equal(0, storage.Spins);
    }
}
