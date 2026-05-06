// ═══════════════════════════════════════════════════════════════
// WIKI_DATA — Datos enriquecidos para PR3 del Globo Mundial 2026
// Fuente: sport.es/es/futbol/guia-mundial-2026-sh/ (datos factuales)
// Genera: popups con apodo + entrenador + estrella + frase + grupo
// Atribución: sport.es / Wikipedia CC BY-SA (datos factuales no copyrighteables)
// ═══════════════════════════════════════════════════════════════

// ── SELECCIONES (48 equipos, key = name_en de EQUIPOS[]) ────────
var WIKI_SELECCIONES = {
  // GRUPO A
  'Mexico': {
    apodo: 'El Tri',
    grupo: 'A',
    confed: 'CONCACAF',
    mundiales: 17,
    mejor: 'Cuartos de final (1970, 1986)',
    coach: 'Javier Aguirre',
    estrella: 'Raúl Jiménez',
    estrella_club: 'Fulham',
    estrella_pos: 'Delantero',
    frase: 'Con 17 participaciones y el Azteca como escenario, busca la redención tras la decepción de Qatar 2022.'
  },
  'South Africa': {
    apodo: 'Bafana Bafana',
    grupo: 'A',
    confed: 'CAF',
    mundiales: 4,
    mejor: 'Cuartos de final (2010)',
    coach: '',
    estrella: 'Lyle Foster',
    estrella_club: 'Burnley',
    estrella_pos: 'Delantero',
    frase: 'Los Bafana regresan al Mundial como campeones de su grupo CAF. Con buen bloque defensivo y transiciones rápidas.'
  },
  'Korea': {
    apodo: 'Taeguk Warriors',
    grupo: 'A',
    confed: 'AFC',
    mundiales: 11,
    mejor: 'Semifinal (2002)',
    coach: '',
    estrella: 'Heung-min Son',
    estrella_club: 'Los Angeles FC',
    estrella_pos: 'Extremo izquierdo',
    frase: 'Presentes en todos los Mundiales desde 1986. Combinan fútbol dinámico con estrellas en las grandes ligas europeas.'
  },
  'Czech Republic': {
    apodo: 'Národní tým',
    grupo: 'A',
    confed: 'UEFA',
    mundiales: 10,
    mejor: 'Subcampeón (1934, 1962 — como Checoslovaquia)',
    coach: '',
    estrella: 'Tomáš Souček',
    estrella_club: 'West Ham',
    estrella_pos: 'Centrocampista',
    frase: 'Regresa a un Mundial con una generación renovada y ambiciosa. Apuesta por un fútbol físico y combativo.'
  },
  // GRUPO B
  'Canada': {
    apodo: 'The Canucks',
    grupo: 'B',
    confed: 'CONCACAF',
    mundiales: 2,
    mejor: 'Fase de grupos (1986)',
    coach: '',
    estrella: 'Alphonso Davies',
    estrella_club: 'Bayern Múnich',
    estrella_pos: 'Lateral izquierdo',
    frase: 'Como anfitrión debuta con grandes expectativas. Alphonso Davies lidera a la mejor generación de su historia.'
  },
  'Qatar': {
    apodo: 'Al-Annabi',
    grupo: 'B',
    confed: 'AFC',
    mundiales: 2,
    mejor: 'Fase de grupos (2022)',
    coach: 'Sánchez Bas',
    estrella: 'Almoez Ali',
    estrella_club: 'Al-Duhail',
    estrella_pos: 'Delantero',
    frase: 'Los campeones asiáticos buscan repetir la hazaña de Qatar 2022 en suelo norteamericano.'
  },
  'Switzerland': {
    apodo: 'La Nati',
    grupo: 'B',
    confed: 'UEFA',
    mundiales: 12,
    mejor: 'Cuartos de final (1934, 1938, 1954)',
    coach: '',
    estrella: 'Manuel Akanji',
    estrella_club: 'Inter de Milán',
    estrella_pos: 'Defensa central',
    frase: 'Sexto Mundial consecutivo desde 1994. Regularidad, solidez defensiva y jugadores top de élite europea.'
  },
  'Bosnia & Herzegovina': {
    apodo: 'Zmajevi',
    grupo: 'B',
    confed: 'UEFA',
    mundiales: 2,
    mejor: 'Fase de grupos (2014)',
    coach: '',
    estrella: 'Edin Džeko',
    estrella_club: 'Fenerbahçe',
    estrella_pos: 'Delantero',
    frase: 'Los Dragones regresan a la fase final con ambición. Džeko sigue siendo el referente ofensivo del equipo.'
  },
  // GRUPO C
  'Brazil': {
    apodo: 'A Canarinha',
    grupo: 'C',
    confed: 'CONMEBOL',
    mundiales: 22,
    mejor: 'Campeón (1958, 1962, 1970, 1994, 2002)',
    coach: 'Carlo Ancelotti',
    estrella: 'Vinicius Jr.',
    estrella_club: 'Real Madrid',
    estrella_pos: 'Extremo izquierdo',
    frase: 'El único pentacampeón. Ancelotti en el banquillo y Vinicius en el campo: Brasil vuelve como gran favorito.'
  },
  'Morocco': {
    apodo: 'Los Leones del Atlas',
    grupo: 'C',
    confed: 'CAF',
    mundiales: 6,
    mejor: 'Semifinal (2022)',
    coach: 'Walid Regragui',
    estrella: 'Achraf Hakimi',
    estrella_club: 'PSG',
    estrella_pos: 'Lateral derecho',
    frase: 'Primera selección africana en llegar a semifinales de un Mundial (Qatar 2022). Regragui mantiene el esquema.'
  },
  'Haiti': {
    apodo: 'Les Grenadiers',
    grupo: 'C',
    confed: 'CONCACAF',
    mundiales: 2,
    mejor: 'Fase de grupos (1974)',
    coach: '',
    estrella: 'Jean-Ricner Bellegarde',
    estrella_club: 'PSG',
    estrella_pos: 'Centrocampista',
    frase: 'Regresan a un Mundial 52 años después. Su clasifación supuso una sorpresa histórica para el fútbol caribeño.'
  },
  'Scotland': {
    apodo: 'Tartan Army',
    grupo: 'C',
    confed: 'UEFA',
    mundiales: 9,
    mejor: 'Fase de grupos',
    coach: '',
    estrella: 'Scott McTominay',
    estrella_club: 'Nápoles',
    estrella_pos: 'Centrocampista',
    frase: '"No Scotland, no Party". El combinado escocés regresa con McTominay como motor desde el Nápoles.'
  },
  // GRUPO D
  'USA': {
    apodo: 'Stars and Stripes',
    grupo: 'D',
    confed: 'CONCACAF',
    mundiales: 11,
    mejor: 'Semifinal (1930)',
    coach: '',
    estrella: 'Christian Pulisic',
    estrella_club: 'AC Milan',
    estrella_pos: 'Centrocampista',
    frase: 'Anfitrión y gran favorito CONCACAF. Pulisic lidera una generación que espera brillar en casa.'
  },
  'Australia': {
    apodo: 'Socceroos',
    grupo: 'D',
    confed: 'AFC',
    mundiales: 6,
    mejor: 'Cuartos de final (2006, 2022)',
    coach: '',
    estrella: 'Mat Ryan',
    estrella_club: 'Real Sociedad',
    estrella_pos: 'Portero',
    frase: 'Los Socceroos llegan con experiencia tras su gran papel en Qatar 2022 y con hambre de repetirlo.'
  },
  'New Zealand': {
    apodo: 'All Whites',
    grupo: 'G',
    confed: 'OFC',
    mundiales: 3,
    mejor: 'Fase de grupos (1982, 2010)',
    coach: '',
    estrella: 'Chris Wood',
    estrella_club: 'Nottingham Forest',
    estrella_pos: 'Delantero',
    frase: 'Su tercera aparición mundialista. Wood como referente ofensivo en una selección que busca su primer punto.'
  },
  'Paraguay': {
    apodo: 'La Albirroja',
    grupo: 'D',
    confed: 'CONMEBOL',
    mundiales: 9,
    mejor: 'Cuartos de final (1954, 2010)',
    coach: '',
    estrella: 'Miguel Almirón',
    estrella_club: 'Newcastle',
    estrella_pos: 'Extremo',
    frase: 'Regresa al Mundial tras 16 años de ausencia. Almirón y una selección renovada con identidad recuperada.'
  },
  // GRUPO E
  'Germany': {
    apodo: 'Die Mannschaft',
    grupo: 'E',
    confed: 'UEFA',
    mundiales: 20,
    mejor: 'Campeón (1954, 1974, 1990, 2014)',
    coach: 'Julian Nagelsmann',
    estrella: 'Florian Wirtz',
    estrella_club: 'Bayern Múnich',
    estrella_pos: 'Centrocampista',
    frase: 'Cuatro veces campeona del mundo. Con Wirtz como nueva gran estrella y el hambre de volver a lo más alto.'
  },
  'Ecuador': {
    apodo: 'La Tricolor',
    grupo: 'E',
    confed: 'CONMEBOL',
    mundiales: 4,
    mejor: 'Cuartos de final (2006)',
    coach: 'Sebastián Beccacece',
    estrella: 'Moisés Caicedo',
    estrella_club: 'Chelsea',
    estrella_pos: 'Centrocampista',
    frase: 'Ratifican su crecimiento con Beccacece. Caicedo, uno de los mejores mediocentros del mundo, es su faro.'
  },
  'Ivory Coast': {
    apodo: 'Los Elefantes',
    grupo: 'E',
    confed: 'CAF',
    mundiales: 4,
    mejor: 'Fase de grupos (2006, 2010, 2014)',
    coach: '',
    estrella: 'Franck Kessié',
    estrella_club: 'Al-Ahli',
    estrella_pos: 'Centrocampista',
    frase: 'Una de las selecciones africanas más reconocibles. Campeones de África en 2015 y 2024 buscan su mejor Mundial.'
  },
  'Curaçao': {
    apodo: 'La Familia Azul',
    grupo: 'E',
    confed: 'CONCACAF',
    mundiales: 1,
    mejor: 'Debut (2026)',
    coach: '',
    estrella: 'Tahith Chong',
    estrella_club: 'Besiktas',
    estrella_pos: 'Extremo',
    frase: 'Historia pura: primera clasificación mundialista. Con el 70% de jugadores nacidos en Países Bajos.'
  },
  // GRUPO F
  'Netherlands': {
    apodo: 'La Naranja Mecánica',
    grupo: 'F',
    confed: 'UEFA',
    mundiales: 11,
    mejor: 'Subcampeón (1974, 1978, 2010)',
    coach: '',
    estrella: 'Virgil van Dijk',
    estrella_club: 'Liverpool',
    estrella_pos: 'Defensa central',
    frase: 'Tres veces subcampeona del mundo. Con Van Dijk en el eje, buscan finalmente el título que se les resiste.'
  },
  'Japan': {
    apodo: 'Samurais Azules',
    grupo: 'F',
    confed: 'AFC',
    mundiales: 8,
    mejor: 'Octavos de final (2002, 2010, 2022)',
    coach: 'Hajime Moriyasu',
    estrella: 'Takefusa Kubo',
    estrella_club: 'Real Sociedad',
    estrella_pos: 'Extremo derecho',
    frase: 'Siete Mundiales consecutivos. Moriyasu mantiene un proyecto atractivo con talentos en las mejores ligas.'
  },
  'Tunisia': {
    apodo: 'Las Águilas de Cartago',
    grupo: 'F',
    confed: 'CAF',
    mundiales: 6,
    mejor: 'Fase de grupos',
    coach: '',
    estrella: 'Wahbi Khazri',
    estrella_club: '',
    estrella_pos: 'Delantero',
    frase: 'Clasificados con dominio en su grupo CAF. Buscan superar por primera vez la fase de grupos en un Mundial.'
  },
  // GRUPO G
  'Belgium': {
    apodo: 'Diablos Rojos',
    grupo: 'G',
    confed: 'UEFA',
    mundiales: 14,
    mejor: 'Tercero (1986, 2018)',
    coach: '',
    estrella: 'Thibaut Courtois',
    estrella_club: 'Real Madrid',
    estrella_pos: 'Portero',
    frase: 'Con el recuerdo de su "Generación Dorada" y Courtois en los palos, buscan superar el tercer puesto de 2018.'
  },
  'Egypt': {
    apodo: 'Los Faraones',
    grupo: 'G',
    confed: 'CAF',
    mundiales: 4,
    mejor: 'Fase de grupos',
    coach: '',
    estrella: 'Mohamed Salah',
    estrella_club: 'Liverpool',
    estrella_pos: 'Extremo derecho',
    frase: 'Primer equipo africano en participar en un Mundial (1934). Salah, uno de los mejores del mundo, al frente.'
  },
  'Iran': {
    apodo: 'Príncipes de Persia',
    grupo: 'G',
    confed: 'AFC',
    mundiales: 6,
    mejor: 'Fase de grupos',
    coach: '',
    estrella: 'Mehdi Taremi',
    estrella_club: 'Inter de Milán',
    estrella_pos: 'Delantero',
    frase: 'La selección iraní afronta su sexto Mundial con Taremi como referente en el Inter y el sueño de avanzar.'
  },
  // GRUPO H
  'Spain': {
    apodo: 'La Roja',
    grupo: 'H',
    confed: 'UEFA',
    mundiales: 16,
    mejor: 'Campeón (2010)',
    coach: 'Luis de la Fuente',
    estrella: 'Lamine Yamal',
    estrella_club: 'FC Barcelona',
    estrella_pos: 'Extremo derecho',
    frase: 'Campeona de la Eurocopa 2024 con Lamine Yamal como revelación. Candidata máxima al título con De la Fuente.'
  },
  'Uruguay': {
    apodo: 'Los Charrúas',
    grupo: 'H',
    confed: 'CONMEBOL',
    mundiales: 14,
    mejor: 'Campeón (1930, 1950)',
    coach: 'Marcelo Bielsa',
    estrella: 'Fede Valverde',
    estrella_club: 'Real Madrid',
    estrella_pos: 'Centrocampista',
    frase: 'Con Bielsa reinventando al equipo y Valverde como motor desde el Real Madrid. Renovación generacional acertada.'
  },
  'Saudi Arabia': {
    apodo: 'Green Falcons',
    grupo: 'H',
    confed: 'AFC',
    mundiales: 6,
    mejor: 'Octavos de final (1994)',
    coach: '',
    estrella: 'Salem Al-Dawsari',
    estrella_club: 'Al-Hilal',
    estrella_pos: 'Extremo',
    frase: 'Presumen de haber derrotado a Argentina en Qatar 2022. Con una liga mejorada y grandes inversiones en fútbol.'
  },
  'Cape Verde': {
    apodo: 'Tiburones Azules',
    grupo: 'H',
    confed: 'CAF',
    mundiales: 1,
    mejor: 'Debut (2026)',
    coach: '',
    estrella: 'Dailon Livramento',
    estrella_club: 'FC Barcelona',
    estrella_pos: 'Extremo',
    frase: 'Debut histórico: obtuvieron la independencia en 1975 y en 2026 llegan a su primer Mundial. Orgullo nacional.'
  },
  // GRUPO I
  'France': {
    apodo: 'Les Bleus',
    grupo: 'I',
    confed: 'UEFA',
    mundiales: 16,
    mejor: 'Campeón (1998, 2018)',
    coach: 'Didier Deschamps',
    estrella: 'Kylian Mbappé',
    estrella_club: 'Real Madrid',
    estrella_pos: 'Delantero',
    frase: 'Una de las grandes favoritas. Mbappé listo en el Real Madrid y Deschamps con hambre de su tercer título.'
  },
  'Senegal': {
    apodo: 'Leones de Teranga',
    grupo: 'I',
    confed: 'CAF',
    mundiales: 4,
    mejor: 'Cuartos de final (2002)',
    coach: '',
    estrella: 'Sadio Mané',
    estrella_club: 'Al-Nassr',
    estrella_pos: 'Extremo',
    frase: 'Campeones de África en 2021 y 2022. Mané y una generación de estrellas en la Premier y Bundesliga al frente.'
  },
  'Norway': {
    apodo: 'Landslaget',
    grupo: 'I',
    confed: 'UEFA',
    mundiales: 4,
    mejor: 'Cuartos de final (1938)',
    coach: '',
    estrella: 'Erling Haaland',
    estrella_club: 'Manchester City',
    estrella_pos: 'Delantero',
    frase: 'Regresan al Mundial tras décadas de ausencia con Haaland, máximo goleador de la historia del City. ¿Sorpresa?'
  },
  'Iraq': {
    apodo: 'Los Leones de Mesopotamia',
    grupo: 'I',
    confed: 'AFC',
    mundiales: 2,
    mejor: 'Fase de grupos (1986)',
    coach: '',
    estrella: 'Aymen Hussein',
    estrella_club: 'Al-Zawra',
    estrella_pos: 'Delantero',
    frase: 'Campeones de la Copa Asiática 2007. Regresan al Mundial tras 40 años con una generación renovada.'
  },
  // GRUPO J
  'Argentina': {
    apodo: 'La Albiceleste',
    grupo: 'J',
    confed: 'CONMEBOL',
    mundiales: 19,
    mejor: 'Campeón (1978, 1986, 2022)',
    coach: 'Lionel Scaloni',
    estrella: 'Lionel Messi',
    estrella_club: 'Inter Miami',
    estrella_pos: 'Delantero',
    frase: 'Vigente campeona del mundo. Messi a los 38 años en su último Mundial, con Scaloni y la promesa de bis.'
  },
  'Algeria': {
    apodo: 'Los Zorros del Desierto',
    grupo: 'J',
    confed: 'CAF',
    mundiales: 5,
    mejor: 'Segunda ronda (2014)',
    coach: '',
    estrella: 'Riyad Mahrez',
    estrella_club: 'Al-Ahli',
    estrella_pos: 'Extremo derecho',
    frase: 'Brillaron en Brasil 2014. Mahrez lidera una selección que busca superar aquella actuación histórica.'
  },
  'Austria': {
    apodo: 'Wunderteam',
    grupo: 'J',
    confed: 'UEFA',
    mundiales: 7,
    mejor: 'Tercero (1954)',
    coach: '',
    estrella: 'David Alaba',
    estrella_club: 'Real Madrid',
    estrella_pos: 'Defensa',
    frase: 'Primer Mundial en el siglo XXI. Alaba ya en la recta final de su carrera lidera a la Austria más ambiciosa.'
  },
  'Jordan': {
    apodo: 'Al-Nashama',
    grupo: 'J',
    confed: 'AFC',
    mundiales: 1,
    mejor: 'Debut (2026)',
    coach: '',
    estrella: 'Moussa Al-Tamari',
    estrella_club: 'Real Madrid',
    estrella_pos: 'Extremo',
    frase: 'Histórica clasificación el 5 de junio de 2025. El pueblo jordano celebró su primera Copa del Mundo.'
  },
  // GRUPO K
  'Portugal': {
    apodo: 'A Seleção das Quinas',
    grupo: 'K',
    confed: 'UEFA',
    mundiales: 8,
    mejor: 'Tercero (1966)',
    coach: '',
    estrella: 'Cristiano Ronaldo',
    estrella_club: 'Al-Nassr',
    estrella_pos: 'Delantero',
    frase: 'Ronaldo a los 41 años en su último (¿sexto?) Mundial. Portugal lideró sin problemas su clasificación UEFA.'
  },
  'Colombia': {
    apodo: 'Los Cafeteros',
    grupo: 'K',
    confed: 'CONMEBOL',
    mundiales: 7,
    mejor: 'Cuartos de final (2014)',
    coach: '',
    estrella: 'Luis Díaz',
    estrella_club: 'Liverpool',
    estrella_pos: 'Extremo izquierdo',
    frase: 'Regresan tras perderse Qatar 2022. Finalistas de la Copa América 2024, con Díaz como figura en el Liverpool.'
  },
  'Uzbekistan': {
    apodo: 'Los Lobos Blancos',
    grupo: 'K',
    confed: 'AFC',
    mundiales: 1,
    mejor: 'Debut (2026)',
    coach: '',
    estrella: 'Abdukodir Khusanov',
    estrella_club: 'Manchester City',
    estrella_pos: 'Defensa central',
    frase: 'Debut histórico de la selección centroasiática. Khusanov, campeón de Champions con el City, su gran figura.'
  },
  // GRUPO L
  'England': {
    apodo: 'Three Lions',
    grupo: 'L',
    confed: 'UEFA',
    mundiales: 16,
    mejor: 'Campeón (1966)',
    coach: '',
    estrella: 'Harry Kane',
    estrella_club: 'Bayern Múnich',
    estrella_pos: 'Delantero',
    frase: 'Ocho participaciones consecutivas. Kane al máximo nivel en el Bayern y una generación que sueña con 1966.'
  },
  'Croatia': {
    apodo: 'Kockasti (Los Ajedrezados)',
    grupo: 'L',
    confed: 'UEFA',
    mundiales: 7,
    mejor: 'Subcampeón (2018)',
    coach: '',
    estrella: 'Luka Modrić',
    estrella_club: 'AC Milan',
    estrella_pos: 'Centrocampista',
    frase: 'Modrić a los 40 años sigue siendo indispensable. Croacia no conoce el concepto de "años de transición".'
  },
  'Ghana': {
    apodo: 'Black Stars',
    grupo: 'L',
    confed: 'CAF',
    mundiales: 4,
    mejor: 'Cuartos de final (2010)',
    coach: '',
    estrella: 'Mohammed Kudus',
    estrella_club: 'West Ham',
    estrella_pos: 'Extremo',
    frase: 'Cuatro veces campeones de África. Kudus como figura emergente y uno de los mejores jugadores de la Premier.'
  },
  'Panama': {
    apodo: 'Los Canaleros',
    grupo: 'L',
    confed: 'CONCACAF',
    mundiales: 2,
    mejor: 'Fase de grupos (2018)',
    coach: '',
    estrella: 'Amir Murillo',
    estrella_club: 'Besiktas',
    estrella_pos: 'Lateral derecho',
    frase: 'Regresa en su segundo Mundial tras su debut en Rusia 2018. Marea Roja con ambición renovada.'
  },
  // Extra (los que aparecen en el documento como posibles)
  'Scotland': {
    apodo: 'Tartan Army',
    grupo: 'C',
    confed: 'UEFA',
    mundiales: 9,
    mejor: 'Fase de grupos',
    coach: '',
    estrella: 'Scott McTominay',
    estrella_club: 'Nápoles',
    estrella_pos: 'Centrocampista',
    frase: '"No Scotland, no Party". El combinado escocés regresa con McTominay como motor del Nápoles de Conte.'
  },
};

// ── SEDES (16 estadios, key = name en SEDES[]) ──────────────────
var WIKI_SEDES = {
  'Los Ángeles': {
    estadio: 'SoFi Stadium',
    pais: 'EE.UU.',
    capacidad: 70000,
    inauguracion: 2020,
    equipo_local: 'LA Rams + LA Chargers (NFL)',
    max_ronda: 'Cuartos de final',
    dato: 'El estadio más moderno del torneo y uno de los más caros de la historia (5.5B $). Techo translúcido sin pilares.',
    partidos_grupo: ['Estados Unidos vs Paraguay – Grupo D', 'Suiza vs Dinamarca – Grupo B', 'España vs Arabia Saudí – Grupo H']
  },
  'San Francisco': {
    estadio: "Levi's Stadium",
    pais: 'EE.UU.',
    capacidad: 71000,
    inauguracion: 2014,
    equipo_local: 'San Francisco 49ers (NFL)',
    max_ronda: 'R16',
    dato: "Casa de los 49ers, uno de los franquicias más históricas de la NFL. Primer estadio de la NFL con certificación LEED Gold.",
    partidos_grupo: ['Irán vs Nueva Zelanda – Grupo G', 'Colombia vs Uzbekistán – Grupo K']
  },
  'Seattle': {
    estadio: 'Lumen Field',
    pais: 'EE.UU.',
    capacidad: 70000,
    inauguracion: 2002,
    equipo_local: 'Seattle Seahawks (NFL) + Seattle Sounders (MLS)',
    max_ronda: 'Octavos de final',
    dato: 'Casa de los Sounders, uno de los clubes MLS más seguidos del país. Su forma de herradura ofrece vistas al skyline de Seattle.',
    partidos_grupo: ['Bélgica vs Egipto – Grupo G', 'Estados Unidos vs Australia – Grupo D']
  },
  'Dallas': {
    estadio: "AT&T Stadium",
    pais: 'EE.UU.',
    capacidad: 94000,
    inauguracion: 2009,
    equipo_local: 'Dallas Cowboys (NFL)',
    max_ronda: 'Semifinal (14 jul)',
    dato: 'El segundo estadio más grande del torneo. Casa de los Dallas Cowboys, 5 veces campeones Super Bowl. Sede de semifinal.',
    partidos_grupo: ['Argentina vs Argelia – Grupo J', 'Alemania vs Ecuador – Grupo E']
  },
  'Houston': {
    estadio: 'NRG Stadium',
    pais: 'EE.UU.',
    capacidad: 72220,
    inauguracion: 2002,
    equipo_local: 'Houston Texans (NFL)',
    max_ronda: 'Octavos de final',
    dato: 'Techo retráctil — el único del torneo en EE.UU. También ha albergado lucha WWE, boxeo y conciertos de talla mundial.',
    partidos_grupo: ['Alemania vs Curazao – Grupo E', 'Portugal vs Colombia – Grupo K']
  },
  'Kansas City': {
    estadio: 'Arrowhead Stadium',
    pais: 'EE.UU.',
    capacidad: 73000,
    inauguracion: 1972,
    equipo_local: 'Kansas City Chiefs (NFL)',
    max_ronda: 'Cuartos de final',
    dato: 'Récord Guinness: estadio al aire libre más ruidoso del mundo (142,2 dB en 2014). Sede de cuartos y debut-despedida antes del nuevo estadio.',
    partidos_grupo: ['Argentina vs Argelia – Grupo J', 'Túnez vs Países Bajos – Grupo F']
  },
  'Atlanta': {
    estadio: 'Mercedes-Benz Stadium',
    pais: 'EE.UU.',
    capacidad: 75000,
    inauguracion: 2017,
    equipo_local: 'Atlanta Falcons (NFL) + Atlanta United (MLS)',
    max_ronda: 'Semifinal (15 jul)',
    dato: 'Cubierta retráctil en forma de iris. Albergó el Super Bowl LIII en 2019 con récord de asistencia. Sede de semifinal.',
    partidos_grupo: ['España vs Cabo Verde – Grupo H', 'Marruecos vs Haití – Grupo C']
  },
  'Miami': {
    estadio: 'Hard Rock Stadium',
    pais: 'EE.UU.',
    capacidad: 65000,
    inauguracion: 1987,
    equipo_local: 'Miami Dolphins (NFL) + Inter Miami (MLS)',
    max_ronda: '3er puesto (18 jul)',
    dato: "Casa del Inter Miami de Leo Messi. Sede del partido por el Tercer Puesto el 18 de julio.",
    partidos_grupo: ['Arabia Saudí vs Uruguay – Grupo H', 'Escocia vs Brasil – Grupo C']
  },
  'Boston': {
    estadio: 'Gillette Stadium',
    pais: 'EE.UU.',
    capacidad: 65000,
    inauguracion: 2002,
    equipo_local: 'New England Patriots (NFL) + New England Revolution (MLS)',
    max_ronda: 'Cuartos de final',
    dato: "Casa de los Patriots de Tom Brady: 6 Super Bowls en esta era. La pantalla HD exterior más grande de EE.UU. tras la renovación.",
    partidos_grupo: ['Haití vs Escocia – Grupo C', 'Noruega vs Senegal – Grupo I']
  },
  'Nueva York': {
    estadio: 'MetLife Stadium',
    pais: 'EE.UU.',
    capacidad: 82500,
    inauguracion: 2010,
    equipo_local: 'NY Giants + NY Jets (NFL)',
    max_ronda: '🏆 FINAL (19 jul)',
    dato: 'SEDE DE LA GRAN FINAL el 19 de julio de 2026. Uno de los estadios más grandes del mundo, en East Rutherford (NJ).',
    partidos_grupo: ['Brasil vs Marruecos – Grupo C', 'Francia vs Senegal – Grupo I']
  },
  'Filadelfia': {
    estadio: 'Lincoln Financial Field',
    pais: 'EE.UU.',
    capacidad: 69000,
    inauguracion: 2003,
    equipo_local: 'Philadelphia Eagles (NFL)',
    max_ronda: 'Octavos de final',
    dato: 'Los Eagles son campeones del Super Bowl en 2018 y 2025. Una de las aficiones más apasionadas de la NFL.',
    partidos_grupo: ['España vs Argentina (si coincide)', 'Croacia vs Panamá – Grupo L']
  },
  'Ciudad de México': {
    estadio: 'Estadio Azteca',
    pais: 'México',
    capacidad: 83000,
    inauguracion: 1966,
    equipo_local: 'Club América + Cruz Azul',
    max_ronda: 'Octavos de final',
    dato: 'Primer estadio en albergar 3 inauguraciones mundialistas (1970, 1986, 2026). El gol de Maradona con la mano a Inglaterra fue aquí.',
    partidos_grupo: ['México vs Sudáfrica – PARTIDO INAUGURAL (11 jun)', 'México vs Dinamarca – Grupo A']
  },
  'Monterrey': {
    estadio: 'Estadio BBVA',
    pais: 'México',
    capacidad: 53500,
    inauguracion: 2015,
    equipo_local: 'CF Monterrey (Liga MX)',
    max_ronda: 'R16',
    dato: 'El estadio más nuevo de México. Primer recinto en América con certificación LEED Plata. Vista espectacular a las montañas.',
    partidos_grupo: ['Colombia vs RD Congo – Grupo K', 'Senegal vs Irak – Grupo I']
  },
  'Guadalajara': {
    estadio: 'Estadio Akron',
    pais: 'México',
    capacidad: 48000,
    inauguracion: 2010,
    equipo_local: 'CD Guadalajara — Las Chivas (Liga MX)',
    max_ronda: 'Grupos',
    dato: 'Diseño esférico único que evoca un volcán bajo una nube. Las Chivas son el único club que juega solo con mexicanos.',
    partidos_grupo: ['Corea del Sur vs República Checa – Grupo A', 'México vs Corea del Sur – Grupo A']
  },
  'Vancouver': {
    estadio: 'BC Place',
    pais: 'Canadá',
    capacidad: 54000,
    inauguracion: 1983,
    equipo_local: 'Vancouver Whitecaps (MLS)',
    max_ronda: 'Octavos de final',
    dato: "Sede de la Final del Mundial Femenino 2015 (EEUU 5-2 Japón). Techo retráctil con la cubierta de teflón más grande del mundo.",
    partidos_grupo: ['Australia vs Kosovo/Rumania – Grupo D', 'Canadá vs Qatar – Grupo B']
  },
  'Toronto': {
    estadio: 'BMO Field',
    pais: 'Canadá',
    capacidad: 45000,
    inauguracion: 2007,
    equipo_local: 'Toronto FC (MLS)',
    max_ronda: 'R16',
    dato: "Primer estadio específico de fútbol en Canadá. Toronto FC ganó la MLS Cup en 2017 con Sebastian Giovinco y Jozy Altidore.",
    partidos_grupo: ['Canadá vs Bosnia – Grupo B', 'Ghana vs Panamá – Grupo L']
  }
};

// Exportar para uso en ui-globo-equipos.js (classic script → var global)
// En el módulo globe: window.WIKI_SELECCIONES y window.WIKI_SEDES
