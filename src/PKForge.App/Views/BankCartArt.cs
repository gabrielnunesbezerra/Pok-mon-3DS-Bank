using SkiaSharp;

namespace PKForge.App.Views;

/// <summary>
/// The Bank's cartridge on the Home shelf: a cart in Poké Ball colours (red top, black band
/// with the white button, white bottom) under the dark contact strip the game carts have.
/// </summary>
public static class BankCartArt
{
    private static readonly SKColor Red = new(0xE2, 0x2B, 0x38);
    private static readonly SKColor RedDark = new(0xA8, 0x18, 0x26);
    private static readonly SKColor White = new(0xF4, 0xF2, 0xF2);
    private static readonly SKColor WhiteShade = new(0xC9, 0xC5, 0xC6);
    private static readonly SKColor Black = new(0x14, 0x14, 0x17);

    // The cart is pixel art: drawn small (34 by 38) without smoothing, then scaled up whole.
    private const int ArtWidth = 34, ArtHeight = 38;

    public static void Paint(SKCanvas c, SKImageInfo info)
    {
        c.Clear(SKColors.Transparent);
        using var surface = SKSurface.Create(new SKImageInfo(ArtWidth, ArtHeight, SKColorType.Rgba8888, SKAlphaType.Premul));
        if (surface is null) return;
        DrawCart(surface.Canvas, new SKImageInfo(ArtWidth, ArtHeight));
        using var image = surface.Snapshot();
        var pixel = Math.Max(1, (int)Math.Floor(Math.Min(info.Width / (float)ArtWidth, info.Height / (float)ArtHeight)));
        var dest = SKRect.Create((info.Width - ArtWidth * pixel) / 2, (info.Height - ArtHeight * pixel) / 2, ArtWidth * pixel, ArtHeight * pixel);
        using var paint = new SKPaint();
        c.DrawImage(image, dest, new SKSamplingOptions(SKFilterMode.Nearest), paint);
    }

    private static void DrawCart(SKCanvas c, SKImageInfo info)
    {
        c.Clear(SKColors.Transparent);
        // The cart keeps the game carts' proportions (100 by 112) and is centred in the view.
        var scale = Math.Min(info.Width / 100f, info.Height / 112f);
        var cart = SKRect.Create((info.Width - 100 * scale) / 2, (info.Height - 112 * scale) / 2, 100 * scale, 112 * scale);
        var radius = 9 * scale;
        using var shape = new SKRoundRect(cart, radius, radius);
        c.Save();
        c.ClipRoundRect(shape, antialias: false);
        var middle = cart.Top + cart.Height * 0.56f;
        using (var top = new SKPaint
        {
            IsAntialias = false,
            Shader = SKShader.CreateLinearGradient(new SKPoint(0, cart.Top), new SKPoint(0, middle), [Red, RedDark], SKShaderTileMode.Clamp),
        })
            c.DrawRect(new SKRect(cart.Left, cart.Top, cart.Right, middle), top);
        using (var bottom = new SKPaint
        {
            IsAntialias = false,
            Shader = SKShader.CreateLinearGradient(new SKPoint(0, middle), new SKPoint(0, cart.Bottom), [White, WhiteShade], SKShaderTileMode.Clamp),
        })
            c.DrawRect(new SKRect(cart.Left, middle, cart.Right, cart.Bottom), bottom);
        using (var strip = new SKPaint { Color = Black, IsAntialias = false })
        {
            // The contact strip on top, and the black band across the middle.
            c.DrawRect(new SKRect(cart.Left, cart.Top, cart.Right, cart.Top + 12 * scale), strip);
            c.DrawRect(new SKRect(cart.Left, middle - 5 * scale, cart.Right, middle + 5 * scale), strip);
        }
        using (var shine = new SKPaint { Color = SKColors.White.WithAlpha(60), IsAntialias = false })
            c.DrawRoundRect(new SKRect(cart.Left + 8 * scale, cart.Top + 18 * scale, cart.Left + 15 * scale, middle - 12 * scale), 3 * scale, 3 * scale, shine);
        c.Restore();

        var button = new SKPoint(cart.MidX, middle);
        using (var ring = new SKPaint { Color = Black, IsAntialias = false })
            c.DrawCircle(button, 17 * scale, ring);
        using (var face = new SKPaint { Color = White, IsAntialias = false })
            c.DrawCircle(button, 11.5f * scale, face);
        using (var inner = new SKPaint { Color = WhiteShade, IsAntialias = false, Style = SKPaintStyle.Stroke, StrokeWidth = 2 * scale })
            c.DrawCircle(button, 6.5f * scale, inner);
        using var edge = new SKPaint { Color = Black, IsAntialias = false, Style = SKPaintStyle.Stroke, StrokeWidth = 2.5f * scale };
        c.DrawRoundRect(shape, edge);
    }
}
