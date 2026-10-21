import { afterEach, describe, expect, it } from 'vitest';
import { MAX_K, PAINT_H, PAINT_W, clampKFor, clampPan, fitScale, getFitReserve, holdFitReserve, setFitReserve, setZoomCeiling, zoomCeiling, FIT_PAD_BOTTOM } from '@/components/game/boardView';
import { DEFAULT_KEYS, RESERVED_KEYS, isKey, reconcileKeys, resetKeybindings } from '@/components/game/keybindings';
import { setLang, tr } from '@/i18n';
import { PHOTO_LOOKS, PNG_MAX_PIXELS, PRINT_MAX_W, isPhotoLook, photoCaption, photoFileName, printFormat, printSize } from '../photoPrint';

/* ------------------------------------------------------------------ */
/* the photo mode's pure parts: the print's size and format, the line  */
/* under the signature, the file's name, the key that opens the mode,  */
/* and the camera's leash let out and taken in again                   */
/* ------------------------------------------------------------------ */

describe('the print', () => {
  it('is pulled at twice the frame', () => {
    expect(printSize(1600, 900)).toEqual({ width: 3200, height: 1800, scale: 2 });
    expect(printSize(1024, 768)).toEqual({ width: 2048, height: 1536, scale: 2 });
  });

  it('never runs wider than 3840 pixels', () => {
    const s = printSize(1920, 1080);
    expect(s).toEqual({ width: 3840, height: 2160, scale: 2 });
    const wide = printSize(2560, 1440);
    expect(wide.width).toBe(PRINT_MAX_W);
    expect(wide.height).toBe(2160);
    expect(wide.scale).toBeCloseTo(1.5);
  });

  it('holds a frame stood on its end under the same cap', () => {
    const s = printSize(1024, 2400);
    expect(s.height).toBeLessThanOrEqual(3840);
    expect(s.width / s.height).toBeCloseTo(1024 / 2400, 2);
  });

  it('pulls nothing from a frame with no size', () => {
    expect(printSize(0, 900)).toEqual({ width: 0, height: 0, scale: 0 });
    expect(printSize(Number.NaN, 900).width).toBe(0);
  });

  it('leaves as a PNG while modest, as a JPEG once large', () => {
    expect(printFormat(1600, 1000)).toBe('png');
    expect(printFormat(2000, 2000)).toBe('png');
    expect(printFormat(3200, 1800)).toBe('jpeg');
    expect(printFormat(3840, 2160)).toBe('jpeg');
    expect(2000 * 2000).toBeLessThanOrEqual(PNG_MAX_PIXELS);
  });

  it('is named for its era, its round and its look', () => {
    expect(photoFileName({ era: 'rail', round: 7, over: false }, 'sepia', 'png')).toBe('blackrail-rail-r7-sepia.png');
    expect(photoFileName({ era: 'canal', round: 2, over: false }, 'none', 'jpeg')).toBe('blackrail-canal-r2.jpg');
    expect(photoFileName({ era: 'rail', round: 9, over: true }, 'nuit', 'jpeg')).toBe('blackrail-rail-fin-nuit.jpg');
  });

  it('knows its looks', () => {
    expect([...PHOTO_LOOKS]).toEqual(['none', 'sepia', 'aquarelle', 'nuit']);
    expect(isPhotoLook('aquarelle')).toBe(true);
    expect(isPhotoLook('polaroid')).toBe(false);
    expect(isPhotoLook(undefined)).toBe(false);
  });
});

describe('the line under the signature', () => {
  afterEach(() => setLang('fr'));

  it('says the era, the round and the year', () => {
    setLang('fr');
    expect(photoCaption(tr, { era: 'canal', round: 6, over: false, code: null, year: 2026 })).toBe('Canal, manche 6 · 2026');
    setLang('en');
    expect(photoCaption(tr, { era: 'rail', round: 3, over: false, code: null, year: 2026 })).toBe('Rail era, round 3 · 2026');
  });

  it('names the table first when it has a code, and says when the game is over', () => {
    setLang('fr');
    expect(photoCaption(tr, { era: 'rail', round: 9, over: true, code: 'K7QF', year: 2027 })).toBe('Table K7QF · Rail, partie achevée · 2027');
  });

  it('is written in every language the table speaks', () => {
    for (const l of ['fr', 'en', 'es', 'de'] as const) {
      setLang(l);
      const line = photoCaption(tr, { era: 'rail', round: 4, over: false, code: 'AB12', year: 2026 });
      expect(line).not.toMatch(/game\.photo|\{/);
      expect(line).toContain('4');
      expect(line).toContain('AB12');
    }
  });
});

describe('the photo key', () => {
  afterEach(() => resetKeybindings());
  const press = (key: string) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: null }) as unknown as KeyboardEvent;

  it('is I by default, free and not reserved', () => {
    expect(DEFAULT_KEYS.photo).toBe('i');
    expect(RESERVED_KEYS.has('i')).toBe(false);
    expect(isKey(press('i'), 'photo')).toBe(true);
    expect(isKey(press('I'), 'photo')).toBe(true);
    expect(isKey(press('p'), 'photo')).toBe(false);
  });

  it('comes to a table whose keys were kept before it existed', () => {
    const { photo: _new, ...before } = DEFAULT_KEYS;
    void _new;
    expect(reconcileKeys(before).photo).toBe('i');
    /* a player who had already put the rules on I keeps them there */
    const keys = reconcileKeys({ ...before, rules: 'i' });
    expect(keys.rules).toBe('i');
    expect(keys.photo).toBe('?');
  });
});

describe('the camera let off its leash', () => {
  afterEach(() => {
    setZoomCeiling(null);
    holdFitReserve(null);
    setFitReserve(FIT_PAD_BOTTOM);
  });

  it('comes closer while the ceiling is lifted, and is held back after', () => {
    expect(clampKFor(9, 1600, 900)).toBe(MAX_K);
    setZoomCeiling(5);
    expect(zoomCeiling()).toBe(5);
    expect(clampKFor(9, 1600, 900)).toBe(5);
    expect(clampKFor(4.2, 1600, 900)).toBe(4.2);
    setZoomCeiling(null);
    expect(clampKFor(4.2, 1600, 900)).toBe(MAX_K);
  });

  it('never lowers the ceiling under the table’s own', () => {
    setZoomCeiling(1.5);
    expect(zoomCeiling()).toBe(MAX_K);
  });

  it('keeps the painting over the whole frame at the closest zoom', () => {
    setZoomCeiling(5);
    holdFitReserve(0);
    const [w, h] = [1600, 900];
    for (const [x, y] of [[1e5, 1e5], [-1e5, -1e5], [1e5, -1e5], [0, 0]]) {
      const v = clampPan({ k: 5, x, y }, w, h);
      const s = fitScale(w, h) * v.k;
      expect(v.k).toBe(5);
      expect((PAINT_W * s) / 2 - Math.abs(v.x)).toBeGreaterThanOrEqual(w / 2 - 1e-6);
      expect((PAINT_H * s) / 2 - Math.abs(v.y)).toBeGreaterThanOrEqual(h / 2 - 1e-6);
    }
  });

  it('holds the hand’s strip at nothing, and lets the dock speak again after', () => {
    setFitReserve(180);
    expect(getFitReserve()).toBe(180);
    holdFitReserve(0);
    expect(getFitReserve()).toBe(0);
    /* the dock may move while the photo is taken: its word is kept for after */
    setFitReserve(200);
    expect(getFitReserve()).toBe(0);
    holdFitReserve(null);
    expect(getFitReserve()).toBe(200);
  });
});
