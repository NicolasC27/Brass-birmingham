import type { CaptureResult, PostHog } from 'posthog-js';
import type { useGame as UseGame } from '@/game/store';

/* How the site is used, told to PostHog (EU cloud): the pages read and, at
   the table, what the screen is used for — the actions begun, the panels
   opened, the refusals met, the guide's steps. Cookieless: nothing is
   written in the browser, PostHog counts the visitors by a hash of its own
   that changes every day. Never a name, a code, a token or anything typed:
   an address goes with its codes masked and its query cut to the campaign.
   Only in the built site with VITE_POSTHOG_KEY — never on the developer's
   machine, nor for a browser that asks not to be followed (Do Not Track,
   GPC). The games themselves are measured by the office (server/measure.ts). */

const KEY = String(import.meta.env.VITE_POSTHOG_KEY ?? '').trim();
/** the site's own name: tools/deploy/Caddyfile passes /ingest on to PostHog */
const HOST = '/ingest';

/** the query words kept: where the reader came from, nothing else */
const KEPT = /^(via|ref|utm_(source|medium|campaign|content|term))$/;

/** the codes and tokens an address may carry; the first that fits is masked */
const MASKS: [RegExp, string][] = [
  [/^\/account\/(verify|reset)\/[^/]+/, '/account/$1/:token'],
  [/^\/avant-premiere\/(confirmer|retrait)\/[^/]+/, '/avant-premiere/$1/:token'],
  [/^\/game\/local\/[^/]+/, '/game/local/:code'],
  [/^\/(game|online)\/[^/]+/, '/$1/:code'],
];

/** the direction's own pages are nobody's usage */
const ADMIN = /^\/(direction|admin)(\/|$)/;

/** the table's pages: there the screen itself is read */
const TABLE = /^\/(game|demo)(\/|$)/;

export function maskPath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0];
  for (const [re, to] of MASKS) if (re.test(path)) return path.replace(re, to);
  return path;
}

/** an address of this site as the measures keep it; any other is left alone */
export function maskUrl(url: string, origin = location.origin): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (u.origin !== origin) return url;
  const kept = new URLSearchParams();
  for (const [k, v] of u.searchParams) if (KEPT.test(k)) kept.append(k, v);
  const query = kept.toString();
  return `${u.origin}${maskPath(u.pathname)}${query ? `?${query}` : ''}`;
}

/** every address an event carries, masked on its way out */
function scrub(cr: CaptureResult | null): CaptureResult | null {
  if (!cr) return null;
  const props = cr.properties;
  const page = typeof props.$pathname === 'string' ? props.$pathname : location.pathname;
  if (ADMIN.test(page)) return null;
  if (cr.event === '$pageview' && TABLE.test(page)) void watchTable();
  /* a page's title can carry a table's name */
  delete props.title;
  for (const [k, v] of Object.entries(props)) {
    if (typeof v !== 'string') continue;
    if (/(url|referrer)$/i.test(k)) props[k] = maskUrl(v);
    else if (/pathname$/i.test(k)) props[k] = maskPath(v);
  }
  return cr;
}

let posthog: PostHog | null = null;

/** something done on the site: dropped while the measures are not up, and
 *  always where they never are */
export function track(event: string, props?: Record<string, unknown>): void {
  posthog?.capture(event, props);
}

/** where the table stands (the mode, the era, the round), as the store last said */
let tableAt: Record<string, unknown> = {};

/** something done at the table that the page holds rather than the store */
export function trackTable(event: string, props?: Record<string, unknown>): void {
  track(event, { ...tableAt, ...props });
}

export function installMeasures(): void {
  if (!import.meta.env.PROD || !KEY) return;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.globalPrivacyControl === true || nav.doNotTrack === '1') return;
  /* after the page has its pictures: the measures never hold up the first paint */
  const start = () =>
    void import('posthog-js').then(({ default: ph }) => {
      ph.init(KEY, {
        api_host: HOST,
        ui_host: 'https://eu.posthog.com',
        cookieless_mode: 'always',
        person_profiles: 'never',
        capture_pageview: 'history_change',
        capture_pageleave: true,
        /* only what is named here: no clicks gathered wholesale, no recording,
           no settings fetched from PostHog that could turn more on */
        autocapture: false,
        rageclick: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_exceptions: false,
        capture_performance: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_product_tours: true,
        disable_web_experiments: true,
        advanced_disable_flags: true,
        disable_external_dependency_loading: true,
        mask_personal_data_properties: true,
        before_send: scrub,
      });
      posthog = ph;
    });
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

/* ------------------------------ the table ------------------------------ */

type GameStore = ReturnType<typeof UseGame.getState>;

/** what opens over the board, by the store's own word for it */
const PANELS: [keyof GameStore, string][] = [
  ['rulesOpen', 'rules'],
  ['marketFocus', 'market'],
  ['ledgerOpen', 'ledger'],
  ['askOpen', 'ask'],
  ['debriefOpen', 'debrief'],
  ['review', 'review'],
  ['lens', 'lens'],
  ['netPeek', 'network'],
  ['surveySeat', 'survey'],
  ['loanPeek', 'loan preview'],
  ['preparing', 'planning'],
  ['gameOverOpen', 'game over'],
];

const shown = (v: unknown): boolean => v !== null && v !== undefined && v !== false;

let watching = false;

/** the table's screen, read as it changes: loaded with the table, never
 *  before — the store is the page's own, already in hand */
async function watchTable(): Promise<void> {
  if (watching) return;
  watching = true;
  const [{ useGame }, { actorOf }] = await Promise.all([import('@/game/store'), import('@/game/actions')]);
  /* a table reached straight from an address may have its game before the measures are up */
  const held = useGame.getState();
  if (held.game) {
    tableAt = { mode: held.code ? 'table' : held.local ? 'home' : 'demo', era: held.game.era, round: held.game.round };
    track('board opened', tableAt);
  }
  useGame.subscribe((s, p) => {
    const g = s.game;
    if (!g || !posthog) return;
    /* a game in this browser alone is the front page's demo: the office
       never sees it, so its moves are counted here */
    const mode = s.code ? 'table' : s.local ? 'home' : 'demo';
    const at = { mode, era: g.era, round: g.round, ...(s.tutorial ? { tutorial: true, course: s.course } : {}) };
    tableAt = at;
    if (!p.game) track('board opened', at);
    if (s.verb && s.verb !== p.verb) track('action begun', { ...at, verb: s.verb });
    /* a loan is begun on its sheet, never as a verb */
    if (s.loanConfirm && !p.loanConfirm) track('action begun', { ...at, verb: 'loan' });
    if (s.shake && s.shake !== p.shake) track('refusal shown', { ...at, ...(s.verb ? { verb: s.verb } : {}), reason: s.shake.reason.slice(0, 80) });
    for (const [key, panel] of PANELS) if (shown(s[key]) && !shown(p[key])) track('panel opened', { ...at, panel });
    if (s.matPlayer !== null && s.matPlayer !== p.matPlayer) track('panel opened', { ...at, panel: s.matPlayer === s.mySeat() ? 'own mat' : 'rival mat' });
    if (s.followBots !== p.followBots) track('setting changed', { ...at, setting: 'follow machines', on: s.followBots });
    if (Object.keys(s.pins).length > Object.keys(p.pins).length) track('town pinned', at);
    if (s.notebook && !p.notebook) track('notebook used', at);
    if (s.telegramSentAt > p.telegramSentAt) track('telegram sent', at);
    if (s.coachStep >= 0 && s.coachStep !== p.coachStep) track('guide step', { ...at, step: s.coachStep });
    if (p.tutorial && !s.tutorial) track('guide ended', { ...at, step: p.coachStep });
    if (mode === 'demo' && p.game && g.actions.length === p.game.actions.length + 1) {
      const move = g.actions[g.actions.length - 1];
      if (!p.game.players[actorOf(p.game, move)]?.isBot) track('move played', { mode, kind: move.kind, era: p.game.era, round: p.game.round });
    }
  });
}
