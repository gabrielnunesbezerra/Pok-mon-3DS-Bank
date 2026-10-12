using PKHeX.Core;

namespace PKForge.Engine.Luminescent;

/// <summary>
/// What Luminescent Platinum changes on top of BDSP that PKHeX's own tables do not know:
/// its custom forms, the items it brings back, and that stock legality data does not
/// apply to it. Form lists follow PKLumiHex (Team Lumi, BlupBlurp).
/// </summary>
internal static class LumiData
{
    public static bool IsLumi(SaveFile save) => save is SAV8BSLuminescent;

    public static bool IsLumi(PKM pk) => pk.Context == EntityContext.Gen8bLumi;

    /// <summary>
    /// Lumi's form names for the species it extends, in form index order; null for every
    /// other species, which keeps PKHeX's names.
    /// </summary>
    /// <summary>
    /// The form list a Lumi species shows: Lumi's names where known, else PKHeX's, padded
    /// with "Form N" up to the forms Lumi's personal table declares (Pikachu has 18 there),
    /// so no Lumi form is ever blank or out of reach.
    /// </summary>
    public static IReadOnlyList<string> FormList(ushort species, IReadOnlyList<string> known, IReadOnlyList<string> types, IReadOnlyList<string> forms)
    {
        var names = FormNames(species, types, forms) ?? known;
        var count = species <= PersonalTable.BDSPLUMI.MaxSpeciesID ? PersonalTable.BDSPLUMI[species].FormCount : names.Count;
        if (names.Count >= count) return names;
        return [.. names, .. Enumerable.Range(names.Count, count - names.Count).Select(form => $"Form {form}")];
    }

    public static string[]? FormNames(ushort species, IReadOnlyList<string> types, IReadOnlyList<string> forms)
    {
        string Normal() => types[0];
        var Gigantamax = FormConverter.GetGigantamaxName(forms);
        return (Species)species switch
        {
            Species.Venusaur or Species.Blastoise => [Normal(), forms[804], Gigantamax, "Clone"],
            Species.Charizard => [Normal(), forms[805], forms[806], Gigantamax, "Clone"],
            Species.Gengar => [Normal(), forms[804], Gigantamax, "Stitched"],
            Species.Onix => [Normal(), "Crystal"],
            Species.Eevee => [Normal(), "Starter", Gigantamax, "Bandana"],
            Species.Mewtwo => [Normal(), forms[805], forms[806], "Armor MK2", "Armor MK1"],
            _ => null,
        };
    }

    /// <summary>
    /// Items a Lumi Pokémon may hold: BDSP's, plus the later-generation battle items Lumi
    /// brings back (Rocky Helmet, Eviolite and more) wherever its own item table names them.
    /// </summary>
    public static IReadOnlyList<int> HeldItems(SaveFile save)
    {
        var names = GameInfo.Strings.GetItemStrings(save.Context, save.Version);
        var held = new List<int>();
        var seen = new HashSet<int>();
        foreach (var item in save.HeldItems.ToArray().Concat(ItemStorage9SV.GetAllHeld()))
        {
            if (item == 0 || item >= names.Length || names[item].Length == 0) continue;
            if (seen.Add(item)) held.Add(item);
        }
        return held;
    }
}
