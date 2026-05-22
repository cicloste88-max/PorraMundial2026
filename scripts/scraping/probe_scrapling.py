"""
Probe Scrapling v3 - targeted verification
- AS n-3 directa (skip the 301 from n-2)
- Eurosport with explicit Accept-Language es-ES header
- Quick re-confirm Sport/Olympics/Marca with impersonate=chrome
"""
import time
import json
from scrapling.fetchers import Fetcher, StealthyFetcher

TESTS = [
    # name, url, method, extra_kwargs
    ("as_n3_impersonate",
     "https://as.com/futbol/mundial/listas-de-convocados-para-el-mundial-2026-selecciones-y-todos-los-jugadores-que-estaran-en-la-copa-del-mundo-f202605-n-3/",
     "impersonate",
     {}),
    ("as_n3_stealthy",
     "https://as.com/futbol/mundial/listas-de-convocados-para-el-mundial-2026-selecciones-y-todos-los-jugadores-que-estaran-en-la-copa-del-mundo-f202605-n-3/",
     "stealthy",
     {}),
    ("eurosport_es_lang",
     "https://www.eurosport.es/futbol/mundial/2026/convocatorias-selecciones-nacionales-todas-listas-jugadores-mundial-2026_sto23300837/story.shtml",
     "impersonate",
     {"headers": {"Accept-Language": "es-ES,es;q=0.9", "Referer": "https://www.google.es/"}}),
    ("eurosport_stealthy",
     "https://www.eurosport.es/futbol/mundial/2026/convocatorias-selecciones-nacionales-todas-listas-jugadores-mundial-2026_sto23300837/story.shtml",
     "stealthy",
     {}),
    # Control: re-confirm impersonate works on these
    ("sport_impersonate",
     "https://www.sport.es/es/noticias/mundial-futbol/listas-convocados-mundial-2026-jugadores-plantillas-selecciones-130245904",
     "impersonate",
     {}),
    ("olympics_impersonate",
     "https://www.olympics.com/es/noticias/mundial-2026-listas-48-selecciones",
     "impersonate",
     {}),
    ("marca_impersonate",
     "https://www.marca.com/futbol/mundial/2026/05/16/convocatorias-oficiales-selecciones-disputaran-mundial.html",
     "impersonate",
     {}),
]

CONTENT_MARKERS = [
    "didier deschamps", "carlo ancelotti", "murat yakin",
    "julian nagelsmann", "luis de la fuente", "barbarez",
    "francia", "alemania", "espa", "brasil", "argentina",
    "convocatoria", "convocados", "mundial 2026", "selecci",
]

GEOBLOCK_MARKERS = ["geoblocking", "geoblock", "not available in your region", "not available in your country"]


def extract_html(page):
    if page is None:
        return ""
    for attr in ("html_content", "body", "content", "text"):
        if hasattr(page, attr):
            val = getattr(page, attr)
            if val is None:
                continue
            if isinstance(val, bytes):
                return val.decode("utf-8", errors="replace")
            if isinstance(val, str) and len(val) > 0:
                return val
    return ""


def extract_status(page):
    for attr in ("status", "status_code"):
        if hasattr(page, attr):
            return getattr(page, attr)
    return 0


def extract_url(page):
    for attr in ("url", "final_url"):
        if hasattr(page, attr):
            v = getattr(page, attr)
            if v:
                return str(v)
    return ""


def run_test(name, url, method, kwargs):
    t0 = time.time()
    try:
        if method == "impersonate":
            kw = dict(impersonate="chrome", stealthy_headers=True, timeout=30)
            kw.update(kwargs)
            page = Fetcher.get(url, **kw)
        elif method == "stealthy":
            page = StealthyFetcher.fetch(
                url, headless=True, network_idle=True,
                timeout=45000, google_search=False, solve_cloudflare=False,
            )
        else:
            raise ValueError("unknown method " + method)
        html = extract_html(page)
        status = extract_status(page) or (200 if method == "stealthy" else 0)
        final_url = extract_url(page)
        elapsed = int((time.time() - t0) * 1000)
        html_lower = (html or "").lower()
        markers = [m for m in CONTENT_MARKERS if m in html_lower]
        geoblock = [m for m in GEOBLOCK_MARKERS if m in html_lower]
        return {
            "test": name, "url": url, "method": method,
            "final_url": final_url, "status": status,
            "bytes": len(html or ""), "elapsed_ms": elapsed,
            "markers": markers[:10], "marker_count": len(markers),
            "geoblock_markers": geoblock,
            "looks_real": len(markers) >= 3 and not geoblock,
            "error": None,
        }
    except Exception as e:
        return {
            "test": name, "url": url, "method": method,
            "final_url": "", "status": 0, "bytes": 0,
            "elapsed_ms": int((time.time() - t0) * 1000),
            "markers": [], "marker_count": 0, "geoblock_markers": [],
            "looks_real": False, "error": str(e),
        }


def main():
    results = []
    for name, url, method, kwargs in TESTS:
        print("\n=== " + name + " (" + method + ") ===")
        r = run_test(name, url, method, kwargs)
        results.append(r)
        verdict = "OK_REAL" if r["looks_real"] else (
            "GEOBLOCKED" if r["geoblock_markers"] else (
            "ERROR" if r["error"] else (
            "FAIL_" + str(r["status"]) if r["status"] >= 400 else (
            "TINY_" + str(r["bytes"]) + "b" if r["bytes"] < 1000 else "OK_BUT_NO_CONTENT"))))
        err = " err=" + r["error"] if r["error"] else ""
        print("  status=" + str(r["status"]) +
              " bytes=" + str(r["bytes"]) +
              " elapsed=" + str(r["elapsed_ms"]) + "ms" +
              " verdict=" + verdict + err)
        if r["final_url"] and r["final_url"] != r["url"]:
            print("  final_url: " + r["final_url"])
        if r["markers"]:
            print("  markers (" + str(r["marker_count"]) + "): " + ",".join(r["markers"][:5]))
        if r["geoblock_markers"]:
            print("  geoblock: " + ",".join(r["geoblock_markers"]))

    with open("probe-results.json", "w") as f:
        json.dump(results, f, indent=2)


if __name__ == "__main__":
    main()
