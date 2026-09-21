# Les machines de Blackrail — comment elles apprennent

Coffre de notes sur le cerveau des bots : comment ils choisissent un coup, comment ils lisent le plateau, et comment cette lecture est entraînée par auto-jeu. Tout ce qui est écrit ici a été mesuré ; les chiffres datent du 19 septembre 2026.

## Lire dans l'ordre

1. [[01 Vue d'ensemble]] — le problème, l'objectif, l'architecture en une page
2. [[02 La recherche]] — le tour joué avant d'être choisi, le curseur de force, l'anticipation
3. [[03 L'évaluation manuelle]] — les termes lisibles et leurs poids
4. [[04 Le cerveau]] — le réseau de neurones : traits, architecture, emballage
5. [[05 La boucle d'auto-jeu]] — jouer, apprendre, mesurer, garder ou jeter
6. [[06 Mesures et résultats]] — toutes les mesures, dans l'ordre
7. [[07 Ce qui n'a pas marché]] — les impasses, pour ne pas y retourner
8. [[08 Comment lancer]] — commandes, variables, fichiers
9. [[09 Pistes]] — ce qui reste à essayer pour atteindre 60 puis 80
10. [[10 Journal]] — les changements d'objectif et de méthode, datés
11. [[11 Nommer les coups]] — donner un nom à chaque coup et distiller la recherche, pour sortir du plateau
12. [[12 Le plafond de réflexion]] — la ligne qui bridait le bot et faussait toutes les jauges

## Repères

- Code : `app/src/game/search.ts` (recherche), `weights.ts` (évaluation manuelle), `net.ts` (cerveau), `net-weights.ts` (poids appris), `policy.ts` (les noms des coups et leur classement), `app/tools/bots/` (arène, entraîneur, apprentissage, distillation).
- Objectif fixé par Nicolas : **un bot fort sur la partie entière**, avec pour repère 60 points d'ère canal minimum, puis 80. Un temps, l'entraînement s'est limité à l'ère canal ; il rejoue la partie entière depuis le 20 septembre (voir [[10 Journal]]).
- Où on en est : avec son vrai temps de réflexion, l'expert fait **149,7 points à deux sièges et 138,2 à trois** contre une table faible, et **157,2 à deux** s'il vise son propre score avec vingt secondes par coup. Les chiffres plus bas qu'on lit ailleurs dans ce coffre datent d'avant la correction du plafond de réflexion : voir [[12 Le plafond de réflexion]].
