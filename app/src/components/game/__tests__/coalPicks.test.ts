import { describe, expect, it } from 'vitest';
import { LINKS } from '@/game/data';
import { buildTargets, linkTargets, newGame } from '@/game/engine';
import type { BuildTarget, LinkTarget } from '@/game/engine';
import type { GameState, SetupPayload } from '@/game/types';
import { buildCoalCubes, linkCoalCubes } from '../coalPicks';

/* ------------------------------------------------------------------ */
/* The coal picker of the hand: shown only when two mines or more      */
/* stand nearest, a cube at a time, each cube choosing among what the  */
/* cubes before it left (§5.3).                                        */
/* ------------------------------------------------------------------ */

const SEATS: SetupPayload['players'] = [
  { name: 'Ada', color: 'oxblood', type: 'human' },
  { name: 'Bob', color: 'verdigris', type: 'human' },
  { name: 'Cy', color: 'brass', type: 'human' },
  { name: 'Di', color: 'steel', type: 'human' },
];
const setup: SetupPayload = { players: SEATS, options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' } };

/* Coalbrookdale, one canal from a full mine in Wolverhampton and one from
   a mine on its last cube in Kidderminster */
function table(): { s: GameState; me: number } {
  const s = newGame(setup, 42);
  const me = s.current;
  const other = (me + 1) % 4;
  s.tiles['wolverhampton:1'] = { owner: other, industry: 'coal', level: 2, flipped: false, cubes: 3 };
  s.tiles['kidderminster:0'] = { owner: other, industry: 'coal', level: 2, flipped: false, cubes: 1 };
  s.links['wolverhampton--coalbrookdale'] = { owner: other, era: 'canal' };
  s.links['coalbrookdale--kidderminster'] = { owner: other, era: 'canal' };
  s.players[me].hand = [{ id: 'wild-1', kind: 'wild-location' }];
  s.players[me].money = 40;
  return { s, me };
}

function ironWorks(s: GameState, me: number): BuildTarget {
  const t = buildTargets(s, me, s.players[me].hand[0]).find((x) => x.valid && x.town === 'coalbrookdale' && x.slot === 0 && x.industry === 'iron');
  expect(t).toBeDefined();
  return t!;
}

const keys = (c: { choices: { key: string }[] } | null | undefined) => (c ? c.choices.map((x) => x.key).sort() : null);

describe('the coal picker of a build', () => {
  it('offers the two nearest mines, and says which one the table would draw from', () => {
    const { s, me } = table();
    const cubes = buildCoalCubes(s, ironWorks(s, me), []);
    expect(cubes).toHaveLength(1);
    expect(keys(cubes![0])).toEqual(['kidderminster:0', 'wolverhampton:1']);
    /* unnamed, the engine draws from the larger stock */
    expect(cubes![0].drawn).toBe('wolverhampton:1');
    expect(buildCoalCubes(s, ironWorks(s, me), ['kidderminster:0'])![0].drawn).toBe('kidderminster:0');
  });

  it('stays away while a single mine stands nearest', () => {
    const { s, me } = table();
    delete s.tiles['kidderminster:0'];
    expect(buildCoalCubes(s, ironWorks(s, me), [])).toBeNull();
  });

  it('lets the second cube choose only among what the first one left', () => {
    const { s, me } = table();
    /* a tile burning two cubes, on the same site */
    const two: BuildTarget = { ...ironWorks(s, me), industry: 'manufacturer', level: 3 };
    const named = buildCoalCubes(s, two, ['kidderminster:0'])!;
    expect(named).toHaveLength(2);
    expect(keys(named[1])).toEqual(['wolverhampton:1']);
    expect(named.map((c) => c.drawn)).toEqual(['kidderminster:0', 'wolverhampton:1']);
    const plain = buildCoalCubes(s, two, [])!;
    expect(keys(plain[1])).toEqual(['kidderminster:0', 'wolverhampton:1']);
  });
});

describe('the coal picker of the rails', () => {
  const rail = () => {
    const { s, me } = table();
    s.era = 'rail';
    for (const l of Object.values(s.links)) l.era = 'rail';
    s.tiles['coalbrookdale:1'] = { owner: me, industry: 'iron', level: 2, flipped: false, cubes: 0 };
    delete s.links['coalbrookdale--kidderminster'];
    const first = linkTargets(s, me).find((t) => t.link.id === 'coalbrookdale--kidderminster');
    expect(first?.valid).toBe(true);
    const def = LINKS.find((l) => l.a === 'coalbrookdale' && l.b === 'm-shrewsbury')!;
    const second: LinkTarget = { link: def, cost: 0, coalPlan: { sources: [], totalCost: 0, shortage: 0 }, total: 0, valid: true };
    return { s, first: first!, second };
  };

  it('asks nothing in the canal era, which burns no coal', () => {
    const { s, me } = table();
    const lay = linkTargets(s, me)[0];
    expect(linkCoalCubes(s, lay, null, [])).toEqual([null, null]);
  });

  it('offers the first link the mines nearest its end', () => {
    const { s, first } = rail();
    const [one, two] = linkCoalCubes(s, first, null, []);
    expect(keys(one)).toEqual(['kidderminster:0', 'wolverhampton:1']);
    expect(two).toBeNull();
  });

  it('draws the second link once the first has taken its cube', () => {
    const { s, first, second } = rail();
    /* the first link empties Kidderminster: Wolverhampton alone is left */
    expect(linkCoalCubes(s, first, second, ['kidderminster:0'])[1]).toBeNull();
    /* the first link burns Wolverhampton's: both are still there */
    expect(keys(linkCoalCubes(s, first, second, [])[1])).toEqual(['kidderminster:0', 'wolverhampton:1']);
  });
});
