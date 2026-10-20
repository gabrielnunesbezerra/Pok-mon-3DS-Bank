using System.Text;
using PKForge.Infrastructure;
using Xunit;

namespace PKForge.Domain.Tests;

/// <summary>
/// 3DS Bank 2.5 against the Firebase Realtime Database emulator with the real rules
/// (firebase/database.rules.json). Runs only when FIREBASE_DATABASE_EMULATOR names the
/// emulator (e.g. localhost:9000) with those rules loaded; otherwise each test returns at once.
/// </summary>
public sealed class CloudEmulatorTests
{
    private static readonly string? Host = Environment.GetEnvironmentVariable("FIREBASE_DATABASE_EMULATOR");

    private static string Token(string uid, string email)
    {
        static string Encode(string text) => Convert.ToBase64String(Encoding.UTF8.GetBytes(text)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return $"{Encode("{\"alg\":\"none\",\"typ\":\"JWT\"}")}.{Encode($"{{\"sub\":\"{uid}\",\"user_id\":\"{uid}\",\"email\":\"{email}\",\"iat\":1,\"exp\":9999999999}}")}.";
    }

    private static CloudSession Session(string uid, string email, string name) =>
        new(uid, name, Token(uid, email), "refresh", DateTimeOffset.UtcNow.AddHours(1));

    private static CloudAccountClient Client() => new(new CloudConfig("emulator", $"http://{Host}"), new HttpClient());

    [Fact]
    public async Task AStaleUploadIsAConflictAndTheAdminCanCleanABank()
    {
        if (Host is null) return;
        var client = Client();
        var uid = "p" + Guid.NewGuid().ToString("N")[..10];
        var player = Session(uid, $"{uid}@gmail.com", uid);
        var admin = Session("admin" + uid, CloudAccountClient.AdminEmail, CloudAccountClient.AdminUsername);
        Assert.True(admin.IsAdmin);

        await client.PutBankAsync(player, new CloudBank(100, [1]), null);
        await client.PutBankAsync(player, new CloudBank(200, [2]), 100);
        var conflict = await Assert.ThrowsAsync<CloudBankConflictException>(() => client.PutBankAsync(player, new CloudBank(300, [3]), 100));
        Assert.Equal(200, conflict.Online);

        // Another player can neither read nor write it; the admin can do both.
        var other = Session("o" + uid, "other@gmail.com", "other");
        await Assert.ThrowsAnyAsync<CloudAccountException>(() => client.GetBankOfAsync(other, uid));
        var seen = await client.GetBankOfAsync(admin, uid);
        Assert.Equal(200, seen!.Revision);
        await client.PutBankOfAsync(admin, uid, new CloudBank(400, [4]), 200);

        // The player's phone, still on 200, cannot put the old Bank back.
        await Assert.ThrowsAsync<CloudBankConflictException>(() => client.PutBankAsync(player, new CloudBank(500, [2]), 200));
        Assert.Equal([4], (await client.GetBankAsync(player))!.Snapshot);
        await client.PutBankAsync(player, new CloudBank(500, [5]), 400);
    }

    [Fact]
    public async Task AVisitGoesToTheAdminAndComesBack()
    {
        if (Host is null) return;
        var account = Client();
        var events = new CloudEventsClient(account);
        var uid = "v" + Guid.NewGuid().ToString("N")[..10];
        var player = Session(uid, $"{uid}@gmail.com", uid);
        var admin = Session("admin" + uid, CloudAccountClient.AdminEmail, CloudAccountClient.AdminUsername);
        var visit = ParkVisit.From("visit1", uid, uid, [7, 7, 7], new BankEntryInfo(25, 0, true, "Pika", 30, 7, "Test", "PK7"), 1);

        await events.SendVisitAsync(player, visit);
        await Assert.ThrowsAnyAsync<CloudAccountException>(() => events.SendVisitAsync(player, visit with { Data = "AAAA" }));
        Assert.Contains(await events.GetAllVisitsAsync(admin), v => v.Id == "visit1" && v.OwnerUid == uid);
        await Assert.ThrowsAnyAsync<CloudAccountException>(() => events.GetAllVisitsAsync(player));
        await events.SaveVisitAsync(admin, visit with { State = ParkVisitState.Caring });
        await Assert.ThrowsAnyAsync<CloudAccountException>(() => events.RemoveVisitAsync(player, uid, "visit1"));
        await events.SaveVisitAsync(admin, visit with { State = ParkVisitState.Returned, Data = Convert.ToBase64String([8, 8]) });
        var mine = await events.GetMyVisitsAsync(player);
        Assert.Equal([8, 8], Assert.Single(mine).Bytes);
        await events.RemoveVisitAsync(player, uid, "visit1");
        Assert.Empty(await events.GetMyVisitsAsync(player));
    }

    [Fact]
    public async Task OnlyTheAdminPublishesTheArena()
    {
        if (Host is null) return;
        var account = Client();
        var events = new CloudEventsClient(account);
        var uid = "a" + Guid.NewGuid().ToString("N")[..10];
        var player = Session(uid, $"{uid}@gmail.com", uid);
        var admin = Session("admin" + uid, CloudAccountClient.AdminEmail, CloudAccountClient.AdminUsername);
        var mon = ArenaMon.From([1], new BankEntryInfo(6, 0, false, "Zard", 50, 7, "Test", "PK7"));
        var arena = new ArenaEvent("ev" + uid, "Cup", "", true, 0, "adminbielz", mon, [mon], [], true);
        await Assert.ThrowsAnyAsync<CloudAccountException>(() => events.SaveEventAsync(player, arena));
        await events.SaveEventAsync(admin, arena);
        var read = await events.GetEventAsync(player);
        Assert.NotNull(read);
        Assert.Empty(read.Rewards); // no prizes come back as a missing list, read as empty
        Assert.Equal("", read.Description);
        await events.SaveResultAsync(player, arena.Id, new ArenaResult(uid, uid, 1, 0, 87, 1, false));
        Assert.Equal(87, Assert.Single(await events.GetResultsAsync(player, arena.Id)).BestDamage);
    }
}
