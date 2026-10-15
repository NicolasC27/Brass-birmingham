# Ce que fait un expert

Repères tirés de deux sources apportées par Nicolas le 22 septembre 2026 : le fil BGG *Brass: Birmingham strategy primer and openings (4p)* (Dave C, 2021) et des notes d'entretien avec Mafiul Robin (Legendary Tactics). Chiffres à traiter comme des ordres de grandeur d'experts humains, pas comme des vérités mesurées sur notre moteur.

## Le cadre chiffré

| Joueurs | Actions dans la partie | Score gagnant entre joueurs forts |
|---|---|---|
| 2 | 39 | ~200 |
| 3 | 35 | ~175 |
| 4 | 31 | ~155 |

Soit **environ 5 points par action**. Et comme développer et emprunter n'en rapportent aucun, les actions qui marquent doivent rapporter nettement plus.

Nos 31 actions mesurées à quatre joueurs ([[13 Le budget d'actions]]) collent au chiffre de la source. **La cible de 160 à quatre joueurs est donc exactement le score d'un vainqueur expert.**

## Les cinq écarts mesurés

| Poste, ère du canal | Expert | Notre bot |
|---|---|---|
| Actions de développement | 3 à 4 | 1,5 (0,95 sous l'édition 2, mesuré le 15 octobre sur 24 parties) |
| Tuiles brûlées en développant | 5 à 6 | 1,8 |
| Liaisons construites | 3 | 4,3 |
| Surconstruction de ses propres mines | courante | 0,3 sur ~24 occasions |
| Emprunts pris à l'ère du rail | ~0 | 1,7 (1,1 sous l'édition 2 — et les lui interdire coûte 4,5 points, voir [[07 Ce qui n'a pas marché]]) |

La moitié de nos constructions sont de niveau 1, alors que la règle experte est de viser le niveau 2 ou plus dès l'ère du canal, puisqu'une industrie construite et vendue au canal **compte deux fois**.

## Les principes, dans l'ordre où ils comptent

1. **Les actions qui ne rapportent pas se prennent au canal.** Emprunts et développements pendant la première ère ; l'ère du rail sert à marquer. Nos 1,7 emprunt tardifs sont donc une erreur franche.
2. **Peu de canaux.** Un canal rapporte peu, on ne peut en poser qu'un par action, et ils sont retirés au décompte. Un intervenant va plus loin : à quatre joueurs, celui qui construit le moins de canaux gagne, parce qu'on se branche sur le réseau des autres.
3. **Développer sert à accéder aux grosses tuiles.** Une action de développement brûle deux tuiles ; ne jamais en gaspiller une à n'en brûler qu'une seule. Atteindre le coton de niveau 3 demande d'en brûler cinq, soit 2,5 actions.
4. **Beaucoup de liaisons à l'ère du rail**, surtout autour de Birmingham, et les deux qui ouvrent l'accès aux brasseries dédiées (Cannock vers la Farm Brewery, Kidderminster vers Worcester).
5. **Surconstruire son propre fer de niveau 1** au canal : cela économise une action, et une liaison posée pour livrer du charbon au fer sert aussi à la surconstruction.

## Les stratégies, selon le nombre de joueurs

- **Manufactures : la meilleure à trois et quatre joueurs.** Elle ne demande que **deux** actions de développement (brûler deux bières de niveau 1, puis une manufacture de niveau 1 et un charbon ou fer de niveau 1). Puis deux manufactures de niveau 2 et deux brasseries de niveau 2 au canal, vendues avec sa propre bière. Avantage décisif : la manufacture de niveau 2 **ne demande pas de charbon**.
- **Coton : la meilleure à deux joueurs**, parce qu'elle exige quatre actions de développement, seulement finançables avec 39 actions. Ouverture « gros coton » du fil BGG : 3 développements, 3 constructions, 1 vente, soit 7 actions pour 54 points de vente.
- **Poterie : risqué, rarement recommandé**, on se fait bloquer. Seulement si les marchands et les cartes s'y prêtent et qu'on manque de cartes pour les autres.

## La bière

Traitée comme universelle, au même titre que le fer. Développer la bière de niveau 1 tôt, construire tôt, et **ne jamais dépenser pour autre chose une carte qui permet une brasserie**. Le fil BGG nuance : à trois joueurs ou plus sur la bière, le marché sature et le rendement s'effondre ; deux joueurs sur la bière est l'équilibre.

## L'ordre du tour

Les experts organisent des **doubles tours** : être dernier d'une ronde puis premier de la suivante donne quatre actions d'affilée. Quand on est dernier, emprunter ou peu dépenser ; quand on est premier, faire les grosses dépenses. Notre évaluation a un terme `tempo` qui vaut 1, sans doute très en dessous de ce que vaut ce cycle.

## Ce qu'il faut en faire

Ces sources ne disent pas comment coder l'évaluation, mais elles désignent sans ambiguïté le même défaut que nos mesures : **nos plateaux de tuiles ne progressent pas**, faute de développements, donc les tuiles chères ne sont jamais accessibles. C'est le premier chantier. Voir [[13 Le budget d'actions]] pour la mesure et [[12 Le plafond de réflexion]] pour l'état réel du bot.
