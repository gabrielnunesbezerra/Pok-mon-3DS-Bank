using Microsoft.Maui.Controls.Shapes;
using PKForge.App.Services;
using PKForge.App.Theme;
using PKForge.Domain;
using SkiaSharp;
using SkiaSharp.Views.Maui;
using SkiaSharp.Views.Maui.Controls;

namespace PKForge.App.Views;

/// <summary>
/// The Poképark's side panels (3DS Bank 2.4), in the room a wide phone leaves beside the 16:9
/// habitat. They wear the habitat's frame: a pale panel with a banner on top.
/// </summary>
internal static class PokeparkPanelFrame
{
    public const double SmallText = 12; // the pixel font's own size: crisp

    public static Border Build(string title, View body)
    {
        var banner = new Border
        {
            Padding = new Thickness(8, 4),
            Background = new LinearGradientBrush([new GradientStop(UiTokens.ButtonTop, 0), new GradientStop(UiTokens.Paper, 1)], new Point(0, 0), new Point(0, 1)),
            StrokeThickness = 0,
            StrokeShape = new RoundRectangle { CornerRadius = new CornerRadius(8, 8, 0, 0) },
            Content = new Label
            {
                Text = title, FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextTitle, TextColor = UiTokens.Bright,
                HorizontalTextAlignment = TextAlignment.Center, LineBreakMode = LineBreakMode.TailTruncation,
            },
        };
        var well = new Border
        {
            Padding = new Thickness(4),
            BackgroundColor = UiTokens.Well,
            Stroke = UiTokens.Outline,
            StrokeThickness = 2,
            StrokeShape = new RoundRectangle { CornerRadius = 4 },
            Content = body,
        };
        var content = new Grid { RowSpacing = 6, RowDefinitions = [new(GridLength.Auto), new(GridLength.Star)], Children = { banner, well } };
        Grid.SetRow(well, 1);
        return new Border
        {
            Padding = new Thickness(7, 0, 7, 7),
            BackgroundColor = UiTokens.Paper,
            Stroke = UiTokens.ShellEdge,
            StrokeThickness = 2.5,
            StrokeShape = new RoundRectangle { CornerRadius = 10 },
            Shadow = new Shadow { Brush = new SolidColorBrush(Colors.Black), Opacity = 0.6f, Radius = 0, Offset = new Point(4, 4) },
            Content = content,
        };
    }

    /// <summary>A thin pixel bar: the filled share in white over the recessed well.</summary>
    public static (Grid Bar, Action<double> Set) Bar()
    {
        var fill = new BoxView { Color = UiTokens.Bright };
        var bar = new Grid
        {
            HeightRequest = 6,
            VerticalOptions = LayoutOptions.Center,
            BackgroundColor = UiTokens.Housing,
            ColumnDefinitions = [new(new GridLength(0, GridUnitType.Star)), new(new GridLength(1, GridUnitType.Star))],
            Children = { fill },
        };
        void Set(double share)
        {
            share = Math.Clamp(share, 0, 1);
            bar.ColumnDefinitions[0].Width = new GridLength(share, GridUnitType.Star);
            bar.ColumnDefinitions[1].Width = new GridLength(1 - share, GridUnitType.Star);
            fill.IsVisible = share > 0;
        }
        return (bar, Set);
    }

    public static Label Text(string text, Color color) => new()
    {
        Text = text, FontFamily = DsChrome.PixelFont, FontSize = SmallText, TextColor = color,
        LineBreakMode = LineBreakMode.TailTruncation, VerticalTextAlignment = TextAlignment.Center,
    };

    public static void OnTap(View view, Action action)
    {
        var tap = new TapGestureRecognizer();
        tap.Tapped += (_, _) => action();
        view.GestureRecognizers.Add(tap);
    }
}

/// <summary>Left panel: the Pokémon living in the habitat on screen, each with its friendship.</summary>
internal sealed class PokeparkResidentsPanel
{
    private readonly ISpriteService _sprites;
    private readonly PokeparkSpriteService _walking;
    private readonly VerticalStackLayout _rows = new() { Spacing = 2 };
    private readonly Label _empty = PokeparkPanelFrame.Text("Nobody lives here yet.", UiTokens.Ink1);
    private string _shown = "";

    public PokeparkResidentsPanel(ISpriteService sprites, PokeparkSpriteService walking)
    {
        _sprites = sprites;
        _walking = walking;
        _empty.LineBreakMode = LineBreakMode.WordWrap;
        _empty.Margin = new Thickness(4);
        Panel = PokeparkPanelFrame.Build("Living here", new ScrollView { Content = _rows, VerticalScrollBarVisibility = ScrollBarVisibility.Never });
    }

    public Border Panel { get; }

    /// <summary>
    /// Shows these residents (index into the park's roster, and the friendship, -1 for a
    /// visitor from a save). Rows are only rebuilt when something on them changed.
    /// </summary>
    public void Show(IReadOnlyList<(int Index, ParkPokemon Mon, int Friendship)> residents, Action<int> open)
    {
        var key = string.Join("|", residents.Select(r => $"{r.Index}:{r.Mon.Id}:{r.Mon.Name}:{r.Friendship}"));
        if (key == _shown) return;
        _shown = key;
        _rows.Children.Clear();
        if (residents.Count == 0)
        {
            _rows.Children.Add(_empty);
            return;
        }
        foreach (var (index, mon, friendship) in residents)
            _rows.Children.Add(Row(mon, friendship, () => open(index)));
    }

    private View Row(ParkPokemon mon, int friendship, Action open)
    {
        var portrait = new SKCanvasView { WidthRequest = 34, HeightRequest = 34, InputTransparent = true, VerticalOptions = LayoutOptions.Center };
        portrait.PaintSurface += (_, e) => DrawPortrait(e, mon);
        void Repaint() => MainThread.BeginInvokeOnMainThread(portrait.InvalidateSurface);
        _sprites.Warm(mon.Species, mon.Form, mon.Shiny, Repaint);
        _walking.Warm(mon.Species, mon.Form, mon.Shiny, Repaint);

        var name = PokeparkPanelFrame.Text(mon.Name + (mon.Shiny ? " ★" : ""), UiTokens.Bright);
        View second;
        if (friendship >= 0)
        {
            var (bar, set) = PokeparkPanelFrame.Bar();
            set(friendship / 255.0);
            var heart = PksmIcons.Icon("heart", 12, PksmIcons.White);
            var value = PokeparkPanelFrame.Text(friendship.ToString(System.Globalization.CultureInfo.InvariantCulture), UiTokens.Ink1);
            var line = new Grid
            {
                ColumnSpacing = 4,
                ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Star), new(new GridLength(24))],
                Children = { heart, bar, value },
            };
            Grid.SetColumn(bar, 1);
            Grid.SetColumn(value, 2);
            value.HorizontalTextAlignment = TextAlignment.End;
            second = line;
        }
        else
        {
            // A save's Pokémon only visits: the park never writes into a game's save.
            second = PokeparkPanelFrame.Text("Visiting", UiTokens.Ink1);
        }
        var text = new VerticalStackLayout { Spacing = 3, VerticalOptions = LayoutOptions.Center, Children = { name, second } };
        var grid = new Grid { ColumnSpacing = 6, ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Star)], Children = { portrait, text } };
        Grid.SetColumn(text, 1);
        var row = new Border
        {
            Padding = new Thickness(3, 2),
            BackgroundColor = Colors.Transparent,
            StrokeThickness = 0,
            StrokeShape = new RoundRectangle { CornerRadius = 6 },
            Content = grid,
        };
        PokeparkPanelFrame.OnTap(row, open);
        return row;
    }

    private void DrawPortrait(SKPaintSurfaceEventArgs e, ParkPokemon mon)
    {
        var canvas = e.Surface.Canvas;
        canvas.Clear(SKColors.Transparent);
        var frame = _walking.GetFrame(mon.Species, mon.Form, mon.Shiny, 0, 0, isWalking: false);
        var bitmap = frame?.Bitmap ?? _sprites.GetSprite(mon.Species, mon.Form, mon.Shiny);
        if (bitmap is null) return;
        var source = frame?.Source ?? SKRect.Create(bitmap.Width, bitmap.Height);
        var scale = Math.Min(e.Info.Width / source.Width, e.Info.Height / source.Height);
        var w = source.Width * scale;
        var h = source.Height * scale;
        using var image = SKImage.FromBitmap(bitmap);
        using var paint = new SKPaint { IsAntialias = false };
        // Only the frame's own cell of the sheet shows: the whole sheet is placed so that cell
        // lands on the target, and everything else is clipped away.
        var dest = SKRect.Create((e.Info.Width - w) / 2, (e.Info.Height - h) / 2, w, h);
        canvas.Save();
        canvas.ClipRect(dest);
        canvas.DrawImage(image, SKRect.Create(dest.Left - source.Left * scale, dest.Top - source.Top * scale, bitmap.Width * scale, bitmap.Height * scale),
            new SKSamplingOptions(SKFilterMode.Nearest), paint);
        canvas.Restore();
    }
}

/// <summary>Right panel: the habitat's four plots (what grows and when it is ripe) and the pot.</summary>
internal sealed class PokeparkGardenPanel
{
    private sealed record PlotRow(Image Berry, Image Empty, Label Name, Label State, Action<double> SetGrowth, Grid Bar);

    private readonly StorageService _storage;
    private readonly List<PlotRow> _plots = [];
    private readonly Label _potState;
    private readonly Action<double> _setPot;
    private readonly Dictionary<int, string?> _art = [];

    public PokeparkGardenPanel(StorageService storage, Action<int> openPlot, Action openPot)
    {
        _storage = storage;
        var rows = new VerticalStackLayout { Spacing = 2 };
        for (var i = 0; i < ParkGardenRules.PlotsPerHabitat; i++)
        {
            var plot = i;
            var berry = new Image { WidthRequest = 26, HeightRequest = 26, Aspect = Aspect.AspectFit, InputTransparent = true, VerticalOptions = LayoutOptions.Center };
            var empty = PksmIcons.Icon("tree", 22, PksmIcons.White);
            empty.Opacity = 0.4;
            var name = PokeparkPanelFrame.Text("", UiTokens.Bright);
            var state = PokeparkPanelFrame.Text("", UiTokens.Ink1);
            var (bar, setGrowth) = PokeparkPanelFrame.Bar();
            var text = new VerticalStackLayout { Spacing = 3, VerticalOptions = LayoutOptions.Center, Children = { name, bar, state } };
            var icon = new Grid { WidthRequest = 28, VerticalOptions = LayoutOptions.Center, Children = { berry, empty } };
            var grid = new Grid { ColumnSpacing = 6, ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Star)], Children = { icon, text } };
            Grid.SetColumn(text, 1);
            var row = new Border { Padding = new Thickness(3, 3), BackgroundColor = Colors.Transparent, StrokeThickness = 0, StrokeShape = new RoundRectangle { CornerRadius = 6 }, Content = grid };
            PokeparkPanelFrame.OnTap(row, () => openPlot(plot));
            _plots.Add(new PlotRow(berry, empty, name, state, setGrowth, bar));
            rows.Children.Add(row);
        }

        rows.Children.Add(new BoxView { HeightRequest = 2, Color = UiTokens.Outline, Margin = new Thickness(2, 3) });
        var potIcon = PksmIcons.Icon("item", 22, PksmIcons.White);
        var potName = PokeparkPanelFrame.Text("Pot", UiTokens.Bright);
        _potState = PokeparkPanelFrame.Text("", UiTokens.Ink1);
        var (potBar, setPot) = PokeparkPanelFrame.Bar();
        _setPot = setPot;
        var potText = new VerticalStackLayout { Spacing = 3, VerticalOptions = LayoutOptions.Center, Children = { potName, potBar, _potState } };
        var potGrid = new Grid { ColumnSpacing = 6, ColumnDefinitions = [new(new GridLength(28)), new(GridLength.Star)], Children = { potIcon, potText } };
        Grid.SetColumn(potText, 1);
        var potRow = new Border { Padding = new Thickness(3, 3), BackgroundColor = Colors.Transparent, StrokeThickness = 0, StrokeShape = new RoundRectangle { CornerRadius = 6 }, Content = potGrid };
        PokeparkPanelFrame.OnTap(potRow, openPot);
        rows.Children.Add(potRow);

        Panel = PokeparkPanelFrame.Build("Garden", new ScrollView { Content = rows, VerticalScrollBarVisibility = ScrollBarVisibility.Never });
    }

    public Border Panel { get; }

    /// <summary>Shows the garden as it is now (called after each change and every half minute for the clocks).</summary>
    public void Show(HabitatGarden? garden)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        for (var i = 0; i < _plots.Count; i++)
        {
            var row = _plots[i];
            var view = garden is not null && i < garden.Plots.Count ? ParkGardenRules.View(garden.Plots[i], now) : null;
            if (view is null || view.Stage == PlotStage.Empty)
            {
                row.Berry.IsVisible = false;
                row.Empty.IsVisible = true;
                row.Name.Text = "Empty plot";
                row.Name.TextColor = UiTokens.Ink1;
                row.State.Text = "Tap to plant";
                row.Bar.IsVisible = false;
                continue;
            }
            row.Empty.IsVisible = false;
            row.Berry.IsVisible = true;
            ShowBerry(row.Berry, view.Berry);
            row.Name.Text = _storage.ItemName(view.Berry);
            row.Name.TextColor = UiTokens.Bright;
            row.Bar.IsVisible = true;
            row.SetGrowth(view.Stage == PlotStage.Ripe ? 1 : view.Progress);
            row.State.Text = view.Stage == PlotStage.Ripe ? "Ripe! Drag to the pot" : $"Ripe in {Duration(view.Left)}";
            row.State.TextColor = view.Stage == PlotStage.Ripe ? UiTokens.Bright : UiTokens.Ink1;
        }
        var pot = garden?.Pot.Count ?? 0;
        _setPot(pot / (double)ParkGardenRules.PotCapacity);
        _potState.Text = $"{pot} of {ParkGardenRules.PotCapacity} berries";
    }

    private void ShowBerry(Image image, int berry)
    {
        var tag = berry.ToString(System.Globalization.CultureInfo.InvariantCulture);
        if (image.ClassId == tag) return;
        image.ClassId = tag;
        if (_art.TryGetValue(berry, out var known))
        {
            image.Source = known is null ? null : ImageSource.FromFile(known);
            return;
        }
        image.Source = null;
        _art[berry] = null;
        var name = _storage.ItemName(berry);
        _ = Load();

        async Task Load()
        {
            string path;
            try { path = await ItemArt.GetAsync(name).ConfigureAwait(false) ?? ItemArt.PlaceholderPath(); }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException) { return; }
            MainThread.BeginInvokeOnMainThread(() =>
            {
                _art[berry] = path;
                // The plot may show another berry by now.
                if (image.ClassId == tag) image.Source = ImageSource.FromFile(path);
            });
        }
    }

    private static string Duration(TimeSpan time) =>
        time.TotalHours >= 1 ? $"{(int)time.TotalHours} h {time.Minutes:00}" : $"{Math.Max(1, (int)Math.Ceiling(time.TotalMinutes))} min";
}
