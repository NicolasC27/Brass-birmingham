# La statistique qui ne valait jamais zéro

Le 30 septembre 2026. Une seule erreur, dans une ligne de calcul écrite une fois et recopiée partout, a rendu muettes trois portes de décision sur quatre. Cette note dit laquelle, comment elle se manifestait, et les quatre pièges voisins découverts en la corrigeant.

## La ligne

```ts
diff = scores[moi] - Math.max(...scores des rivaux)
```

Ma marge sur le **meilleur** rival. Elle paraît naturelle : c'est l'écart qui décide de la victoire. Mais à quatre joueurs, le meilleur de trois adversaires est systématiquement au-dessus de n'importe quel joueur pris seul. Mesurée avec **la même lecture des deux côtés**, elle rend :

| Statistique | Valeur mesurée | Valeur attendue |
|---|---|---|
| sur le meilleur rival | **−11,4 ± 2,7** | 0 |
| contre sa propre table | −0,1 ± 2,7 | 0 |
| appariée sur la donne | −0,1 ± 1,5 | 0 |

Douze points de biais structurel. Aucun réglage, aucune force, aucun réseau n'y change rien : c'est la forme de la statistique.

## Ce que ça a cassé

**`train.ts` n'a jamais promu personne.** La porte demandait `diff >= 1`. Il fallait donc un écart de treize points pour passer. Le journal d'entraînement le confirme : **zéro promotion** sur toute son histoire, et des marges toutes comprises entre −4,6 et −15,8. Le sélecteur évolutionnaire tournait à vide depuis le début.

**La seconde clause de `learn.ts` était morte.** La porte s'écrivait `(part >= 0,33 || (part >= 0,29 && diff >= 0))`. La seconde moitié ne pouvait jamais se déclencher. Restait `part >= 0,33` sur 48 parties — soit 1,3 écart-type au-dessus de la par de 0,25, donc **un réseau strictement neutre sur dix franchissait la porte par chance**. Une boucle qui adopte du bruit dérive au lieu de monter.

**Le duel du ranker se lisait comme une déroute.** Chaque duel affichait « −11,5 points sur le meilleur rival » et concluait à l'échec du classement des coups. Apparié, à 800 ms, le même réglage donne **+0,08 ± 0,55** : il ne coûte rien. Et quand le temps économisé sert à chercher plus loin, **+4,01 ± 2,05 sur 120 donnes** — significatif. Deux ans d'hypothèse enterrée par une soustraction.

## Les trois lectures, et laquelle choisir

- **Sur le meilleur rival.** Biaisée de −12. Inutilisable pour une porte centrée sur zéro. À ne garder que comme repère de victoire.
- **Contre sa propre table** — mes points moins la moyenne des autres chaises, dans la même partie. Non biaisée, **gratuite** : les rivaux ont joué la même donne, elle s'annule sans jouer de seconde partie.
- **Appariée sur la donne** — chaque donne jouée deux fois, une avec le candidat, une avec le champ seul, et la chaise du candidat lue contre elle-même. Non biaisée et la plus serrée : 1,5 contre 2,7, pour un quart de parties en plus. C'est elle que les portes lisent.

L'appariement rapporte d'autant plus que **les deux lectures se ressemblent** — le cas courant d'une boucle, réseau *k* contre réseau *k−1*. Contre une lecture très différente les parties divergent trop et il ne gagne presque rien.

## Les quatre pièges voisins

- **Regarder plusieurs fois coûte cher.** Un test séquentiel qui peut s'arrêter à huit points de contrôle franchit une borne à 1,645 σ **dix-sept fois sur cent** sur un réseau neutre — pire que la porte plate qu'il remplace. À 2,33 σ on retombe à cinq. Simulé, pas supposé.
- **Un SPRT se calibre sur le bruit, pas sur un souhait.** Une borne à « deux points de mieux » ne conclut jamais quand l'écart-type par donne vaut dix-neuf : il faudrait 548 donnes. Une borne de confiance s'adapte toute seule au bruit mesuré ; le SPRT non.
- **Un témoin aveuglé n'est pas un témoin.** Pour peser une feature, on entraîne deux fois le même corpus, avec et sans. Mettre la colonne à zéro pendant l'apprentissage ne suffit pas : une colonne immobile n'a pas d'écart-type, son échelle tombe au plancher de 1/1000 et ses poids gardent leur tirage initial. Au jeu, la vraie valeur arrive, se divise par ce millième — **0,75 devient 105,3** — et tout sature. Le témoin perd 72 parties sur 96, ce qui se lit comme « la feature vaut trente points ». Il faut annuler les poids et remettre l'échelle à un.
- **Deux fits d'affilée ne sont pas comparables.** La cible du fit est amorcée sur le réseau précédent (`TD_WEIGHT`), lu dans `net-weights.ts`. Un enchaînement qui écrit ce fichier entre les deux fait du second une génération de plus, pas une variante. Symptôme qui l'a trahi : le second prédisait **moins bien** en validation tout en gagnant largement.

## Ce qu'il faut retenir

Avant de juger une idée, faire rendre zéro à l'instrument sur une comparaison dont la réponse est connue : la même lecture des deux côtés. Note 15 le disait déjà pour le bruit. Celle-ci ajoute le biais, qui est pire : le bruit rend indécis, le biais rend **faux**, et une porte biaisée ne se plaint jamais — elle refuse tout en silence, ou accepte tout.

## Repères

- Code : `app/tools/bots/arena.ts` (les trois lectures, l'appariement), `learn.ts` (la porte séquentielle, `BLIND`), `train.ts` (cribler puis confirmer), `distil.ts` (duel et check appariés), `widen.ts` (porter un corpus d'une version de features à la suivante).
- Voir aussi [[15 Mesurer sans se tromper]] pour le bruit, [[17 La chaîne qui ne paie pas]] pour l'hypothèse précédente, et [[07 Ce qui n'a pas marché]] pour le premier trait pesé avec l'instrument réparé — les cartes en main, sans effet — et le crible à quinze minutes qui en découle.
