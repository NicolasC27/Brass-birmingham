import { useEffect, useState, useSyncExternalStore } from 'react';
import type { PlayerColor } from '@/components/setup/constants';
import { leaveOnlineTable } from '@/game/store';
import { onlineWire } from './net';
import type { Desk, Leaderboard, Me, PublicTable } from './table';
import type { BoardKey, BoardSummary, Lang, ModAction, Post, Rendered, Report, ReportReason, ThreadRow, ThreadView, TranslationSpend } from '@/forum/types';

/* ------------------------------------------------------------------ */
/* The visitors' book.                                                 */
/*                                                                     */
/* Online, a seat belongs to an account: the office signs you in, the  */
/* wire keeps the token and presents it again on every connection, and */
/* this is what the pages read to know whose name is on the register.  */
/* The desk — my tables, my letters, my past games — rides the same    */
/* socket and is pushed again whenever it changes.                     */
/* Playing in this browser alone, there is nobody to sign in — the     */
/* session is null and the office asks for a name instead.             */
/* ------------------------------------------------------------------ */

const never = () => () => {};

/** the account this browser is signed in as, or null */
export function useSession(): Me | null {
  return useSyncExternalStore(
    (cb) => onlineWire()?.onSession(cb) ?? never(),
    () => onlineWire()?.session ?? null,
    () => null,
  );
}

/** true when nobody is signed in and no token is on its way: the office
 *  must be signed before anything else, and we know it already */
export function useStranger(): boolean {
  return useSyncExternalStore(
    (cb) => onlineWire()?.onSession(cb) ?? never(),
    () => onlineWire()?.stranger ?? false,
    () => false,
  );
}

/** the line to the office: offline, connecting, online */
export function useLine(): 'offline' | 'connecting' | 'online' {
  return useSyncExternalStore(
    (cb) => onlineWire()?.onStatus(cb) ?? never(),
    () => onlineWire()?.status ?? 'offline',
    () => 'offline',
  );
}

/** the desk, asked for on first use and kept fresh by the server */
export function useDesk(): Desk | null {
  const session = useSession();
  const desk = useSyncExternalStore(
    (cb) => onlineWire()?.onDesk(cb) ?? never(),
    () => onlineWire()?.desk ?? null,
    () => null,
  );
  useEffect(() => {
    if (session) onlineWire()?.askDesk();
  }, [session?.id, session?.verified]); // eslint-disable-line react-hooks/exhaustive-deps
  return desk;
}

/** the register of tables in play: asked on first use, pushed for a while after */
export function useTables(): PublicTable[] | null {
  const session = useSession();
  const tables = useSyncExternalStore(
    (cb) => onlineWire()?.onHall(cb) ?? never(),
    () => onlineWire()?.tables ?? null,
    () => null,
  );
  useEffect(() => {
    if (!session) return;
    const w = onlineWire();
    w?.askTables();
    /* the office pushes the register for two minutes after an asking: ask again before it forgets */
    const iv = window.setInterval(() => w?.askTables(), 60_000);
    return () => window.clearInterval(iv);
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return tables;
}

/** the roll of honour of the season */
export function useLeaderboard(): Leaderboard | null {
  const session = useSession();
  const board = useSyncExternalStore(
    (cb) => onlineWire()?.onHall(cb) ?? never(),
    () => onlineWire()?.board ?? null,
    () => null,
  );
  useEffect(() => {
    if (session) onlineWire()?.askLeaderboard();
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return board;
}

export const setQueue = (mode: 'quick' | 'ranked', on: boolean): void => onlineWire()?.setQueue(mode, on);

/** the table the office dealt me from a queue, once; the page takes me there */
export function useDealt(): string | null {
  return useSyncExternalStore(
    (cb) => onlineWire()?.onDesk(cb) ?? never(),
    () => onlineWire()?.dealt ?? null,
    () => null,
  );
}
export const clearDealt = (): void => {
  const w = onlineWire();
  if (w) w.dealt = null;
};
export const buyItem = (item: string): Promise<void> => wire().buy(item);

function wire() {
  const w = onlineWire();
  if (!w) throw new Error('offline');
  return w;
}

export const signIn = (name: string, password: string): Promise<Me> => wire().signIn(name.trim(), password);
export const signUp = (name: string, email: string, password: string): Promise<Me> => wire().signUp(name.trim(), email.trim(), password);
export const signOut = (): void => {
  leaveOnlineTable();
  onlineWire()?.signOut();
};
export const verifyEmail = (token: string): Promise<void> => wire().verify(token);
export const forgotPassword = (email: string): Promise<void> => wire().forgot(email.trim());
export const resetPassword = (token: string, password: string): Promise<Me> => wire().reset(token, password);
export const changePassword = (current: string, next: string): Promise<void> => wire().changePassword(current, next);

/** the letter again — to a new address when one is given */
export async function resendLetter(email?: string): Promise<void> {
  await wire().ask((rid) => ({ t: 'resend', rid, email: email?.trim() }));
}

export async function updateProfile(patch: { motto?: string; favoriteColor?: PlayerColor | null }): Promise<void> {
  await wire().ask((rid) => ({ t: 'profile', rid, ...patch }));
}

/** an idea or a bug, to the house */
export async function sendFeedback(page: string, kind: 'idea' | 'bug', text: string): Promise<void> {
  await wire().ask((rid) => ({ t: 'feedback', rid, page, kind, text }));
}

/** ask a player by name to be friends — or accept them */
export async function befriend(name: string): Promise<void> {
  await wire().ask((rid) => ({ t: 'friend', rid, name: name.trim() }));
}

export async function unfriend(id: string): Promise<void> {
  await wire().ask((rid) => ({ t: 'unfriend', rid, id }));
}

/** ask a player by name to a table I sit at */
export async function invite(code: string, name: string): Promise<void> {
  await wire().ask((rid) => ({ t: 'invite', rid, code, name: name.trim() }));
}

/** answer an invitation; accepting seats me and returns the table's code */
export async function answerInvitation(id: string, accept: boolean): Promise<string | null> {
  const m = await wire().ask((rid) => ({ t: 'answer', rid, id, accept }));
  return m.t === 'seated' ? m.table.code : null;
}

/* ------------------------------ the forum ------------------------------ */
/** a tick that moves whenever the forum does — a board, or one thread —
 *  so a page showing it asks the office again */
export function useForumTick(board?: BoardKey, thread?: string): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const w = onlineWire();
    if (!w) return;
    return w.onForum((b, th) => {
      if (thread) {
        if (th === thread) setTick((n) => n + 1);
      } else if (!board || b === board) setTick((n) => n + 1);
    });
  }, [board, thread]);
  return tick;
}
export const forumBoards = (lang: Lang): Promise<BoardSummary[]> => wire().forumBoards(lang);
export const forumThreads = (board: BoardKey, page: number, lang: Lang): Promise<{ page: number; pages: number; threads: ThreadRow[] }> => wire().forumThreads(board, page, lang);
export const forumThread = (id: string, page: number): Promise<ThreadView> => wire().forumThread(id, page);
export const forumOpen = (board: BoardKey, title: string, body: string, lang: Lang): Promise<string> => wire().forumOpen(board, title, body, lang);
export const forumReply = (id: string, body: string, lang: Lang): Promise<{ post: Post; page: number }> => wire().forumReply(id, body, lang);
export const forumEdit = (post: string, body: string, lang: Lang): Promise<void> => wire().forumEdit(post, body, lang);
export const forumReport = (post: string, reason: ReportReason, text: string): Promise<void> => wire().forumReport(post, reason, text);
export const forumMod = (action: ModAction, id: string): Promise<void> => wire().forumMod(action, id);
export const forumReports = (): Promise<{ reports: Report[]; translation: TranslationSpend }> => wire().forumReports();
export const forumTranslate = (id: string, page: number, lang: Lang): Promise<Rendered> => wire().forumTranslate(id, page, lang);
export const forumSeen = (id: string): void => onlineWire()?.forumSeen(id);
