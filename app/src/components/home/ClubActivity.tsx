import { motion } from 'framer-motion';
import { useT } from '@/i18n';
import ActivityFeedItem from '@/components/platform/ActivityFeedItem';
import Button from '@/components/platform/Button';
import { demoFeed, demoTicker } from '@/components/platform/mockData';

/* ------------------------------------------------------------------ */
/* Activité du club (home.md §S4) — fil d'activité (gauche) + ticker   */
/* des résultats récents (droite, boucle 24s, pause au survol, masque  */
/* dégradé). Données : mockData (démo).                                */
/* ------------------------------------------------------------------ */

function Ticker() {
  const t = useT();

  if (demoTicker.length === 0) {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-3 rounded-xl border border-brass-hairline bg-enamel-850 p-6 text-center">
        <img src="/empty-queue.png" alt="" width={200} className="w-[200px] rounded-lg border border-[rgb(var(--paper-100)/.07)]" />
        <p className="max-w-[260px] font-ui text-[13px] text-paper-300">{t('platform.home.activity.tickerEmpty')}</p>
      </div>
    );
  }

  const loop = [...demoTicker, ...demoTicker];
  return (
    <div
      className="ticker-mask h-80 overflow-hidden rounded-xl border border-brass-hairline bg-enamel-850"
      aria-label={t('platform.home.activity.title')}
    >
      <div className="animate-ticker hover:[animation-play-state:paused]">
        {loop.map((r, i) => (
          <div key={`${r.id}-${i}`}>
            <button
              type="button"
              className="data-text block w-full px-4 py-3 text-left text-[12px] text-paper-300 transition-colors duration-150 hover:bg-enamel-800 hover:text-paper-100 tnums"
            >
              {t('platform.home.ticker.line', { time: r.time, table: r.table, winner: r.winner, vp: r.vp })}
            </button>
            <div aria-hidden className="mx-4 h-px bg-[rgb(var(--paper-100)/.07)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

const item = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: 'easeOut' as const, delay: i * 0.04 },
  }),
};

export default function ClubActivity() {
  const t = useT();

  return (
    <div className="grid gap-6 min-[900px]:grid-cols-12">
      <section className="min-[900px]:col-span-7" aria-label={t('platform.home.activity.title')}>
        <motion.div initial="hidden" whileInView="show" viewport={{ amount: 0.15, once: true }} variants={item} custom={0}>
          <div className="flex items-baseline gap-3">
            <h2 className="h2-section">{t('platform.home.activity.title')}</h2>
            <span className="micro-label flex items-center gap-1.5 text-signal-400">
              <span className="animate-pulse-signal h-1.5 w-1.5 rounded-full bg-signal-400" aria-hidden />
              {t('platform.home.activity.live')}
            </span>
          </div>
        </motion.div>
        <div className="mt-4 rounded-xl border border-brass-hairline bg-enamel-850 p-2">
          {demoFeed.slice(0, 5).map((f, i) => (
            <motion.div key={f.id} initial="hidden" whileInView="show" viewport={{ amount: 0.15, once: true }} variants={item} custom={i + 1}>
              <ActivityFeedItem kind={f.kind} vars={f.vars} minutesAgo={f.minutesAgo} />
            </motion.div>
          ))}
        </div>
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={item} custom={6} className="mt-3">
          <Button variant="ghost" className="!h-9 text-[13px]" to="/desk#historique">
            {t('platform.home.activity.seeHistory')}
          </Button>
        </motion.div>
      </section>
      <motion.section
        className="min-[900px]:col-span-5"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.15, once: true }}
        transition={{ duration: 0.22, ease: 'easeOut', delay: 0.08 }}
      >
        <Ticker />
      </motion.section>
    </div>
  );
}
