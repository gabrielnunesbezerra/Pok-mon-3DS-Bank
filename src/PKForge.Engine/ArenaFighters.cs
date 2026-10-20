using PKForge.Domain;
using PKHeX.Core;

namespace PKForge.Engine;

/// <summary>3DS Bank 2.5: a Bank Pokémon as an Arena fighter, at level 50 with its own moves, types, IVs and EVs.</summary>
public static class ArenaFighters
{
    /// <summary>The fighter, or null when the bytes are not a Pokémon this app can read (or an egg).</summary>
    public static ArenaFighterSpec? Build(byte[] data, string? format, IReadOnlyList<string> moveNames)
    {
        ArgumentNullException.ThrowIfNull(data);
        ArgumentNullException.ThrowIfNull(moveNames);
        PKM? pk;
        try { pk = EntityBytes.Parse(data, format); }
        catch (Exception error) when (error is ArgumentException or InvalidOperationException or IndexOutOfRangeException) { pk = null; }
        if (pk is null || pk.Species == 0 || pk.IsEgg) return null;
        try
        {
            var fighter = pk.Clone();
            fighter.CurrentLevel = ArenaFighterSpec.Level;
            var personal = fighter.PersonalInfo;
            var stats = fighter.GetStats(personal);
            var moves = new List<ArenaMove>(4);
            foreach (var id in new[] { (int)pk.Move1, pk.Move2, pk.Move3, pk.Move4 })
            {
                if (id <= 0 || DexFacts.Move(id) is not { } fact) continue;
                var name = id < moveNames.Count && moveNames[id].Length > 0 ? moveNames[id] : $"Move {id}";
                moves.Add(ArenaMove.For(id, name, fact.Type, fact.Category, fact.Power, fact.Effect));
            }
            var nickname = string.IsNullOrWhiteSpace(pk.Nickname) ? $"#{pk.Species}" : pk.Nickname;
            return new ArenaFighterSpec(pk.Species, pk.Form, pk.IsShiny, nickname, personal.Type1, personal.Type2,
                stats[0], stats[1], stats[2], stats[4], stats[5], stats[3], moves);
        }
        catch (Exception error) when (error is ArgumentException or InvalidOperationException or IndexOutOfRangeException)
        {
            return null;
        }
    }
}
