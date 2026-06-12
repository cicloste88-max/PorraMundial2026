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
  { name:"México", name_en:"Mexico",             slug:"mexico",       flag:"MEX", players:[{key:"Jimenez",name:"9 · Raúl Jiménez"},{key:"Vega",name:"10 · Alexis Vega"},{key:"Martin",name:"22 · Guillermo Martínez"},{key:"Gimenez",name:"11 · Santiago Giménez"},{key:"Gonzalez",name:"14 · Armando González"},{key:"Quinones",name:"16 · Julián Quiñones"},{key:"Mora",name:"19 · Gilberto Mora"},{key:"Alvarado",name:"25 · Roberto Alvarado"}] },
  { name:"Sudáfrica", name_en:"South Africa",          slug:"south-africa", flag:"RSA", players:[{key:"Foster",name:"9 · Lyle Foster"},{key:"Rayners",name:"15 · Iqraam Rayners"},{key:"Appollis",name:"7 · Oswin Appollis"},{key:"Mofokeng",name:"10 · Relebohile Mofokeng"},{key:"Makgopa",name:"17 · Evidence Makgopa"},{key:"Moremi",name:"8 · Tshepang Moremi"},{key:"Maseko",name:"12 · Thapelo Maseko"},{key:"Zwane",name:"11 · Themba Zwane"}] },
  { name:"República de Corea", name_en:"South Korea", slug:"korea",        flag:"KOR", players:[{key:"Lee",name:"19 · Lee Kang-In"},{key:"Hwang",name:"6 · Hwang In-Beom"},{key:"Son",name:"7 · Song Heung-Min"},{key:"Hyeongyu",name:"18 · Oh Hyeon-Gyu"},{key:"Heechan",name:"11 · Hwang Hee-Chan"},{key:"Hyunjun",name:"20 · Yang Hyun-Jun"},{key:"Guesung",name:"9 · Cho Gue-Sung"},{key:"Junho",name:"17 · Bae Jun-Ho"}] },
  { name:"República Checa", name_en:"Czechia",    slug:"czech",        flag:"CZE", players:[{key:"Schick",name:"10 · Patrick Schick"},{key:"Hlozek",name:"9 · Adam Hlozek"},{key:"Sulc",name:"15 · Pavel Sulc"},{key:"Provod",name:"17 · Lukas Provod"},{key:"Chytil",name:"13 · Mojmir Chytil"},{key:"Doudera",name:"21 · David Doudera"},{key:"Visinsky",name:"26 · Denis Visinsky"},{key:"Kuchta",name:"11 · Jan Kuchta"}] },
  { name:"Canadá", name_en:"Canada",             slug:"canada",       flag:"CAN", players:[{key:"Davies",name:"19 · Alphonso Davies"},{key:"David",name:"10 · Jonathan David"},{key:"Buchanan",name:"17 · Tajon Buchanan"},{key:"PromiseDavid",name:"24 · Promise David"},{key:"Oluwaseyi",name:"12 · Tani Oluwaseyi"},{key:"Ahmed",name:"20 · Ali Ahmed"},{key:"Flores",name:"26 · Marcelo Flores"},{key:"Shaffelburg",name:"14 · Jacob Shaffelburg"}] },
  { name:"Bosnia y Herzegovina", name_en:"Bosnia & Herzegovina",slug:"bosnia",      flag:"BIH", players:[{key:"Dzeko",name:"11 · Edin Dzeko"},{key:"Demirovic",name:"10 · Ermedin Demirovic"},{key:"Alajbegovic",name:"19 · Kerim Alajbegovic"},{key:"Bajraktarevic",name:"20 · Esmir Bajraktarevic"},{key:"Mahmic",name:"26 · Ermin Mahmic"},{key:"Memic",name:"15 · Amar Memic"},{key:"Tabakovic",name:"23 · Haris Tabakovic"},{key:"Bazdar",name:"9 · Samed Bazdar"}] },
  { name:"Catar", name_en:"Qatar",              slug:"qatar",        flag:"QAT", players:[{key:"Afif",name:"11 · Akram Afif"},{key:"Almoez",name:"19 · Almoez Ali"},{key:"Junior",name:"8 · Edmilson Junior"},{key:"Haydos",name:"10 · Hassan Al Haydos"},{key:"Abdurisag",name:"15 · Yusuf Abdurisag"},{key:"Mohammed",name:"24 · Tahsin Mohammed"},{key:"Muntari",name:"9 · Mohammed Muntari"},{key:"Alaa",name:"7 · Ahmed Alaa"}] },
  { name:"Suiza", name_en:"Switzerland",              slug:"switzerland",  flag:"SUI", players:[{key:"Ndoye",name:"11 · Dan Ndoye"},{key:"Embolo",name:"7 · Breel Embolo"},{key:"Xhaka",name:"10 · Gran Xhaka"},{key:"Okafor",name:"19 · Noah Okafor"},{key:"Vargas",name:"17 · Ruben Vargas"},{key:"Amdouni",name:"23 · Zeki Amdouni"},{key:"Rieder",name:"22 · Fabian Rieder"},{key:"Fassnacht",name:"16 · Christian Fassnacht"}] },
  { name:"Brasil", name_en:"Brazil",             slug:"brazil",       flag:"BRA", players:[{key:"Vinicius",name:"7 · Vinicius Jr"},{key:"Raphinha",name:"11 · Raphinha"},{key:"Endrick",name:"19 · Endrick"},{key:"Cunha",name:"9 · Matheus Cunha"},{key:"Thiago",name:"25 · Igor Thiago"},{key:"Martinelli",name:"22 · Martinelli"},{key:"Rayan",name:"26 · Rayan"},{key:"Paqueta",name:"20 · Lucas Paquetá"}] },
  { name:"Marruecos", name_en:"Morocco",          slug:"morocco",      flag:"MAR", players:[{key:"Hakimi",name:"2 · Achraf Hakimi"},{key:"Saibari",name:"11 · Ismael Saibari"},{key:"Diaz",name:"10 · Brahim Díaz"},{key:"Khannouss",name:"23 · Bilal El Khannouss"},{key:"Ezzalzouli",name:"17 · Abde Ezzalzouli"},{key:"Talbi",name:"7 · Chemsdine Talbi"},{key:"Gessime",name:"16 · Yassine Gessime"},{key:"Rahimi",name:"9 · Soufiane Rahimi"}] },
  { name:"Haití", name_en:"Haiti",              slug:"haiti",        flag:"HAI", players:[{key:"Borgella",name:"20 · Frantzdy Pierrot"},{key:"Nazon",name:"9 · Duckens Nazon"},{key:"Isidor",name:"18 · Wilson Isidor"},{key:"Casimir",name:"21 · Josué Casimir"},{key:"Joseph",name:"16 · Lenny Joseph"},{key:"Deedson",name:"11 · Louicius Deedson"},{key:"Etienne",name:"7 · Derrick Etienne"},{key:"Providence",name:"15 · Ruben Providence"}] },
  { name:"Escocia", name_en:"Scotland",            slug:"scotland",     flag:"SCO", players:[{key:"McTominay",name:"4 · Scott McTominay"},{key:"Christie",name:"11 · Ryan Christie"},{key:"Adams",name:"10 · Ché Adams"},{key:"Gannondoak",name:"17 · Ben Gannon-Doak"},{key:"Hirst",name:"18 · George Hirst"},{key:"Shankland",name:"20 · Lawrence Shankland"},{key:"Stewart",name:"14 · Ross Stewart"},{key:"Curtis",name:"25 · Findlay Curtis"}] },
  { name:"Estados Unidos", name_en:"USA",     slug:"usa",          flag:"USA", players:[{key:"Pulisic",name:"10 · Christian Pulisic"},{key:"Balogun",name:"20 · Folarin Balogun"},{key:"Reyna",name:"7 · Gio Reyna"},{key:"Pepi",name:"9 · Ricardo Pepi"},{key:"Tillman",name:"17 · Malik Tillman"},{key:"Weah",name:"21 · Tim Weah"},{key:"Aaronson",name:"11 · Brenden Aaronson"},{key:"Wright",name:"19 · Haji Wright"}] },
  { name:"Paraguay", name_en:"Paraguay",           slug:"paraguay",     flag:"PAR", players:[{key:"Almiron",name:"10 · Miguel Almirón"},{key:"Sanabria",name:"9 · Antonio Sanabria"},{key:"Enciso",name:"19 · Julio Enciso"},{key:"Magalhaes",name:"11 · Mauricio Magalhães"},{key:"Sosa",name:"7 · Ramón Sosa"},{key:"Pitta",name:"25 · Isidro Pitta"},{key:"Arce",name:"18 · Alex Arce"},{key:"Caballero",name:"24 · Gustavo Caballero"}] },
  { name:"Australia", name_en:"Australia",          slug:"australia",    flag:"AUS", players:[{key:"Irvine",name:"22 · Jackson Irvine"},{key:"Hrustic",name:"10 · Ajdin Hrustic"},{key:"Volpato",name:"20 · Cristian Volpato"},{key:"Irakunda",name:"17 · Nestoy Irakunda"},{key:"Toure",name:"9 · Mohamed Touré"},{key:"Velupillay",name:"23 · Nishan Velupillay"},{key:"Mabil",name:"11 · Awer Mabil"},{key:"Leckie",name:"7 · Mathew Leckie"}] },
  { name:"Turquía", name_en:"Türkiye",            slug:"turkey",       flag:"TUR", players:[{key:"Guler",name:"8 · Arda Güler"},{key:"Yildiz",name:"11 · Kenan Yildiz"},{key:"Calhanoglu",name:"10 · Hakan Çalhanoglu"},{key:"Uzun",name:"26 · Can Uzun"},{key:"Yilmaz",name:"21 · Baris Alper Yilmaz"},{key:"Akturkoglu",name:"7 · Karem Akturkoglu"},{key:"Akgun",name:"19 · Yunus Akgün"},{key:"Aydin",name:"24 · Oguz Aydin"}] },
  { name:"Alemania", name_en:"Germany",           slug:"germany",      flag:"GER", players:[{key:"Musiala",name:"10 · Jamal Musiala"},{key:"Wirtz",name:"17 · Florian Wirtz"},{key:"Havertz",name:"7 · Kai Havertz"},{key:"Woltemade",name:"11 · Nick Woltemade"},{key:"Karl",name:"25 · Lennart Karl"},{key:"Beier",name:"14 · Maximilian Beier"},{key:"Leweling",name:"9 · Jamie Leweling"},{key:"Undav",name:"26 · Deniz Undav"}] },
  { name:"Curazao", name_en:"Curaçao",            slug:"curacao",      flag:"CUW", players:[{key:"Bacuna",name:"7 · Juninho Bacuna"},{key:"Chong",name:"21 · Tahith Chong"},{key:"Hansen",name:"12 · Sontje Hansen"},{key:"Margaritha",name:"16 · Jearl Margaritha"},{key:"Antonisse",name:"11 · Jeremy Antonisse"},{key:"Noslin",name:"13 · Tyrese Noslin"},{key:"Martha",name:"15 · Arjany Martha"},{key:"Gorre",name:"14 · Kenji Gorré"}] },
  { name:"Costa de Marfil", name_en:"Côte d'Ivoire",    slug:"ivory-coast",  flag:"CIV", players:[{key:"Pepe",name:"19 · Nicolas Pepe"},{key:"Diomande",name:"11 · Yan Diomande"},{key:"Diallo",name:"15 · Amad Diallo"},{key:"Toure",name:"24 · Bazoumana Toure"},{key:"Bonny",name:"9 · Ange-Yoan Bonny"},{key:"Guessand",name:"22 · Evann Guessand"},{key:"Adingra",name:"10 · Simón Adingra"},{key:"Wahi",name:"12 · Elye Wahi"}] },
  { name:"Ecuador", name_en:"Ecuador",            slug:"ecuador",      flag:"ECU", players:[{key:"Caicedo",name:"23 · Moisés Caicedo"},{key:"Plata",name:"19 · Gonzalo Plata"},{key:"Valencia",name:"8 · Anthony Valencia"},{key:"Angulo",name:"20 · Nilson Angulo"},{key:"Paez",name:"10 · Kendry Páez"},{key:"Arevalo",name:"24 · Jeremy Arévalo"},{key:"Vite",name:"15 · Pedro Vite"},{key:"Yeboah",name:"9 · John Yeboah"}] },
  { name:"Países Bajos", name_en:"Netherlands",       slug:"netherlands",  flag:"NED", players:[{key:"Gakpo",name:"11 · Cody Gakpo"},{key:"VanDijk",name:"4 · Virgil van Dijk"},{key:"Depay",name:"10 · Memphis Depay"},{key:"Malen",name:"18 · Donyell Malen"},{key:"Kluivert",name:"7 · Justin Kluivert"},{key:"Summerville",name:"24 · Crysencio Summerville"},{key:"Brobbey",name:"19 · Brian Brobbey"},{key:"Lang",name:"17 · Noa Lang"}] },
  { name:"Japón", name_en:"Japan",              slug:"japan",        flag:"JPN", players:[{key:"Kubo",name:"8 · Takefusa Kubo"},{key:"Doan",name:"10 · Ritsu Doan"},{key:"Suzuki",name:"17 · Yuito Suzuki"},{key:"Ueda",name:"18 · Ayase Ueda"},{key:"Maeda",name:"11 · Daizen Maeda"},{key:"Kamada",name:"15 · Daichi Kamada"},{key:"Nakamura",name:"13 · Kaito Nakamura"},{key:"Goto",name:"9 · Keisuke Goto"}] },
  { name:"Suecia", name_en:"Sweden",             slug:"sweden",       flag:"SWE", players:[{key:"Isak",name:"9 · Alexander Isak"},{key:"Gyokeres",name:"17 · Viktor Gyökeres"},{key:"Elanga",name:"11 · Anthony Elanga"},{key:"Nygren",name:"10 · Benjamin Nygren"},{key:"Stroud",name:"24 · Elliot Stroud"},{key:"Bernhardsson",name:"21 · Alexander Bernhardsson"},{key:"Nilsson",name:"25 · Gustaf Nilsson"},{key:"Johansson",name:"6 · Herman Johansson"}] },
  { name:"Túnez", name_en:"Tunisia",              slug:"tunisia",      flag:"TUN", players:[{key:"Mejbri",name:"10 · Hannibal Mejbri"},{key:"Tounekti",name:"26 · Sebastian Tounekti"},{key:"Gharbi",name:"11 · Ismaël Gharbi"},{key:"Achouri",name:"7 · Elias Achouri"},{key:"Saad",name:"8 · Elias Saad"},{key:"Ouanes",name:"12 · Mortadha Ben Ouanes"},{key:"Chaouat",name:"19 · Firas Chaouat"},{key:"Ayari",name:"14 · Khalil Ayari"}] },
  { name:"Bélgica", name_en:"Belgium",            slug:"belgium",      flag:"BEL", players:[{key:"Doku",name:"11 · Jérémy Doku"},{key:"Lukaku",name:"9 · Romelu Lukaku"},{key:"DeBruyne",name:"7 · Kevin de Bruyne"},{key:"Ketelaere",name:"17 · Charles de Ketelaere"},{key:"Fernandezpardo",name:"26 · Matias Fernández-Pardo"},{key:"Moreira",name:"19 · Diego Moreira"},{key:"Saelemaekers",name:"22 · Alexis Saelemaekers"},{key:"Trossard",name:"10 · Leandro Trossard"}] },
  { name:"Egipto", name_en:"Egypt",             slug:"egypt",        flag:"EGY", players:[{key:"Salah",name:"10 · Mohamed Salah"},{key:"Trezeguet",name:"7 · Mahmoud Trezeguet"},{key:"Mostafa",name:"11 · Mostafa Abdel-Raouf Ziko"},{key:"Marmoush",name:"22 · Omar Marmoush"},{key:"Hassan",name:"12 · Haithem Hassan"},{key:"Zizo",name:"25 · Ahmed Sayed Zizo"},{key:"Adel",name:"20 · Ibrahim Adel"},{key:"Abdelkarim",name:"9 · Hamza Abdelkarim"}] },
  { name:"RI de Irán", name_en:"Iran",         slug:"iran",         flag:"IRN", players:[{key:"Taremi",name:"9 · Mehdi Taremi"},{key:"Jahanbakhsh",name:"7 · Alireza Jahanbakhsh"},{key:"Ghayedi",name:"10 · Mehdi Ghayedi"},{key:"Mohebbi",name:"8 · Mohammad Mohebbi"},{key:"Hosseinzadeh",name:"18 · Amirhossein Hosseinzadeh"},{key:"Alipour",name:"11 · Ali Alipour"},{key:"Ghodoos",name:"14 · Saman Ghodoos"},{key:"Torabi",name:"16 · Mehdi Torabi"}] },
  { name:"Nueva Zelanda", name_en:"New Zealand",      slug:"new-zealand",  flag:"NZL", players:[{key:"Wood",name:"9 · Chris Wood"},{key:"Cacace",name:"13 · Liberato Cacace"},{key:"Just",name:"11 · Eli Just"},{key:"Mccowatt",name:"20 · Callum McCowatt"},{key:"Randall",name:"21 · Jesse Randall"},{key:"Singh",name:"10 · Sarpreet Singh"},{key:"Waine",name:"18 · Ben Waine"},{key:"Barbarouses",name:"17 · Kosta Barbarouses"}] },
  { name:"España", name_en:"Spain",             slug:"spain",        flag:"ESP", players:[{key:"Yamal",name:"19 · Lamine Yamal"},{key:"Pedri",name:"20 · Pedri"},{key:"Rodri",name:"16 · Rodri"},{key:"Olmo",name:"10 · Dani Olmo"},{key:"Nico",name:"17 · Nico Williams"},{key:"Torres",name:"7 · Ferran Torres"},{key:"Baena",name:"15 · Alex Baena"},{key:"Pino",name:"11 · Yeremi Pino"}] },
  { name:"Cabo Verde", name_en:"Cabo Verde",         slug:"cape-verde",   flag:"CPV", players:[{key:"Tavares",name:"11 · Garry Rodrigues"},{key:"Mendes",name:"20 · Ryan Mendes"},{key:"Arcanjo",name:"18 · Telmo Arcanjo"},{key:"Varela",name:"26 · Hélio Varela"},{key:"Semedo",name:"17 · Willy Semedo"},{key:"Benchimol",name:"9 · Gilson Benchimol"},{key:"Livramento",name:"19 · Dailon Livramento"},{key:"Cabral",name:"7 · Jovane Cabral"}] },
  { name:"Arabia Saudí", name_en:"Saudi Arabia",       slug:"saudi-arabia", flag:"KSA", players:[{key:"AlDawsari",name:"6 · Nasser Aldawsari"},{key:"Alghannam",name:"17 · Khalid Alghannam"},{key:"Alshehri",name:"11 · Saleh Alshehri"},{key:"Mandash",name:"20 · Sultan Mandash"},{key:"Alhamddan",name:"19 · Abdullah Alhamddan"},{key:"Aldawsari",name:"10 · Salem Aldawsari"},{key:"Albrikan",name:"9 · Feras Albrikan"}] },
  { name:"Uruguay", name_en:"Uruguay",            slug:"uruguay",      flag:"URU", players:[{key:"Valverde",name:"8 · Federico Valverde"},{key:"Araujo",name:"20 · Maximiliano Araújo"},{key:"Nunez",name:"9 · Darwin Núñez"},{key:"Zalazar",name:"26 · Rodrigo Zalazar"},{key:"Arrascaeta",name:"10 · Giorgian De Arrascaeta"},{key:"Rodriguez",name:"18 · Brian Rodríguez"},{key:"Canobbio",name:"14 · Agustín Canobbio"},{key:"Pellistri",name:"11 · Facundo Pellistri"}] },
  { name:"Francia", name_en:"France",            slug:"france",       flag:"FRA", players:[{key:"Mbappe",name:"10 · Kylian Mbappé"},{key:"Dembele",name:"7 · Ousmane Dembélé"},{key:"Olise",name:"11 · Michael Olise"},{key:"Doue",name:"20 · Désiré Doué"},{key:"Barcola",name:"12 · Bradley Barcola"},{key:"Cherki",name:"24 · Rayan Cherki"},{key:"Akliouche",name:"25 · Maghnes Akliouche"},{key:"Thuram",name:"9 · Marcus Thuram"}] },
  { name:"Senegal", name_en:"Senegal",            slug:"senegal",      flag:"SEN", players:[{key:"Dia",name:"13 · Iliman Ndiaye"},{key:"Mane",name:"10 · Sadio Mané"},{key:"Diatta",name:"15 · Krépin Diatta"},{key:"Jackson",name:"11 · Nicolas Jackson"},{key:"Sarr",name:"18 · Ismaïla Sarr"},{key:"Mbaye",name:"20 · Ibrahim Mbaye"},{key:"Diao",name:"7 · Assane Diao"},{key:"Dieng",name:"9 · Bamba Dieng"}] },
  { name:"Irak", name_en:"Iraq",               slug:"irak",         flag:"IRQ", players:[{key:"AlHamadi",name:"9 · Ali Al Hamadi"},{key:"AlAmmari",name:"16 · Amir Al Ammari"},{key:"Qasem",name:"11 · Ahmed Qasem"},{key:"Farji",name:"21 · Marko Farji"},{key:"Ali",name:"10 · Mohanad Ali"},{key:"Bayesh",name:"8 · Ibrahim Bayesh"},{key:"Amyn",name:"7 · Youssef Amyn"},{key:"Jasim",name:"17 · Ali Jasim"}] },
  { name:"Noruega", name_en:"Norway",            slug:"norway",       flag:"NOR", players:[{key:"Haaland",name:"9 · Erling Haaland"},{key:"Odegaard",name:"10 · Martin Odegaard"},{key:"Sorloth",name:"7 · Alexander Sorloth"},{key:"Larsen",name:"11 · Jorgen Strand Larsen"},{key:"Nusa",name:"20 · Antonio Nusa"},{key:"Bob",name:"22 · Oscar Bob"},{key:"Schjelderup",name:"21 · Andreas Schjelderup"},{key:"Hauge",name:"23 · Jens Petter Hauge"}] },
  { name:"Argentina", name_en:"Argentina",          slug:"argentina",    flag:"ARG", players:[{key:"Alvarez",name:"9 · Julián Álvarez"},{key:"Dibu",name:"22 · Lautaro Martínez"},{key:"MacAllister",name:"20 · Alexis Mac Allister"},{key:"DePaul",name:"7 · Rodrigo de Paul"},{key:"Messi",name:"10 · Lionel Messi"},{key:"Paz",name:"18 · Nico Paz"},{key:"Simeone",name:"17 · Giuliano Simeone"},{key:"Gonzalez",name:"15 · Nico González"}] },
  { name:"Argelia", name_en:"Algeria",            slug:"algeria",      flag:"ALG", players:[{key:"Mahrez",name:"7 · Riyad Mahrez"},{key:"Maza",name:"22 · Ibrahim Maza"},{key:"Gouiri",name:"9 · Amine Gouiri"},{key:"Moussa",name:"11 · Anis Hadj Moussa"},{key:"Amoura",name:"18 · Mohamed Amine Amoura"},{key:"Chaibi",name:"10 · Farès Chaïbi"},{key:"Aouar",name:"8 · Houssem Aouar"},{key:"Ghedjemis",name:"25 · Farès Ghedjemis"}] },
  { name:"Austria", name_en:"Austria",            slug:"austria",      flag:"AUT", players:[{key:"Sabitzer",name:"9 · Marcel Sabitzer"},{key:"Arnautovic",name:"7 · Marko Arnautovic"},{key:"Gregoritsch",name:"11 · Michael Gregoritsch"},{key:"Baumgartner",name:"19 · Christoph Baumgartner"},{key:"Wanner",name:"24 · Paul Wanner"},{key:"Schimid",name:"18 · Romano Schimid"},{key:"Wimmer",name:"21 · Patrick Wimmer"},{key:"Prass",name:"22 · Alexander Prass"}] },
  { name:"Jordania", name_en:"Jordan",           slug:"jordan",       flag:"JOR", players:[{key:"Bani",name:"12 · Nour Bani Attiah"},{key:"Altamari",name:"10 · Mousa Al-Tamari"},{key:"Olwan",name:"9 · Ali Olwan"},{key:"Almardi",name:"13 · Mahmoud Nayef Ahmad ALMARDI"},{key:"Sabra",name:"18 · Ibrahim Sabra"},{key:"Alfakhouri",name:"11 · Odeh Al-Fakhouri"},{key:"Azaizeh",name:"24 · Ali Azaizeh"}] },
  { name:"Portugal", name_en:"Portugal",           slug:"portugal",     flag:"POR", players:[{key:"Leao",name:"17 · Rafael Leão"},{key:"Dias",name:"3 · Rúben Dias"},{key:"Bruno",name:"8 · Bruno Fernandes"},{key:"Ronaldo",name:"7 · Cristiano Ronaldo"},{key:"Neto",name:"18 · Pedro Neto"},{key:"Trincao",name:"16 · Francisco Trincão"},{key:"Ramos",name:"9 · Gonçalo Ramos"},{key:"Conceicao",name:"26 · Francisco Conceição"}] },
  { name:"RD Congo", name_en:"DR Congo",slug:"drc-jam",     flag:"COD", players:[{key:"Wissa",name:"20 · Yoane Wissa"},{key:"Bakambu",name:"17 · Cédric Bakambu"},{key:"Banza",name:"23 · Simon Banza"},{key:"Bongonda",name:"10 · Théo Bongonda"},{key:"Elia",name:"13 · Meschack Elia"},{key:"Cipenga",name:"9 · Brian Cipenga"},{key:"Mbuku",name:"7 · Nathanael Mbuku"},{key:"Mayele",name:"19 · Fiston Mayele"}] },
  { name:"Uzbekistán", name_en:"Uzbekistan",         slug:"uzbekistan",   flag:"UZB", players:[{key:"Fayzullaev",name:"22 · Abbosbek Fayzullaev"},{key:"Shomurodov",name:"14 · Eldor Shomurodov"},{key:"Urunov",name:"11 · Oston Urunov"},{key:"Sergeev",name:"21 · Igor Sergeev"},{key:"Iskanderov",name:"8 · Jamshid Iskanderov"},{key:"Masharipov",name:"10 · Jaloliddin Masharipov"},{key:"Khamdamov",name:"17 · Doston Khamdamov"},{key:"Amonov",name:"20 · Azizbek Amonov"}] },
  { name:"Colombia", name_en:"Colombia",           slug:"colombia",     flag:"COL", players:[{key:"Diaz",name:"7 · Luis Diaz"},{key:"Rios",name:"6 · Richard Ríos"},{key:"James",name:"10 · James Rodríguez"},{key:"Suarez",name:"25 · Luis Suárez"},{key:"Hernandez",name:"19 · Juan Camilo Hernández"},{key:"Arias",name:"11 · Jhon Arias"},{key:"Carrascal",name:"8 · Jorge Carrascal"},{key:"Gomez",name:"26 · Carlos Gómez"}] },
  { name:"Inglaterra", name_en:"England",         slug:"england",      flag:"ENG", players:[{key:"Bellingham",name:"10 · Jude Bellingham"},{key:"Saka",name:"7 · Bukayo Saka"},{key:"Kane",name:"9 · Harry Kane"},{key:"Rogers",name:"17 · Morgan Rogers"},{key:"Gordon",name:"18 · Anthony Gordon"},{key:"Eze",name:"21 · Eberechi Eze"},{key:"Madueke",name:"20 · Noni Madueke"},{key:"Rashford",name:"11 · Marcus Rashford"}] },
  { name:"Croacia", name_en:"Croatia",            slug:"croatia",      flag:"CRO", players:[{key:"Modric",name:"10 · Luka Modric"},{key:"Kramaric",name:"9 · Andrej Kramaric"},{key:"Perisic",name:"14 · Ivan Perisic"},{key:"Baturina",name:"16 · Martin Baturina"},{key:"Matanovic",name:"20 · Igor Matanovic"},{key:"Fruk",name:"19 · Toni Fruk"},{key:"Vlasic",name:"13 · Nikola Vlasic"},{key:"Musa",name:"26 · Petar Musa"}] },
  { name:"Ghana", name_en:"Ghana",              slug:"ghana",        flag:"GHA", players:[{key:"Partey",name:"5 · Thomas Partey"},{key:"Ayew",name:"9 · Jordan Ayew"},{key:"Semenyo",name:"11 · Antoine Semenyo"},{key:"Issahaku",name:"7 · Abdul Fatawu Issahaku"},{key:"Sulemana",name:"22 · Kamal Deen Sulemana"},{key:"Thomasasante",name:"10 · Brandon Thomas-Asante"},{key:"Nuamah",name:"24 · Ernest Nuamah"},{key:"Baah",name:"13 · Cristopher Bonsu Baah"}] },
  { name:"Panamá", name_en:"Panama",             slug:"panama",       flag:"PAN", players:[{key:"Carrasquilla",name:"8 · Adalberto Carrasquilla"},{key:"Diaz",name:"10 · Ismael Díaz"},{key:"JoseLuisRodriguez",name:"7 · José Luis Rodríguez"},{key:"Londono",name:"24 · Azarías Londoño"},{key:"TomasRodriguez",name:"9 · Tomás Rodríguez"},{key:"Barcenas",name:"11 · Yoel Bárcenas"},{key:"Fajardo",name:"17 · José Fajardo"},{key:"Waterman",name:"18 · Cecilio Waterman"}] },
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

// R2b post-J1 → endurecido en F1 (re-QA San): SOLO key de liga concreta.
// Sin liga activa NO hay key de cache — el residuo 'boostPicks_default'
// (era pre-ligas / pruebas) sobrevive a los hard-reload (NO limpian
// localStorage) y pintaba pill+checkbox en el partido equivocado durante
// toda la sesión: el load del bootstrap de auth corre ANTES de que exista
// liga activa y nadie volvía a cargar boosts al seleccionarla (ahora
// leagueSelect re-llama a loadBoostPicks).
function _boostLsKey() {
  const leagueId = (window.getActiveLeagueId && window.getActiveLeagueId()) ||
    window._currentLeagueId || null;
  return leagueId ? ('boostPicks_' + leagueId) : null;
}

async function saveBoostPicks() {
  // 1. Caché rápida en localStorage — solo con liga activa (sin liga no se
  //    escribe NADA: recrearía el residuo 'default').
  try {
    const lsKey = _boostLsKey();
    if (lsKey) localStorage.setItem(lsKey, JSON.stringify(boostPicks));
  } catch(e) {}

  // 2. Sincronizar con Supabase (upsert por usuario/liga/día)
  try {
    const db = (typeof getQueryDb === 'function') ? getQueryDb() : window._porraDb;
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
  // R2-F1: higiene one-shot — purgar el residuo legacy pre-ligas. Los
  // hard-reload NO limpian localStorage; este residuo era el que seguía
  // pintando la pill en MEX-RSA con la BD correcta.
  try { localStorage.removeItem('boostPicks_default'); } catch(e) {}

  const lsKey = _boostLsKey();
  if (!lsKey) {
    // Sin liga activa no hay contexto de boosts que pintar. NO leer locals.
    boostPicks = {};
    return;
  }

  // R2-F1: con la porra CERRADA la ÚNICA verdad es boost_picks en BD —
  // ignorar localStorage por completo en lectura (un residuo bajo la key de
  // liga ganaría el primer paint de pill/checkbox antes de resolver la BD).
  const cerrada = window._porraCerrada === true;
  if (cerrada) {
    boostPicks = {};
  } else {
    // Pre-cierre: localStorage como caché rápida (la BD manda en el paso 2).
    try {
      const raw = localStorage.getItem(lsKey);
      boostPicks = raw ? JSON.parse(raw) : {};
    } catch(e) { boostPicks = {}; }
  }

  // 2. Sobreescribir/migrar contra Supabase (fuente de verdad)
  try {
    const db = (typeof getQueryDb === 'function') ? getQueryDb() : window._porraDb;
    const uid = window.currentUser?.id;
    const leagueId = window.getActiveLeagueId?.();
    if (!db || !uid || !leagueId) return;

    const { data, error } = await db
      .from('boost_picks')
      .select('match_date, match_id')
      .eq('user_id', uid)
      .eq('league_id', leagueId);

    if (error) {
      console.warn('[loadBoostPicks] Supabase error:', error.message);
      return;
    }

    if (data && data.length > 0) {
      // Camino normal: DB es la fuente de verdad
      boostPicks = {};
      data.forEach(row => { boostPicks[row.match_date] = row.match_id; });
      try {
        localStorage.setItem(lsKey, JSON.stringify(boostPicks));
      } catch(e) {}
    } else if (!cerrada && Object.keys(boostPicks).length > 0) {
      // Recuperación one-shot: DB vacía + localStorage DE ESTA MISMA LIGA
      // (lsKey es league-scoped por construcción; resaca del bug del cliente
      // AUTH). Solo PRE-cierre: tras el cierre no existen boosts legítimos
      // solo-locales. Idempotente.
      console.log('[loadBoostPicks] DB vacía + local de la liga con', Object.keys(boostPicks).length, 'boosts → migrando');
      await saveBoostPicks();
    } else {
      // DB vacía y sin locals fiables de esta liga → sin boosts.
      boostPicks = {};
    }

    // R2-F1: las vistas pintadas antes de resolver la BD deben repintarse
    // con el estado bueno (pill + checkbox leen el global boostPicks).
    try {
      if (document.getElementById('jornada-container') &&
          typeof window.renderVistaJornada === 'function') {
        window.renderVistaJornada();
      }
      if (document.getElementById('groups-container') &&
          typeof window.renderAll === 'function') {
        window.renderAll();
      }
      if (typeof window.v3RenderBoardGrupos === 'function') {
        window.v3RenderBoardGrupos();
      }
    } catch(e) { /* vista no activa */ }
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

// === [B10-traceability → B11 Item 7 post-J1] Predictor ranking helpers ===
//
// Vistas backend (migración 20260612001000_b11_user_points_cache.sql):
//   v_league_member_count(league_id, human_count, total_count)
//   v_league_rank(user_id, league_id, total_pts, rank_league, ranked_members)
//   v_user_global_rank v2(user_id, league_id, total_pts, rank_global, total_users)
//
// Fuente canónica: user_points_cache, rellenada por get-league-standings
// v1.4.0 (write-through) e invocada por porra-bridge-results tras cada
// partido bridgeado. FUERA los hardcodes pre-Mundial (leagueRank=1, stub
// global por created_at).
//
// Decisiones San (12-jun): rank global = mis pts EN ESTA LIGA vs el mejor
// total de cada usuario de la app (2 ligas con mismos pts → misma posición);
// IA Zayu COMPITE → denominador de liga = total_count (con bot), no
// human_count.
//
// Defensiva: si window._porraDb no está disponible o falta league/user,
// devuelve null y mantiene compat con render fallback de #fc-pred-tile
// ("Líder · Liga" / "— · Global"). Cache TTL 60s: el tile se refresca al
// remontar tras un partido bridgeado sin esperar reload completo.

var _predictorRankingCache = {};
var _PREDICTOR_RANKING_TTL_MS = 60000;

async function loadLeagueMemberCount(leagueId) {
  if (!leagueId || !window._porraDb) return null;
  var res = await window._porraDb
    .from('v_league_member_count')
    .select('human_count,total_count')
    .eq('league_id', leagueId)
    .maybeSingle();
  if (res.error) {
    console.warn('[predictor] loadLeagueMemberCount error', res.error);
    return null;
  }
  return res.data;
}

async function loadLeagueRankRow(userId, leagueId) {
  if (!userId || !leagueId || !window._porraDb) return null;
  var res = await window._porraDb
    .from('v_league_rank')
    .select('total_pts,rank_league,ranked_members')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .maybeSingle();
  if (res.error) {
    console.warn('[predictor] loadLeagueRankRow error', res.error);
    return null;
  }
  return res.data;
}

async function loadGlobalRank(userId, leagueId) {
  if (!userId || !leagueId || !window._porraDb) return null;
  var res = await window._porraDb
    .from('v_user_global_rank')
    .select('rank_global,total_users')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .maybeSingle();
  if (res.error) {
    console.warn('[predictor] loadGlobalRank error', res.error);
    return null;
  }
  return res.data;
}

async function loadPredictorRankingData() {
  var leagueId = window._activeLeague && window._activeLeague.id;
  var userId = window.currentUser && window.currentUser.id;
  if (!leagueId || !userId) return null;

  var cacheKey = userId + '|' + leagueId;
  var cached = _predictorRankingCache[cacheKey];
  if (cached && (Date.now() - cached.ts) < _PREDICTOR_RANKING_TTL_MS) {
    window._predictorRanking = cached.data;
    return cached.data;
  }

  var results = await Promise.all([
    loadLeagueMemberCount(leagueId),
    loadLeagueRankRow(userId, leagueId),
    loadGlobalRank(userId, leagueId)
  ]);
  var leagueData = results[0];
  var rankRow = results[1];
  var globalData = results[2];

  // Zayu cuenta: denominador = total_count (miembros con bot). Fallback al
  // nº de filas rankeadas en cache si la vista de members no responde.
  var memberCount = leagueData
    ? Number(leagueData.total_count || leagueData.human_count || 0)
    : (rankRow ? Number(rankRow.ranked_members || 0) : 0);

  window._predictorRanking = {
    leagueMembers: memberCount,
    leagueRank: rankRow ? Number(rankRow.rank_league || 0) : 0,
    totalPts: rankRow ? Number(rankRow.total_pts || 0) : 0,
    globalRank: globalData ? Number(globalData.rank_global || 0) : 0,
    globalTotal: globalData ? Number(globalData.total_users || 0) : 0
  };
  _predictorRankingCache[cacheKey] = { ts: Date.now(), data: window._predictorRanking };
  return window._predictorRanking;
}

window.loadPredictorRankingData = loadPredictorRankingData;

// === [Sprint A · Group 3 → R1 post-J1] loadLeagueRanking — ranking REAL de
//     la liga desde user_points_cache (v_league_rank, MISMA fuente que el
//     panel TU POSICIÓN del tile) + nombres/is_bot de profiles (RLS lectura
//     pública "Profiles públicos para scoreboard"). NUNCA vía league_members:
//     su SELECT es self-only (auth.uid() = user_id) y el widget colapsaba a
//     "Vas Nº1 de 1 · líder <yo> con 0 pts" — cada usuario veía SOLO su
//     fila, con points:0 hardcodeado del stub pre-Mundial. ===
async function loadLeagueRanking(leagueId) {
  if (!leagueId || !window._porraDb) return [];
  var db = window._porraDb;
  var res = await db
    .from('v_league_rank')
    .select('user_id, total_pts, rank_league')
    .eq('league_id', leagueId)
    .order('rank_league', { ascending: true });
  if (res.error) {
    console.warn('[loadLeagueRanking] error', res.error.message);
    return [];
  }
  var ranks = res.data || [];
  if (!ranks.length) return [];

  var ids = ranks.map(function (r) { return r.user_id; });
  var profRes = await db
    .from('profiles')
    .select('id, nombre, is_bot')
    .in('id', ids);
  if (profRes.error) console.warn('[loadLeagueRanking] profiles error', profRes.error.message);
  var profById = {};
  (profRes.data || []).forEach(function (p) { profById[p.id] = p; });

  var rows = ranks.map(function (r) {
    var p = profById[r.user_id] || {};
    return {
      user_id: r.user_id,
      nombre: p.nombre || 'Usuario',
      is_bot: !!p.is_bot,
      points: Number(r.total_pts || 0),
      position: Number(r.rank_league || 0)
    };
  });
  // Empates comparten position (rank clásico de la vista); orden estable por
  // nombre dentro del empate para que la lista no baile entre renders.
  rows.sort(function (a, b) {
    return (a.position - b.position) || a.nombre.localeCompare(b.nombre, 'es');
  });
  return rows;
}
window.loadLeagueRanking = loadLeagueRanking;

// === [Sprint A · Group 4 → EF v1.0.0] loadLeagueHighlights — hasta 5 insights
//     VERDADEROS user-vs-liga para DESTACADOS DE TU LIGA, vía EF
//     get-league-highlights (service_role).
//     Los items client-side anteriores (contrarian KO, campeón, contador
//     cerradas/pendientes) agregaban sobre tablas con RLS own-rows-only
//     (predictions/award_picks/ko_predictions/league_members) → veían solo la
//     fila propia y montaban frases falsas (ERR-86). El item C (IA Zayu top 3)
//     se retira también: la EF ya devuelve 5 insights, incluida la sintonía
//     con la IA. La EF responde { highlights: [{ icon, text }] } ya formateado
//     y ordenado por impacto. ===
async function loadLeagueHighlights(leagueId, userId) {
  var fallback = [{ icon: '📊', text: 'Tu liga está lista para jugar.' }];
  if (!leagueId || !userId) return fallback;
  // Cliente JWT authenticated (auth.js getQueryDb), mismo invoke que F5 —
  // adjunta el token del usuario en functions.invoke. NO fetch manual.
  var db = (typeof getQueryDb === 'function') ? getQueryDb()
    : (typeof window.getQueryDb === 'function') ? window.getQueryDb()
    : window._porraDb;
  if (!db || !db.functions) return fallback;
  try {
    var res = await db.functions.invoke('get-league-highlights', {
      body: { league_id: leagueId, user_id: userId }
    });
    if (res && res.error) {
      console.warn('[highlights] EF get-league-highlights error', res.error.message || res.error);
    } else if (res && res.data) {
      if (res.data.gated === true) {
        // Verja de cierre (mirror F4): la porra del caller sigue ABIERTA y la
        // EF no computa nada. El shell detecta el flag `gated` y pinta el
        // estado bloqueado en lugar de tarjetas (NO el fallback genérico).
        return [{ gated: true, icon: '🔒', text: 'Cierra tu porra para desbloquear los highlights de tu liga' }];
      }
      if (Array.isArray(res.data.highlights)) {
        var items = res.data.highlights.filter(function (h) {
          return h && typeof h.text === 'string' && h.text;
        }).slice(0, 5).map(function (h) {
          return { icon: h.icon || '•', text: h.text };
        });
        if (items.length) return items;
      }
    }
  } catch (e) {
    console.warn('[highlights] EF get-league-highlights excepción', e);
  }
  return fallback;
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

