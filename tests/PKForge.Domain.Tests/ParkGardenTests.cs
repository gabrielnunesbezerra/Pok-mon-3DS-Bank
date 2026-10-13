using Xunit;

namespace PKForge.Domain.Tests;

/// <summary>3DS Bank 2.2's Poképark gardens: plots, the twelve-hour trees, the pot and the meals.</summary>
public sealed class ParkGardenTests
{
    private const long Hour = 3_600_000;
    private const long Start = 1_800_000_000_000;

    private static HabitatGarden Fresh() => new ParkGardenState().For(0);

    [Fact]
    public void EveryHabitatHasFourPlotsAndItsOwnBerries()
    {
        var state = new ParkGardenState();
        for (var habitat = 0; habitat < ParkGardenRules.Habitats; habitat++)
        {
            Assert.Equal(ParkGardenRules.PlotsPerHabitat, state.For(habitat).Plots.Count);
            Assert.Equal(3, ParkGardenRules.BerriesFor(habitat).Count);
        }
        var all = ParkGardenRules.AllBerries.ToList();
        Assert.Equal(all.Count, all.Distinct().Count());
        // Every berry a garden takes can come out of the Toy Machine.
        Assert.All(all, berry => Assert.Contains(berry, ToyMachine.Pool(ToyRarity.Common)));
    }

    [Fact]
    public void OnlyTheHabitatsBerriesGoInAndOnlyIntoAnEmptyPlot()
    {
        var garden = Fresh();
        Assert.NotNull(ParkGardenRules.Plant(garden, 0, 0, 150, Start)); // Chesto grows by the lake
        Assert.Null(ParkGardenRules.Plant(garden, 0, 0, 155, Start));    // Oran grows in the commons
        Assert.NotNull(ParkGardenRules.Plant(garden, 0, 0, 151, Start)); // the plot is taken
        Assert.NotNull(ParkGardenRules.Plant(garden, 0, 9, 151, Start)); // there is no plot 9
    }

    [Fact]
    public void ATreeRipensInTwelveHoursAndAgainAfterEachPicking()
    {
        var garden = Fresh();
        ParkGardenRules.Plant(garden, 0, 1, 155, Start);
        Assert.Equal(PlotStage.Sprout, ParkGardenRules.View(garden.Plots[1], Start + 1 * Hour).Stage);
        Assert.Equal(PlotStage.Sapling, ParkGardenRules.View(garden.Plots[1], Start + 4 * Hour).Stage);
        Assert.Equal(PlotStage.Tree, ParkGardenRules.View(garden.Plots[1], Start + 9 * Hour).Stage);
        Assert.Equal(TimeSpan.FromHours(3), ParkGardenRules.View(garden.Plots[1], Start + 9 * Hour).Left);
        Assert.NotNull(ParkGardenRules.Harvest(garden, 1, Start + 11 * Hour));
        Assert.Equal(PlotStage.Ripe, ParkGardenRules.View(garden.Plots[1], Start + 12 * Hour).Stage);

        Assert.Null(ParkGardenRules.Harvest(garden, 1, Start + 13 * Hour));
        Assert.Equal(Enumerable.Repeat(155, ParkGardenRules.BerriesPerHarvest), garden.Pot);
        // Picked: the next twelve hours start now.
        Assert.Equal(PlotStage.Sprout, ParkGardenRules.View(garden.Plots[1], Start + 14 * Hour).Stage);
        Assert.Equal(PlotStage.Ripe, ParkGardenRules.View(garden.Plots[1], Start + 25 * Hour).Stage);
    }

    [Fact]
    public void AFullPotTakesNoMore()
    {
        var garden = Fresh();
        garden.Pot.AddRange(Enumerable.Repeat(151, ParkGardenRules.PotCapacity - 2));
        ParkGardenRules.Plant(garden, 0, 0, 151, Start);
        Assert.NotNull(ParkGardenRules.Harvest(garden, 0, Start + 12 * Hour));
        Assert.Equal(ParkGardenRules.PotCapacity - 2, garden.Pot.Count);
        Assert.Equal(PlotStage.Ripe, ParkGardenRules.View(garden.Plots[0], Start + 12 * Hour).Stage);
    }

    [Fact]
    public void ResidentsEatOneBerryAnHourTakingTurns()
    {
        var garden = Fresh();
        ParkGardenRules.Plant(garden, 0, 0, 149, Start);
        ParkGardenRules.Harvest(garden, 0, Start + 12 * Hour);
        var filled = Start + 12 * Hour;

        Assert.Empty(ParkGardenRules.Meals(garden, 2, filled + Hour / 2));
        var meals = ParkGardenRules.Meals(garden, 2, filled + 2 * Hour + 10);
        Assert.Equal(new[] { new GardenMeal(149, 0), new GardenMeal(149, 1) }, meals);
        Assert.Single(garden.Pot);
        // The last berry an hour later; then the empty pot saves nothing up.
        Assert.Equal(new[] { new GardenMeal(149, 0) }, ParkGardenRules.Meals(garden, 2, filled + 30 * Hour));
        Assert.Empty(garden.Pot);
        Assert.Empty(ParkGardenRules.Meals(garden, 2, filled + 40 * Hour));
    }

    [Fact]
    public void BerriesWaitWhenNobodyLivesThere()
    {
        var garden = Fresh();
        garden.Pot.AddRange([150, 150]);
        garden.MealClockMs = Start;
        Assert.Empty(ParkGardenRules.Meals(garden, 0, Start + 10 * Hour));
        Assert.Equal(2, garden.Pot.Count);
        // Someone moves in: the hours with nobody around were not saved up.
        Assert.Empty(ParkGardenRules.Meals(garden, 1, Start + 10 * Hour + Hour / 2));
        Assert.Single(ParkGardenRules.Meals(garden, 1, Start + 11 * Hour + 1));
    }

    [Fact]
    public void DiggingUpFreesThePlot()
    {
        var garden = Fresh();
        ParkGardenRules.Plant(garden, 0, 2, 151, Start);
        ParkGardenRules.DigUp(garden, 2);
        Assert.Equal(PlotStage.Empty, ParkGardenRules.View(garden.Plots[2], Start + 20 * Hour).Stage);
        Assert.Null(ParkGardenRules.Plant(garden, 0, 2, 149, Start + 20 * Hour));
    }

    [Fact]
    public void AHandEditedGardenIsCleanedUp()
    {
        var state = new ParkGardenState
        {
            Habitats = new()
            {
                [0] = new HabitatGarden { Plots = [new GardenPlot { Berry = 150, CycleStartMs = 5 }], Pot = [0, 151, -2], Feeder = -3 },
                [7] = new HabitatGarden(),
            },
        }.Normalized();
        Assert.False(state.Habitats.ContainsKey(7));
        var garden = state.For(0);
        Assert.Equal(ParkGardenRules.PlotsPerHabitat, garden.Plots.Count);
        Assert.Equal(0, garden.Plots[0].Berry); // Chesto does not grow in the commons
        Assert.Equal(new[] { 151 }, garden.Pot);
        Assert.Equal(0, garden.Feeder);
    }

    [Fact]
    public void TheGardenCornersAreFencedOff()
    {
        for (var habitat = 0; habitat < ParkGardenRules.Habitats; habitat++)
        {
            var map = ParkMap.For(habitat);
            Assert.Equal(ParkGardenRules.PlotsPerHabitat, map.Garden.Plots.Length);
            foreach (var plot in map.Garden.Plots)
                Assert.Equal(ParkTerrain.Blocked, map.TerrainAt(plot.X, plot.Y));
            Assert.Equal(ParkTerrain.Blocked, map.TerrainAt(map.Garden.Pot.X, map.Garden.Pot.Y));
        }
    }
}
