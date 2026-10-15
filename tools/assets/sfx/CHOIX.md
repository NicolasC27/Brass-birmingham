# The table's sounds: takes and choices

Generated with the ElevenLabs sound-effects model (`eleven_text_to_sound_v2`,
Creator plan, commercial use allowed) by `generate.py`, the eras' tunes
with the ElevenLabs music model (`music_v2_5`, `POST /v1/music`,
instrumental forced), and the townsfolk's voices with its voice-design
(`eleven_ttv_v3`) and expressive speech (`eleven_v3`) models, then trimmed,
levelled and served by `process.py` (ffmpeg only). The raw takes sit in
`raw/`, the per-call ledger in `ledger.jsonl`. Since the sixth round the
tunes are also measured for the ear by `judge.py` (repetition, form,
loudness, a listener model), its results in `judge/`.

## Credits

| | account counter |
|---|---|
| before the first call | 3 083 |
| after the first palette | 4 038 |
| before the second round (houses, trades, ambiences again) | 4 038 |
| after the second round | 5 782 |
| before the third round (the canal's tune, the card) | 5 782 |
| after the 12 s music probe | 5 947 |
| after the two card takes | 5 959 |
| after the two 100 s music takes | 8 709 |
| before the fourth round (the playlists, the rail's life) | 8 709 |
| after the rail's four events and the rail's bed | 9 314 |
| after music-canal-ii | 10 689 |
| after music-canal-iii | 12 064 |
| after music-rail-i | 13 439 |
| after music-rail-ii | 14 814 |
| before the fifth round (the canal's life, the voices, a third rail tune) | 14 814 |
| after the first try at the voices (plain lines, 40 takes, not served) | 15 361 |
| after the canal's six events and the rail's two more | 15 867 |
| after the seven characters' voices were designed and kept | 17 132 |
| after the characters' 41 lines | 18 125 |
| after music-rail-iii | 19 504 |
| before the sixth round (the canal's tunes written through) | 19 504 |
| after music-canal-iv-1 (a plan) | 21 773 |
| after music-canal-v-1 (a plan) | 24 042 |
| after music-canal-vi-1 (a prompt) | 26 311 |
| after music-canal-iv-2 (a prompt) | 28 580 |
| after music-canal-v-2 (a prompt) | 30 849 |
| **spent in all** | **27 766** (the sixth round's cap: 32 000 on the counter; `generate.py` stops there) |

The sixth round: 11 345 credits, five takes of 165 s at 2 269 each (13.75
a second, as before; a composition plan costs the same as a prompt).
Asking the model for a plan (`POST /v1/music/plan`) costs nothing. After
the fifth take 1 151 were left under the cap: not enough for another
(2 475 by `generate.py`'s estimate), so none was asked.

The fifth round: 4 690 credits. Speech is a credit a character (the
lines and their stage directions); a voice design, three drafts of a
100-200 character sample, came to about 180. The speech-to-text checks
(below) cost next to nothing: 6 credits for 31 takes.

The fourth round: 6 105 credits. Each 100 s music take came to exactly
1 375 again (13.75 a second). The five sound takes (55 s) came to 605, 11
a second. Room was left for one more 100 s take (1 186 under the cap, a
take costs 1 375): the rail has two tunes, not three, and no take was
bought twice. `generate.py`'s estimates were brought down to 12 a second
(sound) and 15 (music): at 40 and 30 they would have stopped the round
at 13 000 on the counter.

The third round: 2 927 credits. The music model costs about 14 credits a
second (165 for the 12 s probe, 1 375 for each 100 s take), a little over
the sound model's 11; `generate.py` estimates 30 a second for it.

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
| card | **card-2, 0.04–0.22 s** (was card-1) | see "The card taken up" below |
| scout | scout-1 | three riffles over 1.2 s |
| panel-open / panel-close | -1 each | a wooden slide, then a knock. Played at 40 % |
| refuse | refuse-1 | a dull low knock. The take was very quiet (peak -36 dB), lifted by 40 dB. It is only 0.12 s long, so the lift brings up little noise |
| amb-canal | **amb-canal-3** (was amb-canal-1) | see "The buzz" below. Take 3: birdsong spread over the whole loop at 2–7 kHz, a clean bed (under 1 kHz, 35 dB below take 1's). Take 2 had two loud bird bursts, one of them in the last three seconds, where the fold lays it over the head |
| amb-rail | amb-rail-1, kept | takes 2 and 3 (asked for distant puffing and anvil strikes) came back as the same steady rumble, spread of loudness under 3.5 dB, nothing more to hear: bought, not used. Reshaped in the fourth round (its low murmur only, with far birds); take 4 came back empty: see "The rail's bed" |
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

## The fourth round: playlists and the rail's life

The owner: the canal's tune was always the same one, in a loop; the rail
had no music, and its ambience was a tiring noise. Asked for: two more
tunes for the canal, two or three for the rail, played one after another
with the ambience alone between them; the rail's bed lower and sparser,
with a train heard now and then.

Judged as before, by measurement (ffmpeg only: loudness, loudness range,
octave bands, a 2 s or 0.25 s envelope, the spectrogram), not by ear.

### The tunes

Each prompt names its key, pace and players so no two sound alike (the
prompts are in `generate.py`: `CANAL_II`, `CANAL_III`, `RAIL_I`,
`RAIL_II`). One 100 s take each; each came back usable, so none was asked
twice.

| tune | take | counter before / after | what the measures show, and why it was kept |
|---|---|---|---|
| music-canal (1) | music-canal-2 | (third round) | kept as it was: the loop of four phrases, now heard twice over (137 s) and faded over its last 6 s |
| music-canal-ii | music-canal-ii-1 | 9 314 / 10 689 | strings alone, D minor, slow: long held chords in three sections (0-29 s, 30-58 s with more movement, 60-97 s), its own decay to silence at 97.7 s. -14.7 LUFS, LRA 8.6: the most dynamic of the five. Heavy under 150 Hz (the cello): a low shelf of -3 dB there |
| music-canal-iii | music-canal-iii-1 | 10 689 / 12 064 | the jig: plucked chords every 0.3 s, a bass note on each downbeat (about 0.9 s apart, decaying in 0.3 s: a pizzicato, not a drum), a tune over 500-2 500 Hz from 20 s. -10.9 LUFS, LRA 3.6: dense and even, the brightest of the canal's three. -3 dB under 200 Hz |
| music-rail-i | music-rail-i-1 | 12 064 / 13 439 | a brass band's march: phrases of 4.4 s, brass harmonics from 200 Hz to 3 kHz, almost nothing under 90 Hz (-61 dB). LRA 2.4, steady from the first bar. Its last chord stops short at 97.4 s: faded over the last 3 s |
| music-rail-ii | music-rail-ii-1 | 13 439 / 14 814 | strings and fortepiano: a steady ostinato of short bowed notes at 150-400 Hz all through (the engine's beat), a violin line over it from 42 s, the upper strings from 60 s. LRA 3.1. The ostinato's band softened by 2 dB |

The four new tunes are not looped: each is served whole, from its first
note (canal-ii's 0.45 s of silence cut) to the end of its own last chord
(97.6 to 99.3 s), rid of the 200 Hz comb (`dehum`, the same notch comb as
the loops), nothing under 45 Hz, a 0.3 s fade in, a fade out of 1 to 3 s
over the take's own ending, and a plain gain to -20 LUFS, like the first
(peaks -7.8 to -9.2 dBFS; no compressor). WebM 1.3 to 1.5 MB each, MP3
1.5 to 1.9 MB, fetched only during the pause before the tune is due.

### The rail's bed

| | before | after |
|---|---|---|
| loudness | -17.9 LUFS, LRA 0.8 LU (a flat drone) | -26.0 LUFS, played at 1.2 (-24.4), LRA 5.1 LU |
| 45-90 Hz / 90-180 Hz | -28 / -26 dBFS RMS | -34 / -33 dBFS |
| 250-700 Hz | -33 dBFS | -48 dBFS |
| 700-2 000 Hz | -35 dBFS | -69 dBFS |
| 2-6 kHz | -45 dBFS | -48 dBFS (birds, far) |

Take 4 (`amb-rail-4`, 451 credits with life-depart) asked for a quiet
valley with no town and no engine in the prompt: it came back empty,
-67 LUFS, peak -62 dBFS, an even floor with nothing in it. Lifted 40 dB
it would have been the model's floor and its comb. Bought, not used, and
no fifth take: the bed is made from what was on disk instead.

The bed is take 1's rumble cut to its low murmur (45-300 Hz, twice
second-order each side; the 300 Hz-2 kHz band was what tired the ear), at
-26 LUFS, swelling and ebbing by +-3 dB three times a loop (every 9 s)
instead of a flat drone, with the birds of amb-canal-3 laid under it,
nothing of them under 1.5 kHz, at -32 LUFS (12 dB under the canal's). The
two takes are 30 s each and fold as one; the swell's period divides the
loop, so the seam holds: 10 ms windows either side at -34.6 and -33.1 dB,
the step across it 7 (the 99th percentile of the steps inside is 656).

### The rail's life

Four short takes, one each, heard over the rail's bed now and then:

| event | take, cut | counter | what it is, and why kept |
|---|---|---|---|
| life-whistle | life-whistle-1, 0-3.3 s | 8 709 / (8 863) | one whistle blast of 1.7 s (a stack of partials over 400 Hz) and its ring. Asked for two blasts: one came, kept. Given distance: under 3 kHz only, two slow echoes (230 and 470 ms), -27 LUFS |
| life-passing | life-passing-1, 0.3-7.4 s | 8 709 / (8 863) | the clatter of rail joints swelling from 1 s, held from 3 s; the take stops short at 7.2 s, so it is faded over its last 1.3 s. -25.7 LUFS. Played crossing from one side to the other |
| life-couple | life-couple-1, 0.1-2.1 s | 8 709 / 8 863 | a run of iron clanks (0.2-1.6 s, the loudest at 1.1 s) over a low floor, the floor cut under 90 Hz. -27 LUFS. Knocks: no dehum, as for the trades |
| life-depart | life-depart-1, 0-5.2 s | 8 863 / (9 314) | heavy chuffs and steam for 3 s, falling away; the low hum after 4.5 s (under 80 Hz) cut. -25.9 LUFS |

(The counter lagged: the first three calls were counted together, 154,
and life-depart with amb-rail-4, 451.) All four are cut under 90 Hz and
over 6 kHz, mono.

## The fifth round: the canal's life, the townsfolk, a third rail tune

The owner: something now and then in both eras, not only the rail; and
voices, English, from time to time, workers grumbling or pleased as in a
city builder, with a bubble in the town where it is said. Then, halfway
through: not read but played — characters who come back, broad, funny,
short, with the expressive model and its stage directions.

### The canal's life, and two more for the rail

One take each, judged by the envelope (0.25 s windows), loudness and a
transcription where a voice might hide in it.

| event | take, cut | what it is, and why kept |
|---|---|---|
| life-horse | life-horse-1, 0-5.5 s | steady hooves on gravel with the harness, -23 to -35 dB windows, going from 4.5 s. -29 LUFS (its peak stops it there) |
| life-lock | life-lock-1, 0-4.3 s | a creak, then the sluice held at -16 to -21 dB; the take cuts the water off at 4.25 s, so the last second is faded. -28 LUFS |
| life-forge | life-forge-1, 0-3.6 s | blows over 2.5 s and their ring. Knocks: no dehum. -28 LUFS |
| life-bell | life-bell-1, 0-6 s | one stroke (three were asked) and a 6 s decay, LRA 29 LU. Top dulled at 5 kHz. -29 LUFS |
| life-geese | life-geese-1, 0.4-3.6 s | honking from 0.5 to 3.3 s (transcribed "[geese honking]"). Crosses from one side to the other, like the passing train. -28 LUFS |
| life-call | not used | a boatman's wordless call across the water: transcribed "[howling]". Heard as a dog or a wolf, it would be wrong over the canal. Bought, not used |
| life-hammer (rail) | life-hammer-1, 0.2-3.6 s | a steam hammer: five heavy blows over 3 s. Knocks: no dehum. -27 LUFS |
| life-steam (rail) | life-steam-1, 0.2-4.4 s | a safety valve blowing off, held 2.8 s, dying away by 4.2 s. -28 LUFS |

All are cut under 90 Hz and over 6 kHz (the bell 5 kHz), mono, the
textures rid of the 200 Hz comb.

### music-rail-iii

A parlour waltz in 3/4 (A major, 88 bpm): harmonium, clarinet, cello and
square piano (`RAIL_III` in `generate.py`), unlike the march and the
ostinato. One 100 s take, 1 375 credits. -12.6 LUFS, LRA 4.0, a dip of 5 to
6 dB every 22 s (the phrases' breaths), its own last chord dying from 96 s,
silent from 99.2 s. Served whole to 99.3 s, faded over the last 3 s, rid
of the comb, nothing under 45 Hz, a plain gain of -7.4 dB to -20 LUFS (peak
-7.4 dBFS). The rail's playlist now has three tunes.

### The voices: a first try, read plainly (not served)

Thirty-one lines, read by six voices of the shared library chosen for their
regional English (a south-east Lancashire old man, a broad Lancashire
boatman, a young Midlands man, a young northern woman, a Leeds landlady, a
West Midlands woman), with `eleven_multilingual_v2`. Nothing can be judged
here by ear, so every take was put through the speech-to-text model
(`scribe_v1`) and compared with its line: 23 came back word for word, three
more only by the accent ("Passes the lamp" for "Pass us the lamp",
"Broomagem", "sut" for "soot"), five were wrong and taken again or
reworded ("Ale's on me" heard as "Ali", then "All eyes on me"; "Good seam"
as "sim", then "scene"). 547 credits. The owner then asked for characters
instead, played broad: these takes stay in `raw/` (`voice-*`), unused.

### The townsfolk: the character sheet

Seven people who come back, each with a trade, a town and a comic turn.
Each voice was drawn by the voice-design model from a description (in
`generate.py`, `CHARACTERS`) saying a sample of their lines, three drafts
at a time; the draft kept is the one whose transcription matched the sample
and whose delivery was the most animated, measured as the widest loudness
range (LRA).

| character | trade, town | turn | lines | draft kept |
|---|---|---|---|---|
| Ezra Platt | old collier come down from Wigan; Cannock | the moaner: his knees, the price of coal, the railways, "in my day" | 6 | 1 of 3 (LRA 5.6 against 2.5 and 3.2; all three word for word) |
| Barnaby Tuck | boatman on the Trent and Mersey; Stone | cheery, sweet on his horse Bess | 6 | 1 (LRA 12.0 with a laugh, against 3.8 and 5.1) |
| Nellie Hartley | mill girl at the Belper mills | the gossip: gasps, whispers, giggles | 6 | 3 (LRA 6.4, the questions said as questions; 1 and 2 flat, 2.7 and 2.0) |
| Mrs Hepzibah Blewitt | landlady of the Swan; Burton | proud of her brew, and tasting it: hiccups | 5 | 1 (LRA 6.7 against 2.5 and 5.3) |
| Mr Josiah Pomfrey | overseer of a button works; Birmingham | pompous, clears his throat, splutters | 5 | 1 (LRA 2.9, the widest of three narrow ones) |
| Kezia Dunn | potter's wife; Stoke (Burslem) | dry, tuts, calls everyone "duck" | 5 | 3 (1 split "Kiln came out. Lovely", 2 said "Keown") |
| Tom Bellows | puddler at the iron works; Dudley | half deaf from the hammers: shouts everything, "What?" | 5 | 2 (tied with 1 at LRA 4.5; the louder of the two, -17.4 against -21.9 LUFS at the same settings: he is the shouter) |

Their lines are short (2 to 9 words), grumbling, pleased or neither, some
about a trade (said only where it is built, or when coal or iron is dear),
some of one era only (the towpath in the canal, the engines and the soot in
the rail). The full list, with the stage directions (`[grumbling]`,
`[hiccups]`, `[shouting]`...), is `VOICES` in `generate.py`; the same lines
without them are `LINES` in `app/src/gl/voices.ts`, and a test holds the
two together.

Said by `eleven_v3` at its loosest setting ('Creative', stability 0), each
take put through the speech-to-text model as before: 36 of 38 word for word
at the first take, the stage directions heard as such ("[laughs]",
"[sighs]", "[gasps]", "[clears throat]", "[hiccups]"). Ezra's timing came
of itself: a second's pause before "Almost." and before "We had mud."

| line | takes | why |
|---|---|---|
| bark-barnaby-rope | 2 kept | take 1 "Morn the rope", take 2 "Mind the road": "Mind" now right, one consonant off, and the bubble shows the word |
| bark-hepzibah-finest | 3 kept, reworded | "Finest ale" came out "Finest iron" twice in her broad vowels (as "ale" failed the first try's boatman): take 3 boasts of her "brew", word for word with its hiccup |
| bark-kezia-price | 1 | an "Oh," of her own before the line, from the `[tuts]`: kept |
| bark-hepzibah-soot | 1 | "I ask ya" for "I ask you": the accent, kept |
| the others | 1 | word for word |

993 credits for the 41 takes, 1 265 for the seven designs.

The lines are levelled like the houses: the breath before and after cut,
nothing under 110 Hz (a close microphone's chest) nor over 7 kHz, one early
reflection 30 ms off at -16 dB (a wall across the street), mono, -22 LUFS
with the peak held at -3 dBFS (Ezra's "Almost" and "Good coal" stop at
-24.6 and -22.2 on their peak). No dehum: the speech model has no 200 Hz
comb (in Ezra's pause, lifted 10 dB, the floor is -65 dBFS and 400 Hz stands
7 dB under its neighbour at 450 Hz). 38 lines, 2 to 5 s each, about 30 kB
each.

## The sixth round: the canal's tunes written through

The owner: the canal's music sometimes goes round in a loop too much; is
there no program to check whether it is pleasant to the ear?

### The judge (judge.py)

`judge.py` runs in its own environment (`.venv`, git-ignored, 1.3 GB:
numpy, scipy, librosa, soundfile, pyloudnorm, torch for the CPU and Meta's
`audiobox_aesthetics`; the listener model's 400 MB of weights come from
Hugging Face on the first run). It reads the served files, and each tune
also as the game plays it (a loop its turns over, read from playlist.ts),
and writes a table and `judge/<name>.json`. Two runs on the same files
give the same file. What it measures, in short (the docstring has it all):

- **repetition.** A chroma (harmony) and MFCC (timbre) vector a beat, each
  dimension standardised over the tune, 4 s of beats laid end to end and
  compared with every earlier 4 s. Two passages at a cosine of 0.70 or
  more are the same music: 0.70 was set on music-canal, whose loop is one
  phrase of eight bars played four times. From that: the share of the
  timeline that repeats something heard before, the longest stretch heard
  again beat for beat, how often the most repeated phrase comes, and a
  loopiness from 0 to 100 (the mean of the three, each capped: the share,
  the stretch over 60 s, the count less one over 7).
- **form.** A novelty curve over the beats (a checkerboard kernel along the
  self-similarity), its peaks at least 12 s apart: the sections and their
  lengths. It cuts finely (sections of 12 to 25 s) and is read as a hint.
- **level.** Integrated loudness and loudness range (ffmpeg's EBU R128
  meter, pyloudnorm as a check), peak and crest, the balance of five
  bands, the model's 200 Hz comb (how far each multiple stands over its
  neighbours, the median over 400 Hz to 5 kHz), holes (a second or more
  25 dB under the tune's median: the piece seeming to stop), and at a loop
  point the sample step over the 99th percentile of the steps.
- **the listener.** Audiobox Aesthetics, a model trained on people's
  ratings, scores each 10 s from 1 to 10: CE (content enjoyment), CU
  (content usefulness), PC (production complexity), PQ (production
  quality). The windows are laid evenly from the first sample to the last
  (a scrap of last chord padded with silence scored 3.8 and dragged the
  means down by 0.1). On one steady tune its windows spread by 0.1 to 0.2:
  a difference under 0.1 between two tunes means nothing.

### Before (judge/baseline.json)

| tune | length | loopiness | share repeated | longest repeat | most repeated phrase | LRA | CE | PQ |
|---|---|---|---|---|---|---|---|---|
| music-canal (the loop file) | 68.5 s | 43.2 | 0.62 | 15 s | 4 times | 1.5 | 7.73 | 7.90 |
| **music-canal as heard (twice)** | 137.1 s | **93.7** | 0.81 | **69 s** | **8 times** | 1.5 | 7.72 | 7.89 |
| music-canal-ii | 97.5 s | 31.0 | 0.28 | 13 s | 4 | 8.0 | 7.41 | 7.94 |
| music-canal-iii | 99.3 s | 77.6 | 0.64 | 41 s | 8 | 3.9 | 7.78 | 8.30 |
| music-rail-i | 98.3 s | 69.9 | 0.69 | 25 s | 10 | 2.4 | 5.82 | 7.08 |
| music-rail-ii | 98.7 s | 29.0 | 0.28 | 10 s | 4 | 3.2 | 7.44 | 7.85 |
| music-rail-iii | 99.3 s | 74.6 | 0.71 | 57 s | 5 | 4.0 | 7.43 | 7.17 |

Where the repeats lie (the nearest earlier match): music-canal 17 and 34 s
back (its phrase, again and again); the jig and the march within 20 s (each
strain played twice running); rail-iii 20 to 30 s back.

### The pieces asked

Each is one piece of 165 s asked in five sections: an introduction, an
air, a middle in another key with other players, the air come back varied
on other instruments, a coda. The first two were sent as composition plans
(`chunks`, each with its own styles and length; `PLANS` in generate.py),
the next three as a prompt telling the same form in words (`CANAL_IV`,
`CANAL_V`, `CANAL_VI`), after iv-1 and v-1 came back with a production
quality under the prompted takes. Palette: fiddle, wooden flute, English
concertina, pedal harp, square piano, cello; no drums, no voice, nothing
modern. One take judged before the next was bought.

| take | asked as | counter before / after | length | loopiness | CE | PQ | LRA | what the judge shows | kept |
|---|---|---|---|---|---|---|---|---|---|
| music-canal-iv-1 | plan, D major 6/8 | 19 504 / 21 773 | 158.1 s | 27.5 | 7.49 | 7.73 | 6.9 | the middle dies to -49 dB over 6 s before the air comes back at full (a hole at 99.8 s); the lone harp introduction and the coda score 6.6 to 7.0 | no |
| music-canal-v-1 | plan, F major 4/4 | 21 773 / 24 042 | 162.8 s | 64.9 | 7.65 | 7.78 | 5.3 | each strain of the air played twice running (20 to 30 s back), and the air come back whole after the middle | **yes** |
| music-canal-vi-1 | prompt, A dorian 3/4 | 24 042 / 26 311 | 161.8 s | 57.4 | 7.66 | 8.17 | 7.6 | the strains twice running (under 20 s back); a steady tone at 87 Hz from 30 s (see below) | **yes** |
| music-canal-iv-2 | prompt, D major 6/8 | 26 311 / 28 580 | 163.4 s | 30.6 | 7.66 | 7.84 | 14.6 | an introduction 10 dB under the body, with a hole in it (12.8 s), the air's return from 124 s 6 dB over it | **yes**, its gain ridden |
| music-canal-v-2 | prompt, F major 4/4 | 28 580 / 30 849 | 162.9 s | 70.9 | 7.68 | 7.88 | 7.0 | the air's two strains each twice (AABB), then the whole again: a 38 s stretch heard again | no |

(`judge/takes.json`: each take cut and levelled as it would be served;
`judge/takes-raw.json`: the raw takes.)

### The gate, and what came through it

As set for this round: loopiness clearly under music-canal as heard
(read as at most half of it, 47); content enjoyment and production
quality at least those of the best canal tune (the jig: 7.78 and 8.30); no
comb after dehum; a sensible loudness range (3 to 10 LU); no hole.

No take passes all of it. iv passes the repetition; v and vi do not (57
and 65: a folk air's strains played twice running, but no longer one
phrase for two minutes). None reaches the jig's production quality, 8.30:
it is the densest tune of all, and the calm, sparser pieces score 7.7 to
8.2 on it, their introductions and codas lowest. The comb passes: 1.8 to
4.7 dB over the neighbours in the raw takes, -6.0 to -6.3 served. The
loudness range passes once iv-2's gain is ridden.

What is served is therefore a judgement over the takes bought, not a
pass: the three new pieces keep the listener's scores of the tunes they
replace, and repeat far less.

| the canal's music | tunes | minutes | loopiness (mean over time) | longest repeat | most repeated phrase | CE | PQ |
|---|---|---|---|---|---|---|---|
| before (music-canal twice, ii, iii) | 3 | 5.6 | 70.6 | 69 s | 8 times in 137 s | 7.65 | 8.03 |
| after (iv, v, vi) | 3 | 8.1 | 51.2 | 25 s | 3 to 8 times in 163 s | 7.65 | 7.91 |

ii (loopiness 31, CE 7.41) and iii (77.6) fail the gate and are retired
with music-canal; ii is the one that could come back as a fourth piece (a
line in playlist.ts, and out of `RETIRED` in process.py) should the owner
want more variety.

### Processing

Each piece as the other tunes: from its first note to the end of its own
last chord, rid of the comb (`dehum`), nothing under 45 Hz, faded in over
0.3 s and out over 1.5 s, a plain gain to -20 LUFS (peaks -4.8 to -7.5
dBFS). Two takes needed more:

- **iv-2**: its introduction (0-28 s) sits 10 dB under its body, and the
  air's return from 124 s 6 dB over it. A slow ride of the gain, +5 dB to
  24 s and -5 dB from 126 s with 4 s ramps: loudness range 14.6 to 8.8 LU,
  no hole left, the listener's scores unchanged (7.67, 7.82).
- **vi-1**: the band under 90 Hz held -8 dB of the whole (the others -29
  to -47). From 30 s to its last chord a steady tone at 87 Hz (85-89 Hz),
  -25 dBFS, 27 dB over the bass around it, unmoved through the change to
  C major: a drone of the model's, not a player. Two notches 6 Hz wide
  take it down 25 dB (the strongest line left between 60 and 120 Hz
  stands 10 dB over the bass); the band under 90 Hz is now -19 dB. Scores
  after: loopiness 56.9, CE 7.62, PQ 8.14, LRA 7.2.

WebM 2.3 MB each, MP3 2.8 to 2.9 MB (the canal's three were 3.9 MB of
WebM in all, now 6.9), fetched only in the pause before a tune is due.

### How they are played

`TUNES.canal` is the three new pieces, each played once through; no tune
is looped any more, and the loop's machinery (`loop`, `turns`,
`tuneLength`, the fade of a loop's last bars) is gone from playlist.ts and
sfx.ts. The rules stand: never the tune just heard, the ambience alone
for 45 to 150 s between two. The pauses were left as they were: the
pieces are longer, so music now fills about 62 % of the canal era (53 %
before) and each piece is heard about 4.6 times an hour, once through,
where the old air's phrase came 8 times in a row every time it played.

### The rail: judged, not asked again

- **music-rail-i**, the brass band's march, is the weakest tune of the six
  by far: content enjoyment 5.82 (1.6 under every other), production
  complexity 1.68, production quality 7.08, and a phrase heard 10 times in
  98 s (loopiness 70). It is the one to replace, written through as the
  canal's were (a prompt with the form told in words, 150-165 s: about
  2 300 credits).
- **music-rail-iii**, the waltz: loopiness 74.6, its first half heard again
  almost whole (a 57 s stretch), production quality 7.17. Next after rail-i.
- **music-rail-ii**: loopiness 29.0, 7.44 / 7.85: fine.

Neither was asked again: 1 151 credits were left under the round's cap,
under the price of one take.

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

## The card taken up

The owner asked for a better sound when a card is chosen from the hand.
card-1 was asked as a card laid on a table: a soft swish of 0.45 s,
broadband and even, heard as a breath; lifted by 13 dB to -27 LUFS it stood
over the brass latch. Takes 2 and 3 ask for a pasteboard card drawn out of
the hand and lifted (0.5 s each, 12 credits for the two).

| take | what the spectrum and the envelope show |
|---|---|
| card-2 (kept) | 0–0.145 s a quiet slide (-33 dB RMS, 2–11 kHz), then at 0.150 s one clean tick of stiff card (peak -1.3 dBFS, partials at 1.5–3 kHz) falling 45 dB in 40 ms; a second, smaller tick at 0.33 s |
| card-3 | four small knocks spread over 0.33 s under a slide: busier, no single attack |

Cut to 0.04–0.22 s: 110 ms of the slide, faded in over 15 ms, leading into
the tick and its decay; the second tick is left out. The slide's hiss is
softened above 7 kHz. No 200 Hz comb in it (every multiple within 3.5 dB of
its neighbours), so no dehum, which would leave a tail on the tick. It is
heard at full level on every card taken up, so it is levelled well under
the latch (click at 0.45 comes to -34 LUFS): asked -36 LUFS with the peak
held at -12 dBFS, it comes to -40 LUFS, 0.15 s long.

## The canal's tune

Retired in the sixth round (above): heard twice over, its one phrase came
eight times in a row. Kept here for the record.

Asked of the music model (prompt in `generate.py`, `TUNE`): an English
country dance air of the late eighteenth century, a gavotte or Playford
tune, baroque violin, wooden flute, harp, fortepiano and bassoon, major,
about 84 bpm, the same even mood throughout, no drums, no voice, nothing
modern or epic. A 12 s probe first, to learn the price, then two 100 s
takes.

| take | what the spectrum and the waveform show |
|---|---|
| music-canal-1 | -12.4 LUFS, LRA 1.9 LU: a dense, pressed wall; a thin 12 s introduction, then chords changing every 0.75 s under a busy line of short notes. Too full and too loud to sit under a table for an hour |
| music-canal-2 (kept) | -27.8 LUFS, LRA 3.6 LU: a 17 s introduction (bass and harp), then a held melody with vibrato (violin, flute) over plucked chords every 2.14 s (a bar of three at 84 bpm), long notes and space between them; steady to 95 s, then a fade |

Take 2's air is a phrase of eight bars (17.14 s) played round and round:
its chroma is 0.92–0.95 alike at 17.14, 34.28, 51.42 and 68.56 s apart.
The loop is four phrases, cut from 21.92 s, where the same place four
phrases later (90.48 s) matches it best: 0.976 over 6 s. The end point is
then set to the sample by laying two seconds of each over the other (25 ms
earlier: the loop runs 68.5346 s). Their correlation there is 0.46, so the
fold's sine and cosine curves are scaled to keep the power of the sum for
that correlation (neither a swell nor a dip in the middle of the fold).

The model's 200 Hz comb is in the music too: over the take's fade, every
multiple of 200 Hz stands 13 to 31 dB over its neighbours; in the tune at
40 s, 10 to 20 dB at 800 Hz–5 kHz. It is taken out with `dehum` before the
fold. Nothing under 40 Hz is kept. A plain gain of +7.4 dB brings it to
-20 LUFS, the peak at -8.3 dBFS; no compressor.

Checked in headless Chrome: both files decode to 68.5346 s, 48 kHz stereo.
Played in a loop across the seam, the 10 ms windows either side read -30.0
to -31.7 dB RMS; the sample step at the seam is 0.0096 in the WebM (the
99th percentile of the steps is 0.015), 0.018 in the MP3 (the encoder's
frame edge; its largest step inside the music is 0.025).

Served as `music-canal.webm` (Opus 96 kb/s, 1.1 MB) and `music-canal.mp3`
(1.2 MB). Fetched only when the tune is wanted, not with the short sounds.

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

## How they are played (app/src/gl/sfx.ts, app/src/gl/playlist.ts)

- The tunes: on a fourth bus, `music`, with its own switch and level in the
  board settings (on, at 0.5, by default). Bus scale 0.18: at the default
  levels a tune sits about -41 LUFS against the canal ambience's -38.
  Each era has its playlist (`TUNES` in playlist.ts): the canal three, the
  rail three. They play while a game is in the action phase of an era
  (`tuneWanted` in useTableSounds.ts gives the era): the first tune 4 to
  10 s after the era opens, then each tune heard through once (the canal's
  about 163 s, the rail's 98 s or so), then the ambience
  alone for 45 to 150 s, then another, never the one just heard. Pauses
  and choices are drawn by `spanOf` and `nextOf`, pure functions tested
  with a seeded chance. A tune comes in over 5 s, fades out over 4 s when
  the canal era closes (the whistle is then heard alone) and at the end of
  the game, and within 1 s when its switch or the board's sound switch is
  shut. Nothing before the reader's first gesture on the page.
- Each era's life: while the era's ambience plays, one of its events (the
  canal's five, the rail's six) every 40 to 120 s (drawn afresh after
  each), never two at once, never the same twice running, on the ambience
  bus, panned to one side at random; the passing train and the geese cross
  from that side to the other. The rail's play at 1.4 (its bed at 1.2), the
  canal's at 2 (its birds at 1.4 and -22 LUFS leave the middle band free).
  A moment of the game (the bell of a turn, the era's whistle, the band)
  hushes it: an event already sounding fades out in 0.3 s, and none begins
  until 3 s after the moment has ended. When the era turns, the canal's
  event goes with its ambience.
- The townsfolk (`app/src/gl/voices.ts`, sfx.ts, `VoiceBubble.tsx`): while an
  era is played on the Midlands board, with the Voices switch on (the
  board settings, on by default), a line every 60 to 180 s, one at a time,
  never over a moment (it waits, and one speaking fades out), never the
  line just heard. What the game did picks it: a works that paid off (its
  tile turned) is answered by a pleased line about that trade in its town
  (Kezia's kiln at a pottery, Tom's furnace at an iron works); coal or iron
  bought dear (£4 and up for coal, £3 for iron) or a market emptied, by a
  grumble in the buyer's town; a works built, a little less. Such a stir is
  answered 3 to 8 s after it, but never sooner than a minute after the last
  voice, and is kept two minutes. Otherwise anyone, anywhere a works
  stands: pleased, grumbling or neither, half the time in the speaker's
  own town. On the ambience's bus at 3.2: about -31 LUFS at the levels the
  settings open on, a piece laid coming to -27 and the canal's birds to
  -38. Panned by the town's place on the board, west to the left.
- The bubble: cream paper over the town's cluster of tiles, the speaker's
  name and trade in small capitals over the line in italics, English in
  every language; up while the voice speaks and 1.5 s after, faded in and
  out, the pointer passing through it, under the HUD. A town near the top
  of the frame hangs its bubble below it instead. Checked in headless
  Chrome at 1440x900: Tom at Dudley, Nellie at Belper (below), the bubble
  gone 1.2 to 1.9 s after the voice.

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
    python3 tools/assets/sfx/generate.py music-canal  # the tune: only when named
    python3 tools/assets/sfx/generate.py music-rail-i music-rail-ii  # likewise
    python3 tools/assets/sfx/generate.py --design ezra   # three drafts of a voice
    python3 tools/assets/sfx/generate.py --keep ezra 1   # the draft kept, as a voice
    python3 tools/assets/sfx/generate.py bark-ezra-dear  # a line (the characters' voices)
    python3 tools/assets/sfx/generate.py music-canal-iv  # a canal piece: take 1 a plan, take 2 a prompt
    TMPDIR=/tmp python3 tools/assets/sfx/process.py      # every sound but the retired tunes

The judge's environment, once (CPU-only torch first, to keep it small):

    uv venv tools/assets/sfx/.venv
    uv pip install --python tools/assets/sfx/.venv/bin/python torch torchaudio --index-url https://download.pytorch.org/whl/cpu
    uv pip install --python tools/assets/sfx/.venv/bin/python numpy scipy librosa soundfile pyloudnorm audiobox_aesthetics
    tools/assets/sfx/.venv/bin/python tools/assets/sfx/judge.py                 # every tune served (judge/all.json)
    tools/assets/sfx/.venv/bin/python tools/assets/sfx/judge.py raw/music-canal-iv-2.mp3 --out take

**Kept after all:** music-canal-ii stays in the canal playlist as a fourth piece. Its loopiness (31.0) is among the lowest of all tunes, and a fourth piece spreads the rotation further, so the ear meets each air less often. It is out of `RETIRED` in `process.py`.
