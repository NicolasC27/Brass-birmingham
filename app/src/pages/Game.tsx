import type { ComponentProps } from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { FastForward, Pause, Play, ScrollText, Settings2, X } from 'lucide-react';
import NotebookButton from '@/components/game/Notebook';
import LessonHalo from '@/components/game/LessonHalo';
import Debrief from '@/components/game/Debrief';
import Boundary from '@/components/platform/Boundary';
import ReviewHand from '@/components/game/ReviewHand';
import AskGuide from '@/components/game/AskGuide';
import { readable } from '@/game/analysis';
import { readGame, stopReading } from '@/game/analysisRun';
import { ghostFromPlan } from '@/game/ghost';
import type { PlanGhost } from '@/game/ghost';
import Ceremony from '@/components/game/Ceremony';
import ConcedeBanner from '@/components/game/ConcedeBanner';
import { FeedbackButton } from '@/components/site/Feedback';
import TableMood, { TableMenu } from '@/components/game/TableMood';
import Guide from '@/components/game/Guide';
import { guideDock, GUIDE_RAIL } from '@/components/game/guideKeys';
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
import TitleCard, { TitlePlate, TroubleCard } from '@/components/game/TitleCard';
import { useBoardSet } from '@/components/game/titleStage';
import { MAT_STYLES, getBoardOptions, setBoardOption, useBoardOptions } from '@/components/game/boardOptions';
import { analysisLane, useHudInsets } from '@/components/game/useHudInsets';
import { isKey, onControl, typing } from '@/components/game/keybindings';
import { useLayer } from '@/components/game/useLayer';
import HandDock from '@/components/game/HandDock';
import Ledger from '@/components/game/Ledger';
import MarketTray from '@/components/game/MarketTray';
import MarketPill from '@/components/game/MarketPill';
import PlayerRail from '@/components/game/PlayerRail';
import RulesOverlay from '@/components/game/RulesOverlay';
import GameOverModal from '@/components/game/ScoringModal';
import { routeFor } from '@/components/game/routePaths';
import { buildTargets, candleMinutes, doubleLinkPlan, linkTargets, marketSaleOnBuild, sellTargets, slotXY, tileKey, withCoal, withIron, withLinkCoal } from '@/game/engine';
import type { BuildTarget, LinkTarget, SellTarget } from '@/game/engine';
import { listHomeGames, openHomeGame } from '@/game/home';
import { buildFinalPayload, confirmSummary, developPlans, leaveHomeTable, leaveOnlineTable, projectQueued, useGame, describeAction } from '@/game/store';
import type { HomeTrouble } from '@/game/store';
import { GLIMPSE_MS } from '@/components/game/boardView';
import { isOnline } from '@/online/lobby';
import { useStranger } from '@/online/session';
import { keepFinal, keepTableOf } from '@/game/final';
import { replay, setupOf } from '@/game/actions';
import { topLayer } from '@/components/game/layers';
import type { Resource } from '@/game/types';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* WebGL board renderer — lazy so pixi.js stays out of the main bundle */
const PixiBoard = lazy(() => import('@/gl/PixiBoard'));

/** the pause between two moves of a machine while the reader follows them */
const FOLLOW_PACE_MS = 4000;

/* a game being read shows no plan on the board: the same empty lists each
   time, so the board's overlay is not rebuilt for a new [] on every render */
const NO_TARGETS: BuildTarget[] = [];
const NO_LINKS: LinkTarget[] = [];
const NO_SALES: SellTarget[] = [];
/** a sheet that must be answered: Escape stops at it */
const holdOn = () => undefined;

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
  /* a game at home the office would not follow: why, and whether the
     board has been read back from its log yet */
  const homeTrouble = useGame((s) => s.homeTrouble);
  /* the table the title card names: the address first, so a card never
     shows the table left behind while the store is still being set */
  const storeLocal = useGame((s) => s.local);
  const titleCode = tableCode ?? null;
  const titleLocal = localCode ?? (tableCode ? null : storeLocal);
  /* how far the board has come: the title card covers the table until then */
  const boardHost = useRef<HTMLDivElement>(null);
  const boardStage = useBoardSet(boardHost, !!game);
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
  /* the debrief: the game read again once over, one of its moments on the board */
  const debriefOpen = useGame((s) => s.debriefOpen);
  /* whose turns the debrief reads: my seat online, the first human at home */
  const reviewSeat = seat ?? game?.players.findIndex((p) => !p.isBot) ?? -1;
  const review = useGame((s) => s.review);
  /* one panel per game read: a new table or deal starts it afresh */
  const reviewTable = useGame((s) => s.code ?? s.local ?? 'x');
  const setReview = useGame((s) => s.setReview);
  const setDebriefOpen = useGame((s) => s.setDebriefOpen);
  /* the survey shown on the board: one object per survey, not one per render
     (the board rebuilds its overlay and its filter whenever it changes) */
  const preview = useMemo<ComponentProps<typeof PixiBoard>['preview']>(
    () => (review?.seat !== undefined ? { kind: 'player', seat: review.seat } : surveySeat !== null ? { kind: 'player', seat: surveySeat, empires: surveyEmpires } : previewQueue && mySeat >= 0 ? { kind: 'orders', queued, actor: mySeat, empires: surveyEmpires } : glimpse ? { kind: 'player', seat: glimpse.seat, transient: true, at: glimpse.at } : null),
    [review, surveySeat, surveyEmpires, previewQueue, queued, mySeat, glimpse],
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
  const buildCoal = useGame((s) => s.buildCoal);
  const linkCoal = useGame((s) => s.linkCoal);
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

  /* the room the analysis panel takes down the right edge: the board, the
     review's plate and the ledger's drawer keep out of it rather than hide
     under it */
  const analysisPane = analysisLane(debriefOpen && readable(game));
  /* the judge reads the canal era while the rail one is played, on a thread
     of its own and in silence: the analysis opened at the end finds half its
     work done. Nothing of it reaches the board before the game is over. */
  const warmed = useRef<string | null>(null);
  useEffect(() => {
    if (!game) return;
    /* twice: when the rail era opens, and again the moment the game is played
       out — the reader asks for the analysis a second later, and by then the
       first half is on the shelf and the rest is already being read */
    const when = game.phase === 'game-over' ? 'over' : game.era === 'rail' && game.phase === 'action' ? 'rail' : null;
    if (!when) return;
    const seat = game.players.findIndex((p) => !p.isBot);
    const at = tableCode ?? localCode ?? 'x';
    const mark = `${at}:${game.seed}:${seat}:${when}:${useGame.getState().judgeId}`;
    if (seat < 0 || warmed.current === mark) return;
    warmed.current = mark;
    readGame(game, at, seat, useGame.getState().judgeId, !!tableCode);
  }, [game, tableCode, localCode]);
  /* the reading belongs to the game, not to the page: it stops when the board
     goes, and the panel picks up the one already under way */
  useEffect(() => () => stopReading(), []);

  /* leaving the review puts the final ledger back up: the board of a game
     played out has nothing more to say on its own */
  const leaveReview = useCallback(() => {
    setReview(null);
    setDebriefOpen(false);
    if (useGame.getState().game?.phase === 'game-over') useGame.getState().openGameOver();
  }, [setReview, setDebriefOpen]);

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
  const closeLedger = useCallback(() => {
    const g = useGame.getState().game;
    if (g) setLedgerRead(g.ledger.length);
    setLedgerOpen(false);
  }, []);
  /* the ledger holds the right edge: the exchange's tray, opened after it,
     sends it away, and the other way round */
  const ledgerSheet = useLayer<HTMLElement>(ledgerOpen, closeLedger, { zone: 'right' });
  /* the exchange starts folded; it unfolds by itself while a planned action
     draws coal or iron from it, and folds back once that plan is gone */
  const [marketOpen, setMarketOpen] = useState(false);
  const marketAutoOpened = useRef(false);
  const prevPlayer = useRef(-1);

  /* ------------------------- lifecycle ------------------------- */
  useEffect(() => {
    if (!tableCode && !localCode) {
      /* the old address of the game at home: the one last touched, else a
         new deal — and the office is the one that names it */
      const last = listHomeGames()[0];
      if (last) navigate(`/game/local/${last.code}`, { replace: true });
      else void openHomeGame().then((at) => navigate(`/game/local/${at.code}`, { replace: true })).catch(() => undefined);
      return;
    }
    init(tableCode, localCode);
    /* leaving the page leaves the table: its frames must not land on the
       next board, and at home the office is no longer listened to */
    return () => {
      if (tableCode) leaveOnlineTable();
      else leaveHomeTable();
    };
  }, [init, tableCode, localCode, navigate]);
  /* the office named the game something else than the address did — a game
     carried in a link, or a rematch: the address follows the office, which
     is the only place the code means anything */
  const movedTo = useGame((s) => s.movedTo);
  useEffect(() => {
    if (movedTo && movedTo !== localCode) navigate(`/game/local/${movedTo}`, { replace: true });
  }, [movedTo, localCode, navigate]);
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

  /* the desk sends a reader straight to the analysis of a finished game:
     the panel opens on arrival, and the address is tidied */
  const wantsAnalysis = useRef(new URLSearchParams(window.location.search).has('analyse'));
  useEffect(() => {
    if (!wantsAnalysis.current || !readable(game)) return;
    wantsAnalysis.current = false;
    setDebriefOpen(true);
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  }, [game, setDebriefOpen]);

  /* ------------------------- final write ------------------------ */
  /* the ledger of a finished game is left for the pages that follow the
     board, closed on this visit or reopened; nobody is sent on to them —
     the reader leaves the final ledger when they choose. A game that
     closes while the table watches has its last era counted in; one
     already over when it was opened is simply read */
  const tableAt = tableCode ?? localCode ?? '';
  const [openedOver, setOpenedOver] = useState<{ at: string; over: boolean } | null>(null);
  if (game && openedOver?.at !== tableAt) setOpenedOver({ at: tableAt, over: game.phase === 'game-over' });
  useEffect(() => {
    if (game?.phase === 'game-over') keepFinal(buildFinalPayload(game));
  }, [game]);
  /* the links come off the board with the last scoring: the finished table
     shows the network at its height, as it stood before the last move */
  const finalBoard = useMemo(() => {
    if (!game || game.phase !== 'game-over' || game.abandoned || Object.keys(game.links).length) return null;
    const cut = game.actions[game.actions.length - 1]?.kind === 'begin-rail' ? 2 : 1;
    try {
      const before = replay(setupOf(game), game.seed, game.actions.slice(0, -cut));
      /* the last move may have laid a line itself: it belongs to the network */
      const links = { ...before.links };
      const last = game.actions[game.actions.length - cut];
      if (last?.kind === 'network') for (const id of [last.link, last.second]) if (id && !links[id]) links[id] = { owner: before.current, era: before.era };
      return { ...game, links };
    } catch {
      return null;
    }
  }, [game]);

  /* -------------------------- keyboard -------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* a reader writing somewhere keeps their letters: the shortcuts are
         for the board, not for a field */
      if (typing(e)) return;
      /* a sheet that holds the table — the final ledger, the era's scene, a
         note to sign — keeps the board's keys away: Escape and Tab are its own */
      if (topLayer()?.modal) return;
      /* the panels have had their Escape already (the table's spike hears
         it first, and closes the top one only): what reaches here is for
         the board. The orders shown on the board close first. */
      if (e.key === 'Escape' && (useGame.getState().previewQueue || useGame.getState().surveySeat !== null)) {
        e.preventDefault();
        setPreviewQueue(false);
        setSurveySeat(null);
        return;
      }
      if (!game || passTo) return;
      /* the analysis is a place of its own, and no key leaves it: only its
         close button and the way out at the foot of the panel do. Its own
         key, Escape and the two keys that read the board while a game runs
         do nothing here — they have nothing to say to a game already read */
      if ((review || debriefOpen) && (isKey(e, 'analysis') || e.key === 'Escape' || isKey(e, 'survey') || isKey(e, 'lastMove'))) {
        e.preventDefault();
        return;
      }
      if (isKey(e, 'analysis')) {
        if (readable(game)) setDebriefOpen(true);
        return;
      }
      if (e.key === 'Escape') {
        /* the finished board, looked at: Escape puts the final ledger back up */
        if (game.phase === 'game-over' && !useGame.getState().gameOverOpen) {
          useGame.getState().openGameOver();
          return;
        }
        cancel();
        setSpotlight(null);
        return;
      }
      if (isKey(e, 'rules')) {
        setRulesOpen(true);
        return;
      }
      if (isKey(e, 'settings')) {
        /* S toggles the settings panel; the spike sends away whatever held the left edge */
        setBoardOption('settingsOpen', !getBoardOptions().settingsOpen);
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
        if (ledgerOpen) closeLedger();
        else setLedgerOpen(true);
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
        /* Enter on a button, a tab or a link belongs to that control */
        if (onControl(e)) return;
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
  }, [game, mySeat, spectating, passTo, isHumanTurn, ledgerOpen, closeLedger, verb, buildPick, linkPick, secondLinkPick, sellPick, developPick, scoutPick, selectedCardId, review, debriefOpen, leaveReview, cancel, confirm, selectCard, setRulesOpen, setMarketFocus, setSpotlight]);

  /* ---------------------- planning targets ---------------------- */
  const selectedCard = useMemo(() => {
    if (!game || !selectedCardId || mySeat < 0) return null;
    return game.players[mySeat].hand.find((c) => c.id === selectedCardId) ?? null;
  }, [game, mySeat, selectedCardId]);

  /* the plan is made for the acting human, or for me while preparing a move out of turn */
  const targets = useMemo(
    () => (planGame && planActor >= 0 && verb === 'build' && selectedCard ? buildTargets(planGame, planActor, selectedCard) : NO_TARGETS),
    [planGame, planActor, verb, selectedCard],
  );
  /* the links as the board may take them: on their own until a first is
     picked in the rail era, then every other free rail read as the
     double's second — touching the network, or the first's own ends —
     with the double's price and the engine's reason when it cannot be */
  const linkTargetsList = useMemo(() => {
    if (!planGame || planActor < 0 || verb !== 'network') return NO_LINKS;
    const list = linkTargets(planGame, planActor);
    if (!linkPick || planGame.era !== 'rail') return list;
    /* the first as it will be laid: with the mine named for its coal, whose
       cubes the second then cannot count on */
    const first = withLinkCoal(planGame, planActor, linkPick, linkCoal[0]);
    return list.map((t) => {
      if (t.link.id === linkPick.link.id) return t;
      const dbl = doubleLinkPlan(planGame, planActor, first, t.link, linkBeer, t.link.id === secondLinkPick?.link.id ? linkCoal[1] : null);
      return { ...t, valid: dbl.valid, reason: dbl.reason, total: dbl.total, coalPlan: dbl.coal2 };
    });
  }, [planGame, planActor, verb, linkPick, secondLinkPick, linkBeer, linkCoal]);
  const sellTargetsList = useMemo(
    () => (planGame && planActor >= 0 && verb === 'sell' ? sellTargets(planGame, planActor) : NO_SALES),
    [planGame, planActor, verb],
  );
  /* my turn has come: a prepared move plays after a beat, if the engine still takes it */
  useEffect(() => {
    if (!myTurn || !queuedCount) return;
    const id = window.setTimeout(() => useGame.getState().playQueued(), 1000);
    return () => window.clearTimeout(id);
  }, [myTurn, queuedCount, game?.actionsLeft]);

  /* what the plan trades with the exchange, and where a sale on the spot
     leaves from: read with the mines and the works the player named, as
     the confirmation prices it, so a named mine never opens the tray for
     coal the move will not buy */
  const ghost: PlanGhost | null = useMemo(() => {
    if (!planGame || planActor < 0) return null;
    if (verb === 'build') {
      /* a works that would sell to the market the moment it is built sends
         its cubes the other way: the ghost carries that too */
      const withSale = (t: BuildTarget): PlanGhost => {
        const g = ghostFromPlan(slotXY(t.town, t.slot), t.coalPlan, t.ironPlan);
        const sale = marketSaleOnBuild(planGame, t.town, t.industry, t.level);
        return sale.sold ? { ...g, sale: { resource: t.industry, amount: sale.sold, gain: sale.earned } } : g;
      };
      if (buildPick?.valid) return withSale(withIron(planGame, planActor, withCoal(planGame, planActor, buildPick, buildCoal), buildIron));
      const t = hoverKey ? targets.find((x) => tileKey(x.town, x.slot) === hoverKey && x.valid) : null;
      if (t) return withSale(t);
    }
    if (verb === 'network') {
      const mid = (t: LinkTarget) => routeFor(t.link, planGame.era).mid;
      if (linkPick?.valid) {
        const first = withLinkCoal(planGame, planActor, linkPick, linkCoal[0]);
        if (secondLinkPick && planGame.era === 'rail') {
          /* a double rail buys for both links: the first's coal, then the
             second's with the first's cubes already spoken for */
          const dbl = doubleLinkPlan(planGame, planActor, first, secondLinkPick.link, linkBeer, linkCoal[1]);
          return ghostFromPlan(mid(secondLinkPick), first.coalPlan, dbl.coal2);
        }
        /* the coal line lands mid-route, on the route of this era: a rail
           does not follow the canal's winding path */
        return first.coalPlan.sources.length ? ghostFromPlan(mid(first), first.coalPlan) : null;
      }
      const t = hoverKey ? linkTargetsList.find((x) => x.link.id === hoverKey && x.valid) : null;
      if (t?.coalPlan.sources.length) return ghostFromPlan(mid(t), t.coalPlan);
    }
    if (verb === 'develop' && developPick.length) {
      /* iron ships from any works on the board, or the exchange: mark where
         this development would take it from */
      const plans = developPlans(planGame, developIron);
      if (plans.length) return { ...ghostFromPlan([0, 0], ...plans), noTarget: true };
    }
    return null;
  }, [planGame, planActor, verb, buildPick, buildCoal, buildIron, linkPick, secondLinkPick, linkCoal, linkBeer, developPick, developIron, hoverKey, targets, linkTargetsList]);

  const consumePreview = useMemo(() => {
    const out: Partial<Record<Resource, number>> = {};
    for (const m of ghost?.market ?? []) out[m.resource as Resource] = (out[m.resource as Resource] ?? 0) + m.amount;
    return out;
  }, [ghost]);
  /* the tray opens whenever the plan trades with the exchange: buying
     coal or iron, or a mine/works selling its output on the spot */
  const drawsFromMarket = (consumePreview.coal ?? 0) > 0 || (consumePreview.iron ?? 0) > 0 || !!ghost?.sale;
  const closeMarket = useCallback(() => {
    setMarketOpen(false);
    setMarketFocus(false);
  }, [setMarketFocus]);
  /* the tray shares the right edge with the ledger; opened by the plan
     rather than by the reader, it leaves the keyboard where it was */
  const marketSheet = useLayer<HTMLElement>(marketOpen, closeMarket, { zone: 'right', focus: !drawsFromMarket });
  /* the two sheets that hold the whole table: the pass of the device is
     answered by its button only, the loan by one of its two */
  const passSheet = useLayer(!!passTo, holdOn, { modal: true });
  const loanSheet = useLayer(loanConfirm, () => setLoanConfirm(false), { modal: true });
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

  /* read up to: the drawer's last closing, or the reader's own last move —
     one walk of the ledger per new entry, not one per pointer move */
  const ledger = game?.ledger;
  const { seenIdx, unread } = useMemo(() => {
    if (!ledger) return { seenIdx: 0, unread: 0 };
    const lastMine = ledger.reduce((acc, e, i) => (e.player === mySeat ? i + 1 : acc), 0);
    const seen = Math.max(ledgerRead, lastMine);
    return { seenIdx: seen, unread: ledger.slice(seen).filter((e) => e.player !== undefined && e.player !== mySeat).length };
  }, [ledger, mySeat, ledgerRead]);
  const toggleLedger = useCallback(() => {
    if (ledgerOpen) closeLedger();
    else setLedgerOpen(true);
  }, [ledgerOpen, closeLedger]);
  const toggleSkip = useCallback(() => setSkipAnim((v) => !v), []);
  /* the tools under the players, as one element that only changes when
     what it shows does: the rail is memoised, and a new element each
     render would undo that */
  const tools = useMemo(() => <TableTools skipAnim={skipAnim} onSkip={toggleSkip} ledgerOpen={ledgerOpen} unread={unread} onLedger={toggleLedger} />, [skipAnim, toggleSkip, ledgerOpen, unread, toggleLedger]);

  if (!game) {
    /* the office would not hand the game over: the plate says why, in
       place of a table that is never going to be set */
    if (homeTrouble && !tableCode) return <HomeMissPlate trouble={homeTrouble} local={titleLocal} />;
    return <TitleCard stage="reading" game={null} code={titleCode} local={titleLocal} />;
  }

  /* the guide's lane down the right edge: a rail when folded (key G) */
  /* the board's own lane: beside the guide while a lesson runs, and beside
     the analysis while a game is read again — never under either */
  const dock = analysisPane || (tutorial && wide ? (boardOpts.guideFolded ? GUIDE_RAIL : guideDock()) : 0);

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
      <div ref={boardHost} className="absolute inset-0">
        <Suspense fallback={<div className="flex h-full items-center justify-center font-fell text-brass-400">{t('game.page.loadingGl')}</div>}>
          <PixiBoard
            game={review?.state ?? finalBoard ?? game}
            targets={review ? NO_TARGETS : targets}
            linkTargetsList={review ? NO_LINKS : linkTargetsList}
            sellTargetsList={review ? NO_SALES : sellTargetsList}
            ghost={review ? null : ghost}
            onInvalid={reject}
            preview={preview}
            keyboard={!review}
          />
        </Suspense>
      </div>

      {/* ------- floating HUD (panels: coal-900/80–85 + backdrop-blur) ------- */}
      {/* the orders shown on the board: the whole HUD steps aside, the ribbon alone stays */}
      {!surveying && <EdgeTracks />}
      {!surveying && !review && <GameTopBar candle={candle} marketOpen={marketOpen} />}
      {!surveying && <PlayerRail tools={tools} />}

      {/* the exchange: the quotation strip is always there at the top right;
          the full tray hangs right under it when asked, whole, no scrolling,
          and the banner never moves for it (it keeps clear of the tray's
          column by itself) */}
      {!surveying && <MarketPill market={(review?.state ?? game).market} consume={consumePreview ?? {}} top={insets.top} bottom={review ? insets.bottom + 8 : undefined} left={review ? insets.left : undefined} open={marketOpen} onToggle={() => setMarketOpen((o) => !o)} />}
      <AnimatePresence initial={false}>
        {marketOpen && (
          <motion.aside
            key="market-panel"
            initial={{ y: review ? 28 : -28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: review ? 28 : -28, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={cn('fixed z-[82] w-[min(320px,88vw)]', !review && 'right-3')}
            style={review ? { bottom: insets.bottom + 52, left: insets.left } : { top: insets.top + 48 }}
            ref={marketSheet}
            tabIndex={-1}
            data-market
            aria-label={t('game.page.marketPanelAria')}
          >
            <div className="plaque relative rounded-lg [&>.plate]:border-0 [&>.plate]:bg-transparent [&>.plate]:shadow-none">
              <MarketTray consumePreview={consumePreview} />
              <button
                type="button"
                onClick={closeMarket}
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
            className="fixed bottom-0 top-0 z-[66] w-[min(360px,92vw)] p-3"
            style={{ right: analysisPane }}
            ref={ledgerSheet}
            tabIndex={-1}
            aria-label={t('game.page.ledgerDrawerAria')}
          >
            <div className="relative h-full rounded-lg border border-brass-700/60 bg-coal-900/85 shadow-e4 backdrop-blur-md [&>.plate]:h-full [&>.plate]:border-0 [&>.plate]:bg-transparent [&>.plate]:shadow-none">
              <Ledger seen={seenIdx} />
              <button
                type="button"
                onClick={closeLedger}
                aria-label={t('game.page.closeLedger')}
                className="absolute right-2 top-2 z-10 rounded p-1 text-cream-100/50 hover:bg-coal-800 hover:text-cream-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* a game played out has no hand to hold: its foot is the final ledger's strip */}
      {!surveying && !review && game.phase !== 'game-over' && (spectating ? <SpectatorStrip /> : <HandDock />)}
      {/* reading a game again: the hand the move was chosen from, where the
          player's own hand sits while the game runs */}
      {review && <ReviewHand />}
      <ConcedeBanner />
      <TableMood />
      {!surveying && !gameOverOpen && !ceremony && <Notices />}
      {!surveying && !review && <CoachChip />}
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

      {/* at home, the office and the board fell out: play waits, frozen,
          until the board is read back from the office's log — then a word
          on what was read, for the reader to put away */}
      {!tableCode && homeTrouble && !homeTrouble.mended && <HomeFrozen trouble={homeTrouble} local={titleLocal} />}
      {!tableCode && homeTrouble?.mended && <HomeMended trouble={homeTrouble} />}

      {/* hot-seat pass interstitial — fully opaque: the board and every hand
          stay hidden until the next human claims the device */}
      <AnimatePresence>
        {passTo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[78] flex items-center justify-center bg-coal-950"
            ref={passSheet}
            tabIndex={-1}
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
            ref={loanSheet}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
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

      <Ceremony ready={boardStage === 'ready'} />
      <GameOverModal
        fresh={openedOver?.over === false}
        ready={boardStage === 'ready'}
        onRematch={() => {
          /* the rematch is dealt for the table just played, not the salon's last one */
          if (game && !tableCode) keepTableOf(game);
          reset();
        }}
      />
      <RulesOverlay />
      <CoachMarks />
      </div>

      {/* the guide's own lane, beside the table rather than over it */}
      {/* the review's plate: which moment of the game the board shows — the
          panel carries it at its foot when it is open */}
      {review && !debriefOpen && (
        <div className="pointer-events-none fixed z-[66] flex justify-start" style={{ bottom: insets.bottom + 8, left: insets.left }}>
          <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-brass-400/70 bg-coal-950/95 px-3 py-1.5 shadow-e3">
            <span className="font-fell text-[12.5px] text-cream-100">{review.label ?? t('game.debrief.banner', { round: review.round })}</span>
            <button type="button" onClick={leaveReview} className="btn-ledger !min-h-[26px] !px-2.5 !py-0.5 text-[11px]">
              {t('game.debrief.back')}
            </button>
          </div>
        </div>
      )}
      {/* the finished board, looked at: the final ledger lowered to a strip */}
      {game.phase === 'game-over' && !gameOverOpen && !debriefOpen && !review && (
        <div className="pointer-events-none fixed inset-x-0 z-[66] flex justify-center px-4" style={{ bottom: insets.bottom + 12 }}>
          <div role="status" className="plaque pointer-events-auto flex items-center gap-4 rounded-lg px-4 py-2">
            <span className="font-fell text-[14px] text-cream-100">
              {game.abandoned || game.winner === undefined ? t('game.scoring.abandonedTitle') : t('game.scoring.strip', { name: game.players[game.winner].name, vp: game.players[game.winner].vp })}
            </span>
            <button type="button" onClick={() => useGame.getState().openGameOver()} aria-keyshortcuts="Escape" className="btn-ledger !min-h-[30px] !px-3 !py-1 text-[11px]">
              {t('game.scoring.backToLedger')}
            </button>
          </div>
        </div>
      )}
      {/* the analysis is the one panel that reads a whole game at once: a
          throw in it used to take the board with it, and the game with the
          board. It takes only itself now, and the way out closes it */}
      {debriefOpen && readable(game) && reviewSeat >= 0 && (
        <Boundary onQuit={leaveReview} quitLabel={t('game.debrief.close')}>
          <Debrief key={`${reviewTable}:${game.seed}`} game={game} me={reviewSeat} />
        </Boundary>
      )}
      {/* the guide and the analysis share the right lane: while a game is
          being read, the analysis has it */}
      {!analysisPane && <Guide dock={dock} />}
      {tutorial && <LessonHalo />}

      {/* the title card over the whole table while the board is set; it
          lifts once the map is engraved */}
      <TitleCard stage={boardStage} game={game} code={titleCode} local={titleLocal} />
    </div>
  );
}

/** the plate's buttons: one size for every road out of a quarrel with the office */
const TROUBLE_BTN = 'btn-ledger !min-h-[36px] !px-4 !py-1.5 text-xs';

/** the cause of a trouble at home as the sheets say it, the move counted
    from one — a refusal without its move is only the wait for the office */
function troubleText(t: ReturnType<typeof useT>, trouble: HomeTrouble): string {
  if (trouble.cause === 'refused') return trouble.at !== undefined ? t('game.homeTrouble.refused', { move: trouble.at + 1 }) : t('game.homeTrouble.waiting');
  if (trouble.cause === 'offline') return t('game.homeTrouble.waiting');
  return t(`game.homeTrouble.${trouble.cause}`);
}

/** the game at home the office would not hand over: the cause named, and
    the roads left — asking again when the line is down, the desk always */
function HomeMissPlate({ trouble, local }: { trouble: HomeTrouble; local: string | null }) {
  const t = useT();
  const retryHome = useGame((s) => s.retryHome);
  /* a refusal cannot leave the board empty: whatever else it is, the
     office is not answering */
  const cause = trouble.cause === 'absent' || trouble.cause === 'unreplayable' ? trouble.cause : 'offline';
  return (
    <TroubleCard game={null} code={null} local={local}>
      <div role="alert">
        <p className="font-sans text-sm leading-relaxed text-cream-100/85">{t(`game.homeTrouble.${cause}`)}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link to="/desk" className={TROUBLE_BTN}>
            {t('game.homeTrouble.leave')}
          </Link>
          {cause === 'offline' && (
            <button type="button" autoFocus onClick={retryHome} className={TROUBLE_BTN}>
              {t('game.homeTrouble.retry')}
            </button>
          )}
        </div>
      </div>
    </TroubleCard>
  );
}

/** the board at home stands frozen while it waits on the office: the
    store already refuses every move, the veil says why. It comes in late,
    so a refusal read back at once only ever shows as the notice after it */
function HomeFrozen({ trouble, local }: { trouble: HomeTrouble; local: string | null }) {
  const t = useT();
  const retryHome = useGame((s) => s.retryHome);
  const game = useGame((s) => s.game);
  const sheet = useLayer(true, holdOn, { modal: true });
  const said = useId();
  const waiting = trouble.cause === 'refused' || trouble.cause === 'offline';
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.25 }}
      ref={sheet}
      tabIndex={-1}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={said}
      className="fixed inset-0 z-[79] flex items-center justify-center bg-coal-950/60 p-4 backdrop-blur-[2px]"
    >
      <TitlePlate game={game} code={null} local={local} kicker={t('game.titre.troubleKicker')} tone="rust">
        <p id={said} className="font-sans text-sm leading-relaxed text-cream-100/85">
          {troubleText(t, trouble)}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link to="/desk" className={TROUBLE_BTN}>
            {t('game.homeTrouble.leave')}
          </Link>
          {waiting && (
            <button type="button" onClick={retryHome} className={TROUBLE_BTN}>
              {t('game.homeTrouble.retry')}
            </button>
          )}
        </div>
      </TitlePlate>
    </motion.div>
  );
}

/** the board has been read back from the office's log: what changed, said
    once, for the reader to put away */
function HomeMended({ trouble }: { trouble: HomeTrouble }) {
  const t = useT();
  const dismiss = useGame((s) => s.dismissHomeTrouble);
  const insets = useHudInsets();
  const text = trouble.cause === 'refused' && trouble.at !== undefined ? t('game.homeTrouble.mendedRefused', { move: trouble.at + 1 }) : t('game.homeTrouble.mendedOffline');
  return (
    <div role="status" className="pointer-events-auto fixed left-1/2 z-[64] flex w-max max-w-[min(560px,calc(100vw-32px))] -translate-x-1/2 items-center gap-3 rounded-md border border-brass-700/60 bg-coal-950/95 px-4 py-2 shadow-e3" style={{ top: insets.top + 44 }}>
      <p className="font-sans text-xs leading-snug text-cream-100/85">{text}</p>
      <button type="button" onClick={dismiss} className={cn(TROUBLE_BTN, 'shrink-0')}>
        {t('game.homeTrouble.dismiss')}
      </button>
    </div>
  );
}

/** the coach's word on the move just played, behind the beginner's aid at a
    home table: what it cost in chance, and what read better — after the
    move, never before */
function CoachChip() {
  const t = useT();
  const coached = useGame((s) => s.coached);
  const setCoached = useGame((s) => s.setCoached);
  const insets = useHudInsets();
  if (!coached) return null;
  const v = coached.verdict;
  const better = v.roads[0];
  const lost = Math.round(v.loss * 100);
  const fine = v.grade === 'top' || v.grade === 'good';
  return (
    <div className="pointer-events-auto fixed left-1/2 z-[63] flex -translate-x-1/2 items-center gap-2 rounded-md border bg-coal-950/95 px-3 py-1.5 shadow-e3" style={{ top: insets.top + 44, borderColor: fine ? 'rgba(201,164,92,.5)' : 'rgba(180,71,46,.6)' }} role="status">
      <span className={cn('font-fell text-[10px] uppercase tracking-[0.18em]', fine ? 'text-brass-300' : v.grade === 'blunder' ? 'text-rust-400' : 'text-copper-500')}>{t(`game.debrief.quality.${v.grade}`)}</span>
      {lost > 0 && <span className="font-mono text-[11px] text-cream-100/80">−{lost} %</span>}
      {!fine && better && <span className="font-sans text-[11.5px] text-cream-100/85">{t('game.coachChip.better', { move: describeAction(better.action) })}</span>}
      {fine && <span className="font-sans text-[11.5px] text-cream-100/70">{t('game.coachChip.fine')}</span>}
      <button type="button" onClick={() => setCoached(null)} aria-label={t('game.coachChip.close')} className="ml-1 text-cream-100/50 hover:text-cream-100">×</button>
    </div>
  );
}

/** the tools under the players: the bots' pace while they play, then the
    wire, the notebook, a question, settings, ideas, the table and the
    ledger — the ledger counts what others did since the reader last looked.
    Nothing at the right edge, where the exchange unfolds. */
function TableTools({ skipAnim, onSkip, ledgerOpen, unread, onLedger }: { skipAnim: boolean; onSkip: () => void; ledgerOpen: boolean; unread: number; onLedger: () => void }) {
  const t = useT();
  const seat = useGame((s) => s.seat);
  const acting = useGame((s) => (s.game && s.game.phase === 'action' ? (s.game.players[s.game.current].isBot ? 'bot' : 'human') : null));
  const ceremony = useGame((s) => s.ceremony);
  const botHold = useGame((s) => s.botHold);
  const setBotHold = useGame((s) => s.setBotHold);
  const settingsOpen = useBoardOptions().settingsOpen;
  /* the skip chip is a local courtesy: online the table sets the pace */
  const botThinking = seat === null && acting === 'bot' && !ceremony;
  return (
    <>
      {/* hold the machines where they stand (a standing switch at a home
          table, not only while one thinks): time to look, or to prepare a move */}
      {seat === null && acting !== null && (
        <button type="button" onClick={() => setBotHold(!botHold)} aria-pressed={botHold} title={t(botHold ? 'game.page.resumeBots' : 'game.page.holdBots')} aria-label={t(botHold ? 'game.page.resumeBots' : 'game.page.holdBots')} className={cn(TOOL, botHold && '!border-brass-400 bg-brass-500/20 !opacity-100')}>
          {botHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
      )}
      {botThinking && (
        <button type="button" onClick={onSkip} aria-pressed={skipAnim} title={skipAnim ? t('game.page.botsBrisk') : t('game.page.skipBots')} aria-label={skipAnim ? t('game.page.botsBrisk') : t('game.page.skipBots')} className={cn(TOOL, skipAnim && '!border-brass-400 bg-brass-500/20 !opacity-100')}>
          <FastForward className="h-4 w-4" />
        </button>
      )}
      <TelegramButton className={TOOL} />
      <NotebookButton className={TOOL} />
      <AskGuide className={TOOL} />
      {/* the settings take the left edge; the spike sends away what held it */}
      <button type="button" onClick={() => setBoardOption('settingsOpen', !settingsOpen)} aria-pressed={settingsOpen} aria-label={t('board.options.settingsAria')} title={t('game.page.settingsChip')} className={TOOL}>
        <Settings2 className="h-4 w-4" />
      </button>
      <FeedbackButton compact className={TOOL} />
      <TableMenu compact className={TOOL} />
      <button type="button" data-lens="ledger" onClick={onLedger} aria-pressed={ledgerOpen} title={`${t('game.page.ledgerChip')} (L)`} aria-label={t('game.page.ledgerChip')} className={cn(TOOL, ledgerOpen && '!border-brass-400 !opacity-100')}>
        <ScrollText className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 rounded-full bg-brass-400 px-1.5 font-mono text-[9px] font-bold leading-[14px] text-coal-950" aria-label={t('game.ledger.newAria', { n: unread })}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </>
  );
}
