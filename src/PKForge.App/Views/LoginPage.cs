using PKForge.App.Services;
using PKForge.App.Theme;
using PKForge.Infrastructure;

namespace PKForge.App.Views;

/// <summary>
/// The first screen of 3DS Bank: sign in or create an account, so the Bank lives in the
/// account and comes back after reinstalling. Support on WhatsApp is one tap away.
/// </summary>
public sealed class LoginPage : ContentPage
{
    private readonly AccountService _account;
    private readonly CloudBankSync _sync;
    private readonly Entry _username;
    private readonly Entry _password;
    private readonly Label _status;
    private readonly Button _signIn;
    private readonly Button _create;
    private bool _busy;

    public LoginPage(AccountService account, CloudBankSync sync)
    {
        _account = account;
        _sync = sync;
        Title = "3DS Bank";
        BackgroundColor = UiTokens.Housing;
        NavigationPage.SetHasNavigationBar(this, false);

        _username = Kit.TextField();
        _username.Placeholder = "Username";
        _username.Keyboard = Keyboard.Plain;
        _username.ReturnType = ReturnType.Next;
        _password = Kit.TextField();
        _password.Placeholder = "Password";
        _password.IsPassword = true;
        _password.ReturnType = ReturnType.Go;
        _username.Completed += (_, _) => _password.Focus();
        _password.Completed += (_, _) => _ = SubmitAsync(createAccount: false);

        _status = new Label
        {
            FontFamily = DsChrome.PixelFont,
            FontSize = UiTokens.TextSmall,
            TextColor = UiTokens.Bad,
            IsVisible = false,
            LineBreakMode = LineBreakMode.WordWrap,
        };

        _signIn = Kit.Capsule("Sign in", UiTokens.Green, primary: true);
        _signIn.Clicked += (_, _) => _ = SubmitAsync(createAccount: false);
        _create = Kit.Capsule("Create account", UiTokens.AccentInfo);
        _create.Clicked += (_, _) => _ = SubmitAsync(createAccount: true);
        var support = Kit.Capsule("Talk to support (WhatsApp)", UiTokens.Ink1);
        support.Clicked += async (_, _) =>
        {
            if (!await CloudSettings.OpenSupportChatAsync())
                ShowStatus($"Could not open WhatsApp. Support: +{CloudSettings.SupportWhatsApp}", error: true);
        };

        // Each language is offered in its own name, so it is never translated.
        var language = Lang.Raw(Kit.Capsule(Lang.IsPortuguese ? "Switch to English" : "Mudar para Português", UiTokens.Ink1));
        language.HorizontalOptions = LayoutOptions.Center;
        language.Clicked += (_, _) =>
        {
            Lang.Set(Lang.IsPortuguese ? Lang.English : Lang.Portuguese);
            App.ShowLoginPage();
        };

        var logo = new Image
        {
            Source = ThemeLogo.Source(),
            HeightRequest = 96,
            WidthRequest = 96,
            Aspect = Aspect.AspectFit,
            HorizontalOptions = LayoutOptions.Center,
        };
        var intro = new VerticalStackLayout
        {
            Spacing = 8,
            VerticalOptions = LayoutOptions.Center,
            Children =
            {
                logo,
                new Label
                {
                    Text = "3DS Bank", FontFamily = DsChrome.PixelFont, FontSize = 22, FontAttributes = FontAttributes.Bold,
                    TextColor = UiTokens.Ink0, HorizontalTextAlignment = TextAlignment.Center,
                },
                new Label
                {
                    Text = "Your Bank is saved to your account, so uninstalling the app never loses your Pokémon.",
                    FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextSmall, TextColor = UiTokens.InkSoft,
                    HorizontalTextAlignment = TextAlignment.Center, LineBreakMode = LineBreakMode.WordWrap,
                },
                language,
            },
        };
        var form = new VerticalStackLayout
        {
            Spacing = 8,
            VerticalOptions = LayoutOptions.Center,
            Children =
            {
                Kit.HeaderBar("Sign in"),
                _username,
                _password,
                _status,
                _signIn,
                _create,
                Kit.Divider(),
                support,
            },
        };
        var columns = new Grid
        {
            ColumnSpacing = 24,
            ColumnDefinitions = [new(new GridLength(1, GridUnitType.Star)), new(new GridLength(1.3, GridUnitType.Star))],
            Children = { intro, form },
        };
        Grid.SetColumn(form, 1);
        var panel = Kit.Panel(columns, padding: 18);
        panel.MaximumWidthRequest = 680;
        panel.HorizontalOptions = LayoutOptions.Center;
        panel.VerticalOptions = LayoutOptions.Center;
        panel.Margin = new Thickness(16, 12);

        var body = new Grid
        {
            Children = { DsChrome.GridBackground(), new ScrollView { Content = panel } },
        };
        var root = new Grid
        {
            RowDefinitions = [new(GridLength.Auto), new(GridLength.Star)],
            Children = { DsChrome.TitleBar(), body },
        };
        Grid.SetRow(body, 1);
        Content = root;
    }

    private void ShowStatus(string text, bool error)
    {
        _status.Text = text;
        _status.TextColor = error ? UiTokens.Bad : UiTokens.Ink0;
        _status.IsVisible = text.Length > 0;
    }

    private void SetBusy(bool busy)
    {
        _busy = busy;
        _signIn.IsEnabled = !busy;
        _create.IsEnabled = !busy;
        _username.IsEnabled = !busy;
        _password.IsEnabled = !busy;
    }

    private async Task SubmitAsync(bool createAccount)
    {
        if (_busy) return;
        var username = _username.Text ?? "";
        var password = _password.Text ?? "";
        if (CloudAccountClient.NormalizeUsername(username) is null)
        {
            ShowStatus("Usernames have 3 to 20 letters, numbers, dots or underscores, with no spaces.", error: true);
            return;
        }
        if (password.Length < CloudAccountClient.MinPasswordLength)
        {
            ShowStatus($"The password needs at least {CloudAccountClient.MinPasswordLength} characters.", error: true);
            return;
        }

        SetBusy(true);
        try
        {
            ShowStatus(createAccount ? "Creating your account…" : "Signing in…", error: false);
            await _account.SignInAsync(username, password, createAccount);
            ShowStatus("Loading your Bank…", error: false);
            string welcome;
            try
            {
                welcome = await _sync.AdoptAccountBankAsync();
            }
            catch (Exception error)
            {
                ShowStatus($"Signed in, but your Bank could not be loaded: {error.Message} Try again.", error: true);
                return;
            }
            _sync.Start();
            ShowStatus(welcome, error: false);
            await Task.Delay(1200);
            App.ShowMainPage();
        }
        catch (CloudAccountException error)
        {
            ShowStatus(error.Message, error: true);
        }
        catch (Exception error)
        {
            AppLog.Warn("account", $"Sign-in failed: {error}");
            ShowStatus($"Something went wrong: {error.Message}", error: true);
        }
        finally
        {
            SetBusy(false);
        }
    }
}
