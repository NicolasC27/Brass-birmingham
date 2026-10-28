import type { Tongue } from './notions';

/* ------------------------------------------------------------------ */
/* The guide's case, in French. Every figure is read off                */
/* brass/game-data.md and checked against the engine: none is guessed.  */
/* The answers describe the rules and the table; none says what to play */
/* nor what a move would score.                                         */
/* ------------------------------------------------------------------ */

export const FR: Tongue = {
  near: 'Je ne trouve pas cette question telle quelle dans les règles. Vouliez-vous parler de :',
  self: 'je j moi mon ma mes me m'.split(' '),
  define: 'quoi qu sert servent servir definition definir signifie explique expliquer expliquez vient viennent utilite role fonctionne'.split(' '),
  where: 'ou'.split(' '),
  alias: {
    pk: 'pourquoi', pq: 'pourquoi', pkoi: 'pourquoi', pourkoi: 'pourquoi', pourqoi: 'pourquoi', purquoi: 'pourquoi',
    koi: 'quoi', kwa: 'quoi', quoa: 'quoi', cb: 'combien', cmb: 'combien', cmt: 'comment', koman: 'comment', commen: 'comment',
    qd: 'quand', qq: 'quelque', stp: '', svp: '', slt: '', bjr: '', jpeux: 'je peux', jpeu: 'je peux', peu: 'peux', pe: 'peux', pa: 'pas',
    chui: 'je suis', jsuis: 'je suis', ya: 'il y a', cest: 'c est', sest: 's est', kel: 'quel', kelle: 'quelle', ke: 'que', ki: 'qui',
    pv: 'pv', pts: 'points', pt: 'point', nv: 'niveau', niv: 'niveau', lvl: 'niveau', dev: 'developper', bdd: '',
  },
  stop: (
    'le la les l un une des du de d au aux et ou a en dans sur sous pour par avec sans est sont etre ete ce c cet cette ces ca cela ceci ' +
    'que qu qui quoi quel quelle quels quelles quand comment pourquoi combien je j tu il elle on nous vous ils elles me m te t se s y ' +
    'mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs plus moins tres trop tout tous toute toutes ne n pas si oui non ' +
    'peux peut peuvent pouvoir puis pourrais pourrait dois doit doivent devoir faut falloir faire fais fait font ai as avons avez ont avoir ' +
    'suis es sommes etes va vais vas vont aller veux veut vouloir voudrais sert servent servir sers donc alors mais car comme aussi encore ' +
    'deja bien mal bon bonne quelque chose choses truc trucs machin exactement vraiment merci bonjour salut maintenant ici lorsque apres ' +
    'avant pendant depuis jusqu vers chez moi toi lui eux celle celui ceux celles lequel laquelle dont autre autres meme memes chaque ' +
    'ouais nan genre sais savoir explique expliquer expliquez dire dis dit signifie signifier veut dire sens definition role utilite ' +
    'fonctionne fonctionnent fonctionnement exemple quoi cas lors afin tant celle-ci voila voici hein ok okay bah ben euh bref sinon ' +
    'possible pres tres existe existent concerne concernant propos sujet regle question questions demande demander aidez ' +
    'montre montrer peut-etre facon maniere moment fois jamais toujours souvent parfois beaucoup peu mettre met mets prendre prend ' +
    'prends pris avoir eu eue quelqu quelqu un rien personne tout-a-fait voir vois voit regarde regarder utiliser utilise sert-il ' +
    'combien-de est-ce estce qu-est-ce faudrait pouvez pouvons devez devons fallait etait sera serait seront avait aurait aura'
  ).split(' '),
  cues: {
    whyNot: ['pourquoi pas', 'peux pas', 'peut pas', 'pouvez pas', 'pouvons pas', 'arrive pas', 'arrivent pas', 'fonctionne pas', 'marche pas', 'veut pas', 'impossible', 'interdit', 'interdite', 'refuse', 'refusee', 'bloque', 'bloquee', 'grise', 'grisee', 'empeche', 'droit pas', 'pas droit', 'pourquoi non', 'passe pas'],
    gain: ['rapporte', 'rapportent', 'rapport', 'rapporter', 'gagne', 'gagner', 'gain', 'gains', 'vaut', 'valent', 'marque', 'marquent', 'donne', 'donnent', 'benefice', 'interet', 'profit', 'avantage', 'recompense'],
    cost: ['coute', 'coutent', 'cout', 'couts', 'couter', 'prix', 'cher', 'chere', 'tarif', 'payer', 'paye', 'combien faut'],
    how: ['comment', 'facon', 'maniere', 'methode', 'etapes', 'procedure', 'on fait', 'je fais', 'faire pour'],
  },
  notions: {
    coalMine: {
      topic: 'les mines de charbon',
      words: ['mine', 'mines', 'mine charbon', 'mines charbon', 'houillere', 'houilleres', 'charbonnage', 'charbonnages', 'puits', 'puits mine', 'colliery', 'coal mine', 'chevalement', 'minier', 'miniere', 'exploitation charbon', 'vendre charbon', 'charbon vendu'],
      what: 'Une mine de charbon produit des cubes de charbon : 2 à 5 selon le niveau, posés sur la tuile quand vous la construisez. Tout joueur relié à votre mine y prend son charbon gratuitement, pour bâtir ou poser un rail. La mine se retourne quand son dernier cube part — peu importe qui l’a pris — et c’est alors qu’elle fait monter votre revenu et qu’elle marquera ses points. Si elle est reliée à un emplacement marchand au moment où vous la bâtissez, ses cubes partent aussitôt au marché du charbon contre argent.',
      how: 'Il vous faut une carte qui l’autorise (la carte lieu de la ville, la carte industrie charbon pour une ville de votre réseau, ou un joker), un emplacement libre portant l’icône charbon, et l’argent — plus un fer aux niveaux III et IV. Choisissez la carte, l’action Construire, puis l’emplacement qui s’allume, et confirmez.',
      cost: 'Niveau I : 5 £, ère canal seulement, 2 cubes. Niveau II : 7 £, 3 cubes. Niveau III : 8 £ et 1 fer, 4 cubes. Niveau IV : 10 £ et 1 fer, 5 cubes. Vous en avez sept sur votre tapis (un I, deux de chaque autre niveau), et l’on bâtit toujours le plus bas niveau qui reste.',
      gain: 'Retournée, une mine avance votre revenu de 4, 7, 6 ou 5 espaces (niveaux I à IV) et marque 1, 2, 3 ou 4 PV à chaque décompte d’ère où elle est encore là. À la construction, elle rapporte aussi le prix des cubes partis au marché, si elle est reliée à un marchand. Une mine vidée par vos rivaux vous rapporte autant qu’une mine vidée par vous.',
    },
    ironWorks: {
      topic: 'les forges',
      words: ['forge', 'forges', 'siderurgie', 'siderurgique', 'usine siderurgique', 'acierie', 'acieries', 'fonderie', 'fonderies', 'haut fourneau', 'hauts fourneaux', 'usine fer', 'iron works', 'ironworks', 'metallurgie', 'vendre fer', 'fer vendu'],
      what: 'Une forge (usine sidérurgique) produit le fer : 4 à 6 barres posées sur la tuile à sa construction. Elle vend aussitôt au marché du fer tout ce qui y tient, reliée ou non à un marchand, et vous encaissez le prix de chaque case remplie. Le fer qui reste sert à qui en a besoin, n’importe où sur le plateau, et la forge se retourne quand sa dernière barre part.',
      how: 'Une carte qui l’autorise (la carte lieu de la ville, une carte forge pour une ville de votre réseau, ou un joker), un emplacement libre à l’icône forge, l’argent et un charbon relié au chantier. Choisissez la carte, l’action Construire, l’emplacement, puis confirmez.',
      cost: 'Niveau I : 5 £ et 1 charbon, ère canal seulement, 4 barres. Niveau II : 7 £ et 1 charbon, 4 barres. Niveau III : 9 £ et 1 charbon, 5 barres. Niveau IV : 12 £ et 1 charbon, 6 barres. Une tuile par niveau, quatre en tout sur votre tapis.',
      gain: 'Retournée, une forge avance votre revenu de 3, 3, 2 ou 1 espace (niveaux I à IV) et marque 3, 5, 7 ou 9 PV en fin d’ère. À sa construction, elle rapporte aussi le prix des barres parties au marché du fer.',
    },
    brewery: {
      topic: 'les brasseries',
      words: ['brasserie', 'brasseries', 'brewery', 'brasseur', 'brasseurs', 'malterie', 'tonnellerie', 'distillerie', 'brasserie rail', 'barils brasserie'],
      what: 'Une brasserie produit la bière dont les ventes et le double rail ont besoin : 1 baril posé à la construction en ère canal, 2 en ère rail, quel que soit son niveau. Vos propres barils se boivent partout, sans liaison ; ceux d’une brasserie adverse, seulement si elle est reliée. Elle se retourne quand son dernier baril est bu, par vous ou par un autre.',
      how: 'Une carte qui l’autorise (carte lieu de la ville, carte brasserie pour une ville de votre réseau, ou un joker), un emplacement libre à l’icône brasserie, l’argent et un fer — le fer n’a besoin d’aucune liaison. Choisissez la carte, Construire, l’emplacement, puis confirmez.',
      cost: 'Niveau I : 5 £ et 1 fer, ère canal seulement. Niveau II : 7 £ et 1 fer. Niveau III : 9 £ et 1 fer. Niveau IV : 9 £ et 1 fer, ère rail seulement. Sept brasseries sur votre tapis ; chacune reçoit 1 baril en ère canal et 2 en ère rail.',
      gain: 'Retournée, une brasserie avance votre revenu de 4 espaces (niveau I) ou de 5 (niveaux II à IV) et marque 4, 5, 7 ou 9 PV. Chacune porte 2 icônes lien, ce qui compte pour les liaisons qui touchent sa ville.',
    },
    farmBrewery: {
      topic: 'les brasseries fermières',
      words: ['brasserie fermiere', 'brasseries fermieres', 'ferme', 'fermes', 'fermiere', 'fermieres', 'farm brewery', 'ferme nord', 'ferme sud'],
      what: 'Deux emplacements isolés, sans nom, qui n’acceptent qu’une brasserie. On n’y bâtit qu’avec une carte industrie brasserie ou un joker industrie — jamais avec une carte lieu ni un joker lieu. Sur la carte des Midlands, la ferme nord se relie par la liaison Cannock–ferme ; la ferme sud est reliée par la liaison Kidderminster–Worcester elle-même, sans autre tuile.',
    },
    cotton: {
      topic: 'les filatures de coton',
      words: ['filature', 'filatures', 'coton', 'cotton', 'cotton mill', 'tissage', 'textile', 'textiles', 'filateur', 'fil', 'tisserand'],
      what: 'La filature de coton est un ouvrage : elle ne produit rien, elle se vend. Construite, elle attend ; l’action Vendre la retourne quand elle est reliée à un marchand qui achète le coton (ou « tous biens ») et que vous buvez 1 bière. C’est seulement alors qu’elle fait monter votre revenu et qu’elle marquera ses points. Il n’existe pas de carte filature seule : ce sont les cartes doubles coton/manufacture.',
      how: 'Pour la bâtir : une carte lieu de la ville, une carte double coton/manufacture pour une ville de votre réseau, ou un joker, sur un emplacement à l’icône coton. Pour la retourner ensuite : l’action Vendre, un marchand relié qui achète le coton, et 1 bière.',
      cost: 'Niveau I : 12 £, ère canal seulement. Niveau II : 14 £ et 1 charbon. Niveau III : 16 £, 1 charbon et 1 fer. Niveau IV : 18 £, 1 charbon et 1 fer. Onze filatures sur votre tapis (3, 2, 3 et 3), et chacune se vend pour 1 bière.',
      gain: 'Vendue, une filature avance votre revenu de 5, 4, 3 ou 2 espaces (niveaux I à IV) et marque 5, 5, 9 ou 12 PV en fin d’ère. Tant qu’elle n’est pas vendue, elle ne rapporte rien.',
    },
    manufacturer: {
      topic: 'les manufactures',
      words: ['manufacture', 'manufactures', 'manufacturier', 'manufacturiers', 'usine', 'usines', 'fabrique', 'fabriques', 'atelier', 'ateliers', 'biens manufactures', 'manufactory', 'manufacturer', 'marchandise', 'marchandises'],
      what: 'La manufacture est un ouvrage, comme la filature : elle se retourne par l’action Vendre, reliée à un marchand qui achète les biens manufacturés (ou « tous biens »). C’est l’industrie aux huit niveaux, aux coûts et aux gains très irréguliers : chaque tuile se lit sur votre tapis. Ses cartes sont les cartes doubles coton/manufacture.',
      how: 'Pour la bâtir : une carte lieu de la ville, une carte double coton/manufacture pour une ville de votre réseau, ou un joker, sur un emplacement à l’icône manufacture. Pour la retourner : l’action Vendre, un marchand relié qui achète ces biens, et la bière demandée.',
      cost: 'Les huit niveaux : I, 8 £ et 1 charbon (canal seulement) ; II, 10 £ et 1 fer ; III, 12 £ et 2 charbons ; IV, 8 £ et 1 fer ; V, 16 £ et 1 charbon ; VI, 20 £ ; VII, 16 £, 1 charbon et 1 fer ; VIII, 20 £ et 2 fers. Toutes se vendent pour 1 bière, sauf la V qui en demande 2.',
      gain: 'Vendue, une manufacture avance votre revenu de 5, 1, 4, 6, 2, 6, 4 ou 1 espace selon le niveau (I à VIII) et marque 3, 5, 4, 3, 8, 7, 9 ou 11 PV. Les niveaux III et VII n’ont aucune icône lien.',
    },
    pottery: {
      topic: 'les poteries',
      words: ['poterie', 'poteries', 'ceramique', 'ceramiques', 'faience', 'porcelaine', 'pottery', 'potier', 'potiers', 'ampoule', 'ampoules', 'poterie gratuite'],
      what: 'La poterie est un ouvrage qui se vend comme la filature, à un marchand qui achète la céramique ou « tous biens ». Sur la carte des Midlands, elle n’a que quatre villes où se bâtir : Belper, Coventry, Stoke-on-Trent et Stafford. Les niveaux I et III portent une ampoule : ils ne se développent pas, il faut les construire. Et par exception, la poterie I se bâtit aussi à l’ère rail.',
      how: 'Une carte lieu d’une ville à emplacement poterie, la carte poterie pour une telle ville de votre réseau, ou un joker ; puis l’action Vendre la retourne, reliée à un marchand qui achète la céramique ou « tous biens ».',
      cost: 'Niveau I : 17 £ et 1 fer. Niveau II : 0 £ et 1 charbon. Niveau III : 22 £ et 2 charbons. Niveau IV : 0 £ et 1 charbon. Niveau V : 24 £ et 2 charbons, ère rail seulement. Les niveaux I, II et IV se vendent pour 1 bière, III et V pour 2.',
      gain: 'Vendue, une poterie avance votre revenu de 5 espaces aux niveaux I, III et V, d’un seul aux niveaux II et IV. Elle marque 10, 1, 11, 1 ou 20 PV : la V est la tuile la plus lourde du jeu.',
      whyNot: 'Deux refus reviennent. Les poteries I et III portent une ampoule et ne se développent pas : il faut les bâtir pour les ôter du tapis. Et pour vendre, il faut un marchand relié qui achète la céramique ou « tous biens » — à deux joueurs, seule la tuile « tous biens » en prend.',
    },
    works: {
      topic: 'les ouvrages',
      words: ['ouvrage', 'ouvrages'],
      what: 'Un ouvrage, c’est une tuile qui se vend : filature, manufacture ou poterie. Il ne produit rien : bâti, il attend que l’action Vendre le retourne, relié par des liaisons — les vôtres ou celles des autres — à un marchand qui achète ce bien, en buvant une ou deux bières. Retourné, il avance votre revenu et marque ses points en fin d’ère. Mines, forges et brasseries ne se vendent pas : elles se retournent quand on les vide.',
      how: 'Il se bâtit comme une autre tuile : une carte qui l’autorise, un emplacement libre qui montre son icône, son prix, et le charbon ou le fer que demande son niveau. Pour le vendre ensuite : l’action Vendre, une liaison jusqu’à un marchand qui achète ce bien, et une ou deux bières selon la tuile.',
    },
    coal: {
      topic: 'le charbon',
      words: ['charbon', 'charbons', 'cube charbon', 'cubes charbon', 'houille', 'coal', 'cube noir', 'cubes noirs', 'combustible', 'charbon adverse', 'charbon adversaire', 'charbon rival'],
      what: 'Le charbon est demandé par certaines constructions et par chaque rail. Il doit arriver jusqu’au chantier : il vient gratuitement de la mine non retournée la plus proche qui y est reliée, à qui qu’elle soit. À défaut, il s’achète au marché, mais seulement si le chantier est relié à un emplacement marchand. Sinon, la construction est impossible.',
      cost: 'Pris dans une mine reliée, le charbon est gratuit, même dans la mine d’un rival. Au marché, il coûte de 1 à 7 £ selon ce qui reste, la case la moins chère d’abord, et 8 £ quand le marché est vide.',
      whyNot: 'Le charbon doit être relié : aucune mine non retournée n’atteint ce lieu par des liaisons, et le lieu n’atteint pas non plus d’emplacement marchand pour acheter au marché. Une liaison vers une mine, ou vers un marchand, ouvre la voie.',
    },
    iron: {
      topic: 'le fer',
      words: ['fer', 'fers', 'barre fer', 'barres fer', 'barre', 'barres', 'cube fer', 'cubes fer', 'iron', 'metal', 'acier', 'minerai', 'lingot', 'lingots'],
      what: 'Le fer est demandé par certaines constructions et par chaque tuile développée. Il n’a besoin d’aucune liaison : on le prend gratuitement sur n’importe quelle forge non retournée du plateau, à qui qu’elle soit. À défaut de forge, il s’achète au marché du fer, lui aussi sans connexion.',
      cost: 'Pris sur une forge, le fer est gratuit, même chez un rival. Au marché, il coûte de 1 à 5 £ selon ce qui reste, la case la moins chère d’abord, et 6 £ quand le marché est vide.',
      whyNot: 'Le fer ne manque que s’il n’en reste nulle part : aucune forge non retournée n’en porte, et vous n’avez pas de quoi le payer au marché (6 £ la barre s’il est vide). Aucune liaison n’est jamais demandée pour le fer.',
    },
    beer: {
      topic: 'la bière',
      words: ['biere', 'bieres', 'baril', 'barils', 'tonneau', 'tonneaux', 'beer', 'barrel', 'houblon', 'chope', 'ale', 'biere marchand', 'baril marchand', 'biere adverse', 'biere rivale', 'biere adversaire', 'biere adversaires', 'biere propre', 'mousse', 'pinte'],
      what: 'La bière se boit pour vendre (1 ou 2 barils par tuile) et pour le double rail. Trois sources, baril par baril : vos brasseries non retournées, n’importe où et sans liaison ; la brasserie d’un rival, seulement si elle est reliée à la tuile vendue ; ou le baril posé chez le marchand à qui vous vendez, qui donne en plus son bonus. Le double rail, lui, ne boit jamais la bière d’un marchand.',
      whyNot: 'Sans la bière demandée, la vente est refusée. Vos brasseries doivent encore porter des barils ; une brasserie adverse ne sert que si elle est reliée à la tuile vendue ; et le baril d’un marchand ne sert qu’à qui vend à ce marchand-là, une fois par ère.',
      cost: 'La bière ne s’achète pas : elle se boit gratuitement, dans vos brasseries, dans celle d’un rival reliée à la tuile vendue, ou chez le marchand. Ce qu’elle coûte, c’est la brasserie qu’il a fallu bâtir.',
    },
    market: {
      topic: 'le marché du charbon et du fer',
      words: ['marche', 'marches', 'bourse', 'marche charbon', 'marche fer', 'prix charbon', 'prix fer', 'acheter charbon', 'acheter fer', 'achat charbon', 'achat fer', 'market', 'cours', 'marche vide'],
      what: 'Deux marchés au bord du plateau : 14 cases de charbon, deux à chaque prix de 1 à 7 £, et 10 cases de fer, deux à chaque prix de 1 à 5 £. On achète toujours la case la moins chère d’abord ; vide, le marché vend encore, 8 £ le charbon et 6 £ le fer. Il ne se recharge jamais seul : seules les mines et les forges qu’on construit y vendent leurs cubes, en remplissant les cases les plus chères d’abord.',
      cost: 'Le prix dépend de ce qui reste : la case la moins chère encore pleine, 1 à 7 £ pour le charbon, 1 à 5 £ pour le fer, puis 8 £ et 6 £ quand tout est parti. Acheter du charbon demande d’être relié à un emplacement marchand ; le fer, non. Au réglage standard, la partie s’ouvre avec 13 charbons et 8 fers.',
      gain: 'Quand vous bâtissez une mine reliée à un marchand, ou n’importe quelle forge, les cubes qui tiennent au marché y partent et vous encaissez le prix imprimé de chaque case remplie, les plus chères d’abord. C’est la seule façon de vendre au marché, et cela n’arrive qu’à la construction.',
      whyNot: 'Le charbon du marché n’arrive qu’aux lieux reliés à un emplacement marchand, n’importe lequel des cinq. Le fer, lui, s’achète sans condition ; s’il vous est refusé, c’est l’argent qui manque.',
    },
    build: {
      topic: 'l’action Construire',
      words: ['construire', 'construction', 'constructions', 'construis', 'construit', 'batir', 'bati', 'batiment', 'poser tuile', 'placer tuile', 'build', 'edifier', 'implanter', 'industrie', 'industries', 'tuile grisee', 'case grisee', 'emplacement grise'],
      what: 'Construire pose une tuile industrie sur un emplacement libre : défaussez une carte qui l’autorise, payez la tuile en argent et en ressources, et prenez toujours la tuile de plus bas niveau de cette industrie sur votre tapis. Une carte lieu bâtit dans sa ville, même hors de votre réseau ; une carte industrie bâtit cette industrie dans une ville de votre réseau. À l’ère canal, une seule de vos tuiles par lieu.',
      how: 'Choisissez une carte dans votre main, puis l’action Construire : les emplacements possibles s’allument sur la carte. Cliquez celui que vous voulez, lisez la note (prix, charbon et fer, et d’où ils viennent), puis confirmez. Si l’emplacement accepte deux industries, un nouveau clic passe de l’une à l’autre.',
      cost: 'Le prix est celui de la tuile de plus bas niveau qui reste sur votre tapis : de l’argent, parfois du charbon et du fer. Le charbon d’une mine reliée et le fer d’une forge sont gratuits ; ceux du marché se paient au prix de la case. Le tapis (touche P) montre le coût de chaque prochaine tuile.',
      whyNot: 'Les refus les plus courants : la carte ne vise ni cette ville ni cette industrie, ou la ville n’est pas dans votre réseau ; l’emplacement n’a pas l’icône voulue ou il est pris ; vous avez déjà une tuile dans ce lieu (ère canal) ; la prochaine tuile de votre tapis n’est pas de cette ère ; le charbon n’arrive pas jusqu’au chantier ; ou l’argent manque. Cliquez l’emplacement : la table vous donne sa raison.',
    },
    network: {
      topic: 'l’action Réseau',
      words: ['reseau', 'reseaux', 'mon reseau', 'action reseau', 'poser liaison', 'poser canal', 'poser rail', 'construire canal', 'construire rail', 'construire liaison', 'network', 'relier', 'tracer', 'etendre reseau'],
      what: 'L’action Réseau pose une tuile liaison sur une route libre qui touche votre réseau : un canal à l’ère canal, un rail à l’ère rail. Votre réseau, ce sont les lieux où vous avez une tuile et ceux que touchent vos liaisons ; c’est là que vos cartes industrie peuvent bâtir. Tant que vous n’avez rien sur le plateau, la première liaison se pose n’importe où.',
      how: 'Choisissez une carte (n’importe laquelle), l’action Réseau, puis une route qui s’allume sur la carte, et confirmez. À l’ère rail, vous pouvez poser un second rail dans la même action.',
      cost: 'À l’ère canal : 3 £ le canal, un seul par action. À l’ère rail : 5 £ et 1 charbon le rail, ou deux rails dans la même action pour 15 £, 1 charbon chacun et 1 bière tirée d’une brasserie. Le charbon d’un rail doit être relié à la liaison une fois posée.',
      whyNot: 'La route doit être libre et toucher votre réseau — une route ne porte qu’une liaison. À l’ère canal, les routes réservées au rail sont fermées ; à l’ère rail, la route Burton–Walsall, réservée au canal, l’est aussi. Un rail demande en plus un charbon relié à la liaison, le double rail une bière de brasserie, et il faut l’argent.',
    },
    develop: {
      topic: 'l’action Développer',
      words: ['developper', 'developpe', 'developpement', 'developpements', 'develop', 'retirer tuile', 'retirer tuiles', 'sauter niveau', 'sauter niveaux', 'upgrade', 'ameliorer', 'amelioration'],
      what: 'Développer retire une ou deux tuiles de votre tapis sans les bâtir, pour atteindre plus vite les niveaux supérieurs. Chaque tuile ôtée est la plus basse de sa colonne et coûte 1 fer ; elle retourne à la boîte et ne rapporte rien. Les poteries à ampoule (niveaux I et III) ne peuvent pas être développées.',
      how: 'Choisissez une carte, l’action Développer, puis la ou les tuiles à ôter : une ou deux, de la même industrie ou de deux industries différentes. La note indique d’où vient le fer ; confirmez.',
      cost: 'Une carte, et 1 fer par tuile retirée — pris gratuitement sur n’importe quelle forge, sinon acheté au marché du fer (1 à 5 £, 6 £ s’il est vide). Rien d’autre : deux tuiles dans la même action coûtent deux fers.',
      gain: 'Développer ne rapporte rien sur le moment : ni argent, ni revenu, ni points. Ce que l’action change, c’est la prochaine tuile de la colonne, qui sera d’un niveau plus haut.',
      whyNot: 'Il faut du fer : une forge non retournée quelque part, ou de quoi l’acheter au marché. La tuile visée doit aussi être développable — les poteries I et III, à ampoule, ne le sont pas — et il doit rester une tuile dans la colonne.',
    },
    sell: {
      topic: 'l’action Vendre',
      words: ['vendre', 'vente', 'ventes', 'vend', 'vendu', 'vendue', 'sell', 'ecouler', 'commercer', 'negoce', 'commerce', 'livrer'],
      what: 'Vendre retourne vos ouvrages — filatures, manufactures, poteries. Défaussez n’importe quelle carte, choisissez une tuile non retournée reliée à un marchand qui achète ce bien, et buvez la bière qu’elle demande. La tuile se retourne : votre revenu monte aussitôt, ses points viendront en fin d’ère. Une même action peut vendre plusieurs tuiles, tant que la bière suit.',
      how: 'Choisissez une carte, l’action Vendre, puis la tuile à vendre : la table propose les marchands atteignables et la bière disponible. Ajoutez d’autres tuiles si vous le voulez, puis confirmez.',
      gain: 'Chaque tuile vendue avance votre revenu du nombre d’espaces imprimé sur elle et marquera ses points à la fin de l’ère. Boire le baril du marchand ajoute son bonus. La vente elle-même ne verse pas d’argent.',
      cost: 'Une carte, quelle qu’elle soit, et la bière de chaque tuile vendue : 1 baril le plus souvent, 2 pour la manufacture V et les poteries III et V. Aucun argent.',
      whyNot: 'Pour vendre, la tuile doit être un ouvrage non retourné (mines, forges et brasseries ne se vendent pas : elles se vident), relié par des liaisons à un marchand qui achète ce bien — une tuile marchande vierge n’achète rien. Il faut aussi la bière demandée : vos brasseries, une brasserie adverse reliée, ou le baril du marchand.',
    },
    loan: {
      topic: 'l’emprunt',
      words: ['emprunt', 'emprunts', 'emprunter', 'pret', 'prets', 'preter', 'credit', 'credits', 'banque', 'banquier', 'dette', 'dettes', 'loan', 'rembourser', 'remboursement', 'endetter', 'endettement'],
      what: 'Emprunter est une action : défaussez une carte, recevez 30 £, et votre revenu recule de 3 niveaux (pas de 3 espaces), posé sur l’espace le plus haut du nouveau niveau. Un emprunt ne se rembourse jamais : son prix, c’est ce revenu perdu à chaque paie jusqu’à la fin. Impossible si le revenu devait passer sous le niveau −10.',
      how: 'Choisissez une carte, l’action Emprunter, et confirmez : les 30 £ arrivent aussitôt, et la piste de revenu montre où tombe votre marqueur.',
      cost: 'Un emprunt rapporte 30 £ et coûte 3 niveaux de revenu, donc à chaque paie restante ce que ces trois niveaux auraient versé. Il ne se rembourse pas : on ne rend jamais les 30 £, ni en cours ni en fin de partie.',
      whyNot: 'Un emprunt fait descendre le revenu de 3 niveaux, et le revenu ne descend jamais sous −10. Si votre marqueur est déjà au niveau −8 ou plus bas, la banque refuse.',
    },
    scout: {
      topic: 'la prospection',
      words: ['prospection', 'prospecter', 'prospecte', 'scout', 'scouter', 'eclaireur', 'explorer', 'exploration', 'reconnaissance', 'deux jokers'],
      what: 'La prospection vous donne les deux jokers d’un coup : défaussez trois cartes (celle de l’action et deux autres) et prenez un joker lieu et un joker industrie. Elle est interdite si vous tenez déjà un joker. Les jokers défaussés retournent à leur pile, qui compte quatre jokers de chaque sorte.',
      how: 'Choisissez une carte, l’action Prospection, puis deux autres cartes à défausser ; confirmez, et les deux jokers entrent dans votre main.',
      cost: 'Trois cartes de votre main, et rien d’autre : pas d’argent. Vous en récupérez deux, les jokers, donc votre main s’allège d’une carte.',
      whyNot: 'Trois raisons possibles : vous tenez déjà un joker, il vous manque des cartes (il en faut trois à défausser), ou l’une des deux piles de jokers est vide.',
    },
    pass: {
      topic: 'passer',
      words: ['passer', 'passe', 'pass', 'sauter', 'rien faire', 'aucune action'],
      what: 'Passer, c’est défausser une carte sans rien faire : l’action est perdue, mais la carte part quand même. On peut passer une action ou les deux. Cela ne coûte pas d’argent, et ce qui n’est pas dépensé compte pour l’ordre de la manche suivante.',
      cost: 'Passer coûte une carte par action passée, et rien d’autre.',
    },
    canal: {
      topic: 'l’ère canal',
      words: ['canal', 'canaux', 'ere canal', 'peniche', 'peniches', 'ecluse', 'ecluses', 'bief', 'canal era', 'double canal'],
      what: 'L’ère canal est la première des deux. On n’y pose que des canaux (3 £, un par action), une seule de vos tuiles par lieu, et les tuiles de niveau 1 s’y bâtissent. La toute première manche n’offre qu’une action à chacun. À la fin, liaisons et tuiles retournées marquent, puis canaux et tuiles de niveau 1 quittent le plateau.',
      cost: 'Un canal coûte 3 £, sans charbon, et une seule liaison par action — il n’y a pas de double canal.',
      whyNot: 'À l’ère canal, une seule liaison par action et seulement sur les routes ouvertes au canal ; les routes réservées au rail restent fermées. Il faut 3 £ et une route libre qui touche votre réseau.',
    },
    rail: {
      topic: 'l’ère rail',
      words: ['rail', 'rails', 'chemin fer', 'chemins fer', 'ere rail', 'train', 'trains', 'locomotive', 'locomotives', 'voie ferree', 'railway', 'double rail', 'deux rails', 'ferroviaire'],
      what: 'L’ère rail est la seconde et la dernière. On y pose des rails : 5 £ et 1 charbon chacun, ou deux dans la même action pour 15 £, 2 charbons et 1 bière de brasserie. Les tuiles de niveau 1 (sauf la poterie I) ne s’y bâtissent plus, les brasseries y reçoivent 2 barils, et plusieurs de vos tuiles peuvent partager un lieu. Le décompte final suit sa dernière manche.',
      cost: 'Un rail : 5 £ et 1 charbon, relié à la liaison une fois posée. Deux rails dans la même action : 15 £, 1 charbon pour chacun, et 1 bière tirée d’une brasserie — jamais du baril d’un marchand.',
      whyNot: 'À l’ère canal, les rails n’existent pas encore : ils arrivent avec la seconde ère. À l’ère rail, un rail demande une route libre qui touche votre réseau, 5 £, et un charbon relié à la liaison posée — mine reliée, ou marché par un marchand.',
    },
    links: {
      topic: 'les liaisons',
      words: ['liaison', 'liaisons', 'lien', 'liens', 'connexion', 'connexions', 'relie', 'reliee', 'connecte', 'connectee', 'tuile liaison', 'route', 'routes', 'link', 'links', 'icone lien', 'liaison points', 'liaisons points'],
      what: 'Une liaison est un canal ou un rail posé sur une route entre deux lieux. Elle étend votre réseau et relie les lieux pour tout le monde : le charbon, la bière d’un rival et les ventes aux marchands passent par les liaisons de n’importe qui. En fin d’ère, chacune marque 1 point par icône lien des lieux qu’elle touche, 2 pour un marchand, puis quitte le plateau.',
      gain: 'À la fin de chaque ère, une liaison marque les icônes lien de chaque tuile posée dans les lieux qu’elle relie — de 0 à 2 par tuile, à qui qu’elle soit, retournée ou non — et 2 points pour un emplacement marchand. Puis elle est retirée.',
      cost: 'Un canal coûte 3 £. Un rail coûte 5 £ et 1 charbon ; deux rails dans la même action, 15 £, 2 charbons et 1 bière de brasserie.',
    },
    eras: {
      topic: 'les ères et les manches',
      words: ['ere', 'eres', 'epoque', 'epoques', 'manche', 'manches', 'round', 'rounds', 'periode', 'duree', 'longueur', 'combien manches', 'nombre manches', 'fin manche'],
      what: 'Une partie compte deux ères : l’ère canal, puis l’ère rail. Chacune dure 8 manches à 4 joueurs, 9 à 3 et 10 à 2 — elle s’achève quand la pioche et toutes les mains sont vides. À chaque manche, chacun joue son tour de deux actions (une seule à la toute première), puis vient le nouvel ordre du tour et la paie.',
    },
    firstRound: {
      topic: 'la première manche',
      words: ['premiere manche', 'premier tour', 'debut partie', 'debut', 'commencer', 'commence', 'premier coup', 'ouverture', 'une seule action', 'premiere action', 'depart', 'premiere tuile'],
      what: 'À la toute première manche de l’ère canal, chacun ne joue qu’une action au lieu de deux, et l’ordre de ce premier tour est tiré au hasard. Chacun part avec 17 £, un revenu au niveau 0 et huit cartes en main. Tant que vous n’avez aucune tuile sur le plateau, une carte industrie bâtit n’importe où, et votre première liaison peut se poser n’importe où.',
    },
    eraEnd: {
      topic: 'la fin d’ère',
      words: ['fin ere', 'fin eres', 'fin canal', 'fin ere canal', 'transition', 'entre eres', 'changement ere', 'balayage', 'passage rail', 'nouvelle ere', 'tuiles niveau 1', 'niveau 1 disparait', 'niveau 1 disparaissent', 'tuiles disparu', 'tuiles disparues', 'canaux disparu', 'liaisons disparu', 'canaux disparus', 'liaisons disparues'],
      what: 'Quand la pioche et les mains sont vides, l’ère se termine : chaque liaison marque, chaque tuile retournée marque ses points, puis toutes les liaisons quittent le plateau. Après l’ère canal, en plus, les tuiles de niveau 1 sont retirées du plateau, les barils des marchands sont remis, et toutes les défausses sont rebattues en une nouvelle pioche de huit cartes par joueur. Argent, revenu, points et tuiles de niveau 2 et plus restent.',
    },
    scoring: {
      topic: 'le décompte',
      words: ['decompte', 'decomptes', 'compter points', 'calcul points', 'calculer points', 'scoring', 'comptage', 'compte points', 'calcul score', 'points fin ere', 'marquer points'],
      what: 'Le décompte a lieu à la fin de chaque ère. D’abord les liaisons : chacune marque 1 point par icône lien des lieux qu’elle touche (les tuiles de tout le monde, 2 pour un marchand). Puis chaque tuile retournée marque le chiffre imprimé en bas ; une tuile jamais retournée ne marque rien. Les tuiles de niveau 2 et plus restent pour l’ère rail et y marquent une seconde fois si elles sont toujours là.',
    },
    gameEnd: {
      topic: 'la fin de partie',
      words: ['fin partie', 'fin jeu', 'gagner', 'gagne', 'vainqueur', 'gagnant', 'victoire', 'terminer partie', 'finir partie', 'partie finit', 'partie termine', 'jeu termine', 'partie se termine', 'derniere manche', 'fin', 'dernier tour'],
      what: 'La partie s’arrête après le décompte de l’ère rail, et celui qui a le plus de points de victoire l’emporte. La dernière manche de la partie ne donne pas de paie. En cas d’égalité, le plus haut niveau de revenu départage, puis l’argent en caisse.',
      how: 'On gagne en ayant le plus de points à la fin de l’ère rail. Les points viennent des tuiles retournées et des liaisons, comptées au décompte de chaque ère, et de quelques bonus de marchands ; une faillite en retire.',
    },
    ties: {
      topic: 'les égalités',
      words: ['egalite', 'egalites', 'ex aequo', 'exaequo', 'departager', 'departage', 'tie', 'egal', 'egaux'],
      what: 'À égalité de points en fin de partie, le plus haut niveau de revenu l’emporte, puis l’argent en caisse. Pour l’ordre du tour, une égalité d’argent dépensé garde l’ordre relatif de la manche précédente.',
    },
    initiation: {
      topic: 'la partie d’initiation',
      words: ['initiation', 'partie courte', 'courte', 'canal seulement', 'partie rapide', 'decouverte', 'short', 'premiere partie'],
      what: 'La partie d’initiation ne joue que l’ère canal : 10 manches à deux joueurs, 9 à trois, 8 à quatre, et pas de paie après la dernière. À sa fin, rien ne quitte le plateau : chaque liaison marque 1 point par icône lien des lieux qu’elle touche (2 pour un marchand), chaque tuile retournée marque ses points ; une tuile jamais retournée ne marque rien. La clôture ajoute ensuite 1 point par tranche de 4 £ (15 au plus), des points égaux au niveau de revenu (négatif, il en retire), et les tuiles retournées de niveau 2 et plus marquent une seconde fois.',
      how: 'On gagne avec le plus de points après la clôture. Ils viennent des liaisons et des tuiles retournées, comptées à la fin de l’ère canal, de quelques bonus de marchands, puis de la clôture : l’argent (1 point par tranche de 4 £, 15 au plus), le niveau de revenu, et une seconde fois les tuiles retournées de niveau 2 et plus. À égalité, le plus haut niveau de revenu départage, puis l’argent en caisse.',
    },
    merchants: {
      topic: 'les marchands et leurs bonus',
      words: ['marchand', 'marchands', 'bonus marchand', 'negociant', 'negociants', 'comptoir', 'merchant', 'shrewsbury', 'warrington', 'nottingham', 'gloucester', 'oxford', 'tuile marchand', 'tuiles marchands', 'bonus', 'client', 'clients', 'acheteur', 'acheteurs', 'tous biens', 'marchand vierge'],
      what: 'Les marchands, au bord de la carte, achètent vos ouvrages : chaque tuile marchande montre ce qu’elle prend (coton, manufacture, poterie, « tous biens », ou rien si elle est vierge). Pour vendre, votre tuile doit être reliée à l’un d’eux. Chaque tuile non vierge a un baril de bière, et le boire en vendant donne le bonus du lieu. Un emplacement marchand compte aussi 2 icônes lien, et ouvre le marché du charbon à qui y est relié.',
      gain: 'Sur la carte des Midlands : Shrewsbury donne 4 PV, Warrington 5 £, Nottingham 3 PV, Gloucester un développement gratuit (sans fer) et Oxford 2 espaces de revenu. Le bonus vient avec le baril bu pendant une vente, un par tuile marchande et par ère ; les barils reviennent au début de l’ère rail.',
    },
    income: {
      topic: 'le revenu et sa piste',
      words: ['revenu', 'revenus', 'piste revenu', 'niveau revenu', 'paie', 'salaire', 'income', 'progression', 'piste progression', 'rente', 'augmenter revenu', 'espaces', 'espace'],
      what: 'Le revenu, c’est l’argent que vous touchez à chaque fin de manche. La piste compte 100 espaces, et chaque espace montre un niveau de −10 à 30 : vous partez au niveau 0. Retourner une tuile avance votre marqueur du nombre d’espaces imprimé — les espaces se resserrent en montant — et un emprunt le fait reculer de 3 niveaux. Un revenu négatif se paie à la banque.',
      how: 'Le revenu ne monte que par les tuiles retournées — un ouvrage vendu, une mine, une forge ou une brasserie vidée — et par le bonus d’Oxford (2 espaces). Il ne baisse que par l’emprunt (3 niveaux). La paie tombe à chaque fin de manche, sauf la toute dernière de la partie.',
      gain: 'À chaque fin de manche, vous touchez autant de livres que votre niveau de revenu — ou vous les payez s’il est négatif. La dernière manche de la partie n’a pas de paie.',
      whyNot: 'Le chiffre d’une tuile retournée compte des espaces sur la piste, pas des livres : votre marqueur avance d’autant d’espaces, et la paie ne monte que lorsqu’il franchit la limite d’un niveau. Jusqu’à l’espace 10, chaque espace est un niveau ; au-delà, un niveau s’étend sur 2 espaces, puis 3 à partir de l’espace 31, puis 4 à partir du 61. Une tuile à +2 peut donc laisser la paie où elle était, si le marqueur reste dans le même niveau. Survolez la piste de revenu : chaque cran montre ses cases, et chaque pion combien il lui en manque pour le suivant.',
    },
    shortfall: {
      topic: 'la faillite',
      words: ['faillite', 'ruine', 'ruiner', 'banqueroute', 'assez argent', 'fauche', 'revenu negatif', 'manque argent', 'insolvable', 'bankrupt', 'argent negatif', 'payer banque', 'elimine'],
      what: 'Personne n’est éliminé. Si la paie est négative et que votre caisse ne suffit pas, vous retirez du plateau des tuiles industrie à vous (jamais de liaisons), chacune rapportant la moitié de son coût, arrondie à l’inférieur ; la table ôte les moins chères d’abord. S’il manque encore de l’argent, vous perdez 1 point de victoire par livre manquante. On ne brade jamais une tuile pour une autre raison.',
    },
    money: {
      topic: 'l’argent',
      words: ['argent', 'livre', 'livres', 'caisse', 'fric', 'thune', 'monnaie', 'pieces', 'cash', 'sterling', 'fortune', 'argent depart', 'tresorerie', 'gagner argent', 'avoir argent'],
      what: 'Chacun part avec 17 £. L’argent rentre par la paie de fin de manche, par les emprunts (30 £), par les cubes que vos mines et forges vendent au marché, et par le bonus de Warrington. Il se dépense en tuiles, liaisons et achats au marché, et ce que vous dépensez dans une manche fixe votre place dans l’ordre suivant. Il passe d’une ère à l’autre et ne départage qu’en dernier recours.',
    },
    turnOrder: {
      topic: 'l’ordre du tour',
      words: ['ordre tour', 'ordre', 'premier joueur', 'joue premier', 'dernier joueur', 'argent depense', 'depense', 'depenses', 'depenser', 'tuile personnage', 'personnage', 'joue dernier'],
      what: 'À la fin de chaque manche, l’ordre se refait sur l’argent dépensé pendant cette manche : qui a le moins dépensé joue en premier, qui a le plus dépensé joue en dernier. À égalité, l’ordre relatif de la manche précédente est gardé. Tout compte — tuiles, liaisons, achats au marché — mais pas l’argent reçu.',
    },
    actions: {
      topic: 'les actions du tour',
      words: ['action', 'actions', 'deux actions', 'nombre actions', 'action par tour', 'mon tour', 'jouer tour', 'joue', 'tour', 'jouer deux fois', 'meme action'],
      what: 'À votre tour, vous jouez deux actions — une seule à la toute première manche de l’ère canal. Il y en a six, plus passer : Construire, Réseau, Développer, Vendre, Emprunter et Prospecter. Chacune coûte une carte défaussée, et la même peut être jouée deux fois.',
    },
    flip: {
      topic: 'les tuiles retournées',
      words: ['retourner', 'retourne', 'retournee', 'retournees', 'retourne tuile', 'flip', 'flipper', 'flippe', 'flippee', 'verso', 'tuile retournee', 'revers', 'tuile non retournee'],
      what: 'Une tuile se retourne quand elle a fait son travail : une mine ou une forge quand son dernier cube part, une brasserie quand son dernier baril est bu — par n’importe qui — et un ouvrage quand vous le vendez. Retournée, elle avance aussitôt votre revenu du nombre d’espaces imprimé, et ses points compteront à chaque décompte d’ère où elle est encore là. Une tuile jamais retournée ne marque rien.',
      how: 'Mines, forges et brasseries se retournent quand leurs cubes ou leurs barils sont tous partis, qui que ce soit qui les ait pris. Filatures, manufactures et poteries ne se retournent que par l’action Vendre.',
      gain: 'Retournée, une tuile avance aussitôt votre revenu du nombre d’espaces imprimé, et ses points de victoire comptent au décompte de l’ère. Non retournée, elle ne marque rien.',
    },
    levels: {
      topic: 'les niveaux des tuiles',
      words: ['niveau', 'niveaux', 'level', 'levels', 'niveau 1', 'niveau superieur', 'tuile plus basse', 'chiffre romain', 'icone canal', 'icone rail', 'colonne'],
      what: 'Chaque industrie s’empile sur votre tapis du niveau le plus bas au plus haut, et l’on prend toujours la tuile la plus basse qui reste, pour bâtir comme pour développer. Plus haut, une tuile coûte le plus souvent davantage, et marque davantage. Une icône canal marque les tuiles qu’on ne bâtit pas à l’ère rail (les niveaux 1, sauf la poterie I) ; une icône rail, celles qu’on ne bâtit qu’à l’ère rail (brasserie IV, poterie V).',
    },
    overbuild: {
      topic: 'surconstruire',
      words: ['surconstruire', 'surconstruction', 'surconstruit', 'overbuild', 'remplacer tuile', 'construire par dessus', 'ecraser tuile', 'reconstruire', 'par dessus'],
      what: 'Surconstruire, c’est bâtir une tuile de même industrie et de niveau supérieur sur une tuile déjà posée. Sur vos propres tuiles, c’est libre. Sur celle d’un rival, seulement une mine ou une forge, et seulement quand il ne reste plus un seul cube de cette ressource sur le plateau ni au marché. La tuile remplacée sort du jeu, mais le revenu et les points qu’elle a déjà donnés restent acquis.',
      whyNot: 'Il faut la même industrie et un niveau strictement supérieur. Sur une tuile adverse, seules la mine et la forge se remplacent, et seulement quand ce charbon ou ce fer a disparu partout, marché compris. À l’ère canal, vous ne pouvez toujours avoir qu’une tuile par lieu.',
    },
    mat: {
      topic: 'le tapis du joueur',
      words: ['tapis', 'plateau joueur', 'plateau individuel', 'pile', 'piles', 'stock tuiles', 'mat', 'player mat', 'tuiles restantes', 'tuiles tapis'],
      what: 'Le tapis porte vos 45 tuiles industrie, empilées par industrie du niveau le plus bas au plus haut : 11 filatures, 11 manufactures, 7 brasseries, 7 mines, 5 poteries et 4 forges. Il montre pour chaque prochaine tuile son coût, ce qu’elle rapporte et ses restrictions d’ère. La touche P l’ouvre ; 1 à 4 passent d’un joueur à l’autre.',
    },
    towns: {
      topic: 'les villes et les emplacements',
      words: ['ville', 'villes', 'emplacement', 'emplacements', 'case', 'cases', 'lieu', 'lieux', 'icone emplacement', 'town', 'slot', 'slots', 'cite', 'une tuile par lieu', 'deux tuiles meme ville'],
      what: 'La carte des Midlands compte 20 villes, deux brasseries fermières et cinq emplacements marchands. Chaque ville a deux à quatre emplacements, et chacun montre les industries qu’il accepte, une ou deux icônes. À l’ère canal, vous ne pouvez avoir qu’une tuile par lieu ; à l’ère rail, plusieurs.',
    },
    vp: {
      topic: 'les points de victoire',
      words: ['points', 'point', 'pv', 'vp', 'points victoire', 'point victoire', 'score', 'scores', 'piste pv', 'piste points', 'victory points'],
      what: 'Les points de victoire décident de la partie. Ils se marquent au décompte de chaque ère : les liaisons (1 point par icône lien des lieux touchés, 2 pour un marchand) et les tuiles retournées (le chiffre imprimé). S’y ajoutent les bonus de Shrewsbury et de Nottingham ; une faillite, elle, en retire. La piste fait le tour à 100.',
      gain: 'Les points viennent des tuiles retournées (le chiffre en bas de la tuile, à chaque décompte où elle est là), des liaisons (les icônes lien des lieux qu’elles touchent, 2 par marchand) et des bonus de Shrewsbury (4) et de Nottingham (3).',
    },
    cards: {
      topic: 'les cartes',
      words: ['carte', 'cartes', 'carte lieu', 'cartes lieu', 'carte ville', 'carte industrie', 'cartes industrie', 'carte double', 'paquet', 'deck', 'card', 'cards', 'quelle carte'],
      whyNot: 'Une carte lieu ne bâtit que dans la ville qu’elle nomme ; une carte industrie ne bâtit que son industrie, et seulement dans une ville de votre réseau ; aucune carte lieu ni joker lieu ne bâtit sur une brasserie fermière. Pour Réseau, Développer, Vendre, Emprunter ou passer, n’importe quelle carte convient : si l’action est refusée, la raison est ailleurs.',
      what: 'Chaque action se paie d’une carte défaussée. Une carte lieu bâtit n’importe quelle industrie dans la ville qu’elle nomme, même hors de votre réseau ; une carte industrie bâtit cette industrie dans une ville de votre réseau, et partout tant que vous n’avez rien sur le plateau. Filatures et manufactures partagent des cartes doubles. Pour les autres actions, n’importe quelle carte fait l’affaire.',
    },
    wild: {
      topic: 'les jokers',
      words: ['joker', 'jokers', 'carte joker', 'joker lieu', 'joker industrie', 'wild', 'wildcard', 'carte blanche', 'pile joker'],
      what: 'Un joker lieu vaut n’importe quelle carte lieu, sauf pour les deux brasseries fermières ; un joker industrie vaut n’importe quelle carte industrie. On ne les obtient que par la prospection, les deux d’un coup, et jamais si l’on en tient déjà un. Défaussés, ils retournent à leur pile au lieu de la défausse.',
    },
    hand: {
      topic: 'la main et la pioche',
      words: ['main', 'ma main', 'mains', 'pioche', 'piocher', 'defausse', 'defausser', 'recompleter', 'tirer carte', 'huit cartes', 'draw', 'pioche vide', 'cartes main', 'carte main'],
      what: 'Vous tenez huit cartes. Chaque action en défausse une, et à la fin de votre tour vous recomplétez jusqu’à huit depuis la pioche. Quand la pioche est vide, la main fond de manche en manche, et l’ère se termine quand toutes les mains sont vides. La pioche compte 40 cartes à 2 joueurs, 54 à 3 et 64 à 4, jokers à part.',
    },
    players: {
      topic: 'le nombre de joueurs',
      words: ['joueurs', 'nombre joueurs', 'deux joueurs', 'trois joueurs', 'quatre joueurs', '2 joueurs', '3 joueurs', '4 joueurs', 'solo', 'adversaires', 'combien joueurs', 'joueur'],
      what: 'On joue de 2 à 4. Le nombre change la pioche (40, 54 ou 64 cartes : à moins de 4, des villes perdent leurs cartes), les marchands ouverts (Warrington dès 3 joueurs, Nottingham à 4) et la durée des ères : 10 manches à 2, 9 à 3, 8 à 4. Les villes sans carte restent bâtissables par carte industrie ou par joker.',
    },
    undo: {
      topic: 'annuler un coup',
      words: ['annuler', 'annule', 'annulation', 'undo', 'revenir arriere', 'retour arriere', 'defaire', 'ctrl z', 'erreur', 'trompe', 'reprendre coup'],
      what: 'La touche Z, ou le bouton Reprendre, reprend votre dernier coup tant que le tour est encore le vôtre : une fois la main passée à un autre joueur, le coup reste. Avant de confirmer, Échap abandonne simplement le coup en préparation.',
      whyNot: 'Annuler n’est permis que pour votre dernier coup, et tant que c’est encore votre tour. Dès qu’un autre joueur, machine ou humain, a joué, le coup est acquis.',
    },
    confirm: {
      topic: 'confirmer un coup',
      words: ['confirmer', 'confirmation', 'valider', 'validation', 'entree', 'bouton confirmer', 'jouer coup', 'jouer carte', 'selectionner carte'],
      what: 'Un coup se prépare en trois gestes : une carte de la main, une action, puis une cible sur la carte. La note en haut de l’écran détaille alors ce qu’il coûtera et d’où viennent le charbon, le fer et la bière. Rien n’est joué avant Confirmer (ou Entrée) ; Échap abandonne.',
    },
    prepare: {
      topic: 'préparer un coup à l’avance',
      words: ['preparer', 'preparation', 'prepare', 'coup avance', 'coup a l avance', 'file attente', 'sauf si', 'precommander', 'queue', 'coup prepare'],
      what: 'Pendant le tour des autres, vous pouvez préparer votre coup : carte, action, cible, puis « Préparer ». Il part tout seul à votre tour s’il tient encore ; sinon il est écarté et la table vous dit pourquoi. Une clause « sauf si » peut l’abandonner d’avance, par exemple si un rival bâtit à l’endroit visé.',
    },
    ledger: {
      topic: 'le registre',
      words: ['registre', 'journal', 'historique', 'ledger', 'log', 'coups joues', 'derniers coups', 'dernier coup', 'livre comptes'],
      what: 'Le registre (touche L) garde chaque coup de la partie, manche par manche et joueur par joueur, avec ce qu’il a coûté. Des filtres isolent vos coups, l’économie ou le réseau, et chaque ligne se revoit sur le plateau. La touche D montre le dernier coup d’un joueur.',
    },
    notebook: {
      topic: 'le carnet',
      words: ['carnet', 'notes', 'note perso', 'bloc notes', 'notebook', 'prendre notes', 'ecrire', 'memo', 'pense bete', 'noter', 'plume'],
      what: 'Le carnet est une page à vous pour toute la partie : plans, choses à retenir, ce qu’un rival semble viser. Il est gardé au bureau avec la table, vous suit sur un autre appareil, et personne d’autre ne le lit. Il s’ouvre par le bouton à la plume, parmi les outils.',
    },
    marketPanel: {
      topic: 'la bourse à l’écran',
      words: ['panneau marche', 'afficher marche', 'ouvrir marche', 'ouvrir bourse', 'afficher bourse', 'panneau bourse', 'tableau prix'],
      what: 'La bourse (touche M) montre les deux marchés : les cubes de charbon et de fer qui restent, et le prix du prochain. Quand le coup en préparation achète au marché, elle affiche le prix après l’achat. Elle se replie quand vous n’en avez pas besoin.',
    },
    minimap: {
      topic: 'la minicarte',
      words: ['minicarte', 'mini carte', 'carte miniature', 'petite carte', 'minimap', 'vue ensemble', 'naviguer', 'deplacer vue', 'zoom', 'zoomer', 'dezoomer'],
      what: 'La minicarte, en bas à droite, montre tout le plateau et le cadre de ce que vous regardez. Cliquez ou glissez dedans pour déplacer la vue ; le bouton du coin, ou les réglages, la passe en petite, moyenne ou grande. Les villes vides y sont des points gris ; une ville bâtie porte la forme de son propriétaire. La molette zoome, et 0 recadre tout le plateau.',
    },
    keys: {
      topic: 'les raccourcis clavier',
      words: ['raccourci', 'raccourcis', 'clavier', 'touche', 'touches', 'shortcut', 'shortcuts', 'keyboard', 'hotkey', 'hotkeys'],
      what: 'Les principales : 1 à 8 choisissent une carte, Entrée confirme, Échap annule, Z reprend votre dernier coup, M ouvre la bourse, L le registre, P le tapis, S les réglages, H épingle la main, F le plein écran, 0 recadre le plateau, D montre le dernier coup d’un joueur et ? les règles. Tout se change dans les réglages, section Raccourcis.',
    },
    settings: {
      topic: 'les réglages',
      words: ['reglage', 'reglages', 'parametre', 'parametres', 'options', 'option', 'settings', 'langue', 'affichage', 'daltonien', 'plein ecran', 'sons', 'volume', 'couleur', 'couleurs', 'theme'],
      what: 'Les réglages (touche S) règlent l’affichage de la table sur cet appareil : langue, fond de carte, dessin des tuiles, mode daltonien, minicarte, pistes, sons, plein écran et raccourcis. Tout s’applique aussitôt et ne change rien aux règles.',
    },
    aid: {
      topic: 'l’aide au placement',
      words: ['aide', 'aides', 'aide placement', 'aide debutant', 'mode debutant', 'debutant', 'debutants', 'assistance', 'beginner', 'novice'],
      what: 'L’aide au placement est un réglage pour débutants : carte en main, les emplacements injouables s’estompent, et le prix détaille le charbon et le fer achetés en bourse. Elle se coche dans les réglages ; à une table en ligne, c’est l’hôte qui la règle pour tout le monde. Elle ne dit jamais quoi jouer.',
    },
    machines: {
      topic: 'les machines et leurs personnages',
      words: ['machine', 'machines', 'bot', 'bots', 'ordinateur', 'ia', 'robot', 'robots', 'automate', 'watt', 'boulton', 'wedgwood', 'arkwright', 'personnages', 'difficulte', 'niveau machine', 'adversaire ordinateur'],
      what: 'Quatre personnages tiennent les sièges des machines : Mr Boulton, qui dépense large et vend plus large encore ; Mrs Wedgwood, patiente avec ses poteries ; Miss Arkwright, qui vend vite et double ses rails ; et Mr Watt, l’expert, qui joue toujours à fond. Les trois premiers jouent à votre niveau, plus affûtés quand vous gagnez, plus doux quand vous perdez. Tous suivent les mêmes règles que vous.',
    },
    overview: {
      topic: 'le jeu en bref',
      words: ['brass', 'blackrail', 'birmingham brass', 'jeu', 'but', 'but jeu', 'objectif', 'principe', 'regles jeu', 'jouer', 'apprendre', 'resume', 'comprendre', 'comprend', 'comprends', 'perdu', 'debuter'],
      what: 'Blackrail joue Brass: Birmingham, en deux ères : le canal, puis le rail. Vous y bâtissez des industries — mines, forges, brasseries, filatures, manufactures, poteries —, vous les reliez par des canaux puis des rails, et vous vendez vos ouvrages aux marchands. Les points viennent des tuiles retournées et des liaisons, comptés à la fin de chaque ère, et le plus riche en points l’emporte.',
      how: 'À votre tour, deux actions (une seule à la toute première manche) : Construire, Réseau, Développer, Vendre, Emprunter, Prospecter, ou passer. Chacune coûte une carte : choisissez-la dans la main, puis l’action, puis la cible sur la carte, et confirmez. Le codex (touche ?) reprend chaque règle, et vous pouvez me demander n’importe laquelle ici.',
    },
    rules: {
      topic: 'le codex des règles',
      words: ['regles', 'livret', 'codex', 'rulebook', 'regles completes', 'manuel', 'notice', 'regles jeu'],
      what: 'Le codex des règles s’ouvre par la touche ? : il reprend les règles complètes, section par section. Vous pouvez aussi me poser la question ici, avec vos mots.',
    },
  },
};
