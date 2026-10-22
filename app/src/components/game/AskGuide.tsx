import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, MessageCircleQuestion, X } from 'lucide-react';
import { passagesOf } from '@/game/faq';
import { askedAs, tell } from '@/game/faq/consult';
import type { NearNotion } from '@/game/faq/consult';
import { useGame } from '@/game/store';
import { dictOf, useLang, useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { aidOn } from './boardOptions';
import { answerQuestion } from './tableAnswers';
import { useHudInsets } from './useHudInsets';
import { leftSheetStyle, useDockReserve, useLayer } from './useLayer';

/* ------------------------------------------------------------------ */
/* A question to the guide, at any table and any width — whether the   */
/* guided game's lane is there or not. A small plate opened from the    */
/* tools, answered as the lane answers: from the table as it stands,    */
/* where the assistance is on, and from the guide's case — every notion */
/* of the game, read through slips of the pen — and, when nothing there */
/* is close, with the two or three notions the question might have     */
/* meant.                                                               */
/* ------------------------------------------------------------------ */

/** the notions offered under an answer that found nothing close: each one
 *  a word of the line, asked in turn when it is clicked */
export function NearList({ near, onPick }: { near: NearNotion[]; onPick: (n: NearNotion) => void }) {
  return (
    <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 font-serif text-[12px] leading-snug">
      {near.map((n, i) => (
        /* the dot rides at the end of the name before it, so a line that
           wraps opens on a name, never on a stray dot */
        <span key={n.id} className="inline-flex items-baseline gap-1.5">
          <button type="button" onClick={() => onPick(n)} className="text-brass-400 underline decoration-brass-700/70 decoration-dotted underline-offset-2 transition-colors hover:text-cream-100 focus-visible:text-cream-100">
            {n.topic}
          </button>
          {i < near.length - 1 && (
            <span aria-hidden className="text-cream-100/30">
              ·
            </span>
          )}
        </span>
      ))}
    </p>
  );
}

export default function AskGuide({ className }: { className?: string }) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [thread, setThread] = useState<{ q: string; a: string; near?: NearNotion[] }[]>([]);
  /* the table as it stands answers too, while moves are played and where
     the assistance is on: what can be sold, the purse, the rounds left are
     decision aids — and a finished game has no next payday nor round */
  const game = useGame((s) => s.game);
  const seat = useGame((s) => s.seat);
  const online = useGame((s) => s.code !== null);
  const table = game && game.phase === 'action' && aidOn(game.assist, online) ? { g: game, me: seat ?? Math.max(0, game.players.findIndex((p) => !p.isBot)) } : null;
  /* a sheet of the left edge, like the notebook: one of them at a time */
  const sheet = useLayer(open, () => setOpen(false), { zone: 'left' });
  const reserve = useDockReserve();
  const insets = useHudInsets();
  const passages = useMemo(() => passagesOf((dictOf(lang) as { rules?: unknown }).rules), [lang]);
  /* the newest answer is the one in view, like the guide's own lane */
  const lane = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = lane.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread, open]);
  const put = () => {
    const q = question.trim();
    if (!q) return;
    setQuestion('');
    const got = answerQuestion(q, table, t, lang, passages);
    /* what to play is the note's to answer, on the reader's turn: its
       plate, not this one, carries the machine's move */
    const machine = game?.players.find((p) => p.isBot)?.name ?? '';
    const a = got.intent === 'do' ? t('game.guide.ask.answer.doTool', { ask: t('game.guide.suggest.ask', { name: machine }) }) : got.answer;
    setThread((prev) => [...prev.slice(-5), { q, a, near: got.near.length ? got.near : undefined }]);
  };
  /* a notion taken up from the ones offered: asked by its name */
  const takeUp = (n: NearNotion) => setThread((prev) => [...prev.slice(-5), { q: askedAs(n), a: tell(n.id, lang) }]);
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-pressed={open} title={t('game.guide.ask.open')} aria-label={t('game.guide.ask.open')} className={cn(className, open && '!border-brass-400 !opacity-100')}>
        <MessageCircleQuestion className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            key="ask-guide"
            ref={sheet}
            tabIndex={-1}
            initial={{ opacity: 0, x: -8, y: '-50%' }}
            animate={{ opacity: 1, x: 0, y: '-50%' }}
            exit={{ opacity: 0, x: -8, y: '-50%' }}
            transition={{ duration: 0.16 }}
            role="dialog"
            aria-label={t('game.guide.ask.open')}
            className="plate fixed z-[70] flex w-[340px] flex-col p-3 shadow-e4"
            style={{ ...leftSheetStyle(reserve, insets.left), maxHeight: `min(60vh, 520px, ${leftSheetStyle(reserve, insets.left).maxHeight})` }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-fell text-[15px] tracking-wide text-brass-400">{t('game.guide.ask.open')}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('game.guide.ask.close')} className="rounded p-1 text-cream-100/50 hover:bg-coal-800 hover:text-cream-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div ref={lane} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {thread.length === 0 && <p className="font-serif text-[12.5px] leading-snug text-cream-100/60">{t(table ? 'game.guide.ask.hintTable' : 'game.guide.ask.hint')}</p>}
              {thread.map((m, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <p className="ml-6 rounded-md border border-bottle-600/50 bg-bottle-600/10 px-2.5 py-1.5 font-serif text-[12px] text-bottle-400">{m.q}</p>
                  <div className="rounded-md border border-brass-700/40 bg-coal-900/70 px-2.5 py-1.5">
                    <p className="font-serif text-[12.5px] leading-snug text-cream-100/85">{m.a}</p>
                    {m.near && <NearList near={m.near} onPick={takeUp} />}
                  </div>
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                put();
              }}
              className="mt-2 flex shrink-0 items-center gap-2"
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t('game.guide.ask.placeholder')}
                aria-label={t('game.guide.ask.placeholder')}
                autoFocus
                onKeyDown={(e) => e.stopPropagation()}
                className="min-w-0 flex-1 rounded-md border border-brass-700/60 bg-coal-900/90 px-3 py-1.5 font-sans text-[12px] text-cream-100 placeholder:text-cream-100/55 focus:border-brass-400"
              />
              <button type="submit" disabled={!question.trim()} aria-label={t('game.guide.ask.send')} title={t('game.guide.ask.send')} className="btn-strike !min-h-[32px] shrink-0 !px-3 !py-1 !text-[10px] disabled:opacity-40">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
