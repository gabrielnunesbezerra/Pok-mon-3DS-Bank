using PKForge.Domain;
using Xunit;

namespace PKForge.Domain.Tests;

public sealed class IvRankTests
{
    [Theory]
    [InlineData(0, 1)]
    [InlineData(90, 1)]
    [InlineData(91, 2)]
    [InlineData(120, 2)]
    [InlineData(121, 3)]
    [InlineData(150, 3)]
    [InlineData(151, 4)]
    [InlineData(186, 4)]
    public void TotalsMapToPkhexStars(int total, int stars) => Assert.Equal(stars, IvRank.Stars(total));

    [Fact]
    public void OrderSortsByTotalAndKeepsStorageOrderOnTies()
    {
        (string, IReadOnlyList<int>)[] boxes =
        [
            ("a", [10, 10, 10, 10, 10, 10]),
            ("b", [31, 31, 31, 31, 31, 31]),
            ("c", [10, 10, 10, 10, 10, 10]),
            ("d", [0, 0, 0, 0, 0, 0]),
        ];
        Assert.Equal(["b", "a", "c", "d"], IvRank.Order(boxes));
        Assert.Equal(["d", "a", "c", "b"], IvRank.Order(boxes, highestFirst: false));
    }

    [Fact]
    public void SixIvsAreSummed() => Assert.Equal(4, IvRank.Stars([31, 31, 31, 31, 31, 31]));
}
