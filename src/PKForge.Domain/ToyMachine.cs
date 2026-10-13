namespace PKForge.Domain;

/// <summary>The toy machine's prize tiers, from the silliest to the secret one.</summary>
public enum ToyRarity { Common, Rare, Epic, Legendary, Secret }

/// <summary>One prize: an item by national id, or the secret "???" (<see cref="Item"/> 0).</summary>
public sealed record ToyPrize(ToyRarity Rarity, int Item)
{
    public bool IsMystery => Rarity == ToyRarity.Secret;
}

/// <summary>A turn of the handle: the prize, or why the machine did not turn (the ticket is kept).</summary>
public sealed record ToyPlay(ToyPrize? Prize, string? Refusal);

/// <summary>
/// 3DS Bank 2.1's toy machine: a ticket (one per Pokémon released from the Bank) turns the
/// handle once and a capsule drops out. The tier is drawn first by its weight out of
/// <see cref="TotalWeight"/>, then one item of that tier, all equally likely, so every item's
/// chance is its tier's chance divided by the size of the tier. Prizes go to the Storage; the
/// secret one is only "???", which nobody can name or use.
/// </summary>
public static class ToyMachine
{
    /// <summary>The weights add up to this.</summary>
    public const int TotalWeight = 1000;

    /// <summary>How the tiers are drawn: 60 %, 25 %, 10 %, 4 % and 1 %.</summary>
    public static readonly IReadOnlyList<(ToyRarity Rarity, int Weight)> Odds =
    [
        (ToyRarity.Common, 600),
        (ToyRarity.Rare, 250),
        (ToyRarity.Epic, 100),
        (ToyRarity.Legendary, 40),
        (ToyRarity.Secret, 10),
    ];

    // National item ids (they exist from Generation 2 to 7 and travel to the games' bags).
    private static readonly int[] Common =
    [
        30, 31, 32, 33,      // Fresh Water, Soda Pop, Lemonade, Moomoo Milk
        17, 18, 43, 42,      // Potion, Antidote, Berry Juice, Lava Cookie
        155, 151, 94, 86,    // Oran Berry, Pecha Berry, Honey, Tiny Mushroom
        63, 64, 571,         // Poké Doll, Fluffy Tail, Pretty Feather
        78, 79, 4,           // Escape Rope, Repel, Poké Ball
    ];

    private static readonly int[] Rare =
    [
        26, 25, 28, 77,      // Super Potion, Hyper Potion, Revive, Max Repel
        3, 2,                // Great Ball, Ultra Ball
        87, 88, 90, 93,      // Big Mushroom, Pearl, Stardust, Heart Scale
        158, 157,            // Sitrus Berry, Lum Berry
        82, 84, 83, 85, 81,  // Fire, Water, Thunder, Leaf and Moon Stone
        229,                 // Everstone
    ];

    private static readonly int[] Epic =
    [
        50, 51, 29,          // Rare Candy, PP Up, Max Revive
        92, 89, 91, 795,     // Nugget, Big Pearl, Star Piece, Bottle Cap
        234, 231, 218, 216,  // Leftovers, Lucky Egg, Soothe Bell, Exp. Share
        221, 233, 235, 252,  // King's Rock, Metal Coat, Dragon Scale, Up-Grade
        107, 108, 109, 80,   // Shiny, Dusk, Dawn and Sun Stone
    ];

    private static readonly int[] Legendary =
    [
        1, 796, 645, 53,     // Master Ball, Gold Bottle Cap, Ability Capsule, PP Max
        583, 581,            // Comet Shard, Big Nugget
        270, 287, 220, 297,  // Life Orb, Choice Scarf, Choice Band, Choice Specs
        275, 640, 236,       // Focus Sash, Assault Vest, Light Ball
    ];

    private static readonly int[] Secret = [0];

    /// <summary>The items of a tier, in the order the prize list shows them (0 is "???").</summary>
    public static IReadOnlyList<int> Pool(ToyRarity rarity) => rarity switch
    {
        ToyRarity.Common => Common,
        ToyRarity.Rare => Rare,
        ToyRarity.Epic => Epic,
        ToyRarity.Legendary => Legendary,
        _ => Secret,
    };

    /// <summary>The weight of a tier out of <see cref="TotalWeight"/>.</summary>
    public static int WeightOf(ToyRarity rarity) => Odds.First(odd => odd.Rarity == rarity).Weight;

    /// <summary>The chance of a tier, from 0 to 1.</summary>
    public static double ChanceOf(ToyRarity rarity) => WeightOf(rarity) / (double)TotalWeight;

    /// <summary>The chance of one item of a tier, from 0 to 1.</summary>
    public static double ChanceOfEach(ToyRarity rarity) => ChanceOf(rarity) / Pool(rarity).Count;

    /// <summary>A chance as a percentage for the screen: "60%", "3.33%", "0.308%" (in <paramref name="culture"/>'s digits).</summary>
    public static string Percent(double chance, IFormatProvider? culture = null)
    {
        culture ??= System.Globalization.CultureInfo.InvariantCulture;
        var percent = chance * 100;
        var format = percent >= 10 ? "0.#" : percent >= 1 ? "0.##" : "0.###";
        return percent.ToString(format, culture) + "%";
    }

    /// <summary>Draws a tier by weight: <paramref name="roll"/> is a number from 0 to <see cref="TotalWeight"/> - 1.</summary>
    public static ToyRarity RarityFor(int roll)
    {
        if (roll < 0 || roll >= TotalWeight) throw new ArgumentOutOfRangeException(nameof(roll));
        foreach (var (rarity, weight) in Odds)
        {
            if (roll < weight) return rarity;
            roll -= weight;
        }
        return ToyRarity.Secret;
    }

    /// <summary>
    /// Turns the handle with one of the Storage's tickets: the prize goes into the Storage.
    /// When there is no ticket, or the Storage already keeps 999 of every item of the drawn
    /// tier, nothing changes and the refusal says why.
    /// </summary>
    public static ToyPlay Play(StorageState storage, Random random)
    {
        ArgumentNullException.ThrowIfNull(storage);
        ArgumentNullException.ThrowIfNull(random);
        if (storage.Tickets <= 0)
            return new ToyPlay(null, "You have no tickets. Release a Pokémon from the Bank to get one.");
        var rarity = RarityFor(random.Next(TotalWeight));
        ToyPrize? prize = null;
        if (rarity == ToyRarity.Secret)
        {
            if (storage.Mysteries < StorageState.MaxPerItem)
            {
                storage.Mysteries++;
                prize = new ToyPrize(rarity, 0);
            }
        }
        else
        {
            // Start at a random item of the tier; one the Storage is full of passes to the next.
            var pool = Pool(rarity);
            var first = random.Next(pool.Count);
            for (var i = 0; i < pool.Count && prize is null; i++)
            {
                var item = pool[(first + i) % pool.Count];
                if (storage.Add(item, 1) == 1) prize = new ToyPrize(rarity, item);
            }
        }
        if (prize is null)
            return new ToyPlay(null, "Your Storage is full of every prize that came out (999 each). The ticket was kept.");
        storage.Tickets--;
        storage.Spins++;
        return new ToyPlay(prize, null);
    }
}
