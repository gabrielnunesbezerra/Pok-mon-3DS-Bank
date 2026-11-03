using SkiaSharp;

namespace PKForge.App.Views;

/// <summary>
/// How a hit feels: the target flashing white for two frames, the screen shaking briefly by as
/// much as the hit was worth, and the whole screen lighting up for the big moments. All of it
/// is drawing only: the battle's own hit stop (its short freeze after a hard hit) is read by
/// the renderer, never changed.
/// </summary>
internal sealed class ArenaFeel
{
    /// <summary>How long a full shake takes to settle.</summary>
    private const float ShakeTime = 0.22f;
    private const int MaxShakePixels = 4;
    private const int FlashFrames = 2;

    private readonly Random _random;
    private float _trauma;
    private int _playerFlash;
    private int _championFlash;
    private int _screenFrames;
    private SKColor _screenColor;

    public ArenaFeel(Random random) => _random = random;

    /// <summary>Shakes the screen, 0 (nothing) to 1 (a knockout). A weaker shake never cuts a stronger one short.</summary>
    public void Shake(float amount) => _trauma = Math.Clamp(Math.Max(_trauma, amount), 0, 1);

    /// <summary>The fighter that was hit turns white for the next two frames.</summary>
    public void FlashTarget(bool champion)
    {
        if (champion) _championFlash = FlashFrames;
        else _playerFlash = FlashFrames;
    }

    public bool Flashing(bool champion) => (champion ? _championFlash : _playerFlash) > 0;

    /// <summary>Lights the whole screen up for a few frames (super effective, a knockout...).</summary>
    public void FlashScreen(SKColor color, int frames)
    {
        if (frames < _screenFrames) return;
        _screenColor = color;
        _screenFrames = frames;
    }

    /// <summary>The screen flash this frame: strong on its first frames, then half as strong, then gone.</summary>
    public SKColor? ScreenFlash => _screenFrames switch
    {
        <= 0 => null,
        > 2 => _screenColor.WithAlpha(110),
        _ => _screenColor.WithAlpha(55),
    };

    public void Update(float dt) => _trauma = Math.Max(0, _trauma - dt / ShakeTime);

    /// <summary>This frame's shake, in whole art pixels.</summary>
    public SKPointI Offset()
    {
        var reach = (int)MathF.Round(_trauma * MaxShakePixels);
        return reach == 0 ? default : new SKPointI(_random.Next(-reach, reach + 1), _random.Next(-reach, reach + 1));
    }

    /// <summary>Counts the frame just drawn off the flashes.</summary>
    public void EndFrame()
    {
        _playerFlash = Math.Max(0, _playerFlash - 1);
        _championFlash = Math.Max(0, _championFlash - 1);
        _screenFrames = Math.Max(0, _screenFrames - 1);
    }
}
