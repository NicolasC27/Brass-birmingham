import type { Dict } from '../en';

/* ------------------------------------------------------------------ */
/* La portada antes de abrir la línea: el juego en pocas líneas, la    */
/* lista de espera y las cartas que la oficina le escribe.             */
/* ------------------------------------------------------------------ */
const landing: Dict['landing'] = {
  ear: 'Preestreno',
  eyebrow: 'Pronto en la estación',
  headline: 'Construye las Midlands, canal a canal, raíl a raíl.',
  lede: 'Un juego de estrategia económica para dos a cuatro jugadores, en el Black Country de 1770 a 1865. Primero los canales, luego el ferrocarril: levanta hilanderías y minas, vende a los mercaderes y hazles frente a las máquinas — o a tus amigos.',
  trial: {
    title: 'El viaje de prueba',
    text: 'Antes de abrir la línea, unos pocos viajeros probarán el juego primero. Deja tu dirección y te escribiremos cuando tu plaza esté lista.',
  },
  form: {
    label: 'Tu dirección de correo',
    placeholder: 'tu@ejemplo.es',
    submit: 'Reservar mi plaza',
    sending: 'Enviando…',
    note: 'Una carta para confirmar y otra cuando abra la prueba. Nada más, y una forma de salir en cada carta.',
    privacy: 'Qué hacemos con tu dirección',
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
  eras: {
    canal: 'La era de los canales',
    rail: 'La era del ferrocarril',
  },
  points: [
    { h: 'Dos eras', p: 'Los canales, luego el ferrocarril: lo que se construyó primero desaparece, y la red lo decide todo.' },
    { h: 'Cuatro máquinas', p: 'Boulton, Wedgwood, Arkwright y Watt juegan cada uno a su manera. Watt siempre juega para ganar.' },
    { h: 'Mesas en línea', p: 'Juega con otros, en partida rápida o clasificada, y vuelve a leer cada partida jugada a jugada.' },
  ],
  confirm: {
    eyebrow: 'Lista de espera',
    working: 'Un momento…',
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
