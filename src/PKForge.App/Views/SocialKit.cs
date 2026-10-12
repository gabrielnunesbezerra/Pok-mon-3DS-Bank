using PKForge.App.Services;
using PKForge.App.Theme;
using PKForge.Chrome;
using PKForge.Domain;
using PKForge.Infrastructure;
using SkiaSharp;
using SkiaSharp.Views.Maui;
using SkiaSharp.Views.Maui.Controls;

namespace PKForge.App.Views;

/// <summary>A page that can show the app's pop-up windows over itself (invitations, achievements).</summary>
public interface IOverlayHost
{
    /// <summary>The page's root grid, where pop-up windows are layered.</summary>
    Grid OverlayHost { get; }
}

/// <summary>
/// A Pokémon picture for the 3DS Bank 2.0 screens: the HOME render when it is on the phone,
/// else the pixel sprite, on a soft round card, with the shiny mark when it is shiny.
/// </summary>
public sealed class SpriteView : SKCanvasView
{
    private readonly ISpriteService? _sprites = IPlatformApplication.Current?.Services.GetService<ISpriteService>();
    private SpriteLook? _look;
    private bool _waiting;

    public SpriteView(double size = 96)
    {
        WidthRequest = size;
        HeightRequest = size;
        InputTransparent = true;
        PaintSurface += Paint;
    }

    /// <summary>Who to draw; null draws an empty card.</summary>
    public SpriteLook? Look
    {
        get => _look;
        set
        {
            _look = value;
            InvalidateSurface();
        }
    }

    private void Redraw()
    {
        _waiting = false;
        Dispatcher.Dispatch(InvalidateSurface);
    }

    private void Paint(object? sender, SKPaintSurfaceEventArgs args)
    {
        var canvas = args.Surface.Canvas;
        canvas.Clear(SKColors.Transparent);
        var info = args.Info;
        var card = new SKRect(2, 2, info.Width - 2, info.Height - 2);
        var radius = Math.Min(card.Width, card.Height) * 0.22f;
        using (var fill = new SKPaint { Color = StoragePaint.Well.WithAlpha(210), IsAntialias = true })
            canvas.DrawRoundRect(card, radius, radius, fill);
        using (var rim = new SKPaint { Color = EditorPaint.Cyan.WithAlpha(170), IsAntialias = true, Style = SKPaintStyle.Stroke, StrokeWidth = 2 })
            canvas.DrawRoundRect(card, radius, radius, rim);
        if (_look is not { Species: > 0 } look || _sprites is null) return;

        var home = _sprites.GetHome(look);
        if (home is null && !_waiting)
        {
            _waiting = true;
            _sprites.WarmHome(look, Redraw);
        }
        var standIn = home is null && _sprites.HomeUnavailable(look);
        var picture = home ?? (standIn ? _sprites.GetSprite(look) : null);
        if (standIn && picture is null) _sprites.Warm(look, Redraw);
        if (picture is not null)
        {
            var side = Math.Min(card.Width, card.Height) * 0.86f;
            var scale = side / Math.Max(picture.Width, picture.Height);
            var w = picture.Width * scale;
            var h = picture.Height * scale;
            using var image = SKImage.FromBitmap(picture);
            canvas.DrawImage(image, new SKRect(card.MidX - w / 2, card.MidY - h / 2, card.MidX + w / 2, card.MidY + h / 2),
                home is null ? new SKSamplingOptions(SKFilterMode.Nearest, SKMipmapMode.None) : new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear));
        }
        if (look.Shiny)
            ShootingStarArt.DrawSparkle(canvas, new SKPoint(card.Right - radius * 0.9f, card.Top + radius * 0.9f), radius * 0.55f);
    }
}

/// <summary>The Shooting Star's look, drawn in code so it is the same everywhere.</summary>
public static class ShootingStarArt
{
    private static readonly SKColor Gold = new(0xFF, 0xD1, 0x4A);
    private static readonly SKColor Light = new(0xFF, 0xF4, 0xC2);

    /// <summary>A four-point sparkle (the shiny mark).</summary>
    public static void DrawSparkle(SKCanvas canvas, SKPoint center, float size)
    {
        using var path = new SKPath();
        path.MoveTo(center.X, center.Y - size);
        path.QuadTo(center.X, center.Y, center.X + size, center.Y);
        path.QuadTo(center.X, center.Y, center.X, center.Y + size);
        path.QuadTo(center.X, center.Y, center.X - size, center.Y);
        path.QuadTo(center.X, center.Y, center.X, center.Y - size);
        path.Close();
        using var fill = new SKPaint { Color = Gold, IsAntialias = true };
        canvas.DrawPath(path, fill);
        using var edge = new SKPaint { Color = new SKColor(0x8A, 0x5A, 0x00), IsAntialias = true, Style = SKPaintStyle.Stroke, StrokeWidth = Math.Max(1, size / 8) };
        canvas.DrawPath(path, edge);
    }

    /// <summary>The Shooting Star: a five-point star with a streak behind it, filling <paramref name="area"/>.</summary>
    public static void Draw(SKCanvas canvas, SKRect area)
    {
        var size = Math.Min(area.Width, area.Height);
        var center = new SKPoint(area.Left + size * 0.62f, area.Top + size * 0.40f);
        var outer = size * 0.30f;
        var inner = outer * 0.45f;
        // The streak: three tails fading toward the bottom-left.
        for (var i = 0; i < 3; i++)
        {
            var offset = (i - 1) * size * 0.075f;
            using var tail = new SKPaint
            {
                IsAntialias = true,
                StrokeWidth = size * (i == 1 ? 0.11f : 0.07f),
                StrokeCap = SKStrokeCap.Round,
                Style = SKPaintStyle.Stroke,
                Shader = SKShader.CreateLinearGradient(
                    new SKPoint(center.X, center.Y),
                    new SKPoint(area.Left + size * 0.08f, area.Top + size * 0.92f),
                    [Light.WithAlpha(230), Light.WithAlpha(0)],
                    SKShaderTileMode.Clamp),
            };
            canvas.DrawLine(center.X - offset, center.Y + offset, area.Left + size * 0.10f - offset, area.Top + size * 0.90f + offset, tail);
        }
        using var star = new SKPath();
        for (var i = 0; i < 10; i++)
        {
            var r = i % 2 == 0 ? outer : inner;
            var angle = -Math.PI / 2 + i * Math.PI / 5;
            var point = new SKPoint(center.X + (float)(r * Math.Cos(angle)), center.Y + (float)(r * Math.Sin(angle)));
            if (i == 0) star.MoveTo(point);
            else star.LineTo(point);
        }
        star.Close();
        using (var fill = new SKPaint
        {
            IsAntialias = true,
            Shader = SKShader.CreateRadialGradient(center, outer, [Light, Gold], SKShaderTileMode.Clamp),
        })
            canvas.DrawPath(star, fill);
        using (var edge = new SKPaint { Color = new SKColor(0x8A, 0x5A, 0x00), IsAntialias = true, Style = SKPaintStyle.Stroke, StrokeWidth = Math.Max(1.5f, size / 40) })
            canvas.DrawPath(star, edge);
        DrawSparkle(canvas, new SKPoint(area.Left + size * 0.25f, area.Top + size * 0.22f), size * 0.07f);
    }

    /// <summary>A view of the Shooting Star.</summary>
    public static SKCanvasView View(double size)
    {
        var view = new SKCanvasView { WidthRequest = size, HeightRequest = size, InputTransparent = true };
        view.PaintSurface += (_, args) =>
        {
            args.Surface.Canvas.Clear(SKColors.Transparent);
            Draw(args.Surface.Canvas, new SKRect(0, 0, args.Info.Width, args.Info.Height));
        };
        return view;
    }

    /// <summary>The Shooting Star as a PNG file (for menus that show pictures from files).</summary>
    public static string PngPath()
    {
        var path = Path.Combine(FileSystem.CacheDirectory, "shooting-star-v1.png");
        if (File.Exists(path)) return path;
        try
        {
            using var surface = SKSurface.Create(new SKImageInfo(96, 96));
            surface.Canvas.Clear(SKColors.Transparent);
            Draw(surface.Canvas, new SKRect(0, 0, 96, 96));
            using var image = surface.Snapshot();
            using var png = image.Encode(SKEncodedImageFormat.Png, 100);
            File.WriteAllBytes(path, png.ToArray());
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            AppLog.Warn("star", error.Message);
        }
        return path;
    }
}

/// <summary>Pokémon pictures as files, for the menus that show a picture per row.</summary>
public static class SpriteFiles
{
    private static readonly SemaphoreSlim Gate = new(4);

    /// <summary>The pixel sprite of <paramref name="look"/> as a file on the phone, or null.</summary>
    public static async Task<string?> PathAsync(SpriteLook look)
    {
        var directory = Path.Combine(FileSystem.CacheDirectory, "bank-sprites");
        var file = Path.Combine(directory, look.CacheKey + ".png");
        if (File.Exists(file)) return file;
        await Gate.WaitAsync().ConfigureAwait(false);
        try
        {
            if (File.Exists(file)) return file;
            Directory.CreateDirectory(directory);
            foreach (var candidate in SpriteCatalog.BundledCandidates(look))
            {
                try
                {
                    await using var stream = await FileSystem.OpenAppPackageFileAsync(candidate.Path).ConfigureAwait(false);
                    await using var output = File.Create(file);
                    await stream.CopyToAsync(output).ConfigureAwait(false);
                    return file;
                }
                catch (FileNotFoundException)
                {
                    // Next candidate.
                }
            }
            return null;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            return null;
        }
        finally
        {
            Gate.Release();
        }
    }
}

/// <summary>Choosing a Pokémon from the Bank, with its picture, from any screen.</summary>
public static class BankPicker
{
    /// <summary>
    /// Shows the Bank's Pokémon (only those <paramref name="keep"/> accepts) and returns the
    /// chosen one, or null. <paramref name="detail"/> writes the line under each name.
    /// </summary>
    public static async Task<BankEntry?> PickAsync(Grid host, IBankService bank, string title,
        Func<BankEntry, bool>? keep = null, Func<BankEntry, string?>? detail = null)
    {
        var entries = bank.GetAll()
            .Where(e => keep?.Invoke(e) ?? true)
            .OrderBy(e => e.Box).ThenBy(e => e.Slot)
            .ToList();
        if (entries.Count == 0)
        {
            await PadMenu.ShowAsync(host, title, "No Pokémon in your Bank can be chosen for this.", "OK");
            return null;
        }
        var paths = await Task.WhenAll(entries.Select(e => SpriteFiles.PathAsync(e.Info.Look)));
        var items = entries.Select((e, i) => new PickItem(i,
            e.Info.Shiny ? $"{e.Info.Nickname} ★" : e.Info.Nickname,
            paths[i],
            detail?.Invoke(e) ?? $"Lv {e.Info.Level} · Gen {e.Info.Generation} · Box {e.Box + 1:00}")
        {
            Keywords = e.Info.SourceName,
        }).ToList();
        var pick = await PickerMenu.ShowAsync(host, title, items);
        return pick is null ? null : entries[pick.Id];
    }
}

/// <summary>
/// Pop-ups that can arrive anywhere (a friend's trade invitation, a new Shooting Star): shown
/// over the page in front when it can host them, otherwise kept until such a page appears.
/// </summary>
public static class GlobalPrompts
{
    private static readonly Queue<Func<Grid, Task>> Pending = new();
    private static bool _showing;
    private static bool _installed;

    /// <summary>Hooks the invitations and the stars once for the whole app.</summary>
    public static void Install(IServiceProvider services)
    {
        if (_installed) return;
        _installed = true;
        var social = services.GetService<SocialService>();
        var storage = services.GetService<StorageService>();
        if (social is not null)
            social.InviteArrived += invite => Post(host => AskInviteAsync(host, invite));
        if (storage is not null)
            storage.StarsEarned += count => Post(host => StarEarnedAsync(host, count));
    }

    /// <summary>Called by hosting pages when they appear: shows what waited.</summary>
    public static void Flush(IOverlayHost page) => MainThread.BeginInvokeOnMainThread(() => _ = ShowNextAsync(page.OverlayHost));

    private static void Post(Func<Grid, Task> prompt) => MainThread.BeginInvokeOnMainThread(() =>
    {
        Pending.Enqueue(prompt);
        if (CurrentHost() is { } host) _ = ShowNextAsync(host);
    });

    private static async Task ShowNextAsync(Grid host)
    {
        if (_showing) return;
        _showing = true;
        try
        {
            while (Pending.Count > 0)
                await Pending.Dequeue()(host);
        }
        finally
        {
            _showing = false;
        }
    }

    private static Grid? CurrentHost()
    {
        var page = Application.Current?.Windows.FirstOrDefault()?.Page;
        if (page is NavigationPage navigation) page = navigation.CurrentPage;
        return page is IOverlayHost host and not TradePage ? host.OverlayHost : null;
    }

    private static async Task AskInviteAsync(Grid host, TradeInvite invite)
    {
        var services = IPlatformApplication.Current?.Services;
        var social = services?.GetService<SocialService>();
        if (social is null) return;
        var choice = await PadMenu.ShowAsync(host, "Trade invitation",
            $"{invite.FromUsername} wants to trade with you right now.",
            new PadOption("Trade", IconPath: "send", Detail: "Opens the trade screen. Nothing changes until both of you confirm."),
            new PadOption("Not now", IconPath: "close"));
        try
        {
            if (choice == "Trade")
            {
                await social.JoinTradeAsync(invite);
                await TradePage.OpenAsync(invite.TradeId, invite.FromUsername);
            }
            else
            {
                await social.DeclineTradeAsync(invite);
            }
        }
        catch (CloudAccountException error)
        {
            await PadMenu.ShowAsync(host, "Trade", error.Message, "OK");
        }
    }

    private static async Task StarEarnedAsync(Grid host, int count)
    {
        var storage = IPlatformApplication.Current?.Services.GetService<StorageService>();
        var state = storage?.Read();
        var text = count == 1
            ? "Achievement complete! Your Bank reached another 60 Pokémon, and a Shooting Star fell into your Storage."
            : $"Achievement complete! Your Bank earned {count} Shooting Stars. They are in your Storage.";
        if (state is not null)
            text += $"\nUse one on a Bank Pokémon to make it shiny. Next star at {state.NextStarAt} Pokémon.";
        await PadMenu.ShowAsync(host, "Shooting Star!", text, new PadOption("OK", IconPath: "confirm"));
    }
}
