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
13. [[13 Le budget d'actions]] — trente actions par partie : où elles passent, et ce que 160 points exigerait
14. [[14 Ce que fait un expert]] — repères humains : 31 actions et 155 points à quatre, et les cinq écarts mesurés
15. [[15 Mesurer sans se tromper]] — le banc est exact à budget non mordant ; les quatre pièges qui ont coûté une nuit
16. [[16 L'état des lieux]] — le chiffre officiel, ce qui a été gagné, et les six pistes mortes
17. [[17 La chaîne qui ne paie pas]] — l'hypothèse centrale du 23 septembre, construite, mesurée, réfutée
18. [[18 La statistique qui ne valait jamais zéro]] — le biais de −12 qui rendait trois portes muettes, et les quatre pièges voisins

## Repères

- Code : `app/src/game/search.ts` (recherche), `weights.ts` (évaluation manuelle), `net.ts` (cerveau), `net-weights.ts` (poids appris), `policy.ts` (les noms des coups et leur classement), `app/tools/bots/` (arène, entraîneur, apprentissage, distillation).
- Objectif fixé par Nicolas : **un bot fort sur la partie entière**, avec pour repère 60 points d'ère canal minimum, puis 80. Un temps, l'entraînement s'est limité à l'ère canal ; il rejoue la partie entière depuis le 20 septembre (voir [[10 Journal]]).
- **Où on en est, au 22 septembre 2026.** Sur la jauge qui ne mesure que le jeu — quatre lectures identiques à une même table, recherche non bridée ([[16 L'état des lieux]]) :

| Position | Points |
|---|---|
| Vainqueur | **132,7 ± 3,0** |
| Deuxième | 124,5 |
| Troisième | 118,4 |
| Dernier | 111,4 |
| Total de la table | 487 |

  Contre une table faible : **143,6 à trois sièges, 125,1 à quatre**. La cible est 155 à quatre et 175 à trois ([[14 Ce que fait un expert]]). Tout chiffre plus bas lu ailleurs dans ce coffre date d'avant la correction du plafond de réflexion ([[12 Le plafond de réflexion]]).
