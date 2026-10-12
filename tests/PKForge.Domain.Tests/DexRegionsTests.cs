using PKForge.Domain;
using Xunit;

namespace PKForge.Domain.Tests;

public sealed class DexRegionsTests
{
    [Theory]
    [InlineData(1, "Kanto")]
    [InlineData(151, "Kanto")]
    [InlineData(152, "Johto")]
    [InlineData(493, "Sinnoh")]
    [InlineData(1025, "Paldea")]
    public void SpeciesBelongToTheGenerationThatIntroducedThem(int species, string region) =>
        Assert.Equal(region, DexRegions.Of(species)?.Name);

    [Fact]
    public void RegionsCoverTheDexWithoutGaps()
    {
        for (var i = 1; i < DexRegions.All.Count; i++)
            Assert.Equal(DexRegions.All[i - 1].Last + 1, DexRegions.All[i].First);
        Assert.Null(DexRegions.Of(0));
        Assert.Null(DexRegions.Of(1026));
    }
}
