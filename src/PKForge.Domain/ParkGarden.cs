namespace PKForge.Domain;

/// <summary>One of a habitat's four berry plots: the berry planted (0 when empty) and when its
/// current twelve hours began (when it was planted, or last picked).</summary>
public sealed class GardenPlot
{
    public int Berry { get; set; }
    public long CycleStartMs { get; set; }
}

/// <summary>A habitat's garden corner: four plots and the pot the residents eat from.</summary>
public sealed class HabitatGarden
{
    public List<GardenPlot> Plots { get; set; } = [];

    /// <summary>The berries in the pot, the oldest first (they are eaten in that order).</summary>
    public List<int> Pot { get; set; } = [];

    /// <summary>The moment meals were last counted up to (0 before the first count).</summary>
    public long MealClockMs { get; set; }

    /// <summary>Whose turn it is to eat next, among the habitat's residents.</summary>
    public int Feeder { get; set; }
}

/// <summary>
/// The Poképark gardens (3DS Bank 2.2), saved as <see cref="FileName"/> in the Bank folder so
/// they travel with the account: one garden per habitat, keyed by the habitat's index.
/// </summary>
public sealed class ParkGardenState
{
    public const string FileName = "garden.json";

    public Dictionary<int, HabitatGarden> Habitats { get; set; } = [];

    /// <summary>The garden of <paramref name="habitat"/>, created (empty) when it is new.</summary>
    public HabitatGarden For(int habitat)
    {
        if (!Habitats.TryGetValue(habitat, out var garden))
            Habitats[habitat] = garden = new HabitatGarden();
        while (garden.Plots.Count < ParkGardenRules.PlotsPerHabitat) garden.Plots.Add(new GardenPlot());
        if (garden.Plots.Count > ParkGardenRules.PlotsPerHabitat) garden.Plots.RemoveRange(ParkGardenRules.PlotsPerHabitat, garden.Plots.Count - ParkGardenRules.PlotsPerHabitat);
        return garden;
    }

    /// <summary>Drops what a hand-edited or older file might carry that the rules do not allow.</summary>
    public ParkGardenState Normalized()
    {
        foreach (var (habitat, garden) in Habitats.ToList())
        {
            if (habitat is < 0 or >= ParkGardenRules.Habitats) { Habitats.Remove(habitat); continue; }
            For(habitat);
            foreach (var plot in garden.Plots)
                if (!ParkGardenRules.BerriesFor(habitat).Contains(plot.Berry)) { plot.Berry = 0; plot.CycleStartMs = 0; }
            garden.Pot.RemoveAll(berry => berry <= 0);
            if (garden.Pot.Count > ParkGardenRules.PotCapacity) garden.Pot.RemoveRange(ParkGardenRules.PotCapacity, garden.Pot.Count - ParkGardenRules.PotCapacity);
            garden.Feeder = Math.Max(0, garden.Feeder);
        }
        return this;
    }
}

/// <summary>How far a plot has come.</summary>
public enum PlotStage { Empty, Sprout, Sapling, Tree, Ripe }

/// <summary>A plot as the park draws it.</summary>
public sealed record PlotView(int Berry, PlotStage Stage, double Progress, TimeSpan Left);

/// <summary>A berry eaten from a pot: which one, and which of the habitat's eaters ate it.</summary>
public sealed record GardenMeal(int Berry, int Eater);

/// <summary>
/// The garden rules, free of UI so they can be tested. Each habitat grows only its own three
/// berries. A planted berry becomes a tree that is ripe twelve hours later; dragging its berries
/// to the pot picks them and starts the next twelve hours. The habitat's residents eat one berry
/// from the pot every hour, taking turns, and every berry raises the eater's friendship.
/// </summary>
public static class ParkGardenRules
{
    public const int Habitats = 4;
    public const int PlotsPerHabitat = 4;
    public static readonly TimeSpan GrowTime = TimeSpan.FromHours(12);
    public const int BerriesPerHarvest = 3;
    public const int PotCapacity = 12;
    public static readonly TimeSpan MealEvery = TimeSpan.FromHours(1);
    public const int FriendshipPerBerry = 5;

    private static readonly int[][] Berries =
    [
        [149, 151, 155], // Sunlit Commons: Cheri, Pecha, Oran
        [150, 154, 156], // Cascade Lake: Chesto, Leppa, Persim
        [152, 159, 161], // Ember Grove: Rawst, Figy, Mago
        [153, 160, 162], // Sky Summit: Aspear, Wiki, Aguav
    ];

    /// <summary>The berries (national item ids) a habitat's soil takes.</summary>
    public static IReadOnlyList<int> BerriesFor(int habitat) => Berries[Math.Clamp(habitat, 0, Habitats - 1)];

    /// <summary>Every berry some habitat grows.</summary>
    public static IEnumerable<int> AllBerries => Berries.SelectMany(berries => berries);

    public static PlotView View(GardenPlot plot, long nowMs)
    {
        if (plot.Berry <= 0) return new PlotView(0, PlotStage.Empty, 0, TimeSpan.Zero);
        var grown = Math.Max(0, nowMs - plot.CycleStartMs);
        var progress = Math.Clamp(grown / GrowTime.TotalMilliseconds, 0, 1);
        var stage = progress >= 1 ? PlotStage.Ripe : progress >= 0.6 ? PlotStage.Tree : progress >= 0.25 ? PlotStage.Sapling : PlotStage.Sprout;
        var left = TimeSpan.FromMilliseconds(Math.Max(0, GrowTime.TotalMilliseconds - grown));
        return new PlotView(plot.Berry, stage, progress, left);
    }

    /// <summary>Plants a berry in an empty plot; the refusal, or null when it was planted.</summary>
    public static string? Plant(HabitatGarden garden, int habitat, int plot, int berry, long nowMs)
    {
        if ((uint)plot >= (uint)garden.Plots.Count) return "There is no such plot.";
        if (!BerriesFor(habitat).Contains(berry)) return "That berry does not grow in this habitat.";
        if (garden.Plots[plot].Berry > 0) return "Something already grows there.";
        garden.Plots[plot].Berry = berry;
        garden.Plots[plot].CycleStartMs = nowMs;
        return null;
    }

    /// <summary>
    /// Picks a ripe tree into the pot (all <see cref="BerriesPerHarvest"/> berries, or none)
    /// and starts its next twelve hours. Returns the refusal, or null when it was picked.
    /// </summary>
    public static string? Harvest(HabitatGarden garden, int plot, long nowMs)
    {
        if ((uint)plot >= (uint)garden.Plots.Count || garden.Plots[plot].Berry <= 0) return "Nothing grows there yet.";
        var view = View(garden.Plots[plot], nowMs);
        if (view.Stage != PlotStage.Ripe) return "Its berries are not ripe yet.";
        if (PotCapacity - garden.Pot.Count < BerriesPerHarvest) return "The pot is too full. Let the Pokémon eat a little first.";
        // An empty pot starts its first hour now: the first meal comes an hour after the berries.
        if (garden.Pot.Count == 0) garden.MealClockMs = nowMs;
        for (var i = 0; i < BerriesPerHarvest; i++) garden.Pot.Add(garden.Plots[plot].Berry);
        garden.Plots[plot].CycleStartMs = nowMs;
        return null;
    }

    /// <summary>Clears a plot so another berry can go in; the tree is gone for good.</summary>
    public static void DigUp(HabitatGarden garden, int plot)
    {
        if ((uint)plot >= (uint)garden.Plots.Count) return;
        garden.Plots[plot].Berry = 0;
        garden.Plots[plot].CycleStartMs = 0;
    }

    /// <summary>
    /// Counts the meals due since the last count: one berry per hour while the pot has some and
    /// the habitat has someone to eat them, the eaters taking turns. Hours with an empty pot or
    /// nobody around are not saved up for later.
    /// </summary>
    public static IReadOnlyList<GardenMeal> Meals(HabitatGarden garden, int eaters, long nowMs)
    {
        var step = (long)MealEvery.TotalMilliseconds;
        if (garden.MealClockMs <= 0 || garden.MealClockMs > nowMs || eaters <= 0 || garden.Pot.Count == 0)
        {
            garden.MealClockMs = nowMs;
            return [];
        }
        var due = (nowMs - garden.MealClockMs) / step;
        if (due <= 0) return [];
        var meals = new List<GardenMeal>();
        while (meals.Count < due && garden.Pot.Count > 0)
        {
            var berry = garden.Pot[0];
            garden.Pot.RemoveAt(0);
            meals.Add(new GardenMeal(berry, garden.Feeder % eaters));
            garden.Feeder = (garden.Feeder + 1) % eaters;
        }
        garden.MealClockMs = garden.Pot.Count == 0 ? nowMs : garden.MealClockMs + meals.Count * step;
        return meals;
    }
}
