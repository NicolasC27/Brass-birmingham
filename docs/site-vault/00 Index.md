# Le journal de Blackrail — comment le site est fait

Coffre de notes sur tout ce qui n'est pas le plateau : la une, la gare, l'office et ses papiers. Tout ce qui est écrit ici est dans le code au 3 octobre 2026 ; les dates de commit courent d'avance sur l'horloge (voir le pacte de travail).

## Lire dans l'ordre

1. [[01 Le journal]] — la robe : manchette, rail, planches, tickets, la grammaire CSS `gz-*`
2. [[02 La gare]] — le vocabulaire : départs, quais, billets, chef de gare ; ce qui reste au jeu
3. [[03 Le défi de la semaine]] — la donne fixée par la semaine, les conditions, les points, l'office qui tient la tafel
4. [[04 L'almanach et les planches]] — les semaines, les années de l'ère, l'éphéméride, la planche du jour et de nuit
5. [[05 Les papiers]] — brevets, courrier des machines, feuilleton, lignes ; où ils vivent, comment ils suivent le compte
6. [[06 L'office]] — les messages du fil, les tables SQLite, l'édition du lundi, le télégraphe, les compagnies
7. [[07 Le tableau et l'impression]] — le tableau d'affichage, la planche-contact, l'édition papier, l'installation
8. [[08 Comment vérifier]] — tests, capture sans tête, les pièges du navigateur intégré
9. [[09 Journal]] — les étapes, datées

## Repères

- Code : `app/src/components/platform/PlatformShell.tsx` (manchette, rail, colophon), `app/src/pages/Home.tsx` (la une), `app/src/game/challenge.ts` (le défi), `app/src/platform/*` (almanach, brevets, lettres, feuilleton, lignes, papiers, chronique, cours), `app/server/*` (l'office).
- Chaînes : `app/src/i18n/<langue>/platform.ts`, quatre langues, `Dict = typeof en` — chaque clé partout.
- Stockage navigateur : préfixe `brassworks.*` (voir [[05 Les papiers]]).
