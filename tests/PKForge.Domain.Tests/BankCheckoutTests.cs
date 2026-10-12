using PKForge.Domain;
using PKForge.Infrastructure;
using Xunit;

namespace PKForge.Domain.Tests;

/// <summary>3DS Bank's move-out export, bring-back import and the account sync snapshot.</summary>
public sealed class BankCheckoutTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "3dsbank-tests", Guid.NewGuid().ToString("N"));

    private static BankEntryInfo Info(int species, string nickname) => new(species, 0, false, nickname, 50, 7, "Moon", "PK7");

    private static BankEntryInfo? Describe(byte[] bytes, string name) => bytes.Length == 0 ? null : Info(bytes[0], name);

    private sealed class MemoryFolder : IFolderFileAccess
    {
        private readonly List<(string Id, string Name, byte[] Bytes)> _files = [];

        public IReadOnlyList<string> Names => _files.Select(f => f.Name).ToArray();

        public void Add(string name, byte[] bytes) => _files.Add(($"mem://{_files.Count}", name, bytes));

        public ValueTask<IReadOnlyList<PickedDocument>> ListFilesAsync(string treeId, CancellationToken cancellationToken = default)
        {
            IReadOnlyList<PickedDocument> documents = _files.Select(f => new PickedDocument(f.Id, f.Name)).ToArray();
            return ValueTask.FromResult(documents);
        }

        public ValueTask<ReadOnlyMemory<byte>> ReadFileAsync(string documentId, CancellationToken cancellationToken = default) =>
            ValueTask.FromResult<ReadOnlyMemory<byte>>(_files.First(f => f.Id == documentId).Bytes);

        public ValueTask WriteFileAsync(string treeId, string fileName, ReadOnlyMemory<byte> bytes, CancellationToken cancellationToken = default)
        {
            var existing = _files.FindIndex(f => f.Name == fileName);
            if (existing >= 0) _files[existing] = (_files[existing].Id, fileName, bytes.ToArray());
            else _files.Add(($"mem://{_files.Count}", fileName, bytes.ToArray()));
            return ValueTask.CompletedTask;
        }
    }

    [Fact]
    public async Task ExportMovesOutAndImportBringsBackOnce()
    {
        var bank = new FileBankService(_root);
        var outbox = new BankOutbox(_root);
        var pikachu = bank.Add([25, 1, 2], Info(25, "Pika"));
        bank.Add([133, 1, 2], Info(133, "Eevee"));
        var folder = new MemoryFolder();

        Assert.Equal(1, await BankCheckout.CheckOutAsync(bank, outbox, folder, "tree", [pikachu]));
        Assert.DoesNotContain(bank.GetAll(), e => e.Id == pikachu.Id);
        Assert.Equal(1, outbox.Count);

        var first = await BankCheckout.CheckInAsync(bank, outbox, Describe, folder, "tree");
        Assert.Equal(1, first.Imported);
        Assert.Equal(2, bank.GetAll().Count);
        Assert.Equal(0, outbox.Count);

        // The same file again: it is in the Bank already.
        var again = await BankCheckout.CheckInAsync(bank, outbox, Describe, folder, "tree");
        Assert.Equal(0, again.Imported);
        Assert.Equal(1, again.AlreadyInBank);
    }

    [Fact]
    public async Task ImportRefusesFilesThatNeverLeftAndCopiesOfReturnedOnes()
    {
        var bank = new FileBankService(_root);
        var outbox = new BankOutbox(_root);
        var mew = bank.Add([151, 9], Info(151, "Mew"));
        var folder = new MemoryFolder();
        folder.Add("foreign.pk7", [150, 1]);
        await BankCheckout.CheckOutAsync(bank, outbox, folder, "tree", [mew]);
        var exported = folder.Names.First(n => n.EndsWith(".pk7", StringComparison.Ordinal) && n != "foreign.pk7");
        var copy = new MemoryFolder();
        copy.Add("copy.pk7", [151, 9]);

        var result = await BankCheckout.CheckInAsync(bank, outbox, Describe, folder, "tree");
        Assert.Equal(1, result.Imported);
        Assert.Equal(1, result.NotFromThisBank);
        Assert.NotNull(exported);

        // Mew leaves the Bank another way (sent to a game): its old file cannot bring a second one.
        bank.RemoveMany([.. bank.GetAll().Select(e => e.Id)]);
        var duplicate = await BankCheckout.CheckInAsync(bank, outbox, Describe, copy, "tree");
        Assert.Equal(0, duplicate.Imported);
        Assert.Equal(1, duplicate.NotFromThisBank);
        Assert.Empty(bank.GetAll());
    }

    [Fact]
    public void SnapshotIsDeterministicAndRestoresTheBank()
    {
        var bank = new ReloadableBankService(_root);
        bank.Add([1, 2, 3], Info(1, "Bulba"));
        bank.Add([4, 5, 6], Info(4, "Char"));
        var first = bank.Snapshot();
        Assert.Equal(BankSnapshot.Fingerprint(first), BankSnapshot.Fingerprint(bank.Snapshot()));

        var changes = 0;
        bank.Changed += () => changes++;
        bank.Clear();
        Assert.Empty(bank.GetAll());
        bank.ReplaceContents(first);

        var restored = bank.GetAll();
        Assert.Equal(2, restored.Count);
        Assert.Equal(new byte[] { 1, 2, 3 }, bank.GetData(restored.Single(e => e.Info.Species == 1).Id));
        Assert.Equal(BankSnapshot.Fingerprint(first), BankSnapshot.Fingerprint(bank.Snapshot()));

        bank.Add([7, 8, 9], Info(7, "Squirt"));
        Assert.Equal(1, changes);
        Assert.NotEqual(BankSnapshot.Fingerprint(first), BankSnapshot.Fingerprint(bank.Snapshot()));
    }

    public void Dispose()
    {
        try
        {
            if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
        }
        catch (IOException)
        {
            // Temp leftovers are harmless.
        }
    }
}
