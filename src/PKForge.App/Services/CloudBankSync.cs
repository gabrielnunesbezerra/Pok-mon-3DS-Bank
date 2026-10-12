using PKForge.Domain;
using PKForge.Infrastructure;

namespace PKForge.App.Services;

/// <summary>
/// Keeps this phone's Bank and the signed-in account's Bank the same. The whole Bank folder
/// goes up as one snapshot a few seconds after every change, when the app goes to the
/// background and every couple of minutes; a newer copy uploaded by another phone comes down
/// when this phone has nothing new of its own. Signing in on a fresh install brings the
/// account's Bank back; signing out uploads, then empties the Bank on this phone.
/// </summary>
public sealed class CloudBankSync
{
    private const string KeyOwner = "bank_owner_user_id";
    private const string KeyRevision = "bank_synced_revision";
    private const string KeyFingerprint = "bank_synced_fingerprint";

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
            var session = await _account.GetFreshSessionAsync(cancellationToken);
            if (Owner != session.UserId)
            {
                await AdoptCoreAsync(session, cancellationToken);
            }
            else if (LocalChanged())
            {
                await UploadAsync(session, cancellationToken);
            }
            else if (await _account.Client.GetRevisionAsync(session, cancellationToken) is { } revision && revision > SyncedRevision)
            {
                if (await _account.Client.GetBankAsync(session, cancellationToken) is { } cloud)
                    Restore(cloud);
            }
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

    private async Task UploadAsync(CloudSession session, CancellationToken cancellationToken)
    {
        var snapshot = _bank.Snapshot();
        var revision = Math.Max(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), SyncedRevision + 1);
        await _account.Client.PutBankAsync(session, new CloudBank(revision, snapshot), cancellationToken);
        SyncedRevision = revision;
        SyncedFingerprint = BankSnapshot.Fingerprint(snapshot);
    }

    private void Restore(CloudBank cloud)
    {
        _bank.ReplaceContents(cloud.Snapshot);
        SyncedRevision = cloud.Revision;
        SyncedFingerprint = BankSnapshot.Fingerprint(_bank.Snapshot());
    }
}
