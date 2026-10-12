namespace PKForge.App;

public sealed class App : Application
{
    /// <summary>Raised when Android resumes the app (including after the install-permission screen).</summary>
    public static event Action? Resumed;
    public static event Action? Suspended;
    protected override void OnSleep()
    {
        Suspended?.Invoke();
        Music?.PauseForBackground();
        base.OnSleep();
    }

    private static Platforms.Android.MusicPlayer? Music =>
        IPlatformApplication.Current?.Services.GetService<Domain.IMusicPlayer>() as Platforms.Android.MusicPlayer;

    /// <summary>The user's optional default background music starts with the app, once.</summary>
    protected override void OnStart()
    {
        base.OnStart();
        Music?.MaybeAutostart();
    }

    protected override void OnResume()
    {
        base.OnResume();
        Music?.ResumeFromBackground();
        Resumed?.Invoke();
    }

    public App()
    {
        Trace("App ctor");

        // Português or English, decided before the first page is built.
        Services.Lang.Install();

        // Every page reads its chrome colors when it is built, so the scheme comes first.
        Services.ColorThemeSetting.ApplyStored();

        // Warm both Skia faces off the ctor: the party view paints before the first
        // save opens, and its cached nickname font must never pin the placeholder.
        _ = Views.PixelFont.WarmAsync();
        _ = Views.PixelFont.WarmFallbackAsync();

        // The DS system font (NDS12/"PixelUI") is the app's voice everywhere. Symbol glyphs
        // that NDS12 lacks (Ⓐ, ♂, ▼, ◓ ...) are pinned to "Rounded" at their few call sites.
        Style FontStyle(Type target, BindableProperty property) =>
            new(target) { Setters = { new Setter { Property = property, Value = "PixelUI" } } };
        Resources.Add(FontStyle(typeof(Label), Label.FontFamilyProperty));
        Resources.Add(FontStyle(typeof(Button), Button.FontFamilyProperty));
        Resources.Add(FontStyle(typeof(Entry), Entry.FontFamilyProperty));
        Resources.Add(FontStyle(typeof(Editor), Editor.FontFamilyProperty));
    }

    internal static void Trace(string message)
    {
#if ANDROID
        Android.Util.Log.Info("PKForgeBoot", message);
#endif
    }

    /// <summary>After signing in: Home replaces the sign-in screen.</summary>
    internal static void ShowMainPage()
    {
        var services = IPlatformApplication.Current?.Services;
        if (services is null || Current is null || Current.Windows.Count == 0) return;
        Current.Windows[0].Page = CreateRoot(services);
        StartOnline(services);
    }

    /// <summary>3DS Bank 2.0: friends, trade invitations and the Shooting Star achievement, for a signed-in player.</summary>
    private static void StartOnline(IServiceProvider services)
    {
        // Never let the online extras keep the Bank from opening.
        try
        {
            Views.GlobalPrompts.Install(services);
            services.GetService<Services.SocialService>()?.Start();
            var storage = services.GetService<Services.StorageService>();
            if (storage is not null) _ = Task.Run(storage.CheckAchievement);
        }
        catch (Exception error)
        {
            Services.AppLog.Warn("online", $"Starting friends and the Storage: {error}");
        }
    }

    /// <summary>After signing out: the sign-in screen replaces everything.</summary>
    internal static void ShowLoginPage()
    {
        var services = IPlatformApplication.Current?.Services;
        if (services is null || Current is null || Current.Windows.Count == 0) return;
        Current.Windows[0].Page = services.GetRequiredService<Views.LoginPage>();
    }

    private static NavigationPage CreateRoot(IServiceProvider services)
    {
        Trace("resolving HomePage");
        var page = services.GetRequiredService<Views.HomePage>();
        Trace("HomePage resolved");
        return new NavigationPage(page)
        {
            BarBackgroundColor = Theme.UiTokens.Navy1,
            BarTextColor = Colors.White,
        };
    }

    /// <summary>
    /// Builds Home and the lower screen again after a color scheme change: pages take their
    /// colors when they are built. Called from Home's settings, so Home is the only page open.
    /// </summary>
    internal async Task ReloadForThemeAsync()
    {
        var services = IPlatformApplication.Current?.Services;
        if (services is null || Windows.Count == 0) return;
        Windows[0].Page = CreateRoot(services);
        var host = services.GetService<PKForge.Domain.ISecondaryDisplayHost>();
        if (host is null || Services.SecondScreenMode.UserOff) return;
        try
        {
            await host.DismissAsync();
            if (host.IsAvailable) await host.ShowAsync();
        }
        catch (InvalidOperationException error)
        {
            Services.AppLog.Warn("theme", $"Rebuilding the lower screen: {error.Message}");
        }
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        Trace("CreateWindow enter");
        // Never let a startup failure become a silent blank screen: show the error.
        try
        {
            var services = IPlatformApplication.Current?.Services
                ?? throw new InvalidOperationException("MAUI services are unavailable.");
            // 3DS Bank: the Bank belongs to an account, so the first screen is the sign-in
            // until someone signs in on this phone; after that the app opens straight to Home.
            var account = services.GetRequiredService<Services.AccountService>();
            if (!account.IsSignedIn)
                return new Window(services.GetRequiredService<Views.LoginPage>());
            services.GetRequiredService<Services.CloudBankSync>().Start();
            var window = new Window(CreateRoot(services));
            StartOnline(services);
            return window;
        }
        catch (Exception error)
        {
            Trace($"CreateWindow FAILED: {error}");
            return new Window(new ContentPage
            {
                BackgroundColor = Theme.UiTokens.Navy0,
                Content = new ScrollView
                {
                    Content = new Label
                    {
                        Text = $"3DS Bank failed to start:\n\n{error}",
                        TextColor = Colors.White,
                        Margin = new Thickness(20),
                    },
                },
            });
        }
    }
}
