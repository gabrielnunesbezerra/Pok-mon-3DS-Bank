using System.IO.Compression;
using System.Security.Cryptography;
using PKForge.Domain;

namespace PKForge.Infrastructure;

/// <summary>
/// The whole Bank folder (index, one .bin per Pokémon, box names, wallpapers, outbox) as one
/// zip, for the account sync. Packing is deterministic: the same files always give the same
/// bytes, so the fingerprint says whether anything changed since the last sync.
/// </summary>
public static class BankSnapshot
{
    private static readonly DateTimeOffset FixedTime = new(2020, 1, 1, 0, 0, 0, TimeSpan.Zero);

    public static byte[] Pack(string bankRoot)
    {
        using var memory = new MemoryStream();
        using (var zip = new ZipArchive(memory, ZipArchiveMode.Create, leaveOpen: true))
        {
            if (Directory.Exists(bankRoot))
            {
                foreach (var path in Directory.GetFiles(bankRoot).Order(StringComparer.Ordinal))
                {
                    var name = Path.GetFileName(path);
                    if (name.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase)) continue;
                    var entry = zip.CreateEntry(name, CompressionLevel.Optimal);
                    entry.LastWriteTime = FixedTime;
                    var bytes = File.ReadAllBytes(path);
                    using var output = entry.Open();
                    output.Write(bytes, 0, bytes.Length);
                }
            }
        }
        return memory.ToArray();
    }

    /// <summary>A short identity of a packed snapshot.</summary>
    public static string Fingerprint(byte[] snapshot) => Convert.ToHexString(SHA256.HashData(snapshot));

    /// <summary>
    /// Replaces the folder's contents with the snapshot's files. The new files are unpacked
    /// beside the folder first, so a broken snapshot never leaves a half-written Bank.
    /// </summary>
    public static void Restore(string bankRoot, byte[] snapshot)
    {
        var full = Path.GetFullPath(bankRoot);
        var parent = Path.GetDirectoryName(full) ?? throw new InvalidOperationException("The Bank folder has no parent folder.");
        var name = Path.GetFileName(full);
        var staging = Path.Combine(parent, name + ".incoming");
        var previous = Path.Combine(parent, name + ".previous");
        if (Directory.Exists(staging)) Directory.Delete(staging, recursive: true);
        Directory.CreateDirectory(staging);
        using (var memory = new MemoryStream(snapshot, writable: false))
        using (var zip = new ZipArchive(memory, ZipArchiveMode.Read))
        {
            foreach (var entry in zip.Entries)
            {
                // A flat folder only: no subfolders, no paths that could leave the Bank.
                var fileName = Path.GetFileName(entry.FullName);
                if (fileName.Length == 0 || fileName != entry.FullName) continue;
                using var input = entry.Open();
                using var output = File.Create(Path.Combine(staging, fileName));
                input.CopyTo(output);
            }
        }
        if (Directory.Exists(previous)) Directory.Delete(previous, recursive: true);
        if (Directory.Exists(full)) Directory.Move(full, previous);
        Directory.Move(staging, full);
        if (Directory.Exists(previous)) Directory.Delete(previous, recursive: true);
    }

    /// <summary>Empties the Bank folder (signing out of an account on this phone).</summary>
    public static void Clear(string bankRoot)
    {
        if (Directory.Exists(bankRoot)) Directory.Delete(bankRoot, recursive: true);
        Directory.CreateDirectory(bankRoot);
    }
}

/// <summary>
/// The app's Bank: the file store behind one lock, so the account sync can pack a consistent
/// snapshot or swap in the account's Bank while every screen keeps the same service instance.
/// <see cref="Changed"/> fires after every change, for the sync to upload.
/// </summary>
public sealed class ReloadableBankService : IBankService
{
    private readonly Lock _sync = new();
    private FileBankService _inner;

    public ReloadableBankService(string rootDirectory)
    {
        Root = rootDirectory;
        _inner = new FileBankService(rootDirectory);
    }

    /// <summary>The Bank folder.</summary>
    public string Root { get; }

    /// <summary>Raised after every change to the Bank (outside the lock).</summary>
    public event Action? Changed;

    private T Query<T>(Func<FileBankService, T> read)
    {
        lock (_sync) return read(_inner);
    }

    private T Mutate<T>(Func<FileBankService, T> write)
    {
        T result;
        lock (_sync) result = write(_inner);
        Changed?.Invoke();
        return result;
    }

    private void MutateVoid(Action<FileBankService> write)
    {
        lock (_sync) write(_inner);
        Changed?.Invoke();
    }

    public IReadOnlyList<BankEntry> GetAll() => Query(bank => bank.GetAll());
    public int BoxCount => Query(bank => bank.BoxCount);
    public BankEntry Add(byte[] data, BankEntryInfo info) => Mutate(bank => bank.Add(data, info));
    public IReadOnlyList<BankEntry> AddMany(IReadOnlyList<BankDeposit> deposits) => Mutate(bank => bank.AddMany(deposits));
    public byte[] GetData(Guid id) => Query(bank => bank.GetData(id));
    public void Move(Guid id, int box, int slot) => MutateVoid(bank => bank.Move(id, box, slot));
    public void Remove(Guid id) => MutateVoid(bank => bank.Remove(id));
    public int RemoveMany(IReadOnlyList<Guid> ids) => Mutate(bank => bank.RemoveMany(ids));
    public void Replace(Guid id, byte[] data, BankEntryInfo info) => MutateVoid(bank => bank.Replace(id, data, info));
    public void AddBox() => MutateVoid(bank => bank.AddBox());
    public void RemapBoxes(BankBoxRemap remap) => MutateVoid(bank => bank.RemapBoxes(remap));
    public int UpdateInfo(IReadOnlyList<(Guid Id, BankEntryInfo Info)> updates) => Mutate(bank => bank.UpdateInfo(updates));
    public int MigrationVersion => Query(bank => bank.MigrationVersion);
    public int CompleteMigration(int version, IReadOnlyList<(Guid Id, BankEntryInfo Expected, BankEntryInfo Info)> updates) =>
        Mutate(bank => bank.CompleteMigration(version, updates));
    public int Place(IReadOnlyList<(Guid Id, int Box, int Slot)> placements) => Mutate(bank => bank.Place(placements));

    /// <summary>The Bank folder packed while no change can run.</summary>
    public byte[] Snapshot()
    {
        lock (_sync) return BankSnapshot.Pack(Root);
    }

    /// <summary>Swaps in another Bank (an account's) and reloads it.</summary>
    public void ReplaceContents(byte[] snapshot)
    {
        lock (_sync)
        {
            BankSnapshot.Restore(Root, snapshot);
            _inner = new FileBankService(Root);
        }
    }

    /// <summary>Empties the Bank on this phone.</summary>
    public void Clear()
    {
        lock (_sync)
        {
            BankSnapshot.Clear(Root);
            _inner = new FileBankService(Root);
        }
    }
}
