namespace PKForge.Domain;

/// <summary>
/// 3DS Bank's fixed rules, enforced below the UI so no screen, shortcut or menu can bypass them:
/// <list type="bullet">
/// <item>Pokémon and save data are never edited, created, healed, evolved, legalized or duplicated.
/// Moving, sending, depositing, withdrawing, sorting, releasing, exporting and restore points stay.</item>
/// <item>Only saves from Generation 1 to 7 are opened.</item>
/// </list>
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

    private static readonly AsyncLocal<int> ParkCareDepth = new();

    /// <summary>True in the app: every editing entry point refuses to run (except inside
    /// <see cref="AllowParkCare"/>, the Poképark's own earned friendship and nature changes).</summary>
    public static bool EditingLocked => !TestMode && ParkCareDepth.Value == 0;

    /// <summary>
    /// Opens the one door the Poképark needs: while the returned scope is alive, the Bank may
    /// store a Pokémon that was cared for (more friendship, the once-only nature change).
    /// Nothing else uses it.
    /// </summary>
    public static IDisposable AllowParkCare()
    {
        ParkCareDepth.Value++;
        return new ParkCareScope();
    }

    private sealed class ParkCareScope : IDisposable
    {
        private bool _disposed;

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            ParkCareDepth.Value--;
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

/// <summary>An editing call refused by <see cref="ThreeDsBankPolicy"/>; nothing was changed.</summary>
public sealed class EditingDisabledException() : InvalidOperationException(ThreeDsBankPolicy.EditingDisabledMessage);
