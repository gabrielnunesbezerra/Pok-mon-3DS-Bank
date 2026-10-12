using PKForge.Domain;
using PKForge.Engine;
using PKForge.Infrastructure;

namespace PKForge.App.Services;

/// <summary>What the resident journal shows about caring for a resident.</summary>
/// <param name="CanCare">True for Bank residents that can gain friendship here.</param>
/// <param name="Wish">"snack" or "play": what it wants right now.</param>
/// <param name="NatureReady">The once-only nature change is available now.</param>
/// <param name="Nature">Its nature id, or -1 when its game has none.</param>
public sealed record ParkCareInfo(bool CanCare, string Wish, string Summary, int Friendship, bool NatureReady, int Nature, string NatureLine);

/// <summary>
/// The Poképark's care: a Bank resident asks for a berry or a game; granting the wish raises
/// its friendship (once per wish), saved into the Pokémon so its game sees it. After three hours
/// in the park it may change its nature, once in its life. Save residents only visit: their
/// Pokémon live in a game, so the park never writes there.
/// </summary>
public sealed class PokeparkCareService(ReloadableBankService bank)
{
    private ParkCareStore Store => new(bank.Root);

    /// <summary>The bank entry behind a resident, or null for save residents.</summary>
    public static Guid? BankIdOf(ParkPokemon mon) =>
        mon.Id.StartsWith("bank:", StringComparison.Ordinal) && Guid.TryParseExact(mon.Id[5..], "N", out var id) ? id : null;

    /// <summary>Starts the three-hour clock for new Bank residents; forgets those that left.</summary>
    public void SyncResidents(IEnumerable<ParkPokemon> roster) =>
        Store.SyncResidents(roster.Where(p => BankIdOf(p) is not null).Select(p => p.Id), DateTimeOffset.UtcNow);

    public ParkCareInfo Describe(ParkPokemon mon)
    {
        var now = DateTimeOffset.UtcNow;
        if (Entry(mon) is not { } entry || ParkCareEngine.Read(bank.GetData(entry.Id), entry.Info.Format) is not { } facts
            || !facts.SupportsFriendship)
        {
            var why = BankIdOf(mon) is null
                ? "Only Pokémon that live in the Bank gain friendship here."
                : "This Pokémon cannot gain friendship here.";
            return new ParkCareInfo(false, "", why, 0, false, -1, "");
        }

        var wish = ParkCareRules.WishOf(mon.Id, ParkCareRules.WishWindow(now));
        var rewarded = Store.WasRewarded(mon.Id, ParkCareRules.WishWindow(now));
        var minutes = Math.Max(1, (int)Math.Ceiling((ParkCareRules.WishEnds(now) - now).TotalMinutes));
        var summary = rewarded
            ? $"Happy for now. It will want something new in {minutes} min."
            : wish == ParkWish.Snack ? "It is asking for a berry." : "It wants to play.";

        var joined = Store.JoinedOrNow(mon.Id, now);
        var wait = ParkCareRules.NatureWait(joined, now);
        string natureLine;
        var ready = false;
        if (!facts.SupportsNature) natureLine = "Its game has no natures.";
        else if (Store.NatureChanged(facts.IdentityKey)) natureLine = "It already changed its nature once.";
        else if (wait > TimeSpan.Zero) natureLine = $"It can change its nature after {Duration(wait)} more in the park.";
        else { natureLine = "It feels at home: it can change its nature once."; ready = true; }

        return new ParkCareInfo(true, ParkCareRules.ActionFor(wish), summary, facts.Friendship, ready, facts.Nature, natureLine);
    }

    /// <summary>Grants (or misses) the resident's wish; returns what happened, in words.</summary>
    public string Care(ParkPokemon mon, string action)
    {
        var now = DateTimeOffset.UtcNow;
        if (Entry(mon) is not { } entry)
            return BankIdOf(mon) is null ? "" : $"{mon.Name} is no longer in the Bank.";
        var window = ParkCareRules.WishWindow(now);
        if (Store.WasRewarded(mon.Id, window))
            return $"{mon.Name} already got what it wanted. Come back when it asks for something new.";
        var wish = ParkCareRules.ActionFor(ParkCareRules.WishOf(mon.Id, window));
        if (!string.Equals(action, wish, StringComparison.Ordinal))
            return wish == "snack" ? $"{mon.Name} wanted a berry, not a game." : $"{mon.Name} wanted to play, not to eat.";

        var data = bank.GetData(entry.Id);
        var updated = ParkCareEngine.AddFriendship(data, entry.Info.Format, ParkCareRules.FriendshipPerCare, out var friendship);
        if (updated is null) return $"{mon.Name} cannot gain friendship here.";
        using (ThreeDsBankPolicy.AllowParkCare())
            bank.Replace(entry.Id, updated, entry.Info);
        Store.MarkRewarded(mon.Id, window);
        return friendship >= ParkCareRules.MaxFriendship
            ? $"{mon.Name} adores you! Friendship is at its maximum."
            : $"{mon.Name} loved it! Friendship +{ParkCareRules.FriendshipPerCare} ({friendship}/255).";
    }

    /// <summary>The once-only nature change; returns what happened, in words.</summary>
    public string ChangeNature(ParkPokemon mon, int nature)
    {
        var now = DateTimeOffset.UtcNow;
        if (Entry(mon) is not { } entry) return $"{mon.Name} is no longer in the Bank.";
        var data = bank.GetData(entry.Id);
        if (ParkCareEngine.Read(data, entry.Info.Format) is not { SupportsNature: true } facts)
            return "Its game has no natures.";
        if (Store.NatureChanged(facts.IdentityKey)) return $"{mon.Name} already changed its nature once.";
        if (ParkCareRules.NatureWait(Store.JoinedOrNow(mon.Id, now), now) > TimeSpan.Zero)
            return $"{mon.Name} needs more time in the park first.";
        var updated = ParkCareEngine.ChangeNature(data, entry.Info.Format, nature, out var refusal);
        if (updated is null) return refusal ?? "Its nature could not change.";
        using (ThreeDsBankPolicy.AllowParkCare())
            bank.Replace(entry.Id, updated, entry.Info);
        Store.MarkNatureChanged(facts.IdentityKey);
        return $"{mon.Name} has a new nature!";
    }

    private BankEntry? Entry(ParkPokemon mon) =>
        BankIdOf(mon) is { } id ? bank.GetAll().FirstOrDefault(e => e.Id == id) : null;

    private static string Duration(TimeSpan time) =>
        time.TotalHours >= 1 ? $"{(int)time.TotalHours} h {time.Minutes:00} min" : $"{Math.Max(1, (int)Math.Ceiling(time.TotalMinutes))} min";
}
