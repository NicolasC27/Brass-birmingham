import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameAction } from '../actions';
import { newGame, serialize } from '../engine';
import type { HomeSave } from '@/online/table';
import type { GameState, SetupPayload } from '../types';

/* ------------------------------------------------------------------ */
/* A game at home and the office that keeps its log. The office here   */
/* is a stand-in with the wire's own manners: it answers a question,   */
/* and a move with its word on it — the refusal heard by the listeners */
/* first — or, down a dead line, not at all.                           */
/* ------------------------------------------------------------------ */

type Refusal = { code: string; at: number; error: string };

class Office {
  status: 'offline' | 'connecting' | 'online' = 'online';
  stranger = false;
  /** the office does not answer: every question times out */
  silent = false;
  /** the next move is turned down with these words */
  refuseNext: string | null = null;
  opened = 0;
  saves = new Map<string, HomeSave>();
  private refusals = new Set<(r: Refusal) => void>();
  private states = new Set<() => void>();

  onHomeRefused(cb: (r: Refusal) => void): () => void {
    this.refusals.add(cb);
    return () => this.refusals.delete(cb);
  }
  onStatus(cb: () => void): () => void {
    this.states.add(cb);
    return () => this.states.delete(cb);
  }
  on(): () => void {
    return () => undefined;
  }
  watch(): void {}
  unwatch(): void {}
  send(): void {}
  async actHome(code: string, idx: number, action: GameAction): Promise<'kept' | 'refused' | 'offline'> {
    /* a frame sent down a dead line never arrives, and nothing answers it */
    if (this.silent) return 'offline';
    const save = this.saves.get(code);
    const error = this.refuseNext ?? (!save ? 'no-such-game' : idx !== save.actions.length ? `out-of-step: the log stands at ${save.actions.length}` : null);
    this.refuseNext = null;
    if (error) {
      for (const cb of this.refusals) cb({ code, at: idx, error });
      return 'refused';
    }
    save!.actions.push(action);
    return 'kept';
  }
  async askNotes(): Promise<unknown> {
    if (this.silent) throw new Error('offline');
    return null;
  }
  async loadHome(code: string): Promise<HomeSave | null> {
    if (this.silent) throw new Error('offline');
    const save = this.saves.get(code);
    return save ? structuredClone(save) : null;
  }
  async openHome(name: string, seed: number, setup: SetupPayload): Promise<HomeSave> {
    if (this.silent) throw new Error('offline');
    this.opened += 1;
    const save = this.deal('NEWG', setup, seed);
    save.name = name;
    return save;
  }
  async undoHome(): Promise<void> {}
  deal(code: string, setup: SetupPayload, seed: number, actions: GameAction[] = []): HomeSave {
    const save: HomeSave = { code, name: code, startedAt: 0, updatedAt: 0, era: 'canal', round: 1, seats: [], seed, setup, actions };
    this.saves.set(code, save);
    return save;
  }
  lineTo(status: Office['status']): void {
    this.status = status;
    for (const cb of this.states) cb();
  }
}

const office = { current: new Office() };
vi.mock('@/online/net', () => ({ onlineWire: () => office.current, ONLINE_URL: 'ws://office' }));

const { useGame, freshGame } = await import('../store');
const { readHomeSave, recordMove } = await import('../home');

const setup: SetupPayload = {
  players: [
    { name: 'Nico', color: 'brass', type: 'human' },
    { name: 'Eve', color: 'oxblood', type: 'human' },
  ],
  options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
};

/** the promises in flight settle */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await new Promise((ok) => setTimeout(ok, 0));
};
const pass = (g: GameState): GameAction => ({ kind: 'pass', card: g.players[g.current].hand[0].id });

beforeEach(() => {
  office.current = new Office();
  vi.stubGlobal('window', { location: { hash: '', pathname: '/game/local/HOME', search: '' }, history: { replaceState: () => undefined } });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a game at home read back from the office', () => {
  it('says why it could not be: absent, unreplayable or offline', async () => {
    expect(await readHomeSave('NONE')).toEqual({ miss: 'absent' });
    const g = newGame(setup, 5);
    office.current.deal('HOME', setup, 5, [pass(g)]);
    const read = await readHomeSave('HOME');
    expect('game' in read && read.game.actions).toHaveLength(1);
    office.current.deal('BAD1', setup, 5, [{ kind: 'build', card: 'no-such-card', town: 'dudley', slot: 0, industry: 'coal' }]);
    expect(await readHomeSave('BAD1')).toEqual({ miss: 'unreplayable' });
    office.current.silent = true;
    expect(await readHomeSave('HOME')).toEqual({ miss: 'offline' });
  });

  it('never deals a new table for an address the office does not hold', async () => {
    office.current.silent = true;
    useGame.getState().init(undefined, 'HOME');
    await settle();
    expect(office.current.opened).toBe(0);
    expect(useGame.getState().game).toBeNull();
    expect(useGame.getState().homeTrouble).toEqual({ cause: 'offline', mended: false });
    /* the office answers again: the game comes back where it was */
    office.current.silent = false;
    office.current.deal('HOME', setup, 5);
    office.current.lineTo('offline');
    office.current.lineTo('online');
    await settle();
    expect(useGame.getState().game?.seed).toBe(5);
    expect(useGame.getState().homeTrouble).toBeNull();
    expect(office.current.opened).toBe(0);
    /* and an address the office does not keep for this reader — another
       member's table, a stale bookmark — is said to be absent: no game the
       reader did not ask for is dealt behind their back */
    useGame.getState().init(undefined, 'GONE');
    await settle();
    expect(office.current.opened).toBe(0);
    expect(useGame.getState().game).toBeNull();
    expect(useGame.getState().movedTo).toBeNull();
    expect(useGame.getState().homeTrouble?.cause).toBe('absent');
  });
});

describe('a move at home', () => {
  it('is kept, refused, or not known, as the office reads it', async () => {
    const g = newGame(setup, 5);
    office.current.deal('HOME', setup, 5);
    expect(await recordMove('HOME', 0, pass(g))).toBe('kept');
    expect(office.current.saves.get('HOME')!.actions).toHaveLength(1);
    /* out of step: the office's log stands at one */
    expect(await recordMove('HOME', 5, pass(g))).toBe('refused');
    office.current.silent = true;
    expect(await recordMove('HOME', 1, pass(g))).toBe('offline');
  });

  it('waits for the office before the next one goes on the board', async () => {
    office.current.deal('HOME', setup, 5);
    useGame.getState().init(undefined, 'HOME');
    await settle();
    const st = useGame.getState();
    expect(st.line).toBe('online');
    expect(st.dispatch(pass(st.game!))).toBe(true);
    /* the office has not answered yet: nothing more is played meanwhile */
    const next = useGame.getState().game!;
    expect(useGame.getState().dispatch(pass(next))).toBe(false);
    await settle();
    expect(useGame.getState().dispatch(pass(next))).toBe(true);
    await settle();
    expect(office.current.saves.get('HOME')!.actions).toHaveLength(2);
  });

  it('turned down freezes the table, which is read back from the office and says so', async () => {
    office.current.deal('HOME', setup, 5);
    useGame.getState().init(undefined, 'HOME');
    await settle();
    const before = useGame.getState().game!;
    office.current.refuseNext = 'the engine refused the action';
    expect(useGame.getState().dispatch(pass(before))).toBe(true);
    /* the board moved here, the office's log did not: nothing more is played */
    expect(useGame.getState().homeTrouble).toMatchObject({ cause: 'refused', at: 0, error: 'the engine refused the action', mended: false });
    expect(useGame.getState().dispatch(pass(useGame.getState().game!))).toBe(false);
    await settle();
    /* read back: the board is the office's again, and the reader is told */
    const after = useGame.getState();
    expect(serialize(after.game!)).toBe(serialize(before));
    expect(after.homeTrouble).toMatchObject({ cause: 'refused', mended: true });
    expect(after.dispatch(pass(after.game!))).toBe(true);
    await settle();
    expect(office.current.saves.get('HOME')!.actions).toHaveLength(1);
    useGame.getState().dismissHomeTrouble();
    expect(useGame.getState().homeTrouble).toBeNull();
  });

  it('never answered for waits for the line, then the table is read back', async () => {
    office.current.deal('HOME', setup, 5);
    useGame.getState().init(undefined, 'HOME');
    await settle();
    office.current.silent = true;
    const before = useGame.getState().game!;
    expect(useGame.getState().dispatch(pass(before))).toBe(true);
    await settle();
    expect(useGame.getState().homeTrouble).toEqual({ cause: 'offline', mended: false });
    expect(useGame.getState().dispatch(pass(useGame.getState().game!))).toBe(false);
    /* the line comes back: the office never wrote the move, and the board says so */
    office.current.silent = false;
    office.current.lineTo('offline');
    expect(useGame.getState().line).toBe('offline');
    office.current.lineTo('online');
    await settle();
    expect(useGame.getState().game!.actions).toHaveLength(0);
    expect(useGame.getState().homeTrouble).toMatchObject({ cause: 'offline', mended: true });
  });
});

describe('sitting at another table', () => {
  it('leaves nothing of the last game behind, whatever road it takes', async () => {
    const junk = {
      humanMarks: [{ at: 3, by: 0 }],
      review: { at: 1 } as never,
      reviewAt: 4,
      debriefOpen: true,
      coached: { at: 2 } as never,
      serverUndo: true,
      movedTo: 'XXXX',
      ceremony: 'canal-end' as const,
      gameOverOpen: true,
      tutorial: true,
      coachStep: 3,
      shown: { from: 1, at: 2 },
      sharing: true,
      following: true,
      homeTrouble: { cause: 'refused' as const, mended: true },
    };
    /* every field of one game is in the list the sites spread */
    expect(Object.keys(junk).sort()).toEqual(Object.keys(freshGame).sort());
    const pick = () => Object.fromEntries(Object.keys(freshGame).map((k) => [k, (useGame.getState() as unknown as Record<string, unknown>)[k]]));
    /* at home */
    useGame.setState(junk);
    useGame.getState().init(undefined, undefined);
    expect(pick()).toEqual(freshGame);
    /* online */
    useGame.setState(junk);
    useGame.getState().init('ONLN');
    expect(pick()).toEqual(freshGame);
    /* a game fetched from the office */
    office.current.deal('HOME', setup, 5);
    useGame.getState().init(undefined, 'HOME');
    await settle();
    useGame.setState({ ...junk, game: null });
    useGame.getState().retryHome();
    await settle();
    const fetched = pick();
    expect(useGame.getState().game?.seed).toBe(5);
    expect({ ...fetched, coachStep: -1 }).toEqual(freshGame);
  });

  it('takes the coach\'s word back with the move it was about', () => {
    const g = newGame(setup, 9);
    /* two actions this turn: the move taken back is still the turn's */
    g.actionsLeft = 2;
    useGame.setState({ game: g, code: null, local: null, humanMarks: [], homeTrouble: null });
    expect(useGame.getState().dispatch(pass(g))).toBe(true);
    useGame.setState({ coached: { at: 0 } as never });
    expect(useGame.getState().undo()).toBe(true);
    expect(useGame.getState().coached).toBeNull();
  });
});
