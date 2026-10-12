using PKForge.App.Services;
using PKForge.App.Theme;

namespace PKForge.App.Views;

/// <summary>
/// The About window: version, authorship, and credits, in the same paper-panel
/// chrome as the trainer card. Gamepad-native: B or the CLOSE capsule dismisses.
/// </summary>
public static class AboutPopup
{

    public static Task ShowAsync(Grid host)
    {
        var result = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var version = AppInfo.Current.VersionString;
        var diagnostic = AppInfo.Current.PackageName?.EndsWith(".debug", StringComparison.OrdinalIgnoreCase) == true;

        View Row(string caption, string value)
        {
            var valueLabel = new Label
            {
                Text = value,
                FontSize = 14,
                FontFamily = DsChrome.PixelFont,
                TextColor = UiTokens.Ink0,
                VerticalTextAlignment = TextAlignment.Center,
            };
            var grid = new Grid
            {
                ColumnSpacing = 8,
                ColumnDefinitions = [new(new GridLength(140)), new(GridLength.Star)],
                Children =
                {
                    new Label { Text = caption, FontSize = UiTokens.TextSmall, FontFamily = DsChrome.PixelFont, FontAttributes = FontAttributes.Bold, TextColor = UiTokens.InkSoft, VerticalTextAlignment = TextAlignment.Center },
                    valueLabel,
                },
            };
            Grid.SetColumn(valueLabel, 1);
            return grid;
        }

        Grid overlay = null!;
        PadOverlay pad = null!;
        void Close()
        {
            host.Remove(overlay);
            pad?.Dispose();
            result.TrySetResult();
        }

        var close = Kit.Capsule("Close", UiTokens.Ink1);
        close.Clicked += (_, _) => Close();

        Label Small(string text, Color? color = null) => new()
        {
            Text = text,
            FontSize = UiTokens.TextSmall,
            FontFamily = DsChrome.PixelFont,
            TextColor = color ?? UiTokens.InkSoft,
            HorizontalTextAlignment = TextAlignment.Center,
        };

        var content = new VerticalStackLayout
        {
            Spacing = 10,
            Children =
            {
                Kit.HeaderBar("About PKForge"),
                new Label { Text = "PKForge", FontSize = 20, FontAttributes = FontAttributes.Bold, FontFamily = DsChrome.PixelFont, TextColor = UiTokens.Ink0, HorizontalTextAlignment = TextAlignment.Center },
                Small("Pokémon save manager and bank"),
                Row("Version", diagnostic ? $"v{version} · diagnostic" : $"v{version}"),
                Row("Developed by", "@22sh"),
                Row("Design by", "@spritedmistery"),
                Small("Engine PKHeX · chrome PKSM (GPL-3)"),
                Small("Sprites © Nintendo · Creatures · Game Freak"),
                Small("github.com/sofianeelhor/pkforge", UiTokens.MenuBlue),
                new HorizontalStackLayout { Spacing = 8, HorizontalOptions = LayoutOptions.End, Children = { close } },
            },
        };

        var source = ThemeLogo.Source();
        if (source is not null)
        {
            content.Children.Insert(1, new Image
            {
                Source = source,
                HeightRequest = 112,
                WidthRequest = 112,
                Aspect = Aspect.AspectFit,
                HorizontalOptions = LayoutOptions.Center,
            });
        }

        var window = Kit.OverlayWindow(host, content, preferredMaxWidth: 420);
        overlay = Kit.AttachOverlay(host, window, () => Close());
        // ↑↑↓↓←→←→ B A plays the easter egg. B and A keep closing the window unless they
        // finish the code.
        PadButton[] konami = [PadButton.Up, PadButton.Up, PadButton.Down, PadButton.Down,
            PadButton.Left, PadButton.Right, PadButton.Left, PadButton.Right, PadButton.B, PadButton.A];
        var entered = 0;
        bool Konami(PadButton button)
        {
            if (button == konami[entered]) entered++;
            else entered = button != PadButton.Up ? 0 : entered == 2 ? 2 : 1; // ↑↑↑ still has ↑↑
            if (entered == konami.Length)
            {
                entered = 0;
                _ = BadAppleEgg.PlayAsync(host);
                return true;
            }
            return entered >= konami.Length - 1; // the code's B: it does not close
        }
        pad = new PadOverlay(() => Close(), () => Close(), Konami);
        return result.Task;
    }
}
