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

## Repères

- Code : `app/src/game/search.ts` (recherche), `weights.ts` (évaluation manuelle), `net.ts` (cerveau), `net-weights.ts` (poids appris), `app/tools/bots/` (arène, entraîneur, apprentissage).
- Objectif fixé par Nicolas : **60 points d'ère canal minimum**, puis 80. L'ère du rail n'est plus l'objet de l'entraînement.
- Où on en est : l'expert fait **43 à 52 points d'ère canal** à pleine force selon la table, contre 30 pour la lecture manuelle seule au départ.
