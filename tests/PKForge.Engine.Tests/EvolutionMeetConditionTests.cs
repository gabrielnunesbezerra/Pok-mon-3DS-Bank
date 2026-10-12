using PKForge.Domain;
using PKForge.Engine;
using PKHeX.Core;
using Xunit;

namespace PKForge.Engine.Tests;

/// <summary>
/// "Meet & evolve": when the game's condition is not met, PKForge makes the changes a player
/// would (level, friendship, held item, move, Everstone, stone), evolves, and the result stays
/// legal. Without the request flag nothing changes; conditions it cannot meet are not offered.
/// </summary>
public sealed class EvolutionMeetConditionTests
{
    private static readonly EvolutionService Service = new();

    private static SaveEngineSession Legal(int generation, Species species, int level)
    {
        var session = (SaveEngineSession)new SaveEngine().OpenBlankSession(generation);
        var outcome = new LegalizerService().Generate(session, 0, 0,
            new GenerationRequest((int)species, level, Shiny: false, Nature: null, Ability: null, Ball: null, Moves: null));
        Assert.True(outcome.Success, outcome.Message);
        Assert.True(new LegalityAnalysis(session.GetEntity(0, 0)).Valid);
        return session;
    }

    private static PKM MeetAndEvolve(SaveEngineSession session, Species into, string expectedChange)
    {
        var option = Assert.Single(Service.Plan(session, 0, 0, hax: false).Options, o => o.Species == (int)into);
        Assert.False(option.Available);
        Assert.False(option.ConditionMet);
        Assert.NotNull(option.MeetCondition);
        Assert.Contains(expectedChange, option.MeetCondition);

        // Asking for a plain evolution still changes nothing.
        Assert.False(Service.Evolve(session, 0, 0, new EvolutionRequest(option.Id)).Success);
        Assert.NotEqual((ushort)into, session.GetEntity(0, 0).Species);

        var outcome = Service.Evolve(session, 0, 0, new EvolutionRequest(option.Id, MeetCondition: true));
        Assert.True(outcome.Success, outcome.Message);
        var pk = session.GetEntity(0, 0);
        Assert.Equal((ushort)into, pk.Species);
        var la = new LegalityAnalysis(pk);
        Assert.True(la.Valid, la.Report());
        return pk;
    }

    [Theory]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(8)]
    public void ALowLevelIsRaisedToTheEvolutionLevel(int generation)
    {
        using var session = Legal(generation, Species.Bulbasaur, 5);
        var pk = MeetAndEvolve(session, Species.Ivysaur, "Lv. 16");
        Assert.Equal(16, pk.CurrentLevel);
    }

    [Theory]
    [InlineData(4)]
    [InlineData(8)]
    public void FriendshipIsRaised(int generation)
    {
        using var session = Legal(generation, Species.Golbat, 30);
        var pk = session.GetEntity(0, 0);
        pk.CurrentFriendship = 70;
        pk.RefreshChecksum();
        session.SaveFile.SetBoxSlotAtIndex(pk, 0, 0, EntityImportSettings.None);
        MeetAndEvolve(session, Species.Crobat, "friendship");
    }

    [Theory]
    [InlineData(4)]
    [InlineData(8)]
    public void TheTradeItemIsGivenAndUsedUp(int generation)
    {
        using var session = Legal(generation, Species.Onix, 30);
        var pk = MeetAndEvolve(session, Species.Steelix, "Metal Coat");
        Assert.Equal(0, pk.HeldItem);
    }

    [Fact]
    public void AnEverstoneIsTakenOff()
    {
        using var session = Legal(8, Species.Machoke, 40);
        var pk = session.GetEntity(0, 0);
        pk.HeldItem = 229; // Everstone
        pk.RefreshChecksum();
        session.SaveFile.SetBoxSlotAtIndex(pk, 0, 0, EntityImportSettings.None);
        MeetAndEvolve(session, Species.Machamp, "Everstone");
    }

    [Fact]
    public void AStoneIsUsedWithoutOneInTheBag()
    {
        using var session = Legal(8, Species.Pikachu, 20);
        MeetAndEvolve(session, Species.Raichu, "Thunder Stone");
    }

    [Fact]
    public void TheMoveIsTaught()
    {
        // Taught at its level when that is legal (an egg move here), else at the learnset level.
        using var session = Legal(4, Species.Aipom, 10);
        var pk = MeetAndEvolve(session, Species.Ambipom, "Double Hit");
        Assert.True(pk.HasMove((ushort)Move.DoubleHit));
    }

    [Fact]
    public void AConditionItCannotMeetIsNotOffered()
    {
        // Feebas evolves on high Beauty, which PKForge cannot see or set.
        using var session = Legal(4, Species.Feebas, 20);
        var option = Assert.Single(Service.Plan(session, 0, 0, hax: false).Options, o => o.Species == (int)Species.Milotic);
        Assert.False(option.Available);
        Assert.Null(option.MeetCondition);
    }
}
