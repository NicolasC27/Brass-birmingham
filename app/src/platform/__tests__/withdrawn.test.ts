import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stubStorage } from './storage';
import { writePaper } from '../papers';
import { DEFAULT_EQUIPPED, isItem } from '../catalog';
import { equip, getWallet } from '../wallet';
import { COUNTER_BY_ID, FREE_ITEMS } from '@/online/counter';

/* ------------------------------------------------------------------ */
/* The rail paintings are withdrawn and the ground is no longer a      */
/* choice: the board is the English model for everyone. What a browser */
/* or an outfit kept from before is passed over, without a word.       */
/* ------------------------------------------------------------------ */

const PAINTINGS = ['painting-rail-1', 'painting-rail-2', 'painting-rail-3'];

describe('the withdrawn rail paintings', () => {
  beforeEach(() => {
    stubStorage();
  });

  it('are no longer at the counter, nor anyone\'s for free', () => {
    for (const id of PAINTINGS) {
      expect(COUNTER_BY_ID[id]).toBeUndefined();
      expect(isItem(id)).toBe(false);
      expect(FREE_ITEMS).not.toContain(id);
    }
    expect(Object.keys(DEFAULT_EQUIPPED)).not.toContain('painting');
  });

  it('leave an outfit that still wears one as it was, the painting dropped', () => {
    writePaper('equipped', { painting: 'painting-rail-3', sign: 'sign-oxford', tiles: 'painting-rail-1' });
    const { equipped } = getWallet();
    expect(equipped).toEqual({ ...DEFAULT_EQUIPPED, sign: 'sign-oxford' });
    expect(equipped).not.toHaveProperty('painting');
    expect(equip('painting-rail-2')).toBe(false);
  });
});

describe('the ground under the board', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('is the English model whatever a browser kept of the etched ground and its painting', async () => {
    const stored = stubStorage();
    stored.set('brassworks.mapStyle', 'etched');
    stored.set('brassworks.railPainting', '3');
    const { MAP_URL, getBoardOptions, mapUrls } = await import('@/components/game/boardOptions');
    const opts = getBoardOptions();
    expect(opts).not.toHaveProperty('mapStyle');
    expect(opts).not.toHaveProperty('railPainting');
    expect(mapUrls()).toBe(MAP_URL);
    expect(mapUrls('midlands')).toEqual({
      canal: '/map-relief-canal.webp',
      rail: '/map-relief-rail.webp',
      etch: { canal: '/map-relief-canal-etch.webp', rail: '/map-relief-rail-etch.webp' },
    });
  });
});
