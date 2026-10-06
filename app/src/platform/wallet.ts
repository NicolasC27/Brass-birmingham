import { useMemo, useSyncExternalStore } from 'react';
import { onlineWire } from '@/online/net';
import { DEFAULT_EQUIPPED, DEFAULT_OWNED, ITEM_BY_ID, isItem, type Category } from './catalog';
import { paper, subscribePapers, writePaper } from './papers';

/* ------------------------------------------------------------------ */
/* Le Comptoir — ce que le membre porte.                               */
/* La bourse est au bureau : les guinées se gagnent aux tables, le     */
/* serveur les paie et les débite lui-même (desk.purse). Ici ne reste  */
/* qu'un choix : l'objet équipé par catégorie, gardé par le bureau      */
/* comme les autres papiers du compte, si bien qu'on se retrouve vêtu   */
/* pareil d'une machine à l'autre. Le bureau est lu, jamais écrit :     */
/* les achats passent par online/session buyItem.                       */
/* ------------------------------------------------------------------ */

export type Equipped = Record<Category, string>;

export interface Wallet {
  /** guinées au bureau — 0 sans session */
  balance: number;
  /** ce que le bureau nous reconnaît, objets offerts compris */
  owned: string[];
  equipped: Equipped;
}

/** gardé pour les pages qui encaissaient elles-mêmes : le bureau paie
 *  désormais, il n'y a plus jamais rien à encaisser ici */
export interface CollectedReward {
  delta: number;
  won: boolean;
  daily: boolean;
  winnerName: string;
  opponents: string[];
}

function sanitize(raw: unknown): Equipped {
  const e: Equipped = { ...DEFAULT_EQUIPPED };
  if (typeof raw !== 'object' || raw === null) return e;
  for (const cat of Object.keys(DEFAULT_EQUIPPED) as Category[]) {
    const id = (raw as Partial<Record<Category, unknown>>)[cat];
    if (typeof id === 'string' && isItem(id, cat)) e[cat] = id;
  }
  return e;
}

/* la tenue telle que le bureau la garde — un objet stable tant qu'elle
   ne bouge pas, pour que `useSyncExternalStore` s'y tienne */
let equippedNow: Equipped = { ...DEFAULT_EQUIPPED };
let equippedFrom: unknown;

function readEquipped(): Equipped {
  const raw = paper<unknown>('equipped', null);
  if (raw !== equippedFrom) {
    equippedFrom = raw;
    equippedNow = sanitize(raw);
  }
  return equippedNow;
}

function update(next: Equipped): void {
  writePaper('equipped', next);
}

/** subscribe sans React (retourne l'unsubscribe). */
export const subscribe = subscribePapers;

const never = () => () => {};

function purseNow(): { guineas: number; owned: string[] } | null {
  return onlineWire()?.desk?.purse ?? null;
}

/** Instantané pour le code non-React : la bourse du bureau et la tenue. */
export function getWallet(): Wallet {
  const purse = purseNow();
  return { balance: purse?.guineas ?? 0, owned: purse?.owned ?? DEFAULT_OWNED, equipped: readEquipped() };
}

/** Hook React : re-rend quand la tenue change ou que le bureau renvoie la bourse. */
export function useWallet(): Wallet {
  const equipped = useSyncExternalStore(subscribe, readEquipped, readEquipped);
  const purse = useSyncExternalStore(
    (cb) => onlineWire()?.onDesk(cb) ?? never(),
    () => purseNow(),
    () => null,
  );
  return useMemo(() => ({ balance: purse?.guineas ?? 0, owned: purse?.owned ?? DEFAULT_OWNED, equipped }), [purse, equipped]);
}

/** Le bureau paie les parties lui-même : il n'y a plus rien à encaisser. */
export function collectRewards(): CollectedReward | null {
  return null;
}

/** Équipement instantané — un seul équipé par catégorie, parmi ce qu'on possède. */
export function equip(itemId: string): boolean {
  const item = ITEM_BY_ID.get(itemId);
  if (!item) return false;
  const owned = purseNow()?.owned ?? DEFAULT_OWNED;
  if (item.price > 0 && !owned.includes(itemId)) return false;
  if (equippedNow[item.category] === itemId) return true;
  update({ ...equippedNow, [item.category]: itemId });
  return true;
}
