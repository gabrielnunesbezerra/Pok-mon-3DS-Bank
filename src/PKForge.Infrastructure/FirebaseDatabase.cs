using System.Net;
using System.Text;
using System.Text.Json;

namespace PKForge.Infrastructure;

/// <summary>A change the database rules refused (the place is taken, or the server's rules are older than the app).</summary>
public sealed class CloudPermissionException(string message) : CloudAccountException(message);

/// <summary>
/// The account's door to the Realtime Database over its REST API, signed in as the player:
/// read, write, update several places at once, delete, and a compare-and-set write
/// (<see cref="PutIfMatchAsync"/>) for the online trade's one-way state changes.
/// </summary>
public sealed class FirebaseDatabase(CloudConfig config, HttpClient http)
{
    /// <summary>The value the server replaces with its own clock (milliseconds since 1970).</summary>
    public static readonly IReadOnlyDictionary<string, string> ServerTime = new Dictionary<string, string> { [".sv"] = "timestamp" };

    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    /// <summary>A username as a database key: keys cannot hold dots, usernames cannot hold commas.</summary>
    public static string Key(string username) => username.Replace('.', ',');

    /// <summary>A database key back to the username.</summary>
    public static string Unkey(string key) => key.Replace(',', '.');

    /// <summary>The value at <paramref name="path"/>, or null when nothing is there.</summary>
    public async Task<JsonElement?> GetAsync(CloudSession session, string path, string? query = null, CancellationToken cancellationToken = default)
    {
        using var response = await SendAsync(() => http.GetAsync(Url(session, path, query), cancellationToken), cancellationToken).ConfigureAwait(false);
        var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode) throw Refusal(response.StatusCode, json);
        return Parse(json);
    }

    /// <summary>The value at <paramref name="path"/> with its version tag, for <see cref="PutIfMatchAsync"/>.</summary>
    public async Task<(JsonElement? Value, string ETag)> GetWithETagAsync(CloudSession session, string path, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, Url(session, path, null));
        request.Headers.TryAddWithoutValidation("X-Firebase-ETag", "true");
        using var response = await SendAsync(() => http.SendAsync(request, cancellationToken), cancellationToken).ConfigureAwait(false);
        var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode) throw Refusal(response.StatusCode, json);
        return (Parse(json), ETagOf(response));
    }

    /// <summary>Writes <paramref name="value"/> at <paramref name="path"/>, replacing what was there; returns what the server stored.</summary>
    public async Task<JsonElement?> PutAsync(CloudSession session, string path, object? value, CancellationToken cancellationToken = default)
    {
        using var response = await SendAsync(() => http.PutAsync(Url(session, path, null), Body(value), cancellationToken), cancellationToken).ConfigureAwait(false);
        var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode) throw Refusal(response.StatusCode, json);
        return Parse(json);
    }

    /// <summary>
    /// Writes <paramref name="value"/> only if the place still has the version <paramref name="etag"/>
    /// names. False when someone changed it first (nothing was written).
    /// </summary>
    public async Task<bool> PutIfMatchAsync(CloudSession session, string path, object? value, string etag, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, Url(session, path, null)) { Content = Body(value) };
        request.Headers.TryAddWithoutValidation("if-match", etag);
        using var response = await SendAsync(() => http.SendAsync(request, cancellationToken), cancellationToken).ConfigureAwait(false);
        if (response.StatusCode == HttpStatusCode.PreconditionFailed) return false;
        var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode) throw Refusal(response.StatusCode, json);
        return true;
    }

    /// <summary>Writes several places at once (paths relative to <paramref name="path"/>); a null value deletes that place.</summary>
    public async Task PatchAsync(CloudSession session, string path, IReadOnlyDictionary<string, object?> values, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Patch, Url(session, path, null)) { Content = Body(values) };
        using var response = await SendAsync(() => http.SendAsync(request, cancellationToken), cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            throw Refusal(response.StatusCode, await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
    }

    /// <summary>Deletes what is at <paramref name="path"/> (nothing there is fine).</summary>
    public async Task DeleteAsync(CloudSession session, string path, CancellationToken cancellationToken = default)
    {
        using var response = await SendAsync(() => http.DeleteAsync(Url(session, path, null), cancellationToken), cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
            throw Refusal(response.StatusCode, await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
    }

    private string Url(CloudSession session, string path, string? query)
    {
        if (!config.IsConfigured)
            throw new CloudAccountException("Accounts are not set up in this version of 3DS Bank yet.");
        var segments = string.Join('/', path.Split('/', StringSplitOptions.RemoveEmptyEntries).Select(Uri.EscapeDataString));
        var url = $"{config.DatabaseUrl.TrimEnd('/')}/{segments}.json?auth={Uri.EscapeDataString(session.IdToken)}";
        return query is null ? url : $"{url}&{query}";
    }

    private static StringContent Body(object? value) =>
        new(JsonSerializer.Serialize(value, Json), Encoding.UTF8, "application/json");

    private static JsonElement? Parse(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        using var document = JsonDocument.Parse(json);
        return document.RootElement.ValueKind == JsonValueKind.Null ? null : document.RootElement.Clone();
    }

    private static string ETagOf(HttpResponseMessage response) =>
        response.Headers.TryGetValues("ETag", out var values) ? values.FirstOrDefault() ?? string.Empty : string.Empty;

    private static CloudAccountException Refusal(HttpStatusCode status, string json) => status switch
    {
        HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden =>
            new CloudPermissionException("The server refused that. If it keeps happening, the server may still need the 3DS Bank 2.0 rules: talk to support."),
        HttpStatusCode.NotFound => new CloudAccountException("The Bank server address is wrong. Talk to support."),
        _ => new CloudAccountException($"The Bank server answered {(int)status}: {(json.Length > 120 ? json[..120] + "…" : json)}"),
    };

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
}
