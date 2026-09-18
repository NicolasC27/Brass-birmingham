import ensetup from "../en/setup";

const es: typeof ensetup = {
  backToTitle: "Título",
  eyebrow: "Prepara la mesa",
  title: "Nueva partida",
  seating: {
    ariaLabel: "Asientos",
    heading: "Asientos",
    note: "De dos a cuatro industriales. Elegir un color se lo quita a quien lo tenga — las fichas se intercambian, no se duplican.",
  },
  summary: {
    botName: "{name} ({difficulty})",
  },
  begin: "Empezar la era del canal",
  beginHint: "Sienta al menos a dos jugadores — humanos o mecánicos — antes de que se robe la primera carta.",
  houseRules: {
    ariaLabel: "Reglas de la casa",
    heading: "Reglas de la casa",
    eraLength: {
      label: "Duración de la partida",
      hint: "Una partida corta termina y se puntúa tras la era del canal.",
      ariaLabel: "Duración de la partida",
      full: "Partida completa",
      canalOnly: "Solo canal",
    },
    marketTemper: {
      label: "Humor del mercado",
      hint: "Solo el stock inicial: estándar son los 13 carbones / 8 hierros impresos, tranquilo abre los dos mercados llenos, volátil los abre casi vacíos. Los mercados nunca se reponen solos — solo una mina o fundición nueva los llena.",
      ariaLabel: "Humor del mercado",
      calm: "Tranquilo",
      standard: "Estándar",
      volatile: "Volátil",
      beta: "Beta",
    },
    assist: {
      label: "Ayuda para principiantes",
      hint: "Para toda la mesa: casillas jugables iluminadas, precios detallados, consejos durante la partida. Se ajusta aquí para una mesa en línea; en casa, también es un ajuste del tablero.",
      on: "Activada",
      off: "Desactivada",
    },
    timer: {
      label: "Cronómetro de turno",
      hint: "Cuando está activo, el tablero muestra una pequeña placa de latón con la cuenta atrás de cada turno — ideal alrededor de una misma mesa.",
      ariaLabel: "Cronómetro de turno",
      off: "Sin",
      min: "{n} min",
    },
    fidelity: {
      label: "Fidelidad de las reglas",
      faithful: "Reglas básicas: fieles",
      seeApproximations: "Ver las aproximaciones",
    },
  },
  seat: {
    empty: "Silla vacía",
    seatAnother: "Sentar a otro jugador a la mesa.",
    openAria: "Abrir el asiento {n}",
    botPortraitAlt: "Retrato del rival mecánico",
    namePlaceholder: "Nombra a este industrial",
    nameAria: "Nombre del asiento {n}",
    typeHuman: "Humano",
    typeBot: "Mecánico",
    typeClosed: "Cerrado",
    headBadge: "Humano · Tú",
    typeAria: "Tipo del asiento {n}",
    colorAria: "Color del asiento {n}",
    colorStealTip: "{color} — se le quita a quien lo tenga.",
    beta: "Beta",
    engineTip: "Las máquinas juegan todo su turno antes de elegir. Se aplican aproximaciones — ver el Códice de reglas.",
  },
  token: {
    ariaLabel: "Ficha {color}",
  },
  colors: {
    brass: "Latón",
    oxblood: "Burdeos",
    verdigris: "Verdín",
    steel: "Azul acero",
  },
  persona: {
    boulton: {
      label: "Mr Boulton",
    },
    wedgwood: {
      label: "Mrs Wedgwood",
    },
    watt: {
      label: "Mr Watt",
    },
    arkwright: {
      label: "Miss Arkwright",
    },
    short: "Juega a tu nivel",
    adaptive:
      "Juega a tu nivel — más afilado cuando ganas, más suave cuando pierdes, nunca hasta escaparse con la partida.",
  },
  defaults: {
    playerOne: "Jugador uno",
    playerTwo: "Jugador dos",
    player: "Jugador",
    nameless: "Sin nombre",
    engine: "Máquina {n}",
  },
};
export default es;
