# La voix du guide

Le guide de la partie guidée compte vingt-six leçons ; la voix en dit neuf.
Le texte écrit à l'écran garde l'explication complète ; la voix ne fait
que le personnage : le tenancier d'une maison de jeu de Birmingham, ravi
de voir arriver un débutant, et plus ravi encore de le voir se faire
plumer.

Aucun fichier audio n'existe encore, et le jeu ne lit aucune voix. Le
jour où elles seront enregistrées, elles iront dans
`app/public/voice/guide/<id>.mp3`, nommées par l'identifiant de la leçon
(`welcome.mp3`, `goal.mp3`…) et non par son numéro : l'ordre des leçons
bouge (`app/src/components/game/lessons.ts`), leurs identifiants non.

Voix : ElevenLabs, modèle v3, Stability « Creative », Similarity 70,
Speed 1,1. Les balises entre crochets sont lues par v3 ; pour v2, les
retirer et écrire les rires (« Ha ha ha ! », « hé hé hé »).

Il se croit bilingue : un ou deux mots d'anglais par réplique, avec
l'accent, jamais une phrase entière. La balise `[strong French accent]`
précède chaque mot anglais ; en v2, l'écrire à la française (« Ouelcome »).

Prompt de conception de la voix :

> An eccentric French showman in his forties, the crooked owner of a
> Birmingham gambling house in 1800. Bright, fast, delighted by
> everything, laughs at his own jokes, drops to a conspiratorial whisper
> when he shares the dirty tricks. Speaks very fast, barely pauses,
> breathless with enthusiasm. Studio quality, close mic.

## Tu et vous

Le tenancier tutoie : c'est un choix de personnage, un bateleur qui
prend le débutant par l'épaule. L'écrit, lui, vouvoie en français,
partout — le guide à la table comme le site. La voix ne remplace jamais
le texte : elle le double d'un ton, sans en changer le registre écrit.

Dans les autres langues, chaque surface garde un registre :

- **À la table** (le plateau, le guide, les réponses, le codex des
  règles) : *du* en allemand, *tú* en espagnol, comme les règles de jeux
  de société le font dans ces langues ; l'anglais n'a pas le choix.
- **Au site** (le bureau, la gare, le cours du soir, le profil, les
  lettres des machines) : *Sie* et *usted* — le personnel de la gare
  parle à un voyageur. Le cours du soir cite les titres des leçons tels
  que le guide les dit, à la deuxième personne du singulier : ce sont
  ses mots, pas ceux du guichet.
- **L'avant-première** (`src/landing/`) tutoie en allemand et en
  espagnol : elle parle aux joueurs avant qu'ils n'entrent en gare,
  comme le font les pages de jeux dans ces langues.

## Les répliques

Numéros et identifiants de l'ordre actuel. La partie guidée est une
partie courte : l'ère canal seule, dix manches, pas de balayage, pas de
paie après la dernière manche, et une clôture qui compte 1 PV par
tranche de 4 £ (15 au plus), le niveau de revenu en points, et les tuiles
retournées de niveau 2 ou plus une seconde fois. Les répliques le disent.

## 1 · welcome

[amused] Tiens, un nouveau. On m'envoie des débutants dans ma propre maison, maintenant ? [laughs] Parfait. [strong French accent] Welcome, my friend. [amused] Tu vas adorer ce jeu. Et tout le monde autour de cette table va te le faire regretter. [mischievously] Moi le premier.

## 3 · goal

[amused] Les points. Tuiles retournées, liaisons, c'est presque tout. [whispers] Et ton argent ? [laughs] Ici, à la fin, quatre livres font un point — quinze au plus. [strong French accent] Not much ! [amused] Alors ne dors pas dessus : bâtis ce qui se retourne.

## 7 · coal

[excited] Assez parlé. Une carte charbon, un emplacement, construis. [strong French accent] Come on ! [amused] Le charbon, c'est le sang de cette ville. Sans lui, personne ne bâtit rien. [mischievously] Même pas tes ennemis.

## 8 · botTurn

[mischievously] Regarde-la jouer. Chaque coup de Wedgwood, je te dis ce qu'elle mijote. [amused] Et ses mines, ses forges ? Sers-toi. Ses cubes sont à toi si tu es relié. [laughs] [strong French accent] It's business. [amused] Elle en fera autant.

## 9 · payday

[excited] Ah, l'argent tombe ! [strong French accent] Payday ! [amused] Fin de manche, chacun touche son revenu. Le tien est maigre. Retourne des tuiles, il grossit. [whispers] Et celui qui dépense le moins joue en premier. Retiens ça.

## 13 · loan

[amused] Plus un sou ? [laughs] Emprunte. Trente livres, trois niveaux de revenu en moins, pour toujours. [mischievously] Tout le monde le fait. [strong French accent] Trust me. [amused] Tôt, ça bâtit ; tard, fais tes comptes.

## 17 · sell

[excited] Vends ! Une bière, un marchand, et ta tuile se retourne. [laughs] Revenu tout de suite, points à la fin. [strong French accent] Money, money. [amused] C'est ça, le jeu. Tout le reste n'est que préparation.

## 19 · eraEnd

[excited] Dix manches, et on ferme ! Pas de dernière paie. [mischievously] Une tuile jamais retournée ? Zéro. Pas un point. [laughs] [strong French accent] Goodbye ! [amused] Et puis on compte la caisse, le revenu, et tes beaux niveaux deux — deux fois. J'adore ce moment.

## 26 · onward

[amused] Tu connais le jeu, maintenant. Construire, relier, retourner, emprunter, vendre. [laughs] Va ouvrir une vraie table. [whispers] Et reviens te faire plumer. [strong French accent] See you soon, my friend.
