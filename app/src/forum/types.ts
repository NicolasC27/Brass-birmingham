/* ------------------------------------------------------------------ */
/* The club's forum — what the office and the pages agree on.          */
/*                                                                     */
/* Six boards, fixed; threads of posts, plain text with a little      */
/* markup and no pictures; reports the moderators read; what is kept   */
/* as read per member. The limits are the same on both sides: the     */
/* page refuses before asking, the office refuses whatever is asked.   */
/* ------------------------------------------------------------------ */

export const BOARDS = ['annonces', 'strategie', 'tables', 'regles', 'atelier', 'design'] as const;
/** the club's tongues: what a post is written in, what a reader reads in */
export const LANGS = ['en', 'fr', 'de', 'es'] as const;
export type Lang = (typeof LANGS)[number];
export const isLang = (s: unknown): s is Lang => typeof s === 'string' && (LANGS as readonly string[]).includes(s);
export type BoardKey = (typeof BOARDS)[number];
export const isBoard = (s: unknown): s is BoardKey => typeof s === 'string' && (BOARDS as readonly string[]).includes(s);
/** the boards only a moderator may open a thread on */
export const MODS_OPEN: readonly BoardKey[] = ['annonces'];

export const TITLE_MIN = 4;
export const TITLE_MAX = 120;
export const BODY_MIN = 2;
export const BODY_MAX = 4000;
export const REPORT_MAX = 240;
export const THREADS_PER_PAGE = 20;
export const POSTS_PER_PAGE = 30;
/** a post may be corrected for a quarter of an hour */
export const EDIT_MS = 15 * 60 * 1000;
/** one new thread every ten minutes, one reply every twenty seconds, thirty an hour */
export const THREAD_COOLDOWN_MS = 10 * 60 * 1000;
export const POST_COOLDOWN_MS = 20 * 1000;
export const POSTS_PER_HOUR = 30;

export interface Author {
  id: string;
  name: string;
}

export interface BoardSummary {
  key: BoardKey;
  threads: number;
  posts: number;
  last: { threadId: string; title: string; rendered?: string | null; at: number; by: string } | null;
  /** threads with something new since the member last read them */
  unread: number;
}

export interface ThreadRow {
  id: string;
  board: BoardKey;
  title: string;
  /** the tongue the title was written in */
  lang: Lang;
  /** the title in the reader's tongue, when the interpreter has rendered it */
  rendered?: string | null;
  by: Author;
  createdAt: number;
  lastAt: number;
  lastBy: string;
  replies: number;
  pinned: boolean;
  locked: boolean;
  hidden: boolean;
  unread: boolean;
}

export interface Post {
  id: string;
  threadId: string;
  by: Author;
  /** empty when the post is hidden and the reader is no moderator */
  body: string;
  /** the tongue it was written in */
  lang: Lang;
  createdAt: number;
  editedAt: number | null;
  hidden: boolean;
  /** open reports on it — moderators only */
  reports: number;
  /** the interpreter declined to render it: moderators are told, it is not sent again */
  refused?: boolean;
  /** the author may not write on the forum — moderators only */
  banned?: boolean;
}

export interface ThreadView {
  thread: ThreadRow;
  page: number;
  pages: number;
  posts: Post[];
}

/** a thread's page as the interpreter renders it: the title, and the posts by id */
export interface Rendered {
  title: string | null;
  posts: Record<string, string>;
  /** renderings still being made: the page will be told again when they are */
  pending: number;
  /** the interpreter is at work at all (a key, and budget left) */
  on: boolean;
}
export interface TranslationSpend {
  spent: number;
  budget: number;
  on: boolean;
}

export type ReportReason = 'insult' | 'spam' | 'offtopic' | 'other';
export const REPORT_REASONS: readonly ReportReason[] = ['insult', 'spam', 'offtopic', 'other'];
export const isReason = (s: unknown): s is ReportReason => typeof s === 'string' && (REPORT_REASONS as readonly string[]).includes(s);

export interface Report {
  id: string;
  post: Post;
  thread: { id: string; title: string; board: BoardKey };
  by: Author;
  reason: ReportReason;
  text: string;
  createdAt: number;
}

/** hide/unhide a post, lock/unlock and pin/unpin a thread, resolve a report,
 *  ban/unban a member from writing (id: the account), clear the interpreter's
 *  refusal on a post so it may be rendered again */
export type ModAction = 'hide' | 'unhide' | 'lock' | 'unlock' | 'pin' | 'unpin' | 'resolve' | 'ban' | 'unban' | 'clear';
export const MOD_ACTIONS: readonly ModAction[] = ['hide', 'unhide', 'lock', 'unlock', 'pin', 'unpin', 'resolve', 'ban', 'unban', 'clear'];
export const isModAction = (s: unknown): s is ModAction => typeof s === 'string' && (MOD_ACTIONS as readonly string[]).includes(s);

/** why the office said no, in its own words */
export type ForumError =
  | 'forum-words'
  | 'forum-too-short'
  | 'forum-too-long'
  | 'forum-cooldown'
  | 'forum-locked'
  | 'forum-not-yours'
  | 'forum-edit-window'
  | 'forum-board'
  | 'forum-not-found'
  | 'forum-verified'
  | 'forum-mods-only'
  | 'forum-not-mod'
  | 'forum-reported'
  | 'forum-banned';
