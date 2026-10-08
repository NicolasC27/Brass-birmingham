import { describe, expect, it } from 'vitest';
import { INDUSTRIES } from '@/game/data';
import { roman } from '../roman';

describe('the level struck on a tile', () => {
  it('every level a works can reach has its roman numeral', () => {
    for (const levels of Object.values(INDUSTRIES)) {
      for (const lv of levels) expect(roman(lv.level)).toMatch(/^[IVX]+$/);
    }
  });

  it('reads the manufactory’s top levels the way the printed tiles do', () => {
    expect([5, 6, 7, 8].map(roman)).toEqual(['V', 'VI', 'VII', 'VIII']);
  });
});
