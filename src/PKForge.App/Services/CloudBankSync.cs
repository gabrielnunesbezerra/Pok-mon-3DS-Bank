using PKForge.Domain;
using PKForge.Infrastructure;

namespace PKForge.App.Services;

/// <summary>
/// Keeps this phone's Bank and the signed-in account's Bank the same. The whole Bank folder
/// goes up as one snapshot a few seconds after every change, when the app goes to the
/// background and every couple of minutes; a newer copy uploaded by another phone comes down
/// when this phone has nothing new of its own. Signing in on a fresh install brings the
/// account's Bank back; signing out uploads, then empties the Bank on this phone.
/// Since 2.5 every upload names the revision it was made from and the server refuses it when
/// the Bank moved on meanwhile (another phone, the admin): this phone then takes the online
/// Bank and puts back only what it changed itself, Pokémon by Pokémon, so a Pokémon that left
/// elsewhere never comes back. And a Pokémon only leaves the Bank (to a game, a trade, a file,
/// the Poképark) after <see cref="CommitAsync"/> got its absence online: wiping the app or
/// cutting the internet halfway can no longer bring back a copy that is somewhere else already.
/// </summary>
public sealed class CloudBankSync
{
    private const string KeyOwner = "bank_owner_user_id";
    private const string KeyRevision = "bank_synced_revision";
    private const string KeyFingerprint = "bank_synced_fingerprint";
    private const string SyncedIdsFile = "bank-synced-ids.json";

    private static readonly TimeSpan Debounce = TimeSpan.FromSeconds(3);
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(2);

    private readonly AccountService _account;
    private readonly ReloadableBankService _bank;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private CancellationTokenSource? _pending;
    private CancellationTokenSource? _loop;

    public CloudBankSync(AccountService account, ReloadableBankService bank)
    {
        _account = account;
        _bank = bank;
        _bank.Changed += ScheduleUpload;
        App.Suspended += () => _ = SyncNowAsync();
    }

    /// <summary>The last sync problem, or null after a good sync.</summary>
    public string? LastError { get; private set; }

    /// <summary>When this phone and the account last agreed.</summary>
    public DateTimeOffset? LastSyncUtc { get; private set; }

    private static long SyncedRevision
    {
        get => Preferences.Default.Get(KeyRevision, 0L);
        set => Preferences.Default.Set(KeyRevision, value);
    }

    private static string SyncedFingerprint
    {
        get => Preferences.Default.Get(KeyFingerprint, "");
        set => Preferences.Default.Set(KeyFingerprint, value);
    }

    private static string Owner
    {
        get => Preferences.Default.Get(KeyOwner, "");
        set => Preferences.Default.Set(KeyOwner, value);
    }

    /// <summary>Starts the background sync for a signed-in player (app start, after sign-in).</summary>
    public void Start()
    {
        if (!_account.IsSignedIn) return;
        _loop?.Cancel();
        _loop = new CancellationTokenSource();
        var token = _loop.Token;
        _ = Task.Run(async () =>
        {
            await SyncNowAsync(token);
            using var timer = new PeriodicTimer(Interval);
            try
            {
                while (await timer.WaitForNextTickAsync(token))
                    await SyncNowAsync(token);
            }
            catch (OperationCanceledException)
            {
                // Signed out or the app is closing.
            }
        }, token);
    }

    /// <summary>
    /// Right after signing in: makes this phone's Bank the account's Bank, keeping any
    /// Pokémon that were on the phone before it had an account. Returns what happened, in words.
    /// </summary>
    public async Task<string> AdoptAccountBankAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var session = await _account.GetFreshSessionAsync(cancellationToken);
            var message = await AdoptCoreAsync(session, cancellationToken);
            LastError = null;
            LastSyncUtc = DateTimeOffset.UtcNow;
            return message;
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<string> AdoptCoreAsync(CloudSession session, CancellationToken cancellationToken)
    {
        var cloud = await _account.Client.GetBankAsync(session, cancellationToken);
        var owner = Owner;
        var local = _bank.GetAll();
        string message;
        if (owner == session.UserId)
        {
            // The same account again on this phone: the newer side wins.
            if (cloud is not null && cloud.Revision > SyncedRevision && !LocalChanged())
            {
                Restore(cloud);
                message = "Your Bank was updated from your account.";
            }
            else
            {
                await UploadAsync(session, cancellationToken);
                message = "Your Bank is saved to your account.";
            }
        }
        else if (owner.Length > 0 || local.Count == 0)
        {
            // Nothing on this phone to keep (or another account's Bank, already uploaded when it signed out).
            if (cloud is not null)
            {
                Restore(cloud);
                var count = _bank.GetAll().Count;
                message = count == 0 ? "Your Bank is ready." : $"Welcome back! {count} Pokémon are in your Bank.";
            }
            else
            {
                _bank.Clear();
                await UploadAsync(session, cancellationToken);
                message = "Your Bank is ready.";
            }
        }
        else if (cloud is null)
        {
            // A Bank from before accounts existed, and a new account: the Bank becomes the account's.
            await UploadAsync(session, cancellationToken);
            message = $"The {local.Count} Pokémon already on this phone are now saved to your account.";
        }
        else
        {
            // A Bank from before accounts existed, and an account that already has one: keep both,
            // skipping exact copies, so nothing is lost and nothing doubles.
            var keep = local.Select(entry => (Data: _bank.GetData(entry.Id), entry.Info)).ToList();
            Restore(cloud);
            var known = new HashSet<string>(_bank.GetAll().Select(entry => BankCheckout.Sha256Hex(_bank.GetData(entry.Id))), StringComparer.Ordinal);
            var deposits = keep
                .Where(mon => known.Add(BankCheckout.Sha256Hex(mon.Data)))
                .Select(mon => new BankDeposit(mon.Data, mon.Info))
                .ToList();
            if (deposits.Count > 0) _bank.AddMany(deposits);
            await UploadAsync(session, cancellationToken);
            message = deposits.Count > 0
                ? $"Your account's Bank is here, plus {deposits.Count} Pokémon that were on this phone."
                : "Your account's Bank is here.";
        }
        Owner = session.UserId;
        return message;
    }

    /// <summary>Uploads local changes, or brings down a newer copy. False (with <see cref="LastError"/>) when offline.</summary>
    public async Task<bool> SyncNowAsync(CancellationToken cancellationToken = default)
    {
        if (!_account.IsSignedIn) return false;
        try
        {
            await _gate.WaitAsync(cancellationToken);
        }
        catch (OperationCanceledException)
        {
            return false;
        }
        try
        {
            await SyncCoreAsync(cancellationToken);
            LastError = null;
            LastSyncUtc = DateTimeOffset.UtcNow;
            return true;
        }
        catch (OperationCanceledException)
        {
            return false;
        }
        catch (Exception error)
        {
            LastError = error is CloudAccountException ? error.Message : $"Sync failed: {error.Message}";
            AppLog.Warn("sync", LastError);
            return false;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>
    /// Makes the account hold exactly this phone's Bank right now, or says why it could not
    /// (null when it does). Every way out of the Bank calls it after the Pokémon left the boxes
    /// and before it arrives anywhere else. Without an account there is nothing to keep in step.
    /// </summary>
    public async Task<string?> CommitAsync(CancellationToken cancellationToken = default)
    {
        if (!_account.IsSignedIn) return null;
        await _gate.WaitAsync(cancellationToken);
        try
        {
            // Something else may change the Bank meanwhile (a berry eaten in the Poképark): the
            // trip is committed once a sync leaves nothing behind.
            for (var pass = 0; pass < 3; pass++)
            {
                await SyncCoreAsync(cancellationToken);
                if (!LocalChanged()) break;
            }
            if (LocalChanged()) throw new CloudAccountException("Your Bank could not be saved online.");
            LastError = null;
            LastSyncUtc = DateTimeOffset.UtcNow;
            return null;
        }
        catch (Exception error) when (error is CloudAccountException or IOException or HttpRequestException or InvalidOperationException)
        {
            LastError = error.Message;
            AppLog.Warn("sync", $"Commit: {error.Message}");
            return "Taking Pokémon out of the Bank needs the internet, so your account knows right away. " + error.Message;
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task SyncCoreAsync(CancellationToken cancellationToken)
    {
        var session = await _account.GetFreshSessionAsync(cancellationToken);
        // A phone that came from 2.4 learns which Pokémon the account holds while nothing differs.
        if (Owner == session.UserId && LoadSyncedIds() is null)
        {
            var (snapshot, ids) = _bank.SnapshotWithIds();
            if (BankSnapshot.Fingerprint(snapshot) == SyncedFingerprint) SyncedIds = ids;
        }
        if (Owner != session.UserId)
        {
            await AdoptCoreAsync(session, cancellationToken);
        }
        else if (LocalChanged())
        {
            await UploadAsync(session, cancellationToken);
        }
        else if (await _account.Client.GetRevisionAsync(session, cancellationToken) is { } revision && revision != SyncedRevision)
        {
            if (await _account.Client.GetBankAsync(session, cancellationToken) is { } cloud)
                Restore(cloud);
        }
    }

    /// <summary>
    /// Uploads what is new, then empties the Bank on this phone and forgets the account. Returns
    /// false without signing out when the upload failed and <paramref name="force"/> is off.
    /// </summary>
    public async Task<bool> SignOutAsync(bool force)
    {
        var uploaded = !LocalChangedSafe() || await SyncNowAsync();
        if (!uploaded && !force) return false;
        _loop?.Cancel();
        _pending?.Cancel();
        await _gate.WaitAsync();
        try
        {
            _bank.Clear();
            Preferences.Default.Remove(KeyOwner);
            Preferences.Default.Remove(KeyRevision);
            Preferences.Default.Remove(KeyFingerprint);
            try { File.Delete(Path.Combine(FileSystem.AppDataDirectory, SyncedIdsFile)); }
            catch (IOException) { /* a stale record is replaced on the next sign-in */ }
            _account.SignOut();
            LastSyncUtc = null;
            LastError = null;
        }
        finally
        {
            _gate.Release();
        }
        return true;
    }

    private void ScheduleUpload()
    {
        if (!_account.IsSignedIn) return;
        var previous = Interlocked.Exchange(ref _pending, new CancellationTokenSource());
        previous?.Cancel();
        var token = _pending!.Token;
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(Debounce, token);
                await SyncNowAsync(token);
            }
            catch (OperationCanceledException)
            {
                // A newer change restarted the wait.
            }
        }, token);
    }

    private bool LocalChanged() => BankSnapshot.Fingerprint(_bank.Snapshot()) != SyncedFingerprint;

    private bool LocalChangedSafe()
    {
        try { return LocalChanged(); }
        catch (IOException) { return true; }
    }

    /// <summary>
    /// Sends this phone's Bank up. When the server says the Bank moved on since this phone last
    /// saw it, the online Bank comes down first and this phone's own changes go on top of it
    /// (<see cref="MergeOnto"/>), then it tries again.
    /// </summary>
    private async Task UploadAsync(CloudSession session, CancellationToken cancellationToken)
    {
        for (var attempt = 0; ; attempt++)
        {
            // The ids are the ones in this very snapshot: a change made while it uploads is not synced yet.
            var (snapshot, ids) = _bank.SnapshotWithIds();
            var revision = Math.Max(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), SyncedRevision + 1);
            try
            {
                await _account.Client.PutBankAsync(session, new CloudBank(revision, snapshot), SyncedRevision > 0 ? SyncedRevision : null,
                    cancellationToken);
                SyncedRevision = revision;
                SyncedFingerprint = BankSnapshot.Fingerprint(snapshot);
                SyncedIds = ids;
                return;
            }
            catch (CloudBankConflictException) when (attempt < 3)
            {
                var cloud = await _account.Client.GetBankAsync(session, cancellationToken);
                if (cloud is null)
                {
                    // The Bank online is gone (the admin emptied it): upload from scratch.
                    SyncedRevision = 0;
                    continue;
                }
                MergeOnto(cloud);
            }
        }
    }

    /// <summary>
    /// Takes the online Bank and keeps on top of it only what this phone did since the last
    /// sync: Pokémon it added come along, Pokémon it let go stay gone. Everything else is the
    /// online copy, so a Pokémon another phone (or the admin) took out never comes back.
    /// </summary>
    private void MergeOnto(CloudBank cloud)
    {
        var local = _bank.GetAll().Select(entry => (Entry: entry, Data: _bank.GetData(entry.Id))).ToList();
        // Without the record of the last sync (a phone that came from 2.4 with changes not sent
        // yet) nothing here can be told apart from what left elsewhere: the online Bank wins.
        var synced = LoadSyncedIds() ?? local.Select(mon => mon.Entry.Id).ToHashSet();
        var ledgers = _bank.Read((_, root) => BankMerge.ReadLedgers(root));
        Restore(cloud);
        var (added, letGo) = BankMerge.Apply(_bank, local, synced);
        _bank.Change((_, root) =>
        {
            BankMerge.MergeLedgers(root, ledgers);
            return 0;
        });
        AppLog.Warn("sync", $"The Bank changed online; merged {added} added here and {letGo} let go here.");
    }

    private void Restore(CloudBank cloud)
    {
        _bank.ReplaceContents(cloud.Snapshot);
        SyncedRevision = cloud.Revision;
        var (snapshot, ids) = _bank.SnapshotWithIds();
        SyncedFingerprint = BankSnapshot.Fingerprint(snapshot);
        SyncedIds = ids;
    }

    /// <summary>The ids of the last sync, or null when this phone has no record of it.</summary>
    private static HashSet<Guid>? LoadSyncedIds()
    {
        try
        {
            var path = Path.Combine(FileSystem.AppDataDirectory, SyncedIdsFile);
            if (!File.Exists(path)) return null;
            return System.Text.Json.JsonSerializer.Deserialize<List<Guid>>(File.ReadAllText(path))?.ToHashSet();
        }
        catch (Exception error) when (error is IOException or System.Text.Json.JsonException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    /// <summary>The Pokémon (by entry id) the account held at the last sync; kept outside the Bank folder.</summary>
    private static HashSet<Guid> SyncedIds
    {
        set
        {
            try
            {
                var path = Path.Combine(FileSystem.AppDataDirectory, SyncedIdsFile);
                File.WriteAllText(path + ".tmp", System.Text.Json.JsonSerializer.Serialize(value.ToList()));
                File.Move(path + ".tmp", path, overwrite: true);
            }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            {
                AppLog.Warn("sync", $"Remembering the synced Bank: {error.Message}");
            }
        }
    }
}
