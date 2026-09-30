# La force du professeur

Le 30 septembre 2026. Le seul levier de la journée qui paie, et il ne touche ni à la recherche ni aux traits : il touche à **qui a joué les parties dont le cerveau apprend**.

## Ce qui était en place

`learn.ts` faisait jouer les machines à **300 ms de réflexion, sans anticipation**, pour remplir le registre. L'expert livré par le jeu réfléchit à **1500 ms avec deux rondes**. Chaque position dont le réseau a jamais appris avait donc été atteinte par un joueur cinq fois plus faible que celui qu'il allait servir.

Un commentaire du fichier le disait depuis des mois — « un réseau ne peut pas dépasser son maître » — sans que personne ne le mesure.

La raison de fond : **ce que vaut une position n'est pas une propriété de la position**, c'est ce que le reste de la partie en fait. Étiquetée à 300 ms, l'étiquette dit à quelle distance finirait un joueur faible. Le réseau apprend alors à lire un plateau comme le lit un joueur faible, quel que soit le nombre de positions qu'on lui montre.

## La mesure

Deux réseaux, **même nombre de positions** (70 900), **même réseau d'amorçage**, même graine, même architecture. Seule la force du joueur qui a rempli le registre diffère.

| | professeur faible (300 ms, sans anticipation) | professeur fort (600 ms, une ronde) |
|---|---|---|
| erreur sur les positions retenues | 7,09 | **6,77** |
| 96 parties appariées | — | **+10,45 ± 2,35** |
| contre sa propre table | — | +9,33 ± 1,95 |
| parties gagnées | — | 41/96 pour une par de 24 |

4,4 écarts-types. C'est le plus gros effet mesuré de la journée, et de loin.

## Pourquoi c'est important au-delà du chiffre

Trois autres leviers ont été mesurés le même jour, avec le même instrument, et n'ont rien donné :

| levier | mesure |
|---|---|
| élaguer la recherche avec le classement des coups | −0,58 ± 0,95 |
| les cartes en main dans les traits | −3,35 ± 2,68 |
| plus de temps de réflexion (1500 ms → 20 s) | +0,2 à +1,0 |

Et la profondeur, qui paie bien (+4,08 ± 2,01 de la profondeur 0 à la profondeur 2), est **déjà embarquée** : le jeu appelle la recherche à pleine force, donc profondeur 2 et 1500 ms.

Autrement dit, tout ce qui touche à la **recherche** est épuisé. Ce qui reste est ce que la note [[07 Ce qui n'a pas marché]] identifiait déjà : ce que le cerveau **voit**, et ce qu'il a **vu jouer**. Les traits n'ont rien donné cette fois ; le registre, oui.

## Mais l'effet ne survit pas à la quantité

Le registre du professeur fort a été porté à **354 500 positions**, de quoi dépasser les 319 050 du faible sur lesquelles le cerveau livré a appris. Trois réseaux fittés dessus, puis 96 parties appariées contre lui :

| | |
|---|---|
| apparié sur la donne | **−1,42 ± 2,28** |
| contre sa propre table | −0,27 ± 1,36 |
| parties gagnées | 17/96 pour une par de 24 |

Les parties ne tranchent pas, et l'estimation penche du mauvais côté. À quantité comparable, **les deux cerveaux se valent**.

Les dix points ne se sont donc pas propagés, et la raison saute aux yeux après coup : dans la mesure qui les a produits, **les deux réseaux étaient affamés**, 70 900 positions chacun. Quand les données manquent, la qualité des étiquettes décide de tout. Quand il y en a assez, le réseau finit par apprendre malgré des étiquettes moyennes, et l'écart se dilue.

L'erreur retenue raconte la même histoire : 6,77 à 70 900 positions du professeur fort, **5,81** à 354 500. C'est la quantité qui a fait le gros du travail.

**La règle qui en sort** : un effet mesuré dans un régime ne se transporte pas dans un autre. Ici l'effet était réel — 4,4 écarts-types — et néanmoins sans portée pratique, parce qu'il avait été mesuré à une taille de registre où personne ne travaille. Avant d'extrapoler un gain, vérifier qu'il tient à l'échelle où il servira.

Question ouverte que cela pose, et qui n'est pas tranchée : à **temps de calcul fixe**, vaut-il mieux beaucoup de positions d'un professeur faible ou peu d'un fort ? Le registre à 300 ms coûte deux fois moins cher par position, donc à budget égal il en donne deux fois plus — et la quantité a visiblement porté davantage.

## La suite naturelle

Si passer de 300 ms à 600 ms avec une ronde vaut dix points, il faut savoir ce que vaut d'aller jusqu'à 1500 ms et deux rondes — le réglage même de l'expert livré. Le registre coûte environ deux fois et demie plus cher par position ; la question est donc de savoir si un professeur encore plus fort compense d'avoir moins de positions.

Ce premier pas a été fait le jour même, et il est raconté ci-dessus : il ne donne rien. La question de 1500 ms et deux rondes garde son intérêt, mais elle doit maintenant se poser à budget de calcul fixe, pas à nombre de positions fixe — sans quoi elle rejoue l'erreur de régime qui vient d'être décrite.

## Repères

- Le réglage est dans `app/tools/bots/learn.ts` : `PLAY_BUDGET` et `PLAY_DEPTH`. Un avertissement sort désormais dans le journal quand le registre est écrit plus faiblement que l'expert livré.
- Un registre porte son nombre de traits dans son nom, et `widen.sh` le fait passer d'une version de traits à une autre dans les deux sens, plutôt que de rejouer des heures de parties.
- Voir [[18 La statistique qui ne valait jamais zéro]] pour l'instrument avec lequel tout ceci a été mesuré, et [[07 Ce qui n'a pas marché]] pour le crible à quinze minutes qui écarte un trait sans jouer une partie.
