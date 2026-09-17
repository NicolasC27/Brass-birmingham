/* ------------------------------------------------------------------ */
/* merchantPlate — merchant sign (plate) geometry, the SINGLE source   */
/* of truth shared by:                                                 */
/*   - gl/paint.ts                     (Pixi rendering of the signs)   */
/*   - gl/PixiBoard.tsx                (merchant hit-test)             */
/*   - components/game/routePaths.ts   (route anchoring on plate box)  */
/* components/game/routePaths.test.ts keeps a deliberate hardcoded     */
/* mirror of these formulas to catch any drift.                        */
/*                                                                     */
/* Sizes are in UNSCALED world units: the whole plate container is     */
/* scaled by PLATE_SCALE around the merchant node (m.x/m.y), so the    */
/* node coordinates never change. PLATE_SCALE 2.3 = the prestige       */
/* signs, twice the former 1.15.                                       */
/* ------------------------------------------------------------------ */

export const PLATE_H = 88;
export const PLATE_SCALE = 2.3;
/* southern merchants (Oxford, Gloucester) sit on the map's bottom edge:
   their plate rides this many units above the node so the hand dock
   never hides it */
export const PLATE_SOUTH_LIFT = 34;
/** unscaled plate width: PAD + slots*MT + (slots-1)*MT_GAP + 18 + 2*MEDAL_R + PAD */
export const plateWidth = (slots: number): number => 16 + slots * 40 + (slots - 1) * 12 + 18 + 40 + 16;
