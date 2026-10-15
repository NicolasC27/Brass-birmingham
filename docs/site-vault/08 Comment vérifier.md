# Comment vérifier

## Avant un commit

```
cd app
rtk tsc --noEmit -p tsconfig.app.json
rtk tsc --noEmit -p tsconfig.server.json
./node_modules/.bin/eslint <fichiers> --quiet
./node_modules/.bin/vitest run
```

Tests du journal : `src/platform/__tests__/` (almanach, brevets, chronique, courrier — `storage.ts` remplace `localStorage`), `src/game/__tests__/challenge.test.ts`, `server/edition.test.ts`. Le test des pluriels refuse « (s) » : écrire `[n|essai|essais]`.

## Sans tête (headless)

Un essai complet d'une partie : bundler un script avec `esbuild --bundle --platform=node --alias:@=./src`, poser un faux `localStorage`, jouer avec `chooseBotAction`, puis appeler `noteChallenge` / `grantFromGame` / `writeLetter`. Le magasin de l'office se teste en mémoire : `new Store(':memory:')`.

## Les captures

`google-chrome-stable --headless=new --remote-debugging-port=9333` puis un script CDP (patron : `capture.mjs` du scratchpad) : `Network.setUserAgentOverride` avec `acceptLanguage: 'fr-FR'` pour la langue, `Emulation.setDeviceMetricsOverride` pour la largeur, `?theme=dark&arrived=1` dans l'adresse, et de vraies secondes d'attente — `--virtual-time-budget` gèle les entrées Framer, `--lang` est ignoré. Assembler en une page HTML aux images embarquées (≈ 5 Mo à 800 px).

## Le banc d'essai (`/admin`)

Build de développement seulement : la route et le tiroir sont chargés sous `import.meta.env.DEV` (import paresseux), rien n'en arrive dans `dist/`. Code dans `app/src/admin/`, page en français sans passer par les dictionnaires.

- **Scénarios** : une vraie partie à l'office pour le compte en cours (invité compris), jouée par les machines (heuristique, quelques millisecondes le coup) jusqu'au moment choisi — début, milieu, dernière manche, veille du décompte et cérémonie du canal ; début, fin (tuiles retournées), dernier tour du rail ; partie finie. 2 à 4 joueurs, siège du propriétaire, machines, graine. Le journal part d'un bloc par le message `dev.home.play`, que l'office n'entend que lancé avec `DEV_LETTERS=1`, depuis cette machine et sans en-tête de proxy ; chaque coup y est relu par le moteur comme `home.act`. Une seconde environ. « Ranger les parties d'essai » les retire du registre (200 au plus par compte).
- **Table de mixage** : chaque cue, les sons synthétisés, les ambiances, les événements de chaque ère, les airs (seuls ou par le vrai programme), chaque voix par personnage avec sa bulle.
- **Tiroir d'essai** à la table : F9 ou le petit onglet en bas à gauche. Forcer une voix (personnage, ligne, ville, ou au hasard comme la table), un événement, l'air suivant ; poser chaque sorte d'avis dans le carnet ; relancer un scénario à la taille de la table ; montrer les flèches d'approvisionnement d'une construction ; lire l'ordonnanceur du son (`window.__sfx`).
- Tests : `src/admin/__tests__/scenario.test.ts` (où chaque moment s'arrête), `server/__tests__/bench.test.ts` (le message refusé sans `DEV_LETTERS=1` ou derrière un proxy).

## Les pièges

- Le navigateur intégré (pane) gèle les animations quand il est caché : les captures montrent des entrées à mi-course ; vérifier la structure au DOM, le visuel en headless.
- Ses clics synthétiques n'atteignent pas toujours React : tester un formulaire avec `input.click()` / `form.requestSubmit()` en JS.
- `pkill -f` avec un motif présent dans la ligne de commande tue la coquille de l'outil (code 144) : construire le motif en morceaux.

## Le garde-fou visuel

`npm run visual` (depuis `app/`) photographie un horaire fixe de 37 scènes — les huit pages du site en clair et en sombre à 1440 et 1024, la table WebGL (canal, rail, fin du canal, partie finie, une carte choisie puis Construire) — et les pose sur les épreuves de référence. Il tombe (code 1) sur : plus de 0,2 % de pixels changés (×5 pour la table, `VISUAL_THRESHOLD` pour régler), un couple d'encres sous 4,5 (3 en grand texte) absent de la référence, un débordement horizontal nouveau, une utilitaire dont la valeur calculée est nulle, un jeton lu en triplet par `tailwind.config.js` qui n'en est plus un (vérifié au `:root` et dans `.platform-root`). Rapport : `app/tools/visual/out/report.html` (avant / après / différence). `VISUAL_ONLY=table,site-home` restreint l'horaire.

- `npm run visual:update` réécrit les références après un changement voulu ; relire le rapport avant.
- Il ne lance rien : vite (:3000), l'office (:8787) et Chrome sans tête WebGL (:9336) doivent répondre, sinon il dit quoi lancer (code 2).
- Mouvement arrêté : `prefers-reduced-motion` forcé par CDP, animations et transitions à zéro, horloge figée au 15 juin 2026 10 h 30, `<time>` et `[role=timer]` masqués ; on attend deux épreuves identiques avant de photographier.
- Les références (≈ 37 Mo en PNG) restent hors dépôt, dans `app/tools/visual/refs/` (ignoré) : elles dépendent de la base de développement locale, une autre machine aurait d'autres parties et d'autres chiffres. Se les régénérer une fois sur une base saine.
- Les scènes de table ouvrent des parties réelles du registre `app/brassworks.db` (compte Chevalier, codes A6AS, WDR8, C8F3, ZHBV). La session se passe par `VISUAL_TOKEN` ou le fichier ignoré `app/tools/visual/.session` ; sans elle la table montre la porte.
- Re-semer : `app/tools/visual/seed.ts` joue une partie à la maison par les machines jusqu'au moment voulu et l'écrit à l'office, un message toutes les 190 ms (l'anti-flood tolère 6 par seconde). Construire puis lancer : `npx esbuild tools/visual/seed.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=tools/visual/seed.mjs && VISUAL_PASS=… SCENES='[{"name":"canal","seed":1,"until":"…"}]' node tools/visual/seed.mjs`, puis donner les nouveaux codes par `VISUAL_GAMES='{"canal":"XXXX",…}'` et refaire `visual:update`.
