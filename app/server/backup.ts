import { DatabaseSync } from 'node:sqlite';
import { appendFileSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/* The register's copies, kept in a drawer beside the office. A copy is
   pressed with VACUUM INTO on a connection of its own: SQLite writes a
   consistent snapshot even while the tables go on playing, where a raw
   copy of a WAL register mid-write could print half a page.

   BLACKRAIL_BACKUP_DIR    the drawer (default: backups/, beside the app)
   BLACKRAIL_BACKUP_HOURS  hours between two copies (default 6; 0 = none)
   BLACKRAIL_BACKUP_DAYS   daily copies kept (default 7)
   BLACKRAIL_BACKUP_WEEKS  weekly copies kept (default 4) */

const NAME = /^brassworks-(\d{8}T\d{6})\.db$/;

const stamp = (d: Date): string => d.toISOString().replace(/[-:]/g, '').slice(0, 15);
const whenOf = (s: string): Date => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`);
/* the Monday a day belongs to, as its week's name */
const weekOf = (d: Date): string => {
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
  return m.toISOString().slice(0, 10);
};

/** which copies stay in the drawer: the newest of each of the last `days`
 *  days, the newest of each of the last `weeks` weeks, and the very newest */
export function keep(names: string[], days: number, weeks: number): Set<string> {
  const dated = names.filter((n) => NAME.test(n)).sort().reverse();
  const kept = new Set<string>(dated.slice(0, 1));
  const byDay = new Set<string>();
  const byWeek = new Set<string>();
  for (const n of dated) {
    const d = whenOf(NAME.exec(n)![1]);
    const day = d.toISOString().slice(0, 10);
    const week = weekOf(d);
    if (!byDay.has(day) && byDay.size < days) {
      byDay.add(day);
      kept.add(n);
    }
    if (!byWeek.has(week) && byWeek.size < weeks) {
      byWeek.add(week);
      kept.add(n);
    }
  }
  return kept;
}

/** press one copy of the register now; the journal gets a line either way */
export function backupOnce(file: string, dir: string, days = 7, weeks = 4, now = new Date()): string | null {
  mkdirSync(dir, { recursive: true });
  /* the drawer never travels with the repository */
  try {
    writeFileSync(path.join(dir, '.gitignore'), '*\n', { flag: 'wx' });
  } catch {
    /* already there */
  }
  const journal = path.join(dir, 'backups.log');
  const target = path.join(dir, `brassworks-${stamp(now)}.db`);
  const t0 = Date.now();
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(file);
    db.exec('pragma busy_timeout = 5000');
    db.prepare('vacuum into ?').run(target);
    const proof = new DatabaseSync(target, { readOnly: true });
    let games: number;
    try {
      games = (proof.prepare('select count(*) as n from games').get() as { n: number }).n;
    } finally {
      proof.close();
    }
    const names = readdirSync(dir);
    const kept = keep(names, days, weeks);
    const dropped = names.filter((n) => NAME.test(n) && !kept.has(n));
    for (const n of dropped) rmSync(path.join(dir, n), { force: true });
    appendFileSync(journal, `${now.toISOString()}  ok    ${path.basename(target)}  ${statSync(target).size} bytes  ${games} games  ${Date.now() - t0} ms  ${dropped.length} retired\n`);
    return target;
  } catch (e) {
    appendFileSync(journal, `${now.toISOString()}  FAIL  ${String(e).replace(/\s+/g, ' ')}\n`);
    console.error(`backup: ${e}`);
    return null;
  } finally {
    db?.close();
  }
}

/** a copy at the start, then one every few hours; returns the stop */
export function startBackups(file: string): () => void {
  if (file === ':memory:') return () => undefined;
  const dir = process.env.BLACKRAIL_BACKUP_DIR ?? 'backups';
  const hours = Number(process.env.BLACKRAIL_BACKUP_HOURS ?? 6);
  const days = Number(process.env.BLACKRAIL_BACKUP_DAYS ?? 7);
  const weeks = Number(process.env.BLACKRAIL_BACKUP_WEEKS ?? 4);
  if (!(hours > 0)) return () => undefined;
  backupOnce(file, dir, days, weeks);
  const timer = setInterval(() => backupOnce(file, dir, days, weeks), hours * 3_600_000);
  timer.unref();
  return () => clearInterval(timer);
}
