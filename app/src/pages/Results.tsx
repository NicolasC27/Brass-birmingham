import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Beer, BookOpen, LineChart, RotateCcw, Share2, Check } from "lucide-react";
import { useGame } from "@/game/store";
import { PLAYER_COLORS } from "@/game/data";
import { useTable } from "@/online/lobby";
import { recordAgainst } from "@/online/rivals";
import { useDesk, useSession } from "@/online/session";
import { mugClink } from "@/gl/sfx";
import { getBoardOptions } from "@/components/game/boardOptions";
import { titlesFor } from "@/components/results/titles";
import Podium, { type PodiumEntry } from "@/components/results/Podium";
import ScoringTable from "@/components/results/ScoringTable";
import TimelineFrieze from "@/components/results/TimelineFrieze";
import ScoreCurves from "@/components/results/ScoreCurves";
import EmberParticles from "@/components/results/EmberParticles";
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
    <div className="relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-6 py-24">
      <div aria-hidden className="tex-felt pointer-events-none absolute inset-0 opacity-60" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 35%, transparent 35%, rgba(16,13,11,0.8) 100%)",
        }}
      />
      <div className="plaque plaque-rivets relative max-w-[560px] px-8 py-12 text-center sm:px-12">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-ink-900/70">
          {t("results.empty.eyebrow")}
        </p>
        <h1 className="engraved-brass mt-4 font-display text-4xl font-black">
          {t("results.empty.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-sm font-sans text-sm leading-relaxed text-ink-900/85">
          {t("results.empty.body")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link to="/setup" className="btn-strike">
            {t("results.empty.setTable")}
          </Link>
          <Link to="/" className="btn-ledger">
            {t("results.empty.backTitle")}
          </Link>
        </div>
      </div>
    </div>
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
  const table = useTable(code);

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

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] pb-20">
      {/* Felt surround + soot vignette; textures stay ≤12% behind text */}
      <div aria-hidden className="tex-felt pointer-events-none absolute inset-0 opacity-60" />
      <div aria-hidden className="tex-coal pointer-events-none absolute inset-0 opacity-[0.06]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 20%, transparent 35%, rgba(16,13,11,0.82) 100%)",
        }}
      />
      <EmberParticles density={16} />

      <div className="relative mx-auto max-w-[1100px] px-6 pt-12">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-cream-100/60 transition-colors hover:text-brass-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("results.page.back")}
        </Link>

        {/* 1 — Title reveal, word by word */}
        <header className="text-center">
          <h1 className="font-fell text-[clamp(32px,5vw,52px)] leading-tight text-cream-100">
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
            className="divider-brass mt-4 max-w-md"
          />
          {!settled && (
            <p className="mt-3 font-sans text-[11px] uppercase tracking-[0.2em] text-cream-100/40">
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
              className="mt-6 text-center font-mono text-sm text-cream-100/65 tabular-nums"
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
          <h2 className="font-fell text-lg uppercase tracking-[0.06em] text-cream-100">
            {t("results.page.scoringTitle")}
          </h2>
          <div className="divider-brass mt-3 !mx-0" />
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
            <h2 className="font-fell text-lg uppercase tracking-[0.06em] text-cream-100">
              {t("results.page.curvesTitle")}
            </h2>
            <div className="divider-brass mt-3 !mx-0" />
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
            <motion.div initial={false} animate={{ opacity: settled ? 1 : 0 }} transition={{ duration: 0.3 }} className="plaque mx-auto mt-10 w-[min(560px,92vw)] rounded-md px-4 py-3">
              <p className="engraved-brass mb-2 text-center font-fell text-[12px] uppercase tracking-[0.14em]">{t("results.titles.heading")}</p>
              <ul className="flex flex-col gap-1">
                {rows.map((r) => (
                  <li key={r.index} className="flex items-center gap-3 font-sans text-[13px] text-cream-100/85">
                    <span className="font-fell text-[14px]" style={{ color: PLAYER_COLORS[r.player.color]?.hex }}>{r.player.name}</span>
                    {r.title && <span className="rounded-sm border border-brass-700/60 px-1.5 py-px font-fell text-[11.5px] tracking-wide text-brass-400">{t(`results.titles.${r.title}`)}</span>}
                    {r.record && <span className="font-mono text-[11px] text-cream-100/55">{r.record}</span>}
                    {r.raised && (
                      <span className="ml-auto flex items-center gap-1 text-brass-400" title={t("results.toast.raised", { name: r.player.name })} aria-label={t("results.toast.raised", { name: r.player.name })}>
                        <Beer className={cn("h-4 w-4", clinked && "animate-bounce")} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {clinked && <p className="mt-2 text-center font-fell text-[12px] italic text-brass-400/85">{t("results.toast.clink")}</p>}
            </motion.div>
          );
        })()}
        <motion.div
          initial={false}
          animate={{ opacity: settled ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "mt-16 flex flex-wrap items-center justify-center gap-4",
            !settled && "pointer-events-none",
          )}
        >
          {canToast && (
            <button type="button" onClick={() => sendToast()} className="btn-ledger !h-12" aria-label={t("results.toast.aria")}>
              <Beer className="h-4 w-4" />
              {t("results.toast.button")}
            </button>
          )}
          <button
            type="button"
            onClick={handleRevanche}
            className="btn-strike relative !h-12 !px-8"
          >
            <RotateCcw className="h-4 w-4" />
            {t("results.actions.revanche")}
            {bursting && <EmberBurst />}
          </button>
          <Link to="/replay" className="btn-ledger !h-12" aria-label={t("results.page.replayAria")}>
            {t("results.page.replay")}
          </Link>
          <Link to="/review" className="btn-ledger !h-12">
            <LineChart className="h-4 w-4" />
            {t("results.review.title")}
          </Link>
          <Link to="/" className="btn-ledger !h-12">
            {t("results.actions.backToMenu")}
          </Link>
          <Link to="/rules" className="btn-ledger !h-12">
            <BookOpen className="h-4 w-4" />
            {t("results.actions.consultManual")}
          </Link>
          <button type="button" onClick={handleShare} className="btn-ledger !h-12 w-[210px]">
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            {copied ? t("results.share.copied") : t("results.share.share")}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
