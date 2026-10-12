using System.Text.Json;

namespace PKForge.Infrastructure;

/// <summary>
/// Small JSON files kept beside the Bank's index (the Storage, the online-trade ledger). They
/// live in the Bank folder, so the account sync carries them with the Pokémon. Written
/// atomically; a file that cannot be read is set aside as <c>.bad</c> rather than silently
/// overwritten, and reads as a fresh value.
/// </summary>
public static class BankSideFiles
{
    private static readonly JsonSerializerOptions Options = new() { WriteIndented = false };

    public static T Load<T>(string bankRoot, string fileName) where T : class, new()
    {
        var path = Path.Combine(bankRoot, fileName);
        try
        {
            if (!File.Exists(path)) return new T();
            return JsonSerializer.Deserialize<T>(File.ReadAllText(path), Options) ?? new T();
        }
        catch (JsonException)
        {
            try { File.Copy(path, path + ".bad", overwrite: true); }
            catch (IOException) { /* keeping the copy is best effort */ }
            return new T();
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            throw new IOException($"{fileName} could not be read: {error.Message}", error);
        }
    }

    public static void Save<T>(string bankRoot, string fileName, T value)
    {
        Directory.CreateDirectory(bankRoot);
        var path = Path.Combine(bankRoot, fileName);
        var tmp = path + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(value, Options));
        File.Move(tmp, path, overwrite: true);
    }
}
