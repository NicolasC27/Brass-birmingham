import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Copy, Download, Maximize, Type, X } from 'lucide-react';
import type { GameState } from '@/game/types';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { PHOTO_LOOKS, photoCaption, photoFileName, printFormat } from '@/gl/photoPrint';
import type { PhotoLook } from '@/gl/photoPrint';
import { getPhoto, setPhoto, usePhoto } from '@/gl/photoState';
import { isKey, keyLabel, typing, useKeybindings } from './keybindings';
import { topLayer } from './layers';
import { useLayer } from './useLayer';
import { useReducedMotion } from './useReducedMotion';
import './photo.css';

/* ------------------------------------------------------------------ */
/* The photo mode, on the page: the camera among the table's tools and  */
/* its key, the HUD sent away (photo.css, from the mark on <html>), and */
/* a slim brass toolbar at the foot of the frame that goes when the     */
/* pointer rests — the looks, the names on or off, the whole country,   */
/* and the print: saved as a file or copied, signed in its corner.      */
/* The board's side of it is photo.ts, in the WebGL chunk.              */
/* ------------------------------------------------------------------ */

/** how long the pointer rests before the toolbar steps away (ms) */
const IDLE_MS = 2400;
/** the HUD's fade, in and out (ms; photo.css says the same) */
const FADE_MS = 350;

/** the board is up: there is something to photograph */
const boardUp = (): boolean => !!document.querySelector('[data-board-frame] canvas');

/** the camera among the table's tools */
export function PhotoButton({ className }: { className?: string }) {
  const t = useT();
  const keys = useKeybindings();
  return (
    <button type="button" onClick={() => boardUp() && setPhoto({ on: true })} title={`${t('game.photo.enter')} (${keyLabel(keys.photo)})`} aria-label={t('game.photo.enter')} aria-keyshortcuts={keyLabel(keys.photo)} className={className}>
      <Camera className="h-4 w-4" />
    </button>
  );
}

/* a look's swatch on the toolbar: the print's paper and ink in a coin */
const SWATCH: Record<PhotoLook, string> = {
  none: 'conic-gradient(from 200deg, #6f8a5a, #c9a45c, #b0472c, #3f6c8c, #6f8a5a)',
  sepia: 'radial-gradient(circle at 35% 30%, #f1e2c2, #9a7348 60%, #3a2616)',
  aquarelle: 'radial-gradient(circle at 30% 30%, #fbf7ee 10%, #b9d3c4 40%, #e6b8a0 70%, #f4ead8)',
  nuit: 'radial-gradient(circle at 62% 38%, #ffcf7a 0 12%, #2a3c62 30%, #0b1224 80%)',
};

/** how the signature is inked on each look: the ink, the light under it,
 *  and the paper cleared round it on a print in light inks (r,g,b) */
const INKS: Record<PhotoLook, { ink: string; rule: string; emboss?: string; halo?: string; paper?: string }> = {
  none: { ink: 'rgba(246,238,218,0.96)', rule: 'rgba(246,238,218,0.7)', halo: 'rgba(16,11,7,0.85)' },
  sepia: { ink: 'rgba(48,30,16,0.9)', rule: 'rgba(48,30,16,0.55)', emboss: 'rgba(252,244,224,0.6)', paper: '243,233,206' },
  aquarelle: { ink: 'rgba(72,58,46,0.85)', rule: 'rgba(72,58,46,0.45)', paper: '251,248,241' },
  nuit: { ink: 'rgba(232,202,140,0.95)', rule: 'rgba(232,202,140,0.6)', halo: 'rgba(4,7,16,0.9)' },
};

/** the signature engraved in the print's corner: the name in the house's
 *  small capitals, a rule with its lozenge, and the line under it.
 *  `u` is print pixels to a pixel of the frame */
function sign(canvas: HTMLCanvasElement, look: PhotoLook, caption: string, u: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { ink, rule, emboss, halo, paper } = INKS[look];
  const pad = (look === 'aquarelle' ? 40 : 24) * u;
  const right = canvas.width - pad;
  const capY = canvas.height - pad;
  const nameY = capY - 22 * u;
  const name = 'Blackrail';
  const nameFont = `${Math.round(27 * u)}px "IM Fell English SC", Georgia, serif`;
  const capFont = `italic ${Math.round(12.5 * u)}px Spectral, Georgia, serif`;
  ctx.save();
  /* the paper wiped clean round the signature, as round a plate's title */
  if (paper) {
    const cx = right - 80 * u;
    const cy = capY - 16 * u;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.42);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 150 * u);
    g.addColorStop(0, `rgba(${paper},0.78)`);
    g.addColorStop(0.55, `rgba(${paper},0.45)`);
    g.addColorStop(1, `rgba(${paper},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(-150 * u, -150 * u, 300 * u, 300 * u);
    ctx.restore();
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const text = (s: string, font: string, y: number, spacing: string) => {
    ctx.font = font;
    spaced.letterSpacing = spacing;
    if (halo) {
      ctx.shadowColor = halo;
      ctx.shadowBlur = 9 * u;
      ctx.fillStyle = halo;
      ctx.fillText(s, right, y);
      ctx.shadowBlur = 0;
    }
    if (emboss) {
      ctx.fillStyle = emboss;
      ctx.fillText(s, right + 0.7 * u, y + 0.9 * u);
    }
    ctx.fillStyle = ink;
    ctx.fillText(s, right, y);
  };
  text(name, nameFont, nameY, `${(0.9 * u).toFixed(1)}px`);
  ctx.font = nameFont;
  spaced.letterSpacing = `${(0.9 * u).toFixed(1)}px`;
  const nameW = ctx.measureText(name).width;
  /* the rule under the name, broken by a lozenge at its middle */
  const ry = nameY + 6.5 * u;
  const mid = right - nameW / 2;
  const d = 2.6 * u;
  ctx.strokeStyle = rule;
  ctx.fillStyle = rule;
  ctx.lineWidth = Math.max(1, 0.8 * u);
  ctx.beginPath();
  ctx.moveTo(right - nameW, ry);
  ctx.lineTo(mid - d * 2.2, ry);
  ctx.moveTo(mid + d * 2.2, ry);
  ctx.lineTo(right, ry);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mid, ry - d);
  ctx.lineTo(mid + d, ry);
  ctx.lineTo(mid, ry + d);
  ctx.lineTo(mid - d, ry);
  ctx.closePath();
  ctx.fill();
  text(caption, capFont, capY, '0px');
  ctx.restore();
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> =>
  new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), type, quality));

const canCopy = (): boolean => typeof window !== 'undefined' && 'ClipboardItem' in window && !!navigator.clipboard?.write;

type Status = { kind: 'busy' } | { kind: 'saved'; w: number; h: number } | { kind: 'copied' } | { kind: 'failed'; copy: boolean } | null;

/** the photo mode: mounted with the table, idle until it is asked for */
export default function PhotoMode({ game }: { game: GameState }) {
  const t = useT();
  const { on, look, labels } = usePhoto();
  const code = useGame((s) => s.code);
  const reduced = useReducedMotion();
  const leave = useCallback(() => setPhoto({ on: false }), []);
  const bar = useLayer<HTMLDivElement>(on, leave, { modal: true });
  const [awake, setAwake] = useState(true);
  const [hint, setHint] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [flash, setFlash] = useState(0);
  const over = useRef(false);
  const busy = status?.kind === 'busy';

  /* the photo key, at the table and in the photo mode: in, and out again.
     A sheet that holds the table keeps it (the photo mode's own is one) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || typing(e) || !isKey(e, 'photo')) return;
      if (getPhoto().on) {
        e.preventDefault();
        setPhoto({ on: false });
        return;
      }
      if (topLayer()?.modal || !boardUp()) return;
      e.preventDefault();
      setPhoto({ on: true });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* the mark on <html> the stylesheet reads: the HUD fades away, and back */
  useEffect(() => {
    const root = document.documentElement;
    if (on) {
      root.dataset.photo = 'on';
      return;
    }
    if (root.dataset.photo !== 'on') return;
    root.dataset.photo = 'leaving';
    const id = window.setTimeout(() => {
      if (root.dataset.photo === 'leaving') delete root.dataset.photo;
    }, FADE_MS + 50);
    return () => window.clearTimeout(id);
  }, [on]);
  /* the table taken down (a page left) takes the mode with it */
  useEffect(
    () => () => {
      setPhoto({ on: false });
      delete document.documentElement.dataset.photo;
    },
    [],
  );

  /* at a home table the machines wait while the picture is taken, and play
     on after — unless the reader had already held them */
  useEffect(() => {
    if (!on) return;
    const st = useGame.getState();
    if (st.seat !== null || st.botHold) return;
    st.setBotHold(true);
    return () => useGame.getState().setBotHold(false);
  }, [on]);

  /* a click on the board frames the picture, and nothing else: no slot
     picked, no town opened, no look pointed at the table */
  useEffect(() => {
    if (!on) return;
    const frame = document.querySelector<HTMLElement>('[data-board-frame]');
    if (!frame) return;
    const swallow = (e: Event) => {
      e.stopPropagation();
      if (e.type === 'contextmenu') e.preventDefault();
    };
    frame.addEventListener('click', swallow, true);
    frame.addEventListener('contextmenu', swallow, true);
    return () => {
      frame.removeEventListener('click', swallow, true);
      frame.removeEventListener('contextmenu', swallow, true);
    };
  }, [on]);

  /* the toolbar steps away when the pointer rests, and comes back with it */
  useEffect(() => {
    if (!on) return;
    let timer = 0;
    const wake = () => {
      setAwake(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!over.current) setAwake(false);
      }, IDLE_MS);
    };
    wake();
    setHint(true);
    const hush = window.setTimeout(() => setHint(false), 4200);
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    window.addEventListener('wheel', wake, { passive: true });
    window.addEventListener('keydown', wake);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(hush);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('wheel', wake);
      window.removeEventListener('keydown', wake);
      setStatus(null);
    };
  }, [on]);

  /* a word on the print pulled, for a moment */
  useEffect(() => {
    if (!status || status.kind === 'busy') return;
    const id = window.setTimeout(() => setStatus(null), 3200);
    return () => window.clearTimeout(id);
  }, [status]);

  const caption = () => photoCaption(t, { era: game.era, round: game.round, over: game.phase === 'game-over', code, year: new Date().getFullYear() });

  /** the print pulled and signed: the board's chunk is already loaded */
  const pull = async (): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> => {
    const [{ pullPrint }] = await Promise.all([
      import('@/gl/photo'),
      document.fonts?.load('27px "IM Fell English SC"').catch(() => undefined),
      document.fonts?.load('italic 12px Spectral').catch(() => undefined),
    ]);
    const p = pullPrint();
    if (!p) throw new Error('no board');
    sign(p.canvas, getPhoto().look, caption(), p.scale);
    return p;
  };

  const shutter = () => {
    if (!reduced) setFlash((n) => n + 1);
  };

  const save = async () => {
    if (busy) return;
    setStatus({ kind: 'busy' });
    shutter();
    try {
      const p = await pull();
      const format = printFormat(p.width, p.height);
      const blob = await toBlob(p.canvas, format === 'png' ? 'image/png' : 'image/jpeg', 0.92);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = photoFileName({ era: game.era, round: game.round, over: game.phase === 'game-over' }, getPhoto().look, format);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setStatus({ kind: 'saved', w: p.width, h: p.height });
    } catch {
      setStatus({ kind: 'failed', copy: false });
    }
  };

  const copy = () => {
    if (busy) return;
    setStatus({ kind: 'busy' });
    shutter();
    /* the item is handed over at once, its image promised: a browser that
       asks for the gesture's own moment still sees one */
    const png = pull().then((p) => toBlob(p.canvas, 'image/png'));
    navigator.clipboard
      .write([new ClipboardItem({ 'image/png': png })])
      .then(() => setStatus({ kind: 'copied' }))
      .catch(() => setStatus({ kind: 'failed', copy: true }));
  };

  const word =
    status?.kind === 'busy'
      ? t('game.photo.printing')
      : status?.kind === 'saved'
        ? t('game.photo.saved', { size: `${status.w} × ${status.h}` })
        : status?.kind === 'copied'
          ? t('game.photo.copied')
          : status?.kind === 'failed'
            ? t(status.copy ? 'game.photo.copyFailed' : 'game.photo.failed')
            : hint
              ? t('game.photo.hint')
              : null;
  const shown = awake || busy || !!status;

  const btn = 'flex h-8 items-center gap-1.5 rounded-full px-2.5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.12em] text-cream-100/75 transition-colors hover:bg-brass-500/15 hover:text-brass-300 focus-visible:outline focus-visible:outline-1 focus-visible:outline-brass-400 disabled:opacity-40';

  return (
    <>
      <AnimatePresence>
        {on && flash > 0 && (
          <motion.div
            key={flash}
            aria-hidden
            data-photo-bar
            className="pointer-events-none fixed inset-0 z-[95] bg-[#fff8e8]"
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {on && (
          <motion.div
            key="photo-bar"
            data-photo-bar
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 px-4 pb-5"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 10 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ duration: reduced ? 0 : 0.28, ease: 'easeOut' }}
          >
            <AnimatePresence mode="wait">
              {word && (
                <motion.p
                  key={word}
                  role="status"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className={cn('rounded-full border border-brass-700/50 bg-coal-950/80 px-3.5 py-1 font-display text-[12.5px] italic tracking-wide backdrop-blur-md', status?.kind === 'failed' ? 'text-rust-500 brightness-150' : 'text-cream-100/85')}
                >
                  {word}
                </motion.p>
              )}
            </AnimatePresence>
            <div
              ref={bar}
              tabIndex={-1}
              role="toolbar"
              aria-label={t('game.photo.toolbarAria')}
              onPointerEnter={() => (over.current = true)}
              onPointerLeave={() => (over.current = false)}
              className={cn('plaque relative flex max-w-full items-center gap-1 overflow-x-auto rounded-full px-1.5 py-1 outline-none', shown ? 'pointer-events-auto' : 'pointer-events-none')}
            >
              <span aria-hidden className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brass-400/70 to-transparent" />
              <span className="flex shrink-0 items-center gap-1.5 pl-2 pr-1.5 font-fell text-[14px] tracking-[0.08em] text-brass-400">
                <Camera className="h-3.5 w-3.5" aria-hidden />
                {t('game.photo.title')}
              </span>
              <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-brass-700/60" />
              <div role="radiogroup" aria-label={t('game.photo.looksAria')} className="flex shrink-0 items-center gap-0.5">
                {PHOTO_LOOKS.map((l) => {
                  const picked = l === look;
                  return (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={picked}
                      aria-label={t(`game.photo.look.${l}`)}
                      title={t(`game.photo.look.${l}`)}
                      onClick={() => setPhoto({ look: l })}
                      className={cn(
                        'flex h-8 items-center gap-2 rounded-full py-1 pl-1.5 pr-1.5 font-fell lg:pr-3 text-[13.5px] tracking-wide transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-brass-400',
                        picked ? 'bg-brass-500/20 text-brass-300 shadow-[inset_0_0_0_1px_rgba(221,190,126,.55)]' : 'text-cream-100/70 hover:bg-brass-500/10 hover:text-cream-100',
                      )}
                    >
                      <span aria-hidden className={cn('h-4 w-4 rounded-full shadow-[0_0_0_1px_rgba(10,7,5,.8),inset_0_1px_1px_rgba(255,255,255,.25)]', picked && 'ring-1 ring-brass-400/80 ring-offset-1 ring-offset-coal-950')} style={{ background: SWATCH[l] }} />
                      <span className="hidden lg:inline">{t(`game.photo.look.${l}`)}</span>
                    </button>
                  );
                })}
              </div>
              <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-brass-700/60" />
              <button type="button" onClick={() => setPhoto({ labels: !labels })} aria-pressed={labels} title={t(labels ? 'game.photo.labelsHide' : 'game.photo.labelsShow')} aria-label={t('game.photo.labels')} className={cn(btn, 'w-8 justify-center px-0', labels && 'text-brass-300')}>
                <Type className={cn('h-4 w-4', !labels && 'opacity-50')} />
              </button>
              <button type="button" onClick={() => void import('@/gl/photo').then((m) => m.photoFit())} title={t('game.photo.fit')} aria-label={t('game.photo.fit')} className={cn(btn, 'w-8 justify-center px-0')}>
                <Maximize className="h-4 w-4" />
              </button>
              <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-brass-700/60" />
              <button type="button" onClick={() => void save()} disabled={busy} title={t('game.photo.saveTip')} aria-label={t('game.photo.save')} className={cn(btn, 'text-brass-300')}>
                <Download className="h-4 w-4" />
                <span className="hidden lg:inline">{t('game.photo.save')}</span>
              </button>
              {canCopy() && (
                <button type="button" onClick={copy} disabled={busy} title={t('game.photo.copyTip')} aria-label={t('game.photo.copy')} className={btn}>
                  <Copy className="h-4 w-4" />
                  <span className="hidden lg:inline">{t('game.photo.copy')}</span>
                </button>
              )}
              <button type="button" onClick={leave} title={t('game.photo.leave')} aria-label={t('game.photo.leave')} aria-keyshortcuts="Escape" className={cn(btn, 'ml-0.5 w-8 justify-center px-0')}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
