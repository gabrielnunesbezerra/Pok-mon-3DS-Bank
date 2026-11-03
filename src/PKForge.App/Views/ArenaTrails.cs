using PKForge.Domain;
using SkiaSharp;

namespace PKForge.App.Views;

/// <summary>
/// What fast things leave behind: the tail of every shot, the echoes of a fighter dashing or
/// dodging, the swipe of a Strike, and the beams and ground rings that thin out slowly after
/// the battle is done with them. Drawing only; the battle never sees any of it.
/// </summary>
internal sealed class ArenaTrails : IDisposable
{
    /// <summary>Where a fast fighter was a moment ago (its sprite is drawn there as a silhouette).</summary>
    public readonly record struct Echo(float X, float Y, float Age);

    private sealed class Tail(int type, float radius)
    {
        public int Type { get; } = type;
        public float Radius { get; } = radius;
        public List<SKPoint> Points { get; } = [];
        public bool Gone { get; set; }
        public float Drop { get; set; }
    }

    private sealed class Swipe(bool champion, int type, float x, float y, float aimX, float aimY)
    {
        public bool Champion { get; } = champion;
        public int Type { get; } = type;
        public float AimX { get; } = aimX;
        public float AimY { get; } = aimY;
        public float X { get; set; } = x;
        public float Y { get; set; } = y;
        public float Age { get; set; }
    }

    private enum LingerKind { Beam, Ring }

    private sealed record Linger(LingerKind Kind, int Type, float X0, float Y0, float X1, float Y1, float Born, float Life);

    public const float EchoLife = 0.15f;
    private const float EchoEvery = 0.025f;
    private const float EchoSpeed = 420;
    private const int TailLength = 9;
    private const float SwipeFollow = 0.2f, SwipeLife = 0.44f, SwipeRadius = 44;

    private readonly Dictionary<ArenaProjectile, Tail> _tails = [];
    private readonly List<Swipe> _swipes = [];
    private readonly List<Linger> _lingers = [];
    private readonly HashSet<ArenaRing> _rings = [];
    private readonly List<Echo>[] _echoes = [[], []];
    private readonly float[] _echoClock = new float[2];
    private readonly SKPaint _line = new() { IsAntialias = false, Style = SKPaintStyle.Stroke, StrokeCap = SKStrokeCap.Round };
    private float _time;

    public IReadOnlyList<Echo> Echoes(bool champion) => _echoes[champion ? 1 : 0];

    /// <summary>A Strike was thrown from (x, y), the feet: its swipe follows the dash, then fades where it ended.</summary>
    public void AddSwipe(bool champion, int type, float x, float y, float aimX, float aimY) =>
        _swipes.Add(new Swipe(champion, type, x, y, aimX, aimY));

    /// <summary>A beam the battle has finished with, left to thin out on screen.</summary>
    public void AddBeam(int type, float x0, float y0, float x1, float y1) =>
        _lingers.Add(new Linger(LingerKind.Beam, type, x0, y0, x1, y1, _time, 0.4f));

    public void Update(float dt, ArenaBattle battle)
    {
        _time += dt;
        if (dt <= 0) return;

        // Shots: a new point at the head each frame; a shot that is gone lets its tail run out.
        foreach (var shot in battle.Projectiles)
        {
            if (!_tails.TryGetValue(shot, out var tail)) _tails[shot] = tail = new Tail(shot.Type, shot.Radius);
            tail.Points.Add(new SKPoint(shot.X, shot.Y - ArenaRenderer.Lift));
            if (tail.Points.Count > TailLength) tail.Points.RemoveAt(0);
        }
        foreach (var (shot, tail) in _tails.ToList())
        {
            if (!tail.Gone && !battle.Projectiles.Contains(shot)) tail.Gone = true;
            if (!tail.Gone) continue;
            tail.Drop += dt;
            while (tail.Drop > 0.03f && tail.Points.Count > 0)
            {
                tail.Drop -= 0.03f;
                tail.Points.RemoveAt(0);
            }
            if (tail.Points.Count < 2) _tails.Remove(shot);
        }

        // Fast fighters (a Strike's dash, a dodge) leave echoes.
        foreach (var fighter in new[] { battle.Player, battle.Champion })
        {
            var side = fighter.IsChampion ? 1 : 0;
            var echoes = _echoes[side];
            for (var i = echoes.Count - 1; i >= 0; i--)
            {
                var echo = echoes[i] with { Age = echoes[i].Age + dt };
                if (echo.Age > EchoLife) echoes.RemoveAt(i);
                else echoes[i] = echo;
            }
            _echoClock[side] -= dt;
            var speed = MathF.Sqrt(fighter.VelocityX * fighter.VelocityX + fighter.VelocityY * fighter.VelocityY);
            if (speed > EchoSpeed && _echoClock[side] <= 0)
            {
                echoes.Add(new Echo(fighter.X, fighter.Y, 0));
                _echoClock[side] = EchoEvery;
            }
        }

        for (var i = _swipes.Count - 1; i >= 0; i--)
        {
            var swipe = _swipes[i];
            var fighter = swipe.Champion ? battle.Champion : battle.Player;
            if (swipe.Age < SwipeFollow)
            {
                swipe.X = fighter.X;
                swipe.Y = fighter.Y;
            }
            swipe.Age += dt;
            if (swipe.Age > SwipeLife) _swipes.RemoveAt(i);
        }

        // A ground ring the battle dropped leaves a scar that fades.
        foreach (var ring in battle.Rings) _rings.Add(ring);
        foreach (var ring in _rings.ToList())
        {
            if (battle.Rings.Contains(ring)) continue;
            _rings.Remove(ring);
            _lingers.Add(new Linger(LingerKind.Ring, ring.Type, ring.X, ring.Y, ArenaBattle.RingReach, 0, _time, 0.55f));
        }
        _lingers.RemoveAll(linger => _time - linger.Born > linger.Life);
    }

    /// <summary>The ground marks, under the fighters.</summary>
    public void DrawGround(SKCanvas c)
    {
        foreach (var linger in _lingers)
        {
            if (linger.Kind != LingerKind.Ring) continue;
            var f = Math.Clamp((_time - linger.Born) / linger.Life, 0, 1);
            var ramp = ArenaPalettes.For(linger.Type);
            var radius = ArenaPixel.Snap(linger.X1);
            _line.StrokeCap = SKStrokeCap.Butt;
            _line.Color = ArenaPalettes.At(ramp, ArenaPalettes.Deep + (int)(f * 2)).WithAlpha(f < 0.6f ? (byte)200 : (byte)110);
            _line.StrokeWidth = ArenaPixel.Size(6 * (1 - f));
            c.DrawOval(ArenaPixel.Snap(linger.X0), ArenaPixel.Snap(linger.Y0), radius, ArenaPixel.Snap(radius * 0.62f), _line);
            // Cracks running out to the ring.
            _line.StrokeWidth = ArenaPixel.Unit;
            _line.Color = ArenaPalettes.At(ramp, ArenaPalettes.Edge).WithAlpha(f < 0.6f ? (byte)220 : (byte)120);
            for (var i = 0; i < 8; i++)
            {
                var a = i * MathF.Tau / 8 + linger.X0 * 0.01f;
                var inner = radius * 0.35f;
                var outer = radius * (0.7f + 0.25f * MathF.Sin(i * 2.3f + linger.Y0));
                c.DrawLine(ArenaPixel.Snap(linger.X0 + MathF.Cos(a) * inner), ArenaPixel.Snap(linger.Y0 + MathF.Sin(a) * inner * 0.62f),
                    ArenaPixel.Snap(linger.X0 + MathF.Cos(a) * outer), ArenaPixel.Snap(linger.Y0 + MathF.Sin(a) * outer * 0.62f), _line);
            }
            _line.StrokeCap = SKStrokeCap.Round;
        }
    }

    /// <summary>Tails, swipes and fading beams, over the fighters.</summary>
    public void Draw(SKCanvas c)
    {
        foreach (var tail in _tails.Values) DrawTail(c, tail);
        foreach (var swipe in _swipes) DrawSwipe(c, swipe);
        foreach (var linger in _lingers)
            if (linger.Kind == LingerKind.Beam) DrawFadingBeam(c, linger);
    }

    private void DrawTail(SKCanvas c, Tail tail)
    {
        var points = tail.Points;
        if (points.Count < 2) return;
        var ramp = ArenaPalettes.For(tail.Type);
        // Three passes so every layer sits on the one under it: halo, body, then the hot core.
        for (var layer = 0; layer < 3; layer++)
            for (var i = 1; i < points.Count; i++)
            {
                var t = i / (float)(points.Count - 1); // 0 at the end of the tail, 1 at the shot
                var (width, step, alpha) = layer switch
                {
                    0 => (tail.Radius * 1.7f * t, ArenaPalettes.Deep, (byte)110),
                    1 => (tail.Radius * 1.0f * t, t > 0.66f ? ArenaPalettes.Bright : t > 0.33f ? ArenaPalettes.Body : ArenaPalettes.Deep, (byte)255),
                    _ => (t > 0.6f ? tail.Radius * 0.4f * t : 0, ArenaPalettes.Core, (byte)255),
                };
                if (width < ArenaPixel.Unit * 0.5f) continue;
                _line.Color = ArenaPalettes.At(ramp, step).WithAlpha(alpha);
                _line.StrokeWidth = ArenaPixel.Size(width);
                c.DrawLine(ArenaPixel.Snap(points[i - 1].X), ArenaPixel.Snap(points[i - 1].Y), ArenaPixel.Snap(points[i].X), ArenaPixel.Snap(points[i].Y), _line);
            }
    }

    private void DrawSwipe(SKCanvas c, Swipe swipe)
    {
        var ramp = ArenaPalettes.For(swipe.Type);
        var cx = ArenaPixel.Snap(swipe.X + swipe.AimX * 26);
        var cy = ArenaPixel.Snap(swipe.Y - ArenaRenderer.Lift + swipe.AimY * 26);
        var oval = new SKRect(cx - SwipeRadius, cy - SwipeRadius, cx + SwipeRadius, cy + SwipeRadius);
        var facing = MathF.Atan2(swipe.AimY, swipe.AimX) * 180 / MathF.PI;
        // The arc sweeps open fast, then thins and darkens where the dash ended.
        var sweep = 150 * Math.Min(1, swipe.Age / 0.07f);
        var fade = Math.Clamp((swipe.Age - SwipeFollow) / (SwipeLife - SwipeFollow), 0, 1);
        var darker = (int)(fade * 3);
        _line.StrokeCap = SKStrokeCap.Butt;
        foreach (var (width, step, alpha) in new[] { (16f, ArenaPalettes.Deep, (byte)110), (9f, ArenaPalettes.Bright, (byte)255), (3f, ArenaPalettes.Core, (byte)255) })
        {
            var w = width * (1 - fade);
            if (w < ArenaPixel.Unit * 0.5f) continue;
            _line.Color = ArenaPalettes.At(ramp, step + darker).WithAlpha(alpha);
            _line.StrokeWidth = ArenaPixel.Size(w);
            using var path = new SKPath();
            path.AddArc(oval, facing - 75, sweep);
            c.DrawPath(path, _line);
        }
        _line.StrokeCap = SKStrokeCap.Round;
    }

    private void DrawFadingBeam(SKCanvas c, Linger beam)
    {
        var f = Math.Clamp((_time - beam.Born) / beam.Life, 0, 1);
        var ramp = ArenaPalettes.For(beam.Type);
        _line.StrokeCap = SKStrokeCap.Butt;
        foreach (var (width, step, alpha) in new[] { (1.6f, ArenaPalettes.Deep, (byte)90), (0.8f, ArenaPalettes.Body, (byte)200), (0.3f, ArenaPalettes.Bright, (byte)255) })
        {
            var w = ArenaBattle.BeamWidth * width * (1 - f) * (1 - f);
            if (w < ArenaPixel.Unit * 0.5f) continue;
            _line.Color = ArenaPalettes.At(ramp, step + (int)(f * 2)).WithAlpha(alpha);
            _line.StrokeWidth = ArenaPixel.Size(w);
            c.DrawLine(ArenaPixel.Snap(beam.X0), ArenaPixel.Snap(beam.Y0), ArenaPixel.Snap(beam.X1), ArenaPixel.Snap(beam.Y1), _line);
        }
        _line.StrokeCap = SKStrokeCap.Round;
    }

    public void Dispose() => _line.Dispose();
}
