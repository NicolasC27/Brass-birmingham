# The table's sounds: takes and choices

Generated with the ElevenLabs sound-effects model (`eleven_text_to_sound_v2`,
Creator plan, commercial use allowed) by `generate.py`, then trimmed,
levelled and served by `process.py` (ffmpeg only). The raw takes sit in
`raw/`, the per-call ledger in `ledger.jsonl`.

## Credits

| | account counter |
|---|---|
| before the first call | 3 083 |
| after the first palette | 4 038 |
| before the second round (houses, trades, ambiences again) | 4 038 |
| after the second round | 5 782 |
| **spent in all** | **2 699** (the owner's cap is 20 000; `generate.py` stops at 22 500 on the counter) |

The second round: 26 takes, 159 s of sound, 1 744 credits (about 11 a
second again). The four 30 s ambience takes alone came to 1 348.

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
| amb-canal | **amb-canal-3** (was amb-canal-1) | see "The buzz" below. Take 3: birdsong spread over the whole loop at 2–7 kHz, a clean bed (under 1 kHz, 35 dB below take 1's). Take 2 had two loud bird bursts, one of them in the last three seconds, where the fold lays it over the head |
| amb-rail | amb-rail-1, kept | takes 2 and 3 (asked for distant puffing and anvil strikes) came back as the same steady rumble, spread of loudness under 3.5 dB, nothing more to hear: bought, not used |
| house-warrington | house-warrington-1 | a coaching inn yard: a dozen light hoof steps, uneven, ending on a softer knock (cart). Take 2 is a trot, strong clip-clop pairs, busier |
| house-nottingham | house-nottingham-2 | a hand bell rung three times, clear partials, then its ring-out (1.2 s). Take 1 is one dull knock and nothing else |
| house-shrewsbury | house-shrewsbury-1 | water slapping a hull (the low band) under a mooring rope's creak that slows and stops at 1.7 s. Take 2 is the creak alone, even ticks all through: heard as a rattle |
| house-oxford | house-oxford-1 | a coach rolling over cobbles for 1.9 s, then gone. Very quiet (-40 LUFS), so the hum is taken out before it is lifted. Take 2 is two isolated knocks |
| house-gloucester | house-gloucester-1 | a winch's ratchet (0–0.9 s), then a heavy sack on boards and a rustle. Take 2 is much the same, busier |
| ind-coal | ind-coal-1, 0–0.8 s | a pick on the face, then lumps tumbling in four bursts. Its long low tail cut, a 0.2 s fade. Take 2 is two bursts only |
| ind-iron | ind-iron-1, 0–0.75 s | one hammer blow on an anvil and its ring (asked for two blows: both takes gave one). Take 1 rings for half as long |
| ind-cotton | ind-cotton-2, 0–0.5 s | two wooden clacks 0.1 s apart, the shuttle and the beater. Take 1 is a single knock |
| ind-manufacturer | ind-manufacturer-2, 0.05–0.55 s | two sharp taps of a mallet on a chisel, each with a short metallic ring (the take has three: two kept, to stay short) |
| ind-pottery | ind-pottery-1, 0–0.8 s | the wheel's rumble in short bursts, then a ceramic clink that rings. Take 2 opens on a smooth low hum (the wheel): too near a buzz |
| ind-brewery | ind-brewery-2, 0–0.6 s | a hollow knock of the cask, then a short pour (a band at 1–3 kHz with the ripple of liquid). Take 1 is a cask bouncing, no pour |

## The buzz under the ambience

The owner heard a "bzzzz" under the table. Measured, not heard:

- **The model's hum.** Every take of the sound model carries a faint line at
  exactly 200 Hz and at every multiple of it, up to about 6 kHz (on
  amb-canal-3, fine spectrum over 30 s: 200.005, 400.002, 599.993,
  1000.003, 2000.001 Hz, the first two 34 dB over the noise around them).
  The model writes its audio in 5 ms frames; the line is that frame rate.
  In a knock it is masked. Over a quiet bed lifted by 20 to 36 dB it is a
  buzz: take 1 of the canal had it 7 to 10 dB over its bed, the new canal
  takes 25 to 31 dB.
- **The bed of the old canal.** Take 1 was -52 LUFS of broadband noise from
  30 Hz to 1.5 kHz, with birds on top; lifted by 36 dB to -16 LUFS, that
  noise became the ambience itself (30–1000 Hz at -25 dBFS RMS, 40–120 Hz
  peaking at -11 dBFS, which small speakers answer with a rattle).
- **Not the cause.** No mains line (50/60/100/120 Hz), no clipping, no
  periodic flutter of the envelope (modulation spectrum flat), no aliasing;
  the limiter touched only a few peaks per loop.

The fix, in `process.py`: a new canal take, and on every loop and every
house a comb of notches at each multiple of 200 Hz (`dehum`, about 2 Hz
wide). After it the lines stand 5 dB at most over their neighbours, which is
the spread of the noise itself. Under 90 Hz the canal is cut (nothing of the
scene lives there), under 45 Hz the rail (the rumble between 45 and 120 Hz,
which is the scene, is kept, 4 dB lower). No limiter any more: the canal's
few loud birds go through a gentle compressor (3:1 from -14 dBFS, 10 ms in,
250 ms out, run over three turns of the loop so the seam survives), and
where a peak would still pass -1 dBFS the whole loop is lowered instead.

| loop | before | after |
|---|---|---|
| amb-canal | -16 LUFS; 30–1000 Hz at -25 dBFS RMS; 200 Hz comb +7 dB | -22.2 LUFS (played 3 dB up, `AMB_TRIM`); 30–1000 Hz at -60 dBFS; comb gone |
| amb-rail | -16 LUFS; under 45 Hz at -30 dBFS RMS | -18 LUFS; under 45 Hz at -38 dBFS; 45–120 Hz 3 dB lower |

The seam is checked as before: 10 ms windows either side of the loop point
agree, and the sample step across it (31 and 28) is well under the 99th
percentile of the steps inside the loop (380 and 471).

## Processing (process.py)

- Gestures and moments: silence cut at both ends (-55 dB), a 40 ms fade on
  the tail, mono 48 kHz, peak at -3 dBFS.
- Ambiences are folded onto themselves: over the first 3 s, the head is
  faded in under the take's last 3 s, on equal-power curves. The file then
  stops where that tail began, so the last sample runs straight into the
  first. Before the fold: the filters of the loop (high-pass) and the
  hum comb. The level is set with a plain gain (not a dynamic normaliser,
  which would break the seam). Where that gain would take a peak past
  -1 dBFS (amb-canal), the gentle compressor described above rounds off the
  loud moments; it is run over three turns of the loop and the middle turn
  kept, so its state at the last sample is its state at the first and the
  seam survives. Checked: the RMS on both sides of the seam agrees in 10 ms
  windows, with no step in the samples.
- Houses and trades: cut to the window in the table above, the hum taken
  out of the houses (textures; not of the trades, which are knocks and on
  which the comb would leave a faint tail), a longer fade (0.12 to 0.3 s),
  and levelled by loudness: the trades at -20 LUFS like the stamp (the
  shortest two, whose peak comes first, a few LU under), the peak held at
  -3 dBFS; the houses at -25 LUFS, the peak held at -2 dBFS. The houses
  were first levelled at -22 LUFS, but the hooves (Warrington), the
  cobbles (Oxford) and the quay (Shrewsbury) are knocks whose peak stops
  them short of it: they came out at -25 to -27 LUFS while the bell and
  the winch reached -22, 5 LU apart. At -25 they sit within 2 LU of each
  other (-24.5 to -26.3), and the house level in sfx.ts went from 0.55 to
  0.6 to keep their average where it was. A sound shorter than the
  meter's 400 ms window is measured with silence after it.
- Served as `app/public/sfx/<name>.webm` (Opus: 64 kb/s mono, 96 kb/s
  stereo) and `<name>.mp3` (LAME q4, the fallback for Safari). About 2.3 MB
  in all, most of it the two ambiences. `app/public/sfx-shrewsbury.mp3`
  (the six-second quay the table used to loop) is no longer read.

## How they are played (app/src/gl/sfx.ts)

- A house: its recording once as the pointer arrives (no loop), on the
  gestures' bus at 0.6, faded in over 60 ms and out over 0.4 s when the
  pointer leaves. A house without a recording still rings its bell.
- A trade: `ind-<industry>` 70 ms after the stamp of the tile, at 0.6 of
  the stamp's level, a machine's further off like its stamp.
- A link: water for a canal link, iron for a rail link, as before; a link
  laid in the same frame as a tile is now heard too.

## Replaying

    python3 tools/assets/sfx/generate.py --dry   # plan and estimate, no call
    python3 tools/assets/sfx/generate.py         # only the takes not on disk
    TMPDIR=/tmp python3 tools/assets/sfx/process.py
