import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { FastForward, ScrollText, Settings2, X } from 'lucide-react';
import { ghostFromPlan } from '@/game/ghost';
import type { PlanGhost } from '@/game/ghost';
import Ceremony from '@/components/game/Ceremony';
import ConcedeBanner from '@/components/game/ConcedeBanner';
import { FeedbackButton } from '@/components/site/Feedback';
import TableMood, { TableMenu } from '@/components/game/TableMood';
import Guide from '@/components/game/Guide';
import FlipToast from '@/components/game/FlipToast';
import CoachMarks from '@/components/game/CoachMarks';
import GameTopBar from '@/components/game/GameTopBar';
import EdgeTracks from '@/components/game/EdgeTracks';
import { LoanLandingTrack } from '@/components/game/IncomeRail';
import BoardSettings from '@/components/game/BoardSettings';
import PlayerMat from '@/components/game/PlayerMat';
import { MAT_STYLES, getBoardOptions, setBoardOption, useBoardOptions } from '@/components/game/boardOptions';
import { useHudInsets } from '@/components/game/useHudInsets';
import { isKey } from '@/components/game/keybindings';
import HandDock from '@/components/game/HandDock';
import Ledger from '@/components/game/Ledger';
import MarketTray from '@/components/game/MarketTray';
import MarketPill from '@/components/game/MarketPill';
import PlayerRail from '@/components/game/PlayerRail';
import RulesOverlay from '@/components/game/RulesOverlay';
import GameOverModal from '@/components/game/ScoringModal';
import { buildTargets, candleMinutes, developOptions, linkTargets, marketSaleOnBuild, sellTargets, slotXY, tileKey } from '@/game/engine';
import type { BuildTarget } from '@/game/engine';
import { MERCHANT_BY_ID } from '@/game/data';
import { buildFinalPayload, confirmSummary, useGame } from '@/game/store';
import { FINAL_KEY } from '@/game/types';
import type { Resource } from '@/game/types';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* WebGL board renderer — lazy so pixi.js stays out of the main bundle */
const PixiBoard = lazy(() => import('@/gl/PixiBoard'));

/** the tools under the player rail: one plaque each, icon only */
const TOOL = 'plaque relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-brass-400 opacity-90 transition-opacity hover:opacity-100';


/**
 * /game — full-viewport immersive scene (map-v3 §2): the authentic Roxley
 * board fills 100% of the screen; every HUD element floats above it and
 * collapses out of the way (Steam-version style).
 */
export default function Game() {
  const t = useT();
  const navigate = useNavigate();
  /* /game/ABCD is a table on the server, /game a game played in this browser */
  const { code: tableCode } = useParams();
  const game = useGame((s) => s.game);
  const seat = useGame((s) => s.seat);
  const line = useGame((s) => s.line);
  const myTurn = useGame((s) => s.myTurn());
  const mySeat = useGame((s) => s.mySeat());
  const init = useGame((s) => s.init);
  const reset = useGame((s) => s.reset);
  const runBot = useGame((s) => s.runBot);
  const pass = useGame((s) => s.pass);
  const botHold = useGame((s) => s.botHold);
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
  const insets = useHudInsets();

  const [passTo, setPassTo] = useState<string | null>(null);
  const [skipAnim, setSkipAnim] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  /* the ledger index the reader has looked up to (closing the drawer
     moves it); their own last move counts as read too */
  const [ledgerRead, setLedgerRead] = useState(0);
  /* the exchange starts folded; it unfolds by itself while a planned action
     draws coal or iron from it, and folds back once that plan is gone */
  const [marketOpen, setMarketOpen] = useState(false);
  const marketAutoOpened = useRef(false);
  const finalWritten = useRef(false);
  const prevPlayer = useRef(-1);

  /* ------------------------- lifecycle ------------------------- */
  useEffect(() => {
    init(tableCode);
  }, [init, tableCode]);

  /* at an online table the turn is mine only when the seat to act is mine */
  const isHumanTurn = myTurn;

  /* --------------------- hot-seat interstitial ------------------ */
  useEffect(() => {
    if (!game) return;
    const cur = game.current;
    if (seat === null && prevPlayer.current !== -1 && prevPlayer.current !== cur && game.phase === 'action') {
      const humans = game.players.filter((p) => !p.isBot);
      const prev = game.players[prevPlayer.current];
      const next = game.players[cur];
      if (humans.length > 1 && !next.isBot && !prev.isBot) setPassTo(next.name);
    }
    prevPlayer.current = cur;
  }, [game, seat]);

  /* --------------------------- bots ----------------------------- */
  useEffect(() => {
    /* online the table plays its own bots */
    if (!game || seat !== null || game.phase !== 'action' || ceremony || passTo || botHold) return;
    const p = game.players[game.current];
    if (!p.isBot) return;
    const t = window.setTimeout(() => runBot(), skipAnim ? 180 : 1350);
    return () => window.clearTimeout(t);
  }, [game, seat, ceremony, passTo, skipAnim, runBot, botHold]);

  /* --------------------------- timer ---------------------------- */
  useEffect(() => {
    if (!game || game.phase !== 'action') {
      setSecondsLeft(null);
      return;
    }
    /* online the candle belongs to the table: it burns for whoever is to
       act, it keeps burning while this browser is away, and the table is
       the one that puts the turn down when it goes out */
    if (seat !== null) {
      const tick = () => {
        const ms = useGame.getState().msLeft();
        setSecondsLeft(ms === null ? null : Math.ceil(ms / 1000));
      };
      tick();
      const iv = window.setInterval(tick, 500);
      return () => window.clearInterval(iv);
    }
    const minutes = candleMinutes(game, game.current);
    if (!minutes || !isHumanTurn) {
      setSecondsLeft(null);
      return;
    }
    setSecondsLeft(minutes * 60);
    const iv = window.setInterval(() => setSecondsLeft((s) => (s === null ? null : Math.max(0, s - 1))), 1000);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.current, game?.round, game?.timerMinutes, game?.phase, isHumanTurn, seat]);

  useEffect(() => {
    if (secondsLeft === 0 && isHumanTurn && seat === null && game) {
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
        if (ledgerOpen) setLedgerRead(game.ledger.length);
        setLedgerOpen(false);
        setSpotlight(null);
        setBoardOption('settingsOpen', false);
        return;
      }
      if (isKey(e, 'rules')) {
        setRulesOpen(true);
        return;
      }
      if (isKey(e, 'settings')) {
        /* S toggles the settings panel; it shares the left edge with the mat */
        const openNow = getBoardOptions().settingsOpen;
        if (!openNow) useGame.getState().closeMat();
        setBoardOption('settingsOpen', !openNow);
        return;
      }
      if (isKey(e, 'replay')) {
        navigate('/replay?live=1');
        return;
      }
      if (isKey(e, 'undo')) {
        useGame.getState().undo();
        return;
      }
      if (isKey(e, 'matWide')) {
        setBoardOption('matWide', !getBoardOptions().matWide);
        return;
      }
      if (isKey(e, 'matStyle')) {
        setBoardOption('matStyle', MAT_STYLES[(MAT_STYLES.indexOf(getBoardOptions().matStyle) + 1) % MAT_STYLES.length]);
        return;
      }
      if (isKey(e, 'mat')) {
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
      if (isKey(e, 'market')) {
        setMarketOpen((o) => {
          setMarketFocus(!o);
          return !o;
        });
        return;
      }
      if (isKey(e, 'ledger')) {
        setLedgerOpen((o) => !o);
        if (ledgerOpen && game) setLedgerRead(game.ledger.length);
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
        const card = game.players[mySeat].hand[n - 1];
        if (card) selectCard(card.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, mySeat, passTo, isHumanTurn, ledgerOpen, verb, buildPick, linkPick, secondLinkPick, sellPick, developPick, scoutPick, selectedCardId, cancel, confirm, selectCard, setRulesOpen, setMarketFocus, setSpotlight]);

  /* ---------------------- planning targets ---------------------- */
  const selectedCard = useMemo(() => {
    if (!game || !selectedCardId) return null;
    return game.players[mySeat].hand.find((c) => c.id === selectedCardId) ?? null;
  }, [game, mySeat, selectedCardId]);

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
      /* a works that would sell to the market the moment it is built sends
         its cubes the other way: the ghost carries that too */
      const withSale = (t: BuildTarget): PlanGhost => {
        const g = ghostFromPlan(slotXY(t.town, t.slot), t.coalPlan, t.ironPlan);
        const sale = marketSaleOnBuild(game, t.town, t.industry, t.level);
        return sale.sold ? { ...g, sale: { resource: t.industry, amount: sale.sold, gain: sale.earned } } : g;
      };
      if (buildPick?.valid) return withSale(buildPick);
      const t = hoverKey ? targets.find((x) => tileKey(x.town, x.slot) === hoverKey && x.valid) : null;
      if (t) return withSale(t);
    }
    if (verb === 'network') {
      const id = linkPick?.link.id ?? hoverKey;
      const t = id ? linkTargetsList.find((x) => x.link.id === id && x.valid) : null;
      if (t && t.coalPlan.sources.length) {
        const mid = t.link.path ? t.link.path[Math.floor(t.link.path.length / 2)] : [800, 550] as [number, number];
        return ghostFromPlan(mid, t.coalPlan);
      }
    }
    if (verb === 'develop' && developPick.length) {
      /* iron ships from any works on the board, or the exchange: mark where
         this development would take it from */
      const plans = developOptions(game, mySeat).filter((o) => developPick.includes(o.industry) && o.valid).map((o) => o.iron);
      if (plans.length) return { ...ghostFromPlan([0, 0], ...plans), noTarget: true };
    }
    if (verb === 'sell') {
      /* every sale picked so far, and the one under the pointer: each with
         its own line from the merchant's barrel to the works */
      const picks = [...sellPicks];
      const hovered = hoverKey && !picks.some((x) => tileKey(x.town, x.slot) === hoverKey) ? sellTargetsList.find((x) => tileKey(x.town, x.slot) === hoverKey && x.valid) : null;
      if (hovered) picks.push(hovered);
      if (picks.length) {
        return {
          tileSources: picks.map((t) => ({ x: MERCHANT_BY_ID[t.merchant].x, y: MERCHANT_BY_ID[t.merchant].y, resource: 'beer', amount: 1, to: slotXY(t.town, t.slot) })),
          market: [],
          at: slotXY(picks[0].town, picks[0].slot),
        };
      }
    }
    return null;
  }, [game, verb, buildPick, linkPick, sellPicks, developPick, mySeat, hoverKey, targets, linkTargetsList, sellTargetsList]);

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

  /* the skip chip is a local courtesy: online the table sets the pace */
  const botThinking = seat === null && game.phase === 'action' && game.players[game.current].isBot && !ceremony;
  /* read up to: the drawer's last closing, or the reader's own last move */
  const lastMine = game.ledger.reduce((acc, e, i) => (e.player === mySeat ? i + 1 : acc), 0);
  const seenIdx = Math.max(ledgerRead, lastMine);
  const unread = game.ledger.slice(seenIdx).filter((e) => e.player !== undefined && e.player !== mySeat).length;

  return (
    <div className="fixed inset-0 z-[60] select-none overflow-hidden bg-coal-950">
      {/* mahogany table under the board */}
      <div aria-hidden className="tex-wood pointer-events-none absolute inset-0 opacity-35" />

      {/* the board fills 100% of the screen and stays interactive
          wherever no floating panel is open; panels float over it and
          never move it */}
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
      <GameTopBar secondsLeft={secondsLeft} marketOpen={marketOpen} />
      <PlayerRail
        tools={
          /* the tools under the players: the bots' pace while they play,
             then settings, ideas, the table and the ledger — the ledger
             counts what others did since the reader last looked. Nothing
             at the right edge, where the exchange unfolds. */
          <>
            {botThinking && (
              <button type="button" onClick={() => setSkipAnim((s) => !s)} aria-pressed={skipAnim} title={skipAnim ? t('game.page.botsBrisk') : t('game.page.skipBots')} aria-label={skipAnim ? t('game.page.botsBrisk') : t('game.page.skipBots')} className={cn(TOOL, skipAnim && '!border-brass-400 bg-brass-500/20 !opacity-100')}>
                <FastForward className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                /* one left-hand panel at a time: the settings take the mat's place */
                if (!boardOpts.settingsOpen) useGame.getState().closeMat();
                setBoardOption('settingsOpen', !boardOpts.settingsOpen);
              }}
              aria-label={t('board.options.settingsAria')}
              title={t('game.page.settingsChip')}
              className={TOOL}
            >
              <Settings2 className="h-4 w-4" />
            </button>
            <FeedbackButton compact className={TOOL} />
            <TableMenu compact className={TOOL} />
            <button type="button" onClick={() => setLedgerOpen((o) => !o)} aria-pressed={ledgerOpen} title={`${t('game.page.ledgerChip')} (L)`} aria-label={t('game.page.ledgerChip')} className={cn(TOOL, ledgerOpen && '!border-brass-400 !opacity-100')}>
              <ScrollText className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-1.5 -top-1.5 rounded-full bg-brass-400 px-1.5 font-mono text-[9px] font-bold leading-[14px] text-coal-950" aria-label={t('game.ledger.newAria', { n: unread })}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          </>
        }
      />

      {/* the exchange: the quotation strip is always there at the top right;
          the full tray hangs right under it when asked, whole, no scrolling,
          and the banner never moves for it (it keeps clear of the tray's
          column by itself) */}
      <MarketPill market={game.market} consume={consumePreview ?? {}} top={insets.top} open={marketOpen} onToggle={() => setMarketOpen((o) => !o)} />
      <AnimatePresence initial={false}>
        {marketOpen && (
          <motion.aside
            key="market-panel"
            initial={{ y: -28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -28, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-3 z-[64] w-[min(320px,88vw)]"
            style={{ top: insets.top + 48 }}
            data-market
            aria-label={t('game.page.marketPanelAria')}
          >
            <div className="plaque relative rounded-lg [&>.plate]:border-0 [&>.plate]:bg-transparent [&>.plate]:shadow-none">
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
              <Ledger seen={seenIdx} />
              <button
                type="button"
                onClick={() => {
                  setLedgerRead(game.ledger.length);
                  setLedgerOpen(false);
                }}
                aria-label={t('game.page.closeLedger')}
                className="absolute right-2 top-2 z-10 rounded p-1 text-cream-100/50 hover:bg-coal-800 hover:text-cream-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <HandDock />
      <ConcedeBanner />
      <TableMood />
      <Guide />
      <FlipToast />

      {/* display settings panel (language, badges, minimap, renderer…) */}
      <BoardSettings />
      <PlayerMat />

      {/* the line to the table went quiet: say so, the wire is already trying */}
      {line !== null && line !== 'online' && (
        <div role="status" className="fixed left-1/2 top-3 z-[80] -translate-x-1/2 rounded-full border border-rust-500/70 bg-coal-950/90 px-4 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-rust-500 backdrop-blur-md brightness-125">
          {t('game.page.reconnecting')}
        </div>
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
