namespace PKForge.Domain;

/// <summary>How a move plays out in the Arena, picked from its category, type and power.</summary>
public enum ArenaShape
{
    /// <summary>A short dash that hits whatever is in front (most physical moves).</summary>
    Strike,
    /// <summary>A shot that flies straight (most special moves).</summary>
    Projectile,
    /// <summary>A charged line across the arena (the strongest special moves).</summary>
    Beam,
    /// <summary>A stream in front of the user, hitting a few times (Flamethrower, Surf...).</summary>
    Cone,
    /// <summary>A ring around the user that shakes the ground (Earthquake, Rock Slide...).</summary>
    Burst,
    /// <summary>Raises the user's power for the rest of the battle (Swords Dance...).</summary>
    Buff,
    /// <summary>Gives back part of the user's HP (Recover...).</summary>
    Heal,
    /// <summary>A short moment nothing can hurt the user (Protect...).</summary>
    Shield,
}

/// <summary>One of a fighter's moves in the Arena. <paramref name="Type"/> is 0-17 (PKHeX order: Normal = 0, Fairy = 17).</summary>
public sealed record ArenaMove(int Id, string Name, int Type, MoveCategory Category, int Power, ArenaShape Shape, float Cooldown)
{
    /// <summary>The move every fighter falls back on when it knows nothing that hurts.</summary>
    public static ArenaMove Struggle { get; } = For(165, "Struggle", 0, MoveCategory.Physical, 50, "");

    /// <summary>The Arena version of a move from its numbers.</summary>
    public static ArenaMove For(int id, string name, int type, MoveCategory category, int power, string effect)
    {
        var text = effect.ToLowerInvariant();
        var shape = category switch
        {
            MoveCategory.Status when text.Contains("heal", StringComparison.Ordinal) || text.Contains("restore", StringComparison.Ordinal)
                || text.Contains("recover", StringComparison.Ordinal) => ArenaShape.Heal,
            MoveCategory.Status when text.Contains("protect", StringComparison.Ordinal) || text.Contains("evade", StringComparison.Ordinal)
                || text.Contains("detect", StringComparison.Ordinal) => ArenaShape.Shield,
            MoveCategory.Status => ArenaShape.Buff,
            MoveCategory.Physical when type is ArenaTypes.Ground or ArenaTypes.Rock && power >= 75 => ArenaShape.Burst,
            MoveCategory.Physical => ArenaShape.Strike,
            _ when power >= 100 => ArenaShape.Beam,
            _ when type is ArenaTypes.Fire or ArenaTypes.Water or ArenaTypes.Ice or ArenaTypes.Poison or ArenaTypes.Dragon && power >= 80 => ArenaShape.Cone,
            _ => ArenaShape.Projectile,
        };
        // Moves without a fixed power (Seismic Toss, Low Kick...) hit like an average move.
        if (category != MoveCategory.Status && power <= 1) power = 65;
        var cooldown = shape switch
        {
            ArenaShape.Strike => 0.55f + power / 160f,
            ArenaShape.Projectile => 0.7f + power / 130f,
            ArenaShape.Beam => 2.6f + power / 110f,
            ArenaShape.Cone => 2.2f + power / 150f,
            ArenaShape.Burst => 2.4f + power / 120f,
            ArenaShape.Buff => 7f,
            ArenaShape.Heal => 10f,
            _ => 6f,
        };
        return new ArenaMove(id, name, Math.Clamp(type, 0, 17), category, power, shape, cooldown);
    }
}

/// <summary>A fighter as it enters the Arena: everyone is level 50, like in the official battles.</summary>
/// <param name="Type2">Same as <paramref name="Type1"/> for a single-type Pokémon.</param>
public sealed record ArenaFighterSpec(
    int Species, int Form, bool Shiny, string Nickname, int Type1, int Type2,
    int Hp, int Attack, int Defense, int SpAttack, int SpDefense, int Speed,
    IReadOnlyList<ArenaMove> Moves)
{
    public const int Level = 50;
}

/// <summary>The player's hands this tick: the stick, the move button pressed, the dodge.</summary>
public readonly record struct ArenaInput(float MoveX, float MoveY, int Cast = -1, bool Dodge = false);

/// <summary>What happened this tick, for the drawing (sparks, numbers, shakes).</summary>
public enum ArenaFxKind { Cast, Hit, Heal, Buff, Shield, Dodge, Blocked, Knockout, SecondWind, Enrage, TimeUp }

/// <summary>One thing that happened this tick, where, and how much.</summary>
public readonly record struct ArenaFx(
    ArenaFxKind Kind, bool ByChampion, int Type, ArenaShape Shape, float X, float Y, float DirX, float DirY,
    float Amount = 0, float Effectiveness = 1, bool Critical = false);

/// <summary>How the battle stands.</summary>
public enum ArenaOutcome { Running, PlayerWon, ChampionWon }

/// <summary>A fighter during the battle.</summary>
public sealed class ArenaFighter
{
    internal ArenaFighter(ArenaFighterSpec spec, bool champion, float x, float y)
    {
        Spec = spec;
        IsChampion = champion;
        X = x;
        Y = y;
        FacingX = champion ? -1 : 1;
        MaxHp = spec.Hp * ArenaBattle.HpScale;
        Hp = MaxHp;
        var moves = spec.Moves.Where(move => move is not null).Take(4).ToList();
        if (!moves.Any(move => move.Category != MoveCategory.Status)) moves.Insert(0, ArenaMove.Struggle);
        Moves = moves.Take(4).ToList();
        Cooldowns = new float[Moves.Count];
    }

    public ArenaFighterSpec Spec { get; }
    public bool IsChampion { get; }
    public IReadOnlyList<ArenaMove> Moves { get; }
    public float[] Cooldowns { get; }
    public float X { get; internal set; }
    public float Y { get; internal set; }
    public float VelocityX { get; internal set; }
    public float VelocityY { get; internal set; }
    public float FacingX { get; internal set; }
    public float FacingY { get; internal set; }
    public float Hp { get; internal set; }
    public float MaxHp { get; }
    public float HpFraction => MaxHp <= 0 ? 0 : Math.Clamp(Hp / MaxHp, 0, 1);
    /// <summary>The HP bar's trailing part (the "damage taken" ghost that drains after a hit).</summary>
    public float ShownHp { get; internal set; } = 1;
    public float Stun { get; internal set; }
    public float Invulnerable { get; internal set; }
    public float ShieldTime { get; internal set; }
    public float DodgeTime { get; internal set; }
    public float DodgeCooldown { get; internal set; }
    public float HurtFlash { get; internal set; }
    public float Healing { get; internal set; }
    /// <summary>Power stages from Buff moves (0 to 3): each adds half the stat again.</summary>
    public int Stage { get; internal set; }
    public float BuffGlow { get; internal set; }
    /// <summary>The move being used (its index) while it is still going, else -1.</summary>
    public int Casting { get; internal set; } = -1;
    public float CastTime { get; internal set; }
    public float CastLength { get; internal set; }
    public float AimX { get; internal set; } = 1;
    public float AimY { get; internal set; }
    internal bool CastHit;
    internal int ConeTicks;
    public bool IsMoving => VelocityX * VelocityX + VelocityY * VelocityY > 400;
    public float Radius => 34;
    public float Speed => 175 + Spec.Speed * 0.85f;

    internal float Power(MoveCategory category) =>
        (category == MoveCategory.Special ? Spec.SpAttack : Spec.Attack) * (1 + Stage * 0.5f);

    internal float Guard(MoveCategory category) => category == MoveCategory.Special ? Spec.SpDefense : Spec.Defense;
}

/// <summary>A shot in flight.</summary>
public sealed class ArenaProjectile
{
    public required bool ByChampion { get; init; }
    public required int MoveIndex { get; init; }
    public required int Type { get; init; }
    public float X { get; internal set; }
    public float Y { get; internal set; }
    public float VelocityX { get; internal set; }
    public float VelocityY { get; internal set; }
    public float Radius { get; internal set; }
    public float Life { get; internal set; }
    public float Age { get; internal set; }
}

/// <summary>A ring of a Burst move spreading out.</summary>
public sealed class ArenaRing
{
    public required bool ByChampion { get; init; }
    public required int MoveIndex { get; init; }
    public required int Type { get; init; }
    public float X { get; init; }
    public float Y { get; init; }
    public float Age { get; internal set; }
    public float Radius => ArenaBattle.RingReach * Math.Clamp(Age / ArenaBattle.RingTime, 0, 1);
    internal bool Done;
}

/// <summary>
/// 3DS Bank 2.5's Arena: a real-time battle seen from above, the player's Pokémon against the
/// Champion's (played by the app). Both run around the arena and use their real moves; each
/// move plays out by its kind (<see cref="ArenaShape"/>) and hurts like in the games (level,
/// power, the user's attack against the target's defense, same-type bonus, type matchups,
/// critical hits), scaled so a battle lasts about a minute. With <c>aura</c> on the Champion
/// cannot lose, and every battle looks close: until it gets angry it holds back and never
/// knocks the player out, so any challenger takes it to its last third; there it gets up again
/// once, then every hit counts less the closer it gets to falling; past half the clock (or once
/// it is nearly down) it gets angry and hits much harder, and the clock running out is its win.
/// The player sees a very strong Champion, never a rule.
/// </summary>
public sealed class ArenaBattle
{
    public const float Width = 960, Height = 540;
    public const float TimeLimit = 99;
    public const float HpScale = 14f;
    public const float RingReach = 230, RingTime = 0.38f;
    public const float BeamWindup = 0.45f, BeamLength = 0.22f, BeamWidth = 30;
    public const float ConeTime = 0.6f, ConeReach = 235, ConeHalfAngle = 0.5f;
    public const float DodgeLength = 0.32f, DodgeCooldownTime = 1.1f;

    /// <summary>The highest the feet go: the HP bars cover the top of the arena.</summary>
    public const float Top = 150;

    private readonly Random _random;
    private readonly bool _aura;
    private readonly List<ArenaProjectile> _projectiles = [];
    private readonly List<ArenaRing> _rings = [];
    private readonly List<ArenaFx> _fx = [];
    private float _thinkIn;
    private float _strafeIn;
    private int _strafe = 1;
    private bool _secondWind;
    private bool _enraged;
    private float _bestDamage;

    public ArenaBattle(ArenaFighterSpec player, ArenaFighterSpec champion, bool aura, int seed)
    {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(champion);
        _random = new Random(seed);
        _aura = aura;
        Player = new ArenaFighter(player, false, Width * 0.22f, Height * 0.68f);
        Champion = new ArenaFighter(champion, true, Width * 0.78f, Height * 0.6f);
    }

    public ArenaFighter Player { get; }
    public ArenaFighter Champion { get; }
    public IReadOnlyList<ArenaProjectile> Projectiles => _projectiles;
    public IReadOnlyList<ArenaRing> Rings => _rings;
    public float Time { get; private set; }
    public float TimeLeft => Math.Max(0, TimeLimit - Time);
    public ArenaOutcome Outcome { get; private set; }
    /// <summary>A short freeze after a hard hit, so it lands with weight.</summary>
    public float HitStop { get; private set; }
    /// <summary>How hard the screen shakes now (0 to 1).</summary>
    public float Shake { get; private set; }
    /// <summary>The most of the Champion's HP the player took away, in percent (0 to 100).</summary>
    public int BestDamagePercent => (int)Math.Round(Math.Clamp(_bestDamage, 0, 1) * 100);
    public bool ChampionEnraged => _enraged;

    /// <summary>What happened since the last call (the drawing turns it into effects).</summary>
    public IReadOnlyList<ArenaFx> TakeEffects()
    {
        var list = _fx.ToArray();
        _fx.Clear();
        return list;
    }

    /// <summary>Moves the battle on by <paramref name="dt"/> seconds with the player's hands.</summary>
    public void Step(float dt, ArenaInput input)
    {
        if (Outcome != ArenaOutcome.Running) return;
        dt = Math.Clamp(dt, 0, 0.05f);
        Shake = Math.Max(0, Shake - dt * 2.6f);
        if (HitStop > 0)
        {
            HitStop -= dt;
            return;
        }
        Time += dt;

        Drive(Player, input.MoveX, input.MoveY, dt);
        if (input.Dodge) TryDodge(Player, input.MoveX, input.MoveY);
        if (input.Cast >= 0) TryCast(Player, Champion, input.Cast);
        Think(dt);

        foreach (var fighter in new[] { Player, Champion })
        {
            Tick(fighter, dt);
            RunCast(fighter, fighter == Player ? Champion : Player, dt);
        }
        Separate();
        MoveProjectiles(dt);
        MoveRings(dt);
        Settle();
    }

    // ── Moving ──────────────────────────────────────────────────────────────

    private void Drive(ArenaFighter fighter, float x, float y, float dt)
    {
        var length = MathF.Sqrt(x * x + y * y);
        if (length > 1) { x /= length; y /= length; length = 1; }
        var slow = fighter.Casting >= 0 && fighter.Moves[fighter.Casting].Shape is ArenaShape.Beam or ArenaShape.Cone ? 0.3f : 1f;
        if (fighter.Stun > 0) slow = 0;
        var speed = fighter.Speed * slow * (fighter.IsChampion && _enraged ? 1.18f : 1f);
        if (fighter.DodgeTime > 0)
        {
            // A dodge keeps its own speed and direction.
        }
        else if (fighter.Casting >= 0 && fighter.Moves[fighter.Casting].Shape == ArenaShape.Strike)
        {
            // The dash of a Strike carries it.
        }
        else
        {
            // Quick to start and stop, never icy.
            var follow = 1 - MathF.Exp(-dt * 14);
            fighter.VelocityX += (x * speed - fighter.VelocityX) * follow;
            fighter.VelocityY += (y * speed - fighter.VelocityY) * follow;
        }
        if (length > 0.15f && fighter.Casting < 0)
        {
            fighter.FacingX = x / Math.Max(length, 0.0001f);
            fighter.FacingY = y / Math.Max(length, 0.0001f);
        }
    }

    private void TryDodge(ArenaFighter fighter, float x, float y)
    {
        if (fighter.DodgeCooldown > 0 || fighter.Stun > 0 || fighter.Casting >= 0) return;
        var length = MathF.Sqrt(x * x + y * y);
        if (length < 0.2f) { x = fighter.FacingX; y = fighter.FacingY; length = 1; }
        fighter.VelocityX = x / length * 640;
        fighter.VelocityY = y / length * 640;
        fighter.DodgeTime = DodgeLength;
        fighter.Invulnerable = Math.Max(fighter.Invulnerable, DodgeLength);
        fighter.DodgeCooldown = DodgeCooldownTime;
        _fx.Add(new ArenaFx(ArenaFxKind.Dodge, fighter.IsChampion, 0, ArenaShape.Strike, fighter.X, fighter.Y, x / length, y / length));
    }

    private void Tick(ArenaFighter fighter, float dt)
    {
        fighter.X = Math.Clamp(fighter.X + fighter.VelocityX * dt, fighter.Radius, Width - fighter.Radius);
        // The feet stay low enough that the sprite never goes under the HP bars at the top.
        fighter.Y = Math.Clamp(fighter.Y + fighter.VelocityY * dt, Top, Height - 18);
        if (fighter.DodgeTime > 0)
        {
            fighter.DodgeTime -= dt;
            if (fighter.DodgeTime <= 0) { fighter.VelocityX *= 0.25f; fighter.VelocityY *= 0.25f; }
        }
        fighter.DodgeCooldown = Math.Max(0, fighter.DodgeCooldown - dt);
        fighter.Stun = Math.Max(0, fighter.Stun - dt);
        fighter.Invulnerable = Math.Max(0, fighter.Invulnerable - dt);
        fighter.ShieldTime = Math.Max(0, fighter.ShieldTime - dt);
        fighter.HurtFlash = Math.Max(0, fighter.HurtFlash - dt);
        fighter.BuffGlow = Math.Max(0, fighter.BuffGlow - dt);
        var haste = fighter.IsChampion && _enraged ? 1.6f : 1f;
        for (var i = 0; i < fighter.Cooldowns.Length; i++)
            fighter.Cooldowns[i] = Math.Max(0, fighter.Cooldowns[i] - dt * haste);
        if (fighter.Healing > 0)
        {
            var heal = Math.Min(fighter.Healing, fighter.MaxHp * 0.5f * dt);
            fighter.Healing -= heal;
            fighter.Hp = Math.Min(fighter.MaxHp, fighter.Hp + heal);
        }
        // The trailing bar drains after the real one, like the games' HP bars.
        var target = fighter.HpFraction;
        fighter.ShownHp = fighter.ShownHp > target ? Math.Max(target, fighter.ShownHp - dt * 0.55f) : target;
    }

    private void Separate()
    {
        var dx = Champion.X - Player.X;
        var dy = Champion.Y - Player.Y;
        var distance = MathF.Sqrt(dx * dx + dy * dy);
        var least = Player.Radius + Champion.Radius - 8;
        if (distance >= least || distance < 0.001f) return;
        var push = (least - distance) / 2;
        dx /= distance;
        dy /= distance;
        Player.X -= dx * push;
        Player.Y -= dy * push;
        Champion.X += dx * push;
        Champion.Y += dy * push;
    }

    // ── Moves ───────────────────────────────────────────────────────────────

    private bool TryCast(ArenaFighter user, ArenaFighter target, int index)
    {
        if (index < 0 || index >= user.Moves.Count || user.Cooldowns[index] > 0 || user.Casting >= 0 || user.Stun > 0 || user.DodgeTime > 0)
            return false;
        var move = user.Moves[index];
        var (aimX, aimY) = Aim(user, target, move);
        user.AimX = aimX;
        user.AimY = aimY;
        user.FacingX = aimX;
        user.FacingY = aimY;
        user.Cooldowns[index] = move.Cooldown;
        user.Casting = index;
        user.CastTime = 0;
        user.CastHit = false;
        user.ConeTicks = 0;
        user.CastLength = move.Shape switch
        {
            ArenaShape.Strike => 0.2f,
            ArenaShape.Beam => BeamWindup + BeamLength,
            ArenaShape.Cone => ConeTime,
            ArenaShape.Burst => 0.18f,
            _ => 0.16f,
        };
        _fx.Add(new ArenaFx(ArenaFxKind.Cast, user.IsChampion, move.Type, move.Shape, user.X, user.Y, aimX, aimY));
        switch (move.Shape)
        {
            case ArenaShape.Strike:
                user.VelocityX = aimX * 720;
                user.VelocityY = aimY * 720;
                break;
            case ArenaShape.Projectile:
                var speed = move.Type switch { ArenaTypes.Electric => 860f, ArenaTypes.Fire => 620f, ArenaTypes.Water => 660f, ArenaTypes.Ghost => 480f, _ => 580f };
                _projectiles.Add(new ArenaProjectile
                {
                    ByChampion = user.IsChampion, MoveIndex = index, Type = move.Type,
                    X = user.X + aimX * 40, Y = user.Y + aimY * 40, VelocityX = aimX * speed, VelocityY = aimY * speed,
                    Radius = 15 + move.Power / 14f, Life = 1.5f,
                });
                break;
            case ArenaShape.Burst:
                _rings.Add(new ArenaRing { ByChampion = user.IsChampion, MoveIndex = index, Type = move.Type, X = user.X, Y = user.Y });
                Shake = Math.Max(Shake, 0.7f);
                break;
            case ArenaShape.Buff:
                user.Stage = Math.Min(3, user.Stage + 1);
                user.BuffGlow = 1.2f;
                _fx.Add(new ArenaFx(ArenaFxKind.Buff, user.IsChampion, move.Type, move.Shape, user.X, user.Y, 0, 0, user.Stage));
                break;
            case ArenaShape.Heal:
                user.Healing += user.MaxHp * 0.3f;
                _fx.Add(new ArenaFx(ArenaFxKind.Heal, user.IsChampion, move.Type, move.Shape, user.X, user.Y, 0, 0, user.MaxHp * 0.3f));
                break;
            case ArenaShape.Shield:
                user.ShieldTime = 0.9f;
                _fx.Add(new ArenaFx(ArenaFxKind.Shield, user.IsChampion, move.Type, move.Shape, user.X, user.Y, 0, 0));
                break;
        }
        return true;
    }

    /// <summary>Where a move goes: at the target, leading a moving target a little for shots.</summary>
    private static (float X, float Y) Aim(ArenaFighter user, ArenaFighter target, ArenaMove move)
    {
        var tx = target.X;
        var ty = target.Y;
        if (move.Shape == ArenaShape.Projectile && user.IsChampion)
        {
            var distance = MathF.Sqrt((tx - user.X) * (tx - user.X) + (ty - user.Y) * (ty - user.Y));
            var lead = distance / 620f * 0.6f;
            tx += target.VelocityX * lead;
            ty += target.VelocityY * lead;
        }
        var dx = tx - user.X;
        var dy = ty - user.Y;
        var length = MathF.Sqrt(dx * dx + dy * dy);
        return length < 0.001f ? (user.FacingX, user.FacingY) : (dx / length, dy / length);
    }

    private void RunCast(ArenaFighter user, ArenaFighter target, float dt)
    {
        if (user.Casting < 0) return;
        var index = user.Casting;
        var move = user.Moves[index];
        var before = user.CastTime;
        user.CastTime += dt;
        switch (move.Shape)
        {
            case ArenaShape.Strike when !user.CastHit:
                var reachX = user.X + user.AimX * 30;
                var reachY = user.Y + user.AimY * 30;
                if (Distance(reachX, reachY, target.X, target.Y) < user.Radius + target.Radius + 6)
                {
                    user.CastHit = true;
                    Damage(user, target, index, 1f, user.AimX, user.AimY);
                    user.VelocityX *= 0.2f;
                    user.VelocityY *= 0.2f;
                }
                break;
            case ArenaShape.Beam when before < BeamWindup && user.CastTime >= BeamWindup:
                Shake = Math.Max(Shake, 0.5f);
                if (OnBeam(user, target)) Damage(user, target, index, 1f, user.AimX, user.AimY);
                break;
            case ArenaShape.Cone:
                // Five licks of the stream, each a fifth of the move.
                var due = (int)Math.Min(5, Math.Floor(user.CastTime / ConeTime * 5) + 1);
                while (user.ConeTicks < due)
                {
                    user.ConeTicks++;
                    if (InCone(user, target)) Damage(user, target, index, 0.24f, user.AimX, user.AimY, small: true);
                }
                break;
        }
        if (user.CastTime >= user.CastLength)
        {
            user.Casting = -1;
            if (move.Shape == ArenaShape.Strike) { user.VelocityX *= 0.3f; user.VelocityY *= 0.3f; }
        }
    }

    private static bool OnBeam(ArenaFighter user, ArenaFighter target)
    {
        var dx = target.X - user.X;
        var dy = target.Y - user.Y;
        var along = dx * user.AimX + dy * user.AimY;
        if (along < 0) return false;
        var across = MathF.Abs(dx * -user.AimY + dy * user.AimX);
        return across < BeamWidth / 2 + target.Radius * 0.8f;
    }

    private static bool InCone(ArenaFighter user, ArenaFighter target)
    {
        var dx = target.X - user.X;
        var dy = target.Y - user.Y;
        var distance = MathF.Sqrt(dx * dx + dy * dy);
        if (distance > ConeReach + target.Radius || distance < 0.001f) return distance < 0.001f;
        var cos = (dx * user.AimX + dy * user.AimY) / distance;
        return cos > MathF.Cos(ConeHalfAngle);
    }

    private void MoveProjectiles(float dt)
    {
        for (var i = _projectiles.Count - 1; i >= 0; i--)
        {
            var shot = _projectiles[i];
            shot.Age += dt;
            shot.X += shot.VelocityX * dt;
            shot.Y += shot.VelocityY * dt;
            var target = shot.ByChampion ? Player : Champion;
            var user = shot.ByChampion ? Champion : Player;
            if (Distance(shot.X, shot.Y, target.X, target.Y) < shot.Radius + target.Radius * 0.8f)
            {
                var length = MathF.Sqrt(shot.VelocityX * shot.VelocityX + shot.VelocityY * shot.VelocityY);
                if (Damage(user, target, shot.MoveIndex, 1f, shot.VelocityX / length, shot.VelocityY / length)
                    || target.ShieldTime > 0)
                {
                    _projectiles.RemoveAt(i);
                    continue;
                }
            }
            if (shot.Age >= shot.Life || shot.X < -40 || shot.X > Width + 40 || shot.Y < -40 || shot.Y > Height + 40)
                _projectiles.RemoveAt(i);
        }
    }

    private void MoveRings(float dt)
    {
        for (var i = _rings.Count - 1; i >= 0; i--)
        {
            var ring = _rings[i];
            ring.Age += dt;
            var target = ring.ByChampion ? Player : Champion;
            var user = ring.ByChampion ? Champion : Player;
            if (!ring.Done && Distance(ring.X, ring.Y, target.X, target.Y) <= ring.Radius + target.Radius)
            {
                ring.Done = true;
                var dx = target.X - ring.X;
                var dy = target.Y - ring.Y;
                var length = Math.Max(0.001f, MathF.Sqrt(dx * dx + dy * dy));
                Damage(user, target, ring.MoveIndex, 1f, dx / length, dy / length);
            }
            if (ring.Age >= RingTime + 0.25f) _rings.RemoveAt(i);
        }
    }

    // ── Damage ──────────────────────────────────────────────────────────────

    /// <summary>One hit. False when it could not land (the target is dodging); a shield takes it.</summary>
    private bool Damage(ArenaFighter user, ArenaFighter target, int index, float share, float dirX, float dirY, bool small = false)
    {
        if (Outcome != ArenaOutcome.Running) return false;
        if (target.DodgeTime > 0 || (target.Invulnerable > 0 && target.ShieldTime <= 0)) return false;
        var move = user.Moves[index];
        if (target.ShieldTime > 0)
        {
            _fx.Add(new ArenaFx(ArenaFxKind.Blocked, user.IsChampion, move.Type, move.Shape, target.X, target.Y, dirX, dirY));
            return true;
        }
        var effectiveness = ArenaTypes.Effectiveness(move.Type, target.Spec.Type1, target.Spec.Type2);
        var critical = _random.Next(24) == 0;
        var amount = 0f;
        if (effectiveness > 0)
        {
            const float level = ArenaFighterSpec.Level;
            var attack = user.Power(move.Category);
            var defense = Math.Max(1, target.Guard(move.Category));
            var basic = ((2 * level / 5 + 2) * move.Power * attack / defense) / 50 + 2;
            var stab = move.Type == user.Spec.Type1 || move.Type == user.Spec.Type2 ? 1.5f : 1f;
            var roll = 0.85f + (float)_random.NextDouble() * 0.15f;
            amount = basic * stab * effectiveness * roll * (critical ? 1.5f : 1f) * share;
            // With the aura the Champion holds back until it gets angry, so the fight looks winnable
            // for most of the clock; then it hits much harder.
            if (user.IsChampion && _aura) amount *= _enraged ? 1.5f : 0.55f;
            else if (user.IsChampion && _enraged) amount *= 1.35f;
            if (_aura && !_enraged)
            {
                // Until it gets angry the Champion plays with its challenger: the player always
                // reaches the Champion's last third, and is never knocked out early.
                if (target.IsChampion && !_secondWind) amount *= 1.25f;
                if (!target.IsChampion) amount = Math.Clamp(amount, 0, Math.Max(0, target.Hp - target.MaxHp * 0.3f));
            }
            if (target.IsChampion && _aura) amount = AuraShield(amount);
        }
        target.Hp = Math.Max(0, target.Hp - amount);
        if (target.IsChampion && _aura) target.Hp = Math.Max(1, target.Hp);
        if (target.IsChampion) _bestDamage = Math.Max(_bestDamage, 1 - target.HpFraction);
        var push = small ? 60f : 220f + 260f * Math.Min(1, amount / target.MaxHp * 6);
        target.VelocityX += dirX * push;
        target.VelocityY += dirY * push;
        target.Stun = Math.Max(target.Stun, small ? 0.05f : 0.14f);
        target.HurtFlash = 0.16f;
        target.Invulnerable = Math.Max(target.Invulnerable, small ? 0 : 0.12f);
        if (!small && amount > target.MaxHp * 0.06f) HitStop = 0.05f;
        if (effectiveness > 1 || critical) Shake = Math.Max(Shake, 0.45f);
        _fx.Add(new ArenaFx(ArenaFxKind.Hit, user.IsChampion, move.Type, move.Shape, target.X, target.Y, dirX, dirY, amount, effectiveness, critical));
        return true;
    }

    /// <summary>
    /// The Champion's aura: every hit counts less the lower its HP goes, so it gets very low but
    /// never to the end. Players see a close fight.
    /// </summary>
    private float AuraShield(float amount)
    {
        var fraction = Champion.HpFraction;
        if (fraction > 0.3f) return amount;
        var left = fraction / 0.3f;
        return amount * Math.Max(0.03f, left * left);
    }

    private void Settle()
    {
        if (_aura && !_secondWind && Champion.HpFraction < 0.3f)
        {
            // Back on its feet once, stronger.
            _secondWind = true;
            Champion.Healing += Champion.MaxHp * 0.42f;
            Champion.Stage = Math.Min(3, Champion.Stage + 2);
            Champion.Invulnerable = 1.4f;
            Champion.BuffGlow = 2f;
            Shake = 1;
            _fx.Add(new ArenaFx(ArenaFxKind.SecondWind, true, Champion.Spec.Type1, ArenaShape.Buff, Champion.X, Champion.Y, 0, 0));
        }
        if (!_enraged && (Time > TimeLimit * 0.55f || (_secondWind && Champion.HpFraction < 0.2f) || (!_aura && Champion.HpFraction < 0.25f)))
        {
            _enraged = true;
            _fx.Add(new ArenaFx(ArenaFxKind.Enrage, true, Champion.Spec.Type1, ArenaShape.Buff, Champion.X, Champion.Y, 0, 0));
        }
        if (Player.Hp <= 0)
            End(ArenaOutcome.ChampionWon, Player);
        else if (Champion.Hp <= 0 && !_aura)
            End(ArenaOutcome.PlayerWon, Champion);
        else if (Time >= TimeLimit)
        {
            _fx.Add(new ArenaFx(ArenaFxKind.TimeUp, false, 0, ArenaShape.Strike, Width / 2, Height / 2, 0, 0));
            Outcome = _aura || Champion.HpFraction >= Player.HpFraction ? ArenaOutcome.ChampionWon : ArenaOutcome.PlayerWon;
        }
    }

    private void End(ArenaOutcome outcome, ArenaFighter fallen)
    {
        Outcome = outcome;
        Shake = 1;
        HitStop = 0.25f;
        _fx.Add(new ArenaFx(ArenaFxKind.Knockout, fallen.IsChampion, fallen.Spec.Type1, ArenaShape.Burst, fallen.X, fallen.Y, 0, 0));
    }

    // ── The Champion's head ─────────────────────────────────────────────────

    private void Think(float dt)
    {
        var me = Champion;
        var foe = Player;
        var dx = foe.X - me.X;
        var dy = foe.Y - me.Y;
        var distance = Math.Max(0.001f, MathF.Sqrt(dx * dx + dy * dy));
        var toX = dx / distance;
        var toY = dy / distance;

        // Fighting up close or from afar, by what it hits hardest with.
        var close = me.Moves.Where(m => m.Category != MoveCategory.Status).OrderByDescending(Score).First().Shape is ArenaShape.Strike or ArenaShape.Burst;
        var wanted = close ? 70f : 290f;
        var push = distance > wanted + 40 ? 1f : distance < wanted - 60 ? -0.85f : 0f;
        _strafeIn -= dt;
        if (_strafeIn <= 0)
        {
            _strafe = _random.Next(2) == 0 ? -1 : 1;
            _strafeIn = 1.1f + (float)_random.NextDouble() * 1.6f;
        }
        var side = close && distance < wanted + 40 ? 0.35f : 0.75f;
        var moveX = toX * push + -toY * _strafe * side;
        var moveY = toY * push + toX * _strafe * side;
        // Walls: steer back toward the middle.
        if (me.X < 90) moveX += 0.8f;
        if (me.X > Width - 90) moveX -= 0.8f;
        if (me.Y < Top + 50) moveY += 0.8f;
        if (me.Y > Height - 90) moveY -= 0.8f;
        Drive(me, moveX, moveY, dt);

        // Shots coming its way: a side step, more often when angry.
        foreach (var shot in _projectiles.Where(p => !p.ByChampion))
        {
            var sx = me.X - shot.X;
            var sy = me.Y - shot.Y;
            var near = MathF.Sqrt(sx * sx + sy * sy);
            var coming = (shot.VelocityX * sx + shot.VelocityY * sy) > 0;
            if (coming && near < 170 && me.DodgeCooldown <= 0 && _random.NextDouble() < (_enraged ? 0.08 : 0.035))
                TryDodge(me, -shot.VelocityY * _strafe, shot.VelocityX * _strafe);
        }

        _thinkIn -= dt;
        if (_thinkIn > 0 || me.Casting >= 0) return;
        _thinkIn = (_enraged ? 0.12f : 0.22f) + (float)_random.NextDouble() * 0.15f;

        var heal = Ready(m => m.Shape == ArenaShape.Heal);
        if (heal >= 0 && me.HpFraction < 0.5f && distance > 160 && TryCast(me, foe, heal)) return;
        var buff = Ready(m => m.Shape == ArenaShape.Buff);
        if (buff >= 0 && me.Stage < 2 && distance > 220 && TryCast(me, foe, buff)) return;
        var shield = Ready(m => m.Shape == ArenaShape.Shield);
        if (shield >= 0 && foe.Casting >= 0 && distance < 260 && _random.NextDouble() < 0.5 && TryCast(me, foe, shield)) return;

        var best = -1;
        var bestScore = 0f;
        for (var i = 0; i < me.Moves.Count; i++)
        {
            var move = me.Moves[i];
            if (me.Cooldowns[i] > 0 || move.Category == MoveCategory.Status) continue;
            var reach = move.Shape switch
            {
                ArenaShape.Strike => 150f,
                ArenaShape.Burst => RingReach - 10,
                ArenaShape.Cone => ConeReach - 15,
                ArenaShape.Beam => 650f,
                _ => 520f,
            };
            if (distance > reach) continue;
            var score = Score(move) * ArenaTypes.Effectiveness(move.Type, foe.Spec.Type1, foe.Spec.Type2);
            if (score > bestScore) { bestScore = score; best = i; }
        }
        if (best >= 0) TryCast(me, foe, best);

        int Ready(Func<ArenaMove, bool> kind)
        {
            for (var i = 0; i < me.Moves.Count; i++)
                if (me.Cooldowns[i] <= 0 && kind(me.Moves[i])) return i;
            return -1;
        }

        float Score(ArenaMove move) =>
            move.Power * (move.Type == me.Spec.Type1 || move.Type == me.Spec.Type2 ? 1.5f : 1f)
            * (move.Category == MoveCategory.Special ? me.Spec.SpAttack : me.Spec.Attack);
    }

    private static float Distance(float ax, float ay, float bx, float by) =>
        MathF.Sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
}

/// <summary>The 18 types (PKHeX order, 0-17) and how they hit each other (Generation 6 onward).</summary>
public static class ArenaTypes
{
    public const int Normal = 0, Fighting = 1, Flying = 2, Poison = 3, Ground = 4, Rock = 5, Bug = 6, Ghost = 7, Steel = 8,
        Fire = 9, Water = 10, Grass = 11, Electric = 12, Psychic = 13, Ice = 14, Dragon = 15, Dark = 16, Fairy = 17;

    public static IReadOnlyList<string> Names { get; } =
        ["Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost", "Steel",
         "Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon", "Dark", "Fairy"];

    private static readonly float[,] Chart = Build();

    /// <summary>How a move of <paramref name="attack"/> type hits a Pokémon of these types (0, ¼, ½, 1, 2 or 4).</summary>
    public static float Effectiveness(int attack, int type1, int type2)
    {
        if (attack is < 0 or > 17) return 1;
        var first = type1 is >= 0 and <= 17 ? Chart[attack, type1] : 1;
        var second = type2 is >= 0 and <= 17 && type2 != type1 ? Chart[attack, type2] : 1;
        return first * second;
    }

    private static float[,] Build()
    {
        var chart = new float[18, 18];
        for (var a = 0; a < 18; a++)
            for (var d = 0; d < 18; d++)
                chart[a, d] = 1;
        void Set(int attack, float value, params int[] defenders)
        {
            foreach (var defender in defenders) chart[attack, defender] = value;
        }
        Set(Normal, 0.5f, Rock, Steel); Set(Normal, 0, Ghost);
        Set(Fighting, 2, Normal, Rock, Steel, Ice, Dark); Set(Fighting, 0.5f, Flying, Poison, Bug, Psychic, Fairy); Set(Fighting, 0, Ghost);
        Set(Flying, 2, Fighting, Bug, Grass); Set(Flying, 0.5f, Rock, Steel, Electric);
        Set(Poison, 2, Grass, Fairy); Set(Poison, 0.5f, Poison, Ground, Rock, Ghost); Set(Poison, 0, Steel);
        Set(Ground, 2, Poison, Rock, Steel, Fire, Electric); Set(Ground, 0.5f, Bug, Grass); Set(Ground, 0, Flying);
        Set(Rock, 2, Flying, Bug, Fire, Ice); Set(Rock, 0.5f, Fighting, Ground, Steel);
        Set(Bug, 2, Grass, Psychic, Dark); Set(Bug, 0.5f, Fighting, Flying, Poison, Ghost, Steel, Fire, Fairy);
        Set(Ghost, 2, Ghost, Psychic); Set(Ghost, 0.5f, Dark); Set(Ghost, 0, Normal);
        Set(Steel, 2, Rock, Ice, Fairy); Set(Steel, 0.5f, Steel, Fire, Water, Electric);
        Set(Fire, 2, Bug, Steel, Grass, Ice); Set(Fire, 0.5f, Rock, Fire, Water, Dragon);
        Set(Water, 2, Ground, Rock, Fire); Set(Water, 0.5f, Water, Grass, Dragon);
        Set(Grass, 2, Ground, Rock, Water); Set(Grass, 0.5f, Flying, Poison, Bug, Steel, Fire, Grass, Dragon);
        Set(Electric, 2, Flying, Water); Set(Electric, 0.5f, Grass, Electric, Dragon); Set(Electric, 0, Ground);
        Set(Psychic, 2, Fighting, Poison); Set(Psychic, 0.5f, Steel, Psychic); Set(Psychic, 0, Dark);
        Set(Ice, 2, Flying, Ground, Grass, Dragon); Set(Ice, 0.5f, Steel, Fire, Water, Ice);
        Set(Dragon, 2, Dragon); Set(Dragon, 0.5f, Steel); Set(Dragon, 0, Fairy);
        Set(Dark, 2, Ghost, Psychic); Set(Dark, 0.5f, Fighting, Dark, Fairy);
        Set(Fairy, 2, Fighting, Dragon, Dark); Set(Fairy, 0.5f, Poison, Steel, Fire);
        return chart;
    }
}
