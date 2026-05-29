// supabase/functions/get-squad/index.ts — v7.2
// Cambios v7.1 → v7.2 (Sprint A2 FIX C, Pizarra XI real, 29-may):
//   1. XIPlayer += foto_url + tm_player_id (el front Pizarra ya puede pintar
//      la foto circular del jugador; antes nunca llegaba foto al XI).
//   2. Nueva fuente autoritativa squads.xi (jsonb, 11 entradas ordenadas por
//      slot, construidas por sync-squads --build-xi). Si data.xi es un array de
//      11 → se mapea directamente (resuelve homónimos y el caso 9-10 titulares
//      que caía a placeholders). Si no → extractXI(jugadores) como antes, ahora
//      con foto_url poblada desde el propio jugador (renderXIRow). emptyXI sigue
//      como último fallback.
//
// --- v7.1 (anterior) ---
// Cambios v6 → v7 (Pieza D del sprint 20-may, schema canónico squads.jugadores):
//   1. PlantillaPlayer alineado al schema canónico: posicion (bucket) +
//      posicion_tm (específica TM, ej. 'Lateral derecho') + valor_eur
//      (int) + tm_player_id + club_logo_url.
//   2. `fuente` per-player eliminado del schema canónico (la fuente vive
//      en `squads.jugadores_fuente`); el EF ya no lo expone.
//   3. Compat: `posicion_bucket` se expone como alias de `posicion` por si
//      algún consumidor cacheado todavía lo lee. Retirar en v8 si confirmado
//      sin uso (frontend actual ya migrado en PR #81 Frente 4).
//
// Cambios v7 → v7.1 (fix pizarra, 20-may):
//   v7 puso `posicion_tm` (texto largo tipo 'Lateral derecho') en el campo
//   `posicion` del XI, rompiendo el frontend en ui-pizarra-tactica.js que:
//     a) hace `isGK === 'PO'` para detectar porteros (fallaba para enrichados)
//     b) usa j.posicion como label corto (2-3 chars) en la pastilla del jugador
//   v7.1 separa los dos campos en XIPlayer:
//     - `posicion`: SIEMPRE código corto de formación (PO/LD/DFC/MCD/...)
//     - `posicion_label`: específica TM o bucket como info adicional opcional
//   PlantillaPlayer NO afectado: sigue exponiendo `posicion` (bucket) +
//   `posicion_tm` (específica) sin cambios.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/miniatures`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const BADGE_SLUGS: Record<string, string | null> = {
  ALG: 'algeria', ARG: 'argentina', AUS: 'australia', AUT: 'austria',
  BEL: 'belgium', BIH: null, BRA: 'brazil', CAN: 'canada',
  CIV: 'ivory-coast', COD: null, COL: 'colombia', CPV: 'cape-verde',
  CRO: 'croatia', CUW: 'curacao', CZE: null, ECU: 'ecuador',
  EGY: 'egypt', ENG: 'england', ESP: 'spain', FRA: 'france',
  GER: 'germany', GHA: 'ghana', HAI: 'haiti', IRN: 'iran',
  IRQ: null, JOR: 'jordan', JPN: 'japan', KOR: 'south-korea',
  KSA: 'saudi-arabia', MAR: 'morocco', MEX: 'mexico', NED: 'netherlands',
  NOR: 'norway', NZL: 'new-zealand', PAN: 'panama', PAR: 'paraguay',
  POR: 'portugal', QAT: 'qatar', RSA: 'south-africa', SCO: 'scotland',
  SEN: 'senegal', SUI: 'switzerland', SWE: null, TUN: 'tunisia',
  TUR: 'turkey', URU: 'uruguay', USA: 'united-states', UZB: 'uzbekistan',
}

// v7.1 (20-may): `posicion` mantiene código corto de formación (PO/LD/DFC/MCD/...)
// para compatibilidad con frontend que espera ese formato (isGK === 'PO' check,
// labels cortos en pastilla del jugador). La específica TM se expone aparte en
// `posicion_label` para que el frontend pueda usarla opcionalmente sin romper layout.
type XIPlayer = {
  dorsal: number
  nombre: string
  posicion: string            // código corto de formación (PO/LD/DFC/...)
  posicion_label: string | null  // específica TM ('Lateral derecho') si disponible, null si no
  foto_url: string | null     // v7.2: foto circular del jugador en la Pizarra
  tm_player_id: number | null // v7.2: para lookup/badge-fallback en el front
}
type PlantillaPlayer = {
  nombre: string
  club: string | null
  club_logo_url: string | null
  posicion: string                  // bucket (Portero|Defensa|Centrocampista|Delantero)
  posicion_tm: string | null        // específica TM ('Lateral derecho'...)
  posicion_bucket: string           // alias retrocompat — eliminar en v8
  es_titular: boolean
  dob: string | null
  edad: number | null
  valor_eur: number | null
  dorsal: number | null
  tm_player_id: number | null
  foto_url: string | null
}

const POS_BY_FORMATION: Record<string, string[]> = {
  '4-3-3':    ['PO','LD','DFC','DFC','LI','MCD','MC','MCO','ED','DC','EI'],
  '4-4-2':    ['PO','LD','DFC','DFC','LI','ED','MC','MC','EI','DC','SD'],
  '4-2-3-1':  ['PO','LD','DFC','DFC','LI','MCD','MCD','ED','MCO','EI','DC'],
  '3-5-2':    ['PO','DFC','DFC','DFC','CAD','MC','MCD','MC','CAI','DC','SD'],
  '5-3-2':    ['PO','DFC','DFC','DFC','LD','LI','MC','MCD','MC','DC','SD'],
  '4-1-4-1':  ['PO','LD','DFC','DFC','LI','MCD','ED','MC','MC','EI','DC'],
  '4-3-2-1':  ['PO','LD','DFC','DFC','LI','MCD','MC','MC','MCO','MCO','DC'],
  '3-4-3':    ['PO','DFC','DFC','DFC','CAD','MC','MC','CAI','ED','DC','EI'],
  '5-4-1':    ['PO','DFC','DFC','DFC','LD','LI','ED','MC','MC','EI','DC'],
  '4-4-1-1':  ['PO','LD','DFC','DFC','LI','ED','MC','MC','EI','SD','DC'],
  '3-4-2-1':  ['PO','DFC','DFC','DFC','CAD','MC','MC','CAI','MCO','MCO','DC'],
  '4-1-3-2':  ['PO','LD','DFC','DFC','LI','MCD','MC','MCO','MC','DC','SD'],
}

function emptyXI(formacion: string): XIPlayer[] {
  const positions = POS_BY_FORMATION[formacion] || POS_BY_FORMATION['4-3-3']
  return positions.map((pos, i) => ({
    dorsal: i + 1, nombre: '—', posicion: pos, posicion_label: null, foto_url: null, tm_player_id: null,
  }))
}

/**
 * v7.2 — mapea la columna autoritativa squads.xi (array de 11 entradas
 * {slot,pos,nombre,dorsal,foto_url,tm_player_id,posicion_label}, ya ordenadas
 * por slot) a XIPlayer[]. El llamador valida length===11 antes de invocar.
 */
function xiFromColumn(xiArr: unknown[]): XIPlayer[] {
  return xiArr.map((raw, i) => {
    const j = (raw ?? {}) as Record<string, unknown>
    return {
      dorsal: typeof j.dorsal === 'number' ? j.dorsal : (i + 1),
      nombre: typeof j.nombre === 'string' && j.nombre.length > 0 ? j.nombre : '—',
      posicion: typeof j.pos === 'string' && j.pos.length > 0 ? j.pos : 'MC',
      posicion_label: typeof j.posicion_label === 'string' ? j.posicion_label : null,
      foto_url: typeof j.foto_url === 'string' ? j.foto_url : null,
      tm_player_id: typeof j.tm_player_id === 'number' ? j.tm_player_id : null,
    }
  })
}

/**
 * Renderiza la posición visible del XI:
 *   - `posicion`: SIEMPRE el código corto de formación (PO/LD/DFC/...). El frontend
 *     espera este formato para `isGK === 'PO'` y para la pastilla del jugador en la
 *     pizarra (texto corto, 2-3 chars). NO usar valores largos aquí o se rompe el
 *     layout y los checks de portero.
 *   - `posicion_label`: específica TM ('Lateral derecho') si disponible, null si no.
 *     El frontend puede usar este campo OPCIONALMENTE para mostrar la posición
 *     específica en tooltip, modal de plantilla, etc.
 *
 * v7.0 (20-may inicial) puso posicion_tm en `posicion` rompiendo la pizarra.
 * v7.1 (20-may fix) separa los dos campos.
 */
function renderXIRow(
  j: Record<string, unknown>,
  fallbackPos: string,
  i: number,
): XIPlayer {
  const posTm = typeof j.posicion_tm === 'string' && j.posicion_tm.length > 0 ? j.posicion_tm : null
  const posBucket = typeof j.posicion === 'string' && j.posicion.length > 0 ? j.posicion : null
  return {
    dorsal: typeof j.dorsal === 'number' ? j.dorsal : (i + 1),
    nombre: typeof j.nombre === 'string' && j.nombre.length > 0 ? j.nombre : '—',
    posicion: fallbackPos,                    // SIEMPRE código corto (PO/LD/DFC/...)
    posicion_label: posTm || posBucket || null, // específica TM o bucket como info adicional
    // v7.2: el jugador del roster ya trae foto/tm (enrich TM) → el fallback
    // extractXI también pinta foto sin lookup extra.
    foto_url: typeof j.foto_url === 'string' ? j.foto_url : null,
    tm_player_id: typeof j.tm_player_id === 'number' ? j.tm_player_id : null,
  }
}

/**
 * Devuelve los 11 titulares (XI) a partir del array `jugadores` de la BBDD.
 *   - Si hay flag `es_titular` en al menos un elemento → filtrar es_titular=true.
 *   - Si el array tiene exactamente 11 elementos SIN flag → formato v5 antiguo.
 *   - Caso contrario → placeholders desde formación.
 */
function extractXI(jugadores: unknown, formacion: string): XIPlayer[] {
  if (!Array.isArray(jugadores) || jugadores.length === 0) {
    return emptyXI(formacion)
  }

  const hasFlag = jugadores.some(
    (j) => j && typeof (j as Record<string, unknown>).es_titular === 'boolean'
  )

  let candidatos: Record<string, unknown>[]
  if (hasFlag) {
    candidatos = (jugadores as Record<string, unknown>[]).filter(
      (j) => j.es_titular === true
    )
  } else if (jugadores.length === 11) {
    candidatos = jugadores as Record<string, unknown>[]
  } else {
    return emptyXI(formacion)
  }

  if (candidatos.length !== 11) {
    return emptyXI(formacion)
  }

  const positions = POS_BY_FORMATION[formacion] || POS_BY_FORMATION['4-3-3']
  return candidatos.map((j, i) => renderXIRow(j, positions[i] || 'MC', i))
}

/**
 * Normaliza cada elemento del array jugadores al schema canónico PlantillaPlayer.
 */
function buildPlantilla(jugadores: unknown): PlantillaPlayer[] {
  if (!Array.isArray(jugadores)) return []
  return jugadores.map((j) => {
    const r = (j ?? {}) as Record<string, unknown>
    const posicion = typeof r.posicion === 'string' ? r.posicion : ''
    return {
      nombre: typeof r.nombre === 'string' ? r.nombre : '',
      club: typeof r.club === 'string' ? r.club : null,
      club_logo_url: typeof r.club_logo_url === 'string' ? r.club_logo_url : null,
      posicion,
      posicion_tm: typeof r.posicion_tm === 'string' ? r.posicion_tm : null,
      posicion_bucket: posicion,
      es_titular: r.es_titular === true,
      dob: typeof r.dob === 'string' ? r.dob : null,
      edad: typeof r.edad === 'number' ? r.edad : null,
      valor_eur: typeof r.valor_eur === 'number' ? r.valor_eur : null,
      dorsal: typeof r.dorsal === 'number' ? r.dorsal : null,
      tm_player_id: typeof r.tm_player_id === 'number' ? r.tm_player_id : null,
      foto_url: typeof r.foto_url === 'string' ? r.foto_url : null,
    }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const iso3 = url.searchParams.get('iso3')?.toUpperCase()
    const iso2 = url.searchParams.get('iso2')?.toUpperCase()

    if (!iso3 && !iso2) {
      return new Response(JSON.stringify({ error: 'iso3 o iso2 requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false }
    })

    const filter = iso3 ? { col: 'iso3', val: iso3 } : { col: 'iso2', val: iso2! }
    const { data, error } = await supabase
      .from('squads')
      .select('*')
      .eq(filter.col, filter.val)
      .single()

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'Selección no encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const formacion = data.formacion || '4-3-3'
    // v7.2: squads.xi (construida por --build-xi) es la fuente autoritativa del
    // XI para la Pizarra; si está completa (11) se usa, si no se deriva de
    // es_titular como antes (ahora con foto vía renderXIRow).
    const xi = (Array.isArray(data.xi) && data.xi.length === 11)
      ? xiFromColumn(data.xi)
      : extractXI(data.jugadores, formacion)
    const plantilla = buildPlantilla(data.jugadores)

    const badgeSlug = BADGE_SLUGS[data.iso3]

    const teamData = {
      // === Campos compat v5 (frontend Pizarra Táctica los consume) ===
      iso3: data.iso3,
      iso2: data.iso2,
      equipo: data.equipo,
      formacion: data.formacion,
      entrenador: data.entrenador,
      badge_url: badgeSlug ? `${STORAGE_BASE}/badges/${badgeSlug}.png` : null,
      flag_url: `${STORAGE_BASE}/flags-sm/${data.iso2}.webp`,
      color_ficha: data.color_ficha || 'white',
      color_portero: data.color_portero || '#f5c518',
      stats: {
        edad: data.stat_edad ? Number(data.stat_edad) : null,
        valor: data.stat_valor,
        goles: data.stat_goles ? Number(data.stat_goles) : null,
        goles_periodo: 'desde Mundial Qatar 2022',
      },
      jugadores: xi,                                          // XI titular (11)
      plantilla_completa: xi.some((j) => j.nombre !== '—'),
      fuente: data.fuente,
      updated_at: data.updated_at,

      // === Campos v6+ ===
      plantilla,
      plantilla_meta: {
        n: plantilla.length,
        fuente: data.jugadores_fuente,
        is_final: !!data.jugadores_is_final,
        synced_at: data.jugadores_synced_at,
      },
    }

    return new Response(JSON.stringify(teamData), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    })
  } catch (err) {
    console.error('get-squad error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
