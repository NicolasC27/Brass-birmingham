#!/usr/bin/env python3
"""The table's sounds, asked of the ElevenLabs sound-effects model.

    tools/assets/sfx/generate.py            # every take not yet on disk
    tools/assets/sfx/generate.py turn stamp # only these sounds
    tools/assets/sfx/generate.py --dry      # the plan and its cost, no call
    tools/assets/sfx/generate.py music-canal # the canal's tune (music model)
    tools/assets/sfx/generate.py music-rail-i # a rail tune (music model)

The key is read from .env.local (ELEVENLABS) and never printed. Every raw
take lands in tools/assets/sfx/raw/<name>-<n>.mp3 and is never asked for
again: running the script twice spends nothing the second time. Before each
call the account's counter is read, and nothing more is asked once a call
would carry it past CEILING — the owner's hard cap for this round.

The music (MUSIC below) is asked of the music model instead, one take per
call, and is only generated when named: a take of it runs a minute or two
and costs over a thousand credits.

The takes are then trimmed, levelled and served by process.py; the choice
between two takes is written down in CHOIX.md.
"""
import json, os, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
RAW = os.path.join(HERE, 'raw')
LEDGER = os.path.join(HERE, 'ledger.jsonl')
API = 'https://api.elevenlabs.io/v1'

# the owner's hard cap for the fourth round (the playlists, the rail's life):
# 8 709 on the counter when it was begun. It was 22 500 before (3 083 on the
# counter when the palette was begun, plus 19 400 of room)
CEILING = 16_000
# credits per second of sound: the first 20 calls came to about 10.7 a second;
# the estimate errs a little high. The counter is read a few seconds late, so
# the check also adds up this run's own estimates. (It was 40 until the fourth
# round, which would have stopped the round well short of the cap.)
PER_SECOND = 12

ERA = 'England 1780-1840, period materials only, no music, no electronics, no modern sounds'

# name: (seconds, takes, prompt influence, loop, prompt) — in the order of
# priority: if the room runs out the rest keeps its synthesised voice
PLAN = {
    'turn': (2.0, 2, 0.6, False, 'a single small brass handbell rung once on a Victorian railway station platform, clear bright strike and natural ring-out, quiet open air, ' + ERA),
    'stamp': (1.0, 2, 0.6, False, 'a heavy wooden printer\'s block pressed firmly onto a sheet of paper on an oak table, one dull thump with a soft paper crush, close, dry room, ' + ERA),
    'link-canal': (1.5, 1, 0.55, False, 'a small wooden canal boat nudging a stone lock wall, gentle water lapping and slosh, close, calm, ' + ERA),
    'link-rail': (1.2, 1, 0.55, False, 'a short iron rail dropped into place on wooden sleepers, one metallic clank with a dull thud, outdoors, ' + ERA),
    'sell': (1.5, 1, 0.6, False, 'a few heavy copper and silver coins poured into a wooden counting tray, short clinking, close, ' + ERA),
    'era-end': (4.0, 1, 0.55, False, 'a distant steam locomotive whistle blowing once far across the countryside, long and melancholic, soft reverb, ' + ERA),
    'victory': (5.0, 1, 0.55, False, 'a short triumphant fanfare played on natural brass horns and a cornet, a few bright notes and a held final chord, a brass band in a hall, ' + ERA),
    # take 1 of each ambience was asked with an earlier prompt (see CHOIX.md):
    # its bed was a broad rumble that, lifted to the table's level, buzzed.
    # Takes 2 and 3 ask for sparse events over a quiet, clean bed.
    'amb-canal': (30.0, 3, 0.5, True, 'peaceful open countryside by an English canal on a spring morning, clear birdsong at a distance, a light breeze in the reeds, now and then a small soft ripple of water, clean quiet recording with a low noise floor, no hum, no rumble, no wind noise on the microphone, no voices, continuous, ' + ERA),
    # takes 2 and 3 of the rail asked for 'an early industrial town heard from
    # a green hillside far away, a distant steam engine puffing slowly, now and
    # then a faint faraway hammer on an anvil, a soft breeze, a few birds, ...':
    # both came back as the same steady rumble. Take 4 names no town and no
    # engine at all: the railway is heard in the life events below instead
    'amb-rail': (30.0, 4, 0.5, True, 'a quiet green valley on a still grey afternoon, a light breeze in long grass, a few rooks calling far away, now and then a faint far-off clink of iron, long quiet gaps between sounds, sparse and calm, clean quiet recording with a very low noise floor, no hum, no drone, no rumble, no engine, no traffic, no voices, continuous, ' + ERA),
    # the rail's life: now and then, over its ambience, a train somewhere off
    'life-whistle': (4.0, 1, 0.55, False, 'a steam locomotive whistle blown twice, a short blast then a long one, very far away across open fields, faint, with a soft echo off the hills, outdoors, ' + ERA),
    'life-passing': (10.0, 1, 0.5, False, 'an early steam train with a few wooden carriages passing along a line some distance away across a field: its puffing and the clatter of the wheels on the rail joints swell as it comes, pass, and fade away into the distance, a gentle doppler, calm open air, no whistle, ' + ERA),
    'life-couple': (3.0, 1, 0.55, False, 'goods wagons shunted in a distant railway yard: the clank of iron buffers meeting and a chain coupling rattling, one wagon after another down the line, heard from a distance, outdoors, ' + ERA),
    'life-depart': (8.0, 1, 0.5, False, 'a steam locomotive starting slowly from a distant station: a few heavy slow chuffs of steam with a hiss, then quicker, fading away into the distance, outdoors, faint, ' + ERA),
    'click': (0.5, 2, 0.7, False, 'a single small brass latch click, crisp, close, very short, ' + ERA),
    'loan': (1.2, 1, 0.6, False, 'a thick leather-bound ledger book closed shut on a wooden desk, one soft heavy thump of paper and leather, close, ' + ERA),
    'develop': (1.0, 1, 0.6, False, 'a steel hammer striking a small iron chisel once on a workbench, one sharp metallic knock, close, ' + ERA),
    # take 1 was a card laid on the table (a swish, heard as a breath); takes
    # 2 and 3 ask for a card drawn out of the hand and lifted
    'card': (0.5, 3, 0.7, False, 'a single thick pasteboard playing card drawn out of a hand of cards and lifted: a very brief soft muffled slide of card against card, then one light dry tick of stiff card, close, quiet, very short, no rustle, no whoosh, no breath, no wind, ' + ERA),
    'scout': (1.5, 1, 0.6, False, 'a small deck of stiff paper cards riffled and shuffled once by hand, close, dry, ' + ERA),
    'panel-open': (0.7, 1, 0.6, False, 'a small wooden drawer slid open, soft wooden slide with a light brass knob rattle, close, ' + ERA),
    'panel-close': (0.7, 1, 0.6, False, 'a small wooden drawer pushed shut, soft wooden slide ending in a gentle knock, close, ' + ERA),
    'refuse': (0.5, 1, 0.65, False, 'a single dull muffled knock of a knuckle on a thick oak table, low and short, close, ' + ERA),
    # an industry laid on the board: heard with the stamp, so short and dry
    'ind-coal': (1.2, 2, 0.6, False, 'a miner\'s pickaxe striking a coal face once, then a few lumps of coal tumbling into a small wooden mine cart, close, short, ' + ERA),
    'ind-iron': (1.0, 2, 0.6, False, 'a blacksmith\'s hammer striking a hot iron bar on an anvil twice, bright ringing clangs, close, short, ' + ERA),
    'ind-cotton': (1.0, 2, 0.6, False, 'a wooden hand loom: the shuttle thrown across and the beater knocked against the cloth, a quick wooden clack-clack, close, short, ' + ERA),
    'ind-manufacturer': (1.0, 2, 0.6, False, 'a joiner\'s workbench: a wooden mallet tapping a chisel twice and a small iron vice turned with a creak, close, short, ' + ERA),
    'ind-pottery': (1.2, 2, 0.6, False, 'a potter\'s wheel turning briefly, then a fired earthenware jug set down on a wooden shelf with a soft ceramic clink, close, short, ' + ERA),
    'ind-brewery': (1.2, 2, 0.6, False, 'a small oak ale cask set down on a stone floor with a hollow knock, then a short pour of ale into a pewter tankard, close, short, ' + ERA),
    # a merchant's house under the pointer: a glimpse of the town, soft
    'house-warrington': (2.5, 2, 0.5, False, 'a coaching inn yard in a market town: a horse\'s hooves stepping slowly on cobbles, a harness jingle, a wooden cart wheel creaking past, soft and distant, no voices, no speech, ' + ERA),
    'house-nottingham': (2.5, 2, 0.5, False, 'a market square on market day, soft and distant: a wooden stall shutter let down, a basket set on cobbles, a small hand bell rung once far off, no voices, no speech, ' + ERA),
    'house-shrewsbury': (2.5, 2, 0.5, False, 'a river quay: water lapping against a moored wooden barge, a mooring rope creaking on a bollard, a gull far away, soft and calm, no voices, no speech, ' + ERA),
    'house-oxford': (2.5, 2, 0.5, False, 'a quiet old university town: a stagecoach rolling slowly over cobbles under a stone gateway, a chapel bell striking once in the distance, soft, no voices, no speech, ' + ERA),
    'house-gloucester': (2.5, 2, 0.5, False, 'an inland port dock on a river: a wooden crane winch creaking, a heavy sack set down on timber boards, water lapping, soft and distant, no voices, no speech, ' + ERA),
}

# the music model costs more a second than the sound model: the 12 s probe
# below came to 165 credits (5 782 -> 5 947), about 14 a second, read a
# minute after the call, and each 100 s take 1 375; the estimate errs a
# little high (it was 30 until the fourth round)
MUSIC_PER_SECOND = 15

TUNE = ('an instrumental English country dance air of the late eighteenth century, '
        'in the manner of a gavotte or a Playford tune, played by a small chamber group of period instruments: '
        'baroque violin carrying the melody, a wooden transverse flute answering it, a pedal harp and a soft fortepiano '
        'playing gentle broken chords, a bassoon on the bass line; major key, calm walking tempo around 84 bpm, '
        'light, warm, lilting and pastoral, like musicians playing on the towpath of a canal on a spring afternoon; '
        'intimate acoustic recording in a small wooden room; the same even mood from the first bar to the last, '
        'no big introduction, no final cadence, no crescendo; no drums, no percussion, no vocals, no choir, '
        'no synthesizer, no electric or modern instruments, not epic, not cinematic, not orchestral')

# the playlists: the canal's first tune above and two more, each unlike the
# others in key, pace and players; then two for the rail, busier, with a
# steady pulse (never a drum kit), still under the table
PERIOD = ('intimate acoustic recording in a small wooden room; the same even mood from the first bar to the last, '
          'no crescendo, no big climax; no drums, no percussion, no vocals, no choir, '
          'no synthesizer, no electric or modern instruments, not epic, not cinematic')
CANAL_II = ('an instrumental slow English folk air of the early nineteenth century, like an old ballad tune, '
            'played by a string quartet of period instruments with gut strings: the viola and the cello carrying a long, '
            'singing melody in turn, the two violins holding soft sustained chords beneath; D minor, dorian colour, '
            'slow and unhurried around 66 bpm, in four; tender, reflective, a grey morning on a canal wharf; ' + PERIOD)
CANAL_III = ('an instrumental gentle English jig of the 1830s in 6/8, around 100 bpm, G major, '
             'played softly by a wooden simple-system flute and an English concertina sharing the tune, '
             'a hammered dulcimer and an early nineteenth-century gut-strung guitar keeping light plucked chords, '
             'a double bass played pizzicato on the downbeats; cheerful but unhurried, played quietly on the deck of a narrowboat; ' + PERIOD)
RAIL_I = ('an instrumental quick march of the 1840s in 2/4, around 108 bpm, B-flat major, '
          'played softly and at a distance by a small early brass band: keyed bugle and cornet carrying the tune, '
          'an ophicleide and a euphonium on a steady bass, horns on the off-beats like a steam engine working, '
          'determined, bright, industrious, restrained dynamics, background music; ' + PERIOD)
RAIL_II = ('an instrumental piece of the 1840s for string quintet and fortepiano, E minor, around 116 bpm, '
           'the cello and the viola playing a steady repeated pattern of short bowed notes like the beat of a steam engine\'s pistons, '
           'the fortepiano doubling it softly, a long lyrical violin melody above it; '
           'driving but quiet, purposeful, the age of iron and the railway; ' + PERIOD)

# name: (seconds, takes, prompt) — asked of the music model, only when named
MUSIC = {
    # a short take first, to measure what a second of music costs
    'music-probe': (12.0, 1, TUNE),
    'music-canal': (100.0, 2, TUNE),
    'music-canal-ii': (100.0, 1, CANAL_II),
    'music-canal-iii': (100.0, 1, CANAL_III),
    'music-rail-i': (100.0, 1, RAIL_I),
    'music-rail-ii': (100.0, 1, RAIL_II),
}


def key() -> str:
    with open(os.path.join(ROOT, '.env.local')) as f:
        for line in f:
            k, _, v = line.strip().partition('=')
            if k.strip() == 'ELEVENLABS':
                return v.strip().strip('"').strip("'")
    sys.exit('no ELEVENLABS key in .env.local')


def counter(k: str) -> int:
    req = urllib.request.Request(API + '/user/subscription', headers={'xi-api-key': k})
    for wait in (2, 5, 10, 20, 40):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return int(json.load(r)['character_count'])
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(wait)
    sys.exit('the counter could not be read: nothing more is asked')


def ask(k: str, seconds: float, influence: float, loop: bool, text: str) -> bytes:
    body = {'text': text, 'duration_seconds': seconds, 'prompt_influence': influence, 'model_id': 'eleven_text_to_sound_v2'}
    if loop:
        body['loop'] = True
    req = urllib.request.Request(
        API + '/sound-generation?output_format=mp3_44100_128',
        data=json.dumps(body).encode(),
        headers={'xi-api-key': k, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def compose(k: str, seconds: float, text: str) -> bytes:
    body = {'prompt': text, 'music_length_ms': int(seconds * 1000), 'model_id': 'music_v2_5', 'force_instrumental': True}
    req = urllib.request.Request(
        API + '/music?output_format=mp3_44100_192',
        data=json.dumps(body).encode(),
        headers={'xi-api-key': k, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=600) as r:
        return r.read()


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry' in sys.argv
    names = args or list(PLAN)
    os.makedirs(RAW, exist_ok=True)
    k = '' if dry else key()
    start = None
    asked = 0
    for name in names:
        music = name in MUSIC
        if music:
            seconds, takes, text = MUSIC[name]
            influence, loop = 0.0, False
        else:
            seconds, takes, influence, loop, text = PLAN[name]
        for n in range(1, takes + 1):
            out = os.path.join(RAW, f'{name}-{n}.mp3')
            if os.path.exists(out):
                continue
            estimate = int(seconds * (MUSIC_PER_SECOND if music else PER_SECOND) + 0.999)
            if dry:
                print(f'{name}-{n}: {seconds}s, ~{estimate} credits')
                continue
            before = counter(k)
            start = before if start is None else start
            # the counter lags: trust whichever is higher, it or our own sum
            if max(before, start + asked) + estimate > CEILING:
                print(f'STOP before {name}-{n}: counter {before} + ~{estimate} would pass {CEILING}')
                return
            try:
                audio = compose(k, seconds, text) if music else ask(k, seconds, influence, loop, text)
            except urllib.error.HTTPError as e:
                print(f'{name}-{n}: HTTP {e.code} {e.read()[:300]!r}')
                return
            asked += estimate
            with open(out, 'wb') as f:
                f.write(audio)
            # the counter is read late: give it time to catch up
            time.sleep(20)
            after = counter(k)
            row = {'take': f'{name}-{n}', 'seconds': seconds, 'before': before, 'after': after, 'spent': after - before}
            with open(LEDGER, 'a') as f:
                f.write(json.dumps(row) + '\n')
            print(json.dumps(row))


if __name__ == '__main__':
    main()
