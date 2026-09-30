import { useState } from 'react';
import { useT } from '@/i18n';
import { listProgress, recurring } from '@/game/progress';
import { PLAN_NAMES } from '@/game/plan';
import StatTile from '@/components/platform/StatTile';

/** the sheet of progress: every game the judge read through, its mean loss
    per move drawn game after game, the misses, the plans, and what recurs */
export default function ProgressCard({ quiet = false }: { quiet?: boolean }) {
  const t = useT();
  const [sheet] = useState(listProgress);
  const recent = [...sheet].reverse().slice(-20);
  const back = recurring(sheet, 10).slice(0, 3);
  if (!sheet.length) {
    if (quiet) return null;
    return (
      <div className="console p-5">
        <p className="font-ui text-[13px] font-semibold text-paper-100">{t('platform.desk.progress.title')}</p>
        <p className="mt-1 font-ui text-[13px] text-iron-400">{t('platform.desk.progress.empty')}</p>
      </div>
    );
  }
  const W = 560;
  const H = 96;
  const top = Math.max(10, ...recent.map((p) => p.lost));
  const x = (i: number) => (recent.length === 1 ? W / 2 : (i / (recent.length - 1)) * (W - 16) + 8);
  const y = (v: number) => H - 8 - (v / top) * (H - 24);
  const line = recent.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.lost).toFixed(1)}`).join(' ');
  const mean = recent.reduce((s, p) => s + p.lost, 0) / recent.length;
  const last = recent[recent.length - 1];
  return (
    <div className="console p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-ui text-[13px] font-semibold text-paper-100">{t('platform.desk.progress.title')}</p>
        <p className="data-text text-[11px] text-iron-400">{t('platform.desk.progress.games', { n: sheet.length })}</p>
      </div>
      <p className="mt-0.5 font-ui text-[12px] text-iron-400">{t('platform.desk.progress.lede')}</p>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('platform.desk.progress.curve')} className="h-24 w-full min-w-[320px]">
          <line x1={8} x2={W - 8} y1={y(mean)} y2={y(mean)} stroke="rgb(var(--paper-100) / .25)" strokeWidth={1} strokeDasharray="3 3" />
          <text x={W - 8} y={y(mean) - 3} textAnchor="end" fill="rgb(var(--paper-100) / .5)" fontSize={9} fontFamily="ui-monospace, monospace">{t('platform.desk.progress.mean', { v: mean.toFixed(1) })}</text>
          <path d={line} fill="none" stroke="#C9A45C" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {recent.map((p, i) => (
            <circle key={p.id} cx={x(i)} cy={y(p.lost)} r={3.5} fill={p.rank === 1 ? '#C9A45C' : '#7d6a4a'} stroke="rgba(0,0,0,.5)" strokeWidth={1}>
              <title>{`${new Date(p.at).toLocaleDateString()} · −${p.lost} · ${p.by.blunder + p.by.mistake + p.by.inaccuracy} ${t('platform.desk.progress.missesShort')} · ${p.plan ? PLAN_NAMES[p.plan] : '—'}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="mt-2 grid gap-3 min-[560px]:grid-cols-3">
        <StatTile value={`−${last.lost}`} label={t('platform.desk.progress.lastLost')} />
        <StatTile value={last.by.blunder + last.by.mistake} label={t('platform.desk.progress.lastMisses')} />
        <StatTile value={last.plan ? PLAN_NAMES[last.plan] : '—'} label={t('platform.desk.progress.lastPlan')} />
      </div>
      {back.length > 0 && (
        <div className="mt-3">
          <p className="font-ui text-[12px] font-semibold text-paper-100">{t('platform.desk.progress.back')}</p>
          <ul className="mt-1 flex flex-col gap-0.5 font-ui text-[12px] text-paper-300/85">
            {back.map((r) => (
              <li key={r.motif}><span className="data-text text-[11px] text-copper-500">×{r.times}</span> {t(`game.debrief.motifs.${r.motif}`)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

