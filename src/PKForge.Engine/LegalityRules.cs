using PKHeX.Core;

namespace PKForge.Engine;

/// <summary>
/// PKForge's process-wide departures from PKHeX's default legality settings, applied once
/// when the engine loads.
/// </summary>
internal static class LegalityRules
{
    /// <summary>
    /// A Pokémon that went through HOME needs a tracker only HOME's servers issue: HOME gifts
    /// received in-app and Pokémon moved into the Switch games never have one. A missing
    /// tracker is reported as a warning rather than making the Pokémon illegal, the severity
    /// PKHeX itself offers for this check.
    /// </summary>
    public static void Apply() =>
        ParseSettings.Settings.HOMETransfer.HOMETransferTrackerNotPresent = Severity.Fishy;
}
