import { useSyncExternalStore } from 'react';
import { FINAL_STORAGE_KEY, readFinalResult } from '@/components/results/types';
import { loadIdentity } from '@/online/identity';
import { tr } from '@/i18n';
import { DEFAULT_EQUIPPED, DEFAULT_OWNED, ITEM_BY_ID, isItem, type Category } from './catalog';

/* ------------------------------------------------------------------ */
/* Le Comptoir — bourse locale (comptoir.md §Économie).                */
/* Petit store façon src/i18n/index.ts : localStorage                  */
/* `brassworks.wallet.v1` + subscribe pour la réactivité. Aucune       */
/* règle du jeu n'est modifiée : on lit seulement le registre final    */
/* (brassworks.final.v1, contrat components/results/types.ts).         */
/* ------------------------------------------------------------------ */

const KEY = 'brassworks.wallet.v1';
const LEDGER_MAX = 50;
const PROCESSED_MAX = 50;

/* Gains (comptoir.md) */
const REWARD_GAME = 10;
const REWARD_WIN = 30; /* remplace le +10 */
const REWARD_DAILY = 10; /* contrat du jour : première partie du jour */

export interface LedgerEntry {
  delta: number;
  reason: string;
  at: number;
}

export interface Wallet {
  balance: number;
  lifetime: number;
  owned: string[];
  equipped: Record<Category, string>;
  processed: string[];
  lastDaily: string;
  ledger: LedgerEntry[];
}

export interface CollectedReward {
  delta: number;
  won: boolean;
  daily: boolean;
  winnerName: string;
  opponents: string[];
}

function defaultWallet(): Wallet {
  return {
    balance: 0,
    lifetime: 0,
    owned: [...DEFAULT_OWNED],
    equipped: { ...DEFAULT_EQUIPPED },
    processed: [],
    lastDaily: '',
    ledger: [],
  };
}

function sanitize(raw: unknown): Wallet {
  const w = defaultWallet();
  if (typeof raw !== 'object' || raw === null) return w;
  const r = raw as Partial<Wallet>;
  if (Number.isFinite(r.balance)) w.balance = Math.max(0, Math.floor(Number(r.balance)));
  if (Number.isFinite(r.lifetime)) w.lifetime = Math.max(0, Math.floor(Number(r.lifetime)));
  if (Array.isArray(r.owned)) w.owned = [...new Set([...DEFAULT_OWNED, ...r.owned.filter((id): id is string => typeof id === 'string' && isItem(id))])];
  if (typeof r.equipped === 'object' && r.equipped !== null) {
    for (const cat of ['avatar', 'frame', 'title'] as const) {
      const id = (r.equipped as Partial<Record<Category, unknown>>)[cat];
      if (typeof id === 'string' && isItem(id, cat) && w.owned.includes(id)) w.equipped[cat] = id;
    }
  }
  if (Array.isArray(r.processed)) w.processed = r.processed.filter((h): h is string => typeof h === 'string').slice(-PROCESSED_MAX);
  if (typeof r.lastDaily === 'string') w.lastDaily = r.lastDaily;
  if (Array.isArray(r.ledger)) {
    w.ledger = r.ledger
      .filter(
        (e): e is LedgerEntry =>
          typeof e === 'object' && e !== null && Number.isFinite((e as LedgerEntry).delta) && typeof (e as LedgerEntry).reason === 'string' && Number.isFinite((e as LedgerEntry).at),
      )
      .slice(-LEDGER_MAX);
  }
  return w;
}

let wallet: Wallet = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch {
    /* private mode ou registre corrompu : bourse neuve */
  }
  return defaultWallet();
})();

const listeners = new Set<() => void>();

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(wallet));
  } catch {
    /* non-fatal */
  }
}

function update(next: Wallet): void {
  wallet = next;
  persist();
  for (const f of listeners) f();
}

/** Bourse courante (instantané — pour le code non-React). */
export function getWallet(): Wallet {
  return wallet;
}

/** subscribe sans React (retourne l'unsubscribe). */
export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Hook React : re-rend à chaque mouvement de la bourse. */
export function useWallet(): Wallet {
  return useSyncExternalStore(subscribe, () => wallet);
}

/** Empreinte FNV-1a (32 bits, hex) du JSON du registre final. */
function fingerprint(raw: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/** Jour local AAAA-MM-JJ — sert au contrat du jour. */
export function todayKey(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function isDailyAvailable(w: Wallet = wallet): boolean {
  return w.lastDaily !== todayKey();
}

/** Le nom local du joueur, normalisé pour la comparaison de victoire. */
function localName(): string {
  return loadIdentity().name.trim().toLowerCase();
}

function appendLedger(w: Wallet, delta: number, reason: string): Wallet {
  return { ...w, ledger: [...w.ledger, { delta, reason, at: Date.now() }].slice(-LEDGER_MAX) };
}

/**
 * Encaisse les jetons de la dernière partie terminée. Idempotent :
 * l'empreinte du registre final est mémorisée dans `processed`.
 * Retourne le détail du gain, ou null s'il n'y a rien de nouveau.
 */
export function collectRewards(): CollectedReward | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(FINAL_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  const hash = fingerprint(raw);
  if (wallet.processed.includes(hash)) return null;

  const result = readFinalResult();
  if (!result) return null;

  const me = localName();
  const winner = result.players[result.winnerIndex];
  const won = me !== '' && winner !== undefined && winner.name.trim().toLowerCase() === me;
  const daily = isDailyAvailable();
  const delta = (won ? REWARD_WIN : REWARD_GAME) + (daily ? REWARD_DAILY : 0);
  const opponents = result.players.filter((_, i) => i !== result.winnerIndex).map((p) => p.name);

  const reason = won
    ? tr('platform.comptoir.reasons.win', { names: opponents.join(', ') })
    : tr('platform.comptoir.reasons.game');

  let next: Wallet = {
    ...wallet,
    balance: wallet.balance + delta,
    lifetime: wallet.lifetime + delta,
    processed: [...wallet.processed, hash].slice(-PROCESSED_MAX),
    lastDaily: daily ? todayKey() : wallet.lastDaily,
  };
  next = appendLedger(next, delta, reason);
  update(next);

  return { delta, won, daily, winnerName: winner?.name ?? '', opponents };
}

/**
 * Achat : refuse (false) si l'objet est inconnu, déjà possédé ou trop
 * cher. Sinon débit + ajout au vestiaire + mouvement au registre.
 */
export function buy(itemId: string, label?: string): boolean {
  const item = ITEM_BY_ID.get(itemId);
  if (!item || item.price <= 0) return false;
  if (wallet.owned.includes(itemId)) return false;
  if (wallet.balance < item.price) return false;
  const reason = label ?? itemId;
  let next: Wallet = {
    ...wallet,
    balance: wallet.balance - item.price,
    owned: [...wallet.owned, itemId],
  };
  next = appendLedger(next, -item.price, reason);
  update(next);
  return true;
}

/** Équipement instantané — un seul équipé par catégorie. */
export function equip(itemId: string): boolean {
  const item = ITEM_BY_ID.get(itemId);
  if (!item || !wallet.owned.includes(itemId)) return false;
  if (wallet.equipped[item.category] === itemId) return true;
  update({ ...wallet, equipped: { ...wallet.equipped, [item.category]: itemId } });
  return true;
}
