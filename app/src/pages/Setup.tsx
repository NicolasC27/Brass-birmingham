import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { motion } from "framer-motion";
import { BookOpen, Bot, Globe, MonitorSmartphone, Play, Save, Users } from "lucide-react";
import { openHomeGame } from "@/game/home";
import type { SetupPayload } from "@/game/types";
import { isOnline, lobby } from "@/online/lobby";
import { useSession, useStranger } from "@/online/session";
import { pickTableName, tableTitle } from "@/online/tableNames";
import { useLang, useT } from "@/i18n";
import SeatRow from "@/components/setup/SeatRow";
import HouseRules from "@/components/setup/HouseRules";
import ShutterWipe from "@/components/setup/ShutterWipe";
import Tip from "@/components/setup/Tip";
import TrainStrip from "@/components/online/TrainStrip";
import { preloadGame } from "@/platform/preload";
import {
  SETUP_STORAGE_KEY,
  dedupeNames,
  defaultSeats,
  loadStoredSetup,
  openSeat,
  recastSeat,
  seatsFromStored,
  type PlayerColor,
  type Seat,
  type SetupOptions,
  DEFAULT_OPTIONS,
  type SeatType,
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
/** a clause of the waybill: small capitals over a double rule */
function SheetHeading({ children }: { children: string }) {
  return (
    <>
      <h2 className="micro-label text-paper-100">{children}</h2>
      <div aria-hidden className="gz-rule-double mt-2" />
    </>
  );
}

function Divider() {
  return <div aria-hidden className="my-8" />;
}

export default function Setup() {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const urlMode: LocalMode = params.get("mode") === "hotseat" ? "hotseat" : "solo";

  const [mode, setMode] = useState<LocalMode>(urlMode);
  /* where the table stands: on this device, or at the club (an online table
     whose seats are taken in its lobby) — the club only when there is one */
  const session = useSession();
  const stranger = useStranger();
  const [where, setWhere] = useState<"local" | "online">(isOnline && params.get("where") === "online" ? "online" : "local");
  const [opening, setOpening] = useState(false);
  const [fault, setFault] = useState<string | null>(null);
  const [seats, setSeats] = useState<Seat[]>(() => {
    const stored = loadStoredSetup();
    return stored ? seatsFromStored(stored) : defaultSeats(urlMode);
  });
  const [options, setOptions] = useState<SetupOptions>(() => {
    return loadStoredSetup()?.options ?? DEFAULT_OPTIONS;
  });
  /* the table draws its name from the club register, like every table */
  const [tableName] = useState(() => pickTableName([]));
  /** the code of the table just opened on the register, while the wipe plays */
  const [starting, setStarting] = useState<string | null>(null);

  const seated = useMemo(() => seats.filter((s) => s.type !== "closed"), [seats]);
  const canStart = seated.length >= 2;

  const patchSeat = (index: number, patch: Partial<Seat>) =>
    setSeats((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const handleTypeChange = (index: number, type: SeatType) =>
    setSeats((prev) => {
      if (type === "closed") {
        return prev.map((s, i) => (i === index ? { ...s, type: "closed" } : s));
      }
      return prev.map((s, i) => (i === index ? openSeat(s, type, prev) : s));
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

  /* the club's table: opened with the house rules and the head's colour,
     then straight to its lobby, where the seats are taken and friends asked up */
  const openAtClub = useCallback(async () => {
    if (opening || starting) return;
    if (!session) {
      navigate("/account");
      return;
    }
    setOpening(true);
    setFault(null);
    try {
      const table = await lobby.create({ ...options }, seats[0].color);
      navigate(`/online/${table.code}`);
    } catch {
      setFault(t("platform.setup.where.failed"));
      setOpening(false);
    }
  }, [opening, starting, session, navigate, options, seats, t]);
  const start = useCallback(() => {
    if (where === "online") {
      void openAtClub();
      return;
    }
    if (!canStart || starting) return;
    const players = seats.filter((s) => s.type !== "closed");
    const names = dedupeNames(players.map((s) => s.name));
    const payload: StoredSetup = {
      players: players.map((s, i) => ({
        name: names[i],
        color: s.color,
        type: s.type === "human" ? ("human" as const) : ("bot" as const),
        ...(s.type === "bot" ? { persona: s.persona } : {}),
      })),
      /* the whole of the house rules, the board among them: picking them
         out one by one is how the board was left behind before */
      options: { ...options },
      name: tableName,
    };
    try {
      localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* storage unavailable — the game page will fall back to defaults */
    }
    /* a new table every time: the one before stays on the register, to come
       back to. The office deals the code */
    void openHomeGame(undefined, payload as unknown as SetupPayload).then((table) => setStarting(table.code));
  }, [where, openAtClub, canStart, starting, seats, options, tableName]);

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
          ...(s.type === "bot" ? { persona: s.persona } : {}),
        })),
        options: { ...options },
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
        <p className="eyebrow-fell">{t("platform.setup.eyebrow")}</p>
        <h1 className="display-page mt-2">{t("platform.setup.title")}</h1>
        <p className="mt-2 font-serif text-[15px] italic text-paper-300">{t("platform.setup.tagline")}</p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        {/* -------- Section A — fiche de réglages (colonnes 1–7) -------- */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease }}
          className="order-2 lg:order-1 lg:col-span-7"
        >
          <div>
            {/* A1. Identité de la table */}
            <section aria-label={t("platform.setup.identity.heading")}>
              <SheetHeading>{t("platform.setup.identity.heading")}</SheetHeading>
              <p className="micro-label mt-4 text-iron-400">{t("platform.setup.identity.nameLabel")}</p>
              <p className="mt-1 truncate font-fraunces text-[26px] font-medium leading-tight text-paper-100" style={{ fontVariationSettings: '"opsz" 96' }}>
                {tableTitle(tableName, lang)}
              </p>
              <p className="mt-1 font-serif text-[13px] italic text-iron-400">{t("platform.setup.identity.drawn")}</p>

            </section>

            <Divider />

            {/* A1b. Where the table stands: this device, or the club */}
            <section aria-label={t("platform.setup.where.heading")}>
              <SheetHeading>{t("platform.setup.where.heading")}</SheetHeading>
              <div role="radiogroup" aria-label={t("platform.setup.where.heading")} className="mt-2 grid sm:grid-cols-2 sm:gap-8">
                {(
                  [
                    { id: "local" as const, icon: MonitorSmartphone, title: t("platform.setup.where.localTitle"), copy: t("platform.setup.where.localCopy"), off: false },
                    { id: "online" as const, icon: Globe, title: t("platform.setup.where.onlineTitle"), copy: isOnline ? t("platform.setup.where.onlineCopy") : t("platform.setup.where.onlineOff"), off: !isOnline },
                  ]
                ).map((w) => {
                  const active = where === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={w.off}
                      onClick={() => setWhere(w.id)}
                      className={cn(
                        "group flex items-start gap-3 border-b border-[var(--gz-ink-faint)] py-3 text-left transition-colors duration-150 hover:bg-enamel-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
                        active ? "text-paper-100" : "text-paper-300",
                      )}
                    >
                      <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rotate-45 border", active ? "border-brass-300 bg-brass-300" : "border-[var(--gz-ink-soft)]")} aria-hidden />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-fraunces text-[16px] font-medium text-paper-100" style={{ fontVariationSettings: '"opsz" 48' }}>
                          <w.icon size={15} strokeWidth={1.5} aria-hidden className="text-brass-300" />
                          {w.title}
                        </span>
                        <span className="mt-0.5 block font-serif text-[13px] italic leading-snug text-paper-300">{w.copy}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {where === "local" && <Divider />}

            {/* A2. Mode de jeu — solo / hotseat (contrat ?mode=); at the club the seats are taken in the lobby */}
            {where === "local" && (
            <section aria-label={t("platform.setup.mode.heading")}>
              <SheetHeading>{t("platform.setup.mode.heading")}</SheetHeading>
              <div role="radiogroup" aria-label={t("platform.setup.mode.heading")} className="mt-2 grid sm:grid-cols-2 sm:gap-8">
                {(
                  [
                    { id: "solo" as const, icon: Bot, title: t("platform.setup.mode.soloTitle"), copy: t("platform.setup.mode.soloCopy") },
                    { id: "hotseat" as const, icon: Users, title: t("platform.setup.mode.hotseatTitle"), copy: t("platform.setup.mode.hotseatCopy") },
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
                        "group flex items-start gap-3 border-b border-[var(--gz-ink-faint)] py-3 text-left transition-colors duration-150 hover:bg-enamel-800",
                        active ? "text-paper-100" : "text-paper-300",
                      )}
                    >
                      <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rotate-45 border", active ? "border-brass-300 bg-brass-300" : "border-[var(--gz-ink-soft)]")} aria-hidden />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-fraunces text-[16px] font-medium text-paper-100" style={{ fontVariationSettings: '"opsz" 48' }}>
                          <m.icon size={15} strokeWidth={1.5} aria-hidden className="text-brass-300" />
                          {m.title}
                        </span>
                        <span className="mt-0.5 block font-serif text-[13px] italic leading-snug text-paper-300">{m.copy}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
            )}

            {where === "local" && <Divider />}

            {/* A3. Sièges & bots */}
            {where === "local" && (
            <section aria-label={t("platform.setup.seats.heading")}>
              <SheetHeading>{t("platform.setup.seats.heading")}</SheetHeading>
              <div className="mt-2 flex flex-col">
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
                    onPersonaChange={(persona) => setSeats((cur) => cur.map((s, k) => (k === i ? recastSeat(s, persona) : s)))}
                  />
                ))}
              </div>
              <p className="mt-4 font-serif text-[12.5px] italic leading-relaxed text-iron-400">{t("setup.seating.note")}</p>
            </section>
            )}
          </div>

          {/* A4. Options de la partie (house rules — props figées, partagé avec Lobby) */}
          <div className="mt-10">
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
          <div className="gz-classified !items-stretch !p-6 !text-left">
            <div className="relative">
              {/* the train on the platform at dawn, painted in the tiles' own hand */}
              <img src="/setup-station.webp" alt="" draggable={false} className="mb-5 -mt-1 w-full rounded-md object-cover shadow-[0_6px_18px_rgba(0,0,0,.35)]" style={{ aspectRatio: "21 / 9" }} />
              <p className="eyebrow-fell">{t("platform.setup.preview.label")}</p>
              <p className="mt-2 truncate font-fraunces text-[22px] font-medium leading-tight text-paper-100" style={{ fontVariationSettings: '"opsz" 96' }}>
                {tableTitle(tableName, lang)}
              </p>

              {/* the train as it stands: a carriage a seat */}
              <div className="mt-4">
                <TrainStrip
                  seats={
                    where === "online"
                      ? [{ name: session?.name ?? seats[0].name ?? "…", color: seats[0].color, kind: "human" as const }, null, null, null]
                      : seats.map((s) => (s.type === "closed" ? null : { name: s.name || "…", color: s.color, kind: s.type === "bot" ? "bot" : "human" }))
                  }
                />
              </div>
              <p className="micro-label mt-2 text-iron-400 tnums">{t("platform.setup.preview.seats", { filled: where === "online" ? 1 : seated.length, total: seats.length })}</p>

              {/* the clauses: mode, the table's nature, the options in force */}
              <ol className="mt-4 flex flex-col">
                {[
                  ...(where === "online" ? [t("platform.setup.where.badge")] : [mode === "solo" ? t("platform.setup.preview.badgeSolo") : t("platform.setup.preview.badgeHotseat"), t("platform.setup.preview.badgeLocal")]),
                  ...optionChips,
                ].map((chip, i) => (
                  <li key={chip} className="flex items-baseline gap-3 border-b border-[var(--gz-ink-faint)] py-1.5 last:border-b-0">
                    <span className="data-text w-5 text-[11px] text-iron-600 tnums">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-serif text-[13.5px] text-paper-100">{chip}</span>
                  </li>
                ))}
              </ol>

              <p className="mt-4 font-serif text-[12.5px] italic text-iron-400">{t(where === "online" ? "platform.setup.where.line" : "platform.setup.preview.localLine")}</p>
              {where === "online" && stranger && <p className="mt-2 font-serif text-[12.5px] italic text-rust-400">{t("platform.setup.where.signIn")}</p>}
              {fault && <p className="mt-2 font-serif text-[12.5px] italic text-rust-400">{fault}</p>}

              {/* CTA final */}
              <motion.div
                key={canStart ? "enabled" : "disabled"}
                initial={canStart ? { boxShadow: "0 0 0 1px rgba(201,162,75,.6), 0 0 18px rgba(201,162,75,.28)" } : false}
                animate={{ boxShadow: "0 0 0 0 rgba(201,162,75,0), 0 0 0 rgba(201,162,75,0)" }}
                transition={{ duration: 0.6, ease }}
                className="mt-5 rounded-lg"
              >
                {where === "online" ? (
                  <button type="button" onClick={() => void openAtClub()} disabled={opening} className="gz-ticket gz-ticket-brass w-full justify-center !h-11">
                    <Globe aria-hidden />
                    {t("platform.setup.where.cta")}
                  </button>
                ) : canStart ? (
                  <button type="button" onClick={start} onMouseEnter={preloadGame} onFocus={preloadGame} disabled={starting !== null} className="gz-ticket gz-ticket-brass w-full justify-center !h-11">
                    <Play aria-hidden />
                    {t("platform.setup.preview.cta")}
                  </button>
                ) : (
                  <Tip label={t("platform.setup.preview.ctaHint")} className="w-full">
                    <button type="button" disabled className="gz-ticket w-full cursor-not-allowed justify-center !h-11 opacity-50">
                      <Play aria-hidden />
                      {t("platform.setup.preview.cta")}
                    </button>
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

      <ShutterWipe active={starting !== null} onDone={() => navigate(`/game/local/${starting}`)} />
    </div>
  );
}
