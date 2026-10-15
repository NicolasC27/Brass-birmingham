import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* a Web Audio stand-in: enough of a context to tell which recordings
   sound, and when */
interface FakeSource {
  buffer: { url: string } | null;
  loop: boolean;
  started: boolean;
  startAt: number | null;
  stopAt: number | null;
  onended: (() => void) | null;
}

let sources: FakeSource[] = [];

class FakeContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume = () => Promise.resolve();
  close = () => Promise.resolve();
  /* the "decoded" recording remembers where it was fetched from */
  decodeAudioData = (bytes: ArrayBuffer & { url?: string }) => Promise.resolve({ duration: 2, url: bytes.url ?? '' });
  createGain() {
    const param = { value: 0.35, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {}, exponentialRampToValueAtTime() {} };
    return { gain: param, connect: (d: unknown) => d };
  }
  createBufferSource() {
    const node = {
      context: this,
      buffer: null,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      started: false,
      startAt: null as number | null,
      stopAt: null as number | null,
      onended: null as (() => void) | null,
      connect: (g: unknown) => g,
      start(t = 0) {
        node.started = true;
        node.startAt = t;
      },
      stop(t: number) {
        node.stopAt = t;
      },
    };
    sources.push(node);
    return node;
  }
}

const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
};
const sounding = () => sources.filter((s) => s.started && s.stopAt === null);
/** the recordings started, by the name of their file (house-oxford, stamp…) */
const played = () => sources.filter((s) => s.started).map((s) => s.buffer?.url.replace(/^\/sfx\/(.*)\.\w+$/, '$1'));

beforeEach(() => {
  sources = [];
  vi.resetModules();
  vi.stubGlobal('window', { AudioContext: FakeContext });
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('fetch', (url: string) => Promise.resolve({ ok: true, headers: { get: () => 'audio/mpeg' }, arrayBuffer: () => Promise.resolve(Object.assign(new ArrayBuffer(8), { url })) }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a house’s town under the pointer', () => {
  it('plays the house’s own recording, once, and not in a loop', async () => {
    const { houseHover } = await import('../sfx');
    houseHover('m-oxford');
    await settle();
    expect(played()).toEqual(['house-oxford']);
    expect(sources[0].loop).toBe(false);
    /* heard to its end with the pointer still there: quiet, not again */
    sources[0].onended?.();
    await settle();
    expect(played()).toEqual(['house-oxford']);
    /* another house is its own town */
    houseHover('m-gloucester');
    await settle();
    expect(played()).toEqual(['house-oxford', 'house-gloucester']);
  });

  it('coming back during the fade never lays a second loop over the first', async () => {
    const { houseHover } = await import('../sfx');
    houseHover('m-shrewsbury');
    await settle();
    expect(sounding()).toHaveLength(1);

    /* the pointer leaves, and comes back before the fade is over */
    houseHover(null);
    houseHover('m-shrewsbury');
    await settle();
    expect(sources.filter((s) => s.started)).toHaveLength(1);

    /* the old loop ends: the house sounds again, once */
    sources[0].onended?.();
    await settle();
    expect(sources.filter((s) => s.started)).toHaveLength(2);
    expect(sounding()).toHaveLength(1);
  });

  it('a loop that ends with the pointer gone stays quiet', async () => {
    const { houseHover } = await import('../sfx');
    houseHover('m-warrington');
    await settle();
    houseHover(null);
    sources[0].onended?.();
    await settle();
    expect(sounding()).toHaveLength(0);
    expect(sources.filter((s) => s.started)).toHaveLength(1);
  });
});

describe('a piece laid, heard', () => {
  it('a canal link laps, a rail link clanks', async () => {
    const { noteStrike, stampThud, warmSounds } = await import('../sfx');
    warmSounds();
    await settle();
    noteStrike('link', 'canal', true);
    stampThud('link');
    await settle();
    expect(played()).toEqual(['link-canal']);
    noteStrike('link', 'rail', false);
    stampThud('link');
    await settle();
    expect(played()).toEqual(['link-canal', 'link-rail']);
  });

  it('an industry is heard as its trade, just behind the stamp', async () => {
    const { noteStrike, stampThud, warmSounds } = await import('../sfx');
    warmSounds();
    await settle();
    for (const industry of ['coal', 'iron', 'cotton', 'manufacturer', 'pottery', 'brewery'] as const) {
      sources = [];
      noteStrike('tile', 'canal', true, industry);
      stampThud('tile');
      await settle();
      expect(played().sort()).toEqual([`ind-${industry}`, 'stamp']);
      const stamp = sources.find((s) => s.buffer?.url.includes('stamp'));
      const trade = sources.find((s) => s.buffer?.url.includes('ind-'));
      expect(trade!.startAt!).toBeGreaterThan(stamp!.startAt!);
    }
  });

  it('a tile and a link laid in the same breath are both heard', async () => {
    const { noteStrike, stampThud, warmSounds } = await import('../sfx');
    warmSounds();
    await settle();
    noteStrike('link', 'canal', true);
    noteStrike('tile', 'canal', true, 'brewery');
    stampThud('tile');
    await settle();
    expect(played().sort()).toEqual(['ind-brewery', 'link-canal', 'stamp']);
  });

  it('a strike long past is not heard as the next one', async () => {
    const { noteStrike, stampThud, warmSounds } = await import('../sfx');
    warmSounds();
    await settle();
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      noteStrike('tile', 'canal', true, 'coal');
      vi.setSystemTime(Date.now() + 5000);
      stampThud('tile');
    } finally {
      vi.useRealTimers();
    }
    await settle();
    expect(played()).toEqual(['stamp']);
  });
});

describe('the era’s tunes', () => {
  const levels = { ambience: 0.5, gestures: 0.8, moments: 0.8, music: 0.5 };
  const tunes = () => sources.filter((s) => s.buffer?.url.includes('/music-'));
  const named = (s: FakeSource) => s.buffer?.url.replace(/^\/sfx\/(.*)\.\w+$/, '$1');

  beforeEach(() => {
    vi.useFakeTimers();
    /* the least of every draw: the first tune 4 s in, the first of the
       playlist, the shortest pause (45 s) */
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('begin a few seconds into the era, play a tune through, pause, and never play it twice running', async () => {
    const { setMix, tableMusic } = await import('../sfx');
    setMix({ on: true, ambience: false, music: true, voices: false, levels });
    tableMusic('canal');
    await vi.advanceTimersByTimeAsync(3000);
    expect(tunes()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1500);
    expect(tunes().map(named)).toEqual(['music-canal-iv']);
    /* played through once, not looped, and left to end by itself */
    const first = tunes()[0];
    expect(first.loop).toBe(false);
    expect(first.stopAt).toBeNull();
    /* asked again in the same era: still the one tune */
    tableMusic('canal');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(tunes()).toHaveLength(1);
    /* it ends: the ambience alone for the pause, then another tune */
    first.onended?.();
    await vi.advanceTimersByTimeAsync(44_000);
    expect(tunes()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1500);
    expect(tunes().map(named)).toEqual(['music-canal-iv', 'music-canal-vii']);
    expect(tunes()[1].loop).toBe(false);
    expect(tunes()[1].stopAt).toBeNull();
    tunes()[1].onended?.();
    await vi.advanceTimersByTimeAsync(46_000);
    /* never the one just heard: the first of the others */
    expect(tunes().map(named)).toEqual(['music-canal-iv', 'music-canal-vii', 'music-canal-iv']);
  });

  it('fade out slowly when the canal era closes, and the rail brings its own', async () => {
    const { setMix, tableMusic } = await import('../sfx');
    setMix({ on: true, ambience: false, music: true, voices: false, levels });
    tableMusic('canal');
    await vi.advanceTimersByTimeAsync(5000);
    expect(tunes()).toHaveLength(1);
    /* the canal's scoring: the tune is heard out over four seconds */
    tableMusic(null);
    expect(tunes()[0].stopAt).toBeCloseTo(4.05);
    await vi.advanceTimersByTimeAsync(200_000);
    expect(tunes()).toHaveLength(1);
    /* the rail era's play */
    tableMusic('rail');
    await vi.advanceTimersByTimeAsync(5000);
    expect(tunes().map(named)).toEqual(['music-canal-iv', 'music-rail-iv']);
    /* the game over: gone again */
    tableMusic(null);
    expect(tunes()[1].stopAt).toBeCloseTo(4.05);
    expect(sounding()).toHaveLength(0);
  });

  it('are not played with their switch shut, and stop at once when the sound is cut', async () => {
    const { setMix, tableMusic } = await import('../sfx');
    setMix({ on: true, ambience: false, music: false, voices: false, levels });
    tableMusic('canal');
    await vi.advanceTimersByTimeAsync(20_000);
    expect(tunes()).toHaveLength(0);
    /* the switch opened in the canal era: a tune comes, shortly */
    setMix({ on: true, ambience: false, music: true, voices: false, levels });
    await vi.advanceTimersByTimeAsync(5000);
    expect(tunes()).toHaveLength(1);
    /* the board's sound switch shut: the tune goes, and quickly */
    setMix({ on: false, ambience: false, music: true, voices: false, levels });
    expect(tunes()[0].stopAt).toBeCloseTo(1.05);
    await vi.advanceTimersByTimeAsync(200_000);
    expect(sounding()).toHaveLength(0);
    /* opened again, still in the canal era: the playlist starts afresh */
    setMix({ on: true, ambience: false, music: true, voices: false, levels });
    await vi.advanceTimersByTimeAsync(5000);
    expect(tunes()).toHaveLength(2);
    expect(tunes().filter((s) => s.stopAt === null || s.stopAt > 100)).toHaveLength(1);
  });

  it('wait for the reader’s first gesture', async () => {
    vi.stubGlobal('navigator', { userActivation: { hasBeenActive: false } });
    const { setMix, tableMusic } = await import('../sfx');
    setMix({ on: true, ambience: true, music: true, voices: false, levels });
    tableMusic('canal');
    await vi.advanceTimersByTimeAsync(300_000);
    expect(sources).toHaveLength(0);
  });
});

describe('each era’s life', () => {
  const levels = { ambience: 0.5, gestures: 0.8, moments: 0.8, music: 0.5 };
  const events = () => sources.filter((s) => s.buffer?.url.includes('/life-'));

  beforeEach(() => {
    vi.useFakeTimers();
    /* the shortest gap, 40 s, and the first event of the list */
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('a train somewhere off, now and then, one at a time, never the same twice running', async () => {
    const { setMix, tableAmbience } = await import('../sfx');
    setMix({ on: true, ambience: true, music: false, voices: false, levels });
    tableAmbience('rail');
    await vi.advanceTimersByTimeAsync(1000);
    expect(played()).toEqual(['amb-rail']);
    await vi.advanceTimersByTimeAsync(38_000);
    expect(events()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(played()).toEqual(['amb-rail', 'life-whistle']);
    /* nothing more while it sounds */
    await vi.advanceTimersByTimeAsync(300_000);
    expect(events()).toHaveLength(1);
    /* heard out: another after a gap, not the same */
    events()[0].onended?.();
    await vi.advanceTimersByTimeAsync(41_000);
    expect(events().map((s) => s.buffer?.url.replace(/^\/sfx\/(.*)\.\w+$/, '$1'))).toEqual(['life-whistle', 'life-passing']);
  });

  it('never over a moment of the game: a train waits for the bell, and one going by makes way', async () => {
    const { cue, setMix, tableAmbience, warmSounds } = await import('../sfx');
    setMix({ on: true, ambience: true, music: false, voices: false, levels });
    warmSounds();
    tableAmbience('rail');
    /* the bell rings a second before the train was due: it waits for it */
    await vi.advanceTimersByTimeAsync(39_000);
    cue('turn');
    await vi.advanceTimersByTimeAsync(2000);
    expect(events()).toHaveLength(0);
    /* the bell (2 s) and three seconds after it */
    await vi.advanceTimersByTimeAsync(4500);
    expect(events()).toHaveLength(1);
    /* a moment while it sounds: the train fades away at once */
    cue('turn');
    await vi.advanceTimersByTimeAsync(10);
    expect(events()[0].stopAt).toBeCloseTo(0.35);
  });

  it('is each era’s own: the canal hears its waterway, and the events stop with the ambience', async () => {
    const { setMix, tableAmbience } = await import('../sfx');
    setMix({ on: true, ambience: true, music: false, voices: false, levels });
    tableAmbience('canal');
    await vi.advanceTimersByTimeAsync(41_000);
    expect(events().map((s) => s.buffer?.url.replace(/^\/sfx\/(.*)\.\w+$/, '$1'))).toEqual(['life-horse']);
    /* the era turns: the canal's event goes with its ambience, the rail's come */
    tableAmbience('rail');
    expect(events()[0].stopAt).toBeCloseTo(1.05);
    await vi.advanceTimersByTimeAsync(41_000);
    expect(events()).toHaveLength(2);
    expect(events()[1].buffer?.url).toContain('/life-whistle');
    /* the ambience switched off: the train goes, and no other comes */
    setMix({ on: true, ambience: false, music: false, voices: false, levels });
    expect(events()[1].stopAt).toBeCloseTo(1.05);
    await vi.advanceTimersByTimeAsync(400_000);
    expect(events()).toHaveLength(2);
  });
});

describe('the townsfolk', () => {
  const levels = { ambience: 0.5, gestures: 0.8, moments: 0.8, music: 0.5 };
  const lines = () => sources.filter((s) => s.buffer?.url.includes('/bark-'));
  const names = () => lines().map((s) => s.buffer?.url.replace(/^\/sfx\/(.*)\.\w+$/, '$1'));
  const spoken = (id: string, town = 'stoke') => ({
    line: { id, who: 'kezia' as const, text: 'Kiln came out lovely, duck!', mood: 'glad' as const },
    town,
    stir: null,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    /* the shortest gap: a minute */
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('speak now and then, one at a time, and the bubble says it while it is heard and a moment after', async () => {
    const { onSaid, saidNow, setMix, tableVoices } = await import('../sfx');
    setMix({ on: true, ambience: false, music: false, voices: true, levels });
    const asked: (string | null)[] = [];
    tableVoices({ pick: (_c, last) => (asked.push(last), spoken(last === 'bark-kezia-kiln' ? 'bark-kezia-kettle' : 'bark-kezia-kiln')) });
    let told = 0;
    onSaid(() => told++);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(lines()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(names()).toEqual(['bark-kezia-kiln']);
    expect(saidNow()).toMatchObject({ text: 'Kiln came out lovely, duck!', name: 'Kezia Dunn', town: 'stoke' });
    /* nothing more while it speaks */
    await vi.advanceTimersByTimeAsync(300_000);
    expect(lines()).toHaveLength(1);
    /* heard out (the fake recording runs 2 s): the bubble goes 1.5 s after it */
    lines()[0].onended?.();
    expect(saidNow()).toBeNull();
    expect(told).toBe(2);
    /* another a minute on, never the line just said */
    await vi.advanceTimersByTimeAsync(61_000);
    expect(names()).toEqual(['bark-kezia-kiln', 'bark-kezia-kettle']);
    expect(asked).toEqual([null, 'bark-kezia-kiln']);
  });

  it('answer a stir within seconds, but never sooner than a minute after the last voice', async () => {
    const { setMix, tableVoices, voiceStir } = await import('../sfx');
    setMix({ on: true, ambience: false, music: false, voices: true, levels });
    tableVoices({ pick: () => spoken('bark-kezia-kiln') });
    /* nothing said yet: a stir is answered three seconds after (the shortest reaction) */
    await vi.advanceTimersByTimeAsync(1000);
    voiceStir();
    await vi.advanceTimersByTimeAsync(2900);
    expect(lines()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(lines()).toHaveLength(1);
    /* heard out; a stir ten seconds later waits for the minute */
    lines()[0].onended?.();
    await vi.advanceTimersByTimeAsync(10_000);
    voiceStir();
    await vi.advanceTimersByTimeAsync(45_000);
    expect(lines()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(6000);
    expect(lines()).toHaveLength(2);
  });

  it('never over a moment of the game, and never with the switch shut', async () => {
    const { cue, saidNow, setMix, tableVoices, warmSounds } = await import('../sfx');
    setMix({ on: true, ambience: false, music: false, voices: true, levels });
    warmSounds();
    tableVoices({ pick: () => spoken('bark-kezia-kiln') });
    /* the bell a second before the voice was due: it waits for it */
    await vi.advanceTimersByTimeAsync(59_000);
    cue('turn');
    await vi.advanceTimersByTimeAsync(2000);
    expect(lines()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(4500);
    expect(lines()).toHaveLength(1);
    /* a moment while it speaks: the voice and its bubble go */
    cue('turn');
    await vi.advanceTimersByTimeAsync(10);
    expect(lines()[0].stopAt).toBeCloseTo(0.35);
    expect(saidNow()).toBeNull();
    /* the switch shut: no one speaks again */
    setMix({ on: true, ambience: false, music: false, voices: false, levels });
    await vi.advanceTimersByTimeAsync(600_000);
    expect(lines()).toHaveLength(1);
  });

  it('say nothing when no one has a word, and try again later', async () => {
    const { setMix, tableVoices } = await import('../sfx');
    setMix({ on: true, ambience: false, music: false, voices: true, levels });
    let n = 0;
    tableVoices({ pick: () => (n++ === 0 ? null : spoken('bark-kezia-kiln')) });
    await vi.advanceTimersByTimeAsync(61_000);
    expect(lines()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(61_000);
    expect(lines()).toHaveLength(1);
  });
});
