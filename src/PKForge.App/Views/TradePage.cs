using Microsoft.Maui.Controls.Shapes;
using PKForge.App.Services;
using PKForge.App.Theme;
using PKForge.Domain;
using PKForge.Engine;
using PKForge.Infrastructure;

namespace PKForge.App.Views;

/// <summary>
/// An online trade with a friend (3DS Bank 2.0). Each side picks a Pokémon from their Bank and
/// sees the other's (with its details); when both confirm, each Bank takes the other's Pokémon,
/// and a Pokémon that evolves by trade evolves on arrival (held items included). Until both
/// confirm, either player can call it off and nothing changes.
/// </summary>
public sealed class TradePage : ContentPage, IPadHandler, IOverlayHost
{
    private static readonly TimeSpan PollEvery = TimeSpan.FromSeconds(1.5);

    private readonly SocialService _social;
    private readonly IBankService _bank;
    private readonly StorageService _storage;
    private readonly string _tradeId;
    private readonly string _partnerName;
    private readonly Grid _host;
    private readonly SpriteView _mineSprite = new(112);
    private readonly SpriteView _theirSprite = new(112);
    private readonly Label _mineName = Big();
    private readonly Label _mineFacts = Small();
    private readonly Label _theirName = Big();
    private readonly Label _theirFacts = Small();
    private readonly Label _status;
    private readonly Label _presence = Small();
    private readonly Button _choose;
    private readonly Button _mineDetails;
    private readonly Button _theirDetails;
    private readonly Button _confirm;
    private readonly Button _cancel;
    private IDispatcherTimer? _timer;
    private TradeStep? _last;
    private bool _polling;
    private bool _acting;
    private bool _finished;
    private int _tick;

    private TradePage(SocialService social, IBankService bank, StorageService storage, string tradeId, string partnerName)
    {
        _social = social;
        _bank = bank;
        _storage = storage;
        _tradeId = tradeId;
        _partnerName = partnerName;
        Title = "Trade";
        BackgroundColor = UiTokens.Housing;
        NavigationPage.SetHasNavigationBar(this, false);

        var header = Kit.HeaderBar($"Trade with {partnerName}");
        _choose = Kit.Capsule("Choose a Pokémon", UiTokens.AccentInfo, icon: "bank");
        _choose.Clicked += (_, _) => _ = Act(ChooseAsync);
        _mineDetails = Kit.Capsule("Details", UiTokens.Ink1, icon: "info");
        _mineDetails.Clicked += (_, _) => _ = Act(() => DetailsAsync(mine: true));
        _theirDetails = Kit.Capsule("Details", UiTokens.Ink1, icon: "info");
        _theirDetails.Clicked += (_, _) => _ = Act(() => DetailsAsync(mine: false));

        var mineCard = Card("You offer", _mineSprite, _mineName, _mineFacts, _choose, _mineDetails);
        var theirCard = Card($"{partnerName} offers", _theirSprite, _theirName, _theirFacts, _theirDetails);
        var cards = new Grid
        {
            ColumnSpacing = 12,
            ColumnDefinitions = [new(GridLength.Star), new(GridLength.Star)],
            Children = { mineCard, theirCard },
        };
        Grid.SetColumn(theirCard, 1);

        _status = new Label
        {
            FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextBody, TextColor = UiTokens.Ink0,
            LineBreakMode = LineBreakMode.WordWrap, HorizontalTextAlignment = TextAlignment.Center,
            Text = "Connecting…",
        };
        _presence.HorizontalTextAlignment = TextAlignment.Center;
        _confirm = Kit.Capsule("Confirm trade", UiTokens.Green, primary: true, icon: "confirm");
        _confirm.Clicked += (_, _) => _ = Act(ConfirmAsync);
        _cancel = Kit.Capsule("Cancel trade", UiTokens.Bad, icon: "close");
        _cancel.Clicked += (_, _) => _ = Act(CancelAsync);
        var buttons = new HorizontalStackLayout { Spacing = 10, HorizontalOptions = LayoutOptions.Center, Children = { _confirm, _cancel } };

        var body = new VerticalStackLayout
        {
            Spacing = 10,
            Children =
            {
                header,
                cards,
                Kit.Panel(new VerticalStackLayout { Spacing = 8, Children = { _status, _presence, buttons } }, padding: 12),
            },
        };
        var footer = DsChrome.Footer(
            ("A", "Confirm", () => _ = Act(ConfirmAsync)),
            ("B", "Cancel trade", () => _ = Act(CancelAsync)),
            ("Y", "Choose", () => _ = Act(ChooseAsync)));
        var content = new ScrollView { Padding = new Thickness(14, 10), Content = body };
        var root = new Grid
        {
            RowDefinitions = [new(GridLength.Auto), new(GridLength.Star), new(GridLength.Auto)],
            Children = { DsChrome.TitleBar(), new Grid { Children = { DsChrome.GridBackground(), content } }, footer },
        };
        Grid.SetRow((View)root.Children[1], 1);
        Grid.SetRow(footer, 2);
        _host = new Grid { Children = { root } };
        Content = _host;
        Render(null);
    }

    public Grid OverlayHost => _host;

    /// <summary>Opens the trade screen over whatever is in front.</summary>
    public static async Task OpenAsync(string tradeId, string partnerName)
    {
        var services = IPlatformApplication.Current?.Services;
        if (services is null) return;
        var page = new TradePage(services.GetRequiredService<SocialService>(), services.GetRequiredService<IBankService>(),
            services.GetRequiredService<StorageService>(), tradeId, partnerName);
        var root = Application.Current?.Windows.FirstOrDefault()?.Page;
        var navigation = (root as NavigationPage)?.Navigation ?? root?.Navigation;
        if (navigation is not null) await navigation.PushAsync(page);
    }

    private static Label Big() => new()
    {
        FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextTitle + 1, TextColor = UiTokens.Ink0,
        HorizontalTextAlignment = TextAlignment.Center, LineBreakMode = LineBreakMode.TailTruncation,
    };

    private static Label Small() => new()
    {
        FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextSmall, TextColor = UiTokens.InkSoft,
        HorizontalTextAlignment = TextAlignment.Center, LineBreakMode = LineBreakMode.WordWrap,
    };

    private static View Card(string caption, SpriteView sprite, Label name, Label facts, params Button[] buttons)
    {
        sprite.HorizontalOptions = LayoutOptions.Center;
        var stack = new VerticalStackLayout
        {
            Spacing = 6,
            Children =
            {
                new Label { Text = caption, FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextLabel, TextColor = UiTokens.InkSoft, HorizontalTextAlignment = TextAlignment.Center },
                sprite,
                name,
                facts,
            },
        };
        foreach (var button in buttons)
        {
            button.HorizontalOptions = LayoutOptions.Center;
            stack.Children.Add(button);
        }
        return new Border
        {
            Padding = new Thickness(10),
            BackgroundColor = UiTokens.Paper,
            Stroke = UiTokens.ShellEdge,
            StrokeThickness = 1.5,
            StrokeShape = new RoundRectangle { CornerRadius = 12 },
            Content = stack,
        };
    }

    // ── Life cycle ───────────────────────────────────────────────────────────

    protected override void OnAppearing()
    {
        base.OnAppearing();
        IPlatformApplication.Current?.Services.GetService<GamepadRouter>()?.Push(this);
        _timer ??= Dispatcher.CreateTimer();
        _timer.Interval = PollEvery;
        _timer.Tick -= OnTick;
        _timer.Tick += OnTick;
        _timer.Start();
        _ = PollAsync();
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();
        IPlatformApplication.Current?.Services.GetService<GamepadRouter>()?.Remove(this);
        _timer?.Stop();
    }

    protected override bool OnBackButtonPressed()
    {
        _ = Act(CancelAsync);
        return true;
    }

    public bool OnPadButton(PadButton button)
    {
        switch (button)
        {
            case PadButton.A: _ = Act(ConfirmAsync); return true;
            case PadButton.B: _ = Act(CancelAsync); return true;
            case PadButton.Y: _ = Act(ChooseAsync); return true;
            default: return true;
        }
    }

    private void OnTick(object? sender, EventArgs e) => _ = PollAsync();

    private async Task PollAsync()
    {
        if (_polling || _acting || _finished) return;
        _polling = true;
        try
        {
            var step = await _social.AdvanceAsync(_tradeId);
            await ShowStepAsync(step);
            if (!_finished && ++_tick % 6 == 1 && step.Trade is { } trade)
            {
                var online = await _social.IsOnlineAsync(trade.PartnerOf(_social.MyUid ?? ""));
                _presence.Text = online ? $"{_partnerName} is here." : $"{_partnerName} seems to have left the app.";
                _presence.TextColor = online ? UiTokens.Green : UiTokens.Warn;
            }
        }
        catch (CloudAccountException error)
        {
            _status.Text = $"{error.Message} Trying again…";
        }
        catch (Exception error) when (error is IOException or InvalidOperationException or FormatException)
        {
            AppLog.Warn("trade", error.ToString());
            _status.Text = $"{error.Message} Trying again…";
        }
        finally
        {
            _polling = false;
        }
    }

    private async Task Act(Func<Task> action)
    {
        if (_acting || _finished) return;
        _acting = true;
        try
        {
            await action();
        }
        catch (CloudAccountException error)
        {
            await PadMenu.ShowAsync(_host, "Trade", error.Message, "OK");
        }
        catch (Exception error) when (error is IOException or InvalidOperationException or FormatException)
        {
            AppLog.Warn("trade", error.ToString());
            await PadMenu.ShowAsync(_host, "Trade", error.Message, "OK");
        }
        finally
        {
            _acting = false;
        }
        if (!_finished) await PollAsync();
    }

    // ── What the screen shows ────────────────────────────────────────────────

    private async Task ShowStepAsync(TradeStep step)
    {
        _last = step;
        Render(step);
        var finished = step.Trade is null
            || step.View?.Stage == TradeStage.Cancelled
            || (step.View?.Stage == TradeStage.Committed && (step.Received || step.View?.Finished == true));
        if (!finished || _finished) return;
        _finished = true;
        _timer?.Stop();
        var title = step.View?.Stage == TradeStage.Committed ? "Trade complete!" : "Trade over";
        var message = step.Message ?? (step.View?.Stage == TradeStage.Committed ? "The trade went through." : "The trade was called off.");
        await PadMenu.ShowAsync(_host, title, message, new PadOption("OK", IconPath: "confirm"));
        if (Navigation.NavigationStack.LastOrDefault() == this) await Navigation.PopAsync();
    }

    private void Render(TradeStep? step)
    {
        var view = step?.View;
        ShowOffer(view?.Mine, _mineSprite, _mineName, _mineFacts, "Nothing chosen yet");
        ShowOffer(view?.Theirs, _theirSprite, _theirName, _theirFacts, $"{_partnerName} is choosing…");
        _choose.IsVisible = view?.CanChoose ?? false;
        _choose.Text = view?.Mine is null ? "Choose a Pokémon" : "Choose another";
        _mineDetails.IsVisible = view?.Mine is not null;
        _theirDetails.IsVisible = view?.Theirs is not null;
        _confirm.IsEnabled = view?.CanConfirm ?? false;
        _cancel.IsEnabled = view?.CanCancel ?? false;
        _status.Text = view is null ? step?.Message ?? "Connecting…" : StatusOf(view);
    }

    private string StatusOf(TradeView view) => view.Stage switch
    {
        TradeStage.Choosing when view.Mine is null => "Choose the Pokémon you want to offer.",
        TradeStage.Choosing when view.Theirs is null => $"Waiting for {_partnerName} to choose…",
        TradeStage.Choosing => "Look at both Pokémon. Confirm when you are happy with the trade.",
        TradeStage.WaitingForPartner => $"You confirmed. Waiting for {_partnerName} to confirm…",
        TradeStage.PartnerConfirmed => $"{_partnerName} confirmed. Confirm to trade, or cancel.",
        TradeStage.Sealing => "Both confirmed. Trading…",
        TradeStage.Mismatch => "A Pokémon changed at the last moment, so this trade cannot go through. Cancel it and start again.",
        TradeStage.Committed => "Trade complete!",
        TradeStage.Cancelled => "The trade was called off.",
        _ => "",
    };

    private void ShowOffer(TradeOffer? offer, SpriteView sprite, Label name, Label facts, string empty)
    {
        if (offer is null)
        {
            sprite.Look = null;
            name.Text = "";
            facts.Text = empty;
            return;
        }
        sprite.Look = new SpriteLook(offer.Species, offer.Form, offer.Shiny);
        name.Text = offer.Shiny ? $"{offer.Nickname} ★" : offer.Nickname;
        var item = offer.HeldItem > 0 ? $" · holding {_storage.ItemName(offer.HeldItem)}" : "";
        facts.Text = $"Lv {offer.Level} · Gen {offer.Generation}{item}";
    }

    // ── Actions ──────────────────────────────────────────────────────────────

    private async Task ChooseAsync()
    {
        if (_last?.View is not { CanChoose: true })
        {
            await PadMenu.ShowAsync(_host, "Trade", "The Pokémon cannot change anymore: someone already confirmed.", "OK");
            return;
        }
        var entry = await BankPicker.PickAsync(_host, _bank, "Offer which Pokémon?",
            keep: e => EntityBytes.RomHackGame(e.Info.Format) is null);
        if (entry is null) return;
        await _social.SetOfferAsync(_tradeId, entry);
    }

    private async Task DetailsAsync(bool mine)
    {
        var offer = mine ? _last?.View?.Mine : _last?.View?.Theirs;
        if (offer is null) return;
        var bytes = SocialService.OfferBytes(offer);
        IReadOnlyList<string> lines = bytes is null ? ["This Pokémon's data could not be read."] : BankMonFacts.Describe(bytes, offer.Format);
        await PadMenu.ShowAsync(_host, offer.Nickname, string.Join("\n", lines), "OK");
    }

    private async Task ConfirmAsync()
    {
        if (_last?.View is not { CanConfirm: true } view || view.Theirs is null) return;
        if (!await PadMenu.ConfirmAsync(_host, "Confirm trade?",
                $"Trade your {view.Mine?.Nickname} for {_partnerName}'s {view.Theirs.Nickname}? After both of you confirm, it cannot be undone.",
                "Trade"))
            return;
        await _social.ConfirmAsync(_tradeId, view.Theirs);
    }

    private async Task CancelAsync()
    {
        if (_last?.View is { CanCancel: false, Stage: TradeStage.Sealing })
        {
            await PadMenu.ShowAsync(_host, "Trade", "Both of you confirmed: the trade is going through.", "OK");
            return;
        }
        if (!await PadMenu.ConfirmAsync(_host, "Cancel trade?", "Nobody gives anything away. Each Pokémon stays in its own Bank.", "Cancel trade"))
            return;
        var step = await _social.CancelAsync(_tradeId);
        await ShowStepAsync(step);
    }
}
