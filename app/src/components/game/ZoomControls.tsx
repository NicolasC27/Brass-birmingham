import { Minus, Plus } from 'lucide-react';
import Tooltip from './Tooltip';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ */
/* On-board zoom toolbar — small brass plates: − / + and the current   */
/* zoom readout only. (100% / fit live on keyboard 0 and double-click; */
/* the board options row carries fullscreen + settings.)               */
/* ------------------------------------------------------------------ */

function ZoomButton({
  label,
  tip,
  onClick,
  children,
}: {
  label: string;
  tip: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={tip} side="top">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="plaque flex h-8 min-w-8 items-center justify-center px-1.5 font-sans text-[11px] font-bold text-ink-900 transition-transform hover:brightness-110 active:translate-y-px"
      >
        {children}
      </button>
    </Tooltip>
  );
}

export default function ZoomControls({
  k,
  onZoomIn,
  onZoomOut,
}: {
  k: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  const t = useT();
  return (
    <div
      className="absolute bottom-[44px] left-3 z-20 flex items-center gap-1.5"
      role="toolbar"
      aria-label={t('board.zoom.ariaLabel')}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <ZoomButton label={t('board.zoom.outAria')} tip={t('board.zoom.outTip')} onClick={onZoomOut}>
        <Minus className="h-3.5 w-3.5" />
      </ZoomButton>
      <ZoomButton label={t('board.zoom.inAria')} tip={t('board.zoom.inTip')} onClick={onZoomIn}>
        <Plus className="h-3.5 w-3.5" />
      </ZoomButton>
      <span
        aria-live="polite"
        className="plate flex h-8 items-center px-2 font-mono text-[10px] font-semibold text-brass-400"
        title={t('board.zoom.currentTitle')}
      >
        {Math.round(k * 100)}%
      </span>
    </div>
  );
}
