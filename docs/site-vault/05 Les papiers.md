# Les papiers

Ce que le navigateur écrit à la fin d'une partie à la maison (`game/store.ts`, `noteHouse`) :

| Papier | Module | Clé | Contenu |
|---|---|---|---|
| Brevets | `platform/patents.ts` | `brassworks.patents.v1` | 9 distinctions, accordées une fois ; depuis les deeds (local) ou le tally de l'office (historique) |
| Courrier | `platform/letters.ts` | `brassworks.letters.v1` | la machine gagnante crâne ou la mieux placée rouspète ; 4 personnages × 2 × 2 variantes |
| Feuilleton | `platform/feuilleton.ts` | `brassworks.feuilleton.v1` | la dernière partie en 3 moments (`swingsFor`), la partie dans le fragment `#g=…&at=N` |
| Lignes | `platform/lines.ts` | `brassworks.lines.v1` | villes bâties (parties locales) ; l'office ajoute ses tallies à l'affichage |
| Défi | `game/challenge.ts` | `brassworks.challenge.v1` | tables et essais |
| Cours | `platform/cours.ts` | `brassworks.tutorial.reached` (lecture) | leçons lues, motifs du juge → chapitres |

## Suivre le compte

`platform/papers.ts` : à la connexion (`PlatformShell`), `syncPapers()` lit les papiers gardés par l'office (message `papers`), les **replie** dans les locaux (union par id pour brevets et lettres, le plus récent pour le feuilleton) et renvoie le tout (`papers.put`). À chaque fin de partie, `pushPapers()`. Les papiers ne font que s'accumuler ; les lignes ne sont pas synchronisées (elles se recalculeraient en double).

## Autres clés

`brassworks.theme.v1`, `brassworks.lang`, `brassworks.arrived.v1`, `brassworks.form.v1` (la forme des machines), `brassworks.progress.v1` (la feuille du juge), `brassworks.local.v1` (le registre des tables locales).
