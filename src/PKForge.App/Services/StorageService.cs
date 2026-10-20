using PKForge.App.ViewModels;
using PKForge.Domain;
using PKForge.Engine;
using PKForge.Infrastructure;

namespace PKForge.App.Services;

/// <summary>A Storage action's result, in words.</summary>
public sealed record StorageOutcome(bool Success, string Message);

/// <summary>A game whose bag the Storage can reach: the connected save (<see cref="Save"/> is null) or another linked one.</summary>
public sealed record StorageGame(string Label, DetectedSave? Save);

/// <summary>
/// 3DS Bank 2.0's Storage: items kept with the Bank (storage.json in the Bank folder, so they
/// travel with the account), moved in and out of a game's bag, given to and taken from Bank
/// Pokémon, and the Shooting Star earned every 60 Pokémon. Every change to the Storage and the
/// Bank happens under the Bank's own lock, as one step.
/// </summary>
public sealed class StorageService
{
    private readonly ReloadableBankService _bank;
    private readonly ISaveEngine _engine;
    private readonly IGameDataService _data;
    private readonly IServiceProvider _services;
    private int _checking;

    public StorageService(ReloadableBankService bank, ISaveEngine engine, IGameDataService data, IServiceProvider services)
    {
        _bank = bank;
        _engine = engine;
        _data = data;
        _services = services;
        _bank.Changed += () => _ = Task.Run(CheckAchievement);
    }

    /// <summary>Raised (off the UI thread) with how many Shooting Stars were just earned.</summary>
    public event Action<int>? StarsEarned;

    /// <summary>The Storage as it is now.</summary>
    public StorageState Read() => _bank.Read((_, root) => Load(root));

    /// <summary>An item's name by national id.</summary>
    public string ItemName(int national) =>
        national > 0 && national < _data.ItemNames.Count && _data.ItemNames[national].Length > 0 ? _data.ItemNames[national] : $"Item #{national}";

    private static StorageState Load(string root) => BankSideFiles.Load<StorageState>(root, StorageState.FileName).Normalized();

    private static void Save(string root, StorageState state) => BankSideFiles.Save(root, StorageState.FileName, state);

    // ── Items that come back on a transfer ───────────────────────────────────

    /// <summary>
    /// Keeps the held items that came off Pokémon because their new game cannot have them.
    /// Returns the sentence to show, or null when nothing came back.
    /// </summary>
    public string? KeepReturned(IEnumerable<int> items)
    {
        var list = items.Where(item => item > 0).ToList();
        if (list.Count == 0) return null;
        var kept = new List<int>();
        var full = new List<int>();
        try
        {
            _bank.Change((_, root) =>
            {
                var state = Load(root);
                foreach (var item in list) (state.Add(item, 1) > 0 ? kept : full).Add(item);
                Save(root, state);
                return 0;
            });
        }
        catch (IOException error)
        {
            AppLog.Warn("storage", $"Keeping returned items: {error.Message}");
            return $"{Describe(list)} could not be kept in the Storage: {error.Message}";
        }
        var parts = new List<string>();
        if (kept.Count > 0) parts.Add($"{Describe(kept)} went back to your Storage.");
        if (full.Count > 0) parts.Add($"The Storage had no room for {Describe(full)} (999 at most).");
        return string.Join("\n", parts);
    }

    private string Describe(IEnumerable<int> items) => string.Join(", ", items.GroupBy(item => item)
        .Select(group => group.Count() > 1 ? $"{ItemName(group.Key)} ×{group.Count()}" : ItemName(group.Key)));

    // ── Held items of Bank Pokémon ───────────────────────────────────────────

    /// <summary>The national id of the item a Bank Pokémon holds (0 for none).</summary>
    public int HeldItemOf(BankEntry entry) =>
        _bank.Read((bank, _) => bank.GetAll().Any(e => e.Id == entry.Id) ? BankMonEdits.HeldItemOf(bank.GetData(entry.Id), entry.Info.Format) : 0);

    /// <summary>Whether the Pokémon can hold the item (null) or why not.</summary>
    public string? WhyCannotHold(BankEntry entry, int national)
    {
        var bytes = _bank.Read<byte[]?>((bank, _) => bank.GetAll().Any(e => e.Id == entry.Id) ? bank.GetData(entry.Id) : null);
        if (bytes is null) return "That Pokémon is no longer in the Bank.";
        if (EntityBytes.RomHackGame(entry.Info.Format) is { } hack) return $"Pokémon from {hack} keep their items in their own game.";
        var pk = EntityBytes.Parse(bytes, entry.Info.Format);
        return pk is null ? "This Pokémon's data could not be read." : HeldItemRules.WhyCannotHold(pk, national);
    }

    /// <summary>Gives a Bank Pokémon one item from the Storage; what it held before goes to the Storage.</summary>
    public StorageOutcome GiveItem(Guid entryId, int national) => Guard(() => _bank.Change((bank, root) =>
    {
        var entry = bank.GetAll().FirstOrDefault(e => e.Id == entryId);
        if (entry is null) return new StorageOutcome(false, "That Pokémon is no longer in the Bank.");
        var state = Load(root);
        if (state.CountOf(national) <= 0) return new StorageOutcome(false, $"The Storage has no {ItemName(national)} left.");
        var change = BankMonEdits.SetHeldItem(bank.GetData(entryId), entry.Info.Format, national, out var previous, out var refusal);
        if (change is null) return new StorageOutcome(false, refusal ?? "It cannot hold that.");
        state.Take(national, 1);
        if (previous > 0 && state.Add(previous, 1) == 0)
            return new StorageOutcome(false, $"The Storage has no room for the {ItemName(previous)} it holds now (999 at most).");
        Replace(bank, entry, change.Data, change.Format, BankFeature.HeldItem);
        Save(root, state);
        var name = entry.Info.Nickname;
        return new StorageOutcome(true, previous > 0
            ? $"{name} is holding {ItemName(national)} now. {ItemName(previous)} went to your Storage."
            : $"{name} is holding {ItemName(national)} now.");
    }));

    /// <summary>Takes a Bank Pokémon's item off and keeps it in the Storage.</summary>
    public StorageOutcome TakeItem(Guid entryId) => Guard(() => _bank.Change((bank, root) =>
    {
        var entry = bank.GetAll().FirstOrDefault(e => e.Id == entryId);
        if (entry is null) return new StorageOutcome(false, "That Pokémon is no longer in the Bank.");
        var change = BankMonEdits.SetHeldItem(bank.GetData(entryId), entry.Info.Format, 0, out var previous, out var refusal);
        if (change is null || previous <= 0) return new StorageOutcome(false, refusal ?? "It is not holding anything.");
        var state = Load(root);
        if (state.Add(previous, 1) == 0)
            return new StorageOutcome(false, $"The Storage has no room for more {ItemName(previous)} (999 at most).");
        Replace(bank, entry, change.Data, change.Format, BankFeature.HeldItem);
        Save(root, state);
        return new StorageOutcome(true, $"{ItemName(previous)} went from {entry.Info.Nickname} to your Storage.");
    }));

    // ── The Shooting Star ────────────────────────────────────────────────────

    /// <summary>What the Shooting Star would do to a Bank Pokémon, without changing anything yet.</summary>
    public (ShinyChange? Change, string? Refusal, string Hash) PreviewStar(Guid entryId)
    {
        var found = _bank.Read<(BankEntry Entry, byte[] Data)?>((bank, _) =>
        {
            var entry = bank.GetAll().FirstOrDefault(e => e.Id == entryId);
            if (entry is null) return null;
            return (entry, bank.GetData(entryId));
        });
        if (found is not { } mon) return (null, "That Pokémon is no longer in the Bank.", "");
        var change = BankMonEdits.MakeShiny(mon.Data, mon.Entry.Info.Format, out var refusal);
        return (change, refusal, BankCheckout.Sha256Hex(mon.Data));
    }

    /// <summary>Uses one Shooting Star: the previewed shiny Pokémon replaces the one in the Bank.</summary>
    public StorageOutcome ApplyStar(Guid entryId, ShinyChange change, string hash) => Guard(() => _bank.Change((bank, root) =>
    {
        var entry = bank.GetAll().FirstOrDefault(e => e.Id == entryId);
        if (entry is null) return new StorageOutcome(false, "That Pokémon is no longer in the Bank.");
        if (BankCheckout.Sha256Hex(bank.GetData(entryId)) != hash)
            return new StorageOutcome(false, "That Pokémon changed in the meantime. Try again.");
        var state = Load(root);
        if (!state.UseStar()) return new StorageOutcome(false, "You have no Shooting Star yet.");
        Replace(bank, entry, change.Data, change.Format, BankFeature.ShootingStar);
        Save(root, state);
        return new StorageOutcome(true, $"{entry.Info.Nickname} is shiny now!");
    }));

    /// <summary>
    /// Gives the Shooting Stars the Bank earned: one for every 60 Pokémon it held at once,
    /// counted once. Runs after every Bank change and when the app starts.
    /// </summary>
    public void CheckAchievement()
    {
        if (Interlocked.Exchange(ref _checking, 1) == 1) return;
        try
        {
            var (count, state) = _bank.Read((bank, root) => (bank.GetAll().Count, Load(root)));
            if (count <= state.MostPokemon && state.StarsEarned >= state.MostPokemon / StorageState.PokemonPerStar) return;
            var fresh = _bank.Change((bank, root) =>
            {
                var current = Load(root);
                var earned = current.AwardStars(bank.GetAll().Count);
                Save(root, current);
                return earned;
            });
            if (fresh > 0) StarsEarned?.Invoke(fresh);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or InvalidOperationException)
        {
            AppLog.Warn("storage", $"Star achievement: {error.Message}");
        }
        finally
        {
            Volatile.Write(ref _checking, 0);
        }
    }

    // ── The Arena's prizes (2.5) ─────────────────────────────────────────────

    /// <summary>Puts an Arena event's prizes in the Storage (items up to 999 each, Shooting Stars). Returns what went in.</summary>
    public string GiveArenaPrizes(IReadOnlyList<ArenaReward> rewards)
    {
        var given = new List<string>();
        _bank.Change((_, root) =>
        {
            var state = Load(root);
            foreach (var reward in rewards)
            {
                if (reward.Item > 0 && reward.Count > 0 && state.Add(reward.Item, reward.Count) > 0) given.Add(reward.Name);
                if (reward.Stars > 0)
                {
                    state.Stars += reward.Stars;
                    if (reward.Item <= 0) given.Add(reward.Name);
                }
            }
            Save(root, state);
            return 0;
        });
        return given.Count == 0 ? "Your Storage had no room for the prizes." : $"{string.Join(", ", given)} went to your Item Storage!";
    }

    // ── The toy machine (2.1) ────────────────────────────────────────────────

    /// <summary>
    /// Releases Bank Pokémon for good and gives one toy machine ticket for each, in one step
    /// with the Bank. Returns how many left the Bank and how many tickets were given.
    /// </summary>
    public (int Released, int Tickets) ReleaseForTickets(IReadOnlyList<Guid> ids) => _bank.Change((bank, root) =>
    {
        var released = bank.RemoveMany(ids);
        if (released <= 0) return (0, 0);
        var state = Load(root);
        var tickets = state.AddTickets(released);
        Save(root, state);
        return (released, tickets);
    });

    /// <summary>Turns the toy machine's handle with one ticket; the prize goes into the Storage.</summary>
    public ToyPlay PlayToyMachine() => _bank.Change((_, root) =>
    {
        var state = Load(root);
        var play = ToyMachine.Play(state, Random.Shared);
        if (play.Prize is not null) Save(root, state);
        return play;
    });

    /// <summary>A prize's name: the item's, or "???" for the secret one.</summary>
    public string PrizeName(ToyPrize prize) => prize.IsMystery ? MysteryName : ItemName(prize.Item);

    /// <summary>The secret prize's only name.</summary>
    public const string MysteryName = "???";

    // ── A game's bag ─────────────────────────────────────────────────────────

    /// <summary>The games whose bag the Storage can reach: the connected one first, then the other linked saves.</summary>
    public IReadOnlyList<StorageGame> Games()
    {
        var sessions = _services.GetService<ISaveSessionService>();
        var connected = sessions?.Current;
        var detected = _services.GetService<SavePickerViewModel>()?.Saves.ToArray() ?? [];
        var games = new List<StorageGame>();
        if (connected is not null && sessions?.CurrentSession is not null)
        {
            var name = detected.FirstOrDefault(s => s.DocumentId == connected.Document.DocumentId)?.GameLabel ?? connected.Document.DisplayName;
            games.Add(new StorageGame($"{name} (connected)", null));
        }
        foreach (var save in detected.Where(s => connected is null || s.DocumentId != connected.Document.DocumentId))
        {
            var label = save.GameLabel;
            if (!string.IsNullOrEmpty(save.TrainerName)) label += $" · {save.TrainerName}";
            if (detected.Count(other => other.GameLabel == save.GameLabel && other.TrainerName == save.TrainerName) > 1)
                label += $" · {save.FileName}";
            games.Add(new StorageGame(label, save));
        }
        return games;
    }

    /// <summary>The stacks of a game's bag that can move to the Storage.</summary>
    public async Task<IReadOnlyList<BagStack>> ReadBagAsync(StorageGame game)
    {
        if (game.Save is null)
        {
            var live = _services.GetService<ISaveSessionService>()?.CurrentSession;
            return live is null ? [] : StorageBag.Movable(live);
        }
        return await _services.GetRequiredService<TransferService>().ReadBagAsync(game.Save);
    }

    /// <summary>Moves up to <paramref name="count"/> of a bag stack into the Storage.</summary>
    public async Task<StorageOutcome> TakeFromBagAsync(StorageGame game, BagStack stack, int count)
    {
        var name = ItemName(stack.NationalId);
        var take = Math.Min(count, Read().RoomFor(stack.NationalId));
        if (take <= 0) return new StorageOutcome(false, $"The Storage has no room for more {name} (999 at most).");

        var moved = 0;
        string? refusal;
        try
        {
            refusal = await ChangeGameAsync(game, session =>
            {
                using (ThreeDsBankPolicy.Allow(BankFeature.BagItems))
                    moved = StorageBag.TakeOut(session, stack.Pouch, stack.NativeId, take);
                return moved > 0 ? null : "Those items are no longer in the bag.";
            }, $"{take} {name} moved to the 3DS Bank Storage");
        }
        catch (Exception error) when (error is IOException or InvalidOperationException or InvalidDataException or UnauthorizedAccessException)
        {
            refusal = error.Message;
        }
        if (refusal is not null) return new StorageOutcome(false, refusal);
        var kept = Guard(() => _bank.Change((_, root) =>
        {
            var state = Load(root);
            state.Add(stack.NationalId, moved);
            Save(root, state);
            return new StorageOutcome(true, "");
        }));
        return kept.Success
            ? new StorageOutcome(true, $"{name} ×{moved} moved from {game.Label} to your Storage.")
            : kept;
    }

    /// <summary>Moves up to <paramref name="count"/> of an item from the Storage into a game's bag.</summary>
    public async Task<StorageOutcome> PutInBagAsync(StorageGame game, int national, int count)
    {
        var name = ItemName(national);
        var reserved = Guard(() => _bank.Change((_, root) =>
        {
            var state = Load(root);
            if (!state.Take(national, count)) return new StorageOutcome(false, $"The Storage does not have {count} {name}.");
            Save(root, state);
            return new StorageOutcome(true, "");
        }));
        if (!reserved.Success) return reserved;
        // 3DS Bank 2.5: like Pokémon, items leave the Storage online before a game gets them.
        if (_services.GetService<CloudBankSync>() is { } sync && await sync.CommitAsync() is { } offline)
        {
            Guard(() => _bank.Change((_, root) =>
            {
                var state = Load(root);
                state.Add(national, count);
                Save(root, state);
                return new StorageOutcome(true, "");
            }));
            return new StorageOutcome(false, offline.Replace("Taking Pokémon out of the Bank", "Taking items out of the Storage", StringComparison.Ordinal));
        }

        var added = 0;
        string? refusal;
        try
        {
            refusal = await ChangeGameAsync(game, session =>
            {
                string? why;
                using (ThreeDsBankPolicy.Allow(BankFeature.BagItems))
                {
                    added = StorageBag.PutIn(session, national, count, out why);
                }
                return added > 0 ? null : why ?? "That game's bag cannot take it.";
            }, $"{count} {name} arrived from the 3DS Bank Storage");
        }
        catch (Exception error) when (error is IOException or InvalidOperationException or InvalidDataException or UnauthorizedAccessException)
        {
            refusal = error.Message;
        }
        if (refusal is not null) added = 0; // nothing was written
        var back = count - added;
        if (back > 0)
            Guard(() => _bank.Change((_, root) =>
            {
                var state = Load(root);
                state.Add(national, back);
                Save(root, state);
                return new StorageOutcome(true, "");
            }));
        if (added == 0) return new StorageOutcome(false, refusal ?? $"{name} could not go to {game.Label}.");
        return new StorageOutcome(true, back > 0
            ? $"{name} ×{added} moved to {game.Label}'s bag. The rest stayed in the Storage."
            : $"{name} ×{added} moved to {game.Label}'s bag.");
    }

    /// <summary>Runs a change on the chosen game: the connected one through its live session, another through a fresh copy.</summary>
    private async Task<string?> ChangeGameAsync(StorageGame game, Func<ISaveEngineSession, string?> change, string description)
    {
        if (game.Save is not null)
            return await _services.GetRequiredService<TransferService>().ChangeGameAsync(game.Save, change, description);
        var box = _services.GetRequiredService<BoxBrowserViewModel>();
        var ok = await box.RunMutationAsync(session => change(session) is { } refusal
                ? new GenerationOutcome(false, refusal)
                : new GenerationOutcome(true, description),
            0, refreshSlot: false, changeDescription: description, action: SaveAction.Move);
        return ok ? null : box.Status;
    }

    private void Replace(IBankService bank, BankEntry entry, byte[] data, string format, BankFeature feature)
    {
        var info = _engine.TryDescribeEntity(data, entry.Info.SourceName, format) ?? entry.Info;
        using (ThreeDsBankPolicy.Allow(feature))
            bank.Replace(entry.Id, data, info);
    }

    private static StorageOutcome Guard(Func<StorageOutcome> work)
    {
        try
        {
            return work();
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or InvalidOperationException)
        {
            AppLog.Warn("storage", error.Message);
            return new StorageOutcome(false, $"The Storage could not be changed: {error.Message}");
        }
    }
}
