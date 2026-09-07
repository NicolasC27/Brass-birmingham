import { useSyncExternalStore } from 'react';
import { onlineWire } from './net';
import type { Identity } from './table';

/* ------------------------------------------------------------------ */
/* The visitors' book.                                                 */
/*                                                                     */
/* Online, a seat belongs to an account: the office signs you in, the  */
/* wire keeps the token and presents it again on every connection, and */
/* this is what the pages read to know whose name is on the register.  */
/* Playing in this browser alone, there is nobody to sign in — the     */
/* session is null and the office asks for a name instead.             */
/* ------------------------------------------------------------------ */

/** the account this browser is signed in as, or null */
export function useSession(): Identity | null {
  return useSyncExternalStore(
    (cb) => onlineWire()?.onSession(cb) ?? (() => {}),
    () => onlineWire()?.session ?? null,
    () => null,
  );
}

/** true when nobody is signed in and no token is on its way: the office
 *  must be signed before anything else, and we know it already */
export function useStranger(): boolean {
  return useSyncExternalStore(
    (cb) => onlineWire()?.onSession(cb) ?? (() => {}),
    () => onlineWire()?.stranger ?? false,
    () => false,
  );
}

export async function signIn(name: string, password: string): Promise<Identity> {
  const wire = onlineWire();
  if (!wire) throw new Error('offline');
  return wire.signIn(name.trim(), password);
}

export async function signUp(name: string, password: string): Promise<Identity> {
  const wire = onlineWire();
  if (!wire) throw new Error('offline');
  return wire.signUp(name.trim(), password);
}

export function signOut(): void {
  onlineWire()?.signOut();
}
