/* The board's few sounds, synthesised on the spot with Web Audio: nothing
   to download, nothing to license. A single context is opened lazily and
   resumed on demand (browsers keep it suspended until the reader has
   clicked once somewhere, which a game always brings). */

let ctx: AudioContext | null = null;
const context = (): AudioContext | null => {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx.state === 'running' ? ctx : null;
};

/** deterministic 31-hash, for a house's own note */
const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
};

/** a small brass bell over a shop door: two partials, a quick strike and a
 *  slow ring, pitched a little differently for every house */
export function houseBell(id: string): void {
  const ac = context();
  if (!ac) return;
  const now = ac.currentTime;
  const base = 880 * Math.pow(2, ((hash(id) % 7) - 3) / 12);
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.07, now + 0.008);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  master.connect(ac.destination);
  for (const [ratio, level, decay] of [
    [1, 1, 0.9],
    [2.41, 0.45, 0.45],
    [3.83, 0.18, 0.25],
  ] as const) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(base * ratio, now);
    const g = ac.createGain();
    g.gain.setValueAtTime(level, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    o.connect(g).connect(master);
    o.start(now);
    o.stop(now + decay + 0.05);
  }
}
