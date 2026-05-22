"""Probe Scrapling para evaluar bypass de Cloudflare 403 en las 5 fuentes
primarias del detect del sync-squads. NO toca el pipeline real — solo genera
un report (probe-results.json + stdout) sobre tres métodos por fuente:

  1. Fetcher.get()                    — HTTP plano sin browser.
  2. Fetcher.get(impersonate='chrome')— curl_cffi + headers stealthy.
  3. StealthyFetcher.fetch()          — Playwright + solve Cloudflare Turnstile.

Criterio de éxito por fetch: HTTP 200 + contenido real (no interstitial CF +
markers semánticos de la página de convocatorias).

Uso (local o GH Actions):
  python scripts/scraping/probe_scrapling.py
"""

import json
import time

from scrapling.fetchers import Fetcher, StealthyFetcher

SOURCES = [
    ("as",        "https://as.com/futbol/mundial/listas-de-convocados-para-el-mundial-2026-selecciones-y-todos-los-jugadores-que-estaran-en-la-copa-del-mundo-f202605-n-2/"),
    ("sport",     "https://www.sport.es/es/noticias/mundial-futbol/listas-convocados-mundial-2026-jugadores-plantillas-selecciones-130245904"),
    ("olympics",  "https://www.olympics.com/es/noticias/mundial-2026-listas-48-selecciones"),
    ("eurosport", "https://www.eurosport.es/futbol/mundial/2026/convocatorias-selecciones-nacionales-todas-listas-jugadores-mundial-2026_sto23300837/story.shtml"),
    ("marca",     "https://www.marca.com/futbol/mundial/2026/05/16/convocatorias-oficiales-selecciones-disputaran-mundial.html"),
]

CHALLENGE_MARKERS = ["challenge-platform", "just a moment", "cf-browser-verification", "/cdn-cgi/challenge"]
CONTENT_MARKERS = ["convocatoria", "convocados", "mundial", "selección", "lista"]


def analyze(name, url, html, status, elapsed_ms, method, error=None):
    if error:
        return {
            "source": name, "url": url, "method": method,
            "status": status, "bytes": 0, "elapsed_ms": elapsed_ms,
            "cloudflare_challenge": False, "looks_real": False,
            "error": str(error),
        }
    html_lower = html.lower() if html else ""
    return {
        "source": name, "url": url, "method": method,
        "status": status, "bytes": len(html or ""), "elapsed_ms": elapsed_ms,
        "cloudflare_challenge": any(m.lower() in html_lower for m in CHALLENGE_MARKERS),
        "looks_real": any(m.lower() in html_lower for m in CONTENT_MARKERS),
        "error": None,
    }


def probe_fetcher_plain(name, url):
    t0 = time.time()
    try:
        page = Fetcher.get(url, timeout=30)
        return analyze(name, url, str(page), getattr(page, "status", 0),
                       int((time.time() - t0) * 1000), "fetcher_plain")
    except Exception as e:
        return analyze(name, url, "", 0, int((time.time() - t0) * 1000), "fetcher_plain", error=e)


def probe_fetcher_impersonate(name, url):
    t0 = time.time()
    try:
        page = Fetcher.get(url, timeout=30, impersonate="chrome", stealthy_headers=True)
        return analyze(name, url, str(page), getattr(page, "status", 0),
                       int((time.time() - t0) * 1000), "fetcher_impersonate")
    except Exception as e:
        return analyze(name, url, "", 0, int((time.time() - t0) * 1000), "fetcher_impersonate", error=e)


def probe_stealthy(name, url):
    t0 = time.time()
    try:
        page = StealthyFetcher.fetch(
            url,
            headless=True,
            network_idle=True,
            timeout=60000,
            google_search=False,
            solve_cloudflare=True,
        )
        status = getattr(page, "status", 200)
        return analyze(name, url, str(page), status,
                       int((time.time() - t0) * 1000), "stealthy_fetch")
    except Exception as e:
        return analyze(name, url, "", 0, int((time.time() - t0) * 1000), "stealthy_fetch", error=e)


def verdict_of(r):
    if r["status"] == 200 and r["looks_real"] and not r["cloudflare_challenge"]:
        return "OK_REAL"
    if r["cloudflare_challenge"]:
        return "CHALLENGE"
    if r["status"] == 200 and not r["looks_real"]:
        return "OK_BUT_NO_CONTENT"
    return f"FAIL_{r['status']}"


def main():
    results = []
    for name, url in SOURCES:
        print(f"\n=== {name} ===")
        for probe in (probe_fetcher_plain, probe_fetcher_impersonate, probe_stealthy):
            r = probe(name, url)
            results.append(r)
            err = f" err={r['error']}" if r["error"] else ""
            print(
                f"  {r['method']:25} status={r['status']:3} bytes={r['bytes']:6} "
                f"elapsed={r['elapsed_ms']:5}ms verdict={verdict_of(r)}{err}"
            )

    with open("probe-results.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\n=== Resumen final ===")
    by_source = {}
    for r in results:
        by_source.setdefault(r["source"], []).append(r)
    for src, runs in by_source.items():
        winners = [r["method"] for r in runs if verdict_of(r) == "OK_REAL"]
        any_ok = bool(winners)
        print(f"  {src:10} {'OK' if any_ok else 'KO'} winners: {winners or '[]'}")


if __name__ == "__main__":
    main()
