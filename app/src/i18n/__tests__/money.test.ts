import { afterEach, describe, expect, it } from 'vitest';
import { LANGS, money, reasonText, setLang, tr } from '../index';

/* a sum is set the way each tongue's own sheets set it */

describe('money', () => {
  afterEach(() => setLang('fr'));

  it('puts the pound after the figure in French and Spanish, before it in English and German', () => {
    expect(money(12, 'fr')).toBe('12 £');
    expect(money(12, 'es')).toBe('12 £');
    expect(money(12, 'en')).toBe('£12');
    expect(money(12, 'de')).toBe('£12');
  });

  it('keeps a debt’s minus sign in front of the whole sum', () => {
    expect(money(-3, 'en')).toBe('−£3');
    expect(money(-3, 'fr')).toBe('−3 £');
    expect(money('−10', 'de')).toBe('−£10');
    expect(money(0, 'es')).toBe('0 £');
  });

  it('follows the reader’s language when none is named', () => {
    setLang('fr');
    expect(money(7)).toBe('7 £');
    setLang('en');
    expect(money(7)).toBe('£7');
  });

  it('matches the sums the sheets write themselves', () => {
    for (const lang of LANGS) {
      setLang(lang);
      const said = reasonText('Needs £14 — you hold £9');
      expect(said).toContain(money(14));
      expect(said).toContain(money(9));
      expect(tr('game.page.loanTitle')).toContain(money(30));
    }
  });
});
