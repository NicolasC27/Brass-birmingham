import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { GameAction } from '@/game/actions';
import type { GameState, SetupPayload } from '@/game/types';

/* ------------------------------------------------------------------ */
/* What the office tells PostHog of the games it keeps.                */
/*                                                                     */
/* Only what was played: a game dealt, the moves a person made, the    */
/* rounds it reached, how it ended or was let go. Never a name, an     */
/* address or a code: an account is known there by a keyed hash of its */
/* id, a game by the same hash of its code, and the key stays on this  */
/* machine — the office can find its own people again, PostHog cannot. */
/*                                                                     */
/* POSTHOG_KEY   the project's key (phc_…); unset, nothing is sent and  */
/*               nothing is kept                                       */
/* POSTHOG_HOST  where the lines go (default: PostHog's EU cloud)       */
/* POSTHOG_SKIP  accounts never measured, by id, comma-separated: who    */
/*               objected, and the house's own                         */
/*                                                                     */
/* The hash's key is drawn once and kept beside the register           */
/* (measures.key); the lines leave by the batch, every few seconds.    */
/* ------------------------------------------------------------------ */

const HOST = 'https://eu.i.posthog.com';
/** the lines go out this often, or sooner when this many are waiting */
const EVERY_MS = 10_000;
const BATCH = 200;
/** what waits while PostHog cannot be reached; past it, the oldest go */
const KEEP = 5_000;

type Props = Record<string, unknown>;

interface Line {
  event: string;
  timestamp: string;
  properties: Props;
}

let post: { key: string; host: string; salt: Buffer; skip: Set<string> } | null = null;
let queue: Line[] = [];
let sending: Promise<boolean> | null = null;
/** PostHog was out of reach at the last try: said once, not every round */
let away = false;

/** the post opens when the process has a key: the office's tests and the
 *  developer's machine never call this, and every line is dropped unsent */
export function startMeasures(file: string): void {
  const key = (process.env.POSTHOG_KEY ?? '').trim();
  if (!key || post) return;
  const host = (process.env.POSTHOG_HOST ?? HOST).trim().replace(/\/+$/, '');
  const skip = new Set((process.env.POSTHOG_SKIP ?? '').split(',').map((id) => id.trim()).filter(Boolean));
  post = { key, host, salt: saltBeside(file), skip };
  setInterval(() => void flushMeasures(), EVERY_MS).unref();
  console.log(`blackrail: the games are measured (PostHog, ${new URL(host).host})`);
}

/** the hash's key, drawn once and kept beside the register; a register in
 *  memory gets one for the run */
function saltBeside(file: string): Buffer {
  if (file === ':memory:') return randomBytes(32);
  const at = path.join(path.dirname(path.resolve(file)), 'measures.key');
  try {
    const kept = Buffer.from(readFileSync(at, 'utf8').trim(), 'hex');
    if (kept.length === 32) return kept;
  } catch {
    /* none yet: drawn below */
  }
  const salt = randomBytes(32);
  writeFileSync(at, `${salt.toString('hex')}\n`, { mode: 0o600 });
  return salt;
}

const pseudonym = (salt: Buffer, what: string): string => createHmac('sha256', salt).update(what).digest('base64url').slice(0, 22);

/** one thing done by one account at one game. The machines' seats
 *  (`bot-…`) are never measured */
export function measure(event: string, accountId: string, code: string, props: Props = {}): void {
  if (!post || !accountId || accountId.startsWith('bot-') || post.skip.has(accountId)) return;
  queue.push({
    event,
    timestamp: new Date().toISOString(),
    properties: {
      ...props,
      distinct_id: pseudonym(post.salt, `account:${accountId}`),
      game: pseudonym(post.salt, `game:${code}`),
      $lib: 'blackrail-office',
      /* the office's own address would place every player in its server room */
      $geoip_disable: true,
    },
  });
  if (queue.length > KEEP) queue = queue.slice(-KEEP);
  if (queue.length >= BATCH) void flushMeasures();
}

/** one batch out; false when PostHog could not be reached and it waits */
export function flushMeasures(): Promise<boolean> {
  if (sending) return sending;
  if (!post || queue.length === 0) return Promise.resolve(true);
  const { key, host } = post;
  const batch = queue.splice(0, BATCH);
  sending = fetch(`${host}/batch/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ api_key: key, batch }),
    signal: AbortSignal.timeout(10_000),
  })
    .then((r) => {
      /* a batch PostHog refuses outright would be refused forever: dropped */
      if (r.status >= 400 && r.status < 500 && r.status !== 429) console.error(`measures: PostHog refused ${batch.length} lines (HTTP ${r.status})`);
      else if (!r.ok) throw new Error(`HTTP ${r.status}`);
      away = false;
      return true;
    })
    .catch((e: unknown) => {
      queue = [...batch, ...queue].slice(-KEEP);
      if (!away) console.error('measures: PostHog out of reach, the lines wait:', (e as Error).message);
      away = true;
      return false;
    })
    .finally(() => {
      sending = null;
    });
  return sending;
}

/** everything still waiting, before the process goes: a few seconds at most */
export async function drainMeasures(): Promise<void> {
  const until = Date.now() + 5_000;
  while (queue.length > 0 && Date.now() < until) if (!(await flushMeasures())) return;
}

/* ------------------------------ readings ------------------------------ */

/** how far a game has gone: the rail's rounds after all the canal's */
export const reachOf = (s: GameState): number => (s.era === 'rail' ? 100 : 0) + s.round;

/** the deal, as the measures name it */
export function dealOf(setup: SetupPayload): Props {
  const machines = setup.players.filter((p) => p.type === 'bot');
  return {
    players: setup.players.length,
    machines: machines.length,
    characters: machines.map((p) => p.persona ?? p.difficulty ?? 'unnamed'),
    era_length: setup.options.eraLength,
    timer: setup.options.timerMinutes ?? null,
    assist: !!setup.options.assist,
  };
}

/** a move, as the measures name it: its kind and what it was made of — never
 *  the card, which says what was in the hand */
export function moveOf(action: GameAction, s: GameState): Props {
  const at = { kind: action.kind, era: s.era, round: s.round };
  switch (action.kind) {
    case 'build':
      return { ...at, industry: action.industry, town: action.town };
    case 'network':
      return { ...at, double: !!action.second };
    case 'develop':
      return { ...at, industries: action.industries };
    case 'sell':
      return { ...at, sales: action.sales.length };
    case 'scout':
      return { ...at, cards: action.cards.length };
    default:
      return at;
  }
}

/** a seat's end of a game played out: its place (1 = first, ties shared), its points */
export function outcomeOf(s: GameState, seat: number): Props {
  const vp = s.players[seat]?.vp ?? 0;
  return {
    place: 1 + s.players.filter((p) => p.vp > vp).length,
    won: s.winner === seat,
    vp,
    players: s.players.length,
  };
}

/** minutes since a moment, when it is known */
export const minutesSince = (since: number | undefined): Props => (since === undefined ? {} : { minutes: Math.round((Date.now() - since) / 60_000) });
