import type { Tongue } from './notions';

/* ------------------------------------------------------------------ */
/* The guide's case, in Spanish. The same plates as the French, the     */
/* same figures, read off brass/game-data.md and the engine.            */
/* ------------------------------------------------------------------ */

export const ES: Tongue = {
  near: 'No encuentro esa pregunta tal cual en las reglas. ¿Querías hablar de:',
  self: 'yo me mi mis tengo puedo'.split(' '),
  define: 'es son sirve sirven explica explicame significa significado definicion funciona'.split(' '),
  where: 'donde adonde'.split(' '),
  alias: {
    q: 'que', k: 'que', xq: 'por que', pq: 'por que', porq: 'por que', xk: 'por que', tb: 'tambien', tmb: 'tambien', d: 'de', x: 'por',
    porfa: '', pls: '', vp: 'pv', lvl: 'nivel',
  },
  stop: (
    'el la los las lo un una unos unas de del al a en y e o u que quien quienes cual cuales cuando como donde adonde por para con sin ' +
    'es son ser soy eres somos fue esta estan este estos estas esto ese esa esos esas eso aquel mi mis tu tus su sus se me te le les nos os ' +
    'yo tu el ella usted ustedes ellos ellas nosotros hay muy mas menos todo todos toda todas no si ya pero porque pues entonces ' +
    'puedo puede puedes pueden podemos poder debo debe debes deben hace hacer hago haces hecho sirve sirven servir significa significado ' +
    'exactamente favor gracias hola ahora aqui alli algo cosa cosas tengo tiene tienes tener quiero quiere querer se sabe saber ' +
    'explica explicar dime decir dice funciona funcionan funcionamiento ejemplo vez veces siempre nunca mucho poco bien mal otra otro otros ' +
    'ademas tambien tan asi jugada jugadas pasa pasaria ocurre sucede cual cuanto cuanta cuantos cuantas qué quién queda faltan faltar'
  ).split(' '),
  cues: {
    whyNot: ['no puedo', 'no puede', 'no puedes', 'no me deja', 'por que no', 'porque no', 'imposible', 'prohibido', 'bloqueado', 'bloqueada', 'no funciona', 'no se puede', 'no me permite', 'rechaza', 'gris'],
    gain: ['gana', 'ganar', 'gano', 'vale', 'valen', 'da', 'dan', 'aporta', 'rinde', 'beneficio', 'puntua', 'recompensa', 'ganancia', 'produce'],
    cost: ['cuesta', 'cuestan', 'coste', 'costo', 'costar', 'precio', 'caro', 'cara', 'pagar', 'pago', 'cuanto cuesta'],
    how: ['como', 'manera', 'forma', 'pasos'],
  },
  notions: {
    coalMine: {
      topic: 'las minas de carbón',
      words: ['mina', 'minas', 'mina carbon', 'minas carbon', 'hullera', 'pozo', 'pozos', 'mineria', 'minero', 'yacimiento', 'vender carbon', 'carbon vendido'],
      what: 'Una mina de carbón produce cubos de carbón: de 2 a 5 según el nivel, colocados sobre la loseta al construirla. Cualquier jugador conectado a tu mina toma de ella su carbón gratis, para construir o tender un ferrocarril. La mina se voltea cuando sale su último cubo —lo tome quien lo tome— y solo entonces sube tus ingresos y puntuará. Si está conectada a un espacio de mercader al construirla, sus cubos van enseguida al mercado del carbón a cambio de dinero.',
      how: 'Necesitas una carta que lo permita (la carta de lugar de la ciudad, la carta de industria carbón para una ciudad de tu red, o un comodín), un espacio libre con el icono de carbón y el dinero, más un hierro en los niveles III y IV. Elige la carta, la acción Construir, el espacio que se ilumina, y confirma.',
      cost: 'Nivel I: 5 £, solo en la era del canal, 2 cubos. Nivel II: 7 £, 3 cubos. Nivel III: 8 £ y 1 hierro, 4 cubos. Nivel IV: 10 £ y 1 hierro, 5 cubos. Tienes siete en tu tapete (una de nivel I, dos de cada otro nivel), y siempre se construye el nivel más bajo que quede.',
      gain: 'Volteada, una mina avanza tus ingresos 4, 7, 6 o 5 casillas (niveles I a IV) y puntúa 1, 2, 3 o 4 PV en cada recuento de era en que siga en pie. Al construirla, también cobra el precio de los cubos enviados al mercado, si está conectada a un mercader. Una mina vaciada por tus rivales te rinde lo mismo que una vaciada por ti.',
    },
    ironWorks: {
      topic: 'las fundiciones',
      words: ['fundicion', 'fundiciones', 'siderurgia', 'siderurgica', 'herreria', 'forja', 'forjas', 'alto horno', 'altos hornos', 'acereria', 'iron works', 'vender hierro', 'hierro vendido'],
      what: 'Una fundición produce hierro: de 4 a 6 barras colocadas sobre la loseta al construirla. Vende al instante al mercado del hierro todo lo que quepa, conectada o no a un mercader, y cobras el precio de cada casilla que llena. El hierro que queda sirve a quien lo necesite, en cualquier parte del tablero, y la fundición se voltea cuando sale su última barra.',
      how: 'Una carta que lo permita (la carta de lugar de la ciudad, una carta de fundición para una ciudad de tu red, o un comodín), un espacio libre con el icono de hierro, el dinero y un carbón conectado a la obra. Elige la carta, Construir, el espacio, y confirma.',
      cost: 'Nivel I: 5 £ y 1 carbón, solo en la era del canal, 4 barras. Nivel II: 7 £ y 1 carbón, 4 barras. Nivel III: 9 £ y 1 carbón, 5 barras. Nivel IV: 12 £ y 1 carbón, 6 barras. Una loseta por nivel, cuatro en total en tu tapete.',
      gain: 'Volteada, una fundición avanza tus ingresos 3, 3, 2 o 1 casilla (niveles I a IV) y puntúa 3, 5, 7 o 9 PV al final de la era. Al construirla, también cobra el precio de las barras enviadas al mercado del hierro.',
    },
    brewery: {
      topic: 'las cervecerías',
      words: ['cerveceria', 'cervecerias', 'cervecero', 'cerveceros', 'destileria', 'malteria', 'fabrica cerveza', 'cerveceria ferrocarril', 'barriles cerveceria'],
      what: 'Una cervecería produce la cerveza que necesitan las ventas y el doble ferrocarril: 1 barril al construirla en la era del canal, 2 en la del ferrocarril, sea cual sea su nivel. Tus propios barriles se beben en cualquier parte, sin conexión; los de un rival, solo si su cervecería está conectada. Se voltea cuando se bebe su último barril, lo beba quien lo beba.',
      how: 'Una carta que lo permita (carta de lugar de la ciudad, carta de cervecería para una ciudad de tu red, o un comodín), un espacio libre con el icono de cervecería, el dinero y un hierro —el hierro no necesita conexión—. Elige la carta, Construir, el espacio, y confirma.',
      cost: 'Nivel I: 5 £ y 1 hierro, solo en la era del canal. Nivel II: 7 £ y 1 hierro. Nivel III: 9 £ y 1 hierro. Nivel IV: 9 £ y 1 hierro, solo en la era del ferrocarril. Siete cervecerías en tu tapete; cada una recibe 1 barril en la era del canal y 2 en la del ferrocarril.',
      gain: 'Volteada, una cervecería avanza tus ingresos 4 casillas (nivel I) o 5 (niveles II a IV) y puntúa 4, 5, 7 o 9 PV. Cada una lleva 2 iconos de enlace, que cuentan para las conexiones que tocan su ciudad.',
    },
    farmBrewery: {
      topic: 'las cervecerías de granja',
      words: ['cerveceria granja', 'cervecerias granja', 'granja', 'granjas', 'granja norte', 'granja sur', 'farm brewery'],
      what: 'Dos espacios aislados, sin nombre de ciudad, que solo aceptan una cervecería. Solo se construye en ellos con una carta de industria cervecería o un comodín de industria, nunca con una carta de lugar ni un comodín de lugar. En el mapa de las Midlands, la granja del norte se conecta con el enlace Cannock–granja; la del sur queda conectada por el propio enlace Kidderminster–Worcester, sin otra loseta.',
    },
    cotton: {
      topic: 'las hilanderías de algodón',
      words: ['hilanderia', 'hilanderias', 'algodon', 'algodonera', 'textil', 'textiles', 'tejido', 'telar', 'hilado', 'cotton'],
      what: 'La hilandería de algodón es una obra: no produce nada, se vende. Una vez construida, espera; la acción Vender la voltea cuando está conectada a un mercader que compra algodón (o «todos los bienes») y bebes 1 cerveza. Solo entonces sube tus ingresos y puntuará. No hay carta de algodón sola: algodón y manufactura comparten cartas dobles.',
      how: 'Para construirla: una carta de lugar de la ciudad, una carta doble algodón/manufactura para una ciudad de tu red, o un comodín, en un espacio con el icono de algodón. Para voltearla después: la acción Vender, un mercader conectado que compre algodón, y 1 cerveza.',
      cost: 'Nivel I: 12 £, solo en la era del canal. Nivel II: 14 £ y 1 carbón. Nivel III: 16 £, 1 carbón y 1 hierro. Nivel IV: 18 £, 1 carbón y 1 hierro. Once hilanderías en tu tapete (3, 2, 3 y 3), y cada una se vende por 1 cerveza.',
      gain: 'Vendida, una hilandería avanza tus ingresos 5, 4, 3 o 2 casillas (niveles I a IV) y puntúa 5, 5, 9 o 12 PV al final de la era. Mientras no se vende, no rinde nada.',
    },
    manufacturer: {
      topic: 'las manufacturas',
      words: ['manufactura', 'manufacturas', 'taller', 'talleres', 'bienes manufacturados', 'mercancia', 'mercancias', 'manufacturer'],
      what: 'La manufactura es una obra, como la hilandería: se voltea con la acción Vender, conectada a un mercader que compre bienes manufacturados (o «todos los bienes»). Es la industria de ocho niveles, con costes y ganancias muy irregulares: cada loseta se lee en tu tapete. Sus cartas son las dobles algodón/manufactura.',
      how: 'Para construirla: una carta de lugar de la ciudad, una carta doble algodón/manufactura para una ciudad de tu red, o un comodín, en un espacio con el icono de manufactura. Para voltearla: la acción Vender, un mercader conectado que compre esos bienes, y la cerveza que pida.',
      cost: 'Los ocho niveles: I, 8 £ y 1 carbón (solo canal); II, 10 £ y 1 hierro; III, 12 £ y 2 carbones; IV, 8 £ y 1 hierro; V, 16 £ y 1 carbón; VI, 20 £; VII, 16 £, 1 carbón y 1 hierro; VIII, 20 £ y 2 hierros. Todas se venden por 1 cerveza, salvo la V, que pide 2.',
      gain: 'Vendida, una manufactura avanza tus ingresos 5, 1, 4, 6, 2, 6, 4 o 1 casilla según el nivel (I a VIII) y puntúa 3, 5, 4, 3, 8, 7, 9 u 11 PV. Los niveles III y VII no tienen icono de enlace.',
    },
    pottery: {
      topic: 'las alfarerías',
      words: ['alfareria', 'alfarerias', 'ceramica', 'ceramicas', 'porcelana', 'loza', 'alfarero', 'alfareros', 'horno', 'bombilla', 'bombillas', 'alfareria gratis'],
      what: 'La alfarería es una obra que se vende como la hilandería, a un mercader que compre cerámica o «todos los bienes». En el mapa de las Midlands solo tiene cuatro ciudades donde construirse: Belper, Coventry, Stoke-on-Trent y Stafford. Los niveles I y III llevan una bombilla: no se desarrollan, hay que construirlos. Y, como excepción, la alfarería I también se construye en la era del ferrocarril.',
      how: 'Una carta de lugar de una ciudad con espacio de alfarería, la carta de alfarería para una ciudad así de tu red, o un comodín; después la acción Vender la voltea, conectada a un mercader que compre cerámica o «todos los bienes».',
      cost: 'Nivel I: 17 £ y 1 hierro. Nivel II: 0 £ y 1 carbón. Nivel III: 22 £ y 2 carbones. Nivel IV: 0 £ y 1 carbón. Nivel V: 24 £ y 2 carbones, solo en la era del ferrocarril. Los niveles I, II y IV se venden por 1 cerveza; III y V, por 2.',
      gain: 'Vendida, una alfarería avanza tus ingresos 5 casillas en los niveles I, III y V, y 1 en los niveles II y IV. Puntúa 10, 1, 11, 1 o 20 PV: la V es la loseta más pesada del juego.',
      whyNot: 'Dos negativas se repiten. Las alfarerías I y III llevan bombilla y no se desarrollan: hay que construirlas para quitarlas del tapete. Y para vender hace falta un mercader conectado que compre cerámica o «todos los bienes»; con dos jugadores, solo la loseta de «todos los bienes» la acepta.',
    },
    works: {
      topic: 'las fábricas',
      words: ['fabrica', 'fabricas'],
      what: 'Una fábrica es una loseta que se vende: hilandería, manufactura o alfarería. No produce nada: construida, espera a que la acción Vender la voltee, conectada por enlaces —tuyos o de otros— a un mercader que compre sus bienes, bebiendo una o dos cervezas. Volteada, sube tus ingresos y puntúa al final de la era. Minas, fundiciones y cervecerías no se venden: se voltean cuando se vacían.',
      how: 'Se construye como cualquier loseta: una carta que lo permita, un espacio libre con su icono, su precio, y el carbón o el hierro que pida su nivel. Para venderla después: la acción Vender, un enlace hasta un mercader que compre sus bienes, y una o dos cervezas según la loseta.',
    },
    coal: {
      topic: 'el carbón',
      words: ['carbon', 'carbones', 'cubo carbon', 'cubos carbon', 'cubo negro', 'cubos negros', 'hulla', 'combustible', 'carbon rival', 'carbon adversario'],
      what: 'El carbón lo piden algunas construcciones y cada ferrocarril. Tiene que llegar a la obra: viene gratis de la mina sin voltear más cercana que esté conectada, sea de quien sea. Si no hay, se compra en el mercado, pero solo si la obra está conectada a un espacio de mercader. Si no, la construcción es imposible.',
      cost: 'Tomado de una mina conectada, el carbón es gratis, incluso de la mina de un rival. En el mercado cuesta de 1 a 7 £ según lo que quede, la casilla más barata primero, y 8 £ con el mercado vacío.',
      whyNot: 'El carbón tiene que estar conectado: ninguna mina sin voltear llega a ese lugar por enlaces, y el lugar tampoco alcanza un espacio de mercader para comprar en el mercado. Un enlace hacia una mina, o hacia un mercader, abre el camino.',
    },
    iron: {
      topic: 'el hierro',
      words: ['hierro', 'hierros', 'barra hierro', 'barras hierro', 'barra', 'barras', 'cubo hierro', 'cubos hierro', 'metal', 'acero', 'mineral', 'lingote', 'lingotes'],
      what: 'El hierro lo piden algunas construcciones y cada loseta desarrollada. No necesita ninguna conexión: se toma gratis de cualquier fundición sin voltear del tablero, sea de quien sea. Si no hay fundición, se compra en el mercado del hierro, también sin conexión.',
      cost: 'Tomado de una fundición, el hierro es gratis, incluso de la de un rival. En el mercado cuesta de 1 a 5 £ según lo que quede, la casilla más barata primero, y 6 £ con el mercado vacío.',
      whyNot: 'El hierro solo falta si no queda en ninguna parte: ninguna fundición sin voltear tiene, y no puedes pagarlo en el mercado (6 £ la barra si está vacío). El hierro nunca pide conexión.',
    },
    beer: {
      topic: 'la cerveza',
      words: ['cerveza', 'cervezas', 'barril', 'barriles', 'tonel', 'toneles', 'jarra', 'lupulo', 'pinta', 'cerveza mercader', 'barril mercader', 'cerveza rival', 'cerveza adversario', 'cerveza propia'],
      what: 'La cerveza se bebe para vender (1 o 2 barriles por loseta) y para el doble ferrocarril. Tres fuentes, barril a barril: tus cervecerías sin voltear, en cualquier parte y sin conexión; la cervecería de un rival, solo si está conectada a la loseta vendida; o el barril junto al mercader al que vendes, que además da su bonificación. El doble ferrocarril nunca bebe la cerveza de un mercader.',
      whyNot: 'Sin la cerveza pedida, la venta se rechaza. Tus cervecerías deben tener aún barriles; la de un rival solo sirve si está conectada a la loseta vendida; y el barril de un mercader solo sirve a quien vende a ese mismo mercader, una vez por era.',
      cost: 'La cerveza no se compra: se bebe gratis, de tus cervecerías, de la de un rival conectada a la loseta vendida, o en el mercader. Lo que cuesta es la cervecería que hubo que construir.',
    },
    market: {
      topic: 'el mercado del carbón y del hierro',
      words: ['mercado', 'mercados', 'mercado carbon', 'mercado hierro', 'precio carbon', 'precio hierro', 'comprar carbon', 'comprar hierro', 'bolsa', 'mercado vacio'],
      what: 'Dos mercados al borde del tablero: 14 casillas de carbón, dos a cada precio de 1 a 7 £, y 10 de hierro, dos a cada precio de 1 a 5 £. Siempre se compra primero la casilla más barata; vacío, el mercado sigue vendiendo, a 8 £ el carbón y 6 £ el hierro. Nunca se repone solo: solo las minas y fundiciones que se construyen venden allí sus cubos, llenando primero las casillas más caras.',
      cost: 'El precio depende de lo que quede: la casilla más barata aún llena, de 1 a 7 £ el carbón, de 1 a 5 £ el hierro, y luego 8 £ y 6 £ cuando se agota. Comprar carbón exige estar conectado a un espacio de mercader; el hierro, no. Con el ajuste estándar, la partida empieza con 13 carbones y 8 hierros.',
      gain: 'Cuando construyes una mina conectada a un mercader, o cualquier fundición, los cubos que caben en el mercado van allí y cobras el precio impreso de cada casilla llenada, las más caras primero. Es la única manera de vender al mercado, y solo ocurre al construir.',
      whyNot: 'El carbón del mercado solo llega a lugares conectados a un espacio de mercader, cualquiera de los cinco. El hierro se compra sin condición; si te lo niegan, falta el dinero.',
    },
    build: {
      topic: 'la acción Construir',
      words: ['construir', 'construye', 'construyo', 'construccion', 'construcciones', 'edificar', 'levantar', 'colocar loseta', 'poner loseta', 'build', 'industria', 'industrias', 'espacio gris', 'loseta gris'],
      what: 'Construir coloca una loseta de industria en un espacio libre: descarta una carta que lo permita, paga la loseta en dinero y recursos, y toma siempre la loseta de nivel más bajo de esa industria en tu tapete. Una carta de lugar construye en su ciudad, incluso fuera de tu red; una carta de industria construye esa industria en una ciudad de tu red. En la era del canal, solo una de tus losetas por lugar.',
      how: 'Elige una carta de tu mano y la acción Construir: los espacios posibles se iluminan en el mapa. Haz clic en el que quieras, lee la nota (precio, carbón y hierro, y de dónde vienen) y confirma. Si el espacio admite dos industrias, otro clic pasa de una a otra.',
      cost: 'El precio es el de la loseta más baja que queda en tu tapete: dinero y a veces carbón y hierro. El carbón de una mina conectada y el hierro de una fundición son gratis; los del mercado se pagan al precio de la casilla. El tapete (tecla P) muestra el coste de cada siguiente loseta.',
      whyNot: 'Las negativas más comunes: la carta no nombra ni esa ciudad ni esa industria, o la ciudad no está en tu red; el espacio no tiene el icono o está ocupado; ya tienes una loseta en ese lugar (era del canal); la siguiente loseta de tu tapete no es de esta era; el carbón no llega a la obra; o falta dinero. Haz clic en el espacio: la mesa te da su motivo.',
    },
    network: {
      topic: 'la acción Red',
      words: ['red', 'redes', 'mi red', 'accion red', 'tender enlace', 'poner enlace', 'poner canal', 'construir canal', 'poner ferrocarril', 'construir ferrocarril', 'construir enlace', 'conectar', 'ampliar red', 'network'],
      what: 'La acción Red coloca una loseta de enlace en una ruta libre que toque tu red: un canal en la era del canal, un ferrocarril en la del ferrocarril. Tu red son los lugares donde tienes una loseta y los que tocan tus enlaces; ahí pueden construir tus cartas de industria. Mientras no tengas nada en el tablero, tu primer enlace puede ir a cualquier parte.',
      how: 'Elige una carta (cualquiera), la acción Red y luego una ruta que se ilumine en el mapa, y confirma. En la era del ferrocarril puedes tender un segundo ferrocarril en la misma acción.',
      cost: 'En la era del canal: 3 £ el canal, uno por acción. En la del ferrocarril: 5 £ y 1 carbón cada tramo, o dos en la misma acción por 15 £, 1 carbón cada uno y 1 cerveza de una cervecería. El carbón de un ferrocarril debe estar conectado al enlace una vez colocado.',
      whyNot: 'La ruta debe estar libre y tocar tu red: una ruta solo admite un enlace. En la era del canal, las rutas solo de ferrocarril están cerradas; en la del ferrocarril, también la ruta Burton–Walsall, solo de canal. Un ferrocarril pide además un carbón conectado al enlace, el doble ferrocarril una cerveza de cervecería, y hace falta el dinero.',
    },
    develop: {
      topic: 'la acción Desarrollar',
      words: ['desarrollar', 'desarrollo', 'desarrollos', 'desarrolla', 'quitar loseta', 'quitar losetas', 'saltar nivel', 'saltar niveles', 'mejorar', 'mejora', 'develop'],
      what: 'Desarrollar retira una o dos losetas de tu tapete sin construirlas, para llegar antes a los niveles altos. Cada loseta retirada es la más baja de su columna y cuesta 1 hierro; vuelve a la caja y no rinde nada. Las alfarerías con bombilla (niveles I y III) no se pueden desarrollar.',
      how: 'Elige una carta, la acción Desarrollar y luego la loseta o losetas que quitas: una o dos, de la misma industria o de dos distintas. La nota indica de dónde viene el hierro; confirma.',
      cost: 'Una carta, y 1 hierro por loseta retirada: gratis de cualquier fundición, o comprado en el mercado del hierro (de 1 a 5 £, 6 £ si está vacío). Nada más: dos losetas en la misma acción cuestan dos hierros.',
      gain: 'Desarrollar no rinde nada en el acto: ni dinero, ni ingresos, ni puntos. Lo que cambia es la siguiente loseta de la columna, que será de un nivel más alto.',
      whyNot: 'Hace falta hierro: una fundición sin voltear en alguna parte, o el dinero para comprarlo en el mercado. La loseta debe ser desarrollable —las alfarerías I y III, con bombilla, no lo son— y debe quedar una loseta en la columna.',
    },
    sell: {
      topic: 'la acción Vender',
      words: ['vender', 'vendo', 'vende', 'venta', 'ventas', 'vendido', 'vendida', 'comerciar', 'comercio', 'entregar', 'sell'],
      what: 'Vender voltea tus obras: hilanderías, manufacturas, alfarerías. Descarta cualquier carta, elige una loseta sin voltear conectada a un mercader que compre esos bienes, y bebe la cerveza que pida. La loseta se voltea: tus ingresos suben al momento, sus puntos llegan al final de la era. Una misma acción puede vender varias losetas, mientras alcance la cerveza.',
      how: 'Elige una carta, la acción Vender y luego la loseta que vendes: la mesa propone los mercaderes a tu alcance y la cerveza disponible. Añade otras losetas si quieres, y confirma.',
      gain: 'Cada loseta vendida avanza tus ingresos las casillas impresas en ella y puntuará al final de la era. Beber el barril del mercader añade su bonificación. La venta en sí no paga dinero.',
      cost: 'Una carta, cualquiera, y la cerveza de cada loseta vendida: 1 barril casi siempre, 2 para la manufactura V y las alfarerías III y V. Nada de dinero.',
      whyNot: 'Para vender, la loseta debe ser una obra sin voltear (minas, fundiciones y cervecerías no se venden: se vacían), conectada por enlaces a un mercader que compre ese bien; una loseta de mercader en blanco no compra nada. También hace falta la cerveza: tus cervecerías, una cervecería rival conectada, o el barril del mercader.',
    },
    loan: {
      topic: 'los préstamos',
      words: ['prestamo', 'prestamos', 'pedir prestado', 'credito', 'creditos', 'banco', 'banquero', 'deuda', 'deudas', 'devolver', 'reembolsar', 'reembolso', 'endeudarse', 'loan'],
      what: 'Pedir un préstamo es una acción: descarta una carta, recibe 30 £, y tus ingresos bajan 3 niveles (no 3 casillas), en la casilla más alta del nuevo nivel. Un préstamo nunca se devuelve: su precio son los ingresos perdidos en cada cobro hasta el final. Imposible si tus ingresos bajaran del nivel −10.',
      how: 'Elige una carta, la acción Préstamo y confirma: las 30 £ llegan al momento, y el marcador de ingresos muestra dónde cae.',
      cost: 'Un préstamo da 30 £ y cuesta 3 niveles de ingresos, es decir, en cada cobro restante lo que esos tres niveles habrían pagado. No se devuelve: las 30 £ nunca se reembolsan, ni durante la partida ni al final.',
      whyNot: 'Un préstamo baja tus ingresos 3 niveles, y los ingresos nunca bajan de −10. Si tu marcador ya está en el nivel −8 o más abajo, el banco se niega.',
    },
    scout: {
      topic: 'explorar',
      words: ['explorar', 'exploracion', 'explora', 'exploro', 'scout', 'reconocimiento', 'dos comodines', 'explorador'],
      what: 'Explorar te da los dos comodines de golpe: descarta tres cartas (la de la acción y dos más) y toma un comodín de lugar y un comodín de industria. Está prohibido si ya tienes un comodín en la mano. Los comodines descartados vuelven a su montón, que tiene cuatro de cada clase.',
      how: 'Elige una carta, la acción Explorar y luego otras dos cartas que descartar; confirma, y los dos comodines entran en tu mano.',
      cost: 'Tres cartas de tu mano y nada más: sin dinero. Recuperas dos, los comodines, así que tu mano queda con una carta menos.',
      whyNot: 'Tres motivos posibles: ya tienes un comodín, te faltan cartas (hay que descartar tres), o uno de los dos montones de comodines está vacío.',
    },
    pass: {
      topic: 'pasar',
      words: ['pasar', 'paso turno', 'saltar turno', 'no hacer nada', 'ninguna accion'],
      what: 'Pasar es descartar una carta sin hacer nada: la acción se pierde, pero la carta se va igual. Puedes pasar una acción o las dos. No cuesta dinero, y lo que no se gasta cuenta para el orden de la ronda siguiente.',
      cost: 'Pasar cuesta una carta por acción pasada, y nada más.',
    },
    canal: {
      topic: 'la era del canal',
      words: ['canal', 'canales', 'era canal', 'barcaza', 'barcazas', 'esclusa', 'esclusas', 'via navegable', 'doble canal'],
      what: 'La era del canal es la primera de las dos. Solo se tienden canales (3 £, uno por acción), solo una de tus losetas por lugar, y las losetas de nivel 1 se pueden construir. La primerísima ronda da una sola acción a cada jugador. Al final, enlaces y losetas volteadas puntúan, y después canales y losetas de nivel 1 salen del tablero.',
      cost: 'Un canal cuesta 3 £, sin carbón, y un enlace por acción: no existe el doble canal.',
      whyNot: 'En la era del canal, un enlace por acción y solo en rutas abiertas al canal; las rutas solo de ferrocarril siguen cerradas. Hacen falta 3 £ y una ruta libre que toque tu red.',
      short: {
        what: 'La era del canal es toda la partida de iniciación. Solo se tienden canales (3 £, uno por acción), solo una de tus losetas por lugar, y las losetas de nivel 1 se pueden construir. La primerísima ronda da una sola acción a cada jugador. Al final, enlaces y losetas volteadas puntúan y nada sale del tablero: sigue el cierre.',
      },
    },
    rail: {
      topic: 'la era del ferrocarril',
      words: ['ferrocarril', 'ferrocarriles', 'rail', 'rieles', 'via ferrea', 'vias', 'era ferrocarril', 'tren', 'trenes', 'locomotora', 'locomotoras', 'doble ferrocarril', 'dos ferrocarriles'],
      what: 'La era del ferrocarril es la segunda y última. Se tienden ferrocarriles: 5 £ y 1 carbón cada uno, o dos en la misma acción por 15 £, 2 carbones y 1 cerveza de cervecería. Las losetas de nivel 1 (salvo la alfarería I) ya no se construyen, las cervecerías reciben 2 barriles, y varias de tus losetas pueden compartir lugar. El recuento final sigue a su última ronda.',
      cost: 'Un ferrocarril: 5 £ y 1 carbón, conectado al enlace una vez colocado. Dos en la misma acción: 15 £, 1 carbón por cada uno, y 1 cerveza de una cervecería, nunca del barril de un mercader.',
      whyNot: 'En la era del canal el ferrocarril aún no existe: llega con la segunda era. En la del ferrocarril, un tramo pide una ruta libre que toque tu red, 5 £, y un carbón conectado al enlace colocado: una mina conectada, o el mercado a través de un mercader.',
      short: {
        what: 'La partida de iniciación no llega a ella: termina al final de la era del canal, y nunca se tiende un ferrocarril. En una partida completa, la era del ferrocarril sigue a la del canal; allí se tienden ferrocarriles, 5 £ y 1 carbón cada uno.',
        whyNot: 'La partida de iniciación solo juega la era del canal: solo se tienden canales, nunca ferrocarriles.',
      },
    },
    links: {
      topic: 'los enlaces',
      words: ['enlace', 'enlaces', 'conexion', 'conexiones', 'conectado', 'conectada', 'loseta enlace', 'ruta', 'rutas', 'link', 'icono enlace', 'enlace puntos', 'enlaces puntos'],
      what: 'Un enlace es un canal o un ferrocarril colocado en una ruta entre dos lugares. Amplía tu red y conecta los lugares para todos: el carbón, la cerveza de un rival y las ventas a los mercaderes circulan por los enlaces de cualquiera. Al final de la era, cada uno puntúa 1 por icono de enlace de los lugares que toca, 2 por un mercader, y luego sale del tablero.',
      gain: 'Al final de cada era, un enlace puntúa los iconos de enlace de cada loseta de los lugares que conecta —de 0 a 2 por loseta, sea de quien sea, volteada o no— y 2 puntos por un espacio de mercader. Después se retira.',
      cost: 'Un canal cuesta 3 £. Un ferrocarril, 5 £ y 1 carbón; dos en la misma acción, 15 £, 2 carbones y 1 cerveza de cervecería.',
      short: {
        what: 'Un enlace es un canal colocado en una ruta entre dos lugares. Amplía tu red y conecta los lugares para todos: el carbón, la cerveza de un rival y las ventas a los mercaderes circulan por los enlaces de cualquiera. Al final de la era, cada uno puntúa 1 por icono de enlace de los lugares que toca, 2 por un mercader, y se queda en el tablero.',
        gain: 'Al final de la era, un enlace puntúa los iconos de enlace de cada loseta de los lugares que conecta —de 0 a 2 por loseta, sea de quien sea, volteada o no— y 2 puntos por un espacio de mercader. Ese recuento llega una sola vez: el cierre no vuelve a contar los enlaces.',
      },
    },
    eras: {
      topic: 'las eras y las rondas',
      words: ['era', 'eras', 'epoca', 'epocas', 'ronda', 'rondas', 'periodo', 'duracion', 'cuanto dura', 'numero rondas', 'fin ronda'],
      what: 'Una partida tiene dos eras: la del canal y luego la del ferrocarril. Cada una dura 8 rondas con 4 jugadores, 9 con 3 y 10 con 2: termina cuando el mazo y todas las manos están vacíos. En cada ronda, cada uno juega un turno de dos acciones (solo una en la primerísima), y luego llegan el nuevo orden de turno y el cobro.',
      short: {
        what: 'La partida de iniciación solo juega la era del canal: 10 rondas con 2 jugadores, 9 con 3, 8 con 4; termina cuando el mazo y todas las manos están vacíos. En cada ronda, cada uno juega un turno de dos acciones (solo una en la primerísima), y luego llegan el nuevo orden de turno y el cobro, salvo tras la última, a la que sigue el cierre.',
      },
    },
    firstRound: {
      topic: 'la primera ronda',
      words: ['primera ronda', 'primer turno', 'inicio partida', 'inicio', 'empezar', 'comenzar', 'primera jugada', 'una accion', 'primera accion', 'primera loseta', 'principio'],
      what: 'En la primerísima ronda de la era del canal, cada jugador hace una sola acción en lugar de dos, y el orden de ese primer turno se sortea. Todos empiezan con 17 £, ingresos en el nivel 0 y ocho cartas en la mano. Mientras no tengas losetas en el tablero, una carta de industria construye en cualquier parte, y tu primer enlace puede ir a cualquier sitio.',
    },
    eraEnd: {
      topic: 'el final de una era',
      words: ['fin era', 'final era', 'fin canal', 'final canal', 'transicion', 'entre eras', 'cambio era', 'barrido', 'nueva era', 'losetas nivel 1', 'losetas desaparecen', 'losetas desaparecido', 'canales desaparecen', 'enlaces retirados'],
      what: 'Cuando el mazo y las manos están vacíos, la era termina: cada enlace puntúa, cada loseta volteada puntúa, y todos los enlaces salen del tablero. Tras la era del canal, además, las losetas de nivel 1 se retiran del tablero, los barriles de los mercaderes se reponen y todos los descartes se barajan en un mazo nuevo de ocho cartas por jugador. Dinero, ingresos, puntos y losetas de nivel 2 o más se quedan.',
    },
    scoring: {
      topic: 'el recuento',
      words: ['recuento', 'recuentos', 'contar puntos', 'calculo puntos', 'calcular puntos', 'puntuacion final', 'conteo', 'puntuar', 'scoring'],
      what: 'El recuento llega al final de cada era. Primero los enlaces: cada uno puntúa 1 por icono de enlace de los lugares que toca (las losetas de todos, 2 por un mercader). Luego cada loseta volteada puntúa el número impreso abajo; una loseta nunca volteada no puntúa. Las losetas de nivel 2 o más siguen en la era del ferrocarril y puntúan otra vez si siguen allí.',
    },
    ties: {
      topic: 'los empates',
      words: ['empate', 'empates', 'empatados', 'desempate', 'desempatar', 'igualdad', 'mismos puntos', 'iguales'],
      what: 'Con igualdad de puntos al final, gana el nivel de ingresos más alto, y después el dinero en caja. Para el orden de turno, un empate en lo gastado mantiene el orden relativo de la ronda anterior.',
    },
    gameEnd: {
      topic: 'el final de la partida',
      words: ['fin partida', 'final partida', 'fin juego', 'ganar', 'gana', 'ganador', 'ganadora', 'victoria', 'terminar partida', 'ultima ronda', 'final', 'acaba', 'gano', 'gane'],
      what: 'La partida termina tras el recuento de la era del ferrocarril, y gana quien tenga más puntos de victoria. La última ronda de la partida no tiene cobro. En caso de empate, decide el nivel de ingresos más alto, y luego el dinero en caja.',
      how: 'Se gana con más puntos al final de la era del ferrocarril. Los puntos vienen de las losetas volteadas y de los enlaces, contados en el recuento de cada era, y de algunas bonificaciones de mercader; la bancarrota resta.',
    },
    initiation: {
      topic: 'la partida de iniciación',
      words: ['iniciacion', 'partida iniciacion', 'partida corta', 'corta', 'solo canal', 'partida rapida', 'introductoria', 'primera partida', 'tutorial'],
      what: 'La partida de iniciación solo juega la era del canal: 10 rondas con 2 jugadores, 9 con 3, 8 con 4, y sin cobro tras la última. Al terminar, nada sale del tablero: cada enlace puntúa 1 por icono de enlace de los lugares que toca (2 por un mercader), cada loseta volteada, el número impreso abajo; una loseta nunca volteada no puntúa. El cierre suma luego 1 punto por cada 4 £ (15 como mucho), tantos puntos como el nivel de ingresos (restados si es negativo), y las losetas volteadas de nivel 2 o más puntúan por segunda vez.',
      how: 'Se gana con más puntos tras el cierre. Vienen de los enlaces y las losetas volteadas, contados al final de la era del canal, de algunas bonificaciones de mercader, y luego del cierre: el dinero (1 punto por cada 4 £, 15 como mucho), el nivel de ingresos y, por segunda vez, las losetas volteadas de nivel 2 o más. En caso de empate, decide el nivel de ingresos más alto, y luego el dinero en caja.',
    },
    merchants: {
      topic: 'los mercaderes y sus bonificaciones',
      words: ['mercader', 'mercaderes', 'comerciante', 'comerciantes', 'bonificacion mercader', 'bonificacion', 'bonus', 'comprador', 'compradores', 'shrewsbury', 'warrington', 'nottingham', 'gloucester', 'oxford', 'loseta mercader', 'todos bienes', 'mercader blanco'],
      what: 'Los mercaderes, al borde del mapa, compran tus obras: cada loseta de mercader muestra lo que acepta (algodón, manufactura, cerámica, «todos los bienes», o nada si está en blanco). Para vender, tu loseta debe estar conectada a uno. Cada loseta no blanca tiene un barril de cerveza, y beberlo al vender da la bonificación del lugar. Un espacio de mercader cuenta además 2 iconos de enlace y abre el mercado del carbón a quien esté conectado.',
      gain: 'En el mapa de las Midlands: Shrewsbury da 4 PV, Warrington 5 £, Nottingham 3 PV, Gloucester un desarrollo gratis (sin hierro) y Oxford 2 casillas de ingresos. La bonificación llega con el barril bebido en una venta, uno por loseta de mercader y por era; los barriles vuelven al empezar la era del ferrocarril.',
      short: {
        gain: 'En el mapa de las Midlands: Shrewsbury da 4 PV, Warrington 5 £, Nottingham 3 PV, Gloucester un desarrollo gratis (sin hierro) y Oxford 2 casillas de ingresos. La bonificación llega con el barril bebido en una venta: un barril por loseta de mercader, para toda la partida de iniciación.',
      },
    },
    income: {
      topic: 'los ingresos y su marcador',
      words: ['ingresos', 'ingreso', 'marcador ingresos', 'nivel ingresos', 'cobro', 'cobrar', 'sueldo', 'renta', 'progreso', 'pista progreso', 'subir ingresos', 'casillas ingresos'],
      what: 'Los ingresos son el dinero que cobras al final de cada ronda. El marcador tiene 100 casillas, y cada una muestra un nivel de −10 a 30: empiezas en el nivel 0. Voltear una loseta avanza tu marcador las casillas impresas —las casillas se estrechan al subir— y un préstamo lo baja 3 niveles. Unos ingresos negativos se pagan al banco.',
      how: 'Los ingresos solo suben con losetas volteadas —una obra vendida, una mina, fundición o cervecería vaciada— y con la bonificación de Oxford (2 casillas). Solo bajan con el préstamo (3 niveles). El cobro llega al final de cada ronda, salvo la última de la partida.',
      gain: 'Al final de cada ronda cobras tantas libras como tu nivel de ingresos, o las pagas si es negativo. La última ronda de la partida no tiene cobro.',
      whyNot: 'La cifra de una loseta volteada cuenta casillas de la pista, no libras: tu marcador avanza esas casillas, y el cobro solo sube cuando cruza el límite de un nivel. Hasta la casilla 10 cada casilla es un nivel; después un nivel ocupa 2 casillas, luego 3 desde la casilla 31 y 4 desde la 61. Así, una loseta de +2 puede dejar el cobro igual si el marcador se queda en el mismo nivel. Pasa el puntero por la pista de ingresos: cada peldaño muestra sus casillas, y cada peón cuántas le faltan para el siguiente.',
    },
    shortfall: {
      topic: 'la bancarrota',
      words: ['bancarrota', 'quiebra', 'arruinado', 'ruina', 'insolvente', 'sin dinero', 'dinero negativo', 'ingresos negativos', 'falta dinero', 'eliminado', 'deber banco'],
      what: 'Nadie queda eliminado. Si el cobro es negativo y tu caja no alcanza, retiras del tablero losetas de industria tuyas (nunca enlaces), cada una por la mitad de su coste redondeada hacia abajo; la mesa quita primero las más baratas. Si aún falta dinero, pierdes 1 punto de victoria por libra que falte. Nunca se malvende una loseta por otro motivo.',
    },
    money: {
      topic: 'el dinero',
      words: ['dinero', 'libra', 'libras', 'plata', 'pasta', 'monedas', 'moneda', 'caja', 'efectivo', 'fondos', 'dinero inicial', 'ganar dinero', 'conseguir dinero'],
      what: 'Todos empiezan con 17 £. El dinero entra con el cobro de fin de ronda, los préstamos (30 £), los cubos que tus minas y fundiciones venden al mercado y la bonificación de Warrington. Se gasta en losetas, enlaces y compras en el mercado, y lo que gastas en una ronda fija tu puesto en el orden siguiente. Pasa de una era a otra y solo desempata en último lugar.',
      short: {
        what: 'Todos empiezan con 17 £. El dinero entra con el cobro de fin de ronda, los préstamos (30 £), los cubos que tus minas y fundiciones venden al mercado y la bonificación de Warrington. Se gasta en losetas, enlaces y compras en el mercado, y lo que gastas en una ronda fija tu puesto en el orden siguiente. Al cierre de la partida de iniciación, cada 4 £ en caja valen 1 punto, 15 como mucho.',
      },
    },
    turnOrder: {
      topic: 'el orden de turno',
      words: ['orden turno', 'orden', 'primer jugador', 'juega primero', 'empieza primero', 'ultimo jugador', 'dinero gastado', 'gastado', 'gasto', 'gastos', 'gastar', 'loseta personaje', 'personaje', 'juega ultimo', 'empieza', 'quien empieza'],
      what: 'Al final de cada ronda, el orden se rehace según el dinero gastado en esa ronda: quien menos gastó juega primero, quien más gastó juega el último. En caso de empate, se mantiene el orden relativo de la ronda anterior. Todo cuenta —losetas, enlaces, compras en el mercado—, pero no el dinero recibido.',
    },
    actions: {
      topic: 'las acciones del turno',
      words: ['accion', 'acciones', 'dos acciones', 'numero acciones', 'acciones turno', 'mi turno', 'turno', 'turnos', 'misma accion', 'dos veces'],
      what: 'En tu turno juegas dos acciones, solo una en la primerísima ronda de la era del canal. Hay seis, más pasar: Construir, Red, Desarrollar, Vender, Préstamo y Explorar. Cada una cuesta una carta descartada, y se puede repetir la misma.',
    },
    flip: {
      topic: 'las losetas volteadas',
      words: ['voltear', 'volteada', 'volteadas', 'voltea', 'girar', 'girada', 'dar vuelta', 'reverso', 'loseta volteada', 'sin voltear', 'flip'],
      what: 'Una loseta se voltea cuando ha hecho su trabajo: una mina o fundición cuando sale su último cubo, una cervecería cuando se bebe su último barril —lo haga quien lo haga— y una obra cuando la vendes. Volteada, avanza enseguida tus ingresos las casillas impresas, y sus puntos cuentan en cada recuento de era en que siga en pie. Una loseta nunca volteada no puntúa.',
      how: 'Minas, fundiciones y cervecerías se voltean cuando se acaban sus cubos o barriles, los tome quien los tome. Hilanderías, manufacturas y alfarerías solo se voltean con la acción Vender.',
      gain: 'Volteada, una loseta avanza enseguida tus ingresos las casillas impresas, y sus puntos de victoria cuentan en el recuento de la era. Sin voltear, no puntúa.',
    },
    levels: {
      topic: 'los niveles de las losetas',
      words: ['nivel', 'niveles', 'nivel 1', 'nivel superior', 'loseta mas baja', 'numero romano', 'icono canal', 'icono ferrocarril', 'columna'],
      what: 'Cada industria se apila en tu tapete del nivel más bajo al más alto, y siempre se toma la loseta más baja que quede, para construir o para desarrollar. Más arriba, una loseta suele costar más, y puntúa más. Un icono de canal marca las losetas que no se construyen en la era del ferrocarril (los niveles 1, salvo la alfarería I); un icono de ferrocarril, las que solo se construyen en ella (cervecería IV, alfarería V).',
    },
    overbuild: {
      topic: 'sobreconstruir',
      words: ['sobreconstruir', 'sobreconstruccion', 'construir encima', 'reemplazar loseta', 'sustituir loseta', 'reconstruir', 'encima', 'overbuild'],
      what: 'Sobreconstruir es construir una loseta de la misma industria y de nivel superior sobre una loseta ya colocada. Sobre tus propias losetas, es libre. Sobre la de un rival, solo una mina o una fundición, y solo cuando no quede ni un cubo de ese recurso en el tablero ni en el mercado. La loseta reemplazada sale del juego, pero los ingresos y puntos que ya dio se conservan.',
      whyNot: 'Hace falta la misma industria y un nivel estrictamente superior. Sobre una loseta rival, solo se reemplazan la mina y la fundición, y solo cuando ese carbón o ese hierro se ha agotado en todas partes, mercado incluido. En la era del canal sigues pudiendo tener una sola loseta por lugar.',
    },
    mat: {
      topic: 'el tapete del jugador',
      words: ['tapete', 'tablero jugador', 'tablero personal', 'pila', 'pilas', 'mis losetas', 'losetas restantes', 'cuantas losetas'],
      what: 'El tapete lleva tus 45 losetas de industria, apiladas por industria del nivel más bajo al más alto: 11 hilanderías, 11 manufacturas, 7 cervecerías, 7 minas, 5 alfarerías y 4 fundiciones. Para cada siguiente loseta muestra su coste, lo que rinde y sus límites de era. La tecla P lo abre; 1 a 4 cambian de jugador.',
    },
    towns: {
      topic: 'las ciudades y los espacios',
      words: ['ciudad', 'ciudades', 'pueblo', 'espacio', 'espacios', 'casilla industria', 'lugar', 'lugares', 'icono espacio', 'una loseta por lugar', 'dos losetas misma ciudad'],
      what: 'El mapa de las Midlands tiene 20 ciudades, dos cervecerías de granja y cinco espacios de mercader. Cada ciudad tiene de dos a cuatro espacios, y cada uno muestra las industrias que acepta, uno o dos iconos. En la era del canal solo puedes tener una loseta por lugar; en la del ferrocarril, varias.',
    },
    vp: {
      topic: 'los puntos de victoria',
      words: ['puntos', 'punto', 'pv', 'puntos victoria', 'punto victoria', 'puntuacion', 'marcador puntos', 'pista puntos'],
      what: 'Los puntos de victoria deciden la partida. Se ganan en el recuento de cada era: los enlaces (1 punto por icono de enlace de los lugares tocados, 2 por un mercader) y las losetas volteadas (el número impreso). Se suman las bonificaciones de Shrewsbury y Nottingham; la bancarrota resta. El marcador da la vuelta en 100.',
      gain: 'Los puntos vienen de las losetas volteadas (el número de abajo de la loseta, en cada recuento en que siga en pie), de los enlaces (los iconos de enlace de los lugares que tocan, 2 por mercader) y de las bonificaciones de Shrewsbury (4) y Nottingham (3).',
      short: {
        what: 'Los puntos de victoria deciden la partida. Se ganan al final de la era del canal: los enlaces (1 punto por icono de enlace de los lugares tocados, 2 por un mercader) y las losetas volteadas (el número impreso). Se suman las bonificaciones de Shrewsbury y Nottingham; la bancarrota resta. Luego el cierre de la partida de iniciación suma 1 punto por cada 4 £ (15 como mucho), el nivel de ingresos (restado si es negativo) y, por segunda vez, las losetas volteadas de nivel 2 o más.',
        gain: 'Los puntos vienen de las losetas volteadas (el número de abajo de la loseta) y de los enlaces (los iconos de enlace de los lugares que tocan, 2 por mercader), contados al final de la era del canal, y de las bonificaciones de Shrewsbury (4) y Nottingham (3). El cierre suma luego 1 punto por cada 4 £ (15 como mucho), el nivel de ingresos y, por segunda vez, las losetas volteadas de nivel 2 o más.',
      },
    },
    cards: {
      topic: 'las cartas',
      words: ['carta', 'cartas', 'carta lugar', 'cartas lugar', 'carta ciudad', 'carta industria', 'cartas industria', 'carta doble', 'que carta'],
      what: 'Cada acción se paga con una carta descartada. Una carta de lugar construye cualquier industria en la ciudad que nombra, incluso fuera de tu red; una carta de industria construye esa industria en una ciudad de tu red, y en cualquier parte mientras no tengas nada en el tablero. Hilanderías y manufacturas comparten cartas dobles. Para las demás acciones sirve cualquier carta.',
      whyNot: 'Una carta de lugar solo construye en la ciudad que nombra; una carta de industria solo su industria, y solo en una ciudad de tu red; ninguna carta de lugar ni comodín de lugar construye en una cervecería de granja. Para Red, Desarrollar, Vender, Préstamo o pasar vale cualquier carta: si la acción se rechaza, el motivo está en otra parte.',
    },
    wild: {
      topic: 'los comodines',
      words: ['comodin', 'comodines', 'carta comodin', 'comodin lugar', 'comodin industria', 'joker', 'wild', 'monton comodines'],
      what: 'Un comodín de lugar vale por cualquier carta de lugar, salvo para las dos cervecerías de granja; un comodín de industria vale por cualquier carta de industria. Solo se obtienen explorando, los dos a la vez, y nunca si ya tienes uno. Descartados, vuelven a su montón en lugar de al descarte.',
    },
    hand: {
      topic: 'la mano y el mazo',
      words: ['mano', 'mi mano', 'manos', 'mazo', 'baraja', 'robar', 'descarte', 'descartar', 'reponer mano', 'robar carta', 'ocho cartas', 'mazo vacio', 'cartas mano'],
      what: 'Tienes ocho cartas. Cada acción descarta una, y al final de tu turno robas hasta volver a tener ocho. Cuando el mazo se agota, las manos menguan ronda a ronda, y la era termina cuando todas las manos están vacías. El mazo tiene 40 cartas con 2 jugadores, 54 con 3 y 64 con 4, sin contar los comodines.',
    },
    players: {
      topic: 'el número de jugadores',
      words: ['jugadores', 'numero jugadores', 'dos jugadores', 'tres jugadores', 'cuatro jugadores', '2 jugadores', '3 jugadores', '4 jugadores', 'solitario', 'rivales', 'cuantos jugadores', 'jugador'],
      what: 'Juegan de 2 a 4. El número cambia el mazo (40, 54 o 64 cartas: con menos de 4, algunas ciudades pierden sus cartas), los mercaderes abiertos (Warrington desde 3 jugadores, Nottingham con 4) y la duración de las eras: 10 rondas con 2, 9 con 3, 8 con 4. Las ciudades sin carta se pueden seguir construyendo con cartas de industria o comodines.',
    },
    undo: {
      topic: 'deshacer una jugada',
      words: ['deshacer', 'deshago', 'anular', 'volver atras', 'retroceder', 'error', 'equivoque', 'equivocado', 'ctrl z', 'undo'],
      what: 'La tecla Z, o el botón Deshacer, retira tu última jugada mientras el turno siga siendo tuyo: una vez el juego ha pasado a otro jugador, la jugada se queda. Antes de confirmar, Escape simplemente abandona la jugada en preparación.',
      whyNot: 'Deshacer solo se permite para tu última jugada, y mientras siga siendo tu turno. En cuanto otro jugador, máquina o humano, ha jugado, la jugada queda.',
    },
    confirm: {
      topic: 'confirmar una jugada',
      words: ['confirmar', 'confirmacion', 'validar', 'aceptar', 'intro', 'boton confirmar', 'jugar carta', 'elegir carta', 'seleccionar carta'],
      what: 'Una jugada se prepara en tres gestos: una carta de la mano, una acción y luego un objetivo en el mapa. La nota de arriba detalla entonces lo que costará y de dónde vienen el carbón, el hierro y la cerveza. Nada se juega antes de Confirmar (o Intro); Escape la abandona.',
    },
    prepare: {
      topic: 'preparar una jugada por adelantado',
      words: ['preparar', 'preparada', 'preparacion', 'adelantado', 'por adelantado', 'cola', 'salvo que', 'a menos que', 'jugada preparada'],
      what: 'Durante el turno de los demás puedes preparar tu jugada: carta, acción, objetivo y luego «Preparar». Sale sola en tu turno si aún se sostiene; si no, se descarta y la mesa te dice por qué. Una cláusula «salvo que» puede cancelarla de antemano, por ejemplo si un rival construye en el espacio que buscabas.',
    },
    ledger: {
      topic: 'el registro',
      words: ['registro', 'historial', 'diario', 'libro', 'jugadas anteriores', 'ultima jugada', 'ultimas jugadas', 'log'],
      what: 'El registro (tecla L) guarda cada jugada de la partida, ronda a ronda y jugador a jugador, con lo que costó. Unos filtros aíslan tus jugadas, la economía o la red, y cada línea se puede volver a ver en el tablero. La tecla D muestra la última jugada de un jugador.',
    },
    notebook: {
      topic: 'el cuaderno',
      words: ['cuaderno', 'notas', 'nota', 'libreta', 'apuntes', 'apuntar', 'escribir', 'pluma'],
      what: 'El cuaderno es una página tuya para toda la partida: planes, cosas que recordar, lo que parece buscar un rival. Se guarda en la oficina con la mesa, te sigue a otro dispositivo y nadie más lo lee. Se abre con el botón de la pluma, entre las herramientas.',
    },
    marketPanel: {
      topic: 'el panel del mercado',
      words: ['panel mercado', 'mostrar mercado', 'abrir mercado', 'ventana mercado', 'tablero precios', 'ver mercado'],
      what: 'El panel del mercado (tecla M) muestra los dos mercados: los cubos de carbón y de hierro que quedan, y el precio del siguiente. Cuando la jugada en preparación compra en el mercado, muestra el precio tras la compra. Se pliega cuando no lo necesitas.',
    },
    minimap: {
      topic: 'el minimapa',
      words: ['minimapa', 'mini mapa', 'mapa pequeno', 'vista general', 'navegar', 'mover vista', 'zoom', 'acercar', 'alejar'],
      what: 'El minimapa, abajo a la derecha, muestra todo el tablero y el marco de lo que estás mirando. Haz clic o arrastra dentro para mover la vista; el botón de la esquina, o los ajustes, lo ponen pequeño, mediano o grande. Las ciudades vacías son puntos grises; una ciudad construida lleva la forma de su dueño. La rueda hace zoom, y 0 encuadra todo el tablero.',
    },
    keys: {
      topic: 'los atajos de teclado',
      words: ['atajo', 'atajos', 'teclado', 'tecla', 'teclas', 'shortcut', 'combinacion teclas'],
      what: 'Los principales: 1 a 8 eligen una carta, Intro confirma, Escape cancela, Z deshace tu última jugada, M abre el mercado, L el registro, P el tapete, S los ajustes, H fija la mano, F pantalla completa, 0 encuadra el tablero, D muestra la última jugada de un jugador y ? las reglas. Todo se cambia en los ajustes, sección Atajos.',
    },
    settings: {
      topic: 'los ajustes',
      words: ['ajuste', 'ajustes', 'opciones', 'opcion', 'configuracion', 'preferencias', 'idioma', 'pantalla', 'daltonico', 'daltonismo', 'pantalla completa', 'sonido', 'sonidos', 'volumen', 'tema'],
      what: 'Los ajustes (tecla S) regulan cómo se ve la mesa en este dispositivo: idioma, fondo de mapa, dibujo de las losetas, modo daltónico, minimapa, marcadores, sonidos, pantalla completa y atajos. Todo se aplica al instante y no cambia nada de las reglas.',
    },
    aid: {
      topic: 'la ayuda de colocación',
      words: ['ayuda', 'ayudas', 'ayuda colocacion', 'ayuda principiantes', 'modo principiante', 'principiante', 'principiantes', 'asistencia', 'novato'],
      what: 'La ayuda de colocación es un ajuste para principiantes: con una carta en la mano, los espacios injugables se atenúan y el precio detalla el carbón y el hierro comprados en el mercado. Se activa en los ajustes; en una mesa en línea, la fija el anfitrión para todos. Nunca dice qué jugar.',
    },
    machines: {
      topic: 'las máquinas y sus personajes',
      words: ['maquina', 'maquinas', 'bot', 'bots', 'ordenador', 'computadora', 'ia', 'robot', 'robots', 'automata', 'watt', 'boulton', 'wedgwood', 'arkwright', 'personajes', 'dificultad', 'rival ordenador'],
      what: 'Cuatro personajes ocupan los asientos de las máquinas: Mr Boulton, que gasta a lo grande y vende a lo más grande; Mrs Wedgwood, paciente con sus alfarerías; Miss Arkwright, que vende rápido y dobla sus ferrocarriles; y Mr Watt, el experto, que juega siempre a fondo. Los tres primeros juegan a tu nivel, más afilados cuando ganas, más suaves cuando pierdes. Todos siguen las mismas reglas que tú.',
    },
    overview: {
      topic: 'el juego en breve',
      words: ['brass', 'blackrail', 'birmingham brass', 'juego', 'objetivo', 'meta', 'principio', 'reglas juego', 'jugar', 'juega', 'aprender', 'resumen'],
      what: 'Blackrail juega a Brass: Birmingham, en dos eras: los canales y luego el ferrocarril. Construyes industrias —minas, fundiciones, cervecerías, hilanderías, manufacturas, alfarerías—, las conectas con canales y luego con ferrocarriles, y vendes tus obras a los mercaderes. Los puntos vienen de las losetas volteadas y de los enlaces, contados al final de cada era, y gana quien más puntos tenga.',
      how: 'En tu turno, dos acciones (solo una en la primerísima ronda): Construir, Red, Desarrollar, Vender, Préstamo, Explorar, o pasar. Cada una cuesta una carta: elígela en la mano, luego la acción, luego el objetivo en el mapa, y confirma. El códice (tecla ?) reúne todas las reglas, y aquí puedes preguntarme cualquiera.',
      short: {
        what: 'Blackrail juega a Brass: Birmingham; la partida de iniciación solo juega su era del canal. Construyes industrias —minas, fundiciones, cervecerías, hilanderías, manufacturas, alfarerías—, las conectas con canales y vendes tus obras a los mercaderes. Los puntos vienen de las losetas volteadas y de los enlaces, contados al final de la era; luego el cierre suma el dinero y el nivel de ingresos, y gana quien más puntos tenga.',
      },
    },
    rules: {
      topic: 'el códice de reglas',
      words: ['reglas', 'reglamento', 'codice', 'manual', 'instrucciones', 'reglas completas'],
      what: 'El códice de reglas se abre con la tecla ?: recoge las reglas completas, sección por sección. También puedes hacerme la pregunta aquí, con tus palabras.',
    },
  },
};
