import { memo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

gsap.registerPlugin(ScrollTrigger);

type Mode = "mine" | "market" | "none";

const INK = "#241D14";
const CREAM = "#F2EAD6";
const BRASS = "#C9A45C";
const BRASS_DIM = "#8A6B33";
const COPPER = "#A6562B";
const RUST = "#8E3B2F";

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
  const w = text.length * 6.4 + 18;
  return (
    <g transform={`translate(${x - w / 2}, ${y})`}>
      <rect width={w} height={22} rx={5} fill="#171310" stroke={color} strokeWidth={1.2} />
      <text x={w / 2} y={15} textAnchor="middle" fontSize={11} fill={CREAM} fontFamily={MONO}>
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
        <SvgChip x={520} y={128} text={mineChip} color={BRASS} />
      </g>
    );
  }
  if (mode === "market") {
    return (
      <g>
        <path
          d={PATH_GHOST_MARKET}
          fill="none"
          stroke={COPPER}
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
          <circle r={10} fill={CREAM} stroke={COPPER} strokeWidth={1} />
          <image href="/icon-coal.svg" x={-8} y={-8} width={16} height={16} />
        </g>
        <SvgChip x={585} y={128} text={marketChip} color={COPPER} />
      </g>
    );
  }
  return (
    <g>
      <path
        d={PATH_BROKEN}
        fill="none"
        stroke={RUST}
        strokeWidth={2.5}
        strokeLinecap="round"
        className="rules-ghost-rust"
        style={{ "--ghost-len": 130 } as CSSProperties}
      />
      {/* the break in the chain */}
      <g stroke={RUST} strokeWidth={2.5} strokeLinecap="round">
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
          stroke={RUST}
          strokeWidth={2}
          strokeDasharray="5 4"
        />
      </g>
      <SvgChip x={548} y={128} text={noneChip} color={RUST} />
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

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;
      ScrollTrigger.create({
        trigger: root.current,
        start: "top 75%",
        onEnter: () => setReplay((k) => k + 1),
        onEnterBack: () => setReplay((k) => k + 1),
      });
    },
    { scope: root },
  );

  return (
    <div ref={root}>
      {/* Engraved plate inset into the paper */}
      <div className="relative overflow-hidden rounded-lg border border-brass-700/60 bg-coal-800 shadow-e2">
        <div aria-hidden className="tex-coal pointer-events-none absolute inset-0 opacity-[0.1]" />
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
            <path d="M 103 229 C 130 180, 132 150, 141 114" fill="none" stroke={CREAM} strokeOpacity={0.25} strokeWidth={2} />
          )}
          <path d="M 177 82 C 240 60, 360 62, 403 82" fill="none" stroke={CREAM} strokeOpacity={0.25} strokeWidth={2} />

          {/* coal mine */}
          <g>
            <circle cx={95} cy={250} r={30} fill={BRASS} className="rules-mine-pulse" />
            <circle cx={95} cy={250} r={24} fill={CREAM} stroke={BRASS_DIM} strokeWidth={1.5} />
            <image href="/icon-coal.svg" x={78} y={233} width={34} height={34} />
            <text x={95} y={292} textAnchor="middle" fontSize={11} fill={CREAM} fillOpacity={0.8} fontFamily={FELL}>
              {t("rules.supply.yourMine")}
            </text>
          </g>

          {/* town A */}
          <g>
            <circle cx={150} cy={85} r={26} fill="#211C17" stroke={BRASS_DIM} strokeWidth={1.5} />
            <text x={150} y={90} textAnchor="middle" fontSize={12} fill={CREAM} fontFamily={FELL}>Dudley</text>
          </g>

          {/* town B */}
          <g>
            <circle cx={430} cy={85} r={26} fill="#211C17" stroke={BRASS_DIM} strokeWidth={1.5} />
            <text x={430} y={90} textAnchor="middle" fontSize={12} fill={CREAM} fontFamily={FELL}>B’ham</text>
          </g>

          {/* build slot */}
          {mode !== "none" && (
            <g>
              <rect x={468} y={62} width={54} height={46} rx={4} fill="none" stroke={BRASS} strokeWidth={1.6} strokeDasharray="5 4" />
              <text x={495} y={128} textAnchor="middle" fontSize={10.5} fill={BRASS} fontFamily={MONO}>
                {t("rules.supply.buildSlot")}
              </text>
            </g>
          )}

          {/* market tray */}
          <g>
            <rect x={430} y={244} width={262} height={46} rx={7} fill="#100D0B" stroke={BRASS_DIM} strokeOpacity={0.7} />
            <text x={561} y={236} textAnchor="middle" fontSize={11} fill={CREAM} fillOpacity={0.7} fontFamily={FELL}>
              {t("rules.supply.marketLabel")}
            </text>
            {Array.from({ length: 8 }).map((_, i) => (
              <g key={i}>
                <rect
                  x={444 + i * 31}
                  y={251}
                  width={28}
                  height={32}
                  rx={3}
                  fill="#211C17"
                  stroke={BRASS_DIM}
                  strokeOpacity={0.5}
                />
                <text x={458 + i * 31} y={264} textAnchor="middle" fontSize={9} fill={BRASS} fontFamily={MONO}>
                  £{i + 1}
                </text>
                {i < 2 && <circle cx={458 + i * 31} cy={275} r={6} fill={INK} stroke={CREAM} strokeOpacity={0.5} strokeWidth={1} />}
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

      {/* Scenario controls — ≥48px targets, brass on paper */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t("rules.supply.groupAria")}>
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              "min-h-[48px] flex-1 basis-40 rounded-md border px-4 py-2 font-sans text-[13px] font-semibold uppercase tracking-[0.08em] transition-all",
              mode === m.id
                ? "border-brass-700 bg-gradient-to-br from-brass-400 via-brass-500 to-brass-700 text-ink-900 shadow-e2"
                : "border-brass-700/60 bg-transparent text-ink-900/75 hover:bg-brass-500/15 hover:text-ink-900",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="mt-3 min-h-[44px] rounded border-l-2 border-brass-700/70 bg-brass-500/[0.07] px-3 py-2 text-[13px] leading-relaxed text-ink-900/85">
        {modes.find((m) => m.id === mode)?.hint}
      </p>
    </div>
  );
}
