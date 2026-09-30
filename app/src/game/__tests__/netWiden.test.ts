import { describe, expect, it } from 'vitest';
import { FEATURES, forward, unpack, unpackBrain } from '../net';
import { NET_B64 } from '../net-weights';

/* A feature added to the reading leaves every network already trained a
 * few numbers short. Rather than throw them away and play by hand until a
 * fresh record has been written, the loader widens them: a weight of
 * nought for each newcomer, which must leave what they read exactly as
 * they read it. "Exactly" is the whole of the claim, so it is measured
 * rather than assumed — and it is what says features may be appended
 * safely, and never inserted. */
describe('a brain short of a feature', () => {
  const text = NET_B64 ?? '';
  const packed = text.split('|').filter(Boolean);

  it('is packed for no more features than the reading offers', () => {
    for (const text of packed) expect(unpack(text).sizes[0]).toBeLessThanOrEqual(FEATURES);
  });

  it('reads a position exactly as it did before it was widened', () => {
    const raw = packed.map(unpack);
    const wide = unpackBrain(text);
    expect(wide.nets).toHaveLength(raw.length);
    for (let trial = 0; trial < 200; trial += 1) {
      for (const [n, net] of raw.entries()) {
        const narrow = new Float32Array(net.sizes[0]);
        for (let k = 0; k < narrow.length; k += 1) narrow[k] = Math.sin(trial * 7.1 + k * 1.7);
        const grown = new Float32Array(FEATURES);
        grown.set(narrow);
        /* the newcomers take wild values: a widened net must not notice */
        for (let k = narrow.length; k < FEATURES; k += 1) grown[k] = Math.cos(trial * 3.3 + k) * 50;
        expect(forward(wide.nets[n], grown)).toBe(forward(net, narrow));
      }
    }
  });
});
