// data.js - Porra Mundial 2026 / sub-bloque js-data + estado global + utils
// Extraido de main.js. Expone: SB, WORLD_CUP_LOGO, EQUIPOS, GRUPOS, PARTIDOS, BRACKET,
// KIT_OVERRIDES, predictions, iaPredictions, totalPoints, getMatchKey, getMySign,
// iaBonusWillApply, escapeHtml. Sin deps.


// ========== DATOS DEL MUNDIAL 2026 ==========
  // ─────────────────────────────────────────────────────────────
  /*
     js-data — Datos del torneo: PARTIDOS, BRACKET, EQUIPOS, GRUPOS
     Archivo destino : data.js
     -----------------------------------------------------------
     Usa             : (ninguna)
     Expone          : PARTIDOS, BRACKET, EQUIPOS, GRUPOS, SB, AW_PLAYERS, YOUNG_PLAYERS_NXGN
     Deps            : (ninguna)
     Notas           : Raiz de datos. Sin dependencias JS del proyecto.
================================================================ */
// DATOS DEL TORNEO — URLs Supabase Storage, equipos, grupos, partidos
  // ─────────────────────────────────────────────────────────────
const SB = 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public';
const WORLD_CUP_LOGO = SB + '/miniatures/Logos/2026_FIFA_World_Cup.png';

const EQUIPOS = [
  { name:"México", name_en:"Mexico",             slug:"mexico",       flag:"MEX", players:[{key:"Jimenez",name:"9 · Raúl Jiménez"},{key:"Lozano",name:"22 · H. Lozano"},{key:"Martin",name:"8 · C. Rodríguez"},{key:"Vega",name:"11 · A. Vega"}] },
  { name:"Sudáfrica", name_en:"South Africa",          slug:"south-africa", flag:"RSA", players:[{key:"Percy",name:"10 · Percy Tau"},{key:"Dolly",name:"11 · Keagan Dolly"}] },
  { name:"República de Corea", name_en:"South Korea", slug:"korea",        flag:"KOR", players:[{key:"Son",name:"7 · Son Heung-min"},{key:"Hwang",name:"9 · Hwang Ui-jo"},{key:"Lee",name:"11 · Lee Kang-in"}] },
  { name:"República Checa", name_en:"Czechia",    slug:"czech",        flag:"CZE", players:[{key:"Schick",name:"9 · Patrik Schick"},{key:"Hlozek",name:"11 · Adam Hložek"}] },
  { name:"Canadá", name_en:"Canada",             slug:"canada",       flag:"CAN", players:[{key:"David",name:"9 · Jonathan David"},{key:"Davies",name:"3 · Alphonso Davies"},{key:"Buchanan",name:"11 · Tajon Buchanan"}] },
  { name:"Bosnia y Herzegovina", name_en:"Bosnia & Herzegovina",slug:"bosnia",      flag:"BIH", players:[{key:"Dzeko",name:"9 · Edin Džeko"},{key:"Pjanic",name:"8 · Miralem Pjanić"}] },
  { name:"Catar", name_en:"Qatar",              slug:"qatar",        flag:"QAT", players:[{key:"Afif",name:"11 · Akram Afif"},{key:"Almoez",name:"9 · Almoez Ali"}] },
  { name:"Suiza", name_en:"Switzerland",              slug:"switzerland",  flag:"SUI", players:[{key:"Xhaka",name:"10 · Granit Xhaka"},{key:"Embolo",name:"7 · Breel Embolo"},{key:"Ndoye",name:"11 · Dan Ndoye"}] },
  { name:"Brasil", name_en:"Brazil",             slug:"brazil",       flag:"BRA", players:[{key:"Vinicius",name:"7 · Vinícius Jr."},{key:"Raphinha",name:"11 · Raphinha"},{key:"Rodrygo",name:"9 · Rodrygo"},{key:"Endrick",name:"19 · Endrick"}] },
  { name:"Marruecos", name_en:"Morocco",          slug:"morocco",      flag:"MAR", players:[{key:"Hakimi",name:"2 · Achraf Hakimi"},{key:"Ziyech",name:"7 · Hakim Ziyech"},{key:"EnNesyri",name:"9 · Youssef En-Nesyri"}] },
  { name:"Haití", name_en:"Haiti",              slug:"haiti",        flag:"HAI", players:[{key:"Nazon",name:"9 · Duckens Nazon"},{key:"Borgella",name:"11 · Frantzdy Pierrot"}] },
  { name:"Escocia", name_en:"Scotland",            slug:"scotland",     flag:"SCO", players:[{key:"McTominay",name:"8 · Scott McTominay"},{key:"Adams",name:"9 · Che Adams"},{key:"Christie",name:"11 · Ryan Christie"}] },
  { name:"Estados Unidos", name_en:"USA",     slug:"usa",          flag:"USA", players:[{key:"Pulisic",name:"10 · Christian Pulisic"},{key:"Reyna",name:"7 · Giovanni Reyna"},{key:"Balogun",name:"9 · Folarin Balogun"}] },
  { name:"Paraguay", name_en:"Paraguay",           slug:"paraguay",     flag:"PAR", players:[{key:"Almiron",name:"10 · Miguel Almirón"},{key:"Sanabria",name:"9 · Antonio Sanabria"}] },
  { name:"Australia", name_en:"Australia",          slug:"australia",    flag:"AUS", players:[{key:"Hrustic",name:"10 · Ajdin Hrustic"},{key:"Taggart",name:"9 · Adam Taggart"},{key:"Irvine",name:"8 · Jackson Irvine"}] },
  { name:"Turquía", name_en:"Türkiye",            slug:"turkey",       flag:"TUR", players:[{key:"Calhanoglu",name:"10 · Hakan Çalhanoğlu"},{key:"Guler",name:"10 · Arda Güler"},{key:"Yildiz",name:"7 · Kenan Yıldız"}] },
  { name:"Alemania", name_en:"Germany",           slug:"germany",      flag:"GER", players:[{key:"Wirtz",name:"10 · Florian Wirtz"},{key:"Musiala",name:"14 · Jamal Musiala"},{key:"Havertz",name:"9 · Kai Havertz"},{key:"Gnabry",name:"7 · Serge Gnabry"}] },
  { name:"Curazao", name_en:"Curaçao",            slug:"curacao",      flag:"CUW", players:[{key:"Bacuna",name:"8 · Juninho Bacuna"},{key:"Fer",name:"6 · Leroy Fer"}] },
  { name:"Costa de Marfil", name_en:"Côte d'Ivoire",    slug:"ivory-coast",  flag:"CIV", players:[{key:"Pepe",name:"7 · Nicolas Pépé"},{key:"Cornet",name:"11 · Maxwel Cornet"},{key:"Gradel",name:"9 · Max-Alain Gradel"}] },
  { name:"Ecuador", name_en:"Ecuador",            slug:"ecuador",      flag:"ECU", players:[{key:"Caicedo",name:"14 · Moisés Caicedo"},{key:"Valencia",name:"13 · Enner Valencia"},{key:"Plata",name:"11 · Gonzalo Plata"}] },
  { name:"Países Bajos", name_en:"Netherlands",       slug:"netherlands",  flag:"NED", players:[{key:"Gakpo",name:"11 · Cody Gakpo"},{key:"VanDijk",name:"4 · Virgil van Dijk"},{key:"Simons",name:"9 · Xavi Simons"},{key:"Depay",name:"10 · Memphis Depay"}] },
  { name:"Japón", name_en:"Japan",              slug:"japan",        flag:"JPN", players:[{key:"Mitoma",name:"10 · Kaoru Mitoma"},{key:"Kubo",name:"7 · Takefusa Kubo"},{key:"Doan",name:"8 · Ritsu Dōan"}] },
  { name:"Suecia", name_en:"Sweden",             slug:"sweden",       flag:"SWE", players:[{key:"Isak",name:"10 · Alexander Isak"},{key:"Gyokeres",name:"9 · Viktor Gyökeres"},{key:"Karlsson",name:"11 · Jesper Karlsson"}] },
  { name:"Túnez", name_en:"Tunisia",              slug:"tunisia",      flag:"TUN", players:[{key:"Msakni",name:"7 · Youssef Msakni"},{key:"Jebali",name:"9 · Issam Jebali"}] },
  { name:"Bélgica", name_en:"Belgium",            slug:"belgium",      flag:"BEL", players:[{key:"DeBruyne",name:"7 · Kevin De Bruyne"},{key:"Lukaku",name:"9 · Romelu Lukaku"},{key:"Doku",name:"11 · Jérémy Doku"}] },
  { name:"Egipto", name_en:"Egypt",             slug:"egypt",        flag:"EGY", players:[{key:"Salah",name:"10 · Mohamed Salah"},{key:"Trezeguet",name:"11 · Trezeguet"},{key:"Mostafa",name:"9 · Mostafa Mohamed"}] },
  { name:"RI de Irán", name_en:"Iran",         slug:"iran",         flag:"IRN", players:[{key:"Taremi",name:"9 · Mehdi Taremi"},{key:"Jahanbakhsh",name:"7 · Alireza Jahanbakhsh"}] },
  { name:"Nueva Zelanda", name_en:"New Zealand",      slug:"new-zealand",  flag:"NZL", players:[{key:"Wood",name:"9 · Chris Wood"},{key:"Cacace",name:"7 · Liberato Cacace"}] },
  { name:"España", name_en:"Spain",             slug:"spain",        flag:"ESP", players:[{key:"Yamal",name:"10 · Lamine Yamal"},{key:"Nico",name:"17 · Nico Williams"},{key:"Morata",name:"7 · Álvaro Morata"},{key:"Rodri",name:"16 · Rodri"},{key:"Olmo",name:"8 · Dani Olmo"},{key:"Pedri",name:"26 · Pedri"}] },
  { name:"Cabo Verde", name_en:"Cabo Verde",         slug:"cape-verde",   flag:"CPV", players:[{key:"Mendes",name:"7 · Ryan Mendes"},{key:"Tavares",name:"11 · Garry Rodrigues"}] },
  { name:"Arabia Saudí", name_en:"Saudi Arabia",       slug:"saudi-arabia", flag:"KSA", players:[{key:"AlDawsari",name:"11 · Salem Al-Dawsari"},{key:"Firas",name:"9 · Firas Al-Buraikan"}] },
  { name:"Uruguay", name_en:"Uruguay",            slug:"uruguay",      flag:"URU", players:[{key:"Nunez",name:"9 · Darwin Núñez"},{key:"Valverde",name:"8 · F. Valverde"},{key:"Suarez",name:"9 · Luis Suárez"},{key:"Araujo",name:"4 · R. Araújo"}] },
  { name:"Francia", name_en:"France",            slug:"france",       flag:"FRA", players:[{key:"Mbappe",name:"10 · Kylian Mbappé"},{key:"Griezmann",name:"7 · Antoine Griezmann"},{key:"Dembele",name:"11 · Ousmane Dembélé"},{key:"Giroud",name:"9 · Olivier Giroud"}] },
  { name:"Senegal", name_en:"Senegal",            slug:"senegal",      flag:"SEN", players:[{key:"Mane",name:"10 · Sadio Mané"},{key:"Dia",name:"9 · Boulaye Dia"},{key:"Diatta",name:"7 · Lamine Diatta"}] },
  { name:"Irak", name_en:"Iraq",               slug:"irak",         flag:"IRQ", players:[{key:"AlAmmari",name:"20 · Amir Al-Ammari"},{key:"AlHamadi",name:"9 · Ali Al-Hamadi"}] },
  { name:"Noruega", name_en:"Norway",            slug:"norway",       flag:"NOR", players:[{key:"Haaland",name:"9 · Erling Haaland"},{key:"Odegaard",name:"8 · M. Ødegaard"},{key:"Sorloth",name:"11 · A. Sørloth"}] },
  { name:"Argentina", name_en:"Argentina",          slug:"argentina",    flag:"ARG", players:[{key:"Messi",name:"10 · Lionel Messi"},{key:"Alvarez",name:"9 · Julián Álvarez"},{key:"DePaul",name:"7 · Rodrigo De Paul"},{key:"MacAllister",name:"20 · A. Mac Allister"},{key:"Dibu",name:"23 · E. Martínez"}] },
  { name:"Argelia", name_en:"Algeria",            slug:"algeria",      flag:"ALG", players:[{key:"Mahrez",name:"7 · Riyad Mahrez"},{key:"Belaili",name:"17 · Youcef Belaïli"}] },
  { name:"Austria", name_en:"Austria",            slug:"austria",      flag:"AUT", players:[{key:"Sabitzer",name:"8 · Marcel Sabitzer"},{key:"Gregoritsch",name:"9 · M. Gregoritsch"},{key:"Arnautovic",name:"19 · M. Arnautović"}] },
  { name:"Jordania", name_en:"Jordan",           slug:"jordan",       flag:"JOR", players:[{key:"AlTaamari",name:"7 · Musa Al-Taamari"},{key:"Bani",name:"9 · Hamza Bani"}] },
  { name:"Portugal", name_en:"Portugal",           slug:"portugal",     flag:"POR", players:[{key:"Ronaldo",name:"7 · C. Ronaldo"},{key:"Bruno",name:"8 · Bruno Fernandes"},{key:"Leao",name:"17 · Rafael Leão"},{key:"Dias",name:"3 · Rúben Dias"}] },
  { name:"RD Congo", name_en:"DR Congo",slug:"drc-jam",     flag:"COD", players:[{key:"Bakambu",name:"9 · Cédric Bakambu"},{key:"Wissa",name:"11 · Yoane Wissa"}] },
  { name:"Uzbekistán", name_en:"Uzbekistan",         slug:"uzbekistan",   flag:"UZB", players:[{key:"Shomurodov",name:"9 · Eldor Shomurodov"},{key:"Fayzullaev",name:"11 · A. Fayzullaev"}] },
  { name:"Colombia", name_en:"Colombia",           slug:"colombia",     flag:"COL", players:[{key:"Diaz",name:"7 · Luis Díaz"},{key:"James",name:"10 · James Rodríguez"},{key:"Borja",name:"9 · Miguel Borja"},{key:"Rios",name:"8 · Richard Ríos"}] },
  { name:"Inglaterra", name_en:"England",         slug:"england",      flag:"ENG", players:[{key:"Kane",name:"9 · Harry Kane"},{key:"Bellingham",name:"10 · Jude Bellingham"},{key:"Saka",name:"7 · Bukayo Saka"},{key:"Foden",name:"11 · Phil Foden"}] },
  { name:"Croacia", name_en:"Croatia",            slug:"croatia",      flag:"CRO", players:[{key:"Modric",name:"10 · Luka Modrić"},{key:"Kramaric",name:"9 · Andrej Kramarić"},{key:"Perisic",name:"4 · Ivan Perišić"}] },
  { name:"Ghana", name_en:"Ghana",              slug:"ghana",        flag:"GHA", players:[{key:"Kudus",name:"14 · Mohammed Kudus"},{key:"Partey",name:"5 · Thomas Partey"},{key:"Ayew",name:"9 · Jordan Ayew"}] },
  { name:"Panamá", name_en:"Panama",             slug:"panama",       flag:"PAN", players:[{key:"Carrasquilla",name:"8 · A. Carrasquilla"},{key:"Diaz",name:"9 · Ismael Díaz"},{key:"Blackburn",name:"11 · R. Blackburn"}] },
];

const GRUPOS = [
  { letra: "A", equipos: ["México", "Sudáfrica", "República de Corea", "República Checa"] },
  { letra: "B", equipos: ["Canadá", "Bosnia y Herzegovina", "Catar", "Suiza"] },
  { letra: "C", equipos: ["Brasil", "Marruecos", "Haití", "Escocia"] },
  { letra: "D", equipos: ["Estados Unidos", "Paraguay", "Australia", "Turquía"] },
  { letra: "E", equipos: ["Alemania", "Curazao", "Costa de Marfil", "Ecuador"] },
  { letra: "F", equipos: ["Países Bajos", "Japón", "Suecia", "Túnez"] },
  { letra: "G", equipos: ["Bélgica", "Egipto", "RI de Irán", "Nueva Zelanda"] },
  { letra: "H", equipos: ["España", "Cabo Verde", "Arabia Saudí", "Uruguay"] },
  { letra: "I", equipos: ["Francia", "Senegal", "Irak", "Noruega"] },
  { letra: "J", equipos: ["Argentina", "Argelia", "Austria", "Jordania"] },
  { letra: "K", equipos: ["Portugal", "RD Congo", "Uzbekistán", "Colombia"] },
  { letra: "L", equipos: ["Inglaterra", "Croacia", "Ghana", "Panamá"] }
];

const PARTIDOS = [
  // Grupo A
  { group:"A", home:"México", away:"Sudáfrica", date:"2026-06-11T15:00:00", stadium:"Estadio Ciudad de México", realHome:0, realAway:0 },
  { group:"A", home:"República de Corea", away:"República Checa", date:"2026-06-11T22:00:00", stadium:"Estadio Guadalajara", realHome:0, realAway:0 },
  { group:"A", home:"República Checa", away:"Sudáfrica", date:"2026-06-18T12:00:00", stadium:"Atlanta Stadium", realHome:0, realAway:0 },
  { group:"A", home:"México", away:"República de Corea", date:"2026-06-18T21:00:00", stadium:"Estadio Guadalajara", realHome:0, realAway:0 },
  { group:"A", home:"República Checa", away:"México", date:"2026-06-24T21:00:00", stadium:"Estadio Ciudad de México", realHome:0, realAway:0 },
  { group:"A", home:"Sudáfrica", away:"República de Corea", date:"2026-06-24T21:00:00", stadium:"Estadio Monterrey", realHome:0, realAway:0 },
  // Grupo B
  { group:"B", home:"Canadá", away:"Bosnia y Herzegovina", date:"2026-06-12T15:00:00", stadium:"Toronto Stadium", realHome:0, realAway:0 },
  { group:"B", home:"Catar", away:"Suiza", date:"2026-06-13T15:00:00", stadium:"San Francisco Bay Area Stadium", realHome:0, realAway:0 },
  { group:"B", home:"Suiza", away:"Bosnia y Herzegovina", date:"2026-06-18T15:00:00", stadium:"Los Angeles Stadium", realHome:0, realAway:0 },
  { group:"B", home:"Canadá", away:"Catar", date:"2026-06-18T18:00:00", stadium:"BC Place Vancouver", realHome:0, realAway:0 },
  { group:"B", home:"Suiza", away:"Canadá", date:"2026-06-24T15:00:00", stadium:"BC Place Vancouver", realHome:0, realAway:0 },
  { group:"B", home:"Bosnia y Herzegovina", away:"Catar", date:"2026-06-24T15:00:00", stadium:"Seattle Stadium", realHome:0, realAway:0 },
  // Grupo C
  { group:"C", home:"Brasil", away:"Marruecos", date:"2026-06-13T18:00:00", stadium:"Nueva York Nueva Jersey Stadium", realHome:0, realAway:0 },
  { group:"C", home:"Haití", away:"Escocia", date:"2026-06-13T21:00:00", stadium:"Boston Stadium", realHome:0, realAway:0 },
  { group:"C", home:"Escocia", away:"Marruecos", date:"2026-06-19T18:00:00", stadium:"Boston Stadium", realHome:0, realAway:0 },
  { group:"C", home:"Brasil", away:"Haití", date:"2026-06-19T21:00:00", stadium:"Philadelphia Stadium", realHome:0, realAway:0 },
  { group:"C", home:"Brasil", away:"Escocia", date:"2026-06-24T18:00:00", stadium:"Miami Stadium", realHome:0, realAway:0 },
  { group:"C", home:"Marruecos", away:"Haití", date:"2026-06-24T18:00:00", stadium:"Atlanta Stadium", realHome:0, realAway:0 },
  // Grupo D
  { group:"D", home:"Estados Unidos", away:"Paraguay", date:"2026-06-12T21:00:00", stadium:"Los Angeles Stadium", realHome:0, realAway:0 },
  { group:"D", home:"Australia", away:"Turquía", date:"2026-06-13T00:00:00", stadium:"BC Place Vancouver", realHome:0, realAway:0 },
  { group:"D", home:"Estados Unidos", away:"Australia", date:"2026-06-19T15:00:00", stadium:"Seattle Stadium", realHome:0, realAway:0 },
  { group:"D", home:"Turquía", away:"Paraguay", date:"2026-06-19T00:00:00", stadium:"San Francisco Bay Area Stadium", realHome:0, realAway:0 },
  { group:"D", home:"Turquía", away:"Estados Unidos", date:"2026-06-25T22:00:00", stadium:"Los Angeles Stadium", realHome:0, realAway:0 },
  { group:"D", home:"Paraguay", away:"Australia", date:"2026-06-25T22:00:00", stadium:"San Francisco Bay Area Stadium", realHome:0, realAway:0 },
  // Grupo E
  { group:"E", home:"Alemania", away:"Curazao", date:"2026-06-14T13:00:00", stadium:"Houston Stadium", realHome:0, realAway:0 },
  { group:"E", home:"Costa de Marfil", away:"Ecuador", date:"2026-06-14T19:00:00", stadium:"Philadelphia Stadium", realHome:0, realAway:0 },
  { group:"E", home:"Alemania", away:"Costa de Marfil", date:"2026-06-20T16:00:00", stadium:"Toronto Stadium", realHome:0, realAway:0 },
  { group:"E", home:"Ecuador", away:"Curazao", date:"2026-06-20T22:00:00", stadium:"Kansas City Stadium", realHome:0, realAway:0 },
  { group:"E", home:"Curazao", away:"Costa de Marfil", date:"2026-06-25T16:00:00", stadium:"Philadelphia Stadium", realHome:0, realAway:0 },
  { group:"E", home:"Ecuador", away:"Alemania", date:"2026-06-25T16:00:00", stadium:"Nueva York Nueva Jersey Stadium", realHome:0, realAway:0 },
  // Grupo F
  { group:"F", home:"Países Bajos", away:"Japón", date:"2026-06-14T16:00:00", stadium:"Dallas Stadium", realHome:0, realAway:0 },
  { group:"F", home:"Suecia", away:"Túnez", date:"2026-06-14T22:00:00", stadium:"Estadio Monterrey", realHome:0, realAway:0 },
  { group:"F", home:"Países Bajos", away:"Suecia", date:"2026-06-20T13:00:00", stadium:"Houston Stadium", realHome:0, realAway:0 },
  { group:"F", home:"Túnez", away:"Japón", date:"2026-06-20T00:00:00", stadium:"Estadio Monterrey", realHome:0, realAway:0 },
  { group:"F", home:"Japón", away:"Suecia", date:"2026-06-25T19:00:00", stadium:"Dallas Stadium", realHome:0, realAway:0 },
  { group:"F", home:"Túnez", away:"Países Bajos", date:"2026-06-25T19:00:00", stadium:"Kansas City Stadium", realHome:0, realAway:0 },
  // Grupo G
  { group:"G", home:"Bélgica", away:"Egipto", date:"2026-06-15T15:00:00", stadium:"Seattle Stadium", realHome:0, realAway:0 },
  { group:"G", home:"RI de Irán", away:"Nueva Zelanda", date:"2026-06-15T21:00:00", stadium:"Los Angeles Stadium", realHome:0, realAway:0 },
  { group:"G", home:"Bélgica", away:"RI de Irán", date:"2026-06-21T15:00:00", stadium:"Los Angeles Stadium", realHome:0, realAway:0 },
  { group:"G", home:"Nueva Zelanda", away:"Egipto", date:"2026-06-21T21:00:00", stadium:"BC Place Vancouver", realHome:0, realAway:0 },
  { group:"G", home:"Egipto", away:"RI de Irán", date:"2026-06-26T23:00:00", stadium:"Seattle Stadium", realHome:0, realAway:0 },
  { group:"G", home:"Nueva Zelanda", away:"Bélgica", date:"2026-06-26T23:00:00", stadium:"BC Place Vancouver", realHome:0, realAway:0 },
  // Grupo H
  { group:"H", home:"España", away:"Cabo Verde", date:"2026-06-15T12:00:00", stadium:"Atlanta Stadium", realHome:0, realAway:0 },
  { group:"H", home:"Arabia Saudí", away:"Uruguay", date:"2026-06-15T18:00:00", stadium:"Miami Stadium", realHome:0, realAway:0 },
  { group:"H", home:"España", away:"Arabia Saudí", date:"2026-06-21T12:00:00", stadium:"Atlanta Stadium", realHome:0, realAway:0 },
  { group:"H", home:"Uruguay", away:"Cabo Verde", date:"2026-06-21T18:00:00", stadium:"Miami Stadium", realHome:0, realAway:0 },
  { group:"H", home:"Cabo Verde", away:"Arabia Saudí", date:"2026-06-26T20:00:00", stadium:"Houston Stadium", realHome:0, realAway:0 },
  { group:"H", home:"Uruguay", away:"España", date:"2026-06-26T20:00:00", stadium:"Estadio Guadalajara", realHome:0, realAway:0 },
  // Grupo I
  { group:"I", home:"Francia", away:"Senegal", date:"2026-06-16T15:00:00", stadium:"Nueva York Nueva Jersey Stadium", realHome:0, realAway:0 },
  { group:"I", home:"Irak", away:"Noruega", date:"2026-06-16T18:00:00", stadium:"Boston Stadium", realHome:0, realAway:0 },
  { group:"I", home:"Francia", away:"Irak", date:"2026-06-22T17:00:00", stadium:"Philadelphia Stadium", realHome:0, realAway:0 },
  { group:"I", home:"Noruega", away:"Senegal", date:"2026-06-22T20:00:00", stadium:"Nueva York Nueva Jersey Stadium", realHome:0, realAway:0 },
  { group:"I", home:"Noruega", away:"Francia", date:"2026-06-26T15:00:00", stadium:"Boston Stadium", realHome:0, realAway:0 },
  { group:"I", home:"Senegal", away:"Irak", date:"2026-06-26T15:00:00", stadium:"Toronto Stadium", realHome:0, realAway:0 },
  // Grupo J
  { group:"J", home:"Argentina", away:"Argelia", date:"2026-06-16T21:00:00", stadium:"Kansas City Stadium", realHome:0, realAway:0 },
  { group:"J", home:"Austria", away:"Jordania", date:"2026-06-16T00:00:00", stadium:"San Francisco Bay Area Stadium", realHome:0, realAway:0 },
  { group:"J", home:"Argentina", away:"Austria", date:"2026-06-22T13:00:00", stadium:"Dallas Stadium", realHome:0, realAway:0 },
  { group:"J", home:"Jordania", away:"Argelia", date:"2026-06-22T23:00:00", stadium:"San Francisco Bay Area Stadium", realHome:0, realAway:0 },
  { group:"J", home:"Argelia", away:"Austria", date:"2026-06-27T22:00:00", stadium:"Kansas City Stadium", realHome:0, realAway:0 },
  { group:"J", home:"Jordania", away:"Argentina", date:"2026-06-27T22:00:00", stadium:"Dallas Stadium", realHome:0, realAway:0 },
  // Grupo K
  { group:"K", home:"Portugal", away:"RD Congo", date:"2026-06-17T13:00:00", stadium:"Houston Stadium", realHome:0, realAway:0 },
  { group:"K", home:"Uzbekistán", away:"Colombia", date:"2026-06-17T22:00:00", stadium:"Estadio Ciudad de México", realHome:0, realAway:0 },
  { group:"K", home:"Portugal", away:"Uzbekistán", date:"2026-06-23T13:00:00", stadium:"Houston Stadium", realHome:0, realAway:0 },
  { group:"K", home:"Colombia", away:"RD Congo", date:"2026-06-23T22:00:00", stadium:"Estadio Guadalajara", realHome:0, realAway:0 },
  { group:"K", home:"Colombia", away:"Portugal", date:"2026-06-27T19:30:00", stadium:"Miami Stadium", realHome:0, realAway:0 },
  { group:"K", home:"RD Congo", away:"Uzbekistán", date:"2026-06-27T19:30:00", stadium:"Atlanta Stadium", realHome:0, realAway:0 },
  // Grupo L
  { group:"L", home:"Inglaterra", away:"Croacia", date:"2026-06-17T16:00:00", stadium:"Dallas Stadium", realHome:0, realAway:0 },
  { group:"L", home:"Ghana", away:"Panamá", date:"2026-06-17T19:00:00", stadium:"Toronto Stadium", realHome:0, realAway:0 },
  { group:"L", home:"Inglaterra", away:"Ghana", date:"2026-06-23T16:00:00", stadium:"Boston Stadium", realHome:0, realAway:0 },
  { group:"L", home:"Panamá", away:"Croacia", date:"2026-06-23T19:00:00", stadium:"Toronto Stadium", realHome:0, realAway:0 },
  { group:"L", home:"Panamá", away:"Inglaterra", date:"2026-06-27T17:00:00", stadium:"Nueva York Nueva Jersey Stadium", realHome:0, realAway:0 },
  { group:"L", home:"Croacia", away:"Ghana", date:"2026-06-27T17:00:00", stadium:"Philadelphia Stadium", realHome:0, realAway:0 }
];

// ========== ESTADIOS MUNDIAL 2026 ==========
// 16 sedes oficiales. Lookup por venue_id (cuando PARTIDOS lo lleve) o por
// _STADIUM_BY_VENUE_TEXT (normaliza el string actual de PARTIDOS.stadium).
const STADIUMS = [
  { id:'toronto',    name:'Estadio Toronto',                       city:'Toronto',          country:'CAN', capacity:45000, max_round:'dieciseisavos' },
  { id:'vancouver',  name:'BC Place',                              city:'Vancouver',        country:'CAN', capacity:54000, max_round:'octavos' },
  { id:'azteca',     name:'Estadio Ciudad de México (Azteca)',     city:'Ciudad de México', country:'MEX', capacity:83000, max_round:'octavos', notes:'INAUGURAL 11-jun' },
  { id:'guadalajara',name:'Estadio Akron Guadalajara',             city:'Zapopan',          country:'MEX', capacity:48000, max_round:'grupos' },
  { id:'monterrey',  name:'Estadio BBVA Monterrey',                city:'Guadalupe',        country:'MEX', capacity:53500, max_round:'dieciseisavos' },
  { id:'atlanta',    name:'Estadio Atlanta',                       city:'Atlanta',          country:'USA', capacity:75000, max_round:'semifinal' },
  { id:'boston',     name:'Estadio Boston',                        city:'Foxborough',       country:'USA', capacity:65000, max_round:'cuartos' },
  { id:'dallas',     name:'Estadio Dallas',                        city:'Arlington',        country:'USA', capacity:94000, max_round:'semifinal' },
  { id:'houston',    name:'Estadio Houston',                       city:'Houston',          country:'USA', capacity:72220, max_round:'octavos' },
  { id:'kansas',     name:'Estadio Kansas City',                   city:'Kansas City',      country:'USA', capacity:73000, max_round:'cuartos' },
  { id:'losangeles', name:'Estadio Los Ángeles',                   city:'Inglewood',        country:'USA', capacity:70000, max_round:'cuartos' },
  { id:'miami',      name:'Estadio Miami',                         city:'Miami Gardens',    country:'USA', capacity:65000, max_round:'cuartos', notes:'3er puesto 18-jul' },
  { id:'nyjersey',   name:'Estadio Nueva York / Nueva Jersey',     city:'East Rutherford',  country:'USA', capacity:82500, max_round:'final',    notes:'FINAL 19-jul' },
  { id:'philly',     name:'Estadio Filadelfia',                    city:'Filadelfia',       country:'USA', capacity:69000, max_round:'octavos' },
  { id:'sfbay',      name:'Estadio Bahía de San Francisco',        city:'Santa Clara',      country:'USA', capacity:71000, max_round:'dieciseisavos' },
  { id:'seattle',    name:'Estadio Seattle',                       city:'Seattle',          country:'USA', capacity:69000, max_round:'octavos' },
];

// Mapping del texto actual en PARTIDOS[].stadium → STADIUMS.id (legacy bridge).
// Cuando PARTIDOS migre a venue_id explícito, este map deja de usarse.
const _STADIUM_BY_VENUE_TEXT = {
  'Estadio Toronto':                 'toronto',
  'Toronto Stadium':                 'toronto',
  'BC Place Vancouver':              'vancouver',
  'BC Place':                        'vancouver',
  'Estadio Ciudad de México':        'azteca',
  'Estadio Azteca':                  'azteca',
  'Estadio Guadalajara':             'guadalajara',
  'Estadio Akron Guadalajara':       'guadalajara',
  'Estadio Monterrey':               'monterrey',
  'Estadio BBVA Monterrey':          'monterrey',
  'Atlanta Stadium':                 'atlanta',
  'Boston Stadium':                  'boston',
  'Dallas Stadium':                  'dallas',
  'Houston Stadium':                 'houston',
  'Kansas City Stadium':             'kansas',
  'Los Angeles Stadium':             'losangeles',
  'Miami Stadium':                   'miami',
  'Nueva York Nueva Jersey Stadium': 'nyjersey',
  'Philadelphia Stadium':            'philly',
  'San Francisco Bay Area Stadium':  'sfbay',
  'Seattle Stadium':                 'seattle',
};

// Helper público: dado un match de PARTIDOS, devuelve la fila STADIUMS o null.
function stadiumForMatch(m) {
  if (!m) return null;
  if (m.venue_id) {
    return STADIUMS.find(s => s.id === m.venue_id) || null;
  }
  const id = _STADIUM_BY_VENUE_TEXT[m.stadium];
  return id ? STADIUMS.find(s => s.id === id) || null : null;
}
// Exposición en window para classic scripts (const no se expone solo).
window.STADIUMS = STADIUMS;
window.stadiumForMatch = stadiumForMatch;

// ========== ESTADO GLOBAL ==========
  // ─────────────────────────────────────────────────────────────
  // ESTADO GLOBAL — predictions, iaPredictions, totalPoints
  // ─────────────────────────────────────────────────────────────
let predictions = {};
let boostPicks = {};  // { "2026-06-12": "México_Sudáfrica", ... }
let iaPredictions = {};
let totalPoints = 0;

async function saveBoostPicks() {
  // 1. Siempre guardar en localStorage como caché rápida
  try {
    const key = 'boostPicks_' + (window._currentLeagueId || 'default');
    localStorage.setItem(key, JSON.stringify(boostPicks));
  } catch(e) {}

  // 2. Sincronizar con Supabase (upsert por usuario/liga/día)
  try {
    const db = window._porraDb;
    const uid = window.currentUser?.id;
    const leagueId = window.getActiveLeagueId?.();
    if (!db || !uid || !leagueId) return;

    // Construir filas a upsert
    const rows = Object.entries(boostPicks).map(([date, matchId]) => ({
      user_id:    uid,
      league_id:  leagueId,
      match_id:   matchId,
      match_date: date,
    }));
    if (rows.length === 0) return;
    await db.from('boost_picks').upsert(rows, { onConflict: 'user_id,league_id,match_date' });
  } catch(e) {
    console.warn('[saveBoostPicks] Supabase error:', e.message);
  }
}

async function loadBoostPicks() {
  // 1. Cargar desde localStorage primero (respuesta inmediata)
  try {
    const key = 'boostPicks_' + (window._currentLeagueId || 'default');
    const raw = localStorage.getItem(key);
    boostPicks = raw ? JSON.parse(raw) : {};
  } catch(e) { boostPicks = {}; }

  // 2. Sobreescribir con datos de Supabase (fuente de verdad)
  try {
    const db = window._porraDb;
    const uid = window.currentUser?.id;
    const leagueId = window.getActiveLeagueId?.();
    if (!db || !uid || !leagueId) return;

    const { data } = await db
      .from('boost_picks')
      .select('match_date, match_id')
      .eq('user_id', uid)
      .eq('league_id', leagueId);

    if (data && data.length > 0) {
      boostPicks = {};
      data.forEach(row => { boostPicks[row.match_date] = row.match_id; });
      // Actualizar caché local
      try {
        const key = 'boostPicks_' + (window._currentLeagueId || 'default');
        localStorage.setItem(key, JSON.stringify(boostPicks));
      } catch(e) {}
    }
  } catch(e) {
    console.warn('[loadBoostPicks] Supabase error:', e.message);
  }
}

// ========== FUNCIONES AUXILIARES ==========
function getMatchKey(m) { return `${m.group}_${m.home}_${m.away}`; }
function getMySign(pred) { if(pred.l===null||pred.v===null) return null; return pred.l>pred.v?'1':pred.l<pred.v?'2':'X'; }
// F.4 — Bonus +1pt cuando el user predice en contra de la IA y acierta.
// Condiciones (todas obligatorias):
//   1. ia.sign !== null / undefined (la IA tiene pronóstico)
//   2. mySign !== ia.sign            (user predice DIFERENTE de la IA)
//   3. mySign === realSign           (user acierta el signo real)
//
// Casos documentados:
//   A) user=1, ia=1, real=1 → false (user coincide con IA, sin bonus)
//   B) user=2, ia=1, real=2 → true  (user contra-IA y acierta → +1pt)
//   C) user=2, ia=1, real=X → false (user contra-IA pero falla → 0)
//   D) user=1, ia=null, real=1 → false (sin IA no hay bonus)
function iaBonusWillApply(matchKey, pred, realL, realR) {
  const ia = iaPredictions[matchKey];
  if (!ia || !ia.sign) return false;                      // caso D
  if (ia.sign !== '1' && ia.sign !== 'X' && ia.sign !== '2') return false;
  const mySign = getMySign(pred);
  if (!mySign) return false;
  if (mySign === ia.sign) return false;                   // caso A
  const realSign = (realL > realR) ? '1' : (realL < realR) ? '2' : 'X';
  return mySign === realSign;                             // caso B (true) / caso C (false)
}
// ═══════════════════════════════════════════════════════════
// MOTOR DE PUNTUACIÓN — Porra Mundial 2026
// ═══════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // SEGURIDAD — escapeHtml()
  // ─────────────────────────────────────────────────────────────
// ── Seguridad: escape de HTML para datos de usuario ──────────────────────────
// Evita XSS stored al insertar datos de la DB directamente en innerHTML
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#x60;');
}

window.PHRASES_GRUPO = {
  empty: [
    "Cada quiniela empieza con un primer marcador.",
    "La porra te espera. Pon el primer pronóstico.",
    "Empieza el arte de la predicción."
  ],
  low: [
    "Cuidado, que la cosa se pone seria.",
    "Afinando el olfato futbolero…",
    "Intuición de experto en marcha."
  ],
  mid: [
    "Ya hueles a ojeador de cantera.",
    "Tu clarividencia impresiona.",
    "La banqueta del Madrid te querría."
  ],
  high: [
    "Una más y este grupo es tuyo.",
    "Estás a un pronóstico de la gloria.",
    "Queda la última — no falles."
  ],
  done: [
    "Grupo completo. Pura casta quinielera.",
    "Pronósticos dignos de todo un ojeador de fútbol.",
    "Clínico. El Mundial te lo sabes."
  ]
};

// === [B10-traceability] Predictor ranking helpers ===
//
// Vistas backend (migración 20260430200000_predictor_ranking_views.sql):
//   v_league_member_count(league_id, human_count, total_count)
//   v_user_global_rank(user_id, total_pts, rank_global, total_users)
//
// loadPredictorRankingData() lo invoca mountPredShell() en ui-pred-shell.js
// y popla window._predictorRanking. Pre-Mundial: total_pts=0 para todos →
// todos empatados, leagueRank=1 si liga tiene miembros. Mid-Mundial
// requerirá sprint B11 (user_points_cache real) para diferenciar.
//
// Defensiva: si window._porraDb no está disponible o falta league/user,
// devuelve null y mantiene compat con render fallback de #fc-pred-tile
// ("Líder · Liga" / "— · Global").

var _leagueMemberCountCache = {};
var _globalRankCache = {};

async function loadLeagueMemberCount(leagueId) {
  if (!leagueId) return null;
  if (_leagueMemberCountCache[leagueId]) return _leagueMemberCountCache[leagueId];
  if (!window._porraDb) return null;
  var res = await window._porraDb
    .from('v_league_member_count')
    .select('human_count,total_count')
    .eq('league_id', leagueId)
    .maybeSingle();
  if (res.error) {
    console.warn('[predictor] loadLeagueMemberCount error', res.error);
    return null;
  }
  _leagueMemberCountCache[leagueId] = res.data;
  return res.data;
}

async function loadGlobalRank(userId) {
  if (!userId) return null;
  if (_globalRankCache[userId]) return _globalRankCache[userId];
  if (!window._porraDb) return null;
  var res = await window._porraDb
    .from('v_user_global_rank')
    .select('rank_global,total_users')
    .eq('user_id', userId)
    .maybeSingle();
  if (res.error) {
    console.warn('[predictor] loadGlobalRank error', res.error);
    return null;
  }
  _globalRankCache[userId] = res.data;
  return res.data;
}

async function loadPredictorRankingData() {
  var leagueId = window._activeLeague && window._activeLeague.id;
  var userId = window.currentUser && window.currentUser.id;
  if (!leagueId || !userId) return null;

  var results = await Promise.all([
    loadLeagueMemberCount(leagueId),
    loadGlobalRank(userId)
  ]);
  var leagueData = results[0];
  var globalData = results[1];

  var memberCount = leagueData
    ? Number(leagueData.human_count || leagueData.total_count || 0)
    : 0;
  // Pre-Mundial: todos empatados a 0 pts → user es 1º si liga tiene miembros.
  var leagueRank = memberCount > 0 ? 1 : 0;

  window._predictorRanking = {
    leagueMembers: memberCount,
    leagueRank: leagueRank,
    globalRank: globalData ? Number(globalData.rank_global || 0) : 0,
    globalTotal: globalData ? Number(globalData.total_users || 0) : 0
  };
  return window._predictorRanking;
}

window.loadPredictorRankingData = loadPredictorRankingData;

// === [Sprint A · Group 3] loadLeagueRanking — lista completa de miembros
//     de la liga con nombre + is_bot + posición. Pre-Mundial todos a 0 pts
//     (Sprint B: leer puntos reales de user_points_cache cuando exista). ===
async function loadLeagueRanking(leagueId) {
  if (!leagueId || !window._porraDb) return [];
  var db = window._porraDb;
  var res = await db
    .from('league_members')
    .select('user_id, profiles(nombre, is_bot)')
    .eq('league_id', leagueId);
  if (res.error) {
    console.warn('[loadLeagueRanking] error', res.error.message);
    return [];
  }
  var members = res.data || [];
  // Orden natural por nombre alfabético — Pre-Mundial todos empatados a 0 pts.
  // Sprint B: ORDER BY points DESC.
  var rows = members.map(function (m) {
    return {
      user_id: m.user_id,
      nombre: (m.profiles && m.profiles.nombre) ? m.profiles.nombre : 'Usuario',
      is_bot: !!(m.profiles && m.profiles.is_bot),
      points: 0
    };
  });
  rows.sort(function (a, b) {
    return a.nombre.localeCompare(b.nombre, 'es');
  });
  rows.forEach(function (r, i) { r.position = i + 1; });
  return rows;
}
window.loadLeagueRanking = loadLeagueRanking;

// === [Sprint A · Group 4] loadLeagueHighlights — 3 frases dinámicas
//     contextuales para la sección DESTACADOS DE TU LIGA. ===
async function loadLeagueHighlights(leagueId, userId) {
  if (!leagueId || !userId || !window._porraDb) return [];
  var db = window._porraDb;
  var items = [];

  // Item A — Pick contrarian en KO: equipos que solo 1-2 miembros eligen
  // y el usuario actual está entre ellos.
  try {
    var koRes = await db
      .from('ko_predictions')
      .select('user_id, winner_team, round')
      .eq('league_id', leagueId);
    var koPreds = (koRes && koRes.data) || [];
    if (koPreds.length > 0) {
      var byTeam = {};
      for (var i = 0; i < koPreds.length; i++) {
        var t = koPreds[i].winner_team;
        if (!t) continue;
        if (!byTeam[t]) byTeam[t] = { users: [], round: koPreds[i].round || 'Eliminatorias' };
        if (byTeam[t].users.indexOf(koPreds[i].user_id) === -1) byTeam[t].users.push(koPreds[i].user_id);
      }
      var teams = Object.keys(byTeam);
      for (var j = 0; j < teams.length; j++) {
        var info = byTeam[teams[j]];
        if ((info.users.length === 1 || info.users.length === 2) && info.users.indexOf(userId) !== -1) {
          if (info.users.length === 1) {
            items.push({ icon: '🎯', text: 'Solo tú apuestas por ' + teams[j] + ' en ' + info.round + '. El resto se ríe.' });
          } else {
            items.push({ icon: '🎯', text: 'Solo tú y otro apostáis por ' + teams[j] + ' en ' + info.round + '. El resto se ríe.' });
          }
          break;
        }
      }
    }
  } catch (e) { console.warn('[highlights] item A', e); }

  // Item B — Coincidencia campeón.
  try {
    var awRes = await db
      .from('award_picks')
      .select('user_id, champion')
      .eq('league_id', leagueId);
    var aw = (awRes && awRes.data) || [];
    var mine = aw.find ? aw.find(function (a) { return a.user_id === userId; }) : null;
    if (mine && mine.champion) {
      var others = aw.filter(function (a) { return a.champion === mine.champion && a.user_id !== userId; }).length;
      var total = aw.length;
      if (others === 0) {
        items.push({ icon: '🥇', text: 'Solo tú apuestas por ' + mine.champion + ' campeón.' });
      } else {
        items.push({ icon: '🥇', text: 'Tu campeón ' + mine.champion + ' coincide con ' + others + ' de ' + total + ' de tu liga.' });
      }
    }
  } catch (e) { console.warn('[highlights] item B', e); }

  // Item C — IA Zayu en top 3 (depende de window._leagueRanking poblado).
  try {
    var ranking = window._leagueRanking || [];
    var bot = ranking.find ? ranking.find(function (r) { return r.is_bot === true; }) : null;
    if (bot && bot.position && bot.position <= 3) {
      items.push({ icon: '🤖', text: 'IA Zayu va Nº' + bot.position + ' — atento, te puede pasar.' });
    }
  } catch (e) { console.warn('[highlights] item C', e); }

  // Fallback hasta llegar a 3.
  if (items.length < 3) {
    try {
      var lmRes = await db
        .from('league_members')
        .select('porra_cerrada')
        .eq('league_id', leagueId);
      var lm = (lmRes && lmRes.data) || [];
      var cerradas = lm.filter(function (m) { return m.porra_cerrada === true; }).length;
      var totalLm = lm.length;
      var pendientes = totalLm - cerradas;
      while (items.length < 3) {
        items.push({ icon: '📊', text: 'Tu liga tiene ' + cerradas + ' porras cerradas / ' + pendientes + ' pendientes.' });
        break;
      }
    } catch (e) { console.warn('[highlights] fallback', e); }
  }

  while (items.length < 3) items.push({ icon: '📊', text: 'Tu liga está lista para jugar.' });
  return items.slice(0, 3);
}
window.loadLeagueHighlights = loadLeagueHighlights;

// === [B11-trionda] getMundialProgress() — calcula progreso del Mundial 2026
//     basado en live_scores. Lo consume ui-pred-shell.js para renderizar el
//     timeline con balón Trionda. ===
//
// Algoritmo:
//   - Pre-Mundial (Date.now() < KICKOFF) o sin _porraDb → fallback prematch.
//   - Query live_scores: status='finished' AND is_historic=false.
//   - Detección por match_key:
//       * `wc2026_g[A-L]_*` → grupos (formato confirmado en repo).
//       * KO match_keys aún sin formato definido (IDs SofaScore llegan
//         ~28 jun 2026); se cuentan en total y se distribuyen lineal en
//         phases 1-5 según rangos cronológicos esperados (1-16 → r32,
//         17-24 → r16, 25-28 → qf, 29-30 → sf, 31-32 → final).
//   - matchesPlayed >= 104 → ballState='finished' + badgeText placeholder.
//   - Mock QA: window.__PRED_MOCK = { matchesPlayed: 23 } sobreescribe la
//     query (útil para validar smoke con el balón en distintas posiciones).
//
// IIFE para no contaminar window con KICKOFF_TS_MUNDIAL/TOTAL_MATCHES/
// PHASES_PROGRESS (que también declara ui-pred-shell.js dentro de su IIFE).

(function () {
  var KICKOFF_TS_MUNDIAL = Date.UTC(2026, 5, 11, 20, 0, 0);
  var TOTAL_MATCHES = 104;
  var PHASES_PROGRESS = [
    { idx: 0, key: 'groups', label: 'Grupos', total: 72 },
    { idx: 1, key: 'r32',    label: '1/16',   total: 16 },
    { idx: 2, key: 'r16',    label: '1/8',    total: 8  },
    { idx: 3, key: 'qf',     label: '1/4',    total: 4  },
    { idx: 4, key: 'sf',     label: '1/2',    total: 2  },
    { idx: 5, key: 'final',  label: 'Final',  total: 2  }
  ];

  function _phaseLabelLong(key) {
    switch (key) {
      case 'groups': return 'Grupos';
      case 'r32':    return 'Dieciseisavos';
      case 'r16':    return 'Octavos';
      case 'qf':     return 'Cuartos';
      case 'sf':     return 'Semis';
      case 'final':  return 'Final';
      default:       return 'Grupos';
    }
  }

  function _buildMarks(currentPhaseIdx) {
    var marks = [];
    for (var i = 0; i < 6; i++) {
      marks.push({
        idx: i,
        label: PHASES_PROGRESS[i].label,
        isPassed: i < currentPhaseIdx,
        isCurrent: i === currentPhaseIdx,
        isFinalCurrent: i === 5 && currentPhaseIdx >= 5,
        leftPct: i * 20
      });
    }
    return marks;
  }

  function _buildPreMundialProgress() {
    var now = Date.now();
    var days = Math.max(0, Math.ceil((KICKOFF_TS_MUNDIAL - now) / 86400000));
    return {
      matchesPlayed: 0,
      pctGlobal: 0,
      currentPhaseIdx: 0,
      ballPos: 0,
      badgeText: 'Faltan ' + days + ' días',
      ballState: 'prematch',
      marks: _buildMarks(0)
    };
  }

  function _buildProgressFromMatchesPlayed(matchesPlayed, groupsFinishedKnown) {
    matchesPlayed = Number(matchesPlayed);
    if (!isFinite(matchesPlayed) || matchesPlayed < 0) {
      return _buildPreMundialProgress();
    }

    if (matchesPlayed >= TOTAL_MATCHES) {
      return {
        matchesPlayed: TOTAL_MATCHES,
        pctGlobal: 100,
        currentPhaseIdx: 6,
        ballPos: 100,
        badgeText: '🇦🇷 Campeón',
        ballState: 'finished',
        marks: _buildMarks(6)
      };
    }

    // B14-fix-phase-boundary: usar < estricto en lugar de <= para que la fase
    // avance EXACTAMENTE cuando la anterior se llena. Frontera inclusiva en la
    // fase entrante (matchesInCurrentPhase=0), no en la saliente.
    var currentPhaseIdx = 0;
    var matchesInCurrentPhase = 0;

    if (groupsFinishedKnown < 72 && matchesPlayed < 72) {
      currentPhaseIdx = 0;
      matchesInCurrentPhase = matchesPlayed;
    } else {
      var koPlayed = matchesPlayed - 72;
      if (koPlayed < 16) {
        currentPhaseIdx = 1;
        matchesInCurrentPhase = koPlayed;
      } else if (koPlayed < 24) {
        currentPhaseIdx = 2;
        matchesInCurrentPhase = koPlayed - 16;
      } else if (koPlayed < 28) {
        currentPhaseIdx = 3;
        matchesInCurrentPhase = koPlayed - 24;
      } else if (koPlayed < 30) {
        currentPhaseIdx = 4;
        matchesInCurrentPhase = koPlayed - 28;
      } else if (koPlayed < 32) {
        currentPhaseIdx = 5;
        matchesInCurrentPhase = koPlayed - 30;
      } else {
        currentPhaseIdx = 5;
        matchesInCurrentPhase = 2;
      }
    }

    var phase = PHASES_PROGRESS[currentPhaseIdx];
    var phaseTotal = phase && phase.total ? phase.total : 1;

    var ballPos = (currentPhaseIdx * 20) + (matchesInCurrentPhase / phaseTotal) * 20;
    if (ballPos < 0) ballPos = 0;
    if (ballPos > 100) ballPos = 100;

    var pctGlobal = Math.round((matchesPlayed / TOTAL_MATCHES) * 100);
    if (pctGlobal < 0) pctGlobal = 0;
    if (pctGlobal > 100) pctGlobal = 100;

    var ballState = matchesPlayed > 0 ? 'live' : 'prematch';
    var badgeText;
    if (matchesPlayed === 0) {
      var d = Math.max(0, Math.ceil((KICKOFF_TS_MUNDIAL - Date.now()) / 86400000));
      badgeText = d > 0 ? ('Faltan ' + d + ' días') : 'Grupos';
    } else {
      badgeText = _phaseLabelLong(phase.key);
    }

    return {
      matchesPlayed: matchesPlayed,
      pctGlobal: pctGlobal,
      currentPhaseIdx: currentPhaseIdx,
      phaseLabel: _phaseLabelLong(phase.key),
      ballPos: ballPos,
      badgeText: badgeText,
      ballState: ballState,
      marks: _buildMarks(currentPhaseIdx)
    };
  }

  async function getMundialProgress() {
    try {
      // Mock para QA manual: window.__PRED_MOCK = { matchesPlayed: 23 }
      if (typeof window !== 'undefined' && window.__PRED_MOCK
          && typeof window.__PRED_MOCK.matchesPlayed !== 'undefined') {
        var mockN = Number(window.__PRED_MOCK.matchesPlayed);
        if (isFinite(mockN)) {
          var mockGroupsFinished = (typeof window.__PRED_MOCK.groupsFinished === 'number')
            ? window.__PRED_MOCK.groupsFinished
            : Math.min(mockN, 72);
          return _buildProgressFromMatchesPlayed(mockN, mockGroupsFinished);
        }
      }

      if (Date.now() < KICKOFF_TS_MUNDIAL) {
        return _buildPreMundialProgress();
      }

      if (typeof window === 'undefined' || !window._porraDb) {
        return _buildPreMundialProgress();
      }

      var res = await window._porraDb
        .from('live_scores')
        .select('match_key')
        .eq('status', 'finished')
        .eq('is_historic', false);

      if (res && res.error) {
        console.warn('[getMundialProgress] Supabase error:', res.error.message || res.error);
        return _buildPreMundialProgress();
      }

      var rows = (res && res.data) ? res.data : [];
      var matchesPlayed = rows.length;

      var groupsRegex = /^wc2026_g[A-L]_/;
      var groupsFinished = 0;
      for (var i = 0; i < rows.length; i++) {
        var mk = rows[i] && rows[i].match_key;
        if (mk && groupsRegex.test(mk)) groupsFinished++;
      }

      return _buildProgressFromMatchesPlayed(matchesPlayed, groupsFinished);
    } catch (err) {
      console.warn('[getMundialProgress] excepción:', err && err.message ? err.message : err);
      return _buildPreMundialProgress();
    }
  }

  window.getMundialProgress = getMundialProgress;
})();

