using System.Diagnostics;
using System.Globalization;
using Microsoft.Maui.Controls.Shapes;
using PKForge.App.Services;
using PKForge.App.Theme;
using PKForge.Domain;
using PKForge.Infrastructure;
using SkiaSharp;
using SkiaSharp.Views.Maui;
using SkiaSharp.Views.Maui.Controls;

namespace PKForge.App.Views;

/// <summary>
/// 3DS Bank 2.5's Arena: the event the admin set up (its Champion, its prizes, the leaderboard)
/// and the battle itself, a real-time fight seen from above. The left thumb moves (a stick
/// appears where it touches), the right thumb uses the four moves and dodges. A physical
/// controller works too: the D-pad moves, A, X, Y and B are the moves, L and R dodge.
/// </summary>
public sealed class ArenaPage : ContentPage, IPadHandler, IPadReleaseHandler, IOverlayHost
{
    private const float StepSeconds = 1 / 120f;
    private const float IntroSeconds = 2.6f;

    private readonly ArenaService _arena;
    private readonly AccountService _account;
    private readonly Grid _host;
    private readonly Grid _lobbyHost;
    private readonly VerticalStackLayout _lobby;
    private readonly Label _status;
    private ArenaEvent? _event;
    private ArenaResult? _mine;
    private bool _busy;

    // The battle.
    private SKGLView? _view;
    private ArenaBattle? _battle;
    private ArenaRenderer? _renderer;
    private readonly ArenaControls _controls = new();
    private readonly Stopwatch _clock = new();
    private double _last;
    private float _accumulator;
    private float _intro;
    private int _introShown;
    private bool _ended;
    private float _endTime;
    private string _resultText = "";
    private string _resultDetail = "";
    private ArenaMon? _loaner;
    private float _density = 2;
    private float _padX, _padY;
    private int _padCast = -1;
    private bool _padDodge;

    public ArenaPage(ArenaService arena, AccountService account)
    {
        _arena = arena;
        _account = account;
        Title = "Arena";
        BackgroundColor = UiTokens.Housing;
        NavigationPage.SetHasNavigationBar(this, false);

        var back = Kit.IconButton("back", () => _ = Navigation.PopAsync());
        var header = Kit.HeaderBar("Arena");
        header.VerticalOptions = LayoutOptions.Center;
        var refresh = Kit.IconButton("refresh", () => _ = Run(LoadAsync));
        var titleRow = new Grid
        {
            ColumnSpacing = 10,
            ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Star), new(GridLength.Auto)],
            Children = { back, header, refresh },
        };
        Grid.SetColumn(header, 1);
        Grid.SetColumn(refresh, 2);

        _status = Small("Loading the Arena…");
        _status.TextColor = UiTokens.Ink0;
        _lobby = new VerticalStackLayout { Spacing = 10 };
        var content = new Grid
        {
            Padding = new Thickness(14, 10),
            RowSpacing = 10,
            RowDefinitions = [new(GridLength.Auto), new(GridLength.Auto), new(GridLength.Star)],
            Children = { titleRow, _status, new ScrollView { Content = _lobby } },
        };
        Grid.SetRow(_status, 1);
        Grid.SetRow((View)content.Children[2], 2);
        var root = new Grid
        {
            SafeAreaEdges = SafeAreaEdges.None,
            RowDefinitions = [new(GridLength.Auto), new(GridLength.Star)],
            Children = { DsChrome.TitleBar(), DsChrome.FullBleed(new Grid { Children = { DsChrome.GridBackground(), content } }) },
        };
        Grid.SetRow((View)root.Children[1], 1);
        _lobbyHost = root;
        _host = DsChrome.FullBleed(new Grid { Children = { root } });
        Content = _host;
        _controls.Again += () => MainThread.BeginInvokeOnMainThread(() => _ = Run(FightAgainAsync));
        _controls.Leave += () => MainThread.BeginInvokeOnMainThread(EndBattleView);
    }

    public Grid OverlayHost => _host;

    protected override void OnAppearing()
    {
        base.OnAppearing();
        IPlatformApplication.Current?.Services.GetService<GamepadRouter>()?.Push(this);
        _ = PixelFont.WarmAsync();
        if (_battle is null) _ = Run(LoadAsync);
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();
        IPlatformApplication.Current?.Services.GetService<GamepadRouter>()?.Remove(this);
        EndBattleView();
    }

    protected override bool OnBackButtonPressed()
    {
        if (_battle is null) return base.OnBackButtonPressed();
        EndBattleView();
        return true;
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
            await PadMenu.ShowAsync(_host, "Arena", error.Message, "OK");
        }
        catch (Exception error) when (error is IOException or InvalidOperationException or HttpRequestException or FormatException)
        {
            AppLog.Warn("arena", error.ToString());
            _status.Text = error.Message;
        }
        finally
        {
            _busy = false;
        }
    }

    // ── The lobby ────────────────────────────────────────────────────────────

    private async Task LoadAsync()
    {
        _status.Text = "Loading the Arena…";
        _event = await _arena.GetEventAsync();
        _lobby.Children.Clear();
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (_event is null || !_event.IsOpen(now))
        {
            _status.Text = "";
            _lobby.Children.Add(Kit.Panel(new VerticalStackLayout
            {
                Spacing = 6,
                Children =
                {
                    new Label { Text = "No event right now", FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextTitle + 4, TextColor = UiTokens.Ink0 },
                    Small(_account.IsAdmin
                        ? "Set one up in Admin > Arena: pick your Champion, the Pokémon players fight with and the prizes."
                        : "The next Arena event is coming soon. Keep an eye on this screen!"),
                },
            }, padding: 16));
            return;
        }
        var results = await _arena.GetResultsAsync(_event.Id);
        _mine = results.FirstOrDefault(r => r.Uid == _account.UserId);
        _status.Text = _event.EndsUnixMs > 0 ? $"Closes {Until(_event.EndsUnixMs)}." : "Open now.";
        BuildLobby(_event, results);
        // A win whose prizes did not arrive (the app closed) is paid now.
        if (_mine is { Wins: > 0, Claimed: false } unpaid && await _arena.ClaimAsync(_event, unpaid) is { } given)
            await PadMenu.ShowAsync(_host, "Prizes!", given, new PadOption("OK", IconPath: "confirm"));
    }

    private void BuildLobby(ArenaEvent arenaEvent, IReadOnlyList<ArenaResult> results)
    {
        var title = new Label { Text = arenaEvent.Title, FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextTitle + 8, TextColor = UiTokens.Bright };
        var description = Small(arenaEvent.Description);
        description.TextColor = UiTokens.Ink0;
        description.FontSize = UiTokens.TextBody;

        var battles = results.Sum(r => r.Battles);
        var wins = results.Sum(r => r.Wins);
        var championSprite = new SpriteView(120) { Look = new SpriteLook(arenaEvent.Champion.Species, arenaEvent.Champion.Form, arenaEvent.Champion.Shiny) };
        var championTexts = new VerticalStackLayout
        {
            Spacing = 4,
            VerticalOptions = LayoutOptions.Center,
            Children =
            {
                Small("THE CHAMPION"),
                new Label { Text = $"@{arenaEvent.ChampionName}", FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextTitle + 2, TextColor = UiTokens.Gold },
                new Label
                {
                    Text = arenaEvent.Champion.Shiny ? $"{arenaEvent.Champion.Nickname} ★" : arenaEvent.Champion.Nickname,
                    FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextTitle, TextColor = UiTokens.Ink0,
                },
                Small(battles == 0 ? "Nobody has challenged the Champion yet. Be the first!"
                    : wins == 0 ? $"Undefeated after {battles} challenges."
                    : $"{battles} challenges · beaten {wins} times."),
            },
        };
        var championRow = new Grid { ColumnSpacing = 14, ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Star)], Children = { championSprite, championTexts } };
        Grid.SetColumn(championTexts, 1);

        var prizes = new VerticalStackLayout { Spacing = 4 };
        prizes.Children.Add(new Label { Text = "PRIZES FOR BEATING THE CHAMPION", FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextBody, TextColor = UiTokens.Gold });
        if (arenaEvent.Rewards.Count == 0) prizes.Children.Add(Small("Glory, and the right to say you did it."));
        foreach (var reward in arenaEvent.Rewards)
            prizes.Children.Add(new Label { Text = $"★ {reward.Name}", FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextTitle, TextColor = UiTokens.Ink0 });
        var prizePanel = new Border
        {
            Padding = new Thickness(14, 10),
            BackgroundColor = UiTokens.Well,
            Stroke = UiTokens.Gold,
            StrokeThickness = 3,
            StrokeShape = new RoundRectangle { CornerRadius = 10 },
            Content = prizes,
        };

        var fight = new Border
        {
            HeightRequest = 64,
            Background = new LinearGradientBrush([new GradientStop(Color.FromRgb(0xFF, 0x7A, 0x45), 0), new GradientStop(Color.FromRgb(0xD8, 0x2B, 0x2B), 1)], new Point(0, 0), new Point(0, 1)),
            Stroke = UiTokens.ButtonEdge,
            StrokeThickness = 2.5,
            StrokeShape = new RoundRectangle { CornerRadius = 14 },
            Shadow = new Shadow { Brush = new SolidColorBrush(Colors.Black), Opacity = 0.65f, Radius = 0, Offset = new Point(3, 4) },
            Content = new Label
            {
                Text = "FIGHT THE CHAMPION", FontFamily = DsChrome.PixelFont, FontSize = 26, TextColor = Colors.White,
                HorizontalTextAlignment = TextAlignment.Center, VerticalTextAlignment = TextAlignment.Center,
            },
        };
        var tap = new TapGestureRecognizer();
        tap.Tapped += async (_, _) =>
        {
            await fight.ScaleToAsync(0.96, 60, Easing.CubicOut);
            await fight.ScaleToAsync(1, 90, Easing.CubicOut);
            _ = Run(StartAsync);
        };
        fight.GestureRecognizers.Add(tap);

        var record = Small(_mine is null
            ? "Your record: no battles yet."
            : $"Your record: {_mine.Battles} battles · {_mine.Wins} wins · best {_mine.BestDamage}% of the Champion's HP.");
        record.TextColor = UiTokens.Ink0;

        var board = new VerticalStackLayout { Spacing = 4 };
        board.Children.Add(new Label { Text = "Leaderboard", FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextTitle, TextColor = UiTokens.Ink0 });
        if (results.Count == 0) board.Children.Add(Small("Nobody yet."));
        foreach (var (result, place) in results.Take(10).Select((r, i) => (r, i + 1)))
        {
            var line = Small($"{place}. @{result.Username} · {(result.Wins > 0 ? $"{result.Wins} wins · " : "")}best {result.BestDamage}% · {result.Battles} battles");
            line.TextColor = result.Uid == _account.UserId ? UiTokens.Gold : UiTokens.Ink0;
            board.Children.Add(line);
        }

        var help = Small("How to play: your left thumb moves (the stick appears where you touch), the buttons on the right use your moves, " +
                         "and the round button dodges. Every Pokémon fights at level 50 with its own moves, types, IVs and EVs. 99 seconds on the clock.");

        _lobby.Children.Add(Kit.Panel(new VerticalStackLayout { Spacing = 8, Children = { title, description, championRow } }, padding: 14));
        _lobby.Children.Add(prizePanel);
        _lobby.Children.Add(fight);
        _lobby.Children.Add(record);
        _lobby.Children.Add(Kit.Panel(board, padding: 12));
        _lobby.Children.Add(help);
    }

    // ── Starting a battle ────────────────────────────────────────────────────

    private async Task StartAsync()
    {
        if (_event is not { } arenaEvent) return;
        if (!arenaEvent.IsOpen(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()))
        {
            await LoadAsync();
            return;
        }
        var loaner = await PickLoanerAsync(arenaEvent);
        if (loaner is null) return;
        await BeginAsync(arenaEvent, loaner);
    }

    private async Task<ArenaMon?> PickLoanerAsync(ArenaEvent arenaEvent)
    {
        if (arenaEvent.Loaners.Count == 0) return null;
        if (arenaEvent.Loaners.Count == 1) return arenaEvent.Loaners[0];
        var paths = await Task.WhenAll(arenaEvent.Loaners.Select(mon => SpriteFiles.PathAsync(new SpriteLook(mon.Species, mon.Form, mon.Shiny))));
        var items = arenaEvent.Loaners.Select((mon, i) =>
        {
            var spec = _arena.Fighter(mon);
            var types = spec is null ? "" : spec.Type2 != spec.Type1
                ? $"{ArenaTypes.Names[spec.Type1]}/{ArenaTypes.Names[spec.Type2]}" : ArenaTypes.Names[spec.Type1];
            var moves = spec is null ? "" : string.Join(", ", spec.Moves.Select(m => m.Name));
            return new PickItem(i, mon.Shiny ? $"{mon.Nickname} ★" : mon.Nickname, paths[i], $"{types} · {moves}");
        }).ToList();
        var pick = await PickerMenu.ShowAsync(_host, "Pick your Pokémon", items);
        return pick is null ? null : arenaEvent.Loaners[pick.Id];
    }

    private async Task BeginAsync(ArenaEvent arenaEvent, ArenaMon loaner)
    {
        var player = _arena.Fighter(loaner);
        var champion = _arena.Fighter(arenaEvent.Champion);
        if (player is null || champion is null)
        {
            await PadMenu.ShowAsync(_host, "Arena", "That Pokémon could not enter the Arena.", "OK");
            return;
        }
        _loaner = loaner;
        var walking = IPlatformApplication.Current?.Services.GetService<PokeparkSpriteService>();
        var sprites = IPlatformApplication.Current?.Services.GetService<ISpriteService>();
        foreach (var spec in new[] { player, champion })
        {
            walking?.Warm(spec.Species, spec.Form, spec.Shiny, () => { });
            sprites?.Warm(spec.Species, spec.Form, spec.Shiny, () => { });
        }

        _density = (float)Math.Max(1, DeviceDisplay.Current.MainDisplayInfo.Density);
        _battle = new ArenaBattle(player, champion, arenaEvent.ChampionAura, Environment.TickCount);
        // The drawing runs on its own (GL) thread: an old renderer is let go, never disposed under it.
        _renderer = new ArenaRenderer();
        _ended = false;
        _endTime = 0;
        _intro = IntroSeconds;
        _introShown = 0;
        _accumulator = 0;
        _padX = _padY = 0;
        _padCast = -1;
        _padDodge = false;
        _controls.Reset();

        if (_view is null)
        {
            _view = new SKGLView { EnableTouchEvents = true, HasRenderLoop = true, IgnorePixelScaling = false };
            _view.PaintSurface += PaintBattle;
            _view.Touch += (_, e) =>
            {
                _controls.Touch(e);
                e.Handled = true;
            };
            _host.Children.Add(_view);
        }
        _view.HasRenderLoop = true;
        _lobbyHost.IsVisible = false;
        DeviceDisplay.Current.KeepScreenOn = true;
        _clock.Restart();
        _last = 0;
    }

    private async Task FightAgainAsync()
    {
        if (_event is null || _loaner is null) return;
        await BeginAsync(_event, _loaner);
    }

    private void EndBattleView()
    {
        if (_view is not null)
        {
            _view.HasRenderLoop = false;
            _view.PaintSurface -= PaintBattle;
            _host.Children.Remove(_view);
            _view = null;
        }
        _battle = null;
        _renderer = null;
        _lobbyHost.IsVisible = true;
        DeviceDisplay.Current.KeepScreenOn = false;
        _ = Run(LoadAsync);
    }

    // ── The battle loop ──────────────────────────────────────────────────────

    /// <summary>One frame, on the view's GL thread: only the battle, the renderer and the controls are touched here.</summary>
    private void PaintBattle(object? sender, SKPaintGLSurfaceEventArgs e)
    {
        var canvas = e.Surface.Canvas;
        var bounds = canvas.DeviceClipBounds;
        var view = new SKRect(bounds.Left, bounds.Top, bounds.Right, bounds.Bottom);
        var battle = _battle;
        var renderer = _renderer;
        if (battle is null || renderer is null)
        {
            canvas.Clear(SKColors.Black);
            return;
        }
        var density = _density;
        _controls.Layout(view, density, battle.Player.Moves);

        var now = _clock.Elapsed.TotalSeconds;
        var dt = (float)Math.Clamp(now - _last, 0, 0.05);
        _last = now;

        if (_intro > 0)
        {
            _intro -= dt;
            var beat = (int)((IntroSeconds - _intro) / 0.65f);
            if (beat >= _introShown && _introShown < 4)
            {
                renderer.Banner(_introShown < 3 ? (3 - _introShown).ToString(CultureInfo.InvariantCulture) : "FIGHT!",
                    _introShown < 3 ? SKColors.White : new SKColor(255, 200, 80), 0.62f);
                _introShown++;
            }
        }
        else if (battle.Outcome == ArenaOutcome.Running)
        {
            _accumulator += dt;
            var (stickX, stickY) = _controls.Stick;
            var moveX = Math.Clamp(stickX + _padX, -1, 1);
            var moveY = Math.Clamp(stickY + _padY, -1, 1);
            var cast = _controls.TakeCast();
            if (cast < 0) cast = Interlocked.Exchange(ref _padCast, -1);
            var dodge = _controls.TakeDodge() | _padDodge;
            _padDodge = false;
            while (_accumulator >= StepSeconds)
            {
                battle.Step(StepSeconds, new ArenaInput(moveX, moveY, cast, dodge));
                cast = -1;
                dodge = false;
                _accumulator -= StepSeconds;
            }
        }
        else if (!_ended)
        {
            _ended = true;
            _endTime = 0;
            Finished(battle);
        }
        else
        {
            // The last effects keep playing out behind the result.
            _endTime += dt;
        }

        renderer.Absorb(battle.TakeEffects());
        renderer.Update(dt, battle);
        var championLabel = _event is null ? "Champion" : $"@{_event.ChampionName} · {battle.Champion.Spec.Nickname}";
        renderer.Draw(canvas, view, battle, championLabel, density);
        if (_intro <= 0 && !_ended) _controls.Draw(canvas, battle.Player);
        if (_ended && _endTime > 1.4f)
            _controls.DrawResult(canvas, view, _resultText, _resultDetail, battle.Outcome == ArenaOutcome.PlayerWon, Math.Min(1, (_endTime - 1.4f) / 0.35f));
    }

    private void Finished(ArenaBattle battle)
    {
        var won = battle.Outcome == ArenaOutcome.PlayerWon;
        var damage = battle.BestDamagePercent;
        _resultText = won ? "VICTORY!" : "DEFEAT";
        _resultDetail = won
            ? $"You beat the Champion! The prizes are on their way to your Item Storage."
            : $"You took {damage}% of the Champion's HP. So close! Try again.";
        if (_event is not { } arenaEvent) return;
        _ = Task.Run(async () =>
        {
            try
            {
                var result = await _arena.RecordAsync(arenaEvent, won, damage);
                _mine = result;
                if (won && await _arena.ClaimAsync(arenaEvent, result) is { } given) _resultDetail = given;
                else if (!won && damage >= result.BestDamage && result.Battles > 1) _resultDetail += $" New best: {damage}%!";
            }
            catch (Exception error) when (error is CloudAccountException or IOException or HttpRequestException)
            {
                AppLog.Warn("arena", $"Recording the battle: {error.Message}");
            }
        });
    }

    // ── The controller ───────────────────────────────────────────────────────

    public bool OnPadButton(PadButton button)
    {
        if (_battle is null)
        {
            if (button == PadButton.B)
            {
                _ = Navigation.PopAsync();
                return true;
            }
            if (button == PadButton.A)
            {
                _ = Run(StartAsync);
                return true;
            }
            return false;
        }
        switch (button)
        {
            case PadButton.Left: _padX = -1; return true;
            case PadButton.Right: _padX = 1; return true;
            case PadButton.Up: _padY = -1; return true;
            case PadButton.Down: _padY = 1; return true;
            case PadButton.A: _padCast = 0; return true;
            case PadButton.X: _padCast = 1; return true;
            case PadButton.Y: _padCast = 2; return true;
            case PadButton.B:
                if (_ended) EndBattleView();
                else _padCast = 3;
                return true;
            case PadButton.L or PadButton.R: _padDodge = true; return true;
            case PadButton.Start:
                if (_ended) _ = Run(FightAgainAsync);
                return true;
            default: return false;
        }
    }

    public void OnPadReleased(PadButton button)
    {
        switch (button)
        {
            case PadButton.Left or PadButton.Right: _padX = 0; break;
            case PadButton.Up or PadButton.Down: _padY = 0; break;
        }
    }

    // ── Pieces ───────────────────────────────────────────────────────────────

    private static string Until(long ms)
    {
        var left = DateTimeOffset.FromUnixTimeMilliseconds(ms) - DateTimeOffset.UtcNow;
        if (left.TotalHours < 1) return $"in {Math.Max(1, (int)left.TotalMinutes)} min";
        if (left.TotalHours < 48) return $"in {(int)left.TotalHours} h";
        return $"on {DateTimeOffset.FromUnixTimeMilliseconds(ms).ToLocalTime():dd/MM}";
    }

    private static Label Small(string? text = null) => new()
    {
        Text = text,
        FontFamily = DsChrome.PixelFont,
        FontSize = UiTokens.TextSmall,
        TextColor = UiTokens.InkSoft,
        LineBreakMode = LineBreakMode.WordWrap,
    };
}
