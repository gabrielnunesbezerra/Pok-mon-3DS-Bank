using PKForge.Chrome;

namespace PKForge.App.Services;

/// <summary>
/// The player's color scheme: the default blues or one of the type themes. A player setting in
/// Settings > Misc, applied before the first page is built.
/// </summary>
public static class ColorThemeSetting
{
    private const string Key = "color_theme";

    public static ColorTheme Stored => ColorThemes.ById(Preferences.Default.Get<string?>(Key, null));

    /// <summary>Applies the stored scheme. Call before any page reads a chrome color.</summary>
    public static void ApplyStored() => ColorTheme.Apply(Stored);

    public static void Set(ColorTheme theme)
    {
        Preferences.Default.Set(Key, theme.Id);
        ColorTheme.Apply(theme);
    }
}
