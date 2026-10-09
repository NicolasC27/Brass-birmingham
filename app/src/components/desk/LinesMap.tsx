import { useMemo } from 'react';
import { TOWN_BY_ID, TOWNS } from '@/game/data';
import { BLEED_X, BLEED_Y, WORLD_H, WORLD_W } from '@/components/game/boardView';
import { useT } from '@/i18n';
import { useDesk, useSession } from '@/online/session';
import { useTheme } from '@/platform/theme';
import { linesOf } from '@/platform/lines';

/* ------------------------------------------------------------------ */
/* The map of the member's lines: the engraved Midlands, and on it a   */
/* mark at every town they built in, the size of what they laid there; */
/* the towns most built in are named. Drawn from the office's tallies  */
/* and the games at home.                                              */
/* ------------------------------------------------------------------ */

const W = WORLD_W + 2 * BLEED_X;
const H = WORLD_H + 2 * BLEED_Y;
const NAMED = 6;

export default function LinesMap() {
  const t = useT();
  const desk = useDesk();
  const session = useSession();
  const theme = useTheme();
  const lines = useMemo(() => linesOf(desk?.history ?? [], session?.id ?? null), [desk?.history, session?.id]);
  const marks = useMemo(
    () =>
      Object.entries(lines.towns)
        .map(([id, n]) => ({ town: TOWN_BY_ID[id], n }))
        .filter((m) => !!m.town)
        .sort((a, b) => b.n - a.n),
    [lines],
  );
  const tiles = marks.reduce((s, m) => s + m.n, 0);
  const named = new Set(marks.slice(0, NAMED).map((m) => m.town.id));
  const ink = theme === 'dark' ? '#ede6d6' : '#241d14';

  return (
    <section aria-label={t('platform.desk.lines.title')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="micro-label text-paper-100">{t('platform.desk.lines.title')}</p>
        <p className="data-text text-iron-400 tnums">{marks.length ? t('platform.desk.lines.legend', { towns: marks.length, tiles, games: lines.games }) : ''}</p>
      </div>
      <div className="gz-rule-double mt-2" aria-hidden />
      <p className="mt-3 font-serif text-[13px] italic text-paper-300">{marks.length ? t('platform.desk.lines.lede') : t('platform.desk.lines.none')}</p>
      <div className="gz-engraving mt-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={t('platform.desk.lines.title')}>
          <image href="/map-engraved-canal.webp" width={W} height={H} style={{ filter: theme === 'dark' ? 'invert(1) hue-rotate(180deg) brightness(0.7)' : 'sepia(0.2)' }} />
          {/* the towns not yet built in, as faint points */}
          {TOWNS.filter((tw) => !lines.towns[tw.id]).map((tw) => (
            <circle key={tw.id} cx={tw.x + BLEED_X} cy={tw.y + BLEED_Y} r={9} fill="none" stroke={ink} strokeOpacity={0.3} strokeWidth={3} />
          ))}
          {marks.map(({ town, n }) => {
            const r = 22 + 16 * Math.sqrt(n);
            return (
              <g key={town.id}>
                {/* the ring and its pin take the register's own brass, not a
                    fixed one: 3.55 on the day's sepia map, 8.80 on the night's */}
                <circle cx={town.x + BLEED_X} cy={town.y + BLEED_Y} r={r} fill="rgb(var(--brass-plate))" fillOpacity={0.28} stroke="rgb(var(--brass-300))" strokeWidth={4} />
                <circle cx={town.x + BLEED_X} cy={town.y + BLEED_Y} r={10} fill="rgb(var(--brass-300))" />
                {named.has(town.id) && (
                  <text x={town.x + BLEED_X} y={town.y + BLEED_Y - r - 18} textAnchor="middle" fill={ink} fontFamily="Fraunces, Georgia, serif" fontSize={54} fontWeight={500}>
                    {town.name} · {n}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
