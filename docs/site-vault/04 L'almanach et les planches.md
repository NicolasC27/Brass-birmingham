# L'almanach et les planches

`app/src/platform/almanac.ts`. Semaine 0 = lundi 5 janvier 2026 (`WEEK0`). Chaque semaine est une année de l'ère : `ALMANAC_YEARS` (40 années, 1770 → 1865), `ephemerisOf(week)` donne l'année et la clé `platform.almanac.e<n>` de l'éphéméride. La ligne d'oreille date l'édition dans cette année ; le site ne prononce jamais l'année réelle. `/almanach` imprime les quarante. Les saisons de la cote se nomment « Service d'été 1840 » (server/rating.ts).

## Les planches

La une imprime une gravure selon l'année : le canal avant 1800, le Black Country jusqu'en 1830, le rail après (`PLATES` dans Home.tsx). Chaque planche a son impression de nuit (`plate-night-*.webp`, générées par `tools/assets/fal-plates.sh` avec Flux Pro via fal.ai, sources dans `tools/assets/plates/`, hors dépôt). Les états vides ont les leurs (`empty-tables`, `empty-queue`, jour et nuit — `fal-empties.sh`).

Cadre : `.gz-engraving` ; dérive lente `gz-pan` (28 s, 5 %), coupée sous `prefers-reduced-motion`.

## La carte de partage

`og-card.jpg` (planche de nuit recadrée 1200×630) ; les balises OpenGraph de `index.html` pointent sur `__APP_URL__`, remplacé par `VITE_APP_URL` au build (plugin dans `vite.config.ts`).
