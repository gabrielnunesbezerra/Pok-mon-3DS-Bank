using SkiaSharp;

namespace PKForge.Chrome;

/// <summary>
/// The PKForge design tokens: the PKSM language rebuilt inside the new logo's dark
/// pixel-console world. Navy grid fields, layered cobalt panels, cyan focus light, the red
/// triangle cursor. One system:
/// - housing is the logo's dark grid field;
/// - panels and cards are layered navy with cobalt edges;
/// - the ONE accent family comes directly from the PKForge logo (navy, cobalt, cyan);
/// - red is reserved for cursors/destructive, gold only ever marks a shiny mon;
/// - per-screen worlds (storage wallpaper, summary blue, dex cyan, gift plum, bag navy)
///   stay recognizable while sharing the same dark chrome and pale ink.
/// The chrome colors read the current <see cref="ColorTheme"/>; the reserved signals, the
/// summary page accents, the gift world and the box wallpapers (indexed by stored Bank data)
/// keep their values in every theme.
/// </summary>
public static class Pksm
{
    private static ColorTheme T => ColorTheme.Current;

    // ---- Raw brand colors (the logo's opaque colors, in the current theme) ----
    public static SKColor LogoVoid => T.Void;
    public static SKColor LogoDeep => T.Deep;
    public static SKColor LogoDeck => T.Deck;
    public static SKColor LogoGrid => T.Grid;
    public static SKColor LogoBlue => T.Blue;
    public static SKColor LogoCyan => T.Cyan;

    // ---- Housing (the logo's pixel-grid field) ----
    public static SKColor Housing => T.Deck;
    public static SKColor HousingLine => T.Grid;

    // ---- Panels ----
    public static SKColor Paper => T.Deck;
    public static SKColor PaperShade => T.Deep;
    public static SKColor PaperEdge => T.Grid;
    public static SKColor PaperEdgeDeep => T.Cyan;

    // ---- The logo accent family ----
    public static SKColor HeaderBlue => T.Grid;
    public static SKColor ButtonBlue => T.Blue;
    public static SKColor ButtonBlueDeep => T.Void;

    // ---- Selection ----
    public static SKColor SelectFill => T.Grid;
    public static SKColor SelectBorder => T.Cyan;
    public static SKColor SelectInk => T.Ink;

    // ---- Ink ----
    public static SKColor Ink => T.Ink;
    public static SKColor InkSoft => T.InkSoft;

    // ---- Icon set ----
    public static SKColor IndigoLight => T.Blue;
    public static SKColor Indigo => T.Cyan;
    public static SKColor IndigoInk => T.Ink;

    // ---- Worlds (per-screen, from the games) ----
    public static SKColor SummaryBg => T.Deep;
    public static SKColor DexCyan => T.Blue;
    public static SKColor StorageMenuBlue => T.Grid;
    public static SKColor StorageMenuBlueDeep => T.Void;

    // ---- Bag (inventory navy) ----
    public static SKColor BagNavy => T.Deck;
    public static SKColor BagNavyDeep => T.Void;
    public static SKColor BagCyan => T.Blue;
    public static SKColor BagCyanEdge => T.Cyan;

    // ---- Summary page accents (XY/ORAS summary colours): each page's identity, fixed ----
    public static readonly SKColor BandInfo = new(0xB0, 0x4E, 0x5C);      // Info rose
    public static readonly SKColor BandStats = new(0x2E, 0x72, 0xC2);     // Stats blue
    public static readonly SKColor BandMoves = new(0xB8, 0x74, 0x34);     // Moves amber
    public static readonly SKColor BandOrigin = new(0x26, 0x86, 0x88);    // Origin teal
    public static readonly SKColor BandLegal = new(0x38, 0x8A, 0x58);     // Legality green
    public static readonly SKColor RibbonGold = new(0xE2, 0xB6, 0x4A);

    // ---- Events (mystery-gift pink): the gift world keeps its own colors in every theme ----
    public static readonly SKColor GiftPink = new(0x45, 0x24, 0x46);
    public static readonly SKColor GiftPinkLight = new(0x8E, 0x45, 0x70);
    public static readonly SKColor GiftRed = new(0xE5, 0x68, 0x86);

    // ---- Reserved signals ----
    public static readonly SKColor Legal = new(0x54, 0xD6, 0x8A);
    public static readonly SKColor Illegal = new(0xF0, 0x68, 0x68);
    public static readonly SKColor ShinyGold = new(0xF2, 0xC1, 0x4E);     // ONLY the shiny mark
    public static readonly SKColor CursorRed = new(0xF0, 0x68, 0x68);     // pointer + destructive
    public static readonly SKColor CursorGreen = new(0x54, 0xD6, 0x8A);   // multi-select pointer (the games' green hand)
    public static readonly SKColor SignalBlue = new(0x42, 0xBF, 0xE8);    // fixed blue: the male glyph, the blue marking, four IV stars
    public static readonly SKColor Female = new(0xF0, 0x7A, 0x9B);        // the female glyph
    public static SKColor FocusBlue => T.Cyan;

    /// <summary>Per-box wallpapers in the storage world: dark tinted worlds, cycling.</summary>
    public static readonly SKColor[] BoxWallpapers =
    [
        new(0x1B, 0x31, 0x46), // jade navy
        new(0x1B, 0x2E, 0x58), // cobalt navy
        new(0x3B, 0x32, 0x38), // amber dusk
        new(0x42, 0x28, 0x3C), // coral dusk
        new(0x31, 0x29, 0x55), // violet navy
        new(0x18, 0x3A, 0x4A), // aqua navy
        new(0x40, 0x28, 0x4D), // rose navy
        new(0x2A, 0x3B, 0x38), // leaf navy
    ];

    public static SKColor WallpaperShade(SKColor c)
    {
        var r = Math.Min(255, (int)(c.Red * 1.24f));
        var g = Math.Min(255, (int)(c.Green * 1.24f));
        var b = Math.Min(255, (int)(c.Blue * 1.24f));
        return new SKColor((byte)r, (byte)g, (byte)b);
    }

    /// <summary>Dark readable ink over a wallpaper (edge labels on colored worlds).</summary>
    public static SKColor InkOver(SKColor wallpaper)
    {
        var lum = (0.299f * wallpaper.Red + 0.587f * wallpaper.Green + 0.114f * wallpaper.Blue) / 255f;
        return lum >= 0.62f ? LogoVoid : Ink;
    }
}
