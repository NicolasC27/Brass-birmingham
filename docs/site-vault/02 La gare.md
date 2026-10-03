# La gare

Demande de Nicolas : que le site « ne pense pas que c'est un jeu ». Le hall est devenu une gare ; le vocabulaire du jeu (table, siège, ère, tuile) reste intact sur le plateau et dans les règles.

| Avant | Maintenant | Où |
|---|---|---|
| Jouer | Prochain départ / Départs | nav, `/online` |
| Files normale et classée | Quai 1 — omnibus, Quai 2 — express | `Matchmaking.tsx` |
| Rejoindre avec un code | Votre billet / Mon billet | `CodeJoin.tsx`, la une |
| Tables publiques | Tableau des départs | `PublicTables.tsx` |
| Asseyez-moi | Premier départ | idem |
| Comptoir | Buffet de la gare | `/comptoir` |
| Bureau | Bureau du chef de gare | `/desk` |
| Classement | Palmarès des compagnies | `/classement` |
| Créer une table | Affréter un convoi (lettre de voiture) | `/setup` |
| Se connecter | Signer le registre | partout |
| Salon d'attente | Sur le quai | `/online/:code`, `TrainStrip.tsx` |
| Lancer la partie | Donner le départ | salon, lettre de voiture |

Les sons (`gl/sfx.ts`, synthétisés) : `stationBell()` quand l'office compose un train depuis la file, `steamWhistle()` au départ du quai et à la fin de l'arrivée. Sous l'interrupteur son du plateau.

Le billet de la partie (`components/results/Ticket.tsx`) : un canvas dessiné avec les fontes de la page — talon, trajet des deux ères, voyageur, points, tampon « Vainqueur » — téléchargeable ; réimprimable pour toute partie passée depuis l'historique du bureau.

## Le glossaire

`components/platform/GlossMark.tsx` : un « ? » près d'un mot de gare ouvre une bulle (`platform.glossary.terms.<id>`), `/glossaire` les rassemble. Ajouter un terme : la clé dans les quatre dictionnaires, l'id dans `TERMS` de `Glossaire.tsx`, une marque près du mot.

