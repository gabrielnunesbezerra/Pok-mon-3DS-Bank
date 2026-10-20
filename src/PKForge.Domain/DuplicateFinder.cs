namespace PKForge.Domain;

/// <summary>One Pokémon in someone's Bank, as the duplicate search sees it.</summary>
public sealed record BankHolding(string OwnerUid, string OwnerName, Guid EntryId, string Strict, string Loose, BankEntryInfo Info);

/// <summary>Copies of one Pokémon: <see cref="Exact"/> when they are the same Pokémon byte for byte in what matters.</summary>
public sealed record DuplicateGroup(string Key, bool Exact, IReadOnlyList<BankHolding> Copies)
{
    public BankEntryInfo Info => Copies[0].Info;

    /// <summary>The players who hold a copy, with how many each.</summary>
    public IReadOnlyList<(string OwnerName, int Count)> Holders =>
        Copies.GroupBy(copy => copy.OwnerName).Select(group => (group.Key, group.Count())).OrderByDescending(h => h.Item2).ToList();
}

/// <summary>
/// 3DS Bank 2.5's duplicate search for the admin: groups the Pokémon of one Bank or of every Bank
/// by who they are (see the engine's BankIdentity). Exact groups are copies for sure; the
/// others share trainer, IVs and gender, which a copy changed later still does.
/// </summary>
public static class DuplicateFinder
{
    public static IReadOnlyList<DuplicateGroup> Find(IEnumerable<BankHolding> holdings)
    {
        ArgumentNullException.ThrowIfNull(holdings);
        var all = holdings.ToList();
        var groups = new List<DuplicateGroup>();
        var inExact = new HashSet<Guid>();
        foreach (var group in all.GroupBy(h => h.Strict).Where(g => g.Count() > 1))
        {
            groups.Add(new DuplicateGroup(group.Key, true, group.ToList()));
            foreach (var copy in group) inExact.Add(copy.EntryId);
        }
        foreach (var group in all.GroupBy(h => h.Loose).Where(g => g.Count() > 1))
        {
            // Already shown as exact copies: a loose group only adds the ones that changed.
            if (group.All(copy => inExact.Contains(copy.EntryId)) && group.Select(copy => copy.Strict).Distinct().Count() == 1) continue;
            groups.Add(new DuplicateGroup(group.Key, false, group.ToList()));
        }
        return groups.OrderByDescending(g => g.Exact).ThenByDescending(g => g.Info.Shiny).ThenByDescending(g => g.Copies.Count).ToList();
    }

    /// <summary>
    /// What to remove from one player's Bank so each exact group keeps a single copy there (the one
    /// that came in first stays, by the order given).
    /// </summary>
    public static IReadOnlyList<Guid> ExtraCopies(IReadOnlyList<DuplicateGroup> groups, string ownerUid)
    {
        ArgumentNullException.ThrowIfNull(groups);
        return groups.Where(g => g.Exact)
            .SelectMany(g => g.Copies.Where(c => c.OwnerUid == ownerUid).Skip(1))
            .Select(c => c.EntryId)
            .Distinct()
            .ToList();
    }
}
