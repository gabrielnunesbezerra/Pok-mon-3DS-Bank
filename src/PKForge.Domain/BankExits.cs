using System.Text.Json.Serialization;

namespace PKForge.Domain;

/// <summary>
/// 3DS Bank 2.5: Pokémon on their way out of the Bank (to a game, to a .pk file, to the
/// admin's Poképark), kept beside the index as <see cref="FileName"/>. A Pokémon is written
/// here and leaves the boxes in one step, and that state goes online before it arrives
/// anywhere else; once it arrived the record is dropped, and if it could not arrive it goes
/// back to the boxes. So at every moment the Pokémon is in exactly one place: the Bank, this
/// ledger (which travels with the account) or its destination.
/// </summary>
public sealed class OutgoingLedger
{
    public const string FileName = "outgoing.json";

    /// <summary>Hold id → the Pokémon held for one trip.</summary>
    public Dictionary<string, OutgoingBatch> Batches { get; set; } = [];
}

/// <summary>One trip out of the Bank: where to, when it started, and the Pokémon.</summary>
public sealed record OutgoingBatch(string Destination, long CreatedUnixMs, List<OutgoingMon> Mons);

/// <summary>A Pokémon held for a trip: its bytes (base64), its Bank facts and the slot it left.</summary>
public sealed record OutgoingMon(string Data, BankEntryInfo Info, int Box, int Slot)
{
    [JsonIgnore]
    public byte[] Bytes => Convert.FromBase64String(Data);
}
