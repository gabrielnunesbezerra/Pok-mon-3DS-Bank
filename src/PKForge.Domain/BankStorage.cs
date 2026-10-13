namespace PKForge.Domain;

/// <summary>
/// The Bank's Storage (3DS Bank 2.0): items kept by national id, each with a count, the
/// Shooting Stars ready to use, and the progress of the star achievement. 2.1 adds the toy
/// machine's tickets (one per Pokémon released from the Bank) and its secret "???" prizes.
/// Saved as <see cref="FileName"/> in the Bank folder, so it travels with the account like
/// the Pokémon.
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

    /// <summary>The most toy machine tickets kept at once.</summary>
    public const int MaxTickets = 9999;

    /// <summary>Toy machine tickets ready to use.</summary>
    public int Tickets { get; set; }

    /// <summary>Tickets ever received (one per Pokémon released from the Bank).</summary>
    public int TicketsEarned { get; set; }

    /// <summary>Times the toy machine's handle was turned.</summary>
    public int Spins { get; set; }

    /// <summary>The secret prizes: "???", an item nobody can name or use.</summary>
    public int Mysteries { get; set; }

    /// <summary>Gives <paramref name="count"/> tickets (up to <see cref="MaxTickets"/>); returns how many fit.</summary>
    public int AddTickets(int count)
    {
        if (count <= 0) return 0;
        var added = Math.Min(count, MaxTickets - Tickets);
        if (added <= 0) return 0;
        Tickets += added;
        TicketsEarned += added;
        return added;
    }

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
        Tickets = Math.Clamp(Tickets, 0, MaxTickets);
        TicketsEarned = Math.Max(0, TicketsEarned);
        Spins = Math.Max(0, Spins);
        Mysteries = Math.Clamp(Mysteries, 0, MaxPerItem);
        return this;
    }
}
