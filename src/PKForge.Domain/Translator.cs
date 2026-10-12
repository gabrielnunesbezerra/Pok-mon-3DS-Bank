using System.Collections.Concurrent;
using System.Text;
using System.Text.RegularExpressions;

namespace PKForge.Domain;

/// <summary>
/// Display-time translation from the app's English text, read from a table of
/// <c>English&lt;TAB&gt;Translation</c> lines. Exact lines are looked up directly; lines with
/// <c>{0}</c> placeholders become patterns, so "Box 3 slot 7 empty" finds "Box {0} slot {1} empty".
/// Text that matches nothing is tried line by line and then by " · " segments, and anything
/// still unknown is shown as it is. The English text keeps driving the app's logic: only what
/// reaches the screen changes.
/// </summary>
public sealed partial class Translator
{
    private const int CacheLimit = 6000;

    private readonly Dictionary<string, string> _exact = new(StringComparer.Ordinal);
    private readonly List<Pattern> _patterns = [];
    private readonly ConcurrentDictionary<string, string> _cache = new(StringComparer.Ordinal);

    // Loose: so little fixed text ("Box {0}", "{0} of {1}") that it only takes one-word pieces,
    // or "Ready to move" would come out half translated by "{0} to {1}".
    private sealed record Pattern(string Prefix, string Suffix, Regex Regex, int[] Ids, string Template, int Literal, bool Loose);

    /// <summary>How many lines the table holds.</summary>
    public int Count => _exact.Count + _patterns.Count;

    /// <summary>Reads a table. Lines starting with '#' and lines without a translation are skipped.</summary>
    public static Translator Parse(string table)
    {
        ArgumentNullException.ThrowIfNull(table);
        var translator = new Translator();
        foreach (var raw in table.Split('\n'))
        {
            var line = raw.TrimEnd('\r');
            if (line.Length == 0 || line[0] == '#') continue;
            var tab = line.IndexOf('\t');
            if (tab <= 0) continue;
            var english = Unescape(line[..tab]);
            var translated = Unescape(line[(tab + 1)..]);
            if (translated.Length == 0) continue;
            translator.Add(english, translated);
            // A line made of " · " segments also teaches each segment on its own, so a status
            // line assembled from pieces at run time still finds its parts.
            var enParts = english.Split(" · ");
            var ptParts = translated.Split(" · ");
            if (enParts.Length > 1 && enParts.Length == ptParts.Length)
                for (var i = 0; i < enParts.Length; i++)
                    translator.Add(enParts[i], ptParts[i], overwrite: false);
        }
        // The pattern with the most fixed text wins: "Box {0} is full." before "Box {0}".
        translator._patterns.Sort((a, b) => b.Literal.CompareTo(a.Literal));
        return translator;
    }

    private void Add(string english, string translated, bool overwrite = true)
    {
        var key = Normalize(english);
        var value = translated.Trim();
        if (key.Length == 0 || value.Length == 0) return;
        if (!Placeholder.IsMatch(key))
        {
            key = Unbrace(key);
            if (overwrite || !_exact.ContainsKey(key)) _exact[key] = Unbrace(value);
            return;
        }
        if (!overwrite && _patterns.Exists(p => p.Template == value)) return;
        var ids = new List<int>();
        var regex = new StringBuilder("^");
        var last = 0;
        foreach (Match match in Placeholder.Matches(key))
        {
            regex.Append(Regex.Escape(Unbrace(key[last..match.Index])));
            regex.Append("(.+?)");
            ids.Add(int.Parse(match.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture));
            last = match.Index + match.Length;
        }
        regex.Append(Regex.Escape(Unbrace(key[last..]))).Append('$');
        var first = Placeholder.Match(key);
        var lastMatch = Placeholder.Matches(key)[^1];
        var literal = Placeholder.Replace(key, "").Trim().Length;
        _patterns.Add(new Pattern(
            Unbrace(key[..first.Index]), Unbrace(key[(lastMatch.Index + lastMatch.Length)..]),
            new Regex(regex.ToString(), RegexOptions.Singleline | RegexOptions.CultureInvariant),
            [.. ids], value, literal, Loose: literal < 4));
    }

    private static readonly Regex Placeholder = PlaceholderRegex();

    [GeneratedRegex(@"\{(\d+)\}", RegexOptions.CultureInvariant)]
    private static partial Regex PlaceholderRegex();

    /// <summary>The translation of <paramref name="text"/>, or the text itself when the table has none.</summary>
    public string Translate(string? text)
    {
        if (string.IsNullOrEmpty(text)) return text ?? string.Empty;
        if (_cache.TryGetValue(text, out var cached)) return cached;
        var result = TranslateBlock(text);
        if (_cache.Count > CacheLimit) _cache.Clear();
        _cache[text] = result;
        return result;
    }

    private string TranslateBlock(string text)
    {
        if (TranslateOne(text, depth: 0) is { } whole) return whole;
        if (text.Contains('\n'))
        {
            var lines = text.Split('\n');
            var changed = false;
            for (var i = 0; i < lines.Length; i++)
            {
                var line = TranslateLine(lines[i]);
                changed |= !ReferenceEquals(line, lines[i]);
                lines[i] = line;
            }
            return changed ? string.Join('\n', lines) : text;
        }
        return TranslateLine(text);
    }

    private string TranslateLine(string line)
    {
        if (line.Trim().Length == 0) return line;
        if (TranslateOne(line, depth: 0) is { } whole) return whole;
        if (!line.Contains(" · ", StringComparison.Ordinal)) return line;
        var parts = line.Split(" · ");
        var changed = false;
        for (var i = 0; i < parts.Length; i++)
        {
            if (TranslateOne(parts[i], depth: 0) is not { } part) continue;
            parts[i] = part;
            changed = true;
        }
        return changed ? string.Join(" · ", parts) : line;
    }

    /// <summary>One piece of text, keeping its surrounding spaces; null when the table has nothing for it.</summary>
    private string? TranslateOne(string text, int depth)
    {
        var key = Normalize(text);
        if (key.Length == 0) return null;
        string? found = null;
        if (_exact.TryGetValue(key, out var exact))
        {
            found = exact;
        }
        else
        {
            foreach (var pattern in _patterns)
            {
                if (!key.StartsWith(pattern.Prefix, StringComparison.Ordinal) || !key.EndsWith(pattern.Suffix, StringComparison.Ordinal))
                    continue;
                var match = pattern.Regex.Match(key);
                if (!match.Success) continue;
                if (pattern.Loose && Enumerable.Range(1, pattern.Ids.Length).Any(g => match.Groups[g].Value.Contains(' ', StringComparison.Ordinal)))
                    continue;
                var values = new Dictionary<int, string>();
                for (var i = 0; i < pattern.Ids.Length; i++)
                {
                    var value = match.Groups[i + 1].Value;
                    // A filled-in piece is itself translated when it is a known phrase (a reason, a place).
                    if (depth < 2 && TranslateOne(value, depth + 1) is { } inner) value = inner;
                    values.TryAdd(pattern.Ids[i], value);
                }
                found = Unbrace(Placeholder.Replace(pattern.Template, m =>
                    values.TryGetValue(int.Parse(m.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture), out var v) ? v : m.Value));
                break;
            }
        }
        if (found is null) return null;
        var lead = text[..(text.Length - text.TrimStart().Length)];
        var trail = text[text.TrimEnd().Length..];
        var startsWithDot = text.TrimStart().StartsWith("· ", StringComparison.Ordinal);
        return lead + (startsWithDot ? "· " : "") + found + trail;
    }

    /// <summary>Trims spaces and a leading " · " joiner, so fragments glued onto other text match.</summary>
    private static string Normalize(string text)
    {
        var key = text.Trim();
        if (key.StartsWith("· ", StringComparison.Ordinal)) key = key[2..].TrimStart();
        return key;
    }

    private static string Unbrace(string text) => text.Replace("{{", "{", StringComparison.Ordinal).Replace("}}", "}", StringComparison.Ordinal);

    private static string Unescape(string text)
    {
        if (!text.Contains('\\')) return text;
        var sb = new StringBuilder(text.Length);
        for (var i = 0; i < text.Length; i++)
        {
            if (text[i] == '\\' && i + 1 < text.Length)
            {
                var next = text[i + 1];
                sb.Append(next switch { 'n' => '\n', 't' => '\t', '\\' => '\\', _ => next });
                i++;
            }
            else
            {
                sb.Append(text[i]);
            }
        }
        return sb.ToString();
    }
}
