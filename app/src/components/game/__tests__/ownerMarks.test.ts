import { afterEach, describe, expect, it } from 'vitest';
import { PLAYER_COLORS } from '@/game/data';
import { setLang } from '@/i18n';
import { FAR_LOD_K, GLIMPSE_MS, farDetail } from '../boardView';
import { getBoardOptions } from '../boardOptions';
import { levelMark, tileMark } from '../levelMark';
import { ownerDash } from '../ownerMarks';

/* ------------------------------------------------------------------ */
/* Who owns what, told without colour; what the board shows at which   */
/* zoom; the level's one mark per tongue.                               */
/* ------------------------------------------------------------------ */

describe('an owner told without colour', () => {
  it('gives each seat a link stroke of its own on the minimap', () => {
    const dashes = Object.keys(PLAYER_COLORS).map((c) => ownerDash(c, 2.5) ?? 'plain');
    expect(new Set(dashes).size).toBe(Object.keys(PLAYER_COLORS).length);
  });

  it('scales the dash with the stroke', () => {
    expect(ownerDash('oxblood', 2)).toBe('5.2 2.6');
    expect(ownerDash('oxblood', 4)).toBe('10.4 5.2');
  });

  it('wears the shapes by default, for the owners colour alone cannot part', () => {
    /* no stored choice (none can be read here): the default stands */
    expect(getBoardOptions().colorBlind).toBe(true);
  });
});

describe('the board’s detail and pace', () => {
  it('keeps the income band away at the fit and brings it back with the first zoom', () => {
    expect(farDetail(1)).toBe(0);
    expect(farDetail(FAR_LOD_K)).toBe(1);
    expect(farDetail(2)).toBe(1);
  });

  it('shows another seat’s move about as long as the board veils it', () => {
    expect(GLIMPSE_MS).toBe(1500);
  });
});

describe('a tile’s level', () => {
  afterEach(() => setLang('fr'));

  it('is marked the way each tongue marks it', () => {
    const want = { fr: 'N2', en: 'L2', es: 'N2', de: 'Stufe 2' } as const;
    for (const [lang, mark] of Object.entries(want)) {
      setLang(lang as keyof typeof want);
      expect(levelMark(2)).toBe(mark);
      expect(tileMark('x', 2)).toBe(`x ${mark}`);
    }
  });
});
