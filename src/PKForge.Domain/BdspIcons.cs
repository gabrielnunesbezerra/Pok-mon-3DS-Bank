using System.Globalization;

namespace PKForge.Domain;

/// <summary>
/// The BDSP-style box icons (Team Luminescent's bdsp-shiny-icons, MIT), shown in Brilliant
/// Diamond / Shining Pearl and Luminescent Platinum boxes when the player has downloaded
/// them. Upstream files are named <c>pm{species:0000}_{form:00}_{gender}{shiny}[_{variant:00}]</c>:
/// gender 0 = male or any, 1 = female, 2 = genderless; shiny 0 or 1; the variant is a form
/// argument (Alcremie's sweet, Magikarp's pattern). The cache mirrors that under
/// <c>bdsp/</c> with PKForge's own stem.
/// </summary>
public static class BdspIcons
{
    public const string Folder = "bdsp";

    /// <summary>
    /// The saves whose boxes wear the BDSP style (a save snapshot's format, its entity context):
    /// Brilliant Diamond / Shining Pearl and Luminescent Platinum. Every other game keeps the
    /// pixel sprites, so one box never mixes the two styles.
    /// </summary>
    public static bool AppliesTo(string? format) => format is "Gen8b" or "Gen8bLumi";

    /// <summary>What an upstream file is an icon of.</summary>
    public sealed record Icon(int Species, int Form, bool Female, bool Shiny, int? Variant)
    {
        /// <summary>The cache path it is stored at, e.g. "bdsp/3-0-f-s.png".</summary>
        public string CachePath =>
            $"{Folder}/{Species}-{Form}{(Female ? "-f" : "")}{(Shiny ? "-s" : "")}{(Variant is { } v ? $"-v{v}" : "")}.png";
    }

    /// <summary>Reads an upstream file name ("pm0003_00_11.png"); null for anything else (eggs, templates).</summary>
    public static Icon? Parse(string fileName)
    {
        var stem = Path.GetFileNameWithoutExtension(fileName);
        var parts = stem.Split('_');
        if (parts.Length is < 3 or > 4 || !parts[0].StartsWith("pm", StringComparison.Ordinal) || parts[0].Length != 6) return null;
        if (!int.TryParse(parts[0].AsSpan(2), NumberStyles.None, CultureInfo.InvariantCulture, out var species) || species <= 0) return null;
        if (parts[1].Length != 2 || !int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var form)) return null;
        if (parts[2].Length != 2 || parts[2][0] is not ('0' or '1' or '2') || parts[2][1] is not ('0' or '1')) return null;
        int? variant = null;
        if (parts.Length == 4)
        {
            if (parts[3].Length != 2 || !int.TryParse(parts[3], NumberStyles.None, CultureInfo.InvariantCulture, out var v)) return null;
            variant = v;
        }
        return new Icon(species, form, parts[2][0] == '1', parts[2][1] == '1', variant);
    }

    /// <summary>
    /// Cache paths to try for a look, best first: the exact variant and gender, then without
    /// the variant, then the default gender. Shininess is never dropped: a missing shiny icon
    /// falls back to the pixel sprite, which still shows the shine.
    /// </summary>
    public static IReadOnlyList<string> Candidates(SpriteLook look)
    {
        var list = new List<string>(4);
        void Add(bool female, int? variant)
        {
            var path = new Icon(look.Species, look.Form, female, look.Shiny, variant).CachePath;
            if (!list.Contains(path)) list.Add(path);
        }
        var variant = look.Traits.FormArgument > 0 ? look.Traits.FormArgument : (int?)null;
        if (look.Traits.Gigantamax) return list; // no BDSP-style G-Max art: the pixel set keeps it
        if (look.Traits.Female) { Add(true, variant); Add(true, null); }
        Add(false, variant);
        Add(false, null);
        return list;
    }
}
