#!/usr/bin/env python3
"""The table's sounds, asked of the ElevenLabs sound-effects model.

    tools/assets/sfx/generate.py            # every take not yet on disk
    tools/assets/sfx/generate.py turn stamp # only these sounds
    tools/assets/sfx/generate.py --dry      # the plan and its cost, no call

The key is read from .env.local (ELEVENLABS) and never printed. Every raw
take lands in tools/assets/sfx/raw/<name>-<n>.mp3 and is never asked for
again: running the script twice spends nothing the second time. Before each
call the account's counter is read, and nothing more is asked once a call
would carry it past CEILING — the owner's hard cap for this palette.

The takes are then trimmed, levelled and served by process.py; the choice
between two takes is written down in CHOIX.md.
"""
import json, os, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
RAW = os.path.join(HERE, 'raw')
LEDGER = os.path.join(HERE, 'ledger.jsonl')
API = 'https://api.elevenlabs.io/v1'

# 3 083 on the counter when the palette was begun, plus 19 400 of room
CEILING = 22_500
# credits per second of sound: the first two calls (2 s each) cost 44 in all,
# about 11 a second; the estimate stays at 40 to err high. The counter is read
# a few seconds late, so the check also adds up this run's own estimates.
PER_SECOND = 40

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
    'amb-rail': (30.0, 3, 0.5, True, 'an early industrial town heard from a green hillside far away, a distant steam engine puffing slowly, now and then a faint faraway hammer on an anvil, a soft breeze, a few birds, clean quiet recording with a low noise floor, no hum, no drone, no rumble, no voices, continuous, ' + ERA),
    'click': (0.5, 2, 0.7, False, 'a single small brass latch click, crisp, close, very short, ' + ERA),
    'loan': (1.2, 1, 0.6, False, 'a thick leather-bound ledger book closed shut on a wooden desk, one soft heavy thump of paper and leather, close, ' + ERA),
    'develop': (1.0, 1, 0.6, False, 'a steel hammer striking a small iron chisel once on a workbench, one sharp metallic knock, close, ' + ERA),
    'card': (0.7, 1, 0.65, False, 'a single stiff paper playing card slid and laid down on a wooden table, soft paper swish, close, ' + ERA),
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


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry' in sys.argv
    names = args or list(PLAN)
    os.makedirs(RAW, exist_ok=True)
    k = '' if dry else key()
    start = None
    asked = 0
    for name in names:
        seconds, takes, influence, loop, text = PLAN[name]
        for n in range(1, takes + 1):
            out = os.path.join(RAW, f'{name}-{n}.mp3')
            if os.path.exists(out):
                continue
            estimate = int(seconds * PER_SECOND + 0.999)
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
                audio = ask(k, seconds, influence, loop, text)
            except urllib.error.HTTPError as e:
                print(f'{name}-{n}: HTTP {e.code} {e.read()[:300]!r}')
                return
            asked += estimate
            with open(out, 'wb') as f:
                f.write(audio)
            after = counter(k)
            row = {'take': f'{name}-{n}', 'seconds': seconds, 'before': before, 'after': after, 'spent': after - before}
            with open(LEDGER, 'a') as f:
                f.write(json.dumps(row) + '\n')
            print(json.dumps(row))


if __name__ == '__main__':
    main()
