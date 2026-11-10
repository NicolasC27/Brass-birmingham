import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { actorOf, replay } from '@/game/actions';
import { legalActions } from '@/game/search';
import type { GameState, SetupPayload } from '@/game/types';
import { Home } from '../home';
import { flushMeasures, outcomeOf, startMeasures } from '../measure';
import { Store } from '../store';

/* What the office tells PostHog: the games, never the people — an account
   and a game are hashes there, the machines' moves are not measured, and a
   batch PostHog could not take waits for the next round. */

const SETUP: SetupPayload = {
  players: [
    { name: 'Ada', color: 'brass', type: 'human' },
    { name: 'Mrs Wedgwood', color: 'oxblood', type: 'bot' },
  ],
  options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
};
const ME = 'a-1';

interface Sent {
  api_key: string;
  batch: { event: string; timestamp: string; properties: Record<string, unknown> }[];
}

describe('the measures', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'blackrail-measure-'));
  const file = path.join(dir, 'test.db');
  const sent: Sent[] = [];
  const fetch = vi.fn(async (_url: string, init: { body: string }) => {
    sent.push(JSON.parse(init.body) as Sent);
    return { ok: true, status: 200 };
  });

  beforeAll(() => {
    vi.stubGlobal('fetch', fetch);
    vi.stubEnv('POSTHOG_KEY', 'phc_test');
    startMeasures(file);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it('measures a game at home by hashes, and only the person’s moves', async () => {
    const store = new Store(file);
    const home = new Home(store);
    const { code } = home.deal(ME, 'Measured', SETUP, 4242);
    let mine = 0;
    for (let idx = 0; idx < 12; idx++) {
      const s = home.save(ME, code)!;
      const state = replay(s.setup, s.seed, s.actions);
      const move = legalActions(state, state.current)[0];
      if (!state.players[actorOf(state, move)].isBot) mine += 1;
      expect(home.act(ME, code, idx, move).ok).toBe(true);
    }
    expect(await flushMeasures()).toBe(true);
    const lines = sent.flatMap((s) => s.batch);
    expect(sent[0].api_key).toBe('phc_test');
    expect(fetch.mock.calls[0][0]).toBe('https://eu.i.posthog.com/batch/');

    const started = lines.find((l) => l.event === 'game started')!;
    expect(started.properties).toMatchObject({ mode: 'home', players: 2, machines: 1, era_length: 'short', $geoip_disable: true });
    expect(lines.filter((l) => l.event === 'move played')).toHaveLength(mine);

    /* one account, one game — and neither under its own name */
    const ids = new Set(lines.map((l) => l.properties.distinct_id));
    const games = new Set(lines.map((l) => l.properties.game));
    expect(ids.size).toBe(1);
    expect(games.size).toBe(1);
    expect([...ids][0]).not.toContain(ME);
    expect([...games][0]).not.toBe(code);
    expect(JSON.stringify(lines)).not.toContain('Ada');
    expect(readFileSync(path.join(dir, 'measures.key'), 'utf8').trim()).toMatch(/^[0-9a-f]{64}$/);
    store.close();
  });

  it('keeps a batch PostHog could not take for the next round', async () => {
    const store = new Store(file);
    const home = new Home(store);
    fetch.mockRejectedValueOnce(new Error('offline'));
    sent.length = 0;
    home.deal(ME, 'Kept', SETUP, 7);
    expect(await flushMeasures()).toBe(false);
    expect(sent).toHaveLength(0);
    expect(await flushMeasures()).toBe(true);
    expect(sent.flatMap((s) => s.batch).map((l) => l.event)).toEqual(['game started']);
    store.close();
  });

  it('shares a place between equal scores', () => {
    const s = { players: [{ vp: 40 }, { vp: 52 }, { vp: 40 }], winner: 1 } as unknown as GameState;
    expect(outcomeOf(s, 0)).toEqual({ place: 2, won: false, vp: 40, players: 3 });
    expect(outcomeOf(s, 2)).toMatchObject({ place: 2 });
    expect(outcomeOf(s, 1)).toMatchObject({ place: 1, won: true });
  });
});
