import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newGame } from '@/game/engine';
import type { GameState, LedgerEntry, SetupPayload } from '@/game/types';
import { LIFE, TUNES } from '../playlist';
import type { Chance } from '../playlist';
import { CAST, LINES, STIR_FRESH_MS, freshStirs, panOf, pickVoice, stirsOf } from '../voices';
import type { Stir } from '../voices';

const setup: SetupPayload = {
  players: [
    { name: 'Mr Watt', color: 'oxblood', type: 'bot', persona: 'watt' },
    { name: 'Mr Boulton', color: 'brass', type: 'bot', persona: 'boulton' },
  ],
  options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
};

/** a seeded chance (mulberry32), so a long run is the same every time */
const seeded = (seed: number): Chance => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const always = (v: number): Chance => () => v;

const game = (): GameState => newGame(setup, 7);
/** the same game, one move on: `change` edits a copy */
const after = (g: GameState, change: (h: GameState) => void): GameState => {
  const h = structuredClone(g);
  change(h);
  return h;
};
const entry = (g: GameState, e: Partial<LedgerEntry>): LedgerEntry => ({ id: g.ledgerSeq, round: g.round, era: g.era, player: 0, verb: 'build', text: '', ...e });

describe('what stirs a town', () => {
  it('a works paid off pleases its town', () => {
    const a = after(game(), (h) => {
      h.tiles['belper:0'] = { owner: 0, industry: 'cotton', level: 1, flipped: false, cubes: 0 };
    });
    const b = after(a, (h) => {
      h.tiles['belper:0'].flipped = true;
    });
    expect(stirsOf(a, b, 1000)).toEqual([{ town: 'belper', mood: 'glad', about: 'cotton', weight: 2, at: 1000 }]);
  });

  it('coal bought dear sets the buyer’s town grumbling; bought cheap, nothing', () => {
    const a = after(game(), (h) => {
      h.market.coal = 6;
    });
    /* two cubes taken, the last at £5: dear, bought for a works at Stoke */
    const dear = after(a, (h) => {
      h.market.coal = 4;
      h.ledger.push(entry(h, { verb: 'build', region: 'stoke', vars: { industry: 'pottery' } }));
    });
    const stirs = stirsOf(a, dear, 5);
    expect(stirs).toContainEqual({ town: 'stoke', mood: 'grumble', about: 'coal', weight: 2, at: 5 });
    /* the works itself pleases the town a little */
    expect(stirs).toContainEqual({ town: 'stoke', mood: 'glad', about: 'pottery', weight: 1, at: 5 });
    /* a full tray: the cube taken cost £1 */
    const full = after(game(), (h) => {
      h.market.coal = 14;
    });
    const cheap = after(full, (h) => {
      h.market.coal = 13;
    });
    expect(stirsOf(full, cheap, 5).filter((s) => s.mood === 'grumble')).toEqual([]);
  });

  it('the market emptied is a grumble even if the last cube was not the dearest', () => {
    const a = after(game(), (h) => {
      h.market.iron = 1;
    });
    const b = after(a, (h) => {
      h.market.iron = 0;
    });
    expect(stirsOf(a, b, 0)).toEqual([{ town: null, mood: 'grumble', about: 'iron', weight: 2, at: 0 }]);
  });

  it('nothing of another game, of a board caught up, or once the game is over', () => {
    const a = game();
    const other = newGame(setup, 8);
    expect(stirsOf(a, other, 0)).toEqual([]);
    expect(stirsOf(null, a, 0)).toEqual([]);
    const caughtUp = after(a, (h) => {
      for (let i = 0; i < 9; i++) h.ledger.push(entry(h, { id: h.ledgerSeq + i, region: 'stoke', vars: { industry: 'pottery' } }));
    });
    expect(stirsOf(a, caughtUp, 0)).toEqual([]);
    const over = after(a, (h) => {
      h.phase = 'game-over';
      h.market.coal = 0;
    });
    expect(stirsOf(a, over, 0)).toEqual([]);
  });

  it('keeps a stir two minutes, the most deserving and the latest first', () => {
    const s = (weight: number, at: number): Stir => ({ town: 'stoke', mood: 'glad', weight, at });
    const kept = freshStirs([s(1, 50_000), s(2, 10_000), s(2, 40_000), s(2, -200_000)], 60_000);
    expect(kept.map((x) => [x.weight, x.at])).toEqual([
      [2, 40_000],
      [2, 10_000],
      [1, 50_000],
    ]);
    expect(freshStirs([s(2, 0)], STIR_FRESH_MS + 1)).toEqual([]);
  });
});

describe('who says what, where', () => {
  const built = after(game(), (h) => {
    h.tiles['stoke:0'] = { owner: 0, industry: 'pottery', level: 1, flipped: false, cubes: 0 };
    h.tiles['dudley:0'] = { owner: 1, industry: 'iron', level: 1, flipped: false, cubes: 2 };
  });

  it('a stir is answered in its town, in its mood, about its trade', () => {
    const stir: Stir = { town: 'stoke', mood: 'glad', about: 'pottery', weight: 2, at: 0 };
    const spoken = pickVoice(built, [stir], null, always(0.3))!;
    expect(spoken.town).toBe('stoke');
    expect(spoken.line.id).toBe('bark-kezia-kiln');
    expect(spoken.stir).toBe(stir);
    /* said just before: another pleased line instead of the same again */
    const again = pickVoice(built, [stir], 'bark-kezia-kiln', always(0.3))!;
    expect(again.line.mood).toBe('glad');
    expect(again.line.id).not.toBe('bark-kezia-kiln');
    expect(again.line.about).toBeUndefined();
  });

  it('a grumble about coal where the buyer built, or where coal is mined', () => {
    const dear: Stir = { town: 'dudley', mood: 'grumble', about: 'coal', weight: 2, at: 0 };
    const spoken = pickVoice(built, [dear], null, seeded(1))!;
    expect(spoken.town).toBe('dudley');
    expect(['bark-ezra-dear', 'bark-kezia-coal']).toContain(spoken.line.id);
    const nowhere: Stir = { town: null, mood: 'grumble', about: 'iron', weight: 2, at: 0 };
    expect(pickVoice(built, [nowhere], null, seeded(2))!.town).toBe('dudley');
  });

  it('left to itself, speaks in every mood, only of trades built, and of dear coal only when it is dear', () => {
    const chance = seeded(3);
    const said = new Map<string, number>();
    let last: string | null = null;
    for (let i = 0; i < 2000; i++) {
      const spoken = pickVoice(built, [], last, chance);
      if (!spoken) continue;
      expect(spoken.line.id).not.toBe(last);
      last = spoken.line.id;
      said.set(spoken.line.id, (said.get(spoken.line.id) ?? 0) + 1);
      /* a line about a trade, where that trade stands */
      if (spoken.line.about === 'pottery') expect(spoken.town).toBe('stoke');
      if (spoken.line.about === 'iron' && spoken.line.mood === 'glad') expect(spoken.town).toBe('dudley');
      /* never a line of the other era */
      expect(spoken.line.era ?? 'canal').toBe('canal');
    }
    const moods = new Set(LINES.filter((l) => said.has(l.id)).map((l) => l.mood));
    expect([...moods].sort()).toEqual(['glad', 'grumble', 'plain']);
    /* no brewery, no cotton built: not a word of them */
    expect([...said.keys()].filter((id) => /hands|fluff|finest|watered|testing/.test(id))).toEqual([]);
    /* the market as it opens (coal at £2 or so): no complaint of its price */
    expect(said.has('bark-ezra-dear')).toBe(false);
    expect(said.has('bark-tom-dear')).toBe(false);
    /* every character is heard */
    expect(new Set(LINES.filter((l) => said.has(l.id)).map((l) => l.who)).size).toBe(Object.keys(CAST).length);
  });

  it('the rail era brings its own lines and drops the towpath', () => {
    const rail = after(built, (h) => {
      h.era = 'rail';
    });
    const chance = seeded(4);
    const eras = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const spoken = pickVoice(rail, [], null, chance);
      if (spoken?.line.era) eras.add(spoken.line.era);
    }
    expect([...eras]).toEqual(['rail']);
  });

  it('no one speaks while an era is scored, once the game is over, or with no game', () => {
    expect(pickVoice(after(built, (h) => (h.phase = 'scoring-canal')), [], null, always(0.5))).toBeNull();
    expect(pickVoice(after(built, (h) => (h.phase = 'game-over')), [], null, always(0.5))).toBeNull();
    expect(pickVoice(null, [], null, always(0.5))).toBeNull();
  });

  it('is heard from the side of the board its town stands on', () => {
    /* Coalbrookdale in the west, Nuneaton in the east */
    expect(panOf('coalbrookdale', 3200)).toBeLessThan(0);
    expect(panOf('nuneaton', 3200)).toBeGreaterThan(0);
    expect(Math.abs(panOf('coalbrookdale', 3200))).toBeLessThanOrEqual(0.5);
    expect(panOf('nowhere', 3200)).toBe(0);
  });
});

describe('the recordings', () => {
  const root = resolve(__dirname, '../../../..');
  const served = (name: string) => ['webm', 'mp3'].every((ext) => existsSync(resolve(root, `app/public/sfx/${name}.${ext}`)));

  it('every line, event and tune is served in both formats', () => {
    for (const l of LINES) expect(served(l.id), l.id).toBe(true);
    for (const n of [...LIFE.canal, ...LIFE.rail]) expect(served(n), n).toBe(true);
    for (const t of [...TUNES.canal, ...TUNES.rail]) expect(served(t.name), t.name).toBe(true);
  });

  it('every line shown is the line recorded, without its stage directions', () => {
    const script = readFileSync(resolve(root, 'tools/assets/sfx/generate.py'), 'utf8');
    const recorded = new Map<string, string>();
    for (const m of script.matchAll(/^ {4}'(bark-[a-z-]+)': \('[a-z]+', \d+, (["'])(.*)\2\),$/gm)) recorded.set(m[1], m[3]);
    const plain = (s: string) =>
      s
        .replace(/\[[^\]]*\]/g, '')
        .replace(/[’']/g, "'")
        .replace(/…|\.\.\./g, '...')
        .replace(/\s+/g, ' ')
        .trim();
    expect([...recorded.keys()].sort()).toEqual(LINES.map((l) => l.id).sort());
    for (const l of LINES) expect(plain(l.text).toLowerCase(), l.id).toBe(plain(recorded.get(l.id)!).toLowerCase());
  });
});
