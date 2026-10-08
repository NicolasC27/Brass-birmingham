import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTRAST_FLOOR, CONTRAST_FLOOR_LARGE, TEXT_FLOOR_PX, contrast } from '../floors';

const here = resolve(__dirname, '..');
const shell = [
  ...readdirSync(here)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => join(here, f)),
  resolve(here, '../../pages/Game.tsx'),
];

describe('the table has floors', () => {
  it('sets no line of the shell under the text floor', () => {
    const under: string[] = [];
    for (const file of shell) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (line.includes('picture-scale')) return;
          for (const m of line.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
            if (Number(m[1]) < TEXT_FLOOR_PX) under.push(`${file.split('/').pop()}:${i + 1} ${m[0]}`);
          }
        });
    }
    expect(under).toEqual([]);
  });

  it('prints the losing side of the income track at the body floor', () => {
    /* the rust of a negative payout on the track's dark */
    expect(contrast('#C4644F', '#1D120F')).toBeGreaterThanOrEqual(CONTRAST_FLOOR);
  });

  it('lets a coal ingot read against its empty socket', () => {
    /* the middle plane of the ingot, against the socket (the state of the row) */
    expect(contrast('#6E665B', '#12100E')).toBeGreaterThanOrEqual(CONTRAST_FLOOR_LARGE);
  });

  it('measures ink against itself as 1 and black on white as 21', () => {
    expect(contrast('#100D0B', '#100D0B')).toBeCloseTo(1, 5);
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });
});
