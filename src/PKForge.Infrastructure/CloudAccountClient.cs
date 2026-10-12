using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace PKForge.Infrastructure;

/// <summary>The Firebase project 3DS Bank accounts live in.</summary>
/// <param name="ApiKey">The project's Web API key (public by design; the database rules protect the data).</param>
/// <param name="DatabaseUrl">The Realtime Database address, e.g. https://name-default-rtdb.firebaseio.com.</param>
public sealed record CloudConfig(string ApiKey, string DatabaseUrl)
{
    public bool IsConfigured => ApiKey.Length > 0 && DatabaseUrl.StartsWith("https://", StringComparison.Ordinal);
}

/// <summary>A signed-in account: who, and the tokens that prove it.</summary>
public sealed record CloudSession(string UserId, string Username, string IdToken, string RefreshToken, DateTimeOffset ExpiresUtc);

/// <summary>An account's Bank as stored online.</summary>
/// <param name="Revision">Upload time in Unix milliseconds; the newest copy wins.</param>
/// <param name="Snapshot">The packed Bank folder (<see cref="BankSnapshot"/>).</param>
public sealed record CloudBank(long Revision, byte[] Snapshot);

/// <summary>A refusal the player can read (wrong password, name taken, no internet...).</summary>
public sealed class CloudAccountException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>
/// 3DS Bank accounts over Firebase's REST endpoints: username + password sign-up and sign-in
/// (Firebase Authentication, the username mapped to a private e-mail address), and one Bank per
/// account in the Realtime Database at banks/&lt;user id&gt;, readable and writable only by its
/// owner (the database rules).
/// </summary>
public sealed partial class CloudAccountClient(CloudConfig config, HttpClient http)
{
    /// <summary>Usernames become addresses on this domain; nobody ever receives mail there.</summary>
    public const string EmailDomain = "users.3dsbank.app";

    public const int MinPasswordLength = 6;

    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    [GeneratedRegex("^[a-z0-9._]{3,20}$")]
    private static partial Regex UsernamePattern();

    /// <summary>Lower-cased, trimmed; null when it is not a valid username.</summary>
    public static string? NormalizeUsername(string? raw)
    {
        var name = (raw ?? "").Trim().ToLowerInvariant();
        return UsernamePattern().IsMatch(name) ? name : null;
    }

    public Task<CloudSession> SignUpAsync(string username, string password, CancellationToken cancellationToken = default) =>
        AuthenticateAsync("accounts:signUp", username, password, cancellationToken);

    public Task<CloudSession> SignInAsync(string username, string password, CancellationToken cancellationToken = default) =>
        AuthenticateAsync("accounts:signInWithPassword", username, password, cancellationToken);

    private async Task<CloudSession> AuthenticateAsync(string endpoint, string username, string password, CancellationToken cancellationToken)
    {
        EnsureConfigured();
        var name = NormalizeUsername(username)
            ?? throw new CloudAccountException("Usernames have 3 to 20 letters, numbers, dots or underscores, with no spaces.");
        if (password.Length < MinPasswordLength)
            throw new CloudAccountException($"The password needs at least {MinPasswordLength} characters.");
        var url = $"https://identitytoolkit.googleapis.com/v1/{endpoint}?key={Uri.EscapeDataString(config.ApiKey)}";
        var body = new { email = $"{name}@{EmailDomain}", password, returnSecureToken = true };
        using var response = await SendAsync(() => http.PostAsJsonAsync(url, body, cancellationToken), cancellationToken).ConfigureAwait(false);
        var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            throw new CloudAccountException(Explain(json));
        var auth = JsonSerializer.Deserialize<AuthResponse>(json, Json)
            ?? throw new CloudAccountException("The account server sent an empty answer.");
        return new CloudSession(auth.LocalId, name, auth.IdToken, auth.RefreshToken,
            DateTimeOffset.UtcNow.AddSeconds(ParseSeconds(auth.ExpiresIn)));
    }

    /// <summary>A fresh ID token for a session whose token expired (they last an hour).</summary>
    public async Task<CloudSession> RefreshAsync(CloudSession session, CancellationToken cancellationToken = default)
    {
        EnsureConfigured();
        var url = $"https://securetoken.googleapis.com/v1/token?key={Uri.EscapeDataString(config.ApiKey)}";
        using var response = await SendAsync(() => http.PostAsync(url, new FormUrlEncodedContent(
        [
            new KeyValuePair<string?, string?>("grant_type", "refresh_token"),
            new KeyValuePair<string?, string?>("refresh_token", session.RefreshToken),
        ]), cancellationToken), cancellationToken).ConfigureAwait(false);
        var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            throw new CloudAccountException(Explain(json));
        var refreshed = JsonSerializer.Deserialize<RefreshResponse>(json)
            ?? throw new CloudAccountException("The account server sent an empty answer.");
        return session with
        {
            IdToken = refreshed.IdToken,
            RefreshToken = refreshed.RefreshToken,
            ExpiresUtc = DateTimeOffset.UtcNow.AddSeconds(ParseSeconds(refreshed.ExpiresIn)),
        };
    }

    /// <summary>The account's Bank, or null when it has never uploaded one.</summary>
    public async Task<CloudBank?> GetBankAsync(CloudSession session, CancellationToken cancellationToken = default)
    {
        using var response = await SendAsync(() => http.GetAsync(BankUrl(session), cancellationToken), cancellationToken).ConfigureAwait(false);
        var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            throw new CloudAccountException(ExplainDatabase(response.StatusCode, json));
        var stored = JsonSerializer.Deserialize<StoredBank?>(json, Json);
        if (stored is null || string.IsNullOrEmpty(stored.Snapshot)) return null;
        return new CloudBank(stored.Revision, Convert.FromBase64String(stored.Snapshot));
    }

    /// <summary>Only the revision of the account's Bank (cheap: tells whether another phone changed it).</summary>
    public async Task<long?> GetRevisionAsync(CloudSession session, CancellationToken cancellationToken = default)
    {
        var url = $"{config.DatabaseUrl.TrimEnd('/')}/banks/{Uri.EscapeDataString(session.UserId)}/revision.json?auth={Uri.EscapeDataString(session.IdToken)}";
        using var response = await SendAsync(() => http.GetAsync(url, cancellationToken), cancellationToken).ConfigureAwait(false);
        var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            throw new CloudAccountException(ExplainDatabase(response.StatusCode, json));
        return JsonSerializer.Deserialize<long?>(json);
    }

    /// <summary>Uploads the account's Bank, replacing the previous copy.</summary>
    public async Task PutBankAsync(CloudSession session, CloudBank bank, CancellationToken cancellationToken = default)
    {
        var stored = new StoredBank(bank.Revision, Convert.ToBase64String(bank.Snapshot), session.Username, DateTimeOffset.UtcNow.ToString("O"));
        using var content = new StringContent(JsonSerializer.Serialize(stored, Json), Encoding.UTF8, "application/json");
        using var response = await SendAsync(() => http.PutAsync(BankUrl(session), content, cancellationToken), cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            throw new CloudAccountException(ExplainDatabase(response.StatusCode, json));
        }
    }

    private string BankUrl(CloudSession session)
    {
        EnsureConfigured();
        return $"{config.DatabaseUrl.TrimEnd('/')}/banks/{Uri.EscapeDataString(session.UserId)}.json?auth={Uri.EscapeDataString(session.IdToken)}";
    }

    private void EnsureConfigured()
    {
        if (!config.IsConfigured)
            throw new CloudAccountException("Accounts are not set up in this version of 3DS Bank yet.");
    }

    /// <summary>Network failures become one readable message instead of a stack trace.</summary>
    private static async Task<HttpResponseMessage> SendAsync(Func<Task<HttpResponseMessage>> send, CancellationToken cancellationToken)
    {
        try
        {
            return await send().ConfigureAwait(false);
        }
        catch (HttpRequestException error)
        {
            throw new CloudAccountException("No connection to the account server. Check the internet and try again.", error);
        }
        catch (TaskCanceledException error) when (!cancellationToken.IsCancellationRequested)
        {
            throw new CloudAccountException("The account server took too long to answer. Try again.", error);
        }
    }

    private static double ParseSeconds(string? value) =>
        double.TryParse(value, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var seconds) ? seconds : 3600;

    /// <summary>Firebase's error codes as sentences.</summary>
    internal static string Explain(string json)
    {
        string code;
        try
        {
            using var document = JsonDocument.Parse(json);
            code = document.RootElement.GetProperty("error").GetProperty("message").GetString() ?? "";
        }
        catch (Exception error) when (error is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            return "The account server refused the request.";
        }
        var key = code.Split(' ', ':')[0];
        return key switch
        {
            "EMAIL_EXISTS" => "That username is taken. Pick another one.",
            "EMAIL_NOT_FOUND" or "INVALID_PASSWORD" or "INVALID_LOGIN_CREDENTIALS" => "Wrong username or password.",
            "USER_DISABLED" => "This account was disabled. Talk to support.",
            "TOO_MANY_ATTEMPTS_TRY_LATER" => "Too many attempts. Wait a little and try again.",
            "WEAK_PASSWORD" => $"The password needs at least {MinPasswordLength} characters.",
            "OPERATION_NOT_ALLOWED" => "Accounts are switched off on the server. Talk to support.",
            "TOKEN_EXPIRED" or "INVALID_REFRESH_TOKEN" or "USER_NOT_FOUND" => "Your sign-in expired. Sign in again.",
            "INVALID_EMAIL" => "Usernames have 3 to 20 letters, numbers, dots or underscores, with no spaces.",
            _ => $"The account server refused the request ({key}).",
        };
    }

    private static string ExplainDatabase(HttpStatusCode status, string json) => status switch
    {
        HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => "The server refused access to this Bank. Sign in again.",
        HttpStatusCode.NotFound => "The Bank server address is wrong. Talk to support.",
        _ => $"The Bank server answered {(int)status}: {Shorten(json)}",
    };

    private static string Shorten(string text) => text.Length > 120 ? text[..120] + "…" : text;

    private sealed record AuthResponse(string LocalId, string IdToken, string RefreshToken, string? ExpiresIn);

    private sealed record RefreshResponse(
        [property: JsonPropertyName("id_token")] string IdToken,
        [property: JsonPropertyName("refresh_token")] string RefreshToken,
        [property: JsonPropertyName("expires_in")] string? ExpiresIn);

    private sealed record StoredBank(long Revision, string Snapshot, string? Username, string? Updated);
}
