using PKForge.App.Services;
using PKForge.Domain;
using SkiaSharp;

namespace PKForge.App.Views;

/// <summary>A deterministic little world: the same scene paints the park and widget frames.</summary>
public sealed class PokeparkScene(ISpriteService sprites, PokeparkSpriteService walking)
{
    private readonly System.Runtime.CompilerServices.ConditionalWeakTable<SKBitmap, FrameBounds> _visibleBounds = new();
    private readonly Dictionary<string, SKBitmap?> _environment = new(StringComparer.Ordinal);
    private readonly Dictionary<string, SKImage> _environmentImages = new(StringComparer.Ordinal);
    private readonly Dictionary<string, Lazy<Task>> _environmentLoads = new(StringComparer.Ordinal);
    private readonly object _environmentGate = new();
    private readonly Dictionary<(string Id, int Map), ResidentRoute> _routes = new();
    private sealed class ResidentRoute(ParkWander wander, bool animated)
    {
        public ParkWander Wander { get; } = wander;
        public bool Animated { get; } = animated;
        public long? Started { get; set; }
    }
    private int _environmentIndex;
    private float _drawWidth = 480, _drawHeight = 270;
    public static SKRect Viewport(float width, float height)
    {
        // The host is sized to the map's 16:9 surface by the page. Keep a
        // strict contain fit so no bezel/background leaks into the scene.
        var scale = Math.Min(width / ParkMap.Width, height / ParkMap.Height);
        var w = ParkMap.Width * scale; var h = ParkMap.Height * scale;
        return SKRect.Create((width - w) / 2, (height - h) / 2, w, h);
    }

    private IReadOnlyList<ParkPokemon> _residents = [];
    private readonly Dictionary<string, ParkInteraction> _interactions = new();
    public IReadOnlyList<ParkPokemon> Residents
    {
        get => _residents;
        set
        {
            _residents = value;
            _routes.Clear();
            var ids = value.Select(mon => mon.Id).ToHashSet();
            foreach (var id in _interactions.Keys.Where(id => !ids.Contains(id)).ToArray()) _interactions.Remove(id);
        }
    }

    public int SelectedIndex { get; set; } = -1;
    public int EnvironmentIndex
    {
        get => _environmentIndex;
        set => _environmentIndex = Math.Clamp(value, 0, 3);
    }
    public string EnvironmentName => ParkEnvironment.Get((ParkEnvironmentId)EnvironmentIndex).Name;
    public void Greet(int index, long time) => Interact(index, time, "Talk");
    public void Interact(int index, long time, string action)
    {
        if (index < 0 || index >= Residents.Count) return;
        var id = Residents[index].Id;
        if (!_interactions.TryGetValue(id, out var interaction))
            _interactions[id] = interaction = new ParkInteraction();
        interaction.Begin(time, action);
    }
    public ParkResidentState GetResidentState(int index, long time)
    {
        ParkInteraction? interaction = null;
        if (index >= 0 && index < Residents.Count) _interactions.TryGetValue(Residents[index].Id, out interaction);
        if (index < 0 || index >= Residents.Count) return default;
        var mon = Residents[index];
        var key = (mon.Id, EnvironmentIndex);
        var types = HabitatCatalog.TypesFor(mon.Species, mon.Form);
        if (!_routes.TryGetValue(key, out var route))
        {
            var allowed = ParkTraversal.Land;
            if (types.Contains(ParkType.Water)) allowed |= ParkTraversal.Water;
            if (types.Contains(ParkType.Fire)) allowed |= ParkTraversal.Lava;
            if (types.Contains(ParkType.Flying)) allowed |= ParkTraversal.Air;
            var preferred = EnvironmentIndex switch
            {
                0 or 1 when types.Contains(ParkType.Water) => ParkTerrain.Water,
                2 when types.Contains(ParkType.Fire) => ParkTerrain.Lava,
                3 when types.Contains(ParkType.Flying) => ParkTerrain.Air,
                _ => ParkTerrain.Land
            };
            uint seed = 2166136261;
            foreach (var letter in mon.Id) seed = (seed ^ letter) * 16777619;
            var isAnimated = walking.GetFrame(mon.Species, mon.Form, mon.Shiny, 0, 0) is not null;
            _routes[key] = route = new(new ParkWander(ParkMap.For(EnvironmentIndex), allowed, preferred,
                unchecked((int)(seed + (uint)EnvironmentIndex * 7919)), radius: 12), isAnimated);
        }
        var animated = route.Animated;
        var motionTime = interaction?.MotionTime(time) ?? time;
        if (animated) route.Started ??= motionTime;
        var state = route.Wander.GetState(animated ? Math.Max(0, motionTime - route.Started!.Value) : 0);
        if (!animated) state = state with { IsWalking = false, Activity = "Resting and enjoying the view" };
        if (ParkEnvironment.Get((ParkEnvironmentId)EnvironmentIndex).MoodBonus(types) > 0)
            state = state with { Mood = state.IsWalking ? "Playful" : "Delighted" };
        if (interaction?.IsActive(time) != true) return state;
        var (mood, activity) = interaction.Action switch
        {
            "Snack" => ("Delighted", "Enjoying a berry picnic"),
            "Play" => ("Playful", "Bouncing along with the ball"),
            "Relax" => ("Peaceful", "Listening to the meadow"),
            _ => ("Delighted", "Happy to see you!")
        };
        return state with { IsWalking = false, Mood = mood, Activity = activity };
    }
    public int HitTest(float normalizedX, float normalizedY, long time)
    {
        var view = Viewport(_drawWidth, _drawHeight);
        var screenX = normalizedX * _drawWidth; var screenY = normalizedY * _drawHeight;
        if (!view.Contains(screenX, screenY) || view.Width <= 0) return -1;
        var x = (screenX - view.Left) * 480 / view.Width;
        var y = (screenY - view.Top) * 270 / view.Height;
        var closest = -1; var distance = 32f * 32;
        for (var i = 0; i < Residents.Count; i++)
        {
            if (!IsAtHome(Residents[i])) continue;
            var state = GetResidentState(i, time);
            var d = MathF.Pow(state.X - x, 2) + MathF.Pow(state.Y - BodyHeight / 2 - y, 2);
            if (d < distance) { distance = d; closest = i; }
        }
        return closest;
    }

    // A short launcher loop uses genuine Idle frames at fixed positions. It never
    // reverses time (and therefore never sends a walking sprite backwards).
    public void DrawWidgetFrame(SKCanvas c, int width, int height, int frame) =>
        Draw(c, width, height, frame * 400L, labels: false, ambient: true);

    public async Task WarmEnvironmentAsync(int environmentIndex)
    {
        var asset = ParkMap.For(environmentIndex).Asset;
        Lazy<Task> pending;
        lock (_environmentGate)
        {
            if (_environment.ContainsKey(asset)) return;
            if (!_environmentLoads.TryGetValue(asset, out var existing))
            {
                pending = new Lazy<Task>(
                    () => LoadEnvironmentAsync(asset),
                    LazyThreadSafetyMode.ExecutionAndPublication);
                _environmentLoads.Add(asset, pending);
            }
            else
                pending = existing;
        }

        try { await pending.Value.ConfigureAwait(false); }
        catch
        {
            lock (_environmentGate)
            {
                if (_environmentLoads.TryGetValue(asset, out var current) && ReferenceEquals(current, pending))
                    _environmentLoads.Remove(asset);
            }
            throw;
        }
    }

    private async Task LoadEnvironmentAsync(string asset)
    {
        await using var stream = await FileSystem.OpenAppPackageFileAsync($"pokepark/maps/{asset}").ConfigureAwait(false);
        await using var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer).ConfigureAwait(false);
        var bytes = buffer.ToArray();
        var bitmap = await Task.Run(() => SKBitmap.Decode(bytes)).ConfigureAwait(false)
            ?? throw new InvalidDataException($"Invalid Poképark map: {asset}");

        lock (_environmentGate)
        {
            if (!_environment.TryAdd(asset, bitmap))
                bitmap.Dispose();
        }
    }

    // ── The garden corner (2.2) ─────────────────────────────────────────────

    /// <summary>The current habitat's garden, as the page last read it.</summary>
    public HabitatGarden? Garden { get; set; }

    /// <summary>A berry being dragged from a ripe tree to the pot (map units).</summary>
    public (int Berry, SKPoint At)? DraggedBerry { get; set; }

    private readonly List<(string Resident, long Start, string Text)> _floaters = [];

    /// <summary>A little "+5 ♥" rising over a resident (a berry it just ate).</summary>
    public void ShowFloater(string residentId, long time, string text) => _floaters.Add((residentId, time, text));

    /// <summary>A touch on the canvas in map units, or null outside the map.</summary>
    public SKPoint? ToMap(float normalizedX, float normalizedY)
    {
        var view = Viewport(_drawWidth, _drawHeight);
        var x = normalizedX * _drawWidth; var y = normalizedY * _drawHeight;
        if (!view.Contains(x, y) || view.Width <= 0) return null;
        return new SKPoint((x - view.Left) * ParkMap.Width / view.Width, (y - view.Top) * ParkMap.Height / view.Height);
    }

    /// <summary>The plot (0 to 3) or the pot (4) under a map point, or -1.</summary>
    public int HitGarden(SKPoint at)
    {
        var spot = ParkMap.For(EnvironmentIndex).Garden;
        if (MathF.Abs(at.X - spot.Pot.X) <= 14 && at.Y >= spot.Pot.Y - 18 && at.Y <= spot.Pot.Y + 6) return 4;
        for (var i = 0; i < spot.Plots.Length; i++)
            if (MathF.Abs(at.X - spot.Plots[i].X) <= 12 && at.Y >= spot.Plots[i].Y - 28 && at.Y <= spot.Plots[i].Y + 6) return i;
        return -1;
    }

    /// <summary>Whether a dragged berry is over the pot: a generous circle, so a drop rarely misses.</summary>
    public bool NearPot(SKPoint at)
    {
        var pot = ParkMap.For(EnvironmentIndex).Garden.Pot;
        var dx = at.X - pot.X; var dy = at.Y - (pot.Y - 6);
        return dx * dx + dy * dy <= 24 * 24;
    }

    /// <summary>A berry's colour on the trees and in the pot.</summary>
    public static SKColor BerryColor(int berry) => berry switch
    {
        149 => new SKColor(0xE5, 0x3B, 0x3B), // Cheri
        150 => new SKColor(0x5B, 0x5B, 0xD6), // Chesto
        151 => new SKColor(0xF7, 0xA1, 0xC4), // Pecha
        152 => new SKColor(0x3F, 0xB9, 0x8B), // Rawst
        153 => new SKColor(0xF2, 0xD3, 0x43), // Aspear
        154 => new SKColor(0xEE, 0x6B, 0x3A), // Leppa
        155 => new SKColor(0x3E, 0x7B, 0xE0), // Oran
        156 => new SKColor(0xEA, 0x7B, 0x8E), // Persim
        159 => new SKColor(0xD9, 0x53, 0x3F), // Figy
        160 => new SKColor(0xA0, 0x6B, 0xD8), // Wiki
        161 => new SKColor(0xF2, 0x8B, 0xB8), // Mago
        162 => new SKColor(0x6B, 0xC2, 0x4C), // Aguav
        _ => new SKColor(0xD8, 0x5A, 0x5A),
    };

    private void DrawGarden(SKCanvas c, long time, bool ambient)
    {
        if (Garden is not { } garden) return;
        var spot = ParkMap.For(EnvironmentIndex).Garden;
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var paint = new SKPaint { IsAntialias = true };
        for (var i = 0; i < spot.Plots.Length && i < garden.Plots.Count; i++)
        {
            var at = new SKPoint(spot.Plots[i].X, spot.Plots[i].Y);
            // Tilled soil with three furrows.
            paint.Color = new SKColor(0x6B, 0x45, 0x2A); c.DrawOval(at.X, at.Y, 11, 4.5f, paint);
            paint.Color = new SKColor(0x8A, 0x5B, 0x37); c.DrawOval(at.X, at.Y - 0.6f, 9.5f, 3.4f, paint);
            paint.Color = new SKColor(0x5A, 0x38, 0x22);
            for (var f = -1; f <= 1; f++) c.DrawRect(at.X - 6, at.Y - 0.8f + f * 1.6f, 12, 0.7f, paint);
            var view = ParkGardenRules.View(garden.Plots[i], now);
            if (view.Stage == PlotStage.Empty) continue;
            var berry = BerryColor(view.Berry);
            var dark = new SKColor(0x2F, 0x7A, 0x3A); var light = new SKColor(0x58, 0xB0, 0x52);
            switch (view.Stage)
            {
                case PlotStage.Sprout:
                    paint.Color = dark; c.DrawRect(at.X - 0.6f, at.Y - 6, 1.2f, 5, paint);
                    paint.Color = light; c.DrawOval(at.X - 2.6f, at.Y - 6, 2.6f, 1.4f, paint); c.DrawOval(at.X + 2.6f, at.Y - 6.5f, 2.6f, 1.4f, paint);
                    break;
                case PlotStage.Sapling:
                    paint.Color = new SKColor(0x7A, 0x52, 0x32); c.DrawRect(at.X - 1, at.Y - 9, 2, 8, paint);
                    paint.Color = dark; c.DrawCircle(at.X, at.Y - 12, 6, paint);
                    paint.Color = light; c.DrawCircle(at.X - 1.5f, at.Y - 13.5f, 3.6f, paint);
                    break;
                default:
                    var sway = ambient ? 0 : MathF.Sin(time / 900f + i) * 0.6f;
                    paint.Color = new SKColor(0x7A, 0x52, 0x32); c.DrawRect(at.X - 1.6f, at.Y - 12, 3.2f, 11, paint);
                    paint.Color = dark; c.DrawCircle(at.X + sway, at.Y - 18, 10, paint);
                    paint.Color = light; c.DrawCircle(at.X - 2.5f + sway, at.Y - 20.5f, 6.5f, paint);
                    if (view.Stage == PlotStage.Tree)
                    {
                        // Flowers in the berry's colour, pale: the fruit is on its way.
                        paint.Color = new SKColor((byte)((berry.Red + 510) / 3), (byte)((berry.Green + 510) / 3), (byte)((berry.Blue + 510) / 3));
                        c.DrawCircle(at.X - 5 + sway, at.Y - 16, 1.3f, paint); c.DrawCircle(at.X + 4 + sway, at.Y - 22, 1.3f, paint); c.DrawCircle(at.X + 5 + sway, at.Y - 14, 1.3f, paint);
                        break;
                    }
                    (float X, float Y)[] fruit = [(-5, -15), (4, -21), (5, -13), (-3, -23), (0, -17)];
                    foreach (var (fx, fy) in fruit)
                    {
                        paint.Color = berry; c.DrawCircle(at.X + fx + sway, at.Y + fy, 2.4f, paint);
                        paint.Color = SKColors.White.WithAlpha(170); c.DrawCircle(at.X + fx - 0.7f + sway, at.Y + fy - 0.7f, 0.7f, paint);
                    }
                    if (!ambient && (time / 600 + i) % 4 == 0)
                    {
                        paint.Color = SKColors.White.WithAlpha(220);
                        c.DrawRect(at.X + 8, at.Y - 28, 1, 4, paint); c.DrawRect(at.X + 6.5f, at.Y - 26.5f, 4, 1, paint);
                    }
                    break;
            }
        }

        // The pot: a clay bowl with the berries showing over its rim.
        var pot = new SKPoint(spot.Pot.X, spot.Pot.Y);
        var hover = DraggedBerry is { } drag && NearPot(drag.At);
        if (hover)
        {
            paint.Color = new SKColor(0xFF, 0xF5, 0xBC, 170); c.DrawOval(pot.X, pot.Y - 5, 15, 9, paint);
        }
        paint.Color = new SKColor(0x35, 0x5B, 0x41, 60); c.DrawOval(pot.X, pot.Y + 1, 11, 3, paint);
        using (var body = new SKPath())
        {
            body.MoveTo(pot.X - 10, pot.Y - 8);
            body.LineTo(pot.X + 10, pot.Y - 8);
            body.LineTo(pot.X + 6.5f, pot.Y);
            body.LineTo(pot.X - 6.5f, pot.Y);
            body.Close();
            paint.Color = new SKColor(0xB4, 0x65, 0x2F); c.DrawPath(body, paint);
        }
        paint.Color = new SKColor(0x8E, 0x4B, 0x22); c.DrawRect(pot.X - 7.5f, pot.Y - 3, 15, 1.2f, paint);
        paint.Color = new SKColor(0xC9, 0x7A, 0x41); c.DrawOval(pot.X, pot.Y - 8, 10.5f, 2.6f, paint);
        paint.Color = new SKColor(0x4A, 0x2A, 0x16); c.DrawOval(pot.X, pot.Y - 8, 8.5f, 1.8f, paint);
        var shown = garden.Pot.TakeLast(6).ToArray();
        for (var k = 0; k < shown.Length; k++)
        {
            var bx = pot.X - 6 + (k % 3) * 6; var by = pot.Y - 9 - (k / 3) * 2.4f;
            paint.Color = BerryColor(shown[k]); c.DrawCircle(bx, by, 2.2f, paint);
        }
        if (garden.Pot.Count > 0)
        {
            using var font = PixelFont.For("×12", 8);
            var label = $"×{garden.Pot.Count}";
            paint.Color = new SKColor(0xFF, 0xFA, 0xE5, 230);
            c.DrawRoundRect(SKRect.Create(pot.X + 9, pot.Y - 6, font.MeasureText(label) + 6, 10), 3, 3, paint);
            paint.Color = new SKColor(0x30, 0x47, 0x39);
            c.DrawText(label, pot.X + 12, pot.Y + 1.5f, SKTextAlign.Left, font, paint);
        }
    }

    private void DrawDrag(SKCanvas c)
    {
        if (DraggedBerry is not { } drag) return;
        using var paint = new SKPaint { IsAntialias = true };
        paint.Color = new SKColor(0, 0, 0, 60); c.DrawOval(drag.At.X, drag.At.Y + 9, 5, 1.8f, paint);
        for (var k = 0; k < 3; k++)
        {
            paint.Color = BerryColor(drag.Berry); c.DrawCircle(drag.At.X - 4 + k * 4, drag.At.Y - (k == 1 ? 2 : 0), 3.6f, paint);
            paint.Color = SKColors.White.WithAlpha(180); c.DrawCircle(drag.At.X - 5 + k * 4, drag.At.Y - 1 - (k == 1 ? 2 : 0), 1, paint);
        }
    }

    public void Draw(SKCanvas c, int width, int height, long time, bool labels = true, bool ambient = false)
    {
        c.Clear(PKForge.Chrome.Pksm.Housing);
        var view = Viewport(width, height);
        if (labels) { _drawWidth = width; _drawHeight = height; }
        c.Save();
        c.Translate(view.Left, view.Top);
        c.Scale(view.Width / 480f, view.Height / 270f);
        c.ClipRect(SKRect.Create(0, 0, 480, 270));
        using var p = new SKPaint { IsAntialias = false };
        DrawMap(c, p);
        DrawGarden(c, time, ambient);
        var poses = Residents.Select((mon, i) => (mon, i, state: GetResidentState(i, ambient ? 0 : time)))
            .Where(v => IsAtHome(v.mon))
            .OrderBy(v => v.state.Y);
        foreach (var (mon, i, state) in poses)
        {
            var pos = new SKPoint(state.X, state.Y);
            _interactions.TryGetValue(mon.Id, out var interaction);
            var active = !ambient && interaction?.IsActive(time) == true;
            var hop = active && interaction!.Action == "Play"
                ? -MathF.Abs(MathF.Sin(interaction.Elapsed(time) / 260f)) * 5 : 0;
            var ground = pos;
            pos.Y += hop;
            var moving = state.IsWalking && !ambient;
            var animationTime = moving ? (long)((time + i * 173) * WalkTempo) : time + i * 173;
            var frame = walking.GetFrame(mon.Species, mon.Form, mon.Shiny, ambient ? 0 : state.Facing, animationTime, moving);
            var bitmap = frame?.Bitmap ?? sprites.GetSprite(mon.Species, mon.Form, mon.Shiny);
            var bodyWidth = 18f; var bodyHeight = 26f;
            SKRect? dest = null;
            if (bitmap is not null)
            {
                var source = frame?.Source ?? new SKRect(0, 0, bitmap.Width, bitmap.Height);
                if (frame is not null)
                {
                    // One scale and one anchor for every frame of both animations: the envelope
                    // of all poses (relative to the cell's centre) decides the size, and its lowest
                    // pixel stands on the ground. Switching pose or direction never moves the feet.
                    var bounds = frame.Bounds;
                    var scale = Math.Min(MaxScale, BodyHeight / Math.Max(1, Math.Max(bounds.Width, bounds.Height))) * SizeFactor(mon.Species);
                    var w = source.Width * scale; var h = source.Height * scale;
                    var centerY = pos.Y - bounds.Bottom * scale;
                    dest = new SKRect(pos.X - w / 2, centerY - h / 2, pos.X + w / 2, centerY + h / 2);
                    bodyWidth = bounds.Width * scale; bodyHeight = bounds.Height * scale;
                }
                else
                {
                    source = VisibleBounds(bitmap, source);
                    var scale = Math.Min(MaxScale, BodyHeight / Math.Max(1, Math.Max(source.Width, source.Height))) * SizeFactor(mon.Species);
                    var w = source.Width * scale; var h = source.Height * scale;
                    dest = new SKRect(pos.X - w / 2, pos.Y - h, pos.X + w / 2, pos.Y);
                    bodyWidth = w; bodyHeight = h;
                }
                var shadow = Math.Clamp(bodyWidth * 0.34f, 6, 18);
                if (i == SelectedIndex && labels)
                {
                    p.Color = new SKColor(255, 245, 188, 180);
                    c.DrawOval(ground.X, ground.Y + 1, shadow + 4, shadow * 0.36f + 1.5f, p);
                }
                p.Color = new SKColor(53, 91, 65, 60);
                c.DrawOval(ground.X, ground.Y + 1, shadow, shadow * 0.36f, p);
                p.Color = SKColors.White;
                c.DrawBitmap(bitmap, source, dest.Value, p);
            }
            else
            {
                p.Color = new SKColor(53, 91, 65, 60); c.DrawOval(ground.X, ground.Y + 1, 9, 3, p);
                p.Color = SKColor.Parse("#f8efcf"); c.DrawCircle(pos.X, pos.Y - 13, 9, p);
                p.Color = SKColor.Parse("#65855e"); c.DrawCircle(pos.X - 3, pos.Y - 15, 1, p); c.DrawCircle(pos.X + 3, pos.Y - 15, 1, p);
            }
            var head = pos.Y - bodyHeight;
            if (active) DrawActivity(c, p, ground, interaction!, time);
            if (!active && (time / 1000 + i * 3) % 13 < 3) DrawEmote(c, p, pos.X + bodyWidth * 0.4f + 4, head - 4, state.Mood == "Delighted" ? 1 : (int)(time / 13000 + i) % 3);
            if (labels && i == SelectedIndex)
            {
                using var font = PixelFont.For(mon.Name, 9);
                p.Color = SKColor.Parse("#3f614f");
                var name = mon.Name.Length > 15 ? mon.Name[..14] + "…" : mon.Name;
                var labelWidth = font.MeasureText(name, p) + 10;
                var labelX = Math.Clamp(pos.X, labelWidth / 2, 480 - labelWidth / 2);
                var baseline = Math.Min(265, pos.Y + 13);
                p.Color = new SKColor(255, 250, 229, 235);
                c.DrawRoundRect(SKRect.Create(labelX - labelWidth / 2, baseline - 10, labelWidth, 13), 3, 3, p);
                p.Color = SKColor.Parse("#304739");
                c.DrawText(name, labelX, baseline, SKTextAlign.Center, font, p);
            }
        }
        DrawFloaters(c, time, ambient);
        DrawDrag(c);
        c.Restore();
    }

    private void DrawFloaters(SKCanvas c, long time, bool ambient)
    {
        if (ambient || _floaters.Count == 0) return;
        _floaters.RemoveAll(f => time - f.Start > 2400 || time < f.Start);
        using var paint = new SKPaint { IsAntialias = true };
        foreach (var (resident, start, text) in _floaters)
        {
            var index = Residents.ToList().FindIndex(mon => mon.Id == resident);
            if (index < 0 || !IsAtHome(Residents[index])) continue;
            var state = GetResidentState(index, time);
            var t = (time - start) / 2400f;
            var y = state.Y - BodyHeight - 6 - t * 16;
            var alpha = (byte)(255 * Math.Clamp(1.4f - t * 1.4f, 0, 1));
            using var font = PixelFont.For(text, 9);
            paint.Color = new SKColor(0xFF, 0xFA, 0xE5, (byte)(alpha * 0.9f));
            var width = font.MeasureText(text) + 14;
            c.DrawRoundRect(SKRect.Create(state.X - width / 2, y - 9, width, 12), 4, 4, paint);
            paint.Color = new SKColor(0xD8, 0x4A, 0x6A, alpha);
            c.DrawCircle(state.X - width / 2 + 5, y - 3.5f, 2.2f, paint);
            paint.Color = new SKColor(0x30, 0x47, 0x39, alpha);
            c.DrawText(text, state.X - width / 2 + 9, y, SKTextAlign.Left, font, paint);
        }
    }

    // Every resident is drawn about this tall (map units, the map is 480 by 270), scaled
    // by SizeFactor; the walk cycle plays a little slower so the feet match the ground.
    private const float BodyHeight = 36, MaxScale = 2.4f, WalkTempo = 0.8f;

    private bool IsAtHome(ParkPokemon mon)
    {
        if (EnvironmentIndex == 0) return true;
        var types = HabitatCatalog.TypesFor(mon.Species, mon.Form);
        return EnvironmentIndex switch
        {
            1 => types.Contains(ParkType.Water),
            2 => types.Contains(ParkType.Fire) || types.Contains(ParkType.Ground) || types.Contains(ParkType.Rock),
            3 => types.Contains(ParkType.Flying) || types.Contains(ParkType.Ice),
            _ => true
        };
    }

    private static float SizeFactor(int species) => species switch
    {
        3 or 6 or 9 or 31 or 34 or 59 or 68 or 80 or 89 or 94 or 130 or 131 or 143 or 149 or 150 or 151 or 242 or 248 or 249 or 250 or 384 or 445 or 483 or 484 or 487 or 643 or 644 or 646 or 716 or 717 or 718 or 799 or 800 or 889 or 890 or 984 or 985 or 998 or 1000 => 1.55f,
        4 or 7 or 10 or 13 or 16 or 19 or 25 or 29 or 32 or 35 or 37 or 39 or 41 or 43 or 46 or 48 or 54 or 56 or 60 or 63 or 66 or 69 or 72 or 74 or 81 or 84 or 86 or 90 or 92 or 100 or 109 or 116 or 120 or 129 or 133 or 172 or 173 or 174 or 175 or 194 or 218 or 223 or 265 or 270 or 280 or 293 or 304 or 363 or 401 or 412 or 415 or 425 or 436 or 453 or 458 or 504 or 506 or 532 or 543 or 557 or 568 or 585 or 592 or 594 or 704 or 742 or 744 or 746 or 767 or 819 or 821 or 831 or 833 or 906 or 917 => 0.72f,
        _ => 1f
    };

    private void DrawMap(SKCanvas canvas, SKPaint paint)
    {
        var asset = ParkMap.For(EnvironmentIndex).Asset;
        SKImage? image;
        lock (_environmentGate)
        {
            if (!_environmentImages.TryGetValue(asset, out image))
            {
                if (!_environment.TryGetValue(asset, out var bitmap) || bitmap is null) return; // loading frame keeps paint non-blocking
                _environmentImages[asset] = image = SKImage.FromBitmap(bitmap);
            }
        }
        paint.Color = SKColors.White;
        // The painting is several times larger than the screen: a smooth, mipmapped
        // downscale keeps its pixel edges clean instead of shimmering.
        canvas.DrawImage(image, new SKRect(0, 0, 480, 270), new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear), paint);
    }

    private void DrawActivity(SKCanvas c, SKPaint p, SKPoint pos, ParkInteraction activity, long time)
    {
        var t = activity.Elapsed(time) / 1000f;
        var map = ParkMap.For(EnvironmentIndex);
        var allowed = ParkMap.TraversalFor(map.TerrainAt(pos.X, pos.Y));
        var x = pos.X + 26;
        if (!map.CanOccupy(x, pos.Y, allowed, 16)) x = pos.X - 26;
        if (!map.CanOccupy(x, pos.Y, allowed, 16))
        {
            DrawEmote(c, p, pos.X, pos.Y - 33, 1);
            return;
        }
        var y = pos.Y;
        void Rect(float rx, float ry, float w, float h, string color)
        { p.Color = SKColor.Parse(color); c.DrawRect(rx, ry, w, h, p); }
        switch (activity.Action)
        {
            case "Snack":
                // Picnic cloth, berry and little rising sparkles.
                Rect(x - 10, y - 2, 21, 8, "#fff0ce");
                Rect(x - 10, y, 21, 2, "#e7a3a0");
                p.Color = SKColor.Parse("#d87091"); c.DrawCircle(x, y - 5, 6, p);
                Rect(x - 3, y - 8, 2, 2, "#ffd2cc");
                Rect(x, y - 13, 2, 5, "#587c55"); Rect(x + 2, y - 13, 4, 2, "#80ab62");
                for (var j = 0; j < 3; j++)
                {
                    var rise = (t * 13 + j * 9) % 30;
                    Rect(x - 10 + j * 9, y - 17 - rise, 2, 5, "#fff3a5");
                    Rect(x - 11 + j * 9, y - 16 - rise, 4, 2, "#fff3a5");
                }
                DrawEmote(c, p, pos.X + 9, pos.Y - 33, 1);
                break;
            case "Play":
                var bounce = MathF.Abs(MathF.Sin(t * 3.85f)) * 23;
                p.Color = new SKColor(53, 91, 65, 45); c.DrawOval(x, y + 3, 7, 2, p);
                p.Color = SKColor.Parse("#efb568"); c.DrawCircle(x, y - 5 - bounce, 7, p);
                Rect(x - 6, y - 7 - bounce, 12, 3, "#fbebbb");
                Rect(x - 2, y - 11 - bounce, 3, 12, "#91b7ac");
                DrawEmote(c, p, pos.X + 9, pos.Y - 33, 0);
                break;
            case "Relax":
                for (var j = 0; j < 3; j++)
                {
                    var rise = (t * 8 + j * 13) % 36;
                    var nx = pos.X - 17 + j * 17;
                    var ny = pos.Y - 28 - rise;
                    Rect(nx, ny, 2, 8, "#7088a8"); Rect(nx + 2, ny, 4, 2, "#7088a8");
                    p.Color = SKColor.Parse("#7088a8"); c.DrawOval(nx - 1, ny + 8, 3, 2, p);
                }
                break;
            default:
                DrawEmote(c, p, pos.X + 12, pos.Y - 33, 1);
                break;
        }
    }

    private sealed class FrameBounds(SKColor[] pixels)
    {
        public SKColor[] Pixels { get; } = pixels;
        public Dictionary<SKRect, SKRect> Frames { get; } = new();
    }

    private SKRect VisibleBounds(SKBitmap bitmap, SKRect cell)
    {
        // Copy pixels once per sheet; avoid native GetPixel calls in the rendering loop.
        var cached = _visibleBounds.GetValue(bitmap, b => new FrameBounds(b.Pixels));
        var frames = cached.Frames;
        if (frames.TryGetValue(cell, out var bounds)) return bounds;
        var left = (int)cell.Right; var top = (int)cell.Bottom;
        var right = (int)cell.Left; var bottom = (int)cell.Top;
        for (var y = (int)cell.Top; y < (int)cell.Bottom; y++)
            for (var x = (int)cell.Left; x < (int)cell.Right; x++)
                if (cached.Pixels[y * bitmap.Width + x].Alpha > 0)
                {
                    left = Math.Min(left, x); top = Math.Min(top, y);
                    right = Math.Max(right, x + 1); bottom = Math.Max(bottom, y + 1);
                }
        bounds = right > left && bottom > top ? new SKRect(left, top, right, bottom) : cell;
        frames[cell] = bounds;
        return bounds;
    }

    private static void DrawEmote(SKCanvas c, SKPaint p, float x, float y, int kind)
    {
        x = Math.Clamp(x, 10, 470); y = Math.Clamp(y, 11, 258);
        p.Color = new SKColor(255, 252, 232); c.DrawRoundRect(new SKRect(x - 9, y - 10, x + 9, y + 6), 4, 4, p);
        c.DrawRect(x - 4, y + 5, 4, 4, p);
        p.Color = SKColor.Parse(kind == 1 ? "#d8778a" : "#687364");
        if (kind == 1)
        {
            c.DrawCircle(x - 3, y - 4, 3, p); c.DrawCircle(x + 3, y - 4, 3, p);
            using var heart = new SKPath(); heart.MoveTo(x - 6, y - 3); heart.LineTo(x, y + 3); heart.LineTo(x + 6, y - 3); heart.Close(); c.DrawPath(heart, p);
        }
        else
        {
            c.DrawRect(x - 4, y - 5, 2, 2, p); c.DrawRect(x + 2, y - 5, 2, 2, p);
            c.DrawRect(x - 3, y + (kind == 0 ? 1 : 0), 6, 1, p);
            c.DrawRect(x - 4, y + (kind == 0 ? 0 : 1), 1, 2, p); c.DrawRect(x + 3, y + (kind == 0 ? 0 : 1), 1, 2, p);
        }
    }
}
