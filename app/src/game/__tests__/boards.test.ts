import { describe, expect, it } from 'vitest';
import { BOARDS, BOARD_IDS, boardOf } from '../boards';
import { LINKS, MERCHANTS, TOWNS, activeBoard, setBoard } from '../data';

describe('the boards', () => {
  it('all stand on the same bones, so the tiles and the deck still fit', () => {
    const shape = (id: string) => {
      const b = boardOf(id);
      return {
        towns: b.towns.length,
        farms: b.towns.filter((t) => t.farm).length,
        merchants: b.merchants.length,
        links: b.links.length,
        both: b.links.filter((l) => l.canal && l.rail).length,
        railOnly: b.links.filter((l) => !l.canal).length,
        canalOnly: b.links.filter((l) => !l.rail).length,
        sockets: b.towns.reduce((n, t) => n + t.slots.length, 0),
        cards: Object.values(b.locationCards).reduce((n, c) => [n[0] + c[0], n[1] + c[1], n[2] + c[2]] as [number, number, number], [0, 0, 0] as [number, number, number]),
      };
    };
    const first = shape(BOARD_IDS[0]);
    for (const id of BOARD_IDS.slice(1)) expect(shape(id), id).toEqual(first);
  });

  it('names every endpoint it links, and leaves no town unreachable', () => {
    for (const id of BOARD_IDS) {
      const b = boardOf(id);
      const ids = new Set([...b.towns.map((t) => t.id), ...b.merchants.map((m) => m.id)]);
      for (const l of b.links) {
        expect(ids.has(l.a), `${id}: ${l.a}`).toBe(true);
        expect(ids.has(l.b), `${id}: ${l.b}`).toBe(true);
        if (l.alsoConnects) expect(ids.has(l.alsoConnects), `${id}: ${l.alsoConnects}`).toBe(true);
      }
      const touched = new Set(b.links.flatMap((l) => [l.a, l.b, ...(l.alsoConnects ? [l.alsoConnects] : [])]));
      for (const t of b.towns) expect(touched.has(t.id), `${id}: ${t.id} is on no link`).toBe(true);
    }
  });

  it('deals a location card only to a town it has, and to every town that takes one', () => {
    for (const id of BOARD_IDS) {
      const b = boardOf(id);
      const towns = new Set(b.towns.filter((t) => !t.farm).map((t) => t.id));
      expect(new Set(Object.keys(b.locationCards)), id).toEqual(towns);
    }
  });

  it('keeps every town inside the world', () => {
    for (const id of BOARD_IDS) {
      for (const t of boardOf(id).towns) {
        expect(t.x, `${id}: ${t.id}`).toBeGreaterThan(0);
        expect(t.x, `${id}: ${t.id}`).toBeLessThan(3200);
        expect(t.y, `${id}: ${t.id}`).toBeGreaterThan(0);
        expect(t.y, `${id}: ${t.id}`).toBeLessThan(1800);
      }
    }
  });

  it('swaps under the modules that read it, and swaps back', () => {
    const home = activeBoard().id;
    for (const id of BOARD_IDS) {
      setBoard(id);
      expect(activeBoard().id).toBe(id);
      expect(TOWNS).toBe(BOARDS[id].towns);
      expect(LINKS).toBe(BOARDS[id].links);
      expect(MERCHANTS).toBe(BOARDS[id].merchants);
    }
    setBoard(home);
    expect(activeBoard().id).toBe(home);
  });
});

describe('a game and its board', () => {
  it('deals the board it was asked for, and says so in its state', async () => {
    const { newGame } = await import('../engine');
    const { setupOf } = await import('../actions');
    const seat = (name: string, color: string, type: 'human' | 'bot') => ({ name, color, type });
    for (const id of BOARD_IDS) {
      const setup = {
        players: [seat('A', 'brass', 'human'), seat('B', 'oxblood', 'bot')],
        options: { eraLength: 'standard' as const, marketTemper: 'standard' as const, timerMinutes: null, fidelity: 'core' as const, map: id },
      };
      const g = newGame(setup, 42);
      expect(g.board, id).toBe(id);
      const towns = new Set(boardOf(id).towns.map((t) => t.id));
      for (const c of g.deck) if (c.kind === 'location') expect(towns.has(c.town!), `${id}: ${c.town}`).toBe(true);
      /* and a replay of it stands on the same ground: this is what a share
         link, an undo and the analysis all go through */
      expect(setupOf(g).options.map, id).toBe(id);
      const again = newGame(setupOf(g), g.seed);
      expect(again.board, id).toBe(id);
    }
  });
});
