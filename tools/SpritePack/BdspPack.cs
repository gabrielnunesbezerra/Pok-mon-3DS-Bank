using System.IO.Compression;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json.Serialization;
using PKForge.Domain;

/// <summary>
/// Builds the BDSP-style icon add-on: Team Luminescent's bdsp-shiny-icons (MIT) at a pinned
/// commit, normal icons (reference_textures/*/icon/) and shiny ones (shiny_icons/), each
/// re-encoded as lossless WebP under PKForge's cache name (see <see cref="BdspIcons"/>).
/// A separate archive from the main pack, so players who already have the pack only fetch
/// this, and neither ever has to be downloaded again for the other to change.
/// </summary>
internal static class BdspPack
{
    private const string Repository = "BlupBlurp/bdsp-shiny-icons";

    /// <summary>The upstream commit the add-on is built from: a rebuild is byte-identical.</summary>
    private const string Commit = "3c888d6876ba1dce716699e6b17ffd8615f48083";

    private sealed record Tree([property: JsonPropertyName("tree")] List<TreeEntry> Entries, [property: JsonPropertyName("truncated")] bool Truncated);

    private sealed record TreeEntry([property: JsonPropertyName("path")] string Path, [property: JsonPropertyName("type")] string Type);

    public static async Task<int> BuildAsync(string output)
    {
        Directory.CreateDirectory(output);
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
        http.DefaultRequestHeaders.UserAgent.ParseAdd("PKForge-SpritePack");

        var tree = await http.GetFromJsonAsync<Tree>($"https://api.github.com/repos/{Repository}/git/trees/{Commit}?recursive=1")
            ?? throw new InvalidOperationException("The upstream file list could not be read.");
        if (tree.Truncated) throw new InvalidOperationException("The upstream file list is truncated.");

        // Normal icons live next to each model's textures, shiny ones in their own tree.
        var files = new Dictionary<string, string>(StringComparer.Ordinal); // cache path -> upstream path
        foreach (var entry in tree.Entries.Where(e => e.Type == "blob" && e.Path.EndsWith(".png", StringComparison.Ordinal)))
        {
            var normal = entry.Path.StartsWith("reference_textures/", StringComparison.Ordinal) && entry.Path.Contains("/icon/", StringComparison.Ordinal);
            var shiny = entry.Path.StartsWith("shiny_icons/", StringComparison.Ordinal);
            if (!normal && !shiny) continue;
            if (BdspIcons.Parse(Path.GetFileName(entry.Path)) is not { } icon || icon.Shiny != shiny) continue;
            files.TryAdd(icon.CachePath, entry.Path); // upstream repeats a few icons across folders
        }
        Console.WriteLine($"{files.Count} BDSP icons at {Repository}@{Commit[..7]}");

        var archive = Path.Combine(output, "pkforge-bdsp-icons.zip");
        var temporary = archive + ".tmp";
        File.Delete(temporary);
        var done = 0;
        using (var zip = ZipFile.Open(temporary, ZipArchiveMode.Create))
        {
            foreach (var (cachePath, upstream) in files.OrderBy(f => f.Key, StringComparer.Ordinal))
            {
                if (!SpritePack.IsSafeEntryName(cachePath)) throw new InvalidOperationException($"Unsafe pack name: {cachePath}");
                var url = $"https://raw.githubusercontent.com/{Repository}/{Commit}/{string.Join('/', upstream.Split('/').Select(Uri.EscapeDataString))}";
                var png = await FetchAsync(http, url);
                var item = zip.CreateEntry(cachePath, CompressionLevel.NoCompression);
                item.LastWriteTime = new DateTimeOffset(2020, 1, 1, 0, 0, 0, TimeSpan.Zero);
                await using var target = item.Open();
                await target.WriteAsync(Images.LosslessWebp(png, upstream));
                if (++done % 250 == 0) Console.WriteLine($"  {done} / {files.Count}");
            }
        }
        File.Move(temporary, archive, overwrite: true);

        await using var stream = File.OpenRead(archive);
        var hash = Convert.ToHexStringLower(await SHA256.HashDataAsync(stream));
        Console.WriteLine($"archive: {archive}");
        Console.WriteLine($"entries: {done}");
        Console.WriteLine($"bytes:   {stream.Length}");
        Console.WriteLine($"sha256:  {hash}");
        return 0;
    }

    // A few thousand requests in a row: a dropped connection is retried rather than fatal.
    private static async Task<byte[]> FetchAsync(HttpClient http, string url)
    {
        for (var attempt = 1; ; attempt++)
        {
            try { return await http.GetByteArrayAsync(url); }
            catch (Exception error) when (error is HttpRequestException or TaskCanceledException && attempt < 5)
            {
                await Task.Delay(TimeSpan.FromSeconds(attempt * 2));
            }
        }
    }
}
