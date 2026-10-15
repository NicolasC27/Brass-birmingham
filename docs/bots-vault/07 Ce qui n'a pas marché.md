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
| Réentraîner sous l'édition 2 des règles (donne rail équitable, ventes entières) | +0,03 ± 1,16 contre le cerveau livré, appris sous l'édition 1 | le changement de règle ne l'avait pas handicapé ; rien à remplacer. Nouvel étalon, 4 lectures identiques : vainqueur 152,5, moyenne 138,8, record 172 |
| Tout le menu des doubles rails au professeur (`PLAY_WIDE`) | édition 1 : +1,94 ± 1,25 ; **édition 2, corpus alternés : −0,80 ± 1,27** | le premier banc écrivait un corpus entier avant l'autre, sous une autre charge ; alternés tour par tour, l'écart disparaît |
| Le réseau seul, sans les termes écrits à la main | 1,14 développement au canal contre 0,95 ; 133,5 de moyenne contre 134,5 | le réseau ne sait pas mieux que le mélange ; la leçon « développer » n'est pas noyée. Et elle n'a sans doute rien à apprendre : payé pour mener la chaîne, le bot la mène et marque moins ([[17 La chaîne qui ne paie pas]]) |
| Sièges explorateurs qui suivent l'ouverture puis jouent avec les vrais poids (`EXPLORE_STYLE=0`) | −1,89 ± 1,30 ; 1,08 développement au canal | les poids tirés au hasard n'empoisonnaient pas la leçon ; la variété qu'ils apportent aide plutôt |
| Interdire les emprunts à l'ère du rail | **−4,52 ± 0,85** | les experts n'en prennent pas, mais ce bot en tire des points : l'argent finance ses doubles rails. Comme forcer le coton, corriger une habitude isolée pour ressembler à un expert coûte des points |

## Le crible qui coûte quinze minutes au lieu de quarante

L'essai des cartes en main a donné le même verdict deux fois, une fois cher et une fois presque gratuit :

| | aveugle | voyant |
|---|---|---|
| erreur sur les positions retenues | 6,62 | 6,60 |
| 96 parties appariées | — | −3,35 ± 2,68 |

L'erreur retenue, qui coûte deux fits et quinze minutes, disait déjà tout. Les parties, qui coûtent quarante minutes de plus, n'ont fait que le confirmer.

**La règle qui en sort, et elle ne vaut que dans un sens** : avant de jouer la moindre partie, entraîner deux fois le même corpus et regarder l'erreur retenue. **Si elle ne bouge pas, ne jouez pas** — le changement ne porte rien d'utilisable. **Si elle bouge, le crible ne dit rien du tout** et il faut jouer quand même.

Le premier soir j'ai écrit que le crible était « deux sur deux ». Mesuré trois fois de plus, il est **un sur trois** :

| essai | erreur retenue | ce que les parties ont dit | le crible avait-il vu juste ? |
|---|---|---|---|
| les cartes en main | 6,62 → 6,60, rien | rien | oui |
| l'ordre du tour | 5,81 → 5,64 | −0,69 ± 1,82, rien | non |
| le plafond de lignes du fit | 5,73 → **5,28** | −0,28 ± 0,87 sur 400 parties, rien | non |

Le dernier est le plus net : le plus gros gain de lecture de toutes les tentatives — 0,45 point — pour exactement rien au jeu. **Mieux lire n'est pas mieux jouer**, et la note [[06 Mesures et résultats]] le disait déjà d'une cible d'entraînement (erreur 8,3, 6 parties sur 24). Le crible fait économiser les essais morts, pas les essais vivants.

Attention au témoin : mettre une colonne à zéro pendant l'apprentissage ne rend pas le réseau aveugle, cela l'empoisonne. Voir [[18 La statistique qui ne valait jamais zéro]].

## La leçon transversale

Le plafond n'est pas dans la profondeur de recherche : sans anticipation, avec une ronde, deux, trois ou quatre, l'expert fait 50. (La partie « avec 1,5 s ou 4 s » de cette conclusion était fausse — les 4 s n'étaient pas accordées. Remesuré proprement, le temps ne paie que lorsque le bot vise son propre score : voir [[12 Le plafond de réflexion]].) Ce qui a fait monter les chiffres, c'est ce que le cerveau **voit** (traits) et ce qu'il a **vu jouer** (exploration, force des parties).

Suite : [[08 Comment lancer]].
