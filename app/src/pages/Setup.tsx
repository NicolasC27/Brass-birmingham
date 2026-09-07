import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/i18n";
import SeatRow from "@/components/setup/SeatRow";
import HouseRules from "@/components/setup/HouseRules";
import ShutterWipe from "@/components/setup/ShutterWipe";
import PlayerToken from "@/components/setup/PlayerToken";
import Tip from "@/components/setup/Tip";
import { leaveTable } from "@/online/net";
import {
  SETUP_STORAGE_KEY,
  dedupeNames,
  defaultSeats,
  difficultyLabel,
  loadStoredSetup,
  openSeat,
  seatsFromStored,
  type PlayerColor,
  type Seat,
  type SetupOptions,
  DEFAULT_OPTIONS,
  type SeatType,
  type BotDifficulty,
  type StoredSetup,
} from "@/components/setup/constants";
import { cn } from "@/lib/utils";

export default function Setup() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get("mode") === "hotseat" ? "hotseat" : "solo";

  const [seats, setSeats] = useState<Seat[]>(() => {
    const stored = loadStoredSetup();
    return stored ? seatsFromStored(stored) : defaultSeats(mode);
  });
  const [options, setOptions] = useState<SetupOptions>(() => {
    return loadStoredSetup()?.options ?? DEFAULT_OPTIONS;
  });
  const [starting, setStarting] = useState(false);

  const seated = useMemo(() => seats.filter((s) => s.type !== "closed"), [seats]);
  const canStart = seated.length >= 2;

  const patchSeat = (index: number, patch: Partial<Seat>) =>
    setSeats((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const handleTypeChange = (index: number, type: SeatType) =>
    setSeats((prev) => {
      if (type === "closed") {
        return prev.map((s, i) => (i === index ? { ...s, type: "closed" } : s));
      }
      const taken = prev
        .filter((s, i) => i !== index && s.type !== "closed")
        .map((s) => s.name);
      return prev.map((s, i) => (i === index ? openSeat(s, type, taken) : s));
    });

  /** Color stealing: the swatch is taken from whoever holds it (swap). */
  const handleColorChange = (index: number, color: PlayerColor) =>
    setSeats((prev) => {
      const holder = prev.findIndex((s, i) => i !== index && s.type !== "closed" && s.color === color);
      const mine = prev[index].color;
      return prev.map((s, i) => {
        if (i === index) return { ...s, color };
        if (i === holder) return { ...s, color: mine };
        return s;
      });
    });

  const start = useCallback(() => {
    if (!canStart || starting) return;
    const players = seats.filter((s) => s.type !== "closed");
    const names = dedupeNames(players.map((s) => s.name));
    const payload: StoredSetup = {
      players: players.map((s, i) => ({
        name: names[i],
        color: s.color,
        type: s.type === "human" ? ("human" as const) : ("bot" as const),
        ...(s.type === "bot" ? { difficulty: s.difficulty as BotDifficulty } : {}),
      })),
      options: {
        eraLength: options.eraLength,
        marketTemper: options.marketTemper,
        timerMinutes: options.timerMinutes,
        fidelity: options.fidelity,
      },
    };
    try {
      localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* storage unavailable — the game page will fall back to defaults */
    }
    /* a game set up here is played here, whatever table was open before */
    leaveTable();
    setStarting(true);
  }, [canStart, starting, seats, options]);

  // Live-persist the seating draft (v10 hot-seat): edited player names and
  // house rules survive a round-trip and prefill the next visit, without
  // waiting for "Begin". Debounced; skipped while the start wipe plays.
  useEffect(() => {
    if (starting) return;
    const t = window.setTimeout(() => {
      const players = seats.filter((s) => s.type !== "closed");
      if (players.length < 2) return;
      const payload: StoredSetup = {
        players: players.map((s) => ({
          name: s.name,
          color: s.color,
          type: s.type === "human" ? ("human" as const) : ("bot" as const),
          ...(s.type === "bot" ? { difficulty: s.difficulty as BotDifficulty } : {}),
        })),
        options: {
          eraLength: options.eraLength,
          marketTemper: options.marketTemper,
          timerMinutes: options.timerMinutes,
          fidelity: options.fidelity,
        },
      };
      try {
        localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* storage unavailable — prefill simply falls back to defaults */
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [seats, options, starting]);

  // Keyboard: Escape returns to the title; Enter (outside inputs) starts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate("/");
      if (e.key === "Enter") {
        const el = e.target as HTMLElement | null;
        const tag = el?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
        start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, start]);

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)]">
      {/* Table felt + soot vignette + coal dust (textures stay ≤12% behind text) */}
      <div aria-hidden className="tex-felt pointer-events-none absolute inset-0 opacity-90" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 30%, transparent 40%, rgba(16,13,11,0.75) 100%)",
        }}
      />
      <div aria-hidden className="tex-coal pointer-events-none absolute inset-0 opacity-[0.05]" />

      <div className="relative mx-auto max-w-[1180px] px-6 py-10 lg:py-14">
        {/* Header row */}
        <header className="mb-8">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-cream-100/60 transition-colors hover:text-brass-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("setup.backToTitle")}
          </Link>
          <p className="eyebrow">{t("setup.eyebrow")}</p>
          <h1 className="mt-2 font-display text-[44px] font-black leading-none tracking-[-0.01em] text-cream-100">
            {t("setup.title")}
          </h1>
        </header>

        <div className="grid gap-6 lg:grid-cols-[640px_1fr]">
          {/* Panel 1 — Seating */}
          <motion.section
            aria-label={t("setup.seating.ariaLabel")}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="plate relative p-6"
          >
            <div
              aria-hidden
              className="tex-paper pointer-events-none absolute inset-0 rounded-[8px] opacity-[0.05]"
            />
            <header className="relative">
              <h2 className="font-fell text-lg uppercase tracking-[0.06em] text-cream-100">
                {t("setup.seating.heading")}
              </h2>
              <div className="divider-brass mt-3 !mx-0" />
            </header>
            <div className="relative mt-4 flex flex-col gap-3">
              {seats.map((seat, i) => (
                <SeatRow
                  key={i}
                  seat={seat}
                  index={i}
                  isHead={i === 0}
                  canClose={seated.length > 2}
                  onTypeChange={(t) => handleTypeChange(i, t)}
                  onNameChange={(name) => patchSeat(i, { name })}
                  onColorChange={(c) => handleColorChange(i, c)}
                  onDifficultyChange={(difficulty) => patchSeat(i, { difficulty })}
                />
              ))}
            </div>
            <p className="relative mt-4 font-sans text-[12px] leading-relaxed text-cream-100/50">
              {t("setup.seating.note")}
            </p>
          </motion.section>

          {/* Panel 2 — House Rules */}
          <HouseRules options={options} onChange={(patch) => setOptions((o) => ({ ...o, ...patch }))} />
        </div>

        {/* Start bar */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
          className={cn(
            "plaque plaque-rivets sticky bottom-4 mt-8 flex min-h-[88px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4",
            starting && "animate-pulse-glow",
          )}
        >
          {/* Table summary chips */}
          <div className="flex flex-wrap items-center gap-2">
            <AnimatePresence mode="popLayout">
              {seated.map((s) => (
                <motion.span
                  layout
                  key={`${s.color}-${s.name}-${s.type}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 400, damping: 26 }}
                  className="inline-flex items-center gap-2 rounded-full border border-ink-900/40 bg-coal-900/85 py-1 pl-1.5 pr-3"
                >
                  <PlayerToken color={s.color} size={18} />
                  <span className="font-sans text-[12px] font-semibold text-cream-100">
                    {s.type === "bot"
                      ? t("setup.summary.botName", { difficulty: difficultyLabel(s.difficulty), name: s.name || "…" })
                      : s.name || "…"}
                  </span>
                  <span className="font-sans text-[10px] uppercase tracking-[0.12em] text-brass-400">
                    {t(`setup.colors.${s.color}`)}
                  </span>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>

          {/* Begin */}
          {canStart ? (
            <button
              type="button"
              onClick={start}
              disabled={starting}
              className="btn-strike !h-14 !rounded-lg !px-8 !font-display !text-xl !font-bold normal-case !tracking-normal"
            >
              {t("setup.begin")}
            </button>
          ) : (
            <Tip label={t("setup.beginHint")}>
              <button
                type="button"
                disabled
                className="btn-strike !h-14 !rounded-lg !px-8 !font-display !text-xl !font-bold normal-case !tracking-normal saturate-50"
              >
                {t("setup.begin")}
              </button>
            </Tip>
          )}
        </motion.div>
      </div>

      <ShutterWipe active={starting} onDone={() => navigate("/game")} />
    </div>
  );
}
