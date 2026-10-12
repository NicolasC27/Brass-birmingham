import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Beer, BookOpen, LineChart, RotateCcw, Share2, Check } from "lucide-react";
import { useGame } from "@/game/store";
import { useTable } from "@/online/lobby";
import { recordAgainst } from "@/online/rivals";
import { useDesk, useSession } from "@/online/session";
import { mugClink } from "@/gl/sfx";
import { getBoardOptions } from "@/components/game/boardOptions";
import { titlesFor } from "@/components/results/titles";
import Podium, { type PodiumEntry } from "@/components/results/Podium";
import ScoringTable from "@/components/results/ScoringTable";
import TimelineFrieze from "@/components/results/TimelineFrieze";
import Ticket from "@/components/results/Ticket";
import { homeGame } from "@/game/home";
import ScoreCurves from "@/components/results/ScoreCurves";
import EmptyNotice from "@/components/results/EmptyNotice";
import { seatInk } from "@/components/results/ink";
import {
  rankPlayers,
  readFinalResult,
  type FinalResult,
} from "@/components/results/types";
import { loadStoredSetup } from "@/components/setup/constants";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

/** Ceremony phases: 0 title → 1 podium rises → 2 counters roll → 3 settled. */
const PHASE_TIMES = [500, 1500, 3000];

function buildEntries(result: FinalResult): PodiumEntry[] {
  const stored = loadStoredSetup();
  return rankPlayers(result).map(({ player }, i) => ({
    name: player.name,
    color: player.color,
    vp: player.vp,
    income: player.income,
    isWinner: i === 0,
    isHuman:
      stored?.players.find((p) => p.name === player.name)?.type === "human",
    rank: i + 1,
  }));
}

/** Small ember trail when Revanche is struck (6 particles, 400ms). */
function EmberBurst() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      <style>{`
        @keyframes burst-fly {
          0% { transform: translate(0, 0) scale(1); opacity: 0.9; }
          100% { transform: translate(var(--bx), var(--by)) scale(0.2); opacity: 0; }
        }
        .burst-ember { animation: burst-fly 0.4s ease-out forwards; }
        @media (prefers-reduced-motion: reduce) { .burst-ember { animation: none; opacity: 0; } }
      `}</style>
      {Array.from({ length: 6 }).map((_, i) => (
        <span
          key={i}
          className="burst-ember absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
          style={{
            background: "radial-gradient(circle at 40% 35%, #DDBE7E, #C9A45C 60%, transparent)",
            ["--bx" as string]: `${Math.cos((i / 6) * Math.PI * 2) * 46}px`,
            ["--by" as string]: `${Math.sin((i / 6) * Math.PI * 2) * 26 - 18}px`,
          }}
        />
      ))}
    </span>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <EmptyNotice
      eyebrow={t("results.empty.eyebrow")}
      title={t("results.empty.title")}
      actions={[
        { to: "/setup", label: t("results.empty.setTable") },
        { to: "/", label: t("results.empty.backTitle") },
      ]}
    >
      {t("results.empty.body")}
    </EmptyNotice>
  );
}

export default function Results() {
  const navigate = useNavigate();
  const t = useT();
  const reduced = useReducedMotion();
  const [result] = useState<FinalResult | null>(() => readFinalResult());
  /* reduced motion skips the ceremony outright */
  const [phase, setPhase] = useState(() => (reduced ? 3 : 0));
  const [bursting, setBursting] = useState(false);
  const [copied, setCopied] = useState(false);
  /* the toast: the table's glasses, raised from the game still on the shelf */
  const liveGame = useGame((s) => s.game);
  const toasts = useGame((s) => s.toasts);
  const sendToast = useGame((s) => s.sendToast);
  const seat = useGame((s) => s.seat);
  const mySeat = liveGame ? (seat ?? liveGame.players.findIndex((p) => !p.isBot)) : -1;
  const canToast = !!liveGame && liveGame.phase === "game-over" && mySeat >= 0 && !toasts.includes(mySeat);
  const clinked = toasts.length >= 2;
  useEffect(() => {
    if (clinked && getBoardOptions().sound) mugClink();
  }, [clinked]);
  /* titles from the tally, and the record against each opponent met before */
  const desk = useDesk();
  const me = useSession();
  const code = useGame((s) => s.code);
  const local = useGame((s) => s.local);
  const table = useTable(code);
  /* the ticket names the table: the office's, or the register's at home */
  const tableName = table?.name ?? (local ? (homeGame(local)?.name ?? local) : "");

  const entries = useMemo(() => (result ? buildEntries(result) : []), [result]);
  const settled = phase >= 3;

  // Ceremony sequencing — skippable with any click.
  useEffect(() => {
    if (!result || settled) return;
    const timers = PHASE_TIMES.map((t, i) =>
      window.setTimeout(() => setPhase(i + 1), t),
    );
    const skip = () => setPhase(3);
    window.addEventListener("pointerdown", skip);
    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener("pointerdown", skip);
    };
  }, [result, settled, reduced]);

  if (!result) return <EmptyState />;

  const tiebreak = (() => {
    const [a, b] = rankPlayers(result);
    if (a && b && a.player.vp === b.player.vp && a.player.income !== b.player.income) {
      const hi = Math.max(a.player.income, b.player.income);
      const lo = Math.min(a.player.income, b.player.income);
      return t("results.tiebreak", { hi, lo });
    }
    return null;
  })();

  const handleRevanche = () => {
    // The setup lobby prefills from brassworks.setup.v1, so the same table
    // is kept; the engine rotates the first player on the next deal.
    if (reduced) {
      navigate("/setup");
      return;
    }
    setBursting(true);
    window.setTimeout(() => navigate("/setup"), 420);
  };

  const handleShare = async () => {
    const summary = rankPlayers(result)
      .map(({ player }) => `${player.name} ${player.vp}`)
      .join(" — ");
    try {
      await navigator.clipboard.writeText(t("results.share.text", { summary }));
    } catch {
      /* clipboard unavailable — the confirmation still acknowledges the try */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  /* a section of the account: its heading over the printer's double rule */
  const heading = (title: string) => (
    <>
      <h2 className="h2-section">{title}</h2>
      <div aria-hidden className="gz-rule-double mt-2" />
    </>
  );

  return (
    <div className="gz-measure pb-16 pt-8">
      <div>
        <Link
          to="/"
          className="micro-label inline-flex items-center gap-1.5 text-iron-400 transition-colors hover:text-paper-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("results.page.back")}
        </Link>

        {/* 1 — Title reveal, word by word */}
        <header className="mt-6">
          <p className="eyebrow-fell">{tableName || t("results.ticket.route")}</p>
          <h1 className="display-hero mt-2">
            {t("results.page.title")
              .split(" ")
              .map((w, i, a) => (
                <motion.span
                  key={i}
                  className="inline-block whitespace-pre"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.14, duration: 0.4, ease: "easeOut" }}
                >
                  {w}
                  {i < a.length - 1 ? " " : ""}
                </motion.span>
              ))}
          </h1>
          <motion.div
            aria-hidden
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.35, duration: 0.5, ease: "easeInOut" }}
            style={{ transformOrigin: "left" }}
            className="gz-rule-double mt-5"
          />
          {!settled && (
            <p className="micro-label mt-3 text-iron-400">
              {t("results.page.skip")}
            </p>
          )}
        </header>

        {/* 2 — Podium */}
        <motion.section
          aria-label={t("results.page.podiumAria")}
          initial={false}
          animate={{ opacity: phase >= 1 ? 1 : 0.25 }}
          transition={{ duration: 0.3 }}
          className="mt-12"
        >
          <Podium entries={entries} start={phase >= 1} countStart={phase >= 2} />
          {tiebreak && settled && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 text-center font-mono text-[13px] text-paper-300 tabular-nums"
            >
              {tiebreak}
            </motion.p>
          )}
        </motion.section>

        {/* 3 — Detailed scoring table */}
        <motion.section
          aria-label={t("results.page.scoringAria")}
          initial={false}
          animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 ? 0 : 16 }}
          transition={{ duration: 0.35 }}
          className={cn("mt-14", phase < 2 && "pointer-events-none")}
        >
          {heading(t("results.page.scoringTitle"))}
          <div className="mt-6">
            <ScoringTable result={result} reveal={phase >= 2} />
          </div>
        </motion.section>

        {/* 4 — Round-by-round curves */}
        {result.history.length > 1 && (
          <motion.section
            aria-label={t("results.page.curvesAria")}
            initial={false}
            animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 ? 0 : 16 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className={cn("mt-14", phase < 2 && "pointer-events-none")}
          >
            {heading(t("results.page.curvesTitle"))}
            <div className="mt-6">
              <ScoreCurves result={result} reveal={phase >= 2} />
            </div>
          </motion.section>
        )}

        {/* 5 — Timeline frieze */}
        <motion.div
          initial={false}
          animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 ? 0 : 16 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className={cn("mt-14", phase < 2 && "pointer-events-none")}
        >
          <TimelineFrieze result={result} reveal={phase >= 2} />
        </motion.div>

        {/* the ticket of the journey, once everything is settled — for the
            seat the store knows, else the human seat the ledger names */}
        {(() => {
          const byName = me ? result.players.findIndex((p) => p.name === me.name) : -1;
          const ticketSeat = mySeat >= 0 ? mySeat : byName >= 0 ? byName : result.players.findIndex((p) => !p.bot);
          return ticketSeat >= 0 && (
          <motion.section initial={false} animate={{ opacity: settled ? 1 : 0, y: settled ? 0 : 16 }} transition={{ duration: 0.35 }} className={cn("mt-14", !settled && "pointer-events-none")} aria-label={t("results.ticket.heading")}>
            {heading(t("results.ticket.heading"))}
            <div className="mt-6">
              <Ticket result={result} me={ticketSeat} table={tableName} />
            </div>
          </motion.section>
          );
        })()}

        {/* 5 — Final actions */}
        {/* titles of the game, the glasses raised, and the record against
            those met before (the desk remembers the past games) */}
        {result && (() => {
          const ranked = rankPlayers(result);
          const titles = titlesFor(result.players.map((p) => p.stats), ranked.map((r) => r.index));
          const rows = ranked.map(({ player, index }) => {
            const title = titles[index];
            const raised = toasts.includes(index);
            let record: string | null = null;
            if (me && index !== mySeat && !player.bot) {
              const r = recordAgainst(desk, table, index);
              if (r && r.won + r.lost > 0) record = t("results.titles.headToHead", { won: r.won, lost: r.lost, name: player.name });
            }
            return { player, index, title, raised, record };
          });
          if (!rows.some((r) => r.title || r.raised || r.record)) return null;
          return (
            <motion.div initial={false} animate={{ opacity: settled ? 1 : 0 }} transition={{ duration: 0.3 }} className="gz-classified mx-auto mt-14 w-full max-w-[560px] !items-stretch !px-6 !py-5">
              <p className="eyebrow-fell mb-2 text-center">{t("results.titles.heading")}</p>
              <ul className="flex flex-col gap-1">
                {rows.map((r) => (
                  <li key={r.index} className="flex items-center gap-3 border-b border-[var(--gz-ink-faint)] py-1.5 font-ui text-[13px] text-paper-300 last:border-b-0">
                    <span className="title-card" style={{ color: seatInk(r.player.color) }}>{r.player.name}</span>
                    {r.title && <span className="micro-label border border-[var(--gz-ink-soft)] px-1.5 py-px text-paper-100">{t(`results.titles.${r.title}`)}</span>}
                    {r.record && <span className="data-text text-iron-400">{r.record}</span>}
                    {r.raised && (
                      <span className="ml-auto flex items-center gap-1 text-brass-300" title={t("results.toast.raised", { name: r.player.name })} aria-label={t("results.toast.raised", { name: r.player.name })}>
                        <Beer className={cn("h-4 w-4", clinked && "animate-bounce")} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {clinked && <p className="mt-2 text-center font-serif text-[13px] italic text-brass-300">{t("results.toast.clink")}</p>}
            </motion.div>
          );
        })()}
        <motion.div
          initial={false}
          animate={{ opacity: settled ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "mt-14 flex flex-wrap items-center gap-3 border-t border-[var(--gz-ink-soft)] pt-6",
            !settled && "pointer-events-none",
          )}
        >
          {canToast && (
            <button type="button" onClick={() => sendToast()} className="gz-ticket" aria-label={t("results.toast.aria")}>
              <Beer className="h-4 w-4" />
              {t("results.toast.button")}
            </button>
          )}
          <button
            type="button"
            onClick={handleRevanche}
            className="gz-ticket gz-ticket-brass relative"
          >
            <RotateCcw className="h-4 w-4" />
            {t("results.actions.revanche")}
            {bursting && <EmberBurst />}
          </button>
          <Link to="/replay" className="gz-ticket" aria-label={t("results.page.replayAria")}>
            {t("results.page.replay")}
          </Link>
          <Link to="/review" className="gz-ticket">
            <LineChart className="h-4 w-4" />
            {t("results.review.title")}
          </Link>
          <Link to="/" className="gz-ticket">
            {t("results.actions.backToMenu")}
          </Link>
          <Link to="/rules" className="gz-ticket">
            <BookOpen className="h-4 w-4" />
            {t("results.actions.consultManual")}
          </Link>
          <button type="button" onClick={handleShare} className="gz-ticket min-w-[210px] justify-center">
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            {copied ? t("results.share.copied") : t("results.share.share")}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
