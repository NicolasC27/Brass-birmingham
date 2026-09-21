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

## Ce que cela a donné, mesuré le 21 septembre 2026

Deux lots de parties, 25 080 puis 62 700 tours au total, professeur à 1500 ms.

| Politique | Tours appris | Coup exact | Dans les trois |
|---|---|---|---|
| v1 | 25 080 | 40,4 % | 65,7 % |
| v2 | 62 700 | 43,2 % | 69,4 % |

Deux fois et demie plus de données ne rapportent que trois points : **le volume de parties n'est pas la limite**. Le hasard sur 27 coups donnerait 3,6 %.

### Par famille de coup (v1)

| Famille | Part | Coup exact | Dans les trois |
|---|---|---|---|
| Vendre | 9,9 % | 92,3 % | 100 % |
| Construire | 38,7 % | 38,4 % | 64,1 % |
| Liaison | 25,4 % | 31,0 % | 59,0 % |
| Emprunt | 9,7 % | 39,8 % | 73,0 % |
| Double liaison | 9,1 % | 33,6 % | 66,4 % |
| Développer deux fois | 4,6 % | 33,9 % | 48,7 % |
| Scout | 1,7 % | 4,7 % | 34,9 % |
| Développer une fois | 0,9 % | 0 % | 9,1 % |

Quand la politique se trompe, elle propose presque toujours un coup de la **même famille** : une autre construction (13,2 % des tours), une autre liaison (7,7 %). Elle trouve la bonne idée et la mauvaise ville. La vente à 92 % montre que l'encodage n'est pas en cause : là où le coup est presque forcé, le réseau le trouve. Le développement simple est écrasé par le double dans presque toute position, et le scout est un jugement de main que les traits du plateau ne décrivent pas.

### L'épreuve, et pourquoi elle était mal posée

La politique seule, sans recherche, **perd nettement** : 1 ère sur 24 contre une parité à 8, −38,9 points. C'est le défaut connu de l'apprentissage par imitation : un imitateur à 40 % dérive de la ligne de son professeur au fil d'une centaine de décisions et finit dans des positions qu'il n'a jamais apprises.

C'était le mauvais critère. Ce qu'on demande à une intuition, c'est d'élaguer sans jeter le bon coup :

| Noms gardés sur 26,9 | Le bon coup survit | Largeur ÷ | Points lâchés par tour |
|---|---|---|---|
| 5 | 81,4 % | 5,4 | 0,25 |
| 8 | 89,7 % | 3,4 | 0,11 |
| 12 | 95,3 % | 2,2 | 0,04 |

### Le résultat négatif qui compte

Le classement branché sur la recherche comme **filtre dur** (`guided` dans `search.ts`, la politique consultée avant que le moteur ne joue quoi que ce soit) écarte 60 % des coups à huit noms. Mesuré en duel à horloge égale : **4 ères sur 24, −11,5 points**. L'élagage dur coûte cher.

Le chiffre « 0,11 point lâché » se lit **par tour**, pas par partie : deux actions par tour, une trentaine de tours, l'ordre de grandeur du duel est retrouvé. Lire ce coût comme négligeable face à une partie de 130 points est une erreur d'échelle.

Rendre le temps gagné en anticipation récupère la moitié du coût :

| Réglage | Ères gagnées sur 24 | Points sur le meilleur rival |
|---|---|---|
| 8 noms, profondeur 0 | 4 | −11,5 |
| 8 noms, profondeur 2 | 8 | −5,3 |
| parité | 8 | 0 |

C'est un fait nouveau qui contredit [[07 Ce qui n'a pas marché]] : l'anticipation **rapporte**, dès qu'on lui laisse la place. Elle était étranglée par la largeur, pas inutile. Le filtre dur reste malgré tout à peine à parité.

**Ce que cela ne dit pas** : un Monte-Carlo n'élague pas dur. Le prior y oriente les visites sans supprimer personne — un coup mal classé est visité rarement, et l'arbre y revient s'il s'avère bon. Le duel condamne l'élagage dur, pas l'arbre.

## Ce que cela ne fait pas encore

La distillation ne rend personne plus fort : elle copie. Son intérêt est de valider l'infrastructure et de fournir un **prior** à un Monte-Carlo guidé, qui lui seul fera progresser la cible. Voir [[09 Pistes]].

## Comment lancer

```sh
cd app
GAMES=240 ITERATIONS=1 EPOCHS=60 WORKERS=10 sh tools/bots/distil.sh loop
```

Les sous-commandes : `play` (enregistrer), `fit` (apprendre et écrire `policy-weights.ts`), `check` (l'épreuve), `loop` (les trois). Variables : `GAMES`, `ITERATIONS`, `EPOCHS`, `PATIENCE`, `STRENGTH`, `BUDGET`, `DEPTH`, `WORKERS`, `CHECK_GAMES`, `HIDDEN`, `TEMP`, `CHOSEN`. Les positions vont dans `tools/bots/policy-data` (non versionné), le journal dans `tools/bots/distil.log`.
