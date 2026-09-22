# L'état des lieux

Au 22 septembre 2026, après deux jours de mesures sur un banc dont l'exactitude a enfin été vérifiée ([[15 Mesurer sans se tromper]]).

## Le chiffre officiel

Quatre lectures identiques à une même table, recherche non bridée, 32 parties. Personne ne reçoit rien : emplacements, charbon, marchands et bière sont disputés entre égaux.

| Position | Points |
|---|---|
| Vainqueur | **132,7 ± 3,0** |
| Deuxième | 124,5 |
| Troisième | 118,4 |
| Dernier | 111,4 |
| Moyenne de table | 121,8 |
| **Total de la table** | **487** |

Le plus bas vu 92, le plus haut 152. 58 % des sièges passent 120, 5 % passent 140, aucun 160. Aucune table entière au-dessus de 140.

Contre une table faible, à titre de repère : **143,6 points à trois sièges, 125,1 à quatre**.

La cible : **155 à quatre sièges, 175 à trois** ([[14 Ce que fait un expert]]). L'écart est donc d'une vingtaine de points.

## Ce qui a été gagné

Un seul point et demi, et il vient d'une erreur de comptabilité corrigée : l'argent au-delà de ce que les actions restantes peuvent dépenser ne compte plus que pour un vingtième. Le bot finissait ses parties avec trente-cinq livres en main tout en ayant emprunté à l'ère du rail.

Le reste des gains apparents des deux derniers jours n'était pas du jeu mais de la mesure : le bot valait déjà 149,7 points à deux sièges quand la jauge en annonçait 134.

## Ce qui est mort, et mesuré comme tel

| Piste | Verdict |
|---|---|
| Régler les poids de l'évaluation | Sept leviers, 96 parties chacun, ±2 points : **aucun gain**. Optimum local. |
| Ouvertures scriptées | **−15 à −19 points**. Un script décide sans regarder la main. |
| Chercher plus profond ou plus longtemps | Plat, budget non mordant compris. |
| Élaguer avec une politique apprise | −11 points en filtre dur. |
| Plus de données pour le réseau de valeur | 2,5× les données, +3 points de justesse, rien au score. |
| Forcer les industries qui rapportent | Fait perdre des points ; le refus du bot est rationnel. |

## Ce qui reste

Les deux jours disent la même chose de six façons : **une lecture du plateau écrite à la main a donné tout ce qu'elle avait**. Ni ses coefficients, ni des règles ajoutées par-dessus, ni davantage de recherche ne produisent de points.

Ce qui n'a pas été essayé et qui reste cohérent avec les mesures :

1. **Un arbre guidé par une politique, avec rebouclage** — le schéma AlphaZero en entier, pas seulement l'arbre. Le nommage des coups existe déjà ([[11 Nommer les coups]]), le prior élague correctement (le bon coup survit 90 % du temps à huit noms sur 27). Ce qui manque est la boucle qui fait progresser la cible. Plusieurs semaines de calcul.
2. **Apprendre sur du jeu fort plutôt que sur soi-même.** Le corpus actuel vient de parties jouées par un joueur glouton ; le réseau ne peut pas apprendre mieux que ce qu'il a vu jouer.
3. **La planification multi-tours**, seule façon de rendre profitable une chaîne construire → relier → brasser → vendre. Le refus du coton, mesuré à 9,5 points d'écart, en est le symptôme direct.

## La leçon de méthode

Rendre le contrôle avant la campagne. Une configuration contre elle-même doit donner zéro. Sans cela, une série de résultats indécis se lit comme une série de mauvaises idées, alors que c'est l'instrument qui est aveugle.
