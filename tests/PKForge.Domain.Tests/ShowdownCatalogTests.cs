using System.Buffers.Binary;
using PKForge.Domain;
using Xunit;

namespace PKForge.Domain.Tests;

public sealed class ShowdownCatalogTests
{
    [Theory]
    [InlineData(6, 0, false, "showdown/front/charizard.png")]
    [InlineData(6, 1, true, "showdown/front-shiny/charizard-megax.png")]
    [InlineData(201, 2, false, "showdown/front/unown-c.png")]
    public void FrontsResolveToTheFormsOwnSprite(int species, int form, bool shiny, string path) =>
        Assert.Equal(path, ShowdownCatalog.FrontPath(new SpriteLook(species, form, shiny)));

    [Theory]
    [InlineData(201, 26, false)] // Unown !: Showdown only draws it shiny
    [InlineData(978, 3, false)]  // a Legends: Z-A Mega with no front yet
    [InlineData(6, 99, false)]   // a form Showdown does not know
    public void MissingFrontsReturnNullSoPkhexArtIsUsed(int species, int form, bool shiny) =>
        Assert.Null(ShowdownCatalog.FrontPath(new SpriteLook(species, form, shiny)));

    [Fact]
    public void IconCellsFollowTheSheetGrid()
    {
        // Pikachu is icon 25: row 2, column 1 of the 12-wide sheet.
        Assert.Equal(new SheetCell(40, 60, 40, 30), ShowdownCatalog.IconCell(new SpriteLook(25, 0, false)));
        // Mega Charizard X has its own icon, not Charizard's.
        Assert.Equal(1321, ShowdownCatalog.For(new SpriteLook(6, 1, false))!.Icon);
    }

    [Fact]
    public void UnknownFormsHaveNoIconSoPkhexArtIsUsed() =>
        Assert.Null(ShowdownCatalog.IconCell(new SpriteLook(6, 99, false)));

    [Fact]
    public void CommentsAndMalformedRowsAreSkipped()
    {
        var map = ShowdownCatalog.Parse(new StringReader("# header\n\n1-0\tbulbasaur\t3\t1\nbroken\trow\n"));
        Assert.Single(map);
        Assert.Equal(new ShowdownCatalog.Entry("bulbasaur", true, true, 1), map["1-0"]);
    }

    [Fact]
    public void EveryCatalogSpriteIsBundledWithTheExactName()
    {
        // Android asset names are case-sensitive and a missing file only shows as PKHeX's art,
        // so a table and folder that drift apart would go unnoticed on the phone.
        var root = AppContext.BaseDirectory;
        while (!File.Exists(Path.Combine(root, "PKForge.sln"))) root = Path.GetDirectoryName(root)!;
        var assets = Path.Combine(root, "src/PKForge.App/Resources/Showdown");
        using var table = new StreamReader(Path.Combine(root, "src/PKForge.Domain/Resources/showdownsprites.tsv"));
        var entries = ShowdownCatalog.Parse(table);
        var fronts = Directory.GetFiles(Path.Combine(assets, "front")).Select(Path.GetFileName).ToHashSet(StringComparer.Ordinal);
        var shinies = Directory.GetFiles(Path.Combine(assets, "front-shiny")).Select(Path.GetFileName).ToHashSet(StringComparer.Ordinal);
        foreach (var (key, entry) in entries)
        {
            if (entry.Front) Assert.True(fronts.Contains(entry.Stem + ".png"), $"{key}: front/{entry.Stem}.png");
            if (entry.ShinyFront) Assert.True(shinies.Contains(entry.Stem + ".png"), $"{key}: front-shiny/{entry.Stem}.png");
        }

        // The sheet must hold the last icon the table points at (a PNG's size sits at bytes 16-23).
        var header = File.ReadAllBytes(Path.Combine(assets, "icons.png"))[16..24];
        Assert.Equal(ShowdownCatalog.SheetColumns * ShowdownCatalog.IconWidth, BinaryPrimitives.ReadInt32BigEndian(header));
        var rows = entries.Values.Max(e => e.Icon) / ShowdownCatalog.SheetColumns + 1;
        Assert.True(rows * ShowdownCatalog.IconHeight <= BinaryPrimitives.ReadInt32BigEndian(header.AsSpan(4)));
    }
}
