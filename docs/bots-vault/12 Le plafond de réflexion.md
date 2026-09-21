# Le plafond de réflexion

Comment une ligne de code a fait croire pendant trois jours que le bot était plus faible qu'il ne l'est, et que le temps de réflexion ne servait à rien.

## La ligne

`src/game/search.ts`, depuis le commit du 18 septembre qui a créé les quatre personnages et le curseur de force :

```ts
const budget = Math.min(o.budgetMs ?? DEFAULT_BUDGET_MS, dial.budgetMs);
```

L'intention était honnête : à chaque force correspond un temps de réflexion, pour qu'un bot facile soit vraiment plus rapide. Mais le `Math.min` mord **dans les deux sens**. Un appelant qui demandait quatre secondes en recevait une et demie, sans rien dire. Un appelant qui ne demandait rien tombait à 300 ms.

## Ce que cela a faussé

Aucun outil de `tools/bots/` ne nommait de budget. Ni la génération des parties d'auto-jeu, ni le duel de validation, ni la jauge. L'application, elle, en nomme un : 1500 ms pour l'expert (`src/game/store.ts`).

- **Toutes les jauges** ([[06 Mesures et résultats]]) décrivaient un expert à 300 ms, soit un bot que personne ne joue.
- **Toute comparaison de temps** ([[07 Ce qui n'a pas marché]]) comparait le même temps contre lui-même, et concluait fort logiquement à l'absence d'effet.
- **Le corpus du réseau de valeur** a été produit par une recherche cinq fois plus rapide que l'expert réel.

C'est aussi contraire à ce que Nicolas avait demandé : il accepte **jusqu'à une minute par coup**, à condition d'un Web Worker côté navigateur.

## Le correctif

Un budget explicitement demandé est respecté, vers le haut comme vers le bas. Sans budget nommé, le défaut modeste reste, donc le serveur de table joue exactement comme avant.

```ts
const budget = o.budgetMs ?? Math.min(DEFAULT_BUDGET_MS, dial.budgetMs);
```

La jauge de `learn.ts` nomme désormais 1500 ms, et `playMatch` accepte une recherche distincte pour la table adverse (`fieldSearch`) : allonger la réflexion du sujet ne doit pas allonger celle de ses adversaires.

## Ce que le vrai budget donne

L'expert contre une table faible, 30 parties par case, la table figée à 1500 ms. `rival` est le poids qui soustrait le score du meilleur adversaire : à 1 le bot vise l'écart, à 0 son propre total.

| Sièges | `rival` | 1,5 s | 6 s | 20 s |
|---|---|---|---|---|
| 2 | 1 | 149,7 | 149,6 | 149,9 |
| 2 | 0 | 152,0 | 156,4 | **157,2** |
| 3 | 1 | 138,2 | 138,1 | 139,2 |
| 3 | 0 | 139,0 | 139,6 | 139,7 |

Trois enseignements.

1. **Le bot valait déjà 149,7 à deux sièges et 138,2 à trois**, contre 134 et 127 annoncés. Quinze points d'écart n'étaient qu'un défaut de mesure.
2. **Le temps ne paie que si le bot vise son propre score.** À `rival` 1 la ligne est plate ; à `rival` 0 elle monte de cinq points. C'est logique : maximiser un écart est un objectif qui sature vite contre des adversaires faibles, maximiser son propre total offre toujours quelque chose de plus à calculer.
3. **L'objectif était mal aligné avec la cible.** Le repère de Nicolas est le score propre de l'expert ; l'évaluation optimisait l'écart, et le réseau de valeur prédit lui aussi l'écart (`lead` dans `learn.ts`). Les deux devraient viser la même chose que la mesure.

## Ce qu'il reste à faire

- Confirmer sur plus de parties : 30 parties laissent une incertitude d'environ ±4 points, et les écarts en jeu sont de cet ordre.
- Décider du `rival` à livrer. À 0 le bot marque plus mais joue moins agressivement ; contre un humain, l'écart compte peut-être plus que le total.
- Relever le haut du curseur de force au-delà de 1500 ms, ce qui exige **un Web Worker côté navigateur** et un worker côté serveur, sans quoi l'écran et les autres tables gèlent.
- Remesurer les conclusions de [[07 Ce qui n'a pas marché]] qui reposaient sur des temps jamais accordés.
