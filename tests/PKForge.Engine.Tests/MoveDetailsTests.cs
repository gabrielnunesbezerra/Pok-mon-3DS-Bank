using PKForge.Domain;
using PKForge.Engine;
using PKHeX.Core;
using Xunit;

namespace PKForge.Engine.Tests;

public sealed class MoveDetailsTests
{
    [Fact]
    public void PPUpsAndRelearnMovesAreClampedAndPersisted()
    {
        using var session = Seed(7, new PK7 { Version = GameVersion.UM, Move1 = 85, Move2 = 33 });

        session.ApplyMoveDetails(0, 0, new MoveDetailsEdit(
            PP: [999, -10, 99, 99],
            PPUps: [99, 2, 3, 3],
            RelearnMoves: [85, 33, -1, 99999]));

        var details = session.GetMoveDetails(0, 0);
        Assert.Equal(4, details.Moves.Count);
        Assert.Equal(3, details.Moves[0].PPUps);
        Assert.Equal(details.Moves[0].MaxPP, details.Moves[0].PP);
        Assert.Equal(2, details.Moves[1].PPUps);
        Assert.Equal(0, details.Moves[2].PPUps);
        Assert.Equal(0, details.Moves[2].PP);
        Assert.True(details.SupportsRelearn);
        Assert.Equal([85, 33, 0, 728], details.RelearnMoves);
    }

    [Fact]
    public void OlderFormatsDoNotExposeRelearnSlots()
    {
        using var session = Seed(4, new PK4 { Version = GameVersion.Pt, Move1 = 85 });
        Assert.False(session.GetMoveDetails(0, 0).SupportsRelearn);
        Assert.Throws<InvalidOperationException>(() => session.ApplyMoveDetails(0, 0, new MoveDetailsEdit(RelearnMoves: [85, 0, 0, 0])));
    }

    /// <summary>
    /// Report: a Gen 3 Kadabra that evolved past level 25 and missed Recover, given the move
    /// in the editor, was flagged. Recover is 20 PP in Gen 3, and a boxed Pokémon that has
    /// trained (EVs) must carry full PP; the edit left the slot at 0 PP ("PP should be 20").
    /// </summary>
    [Theory]
    [InlineData(GameVersion.E)]
    [InlineData(GameVersion.FR)]
    public void TeachingAMoveGivesItFullPPForItsGeneration(GameVersion version)
    {
        var save = BlankSaveFile.Get(version, "PKForge", LanguageID.English);
        using var session = new SaveEngineSession(save, null);
        var made = new LegalizerService().Generate(session, 0, 0,
            new GenerationRequest(64, 30, Shiny: false, Nature: null, Ability: null, Ball: null, Moves: null, Form: 0));
        Assert.True(made.Success, made.Message);
        session.ApplyEdit(0, 0, new EntityEdit(EVs: [4, 0, 0, 0, 0, 0])); // trained: boxed PP must be full
        session.ApplyMoveDetails(0, 0, new MoveDetailsEdit(PPUps: [3, 0, 0, 0]));
        Assert.True(new LegalityAnalysis(session.GetEntity(0, 0)).Valid);

        session.ApplyEdit(0, 0, new EntityEdit(Move1: (int)Move.Recover, Move2: (int)Move.Teleport));

        var pk = session.GetEntity(0, 0);
        Assert.Equal(20, pk.Move1_PP); // Gen 3 Recover
        Assert.Equal(0, pk.Move1_PPUps); // a newly learned move starts without PP Ups
        Assert.Equal(20, pk.Move2_PP); // the empty slot no longer sits at 0 PP
        var la = new LegalityAnalysis(pk);
        Assert.True(la.Valid, la.Report());
    }

    private static SaveEngineSession Seed(int generation, PKM mon)
    {
        var session = (SaveEngineSession)new SaveEngine().OpenBlankSession(generation);
        mon.Species = 25;
        mon.CurrentLevel = 20;
        mon.RefreshChecksum();
        var bytes = new byte[mon.SIZE_STORED];
        mon.WriteDecryptedDataStored(bytes);
        Assert.True(session.ImportSlot(0, 0, bytes));
        return session;
    }
}
