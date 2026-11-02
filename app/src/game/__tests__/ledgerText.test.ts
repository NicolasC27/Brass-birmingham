import { describe, expect, it } from 'vitest';
import { trIn } from '@/i18n';
import type { Lang } from '@/i18n';
import { ledgerParts } from '../ledgerText';

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
