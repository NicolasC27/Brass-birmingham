/* ------------------------------------------------------------------ */
/* The guide's thread: everything already said, oldest first, and what */
/* is still live — the lesson on show, the machine's last move, the     */
/* table's news already read. A live item replaced by a new one is      */
/* filed into the thread, worded as it was when it was read.            */
/*                                                                      */
/* One pure step, `fileThread`, takes the thread and what is live now,  */
/* and hands back the same thread when nothing has moved: the guide     */
/* calls it while it renders and keeps the result only when it is new — */
/* React's own way for state that follows what is shown, with a single  */
/* write where there were six, and none of them to the disk.            */
/* ------------------------------------------------------------------ */

/** a turn of the conversation, kept once it is no longer the live one */
export interface Said {
  key: string;
  kind: 'lesson' | 'bot' | 'news' | 'ask' | 'answer';
  head?: string;
  body: string;
  /** the seat whose move this was, for the look back at the board */
  seat?: number;
}

export interface LiveLesson {
  at: number;
  head: string;
  body: string;
}

export interface LiveBot {
  id: number;
  head: string;
  body: string;
  seat: number;
}

export interface Thread {
  said: Said[];
  lesson: LiveLesson | null;
  bot: LiveBot | null;
  /** the last piece of news filed */
  filed: number;
}

export const EMPTY_THREAD: Thread = { said: [], lesson: null, bot: null, filed: -1 };

export interface LiveNow {
  /** the lesson on show, and its words — asked for only when it is new */
  lesson: { at: number; word: () => { head: string; body: string } } | null;
  /** no lesson on show while the guide goes on — the one left is set
   *  aside till the next round: the last one read is filed */
  rest?: boolean;
  bot: LiveBot | null;
  /** the table's news the reader has already seen */
  news: { id: number; text: string }[];
}

/** the thread once what is live now has been taken in: the same object
 *  when nothing changed */
export function fileThread(th: Thread, now: LiveNow): Thread {
  let next = th;
  const edit = (): Thread => {
    if (next === th) next = { ...th, said: [...th.said] };
    return next;
  };
  if (now.lesson ? th.lesson?.at !== now.lesson.at : now.rest && th.lesson) {
    const n = edit();
    /* a lesson may be filed twice — set aside and back, read again —
       and each filing is its own turn of the thread */
    if (th.lesson) n.said.push({ key: `l${th.lesson.at}.${n.said.length}`, kind: 'lesson', head: th.lesson.head, body: th.lesson.body });
    n.lesson = now.lesson ? { at: now.lesson.at, ...now.lesson.word() } : null;
  }
  if (now.bot && th.bot?.id !== now.bot.id) {
    const n = edit();
    if (th.bot) n.said.push({ key: `b${th.bot.id}`, kind: 'bot', head: th.bot.head, body: th.bot.body, seat: th.bot.seat });
    n.bot = now.bot;
  }
  const toFile = now.news.filter((x) => x.id > th.filed);
  if (toFile.length) {
    const n = edit();
    n.said.push(...toFile.map((x) => ({ key: `n${x.id}`, kind: 'news' as const, body: x.text })));
    n.filed = toFile[toFile.length - 1].id;
  }
  return next;
}

/** a question and its answer, added to the thread */
export function askThread(th: Thread, q: string, answer: string): Thread {
  const at = th.said.length;
  return { ...th, said: [...th.said, { key: `q${at}`, kind: 'ask', body: q }, { key: `a${at}`, kind: 'answer', body: answer }] };
}
