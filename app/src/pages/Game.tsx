import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { FastForward, Scale, ScrollText, Settings2, X } from 'lucide-react';
import { ghostFromPlan } from '@/game/ghost';
import type { PlanGhost } from '@/game/ghost';
import Ceremony from '@/components/game/Ceremony';
import CoachMarks from '@/components/game/CoachMarks';
import GameTopBar from '@/components/game/GameTopBar';
import EdgeTracks from '@/components/game/EdgeTracks';
import { LoanLandingTrack } from '@/components/game/IncomeRail';
import BoardSettings from '@/components/game/BoardSettings';
import PlayerMat from '@/components/game/PlayerMat';
import { MM_H_FOR } from '@/components/game/Minimap';
import { getBoardOptions, hudInsets, setBoardOption, useBoardOptions } from '@/components/game/boardOptions';
import HandDock from '@/components/game/HandDock';
import Ledger from '@/components/game/Ledger';
import MarketTray from '@/components/game/MarketTray';
import PlayerRail from '@/components/game/PlayerRail';
import RulesOverlay from '@/components/game/RulesOverlay';
import GameOverModal from '@/components/game/ScoringModal';
import { buildTargets, linkTargets, sellTargets, slotXY, tileKey } from '@/game/engine';
import { MERCHANT_BY_ID } from '@/game/data';
import { buildFinalPayload, confirmSummary, useGame } from '@/game/store';
import { FINAL_KEY } from '@/game/types';
import type { Resource } from '@/game/types';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* WebGL board renderer — lazy so pixi.js stays out of the main bundle */
const PixiBoard = lazy(() => import('@/gl/PixiBoard'));


/**
 * /game — full-viewport immersive scene (map-v3 §2): the authentic Roxley
 * board fills 100% of the screen; every HUD element floats above it and
 * collapses out of the way (Steam-version style).
 */
export default function Game() {
  const t = useT();
  const navigate = useNavigate();
  const game = useGame((s) => s.game);
  const init = useGame((s) => s.init);
  const reset = useGame((s) => s.reset);
  const runBot = useGame((s) => s.runBot);
  const pass = useGame((s) => s.pass);
  const takeLoan = useGame((s) => s.takeLoan);
  const ceremony = useGame((s) => s.ceremony);
  const gameOverOpen = useGame((s) => s.gameOverOpen);
  const verb = useGame((s) => s.verb);
  const selectedCardId = useGame((s) => s.selectedCardId);
  const selectCard = useGame((s) => s.selectCard);
  const confirm = useGame((s) => s.confirm);
  const cancel = useGame((s) => s.cancel);
  const buildPick = useGame((s) => s.buildPick);
  const linkPick = useGame((s) => s.linkPick);
  const sellPick = useGame((s) => s.sellPick);
  const sellPicks = useGame((s) => s.sellPicks);
  const secondLinkPick = useGame((s) => s.secondLinkPick);
  const developPick = useGame((s) => s.developPick);
  const scoutPick = useGame((s) => s.scoutPick);
  const hoverKey = useGame((s) => s.hoverKey);
  const reject = useGame((s) => s.reject);
  const loanConfirm = useGame((s) => s.loanConfirm);
  const setLoanConfirm = useGame((s) => s.setLoanConfirm);
  const setRulesOpen = useGame((s) => s.setRulesOpen);
  const setMarketFocus = useGame((s) => s.setMarketFocus);
  const setSpotlight = useGame((s) => s.setSpotlight);
  const boardOpts = useBoardOptions();
  const { minimapSize } = boardOpts;
  const insets = hudInsets(boardOpts);

  const [passTo, setPassTo] = useState<string | null>(null);
  const [skipAnim, setSkipAnim] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  /* the exchange starts folded; it unfolds by itself while a planned action
     draws coal or iron from it, and folds back once that plan is gone */
  const [marketOpen, setMarketOpen] = useState(false);
  const marketAutoOpened = useRef(false);
  const finalWritten = useRef(false);
  const prevPlayer = useRef(-1);

  /* ------------------------- lifecycle ------------------------- */
  useEffect(() => {
    init();
  }, [init]);

  const isHumanTurn = !!game && game.phase === 'action' && !game.players[game.current].isBot;

  /* --------------------- hot-seat interstitial ------------------ */
  useEffect(() => {
    if (!game) return;
    const cur = game.current;
    if (prevPlayer.current !== -1 && prevPlayer.current !== cur && game.phase === 'action') {
      const humans = game.players.filter((p) => !p.isBot);
      const prev = game.players[prevPlayer.current];
      const next = game.players[cur];
      if (humans.length > 1 && !next.isBot && !prev.isBot) setPassTo(next.name);
    }
    prevPlayer.current = cur;
  }, [game]);

  /* --------------------------- bots ----------------------------- */
  useEffect(() => {
    if (!game || game.phase !== 'action' || ceremony || passTo) return;
    const p = game.players[game.current];
    if (!p.isBot) return;
    const t = window.setTimeout(() => runBot(), skipAnim ? 180 : 1350);
    return () => window.clearTimeout(t);
  }, [game, ceremony, passTo, skipAnim, runBot]);

  /* --------------------------- timer ---------------------------- */
  useEffect(() => {
    if (!game?.timerMinutes || game.phase !== 'action' || !isHumanTurn) {
      setSecondsLeft(null);
      return;
    }
    setSecondsLeft(game.timerMinutes * 60);
    const iv = window.setInterval(() => setSecondsLeft((s) => (s === null ? null : Math.max(0, s - 1))), 1000);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.current, game?.round, game?.timerMinutes, game?.phase, isHumanTurn]);

  useEffect(() => {
    if (secondsLeft === 0 && isHumanTurn && game) {
      cancel();
      pass(t('game.page.candleOut', { name: game.players[game.current].name }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  /* ------------------------- final write ------------------------ */
  useEffect(() => {
    if (!game || game.phase !== 'game-over' || !gameOverOpen || finalWritten.current) return;
    finalWritten.current = true;
    try {
      localStorage.setItem(FINAL_KEY, JSON.stringify(buildFinalPayload(game)));
    } catch {
      /* non-fatal */
    }
    const t = window.setTimeout(() => navigate('/results'), 9000);
    return () => window.clearTimeout(t);
  }, [game, gameOverOpen, navigate]);

  /* -------------------------- keyboard -------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!game || passTo) return;
      if (e.key === 'Escape') {
        cancel();
        setRulesOpen(false);
        setLedgerOpen(false);
        setSpotlight(null);
        setBoardOption('settingsOpen', false);
        return;
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        setRulesOpen(true);
        return;
      }
      if (e.key.toLowerCase() === 's') {
        /* S toggles the settings panel; it shares the left edge with the mat */
        const openNow = getBoardOptions().settingsOpen;
        if (!openNow) useGame.getState().closeMat();
        setBoardOption('settingsOpen', !openNow);
        return;
      }
      if (e.key.toLowerCase() === 'p') {
        const st = useGame.getState();
        if (st.matPlayer !== null) st.closeMat();
        else if (st.game) {
          /* your own mat first: the lone human when a bot is at the table */
          const cur = st.game.players[st.game.current];
          const humans = st.game.players.map((pl, i) => (pl.isBot ? -1 : i)).filter((i) => i >= 0);
          st.openMat(!cur.isBot ? st.game.current : humans.length === 1 ? humans[0] : st.game.current);
        }
        return;
      }
      if (e.key.toLowerCase() === 'm') {
        setMarketOpen((o) => {
          setMarketFocus(!o);
          return !o;
        });
        return;
      }
      if (e.key.toLowerCase() === 'l') {
        setLedgerOpen((o) => !o);
        return;
      }
      if (!isHumanTurn) return;
      if (e.key === 'Enter') {
        const ok = confirmSummary({ verb, buildPick, linkPick, secondLinkPick, sellPick, sellPicks, developPick, scoutPick, selectedCardId });
        if (ok) confirm();
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 8) {
        /* the open mat takes the digits: 1–4 pick whose mat to read */
        if (useGame.getState().matPlayer !== null) return;
        const card = game.players[game.current].hand[n - 1];
        if (card) selectCard(card.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, passTo, isHumanTurn, verb, buildPick, linkPick, secondLinkPick, sellPick, developPick, scoutPick, selectedCardId, cancel, confirm, selectCard, setRulesOpen, setMarketFocus, setSpotlight]);

  /* ---------------------- planning targets ---------------------- */
  const selectedCard = useMemo(() => {
    if (!game || !selectedCardId) return null;
    return game.players[game.current].hand.find((c) => c.id === selectedCardId) ?? null;
  }, [game, selectedCardId]);

  const targets = useMemo(
    () => (game && isHumanTurn && verb === 'build' && selectedCard ? buildTargets(game, game.current, selectedCard) : []),
    [game, isHumanTurn, verb, selectedCard],
  );
  const linkTargetsList = useMemo(
    () => (game && isHumanTurn && verb === 'network' ? linkTargets(game, game.current) : []),
    [game, isHumanTurn, verb],
  );
  const sellTargetsList = useMemo(
    () => (game && isHumanTurn && verb === 'sell' ? sellTargets(game, game.current) : []),
    [game, isHumanTurn, verb],
  );

  const ghost: PlanGhost | null = useMemo(() => {
    if (!game) return null;
    if (verb === 'build') {
      if (buildPick?.valid) return ghostFromPlan(slotXY(buildPick.town, buildPick.slot), buildPick.coalPlan, buildPick.ironPlan);
      const t = hoverKey ? targets.find((x) => tileKey(x.town, x.slot) === hoverKey && x.valid) : null;
      if (t) return ghostFromPlan(slotXY(t.town, t.slot), t.coalPlan, t.ironPlan);
    }
    if (verb === 'network') {
      const id = linkPick?.link.id ?? hoverKey;
      const t = id ? linkTargetsList.find((x) => x.link.id === id && x.valid) : null;
      if (t && t.coalPlan.sources.length) {
        const mid = t.link.path ? t.link.path[Math.floor(t.link.path.length / 2)] : [800, 550] as [number, number];
        return ghostFromPlan(mid, t.coalPlan);
      }
    }
    if (verb === 'sell') {
      const key = sellPick ? tileKey(sellPick.town, sellPick.slot) : hoverKey;
      const t = key ? sellTargetsList.find((x) => tileKey(x.town, x.slot) === key && x.valid) : null;
      if (t) {
        const m = MERCHANT_BY_ID[t.merchant];
        return { tileSources: [{ x: m.x, y: m.y, resource: 'beer', amount: 1 }], market: [], at: slotXY(t.town, t.slot) };
      }
    }
    return null;
  }, [game, verb, buildPick, linkPick, sellPick, hoverKey, targets, linkTargetsList, sellTargetsList]);

  const consumePreview = useMemo(() => {
    const out: Partial<Record<Resource, number>> = {};
    for (const m of ghost?.market ?? []) out[m.resource as Resource] = (out[m.resource as Resource] ?? 0) + m.amount;
    return out;
  }, [ghost]);
  const drawsFromMarket = (consumePreview.coal ?? 0) > 0 || (consumePreview.iron ?? 0) > 0;
  useEffect(() => {
    if (drawsFromMarket && !marketOpen) {
      marketAutoOpened.current = true;
      setMarketOpen(true);
    } else if (!drawsFromMarket && marketAutoOpened.current) {
      marketAutoOpened.current = false;
      setMarketOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawsFromMarket]);

  if (!game) {
    return <div className="flex min-h-[60vh] items-center justify-center font-fell text-brass-400">{t('game.page.settingTable')}</div>;
  }

  const botThinking = game.phase === 'action' && game.players[game.current].isBot && !ceremony;

  return (
    <div className="fixed inset-0 z-[60] select-none overflow-hidden bg-coal-950">
      {/* mahogany table under the board */}
      <div aria-hidden className="tex-wood pointer-events-none absolute inset-0 opacity-35" />

      {/* the board fills 100% of the screen and stays interactive
          wherever no floating panel is open */}
      <div className="absolute inset-0">
        <Suspense fallback={<div className="flex h-full items-center justify-center font-fell text-brass-400">{t('game.page.loadingGl')}</div>}>
          <PixiBoard
            game={game}
            targets={targets}
            linkTargetsList={linkTargetsList}
            sellTargetsList={sellTargetsList}
            ghost={ghost}
            onInvalid={reject}
          />
        </Suspense>
      </div>

      {/* ------- floating HUD (panels: coal-900/80–85 + backdrop-blur) ------- */}
      <EdgeTracks />
      <GameTopBar secondsLeft={secondsLeft} />
      <PlayerRail />

      {/* MarketTray — top-right drawer, DROPS DOWN from under the score belt;
          collapses to a small horizontal brass pill at the same spot */}
      <AnimatePresence initial={false}>
        {marketOpen ? (
          <motion.aside
            key="market-panel"
            initial={{ y: -28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -28, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-3 top-[44px] z-[64] max-h-[70vh] w-[min(320px,88vw)] overflow-y-auto"
            aria-label={t('game.page.marketPanelAria')}
          >
            <div className="relative rounded-lg border border-brass-700/60 bg-coal-900/85 shadow-e3 backdrop-blur-md [&>.plate]:border-0 [&>.plate]:bg-transparent [&>.plate]:shadow-none">
              <MarketTray consumePreview={consumePreview} />
              <button
                type="button"
                onClick={() => {
                  setMarketOpen(false);
                  setMarketFocus(false);
                }}
                aria-label={t('game.page.foldMarket')}
                className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-brass-700/70 bg-coal-900/90 text-brass-400 shadow-e3 hover:bg-coal-800"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </motion.aside>
        ) : (
          <motion.button
            key="market-tab"
            type="button"
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={() => setMarketOpen(true)}
            aria-label={t('game.page.openMarket')}
            className="fixed right-3 top-[44px] z-[64] flex items-center gap-2 rounded-lg border border-brass-700/70 bg-coal-900/85 px-3 py-2 font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-brass-400 shadow-e3 backdrop-blur-md hover:bg-coal-800/90"
          >
            <Scale className="h-3.5 w-3.5" />
            {t('game.page.marketTab')}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Ledger — overlay drawer (key L), never blocks the board when closed */}
      <AnimatePresence>
        {ledgerOpen && (
          <motion.aside
            key="ledger-drawer"
            initial={{ x: 380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 380, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-0 right-0 top-0 z-[66] w-[min(360px,92vw)] p-3"
            aria-label={t('game.page.ledgerDrawerAria')}
          >
            <div className="relative h-full rounded-lg border border-brass-700/60 bg-coal-900/85 shadow-e4 backdrop-blur-md [&>.plate]:h-full [&>.plate]:border-0 [&>.plate]:bg-transparent [&>.plate]:shadow-none">
              <Ledger />
              <button
                type="button"
                onClick={() => setLedgerOpen(false)}
                aria-label={t('game.page.closeLedger')}
                className="absolute right-2 top-2 z-10 rounded p-1 text-cream-100/50 hover:bg-coal-800 hover:text-cream-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* bottom-right chip row (rides above the minimap whatever its size):
          settings gear + ledger opener, same chrome */}
      <div className="fixed right-3 z-[64] flex items-center gap-1.5" style={{ bottom: MM_H_FOR[minimapSize] + insets.bottom + 20 }}>
        <button
          type="button"
          onClick={() => {
            /* one left-hand panel at a time: the settings take the mat's place */
            if (!boardOpts.settingsOpen) useGame.getState().closeMat();
            setBoardOption('settingsOpen', !boardOpts.settingsOpen);
          }}
          aria-label={t('board.options.settingsAria')}
          title={t('board.options.settingsTip')}
          className="flex items-center gap-1.5 rounded-md border border-brass-700/60 bg-coal-900/85 px-2.5 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-brass-400 opacity-80 shadow-e3 backdrop-blur-md transition-opacity hover:opacity-100"
        >
          <Settings2 className="h-3.5 w-3.5" /> {t('game.page.settingsChip')}
        </button>
        {!ledgerOpen && (
          <button
            type="button"
            onClick={() => setLedgerOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-brass-700/60 bg-coal-900/85 px-2.5 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-brass-400 opacity-80 shadow-e3 backdrop-blur-md transition-opacity hover:opacity-100"
          >
            <ScrollText className="h-3.5 w-3.5" /> {t('game.page.ledgerChip')} <kbd className="font-mono text-[9px] text-cream-100/50">L</kbd>
          </button>
        )}
      </div>

      <HandDock />

      {/* display settings panel (language, badges, minimap, renderer…) */}
      <BoardSettings />
      <PlayerMat />

      {/* skip bot animation chip */}
      {botThinking && (
        <button
          type="button"
          onClick={() => setSkipAnim((s) => !s)}
          className={cn(
            'fixed right-3 z-[64] flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-wider backdrop-blur-md',
            skipAnim ? 'border-brass-400 bg-brass-500/20 text-brass-400' : 'border-brass-700/60 bg-coal-800/90 text-cream-100/75',
          )}
          style={{ bottom: MM_H_FOR[minimapSize] + insets.bottom + 62 }}
        >
          <FastForward className="h-3.5 w-3.5" />
          {skipAnim ? t('game.page.botsBrisk') : t('game.page.skipBots')}
        </button>
      )}

      {/* hot-seat pass interstitial — fully opaque: the board and every hand
          stay hidden until the next human claims the device */}
      <AnimatePresence>
        {passTo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[78] flex items-center justify-center bg-coal-950"
            role="dialog"
            aria-modal="true"
            aria-label={t('game.page.passDevice', { name: passTo })}
          >
            <div aria-hidden className="tex-wood pointer-events-none absolute inset-0 opacity-25" />
            <div aria-hidden className="tex-coal pointer-events-none absolute inset-0 opacity-[0.06]" />
            <motion.div
              initial={{ scale: 0.92, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              className="plaque plaque-rivets relative w-full max-w-[440px] p-8 text-center shadow-e4"
            >
              <p className="font-sans text-[11px] font-bold uppercase tracking-[0.24em] text-ink-900/60">{t('game.page.hotSeat')}</p>
              <h2
                className="mt-3 font-display text-[32px] font-black leading-tight text-ink-900"
                style={{ textShadow: '0 1px 0 rgba(242,234,214,.4)' }}
              >
                {t('game.page.passDevice', { name: passTo })}
              </h2>
              <p className="mt-2 font-fell text-sm italic text-ink-900/70">
                {t('game.page.passBody')}
              </p>
              <button
                type="button"
                autoFocus
                onClick={() => setPassTo(null)}
                className="btn-ledger mt-6 w-full !min-h-[44px] !text-sm"
              >
                {t('game.page.passClaim', { name: passTo })}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* loan confirm */}
      <AnimatePresence>
        {loanConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[82] flex items-center justify-center bg-coal-950/75 p-4 backdrop-blur-sm"
            role="dialog"
            aria-label={t('game.page.loanAria')}
          >
            <motion.div
              initial={{ scale: 0.92, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              className="plate relative w-full max-w-[400px] border-rust-500/70 p-6 shadow-e4"
            >
              <h2 className="font-display text-2xl font-black text-rust-500 brightness-150">{t('game.page.loanTitle')}</h2>
              <p className="mt-2 font-sans text-sm text-cream-100/85">
                {t('game.page.loanBody')}
              </p>
              {/* coin cascade preview */}
              <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
                {Array.from({ length: 6 }, (_, i) => (
                  <motion.span
                    key={i}
                    initial={{ y: -22, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.05, type: 'spring', stiffness: 320, damping: 20 }}
                    className="h-4 w-4 rounded-full border border-brass-700 bg-[radial-gradient(circle_at_35%_30%,#DDBE7E,#8A6B33)]"
                  />
                ))}
              </div>
              {/* where the loan drops the income pawn (physical track read) */}
              <LoanLandingTrack income={game.players[game.current].income} color={game.players[game.current].color} />
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setLoanConfirm(false)} className="btn-ledger !min-h-[36px] !px-4 !py-1.5 text-xs">
                  {t('game.page.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoanConfirm(false);
                    takeLoan();
                  }}
                  className="btn-loan !min-h-[36px] !px-4 !py-1.5 text-xs"
                >
                  {t('game.page.signNote')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Ceremony />
      <GameOverModal
        onRematch={() => {
          finalWritten.current = false;
          reset();
        }}
      />
      <RulesOverlay />
      <CoachMarks />
    </div>
  );
}
