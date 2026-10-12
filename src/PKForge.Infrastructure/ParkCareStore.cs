using System.Text.Json;

namespace PKForge.Infrastructure;

/// <summary>
/// The Poképark's care records, kept beside the bank index as <c>park-care.json</c> so they
/// travel with the Bank (and the account): when each Bank resident joined the park, which
/// wish it was last rewarded for, and which Pokémon already used their one nature change.
/// Residents are keyed by bank entry id; the nature ledger by the Pokémon's own identity, so
/// leaving the Bank and coming back does not grant a second change.
/// </summary>
public sealed class ParkCareStore(string bankRootDirectory)
{
    public const string FileName = "park-care.json";

    private static readonly Lock Gate = new();
    private string FilePath => Path.Combine(bankRootDirectory, FileName);

    private sealed class Model
    {
        public Dictionary<string, long> Joined { get; set; } = new();
        public Dictionary<string, long> Rewarded { get; set; } = new();
        public List<string> NatureChanged { get; set; } = new();
    }

    /// <summary>When the resident joined the park; recorded now when it was never seen.</summary>
    public DateTimeOffset JoinedOrNow(string residentId, DateTimeOffset now)
    {
        lock (Gate)
        {
            var model = Read();
            if (model.Joined.TryGetValue(residentId, out var joined))
                return DateTimeOffset.FromUnixTimeMilliseconds(joined);
            model.Joined[residentId] = now.ToUnixTimeMilliseconds();
            Write(model);
            return now;
        }
    }

    /// <summary>Starts the clock for new residents and forgets the ones that left the park.</summary>
    public void SyncResidents(IEnumerable<string> residentIds, DateTimeOffset now)
    {
        lock (Gate)
        {
            var model = Read();
            var current = residentIds.ToHashSet(StringComparer.Ordinal);
            var changed = false;
            foreach (var id in current.Where(id => !model.Joined.ContainsKey(id)))
            {
                model.Joined[id] = now.ToUnixTimeMilliseconds();
                changed = true;
            }
            foreach (var gone in model.Joined.Keys.Where(id => !current.Contains(id)).ToList())
            {
                model.Joined.Remove(gone);
                model.Rewarded.Remove(gone);
                changed = true;
            }
            if (changed) Write(model);
        }
    }

    /// <summary>True when the resident was already rewarded in this wish window.</summary>
    public bool WasRewarded(string residentId, long window)
    {
        lock (Gate) return Read().Rewarded.TryGetValue(residentId, out var last) && last == window;
    }

    public void MarkRewarded(string residentId, long window)
    {
        lock (Gate)
        {
            var model = Read();
            model.Rewarded[residentId] = window;
            Write(model);
        }
    }

    public bool NatureChanged(string identityKey)
    {
        lock (Gate) return Read().NatureChanged.Contains(identityKey);
    }

    public void MarkNatureChanged(string identityKey)
    {
        lock (Gate)
        {
            var model = Read();
            if (model.NatureChanged.Contains(identityKey)) return;
            model.NatureChanged.Add(identityKey);
            Write(model);
        }
    }

    private Model Read()
    {
        try
        {
            return File.Exists(FilePath)
                ? JsonSerializer.Deserialize<Model>(File.ReadAllText(FilePath)) ?? new Model()
                : new Model();
        }
        catch (JsonException)
        {
            return new Model();
        }
    }

    private void Write(Model model)
    {
        Directory.CreateDirectory(bankRootDirectory);
        var tmp = FilePath + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(model));
        File.Move(tmp, FilePath, overwrite: true);
    }
}
