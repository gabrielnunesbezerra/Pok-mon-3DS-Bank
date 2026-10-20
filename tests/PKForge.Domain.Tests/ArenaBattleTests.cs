using Xunit;

namespace PKForge.Domain.Tests;

/// <summary>3DS Bank 2.5's Arena: moves, type matchups, and the Champion's aura.</summary>
public sealed class ArenaBattleTests
{
    private static ArenaFighterSpec Fighter(int type, int attack, int defense, int speed, params ArenaMove[] moves) =>
        new(25, 0, false, "Test", type, type, 150, attack, defense, attack, defense, speed, moves);

    private static readonly ArenaMove Thunderbolt = ArenaMove.For(85, "Thunderbolt", ArenaTypes.Electric, MoveCategory.Special, 90, "");
    private static readonly ArenaMove Flamethrower = ArenaMove.For(53, "Flamethrower", ArenaTypes.Fire, MoveCategory.Special, 90, "");
    private static readonly ArenaMove Earthquake = ArenaMove.For(89, "Earthquake", ArenaTypes.Ground, MoveCategory.Physical, 100, "");
    private static readonly ArenaMove Tackle = ArenaMove.For(33, "Tackle", ArenaTypes.Normal, MoveCategory.Physical, 40, "");
    private static readonly ArenaMove HyperBeam = ArenaMove.For(63, "Hyper Beam", ArenaTypes.Normal, MoveCategory.Special, 150, "");
    private static readonly ArenaMove Recover = ArenaMove.For(105, "Recover", ArenaTypes.Normal, MoveCategory.Status, 0, "Restores half the user's max HP.");
    private static readonly ArenaMove SwordsDance = ArenaMove.For(14, "Swords Dance", ArenaTypes.Normal, MoveCategory.Status, 0, "Sharply raises the user's Attack.");
    private static readonly ArenaMove Protect = ArenaMove.For(182, "Protect", ArenaTypes.Normal, MoveCategory.Status, 0, "Protects the user from attacks.");

    [Fact]
    public void MovesTakeTheShapeOfWhatTheyAre()
    {
        Assert.Equal(ArenaShape.Projectile, Thunderbolt.Shape);
        Assert.Equal(ArenaShape.Cone, Flamethrower.Shape);
        Assert.Equal(ArenaShape.Burst, Earthquake.Shape);
        Assert.Equal(ArenaShape.Strike, Tackle.Shape);
        Assert.Equal(ArenaShape.Beam, HyperBeam.Shape);
        Assert.Equal(ArenaShape.Heal, Recover.Shape);
        Assert.Equal(ArenaShape.Buff, SwordsDance.Shape);
        Assert.Equal(ArenaShape.Shield, Protect.Shape);
        Assert.True(HyperBeam.Cooldown > Thunderbolt.Cooldown);
    }

    [Theory]
    [InlineData(ArenaTypes.Water, ArenaTypes.Fire, ArenaTypes.Fire, 2f)]
    [InlineData(ArenaTypes.Electric, ArenaTypes.Ground, ArenaTypes.Ground, 0f)]
    [InlineData(ArenaTypes.Ice, ArenaTypes.Dragon, ArenaTypes.Flying, 4f)]
    [InlineData(ArenaTypes.Fire, ArenaTypes.Water, ArenaTypes.Rock, 0.25f)]
    [InlineData(ArenaTypes.Dragon, ArenaTypes.Fairy, ArenaTypes.Fairy, 0f)]
    [InlineData(ArenaTypes.Normal, ArenaTypes.Psychic, ArenaTypes.Psychic, 1f)]
    public void TypesHitLikeInTheGames(int attack, int type1, int type2, float expected) =>
        Assert.Equal(expected, ArenaTypes.Effectiveness(attack, type1, type2));

    [Fact]
    public void AFighterWhoKnowsNoAttackStillHasStruggle()
    {
        var battle = new ArenaBattle(Fighter(0, 80, 80, 80, Recover), Fighter(0, 80, 80, 80, Tackle), aura: false, seed: 1);
        Assert.Contains(battle.Player.Moves, move => move.Name == "Struggle");
    }

    /// <summary>A player that plays well: keeps its distance, spams its moves, dodges shots.</summary>
    private static ArenaInput Bot(ArenaBattle battle, Random random)
    {
        var me = battle.Player;
        var foe = battle.Champion;
        var dx = foe.X - me.X;
        var dy = foe.Y - me.Y;
        var distance = MathF.Sqrt(dx * dx + dy * dy);
        var close = me.Moves.Any(m => m.Shape is ArenaShape.Strike or ArenaShape.Burst);
        var sign = distance > (close ? 80 : 260) ? 1 : -1;
        var mx = dx / distance * sign + -dy / distance * 0.4f;
        var my = dy / distance * sign + dx / distance * 0.4f;
        var cast = random.Next(me.Moves.Count);
        var dodge = battle.Projectiles.Any(p => p.ByChampion && MathF.Abs(p.X - me.X) + MathF.Abs(p.Y - me.Y) < 120) && random.Next(3) == 0;
        return new ArenaInput(mx, my, cast, dodge);
    }

    private static ArenaBattle Play(ArenaFighterSpec player, ArenaFighterSpec champion, bool aura, int seed)
    {
        var battle = new ArenaBattle(player, champion, aura, seed);
        var random = new Random(seed * 7 + 3);
        var guard = 0;
        while (battle.Outcome == ArenaOutcome.Running && guard++ < 60 * 200)
        {
            battle.Step(1 / 60f, Bot(battle, random));
            battle.TakeEffects();
        }
        return battle;
    }

    [Fact]
    public void WithTheAuraTheChampionNeverLosesEvenToAMuchStrongerPokemon()
    {
        var strong = Fighter(ArenaTypes.Water, 220, 220, 200, ArenaMove.For(57, "Surf", ArenaTypes.Water, MoveCategory.Special, 90, ""),
            ArenaMove.For(56, "Hydro Pump", ArenaTypes.Water, MoveCategory.Special, 110, ""), Earthquake, SwordsDance);
        var weak = Fighter(ArenaTypes.Fire, 60, 50, 40, Tackle, ArenaMove.For(52, "Ember", ArenaTypes.Fire, MoveCategory.Special, 40, ""));
        for (var seed = 1; seed <= 30; seed++)
        {
            var battle = Play(strong, weak, aura: true, seed);
            Assert.Equal(ArenaOutcome.ChampionWon, battle.Outcome);
            Assert.True(battle.Champion.Hp >= 1);
            // ...while the player still gets it very low, so it looks close.
            Assert.True(battle.BestDamagePercent >= 60, $"seed {seed}: only {battle.BestDamagePercent}%");
        }
    }

    [Fact]
    public void WithoutTheAuraAStrongerPokemonCanWin()
    {
        var strong = Fighter(ArenaTypes.Water, 220, 220, 200, ArenaMove.For(57, "Surf", ArenaTypes.Water, MoveCategory.Special, 90, ""),
            ArenaMove.For(56, "Hydro Pump", ArenaTypes.Water, MoveCategory.Special, 110, ""), Thunderbolt);
        var weak = Fighter(ArenaTypes.Fire, 60, 50, 40, Tackle, ArenaMove.For(52, "Ember", ArenaTypes.Fire, MoveCategory.Special, 40, ""));
        var wins = Enumerable.Range(1, 20).Count(seed => Play(strong, weak, aura: false, seed).Outcome == ArenaOutcome.PlayerWon);
        Assert.True(wins >= 15, $"won {wins} of 20");
    }

    [Fact]
    public void ABattleIsOverWithinTheClock()
    {
        var a = Fighter(ArenaTypes.Electric, 120, 100, 120, Thunderbolt, Tackle, Protect, Recover);
        var b = Fighter(ArenaTypes.Ground, 130, 110, 80, Earthquake, Tackle, HyperBeam, SwordsDance);
        for (var seed = 1; seed <= 10; seed++)
        {
            var battle = Play(a, b, aura: seed % 2 == 0, seed);
            Assert.NotEqual(ArenaOutcome.Running, battle.Outcome);
            Assert.True(battle.Time <= ArenaBattle.TimeLimit + 0.1f);
        }
    }

    [Fact]
    public void ShotsHitAndDodgesAvoidThem()
    {
        var shooter = Fighter(ArenaTypes.Electric, 120, 100, 100, Thunderbolt);
        var target = Fighter(ArenaTypes.Normal, 100, 100, 100, Tackle);
        var battle = new ArenaBattle(shooter, target, aura: false, seed: 5);
        battle.Step(1 / 60f, new ArenaInput(0, 0, 0));
        Assert.Single(battle.Projectiles);
        var hit = false;
        for (var i = 0; i < 120 && !hit; i++)
        {
            battle.Step(1 / 60f, default);
            hit = battle.TakeEffects().Any(fx => fx.Kind == ArenaFxKind.Hit && !fx.ByChampion) || battle.Champion.Hp < battle.Champion.MaxHp;
        }
        Assert.True(hit);
    }
}

public sealed class ArenaAuraTests
{
    [Fact]
    public void EvenAWeakChallengerTakesTheChampionLowBeforeLosing()
    {
        var weak = new ArenaFighterSpec(25, 0, false, "Pika", ArenaTypes.Electric, ArenaTypes.Electric, 100, 60, 50, 65, 55, 90,
            [ArenaMove.For(84, "Thunder Shock", ArenaTypes.Electric, MoveCategory.Special, 40, ""), ArenaMove.For(98, "Quick Attack", ArenaTypes.Normal, MoveCategory.Physical, 40, "")]);
        var strong = new ArenaFighterSpec(6, 0, true, "Zard", ArenaTypes.Fire, ArenaTypes.Flying, 170, 130, 120, 160, 130, 140,
            [ArenaMove.For(53, "Flamethrower", ArenaTypes.Fire, MoveCategory.Special, 90, ""), ArenaMove.For(89, "Earthquake", ArenaTypes.Ground, MoveCategory.Physical, 100, ""),
             ArenaMove.For(403, "Air Slash", ArenaTypes.Flying, MoveCategory.Special, 75, "")]);
        for (var seed = 1; seed <= 12; seed++)
        {
            var battle = new ArenaBattle(weak, strong, aura: true, seed);
            var random = new Random(seed);
            var survivedEarly = true;
            while (battle.Outcome == ArenaOutcome.Running)
            {
                var me = battle.Player;
                var foe = battle.Champion;
                var dx = foe.X - me.X;
                var dy = foe.Y - me.Y;
                var d = MathF.Max(1, MathF.Sqrt(dx * dx + dy * dy));
                var sign = d > 200 ? 1 : -1;
                battle.Step(1 / 60f, new ArenaInput(dx / d * sign - dy / d * 0.4f, dy / d * sign + dx / d * 0.4f, random.Next(2), random.Next(50) == 0));
                battle.TakeEffects();
                if (!battle.ChampionEnraged && battle.Player.Hp <= 0) survivedEarly = false;
            }
            Assert.Equal(ArenaOutcome.ChampionWon, battle.Outcome);
            Assert.True(survivedEarly, $"seed {seed}: knocked out before the Champion got angry");
            Assert.True(battle.BestDamagePercent >= 65, $"seed {seed}: only {battle.BestDamagePercent}%");
            Assert.True(battle.Time > 35, $"seed {seed}: over in {battle.Time:F0} s");
        }
    }
}
