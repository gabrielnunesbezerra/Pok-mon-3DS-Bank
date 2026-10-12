namespace PKForge.Domain;

/// <summary>
/// The IV rank as PKHeX shows it: one to four stars from the six IVs' total.
/// 0-90 one star, 91-120 two, 121-150 three, 151-186 four.
/// </summary>
public static class IvRank
{
    /// <summary>The star count for an IV total (Gen 3 onward, IVs 0-31).</summary>
    public static int Stars(int total) => total switch
    {
        <= 90 => 1,
        <= 120 => 2,
        <= 150 => 3,
        _ => 4,
    };

    public static int Stars(IReadOnlyList<int> ivs) => Stars(ivs.Sum());

    /// <summary>
    /// Orders Pokémon by IV total, highest (or lowest) first; ties keep their storage order,
    /// so the ranking reads like the boxes.
    /// </summary>
    public static IReadOnlyList<T> Order<T>(IEnumerable<(T Item, IReadOnlyList<int> Ivs)> pokemon, bool highestFirst = true)
    {
        var indexed = pokemon.Select((p, index) => (p.Item, Total: p.Ivs.Sum(), Index: index));
        var ordered = highestFirst
            ? indexed.OrderByDescending(p => p.Total).ThenBy(p => p.Index)
            : indexed.OrderBy(p => p.Total).ThenBy(p => p.Index);
        return ordered.Select(p => p.Item).ToList();
    }
}
