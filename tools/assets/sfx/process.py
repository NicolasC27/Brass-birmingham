#!/usr/bin/env python3
"""The chosen takes, trimmed, levelled and served.

    tools/assets/sfx/process.py          # every sound
    tools/assets/sfx/process.py turn     # only these
    tools/assets/sfx/process.py music-canal-iv
    tools/assets/sfx/process.py music-rail-i

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
  the canal's first tune a whole number of the tune's phrases cut out of the
                         take, its head folded over by the same place one
                         loop later (aligned to the sample), rid of the hum,
                         levelled by a plain gain; stereo (retired)
  the other tunes        played through once, not looped: the take whole,
                         from its first note to its own last chord, rid of
                         the hum, a short fade at each end, levelled by a
                         plain gain like the first; stereo
  the rail's life        as the houses: a train somewhere off, now and then
  the canal's life       likewise: the working waterway, now and then
  the townsfolk          their lines (barks): the breath before and after
                         cut, the chest and the lips off, a wall across the
                         street, mono, levelled by loudness; no dehum (the
                         speech model has no comb)

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
    # the rail's life, heard over its ambience every minute or so: far off,
    # so nothing under 90 Hz (the model's floor, and the rumble the rail's
    # bed was too full of) and the top dulled. Levelled by loudness a little
    # over the bed (-25 LUFS), each on its own
    # the whistle: one blast of 1.7 s and its ring; farther off than the
    # era's own whistle, a slow echo off the hills
    'life-whistle': ('life-whistle-1', (0.0, 3.3), 'highpass=f=90,lowpass=f=3000,aecho=0.8:0.5:230|470:0.22|0.12,', PEAK, {'fade': 0.8, 'dehum': True, 'lufs': -27}),
    # a train across the field: the clatter of the rail joints swells for 3 s
    # and holds; the take stops short at 7.2 s, so it is faded from 6.1 s
    'life-passing': ('life-passing-1', (0.3, 7.4), 'highpass=f=90,lowpass=f=6000,', PEAK, {'fade': 1.3, 'fadein': 0.8, 'dehum': True, 'lufs': -25}),
    # wagons shunted: a run of clanks 0.2-1.6 s, then only the model's floor
    'life-couple': ('life-couple-1', (0.1, 2.1), 'highpass=f=90,lowpass=f=6000,', PEAK, {'fade': 0.4, 'lufs': -27}),
    # an engine leaving: heavy chuffs with steam for 3 s, falling away; the
    # low hum after 4.5 s (under 80 Hz) left out
    'life-depart': ('life-depart-1', (0.0, 5.2), 'highpass=f=90,lowpass=f=6000,', PEAK, {'fade': 1.6, 'dehum': True, 'lufs': -26}),
    # two more for the rail: an iron works across the town, an engine standing
    # the steam hammer: five heavy blows over 3 s, then only its ring
    'life-hammer': ('life-hammer-1', (0.2, 3.6), 'highpass=f=90,lowpass=f=6000,', PEAK, {'fade': 0.5, 'lufs': -27}),
    # the safety valve: a roar held from 0.2 to 3 s, dying away by 4.2 s
    'life-steam': ('life-steam-1', (0.2, 4.4), 'highpass=f=90,lowpass=f=6000,', PEAK, {'fade': 1.2, 'fadein': 0.4, 'dehum': True, 'lufs': -28}),
    # the canal's life, heard over its birds: the same distance as the rail's
    # a horse on the towpath: hooves and harness for 4.5 s, then going
    'life-horse': ('life-horse-1', (0.0, 5.5), 'highpass=f=90,lowpass=f=6000,', PEAK, {'fade': 1.2, 'fadein': 0.3, 'dehum': True, 'lufs': -27}),
    # a lock: the gates' creak, then the sluice for 4 s; the take stops the
    # water short at 4.25 s, so it is faded over its last second
    'life-lock': ('life-lock-1', (0.0, 4.3), 'highpass=f=90,lowpass=f=6000,', PEAK, {'fade': 1.0, 'dehum': True, 'lufs': -27}),
    # the village smith: blows over 2.5 s and their ring
    'life-forge': ('life-forge-1', (0.0, 3.6), 'highpass=f=90,lowpass=f=6000,', PEAK, {'fade': 0.8, 'lufs': -28}),
    # the church bell: one stroke (three were asked) and its 6 s decay
    'life-bell': ('life-bell-1', (0.0, 6.0), 'highpass=f=90,lowpass=f=5000,', PEAK, {'fade': 1.5, 'dehum': True, 'lufs': -29}),
    # geese going over: honking from 0.5 to 3.3 s
    'life-geese': ('life-geese-1', (0.4, 3.6), 'highpass=f=90,lowpass=f=6000,', PEAK, {'fade': 0.5, 'fadein': 0.1, 'dehum': True, 'lufs': -28}),
}
# the townsfolk's lines: name -> the take kept (the first unless a later
# one said the words better; see CHOIX.md)
BARKS = {n: f'{n}-1' for n in (
    'bark-ezra-dear', 'bark-ezra-knees', 'bark-ezra-blowup', 'bark-ezra-worse', 'bark-ezra-mud', 'bark-ezra-almost',
    'bark-barnaby-wages', 'bark-barnaby-bess', 'bark-barnaby-lock', 'bark-barnaby-load', 'bark-barnaby-engines',
    'bark-nellie-overseer', 'bark-nellie-vicar', 'bark-nellie-hands', 'bark-nellie-twelve', 'bark-nellie-ribbon', 'bark-nellie-fluff',
    'bark-hepzibah-pints', 'bark-hepzibah-watered', 'bark-hepzibah-testing', 'bark-hepzibah-soot',
    'bark-pomfrey-time', 'bark-pomfrey-london', 'bark-pomfrey-idle', 'bark-pomfrey-iron', 'bark-pomfrey-triumph',
    'bark-kezia-kiln', 'bark-kezia-bread', 'bark-kezia-price', 'bark-kezia-coal', 'bark-kezia-kettle',
    'bark-tom-furnace', 'bark-tom-what', 'bark-tom-dear', 'bark-tom-sweet', 'bark-tom-late',
)}
BARKS['bark-barnaby-rope'] = 'bark-barnaby-rope-2'
BARKS['bark-hepzibah-finest'] = 'bark-hepzibah-finest-3'
# a line is heard in a town on the board, not in the ear: nothing under
# 110 Hz (the chest of a close microphone), nothing over 7 kHz (the lips),
# and one early reflection, a wall across the street. Levelled at -22 LUFS
# (sfx.ts sets them under the gestures), the peak held at -3 dBFS
BARK_FILTERS = 'highpass=f=110,highpass=f=110,lowpass=f=7000,aecho=0.8:0.6:30:0.15,'
BARK_LUFS = -22.0
for n, take in BARKS.items():
    SHORT[n] = (take, None, BARK_FILTERS, PEAK, {'fade': 0.12, 'fadein': 0.01, 'lufs': BARK_LUFS})
# name: (take, filters before the fold, integrated loudness in LUFS,
#        compressor[, options])
#   options: breathe  a slow swell of the take, +-dB, three times a loop
#            under    (take, filters, LUFS): a second take laid under the
#                     first at its own loudness, before the fold (the two
#                     takes are the same 30 s long, so they fold as one)
LOOPS = {
    # take 3: birds over a clean bed (take 1's bed was a broad rumble, lifted
    # 36 dB); under 90 Hz there is nothing of the scene, only the model's floor
    'amb-canal': ('amb-canal-3', 'highpass=f=90,highpass=f=90', -20.0, True),
    # the town far off: take 1's rumble, but only its low murmur (45-300 Hz,
    # the band over it was what tired the ear), 8 dB under what it was and
    # swelling and ebbing by 3 dB every nine seconds instead of a flat drone;
    # a few of the canal's birds far over it, 12 dB under the canal's.
    # Take 4 (a quiet valley) came back empty, -67 LUFS. The railway itself
    # is heard in the life events (life-*), now and then
    'amb-rail': ('amb-rail-1', 'highpass=f=45,highpass=f=45,lowpass=f=300,lowpass=f=300', -26.0, False,
                 {'breathe': 3.0, 'under': ('amb-canal-3', 'highpass=f=1500,highpass=f=1500', -32.0)}),
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
# name: (take, start in s, end in s, fade out in s, filters, LUFS) — played
# through once; each end is where the take's own last chord has died away
PIECES = {
    # strings alone, D minor, slow: long chords and a low cello that sits
    # heavy under 150 Hz, taken 3 dB down
    'music-canal-ii': ('music-canal-ii-1', 0.45, 98.0, 1.0, 'highpass=f=45,highpass=f=45,lowshelf=f=150:g=-3', -20.0),
    # the jig: flute and concertina over plucked chords and a bass on the
    # downbeats, a dense low band, taken 3 dB down under 200 Hz
    'music-canal-iii': ('music-canal-iii-1', 0.0, 99.3, 2.5, 'highpass=f=45,highpass=f=45,lowshelf=f=200:g=-3', -20.0),
    # the brass band's march: its last chord stops short at 97.4 s, so it is
    # faded over the last three seconds
    'music-rail-i': ('music-rail-i-1', 0.0, 98.3, 3.0, 'highpass=f=45,highpass=f=45', -20.0),
    # the strings' ostinato: a thick band at 150-400 Hz, softened by 2 dB
    'music-rail-ii': ('music-rail-ii-1', 0.0, 98.7, 2.0, 'highpass=f=45,highpass=f=45,lowshelf=f=250:g=-2', -20.0),
    # the parlour waltz: harmonium, clarinet, cello and square piano; its own
    # last chord dies from 96 s and is gone at 99.2 s
    'music-rail-iii': ('music-rail-iii-1', 0.0, 99.3, 3.0, 'highpass=f=45,highpass=f=45', -20.0),
    # the sixth round: the canal's pieces written through, each 2 min 40 s
    # or so, heard once (CHOIX.md, "The sixth round"). iv: take 2 (asked as
    # a prompt), a towpath air in D major. Its introduction sits 10 dB under
    # its body and its return of the air, from 124 s, 6 dB over it: a slow
    # ride of the gain, +5 dB to 24 s and -5 dB from 126 s, 4 s ramps
    'music-canal-iv': ('music-canal-iv-2', 0.0, 163.4, 1.5,
                       "highpass=f=45,highpass=f=45,volume=eval=frame:volume="
                       "'if(lt(t,24),1.778,if(lt(t,28),1.778-0.778*(t-24)/4,if(lt(t,122),1,if(lt(t,126),1-0.4377*(t-122)/4,0.5623))))'", -20.0),
    # v: take 1 (asked as a plan), a walking air in F major; its first note
    # at 0.85 s, its last chord gone at 163.6 s
    'music-canal-v': ('music-canal-v-1', 0.85, 163.6, 1.5, 'highpass=f=45,highpass=f=45', -20.0),
    # vi: take 1 (a prompt), a waltz in A dorian; silent from 161.8 s. From
    # 30 s to its last chord a steady tone at 87 Hz (85-89 Hz), -25 dBFS,
    # 27 dB over the bass around it, unmoved by the key changes: a drone of
    # the model's, not a player. Two notches 6 Hz wide take it down 25 dB
    'music-canal-vi': ('music-canal-vi-1', 0.0, 161.8, 1.5, 'highpass=f=45,highpass=f=45,bandreject=f=87:t=h:w=6,bandreject=f=87:t=h:w=6', -20.0),
}

# the canal's first three tunes, retired in the sixth round (judge.py: the
# air round and round, the jig's strains again and again, the strings' slow
# air scored under the rest): kept here to say how they were cut, no longer
# served nor made by a plain run
RETIRED = {'music-canal', 'music-canal-iii'}

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


def at_loudness(pcm: array.array, ch: int, rate: int, target: float, tmpdir: str) -> list[float]:
    """The samples scaled by a plain gain to `target` LUFS (as floats: the
    sum of two takes is only rounded once)."""
    probe = os.path.join(tmpdir, 'sfx-probe.wav')
    wav_of(pcm, ch, probe, rate)
    k = 10 ** ((target - lufs_of(probe)) / 20)
    return [v * k for v in pcm]


def loop(name: str) -> None:
    take, filters, target, squeeze, *rest = LOOPS[name]
    opt = rest[0] if rest else {}
    src = os.path.join(RAW, f'{take}.mp3')
    tmpdir = os.environ.get('TMPDIR') or '/tmp'
    rate, ch = 48000, 2
    pcm = dehum(pcm_of(src, ch, rate, filters), ch, rate)
    frames = len(pcm) // ch
    f = int(FOLD * rate)
    if 'under' in opt:
        # the second take, at its own loudness, laid under the first; the
        # first is set at the loop's loudness so the sum is levelled once more
        # below by a gain of a few tenths of a decibel at most
        utake, ufilters, ulufs = opt['under']
        low = dehum(pcm_of(os.path.join(RAW, f'{utake}.mp3'), ch, rate, ufilters), ch, rate)
        frames = min(frames, len(low) // ch)
        lead = at_loudness(pcm[: frames * ch], ch, rate, target, tmpdir)
        under = at_loudness(low[: frames * ch], ch, rate, ulufs, tmpdir)
    else:
        lead, under = [float(v) for v in pcm[: frames * ch]], None
    keep = frames - f
    if opt.get('breathe'):
        # a slow swell, three to a loop: the loop's first sample and the one
        # `keep` later are at the same place of the swell, so the fold's two
        # stretches breathe together and the seam is kept
        depth = opt['breathe'] / 20
        for t in range(frames):
            g = 10 ** (depth * math.sin(2 * math.pi * 3 * t / keep))
            for c in range(ch):
                lead[t * ch + c] *= g
    if under is not None:
        lead = [a + b for a, b in zip(lead, under)]
    pcm = array.array('h', (max(-32768, min(32767, int(round(v)))) for v in lead))
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


def piece(name: str) -> None:
    take, start, end, fade, filters, target = PIECES[name]
    src = os.path.join(RAW, f'{take}.mp3')
    tmpdir = os.environ.get('TMPDIR') or '/tmp'
    rate, ch = 48000, 2
    cut = f'atrim={start}:{end},asetpts=PTS-STARTPTS,{filters}'
    pcm = dehum(pcm_of(src, ch, rate, cut), ch, rate)
    raw = os.path.join(tmpdir, f'sfx-{name}.wav')
    wav_of(pcm, ch, raw, rate)
    dur = len(pcm) / ch / rate
    measured = lufs_of(raw)
    # a plain gain, as for the first tune; should a peak pass -1 dBFS the
    # whole is lowered instead
    gain = min(target - measured, -1.0 - peak_of(raw))
    lev = os.path.join(tmpdir, f'sfx-{name}-lev.wav')
    run(['-y', '-i', raw, '-af', f'afade=t=in:d=0.3,afade=t=out:st={dur - fade:.3f}:d={fade:.3f},volume={gain:.2f}dB', '-c:a', 'pcm_f32le', lev])
    serve(lev, name, True)
    print(f'{name:16} {take:18} {dur:.2f}s from {start}s, {measured:.1f} -> {lufs_of(lev):.1f} LUFS, gain {gain:+.1f} dB, peak {peak_of(lev):.1f} dBFS')


def main() -> None:
    names = sys.argv[1:] or [n for n in [*SHORT, *LOOPS, *MUSIC, *PIECES] if n not in RETIRED]
    for n in names:
        (tune if n in MUSIC else piece if n in PIECES else loop if n in LOOPS else short)(n)


if __name__ == '__main__':
    main()
