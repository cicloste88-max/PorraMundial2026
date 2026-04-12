/* bracket-results.js — Porra Mundial 2026
   Vista de resultados reales del bracket KO. Sin lógica de pronósticos.
   Lee: window.BRACKET (ko.js), window.EQUIPOS (data.js), window.SB (data.js)
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
// IDs verificados contra BRACKET en ko.js (data.js):
//   r32: 73-88, r16: 89-96, qf: 97-100, sf: 101-102, third: 103, final: 104
const BRK_PHASES = [
  {id:'r32', label:'1/32',    dates:'28 jun – 3 jul'},
  {id:'r16', label:'1/16',    dates:'4 – 7 jul'},
  {id:'oct', label:'Octavos', dates:'9 – 11 jul'},
  {id:'qf',  label:'Cuartos', dates:'14 – 15 jul'},
  {id:'sf',  label:'Semis',   dates:'18 – 19 jul'},
];
const BRK_PH_IDS = BRK_PHASES.map(p => p.id);

const BRK_COLS = {
  r32: {left:[73,74,75,76,77,78,79,80], right:[81,82,83,84,85,86,87,88]},
  r16: {left:[89,90,91,92],             right:[93,94,95,96]},
  oct: {left:[97,98],                   right:[99,100]},
  qf:  {left:[101],                     right:[102]},
  sf:  {left:[],                        right:[]},
};
const BRK_FINAL_ID = 104;  // BRACKET.final[0].id
const BRK_THIRD_ID = 103;  // BRACKET.third[0].id

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
// Resultados reales vienen de la tabla `results` en Supabase.
// scoreboard.js los parsea como realKoResults = JSON.parse(res.ko_results).
// No hay un window._results global — usamos lo que esté disponible.
function brkLoadResults(){
  // Intentar fuentes conocidas de resultados KO
  if(window._brkResultsOverride){
    _brkResults=window._brkResultsOverride;
    return;
  }
  // Fallback: sin datos de resultados, todo queda como upcoming/tbd
  _brkResults={};
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
      ${hBadge?`<img class="brk-badge" src="${hBadge}" onerror="this.outerHTML='<div class=brk-badge-ph>?</div>'">`:`<div class="brk-badge-ph">${hFlag?'&#127988;':'?'}</div>`}
      <div class="brk-tname${nameCls}">${(hName||'?').substring(0,11)}</div>
    </div>
  </div>`;

  const halfR=`<div class="brk-half hR">
    ${aFlagUrl?`<div class="brk-flag-bg" style="background-image:url('${aFlagUrl}')"></div>`:''}
    <div class="brk-vign"></div>
    <div class="brk-badge-wrap">
      ${aBadge?`<img class="brk-badge" src="${aBadge}" onerror="this.outerHTML='<div class=brk-badge-ph>?</div>'">`:`<div class="brk-badge-ph">${aFlag?'&#127988;':'?'}</div>`}
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

// ── RENDER: FINAL BOX (fuera del bracket scroll) ──
function brkMakeFinalBox(){
  return `<div class="brk-final-box" id="brk-final-box">
    <div class="brk-final-box-hd">
      <div class="brk-final-box-title">🏆 Final · Copa del Mundo 2026</div>
      <div class="brk-final-box-sub">19 jul · MetLife Stadium, Nueva York</div>
    </div>
    <div class="brk-final-box-cards">
      ${brkMakeCard(BRK_FINAL_ID,true,false)}
      <div class="brk-final-box-divider"></div>
      ${brkMakeCard(BRK_THIRD_ID,false,true)}
    </div>
    <div class="brk-final-box-footer">
      <span class="brk-final-box-third-lbl">🥉 3er Puesto · 18 jul · Hard Rock Stadium, Miami</span>
    </div>
  </div>`;
}

// ── RENDER: RAIL ──
function brkRenderRail(){
  const rail=document.getElementById('brk-rail'); if(!rail) return;
  const isFinalView=_brkActivePhase==='final';
  const ai=isFinalView?BRK_PH_IDS.length:BRK_PH_IDS.indexOf(_brkActivePhase);
  const segs=BRK_PHASES.map((p,i)=>{
    const cls=isFinalView?'done':i<ai?'done':i===ai?'active':'future';
    return `<div class="brk-ph ${cls}" onclick="brkSetPhase('${p.id}')"><span class="brk-ph-dot"></span>${p.label}</div>`;
  });
  const finalCls=isFinalView?'final active':'final';
  segs.push(`<div class="brk-ph ${finalCls}" onclick="brkSetPhase('final')"><span class="brk-ph-dot"></span>Final</div>`);
  rail.innerHTML=segs.join('<div style="width:1px;background:#0c0e14;flex-shrink:0"></div>');
}

// ── RENDER: BRACKET BODY ──
function brkRenderBracket(){
  const body=document.getElementById('brk-body'); if(!body) return;
  const isFinalView=_brkActivePhase==='final';
  const ai=isFinalView?BRK_PH_IDS.length:BRK_PH_IDS.indexOf(_brkActivePhase);
  const futurePhs=isFinalView?[]:BRK_PH_IDS.slice(ai+1).filter(id=>BRK_PHASES.find(p=>p.id===id));
  const aph=isFinalView?null:BRK_PHASES.find(p=>p.id===_brkActivePhase);
  let html='';

  // Past left
  const pastIds=isFinalView?BRK_PH_IDS:BRK_PH_IDS.slice(0,ai);
  pastIds.forEach(pid=>{
    const ph=BRK_PHASES.find(p=>p.id===pid);
    html+=`<div class="brk-col past"><div class="brk-col-hd"><span class="brk-col-lbl">${ph.label}</span></div>
      <div class="brk-past-wrap">${(BRK_COLS[pid]?.left||[]).map(brkMakePast).join('')}</div></div>`;
  });

  if(!isFinalView){
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
  }

  if(!isFinalView){
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
  }

  // Past right (reversed)
  [...pastIds].reverse().forEach(pid=>{
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
  _brkActivePhase=id;
  brkRenderRail();
  if(id==='final'){
    document.getElementById('brk-scroll').style.display='none';
    const area=document.getElementById('brk-final-area');
    if(area){area.innerHTML=brkMakeFinalBox();area.style.display='block';}
  } else {
    document.getElementById('brk-scroll').style.display='';
    const area=document.getElementById('brk-final-area');
    if(area){area.innerHTML='';area.style.display='none';}
    brkRenderBracket();
  }
}
window.brkSetPhase=brkSetPhase;

function initBracketResults(){
  const root=document.getElementById('brk-root'); if(!root) return;
  if(!_brkInited){
    root.innerHTML=`<div class="brk-root">
      <div class="brk-rail" id="brk-rail"></div>
      <div class="brk-scroll" id="brk-scroll"><div class="brk-body" id="brk-body"></div></div>
      <div class="brk-final-area" id="brk-final-area" style="display:none"></div>
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
  brkSetPhase(brkDetectActivePhase());
}
window.refreshBracketResults=refreshBracketResults;
