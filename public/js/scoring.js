// scoring.js - Porra Mundial 2026 / sub-bloque js-scoring
// Motor de puntuacion + tabla avanzada + tarjetas de partido + tarjeta premios.
// Deps: data.js (usa PARTIDOS, EQUIPOS, GRUPOS, predictions, escapeHtml, etc.)


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
// +3 marcador exacto (APILA sobre el +1 del signo)
// +2 goleador correcto
// +1 bonus vs IA (tu signo difiere de la IA y aciertas)  ← Fase F.4
// Máximo: 1+3+2+1 = 7 pts por partido (antes del boost ×2).
//
// Casos F.4 (ver iaBonusWillApply en data.js para la predicate):
//   A) user 2-0 (signo 1), ia=1, real 1-0 (signo 1) → 1 signo + 0 bonus = 1
//   B) user 1-2 (signo 2), ia=1, real 0-1 (signo 2) → 1 signo + 1 bonus = 2
//   C) user 1-2 (signo 2), ia=1, real 1-1 (X)       → 0 signo + 0 bonus = 0
//   D) user 2-0 (signo 1), ia=null, real 1-0 (1)    → 1 signo + 0 bonus = 1
// Verificados via Node en F.4 commit. El bonus se aplica DESPUÉS de
// signo/exacto/goleador y antes del cap de 7 y del boost ×2.
function calcMatchPoints(pred, realL, realR, matchKey, realScorers) {
  if(!pred || !pred.saved) return 0;
  let pts = 0;

  const isExact = pred.l === realL && pred.v === realR;

  // Signo: +1 si el sentido del marcador es correcto
  if(pred.l !== null && pred.v !== null &&
     Math.sign(pred.l - pred.v) === Math.sign(realL - realR)) {
    pts += 1;
  }

  // Exacto: +3 ADICIONALES si además el marcador es exacto
  if(isExact) pts += 3;

  // F2.9 HF-09 — Goleador: +2 si pred.gol acierta a CUALQUIER goleador real
  // del partido. Independiente del marcador (incluido 0-0 si se registra
  // un goleador) y del equipo (ganador, perdedor, empatado).
  // Excepción KO: los goles en tanda de penaltis NO cuentan — responsabilidad
  // del pipeline alimentar realScorers solo con goles de 90' + prórroga.
  if(pred.gol) {
    const scorers = realScorers ?? _hf09FallbackScorers(pred, realL, realR);
    if(scorers.includes(pred.gol)) pts += 2;
  }

  // Bonus vs IA (F.4). iaBonusWillApply valida que ia.sign !== null,
  // user_sign !== ia_sign, y user_sign === real_sign.
  if(iaBonusWillApply(matchKey, pred, realL, realR)) pts += 1;

  pts = Math.min(pts, 7); // cap 7pt por partido (pre-boost)

  // Boost x2: si este partido es el boost del día Y se acertó el exacto
  if(isExact && matchKey) {
    const matchDate = PARTIDOS.find(m => getMatchKey(m) === matchKey)?.date?.substring(0,10);
    if(matchDate && boostPicks[matchDate] === matchKey) {
      pts *= 2; // máximo 14 pts
    }
  }

  return pts;
}

// F2.9 HF-09: placeholder mientras el pipeline no hidrate scorers[] reales.
// En producción definitiva, realScorers vendrá desde realMatchResults[key].scorers
// o realKoResults[m.id].scorers (excluyendo penaltis en KO). Trabajo pendiente
// aguas arriba en porra-apify-webhook + update-results EF (fuera de F2.9).
function _hf09FallbackScorers(pred, realL, realR) {
  const teams = realL === realR
    ? [pred.home, pred.away]
    : [realL > realR ? pred.home : pred.away];
  return teams
    .map(name => EQUIPOS.find(e => e.name === name)?.players?.[0]?.key)
    .filter(Boolean);
}

// ── Puntos KO por ronda ───────────────────────────────────
// Calcula los pts de un pronóstico KO dado un resultado real
// round: 'r32'|'r16'|'qf'|'sf'|'final'
function calcKOMatchPoints(pred, realL, realR, round, realScorers) {
  if(!pred || !pred.saved) return 0;
  let pts = calcMatchPoints(pred, realL, realR, null, realScorers);

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
    if(pred && real) total += calcMatchPoints(pred, real.l, real.v, key, real.scorers);
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
      if(pred && real) total += calcKOMatchPoints(pred, real.l, real.v, round, real.scorers);
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

/* ── Boost: Canvas 2D fire — sistema de partículas compartido ──
   Un solo canvas reposicionado sobre la tarjeta con boost-active.
   Partículas con bloom naranja/rojo, fondo transparente, mix-blend-mode:screen.
   Solo corre cuando hay una tarjeta activa. ── */
const _boostFire = (function() {
  let canvas = null, ctx = null, animId = null;
  let activeCard = null, fadeVal = 0, particles = [];
  const PAD = 30; // px extra alrededor de la card
  const MAX_P = 90;
  const COLORS = [
    // life ratio → [r, g, b]  (de joven a viejo)
    [255, 240, 120],  // spark: amarillo claro
    [255, 160, 40],   // bloom: naranja
    [240, 80, 15],    // fuego: naranja-rojo
    [180, 30, 5],     // brasa: rojo oscuro
  ];

  function colorAt(t) {
    // t: 0=recién nacida, 1=muerta
    const idx = t * (COLORS.length - 1);
    const lo = Math.floor(idx), hi = Math.min(lo + 1, COLORS.length - 1);
    const f = idx - lo;
    return [
      COLORS[lo][0] + (COLORS[hi][0] - COLORS[lo][0]) * f,
      COLORS[lo][1] + (COLORS[hi][1] - COLORS[lo][1]) * f,
      COLORS[lo][2] + (COLORS[hi][2] - COLORS[lo][2]) * f,
    ];
  }

  function spawn(w, h) {
    // Zona: 0=bottom, 1=left, 2=right, 3=top
    const zone = Math.random() < 0.55 ? 0 : Math.random() < 0.5 ? (Math.random()<0.5?1:2) : 3;
    let x, y, vx, vy;
    if (zone === 0) { // bottom
      x = PAD + Math.random() * w;
      y = PAD + h + Math.random() * 4;
      vx = (Math.random() - 0.5) * 0.8;
      vy = -(1.2 + Math.random() * 2.0);
    } else if (zone === 1) { // left
      x = PAD - Math.random() * 4;
      y = PAD + h * 0.2 + Math.random() * h * 0.6;
      vx = 0.4 + Math.random() * 0.6;
      vy = -(0.5 + Math.random() * 1.2);
    } else if (zone === 2) { // right
      x = PAD + w + Math.random() * 4;
      y = PAD + h * 0.2 + Math.random() * h * 0.6;
      vx = -(0.4 + Math.random() * 0.6);
      vy = -(0.5 + Math.random() * 1.2);
    } else { // top
      x = PAD + w * 0.15 + Math.random() * w * 0.7;
      y = PAD - Math.random() * 4;
      vx = (Math.random() - 0.5) * 0.5;
      vy = -(0.3 + Math.random() * 0.8);
    }
    const maxLife = 30 + Math.random() * 40;
    return { x, y, vx, vy, life: maxLife, maxLife, size: 2 + Math.random() * 5 };
  }

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'boost-fire-canvas';
    ctx = canvas.getContext('2d');
  }

  function attachTo(card) {
    if (!card) return detach();
    if (activeCard === card) return;
    activeCard = card;
    ensureCanvas();
    card.appendChild(canvas);
    resize();
    particles = [];
    fadeVal = 0;
    if (!animId) animId = requestAnimationFrame(loop);
  }

  function detach() {
    activeCard = null;
    // fade out — loop sigue hasta fadeVal=0
  }

  function resize() {
    if (!activeCard || !canvas) return;
    const w = activeCard.offsetWidth;
    const h = activeCard.offsetHeight;
    canvas.width = w + PAD * 2;
    canvas.height = h + PAD * 2;
    canvas.style.top = -PAD + 'px';
    canvas.style.left = -PAD + 'px';
  }

  function loop() {
    if (!canvas || !ctx) { animId = null; return; }
    const cw = canvas.width, ch = canvas.height;
    const cardW = cw - PAD * 2, cardH = ch - PAD * 2;

    // Fade in/out
    if (activeCard && fadeVal < 1) fadeVal = Math.min(1, fadeVal + 0.04);
    if (!activeCard && fadeVal > 0) fadeVal = Math.max(0, fadeVal - 0.03);

    if (!activeCard && fadeVal <= 0) {
      ctx.clearRect(0, 0, cw, ch);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      particles = [];
      animId = null;
      return;
    }

    // Spawn
    const spawnRate = Math.ceil(MAX_P / 35);
    for (let i = 0; i < spawnRate && particles.length < MAX_P; i++) {
      particles.push(spawn(cardW, cardH));
    }

    ctx.clearRect(0, 0, cw, ch);
    ctx.globalAlpha = fadeVal;
    ctx.globalCompositeOperation = 'lighter'; // additive

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx + (Math.random() - 0.5) * 0.4; // wobble
      p.y += p.vy;
      p.vy *= 0.995; // desacelerar
      p.life--;

      if (p.life <= 0) { particles.splice(i, 1); continue; }

      const t = 1 - p.life / p.maxLife; // 0=joven, 1=viejo
      const [r, g, b] = colorAt(t);
      const alpha = (1 - t) * (1 - t); // fade cuadrático
      const sz = p.size * (1 + t * 0.5); // crece al envejecer

      // Glow (bloom) via shadowBlur
      ctx.shadowColor = `rgba(${r|0},${g|0},${b|0},${(alpha*0.8).toFixed(2)})`;
      ctx.shadowBlur = sz * 3;

      ctx.beginPath();
      ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${alpha.toFixed(2)})`;
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    animId = requestAnimationFrame(loop);
  }

  // API pública
  return { attachTo, detach, resize };
})();

// Observador global: detecta qué tarjeta tiene boost-active
const _boostObserver = new MutationObserver(function(mutations) {
  if (mutations.every(function(m) { return m.target.closest && m.target.closest('.fc-tabbar, .fc-appbar'); })) return;
  const active = document.querySelector('.card.boost-active');
  if (active) _boostFire.attachTo(active);
  else _boostFire.detach();
});
// Se activa tras renderizar las tarjetas (en initGrupos o similar)
setTimeout(function() {
  const container = document.getElementById('page-grupos') || document.body;
  _boostObserver.observe(container, { subtree: true, attributes: true, attributeFilter: ['class'] });
  // Estado inicial
  const active = document.querySelector('.card.boost-active');
  if (active) _boostFire.attachTo(active);
}, 500);

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
  // Stickers eliminados (F7.1) — preserved hSk/aSk vars por si se reactivan
  const hStickerEl = '';
  const aStickerEl = '';

  const hOpts = homeTeam.players.map(p=>'<option value="'+p.key+'"'+(pred.gol===p.key?' selected':'')+'>'+p.name+'</option>').join('');
  const aOpts = awayTeam.players.map(p=>'<option value="'+p.key+'"'+(pred.gol===p.key?' selected':'')+'>'+p.name+'</option>').join('');

  const lVal = pred.l!==null ? pred.l : '—';
  const vVal = pred.v!==null ? pred.v : '—';

  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'card-wrap-' + matchKey;
  card.setAttribute('data-match-idx', String(idx));
  card.setAttribute('data-grupo', match.group);

  // Use dataset to store slug for kit/flag click handlers
  card.innerHTML = [
    '<div class="card-inner">',
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
        '<div class="vs-b"><div class="vs-ball"></div><span class="vs-text">VS</span></div>',
        '<div class="status-pill open" id="spill-'+idx+'">',
          '<div class="sdot"></div>',
          '<span id="stxt-'+idx+'">Abierta</span>',
        '</div>',
      '</div>',
      '<div class="mpill mpill-bottom">'+match.stadium+'</div>',
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
          '<div class="ptc sign" id="ptc-sign-'+idx+'">🔵 +1 signo</div>',
          '<div class="ptc exact" id="ptc-exact-'+idx+'">🎯 +3 exacto</div>',
          '<div class="ptc scorer" id="ptc-scorer-'+idx+'">⚽ +2 goleador</div>',
          '<div class="ptc ia" id="ptc-ia-'+idx+'">🤖 +1 vs IA</div>',
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
        '</div>',
      '</div>',
    '</div>',
    '<div class="ia-bar" id="ia-bar-'+idx+'">',
      '<div class="ia-lbl">IA predice<button type="button" class="ia-info-btn" aria-label="Cómo funciona IA Predice" onclick="event.stopPropagation();window.showIAInfoTooltip&&window.showIAInfoTooltip(this)">?</button></div>',
      '<div class="ia-content" id="ia-content-'+idx+'">',
        '<div id="ia-result-'+idx+'" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">',
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
    '</div>',
    /* ── Fila Boost (dentro de card-inner, encima del footer) ── */
    '<div class="boost-row" id="boost-row-'+idx+'" data-jornada-date="'+match.date.slice(0,10)+'" data-match-key="'+matchKey+'">',
      '<label class="boost-label" for="boost-chk-'+idx+'">',
        '<div class="boost-chk-wrap">',
          '<input type="checkbox" id="boost-chk-'+idx+'" class="boost-chk">',
          '<div class="boost-chk-box">',
            '<svg class="boost-tick" width="11" height="9" viewBox="0 0 11 9" fill="none">',
              '<path d="M1 4.5L4 7.5L10 1" stroke="rgb(251,146,60)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
            '</svg>',
          '</div>',
        '</div>',
        '<span style="font-size:15px;line-height:1">🔥</span>',
        '<span class="boost-txt">Boost a este partido</span>',
      '</label>',
      '<span class="boost-x2">×2</span>',
    '</div>',
    '</div>',  /* ← cierre .card-inner */
    '<div class="boost-badge">×2</div>',
  ].join('');

  // Kit area click via event delegation on card
  card.querySelectorAll('.kit-area').forEach(ka => {
    ka.addEventListener('click', () => { /* TODO: shop link */ });
  });
  card.querySelectorAll('.flag-wrap').forEach(fw => {
    fw.addEventListener('click', e => {
      e.stopPropagation();
      if (typeof window.openPizarraTactica !== 'function') return;
      const iso3 = fw.getAttribute('data-flag');
      if (!iso3) return;
      const half = fw.closest('.half');
      const isHome = half && half.classList.contains('L');
      const nameEn = isHome ? match.home : match.away;
      window.openPizarraTactica({ iso3, nameEn });
    });
  });

  // Hidrata la .ia-bar desde iaPredictions (bootstrap de auth.js); si aun no
  // hay datos, la barra queda oculta hasta que updateCardUI reintente.
  hydrateIABar(idx, matchKey, match);

  return card;
}

// Post-F commit 2 — rellena la .ia-bar existente desde iaPredictions[matchKey].
// Sustituye a renderIAHint (que tambien pintaba el chip .ia-hint, eliminado
// por redundancia con la pill "+1pt vs IA" de .pts-row). Idempotente: llamado
// desde renderMatchCard (render inicial) y updateCardUI (bootstrap tardio).
// Post-F commit 3 — si la entry tiene raw context (elo_home_raw poblado), el
// numero de confianza se envuelve en un <span class="ia-pct-trigger"> que
// abre el tooltip explainer en hover (desktop) o click (mobile).
function hydrateIABar(idx, matchKey, match) {
  const ia = iaPredictions[matchKey];
  if (!ia || !ia.sign) return;
  const barEl = document.getElementById('ia-bar-' + idx);
  const predTxt = document.getElementById('ia-pred-txt-' + idx);
  const detailTxt = document.getElementById('ia-detail-txt-' + idx);
  if (!barEl || !predTxt || !detailTxt) return;
  const signMap = { '1': 'Local', 'X': 'Empate', '2': 'Visitante' };
  const signLabel = signMap[ia.sign] || ia.sign;
  const conf = Number.isFinite(ia.confidence) ? ia.confidence : Math.round((ia.sign === '1' ? ia.p_home : ia.sign === '2' ? ia.p_away : ia.p_draw) * 100 || 0);
  const base = ia.sign + ' · ' + signLabel;
  const hasExplainer = typeof ia.elo_home_raw === 'number' && match && conf;
  if (hasExplainer) {
    setupIAExplainerOnce();
    predTxt.textContent = base + ' ';
    const pct = document.createElement('span');
    pct.className = 'ia-pct-trigger';
    pct.setAttribute('role', 'button');
    pct.setAttribute('tabindex', '0');
    pct.setAttribute('aria-label', 'Ver por qué la IA predice ' + signLabel);
    pct.dataset.matchKey = matchKey;
    pct.dataset.home = match.home || '';
    pct.dataset.away = match.away || '';
    pct.textContent = '(' + conf + '%)';
    predTxt.appendChild(pct);
  } else {
    predTxt.textContent = base + (conf ? ' (' + conf + '%)' : '');
  }
  detailTxt.textContent = ia.quip || '';
  barEl.style.display = '';
}

// Post-F commit 3 — HTML del tooltip explainer. Narrativa 1-2 frases segun
// sign/is_host/diferencia ELO + lista de datos crudos. Fallbacks suaves:
// h2h_total=0 → "Sin partidos previos" (en vez de "0W-0D-0L"); form_*_ppg
// de alguno de los dos lados === 1 → omitir linea de forma (indicador del
// fallback n_matches=0 del motor).
function buildIAExplainer(ia, homeName, awayName) {
  const signMap = { '1': 'Local', 'X': 'Empate', '2': 'Visitante' };
  const signLabel = signMap[ia.sign] || ia.sign;
  const conf = ia.confidence || 0;
  const eloH = ia.elo_home_raw;
  const eloA = ia.elo_away_raw;
  const eloDiff = eloH - eloA; // positivo = home mas fuerte
  let narrative = '';
  if (ia.sign === 'X') {
    narrative = 'Partido igualado: ELO cercanos y fuerzas parejas.';
  } else if (ia.sign === '1') {
    if (ia.is_host && eloDiff > 0) {
      narrative = 'Local parte con ventaja: juega en casa y ELO superior.';
    } else if (ia.is_host) {
      narrative = 'El local aprovecha jugar en casa pese a ELO parejo.';
    } else if (eloDiff > 100) {
      narrative = 'Local claro favorito por diferencia de nivel.';
    } else {
      narrative = 'Local favorito por poco margen en el modelo.';
    }
  } else { // '2'
    if (eloDiff < -100) {
      narrative = 'Visitante claro favorito por diferencia de nivel.';
    } else {
      narrative = 'Visitante parte ligeramente por encima en el modelo.';
    }
  }
  const items = [];
  const esc = (typeof escapeHtml === 'function') ? escapeHtml : ((s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  items.push('<li>ELO: ' + esc(homeName) + ' ' + eloH + ' vs ' + esc(awayName) + ' ' + eloA + '</li>');
  if (ia.h2h_total === 0) {
    items.push('<li>Sin partidos previos entre ambas</li>');
  } else {
    items.push('<li>H2H: ' + ia.h2h_home_wins + 'W-' + ia.h2h_draws + 'D-' + ia.h2h_away_wins + 'L en ' + ia.h2h_total + ' partidos</li>');
  }
  const homeF = ia.form_home_ppg;
  const awayF = ia.form_away_ppg;
  if (typeof homeF === 'number' && typeof awayF === 'number' && homeF !== 1 && awayF !== 1) {
    items.push('<li>Forma: ' + homeF.toFixed(2) + ' vs ' + awayF.toFixed(2) + ' pts/partido</li>');
  }
  if (ia.is_host) {
    items.push('<li>Jugando en casa (' + esc(homeName) + ' es anfitrion)</li>');
  }
  return (
    '<div class="ia-exp-title">Por qué ' + esc(signLabel) + ' (' + conf + '%)</div>' +
    '<p class="ia-exp-narrative">' + esc(narrative) + '</p>' +
    '<ul class="ia-exp-data">' + items.join('') + '</ul>'
  );
}

// F-05 — Tooltip generico "Cómo funciona IA Predice". Singleton popover en
// body, posicionado bajo el botón clickado. Cierre al click fuera, al click
// en el mismo botón, o ESC. Texto fijo (resumen del docs/ia-predictor.md).
function showIAInfoTooltip(btn) {
  var pop = document.getElementById('ia-info-tooltip');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'ia-info-tooltip';
    pop.className = 'ia-info-tooltip';
    pop.innerHTML =
      '<div class="ia-info-tooltip__title">¿Cómo funciona la IA?</div>' +
      '<p class="ia-info-tooltip__text">La predicción combina tres señales: ' +
      '<b>ELO FIFA</b> (75%), <b>historial directo</b> entre ambas selecciones (10%) ' +
      'y <b>forma reciente</b> de los últimos partidos (15%). Se aplica una ventaja ' +
      'extra al país anfitrión. El porcentaje indica la confianza del modelo en el ' +
      'signo predicho (1, X o 2).</p>' +
      '<p class="ia-info-tooltip__text">Si pronosticas distinto a la IA y aciertas, ' +
      'recibes un <b>+1 punto extra</b>.</p>';
    document.body.appendChild(pop);
    document.addEventListener('click', function (e) {
      if (!pop.classList.contains('is-open')) return;
      if (e.target === pop || pop.contains(e.target)) return;
      if (e.target.classList && e.target.classList.contains('ia-info-btn')) return;
      pop.classList.remove('is-open');
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') pop.classList.remove('is-open');
    });
  }
  if (pop.classList.contains('is-open') && pop._anchor === btn) {
    pop.classList.remove('is-open');
    pop._anchor = null;
    return;
  }
  pop._anchor = btn;
  var r = btn.getBoundingClientRect();
  pop.style.top = (window.scrollY + r.bottom + 6) + 'px';
  var left = window.scrollX + r.left - 4;
  pop.style.left = Math.max(8, Math.min(left, window.scrollX + window.innerWidth - 268)) + 'px';
  pop.classList.add('is-open');
}
window.showIAInfoTooltip = showIAInfoTooltip;

// Post-F commit 3 — handlers globales del popover explainer. Singleton DOM
// en <body>, event delegation por document. Hover en desktop (matchMedia
// '(hover:hover)'), click en mobile. Cierre: click fuera, click en mismo
// trigger, o scroll > 20px (gesture explicito del usuario).
function setupIAExplainerOnce() {
  if (window._iaExplainerReady) return;
  window._iaExplainerReady = true;
  const pop = document.createElement('div');
  pop.className = 'ia-explainer';
  pop.id = 'ia-explainer-popover';
  pop.style.display = 'none';
  document.body.appendChild(pop);
  const mm = window.matchMedia && window.matchMedia('(hover: hover)');
  const isHover = !!(mm && mm.matches);
  let activeTrigger = null;
  let startScrollY = 0;
  function showFor(trigger) {
    const key = trigger.dataset.matchKey;
    const ia = (window.iaPredictions || iaPredictions)[key];
    if (!ia) return;
    pop.innerHTML = buildIAExplainer(ia, trigger.dataset.home, trigger.dataset.away);
    pop.style.display = 'block';
    positionPopover(pop, trigger);
    activeTrigger = trigger;
    startScrollY = window.scrollY;
  }
  function hide() {
    pop.style.display = 'none';
    pop.innerHTML = '';
    activeTrigger = null;
  }
  function positionPopover(el, trigger) {
    const r = trigger.getBoundingClientRect();
    const maxW = 280;
    const pad = 8;
    const vw = window.innerWidth;
    el.style.position = 'fixed';
    el.style.maxWidth = maxW + 'px';
    const left = Math.min(Math.max(pad, r.left + r.width / 2 - maxW / 2), vw - maxW - pad);
    el.style.left = left + 'px';
    el.style.top = (r.bottom + pad) + 'px';
    // Si se sale por abajo, invertir hacia arriba
    requestAnimationFrame(() => {
      const pr = el.getBoundingClientRect();
      if (pr.bottom > window.innerHeight - pad) {
        el.style.top = Math.max(pad, r.top - pr.height - pad) + 'px';
      }
    });
  }
  if (isHover) {
    // Desktop: hover para mostrar/ocultar
    document.addEventListener('mouseover', (e) => {
      const t = e.target && e.target.closest ? e.target.closest('.ia-pct-trigger') : null;
      if (t && t !== activeTrigger) showFor(t);
    });
    document.addEventListener('mouseout', (e) => {
      const t = e.target && e.target.closest ? e.target.closest('.ia-pct-trigger') : null;
      if (!t || !activeTrigger) return;
      // Cerrar cuando el mouse sale del trigger a algo que no sea el popover
      const rel = e.relatedTarget;
      if (rel && (t.contains(rel) || pop.contains(rel))) return;
      hide();
    });
  } else {
    // Mobile: click toggle + click fuera cierra
    document.addEventListener('click', (e) => {
      const t = e.target && e.target.closest ? e.target.closest('.ia-pct-trigger') : null;
      if (t) {
        e.preventDefault();
        e.stopPropagation();
        if (activeTrigger === t) hide();
        else showFor(t);
        return;
      }
      if (activeTrigger && !pop.contains(e.target)) hide();
    }, true);
  }
  // Teclado accesibilidad: Enter/Espacio sobre trigger
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target && e.target.closest ? e.target.closest('.ia-pct-trigger') : null;
    if (!t) return;
    e.preventDefault();
    if (activeTrigger === t) hide();
    else showFor(t);
  });
  // Scroll > 20px → cerrar (gesture explicito)
  window.addEventListener('scroll', () => {
    if (activeTrigger && Math.abs(window.scrollY - startScrollY) > 20) hide();
  }, { passive: true });
  // Resize también cierra para evitar posicionamiento stale
  window.addEventListener('resize', () => { if (activeTrigger) hide(); });
}

  // ─────────────────────────────────────────────────────────────
  // EVENTOS DE TARJETA — attachEvents, updateCardUI,
  //   updateGlobalPoints, checkKitConflict
  // ─────────────────────────────────────────────────────────────
function attachEvents(card, idx, match) {
  // Si la porra está cerrada, renderizar estado pero sin eventos de edición
  /* ── Boost: lógica de check ── */
  const _boostRow = card.querySelector('.boost-row');
  const _boostChk = card.querySelector('.boost-chk');
  const _boostDate = match.date ? match.date.substring(0, 10) : null;

  if (_boostRow && _boostChk && _boostDate) {
    // Restaurar estado guardado
    if (boostPicks[_boostDate] === getMatchKey(match)) {
      _boostChk.checked = true;
      _boostRow.classList.add('boost-on');
      card.classList.add('boost-active');
    } else if (boostPicks[_boostDate]) {
      // Otro partido ya tiene el boost de este día → desactivar check
      _boostChk.disabled = true;
      _boostRow.style.opacity = '0.45';
      _boostRow.title = 'Boost del día ya asignado';
    }

    _boostChk.addEventListener('change', () => {
      if (_boostChk.checked) {
        // Si había boost asignado a otro partido hoy, quitárselo
        const prevKey = boostPicks[_boostDate];
        if (prevKey && prevKey !== getMatchKey(match)) {
          document.querySelectorAll('.card').forEach(otherCard => {
            const oi = otherCard.getAttribute('data-match-idx');
            if (oi === null) return;
            const om = PARTIDOS[Number(oi)];
            if (!om || getMatchKey(om) !== prevKey) return;
            const oc = otherCard.querySelector('.boost-chk');
            const or = otherCard.querySelector('.boost-row');
            if (oc) { oc.checked = false; oc.disabled = false; }
            if (or) { or.classList.remove('boost-on'); or.style.opacity = ''; or.removeAttribute('title'); }
            otherCard.classList.remove('boost-active');
          });
        }
        boostPicks[_boostDate] = getMatchKey(match);
        _boostRow.classList.add('boost-on');
        card.classList.add('boost-active');
      } else {
        delete boostPicks[_boostDate];
        _boostRow.classList.remove('boost-on');
        card.classList.remove('boost-active');
        // Re-habilitar todos los checks del mismo día
        document.querySelectorAll('.card').forEach(otherCard => {
          const oi = otherCard.getAttribute('data-match-idx');
          if (oi === null) return;
          const om = PARTIDOS[Number(oi)];
          if (!om || om.date?.substring(0,10) !== _boostDate) return;
          const oc = otherCard.querySelector('.boost-chk');
          const or = otherCard.querySelector('.boost-row');
          if (oc) { oc.disabled = false; }
          if (or) { or.style.opacity = ''; or.removeAttribute('title'); }
        });
      }
      saveBoostPicks();
      checkFinalizarReady?.();
      // Re-activar ticker y CTA tras cambio desde check de tarjeta
      if (typeof renderBoostTicker === 'function') renderBoostTicker();
      if (typeof checkGroupsComplete === 'function') checkGroupsComplete();
    });
  }

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
  const estado = getEstadoPartido(match);
  card.querySelectorAll('.sbn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pred = predictions[matchKey]; // leer en tiempo real — no capturar en closure
      if(!pred || pred.saved || pred.lockedByUser) return;
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
    const pred = predictions[matchKey]; // leer en tiempo real
    if(!pred || pred.saved || pred.lockedByUser) return;
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

  // La .ia-bar se hidrata desde iaPredictions (populado por loadIAPredictions
  // en auth.js durante el bootstrap) via hydrateIABar en renderMatchCard y
  // updateCardUI. No hay fetch del lado cliente.
  // Aplicar estado visual correcto desde el primer render (chips, botón, gsel)
  updateCardUI(idx, match);
}

function updateCardUI(idx, match) {
  const matchKey = getMatchKey(match);
  const pred = predictions[matchKey];
  const estado = getEstadoPartido(match);
  const hasScore = (pred.l !== null && pred.v !== null);
  const hasGoal = !!pred.gol;
  const ia = iaPredictions[matchKey];
  const mySign = getMySign(pred);

  // Refrescar .ia-bar por si el bootstrap la ha rellenado tarde (auth.js post-login)
  hydrateIABar(idx, matchKey, match);

  const pill = document.getElementById(`spill-${idx}`);
  const stxt = document.getElementById(`stxt-${idx}`);
  if (!pill || !stxt) return;
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
      btnRow.innerHTML=`<div class="saved-group"><div class="saved-badge" style="background:#16a34a;color:#fff;border-radius:8px;padding:3px 10px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:6px;white-space:nowrap">✓ Guardado</div><button class="btn-undo" data-idx="${idx}" style="${undoVisible}">↩ Deshacer</button></div>`;
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
        // ERR-30: re-habilitar interacción tras deshacer en focus mobile.
        // Sincronización con league_members.groups_saved queda pendiente (deuda
        // documentada en errores_conocidos_porra.md). Se aborda en F7.4-F.
        if (window.groupSaved) delete window.groupSaved[match.group];
        if (typeof window.unlockCardsInFocus === 'function') window.unlockCardsInFocus(match.group);
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

  const extractUrl = bg => { const m = bg.match(/url\(['"]?([^'")\s]+)['"]?\)/); return m ? m[1] : ''; };
  const hUrl = extractUrl(hKitEl.style.backgroundImage);
  const aUrl = extractUrl(aKitEl.style.backgroundImage);

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
  // Guard: si la vista activa no es Grupos (no hay #groups-container en el DOM),
  // saltar el render pero respetar el callback para que el caller continúe su flujo.
  // Evita "Cannot set properties of null" cuando se invoca desde Jornada/Directo/KO.
  if (!container) { if (typeof onComplete === 'function') onComplete(); return; }
  container.innerHTML = '';
  // Sprint B · top chips A-L (sticky letterbar)
  if (typeof window._renderGruposLetterBar === 'function') window._renderGruposLetterBar();
  // Renderizar grupo a grupo con setTimeout(0) para no bloquear el hilo principal
  // Permite que el navegador procese eventos entre grupos
  let i = 0;
  function renderNextGroup() {
    if(i >= GRUPOS.length) { if(onComplete) onComplete(); return; }
    const grupo = GRUPOS[i++];
    const partidosGrupo = PARTIDOS.filter(p => p.group === grupo.letra);
    // Sprint B · card colapsable A-L con grid+gtable hidden dentro
    const doneCount = partidosGrupo.filter(m => {
      const p = predictions[getMatchKey(m)];
      return p && p.l != null && p.v != null;
    }).length;
    let section;
    if (typeof window._renderGruposCardShell === 'function') {
      section = window._renderGruposCardShell(grupo.letra, { done: doneCount, total: partidosGrupo.length });
    }
    if (!section) {
      // fallback al layout legacy si el shell no está cargado
      section = document.createElement('div');
      section.className = 'group-section';
      section.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><h2 style="margin:0">Grupo ${grupo.letra}</h2><button class="dice-btn" onclick="diceSimulateGroup('${grupo.letra}')"><span class="dice-icon">🎲</span> Simular grupo ${grupo.letra}</button></div><div class="group-layout"><div class="cards-grid" id="grid-${grupo.letra}"></div><div id="gtable-${grupo.letra}" class="group-table-card"></div></div>`;
    }
    container.appendChild(section);
    const grid = section.querySelector('#grid-' + grupo.letra) || section.querySelector('.cards-grid');
    partidosGrupo.forEach((match) => {
      const globalIdx = PARTIDOS.findIndex(p => p === match);
      const card = createMatchCard(match, globalIdx);
      grid.appendChild(card);
      attachEvents(card, globalIdx, match);
    });
    renderGroupTableCard(grupo.letra);
    // Sprint B · El carrusel expandido se construye on-demand en
    // _toggleGruposExpanded (click en el header del card) e inserta
    // como SIBLING de la card. Las tarjetas editables creadas por
    // createMatchCard quedan en hidden #grid-{letra} para que el modal
    // editable las extraiga preservando listeners de attachEvents.
    // Bloquear tarjetas si porra cerrada, justo después de renderizar
    if (window._porraCerrada) requestAnimationFrame(() => lockAllCardsIfCerrada());
    // Sprint B · gate mobile-focus-layer: el carrusel scroll-snap ya da la
    // experiencia equivalente. Evita double-wrap de los Elements de card.
    const isMobile = (typeof window.matchMedia === 'function') && window.matchMedia('(max-width: 640px)').matches;
    if (!isMobile && typeof window.applyMobileGroupCollapse === 'function') {
      window.applyMobileGroupCollapse(section, grupo.letra);
    }
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

// Polish v1 Fix-Pack-2 Fix-3+4: arrays hardcoded AW_PLAYERS (22) y
// YOUNG_PLAYERS_NXGN (50) ELIMINADOS. Candidatos ahora se computan
// dinámicamente desde BD: ia_elo_fifa (rank por selección) + squads
// (jugadores JSONB con nombre, posicion bucket, edad, club). Ver
// getAwardCandidates(award) abajo. window.AW_PLAYERS y
// window.YOUNG_PLAYERS_NXGN ya NO se exponen — auth.js loadUserData
// resuelve via getAwardCandidates.

window.AWARDS_CFG         = AWARDS_CFG;

// Sprint Combos & Awards (PR#1 F1+F2) — helpers de keys de jugadores.
// Formato corto acordado con San (28-may): apellido sin diacríticos. Para
// preservar scorers históricos guardados en BD (Mbappe, Kane, Yamal, etc.)
// que ya existen en EQUIPOS[].players, hacemos lookup primero ahí. Si el
// jugador no está, fallback al último token sin diacríticos. Anti-colisión
// resuelta a nivel squad por resolveKeysForSquad — añade "I. " (inicial+
// punto+espacio) cuando dos jugadores del mismo iso3 colapsan al mismo
// apellido (ej: B. Iglesias / I. Iglesias).
function playerToShortKey(nombre, iso3) {
  if (!nombre) return '';
  // 1. Match exacto en EQUIPOS[iso3].players[].name → devolver .key
  //    (preserva scorers de partidas históricas).
  if (typeof EQUIPOS !== 'undefined') {
    const eq = EQUIPOS.find(e => e.flag === iso3);
    if (eq && Array.isArray(eq.players)) {
      const hit = eq.players.find(p => p.name && p.name.includes(nombre));
      if (hit) return hit.key;
    }
  }
  // 2. Fallback: último token sin diacríticos. ̀-ͯ = bloque
  //    Unicode "Combining Diacritical Marks" producido por NFD.
  const norm = String(nombre).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const parts = norm.trim().split(/\s+/);
  return parts[parts.length - 1] || '';
}
window.playerToShortKey = playerToShortKey;

// Dado un array de jugadores del mismo iso3, devuelve [{j, key}] con keys
// únicos dentro del squad. Si dos jugadores producen el mismo key, ambos
// reciben "Inicial. Apellido" (ej: "B. Iglesias", "I. Iglesias").
function resolveKeysForSquad(jugadores, iso3) {
  if (!Array.isArray(jugadores)) return [];
  const tentative = jugadores.map(j => ({
    j, key: playerToShortKey(j.nombre, iso3),
  }));
  const counts = {};
  tentative.forEach(t => { counts[t.key] = (counts[t.key] || 0) + 1; });
  return tentative.map(t => {
    if (counts[t.key] > 1) {
      const first = String(t.j.nombre || '').trim().split(/\s+/)[0];
      const initial = first ? first.charAt(0).toUpperCase() : '';
      return { j: t.j, key: initial ? (initial + '. ' + t.key) : t.key };
    }
    return t;
  });
}
window.resolveKeysForSquad = resolveKeysForSquad;

// Sprint Combos & Awards (F1) — candidates dinámicos por iso3 para el picker
// de goleador en grupos+KO. Lee squads.jugadores con xi_pinned=true; fallback
// a EQUIPOS[].players legacy si BD no disponible o squad sin pin.
let _scorerCandidatesCache = {};
window._scorerCandidatesCache = _scorerCandidatesCache;

function _fallbackScorerFromEquipos(iso3) {
  if (typeof EQUIPOS === 'undefined') return [];
  const eq = EQUIPOS.find(e => e.flag === iso3);
  if (!eq || !Array.isArray(eq.players)) return [];
  return eq.players.map(p => ({
    key: p.key,
    name: p.name,
    bucket: null,
    foto_url: null,
    dorsal: 999,
  }));
}

async function getScorerCandidates(iso3) {
  if (!iso3) return [];
  if (_scorerCandidatesCache[iso3]) return _scorerCandidatesCache[iso3];
  if (typeof db === 'undefined' || !db) {
    const fb = _fallbackScorerFromEquipos(iso3);
    _scorerCandidatesCache[iso3] = fb;
    return fb;
  }
  let row = null;
  try {
    const { data, error } = await db
      .from('squads')
      .select('iso3, jugadores, xi_pinned')
      .eq('iso3', iso3)
      .limit(1)
      .maybeSingle();
    if (error) console.warn('[scorer-candidates] error iso3=' + iso3, error);
    row = data;
  } catch (e) {
    console.warn('[scorer-candidates] exception iso3=' + iso3, e);
  }

  let candidates;
  if (!row || !row.xi_pinned || !Array.isArray(row.jugadores) || !row.jugadores.length) {
    candidates = _fallbackScorerFromEquipos(iso3);
  } else {
    const resolved = resolveKeysForSquad(row.jugadores, iso3);
    candidates = resolved.map(({ j, key }) => {
      const dorsal = (typeof j.dorsal === 'number' && j.dorsal > 0) ? j.dorsal : 999;
      const nombre = j.nombre || '';
      // name preserva formato "dorsal · nombre" del legacy para consistencia
      // visual con EQUIPOS[].players.name. Si no hay dorsal real, omitimos.
      const display = (dorsal !== 999) ? (dorsal + ' · ' + nombre) : nombre;
      // foto_url + posicion_tm se incluyen pero NO se renderizan en el picker
      // scorer (decisión San 28-may). Reservados para sprints futuros:
      // Pizarra Táctica sobre el campo + vista Plantilla estilo Transfermarkt.
      return {
        key,
        name: display,
        bucket: j.posicion || null,
        posicion_tm: j.posicion_tm || null,
        foto_url: j.foto_url || j.foto_url_tm || null,
        dorsal,
      };
    }).sort((a, b) => a.dorsal - b.dorsal || (a.name || '').localeCompare(b.name || ''));
  }
  _scorerCandidatesCache[iso3] = candidates;
  return candidates;
}
window.getScorerCandidates = getScorerCandidates;

// Polish v1 Fix-Pack-2 Fix-3+4: cache de candidatos por award.
// Llave 'golden_ball' | 'golden_boot' | 'golden_glove' | 'young_player'.
// Pre-cargada en background al render de awards card (setTimeout 100ms);
// usada por openPicker async + selectAward + _v3SuggestGoldenBoot +
// auth.js loadUserData.
let _awardCandidatesCache = {};
window._awardCandidatesCache = _awardCandidatesCache;

function _bucketToRole(bucket) {
  switch (bucket) {
    case 'Portero':        return 'gk';
    case 'Defensa':        return 'df';
    case 'Centrocampista': return 'mf';
    case 'Delantero':      return 'fw';
    default: return null;
  }
}

// Criterios por award (matriz acordada con San):
// - golden_ball:  top 20 selecciones Elo, cualquier rol.
// - golden_boot:  top 30 Elo, bucket IN (Centrocampista, Delantero).
// - golden_glove: top 30 Elo, bucket = Portero.
// - young_player: top 30 Elo, edad ≤ 21 (Transfermarkt enrich-tm).
// Ordenado por (rank Elo asc, name asc). Cacheado por award.
async function getAwardCandidates(award) {
  if (_awardCandidatesCache[award]) return _awardCandidatesCache[award];
  if (typeof db === 'undefined' || !db) {
    console.warn('[awards] BD no disponible');
    return [];
  }
  const topN = (award === 'golden_ball') ? 20 : 30;
  const { data: topTeams, error: eloErr } = await db
    .from('ia_elo_fifa')
    .select('team_code, team_name, rank_position')
    .order('rank_position', { ascending: true })
    .limit(topN);
  if (eloErr || !topTeams) { console.warn('[awards] error Elo:', eloErr); return []; }
  const topCodes = topTeams.map(t => t.team_code);
  const teamNameByCode = {};
  const rankByCode = {};
  topTeams.forEach(t => {
    teamNameByCode[t.team_code] = t.team_name;
    rankByCode[t.team_code] = t.rank_position;
  });
  const { data: squadsData, error: sqErr } = await db
    .from('squads')
    .select('iso3, jugadores')
    .in('iso3', topCodes);
  if (sqErr || !squadsData) { console.warn('[awards] error squads:', sqErr); return []; }

  // Sprint Combos & Awards (F2) — unificar keys con el picker de scorer.
  // resolveKeysForSquad aplica anti-colisión por iso3 (I. + apellido) y
  // playerToShortKey resuelve a la key corta (Mbappe, Kane, Yamal...). Si
  // el jugador ya está en EQUIPOS[].players, devuelve su .key histórica
  // para preservar award_picks guardados antes del refactor.
  const players = [];
  squadsData.forEach(squad => {
    const arr = Array.isArray(squad.jugadores) ? squad.jugadores : [];
    const resolved = resolveKeysForSquad(arr, squad.iso3);
    resolved.forEach(({ j, key }) => {
      players.push({
        key,
        name: j.nombre,
        teamName: teamNameByCode[squad.iso3] || squad.iso3,
        flag: squad.iso3,
        role: _bucketToRole(j.posicion),
        bucket: j.posicion,
        edad: (typeof j.edad === 'number') ? j.edad : (j.edad ? Number(j.edad) : null),
        club: j.club,
        foto_url: j.foto_url || null,
        rank: rankByCode[squad.iso3] || 999,
      });
    });
  });

  let filtered;
  switch (award) {
    case 'golden_ball':  filtered = players; break;
    case 'golden_boot':  filtered = players.filter(p => p.bucket === 'Centrocampista' || p.bucket === 'Delantero'); break;
    case 'golden_glove': filtered = players.filter(p => p.bucket === 'Portero'); break;
    case 'young_player': filtered = players.filter(p => typeof p.edad === 'number' && p.edad <= 21); break;
    default: filtered = [];
  }
  filtered.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return (a.name || '').localeCompare(b.name || '');
  });
  _awardCandidatesCache[award] = filtered;
  return filtered;
}
window.getAwardCandidates = getAwardCandidates;
const awPicks={golden_ball:null,golden_boot:null,golden_glove:null,young_player:null};
let currentAward=null;
// Polish v1 Fix-Pack-2 Fix-3+4: openPicker ahora es async porque
// getAwardCandidates consulta BD (ia_elo_fifa + squads). Muestra
// indicador "Cargando jugadores…" hasta que llegan los datos.
// Cache _awardCandidatesCache evita re-fetch tras primera apertura.
async function openPicker(award) {
  console.log('[awards] openPicker called', award);
  currentAward = award;
  const cfg = {
    golden_ball:  { title: '🏆 Balón de Oro — MVP' },
    golden_boot:  { title: '👟 Bota de Oro — Máx. goleador' },
    golden_glove: { title: '🧤 Guante de Oro — Mejor portero' },
    young_player: { title: '⭐ Mejor Joven ≤21' },
  }[award];
  if (!cfg) { console.warn('[awards] award key desconocida', award); return; }
  const titleEl = document.getElementById('picker-title');
  const overlayEl = document.getElementById('aw-overlay');
  if (!overlayEl) { console.error('[awards] #aw-overlay no existe en el DOM'); return; }
  if (titleEl) titleEl.textContent = cfg.title;
  // F-02 hardening: forzar visibilidad inline por si algún ancestro/style
  // override tiene display:none o pointer-events:none. La clase .open ya
  // gestiona opacity+pointer-events pero algunos containers (page-elim,
  // modal-overlay parent) pueden tener overrides que la pisen.
  overlayEl.style.display = 'flex';
  overlayEl.style.opacity = '1';
  overlayEl.style.pointerEvents = 'auto';
  overlayEl.classList.add('open');
  console.log('[awards] overlay opened, computedStyle.display=',
    window.getComputedStyle(overlayEl).display, 'z-index=',
    window.getComputedStyle(overlayEl).zIndex);
  const scroll = document.getElementById('picker-scroll');
  if (scroll) scroll.innerHTML = '<div style="padding:24px 18px;color:#94a3b8;font-size:13px">Cargando jugadores…</div>';
  const candidates = await getAwardCandidates(award);
  console.log('[awards] candidates loaded', award, candidates.length);
  if (currentAward !== award) return;
  // F4 (rediseño PR #112): top 3 goleadores del usuario para la sección "Tus
  // goleadores" — solo golden_boot. Sin gating: se muestra siempre que haya
  // datos, también con pick previo (permite cambiarlo de un toque). Re-validar
  // currentAward tras el await (round-trip a BD) por si el usuario navegó.
  let topScorers = [];
  if (award === 'golden_boot' && typeof _v3SuggestGoldenBoot === 'function') {
    topScorers = await _v3SuggestGoldenBoot();
    if (currentAward !== award) return;
  }
  if (!candidates.length) {
    if (scroll) scroll.innerHTML = '<div style="padding:24px 18px;color:#94a3b8;font-size:13px;font-style:italic">No hay candidatos disponibles. Las convocatorias se completarán hasta el 2 de junio.</div>';
    return;
  }
  renderPickerList(candidates, awPicks[award]);
  // F4 (rediseño PR #112): inyectar la sección "Tus goleadores" al inicio del
  // scroll, tras renderPickerList (que setea innerHTML). Solo golden_boot con
  // datos. Las filas reutilizan selectAward (selecciona + cierra picker).
  if (award === 'golden_boot' && Array.isArray(topScorers) && topScorers.length && scroll) {
    scroll.insertAdjacentHTML('afterbegin', _buildTopScorersHtml(topScorers, candidates));
  }
}
// F4 (rediseño PR #112 + fix huérfano): HTML de la sección "Tus goleadores"
// (top 3) inyectada al inicio del picker golden_boot. Filtra los scorers a
// candidatos válidos de Bota (un goleador de selección fuera del top-30 Elo o
// sin bucket ofensivo no es seleccionable, y clicarlo no haría nada) y recorta
// a 3 — la RPC pide top 5 para tener margen. Si no queda ninguno válido,
// devuelve '' (sin sección). displayName = c.name del candidato. Click →
// selectAward(key) (selecciona + cierra picker), igual que las filas normales.
function _buildTopScorersHtml(topScorers, candidates) {
  const nameByKey = {};
  const candidateKeys = new Set();
  (candidates || []).forEach(c => { nameByKey[c.key] = c.name; candidateKeys.add(c.key); });
  const filteredTop = (topScorers || [])
    .filter(t => candidateKeys.has(t.scorer_key))
    .slice(0, 3);
  if (!filteredTop.length) return '';
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const escAttr = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const rows = filteredTop.map((t) => {
    const display = nameByKey[t.scorer_key] || t.scorer_key;
    const goles = t.n + (t.n === 1 ? ' gol' : ' goles');
    return `<div class="aw-top-scorer-row" onclick="selectAward('${escAttr(t.scorer_key)}')">
        <span class="aw-top-scorer-name">${esc(display)}</span>
        <span class="aw-top-scorer-count">${esc(goles)}</span>
      </div>`;
  }).join('');
  return `<div class="aw-top-scorers">
      <div class="aw-top-scorers-header">Tus goleadores</div>
      ${rows}
      <div class="aw-top-scorers-separator"></div>
    </div>`;
}
function closePicker() {
  const overlayEl = document.getElementById('aw-overlay');
  if (overlayEl) {
    overlayEl.classList.remove('open');
    overlayEl.style.removeProperty('display');
    overlayEl.style.removeProperty('opacity');
    overlayEl.style.removeProperty('pointer-events');
  }
  currentAward = null;
}
window.openPicker = openPicker;
window.closePicker = closePicker;

// F-02 hardening (QA round 2): delegate global a nivel document para clicks
// en .aw-slot. El handler delegado de ko.js renderAwardsBox4Legacy se
// registra solo si !awSaved && !window._porraCerrada y vive ligado al
// elemento #aw-grid-v3 (se pierde si box4.innerHTML se re-renderiza desde
// fuera). Este delegate one-time captura el click venga de donde venga.
// QA round 4: _awPicksSaved NO debe bloquear el click — el usuario tiene
// derecho a editar awards hasta que se cierre la porra. Sólo blockear si
// _porraCerrada=true.
if (!window._awardSlotDelegateBound) {
  window._awardSlotDelegateBound = true;
  document.addEventListener('click', function (e) {
    var slot = e.target && e.target.closest && e.target.closest('.aw-slot');
    if (!slot) return;
    var award = slot.getAttribute('data-award');
    if (!award) return;
    if (window._porraCerrada) return;
    console.log('[awards] aw-slot click delegate →', award);
    openPicker(award);
  }, true);
}
function overlayClick(e){if(e.target===document.getElementById('aw-overlay'))closePicker();}
// Polish v1 Fix-Pack-2 Fix-3+4: selectAward usa _awardCandidatesCache
// (poblado por openPicker async) en lugar de AW_PLAYERS/YOUNG_PLAYERS_NXGN
// arrays eliminados. Cache garantizado porque selectAward solo se invoca
// desde click en row del picker, que solo se renderiza tras openPicker.
function selectAward(playerKey) {
  if (!currentAward) return;
  const list = _awardCandidatesCache[currentAward] || [];
  const player = list.find(p => p.key === playerKey);
  if (!player) { console.warn('[awards] player no encontrado en cache:', playerKey); return; }
  awPicks[currentAward] = player;
  window._awPicksSaved = false; // requiere guardar de nuevo
  // Actualizar slot visual
  const slot = document.querySelector('[data-award="' + currentAward + '"]');
  if (slot) {
    slot.classList.add('selected');
    const nameEl = document.getElementById('sel-name-' + currentAward);
    const teamEl = document.getElementById('sel-team-' + currentAward);
    const flagEl = document.getElementById('sel-flag-' + currentAward);
    if (nameEl) nameEl.textContent = player.name;
    if (teamEl) teamEl.textContent = player.teamName || '';
    if (flagEl) flagEl.src = SB + '/flags/' + player.flag + '.png';
  }
  updateAwardsFooter();
  closePicker();
  if (typeof saveAwPicks === 'function') saveAwPicks();
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
  // Polish v1 Fix-Pack-2 Fix-3+4: precarga de las 4 listas de candidatos
  // (BD-driven). setTimeout para no bloquear el render inicial.
  setTimeout(() => {
    ['golden_ball', 'golden_boot', 'golden_glove', 'young_player'].forEach(a => {
      getAwardCandidates(a).catch(e => console.warn('[awards] precarga', a, e));
    });
  }, 100);
}

// HF-CdH-01: exposición global de FINAL_CLASSIFICATION_PTS para que el render
// del Cuadro de Honor v3 (eliminatoria-v3.js) pueda leer los chips +30/+20/+15/+10.
// FINAL_CLASSIFICATION_PTS se declara con `const` top-level (línea 30), que en
// classic scripts NO se expone como window.* (ver .claude/rules/frontend-js.md
// "var vs const top-level").
if (typeof window !== 'undefined') {
  window.FINAL_CLASSIFICATION_PTS = FINAL_CLASSIFICATION_PTS;
}

