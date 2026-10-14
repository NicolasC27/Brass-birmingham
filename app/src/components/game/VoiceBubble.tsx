import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TOWN_BY_ID } from '@/game/data';
import { onSaid, saidNow } from '@/gl/sfx';
import type { Said } from '@/gl/sfx';
import type { AnchorRegistry } from './boardView';
import { townChrome } from './townChrome';

/* ------------------------------------------------------------------ */
/* A word from the townsfolk: a small paper bubble over the town where */
/* the line is heard, the speaker's name over it, while the voice      */
/* speaks and a moment after (sfx.ts decides when). Hung from the map  */
/* like the town's card, under the HUD, and never in the pointer's     */
/* way. The line is English in every language: it is what was said.   */
/* ------------------------------------------------------------------ */

/** a bubble whose top would come this close to the top of the frame (px),
 *  under the order bar, hangs below its town instead */
const TOP_ROOM = 56;

function Bubble({ said, anchors }: { said: Said; anchors: AnchorRegistry }) {
  const town = TOWN_BY_ID[said.town];
  const box = useRef<HTMLDivElement>(null);
  /* over the town's cluster of tiles, not on it; a bubble that would come
     under the order bar hangs below its town instead. Decided once, as the
     line begins; the bubble then follows its town rigidly as the map pans */
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const geo = townChrome(town);
    let off = anchors.register(el, { wx: geo.ax, wy: geo.minY, py: -6, clampX: 110 });
    if (el.getBoundingClientRect().top < TOP_ROOM) {
      off();
      el.dataset.below = '1';
      off = anchors.register(el, { wx: geo.ax, wy: geo.maxY, py: 8, clampX: 110 });
    }
    return off;
  }, [anchors, town]);
  return (
    <div ref={box} className="group pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full data-[below=1]:translate-y-0" aria-live="polite" lang="en">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative max-w-[210px] rounded-[10px] border border-brass-700/50 bg-cream-100 px-2.5 pb-1.5 pt-1 text-center text-ink-900 shadow-e4"
      >
        <span className="block font-fell text-[10px] leading-tight tracking-wide text-ink-900/60">
          {said.name}, {said.trade}
        </span>
        <span className="block font-serif text-[13px] italic leading-snug">{said.text}</span>
        {/* the tail, pointing at the town: under the bubble, or over it when it hangs below */}
        <span
          aria-hidden
          className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-[5px] rotate-45 border-b border-r border-brass-700/50 bg-cream-100 group-data-[below=1]:bottom-full group-data-[below=1]:top-auto group-data-[below=1]:translate-y-[5px] group-data-[below=1]:border-b-0 group-data-[below=1]:border-l group-data-[below=1]:border-r-0 group-data-[below=1]:border-t"
        />
      </motion.div>
    </div>
  );
}

export default function VoiceBubble({ anchors }: { anchors: AnchorRegistry }) {
  const said = useSyncExternalStore(onSaid, saidNow, () => null);
  return <AnimatePresence>{said && TOWN_BY_ID[said.town] && <Bubble key={said.id + said.until} said={said} anchors={anchors} />}</AnimatePresence>;
}
