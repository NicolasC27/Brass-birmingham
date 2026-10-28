import { INCOME_PAYOUT, LOAN_AMOUNT, LOAN_INCOME_HIT, MERCHANT_BY_ID, TOWN_BY_ID, eraRounds, incomeLevel } from '@/game/data';
import { buildTargets, canLoan, linkTargets, sellTargets } from '@/game/engine';
import { carries, faqBest, faqFor } from '@/game/faq';
import type { Passage } from '@/game/faq';
import { asksTheRules, consult, fold, mend, named, tongueOf } from '@/game/faq/consult';
import type { NearNotion } from '@/game/faq/consult';
import type { NotionId } from '@/game/faq/notions';
import { NO_FREE_LINK, onTheCard, refusalOf, whyNoLink } from '@/game/refusals';
import type { Card, GameState } from '@/game/types';
import { getLang, localeOf, reasonText } from '@/i18n';
import type { Lang } from '@/i18n';
import { lastRound } from './lessons';

/* ------------------------------------------------------------------ */
/* What the table answers, read off the game as it stands: why a deed  */
/* cannot be done right now, and the questions a player puts about    */
/* their own game — the purse, the rounds left, what can be sold. The  */
/* guide's lane and the question tool both ask here, so a question has */
/* one answer at every width. Pure: the words come in with `t`, and    */
/* the engine's own refusals are said in `lang`, the tongue of `t`.    */
/* ------------------------------------------------------------------ */

type T = (key: string, vars?: Record<string, string | number>) => string;
/** an engine refusal, said in the reader's tongue */
type Say = (reason: string) => string;
/** towns named in a line, as the reader's tongue lists them */
type List = (towns: string[], type: 'conjunction' | 'disjunction') => string;

const WORKS = ['cotton', 'manufacturer', 'pottery'];

/* ----------------------------- the block ----------------------------- */

const short = (r?: string) => !!r && r.startsWith('Needs £');

/** the reason alone, and the reason with the advice that follows it */
export type Block = { short: string; text: string; money: boolean };

/** the most towns a line names; past them the table speaks for the map */
const NAMED = 3;
const nameOf = (town: string): string => TOWN_BY_ID[town]?.name ?? town;

/** the engine's own refusal of the places a deed came nearest to, as the
 *  table gives it — at those towns, when they are few enough to name */
function tableSays<X extends { valid: boolean; reason?: string }>(reason: string, all: readonly X[], townOf: (x: X) => string, t: T, say: Say, list: List): string {
  const towns = [...new Set(all.filter((x) => !x.valid && x.reason === reason).map(townOf))];
  const why = say(reason);
  if (towns.length === 0 || towns.length > NAMED) return t('game.guide.blocked.why', { why });
  return t('game.guide.blocked.whyAt', { town: list(towns.map(nameOf), 'conjunction'), why });
}

/** the towns of the reader's network where the deed could be built now
 *  with a card they do not hold: there, the card alone is missing */
function openedByACard(g: GameState, me: number, inds: string[]): string[] {
  const any: Card = { id: 'any', kind: 'wild-industry' };
  return [...new Set(buildTargets(g, me, any).filter((x) => x.valid && inds.includes(x.industry)).map((x) => x.town))];
}

/** why the lesson's deed cannot be done at this table right now, said
 *  with the player's own figures, and whether money is what is missing;
 *  null when it can. Money short, the loan is the way; else the table's
 *  own reason is given — no connected coal, one tile to a town, no beer —
 *  with the towns of the network a card the reader lacks would open, and
 *  only a hand whose every card names another town or industry is told
 *  that no card will do */
export function blockedBy(id: string, g: GameState, me: number, t: T, lang: Lang = getLang()): Block | null {
  const p = g.players[me];
  const say: Say = (reason) => reasonText(reason, lang);
  const list: List = (towns, type) => new Intl.ListFormat(localeOf(lang), { type }).format(towns);
  const vars = { money: p.money, amount: LOAN_AMOUNT, hit: LOAN_INCOME_HIT };
  /* the loan, or the payday to come back after — none follows the last round */
  const advice = () => t(lastRound(g) ? 'game.guide.blocked.loanAdviceLast' : 'game.guide.blocked.loanAdvice', vars);
  const plain = (why: string): Block => ({ short: why, text: why, money: false });
  if (id === 'coal' || id === 'iron' || id === 'works') {
    const inds = id === 'coal' ? ['coal'] : id === 'iron' ? ['iron'] : WORKS;
    const targets = p.hand.flatMap((c) => buildTargets(g, me, c)).filter((x) => inds.includes(x.industry));
    if (targets.some((x) => x.valid)) return null;
    const dear = targets.filter((x) => short(x.reason));
    if (dear.length) {
      const why = t(`game.guide.blocked.${id}Money`, { ...vars, need: Math.min(...dear.map((x) => x.total)) });
      return { short: why, text: `${why} ${advice()}`, money: true };
    }
    /* the cards in hand point elsewhere, and a town of the network waits for one */
    const opens = openedByACard(g, me, inds);
    const card = !opens.length ? '' : opens.length > NAMED ? ` ${t('game.guide.blocked.cardIn')}` : ` ${t('game.guide.blocked.cardAt', { towns: list(opens.map(nameOf), 'disjunction') })}`;
    const best = refusalOf(targets)?.reason;
    if (!best || onTheCard(best)) return plain(`${t(`game.guide.blocked.${id}Card`, vars)}${card}`);
    return plain(`${t(`game.guide.blocked.${id}Now`)} ${tableSays(best, targets, (x) => x.town, t, say, list)}${card}`);
  }
  if (id === 'link') {
    const targets = linkTargets(g, me);
    if (targets.some((x) => x.valid)) return null;
    if (targets.some((x) => short(x.reason))) {
      const why = t('game.guide.blocked.linkMoney', vars);
      return { short: why, text: `${why} ${advice()}`, money: true };
    }
    /* every link that touches the network is laid; a rail may lack its coal */
    const why = whyNoLink(targets);
    return plain(why === NO_FREE_LINK ? t('game.guide.blocked.link', vars) : `${t('game.guide.blocked.linkNow')} ${t('game.guide.blocked.why', { why: say(why) })}`);
  }
  if (id === 'sell') {
    const targets = sellTargets(g, me);
    if (targets.some((x) => x.valid)) return null;
    /* a works joined to its buyer, and no beer to drink with it */
    const dry = targets.find((x) => x.reason)?.reason;
    if (dry) return plain(`${t('game.guide.blocked.sellNow')} ${tableSays(dry, targets, (x) => x.town, t, say, list)}`);
    /* the unsold works, and the merchants who buy their goods */
    const mine = Object.entries(g.tiles).filter(([, x]) => x.owner === me && !x.flipped && WORKS.includes(x.industry));
    const lines = mine.map(([key, x]) => {
      const buyers = Object.entries(g.merchantTiles)
        .filter(([, tiles]) => tiles.some((m) => m === 'all' || m === x.industry))
        .map(([id]) => MERCHANT_BY_ID[id]?.name ?? id);
      return t('game.guide.blocked.sellWorks', { industry: t(`game.log.industry.${x.industry}`), town: TOWN_BY_ID[key.split(':')[0]]?.name ?? key, buyers: buyers.join(', ') || '—' });
    });
    return plain([t('game.guide.blocked.sell', vars), ...lines].join(' '));
  }
  if (id === 'loan') return canLoan(g, me).ok ? null : plain(t('game.guide.blocked.loan', vars));
  return null;
}

/* ---------------------------- the questions -------------------------- */

/** the questions about the table the guide knows, in the order they are tried */
export const ASKS = ['do', 'sell', 'build', 'coal', 'beer', 'money', 'rounds', 'win', 'order'] as const;
export type Ask = (typeof ASKS)[number];

/** the industry of the tiles the guide's case names */
const INDUSTRY: Partial<Record<NotionId, string>> = {
  coalMine: 'coal',
  ironWorks: 'iron',
  brewery: 'brewery',
  cotton: 'cotton',
  manufacturer: 'manufacturer',
  pottery: 'pottery',
};

/** the notions a table's answer reaches beyond its own words: the sale
 *  answers for the works it would sell, the build for any tile — "can I
 *  sell my pottery" is still the table's question, and answered for the
 *  pottery; "what is a pottery" is the rules' */
const REACH: Partial<Record<Ask, NotionId[]>> = {
  sell: ['cotton', 'manufacturer', 'pottery', 'works'],
  build: ['coalMine', 'ironWorks', 'brewery', 'cotton', 'manufacturer', 'pottery', 'works'],
  /* "why does Wedgwood play before me" names the machine it answers for */
  order: ['machines'],
};

/** the question about this table the words point at, how long the
 *  phrase matched was — the same measure the written answers use, so the
 *  surest of the two wins rather than whichever was tried first — and the
 *  tile it is about, when it names one its answer reaches */
export function intentOf(q: string, t: T, lang: Lang): { id: Ask; score: number; about?: NotionId } | null {
  let best: { id: Ask; score: number; phrase: string } | null = null;
  /* as typed, and as mended — "jai combien dargent" is still the purse */
  const readings = [q, mend(q, lang)];
  /* "où", "wo": too short for the measure, yet a phrase that asks where
     wants the question to ask it too — "wie baue ich" is not "wo bauen" */
  const where = tongueOf(lang).where;
  const said = new Set(readings.flatMap((r) => fold(r).split(' ')));
  const unasked = (phrase: string) => fold(phrase).split(' ').some((w) => w.length < 3 && where.includes(w) && !said.has(w));
  for (const id of ASKS) {
    for (const phrase of t(`game.guide.ask.words.${id}`).split(',')) {
      const score = Math.max(...readings.map((r) => carries(r, phrase)));
      if (score && !unasked(phrase) && (!best || score > best.score)) best = { id, score, phrase };
    }
  }
  /* "c'est quoi la bière" is the rules' question, "j'ai de la bière" the
     table's: the table's phrase alone cannot tell them apart */
  if (!best || asksTheRules(q, lang, best.phrase, REACH[best.id])) return null;
  const about = named(q, lang, REACH[best.id] ?? [])[0];
  return about ? { id: best.id, score: best.score, about } : { id: best.id, score: best.score };
}

/** the answer, read off the table as it stands — for the tile the
 *  question names, when it names one */
export function answerTo(id: Ask, g: GameState, me: number, t: T, lang: Lang = getLang(), about?: NotionId): string {
  const p = g.players[me];
  const level = incomeLevel(p.income);
  const kind = about ? INDUSTRY[about] : undefined;
  switch (id) {
    case 'sell': {
      const targets = sellTargets(g, me);
      const ok = targets.find((x) => x.valid && (!kind || x.tile.industry === kind));
      if (ok) return t('game.guide.ask.answer.sellYes', { industry: t(`game.log.industry.${ok.tile.industry}`), town: TOWN_BY_ID[ok.town]?.name ?? ok.town, merchant: MERCHANT_BY_ID[ok.merchant]?.name ?? ok.merchant });
      if (kind) {
        const industry = t(`game.log.industry.${kind}`);
        /* none of that tile on the board, or it alone cannot sell */
        if (!Object.values(g.tiles).some((x) => x.owner === me && x.industry === kind && !x.flipped)) return t('game.guide.ask.answer.sellNoneOf', { industry });
        if (targets.some((x) => x.valid)) return t('game.guide.ask.answer.sellNoOf', { industry });
      }
      return blockedBy('sell', g, me, t, lang)?.text ?? t('game.guide.ask.answer.sellNo');
    }
    case 'build': {
      /* the slots the hand opens, each once however many cards reach it */
      const open = p.hand.flatMap((c) => buildTargets(g, me, c)).filter((x) => x.valid && (!kind || x.industry === kind));
      const n = new Set(open.map((x) => `${x.town}:${x.slot}`)).size;
      if (kind) {
        const industry = t(`game.log.industry.${kind}`);
        if (n > 0) return t('game.guide.ask.answer.buildYesOf', { n, industry });
        /* the lesson's own reason for a mine, a forge or a works */
        const lesson = kind === 'coal' ? 'coal' : kind === 'iron' ? 'iron' : WORKS.includes(kind) ? 'works' : null;
        return (lesson && blockedBy(lesson, g, me, t, lang)?.text) || t('game.guide.ask.answer.buildNoOf', { industry });
      }
      return n > 0 ? t('game.guide.ask.answer.buildYes', { n }) : (blockedBy('works', g, me, t, lang)?.text ?? t('game.guide.ask.answer.buildNo'));
    }
    case 'coal':
      return t('game.guide.ask.answer.coal', { left: g.market.coal, mine: Object.values(g.tiles).filter((x) => x.industry === 'coal' && !x.flipped).length });
    case 'beer':
      return t('game.guide.ask.answer.beer', { mine: Object.values(g.tiles).filter((x) => x.owner === me && x.industry === 'brewery' && !x.flipped).length, merchant: Object.values(g.merchantBeer).reduce((a, b) => a + b, 0) });
    case 'money':
      /* no payday follows the last round: a short game counts the purse
         and the level at its close, a full one counts neither */
      if (lastRound(g)) return t(g.eraLength === 'short' ? 'game.guide.ask.answer.moneyLastShort' : 'game.guide.ask.answer.moneyLast', { money: p.money, level });
      return t(level >= 0 ? 'game.guide.ask.answer.money' : 'game.guide.ask.answer.moneyOwed', { money: p.money, level, pay: Math.abs(INCOME_PAYOUT[p.income]) });
    case 'rounds': {
      /* the rounds after this one; a full game's canal era has the rail's
         to follow, the game's last round no payday; the actions left are
         the reader's own on their turn only */
      const total = eraRounds(g.players.length);
      const left = Math.max(0, total - g.round);
      const said = [t(left > 0 ? 'game.guide.ask.answer.rounds' : 'game.guide.ask.answer.roundsLast', { round: g.round, total, left })];
      if (g.era === 'canal' && g.eraLength !== 'short') said.push(t('game.guide.ask.answer.roundsRail', { total }));
      else if (lastRound(g)) said.push(t('game.guide.ask.answer.roundsEnd'));
      if (g.current === me) said.push(t('game.guide.ask.answer.roundsTurn', { actions: g.actionsLeft }));
      return said.join(' ');
    }
    case 'win': {
      const said = t('game.guide.ask.answer.win', { mine: p.vp, best: Math.max(...g.players.map((x) => x.vp)) });
      /* the canal era counts little before its end — a merchant's barrel at
         most: its tiles and links score there, and a short game's close
         adds the purse and the income level */
      if (g.era !== 'canal') return said;
      return `${said} ${t(g.eraLength === 'short' ? 'game.guide.ask.answer.winYetShort' : 'game.guide.ask.answer.winYet')}`;
    }
    case 'order': {
      /* who plays when, and why: the money spent in the round before, the
         least first — the first round's order is drawn — and what the
         reader has spent so far, on which the next round's is set */
      const list = new Intl.ListFormat(localeOf(lang), { type: 'conjunction' });
      const seat = (i: number, spent?: number) => {
        const name = i === me ? t('game.guide.ask.answer.orderYou') : g.players[i].name;
        return spent === undefined ? name : t('game.guide.ask.answer.orderSeat', { name, spent });
      };
      const said = g.lastSpent
        ? t('game.guide.ask.answer.order', { list: list.format(g.order.map((i) => seat(i, g.lastSpent?.[i]))) })
        : t('game.guide.ask.answer.orderFirst', { list: list.format(g.order.map((i) => seat(i))) });
      return lastRound(g) ? said : `${said} ${t('game.guide.ask.answer.orderNext', { spent: p.spent })}`;
    }
    case 'do':
    default:
      /* the note asks the expert on the reader's own turn only: off it, the
         answer promises no plate, it says where and when to ask */
      return g.phase === 'action' && g.current === me && !p.isBot ? t('game.guide.ask.answer.do') : t('game.guide.ask.answer.doTool', { ask: t('game.guide.suggest.ask') });
  }
}

/** who asks: the game at hand, the seat asking, and whether the
 *  assistance lets the table speak (it does unless told otherwise) */
export type Asker = { g: GameState; me: number; aid?: boolean };

/** the table answers while moves are played, to a seat of the game, where
 *  the assistance is on: a finished game has no next payday nor round, and
 *  a spectator has no purse — they are answered from the rules */
export const tableSpeaks = (at: Asker | null): at is Asker => !!at && at.aid !== false && at.me >= 0 && at.g.phase === 'action';

/** a question put, answered in two tries: the table as it stands, when it
 *  speaks and it is the surer match; then the guide's case — the notions
 *  of the game, the written answers, the rules codex — and, when nothing
 *  there is close, the notions it might mean (near). The case answers a
 *  short game as one, whether the table speaks or not */
export function answerQuestion(q: string, at: Asker | null, t: T, lang: Lang, passages: Passage[]): { answer: string; intent: Ask | null; notion: NotionId | null; near: NearNotion[] } {
  const game = tableSpeaks(at) ? at : null;
  const table = game ? intentOf(q, t, lang) : null;
  const written = faqBest(q, faqFor(lang));
  const id = game && table && (!written || table.score >= written.score) ? table.id : null;
  if (id && game) return { answer: answerTo(id, game.g, game.me, t, lang, table?.about), intent: id, notion: null, near: [] };
  const found = consult(q, lang, passages, at?.g.eraLength === 'short');
  return { answer: found.answer, intent: null, notion: found.notion, near: found.kind === 'near' ? found.near : [] };
}
