/* bracket-results.js — Porra Mundial 2026
   Vista de resultados reales del bracket KO. Sin lógica de pronósticos.
   Lee: window._results (auth.js), window.BRACKET (data.js), window.EQUIPOS (data.js)
   Expone: window.initBracketResults, window.refreshBracketResults, window.brkSetPhase
*/

const BRK_SB = 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures';

// ── BADGE MAP (slug equipo → fichero badge sin .png, null = sin badge) ──
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
  // sin badge:
  'nigeria':null,'drc-jam':null,'irak':null,'bosnia':null,
  'turkey':null,'sweden':null,'czech':null,
};

// ── FASES Y DISTRIBUCIÓN IZQUIERDA/DERECHA ──
// IMPORTANTE: verificar IDs con data.js antes de usar
// BRACKET.r32[0..15].id, r16[0..7].id, qf[0..3].id, sf[0..1].id, third[0].id, final[0].id
const BRK_PHASES = [
  {id:'r32',label:'1/32',   dates:'28 jun – 3 jul'},
  {id:'r16',label:'1/16',   dates:'4 – 7 jul'},
  {id:'oct',label:'Octavos',dates:'9 – 11 jul'},
  {id:'qf', label:'Cuartos',dates:'14 – 15 jul'},
  {id:'sf', label:'Semis',  dates:'18 – 19 jul'},
];
const BRK_PH_IDS = BRK_PHASES.map(p => p.id);

// Distribucion izquierda/derecha del bracket (primeros 8 vs últimos 8, etc.)
// Claude Code: ajustar IDs reales leyendo BRACKET de data.js
const BRK_COLS = {
  r32: {left:[73,74,75,76,77,78,79,80], right:[81,82,83,84,85,86,87,88]},
  r16: {left:[89,90,91,92],             right:[93,94,95,96]},
  oct: {left:[97,98],                   right:[99,100]},
  qf:  {left:[101],                     right:[102]},
  sf:  {left:[103],                     right:[104]},
};
// Claude Code: verificar estos IDs en BRACKET.final[0].id y BRACKET.third[0].id
const BRK_FINAL_ID = 105;
const BRK_THIRD_ID = 106;

// ── STATE ──
let _brkActivePhase = 'r32';
let _brkResults     = {};
let _brkInited      = false;

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
function brkFindMatch(id){
  if(!window.BRACKET) return null;
  return [...window.BRACKET.r32,...window.BRACKET.r16,...window.BRACKET.qf,
          ...window.BRACKET.sf,...(window.BRACKET.third||[]),...(window.BRACKET.final||[])]
    .find(m=>m.id===id)||null;
}
function brkGetResult(id){
  return _brkResults[id]||_brkResults[String(id)]||null;
}
function brkMatchStatus(id,match){
  const r=brkGetResult(id);
  if(r){
    if(r.estado==='live') return 'live';
    if(r.estado==='done'||(r.local!==null&&r.visitante!==null)) return 'done';
  }
  if(!match) return 'tbd';
  const slots=['W','L','T_'];
  const hOk=match.home&&!slots.some(s=>match.home.startsWith(s));
  const aOk=match.away&&!slots.some(s=>match.away.startsWith(s));
  return (hOk&&aOk)?'upcoming':'tbd';
}
function brkDetectActivePhase(){
  let found='r32';
  for(const ph of BRK_PHASES){
    const allIds=[...(BRK_COLS[ph.id]?.left||[]),...(BRK_COLS[ph.id]?.right||[])];
    const hasActivity=allIds.some(id=>{
      const r=brkGetResult(id);
      return r&&(r.estado==='done'||r.estado==='live'||(r.local!==null&&r.visitante!==null));
    });
    if(hasActivity) found=ph.id;
  }
  return found;
}

// ── DATA LOADING ──
function brkLoadResults(){
  // window._results: JSON de tabla results (id=1).
  // Estructura esperada: { ko_results: {"89":{local,visitante,estado,minuto},...} }
  // Claude Code: ajustar clave si la estructura real es diferente
  if(!window._results){_brkResults={};return;}
  _brkResults=window._results.ko_results||window._results.koResults||window._results||{};
}

// ── RENDER: HERO (bandera fondo + badge) ──
function brkMakeHero(hSlug,aSlug,hFlag,aFlag,hName,aName,isTbd){
  const hBadge=hSlug?brkBadgeUrl(hSlug):null;
  const aBadge=aSlug?brkBadgeUrl(aSlug):null;
  const hFlagUrl=brkFlagUrl(hFlag);
  const aFlagUrl=brkFlagUrl(aFlag);
  const nameCls=isTbd?' tbd':'';

  const halfL=`<div class="brk-half hL">
    ${hFlagUrl?`<div class="brk-flag-bg" style="background-image:url('${hFlagUrl}')"></div>`:''}
    <div class="brk-vign"></div>
    <div class="brk-badge-wrap">
      ${hBadge?`<img class="brk-badge" src="${hBadge}" onerror="this.outerHTML='<div class=brk-badge-ph>?</div>'">`:`<div class="brk-badge-ph">${hFlag?'🏴':'?'}</div>`}
      <div class="brk-tname${nameCls}">${(hName||'?').substring(0,11)}</div>
    </div>
  </div>`;

  const halfR=`<div class="brk-half hR">
    ${aFlagUrl?`<div class="brk-flag-bg" style="background-image:url('${aFlagUrl}')"></div>`:''}
    <div class="brk-vign"></div>
    <div class="brk-badge-wrap">
      ${aBadge?`<img class="brk-badge" src="${aBadge}" onerror="this.outerHTML='<div class=brk-badge-ph>?</div>'">`:`<div class="brk-badge-ph">${aFlag?'🏴':'?'}</div>`}
      <div class="brk-tname${nameCls}">${(aName||'?').substring(0,11)}</div>
    </div>
  </div>`;

  return `<div class="brk-hero">${halfL}${halfR}<div class="brk-vs">VS</div><div class="brk-fade"></div></div>`;
}

// ── RENDER: MATCH CARD ──
function brkMakeCard(matchId,isFinal,isThird){
  const match =brkFindMatch(matchId);
  const result=brkGetResult(matchId);
  const status=brkMatchStatus(matchId,match);

  let hName='—',aName='—',hSlug=null,aSlug=null,hFlag=null,aFlag=null;
  if(match){
    hName=(window.resolvedSlots&&window.resolvedSlots[match.home])||match.home||'—';
    aName=(window.resolvedSlots&&window.resolvedSlots[match.away])||match.away||'—';
    const hT=brkGetTeam(hName); const aT=brkGetTeam(aName);
    hSlug=hT?.slug||null; aSlug=aT?.slug||null;
    hFlag=hT?.flag||null; aFlag=aT?.flag||null;
  }

  const isTbd   =status==='tbd';
  const hasScore=result&&result.local!==null&&result.visitante!==null;
  const hG      =hasScore?result.local:null;
  const aG      =hasScore?result.visitante:null;
  const hWin    =hasScore&&hG>aG;
  const aWin    =hasScore&&aG>hG;
  const isLive  =status==='live';
  const scHas   =(hasScore||isLive)?'has':'';

  const hScCls=isLive?'brk-sc-live':hasScore?(hWin?'winner':'loser'):'';
  const aScCls=isLive?'brk-sc-live':hasScore?(aWin?'winner':'loser'):'';
  const hSc=hasScore?hG:'–';
  const aSc=hasScore?aG:'–';

  let stHtml='';
  if(status==='done')     stHtml=`<span class="brk-st done">Final</span>`;
  else if(isLive)         stHtml=`<span class="brk-st live"><span class="brk-live-dot"></span>${result?.minuto?result.minuto+"'":'•'}</span>`;
  else if(status==='upcoming') stHtml=`<span class="brk-st upcoming">Próximo</span>`;
  else                    stHtml=`<span class="brk-st tbd">—</span>`;

  const cardCls=isFinal?'final-card':isThird?'third-card':status;
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

// ── RENDER: PAST MINI ──
function brkMakePast(matchId){
  const match =brkFindMatch(matchId); if(!match) return '';
  const result=brkGetResult(matchId);
  const hName=(window.resolvedSlots?.[match.home])||match.home||'?';
  const aName=(window.resolvedSlots?.[match.away])||match.away||'?';
  const hT=brkGetTeam(hName); const aT=brkGetTeam(aName);
  const hFlagEl=hT?.flag?`<img class="brk-pm-flag" src="${brkFlagUrl(hT.flag)}" onerror="this.className='brk-pm-flag'">`:'<div class="brk-pm-flag"></div>';
  const aFlagEl=aT?.flag?`<img class="brk-pm-flag" src="${brkFlagUrl(aT.flag)}" onerror="this.className='brk-pm-flag'">`:'<div class="brk-pm-flag"></div>';
  const hG=result?.local??'?'; const aG=result?.visitante??'?';
  const hWin=result&&result.local>result.visitante;
  return `<div class="brk-pm" title="${hName} ${hG}-${aG} ${aName}">
    <div class="brk-pm-row">${hFlagEl}<span class="brk-pm-name${hWin?' w':''}">${hName.substring(0,8)}</span><span class="brk-pm-sc${hWin?'':' l'}">${hG}</span></div>
    <div class="brk-pm-row">${aFlagEl}<span class="brk-pm-name${!hWin?' w':''}">${aName.substring(0,8)}</span><span class="brk-pm-sc${!hWin?'':' l'}">${aG}</span></div>
  </div>`;
}

// ── RENDER: CENTER COLUMN ──
function brkMakeCenter(){
  return `<div class="brk-col center">
    <div class="brk-col-hd"><span class="brk-col-lbl">Final</span></div>
    <div class="brk-center-inner">
      <div class="brk-center-lbl">Copa del Mundo 2026</div>
      <div class="brk-host-stack">
        <img class="brk-h-logo can" src="${BRK_SB}/Logos/2026_FIFA_World_Cup_Logo_29-Canada.png" onerror="this.style.display='none'"/>
        <img class="brk-h-logo mex" src="${BRK_SB}/Logos/2026_FIFA_World_Cup_Logo_30-Mexico.png" onerror="this.style.display='none'"/>
        <img class="brk-h-logo usa" src="${BRK_SB}/Logos/2026_FIFA_World_Cup_Logo_31-USA.png"    onerror="this.style.display='none'"/>
      </div>
      <img class="brk-wc-logo" src="${BRK_SB}/Logos/2026_FIFA_World_Cup.png" onerror="this.style.display='none'"/>
      <div class="brk-sep"></div>
      <div class="brk-center-lbl">Final</div>
      <div class="brk-center-date">19 jul · MetLife Stadium · NY</div>
      ${brkMakeCard(BRK_FINAL_ID,true,false)}
      <div class="brk-third-lbl">3er Puesto</div>
      <div class="brk-center-date">18 jul · Hard Rock · Miami</div>
      ${brkMakeCard(BRK_THIRD_ID,false,true)}
    </div>
  </div>`;
}

// ── RENDER: RAIL ──
function brkRenderRail(){
  const rail=document.getElementById('brk-rail'); if(!rail) return;
  const ai=BRK_PH_IDS.indexOf(_brkActivePhase);
  const segs=BRK_PHASES.map((p,i)=>{
    const cls=i<ai?'done':i===ai?'active':'future';
    return `<div class="brk-ph ${cls}" onclick="brkSetPhase('${p.id}')"><span class="brk-ph-dot"></span>${p.label}</div>`;
  });
  segs.push(`<div class="brk-ph final"><span class="brk-ph-dot"></span>Final</div>`);
  rail.innerHTML=segs.join('<div style="width:1px;background:#0c0e14;flex-shrink:0"></div>');
}

// ── RENDER: BRACKET BODY ──
function brkRenderBracket(){
  const body=document.getElementById('brk-body'); if(!body) return;
  const ai=BRK_PH_IDS.indexOf(_brkActivePhase);
  const futurePhs=BRK_PH_IDS.slice(ai+1);
  const aph=BRK_PHASES.find(p=>p.id===_brkActivePhase);
  let html='';

  // Past left
  BRK_PH_IDS.slice(0,ai).forEach(pid=>{
    const ph=BRK_PHASES.find(p=>p.id===pid);
    html+=`<div class="brk-col past"><div class="brk-col-hd"><span class="brk-col-lbl">${ph.label}</span></div>
      <div class="brk-past-wrap">${(BRK_COLS[pid]?.left||[]).map(brkMakePast).join('')}</div></div>`;
  });

  // Active left
  html+=`<div class="brk-col active"><div class="brk-col-hd"><span class="brk-col-lbl">${aph.label} · en curso</span><div class="brk-col-sub">${aph.dates}</div></div>
    <div class="brk-matches">${(BRK_COLS[_brkActivePhase]?.left||[]).map(id=>brkMakeCard(id,false,false)).join('')}</div></div>`;

  // Future left (ghost)
  futurePhs.forEach((pid,i)=>{
    const ph=BRK_PHASES.find(p=>p.id===pid);
    const n=BRK_COLS[pid]?.left?.length||1;
    html+=`<div class="brk-col future f${Math.min(i+1,3)}"><div class="brk-col-hd"><span class="brk-col-lbl">${ph?.label||pid}</span></div>
      <div class="brk-ghost-wrap">${Array(n).fill('<div class="brk-ghost"></div>').join('')}</div></div>`;
  });

  // Center
  html+=brkMakeCenter();

  // Future right (mirror, opacidad inversa)
  [...futurePhs].reverse().forEach((pid,i)=>{
    const ph=BRK_PHASES.find(p=>p.id===pid);
    const n=BRK_COLS[pid]?.right?.length||1;
    const fi=Math.min(futurePhs.length-i,3);
    html+=`<div class="brk-col future rfuture f${fi}"><div class="brk-col-hd"><span class="brk-col-lbl">${ph?.label||pid}</span></div>
      <div class="brk-ghost-wrap">${Array(n).fill('<div class="brk-ghost"></div>').join('')}</div></div>`;
  });

  // Active right
  html+=`<div class="brk-col active ractive"><div class="brk-col-hd"><span class="brk-col-lbl">${aph.label} · en curso</span><div class="brk-col-sub">${aph.dates}</div></div>
    <div class="brk-matches">${(BRK_COLS[_brkActivePhase]?.right||[]).map(id=>brkMakeCard(id,false,false)).join('')}</div></div>`;

  // Past right (reversed)
  BRK_PH_IDS.slice(0,ai).reverse().forEach(pid=>{
    const ph=BRK_PHASES.find(p=>p.id===pid);
    html+=`<div class="brk-col past rpast"><div class="brk-col-hd"><span class="brk-col-lbl">${ph.label}</span></div>
      <div class="brk-past-wrap">${(BRK_COLS[pid]?.right||[]).map(brkMakePast).join('')}</div></div>`;
  });

  body.innerHTML=html;
  brkEnableDrag(document.getElementById('brk-scroll'));
}

// ── DRAG SCROLL ──
function brkEnableDrag(el){
  if(!el||el._brkDrag) return; el._brkDrag=true;
  let down=false,startX,scrollL;
  el.addEventListener('mousedown',e=>{down=true;el.classList.add('dragging');startX=e.pageX-el.offsetLeft;scrollL=el.scrollLeft});
  el.addEventListener('mouseleave',()=>{down=false;el.classList.remove('dragging')});
  el.addEventListener('mouseup',  ()=>{down=false;el.classList.remove('dragging')});
  el.addEventListener('mousemove',e=>{if(!down)return;e.preventDefault();el.scrollLeft=scrollL-(e.pageX-el.offsetLeft-startX)*1.4});
}

// ── PUBLIC API ──
function brkSetPhase(id){
  _brkActivePhase=id; brkRenderRail(); brkRenderBracket();
}
window.brkSetPhase=brkSetPhase;

function initBracketResults(){
  const root=document.getElementById('brk-root'); if(!root) return;
  if(!_brkInited){
    root.innerHTML=`<div class="brk-root">
      <div class="brk-rail" id="brk-rail"></div>
      <div class="brk-scroll" id="brk-scroll"><div class="brk-body" id="brk-body"></div></div>
      <div class="brk-legend">
        <div class="brk-leg-i"><div class="brk-leg-d" style="background:#3ddc84"></div>Finalizado</div>
        <div class="brk-leg-i"><div class="brk-leg-d" style="background:#f75f5f"></div>En vivo</div>
        <div class="brk-leg-i"><div class="brk-leg-d" style="background:#4f8ef7"></div>Próximo</div>
        <div class="brk-leg-i"><div class="brk-leg-d" style="background:#3d4460"></div>Por definir</div>
        <div class="brk-leg-i"><div class="brk-leg-d" style="background:#fbbf24"></div>Final</div>
      </div>
    </div>`;
    _brkInited=true;
  }
  brkLoadResults();
  _brkActivePhase=brkDetectActivePhase();
  brkRenderRail();
  brkRenderBracket();
}
window.initBracketResults=initBracketResults;

function refreshBracketResults(){
  brkLoadResults();
  _brkActivePhase=brkDetectActivePhase();
  brkRenderRail();
  brkRenderBracket();
}
window.refreshBracketResults=refreshBracketResults;

// Auto-init si el panel ya existe al cargar
if(document.readyState==='loading'){
  addEventListener('DOMContentLoaded',()=>{ if(document.getElementById('brk-root')) initBracketResults(); });
}else{
  if(document.getElementById('brk-root')) initBracketResults();
}
