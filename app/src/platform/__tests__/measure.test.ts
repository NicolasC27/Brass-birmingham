import { describe, expect, it } from 'vitest';
import { maskPath, maskUrl } from '../measure';

/* an address leaves for PostHog with its codes and tokens masked and its
   query cut to where the reader came from */

const SITE = 'https://playblackrail.com';

describe('the measures’ addresses', () => {
  it('masks the tokens and the game codes a path carries', () => {
    expect(maskPath('/account/verify/3f9a0c')).toBe('/account/verify/:token');
    expect(maskPath('/account/reset/3f9a0c')).toBe('/account/reset/:token');
    expect(maskPath('/avant-premiere/confirmer/abc')).toBe('/avant-premiere/confirmer/:token');
    expect(maskPath('/avant-premiere/retrait/abc')).toBe('/avant-premiere/retrait/:token');
    expect(maskPath('/game/local/S8AJ')).toBe('/game/local/:code');
    expect(maskPath('/game/K2QX')).toBe('/game/:code');
    expect(maskPath('/online/K2QX')).toBe('/online/:code');
    expect(maskPath('/game')).toBe('/game');
    expect(maskPath('/rules#merchants')).toBe('/rules');
  });

  it('keeps only the campaign of a query, and leaves other sites alone', () => {
    expect(maskUrl(`${SITE}/?via=reddit&utm_source=x&token=secret&email=a@b.c`, SITE)).toBe(`${SITE}/?via=reddit&utm_source=x`);
    expect(maskUrl(`${SITE}/account/reset/3f9a0c?lang=fr`, SITE)).toBe(`${SITE}/account/reset/:token`);
    expect(maskUrl('https://www.reddit.com/r/boardgames/?x=1', SITE)).toBe('https://www.reddit.com/r/boardgames/?x=1');
    expect(maskUrl('not a url', SITE)).toBe('not a url');
  });
});
