using PKHeX.Core;

namespace PKForge.Engine;

/// <summary>
/// A species' types in the modern numbering (Normal 0 to Fairy 17). The Game Boy games'
/// personal tables keep their own numbers (Bug 7, Ghost 8, Steel 9, then Fire 20 to Dark 27,
/// with unused ids between), so Gen 1 and 2 entries are mapped first.
/// </summary>
internal static class PersonalTypes
{
    public static int[] Of(PersonalInfo personal)
    {
        var gameBoy = personal is PersonalInfo1 or PersonalInfo2;
        var first = gameBoy ? FromGameBoy(personal.Type1) : personal.Type1;
        var second = gameBoy ? FromGameBoy(personal.Type2) : personal.Type2;
        return first == second ? [first] : [first, second];
    }

    public static int First(PersonalInfo personal) =>
        personal is PersonalInfo1 or PersonalInfo2 ? FromGameBoy(personal.Type1) : personal.Type1;

    /// <summary>One Game Boy type id in the modern numbering; unknown ids become Normal.</summary>
    public static int FromGameBoy(int type) => type switch
    {
        <= 5 => type,             // Normal, Fighting, Flying, Poison, Ground, Rock
        7 => 6,                   // Bug
        8 => 7,                   // Ghost
        9 => 8,                   // Steel
        >= 20 and <= 27 => type - 11, // Fire, Water, Grass, Electric, Psychic, Ice, Dragon, Dark
        _ => 0,
    };
}
