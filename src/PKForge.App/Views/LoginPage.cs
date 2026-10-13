using PKForge.App.Services;
using PKForge.App.Theme;
using PKForge.Infrastructure;

namespace PKForge.App.Views;

/// <summary>
/// The first screen of 3DS Bank: sign in, create an account, or get a new password, so the
/// Bank lives in the account and comes back after reinstalling. Since 2.0 an account has a
/// username (how friends find it) and an e-mail (how a forgotten password is reset). Accounts
/// made before 2.0 still sign in with their username until they add an e-mail. Support on
/// WhatsApp is one tap away.
/// </summary>
public sealed class LoginPage : ContentPage
{
    private enum Mode { SignIn, Create, Forgot }

    private readonly AccountService _account;
    private readonly CloudBankSync _sync;
    private readonly Entry _login;
    private readonly Entry _username;
    private readonly Entry _email;
    private readonly Entry _password;
    private readonly Label _formTitle;
    private readonly Label _hint;
    private readonly Label _status;
    private readonly Button _primary;
    private readonly Button _switchCreate;
    private readonly Button _switchForgot;
    private readonly Button _switchBack;
    private Mode _mode = Mode.SignIn;
    private bool _busy;

    public LoginPage(AccountService account, CloudBankSync sync)
    {
        _account = account;
        _sync = sync;
        Title = "3DS Bank";
        BackgroundColor = UiTokens.Housing;
        NavigationPage.SetHasNavigationBar(this, false);

        _login = Field("Username or e-mail", Keyboard.Email);
        _login.Text = AccountService.LastLogin;
        _username = Field("Username (how friends find you)", Keyboard.Plain);
        _email = Field("E-mail", Keyboard.Email);
        _password = Field("Password", Keyboard.Default);
        _password.IsPassword = true;
        _password.ReturnType = ReturnType.Go;
        _login.Completed += (_, _) => _password.Focus();
        _username.Completed += (_, _) => _email.Focus();
        _email.Completed += (_, _) => { if (_mode == Mode.Forgot) _ = SubmitAsync(); else _password.Focus(); };
        _password.Completed += (_, _) => _ = SubmitAsync();

        _formTitle = new Label { FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextTitle + 1, TextColor = UiTokens.Ink0 };
        _hint = new Label
        {
            FontFamily = DsChrome.PixelFont,
            FontSize = UiTokens.TextSmall,
            TextColor = UiTokens.InkSoft,
            LineBreakMode = LineBreakMode.WordWrap,
        };
        _status = new Label
        {
            FontFamily = DsChrome.PixelFont,
            FontSize = UiTokens.TextSmall,
            TextColor = UiTokens.Bad,
            IsVisible = false,
            LineBreakMode = LineBreakMode.WordWrap,
        };

        _primary = Kit.Capsule("Sign in", UiTokens.Green, primary: true);
        _primary.Clicked += (_, _) => _ = SubmitAsync();
        _switchCreate = Kit.Capsule("Create account", UiTokens.AccentInfo);
        _switchCreate.Clicked += (_, _) => SetMode(Mode.Create);
        _switchForgot = Kit.Capsule("Forgot password", UiTokens.Ink1);
        _switchForgot.Clicked += (_, _) => SetMode(Mode.Forgot);
        _switchBack = Kit.Capsule("Back to sign in", UiTokens.Ink1);
        _switchBack.Clicked += (_, _) => SetMode(Mode.SignIn);
        var support = Kit.Capsule("Talk to support (WhatsApp)", UiTokens.Ink1);
        support.Clicked += async (_, _) =>
        {
            if (!await CloudSettings.OpenSupportChatAsync())
                ShowStatus($"Could not open WhatsApp. Support: +{CloudSettings.SupportWhatsApp}", error: true);
        };

        var logo = new Image
        {
            Source = ThemeLogo.Source(),
            HeightRequest = 104,
            WidthRequest = 104,
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
            },
        };
        var form = new VerticalStackLayout
        {
            Spacing = 8,
            VerticalOptions = LayoutOptions.Center,
            Children =
            {
                _formTitle,
                _hint,
                _login,
                _username,
                _email,
                _password,
                _status,
                _primary,
                _switchCreate,
                _switchForgot,
                _switchBack,
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
        SetMode(Mode.SignIn);
    }

    private static Entry Field(string placeholder, Keyboard keyboard)
    {
        var entry = Kit.TextField();
        entry.Placeholder = placeholder;
        entry.Keyboard = keyboard;
        entry.ReturnType = ReturnType.Next;
        return entry;
    }

    private void SetMode(Mode mode)
    {
        _mode = mode;
        ShowStatus("", error: false);
        _login.IsVisible = mode == Mode.SignIn;
        _username.IsVisible = mode == Mode.Create;
        _email.IsVisible = mode is Mode.Create or Mode.Forgot;
        _password.IsVisible = mode is Mode.SignIn or Mode.Create;
        _switchCreate.IsVisible = mode == Mode.SignIn;
        _switchForgot.IsVisible = mode == Mode.SignIn;
        _switchBack.IsVisible = mode != Mode.SignIn;
        switch (mode)
        {
            case Mode.SignIn:
                _formTitle.Text = "Sign in";
                _hint.Text = "Use the e-mail of your account. Accounts made before version 2.0 without an e-mail sign in with the username.";
                _primary.Text = "Sign in";
                break;
            case Mode.Create:
                _formTitle.Text = "Create account";
                _hint.Text = "The username is how your friends find you (3 to 20 letters, numbers, dots or underscores). The e-mail is how you sign in and get a new password if you forget it.";
                _primary.Text = "Create account";
                if (string.IsNullOrEmpty(_email.Text) && CloudAccountClient.LooksLikeEmail(_login.Text)) _email.Text = _login.Text;
                break;
            case Mode.Forgot:
                _formTitle.Text = "Forgot password";
                _hint.Text = "Type the e-mail of your account. A link to make a new password goes there. Accounts without an e-mail can get help from support.";
                _primary.Text = "Send the link";
                if (string.IsNullOrEmpty(_email.Text) && CloudAccountClient.LooksLikeEmail(_login.Text)) _email.Text = _login.Text;
                break;
        }
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
        foreach (var view in new View[] { _primary, _switchCreate, _switchForgot, _switchBack, _login, _username, _email, _password })
            view.IsEnabled = !busy;
    }

    private async Task SubmitAsync()
    {
        if (_busy) return;
        var password = _password.Text ?? "";
        switch (_mode)
        {
            case Mode.SignIn:
                if (string.IsNullOrWhiteSpace(_login.Text))
                {
                    ShowStatus("Type your e-mail (or the username of an account made before 2.0).", error: true);
                    return;
                }
                break;
            case Mode.Create:
                if (CloudAccountClient.NormalizeUsername(_username.Text) is null)
                {
                    ShowStatus("Usernames have 3 to 20 letters, numbers, dots or underscores, with no spaces.", error: true);
                    return;
                }
                if (CloudAccountClient.NormalizeEmail(_email.Text) is null)
                {
                    ShowStatus("Type a valid e-mail. If you ever forget your password, the link to make a new one goes there.", error: true);
                    return;
                }
                break;
            case Mode.Forgot:
                await SendResetAsync();
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
            if (_mode == Mode.Create)
            {
                ShowStatus("Creating your account…", error: false);
                await _account.SignUpAsync(_username.Text ?? "", _email.Text ?? "", password);
            }
            else
            {
                ShowStatus("Signing in…", error: false);
                await _account.SignInAsync(_login.Text ?? "", password);
            }
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

    private async Task SendResetAsync()
    {
        SetBusy(true);
        try
        {
            ShowStatus("Sending…", error: false);
            await _account.Client.SendPasswordResetAsync(_email.Text ?? "");
            ShowStatus($"Done! Open the link sent to {_email.Text?.Trim()} (look in spam too), make a new password, then sign in here with the e-mail.", error: false);
        }
        catch (CloudAccountException error)
        {
            ShowStatus(error.Message, error: true);
        }
        catch (Exception error)
        {
            AppLog.Warn("account", $"Password reset failed: {error}");
            ShowStatus($"Something went wrong: {error.Message}", error: true);
        }
        finally
        {
            SetBusy(false);
        }
    }
}
