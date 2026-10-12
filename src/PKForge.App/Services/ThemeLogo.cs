using PKForge.Chrome;

namespace PKForge.App.Services;

/// <summary>
/// The PKForge logo in the current color scheme's colors (Resources/UI/logo/&lt;scheme id&gt;.png),
/// falling back to the app icon when a scheme has none.
/// </summary>
public static class ThemeLogo
{
    private static readonly Dictionary<string, byte[]?> Pngs = [];

    public static ImageSource? Source()
    {
        var png = Png(ColorTheme.Current.Id);
        return png is null ? null : ImageSource.FromStream(() => new MemoryStream(png));
    }

    private static byte[]? Png(string id)
    {
        if (Pngs.TryGetValue(id, out var cached)) return cached;
        var png = Read($"ui/logo/{id}.png") ?? Read("ui/logo.png");
        Pngs[id] = png;
        return png;
    }

    private static byte[]? Read(string path)
    {
        try
        {
            using var stream = FileSystem.OpenAppPackageFileAsync(path).GetAwaiter().GetResult();
            using var copy = new MemoryStream();
            stream.CopyTo(copy);
            return copy.ToArray();
        }
        catch (Exception error) when (error is IOException or FileNotFoundException)
        {
            return null;
        }
    }
}
