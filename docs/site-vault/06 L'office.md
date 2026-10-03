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
| `profile {newsletter}` | `me` | l'édition du lundi par la poste |

`TablesPage.dispatches` : les dix dernières manchettes des tables en jeu — chaque salle (`TableGame.dispatches`) relit la manche close avec `headlinesFor` (game/gazette.ts).

## Tables ajoutées

`challenges`, `papers`, `mailings` (envois faits une fois), `companies`, colonnes `accounts.companyId` et `accounts.newsletter` (via `GROWTH`).

## Le lundi et le télégraphe

`server/edition.ts` écrit l'édition en français à partir du dictionnaire `fr`. Toutes les 10 min (`editionEvery`), `index.ts` regarde si la semaine passée a été envoyée (`claimMailing('edition:<semaine>')`) ; sinon : Discord (`server/discord.ts`, `DISCORD_WEBHOOK_URL`, paquets de 8 lignes/minute) et courriel aux abonnés vérifiés (`store.subscribers()`, via le courrier existant : Resend ou console).
