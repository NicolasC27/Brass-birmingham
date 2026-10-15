#!/usr/bin/env python3
"""The table's short sounds, measured: is each clean, sitting where it
should in the mix, and how would a listener rate it.

    tools/assets/sfx/.venv/bin/python tools/assets/sfx/judge_sfx.py                    # every sound served
    ... judge_sfx.py --synth DIR       # and the synthesised ones, rendered to DIR/synth-*.f32 or .wav
    ... judge_sfx.py era-end life-whistle raw/life-whistle-2.mp3 --out whistles
    ... judge_sfx.py --no-aes          # without the listener model

Runs in judge.py's environment (tools/assets/sfx/.venv). Reads the served
files (app/public/sfx/<name>.webm), every one but the tunes, grouped as the
sound board of /admin groups them: the gestures and the moments (a cue's
bus in sfx.ts), the houses, each era's life, the ambiences, the voices,
and the sounds synthesised in sfx.ts, rendered offline beforehand (48 kHz
stereo float, as the page hears them). Writes judge/<out>.json (default
`sfx`), sorted worst first, and prints the table.

What is measured, on the part of each file that sounds (from the first
sample over -60 dB under its peak to the last):

  level     the peak (dBFS) and the samples at full scale; integrated
            loudness (ffmpeg's EBU R128 meter, the short ones padded with
            silence as process.py measures them); as heard: that loudness
            with the gains the game plays it through at the levels the
            settings open on (bus, bus scale, the cue's own level, read
            from sfx.ts); against the loudness process.py asks of it
  envelope  the attack (10 to 90 % of the peak of a 1 ms envelope), the
            decay (from the peak to 30 dB under it), the first sample and
            the last 5 ms against the peak (a sound that starts on a step
            or is cut off clicks), the DC offset
  noise     the floor (the 10th percentile of 20 ms windows, dB under the
            peak) and how much of that floor lies over 6 kHz (hiss)
  spectrum  the share of five bands, the centroid; the model's 200 Hz
            comb (as judge.py: each multiple of 200 Hz over its
            neighbours, the median from 400 Hz to 5 kHz, less the same on
            two combs that are not the model's; a second or more of sound;
            over 5 dB is heard, the noise's own spread)
  loops     the step across the seam against the 99th percentile of the
            steps inside, and the loudest 400 ms against the whole (LU)
  whistles  the blasts: spans of 0.2 s or more within 12 dB of the peak
            (the owner found the whistles poor; an early engine blew two)
  listener  Audiobox Aesthetics over the sound (CE, CU, PC, PQ). The model
            was trained on clips of seconds to minutes: under a second or
            two its scores are a hint, not a measure

Each finding that would be heard is written as a defect; the sounds are
sorted by the number of their defects, then by the mean of CE and PQ.
"""
import json, os, re, subprocess, sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import judge  # noqa: E402  (its decoder, its loudness meter, its listener)
import process  # noqa: E402  (what each sound was levelled to)

ROOT = judge.ROOT
SERVED = judge.SERVED
SFX_TS = os.path.join(ROOT, 'app', 'src', 'gl', 'sfx.ts')
PLAYLIST = judge.PLAYLIST
RATE = judge.RATE
# the settings' opening levels (BoardOptions): each bus at these
OPEN_LEVELS = {'ambience': 0.5, 'gestures': 0.8, 'moments': 0.8, 'music': 0.5}


def consts() -> dict:
    """The gains the game plays each sound through, read from sfx.ts."""
    src = open(SFX_TS).read()

    def table(name: str) -> dict:
        body = re.search(name + r'[^=]*=\s*\{(.*?)\};', src, re.S).group(1)
        return dict(re.findall(r"'?([\w-]+)'?:\s*'?([\w.-]+)'?", body))

    def num(name: str) -> float:
        return float(re.search(r'const ' + name + r'\s*=\s*([\d.]+)', src).group(1))

    trade = num('TRADE_LEVEL')
    body = re.search(r'const CUE_LEVEL[^=]*=\s*\{(.*?)\};', src, re.S).group(1)
    # a level, TRADE_LEVEL, or either times a number
    cue_level = {k: float(eval(v.replace('TRADE_LEVEL', str(trade)), {})) for k, v in re.findall(r"'?([\w-]+)'?:\s*([\w.]+(?:\s*\*\s*[\d.]+)?)", body)}
    return {'bus_scale': {k: float(v) for k, v in table('const BUS_SCALE').items()},
            'bus_of': table('const BUS_OF'), 'cue_level': cue_level,
            'amb_trim': {k: float(v) for k, v in table('const AMB_TRIM').items()},
            'life_level': {k: float(v) for k, v in table('const LIFE_LEVEL').items()},
            'voice': num('VOICE_LEVEL'), 'house': num('HOUSE_LEVEL')}


def life_of() -> dict:
    src = open(PLAYLIST).read()
    body = re.search(r'export const LIFE = \{(.*?)\}', src, re.S).group(1)
    return {n: era for era, items in re.findall(r'(\w+):\s*\[(.*?)\]', body, re.S) for n in re.findall(r"'([\w-]+)'", items)}


def group_and_gain(name: str, c: dict, life: dict) -> tuple[str, float]:
    """The sound board's group, and the gain (linear) the game plays it at
    (a version of a sound, `era-end.before`, as the sound itself)."""
    name = name.split('.')[0]
    bus = lambda b: OPEN_LEVELS[b] * c['bus_scale'][b]
    if name.startswith('synth-'):
        return 'synthesised', 1.0  # rendered as heard
    if name in c['bus_of']:
        b = c['bus_of'][name]
        return ('moments' if b == 'moments' else 'gestures'), bus(b) * c['cue_level'].get(name, 1.0)
    if name.startswith('house-'):
        return 'houses', bus('gestures') * c['house']
    if name in life:
        return f'{life[name]} life', bus('ambience') * c['life_level'][life[name]]
    if name.startswith('amb-'):
        return 'ambiences', bus('ambience') * c['amb_trim'][name[4:]]
    if name.startswith('bark-'):
        return 'voices', bus('ambience') * c['voice']
    return 'other', 1.0


def target_of(name: str) -> dict:
    """What process.py asked of the file: a loudness, or a peak."""
    name = name.split('.')[0]
    if name in process.SHORT:
        peak = process.SHORT[name][3]
        opt = process.SHORT[name][4] if len(process.SHORT[name]) > 4 else {}
        return {'lufs': opt['lufs'], 'peak': peak} if 'lufs' in opt else {'peak': peak}
    if name in process.LOOPS:
        return {'lufs': process.LOOPS[name][2]}
    return {}


def read(path: str) -> np.ndarray:
    """(channels, samples) at RATE, in the file's own channels: a mono file
    is not spread over two at -3 dB, as ffmpeg's upmix would."""
    if path.endswith('.f32'):
        return np.fromfile(path, dtype='<f4').reshape(-1, 2).T.copy()
    ch = int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels', '-of', 'csv=p=0', path],
                            capture_output=True, text=True).stdout.strip() or 2)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', str(ch), '-ar', str(RATE), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype='<f4').reshape(-1, ch).T.copy()


def sounding(x: np.ndarray) -> np.ndarray:
    """From the first sample over -60 dB under the peak to the last."""
    a = np.abs(x).max(axis=0)
    on = np.flatnonzero(a > a.max() * 10 ** (-60 / 20))
    return x[:, on[0] : on[-1] + 1] if len(on) else x


def lufs(x: np.ndarray) -> float:
    pad = np.zeros((x.shape[0], int(0.6 * RATE)), np.float32)
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-f', 'f32le', '-ac', str(x.shape[0]), '-ar', str(RATE), '-i', '-', '-af', 'ebur128', '-f', 'null', '-'],
                       input=np.concatenate([x, pad], axis=1).T.astype('<f4').tobytes(), capture_output=True, check=True)
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', p.stderr.decode())[-1])


def db(v: float) -> float:
    return float(20 * np.log10(v + 1e-12))


def envelope(mono: np.ndarray, ms: float = 1.0) -> np.ndarray:
    w = max(1, int(RATE * ms / 1000))
    n = len(mono) // w
    return np.sqrt((mono[: n * w].reshape(n, w) ** 2).mean(axis=1)) if n else np.array([np.sqrt((mono ** 2).mean())])


def comb(mono: np.ndarray) -> float | None:
    """The model's 200 Hz comb: the median excess of the multiples of 200 Hz
    over their neighbours, less the same measured on two combs that are not
    the model's (193 and 207 Hz): a voice's or a bell's own partials stand
    over their neighbours on any comb, the model's lines only on its own."""
    from scipy.signal import welch
    if len(mono) < RATE:
        return None
    f, p = welch(mono, fs=RATE, nperseg=min(len(mono), RATE * 5))
    df = f[1] - f[0]

    def excess(step: float) -> float:
        ex = []
        for k in range(2, 26):
            c = step * k
            if c > 5000:
                break
            at = p[(f >= c - max(0.4, df)) & (f <= c + max(0.4, df))].max()
            near = p[((f >= c - 20) & (f <= c - 3 * max(1, df))) | ((f >= c + 3 * max(1, df)) & (f <= c + 20))]
            if len(near):
                ex.append(10 * np.log10(at / (np.median(near) + 1e-20) + 1e-20))
        return float(np.median(ex))

    return round(excess(200.0) - (excess(193.0) + excess(207.0)) / 2, 1)


def bands(mono: np.ndarray) -> tuple[dict, float]:
    from scipy.signal import welch
    f, p = welch(mono, fs=RATE, nperseg=min(len(mono), 4096))
    total = p.sum() + 1e-20
    out = {}
    for name, lo, hi in (('sub<90', 0, 90), ('low90-250', 90, 250), ('mid250-2k', 250, 2000), ('pres2k-5k', 2000, 5000), ('air>5k', 5000, RATE / 2)):
        out[name] = round(float(p[(f >= lo) & (f < hi)].sum() / total), 3)
    return out, round(float((f * p).sum() / total))


def blasts(mono: np.ndarray) -> list:
    e = envelope(mono, 10)
    loud = 20 * np.log10(e + 1e-12) > 20 * np.log10(e.max() + 1e-12) - 12
    out, k = [], 0
    for i, v in enumerate(list(loud) + [False]):
        if v:
            k += 1
        elif k:
            if k >= 20:
                out.append([round((i - k) * 0.01, 2), round(k * 0.01, 2)])
            k = 0
    return out


def whistle(name: str) -> bool:
    """The era's whistle, the rail's far one, the synthesised one."""
    return 'whistle' in name or name.startswith('era-end')


def measure(name: str, path: str, c: dict, life: dict, aes: bool) -> dict:
    whole = read(path)
    loop = name.startswith('amb-')
    x = whole if loop else sounding(whole)
    mono = x.mean(axis=0)
    group, gain = group_and_gain(name, c, life)
    peak = float(np.abs(x).max())
    row = {'sound': name, 'group': group, 'length_s': round(x.shape[1] / RATE, 3)}
    i = lufs(x)
    lev = {'peak_db': round(db(peak), 1), 'full_scale': int((np.abs(x) >= 0.999).sum()), 'lufs': round(i, 1),
           'heard_lufs': round(i + db(gain), 1), 'gain_db': round(db(gain), 1)}
    t = target_of(name)
    if t:
        lev['asked'] = t
    row['level'] = lev
    e = envelope(mono)
    top = int(e.argmax())
    a10 = np.flatnonzero(e[: top + 1] >= 0.1 * e[top])
    a90 = np.flatnonzero(e[: top + 1] >= 0.9 * e[top])
    after = np.flatnonzero(e[top:] < e[top] * 10 ** (-30 / 20))
    w5 = int(0.005 * RATE)
    row['envelope'] = {'attack_ms': float(a90[0] - a10[0]) if len(a10) and len(a90) else None,
                       'decay_ms': float(after[0]) if len(after) else None,
                       'first_sample_db': round(db(np.abs(whole[:, 0]).max()) - db(peak), 1),
                       'tail_5ms_db': round(db(np.sqrt((whole[:, -w5:] ** 2).mean())) - db(peak), 1),
                       'dc': round(float(np.abs(x.mean(axis=1)).max()), 5)}
    w = int(0.02 * RATE)
    n = x.shape[1] // w
    noise = {}
    if n >= 10:
        win = x[:, : n * w].reshape(x.shape[0], n, w)
        rms = np.sqrt((win ** 2).mean(axis=(0, 2)))
        q = int(np.argsort(rms)[n // 10])
        floor = db(rms[q]) - db(peak)
        from scipy.signal import welch
        quiet = np.sort(np.argsort(rms)[: max(1, n // 5)])
        seg = np.concatenate([mono[k * w : (k + 1) * w] for k in quiet])
        f, p = welch(seg, fs=RATE, nperseg=min(len(seg), 1024))
        noise = {'floor_db': round(floor, 1), 'floor_over_6k': round(float(p[f >= 6000].sum() / (p.sum() + 1e-20)), 3)}
    row['noise'] = noise
    b, centroid = bands(mono)
    row['spectrum'] = {'bands': b, 'centroid_hz': centroid, 'comb_db': comb(mono)}
    if loop:
        steps = np.abs(np.diff(whole, axis=1)).max(axis=0)
        wrap = float(np.abs(whole[:, 0] - whole[:, -1]).max())
        m4 = int(0.4 * RATE)
        mom = [lufs_block(whole[:, k : k + m4]) for k in range(0, whole.shape[1] - m4, m4 // 4)]
        row['loop'] = {'seam_over_p99': round(wrap / float(np.percentile(steps, 99)), 2), 'loudest_400ms_over_whole_lu': round(max(mom) - i, 1)}
    if whistle(name):
        row['blasts'] = blasts(mono)
    if aes:
        row['listener'] = listener(x if x.shape[0] == 2 else np.repeat(x, 2, axis=0))
    row['defects'] = defects(row)
    return row


def lufs_block(x: np.ndarray) -> float:
    """The loudness of one 400 ms block (K-weighted, BS.1770), no gate."""
    import pyloudnorm
    m = pyloudnorm.Meter(RATE, block_size=0.4)
    return float(m.integrated_loudness(x.T.astype(np.float64))) if x.shape[1] >= int(0.4 * RATE) else -70.0


_aes = None


def listener(x: np.ndarray) -> dict:
    global _aes
    import torch
    torch.manual_seed(0)
    from audiobox_aesthetics.infer import AesPredictor
    if _aes is None:
        import logging, warnings
        logging.disable(logging.WARNING)
        warnings.filterwarnings('ignore')
        _aes = AesPredictor(checkpoint_pth=None)
    # at most the model's 10 s windows, laid evenly, as judge.py
    win = 10 * RATE
    k = max(1, int(np.ceil(x.shape[1] / win)))
    starts = np.linspace(0, max(0, x.shape[1] - win), k).round().astype(int)
    rows = _aes.forward([{'path': torch.from_numpy(x[:, a : a + win].copy()), 'sample_rate': RATE} for a in starts])
    return {axis: round(float(np.mean([r[axis] for r in rows])), 2) for axis in ('CE', 'CU', 'PC', 'PQ')}


def defects(row: dict) -> list:
    out = []
    lev, env, noise, spec = row['level'], row['envelope'], row['noise'], row['spectrum']
    if lev['full_scale'] or lev['peak_db'] > -0.3:
        out.append(f"clips: peak {lev['peak_db']} dBFS, {lev['full_scale']} samples at full scale")
    asked = lev.get('asked', {})
    if 'lufs' in asked and abs(lev['lufs'] - asked['lufs']) > 3 and lev['peak_db'] < asked.get('peak', 0) - 0.5:
        out.append(f"levelled at {lev['lufs']} LUFS, {asked['lufs']} asked")
    if env['first_sample_db'] > -20 and 'loop' not in row:
        out.append(f"starts on a step (first sample {env['first_sample_db']} dB under the peak)")
    if env['tail_5ms_db'] > -30 and 'loop' not in row:
        out.append(f"cut off (last 5 ms {env['tail_5ms_db']} dB under the peak)")
    if env['dc'] > 0.005:
        out.append(f"DC offset {env['dc']}")
    if noise and noise['floor_db'] > -45 and noise['floor_over_6k'] > 0.3 and row['group'] not in ('ambiences',):
        out.append(f"hiss: floor {noise['floor_db']} dB under the peak, {round(100 * noise['floor_over_6k'])} % of it over 6 kHz")
    if spec['comb_db'] is not None and spec['comb_db'] > 5:
        out.append(f"the 200 Hz comb, {spec['comb_db']} dB over its neighbours")
    if spec['bands']['pres2k-5k'] > 0.5:
        out.append(f"harsh: {round(100 * spec['bands']['pres2k-5k'])} % of it at 2-5 kHz")
    if spec['bands']['sub<90'] + spec['bands']['low90-250'] > 0.75 and row['group'] not in ('ambiences',):
        out.append(f"dull: {round(100 * (spec['bands']['sub<90'] + spec['bands']['low90-250']))} % of it under 250 Hz (lost on small speakers)")
    if 'loop' in row:
        if row['loop']['seam_over_p99'] > 1:
            out.append(f"the seam steps ({row['loop']['seam_over_p99']} x the 99th percentile)")
        if row['loop']['loudest_400ms_over_whole_lu'] > 10:
            out.append(f"an event {row['loop']['loudest_400ms_over_whole_lu']} LU over the loop")
    if 'blasts' in row and len(row['blasts']) < 2:
        out.append(f"one blast: {len(row['blasts'])} over 0.2 s within 12 dB of the peak (an early engine blew two)")
    return out


def family(r: dict) -> str:
    """Sounds heard side by side: the trades among the trades, the
    interface's own noises among themselves, a voice among the voices."""
    if r['sound'].startswith('ind-'):
        return 'trades'
    if r['sound'] in ('click', 'panel-open', 'panel-close', 'card', 'refuse'):
        return 'interface'
    return r['group']


def level_spread(rows: list) -> None:
    """Within a family, a sound heard 4 LU or more off the family's median."""
    # the synthesised sounds are heard on pages of their own (the lobby,
    # the telegrams, the results), never side by side
    for g in {family(r) for r in rows} - {'synthesised'}:
        heard = [r['level']['heard_lufs'] for r in rows if family(r) == g]
        if len(heard) < 3:
            continue
        med = float(np.median(heard))
        for r in rows:
            if family(r) == g:
                d = r['level']['heard_lufs'] - med
                r['level']['off_group_lu'] = round(d, 1)
                if abs(d) >= 4:
                    r['defects'].append(f"heard {'over' if d > 0 else 'under'} its {g} by {abs(round(d, 1))} LU")


def rank_key(r: dict):
    q = r.get('listener')
    return (-len(r['defects']), (q['CE'] + q['PQ']) / 2 if q else 10)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    aes = '--no-aes' not in sys.argv
    opt = lambda k: next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == k and i + 1 < len(sys.argv)), None)
    out_name, synth = opt('--out'), opt('--synth')
    args = [a for a in args if a not in (out_name, synth)]
    c, life = consts(), life_of()
    todo = []
    if args:
        for a in args:
            path = a if os.path.exists(a) else os.path.join(HERE, a) if os.path.exists(os.path.join(HERE, a)) else os.path.join(SERVED, f'{a}.webm')
            base = os.path.basename(a)
            todo.append((re.sub(r'\.(webm|mp3|wav|f32)$', '', base), path))
    else:
        for f in sorted(os.listdir(SERVED)):
            if f.endswith('.webm') and not f.startswith('music-'):
                todo.append((f[:-5], os.path.join(SERVED, f)))
    if synth:
        for f in sorted(os.listdir(synth)):
            if f.startswith('synth-') and f.endswith(('.f32', '.wav')):
                todo.append((f.rsplit('.', 1)[0], os.path.join(synth, f)))
    rows = []
    for name, path in todo:
        rows.append(measure(name, path, c, life, aes))
        print(f'  judged {name}', file=sys.stderr, flush=True)
    level_spread(rows)
    rows.sort(key=rank_key)
    print(f"{'sound':24} {'group':12} {'len':>6} {'peak':>6} {'LUFS':>6} {'heard':>6} {'atk':>5} {'floor':>6} {'comb':>5} {'CE':>5} {'PQ':>5}  defects")
    for r in rows:
        q = r.get('listener', {})
        print(f"{r['sound']:24} {r['group']:12} {r['length_s']:6.2f} {r['level']['peak_db']:6.1f} {r['level']['lufs']:6.1f} {r['level']['heard_lufs']:6.1f} "
              f"{(r['envelope']['attack_ms'] or 0):5.0f} {r['noise'].get('floor_db', float('nan')):6.1f} {(r['spectrum']['comb_db'] if r['spectrum']['comb_db'] is not None else float('nan')):5.1f} "
              f"{q.get('CE', float('nan')):5.2f} {q.get('PQ', float('nan')):5.2f}  {'; '.join(r['defects'])}")
    os.makedirs(judge.OUT, exist_ok=True)
    name = out_name or 'sfx'
    with open(os.path.join(judge.OUT, f'{name}.json'), 'w') as fh:
        json.dump({'open_levels': OPEN_LEVELS, 'sounds': rows}, fh, indent=1, sort_keys=True)
        fh.write('\n')
    print(f'written judge/{name}.json')


if __name__ == '__main__':
    main()
