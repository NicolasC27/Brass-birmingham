import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  useReducedMotion,
} from "framer-motion";
import PlayerToken from "@/components/setup/PlayerToken";
import type { PlayerColor } from "@/components/setup/constants";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

export interface PodiumEntry {
  name: string;
  color: PlayerColor;
  vp: number;
  income: number;
  isWinner: boolean;
  isHuman: boolean;
  /** 1-based final rank after tie-breaks. */
  rank: number;
}

/** Engraved laurel crown for the winner (endgame.md §2, inline SVG). */
function Laurel({ className }: { className?: string }) {
  const branch = (flip: boolean) => (
    <g transform={flip ? "scale(-1,1) translate(-64,0)" : undefined}>
      {Array.from({ length: 6 }).map((_, i) => (
        <ellipse
          key={i}
          cx={26 + i * 2.4}
          cy={46 - i * 6.4}
          rx="5.4"
          ry="2.4"
          fill="none"
          stroke="#C9A45C"
          strokeWidth="1.4"
          transform={`rotate(${-38 - i * 6} ${26 + i * 2.4} ${46 - i * 6.4})`}
        />
      ))}
      <path
        d="M 24 50 C 30 34 36 22 44 10"
        fill="none"
        stroke="#C9A45C"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </g>
  );
  return (
    <svg viewBox="0 0 64 56" className={className} aria-hidden>
      {branch(false)}
      {branch(true)}
    </svg>
  );
}

/** VP counter — rolls from 0 to the final score with an expo-out settle. */
function Counter({
  value,
  start,
  className,
}: {
  value: number;
  start: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(reduced || !start ? value : 0);
  const rounded = useTransform(mv, (v) => String(Math.max(0, Math.round(v))));

  useEffect(() => {
    if (reduced || !start) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    });
    return () => controls.stop();
  }, [start, value, reduced, mv]);

  return <motion.span className={cn("tabular-nums", className)}>{rounded}</motion.span>;
}

/**
 * The podium (endgame.md §2 / §6). Beveled pedestals, engraved medallions,
 * rolling VP counters. `compact` renders the flat ranked ledger reused by the
 * end-of-Canal-Era modal (same component family, no pedestals).
 */
export default function Podium({
  entries,
  compact = false,
  start = true,
  countStart,
}: {
  entries: PodiumEntry[];
  compact?: boolean;
  /** Pedestals rise when true. */
  start?: boolean;
  /** VP counters roll when true (defaults to `start`). */
  countStart?: boolean;
}) {
  const t = useT();
  const countersLive = countStart ?? start;
  if (compact) {
    return (
      <ol className="flex flex-col divide-y divide-coal-700/70" aria-label={t("results.podium.standingsAria")}>
        {entries.map((e) => (
          <li key={e.name} className="flex items-center gap-3 py-2.5">
            <span className="w-8 font-fell text-sm text-brass-500">{t(`results.podium.ranks.${e.rank - 1}`)}</span>
            <PlayerToken color={e.color} size={22} />
            <span className="min-w-0 flex-1 truncate font-sans text-sm font-medium text-cream-100">
              {e.name}
            </span>
            <span className="font-mono text-sm font-semibold text-brass-400 tabular-nums">
              {t("results.podium.vp", { vp: e.vp })}
            </span>
            <span className="font-mono text-xs text-cream-100/55 tabular-nums">
              {t("results.podium.incomeShort", { income: e.income })}
            </span>
          </li>
        ))}
      </ol>
    );
  }

  // Classic arrangement: 2nd | 1st | 3rd (| 4th) — 1st pedestal tallest.
  const order: PodiumEntry[] = [];
  const byRank = [...entries].sort((a, b) => a.rank - b.rank);
  if (byRank[1]) order.push(byRank[1]);
  if (byRank[0]) order.push(byRank[0]);
  if (byRank[2]) order.push(byRank[2]);
  if (byRank[3]) order.push(byRank[3]);

  return (
    <div
      className="flex flex-wrap items-end justify-center gap-4 sm:gap-6"
      role="list"
      aria-label={t("results.podium.podiumAria")}
    >
      {order.map((e, i) => {
        const first = e.rank === 1;
        return (
          <motion.div
            role="listitem"
            key={e.name}
            initial={{ opacity: 0, y: 48 }}
            animate={start ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.5 + i * 0.35, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -2 }}
            className="group flex flex-col items-center"
          >
            {/* Laurel + halo for the winner */}
            <div className="relative mb-2 flex h-12 items-end justify-center">
              {first && start && (
                <>
                  <motion.span
                    aria-hidden
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.7, 0.35] }}
                    transition={{ delay: 1.9, duration: 1.2 }}
                    className="absolute -inset-2 rounded-full"
                    style={{
                      background:
                        "radial-gradient(50% 50% at 50% 60%, rgba(201,164,92,0.4), transparent 70%)",
                    }}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={start ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 1.85, duration: 0.5, ease: "easeOut" }}
                  >
                    <Laurel className="h-11 w-12" />
                  </motion.div>
                </>
              )}
            </div>

            {/* Engraved medallion */}
            <div
              className={cn(
                "flex items-center justify-center rounded-full border bg-coal-800 shadow-e2 transition-transform duration-200 group-hover:rotate-2",
                first
                  ? "h-[72px] w-[72px] border-brass-400"
                  : "h-14 w-14 border-brass-700/80",
              )}
              style={{
                boxShadow: first
                  ? "0 3px 6px rgba(0,0,0,.45), 0 10px 24px rgba(0,0,0,.25), 0 0 22px rgba(201,164,92,0.28), inset 0 1px 0 rgba(242,234,214,.18)"
                  : undefined,
              }}
            >
              <PlayerToken color={e.color} size={first ? 44 : 34} />
            </div>

            {/* Name + caption */}
            <p className="mt-3 max-w-[150px] truncate text-center font-display text-base font-bold text-cream-100">
              {e.name}
            </p>
            <p className="mt-0.5 text-center font-fell text-[12.5px] tracking-wide text-cream-100/55">
              {first
                ? e.isHuman
                  ? t("results.podium.winnerHuman")
                  : t("results.podium.winnerAi", { name: e.name })
                : t("results.podium.finalIncome", { income: e.income })}
            </p>

            {/* Pedestal */}
            <div
              className={cn(
                "mt-3 flex w-full min-w-[132px] flex-col items-center rounded-t-md border border-b-0 border-brass-700/60 bg-coal-700 px-5 shadow-e2 transition-shadow duration-200 group-hover:shadow-e3-hover",
                first ? "pb-8 pt-5" : "pb-5 pt-4",
              )}
              style={{
                backgroundImage:
                  "linear-gradient(180deg, rgba(44,37,29,1), rgba(33,28,23,1))",
              }}
            >
              <span className="font-fell text-[10.5px] uppercase tracking-label text-brass-500">
                {t(`results.podium.places.${e.rank - 1}`)}
              </span>
              <Counter
                value={e.vp}
                start={countersLive}
                className={cn(
                  "mt-1 font-mono font-semibold text-brass-400",
                  first ? "text-[40px] leading-none" : "text-[32px] leading-none",
                )}
              />
              <span className="mt-1 font-sans text-[10.5px] uppercase tracking-[0.16em] text-cream-100/50">
                {t("results.podium.victoryPoints")}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
