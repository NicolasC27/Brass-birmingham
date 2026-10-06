# L'office

Le serveur (`app/server/`), un socket par client, SQLite (`server/store.ts`). Ajouts du journal :

## Messages (`src/online/protocol.ts`)

| Client → office | Réponse | Rôle |
|---|---|---|
| `challenge {week}` | `challenge {board}` | la tafel de la semaine |
| `challenge.post {week,id,vp,rank,met,points}` | `challenge {board}` + bureau | un essai lu à la maison |
| `edition {week}` | `edition {edition}` | l'édition du club : parties, la partie de la semaine, le plus assidu, les dernières |
| `companies` | `companies {board}` | les compagnies et leurs victoires de la saison |
| `company.found {name}` / `company.join {id}` / `company.leave` | `companies` + bureau | fonder, adhérer, quitter (rayée si vide) |
| `papers` / `papers.put {kind, body}` | `papers` / `done` | les papiers du compte (≤ 64 k caractères) |
| `guest` | `session` | un compte ouvert d'office pour un navigateur qui n'en a pas ; `signup` sur le même socket le promeut sans changer d'`accounts.id` |
| `home.list` / `home.load {code}` | `home.register` / `home.save` | le registre des parties à la maison, et l'une d'elles entière (graine, donne, journal) |
| `home.open {name, seed, setup}` | `home.dealt {table}` | l'office frappe le code et inscrit la donne |
| `home.act {code, idx, action}` | *(rien)* ou `home.refused` | un coup relu par le moteur avant d'être écrit ; seul un refus revient |
| `home.undo {code, at}` / `home.forget {code}` | `done` | un coup repris, une partie rangée |
| `notes.get {code}` / `notes.put {code, body}` | `notes` / *(rien)* | les punaises et la page du lecteur, par compte et par partie |
| `profile {newsletter}` | `me` | l'édition du lundi par la poste |
| `seasons` / `season {id}` | `seasons` / `season {review}` | les services connus, et le bilan de l'un (`store.seasonReview`) |

`Edition.machines` : ce que chaque machine a gagné et perdu dans la semaine (le portrait). `TablesPage.dispatches` : les dix dernières manchettes des tables en jeu — chaque salle (`TableGame.dispatches`) relit la manche close avec `headlinesFor` (game/gazette.ts).

## Tables ajoutées

`challenges`, `papers`, `mailings` (envois faits une fois), `companies`, `notes` (punaises et carnet, par compte et par partie), colonnes `accounts.companyId`, `accounts.newsletter`, `accounts.guest` et `games.home` / `name` / `ownerId` / `brief` / `updatedAt` (via `GROWTH`).

## Les parties à la maison

`server/home.ts` : le pendant allégé de `hall.ts` — pas de sièges, pas de chandelle. Il garde en mémoire l'état rejoué de chaque partie ouverte, **relit chaque coup avec `applyAction`** avant `appendHomeMove`, évince après une heure de silence et reconstruit par `replay`. À `game-over` c'est lui qui calcule les standings (`tallyGame`) : le navigateur n'est jamais cru sur parole. Le client pilote les machines, l'office ne juge pas la qualité d'un coup de machine — seulement sa légalité.

Une partie à la maison entre dans `historyFor` (l'onglet Historique) mais sort de `statsFor` et de l'édition du lundi : elle fausserait toutes les moyennes. Elle part avec le compte à sa fermeture, et figure dans l'export RGPD. Le `brief` (ère, manche, sièges) est la seule chose dérivée gardée sur disque, pour que le registre se liste sans rejouer un coup.

## Le lundi et le télégraphe

`server/edition.ts` écrit l'édition en français à partir du dictionnaire `fr`. Toutes les 10 min (`editionEvery`), `index.ts` regarde si la semaine passée a été envoyée (`claimMailing('edition:<semaine>')`) ; sinon : Discord (`server/discord.ts`, `DISCORD_WEBHOOK_URL`, paquets de 8 lignes/minute) et courriel aux abonnés vérifiés (`store.subscribers()`, via le courrier existant : Resend ou console).
