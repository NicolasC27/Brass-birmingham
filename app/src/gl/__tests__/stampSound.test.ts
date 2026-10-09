import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* a Web Audio stand-in that remembers when every voice is told to stop */
let stops: number[] = [];
let started = 0;

const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
const voice = () => ({
  frequency: param(),
  Q: param(),
  type: '',
  buffer: null as unknown,
  connect: (d: unknown) => d,
  start() {
    started += 1;
  },
  stop(t: number) {
    stops.push(t);
  },
});

class FakeContext {
  state = 'running';
  currentTime = 0;
  sampleRate = 8000;
  destination = {};
  resume = () => Promise.resolve();
  close = () => Promise.resolve();
  createGain() {
    return { gain: param(), connect: (d: unknown) => d };
  }
  createOscillator() {
    return voice();
  }
  createBiquadFilter() {
    return voice();
  }
  createBufferSource() {
    return voice();
  }
  createBuffer(_channels: number, length: number, sampleRate: number) {
    const data = new Float32Array(length);
    return { sampleRate, getChannelData: () => data };
  }
}

const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
};

beforeEach(() => {
  stops = [];
  started = 0;
  vi.resetModules();
  vi.stubGlobal('window', { AudioContext: FakeContext });
  vi.stubGlobal('AudioContext', FakeContext);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the press, heard', () => {
  it('is a short strike: every voice is silent within a fifth of a second', async () => {
    const { stampThud } = await import('../sfx');
    stampThud('tile');
    await settle();
    expect(started).toBeGreaterThanOrEqual(3);
    expect(stops).toHaveLength(started);
    for (const t of stops) expect(t).toBeLessThanOrEqual(0.2);
  });

  it('strikes a link with the same short gesture', async () => {
    const { stampThud } = await import('../sfx');
    stampThud('link');
    await settle();
    expect(started).toBeGreaterThanOrEqual(3);
    expect(Math.max(...stops)).toBeLessThanOrEqual(0.2);
  });
});
