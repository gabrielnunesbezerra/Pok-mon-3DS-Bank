using PKForge.Domain;
using PKForge.Infrastructure;

namespace PKForge.App.Services;

/// <summary>Pokémon held out of the boxes for one trip (see <see cref="OutgoingLedger"/>).</summary>
public sealed record BankHold(string Id, IReadOnlyList<OutgoingMon> Mons);

/// <summary>
/// The one way out of the Bank (3DS Bank 2.5). <see cref="HoldAsync"/> takes the Pokémon out
/// of the boxes into the outgoing ledger and gets that online (<see cref="CloudBankSync.CommitAsync"/>)
/// before anything else happens; the caller then writes the game, the file or the server, and
/// ends the trip with <see cref="Deliver"/> (it arrived) or <see cref="Return"/> (it did not).
/// A trip cut short by a closed app stays in the ledger, where the admin can give it back.
/// </summary>
public sealed class BankExitService(ReloadableBankService bank, CloudBankSync sync)
{
    /// <summary>Holds the Pokémon for a trip to <paramref name="destination"/>; a refusal (no internet...) when it could not.</summary>
    public async Task<(BankHold? Hold, string? Refusal)> HoldAsync(IReadOnlyList<Guid> ids, string destination, CancellationToken cancellationToken = default)
    {
        if (ids.Count == 0) return (null, "Nothing to send.");
        var id = Guid.NewGuid().ToString("N");
        BankHold? hold;
        try
        {
            hold = bank.Change((store, root) =>
            {
                var wanted = ids.ToHashSet();
                var entries = store.GetAll().Where(entry => wanted.Contains(entry.Id)).ToList();
                if (entries.Count != wanted.Count) return null;
                var mons = entries.Select(entry => new OutgoingMon(Convert.ToBase64String(store.GetData(entry.Id)), entry.Info, entry.Box, entry.Slot)).ToList();
                var ledger = BankSideFiles.Load<OutgoingLedger>(root, OutgoingLedger.FileName);
                // The ledger first: a Pokémon is never out of the boxes without a record of it.
                ledger.Batches[id] = new OutgoingBatch(destination, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), mons);
                BankSideFiles.Save(root, OutgoingLedger.FileName, ledger);
                try
                {
                    store.RemoveMany(ids);
                }
                catch
                {
                    ledger.Batches.Remove(id);
                    BankSideFiles.Save(root, OutgoingLedger.FileName, ledger);
                    throw;
                }
                return new BankHold(id, mons);
            });
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or InvalidOperationException)
        {
            return (null, $"The Bank could not be changed: {error.Message}");
        }
        if (hold is null) return (null, "Those Pokémon are no longer in the Bank.");
        var refusal = await sync.CommitAsync(cancellationToken);
        if (refusal is null) return (hold, null);
        Return(hold);
        return (null, refusal);
    }

    /// <summary>The trip ended well: the Pokémon is where it went, and the ledger forgets it.</summary>
    public void Deliver(BankHold hold)
    {
        try
        {
            bank.Change((_, root) =>
            {
                var ledger = BankSideFiles.Load<OutgoingLedger>(root, OutgoingLedger.FileName);
                if (ledger.Batches.Remove(hold.Id)) BankSideFiles.Save(root, OutgoingLedger.FileName, ledger);
                return 0;
            });
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            AppLog.Warn("exit", $"Closing trip {hold.Id}: {error.Message}");
        }
    }

    /// <summary>The trip did not happen: the Pokémon go back to their slots (or the first free ones). False when they were back already.</summary>
    public bool Return(BankHold hold)
    {
        try
        {
            return bank.Change((store, root) => ReturnBatch(store, root, hold.Id));
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or InvalidOperationException)
        {
            AppLog.Warn("exit", $"Giving back trip {hold.Id}: {error.Message}");
            return false;
        }
    }

    /// <summary>Puts one held trip back in the boxes of <paramref name="store"/> (also used by the admin on another player's Bank).</summary>
    public static bool ReturnBatch(IBankService store, string root, string holdId)
    {
        var ledger = BankSideFiles.Load<OutgoingLedger>(root, OutgoingLedger.FileName);
        if (!ledger.Batches.Remove(holdId, out var batch)) return false;
        var taken = store.GetAll().Select(entry => (entry.Box, entry.Slot)).ToHashSet();
        var deposits = batch.Mons.Select(mon => taken.Add((mon.Box, mon.Slot))
            ? new BankDeposit(mon.Bytes, mon.Info, mon.Box, mon.Slot)
            : new BankDeposit(mon.Bytes, mon.Info)).ToList();
        // The ledger first: a trip given back is never given back twice.
        BankSideFiles.Save(root, OutgoingLedger.FileName, ledger);
        try
        {
            store.AddMany(deposits);
        }
        catch
        {
            ledger.Batches[holdId] = batch;
            BankSideFiles.Save(root, OutgoingLedger.FileName, ledger);
            throw;
        }
        return true;
    }
}
