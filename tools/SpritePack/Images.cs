using SkiaSharp;

/// <summary>Lossless WebP re-encoding with a pixel check, shared by the sprite pack and the BDSP add-on.</summary>
internal static class Images
{
    /// <summary>
    /// Re-encodes a PNG as lossless WebP. Checked on the unpremultiplied pixels: every visible
    /// pixel (alpha &gt; 0) must come back exactly. Lossless WebP drops the color hidden under
    /// fully transparent pixels, which is never drawn. (A premultiplied compare is not
    /// meaningful: Skia's PNG and WebP decoders round the premultiply step differently.)
    /// </summary>
    public static byte[] LosslessWebp(byte[] png, string label)
    {
        using var source = Decode(png);
        using var data = source.PeekPixels().Encode(new SKWebpEncoderOptions(SKWebpEncoderCompression.Lossless, 100))
            ?? throw new InvalidOperationException($"WebP encoding failed: {label}");
        var webp = data.ToArray();
        using var roundTrip = Decode(webp);
        var a = source.GetPixelSpan();
        var b = roundTrip.GetPixelSpan();
        if (a.Length != b.Length) throw new InvalidOperationException($"WebP size differs: {label}");
        for (var i = 0; i < a.Length; i += 4)
        {
            if (a[i + 3] == 0 && b[i + 3] == 0) continue;
            if (!a.Slice(i, 4).SequenceEqual(b.Slice(i, 4)))
                throw new InvalidOperationException($"WebP changes pixel {i / 4}: {label}");
        }
        return webp;
    }

    private static SKBitmap Decode(byte[] bytes)
    {
        using var codec = SKCodec.Create(new SKMemoryStream(bytes)) ?? throw new InvalidDataException("Unreadable image.");
        var info = codec.Info.WithColorType(SKColorType.Rgba8888).WithAlphaType(SKAlphaType.Unpremul);
        var bitmap = new SKBitmap(info);
        if (codec.GetPixels(info, bitmap.GetPixels()) != SKCodecResult.Success)
            throw new InvalidDataException("Image decode failed.");
        return bitmap;
    }
}
