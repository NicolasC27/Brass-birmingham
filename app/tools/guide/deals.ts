/* ------------------------------------------------------------------ */
/* The guided game's deals: the seeds its lessons hold on.            */
/*                                                                    */
/* A seed is kept when its deal holds what the first lessons take for */
/* granted (guidedDeal.dealMisses), and when the guided game, played  */
/* out on it — the real lessons, settled and shown as the guide does, */
/* the machine thinking as it does at home — goes as they promise:    */
/*   - a careful reader, who follows the lessons' criteria (the forge */
/*     card kept, the canal to a forge town, a works linked to its    */
/*     buyer), feeds a forge from their own mine and sells a first    */
/*     works by round 5, whichever mine the lesson on coal names they */
/*     pick;                                                          */
/*   - a reader who takes the first place offered builds a forge and  */
/*     sells by round 5 all the same;                                 */
/*   - neither is ever held by a lesson with no way on, nor misses    */
/*     one;                                                           */
/* at the machine's two forms at the guided table (0.5, and the floor */
/* 0.3). Of the seeds kept, the list takes the first of each layout   */
/* of the merchants' tiles, in seed order, twelve at most: another    */
/* deal each time, and other buyers. The list is TUTORIAL_SEEDS, in   */
/* game/quickplay.ts; guidedDeal.test.ts checks its cheap half.       */
/*                                                                    */
/* The machine thinks 200 ms a move, as a browser lets it at home. At */
/* 0.5 its search stops on the clock, so the played-out half holds at */
/* node's speed on the machine that ran it: a slower one may see the  */
/* machine play otherwise (a run under load gave the same list). Run  */
/* it again after a change to the machines, the deck, the shuffle or  */
/* the lessons, and paste the list it prints.                         */
/*                                                                    */
/* From app/:                                                         */
/*   ./node_modules/.bin/esbuild tools/guide/deals.ts --bundle        */
/*     --platform=node --format=esm --alias:@=./src                   */
/*     --define:import.meta.env='{"DEV":false}'                       */
/*     --outfile=tools/guide/dist/deals.mjs --log-level=warning       */
/*   node tools/guide/dist/deals.mjs [first seed] [last seed]         */
/* (1 to 3000 by default: two minutes on sixteen cores). One seed:    */
/*   node tools/guide/dist/deals.mjs --seed 3                         */
/* ------------------------------------------------------------------ */

import './memory';
import { execFile } from 'node:child_process';
import { cpus } from 'node:os';
import { applyAction, botAction, fallbackAction } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { chooseBotMove, spareCard } from '@/game/bot';
import { BOT_SKILL, INDUSTRIES, MERCHANTS, TOWN_BY_ID, TOWNS } from '@/game/data';
import { buildTargets, canLoan, coalChoices, linkTargets, merchantDemand, merchantOpen, planBeer, reachable, sellTargets } from '@/game/engine';
import type { BuildTarget } from '@/game/engine';
import { TUTORIAL_SEEDS, tutorialSetup } from '@/game/quickplay';
import { chooseBotAction, legalActions } from '@/game/search';
import type { Card, GameState, IndustryType, LinkDef, SetupPayload, Verb } from '@/game/types';
import { dealMisses, dealtAs } from '@/components/game/guidedDeal';
import { lensFor } from '@/components/game/lensFor';
import { LAST_LESSON, LESSONS, detourOf, due, freshProgress, optionalNow, pass, progressAt, saveProgress, see, setAside, settle, wayOn } from '@/components/game/lessons';
import type { LessonCtx } from '@/components/game/lessons';
import { forgesFrom } from '@/components/game/lessonWords';
import { blockedBy } from '@/components/game/tableAnswers';
import { trIn } from '@/i18n';

type Reader = 'careful' | 'first';
interface Played {
  forge: 'own' | 'other' | null;
  sold: number | null;
  trapped: string[];
  unseen: string[];
  faults: string[];
}

const SETUP = tutorialSetup() as unknown as SetupPayload;
const FORMS = [0.5, 0.3];
const LIST = 12;
const ME = 0;
const WORKS: readonly string[] = ['cotton', 'manufacturer', 'pottery'];
const t = (k: string, v?: Record<string, string | number>) => trIn('en', k, v);
const ends = (l: LinkDef) => [l.a, l.b, ...(l.alsoConnects ? [l.alsoConnects] : [])];
const IRON_TOWNS = new Set(TOWNS.filter((x) => x.slots.some((s) => s.allows.includes('iron'))).map((x) => x.id));
const isIron = (c: Card) => c.kind === 'industry' && (c.industry === 'iron' || c.industry2 === 'iron');

/** the guided game on one deal, played to its end by a reader — `mine`
 *  the town of their first mine, else where the lens sends them — with
 *  the machine at a form */
function play(seed: number, reader: Reader, mine: string | null, form: number): Played {
  let g: GameState = dealtAs(SETUP, seed);
  const code = `S${seed}`;
  saveProgress(freshProgress(code));
  const ui = { sel: null as string | null, mat: null as number | null, sheet: false, verb: null as Verb | null, pick: null as BuildTarget | null };
  const ctx = (): LessonCtx => ({ g, me: ME, ...ui });
  const out: Played = { forge: null, sold: null, trapped: [], unseen: [], faults: [] };

  /* ---- the reader's moves ---- */
  type Pick = { card: Card; t: BuildTarget };
  const hand = () => g.players[ME].hand;
  const builds = (inds: readonly string[], cardOk: (c: Card) => boolean = () => true): Pick[] =>
    hand().flatMap((card) => (cardOk(card) ? buildTargets(g, ME, card).filter((x) => x.valid && inds.includes(x.industry)).map((x) => ({ card, t: x })) : []));
  const build = (b: Pick, extra: object = {}): GameAction => ({ kind: 'build', card: b.card.id, town: b.t.town, slot: b.t.slot, industry: b.t.industry, ...extra }) as GameAction;
  const mines = () => Object.entries(g.tiles).filter(([, x]) => x.owner === ME && x.industry === 'coal').map(([k]) => k.split(':')[0]);
  const ownIn = (town: string) => Object.entries(g.tiles).some(([k, x]) => x.owner === ME && k.split(':')[0] === town);
  const forgeFree = (town: string) => !ownIn(town) && TOWN_BY_ID[town].slots.some((s, i) => s.allows.includes('iron') && !g.tiles[`${town}:${i}`]);
  const buyer = (town: string, industry: string) => {
    const reach = reachable(g, town, g.era, null);
    return MERCHANTS.filter((m) => merchantOpen(g, m.id) && reach.has(m.id) && merchantDemand(g, m.id).includes(industry as IndustryType));
  };
  /* the careful reader keeps the forge card, and the location cards of towns linked to a buyer of their works */
  const kept = (c: Card) => isIron(c) || (c.kind === 'location' && !!c.town && TOWN_BY_ID[c.town].slots.some((s) => s.allows.some((ind) => WORKS.includes(ind) && buyer(c.town!, ind).length > 0)));
  const spare = (): Card => {
    const all = hand();
    if (reader !== 'careful') return spareCard(g, ME, all) ?? all[0];
    const free = all.filter((c) => !kept(c));
    const rest = free.length ? free : all.filter((c) => !isIron(c));
    return spareCard(g, ME, rest.length ? rest : all) ?? all[0];
  };
  const linked = (b: Pick) => buyer(b.t.town, b.t.industry).some((m) => planBeer(g, ME, b.t.town, m.id, INDUSTRIES[b.t.industry][b.t.level - 1].beerToSell, [], new Map(), b.t.industry).shortage === 0);
  const sale = (ok: (x: ReturnType<typeof sellTargets>[number]) => boolean = () => true): GameAction | null => {
    const s = sellTargets(g, ME).find((x) => x.valid && ok(x));
    return s ? { kind: 'sell', card: spare().id, sales: [{ town: s.town, slot: s.slot, merchant: s.merchant }] } : null;
  };
  const canalToBuyer = (): GameAction | null => {
    const card = spare();
    for (const x of linkTargets(g, ME).filter((y) => y.valid)) {
      const a: GameAction = { kind: 'network', card: card.id, link: x.link.id };
      const r = applyAction(g, ME, a);
      if (r.state && sellTargets(r.state, ME).length > sellTargets(g, ME).length) return a;
    }
    return null;
  };

  /** what the reader plays for the deed on show, if anything */
  function deed(id: string): GameAction | null {
    const careful = reader === 'careful';
    switch (id) {
      case 'coal': {
        let l = builds(['coal'], (c) => c.kind === 'industry' && c.industry === 'coal');
        if (!l.length) l = builds(['coal']);
        if (!l.length) return null;
        const lamp = lensFor('coal', { g, me: ME, sel: l[0].card.id, mat: null, verb: 'build' })?.at;
        const want = careful ? (mine ?? lamp) : null;
        return build(l.find((x) => x.t.town === want) ?? l[0]);
      }
      case 'link': {
        const at = mines();
        const valid = linkTargets(g, ME).filter((x) => x.valid);
        const touching = valid.filter((x) => at.some((m) => ends(x.link).includes(m)));
        const score = (l: LinkDef) => {
          const to = ends(l).filter((e) => !at.includes(e)).find((e) => IRON_TOWNS.has(e) && forgeFree(e));
          return !careful || !to ? 0 : 2 + (coalChoices(g, to, [l]).some((y) => y.owner === ME) ? 1 : 0);
        };
        const best = [...(touching.length ? touching : valid)].sort((a, b) => score(b.link) - score(a.link))[0];
        return best ? { kind: 'network', card: spare().id, link: best.link.id } : null;
      }
      case 'iron': {
        let l = builds(['iron'], isIron);
        if (!l.length) l = builds(['iron']);
        const ranked = l.map((b) => ({ b, own: coalChoices(g, b.t.town).find((y) => y.owner === ME) })).sort((a, b) => Number(!!b.own) - Number(!!a.own));
        if (!ranked.length) return null;
        return build(ranked[0].b, ranked[0].own && careful ? { coalFrom: [ranked[0].own.key] } : {});
      }
      case 'works': {
        const l = builds(WORKS);
        const b = careful ? (l.find(linked) ?? l[0]) : l[0];
        return b ? build(b) : null;
      }
      case 'sell':
        return sale() ?? (careful ? canalToBuyer() : null);
      case 'loan':
        return canLoan(g, ME).ok ? { kind: 'loan', card: spare().id } : null;
      case 'reach': {
        const b = builds(WORKS).find(linked);
        return b ? build(b) : canalToBuyer();
      }
      case 'barrel':
        return sale((x) => x.beer.some((b) => b.kind === 'merchant'));
    }
    return null;
  }

  /** a move of the reader's own, the lessons silent: sell when a sale is
   *  there, borrow when the purse is thin, else a foreman's move */
  function freeMove(): GameAction {
    const ok = (a: GameAction | null): a is GameAction => !!a && !!applyAction(g, ME, a).state;
    const s = sale();
    if (ok(s)) return s;
    const loan: GameAction = { kind: 'loan', card: spare().id };
    if (g.players[ME].money < 8 && g.round <= 8 && canLoan(g, ME).ok && ok(loan)) return loan;
    const m = botAction(chooseBotMove(g, ME, BOT_SKILL.foreman));
    if (ok(m)) return m;
    return legalActions(g, ME).find(ok) ?? fallbackAction(g, ME);
  }

  /* ---- the guide, as Guide.tsx settles and shows it ---- */
  const shown = new Set<string>();
  const pastNoWay: Record<string, Set<number>> = {};
  function view() {
    const c = ctx();
    const before = progressAt(code);
    const settled = settle(before, c);
    const owed = due(settled, c);
    const showing = owed.mode !== 'idle' && owed.mode !== 'finished';
    const block = owed.mode === 'do' ? blockedBy(owed.id!, g, ME, t, 'en') : null;
    const detour = !!(block?.money && detourOf(settled, owed, c, true, canLoan(g, ME).ok));
    const id = detour ? 'loan' : (owed.id ?? LAST_LESSON);
    const spareNow = showing && !detour && owed.mode === 'do' && optionalNow(id, c);
    const live = showing ? see(settled, id, c) : settled;
    if (live !== before) saveProgress(live);
    if (showing) shown.add(id);
    const page = showing && !detour && (owed.mode === 'read' || owed.mode === 'already');
    return { c, owed, live, block, detour, id, spareNow, page };
  }
  /* a move prepared in the hand, as the reader does it: the pages it calls for are read */
  function move(a: GameAction) {
    if (a.kind === 'build' || a.kind === 'network' || a.kind === 'sell' || a.kind === 'develop') {
      const card = hand().find((x) => x.id === a.card);
      Object.assign(ui, { sel: a.card, verb: a.kind, pick: a.kind === 'build' && card ? (buildTargets(g, ME, card).find((x) => x.town === a.town && x.slot === a.slot && x.industry === a.industry) ?? null) : null });
      for (let i = 0; i < 6; i++) {
        const v = view();
        if (!v.page) break;
        saveProgress(pass(v.live, v.id));
      }
    }
    const round = g.round;
    const r = applyAction(g, ME, a);
    Object.assign(ui, { sel: null, verb: null, pick: null });
    if (!r.state) {
      out.faults.push(`round ${g.round}: ${a.kind} refused (${r.error})`);
      g = applyAction(g, ME, fallbackAction(g, ME)).state!;
      return;
    }
    g = r.state;
    const forge = g.ledger.find((e) => e.player === ME && e.key === 'build' && e.vars?.industry === 'iron');
    if (forge && !out.forge) out.forge = String(forge.vars!.coalFrom ?? '').split(',').some((x) => x.startsWith(`${ME}:`)) ? 'own' : 'other';
    if (g.players[ME].stats.sold > 0 && out.sold === null) out.sold = round;
  }

  let guard = 0;
  while (g.phase === 'action' && guard++ < 4000) {
    const v = view();
    /* a page, or a deed done beforehand: read, then Next */
    if (v.page) {
      saveProgress(pass(v.live, v.id));
      if (due(progressAt(code), ctx()).id === 'hand') ui.mat = null;
      continue;
    }
    if (g.current !== ME) {
      const seat = g.current;
      const m = chooseBotAction(g, seat, { budgetMs: 200, strength: form });
      g = (m && applyAction(g, seat, m).state) || applyAction(g, seat, fallbackAction(g, seat)).state!;
      continue;
    }
    if (v.owed.mode !== 'do') {
      move(freeMove());
      continue;
    }
    const { id, owed, live, c, block, detour } = v;
    if (id === 'mat') ui.mat = ME;
    else if (id === 'matRead') ui.sheet = true;
    else if (id === 'hand') ui.sel = hand()[0].id;
    else if (v.spareNow) saveProgress(pass(live, id));
    else {
      const way = wayOn(live, owed.id!, c, !!block);
      const later = way === 'later' || way === 'both';
      const skip = (!detour && !!block) || (detour && !later) || way === 'skip' || way === 'both';
      const a = id === 'onYourOwn' ? null : deed(id);
      if (a && applyAction(g, ME, a).state) move(a);
      else if (later && id !== 'onYourOwn') saveProgress(setAside(live, owed.id!, c));
      else if (skip && id !== 'onYourOwn') saveProgress(pass(live, owed.id!));
      else {
        /* played past a deed with no way on: a trap, if it lasts — but
           the round on one's own, which is played past by design */
        if (id !== 'onYourOwn') (pastNoWay[owed.id!] ??= new Set()).add(g.round);
        move(freeMove());
      }
    }
  }
  if (guard >= 4000) out.faults.push('endless game');
  out.trapped = Object.entries(pastNoWay).filter(([, rounds]) => rounds.size >= 2).map(([id]) => id);
  /* the last lesson is shown on the closing ledger, past the table */
  out.unseen = LESSONS.map((l) => l.id).filter((id) => id !== LAST_LESSON && !shown.has(id));
  return out;
}

/** the first thing wrong with a game, for this reader; null when it went as the lessons promise */
function wrong(p: Played, reader: Reader): string | null {
  if (p.faults.length) return p.faults[0];
  if (p.trapped.length) return `held by ${p.trapped.join(', ')}`;
  if (p.unseen.length) return `never shown ${p.unseen.join(', ')}`;
  if (reader === 'careful' ? p.forge !== 'own' : !p.forge) return p.forge ? 'forge not fed by its own mine' : 'no forge';
  if (p.sold === null || p.sold > 5) return 'no sale by round 5';
  return null;
}

const nameOf = (id: string) => TOWN_BY_ID[id]?.name ?? MERCHANTS.find((m) => m.id === id)?.name ?? id;
/** who holds the merchants' tiles that buy: the deal's layout */
const layoutOf = (g: GameState) =>
  (['cotton', 'manufacturer', 'all'] as const).map((tile) => `${tile} ${MERCHANTS.filter((m) => (g.merchantTiles[m.id] ?? []).includes(tile)).map((m) => m.name).join('+') || '—'}`).join(', ');
const handOf = (g: GameState) => g.players[ME].hand.map((c) => (c.kind === 'location' && c.town ? nameOf(c.town) : `[${c.industry}]`)).join(' ');

interface Verdict {
  seed: number;
  kept: boolean;
  /** what went wrong, and the reader it went wrong for */
  why: string;
  /** where: the mine, the machine's form */
  where: string;
  layout: string;
  hand: string;
}

/** one seed, through every game it must hold: the cheap ones first, the first failure ends it */
function judge(seed: number): Verdict {
  const g = dealtAs(SETUP, seed);
  const base = { seed, layout: layoutOf(g), hand: handOf(g) };
  const misses = dealMisses(g, ME);
  if (misses.length) return { ...base, kept: false, why: `the deal lacks ${misses.join(', ')}`, where: '' };
  const coal = g.players[ME].hand.find((c) => c.kind === 'industry' && c.industry === 'coal')!;
  const named = [...new Set(buildTargets(g, ME, coal).filter((x) => x.valid && x.industry === 'coal' && forgesFrom(g, ME, x.town).length > 0).map((x) => x.town))];
  const games: [Reader, string | null][] = [['careful', null], ['first', null], ...named.map((town): [Reader, string] => ['careful', town])];
  for (const form of FORMS)
    for (const [reader, mine] of games) {
      const why = wrong(play(seed, reader, mine, form), reader);
      if (why) return { ...base, kept: false, why: `${reader} reader: ${why}`, where: `${mine ? `mine at ${nameOf(mine)}, ` : ''}machine at ${form}` };
    }
  return { ...base, kept: true, why: '', where: '' };
}

const seedArg = process.argv.indexOf('--seed');
if (seedArg >= 0) {
  console.log(JSON.stringify(judge(Number(process.argv[seedArg + 1]))));
} else {
  const [from, to] = [Number(process.argv[2] ?? 1), Number(process.argv[3] ?? 3000)];
  /* the cheap half here; each seed left is played out in a process of its own, on every core */
  const left: number[] = [];
  for (let s = from; s <= to; s++) if (!dealMisses(dealtAs(SETUP, s), ME).length) left.push(s);
  console.error(`seeds ${from}–${to}: ${left.length} deals hold what the first lessons take for granted; playing them out…`);
  const verdicts: Verdict[] = [];
  const next = (): Promise<void> => {
    const s = left.shift();
    if (s === undefined) return Promise.resolve();
    return new Promise<void>((done) =>
      execFile(process.execPath, [process.argv[1], '--seed', String(s)], { maxBuffer: 1 << 20 }, (err, stdout) => {
        verdicts.push(err ? { seed: s, kept: false, why: String(err), where: '', layout: '', hand: '' } : (JSON.parse(stdout) as Verdict));
        done();
      }),
    ).then(next);
  };
  await Promise.all(Array.from({ length: cpus().length }, next));
  verdicts.sort((a, b) => a.seed - b.seed);
  const kept = verdicts.filter((v) => v.kept);
  const why = new Map<string, number>();
  for (const v of verdicts) if (!v.kept) why.set(v.why, (why.get(v.why) ?? 0) + 1);
  console.log(`\n${kept.length} of ${verdicts.length} played out are kept. Turned down:`);
  for (const [w, n] of [...why].sort((a, b) => b[1] - a[1])) console.log(`  ${n}× ${w}`);
  /* the first of each layout, in seed order */
  const pick: Verdict[] = [];
  for (const v of kept) if (pick.length < LIST && !pick.some((p) => p.layout === v.layout)) pick.push(v);
  console.log(`\nThe list — the first deal of each layout of the merchants' tiles:`);
  for (const v of pick) console.log(`  ${String(v.seed).padStart(5)}  ${v.layout.padEnd(58)} ${v.hand}`);
  const listed = pick.map((v) => v.seed);
  const same = listed.length === TUTORIAL_SEEDS.length && listed.every((s, i) => s === TUTORIAL_SEEDS[i]);
  console.log(`\n[${listed.join(', ')}]${same ? ' — as TUTORIAL_SEEDS stands' : `\nTUTORIAL_SEEDS holds [${TUTORIAL_SEEDS.join(', ')}]`}`);
}
