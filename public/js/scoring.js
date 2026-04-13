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
// +3 marcador exacto (incluye el signo, no acumula con +1)
// +2 goleador correcto
// +1 bonus vs IA (tu signo difiere de la IA y aciertas)
// Máximo: 7 pts por partido
function calcMatchPoints(pred, realL, realR, matchKey) {
  if(!pred || !pred.saved) return 0;
  let pts = 0;

  const isExact = pred.l === realL && pred.v === realR;

  // Signo y exacto
  if(isExact) {
    pts += 3; // exacto (ya incluye el punto de signo)
  } else if(Math.sign(pred.l - pred.v) === Math.sign(realL - realR)) {
    pts += 1; // solo signo
  }

  // Goleador
  if(pred.gol && realL !== realR) {
    const winnerTeam = realL > realR ? pred.home : pred.away;
    const team = EQUIPOS.find(e => e.name === winnerTeam);
    const realScorer = team?.players?.[0]?.key || null;
    if(realScorer && pred.gol === realScorer) pts += 2;
  }

  // Bonus vs IA
  if(iaBonusWillApply(matchKey, pred, realL, realR)) pts += 1;

  pts = Math.min(pts, 7);

  // Boost x2: si este partido es el boost del día Y se acertó el exacto
  if(isExact && matchKey) {
    const matchDate = PARTIDOS.find(m => getMatchKey(m) === matchKey)?.date?.substring(0,10);
    if(matchDate && boostPicks[matchDate] === matchKey) {
      pts *= 2; // máximo 14 pts
    }
  }

  return pts;
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
const _boostObserver = new MutationObserver(function() {
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
    '</div>',
    /* ── Fila Boost (dentro de card-inner, encima del footer) ── */
    '<div class="boost-row" id="boost-row-'+idx+'">',
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

