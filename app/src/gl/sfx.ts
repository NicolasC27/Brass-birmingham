/* The table's sounds. A few are synthesised on the spot with Web Audio —
   the shop bells, the counter, the station — and the rest are short
   recordings served under /sfx/ (Opus in WebM, MP3 for Safari), fetched
   the first time they are wanted. A single context is opened lazily, and
   never before the reader has touched the page: until then every sound is
   simply not made (browsers would keep the context suspended anyway).

   Three buses run into one master: the ambience under the table, the
   gestures of play, and the moments — the bell of a turn, the whistle at
   the close of an era, the band at the end. Each has its own level, and
   the board's sound switch closes the master. */

let ctx: AudioContext | null = null;

/** the reader has touched the page: sticky user activation where the
 *  browser reports it; a context without the API is taken as willing */
const touched = (): boolean => {
  const ua = (globalThis.navigator as (Navigator & { userActivation?: { hasBeenActive: boolean } }) | undefined)?.userActivation;
  return ua ? ua.hasBeenActive : true;
};
/** the context, whatever its state (decoding works while suspended) —
 *  none before the first gesture */
const audio = (): AudioContext | null => {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!ctx && !touched()) return null;
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

/* ---------------- the mixing desk: three buses and a master ---------------- */

export type Bus = 'ambience' | 'gestures' | 'moments';
export interface Mix {
  /** the board's sound switch: the master open or shut */
  on: boolean;
  /** the ambience under the table plays at all */
  ambience: boolean;
  /** each bus's level, 0 to 1 */
  levels: Record<Bus, number>;
}
let mix: Mix = { on: true, ambience: false, levels: { ambience: 0.5, gestures: 0.8, moments: 0.8 } };
/* a bus at full is still well under the page: the recordings are cut to
   peak at -3 dBFS, the ambiences levelled to -16 LUFS, and a board game is
   played for two hours */
const BUS_SCALE: Record<Bus, number> = { ambience: 0.22, gestures: 0.55, moments: 0.5 };

let desk: { ac: AudioContext; master: GainNode; bus: Record<Bus, GainNode> } | null = null;
/** the buses of this context, made on first use */
const busOf = (ac: AudioContext, bus: Bus): GainNode => {
  if (!desk || desk.ac !== ac) {
    const master = ac.createGain();
    master.gain.setValueAtTime(mix.on ? 1 : 0, ac.currentTime);
    master.connect(ac.destination);
    const make = (b: Bus) => {
      const g = ac.createGain();
      g.gain.setValueAtTime(mix.levels[b] * BUS_SCALE[b], ac.currentTime);
      g.connect(master);
      return g;
    };
    desk = { ac, master, bus: { ambience: make('ambience'), gestures: make('gestures'), moments: make('moments') } };
  }
  return desk.bus[bus];
};

/** the levels and switches as the board options have them */
export function setMix(next: Mix): void {
  mix = { on: next.on, ambience: next.ambience, levels: { ...next.levels } };
  if (desk) {
    const now = desk.ac.currentTime;
    const glide = (p: AudioParam, v: number) => {
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(v, now + 0.15);
    };
    glide(desk.master.gain, mix.on ? 1 : 0);
    for (const b of ['ambience', 'gestures', 'moments'] as const) glide(desk.bus[b].gain, mix.levels[b] * BUS_SCALE[b]);
  }
  applyAmbience();
}

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
  /* nothing is fetched, nor remembered as missing, before the first gesture */
  if (!audio()) return Promise.resolve(null);
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
/** the recordings still fading out, by house: a house the pointer comes
 *  back to within the fade waits for its old loop to end before it starts
 *  another, so two copies never sound over each other */
const fading = new Map<string, AudioBufferSourceNode>();
const FADE_IN = 0.3;
const FADE_OUT = 0.5;

/** the house under the pointer right now */
let hovered: string | null = null;

/** the pointer left the house: the ambience fades out */
export function houseLeave(): void {
  hovered = null;
  if (!playing) return;
  const { id, src, gain } = playing;
  playing = null;
  const ac = src.context;
  const now = ac.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0.0001, now + FADE_OUT);
  fading.set(id, src);
  src.onended = () => {
    if (fading.get(id) === src) fading.delete(id);
    /* the pointer came back while it faded: the house sounds again */
    if (hovered === id && !playing) sound(id);
  };
  src.stop(now + FADE_OUT + 0.05);
}

/** the house's recording, looped under the pointer and fading in */
function sound(id: string): void {
  void ambience(id).then(async (buf) => {
    /* the pointer may have moved on while the file was fetched; a loop of
       this house still fading out starts it again when it ends */
    if (!buf || playing || hovered !== id || fading.has(id)) return;
    const ac = await context();
    if (!ac || playing || hovered !== id || fading.has(id)) return;
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
}

/** the pointer reached a house: its recording loops under the pointer,
 *  fading in — or the shop bell rings when no recording is served */
export function houseHover(id: string | null): void {
  if (playing && playing.id !== id) houseLeave();
  hovered = id;
  if (!id || (playing && playing.id === id)) return;
  sound(id);
  /* the bell rings at once when there is nothing to hear; the check is
     cached, so a house without a recording rings every time */
  void ambience(id).then((buf) => {
    if (!buf) houseBell(id);
  });
}

/** the table is left: whatever sounds is stopped and the context closed,
 *  so the tab no longer counts as one playing sound. The recordings stay
 *  decoded (a buffer outlives its context); the next sound opens another. */
export function closeAudio(): void {
  houseLeave();
  fading.clear();
  /* the ambience dies with its context; the era wanted is kept for the next */
  table = null;
  desk = null;
  const ac = ctx;
  ctx = null;
  if (ac && ac.state !== 'closed') void ac.close().catch(() => undefined);
}


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

/** two pewter tankards meeting: a bright clink and a short ring */
export function mugClink(): void {
  void context().then((ac) => {
    if (!ac) return;
    const now = ac.currentTime;
    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.1, now + 0.004);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    master.connect(ac.destination);
    for (const [f, level, decay] of [
      [2960, 1, 0.5],
      [4410, 0.5, 0.25],
      [6830, 0.25, 0.12],
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

/* ---------------- the station: a bell when a train is made up, a whistle as it leaves ---------------- */

/** the station bell: a large bell struck twice, low and long — the office
 *  has made up a table and calls the passengers */
export function stationBell(): void {
  void context().then((ac) => {
    if (!ac) return;
    for (const strike of [0, 0.55]) {
      const now = ac.currentTime + strike;
      const master = ac.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
      master.connect(ac.destination);
      for (const [ratio, level, decay] of [
        [1, 1, 1.8],
        [2.0, 0.5, 1.1],
        [2.92, 0.28, 0.6],
        [4.2, 0.12, 0.35],
      ] as const) {
        const o = ac.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(523 * ratio, now);
        const g = ac.createGain();
        g.gain.setValueAtTime(level, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
        o.connect(g).connect(master);
        o.start(now);
        o.stop(now + decay + 0.05);
      }
    }
  });
}

/** the steam whistle: two reeds a fifth apart with breath in them, a
 *  rising attack and a long fall — the train leaves */
export function steamWhistle(): void {
  void context().then((ac) => {
    if (!ac) return;
    const now = ac.currentTime;
    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.08, now + 0.12);
    master.gain.setValueAtTime(0.08, now + 0.9);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
    const tone = ac.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.setValueAtTime(2400, now);
    tone.connect(master).connect(ac.destination);
    for (const [f, level] of [
      [587, 1],
      [880, 0.7],
      [1175, 0.25],
    ] as const) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      /* the note climbs as the steam comes up, then holds */
      o.frequency.setValueAtTime(f * 0.94, now);
      o.frequency.exponentialRampToValueAtTime(f, now + 0.18);
      o.frequency.exponentialRampToValueAtTime(f * 0.985, now + 1.6);
      const g = ac.createGain();
      g.gain.setValueAtTime(level * 0.35, now);
      o.connect(g).connect(tone);
      o.start(now);
      o.stop(now + 1.7);
    }
    /* the breath: filtered noise under the reeds */
    const seconds = 1.7;
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const noise = ac.createBufferSource();
    noise.buffer = buf;
    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(1600, now);
    band.Q.setValueAtTime(0.8, now);
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.18, now);
    noise.connect(band).connect(ng).connect(tone);
    noise.start(now);
    noise.stop(now + seconds);
  });
}


/* ---------------- the press: a tile or a link struck on the table ---------------- */

/** a short breath of paper noise, shared by every strike: made once */
let paperGrain: AudioBuffer | null = null;
const grain = (ac: AudioContext): AudioBuffer => {
  if (paperGrain && paperGrain.sampleRate === ac.sampleRate) return paperGrain;
  const n = Math.floor(ac.sampleRate * 0.09);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  /* the fibres give way unevenly: noise that thins as it goes */
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
  paperGrain = buf;
  return buf;
};

/** the block meets the paper: a dull press, the paper's short hiss and a
 *  small brass tick of the handle — a card struck firmer than a link */
export function stampThud(kind: 'tile' | 'link' = 'tile'): void {
  /* the move behind the strike, if the table has just told us of one: a
     link is heard as its era's link, a machine's piece a little further off */
  const strike = struck && Date.now() - struck.at < STRIKE_FRESH_MS ? struck : null;
  struck = null;
  const quiet = strike ? !strike.mine : false;
  const name: Cue = kind === 'tile' ? 'stamp' : (strike?.era ?? wantEra ?? 'canal') === 'rail' ? 'link-rail' : 'link-canal';
  /* a recording already decoded is played; otherwise the press is
     synthesised this once while the recording is fetched for next time */
  const ready = decoded.get(name);
  if (ready) {
    cue(name, { quiet });
    return;
  }
  void sample(name);
  void context().then((ac) => {
    if (!ac) return;
    const now = ac.currentTime;
    const firm = (kind === 'tile' ? 1 : 0.6) * (quiet ? MACHINE : 1) * 1.6;
    const master = ac.createGain();
    master.gain.setValueAtTime(0.9 * firm, now);
    master.connect(busOf(ac, 'gestures'));
    /* the press: a low body that falls away at once */
    const body = ac.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(150, now);
    body.frequency.exponentialRampToValueAtTime(70, now + 0.09);
    const bg = ac.createGain();
    bg.gain.setValueAtTime(0.0001, now);
    bg.gain.exponentialRampToValueAtTime(0.14, now + 0.004);
    bg.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    body.connect(bg).connect(master);
    body.start(now);
    body.stop(now + 0.13);
    /* the paper: filtered noise, bright and brief */
    const paper = ac.createBufferSource();
    paper.buffer = grain(ac);
    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(kind === 'tile' ? 2300 : 3100, now);
    band.Q.setValueAtTime(0.9, now);
    const pg = ac.createGain();
    pg.gain.setValueAtTime(0.1, now);
    paper.connect(band).connect(pg).connect(master);
    paper.start(now);
    paper.stop(now + 0.09);
    /* the brass: two thin partials, a tick rather than a ring */
    for (const [f, level, decay] of [
      [2480, 0.035, 0.09],
      [5930, 0.015, 0.05],
    ] as const) {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, now + 0.006);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(level, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.01 + decay);
      o.connect(g).connect(master);
      o.start(now);
      o.stop(now + 0.02 + decay);
    }
  });
}

/* ---------------- the recorded palette: gestures and moments ---------------- */

export type Cue = 'turn' | 'stamp' | 'link-canal' | 'link-rail' | 'sell' | 'loan' | 'develop' | 'card' | 'scout' | 'era-end' | 'victory' | 'defeat' | 'click' | 'panel-open' | 'panel-close' | 'refuse';
const BUS_OF: Record<Cue, Bus> = {
  turn: 'moments',
  'era-end': 'moments',
  victory: 'moments',
  defeat: 'moments',
  stamp: 'gestures',
  'link-canal': 'gestures',
  'link-rail': 'gestures',
  sell: 'gestures',
  loan: 'gestures',
  develop: 'gestures',
  card: 'gestures',
  scout: 'gestures',
  click: 'gestures',
  'panel-open': 'gestures',
  'panel-close': 'gestures',
  refuse: 'gestures',
};
/** the interface's own small noises sit under the moves of the game */
const CUE_LEVEL: Partial<Record<Cue, number>> = { click: 0.45, 'panel-open': 0.4, 'panel-close': 0.4, card: 0.6, refuse: 0.7 };
/** a machine's gesture (or a rival's) is heard across the table, not under the hand */
export const MACHINE = 0.45;
/** a gesture that arrives this late after it was asked for is let go */
const STALE_MS = 700;

/** Opus in WebM where the browser plays it, MP3 elsewhere (Safari) */
let opus: boolean | null = null;
const canOpus = (): boolean => {
  if (opus === null) {
    try {
      opus = typeof document !== 'undefined' && document.createElement('audio').canPlayType('audio/webm; codecs="opus"') !== '';
    } catch {
      opus = false;
    }
  }
  return opus;
};

const decoded = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<AudioBuffer | null>>();
/** a recording of the palette, fetched and decoded once; null when it
 *  cannot be had (then the synthesised voice, where there is one, stands in) */
function sample(name: string): Promise<AudioBuffer | null> {
  const ac = audio();
  if (!ac) return Promise.resolve(null);
  let p = loading.get(name);
  if (!p) {
    const get = async (ext: string): Promise<AudioBuffer> => {
      const r = await fetch(`/sfx/${name}.${ext}`);
      if (!r.ok || !(r.headers.get('content-type') ?? '').match(/^(audio|video)\//)) throw new Error(`no ${name}.${ext}`);
      return ac.decodeAudioData(await r.arrayBuffer());
    };
    p = (canOpus() ? get('webm').catch(() => get('mp3')) : get('mp3'))
      .then((buf) => {
        decoded.set(name, buf);
        return buf;
      })
      .catch(() => null);
    loading.set(name, p);
  }
  return p;
}

/** what stands in for a recording that could not be had */
const SYNTH: Partial<Record<Cue, () => void>> = {
  turn: () => counterBell(),
  'era-end': () => steamWhistle(),
};

/** play one sound of the palette on its bus; `quiet` for another seat's move */
export function cue(name: Cue, opts: { quiet?: boolean } = {}): void {
  if (!mix.on) return;
  const asked = Date.now();
  void context().then(async (ac) => {
    if (!ac) return;
    const buf = decoded.get(name) ?? (await sample(name));
    if (!buf) {
      SYNTH[name]?.();
      return;
    }
    /* a gesture heard long after the hand moved is worse than none */
    if (BUS_OF[name] === 'gestures' && Date.now() - asked > STALE_MS) return;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    g.gain.setValueAtTime((CUE_LEVEL[name] ?? 1) * (opts.quiet ? MACHINE : 1), ac.currentTime);
    src.connect(g).connect(busOf(ac, BUS_OF[name]));
    src.start();
    if (import.meta.env.DEV && heard.push(`${name}${opts.quiet ? ' (quiet)' : ''}`) > 40) heard.shift();
  });
}

/** the short sounds of the palette (a few kilobytes each), fetched once a
 *  table is sat at so the first of each is not late */
export function warmSounds(): void {
  if (!mix.on) return;
  for (const n of Object.keys(BUS_OF)) void sample(n);
}

/* ---------------- the strike: who laid the piece the press is about to strike ---------------- */

/** the piece the table has just been told of; the press reads it once */
let struck: { era: 'canal' | 'rail'; mine: boolean; at: number } | null = null;
const STRIKE_FRESH_MS = 2000;
/** the table says a piece was laid, and by whom: the press that strikes it
 *  (stampThud, on the board's own beat) is heard accordingly */
export function noteStrike(era: 'canal' | 'rail', mine: boolean): void {
  struck = { era, mine, at: Date.now() };
}

/* ---------------- the ambience under the table ---------------- */

/** the era the table stands in (null: no table, the ambience goes) */
let wantEra: 'canal' | 'rail' | null = null;
let table: { era: 'canal' | 'rail'; src: AudioBufferSourceNode; gain: GainNode } | null = null;
const AMB_FADE = 3;
/** the loop's own length: the file was folded onto itself at this length,
 *  an MP3's padding past it is left out of the loop */
const AMB_LOOP_S = 27;

/** the ambience of this era, looped under the table; another era's fades
 *  across into it */
export function tableAmbience(era: 'canal' | 'rail' | null): void {
  wantEra = era;
  applyAmbience();
}

function fadeOut(t: { src: AudioBufferSourceNode; gain: GainNode }, seconds: number): void {
  const ac = t.src.context;
  const now = ac.currentTime;
  t.gain.gain.cancelScheduledValues(now);
  t.gain.gain.setValueAtTime(t.gain.gain.value, now);
  t.gain.gain.linearRampToValueAtTime(0.0001, now + seconds);
  t.src.stop(now + seconds + 0.05);
}

function applyAmbience(): void {
  const era = mix.on && mix.ambience ? wantEra : null;
  if (table && table.era !== era) {
    fadeOut(table, era ? AMB_FADE : 1);
    table = null;
  }
  if (!era || table) return;
  void context().then(async (ac) => {
    if (!ac) return;
    const buf = await sample(`amb-${era}`);
    /* the table may have moved on while the file came */
    const now = mix.on && mix.ambience ? wantEra : null;
    if (!buf || now !== era || table) return;
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = Math.min(buf.duration, AMB_LOOP_S);
    const gain = ac.createGain();
    const t0 = ac.currentTime;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(1, t0 + AMB_FADE);
    src.connect(gain).connect(busOf(ac, 'ambience'));
    src.start(t0);
    table = { era, src, gain };
  });
}

/* the first touch of the page opens the way: what was wanted before it —
   the ambience of the table already sat at — starts then */
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  const first = () => {
    window.removeEventListener('pointerdown', first, true);
    window.removeEventListener('keydown', first, true);
    /* the activation is recorded once this handler has run */
    window.setTimeout(() => {
      applyAmbience();
      if (wantEra) warmSounds();
    }, 0);
  };
  window.addEventListener('pointerdown', first, true);
  window.addEventListener('keydown', first, true);
}

/* dev only: what is sounding right now (window.__sfx.playing(), .ambience(), .heard()) */
const heard: string[] = [];
if (import.meta.env.DEV && typeof window !== 'undefined')
  (window as unknown as { __sfx?: { playing: () => string | null; ambience: () => string | null; heard: () => string[] } }).__sfx = {
    playing: () => playing?.id ?? null,
    ambience: () => table?.era ?? null,
    heard: () => heard.slice(),
  };
