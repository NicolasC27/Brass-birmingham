# The office

## Copies of the register

Every game lives in one SQLite file (`brassworks.db`, WAL). On start, then
every `BLACKRAIL_BACKUP_HOURS` hours (default 6, `0` turns it off), the office
presses a consistent copy with `VACUUM INTO` into `BLACKRAIL_BACKUP_DIR`
(default `backups/`, ignored by git). The drawer keeps the newest copy of each
of the last `BLACKRAIL_BACKUP_DAYS` days (7) and of each of the last
`BLACKRAIL_BACKUP_WEEKS` weeks (4); `backups.log` gets one line per copy.

To put a copy back, close the office, then:

    npm run office:restore -- backups/brassworks-20260923T090000.db

It refuses while anything answers on `PORT`, checks the copy's integrity, and
keeps the replaced register as `brassworks.db.before-restore-<time>`.

## Faults from the browsers

Uncaught errors and unhandled rejections in the page are sent to the office
(message, short stack, path, build, browser, time; the account id when signed
in, nothing else), at most five a minute per tab and per socket, each fault
once per tab. Read them at `/faults`, from this machine or with
`?token=` and `FEEDBACK_TOKEN`, like `/flags` and `/feedback`.
