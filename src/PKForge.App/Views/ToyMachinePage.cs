using System.Diagnostics;
using System.Globalization;
using Microsoft.Maui.Controls.Shapes;
using PKForge.App.Services;
using PKForge.App.Theme;
using PKForge.Domain;
using SkiaSharp;
using SkiaSharp.Views.Maui;
using SkiaSharp.Views.Maui.Controls;

namespace PKForge.App.Views;

/// <summary>
/// The toy machine (3DS Bank 2.1): every Pokémon released from the Bank gives a ticket, and a
/// ticket turns the handle once. A capsule drops out and opens on the prize, from silly common
/// items to legendary ones, or the secret "???". The prize is in the Storage before the capsule
/// even falls, so closing the app halfway loses nothing. The odds are on the screen.
/// </summary>
public sealed class ToyMachinePage : ContentPage, IPadHandler, IOverlayHost
{
    // The animation, in milliseconds from the turn of the handle.
    private const long CrankEnd = 1100, DropEnd = 1750, GrowEnd = 2350, OpenEnd = 3000, AutoClose = 9000;

    private readonly StorageService _storage;
    private readonly Grid _host;
    private readonly SKCanvasView _canvas;
    private readonly Label _tickets;
    private readonly Label _stats;
    private readonly Label _prizeRarity;
    private readonly Label _prizeName;
    private readonly Label _prizeChance;
    private readonly Image _prizeIcon;
    private readonly Border _prizeCard;
    private readonly Button _turn;
    private readonly IDispatcherTimer _timer;
    private readonly Stopwatch _clock = Stopwatch.StartNew();
    private readonly List<(float X, float Y, SKColor Top, float Tilt)> _capsules = [];
    private ToyPrize? _pending;
    private ToyPrize? _shown;
    private long _spinStart = -1;
    private SKImage? _prizeArt;
    private string? _prizeArtPath;
    private bool _busy;

    public ToyMachinePage(StorageService storage)
    {
        _storage = storage;
        Title = "Toy Machine";
        BackgroundColor = UiTokens.Housing;
        NavigationPage.SetHasNavigationBar(this, false);
        SeedCapsules();

        var back = Kit.IconButton("back", () => _ = Navigation.PopAsync());
        var header = Kit.HeaderBar("Toy Machine");
        header.VerticalOptions = LayoutOptions.Center;
        var titleRow = new Grid
        {
            ColumnSpacing = 10,
            ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Star)],
            Children = { back, header },
        };
        Grid.SetColumn(header, 1);

        _canvas = new SKCanvasView { EnableTouchEvents = true };
        _canvas.PaintSurface += (_, e) => Paint(e.Surface.Canvas, e.Info);
        _canvas.Touch += (_, e) =>
        {
            e.Handled = true;
            if (e.ActionType == SKTouchAction.Released) Tapped();
        };

        _tickets = new Label { FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextTitle + 3, TextColor = UiTokens.Ink0, VerticalOptions = LayoutOptions.Center };
        var ticketRow = new HorizontalStackLayout { Spacing = 8, Children = { PksmIcons.Icon("ticket", 30, PksmIcons.White), _tickets } };
        var howTo = Small("Release a Pokémon from the Bank to get a ticket. Each ticket turns the handle once, and the prize goes to your Item Storage.");
        _turn = Kit.Capsule("Turn the handle", UiTokens.Green, primary: true, icon: "toymachine");
        _turn.Clicked += (_, _) => _ = TurnAsync();
        var chances = Kit.Capsule("Chances and prizes", UiTokens.AccentInfo, icon: "stats");
        chances.Clicked += (_, _) => _ = Run(ShowChancesAsync);
        var buttons = new FlexLayout
        {
            Wrap = Microsoft.Maui.Layouts.FlexWrap.Wrap,
            Direction = Microsoft.Maui.Layouts.FlexDirection.Row,
            Children = { _turn, chances },
        };
        _turn.Margin = new Thickness(0, 0, 8, 6);
        chances.Margin = new Thickness(0, 0, 8, 6);

        _prizeIcon = new Image { WidthRequest = 48, HeightRequest = 48, Aspect = Aspect.AspectFit, VerticalOptions = LayoutOptions.Center };
        _prizeRarity = new Label { FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextLabel, TextColor = UiTokens.Ink0 };
        _prizeName = new Label { FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextTitle, TextColor = UiTokens.Ink0, LineBreakMode = LineBreakMode.TailTruncation };
        _prizeChance = Small();
        var prizeTexts = new VerticalStackLayout { Spacing = 2, VerticalOptions = LayoutOptions.Center, Children = { _prizeRarity, _prizeName, _prizeChance } };
        var prizeRow = new Grid { ColumnSpacing = 10, ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Star)], Children = { _prizeIcon, prizeTexts } };
        Grid.SetColumn(prizeTexts, 1);
        _prizeCard = new Border
        {
            Padding = new Thickness(10, 8),
            BackgroundColor = UiTokens.Well,
            Stroke = UiTokens.ShellEdge,
            StrokeThickness = 1.5,
            StrokeShape = new RoundRectangle { CornerRadius = 8 },
            Content = prizeRow,
            IsVisible = false,
        };
        _stats = Small();

        var panel = Kit.Panel(new VerticalStackLayout
        {
            Spacing = 10,
            Children = { ticketRow, howTo, buttons, _prizeCard, _stats },
        }, padding: 12);

        var machineHost = new Grid { Children = { _canvas } };
        var body = new Grid
        {
            ColumnSpacing = 12,
            ColumnDefinitions = [new(new GridLength(1.05, GridUnitType.Star)), new(GridLength.Star)],
            Children = { machineHost, new ScrollView { Content = panel } },
        };
        Grid.SetColumn((View)body.Children[1], 1);
        var content = new Grid
        {
            Padding = new Thickness(14, 10),
            RowSpacing = 10,
            RowDefinitions = [new(GridLength.Auto), new(GridLength.Star)],
            Children = { titleRow, body },
        };
        Grid.SetRow(body, 1);
        var root = new Grid
        {
            RowDefinitions = [new(GridLength.Auto), new(GridLength.Star)],
            Children = { DsChrome.TitleBar(), new Grid { Children = { DsChrome.GridBackground(), content } } },
        };
        Grid.SetRow((View)root.Children[1], 1);
        _host = new Grid { Children = { root } };
        Content = _host;

        _timer = Dispatcher.CreateTimer();
        _timer.Interval = TimeSpan.FromMilliseconds(16);
        _timer.Tick += (_, _) =>
        {
            if (_spinStart >= 0 && _clock.ElapsedMilliseconds - _spinStart > AutoClose) Finish();
            _canvas.InvalidateSurface();
        };
    }

    public Grid OverlayHost => _host;

    protected override void OnAppearing()
    {
        base.OnAppearing();
        IPlatformApplication.Current?.Services.GetService<GamepadRouter>()?.Push(this);
        _ = PixelFont.WarmAsync();
        _timer.Start();
        Refresh();
        GlobalPrompts.Flush(this);
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();
        _timer.Stop();
        if (_spinStart >= 0) Finish();
        IPlatformApplication.Current?.Services.GetService<GamepadRouter>()?.Remove(this);
    }

    public bool OnPadButton(PadButton button)
    {
        switch (button)
        {
            case PadButton.A: Tapped(); return true;
            case PadButton.B:
                if (_spinStart >= 0) { if (Elapsed >= GrowEnd) Finish(); return true; }
                _ = Navigation.PopAsync();
                return true;
            case PadButton.X: _ = Run(ShowChancesAsync); return true;
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

    private long Elapsed => _spinStart < 0 ? -1 : _clock.ElapsedMilliseconds - _spinStart;

    private void Refresh()
    {
        var state = _storage.Read();
        _tickets.Text = state.Tickets == 1 ? "1 ticket" : $"{state.Tickets} tickets";
        _turn.IsEnabled = state.Tickets > 0 && _spinStart < 0;
        _stats.Text = $"Handle turned {state.Spins} times · ??? found: {state.Mysteries}";
        if (_shown is not { } prize) return;
        _prizeCard.IsVisible = true;
        _prizeRarity.Text = RarityName(prize.Rarity);
        _prizeRarity.TextColor = RarityColor(prize.Rarity).ToMauiColor();
        _prizeName.Text = _storage.PrizeName(prize);
        _prizeChance.Text = $"Chance: {ToyMachine.Percent(ToyMachine.ChanceOfEach(prize.Rarity), Culture)}";
        if (_prizeArtPath is { } artPath) _prizeIcon.Source = artPath;
    }

    private static CultureInfo Culture => Lang.IsPortuguese ? CultureInfo.GetCultureInfo("pt-BR") : CultureInfo.InvariantCulture;

    private void Tapped()
    {
        if (_spinStart < 0) _ = TurnAsync();
        else if (Elapsed >= GrowEnd) Finish();
    }

    private async Task TurnAsync()
    {
        if (_busy || _spinStart >= 0) return;
        _busy = true;
        try
        {
            ToyPlay play;
            try
            {
                play = _storage.PlayToyMachine();
            }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException or InvalidOperationException)
            {
                AppLog.Warn("toys", error.ToString());
                await PadMenu.ShowAsync(_host, "Toy Machine", error.Message, "OK");
                return;
            }
            if (play.Prize is not { } prize)
            {
                await PadMenu.ShowAsync(_host, "Toy Machine", play.Refusal ?? "The handle would not turn.", "OK");
                return;
            }
            _pending = prize;
            _prizeArt = null;
            _ = LoadArtAsync(prize);
            _spinStart = _clock.ElapsedMilliseconds;
            _turn.IsEnabled = false;
            try { HapticFeedback.Default.Perform(HapticFeedbackType.Click); }
            catch { /* no vibrator, or turned off */ }
        }
        finally
        {
            _busy = false;
        }
    }

    /// <summary>The capsule closes: the prize shows in the panel and the machine is ready again.</summary>
    private void Finish()
    {
        if (_spinStart < 0) return;
        _spinStart = -1;
        _shown = _pending;
        _pending = null;
        Refresh();
        _canvas.InvalidateSurface();
    }

    private async Task LoadArtAsync(ToyPrize prize)
    {
        string? path;
        if (prize.IsMystery) path = ToyArt.MysteryPath();
        else path = await ItemArt.GetAsync(_storage.ItemName(prize.Item)) ?? ItemArt.PlaceholderPath();
        SKImage? art = null;
        try
        {
            if (path is not null && File.Exists(path) && SKBitmap.Decode(path) is { } bitmap)
            {
                art = SKImage.FromBitmap(bitmap);
                bitmap.Dispose();
            }
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException) { }
        MainThread.BeginInvokeOnMainThread(() =>
        {
            if (!ReferenceEquals(prize, _pending) && !ReferenceEquals(prize, _shown)) return;
            _prizeArt = art;
            _prizeArtPath = path;
            if (ReferenceEquals(prize, _shown) && path is not null) _prizeIcon.Source = path;
        });
    }

    private async Task Run(Func<Task> action)
    {
        if (_busy) return;
        _busy = true;
        try
        {
            await action();
        }
        finally
        {
            _busy = false;
            Refresh();
        }
    }

    // ── Chances ──────────────────────────────────────────────────────────────

    private async Task ShowChancesAsync()
    {
        while (true)
        {
            var options = ToyMachine.Odds.Select(odd => new PadOption(
                $"{RarityName(odd.Rarity)} · {ToyMachine.Percent(ToyMachine.ChanceOf(odd.Rarity), Culture)}",
                Accent: RarityColor(odd.Rarity).ToMauiColor(),
                Detail: odd.Rarity == ToyRarity.Secret
                    ? "Only one prize: ???"
                    : $"{ToyMachine.Pool(odd.Rarity).Count} prizes · {ToyMachine.Percent(ToyMachine.ChanceOfEach(odd.Rarity), Culture)} each"))
                .Append(new PadOption("Close", IconPath: "close"))
                .ToArray();
            var pick = await PadMenu.ShowAsync(_host, "Chances",
                "Each turn draws a tier by its chance, then one of its prizes, all equally likely.", options);
            if (pick is null || pick == "Close") return;
            var rarity = ToyMachine.Odds.Select(odd => odd.Rarity).FirstOrDefault(r => pick.StartsWith(RarityName(r) + " ·", StringComparison.Ordinal));
            await ShowPrizesAsync(rarity);
        }
    }

    private async Task ShowPrizesAsync(ToyRarity rarity)
    {
        var each = ToyMachine.Percent(ToyMachine.ChanceOfEach(rarity), Culture);
        var directory = System.IO.Path.Combine(FileSystem.AppDataDirectory, "items");
        var placeholder = ItemArt.PlaceholderPath();
        var pool = ToyMachine.Pool(rarity);
        var items = pool.Select((item, i) =>
        {
            if (item == 0) return new PickItem(i, StorageService.MysteryName, ToyArt.MysteryPath(), $"{each} · nobody knows what it is");
            var name = _storage.ItemName(item);
            var cached = System.IO.Path.Combine(directory, ItemArt.Slug(name) + ".png");
            return new PickItem(i, name, File.Exists(cached) ? cached : placeholder, each);
        }).ToList();
        _ = Task.Run(async () =>
        {
            foreach (var item in pool.Where(item => item > 0)) await ItemArt.GetAsync(_storage.ItemName(item));
        });
        await PickerMenu.ShowAsync(_host, $"Prizes: {RarityName(rarity)}", items);
    }

    // ── Words and colours of the tiers ───────────────────────────────────────

    public static string RarityName(ToyRarity rarity) => rarity switch
    {
        ToyRarity.Common => "Common",
        ToyRarity.Rare => "Rare",
        ToyRarity.Epic => "Epic",
        ToyRarity.Legendary => "Legendary",
        _ => "Secret",
    };

    public static SKColor RarityColor(ToyRarity rarity) => rarity switch
    {
        ToyRarity.Common => new SKColor(0xC9, 0xD2, 0xDC),
        ToyRarity.Rare => new SKColor(0x4D, 0xA3, 0xFF),
        ToyRarity.Epic => new SKColor(0xB8, 0x6C, 0xFF),
        ToyRarity.Legendary => new SKColor(0xFF, 0xC8, 0x3D),
        _ => new SKColor(0xFF, 0x5C, 0xA8),
    };

    // ── Drawing ──────────────────────────────────────────────────────────────

    private static readonly SKColor[] CapsuleTops =
    [
        new(0xF0, 0x55, 0x5A), new(0x4D, 0xA3, 0xFF), new(0xFF, 0xD1, 0x4A), new(0x5C, 0xD6, 0x7E),
        new(0xFF, 0x8F, 0xC7), new(0xB8, 0x6C, 0xFF), new(0xFF, 0x9A, 0x3C),
    ];

    /// <summary>The capsules piled in the clear lower half of the ball (design space: the machine is 300 by 400).</summary>
    private void SeedCapsules()
    {
        var index = 0;
        (float Y, float[] Xs)[] rows =
        [
            (186, [70, 100, 130, 160, 190, 220]),
            (213, [85, 115, 145, 175, 205]),
            (240, [120, 150, 180]),
        ];
        foreach (var (y, xs) in rows)
            foreach (var x in xs)
            {
                _capsules.Add((x, y, CapsuleTops[index % CapsuleTops.Length], (index * 47 % 90) - 45));
                index++;
            }
    }

    private SKSurface? _pixels;
    private SKImageInfo _pixelsInfo;

    /// <summary>
    /// The machine is pixel art: everything is drawn without smoothing on a canvas a few times
    /// smaller than the screen (about 240 pixels tall), then scaled up with nearest sampling.
    /// </summary>
    private void Paint(SKCanvas c, SKImageInfo info)
    {
        c.Clear(SKColors.Transparent);
        var pixel = Math.Max(2, (int)MathF.Round(info.Height / 240f));
        var low = new SKImageInfo(Math.Max(1, info.Width / pixel), Math.Max(1, info.Height / pixel), SKColorType.Rgba8888, SKAlphaType.Premul);
        if (_pixels is null || _pixelsInfo.Width != low.Width || _pixelsInfo.Height != low.Height)
        {
            _pixels?.Dispose();
            _pixels = SKSurface.Create(low);
            _pixelsInfo = low;
        }
        if (_pixels is null) return;
        PaintScene(_pixels.Canvas, low);
        using var image = _pixels.Snapshot();
        using var paint = new SKPaint();
        c.DrawImage(image, SKRect.Create(0, 0, low.Width * pixel, low.Height * pixel), new SKSamplingOptions(SKFilterMode.Nearest), paint);
    }

    private void PaintScene(SKCanvas c, SKImageInfo info)
    {
        c.Clear(SKColors.Transparent);
        var now = _clock.ElapsedMilliseconds;
        var t = Elapsed;
        var scale = Math.Min(info.Width / 300f, info.Height / 400f);
        var left = (info.Width - 300 * scale) / 2;
        var top = (info.Height - 400 * scale) / 2;
        c.Save();
        c.Translate(left, top);
        c.Scale(scale);
        DrawMachine(c, now, t);
        c.Restore();
        if (t >= DropEnd && _pending is { } prize)
            DrawReveal(c, info, t, prize, new SKPoint(left + 150 * scale, top + 350 * scale), 12 * scale);
    }

    // The machine is a Poké Ball on a stand, like the capsule toy: the red top half and the
    // black band with its white button, a clear bottom half full of capsules, then a red base
    // with black and white stripes, the white dial and the silver prize door.
    private static readonly SKColor BallRed = new(0xEE, 0x3B, 0x46);
    private static readonly SKColor BallRedDark = new(0xB2, 0x1C, 0x29);
    private static readonly SKColor BallBlack = new(0x15, 0x15, 0x18);
    private static readonly SKColor BallWhite = new(0xF6, 0xF5, 0xF4);
    private static readonly SKColor BallGrey = new(0xC4, 0xC1, 0xC2);
    private static readonly SKPoint BallCenter = new(150, 150);
    private const float BallRadius = 110;
    private static readonly SKPoint Dial = new(150, 304);
    private static readonly SKRect Door = new(116, 332, 184, 366);

    private void DrawMachine(SKCanvas c, long now, long t)
    {
        // How hard the machine shakes while the dial turns.
        var shake = t is >= 0 and < CrankEnd ? MathF.Sin(MathF.PI * t / CrankEnd) : 0f;

        using (var floor = new SKPaint { Color = SKColors.Black.WithAlpha(70), IsAntialias = false })
            c.DrawOval(150, 394, 104, 7, floor);

        // The base: red body, stripes top and bottom, the dial and the door.
        var body = new SKRect(78, 262, 222, 390);
        using (var path = new SKPath())
        {
            path.MoveTo(body.Left + 10, body.Top);
            path.LineTo(body.Right - 10, body.Top);
            path.LineTo(body.Right, body.Top + 14);
            path.LineTo(body.Right, body.Bottom - 16);
            path.LineTo(body.Right - 14, body.Bottom);
            path.LineTo(body.Left + 14, body.Bottom);
            path.LineTo(body.Left, body.Bottom - 16);
            path.LineTo(body.Left, body.Top + 14);
            path.Close();
            using var red = new SKPaint
            {
                IsAntialias = false,
                Shader = SKShader.CreateLinearGradient(new SKPoint(body.Left, 0), new SKPoint(body.Right, 0),
                    new[] { BallRedDark, BallRed, BallRed, BallRedDark }, new[] { 0f, 0.3f, 0.65f, 1f }, SKShaderTileMode.Clamp),
            };
            c.DrawPath(path, red);
            c.Save();
            c.ClipPath(path, antialias: true);
            using (var black = new SKPaint { Color = BallBlack })
            {
                c.DrawRect(new SKRect(body.Left, body.Top, body.Right, body.Top + 12), black);
                c.DrawRect(new SKRect(body.Left, body.Bottom - 12, body.Right, body.Bottom), black);
            }
            using (var white = new SKPaint { Color = BallWhite })
            {
                c.DrawRect(new SKRect(body.Left, body.Top + 12, body.Right, body.Top + 16), white);
                c.DrawRect(new SKRect(body.Left, body.Bottom - 16, body.Right, body.Bottom - 12), white);
            }
            c.Restore();
            using var rim = new SKPaint { Color = BallBlack, IsAntialias = false, Style = SKPaintStyle.Stroke, StrokeWidth = 2.5f };
            c.DrawPath(path, rim);
        }

        // The dial: one full turn, slow at both ends.
        var turn = t is >= 0 and < CrankEnd ? Ease.InOutCubic(t / (float)CrankEnd) : t >= CrankEnd ? 1f : 0f;
        using (var ring = new SKPaint { Color = BallGrey, IsAntialias = false })
            c.DrawCircle(Dial, 21, ring);
        using (var face = new SKPaint
        {
            IsAntialias = false,
            Shader = SKShader.CreateRadialGradient(new SKPoint(Dial.X - 6, Dial.Y - 6), 22, [SKColors.White, BallWhite, BallGrey], SKShaderTileMode.Clamp),
        })
            c.DrawCircle(Dial, 18, face);
        c.Save();
        c.RotateDegrees(turn * 360, Dial.X, Dial.Y);
        using (var grip = new SKPaint { Color = SKColors.White, IsAntialias = false })
            c.DrawRoundRect(new SKRect(Dial.X - 17, Dial.Y - 5, Dial.X + 17, Dial.Y + 5), 5, 5, grip);
        using (var gripEdge = new SKPaint { Color = BallGrey, IsAntialias = false, Style = SKPaintStyle.Stroke, StrokeWidth = 1.5f })
            c.DrawRoundRect(new SKRect(Dial.X - 17, Dial.Y - 5, Dial.X + 17, Dial.Y + 5), 5, 5, gripEdge);
        c.Restore();

        // The prize door, and the capsule that drops into it.
        using (var frame = new SKPaint
        {
            IsAntialias = false,
            Shader = SKShader.CreateLinearGradient(new SKPoint(0, Door.Top), new SKPoint(0, Door.Bottom),
                [new SKColor(0xE4, 0xE6, 0xE9), new SKColor(0x9C, 0xA3, 0xAB)], SKShaderTileMode.Clamp),
        })
            c.DrawRoundRect(Door, 5, 5, frame);
        var hole = SKRect.Inflate(Door, -6, -5);
        using (var dark = new SKPaint { Color = new SKColor(0x3A, 0x3E, 0x44), IsAntialias = false })
            c.DrawRoundRect(hole, 3, 3, dark);
        if (t is >= CrankEnd and < DropEnd && _pending is { } falling)
        {
            var p = (t - CrankEnd) / (float)(DropEnd - CrankEnd);
            var y = 326 + (350 - 326) * Ease.OutBounce(p);
            c.Save();
            c.ClipRoundRect(new SKRoundRect(hole, 3, 3), antialias: true);
            DrawCapsule(c, new SKPoint(150, y), 12, PrizeTop(falling), falling.IsMystery, 0, 0, 1);
            c.Restore();
        }

        // The collar between the ball and the base.
        using (var collar = new SKPaint { Color = BallBlack, IsAntialias = false })
            c.DrawRoundRect(new SKRect(96, 250, 204, 268), 6, 6, collar);

        // The ball. The lower half is clear: the capsules show through it.
        using var clip = new SKPath();
        clip.AddCircle(BallCenter.X, BallCenter.Y, BallRadius);
        c.Save();
        c.ClipPath(clip, antialias: true);
        using (var inside = new SKPaint { Color = new SKColor(0xDD, 0xEE, 0xF8, 0x48) })
            c.DrawRect(new SKRect(BallCenter.X - BallRadius, BallCenter.Y, BallCenter.X + BallRadius, BallCenter.Y + BallRadius), inside);
        for (var i = 0; i < _capsules.Count; i++)
        {
            var (x, y, color, tilt) = _capsules[i];
            var dx = shake * MathF.Sin(t * 0.045f + i * 1.7f) * 4;
            var dy = shake * MathF.Cos(t * 0.05f + i * 2.3f) * 3 - shake * 4;
            var idle = MathF.Sin(now / 900f + i) * 0.6f;
            DrawCapsule(c, new SKPoint(x + dx, y + dy + idle), 15, color, false, tilt + shake * MathF.Sin(t * 0.03f + i) * 25, 0, 1);
        }
        using (var glassShade = new SKPaint
        {
            Shader = SKShader.CreateRadialGradient(new SKPoint(120, 190), 130,
                [SKColors.White.WithAlpha(0x10), SKColors.White.WithAlpha(0x34)], SKShaderTileMode.Clamp),
        })
            c.DrawRect(new SKRect(BallCenter.X - BallRadius, BallCenter.Y, BallCenter.X + BallRadius, BallCenter.Y + BallRadius), glassShade);
        using (var top = new SKPaint
        {
            IsAntialias = false,
            Shader = SKShader.CreateRadialGradient(new SKPoint(118, 82), 150, [new SKColor(0xFF, 0x6A, 0x72), BallRed, BallRedDark], SKShaderTileMode.Clamp),
        })
            c.DrawRect(new SKRect(BallCenter.X - BallRadius, BallCenter.Y - BallRadius, BallCenter.X + BallRadius, BallCenter.Y), top);
        using (var band = new SKPaint { Color = BallBlack })
            c.DrawRect(new SKRect(BallCenter.X - BallRadius, BallCenter.Y - 9, BallCenter.X + BallRadius, BallCenter.Y + 9), band);
        c.Restore();
        using (var outline = new SKPaint { Color = BallBlack, IsAntialias = false, Style = SKPaintStyle.Stroke, StrokeWidth = 3 })
            c.DrawCircle(BallCenter, BallRadius, outline);
        using (var shine = new SKPaint { Color = SKColors.White.WithAlpha(120), IsAntialias = false, Style = SKPaintStyle.Stroke, StrokeWidth = 8, StrokeCap = SKStrokeCap.Round })
        using (var arc = new SKPath())
        {
            arc.AddArc(new SKRect(BallCenter.X - 88, BallCenter.Y - 88, BallCenter.X + 88, BallCenter.Y + 88), 200, 45);
            c.DrawPath(arc, shine);
        }
        using (var glint = new SKPaint { Color = SKColors.White.WithAlpha(90), IsAntialias = false, Style = SKPaintStyle.Stroke, StrokeWidth = 5, StrokeCap = SKStrokeCap.Round })
        using (var arc = new SKPath())
        {
            arc.AddArc(new SKRect(BallCenter.X - 92, BallCenter.Y - 92, BallCenter.X + 92, BallCenter.Y + 92), 120, 35);
            c.DrawPath(arc, glint);
        }

        // The white button on the band, as on a Poké Ball.
        using (var buttonRing = new SKPaint { Color = BallBlack, IsAntialias = false })
            c.DrawCircle(BallCenter, 30, buttonRing);
        using (var buttonFace = new SKPaint
        {
            IsAntialias = false,
            Shader = SKShader.CreateRadialGradient(new SKPoint(BallCenter.X - 7, BallCenter.Y - 7), 26, [SKColors.White, BallWhite, BallGrey], SKShaderTileMode.Clamp),
        })
            c.DrawCircle(BallCenter, 22, buttonFace);
        using (var inner = new SKPaint { Color = BallGrey, IsAntialias = false, Style = SKPaintStyle.Stroke, StrokeWidth = 2 })
            c.DrawCircle(BallCenter, 13, inner);
    }

    private static SKColor PrizeTop(ToyPrize prize) => prize.IsMystery ? new SKColor(0x2A, 0x24, 0x40) : RarityColor(prize.Rarity);

    /// <summary>
    /// The capsule leaves the machine, grows, wobbles and opens on the prize; the tier's name
    /// sits above it and the item's name and chance below.
    /// </summary>
    private void DrawReveal(SKCanvas c, SKImageInfo info, long t, ToyPrize prize, SKPoint from, float fromRadius)
    {
        var grow = Math.Clamp((t - DropEnd) / (float)(GrowEnd - DropEnd), 0, 1);
        var open = Math.Clamp((t - GrowEnd) / (float)(OpenEnd - GrowEnd), 0, 1);
        var color = RarityColor(prize.Rarity);
        var full = new SKRect(0, 0, info.Width, info.Height);
        using (var dim = new SKPaint { Color = new SKColor(0x08, 0x0C, 0x1C, (byte)(200 * Math.Min(1, grow * 1.4f))) })
            c.DrawRect(full, dim);

        var center = new SKPoint(info.Width / 2f, info.Height * 0.46f);
        var radius = Math.Min(info.Width, info.Height) * 0.15f;
        var g = Ease.OutCubic(grow);
        var at = new SKPoint(from.X + (center.X - from.X) * g, from.Y + (center.Y - from.Y) * g);
        var r = fromRadius + (radius - fromRadius) * Ease.OutBack(grow);

        if (open > 0)
        {
            // Rays and a soft glow in the tier's colour.
            using var glow = new SKPaint
            {
                IsAntialias = false,
                Shader = SKShader.CreateRadialGradient(center, radius * 3.2f,
                    [color.WithAlpha((byte)(150 * open)), color.WithAlpha(0)], SKShaderTileMode.Clamp),
            };
            c.DrawCircle(center, radius * 3.2f, glow);
            var rays = prize.Rarity >= ToyRarity.Legendary ? 16 : 12;
            using var ray = new SKPaint { Color = color.WithAlpha((byte)(70 * open)), IsAntialias = false };
            using var path = new SKPath();
            var spin = t / 1400f;
            for (var i = 0; i < rays; i++)
            {
                var a = spin + i * MathF.PI * 2 / rays;
                path.MoveTo(center);
                path.LineTo(center.X + MathF.Cos(a - 0.09f) * radius * 4, center.Y + MathF.Sin(a - 0.09f) * radius * 4);
                path.LineTo(center.X + MathF.Cos(a + 0.09f) * radius * 4, center.Y + MathF.Sin(a + 0.09f) * radius * 4);
                path.Close();
            }
            c.DrawPath(path, ray);
        }

        // A wobble just before it opens.
        var wobble = grow >= 1 && open < 0.4f ? MathF.Sin(t * 0.07f) * 14 * (1 - open / 0.4f) : 0;
        var split = Ease.OutCubic(Math.Clamp((open - 0.3f) / 0.7f, 0, 1));
        DrawCapsule(c, at, r, PrizeTop(prize), prize.IsMystery, wobble - split * 28, split * r * 1.5f, 1 - split * 0.55f);

        // The prize pops out of the capsule.
        var pop = Ease.OutBack(Math.Clamp((open - 0.35f) / 0.65f, 0, 1));
        if (pop > 0)
        {
            var size = radius * 1.8f * pop;
            var box = new SKRect(center.X - size / 2, center.Y - size / 2, center.X + size / 2, center.Y + size / 2);
            if (_prizeArt is { } art)
            {
                using var sharp = new SKPaint();
                c.DrawImage(art, box, new SKSamplingOptions(SKFilterMode.Nearest), sharp);
            }
            else if (prize.IsMystery)
            {
                DrawMystery(c, box);
            }
            var sparkles = prize.Rarity switch { ToyRarity.Common => 3, ToyRarity.Rare => 5, ToyRarity.Epic => 7, _ => 10 };
            for (var i = 0; i < sparkles; i++)
            {
                var a = t / 900f + i * MathF.PI * 2 / sparkles;
                var d = radius * (1.4f + 0.25f * MathF.Sin(t / 300f + i));
                DrawSparkle(c, new SKPoint(center.X + MathF.Cos(a) * d, center.Y + MathF.Sin(a) * d),
                    radius * 0.14f * pop * (0.7f + 0.3f * MathF.Sin(t / 160f + i * 2)), i % 2 == 0 ? color : SKColors.White);
            }
        }

        var words = Math.Clamp((open - 0.55f) / 0.45f, 0, 1);
        if (words > 0)
        {
            var alpha = (byte)(255 * words);
            var tier = Lang.T(RarityName(prize.Rarity)).ToUpperInvariant() + "!";
            Text(c, tier, center.X, center.Y - radius * 1.55f, radius * 0.42f, color.WithAlpha(alpha));
            Text(c, _storage.PrizeName(prize), center.X, center.Y + radius * 1.55f, radius * 0.34f, SKColors.White.WithAlpha(alpha));
            Text(c, Lang.T($"Chance: {ToyMachine.Percent(ToyMachine.ChanceOfEach(prize.Rarity), Culture)}"),
                center.X, center.Y + radius * 1.95f, radius * 0.22f, SKColors.White.WithAlpha((byte)(200 * words)));
            if (t > OpenEnd + 500)
                Text(c, Lang.T("Tap to continue"), center.X, info.Height - radius * 0.35f, radius * 0.2f,
                    SKColors.White.WithAlpha((byte)(140 + 100 * MathF.Sin(t / 260f))));
        }
    }

    /// <summary>Pixel text: the 12-pixel face at 12 or 24, never in between, with a hard one-pixel drop.</summary>
    private static void Text(SKCanvas c, string text, float x, float y, float size, SKColor color)
    {
        var pixelSize = size >= 18 ? 24f : 12f;
        using var font = PixelFont.For(text, pixelSize);
        font.Edging = SKFontEdging.Alias;
        font.Embolden = false;
        using var shadow = new SKPaint { Color = SKColors.Black.WithAlpha((byte)(color.Alpha * 0.8f)) };
        using var paint = new SKPaint { Color = color };
        var drop = pixelSize >= 24 ? 2 : 1;
        x = MathF.Round(x); y = MathF.Round(y);
        c.DrawText(text, x + drop, y + drop, SKTextAlign.Center, font, shadow);
        c.DrawText(text, x, y, SKTextAlign.Center, font, paint);
    }

    /// <summary>
    /// A capsule: a coloured top half over a white bottom half. <paramref name="lift"/> pulls the
    /// halves apart (the top rises by it, the bottom drops by half of it) and <paramref name="bottomAlpha"/>
    /// fades the bottom as it falls away.
    /// </summary>
    private static void DrawCapsule(SKCanvas c, SKPoint at, float r, SKColor top, bool mystery, float tilt, float lift, float bottomAlpha)
    {
        c.Save();
        c.RotateDegrees(tilt, at.X, at.Y);
        var outline = new SKColor(0x22, 0x1A, 0x2A, 150);
        var bottomRect = new SKRect(at.X - r, at.Y - r + lift * 0.5f, at.X + r, at.Y + r + lift * 0.5f);
        using (var bottom = new SKPaint { Color = (mystery ? new SKColor(0x18, 0x14, 0x24) : new SKColor(0xF7, 0xF7, 0xF4)).WithAlpha((byte)(255 * bottomAlpha)), IsAntialias = false })
            c.DrawArc(bottomRect, 0, 180, true, bottom);
        using (var edge = new SKPaint { Color = outline.WithAlpha((byte)(150 * bottomAlpha)), IsAntialias = false, Style = SKPaintStyle.Stroke, StrokeWidth = Math.Max(1, r * 0.08f) })
            c.DrawArc(bottomRect, 0, 180, true, edge);

        var topRect = new SKRect(at.X - r, at.Y - r - lift, at.X + r, at.Y + r - lift);
        using (var fill = new SKPaint { IsAntialias = false })
        {
            fill.Shader = mystery
                ? SKShader.CreateSweepGradient(new SKPoint(at.X, at.Y - lift),
                    ToyArt.Rainbow)
                : SKShader.CreateLinearGradient(new SKPoint(at.X, topRect.Top), new SKPoint(at.X, at.Y - lift),
                    [Lighter(top), top], SKShaderTileMode.Clamp);
            c.DrawArc(topRect, 180, 180, true, fill);
        }
        using (var edge = new SKPaint { Color = outline, IsAntialias = false, Style = SKPaintStyle.Stroke, StrokeWidth = Math.Max(1, r * 0.08f) })
            c.DrawArc(topRect, 180, 180, true, edge);
        using (var shine = new SKPaint { Color = SKColors.White.WithAlpha(150), IsAntialias = false })
            c.DrawOval(at.X - r * 0.38f, at.Y - lift - r * 0.52f, r * 0.22f, r * 0.13f, shine);
        if (mystery && lift <= 0 && r >= 10)
        {
            using var font = PixelFont.For("?", r >= 20 ? 24 : 12);
            font.Edging = SKFontEdging.Alias;
            using var mark = new SKPaint { Color = SKColors.White };
            c.DrawText("?", MathF.Round(at.X), MathF.Round(at.Y + font.Size * 0.4f), SKTextAlign.Center, font, mark);
        }
        c.Restore();
    }

    private static SKColor Lighter(SKColor color) => new(
        (byte)Math.Min(255, color.Red + 50), (byte)Math.Min(255, color.Green + 50), (byte)Math.Min(255, color.Blue + 50), color.Alpha);

    /// <summary>The secret prize: a dark tile with "???" on it.</summary>
    private static void DrawMystery(SKCanvas c, SKRect box)
    {
        using (var tile = new SKPaint { Color = new SKColor(0x1E, 0x1B, 0x2E), IsAntialias = false })
            c.DrawRoundRect(box, box.Width * 0.18f, box.Width * 0.18f, tile);
        using (var rim = new SKPaint
        {
            IsAntialias = false,
            Style = SKPaintStyle.Stroke,
            StrokeWidth = box.Width * 0.05f,
            Shader = SKShader.CreateSweepGradient(new SKPoint(box.MidX, box.MidY),
                ToyArt.Rainbow),
        })
            c.DrawRoundRect(SKRect.Inflate(box, -box.Width * 0.03f, -box.Width * 0.03f), box.Width * 0.16f, box.Width * 0.16f, rim);
        using var font = PixelFont.For("???", box.Width >= 60 ? 24 : 12);
        font.Edging = SKFontEdging.Alias;
        font.Embolden = false;
        using var paint = new SKPaint { Color = SKColors.White };
        c.DrawText("???", MathF.Round(box.MidX), MathF.Round(box.MidY + font.Size * 0.4f), SKTextAlign.Center, font, paint);
    }

    private static void DrawSparkle(SKCanvas c, SKPoint center, float size, SKColor color)
    {
        if (size <= 0.5f) return;
        using var path = new SKPath();
        path.MoveTo(center.X, center.Y - size);
        path.QuadTo(center.X, center.Y, center.X + size, center.Y);
        path.QuadTo(center.X, center.Y, center.X, center.Y + size);
        path.QuadTo(center.X, center.Y, center.X - size, center.Y);
        path.QuadTo(center.X, center.Y, center.X, center.Y - size);
        path.Close();
        using var fill = new SKPaint { Color = color, IsAntialias = false };
        c.DrawPath(path, fill);
    }

    /// <summary>Easing curves for the animation (t from 0 to 1).</summary>
    private static class Ease
    {
        public static float InOutCubic(float t) => t < 0.5f ? 4 * t * t * t : 1 - MathF.Pow(-2 * t + 2, 3) / 2;

        public static float OutCubic(float t) => 1 - MathF.Pow(1 - t, 3);

        public static float OutBack(float t)
        {
            const float c1 = 1.70158f, c3 = c1 + 1;
            return 1 + c3 * MathF.Pow(t - 1, 3) + c1 * MathF.Pow(t - 1, 2);
        }

        public static float OutBounce(float t)
        {
            const float n = 7.5625f, d = 2.75f;
            if (t < 1 / d) return n * t * t;
            if (t < 2 / d) { t -= 1.5f / d; return n * t * t + 0.75f; }
            if (t < 2.5f / d) { t -= 2.25f / d; return n * t * t + 0.9375f; }
            t -= 2.625f / d;
            return n * t * t + 0.984375f;
        }
    }
}

/// <summary>The secret prize's picture, drawn once into the app's files for lists and the Storage.</summary>
public static class ToyArt
{
    /// <summary>The secret prize's colours, round the rim.</summary>
    public static readonly SKColor[] Rainbow =
    {
        new(0xFF, 0x5C, 0xA8), new(0xFF, 0xD1, 0x4A), new(0x5C, 0xD6, 0x7E),
        new(0x4D, 0xA3, 0xFF), new(0xB8, 0x6C, 0xFF), new(0xFF, 0x5C, 0xA8),
    };

    public static string MysteryPath()
    {
        var path = System.IO.Path.Combine(FileSystem.AppDataDirectory, "items", "_mystery.png");
        if (File.Exists(path)) return path;
        try
        {
            Directory.CreateDirectory(System.IO.Path.GetDirectoryName(path)!);
            var info = new SKImageInfo(48, 48, SKColorType.Rgba8888, SKAlphaType.Premul);
            using var surface = SKSurface.Create(info);
            var c = surface.Canvas;
            c.Clear(SKColors.Transparent);
            using (var tile = new SKPaint { Color = new SKColor(0x1E, 0x1B, 0x2E), IsAntialias = false })
                c.DrawRoundRect(new SKRect(4, 4, 44, 44), 9, 9, tile);
            using (var rim = new SKPaint
            {
                IsAntialias = false,
                Style = SKPaintStyle.Stroke,
                StrokeWidth = 3,
                Shader = SKShader.CreateSweepGradient(new SKPoint(24, 24),
                    ToyArt.Rainbow),
            })
                c.DrawRoundRect(new SKRect(5.5f, 5.5f, 42.5f, 42.5f), 8, 8, rim);
            using (var font = new SKFont(SKTypeface.Default, 17) { Embolden = true, Edging = SKFontEdging.Antialias })
            using (var paint = new SKPaint { Color = SKColors.White, IsAntialias = false })
                c.DrawText("???", 24, 30, SKTextAlign.Center, font, paint);
            using var image = surface.Snapshot();
            using var data = image.Encode(SKEncodedImageFormat.Png, 100);
            File.WriteAllBytes(path, data.ToArray());
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            AppLog.Warn("toys", $"Mystery picture: {error.Message}");
        }
        return path;
    }
}
