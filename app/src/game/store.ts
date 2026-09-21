/* ------------------------------------------------------------------ */
/* BRASSWORKS — zustand store: game state + interaction selection.     */
/* Pure reducers live in engine.ts; this store is the single seam the  */
/* UI consumes (and a future backend can replace).                     */
/* ------------------------------------------------------------------ */

import { create } from 'zustand';
import { actionsFor, beginRailEra, buildTargets, canLoan, canScout, defaultSetup, deserialize, developOptions, developTwice, doubleLinkPlan, linkTargets, marketSaleOnBuild, newGame, planIronFrom, scoreEra, sellTargets, serialize, tileKey } from './engine';
import type { BuildTarget, LinkTarget, SellTarget, SupplyPlan } from './engine';
import { chooseBotAction, isExpert } from './search';
import { readForm, recordForm } from './form';
import { tr } from '@/i18n';
import { actorOf, applyAction, canUndoNow, fallbackAction, humanActionIndices, setupOf, undoLastHuman } from './actions';
import type { UndoMark } from './actions';
import type { GameAction } from './actions';
import { INDUSTRIES, INDUSTRY_LABEL, LINKS, MERCHANT_BY_ID, TOWN_BY_ID, incomeLevel } from './data';
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
  SetupPayload,
  Verb,
  LedgerEntry,
} from './types';
import { RESUME_KEY, SETUP_KEY } from './types';
import { ledgerText } from './ledgerText';
import { TUTORIAL_KEY, TUTORIAL_SEED } from './quickplay';

export interface Shake {
  key: string;
  reason: string;
  at: number;
}

interface GameStore {
  game: GameState | null;
  /* ---- the table, when the game is played over the wire ---- */
  /** the online table's code, null when the game is played in this browser */
  code: string | null;
  /** my seat at that table (the engine's player index), null offline */
  seat: number | null;
  /** the state of the line, null offline */
  line: WireStatus | null;
  /** what the server says about taking the last action back */
  serverUndo: boolean;
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
  marketFocus: boolean;
  /** everything, one player's doings (`p<seat>`), the money or the map */
  ledgerFilter: 'all' | 'economy' | 'network' | `p${number}`;
  /** camera fly-to request (Ledger click, bot follow) — `at` dedupes repeats */
  flyTo: { key: string; at: number } | null;
  /** camera glides to wherever a bot just played */
  followBots: boolean;
  /** player index highlighted on the map (others dimmed), null = off */
  spotlight: number | null;
  /** a player rail chip under the pointer: their whole network lights up */
  netPeek: number | null;
  setNetPeek: (i: number | null) => void;
  coachStep: number; // -1 hidden
  /** this game is the guided one: the guide's steps show */
  tutorial: boolean;
  /** the guide is done with: the game goes on as a plain one */
  endTutorial: () => void;
  /** the guide holds the machine: it explains one move before the next is played */
  botHold: boolean;
  setBotHold: (on: boolean) => void;
  ceremony: 'canal-end' | null;
  gameOverOpen: boolean;

  /* ---- lifecycle ---- */
  /** `code` names an online table; without one the game is played here */
  init: (code?: string) => void;
  /** is the seat to act mine? (always, when the game is played here) */
  myTurn: () => boolean;
  /** the player whose hand this screen shows */
  mySeat: () => number;
  /** watching an online table from no seat: every hand shut, nothing to play */
  spectating: () => boolean;
  /** what is left of the turn candle right now, in ms (null: none burns) */
  msLeft: () => number | null;
  reset: () => void;
  save: () => void;

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

const NO_MOOD = { pause: null, breaks: [] as number[], rollback: null, frozen: false, host: -1 };

/** a local game against the machines is over: the player's form moves,
 *  unless the table folded or no human sat at it */
function noteForm(g: GameState): void {
  if (g.abandoned || g.winner === undefined) return;
  if (!g.players.some((p) => p.isBot) || !g.players.some((p) => !p.isBot)) return;
  recordForm(!g.players[g.winner].isBot);
}

function readSetup(): SetupPayload {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SetupPayload;
      if (parsed.players?.length >= 2) return parsed;
    }
  } catch {
    /* fall through */
  }
  return defaultSetup();
}

export function buildFinalPayload(g: GameState): FinalPayload {
  return {
    players: g.players.map((p) => ({
      name: p.name,
      color: p.color,
      vp: p.vp,
      income: incomeLevel(p.income),
      links: Object.values(g.links).filter((l) => l.owner === g.players.indexOf(p)).length,
      industries: Object.values(g.tiles).filter((t) => t.owner === g.players.indexOf(p)).length + p.stats.sold,
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
  scoutPick: [] as string[],
  hoverKey: null,
  shake: null as Shake | null,
  humanMarks: [] as UndoMark[],
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
  preparing: false,
  queued: [] as Prepared[],
  previewQueue: false,
  surveySeat: null as number | null,
  unlessPick: null as number | null,
};

export const useGame = create<GameStore>((set, get) => ({
  game: null,
  code: null,
  seat: null,
  line: null,
  serverUndo: false,
  candle: null,
  mood: NO_MOOD,
  ...clearSelection,
  ...freshTable,
  pins: readPins(null),
  marketFocus: false,
  ledgerFilter: 'all',
  flyTo: null,
  followBots: true,
  tutorial: false,
  botHold: false,
  setBotHold: (on) => set((s) => (s.botHold === on ? s : { botHold: on })),
  spotlight: null,
  netPeek: null,
  coachStep: -1,
  ceremony: null,
  gameOverOpen: false,
  rulesOpen: false,
  matPlayer: null,

  init: (code) => {
    /* the table's code is in the address bar: a game online is a place you
       can link to, come back to and hand to someone else */
    const wire = code ? onlineWire() : null;
    if (code && wire) {
      /* the table's pins and notes come back with the table */
      set({ ...clearSelection, ...freshTable, game: null, code, seat: null, line: wire.status, serverUndo: false, candle: null, mood: NO_MOOD, tutorial: false, ceremony: null, gameOverOpen: false, coachStep: -1, pins: readPins(code) });
      listen(code, wire);
      return;
    }
    const resumed = (() => {
      try {
        const raw = localStorage.getItem(RESUME_KEY);
        return raw ? deserialize(raw) : null;
      } catch {
        return null;
      }
    })();
    /* the guided game: a fixed deal, remembered by its seed so a reload keeps the guide */
    const wanted = (() => {
      try {
        return localStorage.getItem(TUTORIAL_KEY);
      } catch {
        return null;
      }
    })();
    const seedWanted = wanted === 'new' ? TUTORIAL_SEED : wanted && /^\d+$/.test(wanted) ? Number(wanted) : null;
    const game = resumed ?? (seedWanted !== null ? newGame(readSetup(), seedWanted) : newGame(readSetup()));
    const tutorial = seedWanted !== null && game.seed === seedWanted;
    if (tutorial) {
      try {
        localStorage.setItem(TUTORIAL_KEY, String(game.seed));
        /* the deal is kept at once: a reload before the first move keeps the guide */
        if (!resumed) localStorage.setItem(RESUME_KEY, serialize(game));
      } catch {
        /* non-fatal */
      }
    }
    const coached = (() => {
      try {
        return localStorage.getItem('brassworks.coached.v1') === '1';
      } catch {
        return true;
      }
    })();
    const humanMarks = (() => {
      try {
        return humanActionIndices(setupOf(game), game.seed, game.actions);
      } catch {
        return [];
      }
    })();
    set({
      ...clearSelection,
      ...freshTable,
      game,
      code: null,
      seat: null,
      line: null,
      candle: null,
      mood: NO_MOOD,
      tutorial,
      humanMarks,
      /* a game resumed keeps its pins and notes; a new one starts clean */
      pins: resumed ? readPins(null) : {},
      ceremony: game.phase === 'scoring-canal' ? 'canal-end' : null,
      gameOverOpen: false,
      coachStep: coached || tutorial ? -1 : 0,
    });
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

  reset: () => {
    /* a rematch is a table's business, not a page's: online it does nothing */
    if (get().code) return;
    const game = newGame(readSetup());
    set({ ...clearSelection, ...freshTable, game, humanMarks: [], ceremony: null, gameOverOpen: false, pins: {} });
    writePins(null, {});
    try {
      localStorage.setItem(RESUME_KEY, serialize(game));
    } catch {
      /* storage full/blocked — non-fatal */
    }
  },

  save: () => {
    const g = get().game;
    /* a filtered state is nobody's save: it would resume a crippled game */
    if (!g || get().code) return;
    try {
      localStorage.setItem(RESUME_KEY, serialize(g));
    } catch {
      /* non-fatal */
    }
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
      set({ selectedCardId: null, verb: null, buildPick: null, linkPick: null, sellPick: null, sellPicks: [], developPick: [], developIron: [] });
      return;
    }
    set({ selectedCardId: id, verb: null, buildPick: null, linkPick: null, secondLinkPick: null, sellPick: null, sellPicks: [], developPick: [], developIron: [], shake: null });
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
    set({ verb: v, buildPick: null, linkPick: null, secondLinkPick: null, sellPick: null, sellPicks: [], developPick: [], developIron: [], shake: null });
  },

  pickBuild: (t) => set({ buildPick: t, shake: null }),
  pickLink: (t) => {
    const st = get();
    if (!st.linkPick) {
      set({ linkPick: t });
      return;
    }
    if (st.linkPick && t && st.game?.era === 'rail') {
      const first = st.linkPick.link;
      if (t.link.id === first.id) {
        set({ linkPick: null, secondLinkPick: null });
        return;
      }
      const touches = [first.a, first.b].includes(t.link.a) || [first.a, first.b].includes(t.link.b);
      if (touches) {
        set({ secondLinkPick: t });
      } else {
        set({ linkPick: t, secondLinkPick: null });
      }
    } else {
      set({ linkPick: t });
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
    set({ sellPick: next[next.length - 1] ?? null, sellPicks: next, shake: null });
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
      set({ queued: rest, shake: { key: '', reason: tr('game.hand.queueDropped', { reason: r.error ?? '' }), at: Date.now() } });
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
    writePins(get().code, pins);
  },
  setPinNote: (town, note) => {
    /* a word on a town pins it; an emptied note leaves the pin standing */
    const pins = { ...get().pins, [town]: note };
    set({ pins });
    writePins(get().code, pins);
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
  setMarketFocus: (on) => set({ marketFocus: on }),
  setLedgerFilter: (f) => set({ ledgerFilter: f }),
  flyToRegion: (key) => set({ flyTo: { key, at: Date.now() } }),
  toggleSurveyEmpire: (seat) => set((st) => ({ surveyEmpires: st.surveyEmpires.includes(seat) ? st.surveyEmpires.filter((x) => x !== seat) : [...st.surveyEmpires, seat] })),
  setGlimpse: (glimpse) => set({ glimpse }),
  toggleFollowBots: () => set((s) => ({ followBots: !s.followBots })),
  setSpotlight: (i) => set({ spotlight: i }),
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
        if (card && st.buildPick?.valid) action = { kind: 'build', card: card.id, town: st.buildPick.town, slot: st.buildPick.slot, industry: st.buildPick.industry };
        break;
      case 'network':
        if (card && st.linkPick?.valid) action = { kind: 'network', card: card.id, link: st.linkPick.link.id, second: st.secondLinkPick?.link.id };
        break;
      case 'develop':
        if (card && st.developPick.length > 0) action = { kind: 'develop', card: card.id, industries: st.developPick, ironFrom: st.developIron };
        break;
      case 'sell':
        if (card && st.sellPicks.some((x) => x.valid)) action = { kind: 'sell', card: card.id, sales: st.sellPicks.filter((x) => x.valid).map((x) => ({ town: x.town, slot: x.slot, merchant: x.merchant })) };
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
    const r = applyAction(g, actorOf(g, action), action);
    if (!r.state) return false;
    const mut = r.state;
    const ceremony = mut.phase === 'scoring-canal' ? ('canal-end' as const) : null;
    /* a vote, or a chair handed over, is not a turn: nothing to take back */
    const human = action.kind !== 'concede' && action.kind !== 'resign' && g.phase === 'action' && !g.players[g.current].isBot;
    set({ ...clearSelection, game: mut, ceremony, gameOverOpen: mut.phase === 'game-over', humanMarks: human ? [...get().humanMarks, { at: g.actions.length, by: g.current }] : get().humanMarks });
    get().save();
    if (mut.phase === 'game-over' && !get().code) noteForm(mut);
    if (human) botBanter(mut, g.current, action);
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
    set({ ...clearSelection, game: back, humanMarks: marks.slice(0, -1), ceremony: back.phase === 'scoring-canal' ? 'canal-end' : null, gameOverOpen: false });
    get().save();
    return true;
  },

  endCeremony: () => {
    const g = get().game;
    if (!g || g.phase !== 'scoring-canal') return;
    if (get().code) {
      get().dispatch({ kind: 'begin-rail' });
      return;
    }
    const r = applyAction(g, g.current, { kind: 'begin-rail' });
    if (!r.state) return;
    set({ game: r.state, ceremony: null, gameOverOpen: r.state.phase === 'game-over' });
    get().save();
    if (r.state.phase === 'game-over') noteForm(r.state);
  },

  closeGameOver: () => set({ gameOverOpen: false }),

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
    set({ tutorial: false });
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
      const touches = ends.includes(t.link.a) || ends.includes(t.link.b);
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
  st: { verb: Verb | null; buildPick: BuildTarget | null; linkPick: LinkTarget | null; secondLinkPick: LinkTarget | null; developPick: IndustryType[]; developIron: (string | null)[] },
  game: GameState,
  actor: number = game.current,
): { total: number; after: number } | null {
  const money = game.players[actor].money;
  let total: number;
  switch (st.verb) {
    case 'build':
      if (!st.buildPick) return null;
      total = st.buildPick.total;
      break;
    case 'network':
      if (!st.linkPick) return null;
      total = st.secondLinkPick ? doubleLinkPlan(game, game.current, st.linkPick, st.secondLinkPick.link).total : st.linkPick.total;
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
        return tr('game.confirm.double', { a: name(t.link.a), b: name(t.link.b), a2: name(s2.link.a), b2: name(s2.link.b), price: s2.total });
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
  if (card.kind === 'industry') return card.industry2 ? `${INDUSTRY_LABEL[card.industry!]} / ${INDUSTRY_LABEL[card.industry2]}` : INDUSTRY_LABEL[card.industry!];
  if (card.kind === 'wild-location') return tr('game.confirm.wildLocation');
  return tr('game.confirm.wildIndustry');
}

/** the one refusal worth telling when no site takes the card: the most
 *  actionable reason among the sites the card could otherwise reach —
 *  missing coal or iron, money, network — before the merely structural
 *  ones (wrong slot, occupied) that apply to every other slot on the map */
const BUILD_REASON_RANK: (string | RegExp)[] = [
  'No connected coal — reach a mine or a merchant',
  'No coal left anywhere',
  'No iron available anywhere',
  /^Needs £/,
  'Not in your network',
  'Canal Era: one tile per location',
  /overbuil/,
  'Occupied by another industry',
  /era$/,
  /tiles left$/,
];
export function whyNoBuild(targets: BuildTarget[]): string {
  let best: { rank: number; n: number; reason: string } | null = null;
  const seen = new Map<string, number>();
  for (const t of targets) {
    if (t.valid || !t.reason) continue;
    seen.set(t.reason, (seen.get(t.reason) ?? 0) + 1);
  }
  for (const [reason, n] of seen) {
    let rank = BUILD_REASON_RANK.findIndex((r) => (typeof r === 'string' ? r === reason : r.test(reason)));
    if (rank < 0) rank = BUILD_REASON_RANK.length;
    if (!best || rank < best.rank || (rank === best.rank && n > best.n)) best = { rank, n, reason };
  }
  return best?.reason ?? 'No valid construction site for this card';
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
  return [
    { verb: 'build', ok: sites.some((t) => t.valid), reason: whyNoBuild(sites), tryable: true },
    { verb: 'network', ok: linkTargets(g, i).some((t) => t.valid), reason: 'No affordable link from your network', tryable: true },
    { verb: 'develop', ok: developOptions(g, i).some((d) => d.valid), reason: 'Nothing worth developing (needs iron)', tryable: true },
    { verb: 'sell', ok: sellTargets(g, i).some((t) => t.valid), reason: 'No goods connected to a demanding merchant', tryable: true },
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
  const code = useGame.getState().code;
  if (code) onlineWire()?.unwatch(code);
  useGame.setState({ code: null, seat: null, line: null, serverUndo: false, candle: null, mood: NO_MOOD });
}

/* --------------------- the table once my moves have played --------------------- */

/** `g` as it will stand after `queued` has played for `me`: my turn is
 *  pretended, the moves applied in order, the first refused one and those
 *  after it left out. The projection is what a further move is planned on. */
export function projectQueued(g: GameState, me: number, queued: Prepared[]): GameState {
  let sim: GameState = { ...structuredClone(g), current: me, actionsLeft: Math.max(Math.min(queued.length, actionsFor(g, g.players[me])), 1), phase: 'action' };
  for (const { action: a } of queued) {
    const r = applyAction(sim, me, a);
    if (!r.state) break;
    sim = { ...r.state, current: me, actionsLeft: Math.max(r.state.actionsLeft, 1), phase: 'action' };
  }
  return sim;
}

/* ------------------------- a prepared move ------------------------- */

/** what would make a prepared move pointless: that player doing that (there) */
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

const PINS_KEY = 'brassworks.pins.v1';
/** each table keeps its own pins: the code online, the home table otherwise */
const pinsKey = (code: string | null): string => (code ? `${PINS_KEY}:${code}` : PINS_KEY);
/** the reader's pinned towns and notes, kept across reloads of the same table */
function readPins(code: string | null): Record<string, string> {
  try {
    const raw = localStorage.getItem(pinsKey(code));
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return v && typeof v === 'object' ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}
function writePins(code: string | null, pins: Record<string, string>): void {
  try {
    localStorage.setItem(pinsKey(code), JSON.stringify(pins));
  } catch {
    /* non-fatal */
  }
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
