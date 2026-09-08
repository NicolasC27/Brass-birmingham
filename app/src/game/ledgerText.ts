import type { LedgerEntry } from './types';

/* ------------------------------------------------------------------ */
/* The ledger in the reader's language. The engine writes English and  */
/* the facts (a key of game.log.* and its variables); a client renders  */
/* the facts with its own dictionary, so a table where one player       */
/* reads French and another English keeps one log and two registers.   */
/* ------------------------------------------------------------------ */

type T = (key: string, vars?: Record<string, string | number>) => string;

export function ledgerText(e: Pick<LedgerEntry, 'text' | 'key' | 'vars'>, t: T): string {
  if (!e.key) return e.text;
  const v: Record<string, string | number> = { ...e.vars };
  if (typeof v.industry === 'string') v.industry = t(`game.log.industry.${v.industry}`);
  if (typeof v.saleRes === 'string') v.saleRes = t(`game.log.res.${v.saleRes}`);
  if (typeof v.era === 'string') v.era = t(`game.log.era.${v.era}`);
  switch (e.key) {
    case 'build': {
      const costs = [`£${v.price}`];
      if (v.coal) costs.push(t('game.log.coalN', { n: v.coal }));
      if (v.iron) costs.push(t('game.log.ironN', { n: v.iron }));
      v.costs = costs.join(' · ');
      v.over = v.overName ? t('game.log.over', { name: v.overName, level: v.overLevel ?? 0 }) : '';
      v.sale = v.saleN ? t('game.log.sale', { n: v.saleN, res: v.saleRes ?? '', gain: v.saleGain ?? 0 }) : '';
      break;
    }
    case 'network':
      v.second = v.a2 ? t('game.log.double', { a: v.a2, b: v.b2 ?? '', price: v.price ?? 0 }) : '';
      break;
    case 'sell': {
      const bits: string[] = [];
      if (v.bonusVp) bits.push(t('game.log.bonusVp', { n: v.bonusVp }));
      if (v.bonusIncome) bits.push(t('game.log.bonusIncome', { n: v.bonusIncome }));
      if (v.bonusMoney) bits.push(t('game.log.bonusMoney', { n: v.bonusMoney }));
      if (v.bonusDevelop) bits.push(t('game.log.bonusDevelop'));
      v.bonus = bits.map((b) => ` · ${b}`).join('');
      break;
    }
    case 'flip':
      v.why = t(`game.log.why.${v.why}`, { merchant: v.merchant ?? '' });
      break;
    case 'pass':
      v.card = v.card ? t('game.log.passCard') : '';
      break;
  }
  return t(`game.log.${e.key}`, v);
}
