namespace PKForge.Domain;

/// <summary>A precomputed, closed stroll through reachable terrain. Sampling is allocation-free
/// and independent of frame rate or the order in which timestamps are requested. Routes are
/// planned on an 8-unit grid and then pulled straight wherever the whole body fits, so a
/// resident walks in long, steady lines instead of zigzagging from cell to cell.</summary>
public sealed class ParkWander
{
    private const int Cell = 8;
    private readonly record struct Leg(ParkPoint From, ParkPoint To, long Start, long Duration, int Facing);
    private readonly Leg[] _legs;
    private readonly long _duration;
    private readonly long _offset;
    private readonly ParkMap _map;

    /// <summary>Walking pace, in map units per second (the map is 480 wide).</summary>
    public const float MinSpeed = 17, MaxSpeed = 23;

    public ParkWander(ParkMap map, ParkTraversal allowed, ParkTerrain preferredTerrain, int seed, float radius = 8)
    {
        _map = map;
        var random = new Random(seed);
        var columns = (int)ParkMap.Width / Cell;
        var rows = (int)ParkMap.Height / Cell;
        var points = new ParkPoint[columns * rows];
        var valid = new bool[points.Length];
        var candidates = new List<int>();
        var preferred = new List<int>();
        for (var y = 0; y < rows; y++)
        for (var x = 0; x < columns; x++)
        {
            var i = y * columns + x;
            points[i] = new(x * Cell + Cell / 2f, y * Cell + Cell / 2f);
            var p = points[i];
            valid[i] = map.CanOccupy(p.X, p.Y, allowed, radius);
            if (!valid[i]) continue;
            candidates.Add(i);
            if (map.TerrainAt(p.X, p.Y) == preferredTerrain) preferred.Add(i);
        }
        if (candidates.Count == 0)
            throw new ArgumentException("This map has no traversable space for the resident.", nameof(allowed));

        // Check the entire edge, including diagonal corners, rather than just its endpoints.
        var edges = new List<int>[points.Length];
        for (var i = 0; i < points.Length; i++)
        {
            edges[i] = [];
            if (!valid[i]) continue;
            var x = i % columns;
            var y = i / columns;
            for (var dy = -1; dy <= 1; dy++)
            for (var dx = -1; dx <= 1; dx++)
            {
                if (dx == 0 && dy == 0 || x + dx < 0 || x + dx >= columns || y + dy < 0 || y + dy >= rows) continue;
                var next = (y + dy) * columns + x + dx;
                if (!valid[next]) continue;
                if (dx != 0 && dy != 0 && (!valid[y * columns + x + dx] || !valid[(y + dy) * columns + x])) continue;
                var safe = true;
                for (var sample = 1; sample < 16; sample++)
                {
                    var t = sample / 16f;
                    var a = points[i]; var b = points[next];
                    if (map.CanOccupy(a.X + (b.X - a.X) * t, a.Y + (b.Y - a.Y) * t, allowed, radius)) continue;
                    safe = false;
                    break;
                }
                if (safe) edges[i].Add(next);
            }
        }

        var parents = new int[points.Length];
        var queue = new Queue<int>();
        void Search(int origin)
        {
            Array.Fill(parents, -1);
            parents[origin] = origin;
            queue.Clear(); queue.Enqueue(origin);
            while (queue.TryDequeue(out var i))
                foreach (var next in edges[i])
                    if (parents[next] == -1) { parents[next] = i; queue.Enqueue(next); }
        }

        // Live in the largest open area: a resident never starts in a pocket between trees it
        // could not leave, and its preferred terrain only counts where it can get to it.
        var component = new int[points.Length];
        Array.Fill(component, -1);
        var sizes = new List<int>();
        foreach (var cell in candidates)
        {
            if (component[cell] != -1) continue;
            var id = sizes.Count;
            var size = 0;
            component[cell] = id;
            queue.Clear(); queue.Enqueue(cell);
            while (queue.TryDequeue(out var i))
            {
                size++;
                foreach (var next in edges[i])
                    if (component[next] == -1) { component[next] = id; queue.Enqueue(next); }
            }
            sizes.Add(size);
        }
        var preferredSize = new int[sizes.Count];
        foreach (var cell in preferred) preferredSize[component[cell]]++;
        // The home area: the biggest one holding some preferred terrain, else the biggest.
        var home = Enumerable.Range(0, sizes.Count)
            .OrderByDescending(c => preferredSize[c] > 0 ? 1 : 0).ThenByDescending(c => sizes[c]).First();
        if (preferredSize[home] > 0 && sizes[home] * 4 < sizes.Max())
            home = Enumerable.Range(0, sizes.Count).OrderByDescending(c => sizes[c]).First();
        candidates.RemoveAll(i => component[i] != home);
        preferred.RemoveAll(i => component[i] != home);

        var spawnPool = preferred.Count > 0 ? preferred : candidates;
        var start = spawnPool[random.Next(spawnPool.Count)];
        var legs = new List<Leg>();
        long clock = 0;
        var current = start;
        var facing = random.Next(8);
        var speed = MinSpeed + (float)random.NextDouble() * (MaxSpeed - MinSpeed);
        for (var stop = 0; stop < 9; stop++)
        {
            var p = points[current];
            var rest = random.Next(2500, 8001);
            legs.Add(new(p, p, clock, rest, facing)); clock += rest;
            var pool = preferred.Count > 1 && random.Next(5) != 0 ? preferred : candidates;
            var target = stop == 8 ? start : pool[random.Next(pool.Count)];
            // Encourage meaningful trips rather than frequently picking adjacent cells.
            for (var attempt = 0; stop < 8 && attempt < 12 && Distance(points[current], points[target]) < 64; attempt++)
                target = pool[random.Next(pool.Count)];
            if (target == current) continue;
            Search(current);
            var route = new List<int>();
            for (var step = target; step != current; step = parents[step]) route.Add(step);
            route.Reverse();
            foreach (var next in Straighten(current, route))
            {
                var from = points[current]; var to = points[next];
                facing = ParkMotion.Facing(to.X - from.X, to.Y - from.Y);
                var duration = Math.Max(1, (long)Math.Ceiling(Distance(from, to) / speed * 1000));
                legs.Add(new(from, to, clock, duration, facing)); clock += duration;
                current = next;
            }
        }

        // String pulling: from each corner, go straight to the farthest later cell of the
        // route that the whole body can reach in a line.
        List<int> Straighten(int origin, List<int> route)
        {
            var corners = new List<int>();
            var anchor = origin;
            var k = 0;
            while (k < route.Count)
            {
                var best = k;
                for (var j = route.Count - 1; j > k; j--)
                    if (Clear(points[anchor], points[route[j]])) { best = j; break; }
                corners.Add(route[best]);
                anchor = route[best];
                k = best + 1;
            }
            return corners;
        }

        bool Clear(ParkPoint a, ParkPoint b)
        {
            var steps = Math.Max(1, (int)MathF.Ceiling(Distance(a, b) / 2));
            for (var step = 1; step < steps; step++)
            {
                var t = step / (float)steps;
                if (!map.CanOccupy(a.X + (b.X - a.X) * t, a.Y + (b.Y - a.Y) * t, allowed, radius)) return false;
            }
            return true;
        }
        _legs = legs.ToArray(); _duration = clock;
        _offset = (long)(random.NextDouble() * clock);
    }

    public ParkResidentState GetState(long time)
    {
        var t = ((time % _duration + _duration) % _duration + _offset) % _duration;
        var low = 0; var high = _legs.Length - 1;
        while (low < high)
        {
            var mid = (low + high + 1) / 2;
            if (_legs[mid].Start <= t) low = mid; else high = mid - 1;
        }
        var leg = _legs[low];
        var progress = (t - leg.Start) / (float)leg.Duration;
        var x = leg.From.X + (leg.To.X - leg.From.X) * progress;
        var y = leg.From.Y + (leg.To.Y - leg.From.Y) * progress;
        var walking = leg.From != leg.To;
        var terrain = _map.TerrainAt(x, y);
        var activity = (terrain, walking) switch
        {
            (ParkTerrain.Water, true) => "Exploring the water",
            (ParkTerrain.Water, false) => "Relaxing in the shallows",
            (ParkTerrain.Lava, true) => "Exploring the warm pools",
            (ParkTerrain.Lava, false) => "Basking in volcanic warmth",
            (ParkTerrain.Air, true) => "Gliding on the mountain breeze",
            (ParkTerrain.Air, false) => "Drifting on a gentle updraft",
            (_, true) => "Taking a gentle stroll",
            _ => "Enjoying a peaceful break"
        };
        return new(x, y, walking, leg.Facing, walking ? "Curious" : "Content", activity);
    }

    private static float Distance(ParkPoint a, ParkPoint b) => MathF.Sqrt((a.X - b.X) * (a.X - b.X) + (a.Y - b.Y) * (a.Y - b.Y));
}
