using System.Security.Cryptography;
using System.Text;

namespace PKForge.Domain;

/// <summary>
/// One Pokémon put up in an online trade: its stored bytes (base64) and format, plus what the
/// other player sees before accepting (sprite, name, level, item).
/// </summary>
public sealed record TradeOffer(
    string Data, string? Format, int Species, int Form, bool Shiny, string Nickname, int Level, int HeldItem, int Generation);

/// <summary>
/// An online trade between two friends as the server holds it. <see cref="State"/> is
/// <see cref="Open"/> while they choose, <see cref="Committed"/> once both confirmed (the trade
/// will happen), or <see cref="Cancelled"/>. Each player only ever writes their own offer,
/// confirmation and "done" mark; the state moves once, by compare-and-set. A confirmation
/// records the fingerprint of the other player's offer it said yes to
/// (<see cref="TradeRules.Fingerprint"/>), so a trade is only sealed for the Pokémon both saw.
/// </summary>
public sealed record TradeRecord(
    string Id,
    string A,
    string B,
    IReadOnlyDictionary<string, string> Names,
    string State,
    long CreatedUnixMs,
    IReadOnlyDictionary<string, TradeOffer> Offers,
    IReadOnlyDictionary<string, string> Confirmations,
    IReadOnlySet<string> Done)
{
    /// <summary>Whether <paramref name="uid"/> said yes.</summary>
    public bool HasConfirmed(string uid) => Confirmations.ContainsKey(uid);

    public const string Open = "open";
    public const string Committed = "committed";
    public const string Cancelled = "cancelled";

    /// <summary>Whether <paramref name="uid"/> is one of the two players.</summary>
    public bool Includes(string uid) => uid == A || uid == B;

    /// <summary>The other player.</summary>
    public string PartnerOf(string me) => me == A ? B : A;

    /// <summary>A player's name as the trade recorded it.</summary>
    public string NameOf(string uid) => Names.TryGetValue(uid, out var name) && name.Length > 0 ? name : "?";
}

/// <summary>Where a trade stands for one of its players.</summary>
public enum TradeStage
{
    /// <summary>Nobody confirmed yet: both may still pick or change their Pokémon.</summary>
    Choosing,
    /// <summary>This player confirmed; waiting for the other one.</summary>
    WaitingForPartner,
    /// <summary>The other player confirmed; this one decides (confirm or cancel).</summary>
    PartnerConfirmed,
    /// <summary>Both confirmed: the trade is about to be sealed.</summary>
    Sealing,
    /// <summary>Both confirmed, but not the same Pokémon (one changed at the last moment): it can only be called off.</summary>
    Mismatch,
    /// <summary>Sealed: each side takes the other's Pokémon.</summary>
    Committed,
    /// <summary>Called off: each side keeps its own Pokémon.</summary>
    Cancelled,
}

/// <summary>What one player can do in a trade right now.</summary>
public sealed record TradeView(
    TradeStage Stage, TradeOffer? Mine, TradeOffer? Theirs, bool CanChoose, bool CanConfirm, bool CanCancel, bool Finished);

/// <summary>The online trade's rules, kept apart from the network so they can be checked.</summary>
public static class TradeRules
{
    /// <summary>A friend counts as online when the app said so within this many seconds.</summary>
    public const int OnlineSeconds = 90;

    /// <summary>An open trade nobody touched for this long may be called off by either player.</summary>
    public static readonly TimeSpan Stale = TimeSpan.FromMinutes(30);

    /// <summary>Whether a presence stamp (server milliseconds) is recent enough to count as online.</summary>
    public static bool IsOnline(long lastSeenMs, long serverNowMs) =>
        lastSeenMs > 0 && serverNowMs - lastSeenMs <= OnlineSeconds * 1000L;

    /// <summary>What <paramref name="me"/> sees and may do in <paramref name="trade"/>.</summary>
    public static TradeView View(TradeRecord trade, string me)
    {
        ArgumentNullException.ThrowIfNull(trade);
        var partner = trade.PartnerOf(me);
        var mine = trade.Offers.GetValueOrDefault(me);
        var theirs = trade.Offers.GetValueOrDefault(partner);
        var iConfirmed = trade.HasConfirmed(me);
        var theyConfirmed = trade.HasConfirmed(partner);

        if (trade.State == TradeRecord.Cancelled)
            return new TradeView(TradeStage.Cancelled, mine, theirs, false, false, false, true);
        if (trade.State == TradeRecord.Committed)
            return new TradeView(TradeStage.Committed, mine, theirs, false, false, false, trade.Done.Contains(me));

        var stage = (iConfirmed, theyConfirmed) switch
        {
            (true, true) => ReadyToSeal(trade) ? TradeStage.Sealing : TradeStage.Mismatch,
            (true, false) => TradeStage.WaitingForPartner,
            (false, true) => TradeStage.PartnerConfirmed,
            _ => TradeStage.Choosing,
        };
        // Once anyone confirmed, both offers are frozen: what was confirmed is what is traded.
        var canChoose = trade.Confirmations.Count == 0;
        var canConfirm = !iConfirmed && mine is not null && theirs is not null;
        return new TradeView(stage, mine, theirs, canChoose, canConfirm, stage != TradeStage.Sealing, false);
    }

    /// <summary>
    /// Whether both players confirmed an open trade, each for the Pokémon the other offers now,
    /// so it can be sealed.
    /// </summary>
    public static bool ReadyToSeal(TradeRecord trade) =>
        trade.State == TradeRecord.Open
        && trade.Offers.TryGetValue(trade.A, out var fromA) && trade.Offers.TryGetValue(trade.B, out var fromB)
        && trade.Confirmations.TryGetValue(trade.A, out var aSawB) && aSawB == Fingerprint(fromB)
        && trade.Confirmations.TryGetValue(trade.B, out var bSawA) && bSawA == Fingerprint(fromA);

    /// <summary>A short fingerprint of an offer, recorded with a confirmation.</summary>
    public static string Fingerprint(TradeOffer offer)
    {
        ArgumentNullException.ThrowIfNull(offer);
        return Convert.ToHexString(SHA256.HashData(Encoding.ASCII.GetBytes(offer.Data)))[..16].ToLowerInvariant();
    }
}

/// <summary>
/// This account's side of its online trades, kept as <see cref="FileName"/> in the Bank folder
/// (so it travels with the account): the Pokémon each confirmed trade holds aside until the
/// trade is sealed or called off, and the trades already applied, which are never applied twice.
/// </summary>
public sealed class TradeLedger
{
    public const string FileName = "trades.json";

    /// <summary>How many applied trade ids are remembered.</summary>
    public const int AppliedKept = 300;

    /// <summary>Trade id → the Pokémon put aside for it.</summary>
    public Dictionary<string, TradeEscrow> Escrow { get; set; } = [];

    /// <summary>Trades already applied to this Bank, newest last.</summary>
    public List<string> Applied { get; set; } = [];

    /// <summary>Records a trade as applied (and forgets the oldest ones past the limit).</summary>
    public void MarkApplied(string tradeId)
    {
        if (Applied.Contains(tradeId)) return;
        Applied.Add(tradeId);
        if (Applied.Count > AppliedKept) Applied.RemoveRange(0, Applied.Count - AppliedKept);
    }
}

/// <summary>A Pokémon held aside for a confirmed trade: its bytes, its Bank facts and the slot it left.</summary>
public sealed record TradeEscrow(
    string Data, BankEntryInfo Info, int Box, int Slot, string PartnerId, string PartnerName, long CreatedUnixMs);

/// <summary>A player's public profile, as friends see it.</summary>
public sealed record PlayerProfile(
    string Uid,
    string Username,
    string DisplayName,
    string Bio,
    int FavoriteSpecies,
    int FavoriteForm,
    bool FavoriteShiny,
    string FavoriteNickname,
    string FavoriteGame,
    int BankCount,
    int ShinyCount,
    int StarsEarned,
    long SinceUnixMs)
{
    public const int MaxDisplayName = 20;
    public const int MaxBio = 80;
    public const int MaxGame = 40;

    /// <summary>The name to show: the display name, else the username.</summary>
    public string Shown => DisplayName.Length > 0 ? DisplayName : Username;
}

/// <summary>A friend in the list: who, and when they were last seen in the app.</summary>
public sealed record FriendEntry(string Uid, string Username, long LastSeenMs, bool Online);

/// <summary>A friend request waiting for an answer.</summary>
public sealed record FriendRequest(string FromUid, string FromUsername, long SentUnixMs);

/// <summary>An invitation to trade, sent by a friend who is in the app right now.</summary>
public sealed record TradeInvite(string TradeId, string FromUid, string FromUsername, long CreatedUnixMs);
