using System.Diagnostics;
using PKForge.App.Services;
using PKForge.App.Theme;
using PKForge.Domain;
using SkiaSharp;
using SkiaSharp.Views.Maui.Controls;
using SkiaSharp.Views.Maui;
using Microsoft.Maui.Controls.Shapes;

namespace PKForge.App.Views;

/// <summary>
/// The Poképark: the whole screen is the habitat. An X leaves, the arrow goes to the next
/// habitat, and the habitat's name opens the park's options. A tap on a Pokémon meets it.
/// Each habitat has a garden corner (2.2): four plots for the habitat's own berries from the
/// Item Storage, ripe every twelve hours, and a pot the berries are dragged to; the residents
/// eat from it and gain friendship. Beside the framed habitat (2.4): on the left who lives
/// there and their friendship, on the right the garden's plots and the pot.
/// </summary>
public sealed class PokeparkPage : ContentPage, IPadHandler
{
    private readonly PokeparkService _park;
    private readonly ParkGardenService _garden;
    private readonly StorageService _storage;
    private readonly Label _habitatName;
    private int _dragPlot = -1;
    private SKPoint? _pressAt;
    private long _lastMealCheck = -60_000;
    private readonly PokeparkCareService _care;
    private readonly ISpriteService _sprites;
    private readonly PokeparkSpriteService _walking;
    private readonly PokeparkNarrativeMemory _narrativeMemory;
    private readonly PokeparkSocialService _social;
    private readonly ParkOfflineJournalService _offlineJournal;
    private readonly PokeparkScene _scene;
    private readonly SKCanvasView _canvas = new();
    private readonly Grid _host;
    private readonly IDispatcherTimer _timer;
    private readonly Stopwatch _clock = new();
    private readonly SemaphoreSlim _widgetPublishGate = new(1, 1);
    private readonly object _renderGate = new();
    private CancellationTokenSource? _secondaryShowCts;
    private bool _active;
    private bool _menuOpen;
    private long _lastJournalUpdate;
    private int _widgetRevision;
    private int _publishedWidgetRevision;
    private bool _loading;
    private int _selected;
    private readonly PokeparkResidentsPanel _residentsPanel;
    private readonly PokeparkGardenPanel _gardenPanel;
    private IReadOnlyDictionary<string, int> _friendships = new Dictionary<string, int>();
    private long _lastPanelTick;
    private const double PanelGap = 10, PanelMin = 128, PanelMax = 240;

    public PokeparkPage(PokeparkService park, ISpriteService sprites, PokeparkSpriteService walking,
        PokeparkNarrativeMemory narrativeMemory, PokeparkSocialService social,
        ParkOfflineJournalService offlineJournal, PokeparkCareService care, ParkGardenService garden, StorageService storage)
    {
        _park = park; _care = care; _sprites = sprites; _walking = walking; _garden = garden; _storage = storage;
        _narrativeMemory = narrativeMemory; _social = social; _offlineJournal = offlineJournal;
        _scene = new(sprites, walking);
        Title = "Poképark";
        NavigationPage.SetHasNavigationBar(this, false);
        BackgroundColor = UiTokens.Housing;
        _canvas.EnableTouchEvents = true;
        _canvas.Touch += (_, e) =>
        {
            try { OnTouch(e); }
            catch (Exception error) { AppLog.Warn("park", $"Touch: {error}"); }
        };
        _canvas.PaintSurface += (_, e) =>
        {
            lock (_renderGate)
            {
                // A frame that fails to draw is skipped and logged once, never a crash.
                try { _scene.Draw(e.Surface.Canvas, e.Info.Width, e.Info.Height, _clock.ElapsedMilliseconds); }
                catch (Exception error)
                {
                    if (!_drawFailed) AppLog.Warn("park", $"Draw: {error}");
                    _drawFailed = true;
                }
            }
        };

        // The habitat in a framed screen, its name on the frame's banner (a tap opens the park's
        // options), and under it, centred: previous habitat, leave, next habitat.
        _habitatName = new Label
        {
            FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextTitle + 1, TextColor = UiTokens.Bright,
            HorizontalTextAlignment = TextAlignment.Center, VerticalTextAlignment = TextAlignment.Center,
            LineBreakMode = LineBreakMode.TailTruncation,
        };
        var banner = new Border
        {
            Padding = new Thickness(12, 4),
            Background = new LinearGradientBrush([new GradientStop(UiTokens.ButtonTop, 0), new GradientStop(UiTokens.Paper, 1)], new Point(0, 0), new Point(0, 1)),
            StrokeThickness = 0,
            StrokeShape = new RoundRectangle { CornerRadius = new CornerRadius(8, 8, 0, 0) },
            Content = _habitatName,
        };
        var nameTap = new TapGestureRecognizer();
        nameTap.Tapped += (_, _) => _ = OptionsAsync();
        banner.GestureRecognizers.Add(nameTap);
        var screen = new Border
        {
            Padding = 0,
            BackgroundColor = Colors.Black,
            Stroke = UiTokens.Outline,
            StrokeThickness = 2,
            StrokeShape = new RoundRectangle { CornerRadius = 4 },
            Content = _canvas,
        };
        _frame = new Border
        {
            HorizontalOptions = LayoutOptions.Center,
            VerticalOptions = LayoutOptions.Center,
            Padding = new Thickness(7, 0, 7, 7),
            BackgroundColor = UiTokens.Paper,
            Stroke = UiTokens.ShellEdge,
            StrokeThickness = 2.5,
            StrokeShape = new RoundRectangle { CornerRadius = 10 },
            Shadow = new Shadow { Brush = new SolidColorBrush(Colors.Black), Opacity = 0.6f, Radius = 0, Offset = new Point(4, 4) },
            Content = new VerticalStackLayout { Spacing = 6, Children = { banner, screen } },
        };
        _residentsPanel = new PokeparkResidentsPanel(sprites, walking);
        _gardenPanel = new PokeparkGardenPanel(storage, plot => _ = PlotAsync(plot), () => _ = PotAsync());
        _residentsPanel.Panel.HorizontalOptions = LayoutOptions.End;
        _gardenPanel.Panel.HorizontalOptions = LayoutOptions.Start;
        var stage = new Grid
        {
            ColumnSpacing = PanelGap,
            ColumnDefinitions = [new(GridLength.Star), new(GridLength.Auto), new(GridLength.Star)],
            Children = { _residentsPanel.Panel, _frame, _gardenPanel.Panel },
        };
        Grid.SetColumn(_frame, 1);
        Grid.SetColumn(_gardenPanel.Panel, 2);
        stage.SizeChanged += (_, _) => FitFrame(stage);

        var bar = new HorizontalStackLayout
        {
            Spacing = 12,
            HorizontalOptions = LayoutOptions.Center,
            Children =
            {
                Kit.IconButton("back", () => SwitchEnvironment(-1), 58, 44),
                Kit.IconButton("close", () => _ = Navigation.PopAsync(), 74, 44),
                Kit.IconButton("next", () => SwitchEnvironment(1), 58, 44),
            },
        };
        UpdateHabitatName();
        var layout = new Grid
        {
            Padding = new Thickness(12, 10, 12, 10),
            RowSpacing = 10,
            RowDefinitions = [new(GridLength.Star), new(GridLength.Auto)],
            Children = { stage, bar },
        };
        Grid.SetRow(bar, 1);
        _host = new Grid { SafeAreaEdges = SafeAreaEdges.None, BackgroundColor = UiTokens.Housing, Children = { DsChrome.GridBackground(), layout } };
        Content = _host;
        _timer = Dispatcher.CreateTimer();
        _timer.Interval = TimeSpan.FromMilliseconds(33);
        _timer.Tick += (_, _) =>
        {
            if (_clock.ElapsedMilliseconds - _lastJournalUpdate >= 250)
            {
                try { UpdateJournal(); }
                catch (Exception error) { _lastJournalUpdate = _clock.ElapsedMilliseconds; AppLog.Warn("park", $"Journal: {error.Message}"); }
            }
            if (_clock.ElapsedMilliseconds - _lastPanelTick >= 30_000)
            {
                _lastPanelTick = _clock.ElapsedMilliseconds;
                _gardenPanel.Show(_scene.Garden);
            }
            if (_clock.ElapsedMilliseconds - _lastMealCheck >= 60_000)
            {
                _lastMealCheck = _clock.ElapsedMilliseconds;
                _ = FeedAsync();
            }
            _canvas.InvalidateSurface();
        };
    }

    private SecondScreenClaim? _secondClaim;

    private Border _frame = null!;

    /// <summary>
    /// Sizes the framed screen to the largest 16:9 that fits, so the habitat never letterboxes,
    /// and gives the side panels the room left beside it (never narrower than they can be read;
    /// on a screen too narrow for both, the habitat takes it all and the panels step aside).
    /// </summary>
    private void FitFrame(Grid stage)
    {
        const double chromeWidth = 2 * (7 + 2.5 + 2);
        const double chromeHeight = 7 + 2 * (2.5 + 2) + 6 + 36;
        var height = stage.Height - chromeHeight;
        if (stage.Width <= 0 || height <= 0) return;
        var tallest = height * ParkMap.Width / ParkMap.Height;
        var withPanels = Math.Min(tallest, stage.Width - chromeWidth - 2 * (PanelMin + PanelGap));
        var panels = withPanels >= 240;
        var fitted = panels ? withPanels : Math.Min(tallest, stage.Width - chromeWidth);
        _canvas.WidthRequest = Math.Floor(fitted);
        _canvas.HeightRequest = Math.Floor(fitted * ParkMap.Height / ParkMap.Width);
        var side = Math.Clamp((stage.Width - Math.Floor(fitted) - chromeWidth) / 2 - PanelGap, 0, PanelMax);
        foreach (var panel in new[] { _residentsPanel.Panel, _gardenPanel.Panel })
        {
            panel.IsVisible = panels;
            panel.WidthRequest = Math.Floor(side);
            // As tall as the habitat's frame, so the three line up.
            panel.HeightRequest = Math.Floor(_canvas.HeightRequest + chromeHeight);
            panel.VerticalOptions = LayoutOptions.Center;
        }
    }

    /// <summary>
    /// Touch on the habitat: a ripe tree's berries follow the finger and drop into the pot; a
    /// tap on a plot or the pot tells about it; a tap on a Pokémon meets it.
    /// </summary>
    private void OnTouch(SKTouchEventArgs e)
    {
        e.Handled = true;
        if (_menuOpen) return;
        var size = _canvas.CanvasSize;
        if (size.Width <= 0 || size.Height <= 0) return;
        var map = _scene.ToMap(e.Location.X / size.Width, e.Location.Y / size.Height);
        if (e.ActionType == SKTouchAction.Pressed)
        {
            _pressAt = e.Location;
            _dragPlot = -1;
            if (map is not { } pressed || _scene.Garden is not { } garden) return;
            var hit = _scene.HitGarden(pressed);
            if (hit is < 0 or > 3) return;
            var view = ParkGardenRules.View(garden.Plots[hit], DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            if (view.Stage != PlotStage.Ripe) return;
            _dragPlot = hit;
            _scene.DraggedBerry = (view.Berry, pressed);
            return;
        }
        if (e.ActionType == SKTouchAction.Moved)
        {
            if (_dragPlot >= 0 && map is { } point && _scene.DraggedBerry is { } drag)
                _scene.DraggedBerry = (drag.Berry, point);
            return;
        }
        if (e.ActionType == SKTouchAction.Cancelled)
        {
            _dragPlot = -1;
            _scene.DraggedBerry = null;
            _pressAt = null;
            return;
        }
        if (e.ActionType != SKTouchAction.Released) return;
        var dragged = _dragPlot;
        var moved = _pressAt is { } start && Math.Abs(start.X - e.Location.X) + Math.Abs(start.Y - e.Location.Y) > 24;
        _dragPlot = -1;
        _scene.DraggedBerry = null;
        _pressAt = null;
        if (map is not { } tap) return;
        var target = _scene.HitGarden(tap);
        if (dragged >= 0 && moved)
        {
            if (_scene.NearPot(tap)) _ = HarvestAsync(dragged);
            return;
        }
        if (target == 4) { _ = PotAsync(); return; }
        if (target >= 0) { _ = PlotAsync(target); return; }
        var index = _scene.HitTest(e.Location.X / size.Width, e.Location.Y / size.Height, _clock.ElapsedMilliseconds);
        if (index >= 0) { SelectResident(index); _ = DetailsAsync(); }
    }

    private void UpdateHabitatName()
    {
        var count = Enumerable.Range(0, _scene.Residents.Count).Count(IsVisibleInHabitat);
        _habitatName.Text = count switch
        {
            0 => _scene.EnvironmentName,
            1 => $"{_scene.EnvironmentName}  ·  1 Pokémon",
            _ => $"{_scene.EnvironmentName}  ·  {count} Pokémon",
        };
    }

    protected override void OnAppearing()
    {
        base.OnAppearing(); _active = true;
        _secondClaim ??= IPlatformApplication.Current?.Services.GetService<SecondScreenState>()?.Routes.CreateClaim(SecondScreenOwner.Pokepark);
        _secondClaim?.Activate();
        IPlatformApplication.Current?.Services.GetService<PokeparkJournalState>()?.Open();
        IPlatformApplication.Current?.Services.GetService<GamepadRouter>()?.Push(this);
        App.Resumed += Resume; App.Suspended += Suspend;
        _clock.Start(); _timer.Start();
        _lastMealCheck = _clock.ElapsedMilliseconds - 60_000;
        // The persisted roster is cheap and gives the first paint immediately.
        // Initialization only scans on first use and refreshes this view afterwards.
        Reload();
        _ = LoadParkAsync();
        // A park can be opened from the widget/deep link without passing through
        // HomePage. Ensure Thor's lower display is alive and observing the journal.
        var secondary = IPlatformApplication.Current?.Services.GetService<PKForge.Domain.ISecondaryDisplayHost>();
        if (secondary?.IsAvailable == true)
        {
            _secondaryShowCts?.Cancel();
            _secondaryShowCts?.Dispose();
            _secondaryShowCts = new CancellationTokenSource();
            _ = ShowSecondaryJournalAsync(secondary, _secondaryShowCts.Token);
        }
    }

    private static async Task ShowSecondaryJournalAsync(PKForge.Domain.ISecondaryDisplayHost host, CancellationToken cancellationToken)
    {
        try { await host.ShowPokeparkJournalAsync(cancellationToken); }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
        catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"Poképark second screen: {ex.Message}"); }
    }
    protected override void OnDisappearing()
    {
        _offlineJournal.MarkCurrent();
        _active = false; _timer.Stop(); _clock.Stop();
        _secondaryShowCts?.Cancel();
        _secondaryShowCts?.Dispose();
        _secondaryShowCts = null;
        App.Resumed -= Resume; App.Suspended -= Suspend;
        IPlatformApplication.Current?.Services.GetService<GamepadRouter>()?.Remove(this);
        if (WidgetDirty) _ = PublishWidgetAsync();
        IPlatformApplication.Current?.Services.GetService<PokeparkJournalState>()?.Clear();
        _secondClaim?.Release();
        base.OnDisappearing();
    }
    private void Resume() { if (_active) { _clock.Start(); _timer.Start(); } }
    private void Suspend()
    {
        _offlineJournal.MarkCurrent();
        _timer.Stop(); _clock.Stop(); if (WidgetDirty) _ = PublishWidgetAsync();
    }

    private void RunOfflineLife()
    {
        var offlineResidents = _scene.Residents.Select(mon => new ParkOfflineResident(
            mon.Id, mon.Name, mon.Species, HomeHabitat(mon),
            "exploring and enjoying the park")).ToArray();
        var offline = _offlineJournal.Resume(offlineResidents);
        var socialResidents = _scene.Residents.Select(mon =>
        {
            var types = HabitatCatalog.TypesFor(mon.Species, mon.Form);
            return new ParkSocialPokemon(mon.Id, mon.Name, mon.Species, types,
                PersonalityKind(mon.Id), Habitat: HomeHabitat(mon));
        }).ToArray();
        var social = _social.SimulateOffline(socialResidents);
        var newStories = offline.Events.Select(e => e.Text).Concat(social.Select(e => e.Text)).Take(4).ToArray();
        if (newStories.Length == 0) return;
        MainThread.BeginInvokeOnMainThread(async () =>
        {
            if (!_active || _menuOpen) return;
            _menuOpen = true;
            try
            {
                await PokeparkSpeechBubble.ShowAsync(_host, "While you were away",
                    string.Join("\n\n", newStories));
            }
            finally { _menuOpen = false; }
        });
    }

    private async Task LoadParkAsync()
    {
        if (_loading) return;
        _loading = true;
        try
        {
            var needsInitialization = _scene.Residents.Count == 0;
            await _scene.WarmEnvironmentAsync(_scene.EnvironmentIndex).ConfigureAwait(true);
            if (!_active) return;
            _canvas.InvalidateSurface();
            if (needsInitialization)
            {
                // Let the navigation animation and first frame complete before doing
                // optional first-use population work.
                await Task.Delay(350).ConfigureAwait(true);
                await Task.Run(_park.EnsureInitialized).ConfigureAwait(true);
                if (!_active) return;
                Reload();
            }
            RunOfflineLife();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Poképark load: {ex.Message}");
        }
        finally { _loading = false; }
    }

    private void Reload()
    {
        _scene.Residents = _park.LoadRoster();
        SelectResident(Math.Min(_selected, _scene.Residents.Count - 1));
        UpdateHabitatName();
        RefreshGarden();
        RefreshResidentsPanel();
        _ = LoadFriendshipsAsync();
        UpdateJournal();
        foreach (var mon in _scene.Residents)
        {
            _sprites.Warm(mon.Species, mon.Form, mon.Shiny, AssetsLoaded);
            _walking.Warm(mon.Species, mon.Form, mon.Shiny, AssetsLoaded);
        }
        MarkWidgetDirty();
        _canvas.InvalidateSurface();
    }
    private void AssetsLoaded() => MainThread.BeginInvokeOnMainThread(() =>
    {
        MarkWidgetDirty();
        if (_active) _canvas.InvalidateSurface();
        else _ = PublishWidgetAsync();
    });
    private void SelectResident(int index)
    {
        var visible = Enumerable.Range(0, _scene.Residents.Count).Where(IsVisibleInHabitat).ToArray();
        if (visible.Length == 0)
        {
            _selected = 0;
            _scene.SelectedIndex = -1;
            UpdateJournal();
            _canvas.InvalidateSurface();
            return;
        }
        var position = Array.IndexOf(visible, index);
        if (position < 0) position = index < 0 ? 0 : Array.FindIndex(visible, candidate => candidate > index);
        if (position < 0) position = 0;
        _selected = visible[(position + visible.Length) % visible.Length];
        _scene.SelectedIndex = _scene.Residents.Count == 0 ? -1 : _selected;
        UpdateJournal();
        _canvas.InvalidateSurface();
    }

    private void UpdateJournal()
    {
        _lastJournalUpdate = _clock.ElapsedMilliseconds;
        var journal = IPlatformApplication.Current?.Services.GetService<PokeparkJournalState>();
        if (journal is null || _scene.Residents.Count == 0 || !IsVisibleInHabitat(_selected))
        {
            journal?.Clear();
            return;
        }
        var mon = _scene.Residents[_selected]; var state = _scene.GetResidentState(_selected, _clock.ElapsedMilliseconds); var p = Personality(mon);
        journal.Resident = mon; journal.Mood = state.Mood; journal.Activity = state.Activity; journal.Trait = p.Trait; journal.Likes = p.Likes; journal.Story = p.Story;
    }

    private async Task PublishWidgetAsync()
    {
        if (!PokeparkWidgetPublisher.HasActiveWidgets())
        {
            Volatile.Write(ref _publishedWidgetRevision, Volatile.Read(ref _widgetRevision));
            return;
        }
        if (!await _widgetPublishGate.WaitAsync(0).ConfigureAwait(false)) return;
        try
        {
            var revision = Volatile.Read(ref _widgetRevision);
            var frames = await Task.Run(() =>
            {
                var result = new List<byte[]>(PokeparkWidgetPublisher.FrameCount);
                using var bitmap = new SKBitmap(PokeparkWidgetPublisher.FrameWidth, PokeparkWidgetPublisher.FrameHeight);
                using var canvas = new SKCanvas(bitmap);
                for (var frame = 0; frame < PokeparkWidgetPublisher.FrameCount; frame++)
                {
                    lock (_renderGate)
                        _scene.DrawWidgetFrame(canvas, bitmap.Width, bitmap.Height, frame);
                    using var image = SKImage.FromBitmap(bitmap);
                    using var data = image.Encode(SKEncodedImageFormat.Png, 90);
                    result.Add(data.ToArray());
                }
                return result;
            }).ConfigureAwait(false);
            try { PokeparkWidgetPublisher.Publish(frames); }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            { Debug.WriteLine($"Poképark widget: {ex.Message}"); }
            Volatile.Write(ref _publishedWidgetRevision, revision);
        }
        finally { _widgetPublishGate.Release(); }
    }

    private async Task OptionsAsync()
    {
        if (_menuOpen) return; _menuOpen = true;
        try
        {
            var current = _park.Settings.Source switch
            {
                PokeparkSource.Save => "Save only",
                PokeparkSource.Bank => "Bank only",
                PokeparkSource.Disabled => "Disabled",
                _ => "Save + Bank"
            };
            var choice = await PadMenu.ShowAsync(_host, "Poképark options", $"Auto-fill: {current}. Existing residents are never moved or replaced.",
                "How the garden works", "Park journal", "Auto-fill mode", "Invite Pokémon", "Empty park", "Widget help", "Sprite credits");
            if (choice == "How the garden works")
                await PokeparkSpeechBubble.ShowAsync(_host, "The garden",
                    $"Every habitat has a corner with four plots and a pot. Plant berries from your Item Storage; this habitat grows {BerryList(_scene.EnvironmentIndex)}. "
                    + $"A tree is ripe every 12 hours: drag its berries to the pot. The Bank Pokémon living here eat one berry every hour and gain friendship (+{ParkGardenRules.FriendshipPerBerry}), saved to the Pokémon.");
            if (choice == "Park journal")
                await ShowJournalAsync();
            if (choice == "Auto-fill mode")
            {
                var mode = await PadMenu.ShowAsync(_host, "Auto-fill park", "Choose where automatic residents may come from. Manual invites remain available in every mode.",
                    "Save + Bank", "Save only", "Bank only", "Disabled");
                var source = mode switch
                {
                    "Save only" => PokeparkSource.Save,
                    "Bank only" => PokeparkSource.Bank,
                    "Disabled" => PokeparkSource.Disabled,
                    _ => PokeparkSource.Both
                };
                _park.SaveSettings(_park.Settings with { Source = source });
                await Task.Run(() =>
                {
                    _park.EnsureInitialized();
                    _park.RefreshAutoFill();
                });
                Reload();
            }
            if (choice == "Invite Pokémon") await PokeparkSpeechBubble.ShowAsync(_host, "Park guide", "Open a Pokémon’s action menu in your save boxes or Bank, then choose Send to Poképark. Its original stays right where it is.");
            else if (choice == "Empty park" && _scene.Residents.Count > 0 &&
                     await PadMenu.ConfirmAsync(_host, "Empty the park?", $"Remove all {_scene.Residents.Count} residents from Poképark? Their original Pokémon stay in their save or Bank.", "Empty park"))
            {
                _park.RemoveAllVisitors();
                Reload();
            }
            else if (choice == "Widget help")
                await PadMenu.ShowAsync(_host, "A meadow on your home screen", "Add 3DS Bank Poképark in Cocoon's widget picker. Resize it to give your Pokémon more room. The full meadow shows a quiet, living moment; tap it to return here. Your residents are saved between visits.", "OK");
            else if (choice == "Sprite credits") await CreditsAsync();
        }
        finally { _menuOpen = false; }
    }

    private async Task DetailsAsync()
    {
        if (_menuOpen) return;
        _menuOpen = true;
        try
        {
            if (_scene.Residents.Count == 0)
            {
                await PokeparkSpeechBubble.ShowAsync(_host, "An empty meadow", "Invite a Pokémon from its save-box or Bank action menu with Send to Poképark. Then tap it here to spend some time together.");
                return;
            }
            var mon = _scene.Residents[_selected];
            var state = _scene.GetResidentState(_selected, _clock.ElapsedMilliseconds);
            var personality = Personality(mon);
            var care = _care.Describe(mon);
            var action = await PokeparkResidentCard.ShowAsync(_host, mon, _sprites, _walking,
                state.Mood, state.Activity, personality.Trait, personality.Likes, personality.Story, care);
            if (action is null) return;
            if (action == "nature")
            {
                await ChangeNatureAsync(mon, care);
                return;
            }
            if (action == "leave")
            {
                if (await PadMenu.ConfirmAsync(_host, "Leave the park?", $"Remove {mon.Name} from this meadow? Its original stays in its box. You can invite it again anytime.", "Leave park"))
                { _park.RemoveVisitor(mon.Id); Reload(); }
                return;
            }
            var types = HabitatCatalog.TypesFor(mon.Species, mon.Form);
            var nearby = _scene.Residents.Where((_, i) => i != _selected && IsVisibleInHabitat(i))
                .OrderBy(_ => Random.Shared.Next()).FirstOrDefault()?.Name;
            var dialogue = ParkDialogueGenerator.Generate(new ParkDialogueContext(
                mon.Species, mon.Name, types, (ParkEnvironmentId)_scene.EnvironmentIndex,
                state.Activity, state.Mood, PersonalityKind(mon.Id), action, nearby),
                _narrativeMemory.Recent(mon.Id));
            _narrativeMemory.Remember(mon.Id, dialogue.Id);
            _scene.Interact(_selected, _clock.ElapsedMilliseconds, action);
            await PokeparkSpeechBubble.ShowAsync(_host, mon.Name, dialogue.Text, mon, _sprites, _walking);
        }
        finally { _menuOpen = false; }
    }

    /// <summary>The once-only nature change of a resident that has lived here three hours.</summary>
    private async Task ChangeNatureAsync(ParkPokemon mon, ParkCareInfo care)
    {
        var data = IPlatformApplication.Current?.Services.GetService<IGameDataService>();
        if (data is null) return;
        var picked = await NaturePicker.ShowAsync(_host, data.NatureNames, care.Nature >= 0 ? care.Nature : (int?)null, null, "A new nature, once");
        if (picked is null || (uint)picked.Id >= (uint)data.NatureNames.Count) return;
        if (!await PadMenu.ConfirmAsync(_host, "Change nature?",
                $"{mon.Name} can change its nature only once in its life. Make it {data.NatureNames[picked.Id]}?", "Change"))
            return;
        var message = _care.ChangeNature(mon, picked.Id);
        await PokeparkSpeechBubble.ShowAsync(_host, mon.Name, message, mon, _sprites, _walking);
    }

    private bool _drawFailed;

    private void SwitchEnvironment(int delta)
    {
        if (_menuOpen) return;
        _scene.DraggedBerry = null;
        _dragPlot = -1;
        lock (_renderGate)
            _scene.EnvironmentIndex = (_scene.EnvironmentIndex + delta + 4) % 4;
        try
        {
            SelectResident(0);
        }
        catch (Exception error)
        {
            AppLog.Warn("park", $"Habitat change: {error}");
        }
        UpdateHabitatName();
        RefreshGarden();
        RefreshResidentsPanel();
        MarkWidgetDirty();
        _ = WarmCurrentEnvironmentAsync();
    }

    private async Task WarmCurrentEnvironmentAsync()
    {
        try
        {
            await _scene.WarmEnvironmentAsync(_scene.EnvironmentIndex);
            if (_active) _canvas.InvalidateSurface();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Poképark map load: {ex.Message}");
        }
    }

    private bool WidgetDirty => Volatile.Read(ref _widgetRevision) != Volatile.Read(ref _publishedWidgetRevision);
    private void MarkWidgetDirty() => Interlocked.Increment(ref _widgetRevision);

    private bool IsVisibleInHabitat(int index)
    {
        if (index < 0 || index >= _scene.Residents.Count) return false;
        if (_scene.EnvironmentIndex == 0) return true;
        var mon = _scene.Residents[index];
        var types = HabitatCatalog.TypesFor(mon.Species, mon.Form);
        return _scene.EnvironmentIndex switch
        {
            1 => types.Contains(ParkType.Water),
            2 => types.Contains(ParkType.Fire) || types.Contains(ParkType.Ground) || types.Contains(ParkType.Rock),
            3 => types.Contains(ParkType.Flying) || types.Contains(ParkType.Ice),
            _ => true
        };
    }

    // ── The garden corner ────────────────────────────────────────────────────

    private string BerryName(int berry) => _storage.ItemName(berry);

    private string BerryList(int habitat)
    {
        var names = ParkGardenRules.BerriesFor(habitat).Select(BerryName).ToArray();
        return names.Length == 3 ? $"{names[0]}, {names[1]}{(Lang.IsPortuguese ? " e " : " and ")}{names[2]}" : string.Join(", ", names);
    }

    /// <summary>The garden of the habitat on screen, read again (after every change, and each minute).</summary>
    private void RefreshGarden()
    {
        try { _scene.Garden = _garden.Read(_scene.EnvironmentIndex); }
        catch (Exception error) { AppLog.Warn("park", $"Garden: {error.Message}"); }
        _gardenPanel.Show(_scene.Garden);
        _canvas.InvalidateSurface();
    }

    /// <summary>The left panel: who lives in the habitat on screen, with the friendship last read.</summary>
    private void RefreshResidentsPanel()
    {
        var shown = Enumerable.Range(0, _scene.Residents.Count).Where(IsVisibleInHabitat)
            .Select(index =>
            {
                var mon = _scene.Residents[index];
                return (Index: index, Mon: mon, Friendship: _friendships.TryGetValue(mon.Id, out var friendship) ? friendship : -1);
            })
            .ToList();
        _residentsPanel.Show(shown, index =>
        {
            if (_menuOpen) return;
            SelectResident(index);
            _ = DetailsAsync();
        });
    }

    /// <summary>Reads the Bank residents' friendship off the main thread, then shows it.</summary>
    private async Task LoadFriendshipsAsync()
    {
        var residents = _scene.Residents.ToList();
        try
        {
            _friendships = await Task.Run(() => _care.Friendships(residents));
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or InvalidOperationException)
        {
            AppLog.Warn("park", $"Friendship: {error.Message}");
            return;
        }
        if (_active) RefreshResidentsPanel();
    }

    /// <summary>The residents that live in a habitat (the commons is everyone's).</summary>
    private IReadOnlyList<ParkPokemon> ResidentsOf(int habitat) => habitat == 0
        ? _scene.Residents
        : _scene.Residents.Where(mon =>
        {
            var types = HabitatCatalog.TypesFor(mon.Species, mon.Form);
            return habitat switch
            {
                1 => types.Contains(ParkType.Water),
                2 => types.Contains(ParkType.Fire) || types.Contains(ParkType.Ground) || types.Contains(ParkType.Rock),
                _ => types.Contains(ParkType.Flying) || types.Contains(ParkType.Ice),
            };
        }).ToList();

    /// <summary>Every habitat's residents eat what is due from its pot; the ones on screen show it.</summary>
    private async Task FeedAsync()
    {
        var residents = Enumerable.Range(0, ParkGardenRules.Habitats).Select(ResidentsOf).ToArray();
        var meals = await Task.Run(() => Enumerable.Range(0, ParkGardenRules.Habitats)
            .Select(habitat => (Habitat: habitat, Meals: _garden.Feed(habitat, residents[habitat]))).ToArray());
        if (!_active) return;
        foreach (var (habitat, eaten) in meals)
        {
            if (habitat != _scene.EnvironmentIndex) continue;
            // Several meals while away show once each, a little apart, on whoever ate.
            var delay = 0L;
            foreach (var meal in eaten.TakeLast(4))
            {
                _scene.ShowFloater(meal.Eater.Id, _clock.ElapsedMilliseconds + delay, meal.Friendship >= 0 ? $"+{ParkGardenRules.FriendshipPerBerry}" : "♪");
                delay += 700;
            }
        }
        if (meals.Any(m => m.Meals.Count > 0))
        {
            RefreshGarden();
            _ = LoadFriendshipsAsync();
        }
    }

    private async Task HarvestAsync(int plot)
    {
        var refusal = _garden.Harvest(_scene.EnvironmentIndex, plot);
        RefreshGarden();
        if (refusal is not null) await Say("Garden", refusal);
    }

    private async Task PlotAsync(int plot)
    {
        if (_scene.Garden is not { } garden || _menuOpen) return;
        var habitat = _scene.EnvironmentIndex;
        var view = ParkGardenRules.View(garden.Plots[plot], DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        if (view.Stage == PlotStage.Empty)
        {
            var seeds = _garden.SeedsFor(habitat).Where(seed => seed.Count > 0).ToArray();
            if (seeds.Length == 0)
            {
                await Say("Garden", $"This soil grows {BerryList(habitat)}. Your Item Storage has none of them: they come from the Toy Machine or from a game's bag.");
                return;
            }
            _menuOpen = true;
            string? choice;
            try
            {
                choice = await PadMenu.ShowAsync(_host, "Plant a berry",
                    $"It grows into a tree that gives {ParkGardenRules.BerriesPerHarvest} berries every 12 hours.",
                    [.. seeds.Select(seed => new PadOption($"{BerryName(seed.Berry)} ×{seed.Count}", IconPath: "item")), new PadOption("Close", IconPath: "close")]);
            }
            finally { _menuOpen = false; }
            var picked = seeds.FirstOrDefault(seed => choice == $"{BerryName(seed.Berry)} ×{seed.Count}");
            if (picked.Berry <= 0) return;
            var refusal = _garden.Plant(habitat, plot, picked.Berry);
            RefreshGarden();
            if (refusal is not null) await Say("Garden", refusal);
            return;
        }
        var name = BerryName(view.Berry);
        var state = view.Stage == PlotStage.Ripe
            ? $"Ripe! Drag its berries to the pot so the Pokémon can eat them."
            : $"Ripe in {Duration(view.Left)}. It gives {ParkGardenRules.BerriesPerHarvest} berries every 12 hours.";
        _menuOpen = true;
        string? action;
        try
        {
            var options = new List<PadOption>();
            if (view.Stage == PlotStage.Ripe) options.Add(new PadOption("Put the berries in the pot", IconPath: "item"));
            options.Add(new PadOption("Dig it up", IconPath: "release", Detail: "The tree is gone for good and the plot is free again."));
            options.Add(new PadOption("Close", IconPath: "close"));
            action = await PadMenu.ShowAsync(_host, $"{name} tree", state, [.. options]);
        }
        finally { _menuOpen = false; }
        if (action == "Put the berries in the pot") await HarvestAsync(plot);
        else if (action == "Dig it up" && await PadMenu.ConfirmAsync(_host, "Dig it up?", $"The {name} tree goes away for good.", "Dig it up"))
        {
            _garden.DigUp(habitat, plot);
            RefreshGarden();
        }
    }

    private async Task PotAsync()
    {
        var count = _scene.Garden?.Pot.Count ?? 0;
        var eaters = ResidentsOf(_scene.EnvironmentIndex).Count(mon => PokeparkCareService.BankIdOf(mon) is not null);
        var who = eaters == 0
            ? "No Bank Pokémon lives here yet, so the berries wait."
            : $"The Bank Pokémon living here eat one every hour and gain friendship (+{ParkGardenRules.FriendshipPerBerry} each).";
        await Say("The pot", count == 0
            ? $"It is empty. Drag the berries of a ripe tree here. {who}"
            : $"{count} of {ParkGardenRules.PotCapacity} berries. {who}");
    }

    private async Task Say(string title, string message)
    {
        if (_menuOpen) return;
        _menuOpen = true;
        try { await PadMenu.ShowAsync(_host, title, message, "OK"); }
        finally { _menuOpen = false; }
    }

    private static string Duration(TimeSpan time) =>
        time.TotalHours >= 1 ? $"{(int)time.TotalHours} h {time.Minutes:00} min" : $"{Math.Max(1, (int)Math.Ceiling(time.TotalMinutes))} min";

    private static (string Trait, string Likes, string Story, string Greeting) Personality(ParkPokemon mon)
    {
        uint hash = 2166136261;
        foreach (var letter in mon.Id) hash = (hash ^ letter) * 16777619;
        var types = HabitatCatalog.TypesFor(mon.Species, mon.Form);

        // A few residents have difficult days, shaped by what they are and where
        // they feel most at home. Their needs can change through future interactions.
        if (hash % 5 == 0)
        {
            if (types.Contains(ParkType.Water))
                return ("Homesick swimmer", "quiet water and familiar shores", "Misses the place it came from and keeps searching the pond for a familiar ripple.", "looks toward the lake, then gives you a small, uncertain wave.");
            if (types.Contains(ParkType.Fire))
                return ("Short-tempered spark", "warm stones and plenty of personal space", "Has been on edge all day and snaps at every leaf that lands nearby.", "huffs a tiny puff of smoke, then tries very hard to calm down.");
            if (types.Contains(ParkType.Electric))
                return ("Overloaded thinker", "quiet shade and gentle company", "The meadow feels too loud today, even when everything is perfectly still.", "flinches at a distant rustle and slowly relaxes when you stay nearby.");
            if (types.Contains(ParkType.Ghost) || types.Contains(ParkType.Dark))
                return ("Lonely night wanderer", "dim corners and one trusted friend", "Has spent most of the day at the edge of the meadow, hoping someone will notice.", "keeps its distance, but does not leave when you sit beside it.");
            if (types.Contains(ParkType.Grass) || types.Contains(ParkType.Bug))
                return ("Wilted little heart", "soft rain and untouched grass", "The meadow feels strangely empty today, and even its favorite flowers cannot cheer it up.", "lowers its gaze, then accepts your quiet company.");
            return ("Uneasy visitor", "calm voices and a little extra patience", "Still has not decided whether this park is somewhere it can truly relax.", "watches you carefully, waiting to see whether you will stay.");
        }

        return (hash % 12) switch
        {
            0 => ("Curious explorer", "new paths and rustling grass", "Keeps checking whether that flower has grown since yesterday.", "tilts its head, curious about your day."),
            1 => ("Easygoing dreamer", "quiet afternoons and soft grass", "Has found a sunny patch and considers it the best spot in the park.", "gives you a slow, contented nod."),
            2 => ("Friendly neighbor", "company and little greetings", "Always seems to be nearby when a new resident arrives.", "comes closer to keep you company."),
            3 => ("Playful wanderer", "stretching its legs and surprises", "Once followed a drifting leaf all the way across the meadow.", "does a cheerful little wiggle."),
            4 => ("Thoughtful observer", "watching the pond and peaceful corners", "Is convinced the ripples on the pond are trying to say something.", "pauses its daydream to look up at you."),
            5 => ("Flower enthusiast", "colorful petals and fresh air", "Has a favorite flower, but seems to pick a different one every day.", "looks delighted that you stopped by."),
            6 => ("Tiny pathfinder", "hidden trails and bent blades of grass", "Found a shortcut through the meadow and now checks whether anyone else has discovered it.", "points proudly toward a nearby path."),
            7 => ("Rain listener", "fresh puddles and soft drumming", "Remembers the last rainstorm by the little rings it left in the pond.", "leans closer as if waiting for the clouds to speak."),
            8 => ("Berry guardian", "ripe berries and generous picnics", "Planted a berry seed near the fence and visits it with great responsibility.", "offers you a berry, then keeps one for later."),
            9 => ("Cloud watcher", "open skies and slow afternoons", "Once spent so long watching clouds that it mistook one for a very sleepy Pokémon.", "looks up, then points at a particularly convincing cloud."),
            10 => ("Grassland guide", "tall grass and familiar footsteps", "Can recognize every regular resident by the sound of their walk through the meadow.", "greets you with a knowing little nod."),
            _ => ("Sunset collector", "golden light and quiet goodbyes", "Keeps returning to the same hill to watch the meadow turn amber at day's end.", "settles beside you for one peaceful moment.")
        };
    }

    private static ParkPersonality PersonalityKind(string id)
    {
        uint hash = 2166136261;
        foreach (var letter in id) hash = (hash ^ letter) * 16777619;
        return (hash % 9) switch
        {
            0 => ParkPersonality.Curious,
            1 => ParkPersonality.Calm,
            2 => ParkPersonality.Gentle,
            3 => ParkPersonality.Playful,
            4 => ParkPersonality.Helpful,
            5 => ParkPersonality.Shy,
            6 => ParkPersonality.Energetic,
            7 => ParkPersonality.Proud,
            _ => ParkPersonality.Bold
        };
    }

    private static ParkEnvironmentId HomeHabitat(ParkPokemon mon)
    {
        var types = HabitatCatalog.TypesFor(mon.Species, mon.Form);
        if (types.Contains(ParkType.Water)) return ParkEnvironmentId.WaterfallLake;
        if (types.Contains(ParkType.Fire) || types.Contains(ParkType.Ground))
            return ParkEnvironmentId.EmberGrove;
        if (types.Contains(ParkType.Flying) || types.Contains(ParkType.Ice) || types.Contains(ParkType.Rock))
            return ParkEnvironmentId.SkySummit;
        return ParkEnvironmentId.Commons;
    }

    private async Task ShowJournalAsync()
    {
        var offline = _offlineJournal.Load().Journal.Select(e => (At: e.Timestamp, e.Text));
        var social = _social.Journal(40).Select(e => (At: e.OccurredAt, e.Text));
        var entries = offline.Concat(social).OrderByDescending(e => e.At).Take(12).ToArray();
        if (entries.Length == 0)
        {
            await PokeparkSpeechBubble.ShowAsync(_host, "Park journal",
                "The first pages are still blank. Leave your Pokémon to enjoy the park, then check back later.");
            return;
        }
        var labels = entries.Select((entry, i) =>
            $"{i + 1}. {entry.At.ToLocalTime():ddd HH:mm} · {Shorten(entry.Text, 46)}").ToArray();
        var choice = await PadMenu.ShowAsync(_host, "Park journal",
            "A record of discoveries, friendships, disagreements, and quiet moments while you were away.",
            labels.Concat(["Close"]).ToArray());
        var index = Array.IndexOf(labels, choice);
        if (index >= 0)
            await PokeparkSpeechBubble.ShowAsync(_host, "Park journal", entries[index].Text);
    }

    private static string Shorten(string text, int length) =>
        text.Length <= length ? text : text[..(length - 1)].TrimEnd() + "…";

    private async Task CreditsAsync()
    {
        var residents = _scene.Residents.DistinctBy(p => (p.Species, p.Form, p.Shiny)).ToArray();
        var labels = residents.Select((p, i) => $"{i + 1}. {p.Name}").ToArray();
        var choice = await PadMenu.ShowAsync(_host, "Sprite credits",
            "PMD SpriteCollab · Community sprites: CC BY-NC 4.0. Original PMD sprites: CHUNSOFT. Pokémon © Nintendo / Creatures / GAME FREAK. Sprites displayed with scaling; choose a visitor for its contributors and source.",
            labels.Concat(["Open sprite repository", "Close"]).ToArray());
        if (choice == "Open sprite repository") await Launcher.Default.OpenAsync("https://sprites.pmdcollab.org/");
        var index = Array.IndexOf(labels, choice);
        if (index < 0) return;
        var mon = residents[index];
        var raw = _walking.GetAttribution(mon.Species, mon.Form, mon.Shiny);
        var authors = raw is null ? "Bundled PKHeX sprite; PMD walking sprite unavailable."
            : string.Join(", ", raw.Split('\n', StringSplitOptions.RemoveEmptyEntries)
                .Select(line => line.Split('\t')).Where(parts => parts.Length > 1).Select(parts => parts[1]).Distinct());
        var action = await PadMenu.ShowAsync(_host, mon.Name, authors, "View original credits", "Close");
        if (action == "View original credits") await Launcher.Default.OpenAsync(raw is null
            ? "https://github.com/kwsch/PKHeX"
            : PokeparkSpriteService.GetSourceUrl(mon.Species, mon.Form, mon.Shiny));
    }

    public bool OnPadButton(PadButton button)
    {
        switch (button)
        {
            case PadButton.B: _ = Navigation.PopAsync(); return true;
            case PadButton.A:
            case PadButton.X: _ = DetailsAsync(); return true;
            case PadButton.L: SwitchEnvironment(-1); return true;
            case PadButton.R: SwitchEnvironment(1); return true;
            case PadButton.Left: SelectResident(_selected - 1); return true;
            case PadButton.Right: SelectResident(_selected + 1); return true;
            case PadButton.Start: _ = OptionsAsync(); return true;
            default: return true;
        }
    }
}
