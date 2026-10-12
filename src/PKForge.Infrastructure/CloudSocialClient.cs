using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using PKForge.Domain;

namespace PKForge.Infrastructure;

/// <summary>
/// 3DS Bank 2.0's online side over the Realtime Database: who is in the app right now
/// (presence/&lt;uid&gt;), public profiles (profiles/&lt;uid&gt;), friend requests and friends,
/// and online trades (trades/&lt;id&gt; with an invitation in tradeInvites/&lt;friend&gt;). The
/// database rules let each player write only their own parts.
/// </summary>
public sealed class CloudSocialClient(CloudAccountClient account)
{
    private const int SearchLimit = 12;

    private FirebaseDatabase Db => account.Database;

    // ── Presence ─────────────────────────────────────────────────────────────

    /// <summary>Marks the player as in the app now; returns the server's clock (ms) for comparing presence stamps.</summary>
    public async Task<long> HeartbeatAsync(CloudSession session, CancellationToken cancellationToken = default)
    {
        var stored = await Db.PutAsync(session, $"presence/{session.UserId}", FirebaseDatabase.ServerTime, cancellationToken).ConfigureAwait(false);
        return stored is { ValueKind: JsonValueKind.Number } stamp && stamp.TryGetInt64(out var ms)
            ? ms : DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    /// <summary>Marks the player as away (the app went to the background or signed out).</summary>
    public Task SetAwayAsync(CloudSession session, CancellationToken cancellationToken = default) =>
        Db.PutAsync(session, $"presence/{session.UserId}", 0, cancellationToken);

    /// <summary>When a player was last in the app (server ms), 0 when never or away.</summary>
    public async Task<long> LastSeenAsync(CloudSession session, string uid, CancellationToken cancellationToken = default) =>
        Long(await Db.GetAsync(session, $"presence/{uid}", cancellationToken: cancellationToken).ConfigureAwait(false));

    // ── Profiles and usernames ───────────────────────────────────────────────

    /// <summary>A player's profile, or null when they never made one.</summary>
    public async Task<PlayerProfile?> GetProfileAsync(CloudSession session, string uid, CancellationToken cancellationToken = default)
    {
        var value = await Db.GetAsync(session, $"profiles/{uid}", cancellationToken: cancellationToken).ConfigureAwait(false);
        return value is { ValueKind: JsonValueKind.Object } profile ? ReadProfile(uid, profile) : null;
    }

    /// <summary>Saves the player's own profile (everything but the username, which the account claims).</summary>
    public Task SaveProfileAsync(CloudSession session, PlayerProfile profile, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(profile);
        var values = new Dictionary<string, object?>
        {
            ["displayName"] = Clip(profile.DisplayName, PlayerProfile.MaxDisplayName),
            ["bio"] = Clip(profile.Bio, PlayerProfile.MaxBio),
            ["favoriteSpecies"] = profile.FavoriteSpecies,
            ["favoriteForm"] = profile.FavoriteForm,
            ["favoriteShiny"] = profile.FavoriteShiny,
            ["favoriteNickname"] = Clip(profile.FavoriteNickname, 24),
            ["favoriteGame"] = Clip(profile.FavoriteGame, PlayerProfile.MaxGame),
            ["bankCount"] = profile.BankCount,
            ["shinyCount"] = profile.ShinyCount,
            ["starsEarned"] = profile.StarsEarned,
        };
        if (profile.SinceUnixMs <= 0) values["since"] = FirebaseDatabase.ServerTime;
        return Db.PatchAsync(session, $"profiles/{session.UserId}", values, cancellationToken);
    }

    /// <summary>Updates only the Bank numbers of the player's profile (sent after the Bank changes).</summary>
    public Task SaveBankNumbersAsync(CloudSession session, int bankCount, int shinyCount, int starsEarned, CancellationToken cancellationToken = default) =>
        Db.PatchAsync(session, $"profiles/{session.UserId}", new Dictionary<string, object?>
        {
            ["bankCount"] = bankCount,
            ["shinyCount"] = shinyCount,
            ["starsEarned"] = starsEarned,
        }, cancellationToken);

    /// <summary>The user id behind a username, or null when nobody has it.</summary>
    public async Task<string?> FindAsync(CloudSession session, string username, CancellationToken cancellationToken = default)
    {
        if (CloudAccountClient.NormalizeUsername(username) is not { } name) return null;
        var value = await Db.GetAsync(session, $"usernames/{FirebaseDatabase.Key(name)}", cancellationToken: cancellationToken).ConfigureAwait(false);
        return value is { ValueKind: JsonValueKind.String } uid ? uid.GetString() : null;
    }

    /// <summary>Usernames starting with <paramref name="prefix"/> (at most a dozen), with their user ids.</summary>
    public async Task<IReadOnlyList<(string Username, string Uid)>> SearchAsync(CloudSession session, string prefix, CancellationToken cancellationToken = default)
    {
        var start = (prefix ?? "").Trim().ToLowerInvariant();
        if (start.Length == 0 || start.Length > 20 || start.Any(c => !(char.IsAsciiLetterLower(c) || char.IsAsciiDigit(c) || c is '.' or '_')))
            return [];
        var key = FirebaseDatabase.Key(start);
        var query = "orderBy=" + Uri.EscapeDataString("\"$key\"")
            + "&startAt=" + Uri.EscapeDataString($"\"{key}\"")
            + "&endAt=" + Uri.EscapeDataString($"\"{key}\"")
            + "&limitToFirst=" + SearchLimit.ToString(CultureInfo.InvariantCulture);
        var value = await Db.GetAsync(session, "usernames", query, cancellationToken).ConfigureAwait(false);
        if (value is not { ValueKind: JsonValueKind.Object } found) return [];
        return found.EnumerateObject()
            .Where(p => p.Value.ValueKind == JsonValueKind.String)
            .Select(p => (Username: FirebaseDatabase.Unkey(p.Name), Uid: p.Value.GetString() ?? ""))
            .Where(p => p.Uid.Length > 0)
            .OrderBy(p => p.Username, StringComparer.Ordinal)
            .ToList();
    }

    // ── Friends ──────────────────────────────────────────────────────────────

    /// <summary>The player's friends with their usernames.</summary>
    public async Task<IReadOnlyList<(string Uid, string Username)>> GetFriendsAsync(CloudSession session, CancellationToken cancellationToken = default)
    {
        var value = await Db.GetAsync(session, $"friends/{session.UserId}", cancellationToken: cancellationToken).ConfigureAwait(false);
        if (value is not { ValueKind: JsonValueKind.Object } friends) return [];
        return friends.EnumerateObject()
            .Select(p => (Uid: p.Name, Username: Text(p.Value, "username")))
            .OrderBy(p => p.Username, StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>Friend requests waiting for the player's answer.</summary>
    public async Task<IReadOnlyList<FriendRequest>> GetRequestsAsync(CloudSession session, CancellationToken cancellationToken = default)
    {
        var value = await Db.GetAsync(session, $"friendRequests/{session.UserId}", cancellationToken: cancellationToken).ConfigureAwait(false);
        if (value is not { ValueKind: JsonValueKind.Object } requests) return [];
        return requests.EnumerateObject()
            .Select(p => new FriendRequest(p.Name, Text(p.Value, "username"), Long(p.Value, "sent")))
            .OrderByDescending(r => r.SentUnixMs)
            .ToList();
    }

    /// <summary>
    /// Asks <paramref name="toUid"/> to be friends. When they already asked the player, this
    /// accepts their request instead. Returns true when the two are friends now.
    /// </summary>
    public async Task<bool> SendRequestAsync(CloudSession session, string toUid, CancellationToken cancellationToken = default)
    {
        var mine = await GetRequestsAsync(session, cancellationToken).ConfigureAwait(false);
        if (mine.FirstOrDefault(r => r.FromUid == toUid) is { } theirs)
        {
            await AcceptAsync(session, theirs, cancellationToken).ConfigureAwait(false);
            return true;
        }
        await Db.PutAsync(session, $"friendRequests/{toUid}/{session.UserId}", new Dictionary<string, object?>
        {
            ["username"] = session.Username,
            ["sent"] = FirebaseDatabase.ServerTime,
        }, cancellationToken).ConfigureAwait(false);
        return false;
    }

    /// <summary>Accepts a friend request: both lists get each other, and the request goes away.</summary>
    public Task AcceptAsync(CloudSession session, FriendRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        return Db.PatchAsync(session, "", new Dictionary<string, object?>
        {
            [$"friends/{session.UserId}/{request.FromUid}"] = new Dictionary<string, object?> { ["username"] = request.FromUsername, ["since"] = FirebaseDatabase.ServerTime },
            [$"friends/{request.FromUid}/{session.UserId}"] = new Dictionary<string, object?> { ["username"] = session.Username, ["since"] = FirebaseDatabase.ServerTime },
            [$"friendRequests/{session.UserId}/{request.FromUid}"] = null,
        }, cancellationToken);
    }

    /// <summary>Turns a friend request down.</summary>
    public Task DeclineAsync(CloudSession session, string fromUid, CancellationToken cancellationToken = default) =>
        Db.DeleteAsync(session, $"friendRequests/{session.UserId}/{fromUid}", cancellationToken);

    /// <summary>Stops being friends, on both sides.</summary>
    public Task RemoveFriendAsync(CloudSession session, string uid, CancellationToken cancellationToken = default) =>
        Db.PatchAsync(session, "", new Dictionary<string, object?>
        {
            [$"friends/{session.UserId}/{uid}"] = null,
            [$"friends/{uid}/{session.UserId}"] = null,
        }, cancellationToken);

    // ── Trades ───────────────────────────────────────────────────────────────

    /// <summary>Opens a trade with a friend and sends them the invitation; returns the trade id.</summary>
    public async Task<string> CreateTradeAsync(CloudSession session, string friendUid, string friendName, CancellationToken cancellationToken = default)
    {
        var id = NewTradeId();
        await Db.PutAsync(session, $"trades/{id}", new Dictionary<string, object?>
        {
            ["a"] = session.UserId,
            ["b"] = friendUid,
            ["names"] = new Dictionary<string, object?> { [session.UserId] = session.Username, [friendUid] = friendName },
            ["state"] = TradeRecord.Open,
            ["created"] = FirebaseDatabase.ServerTime,
        }, cancellationToken).ConfigureAwait(false);
        await Db.PutAsync(session, $"userTrades/{session.UserId}/{id}", true, cancellationToken).ConfigureAwait(false);
        await Db.PutAsync(session, $"tradeInvites/{friendUid}/{id}", new Dictionary<string, object?>
        {
            ["from"] = session.UserId,
            ["fromName"] = session.Username,
            ["created"] = FirebaseDatabase.ServerTime,
        }, cancellationToken).ConfigureAwait(false);
        return id;
    }

    /// <summary>Trade invitations waiting for the player.</summary>
    public async Task<IReadOnlyList<TradeInvite>> GetInvitesAsync(CloudSession session, CancellationToken cancellationToken = default)
    {
        var value = await Db.GetAsync(session, $"tradeInvites/{session.UserId}", cancellationToken: cancellationToken).ConfigureAwait(false);
        if (value is not { ValueKind: JsonValueKind.Object } invites) return [];
        return invites.EnumerateObject()
            .Select(p => new TradeInvite(p.Name, Text(p.Value, "from"), Text(p.Value, "fromName"), Long(p.Value, "created")))
            .OrderByDescending(i => i.CreatedUnixMs)
            .ToList();
    }

    /// <summary>Joins a trade from its invitation (the invitation goes away).</summary>
    public async Task JoinAsync(CloudSession session, string tradeId, CancellationToken cancellationToken = default)
    {
        await Db.PutAsync(session, $"userTrades/{session.UserId}/{tradeId}", true, cancellationToken).ConfigureAwait(false);
        await Db.DeleteAsync(session, $"tradeInvites/{session.UserId}/{tradeId}", cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Throws an invitation away (the trade itself is called off separately).</summary>
    public Task DropInviteAsync(CloudSession session, string ownerUid, string tradeId, CancellationToken cancellationToken = default) =>
        Db.DeleteAsync(session, $"tradeInvites/{ownerUid}/{tradeId}", cancellationToken);

    /// <summary>The trade as the server holds it now, or null when it does not exist (or is not the player's).</summary>
    public async Task<TradeRecord?> GetTradeAsync(CloudSession session, string tradeId, CancellationToken cancellationToken = default)
    {
        var value = await Db.GetAsync(session, $"trades/{tradeId}", cancellationToken: cancellationToken).ConfigureAwait(false);
        return value is { ValueKind: JsonValueKind.Object } trade ? ReadTrade(tradeId, trade) : null;
    }

    /// <summary>Puts up (or withdraws, with null) the player's Pokémon; only while nobody has confirmed.</summary>
    public Task SetOfferAsync(CloudSession session, string tradeId, TradeOffer? offer, CancellationToken cancellationToken = default)
    {
        var path = $"trades/{tradeId}/offers/{session.UserId}";
        if (offer is null) return Db.DeleteAsync(session, path, cancellationToken);
        return Db.PutAsync(session, path, new Dictionary<string, object?>
        {
            ["data"] = offer.Data,
            ["format"] = offer.Format,
            ["species"] = offer.Species,
            ["form"] = offer.Form,
            ["shiny"] = offer.Shiny,
            ["nickname"] = offer.Nickname,
            ["level"] = offer.Level,
            ["item"] = offer.HeldItem,
            ["generation"] = offer.Generation,
        }, cancellationToken);
    }

    /// <summary>The player's final yes. It cannot be taken back; the trade can still be called off until both said yes.</summary>
    public Task ConfirmAsync(CloudSession session, string tradeId, CancellationToken cancellationToken = default) =>
        Db.PutAsync(session, $"trades/{tradeId}/confirm/{session.UserId}", true, cancellationToken);

    /// <summary>
    /// Moves an open trade to <paramref name="state"/> (sealed or called off) by compare-and-set,
    /// so the two players can never end up with different answers. Returns the state the trade
    /// has afterwards, whoever set it.
    /// </summary>
    public async Task<string> SettleAsync(CloudSession session, string tradeId, string state, CancellationToken cancellationToken = default)
    {
        var path = $"trades/{tradeId}/state";
        for (var attempt = 0; attempt < 4; attempt++)
        {
            var (current, etag) = await Db.GetWithETagAsync(session, path, cancellationToken).ConfigureAwait(false);
            var now = current is { ValueKind: JsonValueKind.String } text ? text.GetString() ?? "" : "";
            if (now != TradeRecord.Open || etag.Length == 0) return now;
            try
            {
                if (await Db.PutIfMatchAsync(session, path, state, etag, cancellationToken).ConfigureAwait(false))
                    return state;
            }
            catch (CloudPermissionException)
            {
                // The rules refuse a change once the trade left "open": read what it became.
            }
        }
        var final = await Db.GetAsync(session, path, cancellationToken: cancellationToken).ConfigureAwait(false);
        return final is { ValueKind: JsonValueKind.String } settled ? settled.GetString() ?? "" : "";
    }

    /// <summary>Marks the player's side of a sealed trade as done (their Bank took the Pokémon).</summary>
    public Task MarkDoneAsync(CloudSession session, string tradeId, CancellationToken cancellationToken = default) =>
        Db.PutAsync(session, $"trades/{tradeId}/done/{session.UserId}", true, cancellationToken);

    /// <summary>Trades the player joined that may still need finishing.</summary>
    public async Task<IReadOnlyList<string>> GetMyTradesAsync(CloudSession session, CancellationToken cancellationToken = default)
    {
        var value = await Db.GetAsync(session, $"userTrades/{session.UserId}", cancellationToken: cancellationToken).ConfigureAwait(false);
        return value is { ValueKind: JsonValueKind.Object } trades ? trades.EnumerateObject().Select(p => p.Name).ToList() : [];
    }

    /// <summary>Forgets a finished trade in the player's list.</summary>
    public Task ForgetTradeAsync(CloudSession session, string tradeId, CancellationToken cancellationToken = default) =>
        Db.DeleteAsync(session, $"userTrades/{session.UserId}/{tradeId}", cancellationToken);

    // ── Reading ──────────────────────────────────────────────────────────────

    /// <summary>Time-ordered and unguessable: the creation time plus random bits, as a database key.</summary>
    internal static string NewTradeId() =>
        DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString("x", CultureInfo.InvariantCulture)
        + Convert.ToHexString(RandomNumberGenerator.GetBytes(6)).ToLowerInvariant();

    internal static TradeRecord ReadTrade(string id, JsonElement trade)
    {
        var names = new Dictionary<string, string>(StringComparer.Ordinal);
        if (trade.TryGetProperty("names", out var nameList) && nameList.ValueKind == JsonValueKind.Object)
            foreach (var p in nameList.EnumerateObject())
                if (p.Value.ValueKind == JsonValueKind.String) names[p.Name] = p.Value.GetString() ?? "";
        var offers = new Dictionary<string, TradeOffer>(StringComparer.Ordinal);
        if (trade.TryGetProperty("offers", out var offerList) && offerList.ValueKind == JsonValueKind.Object)
            foreach (var p in offerList.EnumerateObject())
                if (ReadOffer(p.Value) is { } offer) offers[p.Name] = offer;
        return new TradeRecord(id, Text(trade, "a"), Text(trade, "b"), names, Text(trade, "state"), Long(trade, "created"),
            offers, Flags(trade, "confirm"), Flags(trade, "done"));
    }

    private static TradeOffer? ReadOffer(JsonElement offer)
    {
        if (offer.ValueKind != JsonValueKind.Object) return null;
        var data = Text(offer, "data");
        if (data.Length == 0) return null;
        var format = Text(offer, "format");
        return new TradeOffer(data, format.Length == 0 ? null : format, Int(offer, "species"), Int(offer, "form"), Bool(offer, "shiny"),
            Text(offer, "nickname"), Int(offer, "level"), Int(offer, "item"), Int(offer, "generation"));
    }

    private static PlayerProfile ReadProfile(string uid, JsonElement profile) => new(
        uid,
        Text(profile, "username"),
        Text(profile, "displayName"),
        Text(profile, "bio"),
        Int(profile, "favoriteSpecies"),
        Int(profile, "favoriteForm"),
        Bool(profile, "favoriteShiny"),
        Text(profile, "favoriteNickname"),
        Text(profile, "favoriteGame"),
        Int(profile, "bankCount"),
        Int(profile, "shinyCount"),
        Int(profile, "starsEarned"),
        Long(profile, "since"));

    private static HashSet<string> Flags(JsonElement trade, string name)
    {
        var set = new HashSet<string>(StringComparer.Ordinal);
        if (trade.TryGetProperty(name, out var flags) && flags.ValueKind == JsonValueKind.Object)
            foreach (var p in flags.EnumerateObject())
                if (p.Value.ValueKind == JsonValueKind.True) set.Add(p.Name);
        return set;
    }

    private static string Text(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? "" : "";

    private static int Int(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value)
        && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number) ? number : 0;

    private static long Long(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) ? Long(value) : 0;

    private static long Long(JsonElement? value) =>
        value is { ValueKind: JsonValueKind.Number } number && number.TryGetInt64(out var ms) ? ms : 0;

    private static bool Bool(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.True;

    private static string Clip(string? text, int max)
    {
        var trimmed = (text ?? "").Trim();
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }
}
