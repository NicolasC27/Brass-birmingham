import { describe, expect, it } from 'vitest';
import { stripRoom } from '../stripRoom';

const base = { line: 400, what: 200, tokens: 50, price: 40, chip: 90, chipShown: false };

describe('the room on the settled strip', () => {
  it('keeps the price and the chip when the line holds them both', () => {
    expect(stripRoom(base)).toEqual({ price: true, verb: true });
  });

  it('gives up the chip before the price', () => {
    expect(stripRoom({ ...base, line: 330 })).toEqual({ price: true, verb: false });
  });

  it('gives up both on a line with room for the works and the tokens only', () => {
    expect(stripRoom({ ...base, line: 270 })).toEqual({ price: false, verb: false });
  });

  it('counts the chip back in when it was standing in the line as measured', () => {
    /* the same room, read while the chip still took its 90 px */
    expect(stripRoom({ ...base, line: 310, chipShown: true })).toEqual({ price: true, verb: true });
  });

  it('asks for nothing that is not there', () => {
    expect(stripRoom({ ...base, price: 0, chip: 0 })).toEqual({ price: false, verb: false });
  });

  it('reads the same widths the same way, so the strip never flickers', () => {
    const first = stripRoom({ ...base, line: 330 });
    const again = stripRoom({ ...base, line: 330, chipShown: first.verb });
    expect(again).toEqual(first);
  });
});
