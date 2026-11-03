using SkiaSharp;

namespace PKForge.App.Views;

/// <summary>
/// Every color an Arena effect may use: five per element, from the near-white core (index 0)
/// to the dark edge (index 4). An effect is lightest in its middle and darkest at its rim, and
/// as it dies out it steps down its ramp one color at a time; nothing blends smoothly between
/// two colors and no effect picks a color of its own.
/// </summary>
internal static class ArenaPalettes
{
    public const int Core = 0, Bright = 1, Body = 2, Deep = 3, Edge = 4;

    private static SKColor[] Ramp(uint core, uint bright, uint body, uint deep, uint edge) =>
        [new SKColor(core | 0xFF000000), new SKColor(bright | 0xFF000000), new SKColor(body | 0xFF000000),
         new SKColor(deep | 0xFF000000), new SKColor(edge | 0xFF000000)];

    /// <summary>The 18 types, PKHeX order (Normal = 0 ... Fairy = 17).</summary>
    private static readonly SKColor[][] Types =
    [
        Ramp(0xF8F4E8, 0xE4DCC0, 0xBFB48E, 0x8C8466, 0x5A5444), // Normal
        Ramp(0xFFF0E0, 0xFFB070, 0xE0582E, 0xA82A22, 0x5E1418), // Fighting
        Ramp(0xF4F8FF, 0xD0DCFF, 0xA4B4F4, 0x7280C8, 0x404A84), // Flying
        Ramp(0xFCECFC, 0xE4A8E8, 0xB85CC0, 0x7E3090, 0x461A58), // Poison
        Ramp(0xFCF2DC, 0xECCE8C, 0xC49A54, 0x8A6434, 0x50381E), // Ground
        Ramp(0xF6F0DC, 0xD8C88C, 0xAC9450, 0x76643A, 0x443A24), // Rock
        Ramp(0xF6FCDC, 0xD4E87C, 0xA0BC2C, 0x6A8420, 0x3A4C14), // Bug
        Ramp(0xF0E8FC, 0xBCA4E8, 0x8868C0, 0x58408C, 0x2E2050), // Ghost
        Ramp(0xFAFAF6, 0xDCE0EC, 0xACB2C8, 0x767C94, 0x444858), // Steel
        Ramp(0xFFFBE0, 0xFFD860, 0xFF8A24, 0xD4441C, 0x7C1C14), // Fire
        Ramp(0xEEF8FF, 0xA8D8FF, 0x5CA0F0, 0x2C64C0, 0x163470), // Water
        Ramp(0xF0FCE0, 0xB4E888, 0x74C048, 0x3E8830, 0x1E4C1E), // Grass
        Ramp(0xFFFFE8, 0xFFF07C, 0xF8C820, 0xC08A10, 0x6A4808), // Electric
        Ramp(0xFFEEF6, 0xFFA8CC, 0xF45C94, 0xB42C6C, 0x621840), // Psychic
        Ramp(0xF4FEFF, 0xC8F4F4, 0x8CD8DC, 0x4C9CB4, 0x245470), // Ice
        Ramp(0xF0ECFF, 0xB4A4FF, 0x7C58F0, 0x4A2CB4, 0x241668), // Dragon
        Ramp(0xECE4F0, 0xA898B4, 0x6C5880, 0x3E3050, 0x1E1828), // Dark
        Ramp(0xFFF2FA, 0xFFC4E4, 0xF088C0, 0xC0508C, 0x702C54), // Fairy
    ];

    /// <summary>A hit landing: warm white, never the pure white of code.</summary>
    public static readonly SKColor[] Impact = Ramp(0xFFFDF6, 0xFFF2C4, 0xF8D488, 0xC89858, 0x7A5C38);
    public static readonly SKColor[] Heal = Ramp(0xF4FFF0, 0xB8F8B0, 0x6CDC7C, 0x2E9C58, 0x145834);
    public static readonly SKColor[] Shield = Ramp(0xF0FCFF, 0xB4ECFF, 0x68C4F0, 0x2E84C0, 0x14446C);
    public static readonly SKColor[] Smoke = Ramp(0xE8E6EE, 0xB8B4C4, 0x86829A, 0x5A566C, 0x323040);
    /// <summary>The Champion's color (its ring, its aura, its second wind).</summary>
    public static readonly SKColor[] Gold = Ramp(0xFFF8DC, 0xFFE08C, 0xF4B440, 0xB87420, 0x6A3E10);
    /// <summary>The Champion getting angry, and Buff moves' fire.</summary>
    public static readonly SKColor[] Fury = Ramp(0xFFF0E4, 0xFFB08C, 0xF0603C, 0xB0281C, 0x601010);
    /// <summary>The player's color (the ring under its feet).</summary>
    public static readonly SKColor[] Player = Ramp(0xEEF6FF, 0xA8D0FF, 0x5098F0, 0x2A5CB0, 0x142E64);
    /// <summary>The floor: the night under the court, its tiles and its lines.</summary>
    public static readonly SKColor[] Floor = Ramp(0x9AA0BC, 0x4C5474, 0x30364E, 0x1E2234, 0x12141E);

    public static SKColor[] For(int type) => Types[Math.Clamp(type, 0, 17)];

    /// <summary>One step of a ramp, clamped to its ends.</summary>
    public static SKColor At(SKColor[] ramp, int index) => ramp[Math.Clamp(index, 0, ramp.Length - 1)];
}
