#!/usr/bin/env python3
"""The table's sounds, asked of the ElevenLabs sound-effects model.

    tools/assets/sfx/generate.py            # every take not yet on disk
    tools/assets/sfx/generate.py turn stamp # only these sounds
    tools/assets/sfx/generate.py --dry      # the plan and its cost, no call
    tools/assets/sfx/generate.py music-canal # the canal's tune (music model)
    tools/assets/sfx/generate.py music-rail-i # a rail tune (music model)
    tools/assets/sfx/generate.py --design ezra  # three drafts of a character's voice
    tools/assets/sfx/generate.py --keep ezra 1  # the draft kept, made a voice
    tools/assets/sfx/generate.py bark-ezra-dear # a line said (speech model)

The key is read from .env.local (ELEVENLABS) and never printed. Every raw
take lands in tools/assets/sfx/raw/<name>-<n>.mp3 and is never asked for
again: running the script twice spends nothing the second time. Before each
call the account's counter is read, and nothing more is asked once a call
would carry it past CEILING — the owner's hard cap for this round.

The music (MUSIC below) is asked of the music model instead, one take per
call, and is only generated when named: a take of it runs a minute or two
and costs over a thousand credits.

The voices (VOICES below) are lines said by the people of the towns,
characters whose voices were drawn by the voice-design model (CHARACTERS)
and who speak with the expressive speech model and its stage directions:
a take costs about one credit a character.

The takes are then trimmed, levelled and served by process.py; the choice
between two takes is written down in CHOIX.md.
"""
import json, os, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
RAW = os.path.join(HERE, 'raw')
LEDGER = os.path.join(HERE, 'ledger.jsonl')
API = 'https://api.elevenlabs.io/v1'

# the owner's hard cap for the fifth round (the canal's life, the voices, a
# third rail tune) is 42 500 on the counter, 14 814 when it was begun; 5 000
# of it is kept in reserve. It was 16 000 for the fourth round (the
# playlists, the rail's life), 22 500 before
CEILING = 37_500
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
    # the rail's life, two more: an iron works and an engine standing
    'life-hammer': (6.0, 1, 0.5, False, 'a heavy steam hammer in an iron foundry heard from across a town, a few slow deep thuds of the hammer falling on hot iron with a hiss of steam between them, distant, outdoors, no voices, ' + ERA),
    'life-steam': (5.0, 1, 0.5, False, 'a steam locomotive standing at a small distant station, its safety valve blowing off steam in a long soft roar that dies away, a few drips and a slow hiss, outdoors, far off, no whistle, no voices, ' + ERA),
    # the canal's life: now and then, over its birds, the working waterway
    'life-horse': (7.0, 1, 0.5, False, 'a single heavy horse walking slowly along a gravel canal towpath towing a boat, steady hooves on gravel, a harness jingling, a tow rope creaking, passing at a short distance, calm, outdoors, no voices, ' + ERA),
    'life-lock': (7.0, 1, 0.5, False, 'the heavy wooden gates of a canal lock being pushed open with a long deep creak, then water rushing and gurgling through the sluice paddles, heard from a little distance, outdoors, no voices, ' + ERA),
    'life-forge': (5.0, 1, 0.55, False, 'a village blacksmith at his forge heard from across a field: a few ringing hammer blows on the anvil, a pause, then two more, distant, outdoors, soft, no voices, ' + ERA),
    'life-bell': (7.0, 1, 0.55, False, 'a single old church bell tolling slowly three times far away across the countryside, each stroke ringing out and fading, soft, outdoors, no voices, ' + ERA),
    'life-geese': (5.0, 1, 0.5, False, 'a small skein of wild geese flying over open fields honking, coming and going, a little distance away, outdoors, calm, no voices, ' + ERA),
    'life-call': (4.0, 1, 0.5, False, 'a boatman on a canal calling out once to the lock keeper far away across the water, a long wordless shout that echoes softly, then a distant answering call, outdoors, faint, ' + ERA),
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

RAIL_III = ('an instrumental slow waltz of the 1840s in 3/4, around 88 bpm, A major, '
            'played by a small parlour group: a reed harmonium holding warm soft chords, a clarinet in C singing the tune, '
            'a cello answering it in the lower register and a square piano marking the waltz lightly; '
            'pensive, warm and hopeful, an evening in a new railway town; ' + PERIOD)

# name: (seconds, takes, prompt) — asked of the music model, only when named
MUSIC = {
    # a short take first, to measure what a second of music costs
    'music-probe': (12.0, 1, TUNE),
    'music-canal': (100.0, 2, TUNE),
    'music-canal-ii': (100.0, 1, CANAL_II),
    'music-canal-iii': (100.0, 1, CANAL_III),
    'music-rail-i': (100.0, 1, RAIL_I),
    'music-rail-ii': (100.0, 1, RAIL_II),
    'music-rail-iii': (100.0, 1, RAIL_III),
}

# the first try (not served): lines read plainly by six voices of the shared library, chosen for
# their regional English (a voice of the library is added to the account's
# own before it can be asked for). name: (library voice, owner)
FIRST_CAST = {
    # an old mill hand from a south-east Lancashire mill town
    'old': ('sAxd8ffzrizgUQNI8nre', 'aa287c0ed5b8ceb4c141d650e0399bc12d03f79bd8948fe92701f6f74b0f2f8d'),
    # a boatman, broad Lancashire
    'boatman': ('CykdO0j5SUxVoZ4PxHhQ', '45a8217ea2b32295c18ba4fd1d7a47a6c16d3b7a38128ef08bb490facad54ab0'),
    # a young man of the Midlands, an apprentice or a navvy
    'lad': ('JxfH70f7jvYhi0DKD8Xs', '27f08375e1d0b3055a43ce3785abef90578df6457223ad19204a4ddbdcfef291'),
    # a young woman of the north, a mill girl
    'lass': ('Q7iNt6VsGSsBbtyUto9N', 'fdbbdbc564ac6ccdf990d6f851f9984c623f98bbcd1e094ee65488812c7f8213'),
    # a publican's wife, Leeds, working-class
    'wife': ('LOE6OtKY65AfLLoge1Eb', '1814f2922a248bd840e0e9343833ef0c134ee95ad439d2c487ade04f9c45b96f'),
    # a woman of the West Midlands, a potter's or a nailer's wife
    'nailer': ('MDvK7PyhP5PPTV22yvup', '25f16dfcc8cd9b4b405aabd41203f175c389163b036c1ac35e0ef893847b6263'),
}
# the first try's model and settings: eleven_multilingual_v2, stability
# 0.4, similarity 0.8, style 0.25, speaker boost

# the characters' voices, drawn by design() and kept by keep() (the drafts
# kept are in CHOIX.md)
CAST = {
    'ezra': 'APxYqX792oh6bxKz71Kx',
    'barnaby': 'mnnkshxqfXufFVQ2l10f',
    'nellie': 'zhCOgOGThnDPFz0PvqLt',
    'hepzibah': 'Uu5mmHZbaPekrodyaxa9',
    'pomfrey': 'jsN8Q4XhK2sZgbZlViOV',
    'kezia': 'jKP1lgUHY26g39zNcccl',
    'tom': 'xhqGggrom7QlHFwtaqoc',
}
# the expressive model, played loose ('Creative', the least stable of its
# three settings): the barks are meant to be overdone
SPEECH_MODEL = 'eleven_v3'
SPEECH = {'stability': 0.0}

# name: (character, takes, line with its audio tags) — the same lines,
# without the tags, as LINES in app/src/gl/voices.ts (the bubble shows them)
VOICES = {
    # Ezra Platt, an old collier of Wigan: moans about everything
    'bark-ezra-dear': ('ezra', 1, "[grumbling] Coal's gone dear again. Criminal, that is."),
    'bark-ezra-knees': ('ezra', 1, '[groaning] Oh, me knees. Me poor knees.'),
    'bark-ezra-blowup': ('ezra', 1, "[muttering darkly] Railways. They'll all blow up, you'll see."),
    'bark-ezra-worse': ('ezra', 1, '[grudgingly] Well. Could be worse, I suppose.'),
    'bark-ezra-mud': ('ezra', 1, '[wistfully] In my day we had no coal. We had mud.'),
    'bark-ezra-almost': ('ezra', 1, '[wheezy chuckle] Good coal, that. Almost.'),
    # Barnaby Tuck, a boatman on the Trent and Mersey: cheery, sweet on his horse
    'bark-barnaby-wages': ('barnaby', 1, '[cheerfully] Wages on Friday, lads! [laughs]'),
    'bark-barnaby-bess': ('barnaby', 1, '[tenderly] Walk on, Bess, my beauty. Walk on.'),
    'bark-barnaby-lock': ('barnaby', 1, "[exasperated] Lock's jammed again! Blast it!"),
    'bark-barnaby-load': ('barnaby', 1, '[proudly] Full load, and early too! [laughs]'),
    'bark-barnaby-engines': ('barnaby', 1, "[indignant] Them engines? Bess could beat 'em!"),
    # take 1 said 'Morn the rope', take 2 'Mind the ro(a)d': the second kept
    'bark-barnaby-rope': ('barnaby', 2, '[bellowing] Mind the rope there!'),
    # Nellie Hartley, a mill girl of Bolton: the gossip
    'bark-nellie-overseer': ('nellie', 1, '[whispering] Ooh, did you hear about the overseer?'),
    'bark-nellie-vicar': ('nellie', 1, "[gasps] Never! With the vicar's wife?"),
    'bark-nellie-hands': ('nellie', 1, "[excited] Mill's taking on hands again!"),
    'bark-nellie-twelve': ('nellie', 1, '[sighs] Twelve hours, and for what?'),
    'bark-nellie-ribbon': ('nellie', 1, '[giggles] New ribbon for Sunday!'),
    'bark-nellie-fluff': ('nellie', 1, "[huffs] Me hair's all cotton fluff again."),
    # Mrs Hepzibah Blewitt, landlady of the Swan at Leeds: proud of her ale, and tasting it
    # 'ale' came out as 'iron' twice in her broad vowels: take 3 boasts of her brew
    'bark-hepzibah-finest': ('hepzibah', 3, '[proudly] Finest brew in the county, that is! [hiccups]'),
    'bark-hepzibah-pints': ('hepzibah', 1, '[laughing] Pints all round, my loves!'),
    'bark-hepzibah-watered': ('hepzibah', 1, "[outraged] Who's been watering me ale?"),
    'bark-hepzibah-testing': ('hepzibah', 1, "[hiccups] I'm only... testing the barrel."),
    'bark-hepzibah-soot': ('hepzibah', 1, '[indignant] Soot on me washing again! I ask you!'),
    # Mr Josiah Pomfrey, overseer of a Birmingham button works: pompous
    'bark-pomfrey-time': ('pomfrey', 1, '[clears throat] Time is money, gentlemen.'),
    'bark-pomfrey-london': ('pomfrey', 1, '[pompously] An order for London. Naturally.'),
    'bark-pomfrey-idle': ('pomfrey', 1, '[outraged] Idleness? In MY workshop?'),
    'bark-pomfrey-iron': ('pomfrey', 1, '[spluttering] No iron to be had? Preposterous!'),
    'bark-pomfrey-triumph': ('pomfrey', 1, '[smugly] Another triumph of British industry.'),
    # Kezia Dunn, a potter's wife of Burslem: dry, calls everyone duck
    'bark-kezia-kiln': ('kezia', 1, '[delighted] Kiln came out lovely, duck!'),
    'bark-kezia-bread': ('kezia', 1, '[warmly] Bread on the table tonight.'),
    'bark-kezia-price': ('kezia', 1, '[tuts] Price of bread, honestly.'),
    'bark-kezia-coal': ('kezia', 1, '[sighs] Not a lump of coal left in the town!'),
    'bark-kezia-kettle': ('kezia', 1, '[laughs] Put the kettle on, duck.'),
    # Tom Bellows, a puddler at a Dudley iron works: deaf from the hammers, shouts
    'bark-tom-furnace': ('tom', 1, '[shouting] Furnace is roaring today!'),
    'bark-tom-what': ('tom', 1, "[shouting] What? Can't hear you!"),
    'bark-tom-dear': ('tom', 1, "[shouting] Iron's dear as silver now!"),
    'bark-tom-sweet': ('tom', 1, '[shouting happily] She runs sweet, this engine!'),
    'bark-tom-late': ('tom', 1, "[shouting] Train's late again! What?"),
}
# the fifth round's second thought: the owner wanted the townsfolk played,
# not read — barks, as in a city builder: short, broad, funny. Seven
# characters who come back, each drawn by the voice-design model (v3) from
# a description, then made to speak with the expressive model and its
# audio tags. who: (description, sample said by the three drafts)
CHARACTERS = {
    'ezra': ('An old Lancashire coal miner in his seventies, broad Wigan accent, wheezy and gravelly from the pit, a born grumbler who moans about everything with comic self-pity; 1830s working man, theatrical and funny, like a character actor in a period comedy.',
             "Coal's gone dear again. Criminal, that is. And me knees! Oh, me poor knees. In my day we had no coal at all, we had mud, and we were grateful for it. Railways? Mark my words, they'll all blow up."),
    'barnaby': ('A jolly canal bargeman in his forties from Lancashire, broad northern accent, big hearty laugh, loud and warm, forever cheerful, talks to his towing horse as if she were his sweetheart; theatrical and funny, like a character actor in a period comedy.',
                "Wages on Friday, lads! Walk on, Bess, my beauty, walk on! Mind the rope there! Oh, lock's jammed again, blast it. Never mind, full load and early too, ha ha!"),
    'nellie': ('A young cotton mill girl of about eighteen from Bolton in Lancashire, quick chatty northern accent, bright and cheeky, an irrepressible gossip who gasps and giggles, always whispering the latest scandal; theatrical and funny, like a character actress in a period comedy.',
               "Ooh, did you hear about the overseer? Never! With the vicar's wife? Mill's taking on hands again, and I've a new ribbon for Sunday! Twelve hours, though, and for what?"),
    'hepzibah': ('A plump, boisterous landlady of a Yorkshire coaching inn in her fifties, rich Leeds accent, proud and boastful of her own ale, a little tipsy from tasting it, with a throaty laugh and the odd hiccup; theatrical and funny, like a character actress in a period comedy.',
                 "Finest ale in the county, that is! Pints all round, my loves! Now who's watered me ale? I'm only testing the barrel, mind. Soot on me washing again, I ask you!"),
    'pomfrey': ('A pompous, portly factory overseer in his fifties from Birmingham, self-important and fussy, puffed-up would-be gentleman with a faint Midlands accent under his put-on grandeur, clears his throat a lot and splutters when outraged; theatrical and funny, like a character actor in a period comedy.',
                "Ahem. Time is money, gentlemen. An order for London, naturally! Idleness? In my workshop? Preposterous! No iron to be had? Another triumph of British industry, I think you'll find."),
    'kezia': ('A potter\'s wife in her forties from Burslem in the Staffordshire Potteries, warm broad Stoke accent, practical and dry-witted, calls everyone duck, tuts and sighs at the world but laughs easily; theatrical and funny, like a character actress in a period comedy.',
              "Kiln came out lovely, duck! Bread on the table tonight. Price of bread, though, honestly. Not a lump of coal left in the whole town! Tsk. Put the kettle on, duck."),
    'tom': ('A young ironworks puddler of about twenty from the Black Country, strong Dudley accent, enormous booming voice, half deaf from the forge hammers so he shouts everything, cheerful and a bit daft; theatrical and funny, like a character actor in a period comedy.',
            "Furnace is roaring today! What? Can't hear you! Iron's dear as silver now! She runs sweet, this engine! Train's late again! What? Speak up!"),
}

# name: (voice, takes, line) — the first try's lines, read by FIRST_CAST
FIRST_VOICES = {
    # takes 1 and 2 said 'Good seam, that' as 'sim' and 'scene': take 3 says it plainer
    'voice-seam': ('old', 3, 'Good coal, this is.'),
    'voice-back': ('old', 1, "Me back's killing me."),
    'voice-grand': ('old', 1, 'Grand day for it.'),
    'voice-weather': ('old', 1, "Weather's turning, I reckon."),
    'voice-no-iron': ('old', 1, 'No iron to be had.'),
    'voice-wages': ('boatman', 1, 'Wages on Friday, lads!'),
    # 'Ale's on me' was heard as 'Ali' and 'All eyes on me', 'Ale all round'
    # as 'Are they all round': in this broad voice 'ale' will not come
    # through, so take 4 asks for pints
    'voice-ale': ('boatman', 4, 'Pints all round, lads!'),
    'voice-full-load': ('boatman', 1, 'Full load, and early too.'),
    'voice-lock': ('boatman', 1, "Lock's jammed again, blast it."),
    'voice-engines': ('boatman', 1, "Them engines'll have us out o' work."),
    'voice-walk-on': ('boatman', 1, 'Walk on, Bess. Walk on.'),
    'voice-london': ('lad', 1, "Order's off to London!"),
    'voice-furnace': ('lad', 1, 'Furnace is roaring today.'),
    'voice-iron-dear': ('lad', 1, "Iron's dear as silver now."),
    'voice-lamp': ('lad', 1, 'Pass us the lamp.'),
    'voice-late': ('lad', 1, "Train's late again."),
    'voice-sweet': ('lad', 1, 'She runs sweet, this engine.'),
    'voice-hands': ('lass', 1, "Mill's taking on hands again."),
    'voice-twelve': ('lass', 1, 'Twelve hours, and for what?'),
    # 'docked us' ran into 'doctors' twice: take 3 reworded
    'voice-docked': ('lass', 3, "Master's cut our pay again."),
    'voice-whistle': ('lass', 1, "There's the whistle. Shift's done."),
    'voice-ribbon': ('lass', 1, 'New ribbon for Sunday!'),
    'voice-brew': ('wife', 1, 'Fine brew, this.'),
    'voice-coal-dear': ('wife', 2, "Coal's gone dear again."),
    'voice-soot': ('wife', 2, 'Soot on the washing again.'),
    'voice-that-lad': ('wife', 1, "Where's that lad got to?"),
    'voice-kiln': ('nailer', 1, 'Kiln came out lovely.'),
    'voice-bread': ('nailer', 1, 'Bread on the table tonight.'),
    'voice-no-coal': ('nailer', 1, "Not a lump o' coal left."),
    'voice-bread-price': ('nailer', 1, "Price o' bread, honestly."),
    'voice-brummagem': ('nailer', 1, 'Another boat up from Brummagem.'),
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


def design(k: str, who: str) -> None:
    """Three voices drawn for a character by the voice-design model, each
    saying its sample; saved as raw/cast-<who>-<n>.mp3, their ids beside
    them in raw/cast-<who>.json. The one kept is made a voice of the
    account by keep()."""
    import base64
    desc, sample = CHARACTERS[who]
    body = {'voice_description': desc, 'model_id': 'eleven_ttv_v3', 'text': sample, 'auto_generate_text': False}
    req = urllib.request.Request(API + '/text-to-voice/design?output_format=mp3_44100_128', data=json.dumps(body).encode(),
                                 headers={'xi-api-key': k, 'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=180) as r:
        out = json.load(r)
    ids = []
    for n, pv in enumerate(out['previews'], 1):
        with open(os.path.join(RAW, f'cast-{who}-{n}.mp3'), 'wb') as f:
            f.write(base64.b64decode(pv['audio_base_64']))
        ids.append(pv['generated_voice_id'])
    with open(os.path.join(RAW, f'cast-{who}.json'), 'w') as f:
        json.dump({'ids': ids, 'text': out.get('text', sample)}, f, indent=1)


def keep(k: str, who: str, n: int) -> str:
    """The n-th drawn voice of a character, made a voice of the account."""
    with open(os.path.join(RAW, f'cast-{who}.json')) as f:
        ids = json.load(f)['ids']
    body = {'voice_name': f'Blackrail {who}', 'voice_description': CHARACTERS[who][0], 'generated_voice_id': ids[n - 1]}
    req = urllib.request.Request(API + '/text-to-voice', data=json.dumps(body).encode(),
                                 headers={'xi-api-key': k, 'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)['voice_id']


def in_library(k: str, voice: str, owner: str, name: str) -> None:
    """(The first try's cast.) A voice of the shared library, added to the account's own if it is
    not there yet (free: it takes a slot, not credits)."""
    req = urllib.request.Request(API + f'/voices/{voice}', headers={'xi-api-key': k})
    try:
        urllib.request.urlopen(req, timeout=30).read()
        return
    except urllib.error.HTTPError as e:
        if e.code not in (400, 404):
            raise
    body = {'new_name': f'Blackrail {name}'}
    req = urllib.request.Request(API + f'/voices/add/{owner}/{voice}', data=json.dumps(body).encode(),
                                 headers={'xi-api-key': k, 'Content-Type': 'application/json'}, method='POST')
    urllib.request.urlopen(req, timeout=30).read()


def speak(k: str, voice: str, text: str) -> bytes:
    """A line said by a character's voice, with the expressive model: the
    audio tags in square brackets are played, not read."""
    body = {'text': text, 'model_id': SPEECH_MODEL, 'voice_settings': SPEECH}
    req = urllib.request.Request(
        API + f'/text-to-speech/{voice}?output_format=mp3_44100_128',
        data=json.dumps(body).encode(),
        headers={'xi-api-key': k, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry' in sys.argv
    if '--design' in sys.argv or '--keep' in sys.argv:
        # generate.py --design ezra   /   generate.py --keep ezra 2
        k = key()
        before = counter(k)
        if max(before, before) + 3 * len(CHARACTERS[args[0]][1]) > CEILING:
            print(f'STOP before the design of {args[0]}: counter {before}')
            return
        if '--design' in sys.argv:
            design(k, args[0])
            done = f'cast-{args[0]} (three drafts)'
        else:
            print('voice', keep(k, args[0], int(args[1])))
            done = f'cast-{args[0]}: draft {args[1]} kept'
        time.sleep(20)
        after = counter(k)
        row = {'take': done, 'before': before, 'after': after, 'spent': after - before}
        with open(LEDGER, 'a') as f:
            f.write(json.dumps(row) + '\n')
        print(json.dumps(row))
        return
    names = args or list(PLAN)
    os.makedirs(RAW, exist_ok=True)
    k = '' if dry else key()
    start = None
    asked = 0
    for name in names:
        music = name in MUSIC
        voice = name in VOICES
        if voice:
            who, takes, text = VOICES[name]
            seconds, influence, loop = 0.0, 0.0, False
        elif music:
            seconds, takes, text = MUSIC[name]
            influence, loop = 0.0, False
        else:
            seconds, takes, influence, loop, text = PLAN[name]
        for n in range(1, takes + 1):
            out = os.path.join(RAW, f'{name}-{n}.mp3')
            if os.path.exists(out):
                continue
            # speech costs a credit a character
            estimate = len(text) if voice else int(seconds * (MUSIC_PER_SECOND if music else PER_SECOND) + 0.999)
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
                if voice:
                    audio = speak(k, CAST[who], text)
                else:
                    audio = compose(k, seconds, text) if music else ask(k, seconds, influence, loop, text)
            except urllib.error.HTTPError as e:
                print(f'{name}-{n}: HTTP {e.code} {e.read()[:300]!r}')
                return
            asked += estimate
            with open(out, 'wb') as f:
                f.write(audio)
            # the counter is read late: give it time to catch up (a line is
            # a few dozen credits: a short wait is enough to keep the ledger)
            time.sleep(4 if voice else 20)
            after = counter(k)
            row = {'take': f'{name}-{n}', 'seconds': seconds, 'before': before, 'after': after, 'spent': after - before}
            with open(LEDGER, 'a') as f:
                f.write(json.dumps(row) + '\n')
            print(json.dumps(row))


if __name__ == '__main__':
    main()
