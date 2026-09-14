/* Telegrams — the few fixed lines a player may wire to the table: praise,
   a grumble about beer, a hurry-up, and some Midlands jibes of the 1800s.
   No free text: the office only carries what is printed here. */

export const TELEGRAMS = ['wellPlayed', 'myBeer', 'coalShort', 'hatsOff', 'hurry', 'sacrebleu', 'gawby', 'mardy', 'saft', 'cakeHole', 'bostin', 'clemmed'] as const;
export type TelegramKey = (typeof TELEGRAMS)[number];

/** the dialect lines: said as printed, whatever the reader's language, with a gloss */
export const DIALECT: Partial<Record<TelegramKey, string>> = {
  gawby: 'Yo’m a right gawby!',
  mardy: 'Mardy, bist?',
  saft: 'Yow big saft ’apeth.',
  cakeHole: 'Shut yer cake ’ole.',
  bostin: 'Bostin’, that!',
  clemmed: 'Yo’ll ’ave us all clemmed.',
};

export const isTelegramKey = (k: unknown): k is TelegramKey => typeof k === 'string' && (TELEGRAMS as readonly string[]).includes(k);

/** a wire may leave every so often, not more */
export const TELEGRAM_COOLDOWN_MS = 20_000;
/** how long a plaque hangs under the sender's card */
export const TELEGRAM_SHOWN_MS = 6_000;

export interface Telegram {
  id: number;
  from: number;
  key: TelegramKey;
  at: number;
}

/** the line as printed for the reader: the dialect ones stay in dialect,
 *  with a gloss in the reader's language */
export const telegramText = (t: (key: string, vars?: Record<string, string | number>) => string, key: TelegramKey): { text: string; gloss: string | null } =>
  DIALECT[key] ? { text: DIALECT[key]!, gloss: t(`game.telegram.gloss.${key}`) } : { text: t(`game.telegram.line.${key}`), gloss: null };

/* Pings — "look here": a seat points at a town, a house or a route, and
   everyone sees a pulse there for a moment. Lighter than a wire. */
export const PING_COOLDOWN_MS = 5_000;
export const PING_SHOWN_MS = 3_500;
export interface Ping {
  id: number;
  from: number;
  /** a town id, a merchant id or a link id */
  key: string;
  at: number;
}
