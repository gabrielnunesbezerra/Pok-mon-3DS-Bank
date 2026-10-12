using System.Security.Cryptography;
using System.Text;
using PKForge.Domain;
using PKHeX.Core;

namespace PKForge.Engine;

/// <summary>What the Poképark can read of a Bank resident.</summary>
/// <param name="Friendship">Current friendship (0-255).</param>
/// <param name="Nature">Nature id (0-24), or -1 when the format has none.</param>
/// <param name="IdentityKey">A key that stays the same through friendship and nature changes,
/// for the once-only nature ledger.</param>
public sealed record ParkCareFacts(int Friendship, int Nature, bool IsEgg, bool SupportsFriendship, bool SupportsNature, string IdentityKey);

/// <summary>
/// The Poképark's two earned changes on a Bank Pokémon's bytes: more friendship, and one nature
/// change. Both keep the Pokémon in its exact stored format; a nature change that would turn a
/// legal Pokémon illegal (Gen 3/4 tie nature to the PID of the encounter) is refused.
/// </summary>
public static class ParkCareEngine
{
    /// <summary>Reads what the park needs; null for unreadable entries and ROM hack records.</summary>
    public static ParkCareFacts? Read(byte[] data, string? format)
    {
        var pk = Parse(data, format);
        if (pk is null) return null;
        var hasNature = pk.Format >= 3;
        return new ParkCareFacts(pk.CurrentFriendship, hasNature ? (int)pk.Nature : -1, pk.IsEgg,
            pk.Format >= 2 && !pk.IsEgg, hasNature && !pk.IsEgg, IdentityKey(pk));
    }

    /// <summary>The same bytes with more friendship (capped at 255); null when it cannot gain any.</summary>
    public static byte[]? AddFriendship(byte[] data, string? format, int amount, out int friendship)
    {
        friendship = 0;
        var pk = Parse(data, format);
        if (pk is null || pk.IsEgg || pk.Format < 2) return null;
        pk.CurrentFriendship = (byte)Math.Clamp(pk.CurrentFriendship + amount, 0, ParkCareRules.MaxFriendship);
        friendship = pk.CurrentFriendship;
        return Serialize(pk, data.Length);
    }

    /// <summary>
    /// The same bytes with another nature, keeping shininess, gender and ability. Null with a
    /// reason when the format has no nature, the nature is already that one, or the change
    /// would make a legal Pokémon illegal.
    /// </summary>
    public static byte[]? ChangeNature(byte[] data, string? format, int nature, out string? refusal)
    {
        refusal = null;
        var pk = Parse(data, format);
        if (pk is null || pk.IsEgg)
        {
            refusal = "This Pokémon cannot change here.";
            return null;
        }
        if (pk.Format < 3)
        {
            refusal = "Pokémon from Generation 1 and 2 have no nature.";
            return null;
        }
        var wanted = (Nature)Math.Clamp(nature, 0, 24);
        if (pk.Nature == wanted)
        {
            refusal = "It already has that nature.";
            return null;
        }
        var wasLegal = IsLegal(pk);
        if (pk is G3PKM or G4PKM)
        {
            if (!SaveEngineSession.TrySetPidDerived(pk, wanted, null))
            {
                refusal = "No personality keeps it the same with that nature.";
                return null;
            }
        }
        else
        {
            pk.Nature = SaveEngineSession.NatureEditTarget(pk, wanted, out var statNature);
            pk.StatAlignment = statNature;
        }
        pk.RefreshChecksum();
        if (wasLegal && !IsLegal(pk))
        {
            refusal = "In its game the nature is tied to how it was met, so a new nature would make it illegal. It keeps its nature.";
            return null;
        }
        return Serialize(pk, data.Length);
    }

    private static PKM? Parse(byte[] data, string? format)
    {
        // ROM hack records are their own formats: the park reads them as PK3 views only.
        if (RadicalRed.CfruEntity.Recognize(format) is not null) return null;
        var pk = EntityBytes.Parse(data, format);
        return pk is null || pk.Species == 0 ? null : pk;
    }

    private static bool IsLegal(PKM pk)
    {
        try
        {
            return new LegalityAnalysis(pk).Valid;
        }
        catch (Exception)
        {
            return false;
        }
    }

    /// <summary>Writes the entity back at the length it was stored with (party or box size).</summary>
    private static byte[] Serialize(PKM pk, int length)
    {
        if (length == pk.SIZE_STORED)
        {
            var stored = new byte[pk.SIZE_STORED];
            _ = pk.WriteDecryptedDataStored(stored);
            return stored;
        }
        var party = new byte[pk.SIZE_PARTY];
        pk.WriteDecryptedDataParty(party);
        return party;
    }

    /// <summary>Trainer, IVs, ball and origin: none of them change with friendship or nature.</summary>
    private static string IdentityKey(PKM pk)
    {
        var ec = pk.Format >= 6 ? pk.EncryptionConstant : 0u;
        var text = string.Join('|', pk.TID16, pk.SID16, pk.OriginalTrainerName, pk.IV_HP, pk.IV_ATK, pk.IV_DEF,
            pk.IV_SPA, pk.IV_SPD, pk.IV_SPE, pk.Ball, pk.MetLocation, (int)pk.Version, pk.Language, ec);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)))[..32];
    }
}
