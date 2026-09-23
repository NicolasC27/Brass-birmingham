# La chaîne qui ne paie pas

Le 23 septembre 2026, après deux jours de mesures, une hypothèse centrale s'est révélée fausse. Cette note existe pour qu'on n'y revienne pas.

## L'hypothèse

L'écart au niveau humain croît avec le nombre d'actions que la partie accorde.

| Sièges | Actions | Bot | Humain expert | Écart |
|---|---|---|---|---|
| 4 | 31 | 144,7 | 145-150 | ~0 |
| 3 | 35 | 162,5 | 175-180 | 13 |
| 2 | 39 | 171,6 | ~200 | 27 |

Treize points par tranche de quatre actions, deux fois de suite. J'en avais conclu que le bot ne sait pas employer des actions supplémentaires, faute de conduire un plan sur plusieurs tours : il brûlait 1,8 tuile par partie en développant là où un expert en brûle cinq ou six, et ses plateaux finissaient à peine entamés.

## Ce qui a été construit

`src/game/chains.ts` : quatre lignes de jeu tirées des sources, chacune un **ensemble de tuiles** et jamais un ordre. Interrogé sur une position, le module répond ce que les tuiles manquantes rapporteraient moins les actions qui séparent encore le siège de leur vente. Cinq verrous ferment une ligne — plateau hors d'atteinte, plus d'emplacement, aucun marchand demandeur, plus assez d'actions, et un facteur lu **carte par carte dans la main**. Aucun coup n'est retiré de la liste : c'est une addition à l'évaluation, que la recherche peut contredire.

C'était conçu pour échapper aux deux échecs connus : le livre d'ouverture (−15 à −19) supprimait des coups et ne regardait jamais la main ; le poids de tempo (−7 à −15) payait un avantage de position sans chaîne à y conduire.

## La sonde de comportement, avant tout score

| `chainPay` | Développements | Part de niveau 1 | Déclenchements | Tuiles par vente |
|---|---|---|---|---|
| 0 | 3,3 | 35 % | 50 % | 1,12 |
| 0,7 | 4,1 | 28 % | 48 % | 1,24 |
| 1,2 | 4,6 | 28 % | 50 % | 1,05 |

Les quatre compteurs bougent dans la direction voulue. **Le terme fait ce qu'on lui demande.**

Au passage, cette sonde a corrigé un chiffre périmé : la référence développe déjà 3,3 tuiles et ne construit que 35 % de niveau 1, contre 1,8 et 50 % la veille. Les corrections d'objectif livrées entre-temps avaient déjà déplacé le comportement sans qu'on le cherche.

## Le verdict, 96 parties par case

| `chainPay` | 3 sièges | 4 sièges | Coton retourné à 3 sièges |
|---|---|---|---|
| 0,4 | **−6,1 réel** | +1,1 indécis | 0,7 |
| 0,7 | **−7,7 réel** | +0,7 indécis | 1,1 |
| 1,2 | **−14,4 réel** | −1,7 indécis | 1,1 |

Le bot construit cinq fois plus de coton, il le **vend** — les tuiles sont retournées — et il marque moins. La perte croît avec le poids.

## Ce que cela établit

**Le bot sait conduire une chaîne. Elle ne lui rapporte simplement pas.** Payé pour la mener, il la mène jusqu'à la vente et gagne moins qu'en faisant ce qu'il faisait : du réseau et des industries de soutien. Son refus était rationnel, pour la troisième fois sur ce sujet — après le forçage des marchandises par les poids de retournement, et après l'ouverture scriptée.

La ligne que deux sources humaines indépendantes décrivent comme la meilleure **n'est pas la meilleure pour ce joueur**. Soit son exécution reste en deçà de ce que la ligne suppose, soit l'avantage qu'elle donne à un humain vient d'autre chose que de son rendement direct.

## Ce qui reste vrai, et ce qui ne l'est plus

Vrai : l'écart croît de treize points par tranche de quatre actions. C'est mesuré trois fois.

Plus vrai : l'explication par le déficit de chaîne. Elle était l'interprétation la plus naturelle du fait, elle est réfutée par l'expérience qui la testait directement.

**La question reste entière** : que fait un expert de huit actions de plus, si ce n'est une chaîne de marchandises ? Y répondre demande d'observer des parties humaines fortes action par action, pas d'inventer une quatrième théorie.
