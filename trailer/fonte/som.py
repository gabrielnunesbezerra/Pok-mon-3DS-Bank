import numpy as np, wave
SR = 44100; DUR = 2210 / 30; N = int(SR * DUR); out = np.zeros(N)
rng = np.random.default_rng(7)
cortes = np.cumsum([0, 105, 90, 300, 90, 300, 90, 240, 60, 165, 165, 165, 150, 120]) / 30
def add(sig, t0, gain=1.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if i < N and j > i: out[i:j] += sig[: j - i] * gain
def env(n, a=0.005, d=0.3):
    t = np.arange(n) / SR; return np.minimum(1, t / a) * np.exp(-t / d)
def kick():
    n = int(0.45 * SR); t = np.arange(n) / SR; f = 50 + 120 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.18)
def snare():
    n = int(0.3 * SR); t = np.arange(n) / SR
    return (rng.standard_normal(n) * 0.6 + np.sin(2 * np.pi * 190 * t) * 0.5) * env(n, 0.001, 0.09)
def hat():
    n = int(0.06 * SR); x = rng.standard_normal(n); x = np.diff(np.concatenate([[0], x])); return x * env(n, 0.001, 0.02) * 0.5
def impacto():
    n = int(2.2 * SR); t = np.arange(n) / SR; f = 40 + 80 * np.exp(-t * 6)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.003, 0.7)
    noise = rng.standard_normal(n) * env(n, 0.001, 0.35) * 0.5
    return boom + noise
def riser(d):
    n = int(d * SR); t = np.arange(n) / SR; f = 200 + 1800 * (t / d) ** 2
    return (rng.standard_normal(n) * 0.3 + np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.15) * (t / d) ** 2
def nota(freq, d, tipo='saw', a=0.01, dec=None):
    n = int(d * SR); t = np.arange(n) / SR
    ph = (freq * t) % 1
    w = 2 * ph - 1 if tipo == 'saw' else np.sign(np.sin(2 * np.pi * freq * t)) if tipo == 'sq' else np.sin(2 * np.pi * freq * t)
    e = np.minimum(1, t / a) * (np.exp(-t / dec) if dec else np.minimum(1, (d - t) / 0.05))
    return w * e
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
BPM = 124; b = 60 / BPM
prog = [45, 41, 48, 43]  # A F C G
# drone de abertura
add(nota(hz(33), 3.5, 'sine', 1.5) * 0.5 + nota(hz(45), 3.5, 'saw', 2) * 0.08, 0)
add(riser(2.2), 1.3, 0.6)
def secao(t0, t1, forte):
    t = t0; k = 0
    while t < t1 - 0.01:
        bar = int(k / 4) % 4; root = prog[bar]
        add(kick(), t, 0.9)
        if forte: add(kick(), t + b / 2, 0.35) if k % 2 else None
        if k % 4 in (1, 3): add(snare(), t, 0.45)
        for h in range(2): add(hat(), t + h * b / 2, 0.25)
        add(nota(hz(root - 12), b * 0.9, 'saw', 0.005, 0.25), t, 0.22)
        add(nota(hz(root - 12), b * 0.4, 'saw', 0.005, 0.12), t + b / 2, 0.15)
        if k % 4 == 0:
            for iv in (0, 3 if bar in (0,) else 4, 7):
                add(nota(hz(root + 12 + iv), b * 4, 'saw', 0.3), t, 0.035)
        if forte:
            arp = [0, 7, 12, 15 if bar == 0 else 16]
            for i in range(4): add(nota(hz(root + 24 + arp[i]), b / 4, 'sq', 0.002, 0.06), t + i * b / 4, 0.05)
        t += b; k += 1
secao(cortes[1], cortes[7], False)
add(riser(2.0), cortes[7] - 0.1, 0.8)
secao(cortes[8], cortes[12], True)
for c in cortes[1:13]: add(impacto(), c, 0.55 if c not in (cortes[8], cortes[12], cortes[1]) else 1.0)
# acorde final e silêncio na frase
for iv in (0, 7, 12, 16, 19): add(nota(hz(45 + iv), 4.0, 'saw', 0.01, 1.8), cortes[12], 0.06)
add(nota(hz(33), 5, 'sine', 1.0) * 0.25, cortes[13])
add(rng.standard_normal(int(0.2 * SR)) * 0.3, cortes[13] + 44 / 30, 0.5)
out = np.tanh(out * 1.2); out /= np.max(np.abs(out)) * 1.05
fade = int(1.0 * SR); out[-fade:] *= np.linspace(1, 0, fade)
pcm = (out * 32767).astype(np.int16)
with wave.open('som.wav', 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', DUR)
