import { describe, expect, it } from 'vitest';
import { trIn } from '@/i18n';
import type { Lang } from '@/i18n';
import { ledgerParts, pursesOf } from '../ledgerText';

/* the ledger's figures as each tongue writes a sum: the machine's plate
   heads with the same line, beside the guide's own "3 £" */

const tIn = (lang: Lang) => (k: string, v?: Record<string, string | number>) => trIn(lang, k, v);
const build = { text: '', key: 'build', vars: { name: 'Wedgwood', industry: 'coal', level: 1, town: 'Redditch', price: 5, coal: 0, iron: 0 } };
const canal = { text: '', key: 'network', vars: { name: 'Wedgwood', a: 'Redditch', b: 'Oxford', era: 'canal', price: 3 } };

describe('the ledger\'s prices', () => {
  it('are written the tongue\'s way', () => {
    expect(ledgerParts(build, tIn('fr')).detail).toBe('5 £');
    expect(ledgerParts(canal, tIn('es')).detail).toBe('3 £');
    expect(ledgerParts(build, tIn('en')).detail).toBe('£5');
    expect(ledgerParts(canal, tIn('de')).detail).toBe('£3');
  });
});

describe('pursesOf', () => {
  const snap = (era: 'canal' | 'rail', round: number, money: number[], income: number[]) => ({ era, round, vp: money.map(() => 0), income, money });
  it('opens the first round on the starting purse and each later one on the cash the round before closed with', () => {
    const history = [snap('canal', 1, [14, 20], [0, 1]), snap('canal', 2, [9, 25], [2, -1])];
    const { start, paid } = pursesOf(history, { era: 'canal', round: 3 }, 2);
    expect(start.get('canal:1')).toEqual([17, 17]);
    expect(start.get('canal:2')).toEqual([14, 20]);
    expect(start.get('canal:3')).toEqual([9, 25]);
    expect(paid.get('canal:2')).toEqual([2, -1]);
  });
  it('carries the canal close into the rail era', () => {
    const history = [snap('canal', 1, [14, 20], [0, 0]), snap('canal', 2, [30, 8], [3, 2])];
    const { start } = pursesOf(history, { era: 'rail', round: 1 }, 2);
    expect(start.get('rail:1')).toEqual([30, 8]);
  });
});
