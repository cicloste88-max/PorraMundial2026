/* bracket-results.js — Porra Mundial 2026
   Vista de resultados reales del bracket KO: timeline vertical + live hero.
   Lee: window.BRACKET (ko.js), window.EQUIPOS (data.js), window.resolvedSlots
   Expone: window.initBracketResults, window.refreshBracketResults, window.brkSetPhase
*/

const BRK_SB = 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures';

// Badge map: slug equipo → fichero badge sin .png (null = sin badge)
const BRK_BADGE_MAP = {
  'spain':'spain','germany':'germany','france':'france','brazil':'brazil',
  'england':'england','netherlands':'netherlands','portugal':'portugal',
  'argentina':'argentina','uruguay':'uruguay','saudi-arabia':'saudi-arabia',
  'morocco':'morocco','japan':'japan','australia':'australia','usa':'united-states',
  'belgium':'belgium','colombia':'colombia','croatia':'croatia',
  'switzerland':'switzerland','canada':'canada','south-korea':'south-korea',
  'ghana':'ghana','tunisia':'tunisia','panama':'panama','norway':'norway',
  'ecuador':'ecuador','senegal':'senegal','mexico':'mexico','qatar':'qatar',
  'egypt':'egypt','uzbekistan':'uzbekistan','algeria':'algeria',
  'cape-verde':'cape-verde','curacao':'curacao','haiti':'haiti',
  'jordan':'jordan','new-zealand':'new-zealand','south-africa':'south-africa',
  'ivory-coast':'ivory-coast','iran':'iran','austria':'austria',
  'paraguay':'paraguay','scotland':'scotland',
  'nigeria':null,'drc-jam':null,'irak':null,'bosnia':null,
  'turkey':null,'sweden':null,'czech':null,
};

// Fases reales del bracket KO (4 rondas + 3er puesto + final).
// `path` es la clave en window.BRACKET; IDs se leen de ahí dinámicamente.
const BRK_PHASES = [
  {id:'r32',   label:'Dieciseisavos', dates:'28 jun – 3 jul',     path:'r32'},
  {id:'r16',   label:'Octavos',       dates:'4 – 7 jul',          path:'r16'},
  {id:'qf',    label:'Cuartos',       dates:'9 – 11 jul',         path:'qf'},
  {id:'sf',    label:'Semifinales',   dates:'14 – 15 jul',        path:'sf'},
  {id:'third', label:'3er Puesto',    dates:'18 jul · Miami',     path:'third'},
  {id:'final', label:'Final',         dates:'19 jul · Nueva York',path:'final'},
];

let _brkResults = {};
let _brkInited  = false;

// ── HELPERS ──
function brkBadgeUrl(slug){
  const n = BRK_BADGE_MAP[slug];
  return n ? `${BRK_SB}/badges/${n}.png` : null;
}
function brkFlagUrl(code){ return code ? `https://flagcdn.com/w80/${code}.png` : null; }
function brkGetTeam(name){
  if(!name||!window.EQUIPOS) return null;
  return window.EQUIPOS.find(e=>e.name===name)||null;
}
function brkPhaseMatches(path){
  const B = window.BRACKET;
  return (B && B[path]) ? B[path] : [];
}
function brkFindMatch(id){
  for(const ph of BRK_PHASES){
    const m = brkPhaseMatches(ph.path).find(x=>x.id===id);
    if(m) return m;
  }
  return null;
}
function brkGetResult(id){
  return _brkResults[id] || _brkResults[String(id)] || null;
}
function brkMatchStatus(id,match){
  const r = brkGetResult(id);
  if(r){
    if(r.estado==='live') return 'live';
    if(r.estado==='done' || (r.local!=null && r.visitante!=null)) return 'done';
  }
  if(!match) return 'tbd';
  const slots = ['W','L','T_'];
  const hOk = match.home && !slots.some(s=>match.home.startsWith(s));
  const aOk = match.away && !slots.some(s=>match.away.startsWith(s));
  return (hOk && aOk) ? 'upcoming' : 'tbd';
}

// ── DATA ──
function brkLoadResults(){
  if(window._brkResultsOverride){ _brkResults = window._brkResultsOverride; return; }
  _brkResults = {};
}

// ── LIVE HERO ──
function brkFindLiveMatch(){
  for(const ph of BRK_PHASES){
    for(const m of brkPhaseMatches(ph.path)){
      const r = brkGetResult(m.id);
      if(r && r.estado==='live') return {match:m, phase:ph, result:r};
    }
  }
  return null;
}
function brkRenderLiveHero(){
  const hero = document.getElementById('brk-live-hero');
  if(!hero) return;
  const live = brkFindLiveMatch();
  if(!live){ hero.style.display='none'; hero.innerHTML=''; return; }
  hero.style.display = '';

  const {match, phase, result} = live;
  const hName = (window.resolvedSlots?.[match.home]) || match.home || '—';
  const aName = (window.resolvedSlots?.[match.away]) || match.away || '—';
  const hT = brkGetTeam(hName), aT = brkGetTeam(aName);
  const hFlag = brkFlagUrl(hT?.flag), aFlag = brkFlagUrl(aT?.flag);
  const hBadge = brkBadgeUrl(hT?.slug), aBadge = brkBadgeUrl(aT?.slug);
  const hG = result.local ?? 0;
  const aG = result.visitante ?? 0;
  const min = result.minuto ? `${result.minuto}'` : 'EN JUEGO';

  const sideHtml = (flag, badge, name) => `
    <div class="brk-lh-side">
      <div class="brk-lh-badge-wrap">
        ${flag ? `<img class="brk-lh-flag" src="${flag}" onerror="this.style.visibility='hidden'">` : '<div class="brk-lh-flag"></div>'}
        ${badge ? `<img class="brk-lh-badge" src="${badge}" onerror="this.style.display='none'">` : ''}
      </div>
      <div class="brk-lh-name">${(name||'?').substring(0,16)}</div>
    </div>`;

  hero.innerHTML = `
    <div class="brk-lh-bar">
      <span class="brk-lh-dot"></span>
      <span class="brk-lh-lbl">En directo</span>
      <span class="brk-lh-sep">·</span>
      <span class="brk-lh-phase">${phase.label}</span>
      <span class="brk-lh-sep">·</span>
      <span class="brk-lh-min">${min}</span>
    </div>
    <div class="brk-lh-main" onclick="brkJumpTo(${match.id})">
      ${sideHtml(hFlag, hBadge, hName)}
      <div class="brk-lh-score">
        <span class="brk-lh-g">${hG}</span>
        <span class="brk-lh-dash">–</span>
        <span class="brk-lh-g">${aG}</span>
      </div>
      ${sideHtml(aFlag, aBadge, aName)}
    </div>
    ${match.venue ? `<div class="brk-lh-venue">${match.venue}</div>` : ''}
  `;
}

// ── MATCH CARD (hero con bandera + badge, score, footer) ──
function brkMakeHero(hSlug,aSlug,hFlag,aFlag,hName,aName,isTbd){
  const hBadge = hSlug ? brkBadgeUrl(hSlug) : null;
  const aBadge = aSlug ? brkBadgeUrl(aSlug) : null;
  const hFlagUrl = brkFlagUrl(hFlag);
  const aFlagUrl = brkFlagUrl(aFlag);
  const nameCls = isTbd ? ' tbd' : '';

  const halfL = `<div class="brk-half hL">
    ${hFlagUrl ? `<div class="brk-flag-bg" style="background-image:url('${hFlagUrl}')"></div>` : ''}
    <div class="brk-vign"></div>
    <div class="brk-badge-wrap">
      ${hBadge ? `<img class="brk-badge" src="${hBadge}" onerror="this.outerHTML='<div class=brk-badge-ph>?</div>'">` : `<div class="brk-badge-ph">${hFlag?'&#127988;':'?'}</div>`}
      <div class="brk-tname${nameCls}">${(hName||'?').substring(0,12)}</div>
    </div>
  </div>`;

  const halfR = `<div class="brk-half hR">
    ${aFlagUrl ? `<div class="brk-flag-bg" style="background-image:url('${aFlagUrl}')"></div>` : ''}
    <div class="brk-vign"></div>
    <div class="brk-badge-wrap">
      ${aBadge ? `<img class="brk-badge" src="${aBadge}" onerror="this.outerHTML='<div class=brk-badge-ph>?</div>'">` : `<div class="brk-badge-ph">${aFlag?'&#127988;':'?'}</div>`}
      <div class="brk-tname${nameCls}">${(aName||'?').substring(0,12)}</div>
    </div>
  </div>`;

  return `<div class="brk-hero">${halfL}${halfR}<div class="brk-vs">VS</div><div class="brk-fade"></div></div>`;
}

function brkMakeCard(matchId, isFinal, isThird){
  const match  = brkFindMatch(matchId);
  const result = brkGetResult(matchId);
  const status = brkMatchStatus(matchId, match);

  let hName='—', aName='—', hSlug=null, aSlug=null, hFlag=null, aFlag=null;
  if(match){
    hName = (window.resolvedSlots?.[match.home]) || match.home || '—';
    aName = (window.resolvedSlots?.[match.away]) || match.away || '—';
    const hT = brkGetTeam(hName); const aT = brkGetTeam(aName);
    hSlug = hT?.slug||null; aSlug = aT?.slug||null;
    hFlag = hT?.flag||null; aFlag = aT?.flag||null;
  }

  const isTbd   = status==='tbd';
  const hasScore = result && result.local!=null && result.visitante!=null;
  const hG = hasScore ? result.local : null;
  const aG = hasScore ? result.visitante : null;
  const hWin = hasScore && hG>aG;
  const aWin = hasScore && aG>hG;
  const isLive = status==='live';
  const scHas = (hasScore||isLive) ? 'has' : '';

  const hScCls = isLive ? 'brk-sc-live' : hasScore ? (hWin?'winner':'loser') : '';
  const aScCls = isLive ? 'brk-sc-live' : hasScore ? (aWin?'winner':'loser') : '';
  const hSc = hasScore ? hG : '–';
  const aSc = hasScore ? aG : '–';

  let stHtml='';
  if(status==='done')          stHtml = `<span class="brk-st done">Final</span>`;
  else if(isLive)              stHtml = `<span class="brk-st live"><span class="brk-live-dot"></span>${result?.minuto?result.minuto+"'":'•'}</span>`;
  else if(status==='upcoming') stHtml = `<span class="brk-st upcoming">Próximo</span>`;
  else                         stHtml = `<span class="brk-st tbd">—</span>`;

  const cardCls = isFinal ? 'final-card' : isThird ? 'third-card' : status;
  return `<div class="brk-mc ${cardCls}" data-match-id="${matchId}">
    ${brkMakeHero(hSlug,aSlug,hFlag,aFlag,hName,aName,isTbd)}
    <div class="brk-scores">
      <div class="brk-sc-h ${scHas} ${hScCls}">${hSc}</div>
      <div class="brk-sc-sep">:</div>
      <div class="brk-sc-a ${scHas} ${aScCls}">${aSc}</div>
    </div>
    <div class="brk-foot">
      <span class="brk-venue">${match?.venue||''}</span>
      ${stHtml}
    </div>
  </div>`;
}

// ── RAIL (chips quick-nav) ──
function brkPhaseStats(path){
  const matches = brkPhaseMatches(path);
  const total = matches.length;
  let done=0, live=0;
  matches.forEach(m=>{
    const s = brkMatchStatus(m.id, m);
    if(s==='done') done++;
    else if(s==='live') live++;
  });
  return {total, done, live};
}
function brkRenderRail(){
  const rail = document.getElementById('brk-rail'); if(!rail) return;
  const html = BRK_PHASES.map(ph=>{
    const {total, done, live} = brkPhaseStats(ph.path);
    const isComplete = total>0 && done===total;
    const cls = ph.id==='final' ? (isComplete?'final done':'final')
              : live>0       ? 'live'
              : isComplete   ? 'done'
              : done>0       ? 'partial'
              : 'future';
    const prog = (total>1) ? `<span class="brk-ph-prog">${done}/${total}</span>` : '';
    return `<div class="brk-ph ${cls}" onclick="brkSetPhase('${ph.id}')" data-phase="${ph.id}">
      <span class="brk-ph-dot"></span>
      <span class="brk-ph-lbl">${ph.label}</span>
      ${prog}
    </div>`;
  }).join('');
  rail.innerHTML = html;
}

// ── TIMELINE (secciones verticales apiladas) ──
function brkRenderTimeline(){
  const tl = document.getElementById('brk-timeline'); if(!tl) return;
  const html = BRK_PHASES.map(ph=>{
    const matches = brkPhaseMatches(ph.path);
    const {total, done, live} = brkPhaseStats(ph.path);
    const isFinal = ph.id==='final';
    const isThird = ph.id==='third';
    const sectCls = `brk-sect${isFinal?' is-final':isThird?' is-third':''}${live>0?' has-live':''}`;
    const icon    = isFinal ? '🏆' : isThird ? '🥉' : '';
    const iconHtml = icon ? `<span class="brk-sect-ico">${icon}</span>` : '';
    const liveBadge = live>0 ? `<span class="brk-sect-live"><span class="brk-live-dot"></span>EN VIVO</span>` : '';
    const progBadge = total>1 ? `<span class="brk-sect-prog">${done}/${total}</span>` : '';
    const gridCls = `brk-sect-grid${matches.length<=1?' single':''}`;
    const cards = matches.length
      ? matches.map(m=>brkMakeCard(m.id, isFinal, isThird)).join('')
      : `<div class="brk-sect-empty">Sin partidos programados</div>`;

    return `<section class="${sectCls}" id="brk-sect-${ph.id}" data-phase="${ph.id}">
      <header class="brk-sect-hd">
        <div class="brk-sect-title">${iconHtml}<span>${ph.label}</span></div>
        <div class="brk-sect-meta">
          <span class="brk-sect-dates">${ph.dates}</span>
          ${liveBadge}
          ${progBadge}
        </div>
      </header>
      <div class="${gridCls}">${cards}</div>
    </section>`;
  }).join('');
  tl.innerHTML = html;
}

// ── NAV ──
function brkSetPhase(phaseId){
  const el = document.getElementById(`brk-sect-${phaseId}`);
  if(!el) return;
  el.scrollIntoView({behavior:'smooth', block:'start'});
  el.classList.add('brk-sect-flash');
  setTimeout(()=>el.classList.remove('brk-sect-flash'), 1400);
}
window.brkSetPhase = brkSetPhase;

function brkJumpTo(matchId){
  const el = document.querySelector(`[data-match-id="${matchId}"]`);
  if(!el) return;
  el.scrollIntoView({behavior:'smooth', block:'center'});
  el.classList.add('brk-mc-flash');
  setTimeout(()=>el.classList.remove('brk-mc-flash'), 1600);
}
window.brkJumpTo = brkJumpTo;

// ── INIT / REFRESH ──
function initBracketResults(){
  const root = document.getElementById('brk-root'); if(!root) return;
  if(!_brkInited){
    root.innerHTML = `<div class="brk-root">
      <div class="brk-live-hero" id="brk-live-hero" style="display:none"></div>
      <div class="brk-rail" id="brk-rail"></div>
      <div class="brk-timeline" id="brk-timeline"></div>
      <div class="brk-legend">
        <div class="brk-leg-i"><div class="brk-leg-d" style="background:#3ddc84"></div>Finalizado</div>
        <div class="brk-leg-i"><div class="brk-leg-d" style="background:#f75f5f"></div>En vivo</div>
        <div class="brk-leg-i"><div class="brk-leg-d" style="background:#4f8ef7"></div>Próximo</div>
        <div class="brk-leg-i"><div class="brk-leg-d" style="background:#3d4460"></div>Por definir</div>
        <div class="brk-leg-i"><div class="brk-leg-d" style="background:#fbbf24"></div>Final</div>
      </div>
    </div>`;
    _brkInited = true;
  }
  brkLoadResults();
  brkRenderRail();
  brkRenderTimeline();
  brkRenderLiveHero();
}
window.initBracketResults = initBracketResults;

function refreshBracketResults(){
  brkLoadResults();
  brkRenderRail();
  brkRenderTimeline();
  brkRenderLiveHero();
}
window.refreshBracketResults = refreshBracketResults;

if(document.readyState==='loading'){
  addEventListener('DOMContentLoaded',()=>{ if(document.getElementById('brk-root')) initBracketResults(); });
}else{
  if(document.getElementById('brk-root')) initBracketResults();
}
