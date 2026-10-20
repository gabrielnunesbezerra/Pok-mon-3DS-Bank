using PKForge.App.Services;
using PKForge.Domain;
using SkiaSharp;

namespace PKForge.App.Views;

/// <summary>
/// Draws 3DS Bank 2.5's Arena battle: the floor, the two Pokémon (walking sprites in eight
/// directions when they exist), every move's effect by its type and kind, hits, numbers, the
/// HP bars, the clock and the touch controls. Effects are particles drawn additively (light
/// adds up, like fire and sparks do), updated every frame from the battle and its events.
/// </summary>
internal sealed class ArenaRenderer : IDisposable
{
    private enum Kind : byte { Glow, Spark, Leaf, Shard, Bubble, Smoke, Rock, Ring, Star, Wisp }

    private struct Particle
    {
        public float X, Y, VX, VY, Life, Max, Size, Grow, Spin, Angle, Gravity, Drag;
        public SKColor Color;
        public Kind Kind;
        public bool Additive;
    }

    private sealed record FloatText(string Text, float X, float Y, SKColor Color, float Size, float Born, float Life, float Rise);

    private const int MaxParticles = 1400;

    /// <summary>Moves fly at body height: the battle works on the ground plane (the feet).</summary>
    private const float Lift = 30;
    private readonly Particle[] _particles = new Particle[MaxParticles];
    private int _count;
    private readonly List<FloatText> _texts = [];
    private readonly Random _random = new();
    private readonly ISpriteService? _sprites = IPlatformApplication.Current?.Services.GetService<ISpriteService>();
    private readonly PokeparkSpriteService? _walking = IPlatformApplication.Current?.Services.GetService<PokeparkSpriteService>();
    private readonly Dictionary<SKBitmap, (SKImage Image, SKRect Crop)> _images = [];
    private readonly SKPaint _paint = new() { IsAntialias = true };
    private readonly SKPaint _stroke = new() { IsAntialias = true, Style = SKPaintStyle.Stroke };
    private readonly SKSamplingOptions _pixel = new(SKFilterMode.Nearest);
    private SKImage? _floor;
    private SKSizeI _floorSize;
    private int _floorType = -1;
    private float _time;
    private float _flash;
    private SKColor _flashColor = SKColors.White;
    private (string Text, SKColor Color, float Born, float Life)? _banner;

    public static readonly SKColor[] TypeColors =
    [
        new(0xA8, 0xA7, 0x7A), new(0xC2, 0x2E, 0x28), new(0xA9, 0x8F, 0xF3), new(0xA3, 0x3E, 0xA1), new(0xE2, 0xBF, 0x65),
        new(0xB6, 0xA1, 0x36), new(0xA6, 0xB9, 0x1A), new(0x73, 0x57, 0x97), new(0xB7, 0xB7, 0xCE), new(0xEE, 0x81, 0x30),
        new(0x63, 0x90, 0xF0), new(0x7A, 0xC7, 0x4C), new(0xF7, 0xD0, 0x2C), new(0xF9, 0x55, 0x87), new(0x96, 0xD9, 0xD6),
        new(0x6F, 0x35, 0xFC), new(0x70, 0x57, 0x46), new(0xD6, 0x85, 0xAD),
    ];

    public static SKColor TypeColor(int type) => TypeColors[Math.Clamp(type, 0, 17)];

    private static SKColor Light(SKColor color, float amount) => new(
        (byte)(color.Red + (255 - color.Red) * amount), (byte)(color.Green + (255 - color.Green) * amount),
        (byte)(color.Blue + (255 - color.Blue) * amount), color.Alpha);

    private static SKColor Dark(SKColor color, float amount) => new(
        (byte)(color.Red * (1 - amount)), (byte)(color.Green * (1 - amount)), (byte)(color.Blue * (1 - amount)), color.Alpha);

    private float Rand(float min, float max) => min + (float)_random.NextDouble() * (max - min);

    // ── Particles ───────────────────────────────────────────────────────────

    private void Add(Kind kind, float x, float y, float vx, float vy, float life, float size, SKColor color,
        bool additive = true, float grow = 0, float gravity = 0, float drag = 0.9f, float spin = 0)
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
            Spin = spin, Angle = Rand(0, MathF.Tau), Color = color, Kind = kind, Additive = additive,
        };
    }

    /// <summary>One puff of a type's matter: fire licks, droplets, sparks, leaves, shards...</summary>
    private void Matter(int type, float x, float y, float dirX, float dirY, float speed, float spread, float scale = 1)
    {
        var color = TypeColor(type);
        var angle = MathF.Atan2(dirY, dirX) + Rand(-spread, spread);
        var v = speed * Rand(0.6f, 1.15f);
        var vx = MathF.Cos(angle) * v;
        var vy = MathF.Sin(angle) * v;
        switch (type)
        {
            case ArenaTypes.Fire:
                // Deep orange to yellow, never white: many flames overlap and light adds up.
                Add(Kind.Glow, x, y, vx, vy - 20, Rand(0.25f, 0.5f), Rand(8, 14) * scale,
                    (_random.Next(3) == 0 ? new SKColor(255, 200, 60) : new SKColor(240, 90, 20)).WithAlpha(120), grow: -14, gravity: -90, drag: 0.92f);
                if (_random.Next(3) == 0) Add(Kind.Smoke, x, y, vx * 0.3f, vy * 0.3f - 30, 0.7f, 8 * scale, new SKColor(60, 40, 30, 90), additive: false, grow: 22, gravity: -40);
                break;
            case ArenaTypes.Water:
                Add(Kind.Glow, x, y, vx, vy, Rand(0.3f, 0.55f), Rand(5, 9) * scale, Light(color, Rand(0.1f, 0.5f)), gravity: 380, drag: 0.97f);
                if (_random.Next(3) == 0) Add(Kind.Bubble, x, y, vx * 0.4f, vy * 0.4f - 20, 0.6f, Rand(3, 6) * scale, Light(color, 0.6f), grow: 4);
                break;
            case ArenaTypes.Electric:
                Add(Kind.Spark, x, y, vx * 1.6f, vy * 1.6f, Rand(0.12f, 0.25f), Rand(2, 3.5f) * scale, Light(color, Rand(0.2f, 0.8f)), drag: 0.85f);
                break;
            case ArenaTypes.Grass or ArenaTypes.Bug:
                Add(Kind.Leaf, x, y, vx, vy, Rand(0.5f, 0.9f), Rand(5, 8) * scale, Light(color, Rand(0, 0.3f)), additive: false, drag: 0.94f, spin: Rand(-12, 12));
                break;
            case ArenaTypes.Ice:
                Add(Kind.Shard, x, y, vx, vy, Rand(0.35f, 0.7f), Rand(5, 9) * scale, Light(color, Rand(0.3f, 0.8f)), drag: 0.93f, spin: Rand(-6, 6));
                if (_random.Next(2) == 0) Add(Kind.Star, x, y, vx * 0.3f, vy * 0.3f, 0.4f, Rand(3, 5) * scale, SKColors.White);
                break;
            case ArenaTypes.Poison:
                Add(Kind.Bubble, x, y, vx * 0.6f, vy * 0.6f - 25, Rand(0.4f, 0.8f), Rand(4, 8) * scale, Light(color, 0.2f), grow: 8);
                Add(Kind.Glow, x, y, vx, vy, 0.35f, 7 * scale, color, grow: -10);
                break;
            case ArenaTypes.Ground or ArenaTypes.Rock:
                Add(Kind.Rock, x, y, vx, vy - 80, Rand(0.4f, 0.8f), Rand(4, 8) * scale, Dark(color, Rand(0, 0.35f)), additive: false, gravity: 600, drag: 0.98f, spin: Rand(-8, 8));
                if (_random.Next(2) == 0) Add(Kind.Smoke, x, y, vx * 0.2f, vy * 0.2f, 0.8f, 10 * scale, color.WithAlpha(80), additive: false, grow: 30);
                break;
            case ArenaTypes.Ghost:
                Add(Kind.Wisp, x, y, vx * 0.6f, vy * 0.6f - 15, Rand(0.5f, 0.9f), Rand(7, 12) * scale, Light(color, 0.2f), grow: 6, drag: 0.9f);
                break;
            case ArenaTypes.Psychic:
                Add(Kind.Ring, x, y, vx * 0.2f, vy * 0.2f, 0.45f, 4 * scale, Light(color, 0.3f), grow: 70);
                Add(Kind.Glow, x, y, vx, vy, 0.35f, 6 * scale, Light(color, 0.5f), grow: -8);
                break;
            case ArenaTypes.Dragon:
                Add(Kind.Glow, x, y, vx + -dirY * 120 * MathF.Sin(_time * 18), vy + dirX * 120 * MathF.Sin(_time * 18), Rand(0.3f, 0.55f), Rand(8, 13) * scale,
                    _random.Next(2) == 0 ? color : new SKColor(0x40, 0x90, 0xFF), grow: -12);
                break;
            case ArenaTypes.Dark:
                Add(Kind.Smoke, x, y, vx * 0.5f, vy * 0.5f, 0.6f, 9 * scale, new SKColor(30, 10, 40, 150), additive: false, grow: 18);
                Add(Kind.Glow, x, y, vx, vy, 0.3f, 6 * scale, new SKColor(160, 60, 200), grow: -8);
                break;
            case ArenaTypes.Steel:
                Add(Kind.Spark, x, y, vx * 1.3f, vy * 1.3f, Rand(0.15f, 0.3f), 2.5f * scale, Light(color, 0.6f), gravity: 200, drag: 0.9f);
                break;
            case ArenaTypes.Fairy:
                Add(Kind.Star, x, y, vx * 0.6f, vy * 0.6f, Rand(0.4f, 0.8f), Rand(4, 7) * scale, Light(color, Rand(0.2f, 0.7f)), drag: 0.92f, spin: 4);
                break;
            case ArenaTypes.Flying:
                Add(Kind.Ring, x, y, vx * 0.8f, vy * 0.8f, 0.3f, 3 * scale, new SKColor(235, 240, 255, 200), grow: 50);
                Add(Kind.Spark, x, y, vx * 1.4f, vy * 1.4f, 0.2f, 2 * scale, SKColors.White, drag: 0.9f);
                break;
            case ArenaTypes.Fighting:
                Add(Kind.Spark, x, y, vx * 1.5f, vy * 1.5f, 0.2f, 3 * scale, Light(color, 0.4f), drag: 0.86f);
                Add(Kind.Glow, x, y, vx * 0.5f, vy * 0.5f, 0.25f, 9 * scale, new SKColor(255, 170, 60), grow: -20);
                break;
            default:
                Add(Kind.Glow, x, y, vx, vy, Rand(0.25f, 0.45f), Rand(5, 9) * scale, Light(color, 0.5f), grow: -10);
                if (_random.Next(2) == 0) Add(Kind.Star, x, y, vx * 0.5f, vy * 0.5f, 0.3f, 4 * scale, SKColors.White);
                break;
        }
    }

    /// <summary>Turns what happened this tick into effects, numbers and banners.</summary>
    public void Absorb(IReadOnlyList<ArenaFx> effects)
    {
        foreach (var raw in effects)
        {
            var fx = raw with { Y = raw.Y - Lift };
            var color = TypeColor(fx.Type);
            switch (fx.Kind)
            {
                case ArenaFxKind.Cast:
                    for (var i = 0; i < 10; i++) Matter(fx.Type, fx.X + fx.DirX * 30, fx.Y + fx.DirY * 30, fx.DirX, fx.DirY, 160, 0.6f, 0.8f);
                    if (fx.Shape == ArenaShape.Strike)
                        for (var i = 0; i < 8; i++)
                            Add(Kind.Spark, fx.X - fx.DirX * 10 + Rand(-20, 20), fx.Y - fx.DirY * 10 + Rand(-20, 20), -fx.DirX * 400, -fx.DirY * 400, 0.18f, 2, SKColors.White.WithAlpha(200));
                    break;
                case ArenaFxKind.Hit:
                    // A stream (Flamethrower...) hits five times: small sparks, small numbers, one note.
                    var lick = fx.Shape == ArenaShape.Cone;
                    var big = Math.Clamp(fx.Amount / 60f, 0.6f, 2.2f) * (fx.Critical ? 1.4f : 1) * (lick ? 0.6f : 1);
                    var count = (int)(14 * big) + (fx.Effectiveness > 1 ? 14 : 0);
                    for (var i = 0; i < count; i++) Matter(fx.Type, fx.X, fx.Y, fx.DirX, fx.DirY, 260 * big, 1.3f, big);
                    for (var i = 0; i < (lick ? 2 : 6); i++) Add(Kind.Spark, fx.X, fx.Y, Rand(-1, 1) * 520, Rand(-1, 1) * 520, 0.16f, 2.2f, SKColors.White.WithAlpha(210));
                    Add(Kind.Ring, fx.X, fx.Y, 0, 0, 0.28f, 10, Light(color, 0.4f), grow: 260 * big);
                    Add(Kind.Glow, fx.X, fx.Y, 0, 0, 0.16f, 22 * Math.Min(big, 1.3f), Light(color, 0.4f).WithAlpha(130), grow: -90);
                    if (fx.Amount > 0)
                    {
                        var number = ((int)Math.Ceiling(fx.Amount)).ToString(System.Globalization.CultureInfo.InvariantCulture);
                        _texts.Add(new FloatText(number, fx.X + Rand(lick ? -34 : -12, lick ? 34 : 12), fx.Y - 64 + (lick ? Rand(-14, 14) : 0),
                            fx.Critical ? new SKColor(255, 220, 80) : SKColors.White, fx.Critical ? 34 : lick ? 19 : 26, _time, 0.9f, 60));
                    }
                    var note = fx.Effectiveness switch
                    {
                        0 => "No effect",
                        > 1.5f => "Super effective!",
                        < 0.75f => "Not very effective",
                        _ => fx.Critical ? "Critical hit!" : null,
                    };
                    if (note is not null && lick && _texts.Any(t => t.Text == note && _time - t.Born < 0.8f)) note = null;
                    if (note is not null)
                        _texts.Add(new FloatText(note, fx.X, fx.Y - 100, fx.Effectiveness > 1.5f ? new SKColor(255, 120, 60) : new SKColor(200, 200, 220), 18, _time, 1.1f, 60));
                    if (fx.Effectiveness > 1.5f || fx.Critical) Flash(Light(color, 0.6f), 0.12f);
                    break;
                case ArenaFxKind.Heal:
                    for (var i = 0; i < 26; i++)
                        Add(Kind.Star, fx.X + Rand(-34, 34), fx.Y + Rand(-10, 30), Rand(-20, 20), Rand(-160, -60), Rand(0.6f, 1.1f), Rand(3, 6), new SKColor(140, 255, 160));
                    _texts.Add(new FloatText($"+{(int)fx.Amount}", fx.X, fx.Y - 60, new SKColor(140, 255, 160), 24, _time, 1, 60));
                    break;
                case ArenaFxKind.Buff:
                    for (var i = 0; i < 20; i++)
                        Add(Kind.Glow, fx.X + Rand(-30, 30), fx.Y + Rand(-5, 25), 0, Rand(-220, -120), Rand(0.4f, 0.7f), Rand(3, 6), new SKColor(255, 120, 90), grow: -4);
                    _texts.Add(new FloatText("Power up!", fx.X, fx.Y - 70, new SKColor(255, 150, 110), 18, _time, 1, 40));
                    break;
                case ArenaFxKind.Shield:
                    Add(Kind.Ring, fx.X, fx.Y - 20, 0, 0, 0.4f, 20, new SKColor(120, 220, 255), grow: 90);
                    break;
                case ArenaFxKind.Blocked:
                    for (var i = 0; i < 10; i++) Add(Kind.Spark, fx.X, fx.Y - 20, Rand(-1, 1) * 380, Rand(-1, 1) * 380, 0.2f, 2.5f, new SKColor(150, 230, 255));
                    _texts.Add(new FloatText("Blocked", fx.X, fx.Y - 70, new SKColor(150, 230, 255), 18, _time, 0.8f, 40));
                    break;
                case ArenaFxKind.Dodge:
                    for (var i = 0; i < 10; i++)
                        Add(Kind.Smoke, fx.X + Rand(-12, 12), raw.Y + Rand(-4, 8), -fx.DirX * Rand(30, 90), -fx.DirY * Rand(30, 90), 0.4f, 6, new SKColor(230, 230, 240, 110), additive: false, grow: 30);
                    break;
                case ArenaFxKind.SecondWind:
                    Flash(new SKColor(255, 230, 140), 0.5f);
                    for (var i = 0; i < 3; i++) Add(Kind.Ring, fx.X, fx.Y - 20, 0, 0, 0.6f + i * 0.15f, 10, new SKColor(255, 220, 120), grow: 520 + i * 120);
                    for (var i = 0; i < 70; i++)
                        Add(Kind.Glow, fx.X, fx.Y - 20, Rand(-1, 1) * 420, Rand(-1, 1) * 420, Rand(0.5f, 1), Rand(4, 9), new SKColor(255, 210, 100), grow: -6, drag: 0.93f);
                    Banner("The Champion refuses to fall!", new SKColor(255, 220, 120), 2.2f);
                    break;
                case ArenaFxKind.Enrage:
                    Flash(new SKColor(255, 80, 60), 0.3f);
                    Banner("The Champion is furious!", new SKColor(255, 110, 90), 1.8f);
                    break;
                case ArenaFxKind.Knockout:
                    Flash(SKColors.White, 0.4f);
                    for (var i = 0; i < 4; i++) Add(Kind.Ring, fx.X, fx.Y - 20, 0, 0, 0.7f + i * 0.12f, 10, Light(color, 0.5f), grow: 700 + i * 150);
                    for (var i = 0; i < 70; i++) Matter(fx.Type, fx.X, fx.Y - 20, Rand(-1, 1), Rand(-1, 1), 520, MathF.PI, 1.2f);
                    Banner("K.O.!", SKColors.White, 2.5f);
                    break;
                case ArenaFxKind.TimeUp:
                    Banner("Time!", SKColors.White, 2.2f);
                    break;
            }
        }
    }

    public void Banner(string text, SKColor color, float life) => _banner = (text, color, _time, life);

    private void Flash(SKColor color, float strength)
    {
        _flashColor = color;
        _flash = Math.Max(_flash, strength);
    }

    /// <summary>Moves the effects on and lets moving things leave their trails.</summary>
    public void Update(float dt, ArenaBattle battle)
    {
        _time += dt;
        _flash = Math.Max(0, _flash - dt * 2.2f);
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
        _texts.RemoveAll(t => _time - t.Born > t.Life);

        foreach (var shot in battle.Projectiles)
        {
            var length = MathF.Max(1, MathF.Sqrt(shot.VelocityX * shot.VelocityX + shot.VelocityY * shot.VelocityY));
            for (var k = 0; k < 3; k++)
                Matter(shot.Type, shot.X + Rand(-4, 4), shot.Y - Lift + Rand(-4, 4), -shot.VelocityX / length, -shot.VelocityY / length, 90, 0.5f, shot.Radius / 22f);
        }
        foreach (var fighter in new[] { battle.Player, battle.Champion })
        {
            if (fighter.Casting >= 0)
            {
                var move = fighter.Moves[fighter.Casting];
                if (move.Shape == ArenaShape.Cone)
                    for (var k = 0; k < 6; k++)
                        Matter(move.Type, fighter.X + fighter.AimX * 36, fighter.Y - Lift + fighter.AimY * 36, fighter.AimX, fighter.AimY, ArenaBattle.ConeReach * 2.2f, ArenaBattle.ConeHalfAngle * 0.8f, 1.2f);
                else if (move.Shape == ArenaShape.Beam && fighter.CastTime < ArenaBattle.BeamWindup)
                    for (var k = 0; k < 3; k++)
                    {
                        var a = Rand(0, MathF.Tau);
                        Add(Kind.Glow, fighter.X + fighter.AimX * 40 + MathF.Cos(a) * 46, fighter.Y - Lift + fighter.AimY * 40 + MathF.Sin(a) * 46,
                            -MathF.Cos(a) * 160, -MathF.Sin(a) * 160, 0.28f, 4, Light(TypeColor(move.Type), 0.5f), drag: 1);
                    }
                else if (move.Shape == ArenaShape.Beam)
                    for (var k = 0; k < 12; k++)
                    {
                        var along = Rand(40, 900);
                        Matter(move.Type, fighter.X + fighter.AimX * along, fighter.Y - Lift + fighter.AimY * along, -fighter.AimY, fighter.AimX, 80, MathF.PI, 1);
                    }
                else if (move.Shape == ArenaShape.Strike)
                    Add(Kind.Glow, fighter.X + Rand(-10, 10), fighter.Y - Lift + Rand(-10, 10), 0, 0, 0.2f, 14, TypeColor(move.Type).WithAlpha(150), grow: -40);
            }
            if (fighter.BuffGlow > 0 && _random.Next(2) == 0)
                Add(Kind.Glow, fighter.X + Rand(-26, 26), fighter.Y + Rand(-6, 6), 0, Rand(-160, -90), 0.5f, Rand(2, 4), new SKColor(255, 140, 90), grow: -3);
            if (fighter.IsChampion && battle.ChampionEnraged && _random.Next(2) == 0)
                Add(Kind.Glow, fighter.X + Rand(-24, 24), fighter.Y + Rand(-4, 8), Rand(-15, 15), Rand(-200, -110), Rand(0.35f, 0.6f), Rand(5, 9),
                    _random.Next(3) == 0 ? new SKColor(255, 220, 120) : new SKColor(255, 90, 50), grow: -10, gravity: -60);
            if (fighter.DodgeTime > 0)
                Add(Kind.Smoke, fighter.X, fighter.Y + 4, 0, 0, 0.25f, 9, new SKColor(255, 255, 255, 70), additive: false, grow: 20);
        }
        foreach (var ring in battle.Rings)
        {
            var radius = ring.Radius;
            for (var k = 0; k < 6; k++)
            {
                var a = Rand(0, MathF.Tau);
                Matter(ring.Type, ring.X + MathF.Cos(a) * radius, ring.Y + MathF.Sin(a) * radius * 0.6f, MathF.Cos(a), MathF.Sin(a), 120, 0.3f, 1);
            }
        }
    }

    // ── Drawing ─────────────────────────────────────────────────────────────

    /// <summary>The world (960 by 540) fitted into the view, centred.</summary>
    public static (float Scale, float X, float Y) Fit(SKRect view)
    {
        var scale = Math.Min(view.Width / ArenaBattle.Width, view.Height / ArenaBattle.Height);
        return (scale, view.Left + (view.Width - ArenaBattle.Width * scale) / 2, view.Top + (view.Height - ArenaBattle.Height * scale) / 2);
    }

    public void Draw(SKCanvas c, SKRect view, ArenaBattle battle, string championLabel, float density)
    {
        var (scale, ox, oy) = Fit(view);
        var shake = battle.Shake * battle.Shake * 9 * scale;
        var sx = Rand(-shake, shake);
        var sy = Rand(-shake, shake);
        DrawFloor(c, view, scale, ox + sx, oy + sy, battle.Champion.Spec.Type1);
        c.Save();
        c.Translate(ox + sx, oy + sy);
        c.Scale(scale);

        foreach (var ring in battle.Rings) DrawRing(c, ring);
        foreach (var fighter in new[] { battle.Player, battle.Champion }) DrawTelegraph(c, fighter);
        DrawParticles(c, additive: false);
        var order = battle.Player.Y <= battle.Champion.Y ? new[] { battle.Player, battle.Champion } : [battle.Champion, battle.Player];
        foreach (var fighter in order) DrawFighter(c, fighter, battle);
        foreach (var shot in battle.Projectiles) DrawProjectile(c, shot);
        foreach (var fighter in new[] { battle.Player, battle.Champion }) DrawBeam(c, fighter);
        DrawParticles(c, additive: true);
        DrawTexts(c);
        c.Restore();

        if (_flash > 0)
        {
            _paint.BlendMode = SKBlendMode.Plus;
            _paint.Color = _flashColor.WithAlpha((byte)(Math.Min(1, _flash) * 120));
            c.DrawRect(view, _paint);
            _paint.BlendMode = SKBlendMode.SrcOver;
        }
        DrawHud(c, view, battle, championLabel, density);
        DrawBanner(c, view, density);
    }

    /// <summary>The floor fills the whole screen (phones are wider than the arena); the court sits in the middle.</summary>
    private void DrawFloor(SKCanvas c, SKRect view, float scale, float ox, float oy, int type)
    {
        var size = new SKSizeI((int)view.Width, (int)view.Height);
        if (_floor is null || _floorSize != size || _floorType != type)
        {
            _floor?.Dispose();
            _floorSize = size;
            _floorType = type;
            var (fitScale, fx, fy) = Fit(new SKRect(0, 0, view.Width, view.Height));
            _floor = PaintFloor(size, fitScale, fx, fy, TypeColor(type));
        }
        c.Clear(new SKColor(14, 15, 24));
        if (_floor is not null) c.DrawImage(_floor, view.Left + ox - Fit(view).X, view.Top + oy - Fit(view).Y);
        // Lights sweeping slowly over the floor.
        c.Save();
        c.Translate(ox, oy);
        c.Scale(scale);
        _paint.BlendMode = SKBlendMode.Plus;
        for (var i = 0; i < 2; i++)
        {
            var x = ArenaBattle.Width / 2 + MathF.Sin(_time * 0.4f + i * 2.4f) * 360;
            using var shader = SKShader.CreateRadialGradient(new SKPoint(x, ArenaBattle.Height * 0.6f), 260,
                [TypeColor(type).WithAlpha(26), SKColors.Transparent], SKShaderTileMode.Clamp);
            _paint.Shader = shader;
            c.DrawCircle(x, ArenaBattle.Height * 0.6f, 260, _paint);
            _paint.Shader = null;
        }
        _paint.BlendMode = SKBlendMode.SrcOver;
        c.Restore();
    }

    private static SKImage? PaintFloor(SKSizeI size, float scale, float ox, float oy, SKColor accent)
    {
        if (size.Width <= 0 || size.Height <= 0) return null;
        using var surface = SKSurface.Create(new SKImageInfo(size.Width, size.Height, SKColorType.Rgba8888, SKAlphaType.Premul));
        if (surface is null) return null;
        var c = surface.Canvas;
        using var paint = new SKPaint { IsAntialias = true };
        using (var shader = SKShader.CreateRadialGradient(new SKPoint(size.Width / 2f, size.Height * 0.55f), size.Width * 0.7f,
                   [new SKColor(48, 54, 78), new SKColor(16, 18, 30)], SKShaderTileMode.Clamp))
        {
            paint.Shader = shader;
            c.DrawRect(0, 0, size.Width, size.Height, paint);
            paint.Shader = null;
        }
        c.Translate(ox, oy);
        c.Scale(scale);
        const float w = ArenaBattle.Width, h = ArenaBattle.Height;
        // Floor tiles, across the whole screen.
        paint.Color = new SKColor(255, 255, 255, 10);
        var left = -ox / scale;
        var right = (size.Width - ox) / scale;
        for (var x = MathF.Floor(left / 48) * 48; x <= right; x += 48) c.DrawRect(x, -oy / scale, 1.5f, h + 2 * oy / scale, paint);
        for (var y = 0f; y <= h; y += 48) c.DrawRect(left, y, right - left, 1.5f, paint);
        // The court: its lines, the middle circle and a Poké Ball line in the middle.
        var court = new SKRect(26, ArenaBattle.Top - 70, w - 26, h - 8);
        using var line = new SKPaint { IsAntialias = true, Style = SKPaintStyle.Stroke, StrokeWidth = 4, Color = new SKColor(255, 255, 255, 60) };
        c.DrawRoundRect(court, 26, 26, line);
        c.DrawLine(w / 2, court.Top, w / 2, court.Bottom, line);
        c.DrawOval(w / 2, court.MidY, 96, 64, line);
        line.Color = accent.WithAlpha(90);
        line.StrokeWidth = 8;
        c.DrawRoundRect(SKRect.Inflate(court, 8, 8), 32, 32, line);
        paint.Color = new SKColor(255, 255, 255, 22);
        c.DrawOval(w / 2, court.MidY, 40, 27, paint);
        paint.Color = accent.WithAlpha(40);
        c.DrawRect(w / 2 - 40, court.MidY - 2, 80, 4, paint);
        return surface.Snapshot();
    }

    private void DrawTelegraph(SKCanvas c, ArenaFighter fighter)
    {
        if (fighter.Casting < 0) return;
        var move = fighter.Moves[fighter.Casting];
        if (move.Shape != ArenaShape.Beam || fighter.CastTime >= ArenaBattle.BeamWindup) return;
        var t = fighter.CastTime / ArenaBattle.BeamWindup;
        _stroke.StrokeWidth = 2 + t * 6;
        _stroke.Color = TypeColor(move.Type).WithAlpha((byte)(60 + 120 * MathF.Abs(MathF.Sin(_time * 40))));
        c.DrawLine(fighter.X, fighter.Y - Lift, fighter.X + fighter.AimX * 1100, fighter.Y - Lift + fighter.AimY * 1100, _stroke);
        _paint.BlendMode = SKBlendMode.Plus;
        _paint.Color = Light(TypeColor(move.Type), 0.4f).WithAlpha(200);
        c.DrawCircle(fighter.X + fighter.AimX * 40, fighter.Y - Lift + fighter.AimY * 40, 6 + t * 18, _paint);
        _paint.BlendMode = SKBlendMode.SrcOver;
    }

    private void DrawBeam(SKCanvas c, ArenaFighter fighter)
    {
        if (fighter.Casting < 0) return;
        var move = fighter.Moves[fighter.Casting];
        if (move.Shape != ArenaShape.Beam || fighter.CastTime < ArenaBattle.BeamWindup) return;
        var t = Math.Clamp((fighter.CastTime - ArenaBattle.BeamWindup) / ArenaBattle.BeamLength, 0, 1);
        var fade = 1 - t * t;
        var color = TypeColor(move.Type);
        var x0 = fighter.X + fighter.AimX * 30;
        var y0 = fighter.Y - Lift + fighter.AimY * 30;
        var x1 = fighter.X + fighter.AimX * 1200;
        var y1 = fighter.Y - Lift + fighter.AimY * 1200;
        _stroke.BlendMode = SKBlendMode.Plus;
        _stroke.StrokeCap = SKStrokeCap.Round;
        foreach (var (width, alpha, light) in new[] { (ArenaBattle.BeamWidth * 2.4f, 60, 0f), (ArenaBattle.BeamWidth * 1.3f, 140, 0.3f), (ArenaBattle.BeamWidth * 0.45f, 255, 0.85f) })
        {
            _stroke.StrokeWidth = width * (0.7f + 0.3f * MathF.Sin(_time * 60)) * fade + 1;
            _stroke.Color = Light(color, light).WithAlpha((byte)(alpha * fade));
            if (move.Type == ArenaTypes.Electric) DrawBolt(c, x0, y0, x1, y1, 26, _stroke);
            else c.DrawLine(x0, y0, x1, y1, _stroke);
        }
        _stroke.BlendMode = SKBlendMode.SrcOver;
        _stroke.StrokeCap = SKStrokeCap.Butt;
    }

    private void DrawBolt(SKCanvas c, float x0, float y0, float x1, float y1, float jag, SKPaint paint)
    {
        using var path = new SKPath();
        path.MoveTo(x0, y0);
        var dx = x1 - x0;
        var dy = y1 - y0;
        var length = MathF.Max(1, MathF.Sqrt(dx * dx + dy * dy));
        var nx = -dy / length;
        var ny = dx / length;
        var steps = Math.Max(3, (int)(length / 40));
        for (var i = 1; i < steps; i++)
        {
            var f = i / (float)steps;
            var off = Rand(-jag, jag);
            path.LineTo(x0 + dx * f + nx * off, y0 + dy * f + ny * off);
        }
        path.LineTo(x1, y1);
        c.DrawPath(path, paint);
    }

    private void DrawRing(SKCanvas c, ArenaRing ring)
    {
        var t = Math.Clamp(ring.Age / ArenaBattle.RingTime, 0, 1);
        var color = TypeColor(ring.Type);
        _stroke.StrokeWidth = 14 * (1 - t) + 2;
        _stroke.Color = Light(color, 0.3f).WithAlpha((byte)(220 * (1 - t)));
        c.DrawOval(ring.X, ring.Y, ring.Radius, ring.Radius * 0.62f, _stroke);
        _paint.Color = color.WithAlpha((byte)(70 * (1 - t)));
        c.DrawOval(ring.X, ring.Y, ring.Radius, ring.Radius * 0.62f, _paint);
    }

    private void DrawProjectile(SKCanvas c, ArenaProjectile shot)
    {
        var color = TypeColor(shot.Type);
        c.Save();
        c.Translate(0, -Lift);
        var pulse = 1 + 0.15f * MathF.Sin(_time * 30 + shot.X * 0.05f);
        _paint.BlendMode = SKBlendMode.Plus;
        _paint.Color = color.WithAlpha(70);
        c.DrawCircle(shot.X, shot.Y, shot.Radius * 2.1f * pulse, _paint);
        _paint.Color = Light(color, 0.35f).WithAlpha(190);
        c.DrawCircle(shot.X, shot.Y, shot.Radius * 1.15f * pulse, _paint);
        _paint.Color = Light(color, 0.85f);
        c.DrawCircle(shot.X, shot.Y, shot.Radius * 0.55f, _paint);
        if (shot.Type == ArenaTypes.Electric)
        {
            _stroke.BlendMode = SKBlendMode.Plus;
            _stroke.StrokeWidth = 2.5f;
            _stroke.Color = new SKColor(255, 250, 200, 230);
            var length = MathF.Max(1, MathF.Sqrt(shot.VelocityX * shot.VelocityX + shot.VelocityY * shot.VelocityY));
            DrawBolt(c, shot.X, shot.Y, shot.X - shot.VelocityX / length * 70, shot.Y - shot.VelocityY / length * 70, 10, _stroke);
            for (var i = 0; i < 2; i++)
            {
                var a = Rand(0, MathF.Tau);
                DrawBolt(c, shot.X, shot.Y, shot.X + MathF.Cos(a) * shot.Radius * 1.8f, shot.Y + MathF.Sin(a) * shot.Radius * 1.8f, 5, _stroke);
            }
            _stroke.BlendMode = SKBlendMode.SrcOver;
        }
        _paint.BlendMode = SKBlendMode.SrcOver;
        c.Restore();
    }

    private void DrawParticles(SKCanvas c, bool additive)
    {
        for (var i = 0; i < _count; i++)
        {
            ref var p = ref _particles[i];
            if (p.Additive != additive) continue;
            var fade = Math.Clamp(p.Life / p.Max, 0, 1);
            var alpha = (byte)(p.Color.Alpha * Math.Min(1, fade * 1.6f));
            var color = p.Color.WithAlpha(alpha);
            _paint.BlendMode = additive ? SKBlendMode.Plus : SKBlendMode.SrcOver;
            switch (p.Kind)
            {
                case Kind.Glow:
                    _paint.Color = color.WithAlpha((byte)(alpha * 0.35f));
                    c.DrawCircle(p.X, p.Y, p.Size * 1.9f, _paint);
                    _paint.Color = color;
                    c.DrawCircle(p.X, p.Y, p.Size, _paint);
                    break;
                case Kind.Spark:
                    _stroke.BlendMode = _paint.BlendMode;
                    _stroke.Color = color;
                    _stroke.StrokeWidth = p.Size;
                    _stroke.StrokeCap = SKStrokeCap.Round;
                    c.DrawLine(p.X, p.Y, p.X - p.VX * 0.035f, p.Y - p.VY * 0.035f, _stroke);
                    _stroke.StrokeCap = SKStrokeCap.Butt;
                    break;
                case Kind.Leaf:
                    c.Save();
                    c.Translate(p.X, p.Y);
                    c.RotateRadians(p.Angle);
                    _paint.Color = color;
                    c.DrawOval(0, 0, p.Size, p.Size * 0.45f, _paint);
                    _paint.Color = Dark(color, 0.35f).WithAlpha(alpha);
                    c.DrawRect(-p.Size, -0.6f, p.Size * 2, 1.2f, _paint);
                    c.Restore();
                    break;
                case Kind.Shard or Kind.Rock:
                    c.Save();
                    c.Translate(p.X, p.Y);
                    c.RotateRadians(p.Angle);
                    using (var path = new SKPath())
                    {
                        if (p.Kind == Kind.Shard)
                        {
                            path.MoveTo(0, -p.Size * 1.4f);
                            path.LineTo(p.Size * 0.5f, 0);
                            path.LineTo(0, p.Size * 1.4f);
                            path.LineTo(-p.Size * 0.5f, 0);
                        }
                        else
                        {
                            path.MoveTo(-p.Size, -p.Size * 0.6f);
                            path.LineTo(p.Size * 0.3f, -p.Size);
                            path.LineTo(p.Size, p.Size * 0.2f);
                            path.LineTo(-p.Size * 0.2f, p.Size);
                        }
                        path.Close();
                        _paint.Color = color;
                        c.DrawPath(path, _paint);
                    }
                    c.Restore();
                    break;
                case Kind.Bubble:
                    _stroke.BlendMode = _paint.BlendMode;
                    _stroke.Color = color;
                    _stroke.StrokeWidth = 1.6f;
                    c.DrawCircle(p.X, p.Y, p.Size, _stroke);
                    _paint.Color = SKColors.White.WithAlpha((byte)(alpha * 0.6f));
                    c.DrawCircle(p.X - p.Size * 0.35f, p.Y - p.Size * 0.35f, p.Size * 0.25f, _paint);
                    break;
                case Kind.Smoke:
                    _paint.Color = color;
                    c.DrawCircle(p.X, p.Y, p.Size, _paint);
                    break;
                case Kind.Ring:
                    _stroke.BlendMode = _paint.BlendMode;
                    _stroke.Color = color;
                    _stroke.StrokeWidth = Math.Max(1, 6 * fade);
                    c.DrawOval(p.X, p.Y, p.Size, p.Size * 0.7f, _stroke);
                    break;
                case Kind.Star:
                    c.Save();
                    c.Translate(p.X, p.Y);
                    c.RotateRadians(p.Angle);
                    _paint.Color = color;
                    c.DrawRect(-p.Size, -p.Size * 0.18f, p.Size * 2, p.Size * 0.36f, _paint);
                    c.DrawRect(-p.Size * 0.18f, -p.Size, p.Size * 0.36f, p.Size * 2, _paint);
                    c.Restore();
                    break;
                case Kind.Wisp:
                    _paint.Color = color.WithAlpha((byte)(alpha * 0.5f));
                    c.DrawOval(p.X, p.Y, p.Size, p.Size * 1.4f, _paint);
                    _paint.Color = Light(color, 0.6f).WithAlpha(alpha);
                    c.DrawOval(p.X, p.Y + p.Size * 0.3f, p.Size * 0.45f, p.Size * 0.6f, _paint);
                    break;
            }
        }
        _paint.BlendMode = SKBlendMode.SrcOver;
        _stroke.BlendMode = SKBlendMode.SrcOver;
    }

    private void DrawFighter(SKCanvas c, ArenaFighter fighter, ArenaBattle battle)
    {
        var spec = fighter.Spec;
        var accent = TypeColor(spec.Type1);
        // A ring under the feet: blue for the player, gold for the Champion.
        _paint.Color = new SKColor(0, 0, 0, 90);
        c.DrawOval(fighter.X, fighter.Y + 2, 30, 10, _paint);
        _stroke.StrokeWidth = 3;
        _stroke.Color = (fighter.IsChampion ? new SKColor(255, 200, 70) : new SKColor(80, 170, 255)).WithAlpha(200);
        c.DrawOval(fighter.X, fighter.Y + 2, 36 + MathF.Sin(_time * 5) * 2, 13, _stroke);

        if (fighter.ShieldTime > 0)
        {
            _paint.BlendMode = SKBlendMode.Plus;
            _paint.Color = new SKColor(90, 200, 255, 60);
            c.DrawCircle(fighter.X, fighter.Y - 26, 52, _paint);
            _stroke.Color = new SKColor(160, 230, 255, 220);
            _stroke.StrokeWidth = 3;
            c.DrawCircle(fighter.X, fighter.Y - 26, 52 + MathF.Sin(_time * 20) * 2, _stroke);
            _paint.BlendMode = SKBlendMode.SrcOver;
        }
        if (fighter.IsChampion && (battle.ChampionEnraged || fighter.BuffGlow > 0))
        {
            _paint.BlendMode = SKBlendMode.Plus;
            using var shader = SKShader.CreateRadialGradient(new SKPoint(fighter.X, fighter.Y - 24), 70,
                [new SKColor(255, 170, 60, 90), SKColors.Transparent], SKShaderTileMode.Clamp);
            _paint.Shader = shader;
            c.DrawCircle(fighter.X, fighter.Y - 24, 70, _paint);
            _paint.Shader = null;
            _paint.BlendMode = SKBlendMode.SrcOver;
        }

        var facing = Direction(fighter.FacingX, fighter.FacingY);
        var moving = fighter.IsMoving;
        var frame = _walking?.GetFrame(spec.Species, spec.Form, spec.Shiny, facing, (long)(_time * 1000 * (moving ? 1.6f : 1)), moving);
        SKBitmap? bitmap = frame?.Bitmap ?? _sprites?.GetSprite(spec.Species, spec.Form, spec.Shiny);
        var bob = moving ? MathF.Abs(MathF.Sin(_time * 14)) * -4 : MathF.Sin(_time * 3) * 1.5f;
        if (bitmap is null)
        {
            _paint.Color = accent;
            c.DrawCircle(fighter.X, fighter.Y - 28 + bob, 26, _paint);
            return;
        }
        var (image, crop) = ImageOf(bitmap, still: frame is null);
        SKRect source, dest;
        const float body = 84;
        if (frame is not null)
        {
            source = frame.Source;
            var bounds = frame.Bounds;
            var scale = Math.Min(4.2f, body / Math.Max(1, Math.Max(bounds.Width, bounds.Height)));
            var w = source.Width * scale;
            var h = source.Height * scale;
            var centerY = fighter.Y + bob - bounds.Bottom * scale;
            dest = new SKRect(fighter.X - w / 2, centerY - h / 2, fighter.X + w / 2, centerY + h / 2);
        }
        else
        {
            source = crop;
            var scale = Math.Min(3.4f, body / Math.Max(1, Math.Max(source.Width, source.Height)));
            var w = source.Width * scale;
            var h = source.Height * scale;
            dest = new SKRect(fighter.X - w / 2, fighter.Y + bob - h, fighter.X + w / 2, fighter.Y + bob);
        }
        // Dodging leaves after-images.
        if (fighter.DodgeTime > 0)
        {
            using var ghost = new SKPaint { Color = SKColors.White.WithAlpha(70) };
            for (var i = 1; i <= 3; i++)
            {
                var back = SKRect.Create(dest.Left - fighter.VelocityX * 0.022f * i, dest.Top - fighter.VelocityY * 0.022f * i, dest.Width, dest.Height);
                DrawSprite(c, image, source, back, frame is null && fighter.FacingX < 0, ghost);
            }
        }
        using var paint = new SKPaint();
        if (fighter.HurtFlash > 0)
            paint.ColorFilter = SKColorFilter.CreateBlendMode(SKColors.White.WithAlpha((byte)(255 * Math.Min(1, fighter.HurtFlash / 0.16f))), SKBlendMode.SrcATop);
        else if (fighter.Invulnerable > 0.3f && fighter.IsChampion)
            paint.ColorFilter = SKColorFilter.CreateBlendMode(new SKColor(255, 220, 120, 120), SKBlendMode.SrcATop);
        DrawSprite(c, image, source, dest, frame is null && fighter.FacingX < 0, paint);
    }

    private void DrawSprite(SKCanvas c, SKImage image, SKRect source, SKRect dest, bool flip, SKPaint paint)
    {
        if (!flip)
        {
            c.DrawImage(image, source, dest, _pixel, paint);
            return;
        }
        c.Save();
        c.Translate(dest.MidX, 0);
        c.Scale(-1, 1);
        c.DrawImage(image, source, SKRect.Create(-dest.Width / 2, dest.Top, dest.Width, dest.Height), _pixel, paint);
        c.Restore();
    }

    /// <summary>The PMD row for a facing: 0 south, then SE, E, NE, N, NW, W, SW.</summary>
    private static int Direction(float x, float y)
    {
        if (x * x + y * y < 0.0001f) return 0;
        var angle = MathF.Atan2(y, x) * 180 / MathF.PI;
        var step = (int)MathF.Round((90 - angle) / 45f);
        return ((step % 8) + 8) % 8;
    }

    private (SKImage Image, SKRect Crop) ImageOf(SKBitmap bitmap, bool still)
    {
        if (_images.TryGetValue(bitmap, out var known)) return known;
        var image = SKImage.FromBitmap(bitmap);
        // Walking sheets carry their own bounds; only a still sprite is measured.
        var crop = still ? Visible(bitmap) : new SKRect(0, 0, bitmap.Width, bitmap.Height);
        _images[bitmap] = (image, crop);
        return (image, crop);
    }

    /// <summary>The part of a still sprite that is not transparent (box sprites have empty margins).</summary>
    private static SKRect Visible(SKBitmap bitmap)
    {
        int left = bitmap.Width, top = bitmap.Height, right = -1, bottom = -1;
        for (var y = 0; y < bitmap.Height; y++)
            for (var x = 0; x < bitmap.Width; x++)
                if (bitmap.GetPixel(x, y).Alpha > 16)
                {
                    if (x < left) left = x;
                    if (x > right) right = x;
                    if (y < top) top = y;
                    if (y > bottom) bottom = y;
                }
        return right < 0 ? new SKRect(0, 0, bitmap.Width, bitmap.Height) : new SKRect(left, top, right + 1, bottom + 1);
    }

    private void DrawTexts(SKCanvas c)
    {
        foreach (var text in _texts)
        {
            var age = _time - text.Born;
            var t = age / text.Life;
            var pop = age < 0.12f ? 0.6f + age / 0.12f * 0.6f : 1.2f - Math.Min(0.2f, (age - 0.12f) * 2);
            var alpha = (byte)(255 * Math.Clamp(1.4f - t * 1.4f, 0, 1));
            using var font = PixelFont.For(text.Text, text.Size * pop);
            _paint.Color = new SKColor(0, 0, 0, (byte)(alpha * 0.7f));
            var y = text.Y - text.Rise * MathF.Sqrt(t);
            c.DrawText(text.Text, text.X + 2, y + 2, SKTextAlign.Center, font, _paint);
            _paint.Color = text.Color.WithAlpha(alpha);
            c.DrawText(text.Text, text.X, y, SKTextAlign.Center, font, _paint);
        }
    }

    // ── The HUD ─────────────────────────────────────────────────────────────

    private void DrawHud(SKCanvas c, SKRect view, ArenaBattle battle, string championLabel, float d)
    {
        var top = view.Top + 10 * d;
        var width = Math.Min(view.Width * 0.36f, 340 * d);
        DrawBar(c, new SKRect(view.Left + 14 * d, top, view.Left + 14 * d + width, top + 46 * d), battle.Player, battle.Player.Spec.Nickname, false, d);
        DrawBar(c, new SKRect(view.Right - 14 * d - width, top, view.Right - 14 * d, top + 46 * d), battle.Champion, championLabel, true, d);

        var seconds = (int)Math.Ceiling(battle.TimeLeft);
        var urgent = seconds <= 10;
        using var font = PixelFont.For(seconds.ToString(System.Globalization.CultureInfo.InvariantCulture), (urgent ? 34 + MathF.Abs(MathF.Sin(_time * 6)) * 4 : 30) * d);
        _paint.Color = new SKColor(0, 0, 0, 160);
        c.DrawRoundRect(SKRect.Create(view.MidX - 34 * d, top, 68 * d, 44 * d), 10 * d, 10 * d, _paint);
        _paint.Color = urgent ? new SKColor(255, 90, 80) : SKColors.White;
        c.DrawText(seconds.ToString(System.Globalization.CultureInfo.InvariantCulture), view.MidX, top + 34 * d, SKTextAlign.Center, font, _paint);
    }

    private void DrawBar(SKCanvas c, SKRect area, ArenaFighter fighter, string name, bool right, float d)
    {
        _paint.Color = new SKColor(0, 0, 0, 165);
        c.DrawRoundRect(area, 10 * d, 10 * d, _paint);
        _stroke.Color = (fighter.IsChampion ? new SKColor(255, 200, 70) : new SKColor(80, 170, 255)).WithAlpha(220);
        _stroke.StrokeWidth = 2 * d;
        c.DrawRoundRect(area, 10 * d, 10 * d, _stroke);

        using var font = PixelFont.For(name, 16 * d);
        _paint.Color = SKColors.White;
        var label = fighter.Spec.Shiny ? $"{name} ★" : name;
        c.DrawText(label, right ? area.Right - 10 * d : area.Left + 10 * d, area.Top + 18 * d, right ? SKTextAlign.Right : SKTextAlign.Left, font, _paint);
        using var small = PixelFont.For("Lv50", 12 * d);
        _paint.Color = new SKColor(200, 200, 215);
        c.DrawText($"Lv{ArenaFighterSpec.Level}", right ? area.Left + 10 * d : area.Right - 10 * d, area.Top + 18 * d, right ? SKTextAlign.Left : SKTextAlign.Right, small, _paint);

        var bar = new SKRect(area.Left + 10 * d, area.Top + 26 * d, area.Right - 10 * d, area.Top + 38 * d);
        _paint.Color = new SKColor(40, 40, 50);
        c.DrawRoundRect(bar, 4 * d, 4 * d, _paint);
        var shown = fighter.ShownHp;
        var real = fighter.HpFraction;
        SKRect Part(float fraction) => right
            ? new SKRect(bar.Right - bar.Width * fraction, bar.Top, bar.Right, bar.Bottom)
            : new SKRect(bar.Left, bar.Top, bar.Left + bar.Width * fraction, bar.Bottom);
        _paint.Color = new SKColor(255, 80, 70);
        c.DrawRoundRect(Part(shown), 4 * d, 4 * d, _paint);
        _paint.Color = real > 0.5f ? new SKColor(80, 220, 110) : real > 0.2f ? new SKColor(250, 200, 60) : new SKColor(240, 70, 60);
        c.DrawRoundRect(Part(real), 4 * d, 4 * d, _paint);
        _paint.Color = new SKColor(255, 255, 255, 60);
        c.DrawRect(new SKRect(Part(real).Left, bar.Top + 1 * d, Part(real).Right, bar.Top + 4 * d), _paint);

        // Type pills under the bar.
        var types = fighter.Spec.Type2 != fighter.Spec.Type1 ? new[] { fighter.Spec.Type1, fighter.Spec.Type2 } : [fighter.Spec.Type1];
        var x = right ? area.Right - 10 * d : area.Left + 10 * d;
        using var pill = PixelFont.For("Type", 10 * d);
        foreach (var type in types)
        {
            var text = ArenaTypes.Names[Math.Clamp(type, 0, 17)].ToUpperInvariant();
            var w = pill.MeasureText(text) + 10 * d;
            var rect = right ? new SKRect(x - w, area.Bottom + 3 * d, x, area.Bottom + 17 * d) : new SKRect(x, area.Bottom + 3 * d, x + w, area.Bottom + 17 * d);
            _paint.Color = TypeColor(type);
            c.DrawRoundRect(rect, 5 * d, 5 * d, _paint);
            _paint.Color = SKColors.White;
            c.DrawText(text, rect.MidX, rect.Bottom - 4 * d, SKTextAlign.Center, pill, _paint);
            x += right ? -(w + 4 * d) : w + 4 * d;
        }
    }

    private void DrawBanner(SKCanvas c, SKRect view, float d)
    {
        if (_banner is not { } banner) return;
        var age = _time - banner.Born;
        if (age > banner.Life)
        {
            _banner = null;
            return;
        }
        var t = age / banner.Life;
        var scale = age < 0.18f ? 0.4f + age / 0.18f * 0.8f : 1.2f - Math.Min(0.2f, (age - 0.18f));
        var alpha = (byte)(255 * Math.Clamp((1 - t) * 3, 0, 1));
        var size = (banner.Text.Length > 12 ? 30 : 64) * d * scale;
        using var font = PixelFont.For(banner.Text, size);
        var y = view.MidY - 20 * d;
        _paint.Color = new SKColor(0, 0, 0, (byte)(alpha * 0.55f));
        c.DrawRect(new SKRect(view.Left, y - size * 0.95f, view.Right, y + size * 0.35f), _paint);
        _paint.Color = new SKColor(0, 0, 0, alpha);
        c.DrawText(banner.Text, view.MidX + 3 * d, y + 3 * d, SKTextAlign.Center, font, _paint);
        _paint.Color = banner.Color.WithAlpha(alpha);
        c.DrawText(banner.Text, view.MidX, y, SKTextAlign.Center, font, _paint);
    }

    public void Dispose()
    {
        _floor?.Dispose();
        foreach (var (image, _) in _images.Values) image.Dispose();
        _images.Clear();
        _paint.Dispose();
        _stroke.Dispose();
    }
}
