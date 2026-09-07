import { useEffect, useSyncExternalStore } from 'react';
import type { PlayerColor } from '@/components/setup/constants';
import { onlineWire } from './net';
import type { Desk, Me } from './table';

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

function wire() {
  const w = onlineWire();
  if (!w) throw new Error('offline');
  return w;
}

export const signIn = (name: string, password: string): Promise<Me> => wire().signIn(name.trim(), password);
export const signUp = (name: string, email: string, password: string): Promise<Me> => wire().signUp(name.trim(), email.trim(), password);
export const signOut = (): void => onlineWire()?.signOut();
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

/** ask a player by name to a table I sit at */
export async function invite(code: string, name: string): Promise<void> {
  await wire().ask((rid) => ({ t: 'invite', rid, code, name: name.trim() }));
}

/** answer an invitation; accepting seats me and returns the table's code */
export async function answerInvitation(id: string, accept: boolean): Promise<string | null> {
  const m = await wire().ask((rid) => ({ t: 'answer', rid, id, accept }));
  return m.t === 'seated' ? m.table.code : null;
}
