using PKForge.Domain;
using PKForge.Engine;
using PKForge.Infrastructure;

namespace PKForge.App.Services;

/// <summary>A berry a resident ate from a pot, and the friendship it has now (-1 when it cannot gain any).</summary>
public sealed record GardenMealReport(ParkPokemon Eater, int Berry, int Friendship);

/// <summary>
/// The Poképark gardens (3DS Bank 2.2): berries come out of the Item Storage to be planted,
/// ripen every twelve hours and go to the habitat's pot, where the Bank residents eat them
/// and gain friendship. The gardens, the Storage and the Bank change together, as one step
/// under the Bank's lock, and travel with the account.
/// </summary>
public sealed class ParkGardenService(ReloadableBankService bank, ISaveEngine engine)
{
    private static long Now => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    private static ParkGardenState Load(string root) => BankSideFiles.Load<ParkGardenState>(root, ParkGardenState.FileName).Normalized();

    private static void Save(string root, ParkGardenState state) => BankSideFiles.Save(root, ParkGardenState.FileName, state);

    /// <summary>A habitat's garden as it is now.</summary>
    public HabitatGarden Read(int habitat) => bank.Read((_, root) => Load(root).For(habitat));

    /// <summary>How many of each of the habitat's berries the Item Storage has.</summary>
    public IReadOnlyList<(int Berry, int Count)> SeedsFor(int habitat)
    {
        var storage = bank.Read((_, root) => BankSideFiles.Load<StorageState>(root, StorageState.FileName).Normalized());
        return [.. ParkGardenRules.BerriesFor(habitat).Select(berry => (berry, storage.CountOf(berry)))];
    }

    /// <summary>Plants one berry from the Item Storage; the refusal, or null when it went in.</summary>
    public string? Plant(int habitat, int plot, int berry) => Guard(() => bank.Change<string?>((_, root) =>
    {
        var storage = BankSideFiles.Load<StorageState>(root, StorageState.FileName).Normalized();
        if (storage.CountOf(berry) <= 0) return "Your Item Storage has none of that berry.";
        var gardens = Load(root);
        if (ParkGardenRules.Plant(gardens.For(habitat), habitat, plot, berry, Now) is { } refusal) return refusal;
        storage.Take(berry, 1);
        BankSideFiles.Save(root, StorageState.FileName, storage);
        Save(root, gardens);
        return null;
    }));

    /// <summary>Picks a ripe tree into the pot; the refusal, or null when it was picked.</summary>
    public string? Harvest(int habitat, int plot) => Guard(() => bank.Change<string?>((_, root) =>
    {
        var gardens = Load(root);
        if (ParkGardenRules.Harvest(gardens.For(habitat), plot, Now) is { } refusal) return refusal;
        Save(root, gardens);
        return null;
    }));

    /// <summary>Clears a plot for another berry.</summary>
    public string? DigUp(int habitat, int plot) => Guard(() => bank.Change<string?>((_, root) =>
    {
        var gardens = Load(root);
        ParkGardenRules.DigUp(gardens.For(habitat), plot);
        Save(root, gardens);
        return null;
    }));

    /// <summary>
    /// Lets a habitat's residents eat what is due from its pot. Only Bank residents whose game
    /// keeps friendship eat (the park never writes into a game's save); each berry raises the
    /// eater's friendship, saved into the Pokémon so it goes with it to its game.
    /// </summary>
    public IReadOnlyList<GardenMealReport> Feed(int habitat, IReadOnlyList<ParkPokemon> residents)
    {
        try
        {
            // Most calls find nothing due: they only read, so the Bank is not touched (and not synced).
            var due = bank.Read((_, root) =>
            {
                var garden = Load(root).For(habitat);
                return garden.Pot.Count > 0 && (garden.MealClockMs <= 0 || Now - garden.MealClockMs >= (long)ParkGardenRules.MealEvery.TotalMilliseconds);
            });
            if (!due) return [];
            return bank.Change((inner, root) =>
            {
                var entries = inner.GetAll().ToDictionary(entry => entry.Id);
                var eaters = residents.Where(mon => PokeparkCareService.BankIdOf(mon) is { } id && entries.TryGetValue(id, out var entry)
                        && ParkCareEngine.Read(inner.GetData(id), entry.Info.Format) is { SupportsFriendship: true })
                    .ToList();
                var gardens = Load(root);
                var garden = gardens.For(habitat);
                var clock = garden.MealClockMs;
                var meals = ParkGardenRules.Meals(garden, eaters.Count, Now);
                var reports = new List<GardenMealReport>();
                foreach (var meal in meals)
                {
                    var mon = eaters[meal.Eater];
                    var entry = entries[PokeparkCareService.BankIdOf(mon)!.Value];
                    var updated = ParkCareEngine.AddFriendship(inner.GetData(entry.Id), entry.Info.Format, ParkGardenRules.FriendshipPerBerry, out var friendship);
                    if (updated is not null)
                    {
                        var info = engine.TryDescribeEntity(updated, entry.Info.SourceName, entry.Info.Format) ?? entry.Info;
                        using (ThreeDsBankPolicy.AllowParkCare())
                            inner.Replace(entry.Id, updated, info);
                    }
                    reports.Add(new GardenMealReport(mon, meal.Berry, updated is null ? -1 : friendship));
                }
                if (meals.Count > 0 || garden.MealClockMs != clock) Save(root, gardens);
                return (IReadOnlyList<GardenMealReport>)reports;
            });
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or InvalidOperationException)
        {
            AppLog.Warn("garden", $"Meals: {error.Message}");
            return [];
        }
    }

    private static string? Guard(Func<string?> work)
    {
        try
        {
            return work();
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or InvalidOperationException)
        {
            AppLog.Warn("garden", error.ToString());
            return $"The garden could not be saved: {error.Message}";
        }
    }
}
