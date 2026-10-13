import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyAction, botAction, fallbackAction } from '../actions';
import { chooseBotMove, reachOf } from '../bot';
import { LINKS, TOWNS } from '../data';
import { newGame, reachable } from '../engine';
import { edgeOf, edgesOf, followToTurn, playOut, winChance, winChances } from '../analysis';
import { legalActions, playListed } from '../search';
import { coachMove, dismissCoach } from '../coach';
import type { Coached } from '../coach';
import type { GameState, SetupPayload } from '../types';

/* every table the engine plays is counted, to tell a table handed over
   from one played again */
const engine = vi.hoisted(() => ({ plays: 0 }));
vi.mock('../actions', async (load) => {
  const real = await load<typeof import('../actions')>();
  return {
    ...real,
    applyAction: (...args: Parameters<typeof real.applyAction>) => {
      engine.plays += 1;
      return real.applyAction(...args);
    },
  };
});

/* the judge must never ask the table's easing: the hospitality rule is
   swapped for one that throws, and every reading has to go round it */
vi.mock('../search', async (load) => {
  const real = await load<typeof import('../search')>();
  return {
    ...real,
    chooseBotAction: () => {
      throw new Error('the judge asked the table how hard to play');
    },
    adaptiveStrength: () => {
      throw new Error('the judge asked the table how hard to play');
    },
  };
});

const setup = (assist: boolean): SetupPayload => ({
  players: [
    { name: 'You', color: 'brass', type: 'human' },
    { name: 'Mrs Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    { name: 'Miss Arkwright', color: 'verdigris', type: 'bot', persona: 'arkwright' },
  ],
  options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist },
});

/** a game played on by the heuristic, every position kept */
function positions(seed: number, most: number): GameState[] {
  let s = newGame(setup(false), seed);
  const out: GameState[] = [];
  for (let n = 0; n < most && s.phase !== 'game-over'; n++) {
    if (s.phase === 'scoring-canal') {
      s = applyAction(s, s.current, { kind: 'begin-rail' }).state!;
      continue;
    }
    out.push(s);
    const a = botAction(chooseBotMove(s, s.current)) ?? fallbackAction(s, s.current);
    s = applyAction(s, s.current, a).state ?? applyAction(s, s.current, fallbackAction(s, s.current)).state!;
  }
  return out;
}

const PLAYED = positions(7, 220);

describe('the stretches of line', () => {
  it('reach exactly what the engine reaches, from every place, canal and rail', () => {
    expect(PLAYED.some((s) => s.era === 'rail' && Object.keys(s.links).length > 0)).toBe(true);
    for (const s of PLAYED.filter((_, k) => k % 9 === 0)) {
      const places = [...new Set([...TOWNS.map((t) => t.id), ...LINKS.flatMap((d) => [d.a, d.b])])];
      for (const town of places) expect([...reachOf(s, town)].sort(), `${s.era} ${town}`).toEqual([...reachable(s, town, s.era, null)].sort());
    }
  });

  it('are walked again when a link is laid by hand on the same table', () => {
    const s = structuredClone(PLAYED[0]);
    const def = LINKS.find((d) => d.canal && !s.links[d.id])!;
    expect(reachOf(s, def.a).has(def.b)).toBe(false);
    s.links[def.id] = { owner: 0, era: 'canal' };
    expect(reachOf(s, def.a).has(def.b)).toBe(true);
    expect([...reachOf(s, def.a)].sort()).toEqual([...reachable(s, def.a, s.era, null)].sort());
  });
});

describe('the moves already played while listing them', () => {
  it('hand back the very table the engine plays, once, and only where they were listed', () => {
    let kept = 0;
    for (const s of PLAYED.filter((_, k) => k % 3 === 0)) {
      const i = s.current;
      for (const a of legalActions(s, i)) {
        const before = engine.plays;
        const first = playListed(s, i, a);
        if (engine.plays === before) kept += 1;
        expect(first).toEqual(applyAction(s, i, a).state);
        /* a kept table is never handed out twice */
        const again = engine.plays;
        expect(playListed(s, i, a)).toEqual(first);
        expect(engine.plays).toBe(again + 1);
      }
      /* nor to another position, however alike */
      for (const a of legalActions(s, i)) {
        const before = engine.plays;
        playListed({ ...s }, i, a);
        expect(engine.plays).toBe(before + 1);
      }
    }
    expect(kept).toBeGreaterThan(0);
  }, 20_000);
});

describe('the table read once a seat', () => {
  it('gives every seat the edge and the chance it would have had alone', () => {
    for (const s of PLAYED.filter((_, k) => k % 11 === 0)) {
      const all = edgesOf(s);
      const chances = winChances(s);
      s.players.forEach((_, i) => {
        expect(all[i]).toBe(edgeOf(s, i));
        expect(chances[i]).toBe(winChance(s, i));
      });
    }
  });
});

describe('the judge', () => {
  it('plays the continuation at the strength it asks for, whatever house rule the table keeps', () => {
    const s = { ...newGame(setup(true), 11), assist: true };
    expect(s.assist).toBe(true);
    const followed = followToTurn(s, 0, 5, 3);
    expect(followed.length).toBeGreaterThan(0);
    const end = playOut(s, 5, 6);
    expect(end.actions.length).toBeGreaterThan(s.actions.length);
  });
});

/* ------------------------------ the coach ------------------------------ */

class FakeWorker {
  static made: FakeWorker[] = [];
  sent: unknown[] = [];
  gone = false;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: ((e: MessageEvent) => void) | null = null;
  constructor() {
    FakeWorker.made.push(this);
  }
  postMessage(m: unknown): void {
    this.sent.push(m);
  }
  terminate(): void {
    this.gone = true;
  }
  say(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe('the coach', () => {
  const real = globalThis.Worker;
  afterEach(() => {
    dismissCoach();
    globalThis.Worker = real;
    FakeWorker.made = [];
  });

  const at = newGame(setup(true), 3);
  const move = fallbackAction(at, at.current);

  it('lets a worker that fails go, tells the move waiting on it, and starts afresh', () => {
    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    const heard: (Coached | null)[] = [];
    coachMove(at, at.current, move, (c) => heard.push(c));
    const first = FakeWorker.made[0];
    first.onerror?.({ message: 'gone' } as ErrorEvent);
    expect(first.gone).toBe(true);
    expect(heard).toEqual([null]);
    coachMove(at, at.current, move, (c) => heard.push(c));
    expect(FakeWorker.made).toHaveLength(2);
    FakeWorker.made[1].onmessageerror?.({} as MessageEvent);
    expect(FakeWorker.made[1].gone).toBe(true);
    expect(heard).toEqual([null, null]);
  });

  it('closes an ask the worker could not read, and ignores the answer to one overtaken', () => {
    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    const heard: string[] = [];
    coachMove(at, at.current, move, () => heard.push('first'));
    coachMove(at, at.current, move, (c) => heard.push(c ? `second:${c.at}` : 'second:none'));
    const w = FakeWorker.made[0];
    expect(FakeWorker.made).toHaveLength(1);
    /* the first ask could not be read: it was overtaken, nobody is told */
    w.say({ kind: 'failed', why: 'a move refused on the way' });
    expect(heard).toEqual([]);
    const key = (w.sent[1] as { key: string }).key;
    w.say({ kind: 'one', key, verdict: { at: 0 } });
    expect(heard).toEqual([`second:${at.actions.length}`]);
    expect(w.gone).toBe(false);
  });
});
