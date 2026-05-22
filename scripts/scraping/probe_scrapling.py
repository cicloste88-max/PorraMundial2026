"""
probe_scrapling.py v2 (22-may): bug-fix HTML content + keyword verification

v1 bug: usaba str(page) que en Scrapling devuelve representacion abreviada del
Selector (77-157 bytes). v2 usa page.html_content para obtener HTML real.

v2 cambios:
- HTML completo via page.html_content (fallback a page.body o str(page))
- Keywords FUERTES por source (nombre de selector, jugador conocido, DT)
- StealthyFetcher SIN solve_cloudflare=True por defecto (evita 2min timeout)
- Solo activa solve_cloudflare en AS (Cloudflare confirmado)
- Reporta first_1000_chars para inspeccion manual si keywords fallan
"""
import json
import time
from scrapling.fetchers import Fetcher, StealthyFetcher

SOURCES = [
    {
        "name": "as",
        "url": "https://as.com/futbol/mundial/listas-de-convocados-para-el-mundial-2026-selecciones-y-todos-los-jugadores-que-estaran-en-la-copa-del-mundo-f202605-n-2/",
        "keywords": ["mundial", "convocator", "lista", "selecc"],
        "strong_keywords": ["Mbapp", "Modric", "Nagelsmann", "Yakin", "Ancelotti"],
        "needs_cloudflare_solve": True,
    },
    {
        "name": "sport",
        "url": "https://www.sport.es/es/noticias/mundial-futbol/listas-convocados-mundial-2026-jugadores-plantillas-selecciones-130245904",
        "keywords": ["mundial", "convocator", "lista", "selecc"],
        "strong_keywords": ["Mbapp", "Modric", "Nagelsmann", "Yakin", "Ancelotti"],
        "needs_cloudflare_solve": False,
    },
    {
        "name": "olympics",
        "url": "https://www.olympics.com/es/noticias/mundial-2026-listas-48-selecciones",
        "keywords": ["mundial", "convocator", "lista", "selecc"],
        "strong_keywords": ["Mbapp", "Modric", "Nagelsmann", "Yakin", "Ancelotti"],
        "needs_cloudflare_solve": False,
    },
    {
        "name": "eurosport",
        "url": "https://www.eurosport.es/futbol/mundial/2026/convocatorias-selecciones-nacionales-todas-listas-jugadores-mundial-2026_sto23300837/story.shtml",
        "keywords": ["mundial", "convocator", "lista", "selecc"],
        "strong_keywords": ["Mbapp", "Modric", "Nagelsmann", "Yakin", "Ancelotti"],
        "needs_cloudflare_solve": False,
    },
    {
        "name": "marca",
        "url": "https://www.marca.com/futbol/mundial/2026/05/16/convocatorias-oficiales-selecciones-disputaran-mundial.html",
        "keywords": ["mundial", "convocator", "lista", "selecc"],
        "strong_keywords": ["Mbapp", "Modric", "Nagelsmann", "Yakin", "Ancelotti"],
        "needs_cloudflare_solve": False,
    },
]

CHALLENGE_MARKERS = ["challenge-platform", "just a moment", "cf-browser-verification", "/cdn-cgi/challenge", "ddos protection by cloudflare", "checking your browser"]


def get_html(page):
    """Try multiple ways to get full HTML from Scrapling page object."""
    for attr in ("html_content", "body"):
        v = getattr(page, attr, None)
        if isinstance(v, str) and len(v) > 200:
            return v
        if isinstance(v, (bytes, bytearray)):
            try:
                return v.decode("utf-8", errors="replace")
            except Exception:
                pass
    # Fallback: str(page) - sub-optimal
    return str(page)


def analyze(source_cfg, method, html, status, elapsed_ms, error=None):
    name = source_cfg["name"]
    if error:
        return {
            "source": name, "method": method, "status": status, "bytes": 0,
            "elapsed_ms": elapsed_ms, "cloudflare_challenge": False,
            "weak_keywords_found": [], "strong_keywords_found": [],
            "first_500": "", "error": str(error),
        }
    html_lower = html.lower() if html else ""
    weak = [k for k in source_cfg["keywords"] if k.lower() in html_lower]
    strong = [k for k in source_cfg["strong_keywords"] if k.lower() in html_lower]
    return {
        "source": name, "method": method, "status": status, "bytes": len(html or ""),
        "elapsed_ms": elapsed_ms,
        "cloudflare_challenge": any(m.lower() in html_lower for m in CHALLENGE_MARKERS),
        "weak_keywords_found": weak,
        "strong_keywords_found": strong,
        "first_500": (html[:500] if html else "").replace("\n", " ").replace("\r", " "),
        "error": None,
    }


def probe_fetcher_plain(source_cfg):
    url = source_cfg["url"]
    t0 = time.time()
    try:
        page = Fetcher.get(url, timeout=30)
        html = get_html(page)
        return analyze(source_cfg, "fetcher_plain", html, getattr(page, "status", 0),
                       int((time.time() - t0) * 1000))
    except Exception as e:
        return analyze(source_cfg, "fetcher_plain", "", 0, int((time.time() - t0) * 1000), error=e)


def probe_fetcher_impersonate(source_cfg):
    url = source_cfg["url"]
    t0 = time.time()
    try:
        page = Fetcher.get(url, timeout=30, impersonate="chrome", stealthy_headers=True)
        html = get_html(page)
        return analyze(source_cfg, "fetcher_impersonate", html, getattr(page, "status", 0),
                       int((time.time() - t0) * 1000))
    except Exception as e:
        return analyze(source_cfg, "fetcher_impersonate", "", 0, int((time.time() - t0) * 1000), error=e)


def probe_stealthy(source_cfg):
    url = source_cfg["url"]
    solve_cf = source_cfg.get("needs_cloudflare_solve", False)
    t0 = time.time()
    try:
        page = StealthyFetcher.fetch(url, headless=True, network_idle=True, timeout=60000,
                                     google_search=False, solve_cloudflare=solve_cf)
        html = get_html(page)
        status = getattr(page, "status", 200)
        return analyze(source_cfg, "stealthy_fetch", html, status,
                       int((time.time() - t0) * 1000))
    except Exception as e:
        return analyze(source_cfg, "stealthy_fetch", "", 0, int((time.time() - t0) * 1000), error=e)


def verdict(r):
    if r["error"]:
        return f"ERROR"
    if r["status"] != 200:
        return f"FAIL_{r['status']}"
    if r["cloudflare_challenge"]:
        return "CHALLENGE"
    if r["strong_keywords_found"]:
        return f"OK_STRONG[{len(r['strong_keywords_found'])}]"
    if r["weak_keywords_found"] and r["bytes"] > 5000:
        return f"OK_WEAK[{len(r['weak_keywords_found'])}/{r['bytes']}b]"
    if r["bytes"] > 5000:
        return "OK_NO_KEYWORDS"
    return "SUSPICIOUS_SMALL"


def main():
    results = []
    for src in SOURCES:
        print(f"\n=== {src['name']} ===")
        for probe in (probe_fetcher_plain, probe_fetcher_impersonate, probe_stealthy):
            r = probe(src)
            results.append(r)
            v = verdict(r)
            err = f" err={r['error'][:60]}" if r["error"] else ""
            print(f"  {r['method']:25} status={r['status']:3} bytes={r['bytes']:8} elapsed={r['elapsed_ms']:6}ms verdict={v}{err}")
            if r["strong_keywords_found"]:
                print(f"    strong found: {r['strong_keywords_found']}")

    with open("probe-results-v2.json", "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print("\n=== Resumen final ===")
    by_source = {}
    for r in results:
        by_source.setdefault(r["source"], []).append(r)
    for src_name, runs in by_source.items():
        ok_strong = [r["method"] for r in runs if r["strong_keywords_found"] and r["status"] == 200 and not r["cloudflare_challenge"]]
        ok_weak = [r["method"] for r in runs if not r["strong_keywords_found"] and r["weak_keywords_found"] and r["status"] == 200 and r["bytes"] > 5000 and not r["cloudflare_challenge"]]
        any_200 = [r["method"] for r in runs if r["status"] == 200]
        max_bytes = max((r["bytes"] for r in runs), default=0)
        print(f"  {src_name:10} maxBytes={max_bytes:8} strongOK={ok_strong} weakOK={ok_weak} any200={any_200}")


if __name__ == "__main__":
    main()
