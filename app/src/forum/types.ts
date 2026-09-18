/* ------------------------------------------------------------------ */
/* The club's forum — what the office and the pages agree on.          */
/*                                                                     */
/* Five boards, fixed; threads of posts, plain text with a little      */
/* markup and no pictures; reports the moderators read; what is kept   */
/* as read per member. The limits are the same on both sides: the     */
/* page refuses before asking, the office refuses whatever is asked.   */
/* ------------------------------------------------------------------ */

export const BOARDS = ['annonces', 'strategie', 'tables', 'regles', 'atelier'] as const;
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
  last: { threadId: string; title: string; at: number; by: string } | null;
  /** threads with something new since the member last read them */
  unread: number;
}

export interface ThreadRow {
  id: string;
  board: BoardKey;
  title: string;
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
  createdAt: number;
  editedAt: number | null;
  hidden: boolean;
  /** open reports on it — moderators only */
  reports: number;
}

export interface ThreadView {
  thread: ThreadRow;
  page: number;
  pages: number;
  posts: Post[];
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

export type ModAction = 'hide' | 'unhide' | 'lock' | 'unlock' | 'pin' | 'unpin' | 'resolve';
export const MOD_ACTIONS: readonly ModAction[] = ['hide', 'unhide', 'lock', 'unlock', 'pin', 'unpin', 'resolve'];
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
  | 'forum-reported';
