using System.Security.Cryptography;
using System.Text.Json;
using PKForge.Domain;

namespace PKForge.Infrastructure;

/// <summary>What bringing files back into the Bank did, file by file.</summary>
/// <param name="Imported">Pokémon that came back into the Bank.</param>
/// <param name="NotFromThisBank">Files that never left this Bank, or already came back once.</param>
/// <param name="AlreadyInBank">Files whose Pokémon is in the Bank right now.</param>
/// <param name="Unreadable">Files that are not a Pokémon this app can read.</param>
public sealed record BankCheckinResult(int Imported, int NotFromThisBank, int AlreadyInBank, int Unreadable);

/// <summary>
/// The list of Pokémon that left the Bank as .pk files and may come back, kept beside the bank
/// index as <c>outbox.json</c> (SHA-256 of each file's bytes). It lives in the bank folder, so it
/// travels with the Bank wherever the Bank goes (the account sync included).
/// </summary>
public sealed class BankOutbox(string bankRootDirectory)
{
    public const string FileName = "outbox.json";

    private readonly Lock _gate = new();
    private string FilePath => Path.Combine(bankRootDirectory, FileName);

    public bool Contains(string sha256)
    {
        lock (_gate) return Read().Contains(sha256);
    }

    public int Count
    {
        get { lock (_gate) return Read().Count; }
    }

    public void AddRange(IEnumerable<string> hashes)
    {
        lock (_gate)
        {
            var set = Read();
            foreach (var hash in hashes) set.Add(hash);
            Write(set);
        }
    }

    public void RemoveRange(IEnumerable<string> hashes)
    {
        lock (_gate)
        {
            var set = Read();
            foreach (var hash in hashes) set.Remove(hash);
            Write(set);
        }
    }

    private HashSet<string> Read()
    {
        if (!File.Exists(FilePath)) return new HashSet<string>(StringComparer.Ordinal);
        var list = JsonSerializer.Deserialize<List<string>>(File.ReadAllText(FilePath)) ?? [];
        return new HashSet<string>(list, StringComparer.Ordinal);
    }

    private void Write(HashSet<string> set)
    {
        Directory.CreateDirectory(bankRootDirectory);
        var tmp = FilePath + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(set.Order(StringComparer.Ordinal).ToList()));
        File.Move(tmp, FilePath, overwrite: true);
    }
}

/// <summary>
/// 3DS Bank's export and import: exporting MOVES Pokémon out of the Bank into .pk files, and
/// importing brings exactly those files back, once each. A file that never left this Bank (or
/// already came back) is refused, so a Pokémon can never exist twice through files.
/// </summary>
public static class BankCheckout
{
    /// <summary>
    /// Writes the entries as .pk files (plus the archive manifest) into the folder, records them
    /// as checked out, and only then removes them from the Bank. If writing fails, nothing leaves.
    /// </summary>
    public static async Task<int> CheckOutAsync(
        IBankService bank, BankOutbox outbox, IFolderFileAccess files, string treeId,
        IReadOnlyList<BankEntry> entries, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(bank);
        ArgumentNullException.ThrowIfNull(outbox);
        if (entries.Count == 0) return 0;
        var hashes = entries.Select(entry => Sha256Hex(bank.GetData(entry.Id))).ToList();
        await BankArchive.ExportAsync(bank, files, treeId, entries, cancellationToken).ConfigureAwait(false);
        outbox.AddRange(hashes);
        bank.RemoveMany([.. entries.Select(entry => entry.Id)]);
        return entries.Count;
    }

    /// <summary>
    /// Reads every .pk file in the folder and brings back the ones that left this Bank and have
    /// not come back yet, in one Bank write; each one returned is crossed off the outbox.
    /// </summary>
    public static async Task<BankCheckinResult> CheckInAsync(
        IBankService bank, BankOutbox outbox, Func<byte[], string, BankEntryInfo?> describe,
        IFolderFileAccess files, string treeId, Action<int, int>? progress = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(bank);
        ArgumentNullException.ThrowIfNull(outbox);
        ArgumentNullException.ThrowIfNull(describe);
        var candidates = (await files.ListFilesAsync(treeId, cancellationToken).ConfigureAwait(false))
            .Where(f => BankArchive.IsPkFileName(f.DisplayName))
            .ToArray();
        var inBank = new HashSet<string>(StringComparer.Ordinal);
        foreach (var entry in bank.GetAll())
        {
            cancellationToken.ThrowIfCancellationRequested();
            inBank.Add(Sha256Hex(bank.GetData(entry.Id)));
        }

        var deposits = new List<BankDeposit>();
        var returning = new List<string>();
        int notFromHere = 0, alreadyIn = 0, unreadable = 0;
        for (var i = 0; i < candidates.Length; i++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            progress?.Invoke(i, candidates.Length);
            var bytes = (await files.ReadFileAsync(candidates[i].DocumentId, cancellationToken).ConfigureAwait(false)).ToArray();
            var hash = Sha256Hex(bytes);
            if (inBank.Contains(hash))
            {
                alreadyIn++;
                continue;
            }
            if (!outbox.Contains(hash) || returning.Contains(hash))
            {
                notFromHere++;
                continue;
            }
            if (describe(bytes, candidates[i].DisplayName) is not { } info)
            {
                unreadable++;
                continue;
            }
            deposits.Add(new BankDeposit(bytes, info));
            returning.Add(hash);
        }
        progress?.Invoke(candidates.Length, candidates.Length);
        if (deposits.Count > 0)
        {
            // The Bank takes them first: if this fails they are still checked out and can be retried.
            bank.AddMany(deposits);
            outbox.RemoveRange(returning);
        }
        return new BankCheckinResult(deposits.Count, notFromHere, alreadyIn, unreadable);
    }

    public static string Sha256Hex(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes));
}
