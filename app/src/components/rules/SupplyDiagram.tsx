import { memo, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

type Mode = "mine" | "market" | "none";

/* The plate is set in the register it is read in: the ground is the page's
   own (--lacquer-950), and every ink on it is a --rd-* token, so the plate
   and what is engraved on it turn over together instead of leaving a day
   ink on a night ground. The fallbacks carry the night, which has no --rd-*
   block of its own.
   INK is the one colour that stays put: it is only ever laid on a counter,
   and the counters are cut from pale card in both registers. */
const INK = "#241D14";                              /* on a counter: 16.66 by day, 13.89 by night */
const CREAM = "var(--rd-cream, #F2EAD6)";           /* the counters and cards */
const PLATE_INK = "var(--rd-ink, #C8BFAC)";         /* free lettering and linework: 5.68 / 10.64 */
const BRASS = "var(--rd-brass, #C9A45C)";           /* 4.83 on paper, 8.28 on lacquer */
const BRASS_DIM = "var(--rd-brass, #8A6B33)";       /* rims and frames: 4.83 / 3.91 */
const RUST = "var(--rd-rust, #D0704E)";             /* the market's coal on the move: 4.96 / 5.65 */
/* a broken chain is a state, not a material, so it takes the signal's ink;
   rust stays the rail's and the ember's */
const SIGNAL = "rgb(var(--signal-ink, 240 169 46))";

const FELL = "'IM Fell English SC', Georgia, serif";
const MONO = "'IBM Plex Mono', monospace";

/* Ghost routes (drawn once with .rules-ghost, then flowing onward) */
const PATH_MINE =
  "M 95 226 C 140 170, 130 140, 150 111 C 170 84, 250 60, 330 62 C 390 64, 430 72, 464 82";
const PATH_MARKET_UP = "M 518 252 C 560 210, 545 165, 500 112";
const PATH_GHOST_MARKET = "M 496 110 C 545 165, 560 210, 556 240";
const PATH_BROKEN = "M 95 226 C 122 190, 128 165, 136 140";

function SvgChip({
  x,
  y,
  text,
  color,
}: {
  x: number;
  y: number;
  text: string;
  color: string;
}) {
  /* 8.1 units a glyph at 13.5 in Plex Mono, 9 of margin either side */
  const w = text.length * 8.1 + 18;
  return (
    <g transform={`translate(${x - w / 2}, ${y})`}>
      <rect width={w} height={24} fill={CREAM} stroke={color} strokeWidth={1.2} />
      <text x={w / 2} y={16.5} textAnchor="middle" fontSize={13.5} fill={INK} fontFamily={MONO}>
        {text}
      </text>
    </g>
  );
}

/** The animated supply layer — remounted per mode/replay so the game’s exact
 *  ghost-line choreography replays at 1× speed. Memoised: the perpetual CSS
 *  loops inside never re-render from parent state. Chip labels arrive as
 *  props so a language change still re-renders them. */
const ScenarioLayer = memo(function ScenarioLayer({
  mode,
  mineChip,
  marketChip,
  noneChip,
}: {
  mode: Mode;
  mineChip: string;
  marketChip: string;
  noneChip: string;
}) {
  if (mode === "mine") {
    return (
      <g>
        <path
          id="rules-ghost-mine"
          d={PATH_MINE}
          fill="none"
          stroke={BRASS}
          strokeWidth={2.5}
          strokeLinecap="round"
          className="rules-ghost"
          style={{ "--ghost-len": 480 } as CSSProperties}
        />
        <g>
          <animateMotion dur="2.8s" begin="1s" repeatCount="indefinite">
            <mpath href="#rules-ghost-mine" />
          </animateMotion>
          <circle r={11} fill={CREAM} stroke={BRASS_DIM} strokeWidth={1} />
          <image href="/icon-canal.svg" x={-8.5} y={-8.5} width={17} height={17} />
        </g>
        <SvgChip x={520} y={136} text={mineChip} color={BRASS} />
      </g>
    );
  }
  if (mode === "market") {
    return (
      <g>
        <path
          d={PATH_GHOST_MARKET}
          fill="none"
          stroke={RUST}
          strokeWidth={2.5}
          strokeLinecap="round"
          className="rules-ghost"
          style={{ "--ghost-len": 210 } as CSSProperties}
        />
        {/* buy-price cell pulses */}
        <rect
          x={504}
          y={251}
          width={28}
          height={32}
          rx={3}
          fill="none"
          stroke={BRASS}
          strokeWidth={2}
          className="rules-mine-pulse"
        />
        <path id="rules-ghost-market-up" d={PATH_MARKET_UP} fill="none" stroke="none" />
        <g>
          <animateMotion dur="2.2s" begin="1s" repeatCount="indefinite">
            <mpath href="#rules-ghost-market-up" />
          </animateMotion>
          <circle r={10} fill={CREAM} stroke={RUST} strokeWidth={1} />
          <image href="/icon-coal.svg" x={-8} y={-8} width={16} height={16} />
        </g>
        <SvgChip x={585} y={136} text={marketChip} color={RUST} />
      </g>
    );
  }
  return (
    <g>
      <path
        d={PATH_BROKEN}
        fill="none"
        stroke={SIGNAL}
        strokeWidth={2.5}
        strokeLinecap="round"
        className="rules-ghost-rust"
        style={{ "--ghost-len": 130 } as CSSProperties}
      />
      {/* the break in the chain */}
      <g stroke={SIGNAL} strokeWidth={2.5} strokeLinecap="round">
        <path d="M 132 118 L 148 134 M 148 118 L 132 134" />
      </g>
      <g className="rules-shake">
        <rect
          x={468}
          y={62}
          width={54}
          height={46}
          rx={4}
          fill="none"
          stroke={SIGNAL}
          strokeWidth={2}
          strokeDasharray="5 4"
        />
      </g>
      <SvgChip x={548} y={136} text={noneChip} color={SIGNAL} />
    </g>
  );
});

/**
 * §VI showpiece — the interactive supply-logic diagram. An engraved plate
 * set into the paper sheet: two towns, your coal mine and the market tray,
 * with three scenarios animating the exact ghost-line behaviour the board
 * renders in play. Replays when it re-enters the viewport; reduced-motion
 * readers get the fully-drawn end states.
 */
export default function SupplyDiagram() {
  const t = useT();
  const root = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("mine");
  const [replay, setReplay] = useState(0);

  const modes: { id: Mode; label: string; hint: string }[] = [
    { id: "mine", label: t("rules.supply.modes.mine.label"), hint: t("rules.supply.modes.mine.hint") },
    { id: "market", label: t("rules.supply.modes.market.label"), hint: t("rules.supply.modes.market.hint") },
    { id: "none", label: t("rules.supply.modes.none.label"), hint: t("rules.supply.modes.none.hint") },
  ];

  /* Replay the ghost-line choreography each time the plate re-enters the
   * viewport (IntersectionObserver — no GSAP on the platform). */
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let first = true;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          // skip the very first mount pass — the layer is already fresh
          if (first) first = false;
          else setReplay((k) => k + 1);
        }
      },
      { rootMargin: "0px 0px -25% 0px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={root}>
      {/* Engraved plate inset into the ledger — it takes the register's own
          ground, so the plate and its engraving turn over together */}
      <div className="relative overflow-hidden rounded-lg border border-brass-hairline bg-lacquer-950">
        <div aria-hidden className="tex-lacquer pointer-events-none absolute inset-0 opacity-40" />
        <svg
          viewBox="0 0 720 320"
          role="img"
          aria-label={t("rules.supply.aria")}
          className="relative block h-auto w-full"
        >
          {/* plate frame */}
          <rect x={8} y={8} width={704} height={304} rx={10} fill="none" stroke={BRASS_DIM} strokeOpacity={0.4} />

          {/* standing network (engraved, faint) */}
          {mode !== "none" && (
            <path d="M 103 229 C 130 180, 132 150, 141 114" fill="none" stroke={PLATE_INK} strokeOpacity={0.45} strokeWidth={2} />
          )}
          <path d="M 177 82 C 240 60, 360 62, 403 82" fill="none" stroke={PLATE_INK} strokeOpacity={0.45} strokeWidth={2} />

          {/* coal mine */}
          <g>
            <circle cx={95} cy={250} r={30} fill={BRASS} className="rules-mine-pulse" />
            <circle cx={95} cy={250} r={24} fill={CREAM} stroke={BRASS_DIM} strokeWidth={1.5} />
            <image href="/icon-coal.svg" x={78} y={233} width={34} height={34} />
            <text x={95} y={296} textAnchor="middle" fontSize={13.5} fill={PLATE_INK} fontFamily={FELL}>
              {t("rules.supply.yourMine")}
            </text>
          </g>

          {/* town A */}
          <g>
            <circle cx={150} cy={85} r={26} fill={CREAM} stroke={BRASS_DIM} strokeWidth={1.5} />
            <text x={150} y={90} textAnchor="middle" fontSize={13.5} fill={INK} fontFamily={FELL}>Dudley</text>
          </g>

          {/* town B */}
          <g>
            <circle cx={430} cy={85} r={26} fill={CREAM} stroke={BRASS_DIM} strokeWidth={1.5} />
            <text x={430} y={90} textAnchor="middle" fontSize={13.5} fill={INK} fontFamily={FELL}>B’ham</text>
          </g>

          {/* build slot */}
          {mode !== "none" && (
            <g>
              <rect x={468} y={62} width={54} height={46} rx={4} fill="none" stroke={BRASS} strokeWidth={1.6} strokeDasharray="5 4" />
              <text x={495} y={126} textAnchor="middle" fontSize={13.5} fill={PLATE_INK} fontFamily={MONO}>
                {t("rules.supply.buildSlot")}
              </text>
            </g>
          )}

          {/* market tray */}
          <g>
            <rect x={430} y={244} width={262} height={46} rx={7} fill={PLATE_INK} fillOpacity={0.1} stroke={BRASS_DIM} strokeOpacity={0.7} />
            <text x={561} y={236} textAnchor="middle" fontSize={13.5} fill={PLATE_INK} fontFamily={FELL}>
              {t("rules.supply.marketLabel")}
            </text>
            {Array.from({ length: 7 }).map((_, i) => (
              <g key={i}>
                <rect
                  x={444 + i * 35}
                  y={251}
                  width={32}
                  height={32}
                  rx={3}
                  fill={CREAM}
                  stroke={BRASS_DIM}
                  strokeOpacity={0.5}
                />
                <text x={460 + i * 35} y={266} textAnchor="middle" fontSize={13.5} fill={INK} fontFamily={MONO}>
                  £{i + 1}
                </text>
                {i >= 2 && <circle cx={460 + i * 35} cy={275} r={6} fill={INK} />}
              </g>
            ))}
          </g>

          <ScenarioLayer
            key={`${mode}-${replay}`}
            mode={mode}
            mineChip={t("rules.supply.chips.mine")}
            marketChip={t("rules.supply.chips.market")}
            noneChip={t("rules.supply.chips.none")}
          />
        </svg>
      </div>

      {/* Scenario controls — ≥48px targets, brass on enamel */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t("rules.supply.groupAria")}>
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              "min-h-[48px] flex-1 basis-40 rounded-lg border px-4 py-2 font-ui text-[13px] font-semibold uppercase tracking-[0.08em] transition-[background-color,border-color,color] duration-150",
              mode === m.id
                ? "border-brass-500 bg-[rgb(var(--brass-plate))] text-[rgb(var(--ink-on-brass))]"
                : "border-brass-hairline bg-transparent text-paper-300 hover:border-brass-hairline-strong hover:bg-enamel-800 hover:text-paper-100",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="mt-3 min-h-[44px] rounded border-l-[3px] border-brass-500/70 bg-lacquer-950 px-3 py-2 font-ui text-[13px] leading-relaxed text-paper-300">
        {modes.find((m) => m.id === mode)?.hint}
      </p>
    </div>
  );
}
