using PKForge.Domain;
using PKHeX.Core;

namespace PKForge.Engine;

/// <summary>A Bank Pokémon's bytes after a change, in the format they are stored in.</summary>
public sealed record BankMonChange(byte[] Data, string Format);

/// <summary>What the Shooting Star did: the shiny bytes, and whether a legality checker
/// accepted the Pokémon before and still accepts it now.</summary>
public sealed record ShinyChange(byte[] Data, string Format, bool WasLegal, bool IsLegal);

/// <summary>A trade evolution as the receiving game performs it: the evolved bytes, the new
/// species and form, and the game's own words for it.</summary>
public sealed record TradeEvolution(byte[] Data, string Format, int Species, int Form, string Message);

/// <summary>
/// The changes 3DS Bank 2.0 makes to a Pokémon kept in the Bank, each in the Pokémon's own
/// stored format: giving or taking a held item (the Storage), the Shooting Star (shiny) and
/// the evolution an online trade causes. The callers open the policy door
/// (<see cref="ThreeDsBankPolicy.Allow"/>) before writing the result back to the Bank.
/// Pokémon kept in a ROM hack's own record are never changed here.
/// </summary>
public static class BankMonEdits
{
    private const ushort Karrablast = 588;
    private const ushort Shelmet = 616;

    /// <summary>
    /// Generation 2's trade evolutions that need a held item. PKHeX's Generation 2 table records
    /// them as plain trades, so the item (and its use) is checked here: species → national item.
    /// </summary>
    private static readonly Dictionary<ushort, int> Gen2TradeItems = new()
    {
        [95] = 233,  // Onix + Metal Coat → Steelix
        [123] = 233, // Scyther + Metal Coat → Scizor
        [79] = 221,  // Slowpoke + King's Rock → Slowking
        [61] = 221,  // Poliwhirl + King's Rock → Politoed
        [117] = 235, // Seadra + Dragon Scale → Kingdra
        [137] = 252, // Porygon + Up-Grade → Porygon2
    };

    /// <summary>The national id of the item a stored Pokémon holds (0 for none).</summary>
    public static int HeldItemOf(byte[] bytes, string? format) =>
        EntityBytes.RomHackGame(format) is null && Read(bytes, format) is { } pk ? HeldItemRules.National(pk) : 0;

    /// <summary>
    /// Gives the Pokémon <paramref name="national"/> to hold, or takes its item off when it is 0.
    /// <paramref name="previous"/> is the national id it held before (0 for none). Null, with a
    /// reason, when the Pokémon cannot hold the item or holds one the Storage cannot keep.
    /// </summary>
    public static BankMonChange? SetHeldItem(byte[] bytes, string? format, int national, out int previous, out string? refusal)
    {
        previous = 0;
        refusal = null;
        if (EntityBytes.RomHackGame(format) is { } hack)
        {
            refusal = $"Pokémon from {hack} keep their items in their own game.";
            return null;
        }
        var pk = Read(bytes, format);
        if (pk is null)
        {
            refusal = "This Pokémon's data could not be read.";
            return null;
        }
        previous = HeldItemRules.National(pk);
        if (pk.HeldItem != 0 && previous == 0)
        {
            refusal = "It holds an item that only exists in its own game, so the Storage cannot keep it.";
            return null;
        }
        if (national > 0 && HeldItemRules.WhyCannotHold(pk, national) is { } why)
        {
            refusal = why;
            return null;
        }
        if (national <= 0 && pk.HeldItem == 0)
        {
            refusal = "It is not holding anything.";
            return null;
        }
        pk.HeldItem = national > 0 ? HeldItemRules.FromNational(national, pk.Context) : 0;
        return Write(pk);
    }

    /// <summary>
    /// The Shooting Star: the same Pokémon, made shiny the way its generation stores it (a new
    /// personality value from Generation 3 on, keeping nature, gender and ability; the shiny
    /// DVs in Generations 1 and 2). Null, with a reason, for eggs and Pokémon already shiny.
    /// </summary>
    public static ShinyChange? MakeShiny(byte[] bytes, string? format, out string? refusal)
    {
        refusal = null;
        if (EntityBytes.RomHackGame(format) is { } hack)
        {
            refusal = $"Pokémon from {hack} cannot use the Shooting Star.";
            return null;
        }
        var pk = Read(bytes, format);
        if (pk is null)
        {
            refusal = "This Pokémon's data could not be read.";
            return null;
        }
        if (pk.IsEgg)
        {
            refusal = "An egg has to hatch before it can use the Shooting Star.";
            return null;
        }
        if (pk.IsShiny)
        {
            refusal = "It is already shiny.";
            return null;
        }
        var wasLegal = IsLegal(pk);
        var shiny = pk.Clone();
        shiny.SetShiny();
        if (!shiny.IsShiny)
        {
            refusal = "This Pokémon cannot be made shiny.";
            return null;
        }
        // Generations 1 and 2 keep shininess in the stats' DVs: the stats follow.
        if (shiny.Format <= 2 || shiny.PartyStatsPresent)
            shiny.ResetPartyStats();
        var change = Write(shiny);
        return new ShinyChange(change.Data, change.Format, wasLegal, IsLegal(shiny));
    }

    /// <summary>
    /// The evolution a link trade causes, performed the way the Pokémon's own game performs it
    /// on the receiving side: plain trade evolutions, the ones that need a held item (which the
    /// trade uses up) and Karrablast and Shelmet traded for each other. An Everstone stops it.
    /// <paramref name="partnerSpecies"/> is the species it was traded for; <paramref name="receiverName"/>
    /// becomes its handling trainer from Generation 6 on. Null when nothing evolves.
    /// </summary>
    public static TradeEvolution? TradeEvolve(ISaveEngine engine, byte[] bytes, string? format, int partnerSpecies, string receiverName)
    {
        ArgumentNullException.ThrowIfNull(engine);
        if (EntityBytes.RomHackGame(format) is not null) return null;
        var before = Read(bytes, format);
        if (before is null || before.IsEgg) return null;
        // Generation 2: the item a trade evolution needs is checked (and used up) here.
        var gen2Item = before.Format == 2 && Gen2TradeItems.TryGetValue(before.Species, out var need) ? need : 0;
        using var session = engine.OpenEntitySession(bytes, null, format);
        if (session is null) return null;
        var service = new EvolutionService();
        var plan = service.Plan(session, 0, 0, hax: false);
        var option = plan.Options.FirstOrDefault(o => o.Available && o.Trigger switch
        {
            EvolutionTrigger.Trade => gen2Item == 0 || HeldItemRules.National(before) == gen2Item,
            EvolutionTrigger.TradeHoldingItem => true,
            EvolutionTrigger.TradeForPartner =>
                (plan.Species == Karrablast && partnerSpecies == Shelmet) || (plan.Species == Shelmet && partnerSpecies == Karrablast),
            _ => false,
        });
        if (option is null) return null;

        GenerationOutcome outcome;
        using (ThreeDsBankPolicy.Allow(BankFeature.Trade))
            outcome = service.Evolve(session, 0, 0, new EvolutionRequest(option.Id, TradePartnerName: receiverName, LearnIntoFreeSlots: true));
        if (!outcome.Success) return null;
        var export = session.ExportSlot(0, 0);
        var data = export.Data;
        var stored = export.Format ?? EntityBytes.Normalize(format) ?? string.Empty;
        var message = outcome.Message;
        if (gen2Item > 0 && option.Trigger == EvolutionTrigger.Trade && Read(data, stored) is { HeldItem: not 0 } evolved)
        {
            evolved.HeldItem = 0;
            var used = Write(evolved);
            data = used.Data;
            var names = GameInfo.GetStrings("en").itemlist;
            if (gen2Item < names.Length) message += $" {names[gen2Item]} was used up.";
        }
        return new TradeEvolution(data, stored, option.Species, option.Form, message);
    }

    private static PKM? Read(byte[] bytes, string? format)
    {
        ArgumentNullException.ThrowIfNull(bytes);
        var pk = EntityBytes.Parse(bytes, format);
        return pk is null || pk.Species == 0 ? null : pk;
    }

    private static bool IsLegal(PKM pk)
    {
        try { return new LegalityAnalysis(pk).Valid; }
        catch (Exception) { return false; }
    }

    private static BankMonChange Write(PKM pk)
    {
        pk.RefreshChecksum();
        var data = new byte[pk.SIZE_PARTY];
        pk.WriteDecryptedDataParty(data);
        return new BankMonChange(data, EntityBytes.FormatOf(pk));
    }
}
