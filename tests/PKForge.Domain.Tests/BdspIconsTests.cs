using PKForge.Domain;
using Xunit;

namespace PKForge.Domain.Tests;

public sealed class BdspIconsTests
{
    [Theory]
    [InlineData("pm0003_00_00.png", 3, 0, false, false, null, "bdsp/3-0.png")]
    [InlineData("pm0003_00_11.png", 3, 0, true, true, null, "bdsp/3-0-f-s.png")]
    [InlineData("pm0201_05_21.png", 201, 5, false, true, null, "bdsp/201-5-s.png")]
    [InlineData("pm0869_03_10_04.png", 869, 3, true, false, 4, "bdsp/869-3-f-v4.png")]
    public void UpstreamNamesMapToALookAndACachePath(string file, int species, int form, bool female, bool shiny, int? variant, string cache)
    {
        var icon = BdspIcons.Parse(file);
        Assert.NotNull(icon);
        Assert.Equal((species, form, female, shiny, variant), (icon.Species, icon.Form, icon.Female, icon.Shiny, icon.Variant));
        Assert.Equal(cache, icon.CachePath);
        Assert.True(SpritePack.IsSafeEntryName(icon.CachePath));
    }

    [Theory]
    [InlineData("pm0000_00_21.png")]      // the egg: not a species
    [InlineData("star1.png")]
    [InlineData("pm0003_00_00_BodyA_col.png")]
    [InlineData("pm0003_00_31.png")]
    [InlineData("pm03_00_00.png")]
    public void AnythingElseIsIgnored(string file) => Assert.Null(BdspIcons.Parse(file));

    [Fact]
    public void LookupsFallBackThroughVariantAndGenderButNeverShininess()
    {
        var female = BdspIcons.Candidates(new SpriteLook(869, 3, true, new SpriteTraits(Female: true, FormArgument: 4)));
        Assert.Equal(["bdsp/869-3-f-s-v4.png", "bdsp/869-3-f-s.png", "bdsp/869-3-s-v4.png", "bdsp/869-3-s.png"], female);
        Assert.All(female, path => Assert.Contains("-s", path, StringComparison.Ordinal));
        Assert.Equal(["bdsp/25-0.png"], BdspIcons.Candidates(new SpriteLook(25, 0, false)));
        Assert.Empty(BdspIcons.Candidates(new SpriteLook(6, 0, false, new SpriteTraits(Gigantamax: true))));
    }

    [Theory]
    [InlineData("Gen8b", true)]
    [InlineData("Gen8bLumi", true)]
    [InlineData("Gen8", false)]
    [InlineData("Gen4", false)]
    [InlineData(null, false)]
    public void OnlyBdspAndLumiBoxesWearTheBdspStyle(string? format, bool applies) =>
        Assert.Equal(applies, BdspIcons.AppliesTo(format));
}
