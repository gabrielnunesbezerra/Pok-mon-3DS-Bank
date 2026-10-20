using PKForge.Domain;
using PKForge.Engine;
using PKHeX.Core;
using Xunit;

namespace PKForge.Engine.Tests;

/// <summary>3DS Bank 2.5: a Bank Pokémon becomes an Arena fighter with its real moves and types.</summary>
public sealed class ArenaFighterTests
{
    [Fact]
    public void APikachuFightsWithItsOwnMovesAtLevel50()
    {
        var pk = new PK7 { Species = 25, CurrentLevel = 88, Move1 = 85, Move2 = 98, Move3 = 104, Nickname = "Sparky", IsNicknamed = true };
        pk.SetRandomIVs();
        pk.RefreshChecksum();
        var names = Enumerable.Range(0, 1000).Select(i => i switch { 85 => "Thunderbolt", 98 => "Quick Attack", 104 => "Double Team", _ => "" }).ToList();
        var fighter = ArenaFighters.Build(pk.Data.ToArray(), "PK7", names);
        Assert.NotNull(fighter);
        Assert.Equal(25, fighter.Species);
        Assert.Equal("Sparky", fighter.Nickname);
        Assert.Equal(ArenaTypes.Electric, fighter.Type1);
        Assert.Equal(3, fighter.Moves.Count);
        Assert.Equal(ArenaShape.Projectile, fighter.Moves[0].Shape);
        Assert.Equal("Thunderbolt", fighter.Moves[0].Name);
        Assert.Equal(ArenaShape.Strike, fighter.Moves[1].Shape);
        // Level 50 stats, not the level it has in its game.
        var level50 = pk.Clone();
        level50.CurrentLevel = 50;
        Assert.Equal(level50.GetStats(level50.PersonalInfo)[0], fighter.Hp);
    }

    [Fact]
    public void GarbageIsNoFighter() => Assert.Null(ArenaFighters.Build([1, 2, 3], "PK7", []));
}
