#!/usr/bin/env python3
"""The chosen takes, trimmed, levelled and served.

    tools/assets/sfx/process.py          # every sound
    tools/assets/sfx/process.py turn     # only these
    tools/assets/sfx/process.py music-canal

Reads tools/assets/sfx/raw/ (see generate.py) and writes
app/public/sfx/<name>.webm (Opus) and <name>.mp3 (the fallback for Safari).
Spends nothing: ffmpeg only.

  gestures and moments   silence cut at both ends, a short fade at the tail,
                         mono, the peak set at -3 dBFS (PEAK)
  ambiences              one take folded onto itself: the last FOLD seconds
                         are faded over the first, so the loop has no seam;
                         stereo, rid of the model's hum (see dehum), the
                         rumble under it cut, a gentle compressor, run
                         seamlessly, holding the few loud moments; no limiter
  houses, industries     as the gestures, rid of the hum where the take is a
                         texture rather than a knock, levelled by loudness
  the canal's tune       a whole number of the tune's phrases cut out of the
                         take, its head folded over by the same place one
                         loop later (aligned to the sample), rid of the hum,
                         levelled by a plain gain; stereo

The choice of take, and why, is in CHOIX.md.
"""
import array, json, math, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
RAW = os.path.join(HERE, 'raw')
OUT = os.path.join(ROOT, 'app', 'public', 'sfx')
PEAK = -3.0
FOLD = 3.0
HOUSE_PEAK = -2.0
# the sound model writes its audio in frames of 5 ms: every take carries a
# faint buzz at exactly 200 Hz and each multiple of it (measured on
# amb-canal-3 at 200.005, 400.002, 599.993 Hz, up to 6 kHz). Over a quiet
# bed, lifted by 20 or 30 dB, it is the "bzzz" heard under the table.
HUM = 200.0

# name: (take, [start, end] or None, extra filters, peak in dBFS[, options])
#   options: fade  the tail's fade in seconds (default 40 ms)
#            dehum the take is a texture: its hum is taken out (see dehum)
#            lufs  level by loudness instead, the peak still held at `peak`
#            fadein the head's fade in seconds (none by default)
SHORT = {
    'turn': ('turn-1', None, '', PEAK),
    'stamp': ('stamp-1', None, '', PEAK),
    'link-canal': ('link-canal-1', None, '', PEAK),
    'link-rail': ('link-rail-1', None, '', PEAK),
    'sell': ('sell-1', None, '', PEAK),
    # the whistle is heard across the fields: its top dulled a little
    'era-end': ('era-end-1', None, 'lowpass=f=4200,', PEAK),
    'victory': ('victory-1', None, '', PEAK),
    # the same band behind a door: the brightness taken off, the room kept,
    # and six decibels under the win
    'defeat': ('victory-1', None, 'lowpass=f=900,highpass=f=90,aecho=0.8:0.6:60:0.25,', PEAK - 6),
    # the second take holds two clicks; the second, crisper one is kept
    'click': ('click-2', (0.27, 0.42), '', PEAK),
    'loan': ('loan-1', None, '', PEAK),
    'develop': ('develop-1', None, '', PEAK),
    # take 2, the card drawn and lifted: 110 ms of the slide, then the tick
    # of the pasteboard and its short decay; the second, smaller tick at
    # 0.33 s left out. The hiss of the slide softened over 7 kHz. It is heard
    # on every card taken up, at full level: kept well under the brass latch
    # (click, played at 0.45, comes to -34 LUFS). Asked -36 LUFS, the peak
    # held at -12 dBFS stops it at -40
    'card': ('card-2', (0.04, 0.22), 'lowpass=f=7000,', -12.0, {'fade': 0.03, 'fadein': 0.015, 'lufs': -36}),
    'scout': ('scout-1', None, '', PEAK),
    'panel-open': ('panel-open-1', None, '', PEAK),
    'panel-close': ('panel-close-1', None, '', PEAK),
    'refuse': ('refuse-1', None, 'highpass=f=50,', PEAK),
    # an industry laid: heard with the stamp, a little after it, and shorter
    # than a second; levelled by loudness so no trade is louder than another
    'ind-coal': ('ind-coal-1', (0.0, 0.8), 'highpass=f=60,', PEAK, {'fade': 0.2, 'lufs': -20}),
    'ind-iron': ('ind-iron-1', (0.0, 0.75), '', PEAK, {'fade': 0.3, 'lufs': -20}),
    'ind-cotton': ('ind-cotton-2', (0.0, 0.5), 'highpass=f=60,', PEAK, {'fade': 0.15, 'lufs': -20}),
    'ind-manufacturer': ('ind-manufacturer-2', (0.05, 0.55), '', PEAK, {'fade': 0.12, 'lufs': -20}),
    'ind-pottery': ('ind-pottery-1', (0.0, 0.8), 'highpass=f=60,', PEAK, {'fade': 0.25, 'lufs': -20}),
    'ind-brewery': ('ind-brewery-2', (0.0, 0.6), 'highpass=f=60,', PEAK, {'fade': 0.15, 'lufs': -20}),
    # a merchant's house under the pointer: two seconds of the town, soft.
    # Levelled at -25 LUFS with the peak at -2 dBFS: the knocks of hooves and
    # cobbles cannot come up further without a limiter, and -22 left the
    # continuous takes (bell, winch) 5 LU over them
    'house-warrington': ('house-warrington-1', None, 'highpass=f=70,', HOUSE_PEAK, {'fade': 0.3, 'dehum': True, 'lufs': -25}),
    'house-nottingham': ('house-nottingham-2', None, 'highpass=f=70,', HOUSE_PEAK, {'fade': 0.3, 'dehum': True, 'lufs': -25}),
    'house-shrewsbury': ('house-shrewsbury-1', None, 'highpass=f=70,', HOUSE_PEAK, {'fade': 0.3, 'dehum': True, 'lufs': -25}),
    'house-oxford': ('house-oxford-1', None, 'highpass=f=70,', HOUSE_PEAK, {'fade': 0.3, 'dehum': True, 'lufs': -25}),
    'house-gloucester': ('house-gloucester-1', None, 'highpass=f=70,', HOUSE_PEAK, {'fade': 0.3, 'dehum': True, 'lufs': -25}),
}
# name: (take, filters before the fold, integrated loudness in LUFS, compressor)
LOOPS = {
    # take 3: birds over a clean bed (take 1's bed was a broad rumble, lifted
    # 36 dB); under 90 Hz there is nothing of the scene, only the model's floor
    'amb-canal': ('amb-canal-3', 'highpass=f=90,highpass=f=90', -20.0, True),
    # the town's rumble is the scene: kept, but nothing under 45 Hz (which
    # only rattles a laptop's speakers) and a little less under 120 Hz
    'amb-rail': ('amb-rail-1', 'highpass=f=45,highpass=f=45,lowshelf=f=120:g=-4', -18.0, False),
}
# name: (take, loop start in s, loop length in s, fold in s, filters, LUFS)
MUSIC = {
    # take 2: a tune of eight bars (17.14 s) played round and round, a
    # phrase coming back at 17.14, 34.28, 51.42 and 68.56 s with its chroma
    # 0.92 to 0.95 alike; four phrases are kept from 21.92 s, where the same
    # place four phrases on (90.48 s) matches it best (0.976 over 6 s), and
    # well before the take's fade (95 s). Nothing of the tune under 40 Hz
    'music-canal': ('music-canal-2', 21.92, 68.56, 2.0, 'highpass=f=40,highpass=f=40', -20.0),
}

# a soft compressor for the few loud moments of a loop (a bird close by):
# slow enough not to pump, over the bed's level so the bed is left alone
COMP = 'acompressor=threshold=0.2:ratio=3:attack=10:release=250:knee=4'



def dehum(pcm: array.array, ch: int, rate: int = 48000, g: float = 0.97) -> array.array:
    """The model's hum taken out: a comb of notches at every multiple of HUM,
    y[n] = x[n] - x[n-D] + g·y[n-D] with D one period, scaled back to unity
    between the notches. Each notch is about 2 Hz wide at g = 0.97; what it
    leaves on a transient is a tail 30 dB down, so it is kept for textures
    (the loops, the houses) and not used on the knocks."""
    d = round(rate / HUM) * ch
    k = (1 + g) / 2
    y = [0.0] * len(pcm)
    out = array.array('h', bytes(2 * len(pcm)))
    for n in range(len(pcm)):
        v = pcm[n] - pcm[n - d] + g * y[n - d] if n >= d else float(pcm[n])
        y[n] = v
        out[n] = max(-32768, min(32767, int(round(v * k))))
    return out


def pcm_of(path: str, ch: int, rate: int = 48000, af: str = '') -> array.array:
    args = ['ffmpeg', '-v', 'error', '-i', path, '-ac', str(ch), '-ar', str(rate)]
    if af:
        args += ['-af', af]
    return array.array('h', subprocess.run([*args, '-f', 's16le', '-'], capture_output=True, check=True).stdout)


def wav_of(pcm: array.array, ch: int, path: str, rate: int = 48000) -> None:
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ac', str(ch), '-ar', str(rate), '-i', '-', path], input=pcm.tobytes(), check=True)


def lufs_of(wav: str) -> float:
    # a sound shorter than the meter's 400 ms window is given silence to be
    # measured in (the meter's gates leave the silence itself out)
    err = run(['-i', wav, '-af', 'apad=pad_dur=0.6,ebur128', '-f', 'null', '-'])
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', err)[-1])


def run(args: list[str]) -> str:
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostats', *args], capture_output=True, text=True, check=True).stderr


def serve(wav: str, name: str, stereo: bool) -> None:
    os.makedirs(OUT, exist_ok=True)
    ch = '2' if stereo else '1'
    run(['-y', '-i', wav, '-ac', ch, '-c:a', 'libopus', '-b:a', '96k' if stereo else '64k', os.path.join(OUT, f'{name}.webm')])
    run(['-y', '-i', wav, '-ac', ch, '-c:a', 'libmp3lame', '-q:a', '4', os.path.join(OUT, f'{name}.mp3')])


def peak_of(wav: str) -> float:
    err = run(['-i', wav, '-af', 'volumedetect', '-f', 'null', '-'])
    return float(re.search(r'max_volume: (-?[\d.]+) dB', err).group(1))


def short(name: str) -> None:
    take, cut, extra, peak, *rest = SHORT[name]
    opt = rest[0] if rest else {}
    src = os.path.join(RAW, f'{take}.mp3')
    tmp = os.path.join('/tmp' if not os.environ.get('TMPDIR') else os.environ['TMPDIR'], f'sfx-{name}.wav')
    trim = f'atrim={cut[0]}:{cut[1]},asetpts=PTS-STARTPTS,' if cut else ''
    # silence off the head and the tail (the tail by turning the sound round)
    edge = 'silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.004'
    chain = f'{trim}{extra}{edge},areverse,{edge},areverse'
    run(['-y', '-i', src, '-ac', '1', '-ar', '48000', '-af', chain, tmp])
    if opt.get('dehum'):
        wav_of(dehum(pcm_of(tmp, 1), 1), 1, tmp)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', tmp], capture_output=True, text=True).stdout)
    fade = min(opt.get('fade', 0.04), dur / 4)
    lev = os.path.join(os.path.dirname(tmp), f'sfx-{name}-lev.wav')
    gain = peak - peak_of(tmp)
    if 'lufs' in opt:
        # by loudness, the peak still held where it was asked
        gain = min(gain, opt['lufs'] - lufs_of(tmp))
    head = f'afade=t=in:d={opt["fadein"]:.4f},' if opt.get('fadein') else ''
    run(['-y', '-i', tmp, '-af', f'{head}afade=t=out:st={dur - fade:.4f}:d={fade:.4f},volume={gain:.2f}dB', lev])
    serve(lev, name, False)
    print(f'{name:18} {take:20} {dur:5.2f}s gain {gain:+.1f} dB, {lufs_of(lev):.1f} LUFS, peak {peak_of(lev):.1f} dBFS')


def loop(name: str) -> None:
    take, filters, target, squeeze = LOOPS[name]
    src = os.path.join(RAW, f'{take}.mp3')
    tmpdir = os.environ.get('TMPDIR') or '/tmp'
    rate, ch = 48000, 2
    pcm = dehum(pcm_of(src, ch, rate, filters), ch, rate)
    frames = len(pcm) // ch
    f = int(FOLD * rate)
    keep = frames - f
    # out[t] = in[t]·sin + in[keep+t]·cos over the first FOLD seconds (equal
    # power, the two stretches being unrelated), then in[t] up to keep: the
    # loop's last sample is in[keep-1] and its first is, in effect, in[keep]
    out = array.array('h', pcm[: keep * ch])
    for t in range(f):
        a = math.sin(0.5 * math.pi * t / f)
        b = math.cos(0.5 * math.pi * t / f)
        for c in range(ch):
            v = pcm[t * ch + c] * a + pcm[(keep + t) * ch + c] * b
            out[t * ch + c] = max(-32768, min(32767, int(round(v))))
    folded = os.path.join(tmpdir, f'sfx-{name}.wav')
    wav_of(out, ch, folded, rate)
    measured = lufs_of(folded)
    gain = target - measured
    lev = os.path.join(tmpdir, f'sfx-{name}-lev.wav')
    span = keep / rate
    # the compressor only rounds off the loud moments: the gain may be made
    # up by 3 dB at most for what it took, and should a peak still pass
    # -1 dBFS the whole is lowered (the loop then sits a little under its
    # loudness) rather than anything squeezed harder or clipped
    comp = f',{COMP}' if squeeze else ''
    most = gain + 3.0
    for _ in range(8):
        # a compressor remembers what it heard: the loop is run through it
        # three times over and the middle turn kept, so the state going out of
        # the last sample is the state coming into the first (the seam stays)
        used = gain
        subprocess.run(
            ['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ac', str(ch), '-ar', str(rate), '-i', '-', '-af', f'volume={used:.2f}dB{comp},atrim=start_sample={keep}:end_sample={2 * keep},asetpts=PTS-STARTPTS', '-c:a', 'pcm_f32le', lev],
            input=out.tobytes() * 3, check=True,
        )
        got, top = lufs_of(lev), peak_of(lev)
        if top > -1.0:
            # the compressor gives back part of any cut: cut twice as much
            gain -= 2 * (top + 1.05)
            most = gain
        elif got < target - 0.2 and gain < most - 0.05:
            gain = min(most, gain + target - got)
        else:
            break
    serve(lev, name, True)
    print(f'{name:12} {take:14} {span:5.2f}s loop, {measured:.1f} -> {got:.1f} LUFS, gain {used:+.1f} dB, peak {top:.1f} dBFS')


def aligned(pcm: array.array, ch: int, rate: int, a: int, b: int, reach: float = 0.03) -> tuple[int, float]:
    """The sample, near b, where the take best repeats what it plays at a:
    the two seconds from each are laid over one another (mono), first every
    fourth sample over +-reach, then sample by sample. Returns that sample
    and how alike the two stretches are there (normalised correlation)."""
    span = 2 * rate
    mono = [(sum(pcm[(i * ch) + c] for c in range(ch))) / ch for i in range(len(pcm) // ch)]
    head = mono[a : a + span]
    e_head = math.sqrt(sum(v * v for v in head[::4]))

    def alike(d: int, step: int) -> float:
        tail = mono[b + d : b + d + span : step]
        num = sum(x * y for x, y in zip(head[::step], tail))
        # the sample-by-sample search only ranks eight neighbours: the
        # correlation is left unnormalised there
        return num / (e_head * math.sqrt(sum(v * v for v in tail)) + 1e-9) if step == 4 else num

    far = int(reach * rate)
    coarse = max(range(-far, far + 1, 4), key=lambda d: alike(d, 4))
    fine = max(range(coarse - 4, coarse + 5), key=lambda d: alike(d, 1))
    return b + fine, alike(fine, 4)


def tune(name: str) -> None:
    take, start, length, fold, filters, target = MUSIC[name]
    src = os.path.join(RAW, f'{take}.mp3')
    tmpdir = os.environ.get('TMPDIR') or '/tmp'
    rate, ch = 48000, 2
    pcm = dehum(pcm_of(src, ch, rate, filters), ch, rate)
    a = int(start * rate)
    b, r = aligned(pcm, ch, rate, a, a + int(length * rate))
    keep = b - a
    f = int(fold * rate)
    # the loop is in[a:b]; over its first `fold` seconds the head rises under
    # in[b:b+fold], the same bars one loop later, so the last sample in[b-1]
    # runs straight into in[b]. Two playings of one phrase are partly alike
    # (correlation r): the sine and cosine curves are scaled so that their
    # sum keeps its power for that r (up² + down² + 2r·up·down = 1), neither
    # swelling nor sagging in the middle of the fold
    out = array.array('h', pcm[a * ch : b * ch])
    for t in range(f):
        x = t / f
        up, down = math.sin(0.5 * math.pi * x), math.cos(0.5 * math.pi * x)
        k = 1 / math.sqrt(up * up + down * down + 2 * max(r, 0.0) * up * down)
        up, down = up * k, down * k
        for c in range(ch):
            v = pcm[(a + t) * ch + c] * up + pcm[(b + t) * ch + c] * down
            out[t * ch + c] = max(-32768, min(32767, int(round(v))))
    folded = os.path.join(tmpdir, f'sfx-{name}.wav')
    wav_of(out, ch, folded, rate)
    measured = lufs_of(folded)
    # a plain gain (a dynamic normaliser would break the seam); should a peak
    # pass -1 dBFS the whole is lowered instead
    gain = min(target - measured, -1.0 - peak_of(folded))
    lev = os.path.join(tmpdir, f'sfx-{name}-lev.wav')
    run(['-y', '-i', folded, '-af', f'volume={gain:.2f}dB', '-c:a', 'pcm_f32le', lev])
    serve(lev, name, True)
    print(f'{name:12} {take:14} {keep / rate:.4f}s loop from {start}s, alike {r:.3f}, {measured:.1f} -> {lufs_of(lev):.1f} LUFS, gain {gain:+.1f} dB, peak {peak_of(lev):.1f} dBFS')


def main() -> None:
    names = sys.argv[1:] or [*SHORT, *LOOPS, *MUSIC]
    for n in names:
        (tune if n in MUSIC else loop if n in LOOPS else short)(n)


if __name__ == '__main__':
    main()
