/* main.js — Porra Mundial 2026 (módulo principal — subdividido)
   Contiene los sub-bloques: data.js + scoring.js + ui-groups.js + ko.js + ui-nav.js
   Ver cabeceras internas /* js-* */ para delimitación de cada sub-bloque.
   Líneas: ~3241
*/
'use strict';


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
  { name:"México",             slug:"mexico",       flag:"MEX", players:[{key:"Jimenez",name:"9 · Raúl Jiménez"},{key:"Lozano",name:"22 · H. Lozano"},{key:"Martin",name:"8 · C. Rodríguez"},{key:"Vega",name:"11 · A. Vega"}] },
  { name:"Sudáfrica",          slug:"south-africa", flag:"RSA", players:[{key:"Percy",name:"10 · Percy Tau"},{key:"Dolly",name:"11 · Keagan Dolly"}] },
  { name:"República de Corea", slug:"korea",        flag:"KOR", players:[{key:"Son",name:"7 · Son Heung-min"},{key:"Hwang",name:"9 · Hwang Ui-jo"},{key:"Lee",name:"11 · Lee Kang-in"}] },
  { name:"República Checa",    slug:"czech",        flag:"CZE", players:[{key:"Schick",name:"9 · Patrik Schick"},{key:"Hlozek",name:"11 · Adam Hložek"}] },
  { name:"Canadá",             slug:"canada",       flag:"CAN", players:[{key:"David",name:"9 · Jonathan David"},{key:"Davies",name:"3 · Alphonso Davies"},{key:"Buchanan",name:"11 · Tajon Buchanan"}] },
  { name:"Bosnia y Herzegovina",slug:"bosnia",      flag:"BIH", players:[{key:"Dzeko",name:"9 · Edin Džeko"},{key:"Pjanic",name:"8 · Miralem Pjanić"}] },
  { name:"Catar",              slug:"qatar",        flag:"QAT", players:[{key:"Afif",name:"11 · Akram Afif"},{key:"Almoez",name:"9 · Almoez Ali"}] },
  { name:"Suiza",              slug:"switzerland",  flag:"SUI", players:[{key:"Xhaka",name:"10 · Granit Xhaka"},{key:"Embolo",name:"7 · Breel Embolo"},{key:"Ndoye",name:"11 · Dan Ndoye"}] },
  { name:"Brasil",             slug:"brazil",       flag:"BRA", players:[{key:"Vinicius",name:"7 · Vinícius Jr."},{key:"Raphinha",name:"11 · Raphinha"},{key:"Rodrygo",name:"9 · Rodrygo"},{key:"Endrick",name:"19 · Endrick"}] },
  { name:"Marruecos",          slug:"morocco",      flag:"MAR", players:[{key:"Hakimi",name:"2 · Achraf Hakimi"},{key:"Ziyech",name:"7 · Hakim Ziyech"},{key:"EnNesyri",name:"9 · Youssef En-Nesyri"}] },
  { name:"Haití",              slug:"haiti",        flag:"HAI", players:[{key:"Nazon",name:"9 · Duckens Nazon"},{key:"Borgella",name:"11 · Frantzdy Pierrot"}] },
  { name:"Escocia",            slug:"scotland",     flag:"SCO", players:[{key:"McTominay",name:"8 · Scott McTominay"},{key:"Adams",name:"9 · Che Adams"},{key:"Christie",name:"11 · Ryan Christie"}] },
  { name:"Estados Unidos",     slug:"usa",          flag:"USA", players:[{key:"Pulisic",name:"10 · Christian Pulisic"},{key:"Reyna",name:"7 · Giovanni Reyna"},{key:"Balogun",name:"9 · Folarin Balogun"}] },
  { name:"Paraguay",           slug:"paraguay",     flag:"PAR", players:[{key:"Almiron",name:"10 · Miguel Almirón"},{key:"Sanabria",name:"9 · Antonio Sanabria"}] },
  { name:"Australia",          slug:"australia",    flag:"AUS", players:[{key:"Hrustic",name:"10 · Ajdin Hrustic"},{key:"Taggart",name:"9 · Adam Taggart"},{key:"Irvine",name:"8 · Jackson Irvine"}] },
  { name:"Turquía",            slug:"turkey",       flag:"TUR", players:[{key:"Calhanoglu",name:"10 · Hakan Çalhanoğlu"},{key:"Guler",name:"10 · Arda Güler"},{key:"Yildiz",name:"7 · Kenan Yıldız"}] },
  { name:"Alemania",           slug:"germany",      flag:"GER", players:[{key:"Wirtz",name:"10 · Florian Wirtz"},{key:"Musiala",name:"14 · Jamal Musiala"},{key:"Havertz",name:"9 · Kai Havertz"},{key:"Gnabry",name:"7 · Serge Gnabry"}] },
  { name:"Curazao",            slug:"curacao",      flag:"CUW", players:[{key:"Bacuna",name:"8 · Juninho Bacuna"},{key:"Fer",name:"6 · Leroy Fer"}] },
  { name:"Costa de Marfil",    slug:"ivory-coast",  flag:"CIV", players:[{key:"Pepe",name:"7 · Nicolas Pépé"},{key:"Cornet",name:"11 · Maxwel Cornet"},{key:"Gradel",name:"9 · Max-Alain Gradel"}] },
  { name:"Ecuador",            slug:"ecuador",      flag:"ECU", players:[{key:"Caicedo",name:"14 · Moisés Caicedo"},{key:"Valencia",name:"13 · Enner Valencia"},{key:"Plata",name:"11 · Gonzalo Plata"}] },
  { name:"Países Bajos",       slug:"netherlands",  flag:"NED", players:[{key:"Gakpo",name:"11 · Cody Gakpo"},{key:"VanDijk",name:"4 · Virgil van Dijk"},{key:"Simons",name:"9 · Xavi Simons"},{key:"Depay",name:"10 · Memphis Depay"}] },
  { name:"Japón",              slug:"japan",        flag:"JPN", players:[{key:"Mitoma",name:"10 · Kaoru Mitoma"},{key:"Kubo",name:"7 · Takefusa Kubo"},{key:"Doan",name:"8 · Ritsu Dōan"}] },
  { name:"Suecia",             slug:"sweden",       flag:"SWE", players:[{key:"Isak",name:"10 · Alexander Isak"},{key:"Gyokeres",name:"9 · Viktor Gyökeres"},{key:"Karlsson",name:"11 · Jesper Karlsson"}] },
  { name:"Túnez",              slug:"tunisia",      flag:"TUN", players:[{key:"Msakni",name:"7 · Youssef Msakni"},{key:"Jebali",name:"9 · Issam Jebali"}] },
  { name:"Bélgica",            slug:"belgium",      flag:"BEL", players:[{key:"DeBruyne",name:"7 · Kevin De Bruyne"},{key:"Lukaku",name:"9 · Romelu Lukaku"},{key:"Doku",name:"11 · Jérémy Doku"}] },
  { name:"Egipto",             slug:"egypt",        flag:"EGY", players:[{key:"Salah",name:"10 · Mohamed Salah"},{key:"Trezeguet",name:"11 · Trezeguet"},{key:"Mostafa",name:"9 · Mostafa Mohamed"}] },
  { name:"RI de Irán",         slug:"iran",         flag:"IRN", players:[{key:"Taremi",name:"9 · Mehdi Taremi"},{key:"Jahanbakhsh",name:"7 · Alireza Jahanbakhsh"}] },
  { name:"Nueva Zelanda",      slug:"new-zealand",  flag:"NZL", players:[{key:"Wood",name:"9 · Chris Wood"},{key:"Cacace",name:"7 · Liberato Cacace"}] },
  { name:"España",             slug:"spain",        flag:"ESP", players:[{key:"Yamal",name:"10 · Lamine Yamal"},{key:"Nico",name:"17 · Nico Williams"},{key:"Morata",name:"7 · Álvaro Morata"},{key:"Rodri",name:"16 · Rodri"},{key:"Olmo",name:"8 · Dani Olmo"},{key:"Pedri",name:"26 · Pedri"}] },
  { name:"Cabo Verde",         slug:"cape-verde",   flag:"CPV", players:[{key:"Mendes",name:"7 · Ryan Mendes"},{key:"Tavares",name:"11 · Garry Rodrigues"}] },
  { name:"Arabia Saudí",       slug:"saudi-arabia", flag:"KSA", players:[{key:"AlDawsari",name:"11 · Salem Al-Dawsari"},{key:"Firas",name:"9 · Firas Al-Buraikan"}] },
  { name:"Uruguay",            slug:"uruguay",      flag:"URU", players:[{key:"Nunez",name:"9 · Darwin Núñez"},{key:"Valverde",name:"8 · F. Valverde"},{key:"Suarez",name:"9 · Luis Suárez"},{key:"Araujo",name:"4 · R. Araújo"}] },
  { name:"Francia",            slug:"france",       flag:"FRA", players:[{key:"Mbappe",name:"10 · Kylian Mbappé"},{key:"Griezmann",name:"7 · Antoine Griezmann"},{key:"Dembele",name:"11 · Ousmane Dembélé"},{key:"Giroud",name:"9 · Olivier Giroud"}] },
  { name:"Senegal",            slug:"senegal",      flag:"SEN", players:[{key:"Mane",name:"10 · Sadio Mané"},{key:"Dia",name:"9 · Boulaye Dia"},{key:"Diatta",name:"7 · Lamine Diatta"}] },
  { name:"Irak",               slug:"irak",         flag:"IRQ", players:[{key:"AlAmmari",name:"20 · Amir Al-Ammari"},{key:"AlHamadi",name:"9 · Ali Al-Hamadi"}] },
  { name:"Noruega",            slug:"norway",       flag:"NOR", players:[{key:"Haaland",name:"9 · Erling Haaland"},{key:"Odegaard",name:"8 · M. Ødegaard"},{key:"Sorloth",name:"11 · A. Sørloth"}] },
  { name:"Argentina",          slug:"argentina",    flag:"ARG", players:[{key:"Messi",name:"10 · Lionel Messi"},{key:"Alvarez",name:"9 · Julián Álvarez"},{key:"DePaul",name:"7 · Rodrigo De Paul"},{key:"MacAllister",name:"20 · A. Mac Allister"},{key:"Dibu",name:"23 · E. Martínez"}] },
  { name:"Argelia",            slug:"algeria",      flag:"ALG", players:[{key:"Mahrez",name:"7 · Riyad Mahrez"},{key:"Belaili",name:"17 · Youcef Belaïli"}] },
  { name:"Austria",            slug:"austria",      flag:"AUT", players:[{key:"Sabitzer",name:"8 · Marcel Sabitzer"},{key:"Gregoritsch",name:"9 · M. Gregoritsch"},{key:"Arnautovic",name:"19 · M. Arnautović"}] },
  { name:"Jordania",           slug:"jordan",       flag:"JOR", players:[{key:"AlTaamari",name:"7 · Musa Al-Taamari"},{key:"Bani",name:"9 · Hamza Bani"}] },
  { name:"Portugal",           slug:"portugal",     flag:"POR", players:[{key:"Ronaldo",name:"7 · C. Ronaldo"},{key:"Bruno",name:"8 · Bruno Fernandes"},{key:"Leao",name:"17 · Rafael Leão"},{key:"Dias",name:"3 · Rúben Dias"}] },
  { name:"RD Congo",slug:"drc-jam",     flag:"COD", players:[{key:"Bakambu",name:"9 · Cédric Bakambu"},{key:"Wissa",name:"11 · Yoane Wissa"}] },
  { name:"Uzbekistán",         slug:"uzbekistan",   flag:"UZB", players:[{key:"Shomurodov",name:"9 · Eldor Shomurodov"},{key:"Fayzullaev",name:"11 · A. Fayzullaev"}] },
  { name:"Colombia",           slug:"colombia",     flag:"COL", players:[{key:"Diaz",name:"7 · Luis Díaz"},{key:"James",name:"10 · James Rodríguez"},{key:"Borja",name:"9 · Miguel Borja"},{key:"Rios",name:"8 · Richard Ríos"}] },
  { name:"Inglaterra",         slug:"england",      flag:"ENG", players:[{key:"Kane",name:"9 · Harry Kane"},{key:"Bellingham",name:"10 · Jude Bellingham"},{key:"Saka",name:"7 · Bukayo Saka"},{key:"Foden",name:"11 · Phil Foden"}] },
  { name:"Croacia",            slug:"croatia",      flag:"CRO", players:[{key:"Modric",name:"10 · Luka Modrić"},{key:"Kramaric",name:"9 · Andrej Kramarić"},{key:"Perisic",name:"4 · Ivan Perišić"}] },
  { name:"Ghana",              slug:"ghana",        flag:"GHA", players:[{key:"Kudus",name:"14 · Mohammed Kudus"},{key:"Partey",name:"5 · Thomas Partey"},{key:"Ayew",name:"9 · Jordan Ayew"}] },
  { name:"Panamá",             slug:"panama",       flag:"PAN", players:[{key:"Carrasquilla",name:"8 · A. Carrasquilla"},{key:"Diaz",name:"9 · Ismael Díaz"},{key:"Blackburn",name:"11 · R. Blackburn"}] },
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

// ========== ESTADO GLOBAL ==========
  // ─────────────────────────────────────────────────────────────
  // ESTADO GLOBAL — predictions, iaPredictions, totalPoints
  // ─────────────────────────────────────────────────────────────
let predictions = {};
let iaPredictions = {};
let totalPoints = 0;

// ========== FUNCIONES AUXILIARES ==========
function getMatchKey(m) { return `${m.group}_${m.home}_${m.away}`; }
function getMySign(pred) { if(pred.l===null||pred.v===null) return null; return pred.l>pred.v?'1':pred.l<pred.v?'2':'X'; }
function iaBonusWillApply(matchKey, pred, realL, realR) {
  const ia = iaPredictions[matchKey];
  if(!ia||!ia.sign) return false;
  const mySign = getMySign(pred);
  if(!mySign) return false;
  if(mySign===ia.sign) return false;
  let realSign = (realL>realR)?'1':(realL<realR)?'2':'X';
  return mySign===realSign;
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

  // ─────────────────────────────────────────────────────────────
  // SISTEMA DE PUNTOS — calcMatchPoints, calcKOMatchPoints,
  //   calcAwardPoints, calcClassificationPoints, calcTotalUserPoints
  // ─────────────────────────────────────────────────────────────
/*
     js-scoring — Motor de puntuacion
     Archivo destino : scoring.js
     -----------------------------------------------------------
     Usa             : PARTIDOS, BRACKET, AWARDS_CFG
     Expone          : calcScore, calcGroupsAdvancePoints, calcClassificationPoints, calcTotalUserPoints
     Deps            : js-data
     Notas           : Logica pura de calculo. Sin efectos de UI.
================================================================ */
// ── Puntos por ronda KO (equipos que avanzan) ─────────────
const KO_ROUND_PTS = {
  groups:         5,   // equipo que pasa fase de grupos → 1/16
  r32:            5,   // avanza en dieciseisavos → octavos
  r16:           10,   // avanza en octavos → cuartos
  qf:            15,   // avanza en cuartos → semifinales
  sf:            20,   // avanza en semis → final
  final_advance: 25,   // avanza a la gran final (campeón)
};

// ── Puntos por clasificación final ────────────────────────
const FINAL_CLASSIFICATION_PTS = {
  champion:  30,
  runner_up: 20,
  third:     15,
  fourth:    10,
};

// ── Puntos por partido (grupos y KO) ──────────────────────
// +1 signo correcto (1·X·2)
// +3 marcador exacto (incluye el signo, no acumula con +1)
// +2 goleador correcto
// +1 bonus vs IA (tu signo difiere de la IA y aciertas)
// Máximo: 7 pts por partido
function calcMatchPoints(pred, realL, realR, matchKey) {
  if(!pred || !pred.saved) return 0;
  let pts = 0;

  // Signo y exacto
  if(pred.l === realL && pred.v === realR) {
    pts += 3; // exacto (ya incluye el punto de signo)
  } else if(Math.sign(pred.l - pred.v) === Math.sign(realL - realR)) {
    pts += 1; // solo signo
  }

  // Goleador — aciertas cualquier goleador del partido
  // En producción real: comparar con lista de goleadores reales del partido
  // Por ahora: comparar con el primer goleador real disponible
  if(pred.gol && realL !== realR) {
    const winnerTeam = realL > realR ? pred.home : pred.away;
    const team = EQUIPOS.find(e => e.name === winnerTeam);
    const realScorer = team?.players?.[0]?.key || null;
    if(realScorer && pred.gol === realScorer) pts += 2;
  }

  // Bonus vs IA
  if(iaBonusWillApply(matchKey, pred, realL, realR)) pts += 1;

  return Math.min(pts, 7); // máximo 7 pts por partido
}

// ── Puntos KO por ronda ───────────────────────────────────
// Calcula los pts de un pronóstico KO dado un resultado real
// round: 'r32'|'r16'|'qf'|'sf'|'final'
function calcKOMatchPoints(pred, realL, realR, round) {
  if(!pred || !pred.saved) return 0;
  let pts = calcMatchPoints(pred, realL, realR, null);

  const realWinner = realL > realR ? 'home' : realR > realL ? 'away' : null;
  const predWinner = pred.l > pred.v ? 'home'
                   : pred.v > pred.l ? 'away'
                   : pred.classifier;

  // +pts por equipo que avanza en esta ronda
  const roundPts = KO_ROUND_PTS[round] || 0;
  if(roundPts > 0 && realWinner && predWinner && realWinner === predWinner) {
    pts += roundPts;
  }

  // Semis: el ganador pasa a la final → +25 pts adicionales
  if(round === 'sf' && realWinner && predWinner && realWinner === predWinner) {
    pts += KO_ROUND_PTS.final_advance;
  }

  return pts;
}

// ── Puntos por equipos que pasan grupos ───────────────────
// Por cada equipo que el usuario pronosticó entre los 32 clasificados
// y efectivamente pasó: +5 pts
function calcGroupsAdvancePoints(userPredictedClassified, realClassified) {
  if(!userPredictedClassified || !realClassified) return 0;
  let pts = 0;
  userPredictedClassified.forEach(team => {
    if(realClassified.includes(team)) pts += KO_ROUND_PTS.groups;
  });
  return pts;
}

// ── Puntos por premios individuales ───────────────────────
function calcAwardPoints(userPicks, realWinners) {
  // userPicks: { golden_ball: playerKey, golden_boot: ..., ... }
  // realWinners: { golden_ball: playerKey, ... }
  if(!userPicks || !realWinners) return 0;
  let pts = 0;
  Object.entries(AWARDS_CFG).forEach(([key, cfg]) => {
    if(userPicks[key] && realWinners[key] && userPicks[key] === realWinners[key]) {
      pts += cfg.pts;
    }
  });
  return pts;
}

// ── Puntos por clasificación final ────────────────────────
function calcClassificationPoints(userPicks, realResults) {
  // userPicks: { champion: teamName, runner_up: ..., third: ..., fourth: ... }
  // realResults: { champion: teamName, ... }
  if(!userPicks || !realResults) return 0;
  let pts = 0;
  Object.entries(FINAL_CLASSIFICATION_PTS).forEach(([pos, ptsVal]) => {
    if(userPicks[pos] && realResults[pos] && userPicks[pos] === realResults[pos]) {
      pts += ptsVal;
    }
  });
  return pts;
}

// ── Total de puntos de un usuario ────────────────────────
// Función principal que suma todos los conceptos
function calcTotalUserPoints(userPredictions, userKoPredictions, userAwPicks,
                              realMatchResults, realKoResults, realAwardWinners,
                              realClassification) {
  let total = 0;

  // 1. Partidos de fase de grupos
  PARTIDOS.forEach(m => {
    const key = getMatchKey(m);
    const pred = userPredictions[key];
    const real = realMatchResults?.[key];
    if(pred && real) total += calcMatchPoints(pred, real.l, real.v, key);
  });

  // 2. Partidos eliminatorias (con bonus de ronda)
  const KO_ROUNDS = [
    { matches: BRACKET.r32,   round: 'r32' },
    { matches: BRACKET.r16,   round: 'r16' },
    { matches: BRACKET.qf,    round: 'qf'  },
    { matches: BRACKET.sf,    round: 'sf'  },
    { matches: BRACKET.third, round: 'sf'  }, // 3er/4to no da pts extra de ronda
    { matches: BRACKET.final, round: 'sf'  }, // la final tampoco (ya cubierta con champion)
  ];
  KO_ROUNDS.forEach(({ matches, round }) => {
    matches.forEach(m => {
      const pred = userKoPredictions[m.id] || userKoPredictions[String(m.id)];
      const real = realKoResults?.[m.id];
      if(pred && real) total += calcKOMatchPoints(pred, real.l, real.v, round);
    });
  });

  // 3. Equipos que pasan grupos (calculado aparte)
  // Se añadirá cuando tengamos datos reales de clasificados

  // 4. Premios individuales
  if(userAwPicks && realAwardWinners) {
    total += calcAwardPoints(userAwPicks, realAwardWinners);
  }

  // 5. Clasificación final (campeón, subcampeón, 3º, 4º)
  // Derivada de koPredictions de la final y 3er puesto
  // Se calculará con los datos reales al terminar el torneo

  return total;
}
  // ─────────────────────────────────────────────────────────────
  // UTILIDADES — getEstadoPartido, fmtMs, fmtTime, fmtDate
  // ─────────────────────────────────────────────────────────────
function getEstadoPartido(match) {
  const now = new Date();
  const ko = new Date(match.date);
  if(now < new Date(ko-4*24*3600*1000)) return 'open';
  if(now < new Date(ko-2*24*3600*1000)) return 'closing';
  if(now < ko) return 'closed';
  if(now < new Date(ko.getTime()+95*60000)) return 'live';
  return 'done';
}
function fmtMs(ms){
  if(ms<=0) return '0s';
  const d=Math.floor(ms/86400000),h=Math.floor((ms%86400000)/3600000);
  const m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000);
  if(d>1) return `${d}d ${h}h`; if(d===1) return `1d ${h}h ${m}m`;
  if(h>0) return `${h}h ${m}m ${s}s`; return `${m}m ${s}s`;
}
function fmtTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
}
function fmtDate(str){
  const d=new Date(str);
  return d.toLocaleDateString('es',{weekday:'short',day:'numeric',month:'short'})+' · '+d.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'});
}

// ========== FUNCIONES DE TABLA AVANZADA ==========
  // ─────────────────────────────────────────────────────────────
  // TABLA DE GRUPOS — calcGroupTableAdvanced, getBestThirdsAll,
  //   renderGroupTableCard
  // ─────────────────────────────────────────────────────────────
function calcGroupTableAdvanced(letra) {
  const equipos = GRUPOS.find(g=>g.letra===letra).equipos;
  const stats = equipos.map(e => ({ name: e, pj:0, g:0, e:0, p:0, gf:0, gc:0, pts:0 }));
  PARTIDOS.filter(m => m.group === letra).forEach(m => {
    const key = getMatchKey(m);
    const pred = predictions[key];
    if(!pred || pred.l===null || pred.v===null) return;
    const h = stats.find(s=>s.name===m.home);
    const a = stats.find(s=>s.name===m.away);
    if(!h||!a) return;
    h.pj++; a.pj++;
    h.gf+=pred.l; h.gc+=pred.v;
    a.gf+=pred.v; a.gc+=pred.l;
    if(pred.l>pred.v) { h.g++; h.pts+=3; a.p++; }
    else if(pred.l<pred.v) { a.g++; a.pts+=3; h.p++; }
    else { h.e++; a.e++; h.pts+=1; a.pts+=1; }
  });
  stats.forEach(s => s.gd = s.gf - s.gc);
  stats.sort((a,b)=>b.pts-a.pts || b.gd-a.gd || b.gf-a.gf);
  return stats;
}

function getBestThirdsAll() {
  const thirds = [];
  GRUPOS.forEach(g => {
    const table = calcGroupTableAdvanced(g.letra);
    const filled = PARTIDOS.filter(m => m.group===g.letra && predictions[getMatchKey(m)]?.l!==null).length;
    if(filled < 6) return; // grupo incompleto -> no se considera su tercero
    if(table[2]) thirds.push({ ...table[2], group: g.letra });
  });
  thirds.sort((a,b)=>b.pts-a.pts || (b.gf-b.gc)-(a.gf-a.gc) || b.gf-a.gf);
  return thirds.slice(0,8).map(t => t.name);
}

function renderGroupTableCard(letra) {
  const container = document.getElementById(`gtable-${letra}`);
  if(!container) return;
  const stats = calcGroupTableAdvanced(letra);
  const filledCount = PARTIDOS.filter(m => m.group===letra && predictions[getMatchKey(m)]?.l!==null).length;
  const totalMatches = PARTIDOS.filter(m=>m.group===letra).length;
  const bestThirds = getBestThirdsAll();
  const pendingGroups = GRUPOS.filter(g => {
    const f = PARTIDOS.filter(m => m.group===g.letra && predictions[getMatchKey(m)]?.l!==null).length;
    return f < 6;
  }).length;

  let html = `
    <div class="gc-header">
      <div><div class="gc-badge">Grupo ${letra}</div><div class="gc-title">Clasificación simulada</div></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <div class="gc-sim-badge"><div class="gc-sim-dot"></div>Simulado</div>
        <div style="display:flex;align-items:center;gap:6px">
          <div class="gc-prog-dots">`;
  for(let i=0;i<totalMatches;i++) {
    html += `<div class="gc-dot ${i<filledCount?'done':''}"></div>`;
  }
  html += `</div><span style="font-size:9px;font-weight:600;color:#6b7280">${filledCount}/${totalMatches}</span>
        </div>
      </div>
    </div>
    <table class="gc-table">
      <thead class="gc-thead">……
        <th style="width:24px"></th><th class="th-team">Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>DG</th><th>GF</th><th title="Puntos">Pts</th>
      </thead>
      <tbody class="gc-tbody">`;
  stats.forEach((t,i) => {
    const pos = i+1;
    const gd = t.gf-t.gc;
    const gdClass = gd>0?'gd-pos':gd<0?'gd-neg':'gd-zero';
    const gdStr = t.pj>0 ? (gd>0?`+${gd}`:`${gd}`) : '—';
    const team = EQUIPOS.find(e=>e.name===t.name);
    const flagUrl = team ? `${SB}/flags/${team.flag}.png` : '';

    let rowClass = '', badge = '';
    if(pos<=2) {
      rowClass = 'qualified';
    } else if(pos===3) {
      const isComplete = filledCount===totalMatches;
      const qualifies = bestThirds.includes(t.name);
      if(!isComplete) {
        rowClass = 'best-third';
      } else if(pendingGroups===0) {
        rowClass = qualifies ? 'best-third' : 'eliminated';
        badge = qualifies ? '<span class="qual-badge in">Clasifica</span>' : '<span class="qual-badge out">Eliminado</span>';
      } else {
        rowClass = qualifies ? 'best-third' : 'eliminated';
        badge = qualifies ? `<span class="qual-badge prov">Prov.·${pendingGroups}g</span>` : `<span class="qual-badge out">Fuera·${pendingGroups}g</span>`;
      }
    } else {
      rowClass = 'eliminated';
    }

    html += `<tr class="${rowClass}">
      <td class="gc-pos">${pos}</td>
      <td><div class="gc-team-cell">
        <div class="gc-flag"><img src="${flagUrl}" alt="" onerror="this.remove()"/></div>
        <span class="gc-tname">${t.name.length>12?t.name.substring(0,11)+'…':t.name}</span>${badge}
      </div></td>
      <td class="gc-stat">${t.pj}</td>
      <td class="gc-stat">${t.g}</td>
      <td class="gc-stat">${t.e}</td>
      <td class="gc-stat">${t.p}</td>
      <td class="gc-stat ${gdClass}">${gdStr}</td>
      <td class="gc-stat">${t.gf}</td>
      <td class="gc-stat pts">${t.pts}</td>
     </tr>`;
  });
  html += `</tbody>
    </table>
    <div class="gc-legend">
      <div class="gc-leg-item"><div class="gc-leg-dot" style="background:#4ade80"></div>Clasifica (1º-2º)</div>
      <div class="gc-leg-item"><div class="gc-leg-dot" style="background:#fb923c"></div>Posible 3º mejor</div>
      <span style="font-size:8px;color:#4b5563;margin-left:auto;font-style:italic">basado en pronósticos</span>
    </div>
  `;
  container.innerHTML = html;
}

/* ── KIT_OVERRIDES y kitUrl — scope GLOBAL para uso en KO también ── */
  // ─────────────────────────────────────────────────────────────
  // KITS Y STICKERS — kitUrl, WHITE_KITS, STICKER_POOL,
  //   getStickerForMatch, createMatchCard
  // ─────────────────────────────────────────────────────────────
const KIT_OVERRIDES = {
  'irak':       { home:'local.png',  away:'away.png'  },
  'jordan':     { home:'local.png',  away:'away.jpg'  },
  'cape-verde': { home:'home.png',   away:'away.png'  },
  'uzbekistan': { home:'local.png',  away:'local.png' },
  'drc-jam':    { home:'local.png',  away:'away.png',  folder:'rd congo' },
  'tunisia':    { home:'local.jpg',  away:'away.jpg'  },
  'curacao':    { home:'away.jpg',   away:'away.jpg'  },
  'uruguay':    { home:'home.png',   away:'away.jpg'  },
  'panama':     { home:'home.png',   away:'away.png'  },
};
function kitUrl(slug, type) {
  const ov = KIT_OVERRIDES[slug];
  if(ov) {
    const folder = ov.folder || slug;
    const file   = ov[type] || ov.home;
    return SB+'/kits/'+encodeURIComponent(folder)+'/'+file;
  }
  return SB+'/kits/'+slug+'/'+type+'.jpg';
}

// ========== RENDERIZADO DE TARJETAS DE PARTIDO ==========

const WHITE_KITS = new Set([
  'spain-home','england-home','germany-away','argentina-home',
  'usa-home','japan-home','korea-home','portugal-away','switzerland-home'
]);
function isWhiteKit(slug, type){ return WHITE_KITS.has(slug+'-'+type); }


// Sticker map: slug -> [sticker filenames...]
// Multiple stickers per team = rotated by match index for variety
const STICKER_POOL = {
  'spain':       ['Spain/Lamine_Yamal_Spain_2','Spain/Nico_Williams','Spain/Rodri-PNG-Spain-Football-Render-370x389','Spain/Alvaro_Morata_Spain_png','Spain/Cucurella-Spain-PNG-Football-Render-370x389','Spain/Mikel_Merino','Spain/Aymeric_Laporte','Spain/Rodri-Espana-Liga-Naciones-Futbol-Sport-Render-370x389'],
  'uruguay':     ['Uruguay/Darwin_Nunez','Uruguay/Fede-Valverde-Uruguay-PNG-Football-Render','Uruguay/Ronald_Araujo','Uruguay/Federico-Vinas-PNG-Uruguay-Football-Render-370x389'],
  'argentina':   ['Argentina/Leo_Messi','Argentina/De_Paul','Argentina/Emiliano_Martinez'],
  'brazil':      ['Brazil/Vinicius-JR-Brazil-PNG-Football-Render-370x389','Brazil/Raphinha-Brazil-PNG-Football-Render-1-370x389','Brazil/Endrick-Brazil-PNG-Football-Render--370x389'],
  'france':      ['France/Mbappe-PNG-France-Football-Render-370x389','France/Tchouameni-PNG-France-Football-Render-370x389'],
  'england':     ['England/Jude_Bellingham','England/Bukayo_Saka','England/Harry-Kane-PNG-England-Football-Render-1-370x389'],
  'germany':     ['Germany/Wirtz-PNG-Germany-Football-Render-370x389','Germany/Rudiger-Germany-PNG-Football-Render-370x389'],
  'portugal':    ['Portugal/Cristiano-Ronaldo-PNG-Portugal-Football-Render--370x389','Portugal/Rafael-Leao-PNG-Portugal-Football-Render-370x389','Portugal/Ruben-Dias-PNG-Portugal-Football-Render--370x389'],
  'netherlands': ['Netherlands/Cody-Gakpo-PNG-Netherland-Football-Render--370x389','Netherlands/Xavi-Simons-Netherland-PNG-Football-Render-370x389'],
  'colombia':    ['colombia/James_Rodriguez'],
  'croatia':     ['croatia/Modric-Croatia-PNG-Football-Render-370x389'],
  'ecuador':     ['ecuador/Moi-Caicedo-Ecuador-PNG-Football-Render-370x389'],
  'norway':      ['norway/Haaland-PNG-Norway-Football-Render--370x389'],
  'turkey':      ['turkey/Arda-Guler-PNG-Turkey-Football-Render-370x389','turkey/Arda-Guler-PNG-Turkey-Football-Render-4-370x389'],
  'morocco':     ['morocco/Brahim-PNG-Marruecos-Football-Render-370x389'],
  'usa':         ['usa/Pulisic-EEUU-PNG-Football-Render-370x389','usa/Balogun-EEUU-PNG-Football-Render-370x389'],
  'canada':      ['canada/Alphonso-Davies-Render-PNG-Canada-Free-Image-Football-Sport-Renders-370x389'],
};

// Aspect ratio classes for stickers
// TALL: height >> width (Darwin 670×1354, ratio ~1:2)
const TALL_STICKERS = new Set([
  'Uruguay/Darwin_Nunez',
  'Uruguay/Darwin_Nunez_Uruguay_png',
]);
// WIDE: width >> height (Álvarez 3563×2353, ratio ~1.5:1)
const WIDE_STICKERS = new Set([
  'Argentina/Julian_Alvarez',
]);

function getStickerForMatch(slug, matchIdx) {
  const pool = STICKER_POOL[slug];
  if(!pool || pool.length===0) return null;
  return pool[matchIdx % pool.length];
}

function isTallSticker(sticker) {
  return sticker && TALL_STICKERS.has(sticker);
}
function isWideSticker(sticker) {
  return sticker && WIDE_STICKERS.has(sticker);
}

function createMatchCard(match, idx) {
  const homeTeam = EQUIPOS.find(e => e.name === match.home);
  const awayTeam = EQUIPOS.find(e => e.name === match.away);
  if(!homeTeam || !awayTeam) return null;

  const hFlag = SB+'/flags/'+homeTeam.flag+'.png';
  const aFlag = SB+'/flags/'+awayTeam.flag+'.png';

  let hKitType = 'home', aKitType = 'away';
  const mkEx = match.home+'_'+match.away;
  if(mkEx==="México_Sudáfrica") aKitType='home';
  if(mkEx==="Japón_Suecia") aKitType='home';
  if(mkEx==="Brasil_Marruecos") aKitType='home';
  if(mkEx==="Túnez_Países Bajos") aKitType='home';
  const onlyAway=['Túnez','Irak','Curazao'];
  if(onlyAway.includes(match.home)) hKitType='away';
  if(onlyAway.includes(match.away)) aKitType='away';

  // kitUrl() está en scope global
  const hKit = kitUrl(homeTeam.slug, hKitType);
  const aKit = kitUrl(awayTeam.slug, aKitType);
  const hWC = isWhiteKit(homeTeam.slug, hKitType) ? ' white-kit' : '';
  const aWC = isWhiteKit(awayTeam.slug, aKitType) ? ' white-kit' : '';

  const matchKey = getMatchKey(match);
  const pred = predictions[matchKey] || { l:null, v:null, gol:null, saved:false, lockedByUser:false };
  if(!predictions[matchKey]) predictions[matchKey] = pred;

  const hSk = getStickerForMatch(homeTeam.slug, idx);
  const aSk = getStickerForMatch(awayTeam.slug, idx);
  // Darwin and other tall stickers get extra CSS class to control height
  const hExtra = isTallSticker(hSk) ? ' sticker-tall' : isWideSticker(hSk) ? ' sticker-wide' : '';
  const aExtra = isTallSticker(aSk) ? ' sticker-tall' : isWideSticker(aSk) ? ' sticker-wide' : '';
  const hStickerEl = hSk ? ('<img class="sticker sticker-L'+hExtra+'" src="'+SB+'/miniatures/'+hSk+'.png" alt="" onerror="this.remove()"/>') : '';
  const aStickerEl = aSk ? ('<img class="sticker sticker-R'+aExtra+'" src="'+SB+'/miniatures/'+aSk+'.png" alt="" onerror="this.remove()"/>') : '';

  const hOpts = homeTeam.players.map(p=>'<option value="'+p.key+'"'+(pred.gol===p.key?' selected':'')+'>'+p.name+'</option>').join('');
  const aOpts = awayTeam.players.map(p=>'<option value="'+p.key+'"'+(pred.gol===p.key?' selected':'')+'>'+p.name+'</option>').join('');

  const lVal = pred.l!==null ? pred.l : '—';
  const vVal = pred.v!==null ? pred.v : '—';

  const card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('data-match-idx', String(idx));

  // Use dataset to store slug for kit/flag click handlers
  card.innerHTML = [
    '<div class="hero">',
      '<div class="half L">',
        '<div class="color-base"></div>',
        '<div class="kit-area" data-slug="'+homeTeam.slug+'"></div>',
        '<div class="kit-bg'+hWC+'" style="background-image:linear-gradient(to bottom, rgba(10,10,20,0.5) 0%, transparent 35%),linear-gradient(to bottom, transparent 60%, rgba(10,10,20,0.6) 100%),url(\''+hKit+'\')"></div>',
        '<div class="vign"></div>',
        '<div class="kit-tooltip">🛒 Comprar camiseta</div>',
        hStickerEl,
        '<div class="team-info">',
          '<div class="flag-wrap" data-flag="'+homeTeam.flag+'">',
            '<div class="flag-circle"><img src="'+hFlag+'" alt="'+match.home+'" onerror="this.parentElement.style.background=\'#333\';this.remove()"/></div>',
            '<div class="flag-tooltip">Ver selección →</div>',
          '</div>',
          '<div class="tname">'+match.home+'</div>',
          '<div class="trole">local</div>',
        '</div>',
      '</div>',
      '<div class="half R">',
        '<div class="color-base"></div>',
        '<div class="kit-area" data-slug="'+awayTeam.slug+'"></div>',
        '<div class="kit-bg'+aWC+'" style="background-image:linear-gradient(to bottom, rgba(10,10,20,0.5) 0%, transparent 35%),linear-gradient(to bottom, transparent 60%, rgba(10,10,20,0.6) 100%),url(\''+aKit+'\')"></div>',
        '<div class="vign"></div>',
        '<div class="kit-tooltip">🛒 Comprar camiseta</div>',
        aStickerEl,
        '<div class="team-info">',
          '<div class="flag-wrap" data-flag="'+awayTeam.flag+'">',
            '<div class="flag-circle"><img src="'+aFlag+'" alt="'+match.away+'" onerror="this.parentElement.style.background=\'#333\';this.remove()"/></div>',
            '<div class="flag-tooltip">Ver selección →</div>',
          '</div>',
          '<div class="tname">'+match.away+'</div>',
          '<div class="trole">visitante</div>',
        '</div>',
      '</div>',
      '<div class="hero-fade"></div>',
      '<div class="glow-line"></div>',
      '<div class="spark"></div><div class="spark"></div><div class="spark"></div>',
      '<div class="center">',
        '<div class="mpill">Grupo '+match.group+' · '+match.stadium+'</div>',
        '<div class="vs-b"><div class="vs-ball"></div><span class="vs-text">VS</span></div>',
        '<div class="status-pill open" id="spill-'+idx+'">',
          '<div class="sdot"></div>',
          '<span id="stxt-'+idx+'">Abierta</span>',
        '</div>',
      '</div>',
    '</div>',
    '<div class="pred" id="pred-'+idx+'">',
      '<div id="score-input-'+idx+'">',
        '<div class="sr">',
          '<div class="sc">',
            '<div class="sbn" data-side="l" data-inc="1" data-idx="'+idx+'">▲</div>',
            '<div class="sbox" id="sl-'+idx+'">'+lVal+'</div>',
            '<div class="sbn" data-side="l" data-inc="-1" data-idx="'+idx+'">▼</div>',
          '</div>',
          '<div><div class="ssep">:</div></div>',
          '<div class="sc">',
            '<div class="sbn" data-side="v" data-inc="1" data-idx="'+idx+'">▲</div>',
            '<div class="sbox" id="sv-'+idx+'">'+vVal+'</div>',
            '<div class="sbn" data-side="v" data-inc="-1" data-idx="'+idx+'">▼</div>',
          '</div>',
        '</div>',
        '<div class="pts-row">',
          '<div class="ptc sign" id="ptc-sign-'+idx+'">🔵 +1pt signo</div>',
          '<div class="ptc exact" id="ptc-exact-'+idx+'">🎯 +3pts exacto</div>',
          '<div class="ptc scorer" id="ptc-scorer-'+idx+'">⚽ +2pts goleador</div>',
          '<div class="ptc ia" id="ptc-ia-'+idx+'">🤖 +1pt vs IA</div>',
        '</div>',
        '<div class="gol-row">',
          '<span class="gol-lbl">Goleador</span>',
          '<div class="gsel-wrap">',
            '<select class="gsel" id="gsel-'+idx+'" data-idx="'+idx+'">',
              '<option value="" disabled selected>Seleccionar jugador...</option>',
              '<optgroup label="'+match.home+'">'+hOpts+'</optgroup>',
              '<optgroup label="'+match.away+'">'+aOpts+'</optgroup>',
            '</select>',
          '</div>',
          '<span class="gbadge" id="gbadge-'+idx+'">+2 pts</span>',
        '</div>',
      '</div>',
      '<div class="score-live" id="score-live-'+idx+'" style="display:none">',
        '<div class="score-big">',
          '<span class="score-num" id="rl-'+idx+'">—</span><span class="score-sep2">:</span><span class="score-num" id="rr-'+idx+'">—</span>',
        '</div>',
        '<div class="pred-sub">Tu pronóstico:<span id="pred-val-'+idx+'">—</span></div>',
        '<div class="pts-row">',
          '<div class="ptc sign" id="ptc-sign-l-'+idx+'">🔵 +1pt signo</div>',
          '<div class="ptc exact" id="ptc-exact-l-'+idx+'">🎯 +3pts exacto</div>',
          '<div class="ptc scorer" id="ptc-scorer-l-'+idx+'">⚽ +2pts goleador</div>',
          '<div class="ptc ia" id="ptc-ia-l-'+idx+'">🤖 +1pt vs IA</div>',
        '</div>',
      '</div>',
    '</div>',
    '<div class="ia-bar">',
      '<div class="ia-lbl">IA predice</div>',
      '<div class="ia-content" id="ia-content-'+idx+'">',
        '<div id="ia-loading-'+idx+'" style="display:flex;align-items:center;gap:5px"><div class="ia-dot"></div><div class="ia-dot"></div><div class="ia-dot"></div><span style="font-size:11px;color:#6b7280;font-style:italic">consultando oráculos...</span></div>',
        '<div id="ia-result-'+idx+'" style="display:none;align-items:center;gap:6px;flex-wrap:wrap">',
          '<span class="ia-prediction" id="ia-pred-txt-'+idx+'"></span>',
          '<span class="ia-detail ia-quip" id="ia-detail-txt-'+idx+'"></span>',
        '</div>',
      '</div>',
    '</div>',
    '<div class="cf">',
      '<div style="display:flex;align-items:center;gap:6px">',
        '<button class="dice-btn" onclick="diceSimulateMatch(PARTIDOS['+idx+']);event.stopPropagation()" title="Simular al azar">',
          '<span class="dice-icon">🎲</span>',
        '</button>',
        '<span><span class="ptn" id="pnum-'+idx+'">0</span><span class="ptl" id="ptl-'+idx+'"> pts posibles</span></span>',
      '</div>',
      '<div id="btn-row-'+idx+'"><button class="btn-save" disabled data-idx="'+idx+'">Guardar</button></div>',
    '</div>'
  ].join('');

  // Kit area click via event delegation on card
  card.querySelectorAll('.kit-area').forEach(ka => {
    ka.addEventListener('click', () => { /* TODO: shop link */ });
  });
  card.querySelectorAll('.flag-wrap').forEach(fw => {
    fw.addEventListener('click', e => { e.stopPropagation(); /* TODO: team profile */ });
  });

  return card;
}

  // ─────────────────────────────────────────────────────────────
  // EVENTOS DE TARJETA — attachEvents, fetchIA, updateCardUI,
  //   updateGlobalPoints, checkKitConflict
  // ─────────────────────────────────────────────────────────────
function attachEvents(card, idx, match) {
  // Si la porra está cerrada, renderizar estado pero sin eventos de edición
  if (window._porraCerrada) {
    // Sí ejecutar updateCardUI para mostrar chips y pts correctamente
    updateCardUI(idx, match);
    // Deshabilitar controles de edición
    card.querySelectorAll('.sbn,.gsel,.btn-save').forEach(el => {
      el.disabled = true;
      if(el.classList.contains('sbn')) el.style.pointerEvents = 'none';
    });
    card.querySelectorAll('.dice-btn').forEach(el => el.style.display = 'none');
    return;
  }
  const matchKey = getMatchKey(match);
  const pred = predictions[matchKey];
  const estado = getEstadoPartido(match);
  card.querySelectorAll('.sbn').forEach(btn => {
    btn.addEventListener('click', () => {
      if(pred.saved || pred.lockedByUser) return;
      const side = btn.getAttribute('data-side');
      const inc = parseInt(btn.getAttribute('data-inc'));
      if(pred[side] === null) pred[side] = 0;
      else pred[side] = Math.max(0, Math.min(9, pred[side] + inc));
      const el = document.getElementById(`s${side}-${idx}`);
      el.textContent = pred[side];
      el.classList.add('on','bump');
      setTimeout(()=>el.classList.remove('bump'),220);
      pred.saved = false;
      updateCardUI(idx, match);
    });
  });
  document.getElementById(`gsel-${idx}`).addEventListener('change', (e) => {
    if(pred.saved || pred.lockedByUser) return;
    pred.gol = e.target.value || null;
    pred.saved = false;
    updateCardUI(idx, match);
  });
  // Detección cromática de conflicto de kits (P2)
  setTimeout(() => {
    const _hTeam = EQUIPOS.find(e => e.name === match.home);
    const _aTeam = EQUIPOS.find(e => e.name === match.away);
    const _hType = (['Túnez','Irak','Curazao'].includes(match.home)) ? 'away' : 'home';
    const _aType = (['Túnez','Irak','Curazao'].includes(match.away)) ? 'away' : 'home';
    if(_hTeam && _aTeam) checkKitConflict(card, idx, _hTeam, _aTeam, _hType, _aType);
  }, 800);

  // IA lazy-fetch: solo cuando la tarjeta entra en el viewport
  // Evita lanzar 72 fetches simultáneos al cargar → elimina el freeze
  if('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if(entry.isIntersecting) {
          obs.disconnect();
          // Pequeño delay para no saturar si muchas entran a la vez
          setTimeout(() => fetchIA(idx, match), 150 + Math.random()*200);
        }
      });
    }, { rootMargin: '200px' }); // prefetch 200px antes de ser visible
    observer.observe(card);
  } else {
    // Fallback para navegadores sin IntersectionObserver
    setTimeout(() => fetchIA(idx, match), 400 + idx * 280);
  }
  // Aplicar estado visual correcto desde el primer render (chips, botón, gsel)
  updateCardUI(idx, match);
}

// Control de concurrencia IA — máx 3 fetches simultáneos
let _iaActive = 0;
const _iaQueue = [];
function _iaNext() {
  if(_iaActive >= 3 || _iaQueue.length === 0) return;
  const fn = _iaQueue.shift();
  _iaActive++;
  fn().finally(() => { _iaActive--; _iaNext(); });
}
function _iaEnqueue(fn) { _iaQueue.push(fn); _iaNext(); }

function fetchIA(idx, match) {
  const matchKey = getMatchKey(match);
  if(iaPredictions[matchKey]) return; // ya analizado

  const loadEl  = document.getElementById('ia-loading-'+idx);
  const resEl   = document.getElementById('ia-result-'+idx);
  if(!loadEl || !resEl) return;

  loadEl.style.display = 'flex';
  resEl.style.display  = 'none';

  const prompt = match.home+' vs '+match.away+
    ', Grupo '+match.group+', Mundial 2026 ('+match.stadium+').'+
    ' Busca estadísticas recientes, forma actual, historial de enfrentamientos '+
    'y cualquier dato relevante de este partido. '+
    'Después haz tu predicción. Responde SOLO JSON sin markdown:\n'+
    '{"sign":"1","confidence":73,"quip":"frase corta, graciosa o vacilona sobre el partido (máx 12 palabras)"}'+
    '\nsign: 1=local gana, X=empate, 2=visitante gana. '+
    'El quip debe ser ingenioso, irreverente, con humor futbolero. Ejemplos de tono: '+
    '"España ganará con el mismo esfuerzo que respirar", '+
    '"El empate es la forma más cobarde de no perder", '+
    '"Marruecos tiene algo que decir. Varios algo.", '+
    '"La IA ha consultado 47 bases de datos y sigue sin saber"';

  _iaEnqueue(() => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      system: 'Eres un analista deportivo con sentido del humor. Usas web_search para buscar datos reales del partido antes de predecir. Responde SIEMPRE con JSON puro, sin markdown, sin texto adicional.',
      messages: [{ role: 'user', content: prompt }]
    })
  })
  .then(r => r.json())
  .then(data => {
    // Extraer texto de la respuesta (puede haber tool_use blocks)
    const textBlock = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    if(!textBlock) throw new Error('no text');
    const clean = textBlock.replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(clean);
    return parsed;
  })
  .catch(() => {
    // CORS en local / error de red → fallback con quips locales
    const fallbacks = [
      { sign:'1', confidence:78, quip:'El local siempre tiene razón. O eso dice su afición.' },
      { sign:'2', confidence:71, quip:'El visitante viene con ganas de armar lío.' },
      { sign:'X', confidence:64, quip:'El empate es la victoria del cobarde y del sabio.' },
      { sign:'1', confidence:82, quip:'Favorito claro. La IA no tiene drama aquí.' },
      { sign:'2', confidence:69, quip:'Sorpresa estadística. O error estadístico. Quién sabe.' },
      { sign:'X', confidence:61, quip:'Los modelos se pelean. Resultado: tablas.' },
    ];
    // Deterministic by match index so it's consistent across reloads
    return fallbacks[idx % fallbacks.length];
  })
  .then(pred => {
    iaPredictions[matchKey] = { sign: pred.sign, confidence: pred.confidence, quip: pred.quip };

    const signMap = { '1': 'Local', 'X': 'Empate', '2': 'Visitante' };
    const signLabel = signMap[pred.sign] || pred.sign;
    const predTxt = document.getElementById('ia-pred-txt-'+idx);
    const detailTxt = document.getElementById('ia-detail-txt-'+idx);

    if(predTxt)  predTxt.textContent  = pred.sign+' · '+signLabel+' ('+pred.confidence+'%)';
    if(detailTxt) detailTxt.textContent = pred.quip || '';

    if(loadEl) loadEl.style.display = 'none';
    if(resEl)  resEl.style.display  = 'flex';

    updateCardUI(idx, match);
  })); // cierre de _iaEnqueue
}


function updateCardUI(idx, match) {
  const matchKey = getMatchKey(match);
  const pred = predictions[matchKey];
  const estado = getEstadoPartido(match);
  const hasScore = (pred.l !== null && pred.v !== null);
  const hasGoal = !!pred.gol;
  const ia = iaPredictions[matchKey];
  const mySign = getMySign(pred);

  const pill = document.getElementById(`spill-${idx}`);
  const stxt = document.getElementById(`stxt-${idx}`);
  if(estado === 'open'){ pill.className='status-pill open'; const ms=new Date(match.date)-4*24*3600*1000-new Date(); stxt.textContent=`Abierta · ${fmtMs(ms)}`; }
  else if(estado === 'closing'){ pill.className='status-pill closing'; const ms=new Date(match.date)-2*24*3600*1000-new Date(); stxt.textContent=`¡Cierra en ${fmtMs(ms)}!`; }
  else if(estado === 'closed'){ pill.className='status-pill closed'; stxt.textContent=fmtDate(match.date); }
  else if(estado === 'live'){ pill.className='status-pill live'; const min=Math.min(Math.floor((new Date()-new Date(match.date))/60000),90); stxt.textContent=`EN VIVO ${min}'`; }
  else { pill.className='status-pill done'; stxt.textContent='Finalizado'; }

  if(estado === 'open' || estado === 'closing') {
    const cs=document.getElementById(`ptc-sign-${idx}`);
    const ce=document.getElementById(`ptc-exact-${idx}`);
    const cg=document.getElementById(`ptc-scorer-${idx}`);
    const ci=document.getElementById(`ptc-ia-${idx}`);
    if(hasScore){
      // Sistema ACUMULATIVO: signo + exacto + goleador + vsIA
      // 🔵 signo siempre encendido (sólido) cuando hay marcador
      // 🎯 exacto siempre encendido (potential = aspiracional) cuando hay marcador
      cs.classList.add('show'); cs.classList.remove('potential');
      ce.classList.add('show'); ce.classList.remove('potential'); // exacto siempre encendido
    } else {
      cs.classList.remove('show','potential');
      ce.classList.remove('show','potential');
    }
    // ⚽ goleador: sólido cuando seleccionado
    if(hasGoal){ cg.classList.add('show'); cg.classList.remove('potential'); }
    else { cg.classList.remove('show','potential'); }
    // 🤖 vs IA: sólido cuando signo difiere del de la IA
    const showIA = hasScore && ia && mySign && mySign!==ia.sign;
    if(showIA){ ci.classList.add('show'); ci.classList.remove('potential'); }
    else { ci.classList.remove('show','potential'); }

    // Pts máx posibles = signo(1) + exacto(3) + goleador(2) + vsIA(1) = hasta 7
    // Sin goleador: 1+3 = 4 mín / 5 con IA
    // Con goleador: 1+3+2 = 6 / 7 con IA
    let maxPts = 0;
    if(hasScore){
      maxPts = 1 + 3; // signo + exacto siempre disponibles
      if(hasGoal)  maxPts += 2;
      if(showIA)   maxPts += 1;
    }
    const pnum=document.getElementById(`pnum-${idx}`);
    pnum.textContent=maxPts; pnum.classList.toggle('on',maxPts>0);
    document.getElementById(`ptl-${idx}`).textContent=maxPts?' pts posibles':' pts posibles';

    const btnRow=document.getElementById(`btn-row-${idx}`);
    if(!pred.saved){
      const isZeroZero = pred.l===0 && pred.v===0;
      const golOk = hasGoal || isZeroZero;
      if(hasScore && golOk){
        btnRow.innerHTML=`<button class="btn-save" data-idx="${idx}">Guardar</button>`;
        btnRow.querySelector('.btn-save').onclick=()=>{
          pred.saved=true; pred.lockedByUser=true;
          savePredictions();
          updateCardUI(idx,match);
          renderGroupTableCard(match.group);
          updateGlobalPoints();
          checkGroupsComplete();
        };
      } else {
        btnRow.innerHTML=`<button class="btn-save" disabled>Guardar</button>`;
      }
    } else {
      // Congelar visualmente las sboxes al guardar
      const slEl=document.getElementById(`sl-${idx}`);
      const svEl=document.getElementById(`sv-${idx}`);
      if(slEl) slEl.className='sbox frozen';
      if(svEl) svEl.className='sbox frozen';
      // Deshabilitar goleador y steppers
      const gselSaved=document.getElementById(`gsel-${idx}`);
      if(gselSaved) gselSaved.disabled=true;
      document.querySelectorAll(`#pred-${idx} .sbn`).forEach(b=>b.disabled=true);
      const undoVisible = window._porraCerrada ? 'display:none' : '';
      btnRow.innerHTML=`<div class="saved-group"><div class="saved-badge" style="background:#16a34a;color:#fff;border-radius:8px;padding:6px 16px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px">✓ Guardado</div><button class="btn-undo" data-idx="${idx}" style="${undoVisible}">↩ Deshacer</button></div>`;
      btnRow.querySelector('.btn-undo').onclick=()=>{
        if (window._porraCerrada) return; // porra cerrada — no se puede deshacer
        // Deshacer SOLO esta tarjeta — no afecta a las demás
        pred.l=null; pred.v=null; pred.gol=null; pred.saved=false; pred.lockedByUser=false;
        if(slEl){ slEl.textContent='—'; slEl.className='sbox'; }
        if(svEl){ svEl.textContent='—'; svEl.className='sbox'; }
        const gselEl=document.getElementById(`gsel-${idx}`);
        if(gselEl){ gselEl.value=''; gselEl.disabled=false; }
        // Re-habilitar steppers
        document.querySelectorAll(`#pred-${idx} .sbn`).forEach(b=>b.disabled=false);
        savePredictions();
        updateCardUI(idx,match);
        renderGroupTableCard(match.group);
        updateGlobalPoints();
        checkGroupsComplete();
      };
    }
  } else {
    document.querySelectorAll(`#pred-${idx} .sbn`).forEach(b=>b.style.visibility='hidden');
    document.getElementById(`gsel-${idx}`).disabled=true;
    document.getElementById(`btn-row-${idx}`).innerHTML=`<div class="locked-badge">🔒 Cerrado</div>`;
  }
}

function updateGlobalPoints(){
  let pts=0;
  PARTIDOS.forEach(m=>{
    const key=getMatchKey(m);
    const pred=predictions[key];
    if(pred && pred.saved) pts += calcMatchPoints(pred, m.realHome, m.realAway, key);
  });
  totalPoints=pts;
  document.getElementById('total-points').textContent=totalPoints;
}


/* ══ DETECCIÓN CROMÁTICA DE KITS (P2) ══
   Analiza el color dominante de cada camiseta via canvas
   y si ambos son demasiado similares, cambia home↔away
   Se ejecuta después de que las imágenes cargan
══════════════════════════════════════════ */
function getDominantColor(imgEl) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 40; canvas.height = 40;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, 40, 40);
    const data = ctx.getImageData(0, 0, 40, 40).data;
    let r=0, g=0, b=0, count=0;
    for(let i=0; i<data.length; i+=4) {
      // Skip near-white pixels (kit backgrounds) and near-transparent
      if(data[i+3] < 50) continue; // transparent
      if(data[i]>230 && data[i+1]>230 && data[i+2]>230) continue; // white bg
      r += data[i]; g += data[i+1]; b += data[i+2]; count++;
    }
    if(!count) return null;
    return [Math.round(r/count), Math.round(g/count), Math.round(b/count)];
  } catch(e) { return null; } // CORS fallback
}

function colorDistance(c1, c2) {
  if(!c1 || !c2) return 999;
  // Euclidean distance in RGB space — perceptual
  return Math.sqrt(
    2*(c1[0]-c2[0])**2 +
    4*(c1[1]-c2[1])**2 +
    3*(c1[2]-c2[2])**2
  );
}

function checkKitConflict(card, idx, homeTeam, awayTeam, hKitType, aKitType) {
  // Esperar a que carguen ambas imágenes y analizar colores
  const hKitEl = card.querySelector('.half.L .kit-bg');
  const aKitEl = card.querySelector('.half.R .kit-bg');
  if(!hKitEl || !aKitEl) return;

  // Crear imágenes ocultas para análisis
  function analyzeKit(url, callback) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => callback(getDominantColor(img));
    img.onerror = () => callback(null); // sin CORS → skip
    img.src = url;
  }

  const hUrl = hKitEl.style.backgroundImage.replace(/url\(['"]?|['"]?\)/g,'');
  const aUrl = aKitEl.style.backgroundImage.replace(/url\(['"]?|['"]?\)/g,'');

  analyzeKit(hUrl, hColor => {
    analyzeKit(aUrl, aColor => {
      const dist = colorDistance(hColor, aColor);
      // Si la distancia es menor de 80 → colores demasiado similares
      if(dist < 80 && dist > 0) {
        console.log('[KIT CONFLICT] Partido '+idx+': distancia='+Math.round(dist)+
          ' h='+JSON.stringify(hColor)+' a='+JSON.stringify(aColor));
        // Intentar cambiar el away a home kit del equipo visitante
        const altUrl = kitUrl(awayTeam.slug, hKitType==='home'?'away':'home');
        aKitEl.style.backgroundImage = "url('"+altUrl+"')";
      }
    });
  });
}

  // ─────────────────────────────────────────────────────────────
  // RENDER GRUPOS — renderAll, initGrupos
  // ─────────────────────────────────────────────────────────────
function renderAll(onComplete) {
  const container = document.getElementById('groups-container');
  container.innerHTML = '';
  // Renderizar grupo a grupo con setTimeout(0) para no bloquear el hilo principal
  // Permite que el navegador procese eventos entre grupos
  let i = 0;
  function renderNextGroup() {
    if(i >= GRUPOS.length) { if(onComplete) onComplete(); return; }
    const grupo = GRUPOS[i++];
    const partidosGrupo = PARTIDOS.filter(p => p.group === grupo.letra);
    const section = document.createElement('div');
    section.className = 'group-section';
    section.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><h2 style="margin:0">Grupo ${grupo.letra}</h2><button class="dice-btn" onclick="diceSimulateGroup('${grupo.letra}')" title="Simular grupo ${grupo.letra} al azar"><span class="dice-icon">🎲</span> Simular grupo ${grupo.letra}</button></div><div class="group-layout"><div class="cards-grid" id="grid-${grupo.letra}"></div><div id="gtable-${grupo.letra}" class="group-table-card"></div></div>`;
    container.appendChild(section);
    const grid = section.querySelector('.cards-grid');
    partidosGrupo.forEach((match) => {
      const globalIdx = PARTIDOS.findIndex(p => p === match);
      const card = createMatchCard(match, globalIdx);
      grid.appendChild(card);
      attachEvents(card, globalIdx, match);
    });
    renderGroupTableCard(grupo.letra);
    // Bloquear tarjetas si porra cerrada, justo después de renderizar
    if (window._porraCerrada) requestAnimationFrame(() => lockAllCardsIfCerrada());
    setTimeout(renderNextGroup, 0); // cede control al navegador entre grupos
  }
  renderNextGroup();
}

// Re-renderiza todas las tablas de clasificación de grupo (sin tocar tarjetas)
function refreshGroupTables() {
  if (typeof renderGroupTableCard === 'function' && typeof GRUPOS !== 'undefined') {
    GRUPOS.forEach(g => renderGroupTableCard(g.letra));
  }
}
window.refreshGroupTables = refreshGroupTables;

// ========== TARJETA DE PREMIOS (independiente) ==========
  // ─────────────────────────────────────────────────────────────
  // AWARDS (PREMIOS INDIVIDUALES) — AWARDS_CFG, AW_PLAYERS,
  //   openPicker, selectAward, renderAwardsCard, saveAwPicks
  // ─────────────────────────────────────────────────────────────
const AWARDS_CFG={  golden_ball:  {icon:'<img src="https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/awards/ballon-d-or-football-trophy.png" style="width:26px;height:26px;object-fit:contain">', name:'Balón de Oro',   pts:15},
  golden_boot:  {icon:'<img src="https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/awards/golden-football-boot-award.png"  style="width:26px;height:26px;object-fit:contain">', name:'Bota de Oro',    pts:15},
  golden_glove: {icon:'<img src="https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/awards/golden-goalkeeper-gloves.png"    style="width:26px;height:26px;object-fit:contain">', name:'Guante de Oro',  pts:15},
  young_player: {icon:'<img src="https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/awards/best-young-player.png"           style="width:26px;height:26px;object-fit:contain">', name:'Mejor Joven ≤21',pts:20},
};
// Puntos por clasificación final del torneo
const CLASSIFICATION_PTS = {
  champion:   {label:'Campeón del torneo',  pts:30},
  runner_up:  {label:'Subcampeón',          pts:20},
  third:      {label:'Tercer clasificado',  pts:15},
  fourth:     {label:'Cuarto clasificado',  pts:10},
};

// NXGN 2026 — Top 50 mejores jóvenes promesas
const YOUNG_PLAYERS_NXGN = [
  {key:'Lamine_Yamal', name:'Lamine Yamal', team:'España', teamName:'España', flag:'ESP', role:'fw', young:true},
  {key:'Estevao', name:'Estevao', team:'Brasil', teamName:'Brasil', flag:'BRA', role:'fw', young:true},
  {key:'Pau_Cubarsi', name:'Pau Cubarsí', team:'España', teamName:'España', flag:'ESP', role:'fw', young:true},
  {key:'Franco_Mastantuono', name:'Franco Mastantuono', team:'Argentina', teamName:'Argentina', flag:'ARG', role:'fw', young:true},
  {key:'Lennart_Karl', name:'Lennart Karl', team:'Alemania', teamName:'Alemania', flag:'GER', role:'fw', young:true},
  {key:'Max_Dowman', name:'Max Dowman', team:'Inglaterra', teamName:'Inglaterra', flag:'ENG', role:'fw', young:true},
  {key:'Luka_Vuskovic', name:'Luka Vuskovic', team:'Croacia', teamName:'Croacia', flag:'CRO', role:'fw', young:true},
  {key:'Ayyoub_Bouaddi', name:'Ayyoub Bouaddi', team:'Marruecos', teamName:'Marruecos', flag:'MAR', role:'fw', young:true},
  {key:'Geovany_Quenda', name:'Geovany Quenda', team:'Portugal', teamName:'Portugal', flag:'POR', role:'fw', young:true},
  {key:'Ethan_Nwaneri', name:'Ethan Nwaneri', team:'Inglaterra', teamName:'Inglaterra', flag:'ENG', role:'fw', young:true},
  {key:'Rodrigo_Mora', name:'Rodrigo Mora', team:'Portugal', teamName:'Portugal', flag:'POR', role:'fw', young:true},
  {key:'Honest_Ahanor', name:'Honest Ahanor', team:'Nigeria', teamName:'Nigeria', flag:'NIG', role:'fw', young:true},
  {key:'Ibrahim_Mbaye', name:'Ibrahim Mbaye', team:'Senegal', teamName:'Senegal', flag:'SEN', role:'fw', young:true},
  {key:'Konstantinos_Karetsas', name:'Konstantinos Karetsas', team:'Bélgica', teamName:'Bélgica', flag:'BEL', role:'fw', young:true},
  {key:'Rio_Ngumoha', name:'Rio Ngumoha', team:'Inglaterra', teamName:'Inglaterra', flag:'ENG', role:'fw', young:true},
  {key:'Gilberto_Mora', name:'Gilberto Mora', team:'México', teamName:'México', flag:'MEX', role:'fw', young:true},
  {key:'Marc_Bernal', name:'Marc Bernal', team:'España', teamName:'España', flag:'ESP', role:'fw', young:true},
  {key:'Dro_Fernandez', name:'Dro Fernández', team:'Argentina', teamName:'Argentina', flag:'ARG', role:'fw', young:true},
  {key:'Mohamed_Kader_Meite', name:'Mohamed Kader Meite', team:'Costa de Marfil', teamName:'Costa de Marfil', flag:'CIV', role:'fw', young:true},
  {key:'Kendry_Paez', name:'Kendry Páez', team:'Ecuador', teamName:'Ecuador', flag:'ECU', role:'fw', young:true},
  {key:'Jorthy_Mokio', name:'Jorthy Mokio', team:'Bélgica', teamName:'Bélgica', flag:'BEL', role:'fw', young:true},
  {key:'Francesco_Camarda', name:'Francesco Camarda', team:'Italia', teamName:'Italia', flag:'ITA', role:'fw', young:true},
  {key:'Robinio_Vaz', name:'Robinio Vaz', team:'Países Bajos', teamName:'Países Bajos', flag:'NED', role:'fw', young:true},
  {key:'Josh_King', name:'Josh King', team:'EE.UU.', teamName:'EE.UU.', flag:'USA', role:'fw', young:true},
  {key:'Charalampos_Kostoulas', name:'Charalampos Kostoulas', team:'Grecia', teamName:'Grecia', flag:'GRE', role:'fw', young:true},
  {key:'Mikey_Moore', name:'Mikey Moore', team:'Inglaterra', teamName:'Inglaterra', flag:'ENG', role:'fw', young:true},
  {key:'Kennet_Eichhorn', name:'Kennet Eichhorn', team:'Alemania', teamName:'Alemania', flag:'GER', role:'fw', young:true},
  {key:'Tylel_Tati', name:'Tylel Tati', team:'Francia', teamName:'Francia', flag:'FRA', role:'fw', young:true},
  {key:'Nathan_De_Cat', name:'Nathan De Cat', team:'Bélgica', teamName:'Bélgica', flag:'BEL', role:'fw', young:true},
  {key:'Mateus_Mane', name:'Mateus Mane', team:'Portugal', teamName:'Portugal', flag:'POR', role:'fw', young:true},
  {key:'Andrija_Maksimovic', name:'Andrija Maksimovic', team:'Serbia', teamName:'Serbia', flag:'SRB', role:'fw', young:true},
  {key:'Sean_Steur', name:'Sean Steur', team:'Países Bajos', teamName:'Países Bajos', flag:'NED', role:'fw', young:true},
  {key:'Kerim_Alajbegovic', name:'Kerim Alajbegovic', team:'Bosnia-Herz.', teamName:'Bosnia-Herz.', flag:'BIH', role:'fw', young:true},
  {key:'Vasilije_Kostov', name:'Vasilije Kostov', team:'Serbia', teamName:'Serbia', flag:'SRB', role:'fw', young:true},
  {key:'Quentin_Ndjantou', name:'Quentin Ndjantou', team:'Camerún', teamName:'Camerún', flag:'CMR', role:'fw', young:true},
  {key:'Ian_Subiabre', name:'Ian Subiabre', team:'Chile', teamName:'Chile', flag:'CHI', role:'fw', young:true},
  {key:'Chris_Rigg', name:'Chris Rigg', team:'Inglaterra', teamName:'Inglaterra', flag:'ENG', role:'fw', young:true},
  {key:'Karim_Coulibaly', name:'Karim Coulibaly', team:'Mali', teamName:'Mali', flag:'MLI', role:'fw', young:true},
  {key:'Cavan_Sullivan', name:'Cavan Sullivan', team:'EE.UU.', teamName:'EE.UU.', flag:'USA', role:'fw', young:true},
  {key:'Thiago_Pitarch', name:'Thiago Pitarch', team:'España', teamName:'España', flag:'ESP', role:'fw', young:true},
  {key:'Viktor_Dadason', name:'Viktor Dadason', team:'Islandia', teamName:'Islandia', flag:'ISL', role:'fw', young:true},
  {key:'Álvaro_Montoro', name:'Álvaro Montoro', team:'España', teamName:'España', flag:'ESP', role:'fw', young:true},
  {key:'Dastan_Satpaev', name:'Dastan Satpaev', team:'Kazajistán', teamName:'Kazajistán', flag:'KAZ', role:'fw', young:true},
  {key:'Samuele_Inacio', name:'Samuele Inacio', team:'Portugal', teamName:'Portugal', flag:'POR', role:'fw', young:true},
  {key:'Oskar_Pietuszewski', name:'Oskar Pietuszewski', team:'Polonia', teamName:'Polonia', flag:'POL', role:'fw', young:true},
  {key:'Jeremy_Monga', name:'Jeremy Monga', team:'R.D. Congo', teamName:'R.D. Congo', flag:'COD', role:'fw', young:true},
  {key:'Joan_Martinez', name:'Joan Martinez', team:'España', teamName:'España', flag:'ESP', role:'fw', young:true},
  {key:'Anisio_Cabral', name:'Anisio Cabral', team:'Guinea-Bissau', teamName:'Guinea-Bissau', flag:'GNB', role:'fw', young:true},
  {key:'João_Simões', name:'João Simões', team:'Portugal', teamName:'Portugal', flag:'POR', role:'fw', young:true},
  {key:'JJ_Gabriel', name:'JJ Gabriel', team:'Sudáfrica', teamName:'Sudáfrica', flag:'RSA', role:'fw', young:true}
];

const AW_PLAYERS=[
  {key:'Messi',name:'Leo Messi',teamName:'Argentina',flag:'ARG',sticker:'Argentina/Leo_Messi',role:'fw',young:false},
  {key:'Alvarez',name:'Julián Álvarez',teamName:'Argentina',flag:'ARG',sticker:'Argentina/Julian_Alvarez',role:'fw',young:false},
  {key:'Dibu',name:'E. Martínez',teamName:'Argentina',flag:'ARG',sticker:'Argentina/Emiliano_Martinez',role:'gk',young:false},
  {key:'Mbappe',name:'Kylian Mbappé',teamName:'Francia',flag:'FRA',sticker:'France/Mbappe-PNG-France-Football-Render-370x389',role:'fw',young:false},
  {key:'Yamal',name:'Lamine Yamal',teamName:'España',flag:'ESP',sticker:'Spain/Lamine_Yamal_Spain_2',role:'fw',young:true},
  {key:'Nico',name:'Nico Williams',teamName:'España',flag:'ESP',sticker:'Spain/Nico_Williams',role:'fw',young:true},
  {key:'Morata',name:'Álvaro Morata',teamName:'España',flag:'ESP',sticker:'Spain/Alvaro_Morata_Spain_png',role:'fw',young:false},
  {key:'Rodri',name:'Rodri',teamName:'España',flag:'ESP',sticker:'Spain/Rodri-PNG-Spain-Football-Render-370x389',role:'mf',young:false},
  {key:'Bellingham',name:'Jude Bellingham',teamName:'Inglaterra',flag:'ENG',sticker:'England/Jude_Bellingham',role:'mf',young:true},
  {key:'Kane',name:'Harry Kane',teamName:'Inglaterra',flag:'ENG',sticker:'England/Harry-Kane-PNG-England-Football-Render-1-370x389',role:'fw',young:false},
  {key:'Saka',name:'Bukayo Saka',teamName:'Inglaterra',flag:'ENG',sticker:'England/Bukayo_Saka',role:'fw',young:true},
  {key:'Vinicius',name:'Vinícius Jr.',teamName:'Brasil',flag:'BRA',sticker:'Brazil/Vinicius-JR-Brazil-PNG-Football-Render-370x389',role:'fw',young:false},
  {key:'Endrick',name:'Endrick',teamName:'Brasil',flag:'BRA',sticker:'Brazil/Endrick-Brazil-PNG-Football-Render--370x389',role:'fw',young:true},
  {key:'Ronaldo',name:'C. Ronaldo',teamName:'Portugal',flag:'POR',sticker:'Portugal/Cristiano_Ronaldo',role:'fw',young:false},
  {key:'Bruno',name:'Bruno Fernandes',teamName:'Portugal',flag:'POR',sticker:'Portugal/Bruno_Fernandes',role:'mf',young:false},
  {key:'Musiala',name:'Jamal Musiala',teamName:'Alemania',flag:'GER',sticker:'Germany/Musiala-PNG-Germany-Football-Render-370x389',role:'mf',young:true},
  {key:'Wirtz',name:'Florian Wirtz',teamName:'Alemania',flag:'GER',sticker:'Germany/Wirtz-PNG-Germany-Football-Render-370x389',role:'mf',young:true},
  {key:'VanDijk',name:'Virgil van Dijk',teamName:'P. Bajos',flag:'NED',sticker:'Netherlands/Virgil_van_Dijk',role:'df',young:false},
  {key:'Nunez',name:'Darwin Núñez',teamName:'Uruguay',flag:'URU',sticker:'Uruguay/Darwin_Nunez',role:'fw',young:false},
  {key:'Modric',name:'Luka Modrić',teamName:'Croacia',flag:'CRO',sticker:'croatia/Luka_Modric',role:'mf',young:false},
  {key:'DeBruyne',name:'Kevin De Bruyne',teamName:'Bélgica',flag:'BEL',sticker:'belgium/Kevin_De_Bruyne',role:'mf',young:false},
  {key:'Haaland',name:'Erling Haaland',teamName:'Noruega',flag:'NOR',sticker:'norway/Norway_Render',role:'fw',young:false},
];
// Exponer arrays como globales para acceso desde el bloque de auth (script separado)
window.AW_PLAYERS         = AW_PLAYERS;
window.YOUNG_PLAYERS_NXGN = YOUNG_PLAYERS_NXGN;
window.AWARDS_CFG         = AWARDS_CFG;
const awPicks={golden_ball:null,golden_boot:null,golden_glove:null,young_player:null};
let currentAward=null;
function openPicker(award) {
  currentAward = award;
  const sets = {
    golden_ball:  { title:'🏆 Balón de Oro — MVP',            list: AW_PLAYERS },
    golden_boot:  { title:'👟 Bota de Oro — Máx. goleador',   list: AW_PLAYERS.filter(p=>p.role!=='gk') },
    golden_glove: { title:'🧤 Guante de Oro — Mejor portero', list: AW_PLAYERS.filter(p=>p.role==='gk') },
    young_player: { title:'⭐ Mejor Joven ≤21',                list: YOUNG_PLAYERS_NXGN },
  };
  const cfg = sets[award];
  document.getElementById('picker-title').textContent = cfg.title;
  renderPickerList(cfg.list, awPicks[award]);
  document.getElementById('aw-overlay').classList.add('open');
}
function closePicker() {
  document.getElementById('aw-overlay').classList.remove('open');
  currentAward = null;
}
function overlayClick(e){if(e.target===document.getElementById('aw-overlay'))closePicker();}
function selectAward(playerKey) {
  if(!currentAward) return;
  const player = AW_PLAYERS.find(p => p.key === playerKey)
              || YOUNG_PLAYERS_NXGN.find(p => p.key === playerKey);
  if(!player) return;
  awPicks[currentAward] = player;
  window._awPicksSaved = false; // requiere guardar de nuevo
  // Actualizar slot visual
  const slot = document.querySelector('[data-award="' + currentAward + '"]');
  if(slot) {
    slot.classList.add('selected');
    const nameEl = document.getElementById('sel-name-' + currentAward);
    const teamEl = document.getElementById('sel-team-' + currentAward);
    const flagEl = document.getElementById('sel-flag-' + currentAward);
    if(nameEl) nameEl.textContent = player.name;
    if(teamEl) teamEl.textContent = player.teamName || '';
    if(flagEl) flagEl.src = SB + '/flags/' + player.flag + '.png';
  }
  updateAwardsFooter();
  closePicker();
  if(typeof saveAwPicks==='function') saveAwPicks();
}
function renderAwardsCard(){
  const container=document.getElementById('awards-container');
  container.innerHTML=`
    <div class="aw-header">
      <div class="aw-title-group">
        <div class="aw-title">Premios Individuales</div>
        <div class="aw-subtitle">Copa Mundial 2026</div>
      </div>
      <div class="aw-deadline">
        <div class="aw-deadline-dot"></div>
        Cierra 11 jun · 12:00
      </div>
    </div>
    <div class="aw-grid">
      <div class="aw-slot" data-award="golden_ball" onclick="openPicker('golden_ball')">
        <img class="aw-player-bg" id="bg-golden_ball" src="https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/MVP/MVP-maradona-1986.png" alt="MVP"/>
        <div class="aw-top"><div class="aw-icon">🏆</div><div class="aw-name">Balón de Oro</div><div class="aw-pts">15 pts</div></div>
        <div class="aw-bottom">
          <div class="aw-empty"><div class="aw-empty-ring">👤</div><div class="aw-empty-label">Seleccionar</div></div>
          <div class="aw-selected-info">
            <div class="aw-sel-name" id="sel-name-golden_ball">—</div>
            <div class="aw-sel-team"><div class="aw-sel-flag"><img id="sel-flag-golden_ball" src="" alt=""/></div><div class="aw-sel-teamname" id="sel-team-golden_ball">—</div></div>
            <div class="aw-sel-change">Cambiar →</div>
          </div>
        </div>
      </div>
      <div class="aw-slot" data-award="golden_boot" onclick="openPicker('golden_boot')">
        <img class="aw-player-bg" id="bg-golden_boot" src="https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/Golden%20foot/Golden-Foot-Ronaldo.png" alt="Golden Boot"/>
        <div class="aw-top"><div class="aw-icon">🥾</div><div class="aw-name">Bota de Oro</div><div class="aw-pts">15 pts</div></div>
        <div class="aw-bottom">
          <div class="aw-empty"><div class="aw-empty-ring">👤</div><div class="aw-empty-label">Seleccionar</div></div>
          <div class="aw-selected-info">
            <div class="aw-sel-name" id="sel-name-golden_boot">—</div>
            <div class="aw-sel-team"><div class="aw-sel-flag"><img id="sel-flag-golden_boot" src="" alt=""/></div><div class="aw-sel-teamname" id="sel-team-golden_boot">—</div></div>
            <div class="aw-sel-change">Cambiar →</div>
          </div>
        </div>
      </div>
      <div class="aw-slot" data-award="golden_glove" onclick="openPicker('golden_glove')">
        <img class="aw-player-bg" id="bg-golden_glove" src="https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/Golden%20glove/Casillas-removebg-preview.png" alt="Golden Glove"/>
        <div class="aw-top"><div class="aw-icon">🥊</div><div class="aw-name">Guante de Oro</div><div class="aw-pts">15 pts</div></div>
        <div class="aw-bottom">
          <div class="aw-empty"><div class="aw-empty-ring">👤</div><div class="aw-empty-label">Seleccionar</div></div>
          <div class="aw-selected-info">
            <div class="aw-sel-name" id="sel-name-golden_glove">—</div>
            <div class="aw-sel-team"><div class="aw-sel-flag"><img id="sel-flag-golden_glove" src="" alt=""/></div><div class="aw-sel-teamname" id="sel-team-golden_glove">—</div></div>
            <div class="aw-sel-change">Cambiar →</div>
          </div>
        </div>
      </div>
      <div class="aw-slot" data-award="young_player" onclick="openPicker('young_player')">
        <img class="aw-player-bg" id="bg-young_player" src="https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/MVP%20Young/Mejor%20sub%2021.png" alt="Mejor sub 21"/>
        <div class="aw-top"><div class="aw-icon">⭐</div><div class="aw-name">Mejor Joven ≤21</div><div class="aw-pts">10 pts</div></div>
        <div class="aw-bottom">
          <div class="aw-empty"><div class="aw-empty-ring">👤</div><div class="aw-empty-label">Seleccionar</div></div>
          <div class="aw-selected-info">
            <div class="aw-sel-name" id="sel-name-young_player">—</div>
            <div class="aw-sel-team"><div class="aw-sel-flag"><img id="sel-flag-young_player" src="" alt=""/></div><div class="aw-sel-teamname" id="sel-team-young_player">—</div></div>
            <div class="aw-sel-change">Cambiar →</div>
          </div>
        </div>
      </div>
    </div>
    <div class="aw-footer">
      <div class="aw-progress">
        <div class="aw-prog-dots"><div class="aw-prog-dot" id="aw-dot-0"></div><div class="aw-prog-dot" id="aw-dot-1"></div><div class="aw-prog-dot" id="aw-dot-2"></div><div class="aw-prog-dot" id="aw-dot-3"></div></div>
        <div class="aw-prog-label" id="aw-prog-label">0/4 premios</div>
      </div>
      <button id="aw-save-btn" style="display:none;align-items:center;gap:6px;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;pointer-events:auto;z-index:10">Guardar premios</button>
      <div class="aw-pts-possible" id="aw-pts-badge">+0 pts</div>
    </div>
  `;
}

// ========== INICIALIZACIÓN ==========
  // ─────────────────────────────────────────────────────────────
  /*
     js-ui-groups — UI tarjetas grupos, modal, predicciones
     Archivo destino : ui-groups.js
     -----------------------------------------------------------
     Usa             : PARTIDOS, EQUIPOS, predictions, db, currentUser
     Expone          : renderMatchCard, updateCardUI, openModal, savePredictions, renderGroupTableCard, refreshGroupTables
     Deps            : js-data, js-auth, js-ligas
     Notas           : Bloque mas grande. Toda la UI de fase de grupos.
================================================================ */
// GUARDAR PREDICCIONES DE GRUPOS — savePredictions,
  //   checkGroupsComplete, finalizarPorra (inicio del bloque cerrar)
  // ─────────────────────────────────────────────────────────────
function savePredictions() {
  try { localStorage.setItem('porra_predictions', JSON.stringify(predictions)); } catch(e) {}
  // Sincronizar con Supabase si hay sesión activa
  if (currentUser) {
    if (window._porraCerrada) return; // porra cerrada — no escribir en DB
    const leagueId = getActiveLeagueId();
    if (!leagueId) return; // sin liga activa no se guarda
    const rows = Object.entries(predictions)
      .filter(([, p]) => p && p.saved)
      .map(([match_id, p]) => ({
        user_id:   currentUser.id,
        league_id: leagueId,
        match_id,
        local:     p.l,
        visitante: p.v,
        scorer:    p.gol || null
      }));
    if (rows.length > 0) {
      db.from('predictions').upsert(rows, { onConflict: 'league_id,user_id,match_id' })
        .then(({ error }) => {
          if (error) console.warn('Error guardando predictions:', error.message);
          // Llamar checkFinalizarReady tras confirmar guardado en DB
          checkFinalizarReady();
        });
      return; // checkFinalizarReady se llama en el .then
    }
  }
}

function checkGroupsComplete() {
  savePredictions(); // persistir siempre al verificar
  let filled = 0;
  PARTIDOS.forEach(m => {
    const p = predictions[getMatchKey(m)];
    if(p && p.saved) filled++;
  });
  const total = PARTIDOS.length; // 72
  const pct = Math.round(filled / total * 100);

  // Header button
  const btn = document.getElementById('btn-go-eliminatorias');
  const icon = document.getElementById('btn-elim-icon');
  const text = document.getElementById('btn-elim-text');
  const count = document.getElementById('btn-elim-count');
  if(btn) {
    count.textContent = filled+'/'+total;
    if(filled >= total) {
      btn.disabled = false;
      btn.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#4ade80;padding:6px 14px;border-radius:10px;border:1px solid #166534;background:#052e16;cursor:pointer;transition:all .3s;opacity:1;font-family:Inter,sans-serif;box-shadow:0 0 16px rgba(74,222,128,.2)';
      icon.textContent = '⚽';
      text.textContent = 'Ver Eliminatorias';
      count.style.display = 'none';
    } else {
      btn.disabled = true;
      btn.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#4b5563;padding:6px 14px;border-radius:10px;border:1px solid #27272a;background:#1c1c1e;cursor:not-allowed;transition:all .3s;opacity:.6;font-family:Inter,sans-serif';
      icon.textContent = '🔒';
      text.textContent = 'Eliminatorias';
      count.style.display = 'inline';
    }
  }

  // CTA banner
  const ctaLocked = document.getElementById('cta-locked-msg');
  const ctaReady  = document.getElementById('cta-ready-msg');
  const ctaFilled = document.getElementById('cta-filled');
  if(ctaFilled) ctaFilled.textContent = filled;

  // Group dots
  const dotsEl = document.getElementById('cta-groups-dots');
  if(dotsEl) {
    dotsEl.innerHTML = '';
    GRUPOS.forEach(g => {
      const gFilled = PARTIDOS.filter(m => m.group===g.letra && predictions[getMatchKey(m)]?.saved).length;
      const dot = document.createElement('div');
      dot.title = 'Grupo '+g.letra+' ('+gFilled+'/6)';
      dot.style.cssText = 'width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;transition:all .3s;';
      if(gFilled >= 6) {
        dot.style.background = '#052e16';
        dot.style.border = '1.5px solid #166534';
        dot.style.color = '#4ade80';
        dot.textContent = g.letra;
      } else if(gFilled > 0) {
        dot.style.background = '#1c1003';
        dot.style.border = '1.5px solid #d97706';
        dot.style.color = '#fb923c';
        dot.textContent = g.letra;
      } else {
        dot.style.background = '#1c1c1e';
        dot.style.border = '1.5px solid #3a3a3e';
        dot.style.color = '#6b7280';
        dot.textContent = g.letra;
      }
      dotsEl.appendChild(dot);
    });
  }

  if(ctaLocked && ctaReady) {
    if(filled >= total) {
      ctaLocked.style.display = 'none';
      ctaReady.style.display = 'block';
    } else {
      ctaLocked.style.display = 'block';
      ctaReady.style.display = 'none';
    }
  }
}


function initGrupos() {
  // Mostrar barra global de dados si usuario logueado
  const diceBar = document.getElementById('dice-global-bar');
  if(diceBar && currentUser && !window._porraCerrada) diceBar.style.display = 'flex';
  window.scrollTo(0,0);
  renderAll(() => {
    // Cuando todos los grupos están en DOM, re-renderizar tablas con datos en memoria
    if (typeof refreshGroupTables === 'function') refreshGroupTables();
  });
  checkGroupsComplete();
  // Actualizar countdown cada 5s (no cada 1s — mejora rendimiento scroll)
  // Solo actualiza los pills de estado, no re-renderiza todo
  setInterval(() => {
    PARTIDOS.forEach((match, idx) => {
      const pill = document.getElementById('spill-'+idx);
      const stxt = document.getElementById('stxt-'+idx);
      if(!pill || !stxt) return;
      const estado = getEstadoPartido(match);
      if(estado==='open'){
        pill.className='status-pill open';
        const ms=new Date(match.date)-4*24*3600*1000-new Date();
        stxt.textContent='Abierta · '+fmtMs(ms);
      } else if(estado==='closing'){
        pill.className='status-pill closing';
        const ms=new Date(match.date)-2*24*3600*1000-new Date();
        stxt.textContent='¡Cierra en '+fmtMs(ms)+'!';
      } else if(estado==='live'){
        pill.className='status-pill live';
        const min=Math.min(Math.floor((new Date()-new Date(match.date))/60000),90);
        stxt.textContent='EN VIVO '+min+"'";
      }
      // closed y done no cambian — no actualizar
    });
    updateGlobalPoints();
    checkGroupsComplete(); // habilitar botón eliminatorias
  }, 1000);

}


  // ─────────────────────────────────────────────────────────────
  // KO — CONSTANTES: BRACKET, ROUND_CONFIG
  // ─────────────────────────────────────────────────────────────
/*
     js-ko — Bracket KO, eliminatorias, IA de partidos
     Archivo destino : ko.js
     -----------------------------------------------------------
     Usa             : BRACKET, koPredictions, resolvedSlots, db, currentUser
     Expone          : resolveKO, renderKO, buildKOCard, saveKOPred, undoKO
     Deps            : js-data, js-auth, js-ligas
     Notas           : Todo el sistema KO incluyendo IA de prediccion.
================================================================ */
/* ══ KO CONSTANTS ══ */
const BRACKET = {
  r32: [
    {id:73,  home:"2A",  away:"2B",      venue:"Los Ángeles",   date:"2026-06-28"},
    {id:74,  home:"1E",  away:"T_ABCDF", venue:"Boston",        date:"2026-06-29"},
    {id:75,  home:"1F",  away:"2C",      venue:"Monterrey",     date:"2026-06-29"},
    {id:76,  home:"1C",  away:"2F",      venue:"Houston",       date:"2026-06-29"},
    {id:77,  home:"1I",  away:"T_CDFGH", venue:"Nueva York",    date:"2026-06-30"},
    {id:78,  home:"2E",  away:"2I",      venue:"Dallas",        date:"2026-06-30"},
    {id:79,  home:"1A",  away:"T_CEFHI", venue:"Cdad. México",  date:"2026-06-30"},
    {id:80,  home:"1L",  away:"T_EHIJK", venue:"Atlanta",       date:"2026-07-01"},
    {id:81,  home:"1D",  away:"T_BEFIJ", venue:"San Francisco", date:"2026-07-01"},
    {id:82,  home:"1G",  away:"T_AEHIJ", venue:"Seattle",       date:"2026-07-01"},
    {id:83,  home:"2K",  away:"2L",      venue:"Toronto",       date:"2026-07-02"},
    {id:84,  home:"1H",  away:"2J",      venue:"Los Ángeles",   date:"2026-07-02"},
    {id:85,  home:"1B",  away:"T_EFGIJ", venue:"Vancouver",     date:"2026-07-02"},
    {id:86,  home:"1J",  away:"2H",      venue:"Miami",         date:"2026-07-03"},
    {id:87,  home:"1K",  away:"T_DEIJL", venue:"Kansas City",   date:"2026-07-03"},
    {id:88,  home:"2D",  away:"2G",      venue:"Dallas",        date:"2026-07-03"},
  ],
  r16: [
    {id:89,  home:"W74", away:"W77", venue:"Filadelfia",   date:"2026-07-04"},
    {id:90,  home:"W73", away:"W75", venue:"Houston",      date:"2026-07-04"},
    {id:91,  home:"W76", away:"W78", venue:"Nueva York",   date:"2026-07-05"},
    {id:92,  home:"W79", away:"W80", venue:"Cdad. México", date:"2026-07-05"},
    {id:93,  home:"W83", away:"W84", venue:"Dallas",       date:"2026-07-06"},
    {id:94,  home:"W81", away:"W82", venue:"Seattle",      date:"2026-07-06"},
    {id:95,  home:"W86", away:"W88", venue:"Atlanta",      date:"2026-07-07"},
    {id:96,  home:"W85", away:"W87", venue:"Vancouver",    date:"2026-07-07"},
  ],
  qf: [
    {id:97,  home:"W89", away:"W90", venue:"Boston",      date:"2026-07-09"},
    {id:98,  home:"W93", away:"W94", venue:"Los Ángeles", date:"2026-07-10"},
    {id:99,  home:"W91", away:"W92", venue:"Miami",       date:"2026-07-11"},
    {id:100, home:"W95", away:"W96", venue:"Kansas City", date:"2026-07-11"},
  ],
  sf: [
    {id:101, home:"W97", away:"W98",  venue:"Dallas",  date:"2026-07-14"},
    {id:102, home:"W99", away:"W100", venue:"Atlanta", date:"2026-07-15"},
  ],
  third: [
    {id:103, home:"L101", away:"L102", venue:"Miami",      date:"2026-07-18"},
  ],
  final: [
    {id:104, home:"W101", away:"W102", venue:"Nueva York", date:"2026-07-19"},
  ],
};

const ROUND_CONFIG = [
  {key:'r32',  num:'16', name:'Dieciseisavos de Final', sub:'16 partidos · 28 jun – 3 jul', pts:'+192 pts posibles', gridCls:'r32'},
  {key:'r16',  num:'8',  name:'Octavos de Final',       sub:'8 partidos · 4–7 jul',         pts:'+136 pts posibles', gridCls:'r16'},
  {key:'qf',   num:'4',  name:'Cuartos de Final',       sub:'4 partidos · 9–11 jul',         pts:'+88 pts posibles',  gridCls:'r8'},
  {key:'sf',   num:'2',  name:'Semifinales',             sub:'2 partidos · 14–15 jul',        pts:'+104 pts posibles', gridCls:'r4'},
  {key:'third',num:'🥉', name:'3er y 4º Puesto',        sub:'Final de consolación · 18 jul · Miami',    pts:'+7 pts + (premio 3er y 4º puesto)',  gridCls:'r1'},
  {key:'final',num:'🏆', name:'Gran Final',              sub:'19 jul · MetLife Stadium, NY',  pts:'+7 pts + (premio 1er y 2º puesto)', gridCls:'r1'},
];

  // ─────────────────────────────────────────────────────────────
  // KO — ESTADO Y GUARDADO: koPredictions, resolvedSlots, saveKO
  // ─────────────────────────────────────────────────────────────
/* ══ KO STATE ══ */
let koPredictions = {};
let resolvedSlots = {};
let currentView   = 'cinematic';


async function saveKO() {
  try {
    localStorage.setItem('porra_ko_predictions', JSON.stringify(koPredictions));
    localStorage.setItem('porra_predictions', JSON.stringify(predictions));
  } catch(e) {}
  if (currentUser) {
    if (window._porraCerrada) return; // porra cerrada — no escribir en DB
    const leagueId = getActiveLeagueId();
    if (!leagueId) return; // sin liga activa no se guarda
    const rows = Object.entries(koPredictions)
      .filter(([k, p]) => p && p.saved && !isNaN(Number(k)))
      .map(([match_id, p]) => ({
        user_id:    currentUser.id,
        league_id:  leagueId,
        match_id:   Number(match_id),
        local:      p.l,
        visitante:  p.v,
        classifier: p.classifier || null,
        scorer:     p.gol || null
      }));
    if (rows.length > 0) {
      const { error } = await db.from('ko_predictions').upsert(rows, { onConflict: 'league_id,user_id,match_id' });
      if (error) {
        console.warn('Error guardando ko_predictions:', error.message);
        // Revertir saved=false para los que fallaron
        rows.forEach(r => {
          const p = koPredictions[r.match_id] || koPredictions[String(r.match_id)];
          if (p) p.saved = false;
        });
      }
    }
  }
  checkFinalizarReady();
}
// Normalizar claves de koPredictions: JSON convierte números a strings al parsear
// → asegurar que siempre podemos leer con clave numérica O string
function normKoPredictions() {
  const keys = Object.keys(koPredictions);
  keys.forEach(k => {
    const num = Number(k);
    if(!isNaN(num) && koPredictions[num] === undefined) {
      koPredictions[num] = koPredictions[k];
    }
  });
}


  // ─────────────────────────────────────────────────────────────
  // KO — LÓGICA DE SLOTS: resolveAllSlots, resolveSlot, getTeam,
  //   getGroupsProgress, areGroupsComplete
  // ─────────────────────────────────────────────────────────────
function resolveAllSlots() {
  resolvedSlots = {};
  const tables = {};
  GRUPOS.forEach(g=>{ tables[g.letra]=calcGroupTableAdvanced(g.letra); });
  const bestThirds = getBestThirdsAll();

  // Resolve group slots: 1A, 2B, T_ABCDF
  GRUPOS.forEach(g=>{
    const t=tables[g.letra];
    if(t&&t[0]) resolvedSlots['1'+g.letra]=t[0].name;
    if(t&&t[1]) resolvedSlots['2'+g.letra]=t[1].name;
    if(t&&t[2]) resolvedSlots['3'+g.letra]=t[2].name;
  });

  // Resolve best-thirds slots (T_GROUPS)
  // The assignment of best thirds to specific slots follows FIFA rules
  // For simplicity: each T_XXXX slot gets the best available third from those groups
  const thirdSlots = ['T_ABCDF','T_CDFGH','T_CEFHI','T_EHIJK','T_BEFIJ','T_AEHIJ','T_EFGIJ','T_DEIJL'];
  let bestThirdsAvailable = [...bestThirds];
  thirdSlots.forEach((slot,i)=>{
    if(bestThirdsAvailable[i]) resolvedSlots[slot]=bestThirdsAvailable[i];
  });

  // Resolve W/L slots (knockout round results)
  function resolveKO(id) {
    const pred = koPredictions[id];
    if(!pred || pred.l===null || pred.v===null) return;
    const m = findMatch(id);
    if(!m) return;
    const hTeam = resolvedSlots[m.home] || m.home;
    const aTeam = resolvedSlots[m.away] || m.away;
    if(pred.l>pred.v){ resolvedSlots['W'+id]=hTeam; resolvedSlots['L'+id]=aTeam; }
    else if(pred.v>pred.l){ resolvedSlots['W'+id]=aTeam; resolvedSlots['L'+id]=hTeam; }
    else {
      // Empate → usar el equipo seleccionado como ganador en penaltis
      if(pred.classifier) {
        resolvedSlots['W'+id] = pred.classifier;
        resolvedSlots['L'+id] = pred.classifier === hTeam ? aTeam : hTeam;
      }
      // Si no hay clasificado seleccionado → slot queda vacío hasta que se elija
    }
  }

  // Process in order
  BRACKET.r32.forEach(m=>resolveKO(m.id));
  BRACKET.r16.forEach(m=>resolveKO(m.id));
  BRACKET.qf.forEach(m=>resolveKO(m.id));
  BRACKET.sf.forEach(m=>resolveKO(m.id));
  BRACKET.third.forEach(m=>resolveKO(m.id));
}


function findMatch(id) {
  const allRounds = [...BRACKET.r32,...BRACKET.r16,...BRACKET.qf,...BRACKET.sf,...BRACKET.third,...BRACKET.final];
  return allRounds.find(m=>m.id===id);
}


function resolveSlot(slot) {
  if(resolvedSlots[slot]) return resolvedSlots[slot];
  // Pretty label for unresolved slots
  if(slot.startsWith('W')) return 'G. Partido '+slot.slice(1);
  if(slot.startsWith('L')) return 'P. Partido '+slot.slice(1);
  if(slot.startsWith('T_')) return 'Mejor 3º';
  if(slot.length===2) {
    const pos=slot[0]==='1'?'1º':'2º';
    return pos+' Gr.'+slot[1];
  }
  return '?';
}



// getTeam: busca un equipo por nombre en EQUIPOS[]
function getTeam(name) {
  return EQUIPOS.find(e => e.name === name) || null;
}

function getTeamForSlot(slot) {
  const name = resolvedSlots[slot];
  if(!name) return null;
  return getTeam(name);
}


function getGroupsProgress() {
  // Usa PARTIDOS directamente (igual que checkGroupsComplete)
  // Cuenta como completado si: tiene marcador (l!==null) O está saved
  let filled = 0;
  const total = PARTIDOS.length; // 72
  PARTIDOS.forEach(m => {
    const p = predictions[getMatchKey(m)];
    if (p && (p.saved || p.l !== null)) filled++;
  });
  return { filled, total, pct: total ? Math.round(filled/total*100) : 0 };
}


function areGroupsComplete() {
  return getGroupsProgress().filled >= 72;
}


function getKOEstado(match) {
  const now=new Date(), ko=new Date(match.date);
  if(now<new Date(ko-2*24*3600000)) return 'open';
  if(now<ko) return 'closed';
  if(now<new Date(ko.getTime()+95*60000)) return 'live';
  return 'done';
}


  // ─────────────────────────────────────────────────────────────
  // KO — RENDER: buildKOCard, buildCinematicView, buildBracketView,
  //   buildStadiumView, buildChampionCard, buildFinalSection
  // ─────────────────────────────────────────────────────────────
function buildKOCard(match, size='normal') {
  const hSlot=match.home, aSlot=match.away;
  const hTeam=getTeamForSlot(hSlot);
  const aTeam=getTeamForSlot(aSlot);
  const hName=resolvedSlots[hSlot]||null;
  const aName=resolvedSlots[aSlot]||null;
  const hResolved=!!hTeam, aResolved=!!aTeam;
  const bothResolved=hResolved&&aResolved;

  const pred=koPredictions[match.id] || koPredictions[String(match.id)] || {};
  const estado=getKOEstado(match);
  const isLocked=!bothResolved; // locked if teams not yet known

  // Slot display labels
  const hLabel=hName||(hSlot.startsWith('W')?'G.P'+hSlot.slice(1):hSlot.startsWith('L')?'P.P'+hSlot.slice(1):resolveSlot(hSlot));
  const aLabel=aName||(aSlot.startsWith('W')?'G.P'+aSlot.slice(1):aSlot.startsWith('L')?'P.P'+aSlot.slice(1):resolveSlot(aSlot));

  // Kit URLs
  const hKit = hTeam ? kitUrl(hTeam.slug, 'home') : '';
  const aKit = aTeam ? kitUrl(aTeam.slug, 'away') : '';
  const hFlag = hTeam ? `${SB}/flags/${hTeam.flag}.png` : '';
  const aFlag = aTeam ? `${SB}/flags/${aTeam.flag}.png` : '';

  // Status
  let statusCls='pending', statusTxt='Por definir';
  if(!bothResolved){ statusCls='pending'; statusTxt='Grupos pendientes'; }
  else if(pred.saved){
    statusCls='saved';
    // Mostrar siempre el equipo que se clasifica
    let winner = null;
    if(pred.l !== null && pred.v !== null) {
      if(pred.l > pred.v)       winner = hName || hSlot;
      else if(pred.v > pred.l)  winner = aName || aSlot;
      else                       winner = pred.classifier; // empate → equipo elegido
    }
    if(winner) {
      statusTxt = '✓ ' + (winner.length > 11 ? winner.substring(0,10)+'.' : winner);
    } else {
      statusTxt = '✓ Guardado';
    }
  }
  else if(estado==='open'){ statusCls='open'; statusTxt='Pronosticar →'; }
  else if(estado==='closed'){ statusCls='locked'; statusTxt='🔒 Cerrado'; }
  else if(estado==='live'){ statusCls='live'; statusTxt='🔴 En vivo'; }
  else if(estado==='done'){ statusCls='done'; statusTxt='Finalizado'; }

  const isFinal=match.id===104;
  const card=document.createElement('div');
  card.className='ko-card'+(isLocked?' ko-locked':'')+(pred.saved?' ko-saved':'')+(isFinal?' ko-final':'');
  card.style.animationDelay=(Math.random()*0.2)+'s';

  if(!isLocked) card.onclick=()=>openModal(match);

  card.innerHTML=`
    <div class="ko-hero">
      ${hTeam?`<div class="ko-half L">
        <div class="ko-color" style="background:#fff"></div>
        <div class="ko-kit" style="background-image:linear-gradient(to bottom, rgba(10,10,20,0.5) 0%, transparent 35%),linear-gradient(to bottom, transparent 60%, rgba(10,10,20,0.6) 100%),url('${hKit}')"></div>
        <div class="ko-vign"></div>
      </div>`:''}
      ${aTeam?`<div class="ko-half R">
        <div class="ko-color" style="background:#fff"></div>
        <div class="ko-kit" style="background-image:linear-gradient(to bottom, rgba(10,10,20,0.5) 0%, transparent 35%),linear-gradient(to bottom, transparent 60%, rgba(10,10,20,0.6) 100%),url('${aKit}')"></div>
        <div class="ko-vign"></div>
      </div>`:''}
      ${isLocked?`<div class="ko-locked-overlay">
        <div class="ko-locked-icon">🔒</div>
        <div class="ko-locked-label">Completa los grupos para desbloquear este cruce</div>
      </div>`:`<div class="ko-fade"></div>`}
      <div class="ko-team home">
        <div class="ko-flag">${hTeam?`<img src="${hFlag}" alt="" onerror="this.remove()"/>`:'❓'}</div>
        <div class="ko-tname${!hTeam?' tbd':''}">${hTeam?hLabel.substring(0,14):hLabel}</div>
        <div class="ko-trole">local</div>
      </div>
      <div class="ko-team away">
        <div class="ko-flag">${aTeam?`<img src="${aFlag}" alt="" onerror="this.remove()"/>`:'❓'}</div>
        <div class="ko-tname${!aTeam?' tbd':''}">${aTeam?aLabel.substring(0,14):aLabel}</div>
        <div class="ko-trole">visitante</div>
      </div>
      <div class="ko-center">
        <div class="ko-vs-circle">
          <div class="ko-ball-bg"></div>
          <span class="ko-vs-text">VS</span>
        </div>
        <div class="ko-pill">${match.venue}</div>
          <div style="font-size:8px;font-weight:600;color:rgba(255,255,255,.5);margin-top:3px;text-align:center;letter-spacing:.04em">${fmtTime(match.date)}</div>
      </div>
    </div>
    <div class="ko-footer">
      <span class="ko-date">${fmtDate(match.date)}</span>
      <span class="ko-status ${statusCls}">${statusTxt}</span>
    </div>
  `;
  return card;
}



// Desglose informativo por ronda para el popover "i"
const ROUND_BREAKDOWN = {
  r32: { matches:16, advPts:5,       advLabel:'5 pts × 16 equipos que avanzan' },
  r16: { matches:8,  advPts:10,      advLabel:'10 pts × 8 equipos que avanzan' },
  qf:  { matches:4,  advPts:15,      advLabel:'15 pts × 4 equipos que avanzan' },
  sf:  { matches:2,  advPts:20+25,   advLabel:'(20+25) pts × 2 equipos que pasan a la final' },
};
function getRoundBreakdownHTML(key) {
  const r = ROUND_BREAKDOWN[key];
  if (!r) return '';
  const matchPts  = r.matches * 7;
  const advPts    = r.matches * r.advPts;
  const total     = matchPts + advPts;
  const perMatch  = key === 'sf' ? '7 pts partido + 20 avance semi + 25 avance final = hasta 52 pts' : `7 pts partido + ${r.advPts} pts avance = hasta ${7+r.advPts} pts`;
  return `
    <div class="round-popover-title">Desglose de puntos posibles</div>
    <div class="round-popover-row">
      <span class="round-popover-label">Puntos de partido (${r.matches} × 7 máx)</span>
      <span class="round-popover-val">${matchPts} pts</span>
    </div>
    <div class="round-popover-row">
      <span class="round-popover-label">${r.advLabel}</span>
      <span class="round-popover-val">${advPts} pts</span>
    </div>
    <div class="round-popover-row">
      <span class="round-popover-label">Total máximo esta ronda</span>
      <span class="round-popover-val green">${total} pts</span>
    </div>
    <div style="margin-top:10px;font-size:11px;color:#374151;line-height:1.5">
      Por partido: ${perMatch}
    </div>
  `;
}

function buildCinematicView() {
  const container=document.getElementById('rounds-container');
  container.innerHTML='';

  ROUND_CONFIG.forEach(cfg=>{
    const matches=BRACKET[cfg.key];
    if(!matches||!matches.length) return;

    const isFinalRound=(cfg.key==='final');

    if(isFinalRound) {
      // Header de sección para la Gran Final
      const finalHdr = document.createElement('div');
      finalHdr.className = 'round-section';
      finalHdr.innerHTML = `
        <div class="round-header">
          <div class="round-num">🏆</div>
          <div class="round-info">
            <div class="round-name">Campeón · 2º Clasificado</div>
            <div class="round-meta">Gran Final · 19 jul · MetLife Stadium, Nueva York</div>
          </div>
          <div class="round-pts-badge">+7 pts + (premio 1er y 2º puesto)</div>
        </div>
        <div class="round-divider"></div>
      `;
      container.appendChild(finalHdr);

      // Final: buildFinalSection devuelve elemento DOM (mantiene onclick)
      const finalEl = buildFinalSection(matches[0]);
      if(typeof finalEl === 'string') {
        const sec = document.createElement('div');
        sec.innerHTML = finalEl;
        container.appendChild(sec);
      } else {
        container.appendChild(finalEl);
      }
      // Aplicar layout móvil si corresponde
      if(typeof applyFinalSectionMobile === 'function') applyFinalSectionMobile();
      return;
    }

    const section=document.createElement('div');
    section.className='round-section';

    // Header
    const hdr=document.createElement('div');
    hdr.className='round-header';
    hdr.innerHTML=`
      <div class="round-num">${cfg.num}</div>
      <div class="round-info">
        <div class="round-name">${cfg.name}</div>
        <div class="round-meta">
          ${cfg.sub}${({r32:'5',r16:'10',qf:'15',sf:'20+25'}[cfg.key]) ? ` · ${({r32:'5',r16:'10',qf:'15',sf:'20+25'})[cfg.key]} pts por equipo acertado que avanza` : ''}
          ${ROUND_BREAKDOWN[cfg.key] ? `<button class="round-info-btn" onclick="toggleRoundPopover('pop-${cfg.key}',this)" title="Ver desglose de puntos">i</button>` : ''}
        </div>
        <div class="round-popover" id="pop-${cfg.key}">${getRoundBreakdownHTML(cfg.key)}</div>
      </div>
      <div class="round-pts-badge">${cfg.pts}</div>
    `;
    section.appendChild(hdr);

    const div=document.createElement('div');
    div.className='round-divider';
    section.appendChild(div);

    // Cards grid
    const grid=document.createElement('div');
    grid.className='ko-grid '+cfg.gridCls;
    matches.forEach(m=>{
      try {
        const card = buildKOCard(m);
        if(card) grid.appendChild(card);
      } catch(e) {
        console.error('[buildCinematicView] error en partido', m.id, e);
      }
    });
    section.appendChild(grid);

    container.appendChild(section);
  });

  // Add 3rd place section header before the grid
  // (already handled above in ROUND_CONFIG)
}


const BADGE_MAP = {
  'mexico': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/mexico.png',
  'south-africa': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/south-africa.png',
  'korea': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/south-korea.png',
  'czech': null,
  'canada': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/canada.png',
  'bosnia': null,
  'qatar': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/qatar.png',
  'switzerland': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/switzerland.png',
  'brazil': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/brazil.png',
  'morocco': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/morocco.png',
  'haiti': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/haiti.png',
  'scotland': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/scotland.png',
  'usa': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/united-states.png',
  'paraguay': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/paraguay.png',
  'australia': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/australia.png',
  'turkey': null,
  'germany': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/germany.png',
  'curacao': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/curacao.png',
  'ivory-coast': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/ivory-coast.png',
  'ecuador': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/ecuador.png',
  'netherlands': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/netherlands.png',
  'japan': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/japan.png',
  'sweden': null,
  'tunisia': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/tunisia.png',
  'belgium': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/belgium.png',
  'egypt': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/egypt.png',
  'iran': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/iran.png',
  'new-zealand': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/new-zealand.png',
  'spain': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/spain.png',
  'cape-verde': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/cape-verde.png',
  'saudi-arabia': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/saudi-arabia.png',
  'uruguay': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/uruguay.png',
  'france': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/france.png',
  'senegal': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/senegal.png',
  'irak': null,
  'norway': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/norway.png',
  'argentina': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/argentina.png',
  'algeria': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/algeria.png',
  'austria': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/austria.png',
  'jordan': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/jordan.png',
  'portugal': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/portugal.png',
  'drc-jam': null,
  'uzbekistan': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/uzbekistan.png',
  'colombia': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/colombia.png',
  'england': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/england.png',
  'croatia': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/croatia.png',
  'ghana': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/ghana.png',
  'panama': 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/badges/panama.png'
};
function getBadgeUrl(slug) {
  return BADGE_MAP[slug] || null;
}

/* ══ CUADRO DE CAMPEÓN ══ */
function buildChampionCard(winnerTeam) {
  if(!winnerTeam) return '';
  const badge = getBadgeUrl(winnerTeam.slug);
  const badgeEl = badge
    ? `<img src="${badge}" alt="" style="width:120px;height:120px;object-fit:contain;filter:drop-shadow(0 6px 24px rgba(0,0,0,.7));position:relative;z-index:1" onerror="this.style.display='none'">`
    : `<div style="width:120px;height:120px;display:flex;align-items:center;justify-content:center;font-size:56px">🏆</div>`;

  return `
    <div id="champion-card" style="
      background:linear-gradient(135deg,#0a1628 0%,#111d38 35%,#1c1200 70%,#0d0d0d 100%);
      border:1px solid rgba(250,204,21,.35);
      border-radius:24px;
      padding:40px 48px;
      display:flex;
      align-items:center;
      gap:40px;
      position:relative;
      overflow:hidden;
      box-shadow:0 0 60px rgba(250,204,21,.12), 0 8px 40px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06);
      animation:championAppear .7s cubic-bezier(.34,1.4,.64,1) both;
      width:100%;
    ">
      <!-- Fondo radial dorado -->
      <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 30% 50%,rgba(250,204,21,.07),transparent 65%);pointer-events:none"></div>
      <!-- Lineas decorativas -->
      <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(250,204,21,.4) 40%,rgba(250,204,21,.4) 60%,transparent)"></div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(250,204,21,.2) 40%,rgba(250,204,21,.2) 60%,transparent)"></div>

      <!-- Logo FIFA izquierda -->
      <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:8px">
        <img src="https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/Logos/2026_FIFA_World_Cup.png" alt="FIFA World Cup 2026"
          style="width:80px;height:auto;object-fit:contain;filter:drop-shadow(0 4px 12px rgba(0,0,0,.6))"
          onerror="this.style.display='none'">
      </div>

      <!-- Divisor vertical -->
      <div style="width:1px;height:100px;background:linear-gradient(180deg,transparent,rgba(250,204,21,.3) 50%,transparent);flex-shrink:0"></div>

      <!-- Escudo centro -->
      <div style="flex-shrink:0;position:relative">
        <div style="position:absolute;inset:-12px;border-radius:50%;background:radial-gradient(circle,rgba(250,204,21,.12),transparent 70%);animation:goldPulse 2.5s ease-in-out infinite"></div>
        ${badgeEl}
      </div>

      <!-- Texto derecha -->
      <div style="flex:1;min-width:0">
        <div style="font-size:9px;font-weight:800;color:rgba(250,204,21,.65);text-transform:uppercase;letter-spacing:.18em;margin-bottom:10px">
          🏆 Campeón del Mundo
        </div>
        <div style="font-family:'Inter Tight',sans-serif;font-size:32px;font-weight:900;color:#fef9c3;letter-spacing:-.02em;line-height:1;text-shadow:0 2px 16px rgba(0,0,0,.8);margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${winnerTeam.name}
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <div style="font-size:11px;color:rgba(250,204,21,.45);font-style:italic">FIFA World Cup 2026</div>
          <div style="font-size:11px;color:rgba(255,255,255,.3)">19 de julio · MetLife Stadium, Nueva York</div>
        </div>
      </div>

      <!-- sin decoración de fondo -->
    </div>
  `;
}

function buildFinalSection(match) {
  // Resolver equipos
  const hTeam  = getTeamForSlot(match.home);
  const aTeam  = getTeamForSlot(match.away);
  const hName  = resolvedSlots[match.home];
  const aName  = resolvedSlots[match.away];
  const finalPred = koPredictions[match.id] || koPredictions[String(match.id)] || {};

  // Campeón
  let champName = null;
  if(finalPred.saved && finalPred.l !== null) {
    if(finalPred.l > finalPred.v)      champName = hName;
    else if(finalPred.v > finalPred.l) champName = aName;
    else if(finalPred.classifier)      champName = finalPred.classifier;
  }
  const champTeam = champName ? EQUIPOS.find(e => e.name === champName) : null;

  // Puestos 2º/3º/4º
  const thirdMatch = BRACKET.third[0];
  const thirdPred  = koPredictions[103] || koPredictions['103'] || {};
  let pos2=null, pos3=null, pos4=null;
  if(champName) pos2 = (champName === hName) ? aName : hName;
  if(thirdPred.saved && thirdPred.l !== null) {
    const t3h = resolvedSlots[thirdMatch.home];
    const t3a = resolvedSlots[thirdMatch.away];
    if(thirdPred.l > thirdPred.v)       { pos3=t3h; pos4=t3a; }
    else if(thirdPred.v > thirdPred.l)  { pos3=t3a; pos4=t3h; }
    else if(thirdPred.classifier)       { pos3=thirdPred.classifier; pos4=(thirdPred.classifier===t3h)?t3a:t3h; }
  }

  // Helper: escudo (badge) con fallback a bandera
  function teamImg(name, size=36) {
    if(!name) return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#27272a;border:1px solid #3a3a3e"></div>`;
    const team = EQUIPOS.find(e => e.name === name);
    if(!team) return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#27272a;border:1px solid #3a3a3e"></div>`;
    const badge = getBadgeUrl(team.slug);
    const flag  = `${SB}/flags/${team.flag}.png`;
    const src   = badge || flag;
    const style = badge
      ? `width:${size}px;height:${size}px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 2px 6px rgba(0,0,0,.5))`
      : `width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0`;
    return `<img src="${src}" style="${style}" onerror="this.src='${flag}'">`;
  }

  // BOX STYLES comunes
  const boxBase = 'border-radius:16px;border:1px solid #27272a;padding:16px 20px;background:var(--card)';

  // ── Construir outer ──────────────────────────────────────────
  const outer = document.createElement('div');
  outer.className = 'final-section';

  // ── FILA 1: [Caja1: tarjeta final] [Caja2: campeón] ─────────
  const row1 = document.createElement('div');
  row1.style.cssText = 'display:flex;gap:16px;align-items:stretch;margin-bottom:16px';
  row1.className = 'final-row1';

  // Caja 1 — tarjeta del partido final (borde dorado)
  const cardEl = buildKOCard(match);
  cardEl.classList.add('ko-final');
  const box1 = document.createElement('div');
  box1.style.cssText = 'flex:0 0 420px;border-radius:16px;border:1.5px solid rgba(250,204,21,.35);overflow:hidden';
  box1.className = 'final-box1';
  box1.appendChild(cardEl);
  row1.appendChild(box1);

  // Caja 2 — campeón (borde dorado)
  const box2 = document.createElement('div');
  box2.className = 'final-box2';
  box2.style.cssText = `
    flex:1;border-radius:16px;
    background:linear-gradient(135deg,#0a1628 0%,#111d38 40%,#1c1200 100%);
    border:1.5px solid rgba(250,204,21,.35);
    padding:20px 24px;display:flex;align-items:center;gap:20px;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.04);
    position:relative;overflow:hidden;
  `.replace(/\s+/g,' ');

  if(champTeam || champName) {
    const badge  = champTeam ? getBadgeUrl(champTeam.slug) : null;
    const flag   = champTeam ? `${SB}/flags/${champTeam.flag}.png` : '';
    const imgSrc = badge || flag;
    box2.innerHTML = `
      <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 25% 50%,rgba(250,204,21,.06),transparent 65%);pointer-events:none"></div>
      <img src="${WORLD_CUP_LOGO}" style="width:56px;height:auto;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 2px 8px rgba(0,0,0,.5))" onerror="this.style.display='none'">
      <div style="width:1px;height:70px;background:linear-gradient(180deg,transparent,rgba(250,204,21,.3) 50%,transparent);flex-shrink:0"></div>
      ${imgSrc ? `<div style="position:relative;flex-shrink:0">
        <div style="position:absolute;inset:-8px;border-radius:50%;background:radial-gradient(circle,rgba(250,204,21,.1),transparent 70%);animation:goldPulse 2.5s ease-in-out infinite"></div>
        <img src="${imgSrc}" style="width:80px;height:80px;object-fit:contain;position:relative;z-index:1;filter:drop-shadow(0 4px 12px rgba(0,0,0,.6))" onerror="this.src='${flag}'">
      </div>` : ''}
      <div style="flex:1;min-width:0">
        <div style="font-size:8px;font-weight:800;color:rgba(250,204,21,.6);text-transform:uppercase;letter-spacing:.16em;margin-bottom:6px">🏆 Campeón del Mundo</div>
        <div style="font-family:'Inter Tight',sans-serif;font-size:26px;font-weight:900;color:#fef9c3;letter-spacing:-.02em;line-height:1;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${champName}</div>
        <div style="font-size:10px;color:rgba(250,204,21,.4);font-style:italic">FIFA World Cup 2026</div>
        <div style="font-size:10px;color:rgba(255,255,255,.25);margin-top:2px">19 jul · MetLife Stadium, Nueva York</div>
      </div>
    `;
  } else {
    box2.innerHTML = `
      <div style="text-align:center;width:100%;padding:8px 0">
        <img src="${WORLD_CUP_LOGO}" style="width:56px;height:auto;opacity:.35;margin-bottom:10px" onerror="this.style.display='none'">
        <div style="font-size:11px;color:#4b5563">Pronostica la final para ver el campeón</div>
      </div>`;
  }
  row1.appendChild(box2);
  outer.appendChild(row1);

  // ── FILA 2: [Caja4: Awards] [Caja3: Podio] ──────────────────
  const row2 = document.createElement('div');
  row2.style.cssText = 'display:flex;gap:16px;align-items:flex-start';
  row2.className = 'final-row2';

    // ─ Caja 4: Premios Individuales ─
  const box4 = document.createElement('div');
  box4.id = 'awards-box4';
  box4.style.cssText = 'flex:0 0 420px;border-radius:16px;overflow:hidden;background:#1c1c1e;border:1px solid #27272a;position:relative';
  box4.className = 'final-box4';

  function renderBox4() {
    const awFilled = Object.values(awPicks).filter(Boolean).length;
    const awPts    = Object.entries(awPicks).reduce((s,[k,v])=>s+(v?(window.AWARDS_CFG||AWARDS_CFG)[k].pts:0),0);
    const awSaved  = !!window._awPicksSaved;

    function awSlotHtml(key, cfg, bgSrc, bgAlt) {
      const sel = awPicks[key];
      const selName    = sel ? sel.name : '—';
      const selTeam    = sel ? (sel.teamName||'') : '—';
      const selFlagSrc = sel ? `${SB}/flags/${sel.flag}.png` : '';
      const selectedCls = sel ? ' selected' : '';
      const lockedStyle = awSaved ? 'cursor:default;pointer-events:none;' : '';
      return `<div class="aw-slot${selectedCls}" data-award="${key}" style="${lockedStyle}">
        <img class="aw-player-bg" src="${bgSrc}" alt="${bgAlt}"/>
        <div class="aw-top">
          <div class="aw-icon">${cfg.icon}</div>
          <div class="aw-name">${cfg.name}</div>
        </div>
        <div class="aw-bottom">
          <div class="aw-empty"${sel?' style="display:none"':''}>
            <div class="aw-empty-ring">👤</div>
            <div class="aw-empty-label">Seleccionar</div>
          </div>
          <div class="aw-selected-info"${sel?'':' style="display:none"'}>
            <div class="aw-sel-name" id="sel-name-${key}">${selName}</div>
            <div class="aw-sel-team">
              <div class="aw-sel-flag"><img id="sel-flag-${key}" src="${selFlagSrc}" alt=""/></div>
              <div class="aw-sel-teamname" id="sel-team-${key}">${selTeam}</div>
            </div>
            ${awSaved ? '' : '<div class="aw-sel-change">Cambiar →</div>'}
          </div>
        </div>
      </div>`;
    }

    const slots =
      awSlotHtml('golden_ball',  AWARDS_CFG.golden_ball,  `${SB}/miniatures/MVP/MVP-maradona-1986.png`, 'Maradona') +
      awSlotHtml('golden_boot',  AWARDS_CFG.golden_boot,  `${SB}/miniatures/Golden%20foot/Golden-Foot-Ronaldo.png`, 'Ronaldo') +
      awSlotHtml('golden_glove', AWARDS_CFG.golden_glove, `${SB}/miniatures/Golden%20glove/Casillas-removebg-preview.png`, 'Casillas') +
      awSlotHtml('young_player', AWARDS_CFG.young_player, 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/MVP%20Young/Mejor%20sub%2021.png', 'Mejor sub 21');

    // Botón guardar/guardado
    const btnHtml = awFilled === 4
      ? (awSaved
          ? `<div style="display:flex;align-items:center;gap:6px">
               <div style="background:#052e16;border:1px solid #166534;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;color:#4ade80;display:flex;align-items:center;gap:5px">✓ Guardado</div>
               <button id="aw-undo-btn" style="background:transparent;color:#6b7280;border:1px solid #3a3a3e;border-radius:8px;padding:6px 10px;font-size:11px;cursor:pointer;font-family:'Inter',sans-serif">↩ Deshacer</button>
             </div>`
          : `<button id="aw-save-btn" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">Guardar</button>`)
      : `<button disabled style="background:#1f2937;color:#4b5563;border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:not-allowed;font-family:'Inter',sans-serif">Guardar</button>`;

    box4.innerHTML = `
      <div class="aw-header">
        <div class="aw-title-group">
          <div class="aw-title">Premios Individuales</div>
          <div class="aw-subtitle">Copa Mundial 2026</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="aw-pts-possible${awPts>0?' show':''}" style="opacity:${awPts>0?1:0}">+${awPts} pts</div>
          <div class="aw-deadline"><div class="aw-deadline-dot"></div>Cierra antes de la final</div>
        </div>
      </div>
      <div class="aw-grid" id="aw-grid">${slots}</div>
      <div class="aw-footer">
        <div class="aw-progress">
          <div class="aw-prog-dots">
            <div class="aw-prog-dot${awFilled>0?' done':''}" id="aw-dot-0"></div>
            <div class="aw-prog-dot${awFilled>1?' done':''}" id="aw-dot-1"></div>
            <div class="aw-prog-dot${awFilled>2?' done':''}" id="aw-dot-2"></div>
            <div class="aw-prog-dot${awFilled>3?' done':''}" id="aw-dot-3"></div>
          </div>
          <div class="aw-prog-label" id="aw-prog-label">${awFilled}/4 premios</div>
        </div>
        ${btnHtml}
      </div>`;

    // Event listeners
    const grid = box4.querySelector('#aw-grid');
    if (grid && !awSaved) {
      grid.addEventListener('click', e => {
        const slot = e.target.closest('.aw-slot');
        if (slot && slot.dataset.award) openPicker(slot.dataset.award);
      });
    }
    const saveBtn = box4.querySelector('#aw-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      window._awPicksSaved = true;
      checkFinalizarReady();
      if(typeof saveAwPicks==='function') saveAwPicks();
      renderBox4();
    });
    const undoBtn = box4.querySelector('#aw-undo-btn');
    if (undoBtn) undoBtn.addEventListener('click', () => {
      // Borrar todas las selecciones
      Object.keys(awPicks).forEach(k => { awPicks[k] = null; });
      window._awPicksSaved = false;
      try { localStorage.removeItem('porra_aw_picks'); } catch(e) {}
      // Borrar en Supabase
      if (currentUser && window._porraDb) {
        window._porraDb.from('award_picks').delete().eq('user_id', currentUser.id).eq('league_id', getActiveLeagueId() || '')
          .then(({error}) => { if(error) console.warn('Error borrando award_picks:', error.message); });
      }
      renderBox4();
      updateAwardsFooter();
    });
  }

  // Exponer para re-render tras loadUserData
  window._renderBox4 = renderBox4;
  renderBox4();
  row2.appendChild(box4);

  // ─ Caja 3: Clasificación Final — Podio (derecha, debajo del campeón) ─
  const box3 = document.createElement('div');
  box3.style.cssText = `flex:0 0 auto;min-width:260px;${boxBase}`;
  box3.className = 'final-box3';

  const podioItems = [
    { medal:'🥈', label:'2.º Clasificado', name: pos2, size: 48 },
    { medal:'🥉', label:'3.er Clasificado', name: pos3, size: 40 },
    { medal:'4️⃣',  label:'4.º Clasificado', name: pos4, size: 34 },
  ];

  box3.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px">Clasificación Final</div>
    ${podioItems.map((item, i) => `
      <div style="display:flex;align-items:center;gap:14px;padding:${i===0?'12px 0':'10px 0'};${i<2?'border-bottom:1px solid #27272a;':''}">
        <div style="font-size:${[42,34,28][i]}px;line-height:1;flex-shrink:0;width:42px;text-align:center">${item.medal}</div>
        <div style="flex-shrink:0">${teamImg(item.name, item.size)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-family:'Inter Tight',sans-serif;font-size:${[18,15,13][i]}px;font-weight:${[900,700,600][i]};color:${['#fff','#d1d5db','#9ca3af'][i]};line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.name || '—'}</div>
          <div style="font-size:10px;color:#6b7280;margin-top:3px">${item.label}</div>
        </div>
      </div>`).join('')}
  `;
  row2.appendChild(box3);
  outer.appendChild(row2);

  return outer;
}


function buildBracketView() {
  const inner=document.getElementById('bracket-inner');
  inner.innerHTML='';

  const rounds=[
    {label:'16avos (1-8)',   matches:BRACKET.r32.slice(0,8)},
    {label:'Octavos (A)',    matches:BRACKET.r16.slice(0,4)},
    {label:'Cuartos (A)',    matches:BRACKET.qf.slice(0,2)},
    {label:'Semis + Final',  matches:[...BRACKET.sf,{id:104,home:'W101',away:'W102',venue:'Nueva York',date:'2026-07-19'}]},
    {label:'Cuartos (B)',    matches:BRACKET.qf.slice(2,4)},
    {label:'Octavos (B)',    matches:BRACKET.r16.slice(4,8)},
    {label:'16avos (9-16)',  matches:BRACKET.r32.slice(8,16)},
  ];

  rounds.forEach((round,ri)=>{
    const col=document.createElement('div');
    col.className='br-col';
    col.innerHTML=`<div class="br-col-hd${round.label.includes('Final')?' final-hd':''}">${round.label}</div>`;

    const isCenter=ri===3;
    round.matches.forEach(m=>{
      const isFinal=m.id===104;
      const hTeam=getTeamForSlot(m.home);
      const aTeam=getTeamForSlot(m.away);
      const isLocked=!hTeam||!aTeam;
      const pred=koPredictions[m.id]||{};

      const card=document.createElement('div');
      card.className='br-card'+(isLocked?' br-locked':'')+(pred.saved?' br-saved':'')+(isFinal?' br-final-c':'');
      if(!isLocked) card.onclick=()=>openModal(m);

      const hKit=hTeam?`${SB}/kits/${hTeam.slug}/home.jpg`:'';
      const aKit=aTeam?`${SB}/kits/${aTeam.slug}/away.jpg`:'';
      const hFlag=hTeam?`${SB}/flags/${hTeam.flag}.png`:'';
      const aFlag=aTeam?`${SB}/flags/${aTeam.flag}.png`:'';
      const hName=resolvedSlots[m.home]||(isFinal?'?':resolveSlot(m.home));
      const aName=resolvedSlots[m.away]||(isFinal?'?':resolveSlot(m.away));

      if(isFinal) {
        card.innerHTML=`
          <div class="br-hero" style="background:#120d00;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px">
            <div style="font-size:26px">🏆</div>
            <div style="font-size:7px;color:${'\x23'}fcd34d;font-weight:700">GRAN FINAL</div>
          </div>
          <div class="br-footer"><span class="br-date">19 jul · NY</span><span class="br-st gold">Final</span></div>`;
      } else {
        card.innerHTML=`
          <div class="br-hero">
            ${hTeam?`<div class="br-h L"><div class="br-col-bg" style="background:#fff"></div><div class="br-kit-bg" style="background-image:linear-gradient(to bottom, rgba(10,10,20,0.5) 0%, transparent 35%),linear-gradient(to bottom, transparent 60%, rgba(10,10,20,0.6) 100%),url('${hKit}')"></div><div class="br-vL"></div></div>`:''}
            ${aTeam?`<div class="br-h R"><div class="br-col-bg" style="background:#fff"></div><div class="br-kit-bg" style="background-image:linear-gradient(to bottom, rgba(10,10,20,0.5) 0%, transparent 35%),linear-gradient(to bottom, transparent 60%, rgba(10,10,20,0.6) 100%),url('${aKit}')"></div><div class="br-vR"></div></div>`:''}
            <div class="br-fade"></div>
            <div class="br-vs">VS</div>
            <div class="br-team L">
              ${hTeam?`<div class="br-flag"><img src="${hFlag}" alt=""/></div>`:''}
              <span class="br-name${!hTeam?' tbd':''}">${hName.substring(0,10)}</span>
            </div>
            <div class="br-team R">
              ${aTeam?`<div class="br-flag"><img src="${aFlag}" alt=""/></div>`:''}
              <span class="br-name${!aTeam?' tbd':''}">${aName.substring(0,10)}</span>
            </div>
          </div>
          <div class="br-footer">
            <span class="br-date">${new Date(m.date).toLocaleDateString('es',{day:'numeric',month:'short'})}</span>
            <span class="br-st ${isLocked?'locked':pred.saved?'open':'locked'}">${isLocked?'🔒':pred.saved?'✓':'Abrir'}</span>
          </div>`;
      }
      col.appendChild(card);

      // Spacer for center alignment
      if(isCenter && m.id===101) {
        const sp=document.createElement('div');
        sp.style.height='24px';
        col.appendChild(sp);
      }
    });
    inner.appendChild(col);
  });

  // Enable horizontal drag scroll
  enableDragScroll(document.getElementById('bracket-wrap'));
}


function enableDragScroll(el) {
  let isDown=false, startX, scrollLeft;
  el.addEventListener('mousedown',e=>{isDown=true;startX=e.pageX-el.offsetLeft;scrollLeft=el.scrollLeft});
  el.addEventListener('mouseleave',()=>isDown=false);
  el.addEventListener('mouseup',()=>isDown=false);
  el.addEventListener('mousemove',e=>{if(!isDown)return;e.preventDefault();const x=e.pageX-el.offsetLeft;el.scrollLeft=scrollLeft-(x-startX)*1.5});
}


function buildStadiumView() {
  const layout=document.getElementById('stadium-layout');
  layout.innerHTML='';

  // Left column: Bracket path A (matches 73-76, 89-90, 97, 101)
  const left=document.createElement('div');
  left.innerHTML=buildStadiumPath('A', [73,74,75,76], [89,90], [97], [101]);
  layout.appendChild(left);

  // Center: trophy + final + semis
  const center=document.createElement('div');
  center.style.cssText='display:flex;flex-direction:column;align-items:center;gap:14px;padding:20px 0';

  const trophy=document.createElement('div');
  trophy.innerHTML=`
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
      <div class="st-trophy-big">🏆</div>
      <div style="font-family:'Inter Tight',sans-serif;font-size:14px;font-weight:900;color:var(--gold);text-align:center">Gran Final</div>
      <div style="font-size:10px;color:var(--text-3);text-align:center">19 jul · Nueva York</div>
    </div>`;
  center.appendChild(trophy);

  // Final card
  const finalMatch=BRACKET.final[0];
  const fCard=buildStadiumCompactCard(finalMatch,'gold','🏆');
  center.appendChild(fCard);

  // Semis
  const sfLabel=document.createElement('div');
  sfLabel.innerHTML='<div style="font-size:8px;font-weight:700;color:var(--purple);text-transform:uppercase;letter-spacing:.1em;text-align:center;margin-top:8px">Semifinales</div>';
  center.appendChild(sfLabel);
  BRACKET.sf.forEach(m=>center.appendChild(buildStadiumCompactCard(m,'sf','🔮')));

  // 3rd place
  const thirdLabel=document.createElement('div');
  thirdLabel.innerHTML='<div style="font-size:8px;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:.1em;text-align:center;margin-top:4px">3er Puesto</div>';
  center.appendChild(thirdLabel);
  center.appendChild(buildStadiumCompactCard(BRACKET.third[0],'amber','🥉'));

  layout.appendChild(center);

  // Right column: Bracket path B
  const right=document.createElement('div');
  right.innerHTML=buildStadiumPath('B', [77,78,79,80,81,82,83,84,85,86,87,88].slice(0,4), [91,92,93,94,95,96].slice(0,2), [98], [102]);
  layout.appendChild(right);
}


function buildStadiumPath(label, r32ids, r16ids, qfids, sfids) {
  let html=`<div style="font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;text-align:${label==='B'?'right':'left'}">Cuadro ${label}</div>`;

  const addSection=(title,color,ids)=>{
    html+=`<div class="st-section-label" style="color:${color}">${title}</div>`;
    ids.forEach(id=>{
      const m=findMatch(id);
      if(!m) return;
      const hTeam=getTeamForSlot(m.home),aTeam=getTeamForSlot(m.away);
      const hName=resolvedSlots[m.home]||(m.home.startsWith('W')?'G.P'+m.home.slice(1):resolveSlot(m.home));
      const aName=resolvedSlots[m.away]||(m.away.startsWith('W')?'G.P'+m.away.slice(1):resolveSlot(m.away));
      const isLocked=!hTeam||!aTeam;
      const pred=koPredictions[id]||{};
      const rTag=id<89?'r32':id<97?'r16':id<101?'qf':'sf';
      html+=`<div class="st-card${isLocked?' st-locked':''}${pred.saved?' st-saved':''}" onclick="${isLocked?'':'openModal(findMatch('+id+'))'}">
        ${hTeam?`<div class="st-flag"><img src="${SB}/flags/${hTeam.flag}.png" alt=""/></div>`:'<div class="st-flag" style="background:#333;display:flex;align-items:center;justify-content:center;font-size:8px;color:#555">?</div>'}
        <span class="st-name${!hTeam?' tbd':''}">${hName.substring(0,10)}</span>
        <span class="st-vs">vs</span>
        ${aTeam?`<div class="st-flag"><img src="${SB}/flags/${aTeam.flag}.png" alt=""/></div>`:'<div class="st-flag" style="background:#333;display:flex;align-items:center;justify-content:center;font-size:8px;color:#555">?</div>'}
        <span class="st-name${!aTeam?' tbd':''}">${aName.substring(0,10)}</span>
        <span class="st-tag ${rTag}">${rTag.toUpperCase()}</span>
      </div>`;
    });
  };

  addSection('16avos','var(--text-3)',r32ids);
  addSection('Octavos','var(--green)',r16ids);
  addSection('Cuartos','var(--blue)',qfids);

  return html;
}


function buildStadiumCompactCard(match, style, icon) {
  const hTeam=getTeamForSlot(match.home);
  const aTeam=getTeamForSlot(match.away);
  const hName=resolvedSlots[match.home]||'?';
  const aName=resolvedSlots[match.away]||'?';
  const isLocked=!hTeam||!aTeam;
  const pred=koPredictions[match.id] || koPredictions[String(match.id)] || {};

  const colors={gold:'rgba(250,204,21,.2)',sf:'rgba(124,58,237,.15)',amber:'rgba(251,146,60,.15)'};
  const borders={gold:'rgba(250,204,21,.3)',sf:'rgba(124,58,237,.3)',amber:'rgba(251,146,60,.3)'};

  const card=document.createElement('div');
  card.style.cssText=`background:${colors[style]||'var(--card)'};border:1.5px solid ${borders[style]||'var(--border)'};border-radius:12px;padding:10px 12px;display:flex;align-items:center;gap:8px;cursor:pointer;width:100%;transition:all .15s;${isLocked?'opacity:.5;cursor:default':''}`;
  if(!isLocked) card.onclick=()=>openModal(match);

  card.innerHTML=`
    <span style="font-size:14px">${icon}</span>
    ${hTeam?`<div class="st-flag"><img src="${SB}/flags/${hTeam.flag}.png" alt=""/></div>`:'<div class="st-flag" style="background:#333"></div>'}
    <span class="st-name${!hTeam?' tbd':''}" style="font-size:11px">${hName.substring(0,10)}</span>
    <span class="st-vs">vs</span>
    ${aTeam?`<div class="st-flag"><img src="${SB}/flags/${aTeam.flag}.png" alt=""/></div>`:'<div class="st-flag" style="background:#333"></div>'}
    <span class="st-name${!aTeam?' tbd':''}" style="font-size:11px">${aName.substring(0,10)}</span>
    ${pred.saved?'<span style="margin-left:auto;font-size:9px;color:var(--green)">✓</span>':''}
  `;
  return card;
}




/*
     js-ui-nav — Navegacion SPA, renderBox4, init, welcome
     Archivo destino : ui-nav.js
     -----------------------------------------------------------
     Usa             : PARTIDOS, BRACKET, currentUser, predictions, awPicks
     Expone          : showPage, renderBox4, updateAwardsFooter, initApp
     Deps            : js-data, js-auth, js-ligas, js-ko, js-ui-groups
     Notas           : Punto de entrada de la app. Inicializacion y navegacion.
================================================================ */
/* ══ IA para partidos KO ══ */
function showIAresultInModal(matchId) {
  const ia = iaKoPredictions[matchId];
  if(!ia) return;
  const loading = document.getElementById('modal-ia-loading');
  const result  = document.getElementById('modal-ia-result');
  const predEl  = document.getElementById('modal-ia-pred');
  const quipEl  = document.getElementById('modal-ia-quip');
  if(!loading || !result) return;
  const signMap = {'1':'Local','X':'Empate','2':'Visitante'};
  if(predEl) predEl.textContent = ia.sign+' · '+(signMap[ia.sign]||ia.sign)+' ('+ia.confidence+'%)';
  if(quipEl) quipEl.textContent = ia.quip || '';
  loading.style.display = 'none';
  result.style.display  = 'block';
}

function fetchIAforKO(matchId, match, hName, aName, onDone) {
  const prompt = hName+' vs '+aName+
    ', partido eliminatorio '+match.id+', Mundial 2026 ('+match.venue+').'+
    ' Busca estadísticas y forma reciente. Responde SOLO JSON sin markdown:'+
    '{"sign":"1","confidence":72,"quip":"frase corta, graciosa o vacilona (máx 12 palabras)"}'+
    ' sign: 1=local, X=empate, 2=visitante.';

  const fallbacks = [
    {sign:'1',confidence:75,quip:'El local tiene hambre de semifinal.'},
    {sign:'2',confidence:70,quip:'El visitante viene a romper pronósticos.'},
    {sign:'X',confidence:63,quip:'Empate técnico. Los dos tienen miedo.'},
    {sign:'1',confidence:80,quip:'Favorito claro. La IA no tiene drama.'},
    {sign:'2',confidence:68,quip:'Sorpresón estadístico. O fallo estadístico.'},
  ];
  const fb = fallbacks[matchId % fallbacks.length];

  fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{'content-type':'application/json'},
    body: JSON.stringify({
      model:'claude-sonnet-4-20250514',
      max_tokens:200,
      tools:[{type:'web_search_20250305',name:'web_search'}],
      system:'Eres analista deportivo con humor. Usa web_search antes de predecir. Responde SOLO JSON puro.',
      messages:[{role:'user',content:prompt}]
    })
  })
  .then(r=>r.json())
  .then(data=>{
    const text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    if(!text) throw new Error('no text');
    return JSON.parse(text.replace(/```json|```/g,'').trim());
  })
  .catch(()=> fb)
  .then(pred=>{
    iaKoPredictions[matchId] = {sign:pred.sign, confidence:pred.confidence, quip:pred.quip};
    showIAresultInModal(matchId);
    if(onDone) onDone(); // actualizar chip IA en updateModalUI
  });
}
// undoKO: deshace el pronóstico de UN partido KO específico
// Se llama desde el botón dentro del modal — solo afecta al matchId indicado
  // ─────────────────────────────────────────────────────────────
  // KO — MODAL: openModal, closeModal, undoKO, setView,
  //   refreshAllViews, koInit, fetchIAforKO
  // ─────────────────────────────────────────────────────────────
window.undoKO = function(id) {
  if (window._porraCerrada) return; // porra cerrada — no se puede deshacer
  // Resetear solo los datos, NO cerrar el modal
  koPredictions[id] = {l:null, v:null, gol:null, saved:false, classifier:null};
  saveKO();
  // Reabrir el modal con el mismo partido para refrescar el formulario
  const match = findMatch(id);
  if(match) openModal(match);
  refreshAllViews();
};

// IA predictions para partidos KO — separado de iaPredictions de grupos
const iaKoPredictions = {};
// AbortController para limpiar listeners del modal al cerrar/reabrir
let _modalAbort = null;

function openModal(match) {
  // Si la porra está cerrada, no permitir edición en el modal
  if (window._porraCerrada) {
    // Abrir solo en modo lectura — el modal mostrará el estado guardado
    // pero los botones de guardar estarán deshabilitados por p.saved=true
  }
  if(!match) return;
  const hTeam = getTeamForSlot(match.home);
  const aTeam = getTeamForSlot(match.away);
  if(!hTeam || !aTeam) return;

  // Cancelar listeners del modal anterior
  if(_modalAbort) _modalAbort.abort();
  _modalAbort = new AbortController();
  const sig = _modalAbort.signal;

  const hName = resolvedSlots[match.home];
  const aName = resolvedSlots[match.away];
  const pred  = koPredictions[match.id] || {l:null,v:null,gol:null,saved:false};
  if(!koPredictions[match.id]) koPredictions[match.id] = pred;

  // Usar kitUrl global (con overrides)
  const hKit  = kitUrl(hTeam.slug, 'home');
  const aKit  = kitUrl(aTeam.slug, 'away');
  const hFlag = `${SB}/flags/${hTeam.flag}.png`;
  const aFlag = `${SB}/flags/${aTeam.flag}.png`;
  const BALL  = `${SB}/miniatures/Ball/Trionda-official-ball.png`;

  const lVal = pred.l !== null ? pred.l : '—';
  const vVal = pred.v !== null ? pred.v : '—';

  // Jugadores para el goleador
  const hOpts = (hTeam.players||[]).map(p=>`<option value="${p.key}"${pred.gol===p.key?' selected':''}>${p.name}</option>`).join('');
  const aOpts = (aTeam.players||[]).map(p=>`<option value="${p.key}"${pred.gol===p.key?' selected':''}>${p.name}</option>`).join('');

  const content = document.getElementById('modal-content');
  content.innerHTML = `
    <div style="position:relative">
      <!-- Hero -->
      <div style="height:190px;position:relative;overflow:hidden;background:#000;border-radius:22px 22px 0 0">
        <div style="position:absolute;left:0;top:0;bottom:0;width:50%;overflow:hidden">
          <div style="position:absolute;inset:0;background:#fff;z-index:0"></div>
          <div style="position:absolute;inset:0;z-index:1;background-image:url('${hKit}');background-size:220%;background-position:center 8%;mix-blend-mode:multiply;filter:brightness(1.45) contrast(1.05) saturate(1.1)"></div>
          <div style="position:absolute;inset:0;z-index:3;background:linear-gradient(90deg,rgba(0,0,0,.65),transparent 50%);pointer-events:none"></div>
        </div>
        <div style="position:absolute;right:0;top:0;bottom:0;width:50%;overflow:hidden">
          <div style="position:absolute;inset:0;background:#fff;z-index:0"></div>
          <div style="position:absolute;inset:0;z-index:1;background-image:url('${aKit}');background-size:220%;background-position:center 8%;mix-blend-mode:multiply;filter:brightness(1.45) contrast(1.05) saturate(1.1)"></div>
          <div style="position:absolute;inset:0;z-index:3;background:linear-gradient(270deg,rgba(0,0,0,.65),transparent 50%);pointer-events:none"></div>
        </div>
        <div style="position:absolute;bottom:0;left:0;right:0;height:60px;z-index:4;background:linear-gradient(0deg,#1c1c1e,transparent)"></div>
        <div style="position:absolute;left:50%;top:0;bottom:0;width:1.5px;transform:translateX(-50%);background:linear-gradient(180deg,transparent,rgba(255,255,255,.9) 50%,transparent);z-index:5;pointer-events:none"></div>
        <!-- Equipos -->
        <div style="position:absolute;left:12px;bottom:14px;z-index:6;display:flex;flex-direction:column;gap:4px">
          <div style="width:42px;height:42px;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,.7);background:#111;box-shadow:0 3px 12px rgba(0,0,0,.8)"><img src="${hFlag}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"/></div>
          <div style="font-family:'Inter Tight',sans-serif;font-size:12px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:.06em;text-shadow:0 2px 8px rgba(0,0,0,1)">${hName}</div>
          <div style="font-size:7px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.1em">local</div>
        </div>
        <div style="position:absolute;right:12px;bottom:14px;z-index:6;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <div style="width:42px;height:42px;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,.7);background:#111;box-shadow:0 3px 12px rgba(0,0,0,.8)"><img src="${aFlag}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"/></div>
          <div style="font-family:'Inter Tight',sans-serif;font-size:12px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:.06em;text-shadow:0 2px 8px rgba(0,0,0,1)">${aName}</div>
          <div style="font-size:7px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.1em">visitante</div>
        </div>
        <!-- VS + pill -->
        <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:7;display:flex;flex-direction:column;align-items:center;gap:5px">
          <div style="width:40px;height:40px;border-radius:50%;background:rgba(6,6,8,.9);border:1.5px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative">
            <div style="position:absolute;inset:0;background-image:url('${BALL}');background-size:130%;opacity:.55;animation:ballSpin 12s linear infinite"></div>
            <span style="position:relative;z-index:1;font-family:'Inter Tight',sans-serif;font-size:9px;font-weight:900;color:#fff">VS</span>
          </div>
          <div style="background:rgba(0,0,0,.82);border:1px solid rgba(255,255,255,.13);border-radius:10px;padding:2px 7px;font-size:8px;font-weight:700;color:rgba(255,255,255,.75)">${match.venue}</div>
        </div>
      </div>

      <!-- Panel pronóstico -->
      <div style="padding:14px 16px 10px;background:#1c1c1e">
        <!-- Steppers -->
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:8px">
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
            <button class="modal-step" data-side="l" data-inc="1">▲</button>
            <div class="modal-sbox${pred.l!==null?' on':''}" id="modal-sl">${lVal}</div>
            <button class="modal-step" data-side="l" data-inc="-1">▼</button>
          </div>
          <div style="font-family:'Inter Tight',sans-serif;font-size:22px;font-weight:300;color:#4b5563;margin-bottom:12px">:</div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
            <button class="modal-step" data-side="v" data-inc="1">▲</button>
            <div class="modal-sbox${pred.v!==null?' on':''}" id="modal-sv">${vVal}</div>
            <button class="modal-step" data-side="v" data-inc="-1">▼</button>
          </div>
        </div>
        <!-- Chips -->
        <div style="display:flex;justify-content:center;gap:5px;min-height:22px;margin-bottom:10px;flex-wrap:wrap">
          <div class="ptc sign"   id="modal-ptc-s">🔵 +1 signo</div>
          <div class="ptc exact"  id="modal-ptc-e">🎯 +3 exacto</div>
          <div class="ptc scorer" id="modal-ptc-g">⚽ +2 goleador</div>
          <div class="ptc ia"     id="modal-ptc-i">🤖 +1 vs IA</div>
        </div>
        <!-- Goleador -->
        <div style="display:flex;align-items:center;gap:8px;padding-top:8px;border-top:1px solid #27272a">
          <span style="font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;flex-shrink:0">Goleador</span>
          <div style="flex:1;position:relative">
            <select id="modal-gsel" style="width:100%;background:#2a2a2e;border:1.5px solid #3a3a3e;border-radius:20px;padding:7px 28px 7px 12px;font-family:'Inter',sans-serif;font-size:11px;color:#9ca3af;cursor:pointer;appearance:none;outline:none;transition:all .2s">
              <option value="" ${!pred.gol?'selected':''} disabled>Seleccionar jugador...</option>
              <optgroup label="${hName}">${hOpts}</optgroup>
              <optgroup label="${aName}">${aOpts}</optgroup>
            </select>
            <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:8px;color:#6b7280;pointer-events:none">▼</span>
          </div>
          <span id="modal-gbadge" style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:#27272a;color:#6b7280;white-space:nowrap;flex-shrink:0">+2 pts</span>
        </div>
      </div>

      <!-- Clasificado en empate (oculto por defecto, JS lo muestra si marcador es X) -->
      <div id="modal-pen-row" style="display:none;align-items:center;gap:8px;padding:8px 16px;border-top:1px solid #27272a;background:#1c1c1e">
        <span style="font-size:9px;font-weight:700;color:#fb923c;text-transform:uppercase;letter-spacing:.06em;flex-shrink:0">⚽ Clasifica</span>
        <select id="modal-pen-sel" style="flex:1;background:#2a2a2e;border:1.5px solid #d97706;border-radius:20px;padding:6px 12px;font-family:'Inter',sans-serif;font-size:11px;color:#fcd34d;cursor:pointer;appearance:none;outline:none">
          <option value="">¿Quién se clasifica?</option>
          <option value="${hName}">${hName}</option>
          <option value="${aName}">${aName}</option>
        </select>
      </div>
      <!-- IA Predice -->
      <div style="background:#111318;border-top:1px solid #27272a;padding:8px 14px;display:flex;align-items:center;gap:8px;min-height:36px">
        <div style="font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;display:flex;align-items:center;gap:4px">
          <span style="width:5px;height:5px;border-radius:50%;background:#7c3aed;box-shadow:0 0 5px rgba(124,58,237,.6);display:inline-block;animation:iaPulse 2s ease-in-out infinite"></span>
          IA predice
        </div>
        <div style="flex:1;font-size:11px;color:#9ca3af" id="modal-ia-content">
          <div id="modal-ia-loading" style="display:flex;align-items:center;gap:4px">
            <div style="width:4px;height:4px;border-radius:50%;background:#7c3aed;animation:iaDot 1.2s ease-in-out infinite"></div>
            <div style="width:4px;height:4px;border-radius:50%;background:#7c3aed;animation:iaDot 1.2s ease-in-out .2s infinite"></div>
            <div style="width:4px;height:4px;border-radius:50%;background:#7c3aed;animation:iaDot 1.2s ease-in-out .4s infinite"></div>
            <span style="font-size:10px;color:#6b7280;font-style:italic">consultando oráculos...</span>
          </div>
          <div id="modal-ia-result" style="display:none">
            <span style="font-weight:700;color:#c4b5fd" id="modal-ia-pred"></span>
            <span style="font-size:10px;color:#8b949e;font-style:italic" id="modal-ia-quip"></span>
          </div>
        </div>
      </div>
      <!-- Footer -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px 14px;background:#1c1c1e;border-top:1px solid #27272a;border-radius:0 0 22px 22px">
        <div>
          <span style="font-family:'Inter Tight',sans-serif;font-size:20px;font-weight:900;color:#374151;transition:color .2s" id="modal-pnum">0</span>
          <span style="font-size:10px;color:#6b7280" id="modal-ptl"> pts posibles</span>
        </div>
        <div id="modal-btn-row">
          <button id="modal-save-btn" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-family:'Inter',sans-serif;font-size:12px;font-weight:600;cursor:pointer;opacity:.5;transition:all .15s" disabled>Guardar</button>
        </div>
      </div>
    </div>
  `;

  // CSS del modal (solo una vez)
  if(!document.getElementById('modal-style')) {
    const s = document.createElement('style');
    s.id = 'modal-style';
    s.textContent = `
      .modal-step{width:40px;height:28px;background:#2a2a2e;border:1px solid #3a3a3e;border-radius:7px;cursor:pointer;font-size:13px;font-weight:bold;color:#6b7280;display:flex;align-items:center;justify-content:center;transition:all .1s}
      .modal-step:active{background:#16a34a;color:#fff;transform:scale(.94)}
      .modal-sbox{width:52px;height:56px;border:2px solid #3a3a3e;border-radius:11px;background:#2a2a2e;display:flex;align-items:center;justify-content:center;font-family:'Inter Tight',sans-serif;font-size:28px;font-weight:900;color:#4b5563;transition:all .15s}
      .modal-sbox.on{border-color:#166534;background:#052e16;color:#f0fdf4}
      .modal-sbox.frozen{border-color:#27272a;background:#1a1a1e;color:#6b7280;pointer-events:none}
      @keyframes bump2{0%{transform:scale(1)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
      .modal-sbox.bump{animation:bump2 .22s cubic-bezier(.34,1.8,.64,1)}
      .ptc{font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;border:1px solid transparent;white-space:nowrap;opacity:0;transform:translateY(4px) scale(.85);transition:opacity .25s,transform .25s cubic-bezier(.34,1.5,.64,1);pointer-events:none}
      .ptc.show{opacity:1;transform:translateY(0) scale(1)}
      .ptc.sign{background:#1e3a5f;border-color:#1d4ed8;color:#93c5fd}
      .ptc.exact{background:#052e16;border-color:#166534;color:#4ade80}
      .ptc.scorer{background:#1c1003;border-color:#d97706;color:#fcd34d}
      .ptc.potential{opacity:.6;filter:brightness(.85)}
      .ptc.ia{background:#1e1b4b;border-color:#7c3aed;color:#c4b5fd}
      @keyframes ballSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @keyframes iaPulse{0%,100%{opacity:1}50%{opacity:.3}}
      @keyframes iaDot{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
    `;
    document.head.appendChild(s);
  }

  // ── EVENTOS ──────────────────────────────────────────────────
  const matchId = match.id;

  function updateModalUI() {
    const p      = koPredictions[matchId];
    const hS     = p.l !== null && p.v !== null;
    const hasG   = !!p.gol;
    const isDraw = hS && (p.l === p.v);  // ← definido aquí, dentro de la función

    // Marcadores
    const slEl = document.getElementById('modal-sl');
    const svEl = document.getElementById('modal-sv');
    if(slEl) { slEl.textContent = p.l !== null ? p.l : '—'; slEl.className = 'modal-sbox' + (p.l!==null ? (p.saved?' frozen':' on') : ''); }
    if(svEl) { svEl.textContent = p.v !== null ? p.v : '—'; svEl.className = 'modal-sbox' + (p.v!==null ? (p.saved?' frozen':' on') : ''); }

    // Chips acumulativos: signo+exacto+goleador+IA = 7 máx
    const iaKo  = iaKoPredictions[matchId];
    const mySign = hS ? (p.l > p.v ? '1' : p.l < p.v ? '2' : 'X') : null;
    const showIA = hS && iaKo && mySign && mySign !== iaKo.sign;
    const cs = document.getElementById('modal-ptc-s');
    const ce = document.getElementById('modal-ptc-e');
    const cg = document.getElementById('modal-ptc-g');
    const ci = document.getElementById('modal-ptc-i');
    if(hS) {
      if(cs){ cs.classList.add('show'); cs.classList.remove('potential'); }
      if(ce){ ce.classList.add('show'); ce.classList.remove('potential'); }
    } else {
      if(cs) cs.classList.remove('show','potential');
      if(ce) ce.classList.remove('show','potential');
    }
    if(cg){ hasG ? (cg.classList.add('show'),cg.classList.remove('potential')) : cg.classList.remove('show','potential'); }
    if(ci){ showIA ? (ci.classList.add('show'),ci.classList.remove('potential')) : ci.classList.remove('show','potential'); }

    // Penaltis: mostrar solo si hay empate y no está guardado aún
    const penRow = document.getElementById('modal-pen-row');
    if(penRow) {
      penRow.style.display = isDraw ? 'flex' : 'none';
      // Restaurar valor seleccionado si existe
      const penSel = document.getElementById('modal-pen-sel');
      if(penSel && p.classifier) penSel.value = p.classifier;
    }

    // Pts totales
    let pts = 0;
    if(hS) { pts = 1 + 3; if(hasG) pts += 2; if(showIA) pts += 1; }
    const pnum = document.getElementById('modal-pnum');
    const ptl  = document.getElementById('modal-ptl');
    if(pnum) { pnum.textContent = pts; pnum.style.color = pts > 0 ? '#4ade80' : '#374151'; }
    if(ptl)  ptl.textContent = pts ? ' pts máx posibles' : ' pts posibles';

    // Goleador badge
    const gbadge = document.getElementById('modal-gbadge');
    if(gbadge) {
      if(hasG) { gbadge.style.background='#1c1003'; gbadge.style.color='#fcd34d'; gbadge.style.border='1px solid #d97706'; }
      else      { gbadge.style.background='#27272a'; gbadge.style.color='#6b7280'; gbadge.style.border='none'; }
    }

    // Botón guardar / guardado — reconstruir btnRow siempre para evitar estado stale
    const btnRow2 = document.getElementById('modal-btn-row');
    if(!btnRow2) return;
    if(p.saved) {
      // Estado guardado: mostrar badge + deshacer
      btnRow2.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <div style="background:#052e16;border:1px solid #166534;border-radius:8px;padding:6px 11px;font-size:11px;font-weight:600;color:#4ade80">✓ Guardado</div>
          ${!window._porraCerrada ? `<button onclick="window.undoKO(${matchId})" style="background:transparent;border:1px solid #3a3a3e;border-radius:8px;padding:6px 9px;font-size:10px;color:#6b7280;cursor:pointer;font-family:'Inter',sans-serif">↩ Deshacer</button>` : ''}
          <button onclick="closeModalBtn()" style="background:transparent;border:1px solid #3a3a3e;border-radius:8px;padding:6px 11px;font-size:10px;color:#9ca3af;cursor:pointer;font-family:'Inter',sans-serif;display:flex;align-items:center;gap:3px">← Volver</button>
        </div>`;
    } else {
      // Estado editable: mostrar botón guardar
      // Reglas de habilitación del botón Guardar:
      // 1. Marcador obligatorio siempre
      // 2. Goleador obligatorio EXCEPTO en 0:0 (donde no tiene sentido)
      // 3. Classifier obligatorio si hay empate
      const isZeroZero = hS && p.l === 0 && p.v === 0;
      const golOk = hasG || isZeroZero; // goleador opcional solo en 0:0
      const canSave = hS && golOk && (!isDraw || p.classifier);
      // Hint sobre qué falta
      let hint = '';
      if(!hS)              hint = 'Guardar';
      else if(!golOk)      hint = 'Selecciona un goleador';
      else if(isDraw && !p.classifier) hint = 'Indica quién se clasifica';
      // hint especial 0:0
      const isZZ = hS && p.l===0 && p.v===0;
      if(isZZ && !hasG) hint = ''; // 0:0 → goleador opcional, no mostrar aviso

      btnRow2.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;width:100%">
          ${hint ? `<div style="font-size:10px;color:#d97706;text-align:center">⚠️ ${hint}</div>` : ''}
          <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
            <button onclick="window._diceKOAndRefresh(${matchId})" style="display:inline-flex;align-items:center;gap:4px;background:rgba(30,27,75,.7);border:1px solid rgba(99,82,199,.35);border-radius:6px;padding:6px 10px;font-size:11px;font-weight:600;color:#a5b4fc;cursor:pointer" title="Simular al azar">🎲</button>
            <button onclick="closeModalBtn()" style="background:transparent;border:1px solid #3a3a3e;border-radius:8px;padding:8px 14px;font-family:'Inter',sans-serif;font-size:12px;color:#9ca3af;cursor:pointer">← Volver</button>
            <button id="modal-save-btn" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-family:'Inter',sans-serif;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;opacity:${canSave?'1':'.5'}" ${canSave?'':'disabled'}>Guardar</button>
          </div>
        </div>`;
      const newSaveBtn = document.getElementById('modal-save-btn');
      if(newSaveBtn) newSaveBtn.addEventListener('click', () => {
        const pp = koPredictions[matchId];
        if(pp.l !== null && pp.v !== null && pp.l === pp.v && !pp.classifier) {
          const ps = document.getElementById('modal-pen-sel');
          if(ps) ps.style.borderColor = '#ef4444';
          return;
        }
        // Marcar como saved optimisticamente para la UI
        pp.saved = true;
        updateModalUI();
        refreshAllViews();
        // Guardar en Supabase (async) — si falla, revertir
        saveKO().then(() => {
          // checkFinalizarReady ya se llama dentro de saveKO
        });
      });
    }
  }

  // Steppers
  content.querySelectorAll('.modal-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = koPredictions[matchId];
      if(p.saved) return;
      const side = btn.dataset.side;
      const inc  = parseInt(btn.dataset.inc);
      if(p[side] === null) p[side] = 0;
      else p[side] = Math.max(0, Math.min(9, p[side] + inc));
      const el = document.getElementById('modal-s' + side);
      if(el) { el.classList.add('bump'); setTimeout(()=>el.classList.remove('bump'), 220); }
      updateModalUI();
    }, { signal: sig });
  });

  // Goleador
  const gselEl = document.getElementById('modal-gsel');
  if(gselEl) gselEl.addEventListener('change', e => {
    koPredictions[matchId].gol = e.target.value || null;
    updateModalUI();
  }, { signal: sig });

  // Penaltis — guardar selección en koPredictions y actualizar UI
  // El elemento se crea dinámicamente por updateModalUI cuando hay empate
  // Usamos event delegation en el modal-content para capturarlo
  const modalContent = document.getElementById('modal-content');
  if(modalContent) {
    // Signal de AbortController: se cancela automáticamente al abrir otro modal
    modalContent.addEventListener('change', e => {
      if(e.target && e.target.id === 'modal-pen-sel') {
        koPredictions[matchId].classifier = e.target.value || null;
        updateModalUI();
      }
    }, { signal: sig });
  }

  // Guardar
  // saveBtn se registra dentro de updateModalUI (evita stale ref)

  updateModalUI();
  document.getElementById('modal').classList.add('open');

  // Lanzar IA para este partido KO si no se ha analizado aún
  if(!iaKoPredictions[matchId]) {
    fetchIAforKO(matchId, match, hName, aName, updateModalUI);
  } else {
    showIAresultInModal(matchId);
  }
}


function closeModal(e) { if(e.target===document.getElementById('modal')) closeModalBtn(); }


function closeModalBtn() {
  document.getElementById('modal').classList.remove('open');
  refreshAllViews();
}


function setView(view) {
  currentView=view;
  document.querySelectorAll('.view-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.view-tab').forEach(b=>b.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
  event.target.classList.add('active');
  if(view==='bracket') buildBracketView();
  else if(view==='stadium') buildStadiumView();
}


function refreshAllViews() {
  resolveAllSlots();
  buildCinematicView();
  if(currentView==='bracket') buildBracketView();
  if(currentView==='stadium') buildStadiumView();
}


function koInit() {
  // Mostrar/ocultar dado KO según estado de porra
  const koDiceBtn = document.getElementById('ko-dice-btn');
  if(koDiceBtn) koDiceBtn.style.display = window._porraCerrada ? 'none' : 'inline-flex';
  // En single-page, predictions ya están en memoria — no cargar localStorage
  resolveAllSlots();

  const progress = getGroupsProgress();
  const complete = progress.filled >= 72;

  console.log('[koInit] progress:', progress.filled+'/'+progress.total, 'complete:', complete);
  console.log('[koInit] predictions keys:', Object.keys(predictions).length);
  console.log('[koInit] resolvedSlots sample:', Object.entries(resolvedSlots).slice(0,4));

  const lockedScreen = document.getElementById('locked-screen');
  const cinematicContent = document.getElementById('cinematic-content');

  console.log('[koInit] lockedScreen:', !!lockedScreen, 'cinematicContent:', !!cinematicContent);

  if (lockedScreen && cinematicContent) {
    if (!complete) {
      lockedScreen.style.display = 'flex';
      cinematicContent.style.display = 'none';
    } else {
      lockedScreen.style.display = 'none';
      cinematicContent.style.display = 'block';
    }
  }

  // Actualizar barra de progreso en locked screen
  const bar = document.getElementById('groups-progress-bar');
  const txt = document.getElementById('groups-progress-text');
  if (bar) bar.style.width = progress.pct + '%';
  if (txt) txt.textContent = progress.filled + ' / ' + progress.total + ' partidos completados';

  if (complete) {
    console.log('[koInit] calling buildCinematicView...');
    try {
      buildCinematicView();
    } catch(e) {
      console.error('[koInit] buildCinematicView error:', e);
    }
    if (currentView === 'bracket') buildBracketView();
    if (currentView === 'stadium') buildStadiumView();
  }
  updateKOPts();
  checkFinalizarReady();
}


  // ─────────────────────────────────────────────────────────────
  // NAVEGACIÓN SPA — showPage, goToEliminatoria,
  //   updateKOPts, initWelcome
  // ─────────────────────────────────────────────────────────────
/* ══ NAVEGACIÓN SPA ══ */
let _gruposInited = false;
function showPage(page) {
  if ((page === 'grupos' || page === 'elim' || page === 'score') && !currentUser) { openAuthModal('login'); return; }
  if (page === 'admin' && (!currentUser || !currentUser.is_admin)) return;

  // Capturar página actual ANTES de cambiar display (para el botón volver de score)
  if (page === 'score') {
    const prevPages = ['grupos','elim'];
    const prev = prevPages.find(p => document.getElementById('page-'+p)?.style.display !== 'none');
    if (prev) window._sbPrevPage = prev;
    if (!window._sbPrevPage) window._sbPrevPage = 'grupos';
    const labelMap = { grupos: 'Grupos', elim: 'Eliminatorias' };
    const lbl = document.getElementById('sb-back-label');
    if(lbl) lbl.textContent = labelMap[window._sbPrevPage] || 'Grupos';
  }

  document.getElementById('page-welcome').style.display = page==='welcome' ? 'block' : 'none';
  document.getElementById('page-grupos').style.display  = page==='grupos'  ? 'block' : 'none';
  document.getElementById('page-elim').style.display    = page==='elim'    ? 'block' : 'none';
  document.getElementById('page-score').style.display   = page==='score'   ? 'block' : 'none';
  document.getElementById('page-admin').style.display   = page==='admin'   ? 'block' : 'none';
  // Auth bar fixed: solo en welcome
  const authBar = document.getElementById('wc-auth-bar');
  if (authBar) authBar.style.display = page==='welcome' ? 'flex' : 'none';
  // Score user bar
  const scoreBar = document.getElementById('score-user-bar');
  if (scoreBar && currentUser) {
    const ini = currentUser.nombre.charAt(0).toUpperCase();
    scoreBar.innerHTML = `<div class="wc-user-badge" style="display:flex;align-items:center;gap:8px;background:rgba(17,19,24,.9);border:1px solid #27272a;border-radius:24px;padding:5px 12px 5px 7px"><div class="wc-user-avatar">${ini}</div><span class="wc-user-name">${escapeHtml(currentUser.nombre)}</span></div><button class="wc-logout-btn do-logout">Cerrar sesión</button>`;
  }
  if(page === 'elim')   { window.scrollTo(0,0); koInit(); }
  if(page === 'grupos') { window.scrollTo(0,0); if(!_gruposInited) { _gruposInited=true; initGrupos(); } }
  if(page === 'welcome') { if(currentUser && typeof leagueRenderPanel === 'function') setTimeout(leagueRenderPanel, 50); }
  if(page === 'welcome') window.scrollTo(0,0);
  if(page === 'score')  { window.scrollTo(0,0); sbLoad(); }
  if(page === 'admin')  { window.scrollTo(0,0); admInit(); }
}
function goToEliminatoria() { showPage('elim'); }
function updateKOPts() {
  let pts = 0;
  Object.values(koPredictions).forEach(p => { if(p&&p.saved&&p.l!==null) pts += 3; });
  const el = document.getElementById('total-ko-pts');
  if(el) el.textContent = pts;
}

/* ══ INIT ══ */
/* ══ WELCOME INIT ══ */
function initWelcome() {
  const WC_SB = 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/sites';
  const WC_VENUES_ROW1 = [
    {city:'Dallas',       path:'USA/Dallas.png',               country:'USA', pos:'center 20%',  scale:'115%'},
    {city:'Houston',      path:'USA/Houston.png',              country:'USA'},
    {city:'Kansas City',  path:'USA/Kansas%20City.png',        country:'USA'},
    {city:'Los Ángeles',  path:'USA/Los%20Angeles.png',        country:'USA'},
    {city:'Miami',        path:'USA/Miami.jpg',                country:'USA'},
    {city:'Nueva Jersey', path:'USA/Nueva-Jersey.png',         country:'USA', pos:'center 15%',  scale:'130%'},
    {city:'Filadelfia',   path:'USA/Philadelphia.png',         country:'USA'},
  ];
  const WC_VENUES_ROW2 = [
    {city:'San Francisco',path:'USA/San%20Francisco.jpg',      country:'USA'},
    {city:'Seattle',      path:'USA/Seattle.png',              country:'USA', pos:'center 30%',  scale:'140%'},
    {city:'Cdad. México', path:'Mexico/Ciudad%20de%20Mexico.png', country:'México'},
    {city:'Monterrey',    path:'Mexico/Monterrey.png',         country:'México'},
    {city:'Toronto',      path:'Canada/Toronto.png',           country:'Canadá'},
    {city:'Vancouver',    path:'Canada/Vancouver.png',         country:'Canadá'},
  ];
  function buildWcVenueCard(v) {
    const pos = v.pos || 'center center';
    const extra = v.scale ? `transform:scale(${v.scale});transform-origin:${pos}` : '';
    const imgStyle = `object-position:${pos};${extra}`;
    return `<div class="wc-vp-card">
      <img src="${WC_SB}/${v.path}" alt="${v.city}" loading="lazy" style="${imgStyle}">
      <div class="wc-vp-overlay"></div>
      <div class="wc-vp-flag">${v.country}</div>
      <div class="wc-vp-info">
        <div class="wc-vp-city">${v.city}</div>
        <div class="wc-vp-country">FIFA World Cup 2026</div>
      </div>
    </div>`;
  }
  const row1 = document.getElementById('wcVenRow1');
  const row2 = document.getElementById('wcVenRow2');
  if(row1) row1.innerHTML = WC_VENUES_ROW1.map(buildWcVenueCard).join('');
  if(row2) {
    row2.innerHTML = WC_VENUES_ROW2.map(buildWcVenueCard).join('');
    function wcSizeRow2() {
      const cardW = (row2.parentElement.offsetWidth - 80 - 6*6) / 7;
      row2.querySelectorAll('.wc-vp-card').forEach(c => { c.style.flex = '0 0 ' + cardW + 'px'; });
    }
    wcSizeRow2();
    window.addEventListener('resize', wcSizeRow2);
  }
}



// DOMContentLoaded movido al bloque de auth (después del CDN)


function renderPickerList(list, selected) {
  const scroll = document.getElementById('picker-scroll');
  const byTeam = {};
  list.forEach(p => { if(!byTeam[p.teamName]) byTeam[p.teamName]=[]; byTeam[p.teamName].push(p); });
  scroll.innerHTML = Object.entries(byTeam).map(([teamName, players]) => {
    const rows = players.map(p => {
      const isActive = selected?.key === p.key ? 'active' : '';
      return `<div class="aw-player-row ${isActive}" onclick="selectAward('${p.key}')">
        <div class="aw-player-info">
          <div class="aw-player-pname">${p.name}</div>
          <div class="aw-player-team">
            <div class="aw-player-tf"><img src="${SB}/flags/${p.flag}.png" alt=""/></div>
            ${teamName}
          </div>
        </div>
        <div class="aw-player-check">✓</div>
      </div>`;
    }).join('');
    return `<div class="aw-picker-group">${teamName}</div>${rows}`;
  }).join('');
}
function updateAwardsFooter() {
  const filled = Object.values(awPicks).filter(Boolean).length;
  // Actualizar dots y label en tarjeta estática de grupos (si existe)
  [0,1,2,3].forEach(i => { const dot = document.getElementById('aw-dot-'+i); if(dot) dot.classList.toggle('done', i<filled); });
  const progLabel = document.getElementById('aw-prog-label');
  if(progLabel) progLabel.textContent = filled+'/4 premios';
  const pts = Object.entries(awPicks).reduce((s,[a,p])=>s+(p?(AWARDS_CFG[a]?.pts||0):0),0);
  const badge = document.getElementById('aw-pts-badge');
  if(badge) { badge.textContent='+'+pts+' pts'; badge.classList.toggle('show',pts>0); }
  // Re-render box4 dinámico (vista eliminatorias)
  if (typeof window._renderBox4 === 'function') window._renderBox4();
