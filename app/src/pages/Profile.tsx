import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck, Check, Coins, Download, LogOut, MailWarning, UserX } from 'lucide-react';
import { Field, Panel, Refusal, inputClass } from '@/components/site/PageShell';
import VerifyBanner from '@/components/site/VerifyBanner';
import Button from '@/components/platform/Button';
import RankBadge, { type RankTier } from '@/components/platform/RankBadge';
import StatTile from '@/components/platform/StatTile';
import MemberPlate, { PlateLine } from '@/components/desk/MemberPlate';
import RankEmblem from '@/components/platform/RankEmblem';
import PlayerToken from '@/components/setup/PlayerToken';
import { PLAYER_COLORS } from '@/components/setup/constants';
import type { PlayerColor } from '@/components/setup/constants';
import { INDUSTRIES, TOWN_BY_ID } from '@/game/data';
import type { IndustryType } from '@/game/types';
import { isOnline } from '@/online/lobby';
import type { Rating, Stats } from '@/online/table';
import { PLACEMENTS, rankOf } from '@/platform/rank';
import { useWallet } from '@/platform/wallet';
import { changePassword, closeAccount, exportData, signOut, updateProfile, useDesk, useSession, useStranger } from '@/online/session';
import { HistoryLedger } from '@/pages/Desk';
import { localeOf, useLang, useT } from '@/i18n';
import { memberSince } from '@/components/site/memberSince';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Carte de membre & réglages (profile.md) — l'en-tête registre       */
/* (avatar, pseudo, la cote de l'exercice lue par rankOf), les         */
/* statistiques publiques, l'échelle des rangs, la fiche (la cote sur  */
/* l'exercice, la manière de jouer, les industries, le face à face),   */
/* l'historique, puis les réglages : identité (devise, couleur) et     */
/* compte & sécurité (mot de passe via session.ts, déconnexion).       */
/* ------------------------------------------------------------------ */

const ease = 'easeOut' as const;
/** les cinq rangs de l'office, du bas vers le haut, dans les métaux du badge */
const TIERS: RankTier[] = ['bronze', 'fer', 'acier', 'laiton', 'or'];
const locale = localeOf;

/* --------------------------- En-tête de membre --------------------------- */

function MemberCard() {
  const t = useT();
  const lang = useLang();
  const session = useSession();
  const desk = useDesk();
  const wallet = useWallet();
  if (!session) return null;
  const since = memberSince(session.createdAt, lang);
  const rank = rankOf(desk?.rating);
  const season = desk?.season.name ?? '';

  return (
    <MemberPlate
      eyebrow={t('platform.profile.eyebrow')}
      name={session.name}
      presence={<span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-bottle-400 ring-2 ring-enamel-850" title={t('platform.desk.friends.presenceOnline')} />}
      aside={
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.26, ease, delay: 0.1 }} className="flex shrink-0 items-center gap-4 rounded-xl border border-brass-hairline bg-enamel-800 px-5 py-4">
          <RankBadge tier={rank.tier} division={rank.division} size={48} compact />
          <div>
            {rank.tier === 'placement' ? (
              <>
                <p className="font-fraunces text-[24px] font-semibold leading-none text-paper-100 tnums">{rank.rating !== null ? rank.rating.toLocaleString(locale(lang)) : '—'}</p>
                <p className="data-text mt-1.5 tabular-nums text-iron-400">
                  {rank.rating !== null ? t('platform.profile.placements', { done: rank.placementDone ?? 0, total: PLACEMENTS, season }) : t('platform.profile.unranked', { season })}
                </p>
              </>
            ) : (
              <>
                <p className="font-fraunces text-[24px] font-semibold leading-none text-paper-100">
                  {t(`platform.rank.${rank.tier}`)}
                  {rank.division ? ` ${rank.division}` : ''}
                </p>
                <p className="data-text mt-1.5 tabular-nums text-iron-400">{t('platform.profile.season', { lp: rank.lp ?? 0, season })}</p>
                <p className="data-text mt-1 tabular-nums text-brass-300">{t('platform.profile.cote', { rating: (rank.rating ?? 0).toLocaleString(locale(lang)) })}</p>
              </>
            )}
          </div>
        </motion.div>
      }
    >
      <PlateLine>
        {wallet.equipped.title !== 'title-none' && <span className="font-semibold text-brass-300">{t(`platform.comptoir.items.${wallet.equipped.title}`)} · </span>}
        {t('platform.profile.memberSince', { date: since })}
      </PlateLine>
      {session.motto && <p className="mt-2.5 font-ui text-[14px] text-paper-300">{`«\u00A0${session.motto}\u00A0»`}</p>}
    </MemberPlate>
  );
}

/* --------------------- Statistiques & échelle des rangs --------------------- */

function StatsAndRanks() {
  const t = useT();
  const lang = useLang();
  const desk = useDesk();
  const wallet = useWallet();
  const stats = desk?.stats;
  const rank = rankOf(desk?.rating);
  const rate = stats && stats.played ? `${Math.round((stats.won / stats.played) * 100)} %` : '—';
  const tiles: { value: string | number; label: string }[] = [
    { value: stats?.played ?? 0, label: t('platform.profile.stats.played') },
    { value: stats?.won ?? 0, label: t('platform.profile.stats.won') },
    { value: rate, label: t('platform.profile.stats.rate') },
    { value: stats?.averageVp ?? 0, label: t('platform.profile.stats.average') },
    { value: stats?.bestVp ?? 0, label: t('platform.profile.stats.best') },
    { value: stats?.averagePlace ? stats.averagePlace : '—', label: t('platform.profile.stats.place') },
  ];
  const rise = (i: number) => ({ initial: { opacity: 0, y: 12 }, whileInView: { opacity: 1, y: 0 }, viewport: { amount: 0.15, once: true }, transition: { duration: 0.22, ease, delay: i * 0.05 } });

  /* Eight figures, one grammar: the figure over its label, flush left, at
     the tile's one size. The rating and the purse keep their emblem, hung in
     the tile's corner out of the line of reading. The rating spans two cells
     where the grid runs three wide, so the eight fill three full rows (two
     wide: four); and the rows share out the height of the ladder beside
     them rather than stopping short of it — each tile spreads, the figure
     at its head and the label at its foot. One gutter across the row. */
  return (
    <div className="mt-6 grid gap-6 min-[1100px]:grid-cols-12">
      <div className="grid gap-6 min-[760px]:grid-cols-2 min-[1100px]:col-span-8 xl:grid-cols-3">
        {tiles.map((tile, i) => (
          <motion.div key={tile.label} {...rise(i)}>
            <StatTile value={tile.value} label={tile.label} spread className="h-full" />
          </motion.div>
        ))}
        <motion.div {...rise(tiles.length)} className="xl:col-span-2">
          <StatTile
            value={rank.rating !== null ? rank.rating.toLocaleString(locale(lang)) : '—'}
            label={t('platform.desk.rating.cote')}
            badge={<RankBadge tier={rank.tier} division={rank.division} size={28} compact />}
            spread
            className="h-full"
          />
        </motion.div>
        <motion.div {...rise(tiles.length + 1)}>
          <Link to="/comptoir" aria-label={t('platform.comptoir.walletAria', { count: wallet.balance })} className="group block h-full">
            <StatTile
              value={wallet.balance}
              label={t('platform.comptoir.deskTile')}
              icon={<Coins size={24} />}
              spread
              className="h-full transition-colors duration-150 group-hover:border-brass-hairline-strong group-hover:bg-enamel-800"
            />
          </Link>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ amount: 0.15, once: true }} transition={{ duration: 0.24, ease, delay: 0.08 }} className="min-[1100px]:col-span-4">
        <Panel title={t('platform.profile.ranksTitle')} className="h-full">
          <ul className="grid gap-1.5">
            {[...TIERS].reverse().map((tier) => {
              const current = tier === rank.tier;
              return (
                <li key={tier} className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', current ? 'border-brass-hairline-strong bg-enamel-800' : 'border-transparent')}>
                  <RankEmblem tier={tier} />
                  <span className={cn('font-ui text-[13px] font-semibold', current ? 'text-paper-100' : 'text-iron-400')}>{t(`platform.rank.${tier}`)}</span>
                  <span className="data-text ml-auto tabular-nums text-iron-400">{t(`platform.ranking.ladder.floor.${tier}`)}</span>
                  {current && rank.lp !== undefined && <span className="data-text text-brass-300">{t('platform.rank.lp', { lp: rank.lp })}</span>}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 border-t border-[rgb(var(--paper-100)/.07)] pt-3 font-ui text-[12.5px] leading-snug text-iron-400">{t('platform.profile.ranksFoot')}</p>
        </Panel>
      </motion.div>
    </div>
  );
}

/* ------------------------------- La fiche ------------------------------- */

/* A panel with nothing yet to show says so in the voice the history uses
   below it — the register's italic, the same air, the same ink — so four
   waiting lines on one page read as one clerk and not two. */
function Waiting({ children }: { children: React.ReactNode }) {
  return <p className="px-6 py-8 text-center font-serif text-[13.5px] italic text-paper-300">{children}</p>;
}

/** La cote sur l'exercice : la ligne, la zone sous elle, trois repères. */
function TrendChart({ values }: { values: number[] }) {
  const t = useT();
  if (values.length < 2) return <Waiting>{t('platform.profile.trend.none')}</Waiting>;
  const lo = Math.min(...values, 1200) - 40;
  const hi = Math.max(...values, 1200) + 40;
  const x = (i: number) => 44 + (i / (values.length - 1)) * 548;
  const y = (v: number) => 136 - ((v - lo) / (hi - lo)) * 116;
  const ticks = Array.from(new Set([lo + 40, (lo + hi) / 2, hi - 40].map((v) => Math.round(v / 50) * 50)));
  const pts = values.map((v, i) => `${x(i)},${y(v)}`);
  const last = values.length - 1;
  return (
    <svg viewBox="0 0 600 160" role="img" aria-label={`${values[0]} → ${values[last]}`} className="mt-1 h-auto w-full">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={44} x2={600} y1={y(v)} y2={y(v)} strokeWidth={1} className="stroke-current text-paper-100 opacity-10" />
          <text x={0} y={y(v) + 4} fontSize={11} className="fill-current font-mono text-iron-400">
            {v}
          </text>
        </g>
      ))}
      <path d={`M${pts.join(' L')} L${x(last)} 156 L44 156 Z`} className="fill-current text-brass-300 opacity-10" />
      <polyline points={pts.join(' ')} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="fill-none stroke-current text-brass-300" />
      <circle cx={x(last)} cy={y(values[last])} r={4} className="fill-current text-brass-300" />
    </svg>
  );
}

function TrendPanel({ rating, className }: { rating: Rating | null; className?: string }) {
  const t = useT();
  const lang = useLang();
  const prev = rating && rating.trend.length > 1 ? rating.trend[rating.trend.length - 2] : null;
  const delta = rating && prev !== null ? rating.rating - prev : 0;
  const meta = rating ? (
    <>
      {t('platform.profile.cote', { rating: rating.rating.toLocaleString(locale(lang)) })}
      {delta !== 0 && (
        <span className={cn('ml-2', delta > 0 ? 'text-bottle-ink' : 'text-rust-400')}>
          {delta > 0 ? `+${delta}` : delta} · {t('platform.profile.trend.lastGame')}
        </span>
      )}
    </>
  ) : undefined;
  return (
    <Panel title={t('platform.profile.trend.title')} meta={meta} className={className}>
      <TrendChart values={rating?.trend ?? []} />
    </Panel>
  );
}

/** ce que je fais à une table, en moyenne : les sommes divisées par les parties comptées */
function perGame(stats: Stats, lang: string) {
  const n = Math.max(1, stats.tallied || stats.played);
  return (v: number) => (Math.round((v / n) * 10) / 10).toLocaleString(locale(lang));
}

function MannerPanel({ stats, className }: { stats: Stats; className?: string }) {
  const t = useT();
  const lang = useLang();
  const tally = stats.tally;
  const per = perGame(stats, lang);
  const figures: { key: string; value: number }[] = tally
    ? [
        { key: 'built', value: tally.built },
        { key: 'links', value: tally.links },
        { key: 'sold', value: tally.sold },
        { key: 'developed', value: tally.developed },
        { key: 'loans', value: tally.loans },
        { key: 'flipped', value: tally.flipped },
      ]
    : [];
  return (
    <Panel title={t('platform.profile.manner.title')} meta={tally ? t('platform.profile.manner.perGame', { n: stats.tallied || stats.played }) : undefined} className={className}>
      {tally ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          {figures.map((f) => (
            <div key={f.key}>
              <span className="tnums block font-fraunces text-[24px] font-semibold leading-none text-paper-100">{per(f.value)}</span>
              <span className="micro-label mt-1.5 block text-iron-400">{t(`platform.profile.manner.${f.key}`)}</span>
            </div>
          ))}
        </div>
      ) : (
        <Waiting>{t('platform.profile.manner.none')}</Waiting>
      )}
    </Panel>
  );
}

function IndustriesPanel({ stats, className }: { stats: Stats; className?: string }) {
  const t = useT();
  const lang = useLang();
  /* the shell asks framer for the reader's own setting, but a width is neither
     a transform nor a layout: it fills on regardless, so the bar is told here */
  const reduced = useReducedMotion();
  const tally = stats.tally;
  if (!tally) {
    return (
      <Panel title={t('platform.profile.industries.title')} className={className}>
        <Waiting>{t('platform.profile.industries.none')}</Waiting>
      </Panel>
    );
  }
  const per = perGame(stats, lang);
  const inds = (Object.keys(INDUSTRIES) as IndustryType[]).map((k) => [k, tally.industries[k] ?? 0] as const);
  const most = Math.max(1, ...inds.map(([, v]) => v));
  const towns = Object.entries(tally.towns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  return (
    <Panel title={t('platform.profile.industries.title')} meta={t('platform.profile.industries.perGame')} className={className}>
      <ul className="grid gap-2.5">
        {inds.map(([k, v]) => (
          <li key={k} className="grid grid-cols-[minmax(0,7.5rem)_1fr_2.75rem] items-center gap-3">
            <span className="truncate font-ui text-[12.5px] text-paper-300">{t(`game.settings.industry.${k}`)}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-enamel-700">
              <motion.span initial={reduced ? false : { width: 0 }} whileInView={{ width: `${Math.round((v / most) * 100)}%` }} viewport={{ once: true }} transition={{ duration: 0.45, ease }} className="block h-full rounded-full bg-brass-500" />
            </span>
            <span className="data-text text-right tabular-nums text-paper-100">{per(v)}</span>
          </li>
        ))}
      </ul>
      {towns.length > 0 && (
        <>
          <p className="micro-label mt-5 text-iron-400">{t('platform.profile.industries.towns')}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {towns.map(([id, v]) => (
              <li key={id} className="rounded-full border border-brass-hairline bg-enamel-800 px-2.5 py-1 font-ui text-[12.5px] font-semibold text-paper-100">
                {TOWN_BY_ID[id]?.name ?? id} <span className="data-text font-normal text-iron-400">×{v}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function RivalsPanel({ stats, className }: { stats: Stats; className?: string }) {
  const t = useT();
  return (
    <Panel title={t('platform.profile.rivals.title')} className={className}>
      {stats.rivals.length === 0 ? (
        <Waiting>{t('platform.profile.rivals.none')}</Waiting>
      ) : (
        <ul className="grid gap-1.5">
          {stats.rivals.slice(0, 8).map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-lg border border-brass-hairline bg-enamel-800 px-3 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brass-hairline bg-enamel-700 font-ui text-[12.5px] font-semibold text-paper-100" aria-hidden>
                {r.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-ui text-[13px] font-semibold text-paper-100">{r.name}</span>
                <span className="data-text text-iron-400">{r.played === 1 ? t('platform.profile.rivals.games.one') : t('platform.profile.rivals.games.many', { n: r.played })}</span>
              </span>
              <span className={cn('data-text font-semibold tabular-nums', r.won > r.lost ? 'text-bottle-ink' : r.won < r.lost ? 'text-rust-400' : 'text-paper-300')}>
                {r.won} – {r.lost}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function RecordSection() {
  const desk = useDesk();
  const stats = desk?.stats ?? null;
  /* One grid for the four panels, not two columns stacked on their own: a
     row holds two panels and their feet meet, whatever each has to say. The
     cut is the page's 8/4, the one the figures and the ladder take above.
     Every panel stands, empty or not — a panel that vanished when it had
     nothing to show left its column 200 px short of the other. Under the
     wide cut the four go two by two, halves, rather than four full-width
     panels stacked down the page. */
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ amount: 0.1, once: true }} transition={{ duration: 0.24, ease }} className="mt-6 grid gap-6 min-[900px]:grid-cols-2 min-[1100px]:grid-cols-12">
      <TrendPanel rating={desk?.rating ?? null} className="min-[1100px]:col-span-8" />
      {stats && <RivalsPanel stats={stats} className="min-[1100px]:col-span-4" />}
      {stats && <MannerPanel stats={stats} className="min-[1100px]:col-span-8" />}
      {stats && <IndustriesPanel stats={stats} className="min-[1100px]:col-span-4" />}
    </motion.div>
  );
}

/* ------------------------------ Réglages : identité ------------------------------ */

/** a command set in words: a link's underline, never a label's capitals */
const textCommand = 'font-ui text-[13px] text-brass-300 underline decoration-brass-500/40 underline-offset-2 transition-colors duration-150 hover:text-paper-100 hover:decoration-current';

/* The favourite colour is one choice out of five — four seats and no
   preference — so it is a radio group: one plate each, the same size, the
   chosen one ringed in brass and ticked, so the choice does not rest on a
   hue alone. The arrows walk the group, as they do in any set of radios. */
function ColorChoice({ value, onChange }: { value: PlayerColor | null; onChange: (c: PlayerColor | null) => void }) {
  const t = useT();
  const options: (PlayerColor | null)[] = [...PLAYER_COLORS.map((c) => c.id), null];
  const current = Math.max(0, options.indexOf(value));
  const walk = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (current + step + options.length) % options.length;
    onChange(options[next]);
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-labelledby="profile-color" onKeyDown={walk} className="mt-2 flex flex-wrap items-center gap-2.5">
      {options.map((c, i) => {
        const on = i === current && value === c;
        return (
          <button
            key={c ?? 'none'}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === current ? 0 : -1}
            onClick={() => onChange(c)}
            className={cn(
              'flex h-8 items-center gap-2 rounded-full border py-1 pl-1 pr-3 transition-colors duration-150',
              on ? 'border-brass-500 bg-brass-500/10' : 'border-[rgb(var(--paper-100)/.14)] hover:border-brass-hairline-strong',
            )}
          >
            {c ? (
              <PlayerToken color={c} size={22} />
            ) : (
              <span aria-hidden className="h-[22px] w-[22px] rounded-full border border-dashed border-iron-400" />
            )}
            <span className="font-ui text-[12.5px] font-semibold text-paper-100">{c ? t(`setup.colors.${c}`) : t('platform.profile.settings.none')}</span>
            {on && <Check size={14} aria-hidden className="-mr-1 text-brass-300" />}
          </button>
        );
      })}
    </div>
  );
}

function IdentitySettings() {
  const t = useT();
  const session = useSession();
  const [motto, setMotto] = useState<string | null>(null);
  const [color, setColor] = useState<PlayerColor | null | undefined>(undefined);
  const [portrait, setPortrait] = useState<string | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!session) return null;

  const mottoValue = motto ?? session.motto;
  const colorValue = color === undefined ? session.favoriteColor : color;
  const portraitValue = portrait === undefined ? session.portrait : portrait;
  const dirty = mottoValue !== session.motto || colorValue !== session.favoriteColor || portraitValue !== session.portrait;

  /* the picture is cut square and shrunk here, before it travels: 160 px
     of WebP, a few thousand characters, whatever the file was */
  const pick = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const S = 160;
      const c = document.createElement('canvas');
      c.width = S;
      c.height = S;
      const g = c.getContext('2d');
      if (g) {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, S, S);
        const webp = c.toDataURL('image/webp', 0.82);
        setPortrait(webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.82));
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const save = async () => {
    setError(null);
    try {
      await updateProfile({ motto: mottoValue, favoriteColor: colorValue, ...(portraitValue !== session.portrait ? { portrait: portraitValue } : {}) });
      setMotto(null);
      setColor(undefined);
      setPortrait(undefined);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(t(`site.account.error.${(e as Error).message}`));
    }
  };

  return (
    <Panel title={t('platform.profile.settings.identity')}>
      <div className="grid gap-5">
        <div>
          <p className="micro-label text-brass-300">{t('platform.profile.settings.portrait')}</p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-brass-hairline-strong bg-enamel-700 font-ui text-[24px] font-semibold text-paper-100">
              {portraitValue ? <img src={portraitValue} alt="" draggable={false} className="h-full w-full object-cover" /> : session.name.charAt(0).toUpperCase()}
            </span>
            <label className="gz-ticket gz-ticket-sm cursor-pointer">
              {t('platform.profile.settings.portraitPick')}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
            </label>
            {portraitValue && (
              <button type="button" onClick={() => setPortrait(null)} className={textCommand}>
                {t('platform.profile.settings.portraitRemove')}
              </button>
            )}
          </div>
          <p className="mt-1.5 font-ui text-[12px] leading-snug text-iron-400">{t('platform.profile.settings.portraitHint')}</p>
        </div>
        <Field id="profile-motto" label={t('platform.profile.settings.motto')} hint={t('platform.profile.settings.mottoHint')}>
          <input id="profile-motto" value={mottoValue} onChange={(e) => setMotto(e.target.value)} maxLength={80} placeholder={t('platform.profile.settings.mottoPlaceholder')} className={inputClass} />
        </Field>
        <div>
          <p id="profile-color" className="micro-label text-brass-300">
            {t('platform.profile.settings.color')}
          </p>
          <ColorChoice value={colorValue} onChange={setColor} />
          <p className="mt-1.5 font-ui text-[12px] leading-snug text-iron-400">{t('platform.profile.settings.colorHint')}</p>
        </div>
        <Refusal text={error} />
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={save} disabled={!dirty}>
            {t('platform.profile.settings.save')}
          </Button>
          {saved && <span className="micro-label text-bottle-ink">{t('platform.profile.settings.saved')}</span>}
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------ Réglages : la poste ------------------------------ */

function PostSettings() {
  const t = useT();
  const session = useSession();
  const [busy, setBusy] = useState(false);
  if (!session) return null;
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await updateProfile({ newsletter: !session.newsletter });
    } catch {
      /* the office refused: the switch stays as it was */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title={t('platform.profile.settings.post')}>
      <p className="font-ui text-[13px] leading-relaxed text-paper-300">{t('platform.profile.settings.postCopy')}</p>
      <label className="mt-4 flex cursor-pointer items-center gap-3">
        <input type="checkbox" checked={session.newsletter} onChange={() => void toggle()} disabled={busy || !session.verified} className="h-4 w-4 accent-[rgb(var(--brass-plate))]" />
        <span className="font-ui text-[13px] text-paper-100">{t('platform.profile.settings.postOn')}</span>
      </label>
      {!session.verified && <p className="mt-2 font-ui text-[12.5px] text-iron-400">{t('platform.profile.settings.postVerify')}</p>}
    </Panel>
  );
}

/* --------------------------- Réglages : compte & sécurité --------------------------- */

function SecuritySettings() {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!session) return null;

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

  return (
    <Panel title={t('platform.profile.settings.security')}>
      <div className="grid gap-5">
        <div>
          <p className="micro-label text-brass-300">{t('platform.profile.settings.email')}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <span className="data-text text-paper-100">{session.email ?? '—'}</span>
            <span className={cn('micro-label inline-flex items-center gap-1 rounded px-1.5 py-0.5', session.verified ? 'bg-bottle-700/60 text-paper-100' : 'bg-rust-700/50 text-paper-100')}>
              {session.verified ? <BadgeCheck size={12} aria-hidden /> : <MailWarning size={12} aria-hidden />}
              {session.verified ? t('platform.profile.settings.verified') : t('platform.profile.settings.unverified')}
            </span>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pw-current" label={t('platform.profile.settings.current')}>
            <input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className={inputClass} />
          </Field>
          <Field id="pw-next" label={t('platform.profile.settings.next')} hint={t('platform.profile.settings.passwordHint')}>
            <input id="pw-next" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className={inputClass} />
          </Field>
        </div>
        <Refusal text={error} />
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={change} disabled={!current || next.length < 8}>
            {t('platform.profile.settings.change')}
          </Button>
          {changed && <span className="micro-label text-bottle-ink">{t('platform.profile.settings.changed')}</span>}
        </div>

        <div className="border-t border-[rgb(var(--paper-100)/.07)] pt-5">
          <p className="font-ui text-[13px] leading-relaxed text-paper-300">{t('platform.profile.settings.signOutCopy')}</p>
          <Button
            variant="danger-ghost"
            className="mt-3"
            icon={<LogOut size={16} aria-hidden />}
            onClick={() => {
              signOut();
              navigate('/');
            }}
          >
            {t('platform.profile.settings.signOut')}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

/* -------------------------------- Your data -------------------------------- */

/** what the register holds, to take away; and the account closed for good */
function DataSettings() {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const [taken, setTaken] = useState(false);
  const [closing, setClosing] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!session) return null;

  const take = async () => {
    setError(null);
    setBusy(true);
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `blackrail-${session.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setTaken(true);
    } catch (e) {
      setError(t(`site.account.error.${(e as Error).message}`));
    } finally {
      setBusy(false);
    }
  };
  const close = async () => {
    setError(null);
    setBusy(true);
    try {
      await closeAccount(password);
      navigate('/', { replace: true });
    } catch (e) {
      setError(t(`site.account.error.${(e as Error).message}`));
      setBusy(false);
    }
  };

  return (
    <Panel title={t('platform.profile.settings.data')}>
      <div className="grid gap-5">
        <div>
          <p className="font-ui text-[13px] leading-relaxed text-paper-300">{t('platform.profile.settings.exportCopy')}</p>
          <div className="mt-3 flex items-center gap-3">
            <Button variant="ghost" icon={<Download size={16} aria-hidden />} onClick={take} disabled={busy}>
              {t('platform.profile.settings.export')}
            </Button>
            {taken && <span className="micro-label text-bottle-ink">{t('platform.profile.settings.exported')}</span>}
          </div>
        </div>
        <div className="border-t border-[rgb(var(--paper-100)/.07)] pt-5">
          <p className="font-ui text-[13px] leading-relaxed text-paper-300">{t('platform.profile.settings.closeCopy')}</p>
          {closing ? (
            <div className="mt-3 grid gap-3 sm:max-w-sm">
              <Field id="close-password" label={t('platform.profile.settings.closePassword')}>
                <input id="close-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={inputClass} />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="danger-ghost" icon={<UserX size={16} aria-hidden />} onClick={close} disabled={busy || password.length < 8}>
                  {t('platform.profile.settings.closeConfirm')}
                </Button>
                <Button variant="ghost" onClick={() => setClosing(false)} disabled={busy}>
                  {t('platform.profile.settings.keep')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger-ghost" className="mt-3" icon={<UserX size={16} aria-hidden />} onClick={() => setClosing(true)}>
              {t('platform.profile.settings.close')}
            </Button>
          )}
        </div>
        <Refusal text={error} />
      </div>
    </Panel>
  );
}

/* ----------------------------------- Page ----------------------------------- */

export default function Profile() {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const stranger = useStranger();
  const desk = useDesk();

  useEffect(() => {
    if (!isOnline) navigate('/online', { replace: true });
    else if (stranger) navigate('/account', { replace: true, state: { from: '/profile' } });
  }, [stranger, navigate]);

  if (!session) return null;

  return (
    <div className="gz-measure pb-24 pt-10">
      <MemberCard />
      <div className="mt-4">
        <VerifyBanner />
      </div>
      <StatsAndRanks />
      <RecordSection />

      {/* a section title takes 48 px of air above it and 16 below: the
          figures and panels over it are one block, the history another */}
      <section className="mt-12">
        <h2 className="h2-section mb-4">{t('platform.profile.historyTitle')}</h2>
        <HistoryLedger history={desk?.history ?? []} me={session.id} flush />
      </section>

      {/* two stacks, not a grid of four: each card keeps its own height, and
          the member's own things (the face, the post) stand on the left, the
          account's (the keys, the papers) on the right, so no card is
          stretched and no row leaves a hole under its shorter half */}
      <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ amount: 0.15, once: true }} transition={{ duration: 0.24, ease }} className="mt-12 grid items-start gap-6 min-[900px]:grid-cols-2">
        <div className="grid gap-6">
          <IdentitySettings />
          <PostSettings />
        </div>
        <div className="grid gap-6">
          <SecuritySettings />
          <DataSettings />
        </div>
      </motion.div>
    </div>
  );
}
