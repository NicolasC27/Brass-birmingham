# Mesures et résultats

> [!warning] Chiffres à relire — mesure faussée jusqu'au 21 septembre 2026
> `searchTurn` plafonnait le temps de réflexion contre le curseur de force : un appel qui ne nommait pas de budget tombait à **300 ms**, un appel qui en demandait plus était rabaissé à 1500 ms. Or aucun outil d'entraînement ni de mesure ne nommait de budget, tandis que l'application donne 1500 ms à son expert.
> Conséquences : **toutes les jauges ci-dessous décrivent un bot bridé à 300 ms**, plus faible que celui qui tourne réellement ; et toute comparaison de temps de réflexion comparait le même temps contre lui-même.
> Remesuré avec le vrai budget : **149,7 points à deux sièges et 138,2 à trois**, contre 134 et 127 ici. Voir [[12 Le plafond de réflexion]].



Toutes les mesures du 19 septembre 2026, dans l'ordre. « Pair » = la part de victoires qu'un siège aurait au hasard (1/4 à quatre).

## La recherche contre l'ancien bot heuristique (4 joueurs, 16 parties)

| Sujet | Victoires | Écart sur le meilleur rival |
|---|---|---|
| Ancien magnat heuristique | 7 / 16 | −1 |
| Recherche sur le tour, évaluation manuelle | 16 / 16 | +44 |

## Le curseur de force contre le champ heuristique (16 parties)

| Force | 0 | 0,25 | 0,4 | 0,55 | 0,7 |
|---|---|---|---|---|---|
| Victoires | 3 | 5 | 10 | 11 | 16 |

## L'anticipation contre des machines à 0,75 (16 parties)

| Sujet | Victoires (pair 4) |
|---|---|
| 0,75 sans anticipation | 3 |
| 0,85, N+1 | 6 |
| 1, N+2 | 6 à 7 |

## Décomposition des points d'ère canal de l'expert (4 joueurs, par siège)

| Liaisons | Tuiles retournées | Actions |
|---|---|---|
| 22 (4,7 liaisons, 4,6 icônes chacune) | 18 (4,3 tuiles, presque toutes de niveau 1) | 6 constructions, 4,7 liaisons, 1,8 ventes, 1 développement, 1,3 emprunts |

## Les cerveaux successifs (mesure : nouveau contre précédent, 24 ères canal à quatre, force 0,7)

| Cycle | Trio | Ères gagnées | Ère canal nouveau / ancien | Gardé |
|---|---|---|---|---|
| Ère canal seule, 128 traits | 1 | 17 / 24 contre la lecture manuelle | 46,3 / 36,5 | oui |
| | 2 | 9 / 24 | 45,3 / 43,6 | oui |
| | 3 | 12 / 24 | 47,7 / 44,3 | oui, **committé** |
| | 4 | 7 / 24 | 46,4 / 45,6 | non |
| | 5 | 8 / 24 | 48,2 / 45,5 | oui |
| | 6, 7, 8 | égalité | | non |
| Force 1, 166 traits, 128×64 | 1 | 16 / 24 contre la lecture manuelle | 46,7 / 37,5 | oui |
| | 2 | 8 / 24 | 42,8 / 41,5 | oui |
| | 3 | 6 / 24 | 45,3 / 43,0 | oui |

Duel du trio 5 contre le trio 3 sur 48 ères : 14 victoires (pair 12), 46,8 contre 46,0 → égalité, le trio 3 reste.

## Les jauges : l'expert à pleine force contre une table faible (points d'ère canal, 6 ères par table)

| Trio | 2 joueurs | 3 joueurs | 4 joueurs |
|---|---|---|---|
| Cerveau v4 (94 traits, matin) | 34 | — | 43 |
| Trio 1 ère canal | 42,3 | 43,3 | 43,5 |
| Trio 2 | 42,2 | 50,2 | 41,8 |
| **Trio 3 (committé)** | **43,5** | **52,3** | **49,7** |
| Trio 5 | 50,7 | 46,0 | 45,5 |
| Force 1, trio 1 | 28,3 | 40,7 | 40,0 |
| Force 1, trio 2 | 44,8 | 44,2 | 42,7 |
| Force 1, trio 3 | 42,7 | 43,2 | 43,0 |

Les rivaux faibles font 17 à 34 selon la table.

## Auto-jeu : moyenne de points d'ère canal par siège (4 joueurs, tous les sièges avec le même cerveau)

33 (sans cerveau) → 41 (v4) → 45 (v4 + emprunts d'ouverture) → 48 (trio 5) ; à force 1 : 36 → 43,5.

## Parties entières : l'expert à pleine force contre une table faible (6 parties par table)

| Cerveau | 2 joueurs (canal / final / gagnées) | 3 joueurs | 4 joueurs |
|---|---|---|---|
| Trio « ère canal » (le rail lu à la main) | 47 / 106 / 5 | 47 / 103 / 4 | 48 / 95 / 2 |
| Trio « partie entière », 1er | 34 / 123 / 6 | 39 / 128 / 6 | 38 / 107 / 5 |
| **Trio « partie entière », 2e (committé)** | 36 / 134 / 6 | 46 / 127 / 6 | 46 / 106 / 3 |

Les termes tirés des guides, mesurés en auto-jeu (12 parties, final moyen) : tempo 1 → 112 contre 109, prêt pour le rail 3 → 113, canal faible → 106 à 111 ; adoptés : tempo 1, prêt pour le rail 3.

## Où on en est face à l'objectif

- Objectif : un bot fort sur la partie entière, 160 points au final pour l'expert, 60 puis 80 à l'ère canal.
- Expert à pleine force contre une table faible : 106 à 134 au final, 36 à 46 à l'ère canal. Un bon joueur régulier ; 160 est le niveau d'un très bon joueur.

Suite : [[07 Ce qui n'a pas marché]].
