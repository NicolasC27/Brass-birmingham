import type { Dict } from '../en';

/* ------------------------------------------------------------------ */
/* La une avant l'ouverture de la ligne : le jeu en quelques lignes,   */
/* la liste d'attente, et les lettres que l'office lui écrit.          */
/* ------------------------------------------------------------------ */
const landing: Dict['landing'] = {
  ear: 'Avant-première',
  eyebrow: 'Bientôt en gare',
  headline: 'Bâtissez les Midlands, canal après canal, rail après rail.',
  lede: 'Un jeu de stratégie économique pour deux à quatre joueurs, dans le Black Country de 1770 à 1865. D’abord les canaux, puis le chemin de fer : élevez filatures et houillères, vendez aux marchands, et tenez tête aux machines — ou à vos amis.',
  trial: {
    title: 'Le voyage d’essai',
    text: 'Avant l’ouverture de la ligne, quelques voyageurs essaieront le jeu en premier. Laissez votre adresse : nous vous écrirons quand votre place sera prête.',
  },
  form: {
    label: 'Votre adresse e-mail',
    placeholder: 'vous@exemple.fr',
    submit: 'Réserver ma place',
    sending: 'Envoi…',
    note: 'Une lettre pour confirmer, puis une quand l’essai ouvre. Rien d’autre, et une façon de partir dans chaque lettre.',
    privacy: 'Ce que nous faisons de votre adresse',
  },
  sent: {
    title: 'Une lettre est en route',
    text: 'Ouvrez-la et suivez le lien pour confirmer votre place. Rien reçu ? Regardez dans les indésirables.',
    again: 'Donner une autre adresse',
  },
  errors: {
    email: 'Cette adresse ne ressemble pas à une adresse e-mail.',
    busy: 'Trop d’essais depuis cette adresse. Réessayez dans quelques minutes.',
    down: 'L’office ne répond pas pour l’instant. Réessayez dans un moment.',
  },
  eras: {
    canal: 'L’ère des canaux',
    rail: 'L’ère du rail',
  },
  points: [
    { h: 'Deux ères', p: 'Les canaux, puis le chemin de fer : ce qui a été bâti d’abord s’efface, et le réseau décide de tout.' },
    { h: 'Quatre machines', p: 'Boulton, Wedgwood, Arkwright et Watt ont chacun leur jeu. Watt joue toujours pour gagner.' },
    { h: 'Des tables en ligne', p: 'Jouez à plusieurs, en partie rapide ou classée, et relisez chaque partie coup par coup.' },
  ],
  confirm: {
    eyebrow: 'Liste d’attente',
    working: 'Un instant…',
    title: 'Votre place est réservée',
    text: 'Merci. Nous vous écrirons à cette adresse dès que le voyage d’essai ouvre.',
    bad: 'Ce lien ne fonctionne plus : il a peut-être déjà servi, ou l’adresse a été effacée après une semaine sans réponse.',
  },
  leave: {
    title: 'Quitter la liste d’attente',
    text: 'Votre adresse sera effacée et nous ne vous écrirons plus.',
    button: 'Me retirer de la liste',
    done: 'C’est fait : votre adresse est effacée.',
    bad: 'Ce lien ne fonctionne plus : l’adresse a sans doute déjà été effacée.',
  },
  back: 'Retour à l’avant-première',
  letter: {
    confirmSubject: 'Blackrail — confirmez votre place',
    confirmText: 'Bonjour,\n\nCette adresse a été laissée sur la liste d’attente de Blackrail. Suivez ce lien pour confirmer votre place :\n\n{link}\n\nSi ce n’était pas vous, ignorez cette lettre : l’adresse sera effacée dans une semaine.\n\n— Le bureau du télégraphe de Blackrail',
    footer: 'Vous recevez cette lettre parce que vous vous êtes inscrit sur la liste d’attente de Blackrail.\nPour ne plus en recevoir : {link}',
  },
};

export default landing;
