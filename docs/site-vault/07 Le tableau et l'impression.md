# Le tableau et l'impression

## Le tableau d'affichage — `/tableau`

Route sans coquille (`Layout.tsx`). Horloge, dix lignes à **volets** (`Tableau.tsx`, `.flap` : une feuille par caractère, `key={c}` — une nouvelle lettre monte une nouvelle feuille qui tourne, `flap-in`), états colorés, dépêches en pied (`.ticker-run`). Se rafraîchit par `useTables` ; réservé aux membres pour le registre (visiteur : volets vides).

## L'édition papier

`@media print` dans index.css : les jetons clairs quoi que montre l'écran, la coquille cachée (`data-print="hide"`, nav, tickets, boutons), colonnes gardées, 12 mm de marge. `Ctrl+P` sur la une.

## Le journal installable

`public/manifest.webmanifest`, icônes 192/512 (du logo), `public/sw.js` enregistré en production seulement (`main.tsx`) : réseau d'abord pour les pages avec repli sur la copie de `/`, copie d'abord pour `/assets/` et les images. Rien de l'office n'est gardé.

## La planche-contact

Voir [[08 Comment vérifier]].
