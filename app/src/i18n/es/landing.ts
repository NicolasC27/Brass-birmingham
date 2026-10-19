import type { Dict } from '../en';

/* ------------------------------------------------------------------ */
/* La portada antes de abrir la línea: lo que se hace en una mesa,     */
/* mostrado en el tablero mismo, la lista de espera dos veces, y las   */
/* cartas que la oficina le escribe.                                   */
/* ------------------------------------------------------------------ */
const landing: Dict['landing'] = {
  pageTitle: 'Blackrail | Alternativa online a Brass: Birmingham',
  motto: 'Canales, carbón y hierro — diario de las Midlands',
  hero: {
    eyebrow: 'Beta cerrada · inscripciones abiertas',
    title: 'Construye las Midlands en la época de los canales. Reconstrúyelas para el ferrocarril.',
    subhead: 'Estrategia económica exigente, de 2 a 4 jugadores, en el navegador. Construye, conecta, vende — contra tus amigos, o contra Mr Watt, que nunca regala nada.',
    kicker: 'Una alternativa online a Brass: Birmingham, independiente y no oficial.',
    watt: 'Mr Watt siempre juega a plena fuerza. ¿Te sentarás a su mesa?',
    plate: 'Lámina I — la era de los canales',
    alt: 'El tablero de Blackrail en la era de los canales: ciudades de las Midlands, fábricas en miniatura y canales sobre un paisaje pintado',
  },
  offer: {
    badge: 'Oferta de fundadores',
    title: 'Los 100 primeros inscritos: un año de Premium gratis.',
    note: 'Para las 100 primeras direcciones confirmadas, desde la apertura de Premium. Una por persona.',
    ended: 'Las 100 plazas de fundador están ocupadas: la lista de espera sigue abierta.',
  },
  form: {
    label: 'Tu dirección de correo',
    placeholder: 'tu@ejemplo.es',
    submit: 'Quiero mi billete para la prueba',
    sending: 'Enviando…',
    note: 'Dos cartas, nada más: la confirmación y luego la apertura. Ordenador y tableta.',
    privacy: 'Qué hacemos con tu dirección',
  },
  demo: {
    alpha: 'Alfa — demo de dos rondas',
    you: 'Tú',
    kicker: 'Pruébalo ahora',
    title: 'Dos rondas, aquí mismo.',
    text: 'La mesa real contra Mr Watt y Mrs Wedgwood, en tu navegador: sin registro, nada que instalar.',
    play: 'Jugar dos rondas',
    full: 'Abrir a pantalla completa',
    endKicker: 'Fin de la prueba',
    endTitle: 'Eso fueron dos rondas.',
    endText: 'La era de los canales tiene ocho, y luego llega el ferrocarril. Reserva tu plaza en la beta cerrada para jugar toda la línea.',
    ticket: 'Quiero mi billete',
    again: 'Jugar otra vez',
  },
  table: {
    plate: 'Lámina II — una mesa',
    title: 'Cada turno: dos cartas, dos acciones.',
    text: 'Construir, conectar, desarrollar, vender, pedir un préstamo, explorar. Tus cartas señalan el lugar; todo lo demás lo decides tú.',
    alt: 'Una partida en curso: una mano de ocho cartas, las seis acciones, los jugadores y el mapa general',
    marks: [
      { h: 'Tu mano', p: 'Ciudades e industrias para jugar, seis acciones para servirlas.' },
      { h: 'Tus rivales', p: 'El dinero, los puntos y los ingresos de cada uno, siempre a la vista.' },
      { h: 'El mapa general', p: 'Toda la red de un vistazo: no se te escapa nada de lo que se trama.' },
    ],
  },
  twist: {
    plate: 'Lámina III — el giro',
    title: 'Fin de la era de los canales: la primera red va al desguace.',
    text: 'Los canales y las industrias de primer nivel desaparecen. El ferrocarril arranca de nuevo en terreno despejado: lo que preparaste sobrevive, lo demás se esfuma.',
    slider: 'Desliza para pasar de los canales al ferrocarril',
    canalCaption: 'La era de los canales',
    railLabel: 'La era del ferrocarril',
    canalAlt: 'El tablero en la era de los canales: una red de canales de colores une las ciudades',
    ceremonyAlt: 'El recuento de fin de era: «Y así el agua cede el paso al vapor…», los puntos de cada jugador',
    ceremonyCaption: 'El recuento de la era de los canales',
    railAlt: 'El tablero en la era del ferrocarril: líneas de tren unen las ciudades',
    railCaption: 'La era del ferrocarril: el terreno despejado, la carrera vuelve a empezar',
  },
  economy: {
    plate: 'Lámina IV — los negocios',
    title: 'Una economía de verdad, no un decorado.',
    points: [
      { h: 'Ciudades reales', p: 'Stoke, Dudley, Coventry, Birmingham: instala minas, fundiciones, hilanderías, manufacturas, alfarerías y cervecerías.' },
      { h: 'Mercados que se mueven', p: 'El carbón y el hierro se venden en mercados comunes: cada compra sube el precio para tus rivales.' },
      { h: 'Mercaderes que conquistar', p: 'Algodón, mercancías y cerámica parten hacia Warrington, Oxford, Gloucester, Nottingham o Shrewsbury.' },
      { h: 'Losetas que se voltean', p: 'Una industria que ha servido se voltea: paga ingresos y puntos de victoria.' },
    ],
    stokeAlt: 'Primer plano: la alfarería de Stoke-on-Trent y el mercader de Warrington',
  },
  machines: {
    plate: 'Lámina V — las máquinas',
    title: 'Cuatro rivales mecánicos. Uno de ellos no te dejará nada.',
    text: 'Mr Boulton, Mrs Wedgwood, Miss Arkwright y Mr Watt tienen cada uno su carácter. Detrás de ellos, una verdadera inteligencia de búsqueda calcula cada jugada — y Mr Watt siempre juega a plena fuerza.',
    portrait: 'Retrato pintado de {name}',
    cta: 'Enfrentarse a Mr Watt en la prueba',
    watt: 'siempre a plena fuerza',
  },
  line: {
    title: 'La partida termina; la línea sigue.',
    points: [
      { h: 'Rápida o clasificada', p: 'Una clasificación por temporada, compañías a las que unirse, amigos a los que invitar.' },
      { h: 'El reto de la semana', p: 'El mismo reparto para todos, condiciones duras, y Mr Watt siempre en la mesa.' },
      { h: 'El juez', p: 'Revive cada partida jugada a jugada; el juez te muestra dónde se decidió.' },
      { h: 'El correo de las máquinas', p: 'Después de la partida, tus rivales mecánicos te escriben.' },
    ],
  },
  levels: {
    title: '¿Nunca has jugado a un juego de este calibre?',
    text: 'La clase nocturna te enseña las reglas, el glosario te acompaña a todas partes y tu primera partida es guiada. Los veteranos conservan toda la niebla de la mesa: ninguna ayuda que haga trampa.',
  },
  faq: {
    title: 'Preguntas en la taquilla',
    items: [
      { q: '¿En qué se juega?', a: 'En el navegador, en ordenador y tableta. No en el móvil.' },
      { q: '¿Hacen falta amigos para jugar?', a: 'No. Juega contra las cuatro máquinas, o en línea en partidas rápidas o clasificadas.' },
      { q: '¿Es para principiantes?', a: 'Sí, con la clase nocturna y una primera partida guiada. Pero es un juego de estrategia exigente, a propósito.' },
      { q: '¿Cuántas cartas recibiré?', a: 'Dos: una para confirmar tu dirección y otra cuando abra la prueba.' },
      { q: '¿Cuándo y a qué precio?', a: 'Ni la fecha ni el precio están fijados. Los 100 primeros confirmados en la lista reciben un año de Premium gratis, y todos los inscritos lo sabrán primero.' },
    ],
  },
  bar: 'Mi billete',
  final: {
    title: 'El primer convoy sale pronto. Guarda tu plaza.',
  },
  discord: {
    join: 'Unirse al Discord',
    wait: 'Mientras esperas, ven a hablar de canales y raíles con los demás viajeros.',
    seat: 'El andén está en Discord: noticias de la prueba, los primeros jugadores y el equipo trabajando.',
  },
  sent: {
    title: 'Una carta va en camino',
    text: 'Ábrela y sigue el enlace para confirmar tu plaza. ¿No ha llegado? Mira en la carpeta de spam.',
    again: 'Dar otra dirección',
  },
  errors: {
    email: 'Esto no parece una dirección de correo.',
    busy: 'Demasiados intentos desde aquí. Vuelve a probar en unos minutos.',
    down: 'La oficina no responde ahora mismo. Vuelve a probar en un momento.',
  },
  confirm: {
    eyebrow: 'Lista de espera',
    working: 'Un momento…',
    badTitle: 'Este enlace ya no funciona',
    founder: 'Eres el viajero n.º {rank}: tu año de Premium queda reservado para su apertura.',
    title: 'Tu plaza está reservada',
    text: 'Gracias. Te escribiremos a esta dirección en cuanto abra el viaje de prueba.',
    bad: 'Este enlace ya no funciona: quizá ya se usó, o la dirección se borró tras una semana sin respuesta.',
  },
  leave: {
    title: 'Salir de la lista de espera',
    text: 'Tu dirección se borrará y no volveremos a escribirte.',
    button: 'Sacarme de la lista',
    done: 'Hecho: tu dirección está borrada.',
    bad: 'Este enlace ya no funciona: la dirección seguramente ya se borró.',
  },
  back: 'Volver al preestreno',
  letter: {
    confirmSubject: 'Blackrail — confirma tu plaza',
    confirmText: 'Hola:\n\nEsta dirección se dejó en la lista de espera de Blackrail. Sigue este enlace para confirmar tu plaza:\n\n{link}\n\nSi no fuiste tú, ignora esta carta: la dirección se borrará en una semana.\n\n— La oficina de telégrafos de Blackrail',
    footer: 'Recibes esta carta porque te apuntaste a la lista de espera de Blackrail.\nPara no recibir más: {link}',
  },
};

export default landing;
