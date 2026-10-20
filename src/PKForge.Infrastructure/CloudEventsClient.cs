using System.Text.Json;
using PKForge.Domain;

namespace PKForge.Infrastructure;

/// <summary>A player as the admin's list shows them.</summary>
public sealed record PlayerSummary(string Uid, string Username, int BankCount, int ShinyCount, long SinceUnixMs, long LastSeenUnixMs);

/// <summary>
/// 3DS Bank 2.5's online extras over the Realtime Database: the admin's view of every player,
/// the visits to the admin's Poképark (parkVisits/&lt;owner&gt;/&lt;id&gt;) and the Arena event
/// (arena/event, arena/results/&lt;event&gt;/&lt;uid&gt;). The database rules decide who may write
/// what: players their own visits and results, the admin everything.
/// </summary>
public sealed class CloudEventsClient(CloudAccountClient account)
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private FirebaseDatabase Db => account.Database;

    // ── Players (admin) ──────────────────────────────────────────────────────

    /// <summary>Every player with a profile, the most recently seen first.</summary>
    public async Task<IReadOnlyList<PlayerSummary>> GetPlayersAsync(CloudSession session, CancellationToken cancellationToken = default)
    {
        var profiles = await Db.GetAsync(session, "profiles", cancellationToken: cancellationToken).ConfigureAwait(false);
        var presence = await Db.GetAsync(session, "presence", cancellationToken: cancellationToken).ConfigureAwait(false);
        if (profiles is not { ValueKind: JsonValueKind.Object } all) return [];
        var seen = new Dictionary<string, long>(StringComparer.Ordinal);
        if (presence is { ValueKind: JsonValueKind.Object } stamps)
            foreach (var stamp in stamps.EnumerateObject())
                if (stamp.Value.ValueKind == JsonValueKind.Number && stamp.Value.TryGetInt64(out var ms)) seen[stamp.Name] = ms;
        return all.EnumerateObject()
            .Where(p => p.Value.ValueKind == JsonValueKind.Object)
            .Select(p => new PlayerSummary(p.Name, Text(p.Value, "username"), Int(p.Value, "bankCount"), Int(p.Value, "shinyCount"),
                Long(p.Value, "since"), seen.GetValueOrDefault(p.Name)))
            .Where(p => p.Username.Length > 0)
            .OrderByDescending(p => p.LastSeenUnixMs)
            .ThenBy(p => p.Username, StringComparer.Ordinal)
            .ToList();
    }

    // ── Poképark visits ──────────────────────────────────────────────────────

    /// <summary>Sends a Pokémon to the admin's Poképark (the owner's own write; it must be new).</summary>
    public Task SendVisitAsync(CloudSession session, ParkVisit visit, CancellationToken cancellationToken = default) =>
        Db.PutAsync(session, VisitPath(visit.OwnerUid, visit.Id), visit, cancellationToken);

    /// <summary>One visit, or null when it is not (or no longer) online.</summary>
    public async Task<ParkVisit?> GetVisitAsync(CloudSession session, string ownerUid, string visitId, CancellationToken cancellationToken = default) =>
        Read<ParkVisit>(await Db.GetAsync(session, VisitPath(ownerUid, visitId), cancellationToken: cancellationToken).ConfigureAwait(false));

    /// <summary>The signed-in player's visits.</summary>
    public async Task<IReadOnlyList<ParkVisit>> GetMyVisitsAsync(CloudSession session, CancellationToken cancellationToken = default) =>
        Visits(await Db.GetAsync(session, $"parkVisits/{session.UserId}", cancellationToken: cancellationToken).ConfigureAwait(false));

    /// <summary>Every visit of every player (admin).</summary>
    public async Task<IReadOnlyList<ParkVisit>> GetAllVisitsAsync(CloudSession session, CancellationToken cancellationToken = default)
    {
        var value = await Db.GetAsync(session, "parkVisits", cancellationToken: cancellationToken).ConfigureAwait(false);
        if (value is not { ValueKind: JsonValueKind.Object } owners) return [];
        return owners.EnumerateObject().SelectMany(owner => Visits(owner.Value)).OrderBy(visit => visit.SentUnixMs).ToList();
    }

    /// <summary>Writes a visit as it is now (admin: taken in, or sent back).</summary>
    public Task SaveVisitAsync(CloudSession session, ParkVisit visit, CancellationToken cancellationToken = default) =>
        Db.PutAsync(session, VisitPath(visit.OwnerUid, visit.Id), visit, cancellationToken);

    /// <summary>Crosses a visit off (the owner, once the Pokémon is back in their Bank).</summary>
    public Task RemoveVisitAsync(CloudSession session, string ownerUid, string visitId, CancellationToken cancellationToken = default) =>
        Db.DeleteAsync(session, VisitPath(ownerUid, visitId), cancellationToken);

    private static string VisitPath(string ownerUid, string visitId) => $"parkVisits/{ownerUid}/{visitId}";

    private static IReadOnlyList<ParkVisit> Visits(JsonElement? value) =>
        value is { ValueKind: JsonValueKind.Object } list
            ? list.EnumerateObject().Select(p => Read<ParkVisit>(p.Value)).OfType<ParkVisit>().ToList()
            : [];

    // ── The Arena ────────────────────────────────────────────────────────────

    /// <summary>The Arena event, or null when the admin never set one up.</summary>
    public async Task<ArenaEvent?> GetEventAsync(CloudSession session, CancellationToken cancellationToken = default)
    {
        var found = Read<ArenaEvent>(await Db.GetAsync(session, "arena/event", cancellationToken: cancellationToken).ConfigureAwait(false));
        // The database keeps no empty lists or empty texts: they come back missing.
        if (found?.Champion is null) return null;
        return found with
        {
            Title = found.Title ?? "Arena",
            Description = found.Description ?? "",
            ChampionName = found.ChampionName ?? CloudAccountClient.AdminUsername,
            Loaners = found.Loaners?.Where(mon => mon is not null).ToList() ?? [],
            Rewards = found.Rewards?.Where(reward => reward is not null).ToList() ?? [],
        };
    }

    /// <summary>Publishes (or changes) the Arena event (admin).</summary>
    public Task SaveEventAsync(CloudSession session, ArenaEvent arenaEvent, CancellationToken cancellationToken = default) =>
        Db.PutAsync(session, "arena/event", arenaEvent, cancellationToken);

    /// <summary>Everyone's record in an event, the best first.</summary>
    public async Task<IReadOnlyList<ArenaResult>> GetResultsAsync(CloudSession session, string eventId, CancellationToken cancellationToken = default)
    {
        var value = await Db.GetAsync(session, $"arena/results/{eventId}", cancellationToken: cancellationToken).ConfigureAwait(false);
        if (value is not { ValueKind: JsonValueKind.Object } all) return [];
        return all.EnumerateObject().Select(p => Read<ArenaResult>(p.Value)).OfType<ArenaResult>()
            .OrderByDescending(r => r.Wins).ThenByDescending(r => r.BestDamage).ThenBy(r => r.LastUnixMs).ToList();
    }

    /// <summary>Saves the signed-in player's record in an event.</summary>
    public Task SaveResultAsync(CloudSession session, string eventId, ArenaResult result, CancellationToken cancellationToken = default) =>
        Db.PutAsync(session, $"arena/results/{eventId}/{session.UserId}", result, cancellationToken);

    // ── Reading ──────────────────────────────────────────────────────────────

    private static T? Read<T>(JsonElement? value) where T : class
    {
        if (value is not { ValueKind: JsonValueKind.Object } element) return null;
        try { return element.Deserialize<T>(Json); }
        catch (Exception error) when (error is JsonException or NotSupportedException or ArgumentException) { return null; }
    }

    private static string Text(JsonElement value, string name) =>
        value.TryGetProperty(name, out var text) && text.ValueKind == JsonValueKind.String ? text.GetString() ?? "" : "";

    private static int Int(JsonElement value, string name) =>
        value.TryGetProperty(name, out var number) && number.ValueKind == JsonValueKind.Number && number.TryGetInt32(out var n) ? n : 0;

    private static long Long(JsonElement value, string name) =>
        value.TryGetProperty(name, out var number) && number.ValueKind == JsonValueKind.Number && number.TryGetInt64(out var n) ? n : 0;
}
