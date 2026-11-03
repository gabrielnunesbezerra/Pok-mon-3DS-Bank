using PKForge.Domain;
using SkiaSharp;

namespace PKForge.App.Views;

/// <summary>
/// The Arena's loose bits: flames, droplets, sparks, leaves, shards, smoke. Each one leaves
/// fast and slows down (never a constant speed), walks down its palette from light to dark as
/// it dies, and is drawn on whole art pixels with no smoothing.
/// </summary>
internal sealed class ArenaParticles : IDisposable
{
    public enum Kind : byte { Pixel, Glow, Spark, Leaf, Shard, Rock, Bubble, Smoke, Ring, Star, Wisp }

    private struct Particle
    {
        public float X, Y, VX, VY, Life, Max, Size, Grow, Spin, Angle, Gravity, Drag;
        public SKColor[] Ramp;
        public int Start;
        public Kind Kind;
        public bool Behind;
    }

    private const int MaxParticles = 1400;

    private readonly Particle[] _particles = new Particle[MaxParticles];
    private readonly Random _random;
    private readonly SKPaint _fill = new() { IsAntialias = false };
    private readonly SKPaint _line = new() { IsAntialias = false, Style = SKPaintStyle.Stroke };
    private int _count;
    private float _time;

    public ArenaParticles(Random random) => _random = random;

    private float Rand(float min, float max) => min + (float)_random.NextDouble() * (max - min);

    /// <summary>
    /// One particle. <paramref name="start"/> is the step of the ramp it is born at (0 is the
    /// near-white core); <paramref name="drag"/> below 1 is what slows it down.
    /// </summary>
    public void Add(Kind kind, float x, float y, float vx, float vy, float life, float size, SKColor[] ramp,
        int start = ArenaPalettes.Core, float grow = 0, float gravity = 0, float drag = 0.88f, float spin = 0, bool behind = false)
    {
        if (_count >= MaxParticles)
        {
            // The oldest give way to the newest.
            Array.Copy(_particles, 64, _particles, 0, MaxParticles - 64);
            _count -= 64;
        }
        _particles[_count++] = new Particle
        {
            X = x, Y = y, VX = vx, VY = vy, Life = life, Max = life, Size = size, Grow = grow, Gravity = gravity, Drag = drag,
            Spin = spin, Angle = Rand(0, MathF.Tau), Ramp = ramp, Start = start, Kind = kind, Behind = behind,
        };
    }

    /// <summary>One puff of a type's matter: fire licks, droplets, sparks, leaves, shards...</summary>
    public void Matter(int type, float x, float y, float dirX, float dirY, float speed, float spread, float scale = 1)
    {
        var ramp = ArenaPalettes.For(type);
        var angle = MathF.Atan2(dirY, dirX) + Rand(-spread, spread);
        var v = speed * Rand(0.6f, 1.15f);
        var vx = MathF.Cos(angle) * v;
        var vy = MathF.Sin(angle) * v;
        var light = _random.Next(3) == 0 ? ArenaPalettes.Core : ArenaPalettes.Bright;
        switch (type)
        {
            case ArenaTypes.Fire:
                Add(Kind.Glow, x, y, vx, vy - 20, Rand(0.35f, 0.7f), Rand(6, 11) * scale, ramp, light, grow: -9, gravity: -90, drag: 0.9f);
                if (_random.Next(3) == 0)
                    Add(Kind.Smoke, x, y, vx * 0.3f, vy * 0.3f - 30, 0.95f, 7 * scale, ArenaPalettes.Smoke, ArenaPalettes.Deep, grow: 16, gravity: -40, drag: 0.92f);
                break;
            case ArenaTypes.Water:
                Add(Kind.Glow, x, y, vx, vy, Rand(0.4f, 0.75f), Rand(4, 7) * scale, ramp, light, gravity: 380, drag: 0.95f);
                if (_random.Next(3) == 0) Add(Kind.Bubble, x, y, vx * 0.4f, vy * 0.4f - 20, 0.85f, Rand(3, 6) * scale, ramp, ArenaPalettes.Bright, grow: 3);
                break;
            case ArenaTypes.Electric:
                Add(Kind.Spark, x, y, vx * 1.6f, vy * 1.6f, Rand(0.18f, 0.34f), 3 * scale, ramp, ArenaPalettes.Core, drag: 0.82f);
                if (_random.Next(2) == 0) Add(Kind.Pixel, x, y, vx * 0.7f, vy * 0.7f, 0.3f, 3 * scale, ramp, ArenaPalettes.Bright, drag: 0.86f);
                break;
            case ArenaTypes.Grass or ArenaTypes.Bug:
                Add(Kind.Leaf, x, y, vx, vy, Rand(0.7f, 1.2f), Rand(5, 8) * scale, ramp, ArenaPalettes.Bright, drag: 0.93f, spin: Rand(-12, 12));
                break;
            case ArenaTypes.Ice:
                Add(Kind.Shard, x, y, vx, vy, Rand(0.5f, 0.95f), Rand(5, 8) * scale, ramp, light, drag: 0.92f, spin: Rand(-6, 6));
                if (_random.Next(2) == 0) Add(Kind.Star, x, y, vx * 0.3f, vy * 0.3f, 0.55f, Rand(4, 6) * scale, ramp, ArenaPalettes.Core, drag: 0.9f);
                break;
            case ArenaTypes.Poison:
                Add(Kind.Bubble, x, y, vx * 0.6f, vy * 0.6f - 25, Rand(0.55f, 1.05f), Rand(4, 7) * scale, ramp, ArenaPalettes.Bright, grow: 6, drag: 0.9f);
                Add(Kind.Glow, x, y, vx, vy, 0.5f, 6 * scale, ramp, ArenaPalettes.Body, grow: -7);
                break;
            case ArenaTypes.Ground or ArenaTypes.Rock:
                Add(Kind.Rock, x, y, vx, vy - 80, Rand(0.55f, 1.05f), Rand(4, 8) * scale, ramp, _random.Next(2) == 0 ? ArenaPalettes.Bright : ArenaPalettes.Body,
                    gravity: 600, drag: 0.97f, spin: Rand(-8, 8));
                if (_random.Next(2) == 0)
                    Add(Kind.Smoke, x, y, vx * 0.2f, vy * 0.2f, 1.1f, 9 * scale, ramp, ArenaPalettes.Body, grow: 22, drag: 0.9f, behind: true);
                break;
            case ArenaTypes.Ghost:
                Add(Kind.Wisp, x, y, vx * 0.6f, vy * 0.6f - 15, Rand(0.7f, 1.2f), Rand(6, 10) * scale, ramp, ArenaPalettes.Bright, grow: 4, drag: 0.9f);
                break;
            case ArenaTypes.Psychic:
                Add(Kind.Ring, x, y, vx * 0.2f, vy * 0.2f, 0.6f, 4 * scale, ramp, ArenaPalettes.Bright, grow: 60, drag: 0.9f);
                Add(Kind.Glow, x, y, vx, vy, 0.5f, 5 * scale, ramp, ArenaPalettes.Core, grow: -6);
                break;
            case ArenaTypes.Dragon:
                var sway = 120 * MathF.Sin(_time * 18);
                Add(Kind.Glow, x, y, vx - dirY * sway, vy + dirX * sway, Rand(0.4f, 0.75f), Rand(7, 11) * scale, ramp, light, grow: -9);
                break;
            case ArenaTypes.Dark:
                Add(Kind.Smoke, x, y, vx * 0.5f, vy * 0.5f, 0.8f, 8 * scale, ramp, ArenaPalettes.Deep, grow: 14, drag: 0.9f);
                Add(Kind.Glow, x, y, vx, vy, 0.4f, 5 * scale, ramp, ArenaPalettes.Bright, grow: -6);
                break;
            case ArenaTypes.Steel:
                Add(Kind.Spark, x, y, vx * 1.3f, vy * 1.3f, Rand(0.2f, 0.4f), 3 * scale, ramp, ArenaPalettes.Core, gravity: 200, drag: 0.88f);
                break;
            case ArenaTypes.Fairy:
                Add(Kind.Star, x, y, vx * 0.6f, vy * 0.6f, Rand(0.55f, 1.05f), Rand(4, 7) * scale, ramp, light, drag: 0.91f, spin: 4);
                break;
            case ArenaTypes.Flying:
                Add(Kind.Ring, x, y, vx * 0.8f, vy * 0.8f, 0.4f, 3 * scale, ramp, ArenaPalettes.Core, grow: 45, drag: 0.9f);
                Add(Kind.Spark, x, y, vx * 1.4f, vy * 1.4f, 0.28f, 3 * scale, ramp, ArenaPalettes.Core, drag: 0.88f);
                break;
            case ArenaTypes.Fighting:
                Add(Kind.Spark, x, y, vx * 1.5f, vy * 1.5f, 0.28f, 3 * scale, ramp, ArenaPalettes.Core, drag: 0.85f);
                Add(Kind.Glow, x, y, vx * 0.5f, vy * 0.5f, 0.34f, 8 * scale, ramp, ArenaPalettes.Bright, grow: -16);
                break;
            default:
                Add(Kind.Glow, x, y, vx, vy, Rand(0.35f, 0.6f), Rand(4, 7) * scale, ramp, ArenaPalettes.Bright, grow: -7);
                if (_random.Next(2) == 0) Add(Kind.Star, x, y, vx * 0.5f, vy * 0.5f, 0.4f, 4 * scale, ramp, ArenaPalettes.Core, drag: 0.9f);
                break;
        }
    }

    /// <summary>A burst of matter thrown out around a direction (a hit, a cast).</summary>
    public void Spray(int type, float x, float y, float dirX, float dirY, int count, float speed, float spread, float scale = 1)
    {
        for (var i = 0; i < count; i++) Matter(type, x, y, dirX, dirY, speed, spread, scale);
    }

    public void Update(float dt)
    {
        _time += dt;
        for (var i = _count - 1; i >= 0; i--)
        {
            ref var p = ref _particles[i];
            p.Life -= dt;
            if (p.Life <= 0)
            {
                _particles[i] = _particles[--_count];
                continue;
            }
            var drag = MathF.Pow(p.Drag, dt * 60);
            p.VX *= drag;
            p.VY = p.VY * drag + p.Gravity * dt;
            p.X += p.VX * dt;
            p.Y += p.VY * dt;
            p.Size = Math.Max(0.2f, p.Size + p.Grow * dt);
            p.Angle += p.Spin * dt;
        }
    }

    /// <summary>
    /// The particles of one layer: the ones on the ground (dust, smoke) go under the fighters,
    /// the rest over them. Coordinates are the world's; the canvas maps them to art pixels.
    /// </summary>
    public void Draw(SKCanvas c, bool behind)
    {
        const float unit = ArenaPixel.Unit;
        for (var i = 0; i < _count; i++)
        {
            ref var p = ref _particles[i];
            if (p.Behind != behind) continue;
            var fade = Math.Clamp(p.Life / p.Max, 0, 1);
            // Down the ramp one whole color at a time, and only the very end goes see-through.
            var step = p.Start + (int)((1 - fade) * (p.Ramp.Length - p.Start));
            var alpha = fade > 0.2f ? (byte)255 : (byte)150;
            var color = ArenaPalettes.At(p.Ramp, step).WithAlpha(alpha);
            var x = ArenaPixel.Snap(p.X);
            var y = ArenaPixel.Snap(p.Y);
            var s = ArenaPixel.Size(p.Size);
            switch (p.Kind)
            {
                case Kind.Pixel:
                    _fill.Color = color;
                    c.DrawRect(x, y, s, s, _fill);
                    break;
                case Kind.Glow:
                    // The halo: bigger, one color darker and half see-through. Then the body.
                    _fill.Color = ArenaPalettes.At(p.Ramp, step + 1).WithAlpha((byte)(alpha / 2));
                    c.DrawCircle(x, y, ArenaPixel.Size(p.Size * 1.8f), _fill);
                    _fill.Color = color;
                    c.DrawCircle(x, y, s, _fill);
                    break;
                case Kind.Spark:
                    _line.Color = color;
                    _line.StrokeWidth = p.Size > 4 ? 2 * unit : unit;
                    c.DrawLine(x, y, ArenaPixel.Snap(p.X - p.VX * 0.03f), ArenaPixel.Snap(p.Y - p.VY * 0.03f), _line);
                    break;
                case Kind.Leaf:
                    c.Save();
                    c.Translate(x, y);
                    c.RotateRadians(p.Angle);
                    _fill.Color = color;
                    c.DrawOval(0, 0, s, s * 0.5f, _fill);
                    _fill.Color = ArenaPalettes.At(p.Ramp, step + 1).WithAlpha(alpha);
                    c.DrawRect(-s, -unit / 2, s * 2, unit, _fill);
                    c.Restore();
                    break;
                case Kind.Shard or Kind.Rock:
                    c.Save();
                    c.Translate(x, y);
                    c.RotateRadians(p.Angle);
                    using (var path = new SKPath())
                    {
                        if (p.Kind == Kind.Shard)
                        {
                            path.MoveTo(0, -s * 1.4f);
                            path.LineTo(s * 0.5f, 0);
                            path.LineTo(0, s * 1.4f);
                            path.LineTo(-s * 0.5f, 0);
                        }
                        else
                        {
                            path.MoveTo(-s, -s * 0.6f);
                            path.LineTo(s * 0.3f, -s);
                            path.LineTo(s, s * 0.2f);
                            path.LineTo(-s * 0.2f, s);
                        }
                        path.Close();
                        _fill.Color = color;
                        c.DrawPath(path, _fill);
                        // A dark rim on the bottom half gives the chunk its volume.
                        _line.Color = ArenaPalettes.At(p.Ramp, step + 2).WithAlpha(alpha);
                        _line.StrokeWidth = unit;
                        c.DrawPath(path, _line);
                    }
                    c.Restore();
                    break;
                case Kind.Bubble:
                    _line.Color = color;
                    _line.StrokeWidth = unit;
                    c.DrawCircle(x, y, s, _line);
                    _fill.Color = ArenaPalettes.At(p.Ramp, ArenaPalettes.Core).WithAlpha(alpha);
                    c.DrawRect(ArenaPixel.Snap(x - s * 0.5f), ArenaPixel.Snap(y - s * 0.5f), unit, unit, _fill);
                    break;
                case Kind.Smoke:
                    _fill.Color = color.WithAlpha((byte)(alpha * 0.7f));
                    c.DrawCircle(x, y, s, _fill);
                    break;
                case Kind.Ring:
                    _line.Color = color;
                    _line.StrokeWidth = fade > 0.5f ? 2 * unit : unit;
                    c.DrawOval(x, y, s, ArenaPixel.Size(s * 0.66f), _line);
                    break;
                case Kind.Star:
                    // A pixel twinkle: a plus that turns into an x as it spins.
                    _fill.Color = color;
                    if (MathF.Sin(p.Angle) >= 0)
                    {
                        c.DrawRect(x - s, y, s * 2 + unit, unit, _fill);
                        c.DrawRect(x, y - s, unit, s * 2 + unit, _fill);
                    }
                    else
                    {
                        _line.Color = color;
                        _line.StrokeWidth = unit;
                        c.DrawLine(x - s * 0.7f, y - s * 0.7f, x + s * 0.7f, y + s * 0.7f, _line);
                        c.DrawLine(x - s * 0.7f, y + s * 0.7f, x + s * 0.7f, y - s * 0.7f, _line);
                    }
                    c.DrawRect(x, y, unit, unit, _fill);
                    break;
                case Kind.Wisp:
                    _fill.Color = ArenaPalettes.At(p.Ramp, step + 1).WithAlpha((byte)(alpha / 2));
                    c.DrawOval(x, y, s, ArenaPixel.Size(s * 1.4f), _fill);
                    _fill.Color = color;
                    c.DrawOval(x, ArenaPixel.Snap(y + s * 0.3f), ArenaPixel.Size(s * 0.45f), ArenaPixel.Size(s * 0.6f), _fill);
                    break;
            }
        }
    }

    public void Dispose()
    {
        _fill.Dispose();
        _line.Dispose();
    }
}
