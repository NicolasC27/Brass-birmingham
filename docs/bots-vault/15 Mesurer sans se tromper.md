# Mesurer sans se tromper

Comment, dans la nuit du 21 au 22 septembre 2026, sept leviers ont été testés, sept résultats ont été jugés « indécis », et comment il s'est avéré que l'instrument était en cause autant que les idées.

## Le contrôle qu'il fallait faire en premier

Opposer une configuration **à elle-même**, sur les mêmes parties. Un banc exact doit rendre zéro. À 20 s de réflexion par coup :

| Réglage | Points | Écart |
|---|---|---|
| contrôle A | 123,3 | — |
| contrôle B | 123,3 | **+0,0 ± 0,0** |

Le banc est donc exact — **à condition que le budget ne morde pas**. La recherche sature bien avant vingt secondes : seize parties par case en 93 secondes.

## Pourquoi les mesures précédentes bruitaient

`searchTurn` s'arrête sur un chronomètre, pas après un nombre fixe de positions. À 400 ms ou 1500 ms le budget mord, et la coupure tombe à un endroit qui dépend de la charge de la machine. Deux exécutions de la même configuration, sur la même graine, ne jouent alors pas la même partie. Ce bruit-là s'ajoute à celui de la pioche et **ne s'annule pas par l'appariement**, puisqu'il naît après le tirage.

Conséquence : toutes les mesures de la nuit prises à 400 ou 1500 ms portaient une incertitude plus grande que celle affichée, qui ne comptait que la variance entre parties.

## Les trois règles qui en découlent

1. **Comparer à budget non mordant.** 20 s par coup rend la recherche déterministe et ne coûte que ~23 s par partie, la recherche s'arrêtant d'elle-même bien avant. C'est moins cher qu'un budget de 1500 ms répété pour compenser le bruit.
2. **Apparier partie par partie.** Toutes les configurations jouent les mêmes graines, et l'écart se calcule graine par graine. `tools/bots/trial.ts` le fait et affiche la marge que le hasard explique seul ; en dessous, il écrit « undecided » plutôt que d'habiller un bruit en résultat.
3. **Rendre le contrôle avant la campagne.** Une configuration contre elle-même. Si l'écart n'est pas nul, rien de ce qui suit ne vaut.

## Les quatre pièges rencontrés, dans l'ordre

- **Lire un classement dans du bruit.** Filtre à 8 noms −11,5 contre filtre à 12 noms −14,2, sur 24 parties : conclu que le filtre plus doux était pire. Les deux disaient la même chose.
- **Confondre un coût par tour et un coût par partie.** « 0,11 point abandonné » se lit par tour ; sur trente tours et deux actions, cela fait l'ordre de grandeur du duel perdu.
- **Inventer une cause sans la vérifier.** Affirmé que les positions de milieu de tour étaient hors distribution ; elles représentent 52 % du corpus, la boucle enregistrant une fois par action et non par tour.
- **Sélectionner du bruit dans une évolution.** Neuf générations sans progrès alors qu'un enfant prenait la place presque à chaque fois : la barre de deux points était sous l'incertitude de 2,3. Corrigé par une manche de confirmation sur des parties neuves.

## Ce qu'il faut retenir

Sept résultats indécis d'affilée est la signature d'un instrument trop grossier, pas de sept mauvaises idées. Le réflexe, devant une série de mesures qui ne tranchent pas, doit être de mesurer l'instrument avant de changer d'hypothèse.
