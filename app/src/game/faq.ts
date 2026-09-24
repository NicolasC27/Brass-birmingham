/* ------------------------------------------------------------------ */
/* What the guide knows of the rules themselves.                       */
/*                                                                     */
/* Every answer here is written from brass/game-data.md and checked    */
/* against the engine — none is generated, so none can invent a rule.  */
/* A question is matched on the words it carries: the entry sharing the */
/* most of them wins, and nothing below one word wins at all.          */
/* ------------------------------------------------------------------ */

import type { Lang } from '@/i18n';

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
  { id: 'debt', topic: 'Quand on ne peut pas payer', words: ['pas payer', 'dette', 'faillite', 'revenu negatif', 'manque argent paie'],
    answer: 'Si le revenu est négatif et que la caisse ne suit pas, il faut céder une ou plusieurs de vos tuiles Industrie du plateau, chacune valant la moitié de son coût arrondie à l’inférieur. Les tuiles cédées quittent le jeu et ne marquent rien. S’il manque encore de l’argent, c’est un point de victoire perdu par livre manquante.' },
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
  { id: 'overbuild', topic: 'La surconstruction', words: ['surconstruire', 'overbuild', 'construire sur', 'remplacer tuile'],
    answer: 'On ne surconstruit que la même industrie, à un niveau supérieur. Sur vos propres tuiles, librement. Sur celle d’un adversaire, uniquement une mine de charbon ou une forge, et seulement s’il ne reste plus un seul cube de cette ressource nulle part, marché compris. La tuile remplacée quitte le jeu ; ce qu’elle a déjà rapporté reste acquis.' },
  { id: 'onePerTown', topic: 'Plusieurs tuiles dans une ville', words: ['deux tuiles ville', 'une tuile par lieu', 'plusieurs tuiles meme ville'],
    answer: 'À l’ère canal, vous ne pouvez avoir qu’une seule de vos tuiles par lieu — mais les autres joueurs peuvent en poser dans le même lieu. À l’ère rail, cette limite tombe : vous pouvez en avoir plusieurs au même endroit.' },
  { id: 'eraIcon', topic: 'Les icônes canal et rail', words: ['icone canal', 'icone rail', 'tuile ere', 'construire ere rail'],
    answer: 'Une icône canal sur le tapis signifie que la tuile ne se construit qu’à l’ère canal ; à l’ère rail il faut la développer pour l’enlever. Une icône rail, l’inverse. Deux exceptions : la poterie I se construit aussi à l’ère rail, et la brasserie IV comme la poterie V sont réservées au rail.' },
  { id: 'railBeer', topic: 'Les brasseries à l’ère rail', words: ['brasserie deux barils', 'baril ere rail', 'brasserie rail'],
    answer: 'Une brasserie construite à l’ère canal reçoit un baril ; construite à l’ère rail, elle en reçoit deux. C’est la même tuile, c’est l’ère de sa construction qui décide.' },
  { id: 'farmBrewery', topic: 'Les brasseries fermières', words: ['brasserie fermiere', 'farm brewery', 'hors ville'],
    answer: 'Deux emplacements de brasserie sont posés hors des villes, sur la carte. Ils se bâtissent comme les autres, mais aucun joker lieu ne les vise : il faut la carte qui les nomme, ou une carte industrie brasserie si le lieu est dans votre réseau.' },
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
  { id: 'debt', topic: 'When you cannot pay', words: ['cannot pay', 'debt', 'bankrupt', 'negative income', 'short of money'],
    answer: 'If income is negative and the purse cannot follow, you must give up one or more of your industry tiles on the board, each worth half its cost rounded down. Tiles given up leave the game and score nothing. If money is still short, that is one victory point per pound missing.' },
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
  { id: 'overbuild', topic: 'Overbuilding', words: ['overbuild', 'build over', 'replace tile'],
    answer: 'You may overbuild only the same industry, at a higher level. On your own tiles, freely. On an opponent’s, only a coal mine or an iron works, and only when not one cube of that resource is left anywhere, the market included. The replaced tile leaves the game; what it already paid stays paid.' },
  { id: 'onePerTown', topic: 'Several tiles in one town', words: ['two tiles town', 'one tile per location', 'several tiles same town'],
    answer: 'In the Canal Era you may hold only one tile of yours per location — though the other players may build in the same place. In the Rail Era that limit goes: you may hold several in one place.' },
  { id: 'eraIcon', topic: 'The canal and rail icons', words: ['canal icon', 'rail icon', 'tile era', 'build in rail era'],
    answer: 'A canal icon on the mat means the tile may be built in the Canal Era only; in the Rail Era it must be developed away. A rail icon means the opposite. Two exceptions: pottery I may also be built in the Rail Era, and brewery IV and pottery V are rail only.' },
  { id: 'railBeer', topic: 'Breweries in the Rail Era', words: ['brewery two barrels', 'barrel rail era', 'brewery rail'],
    answer: 'A brewery built in the Canal Era takes one barrel; built in the Rail Era it takes two. Same tile — the era it is built in decides.' },
  { id: 'farmBrewery', topic: 'The farm breweries', words: ['farm brewery', 'outside town'],
    answer: 'Two brewery slots sit outside the towns, on the map. They are built like any other, but no wild location reaches them: it takes the card that names them, or a brewery industry card if the place is in your network.' },
];

/** the entries the guide knows in a tongue, English standing in where a
 *  tongue has none of its own */
export function faqFor(lang: Lang): FaqEntry[] {
  return lang === 'fr' ? FR : EN;
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

/** the entry a question points at, and how sure the match is: an entry wins
 *  on the longest of its phrases the question carries */
export function faqMatch(question: string, entries: FaqEntry[]): FaqEntry | null {
  const q = plain(question);
  if (q.length < 3) return null;
  const asked = q.split(' ');
  let best: { entry: FaqEntry; score: number } | null = null;
  for (const entry of entries) {
    for (const phrase of entry.words) {
      const p = plain(phrase);
      const words = p.split(' ');
      if (!words.every((w) => asked.some((x) => akin(x, w)))) continue;
      /* the longer the phrase matched, the surer the entry */
      const score = p.length;
      if (!best || score > best.score) best = { entry, score };
    }
  }
  return best?.entry ?? null;
}
