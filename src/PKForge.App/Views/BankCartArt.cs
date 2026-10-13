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

    public static void Paint(SKCanvas c, SKImageInfo info)
    {
        c.Clear(SKColors.Transparent);
        // The cart keeps the game carts' proportions (100 by 112) and is centred in the view.
        var scale = Math.Min(info.Width / 100f, info.Height / 112f);
        var cart = SKRect.Create((info.Width - 100 * scale) / 2, (info.Height - 112 * scale) / 2, 100 * scale, 112 * scale);
        var radius = 9 * scale;
        using var shape = new SKRoundRect(cart, radius, radius);
        c.Save();
        c.ClipRoundRect(shape, antialias: true);
        var middle = cart.Top + cart.Height * 0.56f;
        using (var top = new SKPaint
        {
            IsAntialias = true,
            Shader = SKShader.CreateLinearGradient(new SKPoint(0, cart.Top), new SKPoint(0, middle), [Red, RedDark], SKShaderTileMode.Clamp),
        })
            c.DrawRect(new SKRect(cart.Left, cart.Top, cart.Right, middle), top);
        using (var bottom = new SKPaint
        {
            IsAntialias = true,
            Shader = SKShader.CreateLinearGradient(new SKPoint(0, middle), new SKPoint(0, cart.Bottom), [White, WhiteShade], SKShaderTileMode.Clamp),
        })
            c.DrawRect(new SKRect(cart.Left, middle, cart.Right, cart.Bottom), bottom);
        using (var strip = new SKPaint { Color = Black, IsAntialias = true })
        {
            // The contact strip on top, and the black band across the middle.
            c.DrawRect(new SKRect(cart.Left, cart.Top, cart.Right, cart.Top + 12 * scale), strip);
            c.DrawRect(new SKRect(cart.Left, middle - 5 * scale, cart.Right, middle + 5 * scale), strip);
        }
        using (var shine = new SKPaint { Color = SKColors.White.WithAlpha(60), IsAntialias = true })
            c.DrawRoundRect(new SKRect(cart.Left + 8 * scale, cart.Top + 18 * scale, cart.Left + 15 * scale, middle - 12 * scale), 3 * scale, 3 * scale, shine);
        c.Restore();

        var button = new SKPoint(cart.MidX, middle);
        using (var ring = new SKPaint { Color = Black, IsAntialias = true })
            c.DrawCircle(button, 17 * scale, ring);
        using (var face = new SKPaint { Color = White, IsAntialias = true })
            c.DrawCircle(button, 11.5f * scale, face);
        using (var inner = new SKPaint { Color = WhiteShade, IsAntialias = true, Style = SKPaintStyle.Stroke, StrokeWidth = 2 * scale })
            c.DrawCircle(button, 6.5f * scale, inner);
        using var edge = new SKPaint { Color = Black, IsAntialias = true, Style = SKPaintStyle.Stroke, StrokeWidth = 2.5f * scale };
        c.DrawRoundRect(shape, edge);
    }
}
