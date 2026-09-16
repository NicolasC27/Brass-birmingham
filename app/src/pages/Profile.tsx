import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { BadgeCheck, LogOut, MailWarning } from 'lucide-react';
import PageShell, { Field, Panel, Refusal, inputClass } from '@/components/site/PageShell';
import VerifyBanner from '@/components/site/VerifyBanner';
import PlayerToken from '@/components/setup/PlayerToken';
import { PLAYER_COLORS } from '@/components/setup/constants';
import { INDUSTRIES, TOWN_BY_ID } from '@/game/data';
import type { IndustryType } from '@/game/types';
import type { Tally } from '@/game/tally';
import type { Stats } from '@/online/table';
import type { PlayerColor } from '@/components/setup/constants';
import { isOnline } from '@/online/lobby';
import { changePassword, signOut, updateProfile, useDesk, useSession, useStranger } from '@/online/session';
import { useLang, useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* The record — what the register knows of a player: the name that     */
/* does not change, the address and whether it answered, a motto, a    */
/* favourite colour, the figures, and the password.                    */
/* ------------------------------------------------------------------ */

/** what the player does at a table, per game: the six industries as
 *  bars, the rest as figures, and the towns they build in most */
function Manner({ stats, tally }: { stats: Stats; tally: Tally }) {
  const t = useT();
  const n = Math.max(1, stats.played);
  const per = (v: number) => (Math.round((v / n) * 10) / 10).toLocaleString();
  const inds = (Object.keys(INDUSTRIES) as IndustryType[]).map((k) => [k, tally.industries[k] ?? 0] as const);
  const most = Math.max(1, ...inds.map(([, v]) => v));
  const towns = Object.entries(tally.towns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  return (
    <Panel title={t('site.profile.manner')} tone="paper" meta={t('site.profile.mannerLede', { n: stats.played })}>
      <div className="grid gap-6 sm:grid-cols-[1fr_1fr]">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 content-start">
          {(
            [
              ['built', tally.built],
              ['links', tally.links],
              ['sold', tally.sold],
              ['developed', tally.developed],
              ['loans', tally.loans],
              ['flipped', tally.flipped],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-900/55">{t(`site.profile.${k}`)}</dt>
              <dd className="font-display text-[22px] font-black leading-none text-ink-900">{per(v)}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-900/55">{t('site.profile.industries')}</p>
          <ul className="mt-2 grid gap-1.5">
            {inds.map(([k, v]) => (
              <li key={k} className="grid grid-cols-[92px_1fr_28px] items-center gap-2">
                <span className="truncate font-sans text-[11.5px] text-ink-900/80">{t(`game.settings.industry.${k}`)}</span>
                <span className="h-2 rounded-sm bg-ink-900/10">
                  <span className="block h-full rounded-sm bg-brass-500" style={{ width: `${Math.round((v / most) * 100)}%` }} />
                </span>
                <span className="text-right font-mono text-[11px] text-ink-900/70">{per(v)}</span>
              </li>
            ))}
          </ul>
          {towns.length > 0 && (
            <>
              <p className="mt-4 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-900/55">{t('site.profile.towns')}</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {towns.map(([id, v]) => (
                  <li key={id} className="rounded-sm border border-ink-900/20 px-2 py-[3px] font-fell text-[11px] uppercase tracking-[0.1em] text-ink-900/80">
                    {TOWN_BY_ID[id]?.name ?? id} <span className="font-mono text-[10px] text-ink-900/55">×{v}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

/** the record against every other person met at a table */
function Rivals({ stats }: { stats: Stats }) {
  const t = useT();
  return (
    <Panel title={t('site.profile.rivals')}>
      <p className="font-sans text-[11.5px] text-cream-100/50">{t('site.profile.rivalsHint')}</p>
      {stats.rivals.length === 0 ? (
        <p className="mt-3 font-serif text-[14px] italic text-cream-100/55">{t('site.profile.rivalsNone')}</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {stats.rivals.map((r) => {
            const ahead = r.won > r.lost;
            return (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-brass-700/40 bg-coal-950/40 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-sans text-[12.5px] font-semibold text-cream-100">{r.name}</span>
                  <span className="block font-sans text-[10.5px] text-cream-100/50">{t(r.played === 1 ? 'site.profile.game' : 'site.profile.games', { n: r.played })}</span>
                </span>
                <span className={cn('shrink-0 rounded-sm border px-1.5 py-[2px] font-mono text-[10.5px] font-bold', ahead ? 'border-brass-400 text-brass-400' : r.won < r.lost ? 'border-rust-500/60 text-rust-500 brightness-150' : 'border-cream-100/25 text-cream-100/60')} title={t('site.profile.record', { won: r.won, lost: r.lost })}>
                  {r.won} – {r.lost}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export default function Profile() {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const session = useSession();
  const stranger = useStranger();
  const desk = useDesk();
  const [motto, setMotto] = useState<string | null>(null);
  const [color, setColor] = useState<PlayerColor | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOnline) navigate('/online', { replace: true });
    else if (stranger) navigate('/account', { replace: true });
  }, [stranger, navigate]);

  if (!session) return null;
  const mottoValue = motto ?? session.motto;
  const colorValue = color === undefined ? session.favoriteColor : color;
  const dirty = mottoValue !== session.motto || colorValue !== session.favoriteColor;

  const save = async () => {
    setError(null);
    try {
      await updateProfile({ motto: mottoValue, favoriteColor: colorValue });
      setMotto(null);
      setColor(undefined);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(t(`site.account.error.${(e as Error).message}`));
    }
  };
  const change = async () => {
    setError(null);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setChanged(true);
    } catch (e) {
      setError(t(`site.account.error.${(e as Error).message}`));
    }
  };
  const since = new Date(session.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const stats = desk?.stats;

  return (
    <PageShell back={{ to: '/desk', label: t('site.nav.desk') }} eyebrow={t('site.profile.eyebrow')} title={t('site.profile.title')} lede={t('site.profile.lede')}>
      <VerifyBanner />
      <Refusal text={error} />
      <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid content-start gap-6">
          <Panel tone="paper">
            <div className="flex flex-wrap items-start gap-5">
              <PlayerToken color={session.favoriteColor ?? 'brass'} size={64} />
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-900/55">{t('site.profile.name')}</p>
                <h2 className="font-display text-[34px] font-black leading-none text-ink-900">{session.name}</h2>
                {session.motto && <p className="mt-1.5 font-serif text-[16px] italic text-ink-900/75">« {session.motto} »</p>}
                <p className="mt-2 font-sans text-[11.5px] text-ink-900/55">{t('site.profile.nameNote')}</p>
                <p className="mt-3 flex flex-wrap items-center gap-2 font-sans text-[12.5px] text-ink-900/80">
                  <span className="font-mono">{session.email ?? '—'}</span>
                  <span className={cn('inline-flex items-center gap-1 rounded-sm border px-1.5 py-[1px] font-sans text-[9px] font-bold uppercase tracking-[0.14em]', session.verified ? 'border-bottle-600 text-bottle-600' : 'border-rust-500 text-rust-500')}>
                    {session.verified ? <BadgeCheck className="h-3 w-3" /> : <MailWarning className="h-3 w-3" />}
                    {session.verified ? t('site.profile.verified') : t('site.profile.unverified')}
                  </span>
                </p>
                <p className="mt-1 font-fell text-[11px] uppercase tracking-[0.16em] text-ink-900/50">{t('site.profile.memberSince', { date: since })}</p>
              </div>
            </div>
          </Panel>

          {stats?.tally && <Manner stats={stats} tally={stats.tally} />}

          <Panel title={t('site.profile.motto')}>
            <div className="grid gap-5">
              <Field id="profile-motto" label={t('site.profile.motto')} hint={t('site.profile.mottoHint')}>
                <input id="profile-motto" value={mottoValue} onChange={(e) => setMotto(e.target.value)} maxLength={80} placeholder={t('site.profile.mottoPlaceholder')} className={inputClass} />
              </Field>
              <div>
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-brass-400/80">{t('site.profile.color')}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {PLAYER_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={colorValue === c.id}
                      onClick={() => setColor(colorValue === c.id ? null : c.id)}
                      className={cn('flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 transition-colors', colorValue === c.id ? 'border-brass-400 bg-brass-500/15' : 'border-brass-700/40 hover:border-brass-500')}
                    >
                      <PlayerToken color={c.id} size={22} />
                      <span className="font-sans text-[11.5px] font-semibold text-cream-100/85">{t(`setup.colors.${c.id}`)}</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => setColor(null)} className={cn('font-sans text-[10.5px] font-bold uppercase tracking-[0.14em]', colorValue === null ? 'text-brass-400' : 'text-cream-100/45 hover:text-cream-100/80')}>
                    {t('site.profile.none')}
                  </button>
                </div>
                <p className="mt-1.5 font-sans text-[11.5px] text-cream-100/50">{t('site.profile.colorHint')}</p>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={save} disabled={!dirty} className="btn-strike disabled:cursor-not-allowed disabled:opacity-40">
                  {t('site.profile.save')}
                </button>
                {saved && <span className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-bottle-600 brightness-150">{t('site.profile.saved')}</span>}
              </div>
            </div>
          </Panel>

          <Panel title={t('site.profile.password')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="pw-current" label={t('site.profile.current')}>
                <input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className={inputClass} />
              </Field>
              <Field id="pw-next" label={t('site.profile.next')} hint={t('site.account.passwordHint')}>
                <input id="pw-next" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className={inputClass} />
              </Field>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button type="button" onClick={change} disabled={!current || next.length < 8} className="btn-ledger disabled:cursor-not-allowed disabled:opacity-40">
                {t('site.profile.change')}
              </button>
              {changed && <span className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-bottle-600 brightness-150">{t('site.profile.changed')}</span>}
            </div>
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title={t('site.profile.figures')} tone="paper">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {(
                [
                  ['played', stats?.played ?? 0],
                  ['won', stats?.won ?? 0],
                  ['rate', stats && stats.played ? `${Math.round((stats.won / stats.played) * 100)} %` : '—'],
                  ['average', stats?.averageVp ?? 0],
                  ['best', stats?.bestVp ?? 0],
                  ['place', stats?.averagePlace ? t('site.profile.placeValue', { n: stats.averagePlace }) : '—'],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-900/55">{t(k === 'place' ? 'site.profile.place' : `site.desk.stats.${k}`)}</dt>
                  <dd className="font-display text-[24px] font-black leading-none text-ink-900">{v}</dd>
                </div>
              ))}
            </dl>
            {!stats?.played && <p className="mt-3 font-serif text-[13px] italic text-ink-900/60">{t('site.profile.noFigures')}</p>}
          </Panel>
          {stats && <Rivals stats={stats} />}
          <Panel>
            <p className="font-serif text-[14px] leading-relaxed text-cream-100/65">{t('site.profile.danger')}</p>
            <button
              type="button"
              onClick={() => {
                signOut();
                navigate('/');
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-brass-700/60 px-3 py-2 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-cream-100/70 transition-colors hover:border-rust-500 hover:text-rust-500"
            >
              <LogOut className="h-3.5 w-3.5" /> {t('site.profile.signOut')}
            </button>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
