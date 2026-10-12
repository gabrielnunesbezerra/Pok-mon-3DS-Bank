using System.Globalization;
using PKForge.Domain;

namespace PKForge.App.Services;

/// <summary>
/// The app's language: English (the text in the code) or Português (Brasil), translated at
/// display time from Resources/I18n/pt-BR.tsv. The choice lives in Settings; until the player
/// picks one, the phone's language decides. Only what reaches the screen changes, so menus and
/// logic keep comparing the same English text.
/// </summary>
public static class Lang
{
    private const string Key = "app_language";
    public const string Portuguese = "pt";
    public const string English = "en";

    private static readonly Lazy<Translator> Table = new(Load);

    // Labels whose text is already translated (typewriter dialogue shows it a letter at a time).
    private static readonly System.Runtime.CompilerServices.ConditionalWeakTable<BindableObject, object> RawViews = new();

    /// <summary>Marks a view whose text the code translates itself, so the display hook leaves it alone.</summary>
    public static TView Raw<TView>(TView view) where TView : BindableObject
    {
        RawViews.AddOrUpdate(view, Portuguese);
        return view;
    }

    /// <summary>The saved choice: "pt", "en", or empty to follow the phone.</summary>
    public static string Setting => Preferences.Default.Get(Key, "");

    /// <summary>True while the app shows Portuguese.</summary>
    public static bool IsPortuguese { get; private set; } = Resolve(Preferences.Default.Get(Key, ""));

    /// <summary>The language's own name, for the settings line.</summary>
    public static string CurrentName => IsPortuguese ? "Português" : "English";

    public static void Set(string code)
    {
        Preferences.Default.Set(Key, code);
        IsPortuguese = Resolve(code);
    }

    private static bool Resolve(string code) =>
        (code.Length == 0 ? CultureInfo.CurrentUICulture.TwoLetterISOLanguageName : code) == Portuguese;

    /// <summary>The text in the current language.</summary>
    public static string T(string? text) =>
        IsPortuguese && !string.IsNullOrEmpty(text) ? Table.Value.Translate(text) : text ?? string.Empty;

    private static Translator Load()
    {
        try
        {
            using var stream = typeof(Lang).Assembly.GetManifestResourceStream("i18n.pt-BR.tsv");
            if (stream is null) return Translator.Parse("");
            using var reader = new StreamReader(stream);
            return Translator.Parse(reader.ReadToEnd());
        }
        catch (Exception error)
        {
            AppLog.Warn("lang", $"Translation table: {error.Message}");
            return Translator.Parse("");
        }
    }

    /// <summary>
    /// Translates every Label, Button and Entry placeholder as it is shown, and every text the
    /// pixel chrome draws on canvases. Called once, after the MAUI app is built.
    /// </summary>
    public static void Install()
    {
        PKForge.Chrome.PksmPaint.Localize = T;
#if ANDROID
        foreach (var key in new[] { nameof(Label.Text), nameof(Label.TextTransform), nameof(Label.TextType) })
        {
            Microsoft.Maui.Handlers.LabelHandler.Mapper.ModifyMapping(key, (handler, view, previous) =>
            {
                previous?.Invoke(handler, view);
                if (!IsPortuguese || view is not Label { FormattedText: null, TextType: TextType.Text } label
                    || string.IsNullOrEmpty(label.Text) || handler.PlatformView is null || RawViews.TryGetValue(label, out _))
                    return;
                var shown = T(label.Text);
                if (!string.Equals(shown, label.Text, StringComparison.Ordinal))
                    handler.PlatformView.Text = Transform(shown, label.TextTransform);
            });
        }
        foreach (var key in new[] { nameof(Button.Text), nameof(Button.TextTransform) })
        {
            Microsoft.Maui.Handlers.ButtonHandler.Mapper.ModifyMapping(key, (handler, view, previous) =>
            {
                previous?.Invoke(handler, view);
                if (!IsPortuguese || view is not Button button || string.IsNullOrEmpty(button.Text) || handler.PlatformView is null
                    || RawViews.TryGetValue(button, out _))
                    return;
                var shown = T(button.Text);
                if (!string.Equals(shown, button.Text, StringComparison.Ordinal))
                    handler.PlatformView.Text = Transform(shown, button.TextTransform);
            });
        }
        Microsoft.Maui.Handlers.EntryHandler.Mapper.ModifyMapping(nameof(Entry.Placeholder), (handler, view, previous) =>
        {
            previous?.Invoke(handler, view);
            if (!IsPortuguese || view is not Entry entry || string.IsNullOrEmpty(entry.Placeholder) || handler.PlatformView is null)
                return;
            var shown = T(entry.Placeholder);
            if (!string.Equals(shown, entry.Placeholder, StringComparison.Ordinal))
                handler.PlatformView.Hint = shown;
        });
#endif
    }

    private static string Transform(string text, TextTransform transform) => transform switch
    {
        TextTransform.Uppercase => text.ToUpperInvariant(),
        TextTransform.Lowercase => text.ToLowerInvariant(),
        _ => text,
    };
}
