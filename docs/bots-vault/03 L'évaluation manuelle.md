# L'évaluation manuelle

Fichiers : `app/src/game/weights.ts` (les nombres), `worth()` et `evaluate()` dans `search.ts` (la formule).

## La formule

Pour un siège, sa **valeur** est une somme de points, les points déjà acquis plus ceux qui viennent :

```
valeur = PV acquis
       + points de liaison si l'ère finissait maintenant
       + points des tuiles retournées
       + Σ tuiles non retournées : gain × chance
       + (argent + revenu × paies restantes) × taux
       − menace du revenu négatif
       + cartes en main quand le deck est vide
       + (siège propre) place pour bouger, accès au marché, prochaine tuile de chaque industrie, emprunts d'ouverture
```

et l'évaluation d'une position pour le siège *i* est `valeur(i) − rival × max valeur(j)`.

## Les termes qui ont compté

| Terme                                                              | Poids                  | Ce qu'il dit                                                                                                                                                                                |
| ------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `incomeOnFlip`                                                     | 0,8                    | un retournement vaut ses points **et** le revenu qu'il fait gagner sur toutes les paies restantes ; l'oublier faisait sous-estimer charbon vendu au marché et forge vidée par développement |
| `goodsServed` / `goodsNoBeer` / `goodsNearly` / `goodsFar`         | 0,7 / 0,4 / 0,35 / 0,1 | chance qu'une marchandise se vende selon qu'un négociant est relié et qu'il y a de la bière                                                                                                 |
| `breweryBase` + `breweryOwnGoods` + `breweryNear`, `brewerySecond` | 0,15 + 0,2 + 0,1, 0,6  | une brasserie se retourne avec les ventes qu'elle sert ; la seconde attend les mêmes ventes (avant : chance fixe, d'où des brasseries empilées)                                             |
| `ironBase` + `ironDrain`                                           | 0,55 + 0,45            | le fer voyage partout et on peut vider sa propre forge en développant                                                                                                                       |
| `coalBase` + `coalDrain` + `coalMerchant`                          | 0,3 + 0,6 + 0,1        | le charbon ne voyage que par les liaisons                                                                                                                                                   |
| `cashFloor` + `cashSlope × fraction restante`                      | 0,05 + 0,4             | une livre vaut de moins en moins de points à mesure que la partie s'épuise                                                                                                                  |
| `earlyLoan`                                                        | 8                      | chacun des deux premiers emprunts pris dans les trois premiers tours d'ère canal : l'ouverture classique, invisible à deux actions d'horizon                                                |
| `developed`                                                        | 0                      | prime par industrie dont la prochaine tuile est de niveau 2+ ; mesurée négative pour l'ère canal, laissée à zéro (l'exploration l'explore)                                                  |

Le paramétrage complet permet à un entraîneur (`tools/bots/train.ts`) de faire évoluer ces poids par auto-jeu ; cette voie a rapporté moins que le cerveau et a été mise de côté.

## Une chose apprise à la dure

Valoriser l'argent davantage (`cashSlope` ×2, ×3) faisait *baisser* les points : la machine thésaurisait. Ce qui marche, c'est de valoriser ce que l'argent **permet** (les emprunts d'ouverture), pas l'argent lui-même.

Voir aussi [[06 Mesures et résultats]].
