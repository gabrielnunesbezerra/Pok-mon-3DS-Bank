using Microsoft.Maui.Controls.Shapes;
using PKForge.App.Services;
using PKForge.App.Theme;
using PKForge.Domain;

namespace PKForge.App.Views;

/// <summary>An entry in a <see cref="PickerMenu"/>: id, display name, optional icon file,
/// optional detail under the name (a nature's "+Atk −SpA", a move's numbers, an item's
/// effect). The init-only extras draw the shared <see cref="InfoKit"/> pieces on the row:
/// a type badge, the move category icon, a right-hand tag ("Lv 32", "HIDDEN") and a muted
/// name for entries outside the legal set.</summary>
public sealed record PickItem(int Id, string Name, string? IconPath = null, string? Detail = null)
{
    public int? TypeId { get; init; }
    public MoveCategory? Category { get; init; }
    public string? Tag { get; init; }
    public Color? TagColor { get; init; }
    public bool Muted { get; init; }
    /// <summary>Search also matches this text (a move's type, an ability's slot).</summary>
    public string? Keywords { get; init; }
}

/// <summary>
/// A two-state list filter with its own chip and the Y button ("Legal only" / "Show all").
/// <paramref name="Keep"/> decides which items the filtered state shows.
/// </summary>
public sealed record PickerFilter(string OnLabel, string OffLabel, Func<PickItem, bool> Keep, bool StartOn = true);

/// <summary>
/// A live panel under a picker's list that follows the highlighted row (the nature
/// picker's stat preview). With a panel, a tap highlights instead of picking so touch
/// users see the preview too; tapping the highlighted row again (or A) picks it.
/// </summary>
public sealed record PickerPreview(View Panel, Action<PickItem?> OnHighlight);

/// <summary>
/// The searchable choice window for big lists (species, moves, items…).
/// Touch: type in the search box, tap a row. Pad: d-pad moves the gold highlight,
/// A chooses, B cancels. Owns the gamepad while open.
/// </summary>
public sealed class PickerMenu : IPadHandler
{
    // Show enough that a gamepad user (no touch keyboard) can d-pad to any entry; the
    // CollectionView virtualizes, so a larger cap is cheap.
    private const int MaxVisible = 1200;
    private const double PreviewWidth = 280; // the preview card's column beside the list
    private const double SideBySideWidth = 700; // the narrowest host that fits both columns

    private readonly TaskCompletionSource<PickItem?> _result = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly IReadOnlyList<PickItem> _all;
    private readonly Grid _host;
    private readonly Grid _overlay;
    private readonly GamepadRouter? _router;
    private readonly CollectionView _list;
    private readonly Label _preview;
    private readonly PickerPreview? _livePreview;
    private readonly PickerFilter? _filter;
    private readonly Label? _filterLabel;
    private bool _filterOn;
    // Lists of moves can be cut to one type (X): every type present in the list is offered.
    private readonly bool _hasTypes;
    private int? _typeFilter;
    private Label? _typeLabel;
    private Border? _typeChip;
    private string _query = "";
    private List<PickItem> _filtered;
    private int _index;

    public static Task<PickItem?> ShowAsync(Grid host, string title, IReadOnlyList<PickItem> items, int? currentId = null,
        PickerPreview? preview = null, PickerFilter? filter = null) =>
        new PickerMenu(host, title, items, currentId, preview, filter)._result.Task;

    private PickerMenu(Grid host, string title, IReadOnlyList<PickItem> items, int? currentId, PickerPreview? livePreview,
        PickerFilter? filter)
    {
        _host = host;
        _all = items;
        _livePreview = livePreview;
        _filter = filter;
        // The current value always stays reachable: a filter that would hide it starts off.
        _filterOn = filter is not null && filter.StartOn
            && (currentId is not { } cur || items.FirstOrDefault(x => x.Id == cur) is not { } held || filter.Keep(held));
        _hasTypes = items.Count(x => x.TypeId is not null) > 1;
        _filtered = Filter("");
        _router = IPlatformApplication.Current?.Services.GetService<GamepadRouter>();

        var search = Kit.TextField();
        search.Placeholder = "Search…";
        search.TextChanged += (_, args) =>
        {
            _query = args.NewTextValue ?? "";
            Refilter(keepId: null);
        };

        // The filter chip rides beside the search box; Y toggles it on the pad.
        View searchRow = search;
        if (filter is not null)
        {
            _filterLabel = new Label
            {
                FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextLabel,
                VerticalTextAlignment = TextAlignment.Center, LineBreakMode = LineBreakMode.NoWrap,
            };
            // A toggle in the menu-button language (resting / active), not an outline pill.
            var chip = Kit.Tab("");
            chip.Content = _filterLabel;
            chip.Padding = new Thickness(12, 0);
            var tap = new TapGestureRecognizer();
            tap.Tapped += (_, _) => ToggleFilter();
            chip.GestureRecognizers.Add(tap);
            _filterChip = chip;
            var row = new Grid { ColumnSpacing = 8, ColumnDefinitions = [new(GridLength.Star), new(GridLength.Auto)], Children = { search, chip } };
            Grid.SetColumn(chip, 1);
            searchRow = row;
            PaintFilterChip();
        }
        if (_hasTypes)
        {
            _typeLabel = new Label
            {
                FontFamily = DsChrome.PixelFont, FontSize = UiTokens.TextLabel,
                VerticalTextAlignment = TextAlignment.Center, LineBreakMode = LineBreakMode.NoWrap,
            };
            var chip = Kit.Tab("");
            chip.Content = _typeLabel;
            chip.Padding = new Thickness(12, 0);
            var tap = new TapGestureRecognizer();
            tap.Tapped += (_, _) => _ = ChooseTypeAsync();
            chip.GestureRecognizers.Add(tap);
            _typeChip = chip;
            var row = new Grid { ColumnSpacing = 8, ColumnDefinitions = [new(GridLength.Star), new(GridLength.Auto)], Children = { searchRow, chip } };
            Grid.SetColumn(chip, 1);
            searchRow = row;
            PaintTypeChip();
        }

        _list = new CollectionView
        {
            SelectionMode = SelectionMode.Single,
            ItemsSource = _filtered,
            ItemTemplate = new DataTemplate(() => BuildRow(this)),
        };
        _list.SelectionChanged += (_, args) =>
        {
            // The pad only moves the highlight; taps are the rows' own (OnRowTapped), since the
            // list reports nothing for a tap on the row that is already selected.
            if (_padSelecting) { _padSelecting = false; UpdatePreview(); }
        };

        // The list is the Star row so it fills the host-capped window and scrolls itself -
        // never a fixed 340 that pushed the title and hint bar off a 360dp screen.
        _preview = new Label
        {
            TextColor = UiTokens.Ink0,
            FontFamily = DsChrome.PixelFont,
            FontSize = UiTokens.TextLabel,
            HorizontalTextAlignment = TextAlignment.Center,
            VerticalTextAlignment = TextAlignment.Center,
            LineBreakMode = LineBreakMode.TailTruncation,
        };
        var hintList = new List<(string, string, Action?)> { ("A", "PICK", livePreview is null ? null : PickHighlighted) };
        if (_hasTypes) hintList.Add(("X", "Type", () => _ = ChooseTypeAsync()));
        if (filter is not null) hintList.Add(("Y", "Filter", ToggleFilter));
        hintList.Add(("B", "Cancel", () => Close(null)));
        var hints = Kit.WindowHints([.. hintList]);
        var previewBar = Kit.Well(_preview, padding: 4);
        previewBar.Padding = new Thickness(10, 4);
        // The selected-item preview used to be layered over the controller hints in a
        // single grid cell. Keep both useful pad affordances, but give each its own row.
        var hintRow = new VerticalStackLayout
        {
            Spacing = 4,
            Padding = new Thickness(0, 3, 0, 0),
            Children = { previewBar, hints },
        };
        // On a wide screen the preview card sits beside the list so the list keeps the full
        // height; on a narrow one it goes under the list, above the hints.
        var side = livePreview is not null && host.Width >= SideBySideWidth;
        View body = _list;
        if (livePreview is not null && side)
        {
            livePreview.Panel.VerticalOptions = LayoutOptions.Start;
            var columns = new Grid
            {
                ColumnSpacing = 12,
                ColumnDefinitions = [new(GridLength.Star), new(new GridLength(PreviewWidth))],
                Children = { _list, livePreview.Panel },
            };
            Grid.SetColumn(livePreview.Panel, 1);
            body = columns;
        }
        else if (livePreview is not null)
            hintRow.Children.Insert(0, livePreview.Panel);

        var content = new Grid
        {
            RowSpacing = 10,
            VerticalOptions = LayoutOptions.Fill,
            RowDefinitions = [new(GridLength.Auto), new(GridLength.Auto), new(GridLength.Star), new(GridLength.Auto)],
            Children =
            {
                Kit.HeaderBar(Kit.Tidy(title)),
                searchRow,
                body,
                hintRow,
            },
        };
        Grid.SetRow(searchRow, 1);
        Grid.SetRow(body, 2);
        Grid.SetRow(hintRow, 3);

        var window = Kit.OverlayWindow(host, content, preferredMaxWidth: side ? 520 + PreviewWidth + 12 : 520, scroll: false);
        _overlay = Kit.AttachOverlay(host, window, () => Close(null));
        search.Unfocus(); // the pad drives first; touch users tap the box to type

        if (currentId is { } id)
        {
            var current = _filtered.FindIndex(x => x.Id == id);
            if (current >= 0) _index = current;
        }
        HighlightCurrent();
        _router?.Push(this);
    }

    private static View BuildRow(PickerMenu tapOwner)
    {
        var icon = new Image { WidthRequest = 26, HeightRequest = 26, IsVisible = false, VerticalOptions = LayoutOptions.Center };
        icon.SetBinding(Image.SourceProperty, new Binding(nameof(PickItem.IconPath)));
        icon.SetBinding(VisualElement.IsVisibleProperty, new Binding(nameof(PickItem.IconPath), converter: NotNull));

        var name = new Label { TextColor = UiTokens.Ink0, FontFamily = DsChrome.PixelFont, FontSize = 15, VerticalTextAlignment = TextAlignment.Center, LineBreakMode = LineBreakMode.TailTruncation };
        name.SetBinding(Label.TextProperty, nameof(PickItem.Name));
        // Two lines at most: enough for an item or ability effect, still a scannable list.
        var detail = new Label
        {
            TextColor = UiTokens.InkSoft, FontSize = UiTokens.TextSmall, IsVisible = false, MaxLines = 2,
            LineBreakMode = LineBreakMode.TailTruncation, VerticalTextAlignment = TextAlignment.Center,
        };
        detail.SetBinding(Label.TextProperty, nameof(PickItem.Detail));
        detail.SetBinding(VisualElement.IsVisibleProperty, new Binding(nameof(PickItem.Detail), converter: NotNull));
        var text = new VerticalStackLayout { Spacing = 0, VerticalOptions = LayoutOptions.Center, Children = { name, detail } };

        // Badge column: the type pill over the category icon, both hidden when unused.
        var badge = InfoKit.TypeBadge(null, 58);
        var category = new InfoKit.CategoryIcon { HorizontalOptions = LayoutOptions.Center };
        var badges = new VerticalStackLayout { Spacing = 2, VerticalOptions = LayoutOptions.Center, Children = { badge, category } };
        var tag = InfoKit.Tag();

        var row = new Grid
        {
            ColumnSpacing = 10,
            Padding = new Thickness(10, 7),
            ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Auto), new(GridLength.Star), new(GridLength.Auto)],
            Children = { icon, badges, text, tag },
        };
        Grid.SetColumn(badges, 1);
        Grid.SetColumn(text, 2);
        Grid.SetColumn(tag, 3);
        row.BindingContextChanged += (_, _) =>
        {
            var item = row.BindingContext as PickItem;
            InfoKit.SetType(badge, item?.TypeId);
            category.Category = item?.Category;
            badges.IsVisible = badge.IsVisible || category.IsVisible;
            InfoKit.SetTag(tag, item?.Tag, item?.TagColor);
            name.TextColor = item?.Muted == true ? UiTokens.InkSoft : UiTokens.Ink0;
            row.Opacity = item?.Muted == true ? 0.72 : 1;
        };

        // A flat list row: soft stripe resting, the selected-button look when highlighted.
        var cell = new Border
        {
            BackgroundColor = UiTokens.RowStripe,
            StrokeThickness = 1.2,
            Stroke = Colors.Transparent,
            StrokeShape = new RoundRectangle { CornerRadius = UiTokens.ControlRadius },
            Margin = new Thickness(0, 0, 0, 3),
            Content = row,
        };
        var tap = new TapGestureRecognizer();
        tap.Tapped += (_, _) => { if (cell.BindingContext is PickItem item) tapOwner.OnRowTapped(item); };
        cell.GestureRecognizers.Add(tap);
        VisualStateManager.SetVisualStateGroups(cell, new VisualStateGroupList
        {
            new VisualStateGroup
            {
                Name = "CommonStates",
                States =
                {
                    new VisualState { Name = "Normal", Setters = { new Setter { Property = Border.StrokeProperty, Value = Colors.Transparent } } },
                    new VisualState { Name = "Selected", Setters = {
                        new Setter { Property = Border.StrokeProperty, Value = UiTokens.Rim },
                        new Setter { Property = Border.BackgroundColorProperty, Value = UiTokens.SelectFill } } },
                },
            },
        });
        return cell;
    }

    private static readonly IValueConverter NotNull = new NotNullConverter();

    private sealed class NotNullConverter : IValueConverter
    {
        public object Convert(object? value, Type targetType, object? parameter, System.Globalization.CultureInfo culture) => value is not null;
        public object ConvertBack(object? value, Type targetType, object? parameter, System.Globalization.CultureInfo culture) => throw new NotSupportedException();
    }

    private List<PickItem> Filter(string query)
    {
        IEnumerable<PickItem> source = _all;
        if (_filterOn && _filter is not null) source = source.Where(_filter.Keep);
        if (_typeFilter is { } type) source = source.Where(x => x.Id == 0 || x.TypeId == type);
        if (!string.IsNullOrWhiteSpace(query))
            source = source.Where(x => x.Name.Contains(query, StringComparison.OrdinalIgnoreCase)
                                       || (x.Keywords?.Contains(query, StringComparison.OrdinalIgnoreCase) ?? false));
        return source.Take(MaxVisible).ToList();
    }

    private Border? _filterChip;

    private void ToggleFilter()
    {
        if (_filter is null) return;
        var keep = _index >= 0 && _index < _filtered.Count ? _filtered[_index].Id : (int?)null;
        _filterOn = !_filterOn;
        PaintFilterChip();
        Refilter(keep);
    }

    /// <summary>Cuts the list to one type, picked from the types the list holds.</summary>
    private async Task ChooseTypeAsync()
    {
        if (!_hasTypes) return;
        const string All = "All types";
        var types = _all.Where(x => x.TypeId is not null).Select(x => x.TypeId!.Value).Distinct().Order().ToList();
        var options = new List<PadOption> { new(All, IconPath: "all") };
        options.AddRange(types.Select(t => new PadOption(TypeFacts.Name(t), Glyph: "●", Accent: InfoKit.TypeColor(t))));
        var choice = await PadMenu.ShowAsync(_host, "Move type", null, [.. options]);
        if (choice is null) return;
        var keep = _index >= 0 && _index < _filtered.Count ? _filtered[_index].Id : (int?)null;
        _typeFilter = choice == All ? null : types.FirstOrDefault(t => TypeFacts.Name(t) == choice, -1) is var found and >= 0 ? found : null;
        PaintTypeChip();
        Refilter(keep);
    }

    private void PaintTypeChip()
    {
        if (_typeChip is null || _typeLabel is null) return;
        _typeLabel.Text = _typeFilter is { } t ? $"✓ {TypeFacts.Name(t)}" : "Type: All";
        Kit.SetTab(_typeChip, _typeFilter is not null, _typeFilter is { } type ? InfoKit.TypeColor(type) : null);
        _typeLabel.TextColor = _typeFilter is not null ? UiTokens.SelectInk : UiTokens.Ink0;
    }

    private void PaintFilterChip()
    {
        if (_filter is null || _filterChip is null || _filterLabel is null) return;
        _filterLabel.Text = _filterOn ? $"✓ {_filter.OnLabel}" : _filter.OffLabel;
        Kit.SetTab(_filterChip, _filterOn);
        _filterLabel.TextColor = _filterOn ? UiTokens.SelectInk : UiTokens.Ink0;
    }

    /// <summary>Rebuilds the visible list, keeping the highlight on <paramref name="keepId"/> when it survives.</summary>
    private void Refilter(int? keepId)
    {
        _filtered = Filter(_query);
        _index = keepId is { } id ? Math.Max(0, _filtered.FindIndex(x => x.Id == id)) : 0;
        _list.ItemsSource = _filtered;
        HighlightCurrent();
    }

    public bool OnPadButton(PadButton button)
    {
        switch (button)
        {
            case PadButton.Up: Move(-1); return true;
            case PadButton.Down: Move(1); return true;
            case PadButton.A: PickHighlighted(); return true;
            case PadButton.B: Close(null); return true;
            case PadButton.Y: ToggleFilter(); return true;
            case PadButton.X: _ = ChooseTypeAsync(); return true;
            default: return true; // the picker owns the pad while open
        }
    }

    private void Move(int delta)
    {
        if (_filtered.Count == 0) return;
        _index = Math.Clamp(_index + delta, 0, _filtered.Count - 1);
        HighlightCurrent();
    }

    private bool _padSelecting;
    private bool _armed; // preview mode: the highlighted row was aimed by a tap

    /// <summary>
    /// A tap picks the row at once; in preview mode the first tap aims (the panel follows) and
    /// a second tap on the same row picks.
    /// </summary>
    private void OnRowTapped(PickItem item)
    {
        var tapped = _filtered.IndexOf(item);
        if (tapped < 0) return;
        if (_livePreview is null) { Close(item); return; }
        if (tapped == _index && _armed) { Close(item); return; }
        _index = tapped;
        HighlightCurrent(scroll: false);
        _armed = true;
    }

    private void PickHighlighted()
    {
        if (_index >= 0 && _index < _filtered.Count) Close(_filtered[_index]);
    }

    private void HighlightCurrent(bool scroll = true)
    {
        if (_filtered.Count == 0) return;
        _index = Math.Clamp(_index, 0, _filtered.Count - 1);
        _armed = false;
        // Only a real change raises SelectionChanged; a flag set for no event would swallow the next tap.
        var target = _filtered[_index];
        if (!Equals(_list.SelectedItem, target))
        {
            _padSelecting = true;
            _list.SelectedItem = target;
        }
        if (scroll) _list.ScrollTo(_index, position: ScrollToPosition.Center, animate: false);
        UpdatePreview();
    }

    /// <summary>The hint line always says what A will pick, so pad aim can be misread but never mispurchased.</summary>
    private void UpdatePreview()
    {
        var current = _index >= 0 && _index < _filtered.Count ? _filtered[_index] : null;
        if (current is not null)
            _preview.Text = _livePreview is null ? $"A picks: {current.Name}" : $"A or tap again picks: {current.Name}";
        _livePreview?.OnHighlight(current);
    }

    private void Close(PickItem? result)
    {
        if (_router is not null) _router.Remove(this);
        _host.Remove(_overlay);
        _result.TrySetResult(result);
    }
}
