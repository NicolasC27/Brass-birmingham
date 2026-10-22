/* ------------------------------------------------------------------ */
/* BRASSWORKS — zustand store: game state + interaction selection.     */
/* Pure reducers live in engine.ts; this store is the single seam the  */
/* UI consumes (and a future backend can replace).                     */
/* ------------------------------------------------------------------ */

import { create } from 'zustand';
import { actionsFor, beerShort, beginRailEra, newGame, buildTargets, canLoan, canScout, developOptions, developTwice, doubleLinkPlan, linkTargets, marketSaleOnBuild, planIronFrom, salesThatStand, scoreEra, sellTargets, tileKey, withCoal, withIron, withLinkCoal } from './engine';
import type { BuildTarget, LinkTarget, SellTarget, SupplyPlan } from './engine';
import { chooseBotAction, isExpert } from './search';
import { readForm, recordForm } from './form';
import { reasonText, tr } from '@/i18n';
import { actorOf, applyAction, canUndoNow, fallbackAction, humanActionIndices, setupOf, undoLastHuman, withEdition } from './actions';
import type { UndoMark } from './actions';
import type { GameAction } from './actions';
import { INDUSTRIES, LINKS, MERCHANT_BY_ID, TOWN_BY_ID, incomeLevel, setBoard } from './data';
import { onlineWire } from '@/online/net';
import { DIALECT, PING_SHOWER, PING_SHOWN_MS, PING_WINDOW_MS, TELEGRAM_COOLDOWN_MS, TELEGRAM_SHOWN_MS, isTelegramKey } from './telegrams';
import type { Ping, Telegram, TelegramKey } from './telegrams';
import type { Pause, Rollback, ServerMessage } from '@/online/protocol';
import type { Wire, WireStatus } from '@/online/wire';
import type {
  Card,
  FinalPayload,
  GameState,
  IndustryType,
  Verb,
  LedgerEntry,
} from './types';

import { ledgerText } from './ledgerText';
import { TUTORIAL_KEY, guidedTable } from './quickplay';
import { cloneState } from './clone';
import { forkHomeGame, openHomeGame, readHomeSave, recordMove, recordUndo } from './home';
import type { HomeMiss, Recorded } from './home';
import { normalizeCode } from '@/online/table';
import { readNotes, writeNotes } from '@/platform/notes';
import { challengeSeedFor, noteChallenge } from './challenge';
import { grantFromGame } from '@/platform/patents';
import { writeLetter } from '@/platform/letters';
import { noteFeuilleton } from '@/platform/feuilleton';
import { noteLines } from '@/platform/lines';
import { readShared, sharedMoment } from './share';
import { coachMove, hushCoach } from './coach';
import type { Coached } from './coach';
import { aidOn } from '@/components/game/boardOptions';
import { deedOf } from '@/components/game/lessons';
import { whyNoBuild, whyNoLink, whyNoSale } from './refusals';
import type { JudgeId } from './analysis';

export interface Shake {
  key: string;
  reason: string;
  at: number;
}

/** what went wrong between a game at home and the office that keeps it */
export interface HomeTrouble {
  /** refused: the office turned a move down, the two logs have drifted
   *  apart; offline: the office did not answer; absent: it holds no such
   *  game any more; unreplayable: its log will not replay under this build */
  cause: 'refused' | HomeMiss;
  /** for a refusal: the place in the log of the move turned down */
  at?: number;
  /** for a refusal: the office's own words */
  error?: string;
  /** the board has been read back from the office's log: play goes on from
   *  where the office stands, and the notice only remains to be read */
  mended: boolean;
}

interface GameStore {
  game: GameState | null;
  /* ---- the table, when the game is played over the wire ---- */
  /** the online table's code, null when the game is played in this browser */
  code: string | null;
  /** the code of the game at home the office holds, null online */
  local: string | null;
  /** the office gave the game a code the address did not name (a game carried
   *  in a link, a rematch): the page moves there. Null the rest of the time */
  movedTo: string | null;
  /** my seat at that table (the engine's player index), null offline */
  seat: number | null;
  /** the state of the line, null offline */
  line: WireStatus | null;
  /** what the server says about taking the last action back */
  serverUndo: boolean;
  /** a game at home the office would not follow — a move it turned down,
   *  a line gone quiet, a log it cannot hand back. Play stands frozen until
   *  the board has been read back from the office (`mended`); what is left
   *  after that is a notice for the reader to dismiss */
  homeTrouble: HomeTrouble | null;
  /** the notice put away, once the board has been read back */
  dismissHomeTrouble: () => void;
  /** ask the office again for the game at home it would not hand over */
  retryHome: () => void;
  /** the turn candle as the table last reported it, anchored to this clock
   *  so the two need not agree on the time of day */
  candle: { msLeft: number; at: number } | null;
  /** the table's mood, as the server last sent it: pauses, breaks, a rollback on the table */
  mood: { pause: Pause | null; breaks: number[]; rollback: Rollback | null; frozen: boolean; host: number };
  /* ---- selection ---- */
  selectedCardId: string | null;
  verb: Verb | null;
  buildPick: BuildTarget | null;
  linkPick: LinkTarget | null;
  secondLinkPick: LinkTarget | null;
  /** last tile picked for sale (board pulse) */
  sellPick: SellTarget | null;
  /** every tile queued for this Sell action — one card sells any number */
  sellPicks: SellTarget[];
  developPick: IndustryType[];
  /** per pick, the iron works chosen (its key), 'market', or null for the engine's choice */
  developIron: (string | null)[];
  /** the iron works a build draws from (its key), 'market', or null for the engine's nearest */
  buildIron: string | null;
  /** per cube of coal a build burns, the mine named (its key) among the
   *  nearest connected ones, or null for the engine's choice */
  buildCoal: (string | null)[];
  /** at the rail, the mine each link burns its cube from: the first link's,
   *  then the second's; null for the engine's choice */
  linkCoal: (string | null)[];
  /** the brewery a double rail drinks from (its key), or null for the engine's choice */
  linkBeer: string | null;
  /** per picked sale (by tile key), the beer named for each barrel it needs */
  sellBeer: Record<string, (string | null)[]>;
  scoutPick: string[];
  hoverKey: string | null;
  shake: Shake | null;
  /* ---- telegrams: the printed lines wired across the table ---- */
  telegrams: Telegram[];
  /** seats the reader no longer hears */
  mutedSeats: number[];
  telegramSentAt: number;
  /** wire a line to the table (false: too soon, or nothing to wire to) */
  sendTelegram: (key: TelegramKey) => boolean;
  /** a line arrived from a seat: shown for a while, unless that seat is muted */
  receiveTelegram: (from: number, key: string) => void;
  muteSeat: (seat: number, on: boolean) => void;
  /* ---- pings: "look here" on a town, a house or a route ---- */
  pings: Ping[];
  /** my marks of the last while, and the office's frown: a warning, then silence */
  myMarks: number[];
  markStrikes: number;
  markWarning: 'warned' | 'muted' | null;
  sendPing: (key: string) => boolean;
  dismissMarkWarning: () => void;
  receivePing: (from: number, key: string) => void;
  /* ---- prepared moves: planned while others play, played when my turn comes ---- */
  /** the reader is planning a move out of turn */
  preparing: boolean;
  /** what is ready for my next turn, in order (two at most) */
  queued: Prepared[];
  /** a condition on a prepared move: it is dropped if that player did that since */
  setUnless: (index: number, unless: Unless | null) => void;
  /** a condition's place being picked on the map, for that prepared move */
  unlessPick: number | null;
  beginUnlessPick: (index: number | null) => void;
  /** a town (and a slot) clicked on the map while picking: the place, and the works when the slot takes one */
  applyUnlessPick: (town: string, slot: number | null) => void;
  /** the board shows the prepared moves in colour over a sepia table */
  previewQueue: boolean;
  setPreviewQueue: (on: boolean) => void;
  /** the survey of another seat: their empire and their last move */
  surveySeat: number | null;
  /** the other seats whose links a survey also paints */
  surveyEmpires: number[];
  toggleSurveyEmpire: (seat: number) => void;
  /** another seat just played: their move shown the survey's way for a moment */
  glimpse: { seat: number; at: number } | null;
  setGlimpse: (g: { seat: number; at: number } | null) => void;
  /** each seat's line to the office, in ms (null: a machine, or nobody there) */
  latency: (number | null)[];
  /** the next seat but mine (or none after the last) */
  cycleSurveySeat: () => void;
  setSurveySeat: (seat: number | null) => void;
  setPreparing: (on: boolean) => void;
  dropQueued: (index: number) => void;
  /** my turn has come: the first prepared move plays if the engine still takes it */
  playQueued: () => void;
  /** the seat a plan is made for right now: the current human, or mine
   *  while preparing; -1 when nothing may be planned */
  planActor: () => number;
  /** the table a plan is made on: the real one, or, while preparing with
   *  moves already queued, the table as it will be once they have played */
  planGame: () => GameState | null;
  /* ---- pins: towns the reader watches, each with a note of their own ---- */
  pins: Record<string, string>;
  /** the page kept beside this game — the notebook's, one per table */
  notebook: string;
  setNotebook: (text: string) => void;
  /** pin a town (with an empty note) or drop the pin */
  pinTown: (town: string, on: boolean) => void;
  setPinNote: (town: string, note: string) => void;
  /* ---- the toast once the game is over: seats that raised a glass ---- */
  toasts: number[];
  /** raise mine; at home the machines follow after a beat */
  sendToast: () => boolean;
  loanConfirm: boolean;
  /** hovering the Loan chip → ghost pawn on the income track */
  loanPeek: boolean;
  rulesOpen: boolean;
  /** player whose mat (remaining tiles) is open, null = closed */
  matPlayer: number | null;
  /** a tile's sheet has been opened on a mat at this table: the guide's
   *  lesson on reading a tile asks for that gesture */
  sheetOpened: boolean;
  noteSheet: () => void;
  marketFocus: boolean;
  /** everything, one player's doings (`p<seat>`), the money or the map */
  ledgerFilter: 'all' | 'economy' | 'network' | `p${number}`;
  /** camera fly-to request (Ledger click, bot follow) — `at` dedupes repeats */
  flyTo: { key: string; at: number } | null;
  /** camera glides to wherever a bot just played */
  followBots: boolean;
  /** player index highlighted on the map (others dimmed), null = off */
  spotlight: number | null;
  /** what the guide's lesson lights on the table: slots of the map, a part of the HUD */
  lens: Lens | null;
  setLens: (lens: Lens | null) => void;
  /* ---- the debrief: the game read again once over, a moment of it on the board ---- */
  debriefOpen: boolean;
  setDebriefOpen: (open: boolean) => void;
  review: Review | null;
  setReview: (review: Review | null) => void;
  /** a player rail chip under the pointer: their whole network lights up */
  netPeek: number | null;
  setNetPeek: (i: number | null) => void;
  coachStep: number; // -1 hidden
  /** this game is the guided one: the guide's steps show */
  tutorial: boolean;
  /** the guided game's lessons are left, and its lane stays for the rest of
   *  the game: the thread, the machine's reasons and the questions */
  guideLane: boolean;
  /** the guide is done with: the game goes on as a plain one, beside the
   *  lane the guide leaves */
  endTutorial: () => void;
  /** the guide holds the machine: it explains one move before the next is played */
  botHold: boolean;
  setBotHold: (on: boolean) => void;
  ceremony: 'canal-end' | null;
  gameOverOpen: boolean;

  /* ---- lifecycle ---- */
  /** `code` names an online table; `local` a game of this device's register
   *  (without either, a new one is opened there) */
  init: (code?: string, local?: string) => void;
  /** the preview's taste of the game: a table dealt here and played here,
   *  against two machines, never written to the office */
  startDemo: (seed?: number) => void;
  /** is the seat to act mine? (always, when the game is played here) */
  myTurn: () => boolean;
  /** the player whose hand this screen shows */
  mySeat: () => number;
  /** watching an online table from no seat: every hand shut, nothing to play */
  spectating: () => boolean;
  /** what is left of the turn candle right now, in ms (null: none burns) */
  msLeft: () => number | null;
  reset: () => void;
  /** one move written to the office's log, at its place in it */
  record: (action: GameAction, at: number) => void;

  /* ---- interaction ---- */
  selectCard: (id: string | null) => void;
  setVerb: (v: Verb | null) => void;
  pickBuild: (t: BuildTarget | null) => void;
  pickLink: (t: LinkTarget | null) => void;
  pickSell: (t: SellTarget | null) => void;
  toggleDevelop: (ind: IndustryType) => void;
  /** one more or one fewer development of this industry */
  addDevelop: (ind: IndustryType) => void;
  dropDevelop: (ind: IndustryType) => void;
  setDevelopIron: (k: number, from: string | null) => void;
  setBuildIron: (from: string | null) => void;
  /** the mine the `k`-th cube of coal of a build is drawn from */
  setBuildCoal: (k: number, from: string | null) => void;
  /** the mine the `k`-th rail link (0 the first, 1 the second) burns its cube from */
  setLinkCoal: (k: number, from: string | null) => void;
  setLinkBeer: (from: string | null) => void;
  /** sell the picked tile to another merchant that takes it */
  setSellMerchant: (key: string, merchant: string) => void;
  setSellBeer: (key: string, k: number, from: string | null) => void;
  toggleScout: (cardId: string) => void;
  setHover: (key: string | null) => void;
  reject: (key: string, reason: string) => void;
  cancel: () => void;
  confirm: () => void;
  /** apply one action of the log for the player to act; false = refused */
  dispatch: (action: GameAction) => boolean;
  /** the log's actions taken by humans (undo points) */
  humanMarks: UndoMark[];
  /** may the player to act take back the action they just took? */
  canUndo: () => boolean;
  /** back to before that action */
  undo: () => boolean;
  setLoanConfirm: (open: boolean) => void;
  setLoanPeek: (on: boolean) => void;
  setRulesOpen: (open: boolean) => void;
  openMat: (i: number) => void;
  closeMat: () => void;
  setMarketFocus: (on: boolean) => void;
  setLedgerFilter: (f: GameStore['ledgerFilter']) => void;
  flyToRegion: (key: string) => void;
  toggleFollowBots: () => void;
  setSpotlight: (i: number | null) => void;
  setCoachStep: (n: number) => void;
  endCeremony: () => void;
  closeGameOver: () => void;
  /** the final ledger back up: leaving the analysis of a game played out */
  openGameOver: () => void;
  /** which judge reads a game again: the table as it stands, five moves on, ten */
  judgeId: JudgeId;
  setJudgeId: (id: JudgeId) => void;
  /** the move a shared link pointed at, for the analysis to open on; null once read */
  reviewAt: number | null;
  /** the last move the coach judged, at a home table with the aid on */
  coached: Coached | null;
  setCoached: (c: Coached | null) => void;
  /** at the guided table the machine waits on the coach's word on the
   *  reader's move: while it comes, and a moment once it is shown */
  coachHold: boolean;
  setReviewAt: (at: number | null) => void;
  /* ---- reading a game again, together: one seat shows, the others follow ---- */
  /** what a seat of this table is showing in its analysis: the move, the
      corner of the map its camera sits on, and where its pointer is */
  shown: { from: number; at: number; look?: { wx: number; wy: number; k: number }; cursor?: { wx: number; wy: number } | null; seat?: number; line?: { from: number; moves: GameAction[] } | null } | null;
  /** my own reading goes out to the table */
  sharing: boolean;
  /** my analysis follows whoever is showing */
  following: boolean;
  shareReview: (on: boolean) => void;
  followReview: (on: boolean) => void;
  /** where my analysis stands, told to the table when I am sharing: the move,
      the seat being read and the line being explored */
  showReviewAt: (at: number, seat: number, line: { from: number; moves: GameAction[] } | null) => void;
  /** where my camera and my pointer are, told to the table while I am sharing
      — at most a few times a second, and only what moved */
  showLook: (look: { wx: number; wy: number; k: number }, cursor: { wx: number; wy: number } | null) => void;
  runBot: () => GameAction | null;
  takeLoan: () => void;
  pass: (reason?: string) => void;
  /** a pause of the whole table — proposed, agreed, refused, lifted */
  pauseTable: (want: 'propose' | 'agree' | 'refuse' | 'resume') => void;
  /** my own break, on or off */
  takeBreak: (on: boolean) => void;
  /** the host's rollback to before action `to`, and the answers to it */
  rollbackTable: (want: 'propose' | 'agree' | 'refuse', to?: number) => void;
  /** cast a vote to abandon the game for a seat; false when it is not this seat's to cast */
  voteConcede: (player: number, vote: 'yes' | 'no') => boolean;

  /* ---- derived ---- */
  currentTargets: () => BuildTarget[];
  currentLinks: () => LinkTarget[];
  currentSells: () => SellTarget[];
  currentDevelops: () => ReturnType<typeof developOptions>;
}

/** the judge a reader last chose, kept for the next game they read. Declared
    before the store: its first state reads it as the module is evaluated */
const JUDGE_KEY = 'brassworks.analysis.judge';

const NO_MOOD = { pause: null, breaks: [] as number[], rollback: null, frozen: false, host: -1 };

/** a local game against the machines is over: the player's form moves,
 *  unless the table folded or no human sat at it */
function noteForm(g: GameState): void {
  if (g.abandoned || g.winner === undefined) return;
  if (!g.players.some((p) => p.isBot) || !g.players.some((p) => !p.isBot)) return;
  recordForm(!g.players[g.winner].isBot);
}

/* a game at home is over: the form moves, the notice of the week gets its
   verdict, the patents earned are granted, and a machine writes */
function noteHouse(g: GameState, local: string | null): void {
  noteForm(g);
  if (!local) return;
  const attempt = noteChallenge(g, local);
  /* the office keeps the week's board when there is one on the line */
  if (attempt && onlineWire()?.session) onlineWire()?.postChallenge(attempt);
  grantFromGame(g, local);
  writeLetter(g, local);
  noteFeuilleton(g, local);
  noteLines(g);
}

/** a game at home, asked of the office and put on the board.
 *
 *  Nothing is drawn until it arrives — the same bargain the online branch of
 *  `init` makes. An address naming a game the office does not hold opens a
 *  new one instead: a game carried in the link is written down as it stands,
 *  and an empty link is a fresh deal. Either way the page is then sent to
 *  the code the office gave, which is the only code that means anything.
 *  An office that does not answer, or a log it cannot replay, opens nothing:
 *  the reader's game is still there, and the board says why it is not */
async function fetchHome(code: string): Promise<void> {
  /* a link that points at a move: the analysis opens on that very move,
     which is the whole point of sending it */
  const moment = sharedMoment(window.location.hash);
  const carried = readShared(window.location.hash);
  let at = code;
  const read = await readHomeSave(code);
  let game: GameState | null = 'game' in read ? read.game : null;
  let miss: HomeMiss | null = 'miss' in read ? read.miss : null;
  /* an address the office does not keep for this reader — another member's
     table, a stale bookmark — is said to be absent, never answered with a
     fresh deal the reader did not ask for: every new game is dealt before
     its address is ever visited. Only a game carried in a shared link is
     written down here, as the reader's own copy */
  if (miss === 'absent' && carried) {
    try {
      const table = await forkHomeGame(carried);
      at = table.code;
      game = carried;
    } catch {
      /* the office is not answering: the board stays empty and says so */
      miss = 'offline';
    }
  }
  if (!game) {
    if (useGame.getState().local === code) useGame.setState({ game: null, movedTo: null, homeTrouble: { cause: miss ?? 'offline', mended: false } });
    return;
  }
  /* the reader may have walked away while the office was answering */
  if (useGame.getState().local !== code) return;
  if (carried) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  /* whatever road the game came by, the board it stands on goes in play
     before anything is drawn on it */
  setBoard(game.board);
  /* the guided game: the table it was opened at, remembered by its code so
     a reload keeps the guide — and never a table opened from the week's notice */
  const tutorial = challengeSeedFor(at) === null && guidedTable(at, game.seed);
  const coached = (() => {
    try {
      return localStorage.getItem('brassworks.coached.v1') === '1';
    } catch {
      return true;
    }
  })();
  const humanMarks = marksOf(game);
  useGame.setState({
    ...clearSelection,
    ...freshTable,
    ...freshGame,
    game,
    code: null,
    local: at,
    /* the office's code, when it is not the one the address named */
    movedTo: at === code ? null : at,
    seat: null,
    line: onlineWire()?.status ?? null,
    candle: null,
    mood: NO_MOOD,
    tutorial,
    humanMarks,
    pins: {},
    notebook: '',
    ceremony: game.phase === 'scoring-canal' ? 'canal-end' : null,
    /* a finished game reopened lands on its scores, the debrief a click away
       — unless the link pointed at a move, and then the analysis opens on it */
    gameOverOpen: game.phase === 'game-over' && moment === null,
    debriefOpen: moment !== null && game.phase === 'game-over',
    reviewAt: moment,
    coachStep: coached || tutorial ? -1 : 0,
  });
  /* the towns pinned and the page kept beside this game come back with it */
  const notes = await readNotes(at);
  if (useGame.getState().local === at) useGame.setState({ pins: notes.pins, notebook: notes.page });
}

/** the move last sent to the office from a game at home, until the office
 *  has read it — the next one waits for it */
let inFlight: Promise<Recorded> | null = null;
/** the board being read back from the office, so two calls make one reading */
let rereading: Promise<void> | null = null;
/** stop hearing the office about the game at home */
let homeDeafen: (() => void) | null = null;

/* how long the machine waits at the guided table for the coach's word on
   the reader's move, and then for it to be read: a word slower than that
   is dropped when she plays, and the × lets her play at once */
const COACH_WAIT_MS = 6000;
const COACH_READ_MS = 3000;
let coachTimer: ReturnType<typeof setTimeout> | undefined;

/** the machine held for the coach's word, for so long — or let go at 0 */
function holdForCoach(ms: number): void {
  clearTimeout(coachTimer);
  if (useGame.getState().coachHold !== ms > 0) useGame.setState({ coachHold: ms > 0 });
  if (ms > 0) coachTimer = setTimeout(() => useGame.setState({ coachHold: false }), ms);
}

/** a game at home that may not take a move just now: the office has not
 *  read the last one yet, or the two logs have drifted apart and the board
 *  is waiting to be read back */
function homeHeld(st: Pick<GameStore, 'code' | 'local' | 'homeTrouble'>): boolean {
  if (st.code || !st.local) return false;
  return inFlight !== null || (!!st.homeTrouble && !st.homeTrouble.mended);
}

/** the human moves of a log, as the undo marks read them */
function marksOf(game: GameState): UndoMark[] {
  try {
    return humanActionIndices(setupOf(game), game.seed, game.actions);
  } catch {
    return [];
  }
}

/** the board read back from the office's log, once the two have drifted
 *  apart or the office went quiet: its log is the game. The table keeps
 *  its pins, its notes and its telegrams; only the game and what was
 *  being chosen on it are replaced */
function rereadHome(code: string): Promise<void> {
  if (rereading) return rereading;
  rereading = (async () => {
    const read = await readHomeSave(code);
    const st = useGame.getState();
    if (st.local !== code) return;
    if ('miss' in read) {
      /* nothing to put on the board: it stays as it is, frozen, and says
         why — a refusal keeps its own story while the line is only down */
      const was = st.homeTrouble;
      const cause = read.miss === 'offline' && was?.cause === 'refused' ? 'refused' : read.miss;
      useGame.setState({ homeTrouble: { ...was, cause, mended: false } });
      return;
    }
    const game = read.game;
    /* the office wrote every move after all: nothing to tell the reader */
    const same = !!st.game && JSON.stringify(st.game.actions) === JSON.stringify(game.actions);
    setBoard(game.board);
    useGame.setState({
      ...clearSelection,
      game,
      humanMarks: marksOf(game),
      coached: null,
      ceremony: game.phase === 'scoring-canal' ? 'canal-end' : null,
      gameOverOpen: game.phase === 'game-over',
      homeTrouble: same ? null : { ...(st.homeTrouble ?? { cause: 'refused' }), mended: true },
    });
  })().finally(() => {
    rereading = null;
  });
  return rereading;
}

/** hear the office about the game at home: a move it turns down, and the
 *  line going up and down. The game is named by the store, not here, so a
 *  rematch under a new code is heard without listening again */
function listenHome(wire: Wire): void {
  homeDeafen?.();
  const offRefused = wire.onHomeRefused((r) => {
    const local = useGame.getState().local;
    if (!local || useGame.getState().code || normalizeCode(r.code) !== normalizeCode(local)) return;
    /* the office's log stopped short of this board: nothing more is played
       on it until it has been read back from the office */
    useGame.setState({ ...clearSelection, homeTrouble: { cause: 'refused', at: r.at, error: r.error, mended: false } });
    void rereadHome(local);
  });
  const offLine = wire.onStatus(() => {
    useGame.setState({ line: wire.status });
    /* the line is back: a board left waiting on the office is read again.
       Frames sent before are still ahead of this one in the wire's outbox,
       so the office has read the waiting move by the time it answers */
    const st = useGame.getState();
    if (wire.status === 'online' && st.local && !st.code && st.homeTrouble && !st.homeTrouble.mended) {
      if (st.game) void rereadHome(st.local);
      else void fetchHome(st.local);
    }
  });
  homeDeafen = () => {
    offRefused();
    offLine();
    homeDeafen = null;
  };
}

/** leave the game at home: the office is no longer heard about it */
export function leaveHomeTable(): void {
  homeDeafen?.();
  inFlight = null;
  useGame.setState({ homeTrouble: null, line: null });
}

export function buildFinalPayload(g: GameState): FinalPayload {
  return {
    players: g.players.map((p) => ({
      name: p.name,
      color: p.color,
      vp: p.vp,
      income: incomeLevel(p.income),
      /* the link tiles leave the board with their era, so the board cannot
         be counted at the close: the tally of what was laid is the figure */
      links: p.stats.links,
      industries: p.stats.built,
      stats: { ...p.stats },
      bot: p.isBot,
    })),
    eras: [
      { name: 'Canal' as const, scores: g.canalScores ?? g.players.map(() => 0) },
      { name: 'Rail' as const, scores: g.finalScores ?? g.players.map(() => 0) },
    ],
    winnerIndex: g.winner ?? 0,
    timeline: g.ledger
      .filter((e) => e.verb !== 'system' || e.text.includes('Era'))
      .slice(-40)
      .map((e) => `[${e.era === 'canal' ? 'Canal' : 'Rail'} R${e.round}] ${ledgerText(e, tr)}`),
    history: g.history ?? [],
    seed: g.seed,
    setup: setupOf(g),
    actions: g.actions,
  };
}

/* what is being chosen on the board, and nothing else: a choice put down
   leaves the game as it stood. The marks of the moves that can be taken
   back belong to the game (`freshGame`) and move only with its log */
const clearSelection = {
  selectedCardId: null,
  verb: null,
  buildPick: null,
  linkPick: null,
  secondLinkPick: null,
  sellPick: null,
  sellPicks: [] as SellTarget[],
  developPick: [] as IndustryType[],
  developIron: [] as (string | null)[],
  buildIron: null as string | null,
  buildCoal: [] as (string | null)[],
  linkCoal: [] as (string | null)[],
  linkBeer: null as string | null,
  sellBeer: {} as Record<string, (string | null)[]>,
  scoutPick: [] as string[],
  hoverKey: null,
  shake: null as Shake | null,
  loanConfirm: false,
  loanPeek: false,
};

/* what a table accumulates between actions and must NOT be cleared by one:
   the telegrams and marks on show, who is muted, the office's frown, the
   glasses raised, the pinned towns, the move prepared for my turn. Reset
   only when a new table is sat at. */
const freshTable = {
  surveyEmpires: [] as number[],
  glimpse: null as { seat: number; at: number } | null,
  latency: [] as (number | null)[],
  telegrams: [] as Telegram[],
  mutedSeats: [] as number[],
  telegramSentAt: 0,
  pings: [] as Ping[],
  myMarks: [] as number[],
  markStrikes: 0,
  markWarning: null as 'warned' | 'muted' | null,
  toasts: [] as number[],
  pins: {} as Record<string, string>,
  notebook: '',
  preparing: false,
  queued: [] as Prepared[],
  previewQueue: false,
  surveySeat: null as number | null,
  unlessPick: null as number | null,
};

/* what belongs to one game and goes with it: every place that sits the
   reader at another table — online, at home, a rematch, a game fetched
   from the office — spreads this whole, and a field of one game is added
   here or nowhere. `__tests__/store-table.test.ts` holds the sites to it */
export const freshGame = {
  humanMarks: [] as UndoMark[],
  review: null as Review | null,
  reviewAt: null as number | null,
  debriefOpen: false,
  coached: null as Coached | null,
  coachHold: false,
  serverUndo: false,
  movedTo: null as string | null,
  ceremony: null as 'canal-end' | null,
  gameOverOpen: false,
  tutorial: false,
  guideLane: false,
  sheetOpened: false,
  coachStep: -1,
  shown: null as GameStore['shown'],
  sharing: false,
  following: false,
  homeTrouble: null as HomeTrouble | null,
} satisfies Partial<GameStore>;

export const useGame = create<GameStore>((set, get) => ({
  game: null,
  code: null,
  movedTo: null,
  local: null,
  seat: null,
  line: null,
  serverUndo: false,
  homeTrouble: null,
  dismissHomeTrouble: () => set((st) => (st.homeTrouble?.mended ? { homeTrouble: null } : st)),
  retryHome: () => {
    const { local, game } = get();
    if (!local) return;
    /* a board on show is read back in place; an empty one is fetched whole */
    if (game) void rereadHome(local);
    else void fetchHome(local);
  },
  candle: null,
  mood: NO_MOOD,
  ...clearSelection,
  ...freshTable,
  humanMarks: [],
  pins: {},
  marketFocus: false,
  ledgerFilter: 'all',
  flyTo: null,
  followBots: true,
  tutorial: false,
  guideLane: false,
  sheetOpened: false,
  botHold: false,
  setBotHold: (on) => set((s) => (s.botHold === on ? s : { botHold: on })),
  spotlight: null,
  lens: null,
  debriefOpen: false,
  review: null,
  netPeek: null,
  coachStep: -1,
  ceremony: null,
  gameOverOpen: false,
  rulesOpen: false,
  matPlayer: null,

  init: (code, local) => {
    /* the table's code is in the address bar: a game online is a place you
       can link to, come back to and hand to someone else */
    const wire = code ? onlineWire() : null;
    homeDeafen?.();
    if (code && wire) {
      /* the table's pins and notes come back with the table */
      set({ ...clearSelection, ...freshTable, ...freshGame, game: null, code, local: null, seat: null, line: wire.status, candle: null, mood: NO_MOOD, pins: {}, notebook: '' });
      listen(code, wire);
      void readNotes(code).then((n) => {
        /* the reader may have left the table while the office was answering */
        if (get().code === code) set({ pins: n.pins, notebook: n.page });
      });
      return;
    }
    /* a game at home. The office holds it: the board waits, empty, until it
       has been handed over — the very shape the online branch above takes */
    const home = onlineWire();
    /* the line to the office shows at home too: every move goes down it */
    set({ ...clearSelection, ...freshTable, ...freshGame, game: null, code: null, local: local ?? null, seat: null, line: home?.status ?? null, candle: null, mood: NO_MOOD, pins: {} });
    if (!local) return;
    if (home) listenHome(home);
    void fetchHome(local);
  },

  myTurn: () => {
    const st = get();
    return !!st.game && st.game.phase === 'action' && (st.seat === null ? !st.game.players[st.game.current].isBot : st.seat === st.game.current);
  },

  mySeat: () => {
    const st = get();
    return st.seat ?? st.game?.current ?? 0;
  },

  spectating: () => {
    const st = get();
    return st.code !== null && st.seat !== null && st.seat < 0;
  },

  msLeft: () => {
    const c = get().candle;
    if (c === null) return null;
    /* a frozen candle does not burn */
    if (get().mood.frozen) return c.msLeft;
    return Math.max(0, c.msLeft - (Date.now() - c.at));
  },

  startDemo: (seed = Math.floor(Math.random() * 1e9)) => {
    homeDeafen?.();
    const setup = withEdition({
      players: [
        { name: tr('landing.demo.you'), color: 'brass', type: 'human' },
        { name: 'Mr Watt', color: 'steel', type: 'bot', persona: 'watt' },
        { name: 'Mrs Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
      ],
      options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
    });
    set({ ...clearSelection, ...freshTable, ...freshGame, game: newGame(setup, seed), code: null, local: null, seat: null, movedTo: null, homeTrouble: null, pins: {}, notebook: '' });
  },

  reset: () => {
    /* a rematch is a table's business, not a page's: online it does nothing.
       At home it is a new game, not the old one written over — the office
       keeps a log, and a log is not begun twice under one code. The page
       follows `movedTo` to the deal the office hands back */
    if (get().code || !get().local) return;
    set({ ...clearSelection, ...freshTable, ...freshGame, game: null, pins: {}, notebook: '' });
    void openHomeGame()
      .then((table) => {
        set({ local: table.code, movedTo: table.code });
        return fetchHome(table.code);
      })
      .catch(() => set({ game: null }));
  },

  /** the game moved at home: the office is told the move and where in the
   *  log it goes. Online the table keeps the log itself, and nothing here
   *  has anything to send */
  record: (action, at) => {
    const { code, local } = get();
    if (code || !local) return;
    const sent = recordMove(local, at, action);
    inFlight = sent;
    void sent.then((r) => {
      if (inFlight === sent) inFlight = null;
      /* a refusal is heard by `listenHome`, whoever sent the move. A move
         the office never answered for may be lost: the table waits for it,
         frozen, and is read back as soon as the office can be asked */
      if (r !== 'offline' || get().local !== local) return;
      if (!get().homeTrouble) set({ homeTrouble: { cause: 'offline', mended: false } });
      void rereadHome(local);
    });
  },

  /* ------------------------- selection ------------------------- */

  selectCard: (id) => {
    const st = get();
    if (!st.game || st.game.phase !== 'action') return;
    if (st.verb === 'scout') {
      if (id) st.toggleScout(id);
      return;
    }
    if (st.selectedCardId === id) {
      set({ selectedCardId: null, verb: null, buildPick: null, linkPick: null, sellPick: null, sellPicks: [], developPick: [], developIron: [], buildIron: null, linkBeer: null, sellBeer: {} });
      return;
    }
    set({ selectedCardId: id, verb: null, buildPick: null, linkPick: null, secondLinkPick: null, sellPick: null, sellPicks: [], developPick: [], developIron: [], buildIron: null, linkBeer: null, sellBeer: {}, shake: null });
  },

  setVerb: (v) => {
    const st = get();
    if (!st.game) return;
    if (v === 'loan') {
      set({ loanConfirm: true });
      return;
    }
    if (v === 'scout') {
      set({ ...clearSelection, verb: 'scout' });
      return;
    }
    set({ verb: v, buildPick: null, linkPick: null, secondLinkPick: null, sellPick: null, sellPicks: [], developPick: [], developIron: [], buildIron: null, linkBeer: null, sellBeer: {}, shake: null });
  },

  pickBuild: (t) =>
    set((st) => {
      /* the same slot picked again keeps the supply named for it */
      const same = !!t && !!st.buildPick && tileKey(t.town, t.slot) === tileKey(st.buildPick.town, st.buildPick.slot);
      return { buildPick: t, shake: null, buildIron: same ? st.buildIron : null, buildCoal: same ? st.buildCoal : [] };
    }),
  setBuildIron: (from) => set({ buildIron: from }),
  setBuildCoal: (k, from) =>
    set((st) => {
      const next = [...st.buildCoal];
      next[k] = from;
      return { buildCoal: next };
    }),
  setLinkCoal: (k, from) =>
    set((st) => {
      const next = [...st.linkCoal];
      next[k] = from;
      return { linkCoal: next };
    }),
  setLinkBeer: (from) => set({ linkBeer: from }),
  pickLink: (t) => {
    const st = get();
    if (!st.linkPick) {
      set({ linkPick: t, linkCoal: [] });
      return;
    }
    if (st.linkPick && t && st.game?.era === 'rail') {
      const first = st.linkPick.link;
      if (t.link.id === first.id) {
        set({ linkPick: null, secondLinkPick: null, linkBeer: null, linkCoal: [] });
        return;
      }
      /* the second rail: one the network already reaches, or one the first
         link brings within reach — the two need not touch each other */
      const ends = [first.a, first.b, first.alsoConnects].filter(Boolean);
      const touches = t.valid || ends.includes(t.link.a) || ends.includes(t.link.b) || (!!t.link.alsoConnects && ends.includes(t.link.alsoConnects));
      if (touches) {
        set({ secondLinkPick: t, linkBeer: null, linkCoal: st.linkCoal.slice(0, 1) });
      } else {
        set({ linkPick: t, secondLinkPick: null, linkBeer: null, linkCoal: [] });
      }
    } else {
      set({ linkPick: t, linkCoal: [] });
    }
  },
  /* click a tile = queue it; click it again = drop it. Any number of
     tiles sell on one card (each needs its own beer). */
  pickSell: (t) => {
    const cur = get().sellPicks;
    if (!t) {
      set({ sellPick: null, sellPicks: [], shake: null });
      return;
    }
    const same = (x: SellTarget) => x.town === t.town && x.slot === t.slot;
    const next = cur.some(same) ? cur.filter((x) => !same(x)) : [...cur, t];
    /* a tile joins the sale only if the beer reaches it after the ones
       already in it have drunk: the whole sale stands, or it is not begun */
    const g = get().planGame();
    const actor = get().planActor();
    if (!cur.some(same) && t.valid && g && actor >= 0) {
      const beer = next.map((x) => get().sellBeer[tileKey(x.town, x.slot)] ?? []);
      if (salesThatStand(g, actor, next.filter((x) => x.valid), beer.filter((_, i) => next[i].valid)) < next.filter((x) => x.valid).length) {
        set({ shake: { key: tileKey(t.town, t.slot), reason: beerShort(t), at: Date.now() } });
        return;
      }
    }
    const sellBeer = { ...get().sellBeer };
    if (cur.some(same)) delete sellBeer[tileKey(t.town, t.slot)];
    set({ sellPick: next[next.length - 1] ?? null, sellPicks: next, sellBeer, shake: null });
  },
  setSellMerchant: (key, merchant) => {
    const st = get();
    const g = st.planGame();
    const actor = st.planActor();
    if (!g || actor < 0) return;
    const t = sellTargets(g, actor).find((x) => tileKey(x.town, x.slot) === key && x.merchant === merchant && x.valid);
    if (!t) return;
    const sellPicks = st.sellPicks.map((x) => (tileKey(x.town, x.slot) === key ? t : x));
    /* another merchant: its barrel is not the one named before */
    const sellBeer = { ...st.sellBeer };
    delete sellBeer[key];
    set({ sellPicks, sellPick: st.sellPick && tileKey(st.sellPick.town, st.sellPick.slot) === key ? t : st.sellPick, sellBeer });
  },
  setSellBeer: (key, k, from) => {
    const cur = [...(get().sellBeer[key] ?? [])];
    cur[k] = from;
    set({ sellBeer: { ...get().sellBeer, [key]: cur } });
  },

  toggleDevelop: (ind) => {
    const cur = get().developPick;
    if (cur.includes(ind)) get().dropDevelop(ind);
    else get().addDevelop(ind);
  },
  addDevelop: (ind) => {
    const st = get();
    const cur = st.developPick;
    if (cur.length >= 2) return;
    const have = cur.filter((x) => x === ind).length;
    if (have >= 2) return;
    if (have === 1 && (!st.game || !developTwice(st.game, st.game.current, ind))) return;
    set({ developPick: [...cur, ind], developIron: [...st.developIron, null] });
  },
  dropDevelop: (ind) => {
    const st = get();
    const at = st.developPick.lastIndexOf(ind);
    if (at < 0) return;
    set({ developPick: st.developPick.filter((_, i) => i !== at), developIron: st.developIron.filter((_, i) => i !== at) });
  },
  setDevelopIron: (k, from) => {
    const iron = [...get().developIron];
    iron[k] = from;
    set({ developIron: iron });
  },

  toggleScout: (cardId) => {
    const cur = get().scoutPick;
    set({ scoutPick: cur.includes(cardId) ? cur.filter((x) => x !== cardId) : cur.length < 3 ? [...cur, cardId] : cur });
  },

  setHover: (key) => set({ hoverKey: key }),
  sendTelegram: (key) => {
    const st = get();
    if (!isTelegramKey(key)) return false;
    const now = Date.now();
    if (now - st.telegramSentAt < TELEGRAM_COOLDOWN_MS) return false;
    if (st.code) {
      const wire = onlineWire();
      if (!wire) return false;
      wire.send({ t: 'telegram', code: st.code, key });
      set({ telegramSentAt: now });
      return true;
    }
    const g = st.game;
    const me = g ? g.players.findIndex((p) => !p.isBot) : -1;
    if (me < 0) return false;
    set({ telegramSentAt: now });
    get().receiveTelegram(me, key);
    /* a jibe at the machines gets one back, now and then */
    if (DIALECT[key] && Math.random() < 0.6) botWires(pickBot(g!, me), pickDialect(key), 1500 + Math.random() * 1500);
    return true;
  },
  receiveTelegram: (from, key) => {
    if (!isTelegramKey(key) || get().mutedSeats.includes(from)) return;
    if (key === 'cheers' && !get().toasts.includes(from)) set({ toasts: [...get().toasts, from] });
    const id = Date.now() + Math.random();
    set({ telegrams: [...get().telegrams.filter((x) => x.from !== from), { id, from, key, at: Date.now() }] });
    setTimeout(() => set({ telegrams: get().telegrams.filter((x) => x.id !== id) }), TELEGRAM_SHOWN_MS);
  },
  setPreparing: (on) => {
    const st = get();
    const g = st.game;
    const me = st.seat ?? (g ? g.players.findIndex((p) => !p.isBot) : -1);
    /* as many moves as the turn will grant, no more */
    if (on && (st.myTurn() || !g || g.phase !== 'action' || me < 0 || st.queued.length >= actionsFor(g, g.players[me]))) return;
    set({ ...clearSelection, preparing: on });
  },
  dropQueued: (index) => {
    const queued = get().queued.filter((_, i) => i !== index);
    set({ queued, unlessPick: null });
  },
  setPreviewQueue: (on) => set({ previewQueue: on && !!get().game, surveySeat: null }),
  setSurveySeat: (seat) => set({ surveySeat: seat, previewQueue: false }),
  cycleSurveySeat: () => {
    const st = get();
    const g = st.game;
    if (!g) return;
    const me = st.seat ?? g.players.findIndex((p) => !p.isBot);
    const others = g.players.map((_, i) => i).filter((i) => i !== me);
    if (!others.length) return;
    const k = st.surveySeat === null ? -1 : others.indexOf(st.surveySeat);
    const next = k + 1 < others.length ? others[k + 1] : null;
    set({ surveySeat: next, previewQueue: false });
  },
  beginUnlessPick: (index) => set({ unlessPick: index }),
  applyUnlessPick: (town, slot) => {
    const st = get();
    const i = st.unlessPick;
    const g = st.game;
    if (i === null || !g || !st.queued[i]) return;
    const cur = st.queued[i].unless;
    const allows = slot !== null ? TOWN_BY_ID[town]?.slots[slot]?.allows : undefined;
    const industry = allows && allows.length === 1 ? allows[0] : undefined;
    const unless: Unless = { player: cur?.player ?? 'any', kind: cur?.kind ?? 'build', town, industry: (cur?.kind ?? 'build') === 'build' ? industry : undefined };
    /* a town picked says where: the merchant or the very link no longer do */
    set({ queued: st.queued.map((q, k) => (k === i ? { ...q, unless } : q)) });
  },
  setUnless: (index, unless) => set({ queued: get().queued.map((q, i) => (i === index ? { ...q, unless: unless ?? undefined } : q)) }),
  playQueued: () => {
    const st = get();
    const g = st.game;
    if (!g || !st.myTurn() || !st.queued.length) return;
    const [next, ...rest] = st.queued;
    if (st.previewQueue) set({ previewQueue: false });
    /* the condition: what that player did since the move was prepared */
    const u = next.unless;
    const hit = u ? g.ledger.find((e) => e.id >= next.since && unlessHit(u, e, g.current)) : undefined;
    if (hit) {
      set({ queued: rest, shake: { key: '', reason: tr('game.hand.queueUnless', { what: ledgerText(hit, tr) }), at: Date.now() } });
      return;
    }
    const r = applyAction(g, g.current, next.action);
    if (!r.state) {
      set({ queued: rest, shake: { key: '', reason: tr('game.hand.queueDropped', { reason: reasonText(r.error) }), at: Date.now() } });
      return;
    }
    set({ queued: rest });
    st.dispatch(next.action);
  },
  planGame: () => {
    const st = get();
    const g = st.game;
    if (!g || !st.preparing || !st.queued.length) return g;
    const me = st.planActor();
    return me < 0 ? g : projectQueued(g, me, st.queued);
  },
  planActor: () => {
    const st = get();
    const g = st.game;
    if (!g || g.phase !== 'action') return -1;
    if (st.preparing) {
      const me = st.seat ?? g.players.findIndex((x) => !x.isBot);
      return me >= 0 && !g.players[me].isBot && me !== g.current ? me : -1;
    }
    if (g.players[g.current].isBot) return -1;
    return st.seat === null || st.seat === g.current ? g.current : -1;
  },
  pinTown: (town, on) => {
    const pins = { ...get().pins };
    if (on) pins[town] = pins[town] ?? '';
    else delete pins[town];
    set({ pins });
    keepNotes(pinScope(get()), pins, get().notebook);
  },
  setPinNote: (town, note) => {
    /* a word on a town pins it; an emptied note leaves the pin standing */
    const pins = { ...get().pins, [town]: note };
    set({ pins });
    keepNotes(pinScope(get()), pins, get().notebook);
  },
  setNotebook: (text) => {
    set({ notebook: text });
    keepNotes(pinScope(get()), get().pins, text);
  },
  sendToast: () => {
    const st = get();
    const g = st.game;
    const me = st.seat ?? (g ? g.players.findIndex((p) => !p.isBot) : -1);
    if (!g || me < 0 || st.toasts.includes(me)) return false;
    if (st.code) {
      const wire = onlineWire();
      if (!wire) return false;
      wire.send({ t: 'telegram', code: st.code, key: 'cheers' });
      return true;
    }
    set({ toasts: [...st.toasts, me] });
    g.players.forEach((p, i) => {
      if (p.isBot && Math.random() < 0.85) botWires(i, 'cheers', 800 + Math.random() * 2500);
    });
    return true;
  },
  sendPing: (key) => {
    const st = get();
    if (st.markStrikes >= 2) return false;
    if (st.code) {
      const wire = onlineWire();
      if (!wire) return false;
      wire.send({ t: 'mark', code: st.code, key });
      return true;
    }
    const g = st.game;
    const me = g ? g.players.findIndex((p) => !p.isBot) : -1;
    if (me < 0) return false;
    /* the same frown as the office's: a shower earns a warning, a second one silence */
    const now = Date.now();
    const marks = [...st.myMarks.filter((at) => now - at < PING_WINDOW_MS), now];
    if (marks.length > PING_SHOWER) {
      const strikes = st.markStrikes + 1;
      set({ myMarks: [], markStrikes: strikes, markWarning: strikes >= 2 ? 'muted' : 'warned' });
      return false;
    }
    set({ myMarks: marks });
    get().receivePing(me, key);
    return true;
  },
  dismissMarkWarning: () => set({ markWarning: null }),
  receivePing: (from, key) => {
    if (get().mutedSeats.includes(from)) return;
    const id = Date.now() + Math.random();
    set({ pings: [...get().pings.filter((x) => x.from !== from), { id, from, key, at: Date.now() }] });
    setTimeout(() => set({ pings: get().pings.filter((x) => x.id !== id) }), PING_SHOWN_MS);
  },
  muteSeat: (seat, on) => {
    const muted = get().mutedSeats.filter((s) => s !== seat);
    set({ mutedSeats: on ? [...muted, seat] : muted, telegrams: on ? get().telegrams.filter((x) => x.from !== seat) : get().telegrams, pings: on ? get().pings.filter((x) => x.from !== seat) : get().pings });
  },

  reject: (key, reason) => set({ shake: { key, reason, at: Date.now() } }),

  cancel: () => set({ ...clearSelection, preparing: false }),

  setLoanConfirm: (open) => set({ loanConfirm: open }),
  setLoanPeek: (on) => set({ loanPeek: on }),
  setRulesOpen: (open) => set({ rulesOpen: open }),
  openMat: (i) => set({ matPlayer: i }),
  closeMat: () => set({ matPlayer: null }),
  noteSheet: () => {
    if (!get().sheetOpened) set({ sheetOpened: true });
  },
  setMarketFocus: (on) => set({ marketFocus: on }),
  setLedgerFilter: (f) => set({ ledgerFilter: f }),
  flyToRegion: (key) => set({ flyTo: { key, at: Date.now() } }),
  toggleSurveyEmpire: (seat) => set((st) => ({ surveyEmpires: st.surveyEmpires.includes(seat) ? st.surveyEmpires.filter((x) => x !== seat) : [...st.surveyEmpires, seat] })),
  setGlimpse: (glimpse) => set({ glimpse }),
  toggleFollowBots: () => set((s) => ({ followBots: !s.followBots })),
  setSpotlight: (i) => set({ spotlight: i }),
  setLens: (lens) => set((s) => (JSON.stringify(s.lens) === JSON.stringify(lens) ? s : { lens })),
  /* the analysis takes the table: the final ledger stands aside for it, and
     the board is left as it is when the analysis closes */
  setDebriefOpen: (open) => set(open ? { debriefOpen: true, gameOverOpen: false } : { debriefOpen: false, review: null }),
  setReview: (review) => set({ review }),
  setNetPeek: (i) => set({ netPeek: i }),
  setCoachStep: (n) => {
    set({ coachStep: n });
    if (n < 0) {
      try {
        localStorage.setItem('brassworks.coached.v1', '1');
      } catch {
        /* non-fatal */
      }
    }
  },

  /* -------------------------- confirm --------------------------- */

  confirm: () => {
    const st = get();
    const g = st.game;
    if (!g || g.phase !== 'action') return;
    const actor = st.planActor();
    if (actor < 0) return;
    const card = g.players[actor].hand.find((c) => c.id === st.selectedCardId);
    let action: GameAction | null = null;
    switch (st.verb) {
      case 'build':
        if (card && st.buildPick?.valid) action = { kind: 'build', card: card.id, town: st.buildPick.town, slot: st.buildPick.slot, industry: st.buildPick.industry, ...(st.buildIron ? { ironFrom: st.buildIron } : {}), ...(st.buildCoal.some(Boolean) ? { coalFrom: st.buildCoal } : {}) };
        break;
      case 'network':
        if (card && st.linkPick?.valid) {
          /* a double rail is read again as it stands now — the beer named,
             the coal reserved — and refused here, in words, rather than
             handed to the engine to refuse in silence */
          if (st.secondLinkPick) {
            const dbl = doubleLinkPlan(g, actor, withLinkCoal(g, actor, st.linkPick, st.linkCoal[0]), st.secondLinkPick.link, st.linkBeer, st.linkCoal[1]);
            if (!dbl.valid) {
              set({ shake: { key: st.secondLinkPick.link.id, reason: dbl.reason ?? '', at: Date.now() } });
              return;
            }
          }
          action = { kind: 'network', card: card.id, link: st.linkPick.link.id, second: st.secondLinkPick?.link.id, ...(st.secondLinkPick && st.linkBeer ? { beerFrom: st.linkBeer } : {}), ...(st.linkCoal.some(Boolean) ? { coalFrom: st.linkCoal } : {}) };
        }
        break;
      case 'develop':
        if (card && st.developPick.length > 0) action = { kind: 'develop', card: card.id, industries: st.developPick, ironFrom: st.developIron };
        break;
      case 'sell':
        if (card && st.sellPicks.some((x) => x.valid)) action = { kind: 'sell', card: card.id, sales: st.sellPicks.filter((x) => x.valid).map((x) => { const beer = st.sellBeer[tileKey(x.town, x.slot)]; return { town: x.town, slot: x.slot, merchant: x.merchant, ...(beer?.some(Boolean) ? { beerFrom: beer } : {}) }; }) };
        break;
      case 'scout':
        if (st.scoutPick.length === 3) action = { kind: 'scout', cards: st.scoutPick };
        break;
      case 'pass':
        if (card) action = { kind: 'pass', card: card.id };
        break;
    }
    if (!action) return;
    if (st.preparing) {
      /* ready for my turn: kept, not played */
      const since = g.ledger.length ? g.ledger[g.ledger.length - 1].id + 1 : 0;
      set({ ...clearSelection, preparing: false, queued: [...st.queued, { action, since }].slice(0, 2) });
      return;
    }
    get().dispatch(action);
  },

  /* every change of the game goes through the engine's action log: the
     store only translates the selection into an action and commits the
     state the engine hands back */
  dispatch: (action) => {
    const st = get();
    const g = st.game;
    if (!g) return false;
    /* online the client only ever proposes: the board moves when the table
       answers, and a refusal comes back as the engine's own words */
    if (st.code) {
      const wire = onlineWire();
      if (!wire) return false;
      wire.send({ t: 'act', code: st.code, action });
      set({ ...clearSelection });
      return true;
    }
    /* at home the office keeps the log: no move goes on the board before it
       has read the last one, and none while the two stand apart */
    if (homeHeld(st)) {
      set({ shake: { key: '', reason: tr('game.page.reconnecting'), at: Date.now() } });
      return false;
    }
    const r = applyAction(g, actorOf(g, action), action);
    if (!r.state) {
      /* the engine's refusal, said where it applies: at the link, the
         slot, or nowhere in particular */
      const key = action.kind === 'network' ? (action.second ?? action.link) : action.kind === 'build' ? tileKey(action.town, action.slot) : '';
      set({ shake: { key, reason: reasonText(r.error), at: Date.now() } });
      return false;
    }
    const mut = r.state;
    const ceremony = mut.phase === 'scoring-canal' ? ('canal-end' as const) : null;
    /* a vote, or a chair handed over, is not a turn: nothing to take back */
    const human = action.kind !== 'concede' && action.kind !== 'resign' && g.phase === 'action' && !g.players[g.current].isBot;
    set({ ...clearSelection, game: mut, ceremony, gameOverOpen: mut.phase === 'game-over', humanMarks: human ? [...get().humanMarks, { at: g.actions.length, by: g.current }] : get().humanMarks });
    get().record(action, g.actions.length);
    if (mut.phase === 'game-over' && !get().code) noteHouse(mut, get().local);
    if (human) botBanter(mut, g.current, action);
    /* the coach, behind the aid and at home only: the move just made, read
       against the roads that were open — never a move still to come */
    if (human && aidOn(g.assist, false) && action.kind !== 'pass') {
      set({ coached: null });
      /* at the guided table the deed a lesson asks for is the lesson's:
         the coach does not grade it, nor tell of an older move after it */
      const reader = (s: GameState) => ({ g: s, me: g.current, sel: null, mat: null });
      if (st.tutorial && deedOf(reader(g), reader(mut))) {
        hushCoach();
        holdForCoach(0);
      } else {
        /* there the machine waits for the word, and gives it a moment */
        if (st.tutorial) holdForCoach(COACH_WAIT_MS);
        coachMove(g, g.current, action, (c) => {
          /* the same game, the same move: the machines may have played on meanwhile */
          const now = get().game;
          const fresh = !!c && !!now && now.seed === g.seed && now.actions[c.at] === action;
          if (fresh) set({ coached: c });
          if (st.tutorial) holdForCoach(fresh ? COACH_READ_MS : 0);
        });
      }
    }
    /* and its word is on the reader's move, read before the machine plays
       on: the machine's move sends it away, with any word still on its way */
    if (st.tutorial && action.kind !== 'concede' && action.kind !== 'resign' && g.phase === 'action' && g.players[g.current].isBot) {
      hushCoach();
      holdForCoach(0);
      if (get().coached) set({ coached: null });
    }
    return true;
  },

  canUndo: () => {
    const st = get();
    if (st.code) return st.serverUndo;
    const g = st.game;
    return !!g && canUndoNow(g, get().humanMarks);
  },

  undo: () => {
    const st = get();
    if (st.code) {
      if (!st.serverUndo) return false;
      onlineWire()?.send({ t: 'undo', code: st.code });
      return true;
    }
    const g = st.game;
    const marks = get().humanMarks;
    if (!g || !canUndoNow(g, marks)) return false;
    /* a board the office is reading back is not one to take a move off */
    if (st.homeTrouble && !st.homeTrouble.mended) return false;
    let back: GameState | null = null;
    try {
      back = undoLastHuman(g, marks);
    } catch (err) {
      /* a log that will not replay is a bug worth seeing, not swallowing */
      console.error('undo: replay failed', err);
      set({ shake: { key: '', reason: tr('game.hand.undoFailed'), at: Date.now() } });
      return false;
    }
    if (!back) return false;
    /* and the coach's word on the move taken back goes with it */
    set({ ...clearSelection, game: back, humanMarks: marks.slice(0, -1), ceremony: back.phase === 'scoring-canal' ? 'canal-end' : null, gameOverOpen: false, coached: null });
    holdForCoach(0);
    /* the office cuts its log where the board now stands */
    const at = get().local;
    if (at) void recordUndo(at, back.actions.length).catch(() => undefined);
    return true;
  },

  endCeremony: () => {
    const g = get().game;
    if (!g || g.phase !== 'scoring-canal') return;
    if (get().code) {
      get().dispatch({ kind: 'begin-rail' });
      return;
    }
    if (homeHeld(get())) return;
    const r = applyAction(g, g.current, { kind: 'begin-rail' });
    if (!r.state) return;
    set({ game: r.state, ceremony: null, gameOverOpen: r.state.phase === 'game-over' });
    get().record({ kind: 'begin-rail' }, g.actions.length);
    if (r.state.phase === 'game-over') noteForm(r.state);
  },

  closeGameOver: () => set({ gameOverOpen: false }),
  openGameOver: () => set({ gameOverOpen: true }),
  judgeId: (() => {
    try {
      const saved = localStorage.getItem(JUDGE_KEY);
      if (saved === 'quick' || saved === 'long' || saved === 'deep') return saved;
    } catch {
      /* private mode */
    }
    return 'long' as JudgeId;
  })(),
  setJudgeId: (id) => {
    set({ judgeId: id });
    try {
      localStorage.setItem(JUDGE_KEY, id);
    } catch {
      /* non-fatal */
    }
  },
  reviewAt: null,
  setReviewAt: (at) => set({ reviewAt: at }),
  coached: null,
  setCoached: (c) => {
    set({ coached: c });
    /* the word sent away: the machine need not wait on it */
    if (!c) holdForCoach(0);
  },
  coachHold: false,
  shown: null,
  sharing: false,
  following: false,
  shareReview: (on) => {
    const st = get();
    set({ sharing: on, ...(on ? { following: false } : {}) });
    /* the panel says where it stands as soon as it is sharing; stopping is
       told at once, so nobody is left following a reader who has gone */
    if (!on) lookAt = null;
    if (!on && st.code) onlineWire()?.send({ t: 'review', code: st.code, at: null });
  },
  followReview: (on) => set({ following: on, ...(on ? { sharing: false } : {}) }),
  showReviewAt: (at, seat, line) => {
    const st = get();
    if (!st.sharing || !st.code) return;
    lookAt = at;
    onlineWire()?.send({ t: 'review', code: st.code, at, seat, line });
  },
  showLook: (look, cursor) => {
    const st = get();
    if (!st.sharing || !st.code || lookAt === null) return;
    const now = Date.now();
    if (now - lookSent < LOOK_EVERY_MS) return;
    lookSent = now;
    onlineWire()?.send({ t: 'review', code: st.code, at: lookAt, look, cursor });
  },

  takeLoan: () => {
    const g = get().game;
    if (!g || g.phase !== 'action') return;
    get().dispatch({ kind: 'loan', card: get().selectedCardId ?? undefined });
  },

  pass: (reason) => {
    const g = get().game;
    if (!g || g.phase !== 'action') return;
    // passing costs a card per action skipped; the selected card goes first
    get().dispatch({ kind: 'pass', card: get().selectedCardId ?? undefined, reason });
  },

  endTutorial: () => {
    try {
      localStorage.removeItem(TUTORIAL_KEY);
    } catch {
      /* non-fatal */
    }
    set({ tutorial: false, guideLane: true });
  },

  pauseTable: (want) => {
    const st = get();
    if (st.code) onlineWire()?.send({ t: 'pause', code: st.code, want });
  },
  takeBreak: (on) => {
    const st = get();
    if (st.code) onlineWire()?.send({ t: 'break', code: st.code, on });
  },
  rollbackTable: (want, to) => {
    const st = get();
    if (st.code) onlineWire()?.send({ t: 'rollback', code: st.code, want, to });
  },

  /* a vote to abandon: online it is cast for one's own seat, at one table
     every human seat votes from this device */
  voteConcede: (player, vote) => {
    const st = get();
    const g = st.game;
    if (!g || g.phase !== 'action') return false;
    if (st.seat !== null && st.seat !== player) return false;
    return st.dispatch({ kind: 'concede', player, vote });
  },

  /* ---------------------------- bots ---------------------------- */

  runBot: () => {
    const st = get();
    const g = st.game;
    /* online the bots are played by the table, never by a browser */
    if (!g || g.phase !== 'action' || st.code) return null;
    const p = g.players[g.current];
    if (!p.isBot) return null;
    /* at home a machine waits for the office to have read the last move,
       then plays — on the very table it was asked to play on */
    if (homeHeld(st)) {
      const waiting = inFlight;
      if (waiting) void waiting.then(() => {
        if (get().game === g) get().runBot();
      });
      return null;
    }
    /* a browser thinks on the thread that paints, so a machine keeps it short
       — an expert a little less so; it plays at the form the house holds */
    const strength = readForm().level;
    const expert = isExpert(g, g.current);
    const wanted = chooseBotAction(g, g.current, { budgetMs: expert ? 1500 : strength >= 0.8 ? 400 : 200, strength });
    // nothing playable (or a move the engine refuses): scout if allowed, else pass
    if (!(wanted && get().dispatch(wanted))) get().dispatch(fallbackAction(g, g.current));
    return wanted;
  },

  /* --------------------------- derived -------------------------- */

  currentTargets: () => {
    const st = get();
    const g = st.planGame();
    const actor = st.planActor();
    if (!g || actor < 0) return [];
    const card = g.players[actor].hand.find((c) => c.id === st.selectedCardId);
    if (!card || st.verb !== 'build') return [];
    return buildTargets(g, actor, card);
  },

  currentLinks: () => {
    const st = get();
    const g = st.planGame();
    const actor = st.planActor();
    if (!g || actor < 0 || st.verb !== 'network') return [];
    const list = linkTargets(g, actor);
    /* rail era, first link picked: links touching it become the DOUBLE option
       (£15 + 1 coal each + 1 beer) even when they don't touch the network yet */
    const first = st.linkPick;
    if (!first || g.era !== 'rail') return list;
    return list.map((t) => {
      if (t.link.id === first.link.id) return t;
      const ends = [first.link.a, first.link.b, first.link.alsoConnects].filter(Boolean);
      const touches = ends.includes(t.link.a) || ends.includes(t.link.b) || (!!t.link.alsoConnects && ends.includes(t.link.alsoConnects));
      if (!touches) return t;
      const dbl = doubleLinkPlan(g, actor, first, t.link);
      return { ...t, valid: dbl.valid, reason: dbl.reason, total: dbl.total, coalPlan: dbl.coal2 };
    });
  },

  currentSells: () => {
    const st = get();
    const g = st.planGame();
    const actor = st.planActor();
    if (!g || actor < 0 || st.verb !== 'sell') return [];
    return sellTargets(g, actor);
  },

  currentDevelops: () => {
    const st = get();
    const g = st.planGame();
    const actor = st.planActor();
    if (!g || actor < 0 || st.verb !== 'develop') return [];
    return developOptions(g, actor);
  },
}));

/* -------------------- selection summary helper -------------------- */

/** what the pending action really costs — tile or link price PLUS the coal
 *  and iron bought at the market — and what the player keeps afterwards */
/** the iron each development would take, one plan per pick, in order —
 *  a chosen works, the market, or the engine's choice */
export function developPlans(game: GameState, ironFrom: (string | null)[]): SupplyPlan[] {
  const reserved = new Map<string, number>();
  return ironFrom.map((from) => {
    const plan = planIronFrom(game, from, reserved);
    for (const src of plan.sources) {
      const k = src.kind === 'tile' ? tileKey(src.town!, src.slot!) : 'market:iron';
      reserved.set(k, (reserved.get(k) ?? 0) + src.amount);
    }
    return plan;
  });
}

export function confirmCost(
  st: { verb: Verb | null; buildPick: BuildTarget | null; buildIron?: string | null; buildCoal?: (string | null)[]; linkPick: LinkTarget | null; secondLinkPick: LinkTarget | null; linkBeer?: string | null; linkCoal?: (string | null)[]; developPick: IndustryType[]; developIron: (string | null)[] },
  game: GameState,
  actor: number = game.current,
): { total: number; after: number } | null {
  const money = game.players[actor].money;
  let total: number;
  switch (st.verb) {
    case 'build':
      if (!st.buildPick) return null;
      total = withIron(game, actor, withCoal(game, actor, st.buildPick, st.buildCoal), st.buildIron).total;
      break;
    case 'network':
      if (!st.linkPick) return null;
      {
        const first = withLinkCoal(game, actor, st.linkPick, st.linkCoal?.[0]);
        total = st.secondLinkPick ? doubleLinkPlan(game, actor, first, st.secondLinkPick.link, st.linkBeer, st.linkCoal?.[1]).total : first.total;
      }
      break;
    case 'develop': {
      if (!st.developPick.length) return null;
      total = developPlans(game, st.developIron).reduce((a, plan) => a + plan.totalCost, 0);
      break;
    }
    case 'sell':
    case 'scout':
      total = 0;
      break;
    default:
      return null;
  }
  return { total, after: money - total };
}

export function confirmSummary(st: {
  verb: Verb | null;
  buildPick: BuildTarget | null;
  linkPick: LinkTarget | null;
  secondLinkPick: LinkTarget | null;
  sellPick: SellTarget | null;
  sellPicks: SellTarget[];
  developPick: IndustryType[];
  developIron: (string | null)[];
  scoutPick: string[];
  selectedCardId: string | null;
}): string | null {
  switch (st.verb) {
    case 'build': {
      const t = st.buildPick;
      if (!t) return null;
      const lv = INDUSTRIES[t.industry][t.level - 1];
      const bits = [tr('game.confirm.build', { industry: tr(`game.log.industry.${t.industry}`), level: t.level, town: TOWN_BY_ID[t.town].name, price: lv.cost })];
      const g0 = useGame.getState().planGame();
      const fromTiles = (plan: SupplyPlan, key: 'coalFrom' | 'ironFrom') => {
        for (const src of plan.sources) {
          if (src.kind !== 'tile' || !g0) continue;
          const owner = g0.tiles[tileKey(src.town!, src.slot!)]?.owner;
          bits.push(tr(`game.confirm.${key}`, { n: src.amount, town: TOWN_BY_ID[src.town!]?.name ?? src.town!, owner: owner === undefined ? '' : g0.players[owner].name }));
        }
      };
      fromTiles(t.coalPlan, 'coalFrom');
      const marketCoal = t.coalPlan.sources.filter((x) => x.kind === 'market');
      if (marketCoal.length) bits.push(tr('game.confirm.marketCoal', { n: marketCoal.length, cost: t.coalPlan.totalCost }));
      fromTiles(t.ironPlan, 'ironFrom');
      const marketIron = t.ironPlan.sources.filter((x) => x.kind === 'market');
      if (marketIron.length) bits.push(tr('game.confirm.marketIron', { n: marketIron.length, cost: t.ironPlan.totalCost }));
      /* a mine or works that reaches a merchant sells its spare cubes at once: say so */
      const g = useGame.getState().planGame();
      const sale = g ? marketSaleOnBuild(g, t.town, t.industry, t.level) : { sold: 0, earned: 0 };
      if (sale.sold) bits.push(tr('game.confirm.sale', { n: sale.sold, res: tr(`game.log.res.${t.industry}`), gain: sale.earned }));
      return bits.join(' · ');
    }
    case 'network': {
      const t = st.linkPick;
      if (!t) return null;
      const name = (id: string) => TOWN_BY_ID[id]?.name ?? MERCHANT_BY_ID[id]?.name ?? id;
      if (st.secondLinkPick) {
        const s2 = st.secondLinkPick;
        const g0 = useGame.getState().planGame();
        const price = g0 ? doubleLinkPlan(g0, useGame.getState().planActor(), t, s2.link).total : s2.total;
        return tr('game.confirm.double', { a: name(t.link.a), b: name(t.link.b), a2: name(s2.link.a), b2: name(s2.link.b), price });
      }
      return tr('game.confirm.network', { a: name(t.link.a), b: name(t.link.b), price: t.total });
    }
    case 'develop': {
      if (!st.developPick.length) return null;
      const g1 = useGame.getState().planGame();
      /* each pick names its tile — the second of an industry is the one beneath — and its iron */
      const depth: Partial<Record<IndustryType, number>> = {};
      const plans = g1 ? developPlans(g1, st.developIron) : [];
      const list = st.developPick.map((ind, k) => {
        const at = depth[ind] ?? 0;
        depth[ind] = at + 1;
        const level = g1?.players[g1.current].stacks[ind][at] ?? '';
        const src = plans[k]?.sources[0];
        const from = !src ? '' : src.kind === 'market' ? tr('game.confirm.ironMarket', { cost: src.cost }) : tr('game.confirm.ironWorks', { town: TOWN_BY_ID[src.town!]?.name ?? src.town!, owner: g1 ? g1.players[g1.tiles[tileKey(src.town!, src.slot!)]?.owner]?.name ?? '' : '' });
        return `${tr(`game.log.industry.${ind}`)} N${level}${from ? ` (${from})` : ''}`;
      });
      return tr('game.confirm.develop', { list: list.join(' + '), n: st.developPick.length });
    }
    case 'sell': {
      if (!st.sellPicks.length) return null;
      return tr('game.confirm.sell', { list: st.sellPicks.map((t) => `${tr(`game.log.industry.${t.tile.industry}`)} L${t.tile.level} → ${MERCHANT_BY_ID[t.merchant].name}`).join(' + ') });
    }
    case 'scout':
      return st.scoutPick.length === 3 ? tr('game.confirm.scout') : null;
    case 'pass':
      return st.selectedCardId ? tr('game.confirm.pass') : null;
    default:
      return null;
  }
}

export function cardLabel(card: Card): string {
  if (card.kind === 'location') return TOWN_BY_ID[card.town!]?.name ?? card.town!;
  const industry = (x: IndustryType) => tr(`game.industry.${x}`);
  if (card.kind === 'industry') return card.industry2 ? `${industry(card.industry!)} / ${industry(card.industry2)}` : industry(card.industry!);
  if (card.kind === 'wild-location') return tr('game.confirm.wildLocation');
  return tr('game.confirm.wildIndustry');
}

/** the verbs a selected card allows. `tryable` marks the ones the hand still
 *  lets the reader pick when nothing takes them, so the banner can say why */
export function verbsForCard(st: { game: GameState | null; selectedCardId: string | null; actor?: number }): { verb: Verb; ok: boolean; reason?: string; tryable?: boolean }[] {
  const g = st.game;
  const who = st.actor ?? g?.current ?? 0;
  const card = g?.players[who]?.hand.find((c) => c.id === st.selectedCardId);
  if (!g || !card) {
    return [
      { verb: 'build', ok: false, reason: 'Select a card first' },
      { verb: 'network', ok: false, reason: 'Select a card first' },
      { verb: 'develop', ok: false, reason: 'Select a card first' },
      { verb: 'sell', ok: false, reason: 'Select a card first' },
      { verb: 'loan', ok: !!g && canLoan(g, who).ok, reason: g ? canLoan(g, who).reason : undefined },
      { verb: 'scout', ok: !!g && canScout(g, who).ok, reason: g ? canScout(g, who).reason : undefined },
      { verb: 'pass', ok: false, reason: 'Select the card to discard first' },
    ];
  }
  const i = who;
  const sites = buildTargets(g, i, card);
  const links = linkTargets(g, i);
  const sales = sellTargets(g, i);
  return [
    { verb: 'build', ok: sites.some((t) => t.valid), reason: whyNoBuild(sites), tryable: true },
    /* a purse that pays for a canal hears what else stands in the way */
    { verb: 'network', ok: links.some((t) => t.valid), reason: whyNoLink(links), tryable: true },
    { verb: 'develop', ok: developOptions(g, i).some((d) => d.valid), reason: 'Nothing worth developing (needs iron)', tryable: true },
    /* a works joined to its buyer that cannot sell lacks its beer */
    { verb: 'sell', ok: sales.some((t) => t.valid), reason: whyNoSale(sales), tryable: true },
    { verb: 'loan', ok: canLoan(g, i).ok, reason: canLoan(g, i).reason },
    { verb: 'scout', ok: canScout(g, i).ok, reason: canScout(g, i).reason },
    /* nothing to play: a pass still costs the card */
    { verb: 'pass', ok: true },
  ];
}

/* ---------------------- the table on the wire ---------------------- */

/** stop listening to the table we were following, if any */
let deafen: (() => void) | null = null;

/** follow a table: every state it sends replaces the one on this screen */
function listen(code: string, wire: Wire): void {
  deafen?.();
  const onFrame = wire.on((m: ServerMessage) => {
    if (m.t === 'game' && m.view.code === code) {
      const view = m.view;
      /* the game is over: the log opens, and with the seed the replay works */
      const game = view.archive ? { ...view.state, seed: view.archive.seed } : view.state;
      /* my own move landed, or the game changed phase or table: the
         selection is spent. Another seat's move, a vote, a pause: the plan
         I am making (in my turn or out of it) stays where it is */
      const prev = useGame.getState();
      const spent = !prev.game || prev.code !== code || prev.game.phase !== game.phase || (prev.game.actions.length !== game.actions.length && prev.game.current === view.seat);
      useGame.setState({
        ...(spent ? clearSelection : {}),
        game,
        seat: view.seat,
        serverUndo: view.canUndo,
        candle: view.msLeft === null ? null : { msLeft: view.msLeft, at: Date.now() },
        mood: { pause: view.pause ?? null, breaks: view.breaks ?? [], rollback: view.rollback ?? null, frozen: !!view.frozen, host: view.host ?? -1 },
        ceremony: game.phase === 'scoring-canal' ? 'canal-end' : null,
        gameOverOpen: game.phase === 'game-over',
      });
      return;
    }
    if (m.t === 'rejected' && m.code === code) useGame.setState({ shake: { key: '', reason: m.error, at: Date.now() } });
    if (m.t === 'telegram' && m.code === code) useGame.getState().receiveTelegram(m.from, m.key);
    if (m.t === 'mark' && m.code === code) useGame.getState().receivePing(m.from, m.key);
    if (m.t === 'review' && m.code === code && m.from !== useGame.getState().seat) {
      const was = useGame.getState().shown;
      const same = was?.from === m.from;
      useGame.setState({
        shown:
          m.at === null
            ? null
            : {
                from: m.from,
                at: m.at,
                /* a note that carries neither keeps what the last one said */
                look: m.look ?? (same ? was.look : undefined),
                cursor: m.cursor === undefined ? (same ? was.cursor : null) : m.cursor,
                seat: m.seat ?? (same ? was.seat : undefined),
                line: m.line === undefined ? (same ? was.line : null) : m.line,
              },
      });
    }
    if (m.t === 'warned' && m.code === code) useGame.setState({ markStrikes: m.muted ? 2 : 1, markWarning: m.muted ? 'muted' : 'warned' });
    if (m.t === 'pulse' && m.code === code) useGame.setState({ latency: m.latency });
  });
  const onLine = wire.onStatus(() => useGame.setState({ line: wire.status }));
  wire.watch(code);
  deafen = () => {
    onFrame();
    onLine();
    deafen = null;
  };
}

/** stop following the online table (leaving the board for good) */
export function leaveOnlineTable(): void {
  deafen?.();
  homeDeafen?.();
  const code = useGame.getState().code;
  if (code) onlineWire()?.unwatch(code);
  useGame.setState({ code: null, local: null, seat: null, line: null, serverUndo: false, candle: null, mood: NO_MOOD, shown: null, sharing: false, following: false });
}

/* how often a shared reading tells the table where it is looking */
const LOOK_EVERY_MS = 120;
/** the move being shown, so a camera note carries it along */
let lookAt: number | null = null;
let lookSent = 0;

/* --------------------- the table once my moves have played --------------------- */

/** `g` as it will stand after `queued` has played for `me`: my turn is
 *  pretended, the moves applied in order, the first refused one and those
 *  after it left out. The projection is what a further move is planned on. */
export function projectQueued(g: GameState, me: number, queued: Prepared[]): GameState {
  let sim: GameState = { ...cloneState(g), current: me, actionsLeft: Math.max(Math.min(queued.length, actionsFor(g, g.players[me])), 1), phase: 'action' };
  for (const { action: a } of queued) {
    const r = applyAction(sim, me, a);
    if (!r.state) break;
    sim = { ...r.state, current: me, actionsLeft: Math.max(r.state.actionsLeft, 1), phase: 'action' };
  }
  return sim;
}

/* ------------------------- a prepared move ------------------------- */

/** what would make a prepared move pointless: that player doing that (there) */
/** a past moment of the game shown on the board: the table before a move, and the two moves weighed */
export interface Review {
  at: number;
  round: number;
  state: GameState;
  /** what the board shows, in words: the move just played or the branch taken */
  label?: string;
  /** who played the move on show, for the board to mark it */
  seat?: number;
  /** the seat the analysis is about: whose hand the review shows */
  reader?: number;
  /** that seat's hand as it was before the move on show */
  hand?: Card[];
  mine?: GameAction;
  better?: GameAction;
}

/** the table on show: the position under review while the analysis is
    open, the live game otherwise — for what displays, never for what acts */
export const useShownGame = (): GameState | null => useGame((s) => s.review?.state ?? s.game);

/** a part of the HUD a lesson points at (a `data-lens` mark on the element) */
export type HudLens = 'vp' | 'market' | 'mat' | 'hand' | 'rail' | 'rail-bot' | 'income' | 'ledger' | 'build' | 'network' | 'develop' | 'sell' | 'loan' | 'scout';
/** what a lesson lights: slots of the map (their keys), a part of the HUD, a town to fly to */
export interface Lens {
  slots?: string[];
  hud?: HudLens;
  town?: string;
}

export interface Unless {
  /** a seat, or 'any' for anyone but me */
  player: number | 'any';
  kind: 'sell' | 'build' | 'network';
  /** a town: built there, or a link laid to it (either end) */
  town?: string;
  /** for a build: that works only (a slot picked on the map that takes one) */
  industry?: IndustryType;
  /** for a sale: sold to that merchant, from anywhere */
  merchant?: string;
  /** for a link: that very link, whichever way it is read */
  link?: string;
}

/** does this ledger line fulfil the clause? (`me` never counts as anyone) */
export function unlessHit(u: Unless, e: LedgerEntry, me: number): boolean {
  if (e.player === undefined || e.key !== u.kind) return false;
  if (u.player === 'any' ? e.player === me : e.player !== u.player) return false;
  if (u.link && e.vars?.linkId !== u.link && e.vars?.linkId2 !== u.link) return false;
  if (u.merchant && e.vars?.merchantId !== u.merchant) return false;
  if (u.town) {
    const ends = u.kind === 'network' ? [e.vars?.townA, e.vars?.townB, e.vars?.townA2, e.vars?.townB2] : [e.region];
    if (!ends.includes(u.town)) return false;
  }
  if (u.industry && e.vars?.industry !== u.industry) return false;
  return true;
}

/** the log index of the last action that seat took (a flip credited to
 *  them is somebody else's move) */
export function lastActionOf(g: GameState, seat: number): number {
  let last = -1;
  for (const e of g.ledger) if (e.player === seat && e.at !== undefined && e.at > last && ACTION_VERBS.has(e.verb)) last = e.at;
  return last;
}
const ACTION_VERBS = new Set<LedgerEntry['verb']>(['build', 'network', 'develop', 'sell', 'loan', 'scout', 'pass']);
export interface Prepared {
  action: GameAction;
  /** the first ledger id the condition looks at: the move was prepared before it */
  since: number;
  unless?: Unless;
}
/** the clauses a move naturally wants: the slot it needs kept free, the
 *  link it needs left open, the merchant's beer left in the barrel */
export function suggestUnless(a: GameAction): { key: string; unless: Unless }[] {
  switch (a.kind) {
    case 'build':
      return [
        { key: 'slotTaken', unless: { player: 'any', kind: 'build', town: a.town } },
        { key: 'linkLaid', unless: { player: 'any', kind: 'network', town: a.town } },
      ];
    case 'network': {
      const l = LINKS.find((x) => x.id === a.link);
      if (!l) return [];
      const out: { key: string; unless: Unless }[] = [{ key: 'linkTaken', unless: { player: 'any', kind: 'network', link: l.id } }];
      /* the far end, when it is a town (nobody builds at a merchant's) */
      if (TOWN_BY_ID[l.b]) out.push({ key: 'builtThere', unless: { player: 'any', kind: 'build', town: l.b } });
      return out;
    }
    case 'sell':
      return a.sales.length ? [{ key: 'beerDrunk', unless: { player: 'any', kind: 'sell', merchant: a.sales[0].merchant } }] : [];
    default:
      return [];
  }
}

/** the condition, said in a few words */
export function describeUnless(u: Unless, g: GameState): string {
  const name = u.player === 'any' ? tr('game.topbar.unlessAnyone') : (g.players[u.player]?.name ?? '');
  const where = u.town ? tr('game.topbar.unlessAt', { town: TOWN_BY_ID[u.town]?.name ?? u.town }) : u.merchant ? tr('game.topbar.unlessTo', { merchant: MERCHANT_BY_ID[u.merchant]?.name ?? u.merchant }) : '';
  const link = u.link ? LINKS.find((x) => x.id === u.link) : undefined;
  const what = link ? tr('game.topbar.unlessLink', { a: placeName(link.a), b: placeName(link.b) }) : u.kind === 'build' && u.industry ? tr('game.topbar.unlessBuilds', { works: tr(`game.log.industry.${u.industry}`) }) : tr(`game.topbar.unlessKind.${u.kind}`);
  return tr('game.topbar.unless', { name, what, where });
}

/* ------------------------ a move in a few words ------------------------ */

const VERB_KEY: Record<string, string> = { build: 'verbBuild', network: 'verbNetwork', develop: 'verbDevelop', sell: 'verbSell', loan: 'verbLoan', scout: 'verbScout', pass: 'verbPass' };
const placeName = (id: string): string => TOWN_BY_ID[id]?.name ?? MERCHANT_BY_ID[id]?.name ?? id;
/** a prepared move as the banner lists it */
export function describeAction(a: GameAction): string {
  const verb = tr(`game.hand.${VERB_KEY[a.kind] ?? 'verbPass'}`);
  switch (a.kind) {
    case 'build':
      return `${verb} · ${tr(`game.log.industry.${a.industry}`)} → ${placeName(a.town)}`;
    case 'network': {
      const l = LINKS.find((x) => x.id === a.link);
      const l2 = a.second ? LINKS.find((x) => x.id === a.second) : undefined;
      return `${verb} · ${l ? `${placeName(l.a)} ⇄ ${placeName(l.b)}` : a.link}${l2 ? ` + ${placeName(l2.a)} ⇄ ${placeName(l2.b)}` : ''}`;
    }
    case 'sell':
      return `${verb} · ${a.sales.map((x) => placeName(x.town)).join(', ')}`;
    case 'develop':
      return `${verb} · ${a.industries.map((i) => tr(`game.log.industry.${i}`)).join(', ')}`;
    default:
      return verb;
  }
}

/* ------------------------------ the pins ------------------------------ */

/** the game a reader's pins and page belong to: the table online, the game
 *  at home otherwise. One code names one game at the office, so nothing
 *  needs telling apart any more */
const pinScope = (st: { code: string | null; local: string | null }): string | null => st.code ?? st.local;
/** the pins and the page as they now stand, handed to the office */
function keepNotes(code: string | null, pins: Record<string, string>, page: string): void {
  if (code) writeNotes(code, { pins, page });
}

/* ------------------------- the bots' banter ------------------------- */

/** a bot other than `me`, at random */
function pickBot(g: GameState, me: number): number {
  const bots = g.players.map((p, i) => (p.isBot && i !== me ? i : -1)).filter((i) => i >= 0);
  return bots.length ? bots[Math.floor(Math.random() * bots.length)] : -1;
}
function pickDialect(not?: TelegramKey): TelegramKey {
  const keys = (Object.keys(DIALECT) as TelegramKey[]).filter((k) => k !== not);
  return keys[Math.floor(Math.random() * keys.length)];
}
/** a bot wires a line after a beat, if the game is still the same table */
function botWires(seat: number, key: TelegramKey, delay: number): void {
  /* headless (the tests, the server's bots) has no table to wire to */
  if (seat < 0 || typeof window === 'undefined') return;
  setTimeout(() => {
    const st = useGame.getState();
    if (st.code || !st.game || (st.game.phase === 'game-over' && key !== 'cheers')) return;
    st.receiveTelegram(seat, key);
  }, delay);
}
/** what a human just did, seen from the machines: beer drunk from their
 *  brewery earns a grumble or a jibe; a big sale, a hat tipped now and then */
function botBanter(after: GameState, actor: number, action: GameAction): void {
  const last = after.ledger[after.ledger.length - 1];
  if (!last || last.player !== actor) return;
  if (action.kind === 'sell' && typeof last.vars?.beerFrom === 'string') {
    const owners = new Set(String(last.vars.beerFrom).split(',').map((bit) => Number(bit.split(':')[0])));
    for (const owner of owners) {
      if (!after.players[owner]?.isBot || owner === actor) continue;
      if (Math.random() < 0.7) botWires(owner, Math.random() < 0.5 ? 'myBeer' : pickDialect(), 1200 + Math.random() * 1500);
      return;
    }
  }
  if (action.kind === 'sell' && action.sales.length >= 2 && Math.random() < 0.25) botWires(pickBot(after, actor), 'hatsOff', 1500 + Math.random() * 1000);
}

/* dev only: the store at hand in the console (window.__brass.getState()),
   and a jump straight to the Rail Era (window.__brassRail()) — the canal
   ceremony played out on the spot: scoring, sweep, re-deal — to look at
   the second painting without playing nine rounds. Home tables only. */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  const w = window as unknown as { __brass?: typeof useGame; __brassRail?: () => string };
  w.__brass = useGame;
  w.__brassRail = () => {
    const st = useGame.getState();
    const g = st.game;
    if (!g || st.code) return 'home tables only';
    if (g.era === 'rail') return 'already the rail era';
    const s = structuredClone(g);
    scoreEra(s, 'canal');
    beginRailEra(s);
    useGame.setState({ game: s, selectedCardId: null, verb: null });
    return 'rail era';
  };
}
