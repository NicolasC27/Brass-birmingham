/* The board's few sounds, synthesised on the spot with Web Audio: nothing
   to download, nothing to license. A single context is opened lazily and
   resumed on demand (browsers keep it suspended until the reader has
   clicked once somewhere, which a game always brings). */

let ctx: AudioContext | null = null;
/** the context, whatever its state (decoding works while suspended) */
const audio = (): AudioContext | null => {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  return ctx;
};
/** the context once it runs: resumed if the browser allows it by now */
const context = async (): Promise<AudioContext | null> => {
  const ac = audio();
  if (!ac) return null;
  if (ac.state === 'suspended') await ac.resume().catch(() => undefined);
  return ac.state === 'running' ? ac : null;
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
  void context().then((ac) => {
    if (ac) ring(ac, id);
  });
}
function ring(ac: AudioContext, id: string): void {
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

/* ---------------- a house's own ambience, while hovered ---------------- */

const buffers = new Map<string, Promise<AudioBuffer | null>>();
/** the recording served for a house (/sfx-<name>.mp3), decoded once; null
 *  when the server has none */
const ambience = (id: string): Promise<AudioBuffer | null> => {
  const name = id.replace(/^m-/, '');
  let p = buffers.get(name);
  if (!p) {
    p = (async () => {
      const ac = audio();
      if (!ac) return null;
      const url = `/sfx-${name}.mp3`;
      const head = await fetch(url, { method: 'HEAD' }).catch(() => null);
      if (!head?.ok || !(head.headers.get('content-type') ?? '').startsWith('audio/')) return null;
      const bytes = await fetch(url).then((r) => r.arrayBuffer());
      return await ac.decodeAudioData(bytes);
    })().catch(() => null);
    buffers.set(name, p);
  }
  return p;
};

let playing: { id: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
const FADE_IN = 0.3;
const FADE_OUT = 0.5;

/** the pointer left the house: the ambience fades out */
export function houseLeave(): void {
  if (!playing) return;
  const { src, gain } = playing;
  playing = null;
  const ac = src.context;
  const now = ac.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0.0001, now + FADE_OUT);
  src.stop(now + FADE_OUT + 0.05);
}

/** the pointer reached a house: its recording loops under the pointer,
 *  fading in — or the shop bell rings when no recording is served */
export function houseHover(id: string | null): void {
  if (playing && playing.id !== id) houseLeave();
  if (!id || (playing && playing.id === id)) return;
  void ambience(id).then(async (buf) => {
    if (!buf || playing) return;
    const ac = await context();
    if (!ac || playing) return;
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    /* an MP3 carries a sliver of silence at both ends: the loop skips it */
    src.loopStart = 0.04;
    src.loopEnd = Math.max(0.1, buf.duration - 0.04);
    const gain = ac.createGain();
    const now = ac.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.35, now + FADE_IN);
    src.connect(gain).connect(ac.destination);
    src.start(now);
    playing = { id, src, gain };
  });
  /* the bell rings at once when there is nothing to hear; the check is
     cached, so a house without a recording rings every time */
  void ambience(id).then((buf) => {
    if (!buf) houseBell(id);
  });
}

/* dev only: what is sounding right now (window.__sfx.playing()) */
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __sfx?: { playing: () => string | null } }).__sfx = { playing: () => playing?.id ?? null };

/** the counter bell of the telegraph office: one bright strike */
export function counterBell(): void {
  void context().then((ac) => {
    if (!ac) return;
    const now = ac.currentTime;
    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.09, now + 0.005);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    master.connect(ac.destination);
    for (const [f, level, decay] of [
      [1760, 1, 0.7],
      [4230, 0.35, 0.3],
    ] as const) {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, now);
      const g = ac.createGain();
      g.gain.setValueAtTime(level, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      o.connect(g).connect(master);
      o.start(now);
      o.stop(now + decay + 0.05);
    }
  });
}

/** a soft tap on the counter: someone points at the map */
export function pingTap(): void {
  void context().then((ac) => {
    if (!ac) return;
    const now = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(660, now);
    o.frequency.exponentialRampToValueAtTime(440, now + 0.12);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.06, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    o.connect(g).connect(ac.destination);
    o.start(now);
    o.stop(now + 0.3);
  });
}
