#!/usr/bin/env python3
"""The eras' tunes, measured for the ear: does a tune go round in a loop,
how is it built, how loud and how clean is it, and how would a listener
rate it.

    tools/assets/sfx/.venv/bin/python tools/assets/sfx/judge.py           # every tune served, and each as heard
    tools/assets/sfx/.venv/bin/python tools/assets/sfx/judge.py canal     # one era's tunes
    tools/assets/sfx/.venv/bin/python tools/assets/sfx/judge.py raw/music-canal-iv-1.mp3 --out take-iv-1
    ... judge.py --no-aes                                                 # without the listener model

Runs in its own environment (tools/assets/sfx/.venv, git-ignored: numpy,
scipy, librosa, soundfile, pyloudnorm, torch for the CPU and Meta's
audiobox_aesthetics). The listener model's weights (about 400 MB) are
fetched from Hugging Face on the first run, into .venv/hf unless HF_HOME
says otherwise. Spends nothing: no call to ElevenLabs.

A served tune is read from app/public/sfx/<name>.webm; "as heard" is the
tune as the game plays it (playlist.ts): a loop played its `turns` times
over. Each result is written to judge/<out>.json (default: the era, or
`all`), rounded so that two runs on the same files give the same file.

What is measured (see CHOIX.md, "The judge", for the thresholds):

  repetition   beats tracked, a chroma (harmony) and MFCC (timbre) vector
               per beat, each dimension standardised over the tune, then
               PHRASE seconds of beats laid end to end. Two moments are a
               near-duplicate when their phrases' cosine reaches DUP.
               dup     share of the timeline that repeats a phrase heard at
                       least a phrase earlier
               run     the longest span (s) repeated beat for beat
               recur   how often the most repeated phrase is heard in all
               loopy   one score, 0 (never repeats) to 100 (one phrase
                       round and round): the mean of dup, run over 60 s
                       and (recur - 1) over 7, each capped at 1
  structure    a novelty curve (Foote's checkerboard over the beats'
               self-similarity), its peaks at least MIN_SECTION apart:
               the sections, their lengths, and letters for them (two
               sections alike over SAME share a letter: ABAC)
  loudness     integrated loudness (LUFS) and loudness range (LRA, LU) by
               ffmpeg's EBU R128 meter, the peak and the crest (peak over
               RMS), the holes inside (a second or more 25 dB under the
               median: the piece seeming to stop), the balance of five
               bands, the model's 200 Hz comb
               (how far each multiple of 200 Hz stands over its
               neighbours: its median over 400 Hz-5 kHz), and the seam of
               a loop (the sample step across it over the 99th percentile
               of the steps inside)
  listener     Audiobox Aesthetics, over 10 s windows laid evenly end to
               end (no padded scrap at the tail): CE (content
               enjoyment), CU (content usefulness), PC (production
               complexity), PQ (production quality), 1 to 10; the mean,
               and the weakest window of CE
"""
import json, os, re, subprocess, sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
SERVED = os.path.join(ROOT, 'app', 'public', 'sfx')
PLAYLIST = os.path.join(ROOT, 'app', 'src', 'gl', 'playlist.ts')
OUT = os.path.join(HERE, 'judge')
os.environ.setdefault('HF_HOME', os.path.join(HERE, '.venv', 'hf'))

RATE = 48000
# the analysis runs at 22.05 kHz, 512 samples a frame (23 ms)
SR, HOP = 22050, 512
# a phrase: this many seconds of beats laid end to end are compared at once
PHRASE = 4.0
# two phrases this alike (cosine of their standardised features) are heard
# as the same music; calibrated on music-canal, whose four phrases are one
# air played round and round (CHOIX.md)
DUP = 0.70
# a section is at least this long; two sections this alike share a letter
MIN_SECTION = 12.0
SAME = 0.80


def decode(path: str) -> np.ndarray:
    """(channels, samples) float32 at RATE, stereo, by ffmpeg."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '2', '-ar', str(RATE), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype='<f4').reshape(-1, 2).T.copy()


def tunes_of_playlist() -> dict:
    """{era: [(name, loop seconds or None, turns)]} read from playlist.ts."""
    src = open(PLAYLIST).read()
    body = re.search(r'export const TUNES[^=]*=\s*\{(.*?)\n\};', src, re.S).group(1)
    eras = {}
    for era, items in re.findall(r'(\w+):\s*\[(.*?)\],', body, re.S):
        eras[era] = []
        for obj in re.findall(r'\{([^}]*)\}', items):
            name = re.search(r"name:\s*'([^']+)'", obj).group(1)
            loop = re.search(r'loop:\s*([\d.]+)', obj)
            turns = re.search(r'turns:\s*(\d+)', obj)
            eras[era].append((name, float(loop.group(1)) if loop else None, int(turns.group(1)) if turns else 1))
    return eras


def as_heard(x: np.ndarray, loop: float | None, turns: int) -> np.ndarray:
    if not loop:
        return x
    one = x[:, : int(round(loop * RATE))]
    return np.concatenate([one] * turns, axis=1)


# ---------------------------------------------------------------- repetition

def beat_features(mono: np.ndarray):
    import librosa
    y = librosa.resample(mono, orig_sr=RATE, target_sr=SR, res_type='soxr_hq')
    _, beats = librosa.beat.beat_track(y=y, sr=SR, hop_length=HOP, trim=False)
    beats = np.unique(np.concatenate([[0], beats]))
    chroma = librosa.feature.chroma_cqt(y=y, sr=SR, hop_length=HOP)
    mfcc = librosa.feature.mfcc(y=y, sr=SR, hop_length=HOP, n_mfcc=13)[1:13]
    feats = np.vstack([librosa.util.sync(chroma, beats, aggregate=np.median), librosa.util.sync(mfcc, beats, aggregate=np.mean)])
    times = librosa.frames_to_time(beats, sr=SR, hop_length=HOP)
    # the last beat's span runs to the end of the tune
    n = feats.shape[1]
    times = times[:n]
    z = (feats - feats.mean(axis=1, keepdims=True)) / (feats.std(axis=1, keepdims=True) + 1e-8)
    return z, times, len(y) / SR


def embed(z: np.ndarray, m: int) -> np.ndarray:
    n = z.shape[1] - m + 1
    e = np.stack([z[:, i : i + m].T.reshape(-1) for i in range(n)])
    return e / (np.linalg.norm(e, axis=1, keepdims=True) + 1e-8)


def repetition(z: np.ndarray, times: np.ndarray, length: float) -> dict:
    period = float(np.median(np.diff(times))) if len(times) > 2 else 0.5
    m = max(2, int(round(PHRASE / period)))
    e = embed(z, m)
    n = len(e)
    s = e @ e.T
    # a phrase is compared only with phrases wholly before it
    earlier = np.tril(np.ones((n, n), bool), k=-m)
    best = np.where(earlier, s, -1).max(axis=1)
    dup_beats = best >= DUP
    # time share: each beat weighs its own span
    span = np.diff(np.append(times, length))[:n]
    dup = float((span * dup_beats).sum() / max(span.sum(), 1e-8))
    # the longest diagonal run of near-duplicates: a stretch heard again beat for beat
    r = (s >= DUP) & earlier
    run_beats, run_s = 0, 0.0
    for lag in range(m, n):
        d = np.diagonal(r, offset=-lag)
        k = 0
        for i, v in enumerate(d):
            k = k + 1 if v else 0
            if k > run_beats:
                run_beats = k
                start = i + lag - k + 1
                run_s = float(times[min(start + k - 1 + m - 1, len(times) - 1)] - times[start] + period)
    # how often the most repeated phrase comes: its matches, a phrase apart
    recur = 1
    for i in range(n):
        hits = np.flatnonzero(s[i] >= DUP)
        count, last = 0, -10**9
        for j in hits:
            if j - last >= m:
                count, last = count + 1, j
        recur = max(recur, count)
    loopy = 100 * (min(dup, 1) + min(run_s / 60, 1) + min((recur - 1) / 7, 1)) / 3
    return {'beat_s': round(period, 3), 'phrase_beats': m, 'dup': round(dup, 3), 'run_s': round(run_s, 1), 'recur': int(recur),
            'mean_best': round(float(best[m:].mean()) if n > m else 0.0, 3), 'loopy': round(loopy, 1)}


# ---------------------------------------------------------------- structure

def structure(z: np.ndarray, times: np.ndarray, length: float) -> dict:
    from scipy.signal import find_peaks
    period = float(np.median(np.diff(times))) if len(times) > 2 else 0.5
    zz = z / (np.linalg.norm(z, axis=0, keepdims=True) + 1e-8)
    s = zz.T @ zz
    n = s.shape[0]
    half = max(4, int(round(6.0 / period)))
    g = np.arange(-half, half) + 0.5
    gauss = np.exp(-(g / (0.5 * half)) ** 2)
    kernel = np.outer(gauss, gauss) * np.outer(np.sign(g), np.sign(g))
    pad = np.pad(s, half, mode='edge')
    nov = np.array([np.sum(kernel * pad[i : i + 2 * half, i : i + 2 * half]) for i in range(n)])
    nov = np.maximum(nov, 0)
    nov = nov / (nov.max() + 1e-8)
    peaks, _ = find_peaks(nov, height=0.25, distance=max(1, int(round(MIN_SECTION / period))))
    bounds = [0.0] + [float(times[p]) for p in peaks if MIN_SECTION <= times[p] <= length - MIN_SECTION] + [length]
    # a section's mean features; alike sections share a letter
    idx = [np.searchsorted(times, b) for b in bounds]
    means = []
    for a, b in zip(idx[:-1], idx[1:]):
        v = z[:, a : max(b, a + 1)].mean(axis=1)
        means.append(v / (np.linalg.norm(v) + 1e-8))
    letters, protos = [], []
    for v in means:
        for k, p in enumerate(protos):
            if float(v @ p) >= SAME:
                letters.append(chr(65 + k))
                break
        else:
            protos.append(v)
            letters.append(chr(65 + len(protos) - 1))
    return {'sections': len(bounds) - 1, 'distinct': len(protos), 'form': ''.join(letters),
            'lengths_s': [round(b - a, 1) for a, b in zip(bounds[:-1], bounds[1:])]}


# ---------------------------------------------------------------- loudness, balance, hum, seam

def ebur128(x: np.ndarray) -> tuple[float, float]:
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-f', 'f32le', '-ac', '2', '-ar', str(RATE), '-i', '-', '-af', 'ebur128', '-f', 'null', '-'],
                       input=x.T.astype('<f4').tobytes(), capture_output=True, check=True)
    err = p.stderr.decode()
    i = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', err)[-1])
    lra = float(re.findall(r'LRA:\s+(-?[\d.]+) LU', err)[-1])
    return i, lra


def level(x: np.ndarray, loop: float | None, turns: int) -> dict:
    import pyloudnorm
    from scipy.signal import welch
    i, lra = ebur128(x)
    pyln = pyloudnorm.Meter(RATE).integrated_loudness(x.T.astype(np.float64))
    mono = x.mean(axis=0)
    peak = 20 * np.log10(np.abs(x).max() + 1e-12)
    rms = 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
    f, p = welch(mono, fs=RATE, nperseg=8192)
    total = p.sum()
    bands = {}
    for name, lo, hi in (('sub<90', 0, 90), ('low90-250', 90, 250), ('mid250-2k', 250, 2000), ('pres2k-6k', 2000, 6000), ('air>6k', 6000, RATE / 2)):
        bands[name] = round(float(10 * np.log10(p[(f >= lo) & (f < hi)].sum() / total + 1e-12)), 1)
    centroid = float((f * p).sum() / total)
    # the model's comb: a fine spectrum (0.2 Hz), each multiple of 200 Hz
    # over the median of its neighbours 3-20 Hz off
    f2, p2 = welch(mono, fs=RATE, nperseg=RATE * 5)
    excess = []
    for k in range(2, 26):
        c = 200.0 * k
        at = p2[(f2 >= c - 0.4) & (f2 <= c + 0.4)].max()
        near = p2[((f2 >= c - 20) & (f2 <= c - 3)) | ((f2 >= c + 3) & (f2 <= c + 20))]
        excess.append(10 * np.log10(at / (np.median(near) + 1e-20) + 1e-20))
    out = {'lufs': round(i, 1), 'lufs_pyln': round(float(pyln), 1), 'lra': round(lra, 1), 'peak_db': round(float(peak), 1),
           'crest_db': round(float(peak - rms), 1), 'bands_db': bands, 'centroid_hz': round(centroid),
           'hum_db': round(float(np.median(excess)), 1), 'hum_max_db': round(float(np.max(excess)), 1)}
    # the head and the tail: how the tune comes in and goes out (10 ms RMS, dBFS)
    w = RATE // 100
    db = lambda seg: round(float(20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12)), 1)
    out['head_db'], out['tail_db'] = db(x[:, :w]), db(x[:, -w:])
    # the holes inside: 0.25 s windows 25 dB or more under the tune's median,
    # a second or longer, away from the first and last 5 s (heard as the
    # piece stopping and starting again)
    q = RATE // 4
    wins = np.array([np.sqrt(np.mean(x[:, a : a + q] ** 2)) for a in range(0, x.shape[1] - q + 1, q)])
    wdb = 20 * np.log10(wins + 1e-12)
    low = wdb < np.median(wdb) - 25
    holes, k = [], 0
    for i, v in enumerate(low):
        if v:
            k += 1
        elif k:
            if k >= 4 and (i - k) * 0.25 > 5 and i * 0.25 < len(low) * 0.25 - 5:
                holes.append([round((i - k) * 0.25, 2), round(k * 0.25, 2)])
            k = 0
    out['holes'] = holes
    if loop:
        steps = np.abs(np.diff(x, axis=1)).max(axis=0)
        p99 = float(np.percentile(steps, 99))
        seam = int(round(loop * RATE))
        out['seam'] = {'at_s': loop, 'turns': turns, 'step_over_p99': round(float(np.abs(x[:, seam] - x[:, seam - 1]).max()) / p99, 2),
                       'before_db': db(x[:, seam - w : seam]), 'after_db': db(x[:, seam : seam + w])}
    return out


# ---------------------------------------------------------------- the listener

_aes = None


def listener(x: np.ndarray) -> dict:
    global _aes
    import torch
    torch.manual_seed(0)
    torch.set_num_threads(max(1, os.cpu_count() // 2))
    from audiobox_aesthetics.infer import AesPredictor
    if _aes is None:
        import logging, warnings
        logging.disable(logging.WARNING)
        warnings.filterwarnings('ignore')
        _aes = AesPredictor(checkpoint_pth=None)
    # windows of 10 s (the model's own), laid evenly from the first sample
    # to the last, overlapping a little, so that no window is a scrap of
    # the last chord padded with silence (which the model scores 3 to 4)
    win = 10 * RATE
    n = max(1, int(np.ceil(x.shape[1] / win)))
    starts = np.linspace(0, max(0, x.shape[1] - win), n).round().astype(int)
    chunks = [x[:, a : a + win] for a in starts]
    rows = []
    for k in range(0, len(chunks), 8):
        batch = [{'path': torch.from_numpy(c.copy()), 'sample_rate': RATE} for c in chunks[k : k + 8]]
        rows += _aes.forward(batch)
    weights = np.array([c.shape[1] for c in chunks], float)
    out = {}
    for axis in ('CE', 'CU', 'PC', 'PQ'):
        v = np.array([r[axis] for r in rows])
        out[axis] = round(float((v * weights).sum() / weights.sum()), 2)
    out['CE_min'] = round(float(min(r['CE'] for r in rows)), 2)
    return out


# ---------------------------------------------------------------- the table

def judge(label: str, x: np.ndarray, loop: float | None, turns: int, aes: bool) -> dict:
    mono = x.mean(axis=0)
    z, times, length = beat_features(mono)
    row = {'tune': label, 'length_s': round(x.shape[1] / RATE, 1)}
    row['repetition'] = repetition(z, times, length)
    row['structure'] = structure(z, times, length)
    row['level'] = level(x, loop, turns)
    if aes:
        row['listener'] = listener(x)
    return row


def table(rows: list[dict]) -> str:
    head = f"{'tune':28} {'len':>6} {'loopy':>5} {'dup':>5} {'run':>5} {'rec':>3} {'form':12} {'LUFS':>6} {'LRA':>4} {'crest':>5} {'hum':>4} {'hole':>4} {'CE':>5} {'CEmin':>5} {'CU':>5} {'PC':>5} {'PQ':>5}"
    lines = [head, '-' * len(head)]
    for r in rows:
        rep, st, lv, li = r['repetition'], r['structure'], r['level'], r.get('listener', {})
        g = lambda k: f"{li[k]:5.2f}" if k in li else '    -'
        lines.append(f"{r['tune']:28} {r['length_s']:6.1f} {rep['loopy']:5.1f} {rep['dup']:5.2f} {rep['run_s']:5.1f} {rep['recur']:3d} {st['form'][:12]:12} "
                     f"{lv['lufs']:6.1f} {lv['lra']:4.1f} {lv['crest_db']:5.1f} {lv['hum_db']:4.1f} {len(lv['holes']):4d} {g('CE')} {g('CE_min')} {g('CU')} {g('PC')} {g('PQ')}")
    return '\n'.join(lines)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    aes = '--no-aes' not in sys.argv
    out_name = next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == '--out' and i + 1 < len(sys.argv)), None)
    if out_name in args:
        args.remove(out_name)
    eras = tunes_of_playlist()
    todo = []  # (label, path, loop, turns)
    files = [a for a in args if a not in eras]
    for era in [a for a in args if a in eras] or ([] if files else list(eras)):
        for name, loop, turns in eras[era]:
            path = os.path.join(SERVED, f'{name}.webm')
            todo.append((name, path, None, 1))
            if loop:
                todo.append((f'{name} (as heard, x{turns})', path, loop, turns))
    for f in files:
        path = f if os.path.isabs(f) else os.path.join(HERE, f) if os.path.exists(os.path.join(HERE, f)) else os.path.abspath(f)
        todo.append((os.path.basename(f), path, None, 1))
    rows = []
    for label, path, loop, turns in todo:
        x = decode(path)
        rows.append(judge(label, as_heard(x, loop, turns), loop, turns, aes))
        print(f'  judged {label}', file=sys.stderr, flush=True)
    print(table(rows))
    os.makedirs(OUT, exist_ok=True)
    name = out_name or ('-'.join(a for a in args if a in eras) or ('takes' if files else 'all'))
    params = {'phrase_s': PHRASE, 'dup': DUP, 'min_section_s': MIN_SECTION, 'same': SAME}
    with open(os.path.join(OUT, f'{name}.json'), 'w') as fh:
        json.dump({'params': params, 'tunes': rows}, fh, indent=1, sort_keys=True)
        fh.write('\n')
    print(f'written judge/{name}.json')


if __name__ == '__main__':
    main()
