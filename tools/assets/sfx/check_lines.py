#!/usr/bin/env python3
"""Every take of a line heard back by the speech-to-text model, and held
to its text.

    tools/assets/sfx/check_lines.py bark-ezra-frozen bark-tom-ice   # these lines
    tools/assets/sfx/check_lines.py --round frost                   # the frozen city's

For each take on disk (raw/<line>-<n>.mp3) the transcription
(`scribe_v1`, a few cents a take, outside the credits) is compared with
the line as written in VOICES, its audio tags and punctuation set aside:
a take that comes back word for word is marked =, one that does not shows
what was heard. The key is read from .env.local (ELEVENLABS), never printed.
"""
import json, os, re, sys, urllib.request, uuid

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
RAW = os.path.join(HERE, 'raw')
sys.path.insert(0, HERE)
import generate  # noqa: E402  (VOICES, the lines as said)


def key() -> str:
    with open(os.path.join(ROOT, '.env.local')) as f:
        m = re.search(r'^\s*ELEVENLABS\s*=\s*(\S+)\s*$', f.read(), re.M)
    if not m:
        sys.exit('no ELEVENLABS key in .env.local')
    return m.group(1).strip('"\'')


def plain(text: str) -> str:
    """the words alone: no audio tags, no punctuation, one case, one space"""
    text = re.sub(r'\[[^\]]*\]', ' ', text)
    text = text.replace('’', "'").replace('…', ' ')
    text = re.sub(r"[^a-z0-9' ]+", ' ', text.lower())
    return ' '.join(text.split())


def transcribe(k: str, path: str) -> str:
    boundary = uuid.uuid4().hex
    with open(path, 'rb') as f:
        audio = f.read()
    body = b''.join([
        f'--{boundary}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\nscribe_v1\r\n'.encode(),
        f'--{boundary}\r\nContent-Disposition: form-data; name="tag_audio_events"\r\n\r\nfalse\r\n'.encode(),
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="take.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n'.encode(),
        audio, f'\r\n--{boundary}--\r\n'.encode(),
    ])
    req = urllib.request.Request(generate.API + '/speech-to-text', data=body, headers={'xi-api-key': k, 'Content-Type': f'multipart/form-data; boundary={boundary}'}, method='POST')
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r).get('text', '')


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if '--round' in sys.argv:
        names = [n for n in generate.VOICES if n.split('-')[-1] in generate.ROUNDS.get(args[0], ())] if hasattr(generate, 'ROUNDS') else args
    else:
        names = args
    k = key()
    bad = 0
    for name in names:
        who, takes, text = generate.VOICES[name]
        want = plain(text)
        for n in range(1, takes + 1):
            path = os.path.join(RAW, f'{name}-{n}.mp3')
            if not os.path.exists(path):
                continue
            heard = plain(transcribe(k, path))
            mark = '=' if heard == want else '≠'
            if mark == '≠':
                bad += 1
            print(f'{mark} {name}-{n}: {heard!r}' + ('' if mark == '=' else f'  (wanted {want!r})'))
    print(f'{bad} take(s) off their line')


if __name__ == '__main__':
    main()
