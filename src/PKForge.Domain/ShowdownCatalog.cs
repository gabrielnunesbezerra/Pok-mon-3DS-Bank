using System.Text;

namespace PKForge.Domain;

/// <summary>
/// Pokémon Showdown's Black/White-style art for a look: the static front sprite (normal and
/// shiny) and the box icon on Showdown's icon sheet. The table is generated ahead of
/// time and covers every PKHeX form. A form outside it (a ROM hack's
/// own forms, such as Luminescent Platinum's Clone Charizard) returns null, so callers use
/// PKHeX's art, which has those.
/// </summary>
public static class ShowdownCatalog
{
    /// <summary>One icon on the sheet, in pixels.</summary>
    public const int IconWidth = 40;
    public const int IconHeight = 30;

    /// <summary>Icons per row on the sheet.</summary>
    public const int SheetColumns = 12;

    /// <summary>The icon sheet's asset path.</summary>
    public const string IconSheetPath = "showdown/icons.png";

    public sealed record Entry(string Stem, bool Front, bool ShinyFront, int Icon);

    private static readonly Lazy<IReadOnlyDictionary<string, Entry>> Table = new(Load);

    /// <summary>The entry for a look's form, or null when Showdown does not know it.</summary>
    public static Entry? For(SpriteLook look) => Table.Value.GetValueOrDefault($"{look.Species}-{look.Form}");

    /// <summary>Asset path of the static front sprite, or null when Showdown has none for this look.</summary>
    public static string? FrontPath(SpriteLook look)
    {
        if (For(look) is not { } exact) return null;
        if (look.Shiny) return exact.ShinyFront ? $"showdown/front-shiny/{exact.Stem}.png" : null;
        return exact.Front ? $"showdown/front/{exact.Stem}.png" : null;
    }

    /// <summary>Where a look's icon sits on the sheet, or null when Showdown has none.</summary>
    public static SheetCell? IconCell(SpriteLook look)
    {
        if (For(look) is not { } entry) return null;
        var x = entry.Icon % SheetColumns * IconWidth;
        var y = entry.Icon / SheetColumns * IconHeight;
        return new SheetCell(x, y, IconWidth, IconHeight);
    }

    private static IReadOnlyDictionary<string, Entry> Load()
    {
        using var stream = typeof(ShowdownCatalog).Assembly.GetManifestResourceStream("PKForge.Domain.showdownsprites.tsv")
            ?? throw new InvalidOperationException("showdownsprites.tsv is not embedded");
        return Parse(new StreamReader(stream, Encoding.UTF8));
    }

    /// <summary>Reads the table: comments and malformed rows are skipped.</summary>
    public static Dictionary<string, Entry> Parse(TextReader reader)
    {
        var map = new Dictionary<string, Entry>(StringComparer.Ordinal);
        while (reader.ReadLine() is { } line)
        {
            if (line.Length == 0 || line[0] == '#') continue;
            var p = line.Split('\t');
            if (p.Length < 4 || !int.TryParse(p[2], out var flags) || !int.TryParse(p[3], out var icon)) continue;
            map[p[0]] = new Entry(p[1], (flags & 1) != 0, (flags & 2) != 0, icon);
        }
        return map;
    }
}

/// <summary>An icon's rectangle on the sheet, in pixels.</summary>
public readonly record struct SheetCell(int X, int Y, int Width, int Height);
