using CommunityToolkit.Mvvm.ComponentModel;
using PKForge.Chrome;
using SkiaSharp;

namespace PKForge.App.Theme;

/// <summary>
/// MAUI-facing design tokens. The single source of truth for colors is <see cref="Pksm"/>
/// (PKForge.Chrome); this maps those SKColors to MAUI Colors so views never hardcode values.
/// Chrome tokens follow the current <see cref="ColorTheme"/>; signals (legality, shiny, the
/// summary page accents, the gift world) keep their values in every theme.
/// Design language: the PKSM/DS-era storage world rebuilt in the logo's dark pixel grid,
/// with layered navy panels, cobalt structure, cyan focus light, and adaptive pale ink.
/// </summary>
public static class UiTokens
{
    private static Color As(SKColor c) => Color.FromRgb(c.Red, c.Green, c.Blue);

    // One Color instance per token and theme: views compare a control's color against a token
    // to read its state, which only holds while the token keeps returning the same instance.
    private static readonly Dictionary<string, Color> Cache = [];
    private static int _cacheVersion = -1;

    private static Color Themed(Color value, [System.Runtime.CompilerServices.CallerMemberName] string token = "")
    {
        lock (Cache)
        {
            if (_cacheVersion != ColorTheme.Version)
            {
                Cache.Clear();
                _cacheVersion = ColorTheme.Version;
            }
            if (Cache.TryGetValue(token, out var cached)) return cached;
            Cache[token] = value;
            return value;
        }
    }

    // ---- Surfaces ----
    public static Color Paper => Themed(As(Pksm.Paper));              // white content cards on worlds
    public static Color PaperShade => Themed(As(Pksm.PaperShade));
    public static Color Shell => Themed(As(Pksm.Paper));               // white chrome windows
    public static Color ShellEdge => Themed(As(Pksm.PaperEdge));        // soft grey border
    public static Color ShellPress => Themed(As(Pksm.PaperShade));
    public static Color Housing => Themed(As(Pksm.Housing));           // the grey grid page backdrop

    // Legacy names still referenced by views; do not add uses.
    public static Color LcdBg => Themed(As(Pksm.PaperShade));
    public static Color LcdText => Themed(As(Pksm.Ink));
    public static Color LcdFrame => Themed(As(Pksm.PaperEdge));
    public static Color Navy0 => Themed(As(Pksm.Paper));
    public static Color Navy1 => Themed(As(Pksm.Ink));
    public static Color Blueprint => Themed(As(Pksm.SelectBorder));

    // ---- Ink ----
    public static Color Ink0 => Themed(As(Pksm.Ink));
    public static Color Ink1 => Themed(As(Pksm.InkSoft));
    public static Color InkSoft => Themed(As(Pksm.InkSoft));
    public static Color SelectInk => Themed(As(Pksm.SelectInk));
    public static Color SelectBorder => Themed(As(Pksm.SelectBorder));
    public static Color SelectFill => Themed(As(Pksm.SelectFill));

    // ---- Chrome accents ----
    public static Color Maroon => Themed(As(Pksm.HeaderBlue));       // legacy name: logo-navy header strips
    public static Color MaroonDeep => Themed(As(Pksm.ButtonBlueDeep));
    public static Color Indigo => Themed(As(Pksm.Indigo));
    public static Color IndigoLight => Themed(As(Pksm.IndigoLight));
    public static Color IndigoInk => Themed(As(Pksm.IndigoInk));
    public static Color MenuBlue => Themed(As(Pksm.StorageMenuBlue));
    public static Color MenuBlueDeep => Themed(As(Pksm.StorageMenuBlueDeep));

    // ---- Button language ----
    public static Color ChoiceFill => Themed(As(Pksm.Paper));
    public static Color ChoiceFillPress => Themed(As(Pksm.SelectFill));
    public static Color ChoiceRim => Themed(As(Pksm.ButtonBlue));
    public static Color ChoiceRimDeep => Themed(As(Pksm.ButtonBlueDeep));
    public static Color Cyan => Themed(As(Pksm.ButtonBlue));
    public static Color Blue => Themed(As(Pksm.StorageMenuBlue));

    // ---- Worlds ----
    public static Color SummaryBg => Themed(As(Pksm.SummaryBg));
    public static readonly Color RibbonGold = As(Pksm.RibbonGold);
    public static readonly Color GiftPink = As(Pksm.GiftPink);
    public static readonly Color GiftPinkLight = As(Pksm.GiftPinkLight);
    public static readonly Color GiftRed = As(Pksm.GiftRed);
    public static Color BagNavy => Themed(As(Pksm.BagNavy));
    public static Color BagNavyDeep => Themed(As(Pksm.BagNavyDeep));
    public static Color BagCyan => Themed(As(Pksm.BagCyan));
    public static Color BagCyanEdge => Themed(As(Pksm.BagCyanEdge));

    // ---- Signal (functional, reserved) ----
    public static readonly Color Green = As(Pksm.Legal);
    public static readonly Color Yellow = As(Pksm.ShinyGold);
    public static readonly Color Gold = As(Pksm.ShinyGold);   // shiny mark only
    public static readonly Color RedOrange = As(Pksm.Illegal);
    public static readonly Color Ok = Green;
    public static readonly Color Warn = As(Pksm.ShinyGold);
    public static readonly Color Bad = As(Pksm.Illegal);
    public static Color DefaultAccent => Themed(Cyan);

    public static Color Bright => Themed(As(ColorTheme.Current.Bright));   // pure white chrome: titles, highlights
    public static Color WorldText => Themed(As(Pksm.Ink));
    public static Color WorldTextMuted => Themed(As(Pksm.InkSoft));
    public static Color OnAccent => Themed(As(Pksm.LogoVoid));
    public static Color Scrim => Themed(As(Pksm.LogoVoid).WithAlpha(0xCC / 255f));

    // ---- The designer's editor rows ----
    public static Color EditorLabel => Themed(As(EditorPaint.Label));
    public static Color EditorValue => Themed(As(EditorPaint.Value));
    public static Color EditorChipInk => Themed(As(EditorPaint.ChipInk));
    public static Color ToolFill => Themed(As(ColorTheme.Current.ToolFill));
    public static Color ToolEdge => Themed(As(ColorTheme.Current.ToolEdge));

    // ---- Skia twins for the grid renderers ----
    public static SKColor SkPaper => Pksm.Paper;
    public static SKColor SkChrome => Pksm.PaperEdge;
    public static SKColor SkInk => Pksm.Ink;
    public static SKColor SkMenuBlue => Pksm.StorageMenuBlue;
    public static SKColor SkFocusGold => Pksm.FocusBlue;
    public static readonly SKColor SkShinyGold = Pksm.ShinyGold;
    public static readonly SKColor SkCursorRed = Pksm.CursorRed;
    public static SKColor SkDefaultAccent => Pksm.SelectBorder;
    public static SKColor SkLcdBg => Pksm.PaperShade;
    public static SKColor SkLcdText => Pksm.Ink;
    public static SKColor SkLcdTileEdge => Pksm.PaperEdge;
    public static SKColor SkEmptyMark => Pksm.PaperShade;

    // ---- The approved summary language, as tokens (one source for every screen) ----

    // Type scale (dp). Nothing readable goes under TextSmall; no tracking, no forced caps.
    public const double TextSmall = 12.5;   // captions, detail lines, secondary facts
    public const double TextBody = 13.5;    // body copy, row values, buttons
    public const double TextLabel = 14;     // row labels, hint labels
    public const double TextTitle = 15;     // header strips, menu rows
    public const double TextHeading = 17;   // screen / hero names

    // Spacing rhythm (dp): 4 / 8 / 12 / 16 - pick by relationship, not by habit.
    public const double Space1 = 4;
    public const double Space2 = 8;
    public const double Space3 = 12;
    public const double Space4 = 16;

    // Shape.
    public const double PanelRadius = 6;    // device panels
    public const double ControlRadius = 4;  // strips, rows, tabs, buttons
    public const double PanelEdge = 2;      // the cobalt bezel
    public const double ControlEdge = 1.5;  // menu-button edge

    public static Color PanelTop => Themed(As(PksmPaint.Lighter(Pksm.Paper, 0.05f)));       // faint top light
    public static Color PanelShadow => Themed(As(Pksm.LogoVoid));                            // hard pixel drop
    public static Color StripTop => Themed(As(PksmPaint.Lighter(Pksm.HeaderBlue, 0.16f)));
    public static Color StripBottom => Themed(As(PksmPaint.Darker(Pksm.HeaderBlue, 0.1f)));
    public static Color ButtonTop => Themed(As(PksmPaint.Lighter(Pksm.LogoDeck, 0.04f)));
    public static Color ButtonBottom => Themed(As(PksmPaint.Darker(Pksm.LogoDeck, 0.05f)));
    public static Color ButtonEdge => Themed(As(Pksm.LogoGrid));                             // cobalt
    public static Color Outline => Themed(As(Pksm.ButtonBlueDeep));                          // void outline
    public static Color Rim => Themed(As(Pksm.Ink).WithAlpha(0x70 / 255f));                // the pale focus rim
    public static Color RowStripe => Themed(As(Pksm.PaperShade).WithAlpha(0x90 / 255f));
    public static Color Divider => Themed(As(Pksm.PaperEdge).WithAlpha(0x70 / 255f));
    public static Color Well => Themed(As(Pksm.PaperShade));                                 // recessed field / inset

    // Toned per-context accents (the summary bands): quiet surfaces, never neon edges.
    public static readonly Color AccentInfo = As(Pksm.BandInfo);
    public static readonly Color AccentStats = As(Pksm.BandStats);
    public static readonly Color AccentMoves = As(Pksm.BandMoves);
    public static readonly Color AccentOrigin = As(Pksm.BandOrigin);
    public static readonly Color AccentLegal = As(Pksm.BandLegal);
    public static Color AccentDanger => Themed(As(PksmPaint.Tone(Pksm.Illegal)));
    public static Color AccentGift => Themed(As(PksmPaint.Tone(Pksm.GiftRed)));
    public static Color AccentNeutral => Themed(As(Pksm.HeaderBlue));

    /// <summary>A signal colour toned into the navy world (for filled accent surfaces).</summary>
    public static Color Tone(Color signal)
    {
        var sk = PksmPaint.Tone(new SKColor((byte)(signal.Red * 255), (byte)(signal.Green * 255), (byte)(signal.Blue * 255)));
        return As(sk);
    }

    /// <summary>Readable text colour for a signal used AS text on navy (chips become plain coloured text).</summary>
    public static Color TextTone(Color signal) =>
        signal.GetLuminosity() < 0.62f ? signal.WithLuminosity(0.66f) : signal;
}

/// <summary>The 18 Pokémon type colors (PKHeX type IDs 0–17), adaptive-theme source.</summary>
public static class TypePalette
{
    private static readonly string[] Colors =
    [
        "#A8A77A", "#C22E28", "#A98FF3", "#A33EA1", "#E2BF65", "#B6A136",
        "#A6B91A", "#735797", "#B7B7CE", "#EE8130", "#6390F0", "#7AC74C",
        "#F7D02C", "#F95587", "#96D9D6", "#6F35FC", "#705746", "#D685AD",
    ];

    public static Color ForType(int typeId) =>
        (uint)typeId < (uint)Colors.Length ? Color.FromArgb(Colors[typeId]) : UiTokens.DefaultAccent;

    public static Color ForegroundForType(int typeId)
    {
        var color = ForType(typeId);
        var luminance = 0.299f * color.Red + 0.587f * color.Green + 0.114f * color.Blue;
        return luminance >= 0.58f ? UiTokens.OnAccent : Microsoft.Maui.Graphics.Colors.White;
    }
}

/// <summary>Owns the adaptive accent derived from the selected Pokémon's type(s).</summary>
public partial class ThemeService : ObservableObject
{
    [ObservableProperty] private Color _accent = UiTokens.DefaultAccent;
    [ObservableProperty] private SKColor _skAccent = UiTokens.SkDefaultAccent;

    public void ApplyTypes(IReadOnlyList<int>? types)
    {
        var baseColor = types is { Count: > 0 } ? TypePalette.ForType(types[0]) : UiTokens.DefaultAccent;
        var adjusted = WithSaturation(baseColor, 0.85f);
        Accent = adjusted;
        SkAccent = new SKColor(
            (byte)(adjusted.Red * 255), (byte)(adjusted.Green * 255), (byte)(adjusted.Blue * 255));
    }

    /// <summary>Scales HSL saturation so theme color never competes with legality status colors.</summary>
    private static Color WithSaturation(Color color, float factor)
    {
        var r = color.Red; var g = color.Green; var b = color.Blue;
        var max = Math.Max(r, Math.Max(g, b));
        var min = Math.Min(r, Math.Min(g, b));
        var lightness = (max + min) / 2f;
        if (Math.Abs(max - min) < 1e-6f) return color;
        var saturation = lightness < 0.5f
            ? (max - min) / (max + min)
            : (max - min) / (2f - max - min);
        saturation = Math.Clamp(saturation * factor, 0f, 1f);

        var hue = GetHue(r, g, b, max, min);
        var q = lightness < 0.5f
            ? lightness * (1f + saturation)
            : lightness + saturation - lightness * saturation;
        var p = 2f * lightness - q;
        return Color.FromRgb(
            HueToRgb(p, q, hue + 1f / 3f),
            HueToRgb(p, q, hue),
            HueToRgb(p, q, hue - 1f / 3f));
    }

    private static float GetHue(float r, float g, float b, float max, float min)
    {
        var delta = max - min;
        float hue;
        if (Math.Abs(max - r) < 1e-6f) hue = (g - b) / delta % 6f;
        else if (Math.Abs(max - g) < 1e-6f) hue = (b - r) / delta + 2f;
        else hue = (r - g) / delta + 4f;
        hue /= 6f;
        return hue < 0f ? hue + 1f : hue;
    }

    private static float HueToRgb(float p, float q, float t)
    {
        if (t < 0f) t += 1f;
        if (t > 1f) t -= 1f;
        if (t < 1f / 6f) return p + (q - p) * 6f * t;
        if (t < 1f / 2f) return q;
        if (t < 2f / 3f) return p + (q - p) * (2f / 3f - t) * 6f;
        return p;
    }
}

/// <summary>Maps legality badge glyphs to status colors (green/red are status, never decoration).</summary>
public sealed class LegalityColorConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, System.Globalization.CultureInfo culture) =>
        (value as string) switch
        {
            "✓" => UiTokens.Ok,
            "✗" => UiTokens.Bad,
            _ => UiTokens.Ink1,
        };

    public object ConvertBack(object? value, Type targetType, object? parameter, System.Globalization.CultureInfo culture) =>
        throw new NotSupportedException();
}
