/* ------------------------------------------------------------------ */
/* Refusal → rule. When the table says no, the clerk can point at the  */
/* page of the rulebook that says so. This is a citation, never a hint: */
/* it names the chapter and the action, it never proposes a move.      */
/* ------------------------------------------------------------------ */
import { create } from 'zustand';

export const CHAPTER_IDS = [
  'quickstart', 'eras', 'actions', 'industries', 'network', 'supply',
  'market', 'selling', 'money', 'scoring', 'glossary', 'approximations',
] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export const ACTION_IDS = ['build', 'network', 'develop', 'sell', 'loan', 'scout'] as const;
export type ActionId = (typeof ACTION_IDS)[number];

/** A passage of the codex: a chapter anchor on /rules, and the action whose steps it prints. */
export interface Passage {
  chapter: ChapterId;
  action: ActionId | null;
}

/* Read top to bottom, first match wins: the more particular words
   stand before the general ones, as on a departures board. */
const TABLE: { test: RegExp; chapter: ChapterId; action: ActionId | null }[] = [
  { test: /wild|scout|discard/i, chapter: 'actions', action: 'scout' },
  { test: /loan|credit|income/i, chapter: 'money', action: 'loan' },
  { test: /develop/i, chapter: 'industries', action: 'develop' },
  { test: /coal|iron|market/i, chapter: 'supply', action: 'build' },
  { test: /beer|brewery|barrel/i, chapter: 'selling', action: 'sell' },
  { test: /sell|merchant|goods|demand/i, chapter: 'selling', action: 'sell' },
  { test: /link|canal|rail|route|connect/i, chapter: 'network', action: 'network' },
  { test: /£|money|afford|purse|pay/i, chapter: 'money', action: 'build' },
  { test: /era|level|overbuild|tiles? left|occupied|industry|site|slot/i, chapter: 'industries', action: 'build' },
  { test: /card|town|network|build/i, chapter: 'actions', action: 'build' },
];

/** The passage behind a refusal. `verb` is the action being tried, when the table knows it. */
export function passageFor(reason: string | null | undefined, verb?: string | null): Passage {
  const said = (reason ?? '').trim();
  const tried = (ACTION_IDS as readonly string[]).includes(verb ?? '') ? (verb as ActionId) : null;
  const row = TABLE.find((r) => r.test.test(said));
  if (row) return { chapter: row.chapter, action: tried ?? row.action };
  /* a clerk's code (out-of-step, not-your-turn…): the order of play */
  return { chapter: tried ? 'actions' : 'quickstart', action: tried };
}

/* the open citation and the link that asked for it, so Escape can hand
   the focus back to the very button the reader pressed */
interface WhyState {
  passage: Passage | null;
  opener: HTMLElement | null;
  ask: (passage: Passage, opener: HTMLElement | null) => void;
  clear: () => void;
}

export const useWhy = create<WhyState>((set) => ({
  passage: null,
  opener: null,
  ask: (passage, opener) => set({ passage, opener }),
  clear: () => set({ passage: null, opener: null }),
}));
