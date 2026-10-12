namespace PKForge.Domain;

/// <summary>The national dex split by the generation that introduced each species.</summary>
public static class DexRegions
{
    /// <summary>One generation: its roman numeral, its region and its national dex range.</summary>
    public sealed record Region(int Generation, string Roman, string Name, int First, int Last);

    public static IReadOnlyList<Region> All { get; } =
    [
        new(1, "I", "Kanto", 1, 151),
        new(2, "II", "Johto", 152, 251),
        new(3, "III", "Hoenn", 252, 386),
        new(4, "IV", "Sinnoh", 387, 493),
        new(5, "V", "Unova", 494, 649),
        new(6, "VI", "Kalos", 650, 721),
        new(7, "VII", "Alola", 722, 809),
        new(8, "VIII", "Galar", 810, 905),
        new(9, "IX", "Paldea", 906, 1025),
    ];

    /// <summary>The region a national dex number belongs to, or null past the last one.</summary>
    public static Region? Of(int species) => All.FirstOrDefault(r => species >= r.First && species <= r.Last);
}
