using System.Security.Cryptography;
using System.Text;

namespace PKForge.Domain;

/// <summary>What a Poképark resident is asking for right now.</summary>
public enum ParkWish
{
    Snack,
    Play,
}

/// <summary>
/// The Poképark's care rules, kept free of UI and engine so they can be tested: each Bank
/// resident wants either a berry or a game, and the wish changes every half hour. Giving it
/// what it wants once per wish raises its friendship; after three hours in the park it may
/// change its nature, once in its life.
/// </summary>
public static class ParkCareRules
{
    /// <summary>How long one wish lasts (and how often friendship can be earned).</summary>
    public static readonly TimeSpan WishLength = TimeSpan.FromMinutes(30);

    /// <summary>How long a resident must live in the park before its nature can change.</summary>
    public static readonly TimeSpan NatureStay = TimeSpan.FromHours(3);

    /// <summary>Friendship gained when its wish is granted.</summary>
    public const int FriendshipPerCare = 10;

    public const int MaxFriendship = 255;

    /// <summary>The wish period a moment falls in.</summary>
    public static long WishWindow(DateTimeOffset now) =>
        now.ToUnixTimeSeconds() / (long)WishLength.TotalSeconds;

    /// <summary>When the current wish ends.</summary>
    public static DateTimeOffset WishEnds(DateTimeOffset now) =>
        DateTimeOffset.FromUnixTimeSeconds((WishWindow(now) + 1) * (long)WishLength.TotalSeconds);

    /// <summary>The same resident always wants the same thing within one window, on every phone.</summary>
    public static ParkWish WishOf(string residentId, long window)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes($"{residentId}|{window}"));
        return (hash[0] & 1) == 0 ? ParkWish.Snack : ParkWish.Play;
    }

    /// <summary>The care action that grants a wish ("snack" or "play").</summary>
    public static string ActionFor(ParkWish wish) => wish == ParkWish.Snack ? "snack" : "play";

    /// <summary>Time left before the nature can change; zero when it can.</summary>
    public static TimeSpan NatureWait(DateTimeOffset joinedUtc, DateTimeOffset now)
    {
        var left = joinedUtc + NatureStay - now;
        return left > TimeSpan.Zero ? left : TimeSpan.Zero;
    }

    /// <summary>Friendship after one granted wish, capped at the games' maximum.</summary>
    public static int Befriend(int friendship) => Math.Min(MaxFriendship, Math.Max(0, friendship) + FriendshipPerCare);
}
