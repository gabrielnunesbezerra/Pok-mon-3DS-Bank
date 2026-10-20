using System.Globalization;
using Microsoft.Maui.Controls.Shapes;
using PKForge.App.Services;
using PKForge.App.Theme;
using PKForge.Domain;
using PKForge.Infrastructure;

namespace PKForge.App.Views;

/// <summary>
/// 3DS Bank 2.5's admin screen, only for the admin account: every player and their Bank (with
/// its duplicated Pokémon and the trips a closed app left halfway), a duplicate search across
/// every Bank, the visitors of the Poképark, and the Arena event.
/// </summary>
public sealed class AdminPage : ContentPage, IPadHandler, IOverlayHost
{
    private enum Tab { Players, Duplicates, Park, Arena }

    private readonly AdminService _admin;
    private readonly ParkVisitService _visits;
    private readonly ArenaService _arena;
    private readonly ReloadableBankService _bank;
    private readonly Grid _host;
    private readonly VerticalStackLayout _body;
    private readonly Label _status;
    private readonly Dictionary<Tab, Border> _tabs = [];
    private Tab _tab = Tab.Players;
    private AdminBank? _open;
    private bool _busy;

    public AdminPage(AdminService admin, ParkVisitService visits, ArenaService arena, ReloadableBankService bank)
    {
        _admin = admin;
        _visits = visits;
        _arena = arena;
        _bank = bank;
        Title = "Admin";
        BackgroundColor = UiTokens.Housing;
        NavigationPage.SetHasNavigationBar(this, false);

        var back = Kit.IconButton("back", () => _ = Navigation.PopAsync());
        var header = Kit.HeaderBar("Admin");
        header.VerticalOptions = LayoutOptions.Center;
        var titleRow = new Grid
        {
            ColumnSpacing = 10,
            ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Star)],
            Children = { back, header },
        };
        Grid.SetColumn(header, 1);

        var tabs = new HorizontalStackLayout { Spacing = 8 };
        foreach (var (tab, label) in new[] { (Tab.Players, "Players"), (Tab.Duplicates, "Duplicates"), (Tab.Park, "Poképark"), (Tab.Arena, "Arena") })
        {
            var chip = Kit.Tab(label, tab == _tab);
            chip.Padding = new Thickness(14, 6);
            var tap = new TapGestureRecognizer();
            tap.Tapped += (_, _) => _ = Run(() => ShowTabAsync(tab));
            chip.GestureRecognizers.Add(tap);
            _tabs[tab] = chip;
            tabs.Children.Add(chip);
        }

        _status = Small();
        _status.TextColor = UiTokens.Ink0;
        _body = new VerticalStackLayout { Spacing = 8 };
        var content = new Grid
        {
            Padding = new Thickness(14, 10),
            RowSpacing = 10,
            RowDefinitions = [new(GridLength.Auto), new(GridLength.Auto), new(GridLength.Auto), new(GridLength.Star)],
            Children = { titleRow, new ScrollView { Orientation = ScrollOrientation.Horizontal, Content = tabs }, _status, new ScrollView { Content = _body } },
        };
        Grid.SetRow((View)content.Children[1], 1);
        Grid.SetRow(_status, 2);
        Grid.SetRow((View)content.Children[3], 3);
        var root = new Grid
        {
            SafeAreaEdges = SafeAreaEdges.None,
            RowDefinitions = [new(GridLength.Auto), new(GridLength.Star)],
            Children = { DsChrome.TitleBar(), DsChrome.FullBleed(new Grid { Children = { DsChrome.GridBackground(), content } }) },
        };
        Grid.SetRow((View)root.Children[1], 1);
        _host = DsChrome.FullBleed(new Grid { Children = { root } });
        Content = _host;
    }

    public Grid OverlayHost => _host;

    protected override void OnAppearing()
    {
        base.OnAppearing();
        IPlatformApplication.Current?.Services.GetService<GamepadRouter>()?.Push(this);
        if (!_admin.IsAdmin)
        {
            _ = Navigation.PopAsync();
            return;
        }
        _ = Run(() => ShowTabAsync(_tab));
        GlobalPrompts.Flush(this);
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();
        IPlatformApplication.Current?.Services.GetService<GamepadRouter>()?.Remove(this);
    }

    public bool OnPadButton(PadButton button)
    {
        switch (button)
        {
            case PadButton.B:
                if (_open is not null) _ = Run(() => ShowTabAsync(Tab.Players));
                else _ = Navigation.PopAsync();
                return true;
            case PadButton.L: _ = Run(() => ShowTabAsync((Tab)(((int)_tab + 3) % 4))); return true;
            case PadButton.R: _ = Run(() => ShowTabAsync((Tab)(((int)_tab + 1) % 4))); return true;
            default: return false;
        }
    }

    private async Task Run(Func<Task> action)
    {
        if (_busy) return;
        _busy = true;
        try
        {
            await action();
        }
        catch (CloudAccountException error)
        {
            _status.Text = error.Message;
            await PadMenu.ShowAsync(_host, "Admin", error.Message, "OK");
        }
        catch (Exception error) when (error is IOException or InvalidOperationException or HttpRequestException or InvalidDataException)
        {
            AppLog.Warn("admin", error.ToString());
            _status.Text = error.Message;
        }
        finally
        {
            _busy = false;
        }
    }

    private async Task ShowTabAsync(Tab tab)
    {
        _tab = tab;
        foreach (var (key, chip) in _tabs) Kit.SetTab(chip, key == tab);
        _open?.Dispose();
        _open = null;
        _body.Children.Clear();
        _status.Text = "Loading…";
        switch (tab)
        {
            case Tab.Players: await ShowPlayersAsync(); break;
            case Tab.Duplicates: ShowDuplicateSearch(); break;
            case Tab.Park: await ShowParkAsync(); break;
            case Tab.Arena: await ShowArenaAsync(); break;
        }
    }

    // ── Players ──────────────────────────────────────────────────────────────

    private async Task ShowPlayersAsync()
    {
        var players = await _admin.PlayersAsync();
        _body.Children.Clear();
        _status.Text = $"{players.Count} players. Tap one to open their Bank.";
        foreach (var player in players)
        {
            var online = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - player.LastSeenUnixMs < 90_000;
            _body.Children.Add(Row(null, $"@{player.Username}",
                $"{player.BankCount} Pokémon · {player.ShinyCount} shiny · {(online ? "in the app now" : Ago(player.LastSeenUnixMs))}",
                () => _ = Run(() => OpenPlayerAsync(player)), online ? UiTokens.Green : null));
        }
    }

    private async Task OpenPlayerAsync(PlayerSummary player)
    {
        _status.Text = $"Opening @{player.Username}'s Bank…";
        var bank = await _admin.OpenAsync(player);
        if (bank is null)
        {
            _status.Text = $"@{player.Username} has no Bank online yet.";
            return;
        }
        _open?.Dispose();
        _open = bank;
        await ShowOpenBankAsync();
    }

    private async Task ShowOpenBankAsync()
    {
        if (_open is not { } bank) return;
        var holdings = await Task.Run(() => AdminService.Holdings(bank));
        var groups = DuplicateFinder.Find(holdings);
        var extra = DuplicateFinder.ExtraCopies(groups, bank.Player.Uid);
        var entries = bank.Entries;
        _body.Children.Clear();
        _status.Text = $"@{bank.Player.Username} · {entries.Count} Pokémon · {entries.Count(e => e.Info.Shiny)} shiny · "
            + $"{bank.Storage.Stars} Shooting Stars · {bank.TradeHolds} in trades";

        var backButton = Kit.Capsule("All players", UiTokens.Ink1, icon: "back");
        backButton.HorizontalOptions = LayoutOptions.Start;
        backButton.Clicked += (_, _) => _ = Run(() => ShowTabAsync(Tab.Players));
        _body.Children.Add(backButton);

        if (extra.Count > 0)
        {
            var clean = Kit.Capsule($"Remove the {extra.Count} extra copies", UiTokens.RedOrange, primary: true, icon: "delete");
            clean.HorizontalOptions = LayoutOptions.Start;
            clean.Clicked += (_, _) => _ = Run(async () =>
            {
                if (!await PadMenu.ConfirmAsync(_host, "Remove the copies?",
                        $"Every Pokémon @{bank.Player.Username} has more than once keeps one copy; the other {extra.Count} leave their Bank for good.", "Remove"))
                    return;
                await Report(await _admin.RemoveAsync(bank, extra));
                await ShowOpenBankAsync();
            });
            _body.Children.Add(clean);
        }

        _body.Children.Add(Section(groups.Count == 0 ? "No duplicated Pokémon" : $"Duplicated Pokémon · {groups.Count}"));
        foreach (var group in groups)
        {
            var mine = group.Copies.Where(copy => copy.OwnerUid == bank.Player.Uid).ToList();
            _body.Children.Add(Row(group.Info.Look, Name(group.Info) + $" ×{mine.Count}",
                group.Exact ? "Exact copies: the same Pokémon more than once." : "Suspect: same trainer, IVs and gender, changed later (shiny, evolved...).",
                () => _ = Run(() => GroupMenuAsync(bank, mine)), group.Exact ? UiTokens.RedOrange : UiTokens.Yellow));
        }

        var trips = bank.Trips;
        if (trips.Count > 0)
        {
            _body.Children.Add(Section($"Stuck on the way out · {trips.Count}"));
            foreach (var (id, trip) in trips)
            {
                var names = string.Join(", ", trip.Mons.Select(mon => mon.Info.Nickname));
                _body.Children.Add(Row(trip.Mons.FirstOrDefault()?.Info.Look, names, $"To {trip.Destination} · {Ago(trip.CreatedUnixMs)}",
                    () => _ = Run(async () =>
                    {
                        if (trip.Destination == ParkVisitService.Destination)
                        {
                            // The player's own app sends it (or finds it sent) the next time it opens.
                            await Report($"{names} is on its way to your Poképark. That trip ends on its own when @{bank.Player.Username} opens the app.");
                            return;
                        }
                        if (!await PadMenu.ConfirmAsync(_host, "Give them back?",
                                $"{names} left @{bank.Player.Username}'s boxes for {trip.Destination} and the trip never ended (the app closed). " +
                                "Check they did not arrive there, then put them back in the boxes.", "Give back"))
                            return;
                        await Report(await _admin.ReturnTripAsync(bank, id));
                        await ShowOpenBankAsync();
                    })));
            }
        }

        _body.Children.Add(Section($"Every Pokémon · {entries.Count}"));
        foreach (var entry in entries.OrderBy(e => e.Box).ThenBy(e => e.Slot))
            _body.Children.Add(Row(entry.Info.Look, Name(entry.Info),
                $"Lv {entry.Info.Level} · Box {entry.Box + 1:00} slot {entry.Slot + 1:00} · {entry.Info.SourceName}",
                () => _ = Run(() => EntryMenuAsync(bank, entry))));
    }

    private async Task GroupMenuAsync(AdminBank bank, IReadOnlyList<BankHolding> copies)
    {
        if (copies.Count == 0) return;
        var options = new List<PadOption>();
        if (copies.Count > 1) options.Add(new PadOption($"Keep one, remove {copies.Count - 1}", IconPath: "delete"));
        options.Add(new PadOption("Remove every copy", IconPath: "release"));
        options.Add(new PadOption("Close", IconPath: "close"));
        var choice = await PadMenu.ShowAsync(_host, Name(copies[0].Info), $"@{bank.Player.Username} has it {copies.Count} times.", [.. options]);
        IReadOnlyList<Guid> ids = choice switch
        {
            "Remove every copy" => copies.Select(c => c.EntryId).ToList(),
            null or "Close" => [],
            _ => copies.Skip(1).Select(c => c.EntryId).ToList(),
        };
        if (ids.Count == 0) return;
        await Report(await _admin.RemoveAsync(bank, ids));
        await ShowOpenBankAsync();
    }

    private async Task EntryMenuAsync(AdminBank bank, BankEntry entry)
    {
        var choice = await PadMenu.ShowAsync(_host, Name(entry.Info),
            $"Lv {entry.Info.Level} · Gen {entry.Info.Generation} · from {entry.Info.SourceName} · since {entry.AddedUtc:yyyy-MM-dd}",
            new PadOption("Remove from this Bank", IconPath: "release", Detail: "It leaves the player's Bank for good."),
            new PadOption("Close", IconPath: "close"));
        if (choice != "Remove from this Bank") return;
        if (!await PadMenu.ConfirmAsync(_host, "Remove it?", $"{entry.Info.Nickname} leaves @{bank.Player.Username}'s Bank for good.", "Remove")) return;
        await Report(await _admin.RemoveAsync(bank, [entry.Id]));
        await ShowOpenBankAsync();
    }

    // ── Duplicates everywhere ────────────────────────────────────────────────

    private void ShowDuplicateSearch()
    {
        _status.Text = "Finds Pokémon that are in more than one Bank (a duplicated Pokémon given to friends) or twice in one.";
        var search = Kit.Capsule("Search every Bank", UiTokens.Green, primary: true, icon: "search");
        search.HorizontalOptions = LayoutOptions.Start;
        search.Clicked += (_, _) => _ = Run(SearchEverywhereAsync);
        _body.Children.Add(search);
    }

    private async Task SearchEverywhereAsync()
    {
        var overlay = LoadingOverlay.Show(_host, "Searching…", "Reading every Bank.");
        IReadOnlyList<DuplicateGroup> groups;
        int banks;
        try
        {
            (groups, banks) = await _admin.SearchEverywhereAsync((done, total) => overlay.Report(done, total), overlay.Cancellation.Token);
        }
        catch (OperationCanceledException)
        {
            _status.Text = "Search cancelled.";
            return;
        }
        finally
        {
            overlay.Close();
        }
        _body.Children.Clear();
        ShowDuplicateSearch();
        _status.Text = $"{banks} Banks read · {groups.Count(g => g.Exact)} Pokémon copied for sure · {groups.Count(g => !g.Exact)} suspects.";
        foreach (var group in groups)
        {
            var holders = string.Join(", ", group.Holders.Select(h => h.Count > 1 ? $"@{h.OwnerName} ×{h.Count}" : $"@{h.OwnerName}"));
            _body.Children.Add(Row(group.Info.Look, Name(group.Info), $"{(group.Exact ? "Copied" : "Suspect")} · {holders}",
                () => _ = Run(() => OpenHolderAsync(group)), group.Exact ? UiTokens.RedOrange : UiTokens.Yellow));
        }
    }

    private async Task OpenHolderAsync(DuplicateGroup group)
    {
        var holders = group.Copies.GroupBy(c => c.OwnerUid).Select(g => g.First()).ToList();
        var choice = await PadMenu.ShowAsync(_host, Name(group.Info), "Open whose Bank?",
            [.. holders.Select(h => new PadOption($"@{h.OwnerName}", IconPath: "bank")), new PadOption("Close", IconPath: "close")]);
        var holder = holders.FirstOrDefault(h => $"@{h.OwnerName}" == choice);
        if (holder is null) return;
        _tab = Tab.Players;
        foreach (var (key, chip) in _tabs) Kit.SetTab(chip, key == Tab.Players);
        await OpenPlayerAsync(new PlayerSummary(holder.OwnerUid, holder.OwnerName, 0, 0, 0, 0));
    }

    // ── Poképark visitors ────────────────────────────────────────────────────

    private async Task ShowParkAsync()
    {
        var visits = await _visits.GetAllAsync();
        var guests = _visits.Guests();
        _body.Children.Clear();
        var waiting = visits.Where(v => v.State == ParkVisitState.Sent).ToList();
        var caring = visits.Where(v => v.State == ParkVisitState.Caring).ToList();
        var home = visits.Where(v => v.State == ParkVisitState.Returned).ToList();
        _status.Text = $"{waiting.Count} waiting at the gate · {caring.Count} in your Poképark · {home.Count} on the way home.";

        _body.Children.Add(Section($"At the gate · {waiting.Count}"));
        foreach (var visit in waiting)
            _body.Children.Add(Row(new SpriteLook(visit.Species, visit.Form, visit.Shiny), VisitName(visit), $"From @{visit.OwnerName} · {Ago(visit.SentUnixMs)}",
                () => _ = Run(() => GateMenuAsync(visit)), UiTokens.Green));

        _body.Children.Add(Section($"In your Poképark · {caring.Count}"));
        foreach (var visit in caring)
            _body.Children.Add(Row(new SpriteLook(visit.Species, visit.Form, visit.Shiny), VisitName(visit),
                $"@{visit.OwnerName}'s · {(guests.ContainsKey(visit.Id) ? "in your Bank" : "not in your Bank")} · since {Ago(visit.SentUnixMs)}",
                () => _ = Run(() => SendHomeAsync(visit))));

        if (home.Count > 0)
        {
            _body.Children.Add(Section($"On the way home · {home.Count}"));
            foreach (var visit in home)
                _body.Children.Add(Row(new SpriteLook(visit.Species, visit.Form, visit.Shiny), VisitName(visit),
                    $"Back to @{visit.OwnerName} when they open the app", () => { }));
        }
    }

    private async Task GateMenuAsync(ParkVisit visit)
    {
        var choice = await PadMenu.ShowAsync(_host, VisitName(visit), $"@{visit.OwnerName} sent it to your Poképark.",
            new PadOption("Take it in", IconPath: "park", Detail: "It joins your Bank and your Poképark until you send it home."),
            new PadOption("Send it back now", IconPath: "back", Detail: "It goes home as it came."),
            new PadOption("Close", IconPath: "close"));
        if (choice == "Take it in") await Report(await _visits.TakeInAsync(visit));
        else if (choice == "Send it back now") await Report(await _visits.SendHomeAsync(visit, "The Poképark is full right now. Come back soon!"));
        else return;
        await ShowParkAsync();
    }

    private async Task SendHomeAsync(ParkVisit visit)
    {
        var notes = new[]
        {
            "It had a great time in the Poképark!",
            "It ate lots of berries and made new friends.",
            "It loved the garden. Come back soon!",
        };
        var choice = await PadMenu.ShowAsync(_host, $"Send {VisitName(visit)} home?",
            "It goes back to its owner's Bank with what it gained (friendship, berries, its new nature). Pick the note it carries.",
            [.. notes.Select(note => new PadOption(note, IconPath: "heart")), new PadOption("Not yet", IconPath: "close")]);
        if (choice is null || choice == "Not yet") return;
        await Report(await _visits.SendHomeAsync(visit, choice));
        await ShowParkAsync();
    }

    // ── The Arena ────────────────────────────────────────────────────────────

    private async Task ShowArenaAsync()
    {
        var current = await _arena.GetEventAsync();
        _body.Children.Clear();
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (current is null)
        {
            _status.Text = "No Arena event yet.";
        }
        else
        {
            _status.Text = current.IsOpen(now) ? $"Live: {current.Title}" : $"Closed: {current.Title}";
            _body.Children.Add(Row(new SpriteLook(current.Champion.Species, current.Champion.Form, current.Champion.Shiny),
                $"Champion: {current.Champion.Nickname}", $"{current.Loaners.Count} Pokémon to fight with · " +
                $"{(current.EndsUnixMs > 0 ? $"ends {DateTimeOffset.FromUnixTimeMilliseconds(current.EndsUnixMs).ToLocalTime():dd/MM HH:mm}" : "no end")} · " +
                (current.ChampionAura ? "aura ON (you always win)" : "aura off (fair fights)"), () => { }, current.ChampionAura ? UiTokens.Gold : null));
            _body.Children.Add(Small("Prizes: " + string.Join(", ", current.Rewards.Select(r => r.Name))));
            var results = await _arena.GetResultsAsync(current.Id);
            _body.Children.Add(Section($"Challengers · {results.Count} · {results.Sum(r => r.Battles)} battles · {results.Sum(r => r.Wins)} lost by the Champion"));
            foreach (var result in results)
                _body.Children.Add(Row(null, $"@{result.Username}", $"{result.Battles} battles · {result.Wins} wins · best {result.BestDamage}% of the Champion's HP", () => { }));
        }

        var create = Kit.Capsule(current is null ? "Set up an event" : "Set up a new event", UiTokens.Green, primary: true, icon: "battle");
        create.HorizontalOptions = LayoutOptions.Start;
        create.Clicked += (_, _) => _ = Run(CreateEventAsync);
        _body.Children.Insert(0, create);
        if (current is not null)
        {
            var toggle = Kit.Capsule(current.ChampionAura ? "Turn the aura off" : "Turn the aura on", UiTokens.Gold, icon: "star");
            toggle.HorizontalOptions = LayoutOptions.Start;
            toggle.Clicked += (_, _) => _ = Run(async () =>
            {
                await _arena.PublishAsync(current with { ChampionAura = !current.ChampionAura });
                await ShowArenaAsync();
            });
            var close = Kit.Capsule(current.Active ? "Close the event" : "Open the event again", UiTokens.RedOrange, icon: current.Active ? "close" : "play");
            close.HorizontalOptions = LayoutOptions.Start;
            close.Clicked += (_, _) => _ = Run(async () =>
            {
                await _arena.PublishAsync(current with { Active = !current.Active });
                await ShowArenaAsync();
            });
            _body.Children.Insert(1, toggle);
            _body.Children.Insert(2, close);
        }
    }

    private async Task CreateEventAsync()
    {
        var title = await TextPopup.ShowLineAsync(_host, "Event name", "What players see at the top of the Arena.", "Champion's Cup");
        if (string.IsNullOrWhiteSpace(title)) return;
        var description = await TextPopup.ShowLineAsync(_host, "The challenge", "One line that makes everyone want to play.",
            "Beat the Champion and take home legendary prizes!");
        if (description is null) return;

        var champion = await BankPicker.PickAsync(_host, _bank, "Pick your Champion", Fightable,
            e => $"Lv {e.Info.Level} · fights at Lv 50 · Box {e.Box + 1:00}");
        if (champion is null) return;

        var loaners = new List<BankEntry>();
        while (loaners.Count < ArenaEvent.MaxLoaners)
        {
            var title2 = loaners.Count == 0 ? "Pick a Pokémon players fight with" : $"Another one? ({loaners.Count} picked, back to finish)";
            var pick = await BankPicker.PickAsync(_host, _bank, title2,
                e => Fightable(e) && e.Id != champion.Id && loaners.All(l => l.Id != e.Id));
            if (pick is null) break;
            loaners.Add(pick);
        }
        if (loaners.Count == 0)
        {
            await PadMenu.ShowAsync(_host, "Arena", "Players need at least one Pokémon to fight with.", "OK");
            return;
        }

        var rewards = new List<ArenaReward>();
        while (true)
        {
            var left = ArenaEvent.RewardChoices.Where(r => !rewards.Contains(r)).ToList();
            var options = left.Select(r => new PadOption(r.Name, IconPath: r.Stars > 0 ? "star" : "item")).ToList();
            options.Insert(0, new PadOption(rewards.Count == 0 ? "No prizes" : $"Done ({rewards.Count} prizes)", IconPath: "confirm"));
            var choice = await PadMenu.ShowAsync(_host, "Prizes", rewards.Count == 0
                ? "The bigger the prizes, the more players come. Pick as many as you like."
                : "Prizes: " + string.Join(", ", rewards.Select(r => r.Name)), [.. options]);
            var reward = left.FirstOrDefault(r => r.Name == choice);
            if (reward is null) break;
            rewards.Add(reward);
        }

        var length = await PadMenu.ShowAsync(_host, "How long?", "When the event closes on its own.",
            new PadOption("1 day", IconPath: "calendar"), new PadOption("3 days", IconPath: "calendar"),
            new PadOption("1 week", IconPath: "calendar"), new PadOption("Until I close it", IconPath: "calendar"));
        if (length is null) return;
        var days = length switch { "1 day" => 1, "3 days" => 3, "1 week" => 7, _ => 0 };

        var aura = await PadMenu.ShowAsync(_host, "The Champion's aura",
            "With the aura the Champion always wins: it gets very low, gets up again, and wins in the end. Nobody sees a rule, only a very strong Champion.",
            new PadOption("Aura on (I always win)", IconPath: "star"),
            new PadOption("Aura off (fair fights)", IconPath: "battle"));
        if (aura is null) return;

        var mon = (BankEntry entry) => ArenaMon.From(_bank.GetData(entry.Id), entry.Info);
        var arenaEvent = new ArenaEvent(
            Guid.NewGuid().ToString("N")[..12], title.Trim(), description.Trim(), true,
            days > 0 ? DateTimeOffset.UtcNow.AddDays(days).ToUnixTimeMilliseconds() : 0,
            IPlatformApplication.Current?.Services.GetService<AccountService>()?.Username ?? CloudAccountClient.AdminUsername,
            mon(champion), loaners.Select(mon).ToList(), rewards, aura.StartsWith("Aura on", StringComparison.Ordinal));
        if (_arena.Fighter(arenaEvent.Champion) is null)
        {
            await PadMenu.ShowAsync(_host, "Arena", $"{champion.Info.Nickname} cannot fight in the Arena (its data could not be read).", "OK");
            return;
        }
        await _arena.PublishAsync(arenaEvent);
        await Report($"\"{arenaEvent.Title}\" is live! Everyone sees it in the Arena now.");
        await ShowArenaAsync();
    }

    private static bool Fightable(BankEntry entry) =>
        PKForge.Engine.EntityBytes.RomHackGame(entry.Info.Format) is null && entry.Info.Species > 0;

    // ── Pieces ───────────────────────────────────────────────────────────────

    private async Task Report(string message)
    {
        _status.Text = message;
        await PadMenu.ShowAsync(_host, "Admin", message, new PadOption("OK", IconPath: "confirm"));
    }

    private static string Name(BankEntryInfo info) => info.Shiny ? $"{info.Nickname} ★" : info.Nickname;

    private static string VisitName(ParkVisit visit) => visit.Shiny ? $"{visit.Nickname} ★" : visit.Nickname;

    private static string Ago(long ms)
    {
        if (ms <= 0) return "never seen";
        var ago = DateTimeOffset.UtcNow - DateTimeOffset.FromUnixTimeMilliseconds(ms);
        if (ago.TotalMinutes < 1) return "just now";
        if (ago.TotalMinutes < 60) return $"{(int)ago.TotalMinutes} min ago";
        if (ago.TotalHours < 48) return $"{(int)ago.TotalHours} h ago";
        return DateTimeOffset.FromUnixTimeMilliseconds(ms).ToLocalTime().ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
    }

    private static Label Small(string? text = null) => new()
    {
        Text = text,
        FontFamily = DsChrome.PixelFont,
        FontSize = UiTokens.TextSmall,
        TextColor = UiTokens.InkSoft,
        LineBreakMode = LineBreakMode.WordWrap,
    };

    private static Label Section(string text) => new()
    {
        Text = text,
        FontFamily = DsChrome.PixelFont,
        FontSize = UiTokens.TextTitle,
        TextColor = UiTokens.Ink0,
        Margin = new Thickness(0, 8, 0, 0),
    };

    private static Border Row(SpriteLook? look, string title, string detail, Action onTap, Color? mark = null)
    {
        var texts = new VerticalStackLayout
        {
            Spacing = 1,
            VerticalOptions = LayoutOptions.Center,
            Children =
            {
                new Label { Text = title, FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextBody, TextColor = UiTokens.Ink0, LineBreakMode = LineBreakMode.TailTruncation },
                Small(detail),
            },
        };
        var grid = new Grid
        {
            ColumnSpacing = 10,
            ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Star)],
        };
        View lead = look is { } sprite
            ? new SpriteView(44) { Look = sprite }
            : Kit.StatusLight(mark ?? UiTokens.InkSoft, 12).Also(light => light.VerticalOptions = LayoutOptions.Center);
        grid.Children.Add(lead);
        grid.Children.Add(texts);
        Grid.SetColumn(texts, 1);
        var row = new Border
        {
            Padding = new Thickness(10, 6),
            BackgroundColor = UiTokens.Well,
            Stroke = mark ?? UiTokens.ShellEdge,
            StrokeThickness = mark is null ? 1.2 : 2,
            StrokeShape = new RoundRectangle { CornerRadius = 8 },
            Content = grid,
        };
        var tap = new TapGestureRecognizer();
        tap.Tapped += (_, _) => onTap();
        row.GestureRecognizers.Add(tap);
        return row;
    }
}
