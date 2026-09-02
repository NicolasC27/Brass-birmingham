import { memo } from 'react';
import type { Era } from '@/game/types';

/* ------------------------------------------------------------------ */
/* VignetteLamp — screen-fixed lighting (map-v3 §4): darkened corners  */
/* + a warm lamp halo centred slightly above board centre. The lamp    */
/* burns warmer in the Rail era. Static gradients, zero re-render      */
/* cost, pointer-events: none.                                         */
/* ------------------------------------------------------------------ */

export default memo(function VignetteLamp({ era }: { era: Era }) {
  const rail = era === 'rail';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {/* corner vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 80% at 50% 44%, transparent 52%, rgba(16,13,11,.38) 82%, rgba(16,13,11,.72) 100%)',
        }}
      />
      {/* warm table-lamp halo, slightly above board centre */}
      <div
        className="absolute inset-0 transition-opacity"
        style={{
          transitionDuration: '2400ms',
          opacity: rail ? 1 : 0.55,
          background: rail
            ? 'radial-gradient(ellipse 62% 48% at 50% 38%, rgba(255,186,110,.13), transparent 70%)'
            : 'radial-gradient(ellipse 62% 48% at 50% 38%, rgba(240,214,150,.08), transparent 70%)',
        }}
      />
    </div>
  );
});
