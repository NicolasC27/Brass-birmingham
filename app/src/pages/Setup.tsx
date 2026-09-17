import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { motion } from "framer-motion";
import { BookOpen, Bot, MonitorSmartphone, Play, Save, Users, X } from "lucide-react";
import { pickTableName } from "@/online/tableNames";
import { useT } from "@/i18n";
import SeatRow from "@/components/setup/SeatRow";
import HouseRules from "@/components/setup/HouseRules";
import ShutterWipe from "@/components/setup/ShutterWipe";
import Tip from "@/components/setup/Tip";
import Button from "@/components/platform/Button";
import SeatToken from "@/components/platform/SeatToken";
import {
  SETUP_STORAGE_KEY,
  dedupeNames,
  defaultSeats,
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

/* ------------------------------------------------------------------ */
/* /setup — console de création de table (create.md).                  */
/* Fiche de réglages (identité · mode solo/hotseat · sièges & bots ·   */
/* house rules) + aperçu « registre » sticky, miroir temps réel.       */
/* Contrats gelés : brassworks.setup.v1 persisté tel quel, ?mode=,     */
/* démarrage → /game. La visibilité publique/privée n'existe que pour  */
/* les tables en ligne : ici, présentation honnête « table locale ».   */
/* ------------------------------------------------------------------ */

const ease = "easeOut" as const;
type LocalMode = "solo" | "hotseat";

/** Section heading inside the settings sheet — the console's voice. */
function SheetHeading({ children }: { children: string }) {
  return <h2 className="micro-label text-brass-300">{children}</h2>;
}

function Divider() {
  return <div aria-hidden className="my-6 border-t border-[rgb(var(--paper-100)/.07)]" />;
}

export default function Setup() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const urlMode: LocalMode = params.get("mode") === "hotseat" ? "hotseat" : "solo";

  const [mode, setMode] = useState<LocalMode>(urlMode);
  const [seats, setSeats] = useState<Seat[]>(() => {
    const stored = loadStoredSetup();
    return stored ? seatsFromStored(stored) : defaultSeats(urlMode);
  });
  const [options, setOptions] = useState<SetupOptions>(() => {
    return loadStoredSetup()?.options ?? DEFAULT_OPTIONS;
  });
  /* the table draws its name from the club register, like every table */
  const [tableName] = useState(() => pickTableName([]));
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

  /** Mode cards apply the seating preset of the chosen mode. */
  const selectMode = (m: LocalMode) => {
    setMode(m);
    setSeats(defaultSeats(m));
  };

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

  // Keyboard: Enter (outside inputs) starts the game.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const el = e.target as HTMLElement | null;
        const tag = el?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
        start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [start]);

  /* Active house-rule chips for the registry preview. */
  const optionChips = useMemo(() => {
    const chips: string[] = [
      options.eraLength === "short"
        ? t("setup.houseRules.eraLength.canalOnly")
        : t("setup.houseRules.eraLength.full"),
    ];
    if (options.marketTemper !== "standard") {
      chips.push(t(`setup.houseRules.marketTemper.${options.marketTemper}`));
    }
    if (options.timerMinutes !== null) {
      chips.push(t("setup.houseRules.timer.min", { n: options.timerMinutes }));
    }
    if (options.assist) chips.push(t("setup.houseRules.assist.on"));
    return chips;
  }, [options, t]);

  return (
    <div className="mx-auto max-w-[1240px] px-4 pt-10 pb-8 sm:px-8">
      {/* En-tête (create.md §Structure) */}
      <header>
        <p className="micro-label text-brass-400">{t("platform.setup.eyebrow")}</p>
        <h1 className="display-page mt-2">{t("platform.setup.title")}</h1>
        <p className="mt-2 font-ui text-[15px] text-paper-300">{t("platform.setup.tagline")}</p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        {/* -------- Section A — fiche de réglages (colonnes 1–7) -------- */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease }}
          className="order-2 lg:order-1 lg:col-span-7"
        >
          <div className="rounded-xl border border-brass-hairline bg-enamel-850 p-6">
            {/* A1. Identité de la table */}
            <section aria-label={t("platform.setup.identity.heading")}>
              <SheetHeading>{t("platform.setup.identity.heading")}</SheetHeading>
              <p className="mt-4 font-ui text-[13px] font-medium text-paper-300">{t("platform.setup.identity.nameLabel")}</p>
              <p className="h2-section mt-1 truncate">{tableName}</p>
              <p className="mt-1 font-ui text-[12px] text-iron-400">{t("platform.setup.identity.drawn")}</p>

              {/* Visibilité : cette console crée des tables locales — présentation honnête. */}
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-brass-hairline bg-enamel-800 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-enamel-700 text-brass-300">
                  <MonitorSmartphone size={18} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-ui text-[14px] font-semibold text-paper-100">
                    {t("platform.setup.identity.localTitle")}
                  </span>
                  <span className="mt-0.5 block font-ui text-[13px] text-paper-300">
                    {t("platform.setup.identity.localCopy")}
                  </span>
                </span>
              </div>
            </section>

            <Divider />

            {/* A2. Mode de jeu — solo / hotseat (contrat ?mode=) */}
            <section aria-label={t("platform.setup.mode.heading")}>
              <SheetHeading>{t("platform.setup.mode.heading")}</SheetHeading>
              <div role="radiogroup" aria-label={t("platform.setup.mode.heading")} className="mt-4 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    { id: "solo" as const, icon: Bot, title: t("platform.setup.mode.soloTitle"), copy: t("platform.setup.mode.soloCopy"), activeCls: "border-2 border-bottle-500 bg-enamel-800", iconCls: "bg-bottle-700/60 text-bottle-400" },
                    { id: "hotseat" as const, icon: Users, title: t("platform.setup.mode.hotseatTitle"), copy: t("platform.setup.mode.hotseatCopy"), activeCls: "border-2 border-brass-500 bg-enamel-800", iconCls: "bg-[var(--brass-hairline)] text-brass-300" },
                  ]
                ).map((m) => {
                  const active = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => selectMode(m.id)}
                      className={cn(
                        "flex h-[72px] items-center gap-3 rounded-xl border border-brass-hairline bg-enamel-850 p-4 text-left transition-all duration-150 ease-out hover:bg-enamel-800",
                        active ? m.activeCls : "hover:border-brass-hairline-strong",
                      )}
                    >
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", m.iconCls)}>
                        <m.icon size={18} aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-ui text-[14px] font-semibold text-paper-100">{m.title}</span>
                        <span className="mt-0.5 block font-ui text-[12px] leading-snug text-paper-300">{m.copy}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <Divider />

            {/* A3. Sièges & bots */}
            <section aria-label={t("platform.setup.seats.heading")}>
              <SheetHeading>{t("platform.setup.seats.heading")}</SheetHeading>
              <div className="mt-4 flex flex-col gap-3">
                {seats.map((seat, i) => (
                  <SeatRow
                    key={i}
                    seat={seat}
                    index={i}
                    isHead={i === 0}
                    canClose={seated.length > 2}
                    onTypeChange={(type) => handleTypeChange(i, type)}
                    onNameChange={(name) => patchSeat(i, { name })}
                    onColorChange={(c) => handleColorChange(i, c)}
                    onDifficultyChange={(difficulty) => patchSeat(i, { difficulty })}
                  />
                ))}
              </div>
              <p className="mt-4 font-ui text-[12px] leading-relaxed text-iron-400">
                {t("setup.seating.note")}
              </p>
            </section>
          </div>

          {/* A4. Options de la partie (house rules — props figées, partagé avec Lobby) */}
          <div className="mt-6">
            <HouseRules options={options} onChange={(patch) => setOptions((o) => ({ ...o, ...patch }))} />
          </div>
        </motion.div>

        {/* -------- Section B — aperçu « registre » (colonnes 8–12, sticky) -------- */}
        <motion.aside
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.26, ease, delay: 0.12 }}
          aria-label={t("platform.setup.preview.label")}
          className="order-1 self-start lg:order-2 lg:col-span-5 lg:sticky lg:top-[88px]"
        >
          <div className="relative overflow-hidden rounded-xl border border-brass-hairline bg-enamel-850 p-5">
            <div aria-hidden className="tex-ledger pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative">
              <p className="micro-label text-iron-400">{t("platform.setup.preview.label")}</p>
              <p className="h2-section mt-2 truncate">{tableName}</p>

              {/* Rangée de jetons dans leur état courant */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {seats.map((s, i) =>
                  s.type === "closed" ? (
                    <span
                      key={i}
                      aria-hidden
                      className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-iron-600/60 text-iron-600"
                    >
                      <X size={16} />
                    </span>
                  ) : (
                    <SeatToken
                      key={`${i}-${s.type}-${s.color}`}
                      size={44}
                      index={i}
                      seat={{
                        name: s.name || "…",
                        color: s.color,
                        kind: s.type === "bot" ? "bot" : "human",
                        you: i === 0,
                        host: i === 0,
                      }}
                    />
                  ),
                )}
                <span className="micro-label text-[10px] text-iron-400 tnums">
                  {t("platform.setup.preview.seats", { filled: seated.length, total: seats.length })}
                </span>
              </div>

              {/* Badges : mode, visibilité, options actives */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {[
                  mode === "solo" ? t("platform.setup.preview.badgeSolo") : t("platform.setup.preview.badgeHotseat"),
                  t("platform.setup.preview.badgeLocal"),
                  ...optionChips,
                ].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-brass-hairline bg-enamel-800 px-2 py-0.5 font-ui text-[11px] font-semibold text-paper-300"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <div aria-hidden className="my-4 border-t border-[rgb(var(--paper-100)/.07)]" />
              <p className="data-text text-[12px] text-iron-400">{t("platform.setup.preview.localLine")}</p>

              {/* CTA final */}
              <motion.div
                key={canStart ? "enabled" : "disabled"}
                initial={canStart ? { boxShadow: "0 0 0 1px rgba(201,162,75,.6), 0 0 18px rgba(201,162,75,.28)" } : false}
                animate={{ boxShadow: "0 0 0 0 rgba(201,162,75,0), 0 0 0 rgba(201,162,75,0)" }}
                transition={{ duration: 0.6, ease }}
                className="mt-5 rounded-lg"
              >
                {canStart ? (
                  <Button
                    variant="primary"
                    onClick={start}
                    disabled={starting}
                    icon={<Play size={16} aria-hidden />}
                    className="!h-12 w-full"
                  >
                    {t("platform.setup.preview.cta")}
                  </Button>
                ) : (
                  <Tip label={t("platform.setup.preview.ctaHint")} className="w-full">
                    <Button
                      variant="primary"
                      disabled
                      icon={<Play size={16} aria-hidden />}
                      className="!h-12 w-full"
                    >
                      {t("platform.setup.preview.cta")}
                    </Button>
                  </Tip>
                )}
              </motion.div>
            </div>
          </div>
        </motion.aside>
      </div>

      {/* -------- Section C — bandeau réassurance -------- */}
      <div className="mt-8 mb-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
        {[
          { icon: Users, text: t("platform.setup.reassure.players"), to: undefined },
          { icon: Save, text: t("platform.setup.reassure.memory"), to: undefined },
          { icon: BookOpen, text: t("platform.setup.reassure.rules"), to: "/rules" as const },
        ].map((item, i) => {
          const inner = (
            <>
              <item.icon size={16} className="shrink-0 text-brass-400" aria-hidden />
              <span className="font-ui text-[12px] text-iron-400">{item.text}</span>
            </>
          );
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ amount: 0.2, once: true }}
              transition={{ duration: 0.2, ease, delay: i * 0.06 }}
            >
              {item.to ? (
                <Link to={item.to} className="flex items-center gap-2 transition-colors hover:[&>span]:text-paper-300">
                  {inner}
                </Link>
              ) : (
                <span className="flex items-center gap-2">{inner}</span>
              )}
            </motion.div>
          );
        })}
      </div>

      <ShutterWipe active={starting} onDone={() => navigate("/game")} />
    </div>
  );
}
