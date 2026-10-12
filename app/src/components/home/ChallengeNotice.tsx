import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Check, Flag, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { personaName } from '@/game/data';
import { listHomeGames } from '@/game/home';
import { attemptsOf, challengeOf, openAttemptOf, startChallenge, type Rule } from '@/game/challenge';
import { daysLeft } from '@/platform/almanac';
import { lobby } from '@/online/lobby';
import { postChallenge, useChallengeBoard, useSession } from '@/online/session';
import { preloadGame } from '@/platform/preload';
import GlossMark from '@/components/platform/GlossMark';

/* ------------------------------------------------------------------ */
/* The notice of the week, printed on the front page: its number and   */
/* title, the story in italic, the conditions as a list with a mark    */
/* against each once an attempt has been read, the machines across    */
/* the table, the days left, my best points, and the ticket to sit.    */
/* ------------------------------------------------------------------ */

/** a condition, in the reader's words */
function ruleText(t: ReturnType<typeof useT>, rule: Rule): string {
  switch (rule.kind) {
    case 'win':
      return t('platform.challenge.rules.win');
    case 'vp':
      return t('platform.challenge.rules.vp', { n: rule.min });
    case 'loans':
      return rule.max === 0 ? t('platform.challenge.rules.loansNone') : t('platform.challenge.rules.loansMax', { n: rule.max });
    case 'industry': {
      const industry = t(`game.settings.industry.${rule.industry}`).toLowerCase();
      if (rule.era) return t('platform.challenge.rules.industryEra', { count: rule.count, industry, era: t(`platform.challenge.era.${rule.era}`) });
      return t(rule.sold ? 'platform.challenge.rules.industrySold' : 'platform.challenge.rules.industry', { count: rule.count, industry, level: rule.level });
    }
    case 'links':
      return t(rule.era === 'rail' ? 'platform.challenge.rules.linksRail' : 'platform.challenge.rules.links', { n: rule.min });
    case 'doubleRails':
      return t('platform.challenge.rules.doubleRails', { n: rule.min });
    case 'income':
      return t('platform.challenge.rules.income', { n: rule.min });
    case 'money':
      return t('platform.challenge.rules.money', { n: rule.min });
    case 'develops':
      return t('platform.challenge.rules.develops', { n: rule.min });
  }
}

/* the ticket keeps to its column: between 900 and about 1100px the
   column is narrow, and a long label (the German one above all) folds
   onto more lines, a long word hyphenated, rather than crossing the
   frame and pushing the page sideways. A label that fits is printed as
   before, one line, 40px high; in the narrow band the right margin gives
   a few pixels back so the arrow stays with its word. The ticket's own
   rule sits outside the layers, hence the marks */
const FOLD =
  'max-w-full !h-auto min-h-[40px] !whitespace-normal !py-2 text-left leading-snug hyphens-auto break-words min-[900px]:max-[1099px]:!pr-3';

export default function ChallengeNotice() {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const [challenge] = useState(() => challengeOf());
  const [attempts] = useState(() => attemptsOf(challenge.week));
  const [open] = useState(() => openAttemptOf(challenge.week, listHomeGames()));
  const best = attempts[0] ?? null;
  const board = useChallengeBoard(challenge.week);
  /* my best attempt reaches the office once I am signed in — it keeps the best */
  useEffect(() => {
    if (session && best) postChallenge(best);
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const rivals = challenge.rivals.map(personaName).join(', ');
  const options = [challenge.options.marketTemper === 'volatile' && t('platform.challenge.optVolatile'), challenge.options.eraLength === 'short' && t('platform.challenge.optShort')].filter(Boolean).join(' · ');

  const take = () => {
    const me = session?.name ?? lobby.me.name.trim() ?? '';
    void startChallenge(challenge, me || t('setup.defaults.playerOne')).then((code) => navigate(`/game/local/${code}`));
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ amount: 0.15, once: true }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      id="defi"
      aria-label={t('platform.challenge.eyebrow')}
      className="gz-classified scroll-mt-24 !items-stretch !p-0 !text-left"
    >
      <div className="grid gap-6 p-6 min-[900px]:grid-cols-12 min-[900px]:gap-8 min-[900px]:p-7">
        <div className="min-[900px]:col-span-5">
          <p className="eyebrow-fell flex items-center gap-2">
            <Flag size={13} aria-hidden />
            {t('platform.challenge.eyebrow')}
            <GlossMark id="avis" />
          </p>
          <p className="micro-label mt-3 text-iron-400">
            {t('platform.challenge.number', { n: challenge.number })}
            {options && <span className="text-iron-400"> · {options}</span>}
          </p>
          <h2 className="mt-1 font-fraunces text-[26px] font-medium leading-tight text-paper-100">
            {t(`platform.challenge.titles.${challenge.id}`)}
          </h2>
          <p className="mt-3 max-w-[440px] font-serif text-[15px] italic leading-relaxed text-paper-300">{t(`platform.challenge.stories.${challenge.id}`)}</p>
          {/* the machines' names are names, not figures: the ledger's mono is kept for what counts */}
          <p className="mt-3 font-ui text-[10.5px] text-iron-400">{t('platform.challenge.rivals', { names: rivals })}</p>
        </div>

        <div className="min-[900px]:col-span-4 min-[900px]:border-l min-[900px]:border-[var(--gz-ink-soft)] min-[900px]:pl-8">
          {/* the conditions are a list, not a choice: a ring is drawn only
              once an attempt has marked it held or missed; until then the
              line is led by a dash, and the state is said in words */}
          <h3 id="challenge-conditions" className="micro-label text-iron-400">{t('platform.challenge.conditions')}</h3>
          <ul aria-labelledby="challenge-conditions" className="mt-2 flex flex-col">
            {challenge.rules.map((rule, i) => {
              const met = best ? best.met[i] : null;
              return (
                <li key={i} className="flex items-start gap-3 border-b border-[var(--gz-ink-faint)] py-2 last:border-b-0 last:pb-0">
                  {met === null ? (
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center font-ui text-[13px] leading-none text-iron-400" aria-hidden>
                      —
                    </span>
                  ) : (
                    <span
                      className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', met ? 'border-bottle-400 text-bottle-ink' : 'border-rust-400 text-rust-400')}
                      aria-hidden
                    >
                      {met ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
                    </span>
                  )}
                  <span className="font-ui text-[13px] text-paper-100">
                    {ruleText(t, rule)}
                    <span className="sr-only"> — {t(met === null ? 'platform.challenge.untried' : met ? 'platform.challenge.met' : 'platform.challenge.missed')}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 font-serif text-[12.5px] leading-snug text-iron-400">{t('platform.challenge.scoring')}</p>
        </div>

        <div className="flex flex-col justify-between gap-4 min-[900px]:col-span-3 min-[900px]:border-l min-[900px]:border-[var(--gz-ink-soft)] min-[900px]:pl-8">
          <div>
            <p className="micro-label text-iron-400">{t('platform.challenge.deadline', { days: daysLeft(challenge.week) })}</p>
            {best ? (
              <>
                <p className="mt-2 font-fraunces text-[34px] font-normal leading-none text-paper-100 tnums">{best.points}</p>
                <p className="micro-label mt-1 text-paper-300">{t(best.met.every(Boolean) ? 'platform.challenge.verdictWon' : 'platform.challenge.verdictLost', { n: best.points })}</p>
                <p className="data-text mt-1 text-iron-400">{t('platform.challenge.attempts', { n: attempts.length })}</p>
              </>
            ) : (
              <p className="mt-2 font-serif text-[13px] text-paper-300">{t('platform.challenge.none')}</p>
            )}
          </div>
          {open ? (
            <Link to={`/game/local/${open}`} className={cn('gz-ticket gz-ticket-signal self-start', FOLD)}>
              {t('platform.challenge.resume')}{'\u00a0'}→
            </Link>
          ) : (
            <button type="button" onClick={take} onMouseEnter={preloadGame} onFocus={preloadGame} className={cn('gz-ticket gz-ticket-brass self-start', FOLD)}>
              {t('platform.challenge.take')}{'\u00a0'}→
            </button>
          )}
        </div>
      </div>

      {/* the week's board, as the office keeps it */}
      <div className="border-t border-[var(--gz-ink-soft)] px-6 py-4 min-[900px]:px-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="micro-label text-paper-100">{t('platform.challenge.board.title')}</h3>
          <span className="flex items-baseline gap-4">
            {board && board.players > 0 && <span className="data-text text-iron-400 tnums">{t('platform.challenge.board.players', { n: board.players })}</span>}
            <Link to="/defis" className="font-ui text-[10.5px] font-semibold uppercase tracking-label text-brass-300 transition-colors hover:text-paper-100">
              {t('platform.defis.archive')} →
            </Link>
          </span>
        </div>
        {!session ? (
          <p className="mt-2 font-serif text-[13px] text-paper-300">{t('platform.challenge.board.signIn')}</p>
        ) : !board || board.players === 0 ? (
          <p className="mt-2 font-serif text-[13px] text-paper-300">{t('platform.challenge.board.empty')}</p>
        ) : (
          <ol className="mt-2 grid gap-x-8 gap-y-1 min-[900px]:grid-cols-2">
            {board.rows.slice(0, 6).map((row, i) => (
              <li key={row.id} className={cn('flex items-baseline gap-3 border-b border-[var(--gz-ink-faint)] py-2', row.id === session.id && 'text-brass-300')}>
                <span className="data-text w-5 text-iron-400 tnums">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate font-fraunces text-[14px] font-medium">
                  {row.name}
                  {row.id === session.id && <span className="micro-label ml-2 text-iron-400">{t('platform.challenge.board.you')}</span>}
                </span>
                <span className="data-text text-iron-400 tnums">{t('platform.challenge.board.met', { done: row.met.filter(Boolean).length, total: row.met.length })}</span>
                <span className="font-fraunces text-[15px] font-medium tnums">{row.points}</span>
              </li>
            ))}
          </ol>
        )}
        {board?.me && board.me.rank > 6 && (
          <p className="data-text mt-2 text-iron-400 tnums">{t('platform.challenge.board.mine', { rank: board.me.rank, points: board.me.points })}</p>
        )}
      </div>
    </motion.section>
  );
}
