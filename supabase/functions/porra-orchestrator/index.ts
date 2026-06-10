// Versionado desde runtime el 10-jun-2026 (v6). Origen: deploy vía MCP sin commit previo.
// Fuente de verdad hasta esta fecha: runtime Supabase. A partir de ahora: este fichero.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SVC_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANTHROPIC_URL     = 'https://api.anthropic.com/v1/messages';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const BLOQUES = [
  {id:'css-b1',    tipo:'CSS',  fase:1, done:true,  nombre:'CSS B1 Reset vars layout',          archivo:'base.css',             lineas:462,  usa:[],                                     expone:['vars CSS','reset','layout'],                   deps:[],                               notas:'Raiz. Sin deps.'},
  {id:'css-b2',    tipo:'CSS',  fase:1, done:true,  nombre:'CSS B2 Welcome auth modal',          archivo:'welcome.css',          lineas:105,  usa:['vars css-b1'],                        expone:['.wc-*','.auth-*'],                             deps:['css-b1'],                        notas:''},
  {id:'css-b3',    tipo:'CSS',  fase:1, done:true,  nombre:'CSS B3 KO bracket modal awards',     archivo:'ko.css + awards.css',  lineas:709,  usa:['vars css-b1'],                        expone:['.ko-bracket','.modal','.aw-*'],                deps:['css-b1'],                        notas:'Dividir en ko.css y awards.css'},
  {id:'css-b4',    tipo:'CSS',  fase:1, done:true,  nombre:'CSS B4 Responsive admin dado',       archivo:'admin.css',            lineas:544,  usa:['vars css-b1'],                        expone:['.adm-*','media queries','.dice-*'],            deps:['css-b1'],                        notas:'body y container duplicados - limpiar'},
  {id:'html-auth',    tipo:'HTML', fase:2, done:true, nombre:'HTML Auth bar modal',               archivo:'index.html',           lineas:595,  usa:['openAuthModal','doLogin'],             expone:['#auth-bar','#auth-modal'],                     deps:['js-auth'],                       notas:''},
  {id:'html-score',   tipo:'HTML', fase:2, done:true, nombre:'HTML Page scoreboard',             archivo:'index.html',           lineas:75,   usa:[],                                     expone:['#page-score'],                                 deps:['js-scoreboard'],                 notas:''},
  {id:'html-welcome', tipo:'HTML', fase:2, done:true, nombre:'HTML Page welcome ligas',          archivo:'index.html',           lineas:225,  usa:['leagueShowCreate','showPage'],         expone:['#page-welcome','#panel-ligas'],                deps:['js-ligas'],                      notas:''},
  {id:'html-grupos',  tipo:'HTML', fase:2, done:true, nombre:'HTML Page fase grupos',            archivo:'index.html',           lineas:104,  usa:['showPage'],                           expone:['#page-grupos'],                                deps:['js-main'],                       notas:'Tarjetas dinamicas'},
  {id:'html-elim',    tipo:'HTML', fase:2, done:true, nombre:'HTML Page eliminatorias',          archivo:'index.html',           lineas:135,  usa:['showPage'],                           expone:['#page-elim','#awards-box4'],                   deps:['js-main'],                       notas:''},
  {id:'html-awards',  tipo:'HTML', fase:2, done:true, nombre:'HTML Awards overlay',              archivo:'index.html',           lineas:14,   usa:[],                                     expone:['#aw-overlay'],                                 deps:['js-main'],                       notas:''},
  {id:'html-admin',   tipo:'HTML', fase:2, done:true, nombre:'HTML Page admin',                  archivo:'index.html',           lineas:163,  usa:['admTab','admInit'],                   expone:['#page-admin','#adm-toast'],                    deps:['js-admin'],                      notas:''},
  {id:'js-utils',    tipo:'JS', fase:1, done:true,  nombre:'JS Utils inline',                    archivo:'auth.js absorber',     lineas:8,    usa:[],                                     expone:['handleCTA','openAuthModal stub'],               deps:[],                               notas:'8 lineas - absorber en auth.js'},
  {id:'js-supabase', tipo:'JS', fase:1, done:true,  nombre:'JS Supabase CDN',                    archivo:'CDN',                  lineas:11,   usa:[],                                     expone:['window.supabase'],                             deps:[],                               notas:'Solo script src'},
  {id:'js-misc',     tipo:'JS', fase:1, done:true,  nombre:'JS Modulo misc',                     archivo:'misc.js',              lineas:37,   usa:[],                                     expone:['toggleRoundPopover','applyFinalSectionMobile'],deps:[],                               notas:'Sin deps.'},
  {id:'js-auth',     tipo:'JS', fase:2, done:true,  nombre:'JS Modulo auth sesion',               archivo:'auth.js',              lineas:292,  usa:['PARTIDOS','AW_PLAYERS'],              expone:['db','currentUser','loadUserData'],              deps:['js-supabase','js-data'],         notas:'Inicializa cliente Supabase.'},
  {id:'js-ligas',    tipo:'JS', fase:3, done:true,  nombre:'JS Modulo ligas',                     archivo:'leagues.js',           lineas:338,  usa:['db','currentUser','predictions'],     expone:['getActiveLeagueId','leagueSelect'],             deps:['js-auth','js-data'],             notas:'Bien delimitado.'},
  {id:'js-scoreboard',tipo:'JS',fase:3, done:true,  nombre:'JS Modulo scoreboard',                archivo:'scoreboard.js',        lineas:265,  usa:['PARTIDOS','BRACKET','currentUser'],   expone:['sbLoad','sbRender'],                           deps:['js-auth','js-ligas','js-data'],  notas:'Modulo limpio.'},
  {id:'js-cerrar',   tipo:'JS', fase:4, done:true,  nombre:'JS Modulo cerrar porra',              archivo:'close-porra.js',       lineas:239,  usa:['PARTIDOS','currentUser','db'],        expone:['checkFinalizarReady','finalizarPorra'],         deps:['js-auth','js-ligas','js-data'],  notas:''},
  {id:'js-admin',    tipo:'JS', fase:4, done:true,  nombre:'JS Admin panel',                      archivo:'admin.js',             lineas:520,  usa:['PARTIDOS','BRACKET','currentUser'],   expone:['admInit','admTab','admLoadResults'],            deps:['js-auth','js-ligas','js-misc'],  notas:'Ya refactorizado.'},
  {id:'js-dado',     tipo:'JS', fase:4, done:true,  nombre:'JS Dado aleatorio',                   archivo:'dice.js',              lineas:258,  usa:['PARTIDOS','BRACKET','predictions'],   expone:['dicePickScore','diceSimulateMatch'],            deps:['js-data','js-ligas'],            notas:'Bajo riesgo.'},
  // Fase 5 - subdivision de js-main
  {id:'js-data',     tipo:'JS', fase:5, done:false, nombre:'JS Datos del torneo PARTIDOS BRACKET EQUIPOS GRUPOS', archivo:'data.js',  lineas:159, usa:[],                                   expone:['PARTIDOS','BRACKET','EQUIPOS','GRUPOS','SB','AW_PLAYERS','YOUNG_PLAYERS_NXGN'], deps:[], notas:'Raiz de datos. Sin dependencias JS del proyecto.'},
  {id:'js-scoring',  tipo:'JS', fase:5, done:false, nombre:'JS Motor de puntuacion calcScore calcGroupsAdvancePoints calcTotalUserPoints', archivo:'scoring.js', lineas:210, usa:['PARTIDOS','BRACKET','AWARDS_CFG'], expone:['calcScore','calcGroupsAdvancePoints','calcClassificationPoints','calcTotalUserPoints'], deps:['js-data'], notas:'Logica pura de calculo. Sin efectos de UI.'},
  {id:'js-ui-groups',tipo:'JS', fase:5, done:false, nombre:'JS UI tarjetas grupos renderMatchCard updateCardUI openModal savePredictions', archivo:'ui-groups.js', lineas:1149, usa:['PARTIDOS','EQUIPOS','predictions','db','currentUser'], expone:['renderMatchCard','updateCardUI','openModal','savePredictions','renderGroupTableCard','refreshGroupTables'], deps:['js-data','js-auth','js-ligas'], notas:'Bloque mas grande. Contiene toda la UI de la fase de grupos.'},
  {id:'js-ko',       tipo:'JS', fase:5, done:false, nombre:'JS Bracket KO eliminatorias resolveKO renderKO IA partidos', archivo:'ko.js', lineas:1089, usa:['BRACKET','koPredictions','resolvedSlots','db','currentUser'], expone:['resolveKO','renderKO','buildKOCard','saveKOPred','undoKO'], deps:['js-data','js-auth','js-ligas'], notas:'Todo el sistema de eliminatorias incluyendo IA de prediccion.'},
  {id:'js-ui-nav',   tipo:'JS', fase:5, done:false, nombre:'JS Navegacion SPA showPage renderBox4 init welcome', archivo:'ui-nav.js', lineas:579, usa:['PARTIDOS','BRACKET','currentUser','predictions','awPicks'], expone:['showPage','renderBox4','updateAwardsFooter','initApp'], deps:['js-data','js-auth','js-ligas','js-ko','js-ui-groups'], notas:'Punto de entrada de la app. Inicializacion y navegacion.'},
];

const SYSTEM_PROMPT = `Eres un agente de refactorizacion para Porra Mundial 2026.
Devuelve EXCLUSIVAMENTE la cabecera formal en formato comentario, sin texto adicional.
Formato:
     [NOMBRE] - [descripcion breve]
     Archivo destino : [archivo]
     -----------------------------------------------------------
     Usa             : [dependencias externas o (ninguna)]
     Expone          : [funciones/vars principales]
     Deps            : [ids de bloques requeridos o (ninguna)]
     Notas           : [nota breve]
================================================================ -->`;

async function callClaude(b: typeof BLOQUES[0]): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY no configurada');
  const prompt = `Bloque: ${b.id}\nTipo: ${b.tipo}\nNombre: ${b.nombre}\nArchivo destino: ${b.archivo}\nLineas: ${b.lineas}\nUsa: ${b.usa.join(', ') || '(ninguna)'}\nExpone: ${b.expone.join(', ')}\nDeps: ${b.deps.join(', ') || '(ninguna)'}\nNotas: ${b.notas || 'ninguna'}\n\nGenera la cabecera formal.`;
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(`Anthropic ${res.status}: ${(e as any)?.error?.message}`); }
  const data = await res.json();
  return (data.content ?? []).map((c: any) => c.text ?? '').join('').trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) {}
  const action = (body.action as string) ?? '';
  const svc = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

  try {
    if (action === 'ping') return json({ ok: true, message: 'porra-orchestrator v3', bloques: BLOQUES.length });

    if (action === 'status') {
      const { data: jobs } = await svc.from('orchestrator_jobs').select('*').order('started_at', { ascending: false }).limit(10);
      const byFase = [1,2,3,4,5].map(f => {
        const fb = BLOQUES.filter(b => b.fase === f);
        return { fase:f, total:fb.length, done:fb.filter(b=>b.done).length, lineas:fb.reduce((s,b)=>s+b.lineas,0) };
      });
      const tl = BLOQUES.reduce((s,b)=>s+b.lineas,0);
      const dl = BLOQUES.filter(b=>b.done).reduce((s,b)=>s+b.lineas,0);
      return json({ ok:true, checkpoint:'v15b', progreso:`${Math.round(dl/tl*100)}%`, lineas_done:dl, lineas_total:tl, fases:byFase, recent_jobs:jobs??[] });
    }

    if (action === 'run_fase') {
      const fase   = (body.fase as number) ?? 1;
      const mode   = (body.mode as string) ?? 'header';
      const dryRun = (body.dry_run as boolean) ?? false;
      const targets = BLOQUES.filter(b => b.fase === fase && !b.done);
      if (!targets.length) return json({ ok:true, message:`Fase ${fase}: ya completada`, results:[] });
      if (dryRun) return json({ ok:true, dry_run:true, fase, targets:targets.map(b=>({id:b.id,nombre:b.nombre,lineas:b.lineas})), message:`${targets.length} agentes se lanzarian en paralelo` });

      const { data: job } = await svc.from('orchestrator_jobs').insert({ fase, mode, status:'running' }).select().single();
      const jobId = job?.id;

      (async () => {
        const results = await Promise.allSettled(targets.map(async b => {
          const header = await callClaude(b);
          return { id:b.id, nombre:b.nombre, archivo:b.archivo, ok:true, header };
        }));
        const output = results.map((r,i) => {
          const b = targets[i];
          return r.status === 'fulfilled'
            ? { id:b.id, ok:true, header:r.value.header, archivo:b.archivo }
            : { id:b.id, ok:false, error:(r.reason as Error).message };
        });
        await svc.from('orchestrator_jobs').update({ status:'done', finished_at:new Date().toISOString(), results:output }).eq('id', jobId);
      })().catch(async e => {
        await svc.from('orchestrator_jobs').update({ status:'error', error:String(e), finished_at:new Date().toISOString() }).eq('id', jobId);
      });

      return json({ ok:true, job_id:jobId, fase, mode, agents:targets.length, message:`${targets.length} agentes lanzados en paralelo. Consulta con action:get_job` });
    }

    if (action === 'get_job') {
      const jobId = body.job_id as string;
      if (!jobId) return json({ ok:false, error:'Falta job_id' }, 400);
      const { data: job } = await svc.from('orchestrator_jobs').select('*').eq('id', jobId).single();
      if (!job) return json({ ok:false, error:'Job no encontrado' }, 404);
      return json({ ok:true, job });
    }

    if (action === 'run_single') {
      const bloqueId = body.bloque_id as string;
      const bloque = BLOQUES.find(b => b.id === bloqueId);
      if (!bloque) return json({ ok:false, error:`Bloque "${bloqueId}" no encontrado` }, 404);
      const header = await callClaude(bloque);
      return json({ ok:true, id:bloqueId, header, archivo:bloque.archivo });
    }

    return json({ ok:false, error:`Accion desconocida: "${action}"` }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[porra-orchestrator]', msg);
    return json({ ok:false, error:msg }, 500);
  }
});
