import { fr } from '@/i18n/fr';
import { setLang, tr } from '@/i18n';
import type { ChallengeBoard, Dispatch, Edition, SeasonReview } from '@/online/table';

/* ------------------------------------------------------------------ */
/* The Monday edition, as the house writes it out: the club's week in  */
/* plain lines for a letter and for the telegraph. French, the club's  */
/* language; the dictionary's own words, said through the site's own   */
/* formatter, so a counted word agrees here exactly as it agrees on    */
/* the page.                                                           */
/* ------------------------------------------------------------------ */

/* the office writes in French, and sets the desk that way once */
setLang('fr');

/** a line of the club's French dictionary, counts agreed */
const say = (key: string, vars?: Record<string, string | number>): string => tr(key, vars);

/** a dispatch, said the Gazette's way in French */
export function dispatchLine(d: Dispatch): string {
  const industry = fr.game.log.industry as Record<string, string>;
  const goods = typeof d.vars.goods === 'string' && industry[d.vars.goods] ? industry[d.vars.goods] : '';
  const key = `game.gazette.${d.key}`;
  /* an unknown dispatch stands under its own name rather than its path */
  const said = say(key, { ...d.vars, goods });
  /* the fine spaces inside the quotation marks are written out, so a
     reader of this file can see them */
  return `«\u202f${d.table}\u202f» — ${said === key ? d.key : said}`;
}

/** a service's review, as lines */
export function seasonText(r: SeasonReview, appUrl: string): { subject: string; text: string } {
  const p = fr.platform;
  const lines: string[] = [`BLACKRAIL — ${p.seasons.review.toLowerCase()} · ${r.season.name}`, ''];
  lines.push(say('platform.seasons.games', { n: r.games }));
  if (r.best) {
    lines.push('', p.seasons.best.toUpperCase(), say('platform.home.edition.bestLine', { table: r.best.name, name: r.best.winner, vp: r.best.vp }));
  }
  if (r.players.length) {
    lines.push('', p.seasons.players.toUpperCase());
    for (const [i, row] of r.players.slice(0, 5).entries()) lines.push(`${i + 1}. ${row.name} — ${row.rating}`);
  }
  if (r.companies.length) {
    lines.push('', p.companies.title.toUpperCase());
    for (const [i, row] of r.companies.slice(0, 3).entries()) lines.push(`${i + 1}. ${row.name} — ${say('platform.companies.wins', { n: row.wins, games: row.games })}`);
  }
  lines.push('', appUrl, '', '— Le télégraphe de Blackrail');
  return { subject: `Blackrail — ${p.seasons.review.toLowerCase()} · ${r.season.name}`, text: lines.join('\n') };
}

/** the edition of a week, as lines */
export function editionText(edition: Edition, board: ChallengeBoard, appUrl: string): { subject: string; text: string } {
  const p = fr.platform;
  const lines: string[] = [];
  lines.push(`BLACKRAIL — ${p.home.edition.title.toLowerCase()} · semaine ${edition.week + 1}`);
  lines.push('');
  if (edition.games === 0) lines.push(p.home.edition.none);
  else {
    lines.push(say('platform.home.edition.games', { n: edition.games }));
    if (edition.best) {
      lines.push('');
      lines.push(p.home.edition.best.toUpperCase());
      lines.push(say('platform.home.edition.bestLine', { table: edition.best.name, name: edition.best.winner, vp: edition.best.vp }));
      lines.push(edition.best.players.join(' · '));
    }
    if (edition.busiest) {
      lines.push('');
      lines.push(say('platform.home.edition.busiest', { name: edition.busiest.name, n: edition.busiest.games }));
    }
  }
  lines.push('');
  lines.push(p.challenge.board.title);
  if (board.rows.length === 0) lines.push(p.challenge.board.empty);
  else for (const [i, r] of board.rows.slice(0, 5).entries()) lines.push(`${i + 1}. ${r.name} — ${say('platform.challenge.points', { n: r.points })} (${r.met.filter(Boolean).length}/${r.met.length})`);
  lines.push('');
  lines.push(appUrl);
  lines.push('');
  lines.push('— Le télégraphe de Blackrail');
  return { subject: `Blackrail — ${p.home.edition.title.toLowerCase()}`, text: lines.join('\n') };
}
