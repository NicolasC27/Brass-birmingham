import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Beer, BookOpen, LineChart, RotateCcw, Share2, Check } from "lucide-react";
import { buildFinalPayload, useGame } from "@/game/store";
import { keepFinal } from "@/game/final";
import { readHomeSave, type HomeMiss } from "@/game/home";
import { SETUP_KEY, type GameState, type LedgerEntry } from "@/game/types";
import { ledgerText } from "@/game/ledgerText";
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
  tieBreakOf,
  type FinalResult,
} from "@/components/results/types";
import { tr, useT } from "@/i18n";
import { cn } from "@/lib/utils";

/** Ceremony phases: 0 title → 1 podium rises → 2 counters roll → 3 settled. */
const PHASE_TIMES = [500, 1500, 3000];

function buildEntries(result: FinalResult, me: number): PodiumEntry[] {
  return rankPlayers(result).map(({ player, index }, i) => ({
    name: player.name,
    color: player.color,
    vp: player.vp,
    income: player.income,
    isWinner: !result.abandoned && index === result.winnerIndex,
    /* "your empire" is said to the reader's own seat, never to any human */
    isHuman: index === me,
    rank: i + 1,
  }));
}

/** the ledger of a game read straight from the game: what the board leaves
 *  at the close, plus what it does not carry — the purses for the last
 *  tie-break, whether the table rose, and where it stopped */
function ledgerOf(g: GameState): FinalResult | null {
  const payload = buildFinalPayload(g);
  const frieze = friezeOf(g);
  return readFinalResult({
    ...payload,
    timeline: frieze.length >= 4 ? frieze : payload.timeline,
    players: payload.players.map((p, i) => ({ ...p, money: g.players[i]?.money })),
    abandoned: !!g.abandoned,
    closedAt: { era: g.era, round: g.round },
  });
}

/** the frieze of the whole game, not only its last lines: the eras opening
 *  and closing, the crowning, and in each round the work that turned for
 *  the most income — the moments a player remembers */
const MILESTONES = new Set(["setup", "eraScore", "sweep", "master"]);
function friezeOf(g: GameState): string[] {
  const best = new Map<string, LedgerEntry>();
  for (const e of g.ledger) {
    if (e.key !== "flip") continue;
    const at = `${e.era}${e.round}`;
    const held = best.get(at);
    if (!held || Number(e.vars?.income ?? 0) > Number(held.vars?.income ?? 0)) best.set(at, e);
  }
  const turned = new Set(best.values());
  return g.ledger
    /* a table that rose crowns nobody, in the frieze as on the podium */
    .filter((e) => (MILESTONES.has(e.key ?? "") && !(g.abandoned && e.key === "master")) || turned.has(e))
    .map((e) => `[${e.era === "canal" ? "Canal" : "Rail"} R${e.round}] ${ledgerText(e, tr)}`);
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

/** Nothing to print: no game closed on this visit, the office still being
 *  asked for one, or a game named that the office could not give back. */
function EmptyState({ code, waiting, miss }: { code: string | null; waiting: boolean; miss: HomeMiss | "open" | null }) {
  const t = useT();
  if (code && waiting)
    return (
      <EmptyNotice eyebrow={t("results.empty.eyebrow")} title={t("results.empty.loadingTitle")} actions={[{ to: "/desk", label: t("results.empty.toDesk") }]}>
        {t("results.empty.loading", { code })}
      </EmptyNotice>
    );
  /* a code the office does not know: no way back to a table — opening one
     under that code would deal a fresh game */
  if (code && miss === "absent")
    return (
      <EmptyNotice eyebrow={t("results.empty.eyebrow")} title={t("results.empty.lostTitle")} actions={[{ to: "/desk", label: t("results.empty.toDesk") }]}>
        {t("results.empty.absentBody", { code })}
      </EmptyNotice>
    );
  if (code && miss)
    return (
      <EmptyNotice
        eyebrow={t("results.empty.eyebrow")}
        title={t(miss === "open" ? "results.empty.openTitle" : "results.empty.lostTitle")}
        actions={[
          { to: `/game/local/${code}`, label: t("results.empty.toTable", { code }) },
          { to: "/desk", label: t("results.empty.toDesk") },
        ]}
      >
        {t(miss === "open" ? "results.empty.openBody" : "results.empty.lostBody", { code })}
      </EmptyNotice>
    );
  return (
    <EmptyNotice
      eyebrow={t("results.empty.eyebrow")}
      title={t("results.empty.title")}
      actions={[
        { to: "/desk", label: t("results.empty.toDesk") },
        { to: "/setup", label: t("results.empty.setTable") },
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
  const [params, setParams] = useSearchParams();
  /* the game this account is of: named in the address (a reload, a link),
     else the one on the table if it is over, else the ledger the board
     left when the last era closed on this visit */
  const asked = params.get("table");
  const liveGame = useGame((s) => s.game);
  const local = useGame((s) => s.local);
  const onlineCode = useGame((s) => s.code);
  const closed = liveGame?.phase === "game-over" && (!asked || asked === local) ? liveGame : null;
  const [fetched, setFetched] = useState<{ code: string; game: GameState | null; miss: HomeMiss | "open" | null } | null>(null);
  const read = fetched && fetched.code === asked ? fetched : null;
  const source = closed ?? read?.game ?? null;
  const [held] = useState(() => readFinalResult());
  const result = useMemo(() => (source ? ledgerOf(source) : asked ? null : held), [source, asked, held]);
  const homeCode = closed ? (onlineCode ? null : local) : read?.game ? asked : null;

  /* a game named in the address and not on the table: the office replays
     it. Only a finished game has an account; one still in play is sent back
     to its table */
  useEffect(() => {
    if (!asked || closed || read) return;
    let alive = true;
    void readHomeSave(asked).then((r) => {
      if (!alive) return;
      if ("game" in r) setFetched({ code: asked, game: r.game.phase === "game-over" ? r.game : null, miss: r.game.phase === "game-over" ? null : "open" });
      else setFetched({ code: asked, game: null, miss: r.miss });
    });
    return () => {
      alive = false;
    };
  }, [asked, closed, read]);

  /* the account names its game in the address, so a reload or a link comes
     back to it; and the ledger is left for the replay and the review */
  useEffect(() => {
    if (!source) return;
    keepFinal(buildFinalPayload(source));
    if (!asked && homeCode) setParams({ table: homeCode }, { replace: true });
  }, [source, asked, homeCode, setParams]);
  /* reduced motion skips the ceremony outright */
  const [ceremony, setPhase] = useState(() => (reduced ? 3 : 0));
  /* a table that rose has no ceremony: its account is simply laid out */
  const phase = result?.abandoned ? 3 : ceremony;
  const [bursting, setBursting] = useState(false);
  const [copied, setCopied] = useState(false);
  /* the toast: the table's glasses, raised from the game still on the shelf */
  const toasts = useGame((s) => s.toasts);
  const sendToast = useGame((s) => s.sendToast);
  const seat = useGame((s) => s.seat);
  const mySeat = closed ? (seat ?? closed.players.findIndex((p) => !p.isBot)) : -1;
  const canToast = !!closed && !closed.abandoned && mySeat >= 0 && !toasts.includes(mySeat);
  const clinked = toasts.length >= 2;
  useEffect(() => {
    if (clinked && getBoardOptions().sound) mugClink();
  }, [clinked]);
  /* titles from the tally, and the record against each opponent met before */
  const desk = useDesk();
  const me = useSession();
  const table = useTable(onlineCode);
  /* the ticket names the table: the office's, or the register's at home */
  const home = homeCode ?? local;
  const tableName = table?.name ?? (home ? (homeGame(home)?.name ?? home) : "");
  /* the reader's seat: the one the store knows, else the one the ledger
     names after the account, else the human one */
  const meSeat = (() => {
    if (!result) return -1;
    if (mySeat >= 0) return mySeat;
    const byName = me ? result.players.findIndex((p) => p.name === me.name) : -1;
    return byName >= 0 ? byName : result.players.findIndex((p) => !p.bot);
  })();

  const entries = useMemo(() => (result ? buildEntries(result, meSeat) : []), [result, meSeat]);
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

  if (!result) return <EmptyState code={asked} waiting={!!asked && !read} miss={read?.miss ?? null} />;

  const abandoned = !!result.abandoned;
  const tiebreak = (() => {
    const tb = abandoned ? null : tieBreakOf(result);
    if (!tb) return null;
    return tb.by === "income"
      ? t("results.tiebreak", { hi: tb.hi, lo: tb.lo })
      : t("results.tiebreakMoney", { hi: tb.hi, lo: tb.lo });
  })();

  /* where the reader finished, said once and plainly: a fact of the close,
     not advice. The winner's own caption already speaks to them */
  const standing = (() => {
    if (abandoned || meSeat < 0) return null;
    const ranked = rankPlayers(result);
    const at = ranked.findIndex((r) => r.index === meSeat);
    if (at <= 0) return null;
    const first = ranked[0].player;
    const gap = first.vp - ranked[at].player.vp;
    const place = t(`results.podium.places.${at}`);
    return gap > 0
      ? t("results.standing", { place, gap, name: first.name })
      : t("results.standingTie", { place, name: first.name });
  })();

  const handleRevanche = () => {
    // The setup lobby prefills from brassworks.setup.v1: a game at home puts
    // its own table there first, so the rematch is dealt to the same seats
    // and not to whatever this browser last filled in.
    const setup = source && homeCode ? buildFinalPayload(source).setup : null;
    if (setup) {
      try {
        localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
      } catch {
        /* storage refused: the lobby opens on its last table */
      }
    }
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

        {/* 2 — Podium; a table that rose crowns nobody: the notice of the
            abandonment and the points as they stood */}
        {abandoned ? (
          <section aria-label={t("results.abandoned.standings")} className="mt-12">
            <div className="gz-classified mx-auto w-full max-w-[560px] !px-6 !py-5">
              <p className="eyebrow-fell">{t("results.abandoned.eyebrow")}</p>
              <p className="max-w-[46ch] font-serif text-[15px] italic leading-relaxed text-paper-100">
                {result.closedAt
                  ? t("results.abandoned.body", {
                      era: t(result.closedAt.era === "canal" ? "results.abandoned.canal" : "results.abandoned.rail"),
                      round: result.closedAt.round,
                    })
                  : t("results.abandoned.bodyBare")}
              </p>
            </div>
            <p className="micro-label mx-auto mt-8 max-w-[560px] text-iron-400">{t("results.abandoned.standings")}</p>
            <div className="mx-auto mt-2 max-w-[560px]">
              <Podium entries={entries} compact />
            </div>
          </section>
        ) : (
        <motion.section
          aria-label={t("results.page.podiumAria")}
          initial={false}
          animate={{ opacity: phase >= 1 ? 1 : 0.25 }}
          transition={{ duration: 0.3 }}
          className="mt-12"
        >
          <Podium entries={entries} start={phase >= 1} countStart={phase >= 2} />
          {standing && settled && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 text-center font-serif text-[16px] italic text-paper-100"
            >
              {standing}
            </motion.p>
          )}
          {tiebreak && settled && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn("text-center font-ui text-[13px] text-paper-300 tabular-nums", standing ? "mt-1.5" : "mt-6")}
            >
              {tiebreak}
            </motion.p>
          )}
        </motion.section>
        )}

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
          const ticketSeat = meSeat;
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
          <Link to="/review" className="gz-ticket">
            <LineChart className="h-4 w-4" />
            {t("results.review.title")}
          </Link>
          <Link to="/replay" className="gz-ticket" aria-label={t("results.page.replayAria")}>
            {t("results.page.replay")}
          </Link>
          <button type="button" onClick={handleShare} className="gz-ticket min-w-[210px] justify-center">
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            {copied ? t("results.share.copied") : t("results.share.share")}
          </button>
          {/* the ways out of the account, set small: they leave the game */}
          <span className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 pt-1">
            <Link to="/" className="micro-label text-iron-400 transition-colors hover:text-paper-100">
              {t("results.actions.backToMenu")}
            </Link>
            <Link to="/rules" className="micro-label inline-flex items-center gap-1.5 text-iron-400 transition-colors hover:text-paper-100">
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              {t("results.actions.consultManual")}
            </Link>
          </span>
        </motion.div>
      </div>
    </div>
  );
}
