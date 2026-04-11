// main.js - Porra Mundial 2026 (modulo principal reducido tras extraccion)
// Sub-bloques pendientes de extraer: ui-nav
// Deps: data.js, scoring.js, ui-groups.js, ko.js (deben cargarse antes)

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
}
// ── Exports para Vite (añadir al final de main.js) ──────────────
// Expone todas las variables/funciones que auth.js y el HTML
// necesitan encontrar en window cuando main.js sea un módulo ES.
window.PARTIDOS            = PARTIDOS;
window.EQUIPOS             = EQUIPOS;
window.GRUPOS              = GRUPOS;
window.BRACKET             = typeof BRACKET !== 'undefined' ? BRACKET : undefined;
window.predictions         = predictions;
window.koPredictions       = koPredictions;
window.awPicks             = awPicks;
window.SB                  = SB;
window.WORLD_CUP_LOGO      = WORLD_CUP_LOGO;
window.KIT_OVERRIDES       = typeof KIT_OVERRIDES !== 'undefined' ? KIT_OVERRIDES : undefined;
window.CLASSIFICATION_PTS  = typeof CLASSIFICATION_PTS !== 'undefined' ? CLASSIFICATION_PTS : undefined;
window.KO_ROUND_PTS        = typeof KO_ROUND_PTS !== 'undefined' ? KO_ROUND_PTS : undefined;
window.FINAL_CLASSIFICATION_PTS = typeof FINAL_CLASSIFICATION_PTS !== 'undefined' ? FINAL_CLASSIFICATION_PTS : undefined;
// Funciones usadas desde auth.js y otros módulos
window.getMatchKey         = getMatchKey;
window.escapeHtml          = escapeHtml;
window.renderAll           = renderAll;
window.updateCardUI        = typeof updateCardUI !== 'undefined' ? updateCardUI : undefined;
window.refreshGroupTables  = refreshGroupTables;
window.normKoPredictions   = typeof normKoPredictions !== 'undefined' ? normKoPredictions : undefined;
window.getActiveLeagueId   = typeof getActiveLeagueId !== 'undefined' ? getActiveLeagueId : undefined;
window.showPage            = typeof showPage !== 'undefined' ? showPage : undefined;
window.initWelcome         = typeof initWelcome !== 'undefined' ? initWelcome : undefined;
window.checkFinalizarReady = typeof checkFinalizarReady !== 'undefined' ? checkFinalizarReady : undefined;
window.koInit              = typeof koInit !== 'undefined' ? koInit : undefined;
window.saveKO              = typeof saveKO !== 'undefined' ? saveKO : undefined;
window.calcTotalUserPoints = typeof calcTotalUserPoints !== 'undefined' ? calcTotalUserPoints : undefined;
window.selectAward         = typeof selectAward !== 'undefined' ? selectAward : undefined;
window.openPicker          = typeof openPicker !== 'undefined' ? openPicker : undefined;
window.closePicker         = typeof closePicker !== 'undefined' ? closePicker : undefined;
window.updateAwardsFooter  = typeof updateAwardsFooter !== 'undefined' ? updateAwardsFooter : undefined;