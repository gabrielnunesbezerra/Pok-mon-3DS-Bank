using PKForge.Domain;
using SkiaSharp;
using SkiaSharp.Views.Maui;

namespace PKForge.App.Views;

/// <summary>
/// The Arena's touch controls, drawn over the battle: a stick that appears under the left
/// thumb, the four move buttons (type color, cooldown filling back up) and the dodge button on
/// the right, and the two buttons of the result card.
/// </summary>
internal sealed class ArenaControls
{
    private readonly SKRect[] _moves = new SKRect[4];
    private SKRect _dodge;
    private SKRect _again;
    private SKRect _leave;
    private SKRect _view;
    private float _d = 1;
    private int _moveCount;
    private long? _stickId;
    private SKPoint _stickBase;
    private SKPoint _stickKnob;
    private readonly Dictionary<long, int> _held = [];
    private int _cast = -1;
    private bool _dodgeQueued;
    private bool _resultShown;
    private readonly SKPaint _paint = new() { IsAntialias = true };
    private readonly SKPaint _stroke = new() { IsAntialias = true, Style = SKPaintStyle.Stroke };

    public event Action? Again;
    public event Action? Leave;

    private float StickRadius => 62 * _d;

    /// <summary>The stick's direction and push (each axis -1 to 1).</summary>
    public (float X, float Y) Stick
    {
        get
        {
            if (_stickId is null) return (0, 0);
            var dx = (_stickKnob.X - _stickBase.X) / StickRadius;
            var dy = (_stickKnob.Y - _stickBase.Y) / StickRadius;
            var length = MathF.Sqrt(dx * dx + dy * dy);
            if (length < 0.15f) return (0, 0);
            if (length > 1) { dx /= length; dy /= length; }
            return (dx, dy);
        }
    }

    public void Reset()
    {
        _stickId = null;
        _held.Clear();
        _cast = -1;
        _dodgeQueued = false;
        _resultShown = false;
    }

    public int TakeCast() => Interlocked.Exchange(ref _cast, -1);

    public bool TakeDodge()
    {
        var queued = _dodgeQueued;
        _dodgeQueued = false;
        return queued;
    }

    public void Layout(SKRect view, float density, IReadOnlyList<ArenaMove> moves)
    {
        _view = view;
        _d = density;
        _moveCount = Math.Min(4, moves.Count);
        var width = 132 * _d;
        var height = 56 * _d;
        var gap = 10 * _d;
        var margin = 18 * _d;
        var x0 = view.Right - margin - 2 * width - gap;
        var y0 = view.Bottom - margin - 2 * height - gap;
        for (var i = 0; i < 4; i++)
            _moves[i] = SKRect.Create(x0 + (i % 2) * (width + gap), y0 + (i / 2) * (height + gap), width, height);
        var r = 38 * _d;
        _dodge = SKRect.Create(x0 - gap * 1.6f - 2 * r, view.Bottom - margin - 2 * r - height * 0.4f, 2 * r, 2 * r);
        var cardW = Math.Min(view.Width * 0.7f, 520 * _d);
        _again = SKRect.Create(view.MidX - cardW / 2 + 20 * _d, view.MidY + 40 * _d, cardW / 2 - 30 * _d, 54 * _d);
        _leave = SKRect.Create(view.MidX + 10 * _d, view.MidY + 40 * _d, cardW / 2 - 30 * _d, 54 * _d);
    }

    public void Touch(SKTouchEventArgs e)
    {
        var point = e.Location;
        switch (e.ActionType)
        {
            case SKTouchAction.Pressed:
                if (_resultShown)
                {
                    if (_again.Contains(point)) Again?.Invoke();
                    else if (_leave.Contains(point)) Leave?.Invoke();
                    return;
                }
                for (var i = 0; i < _moveCount; i++)
                    if (Grow(_moves[i]).Contains(point))
                    {
                        _cast = i;
                        _held[e.Id] = i;
                        return;
                    }
                if (Grow(_dodge).Contains(point))
                {
                    _dodgeQueued = true;
                    _held[e.Id] = 4;
                    return;
                }
                if (_stickId is null && point.X < _view.MidX + _view.Width * 0.1f)
                {
                    _stickId = e.Id;
                    _stickBase = point;
                    _stickKnob = point;
                }
                break;
            case SKTouchAction.Moved:
                if (_stickId == e.Id)
                {
                    var dx = point.X - _stickBase.X;
                    var dy = point.Y - _stickBase.Y;
                    var length = MathF.Sqrt(dx * dx + dy * dy);
                    var max = StickRadius * 1.6f;
                    if (length > max)
                    {
                        // The base follows a thumb that drifts far, so the stick never runs out.
                        _stickBase = new SKPoint(point.X - dx / length * max, point.Y - dy / length * max);
                    }
                    _stickKnob = point;
                }
                break;
            case SKTouchAction.Released or SKTouchAction.Cancelled:
                if (_stickId == e.Id) _stickId = null;
                _held.Remove(e.Id);
                break;
        }
    }

    private SKRect Grow(SKRect rect) => SKRect.Inflate(rect, 6 * _d, 6 * _d);

    public void Draw(SKCanvas c, ArenaFighter player)
    {
        // The stick.
        var center = _stickId is null ? new SKPoint(_view.Left + 120 * _d, _view.Bottom - 110 * _d) : _stickBase;
        var knob = _stickId is null ? center : _stickKnob;
        var dx = knob.X - center.X;
        var dy = knob.Y - center.Y;
        var length = MathF.Sqrt(dx * dx + dy * dy);
        if (length > StickRadius) knob = new SKPoint(center.X + dx / length * StickRadius, center.Y + dy / length * StickRadius);
        _paint.Color = new SKColor(255, 255, 255, (byte)(_stickId is null ? 22 : 40));
        c.DrawCircle(center, StickRadius, _paint);
        _stroke.Color = new SKColor(255, 255, 255, (byte)(_stickId is null ? 50 : 110));
        _stroke.StrokeWidth = 3 * _d;
        c.DrawCircle(center, StickRadius, _stroke);
        _paint.Color = new SKColor(255, 255, 255, (byte)(_stickId is null ? 60 : 170));
        c.DrawCircle(knob, 26 * _d, _paint);

        // The moves.
        for (var i = 0; i < _moveCount; i++)
        {
            var move = player.Moves[i];
            var rect = _moves[i];
            var color = ArenaRenderer.TypeColor(move.Type);
            var ready = player.Cooldowns[i] <= 0;
            var pressed = _held.ContainsValue(i);
            var shown = pressed ? SKRect.Inflate(rect, -3 * _d, -3 * _d) : rect;
            _paint.Color = ready ? color.WithAlpha(230) : new SKColor(60, 60, 70, 210);
            c.DrawRoundRect(shown, 12 * _d, 12 * _d, _paint);
            if (!ready)
            {
                var fill = 1 - Math.Clamp(player.Cooldowns[i] / move.Cooldown, 0, 1);
                c.Save();
                c.ClipRoundRect(new SKRoundRect(shown, 12 * _d), antialias: true);
                _paint.Color = color.WithAlpha(150);
                c.DrawRect(new SKRect(shown.Left, shown.Bottom - shown.Height * fill, shown.Right, shown.Bottom), _paint);
                c.Restore();
            }
            _stroke.Color = SKColors.White.WithAlpha(ready ? (byte)230 : (byte)120);
            _stroke.StrokeWidth = 2.5f * _d;
            c.DrawRoundRect(shown, 12 * _d, 12 * _d, _stroke);
            var name = move.Name.Length > 13 ? move.Name[..12] + "." : move.Name;
            using var font = PixelFont.For(name, 17 * _d);
            _paint.Color = new SKColor(0, 0, 0, 120);
            c.DrawText(name, shown.MidX + 1.5f * _d, shown.MidY + 1.5f * _d, SKTextAlign.Center, font, _paint);
            _paint.Color = SKColors.White;
            c.DrawText(name, shown.MidX, shown.MidY, SKTextAlign.Center, font, _paint);
            using var small = PixelFont.For("x", 11 * _d);
            var detail = ready
                ? $"{ArenaTypes.Names[move.Type].ToUpperInvariant()} · {(move.Category == MoveCategory.Status ? "STATUS" : $"POW {move.Power}")}"
                : $"{player.Cooldowns[i]:0.0}s";
            _paint.Color = new SKColor(255, 255, 255, 210);
            c.DrawText(detail, shown.MidX, shown.MidY + 17 * _d, SKTextAlign.Center, small, _paint);
        }

        // The dodge.
        var dodgeReady = player.DodgeCooldown <= 0;
        _paint.Color = dodgeReady ? new SKColor(240, 240, 250, 210) : new SKColor(90, 90, 100, 190);
        c.DrawOval(_dodge, _paint);
        _stroke.Color = new SKColor(30, 30, 40, 200);
        _stroke.StrokeWidth = 2.5f * _d;
        c.DrawOval(_dodge, _stroke);
        using (var font = PixelFont.For("DODGE", 14 * _d))
        {
            _paint.Color = new SKColor(30, 30, 40);
            c.DrawText("DODGE", _dodge.MidX, _dodge.MidY + 5 * _d, SKTextAlign.Center, font, _paint);
        }
    }

    public void DrawResult(SKCanvas c, SKRect view, string title, string detail, bool won, float appear)
    {
        _resultShown = appear >= 1;
        _paint.Color = new SKColor(0, 0, 0, (byte)(150 * appear));
        c.DrawRect(view, _paint);
        var cardW = Math.Min(view.Width * 0.7f, 520 * _d);
        var card = SKRect.Create(view.MidX - cardW / 2, view.MidY - 120 * _d + (1 - appear) * 40 * _d, cardW, 230 * _d);
        _paint.Color = new SKColor(24, 26, 40, (byte)(240 * appear));
        c.DrawRoundRect(card, 18 * _d, 18 * _d, _paint);
        _stroke.Color = (won ? new SKColor(255, 210, 90) : new SKColor(240, 90, 80)).WithAlpha((byte)(255 * appear));
        _stroke.StrokeWidth = 4 * _d;
        c.DrawRoundRect(card, 18 * _d, 18 * _d, _stroke);
        using (var font = PixelFont.For(title, 48 * _d))
        {
            _paint.Color = _stroke.Color;
            c.DrawText(title, card.MidX, card.Top + 62 * _d, SKTextAlign.Center, font, _paint);
        }
        using (var font = PixelFont.For(detail, 15 * _d))
        {
            _paint.Color = new SKColor(230, 230, 240, (byte)(255 * appear));
            var lines = Wrap(detail, font, card.Width - 40 * _d);
            for (var i = 0; i < lines.Count; i++)
                c.DrawText(lines[i], card.MidX, card.Top + 98 * _d + i * 20 * _d, SKTextAlign.Center, font, _paint);
        }
        Button(c, _again, "Fight again", new SKColor(90, 200, 110), appear);
        Button(c, _leave, "Leave", new SKColor(110, 110, 130), appear);
    }

    private void Button(SKCanvas c, SKRect rect, string text, SKColor color, float appear)
    {
        _paint.Color = color.WithAlpha((byte)(255 * appear));
        c.DrawRoundRect(rect, 12 * _d, 12 * _d, _paint);
        using var font = PixelFont.For(text, 18 * _d);
        _paint.Color = SKColors.White.WithAlpha((byte)(255 * appear));
        c.DrawText(text, rect.MidX, rect.MidY + 6 * _d, SKTextAlign.Center, font, _paint);
    }

    private static List<string> Wrap(string text, SKFont font, float width)
    {
        var lines = new List<string>();
        var line = "";
        foreach (var word in text.Split(' '))
        {
            var test = line.Length == 0 ? word : $"{line} {word}";
            if (font.MeasureText(test) > width && line.Length > 0)
            {
                lines.Add(line);
                line = word;
            }
            else line = test;
        }
        if (line.Length > 0) lines.Add(line);
        return lines;
    }
}
