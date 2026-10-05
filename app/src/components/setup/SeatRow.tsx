import { motion, AnimatePresence } from "framer-motion";
import { Bot, Plus, Info } from "lucide-react";
import { useT } from "@/i18n";
import PlayerToken from "./PlayerToken";
import Segmented from "./Segmented";
import Tip from "./Tip";
import {
  PERSONAS,
  PLAYER_COLORS,
  colorDef,
  type BotPersona,
  type PlayerColor,
  type Seat,
  type SeatType,
} from "./constants";
import { cn } from "@/lib/utils";
import { EXPERT } from "@/game/search";

/**
 * One seating slot (create.md §A3): color token, name field, type toggle,
 * color swatches with stealing, the characters a machine can be. Collapses to a
 * dashed "Empty chair" placeholder when closed. Restyled to the platform
 * palette (enamel panels, brass hairlines) — props and behavior unchanged.
 */
export default function SeatRow({
  seat,
  index,
  isHead,
  canClose,
  onTypeChange,
  onNameChange,
  onColorChange,
  onPersonaChange,
}: {
  seat: Seat;
  index: number;
  isHead: boolean;
  canClose: boolean;
  onTypeChange: (type: SeatType) => void;
  onNameChange: (name: string) => void;
  onColorChange: (color: PlayerColor) => void;
  onPersonaChange: (persona: BotPersona) => void;
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="mt-3 flex items-center justify-between border border-dashed border-[var(--gz-ink-soft)] px-4"
        style={{ height: 56 }}
      >
        <span className="font-ui text-[13px] tracking-wide text-iron-600">
          {t("setup.seat.empty")}
        </span>
        <Tip label={t("setup.seat.seatAnother")} side="top">
          <button
            type="button"
            onClick={() => onTypeChange("bot")}
            aria-label={t("setup.seat.openAria", { n: index + 1 })}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--gz-ink-soft)] text-brass-300 transition-colors hover:border-brass-300 hover:bg-enamel-800"
          >
            <Plus className="h-4 w-4" />
          </button>
        </Tip>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="border-b border-[var(--gz-ink-faint)] px-1 py-3 last:border-b-0"
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

        {/* Bot medallion — clockwork icon on enamel (platform §7.1) */}
        <AnimatePresence>
          {seat.type === "bot" && (
            <motion.span
              key="bot-medallion"
              initial={{ opacity: 0, x: -10, scale: 0.85 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.85 }}
              transition={{ duration: 0.25 }}
              aria-label={t("platform.seat.bot")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--gz-ink-soft)] text-iron-400"
            >
              <Bot size={18} aria-hidden />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Name field — register input */}
        <input
          value={seat.name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t("setup.seat.namePlaceholder")}
          maxLength={24}
          aria-label={t("setup.seat.nameAria", { n: index + 1 })}
          className="h-9 min-w-0 flex-1 border-b border-[var(--gz-ink-soft)] bg-transparent px-1 font-fraunces text-[16px] font-medium text-paper-100 placeholder:text-iron-600 focus:border-brass-300 focus:outline-none"
        />

        {/* Type selector */}
        {isHead ? (
          <span className="micro-label text-brass-300">
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
                      active ? "ring-2 ring-brass-300 ring-offset-2 ring-offset-[rgb(var(--lacquer-900))]" : "opacity-80 hover:scale-110 hover:opacity-100",
                    )}
                  >
                    <PlayerToken color={c.id} size={22} />
                  </button>
                </Tip>
              );
            })}
          </div>

          {/* The characters a machine can be: a portrait medallion each, the
              chosen one ringed in its own colour; the words for it below */}
          {seat.type === "bot" && (
            <div className="flex w-full flex-col gap-2">
              <div role="radiogroup" aria-label={t("setup.seat.typeBot")} className="flex flex-wrap items-center gap-1">
                {PERSONAS.map((d) => {
                  const active = seat.persona === d.id;
                  const hex = colorDef(d.color).hex;
                  return (
                    <Tip key={d.id} label={t(d.id === EXPERT ? "setup.persona.expert" : "setup.persona.adaptive")}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={d.name}
                        onClick={() => onPersonaChange(d.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors duration-150",
                          active ? "bg-enamel-800 text-paper-100" : "text-iron-400 hover:bg-enamel-800/60 hover:text-paper-100",
                        )}
                      >
                        <img
                          src={`/portrait-${d.id}.webp`}
                          alt=""
                          draggable={false}
                          className={cn("h-9 w-9 rounded-full object-cover transition-transform duration-150", active ? "scale-100" : "scale-90 saturate-[.7]")}
                          style={{ boxShadow: active ? `0 0 0 2px ${hex}, 0 2px 6px rgba(0,0,0,.45)` : "0 1px 3px rgba(0,0,0,.35)" }}
                        />
                        <span className="font-ui text-[10.5px] font-semibold uppercase tracking-[0.12em]">{d.name}</span>
                      </button>
                    </Tip>
                  );
                })}
              </div>
              <p className="flex flex-wrap items-center gap-x-3 font-serif text-[12.5px] italic leading-snug text-paper-300">
                <span>{t(seat.persona === EXPERT ? "setup.persona.expert" : "setup.persona.adaptive")}</span>
                <Tip label={t("setup.seat.engineTip")}>
                  <span className="inline-flex cursor-help items-center gap-1 font-ui text-[10px] font-semibold not-italic uppercase tracking-[0.14em] text-rust-400">
                    {t("setup.seat.beta")}
                    <Info className="h-3 w-3" />
                  </span>
                </Tip>
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
