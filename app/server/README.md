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

## The waiting list

Before the line opens, the preview (`/avant-premiere`, or the whole site
when the client is built with `VITE_PRELAUNCH=1`) takes addresses over
plain HTTP: `POST /waitlist`, `/waitlist/confirm`, `/waitlist/leave`, from
the origins the socket accepts. Each address gets a letter to answer, in
its own language; one nobody answers for is struck after seven days.

The direction reads the list at `/direction`: the accounts whose verified
address `BLACKRAIL_ADMINS` names (comma-separated). Circulars written there
are cut into one letter per address and posted ten a minute, at most
`MAIL_DAILY_CAP` a day (80 by default, under Resend's free hundred). Every
letter ends with its way out; with `OFFICE_URL` set to the office's public
address, it also carries the one-click `List-Unsubscribe` header the mail
services read.
