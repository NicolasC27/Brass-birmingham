#!/usr/bin/env python3
"""The crater's rim laid round a served ground (ImageMagick 7).

Frostpunk's city sits at the bottom of a crater. Asked to paint the rim
round the frozen city (the served ground handed over, "keep the middle
exactly as it is"), the model also repainted the middle and let the walls
climb a long way into the play area; so only its margin is used, from the
world's edge outward, laid over the ground through a soft band: nothing
inside the play area changes, and the walls rise where the board ends.

Usage, from the repository root:
  tools/map/crater-rim.py <rim.png> <places.json> <ground.webp> <out.webp> [tone]
rim is the model's painting at any size (it is brought to the ground's
4160x2340); places.json comes from places.ts, and keeps the walls off
every town and merchant; tone is a brightness,saturation for the rim
(100,100), the rail era's walls a little darker and greyer.
"""
import json, os, subprocess, sys, tempfile

RIM, PLACES, GROUND, OUT = sys.argv[1:5]
TONE = sys.argv[5] if len(sys.argv) > 5 else '100,100'
FW, FH, BX, BY = 4160, 2340, 480, 270
# the floor of the crater: the world less this much at the sides, its
# corners rounded, so the walls come in where the board is empty — the
# corners and the far sides — and the rim reads as a crater, not a frame
INSET, CORNER, SOFT = 150, 520, 90
# and never over a town or a merchant: a clear disc round each
KEEP, KEEP_SOFT = 250, 60
T = tempfile.mkdtemp()
mask = f'{T}/mask.png'
rim = f'{T}/rim.png'
p = json.load(open(PLACES))
discs = [f'circle {BX + t["x"]:.0f},{BY + t["y"]:.0f} {BX + t["x"] + KEEP:.0f},{BY + t["y"]:.0f}' for t in p['towns'] + p['merchants']]
subprocess.run(['magick', '-size', f'{FW}x{FH}', 'xc:white', '-fill', 'black',
                '-draw', f'roundrectangle {BX + INSET},{BY + INSET} {FW - BX - INSET},{FH - BY - INSET} {CORNER},{CORNER}', '-blur', f'0x{SOFT}',
                '(', '-size', f'{FW}x{FH}', 'xc:white', '-fill', 'black', '-draw', '\n'.join(discs), '-blur', f'0x{KEEP_SOFT}', ')', '-compose', 'multiply', '-composite', mask], check=True)
subprocess.run(['magick', RIM, '-resize', f'{FW}x{FH}!', '-modulate', TONE, mask, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', rim], check=True)
subprocess.run(['magick', GROUND, rim, '-compose', 'over', '-composite', '-quality', '82', OUT], check=True)
for f in (mask, rim):
    os.remove(f)
os.rmdir(T)
print(f'{OUT}: the rim laid, the floor {INSET} px in from the world\'s edge, {len(discs)} places kept clear')
