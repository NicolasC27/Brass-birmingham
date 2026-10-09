/* ------------------------------------------------------------------ */
/* What the settled strip has room for once the works, the town and the */
/* tokens are set: the tile's price first, then the verb's chip. Every  */
/* width is read off the forme in pixels; the chip's includes the gap   */
/* that follows it, and counts back into the line while it stands.      */
/* ------------------------------------------------------------------ */

export interface StripWidths {
  /** the line's own width, as laid out now */
  line: number;
  /** the works and the town */
  what: number;
  /** the tokens and the gap before them; 0 when there are none */
  tokens: number;
  /** the price and its separator; 0 when the move has none */
  price: number;
  /** the verb's chip and the gap after it; 0 when there is none */
  chip: number;
  /** whether the chip stands in the line as it was measured */
  chipShown: boolean;
}

export interface StripRoom {
  price: boolean;
  verb: boolean;
}

/** the price goes before the chip: it is what the owner reads first */
export function stripRoom(w: StripWidths): StripRoom {
  const free = w.line + (w.chipShown ? w.chip : 0) - w.tokens - w.what - 2;
  const price = w.price > 0 && free >= w.price;
  const verb = w.chip > 0 && free - (price ? w.price : 0) >= w.chip;
  return { price, verb };
}
