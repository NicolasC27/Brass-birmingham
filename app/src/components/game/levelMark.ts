import { tr } from '@/i18n';

/* ------------------------------------------------------------------ */
/* A tile's level, as the dictionary spells it — N2 in French, L2 in    */
/* English, S2 in German — so that the hand, the mat and the ledger     */
/* stamp the same mark. The roman numeral stays on the tile itself,     */
/* which is an engraving, not a line of text.                           */
/* ------------------------------------------------------------------ */

/** "poterie N2": a tile named on its own */
export function tileMark(industry: string, level: number): string {
  return tr('game.log.developed', { industry, level }).trim();
}

/** "N2": the level alone, where the industry is already said */
export function levelMark(level: number): string {
  return tileMark('', level);
}
