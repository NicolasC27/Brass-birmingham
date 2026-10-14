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

describe('the canal’s tune', () => {
  const levels = { ambience: 0.5, gestures: 0.8, moments: 0.8, music: 0.5 };
  const tuneSources = () => sources.filter((s) => s.buffer?.url.includes('music-canal'));

  it('loops while the canal era is played, and fades out slowly when it closes', async () => {
    const { setMix, tableMusic } = await import('../sfx');
    setMix({ on: true, ambience: false, music: true, levels });
    tableMusic(true);
    await settle();
    expect(played()).toEqual(['music-canal']);
    expect(sources[0].loop).toBe(true);
    /* asked again in the same era: still the one tune */
    tableMusic(true);
    await settle();
    expect(tuneSources()).toHaveLength(1);
    /* the rail era comes: the tune is heard out over four seconds */
    tableMusic(false);
    expect(sources[0].stopAt).toBeCloseTo(4.05);
    expect(sounding()).toHaveLength(0);
  });

  it('is not played with its switch shut, and stops at once when the sound is cut', async () => {
    const { setMix, tableMusic } = await import('../sfx');
    setMix({ on: true, ambience: false, music: false, levels });
    tableMusic(true);
    await settle();
    expect(tuneSources()).toHaveLength(0);
    /* the switch opened in the canal era: the tune comes */
    setMix({ on: true, ambience: false, music: true, levels });
    await settle();
    expect(tuneSources()).toHaveLength(1);
    /* the board's sound switch shut: the tune goes, and quickly */
    setMix({ on: false, ambience: false, music: true, levels });
    expect(tuneSources()[0].stopAt).toBeCloseTo(1.05);
    await settle();
    expect(sounding()).toHaveLength(0);
    /* opened again, still in the canal era: it starts afresh */
    setMix({ on: true, ambience: false, music: true, levels });
    await settle();
    expect(tuneSources()).toHaveLength(2);
    expect(sounding()).toHaveLength(1);
  });

  it('waits for the reader’s first gesture', async () => {
    vi.stubGlobal('navigator', { userActivation: { hasBeenActive: false } });
    const { setMix, tableMusic } = await import('../sfx');
    setMix({ on: true, ambience: false, music: true, levels });
    tableMusic(true);
    await settle();
    expect(sources).toHaveLength(0);
  });
});
