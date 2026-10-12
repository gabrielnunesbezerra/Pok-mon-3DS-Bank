using PKForge.Chrome;

namespace PKForge.App.Services;

/// <summary>
/// How the PC boxes show their game wallpaper: the default (the pattern in the color scheme's
/// tones), veiled, duotone, or horizon. A player setting in Settings.
/// </summary>
public static class BoxBackground
{
    private const string Key = "box_background";

    public static StoragePaint.WallpaperStyle Style =>
        Enum.TryParse<StoragePaint.WallpaperStyle>(Preferences.Default.Get(Key, nameof(StoragePaint.WallpaperStyle.Blue)), out var style)
            ? style
            : StoragePaint.WallpaperStyle.Blue;

    public static void Set(StoragePaint.WallpaperStyle style) => Preferences.Default.Set(Key, style.ToString());

    public static string Name(StoragePaint.WallpaperStyle style) => style switch
    {
        StoragePaint.WallpaperStyle.Duotone => "Duotone",
        StoragePaint.WallpaperStyle.Horizon => "Horizon",
        StoragePaint.WallpaperStyle.Veiled => "Veiled",
        _ => "Default",
    };
}
