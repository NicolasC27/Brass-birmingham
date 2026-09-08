/* ------------------------------------------------------------------ */
/* BRASSWORKS — zustand store: game state + interaction selection.     */
/* Pure reducers live in engine.ts; this store is the single seam the  */
/* UI consumes (and a future backend can replace).                     */
/* ------------------------------------------------------------------ */

import { create } from 'zustand';
import { buildTargets, canLoan, canScout, defaultSetup, deserialize, developOptions, doubleLinkPlan, linkTargets, marketSaleOnBuild, newGame, sellTargets, serialize } from './engine';
import type { BuildTarget, LinkTarget, SellTarget } from './engine';
import { chooseBotMove } from './bot';
import { tr } from '@/i18n';
import { actorOf, applyAction, botAction, canUndoNow, fallbackAction, humanActionIndices, setupOf, undoLastHuman } from './actions';
import type { UndoMark } from './actions';
import type { GameAction } from './actions';
import type { BotMove } from './bot';
import { INDUSTRIES, INDUSTRY_LABEL, MERCHANT_BY_ID, TOWN_BY_ID, incomeLevel } from './data';
import { onlineWire } from '@/online/net';
import type { Pause, Rollback, ServerMessage } from '@/online/protocol';
import type { Wire, WireStatus } from '@/online/wire';
import type {
  Card,
  FinalPayload,
  GameState,
  IndustryType,
  SetupPayload,
  Verb,
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
  scoutPick: string[];
  hoverKey: string | null;
  shake: Shake | null;
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
  runBot: () => BotMove | null;
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
  scoutPick: [] as string[],
  hoverKey: null,
  shake: null as Shake | null,
  humanMarks: [] as UndoMark[],
  loanConfirm: false,
  loanPeek: false,
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
      set({ ...clearSelection, game: null, code, seat: null, line: wire.status, serverUndo: false, candle: null, mood: NO_MOOD, tutorial: false, ceremony: null, gameOverOpen: false, coachStep: -1 });
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
      game,
      code: null,
      seat: null,
      line: null,
      candle: null,
      mood: NO_MOOD,
      tutorial,
      humanMarks,
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
    set({ ...clearSelection, game, humanMarks: [], ceremony: null, gameOverOpen: false });
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
      set({ selectedCardId: null, verb: null, buildPick: null, linkPick: null, sellPick: null, sellPicks: [], developPick: [] });
      return;
    }
    set({ selectedCardId: id, verb: null, buildPick: null, linkPick: null, secondLinkPick: null, sellPick: null, sellPicks: [], developPick: [], shake: null });
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
    set({ verb: v, buildPick: null, linkPick: null, secondLinkPick: null, sellPick: null, sellPicks: [], developPick: [], shake: null });
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
    set({ developPick: cur.includes(ind) ? cur.filter((x) => x !== ind) : cur.length < 2 ? [...cur, ind] : cur });
  },

  toggleScout: (cardId) => {
    const cur = get().scoutPick;
    set({ scoutPick: cur.includes(cardId) ? cur.filter((x) => x !== cardId) : cur.length < 3 ? [...cur, cardId] : cur });
  },

  setHover: (key) => set({ hoverKey: key }),

  reject: (key, reason) => set({ shake: { key, reason, at: Date.now() } }),

  cancel: () => set({ ...clearSelection }),

  setLoanConfirm: (open) => set({ loanConfirm: open }),
  setLoanPeek: (on) => set({ loanPeek: on }),
  setRulesOpen: (open) => set({ rulesOpen: open }),
  openMat: (i) => set({ matPlayer: i }),
  closeMat: () => set({ matPlayer: null }),
  setMarketFocus: (on) => set({ marketFocus: on }),
  setLedgerFilter: (f) => set({ ledgerFilter: f }),
  flyToRegion: (key) => set({ flyTo: { key, at: Date.now() } }),
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
    const card = g.players[g.current].hand.find((c) => c.id === st.selectedCardId);
    let action: GameAction | null = null;
    switch (st.verb) {
      case 'build':
        if (card && st.buildPick?.valid) action = { kind: 'build', card: card.id, town: st.buildPick.town, slot: st.buildPick.slot, industry: st.buildPick.industry };
        break;
      case 'network':
        if (card && st.linkPick?.valid) action = { kind: 'network', card: card.id, link: st.linkPick.link.id, second: st.secondLinkPick?.link.id };
        break;
      case 'develop':
        if (card && st.developPick.length > 0) action = { kind: 'develop', card: card.id, industries: st.developPick };
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
    if (action) get().dispatch(action);
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
    /* a vote is not a turn: nothing to take back */
    const human = action.kind !== 'concede' && g.phase === 'action' && !g.players[g.current].isBot;
    set({ ...clearSelection, game: mut, ceremony, gameOverOpen: mut.phase === 'game-over', humanMarks: human ? [...get().humanMarks, { at: g.actions.length, by: g.current }] : get().humanMarks });
    get().save();
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
    const move = chooseBotMove(g, g.current);
    const wanted = botAction(move);
    // nothing playable (or a move the engine refuses): scout if allowed, else pass
    if (!(wanted && get().dispatch(wanted))) get().dispatch(fallbackAction(g, g.current));
    return move;
  },

  /* --------------------------- derived -------------------------- */

  currentTargets: () => {
    const st = get();
    const g = st.game;
    if (!g || g.phase !== 'action') return [];
    const p = g.players[g.current];
    if (p.isBot) return [];
    const card = p.hand.find((c) => c.id === st.selectedCardId);
    if (!card || st.verb !== 'build') return [];
    return buildTargets(g, g.current, card);
  },

  currentLinks: () => {
    const st = get();
    const g = st.game;
    if (!g || g.phase !== 'action') return [];
    const p = g.players[g.current];
    if (p.isBot || st.verb !== 'network') return [];
    const list = linkTargets(g, g.current);
    /* rail era, first link picked: links touching it become the DOUBLE option
       (£15 + 1 coal each + 1 beer) even when they don't touch the network yet */
    const first = st.linkPick;
    if (!first || g.era !== 'rail') return list;
    return list.map((t) => {
      if (t.link.id === first.link.id) return t;
      const ends = [first.link.a, first.link.b, first.link.alsoConnects].filter(Boolean);
      const touches = ends.includes(t.link.a) || ends.includes(t.link.b);
      if (!touches) return t;
      const dbl = doubleLinkPlan(g, g.current, first, t.link);
      return { ...t, valid: dbl.valid, reason: dbl.reason, total: dbl.total, coalPlan: dbl.coal2 };
    });
  },

  currentSells: () => {
    const st = get();
    const g = st.game;
    if (!g || g.phase !== 'action') return [];
    const p = g.players[g.current];
    if (p.isBot || st.verb !== 'sell') return [];
    return sellTargets(g, g.current);
  },

  currentDevelops: () => {
    const st = get();
    const g = st.game;
    if (!g || g.phase !== 'action') return [];
    return developOptions(g, g.current);
  },
}));

/* -------------------- selection summary helper -------------------- */

/** what the pending action really costs — tile or link price PLUS the coal
 *  and iron bought at the market — and what the player keeps afterwards */
export function confirmCost(
  st: { verb: Verb | null; buildPick: BuildTarget | null; linkPick: LinkTarget | null; secondLinkPick: LinkTarget | null; developPick: IndustryType[] },
  game: GameState,
): { total: number; after: number } | null {
  const money = game.players[game.current].money;
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
      const opts = developOptions(game, game.current);
      total = st.developPick.reduce((a, ind) => a + (opts.find((o) => o.industry === ind)?.iron.totalCost ?? 0), 0);
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
  scoutPick: string[];
  selectedCardId: string | null;
}): string | null {
  switch (st.verb) {
    case 'build': {
      const t = st.buildPick;
      if (!t) return null;
      const lv = INDUSTRIES[t.industry][t.level - 1];
      const bits = [tr('game.confirm.build', { industry: tr(`game.log.industry.${t.industry}`), level: t.level, town: TOWN_BY_ID[t.town].name, price: lv.cost })];
      const marketCoal = t.coalPlan.sources.filter((x) => x.kind === 'market');
      if (marketCoal.length) bits.push(tr('game.confirm.marketCoal', { n: marketCoal.length, cost: t.coalPlan.totalCost }));
      const marketIron = t.ironPlan.sources.filter((x) => x.kind === 'market');
      if (marketIron.length) bits.push(tr('game.confirm.marketIron', { n: marketIron.length, cost: t.ironPlan.totalCost }));
      /* a mine or works that reaches a merchant sells its spare cubes at once: say so */
      const g = useGame.getState().game;
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
    case 'develop':
      return st.developPick.length ? tr('game.confirm.develop', { list: st.developPick.map((i) => tr(`game.log.industry.${i}`)).join(' + '), n: st.developPick.length }) : null;
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

export function verbsForCard(st: { game: GameState | null; selectedCardId: string | null }): { verb: Verb; ok: boolean; reason?: string }[] {
  const g = st.game;
  const card = g?.players[g.current]?.hand.find((c) => c.id === st.selectedCardId);
  if (!g || !card) {
    return [
      { verb: 'build', ok: false, reason: 'Select a card first' },
      { verb: 'network', ok: false, reason: 'Select a card first' },
      { verb: 'develop', ok: false, reason: 'Select a card first' },
      { verb: 'sell', ok: false, reason: 'Select a card first' },
      { verb: 'loan', ok: !!g && canLoan(g, g.current).ok, reason: g ? canLoan(g, g.current).reason : undefined },
      { verb: 'scout', ok: !!g && canScout(g, g.current).ok, reason: g ? canScout(g, g.current).reason : undefined },
      { verb: 'pass', ok: false, reason: 'Select the card to discard first' },
    ];
  }
  const i = g.current;
  return [
    {
      verb: 'build',
      ok: buildTargets(g, i, card).some((t) => t.valid),
      reason: 'No valid construction site for this card',
    },
    { verb: 'network', ok: linkTargets(g, i).some((t) => t.valid), reason: 'No affordable link from your network' },
    { verb: 'develop', ok: developOptions(g, i).some((d) => d.valid), reason: 'Nothing worth developing (needs iron)' },
    { verb: 'sell', ok: sellTargets(g, i).some((t) => t.valid), reason: 'No goods connected to a demanding merchant' },
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
      useGame.setState({
        ...clearSelection,
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
  useGame.setState({ code: null, seat: null, line: null, serverUndo: false, candle: null, mood: NO_MOOD });
}

/* dev only: the store at hand in the console (window.__brass.getState()) */
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __brass?: typeof useGame }).__brass = useGame;
