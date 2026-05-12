// supabase/functions/get-squad/index.ts — v6
// Cambios v5 → v6:
//   1. Schema squads ahora tiene 3 columnas nuevas: jugadores_is_final, jugadores_fuente, jugadores_synced_at.
//   2. El array `jugadores` puede contener PLANTILLA COMPLETA (23-55 jugadores) con flag es_titular,
//      en vez de exactamente los 11 titulares del XI.
//   3. Retrocompatibilidad: si el array tiene exactamente 11 elementos SIN flag es_titular,
//      se interpreta como formato v5 antiguo (XI directo).
//   4. Respuesta enriquecida con `plantilla` (array completo) + `plantilla_meta`.
//      Mantiene `jugadores` (11 elementos, XI titular) para no romper Pizarra Táctica actual.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/miniatures`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

// Mapping ISO3 → slug del badge en storage (5 selecciones sin badge: BIH, COD, CZE, IRQ, SWE)
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

type XIPlayer = { dorsal: number; nombre: string; posicion: string }
type PlantillaPlayer = {
  nombre: string
  club: string
  posicion_bucket: string
  es_titular: boolean
  posicion: string | null
  dorsal: number | null
  foto_url: string | null
  dob: string | null
  fuente: string
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
  return positions.map((pos, i) => ({ dorsal: i + 1, nombre: '—', posicion: pos }))
}

/**
 * Devuelve los 11 titulares (XI) a partir del array `jugadores` de la BBDD.
 *
 * Lógica:
 *   - Si el array tiene flag `es_titular` en al menos un elemento → filtrar es_titular=true.
 *   - Si el array tiene exactamente 11 elementos SIN flag → formato v5 antiguo, usar tal cual.
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
  return candidatos.map((j, i) => ({
    dorsal: typeof j.dorsal === 'number' ? j.dorsal : (i + 1),
    nombre: typeof j.nombre === 'string' && j.nombre.length > 0 ? j.nombre : '—',
    posicion: typeof j.posicion === 'string' && j.posicion.length > 0
      ? j.posicion
      : (positions[i] || 'MC'),
  }))
}

/**
 * Normaliza cada elemento del array jugadores (plantilla completa) al schema PlantillaPlayer.
 * Acepta tanto el formato nuevo (con bucket, club, etc.) como el formato v5 antiguo (solo XI).
 */
function buildPlantilla(jugadores: unknown): PlantillaPlayer[] {
  if (!Array.isArray(jugadores)) return []
  return jugadores.map((j) => {
    const r = (j ?? {}) as Record<string, unknown>
    return {
      nombre: typeof r.nombre === 'string' ? r.nombre : '',
      club: typeof r.club === 'string' ? r.club : '',
      posicion_bucket: typeof r.posicion_bucket === 'string' ? r.posicion_bucket : '',
      es_titular: r.es_titular === true,
      posicion: typeof r.posicion === 'string' && r.posicion.length > 0 ? r.posicion : null,
      dorsal: typeof r.dorsal === 'number' ? r.dorsal : null,
      foto_url: typeof r.foto_url === 'string' ? r.foto_url : null,
      dob: typeof r.dob === 'string' ? r.dob : null,
      fuente: typeof r.fuente === 'string' ? r.fuente : '',
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
    const xi = extractXI(data.jugadores, formacion)
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
      plantilla_completa: xi.some((j) => j.nombre !== '—'),   // bool legacy
      fuente: data.fuente,
      updated_at: data.updated_at,

      // === Campos nuevos v6 ===
      plantilla,                                              // array completo
      plantilla_meta: {
        n: plantilla.length,
        fuente: data.jugadores_fuente,                        // 'ff' | 'as' | 'fifa-official' | null
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
