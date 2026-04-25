# CHANGELOG — Porra Mundial 2026

Retención 90d. Auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB.

## Histórico migrado del CLAUDE.md (24 abr 2026)

### Saga F5 v2.1 → v2.11 (3 capas defensivas, 20 abr 2026)

**Persistencia última página al F5** ✅ (HEAD `8bc7f30`).

F5/Ctrl+R en cualquier página (Grupos / Eliminatorias / Score / Admin) restaura la página donde el user estaba, sin flash welcome ni splash. Solo afecta a refresh con sesión válida; login fresco va a welcome por semántica.

**Diagnóstico final** (caza con MutationObserver, ver ERR-23): `#page-welcome` mutaba a `display:block` en T=612ms y volvía a `display:none` en T=1115ms — 503ms de flash. Causa: `main-entry.js:74` safety-net llamaba `showPage('welcome')` sin guard, lo que disparaba la lógica que retiraba el CSS lock de v2.9 antes de tiempo.

**Solución belt & suspenders en 3 capas:**

- **Capa 0 — `index.html` `<head>` (v2.6 + v2.8 + v2.9):** script inline síncrono lee `localStorage.porra_lastPage`, setea `window._pendingPageRestore`, salta el splash si hay restore, e inyecta `<style id="restore-lock-css">#page-welcome{display:none !important}</style>`.
- **Capa 1 — `main-entry.js:74-78` (v2.11):** safety-net con guard `if (!window._pendingPageRestore) showPage('welcome')`. Impide flash desde el chain.
- **Capa 2 — `public/js/ui-nav.js` `showPage()` (v2.10):** `if (lock && page==='welcome') return; if (lock && page!=='welcome') lock.remove()`. Lock self-healing: rogue `showPage('welcome')` no rompe el restore; `showPage(target)` retira el lock al pintar la página real.
- **Plus — `public/js/auth.js:325-339` (v2.1):** `onAuthStateChange` consume `_pendingPageRestore` solo en `INITIAL_SESSION` (no `SIGNED_IN`), revalidación admin explícita, ruta única `setTimeout(100) → showPage(finalPage)`.
- **Plus — `auth.js:349` (v2.7):** guard `if (!window._pendingPageRestore) showPage('welcome')` en arranque inicial + fallback en rama `else` por si la sesión está caducada.
- **Plus — `index.html:251` (v2.4):** `<div id="page-welcome" style="display:none">` (las otras 4 páginas ya lo tenían; welcome era la única visible por defecto).

**Limpieza key:** `porra_lastPage` con underscore — entra en barrido de `doLogout` (`auth.js:286`, `.includes('porra_')`).

**Diagrama del flujo de arranque con restore:**

```
T=0    HTML parse → <script inline> setea _pendingPageRestore + CSS lock + skip splash
T=~50  module bundle + chain → main-entry safety-net guard skipea welcome (capa 1)
T=~50  auth.js runAuthInit → guard skipea welcome (v2.7) + onAuthStateChange registrado
T=~60  Supabase emite INITIAL_SESSION → handler arranca await loadUserData
T=~500 loadUserData resuelve → consume _pendingPageRestore=null → setTimeout(100)
T=~600 showPage(target) → capa 2 retira lock + display:block en target
```

**Limitación aceptada:** ~500-600ms de pantalla oscura (background body) entre T=0 y `showPage(target)`. Aceptable porque no es welcome y no llama la atención. Si se queja en 3G, v3 con hidratación optimista de `currentUser` + `_activeLeague` desde localStorage.

**Limitaciones conocidas (sin resolver):** sub-tab Vista Directo no se preserva (vuelve a Grupos), scroll position no se preserva, URL siempre `/`. Multi-tab: `localStorage` compartido, gana último que escribe.

**Saga ruidosa pero documentada:** 11 iteraciones (v2.1 → v2.11) con varios reverts intermedios. Historia git no se squashea — los reverts documentan el aprendizaje.

### IA Predictor — Fases A–F (cronología commit-by-commit, 21-23 abr 2026)

| Fase | Acción | Commit | Estado |
|---|---|---|---|
| A | Migración 4 tablas + EF esqueleto | `968332a` (PR #10) | merged + aplicada |
| B | scrape_elo via `inside.fifa.com` | `4a32737` (PR #11) | deprecada por B.2 |
| B.2 | scrape_elo via Wikipedia Module | `c845f3e` (PR #12) | merged + desplegada |
| D | scrape_h2h via Wikipedia all-time_record | `cba5dcc` (PR #13) | deprecada por D.2 (ver ERR-24) |
| D.2 | scrape_h2h via 11v11.com/stats | `bbad657` (PR #14) | merged + desplegada |
| C | scrape_last_n via 11v11.com/matches | `2904025` (squash-merge de PR #15) | merged + desplegada |
| E | Motor IA log-odds+softmax + snapshots + compute_* | `8d8b667` (PR #16) | merged + desplegada (EF v9). Paridad Python↔TS 46/46 verde. |
| F | wiring frontend `auth.js` + `scoring.js` + `ko.js` + `data.js` | PR #17 `6b06880` (squash-merge a main, F.1–F.4) | merged |
| F.2b | simplificar chip `.ia-hint` tras QA | `eb729e7` | deprecado tras post-F.2 |
| post-F.1 | enriquecer `breakdown` de `ia_predictions` con raw context (ELO/H2H/forma/is_host) | `fb22648` + EF v10 vía supabase CLI (ERR-29) + compute_groups 72/72 | merged en rama + desplegado |
| post-F.2 | eliminar chip `.ia-hint` + extraer `hydrateIABar` + doc ERR-29 | `8dd691c` | smoke manual verde |
| post-F.3 | tooltip explainer en el % (`buildIAExplainer`, hover desktop / click mobile) + cierre Fase F | `6e46d2b` | Fase F COMPLETA |
| (cierre) | Doc sweep CLAUDE.md + CONTEXTO + migration-log | `a079fda` / `a24001a` | main fast-forward `615e52a → a24001a` |

**Estado tablas al cierre post-F (23 abr noche):** `ia_elo_fifa` 211 · `ia_h2h` 815 · `ia_last5_results` 48 · `ia_snapshots` 2 (1 activo: `initial_test_21apr`) · `ia_predictions` 72 partidos de grupos poblados por `compute_groups` con breakdown enriquecido (`elo_*_raw`, `h2h_*`, `form_*_ppg`, `is_host`) + entradas on-demand KO residuales (se repoblarán al freeze del 11 jun).

**Lecciones registradas en `errores_conocidos_porra.md`:** ERR-24 (Wikipedia inadecuada para H2H masivo — sólo ~3/48 tienen página `_all-time_record`); ERR-25 (3 headers obligatorios para 11v11.com); ERR-26 (`pg_net` sin PUT — bloquea merge vía GitHub API desde Supabase); ERR-27 (`vault.decrypted_secrets` no enruta; fix vía RPC `get_vault_secrets`); ERR-29 (MCP `deploy_edge_function` rompe con payloads >70KB).
