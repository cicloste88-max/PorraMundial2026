"""Fetch HTML for all primary sources using Scrapling.

Writes each source HTML to cache/sources/<source>.html for sync-squads.mjs
parsers to read. Designed to run as a GH Actions step BEFORE node runs.

Methods (per source, validated 22-may con probes 26279588881/26281337027/
26293035353/26293757651):
  - sport, olympics, marca → Fetcher.get(impersonate='chrome')  (curl_cffi, ~50-2000ms)
  - as, espn, ff-*         → StealthyFetcher.fetch(solve_cloudflare=False)  (~3-7s)

Eurosport descartada: server-side geoblock 307 → /geoblocking.shtml desde IPs
USA, irresoluble client-side. ESPN Deportes (Disney/Hearst) la reemplaza.

FF (futbolfantasy.com) integración 27-may-2026:
- Pre-fetch del HTML de equipos/<slug> de FF para el XI titular.
- Cloudflare en FF bloquea Fetcher.get(impersonate) en IPs USA, requiere
  StealthyFetcher (validado).
- Empezamos con España como piloto para validar el flujo end-to-end.
  Si OK, escalable a las 30+ FINAL via FF_COUNTRIES list.

Exit codes:
  0  → all sources OK (markers >=3, bytes > 10K)
  2  → partial failure (≥1 fuente con cache vacío). NO interrumpe el job —
       sync-squads.mjs detectará caches vacíos y skip por fuente.

El script NUNCA hace raise sobre fallos individuales: escribe un fichero
vacío como sentinel y loga a stderr, para que el motor Node pueda fallback
a las fuentes que sí cargaron.
"""

import os
import sys
import time
import json
from pathlib import Path

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

# Mapeo iso3 → slug FF. Slug usa nombre español del país. Coincide en mayoría
# con scripts/lib/iso3-slugs.json pero mantenemos copia local para que el
# fetcher Python no dependa de un JSON de Node.
FF_COUNTRIES = {
    "ESP": "espana",
    # TODO scale a las demás FINAL tras validar el piloto con España.
}

for iso3, slug in FF_COUNTRIES.items():
    SOURCES[f"ff-{iso3.lower()}"] = (
        f"https://www.futbolfantasy.com/world-cup/equipos/{slug}",
        "stealthy",
        FF_MARKERS,
    )

CACHE_DIR = Path("cache/sources")


def fetch(method, url):
    if method == "impersonate":
        return Fetcher.get(url, timeout=30, impersonate="chrome", stealthy_headers=True)
    if method == "stealthy":
        return StealthyFetcher.fetch(
            url,
            headless=True,
            network_idle=True,
            timeout=45000,
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


def main():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    summary = {}
    any_failed = False

    for source, entry in SOURCES.items():
        url, method, markers_list = entry
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
                summary[source] = {
                    "ok": True,
                    "bytes": len(html),
                    "ms": elapsed_ms,
                    "markers": markers[:5],
                }
                print(
                    f"[OK]   {source:12} bytes={len(html):7} ms={elapsed_ms:5} "
                    f"markers={markers[:3]}",
                    file=sys.stderr,
                )
            else:
                target.write_text("", encoding="utf-8")
                summary[source] = {
                    "ok": False,
                    "bytes": len(html),
                    "ms": elapsed_ms,
                    "reason": "no_markers_or_tiny",
                    "markers": markers,
                }
                print(
                    f"[FAIL] {source:12} bytes={len(html):7} ms={elapsed_ms:5} "
                    f"markers={markers}",
                    file=sys.stderr,
                )
                any_failed = True
        except Exception as e:
            target.write_text("", encoding="utf-8")
            summary[source] = {"ok": False, "error": str(e)[:200]}
            print(f"[ERR]  {source:12} {e}", file=sys.stderr)
            any_failed = True

    (CACHE_DIR / "fetch-summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )

    sys.exit(2 if any_failed else 0)


if __name__ == "__main__":
    main()
