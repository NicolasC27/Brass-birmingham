# Blackrail — Brass: Birmingham in the browser

A faithful, single-page implementation of the board game *Brass: Birmingham* (Roxley Games, 2018): two eras on the Midlands map, canals then rails, coal and iron markets, merchants, beer, loans, and the full end-of-era scoring. Play solo against heuristic bots or hot-seat around one screen.

The board is rendered with WebGL (PixiJS) on a painted map; the rules engine is pure TypeScript with no framework dependency, so it can be unit-tested headlessly and reused by a server later.

## Features

- **Official rules.** Deck sizes and 10 / 9 / 8 rounds per era for 2 / 3 / 4 players, £17 start, the 100-space income track with its levels, turn order by money spent, merchant tiles dealt at setup, markets that only refill when a mine or iron works is built, overbuilding, multi-tile sales, double rails, link scoring by link icons, the canal-only beginner variant. The rules reference the engine follows is `brass/game-data.md`.
- **Bots** with three temperaments, tuned with a headless simulator so they sell, borrow sensibly and keep their networks connected.
- **Board.** Two map paintings to choose from in the settings (etched terrain or painted canals), owner-coloured canals and rails, animated barges and locomotives, merchants as framed paintings with their dealt tiles and beer barrels, a minimap with every player's network.
- **HUD.** Straight victory-point and income tracks that zoom under the wheel, a pinnable hand dock, turn-order preview on the player rail, a player's card from the portrait, towns pinned with a note, a minimap resized by its corner, a focus view on one key (V), an in-game rules codex, French and English.
- **Prepared moves.** While others play, a move can be planned as usual and kept for one's turn (two at most, the second planned on what the first leaves), with a clause if wanted — 'unless anyone builds at Stoke', written with three brass blanks (who, deed, where, the place pickable on the map) or taken ready-made (the slot taken, the link laid, the merchant sold to) — dropped when the ledger says it happened. One key (O) surveys the orders on the board, or one's whole empire, over a night-ink table. It plays after a beat when the turn comes, if the engine still takes it.
- **Between players.** Telegrams: a dozen printed lines wired to the table (praise, a grumble about beer, some Midlands jibes of the 1800s), shown as a plaque under the sender's card, no free text, one every twenty seconds, any seat can be muted, and at home the bots wire back. A right-click marks a place on the map for everyone. The Midlands Gazette prints three headlines on every round played. At the end, titles from the tally, the record against opponents met before, and a glass raised with the table.

## Getting started

Requirements: Node.js 20 or newer.

```bash
cd app
npm install
npm run dev
```

Then open `http://localhost:3000`. `npm run build` produces a static bundle in `app/dist`, `npm run lint` runs ESLint.

In development the browser console holds the table: `__brass.getState()` reads the store, and `__brassRail()` jumps a home game straight to the Rail Era (canal scoring, sweep and re-deal played out on the spot) to look at the second painting without playing nine rounds.

### Playing online

Tables live in the browser by default: open a second tab and it plays the guest. To play across machines, run the table server and point the app at it.

```bash
cd app
npm run server                       # ws://localhost:8787
echo 'VITE_ONLINE_URL=ws://localhost:8787' > .env.local
npm run dev
```

`PORT`, `HOST` and `BLACKRAIL_DB` (the register file, `brassworks.db` by default) configure the server.

An account is opened with an e-mail address, and the tables open once the address has answered its letter. The post goes through [Resend](https://resend.com) when `RESEND_API_KEY` is set (`MAIL_FROM` is the sender, `APP_URL` the address the links point at — the app, not the server). Without a key the letters are printed on the server's console and kept at `http://localhost:8787/letters`, enough for a house on one machine: follow the link by hand.

The suggestion box (the **Ideas** chip on every page) goes to the house: each idea or bug is kept in the register, written to `feedback.md` next to it (`FEEDBACK_FILE` moves the book) and readable at `http://localhost:8787/feedback`; with `FEEDBACK_TO` set it is posted to that address too. A build with no server sends it as a plain e-mail when `VITE_FEEDBACK_EMAIL` names one.

The members talk on the club's Discord: with `VITE_DISCORD_URL` set at build time (the invitation link), the header shows a **Discord** entry that opens it. The site keeps no conversation of its own.

### Privacy and security

The register keeps as little as it can, and seals what it keeps. Passwords are scrypt hashes; session tokens and the links in the letters are hashed at rest, so a copy of `brassworks.db` opens no session and resets no password (an older register is sealed on first start). A password everybody tries, or one that carries the member's own name, is refused. After eight wrong passwords for a name from one address (forty from everywhere) the door waits a quarter of an hour. The socket is only opened to pages served from the app's own origin (`APP_URL`, plus any in `BLACKRAIL_ORIGINS`, comma-separated), this machine and the desktop app; behind a reverse proxy set `TRUST_PROXY=1` so the addresses come from `x-forwarded-for`.

Members accept the privacy policy when they sign up, and the date is kept. What the law asks of a host is kept and no more: the address an account was opened from, and the name and address of a closed account, five years apart from everything, then erased. Every member can take everything the register holds under their name as one file (**Download my data** on the profile) and close the account on their word (**Close my account**): what identifies them goes at once, their games stay under a number so the others' records still read.

The legal notice and the privacy policy live at `/legal`, in the four languages, and name the house from the build's environment: `VITE_LEGAL_OPERATOR` (who publishes the site), `VITE_LEGAL_CONTACT` (the address requests and reports go to), `VITE_LEGAL_HOST` (the hosting company and its address). Put them in `.env.local` beside the app. The policy discloses the processors (Resend for the letters, Google Fonts for the type, Discord for the club's talk) and the members' rights; bump `POLICY_DATE` in `app/src/pages/Legal.tsx` when its text changes. Serve the app over HTTPS and the server over WSS, with the usual headers from the reverse proxy (`Strict-Transport-Security`, a `Content-Security-Policy` that allows `wss:` to the server and `fonts.googleapis.com` / `fonts.gstatic.com`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`); the server's own pages already carry them.

### The watch

The server holds the whole truth and applies every move through the engine, so a client can neither play a card it does not hold nor see a hand that is not its own: a seat receives the deck and the other hands face down, the seed struck out, and a spectator sees no hand at all (`server/view.ts`, checked by a test). What is left is the human kind of cheating, and the house keeps a small watch on it (`server/watch.ts`):

- the ranked line never seats two accounts whose sockets come from the same address at one table (a household plays quick games together, not ranked ones);
- two accounts that keep meeting stop weighing on each other's cote after four ranked games in a season, and the pair is noted;
- a human seat that opens twelve turns in a row in under a second and a half is noted.

The marks are kept in the register and read at `http://localhost:8787/flags` from the server's own machine, or with the token `FEEDBACK_TOKEN` names. Nothing is banned by the machine: the house reads the page and decides.

### The desktop app

The same app ships as a native window through [Tauri](https://tauri.app): the web bundle inside the system's webview, a 40 MB binary, no browser chrome. It needs the Rust toolchain and, on Linux, `webkit2gtk-4.1`.

```bash
cd app
npm run desktop                      # a dev window over the Vite server
npm run desktop:build                # src-tauri/target/release/bundle/
```

The build bakes `VITE_ONLINE_URL` from `.env.local` in, so set it to the office the desktop app should talk to before building. Each platform builds its own package: `.deb` and AppImage on Linux (`APPIMAGE_EXTRACT_AND_RUN=1` when FUSE is missing), `.msi` and `.exe` on Windows, `.dmg` on macOS.

## Project layout

```
app/src/game/        pure rules engine (engine.ts), data tables (data.ts), bots (bot.ts), zustand store
app/src/online/      tables and seats, the wire protocol, the session, the lobby clients
app/server/          the table server: the register, the hall of tables, a table in play, the switchboard
app/src-tauri/       the desktop shell: window, icons, packaging
app/src/gl/          WebGL board: scene painting (paint.ts), camera, ambiance (traffic, smoke, mist)
app/src/components/  HUD (tracks, hand dock, player rail, merchants on the minimap), rules codex, setup, results
app/src/i18n/        French, English, Spanish and German dictionaries
app/public/          map paintings, tile art, icons
brass/               rules dossier compiled from the rulebook, art direction, layout guide for map art
research/            board geometry research
```

## Contributing

Contributions are welcome, whether it is a rules fix, a better bot, a visual polish or a translation.

1. Open an issue first for anything larger than a small fix, so we can agree on the approach.
2. Fork, branch from `main`, keep commits small and in the Conventional Commits style (`feat(hud): ...`, `fix(engine): ...`).
3. Before opening a pull request, make sure `npx tsc --noEmit -p tsconfig.app.json` and `npm run lint` pass in `app/`.
4. Rules questions are settled by `brass/game-data.md`; if the dossier and the engine disagree, the dossier wins and the engine gets a fix.

Bug reports with a saved game are the most useful: the current game lives in `localStorage` under `brassworks.resume.v1`.

## Status

Solo against bots, hot-seat around one screen, and online tables against the table server, with accounts, tables that outlive a restart and a turn candle the table itself holds. Asynchronous games and a lobby of open tables are the next step.

*Brass: Birmingham* is a trademark of Roxley Games. This is an independent fan project, not affiliated with or endorsed by the publisher.
