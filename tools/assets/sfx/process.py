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
                         stereo, integrated loudness at -16 LUFS (a limiter, run
                         seamlessly, holds the few peaks that would clip)

The choice of take, and why, is in CHOIX.md.
"""
import array, json, math, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
RAW = os.path.join(HERE, 'raw')
OUT = os.path.join(ROOT, 'app', 'public', 'sfx')
PEAK = -3.0
LUFS = -16.0
FOLD = 3.0

# name: (take, [start, end] or None, extra filters, peak in dBFS)
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
}
LOOPS = {'amb-canal': 'amb-canal-1', 'amb-rail': 'amb-rail-1'}


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
    take, cut, extra, peak = SHORT[name]
    src = os.path.join(RAW, f'{take}.mp3')
    tmp = os.path.join('/tmp' if not os.environ.get('TMPDIR') else os.environ['TMPDIR'], f'sfx-{name}.wav')
    trim = f'atrim={cut[0]}:{cut[1]},asetpts=PTS-STARTPTS,' if cut else ''
    # silence off the head and the tail (the tail by turning the sound round)
    edge = 'silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.004'
    chain = f'{trim}{extra}{edge},areverse,{edge},areverse'
    run(['-y', '-i', src, '-ac', '1', '-ar', '48000', '-af', chain, tmp])
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', tmp], capture_output=True, text=True).stdout)
    fade = min(0.04, dur / 4)
    lev = os.path.join(os.path.dirname(tmp), f'sfx-{name}-lev.wav')
    gain = peak - peak_of(tmp)
    run(['-y', '-i', tmp, '-af', f'afade=t=out:st={dur - fade:.4f}:d={fade:.4f},volume={gain:.2f}dB', lev])
    serve(lev, name, False)
    print(f'{name:12} {take:14} {dur:5.2f}s gain {gain:+.1f} dB')


def loop(name: str) -> None:
    src = os.path.join(RAW, f'{LOOPS[name]}.mp3')
    tmpdir = os.environ.get('TMPDIR') or '/tmp'
    rate, ch = 48000, 2
    pcm = array.array('h', subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ac', str(ch), '-ar', str(rate), '-f', 's16le', '-'], capture_output=True, check=True).stdout)
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
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ac', str(ch), '-ar', str(rate), '-i', '-', folded], input=out.tobytes(), check=True)
    err = run(['-i', folded, '-af', f'loudnorm=I={LUFS}:TP=-3:print_format=json', '-f', 'null', '-'])
    measured = json.loads(err[err.rindex('{'):err.rindex('}') + 1])
    # the gain that brings the loop to LUFS; a take whose few loud moments
    # (a bird close by) would pass -1 dBFS has them held by a limiter
    gain = LUFS - float(measured['input_i'])
    limit = gain > -1.0 - float(measured['input_tp'])
    # the limiter takes a little off the whole: a second pass makes it up
    for _ in range(2):
        chain = f'volume={gain:.2f}dB' + (',alimiter=limit=0.84:attack=5:release=80:level=false' if limit else '')
        # a limiter remembers what it heard: the loop is run through it three
        # times over and the middle turn kept, so the state going out of the
        # last sample is the state coming into the first (the seam stays a seam)
        lev = os.path.join(tmpdir, f'sfx-{name}-lev.wav')
        span = keep / rate
        subprocess.run(
            ['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ac', str(ch), '-ar', str(rate), '-i', '-', '-af', f'{chain},atrim=start_sample={keep}:end_sample={2 * keep},asetpts=PTS-STARTPTS', lev],
            input=out.tobytes() * 3, check=True,
        )
        after = run(['-i', lev, '-af', 'ebur128=peak=true', '-f', 'null', '-'])
        got = re.findall(r'I:\s+(-?[\d.]+) LUFS', after)[-1]
        if not limit or abs(float(got) - LUFS) < 0.3:
            break
        gain += LUFS - float(got)
    serve(lev, name, True)
    print(f'{name:12} {LOOPS[name]:14} {span:5.2f}s loop, {measured["input_i"]} -> {got} LUFS, gain {gain:+.1f} dB{" limited" if limit else ""}')


def main() -> None:
    names = sys.argv[1:] or [*SHORT, *LOOPS]
    for n in names:
        (loop if n in LOOPS else short)(n)


if __name__ == '__main__':
    main()
