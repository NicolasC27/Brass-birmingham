import type { Dict } from '../en';

/* ------------------------------------------------------------------ */
/* La une avant l'ouverture de la ligne : ce qu'on fait à une table,   */
/* montré sur le plateau même, la liste d'attente deux fois, et les    */
/* lettres que l'office lui écrit.                                     */
/* ------------------------------------------------------------------ */
const landing: Dict['landing'] = {
  pageTitle: 'Blackrail | Alternative en ligne à Brass: Birmingham',
  motto: 'Canaux, charbon & fer — journal des Midlands',
  hero: {
    eyebrow: 'Bêta fermée · inscriptions ouvertes',
    title: 'Bâtissez les Midlands au temps des canaux. Rebâtissez-les pour le rail.',
    subhead: 'Stratégie économique exigeante, de 2 à 4 joueurs, dans le navigateur. Construisez, reliez, vendez — contre vos amis, ou contre Mr Watt, qui ne fait jamais de cadeau.',
    kicker: 'Une alternative en ligne à Brass: Birmingham, indépendante et non officielle.',
    watt: 'Mr Watt joue toujours à pleine force. Prendrez-vous place à sa table ?',
    plate: 'Planche I — l’ère des canaux',
    alt: 'Plateau de Blackrail à l’ère des canaux : villes des Midlands, usines miniatures et canaux sur une campagne peinte',
  },
  form: {
    label: 'Votre adresse e-mail',
    placeholder: 'vous@exemple.fr',
    submit: 'Prendre mon billet pour l’essai',
    sending: 'Envoi…',
    note: 'Deux lettres, rien d’autre : la confirmation, puis l’ouverture. Ordinateur et tablette.',
    privacy: 'Ce que nous faisons de votre adresse',
  },
  table: {
    plate: 'Planche II — une table',
    title: 'Chaque tour : deux cartes, deux actions.',
    text: 'Construire, relier, développer, vendre, emprunter, prospecter. Vos cartes désignent le lieu ; tout le reste, c’est vous qui le décidez.',
    alt: 'Une partie en cours : la main de huit cartes, les six actions, les joueurs et la carte d’ensemble',
    marks: [
      { h: 'Votre main', p: 'Des villes et des industries à jouer, six actions pour les servir.' },
      { h: 'Vos rivaux', p: 'L’argent, les points et le revenu de chacun, toujours sous vos yeux.' },
      { h: 'La carte d’ensemble', p: 'Tout le réseau d’un coup d’œil : rien de ce qui se trame ne vous échappe.' },
    ],
  },
  twist: {
    plate: 'Planche III — le tournant',
    title: 'Fin de l’ère des canaux : le premier réseau part à la casse.',
    text: 'Canaux et industries de premier niveau sont balayés. Le rail repart sur un terrain déblayé : ce que vous aviez préparé survit, le reste part en fumée.',
    slider: 'Glissez pour passer des canaux au rail',
    canalCaption: 'L’ère des canaux',
    railLabel: 'L’ère du rail',
    canalAlt: 'Le plateau à l’ère des canaux : un réseau de canaux colorés relie les villes',
    ceremonyAlt: 'Le décompte de fin d’ère : « Et l’eau cède ainsi la place à la vapeur… », les points de chaque joueur',
    ceremonyCaption: 'Le décompte de l’ère des canaux',
    railAlt: 'Le plateau à l’ère du rail : des lignes de chemin de fer relient les villes',
    railCaption: 'L’ère du rail : le terrain déblayé, la course reprend',
  },
  economy: {
    plate: 'Planche IV — les affaires',
    title: 'Une vraie économie, pas un décor.',
    points: [
      { h: 'Des villes réelles', p: 'Stoke, Dudley, Coventry, Birmingham : installez houillères, forges, filatures, manufactures, poteries et brasseries.' },
      { h: 'Des marchés qui bougent', p: 'Le charbon et le fer se vendent sur des marchés communs : chaque achat fait monter les prix pour vos rivaux.' },
      { h: 'Des marchands à conquérir', p: 'Coton, marchandises et poteries partent vers Warrington, Oxford, Gloucester, Nottingham ou Shrewsbury.' },
      { h: 'Des tuiles qui se retournent', p: 'Une industrie qui a servi se retourne : elle paie un revenu et des points de victoire.' },
    ],
    stokeAlt: 'Gros plan : la poterie de Stoke-on-Trent et le marchand de Warrington',
  },
  machines: {
    plate: 'Planche V — les machines',
    title: 'Quatre rivaux mécaniques. L’un d’eux ne vous laissera rien.',
    text: 'Mr Boulton, Mrs Wedgwood, Miss Arkwright et Mr Watt ont chacun leur caractère. Derrière eux, une véritable intelligence de recherche calcule chaque coup — et Mr Watt joue toujours à pleine force.',
    portrait: 'Portrait peint de {name}',
    cta: 'Affronter Mr Watt à l’essai',
    watt: 'toujours à pleine force',
  },
  line: {
    title: 'La partie finie, la ligne continue.',
    points: [
      { h: 'Rapide ou classée', p: 'Un classement par saison, des compagnies à rejoindre, des amis à inviter.' },
      { h: 'Le défi de la semaine', p: 'La même donne pour tous, des conditions sévères, et Mr Watt toujours à table.' },
      { h: 'Le juge', p: 'Rejouez chaque partie coup par coup ; le juge vous montre où elle a basculé.' },
      { h: 'Le courrier des machines', p: 'Après la partie, vos adversaires mécaniques vous écrivent.' },
    ],
  },
  levels: {
    title: 'Jamais joué à un jeu de cette trempe ?',
    text: 'Le cours du soir vous apprend les règles, le glossaire vous suit partout, et votre première partie est guidée. Les joueurs aguerris gardent tout le brouillard de la table : aucune aide qui triche.',
  },
  faq: {
    title: 'Questions au guichet',
    items: [
      { q: 'Sur quoi joue-t-on ?', a: 'Dans le navigateur, sur ordinateur et sur tablette. Pas sur téléphone.' },
      { q: 'Faut-il des amis pour jouer ?', a: 'Non. Jouez contre les quatre machines, ou en ligne en partie rapide ou classée.' },
      { q: 'Est-ce pour les débutants ?', a: 'Oui, avec le cours du soir et une première partie guidée. Mais c’est un jeu de stratégie exigeant, et c’est voulu.' },
      { q: 'Combien de lettres vais-je recevoir ?', a: 'Deux : une pour confirmer votre adresse, une quand l’essai ouvre.' },
      { q: 'Quand, et à quel prix ?', a: 'Ni la date ni le prix ne sont encore fixés. Les inscrits l’apprendront les premiers.' },
    ],
  },
  bar: 'Prendre mon billet',
  final: {
    title: 'Le premier convoi part bientôt. Gardez votre place.',
  },
  discord: {
    join: 'Rejoindre le Discord',
    wait: 'En attendant, venez parler canaux et rails avec les autres voyageurs.',
    seat: 'Le quai est sur Discord : les nouvelles de l’essai, les premiers joueurs, et l’équipe au travail.',
  },
  sent: {
    title: 'Une lettre est en route',
    text: 'Ouvrez-la et suivez le lien pour confirmer votre place. Rien reçu ? Regardez dans les indésirables.',
    again: 'Donner une autre adresse',
  },
  errors: {
    email: 'Cette adresse ne ressemble pas à une adresse e-mail.',
    busy: 'Trop d’essais depuis cette adresse. Réessayez dans quelques minutes.',
    down: 'L’office ne répond pas pour l’instant. Réessayez dans un moment.',
  },
  confirm: {
    eyebrow: 'Liste d’attente',
    working: 'Un instant…',
    badTitle: 'Ce lien ne fonctionne plus',
    title: 'Votre place est réservée',
    text: 'Merci. Nous vous écrirons à cette adresse dès que le voyage d’essai ouvre.',
    bad: 'Ce lien ne fonctionne plus : il a peut-être déjà servi, ou l’adresse a été effacée après une semaine sans réponse.',
  },
  leave: {
    title: 'Quitter la liste d’attente',
    text: 'Votre adresse sera effacée et nous ne vous écrirons plus.',
    button: 'Me retirer de la liste',
    done: 'C’est fait : votre adresse est effacée.',
    bad: 'Ce lien ne fonctionne plus : l’adresse a sans doute déjà été effacée.',
  },
  back: 'Retour à l’avant-première',
  letter: {
    confirmSubject: 'Blackrail — confirmez votre place',
    confirmText: 'Bonjour,\n\nCette adresse a été laissée sur la liste d’attente de Blackrail. Suivez ce lien pour confirmer votre place :\n\n{link}\n\nSi ce n’était pas vous, ignorez cette lettre : l’adresse sera effacée dans une semaine.\n\n— Le bureau du télégraphe de Blackrail',
    footer: 'Vous recevez cette lettre parce que vous vous êtes inscrit sur la liste d’attente de Blackrail.\nPour ne plus en recevoir : {link}',
  },
};

export default landing;
