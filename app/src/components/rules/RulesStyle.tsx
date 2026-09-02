/**
 * RulesCodex scoped CSS — keyframes and paper-sheet flourishes that are
 * unique to /rules (index.css is shared and owned elsewhere).
 * All selectors carry the `rules-` prefix. Infinite loops here are CSS-only,
 * cheap, and flattened to a 0.15s single pass by the global
 * prefers-reduced-motion rule in index.css.
 */
const RULES_CSS = `
/* Ghost supply lines: trace once from source, then flow onward forever. */
@keyframes rules-ghost-draw {
  from { stroke-dashoffset: var(--ghost-len, 240); }
  to   { stroke-dashoffset: 0; }
}
@keyframes rules-ghost-flow {
  from { stroke-dashoffset: 0; }
  to   { stroke-dashoffset: -30; }
}
.rules-ghost {
  stroke-dasharray: 8 7;
  stroke-dashoffset: var(--ghost-len, 240);
  animation:
    rules-ghost-draw 0.9s cubic-bezier(.4,0,.2,1) forwards,
    rules-ghost-flow 1.25s linear 0.95s infinite;
}
.rules-ghost-rust {
  stroke-dasharray: 8 7;
  stroke-dashoffset: var(--ghost-len, 240);
  animation: rules-ghost-draw 0.7s cubic-bezier(.4,0,.2,1) forwards;
}

/* Single 800ms dash trace for the accordion's mini diagrams (runs on mount,
 * i.e. each time a Radix accordion row opens). */
@keyframes rules-trace-once {
  from { stroke-dashoffset: var(--trace-len, 120); }
  to   { stroke-dashoffset: 0; }
}
.rules-trace-once {
  stroke-dasharray: var(--trace-len, 120);
  stroke-dashoffset: var(--trace-len, 120);
  animation: rules-trace-once 0.8s cubic-bezier(.4,0,.2,1) forwards;
}

/* Gentle idle pulse for the mine marker. */
@keyframes rules-pulse {
  0%, 100% { opacity: .18; transform: scale(1); }
  50%      { opacity: .55; transform: scale(1.35); }
}
.rules-mine-pulse {
  transform-origin: center;
  transform-box: fill-box;
  animation: rules-pulse 2.6s ease-in-out infinite;
}

/* Small ±2px refusal shake on the build site. */
@keyframes rules-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}
.rules-shake { animation: rules-shake .35s ease-in-out 2; }

/* Industry table rows fade-rise with a 40ms stagger each time a tab mounts. */
@keyframes rules-row-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}
.rules-ind-row { animation: rules-row-in .32s ease-out backwards; }
.rules-ind-row:nth-child(2) { animation-delay: .04s; }
.rules-ind-row:nth-child(3) { animation-delay: .08s; }
.rules-ind-row:nth-child(4) { animation-delay: .12s; }

/* Tile mock 180° flip (Selling chapter showpiece). */
.rules-flip { perspective: 640px; }
.rules-flip-inner {
  transform-style: preserve-3d;
  transition: transform .45s cubic-bezier(.34,1.4,.44,1);
}
.rules-flip:hover .rules-flip-inner,
.rules-flip:focus-visible .rules-flip-inner,
.rules-flip:focus-within .rules-flip-inner {
  transform: rotateY(180deg);
}
.rules-flip-face { backface-visibility: hidden; }
.rules-flip-back { transform: rotateY(180deg); }

/* Ember rim glow on the flipped face. */
@keyframes rules-ember {
  0%, 100% { box-shadow: 0 0 6px 1px rgba(166,86,43,.45), inset 0 0 8px rgba(166,86,43,.35); }
  50%      { box-shadow: 0 0 14px 3px rgba(166,86,43,.7), inset 0 0 14px rgba(166,86,43,.5); }
}
.rules-ember-rim { animation: rules-ember 2.2s ease-in-out infinite; }

/* Paper-sheet corner flourishes (engraved brass L-brackets). */
.rules-corner {
  position: absolute;
  width: 26px;
  height: 26px;
  border: 0 solid rgba(138,107,51,.75);
  pointer-events: none;
}
.rules-corner-tl { top: 10px; left: 10px; border-top-width: 2px; border-left-width: 2px; border-top-left-radius: 3px; }
.rules-corner-tr { top: 10px; right: 10px; border-top-width: 2px; border-right-width: 2px; border-top-right-radius: 3px; }
.rules-corner-bl { bottom: 10px; left: 10px; border-bottom-width: 2px; border-left-width: 2px; border-bottom-left-radius: 3px; }
.rules-corner-br { bottom: 10px; right: 10px; border-bottom-width: 2px; border-right-width: 2px; border-bottom-right-radius: 3px; }

/* Brass-edge fade signalling horizontal overflow of tables on mobile. */
.rules-table-fade {
  mask-image: linear-gradient(90deg, #000 0%, #000 calc(100% - 40px), transparent 100%);
  -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 calc(100% - 40px), transparent 100%);
}
@media (min-width: 1024px) {
  .rules-table-fade { mask-image: none; -webkit-mask-image: none; }
}
`;

export default function RulesStyle() {
  return <style>{RULES_CSS}</style>;
}
