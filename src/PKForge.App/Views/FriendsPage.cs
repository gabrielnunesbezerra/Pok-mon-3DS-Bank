using Microsoft.Maui.Controls.Shapes;
using PKForge.App.Services;
using PKForge.App.Theme;
using PKForge.Domain;
using PKForge.Infrastructure;

namespace PKForge.App.Views;

/// <summary>
/// Friends (3DS Bank 2.0): the player's own profile card, their friends (who is in the app
/// right now first), friend requests, finding a player by username, seeing a friend's profile
/// and starting an online trade with a friend who is online.
/// </summary>
public sealed class FriendsPage : ContentPage, IPadHandler, IOverlayHost
{
    /// <summary>The games a player can name as their favorite (Generation 1 to 7, like the Bank).</summary>
    public static readonly string[] Games =
    [
        "Pokémon Red", "Pokémon Blue", "Pokémon Yellow", "Pokémon Gold", "Pokémon Silver", "Pokémon Crystal",
        "Pokémon Ruby", "Pokémon Sapphire", "Pokémon Emerald", "Pokémon FireRed", "Pokémon LeafGreen",
        "Pokémon Colosseum", "Pokémon XD", "Pokémon Diamond", "Pokémon Pearl", "Pokémon Platinum",
        "Pokémon HeartGold", "Pokémon SoulSilver", "Pokémon Black", "Pokémon White", "Pokémon Black 2", "Pokémon White 2",
        "Pokémon X", "Pokémon Y", "Pokémon Omega Ruby", "Pokémon Alpha Sapphire", "Pokémon Sun", "Pokémon Moon",
        "Pokémon Ultra Sun", "Pokémon Ultra Moon", "Let's Go, Pikachu!", "Let's Go, Eevee!",
        "Pokémon Unbound", "Pokémon Radical Red",
    ];

    private readonly SocialService _social;
    private readonly IBankService _bank;
    private readonly Grid _host;
    private readonly SpriteView _mySprite;
    private readonly Label _myName;
    private readonly Label _myHandle;
    private readonly Label _myBio;
    private readonly Label _friendsTitle;
    private readonly VerticalStackLayout _friendRows;
    private readonly Label _status;
    private readonly Button _requests;
    private PlayerProfile? _me;
    private IReadOnlyList<FriendEntry> _friends = [];
    private IReadOnlyList<FriendRequest> _pending = [];
    private bool _busy;

    public FriendsPage(SocialService social, IBankService bank)
    {
        _social = social;
        _bank = bank;
        Title = "Friends";
        BackgroundColor = UiTokens.Housing;
        NavigationPage.SetHasNavigationBar(this, false);

        var back = Kit.IconButton("back", () => _ = Navigation.PopAsync());
        var header = Kit.HeaderBar("Friends");
        header.VerticalOptions = LayoutOptions.Center;
        var titleRow = new Grid
        {
            ColumnSpacing = 10,
            ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Star)],
            Children = { back, header },
        };
        Grid.SetColumn(header, 1);

        _mySprite = new SpriteView(84);
        _myName = new Label { FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextTitle + 3, TextColor = UiTokens.Ink0 };
        _myHandle = Small();
        _myBio = Small();
        _myBio.TextColor = UiTokens.Ink0;
        var edit = Kit.Capsule("Edit profile", UiTokens.AccentInfo, icon: "profile");
        edit.HorizontalOptions = LayoutOptions.Start;
        edit.Clicked += (_, _) => _ = Run(EditProfileAsync);
        var meTexts = new VerticalStackLayout { Spacing = 3, VerticalOptions = LayoutOptions.Center, Children = { _myName, _myHandle, _myBio, edit } };
        var meRow = new Grid
        {
            ColumnSpacing = 14,
            ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Star)],
            Children = { _mySprite, meTexts },
        };
        Grid.SetColumn(meTexts, 1);

        var add = Kit.Capsule("Add a friend", UiTokens.Green, primary: true, icon: "search");
        add.Clicked += (_, _) => _ = Run(AddFriendAsync);
        _requests = Kit.Capsule("Requests", UiTokens.AccentInfo, icon: "inbox");
        _requests.Clicked += (_, _) => _ = Run(RequestsAsync);
        var refresh = Kit.Capsule("Refresh", UiTokens.Ink1, icon: "refresh");
        refresh.Clicked += (_, _) => _ = Run(LoadAsync);
        var actions = new FlexLayout
        {
            Wrap = Microsoft.Maui.Layouts.FlexWrap.Wrap,
            Direction = Microsoft.Maui.Layouts.FlexDirection.Row,
            Children = { add, _requests, refresh },
        };
        foreach (var button in new[] { add, _requests, refresh }) button.Margin = new Thickness(0, 0, 8, 6);

        _friendsTitle = new Label { FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextTitle, TextColor = UiTokens.Ink0, Text = "Friends" };
        _friendRows = new VerticalStackLayout { Spacing = 6 };
        _status = Small("Loading…");
        _status.TextColor = UiTokens.Ink0;

        var body = new VerticalStackLayout
        {
            Spacing = 10,
            Children =
            {
                Kit.Panel(meRow, padding: 12),
                actions,
                _status,
                Kit.Panel(new VerticalStackLayout { Spacing = 8, Children = { _friendsTitle, _friendRows } }, padding: 12),
            },
        };
        // Every action is a button on the page itself; the footer row stays empty (hidden).
        var footer = DsChrome.Footer();
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
            SafeAreaEdges = SafeAreaEdges.None,
            RowDefinitions = [new(GridLength.Auto), new(GridLength.Star), new(GridLength.Auto)],
            Children = { DsChrome.TitleBar(), DsChrome.FullBleed(new Grid { Children = { DsChrome.GridBackground(), content } }), DsChrome.ClearOfCutout(footer) },
        };
        Grid.SetRow((View)root.Children[1], 1);
        Grid.SetRow((View)root.Children[2], 2);
        _host = DsChrome.FullBleed(new Grid { Children = { root } });
        Content = _host;
    }

    public Grid OverlayHost => _host;

    protected override void OnAppearing()
    {
        base.OnAppearing();
        IPlatformApplication.Current?.Services.GetService<GamepadRouter>()?.Push(this);
        _ = Run(LoadAsync);
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
            case PadButton.Y: _ = Run(AddFriendAsync); return true;
            case PadButton.X: _ = Run(RequestsAsync); return true;
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
            await PadMenu.ShowAsync(_host, "Friends", error.Message, "OK");
        }
        catch (Exception error) when (error is IOException or InvalidOperationException or HttpRequestException)
        {
            AppLog.Warn("friends", error.ToString());
            _status.Text = error.Message;
        }
        finally
        {
            _busy = false;
        }
    }

    // ── Loading ──────────────────────────────────────────────────────────────

    private async Task LoadAsync()
    {
        _status.Text = "Loading…";
        _me = await _social.GetProfileAsync();
        ShowMe();
        _friends = await _social.GetFriendsAsync();
        _pending = await _social.GetRequestsAsync();
        ShowFriends();
        _requests.Text = _pending.Count > 0 ? $"Requests ({_pending.Count})" : "Requests";
        _status.Text = _pending.Count > 0
            ? $"{_pending.Count} friend request(s) waiting for you."
            : _friends.Count == 0 ? "Add your friends by their username to trade with them." : "";
        if (IPlatformApplication.Current?.Services.GetService<AccountService>()?.Claim == UsernameClaim.Taken)
            _status.Text = "Another account already took your username, so friends cannot find you by it. Talk to support.";
        _ = _social.PublishNumbersAsync();
    }

    private void ShowMe()
    {
        var username = _social.MyUsername ?? "";
        var me = _me;
        _myName.Text = me is { DisplayName.Length: > 0 } ? me.DisplayName : username;
        _myHandle.Text = $"@{username}";
        _myBio.Text = me is { Bio.Length: > 0 } ? me.Bio : "No message yet.";
        _mySprite.Look = me is { FavoriteSpecies: > 0 } ? new SpriteLook(me.FavoriteSpecies, me.FavoriteForm, me.FavoriteShiny) : null;
    }

    private void ShowFriends()
    {
        _friendRows.Children.Clear();
        _friendsTitle.Text = _friends.Count == 0 ? "Friends" : $"Friends · {_friends.Count} ({_friends.Count(f => f.Online)} online)";
        if (_friends.Count == 0)
        {
            _friendRows.Children.Add(Small("No friends yet."));
            return;
        }
        foreach (var friend in _friends) _friendRows.Children.Add(FriendRow(friend));
    }

    private View FriendRow(FriendEntry friend)
    {
        var light = Kit.StatusLight(friend.Online ? UiTokens.Green : UiTokens.InkSoft, 12);
        light.VerticalOptions = LayoutOptions.Center;
        var texts = new VerticalStackLayout
        {
            Spacing = 1,
            Children =
            {
                new Label { Text = friend.Username, FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextBody, TextColor = UiTokens.Ink0 },
                Small(friend.Online ? "In the app now" : LastSeen(friend.LastSeenMs)),
            },
        };
        var trade = Kit.MiniCapsule("Trade", friend.Online ? UiTokens.Green : UiTokens.InkSoft);
        trade.IsEnabled = friend.Online;
        trade.WidthRequest = 80;
        trade.Clicked += (_, _) => _ = Run(() => TradeAsync(friend));
        var grid = new Grid
        {
            ColumnSpacing = 10,
            ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Star), new(GridLength.Auto)],
            Children = { light, texts, trade },
        };
        Grid.SetColumn(texts, 1);
        Grid.SetColumn(trade, 2);
        var row = new Border
        {
            Padding = new Thickness(10, 6),
            BackgroundColor = UiTokens.Well,
            Stroke = UiTokens.ShellEdge,
            StrokeThickness = 1.2,
            StrokeShape = new RoundRectangle { CornerRadius = 8 },
            Content = grid,
        };
        var tap = new TapGestureRecognizer();
        tap.Tapped += (_, _) => _ = Run(() => FriendMenuAsync(friend));
        texts.GestureRecognizers.Add(tap);
        return row;
    }

    private string LastSeen(long ms)
    {
        if (ms <= 0) return "Not in the app";
        var ago = TimeSpan.FromMilliseconds(Math.Max(0, _social.ServerNow - ms));
        return ago.TotalMinutes < 60 ? $"Seen {Math.Max(1, (int)ago.TotalMinutes)} min ago"
            : ago.TotalHours < 48 ? $"Seen {(int)ago.TotalHours} h ago"
            : $"Seen {(int)ago.TotalDays} days ago";
    }

    // ── A friend ─────────────────────────────────────────────────────────────

    private async Task FriendMenuAsync(FriendEntry friend)
    {
        var options = new List<PadOption> { new("See profile", IconPath: "profile") };
        if (friend.Online) options.Add(new PadOption("Trade", IconPath: "send", Detail: "Both of you pick a Pokémon from your Banks and confirm."));
        options.Add(new PadOption("Remove friend", IconPath: "release"));
        options.Add(new PadOption("Close", IconPath: "close"));
        var choice = await PadMenu.ShowAsync(_host, friend.Username,
            friend.Online ? "In the app now." : $"{LastSeen(friend.LastSeenMs)}. Trades need both players online.", [.. options]);
        switch (choice)
        {
            case "See profile":
                var profile = await _social.GetProfileAsync(friend.Uid);
                await ShowProfileAsync(_host, profile ?? Blank(friend.Uid, friend.Username));
                break;
            case "Trade":
                await TradeAsync(friend);
                break;
            case "Remove friend":
                if (!await PadMenu.ConfirmAsync(_host, "Remove friend?", $"{friend.Username} leaves your friends, and you leave theirs.", "Remove")) return;
                await _social.RemoveFriendAsync(friend.Uid);
                await LoadAsync();
                break;
        }
    }

    private async Task TradeAsync(FriendEntry friend)
    {
        _status.Text = $"Inviting {friend.Username}…";
        var id = await _social.StartTradeAsync(friend);
        _status.Text = "";
        await TradePage.OpenAsync(id, friend.Username);
    }

    private static PlayerProfile Blank(string uid, string username) =>
        new(uid, username, "", "", 0, 0, false, "", "", 0, 0, 0, 0);

    /// <summary>A player's profile as a window: favorite Pokémon, name, message, favorite game and Bank numbers.</summary>
    public static Task ShowProfileAsync(Grid host, PlayerProfile profile)
    {
        var done = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        Grid overlay = null!;
        PadOverlay pad = null!;
        void Close()
        {
            host.Remove(overlay);
            pad?.Dispose();
            done.TrySetResult();
        }

        var sprite = new SpriteView(128)
        {
            HorizontalOptions = LayoutOptions.Center,
            Look = profile.FavoriteSpecies > 0 ? new SpriteLook(profile.FavoriteSpecies, profile.FavoriteForm, profile.FavoriteShiny) : null,
        };
        Label Line(string text, double size = UiTokens.TextBody, Color? color = null) => new()
        {
            Text = text,
            FontFamily = DsChrome.PixelFont,
            FontSize = size,
            TextColor = color ?? UiTokens.Ink0,
            HorizontalTextAlignment = TextAlignment.Center,
            LineBreakMode = LineBreakMode.WordWrap,
        };
        var close = Kit.Capsule("Close", UiTokens.Ink1);
        close.HorizontalOptions = LayoutOptions.Center;
        close.Clicked += (_, _) => Close();
        var stack = new VerticalStackLayout
        {
            Spacing = 6,
            Children =
            {
                Kit.HeaderBar("Trainer profile"),
                sprite,
                Line(profile.Shown, UiTokens.TextTitle + 4),
                Line($"@{profile.Username}", UiTokens.TextSmall, UiTokens.InkSoft),
            },
        };
        if (profile.FavoriteSpecies > 0 && profile.FavoriteNickname.Length > 0)
            stack.Children.Add(Line($"Favorite Pokémon: {profile.FavoriteNickname}{(profile.FavoriteShiny ? " ★" : "")}", UiTokens.TextSmall));
        stack.Children.Add(Line(profile.Bio.Length > 0 ? $"“{profile.Bio}”" : "No message yet.", UiTokens.TextBody, profile.Bio.Length > 0 ? UiTokens.Ink0 : UiTokens.InkSoft));
        if (profile.FavoriteGame.Length > 0) stack.Children.Add(Line($"Favorite game: {profile.FavoriteGame}", UiTokens.TextSmall));
        stack.Children.Add(Kit.Divider());
        stack.Children.Add(Line($"Pokémon in the Bank: {profile.BankCount} · Shiny: {profile.ShinyCount}", UiTokens.TextSmall));
        stack.Children.Add(Line($"Shooting Stars earned: {profile.StarsEarned}", UiTokens.TextSmall));
        if (profile.SinceUnixMs > 0)
            stack.Children.Add(Line($"Trainer since {DateTimeOffset.FromUnixTimeMilliseconds(profile.SinceUnixMs).ToLocalTime():dd/MM/yyyy}", UiTokens.TextSmall, UiTokens.InkSoft));
        stack.Children.Add(close);

        var window = Kit.OverlayWindow(host, stack, preferredMaxWidth: 400);
        overlay = Kit.AttachOverlay(host, window, Close);
        pad = new PadOverlay(Close, Close);
        return done.Task;
    }

    // ── My profile ───────────────────────────────────────────────────────────

    private async Task EditProfileAsync()
    {
        var username = _social.MyUsername ?? "";
        var draft = _me ?? Blank(_social.MyUid ?? "", username);
        while (true)
        {
            var favorite = draft.FavoriteSpecies > 0 ? draft.FavoriteNickname + (draft.FavoriteShiny ? " ★" : "") : "none";
            var nameOption = $"Name: {(draft.DisplayName.Length > 0 ? draft.DisplayName : username)}";
            var bioOption = $"Message: {(draft.Bio.Length > 0 ? draft.Bio : "none")}";
            var favoriteOption = $"Favorite Pokémon: {favorite}";
            var gameOption = $"Favorite game: {(draft.FavoriteGame.Length > 0 ? draft.FavoriteGame : "none")}";
            var choice = await PadMenu.ShowAsync(_host, "Edit profile", "Your friends see this card.",
                new PadOption(nameOption, IconPath: "rename"),
                new PadOption(bioOption, IconPath: "script"),
                new PadOption(favoriteOption, IconPath: "heart", Detail: "Pick it from your Bank."),
                new PadOption(gameOption, IconPath: "game"),
                new PadOption("Save", IconPath: "confirm"),
                new PadOption("Cancel", IconPath: "close"));
            if (choice is null or "Cancel") return;
            if (choice == "Save")
            {
                await _social.SaveProfileAsync(draft);
                _me = await _social.GetProfileAsync() ?? draft;
                ShowMe();
                _status.Text = "Profile saved.";
                return;
            }
            if (choice == nameOption)
            {
                var text = await TextPopup.ShowLineAsync(_host, "Name", $"The name friends see (up to {PlayerProfile.MaxDisplayName} letters).", draft.DisplayName);
                if (text is not null) draft = draft with { DisplayName = ClipText(text, PlayerProfile.MaxDisplayName) };
            }
            else if (choice == bioOption)
            {
                var text = await TextPopup.ShowLineAsync(_host, "Message", $"A short message for your friends (up to {PlayerProfile.MaxBio} letters).", draft.Bio);
                if (text is not null) draft = draft with { Bio = ClipText(text, PlayerProfile.MaxBio) };
            }
            else if (choice == favoriteOption)
            {
                var entry = await BankPicker.PickAsync(_host, _bank, "Your favorite Pokémon");
                if (entry is not null)
                    draft = draft with
                    {
                        FavoriteSpecies = entry.Info.Species,
                        FavoriteForm = entry.Info.Form,
                        FavoriteShiny = entry.Info.Shiny,
                        FavoriteNickname = ClipText(entry.Info.Nickname, 24),
                    };
            }
            else if (choice == gameOption)
            {
                var game = await PadMenu.ShowAsync(_host, "Favorite game", null, [.. Games.Select(g => new PadOption(g, IconPath: "game")), new PadOption("None", IconPath: "close")]);
                if (game is not null) draft = draft with { FavoriteGame = game == "None" ? "" : game };
            }
        }
    }

    private static string ClipText(string text, int max)
    {
        var trimmed = text.Trim();
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }

    // ── Finding friends ──────────────────────────────────────────────────────

    private async Task AddFriendAsync()
    {
        var text = await TextPopup.ShowLineAsync(_host, "Add a friend", "Type their username, or the start of it.");
        if (string.IsNullOrWhiteSpace(text)) return;
        _status.Text = "Searching…";
        var found = (await _social.SearchAsync(text)).Where(p => p.Uid != _social.MyUid).ToList();
        _status.Text = "";
        if (found.Count == 0)
        {
            await PadMenu.ShowAsync(_host, "Add a friend", $"No player's username starts with “{text.Trim()}”.", "OK");
            return;
        }
        var friendIds = _friends.Select(f => f.Uid).ToHashSet(StringComparer.Ordinal);
        var options = found.Select(p => new PadOption(p.Username, IconPath: friendIds.Contains(p.Uid) ? "heart" : "profile",
            Detail: friendIds.Contains(p.Uid) ? "Already your friend." : null)).Append(new PadOption("Cancel", IconPath: "close")).ToArray();
        var choice = await PadMenu.ShowAsync(_host, "Players found", null, options);
        var pick = found.FirstOrDefault(p => p.Username == choice);
        if (pick.Uid is null || friendIds.Contains(pick.Uid)) return;
        var profile = await _social.GetProfileAsync(pick.Uid);
        var ask = await PadMenu.ShowAsync(_host, pick.Username, profile is { DisplayName.Length: > 0 } ? profile.DisplayName : null,
            new PadOption("Send friend request", IconPath: "send"),
            new PadOption("See profile", IconPath: "profile"),
            new PadOption("Cancel", IconPath: "close"));
        if (ask == "See profile")
        {
            await ShowProfileAsync(_host, profile ?? Blank(pick.Uid, pick.Username));
            ask = await PadMenu.ShowAsync(_host, pick.Username, null,
                new PadOption("Send friend request", IconPath: "send"),
                new PadOption("Cancel", IconPath: "close"));
        }
        if (ask != "Send friend request") return;
        var friends = await _social.SendRequestAsync(pick.Uid);
        await PadMenu.ShowAsync(_host, "Add a friend", friends
            ? $"You and {pick.Username} are friends now!"
            : $"Request sent to {pick.Username}. You become friends when they accept it.", "OK");
        await LoadAsync();
    }

    private async Task RequestsAsync()
    {
        _pending = await _social.GetRequestsAsync();
        if (_pending.Count == 0)
        {
            await PadMenu.ShowAsync(_host, "Friend requests", "No requests right now.", "OK");
            return;
        }
        var options = _pending.Select(r => new PadOption(r.FromUsername, IconPath: "profile", Detail: "Wants to be your friend.")).Append(new PadOption("Close", IconPath: "close")).ToArray();
        var choice = await PadMenu.ShowAsync(_host, "Friend requests", null, options);
        var request = _pending.FirstOrDefault(r => r.FromUsername == choice);
        if (request is null) return;
        var answer = await PadMenu.ShowAsync(_host, request.FromUsername, "Accept the friend request?",
            new PadOption("Accept", IconPath: "confirm"),
            new PadOption("See profile", IconPath: "profile"),
            new PadOption("Decline", IconPath: "close"),
            new PadOption("Later", IconPath: "back"));
        if (answer == "See profile")
        {
            var profile = await _social.GetProfileAsync(request.FromUid);
            await ShowProfileAsync(_host, profile ?? Blank(request.FromUid, request.FromUsername));
            answer = await PadMenu.ShowAsync(_host, request.FromUsername, "Accept the friend request?",
                new PadOption("Accept", IconPath: "confirm"),
                new PadOption("Decline", IconPath: "close"),
                new PadOption("Later", IconPath: "back"));
        }
        if (answer == "Accept") await _social.AcceptAsync(request);
        else if (answer == "Decline") await _social.DeclineAsync(request);
        else return;
        await LoadAsync();
    }
}
