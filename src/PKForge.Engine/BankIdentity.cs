using PKHeX.Core;

namespace PKForge.Engine;

/// <summary>
/// 3DS Bank 2.5: who a Pokémon is, for the admin's duplicate search. <see cref="Strict"/> is the
/// same only for copies of one Pokémon (personality, encryption constant and trainer ids);
/// <see cref="Loose"/> also matches a copy that was changed later (made shiny, evolved, sent to
/// another generation), so it marks a suspect for the admin to look at, never removes on its own.
/// </summary>
public sealed record BankIdentity(string Strict, string Loose)
{
    /// <summary>The identity of stored bytes, or null when they cannot be read.</summary>
    public static BankIdentity? Of(byte[] data, string? format)
    {
        ArgumentNullException.ThrowIfNull(data);
        PKM? pk;
        try { pk = EntityBytes.Parse(data, format); }
        catch (Exception error) when (error is ArgumentException or InvalidOperationException or IndexOutOfRangeException) { pk = null; }
        if (pk is null || pk.Species == 0) return null;
        var trainer = $"{pk.TID16}|{pk.SID16}|{pk.OriginalTrainerName}";
        var ivs = $"{pk.IV_HP}.{pk.IV_ATK}.{pk.IV_DEF}.{pk.IV_SPE}.{pk.IV_SPA}.{pk.IV_SPD}";
        // Generation 1 and 2 have no personality value: the DVs and the species line stand in.
        var strict = pk.Format <= 2
            ? $"gb|{trainer}|{ivs}|{pk.Species}"
            : $"{pk.PID:X8}|{pk.EncryptionConstant:X8}|{trainer}";
        return new BankIdentity(strict, $"{trainer}|{ivs}|{pk.Gender}");
    }
}
