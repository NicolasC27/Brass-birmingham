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

## Le parloir

`src/online/parlour.ts` (types et règles partagés), `server/store.ts` (tables `lines`, `room_seen`, `silences`), `src/online/talk.ts` (l'état côté navigateur). Trois sortes de salles : `hall` (tout membre vérifié), `friend:<id d'amitié>` (les deux amis, tant que l'amitié dure), `table:<code>` (les sièges parlent, qui regarde la table lit). Une ligne fait 280 caractères au plus, cinq lignes par dix secondes et par compte, 500 lignes gardées par salle, 90 jours au plus ; ce qu'un membre a dit part avec son compte.

| Client → office | Réponse | Rôle |
|---|---|---|
| `say {room, text}` | `done` ou `refused` (`not-found`, `too-long`, `silenced`, `refused`) | une ligne dite ; chaque socket de la salle reçoit `said {line}` |
| `lines {room, before?}` | `lines {room, lines, more}` | une page de cinquante lignes, les plus anciennes d'abord |
| `seen {room, at}` | `unread {rooms}` à chaque socket du compte | lu jusque-là ; `unread` est aussi envoyé à l'ouverture de session (salles d'amis et de tables, jamais le hall) |
| `report {id}` | `done` | une ligne signalée : une marque `line` dans `flags`, lisible sur `/flags` |
| `admin.silence {id, hours}` | `done` | la direction fait taire un compte (0 lève le silence) |

## La liste d'attente

`server/waitlist.ts`, sa propre connexion au même fichier : tables `waitlist` (l'adresse, la langue, la provenance, le jeton de confirmation scellé, le jeton de sortie en clair), `circulars` et `circular_post` (une lettre par adresse, `sentAt`, trois essais au plus). HTTP sans socket : `POST /waitlist` (champ piège `website`, cinq par adresse IP puis une toutes les deux minutes), `/waitlist/confirm`, `/waitlist/leave` (aussi le clic unique RFC 8058). Messages de la direction, refusés à qui n'est pas dans `BLACKRAIL_ADMINS` : `admin.book`, `admin.strike`, `admin.circular` (`trial` : un essai à sa propre adresse), `admin.stop` — chacun répond `admin.book`. Les types partagés et `reach()` (qui compte le public d'une circulaire des deux côtés) sont dans `src/online/waitlist.ts`.

## La trace de la partie guidée

À une table guidée, le navigateur note ce que font les leçons (`components/game/guideTrail.ts`, lu sur le guide au fil du rendu par `useGuideTrail`, plus `leftGuide` quand on quitte le guide) : `shown`, `already`, `passed` (`how` : `deed`, `next` ou `skip`, lu sur la table et la progression par `passedHow`), `later`, `detour`, `left`, `playOn` (`on`/`off`), `finished` (`played`/`abandoned`, les points des deux sièges, la leçon la plus loin atteinte). Chaque événement porte un numéro tiré au hasard avec la table, la leçon, la manche, les actions jouées, les secondes depuis le début de la trace, le genre d'écran (`desktop`, `tablet-landscape`, `tablet-portrait`, `touch`), la langue, la version et la donne — ni compte ni code. Ils partent en `guide.trail` sur le socket de la partie, quarante au plus par trame, une trame par seconde au plus (sauf celle qui part quand la page s'en va) ; la ligne coupée, la page en garde deux cents et réessaie, la boîte d'envoi du socket ne les tient jamais. Un acte fait à la dernière action de la partie est dit sur le décompte qu'elle ouvre ; ce que le décompte final passe de lui-même ne l'est pas. La version est le nom du build (`vite.config.ts`, `buildName` : `VITE_VERSION` si le déploiement en donne un, sinon le jour et le commit), le même que porte le rapport de fautes. L'office les vérifie (`online/guideTrail.eventOf`), n'en prend qu'à un socket connecté (le compte laisse entrer la trame, rien de lui n'est écrit), cent d'un coup par socket puis un par seconde, six cents par adresse puis un toutes les deux secondes, cinq cents par table au plus (`store.keepTrail`, table `guide_trail`, sous le jour d'arrivée et non l'heure : une heure exacte, avec la donne et l'action, retrouverait la partie à la maison et son compte), et les efface après 180 jours (`sweepPrivacy`). Les événements de la leçon 2 portent `course: 'full'` (colonne `course` de `guide_trail`, vide pour la leçon 1) ; le choix au décompte du canal est dit aussi (passer `railChoice`, ou `left` sur elle). La direction les lit résumés (`admin.guide` → `store.guideFunnel`, `online/guideTrail.funnelOf`) sur `/direction/partie-guidee`, une leçon à la fois (le filtre `course`, la leçon 1 par défaut) : chaque leçon dans l'ordre du guide, par écran et par donne, des comptes et des médianes, jamais l'histoire d'une table ; un écran ou une donne lus seuls sur moins de cinq tables (`TRAIL_FEW`) n'en donnent que le nombre. Une table est « perdue » quand elle est sans nouvelles depuis avant-hier. La ligne et la case « Participer » sont sur le Cours du soir et sous le bandeau du bureau (`components/site/TrailNotice.tsx`).

## L'alpha

Le jeu est en ligne, mais ses portes s'ouvrent compte par compte. Chaque compte porte un drapeau `alpha` (colonne `accounts.alpha`, 0 par défaut) ; la direction l'a d'office. Sans lui, un compte vérifié peut signer le registre, mais l'office refuse `no-alpha` à tout ce qui touche aux tables (`create`, `join`, `queue`, `seatme`, `home.open`, et tout ce qui suit le contrôle `verify-first`). `BLACKRAIL_ALPHA_OPEN=1` dans `office.env` ouvre l'alpha à tout membre vérifié, le jour de l'ouverture.

| Client → office | Réponse | Rôle |
|---|---|---|
| `admin.members` | `admin.members {members}` | le registre des comptes (nom, adresse, inscription, vérifié, invité, alpha) |
| `admin.alpha {id, on}` | `admin.members {members}` | la porte ouverte ou fermée à un compte ; le compte reçoit son `me` aussitôt |

Côté site, le build de l'alpha (`VITE_ALPHA=1`, `tools/deploy/deploy.sh` par défaut ; `BLACKRAIL_BUILD=preview` pour l'avant-première seule) sert tout le journal depuis la racine, mais `App.tsx` ne l'ouvre qu'à un `me.alpha` : un inconnu ou un compte sans accès lit la page d'avant-première, avec « Se connecter » dans sa barre et, connecté, un bandeau qui dit que la porte n'est pas encore ouverte. Seuls `/account` et `/direction` restent joignables. La direction ouvre les portes sur `/direction`, panneau « Les comptes ».

## La mesure d'usage (PostHog)

Deux sources, un projet PostHog (cloud EU, Francfort), sans cookie ni rien d'écrit dans le navigateur.

Le site (`app/src/platform/measure.ts`, installé par `main.tsx` et `prelaunch.tsx`) : seulement dans le build, avec `VITE_POSTHOG_KEY` (`app/.env.local`), jamais en développement, sur `localhost`, ni pour un navigateur qui demande Do Not Track ou GPC. `posthog-js` est chargé après l'événement `load`, en `cookieless_mode: 'always'`, sans autocapture, replay, sondages ni réglages venus de PostHog (`advanced_disable_flags`, `disable_external_dependency_loading`) : seul ce que le code nomme part. Les requêtes passent par `/ingest` sur le nom du site (le Caddyfile les relaie vers `eu.i.posthog.com`, sans cookies). `before_send` masque toute adresse du site : jetons (`/account/verify|reset/:token`, `/avant-premiere/confirmer|retrait/:token`), codes (`/game/:code`, `/game/local/:code`, `/online/:code`), requête réduite à `via`, `ref` et `utm_*`, titre retiré ; les pages de la direction ne partent pas. Événements : `$pageview` et `$pageleave` ; à la table (`/game`, `/demo`), lus sur le store `useGame` chargé avec la page : `board opened`, `action begun {verb}` (l'emprunt par sa feuille), `refusal shown {reason}`, `panel opened {panel}` (règles, marché, registre, guide, bilan, revue, loupe, réseau, survol, aperçu d'emprunt, préparation, fin de partie, plateau à soi ou d'un rival), `setting changed` (suivre les machines), `town pinned`, `notebook used`, `telegram sent`, `guide step`, `guide ended`, et `move played` pour la seule démo (l'office ne la voit pas). Le marché, tenu par la page et non par le store, se mesure dans `pages/Game.tsx` (`trackTable`). Chaque événement de table porte `mode` (`home`, `table`, `demo`), l'ère, la manche, et `tutorial`/`course` à la partie guidée.

L'office (`server/measure.ts`, ouvert par `main.ts`) : seulement avec `POSTHOG_KEY` dans `office.env` ; les tests et la machine du développeur n'envoient rien. Un compte y est un HMAC de son id, une partie un HMAC de son code, sous une clé tirée une fois et gardée à côté du registre (`measures.key`, 0600) ; jamais de nom, d'adresse ni de code ; `$geoip_disable` (l'adresse de l'office placerait tout le monde au même endroit). `POSTHOG_SKIP` liste des comptes jamais mesurés (une opposition, la maison). Les lignes partent par paquets de 200 au plus toutes les 10 s vers `/batch/` ; PostHog injoignable, elles attendent (5 000 au plus) ; à l'arrêt, `drainMeasures` vide la file en 5 s au plus. Événements, des sièges humains seulement : `game started {mode, players, machines, characters, era_length, timer, assist, ranked}` (`Home.deal`, `Hall.start`), `move played {kind, era, round, industry, town, double, industries, sales, cards}` (les coups des machines ne comptent pas), `move refused {kind, error}`, `move taken back`, `round reached {era, round}` (une fois par manche, jamais deux après un retour en arrière), `game finished {place, won, vp, players, minutes}` et `game abandoned {era, round, minutes, conceded}` (une partie à la maison rangée avant sa fin, un siège quitté, une table abandonnée d'un commun accord).

Côté PostHog, deux réglages du projet : **Cookieless server hash mode** (Settings → Web analytics), sans quoi tout ce que le site envoie est jeté, et **Discard client IP data**, que la politique promet.
