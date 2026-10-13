#!/usr/bin/env python3
"""The chosen takes, trimmed, levelled and served.

    tools/assets/sfx/process.py          # every sound
    tools/assets/sfx/process.py turn     # only these

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
    'card': ('card-1', None, '', PEAK),
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
    run(['-y', '-i', tmp, '-af', f'afade=t=out:st={dur - fade:.4f}:d={fade:.4f},volume={gain:.2f}dB', lev])
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


def main() -> None:
    names = sys.argv[1:] or [*SHORT, *LOOPS]
    for n in names:
        (loop if n in LOOPS else short)(n)


if __name__ == '__main__':
    main()
