import type { LedgerEntry } from './types';

/* ------------------------------------------------------------------ */
/* The ledger in the reader's language. The engine writes English and  */
/* the facts (a key of game.log.* and its variables); a client renders  */
/* the facts with its own dictionary, so a table where one player       */
/* reads French and another English keeps one log and two registers.   */
/* ------------------------------------------------------------------ */

type T = (key: string, vars?: Record<string, string | number>) => string;

type Entry = Pick<LedgerEntry, 'text' | 'key' | 'vars'>;

/** the entry's facts in the reader's words: industries, resources and
 *  eras named, and the pieces every template shares derived once */
function facts(e: Entry, t: T): Record<string, string | number> {
  const v: Record<string, string | number> = { ...e.vars };
  if (typeof v.industry === 'string') v.industry = t(`game.log.industry.${v.industry}`);
  if (typeof v.saleRes === 'string') v.saleRes = t(`game.log.res.${v.saleRes}`);
  if (typeof v.era === 'string') {
    v.eraName = t(`game.log.eraName.${v.era}`);
    v.era = t(`game.log.era.${v.era}`);
  }
  switch (e.key) {
    case 'build': {
      const costs = [`£${v.price}`];
      if (v.coal) costs.push(t('game.log.coalN', { n: v.coal }));
      if (v.iron) costs.push(t('game.log.ironN', { n: v.iron }));
      v.costs = costs.join(' · ');
      break;
    }
    case 'sell': {
      const bits: string[] = [];
      if (v.bonusVp) bits.push(t('game.log.bonusVp', { n: v.bonusVp }));
      if (v.bonusIncome) bits.push(t('game.log.bonusIncome', { n: v.bonusIncome }));
      if (v.bonusMoney) bits.push(t('game.log.bonusMoney', { n: v.bonusMoney }));
      if (v.bonusDevelop) bits.push(t('game.log.bonusDevelop'));
      v.bonusBits = bits.join(' · ');
      v.bonus = bits.map((b) => ` · ${b}`).join('');
      break;
    }
    case 'flip':
      v.why = t(`game.log.why.${v.why}`, { merchant: v.merchant ?? '' });
      break;
  }
  return v;
}

/** the entry as one sentence */
export function ledgerText(e: Entry, t: T): string {
  if (!e.key) return e.text;
  const v = facts(e, t);
  switch (e.key) {
    case 'build':
      v.over = v.overName ? t('game.log.over', { name: v.overName, level: v.overLevel ?? 0 }) : '';
      v.sale = v.saleN ? t('game.log.sale', { n: v.saleN, res: v.saleRes ?? '', gain: v.saleGain ?? 0 }) : '';
      break;
    case 'network':
      v.second = v.a2 ? t('game.log.double', { a: v.a2, b: v.b2 ?? '', price: v.price ?? 0 }) : '';
      break;
    case 'pass':
      v.card = v.card ? t('game.log.passCard') : '';
      break;
  }
  return t(`game.log.${e.key}`, v);
}

/** The entry split for the register's eye: what was done, in a few words
 *  without the player's name (the register shows it in colour), and the
 *  figures under it. Entries with no template fall back to the sentence. */
export function ledgerParts(e: Entry, t: T): { head: string; detail: string } {
  if (!e.key) return { head: e.text, detail: '' };
  const v = facts(e, t);
  const bits: (string | number | undefined)[] = [];
  switch (e.key) {
    case 'build':
      bits.push(v.costs);
      if (v.overName) bits.push(t('game.log.overShort', { name: v.overName, level: v.overLevel ?? 0 }));
      if (v.saleN) bits.push(t('game.log.saleShort', { n: v.saleN, res: v.saleRes ?? '', gain: v.saleGain ?? 0 }));
      return { head: t('game.log.head.build', v), detail: bits.join(' · ') };
    case 'network':
      bits.push(`£${v.price}`);
      if (v.a2) bits.push(t('game.log.doubleShort', { a: v.a2, b: v.b2 ?? '' }));
      return { head: t('game.log.head.network', v), detail: bits.join(' · ') };
    case 'develop':
      return { head: t('game.log.head.develop', v), detail: t('game.log.ironN', { n: 1 }) };
    case 'sell':
      bits.push(t('game.log.beerN', { n: v.beer ?? 0 }));
      if (v.bonusBits) bits.push(v.bonusBits);
      return { head: t('game.log.head.sell', v), detail: bits.join(' · ') };
    case 'loan':
      return { head: t('game.log.head.loan', v), detail: t('game.log.incomeFromTo', v) };
    case 'scout':
      return { head: t('game.log.head.scout'), detail: '' };
    case 'pass':
      return { head: t(v.card ? 'game.log.head.passCard' : 'game.log.head.pass'), detail: '' };
    case 'flip':
      return { head: t('game.log.head.flip', v), detail: t('game.log.flipDetail', v) };
    case 'sellOff':
      return { head: t('game.log.head.sellOff', v), detail: t('game.log.sellOffDetail', v) };
    case 'short':
      return { head: t('game.log.head.short', v), detail: '' };
    default:
      return { head: ledgerText(e, t), detail: '' };
  }
}
