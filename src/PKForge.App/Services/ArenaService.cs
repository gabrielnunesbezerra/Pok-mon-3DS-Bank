using PKForge.Domain;
using PKForge.Engine;
using PKForge.Infrastructure;

namespace PKForge.App.Services;

/// <summary>
/// 3DS Bank 2.5's Arena event: the admin publishes it with Pokémon from their Bank (the
/// Champion and the ones players fight with) and its prizes; players fight the Champion and
/// their record goes online for the leaderboard. A win (only possible with the aura off)
/// sends the prizes to the winner's Item Storage, once.
/// </summary>
public sealed class ArenaService(AccountService account, CloudEventsClient cloud, IGameDataService data, StorageService storage)
{
    /// <summary>The event as it is online now, or null when there is none.</summary>
    public async Task<ArenaEvent?> GetEventAsync(CancellationToken token = default) =>
        await cloud.GetEventAsync(await account.GetFreshSessionAsync(token), token);

    /// <summary>The leaderboard of an event.</summary>
    public async Task<IReadOnlyList<ArenaResult>> GetResultsAsync(string eventId, CancellationToken token = default) =>
        await cloud.GetResultsAsync(await account.GetFreshSessionAsync(token), eventId, token);

    /// <summary>The admin publishes or changes the event.</summary>
    public async Task PublishAsync(ArenaEvent arenaEvent, CancellationToken token = default)
    {
        var session = await account.GetFreshSessionAsync(token);
        if (!session.IsAdmin) throw new CloudAccountException("Only the admin runs the Arena.");
        await cloud.SaveEventAsync(session, arenaEvent, token);
    }

    /// <summary>A Pokémon of the event as a fighter; null when it cannot be read.</summary>
    public ArenaFighterSpec? Fighter(ArenaMon mon)
    {
        try { return ArenaFighters.Build(mon.Bytes, mon.Format.Length > 0 ? mon.Format : null, data.MoveNames); }
        catch (FormatException) { return null; }
    }

    /// <summary>Records a battle in the player's line of the leaderboard; returns the line.</summary>
    public async Task<ArenaResult> RecordAsync(ArenaEvent arenaEvent, bool won, int damagePercent, CancellationToken token = default)
    {
        var session = await account.GetFreshSessionAsync(token);
        var mine = (await cloud.GetResultsAsync(session, arenaEvent.Id, token)).FirstOrDefault(r => r.Uid == session.UserId)
            ?? new ArenaResult(session.UserId, session.Username, 0, 0, 0, 0, false);
        var result = mine with
        {
            Username = session.Username,
            Battles = mine.Battles + 1,
            Wins = mine.Wins + (won ? 1 : 0),
            BestDamage = Math.Max(mine.BestDamage, Math.Clamp(damagePercent, 0, 100)),
            LastUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        };
        await cloud.SaveResultAsync(session, arenaEvent.Id, result, token);
        return result;
    }

    /// <summary>Gives the prizes of a won event to the Item Storage, once per event. Returns what was given, or null.</summary>
    public async Task<string?> ClaimAsync(ArenaEvent arenaEvent, ArenaResult result, CancellationToken token = default)
    {
        if (result.Wins <= 0 || result.Claimed) return null;
        var given = storage.GiveArenaPrizes(arenaEvent.Rewards);
        var session = await account.GetFreshSessionAsync(token);
        await cloud.SaveResultAsync(session, arenaEvent.Id, result with { Claimed = true }, token);
        return given;
    }
}
