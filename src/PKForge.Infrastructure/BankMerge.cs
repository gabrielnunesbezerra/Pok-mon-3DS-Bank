using PKForge.Domain;

namespace PKForge.Infrastructure;

/// <summary>
/// 3DS Bank 2.5: what a phone keeps when its account's Bank changed online meanwhile (another
/// phone, the admin). <paramref name="bank"/> already holds the online Bank; on top of it go
/// only this phone's own changes since the last sync, by entry id: the Pokémon it added come
/// along and the ones it let go stay gone. Everything else is the online copy, so a Pokémon
/// taken out elsewhere never comes back from a phone that still had it.
/// </summary>
public static class BankMerge
{
    /// <param name="local">This phone's Bank before the online one replaced it (entries with their bytes).</param>
    /// <param name="synced">The entry ids the account held at this phone's last sync.</param>
    public static (int Added, int LetGo) Apply(IBankService bank, IReadOnlyList<(BankEntry Entry, byte[] Data)> local, IReadOnlySet<Guid> synced)
    {
        ArgumentNullException.ThrowIfNull(bank);
        ArgumentNullException.ThrowIfNull(local);
        ArgumentNullException.ThrowIfNull(synced);
        var localIds = local.Select(mon => mon.Entry.Id).ToHashSet();
        var letGo = synced.Where(id => !localIds.Contains(id)).ToHashSet();
        var gone = bank.GetAll().Where(entry => letGo.Contains(entry.Id)).Select(entry => entry.Id).ToList();
        if (gone.Count > 0) bank.RemoveMany(gone);
        var known = new HashSet<string>(bank.GetAll().Select(entry => BankCheckout.Sha256Hex(bank.GetData(entry.Id))), StringComparer.Ordinal);
        var taken = bank.GetAll().Select(entry => (entry.Box, entry.Slot)).ToHashSet();
        var deposits = local
            .Where(mon => !synced.Contains(mon.Entry.Id) && known.Add(BankCheckout.Sha256Hex(mon.Data)))
            .Select(mon => taken.Add((mon.Entry.Box, mon.Entry.Slot))
                ? new BankDeposit(mon.Data, mon.Entry.Info, mon.Entry.Box, mon.Entry.Slot)
                : new BankDeposit(mon.Data, mon.Entry.Info))
            .ToList();
        if (deposits.Count > 0) bank.AddMany(deposits);
        return (deposits.Count, gone.Count);
    }

    /// <summary>The records of Pokémon in flight on this phone (read before the online Bank replaces the folder).</summary>
    public sealed record Ledgers(OutgoingLedger Outgoing, TradeLedger Trades, ParkVisitLedger Visits, ParkGuestBook Guests, IReadOnlyList<string> Outbox);

    public static Ledgers ReadLedgers(string root) => new(
        BankSideFiles.Load<OutgoingLedger>(root, OutgoingLedger.FileName),
        BankSideFiles.Load<TradeLedger>(root, TradeLedger.FileName),
        BankSideFiles.Load<ParkVisitLedger>(root, ParkVisitLedger.FileName),
        BankSideFiles.Load<ParkGuestBook>(root, ParkGuestBook.FileName),
        BankSideFiles.Load<List<string>>(root, BankOutbox.FileName));

    /// <summary>
    /// Puts this phone's in-flight records back on top of the online ones, keeping both sides:
    /// a Pokémon on its way out, held for a trade or at the Poképark is never forgotten by a
    /// merge, and a trade or a visit already taken in is never taken in twice.
    /// </summary>
    public static void MergeLedgers(string root, Ledgers local)
    {
        ArgumentNullException.ThrowIfNull(local);
        var outgoing = BankSideFiles.Load<OutgoingLedger>(root, OutgoingLedger.FileName);
        foreach (var (id, batch) in local.Outgoing.Batches) outgoing.Batches.TryAdd(id, batch);
        BankSideFiles.Save(root, OutgoingLedger.FileName, outgoing);

        var trades = BankSideFiles.Load<TradeLedger>(root, TradeLedger.FileName);
        foreach (var (id, escrow) in local.Trades.Escrow)
            if (!trades.Applied.Contains(id)) trades.Escrow.TryAdd(id, escrow);
        foreach (var id in local.Trades.Applied)
        {
            trades.MarkApplied(id);
            trades.Escrow.Remove(id);
        }
        BankSideFiles.Save(root, TradeLedger.FileName, trades);

        var visits = BankSideFiles.Load<ParkVisitLedger>(root, ParkVisitLedger.FileName);
        foreach (var id in local.Visits.Collected) visits.MarkCollected(id);
        BankSideFiles.Save(root, ParkVisitLedger.FileName, visits);

        var guests = BankSideFiles.Load<ParkGuestBook>(root, ParkGuestBook.FileName);
        foreach (var (id, guest) in local.Guests.Guests) guests.Guests.TryAdd(id, guest);
        BankSideFiles.Save(root, ParkGuestBook.FileName, guests);

        if (local.Outbox.Count > 0) new BankOutbox(root).AddRange(local.Outbox);
    }
}
