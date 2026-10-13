using Xunit;

namespace PKForge.Domain.Tests;

/// <summary>
/// The Poképark walkers: they stay on ground they can stand on, walk in straight lines
/// rather than cell-by-cell zigzags, and loop without jumps.
/// </summary>
public sealed class ParkWanderTests
{
    public static TheoryData<int, ParkTraversal, ParkTerrain> Walkers => new()
    {
        { 0, ParkTraversal.Land, ParkTerrain.Land },
        { 0, ParkTraversal.Land | ParkTraversal.Water, ParkTerrain.Water },
        { 1, ParkTraversal.Land | ParkTraversal.Water, ParkTerrain.Water },
        { 2, ParkTraversal.Land, ParkTerrain.Land },
        { 2, ParkTraversal.Land | ParkTraversal.Lava, ParkTerrain.Lava },
        { 3, ParkTraversal.Land, ParkTerrain.Land },
        { 3, ParkTraversal.Land | ParkTraversal.Air, ParkTerrain.Air },
    };

    [Theory]
    [MemberData(nameof(Walkers))]
    public void EveryStepIsOnGroundTheBodyFits(int environment, ParkTraversal allowed, ParkTerrain preferred)
    {
        var map = ParkMap.For(environment);
        for (var seed = 0; seed < 12; seed++)
        {
            var wander = new ParkWander(map, allowed, preferred, seed * 7919 + environment, radius: 12);
            for (long t = 0; t < 240_000; t += 97)
            {
                var state = wander.GetState(t);
                // The planner checks every 2 units of a line; between two checks a body can
                // graze an edge by less than a unit, so the test allows that much.
                Assert.True(map.CanOccupy(state.X, state.Y, allowed, 10.5f),
                    $"map {environment}, seed {seed}: ({state.X:0.0}, {state.Y:0.0}) at {t} ms");
            }
        }
    }

    [Fact]
    public void WalkersMoveSmoothlyAndKeepTheirDirection()
    {
        var map = ParkMap.For(0);
        for (var seed = 0; seed < 8; seed++)
        {
            var wander = new ParkWander(map, ParkTraversal.Land, ParkTerrain.Land, seed, radius: 12);
            var previous = wander.GetState(0);
            int walkingSamples = 0, turns = 0;
            for (long t = 50; t < 300_000; t += 50)
            {
                var state = wander.GetState(t);
                var step = MathF.Sqrt((state.X - previous.X) * (state.X - previous.X) + (state.Y - previous.Y) * (state.Y - previous.Y));
                // 50 ms at the fastest pace is about 1.2 units: never a teleport, not even at the loop's seam.
                Assert.True(step <= ParkWander.MaxSpeed * 0.05f + 0.01f, $"seed {seed}: jumped {step:0.00} units at {t} ms");
                if (state.IsWalking && previous.IsWalking)
                {
                    walkingSamples++;
                    if (state.Facing != previous.Facing) turns++;
                }
                previous = state;
            }
            Assert.True(walkingSamples > 200, $"seed {seed} barely walked");
            // Straight lines: on average a turn only every few seconds of walking.
            Assert.True(turns * 60 < walkingSamples, $"seed {seed}: {turns} turns in {walkingSamples} walking samples");
        }
    }

    [Fact]
    public void TheSameSeedWalksTheSameWay()
    {
        var map = ParkMap.For(2);
        var a = new ParkWander(map, ParkTraversal.Land, ParkTerrain.Land, 42, radius: 12);
        var b = new ParkWander(map, ParkTraversal.Land, ParkTerrain.Land, 42, radius: 12);
        foreach (var t in new long[] { 0, 1234, 98_765, 5_000_000 })
            Assert.Equal(a.GetState(t), b.GetState(t));
    }
}
