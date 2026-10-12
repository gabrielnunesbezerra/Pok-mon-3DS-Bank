using PKForge.Domain;
using PKForge.Infrastructure;
using Xunit;

namespace PKForge.Domain.Tests;

/// <summary>The Poképark's care rules and the records that travel with the Bank.</summary>
public sealed class ParkCareTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "3dsbank-park", Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }

    [Fact]
    public void WishIsTheSameForTheWholeWindowAndChangesBetweenWindows()
    {
        var start = new DateTimeOffset(2026, 10, 12, 15, 0, 0, TimeSpan.Zero);
        var window = ParkCareRules.WishWindow(start);
        Assert.Equal(window, ParkCareRules.WishWindow(start.AddMinutes(29)));
        Assert.Equal(window + 1, ParkCareRules.WishWindow(start.AddMinutes(30)));
        Assert.Equal(start.AddMinutes(30), ParkCareRules.WishEnds(start.AddMinutes(10)));

        Assert.Equal(ParkCareRules.WishOf("bank:a", window), ParkCareRules.WishOf("bank:a", window));
        var wishes = Enumerable.Range(0, 64).Select(i => ParkCareRules.WishOf("bank:a", window + i)).ToHashSet();
        Assert.Equal(2, wishes.Count);
        Assert.Equal("snack", ParkCareRules.ActionFor(ParkWish.Snack));
        Assert.Equal("play", ParkCareRules.ActionFor(ParkWish.Play));
    }

    [Fact]
    public void NatureWaitsThreeHoursAndFriendshipCapsAt255()
    {
        var joined = new DateTimeOffset(2026, 10, 12, 12, 0, 0, TimeSpan.Zero);
        Assert.Equal(TimeSpan.FromHours(3), ParkCareRules.NatureWait(joined, joined));
        Assert.Equal(TimeSpan.FromMinutes(1), ParkCareRules.NatureWait(joined, joined.AddMinutes(179)));
        Assert.Equal(TimeSpan.Zero, ParkCareRules.NatureWait(joined, joined.AddHours(3)));
        Assert.Equal(TimeSpan.Zero, ParkCareRules.NatureWait(joined, joined.AddDays(2)));

        Assert.Equal(80, ParkCareRules.Befriend(70));
        Assert.Equal(255, ParkCareRules.Befriend(250));
        Assert.Equal(255, ParkCareRules.Befriend(255));
    }

    [Fact]
    public void StoreKeepsArrivalRewardsAndTheOnceOnlyNatureLedger()
    {
        var now = new DateTimeOffset(2026, 10, 12, 12, 0, 0, TimeSpan.Zero);
        var store = new ParkCareStore(_root);
        store.SyncResidents(["bank:a", "bank:b"], now);
        Assert.Equal(now, store.JoinedOrNow("bank:a", now.AddHours(1)));

        store.MarkRewarded("bank:a", 42);
        Assert.True(new ParkCareStore(_root).WasRewarded("bank:a", 42));
        Assert.False(store.WasRewarded("bank:a", 43));
        Assert.False(store.WasRewarded("bank:b", 42));

        // Leaving the park resets the clock and the reward...
        store.SyncResidents(["bank:b"], now.AddHours(2));
        Assert.False(store.WasRewarded("bank:a", 42));
        Assert.Equal(now.AddHours(5), store.JoinedOrNow("bank:a", now.AddHours(5)));

        // ...but the nature change is spent for good.
        store.MarkNatureChanged("identity");
        store.MarkNatureChanged("identity");
        Assert.True(new ParkCareStore(_root).NatureChanged("identity"));
        Assert.False(store.NatureChanged("other"));
    }

    [Fact]
    public void CareRecordsTravelWithTheBankSnapshot()
    {
        var store = new ParkCareStore(_root);
        store.MarkNatureChanged("identity");
        var snapshot = BankSnapshot.Pack(_root);

        var other = _root + "-restored";
        try
        {
            BankSnapshot.Restore(other, snapshot);
            Assert.True(new ParkCareStore(other).NatureChanged("identity"));
        }
        finally
        {
            if (Directory.Exists(other)) Directory.Delete(other, recursive: true);
        }
    }

    [Fact]
    public void ParkCareScopeOpensOnlyWhileAlive()
    {
        // The test projects run with editing unlocked; the scope must still nest and close cleanly.
        var before = ThreeDsBankPolicy.EditingLocked;
        using (ThreeDsBankPolicy.AllowParkCare())
        {
            Assert.False(ThreeDsBankPolicy.EditingLocked);
            var inner = ThreeDsBankPolicy.AllowParkCare();
            inner.Dispose();
            inner.Dispose();
            Assert.False(ThreeDsBankPolicy.EditingLocked);
        }
        Assert.Equal(before, ThreeDsBankPolicy.EditingLocked);
    }
}
