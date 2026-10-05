#!/usr/bin/env python3
"""The merchants' signs as painted oak signboards.

    tools/assets/fal-signboards.py <merchant id> [...]

Asks fal-ai/nano-banana/edit (through tools/map/fal-run.mjs, FAL_KEY in
.env.local) for one signboard per merchant: Shrewsbury's board painted
again with another name and another dusk view, so every sign is the same
board — weathered oak planks and iron straps, the name painted large on
the top plank, the framed painting on the left where the tiles rest, a
blank brass roundel on the right for the bonus. References: Shrewsbury's
board for the pattern, the v3 goods sheet for the brush. The result is trimmed of its black surround, kept as
tools/assets/merchants/signboard-<id>.png and served as
app/public/merchant-house-<id>.webp (1024 wide); then read the roundel's
centre and radius off it into app/src/gl/houses.ts, with `board: true`.
"""
import json, os, subprocess, sys, tempfile

R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCENE = {
    'shrewsbury': 'a timber-framed Tudor merchant hall on a river quay, a stone bridge behind, moored narrowboats',
    'warrington': 'brick warehouses and a wide stone bridge over the river Mersey, a canal basin with moored barges and a crane on the quay',
    'nottingham': 'tall red-brick lace-market warehouses above the river Trent, the castle on its rock in the distance, a wharf with a moored barge',
    'oxford': 'a canal wharf, college spires and a domed tower rising behind stone warehouses, moored narrowboats',
    'gloucester': 'the great Victorian docks, tall brick warehouses with many windows, tall ships and barges moored, the cathedral tower in the distance',
    'trento': 'a walled Alpine market town on the river Adige, the castle above, mountains behind',
    'trieste': 'the great port on the Adriatic, tall ships at the moles, a stone quay under the hills',
    'milano': 'the cathedral spires above a canal basin of the Navigli, barges moored under the porticoes',
    'bologna': 'red-brick towers and porticoes above a canal, wool barges at a covered quay',
    'ferrara': 'a Renaissance castle with its moat and towers, a river quay with moored boats',
}
# Shrewsbury's board is the pattern: every other sign is the same board repainted
REF = f'{R}/tools/assets/merchants/signboard-shrewsbury.png'
STYLE = f'{R}/tools/assets/tiles-woodcut/v3-style.png' if os.path.exists(f'{R}/tools/assets/tiles-woodcut/v3-style.png') else f'{R}/brass/v3-style.png'
for name in sys.argv[1:]:
    prompt = (
        'Paint this exact same wooden signboard again for another trading house, in exactly the style of the two images: the same chunky painted-model look, '
        'the same warm light from the upper left, the same rich colours. Keep everything identical — the same weathered oak planks, the same dark iron straps and round rivets, '
        'the same proportions, the same layout: the name plank across the top, the framed painting on the left, the blank brass roundel with its beaded rim on the right — '
        f'and change only two things: the name on the top plank now reads {name.upper()} in the same cream painted serif capitals, and the painting now shows {SCENE[name]} at dusk. '
        'Wide format, seen perfectly straight on, filling the frame edge to edge, black background outside the board. No other text, no people.')
    # the runner labels every file a PNG: hand it one
    ref = tempfile.mktemp(suffix='.png')
    subprocess.run(['magick', REF, '-resize', '1024x', ref], check=True)
    body = tempfile.mktemp(suffix='.json')
    json.dump({'prompt': prompt, 'image_urls': [f'file://{ref}', f'file://{STYLE}'], 'num_images': 1, 'aspect_ratio': '21:9', 'output_format': 'png'}, open(body, 'w'))
    raw = tempfile.mktemp(suffix='.png')
    subprocess.run(['node', f'{R}/tools/map/fal-run.mjs', 'fal-ai/nano-banana/edit', body, raw], check=True)
    src = f'{R}/tools/assets/merchants/signboard-{name}.png'
    subprocess.run(['magick', raw, '-fuzz', '12%', '-trim', '+repage', src], check=True)
    subprocess.run(['magick', src, '-resize', '1024x', '-quality', '88', f'{R}/app/public/merchant-house-{name}.webp'], check=True)
    print(name, subprocess.run(['magick', src, '-format', '%wx%h', 'info:'], capture_output=True, text=True).stdout)
