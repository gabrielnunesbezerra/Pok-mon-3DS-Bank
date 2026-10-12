using PKForge.Domain;
using PKForge.Engine;
using PKHeX.Core;
using Xunit;

namespace PKForge.Engine.Tests;

/// <summary>
/// 3DS Bank 2.0's changes to Bank Pokémon: held items kept by national id, items a game cannot
/// have coming off on the way in (for the Storage), the Shooting Star, and the evolutions an
/// online trade causes on the receiving side.
/// </summary>
public sealed class BankFeaturesTests
{
    private const ushort Pikachu = 25, Kadabra = 64, Alakazam = 65, Onix = 95, Steelix = 208;
    private const ushort Karrablast = 588, Escavalier = 589, Shelmet = 616, Accelgor = 617;
    private const int Everstone = 229, MetalCoat = 233, Leftovers = 234;

    private static readonly SaveEngine Engine = new();

    private sealed class OwnershipSettings : IGenerationOwnershipSettings
    {
        public bool UseCurrentTrainerForGeneration => true;
    }

    /// <summary>A legal Pokémon of a generation, as the Bank stores it.</summary>
    private static (byte[] Data, string Format) Legal(int generation, ushort species, int level)
    {
        using var session = (SaveEngineSession)Engine.OpenBlankSession(generation);
        if (generation > 1)
            session.SetTrainer(generation <= 2 ? new TrainerInfo("ASH", 12345, 0, 1000, 0) : new TrainerInfo("Ash", 12345, 54321, 1000, 0));
        var outcome = new LegalizerService(new OwnershipSettings()).Generate(session, 0, 0,
            new GenerationRequest(species, level, Shiny: false, Nature: null, Ability: null, Ball: null, Moves: null));
        Assert.True(outcome.Success, $"gen {generation} {(Species)species}: {outcome.Message}");
        var export = session.ExportSlot(0, 0);
        return (export.Data, export.Format!);
    }

    private static PKM Read(byte[] data, string format) => EntityBytes.Parse(data, format)!;

    private static (byte[] Data, string Format) Holding((byte[] Data, string Format) mon, int national)
    {
        var change = BankMonEdits.SetHeldItem(mon.Data, mon.Format, national, out _, out var refusal);
        Assert.True(change is not null, refusal);
        return (change.Data, change.Format);
    }

    private static int ItemId(string name)
    {
        var index = Array.IndexOf(GameInfo.GetStrings("en").itemlist, name);
        Assert.True(index > 0, $"no item named {name}");
        return index;
    }

    // ── Items ────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(7)]
    public void ItemsKeepTheirNationalIdAcrossGenerations(int generation)
    {
        var context = generation switch { 2 => EntityContext.Gen2, 3 => EntityContext.Gen3, 4 => EntityContext.Gen4, _ => EntityContext.Gen7 };
        var native = HeldItemRules.FromNational(Leftovers, context);
        Assert.True(native > 0);
        Assert.Equal(Leftovers, HeldItemRules.ToNational(native, context));
    }

    [Fact]
    public void GenerationOneHasNoItemsToKeep()
    {
        Assert.Equal(0, HeldItemRules.FromNational(Leftovers, EntityContext.Gen1));
        var (data, format) = Legal(1, Pikachu, 10);
        Assert.NotNull(HeldItemRules.WhyCannotHold(Read(data, format), Leftovers));
    }

    [Theory]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(6)]
    [InlineData(7)]
    public void AnItemCanBeGivenAndTakenBack(int generation)
    {
        var mon = Legal(generation, Pikachu, 20);
        var holding = Holding(mon, Leftovers);
        Assert.Equal(Leftovers, BankMonEdits.HeldItemOf(holding.Data, holding.Format));

        var taken = BankMonEdits.SetHeldItem(holding.Data, holding.Format, 0, out var previous, out var refusal);
        Assert.True(taken is not null, refusal);
        Assert.Equal(Leftovers, previous);
        Assert.Equal(0, BankMonEdits.HeldItemOf(taken.Data, taken.Format));
        Assert.Equal(Pikachu, Read(taken.Data, taken.Format).Species);
    }

    [Fact]
    public void AnItemTheGenerationLacksCannotBeGiven()
    {
        var steelixite = ItemId("Steelixite");
        var (data, format) = Legal(4, Steelix, 40);
        Assert.Null(BankMonEdits.SetHeldItem(data, format, steelixite, out _, out var refusal));
        Assert.NotNull(refusal);
    }

    [Fact]
    public void SteelixiteComesOffOnTheWayIntoPokemonX()
    {
        var steelixite = ItemId("Steelixite");
        var mon = Holding(Legal(6, Steelix, 50), steelixite);

        using var x = new SaveEngineSession(BlankSaveFile.Get(GameVersion.X, "Ash"), null);
        Assert.True(BankTransfers.TryImport(x, 0, 0, mon.Data, out var refusal, out var returned, mon.Format), refusal);
        Assert.Equal(steelixite, returned);
        Assert.Equal(0, x.GetEntity(0, 0).HeldItem);
        Assert.Equal(Steelix, x.GetEntity(0, 0).Species);

        using var alphaSapphire = new SaveEngineSession(BlankSaveFile.Get(GameVersion.AS, "Ash"), null);
        Assert.True(BankTransfers.TryImport(alphaSapphire, 0, 0, mon.Data, out refusal, out returned, mon.Format), refusal);
        Assert.Equal(0, returned);
        Assert.Equal(steelixite, alphaSapphire.GetEntity(0, 0).HeldItem);
    }

    [Fact]
    public void AnItemComesOffWhenGoingBackToGenerationOne()
    {
        var mon = Holding(Legal(2, Pikachu, 20), Leftovers);
        using var red = (SaveEngineSession)Engine.OpenBlankSession(1);
        Assert.True(BankTransfers.TryImport(red, 0, 0, mon.Data, out var refusal, out var returned, mon.Format), refusal);
        Assert.Equal(Leftovers, returned);
    }

    [Fact]
    public void BagItemsMoveInAndOut()
    {
        using var session = (SaveEngineSession)Engine.OpenBlankSession(7);
        Assert.Equal(5, StorageBag.PutIn(session, Leftovers, 5, out var refusal));
        Assert.Null(refusal);
        var stack = Assert.Single(StorageBag.Movable(session), s => s.NationalId == Leftovers);
        Assert.Equal(5, stack.Count);
        Assert.Equal(3, StorageBag.TakeOut(session, stack.Pouch, stack.NativeId, 3));
        Assert.Equal(2, Assert.Single(StorageBag.Movable(session), s => s.NationalId == Leftovers).Count);
    }

    // ── The Shooting Star ────────────────────────────────────────────────────

    [Theory]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(5)]
    [InlineData(6)]
    [InlineData(7)]
    public void TheShootingStarMakesItShinyAndKeepsWhoItIs(int generation)
    {
        var (data, format) = Legal(generation, Pikachu, 20);
        var before = Read(data, format);
        var change = BankMonEdits.MakeShiny(data, format, out var refusal);
        Assert.True(change is not null, refusal);
        var after = Read(change.Data, change.Format);
        Assert.True(after.IsShiny);
        Assert.Equal(before.Species, after.Species);
        Assert.Equal(before.CurrentLevel, after.CurrentLevel);
        if (generation >= 3)
        {
            Assert.Equal(before.Nature, after.Nature);
            Assert.Equal(before.Gender, after.Gender);
        }
        Assert.Null(BankMonEdits.MakeShiny(change.Data, change.Format, out refusal));
        Assert.NotNull(refusal);
    }

    [Fact]
    public void AShinyMadeInGenerationSevenStaysLegal()
    {
        var (data, format) = Legal(7, Pikachu, 20);
        var change = BankMonEdits.MakeShiny(data, format, out _);
        Assert.NotNull(change);
        Assert.True(change.WasLegal);
        Assert.True(change.IsLegal, new LegalityAnalysis(Read(change.Data, change.Format)).Report());
    }

    // ── Trade evolutions ─────────────────────────────────────────────────────

    [Theory]
    [InlineData(1)]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(6)]
    [InlineData(7)]
    public void KadabraEvolvesWhenTraded(int generation)
    {
        var (data, format) = Legal(generation, Kadabra, 30);
        var evolved = BankMonEdits.TradeEvolve(Engine, data, format, Pikachu, "Gabriel");
        Assert.NotNull(evolved);
        Assert.Equal(Alakazam, evolved.Species);
        Assert.Equal(Alakazam, Read(evolved.Data, evolved.Format).Species);
    }

    [Theory]
    [InlineData(2)]
    [InlineData(4)]
    [InlineData(7)]
    public void OnixNeedsAMetalCoatAndTheTradeUsesItUp(int generation)
    {
        var onix = Legal(generation, Onix, 30);
        Assert.Null(BankMonEdits.TradeEvolve(Engine, onix.Data, onix.Format, Pikachu, "Gabriel"));

        var holding = Holding(onix, MetalCoat);
        var evolved = BankMonEdits.TradeEvolve(Engine, holding.Data, holding.Format, Pikachu, "Gabriel");
        Assert.NotNull(evolved);
        Assert.Equal(Steelix, evolved.Species);
        Assert.Equal(0, BankMonEdits.HeldItemOf(evolved.Data, evolved.Format));
    }

    [Fact]
    public void AnEverstoneStopsTheTradeEvolution()
    {
        var holding = Holding(Legal(4, Kadabra, 30), Everstone);
        Assert.Null(BankMonEdits.TradeEvolve(Engine, holding.Data, holding.Format, Pikachu, "Gabriel"));
    }

    [Theory]
    [InlineData(5)]
    [InlineData(7)]
    public void KarrablastAndShelmetEvolveOnlyForEachOther(int generation)
    {
        var karrablast = Legal(generation, Karrablast, 30);
        var shelmet = Legal(generation, Shelmet, 30);
        Assert.Null(BankMonEdits.TradeEvolve(Engine, karrablast.Data, karrablast.Format, Pikachu, "Gabriel"));
        Assert.Equal(Escavalier, BankMonEdits.TradeEvolve(Engine, karrablast.Data, karrablast.Format, Shelmet, "Gabriel")?.Species);
        Assert.Equal(Accelgor, BankMonEdits.TradeEvolve(Engine, shelmet.Data, shelmet.Format, Karrablast, "Gabriel")?.Species);
    }

    [Fact]
    public void APokemonThatDoesNotEvolveByTradeStaysAsItIs()
    {
        var (data, format) = Legal(7, Pikachu, 20);
        Assert.Null(BankMonEdits.TradeEvolve(Engine, data, format, Kadabra, "Gabriel"));
    }

    [Fact]
    public void TheFactsDescribeTheOffer()
    {
        var (data, format) = Legal(7, Kadabra, 30);
        var lines = BankMonFacts.Describe(data, format);
        Assert.Contains(lines, line => line.Contains("Kadabra", StringComparison.Ordinal));
        Assert.Contains(lines, line => line.StartsWith("Legality checks:", StringComparison.Ordinal));
    }
}
