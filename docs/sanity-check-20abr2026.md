# Sanity check — Porra Mundial 2026

> Fecha: 20 abr 2026 noche · HEAD en el momento del review: `0d11e13`
> Autor del análisis: Claude Code (Opus 4.7) tras barrido de ~8.600 LOC JS + 4.700 CSS + 1.035 HTML
> Propósito: documentar hallazgos priorizados para invertir ANTES del 11 jun 2026

Este doc consolida el sanity check del 20 abr. Se mantiene como referencia operativa — las acciones priorizadas viven también en `CLAUDE.md` (Pendientes abiertos) y `CONTEXTO_PORRA_2026.md` (Deuda técnica). El detalle completo está aquí.

---

## Índice

1. [Crítico — seguridad y correctness](#crítico)
2. [Alto — mantenibilidad y escala](#alto)
3. [Medio — performance y UX](#medio)
4. [Bajo — cosmético / infraestructura](#bajo)
5. [Plan recomendado antes del 11 jun](#plan)

---

## Crítico — seguridad y correctness <a id="crítico"></a>

### 1. La "IA" del pronóstico NO funciona en producción

`public/js/scoring.js:941` y `public/js/ui-nav.js:49` hacen:

```js
fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },   // ⚠ sin x-api-key
  body: JSON.stringify({...})
})
.then(r => r.json())
.catch(() => fallback);                              // ← siempre entra aquí
```

Sin header `x-api-key`, Anthropic responde 401. El `.catch()` devuelve un `fallback` hardcoded de 5 strings. **El usuario cree que la IA predice en vivo — son strings de un array fijo.**

No es un leak de credenciales (no hay credencial en el código). Es peor: la feature IA aparenta funcionar sin funcionar, y si algún día alguien "arregla" poniendo la API key en el cliente, sí sería leak crítico.

**Fix propuesto:** EF nueva `porra-ia-predict` en Supabase que reciba `{matchId, homeTeam, awayTeam, venue}`, llame a Anthropic con `ANTHROPIC_API_KEY` del Vault, y devuelva el JSON. Cache por `matchId + fecha` en tabla `ia_cache` para no gastar tokens en recomputos.

**Esfuerzo:** medio día. **ROI:** altísimo — activas una feature que creías tener + eliminas un landmine de seguridad.

---

### 2. Zero tests en 8.626 LOC de JS

`find -name '*.test.*'` → 0 resultados. El motor de puntuación (`public/js/scoring.js:43-193`) codifica las reglas que decidirán quién gana el bote real entre San y sus amigos:

- `+1` signo, `+3` resultado exacto (no acumula con signo)
- `+2` goleador correcto, `+1` bonus si pronóstico opuesto a IA y aciertas
- `+5 / +5 / +10 / +15 / +20 / +25` por equipo que avanza en cada ronda KO
- `+30 / +20 / +15 / +10` clasificación final
- `+15` Balón/Bota/Guante Oro, `+20` Mejor Joven ≤21
- Overrides admin desde tabla `results` que pueden alterar todo lo anterior

13+ casos con prioridad entre reglas. **Un bug aquí el día de la final y hay disputas reales entre amigos con dinero de por medio.**

**Fix propuesto:** Vitest + 30 tests unitarios cubriendo `calcMatchPoints`, `calcKOMatchPoints`, `calcGroupsAdvancePoints`, `calcClassificationPoints`, `calcAwardPoints`, `calcTotalUserPoints`. Cada test un caso real + un edge case.

**Esfuerzo:** 2 días. **ROI:** máximo — es la capa que más dolor daría si falla en producción.

---

### 3. Sin CI/CD

`ls .github/workflows/` → vacío. Cada `git push origin main` dispara Vercel directamente sin:

- Linter (ESLint no configurado)
- Type-check
- `node --check` sobre los .js
- `npm run build` verificador
- Tests (cuando existan)

La saga v2.1→v2.11 del F5 de ayer (11 iteraciones, varios reverts) es el síntoma directo: sin gates, cualquier regresión llega a producción y se descubre con San refrescando su iPhone.

**Fix propuesto:** GitHub Action mínima en 10-15 líneas:

```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build
      - run: node --check public/js/*.js js/*.js
      # - run: npm test   ← cuando haya tests
```

**Esfuerzo:** 2 horas. **ROI:** bloqueas regresiones obvias antes de merge.
