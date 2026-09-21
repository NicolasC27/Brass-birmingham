# Nommer les coups

Fichier : `app/src/game/policy.ts` (les noms et le réseau qui les classe), `app/tools/bots/distil.ts` (la distillation), lancé par `distil.sh`.

## Pourquoi

La boucle d'auto-jeu ([[05 La boucle d'auto-jeu]]) plafonne, et ses propres journaux le disent : l'ajustement s'arrête dès la quatrième passe, l'erreur de test ne descend plus sous huit points, et le garde rejette la plupart des candidats. Ce n'est pas un manque de positions — il y en a plus d'un million — mais une cible épuisée. Prédire l'issue de parties jouées par un joueur glouton à deux actions est un problème dont il ne reste rien à apprendre.

Ce qui manque est un **opérateur d'amélioration** : chez AlphaZero, la recherche joue mieux que le réseau, et le réseau apprend la recherche, si bien que la cible progresse à chaque tour. Ici la cible est fixe, donc la boucle tourne en rond. Les mesures de profondeur le confirment : N+0 à N+4 donnent le même score, et quatre secondes par coup ne valent pas mieux qu'une et demie (voir [[07 Ce qui n'a pas marché]]). La recherche ne sait pas quoi faire du temps qu'on lui donne parce qu'elle n'a aucune idée des coups qui méritent d'être regardés.

Un arbre guidé par une **politique** répond à ce manque. Mais avant d'y passer des semaines, il faut savoir si un coup peut seulement être nommé d'une partie à l'autre.

## Les noms

Un coup devient un indice dans un vecteur de 248, fixe pour toujours :

| Famille | Indices | Ce qui distingue |
|---|---|---|
| Construire | 0 à 131 | la ville (22) et l'industrie (6) |
| Liaison simple | 132 à 170 | la liaison (39) |
| Liaison double | 171 à 209 | la première liaison (39) |
| Tout vendre | 210 | — |
| Vendre une tuile | 211 à 232 | la ville (22) |
| Développer | 233 à 238 | l'industrie (6) |
| Développer deux fois | 239 à 244 | l'industrie (6) |
| Emprunt, scout, passer | 245 à 247 | — |

Le nom est **plus grossier que le coup**, volontairement. Deux constructions de la même industrie dans la même ville payées avec des cartes différentes sont la même idée ; un développement avec le fer du marché et un avec un cube de ses propres forges aussi. Elles partagent un nom, et la recherche les départage ensuite en lisant le plateau. Ce que le nom garde est ce qu'un joueur dirait à voix haute : du coton à Bolton, la liaison vers Stoke, vendre la poterie, prendre un emprunt.

L'ordre des industries est écrit dans `policy.ts` et non emprunté à `net.ts` : une fois une politique entraînée, ces noms ne doivent plus bouger, et un changement de traits ne doit pas renommer un coup.

**Mesuré sur 12 parties, 1192 tours** : aucun coup sans nom, 33 coups légaux par tour en moyenne (111 au plus), 27 noms distincts, donc 17 % de collisions — presque toutes des variantes de développement, ce qui est l'intention.

## La distillation

La recherche joue contre elle-même à pleine force, 1500 ms par coup, là où elle essaie **toutes les paires d'actions**. À chaque tour on note :

- les 166 traits du plateau vu par le siège qui joue ;
- le nom du coup qu'elle a joué ;
- les noms qui étaient sur la table, en huit mots de 32 bits ;
- les **seize meilleurs noms avec leur lecture**, non bruitée.

La cible n'est donc pas un simple choix mais un souhait : moitié le coup joué, moitié un softmax des lectures à trois points de température. C'est bien plus riche qu'un `argmax`, pour le même coût, puisque la recherche évaluait déjà tous les coups sans jamais rendre le classement. Elle le rend maintenant quand on le lui demande.

Le réseau (166 × 128 × 96 × 248) est ajusté par Adam sur l'**entropie croisée des noms sur la table** : les noms illégaux sortent du softmax et ne sont jamais enseignés. Arrêt anticipé sur un dixième des tours tenus à l'écart.

## L'épreuve

La politique joue **seule, sans aucune recherche** : elle prend le coup le mieux classé et c'est tout. Elle affronte des machines qui, elles, cherchent à pleine force. Tables de 2, 3 et 4, siège tournant.

C'est la seule mesure qui compte à ce stade. Si la politique seule tient le rang de la recherche qu'elle a copiée, alors un nom porte assez de connaissance pour qu'un arbre soit construit dessus. Sinon, l'encodage est à revoir avant d'aller plus loin.

## Ce que cela ne fait pas encore

La distillation ne rend personne plus fort : elle copie. Son intérêt est de valider l'infrastructure et de fournir un **prior** à un Monte-Carlo guidé, qui lui seul fera progresser la cible. Voir [[09 Pistes]].

## Comment lancer

```sh
cd app
GAMES=240 ITERATIONS=1 EPOCHS=60 WORKERS=10 sh tools/bots/distil.sh loop
```

Les sous-commandes : `play` (enregistrer), `fit` (apprendre et écrire `policy-weights.ts`), `check` (l'épreuve), `loop` (les trois). Variables : `GAMES`, `ITERATIONS`, `EPOCHS`, `PATIENCE`, `STRENGTH`, `BUDGET`, `DEPTH`, `WORKERS`, `CHECK_GAMES`, `HIDDEN`, `TEMP`, `CHOSEN`. Les positions vont dans `tools/bots/policy-data` (non versionné), le journal dans `tools/bots/distil.log`.
