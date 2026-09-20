# Comment lancer

Tout se lance depuis `app/`.

## Entraîner le cerveau

```bash
TARGET=canal EXPLORE=0.5 GAMES=200 ITERATIONS=20 STRENGTH=1 WORKERS=12 sh tools/bots/learn.sh loop
```

Modes : `loop` (jouer, apprendre, mesurer, encore), `play` (un lot seulement), `fit` (un trio sur les positions présentes), `check` (mesure du trio présent contre la lecture manuelle).

| Variable | Défaut | Sens |
|---|---|---|
| `GAMES` | 200 | parties par lot |
| `ITERATIONS` | 3 | nombre de cycles |
| `STRENGTH` | 0,6 | force des machines pendant les parties écrites (1 = expert, plus lent) |
| `WORKERS` | cœurs − 1 | ouvriers pour jouer |
| `EXPLORE` | 0,5 | part des sièges qui jouent un style tiré au sort |
| `NETS` | 3 | réseaux par trio |
| `EPOCHS` | 30 | passes au plus (l'arrêt anticipé décide) |
| `TD` | 0,5 | poids de la prédiction du trio précédent dans la cible |
| `FIT_ROWS` | 800 000 | positions les plus récentes lues par l'apprentissage |
| `TARGET` | canal | `canal`, `game` ou `mix` (avec `MIX`) — sans effet tant que les parties s'arrêtent au décompte canal |
| `CHECK_GAMES` | 48 | ères de la mesure (24 dans les lancements récents) |

Pour laisser la machine disponible : `nice -n 19 env … sh tools/bots/learn.sh loop` et `WORKERS=12` sur 16 cœurs.

Le journal : `tools/bots/learning.log`. Les positions : `tools/bots/data/positions-*.f32` (ignorées par git ; à supprimer quand on change les traits, elles ne sont plus lisibles). Le cerveau gardé : `src/game/net-weights.ts`, à committer quand une jauge dépasse la version en place.

## Mesurer sans entraîner

L'arène est un module (`tools/bots/arena.ts`) : `playMatch({ games, players, seed, subject, field, search, subjectMode, fieldMode, subjectNet, fieldNet, fieldStrength, canalOnly })`. Un script de mesure se bundle en une ligne :

```bash
./node_modules/.bin/esbuild mon-script.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/mon-script.mjs && node /tmp/mon-script.mjs
```

## Vérifier avant de committer

```bash
rtk tsc --noEmit -p tsconfig.app.json && ./node_modules/.bin/eslint src/game tools/bots --quiet && ./node_modules/.bin/vitest run
```

Le test `search.test.ts` couvre la légalité des coups, le budget, le curseur, l'expert, les traits et l'emballage du réseau.

## Changer les traits

Toute modification de `features()` dans `net.ts` rend les cerveaux existants illisibles : le garde-fou de taille les ignore et la machine lit à la main jusqu'au prochain trio. Il faut vider `tools/bots/data`, remettre `net-weights.ts` à `null` et relancer.

Suite : [[09 Pistes]].
