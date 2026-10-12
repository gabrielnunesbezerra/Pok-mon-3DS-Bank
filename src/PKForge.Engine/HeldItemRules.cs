using System.Collections.Concurrent;
using PKHeX.Core;

namespace PKForge.Engine;

/// <summary>
/// Held items across generations, the way 3DS Bank's Storage keeps them: every item by its
/// national id (the Generation 4+ item index, shared by Generations 4 to 7), turned into a
/// game's own index only when it goes onto a Pokémon of that generation or into that game.
/// Generation 1 items have no national equivalent; Let's Go Pikachu and Eevee use national ids
/// in their bag, but their Pokémon cannot hold anything.
/// </summary>
public static class HeldItemRules
{
    /// <summary>The Generation 2-3 tables' "no equivalent" index.</summary>
    private const int NoEquivalent = 128;

    private static readonly ConcurrentDictionary<EntityContext, ushort[]> HeldByContext = new();

    /// <summary>The national id of a game-native item index; 0 when the item has no equivalent.</summary>
    public static int ToNational(int item, EntityContext context)
    {
        if (item <= 0) return 0;
        int national = context switch
        {
            EntityContext.Gen1 => 0,
            EntityContext.Gen2 => item > byte.MaxValue ? 0 : ItemConverter.GetItemFuture2((byte)item),
            EntityContext.Gen3 => item > ushort.MaxValue ? 0 : ItemConverter.GetItemFuture3((ushort)item),
            _ => item,
        };
        return national == NoEquivalent ? 0 : national;
    }

    /// <summary>A national id as the game-native index of <paramref name="context"/>; 0 when that generation has no such item.</summary>
    public static int FromNational(int national, EntityContext context)
    {
        if (national <= 0 || national == NoEquivalent || national > ushort.MaxValue) return 0;
        return context switch
        {
            EntityContext.Gen1 => 0,
            EntityContext.Gen2 => ItemConverter.GetItemOld2((ushort)national),
            EntityContext.Gen3 => ItemConverter.GetItemOld3((ushort)national),
            _ => national,
        };
    }

    /// <summary>The national id of the item <paramref name="pk"/> holds (0 for none or one with no equivalent).</summary>
    public static int National(PKM pk)
    {
        ArgumentNullException.ThrowIfNull(pk);
        return pk.Format <= 1 ? 0 : ToNational(pk.HeldItem, pk.Context);
    }

    /// <summary>Whether a game holds this game-native item index at all.</summary>
    public static bool CanHoldIn(SaveFile game, int item)
    {
        ArgumentNullException.ThrowIfNull(game);
        if (item <= 0 || game.Generation <= 1 || game is SAV7b) return false;
        var allowed = game.HeldItems;
        return allowed.Length == 0 || allowed.Contains((ushort)item);
    }

    /// <summary>
    /// Why a Pokémon stored as <paramref name="pk"/> cannot hold the national item, or null when
    /// it can. Its generation decides: the newest games of that generation list what may be held.
    /// </summary>
    public static string? WhyCannotHold(PKM pk, int national)
    {
        ArgumentNullException.ThrowIfNull(pk);
        if (pk.Format <= 1) return "Pokémon from Generation 1 games cannot hold items.";
        if (pk is PB7) return "Pokémon from Let's Go Pikachu and Eevee cannot hold items.";
        if (pk.IsEgg) return "An egg cannot hold an item.";
        var native = FromNational(national, pk.Context);
        if (native <= 0) return $"This item does not exist in Generation {pk.Format} games.";
        var held = HeldItemsOf(pk.Context);
        if (held.Length > 0 && Array.IndexOf(held, (ushort)native) < 0)
            return $"Generation {pk.Format} games do not let a Pokémon hold this item.";
        return null;
    }

    /// <summary>
    /// After an import converted <paramref name="source"/> into <paramref name="landed"/> for
    /// <paramref name="target"/>: when the landed Pokémon cannot keep the item it held (the
    /// item did not exist yet, like Steelixite in Pokémon X), the item is taken off it and its
    /// national id returned, so the Storage can keep it. 0 when nothing is taken. An item
    /// with no national equivalent (Generation 3 mail) is lost the way the games lose it.
    /// </summary>
    public static int TakeUnusable(PKM source, PKM landed, SaveFile target)
    {
        ArgumentNullException.ThrowIfNull(source);
        ArgumentNullException.ThrowIfNull(landed);
        ArgumentNullException.ThrowIfNull(target);
        var national = National(source);
        if (national <= 0) return 0;
        if (landed.HeldItem != 0 && CanHoldIn(target, landed.HeldItem)) return 0;
        if (landed.HeldItem != 0)
        {
            landed.HeldItem = 0;
            landed.RefreshChecksum();
        }
        return national;
    }

    /// <summary>The newest game of each generation lists what its Pokémon may hold.</summary>
    private static ushort[] HeldItemsOf(EntityContext context) => HeldByContext.GetOrAdd(context, static ctx =>
    {
        var version = ctx switch
        {
            EntityContext.Gen2 => GameVersion.C,
            EntityContext.Gen3 => GameVersion.E,
            EntityContext.Gen4 => GameVersion.HG,
            EntityContext.Gen5 => GameVersion.B2,
            EntityContext.Gen6 => GameVersion.AS,
            EntityContext.Gen7 => GameVersion.US,
            _ => GameVersion.Any,
        };
        if (version == GameVersion.Any) return [];
        try
        {
            return BlankSaveFile.Get(version).HeldItems.ToArray();
        }
        catch (Exception)
        {
            return []; // no table: every item that exists in the generation is allowed
        }
    });
}
