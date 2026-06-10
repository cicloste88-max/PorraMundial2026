// Versionado desde runtime el 10-jun-2026 (v3). Origen: deploy vía MCP sin commit previo.
// Fuente de verdad hasta esta fecha: runtime Supabase. A partir de ahora: este fichero.
// supabase/functions/get-match-stats/index.ts — v1 (sprint 2B, 27-may-2026)
// Datos comparativos para la pantalla 'Datos del partido' de Jornada (tarjeta-stats.js).
// Input: ?match_key=A_México_Sudáfrica  (formato grupo_homeEs_awayEs)
// Output: payload con form, stats (7 métricas), h2h con detalle, league consensus, myPick.
//
// Fuentes:
//  - ia_elo_fifa            → fifaRank
//  - ia_last5_results       → form (WWDWL), goalsFor/Ag avg, winRate 12m
//  - squads                 → avgAge, value (€M)
//  - ia_h2h + matches_detail → h2h con últimos 5 partidos individuales
//  - predictions agregadas  → league consensus (pct1/X/2 + topScore + myPick)
//  - _h2h_scrape_map        → name_11v11 para mapear home/away en matches_detail
//
// Possession: placeholder {a:50, b:50} hasta tener fuente (decisión San 27-may).
// Auth: verify_jwt=false + manual supabase.auth.getUser(jwt) para myPick.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const ES_TO_ISO3: Record<string, string> = {
  'Argelia':'ALG','Argentina':'ARG','Australia':'AUS','Austria':'AUT',
  'Bélgica':'BEL','Bosnia y Herzegovina':'BIH','Brasil':'BRA','Canadá':'CAN',
  'Costa de Marfil':'CIV','RD Congo':'COD','Colombia':'COL','Cabo Verde':'CPV',
  'Croacia':'CRO','Curazao':'CUW','Chequia':'CZE','República Checa':'CZE',
  'Ecuador':'ECU','Egipto':'EGY','Inglaterra':'ENG','España':'ESP',
  'Francia':'FRA','Alemania':'GER','Ghana':'GHA','Haití':'HAI',
  'RI de Irán':'IRN','Irán':'IRN','Irak':'IRQ','Japón':'JPN',
  'Jordania':'JOR','República de Corea':'KOR','Corea del Sur':'KOR',
  'Arabia Saudí':'KSA','Marruecos':'MAR','México':'MEX','Países Bajos':'NED',
  'Holanda':'NED','Noruega':'NOR','Nueva Zelanda':'NZL','Panamá':'PAN',
  'Paraguay':'PAR','Portugal':'POR','Catar':'QAT','Sudáfrica':'RSA',
  'Escocia':'SCO','Senegal':'SEN','Suiza':'SUI','Suecia':'SWE',
  'Túnez':'TUN','Turquía':'TUR','Uruguay':'URU','Estados Unidos':'USA',
  'Uzbekistán':'UZB',
}

function parseMatchKey(mk: string): { grp: string; homeEs: string; awayEs: string } | null {
  const parts = mk.split('_')
  if (parts.length !== 3) return null
  return { grp: parts[0], homeEs: parts[1], awayEs: parts[2] }
}

function parseMarketValue(text: string | null | undefined): number | null {
  if (!text) return null
  const m = String(text).match(/([\d.,]+)\s*(B|M|K)?/i)
  if (!m) return null
  let n = parseFloat(m[1].replace(',', '.'))
  if (isNaN(n)) return null
  const mult = (m[2] || 'M').toUpperCase()
  if (mult === 'B') n *= 1000
  if (mult === 'K') n /= 1000
  return Math.round(n)
}

function lastN<T>(arr: T[], n: number): T[] {
  return arr.slice(Math.max(0, arr.length - n))
}

function computeFormStr(results: any[]): string {
  if (!Array.isArray(results) || results.length === 0) return ''
  const sorted = [...results].sort((a, b) => (a.date < b.date ? -1 : 1))
  return lastN(sorted, 5).map((r) => r.result || '').join('')
}

function computeGoalsAvg(results: any[]): { for_: number; ag: number } {
  if (!Array.isArray(results) || results.length === 0) return { for_: 0, ag: 0 }
  const sumGf = results.reduce((s, r) => s + (r.gf || 0), 0)
  const sumGa = results.reduce((s, r) => s + (r.ga || 0), 0)
  return {
    for_: +(sumGf / results.length).toFixed(1),
    ag: +(sumGa / results.length).toFixed(1),
  }
}

function computeWinRate12m(results: any[]): number {
  if (!Array.isArray(results) || results.length === 0) return 0
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const cutoff = oneYearAgo.toISOString().slice(0, 10)
  const recent = results.filter((r) => (r.date || '') >= cutoff)
  if (recent.length === 0) return 0
  const wins = recent.filter((r) => r.result === 'W').length
  return Math.round((wins / recent.length) * 100)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const matchKey = url.searchParams.get('match_key')
    if (!matchKey) {
      return new Response(JSON.stringify({ error: 'match_key requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const parsed = parseMatchKey(matchKey)
    if (!parsed) {
      return new Response(JSON.stringify({ error: 'match_key formato inválido (esperado grupo_homeEs_awayEs)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const isoA = ES_TO_ISO3[parsed.homeEs]
    const isoB = ES_TO_ISO3[parsed.awayEs]
    if (!isoA || !isoB) {
      return new Response(
        JSON.stringify({ error: 'Equipo no mapeado', homeEs: parsed.homeEs, awayEs: parsed.awayEs }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    // myPick: validar JWT manualmente para obtener user_id (verify_jwt=false workaround)
    let userId: string | null = null
    const authHeader = req.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const jwt = authHeader.slice(7)
      try {
        const { data: userData } = await supabase.auth.getUser(jwt)
        if (userData?.user) userId = userData.user.id
      } catch (_e) {
        // JWT inválido → myPick null, no error
      }
    }

    // Queries paralelas
    const [eloRes, last5Res, squadsRes, h2hRes, predRes, userPredRes, mapRes] = await Promise.all([
      supabase.from('ia_elo_fifa').select('team_code, rank_position').in('team_code', [isoA, isoB]),
      supabase.from('ia_last5_results').select('team_code, results').in('team_code', [isoA, isoB]),
      supabase.from('squads').select('iso3, stat_edad, stat_valor').in('iso3', [isoA, isoB]),
      supabase.from('ia_h2h').select('*').or(
        `and(team_a_code.eq.${isoA},team_b_code.eq.${isoB}),and(team_a_code.eq.${isoB},team_b_code.eq.${isoA})`,
      ).maybeSingle(),
      supabase.from('predictions').select('local, visitante').eq('match_id', matchKey),
      userId
        ? supabase.from('predictions').select('local, visitante').eq('match_id', matchKey).eq('user_id', userId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('_h2h_scrape_map').select('iso3, name_11v11').in('iso3', [isoA, isoB]),
    ])

    // 1. FIFA Rank
    const eloByCode = new Map((eloRes.data || []).map((r: any) => [r.team_code, r.rank_position]))
    const fifaRank = { a: eloByCode.get(isoA) ?? null, b: eloByCode.get(isoB) ?? null }

    // 2-4. Form + goals + winRate desde ia_last5_results
    const last5ByCode = new Map((last5Res.data || []).map((r: any) => [r.team_code, r.results || []]))
    const resultsA = (last5ByCode.get(isoA) || []) as any[]
    const resultsB = (last5ByCode.get(isoB) || []) as any[]
    const form = { a: computeFormStr(resultsA), b: computeFormStr(resultsB) }
    const ga = computeGoalsAvg(resultsA)
    const gb = computeGoalsAvg(resultsB)
    const goalsFor = { a: ga.for_, b: gb.for_ }
    const goalsAg = { a: ga.ag, b: gb.ag }
    const winRate = { a: computeWinRate12m(resultsA), b: computeWinRate12m(resultsB) }

    // 5. Squads
    const squadByCode = new Map((squadsRes.data || []).map((r: any) => [r.iso3, r]))
    const sqA: any = squadByCode.get(isoA) || {}
    const sqB: any = squadByCode.get(isoB) || {}
    const avgAge = {
      a: sqA.stat_edad != null ? Number(sqA.stat_edad) : null,
      b: sqB.stat_edad != null ? Number(sqB.stat_edad) : null,
    }
    const value = {
      a: parseMarketValue(sqA.stat_valor),
      b: parseMarketValue(sqB.stat_valor),
    }

    // 6. H2H — transforma matches_detail a perspectiva A
    const nameByCode = new Map((mapRes.data || []).map((r: any) => [r.iso3, r.name_11v11]))
    const nameA = nameByCode.get(isoA)
    let h2h: any = null
    let h2h_status: 'never_played' | 'has_detail' | 'aggregates_only' = 'never_played'
    let h2h_never_played = false

    if (h2hRes.data) {
      const row: any = h2hRes.data
      h2h_never_played = row.never_played === true

      if (h2h_never_played) {
        h2h_status = 'never_played'
        h2h = null
      } else {
        const aIsA = row.team_a_code === isoA
        const aWins = aIsA ? row.team_a_wins : row.team_b_wins
        const bWins = aIsA ? row.team_b_wins : row.team_a_wins
        const draws = row.draws || 0

        let last: any[] = []
        if (Array.isArray(row.matches_detail) && row.matches_detail.length > 0) {
          last = lastN(row.matches_detail, 5).reverse().map((m: any) => {
            const aIsHome = m.home_team === nameA
            return {
              date: (m.date_iso || '').slice(0, 4),
              comp: m.competition || '',
              scoreA: aIsHome ? m.score_home : m.score_away,
              scoreB: aIsHome ? m.score_away : m.score_home,
            }
          })
          h2h_status = 'has_detail'
        } else {
          h2h_status = 'aggregates_only'
        }

        h2h = { aWins, draws, bWins, last }
      }
    }

    // 7. League consensus
    const allPreds = (predRes.data || []) as any[]
    const total = allPreds.length
    let c1 = 0,
      cX = 0,
      c2 = 0
    const scoreCounts = new Map<string, number>()
    for (const p of allPreds) {
      const l = p.local ?? 0
      const v = p.visitante ?? 0
      if (l > v) c1++
      else if (l < v) c2++
      else cX++
      const key = `${l}-${v}`
      scoreCounts.set(key, (scoreCounts.get(key) || 0) + 1)
    }
    let pct1 = 0,
      pctX = 0,
      pct2 = 0
    if (total > 0) {
      pct1 = Math.round((c1 / total) * 100)
      pct2 = Math.round((c2 / total) * 100)
      pctX = Math.max(0, 100 - pct1 - pct2)
    }
    let topScore: { label: string; count: number } | null = null
    let maxCount = 0
    for (const [key, count] of scoreCounts.entries()) {
      if (count > maxCount) {
        maxCount = count
        topScore = { label: key.replace('-', ' — '), count }
      }
    }

    // 8. myPick
    let myPick: '1' | 'X' | '2' | null = null
    if (userPredRes && (userPredRes as any).data) {
      const p: any = (userPredRes as any).data
      const l = p.local ?? 0
      const v = p.visitante ?? 0
      myPick = l > v ? '1' : l < v ? '2' : 'X'
    }

    const payload = {
      home_iso: isoA,
      away_iso: isoB,
      form,
      stats: {
        fifaRank,
        goalsFor,
        goalsAg,
        possession: { a: 50, b: 50 },
        winRate,
        avgAge,
        value,
      },
      h2h,
      h2h_status,
      h2h_never_played,
      league: { total, pct1, pctX, pct2, myPick, topScore },
      meta: { possession_placeholder: true, generated_at: new Date().toISOString() },
    }

    return new Response(JSON.stringify(payload), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    })
  } catch (err) {
    console.error('get-match-stats error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
