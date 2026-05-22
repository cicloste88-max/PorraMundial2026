"""
Mini-probe v4: ESPN Deportes as Eurosport replacement candidate.

Test the 3 standard methods + verify content markers indicate the real
convocados page (not a paywall, geoblock, or empty placeholder).
"""
import time
import json
from scrapling.fetchers import Fetcher, StealthyFetcher

URL_ESPN = "https://espndeportes.espn.com/futbol/mundial/nota/_/id/16715015/mundial-2026-convocatorias-de-selecciones-todas-las-listas-de-jugadores"

CONTENT_MARKERS = [
    "deschamps", "ancelotti", "yakin", "barbarez", "nagelsmann",
    "francia", "alemania", "espa", "brasil", "argentina",
    "convocatoria", "convocados", "selecci", "mundial 2026",
    "lista de convocados", "jugadores",
]
GEOBLOCK_MARKERS = [
    "geoblocking", "geoblock", "not available in your region",
    "access denied", "no disponible en tu", "no disponible en su",
    "this content is not available", "paywall",
]


def extract_html(page):
    if page is None:
        return ""
    for attr in ("html_content", "body", "content"):
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


def extract_final_url(page):
    for attr in ("url", "final_url"):
        if hasattr(page, attr):
            return getattr(page, attr)
    return None


def analyze(name, html, status, elapsed_ms, error=None, final_url=None):
    if error:
        return {
            "test": name, "status": 0, "bytes": 0, "elapsed_ms": elapsed_ms,
            "markers_found": [], "geoblock_found": [], "final_url": final_url,
            "error": str(error),
        }
    html_lower = (html or "").lower()
    markers = [m for m in CONTENT_MARKERS if m in html_lower]
    geo = [m for m in GEOBLOCK_MARKERS if m in html_lower]
    return {
        "test": name, "status": status, "bytes": len(html or ""), "elapsed_ms": elapsed_ms,
        "markers_found": markers[:10], "geoblock_found": geo[:5],
        "final_url": final_url, "error": None,
    }


def verdict(r):
    if r.get("error"):
        return "ERROR"
    if r.get("status", 0) >= 400:
        return "FAIL_" + str(r["status"])
    if r.get("geoblock_found"):
        return "GEOBLOCKED"
    if r.get("bytes", 0) < 1000:
        return "TINY_" + str(r["bytes"]) + "b"
    if len(r.get("markers_found", [])) >= 3:
        return "OK_REAL"
    return "OK_BUT_NO_MARKERS"


def run_test(name, url, method):
    t0 = time.time()
    try:
        if method == "plain":
            page = Fetcher.get(url, timeout=30)
        elif method == "impersonate":
            page = Fetcher.get(url, timeout=30, impersonate="chrome", stealthy_headers=True)
        elif method == "stealthy":
            page = StealthyFetcher.fetch(
                url, headless=True, network_idle=True, timeout=45000,
                solve_cloudflare=False, google_search=False,
            )
        else:
            raise ValueError("unknown method: " + method)
        html = extract_html(page)
        status = extract_status(page) or 200
        final = extract_final_url(page)
        return analyze(name, html, status, int((time.time() - t0) * 1000), final_url=final)
    except Exception as e:
        return analyze(name, "", 0, int((time.time() - t0) * 1000), error=e)


def main():
    tests = [
        ("espn_plain",       URL_ESPN, "plain"),
        ("espn_impersonate", URL_ESPN, "impersonate"),
        ("espn_stealthy",    URL_ESPN, "stealthy"),
    ]

    results = []
    print("\n=== Mini-probe v4 - ESPN Deportes ===")
    for name, url, method in tests:
        r = run_test(name, url, method)
        results.append(r)
        v = verdict(r)
        print("  " + r["test"].ljust(20) +
              " status=" + str(r.get("status", 0)).rjust(3) +
              " bytes=" + str(r.get("bytes", 0)).rjust(7) +
              " elapsed=" + str(r.get("elapsed_ms", 0)).rjust(5) + "ms verdict=" + v)
        if r.get("markers_found"):
            print("    markers: " + ",".join(r["markers_found"][:8]))
        if r.get("geoblock_found"):
            print("    GEOBLOCK: " + ",".join(r["geoblock_found"]))
        if r.get("final_url") and r["final_url"] != url:
            print("    final_url: " + str(r["final_url"]))
        if r.get("error"):
            print("    error: " + r["error"][:200])

    with open("probe-results.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\n=== Summary ===")
    oks = [r for r in results if verdict(r) == "OK_REAL"]
    winners = [(r["test"], r["bytes"], r["elapsed_ms"]) for r in oks]
    print("  espn winners: " + str(winners or "NONE"))


if __name__ == "__main__":
    main()
