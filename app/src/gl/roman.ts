/* The level struck on a tile: a roman numeral, the way the printed tiles
   carry it. Eight levels at most (the manufactories run to VIII, the
   potteries to V); one table for the board and for the panels that show
   the same tile, so two neighbouring tiles never read "IV" and "5". */

const NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] as const;

/** a tile's level as struck on its face ("" for none, the figure past VIII) */
export function roman(level: number): string {
  return NUMERALS[level] ?? String(level);
}
