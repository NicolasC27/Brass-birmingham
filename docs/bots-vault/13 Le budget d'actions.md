# Le budget d'actions

La façon la plus honnête de regarder l'écart qui sépare le bot de 160 points.

## L'arithmétique

Une partie donne à chaque siège **une trentaine d'actions** : deux par tour, sur huit tours de canal et huit de rail, moins la première ronde qui n'en donne qu'une. Mesuré à quatre joueurs : 30,0 actions pour 120,2 points, soit **4,01 points par action**.

Atteindre 160 avec le même nombre d'actions demande **5,33 points par action**, un tiers de plus. Tout ce qui suit découle de là : il n'y a pas de points à gagner en jouant plus, seulement en jouant mieux chaque coup.

## Où elles passent (4 joueurs, 6 parties, expert contre table faible)

| Poste | Actions par partie | Part | Canal / Rail |
|---|---|---|---|
| Liaisons simples | 7,0 | 23 % | 4,3 / 2,7 |
| Liaisons doubles | 3,0 | 10 % | 0,0 / 3,0 |
| Emprunts | 3,5 | 12 % | 1,8 / 1,7 |
| Brasseries | 3,0 | 10 % | 1,5 / 1,5 |
| Ventes | 3,0 | 10 % | 2,0 / 1,0 |
| Charbon | 3,0 | 10 % | 0,8 / 2,2 |
| Manufactures | 2,3 | 8 % | 1,5 / 0,8 |
| Fer | 2,2 | 7 % | 1,2 / 1,0 |
| Développements | 1,5 | 5 % | 1,2 / 0,3 |
| Poteries | 0,8 | 3 % | 0,3 / 0,5 |
| Scouts | 0,5 | 2 % | 0,2 / 0,3 |
| Cotons | 0,2 | 1 % | 0,2 / 0,0 |

**Dix actions sur trente vont aux liaisons**, huit aux industries de soutien qui servent surtout les autres joueurs, trois seulement aux marchandises qui rapportent, trois à les vendre.

Deux anomalies visibles sans interprétation :

- **1,7 emprunt dans l'ère du rail.** Un emprunt tardif coûte du revenu sur les derniers versements et rapporte un argent qu'il ne reste plus assez d'actions pour dépenser.
- **`weakLink` est à zéro**, donc désactivé. C'est le garde-fou contre une liaison posée pour moins de quatre icônes. Il avait été mesuré comme nuisible ([[06 Mesures et résultats]]), mais cette mesure date d'avant la correction du plafond de réflexion ([[12 Le plafond de réflexion]]) et mérite d'être refaite.

## Ce que le mélange d'industries ne dit pas

Il était tentant de conclure que le bot ignore les industries qui rapportent. Trois mesures l'ont démenti.

1. **La poterie n'est pas négligée, elle est rare** : quatre emplacements sur tout le plateau, dans quatre villes. En retourner une par deux parties est presque normal.
2. **Le coton est bien délaissé** (16 emplacements, 0,2 action par partie), mais **le forcer fait perdre des points** : monter `goodsFar` de 0,1 à 0,7 fait tomber le score de 143,3 à 130,8 à trois joueurs et de 126,2 à 116,8 à quatre, sans presque rien changer aux tuiles réellement retournées.
3. **Un tiers des filatures constructibles sont déjà reliées à un acheteur** au moment du choix, donc évaluées à 0,7 et non à 0,1. Le bot les refuse quand même, en jugeant son propre coup meilleur de **9,5 points en moyenne**, et jamais à moins d'un point.

Conclusion : ses alternatives valent réellement davantage à court terme. Le mélange d'industries est un symptôme, et l'agir directement ne fait que déformer une évaluation qui, sur ce point, n'était pas fausse.

## Ce que cela laisse comme pistes

- **Faire monter le rendement par action**, poste par poste, plutôt que de pousser une industrie. Les emprunts tardifs et les liaisons faibles sont les deux candidats visibles.
- **La planification multi-tours**, seule façon de rendre profitable une chaîne construire → relier → brasser → vendre qui coûte trois ou quatre actions avant de payer. La recherche actuelle ne voit que deux actions devant elle.
- **L'évolution sur le score** ([[14 Viser le score]]), qui ajuste les vingt-neuf poids ensemble au lieu de suivre une intuition à la fois.

## Une mise en perspective

À quatre joueurs, 160 points est proche du haut de la fourchette réaliste : le plateau est partagé, chacun dispose de moins d'actions rentables, et les parties d'experts humains se terminent souvent entre 130 et 160. Le bot à 126 contre une table faible est déjà un joueur correct. L'écart demandé est un écart vers le quasi-optimal, pas vers la compétence.
