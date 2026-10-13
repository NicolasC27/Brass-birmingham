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
    'amb-canal': (30.0, 1, 0.45, True, 'quiet ambience of a calm English canal in the countryside at morning, still water lapping softly against the bank, distant horse hooves on a towpath, small birds singing far away, no voices, continuous, ' + ERA),
    'amb-rail': (30.0, 1, 0.45, True, 'quiet ambience of an early industrial town seen from afar, distant steam engine chuffing, faint blacksmith forge hammer on an anvil far away, soft steam hiss, occasional distant rail clank, no voices, continuous, ' + ERA),
    'click': (0.5, 2, 0.7, False, 'a single small brass latch click, crisp, close, very short, ' + ERA),
    'loan': (1.2, 1, 0.6, False, 'a thick leather-bound ledger book closed shut on a wooden desk, one soft heavy thump of paper and leather, close, ' + ERA),
    'develop': (1.0, 1, 0.6, False, 'a steel hammer striking a small iron chisel once on a workbench, one sharp metallic knock, close, ' + ERA),
    'card': (0.7, 1, 0.65, False, 'a single stiff paper playing card slid and laid down on a wooden table, soft paper swish, close, ' + ERA),
    'scout': (1.5, 1, 0.6, False, 'a small deck of stiff paper cards riffled and shuffled once by hand, close, dry, ' + ERA),
    'panel-open': (0.7, 1, 0.6, False, 'a small wooden drawer slid open, soft wooden slide with a light brass knob rattle, close, ' + ERA),
    'panel-close': (0.7, 1, 0.6, False, 'a small wooden drawer pushed shut, soft wooden slide ending in a gentle knock, close, ' + ERA),
    'refuse': (0.5, 1, 0.65, False, 'a single dull muffled knock of a knuckle on a thick oak table, low and short, close, ' + ERA),
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
