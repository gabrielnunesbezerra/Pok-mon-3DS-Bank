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
public class CloudAccountException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>A refusal from Firebase Authentication, with its error code ("EMAIL_EXISTS", ...).</summary>
public sealed class CloudAuthException(string code, string message) : CloudAccountException(message)
{
    public string Code { get; } = code;
}

/// <summary>What claiming the account's public username found.</summary>
public enum UsernameClaim
{
    /// <summary>The username was free and is now this account's.</summary>
    Claimed,
    /// <summary>It already belonged to this account.</summary>
    AlreadyMine,
    /// <summary>Another account has it.</summary>
    Taken,
}

/// <summary>
/// 3DS Bank accounts over Firebase's REST endpoints. Since 2.0 an account has a username (how
/// friends find it) and an e-mail (how a forgotten password is reset, and how it signs in);
/// accounts made before 2.0 sign in with the username, which is mapped to a private address
/// nobody receives mail at, until they add an e-mail. Usernames are claimed in the Realtime
/// Database at usernames/&lt;name&gt;, and each account's Bank lives at banks/&lt;user id&gt;,
/// readable and writable only by its owner (the database rules).
/// </summary>
public sealed partial class CloudAccountClient(CloudConfig config, HttpClient http)
{
    /// <summary>Usernames of accounts made before 2.0 became addresses on this domain; nobody receives mail there.</summary>
    public const string EmailDomain = "users.3dsbank.app";

    public const int MinPasswordLength = 6;

    private const string WrongCredentials = "Wrong username or password.";

    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private FirebaseDatabase? _database;

    /// <summary>The Realtime Database, signed in as the player (friends, profiles, trades).</summary>
    public FirebaseDatabase Database => _database ??= new FirebaseDatabase(config, http);

    [GeneratedRegex("^[a-z0-9._]{3,20}$")]
    private static partial Regex UsernamePattern();

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailPattern();

    /// <summary>Lower-cased, trimmed; null when it is not a valid username.</summary>
    public static string? NormalizeUsername(string? raw)
    {
        var name = (raw ?? "").Trim().ToLowerInvariant();
        return UsernamePattern().IsMatch(name) ? name : null;
    }

    /// <summary>Trimmed; null when it is not a usable e-mail address (or is one of the private pre-2.0 ones).</summary>
    public static string? NormalizeEmail(string? raw)
    {
        var email = (raw ?? "").Trim();
        return email.Length <= 254 && EmailPattern().IsMatch(email) && !IsPrivateAddress(email) ? email : null;
    }

    /// <summary>Whether an address is one of the private ones accounts made before 2.0 sign in with.</summary>
    public static bool IsPrivateAddress(string? email) =>
        email?.EndsWith("@" + EmailDomain, StringComparison.OrdinalIgnoreCase) == true;

    /// <summary>Whether what the player typed to sign in is an e-mail (otherwise it is a username).</summary>
    public static bool LooksLikeEmail(string? text) => text?.Contains('@', StringComparison.Ordinal) == true;

    /// <summary>
    /// Creates an account with a username (how friends find it) and an e-mail (how it signs in
    /// and gets a new password). The username is claimed right away; if another account has it,
    /// the new account is removed again and nothing is left behind.
    /// </summary>
    public async Task<CloudSession> SignUpAsync(string username, string email, string password, CancellationToken cancellationToken = default)
    {
        EnsureConfigured();
        var name = NormalizeUsername(username)
            ?? throw new CloudAccountException("Usernames have 3 to 20 letters, numbers, dots or underscores, with no spaces.");
        var mail = NormalizeEmail(email)
            ?? throw new CloudAccountException("Type a valid e-mail. If you ever forget your password, the link to make a new one goes there.");
        if (password.Length < MinPasswordLength)
            throw new CloudAccountException($"The password needs at least {MinPasswordLength} characters.");

        AuthResponse auth;
        try
        {
            auth = await AuthenticateAsync("accounts:signUp", mail, password, cancellationToken).ConfigureAwait(false);
        }
        catch (CloudAuthException error) when (error.Code == "EMAIL_EXISTS")
        {
            throw new CloudAccountException("That e-mail already has an account. Sign in with it, or use Forgot password.", error);
        }
        var session = ToSession(auth, name);
        UsernameClaim claim;
        try
        {
            claim = await ClaimUsernameAsync(session, cancellationToken).ConfigureAwait(false);
        }
        catch (CloudAccountException error)
        {
            await TryDeleteAccountAsync(session).ConfigureAwait(false);
            throw new CloudAccountException(error is CloudPermissionException
                ? "The server is not ready for new accounts yet (it still needs the 3DS Bank 2.0 rules). Talk to support."
                : error.Message, error);
        }
        if (claim == UsernameClaim.Taken)
        {
            await TryDeleteAccountAsync(session).ConfigureAwait(false);
            throw new CloudAccountException("That username is taken. Pick another one.");
        }
        return session;
    }

    /// <summary>
    /// Signs in with an e-mail, or with the username of an account that has none yet (made
    /// before 2.0). An account that added an e-mail signs in with the e-mail.
    /// </summary>
    public async Task<CloudSession> SignInAsync(string identifier, string password, CancellationToken cancellationToken = default)
    {
        EnsureConfigured();
        var text = (identifier ?? "").Trim();
        if (password.Length < MinPasswordLength)
            throw new CloudAccountException($"The password needs at least {MinPasswordLength} characters.");
        if (LooksLikeEmail(text))
        {
            var mail = NormalizeEmail(text) ?? (IsPrivateAddress(text) ? text : null)
                ?? throw new CloudAccountException("That e-mail address does not look right.");
            AuthResponse byMail;
            try
            {
                byMail = await AuthenticateAsync("accounts:signInWithPassword", mail, password, cancellationToken).ConfigureAwait(false);
            }
            catch (CloudAuthException error) when (IsWrongCredentials(error.Code))
            {
                throw new CloudAccountException("Wrong e-mail or password.", error);
            }
            var session = ToSession(byMail, "");
            var name = await UsernameOfAsync(session, cancellationToken).ConfigureAwait(false)
                ?? NormalizeUsername(mail.Split('@')[0]) ?? "player";
            return session with { Username = name };
        }

        var username = NormalizeUsername(text)
            ?? throw new CloudAccountException("Usernames have 3 to 20 letters, numbers, dots or underscores, with no spaces.");
        try
        {
            var auth = await AuthenticateAsync("accounts:signInWithPassword", $"{username}@{EmailDomain}", password, cancellationToken).ConfigureAwait(false);
            return ToSession(auth, username);
        }
        catch (CloudAuthException error) when (IsWrongCredentials(error.Code))
        {
            throw new CloudAccountException(WrongCredentials + " If you added an e-mail to your account, sign in with the e-mail.", error);
        }
    }

    /// <summary>
    /// Sends the "make a new password" link to the account's e-mail. Firebase sends it and shows
    /// the page where the new password is typed; nothing else changes until the link is used.
    /// </summary>
    public async Task SendPasswordResetAsync(string email, CancellationToken cancellationToken = default)
    {
        EnsureConfigured();
        var text = (email ?? "").Trim();
        if (!LooksLikeEmail(text))
            throw new CloudAccountException("Type the e-mail of your account. An account without an e-mail can only get a new password through support.");
        var mail = NormalizeEmail(text) ?? throw new CloudAccountException("That e-mail address does not look right.");
        try
        {
            await IdentityAsync("accounts:sendOobCode", new { requestType = "PASSWORD_RESET", email = mail }, cancellationToken).ConfigureAwait(false);
        }
        catch (CloudAuthException error) when (error.Code is "EMAIL_NOT_FOUND" or "USER_NOT_FOUND")
        {
            throw new CloudAccountException("No account uses that e-mail. Check it, or talk to support.", error);
        }
    }

    /// <summary>
    /// Asks Firebase to send a confirmation link to <paramref name="newEmail"/>; the account's
    /// e-mail changes when the link is opened. From then on the account signs in with that e-mail.
    /// </summary>
    public async Task SendEmailChangeAsync(CloudSession session, string newEmail, CancellationToken cancellationToken = default)
    {
        EnsureConfigured();
        var mail = NormalizeEmail(newEmail) ?? throw new CloudAccountException("That e-mail address does not look right.");
        try
        {
            await IdentityAsync("accounts:sendOobCode",
                new { requestType = "VERIFY_AND_CHANGE_EMAIL", idToken = session.IdToken, newEmail = mail }, cancellationToken).ConfigureAwait(false);
        }
        catch (CloudAuthException error) when (error.Code == "EMAIL_EXISTS")
        {
            throw new CloudAccountException("Another account already uses that e-mail.", error);
        }
    }

    /// <summary>The account's e-mail, or null while it only has the private pre-2.0 address.</summary>
    public async Task<string?> GetEmailAsync(CloudSession session, CancellationToken cancellationToken = default)
    {
        EnsureConfigured();
        var answer = await IdentityAsync("accounts:lookup", new { idToken = session.IdToken }, cancellationToken).ConfigureAwait(false);
        if (!answer.TryGetProperty("users", out var users) || users.ValueKind != JsonValueKind.Array || users.GetArrayLength() == 0)
            return null;
        var email = users[0].TryGetProperty("email", out var value) ? value.GetString() : null;
        return string.IsNullOrEmpty(email) || IsPrivateAddress(email) ? null : email;
    }

    /// <summary>
    /// Makes the account's username its own in the database (usernames/&lt;name&gt; holds the
    /// user id), so friends can find it, and records it in the public profile. Safe to repeat.
    /// </summary>
    public async Task<UsernameClaim> ClaimUsernameAsync(CloudSession session, CancellationToken cancellationToken = default)
    {
        EnsureConfigured();
        if (NormalizeUsername(session.Username) is not { } name) return UsernameClaim.Taken;
        var path = $"usernames/{FirebaseDatabase.Key(name)}";
        var owner = await Database.GetAsync(session, path, cancellationToken: cancellationToken).ConfigureAwait(false);
        UsernameClaim claim;
        if (owner is { ValueKind: JsonValueKind.String } known)
        {
            claim = known.GetString() == session.UserId ? UsernameClaim.AlreadyMine : UsernameClaim.Taken;
        }
        else
        {
            try
            {
                await Database.PutAsync(session, path, session.UserId, cancellationToken).ConfigureAwait(false);
                claim = UsernameClaim.Claimed;
            }
            catch (CloudPermissionException)
            {
                // Someone claimed it a moment earlier.
                var again = await Database.GetAsync(session, path, cancellationToken: cancellationToken).ConfigureAwait(false);
                claim = again is { ValueKind: JsonValueKind.String } other && other.GetString() == session.UserId
                    ? UsernameClaim.AlreadyMine : UsernameClaim.Taken;
            }
        }
        if (claim != UsernameClaim.Taken)
            await Database.PatchAsync(session, $"profiles/{session.UserId}", new Dictionary<string, object?> { ["username"] = name },
                cancellationToken).ConfigureAwait(false);
        return claim;
    }

    private async Task<string?> UsernameOfAsync(CloudSession session, CancellationToken cancellationToken)
    {
        try
        {
            var value = await Database.GetAsync(session, $"profiles/{session.UserId}/username", cancellationToken: cancellationToken).ConfigureAwait(false);
            return value is { ValueKind: JsonValueKind.String } text ? NormalizeUsername(text.GetString()) : null;
        }
        catch (CloudAccountException)
        {
            return null;
        }
    }

    /// <summary>Removes an account that was just created and could not get its username.</summary>
    private async Task TryDeleteAccountAsync(CloudSession session)
    {
        try
        {
            await IdentityAsync("accounts:delete", new { idToken = session.IdToken }, CancellationToken.None).ConfigureAwait(false);
        }
        catch (CloudAccountException)
        {
            // An empty account without a username cannot be found by anyone; support can remove it.
        }
    }

    private static bool IsWrongCredentials(string code) =>
        code is "EMAIL_NOT_FOUND" or "INVALID_PASSWORD" or "INVALID_LOGIN_CREDENTIALS" or "INVALID_EMAIL";

    private static CloudSession ToSession(AuthResponse auth, string username) =>
        new(auth.LocalId, username, auth.IdToken, auth.RefreshToken, DateTimeOffset.UtcNow.AddSeconds(ParseSeconds(auth.ExpiresIn)));

    private async Task<AuthResponse> AuthenticateAsync(string endpoint, string email, string password, CancellationToken cancellationToken)
    {
        var answer = await IdentityAsync(endpoint, new { email, password, returnSecureToken = true }, cancellationToken).ConfigureAwait(false);
        return answer.Deserialize<AuthResponse>(Json)
            ?? throw new CloudAccountException("The account server sent an empty answer.");
    }

    /// <summary>One Firebase Authentication call; a refusal becomes a <see cref="CloudAuthException"/> with a sentence.</summary>
    private async Task<JsonElement> IdentityAsync(string endpoint, object body, CancellationToken cancellationToken)
    {
        var url = $"https://identitytoolkit.googleapis.com/v1/{endpoint}?key={Uri.EscapeDataString(config.ApiKey)}";
        using var response = await SendAsync(() => http.PostAsJsonAsync(url, body, cancellationToken), cancellationToken).ConfigureAwait(false);
        var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            throw new CloudAuthException(ErrorCode(json), Explain(json));
        try
        {
            using var document = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            return document.RootElement.Clone();
        }
        catch (JsonException error)
        {
            throw new CloudAccountException("The account server sent an answer the app could not read. Try again.", error);
        }
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

    /// <summary>The error code of a Firebase Authentication refusal ("EMAIL_EXISTS"), or empty.</summary>
    internal static string ErrorCode(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            var code = document.RootElement.GetProperty("error").GetProperty("message").GetString() ?? "";
            return code.Split(' ', ':')[0];
        }
        catch (Exception error) when (error is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            return "";
        }
    }

    /// <summary>Firebase's error codes as sentences.</summary>
    internal static string Explain(string json)
    {
        var key = ErrorCode(json);
        if (key.Length == 0) return "The account server refused the request.";
        return key switch
        {
            "EMAIL_EXISTS" => "That username is taken. Pick another one.",
            "EMAIL_NOT_FOUND" or "INVALID_PASSWORD" or "INVALID_LOGIN_CREDENTIALS" => WrongCredentials,
            "INVALID_ID_TOKEN" or "CREDENTIAL_TOO_OLD_LOGIN_AGAIN" => "Your sign-in expired. Sign in again.",
            "RESET_PASSWORD_EXCEED_LIMIT" or "QUOTA_EXCEEDED" => "Too many e-mails were sent. Wait a little and try again.",
            "INVALID_NEW_EMAIL" or "MISSING_EMAIL" => "That e-mail address does not look right.",
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
