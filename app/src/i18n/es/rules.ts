import enrules from "../en/rules";

const es: typeof enrules = {
  status: {
    faithful: "Fiel",
    approximate: "Aproximado",
    planned: "Previsto",
  },
  chapters: {
    quickstart: "Lo esencial",
    eras: "Las dos eras",
    actions: "Las seis acciones",
    industries: "Las industrias",
    network: "La red",
    supply: "Carbón y hierro, entregados",
    market: "El mercado vivo",
    selling: "Venta y mercaderes",
    money: "Dinero y préstamos",
    scoring: "Recuento y victoria",
    glossary: "El glosario",
    approximations: "Aproximaciones actuales",
  },
  hero: {
    eyebrow: "El Compendio de los Midlands",
    title: "Del comercio y la manufactura",
    lede:
      "Fiel relación de las reglas de Blackrail — canales, carbón, hierro y las dos grandes eras de la industria.",
    wholeOfIt: "Todo entero",
  },
  rail: {
    chapters: "Capítulos",
    jumpAria: "Ir al capítulo",
    navAria: "Capítulos del códice",
    index: "Índice de capítulos",
    footnote:
      "El capítulo XII es el registro honesto de lo que este prototipo simplifica — citado allí donde aparece una pastilla de fidelidad.",
  },
  quickstart: {
    note: "Cada acción empieza por una carta. Todo lo demás se deriva de lo que ella te permite alcanzar.",
  },
  quick: {
    goal: {
      title: "El objetivo",
      body: "Reúne el mayor número de puntos de victoria al término de dos grandes eras. Los puntos vienen de las industrias volteadas y de cada enlace de tu red.",
    },
    turn: {
      title: "Tu turno",
      body: "Realiza dos acciones, cada una pagada con una carta de tu mano — construir, conectar, vender, pedir prestado, desarrollar o explorar. La primera ronda de la partida solo concede una.",
    },
    build: {
      title: "Construye industrias",
      body: "Juega una carta de lugar o de industria para colocar una loseta de tu tablero en una casilla correspondiente. Paga su coste en dinero, carbón y hierro.",
    },
    connect: {
      title: "Conecta la red",
      body: "Tiende canales, y luego vías férreas, entre las ciudades. Todo lo que construyes, abasteces y vendes debe pasar por tu red.",
    },
    sell: {
      title: "Vende, pide prestado, desarrolla",
      body: "Vende tus mercancías a mercaderes lejanos para voltear losetas y ganar ingresos, pide préstamos cuando falte el dinero, y desarrolla para descartar las obras débiles.",
    },
    supply: {
      title: "Abastecimiento y recuento",
      body: "El carbón y el hierro deben llegar físicamente hasta ti — por canal, por vía férrea, o comprados a buen precio en el mercado. Cada era termina con un recuento completo.",
    },
  },
  eras: {
    canalAlt: "Friso grabado de la era del canal",
    railAlt: "Friso grabado de la era del ferrocarril",
    canalTitle: "La era del canal, 1770–1830",
    canalBody:
      "Los turnos se suceden ronda a ronda: una carta por cada una de tus dos acciones (una sola acción en la primera ronda), y luego robas hasta completar la mano. Los canales cuestan 3 £ por enlace y son las únicas vías de la era. Cuando el mazo y todas las manos se agotan, se cuenta la era — las industrias volteadas dan sus PV, y cada enlace cuenta los iconos de enlace de las losetas de industria de los lugares que une, y dos por mercader.",
    railTitle: "La era del ferrocarril, 1830–1870",
    railBody:
      "Un mazo nuevo, manos frescas, y vías férreas a 5 £ más un carbón por enlace — pueden colocarse dos enlaces en una sola acción por 15 £, dos carbones y una cerveza. Ya no puede excavarse ningún canal nuevo, y las cervecerías llegan ahora con dos barriles en lugar de uno. Cuando también este mazo se agota, el tablero se cuenta por segunda vez y el registro más rico gana.",
    betweenTitle: "Entre las eras",
    betweenBody:
      "Las obras de nivel 1 se barren del tablero cuando las aguas se retiran — planea voltearlas antes de que acabe la era del canal, o míralas desaparecer sin contarse. Todas las losetas de enlace se retiran también, una vez contadas: la era del ferrocarril arranca solo desde tus industrias.",
  },
  actionsIntro:
    "Cada acción cuesta una carta de tu mano — dos acciones, dos cartas. Abre una fila de las seis de abajo para ver sus costes, sus pasos y los casos límite que deciden las partidas ajustadas.",
  actionsUi: {
    edgeCases: "Casos límite",
    diagram: {
      town: "Ciudad",
      yourTown: "tu ciudad",
      newTown: "ciudad nueva",
      minusIron: "−1 hierro",
      perTile: "por loseta",
      mill: "hilandería",
      beer: "cerveza",
      merchant: "mercader",
      loanLabel: "−3 niveles · +30 £",
    },
  },
  actions: {
    build: {
      name: "Construir",
      cost: "Coste en £ de la loseta + carbón y hierro indicados",
      steps: {
        s1: "Juega una carta de lugar (construye en esa ciudad) o una carta de industria (construye esa industria en cualquier punto de tu red).",
        s2: "Toma la loseta correspondiente de nivel más bajo de tu tablero de jugador y colócala en una casilla libre.",
        s3: "Paga el coste en dinero, y luego entrega el carbón y el hierro requeridos (ver capítulo VI).",
      },
      edges: {
        e1: "Una carta de lugar construye en su ciudad, esté o no en tu red; una carta de industria exige una ciudad de tu red. Mientras no tengas nada en el tablero, tu red es todo el mapa.",
        e2: "Una carta comodín puede hacer las veces de cualquier lugar o industria.",
        e3: "Una loseta por casilla. Tu propia loseta puede sobreconstruirse con un nivel superior de la misma industria; la mina o la fundición de un rival solo cuando no quede ningún cubo de ese recurso en ninguna parte — mercado incluido. En la era del canal, una sola loseta por ciudad y por jugador.",
      },
    },
    network: {
      name: "Red",
      cost: "Canal 3 £ · Vía férrea 5 £ + 1 carbón · Doble vía 15 £ + 2 carbones + 1 cerveza",
      steps: {
        s1: "Juega cualquier carta y coloca un enlace de canal (era del canal) o un enlace de vía férrea (era del ferrocarril) en una ruta libre entre dos ciudades.",
        s2: "El enlace debe tocar tu red existente — una ciudad con una de tus losetas, o el extremo de uno de tus enlaces.",
        s3: "Paga el coste; los enlaces de vía férrea consumen además un carbón, entregado como en el capítulo VI.",
      },
      edges: {
        e1: "En la era del ferrocarril puedes colocar dos enlaces de vía en una sola acción por 15 £, 2 carbones y una cerveza — sacada de una cervecería, nunca de un barril de mercader.",
        e2: "No puede construirse ningún canal nuevo una vez empezada la era del ferrocarril; los canales existentes permanecen.",
        e3: "Los puertos de mercader cuentan como ciudades para las conexiones.",
      },
    },
    develop: {
      name: "Desarrollar",
      cost: "1 hierro por loseta retirada (máx. 2)",
      steps: {
        s1: "Juega cualquier carta y retira una o dos losetas de lo alto de las pilas de industria de tu tablero de jugador.",
        s2: "Paga un hierro por cada loseta retirada, entregado al tablero como de costumbre.",
        s3: "Las losetas retiradas vuelven a la caja, revelando los niveles más potentes de debajo.",
      },
      edges: {
        e1: "Desarrollar es el camino más corto hacia tus obras potentes; construir también consume la pila, y la bonificación del mercader de Gloucester retira una loseta gratis.",
        e2: "Puedes retirar losetas de dos industrias distintas en una sola acción de desarrollo.",
      },
    },
    sell: {
      name: "Vender",
      cost: "Cerveza: la impresa en la loseta (1, o 2 para las grandes obras)",
      steps: {
        s1: "Juega cualquier carta y elige una o varias de tus hilanderías de algodón, manufacturas o alfarerías.",
        s2: "Cada una debe conectar con una loseta de mercader que muestre sus bienes — algodón, manufactura, cerámica, o cualquier bien.",
        s3: "Gasta la cerveza requerida — el barril del mercader, tus cervecerías o una cervecería conectada — y luego voltea cada loseta vendida.",
      },
      edges: {
        e1: "Las losetas volteadas dan su bonificación de ingresos de inmediato y puntúan PV al final de la era.",
        e2: "El apetito de un mercader nunca se agota: su loseta compra una y otra vez. Solo su barril de bonificación se bebe una vez por era.",
        e3: "La cerveza que bebe una loseta está impresa en ella: dos barriles para la manufactura de nivel 5 y las alfarerías de niveles 3 y 5, sea cual sea la era.",
      },
    },
    loan: {
      name: "Préstamo",
      cost: "Ingresos −3 niveles · toma 30 £",
      steps: {
        s1: "Juega cualquier carta, baja tu marcador de ingresos tres niveles en la pista, y toma 30 £ del banco.",
      },
      edges: {
        e1: "Un préstamo puede pedirse en cualquiera de las dos acciones de tu turno — incluso como segunda acción.",
        e2: "Los préstamos nunca se devuelven; la pérdida de ingresos es definitiva.",
        e3: "Si tus ingresos caen por debajo de 0 £, pagas al banco al final de cada ronda. Un préstamo que te hiciera bajar del nivel −10 se rechaza.",
      },
    },
    scout: {
      name: "Explorar",
      cost: "Descarta 3 cartas · roba 2 comodines",
      steps: {
        s1: "Descarta tres cartas de tu mano.",
        s2: "Toma en mano las dos cartas comodín — un lugar comodín, una industria comodín.",
      },
      edges: {
        e1: "Explorar es una acción como cualquier otra — pero imposible mientras tengas un comodín en la mano, o en cuanto una pila de comodines esté vacía.",
        e2: "Las cartas comodín pueden jugarse después para cualquier ciudad o industria.",
      },
    },
  },
  industriesIntro:
    "Seis oficios hacen girar los Midlands. Cada uno sube por su propia columna en tu tablero de jugador — cuatro niveles para la mayoría, cinco para la cerámica, ocho para la manufactura; siempre construyes el nivel más bajo que quede, y desarrollas para alcanzar los más potentes. Aprende a leer una loseta: los puntos marcan el nivel, la ficha de latón los ingresos ganados al voltear, la ficha crema los puntos de victoria.",
  industries: {
    tuningTag: "Losetas impresas",
    tuningNote:
      "— cada valor de abajo se lee en el tablero de jugador oficial: 45 losetas por jugador, niveles reservados al canal o al ferrocarril, cerveza necesaria para vender, iconos de enlace y bombillas.",
    headers: {
      tile: "Loseta",
      lvl: "Niv",
      build: "Coste",
      coalIron: "Carbón / Hierro",
      beerToFlip: "Cerveza para voltear",
      income: "Ingresos Δ",
      vp: "PV",
      notes: "Notas",
    },
    resource: {
      coal: "{n} carbón",
      iron: "{n} hierro",
      none: "—",
    },
    beer: {
      count: "{n} cerveza(s)",
      onEmpty: "al vaciarse",
    },
    coalMine: {
      name: "Mina de carbón",
      blurb:
        "El negro cimiento de todo. Las minas llegan cargadas de cubos de carbón que alimentan toda la red; cuando el filón se agota, la loseta se voltea por sí sola.",
      notes: {
        n1: "Solo era del canal. 2 carbones; 2 iconos de enlace; se voltea al vaciarse.",
        n2: "3 carbones; se voltea al vaciarse.",
        n3: "4 carbones; cuesta 1 hierro construirla.",
        n4: "5 carbones; cuesta 1 hierro construirla.",
      },
    },
    ironWorks: {
      name: "Fundición",
      blurb:
        "Fundiciones que almacenan barras de hierro para construir y desarrollar. Como las minas, se voltean cuando su reserva se agota — una fundición trabajada en frío es una fundición pagada.",
      notes: {
        n1: "Solo era del canal. 4 hierros; cuesta 1 carbón.",
        n2: "4 hierros; cuesta 1 carbón.",
        n3: "5 hierros; cuesta 1 carbón.",
        n4: "6 hierros; cuesta 1 carbón.",
      },
    },
    cottonMill: {
      name: "Hilandería de algodón",
      blurb:
        "La gran máquina de beneficios de los Midlands. Las hilanderías solo se voltean vendiendo a un mercader lejano — y pagan generosamente la molestia.",
      notes: {
        n1: "Solo era del canal. 1 icono de enlace; ×3 en el tablero.",
        n2: "Cuesta 1 carbón; 2 iconos de enlace; ×2.",
        n3: "Cuesta 1 carbón + 1 hierro; ×3.",
        n4: "Cuesta 1 carbón + 1 hierro; ×3 — la hilandería más rica.",
      },
    },
    manufacturer: {
      name: "Manufactura",
      blurb:
        "Talleres que producen bienes acabados. Más baratas que las hilanderías y más regulares — la discreta columna vertebral de muchos registros ganadores.",
      notes: {
        n1: "Solo era del canal. Cuesta 1 carbón; 2 iconos de enlace.",
        n2: "Cuesta 1 hierro; ×2.",
        n3: "Cuesta 2 carbones; ningún icono de enlace.",
        n4: "Cuesta 1 hierro; barata y rápida.",
        n5: "Cuesta 1 carbón; se vende por 2 cervezas; 2 iconos de enlace; ×2.",
        n6: "No necesita recursos.",
        n7: "Cuesta 1 carbón + 1 hierro; ningún icono de enlace.",
        n8: "Cuesta 2 hierros; ×2 — la cima del tablero.",
      },
    },
    pottery: {
      name: "Alfarería",
      blurb:
        "Hornos de apetito modesto y valor notable. La alfarería puntúa por encima de su peso, pero vender sale caro en la segunda era.",
      notes: {
        n1: "Ambas eras. Cuesta 1 hierro. Bombilla: no desarrollable.",
        n2: "Gratis; cuesta 1 carbón. Para desarrollar.",
        n3: "Cuesta 2 carbones; se vende por 2 cervezas. Bombilla: no desarrollable.",
        n4: "Gratis; cuesta 1 carbón.",
        n5: "Solo era del ferrocarril. Cuesta 2 carbones; se vende por 2 cervezas; 20 PV.",
      },
    },
    brewery: {
      name: "Cervecería",
      blurb:
        "La cerveza hace fluir las ventas. Las cervecerías llegan con un barril en la era del canal y dos en la del ferrocarril, y se voltean al vaciarse — las tuyas desde donde estén, las de los demás si están conectadas.",
      notes: {
        n1: "Solo era del canal. Cuesta 1 hierro; 2 iconos de enlace; ×2.",
        n2: "Cuesta 1 hierro; ×2.",
        n3: "Cuesta 1 hierro; ×2.",
        n4: "Solo era del ferrocarril. Cuesta 1 hierro.",
      },
    },
  },
  network: {
    intro:
      "Tu red es el conjunto de ciudades con una de tus losetas y de enlaces que has colocado — más todo lo que toca a través de las rutas de los demás jugadores. Construir más allá de tu primera jugada, entregar carbón y hierro, y vender a los mercaderes se trazan a lo largo de esa red.",
    canalChip: "Enlace de canal · 3 £ · era del canal",
    railChip: "Enlace de vía férrea · 5 £ + 1 carbón · era del ferrocarril",
    doubleRailChip: "Doble vía · 15 £ + 2 carbones + 1 cerveza · una acción",
    outro:
      "Los enlaces se cuentan, no solo se usan: al final de cada era, cada enlace cuenta los iconos de enlace impresos en las losetas de industria de los lugares que une — sin importar de quién sean las losetas — y dos por mercader. Un canal bien colocado a través de la ciudad floreciente de un rival vale tanto para ti como para él.",
  },
  supply: {
    intro: "Este es el corazón del juego, y no es abstracto. Cada cubo de carbón que exige una construcción debe llegar físicamente: desde una mina conectada — la tuya o la de un rival, sin coste para ti (su loseta se vacía — ¡un regalo que voltea su industria!) — o comprado en el mercado, que a su vez exige una conexión con un mercader. Si no hay ninguna fuente accesible, la construcción es imposible.",
    note: "El hierro no necesita ruta alguna: cualquier fundición del tablero te sirve, y luego el mercado del hierro, con conexión o sin ella. La cerveza viene de tus propias cervecerías estén donde estén, de las de un rival solo si están conectadas, o del barril del mercader cuando le vendes.",
    aria:
      "Esquema del abastecimiento de carbón: una mina conectada entrega carbón gratis a lo largo de tus canales, el mercado vende al precio vigente, y una conexión rota rechaza la construcción.",
    groupAria: "Escenarios de abastecimiento",
    modes: {
      mine: {
        label: "Mina conectada",
        hint: "Tu construcción traza una cadena de enlaces hasta tu propia mina de carbón. El carbón viaja gratis por tus canales — la mina pierde un cubo.",
      },
      market: {
        label: "Compra en el mercado",
        hint: "¿Sin mina conectada? Entonces el carbón se compra en el tablero del mercado: pagas el precio vigente (3 £ aquí) y el cubo más barato desaparece — el siguiente comprador pagará más caro.",
      },
      none: {
        label: "Ninguna fuente",
        hint: "La mina está más allá de una cadena rota: ningún enlace la alcanza, y un mercado agotado no ofrece nada. La construcción se rechaza en seco — el abastecimiento es ley, no sugerencia.",
      },
    },
    chips: {
      mine: "Carbón 0 £ — tu propia mina",
      market: "Comprar 1 carbón · 3 £",
      none: "Ningún carbón accesible",
    },
    yourMine: "tu mina de carbón",
    marketLabel: "el mercado",
    buildSlot: "construcción · 1 carbón",
  },
  marketTray: {
    title: "El tablero del carbón",
    buy: "Comprar 3 £",
    caption: "← comprar vacía primero las casillas baratas · vender repone por el extremo caro →",
  },
  market: {
    p1:
      "Cuando la oferta escasea, el mercado responde — a un precio. El carbón descansa en catorce casillas cotizadas de 1 £ a 7 £, el hierro en diez casillas de 1 £ a 5 £; un tablero vacío aún vende, a 8 £ y 6 £. Comprar toma el cubo más barato y el precio sube. Nada repone los tableros por sí solo: una mina o una fundición recién construida y conectada a un mercader vende sus cubos sobrantes al mercado, que se repone por el extremo caro y el precio vuelve a bajar.",
    p2:
      "Un mercado vacío es un muro, no un inconveniente: el carbón que no se puede comprar ni alcanzar está sencillamente fuera de tu alcance. Vigila los tableros como un capataz vigila el cielo.",
  },
  selling: {
    intro: "Hilanderías de algodón, manufacturas y alfarerías solo se voltean vendiendo a un puerto de mercader en el borde del mapa. El puerto debe mostrar tus bienes (o cualquier bien), debes trazar una conexión hasta él, y cada loseta bebe la cerveza impresa en ella antes de venderse — un barril para la mayoría, dos para las grandes obras.",
    li1: "La cerveza viene primero del barril del mercader cuando le vendes — eso activa su bonificación — luego de tus cervecerías, y luego de cualquier cervecería conectada.",
    li2: "Voltear paga la bonificación de ingresos de inmediato y guarda en el banco los PV de la loseta para el recuento de la era.",
    li3: "Cada loseta de mercader guarda un barril por era; bébelo y su bonificación cae, y el barril se repone al abrirse la era del ferrocarril.",
    choice:
      "La elección es el juego en miniatura: los ingresos engordan desde ya la bolsa de cada ronda futura, mientras los PV esperan pacientes el ajuste final.",
    flip: {
      aria: "Loseta de demostración: pasa el cursor o dale el foco para voltearla de su cara pergamino a su cara brasa vendida",
      tileName: "hilandería de algodón I",
      vp: "puntos de victoria",
      sold: "vendida · volteada",
      caption: "Pasa el cursor o dale el foco — voltear es el día de paga.",
    },
  },
  tile: {
    vpChip: "{vp}PV",
  },
  money: {
    intro: "Al final de cada ronda, tu marcador de ingresos te paga su nivel en libras. Voltear industrias hace subir la escalera, que tiene su techo en el nivel 30.",
    li1: "Un préstamo puede pedirse en cualquiera de las dos acciones: baja tres niveles, toma 30 £, juega.",
    li2: "Los préstamos nunca se devuelven. Los niveles sencillamente han desaparecido.",
    li3: "Por debajo de 0 £, la escalera se vuelve acreedora — pagas al banco al final de cada ronda.",
    develop:
      "Desarrollar, ese discreto sexto sentido de los buenos jugadores, cambia un hierro por la retirada de una loseta débil, descubriendo los niveles potentes de debajo sin gastar una construcción.",
    ladderAria:
      "Escalera de la pista de ingresos: niveles desde menos diez libras hasta treinta, el techo, con un peón de latón posado en el peldaño de las diez libras",
    ladderCaption: "la pista de ingresos",
  },
  scoring: {
    thSource: "Fuente",
    thCounts: "Cuenta",
    thWhen: "Cuándo",
    r1s: "Industrias volteadas",
    r1c: "PV impresos en la loseta",
    r1w: "Final de cada era",
    r2s: "Enlaces",
    r2c: "iconos de enlace en los dos lugares unidos",
    r2w: "Final de cada era (canales y luego vías)",
    r3s: "Desempates",
    r3c: "nivel de ingresos más alto → más dinero",
    r3w: "Solo en el ajuste final",
    exampleTitle: "Un ejemplo con cifras",
    exampleBody:
      "Dos obras volteadas (2 y 5 PV) en ciudades que une tu enlace, más 3 PV de enlace por la propia conexión: {expr} en la cuenta de la era.",
    expr: "2 + 5 + 3 = 10",
  },
  scoringSketch: {
    aria:
      "Ejemplo con cifras: dos losetas volteadas que valen 2 y 5 puntos de victoria en ciudades unidas por un enlace, que a su vez puntúa 3 puntos de enlace",
    link: "enlace 3",
    vpTotal: "total PV",
  },
  glossary: {
    network: {
      term: "Red",
      def: "Todo lo que tocan tus losetas y enlaces. Construir, entregar carbón y vender se trazan a lo largo de la red.",
    },
    connected: {
      term: "Conectado",
      def: "Accesible por una cadena ininterrumpida de enlaces tuyos o de rivales y de ciudades ocupadas.",
    },
    flippedTile: {
      term: "Loseta volteada",
      def: "Una obra que ha vendido o se ha vaciado — girada a su cara brasa, dando ingresos y puntuando PV.",
    },
    merchantPort: {
      term: "Puerto de mercader",
      def: "Una loseta portuaria en el borde del mapa, que muestra los bienes que compra; el único comprador para hilanderías, manufacturas y alfarerías.",
    },
    demandPip: {
      term: "Bienes del mercader",
      def: "El icono de una loseta de mercader — algodón, manufactura, cerámica, o cualquier bien. Nunca se agota.",
    },
    beer: {
      term: "Cerveza / barril",
      def: "El lubricante del comercio, gastado para vender mercancías. Sale de las cervecerías o de la bodega del mercader.",
    },
    wildCard: {
      term: "Carta comodín",
      def: "Una carta que hace las veces de cualquier lugar o industria, ganada al explorar.",
    },
    era: {
      term: "Era",
      def: "Una mitad de la partida — canal, y luego ferrocarril — cerrada por un recuento completo de los enlaces y las losetas volteadas.",
    },
    incomeTrack: {
      term: "Pista de ingresos",
      def: "La escalera que registra tus ganancias en cada ronda. Los volteos la hacen subir; los préstamos la bajan tres niveles.",
    },
    overbuild: {
      term: "Sobreconstrucción",
      def: "Reemplazar una loseta por un nivel superior de la misma industria — la tuya libremente, la mina o la fundición de un rival solo cuando no quede ningún cubo de ese recurso en ninguna parte, mercado incluido.",
    },
    linkVp: {
      term: "PV de enlace",
      def: "En el recuento, cada enlace cuenta los iconos de enlace de las losetas de industria de los dos lugares que une (dos por mercader), sin importar de quién sean.",
    },
    market: {
      term: "El mercado",
      def: "Los tableros de carbón y hierro donde los precios suben cuando se compran las reservas y bajan cuando se revenden.",
    },
    distantSale: {
      term: "Venta lejana",
      def: "Vender a un mercader hasta el que puedes trazar una conexión, sea cual sea el número de enlaces entre vosotros.",
    },
    clockworkClub: {
      term: "The Clockwork Club",
      def: "Los jugadores mecánicos — los bots Capataz, Industrial y Magnate que ocupan una silla vacía.",
    },
  },
  approx: {
    intro:
      "Un registro honesto, a la vista de todos: lo que esta versión previa juega fielmente, y lo que aún simplifica. La pantalla de preparación remite aquí allí donde aparece una pastilla de fidelidad.",
    botsRibbon: "Heurística",
    botsTitle: "The Clockwork Club",
    botsBody1: "Las sillas vacías las ocupan jugadores mecánicos. El ",
    botsBody2: " construye barato y vende tarde; el ",
    botsBody3: " desarrolla, conecta y vende a un ritmo ajustado; el ",
    botsBody4:
      " pide prestado con audacia y se te adelanta ante los mercaderes. Juegan por apetito y por costumbre, no por búsqueda profunda — dignos compañeros de entrenamiento, aún no genios.",
  },
  approximations: {
    supplyCore: {
      area: "Núcleo de abastecimiento y recuento",
      note: "Tamaño de los mazos, 10/9/8 rondas por era, orden de turno según el dinero gastado, pista de ingresos de 100 casillas, precios del mercado, minas que venden al mercado, sobreconstrucción, ventas múltiples, doble vía y los dos recuentos siguen el reglamento.",
    },
    industryValues: {
      area: "Elecciones automáticas",
      note: "Donde las reglas te dejan elegir, el motor decide por ti: la mina más cercana, y luego la mejor surtida, cuando dos pueden servir; el barril del mercader antes que tu propia cerveza; la primera carta cuando pasas o pides prestado, las losetas más baratas para cubrir una paga negativa.",
    },
    map: {
      area: "El mapa de los Midlands",
      note: "El tablero lleva la geografía impresa: veinte ciudades, dos cervecerías de granja, cinco mercaderes y treinta y nueve rutas, casilla por casilla.",
    },
    deck: {
      area: "Losetas de mercader",
      note: "Las nueve losetas de mercader se reparten al azar como vienen impresas; las dos losetas añadidas a 3 y 4 jugadores siguen el manifiesto publicado más habitual (cerámica + manufactura, y luego cualquier bien + algodón).",
    },
    bots: {
      area: "The Clockwork Club (bots)",
      note: "Capataz, Industrial y Magnate son heurísticas de apetitos distintos — no rivales de búsqueda profunda.",
    },
    multiplayer: {
      area: "Multijugador en línea",
      note: "Las mesas viven en salas: abre una, pasa su código de cuatro glifos, y juega por el cable cuando un servidor responde — o entre dos pestañas del mismo navegador si no.",
    },
  },
  finis: "Finis · pon la mesa y juega",
};
export default es;
