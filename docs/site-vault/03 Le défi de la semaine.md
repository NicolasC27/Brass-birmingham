# Le défi de la semaine

`app/src/game/challenge.ts`. Huit avis (`CHALLENGES`) imprimés à tour de rôle ; la **donne** est fixée par la semaine (`seed = 100003 + semaine × 7919`), donc nouvelle chaque semaine même quand l'avis revient. **Mr Watt** est de chaque avis, à fond.

## Les conditions

Type `Rule` : `win`, `vp`, `loans` (max), `industry` (industrie, niveau, nombre, vendue ?, ère ?), `links` (min, ère ?), `doubleRails`, `income` (niveau, pas la case), `money`, `develops`. Lues sur le siège humain à la clôture par `ruleMet(rule, état, siège, deeds)` — les `deeds` viennent de `deedsOf` (plan.ts), qui rejoue les actions.

Seuils de PV : 130 et 140 (le moteur note comme le vrai jeu, 140–170 est courant ; 150 était « beaucoup à deux » pour Nicolas).

## Les points

PV + 15 par condition tenue + 25 si toutes (`POINTS_PER_RULE`, `POINTS_ALL`).

## Le registre

`brassworks.challenge.v1` : `tables[code] = {week, id, seed}` pour les tables locales ouvertes depuis l'avis, et `attempts[]`. Le magasin du jeu (`game/store.ts`) donne la graine de l'avis à l'ouverture (`challengeSeedFor`, sans guide) et lit le verdict à la fin (`noteHouse` → `noteChallenge`).

## L'office

Message `challenge.post` : l'office garde le meilleur essai par compte et par semaine (table `challenges`) et paie 5 guinées par condition nouvellement tenue, 15 de plus la première fois que tout tient (`GUINEAS.challengeRule/All`). `challenge` renvoie la tafel de la semaine. L'avis renvoie le meilleur essai local à la connexion. Archives : `/defis`.
