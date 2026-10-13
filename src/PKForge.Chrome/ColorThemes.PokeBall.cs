using SkiaSharp;

namespace PKForge.Chrome;

public static partial class ColorThemes
{
    /// <summary>
    /// 3DS Bank's only scheme: black and white, like an old handheld's screen frame. The bodies
    /// are near-black neutrals; white draws the structure (panel rims, frames, focus, icons) and
    /// the text; a few steps of grey fill the strips, tabs and the selection so white text on
    /// them stays readable. Colours with a meaning in the games keep their own colours.
    /// </summary>
    public static ColorTheme PokeBall { get; } = new()
    {
        Id = "monochrome",
        Name = "Black and white",
        Void = new SKColor(0x06, 0x06, 0x07),
        Deep = new SKColor(0x0F, 0x0F, 0x11),
        Deck = new SKColor(0x17, 0x17, 0x1A),
        Grid = new SKColor(0x5C, 0x5C, 0x63),
        Blue = new SKColor(0x8C, 0x8C, 0x94),
        Cyan = new SKColor(0xFF, 0xFF, 0xFF),
        Ink = new SKColor(0xFA, 0xFA, 0xFB),
        InkSoft = new SKColor(0xA8, 0xA8, 0xAF),
        Bright = new SKColor(0xFF, 0xFF, 0xFF),
        Well = new SKColor(0x10, 0x10, 0x12),
        WellEdge = new SKColor(0x3C, 0x3C, 0x42),
        Frame = new SKColor(0x17, 0x17, 0x1A),
        FrameEdge = new SKColor(0xEE, 0xEE, 0xF1),
        BannerTop = new SKColor(0x9A, 0x9A, 0xA2),
        BannerBottom = new SKColor(0x4A, 0x4A, 0x51),
        PoolLight = new SKColor(0xFF, 0xFF, 0xFF),
        WallpaperMid = new SKColor(0x1E, 0x1E, 0x22),
        WallpaperLight = new SKColor(0x36, 0x36, 0x3C),
        PointerRim = new SKColor(0x0A, 0x0A, 0x0C),
        PointerPale = new SKColor(0xFF, 0xFF, 0xFF),
        Label = new SKColor(0xC4, 0xC4, 0xCB),
        Value = new SKColor(0xEA, 0xEA, 0xEE),
        Rim = new SKColor(0xFF, 0xFF, 0xFF),
        RimFill = new SKColor(0x26, 0x26, 0x2B),
        SubInk = new SKColor(0x8E, 0x8E, 0x96),
        ChipInk = new SKColor(0xFF, 0xFF, 0xFF),
        ChipTop = new SKColor(0x6A, 0x6A, 0x72),
        ChipBottom = new SKColor(0x3A, 0x3A, 0x40),
        Band = new SKColor(0x0E, 0x0E, 0x10),
        ToolFill = new SKColor(0x2A, 0x2A, 0x2F),
        ToolEdge = new SKColor(0xD8, 0xD8, 0xDE),
        CategoryDark = new SKColor(0x3A, 0x3A, 0x40),
        PanelFill = new SKColor(0x15, 0x15, 0x18),
        LabelColumn = new SKColor(0x0F, 0x0F, 0x12),
        LabelInk = new SKColor(0x8E, 0x8E, 0x96),
        ValueInk = new SKColor(0xD4, 0xD4, 0xDA),
        CardFill = new SKColor(0x11, 0x11, 0x14),
        CardRow = new SKColor(0x1C, 0x1C, 0x20),
        SpeciesFill = new SKColor(0x5C, 0x5C, 0x63),
        SpeciesEdge = new SKColor(0xFF, 0xFF, 0xFF),
        SpeciesInk = new SKColor(0xFF, 0xFF, 0xFF),
        NameFrame = new SKColor(0x17, 0x17, 0x1A),
        Shadow = new SKColor(0x03, 0x03, 0x04),
        TabTop = new SKColor(0x2A, 0x2A, 0x2F),
        TabBottom = new SKColor(0x1C, 0x1C, 0x20),
        TabActiveTop = new SKColor(0x8C, 0x8C, 0x94),
        TabActiveBottom = new SKColor(0x55, 0x55, 0x5C),
        TabIcon = new SKColor(0xFA, 0xFA, 0xFB),
        GlowHigh = new SKColor(0xE6, 0xE6, 0xEA),
        GlowMid = new SKColor(0xA0, 0xA0, 0xA8),
        GlowLow = new SKColor(0x4A, 0x4A, 0x51),
        RadarFill = new SKColor(0xD8, 0xD8, 0xDE),
        RadarInk = new SKColor(0xFF, 0xFF, 0xFF),
        DexNumber = new SKColor(0xC4, 0xC4, 0xCB),
        Silhouette = new SKColor(0x06, 0x06, 0x08),
        DexCard = new SKColor(0x13, 0x13, 0x16),
        PartyGridTop = new SKColor(0x09, 0x09, 0x0B),
        PartyRim = new SKColor(0xFF, 0xFF, 0xFF),
        PartyRimDark = new SKColor(0x0A, 0x0A, 0x0C),
        PartyBody = new SKColor(0x2A, 0x2A, 0x2F),
        PartyBand = new SKColor(0x3A, 0x3A, 0x40),
        PartySelected = new SKColor(0x5C, 0x5C, 0x63),
        PartySelectedBand = new SKColor(0x7A, 0x7A, 0x82),
        PartyShadow = new SKColor(0x09, 0x09, 0x0B),
    };
}
