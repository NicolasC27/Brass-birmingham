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

## La suite naturelle

Si passer de 300 ms à 600 ms avec une ronde vaut dix points, il faut savoir ce que vaut d'aller jusqu'à 1500 ms et deux rondes — le réglage même de l'expert livré. Le registre coûte environ deux fois et demie plus cher par position ; la question est donc de savoir si un professeur encore plus fort compense d'avoir moins de positions.

Le premier pas est plus court : le réseau livré aujourd'hui a été entraîné sur 319 000 positions du **professeur faible**. Il en existe 70 900 du fort. Quatre fois moins de données, un professeur deux fois plus fort — à mesurer directement l'un contre l'autre.

## Repères

- Le réglage est dans `app/tools/bots/learn.ts` : `PLAY_BUDGET` et `PLAY_DEPTH`. Un avertissement sort désormais dans le journal quand le registre est écrit plus faiblement que l'expert livré.
- Un registre porte son nombre de traits dans son nom, et `widen.sh` le fait passer d'une version de traits à une autre dans les deux sens, plutôt que de rejouer des heures de parties.
- Voir [[18 La statistique qui ne valait jamais zéro]] pour l'instrument avec lequel tout ceci a été mesuré, et [[07 Ce qui n'a pas marché]] pour le crible à quinze minutes qui écarte un trait sans jouer une partie.
