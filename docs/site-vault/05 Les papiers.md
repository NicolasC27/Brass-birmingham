# Les papiers

Ce que l'office garde pour le compte, écrit à la fin d'une partie à la maison (`game/store.ts`, `noteHouse`). Depuis le 6 octobre ils ne vivent plus dans le navigateur : `platform/papers.ts` tient un miroir en mémoire, lu une fois à l'ouverture de l'application (`hydratePapers`) et réécrit à l'office (`papers.put`) dès qu'un papier bouge. La colonne « clé » ci-dessous est le *kind* de la ligne `papers`.

| Papier | Module | Clé | Contenu |
|---|---|---|---|
| Brevets | `platform/patents.ts` | `patents` | 9 distinctions, accordées une fois ; depuis les deeds (local) ou le tally de l'office (historique) |
| Courrier | `platform/letters.ts` | `letters` | la machine gagnante crâne ou la mieux placée rouspète ; 4 personnages × 2 × 2 variantes |
| Feuilleton | `platform/feuilleton.ts` | `feuilleton` | la dernière partie en 3 moments (`swingsFor`), la partie dans le fragment `#g=…&at=N` |
| Lignes | `platform/lines.ts` | `lines` | villes bâties (parties locales) ; l'office ajoute ses tallies à l'affichage |
| Défi | `game/challenge.ts` | `challenge` | tables et essais |
| Cours | `platform/cours.ts` | `brassworks.tutorial.progress` (lecture, dans le navigateur) | leçons passées, par id — une partie guidée menée au bout compte entière ; motifs du juge → chapitres |

S'y ajoutent `progress` (la feuille du juge, `game/progress.ts`), `form` (la forme des machines, `game/form.ts`) et `equipped` (la tenue, `platform/wallet.ts`).

## Suivre le compte

L'office décide : plus de repli d'une copie dans l'autre. `hydratePapers()` remplit l'étagère à l'ouverture et à chaque changement de session ; se déconnecter la vide (`clearPapers`), ces papiers n'ont jamais été ceux du navigateur. La reprise unique (`platform/uplift.ts`) monte les papiers d'un navigateur d'avant, mais seulement les *kinds* dont l'office ne tient rien.

## Ce qui reste dans le navigateur

Les réglages de l'appareil seulement : `brassworks.theme.v1`, `brassworks.lang`, `brassworks.keys.v1`, `brassworks.arrived.v1`, les options du plateau, la position du guide — plus `brassworks.setup.v1` (le formulaire de table, pas un enregistrement) et `brassworks.session.v1` (le jeton). La partie guidée y garde aussi sa table (`brassworks.tutorial.table`, le code) et sa progression (`brassworks.tutorial.progress`, les leçons par id, pour cette table, avec le choix de laisser jouer la machine sans l'attendre, qu'une nouvelle partie guidée remet à zéro) ; les anciennes clés `.step` et `.reached` sont reprises une fois puis effacées. Le Cours du soir et le bandeau du chef de gare (`hooks/use-guided-game.ts`) rouvrent cette table tant que le registre la tient et qu’elle n’est pas finie (`quickplay.resumeOf`) ; sinon, ou sur « Reprendre depuis le début », une nouvelle est dressée, et rien de l’ancienne n’est effacé avant que l’office l’ait donnée — un office muet se lit sous le bouton. « Quitter le guide », confirmé, oublie la table : c’est définitif pour elle. La partie guidée part à l’office avec sa propre donne et n’écrit plus `brassworks.setup.v1`, qui reste le formulaire du joueur. Le guide y garde enfin ce qui a été lu à chaque table (`brassworks.guide.read` : la dernière plaque de la machine rangée, les dernières nouvelles lues et le fil, pour les six dernières tables), pour qu'un rechargement ne ramène pas des plaques déjà lues.
