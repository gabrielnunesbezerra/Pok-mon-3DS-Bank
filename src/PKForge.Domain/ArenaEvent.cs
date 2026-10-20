using System.Text.Json.Serialization;

namespace PKForge.Domain;

/// <summary>A Pokémon the admin put in the Arena event: the Champion's, or one the players fight with.</summary>
public sealed record ArenaMon(string Data, string Format, int Species, int Form, bool Shiny, string Nickname, int Level)
{
    [JsonIgnore]
    public byte[] Bytes => Convert.FromBase64String(Data);

    public static ArenaMon From(byte[] data, BankEntryInfo info) =>
        new(Convert.ToBase64String(data), info.Format ?? "", info.Species, info.Form, info.Shiny, info.Nickname, info.Level);
}

/// <summary>A prize of the event: items into the Storage and Shooting Stars.</summary>
/// <param name="Item">National item id (0 for none).</param>
public sealed record ArenaReward(string Name, int Item, int Count, int Stars = 0);

/// <summary>
/// 3DS Bank 2.5's Arena event, set up by the admin at arena/event: the Champion (a Pokémon
/// from the admin's Bank, played by the app), the Pokémon players may fight with, and the
/// prizes for beating the Champion. <see cref="ChampionAura"/> is the admin's secret: with it
/// on, the Champion always finds a way to win.
/// </summary>
public sealed record ArenaEvent(
    string Id,
    string Title,
    string Description,
    bool Active,
    long EndsUnixMs,
    string ChampionName,
    ArenaMon Champion,
    IReadOnlyList<ArenaMon> Loaners,
    IReadOnlyList<ArenaReward> Rewards,
    bool ChampionAura)
{
    /// <summary>The most Pokémon players can pick from.</summary>
    public const int MaxLoaners = 6;

    /// <summary>Whether players can fight right now.</summary>
    public bool IsOpen(long nowUnixMs) => Active && (EndsUnixMs <= 0 || nowUnixMs < EndsUnixMs);

    /// <summary>The prizes the admin can choose from, from good to legendary.</summary>
    public static IReadOnlyList<ArenaReward> RewardChoices { get; } =
    [
        new("Master Ball ×5", 1, 5),
        new("Shooting Star ×3 (any Pokémon shiny)", 0, 0, 3),
        new("Rare Candy ×50", 50, 50),
        new("Gold Bottle Cap ×5", 796, 5),
        new("Comet Shard ×10", 583, 10),
        new("Bottle Cap ×20", 795, 20),
        new("PP Max ×10", 53, 10),
        new("Leftovers", 234, 1),
        new("Choice Scarf", 287, 1),
        new("Life Orb", 270, 1),
        new("Ability Capsule ×5", 645, 5),
        new("Lucky Egg", 231, 1),
    ];
}

/// <summary>A player's record in an event (arena/results/&lt;event&gt;/&lt;uid&gt;).</summary>
/// <param name="BestDamage">The most of the Champion's HP taken in one battle, in percent.</param>
/// <param name="Claimed">Whether the prizes of a win went to the Storage already.</param>
public sealed record ArenaResult(string Uid, string Username, int Battles, int Wins, int BestDamage, long LastUnixMs, bool Claimed);
