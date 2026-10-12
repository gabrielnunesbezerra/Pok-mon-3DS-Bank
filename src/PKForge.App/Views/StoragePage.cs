using Microsoft.Maui.Controls.Shapes;
using PKForge.App.Services;
using PKForge.App.Theme;
using PKForge.Domain;
using PKForge.Engine;

namespace PKForge.App.Views;

/// <summary>
/// The Storage (3DS Bank 2.0): the items kept with the Bank, each with its picture and count,
/// and the Shooting Stars. Items come in from a game's bag or off a Bank Pokémon, and go out
/// to a Bank Pokémon or a game's bag. A star turns a Bank Pokémon shiny.
/// </summary>
public sealed class StoragePage : ContentPage, IPadHandler, IOverlayHost
{
    private readonly StorageService _storage;
    private readonly IBankService _bank;
    private readonly Grid _host;
    private readonly Label _starTitle;
    private readonly Label _starText;
    private readonly Label _itemsTitle;
    private readonly Label _empty;
    private readonly Label _status;
    private readonly Button _useStar;
    private readonly FlexLayout _tiles;
    private bool _busy;

    public StoragePage(StorageService storage, IBankService bank)
    {
        _storage = storage;
        _bank = bank;
        Title = "Storage";
        BackgroundColor = UiTokens.Housing;
        NavigationPage.SetHasNavigationBar(this, false);

        var back = Kit.MiniCapsule("Back", UiTokens.Ink0);
        back.WidthRequest = 72;
        back.Clicked += async (_, _) => await Navigation.PopAsync();
        var header = Kit.HeaderBar("Storage");
        header.VerticalOptions = LayoutOptions.Center;
        var titleRow = new Grid
        {
            ColumnSpacing = 10,
            ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Star)],
            Children = { back, header },
        };
        Grid.SetColumn(header, 1);

        _starTitle = new Label { FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextTitle + 2, TextColor = UiTokens.Ink0 };
        _starText = Small();
        _useStar = Kit.Capsule("Use a Shooting Star", UiTokens.Yellow, primary: true);
        _useStar.Clicked += (_, _) => _ = Run(UseStarAsync);
        var starTexts = new VerticalStackLayout { Spacing = 4, VerticalOptions = LayoutOptions.Center, Children = { _starTitle, _starText, _useStar } };
        _useStar.HorizontalOptions = LayoutOptions.Start;
        var starRow = new Grid
        {
            ColumnSpacing = 14,
            ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Star)],
            Children = { ShootingStarArt.View(76), starTexts },
        };
        Grid.SetColumn(starTexts, 1);

        var bring = Kit.Capsule("Bring items from a game", UiTokens.AccentInfo, icon: "bag");
        bring.Clicked += (_, _) => _ = Run(BringFromGameAsync);
        var takeOff = Kit.Capsule("Take an item off a Pokémon", UiTokens.AccentInfo, icon: "item");
        takeOff.Clicked += (_, _) => _ = Run(TakeOffPokemonAsync);
        var actions = new FlexLayout
        {
            Wrap = Microsoft.Maui.Layouts.FlexWrap.Wrap,
            Direction = Microsoft.Maui.Layouts.FlexDirection.Row,
            Children = { bring, takeOff },
        };
        bring.Margin = new Thickness(0, 0, 8, 6);
        takeOff.Margin = new Thickness(0, 0, 8, 6);

        _itemsTitle = new Label { FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextTitle, TextColor = UiTokens.Ink0 };
        _empty = Small("Your Storage is empty. Bring items from a game's bag, or take an item off a Bank Pokémon.");
        _tiles = new FlexLayout
        {
            Wrap = Microsoft.Maui.Layouts.FlexWrap.Wrap,
            Direction = Microsoft.Maui.Layouts.FlexDirection.Row,
            JustifyContent = Microsoft.Maui.Layouts.FlexJustify.Start,
        };
        _status = Small();
        _status.TextColor = UiTokens.Ink0;

        var body = new VerticalStackLayout
        {
            Spacing = 10,
            Children =
            {
                Kit.Panel(starRow, padding: 12),
                actions,
                _status,
                Kit.Panel(new VerticalStackLayout { Spacing = 8, Children = { _itemsTitle, _empty, _tiles } }, padding: 12),
            },
        };

        var footer = DsChrome.Footer(
            ("B", "Back", () => _ = Navigation.PopAsync()),
            ("Y", "Bring items", () => _ = Run(BringFromGameAsync)),
            ("X", "Shooting Star", () => _ = Run(UseStarAsync)));
        var content = new Grid
        {
            Padding = new Thickness(14, 10),
            RowSpacing = 10,
            RowDefinitions = [new(GridLength.Auto), new(GridLength.Star)],
            Children = { titleRow, new ScrollView { Content = body } },
        };
        Grid.SetRow((View)content.Children[1], 1);
        var root = new Grid
        {
            RowDefinitions = [new(GridLength.Auto), new(GridLength.Star), new(GridLength.Auto)],
            Children = { DsChrome.TitleBar(), new Grid { Children = { DsChrome.GridBackground(), content } }, footer },
        };
        Grid.SetRow((View)root.Children[1], 1);
        Grid.SetRow(footer, 2);
        _host = new Grid { Children = { root } };
        Content = _host;
    }

    public Grid OverlayHost => _host;

    protected override void OnAppearing()
    {
        base.OnAppearing();
        IPlatformApplication.Current?.Services.GetService<GamepadRouter>()?.Push(this);
        Refresh();
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
            case PadButton.B: _ = Navigation.PopAsync(); return true;
            case PadButton.Y: _ = Run(BringFromGameAsync); return true;
            case PadButton.X: _ = Run(UseStarAsync); return true;
            default: return false;
        }
    }

    private static Label Small(string? text = null) => new()
    {
        Text = text,
        FontFamily = DsChrome.PixelFont,
        FontSize = UiTokens.TextSmall,
        TextColor = UiTokens.InkSoft,
        LineBreakMode = LineBreakMode.WordWrap,
    };

    private void Refresh()
    {
        var state = _storage.Read();
        var count = _bank.GetAll().Count;
        _starTitle.Text = $"Shooting Stars: {state.Stars}";
        _starText.Text = $"A Shooting Star falls into your Storage every time your Bank holds 60 more Pokémon. " +
                         $"Next one at {state.NextStarAt} Pokémon (your Bank has {count}). Using one makes a Bank Pokémon shiny.";
        _useStar.IsEnabled = state.Stars > 0;
        _tiles.Children.Clear();
        foreach (var (item, amount) in state.Items.OrderBy(pair => _storage.ItemName(pair.Key), StringComparer.OrdinalIgnoreCase))
            _tiles.Children.Add(Tile(item, amount));
        _empty.IsVisible = state.Items.Count == 0;
        _itemsTitle.Text = state.Items.Count == 0
            ? "Items"
            : $"Items · {state.Items.Count} kinds, {state.Items.Values.Sum()} in all";
    }

    private View Tile(int item, int amount)
    {
        var name = _storage.ItemName(item);
        var icon = new Image { WidthRequest = 36, HeightRequest = 36, Aspect = Aspect.AspectFit, VerticalOptions = LayoutOptions.Center };
        _ = LoadIconAsync(icon, name);
        var texts = new VerticalStackLayout
        {
            Spacing = 1,
            VerticalOptions = LayoutOptions.Center,
            Children =
            {
                new Label { Text = name, FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextBody, TextColor = UiTokens.Ink0, LineBreakMode = LineBreakMode.TailTruncation, MaxLines = 2 },
                new Label { Text = $"×{amount}", FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextSmall, TextColor = UiTokens.InkSoft },
            },
        };
        var row = new Grid
        {
            ColumnSpacing = 8,
            ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Star)],
            Children = { icon, texts },
        };
        Grid.SetColumn(texts, 1);
        var tile = new Border
        {
            WidthRequest = 168,
            Margin = new Thickness(0, 0, 8, 8),
            Padding = new Thickness(8, 6),
            BackgroundColor = UiTokens.Well,
            Stroke = UiTokens.ShellEdge,
            StrokeThickness = 1.5,
            StrokeShape = new RoundRectangle { CornerRadius = 8 },
            Content = row,
        };
        var tap = new TapGestureRecognizer();
        tap.Tapped += (_, _) => _ = Run(() => ItemMenuAsync(item));
        tile.GestureRecognizers.Add(tap);
        return tile;
    }

    private static async Task LoadIconAsync(Image icon, string name)
    {
        var path = await ItemArt.GetAsync(name) ?? ItemArt.PlaceholderPath();
        MainThread.BeginInvokeOnMainThread(() => icon.Source = path);
    }

    private async Task Run(Func<Task> action)
    {
        if (_busy) return;
        _busy = true;
        try
        {
            await action();
        }
        catch (Exception error) when (error is IOException or InvalidOperationException or Infrastructure.CloudAccountException)
        {
            AppLog.Warn("storage", error.ToString());
            await PadMenu.ShowAsync(_host, "Storage", error.Message, "OK");
        }
        finally
        {
            _busy = false;
            Refresh();
        }
    }

    private async Task Say(StorageOutcome outcome)
    {
        _status.Text = outcome.Message;
        await PadMenu.ShowAsync(_host, outcome.Success ? "Storage" : "Not possible", outcome.Message, "OK");
    }

    // ── One item ─────────────────────────────────────────────────────────────

    private async Task ItemMenuAsync(int item)
    {
        var name = _storage.ItemName(item);
        var have = _storage.Read().CountOf(item);
        var choice = await PadMenu.ShowAsync(_host, name, $"In your Storage: {have}",
            new PadOption("Give to a Bank Pokémon", IconPath: "item", Detail: "It holds the item; what it held before comes to the Storage."),
            new PadOption("Send to a game's bag", IconPath: "bag", Detail: "The item leaves the Storage and goes into that game's bag."),
            new PadOption("Close", IconPath: "close"));
        switch (choice)
        {
            case "Give to a Bank Pokémon": await GiveAsync(item); break;
            case "Send to a game's bag": await SendToGameAsync(item); break;
        }
    }

    private async Task GiveAsync(int item)
    {
        var name = _storage.ItemName(item);
        var entry = await BankPicker.PickAsync(_host, _bank, $"Who will hold {name}?",
            keep: e => e.Info.Generation >= 2 && e.Info.Format is not "PB7" && EntityBytes.RomHackGame(e.Info.Format) is null);
        if (entry is null) return;
        if (_storage.WhyCannotHold(entry, item) is { } why)
        {
            await Say(new StorageOutcome(false, why));
            return;
        }
        await Say(_storage.GiveItem(entry.Id, item));
    }

    private async Task SendToGameAsync(int item)
    {
        var game = await PickGameAsync($"{_storage.ItemName(item)} → which game?");
        if (game is null) return;
        var count = await AskCountAsync($"How many {_storage.ItemName(item)}?", _storage.Read().CountOf(item));
        if (count is not { } amount) return;
        await Say(await _storage.PutInBagAsync(game, item, amount));
    }

    // ── Bringing items in ────────────────────────────────────────────────────

    private async Task BringFromGameAsync()
    {
        var game = await PickGameAsync("Bring items from which game?");
        if (game is null) return;
        IReadOnlyList<BagStack> stacks;
        try
        {
            stacks = await _storage.ReadBagAsync(game);
        }
        catch (Exception error) when (error is IOException or InvalidDataException or UnauthorizedAccessException or InvalidOperationException)
        {
            await Say(new StorageOutcome(false, $"That game's bag could not be read: {error.Message}"));
            return;
        }
        if (stacks.Count == 0)
        {
            await Say(new StorageOutcome(false,
                "Nothing in that game's bag can come to the Storage. Key items and TMs stay in their game, and Generation 1 items cannot travel."));
            return;
        }
        var directory = System.IO.Path.Combine(FileSystem.AppDataDirectory, "items");
        var placeholder = ItemArt.PlaceholderPath();
        var items = stacks.Select((stack, i) =>
        {
            var name = _storage.ItemName(stack.NationalId);
            var cached = System.IO.Path.Combine(directory, ItemArt.Slug(name) + ".png");
            return new PickItem(i, name, File.Exists(cached) ? cached : placeholder, $"×{stack.Count} · {PouchName(stack.Pouch)}");
        }).ToList();
        _ = Task.Run(async () =>
        {
            foreach (var stack in stacks) await ItemArt.GetAsync(_storage.ItemName(stack.NationalId));
        });
        var pick = await PickerMenu.ShowAsync(_host, $"{game.Label}: bag", items);
        if (pick is null) return;
        var chosen = stacks[pick.Id];
        var count = await AskCountAsync($"How many {_storage.ItemName(chosen.NationalId)}?", chosen.Count);
        if (count is not { } amount) return;
        await Say(await _storage.TakeFromBagAsync(game, chosen, amount));
    }

    private async Task TakeOffPokemonAsync()
    {
        var entry = await BankPicker.PickAsync(_host, _bank, "Take the item off which Pokémon?",
            keep: e => e.Info.HeldItem is not 0 && e.Info.Generation >= 2 && EntityBytes.RomHackGame(e.Info.Format) is null);
        if (entry is null) return;
        await Say(_storage.TakeItem(entry.Id));
    }

    // ── The Shooting Star ────────────────────────────────────────────────────

    private async Task UseStarAsync()
    {
        if (_storage.Read().Stars <= 0)
        {
            await Say(new StorageOutcome(false, "You have no Shooting Star yet. One falls every time your Bank holds 60 more Pokémon."));
            return;
        }
        await UseStarOnAsync(_host, _storage, _bank, null);
    }

    /// <summary>
    /// The Shooting Star flow, shared with the Bank's own menu: pick a Pokémon (unless given),
    /// see what changes, confirm. Returns true when a Pokémon became shiny.
    /// </summary>
    public static async Task<bool> UseStarOnAsync(Grid host, StorageService storage, IBankService bank, BankEntry? entry)
    {
        entry ??= await BankPicker.PickAsync(host, bank, "Which Pokémon gets the Shooting Star?",
            keep: e => !e.Info.Shiny && EntityBytes.RomHackGame(e.Info.Format) is null);
        if (entry is null) return false;
        var (change, refusal, hash) = storage.PreviewStar(entry.Id);
        if (change is null)
        {
            await PadMenu.ShowAsync(host, "Shooting Star", refusal ?? "It cannot use the Shooting Star.", "OK");
            return false;
        }
        var warning = change.WasLegal && !change.IsLegal
            ? " Its game could not have made it shiny this way, so legality checkers (like PKHeX) will flag it. The game itself loads it normally."
            : "";
        if (!await PadMenu.ConfirmAsync(host, "Use a Shooting Star?",
                $"{entry.Info.Nickname} becomes shiny for good. One Shooting Star is used up.{warning}", "Use it"))
            return false;
        var outcome = storage.ApplyStar(entry.Id, change, hash);
        await PadMenu.ShowAsync(host, outcome.Success ? "Shooting Star!" : "Not possible", outcome.Message, "OK");
        return outcome.Success;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task<StorageGame?> PickGameAsync(string title)
    {
        var games = _storage.Games();
        if (games.Count == 0)
        {
            await Say(new StorageOutcome(false, "No games linked. Link an emulator or open a save on Home first."));
            return null;
        }
        var options = games.Select(g => new PadOption(g.Label, IconPath: "game")).ToArray();
        var choice = await PadMenu.ShowAsync(_host, title, null, options);
        return games.FirstOrDefault(g => g.Label == choice);
    }

    private async Task<int?> AskCountAsync(string title, int max)
    {
        if (max <= 0) return null;
        if (max == 1) return 1;
        var counts = new[] { 1, 5, 10, 50, 100 }.Where(n => n < max).Append(max).ToList();
        var labels = counts.Select(n => n == max ? $"All ({max})" : n.ToString(System.Globalization.CultureInfo.InvariantCulture)).ToArray();
        var choice = await PadMenu.ShowAsync(_host, title, null, labels);
        var index = Array.IndexOf(labels, choice);
        return index < 0 ? null : counts[index];
    }

    private static string PouchName(string pouch) => pouch switch
    {
        "Items" => "Items",
        "Medicine" => "Medicine",
        "Balls" => "Poké Balls",
        "Berries" => "Berries",
        "BattleItems" => "Battle items",
        "MailItems" => "Mail",
        "ZCrystals" => "Z-Crystals",
        "PCItems" => "PC",
        "Candy" => "Candy",
        _ => pouch,
    };
}
