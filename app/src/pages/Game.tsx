import type { ComponentProps } from 'react';
import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { FastForward, Pause, Play, ScrollText, Settings2, X } from 'lucide-react';
import NotebookButton from '@/components/game/Notebook';
import { ghostFromPlan } from '@/game/ghost';
import type { PlanGhost } from '@/game/ghost';
import Ceremony from '@/components/game/Ceremony';
import ConcedeBanner from '@/components/game/ConcedeBanner';
import { FeedbackButton } from '@/components/site/Feedback';
import TableMood, { TableMenu } from '@/components/game/TableMood';
import Guide from '@/components/game/Guide';
import { guideDock } from '@/components/game/guideKeys';
import { useWide } from '@/hooks/use-narrow';
import Notices from '@/components/game/Notices';
import { MarkWarning, TelegramButton } from '@/components/game/Telegrams';
import Gazette from '@/components/game/Gazette';
import PreparedPanel from '@/components/game/PreparedPanel';
import SpectatorStrip from '@/components/game/SpectatorStrip';
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
import { routeFor } from '@/components/game/routePaths';
import { buildTargets, candleMinutes, doubleLinkPlan, linkTargets, marketSaleOnBuild, sellTargets, slotXY, tileKey, withIron } from '@/game/engine';
import type { BuildTarget } from '@/game/engine';
import { MERCHANT_BY_ID } from '@/game/data';
import { listLocalGames, openLocalGame } from '@/game/local';
import { buildFinalPayload, confirmSummary, developPlans, leaveOnlineTable, projectQueued, useGame } from '@/game/store';
import { GLIMPSE_MS } from '@/components/game/boardView';
import { isOnline } from '@/online/lobby';
import { useStranger } from '@/online/session';
import { FINAL_KEY } from '@/game/types';
import type { Resource } from '@/game/types';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* WebGL board renderer — lazy so pixi.js stays out of the main bundle */
const PixiBoard = lazy(() => import('@/gl/PixiBoard'));

/** the pause between two moves of a machine while the reader follows them */
const FOLLOW_PACE_MS = 4000;

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
  /* /game/ABCD is a table on the server, /game/local/ABCD a game of this
     device's register; bare /game is the old address of the latter */
  const { code: tableCode, local: localCode } = useParams();
  const game = useGame((s) => s.game);
  const seat = useGame((s) => s.seat);
  const line = useGame((s) => s.line);
  const myTurn = useGame((s) => s.myTurn());
  const planActor = useGame((s) => s.planActor());
  const queued = useGame((s) => s.queued);
  const preparing = useGame((s) => s.preparing);
  const previewQueue = useGame((s) => s.previewQueue);
  const setPreviewQueue = useGame((s) => s.setPreviewQueue);
  const surveySeat = useGame((s) => s.surveySeat);
  const surveyEmpires = useGame((s) => s.surveyEmpires);
  const glimpse = useGame((s) => s.glimpse);
  const tutorial = useGame((s) => s.tutorial);
  /* the room the guide takes from the table: a lane of its own when the
     window can spare it, nothing when it cannot */
  const wide = useWide();
  const setGlimpse = useGame((s) => s.setGlimpse);
  const setSurveySeat = useGame((s) => s.setSurveySeat);
  const cycleSurveySeat = useGame((s) => s.cycleSurveySeat);
  const surveying = previewQueue || surveySeat !== null;
  const queuedCount = queued.length;
  /* showing the orders on the board: the focus view meanwhile, the reader's own setting back after */
  const focusBefore = useRef<boolean | null>(null);
  useEffect(() => {
    if (!surveying) return;
    if (focusBefore.current === null) focusBefore.current = getBoardOptions().focus;
    setBoardOption('focus', true);
    /* the survey closed, or the page left mid-survey: the reader's own setting back */
    return () => {
      if (focusBefore.current === null) return;
      setBoardOption('focus', focusBefore.current);
      focusBefore.current = null;
    };
  }, [surveying]);
  /* the table a plan is made on: with moves already prepared, the one they leave */
  const planGame = useMemo(() => (game && preparing && queued.length && planActor >= 0 ? projectQueued(game, planActor, queued) : game), [game, preparing, queued, planActor]);
  const mySeat = useGame((s) => s.mySeat());
  /* the survey shown on the board: one object per survey, not one per render
     (the board rebuilds its overlay and its filter whenever it changes) */
  const preview = useMemo<ComponentProps<typeof PixiBoard>['preview']>(
    () => (surveySeat !== null ? { kind: 'player', seat: surveySeat, empires: surveyEmpires } : previewQueue && mySeat >= 0 ? { kind: 'orders', queued, actor: mySeat, empires: surveyEmpires } : glimpse ? { kind: 'player', seat: glimpse.seat, transient: true, at: glimpse.at } : null),
    [surveySeat, surveyEmpires, previewQueue, queued, mySeat, glimpse],
  );
  /* a glimpse of another seat's move lasts a few seconds, then the table is itself again */
  useEffect(() => {
    if (!glimpse) return;
    const id = window.setTimeout(() => setGlimpse(null), GLIMPSE_MS);
    return () => window.clearTimeout(id);
  }, [glimpse, setGlimpse]);
  const spectating = useGame((s) => s.spectating());
  const init = useGame((s) => s.init);
  const reset = useGame((s) => s.reset);
  const runBot = useGame((s) => s.runBot);
  const pass = useGame((s) => s.pass);
  const botHold = useGame((s) => s.botHold);
  const setBotHold = useGame((s) => s.setBotHold);
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
  const developIron = useGame((s) => s.developIron);
  const buildIron = useGame((s) => s.buildIron);
  const linkBeer = useGame((s) => s.linkBeer);
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
  /* the candle of a home turn: when it goes out (one moment per turn, not a tick a second) */
  const [candleEnd, setCandleEnd] = useState<number | null>(null);
  const onlineCandle = useGame((s) => s.candle);
  const frozen = useGame((s) => s.mood.frozen);
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
    if (!tableCode && !localCode) {
      /* the old address of the game at home: the one last touched, else a new deal */
      const at = listLocalGames()[0] ?? openLocalGame();
      navigate(`/game/local/${at.code}`, { replace: true });
      return;
    }
    init(tableCode, localCode);
    /* leaving the page leaves the table: its frames must not land on the next board */
    return () => {
      if (tableCode) leaveOnlineTable();
    };
  }, [init, tableCode, localCode, navigate]);
  /* a table on the server is no place for a stranger: the office signs
     you in first, the code travelling along */
  const stranger = useStranger();
  useEffect(() => {
    if (tableCode && isOnline && stranger) navigate(`/online?table=${tableCode}`, { replace: true });
  }, [tableCode, stranger, navigate]);

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
    /* followed, a machine leaves the reader the time to see its move */
    const t = window.setTimeout(() => runBot(), skipAnim ? 180 : useGame.getState().followBots ? FOLLOW_PACE_MS : 1350);
    return () => window.clearTimeout(t);
  }, [game, seat, ceremony, passTo, skipAnim, runBot, botHold]);

  /* --------------------------- timer ---------------------------- */
  useEffect(() => {
    /* online the candle belongs to the table: it burns for whoever is to
       act, it keeps burning while this browser is away, and the table is
       the one that puts the turn down when it goes out */
    if (!game || game.phase !== 'action' || seat !== null) {
      setCandleEnd(null);
      return;
    }
    const minutes = candleMinutes(game, game.current);
    if (!minutes || !isHumanTurn) {
      setCandleEnd(null);
      return;
    }
    const end = Date.now() + minutes * 60_000;
    setCandleEnd(end);
    /* the candle out: the turn is put down, once */
    const out = window.setTimeout(() => {
      const st = useGame.getState();
      if (!st.game || st.game.phase !== 'action' || !st.myTurn()) return;
      cancel();
      pass(t('game.page.candleOut', { name: st.game.players[st.game.current].name }));
    }, minutes * 60_000);
    return () => window.clearTimeout(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.current, game?.round, game?.timerMinutes, game?.phase, isHumanTurn, seat]);
  /* what the banner burns: at home the turn's own end; online the table's
     candle as the last frame anchored it, held still while a pause holds */
  const candle = useMemo<{ end: number } | { left: number } | null>(() => {
    if (seat !== null) return onlineCandle ? (frozen ? { left: onlineCandle.msLeft } : { end: onlineCandle.at + onlineCandle.msLeft }) : null;
    return candleEnd !== null ? { end: candleEnd } : null;
  }, [seat, onlineCandle, frozen, candleEnd]);

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
      /* the orders shown on the board: Escape closes that first */
      if (e.key === 'Escape' && (useGame.getState().previewQueue || useGame.getState().surveySeat !== null)) {
        e.preventDefault();
        setPreviewQueue(false);
        setSurveySeat(null);
        return;
      }
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
      if (isKey(e, 'focus')) {
        setBoardOption('focus', !getBoardOptions().focus);
        return;
      }
      /* the points ruler along the top edge, shown or put away */
      if (isKey(e, 'vpTrack')) {
        setBoardOption('vpTrack', !getBoardOptions().vpTrack);
        return;
      }
      /* the survey of the orders, from anywhere, as long as there are orders */
      if (isKey(e, 'survey')) {
        const st = useGame.getState();
        /* a spectator has no orders: the survey shows the seat to act */
        if (spectating) setSurveySeat(st.surveySeat === null ? game.current : null);
        else setPreviewQueue(!st.previewQueue);
        return;
      }
      /* another seat's last move, seat after seat, then closed */
      if (isKey(e, 'lastMove')) {
        cycleSurveySeat();
        return;
      }
      /* read live: the actor changes when a move is prepared, with nothing else in this list */
      if (useGame.getState().planActor() < 0) return;
      if (e.key === 'Enter') {
        const ok = confirmSummary({ verb, buildPick, linkPick, secondLinkPick, sellPick, sellPicks, developPick, developIron, scoutPick, selectedCardId });
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
  }, [game, mySeat, spectating, passTo, isHumanTurn, ledgerOpen, verb, buildPick, linkPick, secondLinkPick, sellPick, developPick, scoutPick, selectedCardId, cancel, confirm, selectCard, setRulesOpen, setMarketFocus, setSpotlight]);

  /* ---------------------- planning targets ---------------------- */
  const selectedCard = useMemo(() => {
    if (!game || !selectedCardId || mySeat < 0) return null;
    return game.players[mySeat].hand.find((c) => c.id === selectedCardId) ?? null;
  }, [game, mySeat, selectedCardId]);

  /* the plan is made for the acting human, or for me while preparing a move out of turn */
  const targets = useMemo(
    () => (planGame && planActor >= 0 && verb === 'build' && selectedCard ? buildTargets(planGame, planActor, selectedCard) : []),
    [planGame, planActor, verb, selectedCard],
  );
  const linkTargetsList = useMemo(
    () => (planGame && planActor >= 0 && verb === 'network' ? linkTargets(planGame, planActor) : []),
    [planGame, planActor, verb],
  );
  const sellTargetsList = useMemo(
    () => (planGame && planActor >= 0 && verb === 'sell' ? sellTargets(planGame, planActor) : []),
    [planGame, planActor, verb],
  );
  /* my turn has come: a prepared move plays after a beat, if the engine still takes it */
  useEffect(() => {
    if (!myTurn || !queuedCount) return;
    const id = window.setTimeout(() => useGame.getState().playQueued(), 1000);
    return () => window.clearTimeout(id);
  }, [myTurn, queuedCount, game?.actionsLeft]);

  const ghost: PlanGhost | null = useMemo(() => {
    if (!planGame) return null;
    if (verb === 'build') {
      /* a works that would sell to the market the moment it is built sends
         its cubes the other way: the ghost carries that too */
      const withSale = (t: BuildTarget): PlanGhost => {
        const g = ghostFromPlan(slotXY(t.town, t.slot), t.coalPlan, t.ironPlan);
        const sale = marketSaleOnBuild(planGame, t.town, t.industry, t.level);
        return sale.sold ? { ...g, sale: { resource: t.industry, amount: sale.sold, gain: sale.earned } } : g;
      };
      if (buildPick?.valid) return withSale(withIron(planGame, planActor, buildPick, buildIron));
      const t = hoverKey ? targets.find((x) => tileKey(x.town, x.slot) === hoverKey && x.valid) : null;
      if (t) return withSale(t);
    }
    if (verb === 'network') {
      const id = linkPick?.link.id ?? hoverKey;
      const t = id ? linkTargetsList.find((x) => x.link.id === id && x.valid) : null;
      if (t && secondLinkPick && linkPick && planActor >= 0) {
        /* a double rail: each link's coal to its own middle, and the beer
           the pair drinks to the second's */
        const dbl = doubleLinkPlan(planGame, planActor, linkPick, secondLinkPick.link, linkBeer);
        const mid1 = routeFor(linkPick.link, planGame.era).mid;
        const mid2 = routeFor(secondLinkPick.link, planGame.era).mid;
        const g = ghostFromPlan(mid2, dbl.coal2);
        for (const b of dbl.beer) {
          if (b.kind !== 'brewery') continue;
          const [x, y] = slotXY(b.town!, b.slot!);
          g.tileSources.push({ x, y, resource: 'beer', amount: 1, to: mid2 });
        }
        g.tileSources.push(...ghostFromPlan(mid1, linkPick.coalPlan).tileSources.map((src) => ({ ...src, to: mid1 })));
        return g;
      }
      if (t && t.coalPlan.sources.length) {
        /* the coal line lands mid-route, on the route of this era: a rail
           does not follow the canal's winding path */
        return ghostFromPlan(routeFor(t.link, planGame.era).mid, t.coalPlan);
      }
    }
    if (verb === 'develop' && developPick.length) {
      /* iron ships from any works on the board, or the exchange: mark where
         this development would take it from */
      const plans = developPlans(planGame, developIron);
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
  }, [planGame, planActor, verb, buildPick, buildIron, linkPick, secondLinkPick, linkBeer, sellPicks, developPick, developIron, mySeat, hoverKey, targets, linkTargetsList, sellTargetsList]);

  const consumePreview = useMemo(() => {
    const out: Partial<Record<Resource, number>> = {};
    for (const m of ghost?.market ?? []) out[m.resource as Resource] = (out[m.resource as Resource] ?? 0) + m.amount;
    return out;
  }, [ghost]);
  /* the tray opens whenever the plan trades with the exchange: buying
     coal or iron, or a mine/works selling its output on the spot */
  const drawsFromMarket = (consumePreview.coal ?? 0) > 0 || (consumePreview.iron ?? 0) > 0 || !!ghost?.sale;
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
  const dock = tutorial && wide ? guideDock() : 0;
  const seenIdx = Math.max(ledgerRead, lastMine);
  const unread = game.ledger.slice(seenIdx).filter((e) => e.player !== undefined && e.player !== mySeat).length;

  return (
    <div className="fixed inset-0 z-[60] select-none overflow-hidden bg-coal-950">
      {/* the table keeps the room the guide leaves it: `contain` makes this
          box the frame every fixed panel below positions against, so the
          board and its HUD shrink together rather than hiding under the lane */}
      <div data-table className="absolute inset-y-0 left-0 overflow-hidden" style={{ right: dock, contain: 'paint' }}>
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
            preview={preview}
          />
        </Suspense>
      </div>

      {/* ------- floating HUD (panels: coal-900/80–85 + backdrop-blur) ------- */}
      {/* the orders shown on the board: the whole HUD steps aside, the ribbon alone stays */}
      {!surveying && <EdgeTracks />}
      {!surveying && <GameTopBar candle={candle} marketOpen={marketOpen} />}
      {!surveying && <PlayerRail
        tools={
          /* the tools under the players: the bots' pace while they play,
             then settings, ideas, the table and the ledger — the ledger
             counts what others did since the reader last looked. Nothing
             at the right edge, where the exchange unfolds. */
          <>
            {/* hold the machines where they stand (a standing switch at a home
                table, not only while one thinks): time to look, or to prepare a move */}
            {seat === null && game.phase === 'action' && (
              <button type="button" onClick={() => setBotHold(!botHold)} aria-pressed={botHold} title={t(botHold ? 'game.page.resumeBots' : 'game.page.holdBots')} aria-label={t(botHold ? 'game.page.resumeBots' : 'game.page.holdBots')} className={cn(TOOL, botHold && '!border-brass-400 bg-brass-500/20 !opacity-100')}>
                {botHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
            )}
            {botThinking && (
              <button type="button" onClick={() => setSkipAnim((s) => !s)} aria-pressed={skipAnim} title={skipAnim ? t('game.page.botsBrisk') : t('game.page.skipBots')} aria-label={skipAnim ? t('game.page.botsBrisk') : t('game.page.skipBots')} className={cn(TOOL, skipAnim && '!border-brass-400 bg-brass-500/20 !opacity-100')}>
                <FastForward className="h-4 w-4" />
              </button>
            )}
            <TelegramButton className={TOOL} />
            <NotebookButton className={TOOL} />
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
      />}

      {/* the exchange: the quotation strip is always there at the top right;
          the full tray hangs right under it when asked, whole, no scrolling,
          and the banner never moves for it (it keeps clear of the tray's
          column by itself) */}
      {!surveying && <MarketPill market={game.market} consume={consumePreview ?? {}} top={insets.top} open={marketOpen} onToggle={() => setMarketOpen((o) => !o)} />}
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

      {!surveying && (spectating ? <SpectatorStrip /> : <HandDock />)}
      <ConcedeBanner />
      <TableMood />
      {!surveying && <Notices />}
      <Gazette />
      <PreparedPanel />
      <MarkWarning />

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

      {/* the guide's own lane, beside the table rather than over it */}
      <Guide dock={dock} />
    </div>
  );
}
