import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { personaName } from '@/game/data';
import { listHomeGames } from '@/game/home';
import { attemptsOf, challengeOf, openAttemptOf, startChallenge, type Attempt, type Challenge } from '@/game/challenge';
import { weekOf } from '@/platform/almanac';
import { lobby } from '@/online/lobby';
import { useChallengeBoard, useSession, useStranger } from '@/online/session';
import { preloadGame } from '@/platform/preload';
import PageShell from '@/components/site/PageShell';

/* ------------------------------------------------------------------ */
/* /defis — the notices of the past weeks, each with the week's board  */
/* as the office keeps it and the reader's own best attempt: where one */
/* came close, and where the others stood.                             */
/*                                                                     */
/* The column heads are set once, under the double rule, and a week    */
/* nobody sat at folds to a single line: twelve times the same empty   */
/* state was a page of nothing. The visitor is told once, above the    */
/* list, where the boards are read — and the boards are not offered.   */
/* ------------------------------------------------------------------ */

const WEEKS = 12;

/** the three columns of a week, shared by the heads and the lines */
const COLS = { story: 'min-[900px]:col-span-5', mine: 'min-[900px]:col-span-3', board: 'min-[900px]:col-span-4' } as const;

/* an empty cell of a quiet week. Under the column heads a ledger prints a
   dash, not the same sentence eleven times over; the sentence stays for the
   reader's voice, and below 900 px, where the heads are not printed. */
function Blank({ text, className }: { text: string; className: string }) {
  return (
    <p className={cn('font-serif text-[13px] italic text-paper-300', className)}>
      <span className="min-[900px]:sr-only">{text}</span>
      <span className="hidden font-ui not-italic text-iron-400 min-[900px]:inline" aria-hidden>
        —
      </span>
    </p>
  );
}

function WeekBoard({ board, me }: { board: ReturnType<typeof useChallengeBoard>; me: string }) {
  const t = useT();
  if (!board) return <p className="font-serif text-[13px] italic text-iron-400">{t('platform.ranking.loading')}</p>;
  if (board.players === 0) return <p className="font-serif text-[13px] italic text-paper-300">{t('platform.defis.noBoard')}</p>;
  return (
    <ol className="flex flex-col">
      {board.rows.slice(0, 3).map((row, i) => (
        <li key={row.id} className={cn('flex items-baseline gap-3 border-b border-[var(--gz-ink-faint)] py-1 last:border-b-0', row.id === me && 'text-brass-300')}>
          <span className="data-text w-4 text-iron-400 tnums">{i + 1}.</span>
          <span className="min-w-0 flex-1 truncate font-fraunces text-[14px] font-medium">{row.name}</span>
          <span className="font-fraunces text-[15px] font-medium tnums">{row.points}</span>
        </li>
      ))}
      {board.me && board.me.rank > 3 && <li className="data-text pt-1 text-iron-400 tnums">{t('platform.challenge.board.mine', { rank: board.me.rank, points: board.me.points })}</li>}
    </ol>
  );
}

/** the running notice's ticket: sit at it, or go back to the table left open */
function TakeTicket({ challenge }: { challenge: Challenge }) {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const [open] = useState(() => openAttemptOf(challenge.week, listHomeGames()));
  const [busy, setBusy] = useState(false);
  if (open) {
    return (
      <Link to={`/game/local/${open}`} className="gz-ticket gz-ticket-sm gz-ticket-signal mt-3">
        {t('platform.challenge.resume')} →
      </Link>
    );
  }
  const take = () => {
    if (busy) return;
    setBusy(true);
    const me = session?.name ?? lobby.me.name.trim() ?? '';
    startChallenge(challenge, me || t('setup.defaults.playerOne'))
      .then((code) => navigate(`/game/local/${code}`))
      .catch(() => setBusy(false));
  };
  return (
    <button type="button" onClick={take} onMouseEnter={preloadGame} onFocus={preloadGame} disabled={busy} className={cn('gz-ticket gz-ticket-sm gz-ticket-brass mt-3', busy && 'is-off')}>
      {t('platform.defis.open')} →
    </button>
  );
}

function Week({ week, current, signedIn, me }: { week: number; current: boolean; signedIn: boolean; me: string }) {
  const t = useT();
  const c = challengeOf(week);
  const [best] = useState<Attempt | null>(() => attemptsOf(week)[0] ?? null);
  const board = useChallengeBoard(week);
  const title = t(`platform.challenge.titles.${c.id}`);
  const rivals = t('platform.challenge.rivals', { names: c.rivals.map(personaName).join(', ') });

  /* a past week with no attempt of mine and no board to read: one line. A
     board still on its way counts as empty — most are, and a line that
     opens when names arrive jumps less than eleven that close */
  const quiet = !current && !best && (!signedIn || board === null || board.players === 0);
  if (quiet) {
    return (
      <li className="grid items-baseline gap-x-6 gap-y-1 border-b border-[var(--gz-ink-faint)] py-3 min-[900px]:grid-cols-12">
        <div className={cn('flex min-w-0 items-baseline gap-4', COLS.story)}>
          <p className="micro-label w-[92px] shrink-0 text-iron-400">{t('platform.defis.week', { n: c.number })}</p>
          <h2 className="min-w-0 truncate font-fraunces text-[17px] font-medium leading-tight text-paper-100">{title}</h2>
        </div>
        <Blank text={t('platform.defis.none')} className={COLS.mine} />
        {signedIn && <Blank text={t('platform.defis.noBoard')} className={COLS.board} />}
      </li>
    );
  }

  return (
    <li className={cn('grid gap-6 border-b border-[var(--gz-ink-faint)] py-6 min-[900px]:grid-cols-12', current && 'relative before:absolute before:-left-4 before:inset-y-5 before:w-[3px] before:bg-[var(--gz-ink)] [html[data-theme=dark]_&]:bg-brass-500/[.05]')} aria-current={current ? 'date' : undefined}>
      <div className={COLS.story}>
        <p className="micro-label text-iron-400">
          {t('platform.defis.week', { n: c.number })}
          {current && (
            <span className="ml-2 text-paper-100">
              <span className="mr-1.5 text-brass-300" aria-hidden>◆</span>
              {t('platform.defis.current')}
            </span>
          )}
        </p>
        <h2 className="mt-1 font-fraunces text-[22px] font-medium leading-tight text-paper-100">{title}</h2>
        <p className="mt-2 font-serif text-[13px] italic leading-relaxed text-paper-300">{t(`platform.challenge.stories.${c.id}`)}</p>
        {/* the machines' names are names, not figures: the ledger's mono is kept for what counts */}
        <p className="mt-2 font-ui text-[12.5px] text-iron-400">{rivals}</p>
      </div>
      <div className={COLS.mine}>
        <p className="micro-label text-paper-100 min-[900px]:sr-only">{t('platform.defis.mine')}</p>
        {best ? (
          <>
            <p className="mt-1 font-fraunces text-[30px] font-normal leading-none text-paper-100 tnums min-[900px]:mt-0">{best.points}</p>
            <p className="data-text mt-1 text-iron-400 tnums">
              {t('platform.challenge.board.met', { done: best.met.filter(Boolean).length, total: best.met.length })} · {best.vp} PV
            </p>
          </>
        ) : (
          <p className="mt-1 font-serif text-[13px] italic text-paper-300 min-[900px]:mt-0">{t('platform.defis.none')}</p>
        )}
        {current && <TakeTicket challenge={c} />}
      </div>
      {signedIn && (
        <div className={COLS.board}>
          <p className="micro-label mb-1 text-paper-100 min-[900px]:sr-only">{t('platform.challenge.board.title')}</p>
          <WeekBoard board={board} me={me} />
        </div>
      )}
    </li>
  );
}

export default function Defis() {
  const t = useT();
  const session = useSession();
  const stranger = useStranger();
  const [now] = useState(weekOf);
  const weeks = Array.from({ length: Math.min(WEEKS, now + 1) }, (_, i) => now - i);
  const signedIn = session !== null;
  return (
    <PageShell back={{ to: '/', label: t('platform.account.back') }} eyebrow={t('platform.defis.eyebrow')} title={t('platform.defis.title')} lede={t('platform.defis.lede')}>
      {stranger && (
        <div role="status" className="console mb-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
          <p className="min-w-0 flex-1 font-serif text-[14px] italic leading-relaxed text-paper-300">{t('platform.challenge.board.signIn')}</p>
          <Link to="/account" className="gz-ticket gz-ticket-sm">
            {t('platform.action.signIn')} →
          </Link>
        </div>
      )}
      <div className="gz-rule-double" aria-hidden />
      {/* the column heads, printed once over the whole list */}
      <div className="hidden gap-6 border-b border-[var(--gz-ink-soft)] py-2.5 min-[900px]:grid min-[900px]:grid-cols-12" aria-hidden>
        <p className={cn('micro-label text-iron-400', COLS.story)}>{t('platform.defis.colNotice')}</p>
        <p className={cn('micro-label text-iron-400', COLS.mine)}>{t('platform.defis.mine')}</p>
        {signedIn && <p className={cn('micro-label text-iron-400', COLS.board)}>{t('platform.challenge.board.title')}</p>}
      </div>
      <ol className="flex flex-col">
        {weeks.map((week) => (
          <Week key={week} week={week} current={week === now} signedIn={signedIn} me={session?.id ?? ''} />
        ))}
      </ol>
    </PageShell>
  );
}
