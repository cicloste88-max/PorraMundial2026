// supabase/functions/get-league-standings/fetch-all.mjs
// Helper de paginación PostgREST — módulo PURO compartido Deno/Node (patrón
// select.mjs de get-league-highlights, PR #148).
//
// Motivo (ERR-86): PostgREST corta silenciosamente en db-max-rows (1000 en
// Supabase por defecto). Porra gallos = 17 usuarios × 72 partidos = 1224 filas
// de predictions: un SELECT plano dejaba a 3 usuarios completos + 1 parcial
// fuera del scoreboard, según orden físico del heap (no determinista).
//
// Contrato: pageFn(from, to) ejecuta UNA página y devuelve la promesa
// PostgREST `{ data, error }` con `.range(from, to)` aplicado por el caller.
// El caller DEBE aplicar también `.order()` por columna(s) únicas en pageFn:
// .range() pagina por offset y sin orden estable puede duplicar/saltar filas.
//
// Devuelve { rows, pages } o lanza Error con el mensaje PostgREST.

export const PAGE_SIZE = 1000;

export async function fetchAllRows(pageFn, pageSize = PAGE_SIZE) {
  const rows = [];
  let pages = 0;
  for (;;) {
    const from = pages * pageSize;
    const { data, error } = await pageFn(from, from + pageSize - 1);
    if (error) throw new Error(error.message || String(error));
    const batch = data ?? [];
    rows.push(...batch);
    pages += 1;
    if (batch.length < pageSize) break;
  }
  return { rows, pages };
}
