using PKForge.Chrome;

namespace PKForge.App.Services;

/// <summary>
/// The app's color scheme. Since 3DS Bank 2.2 there is only one, black and red, so a scheme
/// stored by an older version is ignored. Applied before the first page is built.
/// </summary>
public static class ColorThemeSetting
{
    private const string Key = "color_theme";

    public static ColorTheme Stored => ColorThemes.Default;

    /// <summary>Applies the stored scheme. Call before any page reads a chrome color.</summary>
    public static void ApplyStored() => ColorTheme.Apply(Stored);

    public static void Set(ColorTheme theme)
    {
        Preferences.Default.Set(Key, theme.Id);
        ColorTheme.Apply(theme);
    }
}
