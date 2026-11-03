using PKForge.App.Services;
using PKForge.Domain;
using SkiaSharp;
using Kind = PKForge.App.Views.ArenaParticles.Kind;

namespace PKForge.App.Views;

/// <summary>
/// Draws 3DS Bank 2.5's Arena battle: the floor, the two Pokémon (walking sprites in eight
/// directions when they exist), every move's effect by its type and kind, hits, numbers, the
/// HP bars, the clock and the touch controls.
/// <para>
/// The battle itself is drawn as pixel art: into a 320 by 180 picture (see <see cref="ArenaPixel"/>)
/// blown up by a whole number with no smoothing, so effects sit on the same pixels as the sprites.
/// Every effect takes its colors from <see cref="ArenaPalettes"/> and is built in three layers: a
/// core (the move's shape), a bigger see-through glow around it, and loose particles
/// (<see cref="ArenaParticles"/>). Hits flash and shake (<see cref="ArenaFeel"/>), fast things
/// leave trails and fade slowly (<see cref="ArenaTrails"/>). The HUD stays at screen resolution
/// so the text reads well. All of this only reads the battle: nothing here changes how it plays.
/// </para>
/// </summary>
internal sealed class ArenaRenderer : IDisposable
{
    private sealed record FloatText(string Text, float X, float Y, SKColor Color, float Size, float Born, float Life, float Rise);

    /// <summary>Moves fly at body height: the battle works on the ground plane (the feet).</summary>
    internal const float Lift = 30;

    /// <summary>The pixel face's own size, in art pixels: text drawn at it (or twice it) stays crisp.</summary>
    private const float TextSize = 12;

    private readonly Random _random = new();
    private readonly ArenaParticles _particles;
    private readonly ArenaFeel _feel;
    private readonly ArenaTrails _trails = new();
    private readonly List<FloatText> _texts = [];
    private readonly ISpriteService? _sprites = IPlatformApplication.Current?.Services.GetService<ISpriteService>();
    private readonly PokeparkSpriteService? _walking = IPlatformApplication.Current?.Services.GetService<PokeparkSpriteService>();
    private readonly Dictionary<SKBitmap, (SKImage Image, SKRect Crop)> _images = [];
    // The HUD's paints (screen pixels, smoothed) and the battle's (art pixels, never smoothed).
    private readonly SKPaint _paint = new() { IsAntialias = true };
    private readonly SKPaint _stroke = new() { IsAntialias = true, Style = SKPaintStyle.Stroke };
    private readonly SKPaint _fill = new() { IsAntialias = false };
    private readonly SKPaint _line = new() { IsAntialias = false, Style = SKPaintStyle.Stroke };
    private readonly SKSamplingOptions _pixel = new(SKFilterMode.Nearest);
    private readonly bool[] _beamOn = new bool[2];
    private readonly (int Type, float X0, float Y0, float X1, float Y1)[] _beamAt = new (int, float, float, float, float)[2];
    private SKSurface? _art;
    private SKSizeI _artSize;
    private SKImage? _floor;
    private SKSizeI _floorSize;
    private int _floorType = -1;
    private float _time;
    private (string Text, SKColor Color, float Born, float Life)? _banner;

    public ArenaRenderer()
    {
        _particles = new ArenaParticles(_random);
        _feel = new ArenaFeel(_random);
    }

    /// <summary>The type colors of the controls and the HUD (move buttons, type pills).</summary>
    public static readonly SKColor[] TypeColors =
    [
        new(0xA8, 0xA7, 0x7A), new(0xC2, 0x2E, 0x28), new(0xA9, 0x8F, 0xF3), new(0xA3, 0x3E, 0xA1), new(0xE2, 0xBF, 0x65),
        new(0xB6, 0xA1, 0x36), new(0xA6, 0xB9, 0x1A), new(0x73, 0x57, 0x97), new(0xB7, 0xB7, 0xCE), new(0xEE, 0x81, 0x30),
        new(0x63, 0x90, 0xF0), new(0x7A, 0xC7, 0x4C), new(0xF7, 0xD0, 0x2C), new(0xF9, 0x55, 0x87), new(0x96, 0xD9, 0xD6),
        new(0x6F, 0x35, 0xFC), new(0x70, 0x57, 0x46), new(0xD6, 0x85, 0xAD),
    ];

    public static SKColor TypeColor(int type) => TypeColors[Math.Clamp(type, 0, 17)];

    private float Rand(float min, float max) => min + (float)_random.NextDouble() * (max - min);

    /// <summary>Flickers between two states a few times a second, in whole frames (no smooth pulsing).</summary>
    private bool Blink(float rate, float phase = 0) => (int)(_time * rate + phase) % 2 == 0;

    // ── Events ──────────────────────────────────────────────────────────────

    /// <summary>Turns what happened this tick into effects, numbers and banners.</summary>
    public void Absorb(IReadOnlyList<ArenaFx> effects, ArenaBattle battle)
    {
        foreach (var raw in effects)
        {
            var fx = raw with { Y = raw.Y - Lift };
            var ramp = ArenaPalettes.For(fx.Type);
            switch (fx.Kind)
            {
                case ArenaFxKind.Cast:
                    _particles.Spray(fx.Type, fx.X + fx.DirX * 30, fx.Y + fx.DirY * 30, fx.DirX, fx.DirY, 10, 160, 0.6f, 0.8f);
                    switch (fx.Shape)
                    {
                        case ArenaShape.Strike:
                            _trails.AddSwipe(fx.ByChampion, fx.Type, raw.X, raw.Y, fx.DirX, fx.DirY);
                            // Kicking off: sparks fly back and dust lifts at the feet.
                            for (var i = 0; i < 8; i++)
                                _particles.Add(Kind.Spark, fx.X - fx.DirX * 10 + Rand(-20, 20), fx.Y - fx.DirY * 10 + Rand(-20, 20),
                                    -fx.DirX * Rand(320, 460), -fx.DirY * Rand(320, 460), 0.24f, 3, ramp, ArenaPalettes.Core, drag: 0.84f);
                            for (var i = 0; i < 5; i++)
                                _particles.Add(Kind.Smoke, raw.X + Rand(-10, 10), raw.Y + Rand(-3, 6), -fx.DirX * Rand(40, 110), -fx.DirY * Rand(40, 110),
                                    0.6f, 6, ArenaPalettes.Smoke, ArenaPalettes.Bright, grow: 18, drag: 0.88f, behind: true);
                            break;
                        case ArenaShape.Projectile:
                            _particles.Add(Kind.Ring, fx.X + fx.DirX * 40, fx.Y + fx.DirY * 40, 0, 0, 0.3f, 6, ramp, ArenaPalettes.Core, grow: 110, drag: 0.9f);
                            break;
                        case ArenaShape.Burst:
                            _feel.Shake(0.55f);
                            for (var i = 0; i < 18; i++)
                            {
                                var a = i * MathF.Tau / 18;
                                _particles.Add(Kind.Smoke, raw.X, raw.Y, MathF.Cos(a) * Rand(260, 360), MathF.Sin(a) * Rand(160, 220),
                                    0.9f, 8, ramp, ArenaPalettes.Body, grow: 20, drag: 0.86f, behind: true);
                            }
                            break;
                    }
                    break;
                case ArenaFxKind.Hit:
                    Hit(fx, ramp, battle);
                    break;
                case ArenaFxKind.Heal:
                    _particles.Add(Kind.Ring, fx.X, raw.Y, 0, 0, 0.6f, 10, ArenaPalettes.Heal, ArenaPalettes.Bright, grow: 110, drag: 0.9f, behind: true);
                    for (var i = 0; i < 26; i++)
                        _particles.Add(Kind.Star, fx.X + Rand(-34, 34), fx.Y + Rand(-10, 30), Rand(-20, 20), Rand(-240, -110), Rand(0.8f, 1.4f), Rand(3, 6),
                            ArenaPalettes.Heal, _random.Next(2) == 0 ? ArenaPalettes.Core : ArenaPalettes.Bright, drag: 0.94f);
                    for (var i = 0; i < 10; i++)
                        _particles.Add(Kind.Glow, fx.X + Rand(-26, 26), fx.Y + Rand(0, 30), 0, Rand(-200, -120), Rand(0.5f, 0.8f), Rand(4, 7),
                            ArenaPalettes.Heal, ArenaPalettes.Bright, grow: -4, drag: 0.93f);
                    _texts.Add(new FloatText($"+{(int)fx.Amount}", fx.X, fx.Y - 60, ArenaPalettes.Heal[ArenaPalettes.Bright], TextSize, _time, 1, 60));
                    break;
                case ArenaFxKind.Buff:
                    // The move's own type: a ring on the ground, sparks rising in columns, a glow.
                    _particles.Add(Kind.Ring, fx.X, raw.Y, 0, 0, 0.55f, 10, ramp, ArenaPalettes.Bright, grow: 120, drag: 0.9f, behind: true);
                    for (var i = 0; i < 22; i++)
                        _particles.Add(Kind.Pixel, fx.X + ArenaPixel.Snap(Rand(-30, 30)), fx.Y + Rand(-5, 25), 0, Rand(-300, -160), Rand(0.55f, 0.9f), 3,
                            ramp, _random.Next(2) == 0 ? ArenaPalettes.Core : ArenaPalettes.Bright, drag: 0.93f);
                    for (var i = 0; i < 8; i++)
                        _particles.Add(Kind.Glow, fx.X + Rand(-24, 24), fx.Y + Rand(0, 20), 0, Rand(-180, -100), Rand(0.5f, 0.7f), Rand(4, 6),
                            ramp, ArenaPalettes.Bright, grow: -4, drag: 0.93f);
                    _texts.Add(new FloatText("Power up!", fx.X, fx.Y - 70, ArenaPalettes.Fury[ArenaPalettes.Bright], TextSize, _time, 1, 40));
                    break;
                case ArenaFxKind.Shield:
                    _particles.Add(Kind.Ring, fx.X, fx.Y - 20, 0, 0, 0.5f, 20, ArenaPalettes.Shield, ArenaPalettes.Core, grow: 90, drag: 0.9f);
                    for (var i = 0; i < 12; i++)
                    {
                        var a = i * MathF.Tau / 12;
                        _particles.Add(Kind.Pixel, fx.X + MathF.Cos(a) * 30, fx.Y - 20 + MathF.Sin(a) * 30, MathF.Cos(a) * 240, MathF.Sin(a) * 240,
                            0.4f, 3, ArenaPalettes.Shield, ArenaPalettes.Bright, drag: 0.84f);
                    }
                    break;
                case ArenaFxKind.Blocked:
                    // The shield gives way in shards.
                    for (var i = 0; i < 12; i++)
                        _particles.Add(Kind.Shard, fx.X, fx.Y - 20, Rand(-1, 1) * 380, Rand(-1, 1) * 380, Rand(0.35f, 0.6f), Rand(4, 6),
                            ArenaPalettes.Shield, ArenaPalettes.Core, drag: 0.86f, spin: Rand(-10, 10));
                    _feel.Shake(0.2f);
                    _texts.Add(new FloatText("Blocked", fx.X, fx.Y - 70, ArenaPalettes.Shield[ArenaPalettes.Bright], TextSize, _time, 0.8f, 40));
                    break;
                case ArenaFxKind.Dodge:
                    for (var i = 0; i < 10; i++)
                        _particles.Add(Kind.Smoke, fx.X + Rand(-12, 12), raw.Y + Rand(-4, 8), -fx.DirX * Rand(60, 160), -fx.DirY * Rand(60, 160),
                            0.55f, 6, ArenaPalettes.Smoke, ArenaPalettes.Core, grow: 26, drag: 0.86f, behind: true);
                    break;
                case ArenaFxKind.SecondWind:
                    _feel.FlashScreen(ArenaPalettes.Gold[ArenaPalettes.Bright], 6);
                    _feel.Shake(0.8f);
                    for (var i = 0; i < 3; i++)
                        _particles.Add(Kind.Ring, fx.X, fx.Y - 20, 0, 0, 0.8f + i * 0.2f, 10, ArenaPalettes.Gold, ArenaPalettes.Core + i, grow: 520 + i * 120, drag: 0.9f);
                    for (var i = 0; i < 70; i++)
                        _particles.Add(Kind.Glow, fx.X, fx.Y - 20, Rand(-1, 1) * 520, Rand(-1, 1) * 520, Rand(0.7f, 1.3f), Rand(4, 8),
                            ArenaPalettes.Gold, ArenaPalettes.Core, grow: -4, drag: 0.9f);
                    Banner("The Champion refuses to fall!", ArenaPalettes.Gold[ArenaPalettes.Bright], 2.2f);
                    break;
                case ArenaFxKind.Enrage:
                    _feel.FlashScreen(ArenaPalettes.Fury[ArenaPalettes.Body], 4);
                    _feel.Shake(0.4f);
                    Banner("The Champion is furious!", ArenaPalettes.Fury[ArenaPalettes.Bright], 1.8f);
                    break;
                case ArenaFxKind.Knockout:
                    _feel.FlashScreen(ArenaPalettes.Impact[ArenaPalettes.Core], 6);
                    _feel.Shake(1);
                    for (var i = 0; i < 4; i++)
                        _particles.Add(Kind.Ring, fx.X, fx.Y - 20, 0, 0, 0.9f + i * 0.15f, 10, ramp, ArenaPalettes.Core + i, grow: 700 + i * 150, drag: 0.9f);
                    for (var i = 0; i < 70; i++) _particles.Matter(fx.Type, fx.X, fx.Y - 20, Rand(-1, 1), Rand(-1, 1), 620, MathF.PI, 1.2f);
                    Banner("K.O.!", ArenaPalettes.Impact[ArenaPalettes.Core], 2.5f);
                    break;
                case ArenaFxKind.TimeUp:
                    Banner("Time!", ArenaPalettes.Impact[ArenaPalettes.Core], 2.2f);
                    break;
            }
        }
    }

    /// <summary>
    /// A hit landing: the target flashes white for two frames, the screen shakes by how much of
    /// the target's HP the hit took, and the matter bursts out the way the hit was going.
    /// </summary>
    private void Hit(ArenaFx fx, SKColor[] ramp, ArenaBattle battle)
    {
        var target = fx.ByChampion ? battle.Player : battle.Champion;
        // A stream (Flamethrower...) hits five times: small sparks, small numbers, one note.
        var lick = fx.Shape == ArenaShape.Cone;
        var big = Math.Clamp(fx.Amount / 60f, 0.6f, 2.2f) * (fx.Critical ? 1.4f : 1) * (lick ? 0.6f : 1);
        _feel.FlashTarget(target.IsChampion);
        var share = fx.Amount / Math.Max(1, target.MaxHp);
        _feel.Shake(lick ? 0.12f : Math.Clamp(0.2f + share * 6, 0.2f, 1) * (fx.Critical ? 1.25f : 1));

        // Most of the matter goes the way the hit went; a little sprays back.
        var count = (int)(16 * big) + (fx.Effectiveness > 1 ? 12 : 0);
        _particles.Spray(fx.Type, fx.X, fx.Y, fx.DirX, fx.DirY, count, 340 * big, 0.55f, big);
        _particles.Spray(fx.Type, fx.X, fx.Y, -fx.DirX, -fx.DirY, count / 4, 160 * big, 0.9f, big * 0.8f);
        var aim = MathF.Atan2(fx.DirY, fx.DirX);
        for (var i = 0; i < (lick ? 2 : 7); i++)
        {
            var a = aim + Rand(-0.7f, 0.7f);
            var v = Rand(520, 760);
            _particles.Add(Kind.Spark, fx.X, fx.Y, MathF.Cos(a) * v, MathF.Sin(a) * v, 0.22f, 3, ArenaPalettes.Impact, ArenaPalettes.Core, drag: 0.8f);
        }
        // The impact itself: a hot core, a star and a ring of the move's color.
        _particles.Add(Kind.Glow, fx.X, fx.Y, 0, 0, 0.14f, 14 * Math.Min(big, 1.4f), ArenaPalettes.Impact, ArenaPalettes.Core, grow: -60);
        if (!lick) _particles.Add(Kind.Star, fx.X, fx.Y, 0, 0, 0.2f, 10 * big, ArenaPalettes.Impact, ArenaPalettes.Core);
        _particles.Add(Kind.Ring, fx.X, fx.Y, 0, 0, 0.32f, 8, ramp, ArenaPalettes.Bright, grow: 240 * big, drag: 0.9f);

        if (fx.Amount > 0)
        {
            var number = ((int)Math.Ceiling(fx.Amount)).ToString(System.Globalization.CultureInfo.InvariantCulture);
            _texts.Add(new FloatText(number, fx.X + Rand(lick ? -34 : -12, lick ? 34 : 12), fx.Y - 64 + (lick ? Rand(-14, 14) : 0),
                fx.Critical ? ArenaPalettes.Gold[ArenaPalettes.Bright] : ArenaPalettes.Impact[ArenaPalettes.Core],
                fx.Critical ? TextSize * 2 : TextSize, _time, 0.9f, 60));
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
            _texts.Add(new FloatText(note, fx.X, fx.Y - 100,
                fx.Effectiveness > 1.5f ? ArenaPalettes.Fury[ArenaPalettes.Bright] : ArenaPalettes.Smoke[ArenaPalettes.Core], TextSize, _time, 1.1f, 60));
        if (fx.Effectiveness > 1.5f || fx.Critical) _feel.FlashScreen(ramp[ArenaPalettes.Bright], 3);
    }

    public void Banner(string text, SKColor color, float life) => _banner = (text, color, _time, life);

    // ── Every frame ─────────────────────────────────────────────────────────

    /// <summary>Moves the effects on and lets moving things leave their trails.</summary>
    public void Update(float dt, ArenaBattle battle)
    {
        _time += dt;
        _feel.Update(dt);
        // The battle's hit stop freezes the effects with the fighters, so the hit holds for a beat.
        var frozen = battle.HitStop > 0 && battle.Outcome == ArenaOutcome.Running;
        var step = frozen ? 0 : dt;
        _particles.Update(step);
        _trails.Update(step, battle);
        _texts.RemoveAll(t => _time - t.Born > t.Life);
        if (frozen) return;

        foreach (var shot in battle.Projectiles)
        {
            var length = MathF.Max(1, MathF.Sqrt(shot.VelocityX * shot.VelocityX + shot.VelocityY * shot.VelocityY));
            for (var k = 0; k < 2; k++)
                _particles.Matter(shot.Type, shot.X + Rand(-4, 4), shot.Y - Lift + Rand(-4, 4), -shot.VelocityX / length, -shot.VelocityY / length, 90, 0.5f, shot.Radius / 22f);
        }
        foreach (var fighter in new[] { battle.Player, battle.Champion })
        {
            WatchBeam(fighter);
            if (fighter.Casting >= 0)
            {
                var move = fighter.Moves[fighter.Casting];
                var ramp = ArenaPalettes.For(move.Type);
                if (move.Shape == ArenaShape.Cone)
                    for (var k = 0; k < 6; k++)
                        _particles.Matter(move.Type, fighter.X + fighter.AimX * 36, fighter.Y - Lift + fighter.AimY * 36, fighter.AimX, fighter.AimY,
                            ArenaBattle.ConeReach * 2.2f, ArenaBattle.ConeHalfAngle * 0.8f, 1.2f);
                else if (move.Shape == ArenaShape.Beam && fighter.CastTime < ArenaBattle.BeamWindup)
                    // The charge: specks drawn in toward the muzzle, faster the closer they get.
                    for (var k = 0; k < 3; k++)
                    {
                        var a = Rand(0, MathF.Tau);
                        _particles.Add(Kind.Pixel, fighter.X + fighter.AimX * 40 + MathF.Cos(a) * 56, fighter.Y - Lift + fighter.AimY * 40 + MathF.Sin(a) * 56,
                            -MathF.Cos(a) * 110, -MathF.Sin(a) * 110, 0.36f, 3, ramp, ArenaPalettes.Core, drag: 1.04f);
                    }
                else if (move.Shape == ArenaShape.Beam)
                    for (var k = 0; k < 12; k++)
                    {
                        var along = Rand(40, 900);
                        _particles.Matter(move.Type, fighter.X + fighter.AimX * along, fighter.Y - Lift + fighter.AimY * along, -fighter.AimY, fighter.AimX, 80, MathF.PI, 1);
                    }
                else if (move.Shape == ArenaShape.Strike)
                    _particles.Matter(move.Type, fighter.X + Rand(-10, 10), fighter.Y - Lift + Rand(-10, 10), -fighter.AimX, -fighter.AimY, 120, 0.4f, 0.8f);
            }
            if (fighter.BuffGlow > 0 && _random.Next(2) == 0)
                _particles.Add(Kind.Pixel, fighter.X + Rand(-26, 26), fighter.Y + Rand(-6, 6), 0, Rand(-200, -110), 0.6f, 3,
                    ArenaPalettes.Fury, ArenaPalettes.Bright, drag: 0.94f);
            if (fighter.IsChampion && battle.ChampionEnraged && _random.Next(2) == 0)
                _particles.Add(Kind.Glow, fighter.X + Rand(-24, 24), fighter.Y + Rand(-4, 8), Rand(-15, 15), Rand(-240, -140), Rand(0.45f, 0.8f), Rand(4, 8),
                    ArenaPalettes.Fury, _random.Next(3) == 0 ? ArenaPalettes.Core : ArenaPalettes.Bright, grow: -7, gravity: -60, drag: 0.92f);
            if (fighter.DodgeTime > 0)
                _particles.Add(Kind.Smoke, fighter.X, fighter.Y + 4, 0, 0, 0.35f, 8, ArenaPalettes.Smoke, ArenaPalettes.Core, grow: 18, drag: 0.9f, behind: true);
        }
        foreach (var ring in battle.Rings)
        {
            var radius = ring.Radius;
            for (var k = 0; k < 6; k++)
            {
                var a = Rand(0, MathF.Tau);
                _particles.Matter(ring.Type, ring.X + MathF.Cos(a) * radius, ring.Y + MathF.Sin(a) * radius * 0.6f, MathF.Cos(a), MathF.Sin(a), 120, 0.3f, 1);
            }
        }
    }

    /// <summary>A beam firing shakes the screen; once the battle is done with it, it thins out slowly.</summary>
    private void WatchBeam(ArenaFighter fighter)
    {
        var side = fighter.IsChampion ? 1 : 0;
        var on = fighter.Casting >= 0 && fighter.Moves[fighter.Casting].Shape == ArenaShape.Beam && fighter.CastTime >= ArenaBattle.BeamWindup;
        if (on)
        {
            var type = fighter.Moves[fighter.Casting].Type;
            _beamAt[side] = (type, fighter.X + fighter.AimX * 30, fighter.Y - Lift + fighter.AimY * 30,
                fighter.X + fighter.AimX * 1200, fighter.Y - Lift + fighter.AimY * 1200);
            if (!_beamOn[side])
            {
                _feel.Shake(0.5f);
                _particles.Spray(type, _beamAt[side].X0, _beamAt[side].Y0, fighter.AimX, fighter.AimY, 18, 420, 0.5f, 1.2f);
            }
        }
        else if (_beamOn[side])
        {
            var (type, x0, y0, x1, y1) = _beamAt[side];
            _trails.AddBeam(type, x0, y0, x1, y1);
        }
        _beamOn[side] = on;
    }

    // ── Drawing ─────────────────────────────────────────────────────────────

    public void Draw(SKCanvas c, SKRect view, ArenaBattle battle, string championLabel, float density)
    {
        // The art picture covers the whole view (phones are wider than the arena), the court in its middle.
        var zoom = ArenaPixel.Zoom(view.Width, view.Height);
        var size = new SKSizeI((int)MathF.Ceiling(view.Width / zoom), (int)MathF.Ceiling(view.Height / zoom));
        if (_art is null || _artSize != size)
        {
            _art?.Dispose();
            _art = size.Width > 0 && size.Height > 0
                ? SKSurface.Create(new SKImageInfo(size.Width, size.Height, SKColorType.Rgba8888, SKAlphaType.Premul))
                : null;
            _artSize = size;
        }
        c.Clear(ArenaPalettes.Floor[ArenaPalettes.Edge]);
        if (_art is null) return;

        var art = _art.Canvas;
        var shake = _feel.Offset();
        var left = (size.Width - ArenaPixel.Width) / 2 + shake.X;
        var top = (size.Height - ArenaPixel.Height) / 2 + shake.Y;
        DrawFloor(art, size, shake, battle.Champion.Spec.Type1);

        art.Save();
        art.Translate(left, top);
        art.Scale(1 / ArenaPixel.Unit);
        foreach (var ring in battle.Rings) DrawRing(art, ring);
        _trails.DrawGround(art);
        foreach (var fighter in new[] { battle.Player, battle.Champion }) DrawTelegraph(art, fighter);
        _particles.Draw(art, behind: true);
        var order = battle.Player.Y <= battle.Champion.Y ? new[] { battle.Player, battle.Champion } : [battle.Champion, battle.Player];
        foreach (var fighter in order) DrawFighter(art, fighter, battle);
        foreach (var shot in battle.Projectiles) DrawProjectile(art, shot);
        foreach (var fighter in new[] { battle.Player, battle.Champion }) DrawBeam(art, fighter);
        _trails.Draw(art);
        _particles.Draw(art, behind: false);
        art.Restore();
        DrawTexts(art, left, top);
        if (_feel.ScreenFlash is { } flash)
        {
            _fill.Color = flash;
            art.DrawRect(0, 0, size.Width, size.Height, _fill);
        }

        using (var image = _art.Snapshot())
            c.DrawImage(image, SKRect.Create(0, 0, size.Width, size.Height),
                SKRect.Create(view.Left, view.Top, size.Width * zoom, size.Height * zoom), _pixel, null);
        DrawHud(c, view, battle, championLabel, density);
        DrawBanner(c, view, density);
        _feel.EndFrame();
    }

    /// <summary>The floor, painted once per screen size and Champion type, in art pixels.</summary>
    private void DrawFloor(SKCanvas art, SKSizeI size, SKPointI shake, int type)
    {
        if (_floor is null || _floorSize != size || _floorType != type)
        {
            _floor?.Dispose();
            _floorSize = size;
            _floorType = type;
            _floor = PaintFloor(size, ArenaPalettes.For(type));
        }
        art.Clear(ArenaPalettes.Floor[ArenaPalettes.Edge]);
        if (_floor is not null) art.DrawImage(_floor, shake.X, shake.Y);
    }

    private static SKImage? PaintFloor(SKSizeI size, SKColor[] accent)
    {
        using var surface = SKSurface.Create(new SKImageInfo(size.Width, size.Height, SKColorType.Rgba8888, SKAlphaType.Premul));
        if (surface is null) return null;
        var c = surface.Canvas;
        var floor = ArenaPalettes.Floor;
        using var paint = new SKPaint { IsAntialias = false };
        c.Clear(floor[ArenaPalettes.Edge]);
        var left = (size.Width - ArenaPixel.Width) / 2;
        var top = (size.Height - ArenaPixel.Height) / 2;
        var cx = left + ArenaPixel.Width / 2;
        var cy = top + 99;
        // A pool of light under the court in flat bands, no gradient.
        paint.Color = floor[ArenaPalettes.Deep];
        c.DrawOval(cx, cy, size.Width * 0.6f, 124, paint);
        paint.Color = floor[ArenaPalettes.Body];
        c.DrawOval(cx, cy, 190, 92, paint);
        // Floor tiles, 16 pixels apart, across the whole screen.
        paint.Color = floor[ArenaPalettes.Bright].WithAlpha(90);
        for (var x = left % 16; x < size.Width; x += 16) c.DrawRect(x, 0, 1, size.Height, paint);
        for (var y = top % 16; y < size.Height; y += 16) c.DrawRect(0, y, size.Width, 1, paint);
        // The court: its lines, the middle circle and a Poké Ball line in the middle.
        // Strokes one pixel wide sit on pixel centres (the .5), so they come out exactly one pixel.
        var court = new SKRect(left + 9.5f, top + MathF.Round((ArenaBattle.Top - 70) / ArenaPixel.Unit) + 0.5f, left + 310.5f, top + 177.5f);
        using var line = new SKPaint { IsAntialias = false, Style = SKPaintStyle.Stroke, StrokeWidth = 1, Color = floor[ArenaPalettes.Core].WithAlpha(110) };
        c.DrawRoundRect(court, 9, 9, line);
        paint.Color = line.Color;
        c.DrawRect(cx, court.Top, 1, court.Height, paint);
        c.DrawOval(cx + 0.5f, court.MidY, 32, 21, line);
        line.Color = accent[ArenaPalettes.Deep];
        line.StrokeWidth = 2;
        c.DrawRoundRect(SKRect.Inflate(court, 3, 3), 11, 11, line);
        paint.Color = floor[ArenaPalettes.Bright];
        c.DrawOval(cx + 0.5f, court.MidY, 13, 9, paint);
        paint.Color = accent[ArenaPalettes.Body];
        c.DrawRect(cx - 13, MathF.Floor(court.MidY), 27, 1, paint);
        return surface.Snapshot();
    }

    private void DrawTelegraph(SKCanvas c, ArenaFighter fighter)
    {
        if (fighter.Casting < 0) return;
        var move = fighter.Moves[fighter.Casting];
        if (move.Shape != ArenaShape.Beam || fighter.CastTime >= ArenaBattle.BeamWindup) return;
        var t = fighter.CastTime / ArenaBattle.BeamWindup;
        var ramp = ArenaPalettes.For(move.Type);
        var x = ArenaPixel.Snap(fighter.X + fighter.AimX * 40);
        var y = ArenaPixel.Snap(fighter.Y - Lift + fighter.AimY * 40);
        _line.StrokeWidth = t > 0.6f ? 2 * ArenaPixel.Unit : ArenaPixel.Unit;
        _line.Color = ArenaPalettes.At(ramp, Blink(30) ? ArenaPalettes.Bright : ArenaPalettes.Deep).WithAlpha(170);
        c.DrawLine(x, y, ArenaPixel.Snap(x + fighter.AimX * 1060), ArenaPixel.Snap(y + fighter.AimY * 1060), _line);
        // The charge growing at the muzzle: glow, body, core.
        var r = 6 + t * 18;
        _fill.Color = ramp[ArenaPalettes.Deep].WithAlpha(110);
        c.DrawCircle(x, y, ArenaPixel.Size(r * 1.7f), _fill);
        _fill.Color = ramp[ArenaPalettes.Bright];
        c.DrawCircle(x, y, ArenaPixel.Size(r), _fill);
        _fill.Color = ramp[ArenaPalettes.Core];
        c.DrawCircle(x, y, ArenaPixel.Size(r * 0.45f), _fill);
    }

    private void DrawBeam(SKCanvas c, ArenaFighter fighter)
    {
        if (fighter.Casting < 0) return;
        var move = fighter.Moves[fighter.Casting];
        if (move.Shape != ArenaShape.Beam || fighter.CastTime < ArenaBattle.BeamWindup) return;
        var t = Math.Clamp((fighter.CastTime - ArenaBattle.BeamWindup) / ArenaBattle.BeamLength, 0, 1);
        var fade = 1 - t * t;
        var ramp = ArenaPalettes.For(move.Type);
        var x0 = ArenaPixel.Snap(fighter.X + fighter.AimX * 30);
        var y0 = ArenaPixel.Snap(fighter.Y - Lift + fighter.AimY * 30);
        var x1 = ArenaPixel.Snap(fighter.X + fighter.AimX * 1200);
        var y1 = ArenaPixel.Snap(fighter.Y - Lift + fighter.AimY * 1200);
        var flicker = Blink(40) ? 1 : 0.85f;
        _line.StrokeCap = SKStrokeCap.Butt;
        foreach (var (width, step, alpha) in new[] { (2.2f, ArenaPalettes.Deep, (byte)120), (1.2f, ArenaPalettes.Body, (byte)255), (0.5f, ArenaPalettes.Core, (byte)255) })
        {
            _line.StrokeWidth = ArenaPixel.Size(ArenaBattle.BeamWidth * width * flicker * fade);
            _line.Color = ramp[step].WithAlpha(alpha);
            if (move.Type == ArenaTypes.Electric) DrawBolt(c, x0, y0, x1, y1, 26, _line);
            else c.DrawLine(x0, y0, x1, y1, _line);
        }
        // The muzzle flare.
        _fill.Color = ramp[ArenaPalettes.Core];
        c.DrawCircle(x0, y0, ArenaPixel.Size(ArenaBattle.BeamWidth * 0.9f * fade), _fill);
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
            path.LineTo(ArenaPixel.Snap(x0 + dx * f + nx * off), ArenaPixel.Snap(y0 + dy * f + ny * off));
        }
        path.LineTo(x1, y1);
        c.DrawPath(path, paint);
    }

    private void DrawRing(SKCanvas c, ArenaRing ring)
    {
        var t = Math.Clamp(ring.Age / ArenaBattle.RingTime, 0, 1);
        var ramp = ArenaPalettes.For(ring.Type);
        var x = ArenaPixel.Snap(ring.X);
        var y = ArenaPixel.Snap(ring.Y);
        var rx = ArenaPixel.Snap(ring.Radius);
        var ry = ArenaPixel.Snap(ring.Radius * 0.62f);
        // Glow (the ground lit inside the wave), body (the wave front), core (its bright lip).
        _fill.Color = ramp[ArenaPalettes.Deep].WithAlpha(t < 0.7f ? (byte)70 : (byte)35);
        c.DrawOval(x, y, rx, ry, _fill);
        _line.StrokeCap = SKStrokeCap.Butt;
        _line.Color = ArenaPalettes.At(ramp, ArenaPalettes.Bright + (int)(t * 2));
        _line.StrokeWidth = ArenaPixel.Size(14 * (1 - t) + 3);
        c.DrawOval(x, y, rx, ry, _line);
        if (rx > 2 * ArenaPixel.Unit)
        {
            _line.Color = ramp[ArenaPalettes.Core];
            _line.StrokeWidth = ArenaPixel.Unit;
            c.DrawOval(x, y, rx - 2 * ArenaPixel.Unit, Math.Max(ArenaPixel.Unit, ry - 2 * ArenaPixel.Unit), _line);
        }
        if (ring.Type is ArenaTypes.Rock or ArenaTypes.Ground) DrawSpikes(c, ring, ramp);
    }

    /// <summary>Rock and Ground waves push spikes of stone up where they pass; they sink back as the ring ends.</summary>
    private void DrawSpikes(SKCanvas c, ArenaRing ring, SKColor[] ramp)
    {
        const int count = 10;
        var end = ArenaBattle.RingTime + 0.25f;
        var height = 39 * Math.Min(1, ring.Age / 0.12f) * Math.Clamp((end - ring.Age) / 0.2f, 0, 1);
        if (height < ArenaPixel.Unit) return;
        var seed = ring.X * 0.013f + ring.Y * 0.007f;
        for (var i = 0; i < count; i++)
        {
            var a = seed + i * MathF.Tau / count;
            var sx = ArenaPixel.Snap(ring.X + MathF.Cos(a) * ring.Radius);
            var sy = ArenaPixel.Snap(ring.Y + MathF.Sin(a) * ring.Radius * 0.62f);
            var h = ArenaPixel.Snap(height * (0.75f + 0.25f * MathF.Sin(i * 2.7f + seed)));
            const float half = 7.5f;
            using var path = new SKPath();
            path.MoveTo(sx - half, sy);
            path.LineTo(sx, sy - h);
            path.LineTo(sx + half, sy);
            path.Close();
            _fill.Color = ramp[ArenaPalettes.Body];
            c.DrawPath(path, _fill);
            // The lit face, then the dark outline.
            using (var face = new SKPath())
            {
                face.MoveTo(sx - half + ArenaPixel.Unit, sy);
                face.LineTo(sx, sy - h + ArenaPixel.Unit);
                face.LineTo(sx, sy);
                face.Close();
                _fill.Color = ramp[ArenaPalettes.Bright];
                c.DrawPath(face, _fill);
            }
            _line.Color = ramp[ArenaPalettes.Edge];
            _line.StrokeWidth = ArenaPixel.Unit;
            c.DrawPath(path, _line);
        }
    }

    private void DrawProjectile(SKCanvas c, ArenaProjectile shot)
    {
        var ramp = ArenaPalettes.For(shot.Type);
        var x = ArenaPixel.Snap(shot.X);
        var y = ArenaPixel.Snap(shot.Y - Lift);
        var length = MathF.Max(1, MathF.Sqrt(shot.VelocityX * shot.VelocityX + shot.VelocityY * shot.VelocityY));
        var dx = shot.VelocityX / length;
        var dy = shot.VelocityY / length;
        var pulse = Blink(20, shot.X * 0.02f) ? ArenaPixel.Unit : 0;
        // Glow.
        _fill.Color = ramp[ArenaPalettes.Deep].WithAlpha(110);
        c.DrawCircle(x, y, ArenaPixel.Size(shot.Radius * 2) + pulse, _fill);
        if (shot.Type == ArenaTypes.Fire)
        {
            // A fireball trails a tongue of flame.
            using var tongue = new SKPath();
            tongue.MoveTo(ArenaPixel.Snap(x - dx * shot.Radius * 2.6f), ArenaPixel.Snap(y - dy * shot.Radius * 2.6f));
            tongue.LineTo(ArenaPixel.Snap(x - dy * shot.Radius), ArenaPixel.Snap(y + dx * shot.Radius));
            tongue.LineTo(ArenaPixel.Snap(x + dy * shot.Radius), ArenaPixel.Snap(y - dx * shot.Radius));
            tongue.Close();
            _fill.Color = ramp[ArenaPalettes.Body];
            c.DrawPath(tongue, _fill);
        }
        // Body and core.
        _fill.Color = ramp[ArenaPalettes.Bright];
        c.DrawCircle(x, y, ArenaPixel.Size(shot.Radius * 1.15f), _fill);
        _fill.Color = ramp[ArenaPalettes.Core];
        if (shot.Type == ArenaTypes.Ice)
        {
            var r = ArenaPixel.Size(shot.Radius * 0.8f);
            using var diamond = new SKPath();
            diamond.MoveTo(x, y - r);
            diamond.LineTo(x + r * 0.6f, y);
            diamond.LineTo(x, y + r);
            diamond.LineTo(x - r * 0.6f, y);
            diamond.Close();
            c.DrawPath(diamond, _fill);
        }
        else c.DrawCircle(x, y, ArenaPixel.Size(shot.Radius * 0.55f), _fill);
        if (shot.Type == ArenaTypes.Electric)
        {
            _line.StrokeCap = SKStrokeCap.Butt;
            _line.StrokeWidth = ArenaPixel.Unit;
            _line.Color = ramp[ArenaPalettes.Core];
            for (var i = 0; i < 2; i++)
            {
                var a = Rand(0, MathF.Tau);
                DrawBolt(c, x, y, ArenaPixel.Snap(x + MathF.Cos(a) * shot.Radius * 1.9f), ArenaPixel.Snap(y + MathF.Sin(a) * shot.Radius * 1.9f), 5, _line);
            }
        }
    }

    private void DrawFighter(SKCanvas c, ArenaFighter fighter, ArenaBattle battle)
    {
        var spec = fighter.Spec;
        var ramp = ArenaPalettes.For(spec.Type1);
        var x = ArenaPixel.Snap(fighter.X);
        var y = ArenaPixel.Snap(fighter.Y);
        // A shadow and a ring under the feet: blue for the player, gold for the Champion.
        _fill.Color = ArenaPalettes.Floor[ArenaPalettes.Edge].WithAlpha(170);
        c.DrawOval(x, y + ArenaPixel.Unit, 30, 9, _fill);
        _line.StrokeCap = SKStrokeCap.Butt;
        _line.StrokeWidth = ArenaPixel.Unit;
        _line.Color = (fighter.IsChampion ? ArenaPalettes.Gold : ArenaPalettes.Player)[ArenaPalettes.Body];
        c.DrawOval(x, y + ArenaPixel.Unit, 36 + (Blink(2.5f) ? ArenaPixel.Unit : 0), 12, _line);

        if (fighter.ShieldTime > 0)
        {
            var shield = ArenaPalettes.Shield;
            var sy = y - 27;
            _fill.Color = shield[ArenaPalettes.Deep].WithAlpha(70);
            c.DrawCircle(x, sy, 51, _fill);
            _line.Color = shield[ArenaPalettes.Bright];
            _line.StrokeWidth = 2 * ArenaPixel.Unit;
            c.DrawCircle(x, sy, 51 + (Blink(12) ? ArenaPixel.Unit : 0), _line);
            _fill.Color = shield[ArenaPalettes.Core];
            c.DrawRect(x - 33, sy - 33, 9, 3, _fill);
            c.DrawRect(x - 36, sy - 30, 3, 6, _fill);
        }
        if (fighter.IsChampion && (battle.ChampionEnraged || fighter.BuffGlow > 0))
        {
            var aura = battle.ChampionEnraged ? ArenaPalettes.Fury : ArenaPalettes.Gold;
            _fill.Color = aura[ArenaPalettes.Deep].WithAlpha(50);
            c.DrawCircle(x, y - 24, 69, _fill);
            _fill.Color = aura[ArenaPalettes.Body].WithAlpha(50);
            c.DrawCircle(x, y - 24, 48, _fill);
        }

        var facing = Direction(fighter.FacingX, fighter.FacingY);
        var moving = fighter.IsMoving;
        var frame = _walking?.GetFrame(spec.Species, spec.Form, spec.Shiny, facing, (long)(_time * 1000 * (moving ? 1.6f : 1)), moving);
        SKBitmap? bitmap = frame?.Bitmap ?? _sprites?.GetSprite(spec.Species, spec.Form, spec.Shiny);
        // A one-pixel hop: up while walking every other step, a slow breath standing.
        var bob = moving ? (Blink(9) ? -ArenaPixel.Unit : 0) : (Blink(1.2f) ? -ArenaPixel.Unit : 0);
        if (bitmap is null)
        {
            _fill.Color = ramp[ArenaPalettes.Body];
            c.DrawCircle(x, y - 27 + bob, 27, _fill);
            return;
        }
        var (image, crop) = ImageOf(bitmap, still: frame is null);
        SKRect source, dest;
        if (frame is not null)
        {
            source = frame.Source;
            var bounds = frame.Bounds;
            // Each sprite pixel is one art pixel (two for the tiniest Pokémon): never a fraction.
            var scale = ArenaPixel.Unit * (Math.Max(bounds.Width, bounds.Height) < 18 ? 2 : 1);
            var w = source.Width * scale;
            var h = source.Height * scale;
            var centerY = y + bob - bounds.Bottom * scale;
            dest = SKRect.Create(ArenaPixel.Snap(x - w / 2), ArenaPixel.Snap(centerY - h / 2), w, h);
        }
        else
        {
            source = crop;
            var scale = ArenaPixel.Unit * (Math.Max(source.Width, source.Height) < 24 ? 2 : 1);
            var w = source.Width * scale;
            var h = source.Height * scale;
            dest = SKRect.Create(ArenaPixel.Snap(x - w / 2), ArenaPixel.Snap(y + bob - h), w, h);
        }
        var flip = frame is null && fighter.FacingX < 0;

        // Echoes: flat silhouettes where it just was, a color darker the older they are.
        foreach (var echo in _trails.Echoes(fighter.IsChampion))
        {
            var step = ArenaPalettes.Bright + (int)(echo.Age / ArenaTrails.EchoLife * 3);
            using var ghost = new SKPaint { ColorFilter = SKColorFilter.CreateBlendMode(ArenaPalettes.At(ramp, step).WithAlpha(150), SKBlendMode.SrcIn) };
            DrawSprite(c, image, source, dest with
            {
                Left = dest.Left + ArenaPixel.Snap(echo.X - fighter.X), Right = dest.Right + ArenaPixel.Snap(echo.X - fighter.X),
                Top = dest.Top + ArenaPixel.Snap(echo.Y - fighter.Y), Bottom = dest.Bottom + ArenaPixel.Snap(echo.Y - fighter.Y),
            }, flip, ghost);
        }

        // Smear: very fast, the sprite stretches back along the way it moves (the front edge stays put).
        var speed = MathF.Sqrt(fighter.VelocityX * fighter.VelocityX + fighter.VelocityY * fighter.VelocityY);
        if (speed > 500)
        {
            var stretch = 1 + Math.Min(0.5f, (speed - 500) / 500);
            if (MathF.Abs(fighter.VelocityX) >= MathF.Abs(fighter.VelocityY))
            {
                var w = ArenaPixel.Snap(dest.Width * stretch);
                dest = fighter.VelocityX > 0 ? dest with { Left = dest.Right - w } : dest with { Right = dest.Left + w };
            }
            else
            {
                var h = ArenaPixel.Snap(dest.Height * stretch);
                dest = fighter.VelocityY > 0 ? dest with { Top = dest.Bottom - h } : dest with { Bottom = dest.Top + h };
            }
        }

        using var paint = new SKPaint();
        if (_feel.Flashing(fighter.IsChampion))
            paint.ColorFilter = SKColorFilter.CreateBlendMode(ArenaPalettes.Impact[ArenaPalettes.Core], SKBlendMode.SrcATop);
        else if (fighter.Invulnerable > 0.3f && fighter.IsChampion)
            paint.ColorFilter = SKColorFilter.CreateBlendMode(ArenaPalettes.Gold[ArenaPalettes.Bright].WithAlpha(120), SKBlendMode.SrcATop);
        DrawSprite(c, image, source, dest, flip, paint);
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

    /// <summary>Damage numbers and notes, in the art picture's own pixels (the court starts at left, top).</summary>
    private void DrawTexts(SKCanvas art, int left, int top)
    {
        foreach (var text in _texts)
        {
            var age = _time - text.Born;
            var t = age / text.Life;
            // A pop: twice the size for its first frames, then its own size, then half see-through at the end.
            var size = age < 0.07f ? text.Size * 2 : text.Size;
            var alpha = t < 0.7f ? (byte)255 : (byte)140;
            using var font = PixelFont.For(text.Text, size);
            font.Edging = SKFontEdging.Alias;
            font.Embolden = false;
            var x = left + MathF.Round(text.X / ArenaPixel.Unit);
            var y = top + MathF.Round((text.Y - text.Rise * MathF.Sqrt(t)) / ArenaPixel.Unit);
            _fill.Color = ArenaPalettes.Floor[ArenaPalettes.Edge].WithAlpha(alpha);
            art.DrawText(text.Text, x + 1, y + 1, SKTextAlign.Center, font, _fill);
            _fill.Color = text.Color.WithAlpha(alpha);
            art.DrawText(text.Text, x, y, SKTextAlign.Center, font, _fill);
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
        _art?.Dispose();
        _floor?.Dispose();
        foreach (var (image, _) in _images.Values) image.Dispose();
        _images.Clear();
        _paint.Dispose();
        _stroke.Dispose();
        _fill.Dispose();
        _line.Dispose();
        _particles.Dispose();
        _trails.Dispose();
    }
}
