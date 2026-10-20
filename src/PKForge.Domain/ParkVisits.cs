using System.Text.Json.Serialization;

namespace PKForge.Domain;

/// <summary>
/// 3DS Bank 2.5: the Poképark belongs to the admin. A player sends a Bank Pokémon there (it
/// leaves their Bank), the admin takes it in, it lives in the admin's Poképark for a while and
/// the admin sends it back with what it gained; the owner's app takes it into their Bank. The
/// visit lives online at parkVisits/&lt;owner&gt;/&lt;id&gt; and moves one way:
/// <see cref="Sent"/> → <see cref="Caring"/> → <see cref="Returned"/>, then the owner removes it.
/// </summary>
public static class ParkVisitState
{
    /// <summary>On its way: the owner sent it and the admin has not taken it in yet.</summary>
    public const string Sent = "sent";

    /// <summary>In the admin's Poképark (the Pokémon is in the admin's Bank meanwhile).</summary>
    public const string Caring = "caring";

    /// <summary>Back on its way home; the owner's app takes it in.</summary>
    public const string Returned = "returned";
}

/// <summary>One Pokémon's stay at the admin's Poképark.</summary>
/// <param name="Data">The Pokémon's bytes, base64 (the sent ones, then the returned ones).</param>
/// <param name="Note">The admin's words when it comes back.</param>
public sealed record ParkVisit(
    string Id,
    string OwnerUid,
    string OwnerName,
    string State,
    string Data,
    string Format,
    int Species,
    int Form,
    bool Shiny,
    string Nickname,
    int Level,
    int Generation,
    long SentUnixMs,
    long ReturnedUnixMs = 0,
    string Note = "")
{
    [JsonIgnore]
    public byte[] Bytes => Convert.FromBase64String(Data);

    /// <summary>The visit with a Pokémon's facts.</summary>
    public static ParkVisit From(string id, string ownerUid, string ownerName, byte[] data, BankEntryInfo info, long sentUnixMs) =>
        new(id, ownerUid, ownerName, ParkVisitState.Sent, Convert.ToBase64String(data), info.Format ?? "", info.Species, info.Form, info.Shiny,
            info.Nickname, info.Level, info.Generation, sentUnixMs);
}

/// <summary>
/// The owner's side (parkvisits.json in their Bank folder, so it travels with the account):
/// the visits whose Pokémon already came back into this Bank. A returned visit is taken in
/// once, even when the app closes between taking it in and crossing it off online.
/// </summary>
public sealed class ParkVisitLedger
{
    public const string FileName = "parkvisits.json";

    public const int Kept = 300;

    public List<string> Collected { get; set; } = [];

    public void MarkCollected(string visitId)
    {
        if (Collected.Contains(visitId)) return;
        Collected.Add(visitId);
        if (Collected.Count > Kept) Collected.RemoveRange(0, Collected.Count - Kept);
    }
}

/// <summary>The admin's side (parkguests.json in the admin's Bank folder): which Bank entry is which visitor.</summary>
public sealed class ParkGuestBook
{
    public const string FileName = "parkguests.json";

    /// <summary>Visit id → the guest staying in the admin's Bank.</summary>
    public Dictionary<string, ParkGuest> Guests { get; set; } = [];

    /// <summary>The visit a Bank entry belongs to, or null when the entry is the admin's own.</summary>
    public string? VisitOf(Guid entryId) => Guests.FirstOrDefault(pair => pair.Value.EntryId == entryId).Key;
}

/// <summary>A visitor in the admin's Bank: its entry there and whose it is.</summary>
public sealed record ParkGuest(Guid EntryId, string OwnerUid, string OwnerName, long ArrivedUnixMs);
