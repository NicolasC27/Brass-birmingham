import { X } from 'lucide-react';
import { useT } from '@/i18n';
import { useLayer } from './useLayer';

/* A portrait seen in full: the medallion opens over the table, the name
   under it, and a click anywhere or Escape puts it back. */

export default function PortraitLightbox({ src, name, line, rim, onClose }: { src: string; name: string; line?: string; rim: string; onClose: () => void }) {
  const t = useT();
  /* a sheet over the card that opened it: Escape puts back this one only */
  const sheet = useLayer(true, onClose, { modal: true });
  return (
    <div ref={sheet} tabIndex={-1} className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={name} onClick={onClose}>
      <img
        src={src}
        alt={name}
        draggable={false}
        className="rounded-full object-cover"
        style={{ width: 'min(70vh, 70vw)', height: 'min(70vh, 70vw)', boxShadow: `0 0 0 3px #100D0B, 0 0 0 7px ${rim}, 0 0 40px ${rim}66, inset 0 0 0 2px rgba(201,164,92,.55)` }}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="text-center">
        <p className="font-fell text-[22px] tracking-wide text-cream-100">{name}</p>
        {line && <p className="font-mono text-[11px] uppercase tracking-wider text-cream-100/70">{line}</p>}
      </div>
      <button type="button" onClick={onClose} aria-label={t('game.card.portraitClose')} className="absolute right-4 top-4 rounded-full border border-brass-700/60 p-2 text-cream-100/80 hover:text-cream-100">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
