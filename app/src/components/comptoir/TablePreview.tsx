import { Suspense, lazy, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import Button from '@/components/platform/Button';
import { platformPortalTarget } from '@/components/platform/portalTarget';
import { getBoardOptions, groundWeather, tryOff, type TryOn } from '@/components/game/boardOptions';
import { cardArt } from '@/components/game/handFan';
import type { Card } from '@/game/types';
import { setMix, tableAmbience, tableMusic, tuneNow } from '@/gl/sfx';
import { useT } from '@/i18n';
import { showroom } from './showroom';

const PixiBoard = lazy(() => import('@/gl/PixiBoard'));

/* ------------------------------------------------------------------ */
/* The counter's window: the table in a frame over the page, wearing   */
/* the thing looked at, with its ground's weather and its music heard  */
/* at once — and no names on the towns, no unbuilt route, so the look  */
/* is seen for itself. Shut (Escape, the cross, the veil), the table   */
/* wears its own again.                                                */
/* ------------------------------------------------------------------ */

/** the names and the traces are hidden, whatever the reader's keys say */
const LOOK = { hideLabels: true, hideUnbuilt: true } as const;

/** a few of the hand's plates, fanned over the board, for the cards */
const FAN: Card[] = ['stoke', 'birmingham', 'coventry', 'derby'].map((town) => ({ id: `fan-${town}`, kind: 'location', town }));

export interface TablePreviewProps {
  /** what the table wears while the window is open; null shuts it */
  wear: Omit<TryOn, 'until'> | null;
  /** the name of the thing, on the frame */
  title: string;
  /** a line under it */
  blurb?: string;
  /** a word for whom the look is meant, when it is not everyone's */
  tag?: string;
  onClose: () => void;
}

/** the table, its sounds heard, until the window shuts: the thing is put
 *  on by the page before this is mounted (the board reads it at boot) and
 *  taken off here */
function Table({ cards, tiles }: { cards: boolean; tiles: boolean }) {
  const game = useMemo(() => showroom(tiles), [tiles]);
  useEffect(() => {
    const o = getBoardOptions();
    setMix({ on: o.sound, ambience: true, music: true, voices: false, levels: { ambience: o.volAmbience, gestures: o.volGestures, moments: o.volMoments, music: o.volMusic } });
    tableAmbience('canal', groundWeather());
    tableMusic('canal');
    /* the era's first tune without its usual wait: the window is opened to hear it */
    tuneNow();
    return () => {
      tableMusic(null);
      tableAmbience(null);
      tryOff();
    };
  }, []);
  return (
    <>
      <Suspense fallback={<div className="flex h-full items-center justify-center font-fell text-brass-400">…</div>}>
        <PixiBoard game={game} targets={[]} linkTargetsList={[]} sellTargetsList={[]} ghost={null} onInvalid={() => {}} keyboard={false} look={LOOK} />
      </Suspense>
      {cards && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-4 flex items-end justify-center">
          {FAN.map((c, i) => {
            const src = cardArt(c);
            return src ? <img key={c.id} src={src} alt="" className="-mx-3 w-[clamp(96px,11vw,150px)] origin-bottom rounded-[6px] shadow-[0_6px_18px_rgba(0,0,0,.55)]" style={{ transform: `translateY(${Math.abs(i - 1.5) * 8}px) rotate(${(i - 1.5) * 6}deg)` }} /> : null;
          })}
        </div>
      )}
    </>
  );
}

export default function TablePreview({ wear, title, blurb, tag, onClose }: TablePreviewProps) {
  const t = useT();
  const open = wear !== null;
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {wear && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-lacquer-950/85 p-3 sm:p-6"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 16, scale: 0.985, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, scale: 0.985, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="console flex h-full max-h-[920px] w-full max-w-[1560px] flex-col !bg-enamel-800 p-3 shadow-[0_8px_24px_var(--shadow-modal)] sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="title-card flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {title}
                  {tag && <span className="micro-label border-y border-[var(--gz-ink-soft)] px-2 text-brass-300">{tag}</span>}
                </h2>
                {blurb && <p className="mt-1 font-ui text-[12.5px] leading-snug text-paper-300">{blurb}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="micro-label hidden text-iron-400 sm:inline">{t('platform.comptoir.tryHint')}</span>
                <Button variant="icon" aria-label={t('platform.action.close')} onClick={onClose} icon={<X size={16} aria-hidden />} />
              </div>
            </div>
            <div className="relative min-h-0 flex-1 select-none overflow-hidden bg-coal-950">
              <div aria-hidden className="tex-wood pointer-events-none absolute inset-0 opacity-35" />
              <div className="absolute inset-0">
                <Table cards={wear.cards !== undefined} tiles={wear.tiles !== undefined} />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    platformPortalTarget(),
  );
}
