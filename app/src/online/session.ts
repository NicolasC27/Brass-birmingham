import { useEffect, useSyncExternalStore } from 'react';
import type { PlayerColor } from '@/components/setup/constants';
import { leaveOnlineTable } from '@/game/store';
import { onlineWire } from './net';
import type { ChallengeBoard, CompanyBoard, Desk, Edition, Leaderboard, Me, TableQuery, TablesPage } from './table';
import { normalizeQuery } from './table';

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

/** one page of the register of tables: asked on first use and whenever the
 *  query changes, pushed for a while after; null until the page asked for
 *  is the page in hand */
export function useTables(query: TableQuery = {}): TablesPage | null {
  const session = useSession();
  const key = JSON.stringify(normalizeQuery(query));
  const page = useSyncExternalStore(
    (cb) => onlineWire()?.onHall(cb) ?? never(),
    () => onlineWire()?.tables ?? null,
    () => null,
  );
  useEffect(() => {
    if (!session) return;
    const w = onlineWire();
    const q = JSON.parse(key) as TableQuery;
    w?.askTables(q);
    /* the office pushes the register for two minutes after an asking: ask again before it forgets */
    const iv = window.setInterval(() => w?.askTables(q), 60_000);
    return () => window.clearInterval(iv);
  }, [session?.id, key]); // eslint-disable-line react-hooks/exhaustive-deps
  /* a page of another asking (the offset clamped by the office aside) is not this one */
  if (!page) return null;
  const mine = JSON.parse(key) as Required<TableQuery>;
  const same = page.query.filter === mine.filter && page.query.q === mine.q && page.query.sort === mine.sort && page.query.limit === mine.limit && (page.query.offset === mine.offset || page.query.offset < mine.offset);
  return same ? page : null;
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

/** the week's board of the challenge notice, asked for once signed in */
export function useChallengeBoard(week: number): ChallengeBoard | null {
  const session = useSession();
  const board = useSyncExternalStore(
    (cb) => onlineWire()?.onHall(cb) ?? never(),
    () => onlineWire()?.challenges.get(week) ?? null,
    () => null,
  );
  useEffect(() => {
    if (session) onlineWire()?.askChallenge(week);
  }, [session?.id, week]); // eslint-disable-line react-hooks/exhaustive-deps
  return board;
}

/** the companies of the club and their honours, asked for once signed in */
export function useCompanies(): CompanyBoard | null {
  const session = useSession();
  const board = useSyncExternalStore(
    (cb) => onlineWire()?.onHall(cb) ?? never(),
    () => onlineWire()?.companies ?? null,
    () => null,
  );
  useEffect(() => {
    if (session) onlineWire()?.askCompanies();
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return board;
}
export const foundCompany = (name: string): Promise<void> => wire().foundCompany(name);
export const joinCompany = (id: string): Promise<void> => wire().joinCompany(id);
export const leaveCompany = (): Promise<void> => wire().leaveCompany();

/** the club's edition of a week, asked for once signed in */
export function useEdition(week: number): Edition | null {
  const session = useSession();
  const edition = useSyncExternalStore(
    (cb) => onlineWire()?.onHall(cb) ?? never(),
    () => onlineWire()?.editions.get(week) ?? null,
    () => null,
  );
  useEffect(() => {
    if (session) onlineWire()?.askEdition(week);
  }, [session?.id, week]); // eslint-disable-line react-hooks/exhaustive-deps
  return edition;
}

/** an attempt at the notice, sent to the office when there is one to send to */
export const postChallenge = (a: { week: number; id: string; vp: number; rank: number; met: boolean[]; points: number }): void => onlineWire()?.postChallenge(a);

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
export const exportData = (): Promise<Record<string, unknown>> => wire().exportData();
export const closeAccount = (password: string): Promise<void> => wire().closeAccount(password);

/** the letter again — to a new address when one is given */
export async function resendLetter(email?: string): Promise<void> {
  await wire().ask((rid) => ({ t: 'resend', rid, email: email?.trim() }));
}

export async function updateProfile(patch: { motto?: string; favoriteColor?: PlayerColor | null; newsletter?: boolean }): Promise<void> {
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
