# La boucle qui tourne

Nuit du 30 septembre au 1er octobre 2026. La première fois que l'auto-jeu boucle vraiment — un meilleur cerveau joue de meilleures parties, dont sort un meilleur cerveau — et la première fois qu'une porte fiable le confirme.

## Le gain

Deux mille parties écrites dans la nuit, **jouées par le cerveau embarqué la veille** et non par celui d'avant. Une lecture fittée sur les 2 233 350 positions du disque. 240 parties appariées contre le cerveau qu'elle remplace :

| | |
|---|---|
| apparié sur la donne | **+3,15 ± 1,02** |
| contre sa propre table | +2,91 ± 0,76 |
| parties gagnées | 76/240 pour une par de 60 |

La borne basse est à +1,47. C'est le deuxième gain embarqué en deux jours, et le plus net.

## Ce qui ne l'a pas produit

**Pas la quantité de positions.** `learn.ts` ne lisait que les 800 000 positions les plus récentes — un plafond `FIT_ROWS` qui ne disait rien pendant que 2,2 millions attendaient à côté. Le lever améliore la lecture de près d'un demi-point et ne change **rien** au jeu :

| | erreur retenue | 400 parties appariées |
|---|---|---|
| 800 000 lignes | 5,73 | — |
| 2 233 350 lignes | **5,28** | −0,28 ± 0,87 |

Un écart-type de 0,87 sur 400 donnes est parmi les mesures les plus serrées du chantier. Elle dit non.

**Pas l'architecture non plus.** Une troisième couche n'apporte rien : `256,128` lit à 5,82 et `256,128,64` à 5,81, sur les mêmes lignes. Et un réseau large coûte cher là où ça compte — 72 µs par lecture pour `128,64`, **181 µs** pour `256,128` — à chaque nœud que la recherche évalue.

Ce qui a changé, c'est **qui a joué les parties dont la lecture apprend**.

## Le piège du plafond muet

Le crible des trois architectures a été perdu parce qu'un remplissage de registre tournait dessous : les nouveaux fichiers poussaient les anciens hors de la fenêtre des 800 000, et les trois fits ont vu des données différentes. Leurs propres lignes de base le disaient — « guessing zero misses by » à 30,32 pour l'un, 29,11 pour les autres — encore fallait-il les lire.

**Deux règles** : ne jamais remplir un registre pendant qu'un fit tourne, et vérifier que deux fits annoncent la même ligne de base avant de comparer leurs erreurs. Le plafond l'annonce désormais avec les deux comptes.

## Le crible de l'erreur retenue : un sur trois

Écrit « deux sur deux » le premier soir. Mesuré trois fois de plus, il ne voit juste que lorsqu'il annonce « rien » :

| essai | erreur retenue | les parties | juste ? |
|---|---|---|---|
| les cartes en main | 6,62 → 6,60, rien | rien | oui |
| l'ordre du tour | 5,81 → 5,64 | −0,69 ± 1,82 | non |
| le plafond de lignes | 5,73 → **5,28** | −0,28 ± 0,87 | non |

**Mieux lire n'est pas mieux jouer.** Le crible fait économiser les essais morts, pas les essais vivants. Détail complet dans [[07 Ce qui n'a pas marché]].

## Où le rendement s'est éteint

| positions | erreur retenue |
|---|---|
| 70 900 | 6,77 |
| 354 500 | 5,81 |
| 1 098 950 | 5,57 |
| 2 233 350 | 5,28 |

La lecture continue de s'améliorer. Le jeu, non : le gain de +2,67 du 30 septembre portait sur 319 000 → 1,1 million, et entre 1,1 et 2,2 millions les 400 parties ne trouvent rien. **Le rendement des données s'éteint autour du million**, et le cerveau embarqué est déjà de l'autre côté.

Ce qui reste : faire tourner la boucle. Chaque cerveau embarqué écrit de meilleures parties pour le suivant, et c'est le seul levier qui ait payé deux fois de suite.

## Repères

- `FIT_ROWS` dans `app/tools/bots/learn.ts` : le plafond, désormais bavard.
- Voir [[18 La statistique qui ne valait jamais zéro]] pour l'instrument, [[19 La force du professeur]] pour l'effet de petite quantité, [[07 Ce qui n'a pas marché]] pour la liste des impasses.
