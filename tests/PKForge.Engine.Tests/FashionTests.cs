using PKForge.Engine;
using PKHeX.Core;
using Xunit;

namespace PKForge.Engine.Tests;

public sealed class FashionTests
{
    [Fact]
    public void SwordShieldLegalFashionUnlockUsesUpstreamLegalFilter()
    {
        using var session = (SaveEngineSession)new SaveEngine().OpenBlankSession(8);
        var save = Assert.IsType<SAV8SWSH>(session.SaveFile);
        Assert.True(session.SupportsLegalFashionUnlock);

        session.UnlockAllLegalFashion();

        // At least a standard eyewear entry is now owned; the upstream routine also
        // removes version-incompatible and unobtainable clothing before returning.
        Assert.NotEmpty(save.Fashion.GetIndexesOwnedFlag(FashionUnlock8.REGION_EYEWEAR));
    }

    [Fact]
    public void XYFashionUnlockAndMaxStyleSurviveWriteAndReload()
    {
        using var session = new SaveEngineSession(BlankSaveFile.Get(GameVersion.X, "PKForge", LanguageID.English), null);
        var save = Assert.IsType<SAV6XY>(session.SaveFile);
        Assert.True(session.SupportsLegalFashionUnlock);
        Assert.True(session.SupportsStylePoints);
        Assert.Equal(0, session.GetStylePoints());

        session.UnlockAllLegalFashion();
        session.SetStylePoints(SaveEngineSession.MaxStylePoints);
        var expected = save.Fashion.Data.ToArray();
        Assert.Contains(expected, b => b != 0);

        // Blank X/Y bytes are not auto-detected, so reload through the format constructor.
        using var reloaded = new SaveEngineSession(new SAV6XY(save.Write().ToArray()), null);
        var again = Assert.IsType<SAV6XY>(reloaded.SaveFile);
        Assert.Equal(expected, again.Fashion.Data.ToArray());
        Assert.Equal(SaveEngineSession.MaxStylePoints, reloaded.GetStylePoints());
    }

    [Fact]
    public void StylePointsAreXYOnly()
    {
        using var session = new SaveEngineSession(BlankSaveFile.Get(GameVersion.OR, "PKForge", LanguageID.English), null);
        Assert.False(session.SupportsStylePoints);
        Assert.False(session.SupportsLegalFashionUnlock);
        Assert.Throws<NotSupportedException>(() => session.SetStylePoints(1));
    }

    [Fact]
    public void OtherFormatsRejectLegalFashionUnlock()
    {
        using var session = (SaveEngineSession)new SaveEngine().OpenBlankSession(7);
        Assert.False(session.SupportsLegalFashionUnlock);
        Assert.Throws<NotSupportedException>(session.UnlockAllLegalFashion);
    }
}
