import type enRivals from '../en/rivals';

/* ------------------------------------------------------------------ */
/* Les rivalités : ce qu’un personnage dit à un joueur déjà rencontré  */
/* — un mot au début d’une partie à la maison, un post-scriptum à ses  */
/* lettres, et le bilan sous son portrait.                             */
/* ------------------------------------------------------------------ */

const rivals: typeof enRivals = {
  title: 'Un mot de {name}',
  record: 'Contre vous : {games} [games|partie|parties], {won} [won|victoire|victoires] pour vous.',
  yours: { coal: 'vos mines de charbon', iron: 'vos forges', cotton: 'vos filatures', manufacturer: 'vos manufactures', pottery: 'vos poteries', brewery: 'vos brasseries' },
  mine: { coal: 'mes mines de charbon', iron: 'mes forges', cotton: 'mes filatures', manufacturer: 'mes manufactures', pottery: 'mes poteries', brewery: 'mes brasseries' },
  boulton: {
    first: '{name}, enchanté. Matthew Boulton, de Soho. Je vends ce que le monde veut avoir ; asseyez-vous, nous verrons si c’est vous.',
    absence: '{name} ! On vous croyait parti pour Londres. Le thé a refroidi, mais la table vous gardait votre chaise.',
    streakYours: '{n} [n|partie|parties] de suite pour vous, {name}. À Soho, on commence à prononcer votre nom avec respect, et ce n’est pas un compliment.',
    streakMine: '{n} de suite pour moi, {name}. Je vous offrirais bien une part de l’affaire, mais vous n’avez rien à y apporter.',
    comeback: 'La dernière fois, je menais au canal et vous m’avez pris tout le chemin de fer. Je surveille vos rails, {name}, et j’ai des amis sur la ligne.',
    close: '{margin} [margin|point|points] d’écart la dernière fois, {name}. Dans le commerce, on appelle cela une marge, et je compte bien la reprendre.',
    town: '{town}, encore ? La dernière fois, vous me l’avez prise. J’y ai toujours des clients, {name}, et ils se souviennent de moi.',
    loans: '{loans} [loans|emprunt|emprunts] la dernière fois, {name}. Mon banquier vous salue ; il s’est offert une voiture.',
    industry: 'Toujours {industry}, {name} ? Bonne affaire. Je vous en achète toute la production, à mon prix.',
    own: 'Vous vous souvenez de {own}, {name} ? Soho aussi : on en parle encore à l’heure du thé.',
    revenge: '{name}, vous m’avez battu la dernière fois. J’ai raconté à Soho que je vous avais laissé gagner. Ne me faites pas mentir deux fois.',
    gloat: 'Ravi de vous revoir, {name}. {theirs} contre {vp} la dernière fois — non que je sois homme à le rappeler. Sauf à l’instant.',
    tally: '{games} [games|partie|parties] entre nous, {name}, dont {won} pour vous. Je tiens les comptes : c’est mon métier.',
    ps: {
      first: 'P.-S. Notre première partie. J’ai ouvert un compte à votre nom.',
      streakYours: 'P.-S. {n} de suite pour vous. Je commence à me demander qui fournit qui.',
      streakMine: 'P.-S. {n} de suite pour moi. N’y voyez rien de personnel : c’est commercial.',
      tally: 'P.-S. Au grand livre : {games} [games|partie|parties], {won} pour vous, {lost} pour moi.',
    },
  },
  wedgwood: {
    first: '{name}. Wedgwood, d’Etruria. Je tourne de la faïence pour des reines ; voyons ce que l’on peut tourner de vous.',
    absence: 'Vous voilà, {name}. Une glaçure qu’on laisse trop longtemps au four finit par craqueler. Vous avez de la chance : moi, j’ai attendu.',
    streakYours: 'Vous l’avez emporté {n} fois de suite, {name}. Je ne casse pas la vaisselle : je la garde pour aujourd’hui.',
    streakMine: '{n} fois de suite, {name}, et toujours pour la même raison : la hâte. Prenez votre temps aujourd’hui ; je prendrai le mien.',
    comeback: 'La dernière fois, vous étiez derrière moi au canal et devant moi au rail. Je n’aime pas qu’on me double sur la voie ferrée, {name}.',
    close: '{margin} [margin|point|points], {name}. L’épaisseur d’une glaçure. Je l’ai remise au four.',
    town: '{town}, encore ? Vous me l’avez prise la dernière fois, {name}. J’en garde un vase ébréché sur la cheminée.',
    loans: '{loans} [loans|emprunt|emprunts] la dernière fois, {name}. On ne bâtit pas Etruria à crédit — on la bâtit lentement.',
    industry: 'Encore {industry}, {name} ? C’est un choix. Ce n’est pas encore un style.',
    own: 'Vous avez vu ce qu’ont fait {own} la dernière fois, {name}. Je n’ai pas changé la recette.',
    revenge: 'La dernière fois, vous l’avez emporté, {name}. Je n’en ai pas fait un vase. Mais je m’en souviens.',
    gloat: 'Bonsoir, {name}. {theirs} contre {vp}, la dernière fois. Je vous ai gardé une place à Etruria — la même.',
    tally: '{games} [games|partie|parties] ensemble, {name}, dont {won} pour vous. Je compte les pièces cuites, et les pièces fêlées.',
    ps: {
      first: 'P.-S. Une première partie ; je garde toujours la première pièce d’une série.',
      streakYours: 'P.-S. {n} fois de suite. Je commence à étudier votre manière.',
      streakMine: 'P.-S. {n} fois de suite. La patience, {me}. La patience.',
      tally: 'P.-S. Entre nous, {games} [games|partie|parties] : {won} pour vous, {lost} pour moi. Je tiens le registre à l’encre.',
    },
  },
  arkwright: {
    first: '{name}. Arkwright, Cromford. Je file vite. Suivez si vous pouvez.',
    absence: '{name}. Longtemps. J’ai doublé mes métiers depuis. Voilà.',
    streakYours: '{n} de suite pour vous. J’ai compté. Ça s’arrête ici.',
    streakMine: '{n} de suite pour moi, {name}. Le coton n’attend personne.',
    comeback: 'Derrière au canal, devant à la fin. La dernière fois. J’ai noté la manœuvre, {name}. Elle ne marchera pas deux fois.',
    close: '{margin} [margin|point|points] d’écart. Un rail de plus, et c’était moi. Aujourd’hui, j’ai le rail.',
    town: '{town} ? Encore ? Vous me l’avez prise. Je la reprends.',
    loans: '{loans} [loans|emprunt|emprunts] la dernière fois, {name}. J’ai compté. Moi, je paie comptant.',
    industry: 'Vous et {industry}, encore ? Bien. Je sais où vendre avant vous.',
    own: 'Même plan que la dernière fois, {name} : {own}, vite, et vendre. Pas besoin d’en changer.',
    revenge: 'Vous m’avez battue la dernière fois. Rare. Ça ne deviendra pas une habitude.',
    gloat: '{theirs} contre {vp}, la dernière fois. Ce n’est pas de la chance. C’est Cromford. On remet ça ?',
    tally: '{games} [games|partie|parties]. {won} pour vous. Je compte tout, {name}.',
    ps: {
      first: 'P.-S. Première partie. Il y en aura d’autres. J’ai de la place au registre.',
      streakYours: 'P.-S. {n} de suite. Je n’aime pas ce chiffre.',
      streakMine: 'P.-S. {n} de suite. J’aime ce chiffre.',
      tally: 'P.-S. {games} [games|partie|parties] entre nous. {won} pour vous, {lost} pour moi. Voilà.',
    },
  },
  watt: {
    first: '{name}. James Watt. Je joue chaque coup à fond et je relis chaque partie deux fois. Commençons.',
    absence: '{name}. Cela fait un moment. J’ai relu notre dernière partie entre-temps. Trois fois.',
    streakYours: '{n} [n|victoire|victoires] de suite pour vous, {name}. J’ai isolé la cause. Elle est corrigée.',
    streakMine: '{n} de suite pour moi, {name}. La même erreur à chaque fois. Je vous laisse la trouver.',
    comeback: 'La dernière fois : devant à la clôture du canal, battu au rail. Une fuite de vapeur, {name}. Colmatée.',
    close: '{vp}–{theirs}, la dernière fois. {margin} [margin|point|points]. Une tolérance que je ne vous accorderai plus.',
    town: '{town}. Encore. Vous m’y avez devancé la dernière fois, {name} ; c’est noté dans la marge.',
    loans: '{loans} [loans|emprunt|emprunts] la dernière fois. Le rendement était correct. L’intérêt, moins.',
    industry: '{name}, vous avez tout misé sur {industry} la dernière fois. Prévisible. C’est prévu.',
    own: 'Aucune raison de modifier une machine qui tourne, {name} : {own}, comme la dernière fois.',
    revenge: '{name}. Vous avez gagné la dernière fois. J’ai relu la partie deux fois. Cela ne se reproduira pas.',
    gloat: '{name}. {theirs}–{vp}, la dernière fois. Votre charbon arrivait trop tard. Voyons s’il est à l’heure aujourd’hui.',
    tally: '{name}. Bilan : {games} [games|partie|parties], {won} pour vous. Les chiffres ne flattent personne.',
    ps: {
      first: 'P.-S. Première partie consignée. Je relirai celle-ci aussi.',
      streakYours: 'P.-S. {n} de suite. Inacceptable. J’y travaille.',
      streakMine: 'P.-S. {n} de suite. Constant. C’est ce qu’on attend d’une machine.',
      tally: 'P.-S. Registre : {games} [games|partie|parties], {won} pour vous, {lost} pour moi.',
    },
  },
};

export default rivals;
