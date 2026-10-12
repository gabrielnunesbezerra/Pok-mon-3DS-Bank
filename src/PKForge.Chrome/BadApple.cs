using System.IO.Compression;
using SkiaSharp;

namespace PKForge.Chrome;

/// <summary>
/// The About screen's easter egg frames: 1-bit frames, each stored
/// XORed with the one before it, read forward one at a time from a gzip stream.
/// </summary>
public sealed class BadAppleFrames : IDisposable
{
    private readonly GZipStream _stream;
    private readonly byte[] _delta;

    public int Width { get; }
    public int Height { get; }
    public int Fps { get; }
    public int Count { get; }

    /// <summary>The frame last read: rows of bits, most significant first, 1 = white.</summary>
    public byte[] Bits { get; }

    /// <summary>The index of <see cref="Bits"/>; -1 before the first read.</summary>
    public int Index { get; private set; } = -1;

    public BadAppleFrames(Stream source)
    {
        Span<byte> header = stackalloc byte[12];
        source.ReadExactly(header);
        if (header[0] != 'B' || header[1] != 'A' || header[2] != 'P' || header[3] != 'L')
            throw new InvalidDataException("Not a Bad Apple frame file.");
        Width = BitConverter.ToUInt16(header[4..]);
        Height = BitConverter.ToUInt16(header[6..]);
        Fps = BitConverter.ToUInt16(header[8..]);
        Count = BitConverter.ToUInt16(header[10..]);
        Bits = new byte[Width * Height / 8];
        _delta = new byte[Bits.Length];
        _stream = new GZipStream(source, CompressionMode.Decompress);
    }

    /// <summary>Reads forward to <paramref name="index"/> (never back); false past the last frame.</summary>
    public bool SeekForward(int index)
    {
        if (index >= Count) return false;
        while (Index < index)
        {
            _stream.ReadExactly(_delta);
            for (var i = 0; i < Bits.Length; i++) Bits[i] ^= _delta[i];
            Index++;
        }
        return true;
    }

    public bool this[int x, int y] => (Bits[(y * Width + x) >> 3] & (0x80 >> ((y * Width + x) & 7))) != 0;

    public void Dispose() => _stream.Dispose();
}

/// <summary>
/// Draws a Bad Apple frame as text art: one character per 2×2 block of pixels, taken from a
/// stream of the app's own words that scrolls as the video plays. Full blocks get the
/// brightest ink, edges a softer one, black blocks nothing. Colors come from the theme.
/// </summary>
public sealed class BadApplePainter
{
    private readonly ushort[] _glyphs;

    public BadApplePainter(SKFont font, string text)
    {
        _glyphs = font.GetGlyphs(text);
        if (_glyphs.Length == 0) _glyphs = font.GetGlyphs("PKFORGE");
    }

    public void Paint(SKCanvas c, SKRect area, BadAppleFrames frames, SKFont font, ColorTheme theme)
    {
        var cols = frames.Width / 2;
        var rows = frames.Height / 2;
        var cell = Math.Min(area.Width / cols, area.Height / rows);
        var left = area.MidX - cell * cols / 2;
        var top = area.MidY - cell * rows / 2;
        using var cellFont = new SKFont(font.Typeface, cell * 0.95f);
        var baseline = cell * 0.78f;

        // Three inks, one positioned-glyph run each.
        var full = new List<(ushort, SKPoint)>(cols * rows);
        var most = new List<(ushort, SKPoint)>();
        var edge = new List<(ushort, SKPoint)>();
        var scroll = frames.Index;
        for (var row = 0; row < rows; row++)
            for (var col = 0; col < cols; col++)
            {
                var x = col * 2;
                var y = row * 2;
                var cover = (frames[x, y] ? 1 : 0) + (frames[x + 1, y] ? 1 : 0) + (frames[x, y + 1] ? 1 : 0) + (frames[x + 1, y + 1] ? 1 : 0);
                if (cover == 0) continue;
                var glyph = _glyphs[(row * cols + col + scroll) % _glyphs.Length];
                var at = new SKPoint(left + col * cell + cell * 0.06f, top + row * cell + baseline);
                (cover == 4 ? full : cover == 3 ? most : edge).Add((glyph, at));
            }

        Run(c, cellFont, full, theme.Bright);
        Run(c, cellFont, most, theme.Bright.WithAlpha(190));
        Run(c, cellFont, edge, theme.Label.WithAlpha(150));
    }

    private static void Run(SKCanvas c, SKFont font, List<(ushort Glyph, SKPoint At)> run, SKColor color)
    {
        if (run.Count == 0) return;
        using var builder = new SKTextBlobBuilder();
        var buffer = builder.AllocatePositionedRun(font, run.Count);
        var glyphs = buffer.Glyphs;
        var points = buffer.Positions;
        for (var i = 0; i < run.Count; i++)
        {
            glyphs[i] = run[i].Glyph;
            points[i] = run[i].At;
        }
        using var blob = builder.Build();
        using var paint = new SKPaint { Color = color, IsAntialias = false };
        c.DrawText(blob, 0, 0, paint);
    }
}
