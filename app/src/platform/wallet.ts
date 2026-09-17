import { useMemo, useSyncExternalStore } from 'react';
import { onlineWire } from '@/online/net';
import { DEFAULT_EQUIPPED, DEFAULT_OWNED, ITEM_BY_ID, isItem, type Category } from './catalog';

/* ------------------------------------------------------------------ */
/* Le Comptoir — ce que le membre porte.                               */
/* La bourse est au bureau : les guinées se gagnent aux tables, le     */
/* serveur les paie et les débite lui-même (desk.purse). Ici ne reste  */
/* qu'une préférence personnelle, l'objet équipé par catégorie, dans   */
/* localStorage `brassworks.equipped.v1`. Le bureau est lu, jamais     */
/* écrit : les achats passent par online/session buyItem.              */
/* ------------------------------------------------------------------ */

const KEY = 'brassworks.equipped.v1';
/** la bourse locale d'avant : on n'en garde que le choix équipé */
const LEGACY_KEY = 'brassworks.wallet.v1';

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

let equippedNow: Equipped = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize(JSON.parse(raw));
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return sanitize((JSON.parse(legacy) as { equipped?: unknown }).equipped);
  } catch {
    /* private mode ou registre corrompu : tenue par défaut */
  }
  return { ...DEFAULT_EQUIPPED };
})();

const listeners = new Set<() => void>();

function update(next: Equipped): void {
  equippedNow = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* non-fatal */
  }
  for (const f of listeners) f();
}

/** subscribe sans React (retourne l'unsubscribe). */
export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const never = () => () => {};

function purseNow(): { guineas: number; owned: string[] } | null {
  return onlineWire()?.desk?.purse ?? null;
}

/** Instantané pour le code non-React : la bourse du bureau et la tenue. */
export function getWallet(): Wallet {
  const purse = purseNow();
  return { balance: purse?.guineas ?? 0, owned: purse?.owned ?? DEFAULT_OWNED, equipped: equippedNow };
}

/** Hook React : re-rend quand la tenue change ou que le bureau renvoie la bourse. */
export function useWallet(): Wallet {
  const equipped = useSyncExternalStore(subscribe, () => equippedNow, () => equippedNow);
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
