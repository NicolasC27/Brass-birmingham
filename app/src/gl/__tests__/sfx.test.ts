import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* a Web Audio stand-in: enough of a context to count the loops that sound */
interface FakeSource {
  started: boolean;
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
  decodeAudioData = () => Promise.resolve({ duration: 4 });
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
      stopAt: null as number | null,
      onended: null as (() => void) | null,
      connect: (g: unknown) => g,
      start() {
        node.started = true;
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

beforeEach(() => {
  sources = [];
  vi.resetModules();
  vi.stubGlobal('window', { AudioContext: FakeContext });
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('fetch', (_url: string, init?: { method?: string }) =>
    Promise.resolve(init?.method === 'HEAD' ? { ok: true, headers: { get: () => 'audio/mpeg' } } : { arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a house’s ambience under the pointer', () => {
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
