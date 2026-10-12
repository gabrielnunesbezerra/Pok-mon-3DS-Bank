using PKForge.Infrastructure;

namespace PKForge.App.Services;

/// <summary>The 3DS Bank Firebase project and the support contact.</summary>
public static class CloudSettings
{
    /// <summary>Project settings > General > Web API key. Public by design: the database rules protect each Bank.</summary>
    public const string ApiKey = "";

    /// <summary>Realtime Database > Data: the address at the top.</summary>
    public const string DatabaseUrl = "";

    /// <summary>Support on WhatsApp (country code + area code + number).</summary>
    public const string SupportWhatsApp = "5541996038238";

    public static CloudConfig Config => new(ApiKey, DatabaseUrl);

    /// <summary>Opens a WhatsApp chat with support.</summary>
    public static async Task<bool> OpenSupportChatAsync()
    {
        var text = Uri.EscapeDataString("Olá! Preciso de ajuda com o 3DS Bank.");
        try
        {
            return await Launcher.Default.OpenAsync(new Uri($"https://wa.me/{SupportWhatsApp}?text={text}"));
        }
        catch (Exception error)
        {
            AppLog.Warn("support", $"Opening WhatsApp: {error.Message}");
            return false;
        }
    }
}

/// <summary>
/// Who is signed in on this phone. The session (user id, username and tokens) lives in the
/// app's private preferences, so the player stays signed in between launches; the ID token is
/// refreshed whenever it is about to expire.
/// </summary>
public sealed class AccountService
{
    private const string KeyUser = "account_user_id";
    private const string KeyName = "account_username";
    private const string KeyRefresh = "account_refresh_token";
    private const string KeyToken = "account_id_token";
    private const string KeyExpiry = "account_token_expiry_ms";

    private readonly SemaphoreSlim _refreshGate = new(1, 1);
    private CloudSession? _session;

    public AccountService(CloudAccountClient client)
    {
        Client = client;
        _session = Load();
    }

    public CloudAccountClient Client { get; }

    public bool IsSignedIn => _session is not null;

    public string? Username => _session?.Username;

    public string? UserId => _session?.UserId;

    /// <summary>Signs in (or creates the account first) and remembers the session.</summary>
    public async Task SignInAsync(string username, string password, bool createAccount, CancellationToken cancellationToken = default)
    {
        var session = createAccount
            ? await Client.SignUpAsync(username, password, cancellationToken)
            : await Client.SignInAsync(username, password, cancellationToken);
        Store(session);
    }

    /// <summary>The session with an ID token valid for at least a few more minutes.</summary>
    public async Task<CloudSession> GetFreshSessionAsync(CancellationToken cancellationToken = default)
    {
        var session = _session ?? throw new CloudAccountException("Sign in first.");
        if (session.ExpiresUtc > DateTimeOffset.UtcNow.AddMinutes(5)) return session;
        await _refreshGate.WaitAsync(cancellationToken);
        try
        {
            session = _session ?? throw new CloudAccountException("Sign in first.");
            if (session.ExpiresUtc > DateTimeOffset.UtcNow.AddMinutes(5)) return session;
            var refreshed = await Client.RefreshAsync(session, cancellationToken);
            Store(refreshed);
            return refreshed;
        }
        finally
        {
            _refreshGate.Release();
        }
    }

    /// <summary>Forgets the session on this phone (the account and its Bank stay online).</summary>
    public void SignOut()
    {
        _session = null;
        foreach (var key in new[] { KeyUser, KeyName, KeyRefresh, KeyToken, KeyExpiry })
            Preferences.Default.Remove(key);
    }

    private static CloudSession? Load()
    {
        var user = Preferences.Default.Get(KeyUser, "");
        var refresh = Preferences.Default.Get(KeyRefresh, "");
        if (user.Length == 0 || refresh.Length == 0) return null;
        var expiry = DateTimeOffset.FromUnixTimeMilliseconds(Preferences.Default.Get(KeyExpiry, 0L));
        return new CloudSession(user, Preferences.Default.Get(KeyName, ""), Preferences.Default.Get(KeyToken, ""), refresh, expiry);
    }

    private void Store(CloudSession session)
    {
        _session = session;
        Preferences.Default.Set(KeyUser, session.UserId);
        Preferences.Default.Set(KeyName, session.Username);
        Preferences.Default.Set(KeyRefresh, session.RefreshToken);
        Preferences.Default.Set(KeyToken, session.IdToken);
        Preferences.Default.Set(KeyExpiry, session.ExpiresUtc.ToUnixTimeMilliseconds());
    }
}
