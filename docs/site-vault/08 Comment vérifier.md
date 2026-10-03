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

## Les pièges

- Le navigateur intégré (pane) gèle les animations quand il est caché : les captures montrent des entrées à mi-course ; vérifier la structure au DOM, le visuel en headless.
- Ses clics synthétiques n'atteignent pas toujours React : tester un formulaire avec `input.click()` / `form.requestSubmit()` en JS.
- `pkill -f` avec un motif présent dans la ligne de commande tue la coquille de l'outil (code 144) : construire le motif en morceaux.
