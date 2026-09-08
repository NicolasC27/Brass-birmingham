# Brassworks — Brass: Birmingham in the browser

A faithful, single-page implementation of the board game *Brass: Birmingham* (Roxley Games, 2018): two eras on the Midlands map, canals then rails, coal and iron markets, merchants, beer, loans, and the full end-of-era scoring. Play solo against heuristic bots or hot-seat around one screen.

The board is rendered with WebGL (PixiJS) on a painted map; the rules engine is pure TypeScript with no framework dependency, so it can be unit-tested headlessly and reused by a server later.

## Features

- **Official rules.** Deck sizes and 10 / 9 / 8 rounds per era for 2 / 3 / 4 players, £17 start, the 100-space income track with its levels, turn order by money spent, merchant tiles dealt at setup, markets that only refill when a mine or iron works is built, overbuilding, multi-tile sales, double rails, link scoring by link icons, the canal-only beginner variant. The rules reference the engine follows is `brass/game-data.md`.
- **Bots** with three temperaments, tuned with a headless simulator so they sell, borrow sensibly and keep their networks connected.
- **Board.** Two map paintings to choose from in the settings (etched terrain or painted canals), owner-coloured canals and rails, animated barges and locomotives, merchants as framed paintings with their dealt tiles and beer barrels, a minimap with every player's network.
- **HUD.** Straight victory-point and income tracks that zoom under the wheel, a pinnable hand dock, turn-order preview on the player rail, an in-game rules codex, French and English.

## Getting started

Requirements: Node.js 20 or newer.

```bash
cd app
npm install
npm run dev
```

Then open `http://localhost:3000`. `npm run build` produces a static bundle in `app/dist`, `npm run lint` runs ESLint.

### Playing online

Tables live in the browser by default: open a second tab and it plays the guest. To play across machines, run the table server and point the app at it.

```bash
cd app
npm run server                       # ws://localhost:8787
echo 'VITE_ONLINE_URL=ws://localhost:8787' > .env.local
npm run dev
```

`PORT`, `HOST` and `BRASSWORKS_DB` (the register file, `brassworks.db` by default) configure the server.

An account is opened with an e-mail address, and the tables open once the address has answered its letter. The post goes through [Resend](https://resend.com) when `RESEND_API_KEY` is set (`MAIL_FROM` is the sender, `APP_URL` the address the links point at — the app, not the server). Without a key the letters are printed on the server's console and kept at `http://localhost:8787/letters`, enough for a house on one machine: follow the link by hand.

The suggestion box (the **Ideas** chip on every page) goes to the house: each idea or bug is kept in the register, written to `feedback.md` next to it (`FEEDBACK_FILE` moves the book) and readable at `http://localhost:8787/feedback`; with `FEEDBACK_TO` set it is posted to that address too. A build with no server sends it as a plain e-mail when `VITE_FEEDBACK_EMAIL` names one.

Signed in, the desk (`/desk`) lists your tables with whose move it is first, the invitations waiting for you, your past games and what they add up to; the record (`/profile`) holds your address, a motto, a favourite colour and the password. A table is a four-letter code: open one, hand the code around or ask a player by name from the room, and the letter lands on their desk.

The server holds the whole truth. It applies every action through the engine, keeps the log, plays the mechanical seats, burns the turn candle, and sends each player a state with the other hands, the deck and the seed struck out. A seat belongs to an account: the office signs you in and hands the browser a session token, so a reload — or a server restart — gives you your chair, your hand and your turn back. Accounts, tables and logs live in SQLite (the one that ships with Node: no dependency, no native build); a game is stored as its seed and its moves, and replaying them is how a table comes back.

Over a wire that is not `wss://`, a password crosses in clear: put the server behind TLS before letting anyone but yourself sign in.

`npm test` plays a full four-handed game through a real socket, restarts the server mid-game, and lets a candle burn out.

## Project layout

```
app/src/game/        pure rules engine (engine.ts), data tables (data.ts), bots (bot.ts), zustand store
app/src/online/      tables and seats, the wire protocol, the session, the lobby clients
app/server/          the table server: the register, the hall of tables, a table in play, the switchboard
app/src/gl/          WebGL board: scene painting (paint.ts), camera, ambiance (traffic, smoke, mist)
app/src/components/  HUD (tracks, hand dock, player rail, merchants on the minimap), rules codex, setup, results
app/src/i18n/        French and English dictionaries
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
