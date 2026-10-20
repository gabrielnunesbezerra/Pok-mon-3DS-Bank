using PKForge.Domain;
using PKForge.Infrastructure;

namespace PKForge.App.Services;

/// <summary>
/// 3DS Bank 2.5: visits to the admin's Poképark. A player's Pokémon leaves their Bank (through
/// <see cref="BankExitService"/>, so the account knows first), goes online as a
/// <see cref="ParkVisit"/>, lives in the admin's Bank and Poképark while it is cared for, and
/// comes back into its owner's Bank with what it gained. Every step can be repeated after a
/// closed app or a lost connection without a Pokémon ending up in two places.
/// </summary>
public sealed class ParkVisitService(
    AccountService account, CloudEventsClient cloud, ReloadableBankService bank, BankExitService exits, CloudBankSync sync,
    PKForge.Domain.ISaveEngine engine, IServiceProvider services)
{
    /// <summary>How a trip to the Poképark is named in the outgoing ledger.</summary>
    public const string Destination = "the admin's Poképark";

    /// <summary>How a guest's trip home is named in the admin's outgoing ledger (followed by the visit and owner ids).</summary>
    private const string HomePrefix = "park-home:";

    /// <summary>Raised (off the UI thread) with a sentence when Pokémon came back from the Poképark.</summary>
    public event Action<string>? Returned;

    // ── The player ───────────────────────────────────────────────────────────

    /// <summary>Sends a Bank Pokémon to the admin's Poképark. Returns the sentence to show.</summary>
    public async Task<(bool Sent, string Message)> SendAsync(BankEntry entry, CancellationToken token = default)
    {
        if (!account.IsSignedIn) return (false, "Sign in to send Pokémon to the Poképark.");
        if (EntityBytes(entry) is { } why) return (false, why);
        CloudSession session;
        try { session = await account.GetFreshSessionAsync(token); }
        catch (CloudAccountException error) { return (false, error.Message); }
        var (hold, refusal) = await exits.HoldAsync([entry.Id], Destination, token);
        if (hold is null) return (false, refusal ?? "It could not leave the Bank.");
        var mon = hold.Mons[0];
        var visit = ParkVisit.From(hold.Id, session.UserId, session.Username, mon.Bytes, mon.Info, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        try
        {
            await cloud.SendVisitAsync(session, visit, token);
        }
        catch (CloudAccountException error)
        {
            // Only give it back when the visit surely did not arrive. When the server cannot even
            // be asked, it stays on its way and the trip ends once the internet is back.
            ParkVisit? there;
            try { there = await cloud.GetVisitAsync(session, session.UserId, hold.Id, token); }
            catch (CloudAccountException)
            {
                return (true, $"{entry.Info.Nickname} left your Bank and reaches the Poképark as soon as the internet is back.");
            }
            if (there is null)
            {
                exits.Return(hold);
                return (false, $"{entry.Info.Nickname} could not go: {error.Message} It is back in your Bank.");
            }
        }
        exits.Deliver(hold);
        return (true, $"{entry.Info.Nickname} is on its way to the Poképark! The admin takes care of it and sends it back to your Bank.");
    }

    private static string? EntityBytes(BankEntry entry) =>
        PKForge.Engine.EntityBytes.RomHackGame(entry.Info.Format) is { } hack
            ? $"Pokémon from {hack} live only in their own game, so they cannot visit the Poképark."
            : null;

    /// <summary>The player's Pokémon at the Poképark now.</summary>
    public async Task<IReadOnlyList<ParkVisit>> GetMineAsync(CancellationToken token = default) =>
        await cloud.GetMyVisitsAsync(await account.GetFreshSessionAsync(token), token);

    /// <summary>
    /// Finishes what a closed app left halfway and takes in the Pokémon the admin sent back.
    /// Runs when the app starts and every minute or so while it is open.
    /// </summary>
    public async Task<int> SettleAsync(CancellationToken token = default)
    {
        if (!account.IsSignedIn) return 0;
        var session = await account.GetFreshSessionAsync(token);
        await FinishTripsAsync(session, token);
        if (session.IsAdmin) return 0;

        var visits = await cloud.GetMyVisitsAsync(session, token);
        var collected = bank.Read((_, root) => BankSideFiles.Load<ParkVisitLedger>(root, ParkVisitLedger.FileName).Collected.ToHashSet());
        var names = new List<string>();
        foreach (var visit in visits.Where(v => v.State == ParkVisitState.Returned))
        {
            if (!collected.Contains(visit.Id))
            {
                if (!Collect(visit)) continue;
                names.Add(visit.Nickname);
            }
            // In the account first, then crossed off online: a wiped phone gets it again, once.
            if (await sync.CommitAsync(token) is not null) continue;
            await cloud.RemoveVisitAsync(session, session.UserId, visit.Id, token);
        }
        if (names.Count > 0)
            Returned?.Invoke(names.Count == 1
                ? $"{names[0]} came back from the Poképark and is in your Bank!"
                : $"{string.Join(", ", names)} came back from the Poképark and are in your Bank!");
        return names.Count;
    }

    private bool Collect(ParkVisit visit)
    {
        byte[] data;
        try { data = visit.Bytes; }
        catch (FormatException) { return false; }
        var info = engine.TryDescribeEntity(data, "Poképark", visit.Format.Length > 0 ? visit.Format : null)
            ?? new BankEntryInfo(visit.Species, visit.Form, visit.Shiny, visit.Nickname, visit.Level, visit.Generation, "Poképark",
                visit.Format.Length > 0 ? visit.Format : null);
        try
        {
            return bank.Change((store, root) =>
            {
                var ledger = BankSideFiles.Load<ParkVisitLedger>(root, ParkVisitLedger.FileName);
                if (ledger.Collected.Contains(visit.Id)) return false;
                ledger.MarkCollected(visit.Id);
                BankSideFiles.Save(root, ParkVisitLedger.FileName, ledger);
                try
                {
                    store.AddMany([new BankDeposit(data, info with { SourceName = "Poképark" })]);
                }
                catch
                {
                    ledger.Collected.Remove(visit.Id);
                    BankSideFiles.Save(root, ParkVisitLedger.FileName, ledger);
                    throw;
                }
                return true;
            });
        }
        catch (Exception error) when (error is IOException or InvalidOperationException or UnauthorizedAccessException)
        {
            AppLog.Warn("park", $"Taking back {visit.Id}: {error.Message}");
            return false;
        }
    }

    /// <summary>Trips that left the Bank but never reached the server (the app closed): sent again now.</summary>
    private async Task FinishTripsAsync(CloudSession session, CancellationToken token)
    {
        var pending = bank.Read((_, root) => BankSideFiles.Load<OutgoingLedger>(root, OutgoingLedger.FileName).Batches.ToList());
        foreach (var (id, batch) in pending)
        {
            var hold = new BankHold(id, batch.Mons);
            if (batch.Destination == Destination && batch.Mons.Count == 1)
            {
                // A failed question throws: the trip waits for the next try, never sent twice.
                if (await cloud.GetVisitAsync(session, session.UserId, id, token) is null)
                {
                    var mon = batch.Mons[0];
                    await cloud.SendVisitAsync(session, ParkVisit.From(id, session.UserId, session.Username, mon.Bytes, mon.Info, batch.CreatedUnixMs), token);
                }
                exits.Deliver(hold);
            }
            else if (batch.Destination.StartsWith(HomePrefix, StringComparison.Ordinal) && session.IsAdmin && batch.Mons.Count == 1)
            {
                var parts = batch.Destination[HomePrefix.Length..].Split(':');
                if (parts.Length != 2) continue;
                await DeliverHomeAsync(session, parts[0], parts[1], hold, "", token);
            }
        }
    }

    // ── The admin ────────────────────────────────────────────────────────────

    /// <summary>Every visit of every player (admin).</summary>
    public async Task<IReadOnlyList<ParkVisit>> GetAllAsync(CancellationToken token = default) =>
        await cloud.GetAllVisitsAsync(await account.GetFreshSessionAsync(token), token);

    /// <summary>The visitors in the admin's Bank now, by visit id.</summary>
    public IReadOnlyDictionary<string, ParkGuest> Guests() =>
        bank.Read((_, root) => BankSideFiles.Load<ParkGuestBook>(root, ParkGuestBook.FileName).Guests);

    /// <summary>The admin takes a sent Pokémon in: it joins the admin's Bank and the Poképark.</summary>
    public async Task<string> TakeInAsync(ParkVisit visit, CancellationToken token = default)
    {
        var session = await account.GetFreshSessionAsync(token);
        if (!session.IsAdmin) return "Only the admin runs the Poképark.";
        byte[] data;
        try { data = visit.Bytes; }
        catch (FormatException) { return "That visit's Pokémon could not be read."; }
        var info = engine.TryDescribeEntity(data, $"Poképark guest of @{visit.OwnerName}", visit.Format.Length > 0 ? visit.Format : null)
            ?? new BankEntryInfo(visit.Species, visit.Form, visit.Shiny, visit.Nickname, visit.Level, visit.Generation,
                $"Poképark guest of @{visit.OwnerName}", visit.Format.Length > 0 ? visit.Format : null);
        Guid entryId;
        try
        {
            entryId = bank.Change((store, root) =>
            {
                var book = BankSideFiles.Load<ParkGuestBook>(root, ParkGuestBook.FileName);
                if (book.Guests.TryGetValue(visit.Id, out var known)) return known.EntryId;
                var added = store.AddMany([new BankDeposit(data, info)])[0];
                book.Guests[visit.Id] = new ParkGuest(added.Id, visit.OwnerUid, visit.OwnerName, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
                BankSideFiles.Save(root, ParkGuestBook.FileName, book);
                return added.Id;
            });
        }
        catch (Exception error) when (error is IOException or InvalidOperationException or UnauthorizedAccessException)
        {
            return $"Your Bank could not take it: {error.Message}";
        }
        if (await sync.CommitAsync(token) is { } offline) return offline;
        await cloud.SaveVisitAsync(session, visit with { State = ParkVisitState.Caring }, token);
        var park = services.GetService<PokeparkService>()?.AddBankVisitor(entryId);
        return $"{visit.Nickname} (@{visit.OwnerName}) is in your Bank and your Poképark now. {park}".Trim();
    }

    /// <summary>The admin sends a guest home with what it gained in the Poképark.</summary>
    public async Task<string> SendHomeAsync(ParkVisit visit, string note, CancellationToken token = default)
    {
        var session = await account.GetFreshSessionAsync(token);
        if (!session.IsAdmin) return "Only the admin runs the Poképark.";
        if (!Guests().TryGetValue(visit.Id, out var guest))
        {
            // Never taken in: it goes back as it came.
            await cloud.SaveVisitAsync(session, visit with { State = ParkVisitState.Returned, ReturnedUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), Note = note }, token);
            return $"{visit.Nickname} is on its way back to @{visit.OwnerName}.";
        }
        var (hold, refusal) = await exits.HoldAsync([guest.EntryId], $"{HomePrefix}{visit.Id}:{visit.OwnerUid}", token);
        if (hold is null) return refusal ?? "That guest is no longer in your Bank.";
        services.GetService<PokeparkService>()?.RemoveVisitor($"bank:{guest.EntryId:N}");
        return await DeliverHomeAsync(session, visit.Id, visit.OwnerUid, hold, note, token);
    }

    private async Task<string> DeliverHomeAsync(CloudSession session, string visitId, string ownerUid, BankHold hold, string note, CancellationToken token)
    {
        const string Later = "There is no connection right now: it goes home as soon as the internet is back.";
        ParkVisit? visit;
        try { visit = await cloud.GetVisitAsync(session, ownerUid, visitId, token); }
        catch (CloudAccountException) { return Later; }
        var mon = hold.Mons[0];
        if (visit is null)
        {
            // The owner already took it in and crossed it off.
            exits.Deliver(hold);
            ForgetGuest(visitId);
            return "That visit is already over.";
        }
        if (visit.State != ParkVisitState.Returned)
        {
            try
            {
                await cloud.SaveVisitAsync(session, visit with
                {
                    State = ParkVisitState.Returned, Data = mon.Data, Format = mon.Info.Format ?? visit.Format, Level = mon.Info.Level,
                    Nickname = mon.Info.Nickname, Species = mon.Info.Species, Form = mon.Info.Form, Shiny = mon.Info.Shiny,
                    ReturnedUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), Note = note,
                }, token);
            }
            catch (CloudAccountException error)
            {
                ParkVisit? now;
                try { now = await cloud.GetVisitAsync(session, ownerUid, visitId, token); }
                catch (CloudAccountException) { return Later; }
                if (now is not { State: ParkVisitState.Returned })
                {
                    exits.Return(hold);
                    Rebook(visitId, mon.Bytes);
                    return $"It could not go home: {error.Message} It stays in your Bank.";
                }
            }
        }
        exits.Deliver(hold);
        ForgetGuest(visitId);
        return $"{mon.Info.Nickname} is on its way back to @{visit.OwnerName}.";
    }

    /// <summary>A guest given back to the admin's boxes has a new Bank entry: the guest book follows it.</summary>
    private void Rebook(string visitId, byte[] data)
    {
        var hash = BankCheckout.Sha256Hex(data);
        try
        {
            bank.Change((store, root) =>
            {
                var book = BankSideFiles.Load<ParkGuestBook>(root, ParkGuestBook.FileName);
                var entry = store.GetAll().FirstOrDefault(e => BankCheckout.Sha256Hex(store.GetData(e.Id)) == hash);
                if (entry is null || !book.Guests.TryGetValue(visitId, out var guest)) return 0;
                book.Guests[visitId] = guest with { EntryId = entry.Id };
                BankSideFiles.Save(root, ParkGuestBook.FileName, book);
                return 0;
            });
            if (Guests().TryGetValue(visitId, out var moved)) services.GetService<PokeparkService>()?.AddBankVisitor(moved.EntryId);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            AppLog.Warn("park", $"Rebooking guest {visitId}: {error.Message}");
        }
    }

    private void ForgetGuest(string visitId)
    {
        try
        {
            bank.Change((_, root) =>
            {
                var book = BankSideFiles.Load<ParkGuestBook>(root, ParkGuestBook.FileName);
                if (book.Guests.Remove(visitId)) BankSideFiles.Save(root, ParkGuestBook.FileName, book);
                return 0;
            });
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            AppLog.Warn("park", $"Forgetting guest {visitId}: {error.Message}");
        }
    }
}
