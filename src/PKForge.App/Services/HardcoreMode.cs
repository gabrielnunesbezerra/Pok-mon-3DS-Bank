using PKForge.Domain;

namespace PKForge.App.Services;

/// <summary>
/// 3DS Bank runs PKForge's Hardcore mode permanently: the open save may be browsed,
/// organised, moved, transferred, backed up and exported, but nothing that edits,
/// fabricates or duplicates Pokémon data can be written - a Pokémon may be MOVED, never
/// COPIED. There is no setting to turn it off, and the engine refuses the same edits on
/// its own (<see cref="Domain.ThreeDsBankPolicy"/>), so a missed screen cannot bypass it.
/// </summary>
public static class HardcoreMode
{
    /// <summary>The one line every blocked surface shows instead of writing.</summary>
    public const string StatusLine = "3DS BANK - editing is disabled";

    /// <summary>Short marker for footers and headers.</summary>
    public const string Marker = "MOVE ONLY";

    /// <summary>Always on in 3DS Bank.</summary>
    public static bool IsOn => true;

    /// <summary>The decision table for the current setting.</summary>
    public static SaveGuard Guard => SaveGuard.For(IsOn);

    /// <summary>The status a blocked action shows, e.g. "HARDCORE MODE - data editing is off (duplication blocked)".</summary>
    public static string StatusFor(SaveAction action) => $"{StatusLine} ({Describe(action)} blocked)";

    /// <summary>
    /// True when Hardcore mode forbids <paramref name="action"/>; <paramref name="status"/>
    /// then carries the line to show instead of writing.
    /// </summary>
    public static bool Blocks(SaveAction action, out string status)
    {
        if (!Guard.Blocks(action))
        {
            status = string.Empty;
            return false;
        }
        status = StatusFor(action);
        return true;
    }

    private static string Describe(SaveAction action) => action switch
    {
        SaveAction.EditMon => "Pokémon edits",
        SaveAction.CreateMon => "creating Pokémon",
        SaveAction.BatchEdit => "batch edits",
        SaveAction.Duplicate => "duplication",
        SaveAction.InjectEvent => "event injection",
        SaveAction.EditInventory => "inventory edits",
        SaveAction.EditTrainer => "trainer edits",
        SaveAction.EditDex => "dex edits",
        SaveAction.EditWorld => "world edits",
        SaveAction.WriteRawBytes => "byte writes",
        SaveAction.RepairRtc => "clock repair",
        SaveAction.Move => "moving Pokémon",
        SaveAction.Release => "releasing Pokémon",
        SaveAction.ExportFile => "exports",
        SaveAction.Backup => "restore points",
        _ => "data edits",
    };
}
