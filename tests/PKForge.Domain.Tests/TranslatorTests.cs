using System.Text.RegularExpressions;
using PKForge.Domain;
using Xunit;

namespace PKForge.Domain.Tests;

/// <summary>The PT-BR display translation: exact lines, {0} patterns, pieces of status lines.</summary>
public sealed partial class TranslatorTests
{
    private static readonly Translator Sample = Translator.Parse(string.Join('\n',
        "# comment line",
        "Settings\tConfigurações",
        "Box {0}\tCaixa {0}",
        "Box {0} is full.\tA caixa {0} está cheia.",
        "{0} to {1}\t{0} até {1}",
        "{0} loved it! Friendship +{1} ({2}/255).\t{0} adorou! Amizade +{1} ({2}/255).",
        "Sign in\tEntrar",
        "Bank\tBanco",
        "Saved · {0} Pokémon\tSalvo · {0} Pokémon",
        "Line one\\nLine two\tLinha um\\nLinha dois",
        "Untranslated\t"));

    [Fact]
    public void ExactLinesAreLookedUp() =>
        Assert.Equal("Configurações", Sample.Translate("Settings"));

    [Fact]
    public void UnknownTextIsShownAsItIs() =>
        Assert.Equal("Something new", Sample.Translate("Something new"));

    [Fact]
    public void LinesWithoutTranslationAreSkipped() =>
        Assert.Equal("Untranslated", Sample.Translate("Untranslated"));

    [Fact]
    public void PatternsFillInTheirPieces() =>
        Assert.Equal("Pikachu adorou! Amizade +10 (80/255).", Sample.Translate("Pikachu loved it! Friendship +10 (80/255)."));

    [Fact]
    public void TheMostSpecificPatternWins() =>
        Assert.Equal("A caixa 3 está cheia.", Sample.Translate("Box 3 is full."));

    [Fact]
    public void ShortPatternsOnlyTakeOneWordPieces()
    {
        Assert.Equal("Caixa 12", Sample.Translate("Box 12"));
        Assert.Equal("1 até 3", Sample.Translate("1 to 3"));
        // "{0} to {1}" must not turn a whole unknown sentence into half Portuguese.
        Assert.Equal("Ready to move 3 Pokémon", Sample.Translate("Ready to move 3 Pokémon"));
    }

    [Fact]
    public void FilledInPiecesAreTranslatedToo() =>
        Assert.Equal("Salvo · 4 Pokémon", Sample.Translate("Saved · 4 Pokémon"));

    [Fact]
    public void StatusLinesAreTranslatedPieceByPiece() =>
        Assert.Equal("Banco · Configurações · Something new", Sample.Translate("Bank · Settings · Something new"));

    [Fact]
    public void BlocksAreTranslatedLineByLine() =>
        Assert.Equal("Entrar\nSomething new\nBanco", Sample.Translate("Sign in\nSomething new\nBank"));

    [Fact]
    public void EscapedNewLinesAreRead() =>
        Assert.Equal("Linha um\nLinha dois", Sample.Translate("Line one\nLine two"));

    [Fact]
    public void SurroundingSpacesAreKept() =>
        Assert.Equal("  Entrar ", Sample.Translate("  Sign in "));

    /// <summary>The table shipped with the app: two columns, one translation per line, no made-up pieces.</summary>
    [Fact]
    public void TheShippedTableIsWellFormed()
    {
        var path = FindTable();
        var placeholder = PlaceholderRegex();
        var problems = new List<string>();
        var seen = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var line in File.ReadAllLines(path))
        {
            if (line.Length == 0 || line[0] == '#') continue;
            var parts = line.Split('\t');
            if (parts.Length != 2) { problems.Add($"not two columns: {line}"); continue; }
            // A translation may leave out an English plural ending ("box{1}"), never invent a piece.
            var english = placeholder.Matches(parts[0]).Select(m => m.Value).ToHashSet(StringComparer.Ordinal);
            var portuguese = placeholder.Matches(parts[1]).Select(m => m.Value);
            if (!portuguese.All(english.Contains)) problems.Add($"unknown placeholder: {line}");
            if (seen.TryGetValue(parts[0], out var earlier) && earlier != parts[1]) problems.Add($"two translations: {parts[0]}");
            seen[parts[0]] = parts[1];
        }
        Assert.True(seen.Count > 1000, $"only {seen.Count} lines in {path}");
        Assert.Empty(problems);
        Assert.Equal("Configurações", Translator.Parse(File.ReadAllText(path)).Translate("Settings"));
    }

    [GeneratedRegex(@"\{(\d+)\}")]
    private static partial Regex PlaceholderRegex();

    private static string FindTable()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var path = Path.Combine(dir.FullName, "src", "PKForge.App", "Resources", "I18n", "pt-BR.tsv");
            if (File.Exists(path)) return path;
        }
        throw new FileNotFoundException("pt-BR.tsv not found above " + AppContext.BaseDirectory);
    }
}
