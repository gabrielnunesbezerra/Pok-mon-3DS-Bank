using PKForge.Domain;
using PKForge.Engine;
using PKForge.Infrastructure;

namespace PKForge.App.Services;

/// <summary>What one step of an online trade found: the trade, this player's view of it, and
/// a sentence when something happened (the trade went through or was called off).</summary>
public sealed record TradeStep(TradeRecord? Trade, TradeView? View, string? Message, bool Received = false);

/// <summary>
/// 3DS Bank 2.0's friends and online trades. While the app is in front it tells the server
/// the player is here (every 30 seconds) and looks for trade invitations (every 10 seconds).
/// A trade runs like the games' own: both pick a Pokémon, both confirm, and only then does
/// each Bank take the other's Pokémon. A confirmed Pokémon is held aside (trades.json in the
/// Bank folder) until the trade is sealed or called off, so it is never in two places and
/// never lost; a trade cut short by a closed app is finished the next time the app opens.
/// </summary>
public sealed class SocialService
{
    private static readonly TimeSpan Tick = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan InviteLifetime = TimeSpan.FromMinutes(10);

    private readonly AccountService _account;
    private readonly CloudSocialClient _cloud;
    private readonly ReloadableBankService _bank;
    private readonly ISaveEngine _engine;
    private readonly StorageService _storage;
    private readonly CloudBankSync _sync;
    private readonly SemaphoreSlim _tradeGate = new(1, 1);
    private readonly HashSet<string> _seenInvites = new(StringComparer.Ordinal);
    private CancellationTokenSource? _loop;
    private long _serverOffsetMs;
    private volatile bool _foreground = true;

    public SocialService(AccountService account, CloudSocialClient cloud, ReloadableBankService bank, ISaveEngine engine, StorageService storage,
        CloudBankSync sync)
    {
        _sync = sync;
        _account = account;
        _cloud = cloud;
        _bank = bank;
        _engine = engine;
        _storage = storage;
        App.Suspended += () =>
        {
            _foreground = false;
            _ = AwayAsync();
        };
        App.Resumed += () =>
        {
            _foreground = true;
            _ = BeatAsync(CancellationToken.None);
        };
    }

    /// <summary>Raised (off the UI thread) when a friend invites the player to trade.</summary>
    public event Action<TradeInvite>? InviteArrived;

    /// <summary>The last problem talking to the server, or null.</summary>
    public string? LastError { get; private set; }

    /// <summary>The server's clock now (milliseconds since 1970), as far as this phone can tell.</summary>
    public long ServerNow => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + Interlocked.Read(ref _serverOffsetMs);

    /// <summary>The signed-in player's user id.</summary>
    public string? MyUid => _account.UserId;

    /// <summary>The signed-in player's username.</summary>
    public string? MyUsername => _account.Username;

    // ── The background loop ──────────────────────────────────────────────────

    /// <summary>Starts presence and invitations for the signed-in player (app start, after sign-in).</summary>
    public void Start()
    {
        if (!_account.IsSignedIn) return;
        _loop?.Cancel();
        _loop = new CancellationTokenSource();
        var token = _loop.Token;
        _ = Task.Run(async () =>
        {
            await SetUpAsync(token);
            var tick = 0;
            while (!token.IsCancellationRequested)
            {
                if (_foreground)
                {
                    if (tick % 3 == 0) await BeatAsync(token);
                    await PollInvitesAsync(token);
                    // 3DS Bank 2.5: Pokémon coming back from the admin's Poképark, about once a minute.
                    if (tick % 6 == 5) await SettleParkAsync(token);
                }
                tick++;
                try { await Task.Delay(Tick, token); }
                catch (OperationCanceledException) { return; }
            }
        }, token);
    }

    /// <summary>Stops the loop and tells the server the player left (signing out).</summary>
    public async Task StopAsync()
    {
        _loop?.Cancel();
        _loop = null;
        _seenInvites.Clear();
        await AwayAsync();
    }

    private async Task SetUpAsync(CancellationToken token)
    {
        await Safely(async () => await _account.EnsureUsernameAsync(token));
        await Safely(async () => await EnsureProfileAsync(token));
        await Safely(async () => await RecoverTradesAsync(token));
        await SettleParkAsync(token);
        _storage.CheckAchievement();
        await Safely(async () => await PublishNumbersAsync(token));
    }

    private async Task SettleParkAsync(CancellationToken token) => await Safely(async () =>
    {
        if (IPlatformApplication.Current?.Services.GetService<ParkVisitService>() is { } visits)
            await visits.SettleAsync(token);
    });

    private async Task BeatAsync(CancellationToken token) => await Safely(async () =>
    {
        if (!_account.IsSignedIn) return;
        var session = await _account.GetFreshSessionAsync(token);
        Calibrate(await _cloud.HeartbeatAsync(session, token));
    });

    private async Task AwayAsync() => await Safely(async () =>
    {
        if (!_account.IsSignedIn) return;
        var session = await _account.GetFreshSessionAsync();
        await _cloud.SetAwayAsync(session);
    });

    private void Calibrate(long serverNow) =>
        Interlocked.Exchange(ref _serverOffsetMs, serverNow - DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());

    private async Task PollInvitesAsync(CancellationToken token) => await Safely(async () =>
    {
        if (!_account.IsSignedIn) return;
        var session = await _account.GetFreshSessionAsync(token);
        foreach (var invite in await _cloud.GetInvitesAsync(session, token))
        {
            if (ServerNow - invite.CreatedUnixMs > InviteLifetime.TotalMilliseconds)
            {
                await _cloud.DropInviteAsync(session, session.UserId, invite.TradeId, token);
                continue;
            }
            if (_seenInvites.Add(invite.TradeId)) InviteArrived?.Invoke(invite);
        }
    });

    private async Task Safely(Func<Task> work)
    {
        try
        {
            await work();
            LastError = null;
        }
        catch (OperationCanceledException)
        {
            // Stopping.
        }
        catch (CloudAccountException error)
        {
            LastError = error.Message;
            AppLog.Warn("social", error.Message);
        }
        catch (Exception error) when (error is IOException or InvalidOperationException or FormatException)
        {
            LastError = error.Message;
            AppLog.Warn("social", error.ToString());
        }
    }

    // ── Profile ──────────────────────────────────────────────────────────────

    /// <summary>A player's profile (the signed-in player's own when <paramref name="uid"/> is null).</summary>
    public async Task<PlayerProfile?> GetProfileAsync(string? uid = null, CancellationToken token = default)
    {
        var session = await _account.GetFreshSessionAsync(token);
        return await _cloud.GetProfileAsync(session, uid ?? session.UserId, token);
    }

    /// <summary>Saves the signed-in player's profile.</summary>
    public async Task SaveProfileAsync(PlayerProfile profile, CancellationToken token = default)
    {
        var session = await _account.GetFreshSessionAsync(token);
        var (count, shiny, stars) = Numbers();
        await _cloud.SaveProfileAsync(session, profile with { BankCount = count, ShinyCount = shiny, StarsEarned = stars }, token);
    }

    private async Task EnsureProfileAsync(CancellationToken token)
    {
        var session = await _account.GetFreshSessionAsync(token);
        var profile = await _cloud.GetProfileAsync(session, session.UserId, token);
        if (profile is { SinceUnixMs: > 0 }) return;
        var (count, shiny, stars) = Numbers();
        await _cloud.SaveProfileAsync(session, new PlayerProfile(session.UserId, session.Username, profile?.DisplayName ?? "",
            profile?.Bio ?? "", profile?.FavoriteSpecies ?? 0, profile?.FavoriteForm ?? 0, profile?.FavoriteShiny ?? false,
            profile?.FavoriteNickname ?? "", profile?.FavoriteGame ?? "", count, shiny, stars, 0), token);
    }

    /// <summary>Sends the Bank's numbers (Pokémon, shinies, stars) to the profile friends see.</summary>
    public async Task PublishNumbersAsync(CancellationToken token = default)
    {
        var session = await _account.GetFreshSessionAsync(token);
        var (count, shiny, stars) = Numbers();
        await _cloud.SaveBankNumbersAsync(session, count, shiny, stars, token);
    }

    private (int Count, int Shiny, int Stars) Numbers()
    {
        var entries = _bank.GetAll();
        return (entries.Count, entries.Count(e => e.Info.Shiny), _storage.Read().StarsEarned);
    }

    // ── Friends ──────────────────────────────────────────────────────────────

    /// <summary>The player's friends, the ones in the app right now first.</summary>
    public async Task<IReadOnlyList<FriendEntry>> GetFriendsAsync(CancellationToken token = default)
    {
        var session = await _account.GetFreshSessionAsync(token);
        var now = await _cloud.HeartbeatAsync(session, token);
        Calibrate(now);
        var friends = await _cloud.GetFriendsAsync(session, token);
        var seen = await Task.WhenAll(friends.Select(async friend =>
        {
            try { return await _cloud.LastSeenAsync(session, friend.Uid, token); }
            catch (CloudAccountException) { return 0L; }
        }));
        return friends
            .Select((friend, i) => new FriendEntry(friend.Uid, friend.Username, seen[i], TradeRules.IsOnline(seen[i], now)))
            .OrderByDescending(friend => friend.Online)
            .ThenBy(friend => friend.Username, StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>Whether a friend is in the app right now.</summary>
    public async Task<bool> IsOnlineAsync(string uid, CancellationToken token = default)
    {
        var session = await _account.GetFreshSessionAsync(token);
        return TradeRules.IsOnline(await _cloud.LastSeenAsync(session, uid, token), ServerNow);
    }

    public async Task<IReadOnlyList<FriendRequest>> GetRequestsAsync(CancellationToken token = default) =>
        await _cloud.GetRequestsAsync(await _account.GetFreshSessionAsync(token), token);

    public async Task<IReadOnlyList<(string Username, string Uid)>> SearchAsync(string prefix, CancellationToken token = default) =>
        await _cloud.SearchAsync(await _account.GetFreshSessionAsync(token), prefix, token);

    /// <summary>Sends a friend request; true when the two are friends right away (they had asked first).</summary>
    public async Task<bool> SendRequestAsync(string uid, CancellationToken token = default)
    {
        var session = await _account.GetFreshSessionAsync(token);
        if (uid == session.UserId) throw new CloudAccountException("That is you!");
        return await _cloud.SendRequestAsync(session, uid, token);
    }

    public async Task AcceptAsync(FriendRequest request, CancellationToken token = default) =>
        await _cloud.AcceptAsync(await _account.GetFreshSessionAsync(token), request, token);

    public async Task DeclineAsync(FriendRequest request, CancellationToken token = default) =>
        await _cloud.DeclineAsync(await _account.GetFreshSessionAsync(token), request.FromUid, token);

    public async Task RemoveFriendAsync(string uid, CancellationToken token = default) =>
        await _cloud.RemoveFriendAsync(await _account.GetFreshSessionAsync(token), uid, token);

    // ── Trades: starting ─────────────────────────────────────────────────────

    /// <summary>Opens a trade with a friend who is in the app now and invites them; returns the trade id.</summary>
    public async Task<string> StartTradeAsync(FriendEntry friend, CancellationToken token = default)
    {
        var session = await _account.GetFreshSessionAsync(token);
        Calibrate(await _cloud.HeartbeatAsync(session, token));
        if (!TradeRules.IsOnline(await _cloud.LastSeenAsync(session, friend.Uid, token), ServerNow))
            throw new CloudAccountException($"{friend.Username} is not in the app right now. Both players need to be online to trade.");
        return await _cloud.CreateTradeAsync(session, friend.Uid, friend.Username, token);
    }

    /// <summary>Accepts a trade invitation.</summary>
    public async Task JoinTradeAsync(TradeInvite invite, CancellationToken token = default) =>
        await _cloud.JoinAsync(await _account.GetFreshSessionAsync(token), invite.TradeId, token);

    /// <summary>Turns a trade invitation down (the trade is called off).</summary>
    public async Task DeclineTradeAsync(TradeInvite invite, CancellationToken token = default)
    {
        var session = await _account.GetFreshSessionAsync(token);
        await _cloud.SettleAsync(session, invite.TradeId, TradeRecord.Cancelled, token);
        await _cloud.DropInviteAsync(session, session.UserId, invite.TradeId, token);
    }

    // ── Trades: during ───────────────────────────────────────────────────────

    /// <summary>Puts a Bank Pokémon up in the trade (or takes the offer back with null).</summary>
    public async Task SetOfferAsync(string tradeId, BankEntry? entry, CancellationToken token = default)
    {
        var session = await _account.GetFreshSessionAsync(token);
        if (entry is null)
        {
            await _cloud.SetOfferAsync(session, tradeId, null, token);
            return;
        }
        if (EntityBytes.RomHackGame(entry.Info.Format) is { } hack)
            throw new CloudAccountException($"Pokémon from {hack} can only live in their own game, so they cannot be traded.");
        var data = _bank.GetData(entry.Id);
        var offer = new TradeOffer(Convert.ToBase64String(data), entry.Info.Format, entry.Info.Species, entry.Info.Form, entry.Info.Shiny,
            entry.Info.Nickname, entry.Info.Level, BankMonEdits.HeldItemOf(data, entry.Info.Format), entry.Info.Generation);
        await _cloud.SetOfferAsync(session, tradeId, offer, token);
    }

    /// <summary>
    /// The player's final yes: their Pokémon is held aside (it leaves the Bank's boxes) and the
    /// confirmation goes to the server. It comes back if the trade is called off.
    /// </summary>
    public async Task ConfirmAsync(string tradeId, TradeOffer expectedTheirs, CancellationToken token = default)
    {
        ArgumentNullException.ThrowIfNull(expectedTheirs);
        await _tradeGate.WaitAsync(token);
        try
        {
            var session = await _account.GetFreshSessionAsync(token);
            var trade = await _cloud.GetTradeAsync(session, tradeId, token)
                ?? throw new CloudAccountException("This trade no longer exists.");
            var me = session.UserId;
            var view = TradeRules.View(trade, me);
            if (!view.CanConfirm || view.Mine is null || view.Theirs is null)
                throw new CloudAccountException("Both players need to pick a Pokémon first.");
            if (view.Theirs.Data != expectedTheirs.Data)
                throw new CloudAccountException($"{trade.NameOf(trade.PartnerOf(me))} changed the Pokémon. Look again before confirming.");
            if (Describe(view.Theirs, trade.NameOf(trade.PartnerOf(me))) is null)
                throw new CloudAccountException($"{view.Theirs.Nickname} cannot be kept in your Bank, so this trade cannot happen.");

            var mineData = view.Mine.Data;
            var hash = BankCheckout.Sha256Hex(Convert.FromBase64String(mineData));
            var partner = trade.PartnerOf(me);
            var partnerName = trade.NameOf(partner);
            var held = _bank.Change((bank, root) =>
            {
                var ledger = BankSideFiles.Load<TradeLedger>(root, TradeLedger.FileName);
                if (ledger.Escrow.ContainsKey(tradeId)) return true;
                var entry = bank.GetAll().FirstOrDefault(e => BankCheckout.Sha256Hex(bank.GetData(e.Id)) == hash);
                if (entry is null) return false;
                // The ledger first: a Pokémon is never out of the boxes without a record of it.
                ledger.Escrow[tradeId] = new TradeEscrow(mineData, entry.Info, entry.Box, entry.Slot, partner, partnerName,
                    DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
                BankSideFiles.Save(root, TradeLedger.FileName, ledger);
                try
                {
                    bank.Remove(entry.Id);
                }
                catch
                {
                    ledger.Escrow.Remove(tradeId);
                    BankSideFiles.Save(root, TradeLedger.FileName, ledger);
                    throw;
                }
                return true;
            });
            if (!held) throw new CloudAccountException("The Pokémon you offered is no longer in your Bank. Pick it again.");

            // 3DS Bank 2.5: the account learns the Pokémon left the boxes before the server hears
            // our "yes", so wiping the app can never bring back a Pokémon that is on its way out.
            if (await _sync.CommitAsync(token) is { } offline)
            {
                RestoreEscrow(tradeId);
                throw new CloudAccountException(offline);
            }

            try
            {
                await _cloud.ConfirmAsync(session, tradeId, view.Theirs, token);
            }
            catch (CloudAccountException)
            {
                // Only give it back when the server surely has no "yes" from us.
                var now = await TryGetTradeAsync(session, tradeId, token);
                if (now is not null && !now.HasConfirmed(me)) RestoreEscrow(tradeId);
                throw;
            }
        }
        finally
        {
            _tradeGate.Release();
        }
    }

    /// <summary>Calls the trade off (possible until both confirmed). Returns how it ended.</summary>
    public async Task<TradeStep> CancelAsync(string tradeId, CancellationToken token = default)
    {
        var session = await _account.GetFreshSessionAsync(token);
        await _cloud.SettleAsync(session, tradeId, TradeRecord.Cancelled, token);
        return await AdvanceAsync(tradeId, token);
    }

    /// <summary>
    /// Moves the trade on from this player's side: seals it when both confirmed, takes the
    /// other player's Pokémon (evolving it when the trade makes it evolve) once sealed, and gives
    /// the held-aside Pokémon back when it was called off.
    /// </summary>
    public async Task<TradeStep> AdvanceAsync(string tradeId, CancellationToken token = default)
    {
        await _tradeGate.WaitAsync(token);
        try
        {
            var session = await _account.GetFreshSessionAsync(token);
            var me = session.UserId;
            var trade = await _cloud.GetTradeAsync(session, tradeId, token);
            if (trade is null || !trade.Includes(me))
                return new TradeStep(null, null, "This trade no longer exists.");
            if (TradeRules.ReadyToSeal(trade))
            {
                var state = await _cloud.SettleAsync(session, tradeId, TradeRecord.Committed, token);
                trade = await _cloud.GetTradeAsync(session, tradeId, token) ?? trade with { State = state };
            }

            string? message = null;
            var received = false;
            var ledger = _bank.Read((_, root) => BankSideFiles.Load<TradeLedger>(root, TradeLedger.FileName));
            if (trade.State == TradeRecord.Committed)
            {
                if (!ledger.Applied.Contains(tradeId))
                {
                    message = Apply(trade, me, session.Username);
                    received = true;
                    await Safely(async () => await PublishNumbersAsync(token));
                }
                // The new Pokémon is in the account before the trade is crossed off, so a phone
                // wiped in between gets it again from the trade, and only once.
                if (await _sync.CommitAsync(token) is not null)
                    return new TradeStep(trade, TradeRules.View(trade, me), message ?? "The trade went through. Your Bank is saved online as soon as the internet is back.", received);
                if (!trade.Done.Contains(me))
                {
                    await _cloud.MarkDoneAsync(session, tradeId, token);
                    trade = trade with { Done = new HashSet<string>(trade.Done) { me } };
                }
                await Safely(async () => await _cloud.ForgetTradeAsync(session, tradeId, token));
            }
            else if (trade.State == TradeRecord.Cancelled)
            {
                message = RestoreEscrow(tradeId)
                    ? "The trade was called off. Your Pokémon is back in your Bank."
                    : "The trade was called off.";
                await Safely(async () => await _cloud.ForgetTradeAsync(session, tradeId, token));
            }
            else if (ledger.Escrow.ContainsKey(tradeId) && !trade.HasConfirmed(me))
            {
                // Our "yes" never reached the server: the Pokémon goes back to the boxes.
                RestoreEscrow(tradeId);
            }
            return new TradeStep(trade, TradeRules.View(trade, me), message, received);
        }
        finally
        {
            _tradeGate.Release();
        }
    }

    /// <summary>
    /// Finishes every trade this account left halfway (app closed, phone offline): sealed ones
    /// bring their Pokémon in, called-off ones give the held-aside Pokémon back, and an open
    /// trade the other player abandoned for 30 minutes is called off.
    /// </summary>
    public async Task RecoverTradesAsync(CancellationToken token = default)
    {
        var session = await _account.GetFreshSessionAsync(token);
        var ids = new HashSet<string>(await _cloud.GetMyTradesAsync(session, token), StringComparer.Ordinal);
        var ledger = _bank.Read((_, root) => BankSideFiles.Load<TradeLedger>(root, TradeLedger.FileName));
        ids.UnionWith(ledger.Escrow.Keys);
        foreach (var id in ids)
        {
            var step = await AdvanceAsync(id, token);
            if (step.Trade is { State: TradeRecord.Open } open
                && ServerNow - open.CreatedUnixMs > TradeRules.Stale.TotalMilliseconds)
                await CancelAsync(id, token);
            else if (step.Trade is null && ledger.Escrow.ContainsKey(id))
                RestoreEscrow(id); // the trade is gone from the server: nothing can have been sent
        }
    }

    private async Task<TradeRecord?> TryGetTradeAsync(CloudSession session, string tradeId, CancellationToken token)
    {
        try { return await _cloud.GetTradeAsync(session, tradeId, token); }
        catch (CloudAccountException) { return null; }
    }

    /// <summary>Takes the other player's Pokémon into the Bank (where ours was), evolved if the trade evolves it.</summary>
    private string Apply(TradeRecord trade, string me, string myName)
    {
        var partner = trade.PartnerOf(me);
        var theirs = trade.Offers[partner];
        var mine = trade.Offers.GetValueOrDefault(me);
        var partnerName = trade.NameOf(partner);
        var bytes = Convert.FromBase64String(theirs.Data);
        TradeEvolution? evolution = null;
        try
        {
            evolution = BankMonEdits.TradeEvolve(_engine, bytes, theirs.Format, mine?.Species ?? 0, myName);
        }
        catch (Exception error) when (error is InvalidOperationException or ArgumentException or IndexOutOfRangeException)
        {
            AppLog.Warn("trade", $"Trade evolution: {error.Message}");
        }
        var data = evolution?.Data ?? bytes;
        var format = evolution?.Format ?? theirs.Format;
        var info = _engine.TryDescribeEntity(data, $"Trade with {partnerName}", format)
            ?? Describe(theirs, partnerName)
            ?? new BankEntryInfo(theirs.Species, theirs.Form, theirs.Shiny, theirs.Nickname, theirs.Level, theirs.Generation,
                $"Trade with {partnerName}", theirs.Format);

        var applied = _bank.Change((bank, root) =>
        {
            var ledger = BankSideFiles.Load<TradeLedger>(root, TradeLedger.FileName);
            if (ledger.Applied.Contains(trade.Id)) return false;
            ledger.Escrow.Remove(trade.Id, out var escrow);
            var slotFree = escrow is not null && !bank.GetAll().Any(e => e.Box == escrow.Box && e.Slot == escrow.Slot);
            var deposit = slotFree ? new BankDeposit(data, info, escrow!.Box, escrow.Slot) : new BankDeposit(data, info);
            // The ledger first: a trade marked applied is never applied twice.
            ledger.MarkApplied(trade.Id);
            BankSideFiles.Save(root, TradeLedger.FileName, ledger);
            try
            {
                bank.AddMany([deposit]);
            }
            catch
            {
                ledger.Applied.Remove(trade.Id);
                if (escrow is not null) ledger.Escrow[trade.Id] = escrow;
                BankSideFiles.Save(root, TradeLedger.FileName, ledger);
                throw;
            }
            return true;
        });
        var lines = new List<string>(3);
        if (applied && mine is not null) lines.Add($"{mine.Nickname} went to {partnerName}.");
        lines.Add($"You received {theirs.Nickname} from {partnerName}!");
        if (applied && evolution is not null) lines.Add(evolution.Message);
        return string.Join("\n", lines);
    }

    /// <summary>Puts a held-aside Pokémon back in the Bank (its old slot when free). False when there was none.</summary>
    private bool RestoreEscrow(string tradeId)
    {
        try
        {
            return _bank.Change((bank, root) =>
            {
                var ledger = BankSideFiles.Load<TradeLedger>(root, TradeLedger.FileName);
                if (!ledger.Escrow.Remove(tradeId, out var escrow)) return false;
                var data = Convert.FromBase64String(escrow.Data);
                var slotFree = !bank.GetAll().Any(e => e.Box == escrow.Box && e.Slot == escrow.Slot);
                // The ledger first: a Pokémon given back is never given back twice.
                BankSideFiles.Save(root, TradeLedger.FileName, ledger);
                try
                {
                    bank.AddMany([slotFree ? new BankDeposit(data, escrow.Info, escrow.Box, escrow.Slot) : new BankDeposit(data, escrow.Info)]);
                }
                catch
                {
                    ledger.Escrow[tradeId] = escrow;
                    BankSideFiles.Save(root, TradeLedger.FileName, ledger);
                    throw;
                }
                return true;
            });
        }
        catch (Exception error) when (error is IOException or InvalidOperationException or FormatException)
        {
            AppLog.Warn("trade", $"Giving back the Pokémon of trade {tradeId}: {error.Message}");
            return false;
        }
    }

    /// <summary>How an offered Pokémon would be kept in this Bank, or null when it cannot be.</summary>
    private BankEntryInfo? Describe(TradeOffer offer, string partnerName)
    {
        try
        {
            return _engine.TryDescribeEntity(Convert.FromBase64String(offer.Data), $"Trade with {partnerName}", offer.Format);
        }
        catch (FormatException)
        {
            return null;
        }
    }

    /// <summary>The Pokémon of an offer as raw bytes, for the summary screen.</summary>
    public static byte[]? OfferBytes(TradeOffer offer)
    {
        try { return Convert.FromBase64String(offer.Data); }
        catch (FormatException) { return null; }
    }
}
