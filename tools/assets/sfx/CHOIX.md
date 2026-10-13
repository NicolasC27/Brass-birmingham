# The table's sounds: takes and choices

Generated with the ElevenLabs sound-effects model (`eleven_text_to_sound_v2`,
Creator plan, commercial use allowed) by `generate.py`, then trimmed,
levelled and served by `process.py` (ffmpeg only). The raw takes sit in
`raw/`, the per-call ledger in `ledger.jsonl`.

## Credits

| | account counter |
|---|---|
| before the first call | 3 083 |
| after the last call | 4 038 |
| **spent** | **955** (the owner's cap was 20 000) |

The counter updates a few seconds after each call, so the per-call "spent"
column in `ledger.jsonl` often reads 0. What the account's totals show:
the two 2 s calls came to 44 credits (about 11 a second). The 20 calls,
89.3 s of sound in all, cost 955. That is roughly 10.7 credits a second.
`generate.py` still estimates 40 a second, so the ceiling check errs high.
It also adds up its own estimates for the run, since the lagging counter
cannot be trusted alone.

Plan followed: one take per sound, two for the three heard most (turn,
tile, click). Because the budget allowed it, each ambience was made one
30 s take instead of 22 s. After the fold (see below) each loop runs 27 s.

## How each take was judged

With ffmpeg: duration, RMS, peak, silence at the head and tail
(`silencedetect=-45dB`), and a spectrogram with the waveform for each take.
Nothing was judged by ear.

| sound | take kept | why |
|---|---|---|
| turn (station bell) | turn-1 | clear partials, a long even ring-out (0.96 s above -45 dB). turn-2 rings for half as long, with more noise under it |
| stamp (tile laid) | stamp-1 | one clean thump with a woody decay, 0.26 s. stamp-2 is a scatter of little knocks, so it is rejected. The recording replaces the synthesised press, which remains the fallback while the file loads |
| click (brass latch) | click-2, 0.27–0.42 s | click-1 is a 0.48 s smear, not a click. click-2 has two events: the second one, a single sharp transient, is kept |
| link-canal | link-canal-1 | two soft splashes, 0.87 s |
| link-rail | link-rail-1 | a metallic clank with a low decay. The take was quiet (peak -25 dB), lifted by 22 dB |
| sell | sell-1 | coins over 1.1 s, bright partials |
| era-end | era-end-1 | a tonal whistle with a long fall. Low-passed at 4.2 kHz to sit in the distance |
| victory | victory-1 | a brass fanfare, 3.5 s of sound, with a clear held chord |
| defeat | victory-1, processed | the same fanfare muted: low-pass 900 Hz, high-pass 90 Hz, a short room echo, peak 6 dB under the win. No extra take bought |
| loan | loan-1 | a paper rustle, then one leather thump |
| develop | develop-1 | one sharp knock of hammer on iron, with a short ring |
| card | card-1 | a soft paper swish, lifted by 13 dB |
| scout | scout-1 | three riffles over 1.2 s |
| panel-open / panel-close | -1 each | a wooden slide, then a knock. Played at 40 % |
| refuse | refuse-1 | a dull low knock. The take was very quiet (peak -36 dB), lifted by 40 dB. It is only 0.12 s long, so the lift brings up little noise |
| amb-canal | amb-canal-1 | still water, and birds visible in the upper band. Very quiet (-51.6 LUFS) with a few close bird calls on top: lifted by 36 dB to -16.1 LUFS, the handful of peaks that would clip held by a limiter (up to about 9 dB off, a few times per loop; the per-second RMS stays within 6 dB) |
| amb-rail | amb-rail-1 | a steady low rumble with a breathing noise, -41 LUFS, lifted by 25 dB to -16 LUFS |

## Processing (process.py)

- Gestures and moments: silence cut at both ends (-55 dB), a 40 ms fade on
  the tail, mono 48 kHz, peak at -3 dBFS.
- Ambiences are folded onto themselves: over the first 3 s, the head is
  faded in under the take's last 3 s, on equal-power curves. The file then
  stops where that tail began, so the last sample runs straight into the
  first. The level is set with a plain gain (not a dynamic normaliser, which
  would break the seam). Where that gain would clip (amb-canal), a
  limiter holds the peaks; it is run over three turns of the loop and the
  middle turn kept, so its state at the last sample is its state at the
  first and the seam survives. Checked: the RMS on both sides of the seam agrees
  within 1–2 dB in 10 ms windows, with no step in the samples.
- Served as `app/public/sfx/<name>.webm` (Opus: 64 kb/s mono, 96 kb/s
  stereo) and `<name>.mp3` (LAME q4, the fallback for Safari). About 2 MB
  in all, most of it the two ambiences.

## Replaying

    python3 tools/assets/sfx/generate.py --dry   # plan and estimate, no call
    python3 tools/assets/sfx/generate.py         # only the takes not on disk
    TMPDIR=/tmp python3 tools/assets/sfx/process.py
