using PKForge.Domain;

namespace PKForge.Engine;

/// <summary>One stack of a game's bag that can move to the Storage: its pouch, the game's own
/// item index, the national id the Storage keeps it by, and how many there are.</summary>
public sealed record BagStack(string Pouch, int NativeId, int NationalId, int Count);

/// <summary>
/// Moving items between a game's bag and the Bank's Storage. Key items and TMs/HMs never
/// move (the game needs them where they are), and neither does anything Generation 1 holds:
/// its items have no national equivalent. The caller opens the policy door
/// (<see cref="ThreeDsBankPolicy.Allow"/> with <see cref="BankFeature.BagItems"/>) and writes the save.
/// </summary>
public static class StorageBag
{
    private static readonly HashSet<string> Fixed = new(StringComparer.Ordinal) { "KeyItems", "TMHMs" };

    /// <summary>Every stack in the game's bag that can go to the Storage.</summary>
    public static IReadOnlyList<BagStack> Movable(ISaveEngineSession session)
    {
        ArgumentNullException.ThrowIfNull(session);
        if (session is not SaveEngineSession engine) return [];
        var context = engine.SaveFile.Context;
        return session.GetBag()
            .Where(pouch => !Fixed.Contains(pouch.Name))
            .SelectMany(pouch => pouch.Items.Select(item =>
                new BagStack(pouch.Name, item.Id, HeldItemRules.ToNational(item.Id, context), item.Count)))
            .Where(stack => stack.NationalId > 0 && stack.Count > 0)
            .ToList();
    }

    /// <summary>Takes up to <paramref name="count"/> of a stack out of the bag; returns how many came out.</summary>
    public static int TakeOut(ISaveEngineSession session, string pouch, int nativeId, int count)
    {
        ArgumentNullException.ThrowIfNull(session);
        if (count <= 0 || Fixed.Contains(pouch)) return 0;
        var have = CountIn(session, pouch, nativeId);
        var take = Math.Min(have, count);
        if (take <= 0) return 0;
        var left = session.SetItemCount(pouch, nativeId, have - take);
        return Math.Max(0, have - left);
    }

    /// <summary>
    /// Puts up to <paramref name="count"/> of a national item into the pouch of the game that
    /// takes it; returns how many fit (0 with a reason when none did).
    /// </summary>
    public static int PutIn(ISaveEngineSession session, int national, int count, out string? refusal)
    {
        ArgumentNullException.ThrowIfNull(session);
        refusal = null;
        if (count <= 0) return 0;
        if (session is not SaveEngineSession engine)
        {
            refusal = "This game's bag cannot be reached.";
            return 0;
        }
        var native = HeldItemRules.FromNational(national, engine.SaveFile.Context);
        if (native <= 0)
        {
            refusal = "This item does not exist in that game.";
            return 0;
        }
        var fits = false;
        foreach (var pouch in session.GetBag().Select(p => p.Name).Where(name => !Fixed.Contains(name)))
        {
            if (!session.GetPouchLegalItems(pouch).Contains(native)) continue;
            fits = true;
            var have = CountIn(session, pouch, native);
            int now;
            try { now = session.SetItemCount(pouch, native, have + count); }
            catch (InvalidOperationException) { continue; } // that pouch is full
            var added = now - have;
            if (added > 0) return added;
        }
        refusal = fits ? "That game's bag has no room for it." : "This item cannot go in that game's bag.";
        return 0;
    }

    private static int CountIn(ISaveEngineSession session, string pouch, int nativeId) =>
        session.GetBag().FirstOrDefault(p => p.Name == pouch)?.Items.FirstOrDefault(i => i.Id == nativeId)?.Count ?? 0;
}
