"""Fetch HTML for all primary sources using Scrapling.

Writes each source HTML to cache/sources/<source>.html for sync-squads.mjs
parsers to read. Designed to run as a GH Actions step BEFORE node runs.

Methods (per source, validated 22-may con probes 26279588881/26281337027/
26293035353/26293757651):
  - sport, olympics, marca → Fetcher.get(impersonate='chrome')  (curl_cffi, ~50-2000ms)
  - as, espn, ff-*         → StealthyFetcher.fetch(solve_cloudflare=False)  (~3-7s)

Eurosport descartada: server-side geoblock 307 → /geoblocking.shtml desde IPs
USA, irresoluble client-side. ESPN Deportes (Disney/Hearst) la reemplaza.

FF (futbolfantasy.com) — scaling 28-may-2026:
- 48 países WC 2026 leídos desde scripts/lib/iso3-slugs.json (canonical, DRY).
- Cloudflare en FF bloquea Fetcher.get(impersonate) en IPs USA, requiere
  StealthyFetcher (validado 27-may con ESP piloto).
- Paralelización ProcessPool max_workers=3 para mantener wall time <10 min:
  48 fuentes × ~30s serial = 24 min → 48/3 ≈ 8 min con workers.
  ProcessPool (no ThreadPool): Playwright sync_api usa greenlets que NO son
  thread-safe; cada worker necesita su propio event loop. mp_context='spawn'
  fuerza fresh Python por worker (evita fork-state issues con browsers).
- Países sin XI publicado: FF devuelve /alineaciones/0.jpg → parser detecta y
  retorna []. Coste: fetch malgastado (~30s) pero no daño.

Exit codes:
  0  → all sources OK (markers >=3, bytes > 10K)
  2  → partial failure (≥1 fuente con cache vacío). NO interrumpe el job —
       sync-squads.mjs detectará caches vacíos y skip por fuente.

El script NUNCA hace raise sobre fallos individuales: escribe un fichero
vacío como sentinel y loga a stderr, para que el motor Node pueda fallback
a las fuentes que sí cargaron.
"""

import sys
import time
import json
import multiprocessing as mp
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed

from scrapling.fetchers import Fetcher, StealthyFetcher

# Fuentes primarias del cross-validate detect (5 fuentes Mundial 2026).
# Tuple: (url, method, markers_list). Markers verifican que es la página real.
PRIMARY_MARKERS = ["deschamps", "ancelotti", "yakin", "francia", "alemania", "convocados", "selecci"]

SOURCES = {
    "sport":    ("https://www.sport.es/es/noticias/mundial-futbol/listas-convocados-mundial-2026-jugadores-plantillas-selecciones-130245904", "impersonate", PRIMARY_MARKERS),
    "olympics": ("https://www.olympics.com/es/noticias/mundial-2026-listas-48-selecciones", "impersonate", PRIMARY_MARKERS),
    "marca":    ("https://www.marca.com/futbol/mundial/2026/05/16/convocatorias-oficiales-selecciones-disputaran-mundial.html", "impersonate", PRIMARY_MARKERS),
    "as":       ("https://as.com/futbol/mundial/listas-de-convocados-para-el-mundial-2026-selecciones-y-todos-los-jugadores-que-estaran-en-la-copa-del-mundo-f202605-n-2/", "stealthy", PRIMARY_MARKERS),
    "espn":     ("https://espndeportes.espn.com/futbol/mundial/nota/_/id/16715015/mundial-2026-convocatorias-de-selecciones-todas-las-listas-de-jugadores", "stealthy", PRIMARY_MARKERS),
}

# Markers para FF: presencia del contenedor del XI tipo + términos del sitio.
# "jugadores-titulares-" es el prefijo de la class del <div> que envuelve los
# 11 slots (sufijo numérico cambia por seleccionador, ver brief 27-may).
FF_MARKERS = ["jugadores-titulares-", "once tipo", "futbolfantasy", "alineac"]

# FF_COUNTRIES — leer desde scripts/lib/iso3-slugs.json (canonical, single source
# of truth compartido con Node parsers). 48 países WC 2026. Países sin lista
# publicada: FF servirá /alineaciones/0.jpg → parser retorna [] (no daño).
_REPO_ROOT = Path(__file__).resolve().parents[2]
with open(_REPO_ROOT / "scripts" / "lib" / "iso3-slugs.json", encoding="utf-8") as _f:
    FF_COUNTRIES = json.load(_f)

# Filtro opcional vía env var ISO3_FILTER (CSV de iso3 mayúsculas, mismo formato
# que el input iso3_filter del workflow_dispatch). Cuando se establece, sólo se
# fetchea FF para esos países — las 5 primarias siempre se fetchean (son índices
# HTML con todos los países; Node filtra después en cross-validate).
#
# Caso de uso: dispatches acotados (e.g. iso3_filter=JPN,BEL,BIH,SWE) — sin
# este filtro, Python intenta fetchear las 48 FF aunque Node sólo procese 4,
# lo que excede el timeout 15 min del job (validado en run 26549858215 que
# fue cancelado a 15m24s con sólo URU acabando, los 4 últimos sin fetchear).
import os as _os
_iso3_filter_raw = _os.environ.get("ISO3_FILTER", "").strip().upper()
if _iso3_filter_raw:
    _allowed = {x.strip() for x in _iso3_filter_raw.split(",") if x.strip()}
    _before = len(FF_COUNTRIES)
    FF_COUNTRIES = {k: v for k, v in FF_COUNTRIES.items() if k in _allowed}
    print(
        f"[INFO] ISO3_FILTER={_iso3_filter_raw} aplicado: "
        f"FF_COUNTRIES {_before}→{len(FF_COUNTRIES)} países",
        file=sys.stderr,
    )

for iso3, slug in FF_COUNTRIES.items():
    SOURCES[f"ff-{iso3.lower()}"] = (
        f"https://www.futbolfantasy.com/world-cup/equipos/{slug}",
        "stealthy-ff",
        FF_MARKERS,
    )

CACHE_DIR = Path("cache/sources")


def fetch(method, url):
    if method == "impersonate":
        return Fetcher.get(url, timeout=30, impersonate="chrome", stealthy_headers=True)
    if method == "stealthy":
        # AS/ESPN: rinden bien con load + network_idle en <10s.
        return StealthyFetcher.fetch(
            url,
            headless=True,
            network_idle=True,
            timeout=45000,
            solve_cloudflare=False,
            google_search=False,
        )
    if method == "stealthy-ff":
        # FF (futbolfantasy.com): página con muchos trackers/analytics que
        # mantienen network ocupado >45s → first attempt timeoutea esperando
        # `load`. Validado en run 27-may 20:46 UTC (1 retry necesario, 98s
        # total). Fix: network_idle=False (no espera idle, solo DOM listo)
        # + timeout 60s margen para el load inicial. Esperado: 1 attempt
        # ~25-40s sin retry.
        return StealthyFetcher.fetch(
            url,
            headless=True,
            network_idle=False,
            timeout=60000,
            solve_cloudflare=False,
            google_search=False,
        )
    raise ValueError(f"unknown method: {method}")


def extract_html(page):
    """Devuelve string con el HTML. Prefiere page.html_content (Scrapling devuelve
    repr() en str(page), bug detectado en probe v2)."""
    if page is None:
        return ""
    for attr in ("html_content", "body", "content"):
        if hasattr(page, attr):
            val = getattr(page, attr)
            if val is None:
                continue
            if isinstance(val, bytes):
                return val.decode("utf-8", errors="replace")
            if isinstance(val, str) and val:
                return val
    return ""


def process_one(source, url, method, markers_list):
    """Procesa una fuente: fetch, valida markers, escribe a cache.

    Función top-level (no closure) para que ProcessPoolExecutor pueda
    pickearla. Devuelve (source, summary_dict, failed_bool, log_line).
    """
    t0 = time.time()
    target = CACHE_DIR / f"{source}.html"
    try:
        page = fetch(method, url)
        html = extract_html(page)
        elapsed_ms = int((time.time() - t0) * 1000)
        html_lower = html.lower()
        markers = [m for m in markers_list if m in html_lower]
        ok = len(markers) >= 3 and len(html) > 10_000

        if ok:
            target.write_text(html, encoding="utf-8")
            return (
                source,
                {"ok": True, "bytes": len(html), "ms": elapsed_ms, "markers": markers[:5]},
                False,
                f"[OK]   {source:12} bytes={len(html):7} ms={elapsed_ms:5} markers={markers[:3]}",
            )
        target.write_text("", encoding="utf-8")
        return (
            source,
            {
                "ok": False,
                "bytes": len(html),
                "ms": elapsed_ms,
                "reason": "no_markers_or_tiny",
                "markers": markers,
            },
            True,
            f"[FAIL] {source:12} bytes={len(html):7} ms={elapsed_ms:5} markers={markers}",
        )
    except Exception as e:
        target.write_text("", encoding="utf-8")
        return (
            source,
            {"ok": False, "error": str(e)[:200]},
            True,
            f"[ERR]  {source:12} {e}",
        )


def main():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    summary = {}
    any_failed = False

    # Split: FF en paralelo (hasta 48 fuentes), primarias en serie (solo 5).
    ff_sources = [(k, v) for k, v in SOURCES.items() if v[1] == "stealthy-ff"]
    primary_sources = [(k, v) for k, v in SOURCES.items() if v[1] != "stealthy-ff"]

    # Primarias serial: 5 fuentes ~80s. No vale la pena paralelizar.
    for source, (url, method, markers_list) in primary_sources:
        src, smry, failed, line = process_one(source, url, method, markers_list)
        summary[src] = smry
        any_failed = any_failed or failed
        print(line, file=sys.stderr)

    # FF paralelo: 48 fuentes / 3 workers ≈ 8 min wall time.
    if ff_sources:
        print(
            f"[INFO] FF paralelo: {len(ff_sources)} fuentes, workers=3, spawn ctx",
            file=sys.stderr,
        )
        ctx = mp.get_context("spawn")
        with ProcessPoolExecutor(max_workers=3, mp_context=ctx) as executor:
            futures = {
                executor.submit(process_one, src, entry[0], entry[1], entry[2]): src
                for src, entry in ff_sources
            }
            for future in as_completed(futures):
                src, smry, failed, line = future.result()
                summary[src] = smry
                any_failed = any_failed or failed
                print(line, file=sys.stderr)

    (CACHE_DIR / "fetch-summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )

    sys.exit(2 if any_failed else 0)


if __name__ == "__main__":
    main()
