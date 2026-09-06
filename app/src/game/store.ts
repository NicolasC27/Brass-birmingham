/* ------------------------------------------------------------------ */
/* BRASSWORKS — zustand store: game state + interaction selection.     */
/* Pure reducers live in engine.ts; this store is the single seam the  */
/* UI consumes (and a future backend can replace).                     */
/* ------------------------------------------------------------------ */

import { create } from 'zustand';
import {
  advance,
  applyBuild,
  applyDevelop,
  applyLoan,
  applyNetwork,
  applyPass,
  applyScout,
  applySell,
  beginRailEra,
  buildTargets,
  canLoan,
  canScout,
  doubleLinkPlan,
  defaultSetup,
  deserialize,
  developOptions,
  linkTargets,
  newGame,
  sellTargets,
  serialize,
} from './engine';
import type { BuildTarget, LinkTarget, SellTarget } from './engine';
import { chooseBotMove } from './bot';
import type { BotMove } from './bot';
import { INDUSTRIES, INDUSTRY_LABEL, MERCHANT_BY_ID, TOWN_BY_ID, incomeLevel } from './data';
import type {
  Card,
  FinalPayload,
  GameState,
  IndustryType,
  SetupPayload,
  Verb,
} from './types';
import { RESUME_KEY, SETUP_KEY } from './types';

export interface Shake {
  key: string;
  reason: string;
  at: number;
}

interface GameStore {
  game: GameState | null;
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
  marketFocus: boolean;
  ledgerFilter: 'all' | 'me' | 'economy' | 'network';
  /** camera fly-to request (Ledger click, bot follow) — `at` dedupes repeats */
  flyTo: { key: string; at: number } | null;
  /** camera glides to wherever a bot just played */
  followBots: boolean;
  /** player index highlighted on the map (others dimmed), null = off */
  spotlight: number | null;
  coachStep: number; // -1 hidden
  ceremony: 'canal-end' | null;
  gameOverOpen: boolean;

  /* ---- lifecycle ---- */
  init: () => void;
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
  setLoanConfirm: (open: boolean) => void;
  setLoanPeek: (on: boolean) => void;
  setRulesOpen: (open: boolean) => void;
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

  /* ---- derived ---- */
  currentTargets: () => BuildTarget[];
  currentLinks: () => LinkTarget[];
  currentSells: () => SellTarget[];
  currentDevelops: () => ReturnType<typeof developOptions>;
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
    })),
    eras: [
      { name: 'Canal' as const, scores: g.canalScores ?? g.players.map(() => 0) },
      { name: 'Rail' as const, scores: g.finalScores ?? g.players.map(() => 0) },
    ],
    winnerIndex: g.winner ?? 0,
    timeline: g.ledger
      .filter((e) => e.verb !== 'system' || e.text.includes('Era'))
      .slice(-40)
      .map((e) => `[${e.era === 'canal' ? 'Canal' : 'Rail'} R${e.round}] ${e.text}`),
    history: g.history ?? [],
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
  loanConfirm: false,
  loanPeek: false,
};

export const useGame = create<GameStore>((set, get) => ({
  game: null,
  ...clearSelection,
  marketFocus: false,
  ledgerFilter: 'all',
  flyTo: null,
  followBots: false,
  spotlight: null,
  coachStep: -1,
  ceremony: null,
  gameOverOpen: false,
  rulesOpen: false,

  init: () => {
    const resumed = (() => {
      try {
        const raw = localStorage.getItem(RESUME_KEY);
        return raw ? deserialize(raw) : null;
      } catch {
        return null;
      }
    })();
    const game = resumed ?? newGame(readSetup());
    const coached = (() => {
      try {
        return localStorage.getItem('brassworks.coached.v1') === '1';
      } catch {
        return true;
      }
    })();
    set({
      ...clearSelection,
      game,
      ceremony: game.phase === 'scoring-canal' ? 'canal-end' : null,
      gameOverOpen: false,
      coachStep: coached ? -1 : 0,
    });
  },

  reset: () => {
    const game = newGame(readSetup());
    set({ ...clearSelection, game, ceremony: null, gameOverOpen: false });
    try {
      localStorage.setItem(RESUME_KEY, serialize(game));
    } catch {
      /* storage full/blocked — non-fatal */
    }
  },

  save: () => {
    const g = get().game;
    if (!g) return;
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
  setMarketFocus: (on) => set({ marketFocus: on }),
  setLedgerFilter: (f) => set({ ledgerFilter: f }),
  flyToRegion: (key) => set({ flyTo: { key, at: Date.now() } }),
  toggleFollowBots: () => set((s) => ({ followBots: !s.followBots })),
  setSpotlight: (i) => set({ spotlight: i }),
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
    const p = g.players[g.current];
    const card = p.hand.find((c) => c.id === st.selectedCardId);
    const mut = structuredClone(g);
    let ok = false;

    switch (st.verb) {
      case 'build': {
        if (!card || !st.buildPick?.valid) return;
        ok = applyBuild(mut, mut.current, card, st.buildPick);
        break;
      }
      case 'network': {
        if (!card || !st.linkPick?.valid) return;
        ok = applyNetwork(mut, mut.current, card, st.linkPick, st.secondLinkPick ?? undefined);
        break;
      }
      case 'develop': {
        if (!card || st.developPick.length === 0) return;
        ok = applyDevelop(mut, mut.current, card, st.developPick);
        break;
      }
      case 'sell': {
        if (!card || !st.sellPicks.some((x) => x.valid)) return;
        ok = applySell(mut, mut.current, card, st.sellPicks.filter((x) => x.valid));
        break;
      }
      case 'scout': {
        if (st.scoutPick.length !== 3) return;
        ok = applyScout(mut, mut.current, st.scoutPick);
        break;
      }
      default:
        return;
    }
    if (!ok) return;
    advance(mut);
    const ceremony = mut.phase === 'scoring-canal' ? ('canal-end' as const) : null;
    set({ ...clearSelection, game: mut, ceremony, gameOverOpen: mut.phase === 'game-over' });
    get().save();
  },

  endCeremony: () => {
    const g = get().game;
    if (!g || g.phase !== 'scoring-canal') return;
    const mut = structuredClone(g);
    beginRailEra(mut);
    set({ game: mut, ceremony: null, gameOverOpen: mut.phase === 'game-over' });
    get().save();
  },

  closeGameOver: () => set({ gameOverOpen: false }),

  takeLoan: () => {
    const g = get().game;
    if (!g || g.phase !== 'action') return;
    const mut = structuredClone(g);
    const card = mut.players[mut.current].hand.find((c) => c.id === get().selectedCardId);
    if (!applyLoan(mut, mut.current, card)) return;
    advance(mut);
    const ceremony = mut.phase === 'scoring-canal' ? ('canal-end' as const) : null;
    set({ ...clearSelection, game: mut, ceremony, gameOverOpen: mut.phase === 'game-over' });
    get().save();
  },

  pass: (reason) => {
    const g = get().game;
    if (!g || g.phase !== 'action') return;
    const mut = structuredClone(g);
    // passing costs a card per action skipped; the selected card goes first
    applyPass(mut, mut.current, get().selectedCardId ?? undefined, reason);
    advance(mut);
    const ceremony = mut.phase === 'scoring-canal' ? ('canal-end' as const) : null;
    set({ ...clearSelection, game: mut, ceremony, gameOverOpen: mut.phase === 'game-over' });
    get().save();
  },

  /* ---------------------------- bots ---------------------------- */

  runBot: () => {
    const st = get();
    const g = st.game;
    if (!g || g.phase !== 'action') return null;
    const p = g.players[g.current];
    if (!p.isBot) return null;
    const move = chooseBotMove(g, g.current);
    const mut = structuredClone(g);
    let ok = false;
    if (move) {
      switch (move.kind) {
        case 'build':
          ok = !!(move.card && move.build && applyBuild(mut, mut.current, move.card, move.build));
          break;
        case 'network':
          ok = !!(move.card && move.link && applyNetwork(mut, mut.current, move.card, move.link));
          break;
        case 'develop':
          ok = !!(move.card && move.develop && applyDevelop(mut, mut.current, move.card, move.develop));
          break;
        case 'sell':
          ok = !!(move.card && move.sell && applySell(mut, mut.current, move.card, move.sell));
          break;
        case 'loan':
          ok = applyLoan(mut, mut.current);
          break;
        case 'scout':
          ok = !!(move.scoutCards && applyScout(mut, mut.current, move.scoutCards));
          break;
      }
    }
    if (!ok) {
      // nothing playable: scout if allowed, else pass (which still costs a card)
      if (!(canScout(mut, mut.current).ok && applyScout(mut, mut.current, p.hand.slice(0, 3).map((c) => c.id)))) {
        applyPass(mut, mut.current);
      }
    }
    advance(mut);
    const ceremony = mut.phase === 'scoring-canal' ? ('canal-end' as const) : null;
    set({ ...clearSelection, game: mut, ceremony, gameOverOpen: mut.phase === 'game-over' });
    get().save();
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
      const bits = [`Build · ${INDUSTRY_LABEL[t.industry]} L${t.level}`, TOWN_BY_ID[t.town].name, `£${lv.cost}`];
      const marketCoal = t.coalPlan.sources.filter((x) => x.kind === 'market');
      if (marketCoal.length) bits.push(`coal ×${marketCoal.length} ← market £${t.coalPlan.totalCost}`);
      const marketIron = t.ironPlan.sources.filter((x) => x.kind === 'market');
      if (marketIron.length) bits.push(`iron ×${marketIron.length} ← market £${t.ironPlan.totalCost}`);
      return bits.join(' · ');
    }
    case 'network': {
      const t = st.linkPick;
      if (!t) return null;
      const name = (id: string) => TOWN_BY_ID[id]?.name ?? MERCHANT_BY_ID[id]?.name ?? id;
      if (st.secondLinkPick) {
        const s2 = st.secondLinkPick;
        return `Double rail · ${name(t.link.a)} ⇄ ${name(t.link.b)} + ${name(s2.link.a)} ⇄ ${name(s2.link.b)} · £${s2.total} · 2 coal · 1 beer`;
      }
      return [`Network · ${name(t.link.a)} ⇄ ${name(t.link.b)}`, `£${t.total}`].join(' · ');
    }
    case 'develop':
      return st.developPick.length
        ? `Develop · ${st.developPick.map((i) => INDUSTRY_LABEL[i]).join(' + ')} · iron ×${st.developPick.length}`
        : null;
    case 'sell': {
      if (!st.sellPicks.length) return null;
      return `Sell · ${st.sellPicks.map((t) => `${INDUSTRY_LABEL[t.tile.industry]} L${t.tile.level} → ${MERCHANT_BY_ID[t.merchant].name}`).join(' + ')}`;
    }
    case 'scout':
      return st.scoutPick.length === 3 ? 'Scout · discard 3, draw 2 wild cards' : null;
    default:
      return null;
  }
}

export function cardLabel(card: Card): string {
  if (card.kind === 'location') return TOWN_BY_ID[card.town!]?.name ?? card.town!;
  if (card.kind === 'industry') return card.industry2 ? `${INDUSTRY_LABEL[card.industry!]} / ${INDUSTRY_LABEL[card.industry2]}` : INDUSTRY_LABEL[card.industry!];
  if (card.kind === 'wild-location') return 'Wild Location';
  return 'Wild Industry';
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
  ];
}
