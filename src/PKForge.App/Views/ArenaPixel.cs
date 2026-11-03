using PKForge.Domain;

namespace PKForge.App.Views;

/// <summary>
/// The Arena's pixel grid. The battle is drawn into a 320 by 180 picture (one art pixel is
/// three units of the 960 by 540 world) that is then blown up by a whole number with no
/// smoothing, so effects and sprites share one resolution and nothing comes out blurred.
/// </summary>
internal static class ArenaPixel
{
    public const int Width = 320, Height = 180;

    /// <summary>World units per art pixel.</summary>
    public const float Unit = ArenaBattle.Width / Width;

    /// <summary>A world position on the nearest whole art pixel.</summary>
    public static float Snap(float value) => MathF.Round(value / Unit) * Unit;

    /// <summary>A world length in whole art pixels, never less than one.</summary>
    public static float Size(float value) => Math.Max(Unit, Snap(value));

    /// <summary>How many screen pixels one art pixel takes: the biggest whole number that fits the court.</summary>
    public static int Zoom(float viewWidth, float viewHeight) =>
        Math.Max(1, (int)MathF.Floor(Math.Min(viewWidth / Width, viewHeight / Height)));
}
