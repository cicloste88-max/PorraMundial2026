"""
Probe Scrapling v2 - HTML content + content validation

Fixes from v1:
- Use page.html_content instead of str(page) to get real HTML bytes
- solve_cloudflare=False to avoid 2min timeouts on Olympics/Eurosport
- Better Cloudflare challenge detection
- Search for real content markers (country/coach names known to be in lists)
"""
import time
import json
from scrapling.fetchers import Fetcher, StealthyFetcher

SOURCES = [
    ("as",        "https://as.com/futbol/mundial/listas-de-convocados-para-el-mundial-2026-selecciones-y-todos-los-jugadores-que-estaran-en-la-copa-del-mundo-f202605-n-2/"),
    ("sport",     "https://www.sport.es/es/noticias/mundial-futbol/listas-convocados-mundial-2026-jugadores-plantillas-selecciones-130245904"),
    ("olympics",  "https://www.olympics.com/es/noticias/mundial-2026-listas-48-selecciones"),
    ("eurosport", "https://www.eurosport.es/futbol/mundial/2026/convocatorias-selecciones-nacionales-todas-listas-jugadores-mundial-2026_sto23300837/story.shtml"),
    ("marca",     "https://www.marca.com/futbol/mundial/2026/05/16/convocatorias-oficiales-selecciones-disputaran-mundial.html"),
]

CHALLENGE_MARKERS = [
    "challenge-platform", "just a moment", "cf-browser-verification",
    "/cdn-cgi/challenge", "checking your browser", "_cf_chl_",
    "cf-spinner", "cf_clearance",
]

CONTENT_MARKERS = [
    "didier deschamps", "carlo ancelotti", "murat yakin",
    "julian nagelsmann", "luis de la fuente", "barbarez",
    "francia", "alemania", "espa", "brasil", "argentina",
    "suiza", "japon", "convocatoria", "convocados",
    "mundial 2026", "selecci",
]


def extract_html(page):
    if page is None:
        return ""
    for attr in ("html_content", "body", "content", "text"):
        if hasattr(page, attr):
            val = getattr(page, attr)
            if val is None:
                continue
            if isinstance(val, bytes):
                try:
                    return val.decode("utf-8", errors="replace")
                except Exception:
                    return val.decode("latin-1", errors="replace")
            if isinstance(val, str) and len(val) > 0:
                return val
    try:
        return str(page)
    except Exception:
        return ""


def extract_status(page):
    for attr in ("status", "status_code"):
        if hasattr(page, attr):
            return getattr(page, attr)
    return 0


def analyze(name, url, html, status, elapsed_ms, method, error=None):
    if error:
        return {
            "source": name, "url": url, "method": method,
            "status": status, "bytes": 0, "elapsed_ms": elapsed_ms,
            "cloudflare_challenge": False, "looks_real": False,
            "content_markers_found": [], "error": str(error),
        }
    html_lower = (html or "").lower()
    challenge = [m for m in CHALLENGE_MARKERS if m in html_lower]
    found = [m for m in CONTENT_MARKERS if m in html_lower]
    return {
        "source": name, "url": url, "method": method,
        "status": status, "bytes": len(html or ""), "elapsed_ms": elapsed_ms,
        "cloudflare_challenge": len(challenge) > 0,
        "challenge_markers": challenge[:3],
        "looks_real": len(found) >= 3,
        "content_markers_found": found[:10],
        "error": None,
    }


def probe_fetcher_plain(name, url):
    t0 = time.time()
    try:
        page = Fetcher.get(url, timeout=30)
        return analyze(name, url, extract_html(page), extract_status(page),
                       int((time.time() - t0) * 1000), "fetcher_plain")
    except Exception as e:
        return analyze(name, url, "", 0, int((time.time() - t0) * 1000), "fetcher_plain", error=e)


def probe_fetcher_impersonate(name, url):
    t0 = time.time()
    try:
        page = Fetcher.get(url, timeout=30, impersonate="chrome", stealthy_headers=True)
        return analyze(name, url, extract_html(page), extract_status(page),
                       int((time.time() - t0) * 1000), "fetcher_impersonate")
    except Exception as e:
        return analyze(name, url, "", 0, int((time.time() - t0) * 1000), "fetcher_impersonate", error=e)


def probe_stealthy(name, url):
    t0 = time.time()
    try:
        page = StealthyFetcher.fetch(
            url, headless=True, network_idle=True, timeout=45000,
            google_search=False, solve_cloudflare=False,
        )
        return analyze(name, url, extract_html(page), extract_status(page) or 200,
                       int((time.time() - t0) * 1000), "stealthy_fetch")
    except Exception as e:
        return analyze(name, url, "", 0, int((time.time() - t0) * 1000), "stealthy_fetch", error=e)


def probe_stealthy_cf(name, url):
    t0 = time.time()
    try:
        page = StealthyFetcher.fetch(
            url, headless=True, network_idle=True, timeout=60000,
            google_search=False, solve_cloudflare=True,
        )
        return analyze(name, url, extract_html(page), extract_status(page) or 200,
                       int((time.time() - t0) * 1000), "stealthy_cf_solve")
    except Exception as e:
        return analyze(name, url, "", 0, int((time.time() - t0) * 1000), "stealthy_cf_solve", error=e)


def verdict(r):
    if r.get("error"):
        return "ERROR"
    if r["cloudflare_challenge"]:
        return "CHALLENGE_BLOCKED"
    if r["status"] >= 400:
        return "FAIL_" + str(r["status"])
    if r["bytes"] < 1000:
        return "TINY_" + str(r["bytes"]) + "b"
    if r["looks_real"]:
        return "OK_REAL"
    return "OK_BUT_NO_CONTENT"


def main():
    results = []
    for name, url in SOURCES:
        print("\n=== " + name + " ===")
        for probe in (probe_fetcher_plain, probe_fetcher_impersonate, probe_stealthy):
            r = probe(name, url)
            results.append(r)
            v = verdict(r)
            err = " err=" + r["error"] if r["error"] else ""
            markers = ",".join(r.get("content_markers_found", [])[:5])
            chal = ",".join(r.get("challenge_markers", [])[:3])
            print("  " + r["method"].ljust(25) + " status=" + str(r["status"]).rjust(3) +
                  " bytes=" + str(r["bytes"]).rjust(7) +
                  " elapsed=" + str(r["elapsed_ms"]).rjust(5) + "ms verdict=" + v + err)
            if markers:
                print("    markers_found: " + markers)
            if chal:
                print("    challenge_markers: " + chal)
        if name == "as":
            r = probe_stealthy_cf(name, url)
            results.append(r)
            v = verdict(r)
            err = " err=" + r["error"] if r["error"] else ""
            markers = ",".join(r.get("content_markers_found", [])[:5])
            print("  " + r["method"].ljust(25) + " status=" + str(r["status"]).rjust(3) +
                  " bytes=" + str(r["bytes"]).rjust(7) +
                  " elapsed=" + str(r["elapsed_ms"]).rjust(5) + "ms verdict=" + v + err)
            if markers:
                print("    markers_found: " + markers)

    with open("probe-results.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\n=== Resumen final ===")
    by_source = {}
    for r in results:
        by_source.setdefault(r["source"], []).append(r)
    for src, runs in by_source.items():
        wins = [r for r in runs if verdict(r) == "OK_REAL"]
        winners = [(r["method"], r["bytes"], r["elapsed_ms"]) for r in wins]
        symbol = "OK" if wins else "FAIL"
        print("  " + src.ljust(10) + " [" + symbol + "] winners: " + str(winners or []))


if __name__ == "__main__":
    main()
