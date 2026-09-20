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
| N+3, N+4 avec 4 s de réflexion, contre N+2 à 1,5 s | 0/12, 2/12, et N+2 à 4 s 1/12 | plus de temps d'anticipation n'apporte rien ; sans anticipation, égalité (3/12, 50,0 contre 49,7) |
| Évolution des poids manuels par auto-jeu (`train.ts`) | deux générations sans gagnant | mesure trop bruitée pour des gains de un point ; le cerveau rapporte plus |
| Cible TD sur des cerveaux non « ère canal » | erreur retenue 8,3 mais 6/24 | mieux lire n'est pas mieux jouer ; la cible TD reste, elle n'est pas magique |

## La leçon transversale

Le plafond n'est pas dans la profondeur de recherche : sans anticipation, avec une ronde, deux, trois ou quatre, avec 1,5 s ou 4 s, l'expert fait 50. Ce qui a fait monter les chiffres, c'est ce que le cerveau **voit** (traits) et ce qu'il a **vu jouer** (exploration, force des parties).

Suite : [[08 Comment lancer]].
