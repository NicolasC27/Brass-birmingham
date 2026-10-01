import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { colorDef, type PlayerColor } from '@/components/setup/constants';
import { MAX_SEATS } from '@/online/table';

/* ------------------------------------------------------------------ */
/* The train on the platform: the engine, then one carriage a seat —   */
/* painted in the passenger's colour once taken, an empty outline      */
/* while free, the name on the door. Purely a picture of the table;    */
/* the seats themselves are handled below it.                          */
/* ------------------------------------------------------------------ */

export interface Carriage {
  name: string;
  color: PlayerColor;
  kind: 'human' | 'bot';
  ready?: boolean;
}

export default function TrainStrip({ seats, counting }: { seats: (Carriage | null)[]; counting?: boolean }) {
  const t = useT();
  const cars = [...seats];
  while (cars.length < MAX_SEATS) cars.push(null);
  return (
    <div className={cn('relative overflow-hidden border-b border-[var(--gz-ink-soft)] pb-3', counting && 'animate-pulse-signal')} aria-hidden>
      <div className="flex items-end gap-2">
        {/* the engine, drawn as the rail's own */}
        <svg viewBox="0 0 44 18" width="88" height="36" fill="currentColor" className="shrink-0 text-paper-100">
          <rect x="0" y="8" width="9" height="6" />
          <circle cx="2.5" cy="15.5" r="1.7" />
          <circle cx="6.5" cy="15.5" r="1.7" />
          <rect x="11" y="4" width="7" height="10" />
          <rect x="17" y="7" width="20" height="7" rx="3" />
          <rect x="32" y="1" width="3" height="7" />
          <rect x="25" y="4.5" width="4" height="3" rx="1.5" />
          <circle cx="16" cy="14" r="3.4" />
          <circle cx="16" cy="14" r="1.4" fill="rgb(var(--lacquer-900))" />
          <circle cx="30" cy="15.2" r="2.2" />
          <circle cx="36" cy="15.2" r="2.2" />
          <rect x="16" y="14.6" width="14" height="1" opacity="0.8" />
        </svg>
        {cars.map((c, i) => (
          <motion.div key={i} layout className="flex min-w-0 flex-1 flex-col items-center gap-1" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, delay: 0.05 * i }}>
            <svg viewBox="0 0 60 18" className="h-9 w-full max-w-[120px]" preserveAspectRatio="xMidYMax meet">
              {c ? (
                <>
                  <rect x="2" y="4" width="56" height="10" rx="1.5" fill={colorDef(c.color).hex} opacity={c.kind === 'bot' ? 0.6 : 1} />
                  {[9, 21, 33, 45].map((x) => (
                    <rect key={x} x={x} y="6.5" width="6" height="4" rx="0.5" fill="rgb(var(--lacquer-900))" opacity="0.75" />
                  ))}
                  {c.ready && <circle cx="54" cy="8.5" r="1.6" fill="rgb(var(--bottle-400))" />}
                </>
              ) : (
                <rect x="2" y="4" width="56" height="10" rx="1.5" fill="none" stroke="var(--gz-ink-soft)" strokeDasharray="2 2" />
              )}
              <circle cx="12" cy="15.5" r="2" fill="currentColor" className="text-paper-100" opacity={c ? 1 : 0.3} />
              <circle cx="48" cy="15.5" r="2" fill="currentColor" className="text-paper-100" opacity={c ? 1 : 0.3} />
            </svg>
            <span className={cn('max-w-full truncate font-ui text-[10.5px] uppercase tracking-[0.12em]', c ? 'text-paper-100' : 'text-iron-600')}>{c ? c.name : t('platform.seat.free')}</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-1 h-px bg-[var(--gz-ink)]" />
    </div>
  );
}
