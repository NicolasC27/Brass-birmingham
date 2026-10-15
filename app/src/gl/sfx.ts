/* The table's sounds. A few are synthesised on the spot with Web Audio —
   the shop bells, the counter, the station — and the rest are short
   recordings served under /sfx/ (Opus in WebM, MP3 for Safari), fetched
   the first time they are wanted. A single context is opened lazily, and
   never before the reader has touched the page: until then every sound is
   simply not made (browsers would keep the context suspended anyway).

   Four buses run into one master: the ambience under the table (with, now
   and then, something of the era somewhere off — a horse on the towpath, a
   train — and a word from the townsfolk in a town of the board), the
   gestures of play, the moments — the bell of a turn, the whistle at the
   close of an era, the band at the end — and the era's tunes. Each has its
   own level, and the board's sound switch closes the master. */

import { WORLD_W } from '@/components/game/boardView';
import type { Era, IndustryType } from '@/game/types';
import { LIFE, LIFE_GAP, TUNES, TUNE_FIRST, TUNE_PAUSE, VOICE_GAP, VOICE_REACT, bubbleSpan, lifeAt, nextOf, spanOf, tuneLength, tuneOf, voiceAt } from './playlist';
import type { Chance, Life } from './playlist';
import { CAST, panOf } from './voices';
import type { Line, Spoken } from './voices';

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

/* ---------------- the mixing desk: four buses and a master ---------------- */

export type Bus = 'ambience' | 'gestures' | 'moments' | 'music';
const BUSES: readonly Bus[] = ['ambience', 'gestures', 'moments', 'music'];
export interface Mix {
  /** the board's sound switch: the master open or shut */
  on: boolean;
  /** the ambience under the table plays at all */
  ambience: boolean;
  /** the era's tunes play at all */
  music: boolean;
  /** the townsfolk are heard now and then (on the ambience's bus) */
  voices: boolean;
  /** each bus's level, 0 to 1 */
  levels: Record<Bus, number>;
}
let mix: Mix = { on: true, ambience: false, music: false, voices: false, levels: { ambience: 0.5, gestures: 0.8, moments: 0.8, music: 0.5 } };
/* a bus at full is still well under the page: the recordings are cut to
   peak at -3 dBFS, the ambiences levelled to -16 LUFS, and a board game is
   played for two hours. The tunes (-20 LUFS) sit under the ambience at the
   levels the settings open on, about -41 LUFS against the canal's -38 */
const BUS_SCALE: Record<Bus, number> = { ambience: 0.22, gestures: 0.55, moments: 0.5, music: 0.18 };

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
    desk = { ac, master, bus: { ambience: make('ambience'), gestures: make('gestures'), moments: make('moments'), music: make('music') } };
  }
  return desk.bus[bus];
};

/** the levels and switches as the board options have them */
export function setMix(next: Mix): void {
  mix = { on: next.on, ambience: next.ambience, music: next.music, voices: next.voices, levels: { ...next.levels } };
  if (desk) {
    const now = desk.ac.currentTime;
    const glide = (p: AudioParam, v: number) => {
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(v, now + 0.15);
    };
    glide(desk.master.gain, mix.on ? 1 : 0);
    for (const b of BUSES) glide(desk.bus[b].gain, mix.levels[b] * BUS_SCALE[b]);
  }
  applyAmbience();
  applyMusic();
  applyVoices();
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

/* ---------------- a house's own glimpse of its town, while hovered ---------------- */

/** the houses with a recording of their own (/sfx/house-<name>): two
 *  seconds of the town behind the merchant, heard once as the pointer
 *  arrives; any other house rings its bell */
const HOUSES = ['warrington', 'nottingham', 'shrewsbury', 'oxford', 'gloucester'];
const houseName = (id: string): string => id.replace(/^m-/, '');
/** the recording served for a house, decoded once; null when it has none */
const houseSound = (id: string): Promise<AudioBuffer | null> => {
  const name = houseName(id);
  return HOUSES.includes(name) ? sample(`house-${name}`) : Promise.resolve(null);
};
/** the houses sit under the moves of the game: heard, not announced (the
 *  recordings are levelled a few LU under the gestures, at -25 LUFS) */
const HOUSE_LEVEL = 0.6;

let playing: { id: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
/** the recordings still fading out, by house: a house the pointer comes
 *  back to within the fade waits for its old sound to end before it plays
 *  again, so two copies never sound over each other */
const fading = new Map<string, AudioBufferSourceNode>();
const FADE_IN = 0.06;
const FADE_OUT = 0.4;

/** the house under the pointer right now */
let hovered: string | null = null;

/** the pointer left the house: its sound fades out */
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

/** the house's recording, once, on the gestures' bus */
function sound(id: string): void {
  void houseSound(id).then(async (buf) => {
    /* the pointer may have moved on while the file was fetched; a sound of
       this house still fading out starts it again when it ends */
    if (!buf || playing || hovered !== id || fading.has(id)) return;
    const ac = await context();
    if (!ac || playing || hovered !== id || fading.has(id)) return;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    const now = ac.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(HOUSE_LEVEL, now + FADE_IN);
    src.connect(gain).connect(busOf(ac, 'gestures'));
    /* heard to its end, the house is quiet until the pointer comes again */
    src.onended = () => {
      if (playing?.src === src) playing = null;
    };
    src.start(now);
    playing = { id, src, gain };
    if (import.meta.env.DEV && heard.push(`house-${houseName(id)}`) > 40) heard.shift();
  });
}

/** the pointer reached a house: its town is heard once — or the shop bell
 *  rings when it has no recording */
export function houseHover(id: string | null): void {
  if (playing && playing.id !== id) houseLeave();
  hovered = id;
  if (!id || (playing && playing.id === id)) return;
  if (!mix.on) return;
  sound(id);
  /* the bell rings at once when there is nothing to hear */
  void houseSound(id).then((buf) => {
    if (!buf && hovered === id) houseBell(id);
  });
}

/** the table is left: whatever sounds is stopped and the context closed,
 *  so the tab no longer counts as one playing sound. The recordings stay
 *  decoded (a buffer outlives its context); the next sound opens another. */
export function closeAudio(): void {
  houseLeave();
  fading.clear();
  /* the ambience, its events and the tunes die with their context; what is
     wanted is kept for the next, and the waits are begun again there */
  table = null;
  life = null;
  if (lifeTimer !== null) clearTimeout(lifeTimer);
  lifeTimer = null;
  lifeAsking = null;
  lifeByHand = null;
  voice = null;
  voiceAsking = null;
  voiceByHand = null;
  if (voiceTimer !== null) clearTimeout(voiceTimer);
  voiceTimer = null;
  say(null);
  tune = null;
  asking = null;
  if (tuneTimer !== null) clearTimeout(tuneTimer);
  tuneTimer = null;
  tuneEra = null;
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

/** the link of an era: water for the canal, iron for the rail */
const linkCue = (era: 'canal' | 'rail'): Cue => (era === 'rail' ? 'link-rail' : 'link-canal');

/** the block meets the paper: a dull press, the paper's short hiss and a
 *  small brass tick of the handle — a card struck firmer than a link */
export function stampThud(kind: 'tile' | 'link' = 'tile'): void {
  /* the moves behind the strike, if the table has just told us of them: a
     link is heard as its era's link, a machine's piece a little further off */
  const fresh = (s: Strike | null) => (s && Date.now() - s.at < STRIKE_FRESH_MS ? s : null);
  const tile = fresh(struck.tile);
  const link = fresh(struck.link);
  struck = { tile: null, link: null };
  const strike = kind === 'tile' ? tile : link;
  const quiet = strike ? !strike.mine : false;
  const name: Cue = kind === 'tile' ? 'stamp' : linkCue(strike?.era ?? wantEra ?? 'canal');
  if (kind === 'tile') {
    /* the trade of the tile, just behind the stamp that lays it */
    if (tile?.industry) cue(`ind-${tile.industry}`, { quiet, after: TRADE_AFTER_S });
    /* a link laid in the same breath (the board strikes once a frame) */
    if (link) cue(linkCue(link.era), { quiet: !link.mine, after: TRADE_AFTER_S });
  }
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

/** an industry laid on the board: its trade heard with the stamp */
export type TradeCue = `ind-${IndustryType}`;
export type Cue = 'turn' | 'stamp' | 'link-canal' | 'link-rail' | 'sell' | 'loan' | 'develop' | 'card' | 'scout' | 'era-end' | 'victory' | 'defeat' | 'click' | 'panel-open' | 'panel-close' | 'refuse' | TradeCue;
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
  'ind-coal': 'gestures',
  'ind-iron': 'gestures',
  'ind-cotton': 'gestures',
  'ind-manufacturer': 'gestures',
  'ind-pottery': 'gestures',
  'ind-brewery': 'gestures',
};
/** every cue of the palette, in the order of the table above (the sound board) */
export const cueNames = (): Cue[] => Object.keys(BUS_OF) as Cue[];
/** the interface's own small noises sit under the moves of the game, and a
 *  trade under the stamp it follows */
const TRADE_LEVEL = 0.6;
const CUE_LEVEL: Partial<Record<Cue, number>> = {
  click: 0.45,
  'panel-open': 0.4,
  'panel-close': 0.4,
  refuse: 0.7,
  'ind-coal': TRADE_LEVEL,
  'ind-iron': TRADE_LEVEL,
  'ind-cotton': TRADE_LEVEL,
  'ind-manufacturer': TRADE_LEVEL,
  'ind-pottery': TRADE_LEVEL,
  'ind-brewery': TRADE_LEVEL,
};
/** the trade comes in just behind the thump of the stamp, not on top of it */
const TRADE_AFTER_S = 0.07;
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

/** play one sound of the palette on its bus; `quiet` for another seat's
 *  move, `after` seconds from now */
export function cue(name: Cue, opts: { quiet?: boolean; after?: number } = {}): void {
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
    /* a moment is heard alone: a train in the distance, a voice in a town,
       make way for it */
    if (BUS_OF[name] === 'moments') hushLife(buf.duration + (opts.after ?? 0));
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    g.gain.setValueAtTime((CUE_LEVEL[name] ?? 1) * (opts.quiet ? MACHINE : 1), ac.currentTime);
    src.connect(g).connect(busOf(ac, BUS_OF[name]));
    src.start(ac.currentTime + (opts.after ?? 0));
    if (import.meta.env.DEV && heard.push(`${name}${opts.quiet ? ' (quiet)' : ''}`) > 40) heard.shift();
  });
}

/** the short sounds of the palette (a few kilobytes each), fetched once a
 *  table is sat at so the first of each is not late */
export function warmSounds(): void {
  if (!mix.on) return;
  for (const n of Object.keys(BUS_OF)) void sample(n);
  for (const h of HOUSES) void sample(`house-${h}`);
}

/* ---------------- the strike: who laid the piece the press is about to strike ---------------- */

interface Strike {
  era: 'canal' | 'rail';
  mine: boolean;
  at: number;
  /** a tile's industry, whose trade is heard with the stamp */
  industry?: IndustryType;
}
/** the last tile and the last link the table has just been told of; the
 *  press reads them once */
let struck: { tile: Strike | null; link: Strike | null } = { tile: null, link: null };
const STRIKE_FRESH_MS = 2000;
/** the table says a piece was laid, and by whom: the press that strikes it
 *  (stampThud, on the board's own beat) is heard accordingly */
export function noteStrike(kind: 'tile' | 'link', era: 'canal' | 'rail', mine: boolean, industry?: IndustryType): void {
  struck = { ...struck, [kind]: { era, mine, at: Date.now(), industry } };
}

/* ---------------- the ambience under the table ---------------- */

/** the era the table stands in (null: no table, the ambience goes) */
let wantEra: 'canal' | 'rail' | null = null;
let table: { era: 'canal' | 'rail'; src: AudioBufferSourceNode; gain: GainNode } | null = null;
const AMB_FADE = 3;
/** the canal's loop is birds over a quiet bed, levelled at -20 LUFS (its
 *  peaks would not allow more): brought up a little. The rail's is a low
 *  murmur of the town far off with a few birds, levelled at -26 LUFS so
 *  that it tires no one; its trains come now and then over it */
const AMB_TRIM: Record<'canal' | 'rail', number> = { canal: 1.4, rail: 1.2 };
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
  applyLife();
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
    gain.gain.linearRampToValueAtTime(AMB_TRIM[era], t0 + AMB_FADE);
    src.connect(gain).connect(busOf(ac, 'ambience'));
    src.start(t0);
    table = { era, src, gain };
  });
}

/* ---------------- each era's life: something somewhere off, now and then ---------------- */

/** the chance the tunes, the events and the voices are drawn with */
const chance: Chance = () => Math.random();
/** an event sits a little over the rail's bed, which is kept low (-26
 *  LUFS); under the canal's birds (-22 LUFS), whose band it leaves free */
const LIFE_LEVEL: Record<'canal' | 'rail', number> = { canal: 2, rail: 1.4 };
/** the events that go by, from one side to the other */
const CROSSING: readonly Life[] = ['life-passing', 'life-geese'];
let life: { era: 'canal' | 'rail'; name: Life; src: AudioBufferSourceNode; gain: GainNode } | null = null;
/** the wait for the next event */
let lifeTimer: ReturnType<typeof setTimeout> | null = null;
/** an event being fetched to be played; one asked for by hand */
let lifeAsking: object | null = null;
let lifeByHand: object | null = null;
let lastLife: Life | null = null;
/** no event before this time (Date.now()): a moment is being heard */
let hushUntil = 0;
/** the silence kept after a moment before an event may be heard again */
const HUSH_AFTER_S = 3;

const lifeWanted = (): boolean => mix.on && mix.ambience && wantEra !== null;

/** an era's events run while its ambience does: one at a time, each after
 *  a gap drawn afresh */
function applyLife(): void {
  /* another era's event goes with its ambience */
  if (life && life.era !== wantEra) {
    fadeOut(life, 1);
    life = null;
  }
  if (!lifeWanted()) {
    if (lifeTimer !== null) clearTimeout(lifeTimer);
    lifeTimer = null;
    lifeAsking = null;
    if (life) {
      fadeOut(life, 1);
      life = null;
    }
    return;
  }
  if (life || lifeTimer !== null || lifeAsking) return;
  waitLife(spanOf(LIFE_GAP, chance) * 1000);
}

function waitLife(ms: number): void {
  if (import.meta.env.DEV) lifeDue = Date.now() + ms;
  lifeTimer = setTimeout(() => {
    lifeTimer = null;
    playLife();
  }, ms);
}

function playLife(): void {
  const era = wantEra;
  if (!lifeWanted() || life || !era) return;
  /* a moment is being heard: the event waits for it */
  const now = Date.now();
  const at = lifeAt(now, hushUntil);
  if (at > now) {
    waitLife(at - now);
    return;
  }
  soundLife(era, nextOf<Life>(LIFE[era], lastLife, chance), false);
}

/** an event heard now: the one the scheduler drew, or (`forced`) one asked
 *  for by hand, which neither the switches nor a moment hold back */
function soundLife(era: 'canal' | 'rail', name: Life, forced: boolean): void {
  /* one asked for by hand waits on its own token: the scheduler, told the
     switches moved, lets go of its own fetch and not of this one */
  const token = {};
  if (forced) lifeByHand = token;
  else lifeAsking = token;
  void context().then(async (ac) => {
    const buf = ac ? await sample(name) : null;
    if ((forced ? lifeByHand : lifeAsking) !== token) return;
    if (forced) lifeByHand = null;
    else lifeAsking = null;
    /* before the first gesture nothing waits: the first touch asks again */
    if (!ac || (!forced && (!lifeWanted() || wantEra !== era))) return;
    /* the file could not be had, or a moment began meanwhile: later */
    if (!buf || (!forced && Date.now() < hushUntil)) {
      applyLife();
      return;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    const t0 = ac.currentTime;
    gain.gain.setValueAtTime(LIFE_LEVEL[era], t0);
    src.connect(gain);
    /* from one side of the valley or the other; a train or geese going by
       cross it */
    if (typeof ac.createStereoPanner === 'function') {
      const pan = ac.createStereoPanner();
      const side = (chance() * 2 - 1) * 0.6;
      pan.pan.setValueAtTime(side, t0);
      if (CROSSING.includes(name)) pan.pan.linearRampToValueAtTime(-side, t0 + buf.duration);
      gain.connect(pan).connect(busOf(ac, 'ambience'));
    } else gain.connect(busOf(ac, 'ambience'));
    src.onended = () => {
      if (life?.src !== src) return;
      life = null;
      applyLife();
    };
    src.start(t0);
    life = { era, name, src, gain };
    lastLife = name;
    if (import.meta.env.DEV && heard.push(name) > 40) heard.shift();
  });
}

/** a moment of the game is heard for `seconds`: no event and no voice
 *  over it, and one already sounding fades away */
function hushLife(seconds: number): void {
  hushUntil = Math.max(hushUntil, Date.now() + (seconds + HUSH_AFTER_S) * 1000);
  if (life) {
    fadeOut(life, 0.3);
    life = null;
    applyLife();
  }
  if (voice) {
    fadeOut(voice, 0.3);
    voice = null;
    voiceLastEnd = Date.now();
    say(null);
    applyVoices();
  }
}

/* ---------------- the townsfolk: a word in a town, now and then ---------------- */

/** where the table finds the next line: the game and what just stirred
 *  in its towns are the table's (useTableSounds), the timing is ours */
export interface VoiceSource {
  /** the line to say now and its town, or null when no one should speak */
  pick(chance: Chance, last: string | null): Spoken | null;
}
/** a line is heard over the ambience's bed and under the gestures:
 *  levelled at -22 LUFS, about -31 LUFS at the levels the settings open on
 *  (a piece laid comes to -27, the canal's birds to -38) */
const VOICE_LEVEL = 3.2;
let voiceSource: VoiceSource | null = null;
let voice: { id: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
let voiceTimer: ReturnType<typeof setTimeout> | null = null;
let voiceAsking: object | null = null;
let voiceByHand: object | null = null;
/** when the next voice is planned (Date.now()), when the last one ended,
 *  and the line it said */
let voicePlanned = 0;
let voiceLastEnd = 0;
let lastVoice: string | null = null;

const voicesWanted = (): boolean => mix.on && mix.voices && voiceSource !== null;

/** the townsfolk speak while the table says so (an era being played):
 *  one at a time, sparse; null silences them */
export function tableVoices(source: VoiceSource | null): void {
  voiceSource = source;
  applyVoices();
}

function applyVoices(): void {
  if (!voicesWanted()) {
    if (voiceTimer !== null) clearTimeout(voiceTimer);
    voiceTimer = null;
    voiceAsking = null;
    if (voice) {
      fadeOut(voice, 0.5);
      voice = null;
      say(null);
    }
    return;
  }
  if (voice || voiceTimer !== null || voiceAsking) return;
  voicePlanned = Date.now() + spanOf(VOICE_GAP, chance) * 1000;
  waitVoice(voicePlanned);
}

function waitVoice(at: number): void {
  if (voiceTimer !== null) clearTimeout(voiceTimer);
  voiceTimer = setTimeout(() => {
    voiceTimer = null;
    playVoice();
  }, Math.max(0, at - Date.now()));
}

/** something stirred in a town: its word comes a few seconds after,
 *  unless a voice was heard too lately (see voiceAt) */
export function voiceStir(): void {
  if (!voicesWanted() || voice || voiceAsking || voiceTimer === null) return;
  const now = Date.now();
  voicePlanned = voiceAt(voicePlanned, voiceLastEnd, now, spanOf(VOICE_REACT, chance));
  waitVoice(voicePlanned);
}

function playVoice(): void {
  if (!voicesWanted() || voice || !voiceSource) return;
  /* a moment is being heard: the voice waits for it */
  const now = Date.now();
  const at = lifeAt(now, hushUntil);
  if (at > now) {
    waitVoice(at);
    return;
  }
  const spoken = voiceSource.pick(chance, lastVoice);
  /* no one has a word to say now: later */
  if (!spoken) {
    applyVoices();
    return;
  }
  sayLine(spoken, false);
}

/** a line said now in its town: the one the table picked, or (`forced`)
 *  one asked for by hand, which neither the switches nor a moment hold back */
function sayLine(spoken: Pick<Spoken, 'line' | 'town'>, forced: boolean): void {
  /* a line asked for by hand waits on its own token, like an event */
  const token = {};
  if (forced) voiceByHand = token;
  else voiceAsking = token;
  void context().then(async (ac) => {
    const buf = ac ? await sample(spoken.line.id) : null;
    if ((forced ? voiceByHand : voiceAsking) !== token) return;
    if (forced) voiceByHand = null;
    else voiceAsking = null;
    /* before the first gesture nothing waits: the first touch asks again */
    if (!ac || (!forced && !voicesWanted())) return;
    if (!buf || (!forced && Date.now() < hushUntil)) {
      applyVoices();
      return;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    const t0 = ac.currentTime;
    gain.gain.setValueAtTime(VOICE_LEVEL, t0);
    src.connect(gain);
    /* from the side of the board the town stands on */
    if (typeof ac.createStereoPanner === 'function') {
      const pan = ac.createStereoPanner();
      pan.pan.setValueAtTime(panOf(spoken.town, WORLD_W), t0);
      gain.connect(pan).connect(busOf(ac, 'ambience'));
    } else gain.connect(busOf(ac, 'ambience'));
    src.onended = () => {
      if (voice?.src !== src) return;
      voice = null;
      voiceLastEnd = Date.now();
      applyVoices();
    };
    src.start(t0);
    voice = { id: spoken.line.id, src, gain };
    lastVoice = spoken.line.id;
    const who = CAST[spoken.line.who];
    say({ id: spoken.line.id, text: spoken.line.text, name: who.name, trade: who.trade, town: spoken.town, until: Date.now() + bubbleSpan(buf.duration) * 1000 });
    if (import.meta.env.DEV && heard.push(`${spoken.line.id} @ ${spoken.town}`) > 40) heard.shift();
  });
}

/* ---------------- what is being said, for the bubble over the town ---------------- */

/** the line being said, where, and until when its bubble stays up */
export interface Said {
  id: string;
  text: string;
  name: string;
  trade: string;
  town: string;
  /** Date.now() at which the bubble goes */
  until: number;
}
let said: Said | null = null;
let saidTimer: ReturnType<typeof setTimeout> | null = null;
const saidListeners = new Set<() => void>();

function say(next: Said | null): void {
  if (saidTimer !== null) clearTimeout(saidTimer);
  saidTimer = null;
  said = next;
  if (next) {
    const spoken = next;
    saidTimer = setTimeout(() => {
      if (said === spoken) say(null);
    }, Math.max(0, next.until - Date.now()));
  }
  for (const fn of [...saidListeners]) fn();
}

/** what is being said now (null: nothing) */
export const saidNow = (): Said | null => said;

/** be told when a line is said and when its bubble goes */
export function onSaid(fn: () => void): () => void {
  saidListeners.add(fn);
  return () => saidListeners.delete(fn);
}

/* ---------------- the era's tunes ---------------- */

/** the era whose tunes are wanted: a table sat at, in the play of an era */
let wantTunes: Era | null = null;
let tune: { era: Era; name: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
/** the era the playlist runs for (null: none runs) */
let tuneEra: Era | null = null;
/** the wait for the next tune: the first of an era, or a pause between two */
let tuneTimer: ReturnType<typeof setTimeout> | null = null;
/** a tune being fetched to be played */
let asking: object | null = null;
/** never the same tune twice in a row */
let lastTune: string | null = null;
/** a tune comes in slowly and leaves as slowly: the rail era arrives under
 *  the whistle, not after a cut */
const TUNE_IN = 5;
const TUNE_OUT = 4;
/** a loop heard its turns is faded over its last bars */
const TUNE_END = 6;

/** the tunes of this era, one after another with the ambience alone
 *  between them, while `era` is played; faded out when the era closes,
 *  when the game ends and when the table is left */
export function tableMusic(era: Era | null): void {
  wantTunes = era;
  applyMusic();
}

function applyMusic(): void {
  const era = mix.on && mix.music ? wantTunes : null;
  if (tune && tune.era !== era) {
    /* the switch shut is obeyed at once; the era's close is heard out */
    fadeOut(tune, mix.on && mix.music ? TUNE_OUT : 1);
    tune = null;
  }
  if (tuneEra !== era) {
    if (tuneTimer !== null) clearTimeout(tuneTimer);
    tuneTimer = null;
    asking = null;
    tuneEra = era;
  }
  if (!era || tune || tuneTimer !== null || asking) return;
  /* nothing sounds and nothing waits: the era's first tune, shortly */
  waitTune(spanOf(TUNE_FIRST, chance));
}

/** the next tune of the playlist, after `seconds` of the ambience alone */
function waitTune(seconds: number): void {
  const era = tuneEra;
  if (!era) return;
  const name = nextOf(
    TUNES[era].map((t) => t.name),
    lastTune,
    chance,
  );
  /* fetched during the wait, so it is ready when its time comes */
  void sample(name);
  if (import.meta.env.DEV) tuneDue = Date.now() + seconds * 1000;
  tuneTimer = setTimeout(() => {
    tuneTimer = null;
    playTune(era, name);
  }, seconds * 1000);
}

function playTune(era: Era, name: string): void {
  const t = tuneOf(era, name);
  if (!t || tuneEra !== era || tune) return;
  const token = {};
  asking = token;
  void context().then(async (ac) => {
    const buf = ac ? await sample(name) : null;
    if (asking !== token) return;
    asking = null;
    /* before the first gesture nothing waits: the first touch asks again */
    if (!ac || tuneEra !== era) return;
    /* the file could not be had: the ambience alone, and another later */
    if (!buf) {
      waitTune(spanOf(TUNE_PAUSE, chance));
      return;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    const t0 = ac.currentTime;
    const length = tuneLength(t, buf.duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(1, t0 + TUNE_IN);
    if (t.loop) {
      /* the loop's own length (an MP3's padding past it is left out), as
         many turns as it is given, and faded over the last bars */
      src.loop = true;
      src.loopStart = 0;
      src.loopEnd = Math.min(buf.duration, t.loop);
      gain.gain.setValueAtTime(1, t0 + length - TUNE_END);
      gain.gain.linearRampToValueAtTime(0.0001, t0 + length);
    }
    src.connect(gain).connect(busOf(ac, 'music'));
    /* heard to its end: the ambience alone for a while, then another */
    src.onended = () => {
      if (tune?.src !== src) return;
      tune = null;
      waitTune(spanOf(TUNE_PAUSE, chance));
    };
    src.start(t0);
    /* a loop is stopped after its turns — only once started: a source told
       to stop before it starts throws, and the era's playlist died with it */
    if (t.loop) src.stop(t0 + length + 0.05);
    tune = { era, name, src, gain };
    lastTune = name;
    if (import.meta.env.DEV && heard.push(name) > 40) heard.shift();
  });
}

/* the first touch of the page opens the way: what was wanted before it —
   the ambience of the table already sat at, the era's tunes — starts then */
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  const first = () => {
    window.removeEventListener('pointerdown', first, true);
    window.removeEventListener('keydown', first, true);
    /* the activation is recorded once this handler has run */
    window.setTimeout(() => {
      applyAmbience();
      applyMusic();
      applyVoices();
      if (wantEra) warmSounds();
    }, 0);
  };
  window.addEventListener('pointerdown', first, true);
  window.addEventListener('keydown', first, true);
}

/* ---------------- by hand: the test bench asks for a sound at once ---------------- */

/** a line of the townsfolk said now in `town`, its bubble up, whatever the
 *  scheduler had planned or the switches say; the next one is planned
 *  afresh once it is over */
export function sayNow(line: Line, town: string): void {
  if (voiceTimer !== null) clearTimeout(voiceTimer);
  voiceTimer = null;
  if (voice) {
    fadeOut(voice, 0.3);
    voice = null;
  }
  sayLine({ line, town }, true);
}

/** one of an era's events heard now, with its era's level and its crossing */
export function lifeNow(name: Life): void {
  if (lifeTimer !== null) clearTimeout(lifeTimer);
  lifeTimer = null;
  if (life) {
    fadeOut(life, 0.3);
    life = null;
  }
  soundLife((LIFE.canal as readonly string[]).includes(name) ? 'canal' : 'rail', name, true);
}

/** the era's next tune at once: the pause cut short, or the tune playing
 *  faded into the next. False when no era's tunes run (the music switch
 *  shut, no era being played) */
export function tuneNow(): boolean {
  const era = tuneEra;
  if (!era) return false;
  if (tuneTimer !== null) clearTimeout(tuneTimer);
  tuneTimer = null;
  asking = null;
  if (tune) {
    fadeOut(tune, 1.5);
    tune = null;
  }
  playTune(
    era,
    nextOf(
      TUNES[era].map((t) => t.name),
      lastTune,
      chance,
    ),
  );
  return true;
}

/** any recording of the palette heard once on a bus, whatever the switches
 *  say (the sound board): a way to stop it and its length, or null when it
 *  cannot be had */
export async function playRecording(name: string, bus: Bus): Promise<{ stop: () => void; seconds: number } | null> {
  const ac = await context();
  if (!ac) return null;
  const buf = decoded.get(name) ?? (await sample(name));
  if (!buf) return null;
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.connect(busOf(ac, bus));
  src.start();
  if (import.meta.env.DEV && heard.push(`${name} (by hand)`) > 40) heard.shift();
  return {
    stop: () => {
      try {
        src.stop();
      } catch {
        /* already over */
      }
    },
    seconds: buf.duration,
  };
}

/* dev only: what is sounding right now and what is coming (window.__sfx
   .playing(), .ambience(), .life(), .music(), .voice(), .said(), .next(),
   .heard()), and a voice asked for at once (.speak()) */
const heard: string[] = [];
/** the seconds until a wait ends, rounded, or null when nothing waits */
const dueIn = (at: number | null): number | null => (at === null ? null : Math.round((at - Date.now()) / 100) / 10);
let lifeDue: number | null = null;
let tuneDue: number | null = null;
if (import.meta.env.DEV && typeof window !== 'undefined')
  (window as unknown as { __sfx?: Record<string, () => unknown> }).__sfx = {
    playing: () => playing?.id ?? null,
    ambience: () => table?.era ?? null,
    life: () => life?.name ?? null,
    music: () => tune?.name ?? null,
    voice: () => voice?.id ?? null,
    said: () => said,
    /* what waits: the next event and the next voice, in seconds */
    next: () => ({ life: life ? life.name : lifeTimer !== null ? dueIn(lifeDue) : null, voice: voice ? voice.id : voiceTimer !== null ? dueIn(voicePlanned) : null, tune: tune ? tune.name : tuneTimer !== null ? dueIn(tuneDue) : null, hushedFor: hushUntil > Date.now() ? dueIn(hushUntil) : 0 }),
    speak: () => {
      voicePlanned = Date.now();
      waitVoice(voicePlanned);
      return voicesWanted();
    },
    heard: () => heard.slice(),
  };
