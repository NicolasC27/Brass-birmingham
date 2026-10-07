/**
 * Rules « registre du club » scoped CSS — keyframes and flourishes that are
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

/* Brass-edge fade signalling horizontal overflow of tables on mobile. */
.rules-table-fade {
  mask-image: linear-gradient(90deg, #000 0%, #000 calc(100% - 40px), transparent 100%);
  -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 calc(100% - 40px), transparent 100%);
}
@media (min-width: 1024px) {
  .rules-table-fade { mask-image: none; -webkit-mask-image: none; }
}

/* ------------------------------------------------------------------ */
/* Registre du club (design/rules.md)                                   */
/* ------------------------------------------------------------------ */

/* Rivet bullets — small brass diamond, 20px indent (rules.md §3). Only
 * top-level lists of a chapter body; nested component lists (accordion,
 * approximations ledger) keep their own markers. */
.rules-body > ul {
  list-style: none;
  padding-left: 20px;
}
.rules-body > ul > li {
  position: relative;
}
.rules-body > ul > li::before {
  content: "";
  position: absolute;
  left: -14px;
  top: 0.62em;
  width: 4px;
  height: 4px;
  background: rgb(var(--brass-300));
  transform: rotate(45deg);
}

/* Search hit — brass wash on the matched paragraph, fading over 1.6s. */
@keyframes rules-hit-fade {
  0%   { background-color: rgb(var(--brass-300) / .16); }
  30%  { background-color: rgb(var(--brass-300) / .08); }
  100% { background-color: transparent; }
}
.rules-hit {
  border-radius: 4px;
  animation: rules-hit-fade 1.6s ease-out forwards;
}

/* Impression (rules.md §3) — fond blanc, texte noir, sans rail ni chrome. */
@media print {
  body { background: #fff !important; }
  /* shell chrome (TopBar, StatusStrip, footer, tab bar, texture) */
  .platform-root > *:not(main) { display: none !important; }
  /* rail, mobile summary button, header tools, footer CTA */
  .rules-print-hide { display: none !important; }
  .rules-ledger {
    background: #fff !important;
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
  }
  .rules-ledger .tex-ledger { display: none !important; }
  .rules-ledger *,
  .rules-ledger *::before,
  .rules-ledger *::after {
    color: #1A1408 !important;
    background-color: transparent !important;
    border-color: #B9B2A2 !important;
    box-shadow: none !important;
    text-shadow: none !important;
    animation: none !important;
  }
}
`;

export default function RulesStyle() {
  return <style>{RULES_CSS}</style>;
}
