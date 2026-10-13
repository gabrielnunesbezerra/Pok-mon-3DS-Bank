using PKForge.Domain;
using PKForge.Engine;
using PKForge.Infrastructure;

namespace PKForge.App.Services;

/// <summary>What the resident journal shows about caring for a resident.</summary>
/// <param name="CanCare">True for Bank residents that can gain friendship here.</param>
/// <param name="Wish">Unused since 2.2 (the garden's pot replaced the wishes); always empty.</param>
/// <param name="NatureReady">The once-only nature change is available now.</param>
/// <param name="Nature">Its nature id, or -1 when its game has none.</param>
public sealed record ParkCareInfo(bool CanCare, string Wish, string Summary, int Friendship, bool NatureReady, int Nature, string NatureLine);

/// <summary>
/// The Poképark's care: a Bank resident's friendship (it grows with the berries it eats from its
/// habitat's pot, see <see cref="ParkGardenService"/>) and, after three hours in the park, its
/// once-in-a-life nature change. Save residents only visit: their Pokémon live in a game, so
/// the park never writes there.
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

    /// <summary>
    /// The friendship of every Bank resident that keeps one, by resident id, read in one pass for
    /// the park's side panel. Save residents and games without friendship are left out.
    /// </summary>
    public IReadOnlyDictionary<string, int> Friendships(IEnumerable<ParkPokemon> residents)
    {
        var result = new Dictionary<string, int>();
        var wanted = residents.Where(mon => BankIdOf(mon) is not null).ToList();
        if (wanted.Count == 0) return result;
        var entries = bank.GetAll().GroupBy(entry => entry.Id).ToDictionary(group => group.Key, group => group.First());
        foreach (var mon in wanted)
        {
            if (!entries.TryGetValue(BankIdOf(mon)!.Value, out var entry)) continue;
            if (ParkCareEngine.Read(bank.GetData(entry.Id), entry.Info.Format) is { SupportsFriendship: true } facts)
                result[mon.Id] = facts.Friendship;
        }
        return result;
    }

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

        const string summary = "It eats the berries in its habitat's pot.";

        var joined = Store.JoinedOrNow(mon.Id, now);
        var wait = ParkCareRules.NatureWait(joined, now);
        string natureLine;
        var ready = false;
        if (!facts.SupportsNature) natureLine = "Its game has no natures.";
        else if (Store.NatureChanged(facts.IdentityKey)) natureLine = "It already changed its nature once.";
        else if (wait > TimeSpan.Zero) natureLine = $"It can change its nature after {Duration(wait)} more in the park.";
        else { natureLine = "It feels at home: it can change its nature once."; ready = true; }

        return new ParkCareInfo(true, "", summary, facts.Friendship, ready, facts.Nature, natureLine);
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
