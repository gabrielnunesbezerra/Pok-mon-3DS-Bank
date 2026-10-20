using PKForge.Domain;
using PKForge.Engine;
using PKForge.Infrastructure;

namespace PKForge.App.Services;

/// <summary>
/// Another player's Bank opened by the admin: the account's snapshot unpacked in a private
/// folder of this phone, changed there, and sent back as a new revision of that account.
/// </summary>
public sealed class AdminBank : IDisposable
{
    internal AdminBank(PlayerSummary player, long revision, string root)
    {
        Player = player;
        Revision = revision;
        Root = root;
        Store = new FileBankService(root);
    }

    public PlayerSummary Player { get; }

    /// <summary>The revision opened; a save is refused when the player changed the Bank since.</summary>
    public long Revision { get; internal set; }

    internal string Root { get; }

    internal FileBankService Store { get; }

    public IReadOnlyList<BankEntry> Entries => Store.GetAll();

    /// <summary>Pokémon held out of the boxes for a trip that never ended (a closed app).</summary>
    public IReadOnlyDictionary<string, OutgoingBatch> Trips => BankSideFiles.Load<OutgoingLedger>(Root, OutgoingLedger.FileName).Batches;

    /// <summary>Pokémon held aside for online trades.</summary>
    public int TradeHolds => BankSideFiles.Load<TradeLedger>(Root, TradeLedger.FileName).Escrow.Count;

    public StorageState Storage => BankSideFiles.Load<StorageState>(Root, StorageState.FileName).Normalized();

    public byte[] DataOf(Guid id) => Store.GetData(id);

    public void Dispose()
    {
        try
        {
            var folder = Path.GetDirectoryName(Root);
            if (folder is not null && Directory.Exists(folder)) Directory.Delete(folder, recursive: true);
        }
        catch (IOException)
        {
            // A temporary folder left behind is cleaned with the app's cache.
        }
    }
}

/// <summary>
/// 3DS Bank 2.5's admin tools: every player, any player's Bank (to look at it, take out the
/// extra copies of a duplicated Pokémon, give back a trip a closed app left halfway) and a
/// duplicate search across every Bank. Only the admin account can use it: the database rules
/// refuse everyone else, whatever this phone does.
/// </summary>
public sealed class AdminService(AccountService account, CloudEventsClient events)
{
    public bool IsAdmin => account.IsAdmin;

    private async Task<CloudSession> AdminSessionAsync(CancellationToken token)
    {
        var session = await account.GetFreshSessionAsync(token);
        if (!session.IsAdmin) throw new CloudAccountException("Only the admin can do that.");
        return session;
    }

    /// <summary>Every player, the most recently seen first.</summary>
    public async Task<IReadOnlyList<PlayerSummary>> PlayersAsync(CancellationToken token = default) =>
        await events.GetPlayersAsync(await AdminSessionAsync(token), token);

    /// <summary>A player's Bank as it is online now, or null when they have none.</summary>
    public async Task<AdminBank?> OpenAsync(PlayerSummary player, CancellationToken token = default)
    {
        var session = await AdminSessionAsync(token);
        var cloud = await account.Client.GetBankOfAsync(session, player.Uid, token);
        if (cloud is null) return null;
        var root = Path.Combine(FileSystem.CacheDirectory, "admin", $"{player.Uid}-{Guid.NewGuid():N}", "bank");
        Directory.CreateDirectory(Path.GetDirectoryName(root)!);
        await Task.Run(() => BankSnapshot.Restore(root, cloud.Snapshot), token);
        return new AdminBank(player, cloud.Revision, root);
    }

    /// <summary>Who each Pokémon of the Bank is, for the duplicate search.</summary>
    public static IReadOnlyList<BankHolding> Holdings(AdminBank bank) => HoldingsOf(bank.Player, bank.Store);

    private static List<BankHolding> HoldingsOf(PlayerSummary player, IBankService store)
    {
        var list = new List<BankHolding>();
        foreach (var entry in store.GetAll())
        {
            byte[] data;
            try { data = store.GetData(entry.Id); }
            catch (IOException) { continue; }
            var identity = BankIdentity.Of(data, entry.Info.Format);
            var hash = BankCheckout.Sha256Hex(data);
            list.Add(new BankHolding(player.Uid, player.Username, entry.Id, identity?.Strict ?? hash, identity?.Loose ?? hash, entry.Info));
        }
        return list;
    }

    /// <summary>Takes Pokémon out of the player's Bank for good (the extra copies of a duplicate) and saves it.</summary>
    public async Task<string> RemoveAsync(AdminBank bank, IReadOnlyList<Guid> ids, CancellationToken token = default)
    {
        if (ids.Count == 0) return "Nothing to remove.";
        var removed = bank.Store.RemoveMany(ids);
        var saved = await SaveAsync(bank, token);
        return saved ?? $"{removed} Pokémon removed from @{bank.Player.Username}'s Bank.";
    }

    /// <summary>Puts a trip a closed app left halfway back in the player's boxes and saves the Bank.</summary>
    public async Task<string> ReturnTripAsync(AdminBank bank, string holdId, CancellationToken token = default)
    {
        if (!BankExitService.ReturnBatch(bank.Store, bank.Root, holdId)) return "That trip is over already.";
        return await SaveAsync(bank, token) ?? $"The Pokémon of that trip are back in @{bank.Player.Username}'s boxes.";
    }

    /// <summary>Sends the changed Bank up as the player's new revision; null when it went through, else why not.</summary>
    private async Task<string?> SaveAsync(AdminBank bank, CancellationToken token)
    {
        var session = await AdminSessionAsync(token);
        var snapshot = await Task.Run(() => BankSnapshot.Pack(bank.Root), token);
        var revision = Math.Max(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), bank.Revision + 1);
        try
        {
            await account.Client.PutBankOfAsync(session, bank.Player.Uid, new CloudBank(revision, snapshot), bank.Revision, token);
        }
        catch (CloudBankConflictException)
        {
            return $"@{bank.Player.Username} changed their Bank just now, so nothing was saved. Open it again and repeat.";
        }
        bank.Revision = revision;
        return null;
    }

    /// <summary>
    /// Reads every player's Bank and finds the Pokémon that are in more than one place. Reports
    /// how many Banks were read; a Bank that cannot be read is skipped.
    /// </summary>
    public async Task<(IReadOnlyList<DuplicateGroup> Groups, int Banks)> SearchEverywhereAsync(Action<int, int>? progress = null, CancellationToken token = default)
    {
        var session = await AdminSessionAsync(token);
        var players = await events.GetPlayersAsync(session, token);
        var holdings = new List<BankHolding>();
        var read = 0;
        for (var i = 0; i < players.Count; i++)
        {
            token.ThrowIfCancellationRequested();
            progress?.Invoke(i, players.Count);
            CloudBank? cloud;
            try { cloud = await account.Client.GetBankOfAsync(session, players[i].Uid, token); }
            catch (CloudAccountException error)
            {
                AppLog.Warn("admin", $"Reading @{players[i].Username}: {error.Message}");
                continue;
            }
            if (cloud is null) continue;
            var root = Path.Combine(FileSystem.CacheDirectory, "admin-scan", players[i].Uid, "bank");
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(root)!);
                var player = players[i];
                holdings.AddRange(await Task.Run(() =>
                {
                    BankSnapshot.Restore(root, cloud.Snapshot);
                    return HoldingsOf(player, new FileBankService(root));
                }, token));
                read++;
            }
            finally
            {
                try { Directory.Delete(Path.GetDirectoryName(root)!, recursive: true); }
                catch (IOException) { /* the cache is cleaned by the system */ }
            }
        }
        progress?.Invoke(players.Count, players.Count);
        return (DuplicateFinder.Find(holdings), read);
    }
}
