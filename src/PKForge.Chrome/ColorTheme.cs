namespace PKForge.Chrome;

/// <summary>
/// One color theme: a value for every chrome role (ColorThemes.g.cs, built from the artist's
/// mockups). Colors with a meaning in the games (types, HP, legality,
/// gender, shiny, status) are not roles and never change with the theme.
/// </summary>
public sealed partial record ColorTheme
{
    /// <summary>The stored preference value.</summary>
    public required string Id { get; init; }

    /// <summary>The name the picker shows.</summary>
    public required string Name { get; init; }

    /// <summary>The theme every chrome color reads now.</summary>
    // Resolved on first read, not in a field initializer: building the themes in ColorThemes.All
    // can run this type's static initializer (Android does), and All is not assigned yet then.
    public static ColorTheme Current => _current ??= ColorThemes.Default;

    private static ColorTheme? _current;

    /// <summary>Bumped on every change: caches of themed pixels key on it.</summary>
    public static int Version { get; private set; }

    /// <summary>Raised after <see cref="Current"/> changes, for caches to drop themed pixels.</summary>
    public static event Action? Changed;

    /// <summary>Makes <paramref name="theme"/> the current theme; nothing happens when it already is.</summary>
    public static void Apply(ColorTheme theme)
    {
        ArgumentNullException.ThrowIfNull(theme);
        if (ReferenceEquals(theme, Current)) return;
        _current = theme;
        Version++;
        Changed?.Invoke();
    }
}

public static partial class ColorThemes
{
    /// <summary>The app's own blues.</summary>
    public static ColorTheme Default => All[0];

    /// <summary>The theme stored under <paramref name="id"/>, or the default when none is.</summary>
    public static ColorTheme ById(string? id)
    {
        foreach (var theme in All)
            if (theme.Id == id) return theme;
        return Default;
    }
}
