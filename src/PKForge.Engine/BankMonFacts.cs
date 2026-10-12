using PKHeX.Core;

namespace PKForge.Engine;

/// <summary>
/// A stored Pokémon in a few readable lines (species, level, nature, ability, item, moves,
/// trainer, origin, legality), for judging a trade before saying yes.
/// </summary>
public static class BankMonFacts
{
    private static readonly Lazy<GameStrings> Strings = new(() => GameInfo.GetStrings("en"));

    public static IReadOnlyList<string> Describe(byte[] bytes, string? format)
    {
        ArgumentNullException.ThrowIfNull(bytes);
        var pk = EntityBytes.RomHackGame(format) is null ? EntityBytes.Parse(bytes, format) : null;
        if (pk is null || pk.Species == 0) return ["This Pokémon's data could not be read."];
        var s = Strings.Value;
        var lines = new List<string>();
        var species = Pick(s.specieslist, pk.Species, $"No. {pk.Species}");
        var gender = pk.Gender switch { 0 => " ♂", 1 => " ♀", _ => "" };
        lines.Add($"{species}{gender} · Lv {pk.CurrentLevel}");
        if (pk.Form != 0) lines.Add($"Form {pk.Form}");
        if (pk.IsShiny) lines.Add("Shiny!");
        if (pk.IsEgg) lines.Add("It is still an egg.");
        if (pk.Format >= 3)
        {
            lines.Add($"Nature: {Pick(s.natures, (int)pk.Nature, "?")}");
            lines.Add($"Ability: {Pick(s.abilitylist, pk.Ability, "?")}");
        }
        if (pk.HeldItem > 0)
            lines.Add($"Holding: {Pick(s.GetItemStrings(pk.Context, pk.Version), pk.HeldItem, $"item #{pk.HeldItem}")}");
        Span<ushort> moves = stackalloc ushort[4];
        pk.GetMoves(moves);
        var moveNames = new List<string>(4);
        foreach (var move in moves)
            if (move != 0) moveNames.Add(Pick(s.movelist, move, $"move #{move}"));
        if (moveNames.Count > 0) lines.Add($"Moves: {string.Join(", ", moveNames)}");
        lines.Add($"Trainer: {pk.OriginalTrainerName} (ID {pk.DisplayTID:D5})");
        if (pk.Format >= 3)
        {
            var origin = GameInfo.GetVersionName(pk.Version);
            lines.Add($"Caught in: {(string.IsNullOrEmpty(origin) ? pk.Version.ToString() : origin)}");
            lines.Add($"Ball: {Pick(s.balllist, pk.Ball, "?")}");
        }
        bool legal;
        try { legal = new LegalityAnalysis(pk).Valid; }
        catch (Exception) { legal = false; }
        lines.Add(legal ? "Legality checks: passed." : "Legality checks: flagged (it may have been edited).");
        return lines;
    }

    private static string Pick(IReadOnlyList<string> list, int index, string fallback) =>
        index >= 0 && index < list.Count && list[index].Length > 0 ? list[index] : fallback;
}
