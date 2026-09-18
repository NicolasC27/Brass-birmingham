import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Flag, Lock, LockOpen, MessageSquare, Pencil, Pin, PinOff, Quote, ShieldCheck, UserX } from 'lucide-react';
import PageShell, { Field, Panel, Refusal, inputClass } from '@/components/site/PageShell';
import Button from '@/components/platform/Button';
import EmptyState from '@/components/platform/EmptyState';
import { isOnline } from '@/online/lobby';
import { forumBoards, forumEdit, forumMod, forumOpen, forumReply, forumReport, forumReports, forumSeen, forumThread, forumThreads, forumTranslate, useForumTick, useSession, useStranger } from '@/online/session';
import type { Me } from '@/online/table';
import { BODY_MAX, EDIT_MS, MODS_OPEN, REPORT_MAX, REPORT_REASONS, TITLE_MAX, isBoard } from '@/forum/types';
import type { BoardKey, BoardSummary, ModAction, Post, Rendered, Report, ReportReason, ThreadRow, TranslationSpend } from '@/forum/types';
import { parse, quoted } from '@/forum/markup';
import type { Inline } from '@/forum/markup';
import { offends } from '@/forum/words';
import { useLang, useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* The forum — the members' room at the club.                          */
/*                                                                     */
/* Four pages on one wire: the boards, a board's threads, a thread and */
/* its posts, the moderators' queue. Everything is asked of the office */
/* and asked again when it says the forum moved; nothing is guessed.   */
/* Text only, drawn by the page from a few marks (markup.ts); the      */
/* doorman (words.ts) is consulted before a post leaves, and again at  */
/* the door. The frame is the club's (PageShell), like every page.     */
/* ------------------------------------------------------------------ */

const ease = 'easeOut' as const;
type T = ReturnType<typeof useT>;

/** how long ago, in the club's words */
function since(at: number, t: T): string {
  const s = Math.max(0, Date.now() - at) / 1000;
  if (s < 90) return t('platform.time.now');
  if (s < 3600) return t('platform.time.minutesAgo', { count: Math.round(s / 60) });
  if (s < 86400) return t('platform.time.hoursAgo', { count: Math.round(s / 3600) });
  return t('platform.time.daysAgo', { count: Math.round(s / 86400) });
}

/** the office's refusal in the reader's language */
const KNOWN = new Set(['forum-too-short', 'forum-too-long', 'forum-cooldown', 'forum-locked', 'forum-not-yours', 'forum-edit-window', 'forum-board', 'forum-not-found', 'forum-verified', 'forum-mods-only', 'forum-not-mod', 'forum-reported']);
function explain(e: unknown, t: T): string {
  const code = e instanceof Error ? e.message : String(e);
  if (code === 'forum-words') return t('platform.forum.errors.forum-words-server');
  return KNOWN.has(code) ? t(`platform.forum.errors.${code}`) : t('platform.forum.errors.generic');
}

/** ask the office, and again whenever the forum moves where the page looks */
function useAsked<D>(load: () => Promise<D>, deps: unknown[]): { data: D | null; error: string | null; reload: () => void } {
  const [data, setData] = useState<D | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  const t = useT();
  useEffect(() => {
    let on = true;
    load()
      .then((d) => {
        if (!on) return;
        setData(d);
        setError(null);
      })
      .catch((e) => on && setError(explain(e, t)));
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { data, error, reload: useCallback(() => setN((k) => k + 1), []) };
}

/* ------------------------------ the door ------------------------------ */

/** the forum is for members signed in at the online club */
function useGate(): { session: Me; block: null } | { session: null; block: ReactElement } {
  const t = useT();
  const session = useSession();
  const stranger = useStranger();
  if (session) return { session, block: null };
  const offline = !isOnline;
  return {
    session: null,
    block: (
      <div className="mx-auto max-w-[1240px] px-4 pb-24 pt-10 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease }} className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
          <UserX size={32} aria-hidden className="text-iron-600" />
          <h1 className="h2-section">{t('platform.forum.stranger.title')}</h1>
          <p className="font-ui text-[13px] text-paper-300">{t(offline ? 'platform.forum.stranger.offline' : 'platform.forum.stranger.copy')}</p>
          {!offline && (stranger || !session) && (
            <div className="mt-2">
              <Button variant="primary" to="/account">
                {t('platform.forum.stranger.signIn')}
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    ),
  };
}

/* ------------------------------ the text ------------------------------ */

function Line({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) => {
        switch (p.k) {
          case 'b':
            return <strong key={i}>{p.s}</strong>;
          case 'i':
            return <em key={i}>{p.s}</em>;
          case 'code':
            return (
              <code key={i} className="rounded bg-lacquer-950/70 px-1 font-mono text-[12.5px] text-brass-300">
                {p.s}
              </code>
            );
          case 'link':
            return (
              <a key={i} href={p.href} target="_blank" rel="nofollow noopener noreferrer" className="text-brass-300 underline decoration-brass-500/50 underline-offset-2 hover:text-brass-200">
                {p.href}
              </a>
            );
          default:
            return <span key={i}>{p.s}</span>;
        }
      })}
    </>
  );
}

/** a post as the page draws it: paragraphs and quotes, nothing else */
function Body({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parse(text), [text]);
  return (
    <div className={cn('font-ui text-[14px] leading-relaxed text-paper-100', className)}>
      {blocks.map((b, i) =>
        b.k === 'quote' ? (
          <blockquote key={i} className="my-2 border-l-2 border-brass-500/60 pl-3 text-paper-300">
            {b.lines.map((l, j) => (
              <p key={j}>
                <Line parts={l} />
              </p>
            ))}
          </blockquote>
        ) : (
          <p key={i} className="my-2">
            {b.lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <Line parts={l} />
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}

/* ------------------------------ the pen ------------------------------ */

function Composer({
  title,
  body,
  onSubmit,
  submitLabel,
  onCancel,
  busy,
  refusal,
}: {
  /** a title field too: opening a thread */
  title?: { value: string; onChange: (v: string) => void };
  body: { value: string; onChange: (v: string) => void };
  onSubmit: () => void;
  submitLabel: string;
  onCancel?: () => void;
  busy: boolean;
  refusal: string | null;
}) {
  const t = useT();
  const [preview, setPreview] = useState(false);
  const left = BODY_MAX - body.value.length;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {title && (
        <Field id="forum-title" label={t('platform.forum.titleLabel')}>
          <input id="forum-title" className={inputClass} value={title.value} maxLength={TITLE_MAX} placeholder={t('platform.forum.titlePlaceholder')} onChange={(e) => title.onChange(e.target.value)} autoFocus />
        </Field>
      )}
      <Field id="forum-body" label={t('platform.forum.bodyLabel')} hint={t('platform.forum.bodyHint', { max: BODY_MAX })}>
        <div className="mb-2 flex items-center gap-2">
          <button type="button" onClick={() => setPreview(false)} className={cn('micro-label rounded px-2 py-1 transition-colors', !preview ? 'bg-enamel-700 text-paper-100' : 'text-iron-400 hover:text-paper-100')}>
            {t('platform.forum.write')}
          </button>
          <button type="button" onClick={() => setPreview(true)} className={cn('micro-label rounded px-2 py-1 transition-colors', preview ? 'bg-enamel-700 text-paper-100' : 'text-iron-400 hover:text-paper-100')}>
            {t('platform.forum.preview')}
          </button>
          <span className={cn('data-text ml-auto text-[11px] tabular-nums', left < 0 ? 'text-rust-400' : 'text-iron-400')}>{t('platform.forum.charsLeft', { count: left })}</span>
        </div>
        {preview ? (
          <div className="min-h-[140px] rounded-lg border border-brass-hairline bg-lacquer-950/40 px-3 py-2">{body.value.trim() ? <Body text={body.value} /> : <p className="font-ui text-[13px] text-iron-600">…</p>}</div>
        ) : (
          <textarea id="forum-body" className={cn(inputClass, 'min-h-[140px] resize-y')} value={body.value} placeholder={t('platform.forum.bodyPlaceholder')} onChange={(e) => body.onChange(e.target.value)} />
        )}
      </Field>
      <Refusal text={refusal} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={busy || left < 0 || !body.value.trim()}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {t('platform.forum.cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}

/** the doorman consulted before the office is: the word he stops, in the reader's words */
const doorman = (text: string, t: T): string | null => {
  const word = offends(text);
  return word ? t('platform.forum.errors.forum-words', { word }) : null;
};

/* ------------------------------ small parts ------------------------------ */

function Pages({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const t = useT();
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-3 py-2" aria-label={t('platform.forum.page', { page, pages })}>
      <Button variant="ghost" className="h-8 px-3 text-[13px]" onClick={() => onPage(page - 1)} disabled={page <= 1} icon={<ChevronLeft className="h-4 w-4" />}>
        {t('platform.forum.prev')}
      </Button>
      <span className="data-text text-[12px] tabular-nums text-iron-400">{t('platform.forum.page', { page, pages })}</span>
      <Button variant="ghost" className="h-8 px-3 text-[13px]" onClick={() => onPage(page + 1)} disabled={page >= pages}>
        {t('platform.forum.next')}
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}

function Initial({ name, mine }: { name: string; mine: boolean }) {
  return (
    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-ui text-[13px] font-semibold', mine ? 'border-signal-400/60 bg-[rgb(var(--signal-400)/.12)] text-signal-400' : 'border-brass-hairline bg-enamel-700 text-paper-300')}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

const Mark = ({ children, tone = 'iron' }: { children: ReactNode; tone?: 'iron' | 'brass' | 'signal' }) => (
  <span className={cn('micro-label rounded px-1.5 py-0.5', tone === 'signal' ? 'bg-[rgb(var(--signal-400)/.14)] text-signal-400' : tone === 'brass' ? 'bg-[rgb(var(--brass-400)/.14)] text-brass-300' : 'bg-enamel-700 text-iron-400')}>{children}</span>
);

/* ============================== the boards ============================== */

export default function Forum() {
  const t = useT();
  const lang = useLang();
  const gate = useGate();
  const tick = useForumTick();
  const mod = !!gate.session?.moderator;
  const boards = useAsked(() => (gate.session ? forumBoards(lang) : Promise.resolve<BoardSummary[]>([])), [gate.session?.id, tick, lang]);
  const queue = useAsked(() => (mod ? forumReports().then((r) => r.reports) : Promise.resolve<Report[]>([])), [mod, tick]);
  if (!gate.session) return gate.block;
  return (
    <PageShell
      eyebrow={t('platform.forum.eyebrow')}
      title={t('platform.forum.title')}
      lede={t('platform.forum.lede')}
      aside={
        mod ? (
          <Button variant="ghost" to="/forum/moderation" icon={<ShieldCheck className="h-4 w-4" />}>
            {t('platform.forum.mod.link')}
            {queue.data && queue.data.length > 0 && <span className="ml-1 rounded-full bg-rust-500 px-1.5 font-mono text-[10px] font-bold leading-[16px] text-paper-100">{queue.data.length}</span>}
          </Button>
        ) : undefined
      }
    >
      <Refusal text={boards.error} />
      <div className="flex flex-col gap-3">
        {boards.data === null && !boards.error && <p className="font-ui text-[13px] text-iron-400">{t('platform.forum.loading')}</p>}
        {boards.data?.map((b, i) => (
          <motion.div key={b.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease, delay: i * 0.04 }}>
            <Link to={`/forum/${b.key}`} className="group block rounded-xl border border-brass-hairline bg-enamel-850 p-5 transition-colors duration-150 hover:border-brass-500/60 hover:bg-enamel-800">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="title-card group-hover:text-brass-200">{t(`platform.forum.boards.${b.key}.name`)}</h2>
                    {b.unread > 0 && <Mark tone="signal">{t('platform.forum.unreadCount', { count: b.unread })}</Mark>}
                  </div>
                  <p className="mt-1 font-ui text-[13px] leading-snug text-paper-300">{t(`platform.forum.boards.${b.key}.desc`)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  <span className="data-text text-[12px] tabular-nums text-iron-400">
                    {t(b.threads === 1 ? 'platform.forum.threadOne' : 'platform.forum.threads', { count: b.threads })} · {t(b.posts === 1 ? 'platform.forum.postOne' : 'platform.forum.posts', { count: b.posts })}
                  </span>
                  {b.last ? (
                    <span className="max-w-[260px] truncate font-ui text-[12px] text-paper-300">
                      {t('platform.forum.lastIn', { title: b.last.rendered ?? b.last.title })} <span className="text-iron-400">· {t('platform.forum.lastBy', { name: b.last.by, when: since(b.last.at, t) })}</span>
                    </span>
                  ) : (
                    <span className="font-ui text-[12px] text-iron-600">{t('platform.forum.empty')}</span>
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </PageShell>
  );
}

/* ============================== the designers' guide ============================== */

/** the guide at the head of the design board: every piece's format, and how to offer one */
function DesignGuide({ empty }: { empty: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(empty);
  const geo = `${typeof window !== 'undefined' ? window.location.origin : ''}/design/geo.json`;
  const sections: { title: string; body: string }[] = [];
  for (let i = 0; i < 20; i++) {
    const title = t(`platform.forum.design.sections.${i}.title`);
    if (title.endsWith(`.${i}.title`)) break;
    sections.push({ title, body: t(`platform.forum.design.sections.${i}.body`, { geo }) });
  }
  return (
    <Panel title={t('platform.forum.design.title')} className="mb-6" tone="paper" meta={<button type="button" onClick={() => setOpen((o) => !o)} className="micro-label text-brass-300 hover:text-brass-200">{open ? '−' : '+'} {t('platform.forum.design.toggle')}</button>}>
      {open ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {sections.map((sec, i) => (
            <section key={i} className={cn(i === 0 && 'lg:col-span-2')}>
              <h3 className="font-fraunces text-[16px] font-semibold text-paper-100">{sec.title}</h3>
              <Body text={sec.body} className="mt-1 text-[13.5px] text-paper-300" />
            </section>
          ))}
        </div>
      ) : (
        <p className="font-ui text-[13px] text-paper-300">{sections[0]?.body.split('\n')[0]}</p>
      )}
    </Panel>
  );
}

/* ============================== a board ============================== */

export function ForumBoard() {
  const t = useT();
  const lang = useLang();
  const gate = useGate();
  const navigate = useNavigate();
  const params = useParams();
  const [search, setSearch] = useSearchParams();
  const board: BoardKey | null = isBoard(params.board) ? params.board : null;
  const page = Math.max(1, Number(search.get('p')) || 1);
  const tick = useForumTick(board ?? undefined);
  const list = useAsked(() => (gate.session && board ? forumThreads(board, page, lang) : Promise.resolve({ page: 1, pages: 1, threads: [] as ThreadRow[] })), [gate.session?.id, board, page, tick, lang]);
  const [opening, setOpening] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  if (!gate.session) return gate.block;
  if (!board) return <PageShell back={{ to: '/forum', label: t('platform.forum.backForum') }} title={t('platform.forum.title')} eyebrow={t('platform.forum.eyebrow')}><Refusal text={t('platform.forum.errors.forum-board')} /></PageShell>;
  const mod = !!gate.session.moderator;
  const mayOpen = gate.session.verified && (!MODS_OPEN.includes(board) || mod);
  const submit = async () => {
    const stop = doorman(title + '\n' + body, t);
    if (stop) {
      setRefusal(stop);
      return;
    }
    setBusy(true);
    setRefusal(null);
    try {
      const id = await forumOpen(board, title.trim(), body.trim(), lang);
      setTitle('');
      setBody('');
      setOpening(false);
      navigate(`/forum/t/${id}`);
    } catch (e) {
      setRefusal(explain(e, t));
    } finally {
      setBusy(false);
    }
  };
  return (
    <PageShell
      back={{ to: '/forum', label: t('platform.forum.backForum') }}
      eyebrow={t('platform.forum.eyebrow')}
      title={t(`platform.forum.boards.${board}.name`)}
      lede={t(`platform.forum.boards.${board}.desc`)}
      aside={
        mayOpen ? (
          <Button variant="primary" onClick={() => setOpening((o) => !o)} icon={<MessageSquare className="h-4 w-4" />}>
            {t('platform.forum.newThread')}
          </Button>
        ) : undefined
      }
    >
      {!gate.session.verified && <p className="mb-4 font-ui text-[13px] text-iron-400">{t('platform.forum.verifyFirst')}</p>}
      {MODS_OPEN.includes(board) && !mod && <p className="mb-4 font-ui text-[13px] text-iron-400">{t('platform.forum.annoncesOnly')}</p>}
      {board === 'design' && <DesignGuide empty={!!list.data && list.data.threads.length === 0} />}
      {opening && (
        <Panel title={t('platform.forum.newThread')} className="mb-6">
          <Composer title={{ value: title, onChange: setTitle }} body={{ value: body, onChange: setBody }} onSubmit={submit} submitLabel={t('platform.forum.open')} onCancel={() => setOpening(false)} busy={busy} refusal={refusal} />
        </Panel>
      )}
      <Refusal text={list.error} />
      {list.data && (
        <>
          <Pages page={list.data.page} pages={list.data.pages} onPage={(p) => setSearch({ p: String(p) })} />
          {list.data.threads.length === 0 ? (
            <EmptyState title={t('platform.forum.noThreads')} icon={<MessageSquare />} mini />
          ) : (
            <ul className="divide-y divide-[rgb(var(--paper-100)/.06)] overflow-hidden rounded-xl border border-brass-hairline bg-enamel-850">
              {list.data.threads.map((th) => (
                <li key={th.id} className={cn('transition-colors duration-150 hover:bg-enamel-800', th.hidden && 'opacity-60')}>
                  <Link to={`/forum/t/${th.id}`} className="flex items-center gap-4 px-4 py-3">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', th.unread ? 'bg-signal-400' : 'bg-transparent')} aria-label={th.unread ? t('platform.forum.unread') : undefined} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        {th.pinned && <Pin className="h-3.5 w-3.5 text-brass-400" aria-label={t('platform.forum.pinned')} />}
                        {th.locked && <Lock className="h-3.5 w-3.5 text-iron-400" aria-label={t('platform.forum.locked')} />}
                        <span className={cn('truncate font-ui text-[14px] font-semibold', th.unread ? 'text-paper-100' : 'text-paper-300')} title={th.rendered ? th.title : undefined}>
                          {th.rendered ?? th.title}
                        </span>
                        {th.lang !== lang && <Mark>{t(th.rendered ? `platform.forum.translatedFrom.${th.lang}` : `platform.forum.writtenIn.${th.lang}`)}</Mark>}
                        {th.hidden && <Mark>{t('platform.forum.hiddenMod')}</Mark>}
                      </span>
                      <span className="mt-0.5 block font-ui text-[12px] text-iron-400">
                        {t('platform.forum.by', { name: th.by.name })} · {t('platform.forum.opened', { when: since(th.createdAt, t) })}
                      </span>
                    </span>
                    <span className="hidden shrink-0 flex-col items-end text-right sm:flex">
                      <span className="data-text text-[12px] tabular-nums text-paper-300">{th.replies ? t(th.replies === 1 ? 'platform.forum.replyOne' : 'platform.forum.replies', { count: th.replies }) : t('platform.forum.noReplies')}</span>
                      <span className="font-ui text-[12px] text-iron-400">{t('platform.forum.lastBy', { name: th.lastBy, when: since(th.lastAt, t) })}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Pages page={list.data.page} pages={list.data.pages} onPage={(p) => setSearch({ p: String(p) })} />
        </>
      )}
    </PageShell>
  );
}

/* ============================== a thread ============================== */

function PostCard({
  post,
  me,
  mod,
  locked,
  rendering,
  pending,
  onQuote,
  onChanged,
}: {
  post: Post;
  me: Me;
  mod: boolean;
  locked: boolean;
  /** the post in the reader's tongue, when the interpreter has rendered it */
  rendering: string | null;
  /** the interpreter is at it */
  pending: boolean;
  onQuote: (p: Post) => void;
  onChanged: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const mine = post.by.id === me.id;
  const foreign = post.lang !== lang;
  const [original, setOriginal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReportReason>('insult');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const mayEdit = mod || (mine && Date.now() - post.createdAt < EDIT_MS);
  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setRefusal(null);
    try {
      await work();
      onChanged();
    } catch (e) {
      setRefusal(explain(e, t));
    } finally {
      setBusy(false);
    }
  };
  const saveEdit = () => {
    const stop = doorman(draft, t);
    if (stop) {
      setRefusal(stop);
      return;
    }
    void act(async () => {
      await forumEdit(post.id, draft.trim(), lang);
      setEditing(false);
    });
  };
  const sendReport = () =>
    void act(async () => {
      await forumReport(post.id, reason, note.trim().slice(0, REPORT_MAX));
      setReporting(false);
      setSent(true);
    });
  return (
    <article id={post.id} className={cn('rounded-xl border border-brass-hairline bg-enamel-850 p-4 lg:p-5', post.hidden && 'border-dashed opacity-80')}>
      <header className="flex items-center gap-3">
        <Initial name={post.by.name} mine={mine} />
        <div className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-ui text-[13px] font-semibold text-paper-100">{post.by.name}</span>
            {mine && <Mark tone="signal">{t('platform.ranking.you')}</Mark>}
            {post.hidden && <Mark>{t('platform.forum.hiddenMod')}</Mark>}
            {mod && post.reports > 0 && <Mark tone="brass">{t('platform.forum.reportedCount', { count: post.reports })}</Mark>}
          </span>
          <span className="block font-ui text-[12px] text-iron-400">
            {since(post.createdAt, t)}
            {post.editedAt && <> · {t('platform.forum.edited', { when: since(post.editedAt, t) })}</>}
          </span>
        </div>
      </header>
      <div className="mt-3">
        {post.hidden && !mod ? (
          <p className="font-ui text-[13px] italic text-iron-400">{t('platform.forum.hidden')}</p>
        ) : editing ? (
          <div className="flex flex-col gap-3">
            <textarea className={cn(inputClass, 'min-h-[120px] resize-y')} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={BODY_MAX} autoFocus />
            <Refusal text={refusal} />
            <div className="flex gap-2">
              <Button variant="primary" className="h-8 px-3 text-[13px]" onClick={saveEdit} disabled={busy || !draft.trim()}>
                {t('platform.forum.save')}
              </Button>
              <Button variant="ghost" className="h-8 px-3 text-[13px]" onClick={() => setEditing(false)} disabled={busy}>
                {t('platform.forum.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Body text={rendering && !original ? rendering : post.body} />
            {foreign && (
              <p className="mt-1 flex flex-wrap items-center gap-2 font-ui text-[11.5px] text-iron-400">
                <span>{t(rendering && !original ? `platform.forum.translatedFrom.${post.lang}` : `platform.forum.writtenIn.${post.lang}`)}</span>
                {rendering ? (
                  <button type="button" onClick={() => setOriginal((o) => !o)} className="text-brass-300 underline decoration-brass-500/50 underline-offset-2 hover:text-brass-200">
                    {t(original ? 'platform.forum.showTranslation' : 'platform.forum.showOriginal')}
                  </button>
                ) : (
                  pending && <span className="italic">{t('platform.forum.translating')}</span>
                )}
              </p>
            )}
          </>
        )}
      </div>
      {!editing && (
        <footer className="mt-3 flex flex-wrap items-center gap-1">
          {!locked && !post.hidden && (
            <button type="button" onClick={() => onQuote(post)} className="micro-label inline-flex items-center gap-1 rounded px-2 py-1 text-iron-400 transition-colors hover:bg-enamel-700 hover:text-paper-100">
              <Quote className="h-3.5 w-3.5" /> {t('platform.forum.quote')}
            </button>
          )}
          {mayEdit && !post.hidden && (
            <button type="button" onClick={() => setEditing(true)} className="micro-label inline-flex items-center gap-1 rounded px-2 py-1 text-iron-400 transition-colors hover:bg-enamel-700 hover:text-paper-100">
              <Pencil className="h-3.5 w-3.5" /> {t('platform.forum.edit')}
            </button>
          )}
          {!mine && !post.hidden && !sent && (
            <button type="button" onClick={() => setReporting((r) => !r)} className="micro-label inline-flex items-center gap-1 rounded px-2 py-1 text-iron-400 transition-colors hover:bg-enamel-700 hover:text-rust-400">
              <Flag className="h-3.5 w-3.5" /> {t('platform.forum.report')}
            </button>
          )}
          {sent && <span className="font-ui text-[12px] text-iron-400">{t('platform.forum.reportSent')}</span>}
          {mod && (
            <button type="button" onClick={() => void act(() => forumMod(post.hidden ? 'unhide' : 'hide', post.id))} disabled={busy} className="micro-label ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-brass-300 transition-colors hover:bg-enamel-700 hover:text-brass-200">
              {post.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} {t(post.hidden ? 'platform.forum.mod.unhide' : 'platform.forum.mod.hide')}
            </button>
          )}
        </footer>
      )}
      {reporting && (
        <form
          className="mt-3 flex flex-col gap-3 rounded-lg border border-brass-hairline bg-lacquer-950/40 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            sendReport();
          }}
        >
          <span className="micro-label text-brass-300/90">{t('platform.forum.reportTitle')}</span>
          <div className="flex flex-wrap gap-2">
            {REPORT_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className={cn('rounded-lg border px-3 py-1.5 font-ui text-[13px] transition-colors', reason === r ? 'border-brass-500 bg-enamel-700 text-paper-100' : 'border-brass-hairline text-paper-300 hover:text-paper-100')}>
                {t(`platform.forum.reportReason.${r}`)}
              </button>
            ))}
          </div>
          <input className={inputClass} value={note} maxLength={REPORT_MAX} placeholder={t('platform.forum.reportText')} onChange={(e) => setNote(e.target.value)} />
          <Refusal text={refusal} />
          <div className="flex gap-2">
            <Button type="submit" variant="danger-ghost" className="h-8 px-3 text-[13px]" disabled={busy}>
              {t('platform.forum.reportSend')}
            </Button>
            <Button variant="ghost" className="h-8 px-3 text-[13px]" onClick={() => setReporting(false)} disabled={busy}>
              {t('platform.forum.cancel')}
            </Button>
          </div>
        </form>
      )}
      {!editing && !reporting && <Refusal text={refusal} />}
    </article>
  );
}

export function ForumThread() {
  const t = useT();
  const lang = useLang();
  const gate = useGate();
  const params = useParams();
  const [search, setSearch] = useSearchParams();
  const id = params.id ?? '';
  const page = Number(search.get('p')) || 0;
  const tick = useForumTick(undefined, id);
  const view = useAsked(() => (gate.session && id ? forumThread(id, page) : Promise.reject(new Error('forum-not-found'))), [gate.session?.id, id, page, tick]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [modBusy, setModBusy] = useState(false);
  /* read up to here: the office keeps it, the board shows nothing new */
  useEffect(() => {
    if (view.data) forumSeen(view.data.thread.id);
  }, [view.data]);
  /* the page in the reader's tongue: what the interpreter has, the rest follows on the next tick */
  const foreign = !!view.data && (view.data.thread.lang !== lang || view.data.posts.some((p) => p.lang !== lang && !p.hidden));
  const rendered = useAsked(() => (foreign && view.data ? forumTranslate(view.data.thread.id, view.data.page, lang) : Promise.resolve<Rendered | null>(null)), [foreign, view.data, lang]);
  if (!gate.session) return gate.block;
  const me = gate.session;
  const mod = !!me.moderator;
  const th = view.data?.thread;
  const reply = async () => {
    if (!th) return;
    const stop = doorman(body, t);
    if (stop) {
      setRefusal(stop);
      return;
    }
    setBusy(true);
    setRefusal(null);
    try {
      const r = await forumReply(th.id, body.trim(), lang);
      setBody('');
      if (r.page !== view.data?.page) setSearch({ p: String(r.page) });
      else view.reload();
    } catch (e) {
      setRefusal(explain(e, t));
    } finally {
      setBusy(false);
    }
  };
  const moderate = async (action: ModAction) => {
    if (!th) return;
    setModBusy(true);
    try {
      await forumMod(action, th.id);
      view.reload();
    } finally {
      setModBusy(false);
    }
  };
  const mayReply = !!th && me.verified && (!th.locked || mod);
  return (
    <PageShell
      back={{ to: th ? `/forum/${th.board}` : '/forum', label: th ? t(`platform.forum.boards.${th.board}.name`) : t('platform.forum.backForum') }}
      eyebrow={th ? t(`platform.forum.boards.${th.board}.name`).toUpperCase() : t('platform.forum.eyebrow')}
      title={rendered.data?.title ?? th?.title ?? t('platform.forum.title')}
      lede={
        th ? (
          <span className="flex flex-wrap items-center gap-2">
            {rendered.data?.title && <span className="block w-full text-iron-400">{t('platform.forum.originalTitle', { title: th.title })}</span>}
            <span>
              {t('platform.forum.by', { name: th.by.name })} · {t('platform.forum.opened', { when: since(th.createdAt, t) })} · {th.replies ? t(th.replies === 1 ? 'platform.forum.replyOne' : 'platform.forum.replies', { count: th.replies }) : t('platform.forum.noReplies')}
            </span>
            {th.pinned && <Mark tone="brass">{t('platform.forum.pinned')}</Mark>}
            {th.locked && <Mark>{t('platform.forum.locked')}</Mark>}
            {th.hidden && <Mark>{t('platform.forum.hiddenMod')}</Mark>}
          </span>
        ) : undefined
      }
      aside={
        mod && th ? (
          <span className="flex flex-wrap gap-2">
            <Button variant="ghost" className="h-8 px-3 text-[13px]" disabled={modBusy} onClick={() => void moderate(th.pinned ? 'unpin' : 'pin')} icon={th.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}>
              {t(th.pinned ? 'platform.forum.mod.unpin' : 'platform.forum.mod.pin')}
            </Button>
            <Button variant="ghost" className="h-8 px-3 text-[13px]" disabled={modBusy} onClick={() => void moderate(th.locked ? 'unlock' : 'lock')} icon={th.locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}>
              {t(th.locked ? 'platform.forum.mod.unlock' : 'platform.forum.mod.lock')}
            </Button>
          </span>
        ) : undefined
      }
    >
      <Refusal text={view.error} />
      {view.data && (
        <>
          <Pages page={view.data.page} pages={view.data.pages} onPage={(p) => setSearch({ p: String(p) })} />
          <div className="flex flex-col gap-3">
            {view.data.posts.map((p) => (
              <PostCard key={p.id} post={p} me={me} mod={mod} locked={!!th?.locked && !mod} rendering={rendered.data?.posts[p.id] ?? null} pending={!!rendered.data && rendered.data.pending > 0} onQuote={(q) => setBody((b) => b + (b && !b.endsWith('\n') ? '\n\n' : '') + quoted(q.by.name, q.body))} onChanged={view.reload} />
            ))}
          </div>
          <Pages page={view.data.page} pages={view.data.pages} onPage={(p) => setSearch({ p: String(p) })} />
          {th?.locked && !mod && <p className="mt-4 font-ui text-[13px] text-iron-400">{t('platform.forum.lockedCopy')}</p>}
          {!me.verified && <p className="mt-4 font-ui text-[13px] text-iron-400">{t('platform.forum.verifyFirst')}</p>}
          {mayReply && (
            <Panel title={t('platform.forum.replyTitle')} className="mt-6">
              <Composer body={{ value: body, onChange: setBody }} onSubmit={() => void reply()} submitLabel={t('platform.forum.reply')} busy={busy} refusal={refusal} />
            </Panel>
          )}
        </>
      )}
    </PageShell>
  );
}

/* ============================== the moderators' queue ============================== */

export function ForumModeration() {
  const t = useT();
  const gate = useGate();
  const tick = useForumTick();
  const mod = !!gate.session?.moderator;
  const queue = useAsked(() => (mod ? forumReports() : Promise.reject(new Error('forum-not-mod'))), [mod, tick]);
  const spend: TranslationSpend | undefined = queue.data?.translation;
  const [busy, setBusy] = useState<string | null>(null);
  if (!gate.session) return gate.block;
  const act = async (id: string, work: () => Promise<void>) => {
    setBusy(id);
    try {
      await work();
      queue.reload();
    } finally {
      setBusy(null);
    }
  };
  return (
    <PageShell back={{ to: '/forum', label: t('platform.forum.backForum') }} eyebrow={t('platform.forum.mod.eyebrow')} title={t('platform.forum.mod.title')} lede={t('platform.forum.mod.lede')} aside={queue.data ? <Mark tone="brass">{t('platform.forum.mod.queue', { count: queue.data.reports.length })}</Mark> : undefined}>
      <Refusal text={queue.error} />
      {spend && <p className="mb-4 font-ui text-[12.5px] text-iron-400">{spend.on ? t('platform.forum.mod.spend', { spent: spend.spent.toFixed(2), budget: spend.budget.toFixed(0) }) : t('platform.forum.mod.spendOff')}</p>}
      {queue.data && queue.data.reports.length === 0 && <EmptyState title={t('platform.forum.mod.queueEmpty')} icon={<ShieldCheck />} mini />}
      <div className="flex flex-col gap-3">
        {queue.data?.reports.map((r) => (
          <article key={r.id} className="rounded-xl border border-brass-hairline bg-enamel-850 p-4 lg:p-5">
            <header className="flex flex-wrap items-center gap-2">
              <Mark tone="brass">{t(`platform.forum.reportReason.${r.reason}`)}</Mark>
              <span className="font-ui text-[12px] text-iron-400">{t('platform.forum.mod.reportedBy', { name: r.by.name, when: since(r.createdAt, t) })}</span>
              <Link to={`/forum/t/${r.thread.id}`} className="ml-auto font-ui text-[12px] text-brass-300 hover:text-brass-200">
                {t('platform.forum.mod.inThread', { title: r.thread.title })}
              </Link>
            </header>
            {r.text && <p className="mt-2 font-ui text-[13px] italic text-paper-300">« {r.text} »</p>}
            <div className="mt-3 rounded-lg border border-brass-hairline bg-lacquer-950/40 p-3">
              <span className="flex items-center gap-2">
                <Initial name={r.post.by.name} mine={false} />
                <span className="font-ui text-[13px] font-semibold text-paper-100">{r.post.by.name}</span>
                <span className="font-ui text-[12px] text-iron-400">{since(r.post.createdAt, t)}</span>
                {r.post.hidden && <Mark>{t('platform.forum.hiddenMod')}</Mark>}
              </span>
              <Body text={r.post.body} className="mt-2" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {!r.post.hidden && (
                <Button variant="danger-ghost" className="h-8 px-3 text-[13px]" disabled={busy === r.id} onClick={() => void act(r.id, () => forumMod('hide', r.post.id))} icon={<EyeOff className="h-4 w-4" />}>
                  {t('platform.forum.mod.hideResolve')}
                </Button>
              )}
              <Button variant="ghost" className="h-8 px-3 text-[13px]" disabled={busy === r.id} onClick={() => void act(r.id, () => forumMod('resolve', r.id))}>
                {t('platform.forum.mod.resolve')}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
