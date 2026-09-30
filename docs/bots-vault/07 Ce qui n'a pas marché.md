# Ce qui n'a pas marché

À garder sous les yeux pour ne pas refaire les mêmes expériences.

| Idée | Mesure | Verdict |
|---|---|---|
| Valoriser l'argent davantage (`cashSlope` ×2, ×3) | ère canal 30 → 29 → 24 | la machine thésaurise ; ce sont les emprunts d'ouverture qu'il fallait valoriser |
| Goût pour les tuiles hautes (`stack` ×5, ×10) | 41 → 41, 37 | rien, puis pire |
| Prime « plateau développé » (`developed` 2, 4, 6) | 39 → 37,5, 29, 29 (final 90 → 93) | les actions passées à développer manquent à l'ère canal ; laissé à 0, l'exploration l'explore |
| Réseau seul, sans lecture manuelle | 28 contre 41 en mélange | le cerveau corrige, il ne remplace pas |
| Cible « ère canal seule » sur parties complètes | +10 ère canal mais −7 au final, 5 ères sur 24 | sacrifie le rail ; réglé en ne jouant plus le rail du tout et en n'utilisant le cerveau qu'en ère canal |
| Anticipation élargie (8 tours, 3 tirages) | 39–52, même fourchette | rien de mesurable |
| Tour suivant planifié (recherche) au lieu de glouton | 6/16 contre 6/16 | rien |
| Rivaux figés dans l'anticipation | 2/8, −4,4 | trompe la machine |
| ~~N+3, N+4 avec 4 s de réflexion, contre N+2 à 1,5 s~~ **mesure invalide** | 0/12, 2/12, et N+2 à 4 s 1/12 | les 4 s n'ont jamais été accordées : le budget était plafonné à 1500 ms, la ligne comparait 1,5 s contre elle-même. Voir [[12 Le plafond de réflexion]] |
| ~~Évolution des poids manuels par auto-jeu (`train.ts`)~~ **diagnostic faux** | deux générations sans gagnant | ce n'était pas le bruit : la porte demandait une marge sur le meilleur rival de 1 ou mieux, or cette marge vaut structurellement −12 à quatre. Le critère était inatteignable et **aucun** enfant n'a jamais été promu. Corrigé le 30 septembre, voir [[18 La statistique qui ne valait jamais zéro]] |
| Cible TD sur des cerveaux non « ère canal » | erreur retenue 8,3 mais 6/24 | mieux lire n'est pas mieux jouer ; la cible TD reste, elle n'est pas magique |

| Bandit à rivaux joués par le cerveau, 20 s par coup | 2/8, 40,4 contre 43,3 | quatrième forme d'anticipation sans gain ; retirée |
| Ouvertures imposées à l'expert (livre) | à 3 : poterie +6 d'ère canal, les autres égales ou pires ; à 4 : toutes pires que rien | le bot choisit déjà ces lignes quand elles valent ; seule la poterie à trois est gardée |
| Les cartes en main dans les traits (10 nombres) | −3,35 ± 2,68 apparié, 16/96 pour une par de 24 | l'évaluation ne voyait que le **nombre** de cartes : une main de six villes pleines et une main de six villes libres se lisaient pareil. Hypothèse raisonnable, mesurée proprement, sans effet. Le signe décisif est venu avant les parties : erreur retenue 6,60 en voyant la main contre 6,62 en aveugle. Retiré le 30 septembre |

## Le crible qui coûte quinze minutes au lieu de quarante

L'essai des cartes en main a donné le même verdict deux fois, une fois cher et une fois presque gratuit :

| | aveugle | voyant |
|---|---|---|
| erreur sur les positions retenues | 6,62 | 6,60 |
| 96 parties appariées | — | −3,35 ± 2,68 |

L'erreur retenue, qui coûte deux fits et quinze minutes, disait déjà tout. Les parties, qui coûtent quarante minutes de plus, n'ont fait que le confirmer.

**La règle qui en sort** : avant de jouer la moindre partie pour peser un trait, entraîner deux fois le même corpus — avec et sans — et regarder l'erreur retenue. Si elle ne bouge pas, le trait ne porte rien d'utilisable et les parties ne le feront pas apparaître. Si elle bouge, alors seulement les parties disent si mieux lire veut dire mieux jouer, ce qui n'est pas acquis (voir la ligne « Cible TD » ci-dessus : erreur 8,3 mais 6/24).

Attention au témoin : mettre une colonne à zéro pendant l'apprentissage ne rend pas le réseau aveugle, cela l'empoisonne. Voir [[18 La statistique qui ne valait jamais zéro]].

## La leçon transversale

Le plafond n'est pas dans la profondeur de recherche : sans anticipation, avec une ronde, deux, trois ou quatre, l'expert fait 50. (La partie « avec 1,5 s ou 4 s » de cette conclusion était fausse — les 4 s n'étaient pas accordées. Remesuré proprement, le temps ne paie que lorsque le bot vise son propre score : voir [[12 Le plafond de réflexion]].) Ce qui a fait monter les chiffres, c'est ce que le cerveau **voit** (traits) et ce qu'il a **vu jouer** (exploration, force des parties).

Suite : [[08 Comment lancer]].
