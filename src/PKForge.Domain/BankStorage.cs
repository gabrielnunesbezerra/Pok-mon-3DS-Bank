namespace PKForge.Domain;

/// <summary>
/// The Bank's Storage (3DS Bank 2.0): items kept by national id, each with a count, the
/// Shooting Stars ready to use, and the progress of the star achievement. Saved as
/// <see cref="FileName"/> in the Bank folder, so it travels with the account like the Pokémon.
/// </summary>
public sealed class StorageState
{
    /// <summary>The Storage's file in the Bank folder.</summary>
    public const string FileName = "storage.json";

    /// <summary>The most of one item the Storage keeps.</summary>
    public const int MaxPerItem = 999;

    /// <summary>Every this many Pokémon in the Bank at once completes the achievement once more.</summary>
    public const int PokemonPerStar = 60;

    /// <summary>National item id → how many are kept (never zero or negative).</summary>
    public Dictionary<int, int> Items { get; set; } = [];

    /// <summary>Shooting Stars ready to use.</summary>
    public int Stars { get; set; }

    /// <summary>How many times the achievement was completed (one star each).</summary>
    public int StarsEarned { get; set; }

    /// <summary>Shooting Stars already used on a Pokémon.</summary>
    public int StarsUsed { get; set; }

    /// <summary>The most Pokémon the Bank ever held at once: taking some out and putting them
    /// back never completes the achievement twice.</summary>
    public int MostPokemon { get; set; }

    /// <summary>How many of <paramref name="item"/> are kept.</summary>
    public int CountOf(int item) => Items.TryGetValue(item, out var count) ? count : 0;

    /// <summary>How many more of <paramref name="item"/> fit.</summary>
    public int RoomFor(int item) => item <= 0 ? 0 : MaxPerItem - CountOf(item);

    /// <summary>Keeps up to <paramref name="count"/> of an item; returns how many fit.</summary>
    public int Add(int item, int count)
    {
        if (item <= 0 || count <= 0) return 0;
        var added = Math.Min(count, RoomFor(item));
        if (added > 0) Items[item] = CountOf(item) + added;
        return added;
    }

    /// <summary>Takes <paramref name="count"/> of an item out; false (nothing taken) when there are fewer.</summary>
    public bool Take(int item, int count)
    {
        if (item <= 0 || count <= 0) return false;
        var have = CountOf(item);
        if (have < count) return false;
        if (have == count) Items.Remove(item);
        else Items[item] = have - count;
        return true;
    }

    /// <summary>The Bank count at which the next star is earned.</summary>
    public int NextStarAt => (StarsEarned + 1) * PokemonPerStar;

    /// <summary>
    /// Records that the Bank holds <paramref name="bankCount"/> Pokémon and gives a Shooting Star
    /// for every multiple of <see cref="PokemonPerStar"/> reached for the first time. Returns how
    /// many stars were just earned.
    /// </summary>
    public int AwardStars(int bankCount)
    {
        if (bankCount > MostPokemon) MostPokemon = bankCount;
        var due = MostPokemon / PokemonPerStar;
        var fresh = Math.Max(0, due - StarsEarned);
        StarsEarned += fresh;
        Stars += fresh;
        return fresh;
    }

    /// <summary>Uses one Shooting Star; false when there is none.</summary>
    public bool UseStar()
    {
        if (Stars <= 0) return false;
        Stars--;
        StarsUsed++;
        return true;
    }

    /// <summary>Drops empty or nonsense lines a hand-edited or older file might carry.</summary>
    public StorageState Normalized()
    {
        Items = Items.Where(pair => pair.Key > 0 && pair.Value > 0)
            .ToDictionary(pair => pair.Key, pair => Math.Min(pair.Value, MaxPerItem));
        Stars = Math.Max(0, Stars);
        StarsEarned = Math.Max(0, StarsEarned);
        StarsUsed = Math.Max(0, StarsUsed);
        MostPokemon = Math.Max(0, MostPokemon);
        return this;
    }
}
