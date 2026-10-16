/* ------------------------------------------------------------------ */
/* What the guide knows of the rules themselves.                       */
/*                                                                     */
/* Every answer here is written from brass/game-data.md and checked    */
/* against the engine — none is generated, so none can invent a rule.  */
/* A question is matched on the words it carries: the entry sharing the */
/* most of them wins, and nothing below one word wins at all.          */
/* ------------------------------------------------------------------ */

import type { Lang } from '@/i18n';
import { WRITTEN_ES } from './faq/writtenEs';
import { WRITTEN_DE } from './faq/writtenDe';

export interface FaqEntry {
  id: string;
  /** what a reader might write, lower case and without accents */
  words: string[];
  /** what the rules say, in the reader's tongue */
  answer: string;
  /** a short name for the topic, offered when nothing matched well */
  topic: string;
}

/** lower case, no accents, no punctuation: the shape words are compared in */
export const plain = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const FR: FaqEntry[] = [
  { id: 'ironSells', topic: 'La forge et le marché du fer', words: ['fer vend', 'forge vend', 'sideru', 'fer automatique', 'fer marche', 'fer bourse', 'vend fer', 'barres fer'],
    answer: 'Oui, et sans condition : une forge posée vide aussitôt ses barres au marché du fer, les cases les plus chères d’abord, et vous encaissez le prix imprimé de chacune. Aucune liaison, aucun marchand n’est demandé. Si toutes les barres partent ainsi, la tuile se retourne sur-le-champ. Ce qu’il reste dessus sert ensuite aux constructions et aux développements de n’importe qui.' },
  { id: 'coalSells', topic: 'La mine et le marché du charbon', words: ['mine vend', 'charbon vend', 'mine automatique', 'charbon bourse', 'mine marche', 'vend charbon'],
    answer: 'Seulement si la mine atteint un emplacement marchand par des liaisons, les vôtres ou celles des autres. Dans ce cas, à la construction, tous les cubes qui tiennent partent au marché du charbon et vous en encaissez le prix ; si le dernier part ainsi, la tuile se retourne. Hors de portée d’un marchand, la mine garde ses cubes. Et cette vente n’a lieu qu’à la construction, jamais après.' },
  { id: 'flipMine', topic: 'Quand une mine se retourne', words: ['mine retourne', 'mine flip', 'quand retourne mine', 'forge retourne', 'brasserie retourne', 'cube dernier'],
    answer: 'Une mine ou une forge se retourne quand son dernier cube part, une brasserie quand son dernier baril est bu — et peu importe qui les a pris. Le retournement avance votre marqueur de revenu du nombre d’espaces imprimé sur la tuile, et ses points sont acquis pour la fin d’ère. Une mine vidée par les autres est une mine payée.' },
  { id: 'flipWorks', topic: 'Quand un ouvrage se retourne', words: ['ouvrage retourne', 'filature retourne', 'coton retourne', 'manufacture retourne', 'poterie retourne', 'comment retourner'],
    answer: 'Une filature, une manufacture ou une poterie ne se retourne que par l’action Vendre : il faut une liaison jusqu’à un marchand qui achète ces biens, et la bière que la tuile demande. Rien d’autre ne la retourne, et une tuile jamais retournée ne marque aucun point.' },
  { id: 'ironWhere', topic: 'Où trouver du fer', words: ['ou fer', 'trouver fer', 'fer liaison', 'fer connect', 'fer reli'],
    answer: 'N’importe où : le fer se prend sur n’importe quelle forge non retournée du plateau, à qui qu’elle soit, sans notion de distance ni de réseau. À défaut de forge, il s’achète au marché du fer, là encore sans aucune connexion. C’est la grande différence avec le charbon.' },
  { id: 'coalWhere', topic: 'Où trouver du charbon', words: ['ou charbon', 'trouver charbon', 'charbon liaison', 'charbon connect', 'charbon reli'],
    answer: 'Le charbon doit venir d’une mine non retournée reliée à votre chantier par des liaisons — la vôtre ou celle de n’importe qui, la plus proche d’abord. À défaut, il s’achète au marché, mais seulement si le chantier atteint un emplacement marchand. Sinon la construction est impossible.' },
  { id: 'marketPrice', topic: 'Le prix du charbon et du fer', words: ['prix charbon', 'prix fer', 'marche monte', 'bourse monte', 'recharge marche', 'marche vide'],
    answer: 'On achète toujours la case la moins chère d’abord, et le prix monte à mesure que les cubes partent. Les marchés ne se rechargent jamais seuls : seules les nouvelles mines et forges, en vendant leurs cubes, les remplissent — des cases les plus chères vers les moins chères. Marché vide, on paie quand même : 8 £ le charbon, 6 £ le fer.' },
  { id: 'beer', topic: 'D’où vient la bière', words: ['ou biere', 'trouver biere', 'biere vendre', 'baril', 'brasserie sert'],
    answer: 'Trois sources, et chaque baril peut venir d’une source différente : vos propres brasseries non retournées, n’importe où sur la carte et sans condition ; la brasserie d’un rival, mais seulement si elle est reliée à la tuile vendue ; ou le baril posé près du marchand auquel vous vendez, qui déclenche en plus son bonus. Sans la bière demandée, l’action Vendre est impossible.' },
  { id: 'merchantBonus', topic: 'Le bonus du marchand', words: ['bonus marchand', 'baril marchand', 'marchand donne'],
    answer: 'Boire le baril posé près d’une tuile marchande donne son bonus : de l’argent, des points, du revenu ou un développement gratuit selon le marchand. Il y a un baril par tuile marchande non vierge, donc certains marchands en portent deux, et chaque baril ne se boit qu’une fois par ère. Les barils sont remis en place à la transition vers l’ère rail.' },
  { id: 'sellHow', topic: 'Comment vendre', words: ['comment vendre', 'action vendre', 'vendre plusieurs', 'vente'],
    answer: 'Défaussez une carte, quelle qu’elle soit, choisissez une de vos filatures, manufactures ou poteries non retournée reliée à un marchand qui achète ces biens, et buvez la bière demandée. La tuile se retourne : le revenu monte tout de suite, les points attendent la fin d’ère. Une seule action peut retourner plusieurs tuiles, autant que vous pouvez en payer la bière.' },
  { id: 'buildCard', topic: 'Quelle carte construit quoi', words: ['quelle carte', 'carte lieu', 'carte industrie', 'carte construit', 'joker'],
    answer: 'Une carte lieu construit n’importe quelle industrie dans la ville qu’elle nomme, même hors de votre réseau. Une carte industrie construit cette industrie dans une ville de votre réseau. Tant que vous n’avez aucune tuile sur le plateau, une carte industrie construit n’importe où. Un joker lieu vaut pour toute ville sauf les deux brasseries fermières, un joker industrie pour toute industrie.' },
  { id: 'network', topic: 'Ce qu’est votre réseau', words: ['mon reseau', 'cest quoi reseau', 'reseau definition', 'ou je peux construire'],
    answer: 'Votre réseau, ce sont les lieux où vous avez une tuile, plus les lieux touchés par vos liaisons. Une carte industrie n’y construit que là. Une carte lieu, elle, ignore le réseau : elle construit dans sa ville quoi qu’il arrive.' },
  { id: 'linkCost', topic: 'Ce que coûte une liaison', words: ['prix canal', 'cout canal', 'prix rail', 'cout rail', 'double rail', 'deux rails'],
    answer: 'Un canal coûte 3 £ à l’ère canal, et une seule liaison par action. À l’ère rail, un rail coûte 5 £ et un charbon ; on peut en poser deux dans la même action pour 15 £, un charbon chacun et une bière, qui doit venir d’une brasserie et jamais du baril d’un marchand. Chaque rail doit atteindre une source de charbon une fois posé.' },
  { id: 'linkScore', topic: 'Ce que marque une liaison', words: ['liaison marque', 'canal points', 'lien icone', 'combien rapporte canal'],
    answer: 'En fin d’ère, chaque liaison marque les icônes « lien » des tuiles présentes dans les lieux qu’elle touche — toutes les tuiles, à qui qu’elles soient, retournées ou non — et deux points pour un emplacement marchand. Puis la liaison quitte le plateau. C’est pourquoi une liaison vers une ville bien bâtie vaut plus qu’une liaison vers le vide.' },
  { id: 'loan', topic: 'L’emprunt', words: ['emprunt', 'emprunter', 'prete', 'rembourse'],
    answer: 'Défaussez une carte et prenez 30 £ tout de suite. Votre marqueur de revenu recule de 3 niveaux, pas de 3 espaces, et se pose sur l’espace le plus haut du nouveau niveau. L’emprunt est refusé s’il fait descendre sous le niveau −10. Il ne se rembourse jamais : tôt dans la partie c’est de l’argent qui bâtit des tuiles, tard c’est une perte sèche de points.' },
  { id: 'develop', topic: 'Le développement', words: ['developper', 'developpement', 'ampoule', 'retirer tuile tapis'],
    answer: 'Défaussez une carte et retirez une ou deux tuiles de votre tapis, un fer par tuile retirée. Chaque tuile retirée doit être la plus basse restante de sa colonne au moment du retrait. Les poteries I et III portent une ampoule et ne se développent jamais. C’est ainsi qu’on atteint les niveaux forts sans gâcher une construction sur une tuile médiocre.' },
  { id: 'scout', topic: 'La prospection', words: ['prospection', 'scout', 'eclaireur', 'deux jokers'],
    answer: 'Défaussez trois cartes en tout et prenez un joker lieu et un joker industrie. C’est interdit si vous avez déjà un joker en main. Une main qui ne permet rien vaut cette dépense ; autrement, trois cartes pour deux, c’est cher.' },
  { id: 'income', topic: 'Le revenu', words: ['revenu', 'piste revenu', 'niveau revenu', 'espace niveau', 'paie'],
    answer: 'La piste de revenu compte des espaces, et les espaces se groupent en niveaux : c’est le niveau qui paie. Le retournement d’une tuile avance le marqueur du nombre d’espaces imprimé dessus ; un emprunt le recule de niveaux entiers. À la fin de chaque manche, chacun touche son niveau en livres — et le paie à la banque si le niveau est négatif.' },
  { id: 'order', topic: 'L’ordre du tour', words: ['ordre tour', 'qui joue premier', 'depense ordre', 'premier joueur'],
    answer: 'À la fin de chaque manche, l’ordre de la suivante se décide à l’argent dépensé : qui a le moins dépensé joue en premier. À dépense égale, l’ordre de la manche précédente tient. Dépenser peu achète donc le premier choix des emplacements de la manche d’après.' },
  { id: 'actions', topic: 'Le nombre d’actions', words: ['combien action', 'deux actions', 'premiere manche action', 'une action'],
    answer: 'Deux actions par tour, et chaque action coûte une carte défaussée, l’emprunt et le fait de passer compris. Seule exception : à la première manche de l’ère canal, une seule action chacun. En fin d’ère, une main réduite limite naturellement le nombre d’actions.' },
  { id: 'hand', topic: 'La main et la pioche', words: ['main huit', 'combien cartes', 'pioche', 'recompleter', 'pioche vide'],
    answer: 'Huit cartes en main, recomplétées après chaque tour tant que la pioche en a. Quand la pioche est vide, la main fond d’une carte par action et ne se recomplète plus. L’ère se termine quand la pioche et toutes les mains sont vides : dix manches à deux joueurs, neuf à trois, huit à quatre.' },
  { id: 'eraEnd', topic: 'La fin d’une ère', words: ['fin ere', 'fin canal', 'balayage', 'niveau 1 disparait', 'decompte', 'entre les eres', 'entre ere', 'passe entre'],
    answer: 'On compte d’abord les liaisons, puis les tuiles retournées ; les tuiles jamais retournées ne marquent rien. Ensuite les liaisons quittent le plateau. À la fin de l’ère canal seulement, toutes les tuiles de niveau 1 quittent aussi le plateau, retournées ou non. Les barils des marchands sont remis, les défausses rebattues, et chacun repioche huit cartes.' },
  { id: 'scoring', topic: 'Comment on marque des points', words: ['comment gagner points', 'points victoire', 'argent points', 'score final'],
    answer: 'Deux sources, comptées à la fin de chaque ère : les points imprimés sur vos tuiles retournées, et les icônes lien des lieux que vos liaisons touchent. L’argent en caisse ne vaut rien à la fin d’une partie complète — il n’est que le moyen. En cas d’égalité, le revenu le plus haut départage, puis l’argent restant.' },
  { id: 'railBeer', topic: 'Les brasseries à l’ère rail', words: ['brasserie deux barils', 'baril ere rail', 'brasserie rail'],
    answer: 'Une brasserie construite à l’ère canal reçoit un baril ; construite à l’ère rail, elle en reçoit deux. C’est la même tuile, c’est l’ère de sa construction qui décide.' },
  { id: 'farmBrewery', topic: 'Les brasseries fermières', words: ['brasserie fermiere', 'farm brewery', 'hors ville'],
    answer: 'Deux emplacements de brasserie sont posés hors des villes, sur la carte. Ils se bâtissent comme les autres, mais aucune carte lieu ne les nomme et le joker lieu y est refusé : seules une carte industrie brasserie ou un joker industrie les atteignent, et le lieu doit être dans votre réseau — sauf si vous n’avez encore rien sur le plateau.' },
  { id: 'deckSize', topic: 'Composition de la pioche', words: ['composition pioche', 'combien de cartes', 'taille du deck', 'cartes retirees joueurs'],
    answer: 'La pioche ne contient que des cartes Lieu et Industrie : 40 cartes à 2 joueurs, 54 à 3 et 64 à 4. À 2 joueurs, les villes bleues et turquoises sortent du paquet (Leek, Stoke, Stone, Uttoxeter, Belper, Derby) ; à 3 joueurs il ne manque que Belper, Derby et une carte Uttoxeter. Côté Industrie, le charbon passe de 2 à 3 cartes, la céramique de 2 à 3, la carte double coton/manufacture de 0 à 6 puis 8, tandis que le fer reste à 4 et la brasserie à 5. Les 4 Jokers Lieu et 4 Jokers Industrie vivent à part, en deux piles face visible, et ne sont jamais mélangés à la pioche.' },
  { id: 'faceDownCard', topic: 'Carte face cachée de la mise en place', words: ['carte face cachee', 'neuvieme carte', 'carte cachee defausse'],
    answer: 'À la mise en place vous recevez 8 cartes en main plus 1 carte piochée face cachée qui ouvre la défausse : elle n’est pas jouable. À la fin de l’ère canal, le moteur mélange la pioche restante, toutes les défausses — cette carte comprise — et les mains pour former la pioche de l’ère rail. Il redistribue alors 8 cartes et une nouvelle carte face cachée à chacun ; celle-là ne reviendra plus en jeu, la partie s’arrêtant au bout de l’ère rail.' },
  { id: 'wildDiscard', topic: 'Joker défaussé', words: ['joker defausse', 'joker retourne pile', 'jeter un joker'],
    answer: 'Un Joker joué ne part pas sur la défausse : le moteur le remet sur sa pile de Jokers, où un futur Éclaireur pourra le reprendre. Les Jokers ne rejoignent donc jamais la pioche de l’ère rail, contrairement aux cartes Lieu et Industrie.' },
  { id: 'scoutWithWild', topic: 'Éclaireur avec un joker en main', words: ['eclaireur joker main', 'scout avec joker', 'deja un joker'],
    answer: 'Non : l’action Éclaireur est refusée si vous tenez déjà un Joker, Lieu ou Industrie. Il vous faut par ailleurs au moins 3 cartes en main, puisque l’action en défausse 3, et au moins un Joker restant dans chacune des deux piles.' },
  { id: 'firstBuildAnywhere', topic: 'Construire sans rien sur le plateau', words: ['aucune tuile plateau', 'sans reseau construire', 'rien sur plateau', 'premiere tuile placer'],
    answer: 'Oui. Tant que vous n’avez ni tuile ni liaison sur le plateau, le moteur considère tout lieu comme faisant partie de votre réseau : une carte Industrie bâtit cette industrie n’importe où sur la carte, et n’importe quelle carte pose une liaison sur n’importe quelle ligne libre de l’ère. Dès votre première tuile ou liaison posée, la contrainte de réseau revient.' },
  { id: 'locationCardTown', topic: 'Carte Lieu hors de sa ville', words: ['carte lieu ville', 'lieu hors ville', 'carte ville ailleurs'],
    answer: 'Non. Une carte Lieu ne construit que dans la ville imprimée dessus — le moteur refuse tout autre emplacement en indiquant que cette carte ne bâtit que là — mais elle y autorise n’importe quelle industrie permise par l’emplacement, même si la ville est hors de votre réseau. Pour bâtir ailleurs il faut une carte Industrie dans votre réseau, ou un Joker Lieu.' },
  { id: 'merchantGoods', topic: 'Biens achetés par les marchands', words: ['marchand achete', 'tuile tous biens', 'quel marchand accepte', 'marchand vierge'],
    answer: 'Chaque marchand achète ce qu’affichent les tuiles Marchand qui lui ont été distribuées : coton, manufacture, céramique, ou « tous biens » qui accepte les trois à la fois. Une tuile vierge n’achète rien et ne porte aucun baril. Le lot dépend du nombre de joueurs : à 2 joueurs il vaut vierge, vierge, coton, manufacture et tous-biens, de sorte que la céramique ne peut se vendre que par la tuile « tous biens » ; Warrington n’ouvre qu’à 3 joueurs et Nottingham qu’à 4.' },
  { id: 'sellMany', topic: 'Plusieurs ventes en une action', words: ['plusieurs tuiles vendre', 'plusieurs ventes', 'vendre deux tuiles', 'industries differentes vente'],
    answer: 'Oui : une seule carte défaussée couvre autant de ventes que vous voulez dans la même action, et les tuiles peuvent être d’industries différentes et passer par des marchands différents. Chaque tuile doit être connectée à son marchand et paie sa propre bière — 1 ou 2 barils selon la tuile — et chacune avance votre revenu à son retournement.' },
  { id: 'doubleRailBarrel', topic: 'Baril marchand et double liaison rail', words: ['baril marchand rail', 'double rail biere', 'biere double liaison'],
    answer: 'Non. Pour la double liaison de l’ère rail, le moteur ne propose que des brasseries : la vôtre où qu’elle soit sur le plateau, ou celle d’un adversaire connectée à la seconde liaison une fois celle-ci posée. Le baril posé à côté d’une tuile Marchand ne se boit que pendant une action Vente, car c’est lui qui déclenche le bonus du marchand.' },
  { id: 'coalOrder', topic: 'Ordre de consommation du charbon', words: ['ordre charbon', 'mine la plus proche', 'quel charbon utilise', 'charbon prioritaire'],
    answer: 'Le charbon vient d’abord des mines non retournées connectées au lieu par les liaisons, la plus proche d’abord en nombre de liaisons et tous propriétaires confondus, et il est gratuit. À distance égale le règlement laisse le choix au joueur ; le moteur, lui, tranche pour la mine qui contient le plus de cubes. Les mines connectées épuisées, on achète au marché, mais seulement si un emplacement marchand est relié au lieu — sinon la construction est refusée faute de charbon connecté.' },
  { id: 'ironConnection', topic: 'Connexion nécessaire pour le fer', words: ['fer connexion', 'fer sans liaison', 'fer distance'],
    answer: 'Aucune. Le fer se prend sur n’importe quelle sidérurgie non retournée du plateau, quel que soit son propriétaire et sans la moindre liaison, et à défaut au marché du fer, là encore sans connexion. Le moteur vous laisse désigner la sidérurgie qui fournit le cube, et ne bascule sur le marché que lorsque plus aucune sidérurgie du plateau n’a de cube à donner.' },
  { id: 'marketEmpty', topic: 'Marché vide', words: ['marche vide charbon', 'marche vide fer', 'plus de cubes marche', 'prix marche vide'],
    answer: 'Un marché vide n’empêche pas d’acheter : chaque cube coûte alors £8 au charbon et £6 au fer, sans limite de quantité. Avant cela on paie case par case en partant de la moins chère, de £1 à £7 pour le charbon et de £1 à £5 pour le fer. Rien ne recharge les marchés : seule la construction d’une mine ou d’une sidérurgie y remet des cubes.' },
  { id: 'marketFillTiming', topic: 'Quand les cubes partent au marché', words: ['quand cubes marche', 'remplir le marche', 'cubes vendus construction', 'marche se recharge'],
    answer: 'Uniquement au moment de la construction. Une sidérurgie neuve verse toujours ses cubes au marché du fer ; une mine neuve ne verse au marché du charbon que si elle est reliée à un emplacement marchand. Les cubes remplissent les cases les plus chères d’abord, vous en encaissez la valeur imprimée, et si la tuile se vide entièrement elle est retournée sur-le-champ. Une fois posée, la tuile ne vendra plus jamais de cube au marché.' },
  { id: 'developLowest', topic: 'Choisir la tuile développée', words: ['developper tuile choisie', 'developper niveau superieur', 'choisir tuile developpement'],
    answer: 'Non : le moteur ne vous propose que la tuile du dessus de chaque pile, c’est-à-dire le plus bas niveau restant de cette industrie. Les céramiques à ampoule, niveaux I et III, ne sont jamais retirables par Développement et le moteur le refuse explicitement ; seule une construction les enlève du tapis.' },
  { id: 'developTwoCost', topic: 'Développer deux tuiles', words: ['developper deux tuiles', 'deux tuiles une carte', 'double developpement cout'],
    answer: 'La carte est la même : Développer défausse une seule carte, que vous retiriez une ou deux tuiles. Ce qui double, c’est le fer — 1 cube par tuile retirée. Deux retraits dans la même industrie enlèvent la tuile du dessus puis celle qui se trouve juste en dessous, à condition qu’elle ne porte pas l’ampoule.' },
  { id: 'passCost', topic: 'Coût de passer', words: ['passer coute', 'passer tour', 'passe carte', 'passer une action'],
    answer: 'Passer coûte une carte par action passée, exactement comme n’importe quelle autre action : la carte part sur la défausse et rien d’autre ne se produit. Si vous ne désignez pas la carte, le moteur défausse la première de votre main.' },
  { id: 'spendOrder', topic: 'Argent dépensé et ordre du tour', words: ['argent depense ordre', 'who joue premier', 'depense ordre tour', 'achats marche ordre'],
    answer: 'Oui : tout ce que vous avez payé pendant la manche compte — le prix des tuiles, les £3 ou £5 des liaisons, les £15 de la double liaison, et le charbon comme le fer achetés au marché. L’argent encaissé ne compense rien : ni la vente de cubes au marché à la construction, ni l’emprunt, ni le revenu. En fin de manche, celui qui a le moins dépensé joue en premier ; à égalité, l’ordre relatif précédent est conservé.' },
  { id: 'canalSecondLink', topic: 'Deux liaisons à l’ère canal', words: ['deux liaisons canal', 'double canal', 'deuxieme canal action'],
    answer: 'Non : à l’ère canal, une action Réseau pose exactement une liaison, pour £3 et sans charbon. La double liaison est une option de l’ère rail — £15 au total, 1 charbon par liaison et 1 baril de bière pris sur une brasserie — et le moteur refuse toute tentative à l’ère canal.' },
  { id: 'refillEight', topic: 'Recompléter sa main', words: ['recompleter main', 'repiocher apres tour', 'main huit cartes'],
    answer: 'À la fin de votre tour vous repiochez jusqu’à 8 cartes, jamais plus. Quand la pioche est vide, la main ne se recomplète plus et fond d’une manche à l’autre ; un joueur sans carte ne joue pas de tour, et l’ère s’achève quand la pioche et toutes les mains sont vides.' },
  { id: 'wildBuildReach', topic: 'Portée des jokers', words: ['joker lieu reseau', 'joker industrie reseau', 'joker construire partout'],
    answer: 'Un Joker Lieu construit dans la ville de votre choix, même hors de votre réseau, mais jamais sur les deux brasseries fermières, qui n’acceptent que les cartes Industrie. Un Joker Industrie construit l’industrie de votre choix, mais seulement dans un lieu de votre réseau — sauf si vous n’avez encore ni tuile ni liaison sur le plateau, auquel cas tout le plateau vous est ouvert.' },
  { id: 'cottonCard', topic: 'Carte coton ou manufacture', words: ['carte coton seule', 'carte double coton', 'carte manufacture coton'],
    answer: 'Il n’existe pas de carte Coton seule ni de carte Manufacture seule : les deux industries partagent une carte double qui sert pour l’une ou l’autre. Le moteur en place 8 dans la pioche à 4 joueurs, 6 à 3 joueurs et aucune à 2 joueurs — à deux, une filature ou une manufacture ne se bâtit donc que par carte Lieu ou par Joker.' },
  { id: 'wildPilesLeft', topic: 'Nombre de jokers en jeu', words: ['combien de jokers', 'pile joker vide', 'jokers disponibles'],
    answer: 'Il y a 4 Jokers Lieu et 4 Jokers Industrie, en deux piles face visible à côté de la pioche. Chaque Éclaireur en retire un de chaque, chaque Joker joué y retourne, et l’action est refusée dès que l’une des deux piles est vide.' },
  { id: 'sellConnection', topic: 'Connexion requise pour vendre', words: ['vendre connexion marchand', 'tuile connectee marchand', 'vendre sans liaison'],
    answer: 'La tuile vendue doit être reliée au marchand par une chaîne de liaisons de l’ère en cours, propriétaires confondus, et ce marchand doit afficher une tuile qui achète cette industrie. Faute de chemin, la tuile n’apparaît tout simplement pas parmi les cibles de vente. Seules les filatures, manufactures et céramiques se vendent : mines, sidérurgies et brasseries se retournent en se vidant.' },
  { id: 'rivalBeer', topic: 'Bière d’un adversaire pour une vente', words: ['biere adversaire connectee', 'brasserie adverse vente', 'biere brasserie adverse'],
    answer: 'Pour une vente, vos propres brasseries non retournées fournissent un baril où qu’elles soient sur le plateau ; celles d’un adversaire ne comptent que si la tuile vendue leur est connectée. Le moteur boit d’abord le baril du marchand quand il en reste un, parce qu’il apporte le bonus, puis vos brasseries, puis celles des autres — mais vous pouvez désigner vous-même chaque source.' },
  { id: 'developIronCost', topic: 'Le fer du développement', words: ['fer developpement cout', 'developper payer fer', 'developpement marche fer'],
    answer: 'Développer ne coûte pas d’argent en soi : 1 carte et 1 cube de fer par tuile retirée. Le fer est gratuit s’il vient d’une sidérurgie non retournée du plateau, quelle qu’elle soit et sans condition de connexion ; s’il n’en reste aucune, il est acheté au marché du fer et le moteur refuse l’action si vous ne pouvez pas payer ce prix.' },
  { id: 'matColumn', topic: 'Choix de la tuile dans la colonne du tapis', words: ['tuile plus basse', 'colonne tapis', 'niveau le plus bas', 'choisir tuile colonne'],
    answer: 'Vous construisez toujours la tuile du plus bas niveau encore présente dans la colonne de cette industrie sur votre tapis — vous ne choisissez jamais un niveau plus haut. Chaque construction retire cette tuile et découvre la suivante, donc la colonne monte en niveau au fil de la partie. L’action Développer retire elle aussi une tuile par le haut de la colonne, sans rien poser sur le plateau, ce qui fait monter la colonne sans construire.' },
  { id: 'cottonCost', topic: 'Coût des filatures de coton', words: ['filature coute', 'prix filature', 'cout filature coton', 'filature niveau'],
    answer: 'Filature I : £12, sans aucun charbon ni fer — c’est la seule filature qui ne consomme rien. II : £14 et 1 charbon. III : £16 avec 1 charbon et 1 fer, IV : £18 avec 1 charbon et 1 fer. Les revenus vont de +5 à +2 espaces et les PV de 5 à 12 en montant les niveaux ; chaque filature se vend contre 1 baril de bière.' },
  { id: 'manufacturerCost', topic: 'Coût des manufactures et leurs exceptions', words: ['manufacture coute', 'prix manufacture', 'manufacture deux bieres', 'manufacture sans lien'],
    answer: 'Manufacture I : £8 et 1 charbon ; II : £10 et 1 fer ; III : £12 et 2 charbons ; IV : £8 et 1 fer. V : £16 et 1 charbon ; VI : £20 sans aucune ressource ; VII : £16 avec 1 charbon et 1 fer ; VIII : £20 et 2 fers. Deux exceptions à retenir : les niveaux III et VII n’ont aucune icône de lien et ne rapportent donc rien aux liaisons voisines, et le niveau V réclame 2 barils de bière pour être vendu. Toutes les autres manufactures se vendent contre 1 baril.' },
  { id: 'coalCubes', topic: 'Coût de la mine et cubes posés', words: ['mine charbon coute', 'combien cubes mine', 'cubes mine charbon', 'prix mine'],
    answer: 'Mine I : £5, 2 cubes posés ; II : £7, 3 cubes ; III : £8 avec 1 fer, 4 cubes ; IV : £10 avec 1 fer, 5 cubes. Les cubes sont posés sur la tuile à la construction et servent ensuite n’importe quel joueur relié à elle. Les revenus sont de +4, +7, +6 et +5 espaces, et les PV de 1, 2, 3 et 4.' },
  { id: 'ironBars', topic: 'Coût de la forge et barres posées', words: ['forge coute', 'combien fer forge', 'barres forge', 'prix siderurgie'],
    answer: 'Forge I : £5 et 1 charbon, 4 barres de fer posées ; II : £7 et 1 charbon, 4 barres ; III : £9 et 1 charbon, 5 barres ; IV : £12 et 1 charbon, 6 barres. Chaque niveau consomme exactement 1 charbon à la construction, jamais de fer. Les revenus sont de +3, +3, +2 et +1 espaces, et les PV de 3, 5, 7 et 9.' },
  { id: 'potteryCost', topic: 'Coût des poteries et tuiles à ampoule', words: ['poterie coute', 'prix poterie', 'ampoule', 'ceramique coute'],
    answer: 'Poterie I : £17 et 1 fer, 10 PV ; II : gratuite mais 1 charbon, 1 PV ; III : £22 et 2 charbons, 11 PV ; IV : gratuite avec 1 charbon, 1 PV ; V : £24 et 2 charbons, 20 PV. Les niveaux I et III portent l’ampoule : ils ne peuvent pas être retirés par Développer, seule la construction les fait quitter le tapis — la V, elle, est développable. La poterie I est la seule tuile de niveau 1 du jeu constructible aussi à l’ère rail, tandis que la V est réservée à l’ère rail. Les I et III se vendent contre 1 et 2 barils, les II et IV contre 1, la V contre 2.' },
  { id: 'breweryBarrels', topic: 'Coût de la brasserie et barils par ère', words: ['brasserie coute', 'combien barils brasserie', 'barils brasserie ere', 'prix brasserie'],
    answer: 'Brasserie I : £5 et 1 fer ; II : £7 et 1 fer ; III : £9 et 1 fer ; IV : £9 et 1 fer, celle-ci constructible seulement à l’ère rail. Le nombre de barils ne dépend pas du niveau mais de l’ère : 1 baril à l’ère canal, 2 barils à l’ère rail, pour tous les niveaux — c’est bien ce que le jeu applique. Les revenus sont de +4 puis +5 espaces, les PV de 4, 5, 7 et 9, et chaque brasserie porte 2 icônes de lien.' },
  { id: 'flipRules', topic: 'Ce qui retourne une tuile', words: ['tuile se retourne', 'quand retourner tuile', 'pourquoi tuile retournee', 'condition flip'],
    answer: 'Une mine ou une forge se retourne quand son dernier cube part, une brasserie quand son dernier baril est bu — même si c’est un adversaire qui consomme la ressource. Une filature, une manufacture ou une poterie ne se retourne qu’en étant vendue à un marchand relié à elle. Une forge, et une mine reliée à un emplacement marchand, se vident vers le marché dès la construction et se retournent aussitôt si tout part. Le retournement fait avancer votre revenu du nombre imprimé et rend la tuile éligible aux PV de fin d’ère.' },
  { id: 'tileIncomeNumber', topic: 'Le chiffre de revenu imprimé sur la tuile', words: ['chiffre revenu tuile', 'revenu imprime tuile', 'revenu espaces niveaux', 'avancer marqueur revenu'],
    answer: 'Le chiffre de revenu d’une tuile est un nombre d’espaces de la piste Progression, pas de niveaux : une mine II retournée avance votre marqueur de 7 espaces, pas de 7 niveaux. La piste compte 100 espaces et un niveau coûte de plus en plus d’espaces — 1 espace par niveau jusqu’à l’espace 10, puis 2 espaces jusqu’au 30, 3 jusqu’au 60 et 4 au-delà. Seul l’emprunt déplace le marqueur en niveaux, en le faisant reculer de 3 niveaux.' },
  { id: 'tileLinkIcon', topic: 'Les icônes de lien d’une tuile', words: ['icone lien tuile', 'chiffre lien tuile', 'combien icones lien', 'icones liaison'],
    answer: 'Le nombre d’icônes de lien d’une tuile — 0, 1 ou 2 — est le nombre de PV qu’elle donne à chaque liaison voisine au décompte de fin d’ère. Une liaison marque la somme des icônes de lien de toutes les tuiles posées à ses deux extrémités, retournées ou non, et un emplacement marchand compte forfaitairement pour 2. Les manufactures III et VII n’ont aucune icône ; la filature II, les manufactures I et V, la mine I et les quatre brasseries en ont 2, toutes les autres tuiles en ont 1.' },
  { id: 'matEraIcon', topic: 'Les icônes canal et rail du tapis', words: ['icone canal tapis', 'icone rail tuile', 'constructible ere rail', 'tuile bloquee ere'],
    answer: 'L’icône canal à gauche d’une tuile du tapis signifie qu’elle ne peut être construite qu’à l’ère canal, l’icône rail qu’elle attend l’ère rail, et l’absence d’icône qu’elle passe dans les deux ères. Toutes les tuiles de niveau 1 portent l’icône canal, sauf la poterie I qui se construit dans les deux ères ; seules la poterie V et la brasserie IV portent l’icône rail. Une tuile canal encore sur votre tapis à l’ère rail ne peut plus en sortir que par Développer, et le jeu refuse la construction en disant que ce niveau ne peut pas être bâti dans l’ère en cours.' },
  { id: 'tileSlotIcons', topic: 'Les icônes d’un emplacement de ville', words: ['emplacement icone industrie', 'ou poser tuile', 'emplacement double icone', 'emplacement refuse industrie'],
    answer: 'Chaque emplacement d’une ville affiche une ou plusieurs icônes d’industrie et n’accepte que celles-là : une filature ne peut aller que sur un emplacement portant l’icône coton. Un emplacement à double icône accepte l’une ou l’autre des deux industries, et les clics successifs font défiler les choix possibles. Si un emplacement est déjà occupé par une autre industrie, le jeu refuse en le disant ; il ne reste alors que la sur-construction d’une tuile de la même industrie.' },
  { id: 'overbuildTile', topic: 'Sur-construire une tuile', words: ['surconstruire', 'sur construire', 'remplacer tuile adversaire', 'construire par dessus'],
    answer: 'Sur-construire, c’est poser une tuile sur une tuile déjà en place de la même industrie et d’un niveau strictement supérieur. Sur vos propres tuiles c’est toujours permis, qu’elles soient retournées ou non ; sur la tuile d’un adversaire, seules les mines de charbon et les forges le peuvent, et seulement s’il ne reste plus aucun cube de cette ressource nulle part — ni sur une tuile du plateau, ni sur le marché. À l’ère canal, la sur-construction est la seule façon de reposer une tuile dans une ville où vous en avez déjà une, car l’emplacement remplacé ne compte pas dans la limite d’une tuile par lieu.' },
  { id: 'oneTilePerPlace', topic: 'Une tuile par lieu à l’ère canal', words: ['une tuile par lieu', 'deux tuiles meme ville', 'limite ere canal', 'plusieurs tuiles ville'],
    answer: 'À l’ère canal, vous ne pouvez posséder qu’une seule tuile Industrie par lieu : le jeu refuse une deuxième tuile dans une ville où vous en avez déjà une, même sur un emplacement libre. La limite disparaît à l’ère rail, où vous pouvez occuper plusieurs emplacements du même lieu. Elle ne s’applique pas à la sur-construction de votre propre tuile, puisque vous ne faites alors que la remplacer.' },
  { id: 'tileRemovedFate', topic: 'Sort d’une tuile sur-construite ou vendue pour dette', words: ['tuile surconstruite devient', 'tuile retiree plateau', 'dette vend tuiles', 'manque argent tuiles'],
    answer: 'Une tuile sur-construite quitte définitivement la partie avec les ressources qui restaient dessus et ne rapporte plus aucun PV de fin d’ère ; en revanche le revenu et les PV qu’elle vous avait déjà donnés vous restent acquis. Si votre argent est négatif au moment du revenu, le jeu liquide vos tuiles en commençant par les moins chères, chacune rendant la moitié de son coût de construction arrondie à l’inférieur, et ces tuiles quittent aussi le plateau. Ce qui manque encore après la liquidation se paie en points de victoire, un point par livre.' },
  { id: 'matTileCounts', topic: 'Nombre de tuiles sur le tapis', words: ['combien tuiles tapis', 'nombre tuiles industrie', 'combien filatures', 'plus de tuiles'],
    answer: 'Chaque joueur dispose de 45 tuiles Industrie : 11 filatures, 11 manufactures, 7 mines de charbon, 7 brasseries, 5 poteries et 4 forges. Elles sont rangées en six colonnes, du plus bas au plus haut niveau, et chaque niveau existe en un nombre fixe d’exemplaires — par exemple 3 filatures I, 2 filatures II, puis 3 et 3. Quand une colonne est vide, cette industrie ne peut plus être construite et le jeu répond qu’il ne reste plus de tuiles de ce type.' },
  { id: 'tileVpNumber', topic: 'Les PV imprimés sur une tuile', words: ['points victoire tuile', 'pv imprime tuile', 'tuile non retournee points', 'combien pv tuile'],
    answer: 'Le chiffre de PV d’une tuile n’est marqué qu’au décompte de fin d’ère, et seulement si la tuile est retournée : une tuile encore à l’endroit vaut zéro. Les plus gros lots sont la poterie V à 20 PV, la filature IV à 12 PV, puis la manufacture VIII et la poterie III à 11 PV ; les mines valent de 1 à 4 PV et les poteries II et IV 1 PV. Une tuile retournée reste sur le plateau et marque de nouveau au décompte de l’ère rail, sauf si elle est de niveau 1 : celles-là sont retirées entre les deux ères.' },
  { id: 'sweepLevelOne', topic: 'Retrait des tuiles de niveau 1', words: ['tuiles niveau 1', 'retirer niveau 1', 'balayage tuiles', 'niveau 1 rail'],
    answer: 'Après le décompte de l’ère canal, toutes les tuiles de niveau 1 quittent le plateau, retournées ou non, et ne rapportent plus rien ensuite. Les liaisons canal disparaissent en même temps, après avoir marqué. Les tuiles de niveau 2 et plus restent en place telles quelles et compteront au décompte final si elles sont retournées.' },
  { id: 'potteryFreeTiles', topic: 'Les poteries gratuites', words: ['poterie gratuite', 'poterie coute rien', 'poterie zero livre'],
    answer: 'Les poteries II et IV ne coûtent aucune livre, seulement 1 charbon : elles ne rapportent qu’1 PV et un seul espace de revenu. Elles se retirent par Développer ou se construisent à bas prix pour découvrir la poterie III puis la poterie V, qui valent 11 et 20 PV. Elles se vendent comme les autres poteries, contre 1 baril de bière.' },
  { id: 'progressBands', topic: 'Bandes de la piste Progression', words: ['piste progression', 'bandes revenu', 'espaces niveaux', 'espace niveau revenu'],
    answer: 'La piste compte 100 espaces, de 0 à 99, et chaque espace affiche le niveau de revenu qu’il paie. Les espaces 0 à 10 valent les niveaux −10 à 0, un espace par niveau ; les espaces 11 à 30 valent les niveaux 1 à 10, deux espaces par niveau ; les espaces 31 à 60 valent les niveaux 11 à 20, trois espaces par niveau ; les espaces 61 à 96 valent les niveaux 21 à 29, quatre espaces par niveau. Les trois derniers espaces, 97 à 99, valent tous le niveau 30 — le plafond.' },
  { id: 'markersStart', topic: 'Départ des marqueurs', words: ['depart marqueur revenu', 'marqueur victoire depart', 'ou commence revenu'],
    answer: 'Votre marqueur de revenu commence sur l’espace 10 de la piste Progression, qui affiche le niveau £0 : votre première paie est donc nulle, ni gain ni perte. Votre marqueur de points de victoire commence sur 0.' },
  { id: 'spacesVsLevels', topic: 'Espaces contre niveaux', words: ['difference espaces niveaux', 'avancer espaces', 'reculer niveaux', 'espaces ou niveaux'],
    answer: 'Une tuile qui se retourne fait avancer votre marqueur d’un nombre d’espaces ; un emprunt, lui, vous fait reculer de 3 niveaux et repose le marqueur sur l’espace le plus haut du niveau atteint. La différence compte : dans le haut de la piste, quatre espaces ne valent qu’un seul niveau, si bien qu’avancer de 4 espaces peut n’ajouter qu’une livre de revenu, tandis qu’un emprunt vous coûte toujours trois livres de revenu d’un coup.' },
  { id: 'flipNoRaise', topic: 'Un retournement qui ne monte pas la paie', words: ['revenu pas augmente', 'revenu augmente pas', 'revenu monte pas', 'revenu pas monte', 'revenu pas bouge', 'paie pas augmente', 'paie monte pas', 'retourne revenu pareil', 'retourne revenu pas monte', 'retourne revenu pas augmente', 'tuile revenu pas monte', 'tuile revenu pas augmente', 'retourne paie pas monte'],
    answer: 'Le chiffre imprimé sur la tuile compte des espaces, pas des livres : retournée, elle avance votre marqueur d’autant d’espaces sur la piste, et la paie ne monte que lorsque le marqueur franchit la limite d’un niveau. Au-delà de l’espace 10, un niveau s’étend sur 2 espaces, puis 3, puis 4. Exemple : un marqueur sur l’espace 17 (niveau 4, espaces 17 et 18) qui avance d’un espace arrive sur 18 — toujours le niveau 4, toujours 4 £ par paie ; un espace de plus, et il passait au niveau 5. En survolant la piste de revenu, chaque cran montre ses cases et chaque pion ce qu’il lui manque pour le suivant.' },
  { id: 'roundEndOrder', topic: 'Séquence de fin de manche', words: ['ordre fin manche', 'etapes fin manche', 'que se passe manche'],
    answer: 'Le jeu recalcule d’abord l’ordre du tour : celui qui a le moins dépensé pendant la manche jouera en premier, le plus dépensier en dernier, et en cas d’égalité l’ordre relatif est conservé ; les compteurs de dépense repartent alors de zéro. Vient ensuite la paie : chacun encaisse son revenu, sauf à la toute dernière manche de la partie. Enfin, si la pioche et toutes les mains sont vides, l’ère s’achève et le décompte s’enchaîne ; sinon la manche suivante commence, premier joueur en tête, avec 2 actions chacun.' },
  { id: 'paydayShortfall', topic: 'Revenu négatif et bourse vide', words: ['revenu negatif', 'paie negative', 'pas assez payer revenu'],
    answer: 'Sous le niveau 0, la paie est négative et c’est vous qui payez la banque. Si votre bourse n’y suffit pas, le jeu retire de vos tuiles Industrie du plateau — jamais vos liaisons — chacune rendant la moitié de son coût arrondie à l’inférieur, jusqu’à combler le manque, et l’excédent vous reste ; les tuiles retirées sortent du jeu. À la table, c’est le joueur qui choisit ses tuiles : ici le moteur sacrifie automatiquement les moins chères d’abord. S’il manque encore de l’argent, vous perdez 1 PV par £1 manquant et votre bourse retombe à zéro.' },
  { id: 'noTileSale', topic: 'Brader une tuile pour de l’argent', words: ['vendre une tuile', 'revendre tuile', 'brader tuile'],
    answer: 'Non : une tuile posée ne se brade que pendant la paie, et seulement pour couvrir un revenu négatif que votre bourse ne peut pas payer. Aucune action du jeu ne permet de revendre une industrie pour renflouer vos caisses, et les tuiles Liaison ne sont jamais reprises.' },
  { id: 'characterTileMoney', topic: 'Argent posé sur la tuile Personnage', words: ['tuile personnage argent', 'argent depense personnage', 'a quoi sert personnage'],
    answer: 'L’argent que vous dépensez pendant la manche est compté sur votre tuile Personnage : il ne sert qu’à mesurer vos dépenses. En fin de manche, le moins dépensier joue en premier et le plus dépensier en dernier, puis cet argent retourne à la banque et les compteurs repartent de zéro. Vous ne le récupérez jamais — seule la place dans l’ordre du tour en dépend.' },
  { id: 'eraEndOrder', topic: 'Séquence de fin d’ère', words: ['ordre fin ere', 'etapes fin ere', 'sequence decompte ere'],
    answer: 'Une ère s’achève dès que la pioche et toutes les mains sont vides, à la fin de la manche en cours et après la paie. Le décompte suit : chaque liaison vous rapporte 1 PV par icône « lien » des lieux qu’elle touche, chaque tuile Industrie retournée rapporte les PV imprimés en bas à gauche, puis toutes les tuiles Liaison quittent le plateau. À la fin de l’ère canal, l’écran de décompte est suivi du balayage — tuiles de niveau 1 retirées, bière marchande réarmée, cartes remélangées et redistribuées — avant que l’ère rail ne commence.' },
  { id: 'linkVpDetail', topic: 'Compte exact des PV d’une liaison', words: ['icone lien', 'liaison rapporte combien', 'liaison marchand points'],
    answer: 'Chaque liaison qui vous appartient rapporte 1 PV par icône « lien » présente sur les tuiles posées dans les deux lieux qu’elle relie, quel que soit le propriétaire de ces tuiles. Une tuile Industrie affiche 0, 1 ou 2 icônes selon son type et son niveau, et un emplacement marchand compte toujours pour 2. La liaison Kidderminster–Worcester touche en plus la brasserie fermière du sud, qui n’a pas d’icône et n’ajoute donc rien.' },
  { id: 'unflippedVp', topic: 'Tuile non retournée au décompte', words: ['tuile non retournee', 'pas retournee rapporte', 'tuile pas retournee'],
    answer: 'Une tuile encore posée côté noir, non retournée, ne rapporte aucun point de victoire au décompte. Seules les tuiles retournées comptent leurs PV imprimés ; le panneau de décompte affiche à part ce que vos tuiles non retournées rapporteraient si elles se vidaient à temps.' },
  { id: 'reshuffleBetweenEras', topic: 'Cartes remélangées entre les ères', words: ['cartes remelangees', 'nouvelle pioche ere', 'redistribution cartes ere'],
    answer: 'Au passage à l’ère rail, toutes les cartes reviennent : les défausses, les cartes face cachée du début et ce qui restait en main sont remélangées en une pioche neuve — 64 cartes à quatre joueurs, 54 à trois, 40 à deux. Chacun reçoit alors 8 cartes en main plus 1 carte face cachée qui ouvre sa défausse, exactement comme à la mise en place. Les deux piles de jokers, Lieu et Industrie, restent à part et ne sont jamais mélangées à la pioche.' },
  { id: 'gameEndTie', topic: 'Fin de partie et égalité', words: ['egalite vainqueur', 'departage', 'meme nombre points'],
    answer: 'La partie s’arrête à la fin de la dernière manche de l’ère rail, une fois le décompte de cette ère fait ; cette manche-là ne donne pas de paie. Le vainqueur est celui qui a le plus de PV ; à égalité, on compare le niveau de revenu, puis l’argent restant. Si tout reste égal, le moteur désigne malgré tout un seul vainqueur, le premier dans l’ordre des sièges, là où le livret déclarerait une victoire partagée.' },
  { id: 'initiationBonus', topic: 'Variante partie d’initiation', words: ['partie initiation', 'bonus initiation', 'canal seulement'],
    answer: 'La partie d’initiation s’arrête à la fin de l’ère canal : il n’y a pas d’ère rail, et la dernière manche ne donne pas de paie. Après le décompte normal de l’ère, chacun ajoute +1 PV par tranche de £4 en caisse, plafonné à 15 PV, plus autant de PV que son niveau de revenu — un niveau négatif retire des points. Chacun recompte enfin les PV de ses tuiles Industrie retournées de niveau 2 ou plus, puis on désigne le vainqueur.' },
  { id: 'roundsPerEra', topic: 'Nombre de manches par ère', words: ['combien manches', 'nombre manches ere', 'duree ere'],
    answer: 'Chaque ère dure 10 manches à deux joueurs, 9 à trois et 8 à quatre ; le bandeau du haut affiche la manche en cours et ce total. Ce nombre découle de la pioche — 40, 54 ou 64 cartes — puisque l’ère se termine exactement quand la pioche et toutes les mains sont vides. La première manche de l’ère canal ne donne qu’une seule action, toutes les autres en donnent deux.' },
  { id: 'startingPurse', topic: 'Dotation de départ', words: ['argent depart', 'combien argent debut', 'cartes depart'],
    answer: 'Vous commencez la partie avec £17 et 8 cartes en main, plus 1 carte face cachée qui ouvre votre défausse. Vos marqueurs sont posés sur 0 PV et sur l’espace 10 de la piste Progression, soit un revenu de £0. Votre tapis porte 45 tuiles Industrie rangées par type et par niveau, du plus bas au plus haut.' },
  { id: 'incomeCeiling', topic: 'Plafond et plancher du revenu', words: ['revenu maximum', 'plafond revenu', 'revenu minimum'],
    answer: 'Le revenu plafonne au niveau 30 : les espaces 97 à 99 paient tous £30 et le marqueur ne va pas plus loin. Vers le bas, il ne descend pas sous l’espace 0, soit −£10 ; un emprunt qui vous ferait passer sous ce niveau est refusé par le jeu, qui vous dit que le revenu ne peut pas descendre plus bas.' },
  { id: 'lastRoundNoPayday', topic: 'Pas de paie à la dernière manche', words: ['derniere manche revenu', 'pas de paie derniere', 'revenu derniere manche'],
    answer: 'Le jeu saute la paie de la toute dernière manche de la partie : la dernière manche de l’ère rail, ou la dernière manche de l’ère canal dans une partie d’initiation. Toutes les autres fins de manche paient normalement, y compris la dernière manche de l’ère canal dans une partie complète.' },
  { id: 'merchantRearmEra', topic: 'Réarmement des marchands entre les ères', words: ['barils marchands ere', 'marchands rearmes', 'biere marchande revient'],
    answer: 'Au passage à l’ère rail, chaque emplacement marchand récupère un baril de bière par tuile Marchand non vierge, et les bonus marchands déjà pris redeviennent disponibles. Les tuiles Brasserie des joueurs, elles, gardent simplement les barils qui leur restent : rien ne les réapprovisionne.' },
  { id: 'emptyDeckPlay', topic: 'Quand la pioche est vide', words: ['pioche vide', 'plus de cartes piocher', 'pioche epuisee'],
    answer: 'Quand la pioche est vide, on ne complète plus sa main : chacun joue les cartes qui lui restent, deux par manche. Un joueur qui n’a plus de carte est simplement sauté, et l’ère s’achève au bout de la manche où la pioche et toutes les mains sont vides.' },
  { id: 'keepMoneyBetweenEras', topic: 'Ce qui survit au changement d’ère', words: ['garder argent ere', 'argent entre eres', 'revenu entre eres'],
    answer: 'Votre argent, votre niveau de revenu, vos points de victoire et vos emprunts passent tels quels de l’ère canal à l’ère rail : rien n’est remis à zéro. Seules changent les cartes, remélangées et redistribuées, les tuiles de niveau 1, retirées du plateau, et les liaisons, toutes reprises au décompte.' },
  { id: 'boardTowns', topic: 'Les villes et les emplacements d’industrie', words: ['combien de villes', 'nombre de villes', 'emplacement industrie', 'cases industrie', 'vingt villes'],
    answer: 'Le plateau porte 20 villes à bâtir, 2 brasseries fermières hors des villes et 5 emplacements marchands en bord de carte. Les 20 villes totalisent 47 emplacements d’industrie : un emplacement est une case imprimée qui ne reçoit jamais qu’une seule tuile, et les icônes dessinées dessus disent quelles industries y sont admises. Chaque brasserie fermière n’offre qu’un emplacement, réservé à la brasserie.' },
  { id: 'biggestTowns', topic: 'Les villes à trois ou quatre emplacements', words: ['quatre emplacements', 'trois emplacements', 'birmingham emplacements', 'plus grande ville'],
    answer: 'Birmingham est la seule ville à quatre emplacements : coton ou manufacture, manufacture, sidérurgie, manufacture. Cinq villes en ont trois — Coventry, Coalbrookdale, Stoke-on-Trent, Belper et Derby. Les quatorze autres en ont deux.' },
  { id: 'doubleIconSlot', topic: 'Un emplacement à deux icônes', words: ['double icone', 'deux icones', 'deux industries emplacement', 'emplacement mixte'],
    answer: 'Un emplacement qui affiche deux icônes accepte l’une ou l’autre de ces deux industries, au choix de celui qui bâtit — jamais les deux : une fois la tuile posée, l’emplacement est pris. Ainsi la case poterie ou sidérurgie de Stoke-on-Trent sera l’une ou l’autre selon qui arrive le premier. Sur le plateau, cliquer l’emplacement fait alterner les deux industries proposées.' },
  { id: 'slotIconsMeaning', topic: 'Les petites icônes d’un emplacement', words: ['petites icones', 'icones veulent dire', 'symboles emplacement', 'icone emplacement vide'],
    answer: 'Sur un emplacement vide, les icônes nomment les industries admises : filature de coton, manufacture, mine de charbon, sidérurgie, poterie, brasserie. Une fois la tuile posée, les icônes que vous voyez sont les siennes : son niveau, les cubes de charbon ou de fer et les barils de bière qu’elle porte, et ses icônes « lien » — 0, 1 ou 2 selon la tuile — qui rapportent un point à chaque liaison voisine en fin d’ère.' },
  { id: 'merchantPlaces', topic: 'Les emplacements marchands', words: ['emplacements marchands', 'combien marchands', 'shrewsbury', 'nottingham', 'warrington'],
    answer: 'Cinq marchands bordent la carte : Shrewsbury (1 case de tuile), Warrington, Nottingham, Oxford et Gloucester (2 cases chacun). Shrewsbury, Oxford et Gloucester servent dès 2 joueurs, Warrington s’ouvre à 3 joueurs et Nottingham à 4 — soit 5 tuiles Marchand distribuées à 2 joueurs, 7 à 3 et 9 à 4. Leurs bonus de bière : Shrewsbury +4 PV, Nottingham +3 PV, Warrington 5 £, Oxford +2 espaces de revenu, Gloucester un développement gratuit.' },
  { id: 'merchantTileVsPlace', topic: 'Tuile Marchand et emplacement marchand', words: ['tuile marchand vierge', 'marchand vierge', 'difference tuile marchand'],
    answer: 'L’emplacement marchand est le lieu imprimé en bord de carte ; les tuiles Marchand sont tirées au hasard à la mise en place et posées sur ses cases, et ce sont elles qui disent ce qu’il achète. Une tuile vierge n’achète rien et n’a pas de baril à côté d’elle — un marchand dont toutes les tuiles sont vierges ne vous achètera jamais rien de la partie. Le jeu mélange les neuf tuiles officielles selon la variante S4 : 2 vierges, 2 coton, 2 manufacture, 2 « tous biens » et 1 poterie.' },
  { id: 'allGoodsMerchant', topic: 'La tuile « tous biens »', words: ['tous biens', 'tous les biens', 'marchand achete tout'],
    answer: 'Une tuile « tous biens » accepte trois marchandises : le coton, les produits manufacturés et la poterie. Elle vaut donc comme les trois icônes réunies pour une action Vente. Les autres tuiles n’achètent que la marchandise dessinée dessus.' },
  { id: 'merchantCoalIcon', topic: 'Le marchand et le marché du charbon', words: ['connexion marche charbon', 'marchand marche charbon', 'acheter charbon marchand'],
    answer: 'Chaque emplacement marchand porte l’icône de connexion au marché du charbon : pour acheter du charbon au marché, le lieu où vous bâtissez doit être relié par des liaisons à l’un des cinq marchands. Le jeu accepte n’importe lequel des cinq, même celui qui n’a reçu aucune tuile à 2 ou 3 joueurs. Le fer, lui, ne demande aucune connexion.' },
  { id: 'farmBreweryCards', topic: 'Bâtir sur une brasserie fermière', words: ['joker lieu ferme', 'carte ferme brasserie', 'construire sur la ferme'],
    answer: 'Les deux brasseries fermières se trouvent hors des villes et n’acceptent qu’une carte Industrie Brasserie ou un Joker Industrie ; le jeu refuse explicitement le Joker Lieu, et aucune carte Lieu ne les nomme dans le paquet. Comme toute carte Industrie, elle exige que le lieu soit dans votre réseau — sauf si vous n’avez encore rien sur le plateau. La brasserie qui s’y installe reçoit 1 baril à l’ère canal, 2 à l’ère rail, comme partout ailleurs.' },
  { id: 'farmBreweryLinks', topic: 'Relier les brasseries fermières', words: ['ferme nord', 'ferme sud', 'relier la ferme', 'cannock ferme'],
    answer: 'La ferme du nord, entre Cannock et Walsall, pend à une seule route : Cannock ↔ ferme, praticable aux deux ères. La ferme du sud n’a pas de route à elle : la liaison Kidderminster ↔ Worcester relie d’un coup Kidderminster, Worcester et la ferme, et aucune seconde tuile n’y est possible. Cette liaison compte donc trois lieux pour votre réseau et pour le décompte de fin d’ère.' },
  { id: 'whatIsALink', topic: 'Ce qu’est une liaison', words: ['liaison relie', 'liaison appartient', 'appartient a une ville', 'proprietaire liaison'],
    answer: 'Une liaison est une tuile posée sur une route imprimée entre deux lieux — deux villes, ou une ville et un marchand. Elle appartient au joueur qui l’a posée, jamais à une ville : ce n’est pas une industrie et elle n’occupe aucun emplacement d’industrie. Elle met ses deux extrémités dans votre réseau, puis, en fin d’ère, elle marque les icônes « lien » des lieux qu’elle touche avant de quitter le plateau.' },
  { id: 'linkToMerchant', topic: 'Une liaison vers un marchand', words: ['liaison vers marchand', 'relier un marchand', 'route marchand'],
    answer: 'Oui : sept routes aboutissent à un marchand — Coalbrookdale ↔ Shrewsbury, Stoke-on-Trent ↔ Warrington, Derby ↔ Nottingham, Birmingham ↔ Oxford, Redditch ↔ Oxford, Worcester ↔ Gloucester et Redditch ↔ Gloucester. Une telle liaison met le marchand dans votre réseau et ouvre la connexion au marché du charbon. En fin d’ère, un emplacement marchand compte toujours 2 icônes « lien », qu’il porte des tuiles ou non.' },
  { id: 'canalOnlyRoute', topic: 'La route réservée au canal', words: ['canal uniquement', 'seulement au canal', 'burton walsall'],
    answer: 'Une seule route n’existe qu’à l’ère canal : Burton-on-Trent ↔ Walsall. Elle disparaît des routes disponibles à l’ère rail, où aucun rail ne peut s’y poser. L’ère canal offre donc 31 routes, les 30 routes communes plus celle-là.' },
  { id: 'railOnlyRoutes', topic: 'Les routes réservées au rail', words: ['rail uniquement', 'seulement au rail', 'huit routes rail'],
    answer: 'Huit routes n’existent qu’à l’ère rail : Belper ↔ Leek, Birmingham ↔ Nuneaton, Birmingham ↔ Redditch, Burton-on-Trent ↔ Cannock, Coventry ↔ Nuneaton, Derby ↔ Uttoxeter, Stone ↔ Uttoxeter et Tamworth ↔ Walsall. Aucun canal ne peut y être posé. L’ère rail compte donc 38 routes : les 30 communes plus ces huit.' },
  { id: 'oneLinkPerRoute', topic: 'Deux joueurs sur la même route', words: ['meme route', 'deux joueurs meme', 'doubler une liaison'],
    answer: 'Non : une route ne porte qu’une seule tuile Liaison de toute l’ère, et le jeu retire des cibles proposées toute route déjà occupée. On ne double jamais une liaison, et un rail ne remplace pas un canal. Les tuiles Liaison quittent toutes le plateau après le décompte de l’ère canal, ce qui rend les routes libres à nouveau pour l’ère rail.' },
  { id: 'whereToLayLink', topic: 'Où poser une liaison', words: ['ou poser liaison', 'ou construire une liaison', 'premiere liaison'],
    answer: 'Une liaison doit toucher votre réseau : un lieu où vous avez une tuile, ou une extrémité d’une de vos liaisons. Tant que vous n’avez rien sur le plateau, vous pouvez la poser n’importe où. Elle se pose sur une route libre de l’ère en cours : canal pour 3 £, rail pour 5 £ et un charbon qui doit être accessible une fois la tuile posée.' },
  { id: 'connectedMeaning', topic: 'Ce que « connecté » veut dire', words: ['connecte veut dire', 'etre connecte', 'distance en liaisons', 'compte les liaisons'],
    answer: 'Être connecté, c’est être relié par une chaîne de tuiles Liaison posées sur le plateau, quel qu’en soit le propriétaire — les liaisons de tous les joueurs comptent. La distance se compte en tuiles Liaison traversées : le jeu sert le charbon depuis la mine connectée la plus proche d’abord, et départage les distances égales par la plus grosse réserve. C’est différent de votre réseau, qui ne sert qu’à dire où vous avez le droit de bâtir et de poser.' },
  { id: 'rivalMineLinks', topic: 'Se servir de la mine d’un adversaire', words: ['mine adverse', 'mine autre joueur', 'mes propres liaisons'],
    answer: 'Vos propres liaisons ne sont pas nécessaires : pour puiser dans une mine, il suffit qu’une chaîne de liaisons — posées par n’importe qui — relie votre lieu à cette mine. Le charbon part de la mine connectée la plus proche, et son propriétaire n’a pas son mot à dire ; il y gagne seulement le retournement de sa tuile quand le dernier cube s’en va. Le fer, lui, se prend sur n’importe quelle sidérurgie du plateau, sans aucune liaison.' },
  { id: 'potteryPlaces', topic: 'Où se bâtissent les poteries', words: ['villes poterie', 'ou poterie', 'emplacement poterie', 'ou ceramique'],
    answer: 'Quatre emplacements de poterie seulement existent sur le plateau : Belper, Stafford, Coventry, et Stoke-on-Trent où la case est partagée avec la sidérurgie. Chaque joueur dispose pourtant de 5 tuiles Poterie : les places manquent avant les tuiles. Les emplacements de Belper et Derby n’entrent dans le paquet de cartes Lieu qu’à 4 joueurs.' },
  { id: 'linkTileStock', topic: 'Le nombre de tuiles Liaison', words: ['stock liaisons', 'manquer de liaisons', 'nombre tuiles liaison', 'plus de liaisons'],
    answer: 'Le livret donne 14 tuiles Liaison par joueur, mais le jeu ne tient aucun stock : rien ne vous empêche d’en poser davantage. Les seules limites appliquées sont les routes encore libres de l’ère en cours, votre argent, le charbon exigé par un rail et l’obligation de toucher votre réseau.' },
  { id: 'linksSweptAtEraEnd', topic: 'Les liaisons en fin d’ère', words: ['liaisons retirees', 'canaux retires', 'liaisons fin ere'],
    answer: 'À la fin de chaque ère, chaque liaison marque d’abord les icônes « lien » des lieux qu’elle touche — les tuiles de tout le monde comptent, retournées ou non, et un marchand vaut 2 — puis toutes les tuiles Liaison quittent le plateau. L’ère rail repart donc d’une carte sans aucune liaison, et les réseaux sont à rebâtir. Les tuiles Industrie de niveau 1, elles, sont balayées au passage à l’ère rail.' },
];

const EN: FaqEntry[] = [
  { id: 'ironSells', topic: 'The forge and the iron market', words: ['iron sell', 'forge sell', 'iron automatic', 'iron market', 'sells iron', 'iron bars'],
    answer: 'Yes, and with no condition: a forge just laid empties its bars into the iron market at once, dearest cells first, and you take the printed price of each. No link and no merchant are asked for. If every bar goes that way the tile flips on the spot. Whatever is left on it then serves anybody’s builds and developments.' },
  { id: 'coalSells', topic: 'The mine and the coal market', words: ['mine sell', 'coal sell', 'mine automatic', 'coal market', 'sells coal'],
    answer: 'Only if the mine reaches a merchant location through links, yours or anyone’s. Then, on being built, every cube that fits goes to the coal market and you take its price; if the last one goes that way the tile flips. Out of a merchant’s reach the mine keeps its cubes. And this sale happens only on being built, never after.' },
  { id: 'flipMine', topic: 'When a mine flips', words: ['mine flip', 'forge flip', 'brewery flip', 'when does it flip', 'last cube'],
    answer: 'A mine or a forge flips when its last cube goes, a brewery when its last barrel is drunk — whoever took them. The flip advances your income marker by the number of spaces printed on the tile, and its points are banked for the era’s end. A mine emptied by the others is a mine paid for.' },
  { id: 'flipWorks', topic: 'When a works flips', words: ['works flip', 'cotton flip', 'pottery flip', 'manufactory flip', 'how to flip'],
    answer: 'A cotton mill, a manufactory or a pottery flips only through the Sell action: it takes a link to a merchant who buys those goods, and the beer the tile asks for. Nothing else flips it, and a tile never flipped scores nothing at all.' },
  { id: 'ironWhere', topic: 'Where iron comes from', words: ['where iron', 'find iron', 'iron link', 'iron connect'],
    answer: 'Anywhere: iron is taken from any unflipped forge on the board, whoever owns it, with no notion of distance or network. With no forge left, it is bought at the iron market, again with no connection at all. That is the great difference from coal.' },
  { id: 'coalWhere', topic: 'Where coal comes from', words: ['where coal', 'find coal', 'coal link', 'coal connect'],
    answer: 'Coal must come from an unflipped mine connected to your site by links — yours or anyone’s, the nearest first. Failing that it is bought at the market, but only if the site reaches a merchant location. Otherwise the build cannot happen.' },
  { id: 'marketPrice', topic: 'The price of coal and iron', words: ['price coal', 'price iron', 'market rise', 'market refill', 'market empty'],
    answer: 'You always buy the cheapest cell first, and the price climbs as cubes leave. The markets never refill on their own: only new mines and forges, selling their cubes, fill them back — dearest cells first. With an empty market you still pay: £8 a coal, £6 an iron.' },
  { id: 'beer', topic: 'Where beer comes from', words: ['where beer', 'find beer', 'beer sell', 'barrel', 'brewery for'],
    answer: 'Three sources, and each barrel may come from a different one: your own unflipped breweries, anywhere on the map and with no condition; a rival’s brewery, but only if it is connected to the tile being sold; or the barrel by the merchant you sell to, which also triggers its bonus. Without the beer asked for, the Sell action cannot happen.' },
  { id: 'merchantBonus', topic: 'The merchant’s bonus', words: ['merchant bonus', 'merchant barrel', 'bonus give'],
    answer: 'Drinking the barrel by a merchant tile gives its bonus: money, points, income or a free development depending on the merchant. There is one barrel per non-blank merchant tile, so some merchants carry two, and each barrel is drunk once an era. The barrels are put back at the turn into the Rail Era.' },
  { id: 'sellHow', topic: 'How to sell', words: ['how to sell', 'sell action', 'sell several', 'selling'],
    answer: 'Discard any card, choose one of your unflipped cotton mills, manufactories or potteries connected to a merchant who buys those goods, and drink the beer asked for. The tile flips: income climbs now, the points wait for the era’s end. One action may flip several tiles, as many as you can pay the beer for.' },
  { id: 'buildCard', topic: 'Which card builds what', words: ['which card', 'location card', 'industry card', 'card builds', 'wild'],
    answer: 'A location card builds any industry in the town it names, even off your network. An industry card builds that industry in a town of your network. While you hold no tile on the board, an industry card builds anywhere. A wild location stands for any town but the two farm breweries, a wild industry for any industry.' },
  { id: 'network', topic: 'What your network is', words: ['my network', 'what is network', 'where can i build'],
    answer: 'Your network is every place holding a tile of yours, plus every place your links touch. An industry card builds only there. A location card ignores the network: it builds in its town whatever happens.' },
  { id: 'linkCost', topic: 'What a link costs', words: ['canal cost', 'rail cost', 'double rail', 'two rails'],
    answer: 'A canal costs £3 in the Canal Era, one link per action. In the Rail Era a rail costs £5 and a coal; two may be laid in one action for £15, a coal each and a beer, which must come from a brewery and never from a merchant’s barrel. Each rail must reach a coal source once laid.' },
  { id: 'linkScore', topic: 'What a link scores', words: ['link score', 'canal points', 'link icon', 'what does a canal give'],
    answer: 'At the era’s end each link scores the link icons of the tiles in the places it touches — every tile, whoever owns it, flipped or not — and two points for a merchant location. Then the link comes off the board. That is why a link into a well-built town is worth more than a link into nothing.' },
  { id: 'loan', topic: 'The loan', words: ['loan', 'borrow', 'repay'],
    answer: 'Discard a card and take £30 at once. Your income marker falls 3 levels, not 3 spaces, and lands on the highest space of the new level. A loan is refused if it would push you below level −10. It is never repaid: early in the game it is money that builds tiles, late it is points lost outright.' },
  { id: 'develop', topic: 'Developing', words: ['develop', 'lightbulb', 'remove tile mat'],
    answer: 'Discard a card and remove one or two tiles from your mat, one iron per tile removed. Each tile removed must be the lowest left in its column at that moment. Potteries I and III carry a lightbulb and never develop. This is how the strong levels are reached without wasting a build on a poor tile.' },
  { id: 'scout', topic: 'Scouting', words: ['scout', 'two wilds'],
    answer: 'Discard three cards in all and take one wild location and one wild industry. It is forbidden if you already hold a wild. A hand that allows nothing is worth the cost; otherwise three cards for two is dear.' },
  { id: 'income', topic: 'Income', words: ['income', 'income track', 'income level', 'space level', 'payday'],
    answer: 'The income track counts spaces, and the spaces group into levels: it is the level that pays. A tile flip advances the marker by the spaces printed on it; a loan pulls it back whole levels. At each round’s end everyone takes their level in pounds — and pays it to the bank if the level is negative.' },
  { id: 'order', topic: 'Turn order', words: ['turn order', 'who goes first', 'spent order', 'first player'],
    answer: 'At each round’s end the next round’s order is decided by money spent: whoever spent least goes first. On an equal spend the previous round’s order stands. Spending little therefore buys the first pick of the slots next round.' },
  { id: 'actions', topic: 'How many actions', words: ['how many actions', 'two actions', 'first round action', 'one action'],
    answer: 'Two actions a turn, and each action costs a discarded card — the loan and passing included. One exception: in the first round of the Canal Era, one action each. At an era’s end a shrunken hand naturally limits the actions.' },
  { id: 'hand', topic: 'The hand and the deck', words: ['hand eight', 'how many cards', 'deck', 'refill', 'deck empty'],
    answer: 'Eight cards in hand, refilled after each turn while the deck has any. Once the deck is empty the hand melts by a card per action and refills no more. The era ends when the deck and every hand are empty: ten rounds at two players, nine at three, eight at four.' },
  { id: 'eraEnd', topic: 'The end of an era', words: ['era end', 'canal end', 'sweep', 'level 1 removed', 'scoring', 'between eras', 'between the eras'],
    answer: 'The links are scored first, then the flipped tiles; tiles never flipped score nothing. Then the links come off the board. At the end of the Canal Era only, every level-1 tile leaves the board too, flipped or not. The merchants’ barrels are put back, the discards reshuffled, and everyone draws eight cards.' },
  { id: 'scoring', topic: 'How points are made', words: ['how to win', 'victory points', 'money points', 'final score'],
    answer: 'Two sources, counted at each era’s end: the points printed on your flipped tiles, and the link icons of the places your links touch. Cash counts for nothing at the end of a full game — it is only the means. On a tie the highest income decides, then the money left.' },
  { id: 'railBeer', topic: 'Breweries in the Rail Era', words: ['brewery two barrels', 'barrel rail era', 'brewery rail'],
    answer: 'A brewery built in the Canal Era takes one barrel; built in the Rail Era it takes two. Same tile — the era it is built in decides.' },
  { id: 'farmBrewery', topic: 'The farm breweries', words: ['farm brewery', 'outside town'],
    answer: 'Two brewery slots sit outside the towns, on the map. They are built like any other, no location card names them and a wild location is refused there: only a brewery industry card or a wild industry reaches them, and the place must be in your network — unless you hold nothing on the board yet.' },
  { id: 'deckSize', topic: 'Deck composition', words: ['deck composition', 'how many cards', 'deck size', 'cards removed players'],
    answer: 'The draw deck holds only Location and Industry cards: 40 at two players, 54 at three, 64 at four. Two players drop the blue and teal towns (Leek, Stoke, Stone, Uttoxeter, Belper, Derby); three players only drop Belper, Derby and one Uttoxeter. On the industry side coal goes from 2 to 3 cards, pottery from 2 to 3 and the double cotton/manufacturer card from 0 to 6 to 8, while iron stays at 4 and brewery at 5. The 4 wild location and 4 wild industry cards sit in two face-up piles and are never shuffled into the deck.' },
  { id: 'faceDownCard', topic: 'The face-down setup card', words: ['face down card', 'ninth card', 'hidden card discard'],
    answer: 'At setup you get 8 cards in hand plus 1 drawn face down that opens your discard pile: it is never playable. At the end of the Canal Era the engine shuffles the leftover deck, every discard — that card included — and all hands into the Rail Era deck. It then deals 8 cards and one fresh face-down card to each player; that second one never comes back, since the game ends with the Rail Era.' },
  { id: 'wildDiscard', topic: 'Discarding a wild card', words: ['discarded wild card', 'wild returns pile', 'playing a wild'],
    answer: 'A wild card you play does not go to the discard pile: the engine puts it back on its own wild pile, where a later Scout can take it again. Wilds therefore never feed the Rail Era deck, unlike Location and Industry cards.' },
  { id: 'scoutWithWild', topic: 'Scouting while holding a wild', words: ['scout with wild', 'already hold wild', 'scout holding joker'],
    answer: 'No: the Scout action is refused while you hold any wild card, location or industry. You also need at least 3 cards in hand, since the action discards 3, and at least one wild left in each of the two piles.' },
  { id: 'firstBuildAnywhere', topic: 'Building with nothing on the board', words: ['nothing on board', 'no network build', 'first tile anywhere'],
    answer: 'Yes. While you have neither a tile nor a link on the board, the engine treats every location as part of your network: an industry card builds that industry anywhere on the map, and any card lays a link on any free line of the era. The moment your first tile or link is down, the network requirement applies again.' },
  { id: 'locationCardTown', topic: 'Location card outside its town', words: ['location card town', 'build outside town', 'location card elsewhere'],
    answer: 'No. A Location card builds only in the town printed on it — the engine answers that this card builds in that town only — but it allows any industry the space permits, even when the town lies outside your network. To build elsewhere you need an Industry card inside your network, or a wild location.' },
  { id: 'merchantGoods', topic: 'What each merchant buys', words: ['merchant buys', 'all goods tile', 'which merchant accepts', 'blank merchant tile'],
    answer: 'A merchant buys whatever its dealt Merchant tiles show: cotton, manufactured goods, pottery, or the all-goods tile which takes all three. A blank tile buys nothing and carries no barrel. The pool depends on the table: at two players it is blank, blank, cotton, manufacturer and all-goods, so pottery can only be sold through the all-goods tile; Warrington opens at three players and Nottingham at four.' },
  { id: 'sellMany', topic: 'Selling several tiles at once', words: ['sell several tiles', 'multiple sales', 'sell two tiles', 'different industries sell'],
    answer: 'Yes: one discarded card covers as many sales as you like in the same action, and the tiles may be different industries going to different merchants. Each tile must be connected to its merchant and pays its own beer — 1 or 2 barrels depending on the tile — and each advances your income as it flips.' },
  { id: 'doubleRailBarrel', topic: 'Merchant barrel for the double rail', words: ['merchant barrel rail', 'double rail beer', 'barrel double link'],
    answer: 'No. For the Rail Era double link the engine offers breweries only: yours anywhere on the board, or an opponent’s that the second link connects once it is laid. The barrel beside a Merchant tile can be drunk during a Sell action only, since it is what triggers the merchant bonus.' },
  { id: 'coalOrder', topic: 'Order coal is taken in', words: ['coal order', 'nearest mine', 'which coal used', 'coal priority'],
    answer: 'Coal comes first from unflipped mines connected to the location by links, nearest by link count and whoever owns them, and it is free. On a tie the rulebook lets the player choose; the engine picks the mine holding the most cubes. Once connected mines are dry you buy from the market, but only if a merchant location is connected — otherwise the build is refused for want of connected coal.' },
  { id: 'ironConnection', topic: 'Does iron need a connection', words: ['iron connection', 'iron without link', 'iron distance'],
    answer: 'None at all. Iron comes from any unflipped iron works on the board, whoever owns it and with no link required, and otherwise from the iron market, again with no connection. The engine lets you name the works that supplies the cube, and only falls back to the market once no works on the board has a cube left.' },
  { id: 'marketEmpty', topic: 'When a market runs empty', words: ['empty coal market', 'empty iron market', 'market runs out', 'price market empty'],
    answer: 'An empty market does not stop you buying: each cube then costs £8 for coal and £6 for iron, with no limit on quantity. Before that you pay space by space from the cheapest end, £1 to £7 for coal and £1 to £5 for iron. Nothing refills the markets: only building a mine or an iron works puts cubes back.' },
  { id: 'marketFillTiming', topic: 'When cubes go to the market', words: ['when cubes market', 'refill the market', 'cubes sold build', 'market restock'],
    answer: 'Only on being built. A new iron works always pours its cubes into the iron market; a new mine only reaches the coal market if it is connected to a merchant location. Cubes fill the dearest spaces first, you collect their printed value, and if the tile empties completely it flips at once. After the build the tile never sells another cube to the market.' },
  { id: 'developLowest', topic: 'Developing a tile that is not the lowest', words: ['develop higher tile', 'choose develop tile', 'develop not lowest'],
    answer: 'No: the engine only offers the top tile of each stack, that is the lowest level left in that industry. The lightbulb potteries, levels I and III, can never be removed by Develop and the engine says so outright; only building takes them off the mat.' },
  { id: 'developTwoCost', topic: 'Developing two tiles', words: ['develop two tiles', 'two tiles one card', 'double develop cost'],
    answer: 'The card is the same: Develop discards exactly one card whether you remove one tile or two. What doubles is the iron — 1 cube per tile removed. Two removals in the same industry take the top tile and then the one directly beneath it, provided that one is not a lightbulb.' },
  { id: 'passCost', topic: 'What passing costs', words: ['passing costs card', 'pass turn cost', 'skip action card'],
    answer: 'Passing costs one card per action passed, exactly like any other action: the card goes to the discard pile and nothing else happens. If you do not name the card, the engine discards the first one in your hand.' },
  { id: 'spendOrder', topic: 'Money spent and next round order', words: ['money spent order', 'who plays first', 'spending turn order', 'market purchases order'],
    answer: 'Yes: everything you paid during the round counts — tile prices, the £3 or £5 of a link, the £15 double link, and coal or iron bought from the market. Money taken in offsets nothing: not cubes sold to the market on a build, not a loan, not income. At the end of the round the smallest spender goes first, and equal spends keep their previous relative order.' },
  { id: 'canalSecondLink', topic: 'A second link in one canal action', words: ['two canal links', 'double canal', 'second canal link'],
    answer: 'No: in the Canal Era a Network action lays exactly one link, for £3 and no coal. The double is a Rail Era option — £15 in all, 1 coal per link and 1 barrel of beer from a brewery — and the engine refuses it outright in the Canal Era.' },
  { id: 'refillEight', topic: 'Refilling your hand', words: ['refill hand', 'draw after turn', 'hand eight cards'],
    answer: 'At the end of your turn you draw back up to 8 cards, never more. Once the deck is empty your hand stops refilling and shrinks round by round; a player with no cards takes no turn, and the era ends when the deck and every hand are empty.' },
  { id: 'wildBuildReach', topic: 'How far a wild card reaches', words: ['wild location network', 'wild industry network', 'wild build anywhere'],
    answer: 'A wild location builds in any town you like, even outside your network, but never on the two farm breweries, which take industry cards only. A wild industry builds any industry you like, but only in a location inside your network — unless you have no tile and no link on the board yet, in which case the whole map is open.' },
  { id: 'cottonCard', topic: 'Cotton and manufacturer cards', words: ['cotton card alone', 'double cotton card', 'manufacturer cotton card'],
    answer: 'There is no cotton-only card and no manufacturer-only card: the two industries share one double card that serves for either. The engine puts 8 of them in the deck at four players, 6 at three and none at two — so in a two-player game a mill or a manufactory is built only from a Location card or a wild.' },
  { id: 'wildPilesLeft', topic: 'How many wild cards exist', words: ['how many wilds', 'wild pile empty', 'wilds available'],
    answer: 'There are 4 wild location and 4 wild industry cards, in two face-up piles beside the deck. Each Scout takes one of each, every wild you play goes back on its pile, and the action is refused as soon as either pile is empty.' },
  { id: 'sellConnection', topic: 'Connection needed to sell', words: ['sell merchant connection', 'tile connected merchant', 'sell without link'],
    answer: 'The tile you sell must reach the merchant through a chain of links of the current era, whoever owns them, and that merchant must show a tile buying this industry. Without such a path the tile simply does not appear among the sale targets. Only mills, manufactories and potteries are sold: mines, iron works and breweries flip by emptying.' },
  { id: 'rivalBeer', topic: 'Drinking a rival’s beer on a sale', words: ['opponent beer connected', 'rival brewery sale', 'beer rival brewery'],
    answer: 'For a sale your own unflipped breweries supply a barrel wherever they stand on the board; an opponent’s counts only if the tile being sold is connected to it. The engine drinks the merchant’s barrel first when one is left, because it carries the bonus, then your breweries, then other players’ — though you may name each source yourself.' },
  { id: 'developIronCost', topic: 'The iron a develop costs', words: ['develop iron cost', 'pay iron develop', 'develop iron market'],
    answer: 'Develop costs no money of its own: 1 card and 1 iron cube per tile removed. The iron is free when it comes from any unflipped iron works on the board, whoever owns it and with no connection needed; when none is left it is bought from the iron market, and the engine refuses the action if you cannot pay that price.' },
  { id: 'matColumn', topic: 'Which tile comes off the mat column', words: ['lowest tile column', 'which tile column', 'mat column order', 'tile comes next'],
    answer: 'You always build the lowest level still showing in that industry’s column on your mat — you never pick a higher level. Each build takes that tile away and uncovers the next one, so the column climbs as the game goes on. The Develop action also removes a tile from the top of the column, without placing anything on the board, which makes the column climb without building.' },
  { id: 'cottonCost', topic: 'Cotton mill costs', words: ['cotton mill cost', 'how much cotton', 'price cotton mill', 'cotton needs coal'],
    answer: 'Cotton Mill I costs £12 and needs no coal and no iron — the only cotton tile that consumes nothing. II costs £14 plus 1 coal. III costs £16 plus 1 coal and 1 iron, IV costs £18 plus 1 coal and 1 iron. Income runs from +5 down to +2 spaces and VP from 5 up to 12 as the levels climb; every cotton mill sells for 1 barrel of beer.' },
  { id: 'manufacturerCost', topic: 'Manufactory costs and oddities', words: ['manufactory cost', 'manufacturer cost', 'manufactory two beer', 'manufactory no link'],
    answer: 'Manufactory I costs £8 plus 1 coal; II £10 plus 1 iron; III £12 plus 2 coal; IV £8 plus 1 iron. V costs £16 plus 1 coal; VI £20 with no resource at all; VII £16 plus 1 coal and 1 iron; VIII £20 plus 2 iron. Two oddities: levels III and VII carry no link icon, so they give adjacent Link tiles nothing, and level V demands 2 barrels of beer to sell. Every other manufactory sells for 1 barrel.' },
  { id: 'coalCubes', topic: 'Coal mine cost and cubes', words: ['coal mine cost', 'how many cubes mine', 'cubes coal mine', 'price coal mine'],
    answer: 'Coal Mine I costs £5 and carries 2 cubes; II £7 and 3 cubes; III £8 plus 1 iron and 4 cubes; IV £10 plus 1 iron and 5 cubes. The cubes go on the tile when it is built and then serve any player connected to it. Income is +4, +7, +6 and +5 spaces, and the tiles are worth 1, 2, 3 and 4 VP.' },
  { id: 'ironBars', topic: 'Iron works cost and bars', words: ['iron works cost', 'how many iron bars', 'bars iron works', 'price iron works'],
    answer: 'Iron Works I costs £5 plus 1 coal and carries 4 iron bars; II £7 plus 1 coal and 4 bars; III £9 plus 1 coal and 5 bars; IV £12 plus 1 coal and 6 bars. Every level consumes exactly 1 coal on build and never any iron. Income is +3, +3, +2 and +1 spaces, and the tiles are worth 3, 5, 7 and 9 VP.' },
  { id: 'potteryCost', topic: 'Pottery costs and lightbulb tiles', words: ['pottery cost', 'price pottery', 'lightbulb tile', 'pottery rail era'],
    answer: 'Pottery I costs £17 plus 1 iron and scores 10 VP; II is free but takes 1 coal and scores 1 VP; III costs £22 plus 2 coal for 11 VP; IV is free with 1 coal for 1 VP; V costs £24 plus 2 coal for 20 VP. Levels I and III carry the lightbulb: they cannot be removed by Develop, only building takes them off the mat — level V can be developed. Pottery I is the only level-1 tile in the game that may also be built in the Rail Era, while pottery V is Rail Era only. Levels I, II and IV sell for 1 barrel, levels III and V for 2.' },
  { id: 'breweryBarrels', topic: 'Brewery cost and barrels per era', words: ['brewery cost', 'how many barrels brewery', 'barrels brewery era', 'price brewery'],
    answer: 'Brewery I costs £5 plus 1 iron; II £7 plus 1 iron; III £9 plus 1 iron; IV £9 plus 1 iron and may only be built in the Rail Era. The number of barrels depends on the era, not the level: 1 barrel in the Canal Era and 2 in the Rail Era, at every level — that is what the game applies. Income is +4 then +5 spaces, VP are 4, 5, 7 and 9, and every brewery carries 2 link icons.' },
  { id: 'flipRules', topic: 'What makes a tile flip', words: ['tile flip', 'when does flip', 'why tile flipped', 'flip condition'],
    answer: 'A mine or an iron works flips when its last cube leaves, a brewery when its last barrel is drunk — even if an opponent is the one consuming it. A cotton mill, a manufactory or a pottery only flips by being sold to a merchant it is connected to. An iron works, and a mine connected to a merchant location, empty into the market as they are built and flip at once if everything goes. Flipping advances your income by the printed number and makes the tile eligible for end-of-era VP.' },
  { id: 'tileIncomeNumber', topic: 'The income number printed on a tile', words: ['income number tile', 'income spaces levels', 'tile income means', 'advance income marker'],
    answer: 'The income figure on a tile counts spaces on the progress track, not income levels: a flipped Coal Mine II moves your marker 7 spaces, not 7 levels. The track has 100 spaces and a level costs more and more spaces — 1 space per level up to space 10, then 2 up to space 30, 3 up to space 60 and 4 beyond that. Only taking a loan moves the marker in levels, dropping it by 3 levels.' },
  { id: 'tileLinkIcon', topic: 'The link icons on a tile', words: ['link icon tile', 'link icons mean', 'how many link icons', 'tile link number'],
    answer: 'The number of link icons on a tile — 0, 1 or 2 — is the VP it grants to each neighbouring Link tile at the end-of-era count. A Link tile scores the sum of the link icons of every tile sitting at both its ends, flipped or not, and a merchant location counts as a flat 2. Manufactories III and VII have none; Cotton Mill II, Manufactories I and V, Coal Mine I and all four breweries have 2; every other tile has 1.' },
  { id: 'matEraIcon', topic: 'The canal and rail icons on the mat', words: ['canal icon mat', 'rail icon tile', 'tile era icon', 'cannot build era'],
    answer: 'A canal icon beside a tile on the mat means it can only be built in the Canal Era, a rail icon means it waits for the Rail Era, and no icon means it may be built in either. Every level-1 tile carries the canal icon except Pottery I, which is legal in both eras; only Pottery V and Brewery IV carry the rail icon. A canal tile still sitting on your mat in the Rail Era can only leave it through Develop, and the game refuses the build by saying that level cannot be built in the current era.' },
  { id: 'tileSlotIcons', topic: 'The icons on a town slot', words: ['slot industry icon', 'where place tile', 'double icon slot', 'slot refuses industry'],
    answer: 'Each slot in a town shows one or more industry icons and accepts only those: a cotton mill can only go on a slot bearing the cotton icon. A double-icon slot takes either of the two industries, and repeated clicks cycle through the options. If a slot is already held by a different industry the game refuses and says so; the only other route is overbuilding a tile of the same industry.' },
  { id: 'overbuildTile', topic: 'Overbuilding a tile', words: ['overbuild', 'over build tile', 'replace opponent tile', 'build on top'],
    answer: 'Overbuilding means placing a tile on an existing one of the same industry and a strictly higher level. On your own tiles it is always allowed, flipped or not; on an opponent’s tile only coal mines and iron works may do it, and only when no cube of that resource is left anywhere — neither on a board tile nor in the market. In the Canal Era overbuilding is the only way to place again in a town where you already have a tile, because the slot you replace does not count against the one-tile-per-location limit.' },
  { id: 'oneTilePerPlace', topic: 'One tile per location in the Canal Era', words: ['one tile per location', 'two tiles same town', 'canal era limit', 'several tiles town'],
    answer: 'In the Canal Era you may own only one industry tile per location: the game refuses a second tile in a town where you already have one, even on a free slot. The limit is lifted in the Rail Era, where you may hold several slots in the same location. It does not apply when you overbuild your own tile, since you are only replacing it.' },
  { id: 'tileRemovedFate', topic: 'What becomes of an overbuilt or liquidated tile', words: ['overbuilt tile becomes', 'tile removed board', 'debt sells tiles', 'short money tiles'],
    answer: 'An overbuilt tile leaves the game for good, along with any resources still on it, and scores no end-of-era VP; the income and VP it already gave you are yours to keep. If your money is negative at payday the game liquidates your tiles cheapest first, each returning half its build cost rounded down, and those tiles also leave the board. Whatever is still missing after the liquidation is paid in victory points, one point per pound.' },
  { id: 'matTileCounts', topic: 'How many tiles on the mat', words: ['how many tiles mat', 'number industry tiles', 'how many cotton mills', 'no tiles left'],
    answer: 'Each player has 45 industry tiles: 11 cotton mills, 11 manufactories, 7 coal mines, 7 breweries, 5 potteries and 4 iron works. They sit in six columns from lowest to highest level, each level in a fixed number of copies — for instance 3 Cotton Mill I, 2 of level II, then 3 and 3. When a column runs out that industry can no longer be built and the game answers that no tiles of that type are left.' },
  { id: 'tileVpNumber', topic: 'The VP printed on a tile', words: ['victory points tile', 'vp printed tile', 'unflipped tile points', 'how many vp tile'],
    answer: 'A tile’s VP number is only scored at an end-of-era count, and only if the tile is flipped: a tile still face up is worth zero. The biggest prizes are Pottery V at 20 VP, Cotton Mill IV at 12 VP, then Manufactory VIII and Pottery III at 11 VP; mines are worth 1 to 4 VP and Potteries II and IV just 1. A flipped tile stays on the board and scores again at the Rail Era count, unless it is level 1: those are swept away between the eras.' },
  { id: 'sweepLevelOne', topic: 'Level 1 tiles removed between eras', words: ['level 1 tiles', 'remove level 1', 'sweep tiles', 'level one rail'],
    answer: 'After the Canal Era count, every level-1 tile leaves the board, flipped or not, and scores nothing afterwards. The canal Link tiles come off at the same time, once they have scored. Tiles of level 2 and above stay exactly where they are and will count in the final scoring if they are flipped.' },
  { id: 'potteryFreeTiles', topic: 'The free pottery tiles', words: ['free pottery', 'pottery costs nothing', 'pottery zero pounds'],
    answer: 'Potteries II and IV cost no money at all, only 1 coal: they are worth just 1 VP and a single space of income. They are removed by Develop or built cheaply to uncover Pottery III and then Pottery V, worth 11 and 20 VP. They sell like any other pottery, for 1 barrel of beer.' },
  { id: 'progressBands', topic: 'Bands of the progress track', words: ['progress track', 'income bands', 'spaces levels', 'space income level'],
    answer: 'The track has 100 spaces, 0 to 99, and every space prints the income level it pays. Spaces 0 to 10 are levels −10 to 0, one space per level; spaces 11 to 30 are levels 1 to 10, two spaces per level; spaces 31 to 60 are levels 11 to 20, three spaces per level; spaces 61 to 96 are levels 21 to 29, four spaces per level. The last three spaces, 97 to 99, all pay level 30 — the ceiling.' },
  { id: 'markersStart', topic: 'Where the markers start', words: ['income marker start', 'victory marker start', 'where markers begin'],
    answer: 'Your income marker starts on space 10 of the progress track, which prints level £0 — your first payday pays nothing and costs nothing. Your victory point marker starts on 0.' },
  { id: 'spacesVsLevels', topic: 'Spaces versus levels', words: ['spaces versus levels', 'advance spaces', 'drop levels', 'spaces or levels'],
    answer: 'A tile that flips advances your marker by a number of spaces; a loan instead drops you 3 income levels and puts the marker on the highest space of the level you land on. The difference matters: high on the track four spaces make one level, so advancing 4 spaces can add a single pound of income, while a loan always costs three pounds of income at once.' },
  { id: 'flipNoRaise', topic: 'A flip that did not raise the pay', words: ['income not rise', 'income not increase', 'income not go up', 'didn income', 'income same flip', 'income not change', 'pay not rise', 'pay not go up', 'flipped income rise', 'flip income rise', 'flipped income increase', 'flip pay raise', 'flipped tile income go up'],
    answer: 'The number printed on a tile counts spaces, not pounds: flipped, it moves your marker that many spaces along the track, and the pay only rises when the marker crosses into the next level. Beyond space 10 a level spans 2 spaces, then 3, then 4. For instance a marker on space 17 (level 4, spaces 17 and 18) that moves one space lands on 18 — still level 4, still £4 a payday; one space more and it would have reached level 5. Hover the income track: each rung shows its spaces, and each pawn what it still needs for the next.' },
  { id: 'roundEndOrder', topic: 'Order of the end of a round', words: ['round end order', 'end of round steps', 'what happens round ends'],
    answer: 'Turn order is recomputed first: whoever spent least during the round goes first, the biggest spender last, and ties keep their relative order; the spending counters then reset to zero. Payday follows — everyone collects income, except in the very last round of the game. Finally, if the deck and every hand are empty the era ends and scoring follows; otherwise the next round starts with the new first player and 2 actions each.' },
  { id: 'paydayShortfall', topic: 'Negative income and an empty purse', words: ['negative income', 'cannot pay income', 'short of money payday'],
    answer: 'Below level 0 the payday is negative and you pay the bank. If your purse cannot cover it, the game removes industry tiles of yours from the board — never your links — each returning half its cost rounded down until the shortfall is covered, and you keep the excess; removed tiles leave the game. At the table the player picks the tiles; here the engine sells off the cheapest ones first. If money is still short, you lose 1 VP per £1 missing and your purse drops to zero.' },
  { id: 'noTileSale', topic: 'Selling a tile for money', words: ['sell a tile', 'sell back tile', 'cash in tile'],
    answer: 'No — a placed tile is only sold off during payday, and only to cover a negative income your purse cannot pay. No action in the game lets you sell an industry back for cash, and link tiles are never taken back at all.' },
  { id: 'characterTileMoney', topic: 'Money on your character tile', words: ['character tile money', 'money spent tile', 'what character tile'],
    answer: 'The money you spend during a round is tallied on your character tile, and it measures nothing but your spending. At the end of the round the smallest spender goes first and the biggest spender last, then that money goes back to the bank and the counters reset. You never get it back — only turn order depends on it.' },
  { id: 'eraEndOrder', topic: 'Order of the end of an era', words: ['era end order', 'era end steps', 'era scoring sequence'],
    answer: 'An era ends as soon as the deck and every hand are empty, at the close of the current round and after payday. Scoring follows: each of your links pays 1 VP per link icon in the locations it touches, each flipped industry tile pays the VP printed at its bottom left, then every link tile comes off the board. At the end of the canal era the scoring screen is followed by the sweep — level 1 tiles removed, merchant beer restocked, cards reshuffled and re-dealt — before the rail era starts.' },
  { id: 'linkVpDetail', topic: 'Exactly what a link scores', words: ['link icon', 'link scores how many', 'link merchant points'],
    answer: 'Each link of yours scores 1 VP per link icon printed on the tiles sitting in the two locations it joins, no matter who owns those tiles. An industry tile shows 0, 1 or 2 icons depending on its type and level, and a merchant location always counts as 2. The Kidderminster–Worcester link also touches the southern farm brewery, which has no icon and adds nothing.' },
  { id: 'unflippedVp', topic: 'An unflipped tile at scoring', words: ['unflipped tile', 'tile not flipped', 'not flipped score'],
    answer: 'A tile still sitting black side up scores no victory points at all. Only flipped tiles pay their printed VP; the scoring panel shows separately what your unflipped tiles would be worth if they emptied in time.' },
  { id: 'reshuffleBetweenEras', topic: 'Cards reshuffled between eras', words: ['cards reshuffled', 'new deck era', 'redeal cards era'],
    answer: 'Entering the rail era every card comes back: the discards, the face-down opening cards and whatever was left in hand are reshuffled into a fresh deck — 64 cards at four players, 54 at three, 40 at two. Each player is then dealt 8 cards plus 1 face-down card opening their discard, exactly as at setup. The two wild piles, location and industry, stay aside and are never shuffled into the deck.' },
  { id: 'gameEndTie', topic: 'End of the game and ties', words: ['tie winner', 'tiebreak', 'same number points'],
    answer: 'The game stops at the end of the last rail era round, once that era has been scored; that round pays no income. The winner is whoever holds the most VP; on a tie, income level decides, then money in hand. If everything is still equal the engine still names a single winner, the earliest seat at the table, where the rulebook would declare a shared victory.' },
  { id: 'initiationBonus', topic: 'The beginner canal-only game', words: ['beginner game', 'canal only', 'initiation bonus'],
    answer: 'The beginner game stops at the end of the canal era: there is no rail era, and the last round pays no income. After the usual era scoring each player adds +1 VP per £4 in hand, capped at 15 VP, plus VP equal to their income level — a negative level takes points away. Each player then scores the printed VP of their flipped level 2 and higher tiles again, and the winner is named.' },
  { id: 'roundsPerEra', topic: 'Rounds in an era', words: ['how many rounds', 'number of rounds', 'era length'],
    answer: 'Each era lasts 10 rounds at two players, 9 at three and 8 at four; the top bar shows the current round and that total. The count follows from the deck — 40, 54 or 64 cards — because the era ends exactly when the deck and every hand are empty. The first canal round gives one action only, every other round gives two.' },
  { id: 'startingPurse', topic: 'What you start with', words: ['starting money', 'how much money start', 'starting cards'],
    answer: 'You start with £17 and 8 cards in hand, plus 1 face-down card that opens your discard pile. Your markers sit on 0 VP and on space 10 of the progress track, which is £0 income. Your mat holds 45 industry tiles stacked by type and level, lowest first.' },
  { id: 'incomeCeiling', topic: 'Income ceiling and floor', words: ['maximum income', 'income cap', 'minimum income'],
    answer: 'Income tops out at level 30: spaces 97 to 99 all pay £30 and the marker goes no further. Downwards it never passes space 0, which is −£10; a loan that would sink you below that level is refused outright, with the game saying income cannot go lower.' },
  { id: 'lastRoundNoPayday', topic: 'No payday in the last round', words: ['last round income', 'no payday last', 'income final round'],
    answer: 'The game skips payday in the very last round of the game: the final rail era round, or the final canal round in a beginner game. Every other round end pays normally, including the last canal round of a full game.' },
  { id: 'merchantRearmEra', topic: 'Merchants restocked between eras', words: ['merchant barrels era', 'merchants restocked', 'merchant beer returns'],
    answer: 'Entering the rail era, every merchant location takes back one beer barrel per non-blank merchant tile, and merchant bonuses already claimed become available again. Players’ brewery tiles simply keep whatever barrels they have left — nothing restocks them.' },
  { id: 'emptyDeckPlay', topic: 'When the deck runs out', words: ['deck empty', 'no cards to draw', 'deck runs out'],
    answer: 'Once the deck is empty nobody refills their hand: each player plays out the cards they hold, two per round. A player with no cards left is simply skipped, and the era ends at the close of the round in which the deck and every hand are empty.' },
  { id: 'keepMoneyBetweenEras', topic: 'What survives the change of era', words: ['keep money era', 'money between eras', 'income between eras'],
    answer: 'Your money, income level, victory points and loans carry over untouched from the canal era to the rail era — nothing is reset. Only the cards change hands, reshuffled and re-dealt, along with the level 1 tiles removed from the board and the links, all taken back at scoring.' },
  { id: 'boardTowns', topic: 'Towns and industry spaces', words: ['how many towns', 'number of towns', 'industry space', 'industry slot', 'twenty towns'],
    answer: 'The board holds 20 buildable towns, 2 farm breweries outside the towns and 5 merchant locations along the edge. The 20 towns carry 47 industry spaces in all: a space is a printed socket that holds one tile and no more, and the icons drawn on it say which industries are allowed there. Each farm brewery has a single space, open to a brewery only.' },
  { id: 'biggestTowns', topic: 'Towns with three or four spaces', words: ['four spaces', 'three spaces', 'birmingham spaces', 'biggest town'],
    answer: 'Birmingham is the only town with four spaces: cotton or manufactory, manufactory, iron works, manufactory. Five towns have three — Coventry, Coalbrookdale, Stoke-on-Trent, Belper and Derby. The other fourteen have two.' },
  { id: 'doubleIconSlot', topic: 'A space with two icons', words: ['double icon', 'two icons', 'two industries space', 'mixed space'],
    answer: 'A space showing two icons takes either of those two industries, whichever the builder chooses — never both: once a tile lands there the space is taken. Stoke-on-Trent’s pottery-or-iron-works space becomes one or the other depending on who gets there first. On the board, clicking the space cycles between the two industries on offer.' },
  { id: 'slotIconsMeaning', topic: 'The little icons on a space', words: ['little icons', 'icons mean', 'symbols on space', 'empty space icons'],
    answer: 'On an empty space the icons name the industries allowed there: cotton mill, manufactory, coal mine, iron works, pottery, brewery. Once a tile is placed the icons you read are the tile’s own: its level, the coal or iron cubes and beer barrels it carries, and its link icons — 0, 1 or 2 depending on the tile — each worth one point to every adjacent link at the end of the era.' },
  { id: 'merchantPlaces', topic: 'The merchant locations', words: ['merchant locations', 'how many merchants', 'shrewsbury', 'nottingham', 'warrington'],
    answer: 'Five merchants line the edge of the map: Shrewsbury (1 tile slot), Warrington, Nottingham, Oxford and Gloucester (2 slots each). Shrewsbury, Oxford and Gloucester are in play at 2 players, Warrington opens at 3 and Nottingham at 4 — so 5 merchant tiles are dealt at 2 players, 7 at 3 and 9 at 4. Their beer bonuses: Shrewsbury +4 VP, Nottingham +3 VP, Warrington £5, Oxford +2 spaces of income, Gloucester a free develop.' },
  { id: 'merchantTileVsPlace', topic: 'Merchant tile versus merchant location', words: ['blank merchant', 'blank tile', 'merchant tile difference'],
    answer: 'The merchant location is the printed place on the edge of the map; merchant tiles are shuffled at setup and dealt onto its slots, and they are what says what it buys. A blank tile buys nothing and gets no barrel beside it — a merchant whose tiles are all blank will never buy anything from you all game. The game shuffles the nine official tiles in the S4 variant: 2 blank, 2 cotton, 2 manufactory, 2 all-goods and 1 pottery.' },
  { id: 'allGoodsMerchant', topic: 'The all-goods tile', words: ['all goods', 'buys everything', 'all goods icon'],
    answer: 'An all-goods tile takes three goods: cotton, manufactured goods and pottery. It counts as those three icons together when you Sell. Every other tile buys only the good drawn on it.' },
  { id: 'merchantCoalIcon', topic: 'Merchants and the coal market', words: ['coal market merchant', 'connection coal market', 'buy coal merchant'],
    answer: 'Every merchant location carries the coal-market connection icon: to buy coal from the market, the place you are building at must be joined by links to one of the five merchants. The game accepts any of the five, including one that received no tile at 2 or 3 players. Iron asks for no connection at all.' },
  { id: 'farmBreweryCards', topic: 'Building on a farm brewery', words: ['wild location farm', 'farm brewery card', 'build on the farm'],
    answer: 'The two farm breweries sit outside the towns and take only a Brewery industry card or a wild industry card; the game refuses a wild location card outright, and no location card in the deck names them. Like any industry card it wants the place to be in your network — unless you have nothing on the board yet. A brewery built there gets 1 barrel in the Canal Era and 2 in the Rail Era, as anywhere else.' },
  { id: 'farmBreweryLinks', topic: 'Connecting the farm breweries', words: ['north farm', 'south farm', 'connect the farm', 'cannock farm'],
    answer: 'The north farm, between Cannock and Walsall, hangs on a single route: Cannock to the farm, open in both eras. The south farm has no route of its own: the Kidderminster to Worcester link connects Kidderminster, Worcester and the farm in one go, and no second tile can be laid there. That link therefore counts three places, both for your network and for end-of-era scoring.' },
  { id: 'whatIsALink', topic: 'What a link is', words: ['link connects', 'link belong', 'belong to a town', 'who owns a link'],
    answer: 'A link is a tile laid on a printed route between two locations — two towns, or a town and a merchant. It belongs to the player who laid it, never to a town: it is not an industry and it takes up no industry space. It puts both of its ends into your network, and at the end of the era it scores the link icons of the places it touches, then leaves the board.' },
  { id: 'linkToMerchant', topic: 'A link to a merchant', words: ['link to merchant', 'reach a merchant', 'merchant route'],
    answer: 'Yes: seven routes end at a merchant — Coalbrookdale to Shrewsbury, Stoke-on-Trent to Warrington, Derby to Nottingham, Birmingham to Oxford, Redditch to Oxford, Worcester to Gloucester and Redditch to Gloucester. Such a link puts the merchant in your network and opens the connection to the coal market. At the end of the era a merchant location always counts 2 link icons, whatever tiles it holds.' },
  { id: 'canalOnlyRoute', topic: 'The canal-only route', words: ['canal only', 'burton walsall'],
    answer: 'Exactly one route exists in the Canal Era alone: Burton-on-Trent to Walsall. It drops out of the available routes in the Rail Era, where no rail may be laid on it. The Canal Era therefore offers 31 routes — the 30 shared ones plus that one.' },
  { id: 'railOnlyRoutes', topic: 'The rail-only routes', words: ['rail only', 'eight rail routes', 'rail only routes'],
    answer: 'Eight routes exist in the Rail Era alone: Belper to Leek, Birmingham to Nuneaton, Birmingham to Redditch, Burton-on-Trent to Cannock, Coventry to Nuneaton, Derby to Uttoxeter, Stone to Uttoxeter and Tamworth to Walsall. No canal may be laid on them. The Rail Era therefore has 38 routes: the 30 shared ones plus those eight.' },
  { id: 'oneLinkPerRoute', topic: 'Two players on the same route', words: ['same route', 'two players same', 'second link route'],
    answer: 'No: a route carries a single link tile for the whole era, and the game drops any route already taken from the list of targets. You never double a link, and a rail does not replace a canal. All link tiles come off the board after Canal Era scoring, which frees the routes again for the Rail Era.' },
  { id: 'whereToLayLink', topic: 'Where you may lay a link', words: ['where lay link', 'where build a link', 'first link'],
    answer: 'A link must touch your network: a place where you hold a tile, or an end of one of your own links. While you have nothing on the board you may lay it anywhere. It goes on a free route of the current era: a canal for £3, a rail for £5 plus one coal that must be reachable once the tile is down.' },
  { id: 'connectedMeaning', topic: 'What connected means', words: ['connected means', 'what is connected', 'distance in links', 'count the links'],
    answer: 'Connected means joined by a chain of link tiles on the board, whoever owns them — every player’s links count. Distance is counted in link tiles crossed: the game draws coal from the nearest connected mine first, breaking ties by the largest stock. This is not the same as your network, which only says where you are allowed to build and lay.' },
  { id: 'rivalMineLinks', topic: 'Using another player’s mine', words: ['rival mine', 'opponent mine', 'my own links'],
    answer: 'Your own links are not required: to draw from a mine, a chain of links laid by anyone at all must join your place to that mine. Coal leaves the nearest connected mine, and its owner has no say; all they get is the flip of their tile when the last cube goes. Iron is taken from any iron works on the board, with no link needed.' },
  { id: 'potteryPlaces', topic: 'Where potteries are built', words: ['pottery towns', 'where pottery', 'pottery space', 'where ceramics'],
    answer: 'There are only four pottery spaces on the board: Belper, Stafford, Coventry, and Stoke-on-Trent, where the space is shared with the iron works. Each player nonetheless holds 5 pottery tiles: the places run out before the tiles do. Belper’s and Derby’s location cards only enter the deck at 4 players.' },
  { id: 'linkTileStock', topic: 'How many link tiles you have', words: ['link tile stock', 'run out of links', 'number of link tiles'],
    answer: 'The rulebook gives each player 14 link tiles, but the game keeps no such stock: nothing stops you laying more. The only limits enforced are the routes still free in the current era, your money, the coal a rail demands, and the need to touch your network.' },
  { id: 'linksSweptAtEraEnd', topic: 'Links at the end of an era', words: ['links removed', 'canals removed', 'links end of era'],
    answer: 'At the end of each era every link first scores the link icons of the places it touches — everyone’s tiles count, flipped or not, and a merchant is worth 2 — and then all link tiles come off the board. The Rail Era therefore starts on a map with no links at all, and networks must be rebuilt. Level 1 industry tiles are swept away at the same moment.' },
];

/** the entries the guide knows in a tongue: the same answers in all four,
 *  English standing in for a tongue the case does not know */
export function faqFor(lang: Lang): FaqEntry[] {
  switch (lang) {
    case 'fr':
      return FR;
    case 'es':
      return WRITTEN_ES;
    case 'de':
      return WRITTEN_DE;
    default:
      return EN;
  }
}

/* --------------------- the rules, read as written -------------------- */

/** a passage of the rules codex: its heading, and what it says */
export interface Passage {
  title: string;
  body: string;
}

/** the words too common to tell one passage from another */
const STOP = new Set(
  plain(
    "le la les un une des du de au aux et ou a à en dans sur pour par avec sans est sont ce cet cette ces que qui quoi quand comment pourquoi je tu il elle on nous vous ils elles mon ma mes votre vos son sa ses plus moins tout tous toute toutes ne pas si me te se y d l n s c j qu " +
      "the a an of to in on for with and or is are be it its this that what when how why do does can i you my your he she they them not no if at from as by more less all any",
  ).split(' '),
);

/** a crude stem: the plural and the commonest endings, in both tongues */
export const stem = (w: string): string => {
  const cut = w
    .replace(/eaux$/, 'eau')
    .replace(/aux$/, 'al')
    .replace(/(ements|ement|ations|ation|tions|tion|ing)$/, '')
    .replace(/[sx]$/, '');
  return cut.length >= 3 ? cut : w;
};

/** two words stand for each other when their stems agree, or when they
 *  share a long enough beginning: "surconstruction" answers to
 *  "surconstruire" */
export const akin = (a: string, b: string): boolean => {
  if (a.length < 3 || b.length < 3) return false;
  if (stem(a) === stem(b)) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 4 && long.startsWith(short)) return true;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i >= 6;
};

const terms = (s: string): string[] => plain(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w)).map(stem);

/** every {title, body} of the rules codex, flattened into passages */
export function passagesOf(rules: unknown): Passage[] {
  const out: Passage[] = [];
  const walk = (node: unknown, head: string) => {
    if (!node || typeof node !== 'object') return;
    const rec = node as Record<string, unknown>;
    const own = typeof rec.title === 'string' ? rec.title : head;
    for (const [k, v] of Object.entries(rec)) {
      if (typeof v === 'string') {
        if (v.length < 80 || k === 'title') continue;
        /* `betweenBody` is headed by `betweenTitle`, `body` by `title` */
        const paired = k.endsWith('Body') ? rec[`${k.slice(0, -4)}Title`] : undefined;
        out.push({ title: typeof paired === 'string' ? paired : own, body: v });
      } else walk(v, typeof (v as Record<string, unknown>)?.title === 'string' ? ((v as Record<string, unknown>).title as string) : own);
    }
  };
  walk(rules, '');
  /* the same body can be reached twice through the tree */
  const seen = new Set<string>();
  return out.filter((p) => (seen.has(p.body) ? false : (seen.add(p.body), true)));
}

/** the passage that best answers a question, or null when none is close.
 *  A passage scores on the question's own words it carries, rarer words
 *  counting for more, and must carry at least two of them. */
export function rulesMatch(question: string, passages: Passage[]): Passage | null {
  const asked = [...new Set(terms(question))];
  if (asked.length === 0 || passages.length === 0) return null;
  const bag = passages.map((p) => terms(`${p.title} ${p.body}`));
  const spread = new Map<string, number>();
  for (const words of bag) {
    const set = new Set(words);
    for (const w of asked) if (set.has(w)) spread.set(w, (spread.get(w) ?? 0) + 1);
  }
  const avg = bag.reduce((a, b) => a + b.length, 0) / bag.length;
  const K1 = 1.2;
  const B = 0.75;
  let best: { p: Passage; score: number } | null = null;
  bag.forEach((words, i) => {
    let score = 0;
    let hits = 0;
    for (const w of asked) {
      const f = words.filter((x) => x === w).length;
      if (f === 0) continue;
      hits += 1;
      const n = spread.get(w) ?? 1;
      const idf = Math.log(1 + (passages.length - n + 0.5) / (n + 0.5));
      score += (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * words.length) / avg));
    }
    /* one word in common is a coincidence; two is an answer */
    if (hits >= 2 && (!best || score > best.score)) best = { p: passages[i], score };
  });
  return best ? (best as { p: Passage }).p : null;
}

/** does a question carry every word of this phrase? the shape the guide
 *  matches its own table questions with, so one measure decides them all */
export function carries(question: string, phrase: string): number {
  const asked = plain(question).split(' ');
  /* a word of two letters or fewer carries nothing: "combien de villes" is
     answered by a question that says combien and villes */
  const words = plain(phrase).split(' ').filter((w) => w.length >= 3);
  if (!words.length) return 0;
  return words.every((w) => asked.some((x) => akin(x, w))) ? words.join(' ').length : 0;
}

/** the entry a question points at, and how sure the match is: an entry wins
 *  on the longest of its phrases the question carries */
export function faqMatch(question: string, entries: FaqEntry[]): FaqEntry | null {
  return faqBest(question, entries)?.entry ?? null;
}

/** the same, with how long the phrase matched was: the longer the phrase a
 *  question carries, the surer the answer, whatever else also matched */
export function faqBest(question: string, entries: FaqEntry[]): { entry: FaqEntry; score: number } | null {
  const q = plain(question);
  if (q.length < 3) return null;
  let best: { entry: FaqEntry; score: number } | null = null;
  for (const entry of entries) {
    for (const phrase of entry.words) {
      const score = carries(question, phrase);
      /* the longer the phrase matched, the surer the entry */
      if (score && (!best || score > best.score)) best = { entry, score };
    }
  }
  return best;
}

