namespace PKForge.Domain;

/// <summary>
/// 3DS Bank's fixed rules, enforced below the UI so no screen, shortcut or menu can bypass them:
/// <list type="bullet">
/// <item>Pokémon and save data are never edited, created, healed, evolved, legalized or duplicated.
/// Moving, sending, depositing, withdrawing, sorting, releasing, exporting and restore points stay.</item>
/// <item>Only saves from Generation 1 to 7 are opened.</item>
/// </list>
/// Since 2.0 a few Bank features open a door for the length of one operation
/// (<see cref="Allow"/>): the Poképark's care, moving items between a game's bag and the
/// Storage, giving or taking a held item, the Shooting Star and an online trade (with its
/// trade evolution). Nothing else gets through.
/// The unit test projects lift both rules through the <see cref="TestModeSwitch"/> runtime
/// switch (set in their .csproj files) so the original engine tests keep exercising the code;
/// the Android app never sets it.
/// </summary>
public static class ThreeDsBankPolicy
{
    /// <summary>The app's display name.</summary>
    public const string AppName = "3DS Bank";

    /// <summary>Newest generation whose saves 3DS Bank opens.</summary>
    public const int MaxGeneration = 7;

    /// <summary>AppContext switch that only the unit test projects set.</summary>
    public const string TestModeSwitch = "ThreeDsBank.TestMode";

    /// <summary>Shown when an edit reaches the engine.</summary>
    public const string EditingDisabledMessage =
        "3DS Bank does not edit Pokémon or save data. Pokémon can only be moved, sent, released or exported.";

    /// <summary>Shown when a save newer than Generation 7 is opened.</summary>
    public const string GenerationRefusedMessage =
        "3DS Bank only opens saves from Generation 1 to 7. The file was not touched.";

    private static readonly bool TestMode =
        AppContext.TryGetSwitch(TestModeSwitch, out var enabled) && enabled;

    private static readonly AsyncLocal<int> FeatureDepth = new();

    /// <summary>True in the app: every editing entry point refuses to run (except inside
    /// <see cref="Allow"/>, one of the Bank's own features).</summary>
    public static bool EditingLocked => !TestMode && FeatureDepth.Value == 0;

    /// <summary>
    /// Opens the door one Bank feature needs: while the returned scope is alive, the engine and
    /// the Bank accept the change that feature makes (see <see cref="BankFeature"/>).
    /// </summary>
    public static IDisposable Allow(BankFeature feature)
    {
        _ = feature; // the feature names the reason at the call site; the door is the same
        FeatureDepth.Value++;
        return new FeatureScope();
    }

    /// <summary>The Poképark's door: a cared-for Pokémon (more friendship, the once-only nature change).</summary>
    public static IDisposable AllowParkCare() => Allow(BankFeature.ParkCare);

    private sealed class FeatureScope : IDisposable
    {
        private bool _disposed;

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            FeatureDepth.Value--;
        }
    }

    /// <summary>Whether a save or Pokémon format of this generation may be opened.</summary>
    public static bool SupportsGeneration(int generation) => TestMode || generation <= MaxGeneration;

    /// <summary>Refuses the call while editing is locked; the save is never touched.</summary>
    public static void ThrowIfEditingLocked()
    {
        if (EditingLocked)
            throw new EditingDisabledException();
    }

    /// <summary>The refusal as an outcome, for flows that report instead of throwing.</summary>
    public static GenerationOutcome Refused => new(false, EditingDisabledMessage);

    /// <summary>Refuses the call when the generation is newer than <see cref="MaxGeneration"/>.</summary>
    public static void ThrowIfGenerationUnsupported(int generation)
    {
        if (!SupportsGeneration(generation))
            throw new InvalidDataException(GenerationRefusedMessage);
    }
}

/// <summary>The Bank features allowed to change a Pokémon or a save (<see cref="ThreeDsBankPolicy.Allow"/>).</summary>
public enum BankFeature
{
    /// <summary>Poképark care: friendship and the once-only nature change.</summary>
    ParkCare,
    /// <summary>Items moved between a game's bag and the Storage.</summary>
    BagItems,
    /// <summary>A held item given to or taken from a Bank Pokémon, or returned to the Storage on a transfer.</summary>
    HeldItem,
    /// <summary>The Shooting Star turning a Bank Pokémon shiny.</summary>
    ShootingStar,
    /// <summary>An online trade and the trade evolution it causes.</summary>
    Trade,
}

/// <summary>An editing call refused by <see cref="ThreeDsBankPolicy"/>; nothing was changed.</summary>
public sealed class EditingDisabledException() : InvalidOperationException(ThreeDsBankPolicy.EditingDisabledMessage);
