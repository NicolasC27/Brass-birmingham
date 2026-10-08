import { PLAYER_COLORS } from '@/game/data';

/* ------------------------------------------------------------------ */
/* An owner told by something other than colour. Each seat's shape     */
/* (circle, square, diamond, triangle) has a stroke of its own for the */
/* links drawn small, on the minimap: two players whose colours merge  */
/* under a colour-blind eye still lay lines that cannot be confused.   */
/* ------------------------------------------------------------------ */

/** the dash of a link stroke `sw` wide for the owner of colour `color`;
 *  undefined for the plain line */
export function ownerDash(color: string, sw: number): string | undefined {
  const shape = PLAYER_COLORS[color]?.shape ?? 'circle';
  const r = (n: number) => Math.round(n * 100) / 100;
  switch (shape) {
    case 'square':
      return `${r(sw * 2.6)} ${r(sw * 1.3)}`;
    case 'diamond':
      /* dots: round caps turn each short dash into a bead */
      return `${r(sw * 0.1)} ${r(sw * 1.6)}`;
    case 'triangle':
      return `${r(sw * 2.6)} ${r(sw * 1.1)} ${r(sw * 0.1)} ${r(sw * 1.1)}`;
    default:
      return undefined;
  }
}
