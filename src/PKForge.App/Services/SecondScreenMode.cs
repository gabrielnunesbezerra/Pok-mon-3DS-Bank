namespace PKForge.App.Services;

/// <summary>
/// Whether PKForge uses a second display. The player can turn it off (one screen for
/// PKForge, the other free for an emulator), and the app turns it off for the rest of the
/// session by itself when the lower screen fails, so a display it cannot use never costs
/// more than the lower screen.
/// </summary>
public static class SecondScreenMode
{
    private const string Key = "second_screen_off";

    /// <summary>The player chose "Second screen: OFF" in Settings.</summary>
    public static bool UserOff => Preferences.Default.Get(Key, false);

    public static void SetUserOff(bool off) => Preferences.Default.Set(Key, off);

    /// <summary>The lower screen failed this session; it stays off until the app restarts.</summary>
    public static bool DisabledThisSession { get; private set; }

    public static bool Allowed => !UserOff && !DisabledThisSession;

    public static void DisableForSession(string reason, Exception? error = null)
    {
        if (DisabledThisSession) return;
        DisabledThisSession = true;
        AppLog.Error("second", $"Second screen turned off for this session: {reason}", error);
    }
}
