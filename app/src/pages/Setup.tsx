import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { motion } from "framer-motion";
import { BookOpen, Bot, Globe, Play, Save, Users } from "lucide-react";
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
/* /setup — console de création de table (create.md), sur un écran :   */
/* la façon de s'asseoir en tête (solo, à plusieurs ici, au club), les */
/* sièges à gauche, les règles maison à droite, le départ au pied.     */
/* Contrats gelés : brassworks.setup.v1 persisté tel quel, ?mode=,     */
/* démarrage → /game. La visibilité publique/privée n'existe que pour  */
/* les tables en ligne : ici, présentation honnête « table locale ».   */
/* ------------------------------------------------------------------ */

const ease = "easeOut" as const;
type LocalMode = "solo" | "hotseat";

/** a clause of the waybill: a section title over the printer's double rule.
 *  The field labels beneath keep the small capitals, so a heading and a
 *  label are never the same object */
function SheetHeading({ children }: { children: string }) {
  return (
    <>
      <h2 className="h2-section">{children}</h2>
      <div aria-hidden className="gz-rule-double mt-2" />
    </>
  );
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
    if (options.assist) chips.push(t("setup.houseRules.assist.label"));
    return chips;
  }, [options, t]);

  /* the three ways to sit at a table, as one choice: alone against the
     machines, several on this device, or at the club */
  type Kind = "solo" | "hotseat" | "club";
  const kind: Kind = where === "online" ? "club" : mode;
  const sit = (k: Kind) => {
    if (k === "club") {
      setWhere("online");
      return;
    }
    setWhere("local");
    selectMode(k);
  };
  const kinds: { id: Kind; icon: typeof Bot; label: string; off: boolean }[] = [
    { id: "solo", icon: Bot, label: t("platform.setup.kinds.solo"), off: false },
    { id: "hotseat", icon: Users, label: t("platform.setup.kinds.hotseat"), off: false },
    { id: "club", icon: Globe, label: t("platform.setup.kinds.club"), off: !isOnline },
  ];
  const clauses = [...(where === "online" ? [t("platform.setup.where.badge")] : []), ...optionChips];

  return (
    <div className="gz-measure pt-6 pb-6">
      {/* the head of the sheet: the title, and the way to sit beside it */}
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow-fell">{t("platform.setup.eyebrow")}</p>
          <h1 className="display-page mt-1">{t("platform.setup.title")}</h1>
        </div>
        <div role="radiogroup" aria-label={t("platform.setup.where.heading")} className="flex items-center gap-6 border-b border-[var(--gz-line-control)]">
          {kinds.map((k) => {
            const active = kind === k.id;
            return (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={k.off}
                title={k.off ? t("platform.setup.where.onlineOff") : undefined}
                onClick={() => sit(k.id)}
                className={cn(
                  "gz-nav-link relative !py-2 !text-[11.5px] flex items-center gap-2",
                  active && "is-active before:absolute before:inset-x-0 before:-bottom-px before:h-[2px] before:bg-[rgb(var(--paper-100))] before:content-['']",
                  k.off && "cursor-not-allowed !text-iron-400 opacity-60",
                )}
              >
                <k.icon size={13} strokeWidth={1.6} aria-hidden className={active ? "text-brass-300" : "text-iron-400"} />
                {k.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="mt-6 grid gap-x-10 gap-y-6 lg:grid-cols-12">
        {/* -------- the seats, or the club's word -------- */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease }}
          aria-label={t("platform.setup.seats.heading")}
          className="min-w-0 lg:col-span-7"
        >
          <SheetHeading>{t("platform.setup.seats.heading")}</SheetHeading>
          {where === "local" ? (
            <>
              <div className="mt-1 grid grid-cols-[28px_32px_minmax(0,1fr)_max-content] gap-x-3">
                {seats.map((seat, i) => (
                  <SeatRow
                    key={i}
                    compact
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
              <p className="mt-3 font-serif text-[12px] italic leading-relaxed text-iron-400">{t("setup.seating.note")}</p>
            </>
          ) : (
            <div className="mt-4">
              <TrainStrip seats={[{ name: session?.name ?? seats[0].name ?? "…", color: seats[0].color, kind: "human" as const }, null, null, null]} />
              <p className="mt-4 font-serif text-[13px] italic leading-relaxed text-paper-300">{t("platform.setup.where.onlineCopy")}</p>
              <p className="mt-2 font-serif text-[12.5px] italic text-iron-400">{t("platform.setup.where.line")}</p>
              {stranger && <p className="mt-2 font-serif text-[12.5px] italic text-rust-400">{t("platform.setup.where.signIn")}</p>}
            </div>
          )}
        </motion.section>

        {/* -------- the house rules -------- */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease, delay: 0.06 }}
          className="min-w-0 lg:col-span-5"
        >
          <HouseRules compact options={options} onChange={(patch) => setOptions((o) => ({ ...o, ...patch }))} />
        </motion.div>
      </div>

      {/* -------- the foot of the sheet: the table as it stands, and the start -------- */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-[var(--gz-ink-soft)] pt-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
          {where === "local" && (
            <TrainStrip seats={seats.map((s) => (s.type === "closed" ? null : { name: s.name || "…", color: s.color, kind: s.type === "bot" ? "bot" : "human" }))} />
          )}
          <div className="min-w-0">
            <p className="truncate font-fraunces text-[18px] font-medium leading-tight text-paper-100">{tableTitle(tableName, lang)}</p>
            <p className="mt-0.5 font-serif text-[12.5px] italic text-iron-400">
              {[where === "online" ? null : t("platform.setup.preview.seats", { filled: seated.length, total: seats.length }), ...clauses].filter(Boolean).join(" · ")}
            </p>
            {fault && <p className="mt-1 font-serif text-[12.5px] italic text-rust-400">{fault}</p>}
          </div>
        </div>
        <motion.div
          key={canStart ? "enabled" : "disabled"}
          initial={canStart ? { boxShadow: "0 0 0 1px rgba(201,162,75,.6), 0 0 18px rgba(201,162,75,.28)" } : false}
          animate={{ boxShadow: "0 0 0 0 rgba(201,162,75,0), 0 0 0 rgba(201,162,75,0)" }}
          transition={{ duration: 0.6, ease }}
          className="shrink-0"
        >
          {where === "online" ? (
            <button type="button" onClick={() => void openAtClub()} disabled={opening} className="gz-ticket gz-ticket-brass !h-11 min-w-[240px] justify-center">
              <Globe aria-hidden />
              {t("platform.setup.where.cta")}
            </button>
          ) : canStart ? (
            <button type="button" onClick={start} onMouseEnter={preloadGame} onFocus={preloadGame} disabled={starting !== null} className="gz-ticket gz-ticket-brass !h-11 min-w-[240px] justify-center">
              <Play aria-hidden />
              {t("platform.setup.preview.cta")}
            </button>
          ) : (
            <Tip label={t("platform.setup.preview.ctaHint")}>
              <button type="button" disabled className="gz-ticket !h-11 min-w-[240px] cursor-not-allowed justify-center opacity-50">
                <Play aria-hidden />
                {t("platform.setup.preview.cta")}
              </button>
            </Tip>
          )}
        </motion.div>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 font-ui text-[12px] text-iron-400">
        <span className="flex items-center gap-1.5"><Users size={13} aria-hidden className="text-brass-400" />{t("platform.setup.reassure.players")}</span>
        <span className="flex items-center gap-1.5"><Save size={13} aria-hidden className="text-brass-400" />{t("platform.setup.reassure.memory")}</span>
        <Link to="/rules" className="flex items-center gap-1.5 text-paper-100 underline decoration-[var(--gz-ink-soft)] underline-offset-[3px] hover:decoration-[rgb(var(--paper-100))]"><BookOpen size={13} aria-hidden className="text-brass-400" />{t("platform.setup.reassure.rules")}</Link>
      </p>

      <ShutterWipe active={starting !== null} onDone={() => navigate(`/game/local/${starting}`)} />
    </div>
  );
}
