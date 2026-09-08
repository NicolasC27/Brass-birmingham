import { motion, AnimatePresence } from "framer-motion";
import { Plus, Info } from "lucide-react";
import { useT } from "@/i18n";
import PlayerToken from "./PlayerToken";
import Segmented from "./Segmented";
import Tip from "./Tip";
import {
  DIFFICULTIES,
  PLAYER_COLORS,
  type BotDifficulty,
  type PlayerColor,
  type Seat,
  type SeatType,
} from "./constants";
import { cn } from "@/lib/utils";

const RIM_CLASS: Record<string, string> = {
  copper: "border-copper-500 text-copper-500",
  brass: "border-brass-700 text-brass-500",
  glow: "border-brass-400 text-brass-400",
};

/**
 * One seating slot (setup.md §Panel 1): color token, name field, type toggle,
 * color swatches with stealing, bot difficulty medallions. Collapses to a
 * dashed "Empty chair" placeholder when closed.
 */
export default function SeatRow({
  seat,
  index,
  isHead,
  canClose,
  onTypeChange,
  onNameChange,
  onColorChange,
  onDifficultyChange,
}: {
  seat: Seat;
  index: number;
  isHead: boolean;
  canClose: boolean;
  onTypeChange: (type: SeatType) => void;
  onNameChange: (name: string) => void;
  onColorChange: (color: PlayerColor) => void;
  onDifficultyChange: (difficulty: BotDifficulty) => void;
}) {
  const t = useT();
  const TYPE_OPTIONS: { value: SeatType; label: string }[] = [
    { value: "human", label: t("setup.seat.typeHuman") },
    { value: "bot", label: t("setup.seat.typeBot") },
    { value: "closed", label: t("setup.seat.typeClosed") },
  ];

  if (seat.type === "closed") {
    return (
      <motion.div
        initial={{ opacity: 0, height: 56 }}
        animate={{ opacity: 1, height: 56 }}
        className="flex items-center justify-between rounded-md border border-dashed border-brass-700/40 px-4"
        style={{ height: 56 }}
      >
        <span className="font-fell text-sm tracking-wide text-cream-100/40">
          {t("setup.seat.empty")}
        </span>
        <Tip label={t("setup.seat.seatAnother")} side="top">
          <button
            type="button"
            onClick={() => onTypeChange("bot")}
            aria-label={t("setup.seat.openAria", { n: index + 1 })}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-brass-700/70 text-brass-500 transition-colors hover:border-brass-500 hover:bg-brass-500/10"
          >
            <Plus className="h-4 w-4" />
          </button>
        </Tip>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, height: 56 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="rounded-md border border-coal-700/80 bg-coal-800/70 px-4 py-3"
    >
      <div className="flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-2">
        {/* Token — quarter-flip as its color/shape resolves */}
        <motion.div
          key={seat.color}
          initial={{ rotateY: 90 }}
          animate={{ rotateY: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          style={{ transformStyle: "preserve-3d" }}
        >
          <PlayerToken color={seat.color} size={28} />
        </motion.div>

        {/* Bot portrait medallion */}
        <AnimatePresence>
          {seat.type === "bot" && (
            <motion.img
              key="bot-portrait"
              src="/avatar-bot.webp"
              alt={t("setup.seat.botPortraitAlt")}
              initial={{ opacity: 0, x: -10, scale: 0.85 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.85 }}
              transition={{ duration: 0.25 }}
              className="h-9 w-9 rounded-full border border-brass-500/80 object-cover shadow-[0_0_0_3px_rgba(201,164,92,0.15)]"
            />
          )}
        </AnimatePresence>

        {/* Name field — parchment input */}
        <input
          value={seat.name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t("setup.seat.namePlaceholder")}
          maxLength={24}
          aria-label={t("setup.seat.nameAria", { n: index + 1 })}
          className="h-10 min-w-0 flex-1 rounded-md border border-brass-700/60 bg-cream-100 px-3 font-sans text-sm font-medium text-ink-900 placeholder:font-fell placeholder:text-ink-900/45 focus-visible:outline-brass-400"
        />

        {/* Type selector */}
        {isHead ? (
          <span className="rounded-full border border-brass-700/60 bg-coal-900 px-3 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-brass-400">
            {t("setup.seat.headBadge")}
          </span>
        ) : (
          <Segmented<SeatType>
            ariaLabel={t("setup.seat.typeAria", { n: index + 1 })}
            value={seat.type}
            onChange={onTypeChange}
            options={
              canClose
                ? TYPE_OPTIONS
                : TYPE_OPTIONS.map((o) => ({ ...o, disabled: o.value === "closed" }))
            }
          />
        )}
      </div>

      {/* Per-seat details */}
      <AnimatePresence initial={false}>
        <motion.div
          key={`${seat.type}-details`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          {/* Color picker — choosing a color steals it from its holder */}
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label={t("setup.seat.colorAria", { n: index + 1 })}>
            {PLAYER_COLORS.map((c) => {
              const active = seat.color === c.id;
              return (
                <Tip key={c.id} label={t("setup.seat.colorStealTip", { color: t(`setup.colors.${c.id}`) })}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={t(`setup.colors.${c.id}`)}
                    onClick={() => onColorChange(c.id)}
                    className={cn(
                      "rounded-full p-0.5 transition-transform duration-150",
                      active
                        ? "ring-2 ring-brass-400 ring-offset-2 ring-offset-coal-800"
                        : "opacity-55 hover:scale-110 hover:opacity-100",
                    )}
                  >
                    <PlayerToken color={c.id} size={20} />
                  </button>
                </Tip>
              );
            })}
          </div>

          {/* Bot difficulty medallions */}
          {seat.type === "bot" && (
            <div className="relative flex flex-wrap items-center gap-1.5 overflow-visible">
              {DIFFICULTIES.map((d) => {
                const active = seat.difficulty === d.id;
                return (
                  <Tip key={d.id} label={t(`setup.difficulty.${d.id}.tendency`)}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => onDifficultyChange(d.id)}
                      className={cn(
                        "rounded-full border-2 px-2.5 py-1 font-fell text-[12px] tracking-wide transition-all duration-150",
                        RIM_CLASS[d.rim],
                        active
                          ? "bg-coal-900 shadow-[0_0_10px_rgba(201,164,92,0.35)]"
                          : "border-opacity-40 opacity-55 hover:opacity-100",
                      )}
                    >
                      {t(`setup.difficulty.${d.id}.label`)}
                    </button>
                  </Tip>
                );
              })}
              <Tip label={t("setup.seat.engineTip")}>
                <span className="inline-flex cursor-help items-center gap-1 rounded border border-rust-500/70 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-rust-500">
                  {t("setup.seat.beta")}
                  <Info className="h-3 w-3" />
                </span>
              </Tip>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
