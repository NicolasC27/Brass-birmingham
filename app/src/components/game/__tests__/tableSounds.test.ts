import { describe, expect, it } from 'vitest';
import type { GameState, LedgerEntry } from '@/game/types';
import { tableCues, tuneWanted } from '../useTableSounds';
import type { Heard, TableShot } from '../useTableSounds';

/* a table of three: me at seat 0, a machine at 1, another at 2 */
const game = (over: Partial<GameState> = {}): GameState =>
  ({
    seed: 7,
    era: 'canal',
    round: 2,
    phase: 'action',
    current: 1,
    players: [{ isBot: false }, { isBot: true }, { isBot: true }],
    ledger: [],
    ...over,
  }) as unknown as GameState;

const shot = (g: GameState | null, over: Partial<TableShot> = {}): TableShot => ({ game: g, seat: null, shakeAt: null, refusedAt: null, verb: null, card: null, panel: false, ...over });

let id = 0;
const entry = (verb: LedgerEntry['verb'], player: number | undefined, era: 'canal' | 'rail' = 'canal'): LedgerEntry => ({ id: ++id, round: 2, era, player, verb, text: '' });

const cues = (h: Heard[]) => h.map((x) => ('cue' in x ? `${x.cue}${x.quiet ? '~' : ''}` : `strike:${x.strike}:${x.era}:${x.mine ? 'mine' : 'theirs'}`));

describe('what the table sounds like', () => {
  it('hears nothing of a table just sat at, nor of another game', () => {
    const g = game({ current: 0 });
    expect(tableCues(shot(null), shot(g))).toEqual([]);
    expect(tableCues(shot(game({ seed: 1 })), shot(g))).toEqual([]);
  });

  it('rings the station bell when the turn comes round to me, once', () => {
    const before = game({ current: 1 });
    const mine = game({ current: 0 });
    expect(cues(tableCues(shot(before), shot(mine)))).toEqual(['turn']);
    /* my second action of the same turn rings nothing */
    expect(cues(tableCues(shot(mine), shot(game({ current: 0 }))))).toEqual([]);
    /* last of one round and first of the next: a new turn, the bell again */
    expect(cues(tableCues(shot(mine), shot(game({ current: 0, round: 3 }))))).toEqual(['turn']);
    /* a machine's turn rings nothing */
    expect(cues(tableCues(shot(mine), shot(game({ current: 2 }))))).toEqual([]);
  });

  it('online, only my own seat is mine', () => {
    const online = (g: GameState) => shot(g, { seat: 2 });
    expect(cues(tableCues(online(game({ current: 0 })), online(game({ current: 2 }))))).toEqual(['turn']);
    expect(cues(tableCues(online(game({ current: 2 })), online(game({ current: 0 }))))).toEqual([]);
  });

  it('tells the press who laid a tile or a link, and in which era', () => {
    const a = game({ ledger: [entry('build', 0)] });
    const b = game({ ledger: [...a.ledger, entry('build', 1)] });
    expect(cues(tableCues(shot(a), shot(b)))).toEqual(['strike:tile:canal:theirs']);
    const railB = game({ era: 'rail', ledger: b.ledger });
    const c = game({ era: 'rail', ledger: [...b.ledger, entry('network', 0, 'rail')] });
    expect(cues(tableCues(shot(railB), shot(c)))).toEqual(['strike:link:rail:mine']);
  });

  it('tells the press which trade a tile is, when the log says', () => {
    const built = (industry: unknown) => ({ ...entry('build', 0), vars: { industry } as Record<string, string> });
    const a = game();
    const b = game({ ledger: [built('pottery'), { ...entry('network', 1) }] });
    expect(tableCues(shot(a), shot(b))).toEqual([
      { strike: 'tile', era: 'canal', mine: true, industry: 'pottery' },
      { strike: 'link', era: 'canal', mine: false },
    ]);
    /* a word the palette does not know is no trade */
    const c = game({ ledger: [built('windmill')] });
    expect(tableCues(shot(a), shot(c))).toEqual([{ strike: 'tile', era: 'canal', mine: true, industry: undefined }]);
  });

  it('gives each other move its own sound, a machine’s further off', () => {
    const a = game({ ledger: [] });
    const b = game({ ledger: [entry('sell', 0), entry('loan', 1), entry('develop', 2), entry('scout', 0), entry('pass', 1)] });
    expect(cues(tableCues(shot(a), shot(b)))).toEqual(['sell', 'loan~', 'develop~', 'scout', 'card~']);
  });

  it('sounds a move once however many entries it wrote', () => {
    const a = game();
    const b = game({ ledger: [entry('sell', 0), entry('sell', 0)] });
    expect(cues(tableCues(shot(a), shot(b)))).toEqual(['sell']);
  });

  it('keeps quiet over a board read back whole', () => {
    const a = game();
    const b = game({ ledger: Array.from({ length: 12 }, () => entry('sell', 1)) });
    expect(cues(tableCues(shot(a), shot(b)))).toEqual([]);
  });

  it('hears nothing of a move taken back', () => {
    const a = game({ ledger: [entry('build', 0), entry('sell', 0)] });
    const b = game({ ledger: a.ledger.slice(0, 1) });
    expect(cues(tableCues(shot(a), shot(b)))).toEqual([]);
  });

  it('blows the whistle once as the canal era closes', () => {
    const a = game({ current: 2 });
    const scoring = game({ phase: 'scoring-canal', current: 2 });
    expect(cues(tableCues(shot(a), shot(scoring)))).toEqual(['era-end']);
    /* the rail era opening after the ceremony is not a second whistle */
    const rail = game({ phase: 'action', era: 'rail', round: 1, current: 1 });
    expect(cues(tableCues(shot(scoring), shot(rail)))).toEqual([]);
    /* straight from canal to rail, without the ceremony, it is heard */
    expect(cues(tableCues(shot(a), shot(rail)))).toEqual(['era-end']);
  });

  it('plays the band for my win, muted for any other rank', () => {
    const a = game({ era: 'rail', current: 2 });
    expect(cues(tableCues(shot(a), shot(game({ era: 'rail', phase: 'game-over', winner: 0 }))))).toEqual(['victory']);
    expect(cues(tableCues(shot(a), shot(game({ era: 'rail', phase: 'game-over', winner: 1 }))))).toEqual(['defeat']);
    /* a table watched from no seat hears the winner's band */
    const watch = (g: GameState) => shot(g, { seat: -1 });
    expect(cues(tableCues(watch(a), watch(game({ era: 'rail', phase: 'game-over', winner: 1 }))))).toEqual(['victory']);
  });

  it('rings no turn bell over the end of the game', () => {
    const a = game({ era: 'rail', current: 2 });
    const over = game({ era: 'rail', phase: 'game-over', winner: 0, current: 0 });
    expect(cues(tableCues(shot(a), shot(over)))).not.toContain('turn');
  });

  it('knocks on the wood when a move is turned down, here or by the office', () => {
    const g = game({ current: 0 });
    expect(cues(tableCues(shot(g), shot(g, { shakeAt: 100 })))).toEqual(['refuse']);
    expect(cues(tableCues(shot(g, { shakeAt: 100 }), shot(g, { shakeAt: 100 })))).toEqual([]);
    expect(cues(tableCues(shot(g), shot(g, { refusedAt: 14 })))).toEqual(['refuse']);
  });

  it('answers the hand: a card taken up, a verb chosen, a panel opened and shut', () => {
    const g = game({ current: 0 });
    expect(cues(tableCues(shot(g), shot(g, { card: 'c1' })))).toEqual(['card']);
    expect(cues(tableCues(shot(g, { card: 'c1' }), shot(g, { card: 'c1', verb: 'build' })))).toEqual(['click']);
    expect(cues(tableCues(shot(g, { card: 'c1' }), shot(g, { card: null })))).toEqual([]);
    expect(cues(tableCues(shot(g), shot(g, { panel: true })))).toEqual(['panel-open']);
    expect(cues(tableCues(shot(g, { panel: true }), shot(g)))).toEqual(['panel-close']);
  });
});

describe('the canal’s tune', () => {
  it('is wanted while the canal era is played, and only then', () => {
    expect(tuneWanted(game())).toBe(true);
    /* the era's close: the whistle is heard alone */
    expect(tuneWanted(game({ phase: 'scoring-canal' }))).toBe(false);
    expect(tuneWanted(game({ era: 'rail' }))).toBe(false);
    expect(tuneWanted(game({ era: 'canal', phase: 'game-over' }))).toBe(false);
    expect(tuneWanted(game({ era: 'rail', phase: 'game-over' }))).toBe(false);
    /* no table, no tune */
    expect(tuneWanted(null)).toBe(false);
  });
});
